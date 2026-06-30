import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const selectionCsvPath = path.join(root, "content-audit/phase-1/warrior-item-selection.csv");
const dropCsvPath = path.join(root, "content-audit/phase-1/drop-candidates-by-zone.csv");
const curatedDropCsvPath = path.join(root, "content-audit/phase-1/idle-drop-items.csv");
const crystalItemsPath = path.join(root, "src/data/crystal-items.json");
const itemsOutputPath = path.join(root, "src/data/items.json");
const publicIconRoot = path.join(root, "public/item-icons/items");
const allowItemRemoval = process.argv.includes("--allow-item-removal");

const zoneIds = {
  "Bicheon 1": "zone-bicheon-1",
  "Bicheon 2": "zone-bicheon-2",
  "Bicheon 3": "zone-bicheon-3",
  "Bone Cave 1": "zone-bone-cave-1",
  "Bone Cave 2": "zone-bone-cave-2",
  "Bone Cave KR": "zone-bone-cave-kr",
  "Dead Mines 1": "zone-dead-mines-1",
  "Dead Mines 2": "zone-dead-mines-2",
  "Dead Mines KR": "zone-dead-mines-kr",
  "Insect Cave 1": "zone-insect-cave-1",
  "Insect Cave 2": "zone-insect-cave-2",
  "Insect Cave KR": "zone-insect-cave-kr",
  "Bug Cave 1": "zone-bug-cave-1",
  "Bug Cave 2": "zone-bug-cave-2",
  "Wooma Temple 1": "zone-wooma-temple-1",
  "Wooma Temple 2": "zone-wooma-temple-2",
  "Stone Temple 1": "zone-stone-temple-1",
  "Stone Temple 2": "zone-stone-temple-2",
  "Zuma Temple 1": "zone-zuma-temple-1",
  "Zuma Temple 2": "zone-zuma-temple-2",
  "Prajna Cave 1": "zone-prajna-cave-1",
  "Prajna Cave 2": "zone-prajna-cave-2",
  "Prajna Temple 1": "zone-prajna-temple-1",
  "Prajna Temple 2": "zone-prajna-temple-2",
  "Viper Cave 1": "zone-viper-cave-1",
};

const curatedDropColumns = [
  ["Bicheon 1 chance", "zone-bicheon-1"],
  ["Bicheon 2 chance", "zone-bicheon-2"],
  ["Bicheon 3 chance", "zone-bicheon-3"],
  ["Bone Cave 1 chance", "zone-bone-cave-1"],
  ["Bone Cave 2 chance", "zone-bone-cave-2"],
  ["Bone Cave KR chance", "zone-bone-cave-kr"],
  ["Dead Mines 1 chance", "zone-dead-mines-1"],
  ["Dead Mines 2 chance", "zone-dead-mines-2"],
  ["Dead Mines KR chance", "zone-dead-mines-kr"],
  ["Insect Cave 1 chance", "zone-insect-cave-1"],
  ["Insect Cave 2 chance", "zone-insect-cave-2"],
  ["Insect Cave KR chance", "zone-insect-cave-kr"],
  ["Bug Cave 1 chance", "zone-bug-cave-1"],
  ["Bug Cave 2 chance", "zone-bug-cave-2"],
  ["Wooma Temple 1 chance", "zone-wooma-temple-1"],
  ["Wooma Temple 2 chance", "zone-wooma-temple-2"],
  ["Stone Temple 1 chance", "zone-stone-temple-1"],
  ["Stone Temple 2 chance", "zone-stone-temple-2"],
  ["Zuma Temple 1 chance", "zone-zuma-temple-1"],
  ["Zuma Temple 2 chance", "zone-zuma-temple-2"],
  ["Prajna Cave 1 chance", "zone-prajna-cave-1"],
  ["Prajna Cave 2 chance", "zone-prajna-cave-2"],
  ["Prajna Temple 1 chance", "zone-prajna-temple-1"],
  ["Prajna Temple 2 chance", "zone-prajna-temple-2"],
  ["Viper Cave 1 chance", "zone-viper-cave-1"],
];

const curatedEnemyDropColumns = [
  ["Wooma Guardian chance", "zone-wooma-temple-2", 253],
  ["White Boar chance", "zone-stone-temple-2", 265],
  ["Red Thunder Zuma chance", "zone-zuma-temple-2", 271],
];

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

const typeSlots = {
  Armour: "armour",
  Belt: "belt",
  Bracelet: "bracelet",
  Helmet: "helmet",
  Necklace: "necklace",
  Ring: "ring",
  Stone: "stone",
  Weapon: "weapon",
  Book: "book",
  Potion: "consumable",
  CraftingMaterial: "material",
  Quest: "material",
};

const idOverrides = {
  "BaseDress(M)": "base-dress",
  "(HP)DrugSmall": "hp-drug-small",
  "(MP)DrugSmall": "mp-drug-small",
  "(HP)DrugMedium": "hp-drug-medium",
  "(MP)DrugMedium": "mp-drug-medium",
  "(HP)DrugLarge": "hp-drug-large",
  "(MP)DrugLarge": "mp-drug-large",
  "(HP)DrugXL": "hp-drug-xl",
  "(MP)DrugXL": "mp-drug-xl",
  Amulet: "taoist-amulet",
  "SunPotion(M)": "sun-potion-medium",
  "ImpactDrug(S)": "impact-drug-s",
  "MagicDrug(S)": "magic-drug-s",
  "TaoistDrug(S)": "taoist-drug-s",
  "ImpactDrug(M)": "impact-drug-m",
  "MagicDrug(M)": "magic-drug-m",
  "TaoistDrug(M)": "taoist-drug-m",
  StrainBracelet: "strain-bracelet",
  MagicBracelet: "magic-bracelet",
  BlueJadeNecklace: "blue-jade-necklace",
  MoralRing: "moral-ring",
  SkeletonRing: "skeleton-ring",
  SkeletonHelmet: "skeleton-helmet",
  LifeNecklace: "life-necklace",
  SteelGlove: "steel-glove",
  "IronArmour(M)": "iron-armour",
  "WizardRobe(M)": "wizard-robe",
  "PearlArmour(M)": "pearl-armour",
  "DCStone(XL)": "dcstone-xl",
  "MCStone(XL)": "mcstone-xl",
  "SCStone(XL)": "scstone-xl",
  ZumaJudgementMace: "zuma-judgement-mace",
  ZumaWarMageStaff: "zuma-war-mage-staff",
  ZumaSoulSpringWand: "zuma-soul-spring-wand",
  GreenPoison: "green-poison",
  RedPoison: "yellow-poison",
  BenedictionOil: "benediction-oil",
  AwakeningSoul0: "awakening-soul",
  Fencing: "book-fencing",
  Slaying: "book-slaying",
  Thrusting: "book-thrusting",
  TwinDrakeBlade: "book-twin-drake-blade",
  FlamingSword: "book-flaming-sword",
  Fury: "book-fury",
  ImmortalSkin: "book-immortal-skin",
  FireBall: "book-fireball",
  GreatFireBall: "book-great-fireball",
  ThunderBolt: "book-thunderbolt",
  TurnUndead: "book-turn-undead",
  Vampirism: "book-vampirism",
  FireWall: "book-firewall",
  FrostCrunch: "book-frost-crunch",
  IceStorm: "book-ice-storm",
  Blizzard: "book-blizzard",
  MagicShield: "book-magic-shield",
  WornBeadofPhoenix: "worn-bead-of-phoenix",
  "SoulArmour(M)": "soul-armour",
  "TaoArmour(M)": "tao-armour",
  Healing: "book-healing",
  SpiritSword: "book-spirit-sword",
  Poisoning: "book-poisoning",
  PoisonCloud: "book-poison-cloud",
  Curse: "book-curse",
  Plague: "book-plague",
  SoulFireBall: "book-soul-fireball",
  SummonSkeleton: "book-summon-skeleton",
  SoulShield: "book-soul-shield",
  BlessedArmour: "book-blessed-armour",
  EnergyShield: "book-energy-shield",
  HealingCircle: "book-healing-circle",
  MassHealing: "book-mass-healing",
  UltimateEnhancer: "book-ultimate-enhancer",
  SummonShinsu: "book-summon-shinsu",
  SummonHolyDeva: "book-summon-holy-deva",
  PetEnhancer: "book-pet-enhancer",
};

const nameOverrides = {
  "BaseDress(M)": "Base Dress",
  "LightArmour(M)": "Light Armour",
  "SolidArmour(M)": "Solid Armour",
  "BoneRobe(M)": "Bone Robe",
  "MediumArmour(M)": "Medium Armour",
  "HeavyArmour(M)": "Heavy Armour",
  "MagicRobe(M)": "Magic Robe",
  "SoulArmour(M)": "Soul Armour",
  "IronArmour(M)": "Iron Armour",
  "WizardRobe(M)": "Wizard Robe",
  "PearlArmour(M)": "Pearl Armour",
  "TaoArmour(M)": "Tao Armour",
  ZumaJudgementMace: "Zuma Judgement Mace",
  ZumaWarMageStaff: "Zuma War Mage Staff",
  ZumaSoulSpringWand: "Zuma Soul Spring Wand",
  WornBeadofPhoenix: "Worn Bead of Phoenix",
  "(HP)DrugSmall": "Small HP Drug",
  "(MP)DrugSmall": "Small MP Drug",
  "(HP)DrugMedium": "Medium HP Drug",
  "(MP)DrugMedium": "Medium MP Drug",
  "(HP)DrugLarge": "Large HP Drug",
  "(MP)DrugLarge": "Large MP Drug",
  "(HP)DrugXL": "XL HP Drug",
  "(MP)DrugXL": "XL MP Drug",
  SunPotion: "Sun Potion",
  "SunPotion(M)": "Medium Sun Potion",
  Amulet: "Amulet",
  GreenPoison: "Green Poison",
  RedPoison: "Yellow Poison",
  LargeBone: "Large Bone",
  HeartOfDead: "Ghoul Heart",
  AwakeningSoul0: "Awakening Soul",
};

const stackSizeOverrides = {
  LargeBone: 64,
  HeartOfDead: 64,
  Amulet: 200,
  GreenPoison: 200,
  RedPoison: 200,
  BenedictionOil: 64,
  AwakeningSoul0: 1000,
};

const spellIds = new Map([
  ["Fencing", "Fencing"],
  ["Slaying", "Slaying"],
  ["Thrusting", "Thrusting"],
  ["FlamingSword", "FlamingSword"],
  ["Fury", "Fury"],
  ["FireBall", "FireBall"],
  ["GreatFireBall", "GreatFireBall"],
  ["ThunderBolt", "ThunderBolt"],
  ["TurnUndead", "TurnUndead"],
  ["Vampirism", "Vampirism"],
  ["FireWall", "FireWall"],
  ["FrostCrunch", "FrostCrunch"],
  ["MagicShield", "MagicShield"],
  ["Healing", "Healing"],
  ["SpiritSword", "SpiritSword"],
  ["Poisoning", "Poisoning"],
  ["PoisonCloud", "PoisonCloud"],
  ["Curse", "Curse"],
  ["Plague", "Plague"],
  ["SoulFireBall", "SoulFireBall"],
  ["SummonSkeleton", "SummonSkeleton"],
  ["SoulShield", "SoulShield"],
  ["BlessedArmour", "BlessedArmour"],
  ["EnergyShield", "EnergyShield"],
  ["HealingCircle", "HealingCircle"],
  ["MassHealing", "MassHealing"],
  ["UltimateEnhancer", "UltimateEnhancer"],
  ["SummonShinsu", "SummonShinsu"],
  ["SummonHolyDeva", "SummonHolyDeva"],
  ["PetEnhancer", "PetEnhancer"],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...entries] = rows.filter((entry) => entry.some((cell) => cell.trim()));
  return entries.map((entry) => Object.fromEntries(headers.map((header, index) => [header, entry[index] ?? ""])));
}

function copyIcon(frame) {
  return copyItemIcon(root, frame, publicIconRoot);
}

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

function itemClass(requiredClass) {
  const mask = Number(requiredClass) || 31;
  if (mask === 1) return "warrior";
  if (mask === 2) return "wizard";
  if (mask === 4) return "taoist";
  return "any";
}

function requirementFor(item) {
  const amount = Number(item.requiredAmount) || 0;
  const type = requirementTypes[item.requiredType] ?? "none";
  return {
    type: type === "level" && amount <= 0 ? "none" : type,
    amount,
    classMask: Number(item.requiredClass) || 31,
    genderMask: Number(item.requiredGender) || 3,
  };
}

function normalStats(stats = {}) {
  return {
    ac: stats.ac ?? [0, 0],
    amc: stats.amc ?? [0, 0],
    dc: stats.dc ?? [0, 0],
    mc: stats.mc ?? [0, 0],
    sc: stats.sc ?? [0, 0],
    hp: Number(stats.hp) || 0,
    mp: Number(stats.mp) || 0,
    accuracy: Number(stats.accuracy) || 0,
    agility: Number(stats.agility) || 0,
    luck: Number(stats.luck) || 0,
    attackSpeed: Number(stats.attackSpeed) || 0,
  };
}

function dropChancesByItem() {
  const rows = parseCsv(fs.readFileSync(dropCsvPath, "utf8"));
  const monstersByZone = new Map();
  const itemChances = new Map();
  for (const row of rows) {
    const zoneId = zoneIds[row.Zone];
    if (!zoneId) continue;
    if (!monstersByZone.has(zoneId)) monstersByZone.set(zoneId, new Set());
    monstersByZone.get(zoneId).add(row.Monster);
  }
  for (const row of rows) {
    const zoneId = zoneIds[row.Zone];
    const itemName = row.Item?.trim();
    const numerator = Number(row.Numerator) || 0;
    const denominator = Number(row.Denominator) || 0;
    if (!zoneId || !itemName || numerator <= 0 || denominator <= 0) continue;
    const monsterCount = Math.max(1, monstersByZone.get(zoneId)?.size ?? 1);
    if (!itemChances.has(itemName)) itemChances.set(itemName, new Map());
    const zoneMap = itemChances.get(itemName);
    zoneMap.set(zoneId, (zoneMap.get(zoneId) ?? 0) + numerator / denominator / monsterCount);
  }
  return itemChances;
}

function dropBlockFor(name, dropsByName) {
  const zoneMap = dropsByName.get(name);
  if (!zoneMap?.size) return undefined;
  const chances = Object.fromEntries(
    [...zoneMap.entries()]
      .map(([zoneId, chance]) => [zoneId, Number(Math.min(0.08, chance).toFixed(5))])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    zones: Object.keys(chances),
    chance: Math.max(...Object.values(chances)),
    chances,
  };
}

function curatedDropBlockFor(id, curatedDropsById) {
  if (!curatedDropsById) return undefined;
  return curatedDropsById.get(id);
}

function curatedDropChancesById() {
  if (!fs.existsSync(curatedDropCsvPath)) return undefined;
  const rows = parseCsv(fs.readFileSync(curatedDropCsvPath, "utf8"));
  const dropsById = new Map();
  for (const row of rows) {
    const id = row["Item ID"]?.trim();
    if (!id || row["Keep?"]?.trim().toLowerCase() === "no") continue;
    const chances = Object.fromEntries(
      curatedDropColumns
        .map(([column, zoneId]) => [zoneId, Number(row[column])])
        .filter(([, chance]) => Number.isFinite(chance) && chance > 0)
        .map(([zoneId, chance]) => [zoneId, Number(Math.min(1, Math.max(0, chance)).toFixed(5))]),
    );

    const enemyChances = {};
    for (const [column, zoneId, enemyId] of curatedEnemyDropColumns) {
      const chance = Number(row[column]);
      if (!Number.isFinite(chance) || chance <= 0) continue;
      const enemyKey = String(enemyId);
      enemyChances[enemyKey] = enemyChances[enemyKey] ?? {};
      enemyChances[enemyKey][zoneId] = Number(Math.min(1, Math.max(0, chance)).toFixed(5));
    }

    const zoneIdsForDrop = new Set(Object.keys(chances));
    for (const perEnemy of Object.values(enemyChances)) {
      for (const zoneId of Object.keys(perEnemy)) zoneIdsForDrop.add(zoneId);
    }
    if (!zoneIdsForDrop.size) continue;

    const allChanceValues = [
      ...Object.values(chances),
      ...Object.values(enemyChances).flatMap((perEnemy) => Object.values(perEnemy)),
    ];
    const drop = {
      zones: [...zoneIdsForDrop].sort(),
      chance: Math.max(...allChanceValues),
      chances,
    };
    if (Object.keys(enemyChances).length) drop.enemyChances = enemyChances;
    dropsById.set(id, drop);
  }
  return dropsById;
}

function itemDefinition(item, dropsByName, curatedDropsById) {
  const frame = Number(item.icon?.frame) || 0;
  if (item.type !== "Book") copyIcon(frame);
  const poisonShape = item.name === "GreenPoison" ? 1 : item.name === "RedPoison" ? 2 : 0;
  const isPoison = poisonShape > 0;
  const isTaoistAmulet = item.name === "Amulet";
  const isBenedictionOil = item.name === "BenedictionOil";
  const isAwakeningSoul = item.name === "AwakeningSoul0";
  const type = isBenedictionOil
    ? "scroll"
    : isAwakeningSoul
    ? "material"
    : isPoison
    ? "poison"
    : isTaoistAmulet
    ? "amulet"
    : item.type === "CraftingMaterial" || item.type === "Quest"
    ? "material"
    : item.type.toLowerCase();
  const stackSizeOverride = stackSizeOverrides[item.name];
  const isStackable = type === "potion" || isBenedictionOil || isAwakeningSoul || isPoison || isTaoistAmulet || Number(stackSizeOverride) > 1;
  const def = {
    id: slugFor(item),
    name: displayName(item.name),
    type,
    slot: isAwakeningSoul
      ? "material"
      : isBenedictionOil || isPoison || isTaoistAmulet
        ? "consumable"
        : typeSlots[item.type] ?? type,
    class: itemClass(item.requiredClass),
    source: { crystalIndex: item.crystalIndex, name: item.name },
    icon: {
      library: item.icon?.library ?? "Items",
      frame,
      src: item.type === "Book" ? "./public/item-icons/books/images/frame_003640.png" : `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: requirementFor(item),
    stackable: isStackable,
    maxStack: isStackable ? Number(stackSizeOverride) || 64 : 1,
    stats: normalStats(item.stats),
    shop: { buy: Number(item.price) || 0, sell: Math.max(1, Math.floor((Number(item.price) || 0) / 5)) },
  };

  if (Number(item.set) > 0) def.set = Number(item.set);
  if (item.type) def.crystalType = item.type;

  if (item.type === "Weapon") def.visual = { layer: "weapon", index: Number(item.shape) || 0 };
  if (item.type === "Armour") def.visual = { layer: "armour", index: Number(item.shape) || 0 };
  if (item.type === "Potion") def.shape = Number(item.shape) || 0;
  if (isTaoistAmulet) {
    def.shape = Number(item.shape) || 0;
    def.amulet = { shape: Number(item.shape) || 0 };
  }
  if (isPoison) {
    def.shape = poisonShape;
    def.poison = {
      type: poisonShape === 1 ? "green" : "yellow",
      crystalType: poisonShape === 1 ? "Green" : "Red",
    };
  }
  if (isBenedictionOil) {
    def.shape = Number(item.shape) || 0;
    def.scroll = { kind: "benediction" };
  }
  if (isAwakeningSoul) {
    def.shop = { buy: 0, sell: 0 };
  }
  if (item.type === "Book") def.spell = { id: spellIds.get(item.name) ?? item.name, shape: Number(item.shape) || 0 };

  const drop = curatedDropsById ? curatedDropBlockFor(def.id, curatedDropsById) : dropBlockFor(item.name, dropsByName);
  if (drop) def.drop = drop;

  return def;
}

// NOTE: build-phase1-items only emits the phase-1 subset (~240 items). Do not run it against
// the full production catalog in src/data/items.json — use tools/merge-item-set-metadata.mjs
// to add set fields without removing items.
function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const crystalItems = readJson(crystalItemsPath).items;
const crystalByIndex = new Map(crystalItems.map((item) => [Number(item.crystalIndex), item]));
const crystalByName = new Map(crystalItems.map((item) => [item.name, item]));
const selectionRows = parseCsv(fs.readFileSync(selectionCsvPath, "utf8"));
const dropsByName = dropChancesByItem();
const curatedDropsById = curatedDropChancesById();

const curatedItems = selectionRows
  .map((row) => crystalByIndex.get(Number(row["Crystal Index"])))
  .filter(Boolean);

const extraNames = [
  "Fencing",
  "Slaying",
  "Thrusting",
  "TwinDrakeBlade",
  "FlamingSword",
  "Fury",
  "FireBall",
  "GreatFireBall",
  "ThunderBolt",
  "TurnUndead",
  "Vampirism",
  "FireWall",
  "FrostCrunch",
  "MagicShield",
  "Healing",
  "SpiritSword",
  "Poisoning",
  "PoisonCloud",
  "Curse",
  "Plague",
  "SoulFireBall",
  "SummonSkeleton",
  "SoulShield",
  "BlessedArmour",
  "EnergyShield",
  "HealingCircle",
  "MassHealing",
  "UltimateEnhancer",
  "SummonShinsu",
  "SummonHolyDeva",
  "PetEnhancer",
  "(HP)DrugSmall",
  "(MP)DrugSmall",
  "(HP)DrugMedium",
  "(MP)DrugMedium",
  "(HP)DrugLarge",
  "(MP)DrugLarge",
  "(HP)DrugXL",
  "(MP)DrugXL",
  "SunPotion",
  "SunPotion(M)",
  "IronArmour(M)",
  "WizardRobe(M)",
  "PearlArmour(M)",
  "DCStone(XL)",
  "MCStone(XL)",
  "SCStone(XL)",
  "ZumaJudgementMace",
  "ZumaWarMageStaff",
  "ZumaSoulSpringWand",
  "JudgementMace",
  "WarMageStaff",
  "SoulSpringWand",
  "DragonSlayer",
  "DragonStaff",
  "SoulSabre",
  "GreenBead",
  "DemonicBells",
  "SoulNecklace",
  "KnightBracelet",
  "SoulSpringBracelet",
  "DragonBracelet",
  "DragonRing",
  "RubyRing",
  "PlatinumRing",
  "SmashWheel",
  "SmashRing",
  "PurityRing",
  "SpiritRing",
  "PowerRing",
  "VioletRing",
  "BlackIronHelmet",
  "Amulet",
  "GreenPoison",
  "RedPoison",
  "BenedictionOil",
  "AwakeningSoul0",
  "AmethystNecklace",
  "BlueThunderNecklace",
  "BracerOfMagic",
  "EvadeBracelet",
  "EvilSlayerRing",
  "FiveStringBracelet",
  "FiveStringNecklace",
  "FiveStringRing",
  "JadeSnowRing",
  "PearlRing",
  "RedOrchidRing",
  "TaoPowerBracelet",
  "TwinGoldRing",
];

const extraItems = extraNames.map((name) => crystalByName.get(name)).filter(Boolean);
const items = uniqueById([...curatedItems, ...extraItems].map((item) => itemDefinition(item, dropsByName, curatedDropsById)));

const output = {
  schemaVersion: 2,
  source: {
    crystalItems: "src/data/crystal-items.json",
    selection: "content-audit/phase-1/warrior-item-selection.csv",
    curatedDrops: "content-audit/phase-1/idle-drop-items.csv",
    drops: "content-audit/phase-1/drop-candidates-by-zone.csv",
    notes:
      "Generated Phase 1 item layer. Edit the curated drop CSV and selection inputs, then run npm run build:phase1-items.",
  },
  items,
};

function existingItemIds() {
  if (!fs.existsSync(itemsOutputPath)) return new Set();
  try {
    const existing = JSON.parse(fs.readFileSync(itemsOutputPath, "utf8"));
    return new Set((existing.items ?? []).map((item) => item.id).filter(Boolean));
  } catch (error) {
    console.warn(`Could not read existing ${path.relative(root, itemsOutputPath)} for removal safety check: ${error.message}`);
    return new Set();
  }
}

const existingIds = existingItemIds();
const nextIds = new Set(items.map((item) => item.id).filter(Boolean));
const removedIds = [...existingIds].filter((id) => !nextIds.has(id)).sort();
if (removedIds.length && !allowItemRemoval) {
  console.error("");
  console.error("Refusing to write src/data/items.json because this rebuild would remove existing item IDs.");
  console.error("Items should never disappear from saves unless removal is intentional.");
  console.error("");
  console.error(`Removed item count: ${removedIds.length}`);
  console.error(removedIds.slice(0, 80).join(", "));
  if (removedIds.length > 80) console.error(`...and ${removedIds.length - 80} more`);
  console.error("");
  console.error("If this is genuinely intended, rerun with --allow-item-removal.");
  console.error("For drop-only changes, update the existing item data additively instead of rebuilding/removing items.");
  process.exit(1);
}

fs.writeFileSync(itemsOutputPath, `${JSON.stringify(output, null, 2)}\n`);

const extraIconFrames = [280, 284, 285, 286];
for (const frame of extraIconFrames) {
  if (copyIcon(frame)) {
    console.log(`Copied icon ${frameFileName(frame)}`);
  }
}

console.log(`Wrote ${items.length} items to ${path.relative(root, itemsOutputPath)}`);
