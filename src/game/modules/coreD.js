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

import { battlePanelSignature, gamePanelSignature, sceneSignature, sceneScrollPositions, combatSkillBarSignature, playerHudSignature, hotbarSignature, lastSimulationAt, suppressSimulationRender, musicTrackIndex, musicStatusText, stageCanvas, stageContext, stampBackgroundCache, lastStageShellSize, inventoryDragState, pendingOfflineProgress, imageCache } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els, root } from "../runtime.js";

function buildCrystalWeaponSfxLookup(groups) {
  const lookup = new Map();
  for (const [family, shapes] of Object.entries(groups)) {
    for (const shape of shapes) lookup.set(shape, family);
  }
  return lookup;
}

function createStarterInventoryState(classId) {
  const inventory = {
    gold: PLAYER_TEMPLATE.gold,
    pagesUnlocked: 1,
    maxSlots: INVENTORY_BASE_SLOTS,
    nextInstanceId: 1,
    items: [],
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, null])),
  };
  const starterItems = ["Warrior", "Wizard", "Taoist"].includes(classId)
    ? [["wooden-sword", 1], ["base-dress", 1], ["hp-drug-small", 5], ["mp-drug-small", 5]]
    : [["base-dress", 1], ["hp-drug-small", 5], ["mp-drug-small", 5]];
  for (const [itemId, quantity] of starterItems) addStarterInventoryEntry(inventory, itemId, quantity);
  return inventory;
}

function addStarterInventoryEntry(inventory, itemId, quantity = 1) {
  const item = G.itemDefinition(itemId);
  if (!item) return;
  const entry = {
    id: `item-${inventory.nextInstanceId}`,
    itemId,
    quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
    slot: G.nextFreeSlotInInventoryState(inventory),
    ...normalizeInventoryEntryFields({}, item),
  };
  inventory.nextInstanceId += 1;
  inventory.items.push(entry);
}

function cloneAccountUpgradeState(upgrades) {
  return G.sanitizeAccountUpgradeState(upgrades);
}

function createPendingOfflineProgress(snapshot) {
  const savedAt = Number(snapshot?.savedAt) || 0;
  const elapsedMs = Date.now() - savedAt;
  const activeZoneId = snapshot?.game?.activeZoneId;
  const zoneExists = PROTOTYPE_ZONES.some((zone) => zone.id === activeZoneId);
  const savedHp = G.finiteNumberOrNull(snapshot?.battle?.playerHp);
  const wasRunning = snapshot?.battle?.running !== false;
  const wasPaused = snapshot?.battle?.paused === true;

  if (!savedAt || elapsedMs < OFFLINE_PROGRESS_MIN_MS) return null;

  const pending = {
    elapsedMs: Math.min(elapsedMs, OFFLINE_PROGRESS_CAP_MS),
    rawElapsedMs: elapsedMs,
    capped: elapsedMs > OFFLINE_PROGRESS_CAP_MS,
    savedAt,
  };
  const groupDungeonRun = G.sanitizeGroupDungeonOfflineRun?.(snapshot?.groupDungeonRun, activeZoneId, snapshot?.activeCharacterId ?? snapshot?.battle?.combatClass);
  if (groupDungeonRun?.zoneId === activeZoneId) pending.groupDungeonRun = groupDungeonRun;

  if (snapshot?.game?.mode === "mining" && activeZoneId === MINING_ZONE_ID && !wasPaused) {
    return { ...pending, kind: "mining" };
  }

  if (snapshot?.game?.mode !== "zone" || !zoneExists || !wasRunning || wasPaused) return null;
  if (savedHp != null && savedHp <= 0) return null;

  return { ...pending, kind: "zone" };
}

function applyPendingOfflineProgress() {
  const pending = pendingOfflineProgress;
  pendingOfflineProgress = null;
  if (!pending) return;
  if (pending.kind === "mining") applyOfflineMiningProgress(pending);
  else applyOfflineProgress(pending);
}

function applyOfflineProgress(pending) {
  const zone = G.activeZone();
  if (!pending || !zone || state.game.mode !== "zone" || !state.battle.running || !state.battle.player) return;
  if (state.paused) return;
  if (state.battle.player.hp <= 0) return;

  const groupDungeonMode = Boolean(pending.groupDungeonRun && G.groupDungeonZone(zone) && G.simulateOfflineGroupDungeonProgress);
  const bossPartyMode = !groupDungeonMode && G.bossPartyOfflineSimulationActive(zone);
  let report;
  suppressSimulationRender = true;
  try {
    report = groupDungeonMode
      ? G.simulateOfflineGroupDungeonProgress(zone, pending, performance.now())
      : bossPartyMode
        ? G.simulateBossPartyCatchUp(pending.elapsedMs, performance.now())
        : G.simulateOfflineProgress(zone, pending);
  } finally {
    suppressSimulationRender = false;
  }

  if (!report || report.elapsedMs < OFFLINE_PROGRESS_MIN_MS) return;
  G.rebaseOfflineTransientTimers(report.simulatedEndedAt, performance.now());
  if (groupDungeonMode || bossPartyMode) finalizeOfflineBossPartyState(report);
  else finalizeOfflineBattleState(zone, report);
  G.presentOfflineReport(report);
  G.refreshOfflineProgressUi();
}

function applyOfflineMiningProgress(pending) {
  if (!pending || state.game.mode !== "mining" || state.paused) return;

  let report;
  suppressSimulationRender = true;
  try {
    report = G.simulateOfflineMining(pending);
  } finally {
    suppressSimulationRender = false;
  }

  if (!report || report.elapsedMs < OFFLINE_PROGRESS_MIN_MS) return;
  finalizeOfflineMiningState(report);
  G.presentOfflineMiningReport(report);
  G.refreshOfflineProgressUi();
}

function finalizeOfflineBossPartyState(report) {
  const party = state.battle.bossParty;
  if (!party) return;

  G.bossPartySyncControlledPlayerRef();
  G.syncBossPartyMembersToCharacters(party, { applyControlled: true });
  state.showEnemies = true;
  state.battle.running = party.active && !party.finished && !G.bossPartyAllMembersDead();
  if (G.bossPartyAllMembersDead()) {
    state.battle.phase = "defeat";
    state.battle.running = false;
  } else if (party.finished) {
    state.battle.running = false;
    state.battle.phase = "victory";
  }
  if (report?.resetGroupDungeonRunAfterOffline && G.groupDungeonZone(G.activeZone()) && party.active && !party.finished && !G.bossPartyAllMembersDead()) {
    if (G.groupDungeonBossSwarmZone?.(G.activeZone())) {
      G.resetGroupDungeonBossSwarmRun?.(performance.now());
      G.pushBattleLog("Group hunt offline progress applied. Boss encounter reset for a fresh run.");
    } else {
      G.resetGroupDungeonRun(performance.now());
      G.pushBattleLog("Group hunt offline progress applied. Waves reset for a fresh run.");
    }
  }
  G.markGroupDungeonWaveUiDirty();
  gamePanelSignature = "";
  battlePanelSignature = "";
}

function addOfflineMiningOre(report, itemId, purity) {
  G.syncInventoryCapacity();
  ensureInventorySlots();
  const label = G.offlineMiningOreLabel(itemId, purity);
  if (G.inventoryUsedSlots() >= state.inventory.maxSlots) {
    G.incrementReportCount(report.ignoredDrops, label);
    return false;
  }
  state.inventory.items.push(createOreInventoryEntry(itemId, purity));
  G.syncBossPartyControlledInventoryFromState();
  G.incrementReportCount(report.drops, label);
  return true;
}

function finalizeOfflineMiningState(report) {
  const now = performance.now();
  G.ensureMiningSpotId(false);
  state.showEnemies = true;
  state.battle.running = false;
  state.battle.returnToStandAt = 0;
  state.battle.enemy = null;
  state.battle.phase = "idle";
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  G.setPlayerAction("mine", now, true);
  const spot = G.activeMiningSpot();
  if (spot?.label) {
    G.pushBattleLog(`Resumed mining at ${spot.label}.`);
  }
}

function awardOfflineEnemyRewards(zone, enemy, report) {
  const reward = zone?.rewards ?? { gold: [1, 2] };
  const xp = adjustedKillExperience(enemy?.experience ?? 0, state.game.progress.level, enemy?.level ?? 0);
  const gold = randomInt(reward.gold[0], reward.gold[1]);
  const drops = G.isRedThunderZumaEnemy(enemy)
    ? G.rollRedThunderZumaDrops()
    : G.rollZoneDrops(zone, enemy);
  const leveledTo = applyExperienceReward(xp);
  if (leveledTo.length) {
    applyEquippedStatsToBattlePlayer();
    G.restoreBattlePlayerResources();
  }

  state.inventory.gold += gold;
  state.game.progress.gold = state.inventory.gold;
  state.game.kills += 1;
  state.game.zoneKills += 1;
  state.game.lastReward = { xp, gold, drops: drops.added };
  state.battle.experience = state.game.progress.experience;
  state.battle.gold = state.game.progress.gold;
  state.battle.level = state.game.progress.level;

  report.kills += 1;
  report.xp += xp;
  report.gold += gold;
  report.levels.push(...leveledTo);
  for (const item of drops.added) G.incrementReportCount(report.drops, item.name);
  for (const item of drops.ignored) G.incrementReportCount(report.ignoredDrops, item.name);
}

function finalizeOfflineBattleState(zone, report) {
  const now = performance.now();
  const player = state.battle.player;
  if (!player) return;

  state.showEnemies = true;
  state.battle.running = player.hp > 0;
  state.battle.returnToStandAt = 0;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.activeSkill = "None";
  state.battle.activeSkillAtlas = null;
  state.battle.activeWizardSpell = null;
  state.battle.activeWizardSpellAtlas = null;
  state.battle.activeTaoSpell = null;
  state.battle.activeTaoSpellAtlas = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;

  if (player.hp <= 0 || report.diedAtMs) {
    dismissTaoistPet();
    player.hp = 0;
    state.battle.phase = "idle";
    state.battle.nextPlayerAttackAt = 0;
    state.battle.nextEnemyAttackAt = 0;
    G.setPlayerAction("die", now);
    return;
  }

  const enemy = report.finalEnemy?.hp > 0
    ? report.finalEnemy
    : { ...randomZoneEnemyTemplate(zone), hp: undefined, mp: undefined };
  if (!(report.finalEnemy?.hp > 0)) dismissTaoistPet();
  enemy.hp = enemy.hp ?? enemy.maxHp;
  enemy.mp = enemy.mp ?? enemy.maxMp;
  enemy.poisons = Array.isArray(enemy.poisons) ? enemy.poisons : [];
  state.battle.enemy = enemy;
  state.battle.enemyId = enemy.id;
  state.battle.enemyAggro = Boolean(report.finalEnemy?.hp > 0);
  state.battle.phase = report.finalEnemy?.hp > 0 ? "engaged" : "advance";
  state.battle.playerX = 0;
  state.battle.enemyX = report.finalEnemy?.hp > 0 ? G.playerAttackRange() : G.enemySpawnDistance();
  if (report.finalEnemy?.hp > 0 && state.battle.taoPet?.active) {
    if (G.enemyUsesFixedArenaSpawn()) {
      G.placeTaoistCombatPet(state.battle.taoPet);
    } else {
      state.battle.enemyX = Math.max(LANE.aggroRange, state.battle.enemyX);
      state.battle.taoPet.worldX = G.taoistPetSummonWorldX();
    }
  }
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  state.battle.travelStartedAt = now;
  state.battle.travelStartedX = state.battle.playerX;
  state.battle.nextPlayerAttackAt = report.finalEnemy?.hp > 0 ? now + G.playerAttackDelayMs(now) : 0;
  state.battle.nextEnemyAttackAt = report.finalEnemy?.hp > 0 ? now + Math.max(1, Number(enemy.attackMs) || 2500) : 0;
  state.enemy.index = enemy.monsterIndex;
  state.enemy.action = "standing";
  state.enemy.frame = 0;
  state.enemy.oneShot = false;
  state.enemy.lastTick = now;
  G.setPlayerAction(report.finalEnemy?.hp > 0 ? "stance" : "walking", now);
}

function closeOfflineReport() {
  state.game.offlineReport = null;
  G.renderOfflineReport();
}

function flushPrototypeStats(reason = "session-end") {
  if (!G.prototypeStatsCanSubmit()) return false;
  const snapshot = G.prototypeStatsSnapshot();
  const payloadHash = JSON.stringify(snapshot);
  if (payloadHash === state.prototypeStats.lastPayloadHash) return false;
  const payload = JSON.stringify({
    ...snapshot,
    reason,
    submittedAt: new Date().toISOString(),
  });
  if (!navigator.sendBeacon) {
    void G.submitPrototypeStats(reason);
    return true;
  }
  const sent = navigator.sendBeacon(state.prototypeStats.endpoint, new Blob([payload], { type: "application/json" }));
  if (sent) {
    state.prototypeStats.lastPayloadHash = payloadHash;
    state.prototypeStats.lastSubmittedAt = performance.now();
  }
  return sent;
}

function acceptPrototypeStatsNotice() {
  state.settings.prototypeStatsNoticeVersion = STATS_NOTICE_VERSION;
  G.saveGameState(true);
  G.renderPrototypeStatsNotice();
  sceneSignature = "";
  G.renderSceneOverlay();
  void G.submitPrototypeStats("notice-accepted");
}

function disablePrototypeStatsFromNotice() {
  state.settings.prototypeStatsEnabled = false;
  state.settings.prototypeStatsNoticeVersion = STATS_NOTICE_VERSION;
  state.prototypeStats.statusText = "Anonymous progress tracking disabled.";
  G.saveGameState(true);
  G.renderPrototypeStatsNotice();
  sceneSignature = "";
  G.renderSceneOverlay();
}

function acceptPrototypeResetNotice() {
  state.settings.prototypeResetNoticeVersion = PROTOTYPE_RESET_NOTICE_VERSION;
  state.settings.prototypeResetNoticeLastSeenAt = Date.now();
  G.saveGameState(true);
  G.renderPrototypeStatsNotice();
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatBossRespawnDelay(minutes) {
  const value = Math.max(0, Math.trunc(Number(minutes) || 0));
  if (value >= 60 && value % 60 === 0) {
    const hours = value / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${value} minute${value === 1 ? "" : "s"}`;
}

function canAffordAccountUpgrade(upgrade) {
  if (upgrade?.planned) return false;
  if (G.accountUpgradeIsMaxed(upgrade)) return false;
  if (G.accountUpgradeUsesRebirthPoints(upgrade)) {
    const cost = G.accountUpgradeRebirthCost(upgrade);
    return cost != null && G.accountRebirthPoints() >= cost;
  }
  if (state.inventory.gold < G.accountUpgradeGoldCost(upgrade)) return false;
  return G.accountUpgradeItemCosts(upgrade)
    .every((cost) => G.inventoryItemQuantity(cost.itemId) >= cost.quantity);
}

function activeUpgradeCategory() {
  return ACCOUNT_UPGRADE_CATEGORIES.find((category) => category.id === G.normalizeUpgradeCategory(state.upgradeCategory))
    ?? ACCOUNT_UPGRADE_CATEGORIES[0];
}

function categoryUpgradeCountText(categoryId) {
  const upgrades = G.accountUpgradesForCategory(categoryId);
  const real = upgrades.filter((upgrade) => !upgrade.planned);
  if (!real.length) return "Planned";
  const totalTiers = real.reduce((sum, upgrade) => sum + G.accountUpgradeTier(upgrade.id), 0);
  if (real.some((upgrade) => !Number.isFinite(G.accountUpgradeMaxTier(upgrade)))) {
    return totalTiers > 0 ? `${totalTiers} bought` : "0 bought";
  }
  const maxed = real.filter((upgrade) => G.accountUpgradeIsMaxed(upgrade)).length;
  return `${maxed}/${real.length}`;
}

function createOreInventoryEntry(itemId, purity) {
  const item = G.itemDefinition(itemId);
  if (!item || !G.isOreItem(item)) return G.createInventoryEntry(itemId, 1);
  const maxPurity = Math.max(1, Math.floor(G.itemDefinitionMaxDura(item) / ORE_PURITY_UNIT));
  const purityClamped = Math.max(1, Math.min(maxPurity, Math.trunc(Number(purity) || 1)));
  return G.createInventoryEntry(itemId, 1, { currentDura: purityClamped * ORE_PURITY_UNIT });
}

function discardWeaponRefineStagedEntry(entryId) {
  if (!G.weaponRefineStagedRecord(entryId)) return false;
  delete state.weaponRefine.stagedEntries[entryId];
  return true;
}

function clearWeaponRefineResultFxTimer() {
  if (state.weaponRefine?.resultFxTimer != null) {
    window.clearTimeout(state.weaponRefine.resultFxTimer);
    state.weaponRefine.resultFxTimer = null;
  }
}

function canPlaceWeaponRefineWeapon(entry, item) {
  if (!entry || !item || item.slot !== "weapon") return false;
  if (!G.isWeaponRefineStagedEntry(entry.id) && (G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id))) return false;
  const used = G.weaponRefineUsedEntryIds();
  if (used.has(entry.id) && state.weaponRefine.weaponEntryId !== entry.id) return false;
  if (G.sanitizeWeaponRefineLevel(entry.weaponRefineLevel) >= WEAPON_REFINE_MAX) return false;
  return true;
}

function canPlaceWeaponRefineOre(entry, item, targetIndex = -1) {
  if (!entry || !item || item.id !== REFINER_ORE_ITEM_ID) return false;
  if (!G.isWeaponRefineStagedEntry(entry.id) && (G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id))) return false;
  if (state.weaponRefine.weaponEntryId === entry.id) return false;
  if (state.weaponRefine.materialEntryIds.includes(entry.id)) return false;
  const oreIndex = state.weaponRefine.oreEntryIds.indexOf(entry.id);
  if (oreIndex >= 0 && oreIndex !== targetIndex) return true;
  return !G.usedWeaponRefineEntryOnOtherBoardSlot(entry.id, "ore", targetIndex);
}

function canPlaceWeaponRefineMaterial(entry, item, targetIndex = -1) {
  if (!entry || !G.isRefineJewelleryItem(item)) return false;
  if (!G.isWeaponRefineStagedEntry(entry.id) && (G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id))) return false;
  if (state.weaponRefine.weaponEntryId === entry.id) return false;
  if (state.weaponRefine.oreEntryIds.includes(entry.id)) return false;
  const materialIndex = state.weaponRefine.materialEntryIds.indexOf(entry.id);
  if (materialIndex >= 0 && materialIndex !== targetIndex) return true;
  return !G.usedWeaponRefineEntryOnOtherBoardSlot(entry.id, "material", targetIndex);
}

function clearWeaponRefineSlot(kind, index = 0, { targetSlot = null } = {}) {
  const board = state.weaponRefine;
  let entryId = null;
  if (kind === "weapon") entryId = board.weaponEntryId;
  else if (kind === "ore") entryId = board.oreEntryIds[index] ?? null;
  else if (kind === "material") entryId = board.materialEntryIds[index] ?? null;

  if (kind === "weapon") board.weaponEntryId = null;
  else if (kind === "ore") board.oreEntryIds[index] = null;
  else if (kind === "material") board.materialEntryIds[index] = null;

  if (entryId) G.unstageWeaponRefineEntry(entryId, targetSlot);
  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.playSfx("ui.button", { volume: 0.28, throttleMs: 80 });
}

function handleWeaponRefineSlotClick(kind, index = 0) {
  if (kind !== "weapon") return;
  const slotIndex = Math.max(0, Math.trunc(Number(index) || 0));
  const { entry } = G.weaponRefineSlotEntry(kind, slotIndex);
  const picker = state.weaponRefine.picker;
  const isSelected = picker?.kind === kind && picker.index === slotIndex;
  if (entry && isSelected) {
    clearWeaponRefineSlot(kind, slotIndex);
    return;
  }
  G.selectWeaponRefineSlot(kind, slotIndex);
}

function assignWeaponRefineSlot(kind, index, entryId, { fromRefine = null } = {}) {
  const slotIndex = Math.max(0, Math.trunc(Number(index) || 0));
  const entry = G.weaponRefineEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return false;

  if (kind === "weapon") {
    if (!canPlaceWeaponRefineWeapon(entry, item)) return false;
  } else if (kind === "ore") {
    if (!canPlaceWeaponRefineOre(entry, item, slotIndex)) return false;
  } else if (kind === "material") {
    if (!canPlaceWeaponRefineMaterial(entry, item, slotIndex)) return false;
  } else {
    return false;
  }

  const board = state.weaponRefine;
  if (!G.isWeaponRefineStagedEntry(entryId) && !G.stageWeaponRefineEntry(entry)) return false;

  let occupiedEntryId = null;
  if (kind === "weapon") occupiedEntryId = board.weaponEntryId;
  else if (kind === "ore") occupiedEntryId = board.oreEntryIds[slotIndex] ?? null;
  else if (kind === "material") occupiedEntryId = board.materialEntryIds[slotIndex] ?? null;
  if (occupiedEntryId && occupiedEntryId !== entryId) {
    if (kind === "weapon") board.weaponEntryId = null;
    else if (kind === "ore") board.oreEntryIds[slotIndex] = null;
    else board.materialEntryIds[slotIndex] = null;
    G.unstageWeaponRefineEntry(occupiedEntryId);
  }

  if (fromRefine?.kind === "ore") board.oreEntryIds[fromRefine.index] = null;
  if (fromRefine?.kind === "material") board.materialEntryIds[fromRefine.index] = null;

  const prevOre = board.oreEntryIds.indexOf(entryId);
  if (prevOre >= 0 && (kind !== "ore" || prevOre !== slotIndex)) board.oreEntryIds[prevOre] = null;
  const prevMaterial = board.materialEntryIds.indexOf(entryId);
  if (prevMaterial >= 0 && (kind !== "material" || prevMaterial !== slotIndex)) {
    board.materialEntryIds[prevMaterial] = null;
  }
  if (board.weaponEntryId === entryId && kind !== "weapon") board.weaponEntryId = null;

  if (kind === "weapon") board.weaponEntryId = entryId;
  else if (kind === "ore") board.oreEntryIds[slotIndex] = entryId;
  else board.materialEntryIds[slotIndex] = entryId;

  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.playSfx("ui.button", { volume: 0.35, throttleMs: 80 });
  return true;
}

function assignWeaponRefinePick(entryId) {
  const picker = state.weaponRefine.picker;
  if (!picker || picker.kind !== "weapon") return false;
  return assignWeaponRefineSlot("weapon", 0, entryId);
}

function collectWeaponRefineIngredients() {
  const board = state.weaponRefine;
  const weaponEntry = board.weaponEntryId ? G.weaponRefineEntryById(board.weaponEntryId) : null;
  const weaponItem = weaponEntry ? G.itemDefinition(weaponEntry.itemId) : null;
  let totalDC = 0;
  let totalMC = 0;
  let totalSC = 0;
  let itemAmount = 0;
  let totalOrePurity = 0;
  let oreAmount = 0;

  for (const { entry, item } of G.weaponRefineBoardEntries("material")) {
    const stats = G.itemEntryStats(entry, item);
    const dc = G.refineOffensiveStatSum(stats, "dc");
    const mc = G.refineOffensiveStatSum(stats, "mc");
    const sc = G.refineOffensiveStatSum(stats, "sc");
    if (dc <= 0 && mc <= 0 && sc <= 0) continue;
    totalDC += dc;
    totalMC += mc;
    totalSC += sc;
    itemAmount += 1;
  }

  for (const { entry, item } of G.weaponRefineBoardEntries("ore")) {
    totalOrePurity += G.orePurity(entry, item);
    oreAmount += 1;
  }

  return {
    weaponEntry,
    weaponItem,
    totalDC,
    totalMC,
    totalSC,
    itemAmount,
    orePurity: totalOrePurity,
    oreAmount,
  };
}

function computeWeaponRefineChance(ingredients = collectWeaponRefineIngredients()) {
  const {
    weaponEntry,
    weaponItem,
    totalDC,
    totalMC,
    totalSC,
    itemAmount,
    orePurity,
    oreAmount,
  } = ingredients;

  if (!weaponEntry || !weaponItem || itemAmount <= 0 || oreAmount <= 0) {
    return {
      chance: 0,
      statKey: null,
      statValue: 0,
      autoFail: true,
      reason: "Need at least one black iron ore and one jewellery item with DC, MC, or SC.",
    };
  }

  const { key: statKey, value: refineStat } = G.pickWeaponRefineStatKey(totalDC, totalMC, totalSC);
  if (!statKey || refineStat <= 0) {
    return {
      chance: 0,
      statKey: null,
      statValue: 0,
      autoFail: true,
      reason: "Jewellery must contribute DC, MC, or SC.",
    };
  }

  const itemSuccess = G.weaponRefineItemSuccessFromStat(refineStat);
  const oreSuccess = Math.min(
    WEAPON_REFINE_ORE_SUCCESS_CAP,
    (oreAmount * WEAPON_REFINE_ORE_PER_PIECE) + (orePurity * WEAPON_REFINE_PURITY_PER_POINT),
  );

  const penalty = G.weaponRefineExistingStatPenalty(weaponEntry);
  const chance = Math.max(
    0,
    Math.min(
      WEAPON_REFINE_MAX_CHANCE,
      Math.round(itemSuccess + oreSuccess - penalty),
    ),
  );

  return {
    chance,
    statKey,
    statValue: refineStat,
    autoFail: false,
    itemSuccess,
    oreSuccess,
    penalty,
    oreAmount,
    itemAmount,
    orePurity,
  };
}

function chargeWeaponRefineGold(cost) {
  const amount = Math.max(0, Math.trunc(Number(cost) || 0));
  if (state.inventory.gold < amount) return false;
  state.inventory.gold -= amount;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.inventory.gold;
  return true;
}

function consumeWeaponRefineStagedMaterials() {
  const board = state.weaponRefine;
  const consumed = new Set();
  for (const entryId of [...board.oreEntryIds, ...board.materialEntryIds]) {
    if (!entryId || consumed.has(entryId)) continue;
    consumed.add(entryId);
    discardWeaponRefineStagedEntry(entryId);
  }
  board.oreEntryIds = Array(WEAPON_REFINE_ORE_SLOTS).fill(null);
  board.materialEntryIds = Array(WEAPON_REFINE_MATERIAL_SLOTS).fill(null);
}

function applyWeaponRefineSuccess(weaponEntry, statKey, amount) {
  weaponEntry.bonusStats = G.sanitizeItemBonusStats(weaponEntry.bonusStats);
  weaponEntry.bonusStats[statKey][1] += Math.max(1, Math.trunc(Number(amount) || 1));
  weaponEntry.weaponRefineLevel = G.sanitizeWeaponRefineLevel(
    G.sanitizeWeaponRefineLevel(weaponEntry.weaponRefineLevel) + 1,
  );
}

function finalizeWeaponRefineOutcome({
  success,
  crit,
  preview,
  weaponEntryId,
  weaponEntry,
  weaponItem,
  weaponName,
  statLabel,
  statGain,
}) {
  consumeWeaponRefineStagedMaterials();
  state.weaponRefine.weaponEntryId = null;
  state.weaponRefine.resultFx = null;
  state.weaponRefine.resultFxTimer = null;

  if (success) {
    applyWeaponRefineSuccess(weaponEntry, preview.statKey, statGain);
    G.unstageWeaponRefineEntry(weaponEntryId);
    const critNote = crit ? " Critical success!" : "";
    G.pushBattleLog(`${weaponName} refined: +${statGain} ${statLabel}.${critNote}`);
    addLootNotice(`${weaponItem.name} +${statGain} ${statLabel}`, "item");
  } else {
    discardWeaponRefineStagedEntry(weaponEntryId);
    G.pushBattleLog(`${weaponName} shattered during refining (${preview.chance}% chance).`);
  }

  hideItemTooltip();
  applyEquippedStatsToBattlePlayer();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  playerHudSignature = "";
  G.saveGameState(true);
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderPlayerResourceHud();
}

function attemptWeaponRefine() {
  if (G.weaponRefineResultFxActive()) return false;
  if (!G.weaponRefineBoardReady()) {
    G.pushBattleLog("Place a weapon on the refine table first.");
    return false;
  }

  const weaponEntryId = state.weaponRefine.weaponEntryId;
  const weaponEntry = G.weaponRefineEntryById(weaponEntryId);
  const weaponItem = weaponEntry ? G.itemDefinition(weaponEntry.itemId) : null;
  if (!weaponEntry || !weaponItem || weaponItem.slot !== "weapon") {
    G.pushBattleLog("The selected weapon is no longer available.");
    G.resetWeaponRefineState();
    sceneSignature = "";
    gamePanelSignature = "";
    G.renderSceneOverlay();
    G.renderGamePanel();
    return false;
  }
  if (G.sanitizeWeaponRefineLevel(weaponEntry.weaponRefineLevel) >= WEAPON_REFINE_MAX) {
    G.pushBattleLog(`${G.itemDisplayName(weaponItem, weaponEntry)} is already at refine +${WEAPON_REFINE_MAX}.`);
    return false;
  }

  const preview = computeWeaponRefineChance(collectWeaponRefineIngredients());
  if (preview.autoFail) {
    G.pushBattleLog(preview.reason);
    return false;
  }

  const goldCost = G.weaponRefineGoldCost(weaponEntry);
  if (!chargeWeaponRefineGold(goldCost)) {
    G.pushBattleLog(`Need ${goldCost.toLocaleString()} gold to refine ${G.itemDisplayName(weaponItem, weaponEntry)}.`);
    battlePanelSignature = "";
    playerHudSignature = "";
    G.renderBattlePanel();
    G.renderPlayerResourceHud();
    return false;
  }
  G.playSfx("ui.gold", { volume: 0.42, throttleMs: 120 });

  const weaponName = G.itemDisplayName(weaponItem, weaponEntry);
  const statLabel = G.smithStatLabel(preview.statKey);
  const success = G.rollWeaponRefineSuccess(preview.chance);
  const crit = success && G.rollWeaponRefineCrit();
  const statGain = crit
    ? WEAPON_REFINE_STAT_INCREASE * WEAPON_REFINE_CRIT_MULTIPLIER
    : WEAPON_REFINE_STAT_INCREASE;

  G.playWeaponRefineResultFx(success, crit);
  G.playWeaponRefineResultSfx(success, crit);
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  playerHudSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderPlayerResourceHud();

  state.weaponRefine.resultFxTimer = window.setTimeout(() => {
    finalizeWeaponRefineOutcome({
      success,
      crit,
      preview,
      weaponEntryId,
      weaponEntry,
      weaponItem,
      weaponName,
      statLabel,
      statGain,
    });
  }, WEAPON_REFINE_RESULT_FX_MS);

  return success;
}

function buyShopItem(itemId, quantity = 1) {
  const item = G.itemDefinition(itemId);
  const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const unitPrice = G.itemBuyValue(item, 1);
  if (!item || unitPrice <= 0) return false;

  const affordableQuantity = Math.floor(state.inventory.gold / unitPrice);
  if (affordableQuantity <= 0) {
    G.pushBattleLog(`Need ${unitPrice} gold to buy ${item.name}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const capacity = G.availablePurchaseCapacityForItem(item);
  if (capacity <= 0) {
    G.pushBattleLog(`No bag space for ${item.name}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const buyQuantity = Math.min(requestedQuantity, affordableQuantity, capacity);
  const beforeQuantity = G.inventoryQuantityForItem(item.id);
  if (G.isPotionItem(item)) {
    const hotbarPlacement = G.addPurchasedPotionsToHotbarFirst(item.id, buyQuantity);
    if (hotbarPlacement.remaining > 0) G.addInventoryItem(item.id, hotbarPlacement.remaining);
  } else {
    G.addInventoryItem(item.id, buyQuantity);
  }
  const addedQuantity = Math.max(0, G.inventoryQuantityForItem(item.id) - beforeQuantity);
  if (addedQuantity <= 0) {
    G.pushBattleLog(`No bag space for ${item.name}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const value = G.itemBuyValue(item, addedQuantity);
  state.inventory.gold -= value;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.game.progress.gold;
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  G.pushBattleLog(`Bought ${addedQuantity > 1 ? `${addedQuantity}x ` : ""}${item.name} for ${value} gold.`);
  hideItemTooltip();
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

function compareSmithCombineEntries(a, b, item) {
  const priorityA = G.smithCombineEntryPriority(a, item);
  const priorityB = G.smithCombineEntryPriority(b, item);
  for (let index = 0; index < priorityA.length; index += 1) {
    if (priorityB[index] !== priorityA[index]) return priorityB[index] - priorityA[index];
  }
  return a.id.localeCompare(b.id);
}

function canSmithCombineItem(item) {
  return Boolean(item) && !G.isStackableItem(item) && !G.isBookItem(item) && !G.isPotionItem(item) && G.isEquipableItem(item) && G.smithUpgradeStat(null, item);
}

function combineSmithItem(entryId) {
  const option = G.smithCombineOptions().find((candidate) => candidate.target.id === entryId);
  if (!option) {
    G.pushBattleLog("The Smith needs two matching equipment items.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  if (G.smithCombineWouldConsumeBetterItem(option.target, option.material, option.item)) {
    G.pushBattleLog("Combine blocked: the selected item is not the best copy to keep.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const chance = G.smithCombineSuccessChance(option.target);
  const success = Math.random() < chance;
  const materialName = G.itemDisplayName(option.item, option.material);
  G.removeInventoryEntry(option.material.id, 1);

  if (success) {
    const stat = G.resolveSmithCombineStat(option);
    applySmithStatUpgrade(option.target, stat);
    G.playSfx("item.equip.weapon", { volume: 0.42, throttleMs: 80 });
    G.pushBattleLog(`${G.itemDisplayName(option.item, option.target)} improved: +1 ${stat.label}.`);
    addLootNotice(`${option.item.name} +1 ${stat.label}`, "item");
  } else {
    G.playSfx("item.move", { volume: 0.38, throttleMs: 80 });
    G.pushBattleLog(`${materialName} was consumed, but the combine failed.`);
  }

  hideItemTooltip();
  applyEquippedStatsToBattlePlayer();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  playerHudSignature = "";
  G.saveGameState(true);
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderPlayerResourceHud();
  return success;
}

function applySmithStatUpgrade(entry, stat) {
  entry.bonusStats = G.sanitizeItemBonusStats(entry.bonusStats);
  if (stat.range) {
    entry.bonusStats[stat.key][stat.index] += 1;
  } else {
    entry.bonusStats[stat.key] += 1;
  }
  entry.refineLevel = Math.max(0, Math.trunc(Number(entry.refineLevel) || 0)) + 1;
}

function gemCurrentStatCount(gemDef, entry, item) {
  if (gemDef.durabilityBonus > 0) {
    const baseMax = G.itemDefinitionMaxDura(item);
    const maxDura = Math.trunc(Number(entry.maxDura) || baseMax);
    return Math.max(0, Math.floor((maxDura - baseMax) / 1000));
  }
  const stat = gemDef.stat;
  if (!stat) return 0;
  const bonus = G.sanitizeItemBonusStats(entry.bonusStats);
  if (stat.range) return Math.trunc(Number(bonus[stat.key]?.[stat.index]) || 0);
  return Math.trunc(Number(bonus[stat.key]) || 0);
}

function gemUpgradeSuccessChancePercent(gemItem, targetEntry, targetItem) {
  const gem = gemItem.gem;
  if (!gem) return 0;
  let penalty = Math.max(0, Math.trunc(Number(gem.reflect) || 0));
  if (GEM_STAT_INDEPENDENT && (gem.stat || gem.durabilityBonus > 0)) {
    penalty *= gemCurrentStatCount(gem, targetEntry, targetItem);
  } else {
    penalty *= Math.max(0, Math.trunc(Number(targetEntry.gemCount) || 0));
  }
  const criticalRate = Math.max(0, Math.trunc(Number(gem.criticalRate) || 0));
  if (penalty >= criticalRate) return 0;
  return Math.max(0, Math.min(100, criticalRate - penalty));
}

function gemUpgradeStatLabel(gemDef) {
  if (gemDef.durabilityBonus > 0) return "Max Dura";
  const stat = gemDef.stat;
  if (!stat) return "Stat";
  if (stat.range) return G.smithStatLabel(stat.key);
  return {
    accuracy: "Acc",
    agility: "Agi",
    attackSpeed: "A Speed",
    poisonAttack: "Poison",
    freezing: "Freezing",
    magicResist: "Magic Resist",
    poisonResist: "Poison Resist",
    hp: "HP",
    mp: "MP",
    luck: "Luck",
    healthRecovery: "HP Recovery",
    poisonRecovery: "Poison Recovery",
    strong: "Strong",
  }[stat.key] ?? stat.key;
}

function canApplyGemToEntry(gemEntryId, targetEntryId) {
  const gemEntry = G.inventoryEntryById(gemEntryId);
  const targetEntry = G.inventoryEntryById(targetEntryId);
  if (!gemEntry || !targetEntry || gemEntry.id === targetEntry.id) {
    return { ok: false, reason: "Invalid items." };
  }
  const gemItem = G.itemDefinition(gemEntry.itemId);
  const targetItem = G.itemDefinition(targetEntry.itemId);
  if (!G.isGemUpgradeItem(gemItem)) return { ok: false, reason: "That item is not a gem or orb." };
  if (!G.isEquipableItem(targetItem)) return { ok: false, reason: "Gems can only upgrade equipment." };
  if (!G.validGemForEquipItem(gemItem, targetItem)) {
    return { ok: false, reason: "This gem cannot upgrade that equipment type." };
  }
  const gem = gemItem.gem;
  const gemUses = Math.max(0, Math.trunc(Number(targetEntry.gemCount) || 0));
  if (gemUses >= gem.criticalDamage) {
    return { ok: false, reason: "Item has reached maximum gem upgrades." };
  }
  const statCount = gemCurrentStatCount(gem, targetEntry, targetItem);
  if (statCount >= gem.maxStatCount) {
    return { ok: false, reason: "Item has reached the stat cap for this gem type." };
  }
  return {
    ok: true,
    gemItem,
    targetItem,
    gemEntry,
    targetEntry,
    chance: gemUpgradeSuccessChancePercent(gemItem, targetEntry, targetItem) / 100,
  };
}

function applyGemStatUpgrade(entry, item, gemDef) {
  if (gemDef.durabilityBonus > 0) {
    const baseMax = G.itemDefinitionMaxDura(item);
    entry.maxDura = Math.min(
      65535,
      Math.max(1, Math.trunc(Number(entry.maxDura) || baseMax)) + gemDef.durabilityBonus,
    );
    if (entry.currentDura != null) {
      entry.currentDura = Math.min(Math.trunc(Number(entry.currentDura) || 0), entry.maxDura);
    }
    return;
  }
  const stat = gemDef.stat;
  if (!stat) return;
  entry.bonusStats = G.sanitizeItemBonusStats(entry.bonusStats);
  if (stat.range) {
    entry.bonusStats[stat.key][stat.index] += stat.amount;
  } else {
    entry.bonusStats[stat.key] += stat.amount;
  }
}

function applyGemUpgrade(gemEntryId, targetEntryId) {
  const check = canApplyGemToEntry(gemEntryId, targetEntryId);
  if (!check.ok) {
    G.pushBattleLog(check.reason);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const { gemItem, targetItem, gemEntry, targetEntry, chance } = check;
  const gemDef = gemItem.gem;
  const targetName = G.itemDisplayName(targetItem, targetEntry);
  const gemName = G.itemDisplayName(gemItem, gemEntry);
  G.removeInventoryEntry(gemEntry.id, 1);

  const success = Math.random() < chance;
  if (success) {
    applyGemStatUpgrade(targetEntry, targetItem, gemDef);
    targetEntry.gemCount = Math.max(0, Math.trunc(Number(targetEntry.gemCount) || 0)) + 1;
    const statLabel = gemUpgradeStatLabel(gemDef);
    const amount = gemDef.durabilityBonus > 0 ? gemDef.durabilityBonus : (gemDef.stat?.amount ?? 1);
    G.playSfx("item.equip.weapon", { volume: 0.42, throttleMs: 80 });
    G.pushBattleLog(`${targetName} upgraded with ${gemName}: +${amount} ${statLabel}.`);
    addLootNotice(`${targetItem.name} gem upgrade`, "item");
  } else if (gemDef.kind === "gem" && Math.random() < GEM_FAIL_DESTROY_CHANCE) {
    if (G.isEquippedEntry(targetEntry.id)) {
      for (const slotId of Object.keys(state.inventory.equipment)) {
        if (state.inventory.equipment[slotId] === targetEntry.id) delete state.inventory.equipment[slotId];
      }
    }
    G.removeInventoryEntry(targetEntry.id, 1);
    G.playSfx("item.move", { volume: 0.38, throttleMs: 80 });
    G.pushBattleLog(`${gemName} failed and destroyed ${targetName}.`);
  } else {
    G.playSfx("item.move", { volume: 0.38, throttleMs: 80 });
    G.pushBattleLog(`${gemName} had no effect on ${targetName}.`);
  }

  hideItemTooltip();
  applyEquippedStatsToBattlePlayer();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  playerHudSignature = "";
  G.saveGameState(true);
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderPlayerResourceHud();
  return success;
}

function bookItemsForSpell(spellId) {
  const items = Array.isArray(state.itemData?.items) ? state.itemData.items : [];
  return items.filter((item) => {
    if (!G.isBookItem(item)) return false;
    const bookSpellId = item.spell?.id ?? G.magicSpellByShape(item.spell?.shape)?.id;
    return bookSpellId === spellId;
  });
}

function clearQueuedCombatSpell(spellId = null) {
  if (!spellId || state.battle.queuedCombatSpellId === spellId) {
    state.battle.queuedCombatSpellId = null;
  }
}

function adjustedKillExperience(amount, playerLevel, monsterLevel) {
  return crystalAdjustedExperience(
    amount,
    playerLevel,
    monsterLevel,
    true,
    G.rebirthExperienceRate() * TESTING_XP_MULTIPLIER,
  );
}

function applyRebirthUpgradeStats(stats) {
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    const bonus = G.rebirthStatUpgradeBonus(key);
    if (bonus > 0) {
      stats[key][0] += bonus;
      stats[key][1] += bonus;
    }
  }
  stats.accuracy += G.rebirthStatUpgradeBonus("accuracy");
  stats.agility += G.rebirthStatUpgradeBonus("agility");
  stats.luck += G.accountUpgradeValue("baseLuck");
}

function autoCastSlotLimit() {
  return BASE_AUTOCAST_SLOTS + G.accountUpgradeValue("autocastSlots");
}

function autoPotionSlotLimit() {
  return Math.min(HOTBAR_SLOT_COUNT, BASE_AUTO_POTION_SLOTS + G.accountUpgradeValue("autoPotionSlots"));
}

function autoPotionSlots() {
  return Array.from({ length: autoPotionSlotLimit() }, (_, slot) => slot);
}

function autoCastPriorityForClass(classId, spell) {
  if (classId === "Wizard") return G.wizardAutoPriority(spell);
  if (classId === "Taoist") return G.taoistAutoPriority(spell);
  if (classId === "Warrior") return G.warriorAutoPriority(spell);
  return 0;
}

function autoCastSlotsUsed(classId = state.battle.combatClass) {
  return G.normalizeAutoCastSpellsForClass(classId).length;
}

function activeWizardAutoSpells() {
  return G.normalizeWizardAutoSpells();
}

function activeWizardAutoSpell() {
  return activeWizardAutoSpells()[0] ?? null;
}

function clearTwinDrakeChargeState(target) {
  if (!target) return;
  target.twinDrakeReady = false;
  target.twinDrakeReadyAt = 0;
  target.twinDrakeChargeFxStartedAt = 0;
  target.twinDrakeChargeFxUntil = 0;
}

function clearFlamingSwordChargeState(target) {
  if (!target) return;
  target.flamingSwordReady = false;
  target.flamingSwordReadyAt = 0;
  target.flamingSwordExpiresAt = 0;
}

function applyFlamingSwordChargeState(target, now) {
  if (!target) return;
  const windowMs = Number(warriorSpellById("FlamingSword")?.toggleWindowMs) || 10000;
  target.flamingSwordReady = true;
  target.flamingSwordReadyAt = now;
  target.flamingSwordExpiresAt = now + windowMs;
}

function applyTwinDrakeChargeState(target, now) {
  if (!target) return;
  target.twinDrakeReady = true;
  target.twinDrakeReadyAt = now;
  beginTwinDrakeChargeFx(target, now);
}

function cancelWarriorCharge(spellId) {
  if (spellId === "TwinDrakeBlade" && G.warriorTwinDrakeReady()) {
    clearTwinDrakeChargeState(state.battle);
    if (state.battle.bossParty?.active) clearTwinDrakeChargeState(G.bossPartyControlledMember());
    clearQueuedCombatSpell("TwinDrakeBlade");
    return true;
  }
  if (spellId === "FlamingSword" && G.warriorFlamingSwordReady()) {
    clearFlamingSwordChargeState(state.battle);
    if (state.battle.bossParty?.active) clearFlamingSwordChargeState(G.bossPartyControlledMember());
    clearQueuedCombatSpell("FlamingSword");
    return true;
  }
  return false;
}

function cancelWarriorTwinDrakeCharge() {
  if (!cancelWarriorCharge("TwinDrakeBlade")) return false;
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  return true;
}

function ensureInventorySlots() {
  G.syncInventoryCapacity();
  const used = new Set();
  for (const entry of state.inventory.items) {
    if (G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id)) {
      entry.slot = null;
      continue;
    }
    if (Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < state.inventory.maxSlots && !used.has(entry.slot)) {
      used.add(entry.slot);
      continue;
    }
    entry.slot = null;
  }
  for (const entry of state.inventory.items) {
    if (G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id)) continue;
    if (entry.slot !== null) continue;
    for (let slot = 0; slot < state.inventory.maxSlots; slot++) {
      if (used.has(slot)) continue;
      entry.slot = slot;
      used.add(slot);
      break;
    }
  }
}

function carriedInventoryEntries() {
  return state.inventory.items.filter((entry) => !G.isEquippedEntry(entry.id));
}

function ensureStorageSlots(storage = state.account.storage) {
  G.syncStorageCapacity(storage);
  const used = new Set();
  for (const entry of storage.items ?? []) {
    if (Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < storage.maxSlots && !used.has(entry.slot)) {
      used.add(entry.slot);
      continue;
    }
    entry.slot = null;
  }
  for (const entry of storage.items ?? []) {
    if (entry.slot !== null) continue;
    for (let slot = 0; slot < storage.maxSlots; slot++) {
      if (used.has(slot)) continue;
      entry.slot = slot;
      used.add(slot);
      break;
    }
  }
}

function allocateInventoryEntryId() {
  let id;
  do {
    id = `item-${state.inventory.nextInstanceId}`;
    state.inventory.nextInstanceId += 1;
  } while (state.inventory.items.some((entry) => entry.id === id));
  return id;
}

function allocateStorageEntryId() {
  let id;
  do {
    id = `storage-item-${state.account.storage.nextInstanceId}`;
    state.account.storage.nextInstanceId += 1;
  } while (state.account.storage.items.some((entry) => entry.id === id));
  return id;
}

function combineInventoryStackEntries(sourceEntryId, targetEntryId) {
  const sourceEntry = G.inventoryEntryById(sourceEntryId);
  const targetEntry = G.inventoryEntryById(targetEntryId);
  if (!G.stackEntriesCombinable(sourceEntry, targetEntry)) {
    G.rejectInventoryMove("Only matching stackable items can be combined.");
    return false;
  }
  if (G.isEquippedEntry(sourceEntryId)) {
    G.rejectInventoryMove("Unequip the item before combining stacks.");
    return false;
  }
  const hotbarChanged = G.hotbarSlotForEntry(sourceEntryId) >= 0;
  G.mergeEntryIntoStack(sourceEntry, targetEntry);
  if (sourceEntry.quantity <= 0) {
    clearHotbarEntry(sourceEntry.id);
    state.inventory.items = state.inventory.items.filter((candidate) => candidate.id !== sourceEntry.id);
  }
  G.renderInventoryStacksChanged({ hotbarChanged });
  return true;
}

function combineStorageStackEntries(sourceEntryId, targetEntryId) {
  const sourceEntry = G.storageEntryById(sourceEntryId);
  const targetEntry = G.storageEntryById(targetEntryId);
  if (!G.stackEntriesCombinable(sourceEntry, targetEntry)) {
    G.rejectInventoryMove("Only matching stackable items can be combined.");
    return false;
  }
  G.mergeEntryIntoStack(sourceEntry, targetEntry);
  if (sourceEntry.quantity <= 0) {
    state.account.storage.items = state.account.storage.items.filter((candidate) => candidate.id !== sourceEntry.id);
  }
  G.renderStorageMove({ playMoveSfx: false });
  G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
  return true;
}

function clearHotbarEntry(entryId) {
  const slot = G.hotbarSlotForEntry(entryId);
  if (slot < 0) return false;
  state.hotbar.slots[slot] = null;
  hotbarSignature = "";
  return true;
}

function canEquipEntryToSlot(entryId, slotId) {
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return { ok: false, reason: "missing item" };
  if (!compatibleEquipmentSlots(item).includes(slotId)) {
    return { ok: false, reason: `${item.name} cannot be equipped to ${G.slotLabel(slotId)}.` };
  }
  const requirement = G.itemRequirementStatus(item);
  if (!requirement.ok) return { ok: false, reason: `Cannot equip ${item.name}: ${requirement.reason}.` };
  return { ok: true, entry, item };
}

function canDropEntryToInventorySlot(entryId, slot, sourceEquipmentSlot = null) {
  ensureInventorySlots();
  const entry = G.inventoryEntryById(entryId);
  if (!entry) return { ok: false, reason: "missing item" };
  if (G.isHotbarEntry(entryId)) {
    const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
    const targetOccupant = G.inventoryEntryAtSlot(targetSlot);
    if (!targetOccupant) return { ok: true };
    if (G.isPotionItem(G.itemDefinition(targetOccupant.itemId))) return { ok: true };
    if (G.inventoryUsedSlots() < state.inventory.maxSlots) return { ok: true };
    return { ok: false, reason: "Cannot move hotbar item: inventory is full." };
  }
  const actualSourceEquipmentSlot = sourceEquipmentSlot && state.inventory.equipment[sourceEquipmentSlot] === entryId
    ? sourceEquipmentSlot
    : G.equippedSlotForEntry(entryId);
  if (!actualSourceEquipmentSlot) return { ok: true };
  const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
  const targetOccupant = G.inventoryEntryAtSlot(targetSlot);
  if (targetOccupant && canEquipEntryToSlot(targetOccupant.id, actualSourceEquipmentSlot).ok) return { ok: true };
  if (G.inventoryUsedSlots() < state.inventory.maxSlots) return { ok: true };
  return { ok: false, reason: "Cannot unequip: inventory is full." };
}

async function dropInventoryEntryToInventorySlot(entryId, slot, sourceEquipmentSlot = null) {
  ensureInventorySlots();
  const entry = G.inventoryEntryById(entryId);
  if (!entry) return;
  const sourceHotbarSlot = G.hotbarSlotForEntry(entryId);
  if (sourceHotbarSlot >= 0) {
    const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
    const targetOccupant = G.inventoryEntryAtSlot(targetSlot);
    if (targetOccupant) {
      if (G.isPotionItem(G.itemDefinition(targetOccupant.itemId))) {
        state.hotbar.slots[sourceHotbarSlot] = targetOccupant.id;
        targetOccupant.slot = null;
      } else if (G.inventoryUsedSlots() < state.inventory.maxSlots) {
        targetOccupant.slot = G.nextFreeInventorySlot();
        state.hotbar.slots[sourceHotbarSlot] = null;
      } else {
        G.rejectInventoryMove("Cannot move hotbar item: inventory is full.");
        return;
      }
    } else {
      state.hotbar.slots[sourceHotbarSlot] = null;
    }
    entry.slot = targetSlot;
    ensureInventorySlots();
    hotbarSignature = "";
    sceneSignature = "";
    gamePanelSignature = "";
    G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
    G.renderHotbar();
    G.renderSceneOverlay();
    G.renderGamePanel();
    return;
  }
  const actualSourceEquipmentSlot = sourceEquipmentSlot && state.inventory.equipment[sourceEquipmentSlot] === entryId
    ? sourceEquipmentSlot
    : G.equippedSlotForEntry(entryId);
  if (!actualSourceEquipmentSlot) {
    G.moveInventoryEntryToSlot(entryId, slot);
    return;
  }

  const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
  const targetOccupant = G.inventoryEntryAtSlot(targetSlot);
  const canEquipTargetToSource = targetOccupant && canEquipEntryToSlot(targetOccupant.id, actualSourceEquipmentSlot).ok;
  const needsExtraInventorySlot = !targetOccupant || !canEquipTargetToSource;
  if (needsExtraInventorySlot && G.inventoryUsedSlots() >= state.inventory.maxSlots) {
    G.rejectInventoryMove("Cannot unequip: inventory is full.");
    return;
  }

  if (targetOccupant && canEquipTargetToSource) {
    state.inventory.equipment[actualSourceEquipmentSlot] = targetOccupant.id;
    targetOccupant.slot = null;
  } else {
    state.inventory.equipment[actualSourceEquipmentSlot] = null;
    if (targetOccupant) targetOccupant.slot = G.nextFreeInventorySlot();
  }
  entry.slot = targetSlot;
  G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
  await applyEquipmentChanges();
}

function canDropEntryToStorageSlot(entryId, slot, sourceContainer = "inventory") {
  ensureStorageSlots();
  const maxSlots = state.account.storage.maxSlots;
  const targetSlot = Math.max(0, Math.min(maxSlots - 1, Number(slot)));
  const targetEntry = G.storageEntryAtSlot(targetSlot);
  const entry = sourceContainer === "storage" ? G.storageEntryById(entryId) : G.inventoryEntryById(entryId);
  if (!entry) return { ok: false, reason: "missing item" };
  if (sourceContainer === "storage") return { ok: true };
  if (!targetEntry || G.sameStackableItem(entry, targetEntry)) return { ok: true };
  return G.nextFreeStorageSlot() < maxSlots
    ? { ok: true }
    : { ok: false, reason: "Storage is full." };
}

function canWithdrawStorageEntryToInventorySlot(entryId, slot) {
  ensureInventorySlots();
  const entry = G.storageEntryById(entryId);
  if (!entry) return { ok: false, reason: "missing item" };
  const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
  const targetEntry = G.inventoryEntryAtSlot(targetSlot);
  if (!targetEntry || G.sameStackableItem(entry, targetEntry)) return { ok: true };
  return G.inventoryUsedSlots() < state.inventory.maxSlots
    ? { ok: true }
    : { ok: false, reason: "Inventory is full." };
}

function canEquipStorageEntryToSlot(entryId, slotId) {
  const entry = G.storageEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return { ok: false, reason: "missing item" };
  if (!compatibleEquipmentSlots(item).includes(slotId)) {
    return { ok: false, reason: `${item.name} cannot be equipped to ${G.slotLabel(slotId)}.` };
  }
  const requirement = G.itemRequirementStatus(item);
  if (!requirement.ok) return { ok: false, reason: `Cannot equip ${item.name}: ${requirement.reason}.` };
  return { ok: true, entry, item };
}

function canDropEntryToHotbarSlot(entryId, slot) {
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item) return { ok: false, reason: "missing item" };
  if (G.isEquippedEntry(entry.id)) return { ok: false, reason: "Equipment cannot be placed on the hotbar." };
  if (!G.isPotionItem(item)) return { ok: false, reason: `${item.name} is not a potion.` };
  if (!Number.isFinite(Number(slot))) return { ok: false, reason: "missing slot" };
  return { ok: true, entry, item };
}

function dropInventoryEntryToHotbarSlot(entryId, slot) {
  ensureInventorySlots();
  const status = canDropEntryToHotbarSlot(entryId, slot);
  if (!status.ok) {
    G.rejectInventoryMove(status.reason);
    return;
  }
  const targetSlot = G.hotbarSlotIndex(slot);
  const entry = status.entry;
  const sourceHotbarSlot = G.hotbarSlotForEntry(entry.id);
  const targetEntryId = state.hotbar.slots[targetSlot] ?? null;
  if (sourceHotbarSlot === targetSlot) return;

  if (sourceHotbarSlot >= 0) {
    state.hotbar.slots[sourceHotbarSlot] = targetEntryId;
    state.hotbar.slots[targetSlot] = entry.id;
  } else {
    const sourceInventorySlot = Number.isInteger(entry.slot) ? entry.slot : G.nextFreeInventorySlot();
    const targetEntry = targetEntryId ? G.inventoryEntryById(targetEntryId) : null;
    state.hotbar.slots[targetSlot] = entry.id;
    entry.slot = null;
    if (targetEntry) targetEntry.slot = sourceInventorySlot;
  }

  ensureInventorySlots();
  hotbarSignature = "";
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
  G.renderHotbar();
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
}

function entryDurabilityPercent(entry, item = null) {
  const resolvedItem = item ?? G.itemDefinition(entry?.itemId);
  if (!G.itemUsesEntryDurability(resolvedItem) || entry?.currentDura == null) return null;
  const maxDura = Math.max(1, Math.trunc(Number(entry.maxDura) || G.itemDefinitionMaxDura(resolvedItem)));
  return Math.max(0, Math.min(100, Math.round((Number(entry.currentDura) / maxDura) * 100)));
}

function completeEnemySpawnReveal(now = performance.now()) {
  if (state.battle.enemyRevealed) return;
  state.battle.enemyRevealed = true;
  state.battle.enemyAggro = true;
  const enemy = state.battle.enemy;
  state.battle.nextEnemyAttackAt = now + Math.max(400, Math.trunc(Number(enemy?.attackMs) || 1400));
  G.pushBattleLog(`${enemy?.name ?? "The boss"} rises from the darkness!`);
}

function applyFixedArenaEnemySpawn(now = performance.now(), options = {}) {
  const enemy = state.battle.enemy;
  if (!G.enemyUsesFixedArenaSpawn(enemy)) return false;
  const spawnX = G.arenaBossSpawnWorldX();
  if (!options.skipPlayerPosition) {
    state.battle.playerX = Math.round(spawnX - BOSS_PARTY_ENEMY_MELEE_GAP);
  }
  state.battle.enemyX = spawnX;
  state.battle.phase = "engaged";
  state.battle.enemyAggro = false;
  state.battle.enemyRevealed = false;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.lockedArenaWorldX = spawnX;
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  state.battle.lockedCameraX = null;
  const party = state.battle.bossParty;
  if (party) {
    party.lastAdvanceAt = now;
    party.lockedCameraX = null;
    party.lockedArenaWorldX = spawnX;
  }
  G.setPlayerAction("stance", now);
  if (enemy.spawnAction === "show" && state.enemy.atlas?.actions?.show) {
    G.setEnemyAction("show", true, now);
  } else {
    G.setEnemyLocomotion("standing", now);
    completeEnemySpawnReveal(now);
  }
  return true;
}

function benedictionBlessChance(weaponLuck) {
  const luck = Math.trunc(Number(weaponLuck) || 0);
  if (luck <= 0) return 1;
  if (luck === 1) return 0.2;
  if (luck === 2 || luck === 3) return 0.1;
  return 0.05;
}

function benedictionOutcomeRates(weaponLuck) {
  const luck = Math.trunc(Number(weaponLuck) || 0);
  if (luck >= BENEDICTION_MAX_WEAPON_LUCK) return { curse: 0, bless: 0, none: 0 };
  const curse = luck > -CRYSTAL_MAX_LUCK ? BENEDICTION_CURSE_CHANCE : 0;
  const bless = (100 - curse) * benedictionBlessChance(luck);
  const none = Math.max(0, 100 - curse - bless);
  return { curse, bless, none };
}

function benedictionLuckLabel(luck) {
  const value = Math.trunc(Number(luck) || 0);
  if (value > 0) return `Luck +${value}`;
  if (value < 0) return `Cursed ${value}`;
  return "";
}

function amuletInventoryEntries(shape = 0) {
  return carriedInventoryEntries().filter((entry) => {
    const item = G.itemDefinition(entry.itemId);
    if (!G.isTaoistAmuletItem(item)) return false;
    return Math.max(0, Math.trunc(Number(item.shape) || 0)) === shape;
  });
}

function amuletInventoryCount(shape = 0) {
  return amuletInventoryEntries(shape).reduce((sum, entry) => sum + Math.max(1, Math.floor(Number(entry.quantity) || 1)), 0);
}

function amuletCandidate(shape = 0) {
  return amuletInventoryEntries(shape)[0] ?? null;
}

function consumeAmuletInventoryUnits(count, shape = 0) {
  const needed = Math.max(1, Math.trunc(Number(count) || 1));
  if (amuletInventoryCount(shape) < needed) return false;
  for (let i = 0; i < needed; i += 1) {
    const entry = amuletCandidate(shape);
    if (!entry || !G.consumeOneInventoryUnit(entry.id)) return false;
  }
  return true;
}

function firstPotionEntryForKind(kind) {
  return carriedInventoryEntries().find((entry) => G.potionRestoreAmount(G.itemDefinition(entry.itemId), kind) > 0) ?? null;
}

function autoPotionCandidates(kind) {
  return autoPotionSlots()
    .map((slot) => {
      const entry = G.hotbarEntryAtSlot(slot);
      const item = entry ? G.itemDefinition(entry.itemId) : null;
      const restore = G.potionRestoreAmount(item, kind);
      return { slot, entry, item, restore };
    })
    .filter((candidate) => candidate.entry && candidate.item && candidate.restore > 0)
    .sort((a, b) => b.restore - a.restore || a.slot - b.slot);
}

function crystalPotionTickAmount() {
  return 5 + Math.floor((state.game.progress.level ?? 1) / 10);
}

function crystalHealRegenLevel(entity) {
  if (entity?.classId === "Warrior" || entity?.classId === "Wizard" || entity?.classId === "Taoist") {
    return Math.max(1, Math.trunc(Number(entity.level) || 1));
  }
  const taoist = state.battle.bossParty?.members?.find((member) => member.classId === "Taoist" && member.alive);
  if (taoist) return Math.max(1, Math.trunc(Number(taoist.level) || 1));
  return Math.max(1, Math.trunc(Number(state.game.progress.level) || 1));
}

function crystalHealRegenTickAmount(pendingHeal, level) {
  const healLevel = Math.max(1, Math.trunc(Number(level) || 1));
  const pending = Math.max(0, Math.trunc(Number(pendingHeal) || 0));
  const incHeal = Math.floor(healLevel / 10) + Math.floor(pending / 10);
  return pending > 5 + incHeal ? 5 + incHeal : pending;
}

async function applyEquipmentChanges() {
  applyEquippedStatsToBattlePlayer();
  G.syncBossPartyControlledInventoryFromState();
  const changedVisualLayers = applyEquippedVisualIndexes();
  G.renderLayerControls();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  playerHudSignature = "";
  combatSkillBarSignature = "";
  await G.reloadAtlases({ refreshLayers: changedVisualLayers });
  G.saveGameState(true);
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.render();
  G.scheduleEquipmentRedraw();
}

function applyEquippedStatsToBattlePlayer() {
  const previous = state.battle.player;
  const stats = characterTotalStats();
  const combatClass = state.battle.combatClass ?? state.activeCharacterId ?? PLAYER_TEMPLATE.class;
  const previousMaxHp = previous?.maxHp ?? stats.maxHp;
  const previousMaxMp = previous?.maxMp ?? stats.maxMp;
  const hpPct = previousMaxHp > 0 ? (previous?.hp ?? stats.maxHp) / previousMaxHp : 1;
  const mpPct = previousMaxMp > 0 ? (previous?.mp ?? stats.maxMp) / previousMaxMp : 1;
  state.battle.player = {
    ...PLAYER_TEMPLATE,
    ...stats,
    name: combatClass,
    class: combatClass,
    level: state.game.progress.level,
    experience: state.game.progress.experience,
    gold: state.inventory.gold,
    hp: previous ? Math.max(1, Math.min(stats.maxHp, Math.round(stats.maxHp * hpPct))) : stats.maxHp,
    mp: previous ? Math.max(0, Math.min(stats.maxMp, Math.round(stats.maxMp * mpPct))) : stats.maxMp,
  };
}

function applyEquippedVisualIndexes() {
  const changedLayers = [];
  for (const layer of ["weapon", "armour"]) {
    const index = desiredEquippedVisualIndex(layer);
    const previousIndex = state.indexes[layer];
    state.indexes[layer] = index;
    if (state.indexes[layer] !== previousIndex) changedLayers.push(layer);
  }
  return changedLayers;
}

function desiredEquippedVisualIndex(layer) {
  const fallback = layer === "weapon" ? null : 0;
  if (layer === "weapon" && state.game.mode === "mining") {
    const pickaxeIndex = MINING_PICKAXE_WEAPON_INDEX;
    return state.catalogue?.layers?.weapon?.indexes?.includes(pickaxeIndex) ? pickaxeIndex : fallback;
  }
  const item = G.equippedVisualItem(layer);
  const index = item?.visual?.index ?? fallback;
  if (index == null) return fallback;
  return state.catalogue?.layers?.[layer]?.indexes?.includes(index) ? index : fallback;
}

function compatibleEquipmentSlots(item) {
  const slot = item?.slot;
  if (!slot || slot === "consumable") return [];
  if (slot === "bracelet") return ["braceletL", "braceletR"];
  if (slot === "ring") return ["ringL", "ringR"];
  if (EQUIPMENT_SLOTS.some((entry) => entry.id === slot)) return [slot];
  return [];
}

function gameSideRecentLootHtml() {
  return `
    <section class="recent-loot game-side-loot-card">
      <strong>Recent Loot</strong>
      ${state.game.recentLoot.length
    ? state.game.recentLoot.map((line) => `<span>${escapeHtml(line)}</span>`).join("")
    : `<span class="recent-loot-empty">No loot yet.</span>`}
    </section>
  `;
}

function activityLogHtml() {
  return `
    <section class="game-card game-log-card">
      <div class="game-card-title">
        <strong>Activity Log</strong>
        <span>${G.title(state.battle.phase)}</span>
      </div>
      <div class="game-log-list">
        ${G.bossPartyStatusHtml()}
        ${gameLogLinesHtml()}
      </div>
    </section>
  `;
}

function bindSceneButtons(rootEl) {
  rootEl.querySelectorAll("[data-open-scene]").forEach((button) => {
    button.addEventListener("click", () => G.openScene(button.dataset.openScene));
  });
  rootEl.querySelectorAll("[data-teleport-region]").forEach((button) => {
    button.addEventListener("click", () => {
      const region = G.teleportRegionById(button.dataset.teleportRegion);
      state.teleportRegionId = region.id;
      state.teleportBrowseRegionId = region.id;
      sceneSignature = "";
      G.renderSceneOverlay();
    });
  });
  rootEl.querySelectorAll("[data-teleport-back]").forEach((button) => {
    button.addEventListener("click", () => {
      state.teleportBrowseRegionId = null;
      sceneSignature = "";
      G.renderSceneOverlay();
    });
  });
  rootEl.querySelectorAll("[data-enter-zone]").forEach((button) => {
    button.addEventListener("click", async () => {
      await G.requestZoneEntry(button.dataset.enterZone);
    });
  });
  rootEl.querySelectorAll("[data-head-to-mines]").forEach((button) => {
    button.addEventListener("click", () => G.enterMiningFromRefiner());
  });
  rootEl.querySelectorAll("[data-sell-all-junk-ore]").forEach((button) => {
    button.addEventListener("click", () => G.sellAllJunkOre());
  });
  rootEl.querySelectorAll("[data-open-weapon-refine]").forEach((button) => {
    button.addEventListener("click", () => G.openWeaponRefineScene());
  });
  rootEl.querySelectorAll("[data-refine-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      handleWeaponRefineSlotClick(button.dataset.refineSlot, Number(button.dataset.refineIndex) || 0);
    });
  });
  rootEl.querySelectorAll("[data-refine-pick]").forEach((button) => {
    button.addEventListener("click", () => assignWeaponRefinePick(button.dataset.refinePick));
  });
  rootEl.querySelectorAll("[data-attempt-weapon-refine]").forEach((button) => {
    button.addEventListener("click", () => attemptWeaponRefine());
  });
  rootEl.querySelectorAll("[data-upgrade-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.upgradeCategory = G.normalizeUpgradeCategory(button.dataset.upgradeCategory);
      sceneSignature = "";
      G.renderSceneOverlay();
    });
  });
}

function buildSceneOverlaySignature(openScenes, bossEntryZoneId) {
  const payload = {
    scene: state.activeScene,
    openScenes: state.openScenes,
    characterTab: state.characterTab,
    inventoryPage: state.inventoryPage,
    storagePage: state.storagePage,
    pendingStoragePageUnlock: state.pendingStoragePageUnlock,
    storagePage2Purchased: state.account.storage.page2Purchased,
    upgradeCategory: state.upgradeCategory,
    bossEntryZoneId: state.bossEntryZoneId,
    bossAssistSelection: state.bossAssistSelection,
    bossRespawns: state.game.bossRespawns,
    bossKills: state.game.bossKills,
    teleportRegionId: state.teleportRegionId,
    teleportBrowseRegionId: state.teleportBrowseRegionId,
    selectedTownNpcId: state.game.selectedTownNpcId,
    weaponRefine: state.weaponRefine,
    combatClass: state.battle.combatClass,
    accountUpgrades: state.account.upgrades,
    autoCastSlotLimit: autoCastSlotLimit(),
    autoPotionSlotLimit: autoPotionSlotLimit(),
    settings: state.settings,
    musicTrackIndex,
    musicStatusText,
  };
  if (bossEntryZoneId) {
    payload.bossEntryRespawnSec = Math.ceil(bossRespawnRemainingMs(bossEntryZoneId) / 1000);
  }
  if (openScenes.includes("character")) {
    payload.level = state.game.progress.level;
    payload.experience = state.game.progress.experience;
    payload.magic = G.sceneMagicSignature();
    if (state.characterTab === "character") {
      payload.equipment = state.inventory.equipment;
    }
    if (state.characterTab === "status") {
      const stats = characterTotalStats();
      payload.statusStats = {
        hp: stats.hp,
        mp: stats.mp,
        ac: stats.ac,
        amc: stats.amc,
        dc: stats.dc,
        mc: stats.mc,
        sc: stats.sc,
      };
      payload.statBuffs = pruneStatBuffs(state.battle.statBuffs ?? []);
    }
  }
  if (openScenes.includes("inventory") || openScenes.includes("weaponRefine")) {
    payload.gold = state.inventory.gold;
    payload.inventoryPagesUnlocked = state.inventory.pagesUnlocked;
    payload.inventoryItems = state.inventory.items.map(inventoryEntrySignature);
  }
  if (openScenes.includes("storage") || state.activeScene === "storage") {
    payload.storagePagesUnlocked = state.account.storage.pagesUnlocked;
    payload.storagePage2Purchased = state.account.storage.page2Purchased;
    payload.storageItems = state.account.storage.items.map(inventoryEntrySignature);
  }
  return JSON.stringify(payload);
}

function bindSceneScrollPreservation(root) {
  for (const element of root.querySelectorAll("[data-preserve-scroll]")) {
    const key = element.dataset.preserveScroll;
    if (!key) continue;
    const persistScroll = () => {
      sceneScrollPositions.set(key, {
        left: element.scrollLeft,
        top: element.scrollTop,
      });
      G.noteSceneOverlayInteraction(700);
    };
    element.addEventListener("scroll", persistScroll, { passive: true });
    element.addEventListener("wheel", () => G.noteSceneOverlayInteraction(900), { passive: true });
    element.addEventListener("pointerdown", () => G.noteSceneOverlayInteraction(900), { passive: true });
  }
}

function captureSceneScrollPositions() {
  for (const element of els.sceneOverlay.querySelectorAll("[data-preserve-scroll]")) {
    const key = element.dataset.preserveScroll;
    if (!key) continue;
    sceneScrollPositions.set(key, {
      left: element.scrollLeft,
      top: element.scrollTop,
    });
  }
  return sceneScrollPositions;
}

function characterAvailableForBossAssist(classId) {
  if (classId === state.activeCharacterId) return false;
  return Boolean(state.characters?.[classId]);
}

function gettingStartedSectionHtml(title, paragraphs) {
  const body = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  return `
    <article class="getting-started-section">
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </article>
  `;
}

function gettingStartedSceneHtml() {
  const autoPotionSlotCount = autoPotionSlotLimit();
  const autoCastSlots = autoCastSlotLimit();
  return `
    <section class="getting-started-panel" data-preserve-scroll="gettingStarted">
      <p class="getting-started-intro">
        Welcome to Legend of Mir Idle. Combat runs automatically once you enter a zone — this guide covers the menus and systems that keep your character alive and growing.
      </p>
      ${gettingStartedSectionHtml("Town and Combat", [
        "You begin in <strong>Bicheon Wall</strong>. Hover NPCs to see their names, then click them to shop, sell, store items, refine gear, or teleport.",
        "Use the <strong>Mysterious Stone</strong> to open the teleport list and pick a hunting zone. Your character fights endlessly, earns XP and gold, and collects loot until you return to town.",
        "Use <strong>Return To Town</strong> in the side panel (or after dying) to go back, restock, and gear up before the next run.",
      ])}
      ${gettingStartedSectionHtml("Character Window", [
        "Open <strong>Character</strong> from the top bar. The equipment tab shows your paper doll — drag items from Inventory onto slots, or click equipped gear to unequip.",
        "The <strong>Status</strong> tab lists your total stats including gear bonuses. <strong>State</strong> shows buffs and ailments. <strong>Skill</strong> lists every spell or technique for your class.",
      ])}
      ${gettingStartedSectionHtml("Stats Explained", [
        "<strong>HP</strong> — health. Reaches 0 and you return to town.",
        "<strong>MP</strong> — mana for casting skills.",
        "<strong>AC</strong> — physical defence. Higher is better.",
        "<strong>AMC</strong> — magic defence against spells.",
        "<strong>DC</strong> — physical attack (Warrior).",
        "<strong>MC</strong> — magic attack (Wizard).",
        "<strong>SC</strong> — spell power for Taoist heals, buffs, and summons.",
        "Also check <strong>Attack Speed</strong>, <strong>Accuracy</strong>, and <strong>Agility</strong> on the Status tab — they affect how often you hit and dodge.",
      ])}
      ${gettingStartedSectionHtml("Inventory and Equipment", [
        "Open <strong>Inventory</strong> to manage items. Equip weapons and armour on the Character tab, or right-click / use items from the bag.",
        "Sell unwanted loot to <strong>Trader James</strong>. Store extras with <strong>Storage Jake</strong> — storage is shared across all characters on your account.",
        "Buy HP potions, MP potions, and poisons from <strong>Alchemist Samuel</strong> before long hunts.",
      ])}
      ${gettingStartedSectionHtml("Potion Hotbar", [
        "The six slots below the combat view are your <strong>hotbar</strong> (keys 1–6). Drag potions from Inventory onto a slot, then click or press the key to drink during a fight.",
        "Only potions belong on the hotbar. Hover any item for a tooltip with its restore amount and stats.",
      ])}
      ${gettingStartedSectionHtml("Auto Potions", [
        `Hotbar slots marked <strong>Auto</strong> drink for you when HP or MP drops below <strong>50%</strong>. You start with ${BASE_AUTO_POTION_SLOTS} auto slots; account upgrades can raise that to ${G.maxAutoPotionSlotLimit()} (currently ${autoPotionSlotCount} unlocked).`,
        "Auto potions scan auto slots left to right and pick the strongest valid potion for the resource that needs healing. There is a short cooldown between automatic drinks.",
        "Place your best HP potions in auto slots for emergencies and keep manual slots for buffs or poisons you want to trigger yourself.",
      ])}
      ${gettingStartedSectionHtml("Skills and Auto Cast", [
        "Skills are learned from monster drops and level up through use. Open Character → <strong>Skill</strong> to see requirements, MP cost, and cooldown.",
        `Toggle <strong>Auto</strong> on a skill to let combat cast it for you. You begin with ${BASE_AUTOCAST_SLOTS} autocast slot; upgrades in the Upgrades window can unlock up to ${G.maxAutoCastSlotLimit()} (currently ${autoCastSlots} active).`,
        "<strong>Warriors</strong> use melee skills and toggles like Flaming Sword. <strong>Wizards</strong> cast ranged spells. <strong>Taoists</strong> heal, buff, summon pets, and apply poisons — keep amulets and poison vials in inventory for those spells.",
        "Some skills are passive or manual-only. Click a queued skill in the skill bar to fire it immediately on your next action.",
      ])}
      ${gettingStartedSectionHtml("Characters and Upgrades", [
        "Open <strong>Characters</strong> to swap between Warrior, Wizard, and Taoist. Each class keeps its own level, gear, and skills; gold and storage are shared account-wide.",
        "Open <strong>Upgrades</strong> for permanent account unlocks — extra autocast slots, auto potion slots, XP bonuses, and more. Many upgrades need rare boss drops.",
        "Blacksmith NPCs can combine duplicate equipment or refine weapons. Check their dialogs when you have spare copies or ore.",
      ])}
      <p class="getting-started-footer">
        Re-open this guide anytime from the <strong>Guide</strong> button in the top bar or from Options.
      </p>
    </section>
  `;
}

function characterSelectSceneHtml() {
  return `
    <section class="character-select-scene">
      <div class="character-select-choices">
        ${CHARACTER_SELECT_CLASSES.map(characterSelectCardHtml).join("")}
      </div>
    </section>
  `;
}

function characterSelectCardHtml(entry) {
  const active = entry.id === state.battle.combatClass;
  const disabled = entry.disabled || COMBAT_CLASSES.some((combatClass) => combatClass.id === entry.id && combatClass.disabled);
  const character = active ? G.serializeCurrentCharacterState() : state.characters[entry.id];
  const progress = character?.game?.progress ?? { level: PLAYER_TEMPLATE.level, gold: PLAYER_TEMPLATE.gold };
  return `
    <button
      type="button"
      class="character-select-card ${active ? "active" : ""} ${disabled ? "disabled" : ""}"
      data-select-player-class="${escapeHtml(entry.id)}"
      ${disabled ? "disabled" : ""}
      aria-pressed="${active ? "true" : "false"}"
    >
      <span class="character-select-portrait">
        <img src="${escapeHtml(entry.image)}" alt="" />
      </span>
      <strong>${escapeHtml(entry.label)}</strong>
      <span>${active ? "Selected" : escapeHtml(entry.role)} | Lv ${progress.level} | ${progress.gold}g</span>
    </button>
  `;
}

function characterSceneHtml() {
  const stats = characterTotalStats();
  const currentTab = CHARACTER_TABS.some((tab) => tab.id === state.characterTab) ? state.characterTab : "character";
  return `
    <section class="crystal-character" aria-label="Character">
      <span class="crystal-character-name">${escapeHtml(state.battle.combatClass)}</span>
      <span class="crystal-character-guild">Level ${state.game.progress.level} | ${escapeHtml(G.xpProgressText())}</span>
      <span class="crystal-character-class-icon" aria-hidden="true"></span>
      ${CHARACTER_TABS.map((tab) => crystalCharacterTabHtml(tab, currentTab)).join("")}
      ${currentTab === "character" ? crystalCharacterEquipmentPageHtml() : crystalCharacterStatusPageHtml(stats, currentTab)}
    </section>
  `;
}

function crystalCharacterTabHtml(tab, currentTab) {
  return `
    <button
      class="crystal-character-tab ${currentTab === tab.id ? "active" : ""}"
      type="button"
      data-character-tab="${tab.id}"
      title="${escapeHtml(tab.label)}"
      style="left:${tab.x}px; background-position:${-tab.slot * 64}px 0;"
    ></button>
  `;
}

function crystalCharacterEquipmentPageHtml() {
  return `
    <div class="crystal-character-panel"></div>
    ${crystalCharacterPaperDollHtml()}
    ${EQUIPMENT_SLOTS.map((slot) => crystalEquipmentSlotHtml(slot)).join("")}
  `;
}

function crystalCharacterPaperDollHtml() {
  const armourItem = G.equippedItem("armour");
  const weaponItem = G.equippedItem("weapon");
  const helmetItem = G.equippedItem("helmet");
  const layers = [
    armourItem ? crystalPaperDollLayerHtml(armourItem, "armour") : "",
    weaponItem ? crystalPaperDollLayerHtml(weaponItem, "weapon") : "",
    helmetItem ? crystalPaperDollLayerHtml(helmetItem, "helmet") : crystalPaperDollFrameHtml(CHARACTER_PAPER_DOLL_FRAMES.hair, "Hair"),
  ].filter(Boolean);
  return `<div class="crystal-paper-doll" aria-hidden="true">${layers.join("")}</div>`;
}

function crystalPaperDollLayerHtml(item, label) {
  const frame = state.characterStateItems?.[item.icon?.frame] ?? CHARACTER_PAPER_DOLL_FRAMES[item.icon?.frame];
  if (!frame) return "";
  return crystalPaperDollFrameHtml(frame, item.name ?? label);
}

function crystalPaperDollFrameHtml(frame, label) {
  if (frame.sheet) {
    return `
    <div
      class="crystal-paper-doll-layer"
      title="${escapeHtml(label)}"
      style="left:${frame.x}px; top:${frame.y}px; width:${frame.w}px; height:${frame.h}px; background:url('${escapeHtml(frame.sheet)}') -${frame.sx}px -${frame.sy}px no-repeat;"
    ></div>
  `;
  }
  return `
    <img
      class="crystal-paper-doll-layer"
      src="${escapeHtml(frame.src)}"
      alt=""
      title="${escapeHtml(label)}"
      style="left:${frame.x}px; top:${frame.y}px; width:${frame.w}px; height:${frame.h}px;"
    />
  `;
}

function crystalCharacterStatusPageHtml(stats, tabId) {
  const pageSlot = tabId === "state" ? 1 : tabId === "skill" ? 2 : 0;
  const body = tabId === "status"
    ? STATUS_VALUE_ROWS.map((row) => crystalStatusValueHtml(row, stats)).join("")
    : tabId === "state"
    ? crystalCharacterStatePageHtml()
    : tabId === "skill"
    ? crystalCharacterSkillPageHtml()
    : `<span class="crystal-character-page-note">Later</span>`;
  return `
    <div class="crystal-character-page ${tabId === "skill" || tabId === "state" ? "skill-page" : ""}" style="background-position:${-pageSlot * 248}px 0;">
      ${body}
    </div>
  `;
}

function crystalCharacterStatePageHtml() {
  const account = G.accountStatsSnapshot();
  const bossRows = Object.entries(BOSS_ROOM_DEFS).map(([zoneId, def]) => ({
    zoneId,
    label: def.bossName,
    kills: bossKillCount(zoneId),
  }));
  const characterRows = CHARACTER_SELECT_CLASSES
    .filter((entry) => !entry.disabled)
    .map((entry) => {
      const character = state.characters[entry.id];
      const stats = characterSnapshotTotalStats(entry.id, character, { includeBuffs: false });
      return {
        classId: entry.id,
        label: entry.label ?? entry.id,
        level: Math.max(1, Math.trunc(Number(character?.game?.progress?.level) || 1)),
        dc: `${stats.dc[0]}-${stats.dc[1]}`,
        mc: `${stats.mc[0]}-${stats.mc[1]}`,
        sc: `${stats.sc[0]}-${stats.sc[1]}`,
        ac: `${stats.ac[0]}-${stats.ac[1]}`,
        amc: `${stats.amc[0]}-${stats.amc[1]}`,
        accuracy: stats.accuracy,
        agility: stats.agility,
        luck: stats.luck,
      };
    });
  return `
    <div class="crystal-state-list" data-preserve-scroll="character-state">
      <div class="crystal-state-heading">Account</div>
      <div class="crystal-state-row">
        <span class="crystal-state-label">Total Gold</span>
        <span class="crystal-state-value">${account.totalGold.toLocaleString()}</span>
      </div>
      <div class="crystal-state-row">
        <span class="crystal-state-label">Rebirths</span>
        <span class="crystal-state-value">${account.rebirthCount}</span>
      </div>
      <div class="crystal-state-row">
        <span class="crystal-state-label">Points Gained</span>
        <span class="crystal-state-value">${account.rebirthPointsGained}</span>
      </div>
      <div class="crystal-state-row">
        <span class="crystal-state-label">Points Spent</span>
        <span class="crystal-state-value">${account.rebirthPointsSpent}</span>
      </div>
      <div class="crystal-state-row">
        <span class="crystal-state-label">Rebirth Points</span>
        <span class="crystal-state-value">${account.rebirthPointsHeld}</span>
      </div>
      <div class="crystal-state-row">
        <span class="crystal-state-label">Awakening Souls</span>
        <span class="crystal-state-value">${account.awakeningSoulsHeld ?? 0}</span>
      </div>
      ${bossRows.map((row) => `
        <div class="crystal-state-row">
          <span class="crystal-state-label">${escapeHtml(row.label)}</span>
          <span class="crystal-state-value">${row.kills}</span>
        </div>
      `).join("")}
      <div class="crystal-state-heading">Characters</div>
      ${characterRows.map((row) => `
        <div class="crystal-state-block">
          <div class="crystal-state-row">
            <span class="crystal-state-label">${escapeHtml(row.label)}</span>
            <span class="crystal-state-value">Lv ${row.level}</span>
          </div>
          <div class="crystal-state-note">DC ${escapeHtml(row.dc)} | MC ${escapeHtml(row.mc)} | SC ${escapeHtml(row.sc)}</div>
          <div class="crystal-state-note">AC ${escapeHtml(row.ac)} | AMC ${escapeHtml(row.amc)} | Acc ${row.accuracy} | Agi ${row.agility} | Luck ${row.luck}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function crystalCharacterSkillPageHtml() {
  const spells = characterSkillSpells();
  if (!spells.length) {
    return `<span class="crystal-character-page-note">${escapeHtml(state.battle.combatClass)} spells not added yet</span>`;
  }
  return `
    <div class="crystal-skill-list" data-preserve-scroll="character-skills">
      ${spells.map((spell) => crystalSkillRowHtml(spell, G.learnedMagic(spell.id))).join("")}
    </div>
  `;
}

function characterSkillSpells(classId = state.battle.combatClass) {
  if (classId === "Warrior") return CRYSTAL_WARRIOR_SPELLS;
  if (classId === "Wizard") return CRYSTAL_WIZARD_SPELLS;
  if (classId === "Taoist") return CRYSTAL_TAOIST_SPELLS;
  return [];
}

function crystalSkillRowHtml(spell, learned) {
  const isLearned = Boolean(learned);
  const level = isLearned ? Number(learned?.level) || 0 : 0;
  const nextNeed = spellExperienceTarget(spell, level);
  const nextLevel = spellLevelRequirement(spell, level);
  const progress = !isLearned ? "Unlearned" : level >= 3 ? "Mastered" : `${learned?.experience ?? 0}/${nextNeed}`;
  const mp = spellMpCost(spell, learned);
  const cooldown = spellDelayMs(spell, learned);
  const controlLabel = spell.toggle ? "toggle" : "auto cast";
  const combatClass = G.combatAutoCastClassForSpell(spell.id);
  const combatAutoSpell = Boolean(combatClass);
  const autoLimitReached = isLearned
    && combatAutoSpell
    && !learned?.autoCast
    && autoCastSlotsUsed(combatClass) >= autoCastSlotLimit();
  const queued = isLearned && combatClass && G.isQueuedCombatSpell(spell.id, combatClass);
  const autoLabel = learned?.autoCast ? "On" : autoLimitReached ? "Max" : "Off";
  const autoTitle = queued
    ? `${spell.label} is queued as the next manual cast`
    : learned?.autoCast
    ? `Disable ${controlLabel}`
    : autoLimitReached
    ? `Autocast slots full (${autoCastSlotsUsed(combatClass)}/${autoCastSlotLimit()})`
    : `Enable ${controlLabel}`;
  const autoControl = !isLearned
    ? ""
    : spell.passive
    ? `<span class="crystal-skill-passive">Passive</span>`
    : `<button class="crystal-skill-auto ${learned?.autoCast ? "active" : ""} ${queued ? "queued" : ""}" type="button" data-toggle-skill-auto="${escapeHtml(spell.id)}" title="${escapeHtml(autoTitle)}">${autoLabel}</button>`;
  const meta = isLearned
    ? spell.passive
      ? `${level >= 3 ? "Done" : `Req ${nextLevel}`} | Passive | ${G.spellDropZoneText(spell)}`
      : spell.toggle
      ? `${level >= 3 ? "Done" : `Req ${nextLevel}`} | Toggle | 2 tiles | ${G.spellDropZoneText(spell)}`
      : `${level >= 3 ? "Done" : `Req ${nextLevel}`} | MP ${mp} | ${Math.round(cooldown / 1000)}s | ${G.spellDropZoneText(spell)}`
    : G.spellDropZoneText(spell);
  return `
    <div class="crystal-skill-row ${spell.passive ? "passive" : ""} ${learned?.autoCast ? "auto" : ""} ${queued ? "queued" : ""} ${isLearned ? "" : "unlearned"}">
      <img src="${escapeHtml(magicIconSrc(spell))}" alt="" />
      <span class="crystal-skill-name">${escapeHtml(spell.label)}</span>
      <span class="crystal-skill-level">${isLearned ? `Lv ${level}` : "Lv -"}</span>
      ${autoControl}
      <span class="crystal-skill-exp">${escapeHtml(progress)}</span>
      <span class="crystal-skill-meta">${escapeHtml(meta)}</span>
    </div>
  `;
}

function crystalStatusValueHtml(row, stats) {
  const value = characterStatusValue(row.key, stats);
  return `<span class="crystal-status-value" style="left:${row.x}px; top:${row.y}px;">${escapeHtml(value)}</span>`;
}

function characterStatusValue(key, stats) {
  const values = {
    hp: `${stats.hp ?? stats.maxHp}/${stats.maxHp}`,
    mp: `${stats.mp ?? stats.maxMp}/${stats.maxMp}`,
    ac: formatStatRange(stats.ac),
    amc: formatStatRange(stats.amc),
    dc: formatStatRange(stats.dc),
    mc: formatStatRange(stats.mc),
    sc: formatStatRange(stats.sc),
    critRate: "0%",
    critDamage: "0",
    attackSpeed: characterAttackSpeedLabel(),
    accuracy: `+${stats.accuracy}`,
    agility: `+${stats.agility}`,
    luck: String(stats.luck),
  };
  return values[key] ?? "";
}

function crystalEquipmentSlotHtml(slot) {
  const entry = G.equippedEntry(slot.id);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  const position = CRYSTAL_EQUIPMENT_SLOT_POSITIONS[slot.id] ?? { x: 0, y: 0 };
  const content = entry && item ? crystalEquipmentItemHtml(entry, item, slot.id) : "";
  return `
    <div
      class="crystal-equipment-slot ${item ? "has-tooltip" : ""}"
      data-equipment-slot="${slot.id}"
      ${item ? `data-tooltip-item="${item.id}"` : ""}
      ${entry ? `data-tooltip-entry="${entry.id}"` : ""}
      title="${escapeHtml(slot.label)}"
      style="left:${8 + position.x}px; top:${90 + position.y}px;"
    >
      ${content}
    </div>
  `;
}

function crystalEquipmentItemHtml(entry, item, slotId) {
  return `
    <div
      class="crystal-equipment-item has-tooltip"
      data-tooltip-item="${item.id}"
      data-tooltip-entry="${entry.id}"
      data-inventory-entry="${entry.id}"
      data-equipped-slot="${slotId}"
      draggable="false"
      title="${escapeHtml(G.itemDisplayName(item, entry))}"
    >
      ${G.itemIconMarkup(item)}
    </div>
  `;
}

function crystalStorageSlotHtml(slot, displayIndex = slot) {
  const entry = G.storageEntryAtSlot(slot);
  const x = 9 + (displayIndex % STORAGE_COLUMNS) * 37;
  const y = 60 + Math.floor(displayIndex / STORAGE_COLUMNS) * 33;
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  const content = entry && item ? crystalStorageItemHtml(entry, item) : "";
  return `
    <div class="crystal-storage-slot" data-storage-slot="${slot}" style="left:${x}px; top:${y}px;">
      ${content}
    </div>
  `;
}

function crystalStorageItemHtml(entry, item) {
  const stack = G.isStackableItem(item) && entry.quantity > 1 ? `<span class="crystal-item-qty">${entry.quantity}</span>` : "";
  return `
    <div
      class="crystal-storage-item has-tooltip"
      data-tooltip-item="${item.id}"
      data-tooltip-entry="${entry.id}"
      data-storage-entry="${entry.id}"
      draggable="false"
      title="${escapeHtml(G.itemDisplayName(item, entry))}"
    >
      ${G.itemIconMarkup(item)}
      ${stack}
    </div>
  `;
}

function crystalInventorySlotHtml(slot, displaySlot = slot) {
  const entry = G.inventoryEntryAtSlot(slot);
  const x = 9 + (displaySlot % 8) * 37;
  const y = 37 + Math.floor(displaySlot / 8) * 33;
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  const content = entry && item ? crystalInventoryItemHtml(entry, item) : "";
  return `
    <div class="crystal-inventory-slot" data-inventory-slot="${slot}" style="left:${x}px; top:${y}px;">
      ${content}
    </div>
  `;
}

function crystalInventoryItemHtml(entry, item) {
  const equipped = G.isEquippedEntry(entry.id);
  const requirement = G.itemRequirementStatus(item, characterEquipmentStats());
  const stack = G.isStackableItem(item) && entry.quantity > 1 ? `<span class="crystal-item-qty">${entry.quantity}</span>` : "";
  const locked = !requirement.ok && (G.isEquipableItem(item) || G.isBookItem(item));
  return `
    <div
      class="crystal-inventory-item has-tooltip ${equipped ? "equipped" : ""} ${locked ? "locked" : ""}"
      data-tooltip-item="${item.id}"
      data-tooltip-entry="${entry.id}"
      data-inventory-entry="${entry.id}"
      draggable="false"
      title="${escapeHtml(G.itemDisplayName(item, entry))}"
    >
      ${G.itemIconMarkup(item)}
      ${stack}
    </div>
  `;
}

function characterEquipmentStats() {
  const stats = cloneStats({
    ...PLAYER_TEMPLATE,
    ...crystalPlayerBaseStats(state.battle.combatClass ?? PLAYER_TEMPLATE.class, state.game.progress.level),
  });
  applyRebirthUpgradeStats(stats);
  for (const slot of EQUIPMENT_SLOTS) {
    const entry = G.equippedEntry(slot.id);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (item?.stats) addStats(stats, G.itemEntryStats(entry, item));
  }
  applyLearnedMagicStats(stats);
  return stats;
}

function characterTotalStats() {
  const stats = characterEquipmentStats();
  applyStatBuffsToStats(stats, pruneStatBuffs(state.battle.statBuffs ?? []));
  stats.hp = state.battle.player?.hp ?? stats.maxHp;
  stats.mp = state.battle.player?.mp ?? stats.maxMp;
  return stats;
}

function applyLearnedMagicStats(stats) {
  applyLearnedMagicStatsForClass(stats, state.battle.combatClass, state.magic);
}

function characterSnapshotTotalStats(classId, character, options = {}) {
  const includeBuffs = options.includeBuffs !== false;
  const level = Math.max(1, Math.trunc(Number(character?.game?.progress?.level) || PLAYER_TEMPLATE.level));
  const stats = cloneStats({
    ...PLAYER_TEMPLATE,
    ...crystalPlayerBaseStats(classId ?? PLAYER_TEMPLATE.class, level),
  });
  applyRebirthUpgradeStats(stats);
  const inventory = character?.inventory ?? createStarterInventoryState(classId);
  for (const slot of EQUIPMENT_SLOTS) {
    const entryId = inventory.equipment?.[slot.id] ?? null;
    const entry = inventory.items?.find((candidate) => candidate.id === entryId) ?? null;
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (item?.stats) addStats(stats, G.itemEntryStats(entry, item));
  }
  applyLearnedMagicStatsForClass(stats, classId, character?.magic ?? { learned: {} });
  if (includeBuffs) {
    applyStatBuffsToStats(stats, sanitizeStatBuffs(character?.battle?.statBuffs));
  }
  const savedHp = G.finiteNumberOrNull(character?.battle?.playerHp);
  const savedMp = G.finiteNumberOrNull(character?.battle?.playerMp);
  stats.hp = savedHp == null ? stats.maxHp : Math.max(0, Math.min(stats.maxHp, savedHp));
  stats.mp = savedMp == null ? stats.maxMp : Math.max(0, Math.min(stats.maxMp, savedMp));
  return stats;
}

function applyLearnedMagicStatsForClass(stats, classId, magic = state.magic) {
  const learnedFor = (spellId) => magic?.learned?.[spellId] ?? null;
  if (classId === "Warrior") {
    const fencing = learnedFor("Fencing");
    if (fencing) stats.accuracy += Math.max(0, Number(fencing.level) || 0) * 3;
    const slaying = learnedFor("Slaying");
    if (slaying) {
      const slayingMaxDcBonus = [5, 6, 7, 8][Math.max(0, Math.min(3, Number(slaying.level) || 0))] ?? 5;
      stats.accuracy += Math.max(0, Number(slaying.level) || 0);
      stats.dc[1] += slayingMaxDcBonus;
    }
  }

  if (classId === "Taoist") {
    const spiritSword = learnedFor("SpiritSword");
    if (spiritSword) {
      const spiritSwordAccuracyBonus = [0, 3, 5, 8][Math.max(0, Math.min(3, Number(spiritSword.level) || 0))] ?? 0;
      stats.accuracy += spiritSwordAccuracyBonus;
    }
  }
}

function cloneStats(stats) {
  return {
    maxHp: stats.maxHp ?? stats.hp ?? 0,
    maxMp: stats.maxMp ?? stats.mp ?? 0,
    dc: [...(stats.dc ?? [0, 0])],
    mc: [...(stats.mc ?? [0, 0])],
    sc: [...(stats.sc ?? [0, 0])],
    ac: [...(stats.ac ?? [0, 0])],
    amc: [...(stats.amc ?? [0, 0])],
    accuracy: stats.accuracy ?? 0,
    agility: stats.agility ?? 0,
    luck: stats.luck ?? 0,
    attackSpeed: stats.attackSpeed ?? 0,
    freezing: stats.freezing ?? 0,
    poisonAttack: stats.poisonAttack ?? 0,
    magicResist: stats.magicResist ?? 0,
    poisonResist: stats.poisonResist ?? 0,
    healthRecovery: stats.healthRecovery ?? 0,
    poisonRecovery: stats.poisonRecovery ?? 0,
    strong: stats.strong ?? 0,
  };
}

function addStats(target, source) {
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) addRange(target[key], source[key]);
  target.maxHp += Number(source.hp) || 0;
  target.maxMp += Number(source.mp) || 0;
  target.accuracy += Number(source.accuracy) || 0;
  target.agility += Number(source.agility) || 0;
  target.luck += Number(source.luck) || 0;
  target.attackSpeed += Number(source.attackSpeed) || 0;
  target.freezing += Number(source.freezing) || 0;
  target.poisonAttack += Number(source.poisonAttack) || 0;
  target.magicResist += Number(source.magicResist) || 0;
  target.poisonResist += Number(source.poisonResist) || 0;
  target.healthRecovery += Number(source.healthRecovery) || 0;
  target.poisonRecovery += Number(source.poisonRecovery) || 0;
  target.strong += Number(source.strong) || 0;
}

function addRange(target, source) {
  if (!Array.isArray(target) || !Array.isArray(source)) return;
  target[0] += Number(source[0]) || 0;
  target[1] += Number(source[1]) || 0;
}

function beginInventoryClickCarry(event, itemElement) {
  const refineBoardKind = itemElement.dataset.refineBoardKind ?? null;
  const refineBoardIndex = Number(itemElement.dataset.refineBoardIndex);
  const sourceContainer = refineBoardKind
    ? "weaponRefine"
    : itemElement.dataset.storageEntry
      ? "storage"
      : "inventory";
  const entryId = itemElement.dataset.refineBoardEntry
    ?? itemElement.dataset.storageEntry
    ?? itemElement.dataset.inventoryEntry;
  const entry = sourceContainer === "storage"
    ? G.storageEntryById(entryId)
    : sourceContainer === "weaponRefine"
      ? G.weaponRefineEntryById(entryId)
      : G.inventoryEntryById(entryId);
  if (!entry) return false;
  cleanupInventoryCarry();
  const rect = itemElement.getBoundingClientRect();
  const ghost = itemElement.cloneNode(true);
  ghost.classList.remove("dragging", "locked");
  ghost.classList.add("inventory-drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);
  inventoryDragState = {
    entryId,
    sourceContainer,
    sourceEquipmentSlot: itemElement.dataset.equippedSlot ?? null,
    refineBoardSlot: refineBoardKind
      ? { kind: refineBoardKind, index: Math.max(0, refineBoardIndex) }
      : null,
    source: itemElement,
    ghost,
    dropTarget: null,
    offsetX: rect.width / 2,
    offsetY: rect.height / 2,
  };
  itemElement.classList.add("dragging");
  hideItemTooltip();
  G.updateInventoryCarryPointer(event);
  G.playSfx("item.move", { volume: 0.32, throttleMs: 80 });
  return true;
}

function handleInventoryCarryClick(event) {
  if (inventoryDragState) {
    finishInventoryClickCarry(event);
    return true;
  }

  const commandTarget = event.target.closest(
    "[data-use-entry], [data-equip-entry], [data-sell-entry], [data-buy-item], [data-buy-stack], [data-buy-account-upgrade], [data-smith-combine], [data-cast-combat-skill], [data-toggle-skill-auto], [data-unequip-slot]",
  );
  if (commandTarget && root.contains(commandTarget)) return false;

  const itemElement = event.target.closest("[data-inventory-entry], [data-storage-entry], [data-refine-board-entry]");
  if (!itemElement || !root.contains(itemElement)) return false;
  event.preventDefault();
  return beginInventoryClickCarry(event, itemElement);
}

function finishInventoryClickCarry(event) {
  const carry = inventoryDragState;
  const dropTarget = G.inventoryDropTargetAt(event);
  cleanupInventoryCarry();
  event.preventDefault();
  if (!carry) return false;
  if (!dropTarget) {
    if (carry.sourceContainer === "weaponRefine" && carry.refineBoardSlot) {
      clearWeaponRefineSlot(carry.refineBoardSlot.kind, carry.refineBoardSlot.index);
    }
    return false;
  }

  const refineSlot = dropTarget.closest("[data-refine-slot]");
  if (refineSlot && root.contains(refineSlot)) {
    const kind = refineSlot.dataset.refineSlot;
    const index = Number(refineSlot.dataset.refineIndex) || 0;
    if ((kind === "ore" || kind === "material")
      && (carry.sourceContainer === "inventory" || carry.sourceContainer === "weaponRefine")) {
      assignWeaponRefineSlot(
        kind,
        index,
        carry.entryId,
        { fromRefine: carry.sourceContainer === "weaponRefine" ? carry.refineBoardSlot : null },
      );
      return true;
    }
  }

  const equipmentSlot = dropTarget.closest("[data-equipment-slot]");
  if (equipmentSlot && root.contains(equipmentSlot)) {
    const slotId = equipmentSlot.dataset.equipmentSlot;
    if (carry.sourceContainer === "inventory") {
      const sourceEntry = G.inventoryEntryById(carry.entryId);
      const sourceItem = G.itemDefinition(sourceEntry?.itemId);
      const slotEntry = G.equippedEntry(slotId);
      if (G.isGemUpgradeItem(sourceItem) && slotEntry) {
        applyGemUpgrade(carry.entryId, slotEntry.id);
        return true;
      }
    }
    if (carry.sourceContainer === "storage") {
      const check = canEquipStorageEntryToSlot(carry.entryId, slotId);
      if (check.ok) G.equipStorageEntryToSlot(carry.entryId, slotId);
      else G.rejectInventoryMove(check.reason);
    } else {
      const check = canEquipEntryToSlot(carry.entryId, slotId);
      if (check.ok) G.equipInventoryEntryToSlot(carry.entryId, slotId);
      else G.rejectInventoryMove(check.reason);
    }
    return true;
  }

  const targetInventoryEntry = dropTarget.closest("[data-inventory-entry]");
  if (targetInventoryEntry && root.contains(targetInventoryEntry) && carry.sourceContainer === "inventory") {
    const targetEntryId = targetInventoryEntry.dataset.inventoryEntry;
    if (targetEntryId && targetEntryId !== carry.entryId) {
      const sourceItem = G.itemDefinition(G.inventoryEntryById(carry.entryId)?.itemId);
      const targetItem = G.itemDefinition(G.inventoryEntryById(targetEntryId)?.itemId);
      if (G.isGemUpgradeItem(sourceItem) && G.isEquipableItem(targetItem)) {
        applyGemUpgrade(carry.entryId, targetEntryId);
        return true;
      }
      combineInventoryStackEntries(carry.entryId, targetEntryId);
    }
    return true;
  }

  const targetStorageEntry = dropTarget.closest("[data-storage-entry]");
  if (targetStorageEntry && root.contains(targetStorageEntry) && carry.sourceContainer === "storage") {
    const targetEntryId = targetStorageEntry.dataset.storageEntry;
    if (targetEntryId && targetEntryId !== carry.entryId) {
      combineStorageStackEntries(carry.entryId, targetEntryId);
    }
    return true;
  }

  const storageSlot = dropTarget.closest("[data-storage-slot]");
  if (storageSlot && root.contains(storageSlot)) {
    const targetSlot = Number(storageSlot.dataset.storageSlot);
    if (carry.sourceContainer === "storage") {
      if (canDropEntryToStorageSlot(carry.entryId, targetSlot, "storage").ok) G.moveStorageEntryToStorageSlot(carry.entryId, targetSlot);
    } else if (canDropEntryToStorageSlot(carry.entryId, targetSlot, "inventory").ok) {
      G.storeInventoryEntryInStorage(carry.entryId, targetSlot, carry.sourceEquipmentSlot);
    }
    return true;
  }

  const hotbarSlot = dropTarget.closest("[data-hotbar-slot]");
  if (hotbarSlot && root.contains(hotbarSlot)) {
    if (carry.sourceContainer === "storage") return true;
    const targetSlot = Number(hotbarSlot.dataset.hotbarSlot);
    if (canDropEntryToHotbarSlot(carry.entryId, targetSlot).ok) dropInventoryEntryToHotbarSlot(carry.entryId, targetSlot);
    return true;
  }

  const inventorySlot = dropTarget.closest("[data-inventory-slot]");
  if (inventorySlot && root.contains(inventorySlot)) {
    if (carry.sourceContainer === "weaponRefine" && carry.refineBoardSlot) {
      clearWeaponRefineSlot(
        carry.refineBoardSlot.kind,
        carry.refineBoardSlot.index,
        { targetSlot: Number(inventorySlot.dataset.inventorySlot) },
      );
      return true;
    }
    const targetSlot = Number(inventorySlot.dataset.inventorySlot);
    if (carry.sourceContainer === "storage") {
      if (canWithdrawStorageEntryToInventorySlot(carry.entryId, targetSlot).ok) G.withdrawStorageEntryToInventorySlot(carry.entryId, targetSlot);
    } else if (canDropEntryToInventorySlot(carry.entryId, targetSlot, carry.sourceEquipmentSlot).ok) {
      dropInventoryEntryToInventorySlot(carry.entryId, targetSlot, carry.sourceEquipmentSlot);
    }
    return true;
  }

  return false;
}

function cleanupInventoryCarry() {
  if (!inventoryDragState) return;
  inventoryDragState.dropTarget?.classList.remove("drag-over", "drag-invalid");
  inventoryDragState.source?.classList.remove("dragging");
  inventoryDragState.ghost?.remove();
  inventoryDragState = null;
}

function hasRangeValue(stat) {
  return Array.isArray(stat) && ((Number(stat[0]) || 0) !== 0 || (Number(stat[1]) || 0) !== 0);
}

function classRequirementMet(classMask) {
  const mask = Number(classMask) || 31;
  const classBits = { Warrior: 1, Wizard: 2, Taoist: 4 };
  return Boolean(mask & (classBits[state.battle.combatClass] ?? 1));
}

async function confirmBossZoneEntry(zoneId) {
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId);
  const isBossRoom = Boolean(zone && bossRoomDef(zone.id));
  const isGroupDungeon = Boolean(zone && G.groupDungeonZone(zone));
  if (!zone || (!isBossRoom && !isGroupDungeon)) return;
  if (isBossRoom && bossRespawnRemainingMs(zone.id) > 0) {
    sceneSignature = "";
    G.renderSceneOverlay();
    G.playSfx("ui.button", { volume: 0.25, throttleMs: 120 });
    return;
  }
  G.captureActiveCharacterState();
  state.pendingBossAssistSelection = [...selectedBossAssistIds()];
  state.bossEntryZoneId = null;
  G.closeScene(false);
  await enterZone(zone.id);
}

async function enterZone(zoneId, options = {}) {
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId) ?? PROTOTYPE_ZONES[0];
  if (!zone || zone.miningOnly) return;
  if (!options.preview) state.zoneBuilderPreviewZoneId = null;
  G.stopOneStepTest();
  state.continuousWalk = false;
  state.showEnemies = true;
  state.game.mode = "zone";
  state.game.activeZoneId = zone.id;
  clearStampBackgroundCache();
  lastStageShellSize = { w: 0, h: 0, mode: "", scale: 0 };
  state.game.miningNextRollAt = 0;
  state.game.zoneKills = 0;
  state.game.distance = 0;
  state.game.selectedTownNpcId = null;
  state.game.lastReward = null;
  state.game.recentLoot = [];
  state.game.lootToasts = [];
  state.game.dropPity[zone.id] = state.game.dropPity[zone.id] ?? 0;
  if (G.isRoomOnlyZone(zone)) {
    G.resetBattleForRoomOnly(zone);
  } else {
    G.resetBattle(G.randomZoneEnemyTemplate(zone).id);
  }
  if (G.groupDungeonZone(zone)) {
    clearGroupDungeonRunState();
  } else {
    state.game.groupDungeonRun = null;
  }
  state.battle.log = [`Teleported to ${zone.label}.`];
  G.captureActiveCharacterState();
  G.playSfx("ui.teleport", { volume: 0.55, throttleMs: 300 });
  await G.reloadEnemyAtlas();
  G.startBattle();
  G.renderMapControls();
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.render();
}

function bossRoomDef(zoneId) {
  return BOSS_ROOM_DEFS[zoneId] ?? null;
}

function clearGroupDungeonRunState() {
  state.battle.swarm = null;
  G.markGroupDungeonWaveUiDirty();
}

function finishGroupDungeonWaveIfReady(now) {
  const waves = G.groupDungeonWaveState();
  if (!waves || waves.betweenWaves) return;

  G.reconcileGroupDungeonSwarmDeaths(now);
  G.reconcileGroupDungeonWaveKillCount();

  if (G.groupDungeonWaveOutstandingCount(waves) > 0) {
    const batch = G.groupDungeonWavePendingSpawnCount(waves);
    if (batch > 0) {
      G.spawnGroupDungeonWaveBurst(now, batch);
      G.markGroupDungeonWaveUiDirty();
    }
    return;
  }

  waves.spawningComplete = true;
  G.onGroupDungeonWaveCleared(now);
}

function continueGroupDungeonEndlessWaves(now = performance.now()) {
  const waves = G.groupDungeonWaveState();
  if (!waves || waves.endless) return;
  const zone = G.groupDungeonWaveZone?.() ?? G.activeZone();
  const wavesPerFloor = groupDungeonWavesPerFloor(zone);
  waves.endless = true;
  waves.floorComplete = false;
  waves.betweenWaves = false;
  waves.waveNumber = wavesPerFloor + 1;
  G.pushBattleLog("Floor cleared — endless waves continue.");
  const nextZone = G.groupDungeonNextFloorZone?.(zone);
  if (nextZone && !G.groupDungeonBossZone?.(zone)) {
    G.pushBattleLog(`Advance to ${nextZone.label} when you are ready.`);
  }
  G.startGroupDungeonWave(now);
  G.invalidateGroupDungeonWaveUi();
}

function buildSwarmEnemyFromTemplate(template, now, options = {}) {
  const swarm = state.battle.swarm;
  const id = ++swarm.nextId;
  const spawnX = Math.round(Number(options.spawnX) || G.groupDungeonSwarmOffscreenSpawnX());
  return {
    id,
    templateId: template.id,
    name: template.name,
    level: template.level,
    maxHp: template.maxHp,
    maxMp: template.maxMp,
    hp: template.maxHp,
    mp: template.maxMp,
    dc: template.dc,
    mc: template.mc,
    sc: template.sc,
    ac: template.ac,
    amc: template.amc,
    accuracy: template.accuracy,
    agility: template.agility,
    luck: template.luck,
    attackMs: template.attackMs,
    moveMs: template.moveMs,
    experience: template.experience,
    monsterIndex: template.monsterIndex,
    poisons: [],
    debuffs: { slowUntil: 0, frozenUntil: 0 },
    worldX: swarmSnapTileX(spawnX),
    mapRow: Math.trunc(Number(options.mapRow) || G.arenaSpawnMapRow()),
    action: "standing",
    frame: 0,
    oneShot: false,
    lastTick: now,
    atlas: null,
    nextMoveAt: now + randomInt(200, 900),
    stepFromX: null,
    stepToX: null,
    stepFromMapRow: null,
    stepToMapRow: null,
    nextAttackAt: now + randomInt(500, 1400),
    dying: false,
    removeAt: 0,
    pendingStruck: false,
  };
}

function findGroupDungeonSwarmEnemy(swarmId) {
  return state.battle.swarm?.enemies?.find((enemy) => enemy.id === swarmId) ?? null;
}

function clearSwarmEnemyStep(enemy, now = performance.now()) {
  enemy.stepFromX = null;
  enemy.stepToX = null;
  enemy.stepFromMapRow = null;
  enemy.stepToMapRow = null;
}

function completeSwarmEnemyStep(enemy, now = performance.now()) {
  if (enemy.stepToX == null) return;
  enemy.worldX = swarmSnapTileX(enemy.stepToX);
  enemy.mapRow = Math.trunc(enemy.stepToMapRow);
  clearSwarmEnemyStep(enemy, now);
  if (enemy.hp > 0 && !enemy.dying) {
    const meleeCol = swarmSnapTileX(G.groupDungeonSwarmMeleeWorldX());
    enemy.action = swarmEnemyEngagedStanceAction(enemy, meleeCol, G.arenaSpawnMapRow());
    enemy.frame = 0;
    enemy.oneShot = false;
    enemy.lastTick = now;
  }
}

function beginSwarmEnemyTileStep(enemy, action, fromX, fromMapRow, toX, toMapRow, now) {
  enemy.stepFromX = swarmSnapTileX(fromX);
  enemy.stepToX = swarmSnapTileX(toX);
  enemy.stepFromMapRow = Math.trunc(fromMapRow);
  enemy.stepToMapRow = Math.trunc(toMapRow);
  enemy.worldX = enemy.stepToX;
  enemy.mapRow = enemy.stepToMapRow;
  enemy.nextMoveAt = now + effectiveEnemyMoveMs(enemy, now);
  G.setSwarmEnemyAction(enemy, action, true, now);
}

function awardGroupDungeonSwarmKill(swarmEnemy, now = performance.now()) {
  const party = state.battle.bossParty;
  if (!party || !swarmEnemy) return;
  const savedEnemy = state.battle.enemy;
  state.battle.enemy = G.swarmEnemyToBattleEntity(swarmEnemy);
  G.awardBossPartyKillShare(now);
  state.battle.enemy = savedEnemy;
  addLootNotice(`${swarmEnemy.name} defeated`, "mob");
}

function bossRespawnDelayMs(zoneId) {
  const def = bossRoomDef(zoneId);
  return Math.max(0, Math.trunc(Number(def?.respawnMinutes) || 0) * 60 * 1000);
}

function bossRespawnReadyAt(zoneId) {
  return Math.max(0, Math.trunc(Number(G.accountBossRespawns()[zoneId]) || 0));
}

function bossRespawnRemainingMs(zoneId, now = Date.now()) {
  return Math.max(0, bossRespawnReadyAt(zoneId) - now);
}

function bossKillCount(zoneId) {
  return Math.max(0, Math.trunc(Number(G.accountBossKills()[zoneId]) || 0));
}

function alchemistNpcSceneHtml(npc) {
  const rows = ALCHEMIST_STOCK_IDS.map((itemId) => G.itemDefinition(itemId))
    .filter(Boolean)
    .map(shopBuyRowHtml)
    .join("");
  return `
    <section class="npc-panel crystal-npc-text npc-shop-panel alchemist-panel">
      <div class="npc-shop-summary">
        <span>Your gold</span>
        <strong>${state.inventory.gold}g</strong>
      </div>
      <div class="npc-shop-list" data-preserve-scroll="npc-alchemist-buy">
        ${rows || `<span class="trader-empty">No potion stock loaded.</span>`}
      </div>
    </section>
  `;
}

function applySpellBodyMapping(now = performance.now()) {
  if (!state.syncBodyToSpell) return;
  const action = bodyActionForSpell(state.spell);
  if (!PLAYER_ACTIONS[action]) return;
  state.action = action;
  state.frame = 0;
  state.playerOneShot = false;
  state.lastTick = now;
}

function bindControls() {
  root.addEventListener("click", (event) => {
    if (handleInventoryCarryClick(event)) {
      event.stopImmediatePropagation();
      return;
    }

    const sceneButton = event.target.closest("[data-open-scene]");
    if (sceneButton && root.contains(sceneButton)) {
      G.openScene(sceneButton.dataset.openScene);
      return;
    }
    const selectPlayerClassButton = event.target.closest("[data-select-player-class]");
    if (selectPlayerClassButton && root.contains(selectPlayerClassButton)) {
      void G.selectPlayerClass(selectPlayerClassButton.dataset.selectPlayerClass);
      return;
    }
    const exportSaveButton = event.target.closest("[data-export-save]");
    if (exportSaveButton && root.contains(exportSaveButton)) {
      G.exportGameSave();
      return;
    }
    const importSaveButton = event.target.closest("[data-import-save]");
    if (importSaveButton && root.contains(importSaveButton)) {
      const textarea = root.querySelector("#saveImportText");
      void G.importGameSaveFromText(textarea?.value ?? "");
      return;
    }
    const resetSaveButton = event.target.closest("[data-reset-save]");
    if (resetSaveButton && root.contains(resetSaveButton)) {
      G.resetSavedGame();
      return;
    }
    const musicToggleButton = event.target.closest("[data-toggle-music]");
    if (musicToggleButton && root.contains(musicToggleButton)) {
      G.setMusicEnabled(!state.settings.musicEnabled);
      return;
    }
    const sfxToggleButton = event.target.closest("[data-toggle-sfx]");
    if (sfxToggleButton && root.contains(sfxToggleButton)) {
      G.setSfxEnabled(!state.settings.sfxEnabled);
      if (!state.settings.sfxEnabled) return;
      G.playSfx("ui.button");
      return;
    }
    const prototypeStatsToggleButton = event.target.closest("[data-toggle-prototype-stats]");
    if (prototypeStatsToggleButton && root.contains(prototypeStatsToggleButton)) {
      G.setPrototypeStatsEnabled(!state.settings.prototypeStatsEnabled);
      return;
    }
    const musicNextButton = event.target.closest("[data-music-next]");
    if (musicNextButton && root.contains(musicNextButton)) {
      if (!state.settings.musicEnabled) state.settings.musicEnabled = true;
      G.playNextMusicTrack();
      G.saveGameState(true);
      return;
    }
    const musicTrackButton = event.target.closest("[data-music-track]");
    if (musicTrackButton && root.contains(musicTrackButton)) {
      if (!state.settings.musicEnabled) state.settings.musicEnabled = true;
      G.setMusicTrack(Number(musicTrackButton.dataset.musicTrack), true, MUSIC_MODE_TRACK);
      G.saveGameState(true);
      return;
    }
    const closeOfflineReportButton = event.target.closest("[data-close-offline-report]");
    if (closeOfflineReportButton && root.contains(closeOfflineReportButton)) {
      closeOfflineReport();
      return;
    }
    const acceptPrototypeStatsButton = event.target.closest("[data-accept-prototype-stats]");
    if (acceptPrototypeStatsButton && root.contains(acceptPrototypeStatsButton)) {
      acceptPrototypeStatsNotice();
      return;
    }
    const acceptPrototypeResetButton = event.target.closest("[data-accept-prototype-reset-notice]");
    if (acceptPrototypeResetButton && root.contains(acceptPrototypeResetButton)) {
      acceptPrototypeResetNotice();
      return;
    }
    const disablePrototypeStatsButton = event.target.closest("[data-disable-prototype-stats]");
    if (disablePrototypeStatsButton && root.contains(disablePrototypeStatsButton)) {
      disablePrototypeStatsFromNotice();
      return;
    }
    const closeButton = event.target.closest("[data-close-scene]");
    if (closeButton && root.contains(closeButton)) {
      G.closeScene(closeButton.dataset.closeScene || null);
      return;
    }
    const bossAssistButton = event.target.closest("[data-boss-assist]");
    if (bossAssistButton && root.contains(bossAssistButton)) {
      G.toggleBossAssistSelection(bossAssistButton.dataset.bossAssist);
      return;
    }
    const bossEmpowerButton = event.target.closest("[data-toggle-boss-empower]");
    if (bossEmpowerButton && root.contains(bossEmpowerButton)) {
      G.toggleBossEmpowerSelection();
      return;
    }
    const confirmBossZoneButton = event.target.closest("[data-confirm-boss-zone]");
    if (confirmBossZoneButton && root.contains(confirmBossZoneButton)) {
      void confirmBossZoneEntry(confirmBossZoneButton.dataset.confirmBossZone);
      return;
    }
    const useButton = event.target.closest("[data-use-entry]");
    if (useButton && root.contains(useButton)) {
      G.useInventoryEntry(useButton.dataset.useEntry);
      return;
    }
    const hotbarUseButton = event.target.closest("[data-hotbar-use-entry]");
    if (hotbarUseButton && root.contains(hotbarUseButton)) {
      const hotbarEntry = G.inventoryEntryById(hotbarUseButton.dataset.hotbarUseEntry);
      const hotbarItem = hotbarEntry ? G.itemDefinition(hotbarEntry.itemId) : null;
      if (hotbarItem && G.isPotionItem(hotbarItem)) G.usePotionEntry(hotbarUseButton.dataset.hotbarUseEntry);
      else G.useInventoryEntry(hotbarUseButton.dataset.hotbarUseEntry);
      return;
    }
    const quickPotionButton = event.target.closest("[data-use-potion-kind]");
    if (quickPotionButton && root.contains(quickPotionButton)) {
      G.useFirstPotionOfKind(quickPotionButton.dataset.usePotionKind);
      return;
    }
    const equipButton = event.target.closest("[data-equip-entry]");
    if (equipButton && root.contains(equipButton)) {
      G.equipInventoryEntry(equipButton.dataset.equipEntry);
      return;
    }
    const sellButton = event.target.closest("[data-sell-entry]");
    if (sellButton && root.contains(sellButton)) {
      G.sellInventoryEntry(sellButton.dataset.sellEntry);
      return;
    }
    const buyButton = event.target.closest("[data-buy-item]");
    if (buyButton && root.contains(buyButton)) {
      buyShopItem(buyButton.dataset.buyItem);
      return;
    }
    const buyStackButton = event.target.closest("[data-buy-stack]");
    if (buyStackButton && root.contains(buyStackButton)) {
      const item = G.itemDefinition(buyStackButton.dataset.buyStack);
      buyShopItem(buyStackButton.dataset.buyStack, G.maxItemStack(item));
      return;
    }
    const accountUpgradeButton = event.target.closest("[data-buy-account-upgrade]");
    if (accountUpgradeButton && root.contains(accountUpgradeButton)) {
      G.buyAccountUpgrade(accountUpgradeButton.dataset.buyAccountUpgrade);
      return;
    }
    const performRebirthButton = event.target.closest("[data-perform-rebirth]");
    if (performRebirthButton && root.contains(performRebirthButton)) {
      G.performAccountRebirth();
      return;
    }
    const smithCombineButton = event.target.closest("[data-smith-combine]");
    if (smithCombineButton && root.contains(smithCombineButton)) {
      combineSmithItem(smithCombineButton.dataset.smithCombine);
      return;
    }
    const castSkillButton = event.target.closest("[data-cast-combat-skill]");
    if (castSkillButton && root.contains(castSkillButton)) {
      G.queueCombatSkillCast(castSkillButton.dataset.castCombatSkill);
      return;
    }
    const autoSkillButton = event.target.closest("[data-toggle-skill-auto]");
    if (autoSkillButton && root.contains(autoSkillButton)) {
      G.toggleSkillAutoCast(autoSkillButton.dataset.toggleSkillAuto);
      return;
    }
    const unequipButton = event.target.closest("[data-unequip-slot]");
    if (unequipButton && root.contains(unequipButton)) {
      G.unequipSlot(unequipButton.dataset.unequipSlot);
    }
  });
  root.addEventListener("input", (event) => {
    const volumeInput = event.target.closest("[data-music-volume]");
    if (volumeInput && root.contains(volumeInput)) {
      G.setMusicVolume(Number(volumeInput.value) / 100);
      return;
    }
    const sfxVolumeInput = event.target.closest("[data-sfx-volume]");
    if (sfxVolumeInput && root.contains(sfxVolumeInput)) {
      G.setSfxVolume(Number(sfxVolumeInput.value) / 100);
    }
  });
  root.addEventListener("change", (event) => {
    const importFileInput = event.target.closest("[data-import-save-file]");
    if (!importFileInput || !root.contains(importFileInput)) return;
    const file = importFileInput.files?.[0];
    importFileInput.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = root.querySelector("#saveImportText");
      if (textarea) textarea.value = String(reader.result ?? "");
    };
    reader.onerror = () => {
      window.alert("Could not read that file.");
    };
    reader.readAsText(file);
  });
  window.addEventListener("pointerdown", () => {
    if (state.settings.musicEnabled) G.syncBackgroundMusic();
  }, { once: true });
  window.addEventListener("pagehide", () => {
    G.saveGameState(true);
    flushPrototypeStats("session-end");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      G.saveGameState(true);
      flushPrototypeStats("hidden");
    }
  });
  root.addEventListener("dblclick", (event) => {
    const inventoryItem = event.target.closest("[data-inventory-entry]");
    if (!inventoryItem || !root.contains(inventoryItem)) return;
    if (inventoryItem.closest("[data-hotbar-slot]")) return;
    if (inventoryItem.dataset.equippedSlot) {
      G.unequipSlot(inventoryItem.dataset.equippedSlot);
      return;
    }
    G.useInventoryEntry(inventoryItem.dataset.inventoryEntry);
  });
  root.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-character-tab]");
    if (!tabButton || !root.contains(tabButton)) return;
    state.characterTab = tabButton.dataset.characterTab;
    sceneSignature = "";
    G.renderSceneOverlay();
  });
  root.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-inventory-page]");
    if (!pageButton || !root.contains(pageButton)) return;
    const page = Math.max(0, Math.min(G.inventoryPageCount() - 1, Number(pageButton.dataset.inventoryPage) || 0));
    if (!G.inventoryPageUnlocked(page)) {
      G.unlockInventoryPage(page);
      return;
    }
    state.inventoryPage = page;
    sceneSignature = "";
    G.renderSceneOverlay();
  });
  root.addEventListener("click", (event) => {
    const confirmStorageUnlockButton = event.target.closest("[data-confirm-storage-page-unlock]");
    if (confirmStorageUnlockButton && root.contains(confirmStorageUnlockButton)) {
      const page = Math.max(0, Math.min(G.storagePageCount() - 1, Number(confirmStorageUnlockButton.dataset.confirmStoragePageUnlock) || 0));
      state.pendingStoragePageUnlock = null;
      G.unlockStoragePage(page);
      return;
    }
    const cancelStorageUnlockButton = event.target.closest("[data-cancel-storage-page-unlock]");
    if (cancelStorageUnlockButton && root.contains(cancelStorageUnlockButton)) {
      state.pendingStoragePageUnlock = null;
      sceneSignature = "";
      G.renderSceneOverlay();
      return;
    }
    const storagePageButton = event.target.closest("[data-storage-page]");
    if (!storagePageButton || !root.contains(storagePageButton)) return;
    const page = Math.max(0, Math.min(G.storagePageCount() - 1, Number(storagePageButton.dataset.storagePage) || 0));
    if (!G.storagePageUnlocked(page)) {
      state.pendingStoragePageUnlock = page;
      sceneSignature = "";
      G.renderSceneOverlay();
      return;
    }
    state.pendingStoragePageUnlock = null;
    state.storagePage = page;
    sceneSignature = "";
    G.renderSceneOverlay();
  });
  root.addEventListener("contextmenu", (event) => {
    const hotbarSlot = event.target.closest("[data-hotbar-slot]");
    if (!hotbarSlot || !root.contains(hotbarSlot)) return;
    const entry = G.hotbarEntryAtSlot(Number(hotbarSlot.dataset.hotbarSlot));
    if (!entry) return;
    event.preventDefault();
    const freeSlot = G.nextFreeInventorySlot();
    if (freeSlot >= state.inventory.maxSlots) {
      G.rejectInventoryMove("Cannot clear hotbar slot: inventory is full.");
      return;
    }
    dropInventoryEntryToInventorySlot(entry.id, freeSlot);
  });
  root.addEventListener("pointerover", (event) => {
    const tooltipTarget = event.target.closest("[data-tooltip-item]");
    if (!tooltipTarget || !root.contains(tooltipTarget)) return;
    G.showItemTooltip(tooltipTarget.dataset.tooltipItem, event, tooltipTarget.dataset.tooltipEntry ?? null);
  });
  root.addEventListener("pointermove", (event) => {
    if (!els.itemTooltip.hidden) G.positionItemTooltip(event);
  });
  root.addEventListener("pointerout", (event) => {
    const tooltipTarget = event.target.closest("[data-tooltip-item]");
    if (!tooltipTarget || !root.contains(tooltipTarget)) return;
    if (tooltipTarget.contains(event.relatedTarget)) return;
    hideItemTooltip();
  });
  window.addEventListener("popstate", () => {
    state.openScenes = G.initialOpenScenesFromUrl();
    sceneSignature = "";
    gamePanelSignature = "";
    G.renderSceneOverlay();
    G.renderGamePanel();
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (!/^[1-6]$/.test(event.key)) return;
    event.preventDefault();
    G.useHotbarSlot(Number(event.key) - 1);
  });
  window.addEventListener("beforeunload", () => {
    G.saveGameState();
  });
  window.addEventListener("pointermove", updateInventoryCarryPointer);

  els.scale.addEventListener("input", () => {
    state.scale = Number(els.scale.value);
    G.updateStageSize();
    if (!state.battle.running && state.battle.phase === "idle") {
      state.battle.enemyX = state.battle.playerX + G.enemySpawnDistance();
    }
    G.render();
  });
  els.smooth.addEventListener("change", () => {
    state.smooth = els.smooth.checked;
    G.invalidateStampBackgroundCache();
    G.render();
  });
  els.pause.textContent = state.paused ? "Resume" : "Pause";
  els.pause.addEventListener("click", () => {
    state.paused = !state.paused;
    els.pause.textContent = state.paused ? "Resume" : "Pause";
    state.lastTick = performance.now();
  });
}

function bindStageCanvasEvents() {
  if (!stageCanvas || stageCanvas.dataset.townEventsBound === "true") return;
  stageCanvas.dataset.townEventsBound = "true";
  stageCanvas.addEventListener("click", (event) => {
    if (state.game.mode !== "town") return;
    const point = canvasPointFromEvent(event);
    const npc = G.townNpcAt(point.x, point.y);
    if (!npc) {
      closeTownNpc();
      return;
    }
    G.openTownNpc(npc.id);
  });
  stageCanvas.addEventListener("pointermove", (event) => {
    if (state.game.mode !== "town") {
      stageCanvas.style.cursor = "";
      G.setHoveredTownNpc(null);
      return;
    }
    const point = canvasPointFromEvent(event);
    const npc = G.townNpcAt(point.x, point.y);
    stageCanvas.style.cursor = npc ? "pointer" : "";
    G.setHoveredTownNpc(npc?.id ?? null);
  });
  stageCanvas.addEventListener("pointerleave", () => {
    stageCanvas.style.cursor = "";
    G.setHoveredTownNpc(null);
  });
}

function canvasPointFromEvent(event) {
  const rect = stageCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * state.stageWidth,
    y: ((event.clientY - rect.top) / rect.height) * state.stageHeight,
  };
}

function closeTownNpc() {
  if (!state.game.selectedTownNpcId) return;
  state.game.selectedTownNpcId = null;
  if (state.activeScene === "townNpc" || state.activeScene === "storage" || state.activeScene === "weaponRefine") state.activeScene = null;
  G.resetWeaponRefineState();
  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.render();
}

function hideItemTooltip() {
  els.itemTooltip.hidden = true;
  els.itemTooltip.innerHTML = "";
}

function atlasIndexKey() {
  return JSON.stringify({
    spriteSet: state.spriteSet,
    indexes: Object.fromEntries(G.layerNames().map((layer) => [layer, state.indexes[layer] ?? null])),
  });
}

function ensureEquippedVisualsFresh() {
  const changedLayers = applyEquippedVisualIndexes();
  const staleLayers = ["weapon", "armour"].filter((layer) => (
    (state.atlasIndexes?.[layer] ?? null) !== (state.indexes[layer] ?? null)
  ));
  const reloadLayers = [...new Set([...changedLayers, ...staleLayers])];
  if (reloadLayers.length) G.queueVisualAtlasReload(reloadLayers);
}

function catchUpSimulation(now) {
  const elapsed = Math.max(0, now - lastSimulationAt);
  if (elapsed <= SIMULATION_STEP_MS) return;

  if (elapsed > MAX_SIMULATION_CATCH_UP_MS) {
    const pending = {
      elapsedMs: Math.min(elapsed, OFFLINE_PROGRESS_CAP_MS),
      rawElapsedMs: elapsed,
      capped: elapsed > OFFLINE_PROGRESS_CAP_MS,
      savedAt: Date.now() - elapsed,
      kind: state.game.mode === "mining" ? "mining" : "zone",
    };
    if (pending.kind === "mining") applyOfflineMiningProgress(pending);
    else applyOfflineProgress(pending);
    return;
  }

  const catchUpMs = Math.min(elapsed, MAX_SIMULATION_CATCH_UP_MS);
  const catchUpEnd = lastSimulationAt + catchUpMs;
  suppressSimulationRender = true;
  try {
    for (let simNow = lastSimulationAt + SIMULATION_STEP_MS; simNow < catchUpEnd; simNow += SIMULATION_STEP_MS) {
      G.runSimulationStep(simNow);
    }
  } finally {
    suppressSimulationRender = false;
  }
}

function beginBossPartyFight(zoneId, now = performance.now()) {
  const pendingSelected = [...new Set(state.pendingBossAssistSelection ?? [])]
    .filter((classId) => classId !== state.activeCharacterId && characterAvailableForBossAssist(classId));
  const restoredRun = G.sanitizeGroupDungeonOfflineRun?.(state.game.groupDungeonRun, zoneId, state.activeCharacterId);
  const selected = pendingSelected.length
    ? pendingSelected
    : restoredRun?.zoneId === zoneId
      ? restoredRun.classIds.filter((classId) => classId !== state.activeCharacterId && state.characters?.[classId])
      : [];
  state.pendingBossAssistSelection = [];
  const classIds = G.bossPartyClassOrder([state.activeCharacterId, ...selected]);
  const entryZone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId) ?? G.activeZone();
  state.game.groupDungeonRun = G.sanitizeGroupDungeonOfflineRun?.({
    kind: "groupDungeon",
    zoneId,
    leaderClassId: state.activeCharacterId,
    classIds,
    waveNumber: restoredRun?.waveNumber ?? 1,
    killedThisWave: restoredRun?.killedThisWave ?? 0,
    targetThisWave: restoredRun?.targetThisWave ?? groupDungeonWaveSpawnCount(restoredRun?.waveNumber ?? 1, entryZone),
    endless: Boolean(restoredRun?.endless),
  }, zoneId, state.activeCharacterId) ?? null;

  G.captureActiveCharacterState();
  const members = classIds.map((classId, index) => {
    const member = G.bossPartyMemberFromCharacter(classId, state.characters[classId], now + index * BOSS_PARTY_MEMBER_ACTION_GAP_MS);
    G.refreshBossPartyMemberMagicSettings(member);
    return member;
  });
  const controlledClassId = state.activeCharacterId;
  const isGroupDungeon = G.groupDungeonZone(entryZone);
  if (isGroupDungeon) clearGroupDungeonRunState();
  G.positionBossPartyMembers(members, controlledClassId);
  if (isGroupDungeon) G.snapBossPartyMembersToSwarmGrid(members);
  const frontMeleeMember = G.bossPartyClassOrder(members.map((member) => member.classId))
    .filter((classId) => G.bossPartyIsMeleeClass(classId))
    .map((classId) => members.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .find(Boolean) ?? null;
  const meleeFrontSlotWorldX = frontMeleeMember
    ? Math.round(Number(frontMeleeMember.worldX) || 0)
    : null;
  G.resetBossPartySoloRecoveryState();
  state.battle.bossParty = {
    active: true,
    zoneId,
    leaderClassId: controlledClassId,
    controlledClassId,
    members,
    pet: null,
    petDiedThisFight: false,
    effects: [],
    pendingPoison: null,
    finished: false,
    startedAt: now,
    lastAdvanceAt: now,
    lockedCameraX: null,
    lockedArenaWorldX: null,
    meleeFrontSlotWorldX,
    meleeStepCameraX: null,
    cameraLerpFromX: 0,
    cameraLerpToX: 0,
    cameraLerpUntil: 0,
    defeated: false,
  };

  const controlled = G.bossPartyControlledMember();
  if (controlled) {
    state.battle.player = controlled;
    state.battle.combatClass = controlled.classId;
    state.battle.playerX = controlled.worldX;
  }
  const enemy = state.battle.enemy;
  if (G.enemyUsesFixedArenaSpawn(enemy)) {
    const spawnX = G.arenaBossSpawnWorldX();
    G.positionBossPartyMembersForFixedSpawn(members, spawnX, controlledClassId);
    if (controlled) state.battle.playerX = controlled.worldX;
    applyFixedArenaEnemySpawn(now, { skipPlayerPosition: true });
  } else {
    state.battle.phase = "engaged";
    state.battle.enemyAggro = true;
    state.battle.enemyRevealed = true;
    state.battle.enemyX = G.bossPartyEnemyApproachX(members);
    state.battle.bossParty.lastAdvanceAt = now;
    state.battle.cameraX = state.battle.playerX - G.playerScreenX();
    state.battle.bossParty.lockedCameraX = null;
    G.ensureMapStampArenaLock();
    state.battle.nextEnemyAttackAt = now + Math.max(400, Math.trunc(Number(enemy?.attackMs) || 1400));
    G.setPlayerAction("stance", now);
    if (!isGroupDungeon) G.setEnemyLocomotion("standing", now);
  }
  if (isGroupDungeon) {
    G.resetGroupDungeonRun(now);
    G.syncGroupDungeonPrimaryEnemy();
    void G.reloadEnemyAtlas();
  }
  void G.preloadBossPartyVisualAtlases(members);
  if (isGroupDungeon) {
    G.pushBattleLog(`Party enters ${entryZone.label}: ${members.map((member) => member.classId).join(", ")}.`);
    G.pushBattleLog("Waves reset — starting at wave 1.");
  } else {
    G.pushBattleLog(`Boss party formed: ${members.map((member) => member.classId).join(", ")}.`);
    if (G.enemyUsesFixedArenaSpawn(enemy)) {
      G.pushBattleLog(`${enemy?.name ?? "The boss"} waits beneath the floor...`);
    } else {
      G.pushBattleLog(`${enemy?.name ?? "Boss"} engages the party.`);
    }
  }
  G.captureActiveCharacterState();
  G.persistCharacterGameLocation({
    mode: "zone",
    zoneId,
    classIds,
    running: true,
  });
  G.saveGameState(true);
  G.initMapLightningSchedule(now);
  battlePanelSignature = "";
  gamePanelSignature = "";
  return true;
}

function fixedArenaPetWorldX() {
  const enemyX = Number(state.battle.enemyX) || G.arenaBossSpawnWorldX();
  return Math.round(enemyX - TAOIST_PET_ENEMY_GAP);
}

function fixedArenaPartyShiftForPet(petWorldX) {
  const gap = G.bossPartyOnField() ? BOSS_PARTY_PET_STAND_GAP : TAOIST_PET_SUMMON_MIN_GAP;
  const anchorX = G.bossPartyOnField()
    ? Number(G.bossPartyNextAliveMember()?.worldX ?? state.battle.playerX)
    : Number(state.battle.playerX);
  const requiredAnchorX = petWorldX - gap;
  return Math.max(0, Math.round(anchorX - requiredAnchorX));
}

function beginMinotaurKingAttack(enemy = state.battle.enemy) {
  if (!enemy) return 0;
  enemy.minotaurKingAttackCount = G.minotaurKingAttackCount(enemy) + 1;
  return enemy.minotaurKingAttackCount;
}

function boneLordAttackRange(enemy = state.battle.enemy) {
  const tiles = Math.max(1, Math.trunc(Number(enemy?.attackRangeTiles) || 7));
  return tiles * LANE_TILE_PX;
}

function boneLordMeleeRange() {
  return G.bossPartyActiveFight() ? BOSS_PARTY_BOSS_REACH : LANE.enemyRange;
}

function boneLordTargetDistance() {
  if (G.bossPartyActiveFight()) {
    const target = G.bossPartyFrontTarget();
    return target ? G.bossPartyTargetEnemyDistance(target) : Number.POSITIVE_INFINITY;
  }
  return G.enemyTargetDistance();
}

function boneLordUsesRangedAttack(distancePx = boneLordTargetDistance()) {
  return distancePx > boneLordMeleeRange();
}

function boneLordImpactDelay(distancePx, enemy = state.battle.enemy) {
  const tiles = Math.max(1, Math.round(Math.max(0, distancePx) / LANE_TILE_PX));
  const base = Math.max(0, Math.trunc(Number(enemy?.attackImpactDelayMs) || BONE_LORD_ATTACK_IMPACT_MS));
  return Math.round(tiles * 50 + base);
}

function canBoneLordAttack() {
  const battle = state.battle;
  if (battle.phase !== "engaged" || !battle.enemyRevealed || !battle.enemy?.hp) return false;
  if (G.enemyFrozenActive(battle.enemy)) return false;
  if (!battle.enemyAggro) return false;
  return boneLordTargetDistance() <= boneLordAttackRange(battle.enemy);
}

function boneLordProjectileTargetAnchor() {
  if (G.bossPartyActiveFight()) {
    const useAoe = G.minotaurKingStrikeUsesAoe(state.battle.pendingEnemyStrike);
    const target = useAoe ? G.bossPartyAoeRangedTarget() : G.bossPartyFrontTarget();
    if (target === state.battle.bossParty?.pet) return G.taoistPetAnchor();
    if (target) {
      return {
        x: Math.round((Number(target.worldX) || state.battle.playerX) - state.battle.cameraX),
        y: Math.round(state.stageHeight * LANE.y + 2),
      };
    }
  }
  if (G.taoistPetCanTank()) return G.taoistPetAnchor();
  return G.combatAnchor("player");
}

function evilCentipedeAttackRange(enemy = state.battle.enemy) {
  const tiles = Math.max(1, Math.trunc(Number(enemy?.attackRangeTiles) || 7));
  return tiles * LANE_TILE_PX;
}

function evilCentipedeImpactDelay(enemy = state.battle.enemy) {
  return Math.max(0, Math.trunc(Number(enemy?.attackImpactDelayMs) || EVIL_CENTIPEDE_ATTACK_IMPACT_MS));
}

function evilCentipedeDistanceToTarget(entity, kind = "member") {
  const enemyX = Number(state.battle.enemyX);
  if (kind === "player") return Math.max(0, enemyX - Number(state.battle.playerX));
  return Math.max(0, enemyX - Number(entity?.worldX ?? state.battle.playerX));
}

function evilCentipedeTargetStats(entity) {
  return defenceStatsForEntity(entity);
}

function evilCentipedeTargetsInRange() {
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0 || !state.battle.enemyRevealed) return [];
  const range = evilCentipedeAttackRange(enemy);
  const targets = [];

  if (G.bossPartyActiveFight()) {
    const party = state.battle.bossParty;
    if (party?.pet?.active && (party.pet.hp ?? 0) > 0) {
      const dist = evilCentipedeDistanceToTarget(party.pet, "pet");
      if (dist <= range) {
        targets.push({
          kind: "pet",
          entity: party.pet,
          logName: party.pet.name,
          stats: evilCentipedeTargetStats(party.pet),
        });
      }
    }
    for (const member of party?.members ?? []) {
      if (!member.alive || (member.hp ?? 0) <= 0) continue;
      if (evilCentipedeDistanceToTarget(member, "member") > range) continue;
      targets.push({
        kind: "member",
        entity: member,
        logName: member.classId,
        stats: evilCentipedeTargetStats(member),
      });
    }
    return targets;
  }

  const battle = state.battle;
  if (G.taoistPetCanTank()) {
    const pet = battle.taoPet;
    if ((pet?.hp ?? 0) > 0 && evilCentipedeDistanceToTarget(pet, "pet") <= range) {
      targets.push({
        kind: "pet",
        entity: pet,
        logName: pet.name,
        stats: evilCentipedeTargetStats(pet),
      });
    }
  }
  if ((battle.player?.hp ?? 0) > 0 && G.enemyDistance() <= range) {
    targets.push({
      kind: "player",
      entity: battle.player,
      logName: battle.combatClass,
      stats: evilCentipedeTargetStats(battle.player),
    });
  }
  return targets;
}

function canEvilCentipedeAttack() {
  const battle = state.battle;
  return battle.phase === "engaged"
    && battle.enemyRevealed
    && battle.enemy?.hp > 0
    && evilCentipedeTargetsInRange().length > 0;
}

function applyCombatantPoison(combatant, poison, now = performance.now()) {
  if (!combatant || (combatant.hp ?? 0) <= 0 || !poison) return false;
  if (!G.rollPoisonResist(combatant)) return false;
  if (!Array.isArray(combatant.poisons)) combatant.poisons = [];
  const ticksRemaining = Math.max(1, Math.trunc(Number(poison.ticksRemaining) || 1));
  const value = Math.max(0, Math.trunc(Number(poison.value) || 0));
  const kind = poison.kind === "green" ? "green" : poison.kind === "paralysis" ? "paralysis" : null;
  if (!kind) return false;

  const existing = G.combatantPoison(combatant, kind);
  if (kind === "paralysis" && existing) return false;
  if (existing) {
    if (kind === "green" && (Number(existing.value) || 0) > value) return false;
    if (kind !== "green" && (Number(existing.ticksRemaining) || 0) > ticksRemaining) return false;
    Object.assign(existing, {
      ...poison,
      kind,
      value,
      ticksRemaining,
      tickMs: CRYSTAL_POISON_TICK_MS,
      nextTickAt: now + CRYSTAL_POISON_TICK_MS,
      appliedAt: now,
    });
    return true;
  }

  combatant.poisons.push({
    ...poison,
    kind,
    value,
    ticksRemaining,
    tickMs: CRYSTAL_POISON_TICK_MS,
    nextTickAt: now + CRYSTAL_POISON_TICK_MS,
    appliedAt: now,
  });
  return true;
}

function applyEvilCentipedePoisons(enemy, combatant, now) {
  const poisonValue = rollStat(enemy.sc ?? [0, 0], enemy.luck ?? 0);
  let applied = false;
  if (G.rollPoisonProc(EVIL_CENTIPEDE_GREEN_POISON_CHANCE)) {
    applied = applyCombatantPoison(combatant, {
      kind: "green",
      value: poisonValue,
      ticksRemaining: EVIL_CENTIPEDE_GREEN_POISON_TICKS,
    }, now) || applied;
  }
  if (G.rollPoisonProc(EVIL_CENTIPEDE_PARALYSIS_POISON_CHANCE)) {
    applied = applyCombatantPoison(combatant, {
      kind: "paralysis",
      value: poisonValue,
      ticksRemaining: EVIL_CENTIPEDE_PARALYSIS_POISON_TICKS,
    }, now) || applied;
  }
  return applied;
}

function addCombatantPoisonText(targetKind, entity, text, kind, now, offsetX = 0) {
  if (targetKind === "player" || (targetKind === "member" && entity?.classId === G.bossPartyControlledClassId())) {
    addCombatText("player", text, kind, now, offsetX);
    return;
  }
  if (targetKind === "pet") {
    addCombatText("pet", text, kind, now, offsetX);
    return;
  }
  addCombatText("enemy", text, kind, now, offsetX);
}

function handleCombatantPoisonDeath(entity, targetKind, now, options = {}) {
  if ((entity?.hp ?? 0) > 0) return;
  if (options.offline) return;
  if (targetKind === "pet") {
    if (G.bossPartyActiveFight()) G.bossPartyMarkPetDead(now);
    else G.markTaoistPetDead(now);
    return;
  }
  if (targetKind === "member") {
    G.bossPartyMarkMemberDead(entity, now);
    return;
  }
  if (targetKind === "player") {
    finishBattle(now);
    G.setPlayerAction("die", now);
    G.playSfx("player.death", { volume: 0.58 });
    G.pushBattleLog(`${state.battle.combatClass} falls.`);
  }
}

function beginEvilCentipedeAttack(now) {
  if (state.battle.pendingEnemyStrike) return false;
  if (!canEvilCentipedeAttack()) return false;
  state.battle.pendingEnemyStrike = { at: now + evilCentipedeImpactDelay() };
  G.setEnemyAction("attack1", true, now);
  G.playMonsterSfx("attack", state.battle.enemy, { force: true, throttleMs: 0 });
  return true;
}

function beginBoneLordAttack(now) {
  if (state.battle.pendingEnemyStrike) return false;
  if (!canBoneLordAttack()) return false;
  const enemy = state.battle.enemy;
  const distance = boneLordTargetDistance();
  const kingAttackCount = G.isMinotaurKingEnemy(enemy) ? beginMinotaurKingAttack(enemy) : 0;
  const useAoe = G.isMinotaurKingEnemy(enemy) && G.minotaurKingAttackIsAoe(kingAttackCount, enemy);
  if (useAoe || boneLordUsesRangedAttack(distance)) {
    const startedAt = now;
    const moveDurationMs = boneLordImpactDelay(distance, enemy);
    const projectile = state.enemy.atlas?.projectile;
    state.battle.pendingEnemyStrike = {
      at: startedAt + moveDurationMs,
      startedAt,
      ranged: true,
      aoe: useAoe,
      moveDurationMs,
      vfxUntil: useAoe
        ? G.enemyRangedStrikeVfxUntil(startedAt, moveDurationMs, projectile)
        : startedAt + moveDurationMs,
    };
    G.setEnemyAction("attackRange1", true, now);
    G.playMonsterSfx(G.enemyAttackSfxKind(enemy, true), enemy, { force: true, throttleMs: 0 });
    return true;
  }
  if (G.bossPartyActiveFight()) return G.resolveBoneLordBossPartyMelee(now);
  return G.resolveBoneLordSoloMelee(now);
}

function finishBossPartyEnemy(now) {
  const party = state.battle.bossParty;
  const enemy = state.battle.enemy;
  if (!party?.active || party.finished) return;
  party.finished = true;
  party.active = false;
  party.finishedAt = now;
  if (bossDropTableForEnemy(enemy)) {
    const lootClassId = party.leaderClassId ?? state.activeCharacterId;
    G.awardBossPartyBossKillShare(enemy, now, lootClassId);
  } else {
    G.awardBossPartyKillShare(now, { enemy });
  }
  G.setBossRespawn(party.zoneId);
  G.freezeBossPartyMembersForAftermath(party, now);
  G.setEnemyAction("die", false, now);
  G.playMonsterSfx("death");
  state.showEnemies = true;
  state.battle.running = false;
  state.battle.phase = "victory";
  state.battle.enemyAggro = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.nextEnemySpawnAt = 0;
  clearTwinDrakePendingState();
  state.battle.attachedSpellFx = (state.battle.attachedSpellFx ?? []).filter((entry) => entry.spellId !== "TwinDrakeBlade");
  G.syncBossPartyMembersToCharacters(party, { applyControlled: true });
  G.persistCharacterGameLocation({
    mode: state.game.mode,
    zoneId: state.game.activeZoneId,
    classIds: G.bossPartyMemberClassIds(party),
    running: false,
  });
  G.pushBattleLog(`${enemy.name} is defeated.`);
  G.pushBattleLog(`${enemy.name} will respawn in ${formatBossRespawnDelay(bossRoomDef(party.zoneId)?.respawnMinutes ?? BOSS_RESPAWN_MINUTES_STANDARD)}.`);
  G.pushBattleLog("Return To Town when you are ready.");
  addLootNotice(`${enemy.name} defeated`, "boss");
  gamePanelSignature = "";
  battlePanelSignature = "";
  sceneSignature = "";
  G.saveGameState(true);
}

function finishBossPartyDefeat(now) {
  const party = state.battle.bossParty;
  if (!party?.active || party.finished) return;
  party.finished = true;
  party.active = false;
  party.finishedAt = now;
  party.defeated = true;
  G.syncBossPartyMembersToCharacters(party, { applyControlled: true });
  state.showEnemies = true;
  state.battle.running = false;
  state.battle.phase = "defeat";
  state.battle.enemyAggro = false;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.nextEnemySpawnAt = 0;
  G.setEnemyLocomotion("standing", now);
  G.setPlayerAction("die", now);
  G.playSfx("player.death", { volume: 0.58 });
  G.pushBattleLog("The party has been defeated.");
  G.pushBattleLog("Return To Town when you are ready.");
  if (G.groupDungeonZone(G.activeZone())) clearGroupDungeonRunState();
  G.persistCharacterGameLocation({
    mode: state.game.mode,
    zoneId: state.game.activeZoneId,
    classIds: G.bossPartyMemberClassIds(party),
    running: false,
  });
  G.applyCharacterState(state.activeCharacterId, state.characters[state.activeCharacterId]);
  gamePanelSignature = "";
  battlePanelSignature = "";
  sceneSignature = "";
  G.saveGameState(true);
}

function bossDropTableForEnemy(enemy = state.battle.enemy) {
  if (!enemy) return null;
  if (G.isIncarnatedWoomaTaurusEnemy?.(enemy)) return G.INCARNATED_WT_BOSS_DROPS;
  if (G.isIncarnatedZumaTaurusEnemy?.(enemy)) return G.ZUMA_TAURUS_BOSS_DROPS;
  if (G.isWoomaTaurusEnemy(enemy)) return WOMA_TAURUS_BOSS_DROPS;
  if (G.isEvilSnakeEnemy(enemy)) return EVIL_SNAKE_BOSS_DROPS;
  if (G.isZumaTaurusEnemy(enemy)) return ZUMA_TAURUS_BOSS_DROPS;
  if (G.isEvilCentipedeEnemy(enemy)) return EVIL_CENTIPEDE_BOSS_DROPS;
  if (G.isBoneLordEnemy(enemy)) return BONE_LORD_BOSS_DROPS;
  if (G.isMinotaurKingEnemy(enemy)) return MINOTAUR_KING_BOSS_DROPS;
  if (G.isOmaKingSpiritEnemy(enemy)) return OMA_KING_SPIRIT_BOSS_DROPS;
  if (G.isKingHogEnemy?.(enemy)) return G.KING_HOG_BOSS_DROPS;
  if (G.isDarkDevilEnemy?.(enemy)) return G.DARK_DEVIL_BOSS_DROPS;
  return null;
}

function applyBossPartyMemberKillReward(member, {
  xp,
  gold,
  drops = { added: [], ignored: [] },
  now = performance.now(),
  includeItems = false,
  zoneId = state.battle.bossParty?.zoneId ?? state.game.activeZoneId,
}) {
  if (!member) return;
  const leveledTo = applyBossPartyExperienceReward(member, xp, now);
  member.inventory.gold += gold;
  member.game.progress.gold = member.inventory.gold;
  member.game.kills += 1;
  member.game.zoneKills += 1;
  if (includeItems && zoneId) member.game.dropPity[zoneId] = 0;
  member.game.lastReward = { xp, gold, drops: drops.added };
  member.game.recentLoot = [
    `+${gold} gold`,
    ...leveledTo.map((level) => `Level ${level}`),
    ...drops.added.map((item) => `Found ${item.name}`),
    ...drops.ignored.map((item) => `No room for ${item.name}`),
    ...member.game.recentLoot,
  ].slice(0, 6);
  G.pushBattleLog(`${member.classId} gained ${xp} XP and ${gold} gold.`);
  if (includeItems) {
    for (const item of drops.added) G.pushBattleLog(`${member.classId} received ${item.name}.`);
    for (const item of drops.ignored) G.pushBattleLog(`${member.classId} had no room for ${item.name}.`);
  } else {
    for (const item of drops.added) G.pushBattleLog(`${member.classId} found ${item.name}.`);
    for (const item of drops.ignored) G.pushBattleLog(`${member.classId} had no room for ${item.name}.`);
  }
  if (member.classId === G.bossPartyControlledClassId()) {
    if (xp > 0) addLootNotice(`+${xp} XP`, "level");
    if (gold > 0) addLootNotice(`+${gold} gold`, "gold");
    for (const item of drops.added) addLootNotice(`Found ${item.name}`, "item");
    for (const item of drops.ignored) addLootNotice(`Inventory full: ${item.name}`, "full");
    for (const level of leveledTo) addLootNotice(`Level ${level}`, "level");
  }
}

function applyBossPartyExperienceReward(member, xp, now) {
  const levels = [];
  member.game.progress.experience += xp;
  let nextLevelXp = G.xpForNextLevel(member.game.progress.level);
  while (Number.isFinite(nextLevelXp) && member.game.progress.experience >= nextLevelXp) {
    member.game.progress.experience -= nextLevelXp;
    member.game.progress.level += 1;
    member.level = member.game.progress.level;
    levels.push(member.level);
    const stats = characterSnapshotTotalStats(member.classId, {
      inventory: member.inventory,
      magic: member.magic,
      game: member.game,
      battle: {},
    });
    Object.assign(member, stats, { hp: stats.maxHp, mp: stats.maxMp });
    nextLevelXp = G.xpForNextLevel(member.game.progress.level);
    if (member.classId === G.bossPartyControlledClassId()) G.triggerLevelUpFx(now, member.level);
  }
  return levels;
}

function addBossPartyZoneDropItem(member, item, added, ignored) {
  // Controlled character uses state.inventory during boss fights; member-only drops
  // were wiped when syncing state back over the member at fight end.
  if (member?.classId === state.activeCharacterId) {
    return addZoneDropItem(item, added, ignored);
  }
  G.syncBossPartyInventoryCapacityFromState(member?.classId);
  if (!G.bossPartyHasInventorySpaceFor(item?.id, member)) {
    ignored.push(item);
    return false;
  }
  const before = G.bossPartyInventoryItemQuantity(member, item.id);
  const entries = G.bossPartyAddInventoryItem(member, item.id, 1);
  const after = G.bossPartyInventoryItemQuantity(member, item.id);
  if (entries.length && after > before) {
    added.push(item);
    return true;
  }
  ignored.push(item);
  return false;
}

function addBossPartyMemberCombatText(member, text, kind, now = performance.now()) {
  if (!member || suppressSimulationRender) return;
  const bounds = G.bossPartyMemberFrameBounds(member);
  state.battle.floatingTexts.push({
    id: `${now}-${Math.random()}`,
    anchor: "player",
    text: String(text),
    kind,
    x: bounds.centerX,
    y: bounds.topY - 16,
    createdAt: now,
  });
  state.battle.floatingTexts = state.battle.floatingTexts.slice(-12);
}

function advancePlayerTravel(now, dt) {
  const action = G.travelAction(now);
  const speed = action === "running" ? LANE.runSpeed : LANE.playerSpeed;
  state.battle.playerX += speed * dt;
  G.setPlayerLocomotion(action, now);
}

function consumeLastPlayerAttackCooldown(now) {
  const fallback = G.playerAttackDelayMs(now);
  const pending = Math.trunc(Number(state.battle.lastPlayerAttackCooldownMs) || 0);
  state.battle.lastPlayerAttackCooldownMs = 0;
  if (pending <= 0) return fallback;
  return Math.max(1, pending);
}

function attachedSpellFxAnchor(entry) {
  if (entry?.memberClassId) {
    const party = state.battle.bossParty;
    const member = party?.members?.find((candidate) => candidate.classId === entry.memberClassId);
    if (member) {
      return {
        x: Math.floor((member.worldX ?? state.battle.playerX) - state.battle.cameraX),
        y: Math.floor(state.stageHeight * LANE.y),
      };
    }
  }
  return G.combatAnchor("player");
}

function beginTwinDrakeChargeFx(target, now) {
  const durationMs = G.twinDrakeChargeFxDurationMs();
  target.twinDrakeChargeFxStartedAt = now;
  target.twinDrakeChargeFxUntil = now + durationMs;
}

function clearTwinDrakePendingState() {
  state.battle.pendingTwinDrakeHits = [];
}

function chargedFlamingSwordAttack(now) {
  if (!G.warriorFlamingSwordReady()) return null;
  const skill = warriorSpellById("FlamingSword");
  const learned = G.learnedMagic("FlamingSword");
  if (!skill || !learned) return null;
  if (G.enemyDistance() > LANE.warriorRange) return null;
  return { skill, learned, cost: 0, charged: true };
}

function chargedWarriorAttack(now) {
  if (G.warriorSlayingPending()) return null;
  return chargedFlamingSwordAttack(now) ?? chargedTwinDrakeAttack(now);
}

function chargedTwinDrakeAttack(now) {
  if (!G.warriorTwinDrakeReady()) return null;
  const skill = warriorSpellById("TwinDrakeBlade");
  const learned = G.learnedMagic("TwinDrakeBlade");
  if (!skill || !learned) return null;
  if (G.enemyDistance() > LANE.warriorRange) return null;
  const cost = spellMpCost(skill, learned);
  if ((state.battle.player?.mp ?? 0) < cost) {
    clearTwinDrakeChargeState(state.battle);
    if (state.battle.bossParty?.active) clearTwinDrakeChargeState(G.bossPartyControlledMember());
    return null;
  }
  return { skill, learned, cost, charged: true };
}

function chargedSlayingAttack() {
  if (!G.warriorSlayingPending()) return null;
  const skill = warriorSpellById("Slaying");
  const learned = G.learnedMagic("Slaying");
  if (!skill || !learned) return null;
  return { skill, learned, cost: 0, slaying: true };
}

function halfMoonEnabled(member = null) {
  const spells = member ? G.bossPartyAutoSpells(member) : autoWarriorCombatSkills();
  return spells.some((skill) => skill.id === "HalfMoon");
}

function canUseHalfMoonAttack(distancePx, mp, learned) {
  const skill = warriorSpellById("HalfMoon");
  if (!skill || !learned) return false;
  return distancePx <= LANE.warriorRange && mp >= spellMpCost(skill, learned);
}

function halfMoonSplashSwarmEnemies(primarySwarmId) {
  const swarm = state.battle.swarm;
  if (!swarm || !G.groupDungeonSwarmActive()) return [];
  const primary = primarySwarmId ? findGroupDungeonSwarmEnemy(primarySwarmId) : null;
  const meleeCol = swarmSnapTileX(G.groupDungeonSwarmMeleeWorldX());
  const primaryTile = primary ? swarmEnemyTilePosition(primary) : null;
  return swarm.enemies.filter((enemy) => {
    if (enemy.hp <= 0 || enemy.dying) return false;
    if (primarySwarmId && enemy.id === primarySwarmId) return false;
    if (!swarmEnemyInAttackRange(enemy, meleeCol)) return false;
    if (!primaryTile) return true;
    const tile = swarmEnemyTilePosition(enemy);
    return tile.mapRow !== primaryTile.mapRow;
  });
}

function autoWarriorCombatSkills() {
  return G.normalizeAutoCastSpellsForClass("Warrior");
}

function autoWizardCombatSpells() {
  return activeWizardAutoSpells();
}

function autoTaoistCombatSpells() {
  return G.normalizeAutoCastSpellsForClass("Taoist");
}

function canAutoCastWarriorSkill(skill, learned, now) {
  return canUseWarriorSkill(skill, learned, now, { requireAuto: true });
}

function canUseWarriorSkill(skill, learned, now, options = {}) {
  if (!skill || !learned || skill.passive) return false;
  if (options.requireAuto && !learned.autoCast) return false;
  if (G.isWarriorChargeSkill(skill) && G.warriorChargeReady(skill.id)) return false;
  if (skill.toggle) {
    if (skill.id === "Thrusting") return G.isThrustingAttackWindow();
    if (skill.id === "HalfMoon") {
      return canUseHalfMoonAttack(G.enemyDistance(), state.battle.player?.mp ?? 0, learned);
    }
    return false;
  }
  const chargeCast = G.isWarriorChargeSkill(skill) && !G.warriorChargeReady(skill.id);
  if (!skill.buff && !chargeCast && G.enemyDistance() > LANE.warriorRange) return false;
  if (skill.id === "Fury" && now < (state.battle.furyUntil ?? 0)) return false;
  if (G.warriorSpellCastOnCooldown(skill, learned, now)) return false;
  return (state.battle.player?.mp ?? 0) >= spellMpCost(skill, learned);
}

function canAutoCastWizardSpell(spell, learned, now) {
  return canUseWizardSpell(spell, learned, now, { requireAuto: true });
}

function canUseWizardSpell(spell, learned, now, options = {}) {
  if (!spell || !learned || spell.passive) return false;
  if (options.requireAuto && !learned.autoCast) return false;
  if ((learned.castReadyAt ?? 0) > now) return false;
  if (spell.id === "FireWall" && !canUseWizardFireWall(now)) return false;
  return (state.battle.player?.mp ?? 0) >= spellMpCost(spell, learned);
}

function canUseWizardFireWall(now) {
  if (G.bossPartyGroundEffectActive("FireWall", now)) return false;
  if (!G.wizardFireWallRequiresMeleeRange()) return true;
  return G.wizardFireWallMeleeReady();
}

function canAutoCastTaoistSpell(spell, learned, now) {
  return canUseTaoistSpell(spell, learned, now, { requireAuto: true });
}

function canUseTaoistSpell(spell, learned, now, options = {}) {
  if (!spell || !learned || spell.passive) return false;
  if (options.requireAuto) {
    if (!learned.autoCast) return false;
    if (!autoTaoistCombatSpells().some((autoSpell) => autoSpell.id === spell.id)) return false;
  }
  if ((learned.castReadyAt ?? 0) > now) return false;
  return (state.battle.player?.mp ?? 0) >= spellMpCost(spell, learned);
}

function commitWarriorSpellUse(skill, learned, cost, now) {
  if (!learned || skill.id === BASIC_ATTACK_SKILL.id) return;
  if (skill.id === "Slaying") {
    clearWarriorSlayingReady();
    clearQueuedCombatSpell(skill.id);
    return;
  }
  if (skill.id === "FlamingSword") {
    clearFlamingSwordChargeState(state.battle);
    if (state.battle.bossParty?.active) clearFlamingSwordChargeState(G.bossPartyControlledMember());
    clearQueuedCombatSpell(skill.id);
    if (state.battle.bossParty?.active) {
      const member = G.bossPartyControlledMember();
      if (member) G.bossPartySetWarriorSpellCastReadyAt(member, skill, learned, now);
    }
    sceneSignature = "";
    battlePanelSignature = "";
    return;
  }
  if (skill.id === "TwinDrakeBlade") {
    clearTwinDrakeChargeState(state.battle);
    if (state.battle.bossParty?.active) clearTwinDrakeChargeState(G.bossPartyControlledMember());
    if (G.twinDrakeAutoCastActive(learned)) {
      state.battle.player.mp = Math.max(0, state.battle.player.mp - cost);
      learned.castReadyAt = 0;
      clearQueuedCombatSpell(skill.id);
      sceneSignature = "";
      battlePanelSignature = "";
      return;
    }
  }
  if (skill.toggle) {
    if (skill.id === "HalfMoon") {
      state.battle.player.mp = Math.max(0, state.battle.player.mp - cost);
    }
    clearQueuedCombatSpell(skill.id);
    return;
  }
  state.battle.player.mp = Math.max(0, state.battle.player.mp - cost);
  G.setWarriorSpellCastReadyAt(skill, learned, now);
  clearQueuedCombatSpell(skill.id);
  sceneSignature = "";
  battlePanelSignature = "";
}

function applyWizardCastCooldown(spell, learned, now, member = null) {
  const cooldown = G.wizardCastCooldownMs(spell, learned);
  if (learned) learned.castReadyAt = now + cooldown;
  if (member) {
    member.wizardSpellLockUntil = now + cooldown;
    member.nextActionAt = now + cooldown;
  } else {
    state.battle.wizardSpellLockUntil = now + cooldown;
  }
  return cooldown;
}

function canWizardCastSpell(spell, learned, now, member = null) {
  if (!spell || !learned) return false;
  if (G.wizardCastLocked(now, member)) return false;
  if ((learned.castReadyAt ?? 0) > now) return false;
  const mp = member?.mp ?? state.battle.player?.mp ?? 0;
  return mp >= spellMpCost(spell, learned);
}

function commitWizardSpellUse(spell, learned, cost, now) {
  state.battle.player.mp = Math.max(0, state.battle.player.mp - cost);
  applyWizardCastCooldown(spell, learned, now);
  clearQueuedCombatSpell(spell.id);
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
}

function commitTaoistSpellUse(spell, learned, cost, now) {
  state.battle.player.mp = Math.max(0, state.battle.player.mp - cost);
  if (learned) learned.castReadyAt = now + spellDelayMs(spell, learned);
  clearQueuedCombatSpell(spell.id);
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
}

function clearWarriorSlayingReady(member = null) {
  if (member?.classId) {
    member.slayingReady = false;
    member.slayingReadyAt = 0;
    if (member.classId === G.bossPartyControlledClassId()) {
      state.battle.slayingReady = false;
      state.battle.slayingReadyAt = 0;
    }
    return;
  }
  state.battle.slayingReady = false;
  state.battle.slayingReadyAt = 0;
  if (state.battle.bossParty?.active && state.battle.combatClass === "Warrior") {
    const controlled = G.bossPartyControlledMember();
    if (controlled) {
      controlled.slayingReady = false;
      controlled.slayingReadyAt = 0;
    }
  }
}

function applyWizardMagicDefence(value, enemy) {
  const defence = rollStat(G.enemyMagicalDefence(enemy));
  return Math.max(0, Math.trunc(Number(value) || 0) - defence);
}

function ensureEnemyDebuffs(enemy) {
  if (!enemy.debuffs) enemy.debuffs = { slowUntil: 0, frozenUntil: 0 };
  return enemy.debuffs;
}

function effectiveEnemyAttackMs(enemy, now = performance.now()) {
  const base = Math.max(400, Math.trunc(Number(enemy?.attackMs) || 2500));
  return G.enemySlowActive(enemy, now) ? base * 2 : base;
}

function effectiveEnemyMoveMs(enemy, now = performance.now()) {
  if (G.enemyFrozenActive(enemy, now)) return Number.POSITIVE_INFINITY;
  const base = Math.max(CRYSTAL_MONSTER_WALK_ACTION_MS, Math.trunc(Number(enemy?.moveMs) || 1200));
  return G.enemySlowActive(enemy, now) ? base * 2 : base;
}

function frostCrunchCanProc(player, enemy) {
  const playerLevel = Math.max(1, Math.trunc(Number(player?.level ?? state.game.progress.level) || 1));
  const enemyLevel = Math.max(1, Math.trunc(Number(enemy?.level) || 1));
  return playerLevel + 10 >= enemyLevel;
}

function frostCrunchSlowDurationMs() {
  return (5 + randomInt(0, 4)) * 1000;
}

function frostCrunchFrozenDurationMs(freezing) {
  const stat = Math.max(0, Math.trunc(Number(freezing) || 0));
  return (5 + (stat > 0 ? randomInt(0, stat - 1) : 0)) * 1000;
}

function applyEnemySlow(enemy, durationMs, now = performance.now()) {
  if (!enemy || enemy.hp <= 0 || G.enemySlowActive(enemy, now)) return false;
  ensureEnemyDebuffs(enemy).slowUntil = now + Math.max(1000, Math.trunc(Number(durationMs) || 0));
  return true;
}

function applyEnemyFrozen(enemy, durationMs, now = performance.now()) {
  if (!enemy || enemy.hp <= 0 || G.enemyFrozenActive(enemy, now)) return false;
  ensureEnemyDebuffs(enemy).frozenUntil = now + Math.max(1000, Math.trunc(Number(durationMs) || 0));
  return true;
}

function applyFrostCrunchEffects(enemy, learned, player, now = performance.now()) {
  if (!enemy || enemy.hp <= 0 || !learned || !frostCrunchCanProc(player, enemy)) return false;
  const skillLevel = Math.max(0, Math.min(3, Math.trunc(Number(learned.level) || 0)));
  const freezing = G.playerFreezingStat(player);
  let applied = false;
  if (G.rollFrostCrunchSlow(skillLevel) && applyEnemySlow(enemy, frostCrunchSlowDurationMs(), now)) {
    addCombatText("enemy", "Slow", "frost", now);
    G.pushBattleLog(`${enemy.name} is slowed.`);
    applied = true;
  }
  if (G.rollFrostCrunchFrozen(skillLevel) && applyEnemyFrozen(enemy, frostCrunchFrozenDurationMs(freezing), now)) {
    addCombatText("enemy", "Frozen", "frost", now);
    G.pushBattleLog(`${enemy.name} is frozen.`);
    applied = true;
  }
  return applied;
}

function applyEnemyPoison(enemy, poison, now = performance.now()) {
  if (!enemy || enemy.hp <= 0 || !poison) return false;
  if (!Array.isArray(enemy.poisons)) enemy.poisons = [];
  const ticksRemaining = Math.max(1, Math.trunc(Number(poison.ticksRemaining) || 1));
  const value = Math.max(0, Math.trunc(Number(poison.value) || 0));
  const existing = G.enemyPoison(enemy, poison.kind);
  if (existing) {
    if (poison.kind === "green" && (Number(existing.value) || 0) > value) return false;
    if (poison.kind !== "green" && (Number(existing.ticksRemaining) || 0) > ticksRemaining) return false;
    Object.assign(existing, {
      ...poison,
      value,
      ticksRemaining,
      tickMs: CRYSTAL_POISON_TICK_MS,
      nextTickAt: now + CRYSTAL_POISON_TICK_MS,
      appliedAt: now,
    });
    return true;
  }

  enemy.poisons.push({
    ...poison,
    value,
    ticksRemaining,
    tickMs: CRYSTAL_POISON_TICK_MS,
    nextTickAt: now + CRYSTAL_POISON_TICK_MS,
    appliedAt: now,
  });
  return true;
}

function crystalMagicMultiplier(skill, learned) {
  return (Number(skill.multiplierBase) || 1) + (Number(learned?.level) || 0) * (Number(skill.multiplierBonus) || 0);
}

function crystalMagicDamageBeforeDefence(skill, learned, player) {
  const attack = rollStat(player.mc ?? player.dc, player.luck);
  return Math.trunc((attack + crystalMagicPower(skill, learned)) * crystalMagicMultiplier(skill, learned));
}

function crystalMagicPower(skill, learned) {
  const level = Number(learned?.level) || 0;
  const mPowerBase = Number(skill.mPowerBase) || 0;
  const powerBase = Number(skill.powerBase) || 0;
  const mPower = Number(skill.mPowerBonus) > 0
    ? crystalRandomNext(mPowerBase, mPowerBase + Number(skill.mPowerBonus))
    : mPowerBase;
  const defPower = Number(skill.powerBonus) > 0
    ? crystalRandomNext(powerBase, powerBase + Number(skill.powerBonus))
    : powerBase;
  return crystalRound((mPower / 4) * (level + 1) + defPower);
}

function crystalRandomNext(min, maxExclusive) {
  const safeMin = Math.trunc(Number(min) || 0);
  const safeMax = Math.trunc(Number(maxExclusive) || safeMin);
  if (safeMax <= safeMin) return safeMin;
  return randomInt(safeMin, safeMax - 1);
}

function crystalRound(value) {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

function formatDefenceBuffApplied(spell, bonus, reductionPercent = 0) {
  if (spell?.id === "MagicShield") return `${reductionPercent}% damage reduction`;
  const statTag = G.defenceBuffStat(spell.id) === "amc" ? "MAC" : "AC";
  return `+${bonus} ${statTag}`;
}

function hasActiveDefenceBuffOnList(buffList, kind, now = performance.now()) {
  return (buffList ?? []).some((buff) => buff.kind === kind && Number(buff.expiresAt) > now);
}

function entityStatBuffList(entity) {
  if (!entity) return [];
  if (entity === state.battle.taoPet) return state.battle.petStatBuffs ?? [];
  if (entity === state.battle.bossParty?.pet) return entity.statBuffs ?? [];
  if (Array.isArray(entity.statBuffs)) return entity.statBuffs;
  return state.battle.statBuffs ?? [];
}

function entityDefenceBuffList(entity) {
  return entityStatBuffList(entity);
}

function effectiveCombatStats(entity) {
  const stats = {
    dc: [...statRange(entity?.dc)],
    mc: [...statRange(entity?.mc)],
    sc: [...statRange(entity?.sc)],
    luck: entity?.luck ?? 0,
  };
  applyStatBuffsToStats(stats, pruneStatBuffs(entityStatBuffList(entity)));
  return stats;
}

function defenceStatsForEntity(entity) {
  const ac = Array.isArray(entity?.ac) ? [...entity.ac] : [0, 0];
  const amc = Array.isArray(entity?.amc) ? [...entity.amc] : ac;
  applyStatBuffsToStats({ ac, amc }, pruneStatBuffs(entityDefenceBuffList(entity)));
  return {
    ac,
    amc,
    agility: entity?.agility ?? 0,
    magicResist: entity?.magicResist ?? 0,
    poisonResist: entity?.poisonResist ?? 0,
  };
}

function defenceTargetForIncomingAttack(entity) {
  return { ...defenceStatsForEntity(entity), __buffEntity: entity };
}

function applyTaoistDefenceBuffEffect(spell, learned, caster, now, options = {}) {
  return applyDefenceBuffEffect(spell, learned, caster, now, options);
}

function applyTaoistPartyDefenceBuffToTargets(spell, learned, caster, now, options = {}) {
  const bonus = G.rollDefenceBuffBonus(caster?.level ?? state.game.progress.level);
  const durationMs = G.rollTaoistDefenceBuffDurationMs(learned, caster);
  const expiresAt = now + durationMs;
  const results = [];
  for (const { entity, name } of G.taoistPartyDefenceBuffTargets(now)) {
    if (!entity || entity.hp <= 0) continue;
    const nextBuffs = G.pushDefenceBuff(entityStatBuffList(entity), spell, bonus, expiresAt, learned);
    G.setEntityStatBuffList(entity, nextBuffs);
    if (entity?.classId === G.bossPartyControlledClassId()) {
      state.battle.statBuffs = [...(entity.statBuffs ?? nextBuffs)];
      applyEquippedStatsToBattlePlayer();
    } else if (entity === state.battle.player) {
      applyEquippedStatsToBattlePlayer();
    }
    results.push({ entity, name });
  }
  if (!results.length) return null;
  if (learned && options.levelSkill !== false) G.levelMagicSkill(spell, learned, now);
  return { bonus, durationMs, reductionPercent: 0, results };
}

function formatTaoistDefenceBuffAppliedLog(spell, bonus, applied, durationMs) {
  const statTag = G.defenceBuffStat(spell.id) === "amc" ? "MAC" : "AC";
  const names = (applied?.results ?? []).map((entry) => entry.name).filter(Boolean);
  const targets = names.length ? names.join(", ") : "party";
  return `${targets} (+${bonus} ${statTag}, ${formatBuffRemaining(durationMs)})`;
}

function applyDefenceBuffEffect(spell, learned, caster, now, options = {}) {
  if (spell?.id === "SoulShield" || spell?.id === "BlessedArmour") {
    return applyTaoistPartyDefenceBuffToTargets(spell, learned, caster, now, options);
  }
  const bonus = G.rollDefenceBuffBonus(caster?.level ?? state.game.progress.level);
  const reductionPercent = spell?.id === "MagicShield" ? G.rollMagicShieldReductionPercent(learned) : 0;
  const durationMs = spell?.id === "MagicShield"
    ? G.rollWizardDefenceBuffDurationMs(learned, caster)
    : G.rollTaoistDefenceBuffDurationMs(learned, caster);
  const expiresAt = now + durationMs;
  const pet = options.pet ?? state.battle.taoPet ?? state.battle.bossParty?.pet;
  const buffPet = spell?.id !== "MagicShield";

  if (options.member) {
    const buffMember = G.resolveBossPartyMember(options.member);
    buffMember.statBuffs = G.pushDefenceBuff(buffMember.statBuffs ?? [], spell, bonus, expiresAt, learned);
    if (buffMember.classId === G.bossPartyControlledClassId()) {
      state.battle.statBuffs = [...buffMember.statBuffs];
      applyEquippedStatsToBattlePlayer();
    }
  } else {
    state.battle.statBuffs = G.pushDefenceBuff(state.battle.statBuffs, spell, bonus, expiresAt, learned);
    applyEquippedStatsToBattlePlayer();
  }

  if (buffPet && pet?.active) {
    const currentPetBuffs = pet === state.battle.taoPet
      ? state.battle.petStatBuffs
      : (pet.statBuffs ?? []);
    const nextPetBuffs = G.pushDefenceBuff(currentPetBuffs, spell, bonus, expiresAt, learned);
    if (pet === state.battle.taoPet) state.battle.petStatBuffs = nextPetBuffs;
    else pet.statBuffs = nextPetBuffs;
  }

  if (learned && options.levelSkill !== false) G.levelMagicSkill(spell, learned, now);
  return { bonus, durationMs, reductionPercent };
}

function hasUltimateEnhancerBuff(entity, now = performance.now()) {
  return hasActiveDefenceBuffOnList(entityStatBuffList(entity), ULTIMATE_ENHANCER_BUFF_KIND, now);
}

function applyUltimateEnhancerEffect(spell, learned, caster, target, now, options = {}) {
  const stat = G.ultimateEnhancerStatForTarget(target);
  const bonus = G.rollUltimateEnhancerBonus(caster);
  const durationMs = G.rollTaoistDefenceBuffDurationMs(learned, caster);
  const expiresAt = now + durationMs;
  const nextBuffs = G.pushUltimateEnhancerBuff(entityStatBuffList(target), spell, stat, bonus, expiresAt);
  G.setEntityStatBuffList(target, nextBuffs);

  if (target?.classId === G.bossPartyControlledClassId()) {
    state.battle.statBuffs = [...(target.statBuffs ?? nextBuffs)];
    applyEquippedStatsToBattlePlayer();
  } else if (target === state.battle.player) {
    applyEquippedStatsToBattlePlayer();
  }

  if (learned && options.levelSkill !== false) G.levelMagicSkill(spell, learned, now);
  return { bonus, durationMs, stat };
}

function applyUltimateEnhancerToTargets(spell, learned, caster, targets, now, options = {}) {
  if (!spell || !learned || !Array.isArray(targets) || !targets.length) return null;
  const bonus = G.rollUltimateEnhancerBonus(caster);
  const durationMs = G.rollTaoistDefenceBuffDurationMs(learned, caster);
  const expiresAt = now + durationMs;
  const results = [];
  for (const { entity, name } of targets) {
    if (!entity || entity.hp <= 0) continue;
    const stat = G.ultimateEnhancerStatForTarget(entity);
    const nextBuffs = G.pushUltimateEnhancerBuff(entityStatBuffList(entity), spell, stat, bonus, expiresAt);
    G.setEntityStatBuffList(entity, nextBuffs);
    if (entity?.classId === G.bossPartyControlledClassId()) {
      state.battle.statBuffs = [...(entity.statBuffs ?? nextBuffs)];
      applyEquippedStatsToBattlePlayer();
    } else if (entity === state.battle.player) {
      applyEquippedStatsToBattlePlayer();
    }
    results.push({ entity, name, stat, bonus, durationMs });
  }
  if (!results.length) return null;
  if (learned && options.levelSkill !== false) G.levelMagicSkill(spell, learned, now);
  return { bonus, durationMs, results };
}

function formatUltimateEnhancerAppliedLog(spell, casterLabel, applied, durationMs) {
  const parts = applied.results.map((entry) => {
    const statTag = entry.stat.toUpperCase();
    return `${entry.name} (+${entry.bonus} ${statTag})`;
  });
  return `${casterLabel} casts ${spell.label} (${parts.join(", ")}, ${formatBuffRemaining(durationMs)}).`;
}

function createTaoistSummonPet(spellId, spellLevel, now = performance.now()) {
  if (spellId === "SummonShinsu") return createTaoistShinsuPet(spellLevel, now);
  return createTaoistSkeletonPet(spellLevel, now);
}

function createTaoistSkeletonPet(spellLevel, now = performance.now()) {
  const level = Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
  const maxPetLevel = 4 + level;
  const stats = CRYSTAL_SUMMON_SKELETON_PET_STATS;
  const attackMs = Math.max(400, Math.trunc(stats.attackMs - maxPetLevel * 70));
  const pet = {
    active: true,
    dead: false,
    spellId: "SummonSkeleton",
    name: stats.name,
    monsterIndex: CRYSTAL_SUMMON_SKELETON_PET_INDEX,
    worldX: 0,
    level,
    maxPetLevel,
    maxHp: stats.maxHp + level * 20,
    hp: stats.maxHp + level * 20,
    dc: [stats.dc[0] + level, stats.dc[1] + level],
    ac: [stats.ac[0] + level * 2, stats.ac[1] + level * 2],
    amc: [stats.amc[0] + level * 2, stats.amc[1] + level * 2],
    accuracy: stats.accuracy,
    agility: stats.agility,
    luck: stats.luck,
    attackMs,
    nextAttackAt: now + 1000,
    healAmount: 0,
    healTickAt: 0,
    action: "standing",
    frame: 0,
    oneShot: false,
    lastTick: now,
    poisons: [],
    statBuffs: [],
  };
  return G.placeTaoistCombatPet(pet);
}

function createTaoistShinsuPet(spellLevel, now = performance.now()) {
  const level = Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
  const maxPetLevel = 1 + level * 2;
  const stats = CRYSTAL_SUMMON_SHINSU_PET_STATS;
  const attackMs = Math.max(400, Math.trunc(stats.attackMs - maxPetLevel * 70));
  const pet = {
    active: true,
    dead: false,
    spellId: "SummonShinsu",
    name: stats.name,
    monsterIndex: CRYSTAL_SUMMON_SHINSU_PET_INDEX,
    shinsuVisible: false,
    worldX: 0,
    level,
    maxPetLevel,
    maxHp: stats.maxHp + level * 20,
    hp: stats.maxHp + level * 20,
    dc: [stats.dc[0] + level, stats.dc[1] + level],
    ac: [stats.ac[0] + level * 2, stats.ac[1] + level * 2],
    amc: [stats.amc[0] + level * 2, stats.amc[1] + level * 2],
    accuracy: stats.accuracy,
    agility: stats.agility,
    luck: stats.luck,
    attackMs,
    nextAttackAt: now + 1000,
    healAmount: 0,
    healTickAt: 0,
    action: "show",
    frame: 0,
    oneShot: true,
    lastTick: now,
    poisons: [],
    statBuffs: [],
  };
  return G.placeTaoistCombatPet(pet);
}

function applyTaoistPetAttackResult(pet, enemy, result, now, options = {}) {
  const offline = Boolean(options.offline);
  const bossParty = Boolean(options.bossParty);
  if (!result.hit || result.damage <= 0) {
    if (!offline) {
      addCombatText("enemy", "Miss", "miss", now);
      G.pushBattleLog(`${pet.name} misses ${enemy.name}.`);
    }
    return;
  }
  G.reduceEnemyHp(enemy, result.damage);
  if (bossParty) {
    G.syncBattleEnemyHpToSwarm();
    G.strikeGroupDungeonSwarmEnemy(enemy, now);
  }
  if (!offline) {
    G.setEnemyAction("struck", true, now);
    G.playMonsterSfx("flinch");
    if (!options.skipHitSfx) {
      G.playTaoPetSfx("hit", { volume: 0.38, throttleMs: 120, pet });
    }
    addCombatText("enemy", result.damage, "damage", now);
    G.pushBattleLog(`${pet.name} hits ${enemy.name} for ${result.damage}.`);
  }
  if (enemy.hp <= 0) {
    if (offline) return;
    if (bossParty) {
      G.maybeKillGroupDungeonSwarmEnemy(enemy, now);
      return;
    }
    finishEnemy(now);
    G.setEnemyAction("die", false, now);
    G.playMonsterSfx("death");
    G.pushBattleLog(`${enemy.name} is defeated.`);
  }
}

function clampNumber(value, min, max) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return Math.max(safeMin, Math.min(safeMax, Number(value) || 0));
}

function dismissTaoistPet(options = {}) {
  state.battle.pendingTaoPet = null;
  state.battle.pendingPetAttack = null;
  state.battle.taoPet = null;
  state.battle.petStatBuffs = [];
  if (options.clearDeathLock !== false) state.battle.taoPetDiedThisFight = false;
}

function activeTaoistSpellVisualBlocksSecondary(now) {
  const battle = state.battle;
  if (!battle.activeTaoSpell || battle.activeTaoSpell === "SoulFireBall") return false;
  if (battle.pendingHeal || battle.pendingPoison || battle.pendingTaoPet || battle.pendingDefenceBuff || battle.pendingUltimateEnhancer) return true;
  const elapsed = now - (battle.activeTaoSpellStartedAt || 0);
  return elapsed >= 0 && elapsed < G.combatSpellVisualDurationMs(battle.activeTaoSpellAtlas);
}

function createWizardGroundSpellEffect(spell, impact, now, partyCaster = null, partyLearned = null) {
  const battle = state.battle;
  const value = Math.max(0, Math.trunc(Number(impact.value) || 0));
  const widthTiles = Math.max(1, Math.trunc(Number(spell.groundWidthTiles) || 1));
  const halfWidth = Math.floor(widthTiles / 2);
  const offsets = Array.from({ length: widthTiles }, (_, index) => (index - halfWidth) * LANE_TILE_PX);
  const durationMs = G.wizardGroundEffectDurationMs(spell, value);
  const swarmActive = G.groupDungeonSwarmActive();
  const swarmCenterTile = swarmActive ? G.groupDungeonSwarmFireWallCenterTile() : null;
  const effect = {
    id: `${spell.id}-${now}-${Math.random()}`,
    spellId: spell.id,
    worldX: swarmActive ? swarmCenterTile.worldX : (Number(impact.worldX) || battle.enemyX),
    offsets: swarmActive ? [] : offsets,
    tiles: swarmActive ? fireWallCrossTiles(swarmCenterTile.worldX, swarmCenterTile.mapRow) : null,
    value,
    createdAt: now,
    expiresAt: now + durationMs,
    nextTickAt: now,
    tickMs: Math.max(250, Math.trunc(Number(spell.groundTickMs) || 2000)),
  };
  battle.groundSpellEffects = [...(battle.groundSpellEffects ?? []), effect].slice(-8);
  const sfx = partyCaster
    ? G.bossPartySfxParams(partyCaster, 0.48, 0)
    : { volume: 0.48, throttleMs: 80 };
  G.playSpellSfx(spell.id, "impact", sfx) || G.playSpellSfx(spell.id, "cast", sfx);
  G.pushBattleLog(`${spell.label} burns on the ground.`);
  if (partyCaster && partyLearned) {
    G.bossPartyLevelMagicSkill(partyCaster, spell, partyLearned, now);
  } else {
    const learned = G.learnedMagic(spell.id);
    if (learned) G.levelMagicSkill(spell, learned, now);
  }
  G.updateGroundSpellEffects(now);
}

function applyMapLightningHitToMember(member, damage, now) {
  if (!member || member.hp <= 0) return;
  if (damage > 0) member.hp = Math.max(0, member.hp - damage);
  const offsetX = G.bossPartyDamageTextOffset(member.classId);
  if (member.classId === G.bossPartyControlledClassId()) {
    G.setPlayerAction("struck", now + 250, true);
    G.maybeNotifyMagicShieldStruck(null, now);
    addCombatText("player", damage, "enemyDamage", now);
    G.bossPartySyncControlledPlayerRef();
  } else {
    member.visualAction = "struck";
    member.visualFrame = 0;
    member.visualOneShot = true;
    member.visualLastTick = now;
    G.notifyWizardMagicShieldStruckOnHit(member, now);
    addCombatText("enemy", damage, "enemyDamage", now, offsetX);
  }
  G.playSfx("player.flinch", G.bossPartySfxParams(member, 0.45, 120));
  if (member.hp <= 0) G.bossPartyMarkMemberDead(member, now);
}

function applyMapLightningHitToSoloPlayer(damage, now) {
  const battle = state.battle;
  const target = G.enemyAttackTarget();
  target.applyDamage(damage, now);
  addCombatText(target.anchor, damage, "enemyDamage", now);
  if (target.kind === "player" && battle.player.hp <= 0) {
    finishBattle(now);
    G.setPlayerAction("die", now);
    G.playSfx("player.death", { volume: 0.58 });
    G.pushBattleLog(`${battle.combatClass} falls.`);
  }
}

function applyMapLightningStrikeHit(effect, now) {
  if (effect.resolved) return;
  effect.resolved = true;
  const party = state.battle.bossParty;
  const targets = G.mapLightningStrikeTargets(effect);
  let hitAnyone = false;
  for (const target of targets) {
    if (!G.mapLightningStrikeHitsTarget(effect, target)) continue;
    const defenceEntity = target.solo ? state.battle.player : target;
    const { hit, damage } = G.resolveMapLightningDamage(effect.damage, defenceEntity);
    if (!hit) {
      if (target.solo) addCombatText("player", "Miss", "miss", now);
      else if (target.classId === G.bossPartyControlledClassId()) addCombatText("player", "Miss", "miss", now);
      else addCombatText("enemy", "Miss", "miss", now, G.bossPartyDamageTextOffset(target.classId));
      continue;
    }
    hitAnyone = true;
    if (party?.active) {
      applyMapLightningHitToMember(target, damage, now);
      G.pushBattleLog(`Lightning strikes ${target.classId} for ${damage}.`);
    } else {
      applyMapLightningHitToSoloPlayer(damage, now);
      G.pushBattleLog(`Lightning strikes ${target.name ?? target.classId} for ${damage}.`);
    }
  }
  if (!hitAnyone && effect.damage > 0) {
    G.pushBattleLog("Lightning crackles across the tomb floor.");
  }
}

function groundSpellEffectHitsSwarmEnemy(effect, swarmEnemy) {
  const tile = swarmEnemyReservedTile(swarmEnemy);
  return (effect.tiles ?? []).some(
    (fireTile) => fireTile.worldX === tile.worldX && fireTile.mapRow === tile.mapRow,
  );
}

function groundSpellEffectHitsEnemy(effect) {
  const battle = state.battle;
  if (!battle.enemy || battle.enemy.hp <= 0) return false;
  const hitRadius = LANE_TILE_PX * 0.55;
  return (effect.offsets ?? [0]).some((offset) => Math.abs(battle.enemyX - (effect.worldX + offset)) <= hitRadius);
}

function applyGroundSpellTick(effect, now) {
  const battle = state.battle;
  const spell = G.wizardCombatSpell(effect.spellId);
  const damage = applyWizardMagicDefence(effect.value, battle.enemy);
  if (damage <= 0) {
    addCombatText("enemy", "0", "damage", now);
    G.pushBattleLog(`${spell.label} is resisted by ${battle.enemy.name}.`);
    return;
  }

  G.reduceEnemyHp(battle.enemy, damage);
  G.setEnemyAction("struck", true, now);
  G.playMonsterSfx("flinch");
  G.playSpellSfx(spell.id, "impact", { volume: 0.42, throttleMs: 160 }) || G.playSpellSfx(spell.id, "cast", { volume: 0.38, throttleMs: 160 });
  addCombatText("enemy", damage, "damage", now);
  G.pushBattleLog(`${spell.label} burns ${battle.enemy.name} for ${damage}.`);

  if (battle.enemy.hp <= 0) {
    G.setEnemyAction("die", false, now);
    G.playMonsterSfx("death");
    if (!battle.bossParty?.active) {
      finishEnemy(now);
      G.pushBattleLog(`${battle.enemy.name} is defeated.`);
    }
  }
}

function applyGroundSpellTickToSwarmEnemy(effect, swarmEnemy, now) {
  const spell = G.wizardCombatSpell(effect.spellId);
  const damage = applyWizardMagicDefence(effect.value, swarmEnemy);
  if (damage <= 0) {
    addSwarmEnemyCombatText(swarmEnemy, "0", "damage", now);
    G.pushBattleLog(`${spell.label} is resisted by ${swarmEnemy.name}.`);
    return;
  }

  swarmEnemy.hp = Math.max(0, swarmEnemy.hp - damage);
  const primary = G.groupDungeonPrimarySwarmEnemy();
  if (primary?.id === swarmEnemy.id && state.battle.enemy) {
    state.battle.enemy.hp = swarmEnemy.hp;
    state.battle.enemyX = Math.round(swarmEnemy.worldX);
  }
  G.queueSwarmEnemyStruck(swarmEnemy, now);
  G.playMonsterSfx("flinch", swarmEnemy);
  G.playSpellSfx(spell.id, "impact", { volume: 0.42, throttleMs: 160 }) || G.playSpellSfx(spell.id, "cast", { volume: 0.38, throttleMs: 160 });
  addSwarmEnemyCombatText(swarmEnemy, damage, "damage", now);
  G.pushBattleLog(`${spell.label} burns ${swarmEnemy.name} for ${damage}.`);

  if (swarmEnemy.hp <= 0) {
    G.maybeKillGroupDungeonSwarmEnemy(G.swarmEnemyToBattleEntity(swarmEnemy), now);
  }
}

function applyIncomingDamageReduction(damage, target, now = performance.now()) {
  const percent = G.incomingDamageReductionPercent(target, now);
  if (percent <= 0) return damage;
  return Math.max(0, Math.trunc(damage - (damage * percent) / 100));
}

function addCombatText(anchor, text, kind = "damage", now = performance.now(), offsetX = 0) {
  const bounds = G.combatTextBounds(anchor);
  state.battle.floatingTexts.push({
    id: `${now}-${Math.random()}`,
    anchor,
    text: String(text),
    kind,
    x: bounds.centerX + offsetX,
    y: bounds.topY - 16,
    createdAt: now,
  });
  state.battle.floatingTexts = state.battle.floatingTexts.slice(-12);
}

function addSwarmEnemyCombatText(swarmEnemy, text, kind = "damage", now = performance.now()) {
  const bounds = G.swarmEnemyFrameBounds(swarmEnemy);
  state.battle.floatingTexts.push({
    id: `${now}-${Math.random()}`,
    anchor: "enemy",
    text: String(text),
    kind,
    x: bounds.centerX,
    y: bounds.topY - 16,
    createdAt: now,
  });
  state.battle.floatingTexts = state.battle.floatingTexts.slice(-12);
}

function finishBattle(now) {
  state.battle.running = false;
  state.battle.phase = "idle";
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  state.battle.pendingDefenceBuff = null;
  state.battle.pendingUltimateEnhancer = null;
  state.battle.defenceBuffFx = [];
  state.battle.flamingSwordReady = false;
  state.battle.flamingSwordReadyAt = 0;
  state.battle.flamingSwordExpiresAt = 0;
  state.battle.twinDrakeReady = false;
  state.battle.twinDrakeReadyAt = 0;
  state.battle.twinDrakeChargeFxStartedAt = 0;
  state.battle.twinDrakeChargeFxUntil = 0;
  state.battle.pendingTwinDrakeHits = [];
  state.battle.attachedSpellFx = [];
  dismissTaoistPet();
  state.battle.groundSpellEffects = [];
  state.battle.mapLightningEffects = [];
  state.battle.nextMapLightningAt = 0;
  state.battle.returnToStandAt = (state.battle.player?.hp ?? 0) > 0 ? now + COMBAT_STANCE_HOLD_MS : 0;
}

function finishEnemy(now) {
  const battle = state.battle;
  if (G.isTrainingDummyEnemy(battle.enemy)) {
    if (battle.enemy) battle.enemy.hp = battle.enemy.maxHp;
    return;
  }
  const zone = G.activeZone();
  const bossDef = bossRoomDef(zone?.id);
  const trainingRoom = G.isTrainingRoomZone(zone);
  if (!trainingRoom) awardEnemyRewards();
  battle.phase = "victory";
  battle.enemyAggro = false;
  battle.pendingImpact = null;
  battle.pendingEnemyStrike = null;
  battle.pendingHeal = null;
  battle.pendingPoison = null;
  clearTwinDrakePendingState();
  battle.attachedSpellFx = (battle.attachedSpellFx ?? []).filter((entry) => entry.spellId !== "TwinDrakeBlade");
  G.retireTaoistPetAfterFight(now);
  if (battle.enemy) battle.enemy.poisons = [];
  battle.nextPlayerAttackAt = 0;
  battle.nextEnemyAttackAt = 0;
  if (bossDef && zone) {
    G.setBossRespawn(zone.id);
    battle.running = false;
    battle.nextEnemySpawnAt = 0;
    G.pushBattleLog(`${bossDef.bossName} will respawn in ${formatBossRespawnDelay(bossDef.respawnMinutes)}.`);
    addLootNotice(`${bossDef.bossName} defeated`, "boss");
    G.saveGameState(true);
  } else {
    battle.nextEnemySpawnAt = now + (trainingRoom ? 600 : LANE.respawnDelayMs);
  }
  if (trainingRoom) G.pushBattleLog("Training dummy resets.");
  const restAfterVictory = Boolean(bossDef) && (battle.player?.hp ?? 0) > 0;
  if (restAfterVictory) {
    if (state.action !== "die") G.setPlayerAction("stance", now);
    battle.returnToStandAt = now + COMBAT_STANCE_HOLD_MS;
  } else {
    battle.returnToStandAt = 0;
  }
}

function awardEnemyRewards() {
  if (state.game.mode !== "zone") return;
  const zone = G.activeZone();
  const reward = zone?.rewards ?? { gold: [1, 2] };
  const enemy = state.battle.enemy;
  const xp = adjustedKillExperience(enemy?.experience ?? 0, state.game.progress.level, enemy?.level ?? 0);
  const bossDrops = bossDropTableForEnemy(enemy);
  const gold = bossDrops
    ? bossDrops.gold
    : randomInt(reward.gold[0], reward.gold[1]);
  const drops = bossDrops
    ? G.rollBossSoloDrops(enemy)
    : G.isRedThunderZumaEnemy(enemy)
      ? G.rollRedThunderZumaDrops()
      : G.rollZoneDrops(zone, enemy);
  const leveledTo = applyExperienceReward(xp);
  state.inventory.gold += gold;
  state.game.progress.gold = state.inventory.gold;
  state.game.kills += 1;
  state.game.zoneKills += 1;
  if ((bossDrops || G.isRedThunderZumaEnemy(enemy)) && zone) {
    state.game.dropPity[zone.id] = 0;
  }
  state.game.lastReward = { xp, gold, drops: drops.added };
  state.battle.experience = state.game.progress.experience;
  state.battle.gold = state.game.progress.gold;
  state.battle.level = state.game.progress.level;
  if (gold > 0) G.playSfx("ui.gold", { volume: 0.34, throttleMs: 250 });
  G.pushBattleLog(`Gained ${xp} XP and ${gold} gold.`);
  if (leveledTo.length) G.pushBattleLog(`Level up: ${leveledTo.at(-1)}.`);
  for (const item of drops.added) G.pushBattleLog(`Received ${item.name}.`);
  for (const item of drops.ignored) G.pushBattleLog(`No room for ${item.name}.`);
  addLootNotice(`+${gold} gold`, "gold");
  for (const level of leveledTo) addLootNotice(`Level ${level}`, "level");
  for (const item of drops.added) addLootNotice(`Found ${item.name}`, "item");
  for (const item of drops.ignored) addLootNotice(`Inventory full: ${item.name}`, "full");
  if (drops.added.length || drops.ignored.length || gold > 0) {
    state.game.recentLoot = [
      `+${gold} gold`,
      ...leveledTo.map((level) => `Level ${level}`),
      ...drops.added.map((item) => `Found ${item.name}`),
      ...drops.ignored.map((item) => `No room for ${item.name}`),
      ...state.game.recentLoot,
    ].slice(0, 6);
  }
}

function applyExperienceReward(xp) {
  const levels = [];
  state.game.progress.experience += xp;
  let nextLevelXp = G.xpForNextLevel(state.game.progress.level);
  while (Number.isFinite(nextLevelXp) && state.game.progress.experience >= nextLevelXp) {
    state.game.progress.experience -= nextLevelXp;
    state.game.progress.level += 1;
    levels.push(state.game.progress.level);
    G.restoreBattlePlayerResources();
    G.triggerLevelUpFx(performance.now(), state.game.progress.level);
    sceneSignature = "";
    nextLevelXp = G.xpForNextLevel(state.game.progress.level);
  }
  if (levels.length) void G.submitPrototypeStats("level-up");
  return levels;
}

function addLootNotice(text, kind = "item") {
  state.game.lootToasts.push({
    id: `${performance.now()}-${Math.random()}`,
    text,
    kind,
    createdAt: performance.now(),
  });
  state.game.lootToasts = state.game.lootToasts.slice(-6);
}

function addZoneDropItem(item, added, ignored) {
  if (!G.hasInventorySpaceFor(item.id)) {
    ignored.push(item);
    return false;
  }
  const before = state.inventory.items.reduce((sum, entry) => sum + (entry.itemId === item.id ? entry.quantity : 0), 0);
  const addedEntries = G.addInventoryItem(item.id, 1);
  const after = state.inventory.items.reduce((sum, entry) => sum + (entry.itemId === item.id ? entry.quantity : 0), 0);
  if (addedEntries.length && after > before) {
    added.push(item);
    return true;
  }
  ignored.push(item);
  return false;
}

function availableWarriorCombatSkills() {
  return [
    BASIC_ATTACK_SKILL,
    ...WARRIOR_COMBAT_SKILLS.filter((skill) => skill.id !== BASIC_ATTACK_SKILL.id && G.learnedMagic(skill.id)),
  ];
}

function crystalProjectileImpactDelayMs() {
  const tileDistance = Math.max(1, Math.round(G.enemyDistance() / LANE_TILE_PX));
  return tileDistance * 50 + 500;
}

function applyCombatHudLayout(options = {}) {
  if (!els.stage) return;
  const metrics = G.combatHudLayoutMetrics(options);
  els.stage.style.width = `${state.stageWidth * state.scale}px`;
  els.stage.style.height = `${metrics.displayHeight}px`;
  els.stage.style.setProperty("--combat-hud-hotbar-top", `${metrics.hotbarTop}px`);
  els.stage.style.setProperty("--combat-hud-skill-top", `${metrics.skillTop}px`);
}

function crystalSpellRangePx(spell) {
  const range = Math.max(0, Math.trunc(Number(spell?.range) || 0));
  return range > 0 ? range * LANE_TILE_PX : LANE.wizardRange;
}

function effectivePlayerAttackSpeed(now = performance.now()) {
  const player = state.battle.player;
  const base = Number(player?.attackSpeed) || 0;
  const furyUntil = Math.max(Number(state.battle.furyUntil) || 0, Number(player?.furyUntil) || 0);
  const furyBonus = now < furyUntil
    ? Number(state.battle.furyBonus ?? player?.furyBonus) || 0
    : 0;
  return base + furyBonus;
}

function characterAttackSpeedLabel(now = performance.now()) {
  const stats = characterTotalStats();
  const effective = effectivePlayerAttackSpeed(now);
  const delay = G.playerAttackDelayMs(now);
  if (effective !== stats.attackSpeed) {
    return `${stats.attackSpeed} (+${effective - stats.attackSpeed}) · ${delay}ms`;
  }
  return `${stats.attackSpeed} · ${delay}ms`;
}

function canPlayerAttack() {
  const battle = state.battle;
  if (battle.combatClass === "Taoist" && G.taoistPetCanTank()) return false;
  return battle.phase === "engaged" && battle.enemyRevealed && battle.enemy?.hp > 0 && G.enemyDistance() <= G.playerAttackRange();
}

function canEnemyAttack() {
  const battle = state.battle;
  if (G.isTrainingDummyEnemy(battle.enemy)) return false;
  if (battle.phase !== "engaged" || !battle.enemyRevealed || !battle.enemy?.hp) return false;
  if (G.enemyFrozenActive(battle.enemy)) return false;
  if (G.isEvilCentipedeEnemy(battle.enemy)) return canEvilCentipedeAttack();
  if (G.enemyHasRangedMeleeAttack(battle.enemy)) return canBoneLordAttack();
  return battle.enemyAggro && battle.enemy?.hp > 0 && G.enemyTargetDistance() <= LANE.enemyRange;
}

function footstepSideForFrame(frame) {
  if (frame === 1) return "left";
  if (frame === 4) return "right";
  return null;
}

function currentWeaponSwingSfxFamily() {
  return G.weaponSwingSfxFamilyForItem(G.equippedItem("weapon"));
}

function currentWeaponHitSfxFamily() {
  return G.weaponHitSfxFamilyForItem(G.equippedItem("weapon"));
}

function currentWeaponSfxFamily() {
  return currentWeaponSwingSfxFamily();
}

function currentClip() {
  for (const layer of G.layerNames()) {
    const clip = state.atlases[layer]?.actions?.[state.action];
    if (clip?.frames?.length) return clip;
  }
  return null;
}

function ensureStageCanvas() {
  if (stageCanvas && stageCanvas.isConnected) return stageCanvas;
  stageCanvas = document.createElement("canvas");
  stageCanvas.className = "stage-canvas";
  stageCanvas.width = state.stageWidth;
  stageCanvas.height = state.stageHeight;
  els.stage.prepend(stageCanvas);
  stageContext = stageCanvas.getContext("2d");
  bindStageCanvasEvents();
  return stageCanvas;
}

function clearStampBackgroundCache() {
  stampBackgroundCache.key = "";
  stampBackgroundCache.canvas = null;
}

function blitCachedStampBackground(ctx, key, painter) {
  if (!key) {
    painter(ctx);
    return;
  }
  if (stampBackgroundCache.key === key && stampBackgroundCache.canvas) {
    ctx.drawImage(stampBackgroundCache.canvas, 0, 0);
    return;
  }
  if (!stampBackgroundCache.canvas) stampBackgroundCache.canvas = document.createElement("canvas");
  const cacheCanvas = stampBackgroundCache.canvas;
  if (cacheCanvas.width !== state.stageWidth || cacheCanvas.height !== state.stageHeight) {
    cacheCanvas.width = state.stageWidth;
    cacheCanvas.height = state.stageHeight;
  }
  const cacheCtx = cacheCanvas.getContext("2d");
  cacheCtx.imageSmoothingEnabled = state.smooth;
  cacheCtx.clearRect(0, 0, state.stageWidth, state.stageHeight);
  painter(cacheCtx);
  stampBackgroundCache.key = key;
  ctx.drawImage(cacheCanvas, 0, 0);
}

function currentTownMapStamp() {
  if (state.game.mode !== "town") return null;
  const stampId = TOWN_VISUALS.mapStamp;
  if (!stampId) return null;
  return state.mapStampIndex.stamps.find((stamp) => stamp.id === stampId) ?? null;
}

function buildStampArenaDrawList(displayFrame) {
  const spawnRow = G.arenaSpawnMapRow();
  if (!spawnRow) return [];
  const entities = [];

  if (G.bossPartyOnField()) {
    const party = state.battle.bossParty;
    for (const member of party?.members ?? []) {
      if (!member.alive || member.hp <= 0) continue;
      entities.push({
        zRow: spawnRow,
        worldX: Number(member.worldX) || 0,
        kindRank: STAMP_ARENA_KIND_RANK.party,
        draw: (ctx) => G.drawBossPartyMemberCanvas(ctx, member),
      });
    }
  } else if (state.battle.player && state.showEnemies) {
    entities.push({
      zRow: spawnRow,
      worldX: Number(state.battle.playerX) || 0,
      kindRank: STAMP_ARENA_KIND_RANK.player,
      draw: (ctx) => G.drawPlayerCanvas(ctx, displayFrame),
    });
  }

  if (state.showEnemies) {
    const pet = state.battle.taoPet;
    if (pet && (pet.active || pet.dead)) {
      entities.push({
        zRow: spawnRow,
        worldX: G.resolvedTaoPetWorldX(pet),
        kindRank: STAMP_ARENA_KIND_RANK.pet,
        draw: (ctx) => G.drawTaoistPetCanvas(ctx),
      });
    }
  }

  if (state.showEnemies && G.groupDungeonSwarmActive()) {
    const swarm = state.battle.swarm;
    for (const enemy of swarm?.enemies ?? []) {
      if (enemy.hp <= 0 && !enemy.dying) continue;
      if (!state.battle.enemyRevealed) continue;
      const tile = swarmEnemyTilePosition(enemy);
      entities.push({
        zRow: tile.mapRow,
        worldX: tile.worldX,
        kindRank: STAMP_ARENA_KIND_RANK.enemy,
        draw: (ctx) => G.drawGroupDungeonSwarmEnemyCanvas(ctx, enemy),
      });
    }
  } else if (state.showEnemies && state.battle.enemy) {
    const visible = state.battle.enemyRevealed || state.enemy.action === "show";
    if (visible) {
      entities.push({
        zRow: spawnRow,
        worldX: Number(state.battle.enemyX) || 0,
        kindRank: STAMP_ARENA_KIND_RANK.enemy,
        draw: (ctx) => G.drawEnemyCanvas(ctx),
      });
    }
  }

  return entities;
}

function cachedImage(src) {
  const existing = imageCache.get(src);
  if (existing?.complete && existing.naturalWidth > 0) return existing;
  if (existing) return null;

  const image = new Image();
  image.decoding = "async";
  image.onload = () => G.render();
  image.onerror = () => imageCache.delete(src);
  image.src = src;
  imageCache.set(src, image);
  return null;
}

function gameResourceMeterHtml(label, value, max, kind) {
  const pct = G.resourcePercentage(value, max);
  return `
    <div class="game-resource-meter ${kind}">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${Math.max(0, Math.floor(value))}/${Math.max(0, Math.floor(max))}</strong>
      </div>
      <span class="game-resource-track">
        <span class="game-resource-fill" style="width:${pct}%"></span>
      </span>
    </div>
  `;
}

function gameLogLinesHtml() {
  const lines = state.battle.log.length ? state.battle.log : ["Adventure started."];
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function bar(label, value, max) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <span>${value}/${max}</span>
    </div>
  `;
}

function hashDecorationSeed(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

function createEmptyObjectPattern(rows = DEFAULT_OBJECT_PATTERN_ROWS, cols = DEFAULT_OBJECT_PATTERN_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(ZONE_OBJECT_EMPTY));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentBackdropKind() {
  if (state.game.mode === "town") return TOWN_VISUALS.backdrop ?? "field";
  if (state.game.mode === "mining") return G.activeZone()?.backdrop ?? "cave";
  const zone = G.activeZone();
  const draft = G.zoneVisualDraft(zone);
  return state.game.mode === "zone" ? draft?.backdrop ?? zone?.backdrop ?? "field" : "field";
}


G.buildCrystalWeaponSfxLookup = buildCrystalWeaponSfxLookup;
G.createStarterInventoryState = createStarterInventoryState;
G.addStarterInventoryEntry = addStarterInventoryEntry;
G.cloneAccountUpgradeState = cloneAccountUpgradeState;
G.createPendingOfflineProgress = createPendingOfflineProgress;
G.applyPendingOfflineProgress = applyPendingOfflineProgress;
G.applyOfflineProgress = applyOfflineProgress;
G.applyOfflineMiningProgress = applyOfflineMiningProgress;
G.finalizeOfflineBossPartyState = finalizeOfflineBossPartyState;
G.addOfflineMiningOre = addOfflineMiningOre;
G.finalizeOfflineMiningState = finalizeOfflineMiningState;
G.awardOfflineEnemyRewards = awardOfflineEnemyRewards;
G.finalizeOfflineBattleState = finalizeOfflineBattleState;
G.closeOfflineReport = closeOfflineReport;
G.flushPrototypeStats = flushPrototypeStats;
G.acceptPrototypeStatsNotice = acceptPrototypeStatsNotice;
G.disablePrototypeStatsFromNotice = disablePrototypeStatsFromNotice;
G.acceptPrototypeResetNotice = acceptPrototypeResetNotice;
G.formatDuration = formatDuration;
G.formatBossRespawnDelay = formatBossRespawnDelay;
G.canAffordAccountUpgrade = canAffordAccountUpgrade;
G.activeUpgradeCategory = activeUpgradeCategory;
G.categoryUpgradeCountText = categoryUpgradeCountText;
G.createOreInventoryEntry = createOreInventoryEntry;
G.discardWeaponRefineStagedEntry = discardWeaponRefineStagedEntry;
G.clearWeaponRefineResultFxTimer = clearWeaponRefineResultFxTimer;
G.canPlaceWeaponRefineWeapon = canPlaceWeaponRefineWeapon;
G.canPlaceWeaponRefineOre = canPlaceWeaponRefineOre;
G.canPlaceWeaponRefineMaterial = canPlaceWeaponRefineMaterial;
G.clearWeaponRefineSlot = clearWeaponRefineSlot;
G.handleWeaponRefineSlotClick = handleWeaponRefineSlotClick;
G.assignWeaponRefineSlot = assignWeaponRefineSlot;
G.assignWeaponRefinePick = assignWeaponRefinePick;
G.collectWeaponRefineIngredients = collectWeaponRefineIngredients;
G.computeWeaponRefineChance = computeWeaponRefineChance;
G.chargeWeaponRefineGold = chargeWeaponRefineGold;
G.consumeWeaponRefineStagedMaterials = consumeWeaponRefineStagedMaterials;
G.applyWeaponRefineSuccess = applyWeaponRefineSuccess;
G.finalizeWeaponRefineOutcome = finalizeWeaponRefineOutcome;
G.attemptWeaponRefine = attemptWeaponRefine;
G.buyShopItem = buyShopItem;
G.compareSmithCombineEntries = compareSmithCombineEntries;
G.canSmithCombineItem = canSmithCombineItem;
G.combineSmithItem = combineSmithItem;
G.applySmithStatUpgrade = applySmithStatUpgrade;
G.gemCurrentStatCount = gemCurrentStatCount;
G.gemUpgradeSuccessChancePercent = gemUpgradeSuccessChancePercent;
G.gemUpgradeStatLabel = gemUpgradeStatLabel;
G.canApplyGemToEntry = canApplyGemToEntry;
G.applyGemStatUpgrade = applyGemStatUpgrade;
G.applyGemUpgrade = applyGemUpgrade;
G.bookItemsForSpell = bookItemsForSpell;
G.clearQueuedCombatSpell = clearQueuedCombatSpell;
G.adjustedKillExperience = adjustedKillExperience;
G.applyRebirthUpgradeStats = applyRebirthUpgradeStats;
G.autoCastSlotLimit = autoCastSlotLimit;
G.autoPotionSlotLimit = autoPotionSlotLimit;
G.autoPotionSlots = autoPotionSlots;
G.autoCastPriorityForClass = autoCastPriorityForClass;
G.autoCastSlotsUsed = autoCastSlotsUsed;
G.activeWizardAutoSpells = activeWizardAutoSpells;
G.activeWizardAutoSpell = activeWizardAutoSpell;
G.clearTwinDrakeChargeState = clearTwinDrakeChargeState;
G.clearFlamingSwordChargeState = clearFlamingSwordChargeState;
G.applyFlamingSwordChargeState = applyFlamingSwordChargeState;
G.applyTwinDrakeChargeState = applyTwinDrakeChargeState;
G.cancelWarriorCharge = cancelWarriorCharge;
G.cancelWarriorTwinDrakeCharge = cancelWarriorTwinDrakeCharge;
G.ensureInventorySlots = ensureInventorySlots;
G.carriedInventoryEntries = carriedInventoryEntries;
G.ensureStorageSlots = ensureStorageSlots;
G.allocateInventoryEntryId = allocateInventoryEntryId;
G.allocateStorageEntryId = allocateStorageEntryId;
G.combineInventoryStackEntries = combineInventoryStackEntries;
G.combineStorageStackEntries = combineStorageStackEntries;
G.clearHotbarEntry = clearHotbarEntry;
G.canEquipEntryToSlot = canEquipEntryToSlot;
G.canDropEntryToInventorySlot = canDropEntryToInventorySlot;
G.dropInventoryEntryToInventorySlot = dropInventoryEntryToInventorySlot;
G.canDropEntryToStorageSlot = canDropEntryToStorageSlot;
G.canWithdrawStorageEntryToInventorySlot = canWithdrawStorageEntryToInventorySlot;
G.canEquipStorageEntryToSlot = canEquipStorageEntryToSlot;
G.canDropEntryToHotbarSlot = canDropEntryToHotbarSlot;
G.dropInventoryEntryToHotbarSlot = dropInventoryEntryToHotbarSlot;
G.entryDurabilityPercent = entryDurabilityPercent;
G.completeEnemySpawnReveal = completeEnemySpawnReveal;
G.applyFixedArenaEnemySpawn = applyFixedArenaEnemySpawn;
G.benedictionBlessChance = benedictionBlessChance;
G.benedictionOutcomeRates = benedictionOutcomeRates;
G.benedictionLuckLabel = benedictionLuckLabel;
G.amuletInventoryEntries = amuletInventoryEntries;
G.amuletInventoryCount = amuletInventoryCount;
G.amuletCandidate = amuletCandidate;
G.consumeAmuletInventoryUnits = consumeAmuletInventoryUnits;
G.firstPotionEntryForKind = firstPotionEntryForKind;
G.autoPotionCandidates = autoPotionCandidates;
G.crystalPotionTickAmount = crystalPotionTickAmount;
G.crystalHealRegenLevel = crystalHealRegenLevel;
G.crystalHealRegenTickAmount = crystalHealRegenTickAmount;
G.applyEquipmentChanges = applyEquipmentChanges;
G.applyEquippedStatsToBattlePlayer = applyEquippedStatsToBattlePlayer;
G.applyEquippedVisualIndexes = applyEquippedVisualIndexes;
G.desiredEquippedVisualIndex = desiredEquippedVisualIndex;
G.compatibleEquipmentSlots = compatibleEquipmentSlots;
G.gameSideRecentLootHtml = gameSideRecentLootHtml;
G.activityLogHtml = activityLogHtml;
G.bindSceneButtons = bindSceneButtons;
G.buildSceneOverlaySignature = buildSceneOverlaySignature;
G.bindSceneScrollPreservation = bindSceneScrollPreservation;
G.captureSceneScrollPositions = captureSceneScrollPositions;
G.characterAvailableForBossAssist = characterAvailableForBossAssist;
G.gettingStartedSectionHtml = gettingStartedSectionHtml;
G.gettingStartedSceneHtml = gettingStartedSceneHtml;
G.characterSelectSceneHtml = characterSelectSceneHtml;
G.characterSelectCardHtml = characterSelectCardHtml;
G.characterSceneHtml = characterSceneHtml;
G.crystalCharacterTabHtml = crystalCharacterTabHtml;
G.crystalCharacterEquipmentPageHtml = crystalCharacterEquipmentPageHtml;
G.crystalCharacterPaperDollHtml = crystalCharacterPaperDollHtml;
G.crystalPaperDollLayerHtml = crystalPaperDollLayerHtml;
G.crystalPaperDollFrameHtml = crystalPaperDollFrameHtml;
G.crystalCharacterStatusPageHtml = crystalCharacterStatusPageHtml;
G.crystalCharacterStatePageHtml = crystalCharacterStatePageHtml;
G.crystalCharacterSkillPageHtml = crystalCharacterSkillPageHtml;
G.characterSkillSpells = characterSkillSpells;
G.crystalSkillRowHtml = crystalSkillRowHtml;
G.crystalStatusValueHtml = crystalStatusValueHtml;
G.characterStatusValue = characterStatusValue;
G.crystalEquipmentSlotHtml = crystalEquipmentSlotHtml;
G.crystalEquipmentItemHtml = crystalEquipmentItemHtml;
G.crystalStorageSlotHtml = crystalStorageSlotHtml;
G.crystalStorageItemHtml = crystalStorageItemHtml;
G.crystalInventorySlotHtml = crystalInventorySlotHtml;
G.crystalInventoryItemHtml = crystalInventoryItemHtml;
G.characterEquipmentStats = characterEquipmentStats;
G.characterTotalStats = characterTotalStats;
G.applyLearnedMagicStats = applyLearnedMagicStats;
G.characterSnapshotTotalStats = characterSnapshotTotalStats;
G.applyLearnedMagicStatsForClass = applyLearnedMagicStatsForClass;
G.cloneStats = cloneStats;
G.addStats = addStats;
G.addRange = addRange;
G.beginInventoryClickCarry = beginInventoryClickCarry;
G.handleInventoryCarryClick = handleInventoryCarryClick;
G.finishInventoryClickCarry = finishInventoryClickCarry;
G.cleanupInventoryCarry = cleanupInventoryCarry;
G.hasRangeValue = hasRangeValue;
G.classRequirementMet = classRequirementMet;
G.confirmBossZoneEntry = confirmBossZoneEntry;
G.enterZone = enterZone;
G.bossRoomDef = bossRoomDef;
G.clearGroupDungeonRunState = clearGroupDungeonRunState;
G.finishGroupDungeonWaveIfReady = finishGroupDungeonWaveIfReady;
G.continueGroupDungeonEndlessWaves = continueGroupDungeonEndlessWaves;
G.buildSwarmEnemyFromTemplate = buildSwarmEnemyFromTemplate;
G.findGroupDungeonSwarmEnemy = findGroupDungeonSwarmEnemy;
G.clearSwarmEnemyStep = clearSwarmEnemyStep;
G.completeSwarmEnemyStep = completeSwarmEnemyStep;
G.beginSwarmEnemyTileStep = beginSwarmEnemyTileStep;
G.awardGroupDungeonSwarmKill = awardGroupDungeonSwarmKill;
G.bossRespawnDelayMs = bossRespawnDelayMs;
G.bossRespawnReadyAt = bossRespawnReadyAt;
G.bossRespawnRemainingMs = bossRespawnRemainingMs;
G.bossKillCount = bossKillCount;
G.alchemistNpcSceneHtml = alchemistNpcSceneHtml;
G.applySpellBodyMapping = applySpellBodyMapping;
G.bindControls = bindControls;
G.bindStageCanvasEvents = bindStageCanvasEvents;
G.canvasPointFromEvent = canvasPointFromEvent;
G.closeTownNpc = closeTownNpc;
G.hideItemTooltip = hideItemTooltip;
G.atlasIndexKey = atlasIndexKey;
G.ensureEquippedVisualsFresh = ensureEquippedVisualsFresh;
G.catchUpSimulation = catchUpSimulation;
G.beginBossPartyFight = beginBossPartyFight;
G.fixedArenaPetWorldX = fixedArenaPetWorldX;
G.fixedArenaPartyShiftForPet = fixedArenaPartyShiftForPet;
G.beginMinotaurKingAttack = beginMinotaurKingAttack;
G.boneLordAttackRange = boneLordAttackRange;
G.boneLordMeleeRange = boneLordMeleeRange;
G.boneLordTargetDistance = boneLordTargetDistance;
G.boneLordUsesRangedAttack = boneLordUsesRangedAttack;
G.boneLordImpactDelay = boneLordImpactDelay;
G.canBoneLordAttack = canBoneLordAttack;
G.boneLordProjectileTargetAnchor = boneLordProjectileTargetAnchor;
G.evilCentipedeAttackRange = evilCentipedeAttackRange;
G.evilCentipedeImpactDelay = evilCentipedeImpactDelay;
G.evilCentipedeDistanceToTarget = evilCentipedeDistanceToTarget;
G.evilCentipedeTargetStats = evilCentipedeTargetStats;
G.evilCentipedeTargetsInRange = evilCentipedeTargetsInRange;
G.canEvilCentipedeAttack = canEvilCentipedeAttack;
G.applyCombatantPoison = applyCombatantPoison;
G.applyEvilCentipedePoisons = applyEvilCentipedePoisons;
G.addCombatantPoisonText = addCombatantPoisonText;
G.handleCombatantPoisonDeath = handleCombatantPoisonDeath;
G.beginEvilCentipedeAttack = beginEvilCentipedeAttack;
G.beginBoneLordAttack = beginBoneLordAttack;
G.finishBossPartyEnemy = finishBossPartyEnemy;
G.finishBossPartyDefeat = finishBossPartyDefeat;
G.bossDropTableForEnemy = bossDropTableForEnemy;
G.applyBossPartyMemberKillReward = applyBossPartyMemberKillReward;
G.applyBossPartyExperienceReward = applyBossPartyExperienceReward;
G.addBossPartyZoneDropItem = addBossPartyZoneDropItem;
G.addBossPartyMemberCombatText = addBossPartyMemberCombatText;
G.advancePlayerTravel = advancePlayerTravel;
G.consumeLastPlayerAttackCooldown = consumeLastPlayerAttackCooldown;
G.attachedSpellFxAnchor = attachedSpellFxAnchor;
G.beginTwinDrakeChargeFx = beginTwinDrakeChargeFx;
G.clearTwinDrakePendingState = clearTwinDrakePendingState;
G.chargedFlamingSwordAttack = chargedFlamingSwordAttack;
G.chargedWarriorAttack = chargedWarriorAttack;
G.chargedTwinDrakeAttack = chargedTwinDrakeAttack;
G.chargedSlayingAttack = chargedSlayingAttack;
G.halfMoonEnabled = halfMoonEnabled;
G.canUseHalfMoonAttack = canUseHalfMoonAttack;
G.halfMoonSplashSwarmEnemies = halfMoonSplashSwarmEnemies;
G.autoWarriorCombatSkills = autoWarriorCombatSkills;
G.autoWizardCombatSpells = autoWizardCombatSpells;
G.autoTaoistCombatSpells = autoTaoistCombatSpells;
G.canAutoCastWarriorSkill = canAutoCastWarriorSkill;
G.canUseWarriorSkill = canUseWarriorSkill;
G.canAutoCastWizardSpell = canAutoCastWizardSpell;
G.canUseWizardSpell = canUseWizardSpell;
G.canUseWizardFireWall = canUseWizardFireWall;
G.canAutoCastTaoistSpell = canAutoCastTaoistSpell;
G.canUseTaoistSpell = canUseTaoistSpell;
G.commitWarriorSpellUse = commitWarriorSpellUse;
G.applyWizardCastCooldown = applyWizardCastCooldown;
G.canWizardCastSpell = canWizardCastSpell;
G.commitWizardSpellUse = commitWizardSpellUse;
G.commitTaoistSpellUse = commitTaoistSpellUse;
G.clearWarriorSlayingReady = clearWarriorSlayingReady;
G.applyWizardMagicDefence = applyWizardMagicDefence;
G.ensureEnemyDebuffs = ensureEnemyDebuffs;
G.effectiveEnemyAttackMs = effectiveEnemyAttackMs;
G.effectiveEnemyMoveMs = effectiveEnemyMoveMs;
G.frostCrunchCanProc = frostCrunchCanProc;
G.frostCrunchSlowDurationMs = frostCrunchSlowDurationMs;
G.frostCrunchFrozenDurationMs = frostCrunchFrozenDurationMs;
G.applyEnemySlow = applyEnemySlow;
G.applyEnemyFrozen = applyEnemyFrozen;
G.applyFrostCrunchEffects = applyFrostCrunchEffects;
G.applyEnemyPoison = applyEnemyPoison;
G.crystalMagicMultiplier = crystalMagicMultiplier;
G.crystalMagicDamageBeforeDefence = crystalMagicDamageBeforeDefence;
G.crystalMagicPower = crystalMagicPower;
G.crystalRandomNext = crystalRandomNext;
G.crystalRound = crystalRound;
G.formatDefenceBuffApplied = formatDefenceBuffApplied;
G.hasActiveDefenceBuffOnList = hasActiveDefenceBuffOnList;
G.entityStatBuffList = entityStatBuffList;
G.entityDefenceBuffList = entityDefenceBuffList;
G.effectiveCombatStats = effectiveCombatStats;
G.defenceStatsForEntity = defenceStatsForEntity;
G.defenceTargetForIncomingAttack = defenceTargetForIncomingAttack;
G.applyTaoistDefenceBuffEffect = applyTaoistDefenceBuffEffect;
G.applyTaoistPartyDefenceBuffToTargets = applyTaoistPartyDefenceBuffToTargets;
G.formatTaoistDefenceBuffAppliedLog = formatTaoistDefenceBuffAppliedLog;
G.applyDefenceBuffEffect = applyDefenceBuffEffect;
G.hasUltimateEnhancerBuff = hasUltimateEnhancerBuff;
G.applyUltimateEnhancerEffect = applyUltimateEnhancerEffect;
G.applyUltimateEnhancerToTargets = applyUltimateEnhancerToTargets;
G.formatUltimateEnhancerAppliedLog = formatUltimateEnhancerAppliedLog;
G.createTaoistSummonPet = createTaoistSummonPet;
G.createTaoistSkeletonPet = createTaoistSkeletonPet;
G.createTaoistShinsuPet = createTaoistShinsuPet;
G.applyTaoistPetAttackResult = applyTaoistPetAttackResult;
G.clampNumber = clampNumber;
G.dismissTaoistPet = dismissTaoistPet;
G.activeTaoistSpellVisualBlocksSecondary = activeTaoistSpellVisualBlocksSecondary;
G.createWizardGroundSpellEffect = createWizardGroundSpellEffect;
G.applyMapLightningHitToMember = applyMapLightningHitToMember;
G.applyMapLightningHitToSoloPlayer = applyMapLightningHitToSoloPlayer;
G.applyMapLightningStrikeHit = applyMapLightningStrikeHit;
G.groundSpellEffectHitsSwarmEnemy = groundSpellEffectHitsSwarmEnemy;
G.groundSpellEffectHitsEnemy = groundSpellEffectHitsEnemy;
G.applyGroundSpellTick = applyGroundSpellTick;
G.applyGroundSpellTickToSwarmEnemy = applyGroundSpellTickToSwarmEnemy;
G.applyIncomingDamageReduction = applyIncomingDamageReduction;
G.addCombatText = addCombatText;
G.addSwarmEnemyCombatText = addSwarmEnemyCombatText;
G.finishBattle = finishBattle;
G.finishEnemy = finishEnemy;
G.awardEnemyRewards = awardEnemyRewards;
G.applyExperienceReward = applyExperienceReward;
G.addLootNotice = addLootNotice;
G.addZoneDropItem = addZoneDropItem;
G.availableWarriorCombatSkills = availableWarriorCombatSkills;
G.crystalProjectileImpactDelayMs = crystalProjectileImpactDelayMs;
G.applyCombatHudLayout = applyCombatHudLayout;
G.crystalSpellRangePx = crystalSpellRangePx;
G.effectivePlayerAttackSpeed = effectivePlayerAttackSpeed;
G.characterAttackSpeedLabel = characterAttackSpeedLabel;
G.canPlayerAttack = canPlayerAttack;
G.canEnemyAttack = canEnemyAttack;
G.footstepSideForFrame = footstepSideForFrame;
G.currentWeaponSwingSfxFamily = currentWeaponSwingSfxFamily;
G.currentWeaponHitSfxFamily = currentWeaponHitSfxFamily;
G.currentWeaponSfxFamily = currentWeaponSfxFamily;
G.currentClip = currentClip;
G.ensureStageCanvas = ensureStageCanvas;
G.clearStampBackgroundCache = clearStampBackgroundCache;
G.blitCachedStampBackground = blitCachedStampBackground;
G.currentTownMapStamp = currentTownMapStamp;
G.buildStampArenaDrawList = buildStampArenaDrawList;
G.cachedImage = cachedImage;
G.gameResourceMeterHtml = gameResourceMeterHtml;
G.gameLogLinesHtml = gameLogLinesHtml;
G.bar = bar;
G.hashDecorationSeed = hashDecorationSeed;
G.createEmptyObjectPattern = createEmptyObjectPattern;
G.escapeHtml = escapeHtml;
G.currentBackdropKind = currentBackdropKind;




