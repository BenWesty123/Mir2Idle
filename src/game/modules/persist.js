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

import { battlePanelSignature, gamePanelSignature, sceneSignature, sceneScrollPositions, musicTrackIndex, saveReady, lastSaveAt, pendingSavedPlayerResources, pendingOfflineProgress, sessionStartedAt } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function createDefaultWeaponRefineState() {
  return {
    weaponEntryId: null,
    oreEntryIds: Array(WEAPON_REFINE_ORE_SLOTS).fill(null),
    materialEntryIds: Array(WEAPON_REFINE_MATERIAL_SLOTS).fill(null),
    stagedEntries: {},
    picker: { kind: "weapon", index: 0 },
    resultFx: null,
    resultFxTimer: null,
  };
}

function createSaveSnapshot() {
  if (G.bossPartyOnField()) {
    const leaderClassId = G.bossPartyLeaderClassId();
    if (normalizeCharacterId(state.activeCharacterId) === leaderClassId) {
      G.syncBossPartyControlledMemberFromState(leaderClassId);
    } else {
      captureActiveCharacterState();
    }
    G.syncBossPartyMembersToCharacters(state.battle.bossParty, { applyControlled: false });
  } else {
    captureActiveCharacterState();
  }
  const activeCharacter = state.characters[state.activeCharacterId] ?? serializeCurrentCharacterState();
  const groupDungeonRun = G.groupDungeonOfflineRunSnapshot?.()
    ?? G.sanitizeGroupDungeonOfflineRun?.(activeCharacter.game?.groupDungeonRun, activeCharacter.game?.activeZoneId, state.activeCharacterId)
    ?? null;
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    activeCharacterId: state.activeCharacterId,
    groupDungeonRun,
    characters: serializeCharactersState(),
    account: {
      storage: cloneStorageState(state.account.storage),
      upgrades: G.cloneAccountUpgradeState(state.account.upgrades),
      rebirthPoints: accountRebirthPoints(),
      bossRespawns: { ...accountBossRespawns() },
      stats: sanitizeAccountStats(state.account.stats),
    },
    game: {
      ...activeCharacter.game,
      progress: { ...activeCharacter.game.progress },
      dropPity: { ...activeCharacter.game.dropPity },
      bossRespawns: { ...activeCharacter.game.bossRespawns },
      bossKills: { ...activeCharacter.game.bossKills },
      recentLoot: [...activeCharacter.game.recentLoot],
    },
    inventory: cloneInventoryStateIncludingWeaponRefineStaged(activeCharacter.inventory),
    hotbar: cloneHotbarState(activeCharacter.hotbar),
    magic: cloneMagicState(activeCharacter.magic),
    battle: {
      combatClass: state.battle.combatClass,
      ...activeCharacter.battle,
    },
    indexes: {
      armour: state.indexes.armour,
      hair: state.indexes.hair,
      weapon: state.indexes.weapon,
    },
    characterTab: state.characterTab,
    settings: {
      musicSettingsVersion: MUSIC_SETTINGS_VERSION,
      musicEnabled: Boolean(state.settings.musicEnabled),
      musicVolume: G.normalizedVolume(state.settings.musicVolume),
      musicMode: G.normalizedMusicMode(state.settings.musicMode),
      musicTrackId: G.currentMusicTrack()?.id ?? BACKGROUND_MUSIC_TRACKS[0]?.id ?? null,
      sfxEnabled: Boolean(state.settings.sfxEnabled),
      sfxVolume: G.normalizedVolume(state.settings.sfxVolume),
      prototypeStatsEnabled: Boolean(state.settings.prototypeStatsEnabled),
      prototypeStatsNoticeVersion: Math.max(0, Math.trunc(Number(state.settings.prototypeStatsNoticeVersion) || 0)),
      prototypeResetNoticeVersion: Math.max(0, Math.trunc(Number(state.settings.prototypeResetNoticeVersion) || 0)),
      prototypeResetNoticeLastSeenAt: Math.max(0, Math.trunc(Number(state.settings.prototypeResetNoticeLastSeenAt) || 0)),
    },
  };
}

function saveGameState(force = false) {
  if (!saveReady && !force) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(createSaveSnapshot()));
    lastSaveAt = performance.now();
    return true;
  } catch (err) {
    console.warn("Unable to save game state", err);
    return false;
  }
}

function installPartyDebugHook() {
  if (typeof window === "undefined") return;
  window.__LOM_PARTY_DEBUG__ = () => {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    } catch (err) {
      saved = { error: String(err) };
    }
    const activeCharacter = state.characters?.[state.activeCharacterId];
    return {
      activeCharacterId: state.activeCharacterId,
      mode: state.game.mode,
      activeZoneId: state.game.activeZoneId,
      pendingBossAssistSelection: [...(state.pendingBossAssistSelection ?? [])],
      bossAssistSelection: [...(state.bossAssistSelection ?? [])],
      livePartyClassIds: state.battle.bossParty?.members?.map((member) => member.classId) ?? [],
      livePartyActive: Boolean(state.battle.bossParty?.active),
      liveSwarmActive: Boolean(state.battle.swarm),
      stateGameGroupDungeonRun: state.game.groupDungeonRun ?? null,
      activeCharacterGroupDungeonRun: activeCharacter?.game?.groupDungeonRun ?? null,
      savedActiveCharacterId: saved?.activeCharacterId ?? null,
      savedTopLevelGroupDungeonRun: saved?.groupDungeonRun ?? null,
      savedActiveCharacterGroupDungeonRun: saved?.characters?.[saved?.activeCharacterId]?.game?.groupDungeonRun ?? null,
      savedCharacterRuns: Object.fromEntries((CHARACTER_IDS ?? []).map((classId) => [
        classId,
        saved?.characters?.[classId]?.game?.groupDungeonRun ?? null,
      ])),
      savedBattle: saved?.battle ? {
        combatClass: saved.battle.combatClass,
        running: saved.battle.running,
        paused: saved.battle.paused,
      } : null,
    };
  };
}

installPartyDebugHook();

function parseSaveSnapshotText(rawText) {
  const trimmed = String(rawText ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a save file or choose a JSON file first." };
  }
  let snapshot;
  try {
    snapshot = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "That text is not valid JSON." };
  }
  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, error: "Save data must be a JSON object." };
  }
  const version = Number(snapshot.version);
  if (!Number.isFinite(version)) {
    return { ok: false, error: "Save is missing a version number." };
  }
  if (version !== SAVE_VERSION) {
    return {
      ok: false,
      error: `Save version ${version} is not supported (expected ${SAVE_VERSION}).`,
    };
  }
  if (!snapshot.characters || typeof snapshot.characters !== "object") {
    return { ok: false, error: "Save is missing character data." };
  }
  return { ok: true, snapshot };
}

function saveImportBlockedReason() {
  if (G.bossPartyOnField()) return "Return to town before importing a save.";
  return null;
}

function exportSaveDownloadName() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `lom-idle-v2-save-${stamp}.json`;
}

function exportGameSave() {
  try {
    const snapshot = createSaveSnapshot();
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportSaveDownloadName();
    link.click();
    URL.revokeObjectURL(url);
    G.pushBattleLog("Save exported.");
    G.playSfx("ui.button", { volume: 0.28, throttleMs: 120 });
    return true;
  } catch (err) {
    console.warn("Unable to export game save", err);
    window.alert("Export failed. Try again after returning to town.");
    return false;
  }
}

function clearTransientBattleForSaveImport() {
  G.stopOneStepTest();
  state.continuousWalk = false;
  state.battle.bossParty = null;
  G.dismissTaoistPet();
  state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
  state.battle.pendingHeal = null;
  state.battle.pendingPoison = null;
  state.battle.pendingPetAttack = null;
  state.battle.pendingTwinDrakeHits = [];
  state.battle.groundSpellEffects = [];
  state.battle.attachedSpellFx = [];
  G.clearTwinDrakePendingState();
}

async function importGameSaveFromText(rawText) {
  const blockReason = saveImportBlockedReason();
  if (blockReason) {
    window.alert(blockReason);
    return false;
  }

  const parsed = parseSaveSnapshotText(rawText);
  if (!parsed.ok) {
    window.alert(parsed.error);
    return false;
  }

  if (!window.confirm("Import this save? Progress on this device will be replaced.")) {
    return false;
  }

  saveReady = false;
  clearTransientBattleForSaveImport();
  if (!applySaveSnapshot(parsed.snapshot)) {
    saveReady = true;
    window.alert("Could not apply that save.");
    return false;
  }

  saveGameState(true);
  G.resetBattleForCurrentMode(true);
  G.applyPendingOfflineProgress();
  await G.reloadAtlases();
  await G.reloadEnemyAtlas();
  saveReady = true;
  G.invalidateUi();
  G.renderLayerControls();
  G.renderMapControls();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderSceneOverlay();
  G.renderOfflineReport();
  G.renderCombatSkillBar();
  G.renderHotbar();
  G.render();
  G.closeScene("options");
  G.pushBattleLog("Save imported.");
  G.playSfx("ui.teleport", { volume: 0.42, throttleMs: 300 });
  return true;
}

function loadSavedGameState() {
  let snapshot;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = parseSaveSnapshotText(raw);
    if (!parsed.ok) return false;
    snapshot = parsed.snapshot;
  } catch (err) {
    console.warn("Unable to load game state", err);
    return false;
  }

  return applySaveSnapshot(snapshot);
}

function savedGroupDungeonRunFromCharacters(snapshot, activeZoneId, activeCharacterId) {
  const topLevel = G.sanitizeGroupDungeonOfflineRun?.(snapshot?.groupDungeonRun, activeZoneId, activeCharacterId);
  if (topLevel?.zoneId === activeZoneId) return topLevel;

  const activeCharacter = snapshot?.characters?.[activeCharacterId];
  const characterRun = G.sanitizeGroupDungeonOfflineRun?.(activeCharacter?.game?.groupDungeonRun, activeZoneId, activeCharacterId);
  if (characterRun?.zoneId === activeZoneId) return characterRun;

  const chars = snapshot?.characters && typeof snapshot.characters === "object" ? snapshot.characters : state.characters;
  const ids = CHARACTER_IDS.filter((classId) => {
    const character = chars?.[classId];
    return character?.game?.mode === "zone"
      && character?.game?.activeZoneId === activeZoneId
      && character?.battle?.running !== false;
  });
  if (!ids.length) return null;
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === activeZoneId);
  return G.sanitizeGroupDungeonOfflineRun?.({
    zoneId: activeZoneId,
    leaderClassId: activeCharacterId,
    classIds: ids,
    waveNumber: 1,
    killedThisWave: 0,
    targetThisWave: groupDungeonWaveSpawnCount(1, zone),
    endless: false,
  }, activeZoneId, activeCharacterId) ?? null;
}

function applySaveSnapshot(snapshot) {
  if (!snapshot) return false;

  state.characters = restoreCharactersState(snapshot);
  const savedStorageRaw = snapshot.account?.storage ?? snapshot.storage;
  const hadUnpaidStoragePage2 = Math.trunc(Number(savedStorageRaw?.pagesUnlocked) || 1) >= 2
    && !savedStorageRaw?.page2Purchased;
  state.account.storage = sanitizeStorageState(savedStorageRaw);
  state.account.upgrades = sanitizeAccountUpgradeState(snapshot.account?.upgrades ?? snapshot.upgrades);
  state.account.rebirthPoints = Math.max(0, Math.trunc(Number(snapshot.account?.rebirthPoints) || 0));
  state.account.bossRespawns = sanitizeBossRespawns(snapshot.account?.bossRespawns);
  state.account.stats = sanitizeAccountStats(snapshot.account?.stats);
  migrateAccountBossRespawns();
  migrateAccountStats();
  state.activeCharacterId = normalizeCharacterId(snapshot.activeCharacterId ?? snapshot.battle?.combatClass);
  applyCharacterState(state.activeCharacterId, state.characters[state.activeCharacterId]);
  if (hadUnpaidStoragePage2 && state.account.storage.pagesUnlocked === 1) {
    state.storagePage = 0;
    G.pushBattleLog("Storage page 2 was reset. Unlock it for 1,000,000 gold when you're ready.");
  }
  restoreSettingsState(snapshot);
  restoreEquipmentVisualIndexes(snapshot);
  state.characterTab = CHARACTER_TABS.some((tab) => tab.id === snapshot.characterTab) ? snapshot.characterTab : "character";
  const groupDungeonRun = savedGroupDungeonRunFromCharacters(snapshot, state.game.activeZoneId, state.activeCharacterId);
  if (groupDungeonRun?.zoneId === state.game.activeZoneId) {
    state.game.groupDungeonRun = groupDungeonRun;
    state.pendingBossAssistSelection = groupDungeonRun.classIds.filter((classId) => classId !== state.activeCharacterId);
    state.bossAssistSelection = [...state.pendingBossAssistSelection];
  } else {
    state.game.groupDungeonRun = null;
    state.pendingBossAssistSelection = [];
    state.bossAssistSelection = [];
  }
  pendingOfflineProgress = G.createPendingOfflineProgress({
    ...snapshot,
    game: state.game,
    battle: {
      ...(snapshot.battle ?? {}),
      ...(state.characters[state.activeCharacterId]?.battle ?? {}),
      combatClass: state.activeCharacterId,
    },
  });
  return true;
}

function normalizeCharacterId(classId) {
  const candidate = String(classId ?? "");
  const match = CHARACTER_SELECT_CLASSES.find((entry) => entry.id === candidate && !entry.disabled);
  return match?.id ?? "Warrior";
}

function createDefaultCharacterStates() {
  return Object.fromEntries(CHARACTER_IDS.map((classId) => [classId, createDefaultCharacterState(classId)]));
}

function createDefaultStorageState() {
  return {
    pagesUnlocked: 1,
    page2Purchased: false,
    maxSlots: STORAGE_BASE_SLOTS,
    nextInstanceId: 1,
    items: [],
  };
}

function createDefaultCharacterState(classId) {
  const inventory = G.createStarterInventoryState(classId);
  return {
    classId,
    game: {
      mode: "town",
      activeZoneId: null,
      kills: 0,
      zoneKills: 0,
      distance: 0,
      playtimeMs: 0,
      lastReward: null,
      recentLoot: [],
      dropPity: {},
      bossRespawns: {},
      bossKills: {},
      progress: {
        level: PLAYER_TEMPLATE.level,
        experience: PLAYER_TEMPLATE.experience,
        gold: inventory.gold,
      },
      starterGearVersion: STARTER_GEAR_VERSION,
      miningNextRollAt: 0,
      miningSpotId: null,
      groupDungeonRun: null,
    },
    inventory,
    hotbar: { slots: Array(HOTBAR_SLOT_COUNT).fill(null) },
    magic: { learned: {} },
    battle: {
      running: false,
      paused: false,
      playerHp: null,
      playerMp: null,
      potHealthAmount: 0,
      potManaAmount: 0,
      healAmount: 0,
      statBuffs: [],
      petStatBuffs: [],
    },
  };
}

function restoreCharactersState(snapshot) {
  const characters = createDefaultCharacterStates();
  if (snapshot.characters && typeof snapshot.characters === "object") {
    for (const classId of CHARACTER_IDS) {
      characters[classId] = sanitizeCharacterState(snapshot.characters[classId], classId);
    }
    return characters;
  }

  const activeClassId = normalizeCharacterId(snapshot.battle?.combatClass);
  characters[activeClassId] = legacyCharacterStateFromSnapshot(snapshot, activeClassId);
  return characters;
}

function legacyCharacterStateFromSnapshot(snapshot, classId) {
  const character = createDefaultCharacterState(classId);
  character.game = sanitizeCharacterGameState(snapshot.game, snapshot.inventory?.gold ?? snapshot.game?.progress?.gold, classId);
  character.inventory = sanitizeInventoryState(snapshot.inventory, snapshot.hotbar, character.game.progress.gold);
  character.game.progress.gold = character.inventory.gold;
  character.hotbar = sanitizeHotbarState(snapshot.hotbar, character.inventory);
  character.magic = removeRetiredTestingDefaultMagic(classId, sanitizeMagicState(snapshot.magic));
  character.battle = sanitizeCharacterBattleState(snapshot.battle);
  backfillStarterGear(character, classId);
  return character;
}

function sanitizeCharacterState(savedCharacter, classId) {
  const character = createDefaultCharacterState(classId);
  if (!savedCharacter || typeof savedCharacter !== "object") return character;
  character.game = sanitizeCharacterGameState(savedCharacter.game, savedCharacter.inventory?.gold, classId);
  character.inventory = sanitizeInventoryState(savedCharacter.inventory, savedCharacter.hotbar, character.game.progress.gold);
  character.game.progress.gold = character.inventory.gold;
  character.hotbar = sanitizeHotbarState(savedCharacter.hotbar, character.inventory);
  character.magic = removeRetiredTestingDefaultMagic(classId, sanitizeMagicState(savedCharacter.magic));
  character.battle = sanitizeCharacterBattleState(savedCharacter.battle);
  backfillStarterGear(character, classId);
  return character;
}

function backfillStarterGear(character, classId) {
  if ((Number(character.game?.starterGearVersion) || 0) >= STARTER_GEAR_VERSION) return;
  if (classId === "Taoist") backfillInventoryItem(character.inventory, "wooden-sword", 1);
  character.game.starterGearVersion = STARTER_GEAR_VERSION;
}

function backfillInventoryItem(inventory, itemId, quantity = 1) {
  if (!inventory || inventory.items?.some((entry) => entry.itemId === itemId)) return false;
  G.addStarterInventoryEntry(inventory, itemId, quantity);
  return true;
}

function sanitizeCharacterGameState(savedGame, fallbackGold = PLAYER_TEMPLATE.gold, fallbackClassId = state.activeCharacterId) {
  const zoneExists = PROTOTYPE_ZONES.some((zone) => zone.id === savedGame?.activeZoneId);
  const miningMode = savedGame?.mode === "mining" && savedGame?.activeZoneId === MINING_ZONE_ID;
  const zoneMode = savedGame?.mode === "zone" && zoneExists;
  const game = {
    mode: miningMode ? "mining" : zoneMode ? "zone" : "town",
    activeZoneId: miningMode || zoneMode ? savedGame.activeZoneId : null,
    miningNextRollAt: Math.max(0, Math.trunc(Number(savedGame?.miningNextRollAt) || 0)),
    miningSpotId: G.miningSpotById(savedGame?.miningSpotId)?.id ?? null,
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
      level: Math.max(1, Math.trunc(Number(savedGame?.progress?.level) || PLAYER_TEMPLATE.level)),
      experience: Math.max(0, Math.trunc(Number(savedGame?.progress?.experience) || 0)),
      gold: Math.max(0, Math.trunc(Number(savedGame?.progress?.gold ?? fallbackGold ?? PLAYER_TEMPLATE.gold) || 0)),
    },
    starterGearVersion: Math.max(0, Math.trunc(Number(savedGame?.starterGearVersion) || 0)),
  };
  game.groupDungeonRun = G.sanitizeGroupDungeonOfflineRun?.(savedGame?.groupDungeonRun, game.activeZoneId, fallbackClassId) ?? null;
  return game;
}

function sanitizeBossRespawns(respawns = {}) {
  if (!respawns || typeof respawns !== "object") return {};
  return Object.fromEntries(
    Object.entries(respawns)
      .filter(([zoneId]) => G.bossRoomDef(zoneId))
      .map(([zoneId, readyAt]) => [zoneId, Math.max(0, Math.trunc(Number(readyAt) || 0))]),
  );
}

function sanitizeAccountStats(saved = {}) {
  return {
    rebirthCount: Math.max(0, Math.trunc(Number(saved?.rebirthCount) || 0)),
    rebirthPointsGained: Math.max(0, Math.trunc(Number(saved?.rebirthPointsGained) || 0)),
    rebirthPointsSpent: Math.max(0, Math.trunc(Number(saved?.rebirthPointsSpent) || 0)),
    bossKills: sanitizeBossKills(saved?.bossKills),
  };
}

function ensureAccountStats() {
  state.account.stats = sanitizeAccountStats(state.account?.stats);
}

function accountBossKills() {
  ensureAccountStats();
  return { ...sanitizeBossKills(state.account.stats.bossKills) };
}

function syncAccountBossKillsToCharacters() {
  const kills = accountBossKills();
  state.game.bossKills = { ...kills };
  for (const classId of CHARACTER_IDS) {
    const character = state.characters[classId];
    if (!character) continue;
    character.game.bossKills = { ...kills };
  }
}

function migrateAccountStats() {
  ensureAccountStats();
  const mergedKills = { ...accountBossKills() };
  for (const classId of CHARACTER_IDS) {
    const kills = sanitizeBossKills(state.characters[classId]?.game?.bossKills);
    for (const [zoneId, count] of Object.entries(kills)) {
      mergedKills[zoneId] = Math.max(mergedKills[zoneId] ?? 0, count);
    }
  }
  state.account.stats.bossKills = mergedKills;
  syncAccountBossKillsToCharacters();
}

function trackRebirthPointsGained(quantity) {
  const amount = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (amount <= 0) return;
  ensureAccountStats();
  state.account.stats.rebirthPointsGained += amount;
}

function trackRebirthPointsSpent(quantity) {
  const amount = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (amount <= 0) return;
  ensureAccountStats();
  state.account.stats.rebirthPointsSpent += amount;
}

function accountTotalGold() {
  captureActiveCharacterState();
  let total = 0;
  for (const classId of CHARACTER_IDS) {
    const character = state.characters[classId];
    total += Math.max(0, Math.trunc(Number(character?.game?.progress?.gold ?? character?.inventory?.gold) || 0));
  }
  return total;
}

function accountStatsSnapshot() {
  ensureAccountStats();
  captureActiveCharacterState();
  const bossKills = accountBossKills();
  const characterLevels = {};
  for (const classId of CHARACTER_IDS) {
    const progress = state.characters[classId]?.game?.progress;
    characterLevels[classId] = Math.max(1, Math.trunc(Number(progress?.level) || 1));
  }
  return {
    rebirthCount: state.account.stats.rebirthCount,
    rebirthPointsGained: state.account.stats.rebirthPointsGained,
    rebirthPointsSpent: state.account.stats.rebirthPointsSpent,
    rebirthPointsHeld: accountRebirthPoints(),
    awakeningSoulsHeld: accountAwakenedSoulCount(),
    totalGold: accountTotalGold(),
    bossKills,
    bossKillsTotal: Object.values(bossKills).reduce((sum, count) => sum + Math.max(0, Math.trunc(Number(count) || 0)), 0),
    characterLevels,
    highestCharacterLevel: Math.max(1, ...Object.values(characterLevels)),
  };
}

function sanitizeBossKills(kills = {}) {
  if (!kills || typeof kills !== "object") return {};
  return Object.fromEntries(
    Object.entries(kills)
      .filter(([zoneId]) => G.bossRoomDef(zoneId))
      .map(([zoneId, count]) => [zoneId, Math.max(0, Math.trunc(Number(count) || 0))]),
  );
}

function sanitizeInventoryState(savedInventory = {}, savedHotbar = {}, fallbackGold = 0) {
  const usedIds = new Set();
  let maxGeneratedId = 0;
  const items = [];

  for (const savedEntry of Array.isArray(savedInventory.items) ? savedInventory.items : []) {
    if (!savedEntry?.itemId) continue;
    const id = typeof savedEntry.id === "string" && savedEntry.id ? savedEntry.id : "";
    if (!id || usedIds.has(id)) continue;
    usedIds.add(id);
    const generatedId = /^item-(\d+)$/.exec(id)?.[1];
    if (generatedId) maxGeneratedId = Math.max(maxGeneratedId, Number(generatedId));
    items.push({
      id,
      itemId: savedEntry.itemId,
      quantity: Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1)),
      slot: Number.isInteger(savedEntry.slot) ? savedEntry.slot : null,
      ...normalizeInventoryEntryFields(savedEntry),
    });
  }

  const savedEquippedIds = new Set(Object.values(savedInventory.equipment ?? {}).filter(Boolean));
  const savedHotbarIds = new Set((savedHotbar.slots ?? []).filter(Boolean));
  const savedBagItems = items.filter((entry) => !savedEquippedIds.has(entry.id) && !savedHotbarIds.has(entry.id));
  const needsSecondPage = savedBagItems.length > INVENTORY_PAGE_SIZE
    || savedBagItems.some((entry) => Number.isInteger(entry.slot) && entry.slot >= INVENTORY_PAGE_SIZE);
  const pagesUnlocked = Math.max(
    Math.max(1, Math.min(G.inventoryPageCount(), Math.trunc(Number(savedInventory.pagesUnlocked) || 1))),
    needsSecondPage ? 2 : 1,
  );
  const inventory = {
    gold: Math.max(0, Math.trunc(Number(savedInventory.gold ?? fallbackGold) || 0)),
    pagesUnlocked,
    maxSlots: Math.min(INVENTORY_MAX_SLOTS, pagesUnlocked * INVENTORY_PAGE_SIZE),
    nextInstanceId: Math.max(maxGeneratedId + 1, Math.trunc(Number(savedInventory.nextInstanceId) || 1), 1),
    items,
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, null])),
  };

  const availableEntryIds = new Set(items.map((entry) => entry.id));
  const equippedIds = new Set();
  for (const slot of EQUIPMENT_SLOTS) {
    const entryId = savedInventory.equipment?.[slot.id] ?? null;
    if (!availableEntryIds.has(entryId) || equippedIds.has(entryId)) continue;
    inventory.equipment[slot.id] = entryId;
    equippedIds.add(entryId);
  }
  return inventory;
}

function sanitizeStorageState(savedStorage = {}) {
  const usedIds = new Set();
  let maxGeneratedId = 0;
  const items = [];

  for (const savedEntry of Array.isArray(savedStorage.items) ? savedStorage.items : []) {
    if (!savedEntry?.itemId) continue;
    let id = typeof savedEntry.id === "string" && savedEntry.id ? savedEntry.id : "";
    if (!id || usedIds.has(id)) {
      maxGeneratedId += 1;
      id = `storage-item-${maxGeneratedId}`;
    }
    usedIds.add(id);
    const generatedId = /^storage-item-(\d+)$/.exec(id)?.[1];
    if (generatedId) maxGeneratedId = Math.max(maxGeneratedId, Number(generatedId));
    items.push({
      id,
      itemId: savedEntry.itemId,
      quantity: Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1)),
      slot: Number.isInteger(savedEntry.slot) ? savedEntry.slot : null,
      ...normalizeInventoryEntryFields(savedEntry),
    });
  }

  const savedPagesUnlocked = Math.max(
    1,
    Math.min(G.storagePageCount(), Math.trunc(Number(savedStorage.pagesUnlocked) || 1)),
  );
  const page2Purchased = Boolean(savedStorage.page2Purchased);
  let pagesUnlocked = savedPagesUnlocked;
  if (pagesUnlocked >= 2 && !page2Purchased) {
    for (const entry of items) {
      if (Number.isInteger(entry.slot) && entry.slot >= STORAGE_PAGE_SIZE) {
        entry.slot = null;
      }
    }
    pagesUnlocked = 1;
  }
  const storage = {
    pagesUnlocked,
    page2Purchased,
    maxSlots: STORAGE_BASE_SLOTS,
    nextInstanceId: Math.max(maxGeneratedId + 1, Math.trunc(Number(savedStorage.nextInstanceId) || 1), 1),
    items,
  };
  G.syncStorageCapacity(storage);
  G.ensureStorageSlots(storage);
  return storage;
}

function sanitizeAccountUpgradeState(savedUpgrades = {}) {
  const rawPurchased = savedUpgrades?.purchased && typeof savedUpgrades.purchased === "object"
    ? savedUpgrades.purchased
    : savedUpgrades;
  const rawTiers = savedUpgrades?.tiers && typeof savedUpgrades.tiers === "object"
    ? savedUpgrades.tiers
    : {};
  const tiers = {};
  for (const upgrade of ACCOUNT_UPGRADE_DEFS) {
    const fromTiers = Math.max(0, Math.trunc(Number(rawTiers?.[upgrade.id]) || 0));
    const fromPurchased = rawPurchased?.[upgrade.id] ? 1 : 0;
    const tier = Math.max(fromTiers, fromPurchased);
    const maxTier = G.accountUpgradeMaxTier(upgrade);
    if (tier > 0) {
      tiers[upgrade.id] = Number.isFinite(maxTier) ? Math.min(tier, maxTier) : tier;
    }
  }
  const legacyStatTier = Math.max(0, Math.trunc(Number(rawTiers?.[LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID]) || 0));
  if (legacyStatTier > 0) {
    for (const upgradeId of REBIRTH_BASE_STAT_UPGRADE_IDS) {
      tiers[upgradeId] = Math.max(tiers[upgradeId] ?? 0, legacyStatTier);
    }
  }
  return { tiers };
}

function awakeningSoulQuantityInInventory(inventory, itemId = AWAKENING_SOUL_ITEM_ID) {
  return (inventory?.items ?? [])
    .filter((entry) => entry.itemId === itemId)
    .reduce((total, entry) => total + Math.max(1, Math.trunc(Number(entry.quantity) || 1)), 0);
}

function accountAwakenedSoulCount() {
  captureActiveCharacterState();
  let total = 0;
  for (const classId of CHARACTER_IDS) {
    total += awakeningSoulQuantityInInventory(state.characters[classId]?.inventory);
  }
  for (const entry of G.storageEntries()) {
    if (entry.itemId === AWAKENING_SOUL_ITEM_ID) {
      total += Math.max(1, Math.trunc(Number(entry.quantity) || 1));
    }
  }
  return total;
}

function canPerformRebirth() {
  if (!REBIRTH_ENABLED) return false;
  return accountAwakenedSoulCount() >= 1;
}

function deductItemQuantityFromInventoryState(inventory, itemId, quantity) {
  let remaining = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (!inventory || remaining <= 0) return remaining;
  const entries = [...(inventory.items ?? [])].filter((entry) => entry.itemId === itemId);
  for (const entry of entries) {
    if (remaining <= 0) break;
    const stack = Math.max(1, Math.trunc(Number(entry.quantity) || 1));
    const taken = Math.min(remaining, stack);
    entry.quantity = stack - taken;
    remaining -= taken;
    if (entry.quantity <= 0) {
      inventory.items = inventory.items.filter((candidate) => candidate.id !== entry.id);
    }
  }
  return remaining;
}

function deductItemQuantityFromStorage(itemId, quantity) {
  let remaining = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (remaining <= 0) return remaining;
  const entries = [...storageEntries()].filter((entry) => entry.itemId === itemId);
  for (const entry of entries) {
    if (remaining <= 0) break;
    const stack = Math.max(1, Math.trunc(Number(entry.quantity) || 1));
    const taken = Math.min(remaining, stack);
    entry.quantity = stack - taken;
    remaining -= taken;
    if (entry.quantity <= 0) {
      state.account.storage.items = state.account.storage.items.filter((candidate) => candidate.id !== entry.id);
    }
  }
  return remaining;
}

function createStorageEntry(itemId, quantity) {
  G.ensureStorageSlots();
  const slot = G.nextFreeStorageSlot();
  const maxSlots = state.account.storage.maxSlots;
  return {
    id: G.allocateStorageEntryId(),
    itemId,
    quantity,
    slot: Number.isInteger(slot) && slot < maxSlots ? slot : null,
  };
}

function addItemQuantityToStorage(itemId, quantity = 1) {
  G.ensureStorageSlots();
  const item = G.itemDefinition(itemId);
  if (!item) return 0;
  let remaining = Math.max(1, Math.floor(Number(quantity) || 1));
  const maxStack = G.maxItemStack(item);
  let added = 0;

  while (remaining > 0) {
    if (G.isStackableItem(item)) {
      const existing = G.storageEntries().find((entry) => entry.itemId === itemId && entry.quantity < maxStack);
      if (existing) {
        const add = Math.min(remaining, maxStack - existing.quantity);
        existing.quantity += add;
        remaining -= add;
        added += add;
        continue;
      }
      if (G.nextFreeStorageSlot() >= state.account.storage.maxSlots) break;
      const entry = createStorageEntry(itemId, Math.min(remaining, maxStack));
      state.account.storage.items.push(entry);
      added += entry.quantity;
      remaining -= entry.quantity;
      continue;
    }

    if (G.nextFreeStorageSlot() >= state.account.storage.maxSlots) break;
    const entry = createStorageEntry(itemId, 1);
    state.account.storage.items.push(entry);
    added += 1;
    remaining -= 1;
  }

  G.ensureStorageSlots();
  return added;
}

function accountRebirthPoints() {
  return Math.max(0, Math.trunc(Number(state.account.rebirthPoints) || 0));
}

function payRebirthPoints(quantity) {
  const cost = Math.max(1, Math.trunc(Number(quantity) || 1));
  if (accountRebirthPoints() < cost) return false;
  state.account.rebirthPoints = accountRebirthPoints() - cost;
  trackRebirthPointsSpent(cost);
  return true;
}

function resetCharacterProgressForRebirth(classId) {
  return createDefaultCharacterState(classId);
}

function awakeningSoulQuantityInStorage() {
  return G.storageEntries()
    .filter((entry) => entry.itemId === AWAKENING_SOUL_ITEM_ID)
    .reduce((total, entry) => total + Math.max(1, Math.trunc(Number(entry.quantity) || 1)), 0);
}

function resetAccountStorageForRebirth() {
  captureActiveCharacterState();
  state.account.storage = createDefaultStorageState();
}

function resetNonRebirthAccountUpgrades() {
  state.account.upgrades = sanitizeAccountUpgradeState(state.account.upgrades);
  const tiers = { ...(state.account.upgrades.tiers ?? {}) };
  for (const upgradeId of Object.keys(tiers)) {
    const upgrade = G.accountUpgradeById(upgradeId);
    if (!upgrade || upgrade.category !== "rebirth") delete tiers[upgradeId];
  }
  state.account.upgrades = { tiers };
}

function performAccountRebirth() {
  if (!REBIRTH_ENABLED) {
    G.pushBattleLog("Rebirth is not available yet.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  if (!canPerformRebirth()) {
    G.pushBattleLog("Need at least 1 Awakening Soul to rebirth.");
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  captureActiveCharacterState();
  const soulsConverted = accountAwakenedSoulCount();
  resetAccountStorageForRebirth();
  resetNonRebirthAccountUpgrades();
  ensureAccountStats();
  if (soulsConverted > 0) {
    state.account.rebirthPoints = accountRebirthPoints() + soulsConverted;
    trackRebirthPointsGained(soulsConverted);
  }
  state.account.stats.rebirthCount += 1;
  for (const classId of CHARACTER_IDS) {
    state.characters[classId] = resetCharacterProgressForRebirth(classId);
  }
  state.game.mode = "town";
  state.game.activeZoneId = null;
  state.showEnemies = false;
  state.continuousWalk = false;
  state.paused = false;
  state.bossEmpowerSelected = false;
  applyCharacterState(state.activeCharacterId, state.characters[state.activeCharacterId]);
  G.normalizeAutoCastSpellsForClass(state.battle.combatClass);
  G.resetBattleForCurrentMode(false);
  G.pushBattleLog(`Rebirth complete. All characters reset to level 1 with starter gear.${soulsConverted > 0 ? ` ${soulsConverted} Awakening Soul${soulsConverted === 1 ? "" : "s"} converted into Rebirth Points.` : ""}`);
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderMapControls();
  G.render();
  saveGameState(true);
  return true;
}

function sanitizeHotbarState(savedHotbar = {}, inventory = state.inventory) {
  const availableEntryIds = new Set((inventory.items ?? []).map((entry) => entry.id));
  const equippedIds = new Set(Object.values(inventory.equipment ?? {}).filter(Boolean));
  return {
    slots: Array.from({ length: HOTBAR_SLOT_COUNT }, (_, slot) => {
      const entryId = savedHotbar?.slots?.[slot] ?? null;
      return availableEntryIds.has(entryId) && !equippedIds.has(entryId) ? entryId : null;
    }),
  };
}

function sanitizeMagicState(savedMagic = {}) {
  const learned = savedMagic?.learned ?? {};
  return {
    learned: Object.fromEntries(
      Object.entries(learned)
        .filter(([spellId]) => G.magicSpellById(spellId))
        .map(([spellId, savedSpell]) => [
          spellId,
          {
            spellId,
            level: Math.max(0, Math.min(3, Math.trunc(Number(savedSpell.level) || 0))),
            experience: Math.max(0, Math.trunc(Number(savedSpell.experience) || 0)),
            key: savedSpell.key ?? null,
            autoCast: Boolean(savedSpell.autoCast),
            castReadyAt: 0,
            learnedAt: Number(savedSpell.learnedAt) || 0,
          },
        ]),
    ),
  };
}

function sanitizeCharacterBattleState(savedBattle = {}) {
  return {
    running: savedBattle?.running !== false,
    paused: savedBattle?.paused === true,
    playerHp: finiteNumberOrNull(savedBattle?.playerHp),
    playerMp: finiteNumberOrNull(savedBattle?.playerMp),
    potHealthAmount: Math.max(0, Math.trunc(Number(savedBattle?.potHealthAmount) || 0)),
    potManaAmount: Math.max(0, Math.trunc(Number(savedBattle?.potManaAmount) || 0)),
    healAmount: Math.max(0, Math.trunc(Number(savedBattle?.healAmount) || 0)),
    statBuffs: sanitizeStatBuffs(savedBattle?.statBuffs),
    petStatBuffs: sanitizeStatBuffs(savedBattle?.petStatBuffs),
  };
}

function applyCharacterState(classId, character = createDefaultCharacterState(classId)) {
  const safeClassId = normalizeCharacterId(classId);
  state.activeCharacterId = safeClassId;
  state.battle.combatClass = safeClassId;
  state.game.mode = character.game.mode;
  state.game.activeZoneId = character.game.activeZoneId;
  state.game.kills = character.game.kills;
  state.game.zoneKills = character.game.zoneKills;
  state.game.distance = character.game.distance;
  state.game.playtimeMs = character.game.playtimeMs;
  sessionStartedAt = performance.now();
  state.game.lastReward = character.game.lastReward;
  state.game.recentLoot = [...character.game.recentLoot];
  state.game.lootToasts = [];
  state.game.dropPity = { ...character.game.dropPity };
  state.game.bossRespawns = { ...accountBossRespawns() };
  state.game.bossKills = { ...accountBossKills() };
  state.game.selectedTownNpcId = null;
  state.game.hoveredTownNpcId = null;
  state.game.miningNextRollAt = Math.max(0, Math.trunc(Number(character.game.miningNextRollAt) || 0));
  state.game.miningSpotId = G.miningSpotById(character.game.miningSpotId)?.id ?? null;
  state.game.groupDungeonRun = G.sanitizeGroupDungeonOfflineRun?.(character.game.groupDungeonRun, character.game.activeZoneId, safeClassId) ?? null;
  state.game.progress = { ...character.game.progress };
  state.inventory = cloneInventoryState(character.inventory);
  state.hotbar = cloneHotbarState(character.hotbar);
  state.magic = cloneMagicState(character.magic);
  removeRetiredTestingDefaultMagic(safeClassId, state.magic);
  G.normalizeAutoCastSpellsForClass(safeClassId);
  state.paused = character.battle?.paused === true;
  state.battle.statBuffs = sanitizeStatBuffs(character.battle?.statBuffs);
  state.battle.petStatBuffs = sanitizeStatBuffs(character.battle?.petStatBuffs);
  pendingSavedPlayerResources = {
    hp: finiteNumberOrNull(character.battle?.playerHp),
    mp: finiteNumberOrNull(character.battle?.playerMp),
    potHealthAmount: Math.max(0, Math.trunc(Number(character.battle?.potHealthAmount) || 0)),
    potManaAmount: Math.max(0, Math.trunc(Number(character.battle?.potManaAmount) || 0)),
    healAmount: Math.max(0, Math.trunc(Number(character.battle?.healAmount) || 0)),
  };
  G.syncInventoryCapacity();
  G.ensureInventorySlots();
  state.game.progress.gold = state.inventory.gold;
  G.applyEquippedVisualIndexes();
}

function captureActiveCharacterState() {
  const classId = normalizeCharacterId(state.activeCharacterId);
  state.characters[classId] = serializeCurrentCharacterState();
}

function persistCharacterGameLocation({ mode, zoneId = null, classIds = null, running = false } = {}) {
  const ids = (classIds ?? CHARACTER_IDS).map(normalizeCharacterId).filter((classId) => state.characters?.[classId]);
  for (const classId of ids) {
    const character = state.characters[classId];
    character.game.mode = mode;
    character.game.activeZoneId = zoneId;
    if (mode === "town") {
      character.game.zoneKills = 0;
      character.game.distance = 0;
      character.game.miningNextRollAt = 0;
      character.game.miningSpotId = null;
      state.game.groupDungeonRun = null;
      character.game.groupDungeonRun = null;
    } else if (mode === "mining") {
      character.game.miningSpotId = state.game.miningSpotId ?? null;
      state.game.groupDungeonRun = null;
      character.game.groupDungeonRun = null;
    } else if (mode === "zone" && G.groupDungeonZone?.(PROTOTYPE_ZONES.find((zone) => zone.id === zoneId))) {
      const entryZone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId);
      const groupRun = G.groupDungeonOfflineRunSnapshot?.() ?? {
        kind: "groupDungeon",
        zoneId,
        leaderClassId: state.activeCharacterId,
        classIds: ids,
        waveNumber: 1,
        killedThisWave: 0,
        targetThisWave: groupDungeonWaveSpawnCount(1, entryZone),
        endless: false,
      };
      state.game.groupDungeonRun = groupRun;
      character.game.groupDungeonRun = groupRun;
    } else {
      state.game.groupDungeonRun = null;
      character.game.groupDungeonRun = null;
    }
    character.battle = {
      ...character.battle,
      running: Boolean(running),
      paused: false,
    };
    if (mode === "town") {
      character.battle.statBuffs = [];
      character.battle.petStatBuffs = [];
    }
    state.characters[classId] = character;
  }
}

function serializeCurrentCharacterState() {
  return {
    classId: state.activeCharacterId,
    game: {
      mode: state.game.mode,
      activeZoneId: state.game.activeZoneId,
      kills: state.game.kills,
      zoneKills: state.game.zoneKills,
      distance: Math.floor(Number(state.game.distance) || 0),
      playtimeMs: Math.floor(totalPlaytimeMs()),
      lastReward: state.game.lastReward,
      recentLoot: state.game.recentLoot.slice(0, 6),
      dropPity: { ...state.game.dropPity },
      bossRespawns: { ...state.game.bossRespawns },
      bossKills: { ...state.game.bossKills },
      progress: {
        level: state.game.progress.level,
        experience: state.game.progress.experience,
        gold: state.inventory.gold,
      },
      starterGearVersion: STARTER_GEAR_VERSION,
      miningNextRollAt: Math.max(0, Math.trunc(Number(state.game.miningNextRollAt) || 0)),
      miningSpotId: state.game.miningSpotId ?? null,
      groupDungeonRun: state.game.groupDungeonRun ?? null,
    },
    inventory: cloneInventoryState(state.inventory),
    hotbar: cloneHotbarState(state.hotbar),
    magic: G.magicStateForPersistence(state.magic),
    battle: {
      running: state.battle.running,
      paused: state.paused,
      playerHp: state.battle.player?.hp ?? pendingSavedPlayerResources?.hp ?? null,
      playerMp: state.battle.player?.mp ?? pendingSavedPlayerResources?.mp ?? null,
      potHealthAmount: state.battle.potHealthAmount ?? pendingSavedPlayerResources?.potHealthAmount ?? 0,
      potManaAmount: state.battle.potManaAmount ?? pendingSavedPlayerResources?.potManaAmount ?? 0,
      healAmount: state.battle.healAmount ?? pendingSavedPlayerResources?.healAmount ?? 0,
      statBuffs: pruneStatBuffs(state.battle.statBuffs ?? []),
      petStatBuffs: pruneStatBuffs(state.battle.petStatBuffs ?? []),
    },
  };
}

function serializeCharactersState() {
  return Object.fromEntries(CHARACTER_IDS.map((classId) => {
    const character = state.characters[classId] ?? createDefaultCharacterState(classId);
    return [classId, {
      classId,
      game: {
        ...character.game,
        progress: { ...character.game.progress },
        starterGearVersion: Math.max(STARTER_GEAR_VERSION, Math.trunc(Number(character.game.starterGearVersion) || 0)),
        dropPity: { ...character.game.dropPity },
        bossRespawns: { ...character.game.bossRespawns },
        bossKills: { ...character.game.bossKills },
        recentLoot: [...character.game.recentLoot],
      },
      inventory: cloneInventoryState(character.inventory),
      hotbar: cloneHotbarState(character.hotbar),
      magic: G.magicStateForPersistence(character.magic),
      battle: { ...character.battle },
    }];
  }));
}

function cloneInventoryState(inventory) {
  const cloned = {
    gold: Math.max(0, Math.trunc(Number(inventory?.gold) || 0)),
    pagesUnlocked: Math.max(1, Math.min(G.inventoryPageCount(), Math.trunc(Number(inventory?.pagesUnlocked) || 1))),
    maxSlots: INVENTORY_BASE_SLOTS,
    nextInstanceId: Math.max(1, Math.trunc(Number(inventory?.nextInstanceId) || 1)),
    items: (inventory?.items ?? []).map((entry) => ({
      id: entry.id,
      itemId: entry.itemId,
      quantity: Math.max(1, Math.trunc(Number(entry.quantity) || 1)),
      slot: Number.isInteger(entry.slot) ? entry.slot : null,
      ...normalizeInventoryEntryFields(entry),
    })),
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, inventory?.equipment?.[slot.id] ?? null])),
  };
  G.syncInventoryCapacity(cloned);
  return cloned;
}

function cloneInventoryStateIncludingWeaponRefineStaged(inventory) {
  const cloned = cloneInventoryState(inventory);
  for (const staged of Object.values(state.weaponRefine?.stagedEntries ?? {})) {
    if (!staged?.entry || cloned.items.some((entry) => entry.id === staged.entry.id)) continue;
    cloned.items.push({
      id: staged.entry.id,
      itemId: staged.entry.itemId,
      quantity: Math.max(1, Math.trunc(Number(staged.entry.quantity) || 1)),
      slot: Number.isInteger(staged.returnSlot) ? staged.returnSlot : (
        Number.isInteger(staged.entry.slot) ? staged.entry.slot : null
      ),
      ...normalizeInventoryEntryFields(staged.entry),
    });
  }
  G.syncInventoryCapacity(cloned);
  return cloned;
}

function cloneStorageState(storage) {
  const cloned = {
    pagesUnlocked: Math.max(1, Math.min(G.storagePageCount(), Math.trunc(Number(storage?.pagesUnlocked) || 1))),
    page2Purchased: Boolean(storage?.page2Purchased),
    maxSlots: STORAGE_BASE_SLOTS,
    nextInstanceId: Math.max(1, Math.trunc(Number(storage?.nextInstanceId) || 1)),
    items: (storage?.items ?? []).map((entry) => ({
      id: entry.id,
      itemId: entry.itemId,
      quantity: Math.max(1, Math.trunc(Number(entry.quantity) || 1)),
      slot: Number.isInteger(entry.slot) ? entry.slot : null,
      ...normalizeInventoryEntryFields(entry),
    })),
  };
  if (cloned.pagesUnlocked >= 2 && !cloned.page2Purchased) {
    for (const entry of cloned.items) {
      if (Number.isInteger(entry.slot) && entry.slot >= STORAGE_PAGE_SIZE) {
        entry.slot = null;
      }
    }
    cloned.pagesUnlocked = 1;
  }
  G.syncStorageCapacity(cloned);
  G.ensureStorageSlots(cloned);
  return cloned;
}

function cloneHotbarState(hotbar) {
  return {
    slots: Array.from({ length: HOTBAR_SLOT_COUNT }, (_, slot) => hotbar?.slots?.[slot] ?? null),
  };
}

function cloneMagicState(magic) {
  return {
    learned: Object.fromEntries(
      Object.entries(magic?.learned ?? {}).map(([spellId, learned]) => [
        spellId,
        {
          spellId: learned.spellId ?? spellId,
          level: Math.max(0, Math.min(3, Math.trunc(Number(learned.level) || 0))),
          experience: Math.max(0, Math.trunc(Number(learned.experience) || 0)),
          key: learned.key ?? null,
          autoCast: Boolean(learned.autoCast),
          castReadyAt: Math.max(0, Number(learned.castReadyAt) || 0),
          learnedAt: Number(learned.learnedAt) || 0,
        },
      ]),
    ),
  };
}

function removeRetiredTestingDefaultMagic(classId, magic) {
  if (classId !== "Wizard") return magic;
  if (!magic.learned || typeof magic.learned !== "object") magic.learned = {};
  for (const spellId of RETIRED_TEST_DEFAULT_WIZARD_SPELLS) {
    const learned = magic.learned[spellId];
    if (learned && !learned.learnedAt) delete magic.learned[spellId];
  }
  return magic;
}

function restoreInventoryState(snapshot) {
  const savedInventory = snapshot.inventory ?? {};
  const savedItems = Array.isArray(savedInventory.items) ? savedInventory.items : [];
  const usedIds = new Set();
  let maxGeneratedId = 0;
  const items = [];

  for (const savedEntry of savedItems) {
    if (!savedEntry?.itemId) continue;
    const id = typeof savedEntry.id === "string" && savedEntry.id ? savedEntry.id : "";
    if (!id || usedIds.has(id)) continue;
    usedIds.add(id);
    const generatedId = /^item-(\d+)$/.exec(id)?.[1];
    if (generatedId) maxGeneratedId = Math.max(maxGeneratedId, Number(generatedId));
    items.push({
      id,
      itemId: savedEntry.itemId,
      quantity: Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1)),
      slot: Number.isInteger(savedEntry.slot) ? savedEntry.slot : null,
      ...normalizeInventoryEntryFields(savedEntry),
    });
  }

  const savedEquippedIds = new Set(Object.values(savedInventory.equipment ?? {}).filter(Boolean));
  const savedHotbarIds = new Set((snapshot.hotbar?.slots ?? []).filter(Boolean));
  const savedBagItems = items.filter((entry) => !savedEquippedIds.has(entry.id) && !savedHotbarIds.has(entry.id));
  const needsSecondPage = savedBagItems.length > INVENTORY_PAGE_SIZE
    || savedBagItems.some((entry) => Number.isInteger(entry.slot) && entry.slot >= INVENTORY_PAGE_SIZE);
  const savedPagesUnlocked = Math.max(1, Math.min(G.inventoryPageCount(), Math.trunc(Number(savedInventory.pagesUnlocked) || 1)));
  state.inventory.gold = Math.max(0, Math.trunc(Number(savedInventory.gold ?? snapshot.game?.progress?.gold ?? 0) || 0));
  state.inventory.pagesUnlocked = Math.max(savedPagesUnlocked, needsSecondPage ? 2 : 1);
  G.syncInventoryCapacity();
  state.inventory.items = items;
  state.inventory.nextInstanceId = Math.max(
    maxGeneratedId + 1,
    Math.trunc(Number(savedInventory.nextInstanceId) || 1),
    1,
  );
  state.inventory.equipment = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, null]));

  const availableEntryIds = new Set(items.map((entry) => entry.id));
  const equippedIds = new Set();
  for (const slot of EQUIPMENT_SLOTS) {
    const entryId = savedInventory.equipment?.[slot.id] ?? null;
    if (!availableEntryIds.has(entryId) || equippedIds.has(entryId)) continue;
    state.inventory.equipment[slot.id] = entryId;
    equippedIds.add(entryId);
  }
}

function restoreGameProgress(snapshot) {
  const savedGame = snapshot.game ?? {};
  const zoneExists = PROTOTYPE_ZONES.some((zone) => zone.id === savedGame.activeZoneId);
  const miningMode = savedGame.mode === "mining" && savedGame.activeZoneId === MINING_ZONE_ID;
  state.game.mode = miningMode ? "mining" : savedGame.mode === "zone" && zoneExists ? "zone" : "town";
  state.game.activeZoneId = state.game.mode === "town" ? null : savedGame.activeZoneId;
  state.game.miningNextRollAt = Math.max(0, Math.trunc(Number(savedGame.miningNextRollAt) || 0));
  state.game.miningSpotId = G.miningSpotById(savedGame.miningSpotId)?.id ?? null;
  state.game.kills = Math.max(0, Math.trunc(Number(savedGame.kills) || 0));
  state.game.zoneKills = Math.max(0, Math.trunc(Number(savedGame.zoneKills) || 0));
  state.game.distance = Math.max(0, Math.trunc(Number(savedGame.distance) || 0));
  state.game.playtimeMs = Math.max(0, Math.trunc(Number(savedGame.playtimeMs) || 0));
  sessionStartedAt = performance.now();
  state.game.lastReward = savedGame.lastReward && typeof savedGame.lastReward === "object" ? savedGame.lastReward : null;
  state.game.recentLoot = Array.isArray(savedGame.recentLoot) ? savedGame.recentLoot.map(String).slice(0, 6) : [];
  state.game.lootToasts = [];
  state.game.dropPity = sanitizeDropPity(savedGame.dropPity);
  state.game.bossRespawns = sanitizeBossRespawns(savedGame.bossRespawns);
  state.game.bossKills = sanitizeBossKills(savedGame.bossKills);
  state.game.selectedTownNpcId = null;
  state.game.hoveredTownNpcId = null;

  state.game.progress.level = Math.max(1, Math.trunc(Number(savedGame.progress?.level) || PLAYER_TEMPLATE.level));
  state.game.progress.experience = Math.max(0, Math.trunc(Number(savedGame.progress?.experience) || 0));
  normalizeSavedProgress();
  state.game.progress.gold = state.inventory.gold;
}

function restoreMagicState(snapshot) {
  const learned = snapshot.magic?.learned ?? {};
  state.magic.learned = {};
  for (const [spellId, savedSpell] of Object.entries(learned)) {
    const spell = G.magicSpellById(spellId);
    if (!spell) continue;
    state.magic.learned[spellId] = {
      spellId,
      level: Math.max(0, Math.min(3, Math.trunc(Number(savedSpell.level) || 0))),
      experience: Math.max(0, Math.trunc(Number(savedSpell.experience) || 0)),
      key: savedSpell.key ?? null,
      autoCast: Boolean(savedSpell.autoCast),
      castReadyAt: 0,
      learnedAt: Number(savedSpell.learnedAt) || 0,
    };
  }
}

function restoreHotbarState(snapshot) {
  const availableEntryIds = new Set(state.inventory.items.map((entry) => entry.id));
  const equippedIds = new Set(Object.values(state.inventory.equipment).filter(Boolean));
  state.hotbar.slots = Array.from({ length: HOTBAR_SLOT_COUNT }, (_, slot) => {
    const entryId = snapshot.hotbar?.slots?.[slot] ?? null;
    return availableEntryIds.has(entryId) && !equippedIds.has(entryId) ? entryId : null;
  });
  G.ensureInventorySlots();
}

function restoreSettingsState(snapshot) {
  const savedSettings = snapshot.settings ?? {};
  const hasCurrentMusicSettings = Number(savedSettings.musicSettingsVersion) >= MUSIC_SETTINGS_VERSION;
  state.settings.musicEnabled = hasCurrentMusicSettings && Object.prototype.hasOwnProperty.call(savedSettings, "musicEnabled")
    ? savedSettings.musicEnabled === true
    : DEFAULT_MUSIC_ENABLED;
  state.settings.musicVolume = G.normalizedVolume(savedSettings.musicVolume ?? DEFAULT_MUSIC_VOLUME);
  state.settings.musicMode = G.normalizedMusicMode(savedSettings.musicMode);
  state.settings.sfxEnabled = Object.prototype.hasOwnProperty.call(savedSettings, "sfxEnabled")
    ? savedSettings.sfxEnabled === true
    : DEFAULT_SFX_ENABLED;
  state.settings.sfxVolume = G.normalizedVolume(savedSettings.sfxVolume ?? DEFAULT_SFX_VOLUME);
  state.settings.prototypeStatsEnabled = Object.prototype.hasOwnProperty.call(savedSettings, "prototypeStatsEnabled")
    ? savedSettings.prototypeStatsEnabled === true
    : DEFAULT_PROTOTYPE_STATS_ENABLED;
  state.settings.prototypeStatsNoticeVersion = Math.max(0, Math.trunc(Number(savedSettings.prototypeStatsNoticeVersion) || 0));
  state.settings.prototypeResetNoticeVersion = Math.max(0, Math.trunc(Number(savedSettings.prototypeResetNoticeVersion) || 0));
  state.settings.prototypeResetNoticeLastSeenAt = Math.max(0, Math.trunc(Number(savedSettings.prototypeResetNoticeLastSeenAt) || 0));
  const savedTrackIndex = BACKGROUND_MUSIC_TRACKS.findIndex((track) => track.id === savedSettings.musicTrackId);
  musicTrackIndex = savedTrackIndex >= 0 ? savedTrackIndex : 0;
}

function restoreEquipmentVisualIndexes(snapshot) {
  state.indexes.armour = 0;
  state.indexes.hair = Number.isInteger(snapshot.indexes?.hair) ? snapshot.indexes.hair : 0;
  state.indexes.weapon = null;
  G.applyEquippedVisualIndexes();
}

function restorePendingSavedPlayerResources() {
  if (!pendingSavedPlayerResources || !state.battle.player) return;
  if (pendingSavedPlayerResources.hp != null) {
    state.battle.player.hp = Math.max(0, Math.min(state.battle.player.maxHp, Math.trunc(pendingSavedPlayerResources.hp)));
  }
  if (pendingSavedPlayerResources.mp != null) {
    state.battle.player.mp = Math.max(0, Math.min(state.battle.player.maxMp, Math.trunc(pendingSavedPlayerResources.mp)));
  }
  state.battle.potHealthAmount = Math.max(0, Math.trunc(Number(pendingSavedPlayerResources.potHealthAmount) || 0));
  state.battle.potManaAmount = Math.max(0, Math.trunc(Number(pendingSavedPlayerResources.potManaAmount) || 0));
  state.battle.potTickAt = state.battle.potHealthAmount > 0 || state.battle.potManaAmount > 0
    ? performance.now() + CRYSTAL_POT_DELAY_MS
    : 0;
  state.battle.healAmount = Math.max(0, Math.trunc(Number(pendingSavedPlayerResources.healAmount) || 0));
  state.battle.healTickAt = state.battle.healAmount > 0
    ? performance.now() + CRYSTAL_HEAL_DELAY_MS
    : 0;
  pendingSavedPlayerResources = null;
}

function normalizeSavedProgress() {
  let nextLevelXp = G.xpForNextLevel(state.game.progress.level);
  while (Number.isFinite(nextLevelXp) && state.game.progress.experience >= nextLevelXp) {
    state.game.progress.experience -= nextLevelXp;
    state.game.progress.level += 1;
    nextLevelXp = G.xpForNextLevel(state.game.progress.level);
  }
}

function sanitizeDropPity(savedPity) {
  if (!savedPity || typeof savedPity !== "object") return {};
  return Object.fromEntries(
    PROTOTYPE_ZONES.map((zone) => [
      zone.id,
      Math.max(0, Math.min(DROP_PITY_KILLS, Math.trunc(Number(savedPity[zone.id]) || 0))),
    ]),
  );
}

function sanitizeItemBonusStats(stats) {
  const bonusStats = {};
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    const value = Array.isArray(stats?.[key]) ? stats[key] : [0, 0];
    bonusStats[key] = [
      Math.trunc(Number(value[0]) || 0),
      Math.trunc(Number(value[1]) || 0),
    ];
  }
  for (const key of ["hp", "mp", "accuracy", "agility", "luck", "attackSpeed"]) {
    bonusStats[key] = Math.trunc(Number(stats?.[key]) || 0);
  }
  for (const key of ["poisonAttack", "freezing", "magicResist", "poisonResist", "healthRecovery", "poisonRecovery", "strong"]) {
    bonusStats[key] = Math.trunc(Number(stats?.[key]) || 0);
  }
  return bonusStats;
}

function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function totalPlaytimeMs() {
  return Math.max(0, Math.trunc(Number(state.game.playtimeMs) || 0)) + Math.max(0, performance.now() - sessionStartedAt);
}

function maybeAutoSave(now) {
  if (!saveReady || now - lastSaveAt < SAVE_INTERVAL_MS) return;
  saveGameState();
}

async function resetSavedGame() {
  if (!window.confirm("Reset your saved LOM Idle V2 prototype progress?")) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn("Unable to clear game save", err);
  }

  saveReady = false;
  resetRuntimeGameState();
  G.resetBattle();
  await G.reloadAtlases();
  await G.reloadEnemyAtlas();
  saveReady = true;
  saveGameState(true);
  G.invalidateUi();
  G.renderLayerControls();
  G.renderMapControls();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderSceneOverlay();
  G.renderOfflineReport();
  G.renderCombatSkillBar();
  G.renderHotbar();
  G.render();
}

function resetRuntimeGameState() {
  G.stopOneStepTest();
  state.continuousWalk = false;
  state.showEnemies = false;
  state.action = "standing";
  state.frame = 0;
  state.playerOneShot = false;
  state.paused = false;
  state.inventoryPage = 0;
  state.storagePage = 0;
  state.pendingStoragePageUnlock = null;
  state.characters = createDefaultCharacterStates();
  state.account.storage = createDefaultStorageState();
  state.account.upgrades = G.createDefaultAccountUpgradeState();
  state.account.rebirthPoints = 0;
  state.account.bossRespawns = {};
  state.account.stats = G.createDefaultAccountStats();
  state.activeCharacterId = "Warrior";
  state.game = {
    mode: "town",
    activeZoneId: null,
    kills: 0,
    zoneKills: 0,
    distance: 0,
    playtimeMs: 0,
    lastReward: null,
    recentLoot: [],
    lootToasts: [],
    dropPity: {},
    bossRespawns: {},
    bossKills: {},
    selectedTownNpcId: null,
    hoveredTownNpcId: null,
    offlineReport: null,
    miningNextRollAt: 0,
    miningSpotId: null,
    groupDungeonRun: null,
    progress: {
      level: PLAYER_TEMPLATE.level,
      experience: PLAYER_TEMPLATE.experience,
      gold: PLAYER_TEMPLATE.gold,
    },
  };
  sessionStartedAt = performance.now();
  applyCharacterState("Warrior", state.characters.Warrior);
  state.settings.musicEnabled = DEFAULT_MUSIC_ENABLED;
  state.settings.musicVolume = DEFAULT_MUSIC_VOLUME;
  state.settings.musicMode = MUSIC_MODE_PLAYLIST;
  state.settings.sfxEnabled = DEFAULT_SFX_ENABLED;
  state.settings.sfxVolume = DEFAULT_SFX_VOLUME;
  state.settings.prototypeStatsEnabled = DEFAULT_PROTOTYPE_STATS_ENABLED;
  state.settings.prototypeStatsNoticeVersion = 0;
  state.settings.prototypeResetNoticeVersion = 0;
  state.settings.prototypeResetNoticeLastSeenAt = 0;
  musicTrackIndex = 0;
  G.syncBackgroundMusic();
  state.battle.combatClass = "Warrior";
  state.battle.warriorSkill = "None";
  state.battle.wizardSpell = "FireBall";
  state.indexes = { armour: 0, hair: 0, weapon: null };
  state.characterTab = "character";
  state.activeScene = null;
  state.bossEntryZoneId = null;
  state.bossAssistSelection = [];
  state.bossEmpowerSelected = false;
  state.pendingBossAssistSelection = [];
  state.openScenes = G.initialOpenScenesFromUrl();
  pendingSavedPlayerResources = null;
}

function restoreAllWeaponRefineStagedEntries() {
  G.clearWeaponRefineResultFxTimer();
  state.weaponRefine.resultFx = null;
  const stagedIds = Object.keys(state.weaponRefine?.stagedEntries ?? {});
  for (const entryId of stagedIds) {
    G.unstageWeaponRefineEntry(entryId);
  }
  state.weaponRefine.weaponEntryId = null;
  state.weaponRefine.oreEntryIds = Array(WEAPON_REFINE_ORE_SLOTS).fill(null);
  state.weaponRefine.materialEntryIds = Array(WEAPON_REFINE_MATERIAL_SLOTS).fill(null);
}

function sanitizeWeaponRefineLevel(value) {
  return Math.max(0, Math.min(WEAPON_REFINE_MAX, Math.trunc(Number(value) || 0)));
}

function sanitizeEntryDurability(savedEntry, item) {
  if (!G.itemUsesEntryDurability(item)) return null;
  const maxDura = Math.max(1, Math.trunc(Number(savedEntry?.maxDura) || G.itemDefinitionMaxDura(item)));
  let currentDura = Math.trunc(Number(savedEntry?.currentDura));
  if (!Number.isFinite(currentDura)) currentDura = maxDura;
  currentDura = Math.max(0, Math.min(maxDura, currentDura));
  return { maxDura, currentDura };
}

function restoreSceneScrollPositions(positions) {
  const source = positions?.size ? positions : sceneScrollPositions;
  if (!source?.size) return;
  for (const element of els.sceneOverlay.querySelectorAll("[data-preserve-scroll]")) {
    const key = element.dataset.preserveScroll;
    const position = source.get(key);
    if (!key || !position) continue;
    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    element.scrollTop = Math.min(position.top, maxTop);
    element.scrollLeft = Math.min(position.left, maxLeft);
  }
}

function accountBossRespawns() {
  return sanitizeBossRespawns(state.account?.bossRespawns ?? {});
}

function migrateAccountBossRespawns() {
  const merged = { ...accountBossRespawns() };
  for (const classId of CHARACTER_IDS) {
    const respawns = sanitizeBossRespawns(state.characters[classId]?.game?.bossRespawns);
    for (const [zoneId, readyAt] of Object.entries(respawns)) {
      if (readyAt > (merged[zoneId] ?? 0)) merged[zoneId] = readyAt;
    }
  }
  state.account.bossRespawns = merged;
  syncAccountBossRespawnsToCharacters();
}

function syncAccountBossRespawnsToCharacters() {
  const respawns = accountBossRespawns();
  state.game.bossRespawns = { ...respawns };
  for (const classId of CHARACTER_IDS) {
    const character = state.characters[classId];
    if (!character) continue;
    character.game.bossRespawns = { ...respawns };
  }
}

async function loadCatalogue(spriteSet) {
  return loadJson(`./public/sprite-sets/${spriteSet}/layers.json`).catch(() => ({
    direction: 2,
    actions: Object.keys(PLAYER_ACTIONS),
    layers: {
      armour: { count: 1, indexes: [0] },
      hair: { count: 1, indexes: [0] },
      weapon: { count: 1, indexes: [0] },
    },
  }));
}

function restoreBattlePlayerResources() {
  if (!state.battle.player) return;
  const stats = G.characterTotalStats();
  state.battle.player.level = state.game.progress.level;
  state.battle.player.experience = state.game.progress.experience;
  state.battle.player.maxHp = stats.maxHp;
  state.battle.player.maxMp = stats.maxMp;
  state.battle.player.hp = stats.maxHp;
  state.battle.player.mp = stats.maxMp;
}

function cloneDecorations(decorations = []) {
  return decorations.map((decoration) => ({
    ...decoration,
    slots: Array.isArray(decoration.slots) ? [...decoration.slots] : [],
    frames: Array.isArray(decoration.frames) ? [...decoration.frames] : [],
    groups: Array.isArray(decoration.groups) ? [...decoration.groups] : [],
    rows: Array.isArray(decoration.rows) ? [...decoration.rows] : decoration.rows,
  }));
}


G.createDefaultWeaponRefineState = createDefaultWeaponRefineState;
G.createSaveSnapshot = createSaveSnapshot;
G.saveGameState = saveGameState;
G.parseSaveSnapshotText = parseSaveSnapshotText;
G.saveImportBlockedReason = saveImportBlockedReason;
G.exportSaveDownloadName = exportSaveDownloadName;
G.exportGameSave = exportGameSave;
G.clearTransientBattleForSaveImport = clearTransientBattleForSaveImport;
G.importGameSaveFromText = importGameSaveFromText;
G.loadSavedGameState = loadSavedGameState;
G.applySaveSnapshot = applySaveSnapshot;
G.normalizeCharacterId = normalizeCharacterId;
G.createDefaultCharacterStates = createDefaultCharacterStates;
G.createDefaultStorageState = createDefaultStorageState;
G.createDefaultCharacterState = createDefaultCharacterState;
G.restoreCharactersState = restoreCharactersState;
G.legacyCharacterStateFromSnapshot = legacyCharacterStateFromSnapshot;
G.sanitizeCharacterState = sanitizeCharacterState;
G.backfillStarterGear = backfillStarterGear;
G.backfillInventoryItem = backfillInventoryItem;
G.sanitizeCharacterGameState = sanitizeCharacterGameState;
G.sanitizeBossRespawns = sanitizeBossRespawns;
G.sanitizeAccountStats = sanitizeAccountStats;
G.ensureAccountStats = ensureAccountStats;
G.accountBossKills = accountBossKills;
G.syncAccountBossKillsToCharacters = syncAccountBossKillsToCharacters;
G.migrateAccountStats = migrateAccountStats;
G.trackRebirthPointsGained = trackRebirthPointsGained;
G.trackRebirthPointsSpent = trackRebirthPointsSpent;
G.accountTotalGold = accountTotalGold;
G.accountStatsSnapshot = accountStatsSnapshot;
G.sanitizeBossKills = sanitizeBossKills;
G.sanitizeInventoryState = sanitizeInventoryState;
G.sanitizeStorageState = sanitizeStorageState;
G.sanitizeAccountUpgradeState = sanitizeAccountUpgradeState;
G.awakeningSoulQuantityInInventory = awakeningSoulQuantityInInventory;
G.accountAwakenedSoulCount = accountAwakenedSoulCount;
G.canPerformRebirth = canPerformRebirth;
G.deductItemQuantityFromInventoryState = deductItemQuantityFromInventoryState;
G.deductItemQuantityFromStorage = deductItemQuantityFromStorage;
G.createStorageEntry = createStorageEntry;
G.addItemQuantityToStorage = addItemQuantityToStorage;
G.accountRebirthPoints = accountRebirthPoints;
G.payRebirthPoints = payRebirthPoints;
G.resetCharacterProgressForRebirth = resetCharacterProgressForRebirth;
G.awakeningSoulQuantityInStorage = awakeningSoulQuantityInStorage;
G.resetAccountStorageForRebirth = resetAccountStorageForRebirth;
G.resetNonRebirthAccountUpgrades = resetNonRebirthAccountUpgrades;
G.performAccountRebirth = performAccountRebirth;
G.sanitizeHotbarState = sanitizeHotbarState;
G.sanitizeMagicState = sanitizeMagicState;
G.sanitizeCharacterBattleState = sanitizeCharacterBattleState;
G.applyCharacterState = applyCharacterState;
G.captureActiveCharacterState = captureActiveCharacterState;
G.persistCharacterGameLocation = persistCharacterGameLocation;
G.serializeCurrentCharacterState = serializeCurrentCharacterState;
G.serializeCharactersState = serializeCharactersState;
G.cloneInventoryState = cloneInventoryState;
G.cloneInventoryStateIncludingWeaponRefineStaged = cloneInventoryStateIncludingWeaponRefineStaged;
G.cloneStorageState = cloneStorageState;
G.cloneHotbarState = cloneHotbarState;
G.cloneMagicState = cloneMagicState;
G.removeRetiredTestingDefaultMagic = removeRetiredTestingDefaultMagic;
G.restoreInventoryState = restoreInventoryState;
G.restoreGameProgress = restoreGameProgress;
G.restoreMagicState = restoreMagicState;
G.restoreHotbarState = restoreHotbarState;
G.restoreSettingsState = restoreSettingsState;
G.restoreEquipmentVisualIndexes = restoreEquipmentVisualIndexes;
G.restorePendingSavedPlayerResources = restorePendingSavedPlayerResources;
G.normalizeSavedProgress = normalizeSavedProgress;
G.sanitizeDropPity = sanitizeDropPity;
G.sanitizeItemBonusStats = sanitizeItemBonusStats;
G.finiteNumberOrNull = finiteNumberOrNull;
G.totalPlaytimeMs = totalPlaytimeMs;
G.maybeAutoSave = maybeAutoSave;
G.resetSavedGame = resetSavedGame;
G.resetRuntimeGameState = resetRuntimeGameState;
G.restoreAllWeaponRefineStagedEntries = restoreAllWeaponRefineStagedEntries;
G.sanitizeWeaponRefineLevel = sanitizeWeaponRefineLevel;
G.sanitizeEntryDurability = sanitizeEntryDurability;
G.restoreSceneScrollPositions = restoreSceneScrollPositions;
G.accountBossRespawns = accountBossRespawns;
G.migrateAccountBossRespawns = migrateAccountBossRespawns;
G.syncAccountBossRespawnsToCharacters = syncAccountBossRespawnsToCharacters;
G.loadCatalogue = loadCatalogue;
G.restoreBattlePlayerResources = restoreBattlePlayerResources;
G.cloneDecorations = cloneDecorations;












