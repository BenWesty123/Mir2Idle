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
  applyEmpowerRollToStats,
  applyEmpowerSpellRoll,
  applyEquippedSpellDamageBonus,
  applyEquippedSpellCooldownReductionMs,
  applyEquippedSpellHealingBonus,
  applyEquippedSpellMpCostReduction,
  empowerBonusStatLines,
  empowerCandidateRolls,
  empowerReferenceCatalog,
  empowerRollDescriptionsForItem,
  formatEmpowerRollDescription,
  empowerItemBonusLines,
  empowerSpellBonusLines,
  empowerSpellBonusTooltipRows,
  empoweredItemStarSuffix,
  empoweredStatLabel,
  equippedSpellCooldownReductionSeconds,
  equippedSpellDamageBonusPercent,
  equippedSpellHealingBonusPercent,
  equippedSpellManaCostReductionPercent,
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
  assert.equal(rolls.length, ARMOUR_EMPOWER_ROLL_DEFS.length);
  assert.deepEqual(rolls.map((roll) => roll.key), ARMOUR_EMPOWER_ROLL_DEFS.map((roll) => roll.key));
  assert.deepEqual(rolls.find((roll) => roll.key === "hp"), { key: "hp", range: false, min: 10, max: 100, step: 10 });
  assert.deepEqual(rolls.find((roll) => roll.key === "xpBonusPercent"), { key: "xpBonusPercent", range: false, min: 5, max: 20, step: 5 });
});

test("empowerCandidateRolls: helmets use fixed helmet stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "helmet", stats: {} });
  assert.equal(rolls.length, HELMET_EMPOWER_ROLL_DEFS.length);
  assert.deepEqual(rolls.map((roll) => roll.key), HELMET_EMPOWER_ROLL_DEFS.map((roll) => roll.key));
  assert.deepEqual(rolls.find((roll) => roll.key === "ac"), { key: "ac", range: true, index: 1, min: 1, max: 3 });
  assert.deepEqual(rolls.find((roll) => roll.key === "hp"), { key: "hp", range: false, min: 10, max: 20, step: 10 });
});

test("empowerCandidateRolls: bracelets use fixed bracelet stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "bracelet", stats: {} });
  assert.equal(rolls.length, BRACELET_EMPOWER_ROLL_DEFS.length);
  assert.deepEqual(rolls.map((roll) => roll.key), BRACELET_EMPOWER_ROLL_DEFS.map((roll) => roll.key));
  assert.deepEqual(rolls.find((roll) => roll.key === "dc"), { key: "dc", range: true, index: 1, min: 1, max: 4 });
  assert.deepEqual(rolls.find((roll) => roll.key === "poisonResist"), { key: "poisonResist", range: false, min: 1, max: 1 });
  assert.deepEqual(rolls.find((roll) => roll.key === "magicResist"), { key: "magicResist", range: false, min: 1, max: 1 });
});

test("empowerCandidateRolls: rings use fixed ring stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "ring", stats: {} });
  assert.equal(rolls.length, RING_EMPOWER_ROLL_DEFS.length);
  assert.deepEqual(rolls.map((roll) => roll.key), RING_EMPOWER_ROLL_DEFS.map((roll) => roll.key));
  assert.deepEqual(rolls.find((roll) => roll.key === "dc"), { key: "dc", range: true, index: 1, min: 1, max: 6 });
  assert.deepEqual(rolls.find((roll) => roll.key === "attackSpeed"), { key: "attackSpeed", range: false, min: 1, max: 2 });
  assert.deepEqual(rolls.find((roll) => roll.key === "poisonAttack"), { key: "poisonAttack", range: false, min: 1, max: 2 });
});

test("empowerCandidateRolls: belts and boots share belt/boot stat table", () => {
  for (const slot of ["belt", "boots"]) {
    const rolls = empowerCandidateRolls({ slot, stats: {} });
    assert.equal(rolls.length, BELT_BOOT_EMPOWER_ROLL_DEFS.length);
    assert.deepEqual(rolls.map((roll) => roll.key), BELT_BOOT_EMPOWER_ROLL_DEFS.map((roll) => roll.key));
    assert.deepEqual(rolls.find((roll) => roll.key === "hp"), { key: "hp", range: false, min: 10, max: 30, step: 10 });
    assert.deepEqual(rolls.find((roll) => roll.key === "poisonResist"), { key: "poisonResist", range: false, min: 1, max: 1 });
  }
});

test("empowerCandidateRolls: stones use fixed stone stat table", () => {
  const rolls = empowerCandidateRolls({ slot: "stone", stats: {} });
  assert.equal(rolls.length, STONE_EMPOWER_ROLL_DEFS.length);
  assert.deepEqual(rolls.map((roll) => roll.key), STONE_EMPOWER_ROLL_DEFS.map((roll) => roll.key));
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

test("applyEmpowerRollToStats: armour bonus XP rolls 5-20% in steps of 5", () => {
  const stats = sanitizeItemBonusStats({});
  const xpRoll = ARMOUR_EMPOWER_ROLL_DEFS.find((roll) => roll.key === "xpBonusPercent");
  assert.equal(applyEmpowerRollToStats(stats, xpRoll, 1, () => 0), 5);
  assert.equal(applyEmpowerRollToStats(sanitizeItemBonusStats({}), xpRoll, 1, () => 0.999), 20);
});

test("empowerBonusStatLines: formats bonus XP as percent", () => {
  const lines = empowerBonusStatLines({ xpBonusPercent: 15 });
  assert.deepEqual(lines, ["+15% Bonus XP"]);
});

test("empowerCandidateRolls: all weapons include utility reward empowers", () => {
  for (const weapon of [WARRIOR_WEAPON, WIZARD_WEAPON, TAO_WEAPON, UNIVERSAL_WEAPON]) {
    const keys = empowerCandidateRolls(weapon).map((roll) => roll.key);
    assert.ok(keys.includes("goldBonusPercent"));
    assert.ok(keys.includes("xpBonusPercent"));
    assert.ok(keys.includes("dropChanceBonusPercent"));
    assert.ok(keys.includes("bonusAwakeningSoulChancePercent"));
  }
});

test("applyEmpowerRollToStats: weapon utility rolls use bounded tables", () => {
  const stats = sanitizeItemBonusStats({});
  const rng = () => 0;
  applyEmpowerRollToStats(stats, { key: "goldBonusPercent", range: false, min: 5, max: 25, step: 5 }, 1, rng);
  assert.equal(stats.goldBonusPercent, 5);
  applyEmpowerRollToStats(stats, { key: "xpBonusPercent", range: false, min: 1, max: 5, step: 1 }, 1, rng);
  assert.equal(stats.xpBonusPercent, 1);
  applyEmpowerRollToStats(stats, { key: "dropChanceBonusPercent", range: false, min: 0.25, max: 2, step: 0.25 }, 1, rng);
  assert.equal(stats.dropChanceBonusPercent, 0.25);
  applyEmpowerRollToStats(stats, { key: "bonusAwakeningSoulChancePercent", range: false, min: 5, max: 25, step: 5 }, 1, rng);
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
  assert.equal(rolls.filter((roll) => roll.spellId).length, MC_WEAPON_SPELL_EMPOWER_ROLL_DEFS.length);
});

test("empowerCandidateRolls: warrior weapons include warrior skill empower rolls", () => {
  const rolls = empowerCandidateRolls(WARRIOR_WEAPON);
  assert.ok(rolls.some((roll) => roll.spellId === "Slaying" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FlamingSword" && roll.kind === "damagePercent"));
  assert.ok(rolls.some((roll) => roll.spellId === "FlamingSword" && roll.kind === "cooldownReductionSeconds"));
  assert.ok(rolls.some((roll) => roll.spellId === "TwinDrakeBlade" && roll.kind === "damagePercent"));
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

test("empowerCandidateRolls: MC non-weapons exclude Flame Disruptor spell roll", () => {
  const rolls = empowerCandidateRolls(MC_RING);
  assert.equal(rolls.some((roll) => roll.spellId === "FlameDisruptor"), false);
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
  assert.equal(catalog.itemChancePercent, 10);
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
