// Render the standing pose for all 8 directions side by side, labelled 0-7.
// node tools/_dir-montage.mjs <lib> <out.png> [scale]
import { CrystalLibV1 } from "./lib/crystal-libv1.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";
import fs from "node:fs";

const [libPath, out, scaleArg] = process.argv.slice(2);
const scale = scaleArg ? Number(scaleArg) : 1;
const lib = new CrystalLibV1(libPath);

// DefaultMonster standing: start 0, count 4, per-direction offset 4.
const cell = 260;
const cols = 8, gap = 6;
const cellH = cell;
const sheetW = cols * (cell + gap);
const sheetH = cellH + 20;
const sheet = Buffer.alloc(sheetW * sheetH * 4);

for (let dir = 0; dir < 8; dir++) {
  const img = lib.readFrame(0 + dir * 4); // standing frame 0 of that direction
  if (!img) continue;
  const dw = Math.ceil(img.width * scale), dh = Math.ceil(img.height * scale);
  const cx = dir * (cell + gap) + Math.floor((cell - dw) / 2);
  const cy = Math.floor((cellH - dh) / 2);
  blitScaled(sheet, sheetW, img, Math.max(0, cx), Math.max(0, cy), dw, dh);
}
lib.close();
fs.writeFileSync(out, writePng(sheetW, sheetH, sheet));
console.log(`-> ${out} (${sheetW}x${sheetH}) dirs 0..7 left-to-right`);
