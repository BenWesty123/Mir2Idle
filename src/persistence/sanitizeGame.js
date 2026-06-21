/**
 * Pure character game-state normalization on load.
 */

import { normalizeSavedProgress } from "../core/progress.js";

/**
 * @param {object | null | undefined} savedGame
 * @param {object} [options]
 * @param {number} [options.fallbackGold]
 * @param {number} [options.fallbackLevel]
 * @param {string[]} [options.zoneIds]
 * @param {string | null} [options.miningZoneId]
 * @param {(spotId: unknown) => string | null} [options.resolveMiningSpotId]
 * @param {(savedPity: unknown) => Record<string, number>} [options.sanitizeDropPity]
 * @param {(respawns: unknown) => Record<string, number>} [options.sanitizeBossRespawns]
 * @param {(kills: unknown) => Record<string, number>} [options.sanitizeBossKills]
 * @param {(run: unknown, activeZoneId: string | null, classId: string | null) => object | null} [options.sanitizeGroupDungeonRun]
 * @param {string | null} [options.fallbackClassId]
 */
export function sanitizeCharacterGameState(savedGame, options = {}) {
  const {
    fallbackGold = 0,
    fallbackLevel = 1,
    zoneIds = [],
    miningZoneId = null,
    resolveMiningSpotId = () => null,
    sanitizeDropPity = () => ({}),
    sanitizeBossRespawns = () => ({}),
    sanitizeBossKills = () => ({}),
    sanitizeGroupDungeonRun = () => null,
    fallbackClassId = null,
  } = options;

  const zoneExists = zoneIds.includes(savedGame?.activeZoneId);
  const miningMode = savedGame?.mode === "mining" && savedGame?.activeZoneId === miningZoneId;
  const zoneMode = savedGame?.mode === "zone" && zoneExists;
  const game = {
    mode: miningMode ? "mining" : zoneMode ? "zone" : "town",
    activeZoneId: miningMode || zoneMode ? savedGame.activeZoneId : null,
    miningNextRollAt: Math.max(0, Math.trunc(Number(savedGame?.miningNextRollAt) || 0)),
    miningSpotId: resolveMiningSpotId(savedGame?.miningSpotId),
    kills: Math.max(0, Math.trunc(Number(savedGame?.kills) || 0)),
    zoneKills: Math.max(0, Math.trunc(Number(savedGame?.zoneKills) || 0)),
    distance: Math.max(0, Math.trunc(Number(savedGame?.distance) || 0)),
    playtimeMs: Math.max(0, Math.trunc(Number(savedGame?.playtimeMs) || 0)),
    lastReward: savedGame?.lastReward && typeof savedGame.lastReward === "object" ? savedGame.lastReward : null,
    recentLoot: Array.isArray(savedGame?.recentLoot) ? savedGame.recentLoot.map(String).slice(0, 6) : [],
    dropPity: sanitizeDropPity(savedGame?.dropPity),
    bossRespawns: sanitizeBossRespawns(savedGame?.bossRespawns),
    bossKills: sanitizeBossKills(savedGame?.bossKills),
    progress: {
      ...normalizeSavedProgress({
        level: Math.max(1, Math.trunc(Number(savedGame?.progress?.level) || fallbackLevel)),
        experience: Math.max(0, Math.trunc(Number(savedGame?.progress?.experience) || 0)),
      }),
      gold: Math.max(0, Math.trunc(Number(savedGame?.progress?.gold ?? fallbackGold) || 0)),
    },
    starterGearVersion: Math.max(0, Math.trunc(Number(savedGame?.starterGearVersion) || 0)),
  };
  game.groupDungeonRun = sanitizeGroupDungeonRun(
    savedGame?.groupDungeonRun,
    game.activeZoneId,
    fallbackClassId,
  );
  return game;
}
