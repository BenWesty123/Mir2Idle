import test from "node:test";
import assert from "node:assert/strict";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
  CRYSTAL_TAOIST_SPELLS,
  warriorSpellById,
  taoistSpellById,
  spellMpCost,
  spellDelayMs,
  crystalSpellCastCooldownMs,
  spellLevelRequirement,
  spellExperienceTarget,
  thunderBoltUndeadMultiplier,
} from "../src/warriorMagic.js";

test("spell lists are non-empty and every spell has id + label", () => {
  for (const list of [CRYSTAL_WARRIOR_SPELLS, CRYSTAL_WIZARD_SPELLS, CRYSTAL_TAOIST_SPELLS]) {
    assert.ok(Array.isArray(list) && list.length > 0);
    for (const spell of list) {
      assert.equal(typeof spell.id, "string");
      assert.equal(typeof spell.label, "string");
    }
  }
});

test("spell id lookups", () => {
  assert.equal(warriorSpellById("Fencing")?.id, "Fencing");
  assert.equal(warriorSpellById("None"), BASIC_ATTACK_SKILL);
  assert.equal(warriorSpellById("does-not-exist"), null);
  assert.equal(taoistSpellById("Healing")?.id, "Healing");
  assert.equal(taoistSpellById("does-not-exist"), null);
});

test("spellMpCost scales with learned level and is 0 for basic attack", () => {
  assert.equal(spellMpCost(BASIC_ATTACK_SKILL), 0);
  assert.equal(spellMpCost(null), 0);
  assert.equal(spellMpCost({ id: "X", baseCost: 10, levelCost: 2 }, { level: 3 }), 16);
  assert.equal(spellMpCost({ id: "X", baseCost: 10, levelCost: 2 }, { level: 0 }), 10);
});

test("spellDelayMs honours autoCooldown, reduction and floors at 0", () => {
  assert.equal(spellDelayMs(BASIC_ATTACK_SKILL), 0);
  assert.equal(spellDelayMs({ id: "X", delayBase: 1000, delayReduction: 100 }, { level: 3 }), 700);
  assert.equal(spellDelayMs({ id: "X", delayBase: 100, delayReduction: 100 }, { level: 5 }), 0);
  assert.equal(spellDelayMs({ id: "X", autoCooldownMs: 2500 }, { level: 9 }), 2500);
});

test("crystalSpellCastCooldownMs respects the 1800ms global lock", () => {
  assert.equal(crystalSpellCastCooldownMs({ id: "X", delayBase: 500, delayReduction: 0 }, { level: 0 }), 1800);
  assert.equal(crystalSpellCastCooldownMs({ id: "X", delayBase: 3000, delayReduction: 0 }, { level: 0 }), 3000);
});

test("spell level/experience targets by learned level", () => {
  const spell = { level1: 7, level2: 9, level3: 11, need1: 5, need2: 10, need3: 20 };
  assert.equal(spellLevelRequirement(spell, 0), 7);
  assert.equal(spellLevelRequirement(spell, 1), 9);
  assert.equal(spellLevelRequirement(spell, 3), 0); // maxed
  assert.equal(spellExperienceTarget(spell, 0), 5);
  assert.equal(spellExperienceTarget(spell, 2), 20);
  assert.equal(spellExperienceTarget(spell, 3), 0); // maxed
});

test("thunderBoltUndeadMultiplier scales by skill level with L0 unchanged", () => {
  assert.equal(thunderBoltUndeadMultiplier(0), 1.5);
  assert.equal(thunderBoltUndeadMultiplier(1), 1.5);
  assert.equal(thunderBoltUndeadMultiplier(2), 1.8);
  assert.equal(thunderBoltUndeadMultiplier(3), 2.35);
  assert.equal(thunderBoltUndeadMultiplier(99), 2.35);
  assert.equal(thunderBoltUndeadMultiplier(-1), 1.5);
});
