import {
  swarmEnemyRangedProjectileOrigin,
  swarmEnemyTilePosition,
  swarmLaneFromMapRow,
  swarmRangeAttackActionForLane,
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
    enemyRevealed,
  } = deps;

  function zumaArcherSwarmRangedAttack(swarmEnemy, entity, target, now) {
    const { impactDelayMs, rangedExtraMs } = zumaArcherCombatStats(entity);
    const tile = swarmEnemyTilePosition(swarmEnemy);
    const partyRow = arenaSpawnMapRow();
    const attackAction = swarmRangeAttackActionForLane(swarmLaneFromMapRow(tile.mapRow, partyRow));
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

    // Always MAC bolts (Hell Bolt analog). Melee-fallthrough used to dump them
    // onto the Warrior's AC once they walked in, so casters never felt them.
    const target = bossPartyRandomRangedTargetInSwarmRange(tile, partyRow, rangeTiles)
      ?? bossPartyFrontTarget();
    if (!target) return false;
    const dist = swarmRangeTilesBetween(tile.worldX, tile.mapRow, target.worldX, partyRow);
    if (dist > rangeTiles) return false;

    return zumaArcherSwarmRangedAttack(swarmEnemy, entity, target, now);
  };
}
