/**
 * Empowered boss drops: equippable items may roll bonus stats (separate from gem/smith bonuses).
 */

import { sanitizeItemBonusStats } from "../battleData.js";

/** Base chance an equippable boss drop becomes empowered (before future rebirth bonuses). */
export const BOSS_EMPOWER_ITEM_CHANCE = 0.2;

/** Given empowered, weighted tier roll (1–4 stat empowerments). */
export const EMPOWER_TIER_WEIGHTS = [
  { tier: 1, weight: 60 },
  { tier: 2, weight: 30 },
  { tier: 3, weight: 7.5 },
  { tier: 4, weight: 2.5 },
];

/** Warrior-oriented weapon empowers — Warrior and Universal weapons only. */
const WEAPON_DC_EMPOWER_UTILITY_KEYS = new Set(["accuracy", "attackSpeed", "freezing", "poisonAttack"]);

/** Weapon empower class definitions (base stats only; gems/smith ignored). */
export const WEAPON_EMPOWER_CLASS_DEFS = [
  {
    id: "warrior",
    label: "Warrior weapon",
    description: "Base DC only — no MC or SC.",
  },
  {
    id: "wizard",
    label: "Wizard weapon",
    description: "Base DC + MC — no SC.",
  },
  {
    id: "tao",
    label: "Tao weapon",
    description: "Base DC + SC — no MC.",
  },
  {
    id: "universal",
    label: "Universal weapon",
    description: "Base DC + MC + SC.",
  },
];

const WEAPON_CLASS_SAMPLE_STATS = {
  warrior: { dc: [0, 10], mc: [0, 0], sc: [0, 0] },
  wizard: { dc: [0, 10], mc: [0, 8], sc: [0, 0] },
  tao: { dc: [0, 10], mc: [0, 0], sc: [0, 8] },
  universal: { dc: [0, 5], mc: [0, 5], sc: [0, 5] },
};

/** Weapon empowerments: one roll per stat key, no duplicates on the same item. */
export const WEAPON_EMPOWER_ROLL_DEFS = [
  { key: "dc", range: true, index: 1, min: 1, max: 5 },
  { key: "mc", range: true, index: 1, min: 1, max: 3 },
  { key: "sc", range: true, index: 1, min: 1, max: 3 },
  { key: "accuracy", range: false, min: 1, max: 3 },
  { key: "attackSpeed", range: false, min: 1, max: 2 },
  { key: "freezing", range: false, min: 1, max: 2 },
  { key: "poisonAttack", range: false, min: 1, max: 2 },
  { key: "luck", range: false, min: 1, max: 2 },
  { key: "goldBonusPercent", range: false, min: 5, max: 25, step: 5 },
  { key: "xpBonusPercent", range: false, min: 1, max: 5, step: 1 },
  { key: "dropChanceBonusPercent", range: false, min: 0.25, max: 2, step: 0.25 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 25, step: 5 },
];

/** Armour empowerments: one roll per stat key, no duplicates on the same item. */
export const ARMOUR_EMPOWER_ROLL_DEFS = [
  { key: "ac", range: true, index: 1, min: 1, max: 5 },
  { key: "amc", range: true, index: 1, min: 1, max: 5 },
  { key: "dc", range: true, index: 1, min: 1, max: 5 },
  { key: "mc", range: true, index: 1, min: 1, max: 3 },
  { key: "sc", range: true, index: 1, min: 1, max: 3 },
  { key: "hp", range: false, min: 10, max: 100, step: 10 },
  { key: "mp", range: false, min: 10, max: 100, step: 10 },
  { key: "agility", range: false, min: 1, max: 3 },
  { key: "xpBonusPercent", range: false, min: 5, max: 20, step: 5 },
];

/** Helmet empowerments: one roll per stat key, no duplicates on the same item. */
export const HELMET_EMPOWER_ROLL_DEFS = [
  { key: "ac", range: true, index: 1, min: 1, max: 3 },
  { key: "amc", range: true, index: 1, min: 1, max: 3 },
  { key: "dc", range: true, index: 1, min: 1, max: 3 },
  { key: "mc", range: true, index: 1, min: 1, max: 2 },
  { key: "sc", range: true, index: 1, min: 1, max: 2 },
  { key: "hp", range: false, min: 10, max: 20, step: 10 },
  { key: "mp", range: false, min: 10, max: 20, step: 10 },
];

/** Bracelet empowerments: one roll per stat key, no duplicates on the same item. */
export const BRACELET_EMPOWER_ROLL_DEFS = [
  { key: "ac", range: true, index: 1, min: 1, max: 2 },
  { key: "amc", range: true, index: 1, min: 1, max: 2 },
  { key: "dc", range: true, index: 1, min: 1, max: 4 },
  { key: "sc", range: true, index: 1, min: 1, max: 3 },
  { key: "mc", range: true, index: 1, min: 1, max: 3 },
  { key: "poisonResist", range: false, min: 1, max: 1 },
  { key: "magicResist", range: false, min: 1, max: 1 },
  { key: "agility", range: false, min: 1, max: 3 },
  { key: "accuracy", range: false, min: 1, max: 3 },
];

/** Ring empowerments: one roll per stat key, no duplicates on the same item. */
export const RING_EMPOWER_ROLL_DEFS = [
  { key: "dc", range: true, index: 1, min: 1, max: 6 },
  { key: "mc", range: true, index: 1, min: 1, max: 4 },
  { key: "sc", range: true, index: 1, min: 1, max: 4 },
  { key: "attackSpeed", range: false, min: 1, max: 2 },
  { key: "freezing", range: false, min: 1, max: 2 },
  { key: "poisonAttack", range: false, min: 1, max: 2 },
  { key: "ac", range: true, index: 1, min: 1, max: 3 },
  { key: "amc", range: true, index: 1, min: 1, max: 3 },
];

/** Belt / boots empowerments: one roll per stat key, no duplicates on the same item. */
export const BELT_BOOT_EMPOWER_ROLL_DEFS = [
  { key: "ac", range: true, index: 1, min: 1, max: 3 },
  { key: "amc", range: true, index: 1, min: 1, max: 3 },
  { key: "dc", range: true, index: 1, min: 1, max: 2 },
  { key: "sc", range: true, index: 1, min: 1, max: 2 },
  { key: "mc", range: true, index: 1, min: 1, max: 2 },
  { key: "agility", range: false, min: 1, max: 2 },
  { key: "accuracy", range: false, min: 1, max: 2 },
  { key: "poisonResist", range: false, min: 1, max: 1 },
  { key: "magicResist", range: false, min: 1, max: 1 },
  { key: "hp", range: false, min: 10, max: 30, step: 10 },
  { key: "mp", range: false, min: 10, max: 30, step: 10 },
];

/** Stone empowerments: one roll per stat key, no duplicates on the same item. */
export const STONE_EMPOWER_ROLL_DEFS = [
  { key: "dc", range: true, index: 1, min: 1, max: 3 },
  { key: "sc", range: true, index: 1, min: 1, max: 3 },
  { key: "mc", range: true, index: 1, min: 1, max: 3 },
  { key: "ac", range: true, index: 1, min: 1, max: 2 },
  { key: "amc", range: true, index: 1, min: 1, max: 2 },
];

/** Extra empower rolls on MC weapons only (base definition includes MC, not gems/smith). */
export const MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS = [
  {
    key: "spell:FlameDisruptor:damage",
    spellId: "FlameDisruptor",
    kind: "damagePercent",
    min: 10,
    max: 35,
    step: 5,
    label: "Flame Disruptor",
  },
  {
    key: "spell:FireWall:damage",
    spellId: "FireWall",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Fire Wall",
  },
  {
    key: "spell:ThunderBolt:damage",
    spellId: "ThunderBolt",
    kind: "damagePercent",
    min: 10,
    max: 35,
    step: 5,
    label: "Thunder Bolt",
  },
  {
    key: "spell:IceStorm:damage",
    spellId: "IceStorm",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Ice Storm",
  },
  {
    key: "spell:FlameField:damage",
    spellId: "FlameField",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Flame Field",
  },
  {
    key: "spell:MeteorStrike:damage",
    spellId: "MeteorStrike",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Meteor Strike",
  },
  {
    key: "spell:Blizzard:damage",
    spellId: "Blizzard",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Blizzard",
  },
  {
    key: "spell:FlameDisruptor:mana",
    spellId: "FlameDisruptor",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Flame Disruptor",
  },
  {
    key: "spell:FireWall:mana",
    spellId: "FireWall",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Fire Wall",
  },
];

/** Extra empower rolls on warrior weapons only (base DC, no MC or SC). */
export const WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS = [
  {
    key: "skill:Slaying:damage",
    spellId: "Slaying",
    kind: "damagePercent",
    min: 5,
    max: 35,
    step: 5,
    label: "Slaying",
  },
  {
    key: "skill:FlamingSword:damage",
    spellId: "FlamingSword",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Flaming Sword",
  },
  {
    key: "skill:FlamingSword:cooldown",
    spellId: "FlamingSword",
    kind: "cooldownReductionSeconds",
    min: 1,
    max: 5,
    step: 1,
    label: "Flaming Sword",
  },
  {
    key: "skill:TwinDrakeBlade:damage",
    spellId: "TwinDrakeBlade",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Twin Drake Blade",
  },
];

/** Extra empower rolls on SC weapons only (base definition includes SC, not gems/smith). */
export const SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS = [
  {
    key: "spell:Healing:healing",
    spellId: "Healing",
    kind: "healingPercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Healing",
  },
  {
    key: "spell:MassHealing:healing",
    spellId: "MassHealing",
    kind: "healingPercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Mass Healing",
  },
  {
    key: "spell:SoulFireBall:damage",
    spellId: "SoulFireBall",
    kind: "damagePercent",
    min: 10,
    max: 35,
    step: 5,
    label: "Soul Fire Ball",
  },
  {
    key: "spell:SummonSkeleton:damage",
    spellId: "SummonSkeleton",
    kind: "damagePercent",
    min: 10,
    max: 50,
    step: 5,
    label: "Skeleton",
  },
  {
    key: "spell:SummonShinsu:damage",
    spellId: "SummonShinsu",
    kind: "damagePercent",
    min: 10,
    max: 50,
    step: 5,
    label: "Shinsu",
  },
];

const SPELL_EMPOWER_LABELS = {
  FlameDisruptor: "Flame Disruptor",
  FireWall: "Fire Wall",
  ThunderBolt: "Thunder Bolt",
  IceStorm: "Ice Storm",
  FlameField: "Flame Field",
  MeteorStrike: "Meteor Strike",
  Blizzard: "Blizzard",
  Healing: "Healing",
  MassHealing: "Mass Healing",
  SoulFireBall: "Soul Fire Ball",
  SummonSkeleton: "Skeleton",
  SummonShinsu: "Shinsu",
  Slaying: "Slaying",
  FlamingSword: "Flaming Sword",
  TwinDrakeBlade: "Twin Drake Blade",
};

const RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];
const SCALAR_KEYS = [
  "hp", "mp", "accuracy", "agility", "luck", "attackSpeed",
  "poisonAttack", "freezing", "magicResist", "poisonResist",
  "healthRecovery", "poisonRecovery", "strong",
];

const STAT_LABELS = {
  dc: "DC",
  mc: "MC",
  sc: "SC",
  ac: "AC",
  amc: "AMC",
  hp: "HP",
  mp: "MP",
  accuracy: "Acc",
  agility: "Agi",
  luck: "Luck",
  attackSpeed: "A Speed",
  poisonAttack: "Poison",
  freezing: "Freezing",
  magicResist: "Magic Resist",
  poisonResist: "Poison Resist",
  healthRecovery: "HP Recovery",
  poisonRecovery: "Poison Recovery",
  strong: "Strong",
  xpBonusPercent: "Bonus XP",
  goldBonusPercent: "Gold drop",
  dropChanceBonusPercent: "Item drop chance",
  bonusAwakeningSoulChancePercent: "Awakening Soul drop chance",
};

const ARMOUR_EMPOWER_SLOTS = new Set(["armour", "dress"]);
const BELT_BOOT_EMPOWER_SLOTS = new Set(["belt", "boots"]);

/** @deprecated Use MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS */
export const MC_ITEM_SPELL_EMPOWER_ROLL_DEFS = MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS;

/** Slot groups for empower reference UI and per-slot roll tables. */
export const EMPOWER_SLOT_GROUPS = [
  { id: "weapon", label: "Weapon", slots: ["weapon"], rollDefs: WEAPON_EMPOWER_ROLL_DEFS },
  { id: "armour", label: "Armour", slots: ["armour", "dress"], rollDefs: ARMOUR_EMPOWER_ROLL_DEFS },
  { id: "helmet", label: "Helmet", slots: ["helmet"], rollDefs: HELMET_EMPOWER_ROLL_DEFS },
  { id: "bracelet", label: "Bracelet", slots: ["bracelet"], rollDefs: BRACELET_EMPOWER_ROLL_DEFS },
  { id: "ring", label: "Ring", slots: ["ring"], rollDefs: RING_EMPOWER_ROLL_DEFS },
  { id: "belt_boots", label: "Belt / Boots", slots: ["belt", "boots"], rollDefs: BELT_BOOT_EMPOWER_ROLL_DEFS },
  { id: "stone", label: "Stone", slots: ["stone"], rollDefs: STONE_EMPOWER_ROLL_DEFS },
  { id: "other", label: "Other", slots: ["necklace"], legacy: true },
];

/**
 * @param {object | null | undefined} item
 */
export function itemCanBeEmpowered(item) {
  const slot = item?.slot;
  if (!slot || slot === "consumable") return false;
  if (item?.type === "book" || item?.type === "scroll") return false;
  if (item?.gem) return false;
  return true;
}

/**
 * @param {object | null | undefined} item
 */
export function itemEmpowerLevel(item) {
  return Math.max(1, Math.trunc(Number(item?.requirements?.level) || 0));
}

/** Suffix appended to empowered item names (one star per empowerment tier, max 4). */
export const EMPOWER_STAR = "★";

/**
 * @param {string} label
 * @param {boolean} [empowered]
 * @returns {string}
 */
export function empoweredStatLabel(label, empowered = false) {
  if (!label || !empowered) return label ?? "";
  return `${label}${EMPOWER_STAR}`;
}

/**
 * @param {object | null | undefined} entry
 * @returns {string}
 */
export function empoweredItemStarSuffix(entry) {
  const tier = Math.max(0, Math.trunc(Number(entry?.empowerTier) || 0));
  if (tier > 0) return EMPOWER_STAR.repeat(Math.min(4, tier));
  if (entry?.empowered) return EMPOWER_STAR;
  return "";
}

/**
 * @param {{ tier: number, weight: number }[]} weights
 * @param {() => number} [rng]
 * @returns {number}
 */
export function rollEmpowerTier(weights = EMPOWER_TIER_WEIGHTS, rng = Math.random) {
  const rows = Array.isArray(weights) ? weights.filter((row) => (Number(row?.weight) || 0) > 0) : [];
  if (!rows.length) return 1;
  const total = rows.reduce((sum, row) => sum + Number(row.weight) || 0, 0);
  if (total <= 0) return 1;
  let roll = rng() * total;
  for (const row of rows) {
    roll -= Number(row.weight) || 0;
    if (roll < 0) return Math.max(1, Math.trunc(Number(row.tier) || 1));
  }
  return Math.max(1, Math.trunc(Number(rows[rows.length - 1].tier) || 1));
}

/**
 * @param {object | null | undefined} stats
 * @param {string} key
 */
function readItemScalarStat(stats, key) {
  if (key === "freezing") return Math.trunc(Number(stats?.Freezing ?? stats?.freezing) || 0);
  return Math.trunc(Number(stats?.[key]) || 0);
}

/**
 * Base item definition has non-zero stat on min or max, ignoring gems/smith/empower bonuses.
 * @param {object | null | undefined} item
 * @param {"dc" | "mc" | "sc"} key
 */
function itemHasNaturalRangeStat(item, key) {
  const range = item?.stats?.[key];
  if (!Array.isArray(range)) return false;
  return (Number(range[0]) || 0) !== 0 || (Number(range[1]) || 0) !== 0;
}

/**
 * @param {object | null | undefined} item
 */
export function itemHasNaturalDc(item) {
  return itemHasNaturalRangeStat(item, "dc");
}

/**
 * Base item definition has non-zero MC (min or max), ignoring gems/smith/empower bonuses.
 * @param {object | null | undefined} item
 */
export function itemHasNaturalMc(item) {
  return itemHasNaturalRangeStat(item, "mc");
}

/**
 * @param {object | null | undefined} item
 */
export function itemHasNaturalSc(item) {
  return itemHasNaturalRangeStat(item, "sc");
}

/**
 * @param {string | null | undefined} classId
 * @returns {string}
 */
export function weaponEmpowerClassLabel(classId) {
  return WEAPON_EMPOWER_CLASS_DEFS.find((def) => def.id === classId)?.label ?? "Unknown weapon";
}

/**
 * @param {object | null | undefined} item
 * @returns {"warrior" | "wizard" | "tao" | "universal" | null}
 */
export function weaponEmpowerClass(item) {
  if (item?.slot !== "weapon") return null;
  const hasDc = itemHasNaturalDc(item);
  const hasMc = itemHasNaturalMc(item);
  const hasSc = itemHasNaturalSc(item);
  if (!hasDc) return null;
  if (hasMc && hasSc) return "universal";
  if (hasMc) return "wizard";
  if (hasSc) return "tao";
  return "warrior";
}

/**
 * @param {"warrior" | "wizard" | "tao" | "universal"} classId
 * @returns {string[]}
 */
export function weaponEmpowerRollDescriptionsForClass(classId) {
  const stats = WEAPON_CLASS_SAMPLE_STATS[classId];
  if (!stats) return [];
  return empowerRollDescriptionsForItem({ slot: "weapon", type: "weapon", stats });
}

/**
 * Warrior and Universal weapons roll DC empower.
 * @param {object | null | undefined} item
 */
export function weaponCanRollDcEmpower(item) {
  const cls = weaponEmpowerClass(item);
  return cls === "warrior" || cls === "universal";
}

/**
 * @param {object | null | undefined} item
 */
function filterWeaponEmpowerRollDefs(item) {
  const cls = weaponEmpowerClass(item);
  return WEAPON_EMPOWER_ROLL_DEFS.filter((def) => {
    if (def.key === "dc") return cls === "warrior" || cls === "universal";
    if (def.key === "mc") return cls === "wizard" || cls === "universal";
    if (def.key === "sc") return cls === "tao" || cls === "universal";
    if (WEAPON_DC_EMPOWER_UTILITY_KEYS.has(def.key)) return cls === "warrior" || cls === "universal";
    return true;
  });
}

/**
 * @param {{ key: string, range?: boolean, index?: number, min?: number, max?: number, step?: number, spellId?: string, kind?: string, label?: string }[]} rollDefs
 * @param {object | null | undefined} item
 */
function cloneEmpowerRollDefs(rollDefs) {
  return rollDefs.map((def) => ({ ...def }));
}

function withWeaponSpellEmpowerRolls(rollDefs, item) {
  const rolls = cloneEmpowerRollDefs(rollDefs);
  if (item?.slot !== "weapon") return rolls;
  if (weaponEmpowerClass(item) === "warrior") {
    for (const def of WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS) rolls.push({ ...def });
  }
  if (itemHasNaturalMc(item)) {
    for (const def of MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS) rolls.push({ ...def });
  }
  if (itemHasNaturalSc(item)) {
    for (const def of SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS) rolls.push({ ...def });
  }
  return rolls;
}

/**
 * @param {object | null | undefined} bonuses
 */
export function sanitizeEmpowerSpellBonuses(bonuses) {
  const sanitized = {};
  if (!bonuses || typeof bonuses !== "object") return sanitized;
  for (const [spellId, row] of Object.entries(bonuses)) {
    if (!spellId || !row || typeof row !== "object") continue;
    const entry = {};
    const damagePercent = Math.trunc(Number(row.damagePercent) || 0);
    if (damagePercent !== 0) entry.damagePercent = damagePercent;
    const manaCostPercent = Math.trunc(Number(row.manaCostPercent) || 0);
    if (manaCostPercent !== 0) entry.manaCostPercent = manaCostPercent;
    const healingPercent = Math.trunc(Number(row.healingPercent) || 0);
    if (healingPercent !== 0) entry.healingPercent = healingPercent;
    const cooldownReductionSeconds = Math.trunc(Number(row.cooldownReductionSeconds) || 0);
    if (cooldownReductionSeconds !== 0) entry.cooldownReductionSeconds = cooldownReductionSeconds;
    if (Object.keys(entry).length) sanitized[spellId] = entry;
  }
  return sanitized;
}

/**
 * @param {object | null | undefined} item
 * @returns {{ key: string, range: boolean, index?: number, min?: number, max?: number }[]}
 */
export function empowerCandidateRolls(item) {
  if (item?.slot === "weapon") {
    return withWeaponSpellEmpowerRolls(filterWeaponEmpowerRollDefs(item), item);
  }
  if (ARMOUR_EMPOWER_SLOTS.has(item?.slot)) {
    return cloneEmpowerRollDefs(ARMOUR_EMPOWER_ROLL_DEFS);
  }
  if (item?.slot === "helmet") {
    return cloneEmpowerRollDefs(HELMET_EMPOWER_ROLL_DEFS);
  }
  if (item?.slot === "bracelet") {
    return cloneEmpowerRollDefs(BRACELET_EMPOWER_ROLL_DEFS);
  }
  if (item?.slot === "ring") {
    return cloneEmpowerRollDefs(RING_EMPOWER_ROLL_DEFS);
  }
  if (BELT_BOOT_EMPOWER_SLOTS.has(item?.slot)) {
    return cloneEmpowerRollDefs(BELT_BOOT_EMPOWER_ROLL_DEFS);
  }
  if (item?.slot === "stone") {
    return cloneEmpowerRollDefs(STONE_EMPOWER_ROLL_DEFS);
  }

  const stats = item?.stats ?? {};
  const candidates = [];
  for (const key of RANGE_KEYS) {
    const range = stats[key];
    if (!Array.isArray(range)) continue;
    if ((Number(range[0]) || 0) !== 0) candidates.push({ key, range: true, index: 0 });
    if ((Number(range[1]) || 0) !== 0) candidates.push({ key, range: true, index: 1 });
  }
  for (const key of SCALAR_KEYS) {
    if (readItemScalarStat(stats, key) !== 0) candidates.push({ key, range: false });
  }
  if (candidates.length) return candidates.map((def) => ({ ...def }));
  return defaultEmpowerCandidatesForSlot(item?.slot, stats).map((def) => ({ ...def }));
}

/**
 * @param {object | null | undefined} item
 */
export function empowerSlotGroupForItem(item) {
  const slot = item?.slot;
  if (!slot) return null;
  return EMPOWER_SLOT_GROUPS.find((group) => group.slots?.includes(slot)) ?? null;
}

/**
 * @param {{ key: string, range?: boolean, index?: number, min?: number, max?: number, step?: number, spellId?: string, kind?: string, label?: string }} roll
 */
export function formatEmpowerRollDescription(roll) {
  if (roll.spellId && roll.kind === "damagePercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Increase ${label} damage by ${min}%`;
    return `Increase ${label} damage by ${min}–${max}%`;
  }
  if (roll.spellId && roll.kind === "manaCostPercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Reduce mana cost of ${label} by ${min}%`;
    return `Reduce mana cost of ${label} by ${min}–${max}%`;
  }
  if (roll.spellId && roll.kind === "healingPercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Increase ${label} healing by ${min}%`;
    return `Increase ${label} healing by ${min}–${max}%`;
  }
  if (roll.spellId && roll.kind === "cooldownReductionSeconds") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Reduce ${label} cooldown by ${min} second${min === 1 ? "" : "s"}`;
    return `Reduce ${label} cooldown by ${min}–${max} seconds`;
  }
  const stat = STAT_LABELS[roll.key] ?? roll.key;
  const min = roll.min != null ? Math.trunc(Number(roll.min) || 0) : null;
  const max = roll.max != null ? Math.trunc(Number(roll.max) || 0) : null;
  const step = roll.step != null ? Math.max(1, Math.trunc(Number(roll.step) || 1)) : 0;
  const suffix = roll.range && roll.index === 0 ? " (min)" : "";
  if (roll.key === "xpBonusPercent" || roll.key === "goldBonusPercent" || roll.key === "bonusAwakeningSoulChancePercent") {
    if (min != null && max != null && min !== max) return `+${min}–${max}% ${stat}`;
    if (min != null) return `+${min}% ${stat}`;
    return `+${stat}`;
  }
  if (roll.key === "dropChanceBonusPercent") {
    const formatPoints = (value) => {
      const rounded = Number(Number(value).toFixed(2));
      return Number.isInteger(rounded) ? `${rounded}%` : `${rounded}%`;
    };
    if (min != null && max != null && min !== max) return `+${formatPoints(min)}–${formatPoints(max)} ${stat}`;
    if (min != null) return `+${formatPoints(min)} ${stat}`;
    return `+${stat}`;
  }
  if (min != null && max != null) {
    if (step > 1) {
      if (min === max) return `+${min} ${stat}${suffix}`;
      return `+${min}–${max} ${stat} (step ${step})${suffix}`;
    }
    if (min === max) return `+${min} ${stat}${suffix}`;
    return `+${min}–${max} ${stat}${suffix}`;
  }
  return `+${stat}`;
}

/**
 * @param {object | null | undefined} item
 * @returns {string[]}
 */
export function empowerRollDescriptionsForItem(item) {
  if (!itemCanBeEmpowered(item)) return [];
  return empowerCandidateRolls(item).map(formatEmpowerRollDescription);
}

/**
 * Summary of empower drop rules and per-slot roll tables.
 */
export function empowerReferenceCatalog() {
  const tierTotal = EMPOWER_TIER_WEIGHTS.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  return {
    itemChancePercent: Math.round(BOSS_EMPOWER_ITEM_CHANCE * 100),
    tierWeights: EMPOWER_TIER_WEIGHTS.map((row) => ({
      tier: row.tier,
      weight: row.weight,
      percent: tierTotal > 0 ? Math.round(((Number(row.weight) || 0) / tierTotal) * 1000) / 10 : 0,
    })),
    slotGroups: EMPOWER_SLOT_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      slots: [...(group.slots ?? [])],
      legacy: Boolean(group.legacy),
      rolls: group.id === "weapon"
        ? WEAPON_EMPOWER_ROLL_DEFS
          .filter((def) => def.key === "luck")
          .map(formatEmpowerRollDescription)
        : (group.rollDefs ? group.rollDefs.map(formatEmpowerRollDescription) : []),
      conditionalRolls: [],
    })),
    weaponClasses: WEAPON_EMPOWER_CLASS_DEFS.map((def) => ({
      id: def.id,
      label: def.label,
      description: def.description,
      rolls: weaponEmpowerRollDescriptionsForClass(def.id),
    })),
    weaponRules: [
      "Weapons are classified by base DC / MC / SC (gems, smith, and empower bonuses ignored).",
      "Warrior weapon — DC only. Wizard weapon — DC + MC. Tao weapon — DC + SC. Universal weapon — DC + MC + SC.",
      "Warrior and Universal weapons roll DC empower plus Acc, A Speed, Freezing, and Poison.",
      "Warrior weapons also roll warrior skill damage and Flaming Sword cooldown empowers.",
      "Wizard and Universal weapons roll MC empower; MC weapons also roll wizard spell damage and mana cost empowers.",
      "Tao and Universal weapons roll SC empower; SC weapons also roll tao spell healing, damage, and pet damage empowers.",
      "All weapons may roll gold drop, bonus XP, item drop chance, and Awakening Soul drop chance empowers.",
      "Luck — all weapon classes.",
    ],
  };
}

/**
 * @param {string | null | undefined} slot
 * @param {object} stats
 */
function defaultEmpowerCandidatesForSlot(slot, stats) {
  if (slot === "dress" || slot === "helmet") {
    return [{ key: "ac", range: true, index: 1 }, { key: "hp", range: false }];
  }
  if (slot === "bracelet" || slot === "ring") {
    return [{ key: "dc", range: true, index: 1 }, { key: "mc", range: true, index: 1 }];
  }
  if (slot === "necklace") {
    return [{ key: "hp", range: false }, { key: "accuracy", range: false }];
  }
  if (slot === "belt") return [{ key: "hp", range: false }];
  if (slot === "boots") return [{ key: "agility", range: false }];
  return [{ key: "ac", range: true, index: 1 }];
}

/**
 * @param {{ min?: number, max?: number }} roll
 * @param {() => number} rng
 */
function rollBoundedAmount(roll, rng) {
  const min = Number(roll.min);
  const max = Number(roll.max);
  const step = Number(roll.step ?? 1);
  if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(step) && step > 0) {
    const minUnits = Math.round(min / step);
    const maxUnits = Math.round(max / step);
    const span = Math.max(0, maxUnits - minUnits);
    const pickedUnits = minUnits + Math.floor(rng() * (span + 1));
    const value = pickedUnits * step;
    return step < 1 ? Number(value.toFixed(4)) : Math.trunc(value);
  }
  const legacyMin = Math.max(0, Math.trunc(Number(roll.min) || 1));
  const legacyMax = Math.max(legacyMin, Math.trunc(Number(roll.max) || legacyMin));
  const legacyStep = Math.max(1, Math.trunc(Number(roll.step) || 1));
  const steps = Math.floor((legacyMax - legacyMin) / legacyStep) + 1;
  return legacyMin + Math.floor(rng() * steps) * legacyStep;
}

/**
 * Legacy amount roll for non-weapon slots (until per-slot tables are defined).
 * @param {string} key
 * @param {boolean} range
 * @param {number} level
 * @param {() => number} rng
 */
function empowerRollAmountLegacy(key, range, level, rng) {
  const tier = Math.max(1, Math.min(70, level));
  if (range && RANGE_KEYS.includes(key)) {
    const maxBonus = tier >= 50 ? 4 : tier >= 30 ? 3 : 2;
    return 1 + Math.floor(rng() * maxBonus);
  }
  if (key === "hp" || key === "mp") {
    const span = tier >= 50 ? 16 : 11;
    const base = tier >= 50 ? 25 : tier >= 30 ? 15 : 10;
    return base + Math.floor(rng() * span);
  }
  return 1 + Math.floor(rng() * (tier >= 50 ? 3 : 2));
}

/**
 * @param {{ key: string, range: boolean, index?: number, min?: number, max?: number }[]} candidates
 * @param {number} count
 * @param {() => number} rng
 */
export function pickEmpowerRollsWithoutReplacement(candidates, count, rng = Math.random) {
  const pool = [...candidates];
  const picked = [];
  const picks = Math.max(0, Math.min(Math.trunc(Number(count) || 0), pool.length));
  for (let i = 0; i < picks; i += 1) {
    const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * @param {object} empowerBonusStats
 * @param {{ key: string, range: boolean, index?: number, min?: number, max?: number }} roll
 * @param {number} [level]
 * @param {() => number} [rng]
 */
export function applyEmpowerRollToStats(empowerBonusStats, roll, level = 1, rng = Math.random) {
  const amount = roll.min != null && roll.max != null
    ? rollBoundedAmount(roll, rng)
    : empowerRollAmountLegacy(roll.key, roll.range, level, rng);
  if (roll.range) {
    empowerBonusStats[roll.key][roll.index ?? 1] += amount;
    return amount;
  }
  empowerBonusStats[roll.key] += amount;
  return amount;
}

/**
 * @param {object} empowerSpellBonuses
 * @param {{ spellId?: string, kind?: string, min?: number, max?: number }} roll
 * @param {() => number} [rng]
 */
export function applyEmpowerSpellRoll(empowerSpellBonuses, roll, rng = Math.random) {
  const spellId = String(roll?.spellId ?? "");
  if (!spellId || !roll?.kind) return 0;
  const amount = rollBoundedAmount(roll, rng);
  if (!empowerSpellBonuses[spellId]) empowerSpellBonuses[spellId] = {};
  if (roll.kind === "damagePercent") {
    empowerSpellBonuses[spellId].damagePercent = (empowerSpellBonuses[spellId].damagePercent || 0) + amount;
  } else if (roll.kind === "manaCostPercent") {
    empowerSpellBonuses[spellId].manaCostPercent = (empowerSpellBonuses[spellId].manaCostPercent || 0) + amount;
  } else if (roll.kind === "healingPercent") {
    empowerSpellBonuses[spellId].healingPercent = (empowerSpellBonuses[spellId].healingPercent || 0) + amount;
  } else if (roll.kind === "cooldownReductionSeconds") {
    empowerSpellBonuses[spellId].cooldownReductionSeconds = (empowerSpellBonuses[spellId].cooldownReductionSeconds || 0) + amount;
  } else {
    return 0;
  }
  return amount;
}

/**
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedSpellDamageBonusPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.damagePercent) || 0;
  }
  return total;
}

/**
 * @param {string | null | undefined} spellId
 * @param {number} damage
 * @param {object | null | undefined} inventory
 */
export function applyEquippedSpellDamageBonus(spellId, damage, inventory) {
  const base = Math.trunc(Number(damage) || 0);
  const bonusPercent = equippedSpellDamageBonusPercent(spellId, inventory);
  if (bonusPercent <= 0) return base;
  return Math.trunc(base * (1 + bonusPercent / 100));
}

/**
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedSpellManaCostReductionPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.manaCostPercent) || 0;
  }
  return total;
}

/**
 * @param {string | null | undefined} spellId
 * @param {number} baseCost
 * @param {object | null | undefined} inventory
 */
export function applyEquippedSpellMpCostReduction(spellId, baseCost, inventory) {
  const cost = Math.max(0, Math.trunc(Number(baseCost) || 0));
  const reductionPercent = equippedSpellManaCostReductionPercent(spellId, inventory);
  if (reductionPercent <= 0) return cost;
  return Math.max(0, Math.trunc(cost * (1 - reductionPercent / 100)));
}

/**
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedSpellHealingBonusPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.healingPercent) || 0;
  }
  return total;
}

/**
 * @param {string | null | undefined} spellId
 * @param {number} healing
 * @param {object | null | undefined} inventory
 */
export function applyEquippedSpellHealingBonus(spellId, healing, inventory) {
  const base = Math.trunc(Number(healing) || 0);
  const bonusPercent = equippedSpellHealingBonusPercent(spellId, inventory);
  if (bonusPercent <= 0) return base;
  return Math.trunc(base * (1 + bonusPercent / 100));
}

/**
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedSpellCooldownReductionSeconds(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.cooldownReductionSeconds) || 0;
  }
  return total;
}

/**
 * @param {string | null | undefined} spellId
 * @param {number} cooldownMs
 * @param {object | null | undefined} inventory
 */
export function applyEquippedSpellCooldownReductionMs(spellId, cooldownMs, inventory) {
  const base = Math.max(0, Math.trunc(Number(cooldownMs) || 0));
  const reductionSeconds = equippedSpellCooldownReductionSeconds(spellId, inventory);
  if (reductionSeconds <= 0) return base;
  return Math.max(0, base - reductionSeconds * 1000);
}

/**
 * @param {object | null | undefined} item
 * @param {() => number} [rng]
 * @param {{ itemChance?: number, tierWeights?: { tier: number, weight: number }[] }} [options]
 * @returns {{ empowered: true, empowerTier: number, empowerBonusStats: object, empowerSpellBonuses: object } | null}
 */
export function rollEmpoweredItemDrop(item, rng = Math.random, options = {}) {
  if (!itemCanBeEmpowered(item)) return null;

  const itemChance = Math.min(1, Math.max(0, Number(options.itemChance ?? BOSS_EMPOWER_ITEM_CHANCE) || 0));
  if (rng() >= itemChance) return null;

  const requestedTier = rollEmpowerTier(options.tierWeights, rng);
  const candidates = empowerCandidateRolls(item);
  const empowerTier = Math.min(requestedTier, candidates.length);
  const picks = pickEmpowerRollsWithoutReplacement(candidates, empowerTier, rng);
  const empowerBonusStats = sanitizeItemBonusStats({});
  const empowerSpellBonuses = sanitizeEmpowerSpellBonuses({});
  const level = itemEmpowerLevel(item);

  for (const roll of picks) {
    if (roll.spellId && roll.kind) {
      applyEmpowerSpellRoll(empowerSpellBonuses, roll, rng);
    } else {
      applyEmpowerRollToStats(empowerBonusStats, roll, level, rng);
    }
  }

  return { empowered: true, empowerTier: picks.length, empowerBonusStats, empowerSpellBonuses };
}

/**
 * @param {object | null | undefined} empowerBonusStats
 * @returns {string[]}
 */
export function empowerBonusStatLines(empowerBonusStats) {
  const bonus = sanitizeItemBonusStats(empowerBonusStats);
  const lines = [];
  for (const key of RANGE_KEYS) {
    const range = bonus[key];
    if ((range[0] || 0) !== 0) lines.push(`+${range[0]} ${STAT_LABELS[key]} (min)`);
    if ((range[1] || 0) !== 0) lines.push(`+${range[1]} ${STAT_LABELS[key]}`);
  }
  for (const key of SCALAR_KEYS) {
    const value = bonus[key] || 0;
    if (value !== 0) lines.push(`+${value} ${STAT_LABELS[key]}`);
  }
  for (const key of ["xpBonusPercent", "goldBonusPercent", "bonusAwakeningSoulChancePercent"]) {
    const value = bonus[key] || 0;
    if (value !== 0) lines.push(`+${value}% ${STAT_LABELS[key]}`);
  }
  const dropBonus = bonus.dropChanceBonusPercent || 0;
  if (dropBonus !== 0) {
    const formatted = Number.isInteger(dropBonus) ? `${dropBonus}%` : `${Number(dropBonus.toFixed(2))}%`;
    lines.push(`+${formatted} ${STAT_LABELS.dropChanceBonusPercent}`);
  }
  return lines;
}

/**
 * @param {object | null | undefined} empowerSpellBonuses
 * @returns {string[]}
 */
export function empowerSpellBonusLines(empowerSpellBonuses) {
  const bonuses = sanitizeEmpowerSpellBonuses(empowerSpellBonuses);
  const lines = [];
  for (const [spellId, row] of Object.entries(bonuses)) {
    const label = SPELL_EMPOWER_LABELS[spellId] ?? spellId;
    if ((row.damagePercent || 0) !== 0) lines.push(`+${row.damagePercent}% ${label} damage`);
    if ((row.manaCostPercent || 0) !== 0) lines.push(`−${row.manaCostPercent}% ${label} mana cost`);
    if ((row.healingPercent || 0) !== 0) lines.push(`+${row.healingPercent}% ${label} healing`);
    if ((row.cooldownReductionSeconds || 0) !== 0) {
      const seconds = row.cooldownReductionSeconds;
      lines.push(`−${seconds}s ${label} cooldown`);
    }
  }
  return lines;
}

/**
 * @param {object | null | undefined} empowerSpellBonuses
 * @returns {{ label: string, value: string }[]}
 */
export function empowerSpellBonusTooltipRows(empowerSpellBonuses) {
  const bonuses = sanitizeEmpowerSpellBonuses(empowerSpellBonuses);
  const rows = [];
  for (const [spellId, row] of Object.entries(bonuses)) {
    const label = SPELL_EMPOWER_LABELS[spellId] ?? spellId;
    if ((row.damagePercent || 0) !== 0) {
      rows.push({ label, value: `+${row.damagePercent}% damage` });
    }
    if ((row.manaCostPercent || 0) !== 0) {
      rows.push({ label, value: `−${row.manaCostPercent}% mana cost` });
    }
    if ((row.healingPercent || 0) !== 0) {
      rows.push({ label, value: `+${row.healingPercent}% healing` });
    }
    if ((row.cooldownReductionSeconds || 0) !== 0) {
      rows.push({ label, value: `−${row.cooldownReductionSeconds}s cooldown` });
    }
  }
  return rows;
}

/**
 * @param {object | null | undefined} empowerBonusStats
 * @param {object | null | undefined} empowerSpellBonuses
 * @returns {string[]}
 */
export function empowerItemBonusLines(empowerBonusStats, empowerSpellBonuses) {
  return [
    ...empowerBonusStatLines(empowerBonusStats),
    ...empowerSpellBonusLines(empowerSpellBonuses),
  ];
}
