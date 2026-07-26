import { CrystalLibV1 } from "./lib/crystal-libv1.mjs";
import { writePng } from "./lib/png-write.mjs";
import fs from "node:fs";

const file = process.argv[2];
const out = process.argv[3] || "C:/Users/bb-we/Documents/KR-Mir2-Client/_lib-montage.png";
const step = Number(process.argv[4] || 1);
const maxCells = Number(process.argv[5] || 48);
const lib = new CrystalLibV1(file);
console.log("count", lib.count);
const cells = [];
for (let i = 0; i < lib.count && cells.length < maxCells; i += step) {
  const f = lib.readFrame(i);
  if (f && f.width > 4 && f.height > 4) cells.push({ i, f });
}
const CELL = 110;
const cols = 8;
const rows = Math.ceil(cells.length / cols);
const W = cols * CELL, H = rows * CELL;
const sheet = Buffer.alloc(W * H * 4);
for (let n = 0; n < cells.length; n++) {
  const { f } = cells[n];
  const cx = (n % cols) * CELL, cy = Math.floor(n / cols) * CELL;
  const scale = Math.min(CELL / f.width, CELL / f.height, 1);
  const dw = Math.max(1, Math.round(f.width * scale)), dh = Math.max(1, Math.round(f.height * scale));
  const ox = cx + Math.floor((CELL - dw) / 2), oy = cy + Math.floor((CELL - dh) / 2);
  for (let y = 0; y < dh; y++) { const sy = Math.min(f.height - 1, Math.floor((y * f.height) / dh));
    for (let x = 0; x < dw; x++) { const sx = Math.min(f.width - 1, Math.floor((x * f.width) / dw));
      const s = (sy * f.width + sx) * 4; if (f.rgba[s + 3] === 0) continue;
      const d = ((oy + y) * W + (ox + x)) * 4; sheet[d] = f.rgba[s]; sheet[d + 1] = f.rgba[s + 1]; sheet[d + 2] = f.rgba[s + 2]; sheet[d + 3] = 255; } }
}
fs.writeFileSync(out, writePng(W, H, sheet));
lib.close();
console.log("montage ->", out, `(${cells.length} frames, ${W}x${H})`);
