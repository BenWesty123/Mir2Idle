import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalItemsPath = path.join(root, "src/data/crystal-items.json");
const itemsOutputPath = path.join(root, "src/data/items.json");

const RAW_STAT_MAP = [
  ["MaxDC", { key: "dc", range: true, index: 1 }],
  ["MaxMC", { key: "mc", range: true, index: 1 }],
  ["MaxSC", { key: "sc", range: true, index: 1 }],
  ["MaxAC", { key: "ac", range: true, index: 1 }],
  ["MaxMAC", { key: "amc", range: true, index: 1 }],
  ["MaxAMC", { key: "amc", range: true, index: 1 }],
  ["Accuracy", { key: "accuracy", range: false }],
  ["Agility", { key: "agility", range: false }],
  ["AttackSpeed", { key: "attackSpeed", range: false }],
  ["PoisonAttack", { key: "poisonAttack", range: false }],
  ["Freezing", { key: "freezing", range: false }],
  ["MagicResist", { key: "magicResist", range: false }],
  ["PoisonResist", { key: "poisonResist", range: false }],
  ["Luck", { key: "luck", range: false }],
  ["HP", { key: "hp", range: false }],
  ["MP", { key: "mp", range: false }],
  ["HealthRecovery", { key: "healthRecovery", range: false }],
  ["PoisonRecovery", { key: "poisonRecovery", range: false }],
  ["Strong", { key: "strong", range: false }],
];

function displayName(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/Gem/g, " Gem").replace(/Orb/g, " Orb").trim();
}

function gemStatFromRaw(rawStats) {
  for (const [rawKey, stat] of RAW_STAT_MAP) {
    const amount = Math.trunc(Number(rawStats?.[rawKey]) || 0);
    if (amount > 0) return { ...stat, amount };
  }
  return null;
}

function buildGemDefinition(item) {
  const frame = Number(item.icon?.frame) || 0;
  copyItemIcon(root, frame);
  const raw = item.rawStats ?? {};
  const stat = gemStatFromRaw(raw);
  const durabilityBonus = Math.trunc(Number(item.durability) || 0);
  const kind = item.shape === 4 ? "orb" : "gem";
  return {
    id: item.id,
    name: displayName(item.name),
    type: "gem",
    slot: "consumable",
    class: "any",
    source: { crystalIndex: item.crystalIndex, name: item.name },
    icon: {
      library: item.icon?.library ?? "Items",
      frame,
      src: `/public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: { type: "none", amount: 0, classMask: 31, genderMask: 3 },
    stackable: true,
    maxStack: Math.max(1, Math.trunc(Number(item.stackSize) || 1)),
    stats: {
      ac: [0, 0], amc: [0, 0], dc: [0, 0], mc: [0, 0], sc: [0, 0],
      hp: 0, mp: 0, accuracy: 0, agility: 0, luck: 0, attackSpeed: 0,
    },
    shop: {
      buy: Number(item.price) || 0,
      sell: Math.max(1, Math.floor((Number(item.price) || 0) / 5)),
    },
    shape: Number(item.shape) || 3,
    gem: {
      kind,
      unique: Math.trunc(Number(item.unique) || 0),
      reflect: Math.trunc(Number(raw.Reflect) || 0),
      criticalRate: Math.trunc(Number(raw.CriticalRate) || 0),
      criticalDamage: Math.trunc(Number(raw.CriticalDamage) || 0),
      maxStatCount: Math.trunc(Number(raw.HPDrainRatePercent) || 0),
      stat: stat ?? null,
      durabilityBonus,
    },
  };
}

const crystalItems = JSON.parse(fs.readFileSync(crystalItemsPath, "utf8")).items;
const gems = crystalItems.filter((item) => item.type === "Gem" && (item.shape === 3 || item.shape === 4));
const itemsDoc = JSON.parse(fs.readFileSync(itemsOutputPath, "utf8"));
const existingIds = new Set(itemsDoc.items.map((entry) => entry.id));
const definitions = gems
  .map(buildGemDefinition)
  .filter((def) => def.gem.stat || def.gem.durabilityBonus > 0);

let added = 0;
for (const def of definitions) {
  if (existingIds.has(def.id)) continue;
  itemsDoc.items.push(def);
  existingIds.add(def.id);
  added += 1;
}

itemsDoc.items.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(itemsOutputPath, `${JSON.stringify(itemsDoc, null, 2)}\n`);
console.log(`Added ${added} gem/orb items (${definitions.length} total definitions).`);
