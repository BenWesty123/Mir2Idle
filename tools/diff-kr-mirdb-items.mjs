/**
 * Parse KR KoreanServer Server.MirDB ItemInfoList and diff against items.json
 * by inventory Image/frame (and weapon/armour Shape ↔ visual.index).
 *
 * KR DB quirks vs stock Crystal v68:
 *   - Durability is UInt32 (not UInt16)
 *   - After CanAwakening: tooltip bool + optional string + Int32 custom
 *   - MapInfo header is not reliably skippable; we scan for item runs
 *
 * Usage: node tools/diff-kr-mirdb-items.mjs
 * Writes: docs/kr-mirdb-items-diff.json, docs/kr-mirdb-items-missing.html
 */
import fs from "node:fs";
import path from "node:path";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const defaultDb =
  "C:/Users/bb-we/Documents/KR-Mir2-Client/KServer/KoreanServer/Server/Server.MirDB";

const ITEM_TYPES = {
  0: "Nothing",
  1: "Weapon",
  2: "Armour",
  4: "Helmet",
  5: "Necklace",
  6: "Bracelet",
  7: "Ring",
  8: "Amulet",
  9: "Belt",
  10: "Boots",
  11: "Stone",
  12: "Torch",
  13: "Potion",
  14: "Ore",
  15: "Meat",
  16: "CraftingMaterial",
  17: "Scroll",
  18: "Gem",
  19: "Mount",
  20: "Book",
  21: "Script",
  26: "Mask",
  34: "Quest",
  39: "Socket",
};

const GEAR_TYPES = new Set([
  "Weapon",
  "Armour",
  "Helmet",
  "Necklace",
  "Bracelet",
  "Ring",
  "Belt",
  "Boots",
  "Stone",
  "Amulet",
  "Torch",
  "Mask",
]);

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function read7bitLen(buf, p) {
  let len = 0;
  let shift = 0;
  let b;
  do {
    b = buf[p++];
    len |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80);
  return { len, p };
}

function readString(buf, p) {
  const { len, p: p2 } = read7bitLen(buf, p);
  if (len < 0 || len > 500 || p2 + len > buf.length) throw new Error("strlen");
  return { name: buf.toString("utf8", p2, p2 + len), p: p2 + len, len };
}

function parseItem(buf, p0) {
  let p = p0;
  const index = buf.readInt32LE(p);
  p += 4;
  if (index < 0 || index > 5000) throw new Error("idx");
  const s = readString(buf, p);
  p = s.p;
  if (s.len < 1 || s.len > 60) throw new Error("name");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000e-\u001f]/.test(s.name)) throw new Error("ctrl");

  const typeId = buf[p++];
  const grade = buf[p++];
  const requiredType = buf[p++];
  const requiredClass = buf[p++];
  const requiredGender = buf[p++];
  const set = buf[p++];
  if (typeId > 50 || grade > 20 || requiredType > 20 || requiredGender > 3) {
    throw new Error("enums");
  }

  const shape = buf.readInt16LE(p);
  p += 2;
  const weight = buf[p++];
  const light = buf[p++];
  const requiredAmount = buf[p++];
  const image = buf.readUInt16LE(p);
  p += 2;
  const durability = buf.readUInt32LE(p);
  p += 4; // KR: u32
  const stackSize = buf.readUInt32LE(p);
  p += 4;
  const price = buf.readUInt32LE(p);
  p += 4;
  if (image > 10000 || stackSize > 1_000_000 || durability > 5_000_000) {
    throw new Error("img/stack/dur");
  }

  const minAC = buf[p++];
  const maxAC = buf[p++];
  const minMAC = buf[p++];
  const maxMAC = buf[p++];
  const minDC = buf[p++];
  const maxDC = buf[p++];
  const minMC = buf[p++];
  const maxMC = buf[p++];
  const minSC = buf[p++];
  const maxSC = buf[p++];
  if (maxDC < minDC || maxAC < minAC || maxMC < minMC || maxSC < minSC) {
    throw new Error("range");
  }

  const hp = buf.readUInt16LE(p);
  p += 2;
  const mp = buf.readUInt16LE(p);
  p += 2;
  const accuracy = buf[p++];
  const agility = buf[p++];
  const luck = buf.readInt8(p);
  p++;
  const attackSpeed = buf.readInt8(p);
  p++;
  const startItem = buf[p++];
  if (startItem > 1) throw new Error("start");

  p += 3; // bag/hand/wear
  p += 1; // effect
  p += 10; // resists / crit
  p += 1; // bools
  p += 5; // rates / holy / freeze / poison
  p += 2; // bind
  p += 2; // reflect / hpdrain
  p += 2; // unique
  p += 1; // randomStatsId
  const canFastRun = buf[p++];
  if (canFastRun > 1) throw new Error("fr");
  const canAwakening = buf[p++];
  if (canAwakening > 1) throw new Error("aw");

  const hasTooltip = buf[p++];
  if (hasTooltip > 1) throw new Error("tt");
  let tooltip = "";
  if (hasTooltip) {
    const t = readString(buf, p);
    p = t.p;
    tooltip = t.name;
  }
  p += 4; // KR custom int32

  return {
    rec: {
      index,
      name: s.name,
      typeId,
      type: ITEM_TYPES[typeId] || `Type${typeId}`,
      grade,
      requiredType,
      requiredClass,
      requiredGender,
      set,
      shape,
      weight,
      light,
      requiredAmount,
      image,
      durability,
      stackSize,
      price,
      stats: {
        minAC,
        maxAC,
        minMAC,
        maxMAC,
        minDC,
        maxDC,
        minMC,
        maxMC,
        minSC,
        maxSC,
        hp,
        mp,
        accuracy,
        agility,
        luck,
        attackSpeed,
      },
      tooltip,
    },
    p,
  };
}

function parseAllItems(dbPath) {
  const buf = fs.readFileSync(dbPath);
  const version = buf.readInt32LE(0);
  const customVersion = buf.readInt32LE(4);
  const byIndex = new Map();

  const runFrom = (off) => {
    let p = off;
    const recs = [];
    for (;;) {
      try {
        const r = parseItem(buf, p);
        recs.push(r.rec);
        p = r.p;
      } catch {
        break;
      }
    }
    return { recs, end: p };
  };

  // Item list sits before the monster block (~520k in this DB)
  const scanEnd = Math.min(buf.length - 4, 530_000);
  for (let off = 8; off < scanEnd; off++) {
    const r = runFrom(off);
    if (!r.recs.length) continue;
    for (const it of r.recs) {
      if (!byIndex.has(it.index)) byIndex.set(it.index, it);
    }
    if (r.recs.length > 15) off = r.end - 1;
  }

  return {
    source: dbPath,
    version,
    customVersion,
    items: [...byIndex.values()].sort((a, b) => a.index - b.index),
  };
}

function iconRelForFrame(frame) {
  const publicPath = path.join(root, "public/item-icons/items", frameFileName(frame));
  if (fs.existsSync(publicPath)) {
    return `../public/item-icons/items/${frameFileName(frame)}`;
  }
  const review = reviewIconSourcePath(root, frame);
  if (review) return `../${path.relative(root, review).replace(/\\/g, "/")}`;
  return null;
}

function fmtRange(a, b) {
  if (!a && !b) return "—";
  return `${a}-${b}`;
}

function statsLine(it) {
  const s = it.stats;
  const parts = [];
  if (s.minDC || s.maxDC) parts.push(`DC ${fmtRange(s.minDC, s.maxDC)}`);
  if (s.minMC || s.maxMC) parts.push(`MC ${fmtRange(s.minMC, s.maxMC)}`);
  if (s.minSC || s.maxSC) parts.push(`SC ${fmtRange(s.minSC, s.maxSC)}`);
  if (s.minAC || s.maxAC) parts.push(`AC ${fmtRange(s.minAC, s.maxAC)}`);
  if (s.minMAC || s.maxMAC) parts.push(`MAC ${fmtRange(s.minMAC, s.maxMAC)}`);
  if (s.accuracy) parts.push(`Acc +${s.accuracy}`);
  if (s.agility) parts.push(`Agi +${s.agility}`);
  if (s.hp) parts.push(`HP +${s.hp}`);
  if (s.mp) parts.push(`MP +${s.mp}`);
  if (s.luck) parts.push(`Luck ${s.luck}`);
  if (s.attackSpeed) parts.push(`AS ${s.attackSpeed}`);
  return parts.join(", ") || "no combat stats";
}

function familyKey(name) {
  return String(name || "")
    .replace(/[（(][男女남여MF][）)]/gi, "")
    .replace(/\+\d+$/g, "")
    .replace(/반짝\s*/g, "")
    .replace(/\d+$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const dbPath = argValue("--db", defaultDb);
if (!fs.existsSync(dbPath)) {
  console.error("MirDB not found:", dbPath);
  process.exit(1);
}

console.log("Parsing", dbPath);
const parsed = parseAllItems(dbPath);
console.log(`DB v${parsed.version} custom=${parsed.customVersion}: ${parsed.items.length} items`);

const ours = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8")).items;
const byFrame = new Map();
const byShape = new Map();
for (const it of ours) {
  const f = it.icon?.frame;
  if (f != null) {
    if (!byFrame.has(f)) byFrame.set(f, []);
    byFrame.get(f).push(it);
  }
  const shape = it.visual?.index;
  if (shape != null && (it.slot === "weapon" || it.slot === "armour")) {
    const key = `${it.slot}:${shape}`;
    if (!byShape.has(key)) byShape.set(key, []);
    byShape.get(key).push(it);
  }
}

const matched = [];
const missing = [];
for (const kr of parsed.items) {
  const frameHits = byFrame.get(kr.image) || [];
  let how = frameHits.length ? "image/frame" : null;
  let hits = frameHits;
  if (!hits.length && (kr.type === "Weapon" || kr.type === "Armour")) {
    const slot = kr.type === "Weapon" ? "weapon" : "armour";
    const shapeHits = byShape.get(`${slot}:${kr.shape}`) || [];
    if (shapeHits.length) {
      hits = shapeHits;
      how = "shape/visual.index";
    }
  }
  const row = {
    ...kr,
    matchHow: how,
    match: hits.map((h) => ({
      id: h.id,
      name: h.name,
      frame: h.icon?.frame,
      shape: h.visual?.index,
      slot: h.slot,
    })),
  };
  (hits.length ? matched : missing).push(row);
}

const missingGear = missing.filter((m) => GEAR_TYPES.has(m.type));
const missingOther = missing.filter((m) => !GEAR_TYPES.has(m.type));

const seen = new Set();
const missingGearUnique = [];
for (const m of missingGear) {
  const key = `${m.type}|${m.image}|${m.shape}|${familyKey(m.name)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  missingGearUnique.push(m);
}

missingGearUnique.sort(
  (a, b) =>
    a.type.localeCompare(b.type) ||
    b.requiredAmount - a.requiredAmount ||
    a.image - b.image ||
    a.name.localeCompare(b.name, "ko"),
);

const byType = {};
for (const m of missingGearUnique) byType[m.type] = (byType[m.type] || 0) + 1;

const outJson = {
  source: parsed.source,
  version: parsed.version,
  customVersion: parsed.customVersion,
  krItemCount: parsed.items.length,
  ourItemCount: ours.length,
  matchedByImageOrShape: matched.length,
  missingTotal: missing.length,
  missingGear: missingGear.length,
  missingGearUnique: missingGearUnique.length,
  missingOther: missingOther.length,
  missingGearByType: byType,
  missingGearUniqueItems: missingGearUnique.map((m) => ({
    index: m.index,
    name: m.name,
    type: m.type,
    image: m.image,
    shape: m.shape,
    requiredAmount: m.requiredAmount,
    requiredClass: m.requiredClass,
    requiredGender: m.requiredGender,
    stats: {
      dc: [m.stats.minDC, m.stats.maxDC],
      mc: [m.stats.minMC, m.stats.maxMC],
      sc: [m.stats.minSC, m.stats.maxSC],
      ac: [m.stats.minAC, m.stats.maxAC],
      mac: [m.stats.minMAC, m.stats.maxMAC],
      accuracy: m.stats.accuracy,
      agility: m.stats.agility,
      hp: m.stats.hp,
      mp: m.stats.mp,
      luck: m.stats.luck,
      attackSpeed: m.stats.attackSpeed,
    },
    price: m.price,
    tooltip: m.tooltip,
    iconLocal: iconRelForFrame(m.image),
  })),
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
const jsonPath = path.join(root, "docs/kr-mirdb-items-diff.json");
fs.writeFileSync(jsonPath, JSON.stringify(outJson, null, 2));

const cards = missingGearUnique
  .map((m) => {
    const icon = iconRelForFrame(m.image);
    const img = icon
      ? `<img class="icon" src="${esc(icon)}" alt="" loading="lazy" />`
      : `<div class="icon missing">#${m.image}</div>`;
    return `<article class="card" data-type="${esc(m.type)}">
  ${img}
  <div class="body">
    <div class="type">${esc(m.type)} · Lv${m.requiredAmount}</div>
    <h3>${esc(m.name)}</h3>
    <div class="meta">KR #${m.index} · Image ${m.image} · Shape ${m.shape}</div>
    <div class="stats">${esc(statsLine(m))}</div>
    ${m.tooltip ? `<div class="tip">${esc(m.tooltip)}</div>` : ""}
  </div>
</article>`;
  })
  .join("\n");

const typeFilters = Object.keys(byType)
  .sort()
  .map((t) => `<button type="button" data-filter="${esc(t)}">${esc(t)} (${byType[t]})</button>`)
  .join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>KR MirDB items missing from LOM Idle</title>
<style>
  :root { --bg:#14110e; --panel:#1e1a16; --ink:#f3ebe2; --muted:#a89a8c; --line:#3a322b; --accent:#c4a574; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.45 "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  header { padding:24px 28px 12px; border-bottom:1px solid var(--line); background:linear-gradient(180deg,#221c17,var(--bg)); }
  h1 { margin:0 0 8px; font-size:1.45rem; font-weight:650; }
  .sub { color:var(--muted); max-width:70rem; }
  .sub code { color:var(--accent); }
  .stats-bar { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0 8px; }
  .pill { background:var(--panel); border:1px solid var(--line); border-radius:999px; padding:4px 12px; color:var(--muted); }
  .pill b { color:var(--ink); font-weight:600; }
  .filters { display:flex; flex-wrap:wrap; gap:8px; padding:12px 28px; position:sticky; top:0; background:rgba(20,17,14,.92); backdrop-filter:blur(6px); border-bottom:1px solid var(--line); z-index:2; }
  .filters button { background:var(--panel); color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:6px 10px; cursor:pointer; }
  .filters button.active, .filters button:hover { border-color:var(--accent); color:var(--accent); }
  main { padding:20px 28px 48px; display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
  .card { display:flex; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px; }
  .icon { width:48px; height:48px; image-rendering:pixelated; background:#0c0a08; border:1px solid var(--line); border-radius:6px; flex:0 0 auto; object-fit:contain; }
  .icon.missing { display:grid; place-items:center; font-size:11px; color:var(--muted); }
  h3 { margin:0 0 4px; font-size:1rem; font-weight:650; word-break:break-word; }
  .type { color:var(--accent); font-size:12px; margin-bottom:2px; }
  .meta, .stats, .tip { color:var(--muted); font-size:12px; }
  .tip { margin-top:6px; white-space:pre-wrap; }
  .note { padding:0 28px 20px; color:var(--muted); }
</style>
</head>
<body>
<header>
  <h1>Korean Server items not in LOM Idle</h1>
  <p class="sub">
    Source: <code>${esc(parsed.source)}</code> (DB v${parsed.version}, custom ${parsed.customVersion}).
    Matched by inventory <b>Image/frame</b> (fallback: weapon/armour <b>Shape</b> ↔ <code>visual.index</code>).
    Korean names are labels only — matching is by icon/shape ids.
  </p>
  <div class="stats-bar">
    <span class="pill">KR items <b>${parsed.items.length}</b></span>
    <span class="pill">Ours <b>${ours.length}</b></span>
    <span class="pill">Matched <b>${matched.length}</b></span>
    <span class="pill">Missing gear (unique) <b>${missingGearUnique.length}</b></span>
    <span class="pill">Missing non-gear <b>${missingOther.length}</b></span>
  </div>
</header>
<div class="filters">
  <button type="button" class="active" data-filter="all">All gear (${missingGearUnique.length})</button>
  ${typeFilters}
</div>
<p class="note">Icons load from local Crystal frames when that Image id exists in <code>public/item-icons</code> / <code>tile-review</code>. Blank = frame not extracted yet (often KR-only high indexes).</p>
<main>
${cards}
</main>
<script>
const buttons = [...document.querySelectorAll('.filters button')];
const cards = [...document.querySelectorAll('.card')];
buttons.forEach((btn) => btn.addEventListener('click', () => {
  buttons.forEach((b) => b.classList.toggle('active', b === btn));
  const f = btn.dataset.filter;
  cards.forEach((c) => { c.style.display = f === 'all' || c.dataset.type === f ? '' : 'none'; });
}));
</script>
</body>
</html>
`;

const htmlPath = path.join(root, "docs/kr-mirdb-items-missing.html");
fs.writeFileSync(htmlPath, html);

console.log("\nMissing gear by type:");
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t}: ${n}`);
}
console.log(`\nMatched ${matched.length} / ${parsed.items.length}`);
console.log(`Wrote ${path.relative(root, jsonPath)}`);
console.log(`Wrote ${path.relative(root, htmlPath)}`);
console.log(`Preview: http://localhost:4177/docs/kr-mirdb-items-missing.html`);

const interesting = missingGearUnique
  .filter((m) =>
    ["Weapon", "Armour", "Helmet", "Necklace", "Bracelet", "Ring"].includes(m.type),
  )
  .filter(
    (m) =>
      m.requiredAmount >= 30 ||
      m.stats.maxDC >= 20 ||
      m.stats.maxMC >= 20 ||
      m.stats.maxSC >= 20 ||
      m.stats.maxAC >= 12,
  )
  .slice(0, 50);
console.log(`\nSample notable missing gear (${interesting.length}):`);
for (const m of interesting) {
  console.log(
    `  [${m.type}] img ${m.image} shape ${m.shape} Lv${m.requiredAmount} ${m.name} — ${statsLine(m)}${iconRelForFrame(m.image) ? "" : " (no local icon)"}`,
  );
}
