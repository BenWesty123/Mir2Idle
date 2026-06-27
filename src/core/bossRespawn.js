/**
 * Boss respawn delay helpers.
 */

/**
 * @param {number} baseMinutes
 * @param {number} reductionPercent total reduction percent (e.g. 50 = half duration)
 * @param {number} [maxReductionPercent=50]
 * @param {number} [minMinutes=1]
 * @returns {number}
 */
export function adjustedBossRespawnMinutes(
  baseMinutes,
  reductionPercent,
  maxReductionPercent = 50,
  minMinutes = 1,
) {
  const base = Math.max(0, Number(baseMinutes) || 0);
  if (base <= 0) return 0;
  const reduction = Math.min(
    Math.max(0, Number(maxReductionPercent) || 0),
    Math.max(0, Number(reductionPercent) || 0),
  ) / 100;
  return Math.max(minMinutes, Math.round(base * (1 - reduction)));
}
