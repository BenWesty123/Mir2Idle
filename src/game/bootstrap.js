import { ACTION_GROUPS, PLAYER_ACTIONS, sourceFrameFor } from "../playerActions.js";
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
} from "../battleData.js";
import { SPELL_GROUPS, bodyActionForSpell, spellLabel } from "../spellBodyActions.js";
import { loadAtlas, loadJson, missingActions, sheetUrl } from "../atlas.js";
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
} from "../warriorMagic.js";
import { MINING_SPOTS, PHASE1_ZONES } from "../phase1Data.js";
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
} from "../groupDungeonSwarm.js";
import {
  BUFF_POTION_DURATION_MS,
  applyStatBuffsToStats,
  buffPotionDefForItem,
  formatBuffRemaining,
  isBuffPotionItem,
  pruneStatBuffs,
  sanitizeStatBuffs,
  statBuffBonusLabel,
} from "../buffPotions.js";

import { lastSimulationAt, saveReady } from "./sharedState.js";
import { G } from "./gameApi.js";
import { state, els, initGameState } from "./runtime.js";

async function init() {
  state.catalogue = await G.loadCatalogue(state.spriteSet);
  state.enemy.catalogue = await loadJson("./public/monsters/layers.json").catch(() => null);
  state.spellIndex = await loadJson("./public/spellfx/index.json").catch(() => ({ spells: [] }));
  state.itemData = await loadJson("./src/data/items.json").catch(() => ({ items: [] }));
  state.mapTileIndex = await loadJson("./public/maptiles/index.json").catch(() => ({ sets: [] }));
  state.mapObjectIndex = await loadJson("./public/mapobjects/index.json").catch(() => ({ sets: [] }));
  state.mapStampIndex = await loadJson(`./public/mapstamps/index.json?v=${MAP_STAMP_ASSET_VERSION}`).catch(() => ({ stamps: [] }));
  state.sfxManifest = await loadJson("./public/audio/sfx/manifest.json").catch(() => ({ byKey: {}, groups: [] }));
  state.prototypeStats.playerId = G.loadPrototypeStatsPlayerId();
  await G.loadPrototypeStatsConfig();
  state.mapSet = state.mapTileIndex.sets.find((set) => set.id === state.mapSet)?.id ?? state.mapTileIndex.sets[0]?.id ?? state.mapSet;
  state.warriorSkillAtlases = await loadWarriorSkillAtlases();
  state.wizardSpellAtlases = await loadCombatSpellAtlases(WIZARD_COMBAT_SPELLS);
  state.taoistSpellAtlases = await loadCombatSpellAtlases(TAOIST_COMBAT_SPELLS);
  state.taoistDefenceBuffImpactAtlases = Object.fromEntries(
    (await Promise.all(
      Object.entries(TAOIST_DEFENCE_BUFF_IMPACT_FX).map(async ([spellId, fxId]) => [
        spellId,
        await loadJson(`./public/spellfx/${fxId}/atlas.json`).catch(() => null),
      ]),
    )).filter(([, atlas]) => atlas),
  );
  state.taoPetAtlases = Object.fromEntries(
    await Promise.all(
      [
        CRYSTAL_SUMMON_SKELETON_PET_INDEX,
        CRYSTAL_SUMMON_SHINSU_PET_INDEX,
        CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX,
      ].map(async (index) => [
        index,
        await loadJson(`./public/monsters/monster/${index}.json`).catch(() => null),
      ]),
    ),
  );
  state.taoPetAtlas = state.taoPetAtlases[CRYSTAL_SUMMON_SKELETON_PET_INDEX] ?? null;
  state.levelUpAtlas = await loadJson(`./public/spellfx/${LEVEL_UP_FX_ID}/atlas.json`).catch(() => null);
  state.healingRestoreAtlas = await loadJson(`./public/spellfx/${HEALING_RESTORE_FX_ID}/atlas.json`).catch(() => null);
  state.mapLightningAtlas = await loadJson(`./public/spellfx/${MAP_LIGHTNING_FX_ID}/atlas.json`).catch(() => null);
  if (state.mapLightningAtlas) await preloadSpellAtlasSheets(MAP_LIGHTNING_FX_ID, state.mapLightningAtlas);
  state.townNpcAtlases = await loadTownNpcAtlases();
  state.characterStateItems = {
    ...CHARACTER_PAPER_DOLL_FRAMES,
    ...(await loadJson("./public/ui/character/stateitems.json").catch(() => ({}))),
  };
  const loadedSave = G.loadSavedGameState();
  if (!loadedSave) {
    state.characters = G.createDefaultCharacterStates();
    G.applyCharacterState("Warrior", state.characters.Warrior);
  }
  G.resetBattleForCurrentMode(loadedSave);
  G.applyPendingOfflineProgress();

  G.renderLayerControls();
  G.renderEnemyControls();
  G.renderSpellControls();
  G.renderMapControls();
  G.renderGamePanel();
  G.renderSceneOverlay();
  G.renderOfflineReport();
  G.renderPrototypeStatsNotice();
  G.renderCombatSkillBar();
  G.renderZoneEditor();
  G.renderActionControls();
  G.bindControls();
  G.syncBackgroundMusic();
  await G.reloadAtlases();
  await G.reloadEnemyAtlas();
  saveReady = true;
  G.saveGameState(true);
  lastSimulationAt = performance.now();
  requestAnimationFrame(G.tick);
}

async function preloadSpellAtlasSheets(spellId, atlas) {
  if (!atlas?.layers?.length) return;
  const sheets = [...new Set(atlas.layers.map((layer) => layer.sheet).filter(Boolean))];
  await Promise.all(
    sheets.map((sheet) => G.loadCachedImage(`./public/spellfx/${spellId}/${sheet}`).catch(() => null)),
  );
}

async function loadWarriorSkillAtlases() {
  const entries = await Promise.all(
    WARRIOR_COMBAT_SKILLS.filter((skill) => skill.id !== "None").map(async (skill) => [
      skill.id,
      await loadJson(`./public/spellfx/${skill.id}/atlas.json`).catch(() => null),
    ]),
  );
  const atlases = Object.fromEntries(entries.filter(([, atlas]) => atlas));
  await Promise.all(Object.entries(atlases).map(([spellId, atlas]) => preloadSpellAtlasSheets(spellId, atlas)));
  return atlases;
}

async function loadCombatSpellAtlases(spells) {
  const entries = await Promise.all(
    spells.map(async (spell) => [
      spell.id,
      await loadJson(`./public/spellfx/${spell.id}/atlas.json`).catch(() => null),
    ]),
  );
  return Object.fromEntries(entries.filter(([, atlas]) => atlas));
}

async function loadTownNpcAtlases() {
  const sprites = [...new Set(TOWN_NPCS.map((npc) => npc.sprite).filter(Boolean))];
  const entries = await Promise.all(
    sprites.map(async (sprite) => [
      sprite,
      await loadJson(`./public/npcs/${sprite}/atlas.json`).catch(() => null),
    ]),
  );
  return Object.fromEntries(entries.filter(([, atlas]) => atlas));
}


G.init = init;
G.preloadSpellAtlasSheets = preloadSpellAtlasSheets;
G.loadWarriorSkillAtlases = loadWarriorSkillAtlases;
G.loadCombatSpellAtlases = loadCombatSpellAtlases;
G.loadTownNpcAtlases = loadTownNpcAtlases;

export async function boot() {
  initGameState();
  await G.init();
}
