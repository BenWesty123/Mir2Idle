import fs from "node:fs";
import path from "node:path";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalPath = path.join(root, "src/data/crystal-items.json");
const crystalMonstersPath = path.join(root, "src/data/crystal-monsters.json");
const itemsPath = path.join(root, "src/data/items.json");
const appPath = path.join(root, "src/app.js");
const dropRoot = path.join("C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Envir/Drops");
const outDir = path.join(root, "tile-review/unused-gear-catalog");
const publicIconRoot = path.join(root, "public/item-icons/items");
const spriteRoot = path.join(root, "public/sprite-sets/common");
const stateitemsPath = path.join(root, "public/ui/character/stateitems.json");

const PAPER_DOLL_FALLBACK = {
  30: { x: 75, y: 186, w: 28, h: 57 },
  31: { x: 73, y: 179, w: 32, h: 67 },
  36: { x: 71, y: 172, w: 36, h: 74 },
  54: { x: 57, y: 139, w: 52, h: 115 },
  60: { x: 92, y: 194, w: 80, h: 128 },
  110: { x: 130, y: 172, w: 16, h: 20 },
};

const RECENT_GAME_IDS = new Set(["oma-king-robe", "heaven-armour", "oma-spirit-ring"]);
const ASSASSIN = 8;
const ARCHER = 16;

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
  return name
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function crystalFamily(name) {
  return String(name)
    .replace(/\(M\)|\(F\)/g, "")
    .replace(/\d+$/g, "")
    .replace(/\(.*?\)/g, "")
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
  const dc = statRange(s.dc);
  const mc = statRange(s.mc);
  const sc = statRange(s.sc);
  const ac = statRange(s.ac);
  const amc = statRange(s.amc);
  if (dc) parts.push(`DC ${dc}`);
  if (mc) parts.push(`MC ${mc}`);
  if (sc) parts.push(`SC ${sc}`);
  if (ac) parts.push(`AC ${ac}`);
  if (amc) parts.push(`AMC ${amc}`);
  if (s.hp) parts.push(`HP +${s.hp}`);
  if (s.mp) parts.push(`MP +${s.mp}`);
  if (s.accuracy) parts.push(`Acc +${s.accuracy}`);
  if (s.agility) parts.push(`Agi +${s.agility}`);
  if (s.luck) parts.push(`Luck +${s.luck}`);
  if (s.attackSpeed) parts.push(`ASpeed ${s.attackSpeed}`);
  if (!parts.length && item.rawStats) {
    return Object.entries(item.rawStats)
      .slice(0, 8)
      .map(([k, v]) => `${k.replace(/^Min|^Max/, "")} ${v}`)
      .join(", ");
  }
  return parts.join(", ") || "—";
}

function iconHref(frame) {
  const file = frameFileName(frame);
  const publicPath = path.join(publicIconRoot, file);
  if (fs.existsSync(publicPath)) return `../../public/item-icons/items/${file}`;
  const reviewPath = reviewIconSourcePath(root, frame);
  if (reviewPath) return path.relative(outDir, reviewPath).split(path.sep).join("/");
  return "";
}

function hasWorldSprite(layer, shape) {
  return fs.existsSync(path.join(spriteRoot, layer, `${shape}.json`));
}

function hasStateitemFrame(frame, stateitems) {
  const key = String(frame);
  return Boolean(stateitems[key]) || Boolean(PAPER_DOLL_FALLBACK[key]);
}

function standingFrameMeta(layer, shape) {
  const jsonPath = path.join(spriteRoot, layer, `${shape}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  const atlas = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const meta = atlas?.actions?.standing?.frames?.[0];
  if (!meta || meta.empty) return null;
  return {
    slotWidth: atlas.slotWidth,
    slotHeight: atlas.slotHeight,
    slot: meta.slot,
    offsetX: meta.offsetX,
    offsetY: meta.offsetY,
  };
}

function isExcludedCrystalItem(item) {
  const rc = Number(item.requiredClass) || 0;
  if (rc === ASSASSIN || rc === ARCHER) return true;
  const hasWWT = (rc & 7) !== 0;
  const hasAA = (rc & (ASSASSIN | ARCHER)) !== 0;
  if (hasAA && !hasWWT && rc !== 31) return true;
  const n = item.name.toLowerCase();
  if (/assassin|archer|crossbow|\bbow\b|shuriken|ninja|monk/.test(n)) return true;
  if (/omakingrobe.*[45]/i.test(item.name)) return true;
  if (/underpants|fishingrod|pickaxe0/i.test(item.name)) return true;
  return false;
}

function parseDropLine(line) {
  const match = line.match(/^(\d+)\/(\d+)\s+(.+?)(?:\s+(Q|LV\d+))?$/i);
  if (!match) return null;
  return {
    numerator: Number(match[1]),
    denominator: Number(match[2]),
    itemName: match[3].trim(),
    tag: match[4] ?? "",
    rateText: `${match[1]}/${match[2]}`,
    rate: Number(match[1]) / Number(match[2]),
  };
}

function walkDropFiles(dir, base = "") {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      entries.push(...walkDropFiles(full, rel.replace(/\\/g, "/")));
      continue;
    }
    if (!name.toLowerCase().endsWith(".txt")) continue;
    const dropPath = rel.replace(/\.txt$/i, "").replace(/\\/g, "/");
    entries.push({ dropPath, fullPath: full });
  }
  return entries;
}

function buildDropIndex(dropFiles) {
  const byItem = new Map();
  for (const { dropPath, fullPath } of dropFiles) {
    const text = fs.readFileSync(fullPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";")) continue;
      const parsed = parseDropLine(line);
      if (!parsed) continue;
      if (!byItem.has(parsed.itemName)) byItem.set(parsed.itemName, []);
      byItem.get(parsed.itemName).push({
        dropPath,
        rateText: parsed.rateText,
        rate: parsed.rate,
        tag: parsed.tag,
      });
    }
  }
  return byItem;
}

function buildMonsterIndex(monsters) {
  const byDropPath = new Map();
  for (const monster of monsters) {
    const dropPath = String(monster.dropPath ?? "").replace(/\\/g, "/");
    if (!dropPath) continue;
    if (!byDropPath.has(dropPath)) byDropPath.set(dropPath, []);
    byDropPath.get(dropPath).push({
      name: monster.name,
      level: monster.level,
      isBoss: Boolean(monster.isBoss),
    });
  }
  return byDropPath;
}

function gameItemForCrystal(crystalName, gameItems) {
  return gameItems.find((g) => g.source?.name === crystalName) ?? null;
}

function isImplementedInGame(crystalName, gameItems) {
  return Boolean(gameItemForCrystal(crystalName, gameItems));
}

function parseBossDropTables(appSource) {
  const constToLabel = Object.fromEntries(
    [...appSource.matchAll(/"([^"]+)":\s*([A-Z_]+_BOSS_DROPS)/g)].map(([, label, constName]) => [constName, label]),
  );
  const tables = {};
  for (const match of appSource.matchAll(/const ([A-Z_]+_BOSS_DROPS) = \{[\s\S]*?\n\};/g)) {
    const constName = match[1];
    const block = match[0];
    const label = constToLabel[constName] ?? constName;
    const items = [...block.matchAll(/id: "([^"]+)",\s*chance: ([0-9.]+)/g)].map((m) => ({
      id: m[1],
      chance: Number(m[2]),
    }));
    tables[label] = items;
  }
  return tables;
}

function gameDropLines(gameItem, bossTables) {
  const lines = [];
  if (gameItem?.drop?.zones?.length) {
    for (const zone of gameItem.drop.zones) {
      const chance = gameItem.drop.chances?.[zone] ?? gameItem.drop.chance;
      if (chance) lines.push(`Idle zone ${zone} (${(chance * 100).toFixed(2)}%)`);
    }
  }
  for (const [boss, entries] of Object.entries(bossTables)) {
    const hit = entries.find((e) => e.id === gameItem?.id);
    if (hit) lines.push(`Idle boss ${boss} (${(hit.chance * 100).toFixed(2)}%)`);
  }
  return lines;
}

function relatedDropNames(crystalName) {
  const names = new Set([crystalName]);
  const withoutTier = crystalName.replace(/(\([MF]\))\d+$/i, "$1");
  names.add(withoutTier);
  const withoutGender = crystalName.replace(/(\(M\)|\(F\))\d*$/i, "");
  if (withoutGender && withoutGender !== crystalName) names.add(withoutGender);
  return [...names];
}

function mergeDropSources(itemName, dropIndex, monsterByDropPath) {
  const raw = [];
  for (const name of relatedDropNames(itemName)) {
    for (const entry of dropIndex.get(name) ?? []) {
      raw.push({ ...entry, matchedName: name });
    }
  }
  const merged = new Map();
  for (const entry of raw) {
    const key = `${entry.dropPath}|${entry.rateText}|${entry.matchedName}`;
    if (!merged.has(key)) merged.set(key, { ...entry, monsters: [] });
    const monsters = monsterByDropPath.get(entry.dropPath) ?? [];
    merged.get(key).monsters = monsters;
  }
  return [...merged.values()].sort((a, b) => a.rate - b.rate);
}

const crystalItems = JSON.parse(fs.readFileSync(crystalPath, "utf8")).items;
const gameItems = JSON.parse(fs.readFileSync(itemsPath, "utf8")).items;
const monsters = JSON.parse(fs.readFileSync(crystalMonstersPath, "utf8")).monsters ?? [];
const appSource = fs.readFileSync(appPath, "utf8");
const bossTables = parseBossDropTables(appSource);
const stateitems = JSON.parse(fs.readFileSync(stateitemsPath, "utf8"));

const dropFiles = walkDropFiles(dropRoot);
const dropIndex = buildDropIndex(dropFiles);
const monsterByDropPath = buildMonsterIndex(monsters);

const gearItems = crystalItems.filter(
  (item) => (item.type === "Weapon" || item.type === "Armour") && !isExcludedCrystalItem(item),
);

const rows = [];
const seenFamilies = new Set();

for (const item of gearItems) {
  const game = gameItemForCrystal(item.name, gameItems);
  const inGame = isImplementedInGame(item.name, gameItems);
  const recent = Boolean(game && RECENT_GAME_IDS.has(game.id));
  const family = crystalFamily(item.name);
  const showRow = !inGame || recent;
  if (!showRow) continue;

  const visualLayer = item.type === "Weapon" ? "weapon" : "armour";
  const shape = Number(game?.visual?.index ?? item.shape) || 0;
  const frame = Number(game?.icon?.frame ?? item.icon?.frame) || 0;
  const statClass = primaryStatClass(item);
  const crystalDrops = mergeDropSources(item.name, dropIndex, monsterByDropPath);
  const reqLevel = Number(item.requiredAmount) || 0;

  rows.push({
    crystalIndex: item.crystalIndex,
    crystalName: item.name,
    displayName: displayName(item.name),
    family,
    type: item.type,
    visualLayer,
    statClass,
    statClassLabel: classLabels[statClass].label,
    requirement: requirementLabel(item),
    reqLevel,
    stats: statsSummary(item),
    price: Number(item.price) || 0,
    shape,
    frame,
    hasWorldSprite: hasWorldSprite(visualLayer, shape),
    hasStateitem: hasStateitemFrame(frame, stateitems),
    worldStanding: standingFrameMeta(visualLayer, shape),
    baseArmourStanding: item.type === "Weapon" ? standingFrameMeta("armour", 0) : null,
    baseHairStanding: standingFrameMeta("hair", 0),
    icon: iconHref(frame),
    inGame,
    recent,
    gameId: game?.id ?? "",
    gameDrops: game ? gameDropLines(game, bossTables) : [],
    crystalDrops: crystalDrops.map((d) => ({
      dropPath: d.dropPath,
      rateText: d.rateText,
      ratePct: `${((d.rate ?? 0) * 100).toFixed(3).replace(/\.?0+$/, "")}%`,
      matchedName: d.matchedName !== item.name ? d.matchedName : "",
      monsters: d.monsters.map((m) => m.name),
    })),
  });
}

rows.sort((a, b) => {
  if (a.recent !== b.recent) return a.recent ? -1 : 1;
  if (a.inGame !== b.inGame) return a.inGame ? -1 : 1;
  if (a.reqLevel !== b.reqLevel) return a.reqLevel - b.reqLevel;
  return a.displayName.localeCompare(b.displayName);
});

const payload = {
  generatedAt: new Date().toISOString(),
  dropFilesScanned: dropFiles.length,
  paperDollFrames: Object.fromEntries(
    Object.entries(stateitems).map(([key, frame]) => [
      key,
      {
        src: `../../public/ui/character/stateitem-${key}.png`,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
      },
    ]),
  ),
  counts: {
    totalRows: rows.length,
    unused: rows.filter((r) => !r.inGame).length,
    recentInGame: rows.filter((r) => r.recent).length,
    weapons: rows.filter((r) => r.type === "Weapon").length,
    armours: rows.filter((r) => r.type === "Armour").length,
    withCrystalDrops: rows.filter((r) => r.crystalDrops.length).length,
    withWorldSprite: rows.filter((r) => r.hasWorldSprite).length,
    withStateitem: rows.filter((r) => r.hasStateitem).length,
  },
  rows,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "catalog.json"), `${JSON.stringify(payload, null, 2)}\n`);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Unused Gear Catalog</title>
    <style>
      :root { color-scheme: dark; --bg: #0f1115; --panel: #171a21; --line: #2d3340; --text: #e8eaed; --muted: #9aa3b2; --accent: #7eb6ff; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font: 13px/1.45 Segoe UI, system-ui, sans-serif; }
      header { position: sticky; top: 0; z-index: 10; background: #12151b; border-bottom: 1px solid var(--line); padding: 14px 18px; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      .sub { margin: 0; color: var(--muted); max-width: 1100px; }
      .stats { margin-top: 8px; color: #c6d0df; font-size: 12px; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }
      .controls input, .controls select { background: #222833; color: var(--text); border: 1px solid #3a4354; border-radius: 4px; padding: 6px 10px; }
      #search { min-width: 280px; }
      .pill { border: 1px solid #3a4354; background: #222833; color: #eee; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
      .pill.active { border-color: #7a879c; background: #2b3342; }
      .layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 130px); }
      aside { border-right: 1px solid var(--line); background: #141820; padding: 12px; overflow: auto; }
      aside h2 { margin: 0 0 8px; font-size: 14px; color: #ddd; }
      .type-btn { display: block; width: 100%; text-align: left; border: 1px solid transparent; background: transparent; color: #ccc; padding: 6px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; }
      .type-btn:hover { background: #222833; }
      .type-btn.active { background: #262d3a; border-color: #555; color: #fff; }
      main { overflow: auto; padding: 12px; }
      .gear-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); gap: 12px; }
      .gear-card { display: grid; grid-template-columns: 210px 1fr; gap: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
      .gear-card.recent { border-color: #456087; background: #171f2b; }
      .previews { display: flex; flex-direction: column; gap: 8px; }
      .preview-box { background: #090b10; border: 1px solid #333; border-radius: 4px; padding: 6px; }
      .preview-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #8fa6c7; margin-bottom: 4px; }
      .paper-doll-host { position: relative; width: 112px; height: 128px; margin: 0 auto; overflow: hidden; border-radius: 3px; }
      .paper-doll-inner { position: relative; transform-origin: top left; transform: scale(0.45); width: 248px; height: 284px; }
      .paper-doll-bg { position: absolute; inset: 0; background: url("../../public/ui/character/character-panel.png") 0 0 / 248px 284px no-repeat; }
      .paper-doll-layers { position: absolute; inset: 0; }
      .paper-doll-layers img { position: absolute; image-rendering: pixelated; }
      .world-canvas { display: block; margin: 0 auto; image-rendering: pixelated; background: #0a0c12; border-radius: 3px; }
      .preview-note { font-size: 10px; color: #c9a227; text-align: center; margin-top: 4px; line-height: 1.3; }
      .preview-missing { font-size: 10px; color: #d97777; text-align: center; margin-top: 4px; line-height: 1.3; }
      .info-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
      .icon { width: 36px; height: 36px; object-fit: contain; image-rendering: pixelated; background: #090b10; border: 1px solid #333; flex-shrink: 0; }
      .name { font-weight: 600; font-size: 14px; }
      .code { color: #94a3b8; font-size: 11px; margin-top: 2px; }
      .meta-row { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-bottom: 8px; font-size: 12px; color: #c6d0df; }
      .meta-row span { color: var(--muted); }
      .badge { display: inline-block; font-size: 10px; padding: 2px 7px; border-radius: 999px; margin-right: 4px; }
      .badge.recent { background: #2a3448; color: #9ecbff; border: 1px solid #456087; }
      .badge.ingame { background: #1e3a2f; color: #86efac; }
      .badge.unused { background: #3a2424; color: #f0b4b4; }
      .badge.ok { background: #1e3a2f; color: #86efac; }
      .badge.warn { background: #3a3424; color: #f2cc60; }
      .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #9aa3b2; margin: 8px 0 4px; }
      .drop { margin: 0 0 4px; font-size: 12px; color: #d6dee8; }
      .drop .path { color: #8fa6c7; font-size: 11px; }
      .drop .rate { color: #f2cc60; font-weight: 600; }
      .muted { color: var(--muted); }
      .empty { padding: 40px; color: var(--muted); text-align: center; }
      @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--line); } .gear-grid { grid-template-columns: 1fr; } .gear-card { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <h1>Unused Armour &amp; Weapons</h1>
      <p class="sub">Crystal gear not yet in idle (War / Wiz / Tao only — Assassin &amp; Archer excluded), plus recently added OKS items. Each row shows how the item looks on the character screen paper doll and in-world standing pose.</p>
      <p class="stats" id="summary"></p>
      <div class="controls">
        <input id="search" type="search" placeholder="Search name, stats, drop path, monster…" />
        <select id="status">
          <option value="all">All shown</option>
          <option value="unused">Unused only</option>
          <option value="recent">Recently added</option>
          <option value="ingame">In game only</option>
        </select>
        <select id="sort">
          <option value="recent-level">Recent → Level</option>
          <option value="level">Level (low → high)</option>
          <option value="level-desc">Level (high → low)</option>
          <option value="name">Name</option>
          <option value="drops">Has Crystal drops first</option>
        </select>
        <button type="button" class="pill active" data-type="all">All types</button>
        <button type="button" class="pill" data-type="Weapon">Weapons</button>
        <button type="button" class="pill" data-type="Armour">Armours</button>
      </div>
    </header>
    <div class="layout">
      <aside>
        <h2>Class</h2>
        <button type="button" class="type-btn active" data-class="all">All classes</button>
        <button type="button" class="type-btn" data-class="warrior">Warrior</button>
        <button type="button" class="type-btn" data-class="wizard">Wizard</button>
        <button type="button" class="type-btn" data-class="taoist">Taoist</button>
        <button type="button" class="type-btn" data-class="hybrid">Hybrid</button>
        <button type="button" class="type-btn" data-class="other">Other</button>
      </aside>
      <main>
        <div class="gear-grid" id="rows"></div>
        <div class="empty" id="empty" hidden>No matching items.</div>
      </main>
    </div>
    <script>
      const DATA = ${JSON.stringify(payload)};
      const ASSET_ROOT = "../../public";
      const PANEL_W = 248;
      const PANEL_H = 284;
      const PANEL_SCALE = 0.45;
      const HAIR_FRAME = { src: ASSET_ROOT + "/ui/character/hair-441.png", x: 131, y: 173, w: 16, h: 14 };
      const PAPER_DOLL_FALLBACK = {
        30: { src: ASSET_ROOT + "/ui/character/stateitem-30.png", x: 75, y: 186, w: 28, h: 57 },
        31: { src: ASSET_ROOT + "/ui/character/stateitem-31.png", x: 73, y: 179, w: 32, h: 67 },
        36: { src: ASSET_ROOT + "/ui/character/stateitem-36.png", x: 71, y: 172, w: 36, h: 74 },
        54: { src: ASSET_ROOT + "/ui/character/stateitem-54.png", x: 57, y: 139, w: 52, h: 115 },
        60: { src: ASSET_ROOT + "/ui/character/stateitem-60.png", x: 92, y: 194, w: 80, h: 128 },
        110: { src: ASSET_ROOT + "/ui/character/stateitem-110.png", x: 130, y: 172, w: 16, h: 20 },
      };

      const state = { type: "all", className: "all", status: "all", search: "", sort: "recent-level" };
      const summary = document.getElementById("summary");
      const rowsEl = document.getElementById("rows");
      const emptyEl = document.getElementById("empty");

      let stateitems = null;
      const imageCache = new Map();
      const atlasCache = new Map();
      const rendered = new WeakSet();

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
      }

      function getStateitems() {
        if (!stateitems) {
          stateitems = { ...DATA.paperDollFrames };
          for (const [key, frame] of Object.entries(PAPER_DOLL_FALLBACK)) {
            if (!stateitems[key]) stateitems[key] = frame;
          }
        }
        return stateitems;
      }

      function loadImage(url) {
        if (imageCache.has(url)) return imageCache.get(url);
        const promise = new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });
        imageCache.set(url, promise);
        return promise;
      }

      async function loadAtlas(layer, index) {
        const key = layer + ":" + index;
        if (atlasCache.has(key)) return atlasCache.get(key);
        const url = ASSET_ROOT + "/sprite-sets/common/" + layer + "/" + index + ".json";
        const promise = fetch(url)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        atlasCache.set(key, promise);
        return promise;
      }

      function drawEmbeddedFrame(ctx, layer, index, meta, anchorX, anchorY) {
        if (!meta) return Promise.resolve(false);
        return loadImage(ASSET_ROOT + "/sprite-sets/common/" + layer + "/" + index + ".png").then((sheet) => {
          if (!sheet) return false;
          ctx.drawImage(
            sheet,
            meta.slot * meta.slotWidth,
            0,
            meta.slotWidth,
            meta.slotHeight,
            anchorX + meta.offsetX,
            anchorY + meta.offsetY,
            meta.slotWidth,
            meta.slotHeight,
          );
          return true;
        });
      }

      async function drawAtlasFrame(ctx, layer, index, anchorX, anchorY, embeddedMeta) {
        if (embeddedMeta) return drawEmbeddedFrame(ctx, layer, index, embeddedMeta, anchorX, anchorY);
        const atlas = await loadAtlas(layer, index);
        if (!atlas?.actions?.standing?.frames?.length) return false;
        const meta = atlas.actions.standing.frames[0];
        if (meta.empty) return false;
        return drawEmbeddedFrame(ctx, layer, index, {
          slotWidth: atlas.slotWidth,
          slotHeight: atlas.slotHeight,
          slot: meta.slot,
          offsetX: meta.offsetX,
          offsetY: meta.offsetY,
        }, anchorX, anchorY);
      }

      function paperDollFrame(frameId, items) {
        const key = String(frameId);
        return items[key] ?? PAPER_DOLL_FALLBACK[key] ?? null;
      }

      function addPaperLayer(parent, frame) {
        if (!frame) return;
        const img = document.createElement("img");
        img.src = frame.src;
        img.alt = "";
        img.style.left = frame.x + "px";
        img.style.top = frame.y + "px";
        img.style.width = frame.w + "px";
        img.style.height = frame.h + "px";
        parent.appendChild(img);
      }

      async function renderPaperDoll(host, row) {
        const items = getStateitems();
        host.innerHTML = "";
        const inner = document.createElement("div");
        inner.className = "paper-doll-inner";
        inner.style.transform = "scale(" + PANEL_SCALE + ")";
        const bg = document.createElement("div");
        bg.className = "paper-doll-bg";
        inner.appendChild(bg);
        const layers = document.createElement("div");
        layers.className = "paper-doll-layers";
        const itemFrame = paperDollFrame(row.frame, items);
        if (row.hasStateitem && itemFrame) addPaperLayer(layers, itemFrame);
        addPaperLayer(layers, HAIR_FRAME);
        inner.appendChild(layers);
        host.appendChild(inner);
        const noteHost = host.parentElement;
        const oldNote = noteHost.querySelector(".preview-note, .preview-missing");
        if (oldNote) oldNote.remove();
        if (!row.hasStateitem) {
          const note = document.createElement("div");
          note.className = "preview-missing";
          note.textContent = "StateItem frame " + row.frame + " not exported";
          noteHost.appendChild(note);
        }
      }

      async function renderWorldCanvas(canvas, row) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const anchorX = canvas.width / 2;
        const anchorY = canvas.height - 8;
        let drewItem = false;
        if (row.type === "Armour") {
          if (row.hasWorldSprite) {
            drewItem = await drawAtlasFrame(ctx, "armour", row.shape, anchorX, anchorY, row.worldStanding);
          }
          await drawAtlasFrame(ctx, "hair", 0, anchorX, anchorY, row.baseHairStanding);
        } else {
          await drawAtlasFrame(ctx, "armour", 0, anchorX, anchorY, row.baseArmourStanding);
          await drawAtlasFrame(ctx, "hair", 0, anchorX, anchorY, row.baseHairStanding);
          if (row.hasWorldSprite) {
            drewItem = await drawAtlasFrame(ctx, "weapon", row.shape, anchorX, anchorY, row.worldStanding);
          }
        }
        const noteHost = canvas.parentElement;
        const oldNote = noteHost.querySelector(".preview-note, .preview-missing");
        if (oldNote) oldNote.remove();
        if (!row.hasWorldSprite) {
          const note = document.createElement("div");
          note.className = "preview-missing";
          note.textContent = row.visualLayer + " shape " + row.shape + " not exported";
          noteHost.appendChild(note);
        } else if (!drewItem) {
          const note = document.createElement("div");
          note.className = "preview-note";
          note.textContent = "Sprite atlas loaded but standing frame empty";
          noteHost.appendChild(note);
        }
      }

      async function renderPreviews(card, row) {
        if (rendered.has(card)) return;
        rendered.add(card);
        const paperHost = card.querySelector(".paper-doll-host");
        const worldCanvas = card.querySelector(".world-canvas");
        await Promise.all([
          renderPaperDoll(paperHost, row),
          renderWorldCanvas(worldCanvas, row),
        ]);
      }

      function dropHtml(drops) {
        if (!drops.length) return '<span class="muted">No Crystal drop file match</span>';
        return drops.slice(0, 5).map((d) => {
          const monsters = d.monsters.length ? d.monsters.slice(0, 3).join(", ") + (d.monsters.length > 3 ? "…" : "") : "Unknown monster";
          const alias = d.matchedName ? " · as " + escapeHtml(d.matchedName) : "";
          return '<div class="drop"><span class="rate">' + escapeHtml(d.rateText) + '</span> (' + escapeHtml(d.ratePct) + ')' + alias + ' · ' + escapeHtml(monsters) + '<div class="path">' + escapeHtml(d.dropPath) + '</div></div>';
        }).join("") + (drops.length > 5 ? '<div class="muted">+' + (drops.length - 5) + ' more sources</div>' : "");
      }

      function statusHtml(row) {
        const badges = [];
        if (row.recent) badges.push('<span class="badge recent">Recently added</span>');
        badges.push(row.inGame ? '<span class="badge ingame">In idle</span>' : '<span class="badge unused">Not in idle</span>');
        badges.push(row.hasStateitem ? '<span class="badge ok">Paper doll</span>' : '<span class="badge warn">No paper doll</span>');
        badges.push(row.hasWorldSprite ? '<span class="badge ok">World sprite</span>' : '<span class="badge warn">No world sprite</span>');
        const game = row.gameId ? '<div class="code">Game id: ' + escapeHtml(row.gameId) + '</div>' : "";
        const idleDrops = row.gameDrops.length
          ? row.gameDrops.map((line) => '<div class="drop">' + escapeHtml(line) + '</div>').join("")
          : '<span class="muted">No idle drop table yet</span>';
        return badges.join("") + game + idleDrops;
      }

      function filteredRows() {
        let list = DATA.rows.slice();
        if (state.type !== "all") list = list.filter((row) => row.type === state.type);
        if (state.className !== "all") list = list.filter((row) => row.statClass === state.className);
        if (state.status === "unused") list = list.filter((row) => !row.inGame);
        if (state.status === "recent") list = list.filter((row) => row.recent);
        if (state.status === "ingame") list = list.filter((row) => row.inGame);
        const q = state.search.trim().toLowerCase();
        if (q) {
          list = list.filter((row) => [
            row.displayName, row.crystalName, row.stats, row.gameId,
            ...row.crystalDrops.flatMap((d) => [d.dropPath, ...(d.monsters ?? [])]),
            ...row.gameDrops,
          ].join(" ").toLowerCase().includes(q));
        }
        if (state.sort === "level") list.sort((a, b) => a.reqLevel - b.reqLevel || a.displayName.localeCompare(b.displayName));
        if (state.sort === "level-desc") list.sort((a, b) => b.reqLevel - a.reqLevel || a.displayName.localeCompare(b.displayName));
        if (state.sort === "name") list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (state.sort === "drops") list.sort((a, b) => (b.crystalDrops.length - a.crystalDrops.length) || a.displayName.localeCompare(b.displayName));
        return list;
      }

      function cardHtml(row) {
        return '<article class="gear-card' + (row.recent ? " recent" : "") + '" data-key="' + row.crystalIndex + '">' +
          '<div class="previews">' +
            '<div class="preview-box"><div class="preview-label">Character screen</div><div class="paper-doll-host"></div></div>' +
            '<div class="preview-box"><div class="preview-label">In world (standing)</div><canvas class="world-canvas" width="120" height="140"></canvas></div>' +
          '</div>' +
          '<div class="info">' +
            '<div class="info-head">' +
              (row.icon ? '<img class="icon" src="' + escapeHtml(row.icon) + '" alt="" />' : '') +
              '<div><div class="name">' + escapeHtml(row.displayName) + '</div>' +
              '<div class="code">' + escapeHtml(row.crystalName) + ' · idx ' + row.crystalIndex + ' · ' + escapeHtml(row.type) + ' · shape ' + row.shape + ' · frame ' + row.frame + '</div></div>' +
            '</div>' +
            '<div class="meta-row"><span>Class</span> ' + escapeHtml(row.statClassLabel) +
              ' · <span>Req</span> ' + escapeHtml(row.requirement || "—") +
              ' · <span>Stats</span> ' + escapeHtml(row.stats) + '</div>' +
            '<div class="section-title">Crystal drops</div>' + dropHtml(row.crystalDrops) +
            '<div class="section-title">Idle status</div>' + statusHtml(row) +
          '</div>' +
        '</article>';
      }

      let observer = null;
      function bindObserver() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const card = entry.target;
            const key = Number(card.dataset.key);
            const row = DATA.rows.find((r) => r.crystalIndex === key);
            if (row) renderPreviews(card, row);
            observer.unobserve(card);
          }
        }, { rootMargin: "120px" });
        for (const card of rowsEl.querySelectorAll(".gear-card")) observer.observe(card);
      }

      function render() {
        const list = filteredRows();
        summary.textContent = list.length + " shown · " + DATA.counts.unused + " unused · " + DATA.counts.recentInGame + " recently added · " +
          DATA.counts.withWorldSprite + " with world sprites · " + DATA.counts.withStateitem + " with paper doll frames · " +
          DATA.counts.withCrystalDrops + " with Crystal drop data · " + DATA.dropFilesScanned + " drop files scanned";
        rowsEl.innerHTML = list.map(cardHtml).join("");
        emptyEl.hidden = list.length > 0;
        bindObserver();
      }

      document.getElementById("search").addEventListener("input", (e) => { state.search = e.target.value; render(); });
      document.getElementById("status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
      document.getElementById("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
      document.querySelectorAll("[data-type]").forEach((btn) => btn.addEventListener("click", () => {
        document.querySelectorAll("[data-type]").forEach((el) => el.classList.toggle("active", el === btn));
        state.type = btn.dataset.type;
        render();
      }));
      document.querySelectorAll("[data-class]").forEach((btn) => btn.addEventListener("click", () => {
        document.querySelectorAll("[data-class]").forEach((el) => el.classList.toggle("active", el === btn));
        state.className = btn.dataset.class;
        render();
      }));
      render();
    </script>
  </body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`Wrote ${rows.length} rows to ${outDir}`);
console.log(`Counts:`, payload.counts);
