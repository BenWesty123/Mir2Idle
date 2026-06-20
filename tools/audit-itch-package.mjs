import fs from "node:fs";
import path from "node:path";
import { PHASE1_ENEMY_TEMPLATES } from "../src/phase1Data.js";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
} from "../src/warriorMagic.js";
import { buildUsedSpellfxFiles } from "./itch-spellfx-manifest.mjs";

const root = path.resolve(import.meta.dirname, "..");

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

const PACKAGE_MAP_OBJECT_SET_IDS = [
  "bdd-dungeon-catalog",
  "oma-cave-walls",
  "prajna-cave-catalog",
  "viper-cave-catalog",
  "prajna-temple-catalog",
  "stone-temple-catalog",
  "wemade-mir2-custom-objects",
  "wooma-temple-picked-groups",
  "zuma-temple-catalog",
];
const itemData = readJsonFile(path.join(root, "src/data/items.json"));
const packageRoot = path.join(root, "dist/itch/public");

function walk(directory, relativeRoot = "") {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

const packaged = new Set(walk(packageRoot));
const source = new Set(walk(path.join(root, "public")));

const usedSprites = new Set(["sprite-sets/common/layers.json"]);
const addSprite = (layer, index) => {
  if (index == null || index === "") return;
  const safeIndex = Math.trunc(Number(index));
  if (!Number.isFinite(safeIndex) || safeIndex < 0) return;
  usedSprites.add(`sprite-sets/common/${layer}/${safeIndex}.json`);
  usedSprites.add(`sprite-sets/common/${layer}/${safeIndex}.png`);
};
addSprite("armour", 0);
addSprite("hair", 0);
for (const item of itemData.items ?? []) {
  if (item.visual?.layer === "armour" || item.visual?.layer === "weapon") {
    addSprite(item.visual.layer, item.visual.index);
  }
}

const usedMagic = new Set(
  [BASIC_ATTACK_SKILL, ...CRYSTAL_WARRIOR_SPELLS, ...CRYSTAL_WIZARD_SPELLS, ...CRYSTAL_TAOIST_SPELLS]
    .filter((spell) => spell?.icon != null)
    .map((spell) => `magic-icons/images/frame_${String(Number(spell.icon) * 2).padStart(6, "0")}.png`),
);

const packagedItemAtlas = packaged.has("item-icons/items-atlas.png");
const usedItems = new Set();
if (packagedItemAtlas) {
  usedItems.add("item-icons/items-atlas.png");
} else {
  for (const item of itemData.items ?? []) {
    const src = item?.icon?.src;
    if (typeof src === "string" && src.includes("item-icons/items/")) {
      usedItems.add(`item-icons/items/${path.posix.basename(src)}`);
    }
  }
}

const usedMonsters = new Set(
  PHASE1_ENEMY_TEMPLATES
    .map((enemy) => enemy?.monsterIndex)
    .filter((index) => Number.isFinite(Number(index)))
    .map((index) => Math.trunc(Number(index))),
);
usedMonsters.add(78);
for (const index of [79, 80]) usedMonsters.add(index);

const usedStateitems = new Set([
  "ui/character/stateitems.json",
  "ui/character/stateitems-atlas.png",
  "ui/character/character-panel.png",
  "ui/character/hair-441.png",
  "ui/character/background.png",
  "ui/character/close.png",
  "ui/character/class-icons.png",
  "ui/character/pages.png",
  "ui/character/tabs.png",
]);

const manifest = readJsonFile(path.join(root, "public/audio/sfx/manifest.json"));
const usedSfx = new Set();
for (const entry of Object.values(manifest.byKey ?? {})) {
  const match = String(entry?.src ?? "").match(/audio\/sfx\/files\/[^"']+/);
  if (match) usedSfx.add(match[0]);
}

const usedSpellfx = buildUsedSpellfxFiles(root);

const usedMapObjects = new Set(["mapobjects/index.json"]);
const mapObjectIndex = readJsonFile(path.join(root, "public/mapobjects/index.json"));
for (const set of mapObjectIndex.sets ?? []) {
  if (!PACKAGE_MAP_OBJECT_SET_IDS.includes(set.id) || !set.sheet) continue;
  usedMapObjects.add(`mapobjects/${set.sheet}`);
}

const checks = [
  ["player sprites", [...usedSprites]],
  ["magic icons", [...usedMagic]],
  ["item icons", [...usedItems]],
  ["monsters", [...usedMonsters].flatMap((index) => [`monsters/monster/${index}.json`, `monsters/monster/${index}.png`])],
  ["mapobjects", [...usedMapObjects]],
  ["sfx", [...usedSfx]],
  ["spellfx", [...usedSpellfx]],
  ["stateitems", [...usedStateitems]],
];

let hasMissing = false;
for (const [label, paths] of checks) {
  const missing = paths.filter((entry) => !packaged.has(entry));
  console.log(`${label}: ${paths.length} required, ${missing.length} missing`);
  if (missing.length) {
    hasMissing = true;
    for (const entry of missing.slice(0, 10)) console.log(`  - ${entry}`);
  }
}

const excludedButHarmless = [
  "sprite-sets/archer",
  "sprite-sets/assassin",
  "sprites",
  "magic-icons/index.html",
  "magic-icons/tiles.json",
  "item-icons/books/index.html",
  "item-icons/books/tiles.json",
];
const missingFromSource = [...source].filter((entry) => !packaged.has(entry));
const grouped = Object.groupBy(missingFromSource, (entry) => entry.split("/").slice(0, 2).join("/"));
console.log("\nExcluded from package (by category):");
for (const [category, files] of Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)) {
  const harmless = excludedButHarmless.some((prefix) => category === prefix || category.startsWith(prefix));
  console.log(`  ${files.length}\t${category}${harmless ? " (dev/review only)" : ""}`);
}

if (hasMissing) process.exitCode = 1;
