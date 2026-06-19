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
  groupDungeonWavesPerFloor,
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

import { battlePanelSignature, gamePanelSignature, sceneSignature, combatSkillBarSignature, playerHudSignature, hotbarSignature, lastSimulationAt, suppressSimulationRender, lastStageShellSize, inventoryDragState, atlasReloadVersion, queuedAtlasReloadKey, imageCache } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function refreshOfflineProgressUi() {
  gamePanelSignature = "";
  battlePanelSignature = "";
  sceneSignature = "";
  playerHudSignature = "";
  hotbarSignature = "";
  G.saveGameState(true);
}

function xpGainedSinceOfflineSnapshot(snapshot, leader) {
  if (!leader || !snapshot) return 0;
  let xp = 0;
  let level = snapshot.level;
  let experience = snapshot.experience;
  const endLevel = leader.game.progress.level;
  const endExp = leader.game.progress.experience;
  while (level < endLevel) {
    const needed = xpForNextLevel(level);
    if (!Number.isFinite(needed)) break;
    xp += needed - experience;
    experience = 0;
    level += 1;
  }
  xp += endExp - experience;
  return Math.max(0, xp);
}

function simulateOfflineMining(pending) {
  const limitMs = Math.max(0, Math.trunc(Number(pending.elapsedMs) || 0));
  const report = {
    kind: "mining",
    elapsedMs: 0,
    capped: pending.capped,
    swings: 0,
    hits: 0,
    drops: new Map(),
    ignoredDrops: new Map(),
  };

  let simMs = 0;
  while (simMs + MINING_SWING_CYCLE_MS <= limitMs) {
    simMs += MINING_SWING_CYCLE_MS;
    report.swings += 1;
    if (Math.random() >= MINING_HIT_CHANCE) continue;
    report.hits += 1;
    G.addOfflineMiningOre(
      report,
      G.rollMiningOreItemId(),
      G.rollMiningOrePurity(),
    );
  }

  report.elapsedMs = simMs;
  return report;
}

function simulateOfflineTrainingRoomProgress(zone, report, startedAt, limitMs) {
  const template = G.trainingRoomEnemyTemplate(zone);
  const enemy = {
    ...template,
    hp: template.maxHp,
    mp: template.maxMp,
    poisons: [],
    debuffs: { slowUntil: 0, frozenUntil: 0 },
  };
  state.battle.enemy = enemy;
  state.battle.enemyId = enemy.id;
  state.battle.phase = "engaged";
  state.battle.enemyAggro = true;
  state.battle.playerX = 0;
  state.battle.enemyX = G.playerAttackRange();
  G.dismissTaoistPet();

  let elapsedMs = 0;
  let nextCastAt = Math.max(0, (state.battle.trainingRoomNextCastAt ?? 0) - startedAt);
  G.offlineUpdateRecovery(startedAt, report);

  while (elapsedMs < limitMs && (state.battle.player?.hp ?? 0) > 0) {
    if (elapsedMs < nextCastAt) {
      const jump = Math.min(nextCastAt - elapsedMs, limitMs - elapsedMs);
      elapsedMs += jump;
      G.offlineUpdateRecovery(startedAt + elapsedMs, report);
      if (elapsedMs >= limitMs) break;
    }

    const now = startedAt + elapsedMs;
    const cast = tryTrainingRoomAutocastCycle(now);
    if (cast) {
      const gap = G.trainingRoomCastGapMs(cast.spell, cast.learned);
      nextCastAt = elapsedMs + gap;
      state.battle.trainingRoomNextCastAt = startedAt + nextCastAt;
      state.battle.nextPlayerAttackAt = state.battle.trainingRoomNextCastAt;
      state.battle.lastPlayerAttackCooldownMs = gap;
    } else {
      nextCastAt = elapsedMs + CRYSTAL_SPELL_GLOBAL_LOCK_MS;
      state.battle.trainingRoomNextCastAt = startedAt + nextCastAt;
    }
    G.offlineUpdateRecovery(now, report);
  }

  report.elapsedMs = Math.min(elapsedMs, limitMs);
  report.simulatedEndedAt = startedAt + report.elapsedMs;
  report.finalEnemy = enemy;
  state.battle.level = state.game.progress.level;
  state.battle.experience = state.game.progress.experience;
  state.battle.gold = state.inventory.gold;
  G.clearTransientCombatBuffs();
  return report;
}

function simulateOfflineProgress(zone, pending) {
  const report = {
    elapsedMs: 0,
    capped: pending.capped,
    kills: 0,
    xp: 0,
    gold: 0,
    levels: [],
    drops: new Map(),
    ignoredDrops: new Map(),
    potionsUsed: new Map(),
    damageTaken: 0,
    diedAtMs: 0,
    finalEnemy: null,
  };
  const startedAt = performance.now();
  report.simulatedStartedAt = startedAt;
  const limitMs = Math.max(0, Math.trunc(Number(pending.elapsedMs) || 0));

  if (G.isTrainingRoomZone(zone)) {
    return simulateOfflineTrainingRoomProgress(zone, report, startedAt, limitMs);
  }

  state.battle.phase = "engaged";
  state.battle.enemyAggro = true;
  state.battle.playerX = 0;
  state.battle.enemyX = G.playerAttackRange();

  while (report.elapsedMs < limitMs && (state.battle.player?.hp ?? 0) > 0) {
    const template = randomZoneEnemyTemplate(zone);
    const result = simulateOfflineFight(template, startedAt + report.elapsedMs, limitMs - report.elapsedMs, report);
    report.elapsedMs += result.elapsedMs;
    report.finalEnemy = result.enemy;

    if (result.playerDied) {
      report.diedAtMs = report.elapsedMs;
      break;
    }
    if (!result.killed) break;

    report.finalEnemy = null;
    G.dismissTaoistPet();
    G.awardOfflineEnemyRewards(zone, template, report);
    state.game.distance += G.enemySpawnDistance();

    const respawnMs = Math.min(LANE.respawnDelayMs, Math.max(0, limitMs - report.elapsedMs));
    report.elapsedMs += respawnMs;
    G.offlineUpdateRecovery(startedAt + report.elapsedMs, report);
  }

  report.elapsedMs = Math.min(report.elapsedMs, limitMs);
  report.simulatedEndedAt = startedAt + report.elapsedMs;
  state.battle.level = state.game.progress.level;
  state.battle.experience = state.game.progress.experience;
  state.battle.gold = state.inventory.gold;
  return report;
}

function rebaseOfflineTransientTimers(simulatedNow, actualNow = performance.now()) {
  if (!Number.isFinite(simulatedNow) || simulatedNow <= 0) return;

  for (const [spellId, learned] of Object.entries(state.magic.learned ?? {})) {
    const spell = G.magicSpellById(spellId);
    if (!spell || !learned) continue;
    learned.castReadyAt = rebaseTransientTimestamp(
      learned.castReadyAt,
      simulatedNow,
      actualNow,
      G.wizardCastCooldownMs(spell, learned),
    );
  }

  state.battle.wizardSpellLockUntil = rebaseTransientTimestamp(
    state.battle.wizardSpellLockUntil,
    simulatedNow,
    actualNow,
    CRYSTAL_SPELL_GLOBAL_LOCK_MS,
  );

  state.battle.trainingRoomNextCastAt = rebaseTransientTimestamp(
    state.battle.trainingRoomNextCastAt,
    simulatedNow,
    actualNow,
    CRYSTAL_SPELL_GLOBAL_LOCK_MS,
  );

  state.battle.furyUntil = rebaseTransientTimestamp(state.battle.furyUntil, simulatedNow, actualNow, 120000);
  state.battle.potTickAt = rebaseTransientTimestamp(state.battle.potTickAt, simulatedNow, actualNow, CRYSTAL_POT_DELAY_MS);
  state.battle.healTickAt = rebaseTransientTimestamp(state.battle.healTickAt, simulatedNow, actualNow, CRYSTAL_HEAL_DELAY_MS);
  if (state.battle.pendingHeal) {
    state.battle.pendingHeal.at = rebaseTransientTimestamp(
      state.battle.pendingHeal.at,
      simulatedNow,
      actualNow,
      CRYSTAL_HEAL_APPLY_DELAY_MS,
    );
  }
  if (state.battle.pendingPoison) {
    state.battle.pendingPoison.at = rebaseTransientTimestamp(
      state.battle.pendingPoison.at,
      simulatedNow,
      actualNow,
      CRYSTAL_POISON_APPLY_DELAY_MS,
    );
  }
  if (state.battle.pendingEnemyStrike) {
    const strikeSpan = Math.max(
      EVIL_CENTIPEDE_ATTACK_IMPACT_MS,
      Number(state.battle.pendingEnemyStrike.moveDurationMs) || BONE_LORD_ATTACK_IMPACT_MS,
    );
    state.battle.pendingEnemyStrike.at = rebaseTransientTimestamp(
      state.battle.pendingEnemyStrike.at,
      simulatedNow,
      actualNow,
      strikeSpan,
    );
    if (state.battle.pendingEnemyStrike.startedAt != null) {
      state.battle.pendingEnemyStrike.startedAt = rebaseTransientTimestamp(
        state.battle.pendingEnemyStrike.startedAt,
        simulatedNow,
        actualNow,
        strikeSpan,
      );
    }
  }
  if (state.battle.pendingTaoPet) {
    state.battle.pendingTaoPet.at = rebaseTransientTimestamp(
      state.battle.pendingTaoPet.at,
      simulatedNow,
      actualNow,
      CRYSTAL_SUMMON_SKELETON_DELAY_MS,
    );
  }
  if (state.battle.pendingPetAttack) {
    state.battle.pendingPetAttack.at = rebaseTransientTimestamp(
      state.battle.pendingPetAttack.at,
      simulatedNow,
      actualNow,
      G.taoistShinsuAttackImpactMs(),
    );
  }
  if (state.battle.pendingDefenceBuff) {
    state.battle.pendingDefenceBuff.at = rebaseTransientTimestamp(
      state.battle.pendingDefenceBuff.at,
      simulatedNow,
      actualNow,
      CRYSTAL_HEAL_APPLY_DELAY_MS,
    );
  }
  if (state.battle.pendingUltimateEnhancer) {
    state.battle.pendingUltimateEnhancer.at = rebaseTransientTimestamp(
      state.battle.pendingUltimateEnhancer.at,
      simulatedNow,
      actualNow,
      CRYSTAL_HEAL_APPLY_DELAY_MS,
    );
  }
  if (state.battle.taoPet?.active) {
    state.battle.taoPet.nextAttackAt = rebaseTransientTimestamp(
      state.battle.taoPet.nextAttackAt,
      simulatedNow,
      actualNow,
      state.battle.taoPet.attackMs,
    );
    state.battle.taoPet.healTickAt = rebaseTransientTimestamp(
      state.battle.taoPet.healTickAt,
      simulatedNow,
      actualNow,
      CRYSTAL_HEAL_DELAY_MS,
    );
  }
  state.battle.autoPotionReadyAt = {
    hp: rebaseTransientTimestamp(state.battle.autoPotionReadyAt?.hp, simulatedNow, actualNow, AUTO_POTION_COOLDOWN_MS),
    mp: rebaseTransientTimestamp(state.battle.autoPotionReadyAt?.mp, simulatedNow, actualNow, AUTO_POTION_COOLDOWN_MS),
  };
  state.battle.statBuffs = (state.battle.statBuffs ?? []).map((buff) => ({
    ...buff,
    expiresAt: rebaseTransientTimestamp(
      buff.expiresAt,
      simulatedNow,
      actualNow,
      G.maxStatBuffRemainingMs(buff),
    ),
  })).filter((buff) => buff.expiresAt > actualNow);
  state.battle.petStatBuffs = (state.battle.petStatBuffs ?? []).map((buff) => ({
    ...buff,
    expiresAt: rebaseTransientTimestamp(
      buff.expiresAt,
      simulatedNow,
      actualNow,
      G.maxStatBuffRemainingMs(buff),
    ),
  })).filter((buff) => buff.expiresAt > actualNow);
}

function rebaseTransientTimestamp(value, simulatedNow, actualNow, maxRemainingMs = Infinity) {
  const timestamp = Number(value) || 0;
  if (timestamp <= simulatedNow) return 0;
  const remaining = timestamp - simulatedNow;
  const cappedRemaining = Number.isFinite(maxRemainingMs)
    ? Math.min(remaining, Math.max(0, maxRemainingMs))
    : remaining;
  return cappedRemaining > 0 ? actualNow + cappedRemaining : 0;
}

function simulateOfflineFight(template, startedAt, remainingMs, report) {
  const enemy = { ...template, hp: template.maxHp, mp: template.maxMp, poisons: [], debuffs: { slowUntil: 0, frozenUntil: 0 } };
  let elapsedMs = 0;
  const travelMs = Math.min(G.offlineTravelTimeMs(), remainingMs);
  elapsedMs += travelMs;
  state.battle.enemy = enemy;
  state.battle.enemyId = enemy.id;
  state.battle.phase = "engaged";
  state.battle.enemyAggro = true;
  state.battle.playerX = 0;
  state.battle.enemyX = G.playerAttackRange();
  G.dismissTaoistPet();
  G.offlineUpdateRecovery(startedAt + elapsedMs, report);

  if ((state.battle.player?.hp ?? 0) <= 0) return { elapsedMs, killed: false, playerDied: true, enemy };
  if (elapsedMs >= remainingMs) return { elapsedMs, killed: false, playerDied: false, enemy };

  let nextPlayerAttack = 0;
  let nextEnemyAttack = Math.max(1, Math.trunc(Number(enemy.attackMs) || 2500));
  let guard = 0;

  while (elapsedMs < remainingMs && enemy.hp > 0 && (state.battle.player?.hp ?? 0) > 0 && guard < 5000) {
    guard += 1;
    const pet = state.battle.taoPet?.active ? state.battle.taoPet : null;
    const nextPetAttack = G.offlinePetAttackDelayMs(pet, startedAt + elapsedMs);
    const delta = Math.min(nextPlayerAttack, nextEnemyAttack, nextPetAttack);
    if (elapsedMs + delta > remainingMs) {
      elapsedMs = remainingMs;
      G.offlineUpdateRecovery(startedAt + elapsedMs, report);
      return { elapsedMs, killed: false, playerDied: false, enemy };
    }

    elapsedMs += delta;
    nextPlayerAttack -= delta;
    nextEnemyAttack -= delta;
    const now = startedAt + elapsedMs;
    G.offlineUpdateRecovery(now, report);
    if ((state.battle.player?.hp ?? 0) <= 0) break;

    if (nextPlayerAttack <= 0) {
      if (G.offlinePlayerAttack(enemy, now)) {
        nextPlayerAttack += G.consumeLastPlayerAttackCooldown(now);
      }
    }
    if (enemy.hp <= 0) break;

    if (state.battle.taoPet?.active && (state.battle.taoPet.nextAttackAt ?? 0) <= now) {
      updateTaoistPetAttack(now, { offline: true });
    }
    if (enemy.hp <= 0) break;

    if (nextEnemyAttack <= 0 && !G.enemyFrozenActive(enemy, now)) {
      G.offlineEnemyAttack(enemy, now, report);
      nextEnemyAttack += G.effectiveEnemyAttackMs(enemy, now);
      G.offlineUpdateRecovery(now, report);
    }
  }

  return {
    elapsedMs,
    killed: enemy.hp <= 0,
    playerDied: (state.battle.player?.hp ?? 0) <= 0,
    enemy,
  };
}

function setPrototypeStatsEnabled(enabled) {
  state.settings.prototypeStatsEnabled = Boolean(enabled);
  G.saveGameState(true);
  sceneSignature = "";
  G.renderSceneOverlay();
  G.renderPrototypeStatsNotice();
  if (state.settings.prototypeStatsEnabled) void submitPrototypeStats("enabled");
}

async function submitPrototypeStats(reason = "manual", now = performance.now()) {
  if (!G.prototypeStatsCanSubmit()) return false;
  const snapshot = G.prototypeStatsSnapshot();
  const payloadHash = JSON.stringify(snapshot);
  if (reason !== "enabled" && payloadHash === state.prototypeStats.lastPayloadHash) return false;

  state.prototypeStats.submitting = true;
  state.prototypeStats.lastSubmittedAt = now;
  try {
    const response = await fetch(state.prototypeStats.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...snapshot,
        reason,
        submittedAt: new Date().toISOString(),
      }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.prototypeStats.lastPayloadHash = payloadHash;
    state.prototypeStats.statusText = `Anonymous stats submitted: ${snapshot.account.rebirthCount} rebirths, top level ${snapshot.account.highestCharacterLevel}.`;
    sceneSignature = "";
    G.renderSceneOverlay();
    return true;
  } catch (err) {
    state.prototypeStats.statusText = "Stats upload failed. Progress is still saved locally.";
    console.warn("Unable to submit prototype stats", err);
    sceneSignature = "";
    G.renderSceneOverlay();
    return false;
  } finally {
    state.prototypeStats.submitting = false;
  }
}

function reportEntriesText(entries, limit = 3) {
  return entries
    .slice(0, limit)
    .map(([label, count]) => `${label}${count > 1 ? ` x${count}` : ""}`)
    .join(", ");
}

function reportCountText(map, limit = 3) {
  return reportEntriesText([...map.entries()], limit);
}

function startOneStepTest() {
  if (!state.battle.player || !state.battle.enemy) G.resetBattle();
  const now = performance.now();
  const test = state.stepTest;
  const startX = state.battle.playerX;
  const startCameraX = state.battle.cameraX ?? startX - G.playerScreenX();
  const startTileCameraX = startCameraX * LANE.tileScrollRatio;
  const startScrollX = G.movementTestScrollCameraX(startTileCameraX);

  state.showEnemies = false;
  state.continuousWalk = false;
  state.battle.running = false;
  state.battle.phase = "stepTest";
  state.battle.playerX = startX;
  state.battle.enemyX = G.enemySpawnDistance();
  state.battle.cameraX = startCameraX;
  state.battle.lastMotionAt = now;
  state.battle.travelStartedAt = now;
  state.battle.travelStartedX = state.battle.playerX;
  state.battle.enemyAggro = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  state.battle.activeSkill = "None";
  state.battle.activeSkillAtlas = null;
  state.battle.activeWizardSpell = null;
  state.battle.activeWizardSpellAtlas = null;
  state.battle.activeTaoSpell = null;
  state.battle.activeTaoSpellAtlas = null;
  state.enemy.action = "standing";
  state.enemy.frame = 0;
  state.enemy.oneShot = false;

  test.active = true;
  test.complete = false;
  test.startAt = now;
  test.startX = state.battle.playerX;
  test.startCameraX = startCameraX;
  test.startScrollX = startScrollX;
  test.durationMs = WALK_CYCLE_MS;
  test.distancePx = LANE_TILE_PX;

  state.spell = "None";
  state.spellAtlas = null;
  state.action = "walking";
  state.frame = 0;
  state.playerOneShot = false;
  state.lastTick = now;
  G.pushBattleLog(`One-step test: ${LANE_TILE_PX}px tile over ${WALK_CYCLE_MS}ms from the current backdrop position.`);
  G.renderMapControls();
  G.updateActionButtons();
  battlePanelSignature = "";
  G.render();
}

function stopOneStepTest() {
  if (!state.stepTest.active && !state.stepTest.complete) return;
  state.stepTest.active = false;
  state.stepTest.complete = false;
  if (state.battle.phase === "stepTest") state.battle.phase = "idle";
}

function tryTrainingRoomAutocastCycle(now) {
  const entries = G.trainingRoomAutocastEntries();
  if (!entries.length) return false;

  const battle = state.battle;
  const startIndex = battle.trainingRoomSpellIndex ?? 0;
  for (let offset = 0; offset < entries.length; offset += 1) {
    const entry = entries[(startIndex + offset) % entries.length];
    if (G.trainingRoomTryCast(entry.spell, entry.learned, now)) {
      battle.trainingRoomSpellIndex = (startIndex + offset + 1) % entries.length;
      sceneSignature = "";
      battlePanelSignature = "";
      combatSkillBarSignature = "";
      return entry;
    }
  }
  return null;
}

function updateTrainingRoomBattle(now) {
  const battle = state.battle;
  if (!battle.running || !battle.player || battle.player.hp <= 0 || !battle.enemy) return;

  updateWarriorChargeExpiry(now);
  updateDefenceBuffFx(now);
  updateAttachedSpellFx(now);
  updateGroundSpellEffects(now);
  updateLaneMotion(now);

  if (battle.phase !== "engaged") return;

  if (now < (battle.trainingRoomNextCastAt ?? 0)) return;

  const cast = tryTrainingRoomAutocastCycle(now);
  if (cast) {
    const gap = G.trainingRoomCastGapMs(cast.spell, cast.learned);
    battle.trainingRoomNextCastAt = now + gap;
    battle.nextPlayerAttackAt = battle.trainingRoomNextCastAt;
    battle.lastPlayerAttackCooldownMs = gap;
    return;
  }

  battle.trainingRoomNextCastAt = now + CRYSTAL_SPELL_GLOBAL_LOCK_MS;
}

function stageWeaponRefineEntry(entry) {
  if (!entry || G.isWeaponRefineStagedEntry(entry.id)) return true;
  if (G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id)) return false;
  G.ensureInventorySlots();
  const index = state.inventory.items.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) return false;
  const returnSlot = Number.isInteger(entry.slot) ? entry.slot : null;
  const [stagedEntry] = state.inventory.items.splice(index, 1);
  if (!state.weaponRefine.stagedEntries) state.weaponRefine.stagedEntries = {};
  state.weaponRefine.stagedEntries[stagedEntry.id] = { entry: stagedEntry, returnSlot };
  gamePanelSignature = "";
  return true;
}

function unstageWeaponRefineEntry(entryId, targetSlot = null) {
  const staged = G.weaponRefineStagedRecord(entryId);
  if (!staged) return false;
  delete state.weaponRefine.stagedEntries[entryId];
  const entry = staged.entry;
  const preferredSlot = Number.isInteger(targetSlot)
    ? targetSlot
    : (Number.isInteger(staged.returnSlot) ? staged.returnSlot : null);
  entry.slot = preferredSlot;
  state.inventory.items.push(entry);
  G.ensureInventorySlots();
  gamePanelSignature = "";
  sceneSignature = "";
  return true;
}

function resetWeaponRefineState() {
  G.restoreAllWeaponRefineStagedEntries();
  state.weaponRefine = G.createDefaultWeaponRefineState();
}

function usedWeaponRefineEntryOnOtherBoardSlot(entryId, kind, targetIndex = -1) {
  const board = state.weaponRefine;
  if (board.weaponEntryId === entryId) return true;
  const oreIndex = board.oreEntryIds.indexOf(entryId);
  if (oreIndex >= 0 && !(kind === "ore" && oreIndex === targetIndex)) return true;
  const materialIndex = board.materialEntryIds.indexOf(entryId);
  if (materialIndex >= 0 && !(kind === "material" && materialIndex === targetIndex)) return true;
  return false;
}

function refineEligibleInventoryEntries(kind) {
  G.ensureInventorySlots();
  return G.inventoryEntries()
    .map((entry) => ({ entry, item: G.itemDefinition(entry.itemId) }))
    .filter(({ entry, item }) => {
      if (!item) return false;
      if (kind === "weapon") return G.canPlaceWeaponRefineWeapon(entry, item);
      if (kind === "ore") return G.canPlaceWeaponRefineOre(entry, item);
      if (kind === "material") return G.canPlaceWeaponRefineMaterial(entry, item);
      return false;
    });
}

function selectWeaponRefineSlot(kind, index = 0) {
  state.weaponRefine.picker = { kind, index: Math.max(0, Math.trunc(Number(index) || 0)) };
  sceneSignature = "";
  G.renderSceneOverlay();
  G.playSfx("ui.button", { volume: 0.32, throttleMs: 80 });
}

function refineOffensiveStatSum(stats, key) {
  const range = stats?.[key];
  return Math.trunc(Number(range?.[0]) || 0) + Math.trunc(Number(range?.[1]) || 0);
}

function rollWeaponRefineSuccess(chance) {
  const clamped = Math.max(0, Math.min(WEAPON_REFINE_MAX_CHANCE, Math.trunc(Number(chance) || 0)));
  if (clamped <= 0) return false;
  const roll = Math.floor(Math.random() * WEAPON_REFINE_MAX_CHANCE) + 1;
  return roll <= clamped;
}

function rollWeaponRefineCrit() {
  return Math.random() * 100 < WEAPON_REFINE_CRIT_CHANCE;
}

function sellAllJunkOre() {
  const rows = G.junkOreInventoryEntries();
  if (!rows.length) {
    G.pushBattleLog("No junk ore to sell.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  let soldCount = 0;
  let totalGold = 0;
  for (const { entry, item } of rows) {
    const quantity = Math.max(1, Number(entry.quantity) || 1);
    const value = G.itemSellValue(item, quantity);
    if (value <= 0) continue;
    if (!G.removeInventoryEntry(entry.id, quantity)) continue;
    soldCount += quantity;
    totalGold += value;
  }

  if (soldCount <= 0) {
    G.pushBattleLog("No junk ore to sell.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  state.inventory.gold += totalGold;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.game.progress.gold;
  G.syncBossPartyControlledInventoryFromState();
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  G.pushBattleLog(`Sold ${soldCount} junk ore for ${totalGold} gold.`);
  G.hideItemTooltip();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  hotbarSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderHotbar();
  return true;
}

function resolveSmithCombinePair(entries, item) {
  const sortedEntries = [...entries].sort((a, b) => G.compareSmithCombineEntries(a, b, item));
  return {
    target: sortedEntries[0],
    material: sortedEntries[sortedEntries.length - 1],
    sortedEntries,
  };
}

function resolveSmithCombineStat(option) {
  if (!option.stat?.randomTriple) return option.stat;
  const stats = G.itemEntryStats(option.target, option.item);
  const key = G.smithWeaponUpgradeStatKey(G.itemEntryStats(null, option.item), { rollTriple: true });
  return G.smithRangeUpgradeStat(key, stats, 0);
}

function validGemForEquipItem(gemItem, equipItem) {
  const unique = Math.trunc(Number(gemItem?.gem?.unique) || 0);
  if (!unique || !G.isEquipableItem(equipItem)) return false;
  return G.compatibleEquipmentSlots(equipItem).some((slotId) => {
    const gemSlot = G.equipmentSlotToGemSlot(slotId);
    const required = GEM_VALID_SLOT_FLAGS[gemSlot];
    return required && (unique & required) !== 0;
  });
}

function sceneMagicSignature() {
  G.normalizeAutoCastSpellsForClass(state.battle.combatClass);
  const spells = G.characterSkillSpells();
  return spells
    .map((spell) => {
      const learned = G.learnedMagic(spell.id);
      return learned
        ? `${spell.id}:${learned.level}:${learned.autoCast ? 1 : 0}`
        : `${spell.id}:locked`;
    })
    .join("|") || `${state.battle.combatClass}:no-spells`;
}

function queuedCombatSpell(classId = state.battle.combatClass) {
  const spellId = state.battle.queuedCombatSpellId;
  if (!spellId) return null;
  const combatClass = G.combatAutoCastClassForSpell(spellId);
  if (combatClass !== classId) return null;
  const spell = G.combatSkillForClass(classId, spellId);
  const learned = G.learnedMagic(spellId);
  if (!spell || !learned || spell.passive) {
    G.clearQueuedCombatSpell(spellId);
    return null;
  }
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    queued: true,
  };
}

function rebirthExperienceRate() {
  return 1 + G.accountUpgradeValue("xpBonusPercent") / 100;
}

function rebirthStatUpgradeEffectLabel(upgrade) {
  if (upgrade?.effectLabel) return upgrade.effectLabel;
  const stat = String(upgrade?.stat ?? "");
  if (stat === "accuracy") return "Base accuracy";
  if (stat === "agility") return "Base agility";
  if (stat) return `Base ${stat.toUpperCase()}`;
  return "Base stat";
}

function rebirthStatUpgradeBonus(statKey) {
  return ACCOUNT_UPGRADE_DEFS.reduce((total, upgrade) => {
    if (upgrade.effect !== "baseStatBonus" || upgrade.stat !== statKey) return total;
    const tier = G.accountUpgradeTier(upgrade.id);
    if (tier <= 0) return total;
    return total + tier * Math.max(0, Math.trunc(Number(upgrade.value) || 0));
  }, 0);
}

function toggleSkillAutoCast(spellId) {
  const spell = G.magicSpellById(spellId);
  const learned = G.learnedMagic(spellId);
  if (!spell || !learned || spell.passive) return;
  const combatClass = G.combatAutoCastClassForSpell(spellId);
  if (combatClass) {
    toggleCombatSpellControl(combatClass, spell, learned);
    return;
  }
  learned.autoCast = !learned.autoCast;
  G.pushBattleLog(`${spell.label} ${spell.toggle ? "toggle" : "auto"} ${learned.autoCast ? "enabled" : "disabled"}.`);
  if (state.battle.bossParty?.active) G.syncBossPartyMemberAutoCastFromState(state.battle.combatClass);
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  G.renderSceneOverlay();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
}

function toggleCombatSpellControl(combatClass, spell, learned) {
  G.normalizeAutoCastSpellsForClass(combatClass, spell.id);
  if (learned.autoCast) {
    learned.autoCast = false;
    G.clearQueuedCombatSpell(spell.id);
    G.pushBattleLog(`${spell.label} auto disabled.`);
  } else {
    const activeAuto = G.normalizeAutoCastSpellsForClass(combatClass);
    const limit = G.autoCastSlotLimit();
    if (activeAuto.length < limit) {
      learned.autoCast = true;
      if (combatClass === "Wizard") state.battle.wizardSpell = spell.id;
      G.clearQueuedCombatSpell(spell.id);
      G.pushBattleLog(`${spell.label} auto enabled.`);
    } else {
      G.pushBattleLog(`Autocast slots full (${activeAuto.length}/${limit}). Use the skill button to cast manually or unlock another slot.`);
    }
  }

  if (state.battle.bossParty?.active) G.syncBossPartyMemberAutoCastFromState(combatClass);

  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  G.renderSceneOverlay();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
}

function updateWarriorChargeExpiry(now) {
  const battle = state.battle;
  if (battle.bossParty?.active) {
    let faded = false;
    for (const member of battle.bossParty.members ?? []) {
      if (!member.flamingSwordReady) continue;
      if (Number(member.flamingSwordExpiresAt) > now) continue;
      G.clearFlamingSwordChargeState(member);
      if (member.classId === G.bossPartyControlledClassId()) G.clearFlamingSwordChargeState(battle);
      G.pushBattleLog(`${member.classId}'s Flaming Sword spirit fire faded.`);
      faded = true;
    }
    if (faded) {
      battlePanelSignature = "";
      combatSkillBarSignature = "";
    }
    return;
  }
  if (!G.warriorFlamingSwordReady()) return;
  if (Number(battle.flamingSwordExpiresAt) > now) return;
  G.clearFlamingSwordChargeState(battle);
  G.pushBattleLog("Flaming Sword spirit fire faded.");
  battlePanelSignature = "";
  combatSkillBarSignature = "";
}

function tryWarriorChargeSkill(spellId, now = performance.now()) {
  if (G.warriorSlayingPending()) return false;
  const skill = warriorSpellById(spellId);
  if (!G.isWarriorChargeSkill(skill)) return false;
  const learned = G.learnedMagic(spellId);
  if (!skill || !learned) return false;
  if (G.warriorChargeReady(spellId)) return false;
  if (!G.canUseWarriorSkill(skill, learned, now, { requireAuto: false })) return false;
  G.castWarriorCharge(skill, learned, spellMpCost(skill, learned), now);
  return true;
}

function queueCombatSkillCast(spellId) {
  const combatClass = G.combatAutoCastClassForSpell(spellId);
  const spell = combatClass ? G.combatSkillForClass(combatClass, spellId) : null;
  const learned = G.learnedMagic(spellId);
  if (!combatClass || combatClass !== state.battle.combatClass || !spell || !learned || spell.passive) return;
  if (G.isWarriorChargeSkill(spell)) {
    if (G.warriorChargeReady(spell.id)) {
      G.cancelWarriorCharge(spell.id);
      G.pushBattleLog(`${spell.label} charge cancelled.`);
    } else if (!tryWarriorChargeSkill(spell.id)) {
      G.pushBattleLog(`Cannot ready ${spell.label} right now.`);
    }
    sceneSignature = "";
    battlePanelSignature = "";
    combatSkillBarSignature = "";
    G.renderSceneOverlay();
    G.renderBattlePanel();
    G.renderCombatSkillBar();
    return;
  }
  if (G.isQueuedCombatSpell(spell.id, combatClass)) {
    G.clearQueuedCombatSpell(spell.id);
    G.pushBattleLog(`${spell.label} manual cast cancelled.`);
  } else {
    state.battle.queuedCombatSpellId = spell.id;
    G.pushBattleLog(`${spell.label} queued as the next manual cast.`);
  }
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  G.renderSceneOverlay();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
}

function sameStackableItem(sourceEntry, targetEntry) {
  if (!sourceEntry || !targetEntry || sourceEntry.itemId !== targetEntry.itemId) return false;
  const item = G.itemDefinition(sourceEntry.itemId);
  return G.isStackableItem(item) && targetEntry.quantity < G.maxItemStack(item);
}

function stackEntriesCombinable(sourceEntry, targetEntry) {
  if (!sourceEntry || !targetEntry || sourceEntry.id === targetEntry.id) return false;
  return sameStackableItem(sourceEntry, targetEntry);
}

function rejectInventoryMove(message) {
  if (message) G.pushBattleLog(message);
  sceneSignature = "";
  G.renderSceneOverlay();
}

async function storeInventoryEntryInStorage(entryId, slot, sourceEquipmentSlot = null) {
  G.ensureInventorySlots();
  G.ensureStorageSlots();
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return false;

  const maxSlots = state.account.storage.maxSlots;
  const targetSlot = Math.max(0, Math.min(maxSlots - 1, Number(slot)));
  const targetEntry = G.storageEntryAtSlot(targetSlot);
  if (targetEntry && G.mergeEntryIntoStack(entry, targetEntry)) {
    G.clearHotbarEntry(entry.id);
    state.inventory.items = state.inventory.items.filter((candidate) => candidate.id !== entry.id);
    G.renderStorageMove({ hotbarChanged: true });
    return true;
  }
  if (targetEntry && sameStackableItem(entry, targetEntry)) {
    G.renderStorageMove();
    return true;
  }

  const destinationSlot = targetEntry ? G.nextFreeStorageSlot() : targetSlot;
  if (destinationSlot >= maxSlots) {
    rejectInventoryMove("Storage is full.");
    return false;
  }

  const actualEquipmentSlot = sourceEquipmentSlot && state.inventory.equipment[sourceEquipmentSlot] === entry.id
    ? sourceEquipmentSlot
    : G.equippedSlotForEntry(entry.id);
  const sourceHotbarSlot = G.hotbarSlotForEntry(entry.id);
  const equipmentChanged = Boolean(actualEquipmentSlot);
  const hotbarChanged = sourceHotbarSlot >= 0;

  if (actualEquipmentSlot) state.inventory.equipment[actualEquipmentSlot] = null;
  if (hotbarChanged) state.hotbar.slots[sourceHotbarSlot] = null;
  state.inventory.items = state.inventory.items.filter((candidate) => candidate.id !== entry.id);
  entry.id = G.allocateStorageEntryId();
  entry.slot = destinationSlot;
  state.account.storage.items.push(entry);

  if (equipmentChanged) {
    G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
    await G.applyEquipmentChanges();
    G.renderStorageMove({ hotbarChanged, equipmentChanged: true });
    return true;
  }
  G.renderStorageMove({ hotbarChanged });
  return true;
}

function withdrawStorageEntryToInventorySlot(entryId, slot) {
  G.ensureInventorySlots();
  G.ensureStorageSlots();
  const entry = G.storageEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return false;

  const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
  const targetEntry = G.inventoryEntryAtSlot(targetSlot);
  if (targetEntry && G.mergeEntryIntoStack(entry, targetEntry)) {
    state.account.storage.items = state.account.storage.items.filter((candidate) => candidate.id !== entry.id);
    G.renderStorageMove();
    return true;
  }
  if (targetEntry && sameStackableItem(entry, targetEntry)) {
    G.renderStorageMove();
    return true;
  }

  const destinationSlot = targetEntry ? G.nextFreeInventorySlot() : targetSlot;
  if (destinationSlot >= state.inventory.maxSlots) {
    rejectInventoryMove("Inventory is full.");
    return false;
  }

  state.account.storage.items = state.account.storage.items.filter((candidate) => candidate.id !== entry.id);
  entry.id = G.allocateInventoryEntryId();
  entry.slot = destinationSlot;
  state.inventory.items.push(entry);
  G.renderStorageMove();
  return true;
}

function syncBattleCamera(now = performance.now()) {
  // Map-stamp arenas (KR boss rooms) anchor art in world space. Locking the camera while
  // characters move makes the stamp slide out of sync with sprites — follow the player instead.
  const stamp = G.currentZoneMapStamp();
  const locked = state.battle.lockedCameraX ?? state.battle.bossParty?.lockedCameraX;
  if (!stamp && locked != null) {
    state.battle.cameraX = locked;
    return;
  }

  const party = state.battle.bossParty;
  const desired = state.battle.playerX - G.playerScreenX();

  if (stamp && party?.active && G.bossPartyMemberSteppingToMelee()) {
    party.cameraLerpUntil = 0;
    if (party.meleeStepCameraX == null) {
      party.meleeStepCameraX = Number.isFinite(state.battle.cameraX)
        ? state.battle.cameraX
        : desired;
    }
    state.battle.cameraX = party.meleeStepCameraX;
    return;
  }

  if (party?.meleeStepCameraX != null) {
    party.cameraLerpFromX = party.meleeStepCameraX;
    party.cameraLerpToX = desired;
    party.cameraLerpUntil = now + BOSS_PARTY_CAMERA_LERP_MS;
    party.meleeStepCameraX = null;
  }

  if (party?.cameraLerpUntil && now < party.cameraLerpUntil) {
    const span = BOSS_PARTY_CAMERA_LERP_MS;
    const t = Math.min(1, Math.max(0, 1 - (party.cameraLerpUntil - now) / span));
    state.battle.cameraX = Math.round(
      party.cameraLerpFromX + (party.cameraLerpToX - party.cameraLerpFromX) * t,
    );
    return;
  }
  if (party) party.cameraLerpUntil = 0;

  state.battle.cameraX = desired;
}

function weaponEntryLuck(entry, item = G.itemDefinition(entry?.itemId)) {
  if (!entry || item?.slot !== "weapon") return 0;
  return Math.trunc(Number(G.sanitizeItemBonusStats(entry.bonusStats).luck) || 0);
}

function rollBenedictionOilOutcome(weaponLuck) {
  const luck = Math.trunc(Number(weaponLuck) || 0);
  if (luck >= BENEDICTION_MAX_WEAPON_LUCK) return null;
  if (luck > -CRYSTAL_MAX_LUCK && Math.floor(Math.random() * 20) === 0) return "curse";
  if (Math.random() < G.benedictionBlessChance(luck)) return "bless";
  return "none";
}

async function useInventoryEntry(entryId) {
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return;
  if (G.isBookItem(item)) {
    G.learnSpellFromBook(entryId);
    return;
  }
  if (G.isPotionItem(item)) {
    usePotionEntry(entryId);
    return;
  }
  if (G.isBenedictionOilItem(item)) {
    useBenedictionOilEntry(entryId);
    return;
  }
  await G.equipInventoryEntry(entryId);
}

function useBenedictionOilEntry(entryId) {
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item || !G.isBenedictionOilItem(item)) return false;

  const weaponEntryId = state.inventory.equipment?.weapon ?? null;
  const weaponEntry = weaponEntryId ? G.inventoryEntryById(weaponEntryId) : null;
  const weaponItem = weaponEntry ? G.itemDefinition(weaponEntry.itemId) : null;
  if (!weaponEntry || !weaponItem || weaponItem.slot !== "weapon") {
    G.pushBattleLog("Equip a weapon before using Benediction Oil.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const currentLuck = weaponEntryLuck(weaponEntry, weaponItem);
  if (currentLuck >= BENEDICTION_MAX_WEAPON_LUCK) {
    G.pushBattleLog(`${G.itemDisplayName(weaponItem, weaponEntry)} already has maximum luck.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  G.removeInventoryEntry(entry.id, 1);
  weaponEntry.bonusStats = G.sanitizeItemBonusStats(weaponEntry.bonusStats);
  const outcome = rollBenedictionOilOutcome(currentLuck);
  const weaponName = G.itemDisplayName(weaponItem, weaponEntry);
  if (outcome === "bless") {
    weaponEntry.bonusStats.luck = Math.min(BENEDICTION_MAX_WEAPON_LUCK, currentLuck + 1);
    G.pushBattleLog(`Benediction Oil blessed ${weaponName}: ${G.benedictionLuckLabel(weaponEntry.bonusStats.luck)}.`);
    G.playSfx("item.equip.weapon", { volume: 0.42, throttleMs: 120 });
  } else if (outcome === "curse") {
    weaponEntry.bonusStats.luck = Math.max(-CRYSTAL_MAX_LUCK, currentLuck - 1);
    G.pushBattleLog(`Benediction Oil cursed ${weaponName}: ${G.benedictionLuckLabel(weaponEntry.bonusStats.luck)}.`);
    G.playSfx("combat.miss", { volume: 0.34, throttleMs: 120 });
  } else {
    G.pushBattleLog(`Benediction Oil had no effect on ${weaponName}.`);
    G.playSfx("combat.miss", { volume: 0.24, throttleMs: 120 });
  }

  G.applyEquippedStatsToBattlePlayer();
  G.syncBossPartyControlledInventoryFromState();
  G.hideItemTooltip();
  playerHudSignature = "";
  battlePanelSignature = "";
  gamePanelSignature = "";
  sceneSignature = "";
  hotbarSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderPlayerResourceHud();
  G.renderHotbar();
  return true;
}

function useFirstPotionOfKind(kind) {
  const entry = G.firstPotionEntryForKind(kind);
  if (!entry) {
    G.pushBattleLog(`No ${kind.toUpperCase()} potion available.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  return usePotionEntry(entry.id, kind);
}

function usePotionEntry(entryId, preferredKind = null, options = {}) {
  const now = options.now ?? performance.now();
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  const player = state.battle.player;
  if (!entry || !item || !G.isPotionItem(item) || !player) return false;
  if (isBuffPotionItem(item)) return useBuffPotionEntry(entryId, options);
  if (player.hp <= 0) {
    G.pushBattleLog(`Cannot use ${item.name} while defeated.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const hpRestore = G.potionRestoreAmount(item, "hp");
  const mpRestore = G.potionRestoreAmount(item, "mp");
  const canRestoreHp = hpRestore > 0 && player.hp < player.maxHp;
  const canRestoreMp = mpRestore > 0 && player.mp < player.maxMp;
  if (!canRestoreHp && !canRestoreMp) {
    G.pushBattleLog(`${item.name} has no effect at full ${preferredKind ? preferredKind.toUpperCase() : "HP/MP"}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  G.removeInventoryEntry(entry.id, 1);
  const parts = G.potionRestoreParts(hpRestore, mpRestore);
  if (G.potionRestoreMode(item) === "instant") {
    const hpBefore = player.hp;
    const mpBefore = player.mp;
    if (hpRestore > 0) player.hp = Math.min(player.maxHp, player.hp + hpRestore);
    if (mpRestore > 0) player.mp = Math.min(player.maxMp, player.mp + mpRestore);
    const restoredHp = player.hp - hpBefore;
    const restoredMp = player.mp - mpBefore;
    G.pushBattleLog(`${options.auto ? "Auto used" : "Used"} ${item.name}: restored ${G.potionRestoreParts(restoredHp, restoredMp)}.`);
    if (restoredHp > 0) G.addCombatText("player", `+${restoredHp} HP`, "heal", now);
    if (restoredMp > 0) G.addCombatText("player", `+${restoredMp} MP`, "mana", now);
  } else {
    queuePotionRestore(hpRestore, mpRestore, now);
    G.pushBattleLog(`${options.auto ? "Auto used" : "Used"} ${item.name}: recovering ${parts} over time.`);
  }
  G.playSfx("item.potion.use", { volume: options.auto ? 0.36 : 0.5, throttleMs: 100 });
  G.hideItemTooltip();
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  sceneSignature = "";
  G.renderSceneOverlay();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
  G.renderPlayerResourceHud();
  G.renderHotbar();
  if (G.bossPartyActiveFight()) {
    G.syncBossPartyControlledInventoryFromState();
    G.syncBossPartyControlledRecoveryFromState();
  }
  return true;
}

function useBuffPotionEntry(entryId, options = {}) {
  const now = options.now ?? performance.now();
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  const player = state.battle.player;
  const def = buffPotionDefForItem(item);
  const combatClass = state.battle.combatClass ?? state.activeCharacterId ?? PLAYER_TEMPLATE.class;
  if (!entry || !item || !def || !player) return false;
  if (player.hp <= 0) {
    G.pushBattleLog(`Cannot use ${item.name} while defeated.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  if (!def.classes.includes(combatClass)) {
    G.pushBattleLog(`${item.name} is for ${def.classes.join(" / ")} only.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  G.removeInventoryEntry(entry.id, 1);
  if (!Array.isArray(state.battle.statBuffs)) state.battle.statBuffs = [];
  state.battle.statBuffs = state.battle.statBuffs.filter((buff) => buff.kind !== def.kind);
  state.battle.statBuffs.push({
    kind: def.kind,
    label: def.label,
    stat: def.stat,
    minBonus: def.minBonus,
    maxBonus: def.maxBonus,
    expiresAt: now + BUFF_POTION_DURATION_MS,
  });
  G.applyEquippedStatsToBattlePlayer();

  const bonusText = statBuffBonusLabel(def);
  const durationText = formatBuffRemaining(BUFF_POTION_DURATION_MS);
  G.pushBattleLog(
    `${options.auto ? "Auto used" : "Used"} ${item.name}: ${def.label} buff ${bonusText} for ${durationText}.`,
  );
  G.addCombatText("player", `${def.label} ${bonusText}`, "buff", now);
  G.playSfx("item.potion.use", { volume: options.auto ? 0.36 : 0.5, throttleMs: 100 });
  G.hideItemTooltip();
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  sceneSignature = "";
  G.renderSceneOverlay();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
  G.renderPlayerResourceHud();
  G.renderHotbar();
  if (G.bossPartyActiveFight()) {
    G.syncBossPartyControlledInventoryFromState();
    G.syncBossPartyControlledRecoveryFromState();
  }
  return true;
}

function updateStatBuffs(now = performance.now()) {
  const before = state.battle.statBuffs?.length ?? 0;
  const beforePet = state.battle.petStatBuffs?.length ?? 0;
  let pruned = pruneStatBuffs(state.battle.statBuffs ?? [], now);
  const prunedPet = pruneStatBuffs(state.battle.petStatBuffs ?? [], now);
  let memberBuffsChanged = false;
  if (G.bossPartyActiveFight()) {
    for (const member of state.battle.bossParty?.members ?? []) {
      const beforeMemberBuffs = member.statBuffs ?? [];
      const prunedMember = pruneStatBuffs(beforeMemberBuffs, now);
      if (prunedMember.length !== beforeMemberBuffs.length
        || prunedMember.some((buff, index) => buff !== beforeMemberBuffs[index])) {
        member.statBuffs = prunedMember;
        memberBuffsChanged = true;
      }
    }
    const leader = G.bossPartyLeaderMember();
    if (leader?.classId === G.bossPartyLeaderClassId()) {
      const leaderBuffs = leader.statBuffs ?? [];
      if (leaderBuffs.length !== pruned.length || leaderBuffs.some((buff, index) => buff !== pruned[index])) {
        pruned = [...leaderBuffs];
        memberBuffsChanged = true;
      }
    }
  }
  if (pruned.length === before && prunedPet.length === beforePet && !memberBuffsChanged) return false;
  state.battle.statBuffs = pruned;
  state.battle.petStatBuffs = prunedPet;
  G.applyEquippedStatsToBattlePlayer();
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  refreshCharacterStatsOverlay();
  return true;
}

function refreshCharacterStatsOverlay() {
  sceneSignature = "";
  if (state.openScenes.character) G.renderSceneOverlay();
}

function updateAutoPotions(now) {
  const player = state.battle.player;
  if (!player || player.hp <= 0) return false;
  if (!state.battle.autoPotionReadyAt) state.battle.autoPotionReadyAt = { hp: 0, mp: 0 };

  let used = false;
  const resources = ["hp", "mp"].sort((a, b) => resourceRatio(a) - resourceRatio(b));
  for (const kind of resources) {
    if (G.autoUsePotionForKind(kind, now)) used = true;
  }
  return used;
}

function shouldAutoUsePotion(kind, now) {
  const player = state.battle.player;
  if (!player) return false;
  if (resourceRatio(kind) >= AUTO_POTION_THRESHOLD) return false;
  if ((state.battle.autoPotionReadyAt?.[kind] ?? 0) > now) return false;
  if (kind === "hp" && (state.battle.potHealthAmount ?? 0) > 0) return false;
  if (kind === "mp" && (state.battle.potManaAmount ?? 0) > 0) return false;
  return true;
}

function resourceRatio(kind) {
  const player = state.battle.player;
  if (!player) return 1;
  const maxKey = kind === "hp" ? "maxHp" : "maxMp";
  const max = Math.max(0, Number(player[maxKey]) || 0);
  if (max <= 0) return 1;
  return Math.max(0, Math.min(1, (Number(player[kind]) || 0) / max));
}

function useHotbarSlot(slot) {
  const entry = G.hotbarEntryAtSlot(G.hotbarSlotIndex(slot));
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) {
    G.pushBattleLog(`Hotbar ${G.hotbarSlotIndex(slot) + 1} is empty.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  if (!G.isPotionItem(item)) {
    G.pushBattleLog(`${item.name} cannot be used from the potion hotbar.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  return usePotionEntry(entry.id);
}

function queuePotionRestore(hpRestore, mpRestore, now = performance.now()) {
  state.battle.potHealthAmount = Math.min(65535, (state.battle.potHealthAmount ?? 0) + hpRestore);
  state.battle.potManaAmount = Math.min(65535, (state.battle.potManaAmount ?? 0) + mpRestore);
  if (!state.battle.potTickAt) state.battle.potTickAt = now + CRYSTAL_POT_DELAY_MS;
  if (G.bossPartyActiveFight()) {
    const member = G.bossPartyControlledMember();
    if (member) {
      member.potHealthAmount = state.battle.potHealthAmount;
      member.potManaAmount = state.battle.potManaAmount;
      member.potTickAt = state.battle.potTickAt;
    }
  }
}

function updatePotionRegen(now) {
  const player = state.battle.player;
  if (!player || player.hp <= 0) return false;

  let changed = false;
  if (player.hp >= player.maxHp && state.battle.potHealthAmount > 0) {
    state.battle.potHealthAmount = 0;
    changed = true;
  }
  if (player.mp >= player.maxMp && state.battle.potManaAmount > 0) {
    state.battle.potManaAmount = 0;
    changed = true;
  }

  if (state.battle.potHealthAmount <= 0 && state.battle.potManaAmount <= 0) {
    state.battle.potTickAt = 0;
    return changed;
  }

  if (!state.battle.potTickAt) {
    state.battle.potTickAt = now + CRYSTAL_POT_DELAY_MS;
    return changed;
  }

  let steps = 0;
  while (
    now >= state.battle.potTickAt &&
    steps < 20 &&
    (state.battle.potHealthAmount > 0 || state.battle.potManaAmount > 0)
  ) {
    state.battle.potTickAt += CRYSTAL_POT_DELAY_MS;
    steps += 1;
    const tickAmount = G.crystalPotionTickAmount();

    if (state.battle.potHealthAmount > 0) {
      const amount = Math.min(tickAmount, state.battle.potHealthAmount);
      state.battle.potHealthAmount -= amount;
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + amount);
      const applied = player.hp - before;
      if (applied > 0) G.addCombatText("player", `+${applied} HP`, "heal");
      if (player.hp >= player.maxHp) state.battle.potHealthAmount = 0;
      changed = true;
    }

    if (state.battle.potManaAmount > 0) {
      const amount = Math.min(tickAmount, state.battle.potManaAmount);
      state.battle.potManaAmount -= amount;
      const before = player.mp;
      player.mp = Math.min(player.maxMp, player.mp + amount);
      const applied = player.mp - before;
      if (applied > 0) G.addCombatText("player", `+${applied} MP`, "mana");
      if (player.mp >= player.maxMp) state.battle.potManaAmount = 0;
      changed = true;
    }
  }

  if (steps >= 20 && (state.battle.potHealthAmount > 0 || state.battle.potManaAmount > 0)) {
    state.battle.potTickAt = now + CRYSTAL_POT_DELAY_MS;
  }
  if (state.battle.potHealthAmount <= 0 && state.battle.potManaAmount <= 0) state.battle.potTickAt = 0;
  if (changed) {
    playerHudSignature = "";
    battlePanelSignature = "";
    combatSkillBarSignature = "";
    sceneSignature = "";
  }
  return changed;
}

function queueHealingRestore(amount, now = performance.now(), target = "player") {
  const value = Math.max(0, Math.trunc(Number(amount) || 0));
  if (value <= 0) return false;
  if (target === "pet") {
    const pet = state.battle.taoPet;
    if (!pet?.active || pet.hp <= 0) return false;
    pet.healAmount = Math.min(65535, (pet.healAmount ?? 0) + value);
    if (!pet.healTickAt) pet.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
    return true;
  }
  state.battle.healAmount = Math.min(65535, (state.battle.healAmount ?? 0) + value);
  if (!state.battle.healTickAt) state.battle.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
  return true;
}

function updatePendingHeal(now) {
  const battle = state.battle;
  const pending = battle.pendingHeal;
  if (!pending || now < pending.at || !battle.player || battle.player.hp <= 0) return false;
  battle.pendingHeal = null;
  const spell = G.taoistCombatSpell(pending.spellId);
  const amount = Math.max(0, Math.trunc(Number(pending.amount) || 0));
  const target = pending.target === "pet" ? "pet" : "player";
  const targetStats = target === "pet" ? battle.taoPet : battle.player;
  if (!targetStats || targetStats.hp >= targetStats.maxHp || amount <= 0) return false;
  queueHealingRestore(amount, now, target);
  const learned = G.learnedMagic(spell.id);
  if (learned) G.levelMagicSkill(spell, learned, now);
  if (!suppressSimulationRender) {
    G.playSpellSfx(spell.id, "impact", { volume: 0.46 }) || G.playSpellSfx(spell.id, "cast", { volume: 0.42 });
    G.addCombatText(target, `+${amount} queued`, "heal", now);
    G.pushBattleLog(`${spell.label} starts restoring ${amount} HP to ${target === "pet" ? targetStats.name : battle.combatClass}.`);
  }
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  return true;
}

function updatePendingPoison(now, options = {}) {
  const battle = state.battle;
  const pending = battle.pendingPoison;
  if (!pending || now < pending.at || !battle.enemy || battle.enemy.hp <= 0) return false;
  battle.pendingPoison = null;
  const spell = G.taoistCombatSpell(pending.spellId);
  const learned = G.learnedMagic(spell.id);
  const level = Math.max(0, Math.min(3, Math.trunc(Number(learned?.level) || 0)));
  const value = Math.max(0, Math.trunc(Number(pending.value) || 0));
  const durationTicks = Math.max(1, value * 2 + (level + 1) * 7);
  const poisonKind = pending.kind === "green" ? "green" : "yellow";
  const poisonAttack = Math.max(0, Math.trunc(Number(battle.player?.poisonAttack) || 0));
  const tickValue = poisonKind === "green"
    ? Math.max(1, Math.floor(value / 15) + level + 1 + (poisonAttack > 0 ? randomInt(0, poisonAttack - 1) : 0))
    : 0;
  const applied = G.applyEnemyPoison(battle.enemy, {
    kind: poisonKind,
    value: tickValue,
    ticksRemaining: durationTicks,
  }, now);

  if (learned) G.levelMagicSkill(spell, learned, now);
  if (!options.offline && !suppressSimulationRender) {
    G.playSpellSfx(spell.id, "impact", { volume: 0.5 }) || G.playSpellSfx(spell.id, "cast", { volume: 0.42 });
    const label = poisonKind === "green" ? "Green Poison" : "Yellow Poison";
    G.addCombatText("enemy", poisonKind === "green" ? "Poison" : "Weaken", poisonKind === "green" ? "poison" : "debuff", now);
    G.pushBattleLog(applied ? `${label} affects ${battle.enemy.name}.` : `${battle.enemy.name} resists the weaker ${label}.`);
  }
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  return applied;
}

function updateEnemyPoisons(now, options = {}) {
  const battle = state.battle;
  const enemy = battle.enemy;
  if (!enemy || enemy.hp <= 0 || !Array.isArray(enemy.poisons) || enemy.poisons.length === 0) return false;

  let changed = false;
  const active = [];
  for (const poison of enemy.poisons) {
    poison.tickMs = Math.max(1, Math.trunc(Number(poison.tickMs) || CRYSTAL_POISON_TICK_MS));
    poison.nextTickAt = Number(poison.nextTickAt) || now + poison.tickMs;
    poison.ticksRemaining = Math.max(0, Math.trunc(Number(poison.ticksRemaining) || 0));

    let steps = 0;
    while (enemy.hp > 0 && poison.ticksRemaining > 0 && now >= poison.nextTickAt && steps < 20) {
      const tickAt = poison.nextTickAt;
      poison.nextTickAt += poison.tickMs;
      poison.ticksRemaining -= 1;
      steps += 1;
      changed = true;

      if (poison.kind === "green") {
        const damage = Math.max(0, Math.trunc(Number(poison.value) || 0));
        if (damage > 0) {
          G.reduceEnemyHp(enemy, damage);
          if (!options.offline && !suppressSimulationRender) G.addCombatText("enemy", damage, "poison", tickAt);
        }
      }
    }

    if (steps >= 20 && poison.ticksRemaining > 0) poison.nextTickAt = now + poison.tickMs;
    if (poison.ticksRemaining > 0 && enemy.hp > 0) active.push(poison);
  }

  enemy.poisons = active;
  if (changed) {
    battlePanelSignature = "";
    playerHudSignature = "";
  }

  if (enemy.hp <= 0 && !options.offline && !suppressSimulationRender) {
    if (G.groupDungeonSwarmActive()) {
      syncBattleEnemyHpToSwarm();
      G.maybeKillGroupDungeonSwarmEnemy(enemy, now);
    } else {
      G.finishEnemy(now);
      G.setEnemyAction("die", false, now);
      G.playMonsterSfx("death");
      G.pushBattleLog(`${enemy.name} is defeated by poison.`);
    }
  }

  return changed;
}

function updateHealingRegen(now) {
  const player = state.battle.player;
  const battle = state.battle;
  const petChanged = updateTaoistPetHealingRegen(now);
  if (!player || player.hp <= 0) return petChanged;

  let changed = petChanged;
  if (player.hp >= player.maxHp && battle.healAmount > 0) {
    battle.healAmount = 0;
    changed = true;
  }

  if ((battle.healAmount ?? 0) <= 0) {
    battle.healTickAt = 0;
    return changed;
  }

  if (!battle.healTickAt) {
    battle.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
    return changed;
  }

  let steps = 0;
  while (now >= battle.healTickAt && steps < 20 && battle.healAmount > 0) {
    const tickAt = battle.healTickAt;
    battle.healTickAt += CRYSTAL_HEAL_DELAY_MS;
    steps += 1;
    const amount = Math.min(
      G.crystalHealRegenTickAmount(battle.healAmount, state.game.progress.level ?? player.level ?? 1),
      battle.healAmount,
    );
    battle.healAmount -= amount;
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + amount);
    const applied = player.hp - before;
    if (applied > 0 && !suppressSimulationRender) G.addCombatText("player", `+${applied} HP`, "heal", tickAt);
    if (player.hp >= player.maxHp) battle.healAmount = 0;
    changed = true;
  }

  if (steps >= 20 && battle.healAmount > 0) battle.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
  if (battle.healAmount <= 0) battle.healTickAt = 0;
  if (changed) {
    playerHudSignature = "";
    battlePanelSignature = "";
    combatSkillBarSignature = "";
    sceneSignature = "";
  }
  return changed;
}

function updateTaoistPetHealingRegen(now) {
  const pet = state.battle.taoPet;
  if (!pet?.active || pet.hp <= 0) return false;

  let changed = false;
  if (pet.hp >= pet.maxHp && pet.healAmount > 0) {
    pet.healAmount = 0;
    changed = true;
  }

  if ((pet.healAmount ?? 0) <= 0) {
    pet.healTickAt = 0;
    return changed;
  }

  if (!pet.healTickAt) {
    pet.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
    return changed;
  }

  let steps = 0;
  while (now >= pet.healTickAt && steps < 20 && pet.healAmount > 0 && pet.hp > 0) {
    const tickAt = pet.healTickAt;
    pet.healTickAt += CRYSTAL_HEAL_DELAY_MS;
    steps += 1;
    const amount = Math.min(
      G.crystalHealRegenTickAmount(pet.healAmount, state.game.progress.level ?? 1),
      pet.healAmount,
    );
    pet.healAmount -= amount;
    const before = pet.hp;
    pet.hp = Math.min(pet.maxHp, pet.hp + amount);
    const applied = pet.hp - before;
    if (applied > 0 && !suppressSimulationRender) G.addCombatText("pet", `+${applied} HP`, "heal", tickAt);
    if (pet.hp >= pet.maxHp) pet.healAmount = 0;
    changed = true;
  }

  if (steps >= 20 && pet.healAmount > 0) pet.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
  if (pet.healAmount <= 0) pet.healTickAt = 0;
  if (changed) {
    battlePanelSignature = "";
    combatSkillBarSignature = "";
  }
  return changed;
}

function targetEquipmentSlot(item) {
  const slots = G.compatibleEquipmentSlots(item);
  if (slots.length === 0) return null;
  return slots.find((slot) => !state.inventory.equipment[slot]) ?? slots[0];
}

function updateEnemyActionButtons() {
  els.enemyControls.querySelectorAll("[data-enemy-action]").forEach((button) => {
    button.classList.toggle("active", button.dataset.enemyAction === state.enemy.action);
  });
}

function testLevelUpCharacter() {
  const needed = xpForNextLevel(state.game.progress.level) - state.game.progress.experience;
  if (!Number.isFinite(needed)) return;
  const levels = G.applyExperienceReward(Math.max(1, needed));
  if (levels.length) {
    G.pushBattleLog(`Level up: ${levels.at(-1)}.`);
    G.addLootNotice(`Level ${levels.at(-1)}`, "level");
  }
  state.battle.level = state.game.progress.level;
  state.battle.experience = state.game.progress.experience;
  gamePanelSignature = "";
  battlePanelSignature = "";
  sceneSignature = "";
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderSceneOverlay();
  G.render();
}

function recentLootHtml() {
  if (!state.game.recentLoot.length) return "";
  return `
    <section class="recent-loot">
      <strong>Recent Loot</strong>
      ${state.game.recentLoot.map((line) => `<span>${G.escapeHtml(line)}</span>`).join("")}
    </section>
  `;
}

function sceneButtonsHtml() {
  return `
    <div class="scene-buttons">
      <button data-open-scene="character" class="${state.openScenes.character ? "active" : ""}">Character</button>
      <button data-open-scene="inventory" class="${state.openScenes.inventory ? "active" : ""}">Inventory</button>
      <button data-open-scene="upgrades" class="${state.openScenes.upgrades ? "active" : ""}">Upgrades</button>
      <button data-open-scene="characterSelect" class="${state.openScenes.characterSelect ? "active" : ""}">Characters</button>
      <button data-open-scene="gettingStarted" class="${state.openScenes.gettingStarted ? "active" : ""}">Guide</button>
      <button data-open-scene="options" class="${state.openScenes.options ? "active" : ""}">Options</button>
    </div>
  `;
}

function setSceneUrl() {
  const url = new URL(window.location.href);
  const open = Object.entries(state.openScenes).filter(([, enabled]) => enabled).map(([scene]) => scene);
  if (open.length === 2 && open.includes("character") && open.includes("inventory")) url.searchParams.set("scene", "both");
  else if (open.length === 1) url.searchParams.set("scene", open[0]);
  else if (open.length > 1) url.searchParams.set("scene", open.join(","));
  else url.searchParams.delete("scene");
  window.history.pushState({ scene: url.searchParams.get("scene") }, "", url);
}

function sceneWindowHtml(scene) {
  return `
    <div class="${sceneClassName(scene)}" data-scene-window="${scene}">
      <header class="scene-header">
        <div>
          <p class="eyebrow">Town Menu</p>
          <h2>${G.escapeHtml(sceneTitle(scene))}</h2>
        </div>
        <button data-close-scene="${scene}">Back</button>
      </header>
      ${sceneBodyHtml(scene)}
    </div>
  `;
}

function sceneClassName(scene) {
  if (scene === "characterSelect") return "scene-window character-select-window";
  if (scene === "townNpc") return "scene-window npc-dialog-window";
  if (scene === "bossEntry") return "scene-window boss-entry-window";
  if (scene === "storage") return "scene-window storage-window";
  if (scene === "weaponRefine") return "scene-window weapon-refine-window";
  if (scene === "inventory") return "scene-window inventory-window";
  if (scene === "character") return "scene-window character-window";
  if (scene === "upgrades") return "scene-window upgrades-window";
  if (scene === "gettingStarted") return "scene-window getting-started-window";
  if (scene === "options") return "scene-window options-window";
  return "scene-window";
}

function sceneTitle(scene) {
  if (scene === "characterSelect") return "Character Select";
  if (scene === "character") return "Character";
  if (scene === "inventory") return "Inventory";
  if (scene === "storage") return "Storage";
  if (scene === "weaponRefine") return "Weapon Refine";
  if (scene === "upgrades") return "Upgrades";
  if (scene === "gettingStarted") return "Getting Started";
  if (scene === "options") return "Options";
  if (scene === "bossEntry") {
    const zone = G.bossEntryZone();
    if (G.groupDungeonZone(zone)) return zone?.label ?? "Group Dungeon";
    return G.bossRoomDef(zone?.id)?.bossName ?? "Boss Room";
  }
  return G.selectedTownNpc()?.label ?? "NPC";
}

function sceneBodyHtml(scene) {
  if (scene === "characterSelect") return G.characterSelectSceneHtml();
  if (scene === "character") return G.characterSceneHtml();
  if (scene === "inventory") return G.inventorySceneHtml();
  if (scene === "storage") return G.storageSceneHtml();
  if (scene === "upgrades") return upgradesSceneHtml();
  if (scene === "gettingStarted") return G.gettingStartedSceneHtml();
  if (scene === "options") return G.optionsSceneHtml();
  if (scene === "bossEntry") return G.bossEntrySceneHtml();
  if (scene === "weaponRefine") return G.weaponRefineSceneHtml();
  if (scene === "townNpc") return G.townNpcSceneHtml();
  return "";
}

function selectedBossAssistIds() {
  return new Set((state.bossAssistSelection ?? []).filter((classId) => (
    classId !== state.activeCharacterId
      && BOSS_ASSIST_OPTIONS.some((option) => option.classId === classId)
      && G.characterAvailableForBossAssist(classId)
  )));
}

function toggleBossAssistSelection(classId) {
  const option = BOSS_ASSIST_OPTIONS.find((entry) => entry.classId === classId);
  if (!option || !G.characterAvailableForBossAssist(classId)) return false;
  const selected = selectedBossAssistIds();
  if (selected.has(classId)) selected.delete(classId);
  else selected.add(classId);
  state.bossAssistSelection = [...selected].sort((a, b) => BOSS_PARTY_ORDER.indexOf(a) - BOSS_PARTY_ORDER.indexOf(b));
  sceneSignature = "";
  G.renderSceneOverlay();
  G.playSfx("ui.button", { volume: 0.35, throttleMs: 80 });
  return true;
}

function toggleBossEmpowerSelection() {
  if (!G.bossEmpowermentUnlocked()) return false;
  state.bossEmpowerSelected = !state.bossEmpowerSelected;
  sceneSignature = "";
  G.renderSceneOverlay();
  G.playSfx("ui.button", { volume: 0.35, throttleMs: 80 });
  return true;
}

function upgradesSceneHtml() {
  const autoCastSlots = G.autoCastSlotLimit();
  const autoPotionSlotCount = G.autoPotionSlotLimit();
  const xpBonus = G.accountUpgradeValue("xpBonusPercent");
  const baseLuckBonus = G.accountUpgradeValue("baseLuck");
  const awakenedSouls = G.accountAwakenedSoulCount();
  const rebirthPoints = G.accountRebirthPoints();
  const rebirthReady = G.canPerformRebirth();
  state.upgradeCategory = G.normalizeUpgradeCategory(state.upgradeCategory);
  const category = G.activeUpgradeCategory();
  const upgrades = G.accountUpgradesForCategory(category.id);
  const rebirthPanel = category.id === "rebirth" ? `
      <div class="upgrade-rebirth-panel">
        <div class="upgrade-rebirth-balance">
          <span>Awakening Souls</span>
          <strong>${awakenedSouls}</strong>
        </div>
        <div class="upgrade-rebirth-balance">
          <span>Rebirth Points</span>
          <strong>${rebirthPoints}</strong>
        </div>
        <p class="upgrade-rebirth-note">
          Awakening Souls are account-wide (every character plus storage). Boss drops:
          ${AWAKENING_SOUL_BOSS_SOURCES.map((name) => G.escapeHtml(name)).join(", ")}.
          Rebirth converts all souls into Rebirth Points; spend points on the upgrades below.
        </p>
        <div class="upgrade-rebirth-action">
          <button type="button" class="primary" data-perform-rebirth ${rebirthReady ? "" : "disabled"}>
            Rebirth
          </button>
          <span class="upgrade-rebirth-hint">
            ${!REBIRTH_ENABLED
              ? "Rebirth is coming soon. Awakening Souls and Rebirth Points are being prepared for a future update."
              : rebirthReady
                ? "Reset every character to level 1 with starter gear. Clears inventory, equipment, storage, and non-rebirth upgrades. Converts all Awakening Souls into Rebirth Points."
                : "Collect at least 1 Awakening Soul account-wide before rebirthing."
            }
          </span>
        </div>
      </div>
    ` : "";
  return `
    <section class="upgrades-panel">
      <div class="upgrade-summary">
        <div>
          <strong>Upgrade Hub</strong>
          <span>Permanent account unlocks, rebirth buffs, and boss tools.</span>
        </div>
        <em>Account-wide</em>
      </div>
      <div class="upgrade-current-grid">
        <div class="upgrade-current">
          <span>Autocast slots</span>
          <strong>${autoCastSlots}/${G.maxAutoCastSlotLimit()}</strong>
        </div>
        <div class="upgrade-current">
          <span>Auto potion slots</span>
          <strong>${autoPotionSlotCount}/${G.maxAutoPotionSlotLimit()}</strong>
        </div>
        <div class="upgrade-current">
          <span>Rebirth Points</span>
          <strong>${rebirthPoints}</strong>
        </div>
        <div class="upgrade-current">
          <span>XP bonus</span>
          <strong>+${xpBonus}%</strong>
        </div>
        <div class="upgrade-current">
          <span>Base luck bonus</span>
          <strong>+${baseLuckBonus}</strong>
        </div>
      </div>
      ${rebirthPanel}
      <div class="upgrade-category-tabs" role="tablist" aria-label="Upgrade categories">
        ${ACCOUNT_UPGRADE_CATEGORIES.map((entry) => `
          <button
            type="button"
            class="${entry.id === category.id ? "active" : ""}"
            data-upgrade-category="${G.escapeHtml(entry.id)}"
          >
            <span>${G.escapeHtml(entry.label)}</span>
            <small>${G.escapeHtml(G.categoryUpgradeCountText(entry.id))}</small>
          </button>
        `).join("")}
      </div>
      <div class="upgrade-category-heading">
        <strong>${G.escapeHtml(category.label)}</strong>
        <span>${G.escapeHtml(category.summary)}</span>
      </div>
      <div class="upgrade-list">
        ${upgrades.map((upgrade) => G.accountUpgradeHtml(upgrade)).join("")}
      </div>
    </section>
  `;
}

function statListHtml(stats) {
  return `
    <dl class="stat-list">
      <dt>HP</dt><dd>${stats.hp ?? stats.maxHp}/${stats.maxHp}</dd>
      <dt>MP</dt><dd>${stats.mp ?? stats.maxMp}/${stats.maxMp}</dd>
      <dt>DC</dt><dd>${formatStatRange(stats.dc)}</dd>
      <dt>MC</dt><dd>${formatStatRange(stats.mc)}</dd>
      <dt>SC</dt><dd>${formatStatRange(stats.sc)}</dd>
      <dt>AC</dt><dd>${formatStatRange(stats.ac)}</dd>
      <dt>AMC</dt><dd>${formatStatRange(stats.amc)}</dd>
      <dt>Acc</dt><dd>${stats.accuracy}</dd>
      <dt>Agi</dt><dd>${stats.agility}</dd>
      <dt>Luck</dt><dd>${stats.luck}</dd>
      <dt>A Speed</dt><dd>${G.characterAttackSpeedLabel()}</dd>
    </dl>
  `;
}

function updateInventoryCarryPointer(event) {
  if (!inventoryDragState) return;
  inventoryDragState.ghost.style.left = `${event.clientX - inventoryDragState.offsetX}px`;
  inventoryDragState.ghost.style.top = `${event.clientY - inventoryDragState.offsetY}px`;
  setInventoryDropTarget(G.inventoryDropTargetAt(event));
}

function setInventoryDropTarget(dropTarget) {
  if (!inventoryDragState || inventoryDragState.dropTarget === dropTarget) return;
  inventoryDragState.dropTarget?.classList.remove("drag-over", "drag-invalid");
  inventoryDragState.dropTarget = dropTarget;
  if (!inventoryDragState.dropTarget) return;
  inventoryDragState.dropTarget.classList.add(G.inventoryDropTargetAccepts(dropTarget) ? "drag-over" : "drag-invalid");
}

function slotLabel(slotId) {
  return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId)?.label ?? G.title(slotId);
}

async function selectPlayerClass(classId) {
  const nextClass = CHARACTER_SELECT_CLASSES.find((entry) => entry.id === classId);
  const combatClass = COMBAT_CLASSES.find((entry) => entry.id === classId);
  if (!nextClass || nextClass.disabled || combatClass?.disabled) return false;

  if (G.bossPartyOnField()) {
    G.pushBattleLog("Return to town before switching characters.");
    G.closeScene("characterSelect");
    return false;
  }

  if (state.battle.combatClass === classId) {
    G.closeScene("characterSelect");
    return true;
  }

  G.captureActiveCharacterState();
  stopOneStepTest();
  state.continuousWalk = false;
  G.applyCharacterState(classId, state.characters[classId] ?? G.createDefaultCharacterState(classId));
  G.resetBattleForCurrentMode(false);
  state.battle.log = [`${classId} selected.`];
  await reloadAtlases();
  await reloadEnemyAtlas();

  G.saveGameState(true);
  G.invalidateUi();
  G.closeScene("characterSelect");
  G.renderMapControls();
  G.renderCombatSkillBar();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.render();
  return true;
}

async function requestZoneEntry(zoneId) {
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId);
  if (!zone) return;
  if (G.bossRoomDef(zone.id) || G.groupDungeonZone(zone)) {
    state.bossEntryZoneId = zone.id;
    state.bossEmpowerSelected = false;
    state.bossAssistSelection = [];
    state.activeScene = "bossEntry";
    sceneSignature = "";
    G.renderSceneOverlay();
    G.playSfx("ui.button", { volume: 0.35, throttleMs: 80 });
    return;
  }
  G.closeScene(false);
  await G.enterZone(zone.id);
}

function returnToTown() {
  G.clearTransientCombatBuffs();
  G.returnAllCharactersToTown();
  state.zoneBuilderPreviewZoneId = null;
  stopOneStepTest();
  state.continuousWalk = false;
  state.showEnemies = false;
  state.game.miningNextRollAt = 0;
  state.battle.running = false;
  state.battle.phase = "idle";
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  G.dismissTaoistPet();
  state.battle.bossParty = null;
  state.battle.groundSpellEffects = [];
  if (state.battle.enemy) state.battle.enemy.poisons = [];
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.furyUntil = 0;
  state.battle.furyBonus = 0;
  state.battle.enemyAggro = false;
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  state.battle.enemyX = state.battle.playerX + G.enemySpawnDistance();
  G.playSfx("ui.teleport", { volume: 0.48, throttleMs: 300 });
  G.applyEquippedVisualIndexes();
  queueVisualAtlasReload(["weapon"]);
  setPlayerAction("standing", performance.now());
  G.setEnemyLocomotion("standing", performance.now());
  G.pushBattleLog("Returned to town.");
  G.applyCharacterState(state.activeCharacterId, state.characters[state.activeCharacterId]);
  G.renderMapControls();
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.render();
}

function resetGroupDungeonRun(now = performance.now()) {
  const zone = G.groupDungeonWaveZone?.() ?? G.activeZone();
  state.battle.swarm = {
    enemies: [],
    nextId: 0,
    lastAdvanceAt: now,
    waves: createGroupDungeonWaveState(now, 1, zone),
  };
  startGroupDungeonWave(now);
  G.markGroupDungeonWaveUiDirty();
}

function startGroupDungeonWave(now = performance.now()) {
  const waves = G.groupDungeonWaveState();
  if (!waves) return;
  const zone = G.groupDungeonWaveZone?.() ?? G.activeZone();
  const swarm = state.battle.swarm;
  if (swarm) {
    swarm.enemies = swarm.enemies.filter((enemy) => enemy.hp > 0 && !enemy.dying);
  }
  waves.targetThisWave = groupDungeonWaveSpawnCount(waves.waveNumber, zone);
  waves.spawnedThisWave = 0;
  waves.killedThisWave = 0;
  waves.spawningComplete = false;
  waves.betweenWaves = false;
  waves.nextSpawnAt = now;
  G.pushBattleLog(`Wave ${waves.waveNumber} — ${waves.targetThisWave} monsters incoming.`);
  spawnGroupDungeonWaveBurst(now);
  if (G.groupDungeonWaveOutstandingCount(waves) <= 0) waves.spawningComplete = true;
  G.invalidateGroupDungeonWaveUi();
}

function reconcileGroupDungeonSwarmDeaths(now = performance.now()) {
  const swarm = state.battle.swarm;
  if (!swarm?.enemies?.length) return;
  for (const enemy of swarm.enemies) {
    if (enemy.hp <= 0 && !enemy.dying) G.onGroupDungeonSwarmEnemyKilled(enemy, now);
  }
}

function reconcileGroupDungeonWaveKillCount() {
  const waves = G.groupDungeonWaveState();
  if (!waves || waves.betweenWaves) return;
  if (G.groupDungeonSwarmLivingCount() > 0) return;
  if (waves.killedThisWave >= waves.spawnedThisWave) return;
  waves.killedThisWave = waves.spawnedThisWave;
  G.markGroupDungeonWaveUiDirty();
}

function spawnGroupDungeonWaveBurst(now = performance.now(), batchSize = null) {
  const waves = G.groupDungeonWaveState();
  if (!waves) return 0;
  const count = batchSize ?? Math.min(
    waves.targetThisWave,
    waves.targetThisWave <= GROUP_DUNGEON_WAVE_INSTANT_CAP
      ? waves.targetThisWave
      : GROUP_DUNGEON_WAVE_FIELD_CAP,
  );
  let spawned = 0;
  for (let i = 0; i < count && waves.spawnedThisWave < waves.targetThisWave; i += 1) {
    if (spawnGroupDungeonSwarmEnemy(now + i * GROUP_DUNGEON_WAVE_BURST_STAGGER_MS)) spawned += 1;
  }
  return spawned;
}

function snapBossPartyMembersToSwarmGrid(members) {
  const front = BOSS_PARTY_ORDER
    .map((classId) => members.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .find(Boolean);
  if (!front) return;
  const current = Math.round(Number(front.worldX) || 0);
  const snapped = swarmSnapTileX(current);
  const delta = snapped - current;
  if (delta === 0) return;
  for (const member of members) {
    if (Number.isFinite(member.worldX)) member.worldX = Math.round(member.worldX + delta);
  }
}

function spawnGroupDungeonSwarmEnemy(now = performance.now(), template = randomZoneEnemyTemplate()) {
  const swarm = state.battle.swarm;
  if (!swarm || !template) return null;
  const waves = swarm.waves;
  if (waves) {
    if (waves.betweenWaves || (waves.floorComplete && !waves.endless)) return null;
    if (G.groupDungeonWaveOutstandingCount(waves) <= 0) return null;
  }
  const living = G.groupDungeonSwarmLivingCount(swarm);
  if (living >= G.groupDungeonWaveFieldCap(waves)) return null;
  const arenaSpawnRow = G.arenaSpawnMapRow();
  const spawnLane = GROUP_DUNGEON_SWARM_LANES[(waves?.spawnedThisWave ?? living) % GROUP_DUNGEON_SWARM_LANES.length];
  const enemy = G.buildSwarmEnemyFromTemplate(template, now, {
    mapRow: swarmLaneMapRow(spawnLane, arenaSpawnRow),
  });
  while (swarmTileOccupied(enemy.worldX, enemy.mapRow, swarm.enemies, enemy.id)) {
    enemy.worldX += LANE_TILE_PX;
  }
  swarm.enemies.push(enemy);
  if (waves) waves.spawnedThisWave += 1;
  void G.ensureSwarmEnemyAtlas(enemy);
  syncGroupDungeonPrimaryEnemy();
  G.markGroupDungeonWaveUiDirty();
  return enemy;
}

function syncBattleEnemyHpToSwarm() {
  const enemy = state.battle.enemy;
  if (!enemy?.swarmId) return;
  const swarmEnemy = G.findGroupDungeonSwarmEnemy(enemy.swarmId);
  if (swarmEnemy) swarmEnemy.hp = enemy.hp;
}

function queueSwarmEnemyStruck(enemy, now) {
  if (!enemy || enemy.dying || enemy.hp <= 0) return;
  enemy.pendingStruck = true;
}

function tryConsumeSwarmEnemyPendingStruck(enemy, now) {
  if (!enemy?.pendingStruck || enemy.dying || enemy.hp <= 0) return false;
  if (G.swarmEnemyWalkInProgress(enemy)) return false;
  if (enemy.oneShot && enemy.action !== "standing") return false;
  if (enemy.action === "struck") return false;
  enemy.pendingStruck = false;
  setSwarmEnemyAction(enemy, "struck", true, now);
  return true;
}

function strikeGroupDungeonSwarmEnemy(enemy, now) {
  if (!G.groupDungeonSwarmActive() || !enemy?.swarmId) {
    G.setEnemyAction("struck", true, now);
    return;
  }
  const swarmEnemy = G.findGroupDungeonSwarmEnemy(enemy.swarmId);
  if (swarmEnemy) queueSwarmEnemyStruck(swarmEnemy, now);
}

function syncGroupDungeonPrimaryEnemy() {
  if (!state.battle.swarm) return;
  const primary = G.groupDungeonPrimarySwarmEnemy();
  if (!primary) return;
  const battleEnemy = G.swarmEnemyToBattleEntity(primary);
  state.battle.enemy = battleEnemy;
  state.battle.enemyId = primary.templateId;
  state.battle.enemyX = Math.round(primary.worldX);
  state.enemy.index = primary.monsterIndex;
  state.enemy.action = primary.action;
  state.enemy.frame = primary.frame;
  state.enemy.oneShot = primary.oneShot;
  state.enemy.lastTick = primary.lastTick;
  if (primary.atlas) state.enemy.atlas = primary.atlas;
}

function setSwarmEnemyLocomotion(enemy, action, now = performance.now()) {
  if (!enemy || enemy.action === action || (enemy.oneShot && enemy.action !== "standing")) return;
  enemy.action = action;
  enemy.frame = 0;
  enemy.oneShot = false;
  enemy.lastTick = now;
}

function setSwarmEnemyAction(enemy, action, oneShot = false, now = performance.now()) {
  if (!enemy) return;
  enemy.action = action;
  enemy.frame = 0;
  enemy.oneShot = oneShot;
  enemy.lastTick = now;
}

function resetSwarmEnemyWalkState(enemy, now = performance.now()) {
  if (enemy.stepToX != null) {
    enemy.worldX = swarmSnapTileX(enemy.stepFromX);
    enemy.mapRow = Math.trunc(enemy.stepFromMapRow);
  }
  G.clearSwarmEnemyStep(enemy, now);
  if (enemy.hp > 0 && !enemy.dying && !enemy.oneShot) {
    setSwarmEnemyLocomotion(enemy, "standing", now);
  }
}

function setBossRespawn(zoneId, defeatedAt = Date.now()) {
  if (!G.bossRoomDef(zoneId)) return;
  const readyAt = Math.max(0, Math.trunc(Number(defeatedAt) || Date.now())) + G.bossRespawnDelayMs(zoneId);
  state.account.bossRespawns = {
    ...accountBossRespawns(),
    [zoneId]: readyAt,
  };
  G.syncAccountBossRespawnsToCharacters();
  G.incrementAccountBossKill(zoneId);
}

function traderNpcSceneHtml(npc) {
  const rows = sellableInventoryEntries()
    .map(({ entry, item }) => traderSellRowHtml(entry, item))
    .join("");
  return `
    <section class="npc-panel crystal-npc-text npc-shop-panel trader-panel">
      <div class="npc-shop-summary">
        <span>Your gold</span>
        <strong>${state.inventory.gold}g</strong>
      </div>
      <div class="npc-shop-list trader-sell-list" data-preserve-scroll="npc-trader-sell">
        ${rows || `<span class="trader-empty">No bag items to sell.</span>`}
      </div>
    </section>
  `;
}

function sellableInventoryEntries() {
  G.ensureInventorySlots();
  return G.inventoryEntries()
    .map((entry) => ({ entry, item: G.itemDefinition(entry.itemId) }))
    .filter(({ item }) => item && G.itemSellValue(item) > 0);
}

function traderSellRowHtml(entry, item) {
  const quantity = Math.max(1, Number(entry.quantity) || 1);
  const stack = quantity > 1 ? `<small>x${quantity}</small>` : "";
  const value = G.itemSellValue(item, quantity);
  return `
    <div class="npc-shop-row trader-sell-row" data-tooltip-item="${G.escapeHtml(item.id)}" data-tooltip-entry="${G.escapeHtml(entry.id)}">
      <img src="${G.escapeHtml(G.itemIconSrc(item))}" alt="" />
      <span class="npc-shop-item">
        <strong>${G.escapeHtml(G.itemDisplayName(item, entry))}${stack}</strong>
        <span>${G.escapeHtml(shopItemMetaText(item))}</span>
      </span>
      <span class="npc-shop-price">${value}g</span>
      <button type="button" data-sell-entry="${entry.id}">Sell</button>
    </div>
  `;
}

function shopBuyRowHtml(item) {
  const price = G.itemBuyValue(item);
  const owned = state.inventory.items
    .filter((entry) => entry.itemId === item.id)
    .reduce((sum, entry) => sum + Math.max(1, Math.floor(Number(entry.quantity) || 1)), 0);
  const stackQuantity = G.maxItemStack(item);
  const canBuy = state.inventory.gold >= price && G.availablePurchaseCapacityForItem(item) > 0;
  const disabled = canBuy ? "" : "disabled";
  const buttonText = state.inventory.gold < price ? "Gold" : G.availablePurchaseCapacityForItem(item) > 0 ? "Buy" : "Full";
  const stackButton = G.isStackableItem(item)
    ? `<button type="button" data-buy-stack="${G.escapeHtml(item.id)}" ${disabled} title="Buy up to ${stackQuantity}">x${stackQuantity}</button>`
    : "";
  return `
    <div class="npc-shop-row shop-buy-row ${canBuy ? "" : "locked"}" data-tooltip-item="${G.escapeHtml(item.id)}">
      <img src="${G.escapeHtml(G.itemIconSrc(item))}" alt="" />
      <span class="npc-shop-item">
        <strong>${G.escapeHtml(item.name)}</strong>
        <span>${G.escapeHtml(shopItemMetaText(item))}${owned ? ` | Have ${owned}` : ""}</span>
      </span>
      <span class="npc-shop-price">${price}g</span>
      <span class="npc-shop-actions ${G.isStackableItem(item) ? "stackable" : ""}">
        <button type="button" data-buy-item="${G.escapeHtml(item.id)}" ${disabled}>${buttonText}</button>
        ${stackButton}
      </span>
    </div>
  `;
}

function refineJewelleryStatHint(entry, item) {
  const stats = G.itemEntryStats(entry, item);
  const dc = refineOffensiveStatSum(stats, "dc");
  const mc = refineOffensiveStatSum(stats, "mc");
  const sc = refineOffensiveStatSum(stats, "sc");
  const parts = [];
  if (dc > 0) parts.push(`DC ${dc}`);
  if (mc > 0) parts.push(`MC ${mc}`);
  if (sc > 0) parts.push(`SC ${sc}`);
  if (parts.length === 0) {
    const ac = G.smithRangeStatValue(stats, "ac");
    const amc = G.smithRangeStatValue(stats, "amc");
    if (ac > 0) parts.push(`AC ${ac}`);
    if (amc > 0) parts.push(`AMC ${amc}`);
  }
  return parts.length ? parts.join(" · ") : G.title(item.slot);
}

function shopItemMetaText(item) {
  if (G.isPotionItem(item)) {
    const parts = G.potionRestoreParts(G.potionRestoreAmount(item, "hp"), G.potionRestoreAmount(item, "mp"));
    const mode = G.potionRestoreMode(item) === "instant" ? "instant" : "over time";
    return parts ? `${parts}, ${mode}` : "Potion";
  }
  if (G.isPoisonItem(item)) return item.poison?.type === "green" ? "Poison damage powder" : "Defence weakening powder";
  if (G.isTaoistAmuletItem(item)) return "Taoist spell amulet";
  if (item?.type === "book") return "Skill book";
  if (item?.slot) return G.title(item.slot);
  return G.title(item?.type ?? "Item");
}

function trainerNpcSceneHtml(npc) {
  const zone = PROTOTYPE_ZONES.find((entry) => entry.trainingRoom);
  return `
    <section class="npc-panel crystal-npc-text trainer-panel">
      <span>${G.escapeHtml(npc.panel)}</span>
      <button
        type="button"
        data-enter-zone="${G.escapeHtml(zone?.id ?? "")}"
        class="trainer-enter-button"
        ${zone ? "" : "disabled"}
      >
        <strong>Enter Academy</strong>
        <span>Practice autocast spells on a training dummy</span>
      </button>
    </section>
  `;
}

function randomZoneEnemyTemplate(zone = G.activeZone()) {
  if (G.isTrainingRoomZone(zone)) return G.trainingRoomEnemyTemplate(zone);
  const ids = zone?.enemyIds?.length ? zone.enemyIds : ENEMY_TEMPLATES.map((enemy) => enemy.id);
  const pickedId = ids[randomInt(0, ids.length - 1)];
  return ENEMY_TEMPLATES.find((enemy) => enemy.id === pickedId) ?? ENEMY_TEMPLATES[0];
}

function updateSpellMappingText() {
  const el = els.spellControls.querySelector("#spellMapping");
  if (!el) return;
  const mapped = bodyActionForSpell(state.spell);
  const fx = state.spell === "None" || state.spellIndex.spells.includes(state.spell) ? "FX" : "body only";
  el.textContent = `Body: ${PLAYER_ACTIONS[mapped]?.label ?? mapped} | ${fx} | gap ${state.castCooldownMs}ms`;
}

async function reloadSpell() {
  if (state.spell === "None" || !state.spellIndex.spells.includes(state.spell)) {
    state.spellAtlas = null;
    return;
  }
  state.spellAtlas = await loadJson(`./public/spellfx/${state.spell}/atlas.json`).catch(() => null);
}

function setHoveredTownNpc(npcId) {
  if (state.game.hoveredTownNpcId === npcId) return;
  state.game.hoveredTownNpcId = npcId;
  G.render();
}

function showItemTooltip(itemId, event, entryId = null) {
  const item = G.itemDefinition(itemId);
  if (!item) return;
  const entry = entryId ? G.itemEntryById(entryId) : null;
  els.itemTooltip.innerHTML = G.itemTooltipHtml(item, entry);
  els.itemTooltip.hidden = false;
  G.positionItemTooltip(event);
}

async function reloadAtlases({ refreshLayers = [] } = {}) {
  const reloadVersion = ++atlasReloadVersion;
  const reloadKey = G.atlasIndexKey();
  const refreshLayerSet = new Set(refreshLayers);
  for (const layer of refreshLayerSet) {
    if (state.indexes[layer] != null) imageCache.delete(sheetUrl(state.spriteSet, layer, state.indexes[layer]));
  }
  const entries = await Promise.all(
    G.layerNames().map(async (layer) => [
      layer,
      await loadAtlas(state.spriteSet, layer, state.indexes[layer]).catch(() => null),
    ]),
  );
  if (reloadVersion !== atlasReloadVersion) return;
  state.atlases = Object.fromEntries(entries);
  state.atlasIndexes = Object.fromEntries(G.layerNames().map((layer) => [layer, state.indexes[layer] ?? null]));
  await Promise.all(
    entries.map(([layer, atlas]) => (
      atlas && state.indexes[layer] != null
        ? G.loadCachedImage(sheetUrl(state.spriteSet, layer, state.indexes[layer])).catch(() => null)
        : null
    )),
  );
  if (reloadVersion !== atlasReloadVersion) return;
  if (queuedAtlasReloadKey === reloadKey) queuedAtlasReloadKey = "";
  G.updateCoverage();
  G.render();
}

function scheduleEquipmentRedraw() {
  requestAnimationFrame(() => G.render());
  setTimeout(() => G.render(), 80);
}

function queueVisualAtlasReload(refreshLayers = []) {
  const key = G.atlasIndexKey();
  if (queuedAtlasReloadKey === key) return;
  queuedAtlasReloadKey = key;
  void reloadAtlases({ refreshLayers }).finally(() => {
    if (queuedAtlasReloadKey === key) queuedAtlasReloadKey = "";
  });
}

async function reloadEnemyAtlas() {
  state.enemy.atlas = await loadJson(`./public/monsters/monster/${state.enemy.index}.json`).catch(() => null);
  G.render();
}

function tick(now) {
  updatePerfClock(now);
  G.catchUpSimulation(now);
  lastSimulationAt = now;
  const shouldRender = runSimulationStep(now, { autoSave: true });
  if (shouldRender) G.render();
  requestAnimationFrame(tick);
}

function runSimulationStep(now, options = {}) {
  if (options.autoSave) {
    G.maybeAutoSave(now);
    G.maybeSubmitPrototypeStats(now);
  }
  let recoveryChanged = false;
  if (!state.paused) {
    if (!G.bossPartyActiveFight()) {
      recoveryChanged = updatePendingHeal(now) || recoveryChanged;
      recoveryChanged = updateHealingRegen(now) || recoveryChanged;
      recoveryChanged = updatePotionRegen(now) || recoveryChanged;
    }
    recoveryChanged = updateStatBuffs(now) || recoveryChanged;
  }
  const stepTesting = updateOneStepTest(now);
  const continuousWalkTesting = !stepTesting && updateContinuousWalkTest(now);
  if (!stepTesting && !continuousWalkTesting) {
    if (state.game.mode === "mining") {
      G.updateMining(now);
    } else {
      G.updateBattle(now);
      G.updateBattleRestState(now);
      if (!G.bossPartyActiveFight()) {
        recoveryChanged = (!state.paused && updateAutoPotions(now)) || recoveryChanged;
      }
    }
    updateEnemyFrame(now);
    updateTaoPetFrame(now);
  }
  const clip = G.currentClip();
  if (!state.paused && clip && !stepTesting && !continuousWalkTesting && !state.stepTest.complete) {
    updateFrame(now, clip);
    return true;
  } else {
    state.lastTick = now;
    return Boolean(state.spellAtlas || state.levelUpEffects.length || stepTesting || continuousWalkTesting || recoveryChanged);
  }
}

function updatePerfClock(now) {
  state.perf.frames += 1;
  const elapsed = now - state.perf.lastFpsAt;
  if (elapsed < 500) return;
  state.perf.fps = Math.round((state.perf.frames * 1000) / elapsed);
  state.perf.frames = 0;
  state.perf.lastFpsAt = now;
}

function updateContinuousWalkTest(now) {
  if (!state.continuousWalk || state.paused) return false;
  const action = state.continuousMoveAction;
  const spec = PLAYER_ACTIONS[action];
  const cycleMs = spec.count * spec.interval;
  const elapsed = Math.max(0, now - state.continuousWalkStartedAt);
  const distance = G.movementDistanceForAction(action, elapsed);
  const frameTime = elapsed % cycleMs;

  state.battle.playerX = state.continuousWalkStartX + distance;
  state.battle.cameraX = state.continuousWalkStartCameraX + distance;
  state.battle.phase = "advance";
  state.battle.lastMotionAt = now;
  const previousFrame = state.frame;
  state.action = action;
  state.frame = Math.min(spec.count - 1, Math.floor(frameTime / spec.interval));
  G.maybePlayPlayerFootstep(previousFrame, state.frame, action);
  state.playerOneShot = false;
  state.lastTick = now;
  return true;
}

function updateOneStepTest(now) {
  const test = state.stepTest;
  if (!test.active) return false;
  const clip = G.currentClip();
  const frameCount = clip?.frames.length ?? PLAYER_ACTIONS.walking.count;
  const t = Math.max(0, Math.min(1, (now - test.startAt) / test.durationMs));

  state.battle.playerX = test.startX + test.distancePx * t;
  state.battle.cameraX = test.startCameraX + test.distancePx * t;
  const previousFrame = state.frame;
  state.action = "walking";
  state.frame = Math.min(frameCount - 1, Math.floor(t * frameCount));
  G.maybePlayPlayerFootstep(previousFrame, state.frame, "walking");
  state.playerOneShot = false;
  state.lastTick = now;

  if (t >= 1) {
    state.battle.playerX = test.startX + test.distancePx;
    state.battle.cameraX = test.startCameraX + test.distancePx;
    state.frame = frameCount - 1;
    test.active = false;
    test.complete = true;
    G.pushBattleLog(`One-step test complete: player +${test.distancePx}px, ground +${test.distancePx}px.`);
    battlePanelSignature = "";
  }
  return true;
}

function queueBossPartyMeleeAdvance(member, nextX, now = performance.now()) {
  const current = Number(member.worldX) || 0;
  nextX = Math.round(nextX);
  if (Math.round(current) === nextX) {
    member.targetWorldX = null;
    member.meleeAdvanceFromX = null;
    member.meleeAdvanceStartedAt = null;
    return false;
  }
  member.targetWorldX = nextX;
  member.meleeAdvanceFromX = current;
  member.meleeAdvanceStartedAt = now;
  return true;
}

function refreshBossPartyMeleePositions(options = {}) {
  if (!G.bossPartyMembersStepToMelee()) return null;
  const party = state.battle.bossParty;
  if (!party?.members?.length) return null;
  const now = Number(options.now) || performance.now();
  const frontX = Math.round(Number(options.frontX) || G.bossPartyMeleeFrontWorldX());
  const frontMember = G.bossPartyMeleeFrontMember(party);
  if (!frontMember) return null;

  // Only the current front-liner steps up to melee; rear melee stay put until
  // they become the front-liner (e.g. Warrior after pet dies, Taoist after Warrior dies).
  for (const member of party.members) {
    if (member === frontMember) continue;
    if (member?.targetWorldX == null) continue;
    member.targetWorldX = null;
    member.meleeAdvanceFromX = null;
    member.meleeAdvanceStartedAt = null;
    if (member.alive && member.hp > 0 && member.visualAction === "walking" && !member.visualOneShot) {
      member.visualAction = "stance";
      member.visualFrame = 0;
    }
  }

  const currentX = Math.round(Number(frontMember.worldX) || 0);
  if (currentX >= frontX) {
    frontMember.targetWorldX = null;
    frontMember.meleeAdvanceFromX = null;
    frontMember.meleeAdvanceStartedAt = null;
    return null;
  }
  if (!queueBossPartyMeleeAdvance(frontMember, frontX, now)) return null;
  return frontMember;
}

function resolvedTaoPetWorldX(pet = state.battle.taoPet) {
  const worldX = Number(pet?.worldX);
  if (Number.isFinite(worldX)) return worldX;
  if (G.bossPartyOnField()) return G.bossPartyPetWorldXFor(pet);
  return Number(state.battle.playerX) || 0;
}

function shiftFixedArenaPartyForPet(petWorldX) {
  if (!G.enemyUsesFixedArenaSpawn()) return 0;
  const shift = G.fixedArenaPartyShiftForPet(petWorldX);
  if (shift <= 0) return 0;
  state.battle.playerX = Math.round((Number(state.battle.playerX) || 0) - shift);
  const party = state.battle.bossParty;
  if (party?.members?.length) {
    for (const member of party.members) {
      if (Number.isFinite(Number(member.worldX))) {
        member.worldX = Math.round(Number(member.worldX) - shift);
      }
    }
  }
  return shift;
}

function resolveBossPartyMember(member) {
  if (!member?.classId || !state.battle.bossParty?.active) return member;
  return state.battle.bossParty.members?.find((entry) => entry.classId === member.classId) ?? member;
}

function refreshBossPartyMemberMagicSettings(member) {
  const characterLearned = state.characters[member.classId]?.magic?.learned;
  if (!characterLearned || !member.magic?.learned) return;
  for (const [spellId, learned] of Object.entries(member.magic.learned)) {
    const saved = characterLearned[spellId];
    if (saved) learned.autoCast = Boolean(saved.autoCast);
  }
}

function queueDefenceBuffImpactFx(spell, anchor, now, options = {}) {
  if (!spell?.id || !G.defenceBuffImpactAtlas(spell.id)) return;
  const fx = G.defenceBuffFxList();
  fx.push({
    spellId: spell.id,
    anchor,
    worldX: options.worldX ?? null,
    memberClassId: options.memberClassId ?? null,
    petFx: Boolean(options.petFx),
    startAt: now,
    soundPlayed: Boolean(options.soundPlayed),
  });
  state.battle.defenceBuffFx = fx.slice(-16);
}

function queueUltimateEnhancerImpactFx(spell, applied, now = performance.now(), options = {}) {
  if (!spell?.id || !G.defenceBuffImpactAtlas(spell.id) || suppressSimulationRender) return;
  const entities = applied?.results?.map((entry) => entry.entity) ?? [];
  let soundPlayed = Boolean(options.soundPlayed);
  for (const entity of entities) {
    if (!entity || entity.hp <= 0) continue;
    const impactOptions = G.ultimateEnhancerImpactFxOptions(entity);
    queueDefenceBuffImpactFx(spell, impactOptions.anchor ?? null, now, {
      ...impactOptions,
      soundPlayed,
    });
    soundPlayed = true;
  }
}

function queueDefenceBuffImpactTargets(spell, now, options = {}) {
  if (spell?.id === "SoulShield" || spell?.id === "BlessedArmour") {
    queueDefenceBuffImpactFx(spell, "player", now, {
      worldX: options.worldX ?? null,
      soundPlayed: Boolean(options.soundPlayed),
    });
    return;
  }
  queueDefenceBuffImpactFx(spell, "player", now, options);
  const pet = options.pet ?? state.battle.taoPet ?? state.battle.bossParty?.pet;
  if (pet?.active) queueDefenceBuffImpactFx(spell, "pet", now, { soundPlayed: true, petFx: true });
}

function updateDefenceBuffFx(now) {
  const fx = G.defenceBuffFxList();
  if (!fx.length) return;
  const remaining = [];
  for (const entry of fx) {
    const atlas = G.defenceBuffImpactAtlas(entry.spellId);
    const duration = G.defenceBuffFxAtlasDurationMs(atlas);
    if (now < entry.startAt) {
      remaining.push(entry);
      continue;
    }
    if (!entry.soundPlayed) {
      entry.soundPlayed = true;
      G.playSpellSfx(entry.spellId, "impact", { volume: 0.46, throttleMs: 120 })
        || G.playSpellSfx(entry.spellId, "cast", { volume: 0.42, throttleMs: 120 });
    }
    if (now - entry.startAt <= duration) remaining.push(entry);
  }
  state.battle.defenceBuffFx = remaining;
}

function rollPoisonResist(target) {
  const resist = Math.max(0, Math.min(CRYSTAL_POISON_RESIST_WEIGHT, Number(target?.poisonResist) || 0));
  return resist <= 0 || randomInt(0, CRYSTAL_POISON_RESIST_WEIGHT - 1) >= resist;
}

function rollPoisonProc(chance) {
  const safeChance = Math.max(1, Math.trunc(Number(chance) || 1));
  return randomInt(0, safeChance - 1) === 0;
}

function updateEntityPoisons(entity, targetKind, now, options = {}) {
  const poisons = Array.isArray(entity?.poisons) ? entity.poisons : [];
  if (!poisons.length || (entity?.hp ?? 0) <= 0) return false;
  const active = [];
  let changed = false;

  for (const poison of poisons) {
    poison.tickMs = Math.max(1, Math.trunc(Number(poison.tickMs) || CRYSTAL_POISON_TICK_MS));
    poison.nextTickAt = Number(poison.nextTickAt) || now + poison.tickMs;
    poison.ticksRemaining = Math.max(0, Math.trunc(Number(poison.ticksRemaining) || 0));

    if (poison.kind === "paralysis") {
      let steps = 0;
      while ((entity.hp ?? 0) > 0 && poison.ticksRemaining > 0 && now >= poison.nextTickAt && steps < 20) {
        poison.nextTickAt += poison.tickMs;
        poison.ticksRemaining -= 1;
        steps += 1;
        changed = true;
      }
      if (steps >= 20 && poison.ticksRemaining > 0) poison.nextTickAt = now + poison.tickMs;
      if (poison.ticksRemaining > 0 && (entity.hp ?? 0) > 0) active.push(poison);
      continue;
    }

    if (poison.kind !== "green") continue;

    let steps = 0;
    while ((entity.hp ?? 0) > 0 && poison.ticksRemaining > 0 && now >= poison.nextTickAt && steps < 20) {
      const tickAt = poison.nextTickAt;
      poison.nextTickAt += poison.tickMs;
      poison.ticksRemaining -= 1;
      steps += 1;
      const damage = Math.max(0, Math.trunc(Number(poison.value) || 0));
      if (damage > 0) {
        entity.hp = Math.max(0, entity.hp - damage);
        changed = true;
        if (!options.offline) G.addCombatantPoisonText(targetKind, entity, damage, "poison", tickAt);
      }
    }
    if (steps >= 20 && poison.ticksRemaining > 0) poison.nextTickAt = now + poison.tickMs;
    if (poison.ticksRemaining > 0 && (entity.hp ?? 0) > 0) active.push(poison);
  }

  entity.poisons = active;
  if ((entity?.hp ?? 0) <= 0) G.handleCombatantPoisonDeath(entity, targetKind, now, options);
  return changed;
}

function resolveBoneLordBossPartyMelee(now) {
  const enemy = state.battle.enemy;
  const target = G.bossPartyFrontTarget();
  if (!enemy || !target || !state.battle.enemyRevealed) return false;
  if (G.bossPartyTargetEnemyDistance(target) > BOSS_PARTY_BOSS_REACH) return false;
  G.setEnemyAction("attack1", true, now);
  G.playMonsterSfx("attack");
  const { hit, damage } = resolveIncomingEnemyAttack(enemy, G.defenceTargetForIncomingAttack(target));
  if (!hit) {
    G.addCombatText(target.classId === G.bossPartyControlledClassId() ? "player" : "enemy", "Miss", "miss", now);
    G.pushBattleLog(`${enemy.name} misses ${target.name}.`);
    return true;
  }
  target.hp = Math.max(0, target.hp - damage);
  if (target === state.battle.bossParty.pet) {
    setTaoPetAction("struck", true, now);
    if (target.hp <= 0) G.bossPartyMarkPetDead(now);
  } else {
    if (target.classId === G.bossPartyControlledClassId()) {
      setPlayerAction("struck", now + 250, true);
      G.maybeNotifyMagicShieldStruck(null, now);
      G.addCombatText("player", damage, "enemyDamage", now);
    } else {
      target.visualAction = "struck";
      target.visualFrame = 0;
      target.visualOneShot = true;
      target.visualLastTick = now;
      G.notifyWizardMagicShieldStruckOnHit(target, now);
    }
    G.playSfx("player.flinch", G.bossPartySfxParams(target, 0.45, 120));
  }
  G.pushBattleLog(`${enemy.name} hits ${target.name} for ${damage}.`);
  if (target !== state.battle.bossParty.pet && target.hp <= 0) G.bossPartyMarkMemberDead(target, now);
  return true;
}

function resolveBoneLordSoloMelee(now) {
  const battle = state.battle;
  const enemy = battle.enemy;
  const target = G.enemyAttackTarget();
  if (G.enemyTargetDistance() > LANE.enemyRange) return false;
  G.setEnemyAction("attack1", true, now);
  G.playMonsterSfx("attack");
  const { hit, damage } = resolveIncomingEnemyAttack(enemy, target);
  if (!hit) {
    G.addCombatText(target.anchor, "Miss", "miss", now);
    G.pushBattleLog(`${enemy.name} misses ${target.name}.`);
    return true;
  }
  target.applyDamage(damage, now);
  G.addCombatText(target.anchor, damage, "enemyDamage", now);
  G.pushBattleLog(`${enemy.name} hits ${target.name} for ${damage}.`);
  if (target.kind === "player" && battle.player.hp <= 0) {
    G.finishBattle(now);
    setPlayerAction("die", now);
    G.playSfx("player.death", { volume: 0.58 });
    G.pushBattleLog(`${battle.combatClass} falls.`);
  }
  return true;
}

function resolveMinotaurKingSoloAoeStrike(enemy, now) {
  const battle = state.battle;
  const targets = [];
  if ((battle.player?.hp ?? 0) > 0) targets.push(G.enemyAttackTarget());
  const pet = battle.taoPet;
  if (pet?.active && (pet.hp ?? 0) > 0 && !G.taoistPetCanTank()) {
    const defence = G.defenceStatsForEntity(pet);
    targets.push({
      kind: "pet",
      name: pet.name,
      anchor: "pet",
      ac: defence.ac,
      amc: defence.amc,
      magicResist: defence.magicResist,
      agility: defence.agility,
      applyDamage: (damage, impactNow) => {
        pet.hp = Math.max(0, pet.hp - damage);
        setTaoPetAction("struck", true, impactNow);
        if (pet.hp <= 0) G.markTaoistPetDead(impactNow);
      },
    });
  } else if (pet?.active && (pet.hp ?? 0) > 0 && G.taoistPetCanTank() && (battle.player?.hp ?? 0) > 0) {
    const playerTarget = {
      kind: "player",
      name: battle.combatClass,
      anchor: "player",
      ac: battle.player.ac,
      amc: battle.player.amc,
      magicResist: battle.player.magicResist ?? 0,
      agility: battle.player.agility,
      applyDamage: (damage, impactNow) => {
        battle.player.hp = Math.max(0, battle.player.hp - damage);
        G.maybeNotifyMagicShieldStruck(null, impactNow);
        setPlayerAction("struck", impactNow + 250, true);
        G.playSfx("player.flinch", { volume: 0.45, throttleMs: 120 });
      },
    };
    targets.push(playerTarget);
  }
  let primaryLogged = false;
  for (const target of targets) {
    const { hit, damage } = resolveIncomingEnemyRangedAttack(enemy, target, { aoe: true });
    if (!hit) {
      if (!primaryLogged) {
        G.addCombatText(target.anchor, "Miss", "miss", now);
        G.pushBattleLog(`${enemy.name} misses ${target.name}.`);
        primaryLogged = true;
      }
      continue;
    }
    target.applyDamage(damage, now);
    G.addCombatText(target.anchor, damage, "enemyDamage", now);
    G.pushBattleLog(`${enemy.name} hits ${target.name} for ${damage}.`);
    if (target.kind === "player" && battle.player.hp <= 0) {
      G.finishBattle(now);
      setPlayerAction("die", now);
      G.playSfx("player.death", { volume: 0.58 });
      G.pushBattleLog(`${battle.combatClass} falls.`);
      break;
    }
  }
}

function resolveBoneLordRangedStrike(now) {
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0 || !state.battle.enemyRevealed) return;
  const useAoe = G.isMinotaurKingEnemy(enemy) && G.minotaurKingStrikeUsesAoe();
  if (G.bossPartyActiveFight()) {
    const primaryTarget = useAoe ? G.bossPartyAoeRangedTarget() : G.bossPartyFrontTarget();
    if (!primaryTarget) return;
    const distance = G.bossPartyTargetEnemyDistance(primaryTarget);
    if (distance > G.boneLordAttackRange(enemy)) return;
    const splashTargets = useAoe
      ? G.minotaurKingSplashTargets(primaryTarget, enemy)
      : [primaryTarget];
    for (const target of splashTargets) {
      const { hit, damage } = resolveIncomingEnemyRangedAttack(
        enemy,
        G.defenceTargetForIncomingAttack(target),
        { aoe: useAoe },
      );
      if (!hit) {
        if (target === primaryTarget) {
          G.addCombatText(target.classId === G.bossPartyControlledClassId() ? "player" : "enemy", "Miss", "miss", now);
          G.pushBattleLog(`${enemy.name} misses ${target.name}.`);
        }
        continue;
      }
      target.hp = Math.max(0, target.hp - damage);
      if (target === state.battle.bossParty.pet) {
        setTaoPetAction("struck", true, now);
        G.addCombatText("pet", damage, "enemyDamage", now);
        if (target.hp <= 0) G.bossPartyMarkPetDead(now);
      } else if (target.classId === G.bossPartyControlledClassId()) {
        setPlayerAction("struck", now + 250, true);
        G.maybeNotifyMagicShieldStruck(null, now);
        G.addCombatText("player", damage, "enemyDamage", now);
        G.playSfx("player.flinch", { volume: 0.45, throttleMs: 120, force: true });
      } else {
        target.visualAction = "struck";
        target.visualFrame = 0;
        target.visualOneShot = true;
        target.visualLastTick = now;
        G.notifyWizardMagicShieldStruckOnHit(target, now);
        G.addCombatText("enemy", damage, "enemyDamage", now);
        G.playSfx("player.flinch", G.bossPartySfxParams(target, 0.45, 120));
      }
      G.pushBattleLog(`${enemy.name} hits ${target.logName ?? target.name} for ${damage}.`);
      if (target !== state.battle.bossParty.pet && target.hp <= 0) G.bossPartyMarkMemberDead(target, now);
    }
    return;
  }
  const target = G.enemyAttackTarget();
  const distance = G.enemyTargetDistance();
  if (distance > G.boneLordAttackRange(enemy)) return;
  if (useAoe) {
    resolveMinotaurKingSoloAoeStrike(enemy, now);
    return;
  }
  const { hit, damage } = resolveIncomingEnemyRangedAttack(enemy, target);
  if (!hit) {
    G.addCombatText(target.anchor, "Miss", "miss", now);
    G.pushBattleLog(`${enemy.name} misses ${target.name}.`);
    return;
  }
  target.applyDamage(damage, now);
  G.addCombatText(target.anchor, damage, "enemyDamage", now);
  G.pushBattleLog(`${enemy.name} hits ${target.name} for ${damage}.`);
  if (target.kind === "player" && state.battle.player.hp <= 0) {
    G.finishBattle(now);
    setPlayerAction("die", now);
    G.playSfx("player.death", { volume: 0.58 });
    G.pushBattleLog(`${state.battle.combatClass} falls.`);
  }
}

function resolveEvilCentipedeStrikeTarget(enemy, target, now, offsetIndex = 0) {
  const { hit, damage } = resolveIncomingEnemyAttack(enemy, target.stats);
  const offsetX = offsetIndex * 14;
  if (!hit) {
    G.addCombatantPoisonText(target.kind, target.entity, "Miss", "miss", now, offsetX);
    G.pushBattleLog(`${enemy.name} misses ${target.logName}.`);
    return;
  }

  target.entity.hp = Math.max(0, target.entity.hp - damage);
  if (target.kind === "pet") {
    setTaoPetAction("struck", true, now);
    G.addCombatantPoisonText(target.kind, target.entity, damage, "enemyDamage", now, offsetX);
    if (target.entity.hp <= 0) {
      if (G.bossPartyActiveFight()) G.bossPartyMarkPetDead(now);
      else G.markTaoistPetDead(now);
    }
  } else if (target.kind === "member") {
    if (target.entity.classId === G.bossPartyControlledClassId()) {
      setPlayerAction("struck", now + 250, true);
      G.maybeNotifyMagicShieldStruck(null, now);
      G.addCombatText("player", damage, "enemyDamage", now, offsetX);
      G.playSfx("player.flinch", { volume: 0.45, throttleMs: 120, force: true });
    } else {
      target.entity.visualAction = "struck";
      target.entity.visualFrame = 0;
      target.entity.visualOneShot = true;
      target.entity.visualLastTick = now;
      G.notifyWizardMagicShieldStruckOnHit(target.entity, now);
      G.addCombatText("enemy", damage, "enemyDamage", now, offsetX);
      G.playSfx("player.flinch", G.bossPartySfxParams(target.entity, 0.45, 120));
    }
    if (target.entity.hp <= 0) G.bossPartyMarkMemberDead(target.entity, now);
  } else {
    setPlayerAction("struck", now + 250, true);
    G.maybeNotifyMagicShieldStruck(null, now);
    G.addCombatText("player", damage, "enemyDamage", now, offsetX);
    G.playSfx("player.flinch", { volume: 0.45, throttleMs: 120, force: true });
    if (target.entity.hp <= 0) {
      G.finishBattle(now);
      setPlayerAction("die", now);
      G.playSfx("player.death", { volume: 0.58 });
      G.pushBattleLog(`${state.battle.combatClass} falls.`);
    }
  }
  G.pushBattleLog(`${enemy.name} hits ${target.logName} for ${damage}.`);
  if (G.applyEvilCentipedePoisons(enemy, target.entity, now)) {
    G.pushBattleLog(`${target.logName} is poisoned.`);
    G.addCombatantPoisonText(target.kind, target.entity, "Poison", "poison", now, offsetX);
  }
}

function updatePendingEnemyStrike(now) {
  const strike = state.battle.pendingEnemyStrike;
  if (!strike) return;
  const vfxUntil = Number(strike.vfxUntil) || strike.at;
  if (now >= strike.at && !strike.resolved) {
    strike.resolved = true;
    const enemy = state.battle.enemy;
    if (!enemy || enemy.hp <= 0 || !state.battle.enemyRevealed) {
      if (now >= vfxUntil) state.battle.pendingEnemyStrike = null;
      return;
    }
    if (G.enemyHasRangedMeleeAttack(enemy)) {
      resolveBoneLordRangedStrike(now);
    } else {
      const targets = G.evilCentipedeTargetsInRange();
      targets.forEach((target, index) => resolveEvilCentipedeStrikeTarget(enemy, target, now, index));
    }
  }
  if (now >= vfxUntil) state.battle.pendingEnemyStrike = null;
}

function rollBossTableDrops(dropTable, awardItem) {
  const added = [];
  const ignored = [];
  if (!dropTable) return { added, ignored };

  const oilCount = Math.max(0, Math.trunc(Number(dropTable.benedictionOils ?? 1)));
  const oil = G.itemDefinition(BENEDICTION_OIL_ITEM_ID);
  if (oil && oilCount > 0) {
    for (let i = 0; i < oilCount; i += 1) awardItem(oil, added, ignored);
  }

  let poolDropped = false;
  for (const entry of dropTable.items) {
    if (Math.random() >= entry.chance) continue;
    const item = G.itemDefinition(entry.id);
    if (!item) continue;
    awardItem(item, added, ignored);
    poolDropped = true;
  }

  if (!poolDropped && dropTable.items.length) {
    const entry = dropTable.items[Math.floor(Math.random() * dropTable.items.length)];
    const item = G.itemDefinition(entry.id);
    if (item) awardItem(item, added, ignored);
  }

  return { added, ignored };
}

function rollBossPartyDrops(member, enemy = state.battle.enemy) {
  if (!member) return { added: [], ignored: [] };
  G.syncBossPartyInventoryCapacityFromState(member.classId);
  const dropTable = G.bossDropTableForEnemy(enemy);
  if (!dropTable) return { added: [], ignored: [] };
  return rollBossTableDrops(dropTable, (item, added, ignored) => {
    G.addBossPartyZoneDropItem(member, item, added, ignored);
  });
}

function rollBossSoloDrops(enemy = state.battle.enemy) {
  G.syncInventoryCapacity();
  G.ensureInventorySlots();
  return rollBossTableDrops(G.bossDropTableForEnemy(enemy), (item, added, ignored) => {
    G.addZoneDropItem(item, added, ignored);
  });
}

function splitPartyRewardAmount(total, memberCount) {
  const count = Math.max(1, Math.trunc(Number(memberCount) || 0));
  return Math.max(0, Math.floor(Math.max(0, Math.trunc(Number(total) || 0)) / count));
}

function rollBossPartyZoneDrops(member, zone, enemy) {
  const added = [];
  const ignored = [];
  const candidates = G.zoneDropCandidates(zone, enemy);
  for (const { item, chance } of candidates) {
    if (Math.random() >= chance) continue;
    G.addBossPartyZoneDropItem(member, item, added, ignored);
  }
  G.updateBossPartyDropPity(member, zone, candidates, added, ignored);
  return { added, ignored };
}

function updateLaneMotion(now) {
  const battle = state.battle;
  const dt = Math.min(120, Math.max(0, now - (battle.lastMotionAt || now))) / 1000;
  battle.lastMotionAt = now;

  if (G.isRoomOnlyZone()) {
    G.ensureMapStampArenaLock();
    battle.phase = "idle";
    battle.running = false;
    setPlayerLocomotion("standing", now);
    const lockX = battle.lockedArenaWorldX;
    if (lockX != null) battle.cameraX = lockX - G.playerScreenX();
    return;
  }

  if (battle.phase === "victory") {
    if (now >= battle.nextEnemySpawnAt) spawnNextEnemy(now);
    return;
  }

  if (!state.showEnemies) {
    battle.phase = "advance";
    G.advancePlayerTravel(now, dt);
    battle.cameraX = battle.playerX - G.playerScreenX();
    return;
  }

  const distance = G.enemyDistance();
  const playerRange = G.playerAttackRange();
  const engageRange = G.playerEngageRange(now);
  if (battle.enemy.hp > 0 && distance <= engageRange) {
    if (battle.phase !== "engaged") G.ensureMapStampArenaLock();
    battle.phase = "engaged";
  }

  if (battle.phase === "advance") {
    G.advancePlayerTravel(now, dt);
    G.setEnemyLocomotion("standing", now);
  } else if (battle.phase === "engaged") {
    if (G.taoistPetCanTank() && !G.isPlayerOneShotAction()) {
      setPlayerLocomotion("stance", now);
    } else if (distance > playerRange && !G.isPlayerOneShotAction() && !G.wizardHoldsCombatPosition()) {
      battle.playerX += LANE.playerSpeed * dt;
      setPlayerLocomotion("walking", now);
    } else if (!G.isPlayerOneShotAction()) {
      setPlayerLocomotion("stance", now);
    }

    if (
      battle.enemyRevealed
      && !G.isTrainingDummyEnemy(battle.enemy)
      && (G.taoistPetCanTank() || distance <= playerRange || G.wizardHoldsCombatPosition())
    ) battle.enemyAggro = true;
    const targetDistance = G.enemyTargetDistance();
    if (
      !G.isTrainingDummyEnemy(battle.enemy)
      && !G.enemyBossIsStationary(battle.enemy)
      && battle.enemyAggro
      && targetDistance > LANE.enemyRange
      && !G.isEnemyOneShotAction()
    ) {
      const speed = G.enemyAdvanceSpeed(battle.enemy, LANE.enemySpeed, now);
      if (speed > 0) {
        battle.enemyX -= speed * dt;
        G.setEnemyLocomotion("walking", now);
      } else {
        G.setEnemyLocomotion("standing", now);
      }
    } else if (!G.isEnemyOneShotAction() && battle.enemy.hp > 0) {
      G.setEnemyLocomotion("standing", now);
    }

    if (!battle.nextPlayerAttackAt && G.canPlayerAttack()) battle.nextPlayerAttackAt = now;
    if (!battle.nextEnemyAttackAt && G.canEnemyAttack()) {
      battle.nextEnemyAttackAt = now + G.effectiveEnemyAttackMs(battle.enemy, now);
    }
  }

  syncBattleCamera();
  if (state.game.mode === "zone") {
    state.game.distance = Math.max(state.game.distance, Math.max(0, battle.playerX));
  }
}

function travelAction(now) {
  if (state.continuousWalk) return "walking";
  const battle = state.battle;
  const travelled = battle.playerX - (battle.travelStartedX ?? battle.playerX);
  return travelled >= TRAVEL_WALK_DISTANCE ? "running" : "walking";
}

function setWarriorSpellCastReadyAt(skill, learned, now) {
  if (skill?.id === "TwinDrakeBlade" && G.twinDrakeAutoCastActive(learned)) {
    learned.castReadyAt = 0;
    return;
  }
  learned.castReadyAt = now + spellDelayMs(skill, learned);
}

function scaleEnemyPhysicalDamage(damage, enemy, now = performance.now()) {
  const scaled = Math.trunc(Math.max(0, Number(damage) || 0) * (G.enemyStunned(enemy, now) ? 1.5 : 1));
  return Math.max(0, scaled);
}

function tryApplyTwinDrakeStun(enemy, learned, now = performance.now()) {
  if (!enemy || enemy.hp <= 0 || !learned) return false;
  const level = Math.max(0, Math.min(3, Number(learned.level) || 0));
  const playerLevel = Math.max(1, Math.trunc(Number(state.battle.player?.level ?? state.game.progress.level) || 1));
  const enemyLevel = Math.max(0, Math.trunc(Number(enemy?.level) || 0));
  if (enemyLevel >= playerLevel + 10) return false;
  if (randomInt(0, 19) > level + 1) return false;
  const durationMs = (2 + level) * 1000;
  enemy.stunnedUntil = Math.max(Number(enemy.stunnedUntil) || 0, now + durationMs);
  G.pushBattleLog(`${enemy.name} is stunned.`);
  return true;
}

function queueAttachedSpellFx(spellId, options = {}) {
  const now = options.now ?? performance.now();
  const layerStart = Math.max(0, Math.trunc(Number(options.layerStart) || 0));
  const layerEnd = options.layerEnd == null
    ? layerStart + 1
    : Math.max(layerStart + 1, Math.trunc(Number(options.layerEnd) || 0));
  const durationMs = Math.max(1, Math.trunc(Number(options.durationMs) || G.warriorChargeFxDurationMs(spellId)));
  const battle = state.battle;
  battle.attachedSpellFx = [
    ...(battle.attachedSpellFx ?? []),
    {
      spellId,
      memberClassId: options.memberClassId ?? null,
      startedAt: now,
      expiresAt: now + durationMs,
      layerStart,
      layerEnd,
    },
  ].slice(-12);
}

function queueWarriorChargeFx(spellId, memberClassId, now) {
  if (spellId === "TwinDrakeBlade") return;
  queueAttachedSpellFx(spellId, {
    now,
    memberClassId,
    layerStart: 0,
    layerEnd: 1,
    durationMs: G.warriorChargeFxDurationMs(spellId),
  });
}

function queueTwinDrakeSwingFx(memberClassId, now) {
  const layer = G.warriorSkillFxLayers("TwinDrakeBlade", "swing")[0];
  const durationMs = layer?.frames?.length ? layer.frames.length * layer.interval : CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS;
  queueAttachedSpellFx("TwinDrakeBlade", {
    now,
    memberClassId,
    layerStart: 1,
    layerEnd: 2,
    durationMs,
  });
}

function startMagicShieldLoopFx(options = {}) {
  const now = options.now ?? performance.now();
  const memberClassId = options.memberClassId ?? null;
  const expiresAt = Number(options.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return;
  const battle = state.battle;
  const others = (battle.attachedSpellFx ?? []).filter(
    (entry) => entry.spellId !== "MagicShield" || (entry.memberClassId ?? null) !== memberClassId,
  );
  battle.attachedSpellFx = [
    ...others,
    {
      spellId: "MagicShield",
      memberClassId,
      startedAt: now,
      loopStartedAt: now,
      expiresAt,
      struckAt: 0,
    },
  ].slice(-12);
}

function updateAttachedSpellFx(now) {
  const battle = state.battle;
  const effects = battle.attachedSpellFx ?? [];
  if (!effects.length) return;
  battle.attachedSpellFx = effects.filter((entry) => {
    if (now >= entry.expiresAt) return false;
    if (entry.spellId === "MagicShield" && !G.magicShieldFxActive(entry.memberClassId ?? null, now)) return false;
    return true;
  });
}

function queueTwinDrakeSecondHit(source, learned, rawDamage, now) {
  if (!learned || rawDamage == null) return;
  const hits = state.battle.pendingTwinDrakeHits ?? [];
  hits.push({
    at: now + CRYSTAL_TWIN_DRAKE_SECOND_HIT_DELAY_MS,
    memberClassId: source?.classId ?? state.battle.combatClass,
    rawDamage: Math.max(0, Math.trunc(Number(rawDamage) || 0)),
    applyStun: true,
  });
  state.battle.pendingTwinDrakeHits = hits.slice(-6);
}

function updatePendingTwinDrakeHits(now) {
  const battle = state.battle;
  const pending = battle.pendingTwinDrakeHits ?? [];
  if (!pending.length || !battle.enemy || battle.enemy.hp <= 0) {
    if (pending.length && (!battle.enemy || battle.enemy.hp <= 0)) G.clearTwinDrakePendingState();
    return;
  }
  const skill = warriorSpellById("TwinDrakeBlade");
  const remaining = [];
  for (const entry of pending) {
    if (now < entry.at) {
      remaining.push(entry);
      continue;
    }
    const learned = G.twinDrakeLearnedForMember(entry.memberClassId);
    const attacker = G.twinDrakeAttackerForMember(entry.memberClassId);
    if (!skill || !learned || !attacker) continue;
    queueTwinDrakeSwingFx(entry.memberClassId, now);
    if (!rollHit(attacker.accuracy, battle.enemy.agility)) {
      G.pushBattleLog(`Twin Drake Blade follow-up misses ${battle.enemy.name}.`);
      continue;
    }
    const damage = scaleEnemyPhysicalDamage(entry.rawDamage, battle.enemy, now);
    if (damage <= 0) continue;
    G.reduceEnemyHp(battle.enemy, damage);
    syncBattleEnemyHpToSwarm();
    strikeGroupDungeonSwarmEnemy(battle.enemy, now);
    G.playMonsterSfx("flinch");
    G.playWeaponHitSfx();
    G.addCombatText("enemy", damage, "damage", now);
    G.pushBattleLog(`Twin Drake Blade hits ${battle.enemy.name} again for ${damage}.`);
    if (entry.applyStun) tryApplyTwinDrakeStun(battle.enemy, learned, now);
    if (battle.enemy.hp <= 0) {
      if (G.groupDungeonSwarmActive()) {
        G.maybeKillGroupDungeonSwarmEnemy(battle.enemy, now);
        G.clearTwinDrakePendingState();
        return;
      }
      G.finishEnemy(now);
      G.setEnemyAction("die", false, now);
      G.playMonsterSfx("death");
      G.pushBattleLog(`${battle.enemy.name} is defeated.`);
      G.clearTwinDrakePendingState();
      return;
    }
  }
  battle.pendingTwinDrakeHits = remaining;
}

function usableWarriorAttackSkill(now) {
  const slaying = G.chargedSlayingAttack();
  if (slaying) return slaying;

  const charged = G.chargedWarriorAttack(now);
  if (charged) return charged;

  const queued = queuedWarriorAttackSkill(now);
  if (queued) return queued;

  const candidates = G.autoWarriorCombatSkills()
    .map((skill) => ({ skill, learned: G.learnedMagic(skill.id) }))
    .filter(({ skill, learned }) => {
      if (G.isWarriorChargeSkill(skill) && !G.warriorChargeReady(skill.id)) return false;
      return G.canAutoCastWarriorSkill(skill, learned, now);
    })
    .sort((a, b) => G.warriorAutoPriority(a.skill) - G.warriorAutoPriority(b.skill));
  if (!candidates.length) {
    return { skill: BASIC_ATTACK_SKILL, learned: null, cost: 0 };
  }
  const { skill, learned } = candidates[0];
  return { skill, learned, cost: spellMpCost(skill, learned) };
}

function queuedWarriorAttackSkill(now) {
  const queued = queuedCombatSpell("Warrior");
  if (!queued) return null;
  const { spell: skill, learned, cost } = queued;
  if (G.isWarriorChargeSkill(skill) && !G.warriorChargeReady(skill.id)) {
    return { skill: BASIC_ATTACK_SKILL, learned: null, cost: 0, queuedWaiting: true };
  }
  if (!G.canUseWarriorSkill(skill, learned, now, { requireAuto: false })) {
    return { skill: BASIC_ATTACK_SKILL, learned: null, cost: 0, queuedWaiting: true };
  }
  return { skill, learned, cost, queued: true };
}

function usableWizardAttackSpell(now) {
  const queued = queuedWizardAttackSpell(now);
  if (queued) {
    if (!G.wizardAttackSpellReady(queued.spell, now)) return null;
    return queued;
  }

  const options = G.activeWizardAutoSpells()
    .filter((spell) => spell.impactMode !== "buff")
    .map((spell) => {
    const learned = G.learnedMagic(spell.id);
    const cost = spellMpCost(spell, learned);
    return {
      spell,
      learned,
      cost,
      cooldownWaiting: !G.canWizardCastSpell(spell, learned, now),
    };
  });
  if (!options.length) return null;
  const ready = options.filter((option) => !option.cooldownWaiting && G.wizardAttackSpellReady(option.spell, now));
  return ready.find((option) => (state.battle.player?.mp ?? 0) >= option.cost)
    ?? ready.find((option) => !option.cooldownWaiting)
    ?? null;
}

function queuedWizardAttackSpell(now) {
  const queued = queuedCombatSpell("Wizard");
  if (!queued) return null;
  const { spell, learned, cost } = queued;
  return {
    spell,
    learned,
    cost,
    queued: true,
    cooldownWaiting: (learned.castReadyAt ?? 0) > now,
  };
}

function rollSlayingChargeAfterAttack(now) {
  if (G.warriorSlayingPending()) return false;
  const spell = warriorSpellById("Slaying");
  const learned = G.learnedMagic("Slaying");
  if (!spell || !learned) return false;
  const level = Math.max(0, Math.min(3, Number(learned.level) || 0));
  if (randomInt(0, 11) > level) return false;
  setWarriorSlayingReady(now);
  G.pushBattleLog("Slaying readied for the next attack.");
  battlePanelSignature = "";
  return true;
}

function setWarriorSlayingReady(now, member = null) {
  if (member?.classId) {
    member.slayingReady = true;
    member.slayingReadyAt = now;
    if (member.classId === G.bossPartyControlledClassId()) {
      state.battle.slayingReady = true;
      state.battle.slayingReadyAt = now;
    }
    return;
  }
  state.battle.slayingReady = true;
  state.battle.slayingReadyAt = now;
  if (state.battle.bossParty?.active && state.battle.combatClass === "Warrior") {
    const controlled = G.bossPartyControlledMember();
    if (controlled) {
      controlled.slayingReady = true;
      controlled.slayingReadyAt = now;
    }
  }
}

function rollWarriorMagicDamage(skill, learned, player, enemy) {
  const attack = rollStat(player.dc, player.luck);
  const boosted = Math.trunc((attack + G.crystalMagicPower(skill, learned)) * G.crystalMagicMultiplier(skill, learned));
  const defence = rollStat(G.enemyPhysicalDefence(enemy));
  return Math.max(0, boosted - defence);
}

function rollWizardMagicDamage(spell, learned, player, enemy) {
  const boosted = rollWizardMagicValue(spell, learned, player);
  const adjusted = spell?.id === "ThunderBolt" && enemy?.undead ? Math.trunc(boosted * 1.5) : boosted;
  return G.applyWizardMagicDefence(adjusted, enemy);
}

function rollWizardMagicValue(spell, learned, player) {
  return G.crystalMagicDamageBeforeDefence(spell, learned, G.combatantForMagicRoll(player));
}

function rollTaoistHealingAmount(spell, learned, player) {
  const attack = rollStat(player.sc, player.luck);
  const boosted = Math.trunc(((attack * 2) + G.crystalMagicPower(spell, learned)) * G.crystalMagicMultiplier(spell, learned));
  const level = Math.max(1, Math.trunc(Number(player?.level ?? state.game.progress.level) || 1));
  return Math.max(1, boosted + level);
}

function rollTaoistMagicDamage(spell, learned, player, enemy) {
  return G.applyWizardMagicDefence(rollTaoistMagicValue(spell, learned, player), enemy);
}

function rollTaoistMagicValue(spell, learned, player) {
  const stats = G.combatantForMagicRoll(player);
  const attack = rollStat(stats.sc ?? stats.dc, stats.luck);
  return Math.trunc((attack + G.crystalMagicPower(spell, learned)) * G.crystalMagicMultiplier(spell, learned));
}

function scaleStatRange(stat, multiplier) {
  const [min, max] = statRange(stat);
  const scale = Number(multiplier) || 0;
  return [Math.max(0, Math.floor(min * scale)), Math.max(0, Math.floor(max * scale))];
}

function rollFrostCrunchSlow(skillLevel) {
  return randomInt(0, 19) <= Math.max(0, Math.min(3, Math.trunc(Number(skillLevel) || 0)));
}

function rollFrostCrunchFrozen(skillLevel) {
  return randomInt(0, 39) <= Math.max(0, Math.min(3, Math.trunc(Number(skillLevel) || 0)));
}

function rollTaoistPoisonPower(spell, learned, player) {
  const attack = rollStat(player.sc, player.luck);
  return Math.max(0, Math.trunc((attack + G.crystalMagicPower(spell, learned)) * G.crystalMagicMultiplier(spell, learned)));
}

function rollMagicHit(enemy) {
  const magicResist = Math.max(0, Math.min(CRYSTAL_MAGIC_RESIST_WEIGHT, Number(enemy?.magicResist) || 0));
  return magicResist <= 0 || randomInt(0, CRYSTAL_MAGIC_RESIST_WEIGHT - 1) >= magicResist;
}

function rollMagicShieldReductionPercent(learned) {
  const skillLevel = Math.max(0, Math.min(3, Math.trunc(Number(learned?.level) || 0)));
  return (skillLevel + 2) * 10;
}

function rollDefenceBuffBonus(level) {
  return Math.floor(Math.max(1, Math.trunc(Number(level) || 1)) / 7) + 4;
}

function rollTaoistDefenceBuffBonus(level) {
  return rollDefenceBuffBonus(level);
}

function rollWizardDefenceBuffDurationMs(learned, caster) {
  const mc = rollStat(caster?.mc ?? [0, 0], caster?.luck ?? 0);
  const skillLevel = Math.max(0, Math.min(3, Math.trunc(Number(learned?.level) || 0)));
  return Math.max(1000, (mc * 4 + (skillLevel + 1) * 50) * 1000);
}

function rollTaoistDefenceBuffDurationMs(learned, caster) {
  const sc = rollStat(caster?.sc ?? [0, 0], caster?.luck ?? 0);
  const skillLevel = Math.max(0, Math.min(3, Math.trunc(Number(learned?.level) || 0)));
  return Math.max(1000, (sc * 4 + (skillLevel + 1) * 50) * 1000);
}

function showTaoistDefenceBuffTexts(spell, bonus, applied, now = performance.now()) {
  if (!applied?.results?.length || suppressSimulationRender) return;
  const statTag = G.defenceBuffStat(spell.id) === "amc" ? "MAC" : "AC";
  const text = `+${bonus} ${statTag}`;
  for (const entry of applied.results) {
    if (!entry.entity || entry.entity.hp <= 0) continue;
    if (state.battle.bossParty?.active) {
      if (entry.entity === state.battle.bossParty?.pet || entry.entity?.classId) {
        G.addBossPartyMemberCombatText(entry.entity, text, "buff", now);
      }
      continue;
    }
    const anchor = entry.entity === state.battle.taoPet
      ? "pet"
      : (entry.entity === state.battle.player ? "player" : entry.entity?.classId ?? "player");
    G.addCombatText(anchor, text, "buff", now);
  }
}

function rollUltimateEnhancerBonus(caster) {
  const maxSc = statRange(caster?.sc ?? [0, 0])[1];
  return maxSc >= 5 ? Math.min(ULTIMATE_ENHANCER_BONUS_CAP, Math.floor(maxSc / 5)) : 1;
}

function setEntityStatBuffList(entity, buffList) {
  if (entity === state.battle.taoPet) {
    state.battle.petStatBuffs = buffList;
    return;
  }
  if (entity === state.battle.bossParty?.pet || entity?.classId) {
    entity.statBuffs = buffList;
    return;
  }
  state.battle.statBuffs = buffList;
}

function showUltimateEnhancerBuffTexts(applied, now = performance.now()) {
  if (!applied?.results?.length || suppressSimulationRender) return;
  for (const entry of applied.results) {
    const text = `+${entry.bonus} ${entry.stat.toUpperCase()}`;
    if (state.battle.bossParty?.active) {
      if (entry.entity === state.battle.bossParty?.pet || entry.entity?.classId) {
        G.addBossPartyMemberCombatText(entry.entity, text, "buff", now);
      }
      continue;
    }
    const anchor = entry.entity === state.battle.taoPet
      ? "pet"
      : (entry.entity === state.battle.player ? "player" : entry.entity?.classId ?? "player");
    G.addCombatText(anchor, text, "buff", now);
  }
}

function updatePendingUltimateEnhancer(now, options = {}) {
  const battle = state.battle;
  const pending = battle.pendingUltimateEnhancer;
  if (!pending || now < pending.at || !battle.player || battle.player.hp <= 0) return false;
  battle.pendingUltimateEnhancer = null;
  const spell = G.taoistCombatSpell(pending.spellId);
  const learned = G.learnedMagic(spell?.id);
  const targets = G.ultimateEnhancerTargets(now);
  if (!spell || !learned || !targets.length) return false;
  const applied = G.applyUltimateEnhancerToTargets(spell, learned, battle.player, targets, now);
  if (!applied) return false;
  if (!options.offline && !suppressSimulationRender) {
    battle.activeTaoSpell = null;
    battle.activeTaoSpellAtlas = null;
    showUltimateEnhancerBuffTexts(applied, now);
    queueUltimateEnhancerImpactFx(spell, applied, now);
    G.pushBattleLog(G.formatUltimateEnhancerAppliedLog(spell, state.battle.combatClass, applied, applied.durationMs));
  }
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  return true;
}

function usableTaoistUltimateEnhancer(now, options = {}) {
  const spell = G.taoistCombatSpell("UltimateEnhancer");
  const learned = G.learnedMagic(spell?.id);
  const manual = options.requireAuto === false;
  if (!spell || !learned || !G.canUseTaoistSpell(spell, learned, now, { requireAuto: !manual })) return null;
  const targets = G.ultimateEnhancerTargets(now);
  if (!targets.length) return null;
  if (!manual && !G.ultimateEnhancerNeedsCast(now)) return null;
  const entry = G.amuletCandidate(0);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !G.isTaoistAmuletItem(item)) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry,
    item,
    targets,
  };
}

function updatePendingDefenceBuff(now, options = {}) {
  const battle = state.battle;
  const pending = battle.pendingDefenceBuff;
  if (!pending || now < pending.at || !battle.player || battle.player.hp <= 0) return false;
  battle.pendingDefenceBuff = null;
  const spell = G.combatDefenceBuffSpell(pending.spellId);
  const learned = G.learnedMagic(spell?.id);
  if (!spell || !learned) return false;
  const applied = G.applyDefenceBuffEffect(spell, learned, battle.player, now);
  if (!applied) return false;
  const { bonus, durationMs, reductionPercent, results } = applied;
  if (!options.offline && !suppressSimulationRender) {
    if (spell.id === "MagicShield") {
      startMagicShieldLoopFx({ expiresAt: now + durationMs, now });
      battle.activeWizardSpell = null;
      battle.activeWizardSpellAtlas = null;
      const appliedText = G.formatDefenceBuffApplied(spell, bonus, reductionPercent);
      G.addCombatText("player", appliedText, "buff", now);
      G.pushBattleLog(`${spell.label} strengthens defence (${appliedText}, ${formatBuffRemaining(durationMs)}).`);
    } else {
      queueDefenceBuffImpactTargets(spell, now, {
        worldX: state.battle.playerX,
      });
      battle.activeTaoSpell = null;
      battle.activeTaoSpellAtlas = null;
      showTaoistDefenceBuffTexts(spell, bonus, applied, now);
      G.pushBattleLog(`${spell.label} strengthens defence (${G.formatTaoistDefenceBuffAppliedLog(spell, bonus, applied, durationMs)}).`);
    }
  }
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  refreshCharacterStatsOverlay();
  return true;
}

function usableWizardDefenceBuff(now, options = {}) {
  const spell = G.wizardCombatSpell("MagicShield");
  const learned = G.learnedMagic(spell?.id);
  const manual = options.requireAuto === false;
  if (!spell || !learned || !G.canUseWizardSpell(spell, learned, now, { requireAuto: !manual })) return null;
  if (state.battle.pendingDefenceBuff?.spellId === "MagicShield") return null;
  if (!manual && !G.needsDefenceBuff("MagicShield", now)) return null;
  return { spell, learned, cost: spellMpCost(spell, learned) };
}

function usableQueuedWizardDefenceBuff(now) {
  const queued = queuedCombatSpell("Wizard");
  if (!queued || queued.spell.id !== "MagicShield") return null;
  return usableWizardDefenceBuff(now, { requireAuto: false });
}

function usableTaoistDefenceBuff(spellId, now, options = {}) {
  const spell = G.taoistCombatSpell(spellId);
  const learned = G.learnedMagic(spell?.id);
  const manual = options.requireAuto === false;
  if (!spell || !learned || !G.canUseTaoistSpell(spell, learned, now, { requireAuto: !manual })) return null;
  if (!manual && !G.needsDefenceBuff(spellId, now)) return null;
  const entry = G.amuletCandidate(0);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !G.isTaoistAmuletItem(item)) return null;
  return { spell, learned, cost: spellMpCost(spell, learned), entry, item };
}

function usableTaoistHealing(now, options = {}) {
  const spell = G.taoistCombatSpell("Healing");
  const learned = G.learnedMagic(spell.id);
  const manual = options.requireAuto === false;
  if (!G.canUseTaoistSpell(spell, learned, now, { requireAuto: !manual })) return null;
  const pet = G.taoistPetCanBeHealed() ? state.battle.taoPet : null;
  if (pet && (manual || pet.hp / Math.max(1, pet.maxHp) < AUTO_POTION_THRESHOLD)) {
    const pendingAmount = Math.max(0, Number(pet.healAmount) || 0)
      + (state.battle.pendingHeal?.target === "pet" ? Math.max(0, Number(state.battle.pendingHeal?.amount) || 0) : 0);
    if (pendingAmount < pet.maxHp - pet.hp) {
      return { spell, learned, cost: spellMpCost(spell, learned), target: "pet" };
    }
  }
  const player = state.battle.player;
  if (!player || player.hp <= 0 || player.hp >= player.maxHp) return null;
  if (!manual && player.hp / Math.max(1, player.maxHp) >= AUTO_POTION_THRESHOLD) return null;
  const pendingAmount = Math.max(0, Number(state.battle.healAmount) || 0)
    + (state.battle.pendingHeal?.target === "pet" ? 0 : Math.max(0, Number(state.battle.pendingHeal?.amount) || 0));
  if (pendingAmount >= player.maxHp - player.hp) return null;
  return { spell, learned, cost: spellMpCost(spell, learned), target: "player" };
}

function usableTaoistPoisoning(now, options = {}) {
  const spell = G.taoistCombatSpell("Poisoning");
  const learned = G.learnedMagic(spell.id);
  if (!G.canUseTaoistSpell(spell, learned, now, { requireAuto: options.requireAuto !== false })) return null;
  if (state.battle.pendingPoison) return null;
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0) return null;
  if (!options.ignoreRange && G.enemyDistance() > G.crystalSpellRangePx(spell)) return null;
  const entry = G.poisonCandidateForEnemy(enemy, now);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !G.isPoisonItem(item)) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry,
    item,
    kind: G.poisonItemKind(item),
  };
}

function usableTaoistSoulFireBall(now, options = {}) {
  const spell = G.taoistCombatSpell("SoulFireBall");
  const learned = G.learnedMagic(spell.id);
  if (!G.canUseTaoistSpell(spell, learned, now, { requireAuto: options.requireAuto !== false })) return null;
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0) return null;
  if (!options.ignoreRange && G.enemyDistance() > G.taoistSoulFireBallRangePx(spell)) return null;
  const entry = G.amuletCandidate(0);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !G.isTaoistAmuletItem(item)) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry,
    item,
  };
}

function usableTaoistSummonSpell(spellId, now, options = {}) {
  const spell = G.taoistCombatSpell(spellId);
  if (!spell) return null;
  const learned = G.learnedMagic(spell.id);
  if (!G.canUseTaoistSpell(spell, learned, now, { requireAuto: options.requireAuto !== false })) return null;
  const battle = state.battle;
  if (battle.taoPetDiedThisFight || battle.taoPet?.active || battle.pendingTaoPet) return null;
  const enemy = battle.enemy;
  if (!enemy || enemy.hp <= 0 || battle.combatClass !== "Taoist") return null;
  if (!options.ignoreRange && G.enemyDistance() > G.taoistSummonPetRangePx()) return null;
  const amuletCost = G.taoistSummonAmuletCost(spell.id);
  const entry = G.amuletCandidate(0);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !G.isTaoistAmuletItem(item) || G.amuletInventoryCount() < amuletCost) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry,
    item,
    amuletCost,
  };
}

function usableTaoistSummonSkeleton(now, options = {}) {
  return usableTaoistSummonSpell("SummonSkeleton", now, options);
}

function usableTaoistSummonShinsu(now, options = {}) {
  return usableTaoistSummonSpell("SummonShinsu", now, options);
}

function usableQueuedTaoistSpell(now) {
  const queued = queuedCombatSpell("Taoist");
  if (!queued) return null;
  if (queued.spell.id === "Healing") return usableTaoistHealing(now, { requireAuto: false });
  if (queued.spell.id === "Poisoning") return usableTaoistPoisoning(now, { requireAuto: false });
  if (queued.spell.id === "SoulFireBall") return usableTaoistSoulFireBall(now, { requireAuto: false });
  if (queued.spell.id === "SummonSkeleton") return usableTaoistSummonSkeleton(now, { requireAuto: false });
  if (queued.spell.id === "SummonShinsu") return usableTaoistSummonShinsu(now, { requireAuto: false });
  if (queued.spell.id === "SoulShield") return usableTaoistDefenceBuff("SoulShield", now, { requireAuto: false });
  if (queued.spell.id === "BlessedArmour") return usableTaoistDefenceBuff("BlessedArmour", now, { requireAuto: false });
  if (queued.spell.id === "UltimateEnhancer") return usableTaoistUltimateEnhancer(now, { requireAuto: false });
  G.clearQueuedCombatSpell(queued.spell.id);
  return null;
}

function updatePendingTaoPet(now) {
  const battle = state.battle;
  const pending = battle.pendingTaoPet;
  if (!pending || now < pending.at) return false;
  battle.pendingTaoPet = null;
  if (battle.combatClass !== "Taoist" || !battle.enemy || battle.enemy.hp <= 0 || !battle.running) return true;
  battle.taoPet = G.createTaoistSummonPet(pending.spellId, pending.spellLevel, now);
  state.taoPetAtlas = G.taoPetAtlasFor(battle.taoPet);
  battle.enemyAggro = true;
  G.playTaoPetAppearSfx({ volume: 0.48, throttleMs: 250 });
  G.pushBattleLog(`${battle.taoPet.name} joins the fight.`);
  battlePanelSignature = "";
  return true;
}

function taoShinsuPetMonsterIndex(pet) {
  if (!pet || pet.spellId !== "SummonShinsu") return CRYSTAL_SUMMON_SHINSU_PET_INDEX;
  if (pet.shinsuVisible || pet.action === "attack1" || pet.action === "struck" || pet.action === "die" || pet.action === "dead") {
    return CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX;
  }
  return CRYSTAL_SUMMON_SHINSU_PET_INDEX;
}

function revealTaoistShinsuPet(pet) {
  if (!pet || pet.spellId !== "SummonShinsu" || pet.shinsuVisible) return;
  pet.shinsuVisible = true;
  pet.monsterIndex = CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX;
}

function rollTaoistPetAttackResult(pet, enemy) {
  if (!rollHit(pet.accuracy, enemy.agility)) return { hit: false, damage: 0 };
  const damage = rollDamage(G.effectiveCombatStats(pet).dc, G.enemyPhysicalDefence(enemy), pet.luck);
  return { hit: damage > 0, damage };
}

function updatePendingPetAttack(now, options = {}) {
  const battle = state.battle;
  const impact = battle.pendingPetAttack;
  if (!impact || now < impact.at) return false;
  battle.pendingPetAttack = null;
  const pet = battle.taoPet ?? battle.bossParty?.pet;
  const enemy = battle.enemy;
  if (!pet?.active || !enemy || enemy.hp <= 0) return true;
  const offline = Boolean(options.offline || impact.offline);
  if (!offline) G.playTaoPetSfx("hit", { volume: 0.38, throttleMs: 120, pet });
  G.applyTaoistPetAttackResult(pet, enemy, impact, now, {
    offline,
    bossParty: Boolean(impact.bossParty),
    skipHitSfx: true,
  });
  return true;
}

function retireTaoistPetAfterFight(now = performance.now()) {
  const pet = state.battle.taoPet;
  if (!pet || pet.dead) return;
  G.markTaoistPetDead(now, { message: `${pet.name} collapses after the fight.` });
}

function updateTaoistPetAttack(now, options = {}) {
  const battle = state.battle;
  const pet = battle.taoPet;
  if (battle.combatClass !== "Taoist" || !pet?.active || !battle.enemy || battle.enemy.hp <= 0) return false;
  if (G.combatantParalyzed(pet)) return false;
  if (battle.pendingPetAttack) return false;
  if (now < (pet.nextAttackAt ?? 0)) return false;
  if (pet.spellId === "SummonShinsu" && !pet.shinsuVisible && pet.action === "show") {
    if (!options.offline) return false;
    revealTaoistShinsuPet(pet);
    pet.action = "standing";
    pet.frame = 0;
    pet.oneShot = false;
  }
  if (G.taoistPetEnemyDistance() > G.taoistPetAttackRangePx(pet)) {
    if (!options.offline) setTaoPetAction("standing", false, now);
    return false;
  }
  pet.nextAttackAt = now + Math.max(400, Math.trunc(Number(pet.attackMs) || 1200));
  return G.taoistPetAttack(now, options);
}

function setTaoPetAction(action, oneShot = false, now = performance.now()) {
  const pet = state.battle.taoPet;
  if (!pet?.active) return;
  pet.action = action;
  pet.frame = 0;
  pet.oneShot = oneShot;
  pet.lastTick = now;
  if (action === "struck" && oneShot) {
    G.playTaoPetFlinchSfx({ pet });
  }
}

function updatePendingImpact(now) {
  const battle = state.battle;
  const impact = battle.pendingImpact;
  if (!impact || now < impact.at) return;
  const spell = G.combatAttackSpell(impact.spellId);
  battle.pendingImpact = null;
  if (!spell) return;
  if (spell.impactMode === "ground") {
    G.createWizardGroundSpellEffect(spell, impact, now);
    return;
  }
  G.playSpellStrikeSfx(spell.id, { volume: 0.5, force: true, throttleMs: 0 });
  const canApply = battle.enemy && battle.enemy.hp > 0 && battle.enemyRevealed;
  if (!canApply) return;
  if (!impact.hit) {
    G.addCombatText("enemy", "Miss", "miss", now);
    G.pushBattleLog(`${spell.label} misses ${battle.enemy.name}.`);
    return;
  }
  G.reduceEnemyHp(battle.enemy, impact.damage);
  G.setEnemyAction("struck", true, now);
  G.playMonsterSfx("flinch");
  G.addCombatText("enemy", impact.damage, "damage", now);
  G.pushBattleLog(`${spell.label} hits ${battle.enemy.name} for ${impact.damage}.`);
  const learned = G.learnedMagic(spell.id);
  if (spell.id === "FrostCrunch" && impact.damage > 0 && learned) {
    G.applyFrostCrunchEffects(battle.enemy, learned, battle.player, now);
  }
  if (learned) G.levelMagicSkill(spell, learned, now);

  if (battle.enemy.hp <= 0) {
    G.finishEnemy(now);
    G.setEnemyAction("die", false, now);
    G.playMonsterSfx("death");
    G.pushBattleLog(`${battle.enemy.name} is defeated.`);
  }
}

function rollMapLightningDamage(settings) {
  return settings.min + Math.floor(Math.random() * (settings.max - settings.min + 1));
}

function randomMapLightningIntervalMs() {
  return MAP_LIGHTNING_MIN_INTERVAL_MS
    + Math.floor(Math.random() * (MAP_LIGHTNING_MAX_INTERVAL_MS - MAP_LIGHTNING_MIN_INTERVAL_MS + 1));
}

function resolveMapLightningDamage(rawDamage, target) {
  const amount = Math.max(0, Math.trunc(Number(rawDamage) || 0));
  if (amount <= 0) return { hit: true, damage: 0 };
  const defence = G.defenceTargetForIncomingAttack(target);
  if (!rollMagicHit({ magicResist: defence.magicResist ?? 0 })) {
    return { hit: false, damage: 0 };
  }
  const damage = G.applyIncomingDamageReduction(
    rollDamage([amount, amount], defence.amc ?? defence.ac, 0),
    defence,
  );
  return { hit: damage > 0, damage };
}

function spawnMapLightningWave(now) {
  const settings = G.mapLightningSettings();
  if (!settings) return;
  const targets = G.mapLightningTargets();
  if (!targets.length) return;
  const effects = state.battle.mapLightningEffects ?? [];
  for (const target of targets) {
    effects.push({
      id: `map-lightning-${now}-${Math.random()}`,
      worldX: G.pickMapLightningWorldX(G.mapLightningTargetWorldX(target)),
      variantIndex: Math.floor(Math.random() * 3),
      damage: rollMapLightningDamage(settings),
      targetClassId: target.classId ?? null,
      solo: Boolean(target.solo),
      createdAt: now,
      expiresAt: now + MAP_LIGHTNING_HIT_DELAY_MS + MAP_LIGHTNING_EFFECT_MS,
      resolveBy: now + MAP_LIGHTNING_HIT_DELAY_MS + MAP_LIGHTNING_RESOLVE_GRACE_MS,
      hitAt: now + MAP_LIGHTNING_HIT_DELAY_MS,
      resolved: false,
    });
    G.playSfx("map.lightning", { volume: 0.55, throttleMs: 80 });
  }
  state.battle.mapLightningEffects = effects.slice(-12);
}

function updateMapLightning(now) {
  let changed = false;
  for (const effect of state.battle.mapLightningEffects ?? []) {
    if (!effect.resolved && now >= effect.hitAt) {
      G.applyMapLightningStrikeHit(effect, now);
      changed = true;
      if (state.battle.bossParty?.active && G.bossPartyAllMembersDead()) break;
      if (!state.battle.bossParty?.active && (state.battle.player?.hp ?? 0) <= 0) break;
    }
  }
  const remaining = (state.battle.mapLightningEffects ?? []).filter((effect) => {
    if (!effect.resolved) return now <= (effect.resolveBy ?? effect.expiresAt);
    return now <= effect.expiresAt;
  });
  if (remaining.length !== (state.battle.mapLightningEffects ?? []).length) {
    state.battle.mapLightningEffects = remaining;
    changed = true;
  }
  if (!G.mapLightningActive()) return changed;
  if (!state.battle.nextMapLightningAt) {
    state.battle.nextMapLightningAt = now + randomMapLightningIntervalMs();
  } else if (now >= state.battle.nextMapLightningAt) {
    spawnMapLightningWave(now);
    state.battle.nextMapLightningAt = now + randomMapLightningIntervalMs();
    changed = true;
  }
  return changed;
}

function updateGroundSpellEffects(now) {
  const battle = state.battle;
  const effects = Array.isArray(battle.groundSpellEffects) ? battle.groundSpellEffects : [];
  if (!effects.length) return false;

  let changed = false;
  battle.groundSpellEffects = effects.filter((effect) => now <= effect.expiresAt);
  if (battle.groundSpellEffects.length !== effects.length) changed = true;

  const swarmActive = G.groupDungeonSwarmActive();
  for (const effect of battle.groundSpellEffects) {
    while (effect.nextTickAt <= now && effect.nextTickAt <= effect.expiresAt) {
      if (swarmActive && effect.tiles?.length) {
        const swarmEnemies = battle.swarm?.enemies ?? [];
        for (const swarmEnemy of swarmEnemies) {
          if (swarmEnemy.hp <= 0 || swarmEnemy.dying) continue;
          if (!G.groundSpellEffectHitsSwarmEnemy(effect, swarmEnemy)) continue;
          G.applyGroundSpellTickToSwarmEnemy(effect, swarmEnemy, effect.nextTickAt);
          changed = true;
        }
      } else if (battle.enemy?.hp > 0 && G.groundSpellEffectHitsEnemy(effect)) {
        G.applyGroundSpellTick(effect, effect.nextTickAt);
        changed = true;
        if ((battle.enemy?.hp ?? 0) <= 0) break;
      }
      effect.nextTickAt += effect.tickMs;
    }
  }
  return changed;
}

function rollHit(accuracy, agility) {
  const acc = Math.max(0, Math.trunc(Number(accuracy) || 0));
  const agi = Math.max(0, Math.trunc(Number(agility) || 0));
  return randomInt(0, agi) <= acc;
}

function resolvePhysicalAttack(attackerAccuracy, defenderAgility, attackStat, defenceStat, luck = 0) {
  if (!rollHit(attackerAccuracy, defenderAgility)) return { hit: false, damage: 0 };
  const damage = rollDamage(attackStat, defenceStat, luck);
  return { hit: damage > 0, damage };
}

function resolveIncomingEnemyRangedAttack(enemy, target, options = {}) {
  const rangedType = enemy?.rangedAttackDefenceType || enemy?.attackDefenceType || "MAC";
  return resolveIncomingEnemyAttack({ ...enemy, attackDefenceType: rangedType }, target, options);
}

function resolveIncomingEnemyAttack(enemy, target, options = {}) {
  const defenceType = G.enemyAttackDefenceType(enemy);
  if ((defenceType === "MACAgility" || defenceType === "MAC") && !rollMagicHit({ magicResist: target.magicResist ?? 0 })) {
    return { hit: false, damage: 0 };
  }
  if (defenceType !== "MAC" && !rollHit(enemy.accuracy, target.agility)) return { hit: false, damage: 0 };
  const damage = G.applyIncomingDamageReduction(
    rollDamage(
      G.enemyAttackDamageStat(enemy, options),
      G.incomingAttackDefenceStat(target, defenceType),
      enemy.luck,
    ),
    target,
  );
  return { hit: damage > 0, damage };
}

function xpForNextLevel(level) {
  return crystalExperienceForLevel(level);
}

function xpProgressText() {
  const needed = xpForNextLevel(state.game.progress.level);
  return Number.isFinite(needed) ? `XP ${state.game.progress.experience}/${needed}` : "XP Max";
}

function triggerLevelUpFx(now = performance.now(), level = state.game.progress.level) {
  state.levelUpEffects.push({
    id: `${now}-${level}-${Math.random()}`,
    createdAt: now,
    level,
  });
  state.levelUpEffects = state.levelUpEffects.slice(-3);
  G.playSfx("level.up", { volume: 0.65, throttleMs: 500 });
  G.render();
}

function rollRedThunderZumaDrops() {
  const added = [];
  const ignored = [];

  const guaranteedId = ZUMA_THUNDER_GUARANTEED_DROP_IDS[
    Math.floor(Math.random() * ZUMA_THUNDER_GUARANTEED_DROP_IDS.length)
  ];
  const guaranteed = G.itemDefinition(guaranteedId);
  if (guaranteed) G.addZoneDropItem(guaranteed, added, ignored);

  for (const itemId of RED_THUNDER_ZUMA_BONUS_WEAPON_IDS) {
    if (Math.random() >= RED_THUNDER_ZUMA_BONUS_WEAPON_CHANCE) continue;
    const item = G.itemDefinition(itemId);
    if (item) G.addZoneDropItem(item, added, ignored);
  }

  if (Math.random() < RED_THUNDER_ZUMA_ZUMA_WEAPON_CHANCE) {
    const zumaId = RED_THUNDER_ZUMA_ZUMA_WEAPON_IDS[
      Math.floor(Math.random() * RED_THUNDER_ZUMA_ZUMA_WEAPON_IDS.length)
    ];
    const zumaWeapon = G.itemDefinition(zumaId);
    if (zumaWeapon) G.addZoneDropItem(zumaWeapon, added, ignored);
  }

  return { added, ignored };
}

function rollZoneDrops(zone, enemy = state.battle.enemy) {
  const added = [];
  const ignored = [];
  if (!zone) return { added, ignored };
  const candidates = G.zoneDropCandidates(zone, enemy);
  for (const { item, chance } of candidates) {
    if (Math.random() >= chance) continue;
    G.addZoneDropItem(item, added, ignored);
  }
  updateDropPity(zone, candidates, added, ignored);
  return { added, ignored };
}

function updateDropPity(zone, candidates, added, ignored) {
  if (!zone || candidates.length === 0) return;
  if (added.length || ignored.length) {
    state.game.dropPity[zone.id] = 0;
    return;
  }

  const dryKills = Math.max(0, Math.trunc(Number(state.game.dropPity[zone.id]) || 0)) + 1;
  state.game.dropPity[zone.id] = dryKills;
  if (dryKills < DROP_PITY_KILLS) return;

  const forced = weightedDropCandidate(candidates);
  if (!forced) return;
  G.addZoneDropItem(forced.item, added, ignored);
  state.game.dropPity[zone.id] = 0;
}

function weightedDropCandidate(candidates) {
  const weighted = candidates.filter((candidate) => candidate.chance > 0);
  if (!weighted.length) return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  const total = weighted.reduce((sum, candidate) => sum + candidate.chance, 0);
  let roll = Math.random() * total;
  for (const candidate of weighted) {
    roll -= candidate.chance;
    if (roll <= 0) return candidate;
  }
  return weighted.at(-1) ?? null;
}

function spawnNextEnemy(now) {
  const battle = state.battle;
  const currentIndex = ENEMY_TEMPLATES.findIndex((enemy) => enemy.id === battle.enemyId);
  const zone = G.activeZone();
  const template = state.game.mode === "zone"
    ? (G.isTrainingRoomZone(zone) ? G.trainingRoomEnemyTemplate(zone) : randomZoneEnemyTemplate(zone))
    : ENEMY_TEMPLATES[(currentIndex + 1 + ENEMY_TEMPLATES.length) % ENEMY_TEMPLATES.length];
  battle.enemyId = template.id;
  battle.enemy = { ...template, hp: template.maxHp, mp: template.maxMp, poisons: [], debuffs: { slowUntil: 0, frozenUntil: 0 } };
  battle.enemyX = battle.playerX + G.enemySpawnDistance();
  battle.enemyAggro = false;
  battle.phase = "advance";
  battle.travelStartedAt = now;
  battle.travelStartedX = battle.playerX;
  battle.nextEnemySpawnAt = 0;
  battle.activeSkill = "None";
  battle.activeSkillAtlas = null;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = null;
  battle.activeTaoSpellAtlas = null;
  battle.pendingImpact = null;
  battle.pendingEnemyStrike = null;
  battle.pendingPoison = null;
  G.clearTwinDrakePendingState();
  battle.attachedSpellFx = (battle.attachedSpellFx ?? []).filter((entry) => entry.spellId !== "TwinDrakeBlade");
  G.dismissTaoistPet();
  if (battle.enemy) battle.enemy.poisons = [];
  battle.floatingTexts = [];
  state.enemy.index = template.monsterIndex;
  state.enemy.action = "standing";
  state.enemy.frame = 0;
  state.enemy.oneShot = false;
  state.enemy.lastTick = now;
  reloadEnemyAtlas();
  G.pushBattleLog(`A ${template.name} appears ahead.`);
  setPlayerLocomotion("walking", now);
}

function setPlayerAction(action, now = performance.now(), oneShot = false) {
  state.spell = "None";
  state.spellAtlas = null;
  state.action = action;
  state.frame = 0;
  state.playerOneShot = oneShot;
  state.lastTick = now;
  G.updateActionButtons();
}

function setPlayerLocomotion(action, now) {
  if (state.action === action || G.isPlayerOneShotAction()) return;
  state.action = action;
  state.frame = 0;
  state.playerOneShot = false;
  state.lastTick = now;
  G.updateActionButtons();
}

function updateStageSize() {
  const shell = els.stage.parentElement;
  if (!shell) return;
  const shellWidth = shell.clientWidth;
  const shellHeight = shell.clientHeight;
  const mode = state.game.mode;
  if (
    shellWidth === lastStageShellSize.w
    && shellHeight === lastStageShellSize.h
    && mode === lastStageShellSize.mode
    && state.scale === lastStageShellSize.scale
    && state.stageWidth > 0
    && state.stageHeight > 0
  ) {
    return;
  }
  lastStageShellSize = { w: shellWidth, h: shellHeight, mode, scale: state.scale };
  const zone = G.activeZone();
  const inTown = state.game.mode === "town";
  const minWidth = Math.max(520, Number(zone?.stageMinWidth) || 520);
  const minHeight = Math.max(
    260,
    Number(inTown ? TOWN_VISUALS.stageMinHeight : zone?.stageMinHeight) || 260,
  );
  const maxHeight = Math.max(
    minHeight,
    Number(inTown ? TOWN_VISUALS.stageMaxHeight : zone?.stageMaxHeight) || 360,
  );
  const hudReserve = G.combatHudViewportReservePx();
  const width = Math.max(minWidth, Math.floor((shell.clientWidth - 24) / Math.max(1, state.scale)));
  const height = Math.max(
    minHeight,
    Math.min(maxHeight, Math.floor((shell.clientHeight - 24 - hudReserve) / Math.max(1, state.scale))),
  );
  state.stageWidth = width;
  state.stageHeight = height;
}

function weaponShapeForItem(item) {
  const shape = Number(item?.visual?.index);
  return Number.isFinite(shape) ? shape : null;
}

function weaponSfxFamilyFallback(item) {
  if (!item) return "long";
  const name = `${item.id} ${item.name}`.toLowerCase();
  if (name.includes("pickaxe")) return "long";
  if (name.includes("mace") || name.includes("club")) return "club";
  if (name.includes("axe") || name.includes("decapitator")) return "axe";
  if (name.includes("wood")) return "wood";
  if (name.includes("dagger") || name.includes("short")) return "short";
  if (name.includes("spear") || name.includes("trident") || name.includes("halberd")) return "long";
  return "sword";
}

function weaponSwingSfxFamilyForItem(item) {
  const shape = weaponShapeForItem(item);
  if (shape != null && WEAPON_SWING_SFX_BY_SHAPE.has(shape)) return WEAPON_SWING_SFX_BY_SHAPE.get(shape);
  return weaponSfxFamilyFallback(item);
}

function weaponHitSfxFamilyForItem(item) {
  const shape = weaponShapeForItem(item);
  if (shape != null && WEAPON_HIT_SFX_BY_SHAPE.has(shape)) return WEAPON_HIT_SFX_BY_SHAPE.get(shape);
  return weaponSfxFamilyFallback(item);
}

function weaponSfxFamilyForItem(item) {
  return weaponSwingSfxFamilyForItem(item);
}

function resolveMonsterSfxIndex(enemy, kind) {
  const monsterIndex = Number(enemy?.monsterIndex);
  if (!Number.isFinite(monsterIndex)) return null;
  if (G.sfxEntry(`monster.${monsterIndex}.${kind}`)?.src) return monsterIndex;
  return null;
}

function updateEnemyFrame(now) {
  if (G.groupDungeonSwarmActive()) {
    G.updateGroupDungeonSwarmFrames(now);
    return;
  }
  const clip = state.enemy.atlas?.actions?.[state.enemy.action];
  if (state.paused || !clip?.frames?.length) return;
  const dt = now - state.enemy.lastTick;
  if (dt < clip.interval) return;
  const steps = Math.floor(dt / clip.interval);
  const previousFrame = state.enemy.frame;
  if (state.enemy.action === "show") {
    const nextFrame = state.enemy.frame + steps;
    if (nextFrame >= clip.frames.length) {
      state.enemy.action = "standing";
      state.enemy.frame = 0;
      state.enemy.oneShot = false;
      state.enemy.lastTick = now;
      G.completeEnemySpawnReveal(now);
      updateEnemyActionButtons();
      return;
    }
    state.enemy.frame = nextFrame;
    state.enemy.lastTick += steps * clip.interval;
    return;
  }
  const terminal = state.enemy.oneShot || state.enemy.action === "struck" || state.enemy.action === "die";
  if (terminal) {
    const nextFrame = state.enemy.frame + steps;
    if (nextFrame >= clip.frames.length) {
      if (state.battle.enemy?.hp > 0) {
        state.enemy.action = "standing";
        state.enemy.frame = 0;
        state.enemy.oneShot = false;
        state.enemy.lastTick = now;
        updateEnemyActionButtons();
        return;
      }
      state.enemy.frame = clip.frames.length - 1;
    } else {
      state.enemy.frame = nextFrame;
    }
  } else {
    state.enemy.frame = (state.enemy.frame + steps) % clip.frames.length;
  }
  G.maybePlayEnemyFootstep(previousFrame, state.enemy.frame);
  state.enemy.lastTick += steps * clip.interval;
}

function updateTaoPetFrame(now) {
  const pet = state.battle.taoPet;
  if (!pet || (!pet.active && !pet.dead)) return;
  const atlas = G.taoPetAtlasFor(pet);
  const clip = atlas?.actions?.[pet.action];
  if (state.paused || !clip?.frames?.length) return;
  const dt = now - pet.lastTick;
  if (dt < clip.interval) return;
  const steps = Math.floor(dt / clip.interval);
  const terminal = pet.oneShot || pet.action === "struck" || pet.action === "die";
  if (terminal) {
    const nextFrame = pet.frame + steps;
    if (nextFrame >= clip.frames.length) {
      if (pet.dead) {
        pet.action = atlas?.actions?.dead ? "dead" : pet.action;
        pet.frame = atlas?.actions?.dead ? 0 : Math.max(0, clip.frames.length - 1);
      } else if (pet.spellId === "SummonShinsu" && pet.action === "show") {
        revealTaoistShinsuPet(pet);
        pet.action = "standing";
        pet.frame = 0;
      } else {
        pet.action = "standing";
        pet.frame = 0;
      }
      pet.oneShot = false;
      pet.lastTick = now;
      return;
    }
    pet.frame = nextFrame;
  } else {
    pet.frame = (pet.frame + steps) % clip.frames.length;
  }
  pet.lastTick += steps * clip.interval;
}

function updateFrame(now, clip) {
  const spellDriven = state.syncBodyToSpell && state.spell !== "None";
  if (!spellDriven) {
    const dt = now - state.lastTick;
    if (dt >= clip.interval) {
      const steps = Math.floor(dt / clip.interval);
      const previousFrame = state.frame;
      if (G.isPlayerOneShotAction()) {
        const nextFrame = state.frame + steps;
        if (nextFrame >= clip.frames.length && state.battle.player?.hp > 0) {
          const previousAction = state.action;
          state.action = G.nextPlayerActionAfterOneShot();
          state.frame = 0;
          state.playerOneShot = false;
          state.lastTick = now;
          if (state.game.mode === "mining" && previousAction === "mine" && state.action === "stance") {
            state.battle.returnToStandAt = now + COMBAT_STANCE_HOLD_MS;
            G.rollMiningOreOnSwing();
          }
          G.updateActionButtons();
          return;
        }
        if (nextFrame >= clip.frames.length) {
          state.frame = clip.frames.length - 1;
        } else {
          state.frame = nextFrame;
        }
      } else {
        const frameStep = G.isPlayerSmoothLoopAction() ? 1 : steps;
        state.frame = (state.frame + frameStep) % clip.frames.length;
      }
      G.maybePlayPlayerFootstep(previousFrame, state.frame);
      G.maybePlayMiningSwingSfx(previousFrame, state.frame);
      state.lastTick = G.isPlayerSmoothLoopAction() ? now : state.lastTick + steps * clip.interval;
    }
    return;
  }

  const bodyDuration = clip.frames.length * clip.interval;
  const cycleDuration = bodyDuration + state.castCooldownMs;
  const t = (now - state.spellStartedAt) % Math.max(1, cycleDuration);
  state.frame = t < bodyDuration ? Math.min(clip.frames.length - 1, Math.floor(t / clip.interval)) : 0;
}

function resourcePercentage(value, max) {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}

function stampSheetColumns(stamp) {
  const columns = Math.trunc(Number(stamp?.sheetColumns) || 0);
  if (columns > 0) return columns;
  const assetCount = Array.isArray(stamp?.assets) ? stamp.assets.length : 0;
  return Math.max(1, assetCount);
}

function stampSheetSlotOrigin(stamp, slot) {
  const columns = stampSheetColumns(stamp);
  const slotWidth = Math.max(1, Math.trunc(Number(stamp.slotWidth) || 1));
  const slotHeight = Math.max(1, Math.trunc(Number(stamp.slotHeight) || 1));
  const index = Math.max(0, Math.trunc(Number(slot) || 0));
  return {
    sx: (index % columns) * slotWidth,
    sy: Math.floor(index / columns) * slotHeight,
  };
}

function stampForegroundLayersByRow(stamp = G.currentZoneMapStamp(), spawnRow = G.arenaSpawnMapRow()) {
  const byRow = new Map();
  if (!stamp?.layers?.length || !spawnRow) return byRow;
  for (const layer of stamp.layers) {
    if (!G.mapStampLayerDrawsOverEnemy(layer, spawnRow)) continue;
    const row = Math.trunc(Number(layer.mapRow) || 0);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(layer);
  }
  return byRow;
}

function shouldUseStampArenaEntityLayers() {
  return Boolean(G.currentZoneMapStamp() && G.arenaSpawnMapRow() > 0);
}

function withScreenBlend(ctx, draw) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  draw();
  ctx.restore();
}

function statBlock(name, stats) {
  const level = Math.max(1, Math.trunc(Number(stats.level) || state.battle.level || G.playerCombatLevel()));
  const effective = G.effectivePlayerAttackSpeed();
  const speedLine = stats.attackSpeed != null
    ? `<dt>AS</dt><dd>${stats.attackSpeed}${effective !== stats.attackSpeed ? ` (+${effective - stats.attackSpeed})` : ""} · ${G.playerAttackDelayMs()}ms</dd>`
    : `<dt>ATK</dt><dd>${stats.attackMs}ms</dd>`;
  const magicLine = stats.mc ? `<dt>MC</dt><dd>${formatStatRange(stats.mc)}</dd>` : "";
  const spiritLine = stats.sc ? `<dt>SC</dt><dd>${formatStatRange(stats.sc)}</dd>` : "";
  return `
    <section class="stat-block">
      <strong>${name}</strong>
      ${G.bar("HP", stats.hp, stats.maxHp)}
      ${G.bar("MP", stats.mp, stats.maxMp)}
      <dl>
        <dt>DC</dt><dd>${formatStatRange(stats.dc)}</dd>
        ${magicLine}
        ${spiritLine}
        <dt>AC</dt><dd>${formatStatRange(stats.ac)}</dd>
        <dt>AMC</dt><dd>${formatStatRange(stats.amc)}</dd>
        <dt>Acc</dt><dd>${stats.accuracy ?? 0}</dd>
        <dt>Agi</dt><dd>${stats.agility ?? 0}</dd>
        <dt>Luck</dt><dd>${stats.luck ?? 0}</dd>
        ${speedLine}
      </dl>
    </section>
  `;
}


G.refreshOfflineProgressUi = refreshOfflineProgressUi;
G.xpGainedSinceOfflineSnapshot = xpGainedSinceOfflineSnapshot;
G.simulateOfflineMining = simulateOfflineMining;
G.simulateOfflineTrainingRoomProgress = simulateOfflineTrainingRoomProgress;
G.simulateOfflineProgress = simulateOfflineProgress;
G.rebaseOfflineTransientTimers = rebaseOfflineTransientTimers;
G.rebaseTransientTimestamp = rebaseTransientTimestamp;
G.simulateOfflineFight = simulateOfflineFight;
G.setPrototypeStatsEnabled = setPrototypeStatsEnabled;
G.submitPrototypeStats = submitPrototypeStats;
G.reportEntriesText = reportEntriesText;
G.reportCountText = reportCountText;
G.startOneStepTest = startOneStepTest;
G.stopOneStepTest = stopOneStepTest;
G.tryTrainingRoomAutocastCycle = tryTrainingRoomAutocastCycle;
G.updateTrainingRoomBattle = updateTrainingRoomBattle;
G.stageWeaponRefineEntry = stageWeaponRefineEntry;
G.unstageWeaponRefineEntry = unstageWeaponRefineEntry;
G.resetWeaponRefineState = resetWeaponRefineState;
G.usedWeaponRefineEntryOnOtherBoardSlot = usedWeaponRefineEntryOnOtherBoardSlot;
G.refineEligibleInventoryEntries = refineEligibleInventoryEntries;
G.selectWeaponRefineSlot = selectWeaponRefineSlot;
G.refineOffensiveStatSum = refineOffensiveStatSum;
G.rollWeaponRefineSuccess = rollWeaponRefineSuccess;
G.rollWeaponRefineCrit = rollWeaponRefineCrit;
G.sellAllJunkOre = sellAllJunkOre;
G.resolveSmithCombinePair = resolveSmithCombinePair;
G.resolveSmithCombineStat = resolveSmithCombineStat;
G.validGemForEquipItem = validGemForEquipItem;
G.sceneMagicSignature = sceneMagicSignature;
G.queuedCombatSpell = queuedCombatSpell;
G.rebirthExperienceRate = rebirthExperienceRate;
G.rebirthStatUpgradeEffectLabel = rebirthStatUpgradeEffectLabel;
G.rebirthStatUpgradeBonus = rebirthStatUpgradeBonus;
G.toggleSkillAutoCast = toggleSkillAutoCast;
G.toggleCombatSpellControl = toggleCombatSpellControl;
G.updateWarriorChargeExpiry = updateWarriorChargeExpiry;
G.tryWarriorChargeSkill = tryWarriorChargeSkill;
G.queueCombatSkillCast = queueCombatSkillCast;
G.sameStackableItem = sameStackableItem;
G.stackEntriesCombinable = stackEntriesCombinable;
G.rejectInventoryMove = rejectInventoryMove;
G.storeInventoryEntryInStorage = storeInventoryEntryInStorage;
G.withdrawStorageEntryToInventorySlot = withdrawStorageEntryToInventorySlot;
G.syncBattleCamera = syncBattleCamera;
G.weaponEntryLuck = weaponEntryLuck;
G.rollBenedictionOilOutcome = rollBenedictionOilOutcome;
G.useInventoryEntry = useInventoryEntry;
G.useBenedictionOilEntry = useBenedictionOilEntry;
G.useFirstPotionOfKind = useFirstPotionOfKind;
G.usePotionEntry = usePotionEntry;
G.useBuffPotionEntry = useBuffPotionEntry;
G.updateStatBuffs = updateStatBuffs;
G.refreshCharacterStatsOverlay = refreshCharacterStatsOverlay;
G.updateAutoPotions = updateAutoPotions;
G.shouldAutoUsePotion = shouldAutoUsePotion;
G.resourceRatio = resourceRatio;
G.useHotbarSlot = useHotbarSlot;
G.queuePotionRestore = queuePotionRestore;
G.updatePotionRegen = updatePotionRegen;
G.queueHealingRestore = queueHealingRestore;
G.updatePendingHeal = updatePendingHeal;
G.updatePendingPoison = updatePendingPoison;
G.updateEnemyPoisons = updateEnemyPoisons;
G.updateHealingRegen = updateHealingRegen;
G.updateTaoistPetHealingRegen = updateTaoistPetHealingRegen;
G.targetEquipmentSlot = targetEquipmentSlot;
G.updateEnemyActionButtons = updateEnemyActionButtons;
G.testLevelUpCharacter = testLevelUpCharacter;
G.recentLootHtml = recentLootHtml;
G.sceneButtonsHtml = sceneButtonsHtml;
G.setSceneUrl = setSceneUrl;
G.sceneWindowHtml = sceneWindowHtml;
G.sceneClassName = sceneClassName;
G.sceneTitle = sceneTitle;
G.sceneBodyHtml = sceneBodyHtml;
G.selectedBossAssistIds = selectedBossAssistIds;
G.toggleBossAssistSelection = toggleBossAssistSelection;
G.toggleBossEmpowerSelection = toggleBossEmpowerSelection;
G.upgradesSceneHtml = upgradesSceneHtml;
G.statListHtml = statListHtml;
G.updateInventoryCarryPointer = updateInventoryCarryPointer;
G.setInventoryDropTarget = setInventoryDropTarget;
G.slotLabel = slotLabel;
G.selectPlayerClass = selectPlayerClass;
G.requestZoneEntry = requestZoneEntry;
G.returnToTown = returnToTown;
G.resetGroupDungeonRun = resetGroupDungeonRun;
G.startGroupDungeonWave = startGroupDungeonWave;
G.reconcileGroupDungeonSwarmDeaths = reconcileGroupDungeonSwarmDeaths;
G.reconcileGroupDungeonWaveKillCount = reconcileGroupDungeonWaveKillCount;
G.spawnGroupDungeonWaveBurst = spawnGroupDungeonWaveBurst;
G.snapBossPartyMembersToSwarmGrid = snapBossPartyMembersToSwarmGrid;
G.spawnGroupDungeonSwarmEnemy = spawnGroupDungeonSwarmEnemy;
G.syncBattleEnemyHpToSwarm = syncBattleEnemyHpToSwarm;
G.queueSwarmEnemyStruck = queueSwarmEnemyStruck;
G.tryConsumeSwarmEnemyPendingStruck = tryConsumeSwarmEnemyPendingStruck;
G.strikeGroupDungeonSwarmEnemy = strikeGroupDungeonSwarmEnemy;
G.syncGroupDungeonPrimaryEnemy = syncGroupDungeonPrimaryEnemy;
G.setSwarmEnemyLocomotion = setSwarmEnemyLocomotion;
G.setSwarmEnemyAction = setSwarmEnemyAction;
G.resetSwarmEnemyWalkState = resetSwarmEnemyWalkState;
G.setBossRespawn = setBossRespawn;
G.traderNpcSceneHtml = traderNpcSceneHtml;
G.sellableInventoryEntries = sellableInventoryEntries;
G.traderSellRowHtml = traderSellRowHtml;
G.shopBuyRowHtml = shopBuyRowHtml;
G.refineJewelleryStatHint = refineJewelleryStatHint;
G.shopItemMetaText = shopItemMetaText;
G.trainerNpcSceneHtml = trainerNpcSceneHtml;
G.randomZoneEnemyTemplate = randomZoneEnemyTemplate;
G.updateSpellMappingText = updateSpellMappingText;
G.reloadSpell = reloadSpell;
G.setHoveredTownNpc = setHoveredTownNpc;
G.showItemTooltip = showItemTooltip;
G.reloadAtlases = reloadAtlases;
G.scheduleEquipmentRedraw = scheduleEquipmentRedraw;
G.queueVisualAtlasReload = queueVisualAtlasReload;
G.reloadEnemyAtlas = reloadEnemyAtlas;
G.tick = tick;
G.runSimulationStep = runSimulationStep;
G.updatePerfClock = updatePerfClock;
G.updateContinuousWalkTest = updateContinuousWalkTest;
G.updateOneStepTest = updateOneStepTest;
G.queueBossPartyMeleeAdvance = queueBossPartyMeleeAdvance;
G.refreshBossPartyMeleePositions = refreshBossPartyMeleePositions;
G.resolvedTaoPetWorldX = resolvedTaoPetWorldX;
G.shiftFixedArenaPartyForPet = shiftFixedArenaPartyForPet;
G.resolveBossPartyMember = resolveBossPartyMember;
G.refreshBossPartyMemberMagicSettings = refreshBossPartyMemberMagicSettings;
G.queueDefenceBuffImpactFx = queueDefenceBuffImpactFx;
G.queueUltimateEnhancerImpactFx = queueUltimateEnhancerImpactFx;
G.queueDefenceBuffImpactTargets = queueDefenceBuffImpactTargets;
G.updateDefenceBuffFx = updateDefenceBuffFx;
G.rollPoisonResist = rollPoisonResist;
G.rollPoisonProc = rollPoisonProc;
G.updateEntityPoisons = updateEntityPoisons;
G.resolveBoneLordBossPartyMelee = resolveBoneLordBossPartyMelee;
G.resolveBoneLordSoloMelee = resolveBoneLordSoloMelee;
G.resolveMinotaurKingSoloAoeStrike = resolveMinotaurKingSoloAoeStrike;
G.resolveBoneLordRangedStrike = resolveBoneLordRangedStrike;
G.resolveEvilCentipedeStrikeTarget = resolveEvilCentipedeStrikeTarget;
G.updatePendingEnemyStrike = updatePendingEnemyStrike;
G.rollBossTableDrops = rollBossTableDrops;
G.rollBossPartyDrops = rollBossPartyDrops;
G.rollBossSoloDrops = rollBossSoloDrops;
G.splitPartyRewardAmount = splitPartyRewardAmount;
G.rollBossPartyZoneDrops = rollBossPartyZoneDrops;
G.updateLaneMotion = updateLaneMotion;
G.travelAction = travelAction;
G.setWarriorSpellCastReadyAt = setWarriorSpellCastReadyAt;
G.scaleEnemyPhysicalDamage = scaleEnemyPhysicalDamage;
G.tryApplyTwinDrakeStun = tryApplyTwinDrakeStun;
G.queueAttachedSpellFx = queueAttachedSpellFx;
G.queueWarriorChargeFx = queueWarriorChargeFx;
G.queueTwinDrakeSwingFx = queueTwinDrakeSwingFx;
G.startMagicShieldLoopFx = startMagicShieldLoopFx;
G.updateAttachedSpellFx = updateAttachedSpellFx;
G.queueTwinDrakeSecondHit = queueTwinDrakeSecondHit;
G.updatePendingTwinDrakeHits = updatePendingTwinDrakeHits;
G.usableWarriorAttackSkill = usableWarriorAttackSkill;
G.queuedWarriorAttackSkill = queuedWarriorAttackSkill;
G.usableWizardAttackSpell = usableWizardAttackSpell;
G.queuedWizardAttackSpell = queuedWizardAttackSpell;
G.rollSlayingChargeAfterAttack = rollSlayingChargeAfterAttack;
G.setWarriorSlayingReady = setWarriorSlayingReady;
G.rollWarriorMagicDamage = rollWarriorMagicDamage;
G.rollWizardMagicDamage = rollWizardMagicDamage;
G.rollWizardMagicValue = rollWizardMagicValue;
G.rollTaoistHealingAmount = rollTaoistHealingAmount;
G.rollTaoistMagicDamage = rollTaoistMagicDamage;
G.rollTaoistMagicValue = rollTaoistMagicValue;
G.scaleStatRange = scaleStatRange;
G.rollFrostCrunchSlow = rollFrostCrunchSlow;
G.rollFrostCrunchFrozen = rollFrostCrunchFrozen;
G.rollTaoistPoisonPower = rollTaoistPoisonPower;
G.rollMagicHit = rollMagicHit;
G.rollMagicShieldReductionPercent = rollMagicShieldReductionPercent;
G.rollDefenceBuffBonus = rollDefenceBuffBonus;
G.rollTaoistDefenceBuffBonus = rollTaoistDefenceBuffBonus;
G.rollWizardDefenceBuffDurationMs = rollWizardDefenceBuffDurationMs;
G.rollTaoistDefenceBuffDurationMs = rollTaoistDefenceBuffDurationMs;
G.showTaoistDefenceBuffTexts = showTaoistDefenceBuffTexts;
G.rollUltimateEnhancerBonus = rollUltimateEnhancerBonus;
G.setEntityStatBuffList = setEntityStatBuffList;
G.showUltimateEnhancerBuffTexts = showUltimateEnhancerBuffTexts;
G.updatePendingUltimateEnhancer = updatePendingUltimateEnhancer;
G.usableTaoistUltimateEnhancer = usableTaoistUltimateEnhancer;
G.updatePendingDefenceBuff = updatePendingDefenceBuff;
G.usableWizardDefenceBuff = usableWizardDefenceBuff;
G.usableQueuedWizardDefenceBuff = usableQueuedWizardDefenceBuff;
G.usableTaoistDefenceBuff = usableTaoistDefenceBuff;
G.usableTaoistHealing = usableTaoistHealing;
G.usableTaoistPoisoning = usableTaoistPoisoning;
G.usableTaoistSoulFireBall = usableTaoistSoulFireBall;
G.usableTaoistSummonSpell = usableTaoistSummonSpell;
G.usableTaoistSummonSkeleton = usableTaoistSummonSkeleton;
G.usableTaoistSummonShinsu = usableTaoistSummonShinsu;
G.usableQueuedTaoistSpell = usableQueuedTaoistSpell;
G.updatePendingTaoPet = updatePendingTaoPet;
G.taoShinsuPetMonsterIndex = taoShinsuPetMonsterIndex;
G.revealTaoistShinsuPet = revealTaoistShinsuPet;
G.rollTaoistPetAttackResult = rollTaoistPetAttackResult;
G.updatePendingPetAttack = updatePendingPetAttack;
G.retireTaoistPetAfterFight = retireTaoistPetAfterFight;
G.updateTaoistPetAttack = updateTaoistPetAttack;
G.setTaoPetAction = setTaoPetAction;
G.updatePendingImpact = updatePendingImpact;
G.rollMapLightningDamage = rollMapLightningDamage;
G.randomMapLightningIntervalMs = randomMapLightningIntervalMs;
G.resolveMapLightningDamage = resolveMapLightningDamage;
G.spawnMapLightningWave = spawnMapLightningWave;
G.updateMapLightning = updateMapLightning;
G.updateGroundSpellEffects = updateGroundSpellEffects;
G.rollHit = rollHit;
G.resolvePhysicalAttack = resolvePhysicalAttack;
G.resolveIncomingEnemyRangedAttack = resolveIncomingEnemyRangedAttack;
G.resolveIncomingEnemyAttack = resolveIncomingEnemyAttack;
G.xpForNextLevel = xpForNextLevel;
G.xpProgressText = xpProgressText;
G.triggerLevelUpFx = triggerLevelUpFx;
G.rollRedThunderZumaDrops = rollRedThunderZumaDrops;
G.rollZoneDrops = rollZoneDrops;
G.updateDropPity = updateDropPity;
G.weightedDropCandidate = weightedDropCandidate;
G.spawnNextEnemy = spawnNextEnemy;
G.setPlayerAction = setPlayerAction;
G.setPlayerLocomotion = setPlayerLocomotion;
G.updateStageSize = updateStageSize;
G.weaponShapeForItem = weaponShapeForItem;
G.weaponSfxFamilyFallback = weaponSfxFamilyFallback;
G.weaponSwingSfxFamilyForItem = weaponSwingSfxFamilyForItem;
G.weaponHitSfxFamilyForItem = weaponHitSfxFamilyForItem;
G.weaponSfxFamilyForItem = weaponSfxFamilyForItem;
G.resolveMonsterSfxIndex = resolveMonsterSfxIndex;
G.updateEnemyFrame = updateEnemyFrame;
G.updateTaoPetFrame = updateTaoPetFrame;
G.updateFrame = updateFrame;
G.resourcePercentage = resourcePercentage;
G.stampSheetColumns = stampSheetColumns;
G.stampSheetSlotOrigin = stampSheetSlotOrigin;
G.stampForegroundLayersByRow = stampForegroundLayersByRow;
G.shouldUseStampArenaEntityLayers = shouldUseStampArenaEntityLayers;
G.withScreenBlend = withScreenBlend;
G.statBlock = statBlock;
