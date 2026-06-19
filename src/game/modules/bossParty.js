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

import { battlePanelSignature, sceneSignature, combatSkillBarSignature, lastStageShellSize } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function bossPartyMemberClassIds(party = state.battle.bossParty) {
  if (!party?.members?.length) return [state.activeCharacterId];
  return party.members.map((member) => member.classId);
}

function bossPartyOnField(party = state.battle.bossParty) {
  return Boolean(party?.members?.length && (party.active || party.finished));
}

function freezeBossPartyMembersForAftermath(party, now = performance.now()) {
  if (!party?.members?.length) return;
  for (const member of party.members) {
    if (!member.alive || member.hp <= 0) continue;
    member.targetWorldX = null;
    member.meleeAdvanceFromX = null;
    member.meleeAdvanceStartedAt = null;
    member.visualAction = "stance";
    member.visualOneShot = false;
    member.visualFrame = 0;
    member.visualLastTick = now;
    member.nextActionAt = Number.POSITIVE_INFINITY;
    member.returnToStandAt = now + COMBAT_STANCE_HOLD_MS;
    if (member.classId === bossPartyControlledClassId()) G.setPlayerAction("stance", now);
  }
}

function updateBossPartyMemberRestState(member, now) {
  if (!member?.alive || member.hp <= 0 || !member.returnToStandAt) return;
  if (now < member.returnToStandAt) return;
  member.returnToStandAt = 0;
  member.visualAction = "standing";
  member.visualFrame = 0;
  member.visualOneShot = false;
  member.visualLastTick = now;
  if (member.classId === bossPartyControlledClassId()) G.setPlayerAction("standing", now);
}

function returnAllCharactersToTown() {
  if (bossPartyOnField()) {
    syncBossPartyControlledMemberFromState(bossPartyLeaderClassId());
    syncBossPartyMembersToCharacters(state.battle.bossParty, { applyControlled: true });
  } else {
    G.captureActiveCharacterState();
  }
  G.clearGroupDungeonRunState();
  state.battle.bossParty = null;
  state.game.mode = "town";
  state.game.activeZoneId = null;
  lastStageShellSize = { w: 0, h: 0, mode: "", scale: 0 };
  state.game.zoneKills = 0;
  state.game.distance = 0;
  state.game.miningNextRollAt = 0;
  state.game.miningSpotId = null;
  state.game.selectedTownNpcId = null;
  G.persistCharacterGameLocation({ mode: "town", zoneId: null, classIds: CHARACTER_IDS, running: false });
}

function bossPartyOfflineSimulationActive(zone = G.activeZone()) {
  return Boolean(state.battle.bossParty?.active && G.isGroupContentZone(zone));
}

function snapshotBossPartyOfflineProgress() {
  const leader = bossPartyLeaderMember();
  const waves = G.groupDungeonWaveState();
  return {
    kills: leader?.game?.kills ?? 0,
    experience: leader?.game?.progress?.experience ?? 0,
    level: leader?.game?.progress?.level ?? 1,
    gold: leader?.inventory?.gold ?? 0,
    waveNumber: waves?.waveNumber ?? 0,
  };
}

function completeBossPartyOfflineReport(report, snapshot) {
  const leader = bossPartyLeaderMember();
  if (!leader || !snapshot) return report;
  report.kills = Math.max(0, (leader.game?.kills ?? 0) - snapshot.kills);
  report.gold = Math.max(0, (leader.inventory?.gold ?? 0) - snapshot.gold);
  report.xp = G.xpGainedSinceOfflineSnapshot(snapshot, leader);
  report.levels = [];
  const endLevel = leader.game.progress.level;
  for (let level = snapshot.level + 1; level <= endLevel; level += 1) report.levels.push(level);
  const waves = G.groupDungeonWaveState();
  if (waves && waves.waveNumber > snapshot.waveNumber) {
    report.wavesCleared = waves.waveNumber - snapshot.waveNumber;
  }
  return report;
}

function simulateBossPartyCatchUp(elapsedMs, startedAt = performance.now()) {
  const party = state.battle.bossParty;
  if (!party?.active || party.finished) return null;

  const limitMs = Math.min(Math.max(0, Math.trunc(Number(elapsedMs) || 0)), OFFLINE_PROGRESS_CAP_MS);
  const snapshot = snapshotBossPartyOfflineProgress();
  const report = {
    elapsedMs: 0,
    capped: elapsedMs > OFFLINE_PROGRESS_CAP_MS,
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
    wavesCleared: 0,
    simulatedStartedAt: startedAt,
    simulatedEndedAt: startedAt,
    kind: "bossParty",
  };

  const stepMs = Math.max(SIMULATION_STEP_MS, Math.ceil(limitMs / BOSS_PARTY_CATCHUP_MAX_STEPS));
  let simMs = 0;
  let steps = 0;

  while (simMs < limitMs && steps < BOSS_PARTY_CATCHUP_MAX_STEPS) {
    if (!party.active || party.finished) break;
    if (bossPartyAllMembersDead()) {
      report.diedAtMs = simMs;
      break;
    }

    const chunk = Math.min(stepMs, limitMs - simMs);
    simMs += chunk;
    steps += 1;
    G.runSimulationStep(startedAt + simMs, { autoSave: false });
  }

  report.elapsedMs = simMs;
  report.simulatedEndedAt = startedAt + simMs;
  return completeBossPartyOfflineReport(report, snapshot);
}


function groupDungeonWaveZone(zone = G.activeZone()) {
  if (zone?.groupDungeon) return zone;
  const zoneId = state.battle.bossParty?.zoneId ?? state.game.activeZoneId;
  return PROTOTYPE_ZONES.find((entry) => entry.id === zoneId) ?? zone;
}

function groupDungeonOfflineRunSnapshot() {
  if (!G.groupDungeonSwarmActive()) return null;
  const party = state.battle.bossParty;
  const waves = G.groupDungeonWaveState();
  const zoneId = party?.zoneId ?? state.game.activeZoneId;
  const zone = groupDungeonWaveZone(PROTOTYPE_ZONES.find((entry) => entry.id === zoneId));
  if (!party?.active || !waves || !zoneId) return null;
  return {
    kind: "groupDungeon",
    zoneId,
    leaderClassId: bossPartyLeaderClassId(party),
    classIds: bossPartyMemberClassIds(party),
    waveNumber: Math.max(1, Math.trunc(Number(waves.waveNumber) || 1)),
    killedThisWave: Math.max(0, Math.trunc(Number(waves.killedThisWave) || 0)),
    targetThisWave: Math.max(1, Math.trunc(Number(waves.targetThisWave) || groupDungeonWaveSpawnCount(waves.waveNumber, zone))),
    endless: Boolean(waves.endless),
  };
}

function sanitizeGroupDungeonOfflineRun(run, fallbackZoneId = state.game.activeZoneId, fallbackLeader = state.activeCharacterId) {
  if (!run || typeof run !== "object") return null;
  const zoneId = String(run.zoneId || fallbackZoneId || "");
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId);
  if (!zone || !G.groupDungeonZone(zone)) return null;
  const leaderClassId = G.normalizeCharacterId(run.leaderClassId || fallbackLeader);
  const rawIds = Array.isArray(run.classIds) && run.classIds.length ? run.classIds : [leaderClassId];
  const classIds = G.bossPartyClassOrder([...new Set(rawIds.map((id) => G.normalizeCharacterId(id)))])
    .filter((classId) => state.characters?.[classId]);
  if (!classIds.includes(leaderClassId)) classIds.unshift(leaderClassId);
  return {
    kind: "groupDungeon",
    zoneId,
    leaderClassId,
    classIds: G.bossPartyClassOrder([...new Set(classIds)]),
    waveNumber: Math.max(1, Math.trunc(Number(run.waveNumber) || 1)),
    killedThisWave: Math.max(0, Math.trunc(Number(run.killedThisWave) || 0)),
    targetThisWave: Math.max(1, Math.trunc(Number(run.targetThisWave) || groupDungeonWaveSpawnCount(run.waveNumber, zone))),
    endless: Boolean(run.endless),
  };
}

function simulateOfflineGroupDungeonProgress(zone, pending, startedAt = performance.now()) {
  const run = sanitizeGroupDungeonOfflineRun(pending?.groupDungeonRun, zone?.id, state.activeCharacterId);
  if (!zone || !run) return null;

  const limitMs = Math.min(Math.max(0, Math.trunc(Number(pending?.elapsedMs) || 0)), OFFLINE_PROGRESS_CAP_MS);
  const members = run.classIds
    .map((classId, index) => bossPartyMemberFromCharacter(classId, state.characters[classId], startedAt + index * BOSS_PARTY_MEMBER_ACTION_GAP_MS))
    .filter(Boolean);
  if (!members.length) return null;

  state.activeCharacterId = run.leaderClassId;
  state.game.mode = "zone";
  state.game.activeZoneId = zone.id;
  G.positionBossPartyMembers(members, run.leaderClassId);
  G.snapBossPartyMembersToSwarmGrid(members);
  const frontMeleeMember = G.bossPartyClassOrder(members.map((member) => member.classId))
    .filter((classId) => G.bossPartyIsMeleeClass(classId))
    .map((classId) => members.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .find(Boolean) ?? null;
  state.battle.bossParty = {
    active: true,
    zoneId: zone.id,
    leaderClassId: run.leaderClassId,
    controlledClassId: run.leaderClassId,
    members,
    pet: null,
    petDiedThisFight: false,
    effects: [],
    pendingPoison: null,
    finished: false,
    startedAt,
    lastAdvanceAt: startedAt,
    lockedCameraX: null,
    lockedArenaWorldX: null,
    meleeFrontSlotWorldX: frontMeleeMember ? Math.round(Number(frontMeleeMember.worldX) || 0) : null,
    defeated: false,
  };
  void G.preloadBossPartyVisualAtlases(members);
  state.battle.swarm = {
    enemies: [],
    nextId: 0,
    lastAdvanceAt: startedAt,
    waves: createGroupDungeonWaveState(startedAt, run.waveNumber, zone),
  };
  const waves = state.battle.swarm.waves;
  waves.killedThisWave = Math.min(run.killedThisWave, run.targetThisWave);
  waves.targetThisWave = Math.max(run.targetThisWave, groupDungeonWaveSpawnCount(waves.waveNumber, zone));
  waves.spawnedThisWave = waves.killedThisWave;
  waves.endless = Boolean(run.endless);

  const leaderSnapshot = offlineGroupMemberSnapshot(bossPartyLeaderMember());
  const report = {
    elapsedMs: 0,
    capped: Boolean(pending?.capped || (pending?.rawElapsedMs ?? limitMs) > OFFLINE_PROGRESS_CAP_MS),
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
    wavesCleared: 0,
    simulatedStartedAt: startedAt,
    simulatedEndedAt: startedAt,
    kind: "bossParty",
    resetGroupDungeonRunAfterOffline: true,
  };

  let simMs = 0;
  while (simMs < limitMs) {
    const alive = bossPartyAliveRewardMembers();
    if (!alive.length) {
      report.diedAtMs = simMs;
      break;
    }
    const enemy = offlineGroupPickEnemy(zone);
    if (!enemy) break;
    const result = offlineGroupSimulateKill(zone, enemy, startedAt + simMs, limitMs - simMs, report);
    simMs += result.elapsedMs;
    report.finalEnemy = result.enemy;
    if (!result.killed) {
      if (result.partyDied) report.diedAtMs = simMs;
      break;
    }
    report.finalEnemy = null;
    offlineGroupAwardKill(zone, enemy, startedAt + simMs, report);
    offlineGroupAdvanceWave(waves, report, startedAt + simMs, zone);
  }

  report.elapsedMs = Math.min(simMs, limitMs);
  report.simulatedEndedAt = startedAt + report.elapsedMs;
  offlineGroupCompleteLeaderReport(report, leaderSnapshot, bossPartyLeaderMember());
  bossPartySyncControlledPlayerRef();
  return report;
}

function offlineGroupMemberSnapshot(member) {
  if (!member) return { kills: 0, experience: 0, level: 1, gold: 0 };
  return {
    kills: Math.max(0, Math.trunc(Number(member.game?.kills) || 0)),
    experience: Math.max(0, Math.trunc(Number(member.game?.progress?.experience) || 0)),
    level: Math.max(1, Math.trunc(Number(member.game?.progress?.level) || 1)),
    gold: Math.max(0, Math.trunc(Number(member.inventory?.gold) || 0)),
  };
}

function offlineGroupCompleteLeaderReport(report, snapshot, leader) {
  if (!leader || !snapshot) return report;
  report.kills = Math.max(0, (leader.game?.kills ?? 0) - snapshot.kills);
  report.gold = Math.max(0, (leader.inventory?.gold ?? 0) - snapshot.gold);
  report.xp = G.xpGainedSinceOfflineSnapshot(snapshot, leader);
  report.levels = [];
  const endLevel = Math.max(1, Math.trunc(Number(leader.game?.progress?.level) || 1));
  for (let level = snapshot.level + 1; level <= endLevel; level += 1) report.levels.push(level);
  return report;
}

function offlineGroupPickEnemy(zone) {
  const ids = zone?.enemyIds?.length ? zone.enemyIds : [];
  if (!ids.length) return null;
  const pickedId = ids[randomInt(0, ids.length - 1)];
  return ENEMY_TEMPLATES.find((enemy) => enemy.id === pickedId) ?? null;
}

function offlineGroupSimulateKill(zone, template, startedAt, remainingMs, report) {
  const enemy = { ...template, hp: template.maxHp, mp: template.maxMp, poisons: [], debuffs: { slowUntil: 0, frozenUntil: 0 } };
  const dps = Math.max(0.1, offlineGroupPartyDps(enemy));
  const estimatedKillMs = Math.max(300, Math.ceil((enemy.maxHp / dps) * 1000));
  const incomingDps = offlineGroupIncomingDps(enemy);
  const durationMs = Math.min(remainingMs, estimatedKillMs);
  let elapsed = 0;
  while (elapsed < durationMs) {
    const chunk = Math.min(1000, durationMs - elapsed);
    const now = startedAt + elapsed + chunk;
    offlineGroupUpdateMembers(now, report);
    const target = offlineGroupFrontTarget();
    if (!target) return { killed: false, partyDied: true, elapsedMs: elapsed, enemy };
    const damage = Math.max(0, Math.round(incomingDps * (chunk / 1000)));
    if (damage > 0) {
      target.hp = Math.max(0, target.hp - damage);
      if (target.classId === bossPartyLeaderClassId()) report.damageTaken += damage;
      if (target.hp <= 0) {
        target.alive = false;
        target.hp = 0;
      }
    }
    elapsed += chunk;
    if (!offlineGroupFrontTarget()) return { killed: false, partyDied: true, elapsedMs: elapsed, enemy };
  }
  return { killed: durationMs >= estimatedKillMs, partyDied: false, elapsedMs: durationMs, enemy };
}

function offlineGroupUpdateMembers(now, report) {
  for (const member of state.battle.bossParty?.members ?? []) {
    if (!member.alive || member.hp <= 0) continue;
    offlineGroupAutoUsePotions(member, now, report);
    G.updateBossPartyMemberPotionRegen(member, now);
    G.updateBossPartyMemberHealRegen(member, now);
  }
}

function offlineGroupFrontTarget() {
  const party = state.battle.bossParty;
  return BOSS_PARTY_ORDER
    .map((classId) => party?.members?.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .find(Boolean) ?? null;
}

function offlineGroupPartyDps(enemy) {
  return (state.battle.bossParty?.members ?? [])
    .filter((member) => member.alive && member.hp > 0)
    .reduce((sum, member) => sum + offlineGroupMemberDps(member, enemy), 0);
}

function offlineGroupMemberDps(member, enemy) {
  const physical = offlineGroupAverageDamage(member.dc, enemy.ac, member.luck) * offlineGroupHitChance(member.accuracy, enemy.agility);
  const physicalDelay = Math.max(500, attackDelayMs(member.attackSpeed ?? 0));
  let dps = physical * 1000 / physicalDelay;
  const magic = member.classId === "Wizard"
    ? offlineGroupAverageDamage(member.mc, enemy.amc, member.luck) * 1.15
    : member.classId === "Taoist"
      ? offlineGroupAverageDamage(member.sc, enemy.amc, member.luck) * 0.85
      : 0;
  if (magic > 0 && member.mp > 0) {
    const castDelay = member.classId === "Wizard" ? 1800 : 2200;
    dps += magic * offlineGroupHitChance(member.accuracy, enemy.agility) * 1000 / castDelay;
  }
  return Math.max(0.1, dps);
}

function offlineGroupIncomingDps(enemy) {
  const target = offlineGroupFrontTarget();
  if (!target) return 0;
  const attackers = Math.min(GROUP_DUNGEON_SWARM_LANES.length, GROUP_DUNGEON_WAVE_FIELD_CAP);
  const damage = offlineGroupAverageDamage(G.enemyAttackDamageStat(enemy), G.incomingAttackDefenceStat(target, G.enemyAttackDefenceType(enemy)), enemy.luck);
  const hitChance = G.enemyAttackDefenceType(enemy) === "MAC" ? 0.85 : offlineGroupHitChance(enemy.accuracy, target.agility);
  return attackers * damage * hitChance * 1000 / Math.max(500, Math.trunc(Number(enemy.attackMs) || 1500));
}

function offlineGroupAverageDamage(attackStat, defenceStat, luck = 0) {
  const attack = statRange(attackStat);
  const defence = statRange(defenceStat);
  const attackAvg = (attack.min + attack.max) / 2;
  const defenceAvg = (defence.min + defence.max) / 2;
  const luckBonus = Math.max(0, Math.min(CRYSTAL_MAX_LUCK, Number(luck) || 0)) / Math.max(1, CRYSTAL_MAX_LUCK);
  const luckyAttack = attackAvg + (attack.max - attackAvg) * luckBonus;
  return Math.max(1, luckyAttack - defenceAvg);
}

function offlineGroupHitChance(accuracy, agility) {
  const acc = Math.max(0, Math.trunc(Number(accuracy) || 0));
  const agi = Math.max(0, Math.trunc(Number(agility) || 0));
  return Math.max(0.05, Math.min(0.98, (acc + 1) / (agi + 1)));
}

function offlineGroupAutoUsePotions(member, now, report) {
  if (!member?.alive || member.hp <= 0) return false;
  member.autoPotionReadyAt = member.autoPotionReadyAt ?? { hp: 0, mp: 0 };
  let used = false;
  for (const kind of ["hp", "mp"].sort((a, b) => offlineGroupResourceRatio(member, a) - offlineGroupResourceRatio(member, b))) {
    if (offlineGroupResourceRatio(member, kind) >= AUTO_POTION_THRESHOLD) continue;
    if ((member.autoPotionReadyAt[kind] ?? 0) > now) continue;
    if (kind === "hp" && (member.potHealthAmount ?? 0) > 0) continue;
    if (kind === "mp" && (member.potManaAmount ?? 0) > 0) continue;
    const candidate = G.autoPotionSlots()
      .map((slot) => {
        const entryId = member.hotbar?.slots?.[slot] ?? null;
        const entry = entryId ? member.inventory?.items?.find((item) => item.id === entryId) : null;
        const item = entry ? G.itemDefinition(entry.itemId) : null;
        return { entry, item, restore: G.potionRestoreAmount(item, kind), slot };
      })
      .filter((candidate) => candidate.entry && candidate.restore > 0)
      .sort((a, b) => b.restore - a.restore || a.slot - b.slot)[0];
    if (!candidate) continue;
    if (!offlineGroupConsumeInventoryUnit(member, candidate.entry.id)) continue;
    const hpRestore = G.potionRestoreAmount(candidate.item, "hp");
    const mpRestore = G.potionRestoreAmount(candidate.item, "mp");
    if (G.potionRestoreMode(candidate.item) === "instant") {
      member.hp = Math.min(member.maxHp, member.hp + hpRestore);
      member.mp = Math.min(member.maxMp, member.mp + mpRestore);
    } else {
      member.potHealthAmount = Math.min(65535, (member.potHealthAmount ?? 0) + hpRestore);
      member.potManaAmount = Math.min(65535, (member.potManaAmount ?? 0) + mpRestore);
      member.potTickAt = member.potTickAt || now + CRYSTAL_POT_DELAY_MS;
    }
    member.autoPotionReadyAt[kind] = now + AUTO_POTION_COOLDOWN_MS;
    G.incrementReportCount(report.potionsUsed, candidate.item.name);
    used = true;
  }
  return used;
}

function offlineGroupResourceRatio(member, kind) {
  const max = kind === "hp" ? member.maxHp : member.maxMp;
  return max > 0 ? Math.max(0, Math.min(1, (Number(member[kind]) || 0) / max)) : 1;
}

function offlineGroupConsumeInventoryUnit(member, entryId) {
  const entry = member.inventory?.items?.find((candidate) => candidate.id === entryId);
  if (!entry || Object.values(member.inventory?.equipment ?? {}).includes(entry.id)) return false;
  entry.quantity = Math.max(0, Math.trunc(Number(entry.quantity) || 1) - 1);
  if (entry.quantity <= 0) {
    member.hotbar.slots = (member.hotbar?.slots ?? []).map((id) => id === entry.id ? null : id);
    member.inventory.items = member.inventory.items.filter((candidate) => candidate.id !== entry.id);
  }
  return true;
}

function offlineGroupAwardKill(zone, enemy, now, report) {
  const party = state.battle.bossParty;
  const recipients = bossPartyAliveRewardMembers(party);
  if (!recipients.length) return;
  const shareCount = recipients.length;
  const xpPerShare = G.splitPartyRewardAmount(enemy.experience ?? 0, shareCount);
  const reward = zone.rewards ?? { gold: [1, 2] };
  const totalGold = randomInt(reward.gold[0], reward.gold[1]);
  const goldPerShare = G.splitPartyRewardAmount(totalGold, shareCount);
  for (const member of recipients) {
    const xp = G.adjustedKillExperience(xpPerShare, member.game.progress.level, enemy.level ?? 0);
    offlineGroupApplyMemberReward(member, xp, goldPerShare, enemy, now);
  }
}

function offlineGroupApplyMemberReward(member, xp, gold, enemy, now) {
  const leveledTo = offlineGroupApplyExperience(member, xp);
  member.inventory.gold += gold;
  member.game.progress.gold = member.inventory.gold;
  member.game.kills += 1;
  member.game.zoneKills += 1;
  member.game.lastReward = { xp, gold, drops: [] };
  member.game.recentLoot = [
    "+" + gold + " gold",
    ...leveledTo.map((level) => "Level " + level),
    ...member.game.recentLoot,
  ].slice(0, 6);
}

function offlineGroupApplyExperience(member, xp) {
  const levels = [];
  member.game.progress.experience += Math.max(0, Math.trunc(Number(xp) || 0));
  let nextLevelXp = G.xpForNextLevel(member.game.progress.level);
  while (Number.isFinite(nextLevelXp) && member.game.progress.experience >= nextLevelXp) {
    member.game.progress.experience -= nextLevelXp;
    member.game.progress.level += 1;
    member.level = member.game.progress.level;
    levels.push(member.level);
    const stats = G.characterSnapshotTotalStats(member.classId, {
      inventory: member.inventory,
      magic: member.magic,
      game: member.game,
      battle: {},
    });
    Object.assign(member, stats, { hp: stats.maxHp, mp: stats.maxMp });
    nextLevelXp = G.xpForNextLevel(member.game.progress.level);
  }
  return levels;
}

function offlineGroupAdvanceWave(waves, report, now, zone = groupDungeonWaveZone()) {
  if (!waves) return;
  const wavesPerFloor = groupDungeonWavesPerFloor(zone);
  waves.killedThisWave += 1;
  waves.spawnedThisWave = Math.max(waves.spawnedThisWave, waves.killedThisWave);
  if (waves.killedThisWave < waves.targetThisWave) return;
  report.wavesCleared += 1;
  if (!waves.endless && waves.waveNumber >= wavesPerFloor) {
    waves.endless = true;
    waves.floorComplete = false;
    waves.waveNumber = wavesPerFloor + 1;
  } else {
    waves.waveNumber += 1;
  }
  waves.targetThisWave = groupDungeonWaveSpawnCount(waves.waveNumber, zone);
  waves.killedThisWave = 0;
  waves.spawnedThisWave = 0;
  waves.spawningComplete = false;
  waves.betweenWaves = false;
  waves.nextSpawnAt = now;
}

function syncBossPartyInventoryCapacityFromState(classId = state.activeCharacterId) {
  syncBossPartyControlledInventoryFromState(classId);
}

function syncBossPartyControlledInventoryFromState(classId = bossPartyLeaderClassId()) {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  const leaderClassId = bossPartyLeaderClassId(party);
  const member = party.members.find((candidate) => candidate.classId === classId);
  if (!member || classId !== leaderClassId) return;
  if (G.normalizeCharacterId(state.activeCharacterId) !== leaderClassId) return;
  member.inventory = G.cloneInventoryState(state.inventory);
  member.hotbar = G.cloneHotbarState(state.hotbar);
  ensureBossPartyInventorySlots(member);
}

function syncBossPartyControlledInventoryToState(classId = bossPartyLeaderClassId()) {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  const leaderClassId = bossPartyLeaderClassId(party);
  const member = party.members.find((candidate) => candidate.classId === classId);
  if (!member || classId !== leaderClassId) return;
  state.inventory = G.cloneInventoryState(member.inventory);
  state.hotbar = G.cloneHotbarState(member.hotbar);
  state.magic = G.cloneMagicState(member.magic);
  state.game.progress.gold = member.inventory.gold;
  state.battle.gold = member.inventory.gold;
}

function syncBossPartyControlledMemberFromState(classId = bossPartyLeaderClassId()) {
  syncBossPartyControlledInventoryFromState(classId);
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  const leaderClassId = bossPartyLeaderClassId(party);
  const member = party.members.find((candidate) => candidate.classId === classId);
  if (!member || classId !== leaderClassId) return;
  if (G.normalizeCharacterId(state.activeCharacterId) !== leaderClassId) return;
  G.mergeBossPartyMemberSpellCooldowns(member, state.magic);
  member.magic = G.cloneMagicState(state.magic);
  syncBossPartyControlledRecoveryFromState(member);
}

function syncBossPartyControlledMemberToState(classId = bossPartyLeaderClassId()) {
  syncBossPartyControlledInventoryToState(classId);
  syncBossPartyControlledRecoveryToState(
    state.battle.bossParty?.members.find((candidate) => candidate.classId === classId) ?? null,
  );
}

function syncBossPartyControlledRecoveryFromState(member = bossPartyLeaderMember()) {
  if (!member || member.classId !== bossPartyLeaderClassId()) return;
  member.potHealthAmount = Math.max(0, Math.trunc(Number(state.battle.potHealthAmount) || 0));
  member.potManaAmount = Math.max(0, Math.trunc(Number(state.battle.potManaAmount) || 0));
  member.potTickAt = state.battle.potTickAt ?? 0;
  member.healAmount = Math.max(0, Math.trunc(Number(state.battle.healAmount) || 0));
  member.healTickAt = state.battle.healTickAt ?? 0;
  member.autoPotionReadyAt = {
    hp: state.battle.autoPotionReadyAt?.hp ?? 0,
    mp: state.battle.autoPotionReadyAt?.mp ?? 0,
  };
}

function syncBossPartyControlledRecoveryToState(member = bossPartyLeaderMember()) {
  if (!member || member.classId !== bossPartyLeaderClassId()) return;
  state.battle.potHealthAmount = Math.max(0, Math.trunc(Number(member.potHealthAmount) || 0));
  state.battle.potManaAmount = Math.max(0, Math.trunc(Number(member.potManaAmount) || 0));
  state.battle.potTickAt = member.potTickAt ?? 0;
  state.battle.healAmount = Math.max(0, Math.trunc(Number(member.healAmount) || 0));
  state.battle.healTickAt = member.healTickAt ?? 0;
  state.battle.autoPotionReadyAt = {
    hp: member.autoPotionReadyAt?.hp ?? 0,
    mp: member.autoPotionReadyAt?.mp ?? 0,
  };
}

function bossEmpowermentUnlocked() {
  return G.accountUpgradeTier("boss-empowerment") >= 1;
}

function bossPartyMembersStepToMelee(enemy = state.battle.enemy) {
  return G.enemyBossIsStationary(enemy);
}

function bossPartyConsumeAmuletInventoryUnits(member, count, shape = 0) {
  const needed = Math.max(1, Math.trunc(Number(count) || 1));
  for (let i = 0; i < needed; i += 1) {
    const entry = bossPartyCarriedInventoryEntries(member).find((candidate) => {
      const item = G.itemDefinition(candidate.itemId);
      return G.isTaoistAmuletItem(item) && Math.max(0, Math.trunc(Number(item.shape) || 0)) === shape;
    });
    if (!entry || !bossPartyConsumeOneInventoryUnit(member, entry.id)) return false;
  }
  return true;
}

function bossAssistOptionHtml(option) {
  const available = G.characterAvailableForBossAssist(option.classId);
  const selected = G.selectedBossAssistIds().has(option.classId);
  const disabled = available ? "" : "disabled";
  const status = !available
    ? option.classId === state.activeCharacterId ? "Current character" : "No character"
    : selected
    ? "Selected"
    : "Ready";
  return `
    <button type="button" class="boss-assist-button ${selected ? "selected" : ""}" ${disabled} data-boss-assist="${G.escapeHtml(option.classId)}">
      <span>${G.escapeHtml(option.label)}</span>
      <strong>${G.escapeHtml(status)}</strong>
    </button>
  `;
}

function bossEntrySceneHtml() {
  const zone = bossEntryZone();
  if (!zone) return `<p class="battle-state">Entry unavailable.</p>`;
  if (G.groupDungeonZone(zone)) return G.groupDungeonEntrySceneHtml(zone);
  const def = G.bossRoomDef(zone?.id);
  if (!def) return `<p class="battle-state">Boss room unavailable.</p>`;
  const boss = ENEMY_TEMPLATES.find((enemy) => zone.enemyIds.includes(enemy.id));
  const remainingMs = G.bossRespawnRemainingMs(zone.id);
  const respawning = remainingMs > 0;
  const selected = G.selectedBossAssistIds();
  const canFight = !respawning;
  const empowerUnlocked = bossEmpowermentUnlocked();
  const empowerSelected = Boolean(state.bossEmpowerSelected);
  return `
    <section class="boss-entry-panel">
      <p class="boss-warning">
        You're about to fight ${G.escapeHtml(def.bossName)}. Make sure you bring everything you need.
      </p>
      <p class="boss-warning muted">
        ${respawning
          ? `${G.escapeHtml(def.bossName)} is still recovering from the last defeat.`
          : `If you kill it, it will respawn again in ${G.formatBossRespawnDelay(def.respawnMinutes)}.`
        }
      </p>
      <dl class="boss-entry-stats">
        <dt>Boss</dt><dd>${G.escapeHtml(def.bossName)}</dd>
        <dt>Party</dt><dd>${1 + selected.size}</dd>
        <dt>HP</dt><dd>${boss?.maxHp ?? "-"}</dd>
        <dt>Defend with</dt><dd>${G.escapeHtml(G.enemyAttackDefenceGuidance(boss))}</dd>
      </dl>
      ${G.partyAssistPickerHtml()}
      <button type="button" class="boss-empower-button${empowerSelected ? " selected" : ""}" ${empowerUnlocked ? "data-toggle-boss-empower" : "disabled"}>
        <span>${G.escapeHtml(def.empowerLabel)}</span>
        <strong>${empowerUnlocked ? (empowerSelected ? "Enabled" : "Disabled") : "Locked"}</strong>
      </button>
      <p class="boss-entry-note">${empowerUnlocked
        ? "Toggle empowered mode before fighting for improved drops."
        : G.escapeHtml(def.empowerRequirement)
      }</p>
      <footer class="boss-entry-footer">
        <button
          type="button"
          class="primary boss-entry-fight-button${respawning ? " is-respawning" : ""}"
          ${canFight ? "" : "disabled"}
          data-confirm-boss-zone="${G.escapeHtml(zone.id)}"
          ${respawning ? 'aria-live="polite"' : ""}
        >
          ${respawning
            ? `<span>Respawns in</span><strong class="boss-entry-respawn-countdown">${G.escapeHtml(G.formatDuration(remainingMs))}</strong>`
            : `Fight ${G.escapeHtml(def.bossName)}`
          }
        </button>
      </footer>
    </section>
  `;
}

function bossEntryZone() {
  return G.partyEntryZone();
}

function bossPartyClassOrder(classIds) {
  const unique = [...new Set(classIds.map(normalizeCharacterId))];
  return BOSS_PARTY_ORDER.filter((classId) => unique.includes(classId));
}

function bossPartyIsMeleeClass(classId) {
  return classId === "Warrior" || classId === "Taoist";
}

function bossPartyMemberLineSlot(classId) {
  return BOSS_PARTY_MEMBER_LINE_SLOTS[G.normalizeCharacterId(classId)] ?? 0;
}

function bossPartyMemberLineWorldX(frontX, classId) {
  return Math.round(frontX - bossPartyMemberLineSlot(classId) * LANE_TILE_PX);
}

function bossPartyAliveMeleeMembers(party = state.battle.bossParty) {
  if (!party?.members?.length) return [];
  return bossPartyClassOrder(party.members.map((member) => member.classId))
    .filter((classId) => bossPartyIsMeleeClass(classId))
    .map((classId) => party.members.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .filter(Boolean);
}

function bossPartyMeleeFrontSlotWorldX(party = state.battle.bossParty) {
  const slot = Number(party?.meleeFrontSlotWorldX);
  return Number.isFinite(slot) ? Math.round(slot) : null;
}

function bossPartyMeleeFrontWorldX() {
  const slotX = bossPartyMeleeFrontSlotWorldX();
  if (Number.isFinite(slotX)) return slotX;
  const enemyX = Number(state.battle.enemyX) || 0;
  if (G.enemyUsesFixedArenaSpawn()) {
    return Math.round((enemyX || G.arenaBossSpawnWorldX()) - BOSS_PARTY_ENEMY_MELEE_GAP);
  }
  return Math.round(enemyX - BOSS_PARTY_ENEMY_MELEE_GAP);
}

function bossPartyMemberIsWalkingToMelee(member) {
  return member?.targetWorldX != null;
}

function bossPartyMemberSteppingToMelee(party = state.battle.bossParty) {
  return party?.members?.some((member) => member?.targetWorldX != null) ?? false;
}

function bossPartyMeleeFrontMember(party = state.battle.bossParty) {
  return bossPartyAliveMeleeMembers(party)[0] ?? null;
}

function bossPartyFinishMeleeAdvance(member, now) {
  member.targetWorldX = null;
  member.meleeAdvanceFromX = null;
  member.meleeAdvanceStartedAt = null;
  if (member.alive && member.hp > 0 && !member.visualOneShot) {
    member.visualAction = "stance";
    member.visualFrame = 0;
    member.visualLastTick = now;
  }
}

function updateBossPartyMeleeAdvance(now) {
  if (!bossPartyMembersStepToMelee()) return false;
  const party = state.battle.bossParty;
  if (!party?.members?.length) return false;
  let anyMoving = false;

  for (const member of party.members) {
    if (member?.targetWorldX == null) continue;
    const to = Math.round(member.targetWorldX);
    const from = Number(member.meleeAdvanceFromX);
    const origin = Number.isFinite(from) ? from : (Number(member.worldX) || 0);
    if (!Number.isFinite(from)) member.meleeAdvanceFromX = origin;
    const start = member.meleeAdvanceStartedAt ?? now;
    if (member.meleeAdvanceStartedAt == null) member.meleeAdvanceStartedAt = now;
    const durationMs = Math.max(1, (Math.abs(to - origin) / Math.max(1, LANE.playerSpeed)) * 1000);
    const t = Math.min(1, Math.max(0, (now - start) / durationMs));
    member.worldX = Math.round(origin + (to - origin) * t);

    if (t >= 1) {
      member.worldX = to;
      bossPartyFinishMeleeAdvance(member, now);
      anyMoving = true;
      continue;
    }

    if (member.alive && member.hp > 0 && !member.visualOneShot) {
      if (member.visualAction !== "walking") {
        member.visualFrame = 0;
        member.visualLastTick = now;
      }
      member.visualAction = "walking";
    }
    anyMoving = true;
  }

  if (anyMoving) {
    syncBossPartyPetPosition();
    bossPartySyncControlledPlayerRef();
  }
  return anyMoving;
}

function bossPartyInitMemberVisuals(member, now = performance.now()) {
  member.visualAction = member.alive ? "stance" : "die";
  member.visualFrame = 0;
  member.visualOneShot = false;
  member.visualLastTick = now;
  member.visualIndexes = bossPartyMemberVisualIndexes(member);
  member.visualAtlases = {};
}

function bossPartyEnemyApproachX(members = state.battle.bossParty?.members ?? []) {
  const ordered = bossPartyClassOrder(members.map((member) => member.classId));
  const frontClassId = ordered[0];
  const front = members.find((member) => member.classId === frontClassId) ?? members[0];
  return Math.round((front?.worldX ?? state.battle.playerX) + BOSS_PARTY_ENEMY_APPROACH_GAP);
}

function bossPartyMemberByClassId(classId) {
  return state.battle.bossParty?.members?.find(
    (member) => member.classId === classId && member.alive && member.hp > 0,
  ) ?? null;
}

function bossPartyFormationFrontWorldX() {
  const warrior = state.battle.bossParty?.members?.find((member) => member.classId === "Warrior");
  const warriorX = Number(warrior?.worldX);
  if (Number.isFinite(warriorX)) return warriorX;
  const frontMember = bossPartyMemberByClassId(bossPartyNextAliveMember()?.classId)
    ?? bossPartyNextAliveMember();
  const frontX = Number(frontMember?.worldX);
  if (!Number.isFinite(frontX)) return Number(state.battle.playerX) || 0;
  return frontX + bossPartyMemberLineSlot(frontMember.classId) * LANE_TILE_PX;
}

function bossPartyWarriorWorldX() {
  const warrior = state.battle.bossParty?.members?.find((member) => member.classId === "Warrior");
  const warriorX = Number(warrior?.worldX);
  if (Number.isFinite(warriorX)) return warriorX;
  const front = bossPartyNextAliveMember();
  return Number(front?.worldX ?? state.battle.playerX) || 0;
}

function bossPartyPetWorldX() {
  if (G.enemyUsesFixedArenaSpawn()) return G.fixedArenaPetWorldX();
  const base = bossPartyWarriorWorldX();
  return Math.round(base + BOSS_PARTY_PET_STAND_GAP);
}

function bossPartyShinsuPetWorldX() {
  const warrior = bossPartyMemberByClassId("Warrior");
  const taoist = bossPartyMemberByClassId("Taoist");
  if (warrior && taoist) {
    const warriorX = Number(warrior.worldX);
    const taoistX = Number(taoist.worldX);
    if (Number.isFinite(warriorX) && Number.isFinite(taoistX)) {
      return Math.round((warriorX + taoistX) / 2);
    }
  }
  return Math.round(bossPartyFormationFrontWorldX() - BOSS_PARTY_SHINSU_LINE_SLOT * LANE_TILE_PX);
}

function bossPartyPetWorldXFor(pet) {
  if (pet?.spellId === "SummonShinsu") return bossPartyShinsuPetWorldX();
  return bossPartyPetWorldX();
}

function syncBossPartyPetPosition() {
  const pet = state.battle.bossParty?.pet;
  if (!pet?.active || (pet.hp ?? 0) <= 0) return;
  pet.worldX = bossPartyPetWorldXFor(pet);
}

function bossPartyMemberEnemyDistance(member) {
  return Math.max(0, (Number(state.battle.enemyX) || 0) - (Number(member?.worldX) || 0));
}

function bossPartyAdvanceEnemy(now) {
  if (G.enemyBossIsStationary()) return;
  const party = state.battle.bossParty;
  if (!party) return;
  const enemy = state.battle.enemy;
  if (G.enemyFrozenActive(enemy, now)) {
    G.setEnemyLocomotion("standing", now);
    return;
  }
  const desired = bossPartyDesiredEnemyX();
  if (desired == null) return;
  const current = Number(state.battle.enemyX);
  if (!Number.isFinite(current)) {
    state.battle.enemyX = desired;
    party.lastAdvanceAt = now;
    return;
  }
  const dt = Math.min(120, Math.max(0, now - (party.lastAdvanceAt || now))) / 1000;
  party.lastAdvanceAt = now;
  if (current === desired) {
    G.setEnemyLocomotion("standing", now);
    return;
  }
  const closingGap = Math.abs(current - desired);
  const inWalkIn = closingGap > BOSS_PARTY_ENEMY_MELEE_GAP + 6;
  const speed = G.enemyAdvanceSpeed(enemy, inWalkIn ? BOSS_PARTY_BOSS_APPROACH_SPEED : LANE.enemySpeed, now);
  const step = Math.max(1, speed * dt);
  const delta = desired - current;
  if (Math.abs(delta) <= step) {
    state.battle.enemyX = desired;
    G.setEnemyLocomotion("standing", now);
  } else {
    state.battle.enemyX = Math.round(current + Math.sign(delta) * step);
    G.setEnemyLocomotion("walking", now);
  }
}

function bossPartyDesiredEnemyX() {
  const party = state.battle.bossParty;
  if (G.partyPetCanTank()) {
    const petX = Number(party?.pet?.worldX);
    if (Number.isFinite(petX)) return Math.round(petX + BOSS_PARTY_ENEMY_MELEE_GAP);
  }
  // Stationary bosses: party members step to a fixed front slot; the boss stays put.
  if (bossPartyMembersStepToMelee()) {
    const slotX = bossPartyMeleeFrontSlotWorldX(party);
    if (Number.isFinite(slotX)) return Math.round(slotX + BOSS_PARTY_ENEMY_MELEE_GAP);
  }
  // Mobile bosses: party holds formation; the boss walks to whoever is tanking.
  const target = bossPartyFrontTarget();
  const targetX = Number(target?.worldX);
  if (Number.isFinite(targetX)) return Math.round(targetX + BOSS_PARTY_ENEMY_MELEE_GAP);
  return null;
}

function bossPartyTargetEnemyDistance(target) {
  if (target === state.battle.bossParty?.pet) {
    return Math.max(0, (Number(state.battle.enemyX) || 0) - (Number(target?.worldX) || 0));
  }
  return bossPartyMemberEnemyDistance(target);
}

function bossPartyHasThrusting(member) {
  return member?.classId === "Warrior" && bossPartyAutoSpells(member).some((skill) => skill.id === "Thrusting");
}

function bossPartyMemberReach(member) {
  return bossPartyHasThrusting(member) ? BOSS_PARTY_THRUSTING_REACH : BOSS_PARTY_WARRIOR_REACH;
}

function bossPartyCanWeaponReach(member) {
  return bossPartyMemberEnemyDistance(member) <= bossPartyMemberReach(member);
}

function bossPartyCanMelee(member) {
  const front = bossPartyNextAliveMember();
  if (front && front.classId !== member.classId) return false;
  return bossPartyCanWeaponReach(member);
}

function bossPartyWait(member, now, delayMs = 250) {
  member.nextActionAt = now + delayMs;
  if (!member.visualOneShot && !bossPartyMemberIsWalkingToMelee(member)) {
    member.visualAction = "stance";
    member.visualFrame = 0;
    member.visualLastTick = now;
  }
  return false;
}

function bossPartySfxVolume(member, controlledVolume = 0.42, assistVolume = 0.14) {
  return member?.classId === bossPartyControlledClassId() ? controlledVolume : assistVolume;
}

function bossPartySfxParamsForClass(classId, volume, throttleMs = 80) {
  if (classId === bossPartyControlledClassId()) return { volume, throttleMs: 0, force: true };
  return { volume: volume * BOSS_PARTY_ASSIST_SFX_SCALE, throttleMs };
}

function bossPartySfxParams(member, volume, throttleMs = 80) {
  return bossPartySfxParamsForClass(member?.classId, volume, throttleMs);
}

function bossPartyCastSfx(member, spellId, volume, throttleMs) {
  return G.playSpellSfx(spellId, "cast", bossPartySfxParams(member, volume, throttleMs));
}

function bossPartyWeaponSfxFamily(member, kind = "swing") {
  const resolver = kind === "hit" ? weaponHitSfxFamilyForItem : weaponSwingSfxFamilyForItem;
  if (member?.classId === bossPartyControlledClassId()) {
    return kind === "hit" ? G.currentWeaponHitSfxFamily() : G.currentWeaponSwingSfxFamily();
  }
  const entryId = member?.inventory?.equipment?.weapon ?? null;
  const entry = entryId ? bossPartyInventoryEntryById(member, entryId) : null;
  return resolver(entry ? G.itemDefinition(entry.itemId) : null);
}

function bossPartyMemberFromCharacter(classId, character = G.createDefaultCharacterState(classId), nextActionAt = performance.now()) {
  const statBuffs = sanitizeStatBuffs(character.battle?.statBuffs);
  const stats = G.characterSnapshotTotalStats(classId, character, { includeBuffs: false });
  const inventory = G.cloneInventoryState(character.inventory);
  const hotbar = G.cloneHotbarState(character.hotbar);
  const magic = G.cloneMagicState(character.magic);
  const game = {
    ...character.game,
    progress: { ...character.game.progress },
    recentLoot: [...(character.game.recentLoot ?? [])],
    dropPity: { ...(character.game.dropPity ?? {}) },
    bossRespawns: { ...(character.game.bossRespawns ?? {}) },
    bossKills: { ...(character.game.bossKills ?? {}) },
  };
  return {
    ...PLAYER_TEMPLATE,
    ...stats,
    name: classId,
    class: classId,
    classId,
    level: Math.max(1, Math.trunc(Number(game.progress.level) || PLAYER_TEMPLATE.level)),
    experience: Math.max(0, Math.trunc(Number(game.progress.experience) || 0)),
    hp: stats.hp > 0 ? stats.hp : stats.maxHp,
    mp: stats.mp > 0 ? stats.mp : stats.maxMp,
    alive: true,
    inventory,
    hotbar,
    magic,
    game,
    nextActionAt,
    autoPotionReadyAt: { hp: 0, mp: 0 },
    potHealthAmount: Math.max(0, Math.trunc(Number(character.battle?.potHealthAmount) || 0)),
    potManaAmount: Math.max(0, Math.trunc(Number(character.battle?.potManaAmount) || 0)),
    potTickAt: 0,
    healAmount: Math.max(0, Math.trunc(Number(character.battle?.healAmount) || 0)),
    healTickAt: 0,
    furyUntil: 0,
    furyBonus: 0,
    flamingSwordReady: false,
    flamingSwordReadyAt: 0,
    flamingSwordExpiresAt: 0,
    twinDrakeReady: false,
    twinDrakeReadyAt: 0,
    twinDrakeChargeFxStartedAt: 0,
    twinDrakeChargeFxUntil: 0,
    slayingReady: false,
    slayingReadyAt: 0,
    wizardSpellLockUntil: 0,
    poisons: [],
    statBuffs: [...statBuffs],
  };
}

function bossPartyMemberVisualIndexes(member) {
  return Object.fromEntries(G.layerNames().map((layer) => [layer, bossPartyMemberVisualIndex(member, layer)]));
}

function bossPartyMemberVisualIndex(member, layer) {
  if (layer === "hair") return state.indexes.hair ?? 0;
  if (layer !== "weapon" && layer !== "armour") return state.indexes[layer] ?? null;
  const fallback = layer === "weapon" ? null : 0;
  const item = bossPartyMemberEquippedVisualItem(member, layer);
  const index = item?.visual?.index ?? fallback;
  if (index == null) return fallback;
  return state.catalogue?.layers?.[layer]?.indexes?.includes(index) ? index : fallback;
}

function bossPartyMemberEquippedVisualItem(member, layer) {
  const equipment = member?.inventory?.equipment ?? {};
  for (const entryId of Object.values(equipment)) {
    if (!entryId) continue;
    const entry = bossPartyInventoryEntryById(member, entryId);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (item?.visual?.layer === layer) return item;
  }
  return null;
}

function updateBossPartyVisualFrames(now) {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  for (const member of party.members) updateBossPartyMemberVisualFrame(member, now);
}

function updateBossPartyMemberVisualFrame(member, now) {
  const action = member.visualAction ?? (member.alive ? "stance" : "die");
  const clip = bossPartyMemberVisualClip(member, action);
  if (state.paused || !clip?.frames?.length) return;
  const dt = now - (member.visualLastTick ?? now);
  if (dt < clip.interval) return;
  const steps = Math.floor(dt / clip.interval);
  const nextFrame = (member.visualFrame ?? 0) + steps;
  const terminal = member.visualOneShot || action === "struck" || action === "die";
  if (terminal) {
    if (nextFrame >= clip.frames.length) {
      if (member.alive && member.hp > 0) {
        member.visualAction = bossPartyMemberIsWalkingToMelee(member) ? "walking" : "stance";
        member.visualFrame = 0;
        member.visualOneShot = false;
        if (member.classId === "Warrior") member.fxSpellId = null;
        member.visualLastTick = now;
        return;
      }
      member.visualFrame = clip.frames.length - 1;
    } else {
      member.visualFrame = nextFrame;
    }
  } else {
    member.visualFrame = nextFrame % clip.frames.length;
  }
  member.visualLastTick = (member.visualLastTick ?? now) + steps * clip.interval;
}

function bossPartyMemberVisualClip(member, action = member?.visualAction) {
  for (const layer of G.layerNames()) {
    const atlas = member?.visualAtlases?.[layer] ?? (member?.classId === bossPartyControlledClassId() ? state.atlases[layer] : null);
    const clip = atlas?.actions?.[action];
    if (clip?.frames?.length) return clip;
  }
  return null;
}

function updateBossPartyBattle(now) {
  const party = state.battle.bossParty;
  if (!party?.active) return false;
  if (G.groupDungeonSwarmActive()) return G.updateGroupDungeonBossPartyBattle(now);
  const enemy = state.battle.enemy;
  if (!enemy) return false;
  bossPartySyncControlledPlayerRef();
  updateBossPartyVisualFrames(now);
  updateBossPartyMeleeAdvance(now);
  for (const member of party.members) {
    updateBossPartyMemberPotionRegen(member, now);
    updateBossPartyMemberHealRegen(member, now);
    bossPartyAutoUsePotions(member, now);
  }
  if (party.pet) updateBossPartyMemberHealRegen(party.pet, now);
  syncBossPartyControlledRecoveryToState();
  G.updateEnemyPoisons(now);
  updateBossPartyPendingPoison(now);
  G.updateGroundSpellEffects(now);
  G.updateMapLightning(now);
  updateBossPartyEffects(now);
  updateBossPartyImpacts(now);
  updateBossPartyHealFx(now);
  G.updateDefenceBuffFx(now);
  G.updatePendingTwinDrakeHits(now);
  G.updateAttachedSpellFx(now);
  G.updatePendingEnemyStrike(now);
  G.updatePendingPetAttack(now);
  G.updateCombatantPoisons(now);
  G.updateWarriorChargeExpiry(now);
  if (enemy.hp <= 0) {
    G.finishBossPartyEnemy(now);
    return true;
  }
  if (bossPartyAllMembersDead()) {
    G.finishBossPartyDefeat(now);
    return true;
  }

  if (party.pet?.active && now >= (party.pet.nextAttackAt ?? 0)) bossPartyPetAttack(now);
  for (const member of party.members) {
    if (!member.alive || member.hp <= 0 || now < (member.nextActionAt ?? 0)) continue;
    if (bossPartyMemberIsWalkingToMelee(member)) continue;
    bossPartyMemberAction(member, now);
    if (enemy.hp <= 0) {
      G.finishBossPartyEnemy(now);
      return true;
    }
  }

  if (!G.enemyFrozenActive(enemy, now) && now >= (state.battle.nextEnemyAttackAt ?? 0) && bossPartyEnemyAttack(now)) {
    state.battle.nextEnemyAttackAt = now + G.effectiveEnemyAttackMs(enemy, now);
  }
  updateBossPartyMeleeAdvance(now);
  bossPartyAdvanceEnemy(now);
  bossPartySyncControlledPlayerRef();
  if (!G.isPlayerOneShotAction()) G.setPlayerLocomotion("stance", now);
  return true;
}

function updateBossPartyAftermath(now) {
  const party = state.battle.bossParty;
  if (!party?.finished || !state.battle.enemy) return false;
  bossPartySyncControlledPlayerRef();
  for (const member of party.members) updateBossPartyMemberRestState(member, now);
  updateBossPartyVisualFrames(now);
  return true;
}

function bossPartyMemberAction(member, now) {
  if (G.combatantParalyzed(member)) return bossPartyWait(member, now, 250);
  if (member.classId === "Wizard") return bossPartyWizardAction(member, now);
  if (member.classId === "Taoist") return bossPartyTaoistAction(member, now);
  return bossPartyWarriorAction(member, now);
}

function bossPartyChargeWarriorSkill(member, skill, learned, now) {
  const cost = spellMpCost(skill, learned);
  member.mp -= cost;
  bossPartySetWarriorSpellCastReadyAt(member, skill, learned, now);
  if (skill.id === "FlamingSword") {
    G.applyFlamingSwordChargeState(member, now);
    if (member.classId === bossPartyControlledClassId()) G.applyFlamingSwordChargeState(state.battle, now);
  } else if (skill.id === "TwinDrakeBlade") {
    G.applyTwinDrakeChargeState(member, now);
    if (member.classId === bossPartyControlledClassId()) G.applyTwinDrakeChargeState(state.battle, now);
  }
  sceneSignature = "";
  G.pushBattleLog(`${member.classId} readies ${skill.label}.`);
}

function bossPartyMaybeAutoChargeWarriorSkill(member, now) {
  if (G.warriorSlayingPending(member)) return false;
  for (const spellId of WARRIOR_AUTO_CHARGE_ORDER) {
    if (spellId === "FlamingSword" && member.flamingSwordReady) continue;
    if (spellId === "TwinDrakeBlade" && member.twinDrakeReady) continue;
    const skill = warriorSpellById(spellId);
    const learned = bossPartyLearned(member, spellId);
    if (!skill || !learned?.autoCast) continue;
    if (!bossPartyCanUseWarriorSkill(member, skill, learned, now, { requireAuto: true })) continue;
    bossPartyChargeWarriorSkill(member, skill, learned, now);
    return true;
  }
  return false;
}

function bossPartyChargeTwinDrake(member, skill, learned, now) {
  bossPartyChargeWarriorSkill(member, skill, learned, now);
}

function bossPartyWarriorAction(member, now) {
  const enemy = state.battle.enemy;
  const queuedWarrior = bossPartyQueuedWarriorSkill(member, now);

  if (queuedWarrior && !queuedWarrior.queuedWaiting && queuedWarrior.skill.buff) {
    const { skill, learned, cost } = queuedWarrior;
    member.mp -= cost;
    learned.castReadyAt = now + spellDelayMs(skill, learned);
    member.furyUntil = now + 60000 + (Number(learned.level) || 0) * 10000;
    member.furyBonus = 4;
    member.nextActionAt = now + CRYSTAL_PLAYER_ACTION_LOCK_MS;
    G.clearQueuedCombatSpell(skill.id);
    bossPartyControlledVisual(member, skill, "spell", now);
    bossPartyCastSfx(member, skill.id, 0.42, 160);
    bossPartyLevelMagicSkill(member, skill, learned, now);
    G.pushBattleLog(`${member.classId} casts ${skill.label}.`);
    return true;
  }

  const autoSkills = bossPartyAutoSpells(member);
  const fury = autoSkills.find((skill) => skill.id === "Fury");
  const furyLearned = bossPartyLearned(member, "Fury");
  if (fury && furyLearned && now >= (furyLearned.castReadyAt ?? 0) && now >= (member.furyUntil ?? 0) && member.mp >= spellMpCost(fury, furyLearned)) {
    member.mp -= spellMpCost(fury, furyLearned);
    furyLearned.castReadyAt = now + spellDelayMs(fury, furyLearned);
    member.furyUntil = now + 60000 + (Number(furyLearned.level) || 0) * 10000;
    member.furyBonus = 4;
    member.nextActionAt = now + CRYSTAL_PLAYER_ACTION_LOCK_MS;
    bossPartyControlledVisual(member, fury, "spell", now);
    bossPartyCastSfx(member, fury.id, 0.42, 160);
    bossPartyLevelMagicSkill(member, fury, furyLearned, now);
    G.pushBattleLog(`${member.classId} casts ${fury.label}.`);
    return true;
  }

  // Out of reach (boss still closing the gap, or a pet is tanking and the
  // Warrior lacks Thrusting): hold position rather than swinging at air.
  if (!bossPartyCanWeaponReach(member)) return bossPartyWait(member, now);

  const distance = bossPartyMemberEnemyDistance(member);
  const thrusting = autoSkills.find((skill) => skill.id === "Thrusting");
  const thrustingLearned = bossPartyLearned(member, "Thrusting");
  const useThrusting = Boolean(thrusting && thrustingLearned
    && distance > BOSS_PARTY_WARRIOR_REACH && distance <= BOSS_PARTY_THRUSTING_REACH);
  const halfMoon = autoSkills.find((skill) => skill.id === "HalfMoon");
  const halfMoonLearned = bossPartyLearned(member, "HalfMoon");
  const useHalfMoon = Boolean(halfMoon && halfMoonLearned
    && !useThrusting
    && G.canUseHalfMoonAttack(distance, member.mp ?? 0, halfMoonLearned));
  let attackSkill = null;
  let learned = null;
  let cost = 0;
  let usingFlamingSword = false;
  let usingTwinDrake = false;
  let usingSlaying = false;
  let usingHalfMoon = false;

  if (G.warriorSlayingPending(member) && bossPartyLearned(member, "Slaying")) {
    attackSkill = warriorSpellById("Slaying");
    learned = bossPartyLearned(member, "Slaying");
    cost = 0;
    usingSlaying = Boolean(attackSkill);
  } else if (queuedWarrior && !queuedWarrior.queuedWaiting && !queuedWarrior.skill.buff) {
    attackSkill = queuedWarrior.skill;
    learned = queuedWarrior.learned;
    cost = queuedWarrior.cost;
    if (attackSkill.id === "Thrusting" && !useThrusting) {
      attackSkill = null;
      learned = null;
      cost = 0;
    }
    if (attackSkill.id === "HalfMoon" && !useHalfMoon) {
      attackSkill = null;
      learned = null;
      cost = 0;
    }
  }
  if (!attackSkill && !usingSlaying) {
    attackSkill = useThrusting
      ? thrusting
      : useHalfMoon
        ? halfMoon
        : autoSkills.find((skill) => {
        if (G.isWarriorChargeSkill(skill) && !G.warriorMemberChargeReady(member, skill.id)) return false;
        const skillLearned = bossPartyLearned(member, skill.id);
        return !skill.buff && !skill.toggle
          && !bossPartySpellOnCooldown(member, skill, skillLearned, now)
          && member.mp >= spellMpCost(skill, skillLearned);
      });
  }
  if (!usingSlaying) {
    if (member.flamingSwordReady) {
      const flaming = warriorSpellById("FlamingSword");
      const flamingLearned = bossPartyLearned(member, "FlamingSword");
      if (flaming && flamingLearned) {
        attackSkill = flaming;
        learned = flamingLearned;
        cost = 0;
        usingFlamingSword = true;
      } else {
        G.clearFlamingSwordChargeState(member);
        if (member.classId === bossPartyControlledClassId()) G.clearFlamingSwordChargeState(state.battle);
      }
    } else if (member.twinDrakeReady) {
      const twinDrake = warriorSpellById("TwinDrakeBlade");
      const twinDrakeLearned = bossPartyLearned(member, "TwinDrakeBlade");
      if (twinDrake && twinDrakeLearned && member.mp >= spellMpCost(twinDrake, twinDrakeLearned)) {
        attackSkill = twinDrake;
        learned = twinDrakeLearned;
        cost = spellMpCost(twinDrake, twinDrakeLearned);
        usingTwinDrake = true;
      } else {
        G.clearTwinDrakeChargeState(member);
        if (member.classId === bossPartyControlledClassId()) G.clearTwinDrakeChargeState(state.battle);
      }
    }
  }
  if (!attackSkill && !usingSlaying) {
    if (!learned) learned = null;
  } else if (!learned && attackSkill) {
    learned = bossPartyLearned(member, attackSkill.id);
  }
  if (!cost && attackSkill && learned) cost = spellMpCost(attackSkill, learned);
  if (usingSlaying) {
    G.clearWarriorSlayingReady(member);
  } else if (usingFlamingSword) {
    G.clearFlamingSwordChargeState(member);
    if (member.classId === bossPartyControlledClassId()) G.clearFlamingSwordChargeState(state.battle);
    bossPartySetWarriorSpellCastReadyAt(member, attackSkill, learned, now);
  } else if (usingTwinDrake) {
    G.clearTwinDrakeChargeState(member);
    if (member.classId === bossPartyControlledClassId()) G.clearTwinDrakeChargeState(state.battle);
    member.mp -= cost;
    bossPartySetWarriorSpellCastReadyAt(member, attackSkill, learned, now);
  } else if (learned) {
    member.mp -= cost;
    if (!attackSkill.toggle) bossPartySetWarriorSpellCastReadyAt(member, attackSkill, learned, now);
  }
  usingHalfMoon = G.isHalfMoonAttackSkill(attackSkill);
  if (queuedWarrior?.queued && attackSkill && learned && attackSkill.id === queuedWarrior.skill.id) {
    G.clearQueuedCombatSpell(attackSkill.id);
  }
  member.nextActionAt = now + (usingTwinDrake
    ? twinDrakeAttackDelayMs(bossPartyEffectiveAttackSpeed(member, now), member.level)
    : attackDelayMs(bossPartyEffectiveAttackSpeed(member, now), member.level));
  bossPartyControlledVisual(member, attackSkill, attackSkill?.bodyAction ?? BASIC_ATTACK_SKILL.bodyAction, now);
  bossPartyWarriorSwingSfx(member, learned ? attackSkill : null);
  let twinDrakeRawDamage = 0;
  bossPartyAttackEnemy(member, learned ? attackSkill.label : "Attack", () => {
    twinDrakeRawDamage = usingHalfMoon
      ? rollDamage(G.effectiveCombatStats(member).dc, G.enemyPhysicalDefence(enemy), member.luck)
      : learned
        ? G.rollWarriorMagicDamage(attackSkill, learned, member, enemy)
        : rollDamage(G.effectiveCombatStats(member).dc, G.enemyPhysicalDefence(enemy), member.luck);
    return twinDrakeRawDamage;
  }, "physical", now, () => {
    if (learned) bossPartyLevelMagicSkill(member, attackSkill, learned, now);
    bossPartyLevelPassiveWeaponMagic(member, now);
    if (usingTwinDrake && enemy.hp > 0) G.queueTwinDrakeSecondHit(member, learned, twinDrakeRawDamage, now);
    if (usingHalfMoon && learned) bossPartyHalfMoonSplash(member, attackSkill, learned, enemy, now);
  }, learned ? attackSkill : null);
  bossPartyRollSlayingCharge(member, now);
  if (!G.warriorSlayingPending(member)) bossPartyMaybeAutoChargeWarriorSkill(member, now);
  return true;
}

function bossPartyWarriorSwingSfx(member, skill) {
  if (skill && skill.id !== BASIC_ATTACK_SKILL.id) {
    const params = bossPartySfxParams(member, 0.58, 90);
    if (G.playWarriorSpellSwingSfx(skill, params)) return;
    return;
  }
  G.playWeaponSwingSfx({ ...bossPartySfxParams(member, 0.52, 90), family: bossPartyWeaponSfxFamily(member, "swing") });
}

function bossPartyRollSlayingCharge(member, now) {
  if (!member || member.classId !== "Warrior" || G.warriorSlayingPending(member)) return;
  const learned = bossPartyLearned(member, "Slaying");
  if (!learned) return;
  const level = Math.max(0, Math.min(3, Number(learned.level) || 0));
  if (randomInt(0, 11) > level) return;
  G.setWarriorSlayingReady(now, member);
  if (member.classId === bossPartyControlledClassId()) G.pushBattleLog("Slaying readied for the next attack.");
}

function bossPartyQueuedWarriorSkill(member, now) {
  if (member.classId !== bossPartyControlledClassId()) return null;
  const queued = G.queuedCombatSpell("Warrior");
  if (!queued) return null;
  const { spell: skill, learned, cost } = queued;
  if (!bossPartyCanUseWarriorSkill(member, skill, learned, now, { requireAuto: false })) {
    return { skill: BASIC_ATTACK_SKILL, learned: null, cost: 0, queuedWaiting: true };
  }
  return { skill, learned, cost, queued: true };
}

function bossPartyQueuedWizardSpell(member, now) {
  if (member.classId !== bossPartyControlledClassId()) return null;
  const queued = G.queuedCombatSpell("Wizard");
  if (!queued) return null;
  const { spell, learned, cost } = queued;
  return {
    spell,
    learned,
    cost,
    cooldownWaiting: (learned.castReadyAt ?? 0) > now || G.wizardCastLocked(now, member),
  };
}

function bossPartyWizardAction(member, now) {
  const enemy = state.battle.enemy;
  const queuedDefence = bossPartyUsableQueuedWizardDefenceBuff(member, now);
  if (queuedDefence && bossPartyCastWizardDefenceBuff(member, queuedDefence, now)) return true;
  const magicShield = bossPartyUsableWizardDefenceBuff(member, now);
  if (magicShield && bossPartyCastWizardDefenceBuff(member, magicShield, now)) return true;
  const spells = bossPartyWizardAttackSpells(member);
  const queuedWizard = bossPartyQueuedWizardSpell(member, now);
  if (queuedWizard?.cooldownWaiting) return bossPartyWeaponAttack(member, now);
  const queuedSpell = queuedWizard?.spell
    && queuedWizard.spell.id !== "MagicShield"
    && !(queuedWizard.spell.id === "FireWall" && bossPartyGroundEffectActive("FireWall", now))
    ? queuedWizard.spell
    : null;
  if (queuedWizard && !queuedSpell) return bossPartyWeaponAttack(member, now);
  const spell = queuedSpell ?? spells.find((candidate) => {
    const learned = bossPartyLearned(member, candidate.id);
    if (!G.canWizardCastSpell(candidate, learned, now, member)) return false;
    if (candidate.id === "FireWall") return !bossPartyGroundEffectActive("FireWall", now);
    return true;
  });
  if (!spell) return bossPartyWeaponAttack(member, now);
  const learned = bossPartyLearned(member, spell.id);
  const cost = spellMpCost(spell, learned);
  member.mp -= cost;
  G.applyWizardCastCooldown(spell, learned, now, member);
  G.clearQueuedCombatSpell(spell.id);
  bossPartyControlledVisual(member, spell, spell.bodyAction ?? "spell", now);
  if (spell.impactMode !== "target") bossPartyCastSfx(member, spell.id, 0.5, 120);

  if (spell.id === "FireWall") {
    const value = G.rollWizardMagicValue(spell, learned, member);
    G.createWizardGroundSpellEffect(spell, { value, worldX: state.battle.enemyX }, now, member, learned);
    G.pushBattleLog(`${member.classId} casts ${spell.label} under ${enemy.name}.`);
    return true;
  }
  if (spell.impactMode === "buff") return true;

  if (spell.impactMode === "projectile") G.playSpellSfx(spell.id, "fly", bossPartySfxParams(member, 0.38, 120));
  bossPartyQueueImpact(member, spell, spell.label, state.wizardSpellAtlases[spell.id] ?? null, now, () => (
    G.rollWizardMagicDamage(spell, learned, member, enemy)
  ));
  return true;
}

function bossPartyTaoistAction(member, now) {
  if (member.classId === bossPartyControlledClassId()) {
    const queuedRequest = G.queuedCombatSpell("Taoist");
    const queued = bossPartyUsableQueuedTaoistSpell(member, now);
    if (queued && bossPartyCastQueuedTaoistSpell(member, queued, now)) return true;
    if (queuedRequest) return bossPartyWeaponAttack(member, now);
  }

  const spells = bossPartyAutoSpells(member);
  const healing = spells.find((spell) => spell.id === "Healing");
  const healTarget = healing ? bossPartyHealTarget() : null;
  if (healTarget && bossPartyCanCast(member, healing, now)) {
    const learned = bossPartyLearned(member, healing.id);
    const amount = G.rollTaoistHealingAmount(healing, learned, member);
    member.mp -= spellMpCost(healing, learned);
    learned.castReadyAt = now + spellDelayMs(healing, learned);
    member.nextActionAt = now + spellDelayMs(healing, learned);
    healTarget.healAmount = Math.min(65535, (healTarget.healAmount ?? 0) + amount);
    healTarget.healTickAt = healTarget.healTickAt || now + CRYSTAL_HEAL_DELAY_MS;
    bossPartyControlledVisual(member, healing, healing.bodyAction ?? "spell", now);
    bossPartyCastSfx(member, healing.id, 0.38, 160);
    bossPartyQueueHealFx(member, healTarget, healing, now);
    bossPartyLevelMagicSkill(member, healing, learned, now);
    G.pushBattleLog(`${member.classId} casts ${healing.label} on ${healTarget.name}.`);
    return true;
  }

  const summon = spells.find((spell) => spell.id === "SummonSkeleton");
  if (summon && !bossPartyActivePet() && !state.battle.bossParty.petDiedThisFight && bossPartyCanCast(member, summon, now)) {
    const amuletCost = G.taoistSummonAmuletCost(summon.id);
    if (bossPartyAmuletInventoryCount(member) >= amuletCost && bossPartyConsumeAmuletInventoryUnits(member, amuletCost)) {
      const learned = bossPartyLearned(member, summon.id);
      member.mp -= spellMpCost(summon, learned);
      learned.castReadyAt = now + spellDelayMs(summon, learned);
      member.nextActionAt = now + spellDelayMs(summon, learned);
      state.battle.bossParty.pet = G.createTaoistSummonPet(summon.id, Math.max(0, Number(learned.level) || 0), now);
      state.battle.bossParty.pet.name = `${member.classId}'s ${state.battle.bossParty.pet.name}`;
      state.battle.taoPet = state.battle.bossParty.pet;
      state.taoPetAtlas = G.taoPetAtlasFor(state.battle.taoPet);
      bossPartyControlledVisual(member, summon, summon.bodyAction ?? "spell", now);
      bossPartyCastSfx(member, summon.id, 0.38, 160);
      bossPartyLevelMagicSkill(member, summon, learned, now);
      G.playTaoPetAppearSfx({ volume: bossPartySfxVolume(member, 0.4, 0.18), throttleMs: 250, pet: state.battle.taoPet });
      G.pushBattleLog(`${member.classId} summons ${state.battle.bossParty.pet.name}.`);
      return true;
    }
  }

  const shinsu = spells.find((spell) => spell.id === "SummonShinsu");
  if (shinsu && !bossPartyActivePet() && !state.battle.bossParty.petDiedThisFight && bossPartyCanCast(member, shinsu, now)) {
    const amuletCost = G.taoistSummonAmuletCost(shinsu.id);
    if (bossPartyAmuletInventoryCount(member) >= amuletCost && bossPartyConsumeAmuletInventoryUnits(member, amuletCost)) {
      const learned = bossPartyLearned(member, shinsu.id);
      member.mp -= spellMpCost(shinsu, learned);
      learned.castReadyAt = now + spellDelayMs(shinsu, learned);
      member.nextActionAt = now + spellDelayMs(shinsu, learned);
      state.battle.bossParty.pet = G.createTaoistSummonPet(shinsu.id, Math.max(0, Number(learned.level) || 0), now);
      state.battle.bossParty.pet.name = `${member.classId}'s ${state.battle.bossParty.pet.name}`;
      state.battle.taoPet = state.battle.bossParty.pet;
      state.taoPetAtlas = G.taoPetAtlasFor(state.battle.taoPet);
      bossPartyControlledVisual(member, shinsu, shinsu.bodyAction ?? "spell", now);
      bossPartyCastSfx(member, shinsu.id, 0.38, 160);
      bossPartyLevelMagicSkill(member, shinsu, learned, now);
      G.playTaoPetAppearSfx({ volume: bossPartySfxVolume(member, 0.4, 0.18), throttleMs: 250, pet: state.battle.taoPet });
      G.pushBattleLog(`${member.classId} summons ${state.battle.bossParty.pet.name}.`);
      return true;
    }
  }

  for (const spellId of ["SoulShield", "BlessedArmour"]) {
    const defenceBuff = bossPartyUsableTaoistDefenceBuff(member, spellId, now);
    if (defenceBuff && bossPartyCastDefenceBuff(member, defenceBuff, now)) return true;
  }

  const ultimateEnhancer = bossPartyUsableTaoistUltimateEnhancer(member, now);
  if (ultimateEnhancer && bossPartyCastUltimateEnhancer(member, ultimateEnhancer, now)) return true;

  const poison = spells.find((spell) => spell.id === "Poisoning");
  if (poison && !state.battle.bossParty.pendingPoison && bossPartyCanCast(member, poison, now)) {
    const entry = bossPartyPoisonCandidate(member, state.battle.enemy, now);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (entry && item && bossPartyConsumeOneInventoryUnit(member, entry.id)) {
      const learned = bossPartyLearned(member, poison.id);
      member.mp -= spellMpCost(poison, learned);
      learned.castReadyAt = now + spellDelayMs(poison, learned);
      member.nextActionAt = now + spellDelayMs(poison, learned);
      bossPartyQueuePoisonApply(member, poison, learned, item, now);
      return true;
    }
  }

  const soulFireBall = spells.find((spell) => spell.id === "SoulFireBall");
  if (soulFireBall && bossPartyCanCast(member, soulFireBall, now)) {
    const amulet = bossPartyAmuletCandidate(member);
    if (amulet && bossPartyConsumeOneInventoryUnit(member, amulet.id)) {
      const learned = bossPartyLearned(member, soulFireBall.id);
      member.mp -= spellMpCost(soulFireBall, learned);
      learned.castReadyAt = now + spellDelayMs(soulFireBall, learned);
      member.nextActionAt = now + spellDelayMs(soulFireBall, learned);
      bossPartyControlledVisual(member, soulFireBall, soulFireBall.bodyAction ?? "spell", now);
      bossPartyCastSfx(member, soulFireBall.id, 0.38, 160);
      G.playSpellSfx(soulFireBall.id, "fly", bossPartySfxParams(member, 0.38, 120));
      bossPartyQueueImpact(member, soulFireBall, soulFireBall.label, state.taoistSpellAtlases[soulFireBall.id] ?? null, now, () => (
        G.rollTaoistMagicDamage(soulFireBall, learned, member, state.battle.enemy)
      ));
      return true;
    }
  }

  return bossPartyWeaponAttack(member, now);
}

function bossPartyAttackEnemy(member, label, rollDamageFn, kind, now, onHit, skill) {
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0 || !state.battle.enemyRevealed) return false;
  if (kind === "physical" && !G.rollHit(member.accuracy, enemy.agility)) {
    bossPartyShowEnemyMiss(member.classId, now);
    G.pushBattleLog(`${member.classId} ${label.toLowerCase()} misses ${enemy.name}.`);
    return true;
  }
  const damage = G.scaleEnemyPhysicalDamage(rollDamageFn(), enemy, now);
  if (damage <= 0) {
    bossPartyShowEnemyMiss(member.classId, now);
    G.pushBattleLog(`${member.classId} ${label.toLowerCase()} misses ${enemy.name}.`);
    return true;
  }
  G.reduceEnemyHp(enemy, damage);
  G.syncBattleEnemyHpToSwarm();
  G.strikeGroupDungeonSwarmEnemy(enemy, now);
  G.playMonsterSfx("flinch", enemy, bossPartySfxParams(member, 0.42, 80));
  if (kind === "physical") {
    // A weapon skill (Slaying/Thrusting/etc.) plays its own impact sound, falling
    // back to the weapon hit; a plain swing just plays the weapon hit (mirrors solo).
    const skillImpact = skill && skill.id !== BASIC_ATTACK_SKILL.id
      && G.playSpellSfx(skill.id, "impact", bossPartySfxParams(member, 0.5, 80));
    if (!skillImpact) G.playWeaponHitSfx({ ...bossPartySfxParams(member, 0.5, 90), family: bossPartyWeaponSfxFamily(member, "hit") });
  }
  bossPartyShowEnemyDamage(member.classId, damage, now);
  G.pushBattleLog(`${member.classId} ${label} hits ${enemy.name} for ${damage}.`);
  if (typeof onHit === "function") onHit(damage);
  G.maybeKillGroupDungeonSwarmEnemy(enemy, now);
  return true;
}

function bossPartyWeaponAttack(member, now) {
  if (!bossPartyCanMelee(member)) return bossPartyWait(member, now);
  member.nextActionAt = now + attackDelayMs(bossPartyEffectiveAttackSpeed(member, now), member.level);
  bossPartyControlledVisual(member, BASIC_ATTACK_SKILL, BASIC_ATTACK_SKILL.bodyAction, now);
  G.playWeaponSwingSfx({ ...bossPartySfxParams(member, 0.52, 90), family: bossPartyWeaponSfxFamily(member, "swing") });
  return bossPartyAttackEnemy(member, "Attack", () => rollDamage(G.effectiveCombatStats(member).dc, G.enemyPhysicalDefence(state.battle.enemy), member.luck), "physical", now, () => bossPartyLevelPassiveWeaponMagic(member, now));
}

function bossPartyControlledVisual(member, skill, bodyAction, now) {
  member.visualAction = bodyAction ?? "attack1";
  member.visualFrame = 0;
  member.visualOneShot = true;
  member.visualLastTick = now;
  // Track per-member spell FX so assist members render their own overlays at their
  // position. The controlled member is drawn via the battle.active* path.
  if (member.classId === "Wizard" || member.classId === "Taoist") {
    member.fxSpellId = skill?.id ?? null;
    member.fxStartedAt = now;
  } else if (member.classId === "Warrior" && skill?.id && skill.id !== BASIC_ATTACK_SKILL.id) {
    member.fxSpellId = skill.id;
    member.fxStartedAt = now;
  }
  if (member.classId !== bossPartyControlledClassId()) return;
  state.battle.activeSkill = member.classId === "Warrior" ? (skill?.id ?? "None") : "None";
  state.battle.activeSkillAtlas = member.classId === "Warrior" ? (state.warriorSkillAtlases[skill?.id] ?? null) : null;
  state.battle.activeSkillStartedAt = now;
  state.battle.activeWizardSpell = member.classId === "Wizard" ? skill?.id ?? null : null;
  state.battle.activeWizardSpellAtlas = member.classId === "Wizard" ? (state.wizardSpellAtlases[skill?.id] ?? null) : null;
  state.battle.activeWizardSpellStartedAt = now;
  state.battle.activeTaoSpell = member.classId === "Taoist" ? skill?.id ?? null : null;
  state.battle.activeTaoSpellAtlas = member.classId === "Taoist" ? (state.taoistSpellAtlases[skill?.id] ?? null) : null;
  state.battle.activeTaoSpellStartedAt = now;
  G.setPlayerAction(bodyAction ?? "attack1", now, true);
}

function bossPartyCanCast(member, spell, now) {
  const learned = bossPartyLearned(member, spell?.id);
  if (!spell || !learned || spell.passive) return false;
  if (member.classId === "Wizard") return G.canWizardCastSpell(spell, learned, now, member);
  if ((learned.castReadyAt ?? 0) > now) return false;
  return member.mp >= spellMpCost(spell, learned);
}

function bossPartyCanUseWarriorSkill(member, skill, learned, now, options = {}) {
  if (!skill || !learned || skill.passive) return false;
  if (options.requireAuto && !learned.autoCast) return false;
  if (G.isWarriorChargeSkill(skill) && G.warriorMemberChargeReady(member, skill.id)) return false;
  const distance = bossPartyMemberEnemyDistance(member);
  if (skill.toggle) {
    if (skill.id === "Thrusting") {
      return distance > BOSS_PARTY_WARRIOR_REACH && distance <= BOSS_PARTY_THRUSTING_REACH;
    }
    if (skill.id === "HalfMoon") {
      const learned = bossPartyLearned(member, skill.id);
      return G.canUseHalfMoonAttack(distance, member.mp ?? 0, learned);
    }
    return false;
  }
  const chargeCast = G.isWarriorChargeSkill(skill) && !G.warriorMemberChargeReady(member, skill.id);
  if (!skill.buff && !chargeCast && distance > bossPartyMemberReach(member)) return false;
  if (skill.id === "Fury" && now < (member.furyUntil ?? 0)) return false;
  if (bossPartySpellOnCooldown(member, skill, learned, now)) return false;
  return member.mp >= spellMpCost(skill, learned);
}

function bossPartyCanUseTaoistSpell(member, spell, learned, now, options = {}) {
  if (!spell || !learned || spell.passive) return false;
  if (options.requireAuto) {
    if (!learned.autoCast) return false;
    if (!bossPartyAutoSpells(member).some((autoSpell) => autoSpell.id === spell.id)) return false;
  }
  if ((learned.castReadyAt ?? 0) > now) return false;
  return member.mp >= spellMpCost(spell, learned);
}

function bossPartyCanUseWizardSpell(member, spell, learned, now, options = {}) {
  if (!spell || !learned || spell.passive) return false;
  if (options.requireAuto) {
    if (!learned.autoCast) return false;
    if (!bossPartyAutoSpells(member).some((autoSpell) => autoSpell.id === spell.id)) return false;
  }
  if (!G.canWizardCastSpell(spell, learned, now, member)) return false;
  if (spell.id === "FireWall" && bossPartyGroundEffectActive("FireWall", now)) return false;
  return member.mp >= spellMpCost(spell, learned);
}

function bossPartyUsableTaoistHealing(member, now, options = {}) {
  const spell = G.taoistCombatSpell("Healing");
  const learned = bossPartyLearned(member, spell.id);
  const manual = options.requireAuto === false;
  if (!bossPartyCanUseTaoistSpell(member, spell, learned, now, { requireAuto: !manual })) return null;
  const target = bossPartyHealTarget(manual);
  if (!target) return null;
  return { spell, learned, cost: spellMpCost(spell, learned), target };
}

function bossPartyUsableTaoistPoisoning(member, now, options = {}) {
  const spell = G.taoistCombatSpell("Poisoning");
  const learned = bossPartyLearned(member, spell.id);
  if (!bossPartyCanUseTaoistSpell(member, spell, learned, now, { requireAuto: options.requireAuto !== false })) return null;
  if (state.battle.bossParty.pendingPoison) return null;
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0) return null;
  if (!options.ignoreRange && bossPartyMemberEnemyDistance(member) > G.crystalSpellRangePx(spell)) return null;
  const entry = bossPartyPoisonCandidate(member, enemy, now);
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

function bossPartyUsableTaoistSoulFireBall(member, now, options = {}) {
  const spell = G.taoistCombatSpell("SoulFireBall");
  const learned = bossPartyLearned(member, spell.id);
  if (!bossPartyCanUseTaoistSpell(member, spell, learned, now, { requireAuto: options.requireAuto !== false })) return null;
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0) return null;
  if (!options.ignoreRange && bossPartyMemberEnemyDistance(member) > G.taoistSoulFireBallRangePx(spell)) return null;
  const amulet = bossPartyAmuletCandidate(member);
  const item = amulet ? G.itemDefinition(amulet.itemId) : null;
  if (!amulet || !G.isTaoistAmuletItem(item)) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry: amulet,
    item,
  };
}

function bossPartyUsableTaoistUltimateEnhancer(member, now, options = {}) {
  const spell = G.taoistCombatSpell("UltimateEnhancer");
  const learned = bossPartyLearned(member, spell?.id);
  const manual = options.requireAuto === false;
  if (!spell || !learned || !bossPartyCanUseTaoistSpell(member, spell, learned, now, { requireAuto: !manual })) return null;
  const targets = G.ultimateEnhancerTargets(now);
  if (!targets.length) return null;
  if (!manual && !G.ultimateEnhancerNeedsCast(now)) return null;
  const amulet = bossPartyAmuletCandidate(member);
  const item = amulet ? G.itemDefinition(amulet.itemId) : null;
  if (!amulet || !G.isTaoistAmuletItem(item)) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry: amulet,
    item,
    targets,
  };
}

function bossPartyCastUltimateEnhancer(member, castBundle, now) {
  if (!bossPartyConsumeOneInventoryUnit(member, castBundle.entry.id)) return false;
  const targets = G.ultimateEnhancerTargets(now);
  if (!targets.length) return false;
  member.mp -= castBundle.cost;
  castBundle.learned.castReadyAt = now + spellDelayMs(castBundle.spell, castBundle.learned);
  member.nextActionAt = now + spellDelayMs(castBundle.spell, castBundle.learned);
  G.clearQueuedCombatSpell(castBundle.spell.id);
  const applied = G.applyUltimateEnhancerToTargets(
    castBundle.spell,
    castBundle.learned,
    member,
    targets,
    now,
    { levelSkill: false },
  );
  if (!applied) return false;
  bossPartyLevelMagicSkill(member, castBundle.spell, castBundle.learned, now);
  bossPartyControlledVisual(member, castBundle.spell, castBundle.spell.bodyAction ?? "spell", now);
  bossPartyCastSfx(member, castBundle.spell.id, 0.38, 160);
  G.showUltimateEnhancerBuffTexts(applied, now);
  G.queueUltimateEnhancerImpactFx(castBundle.spell, applied, now, {
    soundPlayed: member.classId !== bossPartyControlledClassId(),
  });
  G.pushBattleLog(G.formatUltimateEnhancerAppliedLog(castBundle.spell, member.classId, applied, applied.durationMs));
  return true;
}

function bossPartyMemberPlayerBuffs(member) {
  const partyMember = G.resolveBossPartyMember(member);
  if (!partyMember) return state.battle.statBuffs ?? [];
  const memberBuffs = Array.isArray(partyMember.statBuffs) ? partyMember.statBuffs : [];
  if (partyMember.classId === bossPartyControlledClassId()) {
    const battleBuffs = state.battle.statBuffs ?? [];
    const merged = [...memberBuffs];
    for (const buff of battleBuffs) {
      if (!merged.some((entry) => entry.kind === buff.kind)) merged.push(buff);
    }
    return merged.length > 0 ? merged : memberBuffs;
  }
  return memberBuffs;
}

function bossPartyWizardAttackSpells(member) {
  return bossPartyAutoSpells(member).filter((spell) => spell.impactMode !== "buff");
}

function bossPartyUsableTaoistDefenceBuff(member, spellId, now, options = {}) {
  const spell = G.taoistCombatSpell(spellId);
  const learned = bossPartyLearned(member, spell?.id);
  const manual = options.requireAuto === false;
  if (!spell || !learned || !bossPartyCanUseTaoistSpell(member, spell, learned, now, { requireAuto: !manual })) return null;
  if (!manual && !G.needsDefenceBuff(spellId, now)) return null;
  const amulet = bossPartyAmuletCandidate(member);
  const item = amulet ? G.itemDefinition(amulet.itemId) : null;
  if (!amulet || !G.isTaoistAmuletItem(item)) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry: amulet,
    item,
  };
}

function bossPartyCastDefenceBuff(member, castBundle, now) {
  if (!bossPartyConsumeOneInventoryUnit(member, castBundle.entry.id)) return false;
  member.mp -= castBundle.cost;
  castBundle.learned.castReadyAt = now + spellDelayMs(castBundle.spell, castBundle.learned);
  member.nextActionAt = now + spellDelayMs(castBundle.spell, castBundle.learned);
  G.clearQueuedCombatSpell(castBundle.spell.id);
  const applied = G.applyTaoistDefenceBuffEffect(
    castBundle.spell,
    castBundle.learned,
    member,
    now,
    { member, levelSkill: false },
  );
  if (!applied?.results?.length) return false;
  const { bonus, durationMs } = applied;
  bossPartyLevelMagicSkill(member, castBundle.spell, castBundle.learned, now);
  bossPartyControlledVisual(member, castBundle.spell, castBundle.spell.bodyAction ?? "spell", now);
  bossPartyCastSfx(member, castBundle.spell.id, 0.38, 160);
  G.queueDefenceBuffImpactTargets(castBundle.spell, now, {
    worldX: member.worldX ?? state.battle.playerX,
    soundPlayed: member.classId !== bossPartyControlledClassId(),
  });
  G.showTaoistDefenceBuffTexts(castBundle.spell, bonus, applied, now);
  G.pushBattleLog(`${member.classId} casts ${castBundle.spell.label} (${G.formatTaoistDefenceBuffAppliedLog(castBundle.spell, bonus, applied, durationMs)}).`);
  return true;
}

function bossPartyUsableWizardDefenceBuff(member, now, options = {}) {
  const spell = G.wizardCombatSpell("MagicShield");
  const learned = bossPartyLearned(member, spell?.id);
  const manual = options.requireAuto === false;
  if (!spell || !learned || !bossPartyCanUseWizardSpell(member, spell, learned, now, { requireAuto: !manual })) return null;
  if (!manual && !G.needsDefenceBuff("MagicShield", now, { playerBuffs: bossPartyMemberPlayerBuffs(member) })) return null;
  return { spell, learned, cost: spellMpCost(spell, learned) };
}

function bossPartyUsableQueuedWizardDefenceBuff(member, now) {
  const queued = G.queuedCombatSpell("Wizard");
  if (!queued || member.classId !== bossPartyControlledClassId() || queued.spell.id !== "MagicShield") return null;
  return bossPartyUsableWizardDefenceBuff(member, now, { requireAuto: false });
}

function bossPartyCastWizardDefenceBuff(member, castBundle, now) {
  const partyMember = G.resolveBossPartyMember(member);
  if (!partyMember) return false;
  partyMember.mp -= castBundle.cost;
  G.applyWizardCastCooldown(castBundle.spell, castBundle.learned, now, partyMember);
  G.clearQueuedCombatSpell(castBundle.spell.id);
  const { bonus, durationMs, reductionPercent } = G.applyDefenceBuffEffect(
    castBundle.spell,
    castBundle.learned,
    partyMember,
    now,
    { member: partyMember, levelSkill: false },
  );
  bossPartyLevelMagicSkill(partyMember, castBundle.spell, castBundle.learned, now);
  bossPartyControlledVisual(partyMember, castBundle.spell, castBundle.spell.bodyAction ?? "spell", now);
  bossPartyCastSfx(partyMember, castBundle.spell.id, 0.38, 160);
  if (partyMember.classId === bossPartyControlledClassId()) {
    state.battle.activeWizardSpell = null;
    state.battle.activeWizardSpellAtlas = null;
  }
  partyMember.fxSpellId = null;
  G.startMagicShieldLoopFx({
    expiresAt: now + durationMs,
    memberClassId: partyMember.classId === bossPartyControlledClassId() ? null : partyMember.classId,
    now,
  });
  const applied = G.formatDefenceBuffApplied(castBundle.spell, bonus, reductionPercent);
  G.pushBattleLog(`${partyMember.classId} casts ${castBundle.spell.label} (${applied}, ${formatBuffRemaining(durationMs)}).`);
  return true;
}

function bossPartyUsableTaoistSummonSpell(member, spellId, now, options = {}) {
  const spell = G.taoistCombatSpell(spellId);
  if (!spell) return null;
  const learned = bossPartyLearned(member, spell.id);
  if (!bossPartyCanUseTaoistSpell(member, spell, learned, now, { requireAuto: options.requireAuto !== false })) return null;
  const party = state.battle.bossParty;
  if (party.petDiedThisFight || bossPartyActivePet() || party.pendingTaoPet || state.battle.pendingTaoPet) return null;
  const enemy = state.battle.enemy;
  if (!enemy || enemy.hp <= 0) return null;
  if (!options.ignoreRange && bossPartyMemberEnemyDistance(member) > G.taoistSummonPetRangePx()) return null;
  const amuletCost = G.taoistSummonAmuletCost(spell.id);
  const amulet = bossPartyAmuletCandidate(member);
  const item = amulet ? G.itemDefinition(amulet.itemId) : null;
  if (!amulet || !G.isTaoistAmuletItem(item) || bossPartyAmuletInventoryCount(member) < amuletCost) return null;
  return {
    spell,
    learned,
    cost: spellMpCost(spell, learned),
    entry: amulet,
    item,
    amuletCost,
  };
}

function bossPartyUsableTaoistSummonSkeleton(member, now, options = {}) {
  return bossPartyUsableTaoistSummonSpell(member, "SummonSkeleton", now, options);
}

function bossPartyUsableTaoistSummonShinsu(member, now, options = {}) {
  return bossPartyUsableTaoistSummonSpell(member, "SummonShinsu", now, options);
}

function bossPartyUsableQueuedTaoistSpell(member, now) {
  const queued = G.queuedCombatSpell("Taoist");
  if (!queued || member.classId !== bossPartyControlledClassId()) return null;
  if (queued.spell.id === "Healing") return bossPartyUsableTaoistHealing(member, now, { requireAuto: false });
  if (queued.spell.id === "Poisoning") return bossPartyUsableTaoistPoisoning(member, now, { requireAuto: false });
  if (queued.spell.id === "SoulFireBall") return bossPartyUsableTaoistSoulFireBall(member, now, { requireAuto: false });
  if (queued.spell.id === "SummonSkeleton") return bossPartyUsableTaoistSummonSkeleton(member, now, { requireAuto: false });
  if (queued.spell.id === "SummonShinsu") return bossPartyUsableTaoistSummonShinsu(member, now, { requireAuto: false });
  if (queued.spell.id === "SoulShield") return bossPartyUsableTaoistDefenceBuff(member, "SoulShield", now, { requireAuto: false });
  if (queued.spell.id === "BlessedArmour") return bossPartyUsableTaoistDefenceBuff(member, "BlessedArmour", now, { requireAuto: false });
  if (queued.spell.id === "UltimateEnhancer") return bossPartyUsableTaoistUltimateEnhancer(member, now, { requireAuto: false });
  G.clearQueuedCombatSpell(queued.spell.id);
  return null;
}

function bossPartyCastQueuedTaoistSpell(member, queued, now) {
  if (!queued?.spell) return false;
  if (queued.spell.id === "Healing") {
    const learned = queued.learned;
    const amount = G.rollTaoistHealingAmount(queued.spell, learned, member);
    member.mp -= queued.cost;
    learned.castReadyAt = now + spellDelayMs(queued.spell, learned);
    member.nextActionAt = now + spellDelayMs(queued.spell, learned);
    queued.target.healAmount = Math.min(65535, (queued.target.healAmount ?? 0) + amount);
    queued.target.healTickAt = queued.target.healTickAt || now + CRYSTAL_HEAL_DELAY_MS;
    G.clearQueuedCombatSpell(queued.spell.id);
    bossPartyControlledVisual(member, queued.spell, queued.spell.bodyAction ?? "spell", now);
    bossPartyCastSfx(member, queued.spell.id, 0.38, 160);
    bossPartyQueueHealFx(member, queued.target, queued.spell, now);
    bossPartyLevelMagicSkill(member, queued.spell, learned, now);
    G.pushBattleLog(`${member.classId} casts ${queued.spell.label} on ${queued.target.name}.`);
    return true;
  }
  if (queued.spell.id === "Poisoning") {
    if (!bossPartyConsumeOneInventoryUnit(member, queued.entry.id)) return false;
    member.mp -= queued.cost;
    queued.learned.castReadyAt = now + spellDelayMs(queued.spell, queued.learned);
    member.nextActionAt = now + spellDelayMs(queued.spell, queued.learned);
    G.clearQueuedCombatSpell(queued.spell.id);
    bossPartyQueuePoisonApply(member, queued.spell, queued.learned, queued.item, now);
    return true;
  }
  if (queued.spell.id === "SoulFireBall") {
    if (!bossPartyConsumeOneInventoryUnit(member, queued.entry.id)) return false;
    member.mp -= queued.cost;
    queued.learned.castReadyAt = now + spellDelayMs(queued.spell, queued.learned);
    member.nextActionAt = now + spellDelayMs(queued.spell, queued.learned);
    G.clearQueuedCombatSpell(queued.spell.id);
    bossPartyControlledVisual(member, queued.spell, queued.spell.bodyAction ?? "spell", now);
    bossPartyCastSfx(member, queued.spell.id, 0.38, 160);
    G.playSpellSfx(queued.spell.id, "fly", bossPartySfxParams(member, 0.38, 120));
    bossPartyQueueImpact(member, queued.spell, queued.spell.label, state.taoistSpellAtlases[queued.spell.id] ?? null, now, () => (
      G.rollTaoistMagicDamage(queued.spell, queued.learned, member, state.battle.enemy)
    ));
    return true;
  }
  if (queued.spell.id === "SummonSkeleton" || queued.spell.id === "SummonShinsu") {
    const amuletCost = queued.amuletCost ?? G.taoistSummonAmuletCost(queued.spell.id);
    if (!bossPartyConsumeAmuletInventoryUnits(member, amuletCost)) return false;
    member.mp -= queued.cost;
    queued.learned.castReadyAt = now + spellDelayMs(queued.spell, queued.learned);
    member.nextActionAt = now + spellDelayMs(queued.spell, queued.learned);
    G.clearQueuedCombatSpell(queued.spell.id);
    state.battle.bossParty.pet = G.createTaoistSummonPet(
      queued.spell.id,
      Math.max(0, Number(queued.learned.level) || 0),
      now,
    );
    state.battle.bossParty.pet.name = `${member.classId}'s ${state.battle.bossParty.pet.name}`;
    state.battle.taoPet = state.battle.bossParty.pet;
    state.taoPetAtlas = G.taoPetAtlasFor(state.battle.taoPet);
    bossPartyControlledVisual(member, queued.spell, queued.spell.bodyAction ?? "spell", now);
    bossPartyCastSfx(member, queued.spell.id, 0.38, 160);
    bossPartyLevelMagicSkill(member, queued.spell, queued.learned, now);
    G.playTaoPetAppearSfx({ volume: bossPartySfxVolume(member, 0.4, 0.18), throttleMs: 250, pet: state.battle.taoPet });
    G.pushBattleLog(`${member.classId} summons ${state.battle.bossParty.pet.name}.`);
    return true;
  }
  if (queued.spell.id === "SoulShield" || queued.spell.id === "BlessedArmour") {
    return bossPartyCastDefenceBuff(member, queued, now);
  }
  if (queued.spell.id === "UltimateEnhancer") {
    return bossPartyCastUltimateEnhancer(member, queued, now);
  }
  return false;
}

function bossPartyAutoSpells(member) {
  return G.combatAutoCastSpells(member.classId)
    .map((spell) => ({ spell, learned: bossPartyLearned(member, spell.id) }))
    .filter(({ learned }) => learned?.autoCast)
    .sort((a, b) => G.autoCastPriorityForClass(member.classId, a.spell) - G.autoCastPriorityForClass(member.classId, b.spell))
    .slice(0, Math.max(1, G.autoCastSlotLimit()))
    .map(({ spell }) => spell);
}

function bossPartyActiveFight() {
  return Boolean(state.battle.bossParty?.active);
}

function resetBossPartySoloRecoveryState() {
  state.battle.healAmount = 0;
  state.battle.healTickAt = 0;
  state.battle.potHealthAmount = 0;
  state.battle.potManaAmount = 0;
  state.battle.potTickAt = 0;
  state.battle.pendingHeal = null;
}

function syncBossPartyMemberAutoCastFromState(classId = state.battle.combatClass) {
  const party = state.battle.bossParty;
  if (!party?.active || !classId) return;
  const member = party.members.find((candidate) => candidate.classId === classId);
  if (!member?.magic?.learned) return;
  for (const [spellId, memberLearned] of Object.entries(member.magic.learned)) {
    const live = state.magic.learned[spellId];
    if (live) memberLearned.autoCast = Boolean(live.autoCast);
    const saved = state.characters[classId]?.magic?.learned?.[spellId];
    if (saved) saved.autoCast = Boolean(live?.autoCast ?? memberLearned.autoCast);
  }
}

function bossPartyLearned(member, spellId) {
  const learned = member?.magic?.learned?.[spellId] ?? null;
  if (!learned) return null;
  if (!state.battle.bossParty?.active) return learned;
  if (member.classId === state.battle.combatClass) {
    const live = state.magic.learned[spellId];
    if (live) {
      learned.autoCast = Boolean(live.autoCast);
      const effectiveReady = Math.max(
        Math.max(0, Number(learned.castReadyAt) || 0),
        Math.max(0, Number(live.castReadyAt) || 0),
      );
      learned.castReadyAt = effectiveReady;
      live.castReadyAt = effectiveReady;
    }
  } else {
    const saved = state.characters[member.classId]?.magic?.learned?.[spellId];
    if (saved) learned.autoCast = Boolean(saved.autoCast);
  }
  return learned;
}

function bossPartyLevelMagicSkill(member, spell, learned, now) {
  if (!member || !spell || !learned || learned.level >= 3) return false;
  if ((Number(member.game?.progress?.level) || 1) < spellLevelRequirement(spell, learned.level)) return false;
  const need = spellExperienceTarget(spell, learned.level);
  if (!need) return false;
  learned.experience += randomInt(1, 3);
  if (learned.experience >= need) {
    learned.level += 1;
    learned.experience = 0;
    G.pushBattleLog(`${member.classId}'s ${spell.label} reached level ${learned.level}.`);
    if (member.classId === bossPartyControlledClassId()) G.addLootNotice(`${spell.label} Lv ${learned.level}`, "level");
    // Passives that modify stats need the member's combat stats recomputed.
    if (spell.id === "Fencing" || spell.id === "SpiritSword" || spell.id === "Slaying") bossPartyRefreshMemberStats(member);
    battlePanelSignature = "";
    combatSkillBarSignature = "";
  }
  return true;
}

function bossPartyLevelPassiveWeaponMagic(member, now) {
  if (member.classId === "Warrior") {
    const spell = warriorSpellById("Fencing");
    const fencing = bossPartyLearned(member, "Fencing");
    if (spell && fencing) bossPartyLevelMagicSkill(member, spell, fencing, now);
    return;
  }
  if (member.classId === "Taoist") {
    const spell = taoistSpellById("SpiritSword");
    const spiritSword = bossPartyLearned(member, "SpiritSword");
    if (spell && spiritSword) bossPartyLevelMagicSkill(member, spell, spiritSword, now);
  }
}

function bossPartyRefreshMemberStats(member) {
  const stats = G.characterSnapshotTotalStats(member.classId, {
    game: member.game,
    inventory: member.inventory,
    magic: member.magic,
    battle: { playerHp: member.hp, playerMp: member.mp },
  });
  const curHp = member.hp;
  const curMp = member.mp;
  Object.assign(member, stats);
  member.hp = Math.max(0, Math.min(member.maxHp, curHp));
  member.mp = Math.max(0, Math.min(member.maxMp, curMp));
}

function bossPartyEffectiveAttackSpeed(member, now) {
  return (Number(member.attackSpeed) || 0) + (now < (member.furyUntil ?? 0) ? Number(member.furyBonus) || 0 : 0);
}

function bossPartyGroundEffectActive(spellId, now) {
  const onGround = (state.battle.groundSpellEffects ?? []).some(
    (effect) => effect.spellId === spellId && now < effect.expiresAt,
  );
  if (onGround) return true;
  return G.partyBossEffects().some((effect) => effect.spellId === spellId && now < effect.expiresAt);
}

function updateBossPartyEffects(now) {
  const enemy = state.battle.enemy;
  const effects = G.partyBossEffects();
  for (const effect of effects) {
    if (now >= effect.expiresAt || enemy.hp <= 0) continue;
    let guard = 0;
    while (now >= effect.nextTickAt && guard < 4) {
      guard += 1;
      effect.nextTickAt += 2000;
      const damage = G.applyWizardMagicDefence(effect.value, enemy);
      G.reduceEnemyHp(enemy, damage);
      G.syncBattleEnemyHpToSwarm();
      bossPartyShowEnemyDamage(effect.casterClassId, damage, now);
      G.pushBattleLog(`${effect.spellId} burns ${enemy.name} for ${damage}.`);
      G.playSpellSfx(effect.spellId, "impact", { volume: 0.35, throttleMs: 180 });
      G.maybeKillGroupDungeonSwarmEnemy(enemy, now);
      if (enemy.hp <= 0) break;
    }
  }
  state.battle.bossParty.effects = effects.filter((effect) => now < effect.expiresAt);
}

function bossPartyQueueHealFx(member, target, spell, now) {
  if (!target) return;
  const fx = G.partyBossHealFx();
  fx.push({
    target,
    casterClassId: member.classId,
    soundSpellId: spell.id,
    startAt: now + (Number(spell.impactDelayMs) || CRYSTAL_HEAL_APPLY_DELAY_MS),
    soundPlayed: false,
  });
  state.battle.bossParty.healFx = fx.slice(-6);
}

function bossPartyHealFxAtlasDurationMs(atlas) {
  if (!atlas?.layers?.length) return 800;
  return Math.max(0, ...atlas.layers.map((layer) => (layer.delayMs ?? 0) + layer.frames.length * layer.interval));
}

function updateBossPartyHealFx(now) {
  const fx = G.partyBossHealFx();
  if (!fx.length) return;
  const duration = bossPartyHealFxAtlasDurationMs(state.healingRestoreAtlas);
  const remaining = [];
  for (const entry of fx) {
    if (now < entry.startAt) {
      remaining.push(entry);
      continue;
    }
    if (!entry.soundPlayed) {
      entry.soundPlayed = true;
      const caster = state.battle.bossParty?.members?.find((m) => m.classId === entry.casterClassId);
      const params = caster ? bossPartySfxParams(caster, 0.46, 160) : { volume: 0.46, throttleMs: 160 };
      G.playSpellSfx(entry.soundSpellId, "impact", params) || G.playSpellSfx(entry.soundSpellId, "cast", params);
    }
    if (now - entry.startAt <= duration) remaining.push(entry);
  }
  state.battle.bossParty.healFx = remaining;
}

function bossPartyQueuePoisonApply(member, poison, learned, item, now) {
  const party = state.battle.bossParty;
  if (!party) return;
  party.pendingPoison = {
    at: now + CRYSTAL_POISON_APPLY_DELAY_MS,
    memberClassId: member.classId,
    spellId: poison.id,
    value: G.rollTaoistPoisonPower(poison, learned, member),
    kind: G.poisonItemKind(item),
    itemName: item.name,
  };
  bossPartyControlledVisual(member, poison, poison.bodyAction ?? "spell", now);
  bossPartyCastSfx(member, poison.id, 0.38, 160);
  G.pushBattleLog(`${member.classId} casts ${poison.label} with ${item.name}.`);
}

function updateBossPartyPendingPoison(now) {
  const party = state.battle.bossParty;
  const pending = party?.pendingPoison;
  const enemy = state.battle.enemy;
  if (!pending || now < pending.at || !enemy || enemy.hp <= 0) return;
  party.pendingPoison = null;
  const spell = G.taoistCombatSpell(pending.spellId);
  const member = party.members.find((entry) => entry.classId === pending.memberClassId);
  const learned = member ? bossPartyLearned(member, spell.id) : null;
  const level = Math.max(0, Math.min(3, Math.trunc(Number(learned?.level) || 0)));
  const value = Math.max(0, Math.trunc(Number(pending.value) || 0));
  const durationTicks = Math.max(1, value * 2 + (level + 1) * 7);
  const poisonKind = pending.kind === "green" ? "green" : "yellow";
  const poisonAttack = Math.max(0, Math.trunc(Number(member?.poisonAttack) || 0));
  const tickValue = poisonKind === "green"
    ? Math.max(1, Math.floor(value / 15) + level + 1 + (poisonAttack > 0 ? randomInt(0, poisonAttack - 1) : 0))
    : 0;
  const applied = G.applyEnemyPoison(enemy, {
    kind: poisonKind,
    value: tickValue,
    ticksRemaining: durationTicks,
  }, now);
  if (member && learned) bossPartyLevelMagicSkill(member, spell, learned, now);
  const sfx = bossPartySfxParamsForClass(pending.memberClassId, 0.5, 0);
  G.playSpellSfx(spell.id, "impact", sfx) || G.playSpellSfx(spell.id, "cast", sfx);
  const label = poisonKind === "green" ? "Green Poison" : "Yellow Poison";
  G.addCombatText("enemy", poisonKind === "green" ? "Poison" : "Weaken", poisonKind === "green" ? "poison" : "debuff", now);
  G.pushBattleLog(applied ? `${label} affects ${enemy.name}.` : `${enemy.name} resists the weaker ${label}.`);
}

function bossPartyQueueImpact(member, spell, label, atlas, now, rollDamageFn) {
  const enemy = state.battle.enemy;
  if (!enemy) return;
  const hit = G.rollMagicHit(enemy);
  const damage = hit ? Math.max(0, Math.trunc(Number(rollDamageFn()) || 0)) : 0;
  G.partyBossImpacts().push({
    at: now + G.wizardImpactDelay(spell, atlas),
    spellId: spell.id,
    label,
    damage,
    hit: hit && damage > 0,
    casterClassId: member.classId,
  });
}

function updateBossPartyImpacts(now) {
  const enemy = state.battle.enemy;
  const impacts = G.partyBossImpacts();
  if (!impacts.length) return;
  const remaining = [];
  for (const impact of impacts) {
    if (now < impact.at) {
      remaining.push(impact);
      continue;
    }
    bossPartySpellStrikeSfx(impact.spellId, impact.casterClassId);
    const canApply = enemy && enemy.hp > 0 && state.battle.enemyRevealed;
    if (!canApply) continue;
    if (!impact.hit || impact.damage <= 0) {
      bossPartyShowEnemyMiss(impact.casterClassId, now);
      G.pushBattleLog(`${impact.label} misses ${enemy.name}.`);
      continue;
    }
    G.reduceEnemyHp(enemy, impact.damage);
    G.syncBattleEnemyHpToSwarm();
    G.strikeGroupDungeonSwarmEnemy(enemy, now);
    G.playMonsterSfx("flinch", enemy, bossPartySfxParamsForClass(impact.casterClassId, 0.42, 80));
    bossPartyShowEnemyDamage(impact.casterClassId, impact.damage, now);
    G.pushBattleLog(`${impact.label} hits ${enemy.name} for ${impact.damage}.`);
    G.maybeKillGroupDungeonSwarmEnemy(enemy, now);
    const caster = state.battle.bossParty?.members.find((m) => m.classId === impact.casterClassId);
    const spell = G.combatAttackSpell(impact.spellId);
    const learned = caster ? bossPartyLearned(caster, impact.spellId) : null;
    if (impact.spellId === "FrostCrunch" && impact.damage > 0 && caster && learned) {
      G.applyFrostCrunchEffects(enemy, learned, caster, now);
    }
    if (caster && spell && learned) bossPartyLevelMagicSkill(caster, spell, learned, now);
  }
  state.battle.bossParty.impacts = remaining;
}

function bossPartyActivePet() {
  const pet = state.battle.bossParty?.pet;
  return pet?.active && (pet.hp ?? 0) > 0 ? pet : null;
}

function bossPartyFrontTarget() {
  if (G.partyPetCanTank()) return state.battle.bossParty.pet;
  return BOSS_PARTY_ORDER
    .map((classId) => state.battle.bossParty?.members.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .find(Boolean) ?? null;
}

function bossPartyAliveMembersOrdered(party = state.battle.bossParty) {
  return BOSS_PARTY_ORDER
    .map((classId) => party?.members?.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .filter(Boolean);
}

function bossPartyAoeRangedTarget() {
  const alive = bossPartyAliveMembersOrdered();
  if (alive.length === 3) return alive[1];
  return bossPartyFrontTarget();
}

function bossPartyHealTarget(manual = false) {
  const party = state.battle.bossParty;
  if (!party) return null;
  const candidates = [];
  const pet = bossPartyActivePet();
  if (pet) candidates.push(pet);
  for (const member of party.members ?? []) {
    if (member.alive && member.hp > 0) candidates.push(member);
  }
  let best = null;
  let bestRatio = Infinity;
  for (const target of candidates) {
    const maxHp = Math.max(1, Number(target.maxHp) || 0);
    if (target.hp >= maxHp) continue;
    // Skip if a heal already in flight will close the gap.
    if (Math.max(0, Number(target.healAmount) || 0) >= maxHp - target.hp) continue;
    const ratio = target.hp / maxHp;
    if (!manual && ratio >= AUTO_POTION_THRESHOLD) continue;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = target;
    }
  }
  return best;
}

function bossPartyEnemyAttack(now) {
  const enemy = state.battle.enemy;
  if (G.isEvilCentipedeEnemy(enemy)) return G.beginEvilCentipedeAttack(now);
  if (G.enemyHasRangedMeleeAttack(enemy)) return G.beginBoneLordAttack(now);
  const target = bossPartyFrontTarget();
  if (!enemy || !target || !state.battle.enemyRevealed) return false;
  if (bossPartyTargetEnemyDistance(target) > BOSS_PARTY_BOSS_REACH) return false;
  G.setEnemyAction("attack1", true, now);
  G.playMonsterSfx("attack");
  const { hit, damage } = G.resolveIncomingEnemyAttack(enemy, G.defenceTargetForIncomingAttack(target));
  if (!hit) {
    G.addCombatText(target.classId === bossPartyControlledClassId() ? "player" : "enemy", "Miss", "miss", now);
    G.pushBattleLog(`${enemy.name} misses ${target.name}.`);
    return true;
  }
  target.hp = Math.max(0, target.hp - damage);
  if (target === state.battle.bossParty.pet) {
    G.setTaoPetAction("struck", true, now);
    if (target.hp <= 0) bossPartyMarkPetDead(now);
  } else {
    if (target.classId === bossPartyControlledClassId()) {
      G.setPlayerAction("struck", now + 250, true);
      G.maybeNotifyMagicShieldStruck(null, now);
      G.addCombatText("player", damage, "enemyDamage", now);
    } else {
      target.visualAction = "struck";
      target.visualFrame = 0;
      target.visualOneShot = true;
      target.visualLastTick = now;
      G.notifyWizardMagicShieldStruckOnHit(target, now);
    }
    G.playSfx("player.flinch", bossPartySfxParams(target, 0.45, 120));
  }
  G.pushBattleLog(`${enemy.name} hits ${target.name} for ${damage}.`);
  if (target !== state.battle.bossParty.pet && target.hp <= 0) bossPartyMarkMemberDead(target, now);
  return true;
}

function bossPartyPetAttack(now) {
  const pet = state.battle.bossParty?.pet;
  const enemy = state.battle.enemy;
  if (!pet?.active || !enemy || enemy.hp <= 0 || !state.battle.enemyRevealed) return false;
  if (G.combatantParalyzed(pet)) return false;
  if (state.battle.pendingPetAttack) return false;
  if (pet.spellId === "SummonShinsu" && !pet.shinsuVisible && pet.action === "show") return false;
  pet.nextAttackAt = now + Math.max(400, Math.trunc(Number(pet.attackMs) || 1200));
  G.revealTaoistShinsuPet(pet);
  const result = G.rollTaoistPetAttackResult(pet, enemy);
  G.setTaoPetAction("attack1", true, now);

  if (pet.spellId === "SummonShinsu") {
    G.playTaoPetSfx("attack", { volume: 0.34, throttleMs: 250 });
    state.battle.pendingPetAttack = {
      at: now + G.taoistShinsuAttackImpactMs(),
      hit: result.hit,
      damage: result.damage,
      offline: false,
      bossParty: true,
    };
    return true;
  }

  G.playTaoPetSfx("attack", { volume: 0.34, throttleMs: 250 });
  G.applyTaoistPetAttackResult(pet, enemy, result, now, { bossParty: true });
  return true;
}

function bossPartyMarkPetDead(now) {
  const pet = state.battle.bossParty?.pet;
  if (!pet || pet.dead) return;
  pet.active = false;
  pet.dead = true;
  pet.hp = 0;
  state.battle.bossParty.petDiedThisFight = true;
  pet.action = "die";
  pet.frame = 0;
  pet.oneShot = true;
  pet.lastTick = now;
  G.playTaoPetSfx("death", { volume: 0.42, throttleMs: 120 });
  G.pushBattleLog(`${pet.name} falls.`);
  const steppedUp = G.refreshBossPartyMeleePositions({ now });
  if (steppedUp) {
    updateBossPartyMeleeAdvance(now);
    G.pushBattleLog(`${steppedUp.classId} steps up to the front.`);
  }
}

function bossPartyMarkMemberDead(member, now) {
  member.alive = false;
  member.hp = 0;
  member.targetWorldX = null;
  member.meleeAdvanceFromX = null;
  member.meleeAdvanceStartedAt = null;
  member.visualAction = "die";
  member.visualFrame = 0;
  member.visualOneShot = true;
  member.visualLastTick = now;
  G.pushBattleLog(`${member.classId} falls.`);
  const steppedUp = G.refreshBossPartyMeleePositions({ now });
  if (steppedUp) {
    updateBossPartyMeleeAdvance(now);
    G.pushBattleLog(`${steppedUp.classId} steps up to the front.`);
  }
}

function bossPartyAllMembersDead() {
  return !state.battle.bossParty?.members.some((member) => member.alive && member.hp > 0);
}

function bossPartyNextAliveMember() {
  return BOSS_PARTY_ORDER
    .map((classId) => state.battle.bossParty?.members.find((member) => member.classId === classId && member.alive && member.hp > 0))
    .find(Boolean) ?? null;
}

function bossPartyLeaderClassId(party = state.battle.bossParty) {
  return G.normalizeCharacterId(party?.leaderClassId ?? party?.controlledClassId ?? state.activeCharacterId);
}

function bossPartyLeaderMember(party = state.battle.bossParty) {
  const classId = bossPartyLeaderClassId(party);
  return party?.members.find((member) => member.classId === classId) ?? null;
}

function bossPartyControlledClassId() {
  return bossPartyLeaderClassId();
}

function bossPartyControlledMember(party = state.battle.bossParty) {
  return bossPartyLeaderMember(party);
}

function bossPartyDamageTextOffset(classId) {
  const controlledId = bossPartyControlledClassId();
  if (classId === controlledId) return 0;
  const assists = BOSS_PARTY_ORDER.filter((id) => id !== controlledId);
  const index = assists.indexOf(classId);
  if (index === 0) return -BOSS_PARTY_DAMAGE_TEXT_OFFSET;
  if (index >= 1) return BOSS_PARTY_DAMAGE_TEXT_OFFSET;
  return 0;
}

function bossPartyShowEnemyDamage(classId, damage, now = performance.now()) {
  const controlled = classId === bossPartyControlledClassId();
  G.addCombatText("enemy", damage, controlled ? "damage" : "assistDamage", now, bossPartyDamageTextOffset(classId));
}

function bossPartyShowEnemyMiss(classId, now = performance.now()) {
  G.addCombatText("enemy", "Miss", "miss", now, bossPartyDamageTextOffset(classId));
}

function bossPartySyncControlledPlayerRef() {
  const party = state.battle.bossParty;
  const leader = bossPartyLeaderMember(party);
  if (!leader) return;
  const leaderClassId = bossPartyLeaderClassId(party);
  state.battle.player = leader;
  state.battle.combatClass = leaderClassId;
  state.activeCharacterId = leaderClassId;
  state.battle.playerX = leader.worldX ?? state.battle.playerX;
  G.syncBattleCamera();
  state.battle.level = leader.game.progress.level;
  state.battle.experience = leader.game.progress.experience;
  state.battle.gold = leader.inventory.gold;
  state.battle.furyUntil = Number(leader.furyUntil) || 0;
  state.battle.furyBonus = Number(leader.furyBonus) || 0;
  state.game.progress.level = leader.game.progress.level;
  state.game.progress.experience = leader.game.progress.experience;
  state.game.kills = leader.game.kills;
  state.game.zoneKills = leader.game.zoneKills;
  syncBossPartyControlledInventoryToState(leaderClassId);
}

function bossPartyAliveRewardMembers(party = state.battle.bossParty) {
  return (party?.members ?? []).filter((member) => member.alive && member.hp > 0);
}

function awardBossPartyKillShare(now = performance.now(), options = {}) {
  const party = state.battle.bossParty;
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === party?.zoneId) ?? G.activeZone();
  const enemy = options.enemy ?? state.battle.enemy;
  if (!party || !zone || !enemy) return;

  const recipients = bossPartyAliveRewardMembers(party);
  if (!recipients.length) return;
  const shareCount = recipients.length;
  const xpPerShare = G.splitPartyRewardAmount(enemy.experience ?? 0, shareCount);

  const reward = zone.rewards ?? { gold: [1, 2] };
  const totalGold = randomInt(reward.gold[0], reward.gold[1]);
  const goldPerShare = G.splitPartyRewardAmount(totalGold, shareCount);

  for (const member of recipients) {
    const xp = G.adjustedKillExperience(xpPerShare, member.game.progress.level, enemy.level ?? 0);
    const drops = G.rollBossPartyZoneDrops(member, zone, enemy);
    G.applyBossPartyMemberKillReward(member, { xp, gold: goldPerShare, drops, now, zoneId: zone.id });
  }
}

function awardBossPartyBossKillShare(enemy, now = performance.now(), lootClassId) {
  const party = state.battle.bossParty;
  const dropTable = G.bossDropTableForEnemy(enemy);
  if (!party || !enemy || !dropTable) return;

  const recipients = bossPartyAliveRewardMembers(party);
  if (!recipients.length) return;
  const shareCount = recipients.length;
  const xpPerShare = G.splitPartyRewardAmount(enemy.experience ?? 0, shareCount);
  const goldPerShare = G.splitPartyRewardAmount(dropTable.gold, shareCount);
  const zoneId = party.zoneId ?? state.game.activeZoneId;

  for (const member of recipients) {
    const xp = G.adjustedKillExperience(xpPerShare, member.game.progress.level, enemy.level ?? 0);
    const includeItems = member.classId === lootClassId;
    const drops = includeItems ? G.rollBossPartyDrops(member, enemy) : { added: [], ignored: [] };
    G.applyBossPartyMemberKillReward(member, {
      xp,
      gold: goldPerShare,
      drops,
      now,
      includeItems,
      zoneId,
    });
  }
}

function updateBossPartyDropPity(member, zone, candidates, added, ignored) {
  if (!zone || !candidates.length) return;
  if (added.length || ignored.length) {
    member.game.dropPity[zone.id] = 0;
    return;
  }
  const dryKills = Math.max(0, Math.trunc(Number(member.game.dropPity[zone.id]) || 0)) + 1;
  member.game.dropPity[zone.id] = dryKills;
  if (dryKills < DROP_PITY_KILLS) return;
  const forced = G.weightedDropCandidate(candidates);
  if (!forced) return;
  G.addBossPartyZoneDropItem(member, forced.item, added, ignored);
  member.game.dropPity[zone.id] = 0;
}

function bossPartyHasInventorySpaceFor(itemId, member) {
  if (!member?.inventory) return false;
  G.syncInventoryCapacity(member.inventory);
  ensureBossPartyInventorySlots(member);
  const item = G.itemDefinition(itemId);
  if (!item) return false;
  if (G.isStackableItem(item)) {
    const maxStack = G.maxItemStack(item);
    if (bossPartyCarriedInventoryEntries(member).some((entry) => entry.itemId === itemId && entry.quantity < maxStack)) {
      return true;
    }
  }
  return bossPartyInventoryEntries(member).length < member.inventory.maxSlots;
}

function ensureBossPartyInventorySlots(member) {
  const inventory = member?.inventory;
  if (!inventory) return;
  G.syncInventoryCapacity(inventory);
  const hotbarIds = new Set((member.hotbar?.slots ?? []).filter(Boolean));
  const equippedIds = new Set(Object.values(inventory.equipment ?? {}).filter(Boolean));
  const used = new Set();
  for (const entry of inventory.items ?? []) {
    if (equippedIds.has(entry.id) || hotbarIds.has(entry.id)) {
      entry.slot = null;
      continue;
    }
    if (Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < inventory.maxSlots && !used.has(entry.slot)) {
      used.add(entry.slot);
      continue;
    }
    entry.slot = null;
  }
  for (const entry of inventory.items ?? []) {
    if (equippedIds.has(entry.id) || hotbarIds.has(entry.id) || entry.slot !== null) continue;
    for (let slot = 0; slot < inventory.maxSlots; slot++) {
      if (used.has(slot)) continue;
      entry.slot = slot;
      used.add(slot);
      break;
    }
  }
}

function bossPartyAddInventoryItem(member, itemId, quantity = 1) {
  syncBossPartyInventoryCapacityFromState(member?.classId);
  ensureBossPartyInventorySlots(member);
  const item = G.itemDefinition(itemId);
  if (!item) return [];
  const added = [];
  let remaining = Math.max(1, Math.trunc(Number(quantity) || 1));
  const maxStack = G.maxItemStack(item);
  while (remaining > 0) {
    if (G.isStackableItem(item)) {
      const existing = bossPartyCarriedInventoryEntries(member).find((entry) => entry.itemId === itemId && entry.quantity < maxStack);
      if (existing) {
        const add = Math.min(remaining, maxStack - existing.quantity);
        existing.quantity += add;
        remaining -= add;
        added.push(existing);
        continue;
      }
      const add = Math.min(remaining, maxStack);
      if (bossPartyInventoryUsedSlots(member) >= member.inventory.maxSlots) break;
      const entry = bossPartyCreateInventoryEntry(member, itemId, add);
      member.inventory.items.push(entry);
      added.push(entry);
      remaining -= add;
      continue;
    }
    if (bossPartyInventoryUsedSlots(member) >= member.inventory.maxSlots) break;
    const entry = bossPartyCreateInventoryEntry(member, itemId, 1);
    member.inventory.items.push(entry);
    added.push(entry);
    remaining -= 1;
  }
  return added;
}

function bossPartyCreateInventoryEntry(member, itemId, quantity) {
  const slot = G.nextFreeSlotInInventoryState(member.inventory);
  const entry = {
    id: `item-${member.inventory.nextInstanceId}`,
    itemId,
    quantity,
    slot: Number.isInteger(slot) ? slot : null,
    ...normalizeInventoryEntryFields({}, G.itemDefinition(itemId)),
  };
  member.inventory.nextInstanceId += 1;
  return entry;
}

function bossPartyInventoryItemQuantity(member, itemId) {
  return member.inventory.items
    .filter((entry) => entry.itemId === itemId && !bossPartyIsEquippedEntry(member, entry.id))
    .reduce((sum, entry) => sum + Math.max(1, Math.trunc(Number(entry.quantity) || 1)), 0);
}

function bossPartyInventoryEntries(member) {
  const hotbarIds = new Set((member.hotbar?.slots ?? []).filter(Boolean));
  return member.inventory.items.filter((entry) => !bossPartyIsEquippedEntry(member, entry.id) && !hotbarIds.has(entry.id));
}

function bossPartyInventoryUsedSlots(member) {
  return bossPartyInventoryEntries(member).length;
}

function bossPartyCarriedInventoryEntries(member) {
  return member.inventory.items.filter((entry) => !bossPartyIsEquippedEntry(member, entry.id));
}

function bossPartyInventoryEntryById(member, entryId) {
  return member.inventory.items.find((entry) => entry.id === entryId) ?? null;
}

function bossPartyIsEquippedEntry(member, entryId) {
  return Object.values(member.inventory.equipment ?? {}).includes(entryId);
}

function bossPartyConsumeOneInventoryUnit(member, entryId) {
  const entry = bossPartyInventoryEntryById(member, entryId);
  if (!entry || bossPartyIsEquippedEntry(member, entry.id)) return false;
  entry.quantity -= 1;
  if (entry.quantity <= 0) {
    member.hotbar.slots = member.hotbar.slots.map((id) => id === entry.id ? null : id);
    member.inventory.items = member.inventory.items.filter((candidate) => candidate.id !== entry.id);
  }
  return true;
}

function bossPartyHotbarEntryAtSlot(member, slot) {
  const entryId = member.hotbar?.slots?.[slot] ?? null;
  return entryId ? bossPartyInventoryEntryById(member, entryId) : null;
}

function bossPartyAutoUsePotions(member, now) {
  if (!member.alive || member.hp <= 0) return false;
  if (member.classId === bossPartyControlledClassId()) {
    const used = G.updateAutoPotions(now);
    if (used) {
      syncBossPartyControlledInventoryFromState(member.classId);
      syncBossPartyControlledRecoveryFromState(member);
    }
    return used;
  }
  let used = false;
  for (const kind of ["hp", "mp"].sort((a, b) => bossPartyResourceRatio(member, a) - bossPartyResourceRatio(member, b))) {
    if (bossPartyResourceRatio(member, kind) >= AUTO_POTION_THRESHOLD) continue;
    if ((member.autoPotionReadyAt?.[kind] ?? 0) > now) continue;
    if (kind === "hp" && (member.potHealthAmount ?? 0) > 0) continue;
    if (kind === "mp" && (member.potManaAmount ?? 0) > 0) continue;
    const candidate = G.autoPotionSlots()
      .map((slot) => {
        const entry = bossPartyHotbarEntryAtSlot(member, slot);
        const item = entry ? G.itemDefinition(entry.itemId) : null;
        return { entry, item, restore: G.potionRestoreAmount(item, kind), slot };
      })
      .filter((candidate) => candidate.entry && candidate.restore > 0)
      .sort((a, b) => b.restore - a.restore || a.slot - b.slot)[0];
    if (!candidate || !bossPartyConsumeOneInventoryUnit(member, candidate.entry.id)) continue;
    const hpRestore = G.potionRestoreAmount(candidate.item, "hp");
    const mpRestore = G.potionRestoreAmount(candidate.item, "mp");
    if (G.potionRestoreMode(candidate.item) === "instant") {
      member.hp = Math.min(member.maxHp, member.hp + hpRestore);
      member.mp = Math.min(member.maxMp, member.mp + mpRestore);
    } else {
      member.potHealthAmount = Math.min(65535, (member.potHealthAmount ?? 0) + hpRestore);
      member.potManaAmount = Math.min(65535, (member.potManaAmount ?? 0) + mpRestore);
      member.potTickAt = member.potTickAt || now + CRYSTAL_POT_DELAY_MS;
    }
    member.autoPotionReadyAt[kind] = now + AUTO_POTION_COOLDOWN_MS;
    G.pushBattleLog(`${member.classId} auto used ${candidate.item.name}.`);
    used = true;
  }
  return used;
}

function bossPartyResourceRatio(member, kind) {
  const max = kind === "hp" ? member.maxHp : member.maxMp;
  return max > 0 ? Math.max(0, Math.min(1, (Number(member[kind]) || 0) / max)) : 1;
}

function updateBossPartyMemberPotionRegen(member, now) {
  if (!member.alive || member.hp <= 0 || (!member.potHealthAmount && !member.potManaAmount)) return false;
  if (!member.potTickAt) member.potTickAt = now + CRYSTAL_POT_DELAY_MS;
  let changed = false;
  let steps = 0;
  while (now >= member.potTickAt && steps < 20 && (member.potHealthAmount > 0 || member.potManaAmount > 0)) {
    steps += 1;
    member.potTickAt += CRYSTAL_POT_DELAY_MS;
    const tickAmount = 5 + Math.floor((member.game.progress.level ?? 1) / 10);
    if (member.potHealthAmount > 0) {
      const amount = Math.min(tickAmount, member.potHealthAmount);
      member.potHealthAmount -= amount;
      member.hp = Math.min(member.maxHp, member.hp + amount);
      changed = true;
    }
    if (member.potManaAmount > 0) {
      const amount = Math.min(tickAmount, member.potManaAmount);
      member.potManaAmount -= amount;
      member.mp = Math.min(member.maxMp, member.mp + amount);
      changed = true;
    }
  }
  if (member.potHealthAmount <= 0 && member.potManaAmount <= 0) member.potTickAt = 0;
  return changed;
}

function updateBossPartyMemberHealRegen(member, now) {
  if (!member || member.hp <= 0) return false;

  let changed = false;
  if (member.hp >= member.maxHp && member.healAmount > 0) {
    member.healAmount = 0;
    member.healTickAt = 0;
    return true;
  }

  if ((member.healAmount ?? 0) <= 0) {
    member.healTickAt = 0;
    return changed;
  }

  if (!member.healTickAt) {
    member.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
    return changed;
  }

  let steps = 0;
  const healLevel = G.crystalHealRegenLevel(member);
  while (now >= member.healTickAt && steps < 20 && member.healAmount > 0 && member.hp > 0) {
    const tickAt = member.healTickAt;
    member.healTickAt += CRYSTAL_HEAL_DELAY_MS;
    steps += 1;
    const amount = Math.min(G.crystalHealRegenTickAmount(member.healAmount, healLevel), member.healAmount);
    member.healAmount -= amount;
    const before = member.hp;
    member.hp = Math.min(member.maxHp, member.hp + amount);
    const applied = member.hp - before;
    if (applied > 0) G.addBossPartyMemberCombatText(member, `+${applied} HP`, "heal", tickAt);
    if (member.hp >= member.maxHp) member.healAmount = 0;
    changed = true;
  }

  if (steps >= 20 && member.healAmount > 0) member.healTickAt = now + CRYSTAL_HEAL_DELAY_MS;
  if (member.healAmount <= 0) member.healTickAt = 0;
  return changed;
}

function bossPartyPoisonCandidate(member, enemy, now) {
  const entries = bossPartyCarriedInventoryEntries(member).filter((entry) => G.isPoisonItem(G.itemDefinition(entry.itemId)));
  const green = entries.find((entry) => G.poisonItemKind(G.itemDefinition(entry.itemId)) === "green") ?? null;
  const yellow = entries.find((entry) => G.poisonItemKind(G.itemDefinition(entry.itemId)) === "yellow") ?? null;
  if (green && G.poisonNeedsApply(enemy, "green", now)) return green;
  if (yellow && G.poisonNeedsApply(enemy, "yellow", now)) return yellow;
  return null;
}

function bossPartyAmuletCandidate(member) {
  return bossPartyCarriedInventoryEntries(member).find((entry) => G.isTaoistAmuletItem(G.itemDefinition(entry.itemId))) ?? null;
}

function bossPartyAmuletInventoryCount(member, shape = 0) {
  return bossPartyCarriedInventoryEntries(member)
    .filter((entry) => {
      const item = G.itemDefinition(entry.itemId);
      return G.isTaoistAmuletItem(item) && Math.max(0, Math.trunc(Number(item.shape) || 0)) === shape;
    })
    .reduce((sum, entry) => sum + Math.max(1, Math.floor(Number(entry.quantity) || 1)), 0);
}

function syncBossPartyMembersToCharacters(party, options = {}) {
  if (!party?.members?.length) return;
  const leaderClassId = bossPartyLeaderClassId(party);
  if (G.normalizeCharacterId(state.activeCharacterId) === leaderClassId) {
    syncBossPartyControlledMemberFromState(leaderClassId);
  }
  for (const member of party.members) {
    const character = state.characters[member.classId] ?? G.createDefaultCharacterState(member.classId);
    character.inventory = G.cloneInventoryState(member.inventory);
    character.hotbar = G.cloneHotbarState(member.hotbar);
    character.magic = G.cloneMagicState(member.magic);
    character.game = {
      ...character.game,
      ...member.game,
      mode: state.game.mode,
      activeZoneId: state.game.activeZoneId,
      progress: { ...member.game.progress, gold: member.inventory.gold },
      recentLoot: [...(member.game.recentLoot ?? [])],
      dropPity: { ...(member.game.dropPity ?? {}) },
      bossRespawns: { ...accountBossRespawns() },
      bossKills: { ...accountBossKills() },
    };
    character.battle = {
      running: false,
      paused: false,
      playerHp: member.hp > 0 ? member.hp : 0,
      playerMp: Math.max(0, member.mp),
      potHealthAmount: Math.max(0, member.potHealthAmount ?? 0),
      potManaAmount: Math.max(0, member.potManaAmount ?? 0),
      healAmount: Math.max(0, member.healAmount ?? 0),
    };
    state.characters[member.classId] = character;
  }
  G.persistCharacterGameLocation({
    mode: state.game.mode,
    zoneId: state.game.activeZoneId,
    classIds: party.members.map((member) => member.classId),
    running: state.battle.running,
  });
  if (options.applyControlled) {
    const applyCharacter = state.characters[leaderClassId];
    if (applyCharacter) G.applyCharacterState(leaderClassId, applyCharacter);
  }
  state.showEnemies = true;
}

function bossPartySetWarriorSpellCastReadyAt(member, skill, learned, now) {
  if (!member || !skill || !learned) return;
  G.setWarriorSpellCastReadyAt(skill, learned, now);
  if (member.classId !== bossPartyControlledClassId()) return;
  const liveLearned = state.magic.learned?.[skill.id];
  if (liveLearned) liveLearned.castReadyAt = learned.castReadyAt;
}

function bossPartySpellCastReadyAt(member, spellId, learned = null) {
  const memberLearned = learned ?? member?.magic?.learned?.[spellId];
  const memberReady = Math.max(0, Number(memberLearned?.castReadyAt) || 0);
  if (!member || member.classId !== bossPartyControlledClassId()) return memberReady;
  const stateReady = Math.max(0, Number(state.magic.learned?.[spellId]?.castReadyAt) || 0);
  return Math.max(memberReady, stateReady);
}

function bossPartySpellOnCooldown(member, skill, learned, now) {
  if (!skill || !learned) return false;
  if (skill.id === "TwinDrakeBlade" && G.twinDrakeAutoCastActive(learned)) return false;
  return bossPartySpellCastReadyAt(member, skill.id, learned) > now;
}

function bossPartyHalfMoonSplash(member, skill, learned, primaryEnemy, now) {
  const splashTargets = G.halfMoonSplashSwarmEnemies(primaryEnemy?.swarmId);
  if (!splashTargets.length) return;
  for (const swarmEnemy of splashTargets) {
    if (!G.rollHit(member.accuracy, swarmEnemy.agility)) {
      G.pushBattleLog(`${member.classId} Half Moon misses ${swarmEnemy.name}.`);
      continue;
    }
    const entity = G.swarmEnemyToBattleEntity(swarmEnemy);
    const damage = G.scaleEnemyPhysicalDamage(
      G.rollWarriorMagicDamage(skill, learned, member, entity),
      entity,
      now,
    );
    if (damage <= 0) {
      G.pushBattleLog(`${member.classId} Half Moon misses ${swarmEnemy.name}.`);
      continue;
    }
    swarmEnemy.hp = Math.max(0, swarmEnemy.hp - damage);
    G.addSwarmEnemyCombatText(swarmEnemy, damage, "damage", now);
    G.strikeGroupDungeonSwarmEnemy(entity, now);
    G.playMonsterSfx("flinch", swarmEnemy, bossPartySfxParams(member, 0.42, 80));
    G.pushBattleLog(`${member.classId} Half Moon hits ${swarmEnemy.name} for ${damage}.`);
    G.maybeKillGroupDungeonSwarmEnemy(entity, now);
  }
  G.syncGroupDungeonPrimaryEnemy();
}

function bossPartySpellStrikeSfx(spellId, casterClassId) {
  const base = bossPartySfxParamsForClass(casterClassId, 0.5, 0);
  return G.playSpellStrikeSfx(spellId, { ...base, force: true, throttleMs: 0 });
}

function drawBossPartyCharacters(ctx) {
  drawBossPartyDeadMembers(ctx);
  drawBossPartyLivingMembers(ctx);
}

function bossPartyMembersByDepth(members, { living = null } = {}) {
  return [...members]
    .filter((member) => {
      const isLiving = member.alive && member.hp > 0;
      if (living === true) return isLiving;
      if (living === false) return !isLiving;
      return true;
    })
    .sort((a, b) => (a.worldX ?? 0) - (b.worldX ?? 0));
}

function drawBossPartyDeadMembers(ctx) {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  for (const member of bossPartyMembersByDepth(party.members, { living: false })) {
    drawBossPartyMemberCanvas(ctx, member);
  }
}

function drawBossPartyLivingMembers(ctx) {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  for (const member of bossPartyMembersByDepth(party.members, { living: true })) {
    drawBossPartyMemberCanvas(ctx, member);
  }
}

function drawBossPartySpellFxCanvas(ctx) {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return;
  const now = performance.now();
  for (const member of party.members) {
    if (member.classId === bossPartyControlledClassId()) continue;
    drawBossPartyMemberSpellFx(ctx, member, now);
  }
}

function drawBossPartyMemberSpellFx(ctx, member, now) {
  const spellId = member.fxSpellId;
  if (!spellId) return;

  if (member.classId === "Warrior") {
    const atlas = state.warriorSkillAtlases[spellId];
    const skill = G.warriorCombatSkill(spellId);
    if (!atlas?.layers?.length || !member.visualOneShot) {
      if (!member.visualOneShot) member.fxSpellId = null;
      return;
    }
    if (member.visualAction !== skill.bodyAction) return;
    const memberAnchor = {
      x: Math.floor((member.worldX ?? state.battle.playerX) - state.battle.cameraX),
      y: Math.floor(state.stageHeight * LANE.y),
    };
    const layers = G.warriorSkillFxLayers(spellId, "swing");
    const fxStartedAt = member.fxStartedAt ?? now;
    G.withScreenBlend(ctx, () => {
      for (const layer of layers) {
        const frameIndex = G.spellFxLayerFrameIndex(layer, fxStartedAt, now);
        if (frameIndex < 0) {
          member.fxSpellId = null;
          continue;
        }
        G.drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, memberAnchor.x, memberAnchor.y);
      }
    });
    return;
  }

  const atlas = member.classId === "Wizard"
    ? state.wizardSpellAtlases[spellId]
    : member.classId === "Taoist" ? state.taoistSpellAtlases[spellId] : null;
  const spell = member.classId === "Wizard" ? G.wizardCombatSpell(spellId)
    : member.classId === "Taoist" ? G.taoistCombatSpell(spellId) : null;
  if (!atlas || !spell) return;
  const t = now - (member.fxStartedAt ?? 0);
  const hitAt = G.wizardImpactDelay(spell, atlas);
  const layerEnd = Math.max(0, ...atlas.layers.map((layer) => (layer.delayMs ?? 0) + layer.frames.length * layer.interval));
  const total = Math.max(layerEnd, spell.impactMode === "projectile" ? hitAt + (spell.impactFlashMs ?? 250) : 0);
  if (t < 0 || t > total) {
    member.fxSpellId = null;
    return;
  }
  const memberAnchor = {
    x: Math.floor((member.worldX ?? state.battle.playerX) - state.battle.cameraX),
    y: Math.floor(state.stageHeight * LANE.y),
  };
  const enemyAnchor = G.combatAnchor("enemy");
  const fxAnchor = spell.effectAnchor === "enemy" ? enemyAnchor : memberAnchor;
  G.withScreenBlend(ctx, () => {
    for (const layer of atlas.layers) {
      const layerDelay = layer.delayMs ?? 0;
      const layerT = t - layerDelay;
      const duration = layer.frames.length * layer.interval;
      if (layerT < 0 || layerT > duration) continue;
      const layerAnchor = layer.anchor === "enemy" ? enemyAnchor : layer.anchor === "player" ? memberAnchor : fxAnchor;
      const frameIndex = Math.min(layer.frames.length - 1, Math.floor(layerT / layer.interval));
      G.drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, layerAnchor.x, layerAnchor.y);
    }
    if (spell.impactMode === "projectile") G.drawCombatProjectileCanvas(ctx, atlas, t, memberAnchor, enemyAnchor, hitAt);
    if (spell.impactMode === "projectile" && t >= hitAt && t <= hitAt + (spell.impactFlashMs ?? 250)) {
      G.drawImpactFlashCanvas(ctx, atlas, t - hitAt, enemyAnchor);
    }
  });
}

function drawBossPartyHealFxCanvas(ctx) {
  const fx = G.partyBossHealFx();
  if (!fx.length) return;
  const atlas = state.healingRestoreAtlas;
  if (!atlas?.layers?.length) return;
  const now = performance.now();
  const groundY = Math.floor(state.stageHeight * LANE.y);
  for (const entry of fx) {
    const target = entry.target;
    if (!target) continue;
    const t = now - (entry.startAt ?? 0);
    if (t < 0) continue;
    const worldX = target.worldX ?? state.battle.playerX;
    const anchorX = Math.floor(worldX - state.battle.cameraX);
    G.withScreenBlend(ctx, () => {
      for (const layer of atlas.layers) {
        const layerT = t - (layer.delayMs ?? 0);
        const duration = layer.frames.length * layer.interval;
        if (layerT < 0 || layerT > duration) continue;
        const frameIndex = Math.min(layer.frames.length - 1, Math.floor(layerT / layer.interval));
        G.drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, anchorX, groundY);
      }
    });
  }
}

function drawBossPartyMemberCanvas(ctx, member) {
  const action = member.visualAction ?? (member.alive ? "stance" : "die");
  const anchorX = Math.round((member.worldX ?? state.battle.playerX) - state.battle.cameraX);
  const anchorY = Math.floor(state.stageHeight * LANE.y);
  for (const layer of G.layerNames()) {
    const index = member.visualIndexes?.[layer];
    if (index == null || index === "") continue;
    const atlas = member.visualAtlases?.[layer] ?? (member.classId === bossPartyControlledClassId() ? state.atlases[layer] : null);
    const clip = atlas?.actions?.[action] ?? atlas?.actions?.stance ?? atlas?.actions?.standing;
    const frameIndex = Math.max(0, Math.min(member.visualFrame ?? 0, (clip?.frames?.length ?? 1) - 1));
    const meta = clip?.frames?.[frameIndex] ?? clip?.frames?.[0];
    if (!atlas || !clip || !meta || meta.empty) continue;
    const sheet = G.cachedImage(sheetUrl(state.spriteSet, layer, index));
    if (!sheet) continue;
    G.drawAtlasFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, anchorX, anchorY);
  }
}

function bossPartyMemberFrameBounds(member) {
  const anchor = {
    x: Math.round((member.worldX ?? state.battle.playerX) - state.battle.cameraX),
    y: Math.floor(state.stageHeight * LANE.y),
  };
  const action = member.visualAction ?? (member.alive ? "stance" : "die");
  for (const layer of G.layerNames()) {
    const atlas = member.visualAtlases?.[layer] ?? (member.classId === bossPartyControlledClassId() ? state.atlases[layer] : null);
    const clip = atlas?.actions?.[action] ?? atlas?.actions?.stance ?? atlas?.actions?.standing;
    const frameIndex = Math.max(0, Math.min(member.visualFrame ?? 0, (clip?.frames?.length ?? 1) - 1));
    const meta = clip?.frames?.[frameIndex] ?? clip?.frames?.[0];
    if (!atlas || !clip || !meta || meta.empty) continue;
    const width = meta.w || atlas.slotWidth;
    return {
      centerX: anchor.x + meta.offsetX + width / 2,
      topY: anchor.y + meta.offsetY,
    };
  }
  return { centerX: anchor.x, topY: anchor.y - 80 };
}

function bossPartySignature() {
  const party = state.battle.bossParty;
  if (!party) return "";
  return JSON.stringify({
    active: party.active,
    finished: party.finished,
    defeated: party.defeated,
    controlledClassId: party.controlledClassId,
    pet: party.pet ? `${party.pet.hp}/${party.pet.maxHp}:${party.pet.active ? 1 : 0}` : "",
    members: party.members.map((member) => `${member.classId}:${member.hp}/${member.maxHp}:${member.mp}/${member.maxMp}:${member.alive ? 1 : 0}`),
  });
}

function bossPartyStatusHtml() {
  const party = state.battle.bossParty;
  if (!party?.members?.length) return "";
  const leaderClassId = bossPartyLeaderClassId(party);
  const pet = party.pet
    ? `<div class="boss-party-row pet ${party.pet.active ? "" : "dead"}"><span>${G.escapeHtml(party.pet.name)}</span><strong>${Math.max(0, Math.floor(party.pet.hp))}/${party.pet.maxHp}</strong></div>`
    : "";
  return `
    <div class="boss-party-status">
      <div class="boss-party-heading">
        <strong>${party.defeated ? "Defeated" : party.finished ? "Victory" : "Boss Party"}</strong>
        <span>Leader: ${G.escapeHtml(leaderClassId)}</span>
      </div>
      ${pet}
      ${party.members.map((member) => `
        <div class="boss-party-row ${member.classId === leaderClassId ? "controlled" : ""} ${member.alive ? "" : "dead"}">
          <span>${G.escapeHtml(member.classId)}</span>
          <strong>${Math.max(0, Math.floor(member.hp))}/${member.maxHp} HP</strong>
          <em>${Math.max(0, Math.floor(member.mp))}/${member.maxMp} MP</em>
        </div>
      `).join("")}
    </div>
  `;
}


G.bossPartyMemberClassIds = bossPartyMemberClassIds;
G.bossPartyOnField = bossPartyOnField;
G.freezeBossPartyMembersForAftermath = freezeBossPartyMembersForAftermath;
G.updateBossPartyMemberRestState = updateBossPartyMemberRestState;
G.returnAllCharactersToTown = returnAllCharactersToTown;
G.bossPartyOfflineSimulationActive = bossPartyOfflineSimulationActive;
G.snapshotBossPartyOfflineProgress = snapshotBossPartyOfflineProgress;
G.completeBossPartyOfflineReport = completeBossPartyOfflineReport;
G.simulateBossPartyCatchUp = simulateBossPartyCatchUp;
G.groupDungeonOfflineRunSnapshot = groupDungeonOfflineRunSnapshot;
G.sanitizeGroupDungeonOfflineRun = sanitizeGroupDungeonOfflineRun;
G.simulateOfflineGroupDungeonProgress = simulateOfflineGroupDungeonProgress;
G.syncBossPartyInventoryCapacityFromState = syncBossPartyInventoryCapacityFromState;
G.syncBossPartyControlledInventoryFromState = syncBossPartyControlledInventoryFromState;
G.syncBossPartyControlledInventoryToState = syncBossPartyControlledInventoryToState;
G.syncBossPartyControlledMemberFromState = syncBossPartyControlledMemberFromState;
G.syncBossPartyControlledMemberToState = syncBossPartyControlledMemberToState;
G.syncBossPartyControlledRecoveryFromState = syncBossPartyControlledRecoveryFromState;
G.syncBossPartyControlledRecoveryToState = syncBossPartyControlledRecoveryToState;
G.bossEmpowermentUnlocked = bossEmpowermentUnlocked;
G.bossPartyMembersStepToMelee = bossPartyMembersStepToMelee;
G.bossPartyConsumeAmuletInventoryUnits = bossPartyConsumeAmuletInventoryUnits;
G.bossAssistOptionHtml = bossAssistOptionHtml;
G.bossEntrySceneHtml = bossEntrySceneHtml;
G.bossEntryZone = bossEntryZone;
G.bossPartyClassOrder = bossPartyClassOrder;
G.bossPartyIsMeleeClass = bossPartyIsMeleeClass;
G.bossPartyMemberLineSlot = bossPartyMemberLineSlot;
G.bossPartyMemberLineWorldX = bossPartyMemberLineWorldX;
G.bossPartyAliveMeleeMembers = bossPartyAliveMeleeMembers;
G.bossPartyMeleeFrontSlotWorldX = bossPartyMeleeFrontSlotWorldX;
G.bossPartyMeleeFrontWorldX = bossPartyMeleeFrontWorldX;
G.bossPartyMemberIsWalkingToMelee = bossPartyMemberIsWalkingToMelee;
G.bossPartyMemberSteppingToMelee = bossPartyMemberSteppingToMelee;
G.bossPartyMeleeFrontMember = bossPartyMeleeFrontMember;
G.bossPartyFinishMeleeAdvance = bossPartyFinishMeleeAdvance;
G.updateBossPartyMeleeAdvance = updateBossPartyMeleeAdvance;
G.bossPartyInitMemberVisuals = bossPartyInitMemberVisuals;
G.bossPartyEnemyApproachX = bossPartyEnemyApproachX;
G.bossPartyMemberByClassId = bossPartyMemberByClassId;
G.bossPartyFormationFrontWorldX = bossPartyFormationFrontWorldX;
G.bossPartyWarriorWorldX = bossPartyWarriorWorldX;
G.bossPartyPetWorldX = bossPartyPetWorldX;
G.bossPartyShinsuPetWorldX = bossPartyShinsuPetWorldX;
G.bossPartyPetWorldXFor = bossPartyPetWorldXFor;
G.syncBossPartyPetPosition = syncBossPartyPetPosition;
G.bossPartyMemberEnemyDistance = bossPartyMemberEnemyDistance;
G.bossPartyAdvanceEnemy = bossPartyAdvanceEnemy;
G.bossPartyDesiredEnemyX = bossPartyDesiredEnemyX;
G.bossPartyTargetEnemyDistance = bossPartyTargetEnemyDistance;
G.bossPartyHasThrusting = bossPartyHasThrusting;
G.bossPartyMemberReach = bossPartyMemberReach;
G.bossPartyCanWeaponReach = bossPartyCanWeaponReach;
G.bossPartyCanMelee = bossPartyCanMelee;
G.bossPartyWait = bossPartyWait;
G.bossPartySfxVolume = bossPartySfxVolume;
G.bossPartySfxParamsForClass = bossPartySfxParamsForClass;
G.bossPartySfxParams = bossPartySfxParams;
G.bossPartyCastSfx = bossPartyCastSfx;
G.bossPartyWeaponSfxFamily = bossPartyWeaponSfxFamily;
G.bossPartyMemberFromCharacter = bossPartyMemberFromCharacter;
G.bossPartyMemberVisualIndexes = bossPartyMemberVisualIndexes;
G.bossPartyMemberVisualIndex = bossPartyMemberVisualIndex;
G.bossPartyMemberEquippedVisualItem = bossPartyMemberEquippedVisualItem;
G.updateBossPartyVisualFrames = updateBossPartyVisualFrames;
G.updateBossPartyMemberVisualFrame = updateBossPartyMemberVisualFrame;
G.bossPartyMemberVisualClip = bossPartyMemberVisualClip;
G.updateBossPartyBattle = updateBossPartyBattle;
G.updateBossPartyAftermath = updateBossPartyAftermath;
G.bossPartyMemberAction = bossPartyMemberAction;
G.bossPartyChargeWarriorSkill = bossPartyChargeWarriorSkill;
G.bossPartyMaybeAutoChargeWarriorSkill = bossPartyMaybeAutoChargeWarriorSkill;
G.bossPartyChargeTwinDrake = bossPartyChargeTwinDrake;
G.bossPartyWarriorAction = bossPartyWarriorAction;
G.bossPartyWarriorSwingSfx = bossPartyWarriorSwingSfx;
G.bossPartyRollSlayingCharge = bossPartyRollSlayingCharge;
G.bossPartyQueuedWarriorSkill = bossPartyQueuedWarriorSkill;
G.bossPartyQueuedWizardSpell = bossPartyQueuedWizardSpell;
G.bossPartyWizardAction = bossPartyWizardAction;
G.bossPartyTaoistAction = bossPartyTaoistAction;
G.bossPartyAttackEnemy = bossPartyAttackEnemy;
G.bossPartyWeaponAttack = bossPartyWeaponAttack;
G.bossPartyControlledVisual = bossPartyControlledVisual;
G.bossPartyCanCast = bossPartyCanCast;
G.bossPartyCanUseWarriorSkill = bossPartyCanUseWarriorSkill;
G.bossPartyCanUseTaoistSpell = bossPartyCanUseTaoistSpell;
G.bossPartyCanUseWizardSpell = bossPartyCanUseWizardSpell;
G.bossPartyUsableTaoistHealing = bossPartyUsableTaoistHealing;
G.bossPartyUsableTaoistPoisoning = bossPartyUsableTaoistPoisoning;
G.bossPartyUsableTaoistSoulFireBall = bossPartyUsableTaoistSoulFireBall;
G.bossPartyUsableTaoistUltimateEnhancer = bossPartyUsableTaoistUltimateEnhancer;
G.bossPartyCastUltimateEnhancer = bossPartyCastUltimateEnhancer;
G.bossPartyMemberPlayerBuffs = bossPartyMemberPlayerBuffs;
G.bossPartyWizardAttackSpells = bossPartyWizardAttackSpells;
G.bossPartyUsableTaoistDefenceBuff = bossPartyUsableTaoistDefenceBuff;
G.bossPartyCastDefenceBuff = bossPartyCastDefenceBuff;
G.bossPartyUsableWizardDefenceBuff = bossPartyUsableWizardDefenceBuff;
G.bossPartyUsableQueuedWizardDefenceBuff = bossPartyUsableQueuedWizardDefenceBuff;
G.bossPartyCastWizardDefenceBuff = bossPartyCastWizardDefenceBuff;
G.bossPartyUsableTaoistSummonSpell = bossPartyUsableTaoistSummonSpell;
G.bossPartyUsableTaoistSummonSkeleton = bossPartyUsableTaoistSummonSkeleton;
G.bossPartyUsableTaoistSummonShinsu = bossPartyUsableTaoistSummonShinsu;
G.bossPartyUsableQueuedTaoistSpell = bossPartyUsableQueuedTaoistSpell;
G.bossPartyCastQueuedTaoistSpell = bossPartyCastQueuedTaoistSpell;
G.bossPartyAutoSpells = bossPartyAutoSpells;
G.bossPartyActiveFight = bossPartyActiveFight;
G.resetBossPartySoloRecoveryState = resetBossPartySoloRecoveryState;
G.syncBossPartyMemberAutoCastFromState = syncBossPartyMemberAutoCastFromState;
G.bossPartyLearned = bossPartyLearned;
G.bossPartyLevelMagicSkill = bossPartyLevelMagicSkill;
G.bossPartyLevelPassiveWeaponMagic = bossPartyLevelPassiveWeaponMagic;
G.bossPartyRefreshMemberStats = bossPartyRefreshMemberStats;
G.bossPartyEffectiveAttackSpeed = bossPartyEffectiveAttackSpeed;
G.bossPartyGroundEffectActive = bossPartyGroundEffectActive;
G.updateBossPartyEffects = updateBossPartyEffects;
G.bossPartyQueueHealFx = bossPartyQueueHealFx;
G.bossPartyHealFxAtlasDurationMs = bossPartyHealFxAtlasDurationMs;
G.updateBossPartyHealFx = updateBossPartyHealFx;
G.bossPartyQueuePoisonApply = bossPartyQueuePoisonApply;
G.updateBossPartyPendingPoison = updateBossPartyPendingPoison;
G.bossPartyQueueImpact = bossPartyQueueImpact;
G.updateBossPartyImpacts = updateBossPartyImpacts;
G.bossPartyActivePet = bossPartyActivePet;
G.bossPartyFrontTarget = bossPartyFrontTarget;
G.bossPartyAliveMembersOrdered = bossPartyAliveMembersOrdered;
G.bossPartyAoeRangedTarget = bossPartyAoeRangedTarget;
G.bossPartyHealTarget = bossPartyHealTarget;
G.bossPartyEnemyAttack = bossPartyEnemyAttack;
G.bossPartyPetAttack = bossPartyPetAttack;
G.bossPartyMarkPetDead = bossPartyMarkPetDead;
G.bossPartyMarkMemberDead = bossPartyMarkMemberDead;
G.bossPartyAllMembersDead = bossPartyAllMembersDead;
G.bossPartyNextAliveMember = bossPartyNextAliveMember;
G.bossPartyLeaderClassId = bossPartyLeaderClassId;
G.bossPartyLeaderMember = bossPartyLeaderMember;
G.bossPartyControlledClassId = bossPartyControlledClassId;
G.bossPartyControlledMember = bossPartyControlledMember;
G.bossPartyDamageTextOffset = bossPartyDamageTextOffset;
G.bossPartyShowEnemyDamage = bossPartyShowEnemyDamage;
G.bossPartyShowEnemyMiss = bossPartyShowEnemyMiss;
G.bossPartySyncControlledPlayerRef = bossPartySyncControlledPlayerRef;
G.bossPartyAliveRewardMembers = bossPartyAliveRewardMembers;
G.awardBossPartyKillShare = awardBossPartyKillShare;
G.awardBossPartyBossKillShare = awardBossPartyBossKillShare;
G.updateBossPartyDropPity = updateBossPartyDropPity;
G.bossPartyHasInventorySpaceFor = bossPartyHasInventorySpaceFor;
G.ensureBossPartyInventorySlots = ensureBossPartyInventorySlots;
G.bossPartyAddInventoryItem = bossPartyAddInventoryItem;
G.bossPartyCreateInventoryEntry = bossPartyCreateInventoryEntry;
G.bossPartyInventoryItemQuantity = bossPartyInventoryItemQuantity;
G.bossPartyInventoryEntries = bossPartyInventoryEntries;
G.bossPartyInventoryUsedSlots = bossPartyInventoryUsedSlots;
G.bossPartyCarriedInventoryEntries = bossPartyCarriedInventoryEntries;
G.bossPartyInventoryEntryById = bossPartyInventoryEntryById;
G.bossPartyIsEquippedEntry = bossPartyIsEquippedEntry;
G.bossPartyConsumeOneInventoryUnit = bossPartyConsumeOneInventoryUnit;
G.bossPartyHotbarEntryAtSlot = bossPartyHotbarEntryAtSlot;
G.bossPartyAutoUsePotions = bossPartyAutoUsePotions;
G.bossPartyResourceRatio = bossPartyResourceRatio;
G.updateBossPartyMemberPotionRegen = updateBossPartyMemberPotionRegen;
G.updateBossPartyMemberHealRegen = updateBossPartyMemberHealRegen;
G.bossPartyPoisonCandidate = bossPartyPoisonCandidate;
G.bossPartyAmuletCandidate = bossPartyAmuletCandidate;
G.bossPartyAmuletInventoryCount = bossPartyAmuletInventoryCount;
G.syncBossPartyMembersToCharacters = syncBossPartyMembersToCharacters;
G.bossPartySetWarriorSpellCastReadyAt = bossPartySetWarriorSpellCastReadyAt;
G.bossPartySpellCastReadyAt = bossPartySpellCastReadyAt;
G.bossPartySpellOnCooldown = bossPartySpellOnCooldown;
G.bossPartyHalfMoonSplash = bossPartyHalfMoonSplash;
G.bossPartySpellStrikeSfx = bossPartySpellStrikeSfx;
G.drawBossPartyCharacters = drawBossPartyCharacters;
G.bossPartyMembersByDepth = bossPartyMembersByDepth;
G.drawBossPartyDeadMembers = drawBossPartyDeadMembers;
G.drawBossPartyLivingMembers = drawBossPartyLivingMembers;
G.drawBossPartySpellFxCanvas = drawBossPartySpellFxCanvas;
G.drawBossPartyMemberSpellFx = drawBossPartyMemberSpellFx;
G.drawBossPartyHealFxCanvas = drawBossPartyHealFxCanvas;
G.drawBossPartyMemberCanvas = drawBossPartyMemberCanvas;
G.bossPartyMemberFrameBounds = bossPartyMemberFrameBounds;
G.bossPartySignature = bossPartySignature;
G.bossPartyStatusHtml = bossPartyStatusHtml;
