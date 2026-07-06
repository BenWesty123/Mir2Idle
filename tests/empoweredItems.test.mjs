import test from "node:test";
import assert from "node:assert/strict";
import {
  ARMOUR_EMPOWER_ROLL_DEFS,
  BELT_BOOT_EMPOWER_ROLL_DEFS,
  BOSS_EMPOWER_ITEM_CHANCE,
  BRACELET_EMPOWER_ROLL_DEFS,
  EMPOWER_TIER_WEIGHTS,
  HELMET_EMPOWER_ROLL_DEFS,
  RING_EMPOWER_ROLL_DEFS,
  STONE_EMPOWER_ROLL_DEFS,
  WEAPON_EMPOWER_ROLL_DEFS,
  MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS,
  SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS,
  WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS,
  MC_ITEM_SPELL_EMPOWER_ROLL_DEFS,
  EMPOWER_BASE_POOL_WEIGHT,
  GLOBAL_EMPOWER_KEYS,
  empowerBasePool,
  empowerBonusPool,
  empowerItemClass,
  pickWeightedEmpowerRoll,
  applyEmpowerRollToStats,
  applyEmpowerSpellRoll,
  applyEquippedPetHealthBonus,
  applyEquippedPetDamageReduction,
  applyEquippedSpellDamageBonus,
  applyEquippedSpellCooldownReductionMs,
  applyEquippedSpellHealingBonus,
  applyEquippedSpellMpCostReduction,
  equippedPetDamageReductionPercent,
  equippedPetHealthBonusPercent,
  PET_DAMAGE_REDUCTION_CAP_PERCENT,
  empowerBonusStatLines,
  empowerCandidateRolls,
  empowerReferenceCatalog,
  empowerRollDescriptionsForItem,
  formatEmpowerRollDescription,
  formatEmpowerAppliedChangeLabel,
  empowerItemBonusLines,
  empowerSpellBonusLines,
  empowerSpellBonusTooltipRows,
  empoweredItemStarSuffix,
  empoweredStatLabel,
  equippedSpellCooldownReductionSeconds,
  equippedSpellCritChanceBonusPercent,
  equippedSpellCritDamageBonusPercent,
  equippedSpellDamageBonusPercent,
  equippedSpellHealingBonusPercent,
  equippedSpellManaCostReductionPercent,
  sanitizeEmpowerSpellBonuses,
  itemCanBeEmpowered,
  itemHasNaturalMc,
  itemHasNaturalDc,
  itemHasNaturalSc,
  weaponCanRollDcEmpower,
  weaponEmpowerClass,
  weaponEmpowerClassLabel,
  weaponEmpowerRollDescriptionsForClass,
  pickEmpowerRollsWithoutReplacement,
  rollEmpowerTier,
  rollEmpoweredItemDrop,
  rollEmpowermentReroll,
  rollEmpowermentRerollAtSlot,
  swapRandomEmpowermentsBetweenEntries,
  swapEmpowermentsAtSlotIndices,
  empowerSlotChoiceLabels,
  listEmpowerSlotsFromEntry,
} from "../src/core/empoweredItems.js";
import { sanitizeItemBonusStats } from "../src/battleData.js";

const WARRIOR_WEAPON = {
  id: "great-axe",
  slot: "weapon",
  type: "weapon",
  requirements: { level: 31 },
  stats: { dc: [0, 35], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
};

const WIZARD_WEAPON = {
  id: "war-mage-staff",
  slot: "weapon",
  type: "weapon",
  stats: { dc: [0, 10], mc: [0, 8], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
};

const TAO_WEAPON = {
  id: "tao-blade",
  slot: "weapon",
  type: "weapon",
  stats: { dc: [0, 10], mc: [0, 0], sc: [0, 8], ac: [0, 0], amc: [0, 0] },
};

const UNIVERSAL_WEAPON = {
  id: "tri-staff",
  slot: "weapon",
  type: "weapon",
  stats: { dc: [0, 5], mc: [0, 5], sc: [0, 5], ac: [0, 0], amc: [0, 0] },
};

const MC_RING = {
  id: "mc-ring",
  slot: "ring",
  type: "ring",
  requirements: { level: 31 },
  stats: { dc: [0, 0], mc: [0, 8], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
};

const HEAVY_ARMOUR = {
  id: "heavy-armour",
  slot: "armour",
  type: "armour",
  requirements: { level: 31 },
  stats: { ac: [0, 12], amc: [0, 8], dc: [0, 0], mc: [0, 0], sc: [0, 0] },
};

const AWAKENING_SOUL = {
  id: "awakening-soul",
  slot: "consumable",
  type: "material",
  stackable: true,
};

test("itemCanBeEmpowered: equippable yes, books and souls no", () => {
  assert.equal(itemCanBeEmpowered(WARRIOR_WEAPON), true);
  assert.equal(itemCanBeEmpowered(AWAKENING_SOUL), false);
  assert.equal(itemCanBeEmpowered({ slot: "weapon", type: "book" }), false);
});

test("weaponEmpowerClass: warrior, wizard, tao, universal", () => {
  assert.equal(weaponEmpowerClass(WARRIOR_WEAPON), "warrior");
  assert.equal(weaponEmpowerClass(WIZARD_WEAPON), "wizard");
  assert.equal(weaponEmpowerClass(TAO_WEAPON), "tao");
  assert.equal(weaponEmpowerClass(UNIVERSAL_WEAPON), "universal");
  assert.equal(weaponEmpowerClassLabel("wizard"), "Wizard weapon");
});

test("empowerCandidateRolls: warrior weapons exclude MC and SC empowers", () => {
  const rolls = empowerCandidateRolls(WARRIOR_WEAPON);
  const keys = rolls.map((roll) => roll.key);
  assert.ok(keys.includes("dc"));
  assert.equal(keys.includes("mc"), false);
  assert.equal(keys.includes("sc"), false);
  assert.equal(rolls.length, WEAPON_EMPOWER_ROLL_DEFS.length - 2 + WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS.length);
  assert.deepEqual(rolls.find((roll) => roll.key === "dc"), { key: "dc", range: true, index: 1, min: 1, max: 5 });
});

test("empowerCandidateRolls: wizard weapons roll MC only among damage stats", () => {
  const keys = empowerCandidateRolls(WIZARD_WEAPON).map((roll) => roll.key);
  assert.equal(keys.includes("dc"), false);
  assert.ok(keys.includes("mc"));
  assert.equal(keys.includes("sc"), false);
  assert.equal(keys.includes("accuracy"), false);
  assert.equal(keys.includes("attackSpeed"), false);
  assert.equal(keys.includes("freezing"), false);
  assert.equal(keys.includes("poisonAttack"), false);
});

test("empowerCandidateRolls: tao weapons roll SC only among damage stats", () => {
  const keys = empowerCandidateRolls(TAO_WEAPON).map((roll) => roll.key);
  assert.equal(keys.includes("dc"), false);
  assert.equal(keys.includes("mc"), false);
  assert.ok(keys.includes("sc"));
  assert.equal(keys.includes("accuracy"), false);
  assert.equal(keys.includes("attackSpeed"), false);
});

test("empowerCandidateRolls: wizard weapons exclude warrior utility empowers", () => {
  const keys = empowerCandidateRolls(WIZARD_WEAPON).map((roll) => roll.key);
  assert.ok(keys.includes("mc"));
  assert.equal(keys.includes("accuracy"), false);
  assert.equal(keys.includes("attackSpeed"), false);
  assert.equal(keys.includes("freezing"), false);
  assert.equal(keys.includes("poisonAttack"), false);
});

test("empowerCandidateRolls: warrior weapons include warrior utility empowers", () => {
  const keys = empowerCandidateRolls(WARRIOR_WEAPON).map((roll) => roll.key);
  assert.ok(keys.includes("accuracy"));
  assert.ok(keys.includes("attackSpeed"));
  assert.ok(keys.includes("freezing"));
  assert.ok(keys.includes("poisonAttack"));
});

test("empowerCandidateRolls: universal weapons roll DC, MC, and SC empowers", () => {
  const keys = empowerCandidateRolls(UNIVERSAL_WEAPON).map((roll) => roll.key);
  assert.ok(keys.includes("dc"));
  assert.ok(keys.includes("mc"));
  assert.ok(keys.includes("sc"));
});

test("weaponCanRollDcEmpower: warrior and universal only", () => {
  assert.equal(weaponCanRollDcEmpower(WARRIOR_WEAPON), true);
  assert.equal(weaponCanRollDcEmpower(WIZARD_WEAPON), false);
  assert.equal(weaponCanRollDcEmpower(TAO_WEAPON), false);
  assert.equal(weaponCanRollDcEmpower(UNIVERSAL_WEAPON), true);
});

test("empowerCandidateRolls: armour uses fixed armour stat table", () => {
  const rolls = empowerCandidateRolls(HEAVY_ARMOUR);
  const keys = rolls.map((roll) => roll.key);
  for (const def of ARMOUR_EMPOWER_ROLL_DEFS) assert.ok(keys.includes(def.key), def.key);
  assert.deepEqual(rolls.find((roll) => roll.key === "hp"), { key: "hp", range: false, min: 10, max: 100, step: 10 });
  assert.deepEqual(rolls.find((roll) => roll.key === "xpBonusPercent"), { key: "xpBonusPercent", range: false, min: 5, max: 30, step: 5 });
});

test("empowerCandidateRolls: helmets use fixed helmet stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "helmet", stats: {} });
  const keys = rolls.map((roll) => roll.key);
  for (const def of HELMET_EMPOWER_ROLL_DEFS) assert.ok(keys.includes(def.key), def.key);
  assert.deepEqual(rolls.find((roll) => roll.key === "ac"), { key: "ac", range: true, index: 1, min: 1, max: 3 });
  assert.deepEqual(rolls.find((roll) => roll.key === "hp"), { key: "hp", range: false, min: 10, max: 20, step: 10 });
});

test("empowerCandidateRolls: bracelets use fixed bracelet stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "bracelet", stats: {} });
  const keys = rolls.map((roll) => roll.key);
  for (const def of BRACELET_EMPOWER_ROLL_DEFS) assert.ok(keys.includes(def.key), def.key);
  assert.deepEqual(rolls.find((roll) => roll.key === "dc"), { key: "dc", range: true, index: 1, min: 1, max: 4 });
  assert.deepEqual(rolls.find((roll) => roll.key === "poisonResist"), { key: "poisonResist", range: false, min: 1, max: 1 });
  assert.deepEqual(rolls.find((roll) => roll.key === "magicResist"), { key: "magicResist", range: false, min: 1, max: 1 });
});

test("empowerCandidateRolls: rings use fixed ring stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "ring", stats: {} });
  const keys = rolls.map((roll) => roll.key);
  for (const def of RING_EMPOWER_ROLL_DEFS) assert.ok(keys.includes(def.key), def.key);
  assert.deepEqual(rolls.find((roll) => roll.key === "dc"), { key: "dc", range: true, index: 1, min: 1, max: 6 });
  assert.deepEqual(rolls.find((roll) => roll.key === "attackSpeed"), { key: "attackSpeed", range: false, min: 1, max: 2 });
  assert.deepEqual(rolls.find((roll) => roll.key === "poisonAttack"), { key: "poisonAttack", range: false, min: 1, max: 2 });
});

test("empowerCandidateRolls: belts and boots share belt/boot stat table", () => {
  for (const slot of ["belt", "boots"]) {
    const rolls = empowerCandidateRolls({ slot, stats: {} });
    const keys = rolls.map((roll) => roll.key);
    for (const def of BELT_BOOT_EMPOWER_ROLL_DEFS) assert.ok(keys.includes(def.key), def.key);
    assert.deepEqual(rolls.find((roll) => roll.key === "hp"), { key: "hp", range: false, min: 10, max: 30, step: 10 });
    assert.deepEqual(rolls.find((roll) => roll.key === "poisonResist"), { key: "poisonResist", range: false, min: 1, max: 1 });
  }
});

test("empowerCandidateRolls: stones use fixed stone stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "stone", stats: {} });
  const keys = rolls.map((roll) => roll.key);
  for (const def of STONE_EMPOWER_ROLL_DEFS) assert.ok(keys.includes(def.key), def.key);
  assert.deepEqual(rolls.find((roll) => roll.key === "dc"), { key: "dc", range: true, index: 1, min: 1, max: 3 });
  assert.deepEqual(rolls.find((roll) => roll.key === "amc"), { key: "amc", range: true, index: 1, min: 1, max: 2 });
});

test("empoweredItemStarSuffix: one star per empowerment tier", () => {
  assert.equal(empoweredItemStarSuffix({ empowerTier: 1 }), "★");
  assert.equal(empoweredItemStarSuffix({ empowerTier: 4 }), "★★★★");
  assert.equal(empoweredItemStarSuffix({ empowered: true }), "★");
  assert.equal(empoweredItemStarSuffix({}), "");
});

test("empoweredStatLabel: appends star to empowered stat labels", () => {
  assert.equal(empoweredStatLabel("SC", true), "SC★");
  assert.equal(empoweredStatLabel("SC", false), "SC");
  assert.equal(empoweredStatLabel("Gold Bonus", true), "Gold Bonus★");
});

test("rollEmpowerTier: respects weight table", () => {
  assert.equal(rollEmpowerTier(EMPOWER_TIER_WEIGHTS, () => 0), 1);
  assert.equal(rollEmpowerTier(EMPOWER_TIER_WEIGHTS, () => 0.59), 1);
  assert.equal(rollEmpowerTier(EMPOWER_TIER_WEIGHTS, () => 0.61), 2);
  assert.equal(rollEmpowerTier(EMPOWER_TIER_WEIGHTS, () => 0.91), 3);
  assert.equal(rollEmpowerTier(EMPOWER_TIER_WEIGHTS, () => 0.99), 4);
});

test("pickEmpowerRollsWithoutReplacement: no duplicate stat keys", () => {
  const picks = pickEmpowerRollsWithoutReplacement(WEAPON_EMPOWER_ROLL_DEFS, 4, () => 0);
  assert.equal(picks.length, 4);
  assert.equal(new Set(picks.map((roll) => roll.key)).size, 4);
});

test("rollEmpoweredItemDrop: applies one stat roll per empowerment tier", () => {
  let n = 0;
  const rng = () => {
    n += 1;
    return 0;
  };
  const result = rollEmpoweredItemDrop(WARRIOR_WEAPON, rng);
  assert.equal(result?.empowerTier, 1);
  assert.ok(result?.empowered);
  assert.ok(empowerBonusStatLines(result.empowerBonusStats).length >= 1);
});

test("rollEmpoweredItemDrop: null when empower roll fails", () => {
  const result = rollEmpoweredItemDrop(WARRIOR_WEAPON, () => 1);
  assert.equal(result, null);
});

test("legacy single-stat item: star count never exceeds distinct empowered stats", () => {
  // Regression: legacy/dynamic slots used to emit two candidates per range stat
  // (min + max endpoint), so a single-stat item could show ★★ but one empowered
  // stat. Uses a table-less slot ("amulet") so it exercises the legacy generator.
  const amulet = {
    id: "mono-amulet",
    slot: "amulet",
    type: "amulet",
    requirements: { level: 25 },
    stats: { dc: [0, 0], mc: [3, 6], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
  };
  const candidates = empowerCandidateRolls(amulet);
  const mcCandidates = candidates.filter((roll) => roll.key === "mc");
  assert.equal(mcCandidates.length, 1, "one empowerment candidate per stat");

  // Force the max tier; applied stars must equal the distinct stats available (1).
  const result = rollEmpoweredItemDrop(amulet, () => 0, { itemChance: 1, tierWeights: [{ tier: 4, weight: 1 }] });
  assert.ok(result?.empowered);
  assert.equal(result.empowerTier, 1);
  assert.equal(empowerBonusStatLines(result.empowerBonusStats).length, result.empowerTier);
});

test("rollEmpoweredItemDrop: four empowerments use four different stats", () => {
  let n = 0;
  const rng = () => {
    n += 1;
    if (n === 1) return 0;
    if (n === 2) return 0.99;
    return 0;
  };
  const result = rollEmpoweredItemDrop(UNIVERSAL_WEAPON, rng);
  assert.equal(result?.empowerTier, 4);
  assert.equal(result?.empowerBonusStats.dc[1], 1);
  assert.ok(result?.empowerBonusStats.mc[1] > 0);
  assert.ok(result?.empowerBonusStats.sc[1] > 0);
  assert.ok(result?.empowerBonusStats.accuracy > 0);
});

test("rollEmpowermentReroll keeps tier and swaps one empowerment", () => {
  const entry = {
    empowered: true,
    empowerTier: 2,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 3], mc: [0, 2] }),
    empowerSpellBonuses: {},
  };
  assert.equal(listEmpowerSlotsFromEntry(entry).length, 2);

  let n = 0;
  const rng = () => {
    n += 1;
    if (n === 1) return 0.99;
    if (n === 2) return 0;
    return 0;
  };
  const result = rollEmpowermentReroll(entry, UNIVERSAL_WEAPON, rng);
  assert.equal(result.ok, true);
  assert.equal(result.removedAmount, 2);
  assert.ok(result.appliedAmount > 0);
  assert.equal(entry.empowerTier, 2);
  assert.equal(entry.empowerBonusStats.dc[1], 3);
  assert.notEqual(entry.empowerBonusStats.mc[1], 2);
  assert.equal(listEmpowerSlotsFromEntry(entry).length, 2);
});

test("rollEmpowermentRerollAtSlot rerolls the chosen empowerment only", () => {
  const entry = {
    empowered: true,
    empowerTier: 2,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 3], mc: [0, 2] }),
    empowerSpellBonuses: {},
  };
  const result = rollEmpowermentRerollAtSlot(entry, UNIVERSAL_WEAPON, 1, () => 0);
  assert.equal(result.ok, true);
  assert.equal(result.removedAmount, 2);
  assert.equal(entry.empowerBonusStats.dc[1], 3);
  assert.notEqual(entry.empowerBonusStats.mc[1], 2);
});

test("empowerSlotChoiceLabels lists current empowerment amounts", () => {
  const entry = {
    empowered: true,
    empowerTier: 1,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 4] }),
    empowerSpellBonuses: {},
  };
  const labels = empowerSlotChoiceLabels(entry, UNIVERSAL_WEAPON);
  assert.equal(labels.length, 1);
  assert.match(labels[0].label, /\+4 DC/);
});

test("swapRandomEmpowermentsBetweenEntries exchanges random empowerments", () => {
  const entryA = {
    empowered: true,
    empowerTier: 2,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 3], mc: [0, 2] }),
    empowerSpellBonuses: {},
  };
  const entryB = {
    empowered: true,
    empowerTier: 2,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 5], sc: [0, 1] }),
    empowerSpellBonuses: {},
  };
  let n = 0;
  const rng = () => {
    n += 1;
    return 0;
  };
  const result = swapRandomEmpowermentsBetweenEntries(entryA, UNIVERSAL_WEAPON, entryB, UNIVERSAL_WEAPON, rng);
  assert.equal(result.ok, true);
  assert.equal(entryA.empowerBonusStats.dc[1], 5);
  assert.equal(entryA.empowerBonusStats.mc[1], 2);
  assert.equal(entryB.empowerBonusStats.dc[1], 3);
  assert.equal(entryB.empowerBonusStats.sc[1], 1);
  assert.equal(entryA.empowerTier, 2);
  assert.equal(entryB.empowerTier, 2);
});

test("swapEmpowermentsAtSlotIndices exchanges chosen empowerments", () => {
  const entryA = {
    empowered: true,
    empowerTier: 2,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 3], mc: [0, 2] }),
    empowerSpellBonuses: {},
  };
  const entryB = {
    empowered: true,
    empowerTier: 2,
    empowerBonusStats: sanitizeItemBonusStats({ dc: [0, 5], sc: [0, 1] }),
    empowerSpellBonuses: {},
  };
  const result = swapEmpowermentsAtSlotIndices(entryA, UNIVERSAL_WEAPON, 0, entryB, UNIVERSAL_WEAPON, 0);
  assert.equal(result.ok, true);
  assert.equal(entryA.empowerBonusStats.dc[1], 5);
  assert.equal(entryA.empowerBonusStats.mc[1], 2);
  assert.equal(entryB.empowerBonusStats.dc[1], 3);
  assert.equal(entryB.empowerBonusStats.sc[1], 1);
});

test("formatEmpowerAppliedChangeLabel uses the rolled amount", () => {
  const dcRoll = WEAPON_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "dc");
  assert.equal(formatEmpowerAppliedChangeLabel(dcRoll, 3), "+3 DC");
});

test("applyEmpowerRollToStats: weapon DC rolls 1-5", () => {
  const stats = sanitizeItemBonusStats({});
  const dcRoll = WEAPON_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "dc");
  assert.equal(applyEmpowerRollToStats(stats, dcRoll, 1, () => 0), 1);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), dcRoll, 1, () => 0.999), 5);
});

test("applyEmpowerRollToStats: armour HP rolls in steps of 10", () => {
  const stats = sanitizeItemBonusStats({});
  const hpRoll = ARMOUR_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "hp");
  assert.equal(applyEmpowerRollToStats(stats, hpRoll, 1, () => 0), 10);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), hpRoll, 1, () => 0.999), 100);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), hpRoll, 1, () => 0.5), 60);
});

test("applyEmpowerRollToStats: helmet HP rolls 10 or 20", () => {
  const stats = sanitizeItemBonusStats({});
  const hpRoll = HELMET_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "hp");
  assert.equal(applyEmpowerRollToStats(stats, hpRoll, 1, () => 0), 10);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), hpRoll, 1, () => 0.999), 20);
});

test("applyEmpowerRollToStats: bracelet resist rolls always +1", () => {
  const poisonRoll = BRACELET_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "poisonResist");
  const magicRoll = BRACELET_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "magicResist");
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), poisonRoll, 1, () => 0), 1);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), magicRoll, 1, () => 0.999), 1);
});

test("applyEmpowerRollToStats: ring DC rolls 1-6", () => {
  const dcRoll = RING_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "dc");
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), dcRoll, 1, () => 0), 1);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), dcRoll, 1, () => 0.999), 6);
});

test("applyEmpowerRollToStats: belt/boot HP rolls 10-30 in steps of 10", () => {
  const hpRoll = BELT_BOOT_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "hp");
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), hpRoll, 1, () => 0), 10);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), hpRoll, 1, () => 0.999), 30);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), hpRoll, 1, () => 0.5), 20);
});

test("applyEmpowerRollToStats: armour bonus XP rolls 5-30% in steps of 5", () => {
  const stats = sanitizeItemBonusStats({});
  const xpRoll = ARMOUR_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "xpBonusPercent");
  assert.equal(applyEmpowerRollToStats(stats, xpRoll, 1, () => 0), 5);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), xpRoll, 1, () => 0.999), 30);
});

test("empowerBonusStatLines: formats bonus XP as percent", () => {
  const lines = empowerBonusStatLines({ xpBonusPercent: 15 });
  assert.deepEqual(lines, ["+15% Bonus XP"]);
});

const UTILITY_REWARD_KEYS = ["goldBonusPercent", "xpBonusPercent", "bonusAwakeningSoulChancePercent"];
const ALL_EQUIP_SLOTS = [
  ["weapon", WEAPON_EMPOWER_ROLL_DEFS],
  ["armour", ARMOUR_EMPOWER_ROLL_DEFS],
  ["helmet", HELMET_EMPOWER_ROLL_DEFS],
  ["bracelet", BRACELET_EMPOWER_ROLL_DEFS],
  ["ring", RING_EMPOWER_ROLL_DEFS],
  ["belt", BELT_BOOT_EMPOWER_ROLL_DEFS],
  ["stone", STONE_EMPOWER_ROLL_DEFS],
];

test("empowerCandidateRolls: gold, XP, and soul utility rewards on every slot", () => {
  for (const weapon of [WARRIOR_WEAPON, WIZARD_WEAPON, TAO_WEAPON, UNIVERSAL_WEAPON]) {
    const keys = empowerCandidateRolls(weapon).map((roll) => roll.key);
    for (const key of UTILITY_REWARD_KEYS) assert.ok(keys.includes(key), `weapon ${key}`);
    assert.ok(keys.includes("dropChanceBonusPercent"));
  }
  for (const [slot, table] of ALL_EQUIP_SLOTS.slice(1)) {
    for (const key of UTILITY_REWARD_KEYS) {
      assert.ok(table.some((roll) => roll.key === key), `${slot} table ${key}`);
      const keys = empowerCandidateRolls({ slot, stats: {} }).map((roll) => roll.key);
      assert.ok(keys.includes(key), `${slot} candidates ${key}`);
    }
  }
});

test("item drop chance utility only rolls on weapon, armour, and stone", () => {
  for (const [slot, table] of ALL_EQUIP_SLOTS) {
    const hasDrop = table.some((roll) => roll.key === "dropChanceBonusPercent");
    if (slot === "weapon" || slot === "armour" || slot === "stone") {
      assert.ok(hasDrop, `${slot} should roll item drop chance`);
    } else {
      assert.equal(hasDrop, false, `${slot} should not roll item drop chance`);
    }
  }
});

test("applyEmpowerRollToStats: weapon utility rolls use bounded tables", () => {
  const stats = sanitizeItemBonusStats({});
  const rng = () => 0;
  applyEmpowerRollToStats(stats, { key: "goldBonusPercent", range: false, min: 5, max: 40, step: 5 }, 1, rng);
  assert.equal(stats.goldBonusPercent, 5);
  applyEmpowerRollToStats(stats, { key: "xpBonusPercent", range: false, min: 5, max: 40, step: 5 }, 1, rng);
  assert.equal(stats.xpBonusPercent, 5);
  applyEmpowerRollToStats(stats, { key: "dropChanceBonusPercent", range: false, min: 0.25, max: 1.5, step: 0.25 }, 1, rng);
  assert.equal(stats.dropChanceBonusPercent, 0.25);
  applyEmpowerRollToStats(stats, { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 20, step: 5 }, 1, rng);
  assert.equal(stats.bonusAwakeningSoulChancePercent, 5);
});

test("empowerBonusStatLines: formats utility reward empowers", () => {
  const lines = empowerBonusStatLines({
    goldBonusPercent: 15,
    xpBonusPercent: 3,
    dropChanceBonusPercent: 0.75,
    bonusAwakeningSoulChancePercent: 10,
  });
  assert.deepEqual(lines, [
    "+3% Bonus XP",
    "+15% Gold drop",
    "+10% Awakening Soul drop chance",
    "+0.75% Item drop chance",
  ]);
});

test("BOSS_EMPOWER_ITEM_CHANCE is 20%", () => {
  assert.equal(BOSS_EMPOWER_ITEM_CHANCE, 0.2);
});

const WIZARD_ARMOUR = {
  id: "wiz-robe", slot: "armour", type: "armour",
  stats: { ac: [0, 8], amc: [0, 8], dc: [0, 5], mc: [0, 8], sc: [0, 0] },
};
const WARRIOR_ARMOUR = {
  id: "plate", slot: "armour", type: "armour",
  stats: { ac: [0, 12], amc: [0, 6], dc: [0, 10], mc: [0, 0], sc: [0, 0] },
};
const TAO_ARMOUR = {
  id: "tao-robe", slot: "armour", type: "armour",
  stats: { ac: [0, 8], amc: [0, 10], dc: [0, 4], mc: [0, 0], sc: [0, 8] },
};

test("empowerItemClass: labels from natural DC/MC/SC", () => {
  assert.equal(empowerItemClass(WARRIOR_ARMOUR), "warrior");
  assert.equal(empowerItemClass(WIZARD_ARMOUR), "wizard");
  assert.equal(empowerItemClass(TAO_ARMOUR), "tao");
  assert.equal(empowerItemClass(HEAVY_ARMOUR), "global");
  assert.equal(empowerItemClass({ slot: "armour", stats: { mc: [0, 5], sc: [0, 5] } }), "global");
});

test("empowerBasePool: gates primary stats by item class, excludes globals", () => {
  const warriorKeys = empowerBasePool(WARRIOR_ARMOUR).map((r) => r.key);
  assert.ok(warriorKeys.includes("dc"));
  assert.equal(warriorKeys.includes("mc"), false);
  assert.equal(warriorKeys.includes("sc"), false);

  const wizardKeys = empowerBasePool(WIZARD_ARMOUR).map((r) => r.key);
  assert.ok(wizardKeys.includes("mc"));
  assert.equal(wizardKeys.includes("dc"), false);
  assert.equal(wizardKeys.includes("sc"), false);

  const taoKeys = empowerBasePool(TAO_ARMOUR).map((r) => r.key);
  assert.ok(taoKeys.includes("sc"));
  assert.ok(taoKeys.includes("dc"));
  assert.equal(taoKeys.includes("mc"), false);

  for (const item of [WARRIOR_ARMOUR, WIZARD_ARMOUR, TAO_ARMOUR]) {
    const keys = empowerBasePool(item).map((r) => r.key);
    for (const g of GLOBAL_EMPOWER_KEYS) assert.equal(keys.includes(g), false);
  }
});

test("empowerBonusPool: globals only, plus spell rolls on weapons", () => {
  const armourBonus = empowerBonusPool(HEAVY_ARMOUR).map((r) => r.key);
  assert.ok(armourBonus.includes("goldBonusPercent"));
  assert.ok(armourBonus.includes("xpBonusPercent"));
  assert.ok(armourBonus.includes("bonusAwakeningSoulChancePercent"));
  assert.ok(armourBonus.includes("dropChanceBonusPercent"));
  assert.ok(armourBonus.includes("damageTakenReductionPercent"));
  assert.equal(armourBonus.some((k) => k === "ac" || k === "dc"), false);

  const ringBonus = empowerBonusPool({ slot: "ring", stats: { dc: [0, 3] } }).map((r) => r.key);
  assert.ok(ringBonus.includes("goldBonusPercent"));
  assert.equal(ringBonus.includes("dropChanceBonusPercent"), false);

  const taoWeaponBonus = empowerBonusPool(TAO_WEAPON);
  assert.ok(taoWeaponBonus.some((r) => r.spellId === "Healing"));
  assert.ok(taoWeaponBonus.some((r) => r.key === "goldBonusPercent"));
});

test("pickWeightedEmpowerRoll: base below weight, bonus at/above, with fallback", () => {
  const base = [{ key: "dc" }];
  const bonus = [{ key: "goldBonusPercent" }];
  assert.equal(pickWeightedEmpowerRoll([...base], [...bonus], () => 0).key, "dc");
  assert.equal(pickWeightedEmpowerRoll([...base], [...bonus], () => 0.99).key, "goldBonusPercent");
  // Empty base -> always bonus; empty bonus -> always base.
  assert.equal(pickWeightedEmpowerRoll([], [...bonus], () => 0).key, "goldBonusPercent");
  assert.equal(pickWeightedEmpowerRoll([...base], [], () => 0.99).key, "dc");
  assert.equal(pickWeightedEmpowerRoll([], [], () => 0), null);
  assert.ok(EMPOWER_BASE_POOL_WEIGHT > 0.5 && EMPOWER_BASE_POOL_WEIGHT < 1);
});

test("empowerCandidateRolls: armour/jewellery/stone roll damage-taken reduction, weapons do not", () => {
  for (const [slot, table] of [
    ["armour", ARMOUR_EMPOWER_ROLL_DEFS],
    ["helmet", HELMET_EMPOWER_ROLL_DEFS],
    ["bracelet", BRACELET_EMPOWER_ROLL_DEFS],
    ["ring", RING_EMPOWER_ROLL_DEFS],
    ["belt", BELT_BOOT_EMPOWER_ROLL_DEFS],
    ["stone", STONE_EMPOWER_ROLL_DEFS],
  ]) {
    assert.ok(table.some((roll) => roll.key === "damageTakenReductionPercent"), `${slot} table`);
    const keys = empowerCandidateRolls({ slot, stats: {} }).map((roll) => roll.key);
    assert.ok(keys.includes("damageTakenReductionPercent"), `${slot} candidates`);
  }
  for (const weapon of [WARRIOR_WEAPON, WIZARD_WEAPON, TAO_WEAPON, UNIVERSAL_WEAPON]) {
    const keys = empowerCandidateRolls(weapon).map((roll) => roll.key);
    assert.equal(keys.includes("damageTakenReductionPercent"), false);
  }
});

test("formatEmpowerRollDescription + empowerBonusStatLines: damage-taken reduction shows as minus percent", () => {
  assert.equal(
    formatEmpowerRollDescription({ key: "damageTakenReductionPercent", range: false, min: 3, max: 12, step: 3 }),
    "−3–12% Damage taken",
  );
  assert.deepEqual(
    empowerBonusStatLines({ damageTakenReductionPercent: 8 }),
    ["−8% Damage taken"],
  );
});

test("applyEmpowerRollToStats: damage-taken reduction rolls within its bounded table", () => {
  const stats = sanitizeItemBonusStats({});
  const roll = ARMOUR_EMPOWER_ROLL_DEFS.find((row) => row.key === "damageTakenReductionPercent");
  assert.equal(applyEmpowerRollToStats(stats, roll, 1, () => 0), 3);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), roll, 1, () => 0.999), 12);
});

test("crit empowers are global (bonus pool) and roll on every gear slot", () => {
  assert.ok(GLOBAL_EMPOWER_KEYS.has("critChancePercent"));
  assert.ok(GLOBAL_EMPOWER_KEYS.has("critDamagePercent"));

  const slotTables = [
    WEAPON_EMPOWER_ROLL_DEFS,
    ARMOUR_EMPOWER_ROLL_DEFS,
    HELMET_EMPOWER_ROLL_DEFS,
    BRACELET_EMPOWER_ROLL_DEFS,
    RING_EMPOWER_ROLL_DEFS,
    BELT_BOOT_EMPOWER_ROLL_DEFS,
    STONE_EMPOWER_ROLL_DEFS,
  ];
  for (const table of slotTables) {
    assert.ok(table.some((r) => r.key === "critChancePercent"));
    assert.ok(table.some((r) => r.key === "critDamagePercent"));
  }

  // Crit is never in the base pool, always in the bonus pool.
  const armourBase = empowerBasePool(HEAVY_ARMOUR).map((r) => r.key);
  assert.equal(armourBase.includes("critChancePercent"), false);
  assert.equal(armourBase.includes("critDamagePercent"), false);
  const armourBonus = empowerBonusPool(HEAVY_ARMOUR).map((r) => r.key);
  assert.ok(armourBonus.includes("critChancePercent"));
  assert.ok(armourBonus.includes("critDamagePercent"));
});

test("max crit-chance empower on every worn slot sums to exactly 100%", () => {
  const maxChance = (table) => table.find((r) => r.key === "critChancePercent").max;
  // Worn slots: weapon, armour, helmet, 2 bracelets, 2 rings, necklace (Ring table),
  // belt, boots, stone.
  const total = maxChance(WEAPON_EMPOWER_ROLL_DEFS)
    + maxChance(ARMOUR_EMPOWER_ROLL_DEFS)
    + maxChance(HELMET_EMPOWER_ROLL_DEFS)
    + maxChance(BRACELET_EMPOWER_ROLL_DEFS) * 2
    + maxChance(RING_EMPOWER_ROLL_DEFS) * 3 // 2 rings + necklace (shares Ring table)
    + maxChance(BELT_BOOT_EMPOWER_ROLL_DEFS) * 2 // belt + boots share the table
    + maxChance(STONE_EMPOWER_ROLL_DEFS);
  assert.equal(total, 100);
});

test("skill-leveling empower is global, rolls on every worn slot, sums to ~200%", () => {
  assert.ok(GLOBAL_EMPOWER_KEYS.has("skillLevelBonusPercent"));

  const slotTables = [
    WEAPON_EMPOWER_ROLL_DEFS,
    ARMOUR_EMPOWER_ROLL_DEFS,
    HELMET_EMPOWER_ROLL_DEFS,
    BRACELET_EMPOWER_ROLL_DEFS,
    RING_EMPOWER_ROLL_DEFS,
    BELT_BOOT_EMPOWER_ROLL_DEFS,
    STONE_EMPOWER_ROLL_DEFS,
  ];
  for (const table of slotTables) {
    assert.ok(table.some((r) => r.key === "skillLevelBonusPercent"));
  }

  // Never in the base pool, always in the bonus pool (like gold/XP/drops).
  assert.equal(empowerBasePool(HEAVY_ARMOUR).map((r) => r.key).includes("skillLevelBonusPercent"), false);
  assert.ok(empowerBonusPool(HEAVY_ARMOUR).map((r) => r.key).includes("skillLevelBonusPercent"));

  const maxSkill = (table) => table.find((r) => r.key === "skillLevelBonusPercent").max;
  const total = maxSkill(WEAPON_EMPOWER_ROLL_DEFS)
    + maxSkill(ARMOUR_EMPOWER_ROLL_DEFS)
    + maxSkill(HELMET_EMPOWER_ROLL_DEFS)
    + maxSkill(BRACELET_EMPOWER_ROLL_DEFS) * 2
    + maxSkill(RING_EMPOWER_ROLL_DEFS) * 3 // 2 rings + necklace (shares Ring table)
    + maxSkill(BELT_BOOT_EMPOWER_ROLL_DEFS) * 2 // belt + boots share the table
    + maxSkill(STONE_EMPOWER_ROLL_DEFS);
  assert.equal(total, 200);

  assert.equal(
    formatEmpowerRollDescription({ key: "skillLevelBonusPercent", range: false, min: 5, max: 40, step: 5 }),
    "+5–40% Skill leveling",
  );
  assert.deepEqual(
    empowerBonusStatLines({ skillLevelBonusPercent: 30 }),
    ["+30% Skill leveling"],
  );
});

test("utility reward globals: gold and XP max worn set sums to 200%", () => {
  const wornMax = (key) => {
    const max = (table) => table.find((r) => r.key === key).max;
    return max(WEAPON_EMPOWER_ROLL_DEFS)
      + max(ARMOUR_EMPOWER_ROLL_DEFS)
      + max(HELMET_EMPOWER_ROLL_DEFS)
      + max(BRACELET_EMPOWER_ROLL_DEFS) * 2
      + max(RING_EMPOWER_ROLL_DEFS) * 3
      + max(BELT_BOOT_EMPOWER_ROLL_DEFS) * 2
      + max(STONE_EMPOWER_ROLL_DEFS);
  };
  assert.equal(wornMax("goldBonusPercent"), 200);
  assert.equal(wornMax("xpBonusPercent"), 200);
});

test("utility reward globals: soul max worn set sums to 100%", () => {
  const max = (table) => table.find((r) => r.key === "bonusAwakeningSoulChancePercent").max;
  const total = max(WEAPON_EMPOWER_ROLL_DEFS)
    + max(ARMOUR_EMPOWER_ROLL_DEFS)
    + max(HELMET_EMPOWER_ROLL_DEFS)
    + max(BRACELET_EMPOWER_ROLL_DEFS) * 2
    + max(RING_EMPOWER_ROLL_DEFS) * 3
    + max(BELT_BOOT_EMPOWER_ROLL_DEFS) * 2
    + max(STONE_EMPOWER_ROLL_DEFS);
  assert.equal(total, 100);
});

test("utility reward globals: item drop max worn set sums to 3% on weapon, armour, stone", () => {
  const max = (table) => table.find((r) => r.key === "dropChanceBonusPercent").max;
  const total = max(WEAPON_EMPOWER_ROLL_DEFS)
    + max(ARMOUR_EMPOWER_ROLL_DEFS)
    + max(STONE_EMPOWER_ROLL_DEFS);
  assert.equal(total, 3);
});

test("formatEmpowerRollDescription: crit rolls render as plus percent", () => {
  assert.equal(
    formatEmpowerRollDescription({ key: "critChancePercent", range: false, min: 1, max: 20, step: 1 }),
    "+1–20% Crit Rate",
  );
  assert.equal(
    formatEmpowerRollDescription({ key: "critDamagePercent", range: false, min: 5, max: 30, step: 5 }),
    "+5–30% Crit Damage",
  );
  assert.deepEqual(
    empowerBonusStatLines({ critChancePercent: 8, critDamagePercent: 15 }),
    ["+8% Crit Rate", "+15% Crit Damage"],
  );
});

test("per-spell crit empowers: rolls exist, sanitize, format, and accumulate", () => {
  // Wizard weapons offer per-spell crit for their damage spells.
  const wizardRolls = empowerCandidateRolls(WIZARD_WEAPON);
  assert.ok(wizardRolls.some((r) => r.spellId === "FlameDisruptor" && r.kind === "critChancePercent"));
  assert.ok(wizardRolls.some((r) => r.spellId === "FlameDisruptor" && r.kind === "critDamagePercent"));
  // Warrior weapons offer per-skill crit.
  const warriorRolls = empowerCandidateRolls(WARRIOR_WEAPON);
  assert.ok(warriorRolls.some((r) => r.spellId === "FlamingSword" && r.kind === "critChancePercent"));
  assert.ok(warriorRolls.some((r) => r.spellId === "FlamingSword" && r.kind === "critDamagePercent"));

  // Descriptions read naturally.
  assert.equal(
    formatEmpowerRollDescription({ spellId: "FlameDisruptor", kind: "critChancePercent", min: 5, max: 25, step: 5 }),
    "Increase Flame Disruptor crit chance by 5–25%",
  );
  assert.equal(
    formatEmpowerRollDescription({ spellId: "FlamingSword", kind: "critDamagePercent", min: 10, max: 50, step: 10 }),
    "Increase Flaming Sword crit damage by 10–50%",
  );

  // Rolling applies to the right key and sanitizes/round-trips.
  const bonuses = {};
  applyEmpowerSpellRoll(bonuses, { spellId: "FlameDisruptor", kind: "critChancePercent", min: 15, max: 15, step: 5 }, () => 0);
  applyEmpowerSpellRoll(bonuses, { spellId: "FlamingSword", kind: "critDamagePercent", min: 50, max: 50, step: 10 }, () => 0);
  const clean = sanitizeEmpowerSpellBonuses(bonuses);
  assert.equal(clean.FlameDisruptor.critChancePercent, 15);
  assert.equal(clean.FlamingSword.critDamagePercent, 50);

  // Accessors sum across equipped items only.
  const inventory = {
    equipment: { weapon: "w1", ringL: "r1" },
    items: [
      { id: "w1", empowerSpellBonuses: { FlameDisruptor: { critChancePercent: 15, critDamagePercent: 20 } } },
      { id: "r1", empowerSpellBonuses: { FlameDisruptor: { critChancePercent: 10 } } },
      { id: "bag", empowerSpellBonuses: { FlameDisruptor: { critChancePercent: 99 } } }, // not equipped
    ],
  };
  assert.equal(equippedSpellCritChanceBonusPercent("FlameDisruptor", inventory), 25);
  assert.equal(equippedSpellCritDamageBonusPercent("FlameDisruptor", inventory), 20);
  assert.equal(equippedSpellCritChanceBonusPercent("FireBall", inventory), 0);
});

test("per-spell crit also rolls on armour + jewellery, class-gated and lower", () => {
  const chanceRoll = (pool, spellId) => pool.find((r) => r.spellId === spellId && r.kind === "critChancePercent");

  // Neutral defensive armour (no natural DC/MC/SC) offers ALL classes' spell crit.
  const armourPool = empowerBonusPool(HEAVY_ARMOUR);
  assert.ok(chanceRoll(armourPool, "FlameDisruptor"), "wizard spell on neutral armour");
  assert.ok(chanceRoll(armourPool, "Slaying"), "warrior skill on neutral armour");
  assert.ok(chanceRoll(armourPool, "SoulFireBall"), "tao spell on neutral armour");
  // Armour tier is lower than the weapon tier (weapon crit chance maxes at 25).
  assert.equal(chanceRoll(armourPool, "FlameDisruptor").max, 12);
  assert.equal(armourPool.find((r) => r.spellId === "FlameDisruptor" && r.kind === "critDamagePercent").max, 25);

  // Class-flavoured gear only offers its class's spells.
  const wizardRingPool = empowerBonusPool(MC_RING); // natural MC -> wizard
  assert.ok(chanceRoll(wizardRingPool, "FlameDisruptor"));
  assert.equal(chanceRoll(wizardRingPool, "Slaying"), undefined);
  assert.equal(chanceRoll(wizardRingPool, "SoulFireBall"), undefined);
  // Accessory tier is the lowest (crit chance maxes at 8).
  assert.equal(chanceRoll(wizardRingPool, "FlameDisruptor").max, 8);

  const warriorArmourPool = empowerBonusPool(WARRIOR_ARMOUR); // natural DC -> warrior
  assert.ok(chanceRoll(warriorArmourPool, "Slaying"));
  assert.equal(chanceRoll(warriorArmourPool, "FlameDisruptor"), undefined);

  // Weapons still roll spell crit through the weapon path (not duplicated here).
  const wizardWeaponPool = empowerBonusPool(WIZARD_WEAPON);
  assert.equal(chanceRoll(wizardWeaponPool, "FlameDisruptor").max, 25);
});

test("non-weapon gear rolls the FULL class spell empowers (damage/mana/pet) at reduced ranges", () => {
  const dmgRoll = (pool, spellId) => pool.find((r) => r.spellId === spellId && r.kind === "damagePercent");

  // Neutral armour offers every class's spell damage empowers, scaled below weapon.
  const armourPool = empowerBonusPool(HEAVY_ARMOUR);
  const fdWeapon = dmgRoll(empowerBonusPool(WIZARD_WEAPON), "FlameDisruptor"); // 10–35
  const fdArmour = dmgRoll(armourPool, "FlameDisruptor");
  assert.ok(fdArmour, "wizard spell damage on neutral armour");
  assert.ok(fdArmour.max < fdWeapon.max, "armour spell damage max below weapon");
  // Warrior skill + tao pet empowers also present on neutral gear.
  assert.ok(dmgRoll(armourPool, "Slaying"), "warrior skill damage on neutral armour");
  assert.ok(armourPool.some((r) => r.spellId === "SummonSkeleton" && r.kind === "petHealthPercent"), "pet health on neutral armour");
  assert.ok(armourPool.some((r) => r.kind === "manaCostPercent"), "mana empowers on neutral armour");

  // Class-flavoured jewellery only offers its class's spell empowers, lowest tier.
  const wizardRingPool = empowerBonusPool(MC_RING);
  assert.ok(dmgRoll(wizardRingPool, "FlameDisruptor"), "wizard spell damage on MC ring");
  assert.equal(dmgRoll(wizardRingPool, "Slaying"), undefined, "no warrior skills on MC ring");
  assert.ok(dmgRoll(wizardRingPool, "FlameDisruptor").max <= fdArmour.max, "ring tier <= armour tier");
});

test("necklaces use the Ring table (same tier), not the legacy pool", () => {
  const necklace = {
    id: "amber-necklace", slot: "necklace", type: "necklace",
    requirements: { level: 25 },
    stats: { dc: [0, 0], mc: [1, 7], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
  };
  // Base pool should be the Ring table (gated to MC as this necklace is wizard-class).
  const base = empowerBasePool(necklace);
  assert.ok(base, "necklace has a fixed base pool (not legacy)");
  const baseKeys = base.map((r) => r.key);
  assert.ok(baseKeys.includes("mc"), "necklace rolls MC from Ring table");
  assert.equal(baseKeys.includes("dc"), false, "wizard necklace excludes DC primary");
  // Bonus pool includes globals + wizard spell empowers + crit at ring/accessory tier.
  const bonus = empowerBonusPool(necklace);
  assert.ok(bonus.some((r) => r.key === "critChancePercent" && r.max === 6), "necklace crit chance uses Ring max (6)");
  assert.ok(bonus.some((r) => r.spellId === "FlameDisruptor" && r.kind === "critChancePercent"));
});

test("itemHasNaturalMc: base MC only, not empower bonuses", () => {
  assert.equal(itemHasNaturalMc(WARRIOR_WEAPON), false);
  assert.equal(itemHasNaturalMc(MC_RING), true);
  assert.equal(itemHasNaturalMc({ slot: "ring", stats: { mc: [2, 0] } }), true);
});

test("empowerCandidateRolls: wizard weapons include wizard spell empower rolls", () => {
  const rolls = empowerCandidateRolls(WIZARD_WEAPON);
  assert.ok(rolls.some((roll) => roll.spellId === "FlameDisruptor" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FireWall" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "ThunderBolt" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "IceStorm" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FlameDisruptor" && roll.kind === "manaCostPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FireWall" && roll.kind === "manaCostPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FireBall" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "GreatFireBall" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FrostCrunch" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "MeteorStrike" && roll.kind === "manaCostPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "Blizzard" && roll.kind === "manaCostPercent"));
  assert.equal(rolls.filter((roll) => roll.spellId).length, MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.length);
});

test("empowerCandidateRolls: warrior weapons include warrior skill empower rolls", () => {
  const rolls = empowerCandidateRolls(WARRIOR_WEAPON);
  assert.ok(rolls.some((roll) => roll.spellId === "Slaying" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FlamingSword" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FlamingSword" && roll.kind === "cooldownReductionSeconds"));
  assert.ok(rolls.some((roll) => roll.spellId === "TwinDrakeBlade" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "TwinDrakeBlade" && roll.kind === "manaCostPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "BladeAvalanche" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "BladeAvalanche" && roll.kind === "manaCostPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "SlashingBurst" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "SlashingBurst" && roll.kind === "manaCostPercent"));
  assert.equal(rolls.filter((roll) => roll.spellId).length, WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS.length);
});

test("empowerCandidateRolls: tao weapons include tao spell empower rolls", () => {
  const rolls = empowerCandidateRolls(TAO_WEAPON);
  assert.ok(rolls.some((roll) => roll.spellId === "Healing" && roll.kind === "healingPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "MassHealing" && roll.kind === "healingPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "SoulFireBall" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "SummonSkeleton" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "SummonShinsu" && roll.kind === "damagePercent"));
  assert.equal(rolls.filter((roll) => roll.spellId).length, SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.length);
});

test("empowerCandidateRolls: tao weapons include pet health and damage-reduction empowers", () => {
  const rolls = empowerCandidateRolls(TAO_WEAPON);
  for (const spellId of ["SummonSkeleton", "SummonShinsu", "SummonHolyDeva"]) {
    assert.ok(rolls.some((roll) => roll.spellId === spellId && roll.kind === "petHealthPercent"), `${spellId} health`);
    assert.ok(rolls.some((roll) => roll.spellId === spellId && roll.kind === "petDamageReductionPercent"), `${spellId} DR`);
    assert.ok(rolls.some((roll) => roll.spellId === spellId && roll.kind === "damagePercent"), `${spellId} damage`);
  }
});

test("applyEmpowerSpellRoll: pet health and damage reduction accumulate on the summon", () => {
  const healthRoll = SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:SummonShinsu:petHealth");
  const drRoll = SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:SummonShinsu:petDamageReduction");
  const bonuses = {};
  assert.equal(applyEmpowerSpellRoll(bonuses, healthRoll, () => 0), 10);
  assert.equal(bonuses.SummonShinsu.petHealthPercent, 10);
  assert.equal(applyEmpowerSpellRoll(bonuses, drRoll, () => 0.999), 20);
  assert.equal(bonuses.SummonShinsu.petDamageReductionPercent, 20);
});

test("formatEmpowerRollDescription: formats pet health and damage-reduction rolls", () => {
  assert.equal(
    formatEmpowerRollDescription(SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:SummonHolyDeva:petHealth")),
    "Increase Holy Deva health by 10–50%",
  );
  assert.equal(
    formatEmpowerRollDescription(SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:SummonSkeleton:petDamageReduction")),
    "Reduce Skeleton damage taken by 5–20%",
  );
});

test("equippedPetHealthBonusPercent + applyEquippedPetHealthBonus: sums equipped pet health empowers", () => {
  const inventory = {
    equipment: { weapon: "entry-1", ring: "entry-2" },
    items: [
      { id: "entry-1", empowerSpellBonuses: { SummonShinsu: { petHealthPercent: 30 } } },
      { id: "entry-2", empowerSpellBonuses: { SummonShinsu: { petHealthPercent: 20 } } },
    ],
  };
  assert.equal(equippedPetHealthBonusPercent("SummonShinsu", inventory), 50);
  assert.equal(applyEquippedPetHealthBonus("SummonShinsu", 200, inventory), 300);
  assert.equal(applyEquippedPetHealthBonus("SummonSkeleton", 200, inventory), 200);
});

test("equippedPetDamageReductionPercent: sums and caps stacked reduction", () => {
  const inventory = {
    equipment: { weapon: "entry-1" },
    items: [{ id: "entry-1", empowerSpellBonuses: { SummonShinsu: { petDamageReductionPercent: 15 } } }],
  };
  assert.equal(equippedPetDamageReductionPercent("SummonShinsu", inventory), 15);
  assert.equal(applyEquippedPetDamageReduction("SummonShinsu", 100, inventory), 85);
  assert.equal(applyEquippedPetDamageReduction("SummonSkeleton", 100, inventory), 100);

  const stacked = {
    equipment: { weapon: "w", ring: "r", bracelet: "b", necklace: "n", armour: "a", helmet: "h" },
    items: [
      { id: "w", empowerSpellBonuses: { SummonShinsu: { petDamageReductionPercent: 20 } } },
      { id: "r", empowerSpellBonuses: { SummonShinsu: { petDamageReductionPercent: 20 } } },
      { id: "b", empowerSpellBonuses: { SummonShinsu: { petDamageReductionPercent: 20 } } },
      { id: "n", empowerSpellBonuses: { SummonShinsu: { petDamageReductionPercent: 20 } } },
      { id: "a", empowerSpellBonuses: { SummonShinsu: { petDamageReductionPercent: 20 } } },
    ],
  };
  assert.equal(equippedPetDamageReductionPercent("SummonShinsu", stacked), PET_DAMAGE_REDUCTION_CAP_PERCENT);
});

test("empowerSpellBonusLines + tooltip rows: format pet health and damage taken", () => {
  assert.deepEqual(
    empowerSpellBonusLines({ SummonShinsu: { petHealthPercent: 30 } }),
    ["+30% Shinsu health"],
  );
  assert.deepEqual(
    empowerSpellBonusLines({ SummonHolyDeva: { petDamageReductionPercent: 15 } }),
    ["−15% Holy Deva damage taken"],
  );
  assert.deepEqual(
    empowerSpellBonusTooltipRows({ SummonSkeleton: { petHealthPercent: 25 } }),
    [{ label: "Skeleton", value: "+25% health" }],
  );
});

test("empowerCandidateRolls: universal weapons include wizard and tao spell rolls", () => {
  const rolls = empowerCandidateRolls(UNIVERSAL_WEAPON);
  assert.equal(
    rolls.filter((roll) => roll.spellId).length,
    MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.length + SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.length,
  );
});

test("empowerCandidateRolls: non-warrior weapons exclude warrior skill rolls", () => {
  const wizardRolls = empowerCandidateRolls(WIZARD_WEAPON);
  assert.equal(wizardRolls.some((roll) => roll.spellId === "Slaying"), false);
  assert.equal(wizardRolls.some((roll) => roll.spellId === "FlamingSword"), false);
  const universalRolls = empowerCandidateRolls(UNIVERSAL_WEAPON);
  assert.equal(universalRolls.some((roll) => roll.spellId === "Slaying"), false);
});

test("empowerCandidateRolls: non-SC weapons exclude tao spell rolls", () => {
  const rolls = empowerCandidateRolls(WARRIOR_WEAPON);
  assert.equal(rolls.some((roll) => roll.spellId === "Healing"), false);
  assert.equal(rolls.some((roll) => roll.spellId === "SummonSkeleton"), false);
});

test("empowerCandidateRolls: MC non-weapons roll Flame Disruptor damage/mana + crit at reduced ranges", () => {
  const rolls = empowerCandidateRolls(MC_RING);
  const dmg = rolls.find((roll) => roll.spellId === "FlameDisruptor" && roll.kind === "damagePercent");
  assert.ok(dmg, "MC ring rolls Flame Disruptor damage");
  assert.ok(dmg.max < 35, "reduced below weapon max (35)");
  assert.ok(rolls.some((roll) => roll.spellId === "FlameDisruptor" && roll.kind === "manaCostPercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FlameDisruptor" && roll.kind === "critChancePercent"));
});

test("empowerCandidateRolls: non-MC weapons exclude Flame Disruptor spell roll", () => {
  const rolls = empowerCandidateRolls(WARRIOR_WEAPON);
  assert.equal(rolls.some((roll) => roll.spellId === "FlameDisruptor"), false);
});

test("applyEmpowerSpellRoll: Flame Disruptor damage rolls 10-35% in steps of 5", () => {
  const roll = MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:FlameDisruptor:damage");
  const bonuses = {};
  assert.equal(applyEmpowerSpellRoll(bonuses, roll, () => 0), 10);
  assert.equal(applyEmpowerSpellRoll({}, roll, () => 0.999), 35);
  assert.equal(applyEmpowerSpellRoll({}, roll, () => 0.5), 25);
});

test("applyEmpowerSpellRoll: Fire Wall mana cost rolls 10-40% in steps of 5", () => {
  const roll = MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:FireWall:mana");
  const bonuses = {};
  assert.equal(applyEmpowerSpellRoll(bonuses, roll, () => 0), 10);
  assert.equal(bonuses.FireWall.manaCostPercent, 10);
  assert.equal(applyEmpowerSpellRoll({}, roll, () => 0.999), 40);
});

test("applyEmpowerSpellRoll: Healing rolls 5-25% in steps of 5", () => {
  const roll = SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:Healing:healing");
  const bonuses = {};
  assert.equal(applyEmpowerSpellRoll(bonuses, roll, () => 0), 5);
  assert.equal(bonuses.Healing.healingPercent, 5);
  assert.equal(applyEmpowerSpellRoll({}, roll, () => 0.999), 25);
});

test("applyEmpowerSpellRoll: Flaming Sword cooldown rolls 1-5 seconds", () => {
  const roll = WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS.find((row) => row.key === "skill:FlamingSword:cooldown");
  const bonuses = {};
  assert.equal(applyEmpowerSpellRoll(bonuses, roll, () => 0), 1);
  assert.equal(bonuses.FlamingSword.cooldownReductionSeconds, 1);
  assert.equal(applyEmpowerSpellRoll({}, roll, () => 0.999), 5);
});

test("applyEquippedSpellCooldownReductionMs: subtracts equipped seconds", () => {
  const inventory = {
    equipment: { weapon: "entry-1" },
    items: [{
      id: "entry-1",
      empowerSpellBonuses: { FlamingSword: { cooldownReductionSeconds: 3 } },
    }],
  };
  assert.equal(equippedSpellCooldownReductionSeconds("FlamingSword", inventory), 3);
  assert.equal(applyEquippedSpellCooldownReductionMs("FlamingSword", 10000, inventory), 7000);
  assert.equal(applyEquippedSpellCooldownReductionMs("Slaying", 10000, inventory), 10000);
});

test("applyEquippedSpellHealingBonus: applies percent increase", () => {
  const inventory = {
    equipment: { weapon: "entry-1" },
    items: [{
      id: "entry-1",
      empowerSpellBonuses: { Healing: { healingPercent: 20 } },
    }],
  };
  assert.equal(equippedSpellHealingBonusPercent("Healing", inventory), 20);
  assert.equal(applyEquippedSpellHealingBonus("Healing", 100, inventory), 120);
  assert.equal(applyEquippedSpellHealingBonus("MassHealing", 100, inventory), 100);
});

test("equippedSpellDamageBonusPercent: sums equipped empower spell bonuses", () => {
  const inventory = {
    equipment: { ringL: "entry-1" },
    items: [{
      id: "entry-1",
      empowerSpellBonuses: { FlameDisruptor: { damagePercent: 20 } },
    }],
  };
  assert.equal(equippedSpellDamageBonusPercent("FlameDisruptor", inventory), 20);
  assert.equal(equippedSpellDamageBonusPercent("FireBall", inventory), 0);
});

test("applyEquippedSpellMpCostReduction: applies percent reduction from equipped items", () => {
  const inventory = {
    equipment: { weapon: "entry-1" },
    items: [{
      id: "entry-1",
      empowerSpellBonuses: { FireWall: { manaCostPercent: 20 } },
    }],
  };
  assert.equal(equippedSpellManaCostReductionPercent("FireWall", inventory), 20);
  assert.equal(applyEquippedSpellMpCostReduction("FireWall", 30, inventory), 24);
  assert.equal(applyEquippedSpellMpCostReduction("ThunderBolt", 30, inventory), 30);
});

test("applyEquippedSpellDamageBonus: applies percent increase", () => {
  const inventory = {
    equipment: { ringL: "entry-1" },
    items: [{
      id: "entry-1",
      empowerSpellBonuses: { FlameDisruptor: { damagePercent: 25 } },
    }],
  };
  assert.equal(applyEquippedSpellDamageBonus("FlameDisruptor", 100, inventory), 125);
  assert.equal(applyEquippedSpellDamageBonus("FireBall", 100, inventory), 100);
});

test("empowerSpellBonusLines: formats spell damage and mana cost", () => {
  assert.deepEqual(
    empowerSpellBonusLines({ FlameDisruptor: { damagePercent: 22 } }),
    ["+22% Flame Disruptor damage"],
  );
  assert.deepEqual(
    empowerSpellBonusLines({ FireWall: { manaCostPercent: 15 } }),
    ["−15% Fire Wall mana cost"],
  );
  assert.deepEqual(
    empowerSpellBonusLines({ Healing: { healingPercent: 10 } }),
    ["+10% Healing healing"],
  );
});

test("empowerSpellBonusTooltipRows: formats spell bonus stat rows", () => {
  assert.deepEqual(
    empowerSpellBonusTooltipRows({ FlameDisruptor: { damagePercent: 25 } }),
    [{ label: "Flame Disruptor", value: "+25% damage" }],
  );
});

test("empowerItemBonusLines: combines flat and spell empower bonuses", () => {
  const lines = empowerItemBonusLines(
    { accuracy: 2 },
    { FlameDisruptor: { damagePercent: 15 } },
  );
  assert.ok(lines.includes("+2 Acc"));
  assert.ok(lines.includes("+15% Flame Disruptor damage"));
});

test("formatEmpowerRollDescription: formats stat and spell rolls", () => {
  assert.equal(
    formatEmpowerRollDescription({ key: "dc", range: true, index: 1, min: 1, max: 5 }),
    "+1–5 DC",
  );
  assert.equal(
    formatEmpowerRollDescription(MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS[0]),
    "Increase Flame Disruptor damage by 10–35%",
  );
  assert.equal(
    formatEmpowerRollDescription(MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:FireWall:mana")),
    "Reduce mana cost of Fire Wall by 10–40%",
  );
  assert.equal(
    formatEmpowerRollDescription(SC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.find((row) => row.key === "spell:SummonSkeleton:damage")),
    "Increase Skeleton damage by 10–50%",
  );
  assert.equal(
    formatEmpowerRollDescription(WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS.find((row) => row.key === "skill:Slaying:damage")),
    "Increase Slaying damage by 5–35%",
  );
  assert.equal(
    formatEmpowerRollDescription(WARRIOR_WEAPON_SKILL_EMPOWER_ROLL_DEFS.find((row) => row.key === "skill:FlamingSword:cooldown")),
    "Reduce Flaming Sword cooldown by 1–5 seconds",
  );
});

test("empowerRollDescriptionsForItem: warrior weapon includes skill rolls", () => {
  const lines = empowerRollDescriptionsForItem(WARRIOR_WEAPON);
  assert.ok(lines.includes("Increase Slaying damage by 5–35%"));
  assert.ok(lines.includes("Reduce Flaming Sword cooldown by 1–5 seconds"));
  assert.ok(lines.includes("+1–5 DC"));
  assert.equal(lines.includes("Increase Healing healing by 5–25%"), false);
});

test("empowerRollDescriptionsForItem: tao weapon includes spell rolls", () => {
  const lines = empowerRollDescriptionsForItem(TAO_WEAPON);
  assert.ok(lines.includes("Increase Healing healing by 5–25%"));
  assert.ok(lines.includes("Increase Skeleton damage by 10–50%"));
  assert.ok(lines.includes("+1–3 SC"));
  assert.equal(lines.includes("+1–3 MC"), false);
});

test("empowerRollDescriptionsForItem: wizard weapon includes spell rolls", () => {
  const lines = empowerRollDescriptionsForItem(WIZARD_WEAPON);
  assert.ok(lines.includes("Increase Flame Disruptor damage by 10–35%"));
  assert.ok(lines.includes("Increase Fire Wall damage by 5–25%"));
  assert.ok(lines.includes("Reduce mana cost of Fire Wall by 10–40%"));
  assert.ok(lines.includes("+1–3 MC"));
  assert.equal(lines.includes("+1–5 DC"), false);
});

test("empowerReferenceCatalog: exposes weapon classes and tier weights", () => {
  const catalog = empowerReferenceCatalog();
  assert.equal(catalog.itemChancePercent, 20);
  assert.equal(catalog.tierWeights.length, 4);
  assert.ok(Array.isArray(catalog.weaponRules) && catalog.weaponRules.length >= 4);
  assert.equal(catalog.weaponClasses.length, 4);
  const warrior = catalog.weaponClasses.find((row) => row.id === "warrior");
  const wizard = catalog.weaponClasses.find((row) => row.id === "wizard");
  const tao = catalog.weaponClasses.find((row) => row.id === "tao");
  assert.ok(warrior.rolls.includes("+1–5 DC"));
  assert.ok(warrior.rolls.includes("+1–3 Acc"));
  assert.ok(warrior.rolls.includes("Increase Slaying damage by 5–35%"));
  assert.ok(warrior.rolls.includes("Reduce Flaming Sword cooldown by 1–5 seconds"));
  assert.ok(wizard.rolls.includes("+1–3 MC"));
  assert.ok(wizard.rolls.includes("Increase Flame Disruptor damage by 10–35%"));
  assert.ok(wizard.rolls.includes("Reduce mana cost of Fire Wall by 10–40%"));
  assert.ok(tao.rolls.includes("+1–3 SC"));
  assert.ok(tao.rolls.includes("Increase Healing healing by 5–25%"));
  assert.ok(tao.rolls.includes("Increase Skeleton damage by 10–50%"));
  assert.equal(wizard.rolls.includes("+1–3 Acc"), false);
  assert.deepEqual(
    weaponEmpowerRollDescriptionsForClass("wizard"),
    wizard.rolls,
  );
});
