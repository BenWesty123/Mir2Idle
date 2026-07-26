/**
 * Fetch Mir2DB "new content" candidate dungeons (areas with no LOM Idle zone),
 * enrich each spawn with level/HP/icon, and render a visual preview sheet.
 *
 * Usage: node tools/build-newcontent-preview.mjs
 * Output: docs/mir2db-newcontent-preview.html  (open via dev server)
 * Cache:  tmp-mir2db-cache/*.json  (delete to force a re-fetch)
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://api.mir2db.com/api.php";
const CDN = "https://cdn.mir2db.com/images/mob/";
const CACHE = "tmp-mir2db-cache";
fs.mkdirSync(CACHE, { recursive: true });

// New-content candidates (Mir2DB list ids). Sorrow Moon (66) kept only to show
// WHY it's excluded (it's the fox area already in-game as Fox Cave).
const CANDIDATES = [
  { listId: 73, en: "Moon Valley", cn: "月之谷", note: "Lv70–80 moon shrine; boss Stone Beast ~30k HP" },
  { listId: 76, en: "Spirit Ghost Path", cn: "神穿鬼路", note: "Lv82+ exotic beasts — Qiongqi, Qilin, Water Dragon" },
  { listId: 89, en: "Southern Barbarian Land", cn: "南蛮", note: "Lv70–99 end-game; dual bosses Beast King / Danmo" },
  { listId: 68, en: "Sand Ruins", cn: "沙遗迹", note: "~Lv84 ruin complex; several mini-bosses" },
  { listId: 74, en: "Crescent Forest", cn: "弦月林", note: "Lv66–80 forest + class-champion hall" },
  { listId: 80, en: "Pianmu Island", cn: "片木岛", note: "Island + ghost ships" },
  { listId: 66, en: "Sorrow Moon Mountain", cn: "悲月山", note: "EXCLUDED — this is the fox area already shipped as Fox Cave", excluded: true },
];

async function getJson(type, id) {
  const key = path.join(CACHE, `${type}-${id}.json`);
  if (fs.existsSync(key)) {
    try { return JSON.parse(fs.readFileSync(key, "utf8")); } catch { /* refetch */ }
  }
  const r = await fetch(`${API}?type=${type}&id=${id}`);
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = null; }
  if (j) fs.writeFileSync(key, JSON.stringify(j));
  return j;
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function collectDungeon(cand) {
  const list = await getJson("list", cand.listId);
  const maps = Array.isArray(list?.data) ? list.data : [];
  // Aggregate unique mobs across every map, summing spawn counts.
  const byMon = new Map();
  for (const m of maps) {
    for (const rs of m.respawns ?? []) {
      const id = String(rs.MON_ID);
      const spawn = Number(rs.SPAWN) || 0;
      const cur = byMon.get(id) ?? {
        monId: id, kr: rs.NAME || "", cn: rs.NAME_CN || "", en: rs.NAME_EN || "",
        img: rs.IMGINDEX, spawn: 0, maps: 0,
      };
      cur.spawn += spawn;
      cur.maps += 1;
      byMon.set(id, cur);
    }
  }
  // Enrich with level/HP from the mob endpoint.
  const mons = [...byMon.values()];
  await mapWithConcurrency(mons, 6, async (mon) => {
    const d = await getJson("mob", mon.monId);
    mon.lv = Number(d?.level) || 0;
    mon.hp = Number(d?.hp) || 0;
    mon.exp = Number(d?.exp) || 0;
    mon.img = d?.img ?? mon.img;
    mon.cn = mon.cn || d?.name_cn || "";
    mon.en = mon.en || d?.name_en || "";
    mon.kr = mon.kr || d?.name || "";
    mon.undead = d?.undead === "1";
  });
  mons.sort((a, b) => (b.hp - a.hp) || (b.lv - a.lv));
  return { ...cand, mapCount: maps.length, label: list?.note || cand.cn, mons };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const dungeons = [];
for (const cand of CANDIDATES) {
  process.stdout.write(`Fetching ${cand.en} (list/${cand.listId})… `);
  const d = await collectDungeon(cand);
  console.log(`${d.mapCount} maps, ${d.mons.length} monsters`);
  dungeons.push(d);
}

function monRow(m) {
  const name = m.cn || m.en || m.kr || `#${m.monId}`;
  const boss = m.hp >= 8000 ? " boss" : "";
  return `<li class="mon${boss}">
    <img loading="lazy" src="${CDN}${esc(m.img)}.png" alt="" onerror="this.style.visibility='hidden'"/>
    <span class="mon-name">${esc(name)}${m.undead ? ' <em class="tag">undead</em>' : ""}</span>
    <span class="mon-stat">Lv ${m.lv || "?"} · ${m.hp ? m.hp.toLocaleString() : "?"} HP${m.spawn ? ` · ×${m.spawn}` : ""}</span>
    <span class="mon-idx">Mon idx ${esc(m.img)}</span>
  </li>`;
}

function card(d) {
  const cls = d.excluded ? "card excluded" : "card";
  const badge = d.excluded
    ? `<span class="badge miss">Already in game (Fox Cave)</span>`
    : `<span class="badge new">New content</span>`;
  const bosses = d.mons.filter((m) => m.hp >= 8000);
  const bossLine = bosses.length
    ? `Boss(es): <strong>${bosses.slice(0, 3).map((b) => esc(b.cn || b.en || b.kr)).join(", ")}</strong>`
    : "";
  return `<article class="${cls}">
    ${badge}
    <h3>${esc(d.en)} <span class="cn">${esc(d.cn)}</span></h3>
    <div class="meta">Mir2DB list/${d.listId} · ${d.mapCount} maps · ${d.mons.length} monster types</div>
    <p class="note">${esc(d.note)}</p>
    ${bossLine ? `<div class="bossline">${bossLine}</div>` : ""}
    <ul class="mons">${d.mons.map(monRow).join("")}</ul>
  </article>`;
}

const active = dungeons.filter((d) => !d.excluded);
const excluded = dungeons.filter((d) => d.excluded);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>New content candidates — Mir2DB vs LOM Idle</title>
<style>
  :root{--bg:#141210;--panel:#221c18;--ink:#f2e8d8;--muted:#9a8c78;--accent:#e0a050;--new:#6aaf70;--miss:#d07050;--line:#3a3028;}
  *{box-sizing:border-box}
  body{margin:0;font-family:"Trebuchet MS","Segoe UI",sans-serif;color:var(--ink);background:radial-gradient(ellipse at 10% 0%,#2a2218,transparent 50%),var(--bg)}
  header,main{max-width:1180px;margin:0 auto;padding:24px 28px}
  h1{margin:0 0 6px;color:var(--accent);font-size:1.5rem}
  h2{margin:26px 0 12px;color:var(--accent);font-size:1.1rem}
  p,li{color:var(--muted);line-height:1.45}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}
  .card.excluded{opacity:.72}
  .card h3{margin:2px 0 4px;color:var(--ink);font-size:1.05rem}
  .card h3 .cn{color:var(--muted);font-weight:400;font-size:.9rem;margin-left:6px}
  .meta{font-size:.78rem;color:var(--muted)}
  .note{font-size:.85rem;color:#c0a680;margin:8px 0}
  .bossline{font-size:.85rem;color:var(--ink);margin-bottom:6px}
  .badge{display:inline-block;font-size:.68rem;padding:2px 7px;border-radius:3px;margin-bottom:6px}
  .badge.new{background:#1e3020;color:var(--new)}
  .badge.miss{background:#302018;color:var(--miss)}
  .mons{margin:8px 0 0;padding:0;list-style:none;font-size:.82rem;max-height:420px;overflow:auto}
  .mon{display:grid;grid-template-columns:40px 1fr auto;grid-template-areas:"img name stat" "img idx idx";gap:2px 10px;align-items:center;padding:6px 0;border-top:1px solid #2a241e}
  .mon img{grid-area:img;width:40px;height:40px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:4px}
  .mon-name{grid-area:name;color:var(--ink)}
  .mon-stat{grid-area:stat;color:var(--muted);white-space:nowrap}
  .mon-idx{grid-area:idx;color:#6d5f4d;font-size:.72rem}
  .mon.boss{background:#241c12}
  .mon.boss .mon-name{color:var(--accent);font-weight:600}
  .tag{color:#b08;font-style:normal;font-size:.7rem}
</style></head>
<body>
<header>
  <h1>New content candidates — Korean-official dungeons not in LOM Idle</h1>
  <p>Live rosters pulled from Mir2DB (<code>api.mir2db.com</code>). Icons + <strong>Mon art index</strong> come straight from the KR client's <code>Mon*.wil</code> — that index is exactly what we'd import to add each monster. Bosses (≥8,000 HP) are highlighted.</p>
</header>
<main>
  <h2>Build candidates (${active.length})</h2>
  <div class="cards">${active.map(card).join("")}</div>
  <h2>Excluded (already implemented)</h2>
  <div class="cards">${excluded.map(card).join("")}</div>
</main>
</body></html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/mir2db-newcontent-preview.html", html, "utf8");
console.log("\nWrote docs/mir2db-newcontent-preview.html");
