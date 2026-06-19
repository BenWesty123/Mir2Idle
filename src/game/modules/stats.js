import { ACTION_GROUPS, PLAYER_ACTIONS, sourceFrameFor } from "../../playerActions.js";
import {
  ENEMY_TEMPLATES,
  PLAYER_TEMPLATE,
  attackDelayMs,
  CRYSTAL_PLAYER_ACTION_LOCK_MS,
  crystalAdjustedExperience,
  twinDrakeAttackDelayMs,
  crystalExperienceForLevel,
  crystalPlayerBaseStats,
  CRYSTAL_MAX_LUCK,
  formatStatRange,
  randomInt,
  rollDamage,
  rollStat,
  statRange,
} from "../../battleData.js";
import { SPELL_GROUPS, bodyActionForSpell, spellLabel } from "../../spellBodyActions.js";
import { loadAtlas, loadJson, missingActions, sheetUrl } from "../../atlas.js";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
  WARRIOR_COMBAT_SKILLS,
  magicIconSrc,
  CRYSTAL_SPELL_GLOBAL_LOCK_MS,
  crystalSpellCastCooldownMs,
  spellDelayMs,
  spellExperienceTarget,
  spellLevelRequirement,
  spellMpCost,
  taoistSpellById,
  taoistSpellByShape,
  warriorSpellById,
  warriorSpellByShape,
} from "../../warriorMagic.js";
import { MINING_SPOTS, PHASE1_ZONES } from "../../phase1Data.js";
import {
  GROUP_DUNGEON_SWARM_BLOCKED_RETRY_MS,
  GROUP_DUNGEON_SWARM_CELL_HEIGHT,
  GROUP_DUNGEON_SWARM_LANES,
  GROUP_DUNGEON_SWARM_SPAWN_MS,
  ensureSwarmDirectionalActions,
  fireWallCrossTiles,
  swarmAttackActionForLane,
  swarmEnemyEngagedStanceAction,
  swarmEnemyInAttackRange,
  swarmEnemyReservedTile,
  swarmEnemyTilePosition,
  swarmLaneFromMapRow,
  swarmLaneMapRow,
  swarmMeleeColumnWorldX,
  swarmPickWalkStep,
  swarmSnapTileX,
  swarmTileOccupied,
  GROUP_DUNGEON_WAVES_PER_FLOOR,
  GROUP_DUNGEON_WAVE_SPAWN_CAP,
  GROUP_DUNGEON_WAVE_FIELD_CAP,
  GROUP_DUNGEON_WAVE_REFILL_THRESHOLD,
  GROUP_DUNGEON_WAVE_REFILL_BATCH,
  GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS,
  GROUP_DUNGEON_WAVE_INSTANT_CAP,
  GROUP_DUNGEON_WAVE_BURST_STAGGER_MS,
  groupDungeonWaveSpawnCount,
  createGroupDungeonWaveState,
} from "../../groupDungeonSwarm.js";
import {
  BUFF_POTION_DURATION_MS,
  applyStatBuffsToStats,
  buffPotionDefForItem,
  formatBuffRemaining,
  isBuffPotionItem,
  pruneStatBuffs,
  sanitizeStatBuffs,
  statBuffBonusLabel,
} from "../../buffPotions.js";

import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function prototypeStatsNoticeRequired() {
  if (!state.settings.prototypeStatsEnabled) return false;
  return Math.max(0, Math.trunc(Number(state.settings.prototypeStatsNoticeVersion) || 0)) < STATS_NOTICE_VERSION;
}

function prototypeResetNoticeRequired(now = Date.now()) {
  const seenVersion = Math.max(0, Math.trunc(Number(state.settings.prototypeResetNoticeVersion) || 0));
  const lastSeenAt = Math.max(0, Math.trunc(Number(state.settings.prototypeResetNoticeLastSeenAt) || 0));
  return seenVersion < PROTOTYPE_RESET_NOTICE_VERSION
    || now - lastSeenAt >= PROTOTYPE_RESET_NOTICE_INTERVAL_MS;
}

function prototypeStatsCanSubmit() {
  return Boolean(
    state.settings.prototypeStatsEnabled
      && state.prototypeStats.configured
      && state.prototypeStats.endpoint
      && !prototypeStatsNoticeRequired(),
  );
}

function prototypeStatsInt(value, fallback = 0) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function prototypeStatsCharacterSummaries() {
  G.captureActiveCharacterState();
  return CHARACTER_SELECT_CLASSES
    .filter((entry) => !entry.disabled)
    .map((entry) => prototypeStatsCharacterSummary(entry.id, state.characters[entry.id]))
    .filter(Boolean);
}

function prototypeStatsCharacterSummary(classId, character) {
  const game = character?.game;
  const progress = game?.progress;
  if (!game || !progress) return null;
  const stats = G.characterSnapshotTotalStats(classId, character, { includeBuffs: false });
  return {
    characterClass: G.normalizeCharacterId(classId),
    level: Math.max(1, prototypeStatsInt(progress.level, 1)),
    experience: prototypeStatsInt(progress.experience),
    kills: prototypeStatsInt(game.kills),
    zoneKills: prototypeStatsInt(game.zoneKills),
    gold: prototypeStatsInt(progress.gold ?? character.inventory?.gold),
    activeZoneId: game.activeZoneId ?? null,
    playtimeMs: prototypeStatsInt(game.playtimeMs),
    stats: {
      hp: prototypeStatsInt(stats.hp),
      maxHp: prototypeStatsInt(stats.maxHp),
      mp: prototypeStatsInt(stats.mp),
      maxMp: prototypeStatsInt(stats.maxMp),
      dc: [prototypeStatsInt(stats.dc?.[0]), prototypeStatsInt(stats.dc?.[1])],
      mc: [prototypeStatsInt(stats.mc?.[0]), prototypeStatsInt(stats.mc?.[1])],
      sc: [prototypeStatsInt(stats.sc?.[0]), prototypeStatsInt(stats.sc?.[1])],
      ac: [prototypeStatsInt(stats.ac?.[0]), prototypeStatsInt(stats.ac?.[1])],
      amc: [prototypeStatsInt(stats.amc?.[0]), prototypeStatsInt(stats.amc?.[1])],
      accuracy: prototypeStatsInt(stats.accuracy),
      agility: prototypeStatsInt(stats.agility),
      luck: prototypeStatsInt(stats.luck),
    },
  };
}

function prototypeStatsSnapshot() {
  const account = G.accountStatsSnapshot();
  const characters = prototypeStatsCharacterSummaries();
  const totalKills = characters.reduce((sum, character) => sum + character.kills, 0);
  const totalPlaytimeMs = characters.reduce((sum, character) => sum + character.playtimeMs, 0);
  return {
    game: "lom-idle-v2",
    saveVersion: SAVE_VERSION,
    playerId: state.prototypeStats.playerId,
    activeCharacterId: state.activeCharacterId,
    account,
    characters,
    highestLevel: account.highestCharacterLevel,
    experience: characters.reduce((best, character) => Math.max(best, character.experience), 0),
    kills: totalKills,
    zoneKills: characters.reduce((best, character) => Math.max(best, character.zoneKills), 0),
    bossKills: account.bossKills,
    gold: account.totalGold,
    activeZoneId: state.game.activeZoneId ?? null,
    playtimeMs: totalPlaytimeMs,
    characterCount: characters.length,
  };
}


G.prototypeStatsNoticeRequired = prototypeStatsNoticeRequired;
G.prototypeResetNoticeRequired = prototypeResetNoticeRequired;
G.prototypeStatsCanSubmit = prototypeStatsCanSubmit;
G.prototypeStatsInt = prototypeStatsInt;
G.prototypeStatsCharacterSummaries = prototypeStatsCharacterSummaries;
G.prototypeStatsCharacterSummary = prototypeStatsCharacterSummary;
G.prototypeStatsSnapshot = prototypeStatsSnapshot;
