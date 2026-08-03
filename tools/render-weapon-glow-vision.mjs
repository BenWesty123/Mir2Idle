#!/usr/bin/env node
/**
 * Render CWeaponEffect glows and weapon shapes as flat PNG contact sheets so they
 * can be judged by eye (or by a vision model) instead of only by geometric score.
 *
 * Both layers are blitted at their native Crystal anchor, so a glow that belongs to
 * a weapon traces that weapon's blade.
 *
 * Usage:
 *   node tools/render-weapon-glow-vision.mjs glows [--set unmapped|all|1,2,3]
 *   node tools/render-weapon-glow-vision.mjs weapons [--set unmapped|all|1,2,3]
 *   node tools/render-weapon-glow-vision.mjs pairs --list 1:30,2:22 [--style outline|natural]
 *
 * Options: --cols N --cell N --out DIR --action NAME --frame N
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commonDir = path.join(root, "public", "sprite-sets", "common");
const mappingsPath = path.join(root, "tools", "weapon-glow-mappings.json");
const crystalItemsPath = path.join(root, "src", "data", "crystal-items.json");

const WORLD = 420;
const ANCHOR_X = 210;
const ANCHOR_Y = 270;
const ALPHA_THRESHOLD = 16;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) out[token.slice(2)] = argv[++i];
    else out._.push(token);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] ?? "glows";
const cols = Number(args.cols ?? 8);
const cell = Number(args.cell ?? 190);
const style = args.style ?? "outline";
const actionName = args.action ?? "standing";
const frameIndex = Number(args.frame ?? 0);
const outDir = args.out ?? path.join(root, "tile-review", "weapon-glows", "vision");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function loadMappings() {
  if (!fs.existsSync(mappingsPath)) return [];
  return readJson(mappingsPath).mappings ?? [];
}

function weaponNamesByShape() {
  const byShape = new Map();
  try {
    const doc = readJson(crystalItemsPath);
    const items = Array.isArray(doc) ? doc : (doc.items ?? Object.values(doc));
    for (const it of items) {
      if (!it || it.type !== "Weapon" || typeof it.shape !== "number") continue;
      if (!byShape.has(it.shape)) byShape.set(it.shape, []);
      const list = byShape.get(it.shape);
      if (list.length < 2 && !list.includes(it.name)) list.push(it.name);
    }
  } catch {
    // names are decoration only
  }
  return byShape;
}

function listIndexes(layer) {
  const dir = path.join(commonDir, layer);
  return fs.readdirSync(dir)
    .filter((name) => /^\d+\.json$/.test(name))
    .map((name) => Number(path.basename(name, ".json")))
    .sort((a, b) => a - b);
}

async function loadLayer(layer, index) {
  const atlas = readJson(path.join(commonDir, layer, `${index}.json`));
  const { data, info } = await sharp(path.join(commonDir, layer, `${index}.png`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { atlas, sheet: { data, width: info.width, height: info.height } };
}

/** Pick the requested frame, falling back to the first frame that has pixels. */
function pickFrame(atlas) {
  const order = [actionName, "standing", "stance", "attack1", "walking"];
  for (const name of order) {
    const frames = atlas.actions?.[name]?.frames ?? [];
    const preferred = frames[frameIndex];
    if (preferred && !preferred.empty && preferred.w > 0) return preferred;
    const any = frames.find((f) => f && !f.empty && f.w > 0);
    if (any) return any;
  }
  return null;
}

/** Blit one atlas frame into a WORLD-sized RGBA buffer at the Crystal anchor. */
function blit(target, layerData, { silhouette = null } = {}) {
  if (!layerData) return null;
  const { atlas, sheet } = layerData;
  const frame = pickFrame(atlas);
  if (!frame) return null;
  const sx0 = (frame.slot ?? 0) * atlas.slotWidth;
  const mask = new Uint8Array(WORLD * WORLD);
  let minX = 1e9; let minY = 1e9; let maxX = -1; let maxY = -1;

  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const si = ((y * sheet.width) + (sx0 + x)) * 4;
      const alpha = sheet.data[si + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      const dx = ANCHOR_X + (frame.offsetX ?? 0) + x;
      const dy = ANCHOR_Y + (frame.offsetY ?? 0) + y;
      if (dx < 0 || dy < 0 || dx >= WORLD || dy >= WORLD) continue;
      mask[(dy * WORLD) + dx] = 1;
      if (dx < minX) minX = dx;
      if (dy < minY) minY = dy;
      if (dx > maxX) maxX = dx;
      if (dy > maxY) maxY = dy;
      if (silhouette) continue;
      // Additive so overlapping glow reads like Crystal's DrawBlend.
      const di = ((dy * WORLD) + dx) * 4;
      target[di] = Math.min(255, target[di] + sheet.data[si]);
      target[di + 1] = Math.min(255, target[di + 1] + sheet.data[si + 1]);
      target[di + 2] = Math.min(255, target[di + 2] + sheet.data[si + 2]);
      target[di + 3] = 255;
    }
  }
  if (maxX < 0) return null;
  return { mask, bbox: { minX, minY, maxX, maxY } };
}

/** Draw a mask as a bright outline with a faint fill, so overlap stays readable. */
function strokeMask(target, mask, color) {
  for (let y = 1; y < WORLD - 1; y++) {
    for (let x = 1; x < WORLD - 1; x++) {
      const i = (y * WORLD) + x;
      if (!mask[i]) continue;
      const edge = !mask[i - 1] || !mask[i + 1] || !mask[i - WORLD] || !mask[i + WORLD];
      const di = i * 4;
      const a = edge ? 1 : 0.22;
      target[di] = Math.min(255, (target[di] * (1 - a)) + (color[0] * a));
      target[di + 1] = Math.min(255, (target[di + 1] * (1 - a)) + (color[1] * a));
      target[di + 2] = Math.min(255, (target[di + 2] * (1 - a)) + (color[2] * a));
      target[di + 3] = 255;
    }
  }
}

function unionBox(...boxes) {
  const live = boxes.filter(Boolean);
  if (!live.length) return null;
  return {
    minX: Math.min(...live.map((b) => b.minX)),
    minY: Math.min(...live.map((b) => b.minY)),
    maxX: Math.max(...live.map((b) => b.maxX)),
    maxY: Math.max(...live.map((b) => b.maxY)),
  };
}

/** Crop to content, then nearest-neighbour scale into a square cell. */
function toCell(world, bbox, size) {
  const pad = 4;
  const x0 = Math.max(0, bbox.minX - pad);
  const y0 = Math.max(0, bbox.minY - pad);
  const w = Math.min(WORLD - x0, (bbox.maxX - bbox.minX + 1) + (pad * 2));
  const h = Math.min(WORLD - y0, (bbox.maxY - bbox.minY + 1) + (pad * 2));
  const scale = Math.min(size / w, size / h);
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 12; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255;
  }
  const drawW = Math.floor(w * scale);
  const drawH = Math.floor(h * scale);
  const offX = Math.floor((size - drawW) / 2);
  const offY = Math.floor((size - drawH) / 2);
  for (let y = 0; y < drawH; y++) {
    const sy = y0 + Math.floor(y / scale);
    for (let x = 0; x < drawW; x++) {
      const sx = x0 + Math.floor(x / scale);
      const si = ((sy * WORLD) + sx) * 4;
      const di = (((y + offY) * size) + (x + offX)) * 4;
      const a = world[si + 3] / 255;
      if (a <= 0) continue;
      out[di] = world[si];
      out[di + 1] = world[si + 1];
      out[di + 2] = world[si + 2];
      out[di + 3] = 255;
    }
  }
  return out;
}

function newWorld() {
  const buf = Buffer.alloc(WORLD * WORLD * 4);
  for (let i = 0; i < buf.length; i += 4) buf[i + 3] = 255;
  return buf;
}

async function renderCell(glowIndex, weaponShape, size) {
  const world = newWorld();
  const glow = glowIndex == null ? null : await loadLayer("weaponGlow", glowIndex).catch(() => null);
  const weapon = weaponShape == null ? null : await loadLayer("weapon", weaponShape).catch(() => null);

  const glowDrawn = glow ? blit(world, glow) : null;
  let weaponDrawn = null;
  if (weapon) {
    if (style === "natural" || glowIndex == null) {
      weaponDrawn = blit(world, weapon);
    } else {
      weaponDrawn = blit(world, weapon, { silhouette: true });
      if (weaponDrawn) strokeMask(world, weaponDrawn.mask, [255, 255, 255]);
    }
  }
  const bbox = unionBox(glowDrawn?.bbox, weaponDrawn?.bbox);
  if (!bbox) return null;
  return toCell(world, bbox, size);
}

function labelSvg(text, sub, width, height) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${width}" height="${height}" fill="#16130f"/>` +
    `<text x="6" y="15" font-family="monospace" font-size="14" fill="#f0d9a8">${esc(text)}</text>` +
    `<text x="6" y="29" font-family="monospace" font-size="11" fill="#9a8b74">${esc(sub)}</text>` +
    `</svg>`,
  );
}

async function buildSheet(cells, outPath) {
  const labelH = 34;
  const rows = Math.ceil(cells.length / cols);
  const sheetW = cols * cell;
  const sheetH = rows * (cell + labelH);
  const composites = [];
  for (let i = 0; i < cells.length; i++) {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * (cell + labelH);
    composites.push({
      input: await sharp(cells[i].pixels, { raw: { width: cell, height: cell, channels: 4 } }).png().toBuffer(),
      left: cx,
      top: cy,
    });
    composites.push({ input: labelSvg(cells[i].title, cells[i].sub, cell, labelH), left: cx, top: cy + cell });
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 10, g: 9, b: 8, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(outPath);
  return { outPath, width: sheetW, height: sheetH, count: cells.length };
}

function resolveSet(spec, all, mapped) {
  if (!spec || spec === "unmapped") return all.filter((i) => !mapped.has(i));
  if (spec === "mapped") return all.filter((i) => mapped.has(i));
  if (spec === "all") return all;
  return spec.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const mappings = loadMappings();
  const names = weaponNamesByShape();
  const cells = [];
  let outName = "sheet.png";

  if (command === "glows") {
    const mapped = new Set(mappings.map((m) => m.glow));
    const set = resolveSet(args.set, listIndexes("weaponGlow"), mapped);
    for (const index of set) {
      const pixels = await renderCell(index, null, cell);
      if (!pixels) continue;
      cells.push({ pixels, title: `glow ${index}`, sub: mapped.has(index) ? "mapped" : "unmapped" });
    }
    outName = `glows-${args.set ?? "unmapped"}.png`;
  } else if (command === "weapons") {
    const mapped = new Set(mappings.map((m) => m.weaponShape));
    const set = resolveSet(args.set, listIndexes("weapon"), mapped);
    for (const index of set) {
      const pixels = await renderCell(null, index, cell);
      if (!pixels) continue;
      cells.push({
        pixels,
        title: `shape ${index}`,
        sub: (names.get(index) ?? []).join(", ").slice(0, 26) || "unnamed",
      });
    }
    outName = `weapons-${args.set ?? "unmapped"}.png`;
  } else if (command === "pairs") {
    const list = (args.list ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const entry of list) {
      const [g, w] = entry.split(":").map(Number);
      const pixels = await renderCell(g, w, cell);
      if (!pixels) continue;
      cells.push({
        pixels,
        title: `glow ${g} + shape ${w}`,
        sub: (names.get(w) ?? []).join(", ").slice(0, 26) || "unnamed",
      });
    }
    outName = `pairs-${style}.png`;
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  if (!cells.length) throw new Error("Nothing rendered.");
  const result = await buildSheet(cells, path.join(outDir, args.name ?? outName));
  console.log(`${result.outPath}  ${result.width}x${result.height}  cells=${result.count}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
