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
  { key: "goldBonusPercent", range: false, min: 5, max: 40, step: 5 },
  { key: "xpBonusPercent", range: false, min: 5, max: 40, step: 5 },
  { key: "dropChanceBonusPercent", range: false, min: 0.25, max: 1.5, step: 0.25 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 20, step: 5 },
  { key: "critChancePercent", range: false, min: 1, max: 20, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 30, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 5, max: 40, step: 5 },
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
  { key: "goldBonusPercent", range: false, min: 5, max: 30, step: 5 },
  { key: "xpBonusPercent", range: false, min: 5, max: 30, step: 5 },
  { key: "dropChanceBonusPercent", range: false, min: 0.25, max: 1, step: 0.25 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 15, step: 5 },
  { key: "damageTakenReductionPercent", range: false, min: 3, max: 12, step: 3 },
  { key: "critChancePercent", range: false, min: 1, max: 14, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 20, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 5, max: 30, step: 5 },
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
  { key: "goldBonusPercent", range: false, min: 5, max: 20, step: 5 },
  { key: "xpBonusPercent", range: false, min: 5, max: 20, step: 5 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 10, step: 5 },
  { key: "damageTakenReductionPercent", range: false, min: 2, max: 6, step: 2 },
  { key: "critChancePercent", range: false, min: 1, max: 10, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 15, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 5, max: 20, step: 5 },
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
  { key: "goldBonusPercent", range: false, min: 2, max: 12, step: 2 },
  { key: "xpBonusPercent", range: false, min: 2, max: 12, step: 2 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 2, max: 6, step: 2 },
  { key: "damageTakenReductionPercent", range: false, min: 1, max: 4, step: 1 },
  { key: "critChancePercent", range: false, min: 1, max: 6, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 15, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 2, max: 12, step: 2 },
];

/** Ring empowerments: one roll per stat key, no duplicates on the same item. Shared by necklaces. */
export const RING_EMPOWER_ROLL_DEFS = [
  { key: "dc", range: true, index: 1, min: 1, max: 6 },
  { key: "mc", range: true, index: 1, min: 1, max: 4 },
  { key: "sc", range: true, index: 1, min: 1, max: 4 },
  { key: "attackSpeed", range: false, min: 1, max: 2 },
  { key: "freezing", range: false, min: 1, max: 2 },
  { key: "poisonAttack", range: false, min: 1, max: 2 },
  { key: "ac", range: true, index: 1, min: 1, max: 3 },
  { key: "amc", range: true, index: 1, min: 1, max: 3 },
  { key: "goldBonusPercent", range: false, min: 2, max: 12, step: 2 },
  { key: "xpBonusPercent", range: false, min: 2, max: 12, step: 2 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 2, max: 6, step: 2 },
  { key: "damageTakenReductionPercent", range: false, min: 1, max: 4, step: 1 },
  { key: "critChancePercent", range: false, min: 1, max: 6, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 15, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 2, max: 12, step: 2 },
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
  { key: "goldBonusPercent", range: false, min: 2, max: 10, step: 2 },
  { key: "xpBonusPercent", range: false, min: 2, max: 10, step: 2 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 2, max: 5, step: 1 },
  { key: "damageTakenReductionPercent", range: false, min: 1, max: 5, step: 1 },
  { key: "critChancePercent", range: false, min: 1, max: 6, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 10, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 2, max: 10, step: 2 },
];

/** Stone empowerments: one roll per stat key, no duplicates on the same item. */
export const STONE_EMPOWER_ROLL_DEFS = [
  { key: "dc", range: true, index: 1, min: 1, max: 3 },
  { key: "sc", range: true, index: 1, min: 1, max: 3 },
  { key: "mc", range: true, index: 1, min: 1, max: 3 },
  { key: "ac", range: true, index: 1, min: 1, max: 2 },
  { key: "amc", range: true, index: 1, min: 1, max: 2 },
  { key: "goldBonusPercent", range: false, min: 5, max: 30, step: 5 },
  { key: "xpBonusPercent", range: false, min: 5, max: 30, step: 5 },
  { key: "dropChanceBonusPercent", range: false, min: 0.25, max: 0.5, step: 0.25 },
  { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 15, step: 5 },
  { key: "damageTakenReductionPercent", range: false, min: 1, max: 2, step: 1 },
  { key: "critChancePercent", range: false, min: 1, max: 14, step: 1 },
  { key: "critDamagePercent", range: false, min: 5, max: 20, step: 5 },
  { key: "skillLevelBonusPercent", range: false, min: 5, max: 30, step: 5 },
];

/** Crit-eligible damage spells/skills per class (used for per-spell crit empowers). */
export const WIZARD_CRIT_SPELL_IDS = [
  "FlameDisruptor", "FireWall", "ThunderBolt", "IceStorm", "FlameField",
  "MeteorStrike", "Blizzard", "FireBall", "GreatFireBall", "FrostCrunch",
];
export const WARRIOR_CRIT_SPELL_IDS = [
  "Slaying", "FlamingSword", "TwinDrakeBlade", "BladeAvalanche", "SlashingBurst",
];
export const TAO_CRIT_SPELL_IDS = ["SoulFireBall"];
/** Every spell/skill that can carry a per-spell crit empower (class-agnostic gear). */
export const ALL_CRIT_SPELL_IDS = [
  ...WARRIOR_CRIT_SPELL_IDS, ...WIZARD_CRIT_SPELL_IDS, ...TAO_CRIT_SPELL_IDS,
];

/**
 * Per-spell crit roll ranges by slot tier. Weapons roll the highest; armour and
 * jewellery roll lower, mirroring how flat empowers taper off the weapon.
 */
export const SPELL_CRIT_RANGES = {
  weapon: { chance: { min: 5, max: 25, step: 5 }, damage: { min: 10, max: 50, step: 10 } },
  armour: { chance: { min: 2, max: 12, step: 2 }, damage: { min: 5, max: 25, step: 5 } },
  accessory: { chance: { min: 1, max: 8, step: 1 }, damage: { min: 5, max: 15, step: 5 } },
};

/** @deprecated use SPELL_CRIT_RANGES.weapon.chance */
export const SPELL_CRIT_CHANCE_ROLL = SPELL_CRIT_RANGES.weapon.chance;
/** @deprecated use SPELL_CRIT_RANGES.weapon.damage */
export const SPELL_CRIT_DAMAGE_ROLL = SPELL_CRIT_RANGES.weapon.damage;

/**
 * Build crit-chance + crit-damage empower roll defs for a set of damage spells/skills.
 * Labels resolve from SPELL_EMPOWER_LABELS at render time; the `label` field is a fallback.
 * @param {string[]} spellIds
 * @param {{ chance: { min: number, max: number, step: number }, damage: { min: number, max: number, step: number } }} [ranges]
 */
function spellCritEmpowerRollDefs(spellIds, ranges = SPELL_CRIT_RANGES.weapon) {
  const chance = ranges?.chance ?? SPELL_CRIT_RANGES.weapon.chance;
  const damage = ranges?.damage ?? SPELL_CRIT_RANGES.weapon.damage;
  const defs = [];
  for (const spellId of spellIds) {
    defs.push({
      key: `spell:${spellId}:critChance`,
      spellId,
      kind: "critChancePercent",
      min: chance.min,
      max: chance.max,
      step: chance.step,
      label: spellId,
    });
    defs.push({
      key: `spell:${spellId}:critDamage`,
      spellId,
      kind: "critDamagePercent",
      min: damage.min,
      max: damage.max,
      step: damage.step,
      label: spellId,
    });
  }
  return defs;
}

/** Crit-eligible spell ids for an item's empower class (global gear offers all). */
function critSpellIdsForItemClass(cls) {
  if (cls === "warrior") return WARRIOR_CRIT_SPELL_IDS;
  if (cls === "wizard") return WIZARD_CRIT_SPELL_IDS;
  if (cls === "tao") return TAO_CRIT_SPELL_IDS;
  return ALL_CRIT_SPELL_IDS;
}

/**
 * Reduced-range factors for non-crit spell empowers (damage/mana/heal/pet/cooldown)
 * on non-weapon gear, mirroring how per-spell crit tapers off the weapon.
 * Weapons use the full ranges (factor 1, handled by their own tables).
 */
const SPELL_EMPOWER_TIER_FACTOR = { armour: 0.5, accessory: 0.35 };

/** True for the two crit kinds (handled separately with their own tiered ranges). */
function isCritSpellKind(kind) {
  return kind === "critChancePercent" || kind === "critDamagePercent";
}

/** Non-crit weapon spell/skill empower defs for a class ("global" = all three). */
function classNonCritSpellDefs(cls) {
  const nonCrit = (defs) => defs.filter((def) => !isCritSpellKind(def.kind));
  if (cls === "warrior") return nonCrit(WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS);
  if (cls === "wizard") return nonCrit(MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS);
  if (cls === "tao") return nonCrit(SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS);
  return [
    ...nonCrit(WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS),
    ...nonCrit(MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS),
    ...nonCrit(SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS),
  ];
}

/** Scale a spell roll def's min/max by a tier factor, snapped to its own step (>=1 step). */
function scaleSpellRollDef(def, factor) {
  if (!(factor > 0) || factor >= 1) return { ...def };
  const step = Math.max(1, Number(def.step) || 1);
  const toStep = (value) => Math.max(step, Math.round((Number(value) * factor) / step) * step);
  const min = toStep(def.min);
  const max = Math.max(min, toStep(def.max));
  return { ...def, min, max };
}

/** Slot tier for non-weapon spell empowers; null for slots with no fixed table. */
function nonWeaponSpellTier(slot) {
  if (ARMOUR_EMPOWER_SLOTS.has(slot) || slot === "helmet") return "armour";
  if (
    slot === "bracelet" || slot === "ring" || slot === "necklace"
    || BELT_BOOT_EMPOWER_SLOTS.has(slot) || slot === "stone"
  ) {
    return "accessory";
  }
  return null;
}

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
    key: "spell:FireBall:damage",
    spellId: "FireBall",
    kind: "damagePercent",
    min: 10,
    max: 35,
    step: 5,
    label: "Fire Ball",
  },
  {
    key: "spell:GreatFireBall:damage",
    spellId: "GreatFireBall",
    kind: "damagePercent",
    min: 10,
    max: 35,
    step: 5,
    label: "Great Fire Ball",
  },
  {
    key: "spell:FrostCrunch:damage",
    spellId: "FrostCrunch",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Frost Crunch",
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
  {
    key: "spell:ThunderBolt:mana",
    spellId: "ThunderBolt",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Thunder Bolt",
  },
  {
    key: "spell:IceStorm:mana",
    spellId: "IceStorm",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Ice Storm",
  },
  {
    key: "spell:FlameField:mana",
    spellId: "FlameField",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Flame Field",
  },
  {
    key: "spell:MeteorStrike:mana",
    spellId: "MeteorStrike",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Meteor Strike",
  },
  {
    key: "spell:Blizzard:mana",
    spellId: "Blizzard",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Blizzard",
  },
  ...spellCritEmpowerRollDefs(WIZARD_CRIT_SPELL_IDS),
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
  {
    key: "skill:TwinDrakeBlade:mana",
    spellId: "TwinDrakeBlade",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Twin Drake Blade",
  },
  {
    key: "skill:BladeAvalanche:damage",
    spellId: "BladeAvalanche",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Blade Avalanche",
  },
  {
    key: "skill:BladeAvalanche:mana",
    spellId: "BladeAvalanche",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Blade Avalanche",
  },
  {
    key: "skill:SlashingBurst:damage",
    spellId: "SlashingBurst",
    kind: "damagePercent",
    min: 5,
    max: 25,
    step: 5,
    label: "Slashing Burst",
  },
  {
    key: "skill:SlashingBurst:mana",
    spellId: "SlashingBurst",
    kind: "manaCostPercent",
    min: 10,
    max: 40,
    step: 5,
    label: "Slashing Burst",
  },
  ...spellCritEmpowerRollDefs(WARRIOR_CRIT_SPELL_IDS),
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
    key: "spell:SummonSkeleton:petHealth",
    spellId: "SummonSkeleton",
    kind: "petHealthPercent",
    min: 10,
    max: 50,
    step: 5,
    label: "Skeleton",
  },
  {
    key: "spell:SummonSkeleton:petDamageReduction",
    spellId: "SummonSkeleton",
    kind: "petDamageReductionPercent",
    min: 5,
    max: 20,
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
  {
    key: "spell:SummonShinsu:petHealth",
    spellId: "SummonShinsu",
    kind: "petHealthPercent",
    min: 10,
    max: 50,
    step: 5,
    label: "Shinsu",
  },
  {
    key: "spell:SummonShinsu:petDamageReduction",
    spellId: "SummonShinsu",
    kind: "petDamageReductionPercent",
    min: 5,
    max: 20,
    step: 5,
    label: "Shinsu",
  },
  {
    key: "spell:SummonHolyDeva:damage",
    spellId: "SummonHolyDeva",
    kind: "damagePercent",
    min: 10,
    max: 50,
    step: 5,
    label: "Holy Deva",
  },
  {
    key: "spell:SummonHolyDeva:petHealth",
    spellId: "SummonHolyDeva",
    kind: "petHealthPercent",
    min: 10,
    max: 50,
    step: 5,
    label: "Holy Deva",
  },
  {
    key: "spell:SummonHolyDeva:petDamageReduction",
    spellId: "SummonHolyDeva",
    kind: "petDamageReductionPercent",
    min: 5,
    max: 20,
    step: 5,
    label: "Holy Deva",
  },
  ...spellCritEmpowerRollDefs(TAO_CRIT_SPELL_IDS),
];

const SPELL_EMPOWER_LABELS = {
  FireBall: "Fire Ball",
  GreatFireBall: "Great Fire Ball",
  FrostCrunch: "Frost Crunch",
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
  SummonHolyDeva: "Holy Deva",
  Slaying: "Slaying",
  FlamingSword: "Flaming Sword",
  TwinDrakeBlade: "Twin Drake Blade",
  BladeAvalanche: "Blade Avalanche",
  SlashingBurst: "Slashing Burst",
};

const RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];
const SCALAR_KEYS = [
  "hp", "mp", "accuracy", "agility", "luck", "attackSpeed",
  "poisonAttack", "freezing", "magicResist", "poisonResist",
  "healthRecovery", "poisonRecovery", "strong",
];

const EMPOWER_PERCENT_SCALAR_KEYS = [
  "xpBonusPercent",
  "goldBonusPercent",
  "bonusAwakeningSoulChancePercent",
  "critChancePercent",
  "critDamagePercent",
  "skillLevelBonusPercent",
  "dropChanceBonusPercent",
  "damageTakenReductionPercent",
];

const EMPOWER_SPELL_KINDS = [
  "damagePercent",
  "manaCostPercent",
  "healingPercent",
  "cooldownReductionSeconds",
  "petHealthPercent",
  "petDamageReductionPercent",
  "critChancePercent",
  "critDamagePercent",
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
  damageTakenReductionPercent: "Damage taken",
  critChancePercent: "Crit Rate",
  critDamagePercent: "Crit Damage",
  skillLevelBonusPercent: "Skill leveling",
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
  { id: "ring", label: "Ring / Necklace", slots: ["ring", "necklace"], rollDefs: RING_EMPOWER_ROLL_DEFS },
  { id: "belt_boots", label: "Belt / Boots", slots: ["belt", "boots"], rollDefs: BELT_BOOT_EMPOWER_ROLL_DEFS },
  { id: "stone", label: "Stone", slots: ["stone"], rollDefs: STONE_EMPOWER_ROLL_DEFS },
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

/** Class-agnostic empower keys — always drawn from the 30% BONUS pool, never base. */
export const GLOBAL_EMPOWER_KEYS = new Set([
  "xpBonusPercent",
  "goldBonusPercent",
  "dropChanceBonusPercent",
  "bonusAwakeningSoulChancePercent",
  "damageTakenReductionPercent",
  "critChancePercent",
  "critDamagePercent",
  "skillLevelBonusPercent",
]);

/** Each empowerment roll draws from the base pool with this probability, else the bonus pool. */
export const EMPOWER_BASE_POOL_WEIGHT = 0.7;

const PRIMARY_STAT_KEYS = new Set(["dc", "mc", "sc"]);

/** Primary damage stats a class may roll in its base pool (from natural DC/MC/SC). */
const CLASS_PRIMARY_STATS = {
  warrior: new Set(["dc"]),
  tao: new Set(["dc", "sc"]),
  wizard: new Set(["mc"]),
  global: new Set(["dc", "mc", "sc"]),
};

/**
 * Class label for base-stat eligibility, from natural DC/MC/SC (gems/smith/empower ignored).
 * MC-only -> wizard, SC-only -> tao, DC-only -> warrior, all/none/hybrid -> global.
 * @param {object | null | undefined} item
 * @returns {"warrior" | "wizard" | "tao" | "global"}
 */
export function empowerItemClass(item) {
  const hasMc = itemHasNaturalMc(item);
  const hasSc = itemHasNaturalSc(item);
  const hasDc = itemHasNaturalDc(item);
  if (hasMc && hasSc) return "global";
  if (hasMc) return "wizard";
  if (hasSc) return "tao";
  if (hasDc) return "warrior";
  return "global";
}

/** Per-slot base roll table, or null for legacy/dynamic slots (necklace, unknown). */
function slotBaseRollDefs(item) {
  if (item?.slot === "weapon") return filterWeaponEmpowerRollDefs(item);
  if (ARMOUR_EMPOWER_SLOTS.has(item?.slot)) return ARMOUR_EMPOWER_ROLL_DEFS;
  if (item?.slot === "helmet") return HELMET_EMPOWER_ROLL_DEFS;
  if (item?.slot === "bracelet") return BRACELET_EMPOWER_ROLL_DEFS;
  // Necklaces share the Ring table (same tier).
  if (item?.slot === "ring" || item?.slot === "necklace") return RING_EMPOWER_ROLL_DEFS;
  if (BELT_BOOT_EMPOWER_SLOTS.has(item?.slot)) return BELT_BOOT_EMPOWER_ROLL_DEFS;
  if (item?.slot === "stone") return STONE_EMPOWER_ROLL_DEFS;
  return null;
}

/**
 * Base (70%) pool: slot flat stats, class-gated on primary DC/MC/SC, globals removed.
 * Returns null for legacy/dynamic slots so callers fall back to the stat-scan path.
 * @param {object | null | undefined} item
 */
export function empowerBasePool(item) {
  const defs = slotBaseRollDefs(item);
  if (!defs) return null;
  const allowedPrimary = item?.slot === "weapon"
    ? null // weapon primaries already gated by filterWeaponEmpowerRollDefs
    : (CLASS_PRIMARY_STATS[empowerItemClass(item)] ?? CLASS_PRIMARY_STATS.global);
  return defs
    .filter((def) => !GLOBAL_EMPOWER_KEYS.has(def.key))
    .filter((def) => {
      if (!allowedPrimary) return true;
      if (!PRIMARY_STAT_KEYS.has(def.key)) return true;
      return allowedPrimary.has(def.key);
    })
    .map((def) => ({ ...def }));
}

/** Spell/skill empower rolls available on an item (currently weapons only). */
function itemSpellEmpowerRollDefs(item) {
  const rolls = [];
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
 * Full class spell/skill empowers on non-weapon gear (armour + jewellery), at
 * reduced ranges vs weapons: the non-crit spell empowers (damage/mana/heal/pet/
 * cooldown) scaled by the slot tier, plus per-spell crit at the tier's crit
 * ranges. Class-flavoured gear (natural MC/SC/DC) only offers its class's spells;
 * neutral gear offers all. Weapons roll spell empowers via itemSpellEmpowerRollDefs
 * at full ranges instead, so this returns [] for weapons.
 * @param {object | null | undefined} item
 */
function itemNonWeaponSpellEmpowerRollDefs(item) {
  const slot = item?.slot;
  if (!slot || slot === "weapon") return [];
  const tier = nonWeaponSpellTier(slot);
  if (!tier) return []; // torch, amulet, mount, unknown — no fixed table
  const cls = empowerItemClass(item);
  const factor = SPELL_EMPOWER_TIER_FACTOR[tier];
  const baseDefs = classNonCritSpellDefs(cls).map((def) => scaleSpellRollDef(def, factor));
  const critDefs = spellCritEmpowerRollDefs(critSpellIdsForItemClass(cls), SPELL_CRIT_RANGES[tier]);
  return [...baseDefs, ...critDefs];
}

/** Global empower rolls for an item, using each slot's own tuned ranges. */
function itemGlobalRollDefs(item) {
  const defs = item?.slot === "weapon" ? WEAPON_EMPOWER_ROLL_DEFS : slotBaseRollDefs(item);
  if (!defs) return [];
  return defs.filter((def) => GLOBAL_EMPOWER_KEYS.has(def.key)).map((def) => ({ ...def }));
}

/**
 * Bonus (30%) pool: class spell/skill empowers plus global empowers.
 * @param {object | null | undefined} item
 */
export function empowerBonusPool(item) {
  return [
    ...itemSpellEmpowerRollDefs(item),
    ...itemNonWeaponSpellEmpowerRollDefs(item),
    ...itemGlobalRollDefs(item),
  ];
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
    const petHealthPercent = Math.trunc(Number(row.petHealthPercent) || 0);
    if (petHealthPercent !== 0) entry.petHealthPercent = petHealthPercent;
    const petDamageReductionPercent = Math.trunc(Number(row.petDamageReductionPercent) || 0);
    if (petDamageReductionPercent !== 0) entry.petDamageReductionPercent = petDamageReductionPercent;
    const critChancePercent = Math.trunc(Number(row.critChancePercent) || 0);
    if (critChancePercent !== 0) entry.critChancePercent = critChancePercent;
    const critDamagePercent = Math.trunc(Number(row.critDamagePercent) || 0);
    if (critDamagePercent !== 0) entry.critDamagePercent = critDamagePercent;
    if (Object.keys(entry).length) sanitized[spellId] = entry;
  }
  return sanitized;
}

/**
 * @param {object | null | undefined} item
 * @returns {{ key: string, range: boolean, index?: number, min?: number, max?: number }[]}
 */
export function empowerCandidateRolls(item) {
  const base = empowerBasePool(item);
  if (base !== null) {
    return [...base, ...empowerBonusPool(item)];
  }
  return legacyDynamicCandidateRolls(item);
}

/**
 * Legacy dynamic candidate list for slots without a fixed table (e.g. necklace).
 * @param {object | null | undefined} item
 */
function legacyDynamicCandidateRolls(item) {
  const stats = item?.stats ?? {};
  const candidates = [];
  const seen = new Set();
  // One empowerment per distinct stat key. Range stats always empower the max
  // endpoint (index 1), matching every fixed slot table. Emitting a separate
  // candidate for each range endpoint (as before) let a single-stat item like a
  // mono-MC necklace draw two rolls that both landed on the same stat — the item
  // then showed two ★ but only one empowered stat.
  for (const key of RANGE_KEYS) {
    const range = stats[key];
    if (!Array.isArray(range)) continue;
    const hasValue = (Number(range[0]) || 0) !== 0 || (Number(range[1]) || 0) !== 0;
    if (hasValue && !seen.has(key)) {
      seen.add(key);
      candidates.push({ key, range: true, index: 1 });
    }
  }
  for (const key of SCALAR_KEYS) {
    if (readItemScalarStat(stats, key) !== 0 && !seen.has(key)) {
      seen.add(key);
      candidates.push({ key, range: false });
    }
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
  if (roll.spellId && roll.kind === "petHealthPercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Increase ${label} health by ${min}%`;
    return `Increase ${label} health by ${min}–${max}%`;
  }
  if (roll.spellId && roll.kind === "petDamageReductionPercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Reduce ${label} damage taken by ${min}%`;
    return `Reduce ${label} damage taken by ${min}–${max}%`;
  }
  if (roll.spellId && roll.kind === "critChancePercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Increase ${label} crit chance by ${min}%`;
    return `Increase ${label} crit chance by ${min}–${max}%`;
  }
  if (roll.spellId && roll.kind === "critDamagePercent") {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.label ?? roll.spellId;
    const min = Math.trunc(Number(roll.min) || 1);
    const max = Math.trunc(Number(roll.max) || min);
    if (min === max) return `Increase ${label} crit damage by ${min}%`;
    return `Increase ${label} crit damage by ${min}–${max}%`;
  }
  const stat = STAT_LABELS[roll.key] ?? roll.key;
  const min = roll.min != null ? Math.trunc(Number(roll.min) || 0) : null;
  const max = roll.max != null ? Math.trunc(Number(roll.max) || 0) : null;
  const step = roll.step != null ? Math.max(1, Math.trunc(Number(roll.step) || 1)) : 0;
  const suffix = roll.range && roll.index === 0 ? " (min)" : "";
  if (roll.key === "damageTakenReductionPercent") {
    if (min != null && max != null && min !== max) return `−${min}–${max}% ${stat}`;
    if (min != null) return `−${min}% ${stat}`;
    return `−${stat}`;
  }
  if (roll.key === "xpBonusPercent" || roll.key === "goldBonusPercent" || roll.key === "bonusAwakeningSoulChancePercent"
    || roll.key === "critChancePercent" || roll.key === "critDamagePercent" || roll.key === "skillLevelBonusPercent") {
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
      "Tao and Universal weapons roll SC empower; SC weapons also roll tao spell healing, damage, and pet damage / health / damage-taken empowers.",
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
  } else if (roll.kind === "petHealthPercent") {
    empowerSpellBonuses[spellId].petHealthPercent = (empowerSpellBonuses[spellId].petHealthPercent || 0) + amount;
  } else if (roll.kind === "petDamageReductionPercent") {
    empowerSpellBonuses[spellId].petDamageReductionPercent = (empowerSpellBonuses[spellId].petDamageReductionPercent || 0) + amount;
  } else if (roll.kind === "critChancePercent") {
    empowerSpellBonuses[spellId].critChancePercent = (empowerSpellBonuses[spellId].critChancePercent || 0) + amount;
  } else if (roll.kind === "critDamagePercent") {
    empowerSpellBonuses[spellId].critDamagePercent = (empowerSpellBonuses[spellId].critDamagePercent || 0) + amount;
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
 * Total per-spell crit-chance bonus (%) from equipped items for a given spell/skill.
 * Stacks on top of the character's global crit chance for that spell only.
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedSpellCritChanceBonusPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.critChancePercent) || 0;
  }
  return total;
}

/**
 * Total per-spell crit-damage bonus (%) from equipped items for a given spell/skill.
 * Stacks on top of the character's global crit damage for that spell only.
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedSpellCritDamageBonusPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.critDamagePercent) || 0;
  }
  return total;
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

/** Hard cap on stacked pet damage-taken reduction so pets are never fully immune. */
export const PET_DAMAGE_REDUCTION_CAP_PERCENT = 75;

/**
 * Total pet health bonus (%) from equipped items for a given summon spell (Tao pets).
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedPetHealthBonusPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.petHealthPercent) || 0;
  }
  return total;
}

/**
 * Total pet damage-taken reduction (%) from equipped items for a given summon spell (Tao pets).
 * Capped so a pet cannot become fully immune.
 * @param {string | null | undefined} spellId
 * @param {object | null | undefined} inventory
 */
export function equippedPetDamageReductionPercent(spellId, inventory) {
  const id = String(spellId ?? "");
  if (!id) return 0;
  const equippedIds = new Set(Object.values(inventory?.equipment ?? {}).filter(Boolean));
  let total = 0;
  for (const entry of inventory?.items ?? []) {
    if (!equippedIds.has(entry.id)) continue;
    const bonus = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    total += Number(bonus[id]?.petDamageReductionPercent) || 0;
  }
  return Math.max(0, Math.min(PET_DAMAGE_REDUCTION_CAP_PERCENT, total));
}

/**
 * Apply equipped pet health empower to a base max-HP value (Tao pets).
 * @param {string | null | undefined} spellId
 * @param {number} baseMaxHp
 * @param {object | null | undefined} inventory
 */
export function applyEquippedPetHealthBonus(spellId, baseMaxHp, inventory) {
  const base = Math.max(0, Math.trunc(Number(baseMaxHp) || 0));
  const bonusPercent = equippedPetHealthBonusPercent(spellId, inventory);
  if (bonusPercent <= 0) return base;
  return Math.trunc(base * (1 + bonusPercent / 100));
}

/**
 * Apply equipped pet damage reduction to an incoming damage value (Tao pets).
 * @param {string | null | undefined} spellId
 * @param {number} damage
 * @param {object | null | undefined} inventory
 */
export function applyEquippedPetDamageReduction(spellId, damage, inventory) {
  const base = Math.max(0, Number(damage) || 0);
  const reductionPercent = equippedPetDamageReductionPercent(spellId, inventory);
  if (reductionPercent <= 0) return base;
  return Math.max(0, base * (1 - reductionPercent / 100));
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
  const base = empowerBasePool(item);
  const basePool = base === null ? empowerCandidateRolls(item) : base;
  const bonusPool = base === null ? [] : empowerBonusPool(item);
  const empowerBonusStats = sanitizeItemBonusStats({});
  const empowerSpellBonuses = sanitizeEmpowerSpellBonuses({});
  const level = itemEmpowerLevel(item);

  const totalAvailable = basePool.length + bonusPool.length;
  const empowerTier = Math.min(requestedTier, totalAvailable);
  let applied = 0;
  for (let i = 0; i < empowerTier; i += 1) {
    const roll = pickWeightedEmpowerRoll(basePool, bonusPool, rng);
    if (!roll) break;
    if (roll.spellId && roll.kind) {
      applyEmpowerSpellRoll(empowerSpellBonuses, roll, rng);
    } else {
      applyEmpowerRollToStats(empowerBonusStats, roll, level, rng);
    }
    applied += 1;
  }

  return { empowered: true, empowerTier: applied, empowerBonusStats, empowerSpellBonuses };
}

/**
 * Draws one empower roll: base pool at EMPOWER_BASE_POOL_WEIGHT, else bonus pool.
 * Falls back to whichever pool still has entries. Removes the drawn roll in place
 * so no stat/spell key repeats on the same item.
 * @param {object[]} basePool
 * @param {object[]} bonusPool
 * @param {() => number} rng
 */
export function pickWeightedEmpowerRoll(basePool, bonusPool, rng = Math.random) {
  const hasBase = basePool.length > 0;
  const hasBonus = bonusPool.length > 0;
  if (!hasBase && !hasBonus) return null;
  let useBase;
  if (!hasBase) useBase = false;
  else if (!hasBonus) useBase = true;
  else useBase = rng() < EMPOWER_BASE_POOL_WEIGHT;
  const pool = useBase ? basePool : bonusPool;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool.splice(index, 1)[0];
}

/**
 * @param {{ type: "stat", key: string, range?: boolean, index?: number } | { type: "spell", spellId: string, kind: string }} slot
 */
function empowerSlotIdentity(slot) {
  if (slot.type === "spell") return `spell:${slot.spellId}:${slot.kind}`;
  if (slot.range) return `stat:${slot.key}:${slot.index ?? 1}`;
  return `stat:${slot.key}`;
}

/**
 * @param {{ key?: string, range?: boolean, index?: number, spellId?: string, kind?: string }} roll
 */
function empowerRollDefIdentity(roll) {
  if (roll.spellId && roll.kind) return `spell:${roll.spellId}:${roll.kind}`;
  if (roll.range) return `stat:${roll.key}:${roll.index ?? 1}`;
  return `stat:${roll.key}`;
}

/**
 * @param {object | null | undefined} entry
 * @returns {({ type: "stat", key: string, range: boolean, index?: number } | { type: "spell", spellId: string, kind: string })[]}
 */
export function listEmpowerSlotsFromEntry(entry) {
  const slots = [];
  const bonus = sanitizeItemBonusStats(entry?.empowerBonusStats);
  for (const key of RANGE_KEYS) {
    const range = bonus[key];
    if ((range[0] || 0) !== 0) slots.push({ type: "stat", key, range: true, index: 0 });
    if ((range[1] || 0) !== 0) slots.push({ type: "stat", key, range: true, index: 1 });
  }
  for (const key of SCALAR_KEYS) {
    if ((bonus[key] || 0) !== 0) slots.push({ type: "stat", key, range: false });
  }
  for (const key of EMPOWER_PERCENT_SCALAR_KEYS) {
    if ((bonus[key] || 0) !== 0) slots.push({ type: "stat", key, range: false });
  }
  const spells = sanitizeEmpowerSpellBonuses(entry?.empowerSpellBonuses);
  for (const [spellId, row] of Object.entries(spells)) {
    for (const kind of EMPOWER_SPELL_KINDS) {
      if ((row[kind] || 0) !== 0) slots.push({ type: "spell", spellId, kind });
    }
  }
  return slots;
}

/**
 * @param {object} entry
 * @param {{ type: "stat", key: string, range?: boolean, index?: number } | { type: "spell", spellId: string, kind: string }} slot
 */
function captureEmpowerSlotAmount(entry, slot) {
  if (slot.type === "spell") {
    return Math.trunc(Number(entry.empowerSpellBonuses?.[slot.spellId]?.[slot.kind]) || 0);
  }
  const bonus = sanitizeItemBonusStats(entry.empowerBonusStats);
  if (slot.range) return Math.trunc(Number(bonus[slot.key]?.[slot.index ?? 1]) || 0);
  return Math.trunc(Number(bonus[slot.key]) || 0);
}

/**
 * @param {object} entry
 * @param {{ type: "stat", key: string, range?: boolean, index?: number } | { type: "spell", spellId: string, kind: string }} slot
 * @param {number} amount
 */
function restoreEmpowerSlotAmount(entry, slot, amount) {
  const value = Math.trunc(Number(amount) || 0);
  if (value <= 0) return;
  entry.empowerBonusStats = sanitizeItemBonusStats(entry.empowerBonusStats ?? {});
  entry.empowerSpellBonuses = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses ?? {});
  if (slot.type === "spell") {
    if (!entry.empowerSpellBonuses[slot.spellId]) entry.empowerSpellBonuses[slot.spellId] = {};
    entry.empowerSpellBonuses[slot.spellId][slot.kind] = value;
    entry.empowerSpellBonuses = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);
    return;
  }
  if (slot.range) entry.empowerBonusStats[slot.key][slot.index ?? 1] = value;
  else entry.empowerBonusStats[slot.key] = value;
}

/**
 * @param {object} entry
 * @param {{ type: "stat", key: string, range?: boolean, index?: number } | { type: "spell", spellId: string, kind: string }} slot
 */
function removeEmpowerSlotFromEntry(entry, slot) {
  entry.empowerBonusStats = sanitizeItemBonusStats(entry.empowerBonusStats ?? {});
  entry.empowerSpellBonuses = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses ?? {});
  if (slot.type === "spell") {
    const row = entry.empowerSpellBonuses[slot.spellId];
    if (!row) return;
    row[slot.kind] = 0;
    const cleaned = sanitizeEmpowerSpellBonuses({ [slot.spellId]: row });
    if (cleaned[slot.spellId]) entry.empowerSpellBonuses[slot.spellId] = cleaned[slot.spellId];
    else delete entry.empowerSpellBonuses[slot.spellId];
    return;
  }
  if (slot.range) entry.empowerBonusStats[slot.key][slot.index ?? 1] = 0;
  else entry.empowerBonusStats[slot.key] = 0;
}

/**
 * @param {object | null | undefined} item
 * @param {object} entry
 */
function empowerRerollPools(item, entry) {
  const existing = new Set(listEmpowerSlotsFromEntry(entry).map(empowerSlotIdentity));
  const filterPool = (pool) => pool.filter((roll) => !existing.has(empowerRollDefIdentity(roll)));
  const base = empowerBasePool(item);
  if (base === null) {
    return { basePool: filterPool(empowerCandidateRolls(item).map((def) => ({ ...def }))), bonusPool: [] };
  }
  return {
    basePool: filterPool(base.map((def) => ({ ...def }))),
    bonusPool: filterPool(empowerBonusPool(item).map((def) => ({ ...def }))),
  };
}

/**
 * @param {object | null | undefined} item
 * @param {{ type: "stat", key: string, range?: boolean, index?: number } | { type: "spell", spellId: string, kind: string }} slot
 */
function empowerSlotRollDef(item, slot) {
  const identity = empowerSlotIdentity(slot);
  return empowerCandidateRolls(item).find((roll) => empowerRollDefIdentity(roll) === identity)
    ?? (slot.type === "spell"
      ? { spellId: slot.spellId, kind: slot.kind }
      : { key: slot.key, range: Boolean(slot.range), index: slot.index });
}

/**
 * Reroll one empowerment on an empowered item at a chosen slot index.
 * @param {object} entry Inventory entry (mutated in place).
 * @param {object | null | undefined} item Item definition for the entry.
 * @param {number} slotIndex Zero-based index into {@link listEmpowerSlotsFromEntry}.
 * @param {() => number} [rng]
 */
export function rollEmpowermentRerollAtSlot(entry, item, slotIndex, rng = Math.random) {
  if (!entry || !item || !itemCanBeEmpowered(item)) {
    return { ok: false, error: "Invalid empowered item." };
  }
  const tier = Math.max(0, Math.trunc(Number(entry.empowerTier) || 0));
  if (!entry.empowered || tier < 1) {
    return { ok: false, error: "Item is not empowered." };
  }

  const slots = listEmpowerSlotsFromEntry(entry);
  if (!slots.length) {
    return { ok: false, error: "Item has no empowerments to reroll." };
  }

  const pick = Math.trunc(Number(slotIndex) || 0);
  if (pick < 0 || pick >= slots.length) {
    return { ok: false, error: "Select an empowerment to reroll." };
  }

  const removedSlot = slots[pick];
  const removedRoll = empowerSlotRollDef(item, removedSlot);
  const removedAmount = captureEmpowerSlotAmount(entry, removedSlot);
  removeEmpowerSlotFromEntry(entry, removedSlot);

  const { basePool, bonusPool } = empowerRerollPools(item, entry);
  const newRoll = pickWeightedEmpowerRoll(basePool, bonusPool, rng);
  if (!newRoll) {
    restoreEmpowerSlotAmount(entry, removedSlot, removedAmount);
    return { ok: false, error: "No alternative empowerments available." };
  }

  const level = itemEmpowerLevel(item);
  let appliedAmount = 0;
  if (newRoll.spellId && newRoll.kind) {
    entry.empowerSpellBonuses = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses ?? {});
    appliedAmount = applyEmpowerSpellRoll(entry.empowerSpellBonuses, newRoll, rng);
  } else {
    entry.empowerBonusStats = sanitizeItemBonusStats(entry.empowerBonusStats ?? {});
    appliedAmount = applyEmpowerRollToStats(entry.empowerBonusStats, newRoll, level, rng);
  }
  entry.empowered = true;
  entry.empowerTier = tier;

  return {
    ok: true,
    removedSlot,
    removedRoll,
    removedAmount,
    newRoll,
    appliedAmount,
  };
}

/**
 * Labels for each active empowerment on an entry (for targeted reroll UI).
 * @param {object | null | undefined} entry
 * @param {object | null | undefined} item
 * @returns {{ index: number, label: string }[]}
 */
export function empowerSlotChoiceLabels(entry, item) {
  if (!entry || !item) return [];
  return listEmpowerSlotsFromEntry(entry).map((slot, index) => {
    const roll = empowerSlotRollDef(item, slot);
    const amount = captureEmpowerSlotAmount(entry, slot);
    return { index, label: formatEmpowerAppliedChangeLabel(roll, amount) };
  });
}

/**
 * Reroll one random empowerment on an empowered item using normal empower drop pools.
 * @param {object} entry Inventory entry (mutated in place).
 * @param {object | null | undefined} item Item definition for the entry.
 * @param {() => number} [rng]
 */
export function rollEmpowermentReroll(entry, item, rng = Math.random) {
  const slots = listEmpowerSlotsFromEntry(entry);
  if (!slots.length) {
    if (!entry?.empowered || Math.max(0, Math.trunc(Number(entry?.empowerTier) || 0)) < 1) {
      return { ok: false, error: "Item is not empowered." };
    }
    return { ok: false, error: "Item has no empowerments to reroll." };
  }
  const slotIndex = Math.min(slots.length - 1, Math.floor(rng() * slots.length));
  return rollEmpowermentRerollAtSlot(entry, item, slotIndex, rng);
}

/**
 * Swap chosen empowerments between two empowered items.
 * @param {object} entryA
 * @param {object | null | undefined} itemA
 * @param {number} slotIndexA
 * @param {object} entryB
 * @param {object | null | undefined} itemB
 * @param {number} slotIndexB
 */
export function swapEmpowermentsAtSlotIndices(entryA, itemA, slotIndexA, entryB, itemB, slotIndexB) {
  if (!entryA || !itemA || !itemB || !entryB || !itemCanBeEmpowered(itemA) || !itemCanBeEmpowered(itemB)) {
    return { ok: false, error: "Invalid empowered items." };
  }
  const tierA = Math.max(0, Math.trunc(Number(entryA.empowerTier) || 0));
  const tierB = Math.max(0, Math.trunc(Number(entryB.empowerTier) || 0));
  if (!entryA.empowered || !entryB.empowered || tierA < 1 || tierB < 1) {
    return { ok: false, error: "Both items must be empowered." };
  }

  const slotsA = listEmpowerSlotsFromEntry(entryA);
  const slotsB = listEmpowerSlotsFromEntry(entryB);
  const pickA = Math.trunc(Number(slotIndexA) || 0);
  const pickB = Math.trunc(Number(slotIndexB) || 0);
  if (pickA < 0 || pickA >= slotsA.length || pickB < 0 || pickB >= slotsB.length) {
    return { ok: false, error: "Select an empowerment on each item to swap." };
  }

  const slotA = slotsA[pickA];
  const slotB = slotsB[pickB];
  const amountA = captureEmpowerSlotAmount(entryA, slotA);
  const amountB = captureEmpowerSlotAmount(entryB, slotB);
  const rollA = empowerSlotRollDef(itemA, slotA);
  const rollB = empowerSlotRollDef(itemB, slotB);

  removeEmpowerSlotFromEntry(entryA, slotA);
  removeEmpowerSlotFromEntry(entryB, slotB);
  restoreEmpowerSlotAmount(entryA, slotB, amountB);
  restoreEmpowerSlotAmount(entryB, slotA, amountA);
  entryA.empowered = true;
  entryA.empowerTier = tierA;
  entryB.empowered = true;
  entryB.empowerTier = tierB;

  return {
    ok: true,
    entryA,
    itemA,
    entryB,
    itemB,
    slotA,
    slotB,
    amountA,
    amountB,
    rollA,
    rollB,
  };
}

/**
 * Swap one random empowerment between two empowered items.
 * @param {object} entryA First inventory entry (mutated in place).
 * @param {object | null | undefined} itemA Item definition for entry A.
 * @param {object} entryB Second inventory entry (mutated in place).
 * @param {object | null | undefined} itemB Item definition for entry B.
 * @param {() => number} [rng]
 */
export function swapRandomEmpowermentsBetweenEntries(entryA, itemA, entryB, itemB, rng = Math.random) {
  const slotsA = listEmpowerSlotsFromEntry(entryA);
  const slotsB = listEmpowerSlotsFromEntry(entryB);
  if (!slotsA.length || !slotsB.length) {
    if (!entryA?.empowered || !entryB?.empowered) {
      return { ok: false, error: "Both items must be empowered." };
    }
    return { ok: false, error: "Both items need at least one empowerment to swap." };
  }
  const indexA = Math.min(slotsA.length - 1, Math.floor(rng() * slotsA.length));
  const indexB = Math.min(slotsB.length - 1, Math.floor(rng() * slotsB.length));
  return swapEmpowermentsAtSlotIndices(entryA, itemA, indexA, entryB, itemB, indexB);
}

/**
 * Human-readable label for one applied empowerment change (actual rolled value).
 * @param {{ key?: string, range?: boolean, index?: number, spellId?: string, kind?: string }} roll
 * @param {number} amount
 */
export function formatEmpowerAppliedChangeLabel(roll, amount) {
  const value = Math.trunc(Number(amount) || 0);
  if (!roll) return "";
  if (value <= 0) return formatEmpowerRollDescription(roll);

  if (roll.spellId && roll.kind) {
    const label = SPELL_EMPOWER_LABELS[roll.spellId] ?? roll.spellId;
    if (roll.kind === "damagePercent") return `+${value}% ${label} damage`;
    if (roll.kind === "manaCostPercent") return `−${value}% ${label} mana cost`;
    if (roll.kind === "healingPercent") return `+${value}% ${label} healing`;
    if (roll.kind === "cooldownReductionSeconds") {
      return `−${value}s ${label} cooldown`;
    }
    if (roll.kind === "petHealthPercent") return `+${value}% ${label} health`;
    if (roll.kind === "petDamageReductionPercent") return `−${value}% ${label} damage taken`;
    if (roll.kind === "critChancePercent") return `+${value}% ${label} crit chance`;
    if (roll.kind === "critDamagePercent") return `+${value}% ${label} crit damage`;
    return formatEmpowerRollDescription(roll);
  }

  const stat = STAT_LABELS[roll.key] ?? roll.key;
  if (roll.key === "damageTakenReductionPercent") return `−${value}% ${stat}`;
  if (roll.key === "dropChanceBonusPercent") {
    const formatted = Number.isInteger(value) ? `${value}%` : `${Number(value.toFixed(2))}%`;
    return `+${formatted} ${stat}`;
  }
  if (roll.key === "xpBonusPercent" || roll.key === "goldBonusPercent" || roll.key === "bonusAwakeningSoulChancePercent"
    || roll.key === "critChancePercent" || roll.key === "critDamagePercent" || roll.key === "skillLevelBonusPercent") {
    return `+${value}% ${stat}`;
  }
  return `+${value} ${stat}`;
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
  for (const key of ["xpBonusPercent", "goldBonusPercent", "bonusAwakeningSoulChancePercent", "critChancePercent", "critDamagePercent", "skillLevelBonusPercent"]) {
    const value = bonus[key] || 0;
    if (value !== 0) lines.push(`+${value}% ${STAT_LABELS[key]}`);
  }
  const dropBonus = bonus.dropChanceBonusPercent || 0;
  if (dropBonus !== 0) {
    const formatted = Number.isInteger(dropBonus) ? `${dropBonus}%` : `${Number(dropBonus.toFixed(2))}%`;
    lines.push(`+${formatted} ${STAT_LABELS.dropChanceBonusPercent}`);
  }
  const damageTakenReduction = bonus.damageTakenReductionPercent || 0;
  if (damageTakenReduction !== 0) {
    lines.push(`−${damageTakenReduction}% ${STAT_LABELS.damageTakenReductionPercent}`);
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
    if ((row.petHealthPercent || 0) !== 0) lines.push(`+${row.petHealthPercent}% ${label} health`);
    if ((row.petDamageReductionPercent || 0) !== 0) lines.push(`−${row.petDamageReductionPercent}% ${label} damage taken`);
    if ((row.critChancePercent || 0) !== 0) lines.push(`+${row.critChancePercent}% ${label} crit chance`);
    if ((row.critDamagePercent || 0) !== 0) lines.push(`+${row.critDamagePercent}% ${label} crit damage`);
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
    if ((row.petHealthPercent || 0) !== 0) {
      rows.push({ label, value: `+${row.petHealthPercent}% health` });
    }
    if ((row.petDamageReductionPercent || 0) !== 0) {
      rows.push({ label, value: `−${row.petDamageReductionPercent}% damage taken` });
    }
    if ((row.critChancePercent || 0) !== 0) {
      rows.push({ label, value: `+${row.critChancePercent}% crit chance` });
    }
    if ((row.critDamagePercent || 0) !== 0) {
      rows.push({ label, value: `+${row.critDamagePercent}% crit damage` });
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
