// Render specific frame indices from a .Lib at large scale, side by side.
// node tools/_frames-big.mjs <lib> <out.png> <scale> <f0,f1,...>
import { CrystalLibV1 } from "./lib/crystal-libv1.mjs";
import { writePng, blitScaled } from "./lib/png-write.mjs";
import fs from "node:fs";

const [libPath, out, scaleArg, list] = process.argv.slice(2);
const scale = Number(scaleArg) || 2;
const idxs = list.split(",").map(Number);
const lib = new CrystalLibV1(libPath);

const imgs = idxs.map((i) => ({ i, img: lib.readFrame(i) }));
const cellW = Math.max(...imgs.map((o) => (o.img ? o.img.width : 1))) * scale + 10;
const cellH = Math.max(...imgs.map((o) => (o.img ? o.img.height : 1))) * scale + 10;
const sheetW = cellW * imgs.length;
const sheet = Buffer.alloc(sheetW * cellH * 4);
imgs.forEach((o, k) => {
  if (!o.img) return;
  const dw = Math.ceil(o.img.width * scale), dh = Math.ceil(o.img.height * scale);
  blitScaled(sheet, sheetW, o.img, k * cellW + 5, 5, dw, dh);
});
lib.close();
fs.writeFileSync(out, writePng(sheetW, cellH, sheet));
console.log(`-> ${out} (${sheetW}x${cellH}) frames ${list}`);
