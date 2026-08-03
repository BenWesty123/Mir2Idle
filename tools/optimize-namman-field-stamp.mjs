// Bake namman-field behind layers into a flat backdrop and pack only foreground
// assets into a much smaller stamp sheet (GPU / mobile VRAM fix for Danmo's room).
//
//   node tools/optimize-namman-field-stamp.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STAMP_DIR = path.join(ROOT, "public/mapstamps");
const INDEX_PATH = path.join(STAMP_DIR, "index.json");
const STAMP_ID = "namman-field-center";
const MAX_SHEET_EDGE = 8192;
const PAD = 1;

function isForegroundLayer(layer, spawnRow) {
  if (!spawnRow || !layer) return false;
  if (layer.kind === "back" || layer.kind === "middle" || layer.floor) return false;
  if (layer.inFront === true) return true;
  const mapRow = Math.trunc(Number(layer.mapRow) || 0);
  return mapRow > spawnRow;
}

function slotOrigin(stamp, slot) {
  const columns = Math.max(1, Math.trunc(Number(stamp.sheetColumns) || 1));
  const slotWidth = Math.max(1, Math.trunc(Number(stamp.slotWidth) || 1));
  const slotHeight = Math.max(1, Math.trunc(Number(stamp.slotHeight) || 1));
  const index = Math.max(0, Math.trunc(Number(slot) || 0));
  return {
    sx: (index % columns) * slotWidth,
    sy: Math.floor(index / columns) * slotHeight,
  };
}

function packShelf(items) {
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let sheetWidth = 1;
  let sheetHeight = 1;
  for (const item of items) {
    const placeW = item.w + PAD;
    const placeH = item.h + PAD;
    if (placeW > MAX_SHEET_EDGE || placeH > MAX_SHEET_EDGE) {
      throw new Error(`FG asset ${item.w}x${item.h} exceeds MaxSheetEdge`);
    }
    if (cursorX > 0 && cursorX + placeW > MAX_SHEET_EDGE) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    item.sheetX = cursorX;
    item.sheetY = cursorY;
    cursorX += placeW;
    rowHeight = Math.max(rowHeight, placeH);
    sheetWidth = Math.max(sheetWidth, cursorX);
    sheetHeight = Math.max(sheetHeight, cursorY + rowHeight);
  }
  if (sheetWidth > MAX_SHEET_EDGE || sheetHeight > MAX_SHEET_EDGE) {
    throw new Error(`Packed FG sheet ${sheetWidth}x${sheetHeight} exceeds MaxSheetEdge`);
  }
  return { sheetWidth, sheetHeight };
}

async function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const stamp = index.stamps?.find((entry) => entry.id === STAMP_ID);
  if (!stamp) throw new Error(`Missing stamp ${STAMP_ID} in index.json`);

  const sheetPath = path.join(STAMP_DIR, stamp.sheet);
  if (!fs.existsSync(sheetPath)) throw new Error(`Missing sheet ${sheetPath}`);

  const spawnRow = Math.trunc(Number(stamp.spawnMapY) || 0);
  const layers = Array.isArray(stamp.layers) ? stamp.layers : [];
  const behind = [];
  const front = [];
  for (const layer of layers) {
    if (isForegroundLayer(layer, spawnRow)) front.push(layer);
    else behind.push(layer);
  }

  const stampW = Math.max(1, Math.trunc(Number(stamp.width) || 1));
  const stampH = Math.max(1, Math.trunc(Number(stamp.height) || 1));
  const slotW = Math.max(1, Math.trunc(Number(stamp.slotWidth) || 1));
  const slotH = Math.max(1, Math.trunc(Number(stamp.slotHeight) || 1));

  const sheet = sharp(sheetPath).ensureAlpha();
  const sheetMeta = await sheet.metadata();
  const sheetBuffer = await sheet.raw().toBuffer();
  const sheetStride = (sheetMeta.width || 1) * 4;

  const readSlot = (layer) => {
    const { sx, sy } = slotOrigin(stamp, layer.slot);
    const w = Math.max(1, Math.trunc(Number(layer.w) || slotW));
    const h = Math.max(1, Math.trunc(Number(layer.h) || slotH));
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      const srcY = sy + y;
      if (srcY < 0 || srcY >= sheetMeta.height) continue;
      for (let x = 0; x < w; x++) {
        const srcX = sx + x;
        if (srcX < 0 || srcX >= sheetMeta.width) continue;
        const si = srcY * sheetStride + srcX * 4;
        const di = (y * w + x) * 4;
        out[di] = sheetBuffer[si];
        out[di + 1] = sheetBuffer[si + 1];
        out[di + 2] = sheetBuffer[si + 2];
        out[di + 3] = sheetBuffer[si + 3];
      }
    }
    return { w, h, rgba: out };
  };

  // Composite behind layers in draw order onto a flat backdrop.
  const backdrop = Buffer.alloc(stampW * stampH * 4);
  const blit = (dst, dstW, src, dx, dy, w, h) => {
    for (let y = 0; y < h; y++) {
      const dy2 = dy + y;
      if (dy2 < 0 || dy2 >= stampH) continue;
      for (let x = 0; x < w; x++) {
        const dx2 = dx + x;
        if (dx2 < 0 || dx2 >= stampW) continue;
        const si = (y * w + x) * 4;
        const a = src[si + 3];
        if (a === 0) continue;
        const di = (dy2 * dstW + dx2) * 4;
        if (a === 255) {
          dst[di] = src[si];
          dst[di + 1] = src[si + 1];
          dst[di + 2] = src[si + 2];
          dst[di + 3] = 255;
          continue;
        }
        // Source-over.
        const inv = 255 - a;
        dst[di] = Math.round((src[si] * a + dst[di] * inv) / 255);
        dst[di + 1] = Math.round((src[si + 1] * a + dst[di + 1] * inv) / 255);
        dst[di + 2] = Math.round((src[si + 2] * a + dst[di + 2] * inv) / 255);
        dst[di + 3] = Math.min(255, a + Math.round((dst[di + 3] * inv) / 255));
      }
    }
  };

  for (const layer of behind) {
    const tile = readSlot(layer);
    blit(
      backdrop,
      stampW,
      tile.rgba,
      Math.trunc(Number(layer.x) || 0),
      Math.trunc(Number(layer.y) || 0),
      tile.w,
      tile.h,
    );
  }

  const backdropName = `${STAMP_ID}-backdrop.png`;
  const backdropPath = path.join(STAMP_DIR, backdropName);
  await sharp(backdrop, { raw: { width: stampW, height: stampH, channels: 4 } })
    .png()
    .toFile(backdropPath);

  // Shelf-pack FG crops into a tight sheet.
  const fgItems = front.map((layer, index) => {
    const tile = readSlot(layer);
    return {
      index,
      layer,
      w: tile.w,
      h: tile.h,
      rgba: tile.rgba,
    };
  });
  const packed = packShelf(fgItems);
  const fgSheet = Buffer.alloc(packed.sheetWidth * packed.sheetHeight * 4);
  for (const item of fgItems) {
    blit(fgSheet, packed.sheetWidth, item.rgba, item.sheetX, item.sheetY, item.w, item.h);
  }

  const fgSheetName = `${STAMP_ID}-stamp.png`;
  const fgSheetPath = path.join(STAMP_DIR, fgSheetName);
  await sharp(fgSheet, {
    raw: { width: packed.sheetWidth, height: packed.sheetHeight, channels: 4 },
  })
    .png()
    .toFile(fgSheetPath);

  const nextLayers = fgItems.map((item) => ({
    ...item.layer,
    sheetX: item.sheetX,
    sheetY: item.sheetY,
    // Keep slot for compatibility; runtime prefers sheetX/sheetY when present.
    slot: item.index,
  }));

  stamp.sheet = fgSheetName;
  stamp.backdrop = backdropName;
  stamp.backdropWidth = stampW;
  stamp.backdropHeight = stampH;
  stamp.layers = nextLayers;
  stamp.sheetColumns = 1;
  stamp.sheetRows = nextLayers.length;
  stamp.slotWidth = Math.max(1, ...nextLayers.map((layer) => Math.trunc(Number(layer.w) || 1)));
  stamp.slotHeight = Math.max(1, ...nextLayers.map((layer) => Math.trunc(Number(layer.h) || 1)));
  // Drop the giant packed asset list; FG layers are self-describing now.
  if (Array.isArray(stamp.assets)) {
    stamp.assets = nextLayers.map((layer, i) => ({
      slot: i,
      source: layer.source,
      w: layer.w,
      h: layer.h,
    }));
  }

  fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index)}\n`);

  const oldVram = ((sheetMeta.width * sheetMeta.height * 4) / (1024 * 1024)).toFixed(1);
  const backVram = ((stampW * stampH * 4) / (1024 * 1024)).toFixed(1);
  const fgVram = ((packed.sheetWidth * packed.sheetHeight * 4) / (1024 * 1024)).toFixed(1);
  console.log(
    `Optimized ${STAMP_ID}: behind ${behind.length} → ${backdropName} ${stampW}x${stampH} (~${backVram} MB); ` +
      `front ${front.length} → ${fgSheetName} ${packed.sheetWidth}x${packed.sheetHeight} (~${fgVram} MB); ` +
      `was sheet ${sheetMeta.width}x${sheetMeta.height} (~${oldVram} MB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
