import {
  swarmAttackActionForLane,
  swarmEnemyRangedProjectileOrigin,
  swarmEnemyTilePosition,
  swarmLaneFromMapRow,
} from "./groupDungeonSwarm.js";

export const ZUMA_ARCHER_ATTACK_MODE = "zumaArcher";

export function isZumaArcherSwarmEnemy(swarmEnemy) {
  return swarmEnemy?.attackMode === ZUMA_ARCHER_ATTACK_MODE;
}

function zumaArcherCombatStats(entity) {
  return {
    rangeTiles: Math.max(1, Math.trunc(Number(entity?.attackRangeTiles) || 7)),
    impactDelayMs: Math.max(100, Math.trunc(Number(entity?.attackImpactDelayMs) || 400)),
    rangedExtraMs: Math.max(0, Math.trunc(Number(entity?.rangedAttackExtraMs) || 300)),
  };
}

/**
 * Factory for Zuma Archer swarm combat. Uses the same walk/attack cadence as other
 * swarm mobs — no custom movement hooks.
 */
export function createZumaArcherSwarmAttack(deps) {
  const {
    swarmEnemyToBattleEntity,
    arenaSpawnMapRow,
    bossPartyFrontTarget,
    bossPartyRandomRangedTargetInSwarmRange,
    swarmRangeTilesBetween,
    setSwarmEnemyAction,
    syncPrimarySwarmVisual,
    playMonsterSfx,
    enemyAttackSfxKind,
    swarmEnemyScreenAnchor,
    zumaArcherProjectileTargetAnchor,
    enemyProjectileVfxUntil,
    effectiveEnemyAttackMs,
    applySwarmEnemyStrikeToTarget,
    enemyRevealed,
  } = deps;

  function zumaArcherSwarmMeleeAttack(swarmEnemy, entity, target, tile, partyRow, now) {
    const attackAction = swarmAttackActionForLane(swarmLaneFromMapRow(tile.mapRow, partyRow));
    setSwarmEnemyAction(swarmEnemy, attackAction, true, now);
    syncPrimarySwarmVisual(swarmEnemy, attackAction, now);
    playMonsterSfx("attack", swarmEnemy);
    applySwarmEnemyStrikeToTarget(swarmEnemy, entity, target, now, { ranged: false });
    swarmEnemy.nextAttackAt = now + effectiveEnemyAttackMs(swarmEnemy, now);
    return true;
  }

  function zumaArcherSwarmRangedAttack(swarmEnemy, entity, target, now) {
    const { impactDelayMs, rangedExtraMs } = zumaArcherCombatStats(entity);
    const tile = swarmEnemyTilePosition(swarmEnemy);
    const partyRow = arenaSpawnMapRow();
    const attackAction = swarmAttackActionForLane(swarmLaneFromMapRow(tile.mapRow, partyRow));
    setSwarmEnemyAction(swarmEnemy, attackAction, true, now);
    syncPrimarySwarmVisual(swarmEnemy, attackAction, now);
    const projectile = swarmEnemy.atlas?.projectile;
    playMonsterSfx(enemyAttackSfxKind(entity, true), swarmEnemy, { force: true, throttleMs: 0 });
    const screenAnchor = swarmEnemyScreenAnchor(swarmEnemy);
    const origin = swarmEnemyRangedProjectileOrigin(swarmEnemy, screenAnchor);
    const end = zumaArcherProjectileTargetAnchor(target);
    swarmEnemy.pendingStrike = {
      startedAt: now,
      at: now + impactDelayMs,
      moveDurationMs: impactDelayMs,
      vfxUntil: Math.max(now + impactDelayMs, enemyProjectileVfxUntil(now, projectile)),
      ranged: true,
      target,
      originX: origin.x,
      originY: origin.y,
      targetAnchorX: end.x,
      targetAnchorY: end.y,
      resolved: false,
    };
    swarmEnemy.nextAttackAt = now + effectiveEnemyAttackMs(swarmEnemy, now) + rangedExtraMs;
    return true;
  }

  return function beginZumaArcherSwarmAttack(swarmEnemy, now) {
    if (!swarmEnemy || swarmEnemy.hp <= 0 || swarmEnemy.pendingStrike) return false;
    if (!enemyRevealed()) return false;

    const entity = swarmEnemyToBattleEntity(swarmEnemy);
    const tile = swarmEnemyTilePosition(swarmEnemy);
    const partyRow = arenaSpawnMapRow();
    const { rangeTiles } = zumaArcherCombatStats(entity);

    const tank = bossPartyFrontTarget();
    if (tank) {
      const tankDistance = swarmRangeTilesBetween(tile.worldX, tile.mapRow, tank.worldX, partyRow);
      if (tankDistance <= 1) {
        return zumaArcherSwarmMeleeAttack(swarmEnemy, entity, tank, tile, partyRow, now);
      }
    }

    const target = bossPartyRandomRangedTargetInSwarmRange(tile, partyRow, rangeTiles);
    if (!target) return false;

    return zumaArcherSwarmRangedAttack(swarmEnemy, entity, target, now);
  };
}
