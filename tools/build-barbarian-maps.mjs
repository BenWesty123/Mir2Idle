/**
 * Map sheet for Southern Barbarian Land (Mir2DB list/89): the 4 connected maps
 * with their Mir2DB overhead images, names, and spawn/NPC counts.
 * Output: docs/southern-barbarian-maps.html
 */
import fs from "node:fs";
import path from "node:path";

const CDN = "https://cdn.mir2db.com/images/map/";
const list = JSON.parse(fs.readFileSync("tmp-mir2db-cache/list-89.json", "utf8"));

const EN = {
  "남만": "Southern Barbarian Land (main)",
  "고대비밀의통로": "Ancient Secret Passage",
  "고대도시의흔적": "Ancient City Ruins",
  "남만지역": "Barbarian Region (town / NPC hub)",
};

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

const cards = list.data.map((m) => {
  const kr = m.map_name || "";
  const en = EN[kr] || m.map_name_cn || kr;
  return `<article class="card">
    <div class="imgwrap"><img src="${CDN}${m.minimap}.png" alt="" onerror="this.parentNode.innerHTML='<span class=miss>no map image (minimap ${m.minimap})</span>'"></div>
    <h3>${esc(en)}</h3>
    <div class="meta">${esc(kr)}${m.map_name_cn ? ` · ${esc(m.map_name_cn)}` : ""}</div>
    <div class="meta">map_id ${m.map_id} · minimap ${m.minimap} · ${m.respawns?.length || 0} spawn slots · ${m.npcs?.length || 0} NPCs</div>
    <div><a href="https://www.mir2db.com/map/${m.map_id}" target="_blank" rel="noopener">Open on Mir2DB →</a></div>
  </article>`;
}).join("");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Southern Barbarian Land — maps</title>
<style>
  body{margin:0;background:#141210;color:#efe4d2;font-family:"Segoe UI",Trebuchet MS,sans-serif}
  header,main{max-width:1100px;margin:0 auto;padding:18px 24px}
  h1{color:#e0a050;font-size:1.4rem;margin:0 0 4px}
  p{color:#9a8c78;line-height:1.45}
  a{color:#deb060}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
  .card{background:#221c18;border:1px solid #322820;border-radius:8px;padding:12px}
  .imgwrap{background:#0b0908;border-radius:6px;min-height:120px;display:flex;align-items:center;justify-content:center;overflow:auto}
  .imgwrap img{max-width:100%;image-rendering:pixelated}
  .miss{color:#8f8069;font-size:.8rem;padding:20px}
  h3{margin:8px 0 2px;font-size:1rem;color:#fff}
  .meta{font-size:.78rem;color:#9a8c78}
</style></head><body>
<header>
  <h1>Southern Barbarian Land (南蛮) — maps</h1>
  <p>The dungeon is 4 connected maps. Images are Mir2DB's overhead/minimap renders. The <strong>main</strong> map (남만, map_id 845) is where most monsters spawn; 남만지역 is the town/NPC hub; the two "Ancient" maps are sub-areas.</p>
</header>
<main><div class="cards">${cards}</div></main>
</body></html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(path.join("docs", "southern-barbarian-maps.html"), html);
console.log("Wrote docs/southern-barbarian-maps.html —", list.data.length, "maps");
