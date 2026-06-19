import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const itemsPath = path.join(root, "src/data/items.json");
const crystalItems = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8"),
).items;
const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const publicIconRoot = path.join(root, "public/item-icons/items");

const ZONE_1 = "zone-prajna-temple-1";
const ZONE_2 = "zone-prajna-temple-2";

const RATES = {
  1: { [ZONE_1]: 0.004, [ZONE_2]: 0.006 },
  2: { [ZONE_1]: 0.0025, [ZONE_2]: 0.0038 },
  3: { [ZONE_1]: 0.0015, [ZONE_2]: 0.0022 },
  4: { [ZONE_1]: 0.0008, [ZONE_2]: 0.0012 },
};

const DROP_TIERS = {
  // Rings — Expel in T1 (not Gale); Dragon in T3 (not Titan); Gale in T4 (not Expel); Titan in T4 (not Dragon)
  "expel-ring": 1,
  "moral-ring": 1,
  "charm-ring": 1,
  "iron-ring": 1,
  "gold-ring": 2,
  "skeleton-ring": 2,
  "smash-ring": 2,
  "ruby-ring": 2,
  "platinum-ring": 2,
  "coral-ring": 2,
  "purity-ring": 2,
  "jade-snow-ring": 3,
  "evil-slayer-ring": 3,
  "violet-ring": 3,
  "dragon-ring": 3,
  "hwan-devil-ring": 3,
  "titan-ring": 4,
  "power-ring": 4,
  "twin-gold-ring": 4,
  "gale-ring": 4,

  "monk-bracelet": 1,
  "ebony-bracelet": 1,
  "hard-glove": 2,
  "magic-bracelet": 2,
  "bronze-glove": 2,
  "death-gauntlet": 3,
  "tao-power-bracelet": 3,
  "gold-bracelet": 3,
  "smash-wheel": 4,
  "hwan-devil-bracelet": 4,

  "platinum-necklace": 1,
  "tiger-necklace": 1,
  "lantern-necklace": 1,
  "gale-necklace": 2,
  "blue-jade-necklace": 2,
  "bamboo-pipe": 2,
  "convex-lens": 2,
  "pearl-necklace": 3,
  "claw-necklace": 3,
  "life-necklace": 3,
  "hwan-devil-necklace": 3,
  "smash-pendulum": 4,

  "dcstone-l": 4,
  "mcstone-l": 4,
  "scstone-l": 4,
};

const NEW_CRYSTAL_NAMES = [
  "HardGlove",
  "HwanDevilRing",
  "HwanDevilBracelet",
  "HwanDevilNecklace",
  "SmashPendulum",
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

function slugFor(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function displayName(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function slotFor(type) {
  return ({
    Weapon: "weapon",
    Helmet: "helmet",
    Necklace: "necklace",
    Bracelet: "bracelet",
    Ring: "ring",
    Stone: "stone",
  })[type] ?? "misc";
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

function itemFromCrystal(crystal) {
  const slot = slotFor(crystal.type);
  const frame = crystal.icon?.frame ?? crystal.image;
  if (frame != null) copyItemIcon(root, frame, publicIconRoot);
  const def = {
    id: slugFor(crystal.name),
    name: displayName(crystal.name),
    type: slot === "weapon" ? "weapon" : slot,
    slot,
    class: itemClass(crystal.requiredClass),
    source: { crystalIndex: crystal.crystalIndex, name: crystal.name },
    icon: {
      library: "Items",
      frame,
      src: `/public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: requirementFor(crystal),
    stackable: false,
    maxStack: 1,
    stats: normalStats(crystal.stats),
    shop: {
      buy: Number(crystal.price) || 0,
      sell: Math.max(0, Math.floor((Number(crystal.price) || 0) / 5)),
    },
  };
  if (slot === "weapon" && crystal.weaponShape != null) {
    def.visual = { layer: "weapon", index: Number(crystal.weaponShape) || 0 };
  }
  return def;
}

function applyZoneDrop(item, tier) {
  const rates = RATES[tier];
  if (!item.drop) {
    item.drop = {
      zones: [ZONE_1, ZONE_2],
      chance: rates[ZONE_2],
      chances: { ...rates },
    };
    return;
  }
  const zones = new Set(item.drop.zones ?? []);
  zones.add(ZONE_1);
  zones.add(ZONE_2);
  item.drop.zones = [...zones];
  item.drop.chances = { ...(item.drop.chances ?? {}), ...rates };
  if (!item.drop.chance || item.drop.chance < rates[ZONE_2]) {
    item.drop.chance = rates[ZONE_2];
  }
}

const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const added = [];

for (const name of NEW_CRYSTAL_NAMES) {
  const crystal = crystalItems.find((item) => item.name === name);
  if (!crystal) {
    console.warn(`Missing crystal item: ${name}`);
    continue;
  }
  const def = itemFromCrystal(crystal);
  if (existingIds.has(def.id)) continue;
  itemsDoc.items.push(def);
  existingIds.add(def.id);
  added.push(def.id);
}

const missing = [];
const updated = [];

for (const [id, tier] of Object.entries(DROP_TIERS)) {
  const item = itemsDoc.items.find((entry) => entry.id === id);
  if (!item) {
    missing.push(id);
    continue;
  }
  applyZoneDrop(item, tier);
  updated.push(id);
}

if (missing.length) {
  console.error("Missing items:", missing.join(", "));
  process.exit(1);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(itemsPath, `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");

const sum = (zone) => Object.entries(DROP_TIERS)
  .reduce((total, [, tier]) => total + RATES[tier][zone], 0);

console.log(`Added ${added.length} items: ${added.join(", ") || "(none)"}`);
console.log(`Updated drops on ${updated.length} items`);
console.log(`Expected drops/kill — ${ZONE_1}: ${sum(ZONE_1).toFixed(4)}, ${ZONE_2}: ${sum(ZONE_2).toFixed(4)}`);
