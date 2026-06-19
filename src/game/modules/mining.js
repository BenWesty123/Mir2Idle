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

import { battlePanelSignature, gamePanelSignature, sceneSignature, hotbarSignature } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function rollMiningOreItemId() {
  const slot = 1 + Math.floor(Math.random() * MINING_TOTAL_SLOTS);
  for (const drop of MINING_ORE_DROPS) {
    if (slot >= drop.minSlot && slot <= drop.maxSlot) return drop.itemId;
  }
  return "silver-ore";
}

function rollMiningOrePurity() {
  return 1 + Math.floor(Math.random() * 10);
}

function tryAddMiningOre(itemId, purity) {
  G.syncInventoryCapacity();
  G.ensureInventorySlots();
  if (G.inventoryUsedSlots() >= state.inventory.maxSlots) {
    const item = G.itemDefinition(itemId);
    G.addLootNotice(`Inventory full: ${item?.name ?? itemId}`, "full");
    return false;
  }
  state.inventory.items.push(G.createOreInventoryEntry(itemId, purity));
  G.syncBossPartyControlledInventoryFromState();
  gamePanelSignature = "";
  sceneSignature = "";
  hotbarSignature = "";
  return true;
}

function updateMining(now) {
  if (state.game.mode !== "mining" || state.paused) return false;
  G.updateBattleRestState(now);
  return false;
}

function rollMiningOreOnSwing() {
  if (state.game.mode !== "mining") return;
  G.playMiningHitSfx();
  if (Math.random() >= MINING_HIT_CHANCE) {
    G.pushBattleLog("Swing... nothing.");
    return;
  }
  const itemId = rollMiningOreItemId();
  const purity = rollMiningOrePurity();
  const item = G.itemDefinition(itemId);
  if (!tryAddMiningOre(itemId, purity)) {
    G.pushBattleLog("Inventory full.");
    return;
  }
  const label = item ? `${item.name} (Purity ${purity})` : itemId;
  G.pushBattleLog(`Mined ${label}.`);
  G.pushRecentLoot(label);
  G.addLootNotice(`Mined ${item?.name ?? itemId}`, "item");
}

function miningSpotById(spotId) {
  const id = String(spotId ?? "").trim();
  return MINING_SPOTS.find((spot) => spot.id === id) ?? null;
}

function pickRandomMiningSpot() {
  const spot = MINING_SPOTS[Math.floor(Math.random() * MINING_SPOTS.length)];
  state.game.miningSpotId = spot.id;
  return spot;
}

function activeMiningSpot() {
  if (state.game.mode !== "mining") return null;
  return miningSpotById(state.game.miningSpotId) ?? pickRandomMiningSpot();
}

function ensureMiningSpotId(forcePick = false) {
  if (state.game.mode !== "mining") return null;
  if (!forcePick && miningSpotById(state.game.miningSpotId)) {
    return miningSpotById(state.game.miningSpotId);
  }
  return pickRandomMiningSpot();
}

function enterMiningFromRefiner() {
  if (G.bossPartyOnField()) return;
  G.captureActiveCharacterState();
  G.closeScene(false);
  G.stopOneStepTest();
  state.continuousWalk = false;
  state.zoneBuilderPreviewZoneId = null;
  state.showEnemies = true;
  state.game.mode = "mining";
  state.game.activeZoneId = MINING_ZONE_ID;
  state.game.zoneKills = 0;
  state.game.distance = 0;
  state.game.selectedTownNpcId = null;
  const spot = pickRandomMiningSpot();
  G.resetBattle();
  G.ensureMapStampArenaLock();
  state.battle.cameraX = state.battle.playerX - G.playerScreenX();
  state.battle.enemy = null;
  state.battle.running = false;
  state.battle.phase = "idle";
  state.battle.returnToStandAt = 0;
  G.restorePendingSavedPlayerResources();
  state.battle.log = [`Mining at ${spot?.label ?? G.activeZone()?.label ?? "the mines"}.`];
  G.applyEquippedVisualIndexes();
  G.queueVisualAtlasReload(["weapon"]);
  G.setPlayerAction("mine", performance.now(), true);
  G.playSfx("ui.teleport", { volume: 0.55, throttleMs: 300 });
  G.persistCharacterGameLocation({ mode: "mining", zoneId: MINING_ZONE_ID, classIds: CHARACTER_IDS, running: false });
  G.renderMapControls();
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.render();
}


G.rollMiningOreItemId = rollMiningOreItemId;
G.rollMiningOrePurity = rollMiningOrePurity;
G.tryAddMiningOre = tryAddMiningOre;
G.updateMining = updateMining;
G.rollMiningOreOnSwing = rollMiningOreOnSwing;
G.miningSpotById = miningSpotById;
G.pickRandomMiningSpot = pickRandomMiningSpot;
G.activeMiningSpot = activeMiningSpot;
G.ensureMiningSpotId = ensureMiningSpotId;
G.enterMiningFromRefiner = enterMiningFromRefiner;
