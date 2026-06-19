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

function offlineMiningOreLabel(itemId, purity) {
  const item = G.itemDefinition(itemId);
  if (!item) return itemId;
  const purityLabel = purity > 0 ? ` P${purity}` : "";
  return `${item.name}${purityLabel}`;
}

function offlineTravelTimeMs() {
  const distance = Math.max(0, G.enemySpawnDistance() - G.playerAttackRange());
  const walkDistance = Math.min(distance, TRAVEL_WALK_DISTANCE);
  const runDistance = Math.max(0, distance - walkDistance);
  return Math.round((walkDistance / Math.max(1, LANE.playerSpeed) + runDistance / Math.max(1, LANE.runSpeed)) * 1000);
}

function offlinePetAttackDelayMs(pet, simNow) {
  if (!pet?.active) return Infinity;
  const readyIn = Math.max(0, (pet.nextAttackAt ?? 0) - simNow);
  if (readyIn > 0) return readyIn;
  if (state.battle.pendingPetAttack) return 1;
  if (pet.spellId === "SummonShinsu" && !pet.shinsuVisible && pet.action === "show") return 1;
  if (G.taoistPetEnemyDistance() > G.taoistPetAttackRangePx(pet)) return Infinity;
  return 0;
}

function offlineUpdateRecovery(now, report) {
  G.updatePendingHeal(now);
  G.updatePendingDefenceBuff(now, { offline: true });
  G.updatePendingUltimateEnhancer(now, { offline: true });
  G.updatePendingPoison(now, { offline: true });
  G.updatePendingPetAttack(now, { offline: true });
  G.updatePendingTaoPet(now);
  G.updateHealingRegen(now);
  G.updateEnemyPoisons(now, { offline: true });
  G.updatePotionRegen(now);
  offlineAutoUsePotions(now, report);
  G.updatePendingHeal(now);
  G.updatePendingDefenceBuff(now, { offline: true });
  G.updatePendingUltimateEnhancer(now, { offline: true });
  G.updatePendingPoison(now, { offline: true });
  G.updatePendingTwinDrakeHits(now);
  G.updateAttachedSpellFx(now);
  G.updatePendingPetAttack(now, { offline: true });
  G.updatePendingTaoPet(now);
  G.updateHealingRegen(now);
  G.updateEnemyPoisons(now, { offline: true });
  G.updatePotionRegen(now);
}

function offlineAutoUsePotions(now, report) {
  const resources = ["hp", "mp"].sort((a, b) => G.resourceRatio(a) - G.resourceRatio(b));
  for (const kind of resources) {
    if (!G.shouldAutoUsePotion(kind, now)) continue;
    const candidate = G.autoPotionCandidates(kind)[0];
    if (!candidate) continue;
    const hpRestore = G.potionRestoreAmount(candidate.item, "hp");
    const mpRestore = G.potionRestoreAmount(candidate.item, "mp");
    if (!G.removeInventoryEntry(candidate.entry.id, 1)) continue;
    G.queuePotionRestore(hpRestore, mpRestore, now);
    state.battle.autoPotionReadyAt[kind] = now + AUTO_POTION_COOLDOWN_MS;
    G.incrementReportCount(report.potionsUsed, candidate.item.name);
  }
}

function offlinePlayerAttack(enemy, now) {
  state.battle.enemy = enemy;
  state.battle.enemyId = enemy.id;
  state.battle.enemyX = state.battle.playerX + G.playerAttackRange();

  if (state.battle.combatClass === "Wizard") {
    offlineWizardAttack(enemy, now);
    return true;
  }
  if (state.battle.combatClass === "Taoist") {
    offlineTaoistAttack(enemy, now);
    return true;
  }
  return offlineWarriorAttack(enemy, now);
}

function offlineWarriorAttack(enemy, now) {
  const battle = state.battle;
  const { skill, learned, cost, charged } = G.usableWarriorAttackSkill(now);

  if (skill.buff) {
    G.castWarriorBuff(skill, learned, cost, now);
    battle.lastPlayerAttackCooldownMs = CRYSTAL_PLAYER_ACTION_LOCK_MS;
    return true;
  }

  if (learned) G.commitWarriorSpellUse(skill, learned, cost, now);
  battle.lastPlayerAttackCooldownMs = G.playerWeaponAttackCooldownMs(now, skill);
  if (!G.rollHit(battle.player.accuracy, enemy.agility)) {
    G.rollSlayingChargeAfterAttack(now);
    if (!G.warriorSlayingPending()) G.maybeAutoWarriorCharge(now);
    return true;
  }

  const damage = learned
    ? G.rollWarriorMagicDamage(skill, learned, battle.player, enemy)
    : rollDamage(battle.player.dc, G.enemyPhysicalDefence(enemy), battle.player.luck);
  const scaled = G.scaleEnemyPhysicalDamage(damage, enemy, now);
  if (scaled <= 0) {
    G.rollSlayingChargeAfterAttack(now);
    if (!G.warriorSlayingPending()) G.maybeAutoWarriorCharge(now);
    return true;
  }
  G.reduceEnemyHp(enemy, scaled);
  if (learned) G.levelWarriorMagic(skill, learned, now);
  G.levelPassiveWeaponMagic(now);
  G.rollSlayingChargeAfterAttack(now);
  if (skill.id === "TwinDrakeBlade" && charged && enemy.hp > 0) {
    G.queueTwinDrakeSecondHit({ classId: battle.combatClass }, learned, damage, now);
  }
  if (!G.warriorSlayingPending()) G.maybeAutoWarriorCharge(now);
  return true;
}

function offlineMagicAttack(enemy, now, statKey, multiplier = 1) {
  const player = state.battle.player;
  if (!G.rollMagicHit(enemy)) return;
  const damage = Math.max(0, Math.round(rollDamage(player[statKey] ?? player.dc, G.enemyMagicalDefence(enemy), player.luck) * multiplier));
  if (damage <= 0) return;
  G.reduceEnemyHp(enemy, damage);
}

function offlineWizardAttack(enemy, now) {
  const battle = state.battle;
  const magicShield = G.usableWizardDefenceBuff(now);
  if (magicShield) {
    G.castWizardDefenceBuff(magicShield, now, { offline: true });
    return;
  }
  const queued = G.queuedCombatSpell("Wizard");
  if (queued?.spell.id === "MagicShield") {
    const manualShield = G.usableWizardDefenceBuff(now, { requireAuto: false });
    if (manualShield) {
      G.castWizardDefenceBuff(manualShield, now, { offline: true });
      return;
    }
  }
  const attackSpell = G.usableWizardAttackSpell(now);
  if (!attackSpell) {
    offlineWizardWeaponAttack(enemy, now);
    return;
  }
  const { spell, learned, cost, cooldownWaiting } = attackSpell;
  if (cooldownWaiting) {
    offlineWizardWeaponAttack(enemy, now);
    return;
  }
  if ((battle.player?.mp ?? 0) < cost) {
    offlineWizardWeaponAttack(enemy, now);
    return;
  }

  battle.lastPlayerAttackCooldownMs = G.wizardCastCooldownMs(spell, learned);
  G.commitWizardSpellUse(spell, learned, cost, now);
  if (!G.rollMagicHit(enemy)) return;
  const damage = G.rollWizardMagicDamage(spell, learned, battle.player, enemy);
  if (damage <= 0) return;
  G.reduceEnemyHp(enemy, damage);
  if (spell.id === "FrostCrunch") G.applyFrostCrunchEffects(enemy, learned, battle.player, now);
  if (learned) G.levelMagicSkill(spell, learned, now);
}

function offlineWizardWeaponAttack(enemy, now) {
  const battle = state.battle;
  battle.lastPlayerAttackCooldownMs = G.playerWeaponAttackCooldownMs(now, BASIC_ATTACK_SKILL);
  if (!G.rollHit(battle.player.accuracy, enemy.agility)) return;
  const damage = rollDamage(battle.player.dc, G.enemyPhysicalDefence(enemy), battle.player.luck);
  if (damage <= 0) return;
  G.reduceEnemyHp(enemy, damage);
}

function offlineTaoistAttack(enemy, now) {
  const battle = state.battle;
  const queuedRequest = G.queuedCombatSpell("Taoist");
  const queued = G.usableQueuedTaoistSpell(now);
  if (queued) {
    if (queued.spell.id === "SoulFireBall") return offlineTaoistSoulFireBall(enemy, now, queued);
    if (queued.spell.id === "Healing") return G.castTaoistHealing(queued, now, { offline: true });
    if (queued.spell.id === "Poisoning") return G.castTaoistPoisoning(queued, now, { offline: true });
    if (queued.spell.id === "SummonSkeleton" || queued.spell.id === "SummonShinsu") {
      G.castTaoistSummonPet(queued, now, { offline: true });
      const delayMs = queued.spell.id === "SummonShinsu"
        ? CRYSTAL_SUMMON_SHINSU_DELAY_MS
        : CRYSTAL_SUMMON_SKELETON_DELAY_MS;
      G.updatePendingTaoPet(now + delayMs);
      battle.lastPlayerAttackCooldownMs = spellDelayMs(queued.spell, queued.learned);
      return;
    }
    if (queued.spell.id === "SoulShield" || queued.spell.id === "BlessedArmour") {
      G.castTaoistDefenceBuff(queued, now, { offline: true });
      return;
    }
    if (queued.spell.id === "UltimateEnhancer") {
      G.castTaoistUltimateEnhancer(queued, now, { offline: true });
      return;
    }
  }
  if (queuedRequest) return offlineTaoistWeaponAttack(enemy, now);

  const summon = G.usableTaoistSummonSkeleton(now);
  if (summon) {
    G.castTaoistSummonPet(summon, now, { offline: true });
    G.updatePendingTaoPet(now + CRYSTAL_SUMMON_SKELETON_DELAY_MS);
    battle.lastPlayerAttackCooldownMs = spellDelayMs(summon.spell, summon.learned);
    return;
  }

  const shinsu = G.usableTaoistSummonShinsu(now);
  if (shinsu) {
    G.castTaoistSummonPet(shinsu, now, { offline: true });
    G.updatePendingTaoPet(now + CRYSTAL_SUMMON_SHINSU_DELAY_MS);
    battle.lastPlayerAttackCooldownMs = spellDelayMs(shinsu.spell, shinsu.learned);
    return;
  }

  if (G.taoistPetCanTank()) {
    if (!G.taoistPetSupportAttackOffline(now)) battle.lastPlayerAttackCooldownMs = TAOIST_COMBAT_POLL_MS;
    return;
  }
  if (enemy.hp <= 0) return;

  const soulFireBall = G.usableTaoistSoulFireBall(now);
  if (soulFireBall) offlineTaoistSoulFireBall(enemy, now, soulFireBall, { secondary: true });
  if (enemy.hp <= 0) return;

  const healing = G.usableTaoistHealing(now);
  if (healing) {
    G.castTaoistHealing(healing, now, { offline: true });
    return;
  }

  for (const spellId of ["SoulShield", "BlessedArmour"]) {
    const defenceBuff = G.usableTaoistDefenceBuff(spellId, now);
    if (defenceBuff) {
      G.castTaoistDefenceBuff(defenceBuff, now, { offline: true });
      return;
    }
  }

  const ultimateEnhancer = G.usableTaoistUltimateEnhancer(now);
  if (ultimateEnhancer) {
    G.castTaoistUltimateEnhancer(ultimateEnhancer, now, { offline: true });
    return;
  }

  const poisoning = G.usableTaoistPoisoning(now);
  if (poisoning) {
    G.castTaoistPoisoning(poisoning, now, { offline: true });
    return;
  }
  offlineTaoistWeaponAttack(enemy, now);
}

function offlineTaoistSoulFireBall(enemy, now, soulFireBall, options = {}) {
  const battle = state.battle;
  const { spell, learned, cost, entry } = soulFireBall;
  if (!G.consumeOneInventoryUnit(entry.id)) return false;
  if (!options.secondary) battle.lastPlayerAttackCooldownMs = spellDelayMs(spell, learned);
  G.commitTaoistSpellUse(spell, learned, cost, now);
  if (!G.rollMagicHit(enemy)) return true;
  const damage = G.rollTaoistMagicDamage(spell, learned, battle.player, enemy);
  if (damage <= 0) return true;
  G.reduceEnemyHp(enemy, damage);
  if (learned) G.levelMagicSkill(spell, learned, now);
  return true;
}

function offlineTaoistWeaponAttack(enemy, now) {
  const battle = state.battle;
  battle.lastPlayerAttackCooldownMs = G.playerWeaponAttackCooldownMs(now, BASIC_ATTACK_SKILL);
  if (!G.rollHit(battle.player.accuracy, enemy.agility)) return;
  const damage = rollDamage(battle.player.dc, G.enemyPhysicalDefence(enemy), battle.player.luck);
  if (damage <= 0) return;
  G.reduceEnemyHp(enemy, damage);
  G.levelPassiveWeaponMagic(now);
}

function offlineEnemyAttack(enemy, now, report) {
  if (G.isTrainingDummyEnemy(enemy)) return;
  state.battle.enemy = enemy;
  const player = state.battle.player;
  if (!player || player.hp <= 0) return;
  if (G.taoistPetCanTank()) {
    const pet = state.battle.taoPet;
    const { hit, damage } = G.resolveIncomingEnemyAttack(enemy, G.defenceTargetForIncomingAttack(pet));
    if (!hit) return;
    pet.hp = Math.max(0, pet.hp - damage);
    if (pet.hp <= 0) G.markTaoistPetDead(now, { sound: false });
    return;
  }
  const { hit, damage } = G.resolveIncomingEnemyAttack(enemy, G.defenceTargetForIncomingAttack(player));
  if (!hit) return;
  player.hp = Math.max(0, player.hp - damage);
  report.damageTaken += damage;
  if (player.hp <= 0) {
    state.battle.running = false;
    state.battle.phase = "idle";
  }
}


G.offlineMiningOreLabel = offlineMiningOreLabel;
G.offlineTravelTimeMs = offlineTravelTimeMs;
G.offlinePetAttackDelayMs = offlinePetAttackDelayMs;
G.offlineUpdateRecovery = offlineUpdateRecovery;
G.offlineAutoUsePotions = offlineAutoUsePotions;
G.offlinePlayerAttack = offlinePlayerAttack;
G.offlineWarriorAttack = offlineWarriorAttack;
G.offlineMagicAttack = offlineMagicAttack;
G.offlineWizardAttack = offlineWizardAttack;
G.offlineWizardWeaponAttack = offlineWizardWeaponAttack;
G.offlineTaoistAttack = offlineTaoistAttack;
G.offlineTaoistSoulFireBall = offlineTaoistSoulFireBall;
G.offlineTaoistWeaponAttack = offlineTaoistWeaponAttack;
G.offlineEnemyAttack = offlineEnemyAttack;
