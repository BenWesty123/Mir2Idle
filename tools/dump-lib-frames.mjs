// Dump the FrameSet embedded in a Crystal v3 .Lib (MLibrary.Initialize + Frame(BinaryReader)).
import { readFileSync } from "node:fs";

const ACTIONS = [
  "Standing", "Walking", "Running", "Pushed", "DashL", "DashR", "DashFail", "Stance", "Stance2",
  "Attack1", "Attack2", "Attack3", "Attack4", "Attack5",
  "AttackRange1", "AttackRange2", "AttackRange3", "Special", "Struck", "Harvest", "Spell",
  "Die", "Dead", "Skeleton", "Show", "Hide", "Stoned", "Appear", "Revive", "SitDown", "Mine",
  "Sneek", "DashAttack", "Lunge", "WalkingBow", "RunningBow", "Jump",
];

const path = process.argv[2];
const buf = readFileSync(path);
let p = 0;
const i32 = () => { const v = buf.readInt32LE(p); p += 4; return v; };

const version = i32();
const count = i32();
const frameSeek = version >= 3 ? i32() : 0;
console.log(`${path}\n  version=${version} imageCount=${count} frameSeek=${frameSeek}`);
if (version < 3 || !frameSeek) {
  console.log("  no embedded FrameSet (falls back to FrameSet.DefaultMonster)");
  process.exit(0);
}

p = frameSeek;
const frameCount = i32();
console.log(`  frameCount=${frameCount}\n`);
const rows = [];
for (let i = 0; i < frameCount; i++) {
  const action = buf.readUInt8(p); p += 1;
  const f = {
    action: ACTIONS[action] ?? `#${action}`,
    start: i32(), count: i32(), skip: i32(), interval: i32(),
    effectStart: i32(), effectCount: i32(), effectSkip: i32(), effectInterval: i32(),
  };
  f.reverse = buf.readUInt8(p) === 1; p += 1;
  f.blend = buf.readUInt8(p) === 1; p += 1;
  rows.push(f);
}

for (const f of rows) {
  const end = f.start + f.count - 1;
  const flags = [f.reverse ? "REVERSE" : null, f.blend ? "blend" : null].filter(Boolean).join(" ");
  let line = `  ${f.action.padEnd(13)} start=${String(f.start).padStart(4)} count=${String(f.count).padStart(3)}`
    + ` skip=${String(f.skip).padStart(3)} interval=${String(f.interval).padStart(5)}  -> frames ${f.start}..${end}`;
  if (f.effectCount) line += `  fx=${f.effectStart}..${f.effectStart + f.effectCount - 1}@${f.effectInterval}`;
  if (flags) line += `  [${flags}]`;
  console.log(line);
}
