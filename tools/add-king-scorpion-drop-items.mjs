import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
const itemsPath = path.join(root, "src/data/items.json");
const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const publicIconRoot = path.join(root, "public/item-icons/items");

const CRYSTAL_NAMES = [
  "BlackDragonSlayer",
  "BlackDragonStaff",
  "BlackDragonSoulSabre",
];

const requirementTypes = {
  0: "level",
  3: "maxDC",
};

function slugFor(crystal) {
  return crystal.name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function displayName(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
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
  const type = requirementTypes[item.requiredType] ?? "level";
  return {
    type: amount <= 0 ? "none" : type,
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
  const frame = crystal.icon?.frame ?? crystal.image;
  if (frame != null) copyItemIcon(root, frame, publicIconRoot);
  return {
    id: slugFor(crystal),
    name: displayName(crystal.name),
    type: "weapon",
    slot: "weapon",
    class: itemClass(crystal.requiredClass),
    source: { crystalIndex: crystal.crystalIndex, name: crystal.name },
    icon: {
      library: "Items",
      frame,
      src: `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: requirementFor(crystal),
    stackable: false,
    maxStack: 1,
    stats: normalStats(crystal.stats),
    shop: {
      buy: Number(crystal.price) || 0,
      sell: Math.max(0, Math.floor((Number(crystal.price) || 0) / 5)),
    },
    visual: { layer: "weapon", index: Number(crystal.shape) || 0 },
  };
}

itemsDoc.items = itemsDoc.items.filter((item) => !item.id.includes("blac-rago"));

const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const added = [];
for (const name of CRYSTAL_NAMES) {
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

fs.writeFileSync(itemsPath, `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");
console.log(`Added ${added.length} items: ${added.join(", ") || "(none)"}`);
