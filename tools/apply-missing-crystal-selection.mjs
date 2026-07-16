/**
 * Add Crystal items listed in a selection JSON (from the missing-items picker)
 * into src/data/items.json.
 *
 * Usage:
 *   npm run apply:missing-items-selection -- path/to/missing-crystal-selection.json
 *
 * Selection JSON shape (from the picker download):
 *   { crystalIndexes: number[], crystalNames?: string[], items?: [...] }
 */
import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";
import {
  idOverrides,
  nameOverrides,
  isAssassinOrArcherGear,
  loadCrystalItems,
  loadItemsDoc,
  saveItemsDoc,
  slugFor,
  weaponOrArmourFromCrystal,
} from "./lib/item-from-crystal.mjs";

const root = path.resolve(import.meta.dirname, "..");
const publicIconRoot = path.join(root, "public/item-icons/items");

const selectionPath = process.argv[2];
if (!selectionPath) {
  console.error("Usage: npm run apply:missing-items-selection -- <selection.json>");
  process.exit(1);
}

const absSelection = path.resolve(selectionPath);
if (!fs.existsSync(absSelection)) {
  console.error(`Selection file not found: ${absSelection}`);
  process.exit(1);
}

const selection = JSON.parse(fs.readFileSync(absSelection, "utf8"));
const indexes = new Set(
  (selection.crystalIndexes ?? selection.items?.map((i) => i.crystalIndex) ?? [])
    .map(Number)
    .filter((n) => !Number.isNaN(n)),
);
const names = new Set(
  (selection.crystalNames ?? selection.items?.map((i) => i.crystalName) ?? [])
    .filter(Boolean)
    .map(String),
);

if (!indexes.size && !names.size) {
  console.error("Selection file has no crystalIndexes / crystalNames / items.");
  process.exit(1);
}

const typeSlots = {
  Armour: "armour",
  Weapon: "weapon",
  Belt: "belt",
  Boots: "boots",
  Bracelet: "bracelet",
  Helmet: "helmet",
  Necklace: "necklace",
  Ring: "ring",
  Stone: "stone",
  Gem: "gem",
  Torch: "torch",
  Book: "book",
  Potion: "potion",
  Amulet: "amulet",
  Scroll: "scroll",
  Ore: "ore",
  CraftingMaterial: "material",
  Mask: "helmet",
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

function displayName(name) {
  if (nameOverrides[name]) return nameOverrides[name];
  return String(name)
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
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

function accessoryFromCrystal(crystal) {
  const frame = Number(crystal.icon?.frame) || 0;
  if (frame) copyItemIcon(root, frame, publicIconRoot);

  const type = crystal.type === "CraftingMaterial" ? "material" : String(crystal.type).toLowerCase();
  const slot = typeSlots[crystal.type] ?? type;
  const stackable = Number(crystal.stackSize) > 1 || type === "potion" || type === "scroll" || type === "ore";

  const def = {
    id: idOverrides[crystal.name] ?? slugFor(crystal),
    name: displayName(crystal.name),
    type,
    slot,
    class: itemClass(crystal.requiredClass),
    source: { crystalIndex: crystal.crystalIndex, name: crystal.name },
    icon: {
      library: crystal.icon?.library ?? "Items",
      frame,
      src: `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: requirementFor(crystal),
    stackable,
    maxStack: stackable ? Math.max(1, Number(crystal.stackSize) || 99) : 1,
    stats: normalStats(crystal.stats),
    shop: {
      buy: Number(crystal.price) || 0,
      sell: Math.max(1, Math.floor((Number(crystal.price) || 0) / 5)),
    },
    crystalType: crystal.type,
  };

  if (Number(crystal.set) > 0) def.set = Number(crystal.set);
  return def;
}

function itemFromCrystal(crystal) {
  if (crystal.type === "Weapon" || crystal.type === "Armour") {
    return weaponOrArmourFromCrystal(crystal, root, publicIconRoot);
  }
  return accessoryFromCrystal(crystal);
}

const crystalItems = loadCrystalItems(root);
const itemsDoc = loadItemsDoc(root);
const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const existingCrystalNames = new Set(itemsDoc.items.map((item) => item.source?.name).filter(Boolean));
const existingCrystalIndexes = new Set(
  itemsDoc.items.map((item) => Number(item.source?.crystalIndex)).filter((n) => !Number.isNaN(n)),
);

const picked = crystalItems.filter((item) => {
  if (indexes.has(Number(item.crystalIndex))) return true;
  if (names.has(item.name)) return true;
  return false;
});

const added = [];
const skipped = [];

for (const crystal of picked) {
  if (isAssassinOrArcherGear(crystal.requiredClass)) {
    skipped.push(`${crystal.name}: Assassin/Archer-only`);
    continue;
  }
  if (existingCrystalNames.has(crystal.name) || existingCrystalIndexes.has(Number(crystal.crystalIndex))) {
    skipped.push(`${crystal.name}: already in game`);
    continue;
  }

  const def = itemFromCrystal(crystal);
  if (existingIds.has(def.id)) {
    skipped.push(`${crystal.name}: id ${def.id} already taken`);
    continue;
  }

  itemsDoc.items.push(def);
  existingIds.add(def.id);
  existingCrystalNames.add(crystal.name);
  existingCrystalIndexes.add(Number(crystal.crystalIndex));
  added.push(`${def.id} (#${crystal.crystalIndex} ${crystal.name})`);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
saveItemsDoc(root, itemsDoc);

console.log(`Added ${added.length} items from ${path.relative(root, absSelection)}.`);
if (added.length) {
  for (const line of added) console.log(`  + ${line}`);
}
if (skipped.length) {
  console.warn(`Skipped ${skipped.length}:`);
  for (const line of skipped) console.warn(`  - ${line}`);
}
if (picked.length < indexes.size + names.size) {
  const found = new Set(picked.map((p) => Number(p.crystalIndex)));
  const missingIdx = [...indexes].filter((i) => !found.has(i));
  if (missingIdx.length) console.warn(`Crystal indexes not found in crystal-items.json: ${missingIdx.join(", ")}`);
}
