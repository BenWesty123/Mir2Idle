/**
 * Clean reference sheet for the 13 Southern Barbarian Land monsters (Mir2DB
 * list/89), grouped by role, with normal/elite variants and stats.
 * Output: docs/southern-barbarian-sheet.html
 */
import fs from "node:fs";
import path from "node:path";

const CDN = "https://cdn.mir2db.com/images/mob/";
const list = JSON.parse(fs.readFileSync("tmp-mir2db-cache/list-89.json", "utf8"));

// Canonical English labels + role grouping, keyed by Mir2DB img index.
const META = {
  229: { en: "Beast King", role: "Boss" },
  329: { en: "Danmo", role: "Boss" },
  324: { en: "White Elephant", role: "Beast" },
  328: { en: "Rhino", role: "Beast" },
  326: { en: "White Tiger", role: "Beast" },
  325: { en: "Black Tiger", role: "Beast" },
  327: { en: "Black Ape", role: "Beast" },
  321: { en: "Frost Demon", role: "Demon / Corpse" },
  320: { en: "Destroyer Demon", role: "Demon / Corpse" },
  323: { en: "Mad Corpse", role: "Demon / Corpse" },
  319: { en: "Black Sky Demon", role: "Demon / Corpse" },
  322: { en: "Cold Corpse", role: "Demon / Corpse" },
  318: { en: "Rebel Demon", role: "Demon / Corpse" },
};

// Collapse spawns to distinct art (img), collecting each variant.
const byImg = new Map();
for (const m of list.data ?? []) {
  for (const rs of m.respawns ?? []) {
    const img = Number(rs.IMGINDEX);
    if (!META[img]) continue;
    let d = null;
    try { d = JSON.parse(fs.readFileSync(`tmp-mir2db-cache/mob-${rs.MON_ID}.json`, "utf8")); } catch {}
    const variant = {
      kr: rs.NAME || d?.name || "", cn: rs.NAME_CN || d?.name_cn || "",
      lv: Number(d?.level) || 0, hp: Number(d?.hp) || 0, exp: Number(d?.exp) || 0,
      dc: `${d?.mindc ?? "?"}–${d?.maxdc ?? "?"}`, ac: `${d?.minac ?? "?"}`, mac: `${d?.minmac ?? "?"}`,
      monId: rs.MON_ID,
    };
    if (!byImg.has(img)) byImg.set(img, { img, variants: new Map() });
    byImg.get(img).variants.set(rs.MON_ID, variant);
  }
}

const ROLES = ["Boss", "Beast", "Demon / Corpse"];
const entries = [...byImg.values()].map((e) => {
  const vs = [...e.variants.values()].sort((a, b) => a.hp - b.hp);
  return { ...e, ...META[e.img], vs, maxHp: Math.max(...vs.map((v) => v.hp)) };
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function card(e) {
  const lvs = e.vs.map((v) => v.lv);
  const hps = e.vs.map((v) => v.hp);
  const lvLabel = Math.min(...lvs) === Math.max(...lvs) ? `Lv ${lvs[0]}` : `Lv ${Math.min(...lvs)}–${Math.max(...lvs)}`;
  const hpLabel = Math.min(...hps) === Math.max(...hps) ? `${hps[0].toLocaleString()} HP` : `${Math.min(...hps).toLocaleString()}–${Math.max(...hps).toLocaleString()} HP`;
  const variantRows = e.vs.map((v) =>
    `<tr><td>${esc(v.kr)}${v.cn ? ` <span class="cn">${esc(v.cn)}</span>` : ""}</td><td>Lv ${v.lv}</td><td>${v.hp.toLocaleString()}</td><td>${esc(v.dc)}</td><td>${esc(v.ac)}/${esc(v.mac)}</td></tr>`,
  ).join("");
  return `<article class="card ${e.role === "Boss" ? "boss" : ""}">
    <img class="art" src="${CDN}${e.img}.png" alt="" onerror="this.style.opacity=.2"/>
    <div class="body">
      <h3>${esc(e.en)} <span class="badge">${esc(e.role)}</span></h3>
      <div class="meta">img ${e.img} · ${lvLabel} · ${hpLabel} · ${e.vs.length} variant${e.vs.length > 1 ? "s" : ""}</div>
      <table><thead><tr><th>Name (KR / CN)</th><th>Lv</th><th>HP</th><th>DC</th><th>AC/MAC</th></tr></thead><tbody>${variantRows}</tbody></table>
    </div>
  </article>`;
}

let body = "";
for (const role of ROLES) {
  const group = entries.filter((e) => e.role === role).sort((a, b) => b.maxHp - a.maxHp);
  body += `<h2>${role}${role !== "Boss" ? "s" : "es"} <small>${group.length}</small></h2><div class="cards">${group.map(card).join("")}</div>`;
}

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Southern Barbarian Land — 13 monsters</title>
<style>
  body{margin:0;background:#141210;color:#efe4d2;font-family:"Segoe UI",Trebuchet MS,sans-serif}
  header,main{max-width:1100px;margin:0 auto;padding:18px 24px}
  h1{color:#e0a050;font-size:1.4rem;margin:0 0 4px}
  h2{color:#e0a050;font-size:1.05rem;margin:26px 0 10px;border-top:1px solid #3a3028;padding-top:16px}
  h2 small{color:#9a8c78;font-weight:400}
  p{color:#9a8c78;line-height:1.45}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
  .card{display:flex;gap:12px;background:#221c18;border:1px solid #322820;border-radius:8px;padding:12px}
  .card.boss{border-color:#7a5a24;background:#241d12}
  .art{width:84px;height:84px;object-fit:contain;image-rendering:pixelated;background:#0d0b09;border-radius:6px;flex:none}
  .body{flex:1;min-width:0}
  h3{margin:0 0 3px;font-size:1rem;color:#fff}
  .badge{font-size:.62rem;background:#302818;color:#d0a860;border-radius:3px;padding:2px 6px;vertical-align:middle;margin-left:4px}
  .card.boss .badge{background:#5a3d10;color:#ffcf70}
  .meta{font-size:.76rem;color:#9a8c78;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;font-size:.76rem}
  th{color:#8f8069;text-align:left;font-weight:600;border-bottom:1px solid #322820;padding:2px 4px}
  td{padding:2px 4px;border-bottom:1px solid #2a241e;color:#d8cbb6}
  .cn{color:#8f8069}
</style></head><body>
<header>
  <h1>Southern Barbarian Land (南蛮) — the 13 monsters</h1>
  <p>Mir2DB list/89. Icons are the authoritative Mir2DB renders of each monster. Most appear as a normal + an "elite/enraged" variant sharing the same art. Lv 70–99. This is the definitive roster; the actual in-game sprites still need locating in the KR <code>.wil</code> art before import.</p>
</header>
<main>${body}</main>
</body></html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(path.join("docs", "southern-barbarian-sheet.html"), html);
console.log("Wrote docs/southern-barbarian-sheet.html —", entries.length, "distinct monsters");
