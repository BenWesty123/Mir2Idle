import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "../item-icon-utils.mjs";

export const idOverrides = {
  "BaseDress(M)": "base-dress",
  "LightArmour(M)": "light-armour",
  "SolidArmour(M)": "solid-armour",
  "BoneRobe(M)": "bone-robe",
  "MediumArmour(M)": "medium-armour",
  "HeavyArmour(M)": "heavy-armour",
  "MagicRobe(M)": "magic-robe",
  "SoulArmour(M)": "soul-armour",
  "IronArmour(M)": "iron-armour",
  "WizardRobe(M)": "wizard-robe",
  "PearlArmour(M)": "pearl-armour",
  "TaoArmour(M)": "tao-armour",
  "SteelArmour(M)": "steel-armour",
  "SteelArmour(F)": "steel-armour-f",
  "DragonRobe(M)": "dragon-robe",
  "DragonRobe(F)": "dragon-robe-f",
  "TitanArmour(M)": "titan-armour",
  "TitanArmour(F)": "titan-armour-f",
  "RoyalArmour(M)": "royal-armour",
  "RoyalArmour(F)": "royal-armour-f",
  "StuddedArmour(M)": "studded-armour",
  "StuddedArmour(F)": "studded-armour-f",
  "8TrigramWheel": "8-trigram-wheel",
};

export const nameOverrides = {
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
};

const typeSlots = {
  Armour: "armour",
  Weapon: "weapon",
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
  return name
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugFor(item) {
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

/** Crystal class mask 8 = Assassin, 16 = Archer. */
export function isAssassinOrArcherGear(requiredClass) {
  const mask = Number(requiredClass) || 0;
  return (mask & 8) !== 0 || (mask & 16) !== 0;
}

export function weaponOrArmourFromCrystal(crystal, root, publicIconRoot = path.join(root, "public/item-icons/items")) {
  const frame = Number(crystal.icon?.frame) || 0;
  if (frame) copyItemIcon(root, frame, publicIconRoot);

  const slot = typeSlots[crystal.type];
  const def = {
    id: slugFor(crystal),
    name: displayName(crystal.name),
    type: slot,
    slot,
    class: itemClass(crystal.requiredClass),
    source: { crystalIndex: crystal.crystalIndex, name: crystal.name },
    icon: {
      library: crystal.icon?.library ?? "Items",
      frame,
      src: `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: requirementFor(crystal),
    stackable: false,
    maxStack: 1,
    stats: normalStats(crystal.stats),
    shop: {
      buy: Number(crystal.price) || 0,
      sell: Math.max(1, Math.floor((Number(crystal.price) || 0) / 5)),
    },
    visual: { layer: slot, index: Number(crystal.shape) || 0 },
    crystalType: crystal.type,
  };

  if (Number(crystal.set) > 0) def.set = Number(crystal.set);
  return def;
}

export function loadCrystalItems(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
}

export function loadItemsDoc(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8"));
}

export function saveItemsDoc(root, itemsDoc) {
  fs.writeFileSync(path.join(root, "src/data/items.json"), `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");
}
