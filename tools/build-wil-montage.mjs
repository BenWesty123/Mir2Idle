// Montage + frame-size dump for a WeMade .wil (KR client art), to locate
// individual monster animation blocks empirically.
//   node tools/build-wil-montage.mjs <wil> <out.png> [start] [end] [cols] [cell]
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";

const wil = process.argv[2];
const out = process.argv[3] || "montage.png";
const lib = new WeMadeWilLib(wil);
const start = Number(process.argv[4] ?? 0);
const end = Math.min(Number(process.argv[5] ?? lib.count), lib.count);
const cols = Number(process.argv[6] ?? 16);
const cell = Number(process.argv[7] ?? 80);
const step = Number(process.argv[8] ?? 1);

console.log(`${wil}: ${lib.count} frames. Montage [${start},${end}) cols=${cols} cell=${cell}`);

const n = Math.ceil((end - start) / step);
const rows = Math.ceil(n / cols);
const W = cols * cell;
const H = rows * cell;
const dst = Buffer.alloc(W * H * 4);
// checker background so transparent sprites are visible
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = Math.floor(x / (cell / 2)), cy = Math.floor(y / (cell / 2));
    const v = (cx + cy) % 2 ? 60 : 40;
    const d = (y * W + x) * 4;
    dst[d] = v; dst[d + 1] = v; dst[d + 2] = v; dst[d + 3] = 255;
  }
}
for (let i = 0; i < n; i++) {
  const idx = start + i * step;
  const f = lib.readFrame(idx);
  if (!f || f.width <= 0 || f.height <= 0) continue;
  const col = i % cols, row = Math.floor(i / cols);
  const pad = 2, avail = cell - pad * 2;
  const scale = Math.min(avail / f.width, avail / f.height, 1);
  const dw = Math.max(1, Math.round(f.width * scale));
  const dh = Math.max(1, Math.round(f.height * scale));
  const dx = col * cell + Math.floor((cell - dw) / 2);
  const dy = row * cell + Math.floor((cell - dh) / 2);
  blitScaled(dst, W, f, dx, dy, dw, dh);
}
import fs from "node:fs";
fs.writeFileSync(out, writePng(W, H, dst));
console.log("wrote", out, `${W}x${H}`);
lib.close();
