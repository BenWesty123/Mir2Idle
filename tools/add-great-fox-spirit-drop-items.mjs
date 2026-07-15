import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const itemsPath = path.join(root, "src/data/items.json");
const iconRoot = path.join(root, "public/item-icons/items");
const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const crystalItems = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8"),
).items;
const crystalByName = new Map(crystalItems.map((item) => [item.name, item]));

const additions = [
  {
    crystalName: "RedScaleBoots",
    id: "red-scale-boots",
    name: "Red Scale Boots",
    stats: { accuracy: 6, agility: 6 },
  },
  {
    crystalName: "AdamantineBelt",
    id: "adamantine-belt",
    name: "Adamantine Belt",
    stats: { ac: [1, 3], amc: [1, 3] },
  },
];

function itemClass(requiredClass) {
  const mask = Number(requiredClass) || 31;
  if (mask === 1) return "warrior";
  if (mask === 2) return "wizard";
  if (mask === 4) return "taoist";
  return "any";
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

const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const added = [];

for (const addition of additions) {
  if (existingIds.has(addition.id)) continue;
  const crystal = crystalByName.get(addition.crystalName);
  if (!crystal) throw new Error(`Missing Crystal item: ${addition.crystalName}`);

  const frame = Number(crystal.icon?.frame) || 0;
  if (!frame || !copyItemIcon(root, frame, iconRoot)) {
    throw new Error(`Missing icon source for ${addition.crystalName} (frame ${frame})`);
  }

  const stats = normalStats({ ...crystal.stats, ...addition.stats });
  itemsDoc.items.push({
    id: addition.id,
    name: addition.name,
    type: crystal.type.toLowerCase(),
    slot: crystal.type.toLowerCase(),
    class: itemClass(crystal.requiredClass),
    source: { crystalIndex: crystal.crystalIndex, name: crystal.name },
    icon: {
      library: crystal.icon?.library ?? "Items",
      frame,
      src: `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: {
      type: "level",
      amount: Number(crystal.requiredAmount) || 0,
      classMask: Number(crystal.requiredClass) || 31,
      genderMask: Number(crystal.requiredGender) || 3,
    },
    stackable: false,
    maxStack: 1,
    stats,
    shop: {
      buy: Number(crystal.price) || 0,
      sell: Math.max(1, Math.floor((Number(crystal.price) || 0) / 5)),
    },
    crystalType: crystal.type,
  });
  existingIds.add(addition.id);
  added.push(addition.id);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(itemsPath, `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");

console.log(`Added ${added.length} Great Fox Spirit drop items.`);
if (added.length) console.log(added.join(", "));
