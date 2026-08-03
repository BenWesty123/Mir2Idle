// Rebuild Danmo (AncientBringer / monster 272) with GPU-safe shelf packing.
//
// Body + on-mob blends → 272.png (≤8192 edge)
// Travel / impact / heavy burst → 272-fx.png companion (same pattern as Great Fox)
//
// Crystal Client (west / Direction 6):
//   Attack1 blend:     512 + dir*6  ×6  → 548..553
//   Attack2 blend:     568 + dir*10 ×10 → 628..637
//   Range1 body blend: FI 0..2 empty, FI 3..7 → 678..682
//   Range1 projectile: travel 712..715 (dir 6); impact 720 ×10
//   Range2 body blend: 730..734 (dir-0 slice); burst 740 ×14 on target
//
//   node tools/build-danmo-combat-atlas.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CrystalLibV3 } from "./lib/crystal-libv3.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";
import { buildAtlas } from "./build-libv1-monster-atlas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LIB = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data/Monster/272.Lib";
const OUT_JSON = path.join(ROOT, "public/monsters/monster/272.json");
const OUT_PNG = path.join(ROOT, "public/monsters/monster/272.png");
const FX_SHEET_NAME = "272-fx.png";
const OUT_FX_PNG = path.join(ROOT, "public/monsters/monster", FX_SHEET_NAME);
const DIR = 6;
const MAX_SHEET_EDGE = 8192;
const PAD = 1;

function readFrame(lib, srcFrame) {
  const img = lib.readFrame(srcFrame);
  if (!img || img.width <= 0 || img.height <= 0) return null;
  return img;
}

function emptyFrame(srcFrame = -1) {
  return {
    sheetX: 0,
    sheetY: 0,
    srcFrame,
    w: 0,
    h: 0,
    offsetX: 0,
    offsetY: 0,
    empty: true,
  };
}

function collectFrames(lib, start, count) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const srcFrame = start + i;
    const img = readFrame(lib, srcFrame);
    frames.push({
      srcFrame,
      img,
      empty: !img,
      w: img?.width ?? 0,
      h: img?.height ?? 0,
      offsetX: img?.offsetX ?? 0,
      offsetY: img?.offsetY ?? 0,
    });
  }
  return frames;
}

/** Shelf-pack unique srcFrames under MaxSheetEdge; mutates frames with sheetX/sheetY. */
function packFrameSheet(frames, pngPath) {
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let sheetWidth = 1;
  let sheetHeight = 1;
  const uniqueBySrc = new Map();

  for (const frame of frames) {
    if (frame.empty || !frame.img || frame.w <= 0 || frame.h <= 0) {
      frame.sheetX = 0;
      frame.sheetY = 0;
      continue;
    }
    const key = String(frame.srcFrame);
    const existing = uniqueBySrc.get(key);
    if (existing) {
      frame.sheetX = existing.sheetX;
      frame.sheetY = existing.sheetY;
      continue;
    }
    const placeW = frame.w + PAD;
    const placeH = frame.h + PAD;
    if (placeW > MAX_SHEET_EDGE || placeH > MAX_SHEET_EDGE) {
      throw new Error(`Frame ${frame.srcFrame} (${frame.w}x${frame.h}) exceeds MaxSheetEdge ${MAX_SHEET_EDGE}`);
    }
    if (cursorX > 0 && cursorX + placeW > MAX_SHEET_EDGE) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    frame.sheetX = cursorX;
    frame.sheetY = cursorY;
    cursorX += placeW;
    rowHeight = Math.max(rowHeight, placeH);
    sheetWidth = Math.max(sheetWidth, cursorX);
    sheetHeight = Math.max(sheetHeight, cursorY + rowHeight);
    uniqueBySrc.set(key, frame);
  }

  if (sheetWidth > MAX_SHEET_EDGE || sheetHeight > MAX_SHEET_EDGE) {
    throw new Error(`Packed sheet ${sheetWidth}x${sheetHeight} exceeds MaxSheetEdge ${MAX_SHEET_EDGE}`);
  }

  const sheet = Buffer.alloc(sheetWidth * sheetHeight * 4);
  for (const frame of uniqueBySrc.values()) {
    if (!frame.img) continue;
    blitScaled(sheet, sheetWidth, frame.img, frame.sheetX, frame.sheetY, frame.w, frame.h);
  }
  fs.writeFileSync(pngPath, writePng(sheetWidth, sheetHeight, sheet));
  return { sheetWidth, sheetHeight, uniqueCount: uniqueBySrc.size };
}

function toJsonFrame(frame) {
  if (frame.empty || !frame.img) return emptyFrame(frame.srcFrame);
  return {
    sheetX: frame.sheetX,
    sheetY: frame.sheetY,
    srcFrame: frame.srcFrame,
    w: frame.w,
    h: frame.h,
    offsetX: frame.offsetX,
    offsetY: frame.offsetY,
  };
}

function main() {
  if (!fs.existsSync(LIB)) throw new Error(`Missing lib: ${LIB}`);

  // Column-packed body first (FrameSet actions), then we re-shelf-pack with blends.
  buildAtlas({ lib: LIB, id: 272, frameLib: LIB, dir: DIR, scale: 1 });
  const atlas = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));

  const lib = new CrystalLibV3(LIB);
  try {
    const bodyPacked = [];
    let slotW = 1;
    let slotH = 1;
    for (const [actionName, action] of Object.entries(atlas.actions ?? {})) {
      if (/Blend$/i.test(actionName)) continue;
      for (const fr of action.frames ?? []) {
        const img = fr.empty ? null : readFrame(lib, fr.srcFrame);
        if (img) {
          slotW = Math.max(slotW, img.width);
          slotH = Math.max(slotH, img.height);
        }
        bodyPacked.push({
          action: actionName,
          interval: action.interval ?? 100,
          srcFrame: fr.srcFrame,
          img,
          empty: !img,
          w: img?.width ?? 0,
          h: img?.height ?? 0,
          offsetX: img?.offsetX ?? 0,
          offsetY: img?.offsetY ?? 0,
        });
      }
    }

    const blendSpecs = [
      { action: "attack1Blend", start: 512 + DIR * 6, count: 6, interval: 100, padEmptyFront: 0 },
      { action: "attack2Blend", start: 568 + DIR * 10, count: 10, interval: 100, padEmptyFront: 0 },
      { action: "attackRange1Blend", start: 678, count: 5, interval: 100, padEmptyFront: 3 },
      { action: "attackRange2Blend", start: 730, count: 5, interval: 100, padEmptyFront: 3 },
    ];
    for (const spec of blendSpecs) {
      for (let i = 0; i < spec.padEmptyFront; i++) {
        bodyPacked.push({
          action: spec.action,
          interval: spec.interval,
          srcFrame: -1,
          img: null,
          empty: true,
          w: 0,
          h: 0,
          offsetX: 0,
          offsetY: 0,
          pad: true,
        });
      }
      for (const frame of collectFrames(lib, spec.start, spec.count)) {
        bodyPacked.push({
          action: spec.action,
          interval: spec.interval,
          ...frame,
        });
      }
    }

    const fxTravel = collectFrames(lib, 688 + DIR * 4, 4);
    const fxImpact = collectFrames(lib, 720, 10);
    const fxHeavy = collectFrames(lib, 740, 14);
    const fxPacked = [...fxTravel, ...fxImpact, ...fxHeavy];

    const bodySheet = packFrameSheet(bodyPacked, OUT_PNG);
    const fxSheet = packFrameSheet(fxPacked, OUT_FX_PNG);

    const actions = {};
    for (const frame of bodyPacked) {
      const bucket = (actions[frame.action] ??= { interval: frame.interval, frames: [] });
      bucket.frames.push(frame.pad ? emptyFrame(-1) : toJsonFrame(frame));
    }

    atlas.actions = actions;
    atlas.slotWidth = slotW;
    atlas.slotHeight = slotH;
    atlas.sheetWidth = bodySheet.sheetWidth;
    atlas.sheetHeight = bodySheet.sheetHeight;
    delete atlas.bodyWidth;

    atlas.projectile = {
      style: "travel",
      rotate: false,
      sheet: FX_SHEET_NAME,
      sheetWidth: fxSheet.sheetWidth,
      sheetHeight: fxSheet.sheetHeight,
      interval: 50,
      frames: fxTravel.map(toJsonFrame),
      impactInterval: 100,
      impactBurstDurationMs: 1000,
      impactFrames: fxImpact.map(toJsonFrame),
    };
    atlas.projectileHeavy = {
      style: "targetBurst",
      anchor: "target",
      sheet: FX_SHEET_NAME,
      sheetWidth: fxSheet.sheetWidth,
      sheetHeight: fxSheet.sheetHeight,
      interval: 140,
      burstDelayMs: 500,
      burstDurationMs: 2000,
      frames: fxHeavy.map(toJsonFrame),
    };

    fs.writeFileSync(OUT_JSON, JSON.stringify(atlas));
    console.log(
      `Danmo 272 body+blends → ${bodySheet.sheetWidth}x${bodySheet.sheetHeight} ` +
        `(${bodySheet.uniqueCount} unique); FX → ${FX_SHEET_NAME} ` +
        `${fxSheet.sheetWidth}x${fxSheet.sheetHeight} (${fxSheet.uniqueCount} unique); ` +
        `attack2=${actions.attack2?.frames?.length ?? 0}, ` +
        `range1=${actions.attackRange1?.frames?.length ?? 0}, ` +
        `blends a1/a2/r1/r2`,
    );
  } finally {
    lib.close();
  }
}

main();
