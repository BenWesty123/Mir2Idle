// Complete browsable gallery of every detected monster block across ALL 58
// Mon*.wil files, grouped by file, front-facing thumbnails labeled MonNN@base.
// Sticky top bar shows the 13 Mir2DB targets. Click a block to assign it to the
// currently-selected target; export picks JSON.
import fs from "node:fs";
import path from "node:path";
import { WeMadeWilLib } from "./lib/wemade-wil-lib.mjs";
import { writePng } from "./lib/png-write.mjs";

const DATA = "C:/Users/bb-we/Documents/KR-Mir2-Client/Data";
const OUT = path.join("docs", "monster-picker");
const THUMBS = path.join(OUT, "all");
fs.mkdirSync(THUMBS, { recursive: true });

const META = {
  229: "Beast King", 329: "Danmo", 324: "White Elephant", 328: "Rhino",
  326: "White Tiger", 325: "Black Tiger", 327: "Black Ape", 321: "Frost Demon",
  320: "Destroyer Demon", 323: "Mad Corpse", 319: "Black Sky Demon",
  322: "Cold Corpse", 318: "Rebel Demon",
};
const CELL = 92;

function detectBlocks(lib) {
  const present = new Array(lib.count).fill(0);
  const dim = new Array(lib.count).fill(0);
  for (let i = 0; i < lib.count; i++) { const d = lib.frameDims(i); if (d && d.width > 4 && d.height > 4) { present[i] = 1; dim[i] = Math.max(d.width, d.height); } }
  const emptiesBefore = (b) => { let c = 0; for (let k = b - 1; k >= 0 && !present[k]; k--) c++; return c; };
  // A monster base is a clean run start (>=4 present frames) preceded by a big
  // inter-monster gap. Run length varies per file (4..8), so don't assume 4.
  const standingStart = (b) => present[b] && present[b + 1] && present[b + 2] && present[b + 3] && (b === 0 || !present[b - 1]);
  const blocks = [];
  for (let b = 0; b < lib.count; b++) {
    if (!standingStart(b)) continue;
    if (b !== 0 && emptiesBefore(b) < 12) continue;
    let end = b, gap = 0, maxDim = 0;
    for (let i = b; i < lib.count && gap <= 12; i++) { if (present[i]) { end = i; gap = 0; maxDim = Math.max(maxDim, dim[i]); } else gap++; }
    blocks.push({ base: b, len: end - b + 1, maxDim });
  }
  return blocks;
}

function thumb(f) {
  let minX = f.width, minY = f.height, maxX = 0, maxY = 0;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (f.rgba[(y * f.width + x) * 4 + 3] !== 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (maxX < minX) return null;
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const scale = Math.min(CELL / cw, CELL / ch, 1);
  const dw = Math.max(1, Math.round(cw * scale)), dh = Math.max(1, Math.round(ch * scale));
  const out = Buffer.alloc(CELL * CELL * 4);
  const ox = Math.floor((CELL - dw) / 2), oy = Math.floor((CELL - dh) / 2);
  for (let y = 0; y < dh; y++) { const sy = minY + Math.min(ch - 1, Math.floor((y * ch) / dh));
    for (let x = 0; x < dw; x++) { const sx = minX + Math.min(cw - 1, Math.floor((x * cw) / dw)); const s = (sy * f.width + sx) * 4; if (f.rgba[s + 3] === 0) continue; const d = ((oy + y) * CELL + (ox + x)) * 4; out[d] = f.rgba[s]; out[d + 1] = f.rgba[s + 1]; out[d + 2] = f.rgba[s + 2]; out[d + 3] = 255; } }
  return writePng(CELL, CELL, out);
}

const files = fs.readdirSync(DATA).filter((f) => /^Mon.*\.wil$/i.test(f))
  .sort((a, b) => (Number(a.match(/\d+/)?.[0]) || 0) - (Number(b.match(/\d+/)?.[0]) || 0));

let sections = "";
let zeroFiles = [];
let total = 0;
for (const file of files) {
  const fname = file.replace(/\.wil$/i, "");
  const lib = new WeMadeWilLib(`${DATA}/${file}`);
  const blocks = detectBlocks(lib);
  if (!blocks.length) { zeroFiles.push(fname); lib.close(); continue; }
  let tiles = "";
  for (const b of blocks) {
    let f = null;
    for (const cand of [b.base + 40, b.base + 44, b.base + 80, b.base]) { f = lib.readFrame(cand); if (f && f.width > 6 && f.height > 6) break; }
    if (!f) continue;
    const png = thumb(f); if (!png) continue;
    const tname = `${fname}-${b.base}.png`;
    fs.writeFileSync(path.join(THUMBS, tname), png);
    tiles += `<button class="tile" data-key="${fname}@${b.base}" title="${fname}@${b.base} (${b.maxDim}px, ${b.len}f)"><img src="all/${tname}" loading="lazy" alt=""><span>${fname}@${b.base}</span></button>`;
    total++;
  }
  sections += `<section><h2 id="${fname}">${fname} <small>${blocks.length} blocks · ${lib.count} frames</small></h2><div class="grid">${tiles}</div></section>`;
  lib.close();
}

const targetBar = Object.entries(META).map(([img, name]) => `<label class="t"><input type="radio" name="active" value="${img}"><img src="icons/${img}.png" onerror="this.style.opacity=.15"><span>${name}<b class="pk none" data-img="${img}">—</b></span></label>`).join("");
const nav = files.map((f) => f.replace(/\.wil$/i, "")).map((f) => `<a href="#${f}">${f.replace("Mon", "")}</a>`).join(" ");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All monsters — pick Southern Barbarian</title><style>
body{margin:0;background:#141210;color:#efe4d2;font-family:"Segoe UI",Trebuchet MS,sans-serif}
header{position:sticky;top:0;background:#100e0c;border-bottom:1px solid #322820;z-index:9;padding:8px 14px}
h1{color:#e0a050;font-size:1rem;margin:0 0 4px}p{color:#9a8c78;font-size:.76rem;margin:2px 0}
.targets{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.t{display:flex;align-items:center;gap:5px;background:#221c18;border:1px solid #322820;border-radius:6px;padding:3px 7px 3px 3px;cursor:pointer;font-size:.74rem}
.t:has(input:checked){border-color:#e0a050;background:#2a2113}
.t input{display:none}.t img{width:34px;height:34px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:4px}
.t span{display:flex;flex-direction:column;line-height:1.1}.pk{color:#7fd08a;font-family:ui-monospace,monospace;font-size:.68rem}.pk.none{color:#6a5f4f}
.bar{display:flex;gap:8px;align-items:center;margin-top:4px}
button.act{background:#5a3d10;color:#ffcf70;border:1px solid #7a5a24;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:.76rem}
.nav{font-size:.72rem;color:#8f8069;margin-top:4px;line-height:1.6}.nav a{color:#caa76a;text-decoration:none;margin-right:2px}
main{padding:0 14px 40px}
h2{color:#e0a050;font-size:.9rem;margin:16px 0 6px;border-top:1px solid #2a241e;padding-top:10px}h2 small{color:#8f8069;font-weight:400;font-size:.72rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:5px}
.tile{background:#1c1712;border:1px solid #2a241e;border-radius:5px;padding:3px;cursor:pointer;display:flex;flex-direction:column;align-items:center;color:#8f8069}
.tile img{width:88px;height:88px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:3px}
.tile span{font-size:.58rem;font-family:ui-monospace,monospace;margin-top:1px}
.tile:hover{border-color:#e0a050}.tile.assigned{border-color:#7fd08a;box-shadow:0 0 0 1px #7fd08a inset}
textarea{width:calc(100% - 28px);margin:8px 14px;height:100px;background:#0d0b09;color:#7fd08a;border:1px solid #322820;border-radius:6px;font-family:ui-monospace,monospace;font-size:.76rem;padding:8px}
</style></head><body>
<header><h1>All monsters (58 files, ${total} blocks) — find the 13 Southern Barbarian ones</h1>
<p>Pick a target monster below (it highlights), then click its sprite in the gallery. Scroll or use the file jump-nav. Double-click a target's code to clear.</p>
<div class="targets">${targetBar}</div>
<div class="bar"><button class="act" id="copyBtn">Copy picks JSON</button><button class="act" id="clearBtn">Clear</button><span id="count" style="color:#9a8c78;font-size:.76rem"></span></div>
<div class="nav">Jump: ${nav}</div>
${zeroFiles.length ? `<p style="color:#c07a5a">No blocks auto-detected in: ${zeroFiles.join(", ")} (different layout — tell me if the barbarian ones aren't found and I'll scan these manually).</p>` : ""}
</header>
<main>${sections}</main>
<h3 style="color:#e0a050;margin:10px 14px 4px">Picks JSON</h3><textarea id="out" readonly></textarea>
<script>
const KEY="sb-all-picks";let picks=JSON.parse(localStorage.getItem(KEY)||"{}");
function activeImg(){const r=document.querySelector('input[name=active]:checked');return r?r.value:null;}
function refresh(){
 document.querySelectorAll('.pk').forEach(el=>{const p=picks[el.dataset.img];el.textContent=p||'—';el.classList.toggle('none',!p);});
 const used={};for(const[i,k]of Object.entries(picks))used[k]=i;
 document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('assigned',!!used[t.dataset.key]));
 document.getElementById('out').value=JSON.stringify(picks,null,2);
 document.getElementById('count').textContent=Object.keys(picks).length+' / 13';
 localStorage.setItem(KEY,JSON.stringify(picks));
}
document.querySelectorAll('.tile').forEach(t=>t.addEventListener('click',()=>{const img=activeImg();if(!img){alert('Select a monster (top bar) first.');return;}picks[img]=t.dataset.key;const imgs=[...document.querySelectorAll('input[name=active]')];const nx=imgs.find(i=>!picks[i.value]);if(nx)nx.checked=true;refresh();}));
document.querySelectorAll('.pk').forEach(el=>el.addEventListener('dblclick',()=>{delete picks[el.dataset.img];refresh();}));
document.getElementById('copyBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(JSON.stringify(picks));document.getElementById('copyBtn').textContent='Copied!';setTimeout(()=>document.getElementById('copyBtn').textContent='Copy picks JSON',1200);});
document.getElementById('clearBtn').addEventListener('click',()=>{if(confirm('Clear all?')){picks={};refresh();}});
refresh();
</script></body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log(`wrote ${path.join(OUT, "index.html")} — ${total} blocks, zero-block files: ${zeroFiles.join(",") || "none"}`);
