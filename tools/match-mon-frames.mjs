// Locate the 13 Southern Barbarian monsters by image-matching the Mir2DB icon
// vectors against every plausible frame across all Mon*.wil files.
// Output: docs/monster-picker/matches.json  { img: [{file,frame,base,score}, ...] }
import fs from "node:fs";
import path from "node:path";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";

const DATA = "C:/Users/bb-we/Documents/KR-Mir2-Client/Data";
const OUT = path.join("docs", "monster-picker");
const N = 32;
const TOPK = 8;

const iconData = JSON.parse(fs.readFileSync(path.join(OUT, "icon-vectors.json"), "utf8"));
// zero-mean, unit-norm each icon vector
function normalize(vec) {
  const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
  const z = vec.map((v) => v - mean);
  const norm = Math.sqrt(z.reduce((a, b) => a + b * b, 0)) || 1;
  return z.map((v) => v / norm);
}
const icons = Object.entries(iconData).map(([img, d]) => ({ img: Number(img), aspect: d.w / d.h, nvec: normalize(d.vec) }));

function frameVector(f) {
  let minX = f.width, minY = f.height, maxX = 0, maxY = 0;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
    if (f.rgba[(y * f.width + x) * 4 + 3] !== 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < minX) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const vec = new Array(N * N).fill(0);
  for (let ny = 0; ny < N; ny++) for (let nx = 0; nx < N; nx++) {
    const sx = minX + Math.min(bw - 1, Math.floor((nx * bw) / N));
    const sy = minY + Math.min(bh - 1, Math.floor((ny * bh) / N));
    const o = (sy * f.width + sx) * 4;
    const a = f.rgba[o + 3];
    vec[ny * N + nx] = a === 0 ? 0 : (0.299 * f.rgba[o] + 0.587 * f.rgba[o + 1] + 0.114 * f.rgba[o + 2]);
  }
  return { bw, bh, nvec: normalize(vec) };
}

const files = fs.readdirSync(DATA).filter((f) => /^Mon.*\.wil$/i.test(f))
  .sort((a, b) => (Number(a.match(/\d+/)?.[0]) || 0) - (Number(b.match(/\d+/)?.[0]) || 0));

const top = new Map(icons.map((i) => [i.img, []]));
function consider(img, entry) {
  const arr = top.get(img);
  arr.push(entry);
  arr.sort((a, b) => b.score - a.score);
  if (arr.length > TOPK) arr.length = TOPK;
}

let decoded = 0;
for (const file of files) {
  const lib = new WeMadeWilLib(`${DATA}/${file}`);
  // presence for base derivation
  const present = new Array(lib.count).fill(0);
  for (let i = 0; i < lib.count; i++) { const d = lib.frameDims(i); if (d && d.width > 4 && d.height > 4) present[i] = 1; }
  const baseFor = (fr) => { // nearest standing-start at/before fr
    for (let b = fr; b >= 0 && b > fr - 400; b--) {
      if (present[b] && present[b + 1] && present[b + 2] && present[b + 3] && !present[b + 4] && !present[b + 5] && (b === 0 || !present[b - 1])) return b;
    }
    return fr;
  };
  for (let i = 0; i < lib.count; i++) {
    const d = lib.frameDims(i);
    if (!d || d.width < 36 || d.height < 36 || d.width > 470 || d.height > 470) continue;
    const f = lib.readFrame(i);
    if (!f) continue;
    const fv = frameVector(f);
    if (!fv) continue;
    decoded++;
    for (const ic of icons) {
      // silhouette correlation + light aspect penalty
      let dot = 0;
      for (let k = 0; k < fv.nvec.length; k++) dot += fv.nvec[k] * ic.nvec[k];
      const aspPen = Math.min(fv.bw / fv.bh, ic.aspect) / Math.max(fv.bw / fv.bh, ic.aspect);
      const score = dot * (0.7 + 0.3 * aspPen);
      const arr = top.get(ic.img);
      if (arr.length < TOPK || score > arr[arr.length - 1].score) consider(ic.img, { file: file.replace(/\.wil$/i, ""), frame: i, base: null, score: Number(score.toFixed(4)) });
    }
  }
  // fill base for current top entries from this file
  for (const arr of top.values()) for (const e of arr) if (e.base === null && `${e.file}.wil`.toLowerCase() === file.toLowerCase()) e.base = baseFor(e.frame);
  lib.close();
  console.log(`scanned ${file} (decoded so far ${decoded})`);
}

const out = {};
for (const [img, arr] of top) out[img] = arr;
fs.writeFileSync(path.join(OUT, "matches.json"), JSON.stringify(out, null, 1));
console.log("\nTop match per monster:");
for (const ic of icons) { const b = top.get(ic.img)[0]; console.log(`img ${ic.img}: ${b?.file}@${b?.base} frame ${b?.frame} score ${b?.score}`); }
console.log("wrote", path.join(OUT, "matches.json"));
