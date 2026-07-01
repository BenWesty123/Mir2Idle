import fs from "node:fs";
import path from "node:path";
import { slugFor } from "./lib/item-from-crystal.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dropRoot =
  "C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Envir/Drops";

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
  "ImpactDrug(M)": "impact-drug-m",
  "MagicDrug(M)": "magic-drug-m",
  "TaoistDrug(M)": "taoist-drug-m",
  "StormDrug(S)": "storm-drug-s",
  BenedictionOil: "benediction-oil",
  GoldBar: "gold-bar",
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
  HealthStone: "healthstone",
  "HealthStone(L)": "healthstone",
  "HealthStone(XL)": "healthstone",
  MagicStone: "magicstone",
  "MagicStone(L)": "magicstone",
  "MagicStone(XL)": "magicstone",
  MCStone: "mcstone",
  "MCStone(L)": "mcstone",
  "MCStone(XL)": "mcstone",
  SCStone: "scstone",
  "SCStone(L)": "scstone",
  "SCStone(XL)": "scstone",
  DCStone: "dcstone",
  "DCStone(L)": "dcstone",
  "DCStone(XL)": "dcstone",
  "PowerStone(L)": "powerstone",
  "PowerStone(XL)": "powerstone",
  AmuletOfRevival: "amulet-of-revival",
  lightbody: "book-light-body",
  Hallucination: "book-hallucination",
  Vampirism: "book-vampirism",
  FrostCrunch: "book-frost-crunch",
  MagicShield: "book-magic-shield",
};

function slugForName(crystal) {
  if (idOverrides[crystal.name]) return idOverrides[crystal.name];
  return slugFor(crystal);
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

const mobFiles = {
  Demon1: "WasteLand/HellCavern/Demon1.txt",
  Demon2: "WasteLand/HellCavern/Demon2.txt",
  HellSlasher: "WasteLand/HellCavern/HellSlasher.txt",
  HellPirate: "WasteLand/HellCavern/HellPirate.txt",
  HellCannibal: "WasteLand/HellCavern/HellCannibal.txt",
  HellBolt: "WasteLand/HellCavern/HellBolt.txt",
  WitchDoctor: "WasteLand/HellCavern/WitchDoctor.txt",
  HellKeeper: "WasteLand/HellCavern/HellKeeper.txt",
  CaveWitch: "WasteLand/HellCavern/CaveWitch.txt",
};

const crystalItems = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8"),
).items;
const crystalByName = new Map(crystalItems.map((item) => [item.name, item]));
const gameItems = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/items.json"), "utf8"),
).items;
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
    const id = slugForName(crystal);
    if (gameIds.has(id)) inGame.push({ name, id, type: crystal.type });
    else missingItemDef.push({ name, id, type: crystal.type });
  }
  return { inGame, missingItemDef, missingCrystal };
}

function groupByType(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!map.has(entry.type)) map.set(entry.type, []);
    map.get(entry.type).push(entry.name);
  }
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const allNames = new Set();
const byMob = {};
for (const [mob, file] of Object.entries(mobFiles)) {
  const names = parseDropNames(path.join(dropRoot, file));
  byMob[mob] = [...names].sort();
  for (const name of names) allNames.add(name);
}

const all = classifyDropNames(allNames);
const trashMobs = ["Demon1", "Demon2"];
const trashNames = new Set();
for (const mob of trashMobs) {
  for (const name of byMob[mob]) trashNames.add(name);
}
const trash = classifyDropNames(trashNames);

const eliteMobs = ["HellSlasher", "HellPirate", "HellCannibal", "HellBolt", "WitchDoctor"];
const eliteNames = new Set();
for (const mob of eliteMobs) {
  for (const name of byMob[mob]) eliteNames.add(name);
}
const elite = classifyDropNames(eliteNames);

const bossNames = new Set([...byMob.HellKeeper, ...byMob.CaveWitch]);
const boss = classifyDropNames(bossNames);

const hellZones = ["zone-hell-gd-1", "zone-hell-gd-2", "zone-hell-gd-3"];
function unwiredEntries(inGame) {
  return inGame.filter(
    (entry) => !hellZones.some((zoneId) => gameById.get(entry.id)?.drop?.zones?.includes(zoneId)),
  );
}

const bossDropSource = fs.readFileSync(path.join(root, "src/bossDrops.js"), "utf8");
const hellBossTables = /Hell Keeper|HellKeeper|Cave Witch|CaveWitch/i.test(bossDropSource);

console.log(
  JSON.stringify(
    {
      summary: {
        crystalUniqueDrops: allNames.size,
        inGameItemDefs: all.inGame.length,
        missingItemDefs: all.missingItemDef.length,
        notInCrystalCatalog: all.missingCrystal.length,
        wiredToHellGdZones: all.inGame.filter((e) =>
          hellZones.some((z) => gameById.get(e.id)?.drop?.zones?.includes(z)),
        ).length,
        hellBossTablesInBossDropsJs: hellBossTables,
      },
      byMobDropCounts: Object.fromEntries(Object.entries(byMob).map(([k, v]) => [k, v.length])),
      missingItemDefinitionsByType: groupByType(all.missingItemDef),
      missingItemDefinitions: all.missingItemDef,
      notInCrystalItemsJson: all.missingCrystal,
      inGameButNotWiredToHellZones: unwiredEntries(all.inGame),
      trashMobDrops: {
        unique: trashNames.size,
        missingItemDefs: trash.missingItemDef.length,
        missingByType: groupByType(trash.missingItemDef),
      },
      eliteMobDrops: {
        unique: eliteNames.size,
        missingItemDefs: elite.missingItemDef.length,
        missingByType: groupByType(elite.missingItemDef),
      },
      bossDrops: {
        unique: bossNames.size,
        missingItemDefs: boss.missingItemDef.length,
        missingByType: groupByType(boss.missingItemDef),
        bossOnlyMissing: boss.missingItemDef.filter(
          (e) => !trash.inGame.some((t) => t.name === e.name) && !elite.inGame.some((t) => t.name === e.name),
        ),
      },
    },
    null,
    2,
  ),
);
