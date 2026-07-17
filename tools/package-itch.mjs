import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
} from "../src/warriorMagic.js";
import { PHASE1_ENEMY_TEMPLATES, PHASE1_ZONES } from "../src/phase1Data.js";
import { buildUsedSpellfxFiles } from "./itch-spellfx-manifest.mjs";
import { ARMOUR_SPECIAL_EFFECT_DEFS } from "../src/armourVisualEffects.js";

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
  "terms.html",
  "refund.html",
  "_headers",
  "src/app.js",
  "src/app.monolith.js",
  "src/atlas.js",
  "src/armourVisualEffects.js",
  "src/levelVisualEffects.js",
  "src/battleData.js",
  "src/bossDrops.js",
  "src/buffPotions.js",
  "src/core/bossRespawn.js",
  "src/core/cloudSave.js",
  "src/core/combat.js",
  "src/core/craftingCube.js",
  "src/core/drops.js",
  "src/core/empoweredItems.js",
  "src/core/itemIntegrityVersion.js",
  "src/core/offlineProgress.js",
  "src/core/party.js",
  "src/core/progress.js",
  "src/core/socialEquipment.js",
  "src/core/taoistPets.js",
  "src/core/wizardMirror.js",
  "src/glyphModifiers.js",
  "src/groupDungeonSwarm.js",
  "src/persistence/restoreAccount.js",
  "src/persistence/restoreCharacter.js",
  "src/persistence/saveFormat.js",
  "src/persistence/sanitizeCharacter.js",
  "src/persistence/sanitizeGame.js",
  "src/persistence/sanitizeInventory.js",
  "src/persistence/sanitizeSettings.js",
  "src/persistence/sanitizeStats.js",
  "src/persistence/sanitizeUpgrades.js",
  "src/phase1Data.js",
  "src/playerActions.js",
  "src/spellBodyActions.js",
  "src/styles.css",
  "src/warriorMagic.js",
  "src/zumaArcherSwarm.js",
  "src/data/items.json",
  "src/data/changelog.json",
];

const publicExcludes = new Set([
  "debug",
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
  "gem-merchant",
  "message-board",
];

const SUMMON_SKELETON_PET_MONSTER_INDEX = 78;
const SUMMON_SHINSU_PET_MONSTER_INDICES = [79, 80];
const SUMMON_HOLY_DEVA_PET_MONSTER_INDEX = 117;

/** Map-object sets referenced by shipped zones / default town decor. */
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

const usedMagicIconFiles = new Set(
  [BASIC_ATTACK_SKILL, ...CRYSTAL_WARRIOR_SPELLS, ...CRYSTAL_WIZARD_SPELLS, ...CRYSTAL_TAOIST_SPELLS]
    .filter((spell) => spell?.icon != null)
    .map((spell) => `frame_${String(Number(spell.icon) * 2).padStart(6, "0")}.png`),
);
const usedCommonSpriteFiles = buildUsedCommonSpriteFiles();
const usedArmourEffectFiles = buildUsedArmourEffectFiles();
const usedItemIconFiles = buildUsedItemIconFiles();
const usedBookIconFiles = buildUsedBookIconFiles();
const usedMonsterIndices = buildUsedMonsterIndices();
const usedMapObjectFiles = buildUsedMapObjectFiles();
const usedMaptileFiles = buildUsedMaptileFiles();
const usedNpcFiles = buildUsedNpcFiles();
const usedSpellfxFiles = buildUsedSpellfxFiles(root);
const usedSfxFiles = buildUsedSfxFiles();

function buildUsedSfxFiles() {
  const files = new Set(["audio/sfx/manifest.json"]);
  const manifestPath = path.join(root, "public/audio/sfx/manifest.json");
  if (!fs.existsSync(manifestPath)) return files;
  const manifest = readJsonFile(manifestPath);
  for (const entry of Object.values(manifest.byKey ?? {})) {
    const match = String(entry?.src ?? "").match(/audio\/sfx\/files\/[^"']+/);
    if (match) files.add(match[0]);
  }
  return files;
}

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
  indices.add(SUMMON_HOLY_DEVA_PET_MONSTER_INDEX);
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

function buildUsedArmourEffectFiles() {
  const files = new Set();
  const addEffectId = (effectId) => {
    const def = ARMOUR_SPECIAL_EFFECT_DEFS[effectId];
    if (!def?.atlasPath) return;
    const atlasPath = path.join(root, def.atlasPath.replace(/^\.\//, ""));
    if (!fs.existsSync(atlasPath)) return;
    const atlas = readJsonFile(atlasPath);
    const baseRel = path.relative(path.join(root, "public"), path.dirname(atlasPath)).replace(/\\/g, "/");
    files.add(`${baseRel}/atlas.json`);
    for (const layer of atlas.layers ?? []) {
      if (layer.sheet) files.add(`${baseRel}/${layer.sheet}`);
    }
  };

  // Ship every DEFINED special-effect atlas (native + level effects), not only
  // those currently assigned to an item. Several are scaffolding for future
  // development; the client preloads all of them at boot, so shipping the full
  // set keeps the packaged build from 404ing. addEffectId() silently skips any
  // def whose atlas file is not on disk, so this stays safe.
  for (const def of Object.values(ARMOUR_SPECIAL_EFFECT_DEFS)) {
    addEffectId(def.id);
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
  if (relativePath.endsWith(".bak")) return true;
  if (/^ui\/character\/stateitem-\d+\.png$/.test(relativePath)) return true;
  // Ship the committed item-icon atlas (items-atlas.png/json), NOT the ~260
  // individual frame PNGs — keeps the package under itch.io's 1,000-file limit.
  if (/^item-icons\/items\/frame_.+\.png$/.test(relativePath)) return true;
  if (/^sprite-sets\/common\/(?:armour|hair|weapon|wing)\/\d+\.(?:json|png)$/.test(relativePath)) {
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
  if (relativePath.startsWith("armour-effects/") || relativePath.startsWith("level-effects/")) {
    return !usedArmourEffectFiles.has(relativePath);
  }
  if (relativePath.startsWith("audio/sfx/")) {
    return !usedSfxFiles.has(relativePath);
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

function bundlePackagedAtlasManifests() {
  const atlases = {};
  const candidates = [
    path.join(packageRoot, "public/sprite-sets/common"),
    path.join(packageRoot, "public/monsters/monster"),
  ];

  for (const directory of candidates) {
    if (!fs.existsSync(directory)) continue;
    for (const file of collectPackageFiles(directory)) {
      if (path.extname(file.fullPath).toLowerCase() !== ".json") continue;
      const relativePath = path.relative(packageRoot, file.fullPath).replace(/\\/g, "/");
      if (!/^(?:public\/sprite-sets\/common\/(?:armour|hair|weapon|wing)\/\d+|public\/monsters\/monster\/\d+)\.json$/.test(relativePath)) {
        continue;
      }
      atlases[relativePath] = readJsonFile(file.fullPath);
      fs.rmSync(file.fullPath);
    }
  }

  const bundlePath = path.join(packageRoot, "public/atlas-manifests.json");
  fs.writeFileSync(bundlePath, JSON.stringify({ version: 1, atlases }));
  const indexPath = path.join(packageRoot, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  if (!indexHtml.includes('name="lom-atlas-bundle"')) {
    fs.writeFileSync(
      indexPath,
      indexHtml.replace("</head>", '    <meta name="lom-atlas-bundle" content="./public/atlas-manifests.json" />\n  </head>'),
    );
  }
  console.log(`Bundled ${Object.keys(atlases).length} sprite atlas manifests into one file.`);
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

// Files that MUST contain a `?v=` cache-bust token after copying. If the stamp
// finds nothing to rewrite in one of these, the release would risk serving a
// stale module from itch.io's long-lived CDN, so we fail the build loudly
// instead. index.html holds the entry <script>; src/app.js holds the
// `import "./app.monolith.js?v=..."` that pins the whole monolith.
const CACHE_BUST_REQUIRED_FILES = ["index.html", "src/app.js"];

/**
 * Re-stamp `?v=` cache-bust tokens across every packaged HTML/JS/CSS source file.
 * HTML uses a broad regex so the entry script, styles.css and any asset link
 * are all stamped. JS uses a regex anchored to a `.js`/`.mjs` module specifier
 * so it rewrites in-source imports (src/app.js -> "./app.monolith.js?v=...")
 * WITHOUT touching the dynamic `?v=${MONSTER_ASSET_VERSION}` asset URLs that
 * live inside the monolith. CSS stamps local url(...) assets so returning
 * browsers fetch updated UI art after a release.
 */
function stampCacheBust(relativePath, text) {
  if (relativePath.endsWith(".html")) {
    return text.replace(/\?v=[^"']+/g, `?v=${buildVersion}`);
  }
  if (relativePath.endsWith(".css")) {
    return text.replace(/url\((["']?)([^"')]+)\1\)/g, (match, quote, rawUrl) => {
      const url = rawUrl.trim();
      if (!url || /^(?:data:|https?:|#)/i.test(url)) return match;
      const hashIndex = url.indexOf("#");
      const pathAndQuery = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
      const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
      const cleanPath = pathAndQuery.split("?")[0];
      return `url(${quote}${cleanPath}?v=${buildVersion}${hash}${quote})`;
    });
  }
  return text.replace(/(\.m?js)\?v=[^"'`\s]+/g, `$1?v=${buildVersion}`);
}

function patchCacheBusting() {
  for (const relativePath of sourceFiles) {
    if (!/\.(?:html|m?js|css)$/.test(relativePath)) continue;
    const filePath = path.join(packageRoot, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const original = fs.readFileSync(filePath, "utf8");
    const patched = stampCacheBust(relativePath, original);
    if (patched !== original) {
      fs.writeFileSync(filePath, patched);
    } else if (CACHE_BUST_REQUIRED_FILES.includes(relativePath)) {
      throw new Error(
        `Cache-bust stamp found no ?v= token in ${relativePath}. The release would risk ` +
          `serving a stale cached module - restore a "...js?v=..." token (see src/app.js) before packaging.`,
      );
    }
  }
}

// Atlas coordinate maps (fetched no-store, so always fresh) reference a sheet
// PNG that loads via the normal HTTP cache (max-age). When an atlas is repacked,
// every icon's coordinates change; a returning browser would pair the fresh JSON
// with a STALE cached PNG and crop every icon from the wrong place. Stamping the
// sheet URL with a content hash gives a changed PNG a new URL, so it is always
// fetched fresh alongside its matching coordinates (old PNGs go unreferenced).
const ATLAS_SHEET_STAMP_TARGETS = [
  "public/item-icons/items-atlas.json",
  "public/ui/character/stateitems-atlas.json",
];

function stampAtlasSheetCacheBust() {
  for (const relativePath of ATLAS_SHEET_STAMP_TARGETS) {
    const jsonPath = path.join(packageRoot, relativePath);
    if (!fs.existsSync(jsonPath)) continue;
    const atlas = readJsonFile(jsonPath);
    const sheet = typeof atlas.sheet === "string" ? atlas.sheet : "";
    if (!sheet) continue;
    const cleanSheet = sheet.split("?")[0];
    const pngPath = path.join(packageRoot, cleanSheet.replace(/^\.\//, ""));
    if (!fs.existsSync(pngPath)) {
      throw new Error(
        `Atlas sheet PNG missing for ${relativePath}: ${cleanSheet}. ` +
          `Cannot cache-bust the atlas, which risks scrambled icons on deploy.`,
      );
    }
    const hash = crypto.createHash("sha1").update(fs.readFileSync(pngPath)).digest("hex").slice(0, 12);
    atlas.sheet = `${cleanSheet}?v=${hash}`;
    fs.writeFileSync(jsonPath, `${JSON.stringify(atlas, null, 2)}\n`);
  }
}

function patchPackagedStatsConfig() {
  const configPath = path.join(packageRoot, "public/stats/config.json");
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      config = {};
    }
  }
  config.demoLiveSiteBanner = {
    enabled: true,
    url: "https://www.lom2idle.com",
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
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

function validateModuleClosure() {
  const indexPath = path.join(packageRoot, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const entryMatch = indexHtml.match(/<script[^>]*src=["']([^"']+\.js)(?:\?[^"']*)?["']/);
  if (!entryMatch) {
    throw new Error("Could not find an entry <script> in packaged index.html.");
  }
  const entryRel = entryMatch[1].replace(/^\.\//, "");
  const seen = new Set();
  const missing = [];
  const visit = (relativePath) => {
    if (seen.has(relativePath)) return;
    seen.add(relativePath);
    const fullPath = path.join(packageRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      missing.push(relativePath);
      return;
    }
    const text = fs.readFileSync(fullPath, "utf8");
    const specs = [
      ...[...text.matchAll(/(?:import|export)[^"'`]*?from\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
      ...[...text.matchAll(/import\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
    ];
    for (const spec of specs) {
      if (!spec.startsWith(".")) continue;
      const clean = spec.split("?")[0];
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), clean));
      visit(resolved);
    }
  };
  visit(entryRel);
  if (missing.length) {
    throw new Error(
      `Packaged JS import closure is incomplete (would cause a blank screen):\n- ${missing.join("\n- ")}`,
    );
  }
}

function validateItchLimits(metrics, zipPath = null) {
  const issues = [];
  if (!fs.existsSync(path.join(packageRoot, "index.html"))) {
    issues.push("Missing index.html at package root.");
  }
  // The live game deploys to Cloudflare Pages (project `lom2idle`), which has no
  // 1,000-file limit. That cap was an itch.io HTML-embed constraint; we no longer
  // ship to itch, so the file-count check is informational only (warn, don't fail).
  const zipEntries = zipPath && fs.existsSync(zipPath) ? countZipEntries(zipPath) : metrics.files;
  const ITCH_FILE_LIMIT = 1000;
  if (zipEntries > ITCH_FILE_LIMIT || metrics.files > ITCH_FILE_LIMIT) {
    console.warn(
      `Note: package has ${metrics.files} files (${zipEntries} zip entries), over the old itch.io 1,000-file limit. ` +
        "This is fine for Cloudflare Pages, which is the live deploy target.",
    );
  }
  if (metrics.mb > 500) {
    issues.push(`Package too large (${metrics.mb} MB). limit is 500 MB.`);
  }
  if (metrics.maxFileMb > 200) {
    issues.push(`Largest file is ${metrics.maxFileMb} MB. single-file limit is 200 MB.`);
  }
  if (issues.length) {
    throw new Error(`Packaging checks failed:\n- ${issues.join("\n- ")}`);
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

function validateZipEntryPaths(zipPath) {
  const listing = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8" });
  const bad = listing.split("\n").find((entry) => entry.includes("\\"));
  if (bad) {
    throw new Error(`Zip entry uses backslashes (itch.io incompatible): ${bad}`);
  }
}

cleanOutput();
for (const file of sourceFiles) copyFile(file);
copyDirectory(path.join(root, "public"), path.join(packageRoot, "public"));
bundlePackagedAtlasManifests();
trimMaptileIndex();
patchCacheBusting();
stampAtlasSheetCacheBust();
patchPackagedStatsConfig();

validateModuleClosure();
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
