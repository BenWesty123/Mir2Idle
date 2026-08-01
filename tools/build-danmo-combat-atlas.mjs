// Rebuild Danmo (AncientBringer / monster 272) body atlas + Crystal combat FX.
//
// Crystal Client (west / Direction 6):
//   Attack1 blend:     512 + dir*6  ×6  → 548..553
//   Attack2 blend:     568 + dir*10 ×10 → 628..637
//   Range1 body blend: (648 + FI + dir*5) - 3 from FI≥3 → 678..682 (pad 3 empties)
//   Range2 body blend: (730 + FI + dir*10) - 3 from FI≥3 → 790..794
//   Range1 projectile: 688 ×4 travel + 720 ×10 impact on target
//   Range2 burst:      740 ×14 on target
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
const DIR = 6;

function readFrame(lib, srcFrame) {
  const img = lib.readFrame(srcFrame);
  if (!img || img.width <= 0 || img.height <= 0) return null;
  return img;
}

function packFxFrames(lib, specs) {
  const packed = [];
  for (const spec of specs) {
    const frames = [];
    for (let i = 0; i < spec.count; i++) {
      const srcFrame = spec.start + i;
      const img = readFrame(lib, srcFrame);
      frames.push({ kind: spec.kind, srcFrame, img, empty: !img });
    }
    packed.push({ ...spec, frames });
  }
  return packed;
}

function main() {
  if (!fs.existsSync(LIB)) throw new Error(`Missing lib: ${LIB}`);

  // 1) Body atlas with attack2 + attackRange1.
  buildAtlas({ lib: LIB, id: 272, frameLib: LIB, dir: DIR, scale: 1 });

  const atlas = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
  const bodyPng = fs.readFileSync(OUT_PNG);
  // Minimal PNG size reader (IHDR).
  const bodyW = bodyPng.readUInt32BE(16);
  const bodyH = bodyPng.readUInt32BE(20);
  // Decode body pixels via re-extracting from lib (same slots) — avoid PNG decode deps.
  // Re-open and rebuild a working RGBA sheet from atlas frame metas + lib.
  const lib = new CrystalLibV3(LIB);
  try {
    const slotW = atlas.slotWidth;
    const slotH = atlas.slotHeight;
    let maxSlot = 0;
    for (const action of Object.values(atlas.actions)) {
      for (const fr of action.frames ?? []) {
        if (Number.isFinite(fr.slot)) maxSlot = Math.max(maxSlot, fr.slot + 1);
      }
    }
    const bodyWidth = maxSlot * slotW;
    // Recompose body from lib using atlas srcFrames (guarantees RGBA buffer).
    let sheetH = slotH;
    const bodyFrames = [];
    for (const [actionName, action] of Object.entries(atlas.actions)) {
      for (const fr of action.frames ?? []) {
        const img = fr.empty ? null : readFrame(lib, fr.srcFrame);
        if (img) sheetH = Math.max(sheetH, img.height);
        bodyFrames.push({ actionName, fr, img });
      }
    }

    const fxSpecs = [
      { kind: "attack1Blend", start: 512 + DIR * 6, count: 6, interval: 100 },
      { kind: "attack2Blend", start: 568 + DIR * 10, count: 10, interval: 100 },
      // Range1 on-mob blend: FI 0..2 empty, FI 3..7 → 678..682
      {
        kind: "attackRange1Blend",
        start: 678,
        count: 5,
        interval: 100,
        padEmptyFront: 3,
      },
      // Range2 on-mob blend: FI 0..2 empty, FI 3..7 → 790..794
      {
        kind: "attackRange2Blend",
        start: 790,
        count: 5,
        interval: 100,
        padEmptyFront: 3,
      },
      { kind: "travel", start: 688, count: 4, interval: 50 },
      { kind: "impact", start: 720, count: 10, interval: 100 },
      { kind: "heavyBurst", start: 740, count: 14, interval: 140 },
    ];
    const fxPacked = packFxFrames(lib, fxSpecs);
    for (const group of fxPacked) {
      for (const fr of group.frames) {
        if (fr.img) sheetH = Math.max(sheetH, fr.img.height);
      }
    }

    let fxWidth = 0;
    for (const group of fxPacked) {
      for (const fr of group.frames) {
        if (fr.img) fxWidth += fr.img.width;
      }
    }
    const sheetW = bodyWidth + fxWidth;
    const sheet = Buffer.alloc(sheetW * sheetH * 4);

    for (const { fr, img } of bodyFrames) {
      if (!img) continue;
      blitScaled(sheet, sheetW, img, fr.slot * slotW, 0, img.width, img.height);
    }

    const byKind = Object.fromEntries(fxPacked.map((g) => [g.kind, g]));
    let sheetX = bodyWidth;
    const toJsonFrames = (group, { padEmptyFront = 0 } = {}) => {
      const out = [];
      for (let i = 0; i < padEmptyFront; i++) {
        out.push({ srcFrame: -1, w: 0, h: 0, offsetX: 0, offsetY: 0, empty: true });
      }
      for (const fr of group.frames) {
        if (!fr.img) {
          out.push({
            srcFrame: fr.srcFrame,
            w: 0,
            h: 0,
            offsetX: 0,
            offsetY: 0,
            empty: true,
          });
          continue;
        }
        const { width: w, height: h, offsetX, offsetY } = fr.img;
        blitScaled(sheet, sheetW, fr.img, sheetX, 0, w, h);
        out.push({ sheetX, srcFrame: fr.srcFrame, w, h, offsetX, offsetY });
        sheetX += w;
      }
      return out;
    };

    atlas.actions.attack1Blend = {
      interval: byKind.attack1Blend.interval,
      frames: toJsonFrames(byKind.attack1Blend),
    };
    atlas.actions.attack2Blend = {
      interval: byKind.attack2Blend.interval,
      frames: toJsonFrames(byKind.attack2Blend),
    };
    atlas.actions.attackRange1Blend = {
      interval: byKind.attackRange1Blend.interval,
      frames: toJsonFrames(byKind.attackRange1Blend, {
        padEmptyFront: byKind.attackRange1Blend.padEmptyFront || 0,
      }),
    };
    atlas.actions.attackRange2Blend = {
      interval: byKind.attackRange2Blend.interval,
      frames: toJsonFrames(byKind.attackRange2Blend, {
        padEmptyFront: byKind.attackRange2Blend.padEmptyFront || 0,
      }),
    };

    const travelFrames = toJsonFrames(byKind.travel);
    const impactFrames = toJsonFrames(byKind.impact);
    const heavyFrames = toJsonFrames(byKind.heavyBurst);

    atlas.projectile = {
      style: "travel",
      rotate: false,
      interval: 50,
      frames: travelFrames,
      impactInterval: 100,
      impactBurstDurationMs: 1000,
      impactFrames,
    };
    atlas.projectileHeavy = {
      style: "targetBurst",
      anchor: "target",
      interval: 140,
      burstDelayMs: 500,
      burstDurationMs: 2000,
      frames: heavyFrames,
    };

    atlas.bodyWidth = bodyWidth;
    atlas.sheetHeight = sheetH;
    // Drop unused bodyW note — keep slot sizes for body columns.
    atlas.slotWidth = slotW;
    atlas.slotHeight = slotH;

    fs.writeFileSync(OUT_PNG, writePng(sheetW, sheetH, sheet));
    fs.writeFileSync(OUT_JSON, JSON.stringify(atlas));
    console.log(
      `Danmo 272 combat atlas: body ${bodyWidth}px + FX → ${sheetW}x${sheetH}; ` +
        `attack2=${atlas.actions.attack2?.frames?.length ?? 0}, ` +
        `range1=${atlas.actions.attackRange1?.frames?.length ?? 0}, ` +
        `blends a1/a2/r1/r2, travel+impact+heavyBurst`,
    );
    // Silence unused bodyW/H from PNG header (rebuild path doesn't need them).
    void bodyW;
    void bodyH;
  } finally {
    lib.close();
  }
}

main();
