// Parse MonsterInfoList out of a Crystal Server.MirDB (LoadVersion 68) without
// parsing the Map/Item lists: sync onto the monster block by trying each offset
// whose Int32 == a plausible count, then validating a full parse.
// Dumps { index, name, image, level, hp, minDC, maxDC, exp } for every monster.
import fs from "node:fs";

const DB = process.argv[2] || "C:/Users/bb-we/Documents/KR-Mir2-Client/KServer/KoreanServer/Server/Server.MirDB";
const buf = fs.readFileSync(DB);
const LoadVersion = buf.readInt32LE(0);
const MonsterIndex = buf.readInt32LE(16);

function read7bitLen(p) { // C# BinaryReader string length prefix
  let len = 0, shift = 0, b;
  do { b = buf[p++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
  return { len, p };
}
function readString(p) {
  const { len, p: p2 } = read7bitLen(p);
  if (len < 0 || len > 200) throw new Error("bad strlen " + len);
  const name = buf.toString("utf8", p2, p2 + len);
  return { name, p: p2 + len, len };
}
function parseMonster(p) {
  const index = buf.readInt32LE(p); p += 4;
  const s = readString(p); p = s.p;
  const image = buf.readUInt16LE(p); p += 2;
  const ai = buf[p++], effect = buf[p++];
  const level = buf.readUInt16LE(p); p += 2;
  const viewRange = buf[p++], coolEye = buf[p++];
  const hp = buf.readUInt32LE(p); p += 4;
  const st = {};
  for (const k of ["minAC", "maxAC", "minMAC", "maxMAC", "minDC", "maxDC", "minMC", "maxMC", "minSC", "maxSC"]) { st[k] = buf.readUInt16LE(p); p += 2; }
  const accuracy = buf[p++], agility = buf[p++];
  const light = buf[p++];
  const attackSpeed = buf.readUInt16LE(p); p += 2;
  const moveSpeed = buf.readUInt16LE(p); p += 2;
  const exp = buf.readUInt32LE(p); p += 4;
  const canPush = buf[p++], canTame = buf[p++], autoRev = buf[p++], undead = buf[p++];
  // strict validity: booleans must be 0/1 (strong anchor)
  if (s.len === 0 || s.len > 60 || image > 2500 || level > 2000 || attackSpeed > 60000 || moveSpeed > 60000 ||
      canPush > 1 || canTame > 1 || autoRev > 1 || undead > 1) throw new Error("implausible");
  // name must decode to mostly printable (Korean/ASCII), no control chars
  // eslint-disable-next-line no-control-regex -- reject records whose "name" contains control bytes (bad sync offset)
  if (/[\u0000-\u0008\u000e-\u001f]/.test(s.name)) throw new Error("bad name");
  return { rec: { index, name: s.name, image, level, hp, minDC: st.minDC, maxDC: st.maxDC, exp, ai, attackSpeed, moveSpeed }, p };
}

function runFrom(off) { // greedily parse consecutive records
  let p = off; const recs = [];
  for (;;) { try { const r = parseMonster(p); recs.push(r.rec); p = r.p; } catch { break; } }
  return { recs, end: p };
}

let best = { recs: [] };
for (let off = 8; off < buf.length - 4; off++) {
  const r = runFrom(off);
  if (r.recs.length > best.recs.length) { best = { off, ...r }; }
  if (r.recs.length > 50) off = r.end - 1; // skip ahead past a found block
}
if (best.recs.length < 20) { console.log("MonsterInfoList not found (best run " + best.recs.length + ")"); process.exit(1); }
const found = { off: best.off, count: best.recs.length, recs: best.recs, end: best.end };
const countPrefix = buf.readInt32LE(found.off - 4);

console.log(`DB v${LoadVersion}, MonsterIndex=${MonsterIndex}`);
console.log(`Longest monster run @${found.off}: ${found.count} records (count prefix before = ${countPrefix})\n`);
fs.writeFileSync("C:/Users/bb-we/Documents/KR-Mir2-Client/mirdb-monsters.json", JSON.stringify(found.recs, null, 1));

const TARGET = new Set([229, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329]);
console.log("=== Monsters at target Image indexes (Mir2DB img) ===");
for (const m of found.recs) if (TARGET.has(m.image)) console.log(`  img ${m.image}: "${m.name}"  Lv${m.level} HP${m.hp} DC${m.minDC}-${m.maxDC} exp${m.exp}`);
console.log(`\nWrote full roster (${found.recs.length}) -> mirdb-monsters.json`);
