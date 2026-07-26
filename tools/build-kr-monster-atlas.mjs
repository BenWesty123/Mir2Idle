// Build a game monster atlas (public/monsters/monster/<id>.png + .json) from a
// KR WeMade Mon*.wil block. The battle view is head-on, so we export a single
// facing (one direction) of the standard action set.
//
// KR per-monster block layout (8 directions, stride 10), relative to base:
//   standing +0   count4  (dir stride 10)
//   walking  +80  count6  (dir stride 10)
//   attack1  +160 count6  (dir stride 10)
//   struck   +240 count2  (dir stride 2)
//   die      +260 count10 (dir stride 10)
//   dead     = last die frame
//
//   node tools/build-kr-monster-atlas.mjs <wil> <id> <base> <dir> [scale] [previewOnly]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "monsters");

const KR_LAYOUT = {
  standing: { off: 0, count: 4, stride: 10, interval: 500 },
  walking: { off: 80, count: 6, stride: 10, interval: 100 },
  attack1: { off: 160, count: 6, stride: 10, interval: 100 },
  struck: { off: 240, count: 2, stride: 2, interval: 200 },
  die: { off: 260, count: 10, stride: 10, interval: 100 },
};

export function buildAtlas({ wil, id, base, dir, scale = 1, previewOnly = false }) {
  const lib = new WeMadeWilLib(wil);
  const frames = []; // {action, slot, srcFrame, img}
  let slot = 0;
  let slotW = 1, slotH = 1;

  const push = (action, srcFrame) => {
    const img = lib.readFrame(srcFrame);
    if (img) {
      slotW = Math.max(slotW, Math.ceil(img.width * scale));
      slotH = Math.max(slotH, Math.ceil(img.height * scale));
    }
    frames.push({ action, slot: slot++, srcFrame, img });
  };

  for (const [action, spec] of Object.entries(KR_LAYOUT)) {
    for (let i = 0; i < spec.count; i++) {
      push(action, base + spec.off + dir * spec.stride + i);
    }
  }
  // dead = last die frame
  const lastDie = base + KR_LAYOUT.die.off + dir * KR_LAYOUT.die.stride + (KR_LAYOUT.die.count - 1);
  push("dead", lastDie);

  const sheet = Buffer.alloc(slotW * frames.length * slotH * 4);
  const sheetW = slotW * frames.length;
  for (const fr of frames) {
    if (!fr.img) continue;
    const dw = Math.ceil(fr.img.width * scale);
    const dh = Math.ceil(fr.img.height * scale);
    blitScaled(sheet, sheetW, fr.img, fr.slot * slotW, slotH - dh, dw, dh);
  }

  const actions = {};
  for (const fr of frames) {
    const spec = KR_LAYOUT[fr.action] ?? { interval: 1000 };
    (actions[fr.action] ??= { interval: spec.interval, frames: [] });
    if (!fr.img) {
      actions[fr.action].frames.push({ slot: fr.slot, srcFrame: fr.srcFrame, w: 0, h: 0, offsetX: 0, offsetY: 0, empty: true });
    } else {
      actions[fr.action].frames.push({
        slot: fr.slot,
        srcFrame: fr.srcFrame,
        w: Math.ceil(fr.img.width * scale),
        h: Math.ceil(fr.img.height * scale),
        offsetX: Math.round(fr.img.offsetX * scale),
        offsetY: Math.round(fr.img.offsetY * scale),
      });
    }
  }

  const atlas = { layer: "monster", index: id, direction: dir, source: `${path.basename(wil)}@${base}`, slotWidth: slotW, slotHeight: slotH, actions };
  lib.close();

  if (previewOnly) {
    const previewPath = `C:/Users/bb-we/Documents/KR-Mir2-Client/kr-atlas-preview-${id}.png`;
    fs.writeFileSync(previewPath, writePng(sheetW, slotH, sheet));
    console.log(`preview: ${previewPath} (${sheetW}x${slotH}, ${frames.length} slots ${slotW}x${slotH})`);
    return { atlas, sheetW, slotH };
  }

  const monsterDir = path.join(OUT, "monster");
  fs.writeFileSync(path.join(monsterDir, `${id}.png`), writePng(sheetW, slotH, sheet));
  fs.writeFileSync(path.join(monsterDir, `${id}.json`), JSON.stringify(atlas));

  // register in layers.json
  const layersPath = path.join(OUT, "layers.json");
  const layers = JSON.parse(fs.readFileSync(layersPath, "utf8"));
  const idxs = new Set(layers.layers.monster.indexes);
  idxs.add(id);
  layers.layers.monster.indexes = [...idxs].sort((a, b) => a - b);
  layers.layers.monster.count = layers.layers.monster.indexes.length;
  fs.writeFileSync(layersPath, JSON.stringify(layers, null, 2));
  console.log(`built monster ${id}: ${frames.length} slots, ${slotW}x${slotH}, from ${path.basename(wil)}@${base} dir${dir}`);
  return { atlas, sheetW, slotH };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [wil, id, base, dir, scale, previewOnly] = process.argv.slice(2);
  buildAtlas({
    wil,
    id: Number(id),
    base: Number(base),
    dir: Number(dir),
    scale: scale ? Number(scale) : 1,
    previewOnly: previewOnly === "preview",
  });
}
