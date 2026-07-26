/**
 * Render actual KR-client monster sprites (WeMade .wil) into a browsable HTML
 * gallery so we can pick exactly which creatures to import. Each thumbnail is a
 * real decoded sprite frame, trimmed to its content and labelled Mon<file>#<frame>.
 *
 * Usage: node tools/build-kr-monster-gallery.mjs
 * Output: docs/kr-monster-gallery/index.html (+ png thumbs)
 *   Open http://localhost:4177/docs/kr-monster-gallery/index.html  (dev server)
 */
import fs from "node:fs";
import path from "node:path";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";
import { writePng } from "./lib/png-write.mjs";

const DATA = "C:/Users/bb-we/Documents/KR-Mir2-Client/Data";
const OUT = path.join(process.cwd(), "docs", "kr-monster-gallery");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The three files that (per Mir2DB) hold Southern Barbarian Land art.
const FILES = [
  { name: "Mon22", step: 8, note: "Beast King 万兽之王 (img229) lives here, among other big monsters" },
  { name: "Mon31", step: 10, note: "barbarian warriors / fire demons" },
  { name: "Mon32", step: 8, note: "serpents (early) + corpse/frost demons (tail) + Danmo 丹墨 (img329)" },
];

// Mir2DB reference icons for the 13 Southern Barbarian monsters (context row).
const ICONS = [
  [229, "Beast King 万兽之王 Lv99 34k"], [329, "Danmo 丹墨 Lv99 30k"],
  [324, "White Elephant 백상"], [328, "Rhino 서우"], [326, "White Tiger 남만백호"],
  [325, "Black Tiger 남만흑호"], [327, "Black Ape 흑성성"], [320, "멸귀"],
  [321, "한천귀 (frost)"], [322, "한시 (corpse)"], [323, "광한시 (corpse)"],
  [318, "역천귀"], [319, "흑천귀"],
];

function trim(frame) {
  const { width: w, height: h, rgba } = frame;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] !== 0) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++)
    rgba.copy(out, y * tw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0) * 4 + tw * 4);
  return { w: tw, h: th, rgba: out };
}

let sections = "";
for (const file of FILES) {
  const wil = path.join(DATA, file.name + ".wil");
  if (!fs.existsSync(wil)) { console.log("skip missing", wil); continue; }
  const lib = new WeMadeWilLib(wil);
  fs.mkdirSync(path.join(OUT, file.name), { recursive: true });
  let cells = "";
  let kept = 0;
  for (let i = 0; i < lib.count; i += file.step) {
    const f = lib.readFrame(i);
    if (!f || f.width <= 0 || f.height <= 0) continue;
    const t = trim(f);
    if (!t || t.w < 12 || t.h < 12) continue; // skip empties / tiny effect specks
    const rel = `${file.name}/f${i}.png`;
    fs.writeFileSync(path.join(OUT, rel), writePng(t.w, t.h, t.rgba));
    cells += `<figure><img src="${rel}" loading="lazy"><figcaption>${file.name}#${i} · ${t.w}×${t.h}</figcaption></figure>`;
    kept++;
  }
  lib.close();
  console.log(`${file.name}: ${kept} thumbs (count ${lib.count}, step ${file.step})`);
  sections += `<section><h2>${file.name}.wil <small>${file.note}</small></h2><div class="grid">${cells}</div></section>`;
}

const iconRow = ICONS.map(([img, label]) =>
  `<figure class="ref"><img src="https://cdn.mir2db.com/images/mob/${img}.png"><figcaption>#${img} · ${label}</figcaption></figure>`,
).join("");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KR Southern Barbarian monster art — pick list</title>
<style>
  body{margin:0;background:#141210;color:#e8dcc8;font-family:"Segoe UI",Trebuchet MS,sans-serif}
  header,section{max-width:1300px;margin:0 auto;padding:16px 22px}
  h1{color:#e0a050;font-size:1.35rem;margin:0 0 4px}
  h2{color:#e0a050;font-size:1.05rem;border-top:1px solid #3a3028;padding-top:16px;margin-top:26px}
  h2 small{color:#9a8c78;font-weight:400;font-size:.8rem;margin-left:8px}
  p{color:#9a8c78;line-height:1.45}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
  figure{margin:0;background:#221c18;border:1px solid #302820;border-radius:6px;padding:6px;text-align:center;display:flex;flex-direction:column;justify-content:flex-end}
  figure img{max-width:100%;height:auto;image-rendering:pixelated;background:#0d0b09;border-radius:3px}
  figure.ref img{width:64px;height:64px;object-fit:contain}
  figcaption{font-size:10px;color:#8f8069;margin-top:4px;word-break:break-all}
  .refgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
</style></head><body>
<header>
  <h1>Southern Barbarian Land — KR monster art (pick list)</h1>
  <p>Top row = Mir2DB reference icons (what each of the 13 monsters is). Below = the <strong>actual KR client sprites</strong> decoded from the WeMade <code>.wil</code> files, sampled every few frames and labelled <code>Mon&lt;file&gt;#&lt;frame&gt;</code>. Browse, then just tell me which creatures (by their <code>Mon###frame</code> label, or "the black tiger", etc.) you want in the zone — I'll import only those.</p>
  <h2>Reference: the 13 monsters (Mir2DB icons)</h2>
  <div class="refgrid">${iconRow}</div>
</header>
${sections}
</body></html>`;

fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log("\nWrote", path.join(OUT, "index.html"));
