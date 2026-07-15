/**
 * One-shot: pull Mir2DB warrior weapons, diff vs items.json, write a paper-doll preview page.
 * Usage: node tools/gen-mir2db-warrior-preview.mjs
 */
import fs from "fs";
import https from "https";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CN_TO_EN = {
  井中月: "Dragon Sword",
  八荒: "Hooked Sword",
  钢铁斧: "Steel Axe",
  破魂: "Prince Dagger",
  斩马刀: "Martial Sabre",
  祈祷之刃: "Spirit Blade1",
  修罗: "Power Axe",
  凝霜: "Purifier Sword",
  炼狱: "Great Axe",
  火血匕: "Fire Blood Sword",
  祖玛之裁决之杖: "Zuma Judgement Mace",
  裁决之杖: "Judgement Mace",
  墨龙屠龙: "Black Dragon Slayer",
  火灵神刀: "War Spirit Blade",
  屠龙: "Dragon Slayer",
  独孤九剑: "Sword Of War God",
  黑虎斧: "Black Tiger Hammer",
  炎狱血剑: "Hell Yama Blade1",
  昆仑降魔天神剑: "Gon Ryun Holy Light Sword (?)1",
  冰龙天刀: "Ice Dragon Sky Knife",
};

const EN_GUESS = {
  天龙神型夺命剑: "Heavenly Dragon Fatal Sword",
  命运之刃: "Blade of Fate",
  月光大刀: "Moonlight Sabre",
  魔血剑: "Magic Blood Sword",
  현천월아부: "Hyeoncheon Moon Axe",
};

const list = JSON.parse(await get("https://api.mir2db.com/api.php?type=list&id=2"));
const items = JSON.parse(fs.readFileSync("src/data/items.json", "utf8")).items;
const weaponsInGame = items.filter((i) => i.slot === "weapon");
const state = JSON.parse(fs.readFileSync("public/ui/character/stateitems.json", "utf8"));

function findByName(n) {
  const want = norm(n);
  return weaponsInGame.find(
    (w) =>
      norm(w.name) === want ||
      norm(w.id) === want.replace(/ /g, "-") ||
      norm(w.name).startsWith(want) ||
      want.startsWith(norm(w.name)),
  );
}

const owned = [];
const missing = [];
for (const it of list.data) {
  const cn = it.VIEW_NAME_CN || "";
  const mapped = CN_TO_EN[cn] || CN_TO_EN[it.VIEW_NAME];
  let hit = mapped ? findByName(mapped) : null;
  let how = hit ? "name" : null;
  if (!hit) {
    const hits = weaponsInGame.filter(
      (w) =>
        w.stats?.dc?.[0] == +it.DC_MIN &&
        w.stats?.dc?.[1] == +it.DC_MAX &&
        (+it.DC_MIN || +it.DC_MAX),
    );
    if (hits.length === 1) {
      hit = hits[0];
      how = "dc";
    }
  }
  const row = {
    id: +it.ITEM_ID,
    cn,
    kr: it.VIEW_NAME,
    en: mapped || EN_GUESS[cn] || EN_GUESS[it.VIEW_NAME] || cn || it.VIEW_NAME,
    lv: +it.NEED_LEVEL,
    dc: [+it.DC_MIN, +it.DC_MAX],
    acc: +it.ACCURATE,
    img: +it.IMGINDEX,
    iconUrl: `https://cdn.mir2db.com/images/item/${it.IMGINDEX}.png`,
    match: hit ? { name: hit.name, id: hit.id } : null,
    matchHow: how,
  };
  (hit ? owned : missing).push(row);
}

for (const m of missing) {
  const detail = JSON.parse(await get(`https://api.mir2db.com/api.php?type=item&id=${m.id}`));
  m.detail = detail;
}

function frame(id) {
  const f = state[String(id)];
  if (!f) return null;
  return {
    src: `../public/ui/character/stateitem-${id}.png`,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
  };
}

const previewWeapons = missing.map((m) => {
  const add =
    (m.detail?.addstat || []).find((s) => String(s.APPLY_JOB || "").startsWith("1/")) || null;
  const dc = add ? [+add.MinDC, +add.MaxDC] : m.dc;
  const notes = [];
  if (add) {
    notes.push(
      `Warrior addstat DC ${dc.join("-")}${+add.ACCURATE ? `, Acc +${add.ACCURATE}` : ""}`,
    );
  }
  if (m.id === 6944) notes.push("KR endgame axe; Mir2DB tooltip references region bonuses");
  return {
    id: m.id,
    cn: m.cn,
    kr: m.kr,
    en: m.en,
    lv: m.lv,
    dc: m.dc,
    effectiveDc: dc,
    acc: +(add?.ACCURATE ?? m.acc) || 0,
    img: m.img,
    iconUrl: m.iconUrl,
    paperDoll: frame(m.img),
    notes,
  };
});

const ownedBrief = owned.map((o) => ({
  cn: o.cn,
  en: o.en || o.match?.name,
  our: o.match?.name,
  dc: o.dc,
  lv: o.lv,
}));

const payload = {
  weapons: previewWeapons,
  ownedBrief,
  armour: frame(62),
  hair: {
    src: "../public/ui/character/hair-441.png",
    x: 131,
    y: 173,
    w: 16,
    h: 14,
  },
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mir2DB Warrior Weapons — not in LOM Idle yet</title>
<style>
  :root {
    --bg: #1a1410;
    --panel: #2a2118;
    --ink: #f0e6d2;
    --muted: #a89880;
    --accent: #c9a227;
    --line: #4a3c2a;
    --card: #231c15;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(ellipse at 20% 0%, #3a2a18 0%, transparent 50%),
      radial-gradient(ellipse at 80% 100%, #1e2a20 0%, transparent 45%),
      var(--bg);
  }
  header {
    padding: 28px 32px 8px;
    max-width: 1100px;
    margin: 0 auto;
  }
  header h1 {
    margin: 0 0 6px;
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--accent);
  }
  header p { margin: 0; color: var(--muted); max-width: 62ch; line-height: 1.45; }
  .layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 28px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 32px 48px;
  }
  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; }
  }
  .stage-wrap {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 20px;
    position: sticky;
    top: 16px;
    align-self: start;
  }
  .stage-wrap h2 {
    margin: 0 0 12px;
    font-size: 0.95rem;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stage {
    position: relative;
    width: 248px;
    height: 284px;
    margin: 0 auto 28px;
    image-rendering: pixelated;
    transform: scale(1.15);
    transform-origin: top center;
  }
  .panel-bg {
    position: absolute;
    inset: 0;
    background: url("../public/ui/character/character-panel.png") 0 0 / 248px 284px no-repeat;
  }
  .doll { position: absolute; inset: 0; pointer-events: none; }
  .layer {
    position: absolute;
    image-rendering: pixelated;
  }
  .fallback-weapon {
    position: absolute;
    left: 52px;
    top: 120px;
    width: 64px;
    height: 64px;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 0 4px rgba(0,0,0,0.8));
  }
  .selected-meta { margin-top: 8px; text-align: center; }
  .selected-meta .name {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--accent);
  }
  .selected-meta .stats {
    color: var(--muted);
    font-size: 0.92rem;
    margin-top: 4px;
  }
  .selected-meta .note {
    color: #c08060;
    font-size: 0.8rem;
    margin-top: 6px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    transition: border-color 0.15s, transform 0.15s;
  }
  .card:hover, .card.active {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .card.active { box-shadow: 0 0 0 1px var(--accent); }
  .card-top {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .card img.icon {
    width: 48px;
    height: 48px;
    image-rendering: pixelated;
    background: #111;
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .card .title { font-weight: 700; }
  .card .sub { color: var(--muted); font-size: 0.8rem; margin-top: 2px; }
  .card .statline {
    margin-top: 10px;
    font-size: 0.85rem;
    color: #d8c8a8;
    display: grid;
    gap: 2px;
  }
  .badge {
    display: inline-block;
    margin-top: 8px;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 3px;
    background: #3a3020;
    color: var(--accent);
  }
  .owned {
    max-width: 1100px;
    margin: 0 auto 40px;
    padding: 0 32px;
  }
  details {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px 16px;
  }
  summary { cursor: pointer; color: var(--muted); }
  .owned-list {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    columns: 2;
    gap: 24px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  @media (max-width: 700px) { .owned-list { columns: 1; } }
  .owned-list li { margin-bottom: 4px; }
  footer {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 32px 40px;
    color: #6a5a48;
    font-size: 0.75rem;
  }
  a { color: var(--accent); }
</style>
</head>
<body>
<header>
  <h1>Warrior weapons from Mir2DB — missing from LOM Idle</h1>
  <p>
    From the Korean official Mir2 “Warrior weapons” list
    (<a href="https://www.mir2db.com/list/2" target="_blank" rel="noopener">mir2db.com/list/2</a>).
    ${previewWeapons.length} of ${previewWeapons.length + ownedBrief.length} are not already in our items.json.
    Click a weapon to put it on the character.
  </p>
</header>
<div class="layout">
  <aside class="stage-wrap">
    <h2>Character preview</h2>
    <div class="stage" id="stage">
      <div class="panel-bg"></div>
      <div class="doll" id="doll"></div>
    </div>
    <div class="selected-meta" id="meta"></div>
  </aside>
  <section>
    <div class="cards" id="cards"></div>
  </section>
</div>
<section class="owned">
  <details>
    <summary>Already in the game (${ownedBrief.length} matched from the same Mir2DB list)</summary>
    <ul class="owned-list">
      ${ownedBrief
        .map(
          (o) =>
            `<li><strong>${esc(o.en || o.cn)}</strong> — our <em>${esc(o.our)}</em> (DC ${o.dc.join("-")}, Lv ${o.lv})</li>`,
        )
        .join("")}
    </ul>
  </details>
</section>
<footer>
  Paper-doll layers use Crystal stateitem art already in this repo when the Mir2DB Looks id matches.
  Inventory icons load from Mir2DB CDN. Local preview only — not for shipping.
  Open via the dev server:
  <code>http://localhost:4177/docs/mir2db-warrior-weapons-preview.html</code>
</footer>
<script>
const DATA = ${JSON.stringify(payload)};
const armour = DATA.armour;
const hair = DATA.hair;
const weapons = DATA.weapons;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function layer(frame, title) {
  if (!frame) return "";
  return \`<img class="layer" src="\${esc(frame.src)}" alt="" title="\${esc(title || "")}"
    style="left:\${frame.x}px;top:\${frame.y}px;width:\${frame.w}px;height:\${frame.h}px;" />\`;
}

function renderDoll(w) {
  const doll = document.getElementById("doll");
  let html = layer(armour, "Iron Armour") + layer(hair, "Hair");
  if (w.paperDoll) {
    html += layer(w.paperDoll, w.en);
  } else {
    html += \`<img class="fallback-weapon" src="\${esc(w.iconUrl)}" alt="\${esc(w.en)}"
      title="No paper-doll frame — inventory icon" />\`;
  }
  doll.innerHTML = html;
  const notes = (w.notes || []).map((n) => \`<div class="note">\${esc(n)}</div>\`).join("");
  document.getElementById("meta").innerHTML = \`
    <div class="name">\${esc(w.en)}</div>
    <div class="stats">DC \${w.effectiveDc.join("-")} · Need Lv \${w.lv}\${w.acc ? " · Acc +" + w.acc : ""}</div>
    <div class="stats">\${esc(w.cn || w.kr)} · Mir2DB #\${w.id} · Looks \${w.img}</div>
    \${notes}
    \${!w.paperDoll ? '<div class="note">No worn sprite in our stateitems for Looks ' + w.img + "</div>" : ""}
  \`;
}

function renderCards() {
  const root = document.getElementById("cards");
  root.innerHTML = weapons
    .map(
      (w, i) => \`
    <button type="button" class="card\${i === 0 ? " active" : ""}" data-i="\${i}">
      <div class="card-top">
        <img class="icon" src="\${esc(w.iconUrl)}" alt="" />
        <div>
          <div class="title">\${esc(w.en)}</div>
          <div class="sub">\${esc(w.cn || w.kr)}</div>
        </div>
      </div>
      <div class="statline">
        <span>DC \${w.effectiveDc.join("-")}</span>
        <span>Need level \${w.lv}</span>
        \${w.acc ? "<span>Accuracy +" + w.acc + "</span>" : ""}
      </div>
      <span class="badge">\${w.paperDoll ? "Has paper doll" : "Icon only"}</span>
    </button>
  \`,
    )
    .join("");
  root.querySelectorAll(".card").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".card").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      renderDoll(weapons[+btn.dataset.i]);
    });
  });
}

renderCards();
renderDoll(weapons[0]);
</script>
</body>
</html>
`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/mir2db-warrior-weapons-preview.html", html, "utf8");
console.log("Wrote docs/mir2db-warrior-weapons-preview.html");
console.log(`Missing ${previewWeapons.length} / owned ${ownedBrief.length}`);
previewWeapons.forEach((w) =>
  console.log(`  ${w.en}  DC${w.effectiveDc.join("-")}  doll=${!!w.paperDoll}`),
);
