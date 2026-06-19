import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
} from "../src/warriorMagic.js";
import { PHASE1_ENEMY_TEMPLATES, PHASE1_ZONES } from "../src/phase1Data.js";
import { buildUsedSpellfxFiles } from "./itch-spellfx-manifest.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(root, "dist");
const packageRoot = path.join(outputRoot, "itch");
const itemData = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8"));

// A fresh stamp per build so itch.io's long-lived caches always re-fetch the
// updated app.js/styles.css instead of serving a stale copy under the same URL.
const buildVersion = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace("T", "-")
  .slice(0, 15);

const sourceFiles = [
  "index.html",
  "src/app.js",
  "src/atlas.js",
  "src/battleData.js",
  "src/buffPotions.js",
  "src/groupDungeonSwarm.js",
  "src/phase1Data.js",
  "src/playerActions.js",
  "src/spellBodyActions.js",
  "src/styles.css",
  "src/warriorMagic.js",
  "src/data/items.json",
];

const publicExcludes = new Set([
  "item-icons/books/index.html",
  "item-icons/books/tiles.json",
  "magic-icons/index.html",
  "magic-icons/tiles.json",
  "npcs/trainer",
  "sprite-sets/archer",
  "sprite-sets/assassin",
  "sprites",
  "ui/character/atlas.json",
  "ui/hotbar/atlas.json",
  "ui/hotbar/close.png",
  "ui/hotbar/rotate.png",
  "ui/inventory/atlas.json",
  "ui/npc-dialog/atlas.json",
  "ui/storage/atlas.json",
  "ui/storage/protect.png",
  "ui/storage/protect-hover.png",
  "ui/storage/protect-pressed.png",
  "ui/storage/rent.png",
]);

/** Default tile set for zones without an explicit mapSet (matches app default). */
const PACKAGE_DEFAULT_MAP_SET = "wemade-mir2-custom";

/** Town NPC sprites referenced by TOWN_NPCS in app.js (trainer uses teleporter). */
const PACKAGE_TOWN_NPC_SPRITES = [
  "shopkeeper",
  "trader",
  "storage",
  "smith",
  "refiner",
  "teleport-stone",
  "teleporter",
];

const SUMMON_SKELETON_PET_MONSTER_INDEX = 78;
const SUMMON_SHINSU_PET_MONSTER_INDICES = [79, 80];

/** Map-object sets referenced by shipped zones / default town decor. */
const PACKAGE_MAP_OBJECT_SET_IDS = [
  "bdd-dungeon-catalog",
  "oma-cave-walls",
  "prajna-cave-catalog",
  "prajna-temple-catalog",
  "stone-temple-catalog",
  "wemade-mir2-custom-objects",
  "wooma-temple-picked-groups",
  "zuma-temple-catalog",
];

const usedMagicIconFiles = new Set(
  [BASIC_ATTACK_SKILL, ...CRYSTAL_WARRIOR_SPELLS, ...CRYSTAL_WIZARD_SPELLS, ...CRYSTAL_TAOIST_SPELLS]
    .filter((spell) => spell?.icon != null)
    .map((spell) => `frame_${String(Number(spell.icon) * 2).padStart(6, "0")}.png`),
);
const usedCommonSpriteFiles = buildUsedCommonSpriteFiles();
const usedItemIconFiles = buildUsedItemIconFiles();
const usedBookIconFiles = buildUsedBookIconFiles();
const usedMonsterIndices = buildUsedMonsterIndices();
const usedMapObjectFiles = buildUsedMapObjectFiles();
const usedMaptileFiles = buildUsedMaptileFiles();
const usedNpcFiles = buildUsedNpcFiles();
const usedSpellfxFiles = buildUsedSpellfxFiles(root);

function buildUsedItemIconFiles() {
  const files = new Set();
  for (const item of itemData.items ?? []) {
    const src = item?.icon?.src;
    if (typeof src !== "string" || !src.includes("item-icons/")) continue;
    files.add(`item-icons/items/${path.posix.basename(src)}`);
  }
  return files;
}

function buildUsedBookIconFiles() {
  const files = new Set();
  for (const item of itemData.items ?? []) {
    if (item?.type !== "book") continue;
    const src = item?.icon?.src;
    if (typeof src !== "string" || !src.includes("item-icons/books/")) continue;
    files.add(`item-icons/books/images/${path.posix.basename(src)}`);
  }
  return files;
}

function buildUsedMonsterIndices() {
  const indices = new Set(
    PHASE1_ENEMY_TEMPLATES
      .map((enemy) => enemy?.monsterIndex)
      .filter((index) => Number.isFinite(Number(index)))
      .map((index) => Math.trunc(Number(index))),
  );
  indices.add(SUMMON_SKELETON_PET_MONSTER_INDEX);
  for (const index of SUMMON_SHINSU_PET_MONSTER_INDICES) indices.add(index);
  return indices;
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function buildUsedMapObjectFiles() {
  const files = new Set(["mapobjects/index.json"]);
  const indexPath = path.join(root, "public/mapobjects/index.json");
  if (!fs.existsSync(indexPath)) return files;
  const index = readJsonFile(indexPath);
  const wanted = new Set(PACKAGE_MAP_OBJECT_SET_IDS);
  for (const set of index.sets ?? []) {
    if (!wanted.has(set.id) || !set.sheet) continue;
    files.add(`mapobjects/${set.sheet}`);
  }
  return files;
}

function buildUsedMaptileSetIds() {
  const ids = new Set([PACKAGE_DEFAULT_MAP_SET]);
  for (const zone of PHASE1_ZONES) {
    if (typeof zone.mapSet === "string" && zone.mapSet) ids.add(zone.mapSet);
  }
  return ids;
}

function buildUsedMaptileFiles() {
  const files = new Set(["maptiles/index.json"]);
  const indexPath = path.join(root, "public/maptiles/index.json");
  if (!fs.existsSync(indexPath)) return files;
  const index = readJsonFile(indexPath);
  const wanted = buildUsedMaptileSetIds();
  for (const set of index.sets ?? []) {
    if (!wanted.has(set.id) || !set.sheet) continue;
    files.add(`maptiles/${set.sheet}`);
  }
  return files;
}

function buildUsedNpcFiles() {
  const files = new Set();
  for (const sprite of PACKAGE_TOWN_NPC_SPRITES) {
    const spriteDir = path.join(root, "public/npcs", sprite);
    if (!fs.existsSync(spriteDir)) continue;
    for (const entry of fs.readdirSync(spriteDir, { withFileTypes: true })) {
      if (entry.isFile()) files.add(`npcs/${sprite}/${entry.name}`);
    }
  }
  return files;
}

function buildUsedCommonSpriteFiles() {
  const files = new Set(["sprite-sets/common/layers.json"]);
  const addLayerIndex = (layer, index) => {
    if (index == null || index === "") return;
    const safeIndex = Math.trunc(Number(index));
    if (!Number.isFinite(safeIndex) || safeIndex < 0) return;
    files.add(`sprite-sets/common/${layer}/${safeIndex}.json`);
    files.add(`sprite-sets/common/${layer}/${safeIndex}.png`);
  };

  addLayerIndex("armour", 0);
  addLayerIndex("hair", 0);
  for (const item of itemData.items ?? []) {
    if (item.visual?.layer === "armour" || item.visual?.layer === "weapon") {
      addLayerIndex(item.visual.layer, item.visual.index);
    }
  }
  return files;
}

function shouldExcludePublic(relativePath) {
  if ([...publicExcludes].some((exclude) => relativePath === exclude || relativePath.startsWith(`${exclude}/`))) return true;
  if (/^ui\/character\/stateitem-\d+\.png$/.test(relativePath)) return true;
  if (/^sprite-sets\/common\/(?:armour|hair|weapon)\/\d+\.(?:json|png)$/.test(relativePath)) {
    return !usedCommonSpriteFiles.has(relativePath);
  }
  if (relativePath.startsWith("magic-icons/images/")) {
    const fileName = path.posix.basename(relativePath);
    return !usedMagicIconFiles.has(fileName);
  }
  if (relativePath.startsWith("item-icons/items/")) {
    return !usedItemIconFiles.has(relativePath);
  }
  if (relativePath.startsWith("item-icons/books/images/")) {
    return !usedBookIconFiles.has(relativePath);
  }
  if (/^monsters\/monster\/\d+\.(?:json|png)$/.test(relativePath)) {
    const index = Math.trunc(Number(path.posix.basename(relativePath, path.extname(relativePath))));
    return !usedMonsterIndices.has(index);
  }
  if (relativePath.startsWith("mapobjects/")) {
    return !usedMapObjectFiles.has(relativePath);
  }
  if (relativePath.startsWith("maptiles/")) {
    return !usedMaptileFiles.has(relativePath);
  }
  if (relativePath.startsWith("npcs/")) {
    return !usedNpcFiles.has(relativePath);
  }
  if (relativePath.startsWith("spellfx/")) {
    return !usedSpellfxFiles.has(relativePath);
  }
  return false;
}

function trimMaptileIndex() {
  const indexPath = path.join(packageRoot, "public/maptiles/index.json");
  if (!fs.existsSync(indexPath)) return;
  const index = readJsonFile(indexPath);
  const wanted = buildUsedMaptileSetIds();
  index.sets = (index.sets ?? []).filter((set) => wanted.has(set.id));
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

function cleanOutput() {
  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(packageRoot, { recursive: true });
}

function copyFile(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(packageRoot, relativePath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDirectory(from, to, relativeRoot = "") {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeRoot, entry.name);
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(fromPath, toPath, relativePath);
      continue;
    }
    if (!entry.isFile() || shouldExcludePublic(relativePath)) continue;
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.copyFileSync(fromPath, toPath);
  }
}

function patchCacheBusting() {
  const indexPath = path.join(packageRoot, "index.html");
  const text = fs.readFileSync(indexPath, "utf8").replace(/\?v=[^"']+/g, `?v=${buildVersion}`);
  fs.writeFileSync(indexPath, text);
}

function patchBrowserRelativePaths() {
  const files = [
    "src/data/items.json",
    "src/warriorMagic.js",
  ];
  for (const relativePath of files) {
    const filePath = path.join(packageRoot, relativePath);
    const text = fs.readFileSync(filePath, "utf8").replaceAll('"/public/', '"./public/').replaceAll("`/public/", "`./public/");
    fs.writeFileSync(filePath, text);
  }
}

function measureBuild() {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  };
  walk(packageRoot);
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const maxFileBytes = files.reduce((max, file) => Math.max(max, fs.statSync(file).size), 0);
  return {
    files: files.length,
    mb: Number((bytes / 1024 / 1024).toFixed(2)),
    maxFileMb: Number((maxFileBytes / 1024 / 1024).toFixed(2)),
  };
}

function validateItchLimits(metrics, zipPath = null) {
  const issues = [];
  if (!fs.existsSync(path.join(packageRoot, "index.html"))) {
    issues.push("Missing index.html at package root.");
  }
  const zipEntries = zipPath && fs.existsSync(zipPath) ? countZipEntries(zipPath) : metrics.files;
  if (zipEntries > 1000) {
    issues.push(`Too many zip entries (${zipEntries}). itch.io HTML limit is 1,000.`);
  }
  if (metrics.files > 1000) {
    issues.push(`Too many extracted files (${metrics.files}). itch.io HTML limit is 1,000.`);
  }
  if (metrics.mb > 500) {
    issues.push(`Package too large (${metrics.mb} MB). itch.io HTML limit is 500 MB.`);
  }
  if (metrics.maxFileMb > 200) {
    issues.push(`Largest file is ${metrics.maxFileMb} MB. itch.io single-file limit is 200 MB.`);
  }
  if (issues.length) {
    throw new Error(`Itch.io packaging checks failed:\n- ${issues.join("\n- ")}`);
  }
}

function collectPackageFiles(directory, relativeRoot = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectPackageFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      files.push({
        relativePath: relativePath.replace(/\\/g, "/"),
        fullPath,
      });
    }
  }
  return files;
}

function countZipEntries(zipPath) {
  const listing = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8" });
  return listing.split("\n").filter(Boolean).length;
}

function createZipArchive() {
  const zipPath = path.join(outputRoot, `lom-idle-v2-itch-${buildVersion}.zip`);
  fs.rmSync(zipPath, { force: true });

  const files = collectPackageFiles(packageRoot);
  const manifestPath = path.join(outputRoot, `.itch-zip-manifest-${buildVersion}.txt`);
  fs.writeFileSync(manifestPath, files.map((file) => `${file.fullPath}|||${file.relativePath}`).join("\n"));

  const psScript = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$zipPath = '${zipPath.replace(/'/g, "''")}'`,
    `$manifestPath = '${manifestPath.replace(/'/g, "''")}'`,
    "$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')",
    "try {",
    "  Get-Content -LiteralPath $manifestPath | ForEach-Object {",
    "    if ([string]::IsNullOrWhiteSpace($_)) { return }",
    "    $parts = $_ -split '\\|\\|\\|', 2",
    "    $fullPath = $parts[0]",
    "    $entryName = $parts[1]",
    "    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fullPath, $entryName)",
    "  }",
    "} finally {",
    "  $zip.Dispose()",
    "}",
  ].join("; ");

  execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
  fs.rmSync(manifestPath, { force: true });
  validateZipEntryPaths(zipPath);
  return zipPath;
}

function buildPackagedStateitems() {
  execSync(
    `powershell -ExecutionPolicy Bypass -File "${path.join(root, "tools/build-stateitem-atlas.ps1")}"`,
    { stdio: "inherit" },
  );
}

function validateZipEntryPaths(zipPath) {
  const listing = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8" });
  const bad = listing.split("\n").find((entry) => entry.includes("\\"));
  if (bad) {
    throw new Error(`Zip entry uses backslashes (itch.io incompatible): ${bad}`);
  }
}

cleanOutput();
for (const file of sourceFiles) copyFile(file);
copyDirectory(path.join(root, "src/game"), path.join(packageRoot, "src/game"));
copyDirectory(path.join(root, "public"), path.join(packageRoot, "public"));
buildPackagedStateitems();
trimMaptileIndex();
patchCacheBusting();
patchBrowserRelativePaths();

const metrics = measureBuild();
const zipPath = createZipArchive();
validateItchLimits(metrics, zipPath);

console.log(`Prepared itch package folder: ${path.relative(root, packageRoot)}`);
console.log(`Prepared itch upload zip: ${path.relative(root, zipPath)}`);
console.log(`Cache-bust version: ${buildVersion}`);
console.log(`Extracted size: ${metrics.mb} MB`);
console.log(`Largest file: ${metrics.maxFileMb} MB`);
console.log(`Extracted files: ${metrics.files}`);
console.log(`Zip entries: ${countZipEntries(zipPath)}`);
console.log("Upload checklist:");
console.log("- Project kind: HTML");
console.log("- Check: This file will be played in the browser");
console.log("- Embed mode: Embed in page");
console.log("- Suggested viewport: 960 x 720 (minimum usable: 560 x 400)");
console.log("- Keep Click to play enabled for reliable audio startup");
