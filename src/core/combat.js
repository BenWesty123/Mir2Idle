import { randomInt, rollDamage } from "../battleData.js";

export const CRYSTAL_MAGIC_RESIST_WEIGHT = 10;

/**
 * @param {number} amount
 * @param {object} [options]
 * @param {string} [options.kind]
 */
export function enemyDamageEvent(amount, options = {}) {
  return {
    type: "damage",
    target: "enemy",
    amount: Math.max(0, Math.trunc(Number(amount) || 0)),
    kind: options.kind ?? "physical",
  };
}

/**
 * @param {string} swarmId
 * @param {number} amount
 * @param {object} [options]
 */
export function swarmEnemyDamageEvent(swarmId, amount, options = {}) {
  return {
    type: "damage",
    target: "swarmEnemy",
    swarmId,
    amount: Math.max(0, Math.trunc(Number(amount) || 0)),
    kind: options.kind ?? "magic",
  };
}

/**
 * @param {number} amount
 * @param {object} [options]
 */
export function playerDamageEvent(amount, options = {}) {
  return {
    type: "damage",
    target: "player",
    amount: Math.max(0, Math.trunc(Number(amount) || 0)),
    kind: options.kind ?? "physical",
  };
}

/**
 * @param {number} amount
 * @param {object} [options]
 */
export function petDamageEvent(amount, options = {}) {
  return {
    type: "damage",
    target: "pet",
    amount: Math.max(0, Math.trunc(Number(amount) || 0)),
    kind: options.kind ?? "physical",
  };
}

/**
 * @param {number} amount
 * @param {object} [options]
 */
export function partyMemberDamageEvent(amount, options = {}) {
  return {
    type: "damage",
    target: "partyMember",
    amount: Math.max(0, Math.trunc(Number(amount) || 0)),
    kind: options.kind ?? "physical",
  };
}

/**
 * @param {number} amount
 */
export function petAttackMissEvents(petName, targetName) {
  return [
    { type: "combatText", anchor: "enemy", text: "Miss", kind: "miss" },
    { type: "log", text: `${petName} misses ${targetName}.` },
  ];
}

/**
 * @param {string} petName
 * @param {string} targetName
 * @param {number} damage
 */
export function petAttackHitEvents(petName, targetName, damage) {
  return [
    enemyDamageEvent(damage, { kind: "physical" }),
    { type: "combatText", anchor: "enemy", text: damage, kind: "damage" },
    { type: "log", text: `${petName} hits ${targetName} for ${damage}.` },
  ];
}

function withEnemyDamage(events, amount, kind = "physical", options = {}) {
  if (options.skipDamage) return events;
  const damageEvents = [];
  if (amount > 0) {
    if (options.swarmId) damageEvents.push(swarmEnemyDamageEvent(options.swarmId, amount, { kind }));
    else if (options.damageTarget === "player") damageEvents.push(playerDamageEvent(amount, { kind }));
    else if (options.damageTarget === "pet") damageEvents.push(petDamageEvent(amount, { kind }));
    else if (options.damageTarget === "partyMember") damageEvents.push(partyMemberDamageEvent(amount, { kind }));
    else damageEvents.push(enemyDamageEvent(amount, { kind }));
  }
  return [...damageEvents, ...events];
}

export function applyIncomingDamageReduction(damage, reductionPercent) {
  const percent = Math.max(0, Math.min(100, Math.trunc(Number(reductionPercent) || 0)));
  if (percent <= 0) return Math.max(0, Math.trunc(Number(damage) || 0));
  const amount = Math.max(0, Math.trunc(Number(damage) || 0));
  return Math.max(0, Math.trunc(amount - (amount * percent) / 100));
}

/**
 * @param {{ attackDefenceType?: string }} enemy
 * @returns {"ACAgility" | "MACAgility" | "MAC"}
 */
export function enemyAttackDefenceType(enemy) {
  if (enemy?.attackDefenceType === "MAC") return "MAC";
  if (enemy?.attackDefenceType === "MACAgility") return "MACAgility";
  return "ACAgility";
}

/**
 * @param {{ ac?: number | [number, number], amc?: number | [number, number] }} target
 * @param {"ACAgility" | "MACAgility" | "MAC"} defenceType
 */
export function incomingAttackDefenceStat(target, defenceType) {
  if (defenceType === "MACAgility" || defenceType === "MAC") return target.amc ?? target.ac;
  return target.ac;
}

/**
 * Crystal monster swings vs players/pets: ACAgility (physical AC) or, for
 * FlamingWooma/WoomaTaurus, MACAgility (magic-resist roll + agility dodge + MAC).
 * Evil Centipede uses MAC (magic-resist roll + MAC, no agility dodge).
 *
 * @param {{ attackDefenceType?: string, accuracy?: number, luck?: number, dc?: number | [number, number] }} attacker
 * @param {{ ac?: number | [number, number], amc?: number | [number, number], agility?: number, magicResist?: number }} target
 * @param {object} [options]
 * @param {number | [number, number]} [options.attackStat]
 * @param {number} [options.damageReductionPercent=0]
 * @param {string} [options.rangedAttackDefenceType]
 * @param {(min: number, max: number) => number} [options.randomIntFn]
 * @param {number} [options.resistWeight]
 * @returns {{ hit: boolean, damage: number }}
 */
export function resolveIncomingEnemyAttack(attacker, target, options = {}) {
  const defenceType = enemyAttackDefenceType(
    options.rangedAttackDefenceType
      ? { attackDefenceType: options.rangedAttackDefenceType }
      : attacker,
  );
  const randomIntFn = options.randomIntFn ?? randomInt;

  if (
    (defenceType === "MACAgility" || defenceType === "MAC")
    && !rollMagicHit(target, randomIntFn, options.resistWeight)
  ) {
    return { hit: false, damage: 0 };
  }
  if (defenceType !== "MAC" && !rollHit(attacker.accuracy ?? 0, target.agility ?? 0, randomIntFn)) {
    return { hit: false, damage: 0 };
  }

  const attackStat = options.attackStat ?? attacker.dc;
  const rawDamage = rollDamage(
    attackStat,
    incomingAttackDefenceStat(target, defenceType),
    attacker.luck ?? 0,
  );
  const damage = applyIncomingDamageReduction(rawDamage, options.damageReductionPercent ?? 0);
  return { hit: damage > 0, damage };
}

/**
 * @param {object} attacker
 * @param {object} target
 * @param {object} [options]
 */
export function resolveIncomingEnemyRangedAttack(attacker, target, options = {}) {
  const rangedType = attacker?.rangedAttackDefenceType || attacker?.attackDefenceType || "MAC";
  return resolveIncomingEnemyAttack(attacker, target, {
    ...options,
    rangedAttackDefenceType: rangedType,
  });
}

/**
 * Crystal MapObject.GetArmour (ACAgility / MACAgility): miss when
 * Random.Next(defenderAgility + 1) > attackerAccuracy.
 *
 * @param {number} accuracy
 * @param {number} agility
 * @param {(min: number, max: number) => number} [randomIntFn]
 */
export function rollHit(accuracy, agility, randomIntFn = randomInt) {
  const acc = Math.max(0, Math.trunc(Number(accuracy) || 0));
  const agi = Math.max(0, Math.trunc(Number(agility) || 0));
  return randomIntFn(0, agi) <= acc;
}

/**
 * @param {{ magicResist?: number } | null | undefined} defender
 * @param {(min: number, max: number) => number} [randomIntFn]
 * @param {number} [resistWeight=CRYSTAL_MAGIC_RESIST_WEIGHT]
 */
export function rollMagicHit(
  defender,
  randomIntFn = randomInt,
  resistWeight = CRYSTAL_MAGIC_RESIST_WEIGHT,
) {
  const cap = Math.max(1, Math.trunc(Number(resistWeight) || CRYSTAL_MAGIC_RESIST_WEIGHT));
  const magicResist = Math.max(0, Math.min(cap, Number(defender?.magicResist) || 0));
  return magicResist <= 0 || randomIntFn(0, cap - 1) >= magicResist;
}

/**
 * @param {number} attackerAccuracy
 * @param {number} defenderAgility
 * @param {number | [number, number]} attackStat
 * @param {number | [number, number]} defenceStat
 * @param {number} [luck=0]
 * @param {(min: number, max: number) => number} [randomIntFn]
 * @returns {{ hit: boolean, damage: number }}
 */
export function resolvePhysicalAttack(
  attackerAccuracy,
  defenderAgility,
  attackStat,
  defenceStat,
  luck = 0,
  randomIntFn = randomInt,
) {
  if (!rollHit(attackerAccuracy, defenderAgility, randomIntFn)) {
    return { hit: false, damage: 0 };
  }
  const damage = rollDamage(attackStat, defenceStat, luck);
  return { hit: damage > 0, damage };
}

/**
 * @param {{ magicResist?: number } | null | undefined} defender
 * @param {number | [number, number]} attackStat
 * @param {number | [number, number]} defenceStat
 * @param {number} [luck=0]
 * @param {number} [multiplier=1]
 * @param {(min: number, max: number) => number} [randomIntFn]
 * @param {number} [resistWeight=CRYSTAL_MAGIC_RESIST_WEIGHT]
 * @returns {{ hit: boolean, damage: number }}
 */
export function resolveMagicAttack(
  defender,
  attackStat,
  defenceStat,
  luck = 0,
  multiplier = 1,
  randomIntFn = randomInt,
  resistWeight = CRYSTAL_MAGIC_RESIST_WEIGHT,
) {
  if (!rollMagicHit(defender, randomIntFn, resistWeight)) {
    return { hit: false, damage: 0 };
  }
  const damage = Math.max(
    0,
    Math.round(rollDamage(attackStat, defenceStat, luck) * Math.max(0, Number(multiplier) || 0)),
  );
  return { hit: damage > 0, damage };
}

/**
 * @param {number} damage
 * @param {boolean} [stunned=false]
 */
export function scalePhysicalDamageForStun(damage, stunned = false) {
  const scaled = Math.trunc(Math.max(0, Number(damage) || 0) * (stunned ? 1.5 : 1));
  return Math.max(0, scaled);
}

/**
 * When an autocast spell is not ready, fall back to a basic weapon swing.
 *
 * @param {object} options
 * @param {boolean} [options.cooldownWaiting]
 * @param {number} [options.playerMp]
 * @param {number} [options.spellCost]
 * @returns {"cast" | "weapon"}
 */
export function resolveSpellCastWeaponFallback(options) {
  if (options.cooldownWaiting) return "weapon";
  const mp = Math.max(0, Math.trunc(Number(options.playerMp) || 0));
  const cost = Math.max(0, Math.trunc(Number(options.spellCost) || 0));
  if (mp < cost) return "weapon";
  return "cast";
}

/**
 * @param {string} attackerName
 * @param {string} targetName
 * @param {string} [targetAnchor="enemy"]
 */
export function physicalAttackMissEvents(attackerName, targetName, targetAnchor = "enemy") {
  return [
    { type: "combatText", anchor: targetAnchor, text: "Miss", kind: "miss" },
    { type: "log", text: `${attackerName} misses ${targetName}.` },
  ];
}

/**
 * @param {string} attackerName
 * @param {string} targetName
 * @param {number} damage
 * @param {string} [targetAnchor="enemy"]
 * @param {string} [damageKind="damage"]
 * @param {object} [damageOptions]
 */
export function physicalAttackHitEvents(
  attackerName,
  targetName,
  damage,
  targetAnchor = "enemy",
  damageKind = "damage",
  damageOptions = {},
) {
  return withEnemyDamage(
    [
      { type: "combatText", anchor: targetAnchor, text: damage, kind: damageKind },
      { type: "log", text: `${attackerName} hits ${targetName} for ${damage}.` },
    ],
    damage,
    "physical",
    damageOptions,
  );
}

/** Spell / skill miss — same shape as physical miss. */
export const magicAttackMissEvents = physicalAttackMissEvents;

/**
 * @param {string} spellLabel
 * @param {string} targetName
 * @param {number} damage
 * @param {string} [targetAnchor="enemy"]
 * @param {string} [damageKind="damage"]
 * @param {object} [damageOptions]
 */
export function magicAttackHitEvents(
  spellLabel,
  targetName,
  damage,
  targetAnchor = "enemy",
  damageKind = "damage",
  damageOptions = {},
) {
  return withEnemyDamage(
    [
      { type: "combatText", anchor: targetAnchor, text: damage, kind: damageKind },
      { type: "log", text: `${spellLabel} hits ${targetName} for ${damage}.` },
    ],
    damage,
    "magic",
    damageOptions,
  );
}

/**
 * @param {string} classLabel
 * @param {string} weaponName
 * @param {string} targetName
 */
export function weaponSwingMissEvents(classLabel, weaponName, targetName) {
  return [
    { type: "combatText", anchor: "enemy", text: "Miss", kind: "miss" },
    { type: "log", text: `${classLabel} swings ${weaponName} at ${targetName} but misses.` },
  ];
}

/**
 * @param {string} classLabel
 * @param {string} weaponName
 * @param {string} targetName
 * @param {number} damage
 */
export function weaponSwingHitEvents(classLabel, weaponName, targetName, damage) {
  return withEnemyDamage(
    [
      { type: "combatText", anchor: "enemy", text: damage, kind: "damage" },
      { type: "log", text: `${classLabel} hits ${targetName} with ${weaponName} for ${damage}.` },
    ],
    damage,
    "physical",
  );
}

/**
 * @param {string} spellLabel
 * @param {string} targetName
 * @param {string} [targetAnchor="enemy"]
 */
export function magicResistEvents(spellLabel, targetName, targetAnchor = "enemy") {
  return [
    { type: "combatText", anchor: targetAnchor, text: "0", kind: "damage" },
    { type: "log", text: `${spellLabel} is resisted by ${targetName}.` },
  ];
}

/**
 * @param {string} spellLabel
 * @param {string} targetName
 * @param {number} damage
 * @param {string} [targetAnchor="enemy"]
 * @param {object} [damageOptions]
 */
export function magicBurnEvents(spellLabel, targetName, damage, targetAnchor = "enemy", damageOptions = {}) {
  return withEnemyDamage(
    [
      { type: "combatText", anchor: targetAnchor, text: damage, kind: "damage" },
      { type: "log", text: `${spellLabel} burns ${targetName} for ${damage}.` },
    ],
    damage,
    "magic",
    damageOptions,
  );
}

/**
 * @param {string} spellLabel
 * @param {string} targetName
 * @param {string} poisonKind
 */
export function poisonAppliedEvents(spellLabel, targetName, poisonKind) {
  const label = poisonKind === "green" ? "Green Poison" : "Yellow Poison";
  return [
    {
      type: "combatText",
      anchor: "enemy",
      text: poisonKind === "green" ? "Poison" : "Weaken",
      kind: poisonKind === "green" ? "poison" : "debuff",
    },
    { type: "log", text: `${label} affects ${targetName}.` },
  ];
}

/**
 * @param {string} spellLabel
 * @param {string} targetName
 * @param {string} poisonKind
 */
export function poisonResistedEvents(spellLabel, targetName, poisonKind) {
  const label = poisonKind === "green" ? "Green Poison" : "Yellow Poison";
  return [
    { type: "log", text: `${targetName} resists the weaker ${label}.` },
  ];
}

/**
 * @param {string} poisonKind
 * @param {number} damage
 */
export function poisonTickDamageEvents(poisonKind, damage) {
  if (poisonKind !== "green" || damage <= 0) return [];
  return [enemyDamageEvent(damage, { kind: "poison" })];
}
