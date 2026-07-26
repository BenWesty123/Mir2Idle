// Fetch the 13 Mir2DB monster icons, cache them locally, and extract a
// normalized 32x32 grayscale silhouette vector for each (via headless canvas,
// using data URLs so the canvas is not CORS-tainted).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const CDN = "https://cdn.mir2db.com/images/mob/";
const IMGS = [229, 329, 324, 328, 326, 325, 327, 321, 320, 323, 319, 322, 318];
const OUT = path.join("docs", "monster-picker");
const ICONDIR = path.join(OUT, "icons");
fs.mkdirSync(ICONDIR, { recursive: true });

const dataUrls = {};
for (const img of IMGS) {
  const res = await fetch(`${CDN}${img}.png`);
  if (!res.ok) { console.log("icon fetch fail", img, res.status); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(ICONDIR, `${img}.png`), buf);
  dataUrls[img] = `data:image/png;base64,${buf.toString("base64")}`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const vectors = await page.evaluate(async (urls) => {
  const N = 32;
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  const out = {};
  for (const [img, url] of Object.entries(urls)) {
    const im = await loadImg(url);
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const { data } = g.getImageData(0, 0, im.width, im.height);
    // alpha bbox (fallback to full if opaque)
    let minX = im.width, minY = im.height, maxX = 0, maxY = 0, anyAlpha = false;
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
      const a = data[(y * im.width + x) * 4 + 3];
      if (a > 16) { anyAlpha = anyAlpha || a < 250; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < minX) { minX = 0; minY = 0; maxX = im.width - 1; maxY = im.height - 1; }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const vec = new Array(N * N).fill(0);
    for (let ny = 0; ny < N; ny++) for (let nx = 0; nx < N; nx++) {
      const sx = minX + Math.min(bw - 1, Math.floor((nx * bw) / N));
      const sy = minY + Math.min(bh - 1, Math.floor((ny * bh) / N));
      const o = (sy * im.width + sx) * 4;
      const a = data[o + 3];
      const lum = a === 0 ? 0 : (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
      vec[ny * N + nx] = lum;
    }
    out[img] = { w: bw, h: bh, vec };
  }
  return out;
}, dataUrls);

await browser.close();
fs.writeFileSync(path.join(OUT, "icon-vectors.json"), JSON.stringify(vectors));
console.log("icons cached + vectors for", Object.keys(vectors).length, "monsters ->", path.join(OUT, "icon-vectors.json"));
