/**
 * Pure party reward helpers.
 */

/**
 * Split a total reward evenly across party members (floor division).
 * @param {number} total
 * @param {number} memberCount
 * @returns {number}
 */
export function splitPartyRewardAmount(total, memberCount) {
  const count = Math.max(1, Math.trunc(Number(memberCount) || 0));
  return Math.max(0, Math.floor(Math.max(0, Math.trunc(Number(total) || 0)) / count));
}
