export const LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID = "rebirth-base-stats";

/**
 * @param {object | null | undefined} upgrade
 * @returns {number}
 */
export function accountUpgradeMaxTier(upgrade) {
  if (Array.isArray(upgrade?.rebirthCosts)) return upgrade.rebirthCosts.length;
  if (Number.isFinite(upgrade?.maxTier)) return Math.max(1, Math.trunc(upgrade.maxTier));
  if (upgrade?.rebirthCostFn === "linear") return Infinity;
  return 1;
}

/**
 * @param {object | null | undefined} savedUpgrades
 * @param {object[]} upgradeDefs
 * @param {object} [options]
 * @param {string[]} [options.rebirthBaseStatUpgradeIds]
 * @param {string} [options.legacyStatUpgradeId]
 */
export function sanitizeAccountUpgradeState(
  savedUpgrades = {},
  upgradeDefs = [],
  options = {},
) {
  const rebirthBaseStatUpgradeIds = options.rebirthBaseStatUpgradeIds ?? [];
  const legacyStatUpgradeId = options.legacyStatUpgradeId ?? LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID;
  const rawPurchased = savedUpgrades?.purchased && typeof savedUpgrades.purchased === "object"
    ? savedUpgrades.purchased
    : savedUpgrades;
  const rawTiers = savedUpgrades?.tiers && typeof savedUpgrades.tiers === "object"
    ? savedUpgrades.tiers
    : {};
  const tiers = {};
  for (const upgrade of upgradeDefs) {
    const fromTiers = Math.max(0, Math.trunc(Number(rawTiers?.[upgrade.id]) || 0));
    const fromPurchased = rawPurchased?.[upgrade.id] ? 1 : 0;
    const tier = Math.max(fromTiers, fromPurchased);
    const maxTier = accountUpgradeMaxTier(upgrade);
    if (tier > 0) {
      tiers[upgrade.id] = Number.isFinite(maxTier) ? Math.min(tier, maxTier) : tier;
    }
  }
  const legacyStatTier = Math.max(0, Math.trunc(Number(rawTiers?.[legacyStatUpgradeId]) || 0));
  if (legacyStatTier > 0) {
    for (const upgradeId of rebirthBaseStatUpgradeIds) {
      tiers[upgradeId] = Math.max(tiers[upgradeId] ?? 0, legacyStatTier);
    }
  }
  return { tiers };
}
