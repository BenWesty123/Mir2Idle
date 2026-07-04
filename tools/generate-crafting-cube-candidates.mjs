/**
 * Crafting Cube icon picker — shortlist of Crystal sprites that work as the cube UI.
 *
 * Run: node tools/generate-crafting-cube-candidates.mjs
 * Open: http://localhost:4177/tools/crafting-cube-candidates/index.html
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyItemIcon, frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.join(root, "tools/crafting-cube-candidates");
const iconDir = path.join(outDir, "icons");

/** @type {{ id: string, name: string, frame: number, type: string, note: string, recommended?: boolean }[]} */
const CANDIDATES = [
  {
    id: "mossy-box",
    name: "MossyBox",
    frame: 2380,
    type: "CraftingMaterial",
    note: "Named box with moss/wood vibe. Best literal “craft container” in Crystal.",
    recommended: true,
  },
  {
    id: "green-oct-box",
    name: "GreenOctagonalBox",
    frame: 1985,
    type: "Script",
    note: "Octagonal container — most cube-shaped silhouette in the DB.",
  },
  {
    id: "blue-oct-box",
    name: "BlueOctagonalBox",
    frame: 1983,
    type: "Script",
    note: "Blue octagonal box. Cool arcane tone.",
  },
  {
    id: "red-oct-box",
    name: "RedOctagonalBox",
    frame: 1984,
    type: "Script",
    note: "Red octagonal box. Fiery transmute tone.",
  },
  {
    id: "havoc-crystal",
    name: "HavocCrystal",
    frame: 1173,
    type: "CraftingMaterial",
    note: "Mystical crystal focus — use if the cube is an arcane relic, not a wooden box.",
  },
  {
    id: "jade-crystal",
    name: "JadeCrystal",
    frame: 447,
    type: "CraftingMaterial",
    note: "Green crystal shard. Pairs with jade / eastern craft theme.",
  },
  {
    id: "translucent",
    name: "Translucent",
    frame: 1170,
    type: "CraftingMaterial",
    note: "Glassy prism. Ethereal “transmute materials inside” look.",
  },
  {
    id: "wonder-box-m",
    name: "WonderBox(M)",
    frame: 2930,
    type: "Pets",
    note: "Mystery box — playful loot-cube feel (pet item in Crystal).",
  },
  {
    id: "gold-chest",
    name: "GoldChest",
    frame: 122,
    type: "Nothing",
    note: "Treasure chest. Reads as storage vault more than recipe transmuter.",
  },
  {
    id: "relic-rock",
    name: "RelicRock",
    frame: 1067,
    type: "Quest",
    note: "Ancient stone relic. Good for altar / pedestal cube UI.",
  },
  {
    id: "armour-cast-tool",
    name: "ArmourCastTool",
    frame: 1182,
    type: "CraftingMaterial",
    note: "Casting mould tool. Workshop icon, not a container.",
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ensureCandidateIcon(candidate) {
  const dest = path.join(iconDir, `${candidate.id}.png`);
  if (fs.existsSync(dest)) return true;

  const publicPath = path.join(root, "public/item-icons/items", frameFileName(candidate.frame));
  if (fs.existsSync(publicPath)) {
    fs.mkdirSync(iconDir, { recursive: true });
    fs.copyFileSync(publicPath, dest);
    return true;
  }

  if (!reviewIconSourcePath(root, candidate.frame)) return false;
  fs.mkdirSync(iconDir, { recursive: true });
  copyItemIcon(root, candidate.frame, iconDir);
  const copied = path.join(iconDir, frameFileName(candidate.frame));
  if (!fs.existsSync(copied)) return false;
  fs.renameSync(copied, dest);
  return true;
}

function renderCard(candidate) {
  const hasIcon = ensureCandidateIcon(candidate);
  const icon = hasIcon
    ? `<img src="./icons/${candidate.id}.png" width="96" height="96" alt="">`
    : `<span class="missing">?</span>`;
  const rec = candidate.recommended ? `<div class="rec">Recommended</div>` : "";
  const recClass = candidate.recommended ? " pick--rec" : "";

  return `<article class="pick${recClass}">
    ${rec}
    <div class="icon">${icon}</div>
    <h2>${escapeHtml(candidate.name)}</h2>
    <p class="meta">frame ${candidate.frame} · ${escapeHtml(candidate.type)}</p>
    <p class="note">${escapeHtml(candidate.note)}</p>
  </article>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Crafting Cube icon candidates</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #12151c;
      --panel: #1b2130;
      --border: #2d3648;
      --text: #e8edf7;
      --muted: #9aa8c0;
      --accent: #c9a227;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 15px/1.5 system-ui, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
    }
    h1 { margin: 0 0 8px; font-size: 22px; }
    header p { margin: 0; color: var(--muted); max-width: 72ch; }
    main {
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .pick {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      position: relative;
    }
    .pick--rec {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(201, 162, 39, 0.25);
    }
    .rec {
      position: absolute;
      top: 12px;
      right: 12px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: rgba(201, 162, 39, 0.15);
      color: var(--accent);
      padding: 4px 8px;
      border-radius: 999px;
    }
    .icon {
      width: 96px;
      height: 96px;
      display: grid;
      place-items: center;
      background: #0d1017;
      border: 1px solid #000;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .icon img {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      max-width: 96px;
      max-height: 96px;
    }
    .missing { color: var(--muted); font-size: 24px; font-weight: 700; }
    .pick h2 { margin: 0 0 4px; font-size: 16px; }
    .meta { margin: 0 0 10px; font-size: 12px; color: var(--muted); }
    .note { margin: 0; font-size: 13px; color: #c5d0e4; }
  </style>
</head>
<body>
  <header>
    <h1>Crafting Cube — icon candidates</h1>
    <p>
      Shortlist of Crystal sprites for the cube UI (NPC button, panel header, slot board).
      <strong>MossyBox</strong> is the best named craft box; octagonal boxes are the most cube-shaped.
    </p>
  </header>
  <main>
    ${CANDIDATES.map(renderCard).join("\n")}
  </main>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

for (const candidate of CANDIDATES) {
  const ok = ensureCandidateIcon(candidate);
  console.log(`${ok ? "OK" : "MISSING"}  ${candidate.name} (frame ${candidate.frame})`);
}
console.log("\nOpen: http://localhost:4177/tools/crafting-cube-candidates/index.html");
