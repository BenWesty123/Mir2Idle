/**
 * Builds docs/glyph-amulet-preview.html — Crystal icon candidates for Glyphs / Amulets.
 *
 * Run: node tools/gen-glyph-amulet-preview.mjs
 * Open: http://localhost:4177/docs/glyph-amulet-preview.html
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const crystalPath = path.join(root, "src/data/crystal-items.json");
const outHtml = path.join(root, "docs/glyph-amulet-preview.html");
const iconDir = path.join(root, "docs/glyph-amulet-preview-icons");
const publicIconRoot = path.join(root, "public/item-icons/items");

const GLYPH_FAMILIES = [
  { id: "bravery", label: "Bravery (Warrior / DC)", shape: 0, theme: "#e07a5f" },
  { id: "magic", label: "Magic (Wizard / MC)", shape: 1, theme: "#6ea8fe" },
  { id: "soul", label: "Soul (Taoist / SC)", shape: 2, theme: "#7dcea0" },
  { id: "protection", label: "Protection (defence)", shape: 3, theme: "#c9b87a" },
  { id: "evilslayer", label: "Evil Slayer", shape: 4, theme: "#c77dff" },
  { id: "body", label: "Body (HP / survivability)", shape: 5, theme: "#f4a261" },
];

const GEM_ORB_FAMILIES = [
  "Bravery",
  "Magic",
  "Soul",
  "Protection",
  "EvilSlayer",
  "Durability",
  "Storm",
  "Agility",
  "Accuracy",
  "Poison",
  "Freezing",
  "Disillusion",
  "Endurance",
];

const STAT_STONE_BASES = [
  "HealthStone",
  "MagicStone",
  "PowerStone",
  "DCStone",
  "MCStone",
  "SCStone",
  "FrozenStone",
];

const AMULET_CANDIDATES = [
  "BluJadePendant",
  "Relics",
  "OldNecklace",
  "OliviasRing",
  "JadeRing",
  "SkeletonHead",
  "ZombieEye",
  "AncientBanga[Green]",
  "AncientBanga[Purple]",
  "ResurrectionScroll",
  "HavocCrystal",
  "Translucent",
  "BookofMana",
  "BookofSpirit",
  "SealedHero",
  "LeatherMask",
  "WhiteMask",
  "BlackMask",
  "SilverMask",
  "TitaniumMask",
  "BronzeBell",
  "SilverBell",
  "GoldBell",
  "GreenBell",
  "RedRibbon",
  "BlueRibbon",
  "BlackRibbon",
  "CharmRing",
  "SerpentEyeRing",
  "HornRing",
  "PearlRing",
  "SoulRing",
  "DragonRing",
  "RecallNecklace",
  "SpiritNecklace",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function displayName(name) {
  return name
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\[/g, " [")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureIcon(frame) {
  const fileName = frameFileName(frame);
  const dest = path.join(iconDir, fileName);
  if (fs.existsSync(dest)) return { fileName, status: "ok" };
  if (frame === 0) return { fileName, status: "frame0" };

  const publicPath = path.join(publicIconRoot, fileName);
  if (fs.existsSync(publicPath)) {
    fs.mkdirSync(iconDir, { recursive: true });
    fs.copyFileSync(publicPath, dest);
    return { fileName, status: "copied" };
  }

  const source = reviewIconSourcePath(root, frame);
  if (!source) return { fileName, status: "missing" };
  fs.mkdirSync(iconDir, { recursive: true });
  fs.copyFileSync(source, dest);
  return { fileName, status: "copied" };
}

function byName(items) {
  return new Map(items.map((item) => [item.name, item]));
}

function pickItems(allItems, names) {
  const map = byName(allItems);
  return names.map((name) => map.get(name)).filter(Boolean);
}

function renderCard(item, iconMeta, extra = "") {
  const frame = item.icon?.frame ?? 0;
  const statusClass =
    iconMeta.status === "ok" || iconMeta.status === "copied" ? "" : ` card--${iconMeta.status}`;
  const img =
    iconMeta.status === "ok" || iconMeta.status === "copied"
      ? `<img src="./glyph-amulet-preview-icons/${iconMeta.fileName}" alt="" loading="lazy" width="48" height="48">`
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
      <h3 class="card__name">${escapeHtml(displayName(item.name))}</h3>
      <p class="card__meta">${escapeHtml(item.type)} · idx ${item.crystalIndex} · frame ${frame}${extra}</p>
      ${badge}
    </div>
  </article>`;
}

function renderSection(title, subtitle, cardsHtml, attrs = "") {
  if (!cardsHtml) return "";
  const count = (cardsHtml.match(/class="card/g) ?? []).length;
  return `<section class="section" ${attrs}>
    <h2 class="section__title">${escapeHtml(title)} <span class="section__count">${count}</span></h2>
    ${subtitle ? `<p class="section__subtitle">${subtitle}</p>` : ""}
    <div class="grid">${cardsHtml}</div>
  </section>`;
}

function renderGlyphFamily(family, items, iconMap) {
  const prefix = {
    bravery: "Bravery",
    magic: "Magic",
    soul: "Soul",
    protection: "Protection",
    evilslayer: "EvilSlayer",
    body: "Body",
  }[family.id];
  const resolved = [0, 1, 2, 3]
    .map((tier) => items.find((item) => item.name === `${prefix}Glyph${tier}`))
    .filter(Boolean);

  const cards = resolved
    .map((item, tier) => renderCard(item, iconMap.get(item.name), ` · tier ${tier}`))
    .join("\n");
  return `<div class="glyph-family" style="--family-color:${family.theme}">
    <h3 class="glyph-family__title">${escapeHtml(family.label)}</h3>
    <div class="grid grid--glyph">${cards}</div>
  </div>`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(crystalPath, "utf8"));
  const allItems = data.items ?? data;
  const awakening = allItems.filter((item) => item.type === "Awakening");
  const glyphItems = awakening.filter((item) => /Glyph/.test(item.name));
  const soulItems = awakening
    .filter((item) => /AwakeningSoul/.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const gemItems = pickItems(
    allItems,
    GEM_ORB_FAMILIES.flatMap((family) => [`${family}Gem`, `${family}Orb`]),
  );
  const stoneItems = pickItems(allItems, STAT_STONE_BASES);
  const amuletItems = pickItems(allItems, AMULET_CANDIDATES);

  const usedItems = [...glyphItems, ...soulItems, ...gemItems, ...stoneItems, ...amuletItems];
  const iconMap = new Map();
  const frameStatus = new Map();
  for (const item of usedItems) {
    const frame = item.icon?.frame ?? 0;
    if (!frameStatus.has(frame)) frameStatus.set(frame, ensureIcon(frame));
    iconMap.set(item.name, frameStatus.get(frame));
  }

  const glyphFamiliesHtml = GLYPH_FAMILIES.map((family) =>
    renderGlyphFamily(family, glyphItems, iconMap),
  ).join("\n");

  const soulCards = soulItems
    .map((item) => {
      const tier = item.name.replace("AwakeningSoul", "");
      return renderCard(item, iconMap.get(item.name), ` · tier ${tier}`);
    })
    .join("\n");

  const gemOrbCards = gemItems
    .map((item) => renderCard(item, iconMap.get(item.name)))
    .join("\n");

  const stoneCards = stoneItems
    .map((item) => renderCard(item, iconMap.get(item.name)))
    .join("\n");

  const amuletCards = amuletItems
    .map((item) => renderCard(item, iconMap.get(item.name)))
    .join("\n");

  const okCount = [...iconMap.values()].filter(
    (s) => s.status === "ok" || s.status === "copied",
  ).length;
  const missingCount = usedItems.length - okCount;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Glyph &amp; Amulet icon preview — Crystal</title>
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
    .header p { margin: 0 0 12px; color: var(--muted); max-width: 72ch; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .toolbar input, .toolbar select {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
    }
    .toolbar input { min-width: 240px; }
    .stats { color: var(--muted); font-size: 13px; }
    main { padding: 20px; max-width: 1400px; margin: 0 auto; }
    .section { margin-bottom: 32px; }
    .section__title {
      margin: 0 0 8px;
      font-size: 17px;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section__subtitle {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 13px;
      max-width: 72ch;
    }
    .section__count {
      font-size: 12px;
      color: var(--muted);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 8px;
    }
    .glyph-family {
      margin-bottom: 18px;
      padding: 12px 14px 14px;
      background: rgba(27, 33, 48, 0.55);
      border: 1px solid var(--border);
      border-left: 3px solid var(--family-color, var(--accent));
      border-radius: 10px;
    }
    .glyph-family__title {
      margin: 0 0 10px;
      font-size: 14px;
      color: var(--family-color, var(--text));
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 10px;
    }
    .grid--glyph {
      grid-template-columns: repeat(4, minmax(180px, 1fr));
    }
    @media (max-width: 900px) {
      .grid--glyph { grid-template-columns: repeat(2, minmax(160px, 1fr)); }
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
    .card.hidden, .section.hidden, .glyph-family.hidden { display: none; }
    .note {
      margin: 0 0 20px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--muted);
      font-size: 13px;
    }
    .note strong { color: var(--text); }
  </style>
</head>
<body>
  <header class="header">
    <h1>Glyph &amp; Amulet icon preview</h1>
    <p>Crystal <code>Items</code> library candidates for unique-stat gear (not Tao amulets). Regenerate with <code>node tools/gen-glyph-amulet-preview.mjs</code>.</p>
    <div class="toolbar">
      <input id="filter" type="search" placeholder="Filter by name…" autofocus>
      <select id="sectionFilter" aria-label="Section filter">
        <option value="">All sections</option>
        <option value="glyphs">Awakening Glyphs</option>
        <option value="souls">Awakening Souls</option>
        <option value="gems">Gems &amp; Orbs</option>
        <option value="stones">Stat Stones</option>
        <option value="amulets">Amulet candidates</option>
      </select>
      <span class="stats">${usedItems.length} items · ${okCount} with icons · ${missingCount} missing</span>
    </div>
  </header>
  <main id="gallery">
    <p class="note"><strong>Glyphs</strong> (frames 3200–3223) are the most on-theme pick. <strong>Amulet candidates</strong> borrow quest, mask, bell, ribbon, and jewellery icons — Crystal’s <code>Amulet</code> type is only Tao amulet / poison / revival.</p>

    <section class="section" data-section="glyphs">
      <h2 class="section__title">Awakening Glyphs <span class="section__count">${glyphItems.length}</span></h2>
      <p class="section__subtitle">Six themed families × four tiers. Shape id maps to stat theme in Crystal awakening.</p>
      ${glyphFamiliesHtml}
    </section>

    ${renderSection(
      "Awakening Souls",
      "Orb-like soul icons (frames 3224–3227) — good for a rare tier above glyphs.",
      soulCards,
      'data-section="souls"',
    )}

    ${renderSection(
      "Gems & Orbs",
      "Crafting empower icons — gem (shape 3) and orb (shape 4) variants per stat family.",
      gemOrbCards,
      'data-section="gems"',
    )}

    ${renderSection(
      "Stat Stones",
      "Base stone icons (unsized) — may suit a stone equip slot with unique flat stats.",
      stoneCards,
      'data-section="stones"',
    )}

    ${renderSection(
      "Amulet & charm candidates",
      "Pendants, relics, masks, bells, ribbons, and small jewellery — not Crystal Amulet type.",
      amuletCards,
      'data-section="amulets"',
    )}
  </main>
  <script>
    const filter = document.getElementById("filter");
    const sectionFilter = document.getElementById("sectionFilter");
    function applyFilters() {
      const q = filter.value.trim().toLowerCase();
      const section = sectionFilter.value;
      document.querySelectorAll(".card").forEach((card) => {
        const name = card.dataset.name || "";
        const inSection = !section || card.closest('[data-section="' + section + '"]');
        card.classList.toggle("hidden", (q && !name.includes(q)) || !inSection);
      });
      document.querySelectorAll(".glyph-family").forEach((block) => {
        const visible = block.querySelectorAll(".card:not(.hidden)").length > 0;
        block.classList.toggle("hidden", !visible);
      });
      document.querySelectorAll(".section").forEach((sectionEl) => {
        const key = sectionEl.dataset.section || "";
        if (section && key && key !== section) {
          sectionEl.classList.add("hidden");
          return;
        }
        if (section && key === section) {
          sectionEl.classList.remove("hidden");
          return;
        }
        const visible = sectionEl.querySelectorAll(".card:not(.hidden), .glyph-family:not(.hidden)").length > 0;
        sectionEl.classList.toggle("hidden", !visible);
      });
    }
    filter.addEventListener("input", applyFilters);
    sectionFilter.addEventListener("change", applyFilters);
  </script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outHtml, html, "utf8");

  const copied = [...frameStatus.values()].filter((s) => s.status === "copied").length;
  const iconCount = fs.existsSync(iconDir) ? fs.readdirSync(iconDir).length : 0;
  console.log(`Preview: docs/glyph-amulet-preview.html`);
  console.log(`Icons: ${copied} copied this run, ${iconCount} total in docs/glyph-amulet-preview-icons/`);
  console.log(`Open: http://localhost:4177/docs/glyph-amulet-preview.html`);
}

main();
