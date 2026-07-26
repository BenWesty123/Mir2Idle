// Parse embedded FrameSet from Crystal .Lib version >= 3.
// node tools/_dump-lib-frames.mjs <lib...>
import fs from "node:fs";

const ACTION = {
  0: "standing", 1: "walking", 2: "running", 3: "pushed", 4: "dashL", 5: "dashR",
  6: "dashFail", 7: "stance", 8: "stance2", 9: "attack1", 10: "attack2", 11: "attack3",
  12: "attack4", 13: "attack5", 14: "attackCombo", 15: "special", 16: "struck",
  17: "die", 18: "struck", // wait - need real MirAction enum
};

// From Crystal Shared/Enums or client MirAction
const MirAction = [
  "Standing","Walking","Running","Pushed","DashL","DashR","DashFail","Stance","Stance2",
  "Attack1","Attack2","Attack3","Attack4","Attack5","AttackCombo","Special",
  "Struck","Harvest","Spell","Die","Dead","Skeleton","Show","Hide","Stoned","Appear",
  "Revive","SitDown","Mine","Sneek","DashAttack","Lunge"
];
// Actually export-monster-atlases maps:
// 0 standing, 1 walking, 9 attack1, 14 attack1, 18 struck, 21 die, 22 dead, 24 show, 25 hide, 27 show, 28 revive
// So MirAction numbering in that script differs. Use the script's map.

const MAP = {
  0: "standing", 1: "walking", 9: "attack1", 14: "attack1",
  18: "struck", 21: "die", 22: "dead", 24: "show", 25: "hide",
  27: "show", 28: "revive", 10: "attack2", 11: "attack3",
};

function dump(path) {
  const buf = fs.readFileSync(path);
  const ver = buf.readInt32LE(0);
  const count = buf.readInt32LE(4);
  if (ver < 3) { console.log(path, "ver", ver, "no embedded frames"); return; }
  const frameSeek = buf.readInt32LE(8);
  const frameCount = buf.readInt32LE(frameSeek);
  console.log(`\n${path.split(/[\\\\/]/).pop()} ver=${ver} images=${count} frameSeek=${frameSeek} actions=${frameCount}`);
  let p = frameSeek + 4;
  for (let i = 0; i < frameCount; i++) {
    const action = buf[p++]; // byte
    const start = buf.readInt32LE(p); p += 4;
    const cnt = buf.readInt32LE(p); p += 4;
    const skip = buf.readInt32LE(p); p += 4;
    const interval = buf.readInt32LE(p); p += 4;
    const effectStart = buf.readInt32LE(p); p += 4;
    const effectCount = buf.readInt32LE(p); p += 4;
    const effectSkip = buf.readInt32LE(p); p += 4;
    const effectInterval = buf.readInt32LE(p); p += 4;
    const reverse = buf[p++] !== 0;
    const blend = buf[p++] !== 0;
    const name = MAP[action] || MirAction[action] || `action${action}`;
    const off = cnt + skip;
    console.log(`  [${action}] ${name}: start=${start} count=${cnt} skip=${skip} off=${off} interval=${interval} reverse=${reverse} blend=${blend}  | dir6 frames ${start + 6 * off}..${start + 6 * off + cnt - 1}`);
  }
}

for (const a of process.argv.slice(2)) dump(a);
