/**
 * Add the Fox accessory line (Purple/Red/Blue x normal + Great, ring/bracelet/necklace)
 * and smooth the mid-end accessory ladder so:
 *   Boundless/Cloud/mid necks -> Fox (L43-44) -> Great Fox (L46-48) -> L50-54 (buffed)
 *
 * Fox items borrow (roughly) the old L50-52 power; the current L50-54 pieces step up.
 * Idempotent: re-running only fixes stats/levels, never duplicates.
 *
 * Usage: node tools/add-fox-items-and-rebalance.mjs
 * After:  npm run build:item-atlas   (Fox icons 893-910 need packing into the atlas)
 *         npm run integrity:rules    (regenerate stats-worker rules for changed stats)
 */
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";
import { loadCrystalItems, loadItemsDoc, saveItemsDoc } from "./lib/item-from-crystal.mjs";

const root = path.resolve(import.meta.dirname, "..");
const publicIconRoot = path.join(root, "public/item-icons/items");

const DROP_ZONE = "zone-hell-gd-3";

// Fox definitions: [crystalIndex, id, name, slot, level, statsOverride, buy]
const FOX_ITEMS = [
  // Rings — base Fox L43
  [442, "purple-fox-ring", "Purple Fox Ring", "ring", 43, { dc: [1, 10], ac: [1, 2] }, 30000],
  [443, "red-fox-ring", "Red Fox Ring", "ring", 43, { mc: [1, 9], amc: [0, 1] }, 30000],
  [444, "blue-fox-ring", "Blue Fox Ring", "ring", 43, { dc: [1, 4], sc: [1, 8] }, 30000],
  // Rings — Great Fox L46
  [445, "great-purple-fox-ring", "Great Purple Fox Ring", "ring", 46, { dc: [1, 12] }, 38000],
  [446, "great-red-fox-ring", "Great Red Fox Ring", "ring", 46, { mc: [1, 11] }, 38000],
  [447, "great-blue-fox-ring", "Great Blue Fox Ring", "ring", 46, { dc: [1, 5], sc: [1, 9] }, 38000],
  // Bracelets — base Fox L44
  [514, "purple-fox-bracelet", "Purple Fox Bracelet", "bracelet", 44, { ac: [1, 2], dc: [2, 5] }, 30000],
  [515, "red-fox-bracelet", "Red Fox Bracelet", "bracelet", 44, { amc: [1, 2], mc: [1, 4] }, 30000],
  [516, "blue-fox-bracelet", "Blue Fox Bracelet", "bracelet", 44, { dc: [1, 2], sc: [1, 5] }, 30000],
  // Bracelets — Great Fox L47
  [517, "great-purple-fox-bracelet", "Great Purple Fox Bracelet", "bracelet", 47, { ac: [1, 2], amc: [0, 2], dc: [2, 6] }, 38000],
  [518, "great-red-fox-bracelet", "Great Red Fox Bracelet", "bracelet", 47, { amc: [1, 3], mc: [2, 5] }, 38000],
  [519, "great-blue-fox-bracelet", "Great Blue Fox Bracelet", "bracelet", 47, { dc: [1, 3], sc: [2, 6] }, 38000],
  // Necklaces — base Fox L44
  [571, "purple-fox-collar", "Purple Fox Collar", "necklace", 44, { dc: [3, 8] }, 30000],
  [572, "red-fox-collar", "Red Fox Collar", "necklace", 44, { mc: [2, 8] }, 30000],
  [573, "blue-fox-collar", "Blue Fox Collar", "necklace", 44, { dc: [1, 2], sc: [2, 8] }, 30000],
  // Necklaces — Great Fox L48
  [574, "great-purple-fox-collar", "Great Purple Fox Collar", "necklace", 48, { dc: [4, 9] }, 38000],
  [575, "great-red-fox-collar", "Great Red Fox Collar", "necklace", 48, { mc: [2, 9] }, 38000],
  [576, "great-blue-fox-collar", "Great Blue Fox Collar", "necklace", 48, { dc: [1, 3], sc: [2, 9] }, 38000],
];

// Existing items to buff (step above Great Fox): id -> stats override (merged into existing)
const REBALANCE = {
  "pledge-ring": { dc: [1, 14] },
  "crimson-ruby-ring": { mc: [1, 13] },
  "five-element-ring": { dc: [1, 6], sc: [1, 10] },
  "dual-titan-amulet": { ac: [1, 2], dc: [2, 8] },
  "evil-whisp-amulet": { amc: [1, 3], mc: [2, 7] },
  "sacred-angel-amulet": { dc: [1, 3], sc: [2, 8] },
  "cuspid-necklace": { dc: [4, 11] },
  "sorcery-anchor": { mc: [3, 11] },
  "purified-mirror": { dc: [1, 3], sc: [2, 11] },
};

const ZERO_STATS = {
  ac: [0, 0],
  amc: [0, 0],
  dc: [0, 0],
  mc: [0, 0],
  sc: [0, 0],
  hp: 0,
  mp: 0,
  accuracy: 0,
  agility: 0,
  luck: 0,
  attackSpeed: 0,
};

function buildStats(override) {
  const stats = structuredClone(ZERO_STATS);
  for (const [key, value] of Object.entries(override)) {
    stats[key] = Array.isArray(value) ? [value[0], value[1]] : value;
  }
  return stats;
}

function typeForSlot(slot) {
  return slot;
}

const crystalItems = loadCrystalItems(root);
const crystalByIndex = new Map(crystalItems.map((c) => [Number(c.crystalIndex), c]));
const itemsDoc = loadItemsDoc(root);
const byId = new Map(itemsDoc.items.map((i) => [i.id, i]));

const added = [];
const updated = [];
const iconWarnings = [];

for (const [crystalIndex, id, name, slot, level, override, buy] of FOX_ITEMS) {
  const crystal = crystalByIndex.get(crystalIndex);
  if (!crystal) {
    iconWarnings.push(`Crystal index ${crystalIndex} (${name}) not found`);
    continue;
  }
  const frame = Number(crystal.icon?.frame) || 0;
  if (frame && !copyItemIcon(root, frame, publicIconRoot)) {
    iconWarnings.push(`No source PNG for frame ${frame} (${name})`);
  }

  const stats = buildStats(override);
  const existing = byId.get(id);

  if (existing) {
    existing.stats = stats;
    existing.requirements = {
      type: "level",
      amount: level,
      classMask: 31,
      genderMask: 3,
    };
    updated.push(`${id} (stats/level refreshed)`);
    continue;
  }

  const def = {
    id,
    name,
    type: typeForSlot(slot),
    slot,
    class: "any",
    source: { crystalIndex, name: crystal.name },
    icon: {
      library: crystal.icon?.library ?? "Items",
      frame,
      src: `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: {
      type: "level",
      amount: level,
      classMask: 31,
      genderMask: 3,
    },
    stackable: false,
    maxStack: 1,
    stats,
    shop: {
      buy,
      sell: Math.max(1, Math.floor(buy / 5)),
    },
    crystalType: crystal.type,
    drop: {
      zones: [DROP_ZONE],
      chances: { [DROP_ZONE]: 0.025 },
      chance: 0.025,
    },
  };

  itemsDoc.items.push(def);
  byId.set(id, def);
  added.push(`${id} (#${crystalIndex} ${crystal.name}) L${level}`);
}

for (const [id, override] of Object.entries(REBALANCE)) {
  const item = byId.get(id);
  if (!item) {
    iconWarnings.push(`Rebalance target not found: ${id}`);
    continue;
  }
  for (const [key, value] of Object.entries(override)) {
    item.stats[key] = Array.isArray(value) ? [value[0], value[1]] : value;
  }
  updated.push(`${id} (buffed)`);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
saveItemsDoc(root, itemsDoc);

console.log(`Added ${added.length} Fox items:`);
for (const line of added) console.log(`  + ${line}`);
console.log(`Updated ${updated.length}:`);
for (const line of updated) console.log(`  ~ ${line}`);
if (iconWarnings.length) {
  console.warn(`Warnings (${iconWarnings.length}):`);
  for (const line of iconWarnings) console.warn(`  ! ${line}`);
}
console.log("\nNext: npm run build:item-atlas  &&  npm run integrity:rules");
