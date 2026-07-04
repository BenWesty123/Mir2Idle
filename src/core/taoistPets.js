const HOLY_DEVA_BASE_MOVE_MS = 800;
const HOLY_DEVA_MIN_MOVE_MS = 400;
const HOLY_DEVA_MOVE_REDUCTION_PER_MAX_LEVEL_MS = 130;
const PET_ATTACK_REDUCTION_PER_MAX_LEVEL_MS = 70;
const PET_MIN_ATTACK_MS = 400;

export function crystalHolyDevaStats(baseStats, spellLevel, tilePx = 48) {
  const level = Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
  const maxPetLevel = 1 + level * 2;
  const moveMs = Math.max(
    HOLY_DEVA_MIN_MOVE_MS,
    HOLY_DEVA_BASE_MOVE_MS - maxPetLevel * HOLY_DEVA_MOVE_REDUCTION_PER_MAX_LEVEL_MS,
  );
  return {
    level,
    maxPetLevel,
    maxHp: baseStats.maxHp + level * 20,
    dc: [baseStats.dc[0] + level, baseStats.dc[1] + level],
    ac: [baseStats.ac[0] + level * 2, baseStats.ac[1] + level * 2],
    amc: [baseStats.amc[0] + level * 2, baseStats.amc[1] + level * 2],
    attackMs: Math.max(PET_MIN_ATTACK_MS, Math.trunc(baseStats.attackMs - maxPetLevel * PET_ATTACK_REDUCTION_PER_MAX_LEVEL_MS)),
    moveSpeed: Math.max(1, Number(tilePx) || 48) / (moveMs / 1000),
  };
}

export function shouldKeepHolyDevaBetweenSoloFights(pet, pendingPet) {
  const activeHolyDeva = pet?.spellId === "SummonHolyDeva"
    && Boolean(pet.active)
    && !pet.dead
    && Number(pet.hp) > 0;
  const pendingHolyDeva = pendingPet?.spellId === "SummonHolyDeva";
  return activeHolyDeva || pendingHolyDeva;
}

export function resolveTaoistPetTargetWorldX(enemyWorldX, battleEnemyX) {
  if (enemyWorldX != null && Number.isFinite(Number(enemyWorldX))) {
    return Number(enemyWorldX);
  }
  return Number.isFinite(Number(battleEnemyX)) ? Number(battleEnemyX) : 0;
}

export function resolveTaoistPetTargetCoordinates(swarmEnemy, battleEnemyX) {
  const mapRow = swarmEnemy?.mapRow != null && Number.isFinite(Number(swarmEnemy.mapRow))
    ? Math.trunc(Number(swarmEnemy.mapRow))
    : null;
  return {
    worldX: resolveTaoistPetTargetWorldX(swarmEnemy?.worldX, battleEnemyX),
    mapRow,
  };
}

export function taoistPetLayerBlendModes(atlas) {
  if (atlas?.overlays) {
    return { base: "screen", overlay: "source-over" };
  }
  return { base: "source-over", overlay: null };
}
