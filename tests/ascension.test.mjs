import test from "node:test";
import assert from "node:assert/strict";
import {
  ascensionTierOf,
  sanitizeAscensionTiers,
  ascensionPointsSpentFor,
  ascensionPointsAvailable,
  canBuyAscensionTier,
  buyAscensionTier,
  refundAscensionTier,
  ascensionNextTierCost,
  ASCENSION_SALVAGE_CHANCE_STEP,
  ascensionSalvageExtraChancePercent,
  rollAscensionSalvageExtras,
  applyAscensionSalvageBonus,
  previewAscensionSalvageBonus,
  WORLD_DIFFICULTY_DEFS,
  WORLD_DIFFICULTY_DEFAULT,
  sanitizeWorldDifficulty,
  worldDifficultyMultiplier,
  sanitizeAscensionClearTimes,
  recordAscensionClearTime,
  mergeAscensionBestClearTimes,
  backfillStandardJourneyPayout,
} from "../src/core/ascension.js";

// plain / empowered / ascended / awakened
const TIERS = 4;

// Mirrors the shape of ASCENSION_UPGRADE_DEFS: a tiered upgrade, a one-off
// unlock, and an uncapped one (Soul Exchange has maxTier null).
const DEFS = [
  { id: "xp", costPerTier: 1, maxTier: 5 },
  { id: "skills", costPerTier: 4, maxTier: 1 },
  { id: "souls", costPerTier: 3, maxTier: null },
  { id: "later", costPerTier: 3, maxTier: 1, planned: true },
];

test("ascensionPointsSpentFor: sums tier times cost across upgrades", () => {
  assert.equal(ascensionPointsSpentFor({}, DEFS), 0);
  assert.equal(ascensionPointsSpentFor({ xp: 5 }, DEFS), 5);
  assert.equal(ascensionPointsSpentFor({ xp: 2, skills: 1, souls: 3 }, DEFS), 2 + 4 + 9);
});

test("ascensionPointsSpentFor: ignores tiers for ids that are not defined", () => {
  assert.equal(ascensionPointsSpentFor({ xp: 1, mystery: 99 }, DEFS), 1);
});

test("ascensionPointsAvailable: never reports a negative balance", () => {
  assert.equal(ascensionPointsAvailable({ xp: 3 }, DEFS, 5), 2);
  assert.equal(ascensionPointsAvailable({ souls: 4 }, DEFS, 5), 0);
});

test("sanitizeAscensionTiers: drops unknown ids and clamps to each cap", () => {
  assert.deepEqual(sanitizeAscensionTiers({ xp: 99, skills: 7, mystery: 1 }, DEFS), {
    xp: 5,
    skills: 1,
  });
});

test("sanitizeAscensionTiers: leaves an uncapped upgrade alone and drops zeroes", () => {
  assert.deepEqual(sanitizeAscensionTiers({ souls: 40, xp: 0 }, DEFS), { souls: 40 });
});

test("sanitizeAscensionTiers: survives junk input", () => {
  assert.deepEqual(sanitizeAscensionTiers(null, DEFS), {});
  assert.deepEqual(sanitizeAscensionTiers({ xp: "3" }, DEFS), { xp: 3 });
  assert.deepEqual(sanitizeAscensionTiers({ xp: -2 }, DEFS), {});
});

test("canBuyAscensionTier: refuses an unknown upgrade", () => {
  assert.equal(canBuyAscensionTier({}, DEFS, "nope", 100).reason, "unknown");
});

test("canBuyAscensionTier: refuses an upgrade whose effect is not wired yet", () => {
  const result = canBuyAscensionTier({}, DEFS, "later", 100);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "planned");
  assert.equal(buyAscensionTier({}, DEFS, "later", 100), null);
});

test("canBuyAscensionTier: refuses a maxed upgrade even with points to spare", () => {
  const result = canBuyAscensionTier({ skills: 1 }, DEFS, "skills", 100);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "maxed");
});

test("canBuyAscensionTier: reports how many points are missing", () => {
  const result = canBuyAscensionTier({}, DEFS, "skills", 1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "points");
  assert.equal(result.cost, 4);
  assert.equal(result.shortBy, 3);
});

test("canBuyAscensionTier: counts points already committed to other upgrades", () => {
  // 5 earned, 4 sunk into skills, so the 1-point upgrade is the only one left.
  assert.equal(canBuyAscensionTier({ skills: 1 }, DEFS, "xp", 5).ok, true);
  assert.equal(canBuyAscensionTier({ skills: 1, xp: 1 }, DEFS, "xp", 5).ok, false);
});

test("buyAscensionTier: steps a tier up and leaves the input untouched", () => {
  const tiers = { xp: 1 };
  assert.deepEqual(buyAscensionTier(tiers, DEFS, "xp", 5), { xp: 2 });
  assert.deepEqual(tiers, { xp: 1 });
});

test("buyAscensionTier: returns null rather than overspending or exceeding a cap", () => {
  assert.equal(buyAscensionTier({}, DEFS, "skills", 3), null);
  assert.equal(buyAscensionTier({ skills: 1 }, DEFS, "skills", 100), null);
  assert.equal(buyAscensionTier({}, DEFS, "nope", 100), null);
});

test("buyAscensionTier: an uncapped upgrade keeps going while points last", () => {
  let tiers = {};
  for (let i = 0; i < 4; i += 1) tiers = buyAscensionTier(tiers, DEFS, "souls", 12);
  assert.deepEqual(tiers, { souls: 4 });
  assert.equal(buyAscensionTier(tiers, DEFS, "souls", 12), null);
});

test("buyAscensionTier: spends every point of a full 11-point journey", () => {
  let tiers = {};
  for (let i = 0; i < 5; i += 1) tiers = buyAscensionTier(tiers, DEFS, "xp", 11);
  tiers = buyAscensionTier(tiers, DEFS, "skills", 11);
  assert.deepEqual(tiers, { xp: 5, skills: 1 });
  assert.equal(ascensionPointsAvailable(tiers, DEFS, 11), 2);
});

test("refundAscensionTier: steps down, and clears the key at zero", () => {
  assert.deepEqual(refundAscensionTier({ xp: 3 }, DEFS, "xp"), { xp: 2 });
  assert.deepEqual(refundAscensionTier({ xp: 1 }, DEFS, "xp"), {});
});

test("refundAscensionTier: returns null when there is nothing to give back", () => {
  assert.equal(refundAscensionTier({}, DEFS, "xp"), null);
  assert.equal(refundAscensionTier({ xp: 1 }, DEFS, "nope"), null);
});

test("refundAscensionTier: a buy then a refund returns the points", () => {
  const bought = buyAscensionTier({}, DEFS, "skills", 4);
  assert.equal(ascensionPointsAvailable(bought, DEFS, 4), 0);
  const refunded = refundAscensionTier(bought, DEFS, "skills");
  assert.equal(ascensionPointsAvailable(refunded, DEFS, 4), 4);
  assert.equal(ascensionTierOf(refunded, "skills"), 0);
});

test("sanitizeAscensionClearTimes: keeps positive times for known tiers only", () => {
  assert.deepEqual(sanitizeAscensionClearTimes({ 0: 500, 3: 20 }, TIERS), { 0: 500, 3: 20 });
  assert.deepEqual(sanitizeAscensionClearTimes({ "1": 42 }, TIERS), { 1: 42 });
  assert.deepEqual(sanitizeAscensionClearTimes({ 4: 999, 9: 1 }, TIERS), {});
  assert.deepEqual(sanitizeAscensionClearTimes(null, TIERS), {});
});

test("sanitizeAscensionClearTimes: drops zero and negative, which mean never cleared", () => {
  assert.deepEqual(sanitizeAscensionClearTimes({ 0: 0, 1: -5, 2: 10 }, TIERS), { 2: 10 });
});

test("recordAscensionClearTime: stores the first clear at a tier", () => {
  assert.deepEqual(recordAscensionClearTime({}, 0, 1000, TIERS), { 0: 1000 });
  assert.deepEqual(recordAscensionClearTime({ 0: 1000 }, 2, 50, TIERS), { 0: 1000, 2: 50 });
});

test("recordAscensionClearTime: a later kill at the same tier does not overwrite the first", () => {
  assert.deepEqual(recordAscensionClearTime({ 0: 1000 }, 0, 9000, TIERS), { 0: 1000 });
  // Even a faster one: the record is when he FIRST fell, not the best attempt.
  assert.deepEqual(recordAscensionClearTime({ 0: 1000 }, 0, 5, TIERS), { 0: 1000 });
});

test("recordAscensionClearTime: refuses out-of-range tiers and non-times", () => {
  assert.deepEqual(recordAscensionClearTime({}, 4, 1000, TIERS), {});
  assert.deepEqual(recordAscensionClearTime({}, -1, 1000, TIERS), {});
  assert.deepEqual(recordAscensionClearTime({}, 0, 0, TIERS), {});
});

test("mergeAscensionBestClearTimes: keeps the fastest per tier", () => {
  assert.deepEqual(mergeAscensionBestClearTimes({ 0: 900 }, { 0: 400 }, TIERS), { 0: 400 });
  assert.deepEqual(mergeAscensionBestClearTimes({ 0: 300 }, { 0: 800 }, TIERS), { 0: 300 });
});

test("mergeAscensionBestClearTimes: adds tiers the bests have never seen", () => {
  assert.deepEqual(mergeAscensionBestClearTimes({ 0: 300 }, { 2: 50 }, TIERS), { 0: 300, 2: 50 });
  assert.deepEqual(mergeAscensionBestClearTimes(null, { 1: 7 }, TIERS), { 1: 7 });
});

test("mergeAscensionBestClearTimes: an empty run leaves the bests untouched", () => {
  assert.deepEqual(mergeAscensionBestClearTimes({ 0: 300, 1: 20 }, {}, TIERS), { 0: 300, 1: 20 });
});

// Traveller's Supplies charges more for each tier, so cost is a schedule rather
// than one price repeated.
const SCHEDULE_DEFS = [
  { id: "shop", costByTier: [1, 2, 3, 4, 5], maxTier: 5 },
  { id: "flat", costPerTier: 2, maxTier: 3 },
];

test("ascensionPointsSpentFor: a cost schedule sums the tiers actually bought", () => {
  assert.equal(ascensionPointsSpentFor({ shop: 1 }, SCHEDULE_DEFS), 1);
  assert.equal(ascensionPointsSpentFor({ shop: 2 }, SCHEDULE_DEFS), 3);
  assert.equal(ascensionPointsSpentFor({ shop: 3 }, SCHEDULE_DEFS), 6);
  assert.equal(ascensionPointsSpentFor({ shop: 5 }, SCHEDULE_DEFS), 15);
});

test("ascensionNextTierCost: quotes the price of the tier about to be bought", () => {
  assert.equal(ascensionNextTierCost({}, SCHEDULE_DEFS, "shop"), 1);
  assert.equal(ascensionNextTierCost({ shop: 2 }, SCHEDULE_DEFS, "shop"), 3);
  assert.equal(ascensionNextTierCost({ shop: 4 }, SCHEDULE_DEFS, "shop"), 5);
  // Flat upgrades are unchanged by any of this.
  assert.equal(ascensionNextTierCost({ flat: 1 }, SCHEDULE_DEFS, "flat"), 2);
});

test("canBuyAscensionTier: affordability is judged against the NEXT tier's price", () => {
  // 2 points buys tier 1 (costs 1) but not tier 3 (costs 3).
  assert.equal(canBuyAscensionTier({}, SCHEDULE_DEFS, "shop", 2).ok, true);
  const atTwo = canBuyAscensionTier({ shop: 2 }, SCHEDULE_DEFS, "shop", 5);
  assert.equal(atTwo.ok, false, "3 spent of 5 leaves 2, and tier 3 costs 3");
  assert.equal(atTwo.cost, 3);
  assert.equal(atTwo.shortBy, 1);
  assert.equal(canBuyAscensionTier({ shop: 2 }, SCHEDULE_DEFS, "shop", 6).ok, true);
});

test("buyAscensionTier: walks the whole schedule when the points are there", () => {
  let tiers = {};
  for (let n = 1; n <= 5; n += 1) {
    tiers = buyAscensionTier(tiers, SCHEDULE_DEFS, "shop", 15);
    assert.equal(ascensionTierOf(tiers, "shop"), n);
  }
  assert.equal(ascensionPointsSpentFor(tiers, SCHEDULE_DEFS), 15);
  assert.equal(buyAscensionTier(tiers, SCHEDULE_DEFS, "shop", 15), null, "capped at 5 tiers");
});

test("buyAscensionTier: 14 points is one short of the full schedule", () => {
  let tiers = {};
  for (let n = 1; n <= 4; n += 1) tiers = buyAscensionTier(tiers, SCHEDULE_DEFS, "shop", 14);
  assert.equal(ascensionTierOf(tiers, "shop"), 4);
  assert.equal(buyAscensionTier(tiers, SCHEDULE_DEFS, "shop", 14), null);
});

test("refundAscensionTier: hands back the schedule price, not a flat one", () => {
  const tiers = refundAscensionTier({ shop: 3 }, SCHEDULE_DEFS, "shop");
  assert.equal(ascensionTierOf(tiers, "shop"), 2);
  assert.equal(ascensionPointsSpentFor(tiers, SCHEDULE_DEFS), 3);
});

// Havoc Surplus: the Nth tier costs N, with no last price to hold.
const EQUALS_TIER_DEFS = [
  { id: "surplus", costEqualsTier: true, maxTier: null },
];

test("costEqualsTier: the Nth tier costs N, and spend is triangular", () => {
  assert.equal(ascensionNextTierCost({}, EQUALS_TIER_DEFS, "surplus"), 1);
  assert.equal(ascensionNextTierCost({ surplus: 2 }, EQUALS_TIER_DEFS, "surplus"), 3);
  assert.equal(ascensionPointsSpentFor({ surplus: 1 }, EQUALS_TIER_DEFS), 1);
  assert.equal(ascensionPointsSpentFor({ surplus: 2 }, EQUALS_TIER_DEFS), 3);
  assert.equal(ascensionPointsSpentFor({ surplus: 3 }, EQUALS_TIER_DEFS), 6);
  assert.equal(ascensionPointsSpentFor({ surplus: 4 }, EQUALS_TIER_DEFS), 10);
});

test("costEqualsTier: keeps escalating past any finite schedule", () => {
  let tiers = {};
  for (let n = 1; n <= 6; n += 1) {
    tiers = buyAscensionTier(tiers, EQUALS_TIER_DEFS, "surplus", 21);
    assert.equal(ascensionTierOf(tiers, "surplus"), n);
  }
  assert.equal(ascensionPointsSpentFor(tiers, EQUALS_TIER_DEFS), 21);
  assert.equal(ascensionNextTierCost(tiers, EQUALS_TIER_DEFS, "surplus"), 7);
});

test("ascensionSalvageExtraChancePercent: 25% per tier, uncapped", () => {
  assert.equal(ASCENSION_SALVAGE_CHANCE_STEP, 25);
  assert.equal(ascensionSalvageExtraChancePercent(0), 0);
  assert.equal(ascensionSalvageExtraChancePercent(1), 25);
  assert.equal(ascensionSalvageExtraChancePercent(3), 75);
  assert.equal(ascensionSalvageExtraChancePercent(5), 125);
});

test("rollAscensionSalvageExtras: remainder is a chance, 100% is a guaranteed extra", () => {
  assert.equal(rollAscensionSalvageExtras(0, () => 0), 0);
  assert.equal(rollAscensionSalvageExtras(25, () => 0.249), 1);
  assert.equal(rollAscensionSalvageExtras(25, () => 0.25), 0);
  assert.equal(rollAscensionSalvageExtras(100, () => 0.99), 1);
  assert.equal(rollAscensionSalvageExtras(125, () => 0.249), 2);
  assert.equal(rollAscensionSalvageExtras(125, () => 0.25), 1);
});

test("applyAscensionSalvageBonus: a proc is another copy of the base, not +1", () => {
  assert.equal(applyAscensionSalvageBonus(3, 0, () => 0), 3);
  assert.equal(applyAscensionSalvageBonus(3, 25, () => 0), 6);
  assert.equal(applyAscensionSalvageBonus(3, 25, () => 0.9), 3);
  assert.equal(applyAscensionSalvageBonus(3, 125, () => 0), 9);
});

test("previewAscensionSalvageBonus: shows the range without rolling", () => {
  assert.deepEqual(previewAscensionSalvageBonus(3, 0), { min: 3, max: 3, remainder: 0 });
  assert.deepEqual(previewAscensionSalvageBonus(3, 25), { min: 3, max: 6, remainder: 25 });
  assert.deepEqual(previewAscensionSalvageBonus(3, 100), { min: 6, max: 6, remainder: 0 });
  assert.deepEqual(previewAscensionSalvageBonus(3, 125), { min: 6, max: 9, remainder: 25 });
});

test("worldDifficultyMultiplier: Normal through Impossible", () => {
  assert.equal(WORLD_DIFFICULTY_DEFS.length, 5);
  assert.equal(worldDifficultyMultiplier("normal"), 1);
  assert.equal(worldDifficultyMultiplier("hard"), 1.25);
  assert.equal(worldDifficultyMultiplier("extreme"), 1.5);
  assert.equal(worldDifficultyMultiplier("insane"), 1.75);
  assert.equal(worldDifficultyMultiplier("impossible"), 2);
  assert.equal(worldDifficultyMultiplier("mystery"), 1);
});

test("backfillStandardJourneyPayout: a pre-update kill pays the standard journey once", () => {
  const paid = backfillStandardJourneyPayout({
    runPointsAwarded: 0,
    pointsEarned: 0,
    runBestTier: -1,
    hasJourneyKill: true,
    standardPayout: 5,
  });
  assert.equal(paid.changed, true);
  assert.equal(paid.runPointsAwarded, 5);
  assert.equal(paid.pointsEarned, 5);
  assert.equal(paid.runBestTier, 0);

  const alreadyPaid = backfillStandardJourneyPayout({
    ...paid,
    hasJourneyKill: true,
    standardPayout: 5,
  });
  assert.equal(alreadyPaid.changed, false);
  assert.equal(alreadyPaid.pointsEarned, 5);

  const noKill = backfillStandardJourneyPayout({
    runPointsAwarded: 0,
    pointsEarned: 0,
    hasJourneyKill: false,
    standardPayout: 5,
  });
  assert.equal(noKill.changed, false);
  assert.equal(noKill.pointsEarned, 0);

  const keepBank = backfillStandardJourneyPayout({
    runPointsAwarded: 0,
    pointsEarned: 11,
    runBestTier: -1,
    hasJourneyKill: true,
    standardPayout: 5,
  });
  assert.equal(keepBank.changed, true);
  assert.equal(keepBank.pointsEarned, 11);
  assert.equal(keepBank.runPointsAwarded, 5);
});

test("sanitizeWorldDifficulty: unknown and locked both become Normal", () => {
  assert.equal(sanitizeWorldDifficulty("hard", true), "hard");
  assert.equal(sanitizeWorldDifficulty("hard", false), WORLD_DIFFICULTY_DEFAULT);
  assert.equal(sanitizeWorldDifficulty("nope", true), WORLD_DIFFICULTY_DEFAULT);
  assert.equal(sanitizeWorldDifficulty(null, true), WORLD_DIFFICULTY_DEFAULT);
});
