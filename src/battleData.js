import { PHASE1_ENEMY_TEMPLATES } from "./phase1Data.js";

const CRYSTAL_PLAYER_FORMULAS = {
  Warrior: {
    hp: { base: 14, gain: 4, gainRate: 4.5 },
    mp: { base: 11, gain: 3.5, gainRate: 0 },
    ac: [{ base: 0, gain: 0 }, { base: 0, gain: 7 }],
    amc: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    dc: [{ base: 0, gain: 5 }, { base: 0, gain: 5 }],
    mc: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    sc: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    accuracy: { base: 5, gain: 0 },
    agility: { base: 15, gain: 0 },
  },
  Wizard: {
    hp: { base: 14, gain: 15, gainRate: 1.8 },
    mp: { base: 13, gain: 5, gainRate: 0 },
    ac: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    amc: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    dc: [{ base: 0, gain: 7 }, { base: 0, gain: 7 }],
    mc: [{ base: 0, gain: 7 }, { base: 0, gain: 7 }],
    sc: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    accuracy: { base: 5, gain: 0 },
    agility: { base: 15, gain: 0 },
  },
  Taoist: {
    hp: { base: 14, gain: 6, gainRate: 2.5 },
    mp: { base: 13, gain: 8, gainRate: 0 },
    ac: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    amc: [{ base: 0, gain: 12 }, { base: 0, gain: 6 }],
    dc: [{ base: 0, gain: 7 }, { base: 0, gain: 7 }],
    mc: [{ base: 0, gain: 0 }, { base: 0, gain: 0 }],
    sc: [{ base: 0, gain: 7 }, { base: 0, gain: 7 }],
    accuracy: { base: 5, gain: 0 },
    agility: { base: 18, gain: 0 },
  },
};

const CRYSTAL_EXP_LEVELS_1_TO_60 = [
  100, 200, 300, 400, 600, 900, 1200, 1700, 2500, 6000,
  8000, 10000, 15000, 30000, 40000, 50000, 70000, 100000, 120000, 140000,
  250000, 300000, 350000, 400000, 500000, 700000, 1000000, 1400000, 1800000, 2000000,
  2400000, 2800000, 3200000, 3600000, 4000000, 4800000, 5600000, 8200000, 9000000, 12000000,
  16000000, 30000000, 50000000, 80000000, 120000000, 160000000, 200000000, 250000000, 300000000,
  350000000, 400000000, 480000000, 560000000, 640000000, 740000000, 840000000, 950000000,
  1000000000, 1200000000, 1350000000,
];

const PROTOTYPE_EXP_REQUIREMENT_SCALE = 0.25;

export const CRYSTAL_MAX_LEVEL = 500;
export const CRYSTAL_MAX_LUCK = 10;

export const PLAYER_TEMPLATE = {
  name: "Warrior",
  class: "Warrior",
  level: 1,
  experience: 0,
  gold: 0,
  ...crystalPlayerBaseStats("Warrior", 1),
};

function crystalHealth(className, level) {
  const formula = CRYSTAL_PLAYER_FORMULAS[className]?.hp ?? CRYSTAL_PLAYER_FORMULAS.Warrior.hp;
  if (className === "Warrior") {
    return Math.trunc(formula.base + (level / formula.gain + formula.gainRate + level / 20) * level);
  }
  return Math.trunc(formula.base + (level / formula.gain + formula.gainRate) * level);
}

function crystalMana(className, level) {
  const formula = CRYSTAL_PLAYER_FORMULAS[className]?.mp ?? CRYSTAL_PLAYER_FORMULAS.Warrior.mp;
  if (className === "Wizard") {
    return Math.trunc(formula.base + (level / formula.gain + 2) * 2.2 * level + level * formula.gainRate);
  }
  if (className === "Taoist") {
    return Math.trunc(formula.base + (level / formula.gain) * 2.2 * level + level * formula.gainRate);
  }
  return Math.trunc(formula.base + level * formula.gain + level * formula.gainRate);
}

function crystalStat(formula, level) {
  if (!formula?.gain) return formula?.base ?? 0;
  return Math.trunc((formula.base ?? 0) + level / formula.gain);
}

function crystalRange(formulas, level) {
  return [crystalStat(formulas?.[0], level), crystalStat(formulas?.[1], level)];
}

export function crystalPlayerVitals(className = "Warrior", level = 1) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const safeClass = CRYSTAL_PLAYER_FORMULAS[className] ? className : "Warrior";
  return {
    maxHp: crystalHealth(safeClass, safeLevel),
    maxMp: crystalMana(safeClass, safeLevel),
  };
}

export function crystalPlayerBaseStats(className = "Warrior", level = 1) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const safeClass = CRYSTAL_PLAYER_FORMULAS[className] ? className : "Warrior";
  const formula = CRYSTAL_PLAYER_FORMULAS[safeClass];
  return {
    ...crystalPlayerVitals(safeClass, safeLevel),
    dc: crystalRange(formula.dc, safeLevel),
    mc: crystalRange(formula.mc, safeLevel),
    sc: crystalRange(formula.sc, safeLevel),
    ac: crystalRange(formula.ac, safeLevel),
    amc: crystalRange(formula.amc, safeLevel),
    accuracy: crystalStat(formula.accuracy, safeLevel),
    agility: crystalStat(formula.agility, safeLevel),
    luck: 1,
    attackSpeed: 0,
  };
}

export function crystalExperienceForLevel(level) {
  const safeLevel = Math.max(1, Math.trunc(Number(level) || 1));
  if (safeLevel >= CRYSTAL_MAX_LEVEL) return Infinity;
  const crystalRequirement = safeLevel <= CRYSTAL_EXP_LEVELS_1_TO_60.length
    ? CRYSTAL_EXP_LEVELS_1_TO_60[safeLevel - 1]
    : (safeLevel - 46) * 100000000;
  return Math.max(1, Math.round(crystalRequirement * PROTOTYPE_EXP_REQUIREMENT_SCALE));
}

export function crystalAdjustedExperience(amount, playerLevel, monsterLevel, mobLevelDifference = true, expRate = 1) {
  const baseAmount = Math.max(0, Math.trunc(Number(amount) || 0));
  const level = Math.max(1, Math.trunc(Number(playerLevel) || 1));
  const targetLevel = Math.max(0, Math.trunc(Number(monsterLevel) || 0));
  let expPoint;

  if (!mobLevelDifference || level < targetLevel + 10) {
    expPoint = baseAmount;
  } else {
    const reductionStep = Math.max(Math.floor(baseAmount / 15), 1);
    expPoint = baseAmount - Math.round(reductionStep * (level - (targetLevel + 10)));
  }

  if (expPoint <= 0) expPoint = 1;
  return Math.trunc(expPoint * (Number(expRate) || 1));
}

export const ENEMY_TEMPLATES = PHASE1_ENEMY_TEMPLATES;

export function rollDamage(attackStat, defenceStat, luck = 0) {
  const attack = rollStat(attackStat, luck);
  const defence = rollStat(defenceStat);
  return Math.max(0, attack - defence);
}

export function rollStat(stat, luck = 0) {
  const [min, max] = statRange(stat);
  if (max <= min) return min;
  const clampedLuck = Math.max(-CRYSTAL_MAX_LUCK, Math.min(CRYSTAL_MAX_LUCK, Math.trunc(Number(luck) || 0)));
  if (clampedLuck > 0) {
    if (clampedLuck > randomInt(0, CRYSTAL_MAX_LUCK - 1)) return max;
  } else if (clampedLuck < 0) {
    if (clampedLuck < -randomInt(0, CRYSTAL_MAX_LUCK - 1)) return min;
  }
  return randomInt(min, max);
}

export function statRange(stat) {
  if (Array.isArray(stat)) return [Number(stat[0]) || 0, Number(stat[1]) || 0];
  const value = Number(stat) || 0;
  return [0, value];
}

export function formatStatRange(stat) {
  const [min, max] = statRange(stat);
  return `${min}-${max}`;
}

// Crystal HumanObject: ActionTime += 550 after a normal melee swing.
export const CRYSTAL_PLAYER_ACTION_LOCK_MS = 550;

export function attackDelayMs(attackSpeed, level = 0) {
  const speed = Math.trunc(Number(attackSpeed) || 0);
  const levelBonus = Math.min(370, Math.max(0, Number(level) || 0) * 14);
  return Math.max(
    CRYSTAL_PLAYER_ACTION_LOCK_MS,
    Math.round(1400 - (speed * 60 + levelBonus)),
  );
}

// TwinDrakeBlade uses AttackSpeed - 120 (min 300) instead of the full AttackSpeed.
export function twinDrakeAttackDelayMs(attackSpeed, level = 0) {
  const base = attackDelayMs(attackSpeed, level);
  return Math.max(300, base - 120);
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Stat-object arithmetic ---------------------------------------------
// Pure helpers that operate on the runtime "stats" shape (paired ranges
// dc/mc/sc/ac/amc plus scalar fields). No game state, DOM, or RNG. Used by
// item stat totals, smith scoring, and character stat aggregation in the
// monolith. Kept here (with the other stat formulas) so they are unit-tested.

export function cloneStats(stats) {
  return {
    maxHp: stats.maxHp ?? stats.hp ?? 0,
    maxMp: stats.maxMp ?? stats.mp ?? 0,
    dc: [...(stats.dc ?? [0, 0])],
    mc: [...(stats.mc ?? [0, 0])],
    sc: [...(stats.sc ?? [0, 0])],
    ac: [...(stats.ac ?? [0, 0])],
    amc: [...(stats.amc ?? [0, 0])],
    accuracy: stats.accuracy ?? 0,
    agility: stats.agility ?? 0,
    luck: stats.luck ?? 0,
    attackSpeed: stats.attackSpeed ?? 0,
    freezing: stats.freezing ?? 0,
    poisonAttack: stats.poisonAttack ?? 0,
    magicResist: stats.magicResist ?? 0,
    poisonResist: stats.poisonResist ?? 0,
    healthRecovery: stats.healthRecovery ?? 0,
    poisonRecovery: stats.poisonRecovery ?? 0,
    strong: stats.strong ?? 0,
    xpBonusPercent: stats.xpBonusPercent ?? 0,
    goldBonusPercent: stats.goldBonusPercent ?? 0,
    dropChanceBonusPercent: stats.dropChanceBonusPercent ?? 0,
    bonusAwakeningSoulChancePercent: stats.bonusAwakeningSoulChancePercent ?? 0,
  };
}

export function addStats(target, source) {
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) addRange(target[key], source[key]);
  target.maxHp += Number(source.hp) || 0;
  target.maxMp += Number(source.mp) || 0;
  target.accuracy += Number(source.accuracy) || 0;
  target.agility += Number(source.agility) || 0;
  target.luck += Number(source.luck) || 0;
  target.attackSpeed += Number(source.attackSpeed) || 0;
  target.freezing += Number(source.freezing) || 0;
  target.poisonAttack += Number(source.poisonAttack) || 0;
  target.magicResist += Number(source.magicResist) || 0;
  target.poisonResist += Number(source.poisonResist) || 0;
  target.healthRecovery += Number(source.healthRecovery) || 0;
  target.poisonRecovery += Number(source.poisonRecovery) || 0;
  target.strong += Number(source.strong) || 0;
  target.xpBonusPercent += Number(source.xpBonusPercent) || 0;
  target.goldBonusPercent += Number(source.goldBonusPercent) || 0;
  target.dropChanceBonusPercent += Number(source.dropChanceBonusPercent) || 0;
  target.bonusAwakeningSoulChancePercent += Number(source.bonusAwakeningSoulChancePercent) || 0;
}

export function addRange(target, source) {
  if (!Array.isArray(target) || !Array.isArray(source)) return;
  target[0] += Number(source[0]) || 0;
  target[1] += Number(source[1]) || 0;
}

/** Max successful smith duplicate combines (+5). Gems/orbs use bonusStats separately. */
export const SMITH_COMBINE_STAT_CAP = 5;

function sanitizeBonusPercentPoints(value) {
  return Number(Math.max(0, Number(value) || 0).toFixed(4));
}

export function sanitizeItemBonusStats(stats) {
  const bonusStats = {};
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    const value = Array.isArray(stats?.[key]) ? stats[key] : [0, 0];
    bonusStats[key] = [
      Math.trunc(Number(value[0]) || 0),
      Math.trunc(Number(value[1]) || 0),
    ];
  }
  for (const key of ["hp", "mp", "accuracy", "agility", "luck", "attackSpeed"]) {
    bonusStats[key] = Math.trunc(Number(stats?.[key]) || 0);
  }
  for (const key of ["poisonAttack", "freezing", "magicResist", "poisonResist", "healthRecovery", "poisonRecovery", "strong", "xpBonusPercent", "goldBonusPercent", "bonusAwakeningSoulChancePercent"]) {
    bonusStats[key] = Math.trunc(Number(stats?.[key]) || 0);
  }
  bonusStats.dropChanceBonusPercent = sanitizeBonusPercentPoints(stats?.dropChanceBonusPercent);
  return bonusStats;
}

/** Smith-combine bonuses only (same shape as bonusStats). */
export function sanitizeSmithBonusStats(stats) {
  return sanitizeItemBonusStats(stats);
}

/**
 * Applies a multiplicative gold bonus from monster kills (e.g. +10% => 1.1×).
 * @param {number} baseGold
 * @param {number} bonusPercent additive percent increase (500 => 6× gold)
 * @returns {number}
 */
export function adjustedKillGold(baseGold, bonusPercent = 0) {
  const base = Math.max(0, Math.trunc(Number(baseGold) || 0));
  if (base <= 0) return 0;
  const rate = 1 + Math.max(0, Number(bonusPercent) || 0) / 100;
  return Math.max(1, Math.round(base * rate));
}
