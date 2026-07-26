/**
 * Interactive picker to match each of the 13 Southern Barbarian monsters
 * (Mir2DB img) to its exact block (base frame) in the KR Mon22/31/32.wil.
 *
 * Detects monster blocks by gap analysis, renders a front-facing thumbnail
 * (standing dir4) per block, and emits a clickable HTML page. Picks are saved
 * in localStorage; "Copy picks JSON" exports { img: "Mon22@820", ... } to paste
 * back for the batch atlas build.
 *
 * Output: docs/monster-picker/index.html (+ thumbs/)
 */
import fs from "node:fs";
import path from "node:path";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";
import { writePng } from "./lib/png-write.mjs";

const DATA = "C:/Users/bb-we/Documents/KR-Mir2-Client/Data";
const CDN = "https://cdn.mir2db.com/images/mob/";
const OUT = path.join("docs", "monster-picker");
const THUMBS = path.join(OUT, "thumbs");
fs.mkdirSync(THUMBS, { recursive: true });

const TARGETS = [
  { img: 229, en: "Beast King", role: "Boss" },
  { img: 329, en: "Danmo", role: "Boss" },
  { img: 324, en: "White Elephant", role: "Beast" },
  { img: 328, en: "Rhino", role: "Beast" },
  { img: 326, en: "White Tiger", role: "Beast" },
  { img: 325, en: "Black Tiger", role: "Beast" },
  { img: 327, en: "Black Ape", role: "Beast" },
  { img: 321, en: "Frost Demon", role: "Demon / Corpse" },
  { img: 320, en: "Destroyer Demon", role: "Demon / Corpse" },
  { img: 323, en: "Mad Corpse", role: "Demon / Corpse" },
  { img: 319, en: "Black Sky Demon", role: "Demon / Corpse" },
  { img: 322, en: "Cold Corpse", role: "Demon / Corpse" },
  { img: 318, en: "Rebel Demon", role: "Demon / Corpse" },
];

const CELL = 100;
function trimToThumb(f) {
  // find content bbox
  let minX = f.width, minY = f.height, maxX = 0, maxY = 0;
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      if (f.rgba[(y * f.width + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const scale = Math.min(CELL / cw, CELL / ch, 1);
  const dw = Math.max(1, Math.round(cw * scale)), dh = Math.max(1, Math.round(ch * scale));
  const out = Buffer.alloc(CELL * CELL * 4);
  const ox = Math.floor((CELL - dw) / 2), oy = Math.floor((CELL - dh) / 2);
  for (let y = 0; y < dh; y++) {
    const sy = minY + Math.min(ch - 1, Math.floor((y * ch) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = minX + Math.min(cw - 1, Math.floor((x * cw) / dw));
      const s = (sy * f.width + sx) * 4;
      if (f.rgba[s + 3] === 0) continue;
      const d = ((oy + y) * CELL + (ox + x)) * 4;
      out[d] = f.rgba[s]; out[d + 1] = f.rgba[s + 1]; out[d + 2] = f.rgba[s + 2]; out[d + 3] = 255;
    }
  }
  return writePng(CELL, CELL, out);
}

function detectBlocks(lib) {
  // presence + size per frame
  const present = new Array(lib.count).fill(0);
  const dim = new Array(lib.count).fill(0);
  for (let i = 0; i < lib.count; i++) {
    const f = lib.readFrame(i);
    if (f && f.width > 4 && f.height > 4) { present[i] = 1; dim[i] = Math.max(f.width, f.height); }
  }
  // A monster base is a standing-block start (####......) preceded by a big
  // inter-monster gap (>=12 empties). Intra-monster gaps are only ~6.
  const emptiesBefore = (b) => { let c = 0; for (let k = b - 1; k >= 0 && !present[k]; k--) c++; return c; };
  const standingStart = (b) => present[b] && present[b + 1] && present[b + 2] && present[b + 3] && !present[b + 4] && !present[b + 5];
  const blocks = [];
  for (let b = 0; b < lib.count; b++) {
    if (!standingStart(b)) continue;
    if (b !== 0 && emptiesBefore(b) < 12) continue;
    // extent to next big gap
    let end = b, gap = 0, maxDim = 0;
    for (let i = b; i < lib.count && gap <= 12; i++) {
      if (present[i]) { end = i; gap = 0; maxDim = Math.max(maxDim, dim[i]); } else gap++;
    }
    blocks.push({ base: b, len: end - b + 1, maxDim });
  }
  return blocks;
}

const files = [22, 31, 32];
const gallery = [];
for (const n of files) {
  const wil = `${DATA}/Mon${n}.wil`;
  const lib = new WeMadeWilLib(wil);
  const blocks = detectBlocks(lib);
  console.log(`Mon${n}.wil: ${lib.count} frames -> ${blocks.length} candidate blocks`);
  for (const b of blocks) {
    // front-facing standing (dir4 = base+40), fallbacks
    let f = null;
    for (const cand of [b.base + 40, b.base + 44, b.base + 80, b.base]) {
      f = lib.readFrame(cand);
      if (f && f.width > 4 && f.height > 4) break;
    }
    if (!f) continue;
    const png = trimToThumb(f);
    if (!png) continue;
    const name = `mon${n}-${b.base}.png`;
    fs.writeFileSync(path.join(THUMBS, name), png);
    gallery.push({ file: `Mon${n}`, base: b.base, len: b.len, maxDim: b.maxDim, thumb: `thumbs/${name}` });
  }
  lib.close();
}
console.log(`Total blocks: ${gallery.length}`);

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const targetCards = TARGETS.map((t) => `
  <label class="target" data-img="${t.img}">
    <input type="radio" name="active" value="${t.img}">
    <img class="ref" src="${CDN}${t.img}.png" onerror="this.style.opacity=.15" alt="">
    <div class="tinfo"><b>${esc(t.en)}</b><span class="role">${esc(t.role)}</span>
      <span class="pick" id="pick-${t.img}">— none —</span></div>
  </label>`).join("");

const galleryTiles = gallery.map((g) => `
  <button class="tile" data-key="${g.file}@${g.base}" title="${g.file}@${g.base} (len ${g.len}, ${g.maxDim}px)">
    <img src="${esc(g.thumb)}" loading="lazy" alt="">
    <span>${g.file}@${g.base}</span>
  </button>`).join("");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Southern Barbarian — sprite picker</title>
<style>
  body{margin:0;background:#141210;color:#efe4d2;font-family:"Segoe UI",Trebuchet MS,sans-serif}
  header{padding:14px 20px;border-bottom:1px solid #322820;position:sticky;top:0;background:#141210;z-index:5}
  h1{color:#e0a050;font-size:1.15rem;margin:0 0 4px}
  p{color:#9a8c78;margin:4px 0;font-size:.82rem;line-height:1.4}
  .bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  button.act{background:#5a3d10;color:#ffcf70;border:1px solid #7a5a24;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:.8rem}
  .targets{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;padding:12px 20px}
  .target{display:flex;gap:8px;align-items:center;background:#221c18;border:1px solid #322820;border-radius:7px;padding:8px;cursor:pointer}
  .target:has(input:checked){border-color:#e0a050;background:#2a2113;box-shadow:0 0 0 1px #e0a050 inset}
  .target input{display:none}
  .ref{width:56px;height:56px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:5px;flex:none}
  .tinfo{display:flex;flex-direction:column;min-width:0}
  .tinfo b{color:#fff;font-size:.9rem}
  .role{color:#8f8069;font-size:.7rem}
  .pick{color:#7fd08a;font-size:.78rem;margin-top:2px;font-family:ui-monospace,monospace}
  .pick.none{color:#8f8069}
  h2{color:#e0a050;font-size:.95rem;margin:16px 20px 6px}
  .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;padding:0 20px 40px}
  .tile{background:#1c1712;border:1px solid #2a241e;border-radius:6px;padding:4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;color:#b8a888}
  .tile img{width:100px;height:100px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:4px}
  .tile span{font-size:.64rem;color:#9a8c78;font-family:ui-monospace,monospace;margin-top:2px}
  .tile.assigned{border-color:#7fd08a}
  .tile:hover{border-color:#e0a050}
  textarea{width:calc(100% - 40px);margin:0 20px;height:120px;background:#0d0b09;color:#7fd08a;border:1px solid #322820;border-radius:6px;font-family:ui-monospace,monospace;font-size:.78rem;padding:8px}
</style></head><body>
<header>
  <h1>Southern Barbarian Land — match each monster to its KR sprite block</h1>
  <p>1) Click a monster below to select it (highlighted). 2) Click the matching sprite block in the gallery. 3) Repeat for all 13. 4) Click <b>Copy picks JSON</b> and paste it back to me. Picks auto-save in this browser.</p>
  <div class="bar">
    <button class="act" id="copyBtn">Copy picks JSON</button>
    <button class="act" id="clearBtn">Clear all</button>
    <span id="count" style="color:#9a8c78;font-size:.8rem;align-self:center"></span>
  </div>
</header>
<div class="targets">${targetCards}</div>
<h2>Sprite blocks (Mon22 / Mon31 / Mon32) — ${gallery.length} candidates</h2>
<div class="gallery">${galleryTiles}</div>
<h2>Picks JSON</h2>
<textarea id="out" readonly></textarea>
<script>
const KEY="sb-monster-picks";
let picks=JSON.parse(localStorage.getItem(KEY)||"{}");
function activeImg(){const r=document.querySelector('input[name=active]:checked');return r?r.value:null;}
function refresh(){
  document.querySelectorAll('.pick').forEach(el=>{el.textContent='— none —';el.classList.add('none');});
  const used={};
  for(const[img,key]of Object.entries(picks)){const el=document.getElementById('pick-'+img);if(el){el.textContent=key;el.classList.remove('none');}used[key]=img;}
  document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('assigned',!!used[t.dataset.key]));
  document.getElementById('out').value=JSON.stringify(picks,null,2);
  document.getElementById('count').textContent=Object.keys(picks).length+' / 13 matched';
  localStorage.setItem(KEY,JSON.stringify(picks));
}
document.querySelectorAll('.tile').forEach(t=>t.addEventListener('click',()=>{
  const img=activeImg();if(!img){alert('Select a monster (top) first.');return;}
  picks[img]=t.dataset.key;refresh();
  // auto-advance to next unmatched
  const imgs=[...document.querySelectorAll('input[name=active]')];
  const next=imgs.find(i=>!picks[i.value]);if(next)next.checked=true;
}));
document.getElementById('copyBtn').addEventListener('click',async()=>{
  await navigator.clipboard.writeText(JSON.stringify(picks));
  document.getElementById('copyBtn').textContent='Copied!';setTimeout(()=>document.getElementById('copyBtn').textContent='Copy picks JSON',1200);
});
document.getElementById('clearBtn').addEventListener('click',()=>{if(confirm('Clear all picks?')){picks={};refresh();}});
// clicking a target's pick label clears just that one
document.querySelectorAll('.target').forEach(t=>t.addEventListener('dblclick',()=>{delete picks[t.dataset.img];refresh();}));
refresh();
</script>
</body></html>`;

fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log("Wrote", path.join(OUT, "index.html"));
