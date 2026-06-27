import fs from "node:fs";
import path from "node:path";
import { PHASE1_ENEMY_TEMPLATES } from "../src/phase1Data.js";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
} from "../src/warriorMagic.js";
import {
  buildUsedSpellfxFiles,
  collectSpellfxAtlasAssetPaths,
  findMissingPublicFiles,
  loadSpellfxAtlas,
} from "./itch-spellfx-manifest.mjs";

const root = path.resolve(import.meta.dirname, "..");
const PAPER_DOLL_FALLBACK = new Set([30, 31, 36, 54, 60, 110]);

function publicPath(relativePath) {
  return path.join(root, "public", relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

const items = readJson("src/data/items.json").items;
const stateitems = readJson("public/ui/character/stateitems.json");
const issues = [];

for (const item of items) {
  const src = item.icon?.src;
  if (!src || src.includes("undefined")) {
    issues.push({ category: "item-icon", id: item.id, detail: "broken or missing icon src" });
    continue;
  }
  const rel = src.replace(/^\.?\/public\//, "");
  if (!fs.existsSync(publicPath(rel))) {
    issues.push({ category: "item-icon", id: item.id, detail: `missing ${rel}` });
  }
}

for (const item of items.filter((entry) => ["weapon", "armour", "helmet"].includes(entry.slot))) {
  const frame = item.icon?.frame;
  if (frame != null && !stateitems[String(frame)] && !PAPER_DOLL_FALLBACK.has(frame)) {
    issues.push({ category: "stateitem", id: item.id, detail: `missing stateitem frame ${frame}` });
  }
  const pngPath = frame != null ? publicPath(`ui/character/stateitem-${frame}.png`) : null;
  if (pngPath && !fs.existsSync(pngPath)) {
    issues.push({ category: "stateitem-png", id: item.id, detail: `missing stateitem-${frame}.png` });
  }
  if (item.visual) {
    const jsonPath = publicPath(`sprite-sets/common/${item.visual.layer}/${item.visual.index}.json`);
    const atlasPng = publicPath(`sprite-sets/common/${item.visual.layer}/${item.visual.index}.png`);
    if (!fs.existsSync(jsonPath) || !fs.existsSync(atlasPng)) {
      issues.push({
        category: "world-sprite",
        id: item.id,
        detail: `missing ${item.visual.layer}/${item.visual.index} atlas`,
      });
    }
  } else if (item.type === "weapon" || item.type === "armour") {
    issues.push({ category: "visual", id: item.id, detail: "missing visual block" });
  }
}

for (const relativePath of findMissingPublicFiles(root, buildUsedSpellfxFiles(root))) {
  issues.push({ category: "spellfx", id: relativePath, detail: "missing packaged spellfx asset" });
}
for (const spellId of ["MapLightning", "MapHellFire"]) {
  const atlas = loadSpellfxAtlas(root, spellId);
  if (!atlas) {
    issues.push({ category: "spellfx", id: spellId, detail: "missing atlas.json" });
    continue;
  }
  for (const assetPath of collectSpellfxAtlasAssetPaths(spellId, atlas)) {
    if (!fs.existsSync(publicPath(assetPath))) {
      issues.push({ category: "spellfx", id: spellId, detail: `missing ${assetPath}` });
    }
  }
}

const manifest = readJson("public/audio/sfx/manifest.json");
for (const [key, entry] of Object.entries(manifest.byKey ?? {})) {
  const match = String(entry?.src ?? "").match(/audio\/sfx\/files\/(.+)/);
  if (!match) continue;
  const filePath = publicPath(`audio/sfx/files/${match[1]}`);
  if (!fs.existsSync(filePath)) {
    issues.push({ category: "sfx", id: key, detail: `missing ${match[1]}` });
  }
}

for (const enemy of PHASE1_ENEMY_TEMPLATES) {
  const index = Math.trunc(Number(enemy?.monsterIndex));
  if (!Number.isFinite(index)) continue;
  for (const ext of ["json", "png"]) {
    const rel = `monsters/monster/${index}.${ext}`;
    if (!fs.existsSync(publicPath(rel))) {
      issues.push({ category: "monster", id: String(index), detail: `missing ${rel}` });
    }
  }
}
for (const index of [78, 79, 80]) {
  for (const ext of ["json", "png"]) {
    const rel = `monsters/monster/${index}.${ext}`;
    if (!fs.existsSync(publicPath(rel))) {
      issues.push({ category: "pet-monster", id: String(index), detail: `missing ${rel}` });
    }
  }
}

const magicIcons = new Set(
  [BASIC_ATTACK_SKILL, ...CRYSTAL_WARRIOR_SPELLS, ...CRYSTAL_WIZARD_SPELLS, ...CRYSTAL_TAOIST_SPELLS]
    .filter((spell) => spell?.icon != null)
    .map((spell) => `magic-icons/images/frame_${String(Number(spell.icon) * 2).padStart(6, "0")}.png`),
);
for (const rel of magicIcons) {
  if (!fs.existsSync(publicPath(rel))) {
    issues.push({ category: "magic-icon", id: rel, detail: "missing magic icon" });
  }
}

console.log(`Release asset audit: ${issues.length} issue(s)`);
const grouped = Object.groupBy(issues, (issue) => issue.category);
for (const [category, list] of Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`\n${category} (${list.length}):`);
  for (const issue of list.slice(0, 25)) console.log(`  ${issue.id}: ${issue.detail}`);
  if (list.length > 25) console.log(`  ... and ${list.length - 25} more`);
}

if (issues.length) process.exitCode = 1;
else console.log("\nAll release assets present in source.");
