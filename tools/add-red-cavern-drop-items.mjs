import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dropRoot = "C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Envir/Drops";
const crystalItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
const crystalByName = new Map(crystalItems.map((item) => [item.name, item]));
const itemsPath = path.join(root, "src/data/items.json");
const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const publicIconRoot = path.join(root, "public/item-icons/items");

const idOverrides = {
  "(HP)DrugLarge": "hp-drug-large",
  "(MP)DrugLarge": "mp-drug-large",
  "(HP)DrugXL": "hp-drug-xl",
  "(MP)DrugXL": "mp-drug-xl",
  "SunPotion(M)": "sun-potion-medium",
  SunPotion: "sun-potion",
  OldGinseng: "old-ginseng",
  GoldBar: "gold-bar",
  "ImpactDrug(L)": "impact-drug-l",
  "MagicDrug(L)": "magic-drug-l",
  "TaoistDrug(L)": "taoist-drug-l",
  "StormDrug(L)": "storm-drug-l",
  AmuletOfRevival: "amulet-of-revival",
  "DragonRobe(F)": "dragon-robe-f",
  "RoyalArmour(M)": "royal-armour",
  "RoyalArmour(F)": "royal-armour-f",
  "SteelArmour(F)": "steel-armour-f",
  "StuddedArmour(M)": "studded-armour",
  "StuddedArmour(F)": "studded-armour-f",
  "TitanArmour(F)": "titan-armour-f",
  "8TrigramWheel": "8-trigram-wheel",
  FlamingSword: "book-flaming-sword",
  IceStorm: "book-ice-storm",
  SummonShinsu: "book-summon-shinsu",
  SummonHolyDeva: "book-summon-holy-deva",
  UltimateEnhancer: "book-ultimate-enhancer",
  CrossHalfMoon: "book-cross-half-moon",
  BladeAvalanche: "book-blade-avalanche",
  ProtectionField: "book-protection-field",
  ImmortalSkin: "book-immortal-skin",
  Reincarnation: "book-reincarnation",
  PoisonCloud: "book-poison-cloud",
  PoisonSword: "book-poison-sword",
  MoonLight: "book-moon-light",
  FlameDisruptor: "book-flame-disruptor",
  Mirroring: "book-mirroring",
  MPEater: "book-mp-eater",
  MeteorStrike: "book-meteor-strike",
  DarkBody: "book-dark-body",
  Rage: "book-rage",
  Blizzard: "book-blizzard",
  FlameField: "book-flame-field",
  Curse: "book-curse",
  Hemorrhage: "book-hemorrhage",
  Plague: "book-plague",
  MagicBooster: "book-magic-booster",
  LionRoar: "book-lion-roar",
  Trap: "book-trap",
  SwiftFeet: "book-swift-feet",
  BindingShot: "book-binding-shot",
  SummonToad: "book-summon-toad",
  PoisonShot: "book-poison-shot",
  CrippleShot: "book-cripple-shot",
};

const nameOverrides = {
  OldGinseng: "Old Ginseng",
  GoldBar: "Gold Bar",
  AwakeningSoul0: "Awakening Soul",
  SunPotion: "Sun Potion",
  "(HP)DrugLarge": "Large HP Drug",
  "(MP)DrugLarge": "Large MP Drug",
  "(HP)DrugXL": "XL HP Drug",
  "(MP)DrugXL": "XL MP Drug",
  "ImpactDrug(L)": "Impact Drug (L)",
  "MagicDrug(L)": "Magic Drug (L)",
  "TaoistDrug(L)": "Taoist Drug (L)",
  "StormDrug(L)": "Storm Drug (L)",
  AmuletOfRevival: "Amulet of Revival",
  "8TrigramWheel": "8 Trigram Wheel",
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
  Amulet: "consumable",
  Nothing: "material",
  CraftingMaterial: "material",
  Quest: "material",
};

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

const spellIds = new Map([
  ["CrossHalfMoon", "CrossHalfMoon"],
  ["BladeAvalanche", "BladeAvalanche"],
  ["ProtectionField", "ProtectionField"],
  ["ImmortalSkin", "ImmortalSkin"],
  ["Reincarnation", "Reincarnation"],
  ["PoisonCloud", "PoisonCloud"],
  ["PoisonSword", "PoisonSword"],
  ["MoonLight", "MoonLight"],
  ["FlameDisruptor", "FlameDisruptor"],
  ["Mirroring", "Mirroring"],
  ["MPEater", "MPEater"],
  ["MeteorStrike", "MeteorStrike"],
  ["DarkBody", "DarkBody"],
  ["Rage", "Rage"],
  ["Blizzard", "Blizzard"],
  ["FlameField", "FlameField"],
  ["Curse", "Curse"],
  ["Hemorrhage", "Hemorrhage"],
  ["Plague", "Plague"],
  ["MagicBooster", "MagicBooster"],
  ["LionRoar", "LionRoar"],
  ["Trap", "Trap"],
  ["SwiftFeet", "SwiftFeet"],
  ["BindingShot", "BindingShot"],
  ["SummonToad", "SummonToad"],
  ["PoisonShot", "PoisonShot"],
  ["CrippleShot", "CrippleShot"],
]);

function parseDropNames(filePath) {
  const names = new Set();
  if (!fs.existsSync(filePath)) return names;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;
    const match = trimmed.match(/^(\d+)\/(\d+)\s+(.+?)(?:\s+(Q|LV\d+))?$/i);
    if (!match || /^Gold(\s|$)/i.test(match[3])) continue;
    names.add(match[3].trim());
  }
  return names;
}

const dropFiles = [
  "WasteLand/RedCavern/GhastlyLeecher.txt",
  "WasteLand/RedCavern/GhastlyLeecher0.txt",
  "WasteLand/RedCavern/MutatedManworm.txt",
  "WasteLand/RedCavern/MutatedManworm0.txt",
  "WasteLand/RedCavern/CrazyManworm.txt",
  "WasteLand/RedCavern/CrazyManworm0.txt",
  "WasteLand/RedCavern/CyanoGhast.txt",
  "WasteLand/RedCavern/CyanoGhast0.txt",
  "WasteLand/RedCavern/DreamDevourer.txt",
  "WasteLand/RedCavern/DreamDevourer0.txt",
  "WasteLand/RedCavern/DarkDevourer.txt",
  "WasteLand/RedCavern/DarkDevourer0.txt",
];

const dropNames = new Set();
for (const file of dropFiles) {
  for (const name of parseDropNames(path.join(dropRoot, file))) dropNames.add(name);
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

function bookIconSrc(frame) {
  const padded = String(frame).padStart(6, "0");
  const bookPath = path.join(root, "public/item-icons/books/images", `frame_${padded}.png`);
  if (fs.existsSync(bookPath)) return `./public/item-icons/books/images/frame_${padded}.png`;
  return "./public/item-icons/books/images/frame_003640.png";
}

function itemFromCrystal(item) {
  const frame = Number(item.icon?.frame) || 0;
  if (item.type !== "Book" && frame) copyItemIcon(root, frame, publicIconRoot);

  const isAmulet = item.type === "Amulet";
  const isGoldBar = item.name === "GoldBar";
  const type = isGoldBar
    ? "material"
    : isAmulet
      ? "amulet"
      : item.type === "Nothing"
        ? "material"
        : item.type.toLowerCase();
  const slot = isGoldBar ? "material" : typeSlots[item.type] ?? type;
  const isStackable =
    type === "potion" ||
    isAmulet ||
    isGoldBar ||
    item.name === "OldGinseng" ||
    Number(item.stackSize) > 1;

  const def = {
    id: slugFor(item),
    name: displayName(item.name),
    type,
    slot,
    class: itemClass(item.requiredClass),
    source: { crystalIndex: item.crystalIndex, name: item.name },
    icon: {
      library: item.icon?.library ?? "Items",
      frame,
      src:
        item.type === "Book"
          ? bookIconSrc(frame)
          : `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: requirementFor(item),
    stackable: isStackable,
    maxStack: isStackable ? Math.max(1, Number(item.stackSize) || (isGoldBar ? 1 : 64)) : 1,
    stats: normalStats(item.stats),
    shop: {
      buy: Number(item.price) || 0,
      sell: Math.max(isGoldBar ? 0 : 1, Math.floor((Number(item.price) || 0) / 5)),
    },
  };

  if (Number(item.set) > 0) def.set = Number(item.set);
  if (item.type) def.crystalType = item.type;

  if (item.type === "Weapon") def.visual = { layer: "weapon", index: Number(item.shape) || 0 };
  if (item.type === "Armour") def.visual = { layer: "armour", index: Number(item.shape) || 0 };
  if (item.type === "Potion") def.shape = Number(item.shape) || 0;
  if (isAmulet) {
    def.shape = Number(item.shape) || 0;
    def.amulet = { shape: Number(item.shape) || 0 };
  }
  if (item.type === "Book") {
    def.spell = { id: spellIds.get(item.name) ?? item.name, shape: Number(item.shape) || 0 };
  }

  return def;
}

const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const existingCrystalNames = new Set(
  itemsDoc.items.map((item) => item.source?.name).filter(Boolean),
);
const added = [];
const missingCrystal = [];

for (const name of [...dropNames].sort()) {
  const crystal = crystalByName.get(name);
  if (!crystal) {
    missingCrystal.push(name);
    continue;
  }
  if (existingCrystalNames.has(crystal.name)) continue;
  const def = itemFromCrystal(crystal);
  if (existingIds.has(def.id)) continue;
  itemsDoc.items.push(def);
  existingIds.add(def.id);
  existingCrystalNames.add(crystal.name);
  added.push(def.id);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(itemsPath, `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");

console.log(`Added ${added.length} Red Cavern drop items.`);
if (added.length) console.log(added.join(", "));
if (missingCrystal.length) {
  console.warn(`Skipped ${missingCrystal.length} drops with no Crystal DB entry: ${missingCrystal.join(", ")}`);
}
