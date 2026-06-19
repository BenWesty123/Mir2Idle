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

import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function groupDungeonEntrySceneHtml(zone) {
  const selected = G.selectedBossAssistIds();
  return `
    <section class="boss-entry-panel">
      <p class="boss-warning">
        You're entering ${G.escapeHtml(zone.label)} with your ${G.escapeHtml(state.activeCharacterId)}.
      </p>
      <p class="boss-warning muted">
        Your party will hold position in the room while monsters come to you.
      </p>
      <dl class="boss-entry-stats">
        <dt>Zone</dt><dd>${G.escapeHtml(zone.label)}</dd>
        <dt>Party</dt><dd>${1 + selected.size}</dd>
        <dt>Leader</dt><dd>${G.escapeHtml(state.activeCharacterId)}</dd>
      </dl>
      ${G.partyAssistPickerHtml()}
      <footer class="boss-entry-footer">
        <button
          type="button"
          class="primary boss-entry-fight-button"
          data-confirm-boss-zone="${G.escapeHtml(zone.id)}"
        >
          Enter ${G.escapeHtml(zone.label)}
        </button>
      </footer>
    </section>
  `;
}

function groupDungeonZone(zone = G.activeZone()) {
  return Boolean(zone?.groupDungeon);
}

function groupDungeonSwarmActive() {
  return groupDungeonZone() && Boolean(state.battle.bossParty?.active && state.battle.swarm);
}

function groupDungeonWaveState() {
  return state.battle.swarm?.waves ?? null;
}

function groupDungeonWaveSignature() {
  const waves = groupDungeonWaveState();
  if (!waves) return null;
  return {
    waveNumber: waves.waveNumber,
    spawnedThisWave: waves.spawnedThisWave,
    killedThisWave: waves.killedThisWave,
    targetThisWave: waves.targetThisWave,
    spawningComplete: waves.spawningComplete,
    floorComplete: waves.floorComplete,
    endless: waves.endless,
    living: groupDungeonSwarmLivingCount(),
  };
}

function groupDungeonSwarmLivingCount(swarm = state.battle.swarm) {
  return (swarm?.enemies ?? []).filter((enemy) => enemy.hp > 0 && !enemy.dying).length;
}

function groupDungeonSwarmAliveCount(swarm = state.battle.swarm) {
  return groupDungeonSwarmLivingCount(swarm);
}

function groupDungeonWaveFieldCap(waves = groupDungeonWaveState()) {
  if (!waves) return GROUP_DUNGEON_WAVE_FIELD_CAP;
  if (waves.targetThisWave <= GROUP_DUNGEON_WAVE_INSTANT_CAP) return waves.targetThisWave;
  return GROUP_DUNGEON_WAVE_FIELD_CAP;
}

function groupDungeonWaveOutstandingCount(waves = groupDungeonWaveState()) {
  if (!waves || waves.betweenWaves || (waves.floorComplete && !waves.endless)) return 0;
  return Math.max(0, waves.targetThisWave - waves.killedThisWave - groupDungeonSwarmLivingCount());
}

function groupDungeonWavePendingSpawnCount(waves = groupDungeonWaveState()) {
  const outstanding = groupDungeonWaveOutstandingCount(waves);
  if (outstanding <= 0) return 0;
  const living = groupDungeonSwarmLivingCount();
  const fieldCap = groupDungeonWaveFieldCap(waves);
  if (living >= fieldCap) return 0;
  return Math.min(outstanding, fieldCap - living);
}

function groupDungeonWaveRefillBatchCount(waves = groupDungeonWaveState()) {
  const pending = groupDungeonWavePendingSpawnCount(waves);
  if (pending <= 0) return 0;

  if (waves.targetThisWave <= GROUP_DUNGEON_WAVE_INSTANT_CAP) return pending;

  if (waves.spawnedThisWave < GROUP_DUNGEON_WAVE_FIELD_CAP) return pending;
  if (groupDungeonSwarmLivingCount() >= GROUP_DUNGEON_WAVE_REFILL_THRESHOLD) return 0;
  return Math.min(GROUP_DUNGEON_WAVE_REFILL_BATCH, pending);
}

function updateGroupDungeonWaves(now) {
  const swarm = state.battle.swarm;
  const waves = swarm?.waves;
  if (!waves || waves.betweenWaves) return;

  G.reconcileGroupDungeonSwarmDeaths(now);
  G.reconcileGroupDungeonWaveKillCount();

  if (groupDungeonWaveOutstandingCount(waves) <= 0) {
    waves.spawningComplete = true;
    return;
  }

  const batch = groupDungeonWaveRefillBatchCount(waves);
  if (batch <= 0) return;
  if (now < waves.nextSpawnAt && groupDungeonSwarmLivingCount() > 0) return;

  G.spawnGroupDungeonWaveBurst(now, batch);
  if (groupDungeonWaveOutstandingCount(waves) <= 0) waves.spawningComplete = true;
  else waves.nextSpawnAt = now + GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS;
  G.markGroupDungeonWaveUiDirty();
}

function groupDungeonWaveStatusText(waves) {
  if (!waves) return { main: "", sub: "" };

  const main = `${waves.killedThisWave} / ${waves.targetThisWave} defeated`;
  const living = groupDungeonSwarmLivingCount();
  const incoming = groupDungeonWaveOutstandingCount(waves);
  const subParts = [];
  if (living > 0) subParts.push(`${living} still fighting`);
  if (incoming > 0) subParts.push(`${incoming} incoming`);
  return { main, sub: subParts.join(" · ") };
}

function groupDungeonWaveProgressLabel(waves) {
  const { main, sub } = groupDungeonWaveStatusText(waves);
  if (!main) return "";
  return sub ? `${main} · ${sub}` : main;
}

function groupDungeonWaveSidePanelHtml() {
  const waves = groupDungeonWaveState();
  if (!waves) return "";
  const zone = G.groupDungeonWaveZone?.() ?? G.activeZone();
  const wavesPerFloor = groupDungeonWavesPerFloor(zone);
  const floorLabel = waves.endless
    ? `Endless · Wave ${waves.waveNumber}`
    : `Wave ${Math.min(waves.waveNumber, wavesPerFloor)} / ${wavesPerFloor}`;
  const { main, sub } = groupDungeonWaveStatusText(waves);
  const tracker = Array.from({ length: wavesPerFloor }, (_, index) => {
    const wave = index + 1;
    let className = "group-dungeon-wave-dot";
    if (wave < waves.waveNumber || (waves.floorComplete && !waves.endless)) className += " is-done";
    else if (wave === waves.waveNumber && !waves.floorComplete) className += " is-active";
    return `<span class="${className}" aria-label="Wave ${wave}"></span>`;
  }).join("");
  return `
    <section class="game-card group-dungeon-wave-card">
      <div class="game-card-title">
        <strong>Waves</strong>
        <span>${G.escapeHtml(floorLabel)}</span>
      </div>
      <div class="group-dungeon-wave-track" aria-hidden="true">${tracker}</div>
      <p class="group-dungeon-wave-status"><strong>${G.escapeHtml(main)}</strong>${sub ? `<span>${G.escapeHtml(sub)}</span>` : ""}</p>
    </section>
  `;
}

function groupDungeonSwarmMeleeWorldX() {
  const target = G.bossPartyFrontTarget();
  const frontX = Number(target?.worldX);
  if (Number.isFinite(frontX)) return swarmMeleeColumnWorldX(frontX);
  const slotX = G.bossPartyMeleeFrontWorldX();
  if (Number.isFinite(slotX)) return swarmMeleeColumnWorldX(slotX);
  return swarmMeleeColumnWorldX(0);
}

function groupDungeonSwarmFireWallCenterTile() {
  return {
    worldX: swarmSnapTileX(groupDungeonSwarmMeleeWorldX()),
    mapRow: G.arenaSpawnMapRow(),
  };
}

function groupDungeonSwarmOffscreenSpawnX() {
  const cameraX = Number(state.battle.cameraX);
  const resolvedCamera = Number.isFinite(cameraX)
    ? cameraX
    : (Number(state.battle.playerX) || 0) - G.playerScreenX();
  const screenEdge = Math.round(resolvedCamera + state.stageWidth + 96);
  const swarm = state.battle.swarm;
  const eastmost = (swarm?.enemies ?? [])
    .filter((entry) => entry.hp > 0 && !entry.dying)
    .reduce((max, entry) => Math.max(max, Math.round(Number(entry.worldX) || 0)), 0);
  return Math.max(screenEdge, eastmost + LANE_TILE_PX);
}

async function ensureSwarmEnemyAtlas(enemy) {
  if (enemy.atlas) return enemy.atlas;
  const atlas = await loadJson(`./public/monsters/monster/${enemy.monsterIndex}.json`).catch(() => null);
  ensureSwarmDirectionalActions(atlas);
  enemy.atlas = atlas;
  await G.loadCachedImage(`./public/monsters/monster/${enemy.monsterIndex}.png`).catch(() => null);
  return atlas;
}

function groupDungeonPrimarySwarmEnemy(swarm = state.battle.swarm) {
  if (!swarm?.enemies?.length) return null;
  const alive = swarm.enemies.filter((enemy) => enemy.hp > 0 && !enemy.dying);
  if (!alive.length) return null;
  const meleeCol = swarmSnapTileX(groupDungeonSwarmMeleeWorldX());
  const spawnRow = G.arenaSpawnMapRow();
  const engaged = alive
    .filter((enemy) => swarmEnemyInAttackRange(enemy, meleeCol))
    .sort((a, b) => Math.abs(a.mapRow - spawnRow) - Math.abs(b.mapRow - spawnRow));
  if (engaged.length) return engaged[0];
  const cameraX = Number(state.battle.cameraX);
  const visibleEdgeX = (Number.isFinite(cameraX) ? cameraX : meleeCol) + state.stageWidth - 32;
  const visible = alive.filter((enemy) => enemy.worldX <= visibleEdgeX);
  const pool = visible.length ? visible : alive;
  return pool.slice().sort((a, b) => {
    const da = Math.abs(a.worldX - meleeCol) + Math.abs(a.mapRow - spawnRow) * GROUP_DUNGEON_SWARM_CELL_HEIGHT;
    const db = Math.abs(b.worldX - meleeCol) + Math.abs(b.mapRow - spawnRow) * GROUP_DUNGEON_SWARM_CELL_HEIGHT;
    return da - db;
  })[0] ?? null;
}

function swarmEnemyToBattleEntity(swarmEnemy) {
  if (!swarmEnemy) return null;
  const template = ENEMY_TEMPLATES.find((entry) => entry.id === swarmEnemy.templateId);
  return {
    ...(template ?? {}),
    id: swarmEnemy.templateId,
    name: swarmEnemy.name,
    level: swarmEnemy.level,
    maxHp: swarmEnemy.maxHp,
    maxMp: swarmEnemy.maxMp,
    hp: swarmEnemy.hp,
    mp: swarmEnemy.mp,
    dc: swarmEnemy.dc,
    mc: swarmEnemy.mc,
    sc: swarmEnemy.sc,
    ac: swarmEnemy.ac,
    amc: swarmEnemy.amc,
    accuracy: swarmEnemy.accuracy,
    agility: swarmEnemy.agility,
    luck: swarmEnemy.luck,
    attackMs: swarmEnemy.attackMs,
    moveMs: swarmEnemy.moveMs,
    experience: swarmEnemy.experience,
    monsterIndex: swarmEnemy.monsterIndex,
    poisons: swarmEnemy.poisons,
    debuffs: swarmEnemy.debuffs,
    swarmId: swarmEnemy.id,
  };
}

function swarmEnemyWalkInProgress(enemy) {
  return enemy?.stepToX != null;
}

function swarmIsWalkAction(action) {
  return action === "walking"
    || action === "walkEast"
    || action === "walkNorth"
    || action === "walkSouth"
    || action === "walkNorthWest"
    || action === "walkSouthWest";
}

function swarmMapRowAnchorY(mapRow) {
  const spawnRow = G.arenaSpawnMapRow();
  const laneY = Math.floor(state.stageHeight * LANE.y);
  const enemyOffsetY = Math.trunc(Number(G.activeZone()?.arenaEnemyOffsetY) || 0);
  return laneY + (Math.trunc(mapRow) - spawnRow) * GROUP_DUNGEON_SWARM_CELL_HEIGHT + enemyOffsetY;
}

function swarmGroundSpellAnchorY(mapRow) {
  return swarmMapRowAnchorY(mapRow) + GROUP_DUNGEON_SWARM_CELL_HEIGHT;
}

function swarmEnemyWalkStepProgress(enemy) {
  if (enemy.stepToX == null) return 1;
  const clip = enemy.atlas?.actions?.[enemy.action];
  const count = clip?.frames?.length ?? 1;
  return Math.min(1, (enemy.frame + 1) / count);
}

function swarmEnemyWalkDrawOffset(enemy) {
  if (enemy.stepToX == null) return { x: 0, y: 0 };
  const back = 1 - swarmEnemyWalkStepProgress(enemy);
  return {
    x: Math.round((Number(enemy.stepFromX) - Number(enemy.stepToX)) * back),
    y: Math.round((Number(enemy.stepFromMapRow) - Number(enemy.stepToMapRow)) * GROUP_DUNGEON_SWARM_CELL_HEIGHT * back),
  };
}

function swarmEnemyScreenAnchor(enemy) {
  const tile = swarmEnemyTilePosition(enemy);
  const offset = swarmEnemyWalkDrawOffset(enemy);
  return {
    x: Math.floor(tile.worldX - state.battle.cameraX + offset.x),
    y: swarmMapRowAnchorY(tile.mapRow) + offset.y,
  };
}

function updateGroupDungeonSwarmMovement(now) {
  const swarm = state.battle.swarm;
  if (!swarm) return;
  const meleeCol = swarmSnapTileX(groupDungeonSwarmMeleeWorldX());
  const arenaSpawnRow = G.arenaSpawnMapRow();

  for (const enemy of swarm.enemies) {
    if (enemy.hp <= 0 || enemy.dying) {
      G.resetSwarmEnemyWalkState(enemy, now);
      if (!enemy.dying) G.setSwarmEnemyLocomotion(enemy, "standing", now);
      continue;
    }
    if (G.enemyFrozenActive(enemy, now)) {
      G.resetSwarmEnemyWalkState(enemy, now);
      G.setSwarmEnemyLocomotion(enemy, "standing", now);
      continue;
    }

    if (enemy.stepToX != null) continue;

    if (enemy.oneShot && enemy.action !== "standing") continue;

    // Crystal ProcessTarget: in attack range -> stop moving, face the target.
    if (swarmEnemyInAttackRange(enemy, meleeCol)) {
      G.setSwarmEnemyLocomotion(enemy, swarmEnemyEngagedStanceAction(enemy, meleeCol, arenaSpawnRow), now);
      continue;
    }

    if (now < (enemy.nextMoveAt ?? 0)) continue;

    const tile = swarmEnemyTilePosition(enemy);
    const step = swarmPickWalkStep(enemy, meleeCol, arenaSpawnRow, swarm.enemies);
    if (step) {
      G.beginSwarmEnemyTileStep(enemy, step.action, tile.worldX, tile.mapRow, step.toX, step.toMapRow, now);
      continue;
    }
    G.setSwarmEnemyLocomotion(enemy, "standing", now);
    enemy.nextMoveAt = now + GROUP_DUNGEON_SWARM_BLOCKED_RETRY_MS;
  }
}

function updateGroupDungeonSwarmEnemyFrame(enemy, now) {
  const clip = enemy.atlas?.actions?.[enemy.action];
  if (state.paused || !clip?.frames?.length) return;
  const dt = now - (enemy.lastTick ?? now);
  if (dt < clip.interval) return;
  const steps = Math.floor(dt / clip.interval);
  const terminal = enemy.oneShot || enemy.action === "struck" || enemy.action === "die";
  if (terminal) {
    const nextFrame = enemy.frame + steps;
    if (nextFrame >= clip.frames.length) {
      if (enemy.action === "die") {
        enemy.frame = clip.frames.length - 1;
        enemy.removeAt = now + 120;
      } else if (enemy.hp > 0) {
        if (enemy.stepToX != null && swarmIsWalkAction(enemy.action)) {
          G.completeSwarmEnemyStep(enemy, now);
        } else {
          const meleeCol = swarmSnapTileX(groupDungeonSwarmMeleeWorldX());
          enemy.action = swarmEnemyEngagedStanceAction(enemy, meleeCol, G.arenaSpawnMapRow());
          enemy.frame = 0;
          enemy.oneShot = false;
          enemy.lastTick = now;
        }
      } else {
        enemy.frame = clip.frames.length - 1;
      }
    } else {
      enemy.frame = nextFrame;
    }
  } else {
    enemy.frame = (enemy.frame + steps) % clip.frames.length;
  }
  enemy.lastTick += steps * clip.interval;
}

function updateGroupDungeonSwarmFrames(now) {
  const swarm = state.battle.swarm;
  if (!swarm) return;
  for (const enemy of swarm.enemies) updateGroupDungeonSwarmEnemyFrame(enemy, now);
  G.syncGroupDungeonPrimaryEnemy();
}

function groupDungeonSwarmEnemyAttack(swarmEnemy, now) {
  const target = G.bossPartyFrontTarget();
  if (!swarmEnemy || !target || swarmEnemy.hp <= 0 || !state.battle.enemyRevealed) return false;
  const meleeCol = swarmSnapTileX(groupDungeonSwarmMeleeWorldX());
  if (!swarmEnemyInAttackRange(swarmEnemy, meleeCol)) return false;
  const lane = swarmLaneFromMapRow(swarmEnemyTilePosition(swarmEnemy).mapRow, G.arenaSpawnMapRow());
  const attackAction = swarmAttackActionForLane(lane);
  G.setSwarmEnemyAction(swarmEnemy, attackAction, true, now);
  if (swarmEnemy.id === groupDungeonPrimarySwarmEnemy()?.id) {
    state.enemy.action = attackAction;
    state.enemy.frame = 0;
    state.enemy.oneShot = true;
    state.enemy.lastTick = now;
  }
  G.playMonsterSfx("attack", swarmEnemy);
  const { hit, damage } = G.resolveIncomingEnemyAttack(swarmEnemy, G.defenceTargetForIncomingAttack(target));
  if (!hit) {
    G.addCombatText(target.classId === G.bossPartyControlledClassId() ? "player" : "enemy", "Miss", "miss", now);
    G.pushBattleLog(`${swarmEnemy.name} misses ${target.name}.`);
    return true;
  }
  target.hp = Math.max(0, target.hp - damage);
  if (target === state.battle.bossParty.pet) {
    G.setTaoPetAction("struck", true, now);
    if (target.hp <= 0) G.bossPartyMarkPetDead(now);
  } else if (target.classId === G.bossPartyControlledClassId()) {
    G.setPlayerAction("struck", now + 250, true);
    G.addCombatText("player", damage, "enemyDamage", now);
    G.playSfx("player.flinch", G.bossPartySfxParams(target, 0.45, 120));
  } else {
    target.visualAction = "struck";
    target.visualFrame = 0;
    target.visualOneShot = true;
    target.visualLastTick = now;
    G.playSfx("player.flinch", G.bossPartySfxParams(target, 0.45, 120));
  }
  G.pushBattleLog(`${swarmEnemy.name} hits ${target.name} for ${damage}.`);
  if (target !== state.battle.bossParty.pet && target.hp <= 0) G.bossPartyMarkMemberDead(target, now);
  return true;
}

function updateGroupDungeonBossPartyBattle(now) {
  const party = state.battle.bossParty;
  const swarm = state.battle.swarm;
  if (!party?.active || !swarm) return false;
  G.bossPartySyncControlledPlayerRef();
  G.updateBossPartyVisualFrames(now);
  G.updateBossPartyMeleeAdvance(now);
  for (const member of party.members) {
    G.updateBossPartyMemberPotionRegen(member, now);
    G.updateBossPartyMemberHealRegen(member, now);
    G.bossPartyAutoUsePotions(member, now);
  }
  if (party.pet) G.updateBossPartyMemberHealRegen(party.pet, now);
  G.syncBossPartyControlledRecoveryToState();
  G.updateEnemyPoisons(now);
  G.updateBossPartyPendingPoison(now);
  G.updateGroundSpellEffects(now);
  G.updateBossPartyEffects(now);
  G.updateBossPartyImpacts(now);
  G.updateBossPartyHealFx(now);
  G.updateDefenceBuffFx(now);
  G.updatePendingTwinDrakeHits(now);
  G.updateAttachedSpellFx(now);
  G.updatePendingEnemyStrike(now);
  G.updatePendingPetAttack(now);
  G.updateCombatantPoisons(now);
  if (G.bossPartyAllMembersDead()) {
    G.finishBossPartyDefeat(now);
    return true;
  }

  updateGroupDungeonWaves(now);

  updateGroupDungeonSwarmMovement(now);
  G.pruneGroupDungeonSwarmEnemies(now);
  G.syncGroupDungeonPrimaryEnemy();
  G.finishGroupDungeonWaveIfReady(now);

  const enemy = state.battle.enemy;
  if (party.pet?.active && now >= (party.pet.nextAttackAt ?? 0)) G.bossPartyPetAttack(now);

  for (const member of party.members) {
    if (!member.alive || member.hp <= 0 || now < (member.nextActionAt ?? 0)) continue;
    if (G.bossPartyMemberIsWalkingToMelee(member)) continue;
    G.bossPartyMemberAction(member, now);
  }

  for (const swarmEnemy of swarm.enemies) {
    if (swarmEnemy.hp <= 0 || swarmEnemy.dying) continue;
    if (G.enemyFrozenActive(swarmEnemy, now)) continue;
    if (swarmEnemy.stepToX != null) continue;
    if (swarmEnemy.oneShot && swarmEnemy.action !== "standing") continue;
    if (now < (swarmEnemy.nextAttackAt ?? 0)) continue;
    if (groupDungeonSwarmEnemyAttack(swarmEnemy, now)) {
      swarmEnemy.nextAttackAt = now + G.effectiveEnemyAttackMs(swarmEnemy, now);
    }
  }

  // Crystal ActionFeed ordering: flinches play only after movement and attacks resolve.
  for (const swarmEnemy of swarm.enemies) {
    G.tryConsumeSwarmEnemyPendingStruck(swarmEnemy, now);
  }

  G.updateBossPartyMeleeAdvance(now);
  G.bossPartySyncControlledPlayerRef();
  if (!G.isPlayerOneShotAction()) G.setPlayerLocomotion("stance", now);
  return true;
}

function swarmEnemyFrameBounds(enemy) {
  const { x: anchorX, y: anchorY } = swarmEnemyScreenAnchor(enemy);
  const atlas = enemy.atlas ?? state.enemy.atlas;
  const clip = atlas?.actions?.[enemy.action];
  const meta = clip?.frames?.[enemy.frame] ?? clip?.frames?.[0];
  if (!atlas || !meta || meta.empty) {
    return { centerX: anchorX, topY: anchorY - 64, width: 96, height: 112 };
  }
  const width = meta.w || atlas.slotWidth;
  const height = meta.h || atlas.slotHeight;
  return {
    centerX: anchorX + meta.offsetX + width / 2,
    topY: anchorY + meta.offsetY,
    width,
    height,
  };
}


G.groupDungeonEntrySceneHtml = groupDungeonEntrySceneHtml;
G.groupDungeonZone = groupDungeonZone;
G.groupDungeonSwarmActive = groupDungeonSwarmActive;
G.groupDungeonWaveState = groupDungeonWaveState;
G.groupDungeonWaveSignature = groupDungeonWaveSignature;
G.groupDungeonSwarmLivingCount = groupDungeonSwarmLivingCount;
G.groupDungeonSwarmAliveCount = groupDungeonSwarmAliveCount;
G.groupDungeonWaveFieldCap = groupDungeonWaveFieldCap;
G.groupDungeonWaveOutstandingCount = groupDungeonWaveOutstandingCount;
G.groupDungeonWavePendingSpawnCount = groupDungeonWavePendingSpawnCount;
G.groupDungeonWaveRefillBatchCount = groupDungeonWaveRefillBatchCount;
G.updateGroupDungeonWaves = updateGroupDungeonWaves;
G.groupDungeonWaveStatusText = groupDungeonWaveStatusText;
G.groupDungeonWaveProgressLabel = groupDungeonWaveProgressLabel;
G.groupDungeonWaveSidePanelHtml = groupDungeonWaveSidePanelHtml;
G.groupDungeonSwarmMeleeWorldX = groupDungeonSwarmMeleeWorldX;
G.groupDungeonSwarmFireWallCenterTile = groupDungeonSwarmFireWallCenterTile;
G.groupDungeonSwarmOffscreenSpawnX = groupDungeonSwarmOffscreenSpawnX;
G.ensureSwarmEnemyAtlas = ensureSwarmEnemyAtlas;
G.groupDungeonPrimarySwarmEnemy = groupDungeonPrimarySwarmEnemy;
G.swarmEnemyToBattleEntity = swarmEnemyToBattleEntity;
G.swarmEnemyWalkInProgress = swarmEnemyWalkInProgress;
G.swarmIsWalkAction = swarmIsWalkAction;
G.swarmMapRowAnchorY = swarmMapRowAnchorY;
G.swarmGroundSpellAnchorY = swarmGroundSpellAnchorY;
G.swarmEnemyWalkStepProgress = swarmEnemyWalkStepProgress;
G.swarmEnemyWalkDrawOffset = swarmEnemyWalkDrawOffset;
G.swarmEnemyScreenAnchor = swarmEnemyScreenAnchor;
G.updateGroupDungeonSwarmMovement = updateGroupDungeonSwarmMovement;
G.updateGroupDungeonSwarmEnemyFrame = updateGroupDungeonSwarmEnemyFrame;
G.updateGroupDungeonSwarmFrames = updateGroupDungeonSwarmFrames;
G.groupDungeonSwarmEnemyAttack = groupDungeonSwarmEnemyAttack;
G.updateGroupDungeonBossPartyBattle = updateGroupDungeonBossPartyBattle;
G.swarmEnemyFrameBounds = swarmEnemyFrameBounds;
