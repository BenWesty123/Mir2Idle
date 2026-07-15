/**
 * Pull Mir2DB warrior armour (list/38), diff vs items.json, write paper-doll preview.
 * Usage: node tools/gen-mir2db-armour-preview.mjs
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

function stripGender(name) {
  return String(name || "")
    .replace(/[（(][男女남여][）)]/g, "")
    .replace(/\s*\([MF]\)\d*$/i, "")
    .replace(/\+\d+$/, "")
    .trim();
}

const CN_TO_EN = {
  布衣: "Base Dress",
  轻型盔甲: "Light Armour",
  白骨衣: "Bone Robe",
  天衣无缝: "Heaven Robe",
  天龙不死衣: "Mir Armour",
  灵晶甲胄: "Crystal Armour",
  赤魔甲: "Red Dark Armour",
  绿魔甲: "Green Dark Armour",
  青魔甲: "Blue Dark Armour",
  破凰天魔衣: "Oma King Robe",
  血龙甲胄: "Tarragon Armour",
  监视者铠甲: "Raiders Armour",
  重盔甲: "Heavy Armour",
  战神盔甲: "Iron Armour",
  黑龙战甲: "Black Dragon Armor",
  鬼面甲胄: "Steel Armour",
  兽魂甲胄: "Beast Soul Armour",
  玄骨黑衣: "Mysterious Bone Robe",
  黑虎甲胄: "Black Tiger Armour",
};

const EN_GUESS = {
  兽魂甲胄: "Beast Soul Armour",
  玄骨黑衣: "Hyun Gol Black Robe",
  天衣无缝: "Seamless Heaven Robe",
};

const list = JSON.parse(await get("https://api.mir2db.com/api.php?type=list&id=38"));
const items = JSON.parse(fs.readFileSync("src/data/items.json", "utf8")).items;
const armours = items.filter((i) => i.slot === "armour" || i.slot === "armor");
const state = JSON.parse(fs.readFileSync("public/ui/character/stateitems.json", "utf8"));

const byFrame = new Map();
for (const a of armours) {
  const f = a.icon?.frame;
  if (f == null) continue;
  if (!byFrame.has(f)) byFrame.set(f, []);
  byFrame.get(f).push(a);
}

function findByName(n) {
  const want = norm(n);
  return armours.find(
    (a) =>
      norm(a.name) === want ||
      norm(a.name).startsWith(want) ||
      want.startsWith(norm(a.name)) ||
      norm(stripGender(a.name)) === want,
  );
}

const owned = [];
const missing = [];

for (const it of list.data) {
  const cnRaw = it.VIEW_NAME_CN || "";
  const cn = stripGender(cnRaw) || stripGender(it.VIEW_NAME);
  const mapped = CN_TO_EN[cn];
  const frameHits = byFrame.get(+it.IMGINDEX) || [];
  let hit = frameHits[0] || (mapped ? findByName(mapped) : null);
  let how = frameHits.length ? "frame" : hit ? "name" : null;

  // Black Dragon +N variants share our base armour
  if (!hit && cn.startsWith("黑龙战甲")) {
    hit = findByName("Black Dragon Armor (M)1") || findByName("Black Dragon Armor");
    how = hit ? "upgrade-line" : null;
  }

  const row = {
    id: +it.ITEM_ID,
    cn: cnRaw || it.VIEW_NAME,
    cnBase: cn,
    kr: it.VIEW_NAME,
    en: mapped || EN_GUESS[cn] || cn || it.VIEW_NAME,
    lv: +it.NEED_LEVEL,
    ac: [+it.AC_MIN, +it.AC_MAX],
    mac: [+it.MAC_MIN, +it.MAC_MAX],
    img: +it.IMGINDEX,
    iconUrl: `https://cdn.mir2db.com/images/item/${it.IMGINDEX}.png`,
    match: hit ? { name: hit.name, id: hit.id, frame: hit.icon?.frame } : null,
    matchHow: how,
    isFemale: /女|여|\(F\)/i.test(cnRaw + it.VIEW_NAME),
    upgrade: (cnRaw.match(/\+(\d+)/) || [])[1] ? `+${(cnRaw.match(/\+(\d+)/) || [])[1]}` : "",
  };
  (hit ? owned : missing).push(row);
}

// Prefer unique male base pieces for preview; still list female if unique Looks
function previewKey(row) {
  return `${row.cnBase}|${row.img}|${row.upgrade || "0"}`;
}

const seenPreview = new Set();
const missingUnique = [];
for (const m of missing) {
  const key = previewKey(m);
  if (seenPreview.has(key)) continue;
  // Prefer male when both exist with same cnBase+upgrade different imgs
  if (m.isFemale) {
    const maleTwin = missing.find(
      (x) => x.cnBase === m.cnBase && x.upgrade === m.upgrade && !x.isFemale,
    );
    if (maleTwin) continue;
  }
  seenPreview.add(key);
  missingUnique.push(m);
}

for (const m of missingUnique) {
  m.detail = JSON.parse(await get(`https://api.mir2db.com/api.php?type=item&id=${m.id}`));
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

const weaponFrame = frame(48); // Dragon Sword looks

const previewArmours = missingUnique.map((m) => {
  const add =
    (m.detail?.addstat || []).find((s) => String(s.APPLY_JOB || "").startsWith("1/")) ||
    (m.detail?.addstat || [])[0] ||
    null;
  const ac = add && (+add.MinAC || +add.MaxAC) ? [+add.MinAC, +add.MaxAC] : m.ac;
  const mac = add && (+add.MinMAC || +add.MaxMAC) ? [+add.MinMAC, +add.MaxMAC] : m.mac;
  const notes = [];
  if (add && (+add.MinAC || +add.MaxAC || +add.MinMAC || +add.MaxMAC)) {
    notes.push(`Addstat AC ${ac.join("-")} / MAC ${mac.join("-")}`);
  }
  if (!m.ac[0] && !m.ac[1] && !m.mac[0] && !m.mac[1] && !add) {
    notes.push("Base AC/MAC listed as 0-0 on Mir2DB");
  }
  return {
    id: m.id,
    cn: m.cn,
    cnBase: m.cnBase,
    kr: m.kr,
    en: m.en,
    lv: m.lv,
    ac: m.ac,
    mac: m.mac,
    effectiveAc: ac,
    effectiveMac: mac,
    img: m.img,
    iconUrl: m.iconUrl,
    paperDoll: frame(m.img),
    notes,
    upgrade: m.upgrade,
  };
});

// Collapse owned for display: unique cnBase (ignore gender + upgrades as one line)
const ownedByBase = new Map();
for (const o of owned) {
  const key = o.cnBase;
  if (!ownedByBase.has(key)) ownedByBase.set(key, o);
}
const ownedBrief = [...ownedByBase.values()].map((o) => ({
  cn: o.cnBase,
  en: o.en,
  our: o.match?.name,
  ac: o.ac,
  mac: o.mac,
  lv: o.lv,
  how: o.matchHow,
}));

const payload = {
  armours: previewArmours,
  ownedBrief,
  weapon: weaponFrame,
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
<title>Mir2DB Warrior Armour — not in LOM Idle yet</title>
<style>
  :root {
    --bg: #121820;
    --panel: #1c2430;
    --ink: #e8eef6;
    --muted: #8a9aad;
    --accent: #6eb5ff;
    --line: #2e3a4a;
    --card: #171e28;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(ellipse at 15% 0%, #243048 0%, transparent 50%),
      radial-gradient(ellipse at 90% 100%, #1a2830 0%, transparent 45%),
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
    color: var(--accent);
  }
  header p { margin: 0; color: var(--muted); max-width: 64ch; line-height: 1.45; }
  .layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 28px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 32px 48px;
  }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
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
  .layer { position: absolute; image-rendering: pixelated; }
  .fallback-armour {
    position: absolute;
    left: 92px;
    top: 160px;
    width: 72px;
    height: 72px;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 0 4px rgba(0,0,0,0.8));
  }
  .selected-meta { margin-top: 8px; text-align: center; }
  .selected-meta .name { font-size: 1.15rem; font-weight: 700; color: var(--accent); }
  .selected-meta .stats { color: var(--muted); font-size: 0.92rem; margin-top: 4px; }
  .selected-meta .note { color: #d09070; font-size: 0.8rem; margin-top: 6px; }
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
  }
  .card:hover, .card.active { border-color: var(--accent); }
  .card.active { box-shadow: 0 0 0 1px var(--accent); }
  .card-top { display: flex; gap: 12px; align-items: center; }
  .card img.icon {
    width: 48px; height: 48px;
    image-rendering: pixelated;
    background: #0c1018;
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .card .title { font-weight: 700; }
  .card .sub { color: var(--muted); font-size: 0.8rem; margin-top: 2px; }
  .card .statline {
    margin-top: 10px;
    font-size: 0.85rem;
    color: #c8d4e4;
    display: grid;
    gap: 2px;
  }
  .badge {
    display: inline-block;
    margin-top: 8px;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 3px;
    background: #243040;
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
    color: #5a6a7a;
    font-size: 0.75rem;
  }
  a { color: var(--accent); }
  .empty {
    color: var(--muted);
    padding: 24px;
    border: 1px dashed var(--line);
    border-radius: 8px;
  }
</style>
</head>
<body>
<header>
  <h1>Warrior armour from Mir2DB — missing from LOM Idle</h1>
  <p>
    From the Korean official Mir2 “Warrior armour” list
    (<a href="https://www.mir2db.com/list/38" target="_blank" rel="noopener">mir2db.com/list/38</a>).
    Matched mainly by Looks/frame id (same as our paper-doll frames).
    ${previewArmours.length
      ? `${previewArmours.length} unique piece(s) not already in items.json (gender twins collapsed).`
      : "Everything on this list already maps to something we have."}
    Click a piece to dress the character.
  </p>
</header>
<div class="layout">
  <aside class="stage-wrap">
    <h2>Character preview</h2>
    <div class="stage">
      <div class="panel-bg"></div>
      <div class="doll" id="doll"></div>
    </div>
    <div class="selected-meta" id="meta"></div>
  </aside>
  <section id="cards-wrap">
    ${
      previewArmours.length
        ? '<div class="cards" id="cards"></div>'
        : '<div class="empty">No missing warrior armours — you already cover this Mir2DB list (including Black Dragon +N as our base Black Dragon Armor).</div>'
    }
  </section>
</div>
<section class="owned">
  <details open>
    <summary>Already in the game (${ownedBrief.length} base types from list/38)</summary>
    <ul class="owned-list">
      ${ownedBrief
        .map(
          (o) =>
            `<li><strong>${esc(o.en || o.cn)}</strong> — our <em>${esc(o.our)}</em> (AC ${o.ac.join("-")} / MAC ${o.mac.join("-")}, Lv ${o.lv}, via ${esc(o.how)})</li>`,
        )
        .join("")}
    </ul>
  </details>
</section>
<footer>
  Black Dragon +1…+7 variants count as owned if base Black Dragon Armor exists.
  Local preview only. Open:
  <code>http://localhost:4177/docs/mir2db-warrior-armour-preview.html</code>
</footer>
<script>
const DATA = ${JSON.stringify(payload)};
const hair = DATA.hair;
const weapon = DATA.weapon;
const armours = DATA.armours;

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

function renderDoll(a) {
  const doll = document.getElementById("doll");
  if (!a) {
    doll.innerHTML = layer(hair, "Hair") + (weapon ? layer(weapon, "Dragon Sword") : "");
    document.getElementById("meta").innerHTML = "<div class=\\"stats\\">Pick an armour — or none missing.</div>";
    return;
  }
  let html = "";
  if (a.paperDoll) html += layer(a.paperDoll, a.en);
  else html += \`<img class="fallback-armour" src="\${esc(a.iconUrl)}" alt="\${esc(a.en)}" />\`;
  if (weapon) html += layer(weapon, "Dragon Sword");
  html += layer(hair, "Hair");
  doll.innerHTML = html;
  const notes = (a.notes || []).map((n) => \`<div class="note">\${esc(n)}</div>\`).join("");
  document.getElementById("meta").innerHTML = \`
    <div class="name">\${esc(a.en)}</div>
    <div class="stats">AC \${a.effectiveAc.join("-")} / MAC \${a.effectiveMac.join("-")} · Need Lv \${a.lv}</div>
    <div class="stats">\${esc(a.cn)} · Mir2DB #\${a.id} · Looks \${a.img}</div>
    \${notes}
    \${!a.paperDoll ? '<div class="note">No worn sprite in our stateitems for Looks ' + a.img + "</div>" : ""}
  \`;
}

function renderCards() {
  const root = document.getElementById("cards");
  if (!root || !armours.length) {
    renderDoll(null);
    return;
  }
  root.innerHTML = armours
    .map(
      (a, i) => \`
    <button type="button" class="card\${i === 0 ? " active" : ""}" data-i="\${i}">
      <div class="card-top">
        <img class="icon" src="\${esc(a.iconUrl)}" alt="" />
        <div>
          <div class="title">\${esc(a.en)}</div>
          <div class="sub">\${esc(a.cn)}</div>
        </div>
      </div>
      <div class="statline">
        <span>AC \${a.effectiveAc.join("-")} / MAC \${a.effectiveMac.join("-")}</span>
        <span>Need level \${a.lv}</span>
      </div>
      <span class="badge">\${a.paperDoll ? "Has paper doll" : "Icon only"}</span>
    </button>
  \`,
    )
    .join("");
  root.querySelectorAll(".card").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".card").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      renderDoll(armours[+btn.dataset.i]);
    });
  });
  renderDoll(armours[0]);
}

renderCards();
</script>
</body>
</html>
`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/mir2db-warrior-armour-preview.html", html, "utf8");
console.log("Wrote docs/mir2db-warrior-armour-preview.html");
console.log(`Missing unique: ${previewArmours.length} | Owned base types: ${ownedBrief.length}`);
console.log("--- MISSING ---");
previewArmours.forEach((a) =>
  console.log(
    `  ${a.en} | ${a.cn} | AC${a.effectiveAc.join("-")}/MAC${a.effectiveMac.join("-")} | doll=${!!a.paperDoll} | looks=${a.img}`,
  ),
);
console.log("--- OWNED ---");
ownedBrief.forEach((o) => console.log(`  ${o.en} -> ${o.our} (${o.how})`));
