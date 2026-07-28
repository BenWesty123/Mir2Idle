export const WIZARD_MIRROR_ATTACK_RANGE_TILES = 6;
export const WIZARD_MIRROR_UPKEEP_MP = 10;
export const WIZARD_MIRROR_UPKEEP_INTERVAL_MS = 1000;
export const WIZARD_MIRROR_REACTION_DELAY_MS = 500;
export const WIZARD_MIRROR_MANY_OFFSET_Y = 28;
export const WIZARD_MIRROR_MANY_EXTRA_STAGGER_MS = 200;

const MIRRORING_DURATION_MS = [120000, 180000, 360000, 540000];
// Rank 3 keeps today's full mirror damage; lower ranks scale down evenly.
const MIRRORING_DAMAGE_MULTIPLIER = [0.55, 0.7, 0.85, 1];

export function wizardMirrorDurationMs(spellLevel) {
  const level = Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
  return MIRRORING_DURATION_MS[level];
}

export function wizardMirrorDamageMultiplier(spellLevel) {
  const level = Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
  return MIRRORING_DAMAGE_MULTIPLIER[level];
}

export function scaleWizardMirrorDamage(damage, spellLevel) {
  const amount = Math.max(0, Math.trunc(Number(damage) || 0));
  if (amount <= 0) return 0;
  return Math.max(1, Math.floor(amount * wizardMirrorDamageMultiplier(spellLevel)));
}

export function pickWizardMirrorAttackSpell({
  enemyUndead = false,
  flameDisruptorLearned = false,
  fireballOnly = false,
} = {}) {
  if (fireballOnly) return "FireBall";
  return !enemyUndead && flameDisruptorLearned ? "FlameDisruptor" : "ThunderBolt";
}

export function wizardMirrorManyExtraOffsets(offsetY = WIZARD_MIRROR_MANY_OFFSET_Y) {
  const gap = Math.max(8, Math.trunc(Number(offsetY) || WIZARD_MIRROR_MANY_OFFSET_Y));
  return [
    { id: "above", offsetY: -gap },
    { id: "below", offsetY: gap },
  ];
}

export function wizardMirrorCastSfxPhase(impactMode) {
  if (impactMode === "target") return null;
  return impactMode === "projectile" ? "fly" : "cast";
}

export function wizardMirrorAttackRangePx(tilePx = 48, { formationDepthPx = 0, enemyMeleeGapPx = 0 } = {}) {
  const cell = Math.max(1, Number(tilePx) || 48);
  const base = WIZARD_MIRROR_ATTACK_RANGE_TILES * cell;
  // Boss-party Wizard stands several tiles behind the tank; large bosses also
  // rest farther out (bossMeleeGap). Stretch just enough to still reach.
  const needed = Math.max(0, Number(formationDepthPx) || 0) + Math.max(0, Number(enemyMeleeGapPx) || 0);
  return Math.max(base, needed);
}

export function wizardMirrorTargetInRange(ownerWorldX, enemyWorldX, tilePx = 48, maxRangePx = null) {
  const ownerX = Number(ownerWorldX);
  const targetX = Number(enemyWorldX);
  const cellWidth = Math.max(1, Number(tilePx) || 48);
  if (!Number.isFinite(ownerX) || !Number.isFinite(targetX)) return false;
  const range = Number.isFinite(Number(maxRangePx)) && Number(maxRangePx) > 0
    ? Number(maxRangePx)
    : WIZARD_MIRROR_ATTACK_RANGE_TILES * cellWidth;
  return Math.abs(targetX - ownerX) <= range;
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
