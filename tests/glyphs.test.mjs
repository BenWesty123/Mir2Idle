import test from "node:test";
import assert from "node:assert/strict";
import {
  GLYPH_DEFS,
  absorbDamageWithManaAegis,
  applyGlyphGroundDuration,
  applyGlyphProtectionFieldBonus,
  applyGlyphProtectionFieldDuration,
  glyphProtectionFieldStat,
  applyGlyphTwinDrakeDamage,
  equippedGlyphDef,
  equippedGlyphDefs,
  GLYPH_EQUIPMENT_SLOT_IDS,
  flameDisruptorSplashDamage,
  glyphDefById,
  glyphDefByItemId,
  glyphFlameDisruptorSplashParams,
  glyphFlamingSwordDrParams,
  glyphImprovedFlamingSwordParams,
  glyphManyMirrorsParams,
  glyphGoldBonusPercent,
  buildFlamingSwordBurnState,
  flamingSwordBurnTickDamage,
  flamingSwordBurnTotalDamage,
  glyphHealingIsInstant,
  glyphChainsDefenceBuffsWithUltimate,
  glyphMagicShieldMpParams,
  glyphManaRegenPerSecond,
  glyphPetOwnerDcBonus,
  glyphTwinDrakeCooldownMs,
  hasGlyphModifier,
  isGlyphItem,
  rollDefenceBuffBonusFromLevel,
  rollDefenceBuffBonusFromSc,
  rollEmpoweredBossGlyphItemId,
  EMPOWERED_BOSS_GLYPH_DROP_CHANCE,
  ASCENDED_BOSS_GLYPH_DROP_CHANCE,
  glyphDropItemIds,
  rollFlameDisruptorSplashChance,
  rollTaoistDefenceBuffBonus,
  applyGlyphHealingAmount,
  applyGlyphHpPotionRestore,
  glyphExtraBaseCritDamagePercent,
  glyphNullifiesLuck,
  healingCircleTickHealAmount,
  accrueGlyphManaRegen,
  applyGlyphCombatDamageIncoming,
  applyGlyphCombatDamageOutgoing,
  glyphCombatDamageParams,
  glyphIsHero,
  glyphIsRevival,
  applyGlyphBattleWizardDefence,
  applyGlyphBattleWizardOutgoing,
  glyphBattleWizardParams,
  applyGlyphMonkCombatStats,
  glyphMonkParams,
  glyphPotionTickDelayMs,
  isWithinMeleeRange,
} from "../src/glyphModifiers.js";
import { itemCanBeEmpowered } from "../src/core/empoweredItems.js";

test("glyph defs cover all implemented items and unique item ids", () => {
  const implemented = GLYPH_DEFS.filter((def) => def.implemented);
  assert.equal(implemented.length, 24);
  assert.ok(glyphDefByItemId("glyph-spirit-wards"));
  assert.ok(glyphDefByItemId("glyph-eternal-firewall"));
  assert.ok(glyphDefByItemId("glyph-bulwark-field"));
  assert.ok(glyphDefByItemId("glyph-magical-protection"));
  assert.ok(glyphDefByItemId("glyph-flaming-bulwark"));
  assert.ok(glyphDefByItemId("glyph-improved-flaming-sword"));
  assert.ok(glyphDefByItemId("glyph-twin-fury"));
  assert.ok(glyphDefByItemId("glyph-pet-might"));
  assert.ok(glyphDefByItemId("glyph-instant-healing"));
  assert.ok(glyphDefByItemId("glyph-improved-healing-circle"));
  assert.ok(glyphDefByItemId("glyph-buffing"));
  assert.ok(glyphDefByItemId("glyph-infinite-mana"));
  assert.ok(glyphDefByItemId("glyph-glass-canon"));
  assert.ok(glyphDefByItemId("glyph-gold"));
  assert.ok(glyphDefByItemId("glyph-tank"));
  assert.ok(glyphDefByItemId("glyph-hero"));
  assert.ok(glyphDefByItemId("glyph-revival"));
  assert.ok(glyphDefByItemId("glyph-battle-wizard"));
  assert.ok(glyphDefByItemId("glyph-monk"));
  assert.ok(glyphDefByItemId("glyph-mana-aegis"));
  assert.ok(glyphDefByItemId("glyph-disruptor-cascade"));
  assert.ok(glyphDefByItemId("glyph-many-mirrors"));
  assert.ok(glyphDefByItemId("glyph-fast-healing"));
  assert.ok(glyphDefByItemId("glyph-critical-strikes"));
  const ids = new Set(GLYPH_DEFS.map((def) => def.itemId));
  assert.equal(ids.size, GLYPH_DEFS.length);
});

test("empowered boss glyph drop is one-or-none from the full pool", () => {
  const pool = glyphDropItemIds();
  assert.equal(pool.length, GLYPH_DEFS.length);
  assert.equal(EMPOWERED_BOSS_GLYPH_DROP_CHANCE, 0.1);
  assert.equal(ASCENDED_BOSS_GLYPH_DROP_CHANCE, 0.15);

  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.1), null);
  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.99), null);
  // Ascended uses 15%: 0.10 hits, 0.15 misses.
  assert.ok(rollEmpoweredBossGlyphItemId(() => 0.1, { ascended: true }));
  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.15, { ascended: true }), null);

  let call = 0;
  const forcedHit = () => {
    call += 1;
    return call === 1 ? 0 : 0;
  };
  assert.equal(rollEmpoweredBossGlyphItemId(forcedHit), pool[0]);

  call = 0;
  const lastPick = () => {
    call += 1;
    return call === 1 ? 0.05 : 0.999999;
  };
  assert.equal(rollEmpoweredBossGlyphItemId(lastPick), pool[pool.length - 1]);
});

test("SC defence buff formula matches Ultimate Enhancer style", () => {
  assert.equal(rollDefenceBuffBonusFromLevel(50), 11);
  assert.equal(rollDefenceBuffBonusFromSc(50), 14);
  assert.equal(rollDefenceBuffBonusFromSc(0), 4);
  assert.equal(
    rollTaoistDefenceBuffBonus(50, 50, glyphDefById("taoDefenceBuffFromSc")),
    14,
  );
  assert.equal(rollTaoistDefenceBuffBonus(50, 50, null), 11);
  // Multi-slot equip returns an array; Spirit Wards must still apply.
  assert.equal(
    rollTaoistDefenceBuffBonus(50, 50, [
      glyphDefById("taoUltimateBuffChain"),
      glyphDefById("taoDefenceBuffFromSc"),
    ]),
    14,
  );
});

test("Fire Wall duration doubles with glyph", () => {
  const glyph = glyphDefById("wizardFireWallDuration");
  assert.equal(applyGlyphGroundDuration(10500, "FireWall", glyph), 21000);
  assert.equal(applyGlyphGroundDuration(10500, "IceStorm", glyph), 10500);
  assert.equal(applyGlyphGroundDuration(10500, "FireWall", null), 10500);
});

test("Protection Field glyph doubles bonus and fixes duration", () => {
  const glyph = glyphDefById("warriorProtectionFieldBurst");
  assert.equal(applyGlyphProtectionFieldBonus(10, glyph), 20);
  assert.equal(applyGlyphProtectionFieldDuration(60000, glyph), 5000);
  assert.equal(applyGlyphProtectionFieldDuration(60000, null), 60000);
});

test("Magical Protection glyph switches Protection Field to AMC", () => {
  const glyph = glyphDefById("warriorProtectionFieldAmc");
  assert.equal(glyph?.itemId, "glyph-magical-protection");
  assert.equal(glyphProtectionFieldStat(glyph), "amc");
  assert.equal(glyphProtectionFieldStat(null), "ac");
  assert.equal(glyphProtectionFieldStat([glyphDefById("warriorProtectionFieldBurst")]), "ac");
});

test("Glyph of Gold doubles monster and boss gold drops", () => {
  const glyph = glyphDefById("goldDrops");
  assert.equal(glyph?.itemId, "glyph-gold");
  assert.equal(glyphGoldBonusPercent(glyph), 100);
  assert.equal(glyphGoldBonusPercent(null), 0);
});

test("equippedGlyphDefs reads multiple glyph slots", () => {
  const inventory = {
    equipment: { glyph: "entry-1", glyph2: "entry-2" },
    items: [
      { id: "entry-1", itemId: "glyph-spirit-wards" },
      { id: "entry-2", itemId: "glyph-infinite-mana" },
    ],
  };
  const defs = equippedGlyphDefs(inventory);
  assert.equal(defs.length, 2);
  assert.equal(defs[0]?.id, "taoDefenceBuffFromSc");
  assert.equal(defs[1]?.id, "wizardManaRegen");
  assert.equal(hasGlyphModifier(inventory, "taoDefenceBuffFromSc"), true);
  assert.equal(hasGlyphModifier(inventory, "wizardManaRegen"), true);
  assert.equal(glyphManaRegenPerSecond(defs), 5);
  assert.equal(equippedGlyphDef(inventory)?.id, "taoDefenceBuffFromSc");
});

test("equippedGlyphDef reads inventory.equipment.glyph", () => {
  const inventory = {
    equipment: { glyph: "entry-1" },
    items: [{ id: "entry-1", itemId: "glyph-spirit-wards" }],
  };
  const def = equippedGlyphDef(inventory);
  assert.equal(def?.id, "taoDefenceBuffFromSc");
  assert.equal(hasGlyphModifier(inventory, "taoDefenceBuffFromSc"), true);
  assert.equal(hasGlyphModifier(inventory, "wizardFireWallDuration"), false);
  assert.equal(equippedGlyphDef({ equipment: {}, items: [] }), null);
});

test("glyphs are not empowerable", () => {
  assert.equal(itemCanBeEmpowered({ slot: "glyph", type: "glyph" }), false);
  assert.equal(isGlyphItem({ slot: "glyph" }), true);
  assert.equal(isGlyphItem({ id: "glyph-spirit-wards", slot: "glyph" }), true);
});

test("Flaming Bulwark glyph exposes DR params", () => {
  const glyph = glyphDefById("warriorFlamingSwordDr");
  assert.deepEqual(glyphFlamingSwordDrParams(glyph), {
    reductionPercent: 25,
    durationMs: 3000,
  });
  assert.equal(glyphFlamingSwordDrParams(null), null);
});

test("Improved Flaming Sword glyph burns for half the hit over 5 seconds", () => {
  const glyph = glyphDefById("warriorImprovedFlamingSword");
  assert.deepEqual(glyphImprovedFlamingSwordParams(glyph), {
    durationMs: 5000,
    damageFraction: 0.5,
    tickMs: 1000,
  });
  assert.equal(glyphImprovedFlamingSwordParams(null), null);
  assert.equal(flamingSwordBurnTotalDamage(100, 0.5), 50);
  assert.equal(flamingSwordBurnTotalDamage(101, 0.5), 50);

  const burn = buildFlamingSwordBurnState(100, glyphImprovedFlamingSwordParams(glyph), 1000);
  assert.deepEqual(burn, {
    remainingDamage: 50,
    ticksRemaining: 5,
    tickMs: 1000,
    nextTickAt: 2000,
    appliedAt: 1000,
  });
  assert.equal(flamingSwordBurnTickDamage(burn), 10);
  burn.remainingDamage -= 10;
  burn.ticksRemaining -= 1;
  assert.equal(flamingSwordBurnTickDamage({ remainingDamage: 13, ticksRemaining: 2 }), 6);
  assert.equal(flamingSwordBurnTickDamage({ remainingDamage: 7, ticksRemaining: 1 }), 7);
  assert.equal(buildFlamingSwordBurnState(1, glyphImprovedFlamingSwordParams(glyph), 0), null);
});

test("Twin Fury glyph doubles Twin Drake damage and sets cooldown", () => {
  const glyph = glyphDefById("warriorTwinDrakeBurst");
  assert.equal(applyGlyphTwinDrakeDamage(100, "TwinDrakeBlade", glyph), 200);
  assert.equal(applyGlyphTwinDrakeDamage(100, "FlamingSword", glyph), 100);
  assert.equal(applyGlyphTwinDrakeDamage(100, "TwinDrakeBlade", null), 100);
  assert.equal(glyphTwinDrakeCooldownMs(glyph), 2000);
  assert.equal(glyphTwinDrakeCooldownMs(null), 0);
});

test("Pet Might glyph adds owner Max DC", () => {
  const glyph = glyphDefById("taoPetOwnerDc");
  assert.equal(glyphPetOwnerDcBonus(50, glyph), 50);
  assert.equal(glyphPetOwnerDcBonus(51, glyph), 51);
  assert.equal(glyphPetOwnerDcBonus(50, null), 0);
});

test("Instant Healing glyph halves Healing and marks it instant", () => {
  const glyph = glyphDefById("taoHealingInstant");
  assert.equal(glyphHealingIsInstant(glyph), true);
  assert.equal(glyphHealingIsInstant(null), false);
  assert.equal(applyGlyphHealingAmount(100, "Healing", glyph), 50);
  assert.equal(applyGlyphHealingAmount(101, "Healing", glyph), 50);
  assert.equal(applyGlyphHealingAmount(100, "MassHealing", glyph), 100);
  assert.equal(applyGlyphHealingAmount(100, "Healing", null), 100);
});

test("Improved Healing Circle glyph adds floor(maxSc/4) per tick", () => {
  const glyph = glyphDefById("taoHealingCircleFromSc");
  assert.equal(healingCircleTickHealAmount(25, 0, glyph), 25);
  assert.equal(healingCircleTickHealAmount(25, 3, glyph), 25);
  assert.equal(healingCircleTickHealAmount(25, 4, glyph), 26);
  assert.equal(healingCircleTickHealAmount(25, 40, glyph), 35);
  assert.equal(healingCircleTickHealAmount(25, 40, null), 25);
  assert.equal(healingCircleTickHealAmount(25, 40, [
    glyphDefById("taoHealingInstant"),
    glyph,
  ]), 35);
});

test("Fast Healing glyph halves HP potion restore and shortens tick delay", () => {
  const glyph = glyphDefById("fastHealing");
  assert.equal(applyGlyphHpPotionRestore(100, glyph), 50);
  assert.equal(applyGlyphHpPotionRestore(101, glyph), 50);
  assert.equal(applyGlyphHpPotionRestore(100, null), 100);
  assert.equal(glyphPotionTickDelayMs(200, glyph, { hpPending: true }), 150);
  assert.equal(glyphPotionTickDelayMs(200, glyph, { hpPending: false }), 200);
  assert.equal(glyphPotionTickDelayMs(200, null, { hpPending: true }), 200);
});

test("Critical Strikes glyph doubles base crit damage and nullifies luck", () => {
  const glyph = glyphDefById("criticalStrikes");
  assert.equal(glyphNullifiesLuck(glyph), true);
  assert.equal(glyphNullifiesLuck(null), false);
  assert.equal(glyphExtraBaseCritDamagePercent(glyph), 50);
  assert.equal(glyphExtraBaseCritDamagePercent(null), 0);
  assert.equal(glyphExtraBaseCritDamagePercent([glyph]), 50);
});

test("Infinite Mana glyph accrues 5 MP/s across uneven offline steps", () => {
  const glyph = glyphDefById("wizardManaRegen");
  assert.equal(glyphManaRegenPerSecond(glyph), 5);
  assert.equal(glyphManaRegenPerSecond(null), 0);

  // First call arms the clock without granting MP.
  let state = accrueGlyphManaRegen(10, 100, 1000, 0, 5);
  assert.deepEqual(state, { mp: 10, regenAt: 1000, gained: 0 });

  // 2.5s later: floor(2500*5/1000)=12 MP, leftover 100ms kept on the clock.
  state = accrueGlyphManaRegen(state.mp, 100, 3500, state.regenAt, 5);
  assert.equal(state.gained, 12);
  assert.equal(state.mp, 22);
  assert.equal(state.regenAt, 3400);

  // Cap at max MP: only consume ms for the 2 MP that fit.
  state = accrueGlyphManaRegen(98, 100, 5400, 3400, 5);
  assert.equal(state.gained, 2);
  assert.equal(state.mp, 100);
  assert.equal(state.regenAt, 3800);

  // Already full: freeze the clock at now (no backlog dump when MP drops later).
  state = accrueGlyphManaRegen(100, 100, 5400, state.regenAt, 5);
  assert.equal(state.gained, 0);
  assert.equal(state.regenAt, 5400);
});

test("Glass Canon glyph boosts outgoing damage and doubles incoming", () => {
  const glyph = glyphDefById("glassCannon");
  assert.deepEqual(glyphCombatDamageParams(glyph), {
    outgoingMultiplier: 1.5,
    incomingMultiplier: 2,
  });
  assert.equal(applyGlyphCombatDamageOutgoing(100, glyph), 150);
  assert.equal(applyGlyphCombatDamageOutgoing(101, glyph), 151);
  assert.equal(applyGlyphCombatDamageIncoming(100, glyph), 200);
  assert.equal(applyGlyphCombatDamageOutgoing(100, null), 100);
  assert.equal(applyGlyphCombatDamageIncoming(100, null), 100);
  assert.equal(glyphCombatDamageParams(null), null);
});

test("Tank glyph halves outgoing damage and reduces incoming by 25%", () => {
  const glyph = glyphDefById("tank");
  assert.deepEqual(glyphCombatDamageParams(glyph), {
    outgoingMultiplier: 0.5,
    incomingMultiplier: 0.75,
  });
  assert.equal(applyGlyphCombatDamageOutgoing(100, glyph), 50);
  assert.equal(applyGlyphCombatDamageIncoming(100, glyph), 75);
  assert.equal(applyGlyphCombatDamageIncoming(101, glyph), 75);
});

test("Revival glyph is identified by kind", () => {
  assert.equal(glyphIsRevival(glyphDefById("revival")), true);
  assert.equal(glyphIsRevival(glyphDefById("tank")), false);
  assert.equal(glyphIsRevival(null), false);
  assert.equal(glyphDefByItemId("glyph-revival")?.label, "Glyph of Revival");
});

test("Hero glyph is identified by kind", () => {
  assert.equal(glyphIsHero(glyphDefById("hero")), true);
  assert.equal(glyphIsHero(glyphDefById("tank")), false);
  assert.equal(glyphIsHero(null), false);
  assert.equal(glyphDefByItemId("glyph-hero")?.label, "Glyph of the Hero");
});

test("Buffing glyph chains Ultimate Enhancer with defence buffs", () => {
  const glyph = glyphDefById("taoUltimateBuffChain");
  assert.equal(glyph?.label, "Glyph of Buffing");
  assert.equal(glyphChainsDefenceBuffsWithUltimate(glyph), true);
  assert.equal(glyphChainsDefenceBuffsWithUltimate(glyphDefById("taoDefenceBuffFromSc")), false);
  assert.equal(glyphChainsDefenceBuffsWithUltimate(null), false);
  assert.deepEqual(glyph?.spellIds, ["UltimateEnhancer", "SoulShield", "BlessedArmour"]);
});

test("Battle Wizard glyph buffs melee and nerfs ranged damage/armour", () => {
  const glyph = glyphDefById("battleWizard");
  assert.ok(glyphBattleWizardParams(glyph));
  assert.equal(isWithinMeleeRange(52, 52), true);
  assert.equal(isWithinMeleeRange(53, 52), false);
  assert.equal(applyGlyphBattleWizardOutgoing(100, glyph, true), 125);
  assert.equal(applyGlyphBattleWizardOutgoing(100, glyph, false), 75);
  assert.deepEqual(
    applyGlyphBattleWizardDefence({ ac: [8, 12], amc: [4, 6] }, glyph, true),
    { ac: [10, 15], amc: [5, 7] },
  );
  assert.deepEqual(
    applyGlyphBattleWizardDefence({ ac: [8, 12], amc: [4, 6] }, glyph, false),
    { ac: [6, 9], amc: [3, 4] },
  );
  assert.equal(applyGlyphBattleWizardOutgoing(100, null, true), 100);
});

test("Monk glyph boosts DC/SC only while no pets are summoned", () => {
  const glyph = glyphDefById("monk");
  assert.deepEqual(glyphMonkParams(glyph), { dcScMultiplier: 1.5 });
  assert.deepEqual(
    applyGlyphMonkCombatStats({ dc: [10, 20], sc: [30, 40] }, glyph, false),
    { dc: [15, 30], sc: [45, 60] },
  );
  assert.deepEqual(
    applyGlyphMonkCombatStats({ dc: [10, 20], sc: [30, 40] }, glyph, true),
    { dc: [10, 20], sc: [30, 40] },
  );
  assert.deepEqual(
    applyGlyphMonkCombatStats({ dc: [11, 21], sc: [31, 41] }, glyph, false),
    { dc: [16, 31], sc: [46, 61] },
  );
  assert.deepEqual(
    applyGlyphMonkCombatStats({ dc: [10, 20], sc: [30, 40] }, null, false),
    { dc: [10, 20], sc: [30, 40] },
  );
});

test("Mana Aegis absorbs HP damage from MP at 2:1", () => {
  const glyph = glyphDefById("wizardMagicShieldMp");
  assert.deepEqual(glyphMagicShieldMpParams(glyph), { mpPerHp: 2 });
  assert.deepEqual(absorbDamageWithManaAegis(10, 100, glyph.params), {
    hpDamage: 0,
    mpSpent: 20,
    remainingMp: 80,
    shieldBroken: false,
  });
  assert.deepEqual(absorbDamageWithManaAegis(40, 50, glyph.params), {
    hpDamage: 15,
    mpSpent: 50,
    remainingMp: 0,
    shieldBroken: true,
  });
  assert.deepEqual(absorbDamageWithManaAegis(10, 0, glyph.params), {
    hpDamage: 10,
    mpSpent: 0,
    remainingMp: 0,
    shieldBroken: true,
  });
});

test("Disruptor Cascade splash is half damage with 50% chance", () => {
  const glyph = glyphDefById("wizardFlameDisruptorSplash");
  assert.deepEqual(glyphFlameDisruptorSplashParams(glyph), {
    chance: 0.5,
    damageFraction: 0.5,
  });
  assert.equal(flameDisruptorSplashDamage(100, 0.5), 50);
  assert.equal(flameDisruptorSplashDamage(101, 0.5), 50);
  assert.equal(rollFlameDisruptorSplashChance(0.5, () => 0.49), true);
  assert.equal(rollFlameDisruptorSplashChance(0.5, () => 0.5), false);
  assert.equal(glyphFlameDisruptorSplashParams(null), null);
});

test("Many Mirrors glyph params expose vertical clone offset", () => {
  const glyph = glyphDefById("wizardManyMirrors");
  assert.equal(glyph?.itemId, "glyph-many-mirrors");
  assert.deepEqual(glyphManyMirrorsParams(glyph), { offsetY: 28 });
  assert.equal(glyphManyMirrorsParams(null), null);
});
