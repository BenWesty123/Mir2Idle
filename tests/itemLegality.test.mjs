import assert from "node:assert/strict";
import test from "node:test";

import {
  ITEM_RULES,
  integrityFingerprint,
  validateEquipmentPayload,
} from "../tools/stats-worker/itemLegality.js";

function emptyStats() {
  return {
    dc: [0, 0], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0],
    hp: 0, mp: 0, accuracy: 0, agility: 0, luck: 0, attackSpeed: 0,
    poisonAttack: 0, freezing: 0, magicResist: 0, poisonResist: 0,
    healthRecovery: 0, poisonRecovery: 0, strong: 0, xpBonusPercent: 0,
  };
}

function entry(itemId, overrides = {}) {
  return {
    itemId,
    smithLevel: 0,
    weaponRefineLevel: 0,
    gemCount: 0,
    empowered: false,
    empowerTier: 0,
    bonusStats: emptyStats(),
    smithBonusStats: emptyStats(),
    empowerBonusStats: emptyStats(),
    empowerSpellBonuses: {},
    ...overrides,
  };
}

const weaponId = Object.keys(ITEM_RULES).find((id) => ITEM_RULES[id].slots.includes("weapon"));
const armourId = Object.keys(ITEM_RULES).find((id) => ITEM_RULES[id].slots.includes("armour"));

function validate(slotId, itemEntry) {
  return validateEquipmentPayload([{ characterClass: "Warrior", equipment: { [slotId]: itemEntry } }]);
}

test("accepts an unmodified legal item", () => {
  assert.equal(validate("weapon", entry(weaponId)).valid, true);
});

test("accepts legal Benediction Luck and cursed Luck on weapons", () => {
  for (const luck of [-10, 7]) {
    const bonusStats = emptyStats();
    bonusStats.luck = luck;
    assert.equal(validate("weapon", entry(weaponId, { bonusStats })).valid, true);
  }
});

test("rejects weapon Luck outside Benediction limits", () => {
  for (const luck of [-11, 8]) {
    const bonusStats = emptyStats();
    bonusStats.luck = luck;
    const result = validate("weapon", entry(weaponId, { bonusStats }));
    assert.ok(result.violations.some((row) => row.code === "benediction_luck"));
  }
});

test("does not count Benediction Luck as a gem or refinement bonus", () => {
  const bonusStats = emptyStats();
  bonusStats.luck = 7;
  const result = validate("weapon", entry(weaponId, {
    bonusStats,
    weaponRefineLevel: 1,
  }));
  assert.ok(result.violations.some((row) => row.code === "refine_total"));
});

test("still rejects negative non-Benediction bonuses", () => {
  const bonusStats = emptyStats();
  bonusStats.ac[1] = -1;
  const result = validate("armour", entry(armourId, { bonusStats }));
  assert.ok(result.violations.some((row) => row.code === "upgrade_negative"));
});

test("rejects unknown items and wrong equipment slots", () => {
  assert.equal(validate("weapon", entry("invented-sword")).violations[0].code, "unknown_item");
  assert.ok(validate("ringL", entry(armourId)).violations.some((row) => row.code === "wrong_slot"));
});

test("rejects impossible smith and refinement state", () => {
  const smithStats = emptyStats();
  smithStats.dc[1] = 20;
  const result = validate("weapon", entry(weaponId, {
    smithLevel: 20,
    smithBonusStats: smithStats,
    weaponRefineLevel: 99,
  }));
  assert.ok(result.violations.some((row) => row.code === "smith_level"));
  assert.ok(result.violations.some((row) => row.code === "refine_level"));
});

test("rejects empowerment rolls that are not legal for the item", () => {
  const empowerStats = emptyStats();
  empowerStats.attackSpeed = 999;
  const result = validate("armour", entry(armourId, {
    empowered: true,
    empowerTier: 1,
    empowerBonusStats: empowerStats,
  }));
  assert.ok(result.violations.some((row) => row.code === "empower_stat"));
});

test("accepts empowerments swapped in from another item (crafting cube)", () => {
  // Accuracy is a weapon empower roll; the armour's own table does not include it,
  // but the empowerment swap can legally move it onto the armour.
  const accuracyRoll = ITEM_RULES[weaponId].empower.rolls.find((r) => r.type === "stat" && r.key === "accuracy");
  assert.ok(accuracyRoll, "expected weapon to roll accuracy");
  const armourHasAccuracy = ITEM_RULES[armourId].empower.rolls.some((r) => r.type === "stat" && r.key === "accuracy");
  assert.equal(armourHasAccuracy, false, "armour should not natively roll accuracy");

  const empowerStats = emptyStats();
  empowerStats.accuracy = accuracyRoll.max;
  const result = validate("armour", entry(armourId, {
    empowered: true,
    empowerTier: 1,
    empowerBonusStats: empowerStats,
  }));
  assert.equal(result.valid, true, JSON.stringify(result.violations));
});

test("still rejects Luck swapped onto a non-weapon slot", () => {
  const luckRoll = ITEM_RULES[weaponId].empower.rolls.find((r) => r.type === "stat" && r.key === "luck");
  assert.ok(luckRoll, "expected weapon to roll luck empower");
  const empowerStats = emptyStats();
  empowerStats.luck = luckRoll.max;
  const result = validate("armour", entry(armourId, {
    empowered: true,
    empowerTier: 1,
    empowerBonusStats: empowerStats,
  }));
  assert.ok(result.violations.some((row) => row.code === "empower_stat"));
});

test("integrity fingerprints are deterministic", () => {
  const result = validate("weapon", entry("invented-sword"));
  assert.equal(integrityFingerprint(result), integrityFingerprint(result));
});
