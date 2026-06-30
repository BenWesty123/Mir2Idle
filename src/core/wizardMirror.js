export const WIZARD_MIRROR_ATTACK_RANGE_TILES = 6;
export const WIZARD_MIRROR_UPKEEP_MP = 10;
export const WIZARD_MIRROR_UPKEEP_INTERVAL_MS = 1000;
export const WIZARD_MIRROR_REACTION_DELAY_MS = 500;

const MIRRORING_DURATION_MS = [120000, 180000, 360000, 540000];

export function wizardMirrorDurationMs(spellLevel) {
  const level = Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
  return MIRRORING_DURATION_MS[level];
}

export function pickWizardMirrorAttackSpell({ enemyUndead = false, flameDisruptorLearned = false } = {}) {
  return !enemyUndead && flameDisruptorLearned ? "FlameDisruptor" : "ThunderBolt";
}

export function wizardMirrorCastSfxPhase(impactMode) {
  if (impactMode === "target") return null;
  return impactMode === "projectile" ? "fly" : "cast";
}

export function wizardMirrorTargetInRange(ownerWorldX, enemyWorldX, tilePx = 48) {
  const ownerX = Number(ownerWorldX);
  const targetX = Number(enemyWorldX);
  const cellWidth = Math.max(1, Number(tilePx) || 48);
  if (!Number.isFinite(ownerX) || !Number.isFinite(targetX)) return false;
  return Math.abs(targetX - ownerX) <= WIZARD_MIRROR_ATTACK_RANGE_TILES * cellWidth;
}

export function resolveWizardMirrorUpkeep({ ownerMp, nextUpkeepAt, now } = {}) {
  const mp = Math.max(0, Number(ownerMp) || 0);
  const currentTime = Number(now) || 0;
  const scheduledAt = Number(nextUpkeepAt);
  const nextAt = Number.isFinite(scheduledAt) && scheduledAt > 0
    ? scheduledAt
    : currentTime + WIZARD_MIRROR_UPKEEP_INTERVAL_MS;

  if (currentTime < nextAt) {
    return { ownerMp: mp, nextUpkeepAt: nextAt, ticks: 0, spentMp: 0, exhausted: mp <= 0 };
  }

  const ticks = Math.floor((currentTime - nextAt) / WIZARD_MIRROR_UPKEEP_INTERVAL_MS) + 1;
  const requestedMp = ticks * WIZARD_MIRROR_UPKEEP_MP;
  const remainingMp = Math.max(0, mp - requestedMp);
  return {
    ownerMp: remainingMp,
    nextUpkeepAt: nextAt + ticks * WIZARD_MIRROR_UPKEEP_INTERVAL_MS,
    ticks,
    spentMp: mp - remainingMp,
    exhausted: remainingMp <= 0,
  };
}

export function advanceWizardMirrorFollow({
  worldX,
  desiredWorldX,
  now,
  lastMoveAt,
  followAfter = 0,
  movementBlocked = false,
  ownerRunning = false,
  walkSpeed = 0,
  runSpeed = 0,
} = {}) {
  const currentX = Number(worldX) || 0;
  const targetX = Number(desiredWorldX) || 0;
  const currentTime = Number(now) || 0;
  const previousTime = Number(lastMoveAt);
  const nextLastMoveAt = currentTime;
  if (movementBlocked || currentTime < (Number(followAfter) || 0)) {
    return { worldX: currentX, lastMoveAt: nextLastMoveAt, moving: false, action: "stance" };
  }

  const distance = targetX - currentX;
  if (Math.abs(distance) <= 1) {
    return { worldX: targetX, lastMoveAt: nextLastMoveAt, moving: false, action: "stance" };
  }

  const elapsedMs = Number.isFinite(previousTime)
    ? Math.min(100, Math.max(0, currentTime - previousTime))
    : 0;
  if (elapsedMs <= 0) {
    return { worldX: currentX, lastMoveAt: nextLastMoveAt, moving: true, action: ownerRunning ? "running" : "walking" };
  }

  const running = Boolean(ownerRunning);
  const speed = Math.max(1, Number(running ? runSpeed : walkSpeed) || 1);
  const step = speed * elapsedMs / 1000;
  const nextX = Math.abs(distance) <= step ? targetX : currentX + Math.sign(distance) * step;
  return {
    worldX: nextX,
    lastMoveAt: nextLastMoveAt,
    moving: Math.abs(targetX - nextX) > 1,
    action: running ? "running" : "walking",
  };
}
