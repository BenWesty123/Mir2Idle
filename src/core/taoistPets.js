const HOLY_DEVA_BASE_MOVE_MS = 800;
const HOLY_DEVA_MIN_MOVE_MS = 400;
const HOLY_DEVA_MOVE_REDUCTION_PER_MAX_LEVEL_MS = 130;
const PET_ATTACK_REDUCTION_PER_MAX_LEVEL_MS = 70;
const PET_MIN_ATTACK_MS = 400;

/** Summon spell skill level (0–3) → starting pet combat level. */
export const TAOIST_PET_LEVEL_BY_SPELL_LEVEL = [0, 2, 4, 7];

/** Flat multiplier applied to pet HP / DC / AC / MAC after Crystal level scaling. */
export const TAOIST_PET_STAT_BUFF_MULTIPLIER = 1.25;

export function clampTaoistSpellLevel(spellLevel) {
  return Math.max(0, Math.min(3, Math.trunc(Number(spellLevel) || 0)));
}

export function taoistPetLevelFromSpellLevel(spellLevel) {
  return TAOIST_PET_LEVEL_BY_SPELL_LEVEL[clampTaoistSpellLevel(spellLevel)];
}

export function taoistPetMaxLevelFromSpellLevel(spellLevel, spellId = null) {
  const level = clampTaoistSpellLevel(spellLevel);
  if (spellId === "SummonSkeleton") return 4 + level;
  return 1 + level * 2;
}

function scalePetStatRange(baseRange, petLevel, flatBonusPerEnd = 0) {
  const bonus = Math.max(0, Math.trunc(Number(petLevel) || 0)) * flatBonusPerEnd;
  const buff = TAOIST_PET_STAT_BUFF_MULTIPLIER;
  return [
    Math.trunc((Number(baseRange[0]) + bonus) * buff),
    Math.trunc((Number(baseRange[1]) + bonus) * buff),
  ];
}

/** Crystal RefreshAll pet bonuses (+25% buff) for HP, DC, AC, and MAC. */
export function taoistPetCombatStats(baseStats, petLevel) {
  const level = Math.max(0, Math.trunc(Number(petLevel) || 0));
  const buff = TAOIST_PET_STAT_BUFF_MULTIPLIER;
  const maxHp = Math.trunc((Number(baseStats.maxHp) + level * 20) * buff);
  return {
    maxHp,
    dc: scalePetStatRange(baseStats.dc, level, 1),
    ac: scalePetStatRange(baseStats.ac, level, 2),
    amc: scalePetStatRange(baseStats.amc, level, 2),
  };
}

export function taoistPetAttackDelayMs(baseAttackMs, maxPetLevel) {
  const cap = Math.max(0, Math.trunc(Number(maxPetLevel) || 0));
  return Math.max(
    PET_MIN_ATTACK_MS,
    Math.trunc(Number(baseAttackMs) - cap * PET_ATTACK_REDUCTION_PER_MAX_LEVEL_MS),
  );
}

export function crystalHolyDevaStats(baseStats, spellLevel, tilePx = 48) {
  const spellLvl = clampTaoistSpellLevel(spellLevel);
  const petLevel = taoistPetLevelFromSpellLevel(spellLvl);
  const maxPetLevel = taoistPetMaxLevelFromSpellLevel(spellLvl, "SummonHolyDeva");
  const combat = taoistPetCombatStats(baseStats, petLevel);
  const moveMs = Math.max(
    HOLY_DEVA_MIN_MOVE_MS,
    HOLY_DEVA_BASE_MOVE_MS - maxPetLevel * HOLY_DEVA_MOVE_REDUCTION_PER_MAX_LEVEL_MS,
  );
  return {
    level: petLevel,
    maxPetLevel,
    maxHp: combat.maxHp,
    dc: combat.dc,
    ac: combat.ac,
    amc: combat.amc,
    attackMs: taoistPetAttackDelayMs(baseStats.attackMs, maxPetLevel),
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

export function isTaoistTankSummonSpellId(spellId) {
  return spellId === "SummonSkeleton" || spellId === "SummonShinsu";
}

/** Living / pending / stashed Skeleton or Shinsu should survive solo fight transitions. */
export function shouldKeepTankPetBetweenSoloFights(pet, pendingPet, stashedPet) {
  const activeTank = isTaoistTankSummonSpellId(pet?.spellId)
    && Boolean(pet?.active)
    && !pet?.dead
    && Number(pet?.hp) > 0;
  const pendingTank = isTaoistTankSummonSpellId(pendingPet?.spellId);
  const stashedTank = isTaoistTankSummonSpellId(stashedPet?.spellId)
    && !stashedPet?.dead
    && Number(stashedPet?.hp) > 0;
  return activeTank || pendingTank || stashedTank;
}

/** Snapshot a living tank pet for between-fight recall (teleport away). */
export function prepareTaoistTankPetStash(pet) {
  if (!isTaoistTankSummonSpellId(pet?.spellId) || pet.dead || Number(pet.hp) <= 0) return null;
  const stashed = {
    ...pet,
    active: false,
    dead: false,
    action: "standing",
    frame: 0,
    oneShot: false,
    moving: false,
    followPending: false,
  };
  if (stashed.spellId === "SummonShinsu") {
    stashed.shinsuVisible = true;
  }
  return stashed;
}

/** Reactivate a stashed tank pet for the next fight (teleport back). */
export function prepareTaoistTankPetRecall(pet, now = 0) {
  if (!isTaoistTankSummonSpellId(pet?.spellId) || pet.dead || Number(pet.hp) <= 0) return null;
  const recalled = {
    ...pet,
    active: true,
    dead: false,
    action: "standing",
    frame: 0,
    oneShot: false,
    lastTick: now,
    nextAttackAt: now + 1000,
    moving: false,
    followPending: false,
  };
  if (recalled.spellId === "SummonShinsu") {
    recalled.shinsuVisible = true;
  }
  return recalled;
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
