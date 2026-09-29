/**
 * Ascension Point arithmetic. Lives here rather than in the monolith so the
 * spend/refund rules are unit testable; the upgrade definitions are injected
 * the same way sanitizeAccountStatsCore takes its zone filter, which keeps
 * ASCENSION_UPGRADE_DEFS next to the rest of the game data.
 *
 * Every function is pure and returns a fresh tier map, because callers hold
 * these as a draft that is thrown away if the ascension is cancelled.
 */

/** @typedef {{ id: string, costPerTier?: number, costByTier?: number[], costEqualsTier?: boolean, maxTier: number | null, planned?: boolean }} AscensionUpgradeDef */
/** @typedef {Record<string, number>} AscensionTiers */

/**
 * @param {AscensionUpgradeDef[]} defs
 * @param {string} upgradeId
 */
function upgradeById(defs, upgradeId) {
  if (!Array.isArray(defs)) return null;
  return defs.find((def) => def?.id === upgradeId) ?? null;
}

/** A null maxTier means the upgrade has no cap (Soul Exchange). */
function tierCap(upgrade) {
  const max = upgrade?.maxTier;
  if (max == null) return Infinity;
  return Math.max(0, Math.trunc(Number(max) || 0));
}

/**
 * What the Nth tier costs, 1-based. Most upgrades charge the same for every
 * tier (`costPerTier`). Traveller's Supplies uses a finite `costByTier`
 * schedule; tiers past the end of that list hold its last price rather than
 * becoming free. Havoc Surplus and Head Start have no last price:
 * `costEqualsTier` makes the Nth tier cost N, forever.
 * @param {AscensionUpgradeDef} upgrade
 * @param {number} tier
 */
function tierCostAt(upgrade, tier) {
  const n = Math.max(1, Math.trunc(Number(tier) || 1));
  if (upgrade?.costEqualsTier) return n;
  const schedule = upgrade?.costByTier;
  if (Array.isArray(schedule) && schedule.length) {
    const index = Math.min(n, schedule.length) - 1;
    return Math.max(0, Math.trunc(Number(schedule[index]) || 0));
  }
  return Math.max(0, Math.trunc(Number(upgrade?.costPerTier) || 0));
}

/** Everything paid to reach `tier` tiers, which is not tier x cost once a schedule is involved. */
function tiersTotalCost(upgrade, tier) {
  const owned = Math.max(0, Math.trunc(Number(tier) || 0));
  let total = 0;
  for (let n = 1; n <= owned; n += 1) total += tierCostAt(upgrade, n);
  return total;
}

/**
 * What the next tier of this upgrade would cost, for the panel to display.
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 * @param {string} upgradeId
 */
export function ascensionNextTierCost(tiers, defs, upgradeId) {
  const upgrade = upgradeById(defs, upgradeId);
  if (!upgrade) return 0;
  return tierCostAt(upgrade, ascensionTierOf(tiers, upgradeId) + 1);
}

/**
 * @param {AscensionTiers | null | undefined} tiers
 * @param {string} upgradeId
 */
export function ascensionTierOf(tiers, upgradeId) {
  return Math.max(0, Math.trunc(Number(tiers?.[upgradeId]) || 0));
}

/**
 * Drops ids that are no longer defined and clamps each tier to its cap, so a
 * save written before an upgrade was removed or shrunk cannot overspend.
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 * @returns {AscensionTiers}
 */
export function sanitizeAscensionTiers(tiers, defs) {
  const saved = tiers && typeof tiers === "object" ? tiers : {};
  const clean = {};
  for (const upgrade of Array.isArray(defs) ? defs : []) {
    if (!upgrade?.id) continue;
    const tier = Math.min(ascensionTierOf(saved, upgrade.id), tierCap(upgrade));
    if (tier > 0) clean[upgrade.id] = tier;
  }
  return clean;
}

/**
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 */
export function ascensionPointsSpentFor(tiers, defs) {
  let total = 0;
  for (const upgrade of Array.isArray(defs) ? defs : []) {
    total += tiersTotalCost(upgrade, ascensionTierOf(tiers, upgrade.id));
  }
  return total;
}

/**
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 * @param {number} pointsEarned
 */
export function ascensionPointsAvailable(tiers, defs, pointsEarned) {
  const earned = Math.max(0, Math.trunc(Number(pointsEarned) || 0));
  return Math.max(0, earned - ascensionPointsSpentFor(tiers, defs));
}

/**
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 * @param {string} upgradeId
 * @param {number} pointsEarned
 * @returns {{ ok: boolean, reason: "" | "unknown" | "planned" | "maxed" | "points", cost: number, shortBy: number }}
 */
export function canBuyAscensionTier(tiers, defs, upgradeId, pointsEarned) {
  const upgrade = upgradeById(defs, upgradeId);
  if (!upgrade) return { ok: false, reason: "unknown", cost: 0, shortBy: 0 };
  const current = ascensionTierOf(tiers, upgradeId);
  const cost = tierCostAt(upgrade, current + 1);
  // Listed on the panel so the plan is visible, but with no effect wired yet -
  // taking points for one would be taking them for nothing.
  if (upgrade.planned) return { ok: false, reason: "planned", cost, shortBy: 0 };
  if (current >= tierCap(upgrade)) {
    return { ok: false, reason: "maxed", cost, shortBy: 0 };
  }
  const available = ascensionPointsAvailable(tiers, defs, pointsEarned);
  if (available < cost) return { ok: false, reason: "points", cost, shortBy: cost - available };
  return { ok: true, reason: "", cost, shortBy: 0 };
}

/**
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 * @param {string} upgradeId
 * @param {number} pointsEarned
 * @returns {AscensionTiers | null} fresh tiers, or null when the buy is not allowed.
 */
export function buyAscensionTier(tiers, defs, upgradeId, pointsEarned) {
  if (!canBuyAscensionTier(tiers, defs, upgradeId, pointsEarned).ok) return null;
  const next = sanitizeAscensionTiers(tiers, defs);
  next[upgradeId] = ascensionTierOf(next, upgradeId) + 1;
  return next;
}

/**
 * Clear times: how long into a journey Evil Mir first fell at each difficulty,
 * keyed by boss tier ("0" plain through "3" awakened). Kept as a sparse map
 * because most journeys never see the top tiers, and 0 would be a lie there
 * rather than a missing entry.
 * @typedef {Record<string, number>} AscensionClearTimes
 */

/**
 * @param {unknown} raw
 * @param {number} tierCount
 * @returns {AscensionClearTimes}
 */
export function sanitizeAscensionClearTimes(raw, tierCount) {
  const saved = raw && typeof raw === "object" ? raw : {};
  const count = Math.max(0, Math.trunc(Number(tierCount) || 0));
  const clean = {};
  for (let tier = 0; tier < count; tier += 1) {
    const ms = Math.trunc(Number(saved[tier] ?? saved[String(tier)]) || 0);
    // A clear cannot take zero time, so 0 and negatives mean "never cleared"
    // and are dropped rather than stored as a record of an instant kill.
    if (ms > 0) clean[tier] = ms;
  }
  return clean;
}

/**
 * Records a clear only if this tier has none yet, so a slower second kill at the
 * same difficulty cannot overwrite the first.
 * @param {AscensionClearTimes | null | undefined} clears
 * @param {number} tier
 * @param {number} elapsedMs
 * @param {number} tierCount
 * @returns {AscensionClearTimes}
 */
export function recordAscensionClearTime(clears, tier, elapsedMs, tierCount) {
  const next = sanitizeAscensionClearTimes(clears, tierCount);
  const index = Math.trunc(Number(tier));
  const ms = Math.trunc(Number(elapsedMs) || 0);
  if (!Number.isFinite(index) || index < 0 || index >= Math.trunc(Number(tierCount) || 0)) return next;
  if (ms <= 0) return next;
  if (next[index] == null) next[index] = ms;
  return next;
}

/**
 * Folds a finished journey's clears into the all-time bests, keeping the
 * fastest per tier.
 * @param {AscensionClearTimes | null | undefined} best
 * @param {AscensionClearTimes | null | undefined} run
 * @param {number} tierCount
 * @returns {AscensionClearTimes}
 */
export function mergeAscensionBestClearTimes(best, run, tierCount) {
  const merged = sanitizeAscensionClearTimes(best, tierCount);
  const finished = sanitizeAscensionClearTimes(run, tierCount);
  for (const [tier, ms] of Object.entries(finished)) {
    if (merged[tier] == null || ms < merged[tier]) merged[tier] = ms;
  }
  return merged;
}

/**
 * Hands back one tier's worth of points.
 * @param {AscensionTiers | null | undefined} tiers
 * @param {AscensionUpgradeDef[]} defs
 * @param {string} upgradeId
 * @returns {AscensionTiers | null} fresh tiers, or null when there is nothing to refund.
 */
export function refundAscensionTier(tiers, defs, upgradeId) {
  if (!upgradeById(defs, upgradeId)) return null;
  const next = sanitizeAscensionTiers(tiers, defs);
  const current = ascensionTierOf(next, upgradeId);
  if (current <= 0) return null;
  if (current === 1) delete next[upgradeId];
  else next[upgradeId] = current - 1;
  return next;
}

/** Each Havoc Surplus tier adds this many percentage points of extra-crystal chance. */
export const ASCENSION_SALVAGE_CHANCE_STEP = 25;

/** Each Head Start tier grants this many Rebirth Points at the start of a world. */
export const ASCENSION_STARTING_REBIRTH_POINTS_STEP = 10;

/** Each Greater DC/MC/SC/AC/AMC tier adds this many percentage points to that stat. */
export const ASCENSION_COMBAT_STAT_PERCENT_STEP = 20;

/** Deeper Mastery tier is the skill level a newly learned spell starts at. 3 is mastered. */
export function ascensionStartingSpellLevel(tier) {
  return Math.max(0, Math.min(3, Math.trunc(Number(tier) || 0)));
}

export const MEGA_POTION_ITEM_ID = "mega-potion";
export const ULTRA_POTION_ITEM_ID = "ultra-potion";
export const MEGA_POTION_TICK_BONUS_PERCENT = 25;
export const ULTRA_POTION_TICK_BONUS_PERCENT = 50;

/**
 * Extra potion tick speed from the last Mega/Ultra drink. 25% is Mega, 50% is Ultra.
 * @param {unknown} itemId
 * @returns {number}
 */
export function potionTickBonusPercentForItemId(itemId) {
  const id = String(itemId || "");
  if (id === ULTRA_POTION_ITEM_ID) return ULTRA_POTION_TICK_BONUS_PERCENT;
  if (id === MEGA_POTION_ITEM_ID) return MEGA_POTION_TICK_BONUS_PERCENT;
  return 0;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function sanitizePotionTickBonusPercent(value) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  if (n === ULTRA_POTION_TICK_BONUS_PERCENT) return ULTRA_POTION_TICK_BONUS_PERCENT;
  if (n === MEGA_POTION_TICK_BONUS_PERCENT) return MEGA_POTION_TICK_BONUS_PERCENT;
  return 0;
}

/**
 * Shorter delay for a +percent tick-speed bonus. 25% of 200ms is 160ms; 50% is 133ms.
 * @param {number} baseDelayMs
 * @param {number} bonusPercent
 * @returns {number}
 */
export function potionTickDelayMsForBonus(baseDelayMs, bonusPercent) {
  const base = Math.max(1, Math.trunc(Number(baseDelayMs) || 0));
  const bonus = Math.max(0, Number(bonusPercent) || 0);
  if (bonus <= 0) return base;
  return Math.max(1, Math.round(base / (1 + bonus / 100)));
}

/**
 * @param {number} tier
 * @returns {number}
 */
export function ascensionStartingRebirthPoints(tier) {
  return Math.max(0, Math.trunc(Number(tier) || 0)) * ASCENSION_STARTING_REBIRTH_POINTS_STEP;
}

/**
 * @param {number} tier
 * @returns {number}
 */
export function ascensionCombatStatBonusPercent(tier) {
  return Math.max(0, Math.trunc(Number(tier) || 0)) * ASCENSION_COMBAT_STAT_PERCENT_STEP;
}

/**
 * +percent on a [min, max] combat range. Independent round, then max is at least min.
 * @param {unknown} range
 * @param {number} percent
 * @returns {[number, number]}
 */
export function scaleStatRangeByBonusPercent(range, percent) {
  const min = Math.trunc(Number(range?.[0]) || 0);
  const max = Math.trunc(Number(range?.[1]) || 0);
  const bonus = Math.max(0, Number(percent) || 0);
  if (bonus <= 0) return [min, max];
  const scaledMin = Math.round(min * (1 + bonus / 100));
  const scaledMax = Math.round(max * (1 + bonus / 100));
  return [scaledMin, Math.max(scaledMin, scaledMax)];
}

/**
 * @param {number} tier
 * @returns {number}
 */
export function ascensionSalvageExtraChancePercent(tier) {
  return Math.max(0, Math.trunc(Number(tier) || 0)) * ASCENSION_SALVAGE_CHANCE_STEP;
}

/**
 * How many extra copies of an item's salvage the chance buys. 25% is 0 or 1;
 * 125% is 1 guaranteed and a 25% roll for a second. Chance of 0 never extras.
 * @param {number} chancePercent
 * @param {() => number} [random] 0..1, injected so the roll is testable
 * @returns {number}
 */
export function rollAscensionSalvageExtras(chancePercent, random = Math.random) {
  const chance = Math.max(0, Number(chancePercent) || 0);
  if (chance <= 0) return 0;
  const guaranteed = Math.trunc(chance / 100);
  const remainder = chance - guaranteed * 100;
  const rolled = remainder > 0 && random() * 100 < remainder ? 1 : 0;
  return guaranteed + rolled;
}

/**
 * One item's crystals after Havoc Surplus. A proc is another copy of the base
 * (double, then triple past 100%), not a flat +1, so a T3 salvage stays worth
 * three times a T1 one.
 * @param {number} baseCrystals
 * @param {number} chancePercent
 * @param {() => number} [random]
 */
export function applyAscensionSalvageBonus(baseCrystals, chancePercent, random = Math.random) {
  const base = Math.max(0, Math.trunc(Number(baseCrystals) || 0));
  return base * (1 + rollAscensionSalvageExtras(chancePercent, random));
}

/** World difficulty unlocked by Steeper Path. Normal is always available. */
export const WORLD_DIFFICULTY_DEFS = [
  { id: "normal", label: "Normal", multiplier: 1 },
  { id: "hard", label: "Hard", multiplier: 1.25 },
  { id: "extreme", label: "Extreme", multiplier: 1.5 },
  { id: "insane", label: "Insane", multiplier: 1.75 },
  { id: "impossible", label: "Impossible", multiplier: 2 },
];

export const WORLD_DIFFICULTY_DEFAULT = "normal";

/**
 * @param {string | null | undefined} id
 */
export function worldDifficultyDef(id) {
  return WORLD_DIFFICULTY_DEFS.find((entry) => entry.id === id) ?? WORLD_DIFFICULTY_DEFS[0];
}

/**
 * Unknown ids fall back to Normal. Without Steeper Path the selector is locked
 * to Normal, so a leftover Hard save cannot keep paying 1.25× after a respec.
 * @param {unknown} id
 * @param {boolean} unlocked
 */
export function sanitizeWorldDifficulty(id, unlocked) {
  if (!unlocked) return WORLD_DIFFICULTY_DEFAULT;
  return worldDifficultyDef(id).id;
}

/**
 * @param {string | null | undefined} id
 */
export function worldDifficultyMultiplier(id) {
  return worldDifficultyDef(id).multiplier;
}

/**
 * A kill from before payout tracking is still this journey's kill. The save
 * does not record which empower tier it was, so the standard journey is all
 * we can grant; a later harder kill still pays the difference.
 *
 * This is a load/migration helper, not a live-kill payer. After the kill has
 * already been counted on this journey, calling it will mark the run paid. If
 * the account already has a bank from a previous journey it will not add
 * points, and the live payout then has nothing left to grant.
 * @param {{
 *   runPointsAwarded?: unknown,
 *   pointsEarned?: unknown,
 *   runBestTier?: unknown,
 *   hasJourneyKill?: boolean,
 *   standardPayout?: number,
 * }} [input]
 * @returns {{ runPointsAwarded: number, pointsEarned: number, runBestTier: number, changed: boolean }}
 */
export function backfillStandardJourneyPayout(input = {}) {
  const awarded = Math.max(0, Math.trunc(Number(input.runPointsAwarded) || 0));
  const banked = Math.max(0, Math.trunc(Number(input.pointsEarned) || 0));
  const due = Math.max(0, Math.trunc(Number(input.standardPayout) || 0));
  const best = Math.trunc(Number(input.runBestTier));
  const currentBest = Number.isFinite(best) ? best : -1;
  if (awarded > 0 || !input.hasJourneyKill || due <= 0) {
    return {
      runPointsAwarded: awarded,
      pointsEarned: banked,
      runBestTier: currentBest,
      changed: false,
    };
  }
  return {
    runPointsAwarded: due,
    pointsEarned: banked > 0 ? banked : due,
    runBestTier: currentBest < 0 ? 0 : currentBest,
    changed: true,
  };
}

/**
 * Pay a live Evil Mir kill. Only banks `target - alreadyAwarded`, so a Standard
 * backfill that already ran leaves nothing to add, and a harder kill still
 * pays the difference.
 * @param {{
 *   runPointsAwarded?: unknown,
 *   pointsEarned?: unknown,
 *   runBestTier?: unknown,
 *   target?: unknown,
 *   tier?: unknown,
 * }} [input]
 * @returns {{
 *   runPointsAwarded: number,
 *   pointsEarned: number,
 *   runBestTier: number,
 *   award: number,
 *   changed: boolean,
 * }}
 */
export function payAscensionForKill(input = {}) {
  const awarded = Math.max(0, Math.trunc(Number(input.runPointsAwarded) || 0));
  const banked = Math.max(0, Math.trunc(Number(input.pointsEarned) || 0));
  const target = Math.max(0, Math.trunc(Number(input.target) || 0));
  const tier = Math.trunc(Number(input.tier));
  const best = Math.trunc(Number(input.runBestTier));
  const currentBest = Number.isFinite(best) ? best : -1;
  const award = target - awarded;
  if (award <= 0) {
    return {
      runPointsAwarded: awarded,
      pointsEarned: banked,
      runBestTier: currentBest,
      award: 0,
      changed: false,
    };
  }
  return {
    runPointsAwarded: target,
    pointsEarned: banked + award,
    runBestTier: Number.isFinite(tier) ? Math.max(currentBest, tier) : currentBest,
    award,
    changed: true,
  };
}

/**
 * When the payout table changes, top a journey already in progress up to what
 * its recorded best tier is now worth. No best tier means nothing to retcon.
 * @param {{
 *   runPointsAwarded?: unknown,
 *   pointsEarned?: unknown,
 *   runBestTier?: unknown,
 * }} [input]
 * @param {number[]} payoutByTier
 */
export function syncAscensionPayoutForBestTier(input = {}, payoutByTier) {
  const best = Math.trunc(Number(input.runBestTier));
  const currentBest = Number.isFinite(best) ? best : -1;
  const awarded = Math.max(0, Math.trunc(Number(input.runPointsAwarded) || 0));
  const banked = Math.max(0, Math.trunc(Number(input.pointsEarned) || 0));
  if (currentBest < 0 || !Array.isArray(payoutByTier) || !payoutByTier.length) {
    return {
      runPointsAwarded: awarded,
      pointsEarned: banked,
      runBestTier: currentBest,
      award: 0,
      changed: false,
    };
  }
  const index = Math.max(0, Math.min(payoutByTier.length - 1, currentBest));
  return payAscensionForKill({
    runPointsAwarded: awarded,
    pointsEarned: banked,
    runBestTier: currentBest,
    target: payoutByTier[index],
    tier: currentBest,
  });
}

/**
 * Guaranteed and best-case crystals for the cube's preview button, without rolling.
 * @param {number} baseCrystals
 * @param {number} chancePercent
 * @returns {{ min: number, max: number, remainder: number }}
 */
export function previewAscensionSalvageBonus(baseCrystals, chancePercent) {
  const base = Math.max(0, Math.trunc(Number(baseCrystals) || 0));
  const chance = Math.max(0, Number(chancePercent) || 0);
  const guaranteed = Math.trunc(chance / 100);
  const remainder = chance - guaranteed * 100;
  return {
    min: base * (1 + guaranteed),
    max: base * (1 + guaranteed + (remainder > 0 ? 1 : 0)),
    remainder,
  };
}
