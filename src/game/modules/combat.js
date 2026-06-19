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

import { battlePanelSignature, sceneSignature, combatSkillBarSignature, playerHudSignature } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els, IS_GAME_UI } from "../runtime.js";

function resetBattleForCurrentMode(loadedSave = false) {
  const zone = G.activeZone();
  if (state.game.mode === "mining" && zone) {
    G.ensureMiningSpotId(false);
    state.showEnemies = true;
    resetBattle();
    ensureMapStampArenaLock();
    state.battle.cameraX = state.battle.playerX - G.playerScreenX();
    state.battle.enemy = null;
    state.battle.running = false;
    state.battle.phase = "idle";
    G.restorePendingSavedPlayerResources();
    const spot = G.activeMiningSpot();
    state.battle.log = [loadedSave ? `Save loaded at ${spot?.label ?? zone.label}.` : `Mining at ${spot?.label ?? zone.label}.`];
    G.applyEquippedVisualIndexes();
    G.queueVisualAtlasReload(["weapon"]);
    G.setPlayerAction("mine", performance.now(), true);
    return;
  }
  if (state.game.mode === "zone" && zone) {
    state.showEnemies = true;
    resetBattle(G.randomZoneEnemyTemplate(zone).id);
    G.restorePendingSavedPlayerResources();
    state.battle.log = [loadedSave ? `Save loaded in ${zone.label}.` : `Teleported to ${zone.label}.`];
    if ((state.battle.player?.hp ?? 0) <= 0) {
      G.finishBattle(performance.now());
      G.setPlayerAction("die", performance.now());
      return;
    }
    startBattle();
    return;
  }

  state.game.mode = "town";
  state.game.activeZoneId = null;
  state.showEnemies = false;
  resetBattle();
  G.restorePendingSavedPlayerResources();
  if (loadedSave) state.battle.log = ["Save loaded."];
}

function taoistPetSupportAttackOffline(now) {
  const healing = G.usableTaoistHealing(now);
  if (healing) return castTaoistHealing(healing, now, { offline: true });

  for (const spellId of ["SoulShield", "BlessedArmour"]) {
    const defenceBuff = G.usableTaoistDefenceBuff(spellId, now);
    if (defenceBuff) return castTaoistDefenceBuff(defenceBuff, now, { offline: true });
  }

  const ultimateEnhancer = G.usableTaoistUltimateEnhancer(now);
  if (ultimateEnhancer) return castTaoistUltimateEnhancer(ultimateEnhancer, now, { offline: true });

  const poisoning = G.usableTaoistPoisoning(now);
  if (poisoning) return castTaoistPoisoning(poisoning, now, { offline: true });

  const soulFireBall = G.usableTaoistSoulFireBall(now);
  if (soulFireBall) return G.offlineTaoistSoulFireBall(state.battle.enemy, now, soulFireBall);

  return false;
}

function setEnemyAction(action, oneShot = false, now = performance.now()) {
  state.enemy.action = action;
  state.enemy.frame = 0;
  state.enemy.oneShot = oneShot;
  state.enemy.lastTick = now;
  G.updateEnemyActionButtons();
  G.render();
}

function clearTransientCombatBuffs() {
  state.battle.statBuffs = [];
  state.battle.petStatBuffs = [];
  state.battle.defenceBuffFx = [];
  state.battle.attachedSpellFx = (state.battle.attachedSpellFx ?? []).filter(
    (entry) => entry.spellId !== "MagicShield",
  );
  state.battle.pendingDefenceBuff = null;
  state.battle.pendingUltimateEnhancer = null;
  G.applyEquippedStatsToBattlePlayer();
  playerHudSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
}

function resetBattle(enemyId = state.battle.enemyId) {
  G.stopOneStepTest();
  state.continuousWalk = false;
  const now = performance.now();
  const template = ENEMY_TEMPLATES.find((enemy) => enemy.id === Number(enemyId)) ?? ENEMY_TEMPLATES[0];
  const playerStats = G.characterTotalStats();
  const combatClass = state.battle.combatClass ?? state.activeCharacterId ?? PLAYER_TEMPLATE.class;
  state.battle.enemyId = template.id;
  state.battle.player = {
    ...PLAYER_TEMPLATE,
    ...playerStats,
    name: combatClass,
    class: combatClass,
    hp: playerStats.maxHp,
    mp: playerStats.maxMp,
    poisons: [],
  };
  state.battle.enemy = {
    ...template,
    hp: template.maxHp,
    mp: template.maxMp,
    poisons: [],
  };
  state.battle.running = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.returnToStandAt = 0;
  state.battle.lastMotionAt = now;
  state.battle.phase = "idle";
  state.battle.playerX = 0;
  state.battle.enemyX = enemySpawnDistance();
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  state.battle.travelStartedAt = now;
  state.battle.travelStartedX = state.battle.playerX;
  state.battle.enemyAggro = false;
  state.battle.enemyRevealed = true;
  state.battle.nextEnemySpawnAt = 0;
  state.battle.activeSkill = "None";
  state.battle.activeSkillAtlas = null;
  state.battle.activeSkillStartedAt = 0;
  state.battle.activeWizardSpell = null;
  state.battle.activeWizardSpellAtlas = null;
  state.battle.activeWizardSpellStartedAt = 0;
  state.battle.activeTaoSpell = null;
  state.battle.activeTaoSpellAtlas = null;
  state.battle.activeTaoSpellStartedAt = 0;
  state.battle.queuedCombatSpellId = null;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  state.battle.wizardSpellLockUntil = 0;
  G.dismissTaoistPet();
  state.battle.bossParty = null;
  state.battle.swarm = null;
  state.battle.lockedArenaWorldX = null;
  state.battle.lockedCameraX = null;
  state.battle.groundSpellEffects = [];
  state.battle.mapLightningEffects = [];
  state.battle.nextMapLightningAt = 0;
  clearTransientCombatBuffs();
  state.battle.furyUntil = 0;
  state.battle.furyBonus = 0;
  state.battle.slayingReady = false;
  state.battle.slayingReadyAt = 0;
  state.battle.flamingSwordReady = false;
  state.battle.flamingSwordReadyAt = 0;
  state.battle.flamingSwordExpiresAt = 0;
  state.battle.twinDrakeReady = false;
  state.battle.twinDrakeReadyAt = 0;
  state.battle.twinDrakeChargeFxStartedAt = 0;
  state.battle.twinDrakeChargeFxUntil = 0;
  state.battle.pendingTwinDrakeHits = [];
  state.battle.attachedSpellFx = [];
  state.battle.potHealthAmount = 0;
  state.battle.potManaAmount = 0;
  state.battle.potTickAt = 0;
  state.battle.healAmount = 0;
  state.battle.healTickAt = 0;
  state.battle.autoPotionReadyAt = { hp: 0, mp: 0 };
  state.battle.level = state.game.progress.level;
  state.battle.experience = state.game.progress.experience;
  state.battle.gold = state.game.progress.gold;
  state.battle.log = [`A ${template.name} steps forward.`];
  state.action = "standing";
  state.frame = 0;
  state.lastTick = now;
  state.enemy.index = template.monsterIndex;
  state.enemy.action = "standing";
  state.enemy.frame = 0;
  state.enemy.lastTick = now;
  state.enemy.oneShot = false;
  state.playerOneShot = false;
}

function resetBattleForRoomOnly(zone = G.activeZone()) {
  G.stopOneStepTest();
  state.continuousWalk = false;
  const now = performance.now();
  const playerStats = G.characterTotalStats();
  const combatClass = state.battle.combatClass ?? state.activeCharacterId ?? PLAYER_TEMPLATE.class;
  state.battle.enemyId = 0;
  state.battle.player = {
    ...PLAYER_TEMPLATE,
    ...playerStats,
    name: combatClass,
    class: combatClass,
    hp: playerStats.maxHp,
    mp: playerStats.maxMp,
    poisons: [],
  };
  state.battle.enemy = null;
  state.battle.running = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.returnToStandAt = 0;
  state.battle.lastMotionAt = now;
  state.battle.phase = "idle";
  state.battle.playerX = 0;
  state.battle.enemyX = 0;
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  state.battle.travelStartedAt = now;
  state.battle.travelStartedX = state.battle.playerX;
  state.battle.enemyAggro = false;
  state.battle.enemyRevealed = false;
  state.battle.nextEnemySpawnAt = 0;
  state.battle.activeSkill = "None";
  state.battle.activeSkillAtlas = null;
  state.battle.activeSkillStartedAt = 0;
  state.battle.activeWizardSpell = null;
  state.battle.activeWizardSpellAtlas = null;
  state.battle.activeWizardSpellStartedAt = 0;
  state.battle.activeTaoSpell = null;
  state.battle.activeTaoSpellAtlas = null;
  state.battle.activeTaoSpellStartedAt = 0;
  state.battle.queuedCombatSpellId = null;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  state.battle.wizardSpellLockUntil = 0;
  G.dismissTaoistPet();
  state.battle.bossParty = null;
  state.battle.swarm = null;
  state.battle.lockedArenaWorldX = null;
  state.battle.lockedCameraX = null;
  state.battle.groundSpellEffects = [];
  state.battle.mapLightningEffects = [];
  state.battle.nextMapLightningAt = 0;
  clearTransientCombatBuffs();
  state.battle.furyUntil = 0;
  state.battle.furyBonus = 0;
  state.battle.slayingReady = false;
  state.battle.slayingReadyAt = 0;
  state.battle.flamingSwordReady = false;
  state.battle.flamingSwordReadyAt = 0;
  state.battle.flamingSwordExpiresAt = 0;
  state.battle.twinDrakeReady = false;
  state.battle.twinDrakeReadyAt = 0;
  state.battle.twinDrakeChargeFxStartedAt = 0;
  state.battle.twinDrakeChargeFxUntil = 0;
  state.battle.pendingTwinDrakeHits = [];
  state.battle.attachedSpellFx = [];
  state.battle.potHealthAmount = 0;
  state.battle.potManaAmount = 0;
  state.battle.potTickAt = 0;
  state.battle.healAmount = 0;
  state.battle.healTickAt = 0;
  state.battle.autoPotionReadyAt = { hp: 0, mp: 0 };
  state.battle.level = state.game.progress.level;
  state.battle.experience = state.game.progress.experience;
  state.battle.gold = state.game.progress.gold;
  state.battle.log = [`Entered ${zone?.label ?? "the room"}.`];
  state.action = "standing";
  state.frame = 0;
  state.lastTick = now;
  state.enemy.index = 0;
  state.enemy.action = "standing";
  state.enemy.frame = 0;
  state.enemy.lastTick = now;
  state.enemy.oneShot = false;
  state.playerOneShot = false;
  ensureMapStampArenaLock();
}

async function selectBattleEnemy(enemyId) {
  resetBattle(enemyId);
  state.enemy.index = state.battle.enemy.monsterIndex;
  state.enemy.action = "standing";
  state.enemy.frame = 0;
  state.enemy.oneShot = false;
  await G.reloadEnemyAtlas();
  G.renderEnemyControls();
  G.render();
}

function startBattle() {
  if (isRoomOnlyZone()) {
    if (!state.battle.player) resetBattleForRoomOnly();
    state.battle.running = false;
    state.battle.phase = "idle";
    ensureMapStampArenaLock();
    return;
  }
  if (!state.battle.player || !state.battle.enemy) resetBattle();
  const zone = G.activeZone();
  const bossDef = G.bossRoomDef(zone?.id);
  if (bossDef && G.bossRespawnRemainingMs(zone.id) > 0) {
    state.battle.running = false;
    state.battle.phase = "victory";
    state.battle.nextEnemySpawnAt = 0;
    pushBattleLog(`${bossDef.bossName} is still respawning.`);
    return;
  }
  G.stopOneStepTest();
  state.continuousWalk = false;
  state.battle.running = true;
  const now = performance.now();
  state.battle.phase = "advance";
  state.battle.lastMotionAt = now;
  state.battle.travelStartedAt = now;
  state.battle.travelStartedX = state.battle.playerX;
  state.battle.returnToStandAt = 0;
  state.battle.enemyAggro = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  G.dismissTaoistPet();
  if ((bossDef || G.groupDungeonZone(zone)) && G.beginBossPartyFight(zone.id, now)) return;
  if (G.applyFixedArenaEnemySpawn(now)) {
    G.initMapLightningSchedule(now);
    pushBattleLog(`${state.battle.enemy?.name ?? "The boss"} waits beneath the floor...`);
    return;
  }
  G.initMapLightningSchedule(now);
  pushBattleLog("Adventure started.");
  G.setPlayerAction("walking", now);
}

function stopBattle() {
  if (state.battle.bossParty?.finished) return;
  if (state.battle.bossParty?.active) {
    G.syncBossPartyControlledMemberFromState(G.bossPartyLeaderClassId());
    G.syncBossPartyMembersToCharacters(state.battle.bossParty, { applyControlled: false });
    G.persistCharacterGameLocation({
      mode: state.game.mode,
      zoneId: state.game.activeZoneId,
      classIds: G.bossPartyMemberClassIds(),
      running: false,
    });
  } else {
    G.captureActiveCharacterState();
  }
  state.continuousWalk = false;
  state.battle.running = false;
  state.battle.phase = "idle";
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  G.dismissTaoistPet();
  state.battle.bossParty = null;
  G.clearGroupDungeonRunState();
  state.battle.groundSpellEffects = [];
  pushBattleLog("Adventure paused.");
}

function startContinuousMovement(action) {
  if (!state.battle.player || !state.battle.enemy) resetBattle();
  const now = performance.now();
  const startX = state.battle.playerX;
  const startCameraX = state.battle.cameraX ?? startX - G.playerScreenX();
  const startTileCameraX = startCameraX * LANE.tileScrollRatio;
  G.stopOneStepTest();
  state.continuousWalk = true;
  state.continuousMoveAction = action;
  state.continuousWalkStartedAt = now;
  state.continuousWalkStartX = startX;
  state.continuousWalkStartCameraX = startCameraX;
  state.continuousWalkStartScrollX = G.movementTestScrollCameraX(startTileCameraX);
  state.showEnemies = false;
  state.battle.running = true;
  state.battle.phase = "advance";
  state.battle.playerX = startX;
  state.battle.cameraX = startCameraX;
  state.battle.lastMotionAt = now;
  state.battle.travelStartedAt = now;
  state.battle.travelStartedX = startX;
  state.battle.enemyAggro = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  G.dismissTaoistPet();
  G.setPlayerAction(action, now);
  const cycleDistance = G.movementCycleDistance(action);
  pushBattleLog(`Deterministic ${PLAYER_ACTIONS[action].label.toLowerCase()} test started: one cycle equals ${cycleDistance}px.`);
  G.renderMapControls();
  battlePanelSignature = "";
  G.render();
}

function stopContinuousWalk() {
  if (!state.continuousWalk) return;
  state.continuousWalk = false;
  state.battle.running = false;
  state.battle.phase = "idle";
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  G.dismissTaoistPet();
  state.battle.groundSpellEffects = [];
  G.setPlayerAction("standing", performance.now());
  pushBattleLog(`Deterministic ${PLAYER_ACTIONS[state.continuousMoveAction].label.toLowerCase()} test stopped.`);
  G.renderMapControls();
  battlePanelSignature = "";
  G.render();
}

function pushBattleLog(text) {
  state.battle.log.unshift(text);
  state.battle.log = state.battle.log.slice(0, 12);
}

function pushRecentLoot(text) {
  state.game.recentLoot.unshift(String(text));
  state.game.recentLoot = state.game.recentLoot.slice(0, 6);
}

function combatPlayableZones() {
  return PROTOTYPE_ZONES.filter((zone) => !zone.miningOnly && !zone.trainingRoom && !zone.roomOnly);
}

function isRoomOnlyZone(zone = G.activeZone()) {
  return Boolean(zone?.roomOnly);
}

function isTrainingRoomZone(zone = G.activeZone()) {
  return Boolean(zone?.trainingRoom);
}

function isTrainingDummyEnemy(enemy = state.battle?.enemy) {
  return Boolean(enemy?.trainingDummy);
}

function reduceEnemyHp(enemy, damage) {
  if (!enemy || damage <= 0) return;
  if (isTrainingDummyEnemy(enemy)) return;
  enemy.hp = Math.max(0, enemy.hp - damage);
}

function isTrainingRoomCombat() {
  const battle = state.battle;
  return isTrainingRoomZone()
    && battle.running
    && !battle.bossParty?.active
    && Boolean(battle.enemy);
}

function wizardSpellById(spellId) {
  return CRYSTAL_WIZARD_SPELLS.find((spell) => spell.id === spellId) ?? null;
}

function spellDropZoneText(spell) {
  const books = G.bookItemsForSpell(spell.id);
  const labels = [
    ...new Set(
      books.flatMap((item) => {
        const sources = [];
        if (Array.isArray(item.drop?.zones)) sources.push(...item.drop.zones.map(zoneLabel));
        const bossLabel = SKILL_BOOK_BOSS_DROP_BY_ITEM_ID[item.id];
        if (bossLabel) sources.push(bossLabel);
        return sources;
      }),
    ),
  ];
  return labels.length ? `Drops: ${labels.join(", ")}` : "Drops: not added yet";
}

function combatAutoCastClassForSpell(spellId) {
  if (G.isWizardCombatSpellId(spellId)) return "Wizard";
  if (G.isTaoistCombatSpellId(spellId)) return "Taoist";
  if (G.isWarriorCombatSkillId(spellId)) return "Warrior";
  return null;
}

function combatSkillForClass(classId, spellId) {
  if (classId === "Wizard") return WIZARD_COMBAT_SPELLS.find((spell) => spell.id === spellId) ?? null;
  if (classId === "Taoist") return TAOIST_COMBAT_SPELLS.find((spell) => spell.id === spellId) ?? null;
  if (classId === "Warrior") {
    return WARRIOR_COMBAT_SKILLS.find((skill) => skill.id === spellId && skill.id !== BASIC_ATTACK_SKILL.id) ?? null;
  }
  return null;
}

function combatAutoCastSpells(classId = state.battle.combatClass) {
  if (classId === "Wizard") return WIZARD_COMBAT_SPELLS;
  if (classId === "Taoist") return TAOIST_COMBAT_SPELLS;
  if (classId === "Warrior") {
    return WARRIOR_COMBAT_SKILLS.filter((skill) => skill.id !== BASIC_ATTACK_SKILL.id && !skill.passive);
  }
  return [];
}

function warriorFlamingSwordReady() {
  if (state.battle.bossParty?.active) {
    return Boolean(G.bossPartyControlledMember()?.flamingSwordReady);
  }
  return Boolean(state.battle.flamingSwordReady);
}

function warriorMemberChargeReady(member, spellId) {
  if (!member) return false;
  if (spellId === "FlamingSword") return Boolean(member.flamingSwordReady);
  if (spellId === "TwinDrakeBlade") return Boolean(member.twinDrakeReady);
  return false;
}

function warriorChargeReady(spellId) {
  if (spellId === "FlamingSword") return warriorFlamingSwordReady();
  if (spellId === "TwinDrakeBlade") return warriorTwinDrakeReady();
  return false;
}

function enemyUsesFixedArenaSpawn(enemy = state.battle.enemy) {
  return Boolean(enemy?.fixedArenaSpawn || enemy?.spawnAction);
}

function enemyBossIsStationary(enemy = state.battle.enemy) {
  return enemy?.attackMode === "evilCentipede" || Boolean(enemy?.stationaryBoss);
}

function combatMaxHitChancePercent(totalLuck) {
  const luck = Math.max(-CRYSTAL_MAX_LUCK, Math.min(CRYSTAL_MAX_LUCK, Math.trunc(Number(totalLuck) || 0)));
  if (luck <= 0) return 0;
  if (luck >= CRYSTAL_MAX_LUCK) return 100;
  return luck * 10;
}

function taoistSummonAmuletCost(spellId) {
  return Math.max(1, Math.trunc(Number(TAOIST_SUMMON_AMULET_COST_BY_SPELL[spellId]) || 1));
}

function autoUsePotionForKind(kind, now) {
  if (!G.shouldAutoUsePotion(kind, now)) return false;
  const candidate = G.autoPotionCandidates(kind)[0];
  if (!candidate) return false;
  const used = G.usePotionEntry(candidate.entry.id, kind, { auto: true, now });
  if (!used) return false;
  state.battle.autoPotionReadyAt[kind] = now + AUTO_POTION_COOLDOWN_MS;
  return true;
}

function defenceBuffFxList() {
  if (!Array.isArray(state.battle.defenceBuffFx)) state.battle.defenceBuffFx = [];
  return state.battle.defenceBuffFx;
}

function defenceBuffImpactAtlas(spellId) {
  if (spellId === "UltimateEnhancer") {
    return state.taoistSpellAtlases?.UltimateEnhancer ?? null;
  }
  return state.taoistDefenceBuffImpactAtlases?.[spellId] ?? null;
}

function defenceBuffFxAtlasDurationMs(atlas) {
  if (!atlas?.layers?.length) return 1200;
  return Math.max(0, ...atlas.layers.map((layer) => (layer.delayMs ?? 0) + layer.frames.length * layer.interval));
}

function ultimateEnhancerImpactFxOptions(entity) {
  if (!entity) return { anchor: "player" };
  if (entity === state.battle.bossParty?.pet || entity === state.battle.taoPet) {
    return { anchor: "pet", petFx: true };
  }
  if (entity.classId && state.battle.bossParty?.active) {
    return { memberClassId: entity.classId };
  }
  return { anchor: "player" };
}

function enemyHasRangedMeleeAttack(enemy = state.battle.enemy) {
  return G.isBoneLordEnemy(enemy) || G.isPrajnaGuardEnemy(enemy) || G.isMinotaurKingEnemy(enemy);
}

function enemyAttackDamageStat(enemy = state.battle.enemy, options = {}) {
  if (options.aoe && G.isMinotaurKingEnemy(enemy) && statRange(enemy?.mc)[1] > 0) {
    return enemy.mc;
  }
  if (G.isIncarnatedRedThunderZumaEnemy?.(enemy)) {
    if (options.ranged && enemy.rangedDc) return enemy.rangedDc;
    if (enemy.meleeDc) return enemy.meleeDc;
  }
  return enemy.dc;
}

function combatantPoison(entity, kind) {
  const poisons = Array.isArray(entity?.poisons) ? entity.poisons : [];
  return poisons.find((poison) => poison.kind === kind && (Number(poison.ticksRemaining) || 0) > 0) ?? null;
}

function combatantParalyzed(entity) {
  return Boolean(combatantPoison(entity, "paralysis"));
}

function updateCombatantPoisons(now, options = {}) {
  let changed = false;
  if (G.bossPartyActiveFight()) {
    const party = state.battle.bossParty;
    for (const member of party?.members ?? []) {
      if (G.updateEntityPoisons(member, "member", now, options)) changed = true;
    }
    if (party?.pet?.active && G.updateEntityPoisons(party.pet, "pet", now, options)) changed = true;
    return changed;
  }
  const battle = state.battle;
  if (battle.player && G.updateEntityPoisons(battle.player, "player", now, options)) changed = true;
  if (battle.taoPet?.active && G.updateEntityPoisons(battle.taoPet, "pet", now, options)) changed = true;
  return changed;
}

function enemyRangedStrikeVfxUntil(startedAt, moveDurationMs, projectile) {
  if (!projectile || projectile.style !== "targetBurst") return startedAt + moveDurationMs;
  const burstDelayMs = Number(projectile.burstDelayMs);
  const burstDurationMs = Math.max(1, Number(projectile.burstDurationMs) || 300);
  if (Number.isFinite(burstDelayMs)) return startedAt + burstDelayMs + burstDurationMs;
  return startedAt + moveDurationMs;
}

function updateBattle(now) {
  const battle = state.battle;
  if (battle.bossParty?.finished) {
    G.updateBossPartyAftermath(now);
    return;
  }
  if (!battle.running || !battle.player) return;
  if (battle.bossParty?.active) {
    G.updateBossPartyBattle(now);
    return;
  }
  if (!battle.enemy) return;
  if (battle.player.hp <= 0) return;

  if (isTrainingRoomCombat()) {
    G.updateTrainingRoomBattle(now);
    return;
  }

  G.updatePendingEnemyStrike(now);
  G.updatePendingImpact(now);
  G.updatePendingPetAttack(now);
  G.updatePendingPoison(now);
  G.updatePendingDefenceBuff(now);
  G.updatePendingUltimateEnhancer(now);
  G.updateDefenceBuffFx(now);
  G.updatePendingTwinDrakeHits(now);
  G.updateAttachedSpellFx(now);
  G.updatePendingTaoPet(now);
  G.updateLaneMotion(now);
  G.updateGroundSpellEffects(now);
  G.updateMapLightning(now);
  updateCombatantPoisons(now);
  G.updateEnemyPoisons(now);
  if (battle.enemy.hp <= 0 || battle.phase !== "engaged") return;

  G.updateWarriorChargeExpiry(now);
  if (G.maybeCastWizardDefenceBuff(now)) return;
  if (G.maybeCastTaoistDefenceBuffs(now)) return;
  if (G.maybeCastTaoistUltimateEnhancer(now)) return;
  if (G.maybeCastTaoistSummonSkeleton(now)) return;

  if (battle.combatClass === "Taoist" && taoistPetCanTank() && now >= battle.nextPlayerAttackAt) {
    const acted = taoistPetSupportAttack(now);
    battle.nextPlayerAttackAt = now + (acted
      ? G.consumeLastPlayerAttackCooldown(now)
      : TAOIST_COMBAT_POLL_MS);
  } else if (G.canPlayerAttack() && !combatantParalyzed(battle.player) && now >= battle.nextPlayerAttackAt) {
    if (G.playerAttack(now)) {
      battle.nextPlayerAttackAt = now + G.consumeLastPlayerAttackCooldown(now);
    }
  }

  if (battle.enemy.hp <= 0 || battle.phase !== "engaged") return;
  if (G.maybeAutoWarriorCharge(now)) return;
  G.maybeCastTaoistSoulFireBall(now);
  G.updateTaoistPetAttack(now);
  if (battle.enemy.hp <= 0 || battle.phase !== "engaged") return;

  if (G.canEnemyAttack() && now >= battle.nextEnemyAttackAt && enemyAttack(now)) {
    battle.nextEnemyAttackAt = now + G.effectiveEnemyAttackMs(battle.enemy, now);
  }
}

function twinDrakeAutoCastActive(learned) {
  return Boolean(learned?.autoCast);
}

function warriorSpellCastOnCooldown(skill, learned, now) {
  if (skill?.id === "TwinDrakeBlade" && twinDrakeAutoCastActive(learned)) return false;
  return (learned?.castReadyAt ?? 0) > now;
}

function warriorTwinDrakeReady() {
  if (state.battle.bossParty?.active) {
    return Boolean(G.bossPartyControlledMember()?.twinDrakeReady);
  }
  return Boolean(state.battle.twinDrakeReady);
}

function enemyStunned(enemy, now = performance.now()) {
  return Number(enemy?.stunnedUntil) > now;
}

function warriorSkillFxLayers(spellId, phase = "attack") {
  const atlas = state.warriorSkillAtlases[spellId];
  if (!atlas?.layers?.length) return [];
  if (spellId === "TwinDrakeBlade") {
    if (phase === "charge") return atlas.layers.slice(0, 1);
    if (phase === "swing") return atlas.layers.slice(1);
  }
  return atlas.layers;
}

function warriorChargeFxDurationMs(spellId) {
  if (spellId === "TwinDrakeBlade") {
    const layer = warriorSkillFxLayers(spellId, "charge")[0];
    if (layer?.frames?.length) return layer.frames.length * layer.interval;
    return CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS;
  }
  return CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS;
}

function twinDrakeChargeFxDurationMs() {
  const chargeLayer = warriorSkillFxLayers("TwinDrakeBlade", "charge")[0];
  if (chargeLayer?.frames?.length) {
    return chargeLayer.frames.length * Math.max(1, Number(chargeLayer.interval) || 83);
  }
  return CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS;
}

function spellFxLayerFrameIndex(layer, startedAt, now = performance.now()) {
  const interval = Math.max(1, Number(layer.interval) || 83);
  const frameCount = Math.max(1, layer.frames?.length ?? 1);
  const layerT = now - startedAt - (layer.delayMs ?? 0);
  const duration = frameCount * interval;
  if (layerT < 0 || layerT >= duration) return -1;
  return Math.min(frameCount - 1, Math.floor(layerT / interval));
}

function twinDrakeChargeFxEntries(now = performance.now()) {
  const entries = [];
  const battle = state.battle;

  const pushEntry = (anchor, startedAt) => {
    entries.push({ anchor, startedAt: Number(startedAt) || 0 });
  };

  if (!battle.bossParty?.active) {
    if (now < Number(battle.twinDrakeChargeFxUntil)) {
      pushEntry(combatAnchor("player"), battle.twinDrakeChargeFxStartedAt);
    }
  }

  for (const member of battle.bossParty?.members ?? []) {
    if (now < Number(member.twinDrakeChargeFxUntil)) {
      pushEntry(G.attachedSpellFxAnchor({ memberClassId: member.classId }), member.twinDrakeChargeFxStartedAt);
    }
  }

  return entries;
}

function magicShieldFxEntity(memberClassId) {
  const party = state.battle.bossParty;
  if (party?.active) {
    const classId = memberClassId ?? (state.battle.combatClass === "Wizard" ? G.bossPartyControlledClassId() : null);
    if (classId) {
      return party.members?.find((member) => member.classId === classId) ?? null;
    }
    return null;
  }
  if (state.battle.combatClass === "Wizard") return state.battle.player;
  return null;
}

function magicShieldFxActive(memberClassId, now = performance.now()) {
  const entity = magicShieldFxEntity(memberClassId);
  if (!entity) return false;
  return G.hasActiveDefenceBuffOnList(G.entityStatBuffList(entity), "magicShield", now);
}

function magicShieldStruckMemberClassId(target) {
  if (!target || target.classId !== "Wizard") return undefined;
  if (state.battle.bossParty?.active) {
    return target.classId === G.bossPartyControlledClassId() ? null : "Wizard";
  }
  return null;
}

function spellFxLoopFrameIndex(layer, startedAt, now = performance.now()) {
  const interval = Math.max(1, Number(layer.interval) || 200);
  const frameCount = Math.max(1, layer.frames?.length ?? 1);
  const layerT = now - startedAt - (layer.delayMs ?? 0);
  if (layerT < 0) return -1;
  return Math.floor(layerT / interval) % frameCount;
}

function magicShieldLoopStartedAt(entry, now = performance.now()) {
  const struckAt = Number(entry.struckAt) || 0;
  if (struckAt > 0 && now >= struckAt + CRYSTAL_MAGIC_SHIELD_STRUCK_MS) {
    return struckAt + CRYSTAL_MAGIC_SHIELD_STRUCK_MS;
  }
  return entry.loopStartedAt ?? entry.startedAt;
}

function twinDrakeLearnedForMember(classId) {
  if (state.battle.bossParty?.active) {
    const member = state.battle.bossParty.members?.find((entry) => entry.classId === classId);
    return member ? G.bossPartyLearned(member, "TwinDrakeBlade") : null;
  }
  return G.learnedMagic("TwinDrakeBlade");
}

function twinDrakeAttackerForMember(classId) {
  if (state.battle.bossParty?.active) {
    return state.battle.bossParty.members?.find((entry) => entry.classId === classId) ?? null;
  }
  return state.battle.player;
}

function castWarriorCharge(skill, learned, cost, now) {
  if (warriorSlayingPending()) return;
  const battle = state.battle;
  battle.player.mp = Math.max(0, battle.player.mp - cost);
  G.setWarriorSpellCastReadyAt(skill, learned, now);
  G.clearQueuedCombatSpell(skill.id);
  if (battle.bossParty?.active) {
    const member = G.bossPartyControlledMember();
    const memberLearned = member?.magic?.learned?.[skill.id];
    if (memberLearned) {
      memberLearned.castReadyAt = learned.castReadyAt;
      if (skill.id === "TwinDrakeBlade" && twinDrakeAutoCastActive(memberLearned)) {
        memberLearned.castReadyAt = 0;
      }
    }
  }
  if (skill.id === "TwinDrakeBlade") {
    G.applyTwinDrakeChargeState(battle, now);
    if (battle.bossParty?.active) G.applyTwinDrakeChargeState(G.bossPartyControlledMember(), now);
  } else if (skill.id === "FlamingSword") {
    G.applyFlamingSwordChargeState(battle, now);
    if (battle.bossParty?.active) G.applyFlamingSwordChargeState(G.bossPartyControlledMember(), now);
  }
  sceneSignature = "";
  battle.pendingImpact = null;
  battle.pendingEnemyStrike = null;
  pushBattleLog(`${skill.label} readied for the next attack.`);
  battlePanelSignature = "";
  combatSkillBarSignature = "";
}

function warriorApplyPhysicalHit(skill, learned, damage, now) {
  const battle = state.battle;
  const enemy = battle.enemy;
  const scaled = G.scaleEnemyPhysicalDamage(damage, enemy, now);
  if (scaled <= 0) {
    G.addCombatText("enemy", "Miss", "miss", now);
    pushBattleLog(`${skill.id === "None" ? "Warrior" : skill.label} misses ${enemy.name}.`);
    G.rollSlayingChargeAfterAttack(now);
    return false;
  }
  reduceEnemyHp(enemy, scaled);
  setEnemyAction("struck", true, now);
  G.playMonsterSfx("flinch");
  if (skill.id === "TwinDrakeBlade" || skill.id === "FlamingSword" || skill.id === "None") G.playWeaponHitSfx();
  else if (!G.playSpellSfx(skill.id, "impact", { volume: 0.48 })) G.playWeaponHitSfx();
  G.addCombatText("enemy", scaled, "damage", now);
  pushBattleLog(`${skill.id === "None" ? "Warrior" : skill.label} hits ${enemy.name} for ${scaled}.`);
  if (learned) G.levelWarriorMagic(skill, learned, now);
  G.levelPassiveWeaponMagic(now);
  G.rollSlayingChargeAfterAttack(now);
  if (enemy.hp <= 0) {
    G.finishEnemy(now);
    setEnemyAction("die", false, now);
    G.playMonsterSfx("death");
    pushBattleLog(`${enemy.name} is defeated.`);
  }
  return true;
}

function warriorAttack(now) {
  const battle = state.battle;
  const { skill, learned, cost, charged } = G.usableWarriorAttackSkill(now);

  if (skill.buff) {
    battle.activeSkill = skill.id;
    battle.activeSkillAtlas = state.warriorSkillAtlases[skill.id] ?? null;
    battle.activeSkillStartedAt = now;
    G.setPlayerAction(skill.bodyAction ?? "spell", now, true);
    castWarriorBuff(skill, learned, cost, now);
    battle.lastPlayerAttackCooldownMs = CRYSTAL_PLAYER_ACTION_LOCK_MS;
    return true;
  }

  battle.activeSkill = skill.id;
  battle.activeSkillAtlas = state.warriorSkillAtlases[skill.id] ?? null;
  battle.activeSkillStartedAt = now;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = null;
  battle.activeTaoSpellAtlas = null;
  battle.pendingImpact = null;
  battle.pendingEnemyStrike = null;
  G.setPlayerAction(skill.bodyAction, now, true);
  if (skill.id === "None") G.playWeaponSwingSfx();
  else G.playWarriorSpellSwingSfx(skill, { volume: 0.5 });

  if (learned) G.commitWarriorSpellUse(skill, learned, cost, now);
  battle.lastPlayerAttackCooldownMs = G.playerWeaponAttackCooldownMs(now, skill);
  if (!G.rollHit(battle.player.accuracy, battle.enemy.agility)) {
    G.addCombatText("enemy", "Miss", "miss", now);
    pushBattleLog(`${skill.id === "None" ? "Warrior" : skill.label} misses ${battle.enemy.name}.`);
    G.rollSlayingChargeAfterAttack(now);
    return true;
  }
  const damage = learned
    ? (G.isHalfMoonAttackSkill(skill)
      ? rollDamage(battle.player.dc, enemyPhysicalDefence(battle.enemy), battle.player.luck)
      : G.rollWarriorMagicDamage(skill, learned, battle.player, battle.enemy))
    : rollDamage(battle.player.dc, enemyPhysicalDefence(battle.enemy), battle.player.luck);
  if (!warriorApplyPhysicalHit(skill, learned, damage, now)) return true;
  if (skill.id === "TwinDrakeBlade" && charged && battle.enemy?.hp > 0) {
    G.queueTwinDrakeSecondHit({ classId: battle.combatClass }, learned, damage, now);
  }
  return true;
}

function thrustingEnabled() {
  return G.autoWarriorCombatSkills().some((skill) => skill.id === "Thrusting");
}

function wizardFireWallRequiresMeleeRange() {
  return !G.bossPartyActiveFight();
}

function wizardHoldsCombatPosition() {
  return state.battle.combatClass === "Wizard"
    && !G.bossPartyActiveFight()
    && state.battle.phase === "engaged";
}

function wizardFireWallMeleeReady() {
  return enemyDistance() <= LANE.enemyRange;
}

function wizardAttackSpellReady(spell, now) {
  if (spell?.id !== "FireWall") return true;
  return G.canUseWizardFireWall(now);
}

function warriorAutoPriority(skill) {
  const order = ["Fury", "FlamingSword", "TwinDrakeBlade", "Thrusting", "HalfMoon"];
  const index = order.indexOf(skill?.id);
  return index === -1 ? order.length : index;
}

function wizardAutoPriority(spell) {
  const order = ["MagicShield", "FireWall", "GreatFireBall", "FrostCrunch", "FireBall", "ThunderBolt"];
  const index = order.indexOf(spell?.id);
  return index === -1 ? order.length : index;
}

function taoistAutoPriority(spell) {
  const order = ["Healing", "SoulShield", "BlessedArmour", "UltimateEnhancer", "SummonSkeleton", "SummonShinsu", "Poisoning", "SoulFireBall"];
  const index = order.indexOf(spell?.id);
  return index === -1 ? order.length : index;
}

function wizardCastCooldownMs(spell, learned) {
  return crystalSpellCastCooldownMs(spell, learned);
}

function wizardCastLocked(now, member = null) {
  if (member) {
    if ((member.wizardSpellLockUntil ?? 0) > now) return true;
    if ((member.nextActionAt ?? 0) > now) return true;
  } else if ((state.battle.wizardSpellLockUntil ?? 0) > now) {
    return true;
  }
  const battle = state.battle;
  const pending = battle.pendingImpact;
  if (pending && G.isWizardCombatSpellId(pending.spellId) && now < pending.at) return true;
  if (!member && battle.activeWizardSpell && battle.activeWizardSpellStartedAt) {
    const atlas = battle.activeWizardSpellAtlas ?? state.wizardSpellAtlases[battle.activeWizardSpell];
    const elapsed = now - battle.activeWizardSpellStartedAt;
    if (elapsed >= 0 && elapsed < combatSpellVisualDurationMs(atlas)) return true;
  }
  return false;
}

function warriorSlayingPending(member = null) {
  if (member?.classId) return Boolean(member.slayingReady);
  if (Boolean(state.battle.slayingReady)) return true;
  const controlled = state.battle.bossParty?.active ? G.bossPartyControlledMember() : null;
  return Boolean(controlled?.classId === "Warrior" && controlled.slayingReady);
}

function enemyPhysicalDefence(enemy) {
  return enemyDefenceStat(enemy, "ac");
}

function enemyMagicalDefence(enemy) {
  return enemyDefenceStat(enemy, "amc");
}

function enemyDefenceStat(enemy, statKey) {
  const stat = enemy?.[statKey] ?? [0, 0];
  return enemyHasPoison(enemy, "yellow") ? G.scaleStatRange(stat, 0.5) : stat;
}

function enemyPoison(enemy, kind) {
  const poisons = Array.isArray(enemy?.poisons) ? enemy.poisons : [];
  return poisons.find((poison) => poison.kind === kind && (Number(poison.ticksRemaining) || 0) > 0) ?? null;
}

function enemyHasPoison(enemy, kind) {
  return Boolean(enemyPoison(enemy, kind));
}

function enemySlowActive(enemy, now = performance.now()) {
  return (G.ensureEnemyDebuffs(enemy).slowUntil ?? 0) > now;
}

function enemyFrozenActive(enemy, now = performance.now()) {
  return (G.ensureEnemyDebuffs(enemy).frozenUntil ?? 0) > now;
}

function enemyAdvanceSpeed(enemy, baseSpeed, now = performance.now()) {
  if (enemyFrozenActive(enemy, now)) return 0;
  if (enemySlowActive(enemy, now)) return baseSpeed * 0.5;
  return baseSpeed;
}

function castWarriorBuff(skill, learned, cost, now) {
  G.commitWarriorSpellUse(skill, learned, cost, now);
  if (skill.id === "Fury") {
    state.battle.furyUntil = now + 60000 + (Number(learned?.level) || 0) * 10000;
    state.battle.furyBonus = 4;
    G.levelWarriorMagic(skill, learned, now);
    pushBattleLog(`Fury increases attack speed for ${Math.round((state.battle.furyUntil - now) / 1000)}s.`);
    battlePanelSignature = "";
    return;
  }
  pushBattleLog(`${skill.label} is not wired into combat yet.`);
}

function levelMagicSkill(spell, learned, now = performance.now()) {
  if (!spell || !learned || learned.level >= 3) return false;
  const requiredLevel = spellLevelRequirement(spell, learned.level);
  if (state.game.progress.level < requiredLevel) return false;
  const need = spellExperienceTarget(spell, learned.level);
  if (!need) return false;
  learned.experience += randomInt(1, 3);
  if (learned.experience >= need) {
    learned.level += 1;
    learned.experience = 0;
    pushBattleLog(`${spell.label} reached level ${learned.level}.`);
    G.addLootNotice(`${spell.label} Lv ${learned.level}`, "level");
    if (spell.id === "Fencing" || spell.id === "SpiritSword") G.applyEquippedStatsToBattlePlayer();
  }
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  return true;
}

function wizardAttack(now) {
  const battle = state.battle;
  const queuedDefence = G.usableQueuedWizardDefenceBuff(now);
  if (queuedDefence && castWizardDefenceBuff(queuedDefence, now)) return;
  const attackSpell = G.usableWizardAttackSpell(now);
  if (!attackSpell) {
    wizardWeaponAttack(now);
    return;
  }
  const { spell, learned, cost, cooldownWaiting } = attackSpell;
  const atlas = state.wizardSpellAtlases[spell.id] ?? null;
  if (cooldownWaiting) {
    wizardWeaponAttack(now);
    return;
  }
  if ((battle.player?.mp ?? 0) < cost) {
    wizardWeaponAttack(now, spell);
    return;
  }

  battle.lastPlayerAttackCooldownMs = wizardCastCooldownMs(spell, learned);
  G.commitWizardSpellUse(spell, learned, cost, now);
  const groundSpell = spell.impactMode === "ground";
  const hit = groundSpell || G.rollMagicHit(battle.enemy);
  const damageValue = groundSpell ? G.rollWizardMagicValue(spell, learned, battle.player) : 0;
  const damage = !groundSpell && hit ? G.rollWizardMagicDamage(spell, learned, battle.player, battle.enemy) : 0;
  const impactAt = now + wizardImpactDelay(spell, atlas);

  battle.activeSkill = "None";
  battle.activeSkillAtlas = null;
  battle.activeWizardSpell = spell.id;
  battle.activeWizardSpellAtlas = atlas;
  battle.activeWizardSpellStartedAt = now;
  battle.activeTaoSpell = null;
  battle.activeTaoSpellAtlas = null;
  battle.pendingImpact = groundSpell
    ? { at: impactAt, spellId: spell.id, value: damageValue, worldX: battle.enemyX }
    : { at: impactAt, spellId: spell.id, damage, hit: hit && damage > 0 };

  G.setPlayerAction("spell", now, true);
  if (spell.impactMode !== "target") G.playSpellSfx(spell.id, "cast");
  if (spell.impactMode === "projectile") G.playSpellSfx(spell.id, "fly", { volume: 0.38, throttleMs: 120 });
  pushBattleLog(`Wizard casts ${spell.label}.`);
}

function wizardWeaponAttack(now, failedSpell = null) {
  const battle = state.battle;
  const weaponEntry = G.equippedEntry("weapon");
  const weapon = weaponEntry ? G.itemDefinition(weaponEntry.itemId) : null;
  const weaponName = weapon ? G.itemDisplayName(weapon, weaponEntry) : "weapon";

  battle.lastPlayerAttackCooldownMs = G.playerWeaponAttackCooldownMs(now, BASIC_ATTACK_SKILL);
  battle.activeSkill = BASIC_ATTACK_SKILL.id;
  battle.activeSkillAtlas = null;
  battle.activeSkillStartedAt = now;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = null;
  battle.activeTaoSpellAtlas = null;
  battle.pendingImpact = null;
  battle.pendingEnemyStrike = null;

  G.setPlayerAction(BASIC_ATTACK_SKILL.bodyAction, now, true);
  G.playWeaponSwingSfx();
  if (failedSpell && (!battle.lastNoMpLogAt || now - battle.lastNoMpLogAt > 5000)) {
    battle.lastNoMpLogAt = now;
    pushBattleLog(`Not enough MP to cast ${failedSpell.label}; Wizard uses ${weaponName}.`);
    G.addCombatText("player", "No MP", "mana", now);
  }

  if (!G.rollHit(battle.player.accuracy, battle.enemy.agility)) {
    G.addCombatText("enemy", "Miss", "miss", now);
    pushBattleLog(`Wizard swings ${weaponName} at ${battle.enemy.name} but misses.`);
    return;
  }

  const damage = rollDamage(battle.player.dc, enemyPhysicalDefence(battle.enemy), battle.player.luck);
  if (damage <= 0) {
    G.addCombatText("enemy", "Miss", "miss", now);
    pushBattleLog(`Wizard swings ${weaponName} at ${battle.enemy.name} but misses.`);
    return;
  }
  reduceEnemyHp(battle.enemy, damage);
  setEnemyAction("struck", true, now);
  G.playMonsterSfx("flinch");
  G.playWeaponHitSfx();
  G.addCombatText("enemy", damage, "damage", now);
  pushBattleLog(`Wizard hits ${battle.enemy.name} with ${weaponName} for ${damage}.`);

  if (battle.enemy.hp <= 0) {
    G.finishEnemy(now);
    setEnemyAction("die", false, now);
    G.playMonsterSfx("death");
    pushBattleLog(`${battle.enemy.name} is defeated.`);
  }
}

function taoistDefenceBuffKind(spellId) {
  return defenceBuffKind(spellId);
}

function taoistDefenceBuffStat(spellId) {
  return defenceBuffStat(spellId);
}

function defenceBuffKind(spellId) {
  if (spellId === "SoulShield") return "soulShield";
  if (spellId === "BlessedArmour") return "blessedArmour";
  if (spellId === "MagicShield") return "magicShield";
  return null;
}

function defenceBuffStat(spellId) {
  if (spellId === "SoulShield") return "amc";
  if (spellId === "BlessedArmour") return "ac";
  return null;
}

function combatDefenceBuffSpell(spellId) {
  if (spellId === "MagicShield") return wizardCombatSpell(spellId);
  return taoistCombatSpell(spellId);
}

function taoistPartyDefenceBuffTargets(now = performance.now()) {
  return ultimateEnhancerTargets(now);
}

function combatantForMagicRoll(entity) {
  if (!entity) return entity;
  const effective = G.effectiveCombatStats(entity);
  return { ...entity, dc: effective.dc, mc: effective.mc, sc: effective.sc, luck: effective.luck };
}

function ultimateEnhancerStatForTarget(entity) {
  const classId = entity === state.battle.taoPet || entity === state.battle.bossParty?.pet
    ? "pet"
    : (entity?.classId ?? state.battle.combatClass);
  if (classId === "Wizard") return "mc";
  if (classId === "Taoist") return "sc";
  return "dc";
}

function ultimateEnhancerTargetEntry(entity) {
  if (!entity || (entity.hp ?? 0) <= 0) return null;
  if (entity === state.battle.bossParty?.pet || entity === state.battle.taoPet) {
    return { entity, anchor: "pet", name: entity.name ?? "pet" };
  }
  if (entity.classId) {
    return { entity, anchor: entity.classId, name: entity.name ?? entity.classId };
  }
  return { entity, anchor: "player", name: state.battle.combatClass };
}

function ultimateEnhancerTargets(now = performance.now()) {
  const targets = [];
  if (state.battle.bossParty?.active) {
    const party = state.battle.bossParty;
    for (const classId of BOSS_PARTY_ORDER) {
      const member = party.members?.find((entry) => entry.classId === classId && entry.alive && entry.hp > 0);
      const entry = member ? ultimateEnhancerTargetEntry(member) : null;
      if (entry) targets.push(entry);
    }
    if (party.pet?.active && party.pet.hp > 0) {
      const entry = ultimateEnhancerTargetEntry(party.pet);
      if (entry) targets.push(entry);
    }
    return targets;
  }
  const player = state.battle.player;
  if (player && player.hp > 0) {
    const entry = ultimateEnhancerTargetEntry(player);
    if (entry) targets.push(entry);
  }
  const pet = state.battle.taoPet;
  if (pet?.active && pet.hp > 0) {
    const entry = ultimateEnhancerTargetEntry(pet);
    if (entry) targets.push(entry);
  }
  return targets;
}

function ultimateEnhancerNeedsCast(now = performance.now()) {
  const targets = ultimateEnhancerTargets(now);
  if (!targets.length) return false;
  return targets.some((entry) => G.needsUltimateEnhancerTarget(entry.entity, now));
}

function castTaoistUltimateEnhancer(castBundle, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, entry, item, targets } = castBundle;
  if (battle.pendingUltimateEnhancer) return false;
  if (!G.consumeOneInventoryUnit(entry.id)) return false;
  battle.lastPlayerAttackCooldownMs = spellDelayMs(spell, learned);
  G.commitTaoistSpellUse(spell, learned, cost, now);

  if (options.offline) {
    const liveTargets = ultimateEnhancerTargets(now);
    G.applyUltimateEnhancerToTargets(spell, learned, battle.player, liveTargets, now);
    return true;
  }

  battle.pendingUltimateEnhancer = {
    at: now + (Number(spell.impactDelayMs) || CRYSTAL_HEAL_APPLY_DELAY_MS),
    spellId: spell.id,
  };

  const atlas = state.taoistSpellAtlases[spell.id] ?? null;
  battle.activeSkill = "None";
  battle.activeSkillAtlas = null;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = spell.id;
  battle.activeTaoSpellAtlas = atlas;
  battle.activeTaoSpellStartedAt = now;
  battle.pendingPoison = null;
  G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
  G.playSpellSfx(spell.id, "cast");
  pushBattleLog(`Taoist casts ${spell.label} on the party with ${item.name}.`);
  return true;
}

function castWizardDefenceBuff(castBundle, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost } = castBundle;
  if (battle.pendingDefenceBuff && battle.pendingDefenceBuff.spellId !== spell.id) return false;
  battle.lastPlayerAttackCooldownMs = wizardCastCooldownMs(spell, learned);
  G.commitWizardSpellUse(spell, learned, cost, now);

  if (options.offline) {
    G.applyDefenceBuffEffect(spell, learned, battle.player, now);
    return true;
  }

  battle.pendingDefenceBuff = {
    at: now + (Number(spell.impactDelayMs) || CRYSTAL_HEAL_APPLY_DELAY_MS),
    spellId: spell.id,
  };

  const atlas = state.wizardSpellAtlases[spell.id] ?? null;
  battle.activeSkill = "None";
  battle.activeSkillAtlas = null;
  battle.activeWizardSpell = spell.id;
  battle.activeWizardSpellAtlas = atlas;
  battle.activeWizardSpellStartedAt = now;
  battle.activeTaoSpell = null;
  battle.activeTaoSpellAtlas = null;
  battle.pendingImpact = null;
  G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
  G.playSpellSfx(spell.id, "cast");
  pushBattleLog(`Wizard casts ${spell.label}.`);
  return true;
}

function castTaoistDefenceBuff(castBundle, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, entry, item } = castBundle;
  if (battle.pendingDefenceBuff && battle.pendingDefenceBuff.spellId !== spell.id) return false;
  if (!G.consumeOneInventoryUnit(entry.id)) return false;
  battle.lastPlayerAttackCooldownMs = spellDelayMs(spell, learned);
  G.commitTaoistSpellUse(spell, learned, cost, now);

  if (options.offline) {
    G.applyTaoistDefenceBuffEffect(spell, learned, battle.player, now);
    return true;
  }

  battle.pendingDefenceBuff = {
    at: now + (Number(spell.impactDelayMs) || CRYSTAL_HEAL_APPLY_DELAY_MS),
    spellId: spell.id,
  };

  const atlas = state.taoistSpellAtlases[spell.id] ?? null;
  battle.activeSkill = "None";
  battle.activeSkillAtlas = null;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = spell.id;
  battle.activeTaoSpellAtlas = atlas;
  battle.activeTaoSpellStartedAt = now;
  battle.pendingPoison = null;
  G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
  G.playSpellSfx(spell.id, "cast");
  pushBattleLog(`Taoist casts ${spell.label} with ${item.name}.`);
  return true;
}

function castQueuedTaoistSpell(queued, now) {
  if (!queued?.spell) return false;
  if (queued.spell.id === "Healing") return castTaoistHealing(queued, now);
  if (queued.spell.id === "Poisoning") return castTaoistPoisoning(queued, now);
  if (queued.spell.id === "SoulFireBall") return castTaoistSoulFireBall(queued, now);
  if (queued.spell.id === "SummonSkeleton" || queued.spell.id === "SummonShinsu") return castTaoistSummonPet(queued, now);
  if (queued.spell.id === "SoulShield" || queued.spell.id === "BlessedArmour") return castTaoistDefenceBuff(queued, now);
  if (queued.spell.id === "UltimateEnhancer") return castTaoistUltimateEnhancer(queued, now);
  return false;
}

function castTaoistSummonPet(summon, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, item, amuletCost = taoistSummonAmuletCost(spell.id) } = summon;
  if (battle.taoPet?.active || battle.pendingTaoPet) return false;
  if (!G.consumeAmuletInventoryUnits(amuletCost)) return false;
  G.commitTaoistSpellUse(spell, learned, cost, now);
  levelMagicSkill(spell, learned, now);

  const delayMs = spell.id === "SummonShinsu"
    ? CRYSTAL_SUMMON_SHINSU_DELAY_MS
    : CRYSTAL_SUMMON_SKELETON_DELAY_MS;
  battle.pendingTaoPet = {
    at: now + delayMs,
    spellId: spell.id,
    spellLevel: Math.max(0, Math.trunc(Number(learned?.level) || 0)),
  };

  if (!options.offline) {
    const atlas = state.taoistSpellAtlases[spell.id] ?? null;
    battle.activeSkill = "None";
    battle.activeSkillAtlas = null;
    battle.activeWizardSpell = null;
    battle.activeWizardSpellAtlas = null;
    battle.activeTaoSpell = spell.id;
    battle.activeTaoSpellAtlas = atlas;
    battle.activeTaoSpellStartedAt = now;
    G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
    G.playSpellSfx(spell.id, "cast");
    const amuletText = amuletCost > 1 ? `${amuletCost} ${item.name}s` : item.name;
    pushBattleLog(`Taoist casts ${spell.label} with ${amuletText}.`);
  }
  return true;
}

function castTaoistSummonSkeleton(summon, now, options = {}) {
  return castTaoistSummonPet(summon, now, options);
}

function taoistPetRenderMonsterIndex(pet) {
  if (pet?.spellId === "SummonShinsu") return G.taoShinsuPetMonsterIndex(pet);
  return Math.trunc(Number(pet?.monsterIndex) || CRYSTAL_SUMMON_SKELETON_PET_INDEX);
}

function taoistPetAttackRangePx(pet) {
  if (pet?.spellId === "SummonShinsu") return CRYSTAL_SUMMON_SHINSU_ATTACK_RANGE_PX;
  return LANE.enemyRange + 4;
}

function taoistShinsuAttackImpactMs() {
  const atlas = state.taoPetAtlases?.[CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX];
  const interval = Math.max(1, Math.trunc(Number(atlas?.actions?.attack1?.interval) || 100));
  return CRYSTAL_SHINSU_ATTACK_IMPACT_FRAME * interval;
}

function taoPetAtlasFor(pet) {
  const index = taoistPetRenderMonsterIndex(pet);
  return state.taoPetAtlases?.[index] ?? state.taoPetAtlas;
}

function taoistPetSummonWorldX() {
  const battle = state.battle;
  const playerX = Number(battle.playerX) || 0;
  const enemyX = Math.max(playerX + TAOIST_PET_SUMMON_MIN_GAP + 1, Number(battle.enemyX) || playerX);
  const desired = enemyX - TAOIST_PET_ENEMY_GAP;
  return G.clampNumber(desired, playerX + TAOIST_PET_SUMMON_MIN_GAP, enemyX - 12);
}

function taoistPetCanTank() {
  const pet = state.battle.taoPet;
  return state.battle.combatClass === "Taoist"
    && Boolean(pet?.active)
    && (pet.hp ?? 0) > 0;
}

function taoistPetCanBeHealed() {
  const pet = state.battle.taoPet;
  return state.battle.combatClass === "Taoist" && Boolean(pet?.active) && (pet.hp ?? 0) > 0 && (pet.hp ?? 0) < (pet.maxHp ?? 0);
}

function taoistPetEnemyDistance() {
  const pet = state.battle.taoPet;
  if (!pet) return Infinity;
  return Math.max(0, (Number(state.battle.enemyX) || 0) - G.resolvedTaoPetWorldX(pet));
}

function taoistPetSupportAttack(now) {
  const queuedRequest = G.queuedCombatSpell("Taoist");
  const queued = G.usableQueuedTaoistSpell(now);
  if (queued && castQueuedTaoistSpell(queued, now)) return true;
  if (queuedRequest) {
    if (!G.isPlayerOneShotAction()) G.setPlayerLocomotion("stance", now);
    return false;
  }

  const healing = G.usableTaoistHealing(now);
  if (healing) return castTaoistHealing(healing, now);

  for (const spellId of ["SoulShield", "BlessedArmour"]) {
    const defenceBuff = G.usableTaoistDefenceBuff(spellId, now);
    if (defenceBuff) return castTaoistDefenceBuff(defenceBuff, now);
  }

  const ultimateEnhancer = G.usableTaoistUltimateEnhancer(now);
  if (ultimateEnhancer) return castTaoistUltimateEnhancer(ultimateEnhancer, now);

  const poisoning = G.usableTaoistPoisoning(now);
  if (poisoning) return castTaoistPoisoning(poisoning, now);

  const soulFireBall = G.usableTaoistSoulFireBall(now);
  if (soulFireBall) return castTaoistSoulFireBall(soulFireBall, now);

  if (!G.isPlayerOneShotAction()) G.setPlayerLocomotion("stance", now);
  return false;
}

function taoistAttack(now) {
  const queuedRequest = G.queuedCombatSpell("Taoist");
  const queued = G.usableQueuedTaoistSpell(now);
  if (queued && castQueuedTaoistSpell(queued, now)) return;
  if (queuedRequest) {
    if (enemyDistance() > LANE.warriorRange) {
      state.battle.lastPlayerAttackCooldownMs = TAOIST_COMBAT_POLL_MS;
      if (!G.isPlayerOneShotAction()) G.setPlayerLocomotion("stance", now);
      return;
    }
    taoistWeaponAttack(now);
    return;
  }

  const healing = G.usableTaoistHealing(now);
  if (healing) {
    castTaoistHealing(healing, now);
    return;
  }

  for (const spellId of ["SoulShield", "BlessedArmour"]) {
    const defenceBuff = G.usableTaoistDefenceBuff(spellId, now);
    if (defenceBuff) {
      castTaoistDefenceBuff(defenceBuff, now);
      return;
    }
  }

  const ultimateEnhancer = G.usableTaoistUltimateEnhancer(now);
  if (ultimateEnhancer) {
    castTaoistUltimateEnhancer(ultimateEnhancer, now);
    return;
  }

  const summon = G.usableTaoistSummonSkeleton(now);
  if (summon) {
    castTaoistSummonPet(summon, now);
    return;
  }

  const shinsu = G.usableTaoistSummonShinsu(now);
  if (shinsu) {
    castTaoistSummonPet(shinsu, now);
    return;
  }

  const poisoning = G.usableTaoistPoisoning(now);
  if (poisoning) {
    castTaoistPoisoning(poisoning, now);
    return;
  }

  taoistWeaponAttack(now);
}

function castTaoistHealing(healing, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, target = "player" } = healing;
  const atlas = state.taoistSpellAtlases[spell.id] ?? null;
  const amount = G.rollTaoistHealingAmount(spell, learned, battle.player);
  battle.lastPlayerAttackCooldownMs = spellDelayMs(spell, learned);
  G.commitTaoistSpellUse(spell, learned, cost, now);

  battle.pendingHeal = {
    at: now + CRYSTAL_HEAL_APPLY_DELAY_MS,
    spellId: spell.id,
    amount,
    target,
  };

  if (!options.offline) {
    battle.activeSkill = "None";
    battle.activeSkillAtlas = null;
    battle.activeWizardSpell = null;
    battle.activeWizardSpellAtlas = null;
    battle.activeTaoSpell = spell.id;
    battle.activeTaoSpellAtlas = atlas;
    battle.activeTaoSpellStartedAt = now;
    battle.pendingPoison = null;
    G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
    G.playSpellSfx(spell.id, "cast");
    pushBattleLog(`Taoist casts ${spell.label}${target === "pet" ? ` on ${battle.taoPet?.name ?? "pet"}` : ""}.`);
  }
  return true;
}

function castTaoistPoisoning(poisoning, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, entry, item, kind } = poisoning;
  if (battle.pendingPoison) return false;
  if (!G.consumeOneInventoryUnit(entry.id)) return false;
  battle.lastPlayerAttackCooldownMs = spellDelayMs(spell, learned);
  G.commitTaoistSpellUse(spell, learned, cost, now);

  battle.pendingPoison = {
    at: now + CRYSTAL_POISON_APPLY_DELAY_MS,
    spellId: spell.id,
    value: G.rollTaoistPoisonPower(spell, learned, battle.player),
    kind,
    itemName: item.name,
  };

  if (!options.offline) {
    const atlas = state.taoistSpellAtlases[spell.id] ?? null;
    battle.activeSkill = "None";
    battle.activeSkillAtlas = null;
    battle.activeWizardSpell = null;
    battle.activeWizardSpellAtlas = null;
    battle.activeTaoSpell = spell.id;
    battle.activeTaoSpellAtlas = atlas;
    battle.activeTaoSpellStartedAt = now;
    battle.pendingHeal = null;
    G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
    G.playSpellSfx(spell.id, "cast");
    pushBattleLog(`Taoist casts ${spell.label} with ${item.name}.`);
  }
  return true;
}

function combatSpellVisualDurationMs(atlas) {
  const layerDurations = (atlas?.layers ?? []).map((layer) => (
    (Number(layer.delayMs) || 0) + Math.max(0, (layer.frames?.length ?? 0) * (Number(layer.interval) || 0))
  ));
  if (atlas?.projectile) {
    layerDurations.push((Number(atlas.projectile.delayMs) || 0) + (Number(atlas.projectile.moveDurationMs) || 0));
  }
  if (atlas?.impact) {
    layerDurations.push((Number(atlas.impact.delayMs) || 0) + Math.max(0, (atlas.impact.frames?.length ?? 0) * (Number(atlas.impact.interval) || 0)));
  }
  return Math.max(0, ...layerDurations);
}

function castTaoistSoulFireBall(soulFireBall, now, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, entry, item } = soulFireBall;
  const secondary = Boolean(options.secondary);
  if (!G.consumeOneInventoryUnit(entry.id)) return false;
  const atlas = state.taoistSpellAtlases[spell.id] ?? null;
  const hit = G.rollMagicHit(battle.enemy);
  const damage = hit ? G.rollTaoistMagicDamage(spell, learned, battle.player, battle.enemy) : 0;
  const impactAt = now + wizardImpactDelay(spell, atlas);

  if (!secondary) battle.lastPlayerAttackCooldownMs = spellDelayMs(spell, learned);
  G.commitTaoistSpellUse(spell, learned, cost, now);
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = spell.id;
  battle.activeTaoSpellAtlas = atlas;
  battle.activeTaoSpellStartedAt = now;
  battle.pendingImpact = { at: impactAt, spellId: spell.id, damage, hit: hit && damage > 0 };
  if (!secondary) {
    battle.activeSkill = "None";
    battle.activeSkillAtlas = null;
    battle.pendingHeal = null;
    battle.pendingPoison = null;
  }

  if (!secondary || !G.isPlayerOneShotAction()) G.setPlayerAction(spell.bodyAction ?? "spell", now, true);
  G.playSpellSfx(spell.id, "cast");
  G.playSpellSfx(spell.id, "fly", { volume: 0.38, throttleMs: 120 });
  pushBattleLog(`Taoist casts ${spell.label} with ${item.name}.`);
  return true;
}

function taoistPetAttack(now, options = {}) {
  const battle = state.battle;
  const pet = battle.taoPet;
  const enemy = battle.enemy;
  if (!pet?.active || !enemy || enemy.hp <= 0) return false;

  battle.enemyAggro = true;
  G.revealTaoistShinsuPet(pet);
  const result = G.rollTaoistPetAttackResult(pet, enemy);
  if (!options.offline) {
    G.setTaoPetAction("attack1", true, now);
  }

  if (pet.spellId === "SummonShinsu") {
    if (!options.offline) G.playTaoPetSfx("attack", { volume: 0.36, throttleMs: 250 });
    battle.pendingPetAttack = {
      at: now + taoistShinsuAttackImpactMs(),
      hit: result.hit,
      damage: result.damage,
      offline: Boolean(options.offline),
      bossParty: false,
    };
    return true;
  }

  if (!options.offline) G.playTaoPetSfx("attack", { volume: 0.36, throttleMs: 250 });
  G.applyTaoistPetAttackResult(pet, enemy, result, now, options);
  return true;
}

function taoistWeaponAttack(now, failedSpell = null) {
  const battle = state.battle;
  const weaponEntry = G.equippedEntry("weapon");
  const weapon = weaponEntry ? G.itemDefinition(weaponEntry.itemId) : null;
  const weaponName = weapon ? G.itemDisplayName(weapon, weaponEntry) : "weapon";

  battle.lastPlayerAttackCooldownMs = G.playerWeaponAttackCooldownMs(now, BASIC_ATTACK_SKILL);
  battle.activeSkill = BASIC_ATTACK_SKILL.id;
  battle.activeSkillAtlas = null;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.pendingHeal = null;

  G.setPlayerAction(BASIC_ATTACK_SKILL.bodyAction, now, true);
  G.playWeaponSwingSfx();
  if (failedSpell && (!battle.lastNoMpLogAt || now - battle.lastNoMpLogAt > 5000)) {
    battle.lastNoMpLogAt = now;
    pushBattleLog(`Not enough MP to cast ${failedSpell.label}; Taoist uses ${weaponName}.`);
    G.addCombatText("player", "No MP", "mana", now);
  }

  if (!G.rollHit(battle.player.accuracy, battle.enemy.agility)) {
    G.addCombatText("enemy", "Miss", "miss", now);
    pushBattleLog(`Taoist swings ${weaponName} at ${battle.enemy.name} but misses.`);
    return;
  }

  const damage = rollDamage(battle.player.dc, enemyPhysicalDefence(battle.enemy), battle.player.luck);
  if (damage <= 0) {
    G.addCombatText("enemy", "Miss", "miss", now);
    pushBattleLog(`Taoist swings ${weaponName} at ${battle.enemy.name} but misses.`);
    return;
  }
  reduceEnemyHp(battle.enemy, damage);
  setEnemyAction("struck", true, now);
  G.playMonsterSfx("flinch");
  G.playWeaponHitSfx();
  G.addCombatText("enemy", damage, "damage", now);
  pushBattleLog(`Taoist hits ${battle.enemy.name} with ${weaponName} for ${damage}.`);
  G.levelPassiveWeaponMagic(now);

  if (battle.enemy.hp <= 0) {
    G.finishEnemy(now);
    setEnemyAction("die", false, now);
    G.playMonsterSfx("death");
    pushBattleLog(`${battle.enemy.name} is defeated.`);
  }
}

function wizardGroundEffectDurationMs(spell, value) {
  const base = Math.max(0, Math.trunc(Number(spell.groundDurationBaseMs) || 10000));
  const perPower = Math.max(0, Math.trunc(Number(spell.groundDurationPerPowerMs) || 500));
  return base + Math.max(0, Math.trunc(Number(value) || 0)) * perPower;
}

function enemyAttack(now) {
  const battle = state.battle;
  if (isTrainingDummyEnemy(battle.enemy)) return false;
  if (G.isEvilCentipedeEnemy(battle.enemy)) return G.beginEvilCentipedeAttack(now);
  if (enemyHasRangedMeleeAttack(battle.enemy)) return G.beginBoneLordAttack(now);
  const target = enemyAttackTarget();
  setEnemyAction("attack1", true, now);
  G.playMonsterSfx("attack");
  const { hit, damage } = G.resolveIncomingEnemyAttack(battle.enemy, target);
  if (!hit) {
    G.addCombatText(target.anchor, "Miss", "miss", now);
    pushBattleLog(`${battle.enemy.name} misses ${target.name}.`);
    return true;
  }
  target.applyDamage(damage, now);
  G.addCombatText(target.anchor, damage, "enemyDamage", now);
  pushBattleLog(`${battle.enemy.name} hits ${target.name} for ${damage}.`);

  if (target.kind === "player" && battle.player.hp <= 0) {
    G.finishBattle(now);
    G.setPlayerAction("die", now);
    G.playSfx("player.death", { volume: 0.58 });
    pushBattleLog(`${battle.combatClass} falls.`);
  }
  return true;
}

function enemyAttackTarget() {
  const battle = state.battle;
  if (taoistPetCanTank()) {
    const pet = battle.taoPet;
    const defence = G.defenceStatsForEntity(pet);
    return {
      kind: "pet",
      name: pet.name,
      anchor: "pet",
      ac: defence.ac,
      amc: defence.amc,
      magicResist: defence.magicResist,
      agility: defence.agility,
      applyDamage: (damage, now) => {
        pet.hp = Math.max(0, pet.hp - damage);
        G.setTaoPetAction("struck", true, now);
        if (pet.hp <= 0) G.markTaoistPetDead(now);
      },
    };
  }
  return {
    kind: "player",
    name: battle.combatClass,
    anchor: "player",
    ac: battle.player.ac,
    amc: battle.player.amc,
    magicResist: battle.player.magicResist ?? 0,
    agility: battle.player.agility,
    applyDamage: (damage, now) => {
      battle.player.hp = Math.max(0, battle.player.hp - damage);
      G.maybeNotifyMagicShieldStruck(null, now);
      G.setPlayerAction("struck", now + 250, true);
      G.playSfx("player.flinch", { volume: 0.45, throttleMs: 120 });
    },
  };
}

function enemyAttackDefenceType(enemy) {
  if (enemy?.attackDefenceType === "MAC") return "MAC";
  if (enemy?.attackDefenceType === "MACAgility") return "MACAgility";
  return "ACAgility";
}

function enemyAttackDefenceGuidance(enemy) {
  if (!enemy) return "-";
  const type = enemyAttackDefenceType(enemy);
  const parts = [];
  if (type === "MAC" || type === "MACAgility") {
    parts.push("Magical (MAC/AMC)");
  } else {
    parts.push("Physical (AC)");
  }
  if (type === "ACAgility" || type === "MACAgility") {
    parts.push("Agility dodges");
  }
  if (G.isEvilCentipedeEnemy(enemy)) {
    parts.push("Poison on hit");
  }
  return parts.join(" · ");
}

function updateBattleRestState(now) {
  const battle = state.battle;
  if (!battle.returnToStandAt || battle.running || now < battle.returnToStandAt) return;
  battle.returnToStandAt = 0;
  if ((battle.player?.hp ?? 0) <= 0) return;
  if (state.game.mode === "mining") {
    G.setPlayerAction("mine", now, true);
    return;
  }
  G.setPlayerAction("standing", now);
}

function setEnemyLocomotion(action, now) {
  if (state.enemy.action === action || G.isEnemyOneShotAction()) return;
  state.enemy.action = action;
  state.enemy.frame = 0;
  state.enemy.oneShot = false;
  state.enemy.lastTick = now;
  G.updateEnemyActionButtons();
}

function warriorCombatSkill(skillId) {
  return WARRIOR_COMBAT_SKILLS.find((skill) => skill.id === skillId) ?? BASIC_ATTACK_SKILL;
}

function warriorAutoSummaryText() {
  const enabled = G.autoWarriorCombatSkills().map((skill) => skill.label);
  return enabled.length ? enabled.join(", ") : "none";
}

function taoistAutoSummaryText() {
  const enabled = G.autoTaoistCombatSpells().map((spell) => spell.label);
  return enabled.length ? enabled.join(", ") : "none";
}

function combatSkillBarShouldShow(skills = null) {
  const resolvedSkills = skills ?? (state.battle.combatClass === "Wizard"
    ? G.learnedActiveWizardSkills()
    : state.battle.combatClass === "Taoist"
    ? G.learnedActiveTaoistSkills()
    : G.learnedActiveWarriorSkills());
  return ["Warrior", "Wizard", "Taoist"].includes(state.battle.combatClass)
    && resolvedSkills.length > 0
    && (state.game.mode === "town" || state.game.mode === "zone" || state.battle.running);
}

function combatSkillButtonHtml(skill, learned, now) {
  const remainingMs = skill.toggle ? 0 : Math.max(0, (learned?.castReadyAt ?? 0) - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const mpCost = spellMpCost(skill, learned);
  const enoughMp = (state.battle.player?.mp ?? 0) >= mpCost;
  const hasPoison = skill.id !== "Poisoning" || G.poisonInventoryCount() > 0;
  const needsAmulet = skill.id === "SoulFireBall" || skill.id === "SummonSkeleton" || skill.id === "SummonShinsu";
  const amuletCost = taoistSummonAmuletCost(skill.id);
  const hasAmulet = !needsAmulet || G.amuletInventoryCount() >= (skill.id === "SoulFireBall" ? 1 : amuletCost);
  const auto = Boolean(learned?.autoCast);
  const combatClass = state.battle.combatClass;
  const queued = G.isQueuedCombatSpell(skill.id, combatClass);
  const chargeReady = warriorChargeReady(skill.id);
  const autoLimitReached = !auto
    && combatAutoCastClassForSpell(skill.id) === combatClass
    && G.autoCastSlotsUsed(combatClass) >= G.autoCastSlotLimit();
  const manualLabel = chargeReady ? "Ready" : queued ? "Next" : remainingSeconds > 0 ? `${remainingSeconds}` : "Cast";
  const autoLabel = auto ? "On" : autoLimitReached ? "Max" : "Off";
  const consumableText = skill.id === "Poisoning"
    ? ` | Green ${G.poisonInventoryCount("green")} Yellow ${G.poisonInventoryCount("yellow")}`
    : needsAmulet
    ? ` | Amulets ${G.amuletInventoryCount()}${amuletCost > 1 ? ` (need ${amuletCost})` : ""}`
    : "";
  const castTitle = chargeReady && skill.id === "TwinDrakeBlade"
    ? `${skill.label} Lv ${learned?.level ?? 0} | charged — next attack releases twin drake | click to cancel`
    : chargeReady && skill.id === "FlamingSword"
    ? `${skill.label} Lv ${learned?.level ?? 0} | charged — next attack unleashes fire | click to cancel`
    : queued
    ? `${skill.label} Lv ${learned?.level ?? 0} | queued as next manual cast`
    : G.isWarriorChargeSkill(skill)
    ? `${skill.label} Lv ${learned?.level ?? 0} | MP ${mpCost} | click to charge for next attack`
    : `${skill.label} Lv ${learned?.level ?? 0} | ${skill.toggle ? (skill.id === "Thrusting" ? "2 tile reach" : `MP ${mpCost} per swing`) : `MP ${mpCost}`}${consumableText} | click to cast manually`;
  const autoTitle = auto
    ? `Disable ${skill.label} auto`
    : autoLimitReached
    ? `Autocast slots full (${G.autoCastSlotsUsed(combatClass)}/${G.autoCastSlotLimit()})`
    : `Enable ${skill.label} auto`;
  return `
    <div class="combat-skill-control ${auto ? "active" : ""} ${queued || chargeReady ? "queued" : ""}">
      <button
        class="combat-skill-button ${auto ? "active" : ""} ${queued || chargeReady ? "queued" : ""} ${chargeReady ? "charged" : ""} ${remainingMs > 0 ? "cooling" : ""} ${!enoughMp || !hasPoison || !hasAmulet ? "no-mp" : ""}"
        type="button"
        data-cast-combat-skill="${G.escapeHtml(skill.id)}"
        title="${G.escapeHtml(castTitle)}"
      >
        <img src="${G.escapeHtml(magicIconSrc(skill))}" alt="" />
        <span class="combat-skill-level">Lv ${learned?.level ?? 0}</span>
        <span class="combat-skill-auto">${manualLabel}</span>
        ${remainingSeconds > 0 ? `<span class="combat-skill-cooldown">${remainingSeconds}</span>` : ""}
      </button>
      <button
        class="combat-skill-toggle ${auto ? "active" : ""} ${autoLimitReached ? "locked" : ""}"
        type="button"
        data-toggle-skill-auto="${G.escapeHtml(skill.id)}"
        title="${G.escapeHtml(autoTitle)}"
      >${autoLabel}</button>
    </div>
  `;
}

function wizardCombatSpell(spellId) {
  return WIZARD_COMBAT_SPELLS.find((spell) => spell.id === spellId) ?? WIZARD_COMBAT_SPELLS[0];
}

function taoistCombatSpell(spellId) {
  return TAOIST_COMBAT_SPELLS.find((spell) => spell.id === spellId) ?? TAOIST_COMBAT_SPELLS[0];
}

function combatAttackSpell(spellId) {
  return WIZARD_COMBAT_SPELLS.find((spell) => spell.id === spellId)
    ?? TAOIST_COMBAT_SPELLS.find((spell) => spell.id === spellId)
    ?? null;
}

function wizardImpactDelay(spell, atlas) {
  if (spell.impactMode === "projectile") {
    if (atlas?.projectile) {
      return Math.max((atlas.projectile.delayMs ?? 0) + 120, G.crystalProjectileImpactDelayMs());
    }
    return G.crystalProjectileImpactDelayMs();
  }
  return spell.impactDelayMs ?? 450;
}

function combatHudLayoutMetrics(options = {}) {
  const skillBarVisible = options.skillBarVisible ?? (
    Boolean(els.combatSkillBar)
    && !els.combatSkillBar.hidden
    && Boolean(els.combatSkillBar.innerHTML.trim())
  );
  const feetPx = Math.round(combatAnchor("player").y * state.scale);
  const hotbarTop = feetPx + COMBAT_HUD_PLAYER_GAP;
  const skillTop = hotbarTop + COMBAT_HUD_HOTBAR_HEIGHT + COMBAT_HUD_STACK_GAP;
  const hudBottom = skillBarVisible
    ? skillTop + COMBAT_HUD_SKILL_BAR_HEIGHT + 4
    : hotbarTop + COMBAT_HUD_HOTBAR_HEIGHT + 4;
  const canvasHeight = state.stageHeight * state.scale;
  return {
    feetPx,
    hotbarTop,
    skillTop,
    hudBottom,
    canvasHeight,
    displayHeight: Math.max(canvasHeight, hudBottom),
    skillBarVisible,
  };
}

function combatHudViewportReservePx() {
  if (!IS_GAME_UI) return 0;
  const skillBarExpected = combatSkillBarShouldShow();
  const reserve = COMBAT_HUD_PLAYER_GAP + COMBAT_HUD_HOTBAR_HEIGHT + 4;
  if (!skillBarExpected) return reserve;
  return reserve + COMBAT_HUD_STACK_GAP + COMBAT_HUD_SKILL_BAR_HEIGHT;
}

function enemySpawnDistance() {
  const zoneSpawnDistance = Number(G.activeZone()?.arenaSpawnDistance);
  if (Number.isFinite(zoneSpawnDistance) && zoneSpawnDistance > 0) {
    return Math.max(LANE.enemyRange + 8, Math.round(zoneSpawnDistance));
  }
  return Math.max(360, state.stageWidth - G.playerScreenX() + LANE.spawnMargin);
}

function ensureMapStampArenaLock() {
  if (!G.currentZoneMapStamp()) return;
  if (state.battle.lockedArenaWorldX != null) return;
  if (state.battle.bossParty?.lockedArenaWorldX != null) return;
  const lockX = G.mapStampArenaAnchorWorldX();
  state.battle.lockedArenaWorldX = lockX;
  if (state.battle.bossParty) state.battle.bossParty.lockedArenaWorldX = lockX;
}

function enemyDistance() {
  return Math.max(0, state.battle.enemyX - state.battle.playerX);
}

function wizardAttackRange(now = performance.now()) {
  const attackSpell = G.usableWizardAttackSpell(now);
  if (!attackSpell) return LANE.warriorRange;
  const { spell, cost, cooldownWaiting } = attackSpell;
  if (cooldownWaiting) return LANE.warriorRange;
  if ((state.battle.player?.mp ?? 0) < cost) return LANE.warriorRange;
  if (spell.id === "FireWall" && wizardFireWallRequiresMeleeRange() && !wizardFireWallMeleeReady()) {
    return LANE.enemyRange;
  }
  return G.crystalSpellRangePx(spell);
}

function taoistAttackRange(now = performance.now()) {
  const queued = G.queuedCombatSpell("Taoist")?.spell;
  if (queued?.id === "SoulFireBall") return taoistSoulFireBallRangePx(queued);
  if (queued?.id === "Poisoning") return G.crystalSpellRangePx(queued);
  if (queued?.id === "SummonSkeleton" || queued?.id === "SummonShinsu") return taoistSummonPetRangePx();
  return LANE.warriorRange;
}

function taoistSpellEngageRange(now = performance.now()) {
  const queued = G.queuedCombatSpell("Taoist")?.spell;
  if (queued?.id === "SoulFireBall" && G.usableTaoistSoulFireBall(now, { requireAuto: false, ignoreRange: true })) return taoistSoulFireBallRangePx(queued);
  if (queued?.id === "Poisoning" && G.usableTaoistPoisoning(now, { requireAuto: false, ignoreRange: true })) return G.crystalSpellRangePx(queued);
  if ((queued?.id === "SummonSkeleton" && G.usableTaoistSummonSkeleton(now, { requireAuto: false, ignoreRange: true }))
    || (queued?.id === "SummonShinsu" && G.usableTaoistSummonShinsu(now, { requireAuto: false, ignoreRange: true }))) {
    return taoistSummonPetRangePx();
  }
  const summon = G.usableTaoistSummonSkeleton(now, { ignoreRange: true });
  const shinsu = G.usableTaoistSummonShinsu(now, { ignoreRange: true });
  const poison = G.usableTaoistPoisoning(now, { ignoreRange: true });
  const soulFireBall = G.usableTaoistSoulFireBall(now, { ignoreRange: true });
  return Math.max(
    summon ? taoistSummonPetRangePx() : 0,
    shinsu ? taoistSummonPetRangePx() : 0,
    poison ? G.crystalSpellRangePx(poison.spell) : 0,
    soulFireBall ? taoistSoulFireBallRangePx(soulFireBall.spell) : 0,
  );
}

function taoistSummonPetRangePx() {
  return Math.min(TAOIST_SUMMON_SKELETON_LANE_RANGE, taoistVisibleRangeLimitPx());
}

function taoistSummonSkeletonRangePx() {
  return taoistSummonPetRangePx();
}

function taoistVisibleRangeLimitPx() {
  return Math.max(LANE.aggroRange, state.stageWidth - G.playerScreenX() - TAOIST_VISIBLE_RANGE_MARGIN);
}

function taoistSoulFireBallRangePx(spell) {
  return Math.min(
    G.crystalSpellRangePx(spell),
    TAOIST_SOUL_FIRE_BALL_LANE_RANGE,
    taoistVisibleRangeLimitPx(),
  );
}

function enemyTargetDistance() {
  if (taoistPetCanTank()) return taoistPetEnemyDistance();
  return enemyDistance();
}

function enemyAttackSfxKind(enemy = state.battle.enemy, ranged = false) {
  if (!ranged) return "attack";
  const monsterIndex = Number(enemy?.monsterIndex);
  if (Number.isFinite(monsterIndex) && G.sfxEntry(`monster.${monsterIndex}.range`)?.src) {
    return "range";
  }
  return "attack";
}

function enemyActionBlendKey(action) {
  if (action === "standing") return "standingBlend";
  if (action === "walking") return "walkingBlend";
  if (action === "attack1") return "attack1Blend";
  if (action === "attackRange1") return "attackRange1Blend";
  return null;
}

function taoistPetAnchor() {
  const pet = state.battle.taoPet;
  if (pet) {
    return {
      x: Math.round(G.resolvedTaoPetWorldX(pet) - state.battle.cameraX),
      y: Math.round(state.stageHeight * LANE.y + 2),
    };
  }
  const enemyAnchor = combatAnchor("enemy");
  return {
    x: Math.round(enemyAnchor.x + 54),
    y: Math.round(enemyAnchor.y + 2),
  };
}

function enemyFrameBounds() {
  if (G.groupDungeonSwarmActive()) {
    const primary = G.groupDungeonPrimarySwarmEnemy();
    if (primary) return G.swarmEnemyFrameBounds(primary);
  }
  const anchor = combatAnchor("enemy");
  const atlas = state.enemy.atlas;
  const clip = atlas?.actions?.[state.enemy.action];
  const meta = clip?.frames?.[state.enemy.frame] ?? clip?.frames?.[0];
  if (!atlas || !meta || meta.empty) {
    return { centerX: anchor.x, topY: anchor.y - 64, width: 96, height: 112 };
  }
  const width = meta.w || atlas.slotWidth;
  const height = meta.h || atlas.slotHeight;
  return {
    centerX: anchor.x + meta.offsetX + width / 2,
    topY: anchor.y + meta.offsetY,
    width,
    height,
  };
}

function spellTargetCellAnchorY(anchorY = Math.floor(state.stageHeight * LANE.y)) {
  // Crystal map effects use TargetPoint * CellHeight (cell top), not the foot line we use for sprites.
  return anchorY - LANE_TILE_PX;
}

function ultimateEnhancerImpactAnchor(entry) {
  const laneY = Math.floor(state.stageHeight * LANE.y);
  if (entry.petFx || entry.anchor === "pet") {
    const pet = state.battle.bossParty?.pet ?? state.battle.taoPet;
    const worldX = G.resolvedTaoPetWorldX(pet);
    return { x: Math.floor(worldX - state.battle.cameraX), y: laneY };
  }
  if (entry.memberClassId && state.battle.bossParty?.active) {
    const member = state.battle.bossParty.members?.find((candidate) => candidate.classId === entry.memberClassId);
    if (member) {
      return {
        x: Math.floor((Number(member.worldX) || 0) - state.battle.cameraX),
        y: laneY,
      };
    }
  }
  const playerAnchor = combatAnchor("player");
  return { x: playerAnchor.x, y: laneY };
}

function defenceBuffImpactAnchor(entry) {
  const laneY = Math.floor(state.stageHeight * LANE.y);
  if (entry.spellId === "UltimateEnhancer") {
    return ultimateEnhancerImpactAnchor(entry);
  }
  if (entry.anchor === "pet") {
    const petAnchor = taoistPetAnchor();
    return { x: petAnchor.x, y: spellTargetCellAnchorY(petAnchor.y) };
  }
  if (entry.worldX != null) {
    return {
      x: Math.floor(entry.worldX - state.battle.cameraX),
      y: spellTargetCellAnchorY(laneY),
    };
  }
  const playerAnchor = combatAnchor("player");
  return { x: playerAnchor.x, y: spellTargetCellAnchorY(playerAnchor.y) };
}

function wizardGroundFxLayer(atlas) {
  if (!atlas) return null;
  return atlas.ground ?? atlas.layers?.find((layer) => layer.sheet === "ground.png" || Number(layer.baseIndex) === 1630) ?? null;
}

function combatTextColor(kind) {
  if (kind === "miss") return "#d7d0c3";
  if (kind === "enemyDamage") return "#ef7f72";
  if (kind === "heal") return "#80e28a";
  if (kind === "mana") return "#7fb7ff";
  if (kind === "poison") return "#69d879";
  if (kind === "frost") return "#9de8ff";
  if (kind === "debuff") return "#e2c45f";
  if (kind === "buff") return "#f0b35c";
  if (kind === "assistDamage") return "#c6a0ff";
  return "#f3d16b";
}

function combatTextBounds(anchorName) {
  if (anchorName === "enemy") return enemyFrameBounds();
  if (anchorName === "pet") return taoistPetFrameBounds();
  return G.playerFrameBounds();
}

function taoistPetFrameBounds() {
  const anchor = taoistPetAnchor();
  const pet = state.battle.taoPet;
  const atlas = taoPetAtlasFor(pet);
  const clip = atlas?.actions?.[pet?.action];
  const meta = clip?.frames?.[pet?.frame ?? 0] ?? clip?.frames?.[0];
  if (!atlas || !meta || meta.empty) {
    return { centerX: anchor.x, topY: anchor.y - 64 };
  }
  const width = meta.w || atlas.slotWidth;
  const height = meta.h || atlas.slotHeight;
  return {
    centerX: anchor.x + meta.offsetX + width / 2,
    topY: anchor.y + meta.offsetY,
    height,
  };
}

function combatAnchor(name) {
  const battle = state.battle;
  const laneY = G.arenaLaneYPx();
  const enemyOffsetY = name === "enemy" ? Math.trunc(Number(G.activeZone()?.arenaEnemyOffsetY) || 0) : 0;
  if (battle.player && battle.enemy) {
    const worldX = name === "enemy" ? battle.enemyX : battle.playerX;
    return {
      x: Math.floor(worldX - battle.cameraX),
      y: laneY + enemyOffsetY,
    };
  }
  const anchor = COMBAT_ANCHORS[name] ?? COMBAT_ANCHORS.player;
  const townYOffset = state.game.mode === "town" ? G.townViewOffsetYPx() : 0;
  if (state.game.mode === "town" && name === "player") {
    return {
      x: Math.floor(state.stageWidth * 0.34),
      y: Math.floor(state.stageHeight * 0.58 + townYOffset),
    };
  }
  if (state.game.mode === "zone") {
    return {
      x: Math.floor(state.stageWidth * anchor.x),
      y: laneY + (name === "enemy" ? enemyOffsetY : 0),
    };
  }
  return {
    x: Math.floor(state.stageWidth * anchor.x),
    y: Math.floor(state.stageHeight * anchor.y + townYOffset),
  };
}

function layerNames() {
  const names = Object.keys(state.catalogue?.layers ?? {});
  if (names.length === 0) return ["armour", "hair", "weapon"];
  const preferred = ["weaponBack", "armour", "hair", "weapon", "weaponFront", "weaponAlt", "effect"];
  return [
    ...preferred.filter((name) => names.includes(name)),
    ...names.filter((name) => !preferred.includes(name)),
  ];
}

function updateActionButtons() {
  els.actionGroups.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.action === state.action);
  });
}

function updateCoverage() {
  const allActions = Object.keys(PLAYER_ACTIONS);
  const missing = Object.fromEntries(
    layerNames().map((layer) => [layer, missingActions(state.atlases[layer], allActions)]),
  );
  const availableCount = allActions.filter((action) =>
    layerNames().some((layer) => state.atlases[layer]?.actions?.[action]),
  ).length;

  const set = SPRITE_SETS[state.spriteSet];
  els.status.textContent = `${set.label}: ${availableCount}/${allActions.length} actions`;
  els.status.classList.toggle("warn", availableCount < allActions.length);
  els.coverage.innerHTML = layerNames()
    .map((layer) => {
      const text = missing[layer].length ? missing[layer].join(", ") : "complete";
      return `<p><strong>${title(layer)}</strong><span>${text}</span></p>`;
    })
    .join("");
}

function title(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


G.resetBattleForCurrentMode = resetBattleForCurrentMode;
G.taoistPetSupportAttackOffline = taoistPetSupportAttackOffline;
G.setEnemyAction = setEnemyAction;
G.clearTransientCombatBuffs = clearTransientCombatBuffs;
G.resetBattle = resetBattle;
G.resetBattleForRoomOnly = resetBattleForRoomOnly;
G.selectBattleEnemy = selectBattleEnemy;
G.startBattle = startBattle;
G.stopBattle = stopBattle;
G.startContinuousMovement = startContinuousMovement;
G.stopContinuousWalk = stopContinuousWalk;
G.pushBattleLog = pushBattleLog;
G.pushRecentLoot = pushRecentLoot;
G.combatPlayableZones = combatPlayableZones;
G.isRoomOnlyZone = isRoomOnlyZone;
G.isTrainingRoomZone = isTrainingRoomZone;
G.isTrainingDummyEnemy = isTrainingDummyEnemy;
G.reduceEnemyHp = reduceEnemyHp;
G.isTrainingRoomCombat = isTrainingRoomCombat;
G.wizardSpellById = wizardSpellById;
G.spellDropZoneText = spellDropZoneText;
G.combatAutoCastClassForSpell = combatAutoCastClassForSpell;
G.combatSkillForClass = combatSkillForClass;
G.combatAutoCastSpells = combatAutoCastSpells;
G.warriorFlamingSwordReady = warriorFlamingSwordReady;
G.warriorMemberChargeReady = warriorMemberChargeReady;
G.warriorChargeReady = warriorChargeReady;
G.enemyUsesFixedArenaSpawn = enemyUsesFixedArenaSpawn;
G.enemyBossIsStationary = enemyBossIsStationary;
G.combatMaxHitChancePercent = combatMaxHitChancePercent;
G.taoistSummonAmuletCost = taoistSummonAmuletCost;
G.autoUsePotionForKind = autoUsePotionForKind;
G.defenceBuffFxList = defenceBuffFxList;
G.defenceBuffImpactAtlas = defenceBuffImpactAtlas;
G.defenceBuffFxAtlasDurationMs = defenceBuffFxAtlasDurationMs;
G.ultimateEnhancerImpactFxOptions = ultimateEnhancerImpactFxOptions;
G.enemyHasRangedMeleeAttack = enemyHasRangedMeleeAttack;
G.enemyAttackDamageStat = enemyAttackDamageStat;
G.combatantPoison = combatantPoison;
G.combatantParalyzed = combatantParalyzed;
G.updateCombatantPoisons = updateCombatantPoisons;
G.enemyRangedStrikeVfxUntil = enemyRangedStrikeVfxUntil;
G.updateBattle = updateBattle;
G.twinDrakeAutoCastActive = twinDrakeAutoCastActive;
G.warriorSpellCastOnCooldown = warriorSpellCastOnCooldown;
G.warriorTwinDrakeReady = warriorTwinDrakeReady;
G.enemyStunned = enemyStunned;
G.warriorSkillFxLayers = warriorSkillFxLayers;
G.warriorChargeFxDurationMs = warriorChargeFxDurationMs;
G.twinDrakeChargeFxDurationMs = twinDrakeChargeFxDurationMs;
G.spellFxLayerFrameIndex = spellFxLayerFrameIndex;
G.twinDrakeChargeFxEntries = twinDrakeChargeFxEntries;
G.magicShieldFxEntity = magicShieldFxEntity;
G.magicShieldFxActive = magicShieldFxActive;
G.magicShieldStruckMemberClassId = magicShieldStruckMemberClassId;
G.spellFxLoopFrameIndex = spellFxLoopFrameIndex;
G.magicShieldLoopStartedAt = magicShieldLoopStartedAt;
G.twinDrakeLearnedForMember = twinDrakeLearnedForMember;
G.twinDrakeAttackerForMember = twinDrakeAttackerForMember;
G.castWarriorCharge = castWarriorCharge;
G.warriorApplyPhysicalHit = warriorApplyPhysicalHit;
G.warriorAttack = warriorAttack;
G.thrustingEnabled = thrustingEnabled;
G.wizardFireWallRequiresMeleeRange = wizardFireWallRequiresMeleeRange;
G.wizardHoldsCombatPosition = wizardHoldsCombatPosition;
G.wizardFireWallMeleeReady = wizardFireWallMeleeReady;
G.wizardAttackSpellReady = wizardAttackSpellReady;
G.warriorAutoPriority = warriorAutoPriority;
G.wizardAutoPriority = wizardAutoPriority;
G.taoistAutoPriority = taoistAutoPriority;
G.wizardCastCooldownMs = wizardCastCooldownMs;
G.wizardCastLocked = wizardCastLocked;
G.warriorSlayingPending = warriorSlayingPending;
G.enemyPhysicalDefence = enemyPhysicalDefence;
G.enemyMagicalDefence = enemyMagicalDefence;
G.enemyDefenceStat = enemyDefenceStat;
G.enemyPoison = enemyPoison;
G.enemyHasPoison = enemyHasPoison;
G.enemySlowActive = enemySlowActive;
G.enemyFrozenActive = enemyFrozenActive;
G.enemyAdvanceSpeed = enemyAdvanceSpeed;
G.castWarriorBuff = castWarriorBuff;
G.levelMagicSkill = levelMagicSkill;
G.wizardAttack = wizardAttack;
G.wizardWeaponAttack = wizardWeaponAttack;
G.taoistDefenceBuffKind = taoistDefenceBuffKind;
G.taoistDefenceBuffStat = taoistDefenceBuffStat;
G.defenceBuffKind = defenceBuffKind;
G.defenceBuffStat = defenceBuffStat;
G.combatDefenceBuffSpell = combatDefenceBuffSpell;
G.taoistPartyDefenceBuffTargets = taoistPartyDefenceBuffTargets;
G.combatantForMagicRoll = combatantForMagicRoll;
G.ultimateEnhancerStatForTarget = ultimateEnhancerStatForTarget;
G.ultimateEnhancerTargetEntry = ultimateEnhancerTargetEntry;
G.ultimateEnhancerTargets = ultimateEnhancerTargets;
G.ultimateEnhancerNeedsCast = ultimateEnhancerNeedsCast;
G.castTaoistUltimateEnhancer = castTaoistUltimateEnhancer;
G.castWizardDefenceBuff = castWizardDefenceBuff;
G.castTaoistDefenceBuff = castTaoistDefenceBuff;
G.castQueuedTaoistSpell = castQueuedTaoistSpell;
G.castTaoistSummonPet = castTaoistSummonPet;
G.castTaoistSummonSkeleton = castTaoistSummonSkeleton;
G.taoistPetRenderMonsterIndex = taoistPetRenderMonsterIndex;
G.taoistPetAttackRangePx = taoistPetAttackRangePx;
G.taoistShinsuAttackImpactMs = taoistShinsuAttackImpactMs;
G.taoPetAtlasFor = taoPetAtlasFor;
G.taoistPetSummonWorldX = taoistPetSummonWorldX;
G.taoistPetCanTank = taoistPetCanTank;
G.taoistPetCanBeHealed = taoistPetCanBeHealed;
G.taoistPetEnemyDistance = taoistPetEnemyDistance;
G.taoistPetSupportAttack = taoistPetSupportAttack;
G.taoistAttack = taoistAttack;
G.castTaoistHealing = castTaoistHealing;
G.castTaoistPoisoning = castTaoistPoisoning;
G.combatSpellVisualDurationMs = combatSpellVisualDurationMs;
G.castTaoistSoulFireBall = castTaoistSoulFireBall;
G.taoistPetAttack = taoistPetAttack;
G.taoistWeaponAttack = taoistWeaponAttack;
G.wizardGroundEffectDurationMs = wizardGroundEffectDurationMs;
G.enemyAttack = enemyAttack;
G.enemyAttackTarget = enemyAttackTarget;
G.enemyAttackDefenceType = enemyAttackDefenceType;
G.enemyAttackDefenceGuidance = enemyAttackDefenceGuidance;
G.updateBattleRestState = updateBattleRestState;
G.setEnemyLocomotion = setEnemyLocomotion;
G.warriorCombatSkill = warriorCombatSkill;
G.warriorAutoSummaryText = warriorAutoSummaryText;
G.taoistAutoSummaryText = taoistAutoSummaryText;
G.combatSkillBarShouldShow = combatSkillBarShouldShow;
G.combatSkillButtonHtml = combatSkillButtonHtml;
G.wizardCombatSpell = wizardCombatSpell;
G.taoistCombatSpell = taoistCombatSpell;
G.combatAttackSpell = combatAttackSpell;
G.wizardImpactDelay = wizardImpactDelay;
G.combatHudLayoutMetrics = combatHudLayoutMetrics;
G.combatHudViewportReservePx = combatHudViewportReservePx;
G.enemySpawnDistance = enemySpawnDistance;
G.ensureMapStampArenaLock = ensureMapStampArenaLock;
G.enemyDistance = enemyDistance;
G.wizardAttackRange = wizardAttackRange;
G.taoistAttackRange = taoistAttackRange;
G.taoistSpellEngageRange = taoistSpellEngageRange;
G.taoistSummonPetRangePx = taoistSummonPetRangePx;
G.taoistSummonSkeletonRangePx = taoistSummonSkeletonRangePx;
G.taoistVisibleRangeLimitPx = taoistVisibleRangeLimitPx;
G.taoistSoulFireBallRangePx = taoistSoulFireBallRangePx;
G.enemyTargetDistance = enemyTargetDistance;
G.enemyAttackSfxKind = enemyAttackSfxKind;
G.enemyActionBlendKey = enemyActionBlendKey;
G.taoistPetAnchor = taoistPetAnchor;
G.enemyFrameBounds = enemyFrameBounds;
G.spellTargetCellAnchorY = spellTargetCellAnchorY;
G.ultimateEnhancerImpactAnchor = ultimateEnhancerImpactAnchor;
G.defenceBuffImpactAnchor = defenceBuffImpactAnchor;
G.wizardGroundFxLayer = wizardGroundFxLayer;
G.combatTextColor = combatTextColor;
G.combatTextBounds = combatTextBounds;
G.taoistPetFrameBounds = taoistPetFrameBounds;
G.combatAnchor = combatAnchor;
G.layerNames = layerNames;
G.updateActionButtons = updateActionButtons;
G.updateCoverage = updateCoverage;
G.title = title;
