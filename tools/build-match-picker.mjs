// Comparison picker: for each of the 13 Mir2DB monsters, show the reference
// icon beside its top image-match candidate frames (across ALL Mon files) so
// the user confirms the correct sprite. Clicking a candidate assigns it;
// "Copy picks JSON" exports { img: "MonNN@base" }.
import fs from "node:fs";
import path from "node:path";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";
import { writePng } from "./lib/png-write.mjs";

const DATA = "C:/Users/bb-we/Documents/KR-Mir2-Client/Data";
const OUT = path.join("docs", "monster-picker");
const THUMBS = path.join(OUT, "thumbs2");
fs.mkdirSync(THUMBS, { recursive: true });
const matches = JSON.parse(fs.readFileSync(path.join(OUT, "matches.json"), "utf8"));

const META = {
  229: "Beast King", 329: "Danmo", 324: "White Elephant", 328: "Rhino",
  326: "White Tiger", 325: "Black Tiger", 327: "Black Ape", 321: "Frost Demon",
  320: "Destroyer Demon", 323: "Mad Corpse", 319: "Black Sky Demon",
  322: "Cold Corpse", 318: "Rebel Demon",
};
const CELL = 96;
const libCache = new Map();
function lib(file) { if (!libCache.has(file)) libCache.set(file, new WeMadeWilLib(`${DATA}/${file}.wil`)); return libCache.get(file); }

function thumb(f) {
  let minX = f.width, minY = f.height, maxX = 0, maxY = 0;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
    if (f.rgba[(y * f.width + x) * 4 + 3] !== 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < minX) return null;
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const scale = Math.min(CELL / cw, CELL / ch, 1);
  const dw = Math.max(1, Math.round(cw * scale)), dh = Math.max(1, Math.round(ch * scale));
  const out = Buffer.alloc(CELL * CELL * 4);
  const ox = Math.floor((CELL - dw) / 2), oy = Math.floor((CELL - dh) / 2);
  for (let y = 0; y < dh; y++) { const sy = minY + Math.min(ch - 1, Math.floor((y * ch) / dh));
    for (let x = 0; x < dw; x++) { const sx = minX + Math.min(cw - 1, Math.floor((x * cw) / dw));
      const s = (sy * f.width + sx) * 4; if (f.rgba[s + 3] === 0) continue;
      const d = ((oy + y) * CELL + (ox + x)) * 4; out[d] = f.rgba[s]; out[d + 1] = f.rgba[s + 1]; out[d + 2] = f.rgba[s + 2]; out[d + 3] = 255; } }
  return writePng(CELL, CELL, out);
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// de-dup candidates by file@base, render a front-facing standing thumb per block
let rows = "";
for (const [img, name] of Object.entries(META)) {
  const cands = matches[img] || [];
  const seen = new Set();
  let tiles = "";
  for (const c of cands) {
    const key = `${c.file}@${c.base}`;
    if (seen.has(key)) continue; seen.add(key);
    const L = lib(c.file);
    let f = null;
    for (const cand of [c.base + 40, c.base + 44, c.frame, c.base]) { f = L.readFrame(cand); if (f && f.width > 6 && f.height > 6) break; }
    if (!f) continue;
    const png = thumb(f); if (!png) continue;
    const tname = `${img}-${c.file}-${c.base}.png`;
    fs.writeFileSync(path.join(THUMBS, tname), png);
    tiles += `<button class="tile" data-key="${key}" title="${key} score ${c.score}"><img src="thumbs2/${tname}" alt=""><span>${key}<br>${c.score}</span></button>`;
  }
  rows += `<div class="row"><div class="ref"><img src="icons/${img}.png" onerror="this.style.opacity=.15"><b>${esc(name)}</b><span class="pick none" id="pick-${img}" data-img="${img}">— none —</span></div><div class="cands">${tiles}</div></div>`;
}

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Barbarian sprite matcher</title><style>
body{margin:0;background:#141210;color:#efe4d2;font-family:"Segoe UI",Trebuchet MS,sans-serif}
header{padding:12px 18px;border-bottom:1px solid #322820;position:sticky;top:0;background:#141210;z-index:5}
h1{color:#e0a050;font-size:1.1rem;margin:0 0 4px}p{color:#9a8c78;font-size:.8rem;margin:3px 0;line-height:1.4}
.bar{display:flex;gap:8px;margin-top:8px}
button.act{background:#5a3d10;color:#ffcf70;border:1px solid #7a5a24;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:.8rem}
#count{color:#9a8c78;font-size:.8rem;align-self:center}
.row{display:flex;gap:14px;align-items:center;padding:10px 18px;border-bottom:1px solid #241e18}
.ref{width:150px;flex:none;display:flex;flex-direction:column;align-items:center;gap:2px}
.ref img{width:96px;height:96px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:6px}
.ref b{color:#fff;font-size:.9rem}
.pick{font-size:.74rem;font-family:ui-monospace,monospace;color:#7fd08a}.pick.none{color:#8f8069}
.cands{display:flex;gap:6px;flex-wrap:wrap}
.tile{background:#1c1712;border:1px solid #2a241e;border-radius:6px;padding:3px;cursor:pointer;display:flex;flex-direction:column;align-items:center;color:#9a8c78}
.tile img{width:96px;height:96px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:4px}
.tile span{font-size:.6rem;font-family:ui-monospace,monospace;text-align:center;margin-top:2px}
.tile:hover{border-color:#e0a050}.tile.assigned{border-color:#7fd08a;box-shadow:0 0 0 1px #7fd08a inset}
textarea{width:calc(100% - 36px);margin:8px 18px;height:110px;background:#0d0b09;color:#7fd08a;border:1px solid #322820;border-radius:6px;font-family:ui-monospace,monospace;font-size:.78rem;padding:8px}
</style></head><body>
<header><h1>Southern Barbarian — confirm each monster's sprite</h1>
<p>Each row: the Mir2DB reference (left) + its top image-match candidates from ALL 58 Mon files. Click the candidate that truly matches. If none fit, tell me and I'll widen the search. Double-click a name to clear it.</p>
<div class="bar"><button class="act" id="copyBtn">Copy picks JSON</button><button class="act" id="clearBtn">Clear all</button><span id="count"></span></div></header>
${rows}
<h3 style="color:#e0a050;margin:14px 18px 4px">Picks JSON</h3><textarea id="out" readonly></textarea>
<script>
const KEY="sb-monster-picks2";let picks=JSON.parse(localStorage.getItem(KEY)||"{}");
function refresh(){
 document.querySelectorAll('.pick').forEach(el=>{const p=picks[el.dataset.img];el.textContent=p||'— none —';el.classList.toggle('none',!p);});
 const used={};for(const[i,k]of Object.entries(picks))used[k]=i;
 document.querySelectorAll('.tile').forEach(t=>{const row=t.closest('.row');const img=row.querySelector('.pick').dataset.img;t.classList.toggle('assigned',picks[img]===t.dataset.key);});
 document.getElementById('out').value=JSON.stringify(picks,null,2);
 document.getElementById('count').textContent=Object.keys(picks).length+' / 13 matched';
 localStorage.setItem(KEY,JSON.stringify(picks));
}
document.querySelectorAll('.tile').forEach(t=>t.addEventListener('click',()=>{const img=t.closest('.row').querySelector('.pick').dataset.img;picks[img]=t.dataset.key;refresh();}));
document.querySelectorAll('.pick').forEach(el=>el.addEventListener('dblclick',()=>{delete picks[el.dataset.img];refresh();}));
document.getElementById('copyBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(JSON.stringify(picks));document.getElementById('copyBtn').textContent='Copied!';setTimeout(()=>document.getElementById('copyBtn').textContent='Copy picks JSON',1200);});
document.getElementById('clearBtn').addEventListener('click',()=>{if(confirm('Clear all?')){picks={};refresh();}});
refresh();
</script></body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), html);
for (const L of libCache.values()) L.close();
console.log("wrote", path.join(OUT, "index.html"));
