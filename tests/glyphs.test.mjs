import test from "node:test";
import assert from "node:assert/strict";
import {
  GLYPH_DEFS,
  absorbDamageWithManaAegis,
  applyGlyphGroundDuration,
  applyGlyphMagicShieldReductionPercent,
  applyGlyphProtectionFieldBonus,
  applyGlyphProtectionFieldDuration,
  glyphProtectionFieldStat,
  glyphImmortalSkinBuffsParty,
  glyphImmortalSkinGroupParams,
  applyGlyphImmortalSkinDcPenalty,
  applyGlyphTwinDrakeDamage,
  applyGlyphSlayingDamage,
  slayingExecutionDamageMultiplier,
  glyphSlayingExecutionParams,
  glyphSlayingTakesPriority,
  glyphSlayingAlwaysReadies,
  glyphSlayingCannotMiss,
  applyGlyphSlowDestructionCombatStats,
  equippedGlyphDef,
  equippedGlyphDefs,
  GLYPH_EQUIPMENT_SLOT_IDS,
  glyphDefById,
  glyphDefByItemId,
  glyphHasFlameDisruptorCascade,
  planFlameDisruptorCascadeChain,
  glyphFrenziedDisruptorParams,
  buildFrenziedDisruptorBuffState,
  frenziedDisruptorCastSpeedBonus,
  applyFrenziedDisruptorCastCooldownMs,
  frenziedDisruptorAdjustedReadyAt,
  glyphFlamingSwordDrParams,
  glyphImprovedFlamingSwordParams,
  glyphFlamingSwordTriggersBladeAvalanche,
  glyphManyMirrorsParams,
  glyphGoldBonusPercent,
  glyphHasPotionBagRefill,
  glyphBlocksGoldGains,
  applyGlyphKillGold,
  potionBagRefillSourceEntry,
  glyphEnergyShieldLastStandParams,
  glyphEnergyShieldIsLastStand,
  glyphPlagueChainsCurse,
  glyphSkillLevelBonusPercent,
  glyphHasDemonicDeva,
  glyphHasAngelicDeva,
  glyphBlocksTaoistHealingSpells,
  isDemonicDevaBlockedHealSpell,
  applyGlyphDemonicDevaDamage,
  buildFlamingSwordBurnState,
  flamingSwordBurnTickDamage,
  flamingSwordBurnTotalDamage,
  glyphHealingIsInstant,
  glyphChainsDefenceBuffsWithUltimate,
  glyphMagicShieldMpParams,
  glyphManaRegenPerSecond,
  glyphPetOwnerDcBonus,
  glyphTwinDrakeCooldownMs,
  glyphTwinDrakeMomentumParams,
  nextTwinDrakeMomentumStacks,
  twinDrakeMomentumAttackSpeedBonus,
  glyphNullifiesAttackSpeed,
  glyphSlowDestructionParams,
  hasGlyphModifier,
  isGlyphItem,
  glyphModifierForSpell,
  rollDefenceBuffBonusFromLevel,
  rollDefenceBuffBonusFromSc,
  rollEmpoweredBossGlyphItemId,
  rollRecycledGlyphItemId,
  EMPOWERED_BOSS_GLYPH_DROP_CHANCE,
  ASCENDED_BOSS_GLYPH_DROP_CHANCE,
  AWAKENED_BOSS_GLYPH_DROP_CHANCE,
  glyphDropItemIds,
  rollTaoistDefenceBuffBonus,
  applyGlyphHealingAmount,
  applyGlyphHpPotionRestore,
  applyGlyphVitalityCombatStats,
  glyphBlocksSunPotions,
  isSunPotionFamilyItem,
  glyphVitalityParams,
  glyphDeepFrostParams,
  glyphMeteorStrikeIsSingleTarget,
  applyGlyphMeteorStrikeDamage,
  vampirismHealHpCap,
  glyphVampirismHealthShieldParams,
  rollGlyphChancePercent,
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
  assert.equal(implemented.length, 40);
  assert.ok(glyphDefByItemId("glyph-spirit-wards"));
  assert.ok(glyphDefByItemId("glyph-eternal-firewall"));
  assert.ok(glyphDefByItemId("glyph-bulwark-field"));
  assert.ok(glyphDefByItemId("glyph-magical-protection"));
  assert.ok(glyphDefByItemId("glyph-shared-skin"));
  assert.ok(glyphDefByItemId("glyph-flaming-bulwark"));
  assert.ok(glyphDefByItemId("glyph-improved-flaming-sword"));
  assert.ok(glyphDefByItemId("glyph-flaming-avalanche"));
  assert.ok(glyphDefByItemId("glyph-twin-fury"));
  assert.ok(glyphDefByItemId("glyph-blade-momentum"));
  assert.ok(glyphDefByItemId("glyph-slow-destruction"));
  assert.ok(glyphDefByItemId("glyph-pet-might"));
  assert.ok(glyphDefByItemId("glyph-demonic-deva"));
  assert.ok(glyphDefByItemId("glyph-angelic-deva"));
  assert.ok(glyphDefByItemId("glyph-instant-healing"));
  assert.ok(glyphDefByItemId("glyph-improved-healing-circle"));
  assert.ok(glyphDefByItemId("glyph-buffing"));
  assert.ok(glyphDefByItemId("glyph-infinite-mana"));
  assert.ok(glyphDefByItemId("glyph-glass-canon"));
  assert.ok(glyphDefByItemId("glyph-gold"));
  assert.ok(glyphDefByItemId("glyph-efficient-learning"));
  assert.ok(glyphDefByItemId("glyph-tank"));
  assert.ok(glyphDefByItemId("glyph-hero"));
  assert.ok(glyphDefByItemId("glyph-revival"));
  assert.ok(glyphDefByItemId("glyph-battle-wizard"));
  assert.ok(glyphDefByItemId("glyph-monk"));
  assert.ok(glyphDefByItemId("glyph-mana-aegis"));
  assert.ok(glyphDefByItemId("glyph-disruptor-cascade"));
  assert.ok(glyphDefByItemId("glyph-frenzied-disruptor"));
  assert.ok(glyphDefByItemId("glyph-deep-frost"));
  assert.ok(glyphDefByItemId("glyph-focused-meteor"));
  assert.ok(glyphDefByItemId("glyph-blood-shield"));
  assert.ok(glyphDefByItemId("glyph-execution"));
  assert.ok(glyphDefByItemId("glyph-provision"));
  assert.ok(glyphDefByItemId("glyph-last-stand"));
  assert.ok(glyphDefByItemId("glyph-blight"));
  assert.ok(glyphDefByItemId("glyph-vitality"));
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
  assert.equal(AWAKENED_BOSS_GLYPH_DROP_CHANCE, 0.2);

  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.1), null);
  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.99), null);
  // Ascended uses 15%: 0.10 hits, 0.15 misses.
  assert.ok(rollEmpoweredBossGlyphItemId(() => 0.1, { ascended: true }));
  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.15, { ascended: true }), null);
  // Awakened uses 20%: 0.15 hits, 0.20 misses.
  assert.ok(rollEmpoweredBossGlyphItemId(() => 0.15, { awakened: true }));
  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.2, { awakened: true }), null);
  // Awakened wins over ascended when both flags are set.
  assert.ok(rollEmpoweredBossGlyphItemId(() => 0.15, { ascended: true, awakened: true }));

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

test("recycled glyph roll never returns the sacrificed glyph ids", () => {
  const pool = glyphDropItemIds();
  const exclude = [pool[0], pool[1]];
  for (let i = 0; i < pool.length; i += 1) {
    const rolled = rollRecycledGlyphItemId(exclude, () => (i + 0.5) / (pool.length - exclude.length));
    assert.ok(rolled);
    assert.equal(exclude.includes(rolled), false);
  }
  assert.equal(rollRecycledGlyphItemId(exclude, () => 0), pool[2]);
  assert.equal(rollRecycledGlyphItemId([pool[0], pool[0]], () => 0), pool[1]);
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
  // Buffing in an earlier slot must not shadow Spirit Wards for spell lookup.
  const inventory = {
    equipment: { glyph: "buffing", glyph2: "wards" },
    items: [
      { id: "buffing", itemId: "glyph-buffing" },
      { id: "wards", itemId: "glyph-spirit-wards" },
    ],
  };
  assert.equal(glyphModifierForSpell(inventory, "SoulShield")?.id, "taoDefenceBuffFromSc");
  assert.equal(glyphModifierForSpell(inventory, "BlessedArmour")?.id, "taoDefenceBuffFromSc");
  assert.equal(glyphModifierForSpell(inventory, "UltimateEnhancer")?.id, "taoUltimateBuffChain");
});

test("Fire Wall duration doubles with glyph", () => {
  const glyph = glyphDefById("wizardFireWallDuration");
  assert.equal(applyGlyphGroundDuration(10500, "FireWall", glyph), 21000);
  assert.equal(applyGlyphGroundDuration(10500, "IceStorm", glyph), 10500);
  assert.equal(applyGlyphGroundDuration(10500, "FireWall", null), 10500);
});

test("Focused Meteor doubles Meteor Strike and leaves other spells alone", () => {
  const glyph = glyphDefById("wizardMeteorStrikeSingle");
  assert.equal(glyph?.itemId, "glyph-focused-meteor");
  assert.deepEqual(glyph?.spellIds, ["MeteorStrike"]);
  assert.ok(glyphMeteorStrikeIsSingleTarget(glyph));
  assert.equal(glyphMeteorStrikeIsSingleTarget(null), false);
  assert.equal(applyGlyphMeteorStrikeDamage(100, "MeteorStrike", glyph), 200);
  assert.equal(applyGlyphMeteorStrikeDamage(0, "MeteorStrike", glyph), 0);
  assert.equal(applyGlyphMeteorStrikeDamage(100, "Blizzard", glyph), 100);
  assert.equal(applyGlyphMeteorStrikeDamage(100, "MeteorStrike", null), 100);
});

test("Blood Shield lets Vampirism overheal to 150% max HP", () => {
  const glyph = glyphDefById("wizardVampirismHealthShield");
  assert.equal(glyph?.itemId, "glyph-blood-shield");
  assert.deepEqual(glyph?.spellIds, ["Vampirism"]);
  assert.equal(glyphVampirismHealthShieldParams(glyph)?.maxHpRatio, 1.5);
  assert.equal(vampirismHealHpCap(1000, glyph), 1500);
  assert.equal(vampirismHealHpCap(1000, null), 1000);
  assert.equal(vampirismHealHpCap(0, glyph), 0);
});

test("Execution makes charged Slaying a guaranteed high-damage blow", () => {
  const glyph = glyphDefById("warriorSlayingExecution");
  assert.equal(glyph?.itemId, "glyph-execution");
  assert.deepEqual(glyph?.spellIds, ["Slaying"]);
  assert.ok(glyphSlayingTakesPriority(glyph));
  assert.ok(glyphSlayingAlwaysReadies(glyph));
  assert.ok(glyphSlayingCannotMiss(glyph));
  assert.equal(glyphSlayingTakesPriority(null), false);
  const healthy = { hp: 100, maxHp: 100 };
  const wounded = { hp: 50, maxHp: 100 };
  const barelyHealthy = { hp: 51, maxHp: 100 };
  assert.equal(slayingExecutionDamageMultiplier(healthy, glyph), 2.5);
  assert.equal(slayingExecutionDamageMultiplier(wounded, glyph), 9);
  assert.equal(slayingExecutionDamageMultiplier(barelyHealthy, glyph), 2.5);
  assert.equal(applyGlyphSlayingDamage(100, "Slaying", healthy, glyph), 250);
  assert.equal(applyGlyphSlayingDamage(100, "Slaying", wounded, glyph), 900);
  assert.equal(applyGlyphSlayingDamage(100, "FlamingSword", healthy, glyph), 100);
  assert.equal(applyGlyphSlayingDamage(100, "Slaying", healthy, null), 100);
  assert.equal(glyphSlayingExecutionParams(glyph)?.executeHpRatio, 0.5);
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

test("Shared Skin doubles Immortal Skin DC penalty and marks it as a party buff", () => {
  const glyph = glyphDefById("warriorImmortalSkinParty");
  assert.equal(glyph?.itemId, "glyph-shared-skin");
  assert.deepEqual(glyph?.spellIds, ["ImmortalSkin"]);
  assert.ok(glyphImmortalSkinBuffsParty(glyph));
  assert.equal(glyphImmortalSkinBuffsParty(null), false);
  assert.equal(glyphImmortalSkinGroupParams(glyph)?.casterDcPenaltyMultiplier, 2);
  assert.equal(applyGlyphImmortalSkinDcPenalty(8, glyph), 16);
  assert.equal(applyGlyphImmortalSkinDcPenalty(8, null), 8);
});

test("Glyph of Gold doubles monster and boss gold drops", () => {
  const glyph = glyphDefById("goldDrops");
  assert.equal(glyph?.itemId, "glyph-gold");
  assert.equal(glyphGoldBonusPercent(glyph), 100);
  assert.equal(glyphGoldBonusPercent(null), 0);
});

test("Glyph of Last Stand rewrites Energy Shield into a fatal save", () => {
  const glyph = glyphDefById("taoEnergyShieldLastStand");
  assert.equal(glyph?.itemId, "glyph-last-stand");
  assert.deepEqual(glyph?.spellIds, ["EnergyShield"]);
  assert.ok(glyphEnergyShieldIsLastStand(glyph));
  assert.equal(glyphEnergyShieldIsLastStand(null), false);
  assert.equal(glyphEnergyShieldLastStandParams(glyph)?.cooldownMs, 300000);
  assert.equal(glyphEnergyShieldLastStandParams(null), null);
});

test("Glyph of Blight chains a normal Curse attempt off Plague", () => {
  const glyph = glyphDefById("taoPlagueChainsCurse");
  assert.equal(glyph?.itemId, "glyph-blight");
  assert.deepEqual(glyph?.spellIds, ["Plague"]);
  assert.ok(glyphPlagueChainsCurse(glyph));
  assert.equal(glyphPlagueChainsCurse(null), false);
});

test("Glyph of Provision uses bag potions first and blocks gold", () => {
  const glyph = glyphDefById("potionBagRefill");
  assert.equal(glyph?.itemId, "glyph-provision");
  assert.ok(glyphHasPotionBagRefill(glyph));
  assert.ok(glyphBlocksGoldGains(glyph));
  assert.equal(glyphHasPotionBagRefill(null), false);
  assert.equal(applyGlyphKillGold(250, glyph), 0);
  assert.equal(applyGlyphKillGold(250, null), 250);
  const bag = { id: "bag-hp", itemId: "hp-drug-small", quantity: 20 };
  const hot = { id: "hot-hp", itemId: "hp-drug-small", quantity: 6 };
  const other = { id: "bag-mp", itemId: "mp-drug-small", quantity: 4 };
  assert.equal(
    potionBagRefillSourceEntry(
      [hot, bag, other],
      ["hot-hp"],
      { weapon: "sword-1" },
      "hp-drug-small",
    )?.id,
    "bag-hp",
  );
  assert.equal(
    potionBagRefillSourceEntry([hot], ["hot-hp"], {}, "hp-drug-small"),
    null,
  );
});

test("Glyph of Efficient Learning doubles skill practice XP", () => {
  const glyph = glyphDefById("efficientLearning");
  assert.equal(glyph?.itemId, "glyph-efficient-learning");
  assert.equal(glyphSkillLevelBonusPercent(glyph), 100);
  assert.equal(glyphSkillLevelBonusPercent(null), 0);
});

test("Glyph of Demonic Deva boosts Holy Deva damage", () => {
  const glyph = glyphDefById("demonicDeva");
  assert.equal(glyph?.itemId, "glyph-demonic-deva");
  assert.equal(glyph?.classId, "taoist");
  assert.deepEqual(glyph?.spellIds, ["SummonHolyDeva"]);
  assert.ok(glyphHasDemonicDeva(glyph));
  assert.equal(glyphHasDemonicDeva(null), false);
  assert.equal(applyGlyphDemonicDevaDamage(100, glyph), 150);
  assert.equal(applyGlyphDemonicDevaDamage(0, glyph), 0);
  assert.equal(applyGlyphDemonicDevaDamage(100, null), 100);
  assert.ok(glyphBlocksTaoistHealingSpells(glyph));
  assert.equal(glyphBlocksTaoistHealingSpells(null), false);
  assert.ok(isDemonicDevaBlockedHealSpell("Healing"));
  assert.ok(isDemonicDevaBlockedHealSpell("MassHealing"));
  assert.ok(isDemonicDevaBlockedHealSpell("HealingCircle"));
  assert.equal(isDemonicDevaBlockedHealSpell("SoulFireBall"), false);
});

test("Glyph of Angelic Deva turns Holy Deva into a Mass Healing support", () => {
  const glyph = glyphDefById("angelicDeva");
  assert.equal(glyph?.itemId, "glyph-angelic-deva");
  assert.equal(glyph?.classId, "taoist");
  assert.deepEqual(glyph?.spellIds, ["SummonHolyDeva"]);
  assert.match(glyph?.description ?? "", /Mass Healing/i);
  assert.ok(glyphHasAngelicDeva(glyph));
  assert.equal(glyphHasAngelicDeva(null), false);
  assert.equal(glyphBlocksTaoistHealingSpells(glyph), false);
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

test("Flaming Avalanche glyph is identified by kind", () => {
  const glyph = glyphDefById("warriorFlamingAvalanche");
  assert.equal(glyph?.itemId, "glyph-flaming-avalanche");
  assert.equal(glyph?.classId, "warrior");
  assert.deepEqual(glyph?.spellIds, ["FlamingSword", "BladeAvalanche"]);
  assert.ok(glyphFlamingSwordTriggersBladeAvalanche(glyph));
  assert.equal(glyphFlamingSwordTriggersBladeAvalanche(null), false);
});

test("Twin Fury glyph multiplies Twin Drake damage by 2.5 and sets cooldown", () => {
  const glyph = glyphDefById("warriorTwinDrakeBurst");
  assert.equal(applyGlyphTwinDrakeDamage(100, "TwinDrakeBlade", glyph), 250);
  assert.equal(applyGlyphTwinDrakeDamage(100, "FlamingSword", glyph), 100);
  assert.equal(applyGlyphTwinDrakeDamage(100, "TwinDrakeBlade", null), 100);
  assert.equal(glyphTwinDrakeCooldownMs(glyph), 2000);
  assert.equal(glyphTwinDrakeCooldownMs(null), 0);
});

test("Blade Momentum glyph stacks AS on TDB hits and resets otherwise", () => {
  const glyph = glyphDefById("warriorTwinDrakeMomentum");
  assert.equal(glyph?.itemId, "glyph-blade-momentum");
  const params = glyphTwinDrakeMomentumParams(glyph);
  assert.deepEqual(params, { asPerHit: 1, maxStacks: 40 });
  assert.equal(glyphTwinDrakeMomentumParams(null), null);

  let stacks = 0;
  stacks = nextTwinDrakeMomentumStacks(stacks, "TwinDrakeBlade", params, { hitSucceeded: true });
  assert.equal(stacks, 1);
  stacks = nextTwinDrakeMomentumStacks(stacks, "TwinDrakeBlade", params, { hitSucceeded: true });
  assert.equal(stacks, 2);
  assert.equal(twinDrakeMomentumAttackSpeedBonus(stacks), 2);

  assert.equal(
    nextTwinDrakeMomentumStacks(stacks, "TwinDrakeBlade", params, { hitSucceeded: false }),
    0,
  );
  assert.equal(nextTwinDrakeMomentumStacks(5, "Rage", params, { hitSucceeded: false }), 0);
  assert.equal(nextTwinDrakeMomentumStacks(5, "FlamingSword", params, { hitSucceeded: true }), 0);
  assert.equal(nextTwinDrakeMomentumStacks(5, "None", params, { hitSucceeded: true }), 0);
  assert.equal(nextTwinDrakeMomentumStacks(39, "TwinDrakeBlade", params, { hitSucceeded: true }), 40);
  assert.equal(nextTwinDrakeMomentumStacks(40, "TwinDrakeBlade", params, { hitSucceeded: true }), 40);
});

test("Slow Destruction glyph multiplies DC and nullifies attack speed", () => {
  const glyph = glyphDefById("warriorSlowDestruction");
  assert.equal(glyph?.itemId, "glyph-slow-destruction");
  assert.equal(glyph?.classId, "warrior");
  assert.equal(glyphSlowDestructionParams(glyph)?.dcMultiplier, 2.5);
  assert.ok(glyphNullifiesAttackSpeed(glyph));
  assert.equal(glyphNullifiesAttackSpeed(null), false);
  assert.deepEqual(
    applyGlyphSlowDestructionCombatStats({ dc: [100, 200] }, glyph).dc,
    [250, 500],
  );
  assert.deepEqual(
    applyGlyphSlowDestructionCombatStats({ dc: [100, 200] }, null).dc,
    [100, 200],
  );
});

test("Pet Might glyph adds owner Max DC to all Taoist pets", () => {
  const glyph = glyphDefById("taoPetOwnerDc");
  assert.deepEqual(glyph?.spellIds, ["SummonSkeleton", "SummonShinsu", "SummonHolyDeva"]);
  assert.match(glyph?.description ?? "", /physical power \(DC\)/i);
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

test("Vitality glyph doubles max HP and blocks sun potion family", () => {
  const glyph = glyphDefById("vitality");
  assert.equal(glyph?.itemId, "glyph-vitality");
  assert.equal(glyph?.classId, "any");
  assert.deepEqual(glyphVitalityParams(glyph), { maxHpMultiplier: 2 });
  assert.equal(applyGlyphVitalityCombatStats({ maxHp: 500 }, glyph).maxHp, 1000);
  assert.equal(applyGlyphVitalityCombatStats({ maxHp: 500 }, null).maxHp, 500);
  assert.equal(glyphBlocksSunPotions(glyph), true);
  assert.equal(glyphBlocksSunPotions(null), false);
  assert.equal(isSunPotionFamilyItem({ id: "sun-potion" }), true);
  assert.equal(isSunPotionFamilyItem({ id: "sun-potion-medium" }), true);
  assert.equal(isSunPotionFamilyItem({ id: "old-ginseng", potionFamily: "sun" }), true);
  assert.equal(isSunPotionFamilyItem({ id: "health-potion" }), false);
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
  // Buffing must NOT claim SoulShield/BlessedArmour spellIds — that stole Spirit Wards
  // from spell-scoped glyph lookup when Buffing was equipped in an earlier slot.
  assert.deepEqual(glyph?.spellIds, ["UltimateEnhancer"]);
  assert.equal(
    rollTaoistDefenceBuffBonus(52, 80, [
      glyphDefById("taoUltimateBuffChain"),
      glyphDefById("taoDefenceBuffFromSc"),
    ]),
    20,
  );
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
  assert.deepEqual(glyphMagicShieldMpParams(glyph), {
    mpPerHp: 2,
    damageReductionFraction: 0.5,
  });
  assert.equal(applyGlyphMagicShieldReductionPercent(50, glyph), 25);
  assert.equal(applyGlyphMagicShieldReductionPercent(30, glyph), 15);
  assert.equal(applyGlyphMagicShieldReductionPercent(50, null), 50);
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

test("Disruptor Cascade glyph is a kill-explosion chain modifier", () => {
  const glyph = glyphDefById("wizardFlameDisruptorSplash");
  assert.equal(glyph?.itemId, "glyph-disruptor-cascade");
  assert.match(glyph?.description ?? "", /killing blow/i);
  assert.equal(glyphHasFlameDisruptorCascade(glyph), true);
  assert.equal(glyphHasFlameDisruptorCascade(null), false);
});

test("Frenzied Disruptor glyph halves FD cast time at proc then decays to normal", () => {
  const glyph = glyphDefById("wizardFrenziedDisruptor");
  assert.equal(glyph?.itemId, "glyph-frenzied-disruptor");
  assert.match(glyph?.description ?? "", /casting speed/i);
  const params = glyphFrenziedDisruptorParams(glyph);
  assert.deepEqual(params, { castSpeedBonus: 1, durationMs: 5000 });
  assert.equal(glyphFrenziedDisruptorParams(null), null);

  const now = 1000;
  const buff = buildFrenziedDisruptorBuffState(params, now);
  assert.equal(frenziedDisruptorCastSpeedBonus(buff, now), 1);
  assert.equal(applyFrenziedDisruptorCastCooldownMs(1800, buff, now), 900);
  assert.equal(frenziedDisruptorCastSpeedBonus(buff, now + 2500), 0.5);
  assert.equal(applyFrenziedDisruptorCastCooldownMs(1800, buff, now + 2500), 1200);
  assert.equal(frenziedDisruptorCastSpeedBonus(buff, now + 5000), 0);
  assert.equal(applyFrenziedDisruptorCastCooldownMs(1800, buff, now + 5000), 1800);
  assert.equal(applyFrenziedDisruptorCastCooldownMs(1800, null, now), 1800);
  // Crit mid-recovery on an unbuffed cast: elapsed 500 of 1800 → buffed 900 → 400 remaining.
  assert.equal(frenziedDisruptorAdjustedReadyAt(now + 1300, now, 1800, 900), now + 400);
  assert.equal(frenziedDisruptorAdjustedReadyAt(now + 200, now, 1800, 900), now);
  assert.equal(frenziedDisruptorAdjustedReadyAt(now, now, 1800, 900), now);
  // Re-crit while already on the buffed CD must not collapse remaining time.
  assert.equal(frenziedDisruptorAdjustedReadyAt(now + 400, now, 900, 900), now + 400);
  assert.equal(frenziedDisruptorAdjustedReadyAt(now + 600, now, 1200, 900), now + 300);
});

test("Deep Frost glyph exposes boss Frost Crunch chances", () => {
  const glyph = glyphDefById("wizardDeepFrost");
  assert.equal(glyph?.itemId, "glyph-deep-frost");
  assert.equal(glyph?.classId, "wizard");
  assert.deepEqual(glyph?.spellIds, ["FrostCrunch"]);
  assert.deepEqual(glyphDeepFrostParams(glyph), {
    bossSlowChancePercent: 15,
    bossFreezeChancePercent: 5,
  });
  assert.equal(glyphDeepFrostParams(null), null);
  assert.equal(rollGlyphChancePercent(15, () => 0.149), true);
  assert.equal(rollGlyphChancePercent(15, () => 0.15), false);
  assert.equal(rollGlyphChancePercent(5, () => 0.049), true);
  assert.equal(rollGlyphChancePercent(5, () => 0.05), false);
});

test("Disruptor Cascade chain explodes adjacent kills at full blast damage", () => {
  // A killed; B and C adjacent to A; D only adjacent to B.
  // Blast 100: A→B(80) and A→C(50) both die; B→D(40) dies. Empty blasts still listed.
  const steps = planFlameDisruptorCascadeChain(1, 100, [
    { id: 1, hp: 0, neighborIds: [2, 3] },
    { id: 2, hp: 80, neighborIds: [1, 4] },
    { id: 3, hp: 50, neighborIds: [1] },
    { id: 4, hp: 40, neighborIds: [2] },
  ]);
  assert.deepEqual(steps, [
    { sourceId: 1, targetIds: [2, 3] },
    { sourceId: 2, targetIds: [4] },
    { sourceId: 3, targetIds: [] },
    { sourceId: 4, targetIds: [] },
  ]);
});

test("Disruptor Cascade does not re-explode or loop", () => {
  const steps = planFlameDisruptorCascadeChain("a", 50, [
    { id: "a", hp: 0, neighborIds: ["b"] },
    { id: "b", hp: 50, neighborIds: ["a", "c"] },
    { id: "c", hp: 50, neighborIds: ["b"] },
  ]);
  assert.deepEqual(steps, [
    { sourceId: "a", targetIds: ["b"] },
    { sourceId: "b", targetIds: ["c"] },
    { sourceId: "c", targetIds: [] },
  ]);
  assert.equal(planFlameDisruptorCascadeChain("missing", 10, [{ id: 1, hp: 0, neighborIds: [] }]).length, 0);
  assert.equal(planFlameDisruptorCascadeChain(1, 0, [{ id: 1, hp: 0, neighborIds: [2] }]).length, 0);
});

test("Many Mirrors glyph params expose vertical clone offset", () => {
  const glyph = glyphDefById("wizardManyMirrors");
  assert.equal(glyph?.itemId, "glyph-many-mirrors");
  assert.deepEqual(glyphManyMirrorsParams(glyph), { offsetY: 28 });
  assert.equal(glyphManyMirrorsParams(null), null);
});
