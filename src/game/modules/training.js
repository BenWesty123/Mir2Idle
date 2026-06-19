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

function trainingRoomEnemyTemplate(zone = G.activeZone()) {
  const enemyId = zone?.enemyIds?.[0];
  return ENEMY_TEMPLATES.find((enemy) => enemy.id === enemyId) ?? ENEMY_TEMPLATES[0];
}

function trainingRoomCastGapMs(spell, learned) {
  return crystalSpellCastCooldownMs(spell, learned);
}

function trainingRoomAutocastEntries() {
  const classId = state.battle.combatClass;
  // Training room cycles every spell the player toggled Auto on — not combat's autocast slot cap.
  return G.combatAutoCastSpells(classId)
    .map((spell) => ({ spell, learned: G.learnedMagic(spell.id) }))
    .filter(({ spell, learned }) => learned?.autoCast && !spell.passive)
    .sort((a, b) => G.autoCastPriorityForClass(classId, a.spell) - G.autoCastPriorityForClass(classId, b.spell));
}

function trainingRoomSpendMp(spell, learned, cost) {
  const battle = state.battle;
  battle.player.mp = Math.max(0, battle.player.mp - cost);
  if (learned) learned.castReadyAt = 0;
  battle.wizardSpellLockUntil = 0;
  if (spell?.id) G.clearQueuedCombatSpell(spell.id);
}

function trainingRoomPlayCastVisual(spell, now) {
  const battle = state.battle;
  battle.pendingImpact = null;
  battle.pendingDefenceBuff = null;
  battle.pendingHeal = null;
  battle.pendingPoison = null;
  battle.pendingUltimateEnhancer = null;
  battle.pendingPetAttack = null;
  battle.pendingTaoPet = null;
  battle.activeWizardSpell = null;
  battle.activeWizardSpellAtlas = null;
  battle.activeTaoSpell = null;
  battle.activeTaoSpellAtlas = null;
  battle.activeSkill = "None";
  battle.activeSkillAtlas = null;

  const bodyAction = spell.bodyAction ?? "spell";
  if (battle.combatClass === "Warrior") {
    battle.activeSkill = spell.id;
    battle.activeSkillAtlas = state.warriorSkillAtlases[spell.id] ?? null;
    battle.activeSkillStartedAt = now;
    G.setPlayerAction(bodyAction, now, true);
    return;
  }
  if (battle.combatClass === "Wizard") {
    battle.activeWizardSpell = spell.id;
    battle.activeWizardSpellAtlas = state.wizardSpellAtlases[spell.id] ?? null;
    battle.activeWizardSpellStartedAt = now;
    G.setPlayerAction(bodyAction, now, true);
    return;
  }
  battle.activeTaoSpell = spell.id;
  battle.activeTaoSpellAtlas = state.taoistSpellAtlases[spell.id] ?? null;
  battle.activeTaoSpellStartedAt = now;
  G.setPlayerAction(bodyAction, now, true);
}

function trainingRoomCastWarrior(spell, learned, cost, now) {
  const battle = state.battle;
  if (spell.toggle) return false;

  if (spell.id === "TwinDrakeBlade") {
    if (G.warriorTwinDrakeReady()) {
      trainingRoomSpendMp(spell, learned, cost);
      G.clearTwinDrakeChargeState(battle);
      G.levelWarriorMagic(spell, learned, now);
      trainingRoomPlayCastVisual(spell, now);
      G.playWarriorSpellSwingSfx(spell, { volume: 0.5 });
      G.setEnemyAction("struck", true, now);
      G.playMonsterSfx("flinch");
      return true;
    }
    if (!G.isWarriorChargeSkill(spell)) return false;
    trainingRoomSpendMp(spell, learned, cost);
    G.applyTwinDrakeChargeState(battle, now);
    G.levelWarriorMagic(spell, learned, now);
    trainingRoomPlayCastVisual(spell, now);
    G.pushBattleLog(`${spell.label} readied for the next attack.`);
    return true;
  }

  if (spell.id === "FlamingSword") {
    if (G.warriorFlamingSwordReady()) {
      trainingRoomSpendMp(spell, learned, 0);
      G.clearFlamingSwordChargeState(battle);
      G.levelWarriorMagic(spell, learned, now);
      trainingRoomPlayCastVisual(spell, now);
      G.playWarriorSpellSwingSfx(spell, { volume: 0.5 });
      G.setEnemyAction("struck", true, now);
      G.playMonsterSfx("flinch");
      return true;
    }
    if (!G.isWarriorChargeSkill(spell)) return false;
    trainingRoomSpendMp(spell, learned, cost);
    G.applyFlamingSwordChargeState(battle, now);
    learned.castReadyAt = now + spellDelayMs(spell, learned);
    trainingRoomPlayCastVisual(spell, now);
    G.pushBattleLog(`${spell.label} readied for the next attack.`);
    return true;
  }

  if (G.isWarriorChargeSkill(spell)) {
    trainingRoomSpendMp(spell, learned, cost);
    G.levelWarriorMagic(spell, learned, now);
    trainingRoomPlayCastVisual(spell, now);
    G.pushBattleLog(`${spell.label} readied for the next attack.`);
    return true;
  }

  if (spell.buff) {
    if (spell.id !== "Fury") return false;
    trainingRoomSpendMp(spell, learned, cost);
    battle.furyUntil = now + 60000 + (Number(learned?.level) || 0) * 10000;
    battle.furyBonus = 4;
    G.levelWarriorMagic(spell, learned, now);
    trainingRoomPlayCastVisual(spell, now);
    G.playWarriorSpellSwingSfx(spell, { volume: 0.5 });
    return true;
  }

  trainingRoomSpendMp(spell, learned, cost);
  G.levelWarriorMagic(spell, learned, now);
  trainingRoomPlayCastVisual(spell, now);
  G.playWarriorSpellSwingSfx(spell, { volume: 0.5 });
  G.setEnemyAction("struck", true, now);
  G.playMonsterSfx("flinch");
  return true;
}

function trainingRoomCastWizard(spell, learned, cost, now) {
  const battle = state.battle;

  if (spell.id === "MagicShield") {
    trainingRoomSpendMp(spell, learned, cost);
    const applied = G.applyDefenceBuffEffect(spell, learned, battle.player, now);
    G.startMagicShieldLoopFx({ expiresAt: now + applied.durationMs, now });
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    return true;
  }

  trainingRoomSpendMp(spell, learned, cost);
  G.levelMagicSkill(spell, learned, now);
  trainingRoomPlayCastVisual(spell, now);
  G.playSpellSfx(spell.id, "cast");

  if (spell.impactMode === "ground") {
    const value = G.rollWizardMagicValue(spell, learned, battle.player);
    G.createWizardGroundSpellEffect(spell, { value, worldX: battle.enemyX }, now);
  } else {
    G.setEnemyAction("struck", true, now);
    G.playMonsterSfx("flinch");
  }
  return true;
}

function trainingRoomCastTaoist(spell, learned, cost, now) {
  const battle = state.battle;

  if (spell.id === "Healing") {
    trainingRoomSpendMp(spell, learned, cost);
    G.levelMagicSkill(spell, learned, now);
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    return true;
  }

  if (spell.id === "SoulShield" || spell.id === "BlessedArmour") {
    const entry = G.amuletCandidate(0);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (!entry || !G.isTaoistAmuletItem(item) || !G.consumeOneInventoryUnit(entry.id)) return false;
    trainingRoomSpendMp(spell, learned, cost);
    G.applyDefenceBuffEffect(spell, learned, battle.player, now);
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    return true;
  }

  if (spell.id === "UltimateEnhancer") {
    const targets = G.ultimateEnhancerTargets(now);
    if (!targets.length) return false;
    const entry = G.amuletCandidate(0);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (!entry || !G.isTaoistAmuletItem(item) || !G.consumeOneInventoryUnit(entry.id)) return false;
    trainingRoomSpendMp(spell, learned, cost);
    G.applyUltimateEnhancerToTargets(spell, learned, battle.player, targets, now);
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    return true;
  }

  if (spell.id === "SummonSkeleton" || spell.id === "SummonShinsu") {
    const amuletCost = G.taoistSummonAmuletCost(spell.id);
    const entry = G.amuletCandidate(0);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (!entry || !G.isTaoistAmuletItem(item) || G.amuletInventoryCount() < amuletCost) return false;
    if (!G.consumeAmuletInventoryUnits(amuletCost)) return false;
    if (battle.taoPet?.active) G.dismissTaoistPet();
    trainingRoomSpendMp(spell, learned, cost);
    G.levelMagicSkill(spell, learned, now);
    battle.taoPet = G.createTaoistSummonPet(spell.id, learned.level, now);
    state.taoPetAtlas = G.taoPetAtlasFor(battle.taoPet);
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    return true;
  }

  if (spell.id === "Poisoning") {
    const entry = G.poisonCandidateForEnemy(battle.enemy, now);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (!entry || !G.isPoisonItem(item) || !G.consumeOneInventoryUnit(entry.id)) return false;
    trainingRoomSpendMp(spell, learned, cost);
    G.levelMagicSkill(spell, learned, now);
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    return true;
  }

  if (spell.id === "SoulFireBall") {
    const entry = G.amuletCandidate(0);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (!entry || !G.isTaoistAmuletItem(item) || !G.consumeOneInventoryUnit(entry.id)) return false;
    trainingRoomSpendMp(spell, learned, cost);
    G.levelMagicSkill(spell, learned, now);
    trainingRoomPlayCastVisual(spell, now);
    G.playSpellSfx(spell.id, "cast");
    G.setEnemyAction("struck", true, now);
    G.playMonsterSfx("flinch");
    return true;
  }

  return false;
}

function trainingRoomTryCast(spell, learned, now) {
  if (!spell || !learned) return false;
  const cost = spellMpCost(spell, learned);
  if ((state.battle.player?.mp ?? 0) < cost) return false;

  const classId = state.battle.combatClass;
  if (classId === "Warrior") return trainingRoomCastWarrior(spell, learned, cost, now);
  if (classId === "Wizard") return trainingRoomCastWizard(spell, learned, cost, now);
  if (classId === "Taoist") return trainingRoomCastTaoist(spell, learned, cost, now);
  return false;
}


G.trainingRoomEnemyTemplate = trainingRoomEnemyTemplate;
G.trainingRoomCastGapMs = trainingRoomCastGapMs;
G.trainingRoomAutocastEntries = trainingRoomAutocastEntries;
G.trainingRoomSpendMp = trainingRoomSpendMp;
G.trainingRoomPlayCastVisual = trainingRoomPlayCastVisual;
G.trainingRoomCastWarrior = trainingRoomCastWarrior;
G.trainingRoomCastWizard = trainingRoomCastWizard;
G.trainingRoomCastTaoist = trainingRoomCastTaoist;
G.trainingRoomTryCast = trainingRoomTryCast;
