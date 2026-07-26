// Build a game monster atlas from a Crystal version-1 DXT1 .Lib, using the
// embedded FrameSet from a matching Crystal version-3 .Lib (NextClient).
//
// KR KoreanServer libs are v1 (no FrameSet). NextClient libs for the same
// MonsterImage index are v3 with the real action table. Frame counts match, so
// we take the FrameSet from NextClient and the pixels from the KR .Lib.
//
// Solo dungeon facing = Direction 6 (Left).
//
//   node tools/build-libv1-monster-atlas.mjs <krLib> <id> <v3FrameLib> [dir=6] [scale=1] [preview]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CrystalLibV1 } from "./lib/crystal-libv1.mjs";
import { CrystalLibV3 } from "./lib/crystal-libv3.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "monsters");

function openLib(libPath) {
  const fd = fs.openSync(libPath, "r");
  const head = Buffer.alloc(4);
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  const ver = head.readInt32LE(0);
  if (ver >= 2) return new CrystalLibV3(libPath);
  return new CrystalLibV1(libPath);
}

// MirAction byte -> atlas action name (matches tools/export-monster-atlases.ps1).
// AttackRange1 (14) maps to attack1 when Attack1 is absent.
const ACTION_MAP = {
  0: "standing",
  1: "walking",
  9: "attack1",
  10: "attack2",
  11: "attack3",
  14: "attackRange1",
  18: "struck",
  21: "die",
  22: "dead",
  24: "show",
  25: "hide",
  28: "revive",
};

const DEFAULT_MONSTER = {
  standing: { start: 0, count: 4, skip: 0, interval: 500 },
  walking: { start: 32, count: 6, skip: 0, interval: 100 },
  attack1: { start: 80, count: 6, skip: 0, interval: 100 },
  struck: { start: 128, count: 2, skip: 0, interval: 200 },
  die: { start: 144, count: 10, skip: 0, interval: 100 },
  dead: { start: 153, count: 1, skip: 9, interval: 1000 },
  revive: { start: 144, count: 10, skip: 0, interval: 100, reverse: true },
};

/** Read embedded FrameSet from a Crystal .Lib version >= 3. */
export function readLibFrameSet(libPath) {
  const buf = fs.readFileSync(libPath);
  const ver = buf.readInt32LE(0);
  if (ver < 3) return null;
  const frameSeek = buf.readInt32LE(8);
  const frameCount = buf.readInt32LE(frameSeek);
  const actions = {};
  let p = frameSeek + 4;
  for (let i = 0; i < frameCount; i++) {
    const action = buf[p++];
    const start = buf.readInt32LE(p); p += 4;
    const count = buf.readInt32LE(p); p += 4;
    const skip = buf.readInt32LE(p); p += 4;
    const interval = buf.readInt32LE(p); p += 4;
    p += 16; // effectStart/Count/Skip/Interval
    const reverse = buf[p++] !== 0;
    p++; // blend
    const name = ACTION_MAP[action];
    if (!name) continue;
    // Prefer first Attack1 over later AttackRange1 remaps for the same key.
    if (actions[name] && name === "attack1" && action === 14) continue;
    actions[name] = { start, count, skip, interval, reverse };
  }
  return actions;
}

function framesForAction(spec, dir) {
  const offset = spec.count + spec.skip;
  const out = [];
  for (let i = 0; i < spec.count; i++) {
    // Crystal: DrawFrame = Start + OffSet * Direction + FrameIndex
    // Reverse (revive): play die frames backward; still direction-based.
    const frameIndex = spec.reverse ? (spec.count - 1 - i) : i;
    out.push(spec.start + dir * offset + frameIndex);
  }
  return out;
}

export function buildAtlas({
  lib: libPath,
  id,
  frameLib = null,
  dir = 6,
  scale = 1,
  previewOnly = false,
  // Remap actions whose Crystal clips spin/change facing (bad for fixed-dir idle view).
  // e.g. { attack1: "walking", struck: "standing" }
  actionRemap = null,
}) {
  const layout = { ...((frameLib && readLibFrameSet(frameLib)) || DEFAULT_MONSTER) };
  const remapKeep = {};
  if (actionRemap) {
    for (const [dst, src] of Object.entries(actionRemap)) {
      if (!layout[src]) continue;
      // Keep the SOURCE clip's timing so e.g. standing←walking idles at walk speed
      // (visible in-place motion) instead of the slow 500ms standing interval.
      // Also allow creating missing actions (e.g. walking←standing).
      layout[dst] = { ...layout[src] };
      remapKeep[dst] = dst === "struck" ? 2 : layout[src].count;
    }
  }
  // Some Mir bodies (e.g. White Elephant 324) have no Walking FrameSet entry.
  if (!layout.walking && layout.standing) {
    layout.walking = { ...layout.standing, interval: Math.min(layout.standing.interval || 500, 200) };
  }
  // Idle game needs these core actions; drop extras we don't drive.
  const wanted = ["standing", "walking", "attack1", "struck", "die", "dead", "revive"];
  const lib = openLib(libPath);
  const frames = [];
  let slot = 0, slotW = 1, slotH = 1;

  const push = (action, srcFrame) => {
    const img = srcFrame >= 0 && srcFrame < lib.count ? lib.readFrame(srcFrame) : null;
    if (img) {
      slotW = Math.max(slotW, Math.ceil(img.width * scale));
      slotH = Math.max(slotH, Math.ceil(img.height * scale));
    }
    frames.push({ action, slot: slot++, srcFrame, img });
  };

  for (const action of wanted) {
    const spec = layout[action];
    if (!spec) continue;
    const srcs = framesForAction(spec, dir);
    const keep = remapKeep[action] ?? srcs.length;
    for (const src of srcs.slice(0, keep)) push(action, src);
  }

  // If dead missing, use last die frame.
  if (!layout.dead && layout.die) {
    const dieFrames = framesForAction(layout.die, dir);
    push("dead", dieFrames[dieFrames.length - 1]);
  }

  const sheetW = slotW * frames.length;
  const sheet = Buffer.alloc(sheetW * slotH * 4);
  for (const fr of frames) {
    if (!fr.img) continue;
    const dw = Math.ceil(fr.img.width * scale);
    const dh = Math.ceil(fr.img.height * scale);
    // Top-align: renderer reads (slot*slotWidth, 0) with height meta.h.
    blitScaled(sheet, sheetW, fr.img, fr.slot * slotW, 0, dw, dh);
  }

  if (previewOnly) {
    const p = `C:/Users/bb-we/Documents/KR-Mir2-Client/libatlas-${id}-dir${dir}.png`;
    fs.writeFileSync(p, writePng(sheetW, slotH, sheet));
    lib.close();
    console.log(`preview -> ${p} (${sheetW}x${slotH}, ${frames.length} slots)`);
    console.log("layout:", Object.fromEntries(
      wanted.filter((a) => layout[a]).map((a) => [a, `${layout[a].start}+${layout[a].count}+skip${layout[a].skip}`]),
    ));
    return;
  }

  const actions = {};
  for (const fr of frames) {
    const spec = layout[fr.action] ?? { interval: 100 };
    (actions[fr.action] ??= { interval: spec.interval, frames: [] });
    if (!fr.img) {
      actions[fr.action].frames.push({
        slot: fr.slot, srcFrame: fr.srcFrame, w: 0, h: 0, offsetX: 0, offsetY: 0, empty: true,
      });
      continue;
    }
    actions[fr.action].frames.push({
      slot: fr.slot,
      srcFrame: fr.srcFrame,
      w: Math.ceil(fr.img.width * scale),
      h: Math.ceil(fr.img.height * scale),
      offsetX: Math.round(fr.img.offsetX * scale),
      offsetY: Math.round(fr.img.offsetY * scale),
    });
  }

  // Fall back empty death clips to standing (flying bats etc.).
  const allEmpty = (name) => {
    const fr = actions[name]?.frames;
    return fr && fr.length > 0 && fr.every((f) => f.empty);
  };
  for (const name of ["struck", "die", "dead"]) {
    if (allEmpty(name) && actions.standing?.frames?.some((f) => !f.empty)) {
      actions[name].frames = actions.standing.frames.map((f) => ({ ...f }));
    }
  }

  const atlas = {
    layer: "monster",
    index: id,
    direction: dir,
    source: path.basename(libPath),
    frameSource: frameLib ? path.basename(frameLib) : "DefaultMonster",
    slotWidth: slotW,
    slotHeight: slotH,
    actions,
  };
  lib.close();

  const monsterDir = path.join(OUT, "monster");
  fs.writeFileSync(path.join(monsterDir, `${id}.png`), writePng(sheetW, slotH, sheet));
  fs.writeFileSync(path.join(monsterDir, `${id}.json`), JSON.stringify(atlas));
  const layersPath = path.join(OUT, "layers.json");
  const layers = JSON.parse(fs.readFileSync(layersPath, "utf8"));
  const idxs = new Set(layers.layers.monster.indexes);
  idxs.add(id);
  layers.layers.monster.indexes = [...idxs].sort((a, b) => a - b);
  layers.layers.monster.count = layers.layers.monster.indexes.length;
  fs.writeFileSync(layersPath, JSON.stringify(layers, null, 2));
  console.log(`built monster ${id}: ${frames.length} slots ${slotW}x${slotH} dir${dir} from ${path.basename(libPath)} frames=${atlas.frameSource}`);
  for (const a of wanted) {
    if (!actions[a]) continue;
    const fr = actions[a].frames;
    console.log(`  ${a}: src=[${fr.map((f) => f.srcFrame).join(",")}] empty=${fr.filter((f) => f.empty).length}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [libPath, id, frameLib, dir, scale] = args;
  if (!libPath || !id) {
    console.error("usage: node tools/build-libv1-monster-atlas.mjs <lib> <id> <v3FrameLib> [dir=6] [scale=1] [preview] [remap=attack1:walking,struck:standing]");
    process.exit(1);
  }
  const previewOnly = args.includes("preview");
  const remapArg = args.find((a) => String(a).startsWith("remap="));
  const actionRemap = {};
  if (remapArg) {
    for (const pair of remapArg.slice("remap=".length).split(",")) {
      const [dst, src] = pair.split(":");
      if (dst && src) actionRemap[dst] = src;
    }
  }
  // Legacy: attackFrom=walking
  const attackFrom = args.find((a) => String(a).startsWith("attackFrom="));
  if (attackFrom) actionRemap.attack1 = attackFrom.slice("attackFrom=".length);
  buildAtlas({
    lib: libPath,
    id: Number(id),
    frameLib: frameLib || null,
    dir: dir ? Number(dir) : 6,
    scale: scale ? Number(scale) : 1,
    previewOnly,
    actionRemap: Object.keys(actionRemap).length ? actionRemap : null,
  });
}
