// Fast scan of every Mon*.wil for monster blocks (standing-signature + gap),
// using header-only frameDims (no pixel decode). Reports blocks per file.
import fs from "node:fs";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";

const DATA = "C:/Users/bb-we/Documents/KR-Mir2-Client/Data";
const files = fs.readdirSync(DATA).filter((f) => /^Mon.*\.wil$/i.test(f))
  .sort((a, b) => (Number(a.match(/\d+/)?.[0]) || 0) - (Number(b.match(/\d+/)?.[0]) || 0));

export function detectBlocks(lib) {
  const present = new Array(lib.count).fill(0);
  const dim = new Array(lib.count).fill(0);
  for (let i = 0; i < lib.count; i++) {
    const d = lib.frameDims(i);
    if (d && d.width > 4 && d.height > 4) { present[i] = 1; dim[i] = Math.max(d.width, d.height); }
  }
  const emptiesBefore = (b) => { let c = 0; for (let k = b - 1; k >= 0 && !present[k]; k--) c++; return c; };
  const standingStart = (b) => present[b] && present[b + 1] && present[b + 2] && present[b + 3] && !present[b + 4] && !present[b + 5];
  const blocks = [];
  for (let b = 0; b < lib.count; b++) {
    if (!standingStart(b)) continue;
    if (b !== 0 && emptiesBefore(b) < 12) continue;
    let end = b, gap = 0, maxDim = 0;
    for (let i = b; i < lib.count && gap <= 12; i++) {
      if (present[i]) { end = i; gap = 0; maxDim = Math.max(maxDim, dim[i]); } else gap++;
    }
    blocks.push({ base: b, len: end - b + 1, maxDim });
  }
  return blocks;
}

let total = 0;
const summary = [];
for (const f of files) {
  const lib = new WeMadeWilLib(`${DATA}/${f}`);
  const blocks = detectBlocks(lib);
  total += blocks.length;
  summary.push({ file: f, frames: lib.count, blocks: blocks.length });
  lib.close();
}
for (const s of summary) console.log(`${s.file.padEnd(18)} frames ${String(s.frames).padStart(6)}  blocks ${s.blocks}`);
console.log(`\nTOTAL blocks across ${files.length} files: ${total}`);
