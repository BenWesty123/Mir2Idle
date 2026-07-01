import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dropRoot = "C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Envir/Drops";

const idOverrides = {
  "(HP)DrugLarge": "hp-drug-large",
  "(MP)DrugLarge": "mp-drug-large",
  "(HP)DrugXL": "hp-drug-xl",
  "(MP)DrugXL": "mp-drug-xl",
  "SunPotion(M)": "sun-potion-medium",
  SunPotion: "sun-potion",
  "ImpactDrug(L)": "impact-drug-l",
  "MagicDrug(L)": "magic-drug-l",
  "TaoistDrug(L)": "taoist-drug-l",
  "StormDrug(L)": "storm-drug-l",
  BenedictionOil: "benediction-oil",
  AwakeningSoul0: "awakening-soul",
  GoldBar: "gold-bar",
  OldGinseng: "old-ginseng",
  DemonMask: "demon-mask",
  KunroonTear: "kunroon-tear",
  VioletOrb: "violet-orb",
  RedDemonRing: "red-demon-ring",
  CloudRing: "cloud-ring",
  PoisonRing: "poison-ring",
  BraveryOrb: "braveryorb",
  MagicOrb: "magicorb",
  SoulOrb: "soulorb",
  ProtectionOrb: "protectionorb",
  EvilSlayerOrb: "evilslayerorb",
  DurabilityOrb: "durabilityorb",
  PoisonOrb: "poisonorb",
  FreezingOrb: "freezingorb",
  AccuracyOrb: "accuracyorb",
  StormOrb: "stormorb",
  EnduranceOrb: "enduranceorb",
  FlamingSword: "book-flaming-sword",
  IceStorm: "book-ice-storm",
  SummonShinsu: "book-summon-shinsu",
  SummonHolyDeva: "book-summon-holy-deva",
  UltimateEnhancer: "book-ultimate-enhancer",
  CrossHalfMoon: "book-cross-half-moon",
  BladeAvalanche: "book-blade-avalanche",
  ProtectionField: "book-protection-field",
  Reincarnation: "book-reincarnation",
  PoisonCloud: "book-poison-cloud",
  FlameDisruptor: "book-flame-disruptor",
  Mirroring: "book-mirroring",
  MeteorStrike: "book-meteor-strike",
  Rage: "book-rage",
  Blizzard: "book-blizzard",
  FlameField: "book-flame-field",
  Curse: "book-curse",
  Plague: "book-plague",
  MagicBooster: "book-magic-booster",
  LionRoar: "book-lion-roar",
  BladeStorm: "book-blade-storm",
};

const nameOverrides = {
  AwakeningSoul0: "Awakening Soul",
  SunPotion: "Sun Potion",
  "(HP)DrugLarge": "Large HP Drug",
};

function displayName(name) {
  if (nameOverrides[name]) return nameOverrides[name];
  return name
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFor(item) {
  if (idOverrides[item.name]) return idOverrides[item.name];
  const baseName = item.type === "Armour" ? item.name.replace(/\(M\)$/, "") : item.name;
  return displayName(baseName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDropNames(filePath) {
  const names = new Set();
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;
    const match = trimmed.match(/^(\d+)\/(\d+)\s+(.+?)(?:\s+(Q|LV\d+))?$/i);
    if (!match || /^Gold(\s|$)/i.test(match[3])) continue;
    names.add(match[3].trim());
  }
  return names;
}

const trashFiles = [
  "WasteLand/RedCavern/GhastlyLeecher.txt",
  "WasteLand/RedCavern/GhastlyLeecher0.txt",
  "WasteLand/RedCavern/MutatedManworm.txt",
  "WasteLand/RedCavern/MutatedManworm0.txt",
  "WasteLand/RedCavern/CrazyManworm.txt",
  "WasteLand/RedCavern/CrazyManworm0.txt",
  "WasteLand/RedCavern/CyanoGhast.txt",
  "WasteLand/RedCavern/CyanoGhast0.txt",
];
const bossFiles = [
  "WasteLand/RedCavern/DreamDevourer.txt",
  "WasteLand/RedCavern/DreamDevourer0.txt",
  "WasteLand/RedCavern/DarkDevourer.txt",
  "WasteLand/RedCavern/DarkDevourer0.txt",
];

function collectDropNames(files) {
  const names = new Set();
  for (const file of files) {
    for (const name of parseDropNames(path.join(dropRoot, file))) names.add(name);
  }
  return names;
}

const trashDropNames = collectDropNames(trashFiles);
const bossDropNames = collectDropNames(bossFiles);

const crystalItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
const crystalByName = new Map(crystalItems.map((item) => [item.name, item]));
const gameItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8")).items;
const gameById = new Map(gameItems.map((item) => [item.id, item]));
const gameIds = new Set(gameItems.map((item) => item.id));

function classifyDropNames(dropNames) {
  const inGame = [];
  const missingItemDef = [];
  const missingCrystal = [];
  for (const name of [...dropNames].sort()) {
    const crystal = crystalByName.get(name);
    if (!crystal) {
      missingCrystal.push(name);
      continue;
    }
    const id = slugFor(crystal);
    if (gameIds.has(id)) inGame.push({ name, id, type: crystal.type });
    else missingItemDef.push({ name, id, type: crystal.type });
  }
  return { inGame, missingItemDef, missingCrystal };
}

const trash = classifyDropNames(trashDropNames);
const boss = classifyDropNames(bossDropNames);

const zones = ["zone-red-cavern-1", "zone-red-cavern-2", "zone-red-cavern-kr"];
function unwiredEntries(inGame) {
  return inGame.filter(
    (entry) => !zones.some((zoneId) => gameById.get(entry.id)?.drop?.zones?.includes(zoneId)),
  );
}
const trashUnwired = unwiredEntries(trash.inGame);
const bossUnwired = unwiredEntries(boss.inGame);

const bossDropSource = fs.readFileSync(path.join(root, "src/bossDrops.js"), "utf8");
const bossDropLabels = [...bossDropSource.matchAll(/"([^"]+)":\s*[A-Z_]+_BOSS_DROPS/g)].map((m) => m[1]);
const devourerInBossDrops = bossDropLabels.some((label) => /devourer/i.test(label));

function groupByType(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!map.has(entry.type)) map.set(entry.type, []);
    map.get(entry.type).push(entry.name);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

console.log(JSON.stringify({
  summary: {
    trashUniqueDrops: trashDropNames.size,
    bossUniqueDrops: bossDropNames.size,
    devourerInBossDrops,
    redCavernZoneItemDrops: 0,
  },
  trash: {
    uniqueDrops: [...trashDropNames].sort(),
    inGameNotWired: trashUnwired.map((entry) => ({ name: entry.name, id: entry.id, type: entry.type })),
    missingItemDefinitions: trash.missingItemDef.map((entry) => ({ name: entry.name, id: entry.id, type: entry.type })),
  },
  boss: {
    inGameNotWired: bossUnwired.map((entry) => ({ name: entry.name, id: entry.id, type: entry.type })),
    missingItemDefinitions: boss.missingItemDef.map((entry) => ({ name: entry.name, id: entry.id, type: entry.type })),
    notInCrystalItemsJson: boss.missingCrystal,
    missingByType: Object.fromEntries(groupByType(boss.missingItemDef).map(([type, names]) => [type, names])),
  },
}, null, 2));
