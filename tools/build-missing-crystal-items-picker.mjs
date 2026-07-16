/**
 * Build an interactive picker of Crystal items not yet in LOM Idle.
 *
 * Usage: npm run build:missing-items-picker
 * Open:  tile-review/missing-crystal-items/index.html
 *
 * Select items, then Download selection JSON. Pass that file to
 *   npm run apply:missing-items-selection -- path/to/selection.json
 * to add them into src/data/items.json.
 */
import fs from "node:fs";
import path from "node:path";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalPath = path.join(root, "src/data/crystal-items.json");
const itemsPath = path.join(root, "src/data/items.json");
const outDir = path.join(root, "tile-review/missing-crystal-items");
const publicIconRoot = path.join(root, "public/item-icons/items");

const ASSASSIN = 8;
const ARCHER = 16;

const JUNK_TYPES = new Set([
  "Quest",
  "Nothing",
  "Transform",
  "Script",
  "Mount",
  "Meat",
  "Fish",
  "Food",
  "Float",
  "Bait",
  "Finder",
  "Reel",
  "Saddle",
  "Hook",
  "SealedHero",
  "Reins",
  "Ribbon",
  "Bells",
  "Pets",
  "Awakening",
]);

const GEAR_TYPES = new Set(["Weapon", "Armour"]);

const ACCESSORY_TYPES = new Set([
  "Necklace",
  "Bracelet",
  "Ring",
  "Helmet",
  "Boots",
  "Belt",
  "Torch",
  "Amulet",
  "Mask",
  "Stone",
  "Gem",
]);

const requirementTypes = {
  0: "level",
  1: "maxAC",
  2: "maxAMC",
  3: "maxDC",
  4: "maxMC",
  5: "maxSC",
  6: "maxLevel",
  7: "minAC",
  8: "minAMC",
  9: "minDC",
  10: "minMC",
  11: "minSC",
};

const classLabels = {
  warrior: { label: "Warrior", color: "#e07a5f" },
  wizard: { label: "Wizard", color: "#6ea8fe" },
  taoist: { label: "Taoist", color: "#7dcea0" },
  hybrid: { label: "Hybrid", color: "#d4b86a" },
  other: { label: "Other", color: "#a8a29e" },
};

function displayName(name) {
  return String(name)
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function crystalFamily(name) {
  return String(name)
    .replace(/\(M\)|\(F\)/gi, "")
    .replace(/\(\?\)/g, "")
    .replace(/\d+$/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function statRange(range) {
  const min = Number(range?.[0] ?? 0);
  const max = Number(range?.[1] ?? 0);
  if (min === 0 && max === 0) return "";
  if (min === max) return String(min);
  return `${min}-${max}`;
}

function statMax(range) {
  return Math.max(Number(range?.[0] ?? 0), Number(range?.[1] ?? 0));
}

function power(item) {
  const s = item.stats ?? {};
  let p = 0;
  for (const k of ["ac", "amc", "dc", "mc", "sc"]) {
    const v = s[k];
    if (Array.isArray(v)) p += (Number(v[0]) || 0) + (Number(v[1]) || 0);
    else p += Number(v) || 0;
  }
  for (const k of ["hp", "mp", "accuracy", "agility", "luck", "attackSpeed"]) {
    p += Number(s[k]) || 0;
  }
  return p;
}

function classFromMask(mask) {
  if (mask === 1) return "warrior";
  if (mask === 2) return "wizard";
  if (mask === 4) return "taoist";
  return null;
}

function primaryStatClass(item) {
  const locked = classFromMask(Number(item.requiredClass) || 31);
  if (locked) return locked;
  const dc = statMax(item.stats?.dc);
  const mc = statMax(item.stats?.mc);
  const sc = statMax(item.stats?.sc);
  const peak = Math.max(dc, mc, sc);
  if (peak > 0) {
    const winners = [];
    if (dc === peak) winners.push("warrior");
    if (mc === peak) winners.push("wizard");
    if (sc === peak) winners.push("taoist");
    if (winners.length === 1) return winners[0];
    return "hybrid";
  }
  return "other";
}

function requirementLabel(item) {
  const type = requirementTypes[item.requiredType] ?? "none";
  const amount = Number(item.requiredAmount) || 0;
  if (amount <= 0 || type === "none") return "";
  if (type === "level") return `Lv ${amount}`;
  return `${type} ${amount}`;
}

function statsSummary(item) {
  const s = item.stats ?? {};
  const parts = [];
  for (const [key, label] of [
    ["dc", "DC"],
    ["mc", "MC"],
    ["sc", "SC"],
    ["ac", "AC"],
    ["amc", "AMC"],
  ]) {
    const range = statRange(s[key]);
    if (range) parts.push(`${label} ${range}`);
  }
  if (s.hp) parts.push(`HP +${s.hp}`);
  if (s.mp) parts.push(`MP +${s.mp}`);
  if (s.accuracy) parts.push(`Acc +${s.accuracy}`);
  if (s.agility) parts.push(`Agi +${s.agility}`);
  if (s.luck) parts.push(`Luck +${s.luck}`);
  if (s.attackSpeed) parts.push(`ASpeed ${s.attackSpeed}`);
  return parts.join(", ");
}

function iconHref(frame) {
  if (!frame) return "";
  const file = frameFileName(frame);
  const publicPath = path.join(publicIconRoot, file);
  if (fs.existsSync(publicPath)) return `../../public/item-icons/items/${file}`;
  const reviewPath = reviewIconSourcePath(root, frame);
  if (reviewPath) return path.relative(outDir, reviewPath).split(path.sep).join("/");
  return "";
}

function isAssassinOrArcherOnly(item) {
  const rc = Number(item.requiredClass) || 0;
  if (rc === ASSASSIN || rc === ARCHER) return true;
  const hasWwt = (rc & 7) !== 0;
  const hasAa = (rc & (ASSASSIN | ARCHER)) !== 0;
  if (hasAa && !hasWwt && rc !== 31) return true;
  const n = String(item.name).toLowerCase();
  return /assassin|archer|crossbow|\bbow\b|shuriken|ninja/.test(n);
}

function looksKoreanJunk(name) {
  return /\(\?\)|Gonryun|Yeoseon|Sanggwan|pasackle|Yeongok|Nokyoung|Hwayoung|drama/i.test(name);
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const crystalItems = JSON.parse(fs.readFileSync(crystalPath, "utf8")).items;
const gameItems = JSON.parse(fs.readFileSync(itemsPath, "utf8")).items;

const gameByCrystalIndex = new Set();
const gameByCrystalName = new Set();
for (const g of gameItems) {
  if (g.source?.crystalIndex != null) gameByCrystalIndex.add(Number(g.source.crystalIndex));
  if (g.source?.name) gameByCrystalName.add(normalizeKey(g.source.name));
  if (g.name) gameByCrystalName.add(normalizeKey(g.name));
}

const rows = [];
for (const item of crystalItems) {
  const idx = Number(item.crystalIndex);
  if (gameByCrystalIndex.has(idx)) continue;
  if (gameByCrystalName.has(normalizeKey(item.name))) continue;

  const frame = Number(item.icon?.frame) || 0;
  const statClass = primaryStatClass(item);
  const reqLevel = Number(item.requiredAmount) || 0;
  const itemPower = power(item);
  const type = item.type || "Unknown";

  rows.push({
    crystalIndex: idx,
    crystalName: item.name,
    displayName: displayName(item.name),
    family: crystalFamily(item.name),
    type,
    grade: Number(item.grade) || 0,
    statClass,
    statClassLabel: classLabels[statClass]?.label ?? "Other",
    requirement: requirementLabel(item),
    reqLevel,
    reqType: requirementTypes[item.requiredType] ?? "none",
    requiredClass: Number(item.requiredClass) || 31,
    stats: statsSummary(item),
    power: itemPower,
    price: Number(item.price) || 0,
    frame,
    icon: iconHref(frame),
    isGear: GEAR_TYPES.has(type),
    isAccessory: ACCESSORY_TYPES.has(type),
    isJunkType: JUNK_TYPES.has(type),
    isAssassinArcher: isAssassinOrArcherOnly(item),
    isKoreanJunk: looksKoreanJunk(item.name),
    hasStats: itemPower > 0,
  });
}

rows.sort((a, b) => b.reqLevel - a.reqLevel || b.power - a.power || a.displayName.localeCompare(b.displayName));

const typeCounts = {};
for (const row of rows) typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1;

const payload = {
  generatedAt: new Date().toISOString(),
  gameItemCount: gameItems.length,
  crystalItemCount: crystalItems.length,
  missingCount: rows.length,
  typeCounts,
  classLabels,
  junkTypes: [...JUNK_TYPES],
  accessoryTypes: [...ACCESSORY_TYPES],
  rows,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "catalog.json"), `${JSON.stringify(payload, null, 2)}\n`);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Missing Crystal Items Picker</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f1115;
        --panel: #171a21;
        --line: #2d3340;
        --text: #e8eaed;
        --muted: #9aa3b2;
        --accent: #7eb6ff;
        --ok: #86efac;
        --warn: #f2cc60;
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font: 13px/1.45 Segoe UI, system-ui, sans-serif; }
      header {
        position: sticky; top: 0; z-index: 20;
        background: #12151b; border-bottom: 1px solid var(--line);
        padding: 14px 18px 12px;
      }
      h1 { margin: 0 0 4px; font-size: 22px; }
      .sub { margin: 0; color: var(--muted); max-width: 1100px; }
      .stats { margin-top: 8px; color: #c6d0df; font-size: 12px; }
      .controls { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; margin-top: 12px; }
      .controls input[type="search"],
      .controls input[type="number"],
      .controls select {
        background: #222833; color: var(--text); border: 1px solid #3a4354;
        border-radius: 4px; padding: 6px 10px;
      }
      #search { min-width: 260px; }
      .controls label.check {
        display: inline-flex; align-items: center; gap: 6px;
        color: #c6d0df; font-size: 12px; user-select: none;
      }
      .pill {
        border: 1px solid #3a4354; background: #222833; color: #eee;
        padding: 6px 12px; border-radius: 999px; cursor: pointer;
      }
      .pill.active { border-color: #7a879c; background: #2b3342; }
      .pill.warrior.active { border-color: #e07a5f; background: #3a221c; }
      .pill.wizard.active { border-color: #6ea8fe; background: #1a2740; }
      .pill.taoist.active { border-color: #7dcea0; background: #1a2e22; }
      .pill.hybrid.active { border-color: #d4b86a; background: #2e2818; }
      .selection-bar {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
        margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line);
      }
      .selection-bar .count { font-weight: 600; color: var(--accent); min-width: 110px; }
      .btn {
        border: 1px solid #3a4354; background: #2a3344; color: #eee;
        padding: 7px 12px; border-radius: 6px; cursor: pointer; font: inherit;
      }
      .btn:hover { background: #344056; }
      .btn.primary { background: #2d4a72; border-color: #4a6fa0; }
      .btn.primary:hover { background: #355785; }
      .btn.danger { background: #3a2424; border-color: #6a3a3a; }
      .layout { display: grid; grid-template-columns: 220px 1fr; min-height: calc(100vh - 190px); }
      aside { border-right: 1px solid var(--line); background: #141820; padding: 12px; overflow: auto; }
      aside h2 { margin: 0 0 8px; font-size: 13px; color: #ddd; text-transform: uppercase; letter-spacing: 0.04em; }
      .type-btn {
        display: block; width: 100%; text-align: left; border: 1px solid transparent;
        background: transparent; color: #ccc; padding: 6px 8px; border-radius: 4px;
        cursor: pointer; margin-bottom: 3px; font: inherit;
      }
      .type-btn:hover { background: #222833; }
      .type-btn.active { background: #262d3a; border-color: #555; color: #fff; }
      .type-btn .n { float: right; color: var(--muted); }
      main { overflow: auto; padding: 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #232833; padding: 7px 10px; vertical-align: middle; text-align: left; }
      th {
        position: sticky; top: 0; z-index: 5; background: #181c24;
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #9aa3b2;
      }
      tr:hover td { background: #1a1f29; }
      tr.selected td { background: #1c2838; }
      .icon { width: 32px; height: 32px; object-fit: contain; image-rendering: pixelated; background: #090b10; border: 1px solid #333; }
      .icon.missing { display: inline-block; width: 32px; height: 32px; background: #151820; border: 1px dashed #333; }
      .name { font-weight: 600; }
      .code { color: #94a3b8; font-size: 11px; }
      .badge {
        display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 999px;
        margin-right: 4px; border: 1px solid #3a4354; color: #c6d0df;
      }
      .badge.warn { border-color: #6a5530; color: var(--warn); background: #2a2418; }
      .class-warrior { color: #f4a261; }
      .class-wizard { color: #90caf9; }
      .class-taoist { color: #81c784; }
      .class-hybrid { color: #f2cc60; }
      .class-other { color: #bdbdbd; }
      .empty { padding: 48px; color: var(--muted); text-align: center; }
      .family-link {
        border: 0; background: transparent; color: var(--accent); cursor: pointer;
        font: inherit; padding: 0; text-decoration: underline; text-underline-offset: 2px;
      }
      @media (max-width: 900px) {
        .layout { grid-template-columns: 1fr; }
        aside { border-right: 0; border-bottom: 1px solid var(--line); max-height: 180px; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Missing Crystal Items</h1>
      <p class="sub">
        Crystal items not yet in LOM Idle. Tick what you want, then download a selection JSON
        (or copy Crystal indices) and pass it back to add them.
      </p>
      <p class="stats" id="summary"></p>
      <div class="controls">
        <input id="search" type="search" placeholder="Search name, family, stats…" />
        <label>Min lv <input id="minLevel" type="number" min="0" max="99" value="40" style="width:64px" /></label>
        <select id="sort">
          <option value="level-desc">Level (high → low)</option>
          <option value="level">Level (low → high)</option>
          <option value="power-desc">Power (high → low)</option>
          <option value="name">Name</option>
          <option value="type">Type → Level</option>
          <option value="family">Family → Level</option>
        </select>
        <button type="button" class="pill active" data-class="all">All classes</button>
        <button type="button" class="pill warrior" data-class="warrior">Warrior</button>
        <button type="button" class="pill wizard" data-class="wizard">Wizard</button>
        <button type="button" class="pill taoist" data-class="taoist">Taoist</button>
        <button type="button" class="pill hybrid" data-class="hybrid">Hybrid</button>
        <button type="button" class="pill other" data-class="other">Other</button>
        <label class="check"><input id="hideGear" type="checkbox" checked /> Hide weapons &amp; armour</label>
        <label class="check"><input id="hideJunk" type="checkbox" checked /> Hide junk types</label>
        <label class="check"><input id="hideAa" type="checkbox" checked /> Hide Assassin/Archer</label>
        <label class="check"><input id="hideKorean" type="checkbox" checked /> Hide Korean/junk names</label>
        <label class="check"><input id="hideEmpty" type="checkbox" checked /> Hide empty stats</label>
        <label class="check"><input id="accessoriesOnly" type="checkbox" /> Accessories only</label>
      </div>
      <div class="selection-bar">
        <span class="count" id="selCount">0 selected</span>
        <button type="button" class="btn" id="selectVisible">Select visible</button>
        <button type="button" class="btn" id="clearVisible">Clear visible</button>
        <button type="button" class="btn danger" id="clearAll">Clear all</button>
        <button type="button" class="btn primary" id="downloadJson">Download selection JSON</button>
        <button type="button" class="btn" id="copyIndices">Copy Crystal indices</button>
        <button type="button" class="btn" id="downloadCsv">Download CSV</button>
      </div>
    </header>
    <div class="layout">
      <aside>
        <h2>Types</h2>
        <div id="typeList"></div>
      </aside>
      <main>
        <table>
          <thead>
            <tr>
              <th style="width:36px"><input type="checkbox" id="headerCheck" title="Select / clear visible" /></th>
              <th style="width:40px"></th>
              <th>Item</th>
              <th>Type</th>
              <th>Class</th>
              <th>Req</th>
              <th>Stats</th>
              <th>Family</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
        <div class="empty" id="empty" hidden>No items match the current filters.</div>
      </main>
    </div>
    <script>
      const STORAGE_KEY = "lom-missing-crystal-selection-v1";
      const DATA = ${JSON.stringify(payload)};

      const state = {
        type: "all",
        className: "all",
        search: "",
        minLevel: 40,
        sort: "level-desc",
        hideGear: true,
        hideJunk: true,
        hideAa: true,
        hideKorean: true,
        hideEmpty: true,
        accessoriesOnly: false,
      };

      const selected = new Set(loadSelection());

      const summaryEl = document.getElementById("summary");
      const rowsEl = document.getElementById("rows");
      const emptyEl = document.getElementById("empty");
      const selCountEl = document.getElementById("selCount");
      const typeListEl = document.getElementById("typeList");
      const headerCheck = document.getElementById("headerCheck");

      function loadSelection() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.map(Number).filter((n) => !Number.isNaN(n)) : [];
        } catch {
          return [];
        }
      }

      function saveSelection() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
        selCountEl.textContent = selected.size + " selected";
      }

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[ch]));
      }

      function filteredRows() {
        let list = DATA.rows.slice();
        if (state.type !== "all") list = list.filter((r) => r.type === state.type);
        if (state.className !== "all") list = list.filter((r) => r.statClass === state.className);
        if (state.hideGear) list = list.filter((r) => !r.isGear);
        if (state.hideJunk) list = list.filter((r) => !r.isJunkType);
        if (state.hideAa) list = list.filter((r) => !r.isAssassinArcher);
        if (state.hideKorean) list = list.filter((r) => !r.isKoreanJunk);
        if (state.hideEmpty) list = list.filter((r) => r.hasStats);
        if (state.accessoriesOnly) list = list.filter((r) => r.isAccessory);
        if (state.minLevel > 0) list = list.filter((r) => r.reqLevel >= state.minLevel);
        const q = state.search.trim().toLowerCase();
        if (q) {
          list = list.filter((r) =>
            [r.displayName, r.crystalName, r.family, r.stats, r.type, String(r.crystalIndex)]
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }
        if (state.sort === "level") list.sort((a, b) => a.reqLevel - b.reqLevel || a.displayName.localeCompare(b.displayName));
        if (state.sort === "level-desc") list.sort((a, b) => b.reqLevel - a.reqLevel || b.power - a.power || a.displayName.localeCompare(b.displayName));
        if (state.sort === "power-desc") list.sort((a, b) => b.power - a.power || b.reqLevel - a.reqLevel || a.displayName.localeCompare(b.displayName));
        if (state.sort === "name") list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (state.sort === "type") list.sort((a, b) => a.type.localeCompare(b.type) || b.reqLevel - a.reqLevel || a.displayName.localeCompare(b.displayName));
        if (state.sort === "family") list.sort((a, b) => a.family.localeCompare(b.family) || b.reqLevel - a.reqLevel || a.displayName.localeCompare(b.displayName));
        return list;
      }

      function selectedRows() {
        const byIdx = new Map(DATA.rows.map((r) => [r.crystalIndex, r]));
        return [...selected].map((idx) => byIdx.get(idx)).filter(Boolean)
          .sort((a, b) => b.reqLevel - a.reqLevel || a.displayName.localeCompare(b.displayName));
      }

      function selectionPayload() {
        const items = selectedRows();
        return {
          generatedAt: new Date().toISOString(),
          sourceCatalog: DATA.generatedAt,
          count: items.length,
          crystalIndexes: items.map((r) => r.crystalIndex),
          crystalNames: items.map((r) => r.crystalName),
          items: items.map((r) => ({
            crystalIndex: r.crystalIndex,
            crystalName: r.crystalName,
            displayName: r.displayName,
            type: r.type,
            family: r.family,
            reqLevel: r.reqLevel,
            requirement: r.requirement,
            stats: r.stats,
            statClass: r.statClass,
            grade: r.grade,
            frame: r.frame,
          })),
        };
      }

      function downloadBlob(filename, text, mime) {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      function renderTypes() {
        const counts = {};
        for (const row of DATA.rows) {
          if (state.hideGear && row.isGear) continue;
          if (state.hideJunk && row.isJunkType) continue;
          if (state.hideAa && row.isAssassinArcher) continue;
          if (state.hideKorean && row.isKoreanJunk) continue;
          counts[row.type] = (counts[row.type] ?? 0) + 1;
        }
        const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
        typeListEl.innerHTML = [
          '<button type="button" class="type-btn' + (state.type === "all" ? " active" : "") + '" data-type="all">All types <span class="n">' +
            Object.values(counts).reduce((a, b) => a + b, 0) + "</span></button>",
          ...types.map((type) =>
            '<button type="button" class="type-btn' + (state.type === type ? " active" : "") + '" data-type="' + escapeHtml(type) + '">' +
              escapeHtml(type) + ' <span class="n">' + counts[type] + "</span></button>",
          ),
        ].join("");
        typeListEl.querySelectorAll(".type-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            state.type = btn.dataset.type;
            render();
          });
        });
      }

      function rowHtml(row) {
        const checked = selected.has(row.crystalIndex) ? " checked" : "";
        const selectedClass = selected.has(row.crystalIndex) ? " selected" : "";
        const icon = row.icon
          ? '<img class="icon" src="' + escapeHtml(row.icon) + '" alt="" loading="lazy" />'
          : '<span class="icon missing" title="No local icon"></span>';
        const badges = [];
        if (row.grade >= 3) badges.push('<span class="badge">g' + row.grade + "</span>");
        if (row.isKoreanJunk) badges.push('<span class="badge warn">name?</span>');
        return (
          '<tr class="' + selectedClass + '" data-idx="' + row.crystalIndex + '">' +
            '<td><input type="checkbox" class="row-check" data-idx="' + row.crystalIndex + '"' + checked + " /></td>" +
            "<td>" + icon + "</td>" +
            "<td><div class=\\"name\\">" + escapeHtml(row.displayName) + "</div>" +
              '<div class="code">#' + row.crystalIndex + " · " + escapeHtml(row.crystalName) + "</div>" +
              badges.join("") + "</td>" +
            "<td>" + escapeHtml(row.type) + "</td>" +
            '<td class="class-' + row.statClass + '">' + escapeHtml(row.statClassLabel) + "</td>" +
            "<td>" + escapeHtml(row.requirement || "—") + "</td>" +
            "<td>" + escapeHtml(row.stats || "—") + "</td>" +
            '<td><button type="button" class="family-link" data-family="' + escapeHtml(row.family) + '" title="Select all visible in this family">' +
              escapeHtml(row.family || "—") + "</button></td>" +
          "</tr>"
        );
      }

      function render() {
        const list = filteredRows();
        summaryEl.textContent =
          list.length + " shown · " + DATA.missingCount + " missing total · " +
          DATA.gameItemCount + " already in game · " + DATA.crystalItemCount + " Crystal items · " +
          selected.size + " selected (saved in this browser)";
        rowsEl.innerHTML = list.map(rowHtml).join("");
        emptyEl.hidden = list.length > 0;
        headerCheck.checked = list.length > 0 && list.every((r) => selected.has(r.crystalIndex));
        headerCheck.indeterminate = list.some((r) => selected.has(r.crystalIndex)) && !headerCheck.checked;
        renderTypes();
        saveSelection();
      }

      function setSelected(indexes, on) {
        for (const idx of indexes) {
          if (on) selected.add(idx);
          else selected.delete(idx);
        }
        render();
      }

      rowsEl.addEventListener("change", (e) => {
        const t = e.target;
        if (!t.classList.contains("row-check")) return;
        const idx = Number(t.dataset.idx);
        if (t.checked) selected.add(idx);
        else selected.delete(idx);
        render();
      });

      rowsEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".family-link");
        if (!btn) return;
        const family = btn.dataset.family;
        const indexes = filteredRows().filter((r) => r.family === family).map((r) => r.crystalIndex);
        setSelected(indexes, true);
      });

      headerCheck.addEventListener("change", () => {
        const indexes = filteredRows().map((r) => r.crystalIndex);
        setSelected(indexes, headerCheck.checked);
      });

      document.getElementById("selectVisible").addEventListener("click", () => {
        setSelected(filteredRows().map((r) => r.crystalIndex), true);
      });
      document.getElementById("clearVisible").addEventListener("click", () => {
        setSelected(filteredRows().map((r) => r.crystalIndex), false);
      });
      document.getElementById("clearAll").addEventListener("click", () => {
        selected.clear();
        render();
      });

      document.getElementById("downloadJson").addEventListener("click", () => {
        if (!selected.size) {
          alert("No items selected.");
          return;
        }
        const payload = selectionPayload();
        downloadBlob(
          "missing-crystal-selection.json",
          JSON.stringify(payload, null, 2) + "\\n",
          "application/json",
        );
      });

      document.getElementById("copyIndices").addEventListener("click", async () => {
        if (!selected.size) {
          alert("No items selected.");
          return;
        }
        const text = selectionPayload().crystalIndexes.join(", ");
        try {
          await navigator.clipboard.writeText(text);
          alert("Copied " + selected.size + " Crystal indices to clipboard.");
        } catch {
          prompt("Copy these indices:", text);
        }
      });

      document.getElementById("downloadCsv").addEventListener("click", () => {
        if (!selected.size) {
          alert("No items selected.");
          return;
        }
        const items = selectedRows();
        const headers = ["Crystal Index", "Crystal Name", "Display Name", "Type", "Family", "Requirement", "Stats", "Class", "Grade", "Frame"];
        const lines = [
          headers.join(","),
          ...items.map((r) =>
            [r.crystalIndex, r.crystalName, r.displayName, r.type, r.family, r.requirement, r.stats, r.statClassLabel, r.grade, r.frame]
              .map((v) => {
                const s = String(v ?? "");
                return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
              })
              .join(","),
          ),
        ];
        downloadBlob("missing-crystal-selection.csv", lines.join("\\n") + "\\n", "text/csv");
      });

      document.getElementById("search").addEventListener("input", (e) => {
        state.search = e.target.value;
        render();
      });
      document.getElementById("minLevel").addEventListener("input", (e) => {
        state.minLevel = Math.max(0, Number(e.target.value) || 0);
        render();
      });
      document.getElementById("sort").addEventListener("change", (e) => {
        state.sort = e.target.value;
        render();
      });
      for (const id of ["hideGear", "hideJunk", "hideAa", "hideKorean", "hideEmpty", "accessoriesOnly"]) {
        document.getElementById(id).addEventListener("change", (e) => {
          state[id] = e.target.checked;
          render();
        });
      }
      document.querySelectorAll(".pill[data-class]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.className = btn.dataset.class;
          document.querySelectorAll(".pill[data-class]").forEach((el) => el.classList.toggle("active", el === btn));
          render();
        });
      });

      render();
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), html);

console.log(`Wrote ${rows.length} missing items to ${path.relative(root, outDir)}`);
console.log(`  Open: tile-review/missing-crystal-items/index.html`);
console.log(`  Types:`, Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, n]) => `${t}:${n}`).join(", "));
