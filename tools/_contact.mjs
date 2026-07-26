// Contact sheet of .Lib frames on a light background. 10 per row.
// Row r, col c => frame index r*10 + c (so you can read indices by position).
// node tools/_contact.mjs <lib> <out.png> <first> <count> <scale>
import { CrystalLibV1 } from "./lib/crystal-libv1.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";
import fs from "node:fs";

const [libPath, out, firstA, countA, scaleA] = process.argv.slice(2);
const first = Number(firstA) || 0;
const count = Number(countA) || 160;
const scale = Number(scaleA) || 1;
const cols = 10;
const rows = Math.ceil(count / cols);
const lib = new CrystalLibV1(libPath);

const imgs = [];
let cw = 8, ch = 8;
for (let k = 0; k < count; k++) {
  const img = lib.readFrame(first + k);
  imgs.push(img);
  if (img) { cw = Math.max(cw, Math.ceil(img.width * scale)); ch = Math.max(ch, Math.ceil(img.height * scale)); }
}
lib.close();
const cellW = cw + 6, cellH = ch + 6;
const sheetW = cols * cellW, sheetH = rows * cellH;
const sheet = Buffer.alloc(sheetW * sheetH * 4);
// light gray background
for (let i = 0; i < sheetW * sheetH; i++) { sheet[i * 4] = 60; sheet[i * 4 + 1] = 60; sheet[i * 4 + 2] = 70; sheet[i * 4 + 3] = 255; }
imgs.forEach((img, k) => {
  if (!img) return;
  const r = Math.floor(k / cols), c = k % cols;
  const dw = Math.ceil(img.width * scale), dh = Math.ceil(img.height * scale);
  blitScaled(sheet, sheetW, img, c * cellW + 3, r * cellH + 3, dw, dh);
});
fs.writeFileSync(out, writePng(sheetW, sheetH, sheet));
console.log(`-> ${out} (${sheetW}x${sheetH}) frames ${first}..${first + count - 1}, ${cols}/row`);
