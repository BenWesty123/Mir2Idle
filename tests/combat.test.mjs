import test from "node:test";
import assert from "node:assert/strict";
import {
  applyIncomingDamageReduction,
  enemyAttackDefenceType,
  enemyDamageEvent,
  incomingAttackDefenceStat,
  magicBurnEvents,
  magicResistEvents,
  partyMemberDamageEvent,
  petAttackHitEvents,
  petDamageEvent,
  physicalAttackHitEvents,
  physicalAttackMissEvents,
  playerDamageEvent,
  poisonTickDamageEvents,
  resolveIncomingEnemyAttack,
  resolveIncomingEnemyRangedAttack,
  resolveMagicAttack,
  resolvePhysicalAttack,
  resolveSpellCastWeaponFallback,
  rollHit,
  rollMagicHit,
  scalePhysicalDamageForStun,
  swarmEnemyDamageEvent,
  weaponSwingHitEvents,
  weaponSwingMissEvents,
} from "../src/core/combat.js";

test("enemyAttackDefenceType", () => {
  assert.equal(enemyAttackDefenceType({ attackDefenceType: "MAC" }), "MAC");
  assert.equal(enemyAttackDefenceType({ attackDefenceType: "MACAgility" }), "MACAgility");
  assert.equal(enemyAttackDefenceType({}), "ACAgility");
});

test("incomingAttackDefenceStat", () => {
  assert.equal(incomingAttackDefenceStat({ ac: 5, amc: 8 }, "MAC"), 8);
  assert.equal(incomingAttackDefenceStat({ ac: 5 }, "ACAgility"), 5);
});

test("applyIncomingDamageReduction", () => {
  assert.equal(applyIncomingDamageReduction(100, 0), 100);
  assert.equal(applyIncomingDamageReduction(100, 25), 75);
  assert.equal(applyIncomingDamageReduction(100, 150), 0);
});

test("resolveIncomingEnemyAttack: agility miss", () => {
  const result = resolveIncomingEnemyAttack(
    { accuracy: 5, dc: [10, 10] },
    { ac: [0, 0], agility: 10 },
    { randomIntFn: () => 999 },
  );
  assert.deepEqual(result, { hit: false, damage: 0 });
});

test("resolveIncomingEnemyAttack: MAC resist miss", () => {
  const result = resolveIncomingEnemyAttack(
    { attackDefenceType: "MAC", accuracy: 99, dc: [10, 10] },
    { ac: [0, 0], amc: [0, 0], magicResist: 9 },
    { randomIntFn: () => 0 },
  );
  assert.deepEqual(result, { hit: false, damage: 0 });
});

test("resolveIncomingEnemyAttack: hit with damage reduction", () => {
  const result = resolveIncomingEnemyAttack(
    { accuracy: 99, dc: [20, 20], luck: 0 },
    { ac: [5, 5], agility: 0 },
    { randomIntFn: () => 0, damageReductionPercent: 50 },
  );
  assert.deepEqual(result, { hit: true, damage: 7 });
});

test("resolveIncomingEnemyRangedAttack uses ranged defence type", () => {
  const result = resolveIncomingEnemyRangedAttack(
    { attackDefenceType: "ACAgility", rangedAttackDefenceType: "MAC", accuracy: 99, dc: [12, 12] },
    { ac: [0, 0], amc: [0, 0], magicResist: 9 },
    { randomIntFn: () => 0 },
  );
  assert.deepEqual(result, { hit: false, damage: 0 });
});

test("rollHit: deterministic with injected randomInt", () => {
  const alwaysMiss = () => 999;
  const alwaysHit = () => 0;
  assert.equal(rollHit(5, 10, alwaysMiss), false);
  assert.equal(rollHit(5, 10, alwaysHit), true);
});

test("resolvePhysicalAttack: miss returns zero damage", () => {
  const result = resolvePhysicalAttack(5, 10, [5, 10], [0, 2], 0, () => 999);
  assert.deepEqual(result, { hit: false, damage: 0 });
});

test("resolveMagicAttack: resist miss returns zero damage", () => {
  const result = resolveMagicAttack({ magicResist: 10 }, [10, 20], [0, 2], 0, 1, () => 0);
  assert.deepEqual(result, { hit: false, damage: 0 });
});

test("resolveMagicAttack: hit applies multiplier", () => {
  const result = resolveMagicAttack({ magicResist: 0 }, [10, 10], [0, 0], 0, 1.5, () => 0);
  assert.equal(result.hit, true);
  assert.equal(result.damage, 15);
});

test("scalePhysicalDamageForStun", () => {
  assert.equal(scalePhysicalDamageForStun(10, false), 10);
  assert.equal(scalePhysicalDamageForStun(10, true), 15);
});

test("resolveSpellCastWeaponFallback", () => {
  assert.equal(resolveSpellCastWeaponFallback({ cooldownWaiting: true, playerMp: 100, spellCost: 5 }), "weapon");
  assert.equal(resolveSpellCastWeaponFallback({ cooldownWaiting: false, playerMp: 3, spellCost: 5 }), "weapon");
  assert.equal(resolveSpellCastWeaponFallback({ cooldownWaiting: false, playerMp: 5, spellCost: 5 }), "cast");
  assert.equal(resolveSpellCastWeaponFallback({ playerMp: 20, spellCost: 0 }), "cast");
});

test("physicalAttackMissEvents", () => {
  assert.deepEqual(physicalAttackMissEvents("Warrior", "Deer", "enemy"), [
    { type: "combatText", anchor: "enemy", text: "Miss", kind: "miss" },
    { type: "log", text: "Warrior misses Deer." },
  ]);
});

test("physicalAttackHitEvents includes enemy damage state event", () => {
  assert.deepEqual(physicalAttackHitEvents("Warrior", "Deer", 12), [
    { type: "damage", target: "enemy", amount: 12, kind: "physical" },
    { type: "combatText", anchor: "enemy", text: 12, kind: "damage" },
    { type: "log", text: "Warrior hits Deer for 12." },
  ]);
});

test("physicalAttackHitEvents can skip damage for presentation-only", () => {
  assert.deepEqual(
    physicalAttackHitEvents("Deer", "Warrior", 8, "player", "enemyDamage", { skipDamage: true }),
    [
      { type: "combatText", anchor: "player", text: 8, kind: "enemyDamage" },
      { type: "log", text: "Deer hits Warrior for 8." },
    ],
  );
});

test("physicalAttackHitEvents supports player and pet damage targets", () => {
  assert.deepEqual(
    physicalAttackHitEvents("Deer", "Warrior", 6, "player", "enemyDamage", { damageTarget: "player" })[0],
    { type: "damage", target: "player", amount: 6, kind: "physical" },
  );
  assert.deepEqual(
    physicalAttackHitEvents("Deer", "Skeleton", 4, "pet", "enemyDamage", { damageTarget: "pet" })[0],
    { type: "damage", target: "pet", amount: 4, kind: "physical" },
  );
  assert.deepEqual(
    physicalAttackHitEvents("Archer", "Wizard", 9, "enemy", "enemyDamage", { damageTarget: "partyMember" })[0],
    { type: "damage", target: "partyMember", amount: 9, kind: "physical" },
  );
});

test("rollMagicHit: always hits when magic resist is zero", () => {
  assert.equal(rollMagicHit({ magicResist: 0 }, () => 999), true);
});

test("rollMagicHit: deterministic miss with high resist and low roll", () => {
  assert.equal(rollMagicHit({ magicResist: 9 }, () => 0), false);
});

test("weaponSwingMissEvents / weaponSwingHitEvents", () => {
  assert.deepEqual(weaponSwingMissEvents("Wizard", "staff", "Deer")[1], {
    type: "log",
    text: "Wizard swings staff at Deer but misses.",
  });
  assert.deepEqual(weaponSwingHitEvents("Taoist", "sword", "Deer", 8)[0], {
    type: "damage",
    target: "enemy",
    amount: 8,
    kind: "physical",
  });
});

test("magicResistEvents / magicBurnEvents", () => {
  assert.deepEqual(magicResistEvents("FireBall", "Deer")[1], {
    type: "log",
    text: "FireBall is resisted by Deer.",
  });
  assert.deepEqual(magicBurnEvents("FlameField", "Deer", 15)[0], {
    type: "damage",
    target: "enemy",
    amount: 15,
    kind: "magic",
  });
});

test("swarm and pet damage events", () => {
  assert.deepEqual(swarmEnemyDamageEvent("swarm-1", 6), {
    type: "damage",
    target: "swarmEnemy",
    swarmId: "swarm-1",
    amount: 6,
    kind: "magic",
  });
  assert.deepEqual(petAttackHitEvents("Skeleton", "Deer", 4)[0], {
    type: "damage",
    target: "enemy",
    amount: 4,
    kind: "physical",
  });
  assert.deepEqual(playerDamageEvent(9, { kind: "magic" }), {
    type: "damage",
    target: "player",
    amount: 9,
    kind: "magic",
  });
  assert.deepEqual(petDamageEvent(3), {
    type: "damage",
    target: "pet",
    amount: 3,
    kind: "physical",
  });
  assert.deepEqual(partyMemberDamageEvent(11), {
    type: "damage",
    target: "partyMember",
    amount: 11,
    kind: "physical",
  });
});

test("poisonTickDamageEvents", () => {
  assert.deepEqual(poisonTickDamageEvents("green", 3), [
    { type: "damage", target: "enemy", amount: 3, kind: "poison" },
  ]);
  assert.deepEqual(poisonTickDamageEvents("yellow", 3), []);
  assert.deepEqual(enemyDamageEvent(-1), {
    type: "damage",
    target: "enemy",
    amount: 0,
    kind: "physical",
  });
});
