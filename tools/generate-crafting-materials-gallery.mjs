/**
 * Builds tools/crafting-materials-gallery/index.html with icons for Crystal
 * crafting-related items (ores, materials, gems, stones, awakening, quest, food).
 *
 * Run: node tools/generate-crafting-materials-gallery.mjs
 * Open: http://localhost:4177/tools/crafting-materials-gallery/index.html
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyItemIcon, frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const exportPath = path.join(root, "tools/_tmp-crystal-items-export.json");
const outDir = path.join(root, "tools/crafting-materials-gallery");
const iconDir = path.join(outDir, "icons");

const TYPE_ORDER = [
  "Ore",
  "CraftingMaterial",
  "Gem",
  "Stone",
  "Awakening",
  "Quest",
  "Food",
  "Meat",
];

const CM_GROUPS = [
  {
    id: "crystals-books",
    label: "Crystals & craft books",
    match: (name) =>
      /crystal|translucent|armourbook|bookof|armourcast|craftingbook|rustyarmour/i.test(name),
  },
  {
    id: "marbles",
    label: "Stat marbles",
    match: (name) => /marble/i.test(name),
  },
  {
    id: "boss-rare",
    label: "Boss & rare drops",
    match: (name) =>
      /wooma|zuma|dragon|redmoon|evilage|deern|skystinger|redeye/i.test(name),
  },
  {
    id: "monster-parts",
    label: "Monster parts",
    match: (name) =>
      /spider|scorpion|maggot|bone|mandible|bug|cannibal|mushroom|ebony|cherry|chestnut/i.test(
        name,
      ),
  },
  {
    id: "threads-wood",
    label: "Thread, rope & wood",
    match: (name) => /thread|string|rope|timber|feather|mossy|healingletter/i.test(name),
  },
  {
    id: "leathers",
    label: "Leathers (frame 0 in Crystal)",
    match: (name) => /leather/i.test(name),
  },
  {
    id: "other-cm",
    label: "Other crafting materials",
    match: () => true,
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ensureIcon(frame) {
  const fileName = frameFileName(frame);
  const dest = path.join(iconDir, fileName);
  if (fs.existsSync(dest)) return { fileName, status: "ok" };
  if (frame === 0) return { fileName, status: "frame0" };
  const source = reviewIconSourcePath(root, frame);
  if (!source) return { fileName, status: "missing" };
  fs.mkdirSync(iconDir, { recursive: true });
  fs.copyFileSync(source, dest);
  return { fileName, status: "copied" };
}

function groupCraftingMaterials(items) {
  const assigned = new Set();
  const groups = [];
  for (const group of CM_GROUPS) {
    const rows = items.filter((item) => {
      if (assigned.has(item.name)) return false;
      if (!group.match(item.name)) return false;
      assigned.add(item.name);
      return true;
    });
    if (rows.length) groups.push({ ...group, items: rows });
  }
  return groups;
}

function renderCard(item, iconMeta) {
  const statusClass =
    iconMeta.status === "ok" || iconMeta.status === "copied"
      ? ""
      : ` card--${iconMeta.status}`;
  const img =
    iconMeta.status === "ok" || iconMeta.status === "copied"
      ? `<img src="./icons/${iconMeta.fileName}" alt="" loading="lazy" width="48" height="48">`
      : `<div class="card__placeholder" title="${escapeHtml(iconMeta.status)}">?</div>`;
  const badge =
    iconMeta.status === "missing"
      ? `<span class="card__badge">no file</span>`
      : iconMeta.status === "frame0"
        ? `<span class="card__badge">frame 0</span>`
        : "";
  return `<article class="card${statusClass}" data-name="${escapeHtml(item.name.toLowerCase())}" data-type="${escapeHtml(item.type)}">
    <div class="card__icon">${img}</div>
    <div class="card__body">
      <h3 class="card__name">${escapeHtml(item.name)}</h3>
      <p class="card__meta">${escapeHtml(item.type)} · frame ${item.icon?.frame ?? 0}</p>
      ${badge}
    </div>
  </article>`;
}

function renderSection(title, items, iconMap) {
  if (!items.length) return "";
  const cards = items
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => renderCard(item, iconMap.get(item.name)))
    .join("\n");
  return `<section class="section" data-section="${escapeHtml(title.toLowerCase())}">
    <h2 class="section__title">${escapeHtml(title)} <span class="section__count">${items.length}</span></h2>
    <div class="grid">${cards}</div>
  </section>`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  const allItems = data.items ?? data;
  const types = new Set(TYPE_ORDER);
  const picked = allItems.filter((item) => types.has(item.type));

  const iconMap = new Map();
  const frames = [...new Set(picked.map((item) => item.icon?.frame ?? 0))];
  const frameStatus = new Map();
  for (const frame of frames) {
    frameStatus.set(frame, ensureIcon(frame));
  }
  for (const item of picked) {
    iconMap.set(item.name, frameStatus.get(item.icon?.frame ?? 0));
  }

  const byType = Object.fromEntries(TYPE_ORDER.map((type) => [type, []]));
  for (const item of picked) byType[item.type].push(item);

  let sectionsHtml = "";
  sectionsHtml += renderSection("Ores", byType.Ore, iconMap);

  const cmGroups = groupCraftingMaterials(byType.CraftingMaterial);
  for (const group of cmGroups) {
    sectionsHtml += renderSection(`Crafting — ${group.label}`, group.items, iconMap);
  }

  sectionsHtml += renderSection("Gems & orbs", byType.Gem, iconMap);
  sectionsHtml += renderSection("Stones", byType.Stone, iconMap);
  sectionsHtml += renderSection("Awakening souls & glyphs", byType.Awakening, iconMap);
  sectionsHtml += renderSection("Quest items", byType.Quest, iconMap);
  sectionsHtml += renderSection("Food", byType.Food, iconMap);
  sectionsHtml += renderSection("Meat", byType.Meat, iconMap);

  const okCount = [...iconMap.values()].filter((s) => s.status === "ok" || s.status === "copied").length;
  const missingCount = picked.length - okCount;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Crystal crafting materials — icon gallery</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #12151c;
      --panel: #1b2130;
      --border: #2d3648;
      --text: #e8edf7;
      --muted: #9aa8c0;
      --accent: #c9a227;
      --missing: #8b3a3a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 system-ui, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .header {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 16px 20px;
      background: rgba(18, 21, 28, 0.94);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(8px);
    }
    .header h1 { margin: 0 0 6px; font-size: 20px; }
    .header p { margin: 0 0 12px; color: var(--muted); }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .toolbar input {
      min-width: 240px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
    }
    .stats { color: var(--muted); font-size: 13px; }
    main { padding: 20px; max-width: 1400px; margin: 0 auto; }
    .section { margin-bottom: 28px; }
    .section__title {
      margin: 0 0 12px;
      font-size: 16px;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section__count {
      font-size: 12px;
      color: var(--muted);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 10px;
    }
    .card {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      min-height: 72px;
    }
    .card--missing, .card--frame0 { border-color: var(--missing); }
    .card__icon {
      flex: 0 0 48px;
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      background: #0d1017;
      border-radius: 6px;
      border: 1px solid #000;
    }
    .card__icon img {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      max-width: 48px;
      max-height: 48px;
    }
    .card__placeholder {
      color: var(--muted);
      font-weight: 700;
      font-size: 18px;
    }
    .card__name { margin: 0; font-size: 13px; font-weight: 600; word-break: break-word; }
    .card__meta { margin: 4px 0 0; font-size: 11px; color: var(--muted); }
    .card__badge {
      display: inline-block;
      margin-top: 6px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #ffb4b4;
    }
    .card.hidden { display: none; }
    .section.hidden { display: none; }
  </style>
</head>
<body>
  <header class="header">
    <h1>Crystal crafting materials</h1>
    <p>From <code>tools/_tmp-crystal-items-export.json</code> — ores, crafting materials, gems, stones, awakening, quest, food & meat.</p>
    <div class="toolbar">
      <input id="filter" type="search" placeholder="Filter by name…" autofocus>
      <span class="stats">${picked.length} items · ${okCount} with icons · ${missingCount} missing / frame 0</span>
    </div>
  </header>
  <main id="gallery">
    ${sectionsHtml}
  </main>
  <script>
    const filter = document.getElementById("filter");
    filter.addEventListener("input", () => {
      const q = filter.value.trim().toLowerCase();
      document.querySelectorAll(".card").forEach((card) => {
        const name = card.dataset.name || "";
        card.classList.toggle("hidden", q && !name.includes(q));
      });
      document.querySelectorAll(".section").forEach((section) => {
        const visible = section.querySelectorAll(".card:not(.hidden)").length > 0;
        section.classList.toggle("hidden", !visible);
      });
    });
  </script>
</body>
</html>`;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

  const copied = [...frameStatus.values()].filter((s) => s.status === "copied").length;
  console.log(`Gallery: tools/crafting-materials-gallery/index.html`);
  console.log(`Icons: ${copied} copied, ${fs.readdirSync(iconDir).length} total in gallery folder`);
  console.log(`Open: http://localhost:4177/tools/crafting-materials-gallery/index.html`);
}

main();
