/**
 * Add Bracelet / Necklace of Agony (warrior/wizard/taoist) at L55 for Hell Lord.
 * Idempotent. Copies icons from tile-review, then leaves atlas rebuild to the caller.
 *
 * Usage: node tools/add-agony-accessories.mjs
 * After:  npm run build:item-atlas
 *         npm run integrity:rules
 */
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";
import { loadItemsDoc, saveItemsDoc } from "./lib/item-from-crystal.mjs";

const root = path.resolve(import.meta.dirname, "..");
const publicIconRoot = path.join(root, "public/item-icons/items");

const ZERO = {
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

function stats(over) {
  const out = structuredClone(ZERO);
  for (const [key, value] of Object.entries(over)) {
    out[key] = Array.isArray(value) ? [...value] : value;
  }
  return out;
}

// L55 Hell Lord signature — step above L52 bracelets / L54 necks.
const DEFS = [
  // Bracelets (Crystal 195-197, frame 1028)
  {
    id: "bracelet-of-agony-warrior",
    name: "Bracelet of Agony",
    slot: "bracelet",
    class: "warrior",
    classMask: 1,
    crystalIndex: 195,
    crystalName: "BraceletOfAgony1",
    frame: 1028,
    // Dual Titan L52: AC 1-2, DC 2-8 → L55 Agony
    stats: stats({ ac: [1, 2], dc: [3, 9] }),
  },
  {
    id: "bracelet-of-agony-wizard",
    name: "Bracelet of Agony",
    slot: "bracelet",
    class: "wizard",
    classMask: 2,
    crystalIndex: 196,
    crystalName: "BraceletOfAgony2",
    frame: 1028,
    // Evil Whisp L52: AMC 1-3, MC 2-7 → L55 Agony
    stats: stats({ amc: [1, 3], mc: [3, 8] }),
  },
  {
    id: "bracelet-of-agony-taoist",
    name: "Bracelet of Agony",
    slot: "bracelet",
    class: "taoist",
    classMask: 4,
    crystalIndex: 197,
    crystalName: "BraceletOfAgony3",
    frame: 1028,
    // Sacred Angel L52: DC 1-3, SC 2-8 → L55 Agony (keep light AMC like Crystal)
    stats: stats({ amc: [0, 2], dc: [1, 4], sc: [2, 9] }),
  },
  // Necklaces (Crystal 183-185, frame 1018)
  {
    id: "necklace-of-agony-warrior",
    name: "Necklace of Agony",
    slot: "necklace",
    class: "warrior",
    classMask: 1,
    crystalIndex: 183,
    crystalName: "NecklaceOfAgony1",
    frame: 1018,
    // Cuspid L54: DC 4-11 → L55 Agony
    stats: stats({ dc: [4, 12] }),
  },
  {
    id: "necklace-of-agony-wizard",
    name: "Necklace of Agony",
    slot: "necklace",
    class: "wizard",
    classMask: 2,
    crystalIndex: 184,
    crystalName: "NecklaceOfAgony2",
    frame: 1018,
    // Sorcery Anchor L54: MC 3-11 → L55 Agony
    stats: stats({ mc: [3, 12] }),
  },
  {
    id: "necklace-of-agony-taoist",
    name: "Necklace of Agony",
    slot: "necklace",
    class: "taoist",
    classMask: 4,
    crystalIndex: 185,
    crystalName: "NecklaceOfAgony3",
    frame: 1018,
    // Purified Mirror L54: DC 1-3, SC 2-11 → L55 Agony
    stats: stats({ dc: [1, 3], sc: [2, 12] }),
  },
];

const itemsDoc = loadItemsDoc(root);
const byId = new Map(itemsDoc.items.map((i) => [i.id, i]));
const log = [];
const iconWarnings = [];

for (const d of DEFS) {
  if (!copyItemIcon(root, d.frame, publicIconRoot)) {
    iconWarnings.push(`No source PNG for frame ${d.frame} (${d.id})`);
  }

  if (byId.has(d.id)) {
    const existing = byId.get(d.id);
    existing.stats = d.stats;
    existing.class = d.class;
    existing.name = d.name;
    existing.slot = d.slot;
    existing.type = d.slot;
    existing.requirements = {
      type: "level",
      amount: 55,
      classMask: d.classMask,
      genderMask: 3,
    };
    existing.icon = {
      library: "Items",
      frame: d.frame,
      src: `./public/item-icons/items/${frameFileName(d.frame)}`,
    };
    log.push(`updated ${d.id}`);
    continue;
  }

  const def = {
    id: d.id,
    name: d.name,
    type: d.slot,
    slot: d.slot,
    class: d.class,
    source: { crystalIndex: d.crystalIndex, name: d.crystalName },
    icon: {
      library: "Items",
      frame: d.frame,
      src: `./public/item-icons/items/${frameFileName(d.frame)}`,
    },
    requirements: {
      type: "level",
      amount: 55,
      classMask: d.classMask,
      genderMask: 3,
    },
    stackable: false,
    maxStack: 1,
    stats: d.stats,
    shop: { buy: 0, sell: 1 },
    crystalType: d.slot === "bracelet" ? "Bracelet" : "Necklace",
    set: 28,
  };
  itemsDoc.items.push(def);
  byId.set(d.id, def);
  log.push(`added ${d.id}`);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
saveItemsDoc(root, itemsDoc);

for (const line of log) console.log(line);
for (const d of DEFS) {
  const i = byId.get(d.id);
  console.log(JSON.stringify({
    id: i.id,
    class: i.class,
    level: i.requirements.amount,
    stats: i.stats,
  }));
}
if (iconWarnings.length) {
  console.warn("Icon warnings:");
  for (const w of iconWarnings) console.warn(`  ${w}`);
  process.exitCode = 1;
}
