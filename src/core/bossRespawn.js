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

/**
 * Absolute readyAt timestamps can become absurd after device clock skew
 * (e.g. cloud restore onto a phone whose date is weeks off). No legitimate
 * remaining wait can exceed the zone's configured base delay.
 *
 * @param {number} readyAt wall-clock ms when the boss becomes available
 * @param {number} now Date.now()
 * @param {number} maxDelayMs configured base respawn delay for the zone
 * @returns {number} readyAt, or 0 when the timestamp is impossible
 */
export function clampBossRespawnReadyAt(readyAt, now, maxDelayMs) {
  const ready = Math.max(0, Math.trunc(Number(readyAt) || 0));
  if (!ready) return 0;
  const at = Math.max(0, Math.trunc(Number(now) || 0));
  const maxDelay = Math.max(0, Math.trunc(Number(maxDelayMs) || 0));
  if (maxDelay <= 0) return 0;
  if (ready > at + maxDelay) return 0;
  return ready;
}
