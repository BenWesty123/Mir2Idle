/** Max kill-streak counter tracked per zone for drop pity. */
export const DROP_PITY_KILLS = 8;

/**
 * @param {Record<string, unknown>} kills
 * @param {(zoneId: string) => boolean} zoneFilter
 */
export function sanitizeBossKills(kills = {}, zoneFilter = () => false) {
  if (!kills || typeof kills !== "object") return {};
  return Object.fromEntries(
    Object.entries(kills)
      .filter(([zoneId]) => zoneFilter(zoneId))
      .map(([zoneId, count]) => [zoneId, Math.max(0, Math.trunc(Number(count) || 0))]),
  );
}

/**
 * @param {Record<string, unknown>} respawns
 * @param {(zoneId: string) => boolean} zoneFilter
 */
export function sanitizeBossRespawns(respawns = {}, zoneFilter = () => false) {
  if (!respawns || typeof respawns !== "object") return {};
  return Object.fromEntries(
    Object.entries(respawns)
      .filter(([zoneId]) => zoneFilter(zoneId))
      .map(([zoneId, readyAt]) => [zoneId, Math.max(0, Math.trunc(Number(readyAt) || 0))]),
  );
}

/**
 * @param {Record<string, unknown>} saved
 * @param {(zoneId: string) => boolean} zoneFilter
 */
export function sanitizeAccountStats(saved = {}, zoneFilter = () => false) {
  return {
    rebirthCount: Math.max(0, Math.trunc(Number(saved?.rebirthCount) || 0)),
    rebirthPointsGained: Math.max(0, Math.trunc(Number(saved?.rebirthPointsGained) || 0)),
    rebirthPointsSpent: Math.max(0, Math.trunc(Number(saved?.rebirthPointsSpent) || 0)),
    bossKills: sanitizeBossKills(saved?.bossKills, zoneFilter),
  };
}

/**
 * @param {Record<string, unknown>} savedPity
 * @param {string[]} zoneIds
 * @param {number} [maxPity=DROP_PITY_KILLS]
 */
export function sanitizeDropPity(savedPity, zoneIds, maxPity = DROP_PITY_KILLS) {
  if (!savedPity || typeof savedPity !== "object") return {};
  const cap = Math.max(0, Math.trunc(Number(maxPity) || DROP_PITY_KILLS));
  return Object.fromEntries(
    zoneIds.map((zoneId) => [
      zoneId,
      Math.max(0, Math.min(cap, Math.trunc(Number(savedPity[zoneId]) || 0))),
    ]),
  );
}
