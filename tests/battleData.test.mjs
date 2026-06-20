import test from "node:test";
import assert from "node:assert/strict";
import {
  CRYSTAL_MAX_LEVEL,
  PLAYER_TEMPLATE,
  crystalExperienceForLevel,
  crystalAdjustedExperience,
  crystalPlayerBaseStats,
  statRange,
  formatStatRange,
  rollStat,
  rollDamage,
  attackDelayMs,
  twinDrakeAttackDelayMs,
  randomInt,
  cloneStats,
  addStats,
  addRange,
  sanitizeItemBonusStats,
} from "../src/battleData.js";

test("crystalExperienceForLevel: known values and clamping", () => {
  assert.equal(crystalExperienceForLevel(1), 25); // round(100 * 0.25)
  assert.equal(crystalExperienceForLevel(10), 1500); // round(6000 * 0.25)
  // levels < 1 clamp to level 1
  assert.equal(crystalExperienceForLevel(0), crystalExperienceForLevel(1));
  assert.equal(crystalExperienceForLevel(-5), crystalExperienceForLevel(1));
  // max level is an infinite (unreachable) requirement
  assert.equal(crystalExperienceForLevel(CRYSTAL_MAX_LEVEL), Infinity);
});

test("crystalExperienceForLevel: strictly increasing across the curve", () => {
  for (let level = 1; level < 120; level += 1) {
    assert.ok(
      crystalExperienceForLevel(level + 1) > crystalExperienceForLevel(level),
      `level ${level + 1} should require more xp than level ${level}`,
    );
  }
});

test("crystalAdjustedExperience: reductions, floor and rate", () => {
  // no reduction while player is within 10 levels of the monster
  assert.equal(crystalAdjustedExperience(100, 5, 50), 100);
  // expRate multiplies the result
  assert.equal(crystalAdjustedExperience(100, 5, 50, true, 2), 200);
  // far over-levelled: reduced but never below 1
  assert.equal(crystalAdjustedExperience(1, 200, 1), 1);
  assert.ok(crystalAdjustedExperience(100, 70, 50) < 100);
});

test("statRange / formatStatRange", () => {
  assert.deepEqual(statRange(5), [0, 5]);
  assert.deepEqual(statRange([3, 7]), [3, 7]);
  assert.deepEqual(statRange(undefined), [0, 0]);
  assert.deepEqual(statRange("4"), [0, 4]);
  assert.equal(formatStatRange([3, 7]), "3-7");
  assert.equal(formatStatRange(5), "0-5");
});

test("rollStat: stays in range and luck bias is deterministic at the extremes", () => {
  for (let i = 0; i < 200; i += 1) {
    const value = rollStat([5, 10]);
    assert.ok(value >= 5 && value <= 10);
  }
  // max luck always rolls the maximum; min luck always rolls the minimum
  for (let i = 0; i < 50; i += 1) {
    assert.equal(rollStat([5, 10], 10), 10);
    assert.equal(rollStat([5, 10], -10), 5);
  }
  // degenerate ranges return the single value
  assert.equal(rollStat(0), 0);
  assert.equal(rollStat([3, 3]), 3);
});

test("rollDamage: never negative and bounded by attack max", () => {
  for (let i = 0; i < 200; i += 1) {
    const dmg = rollDamage([2, 8], [0, 3]);
    assert.ok(dmg >= 0 && dmg <= 8);
  }
  // attacker with max luck vs zero defence deals exactly its max
  assert.equal(rollDamage([5, 10], [0, 0], 10), 10);
  assert.equal(rollDamage(0, 0), 0);
});

test("attackDelayMs: 550ms floor and 370ms level-bonus cap", () => {
  assert.equal(attackDelayMs(0, 0), 1400);
  assert.equal(attackDelayMs(20, 0), 550); // would be 200, floored to 550
  assert.equal(attackDelayMs(0, 100), 1030); // level bonus 370
  assert.equal(attackDelayMs(0, 1000), 1030); // level bonus capped at 370
});

test("twinDrakeAttackDelayMs: base minus 120, floored at 300", () => {
  assert.equal(twinDrakeAttackDelayMs(0, 0), 1280);
  assert.equal(twinDrakeAttackDelayMs(20, 0), 430);
});

test("crystalPlayerBaseStats: shape and Warrior level-1 vitals", () => {
  const stats = crystalPlayerBaseStats("Warrior", 1);
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    assert.ok(Array.isArray(stats[key]) && stats[key].length === 2, `${key} is a [min,max] pair`);
  }
  assert.equal(stats.maxHp, 18);
  assert.equal(stats.maxMp, 14);
  assert.equal(stats.luck, 1);
  // unknown class falls back to Warrior rather than throwing
  assert.deepEqual(crystalPlayerBaseStats("Nope", 1), crystalPlayerBaseStats("Warrior", 1));
});

test("PLAYER_TEMPLATE is a level-1 Warrior", () => {
  assert.equal(PLAYER_TEMPLATE.class, "Warrior");
  assert.equal(PLAYER_TEMPLATE.level, 1);
});

test("randomInt stays within the inclusive range", () => {
  for (let i = 0; i < 200; i += 1) {
    const value = randomInt(3, 6);
    assert.ok(value >= 3 && value <= 6 && Number.isInteger(value));
  }
});

test("cloneStats normalises hp/mp aliases and deep-copies ranges", () => {
  const source = { hp: 100, mp: 40, dc: [2, 5] };
  const cloned = cloneStats(source);
  assert.equal(cloned.maxHp, 100);
  assert.equal(cloned.maxMp, 40);
  assert.deepEqual(cloned.dc, [2, 5]);
  // missing fields default to 0 / [0,0]
  assert.deepEqual(cloned.mc, [0, 0]);
  assert.equal(cloned.strong, 0);
  // ranges are copies, not shared references
  cloned.dc[0] = 99;
  assert.deepEqual(source.dc, [2, 5]);
  // maxHp/maxMp take precedence over hp/mp aliases when both are present
  assert.equal(cloneStats({ maxHp: 7, hp: 3 }).maxHp, 7);
});

test("addRange adds paired values and ignores non-arrays", () => {
  const target = [1, 2];
  addRange(target, [3, 4]);
  assert.deepEqual(target, [4, 6]);
  // non-array operands are a no-op (no throw)
  const safe = [5, 5];
  addRange(safe, undefined);
  assert.deepEqual(safe, [5, 5]);
  addRange(null, [1, 1]);
});

test("addStats accumulates ranges and scalar fields", () => {
  const target = cloneStats({ dc: [1, 2], hp: 10 });
  addStats(target, { dc: [3, 4], hp: 5, accuracy: 2, strong: 1 });
  assert.deepEqual(target.dc, [4, 6]);
  assert.equal(target.maxHp, 15);
  assert.equal(target.accuracy, 2);
  assert.equal(target.strong, 1);
  // missing source fields contribute 0
  const base = cloneStats({ mc: [2, 2] });
  addStats(base, { mc: [1, 1] });
  assert.deepEqual(base.mc, [3, 3]);
});

test("sanitizeItemBonusStats coerces to a complete, truncated stat shape", () => {
  const result = sanitizeItemBonusStats({ dc: ["3.9", 5.7], hp: "12.8", bogus: 1 });
  assert.deepEqual(result.dc, [3, 5]);
  assert.equal(result.hp, 12);
  // every expected key is present and defaulted
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    assert.ok(Array.isArray(result[key]) && result[key].length === 2);
  }
  for (const key of ["mp", "accuracy", "agility", "luck", "attackSpeed", "poisonAttack", "freezing", "magicResist", "poisonResist", "healthRecovery", "poisonRecovery", "strong"]) {
    assert.equal(typeof result[key], "number");
  }
  // unknown keys are dropped; garbage input yields a zeroed shape
  assert.equal(result.bogus, undefined);
  const empty = sanitizeItemBonusStats(undefined);
  assert.deepEqual(empty.dc, [0, 0]);
  assert.equal(empty.strong, 0);
});
