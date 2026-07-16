import test from "node:test";
import assert from "node:assert/strict";
import {
  GLYPH_DEFS,
  absorbDamageWithManaAegis,
  applyGlyphGroundDuration,
  applyGlyphProtectionFieldBonus,
  applyGlyphProtectionFieldDuration,
  applyGlyphTwinDrakeDamage,
  equippedGlyphDef,
  flameDisruptorSplashDamage,
  glyphDefById,
  glyphDefByItemId,
  glyphFlameDisruptorSplashParams,
  glyphFlamingSwordDrParams,
  glyphMagicShieldMpParams,
  glyphPetOwnerDcBonus,
  glyphTwinDrakeCooldownMs,
  hasGlyphModifier,
  isGlyphItem,
  rollDefenceBuffBonusFromLevel,
  rollDefenceBuffBonusFromSc,
  rollEmpoweredBossGlyphItemId,
  EMPOWERED_BOSS_GLYPH_DROP_CHANCE,
  glyphDropItemIds,
  rollFlameDisruptorSplashChance,
  rollTaoistDefenceBuffBonus,
} from "../src/glyphModifiers.js";
import { itemCanBeEmpowered } from "../src/core/empoweredItems.js";

test("glyph defs cover all implemented items and unique item ids", () => {
  const implemented = GLYPH_DEFS.filter((def) => def.implemented);
  assert.equal(implemented.length, 8);
  assert.ok(glyphDefByItemId("glyph-spirit-wards"));
  assert.ok(glyphDefByItemId("glyph-eternal-firewall"));
  assert.ok(glyphDefByItemId("glyph-bulwark-field"));
  assert.ok(glyphDefByItemId("glyph-flaming-bulwark"));
  assert.ok(glyphDefByItemId("glyph-twin-fury"));
  assert.ok(glyphDefByItemId("glyph-pet-might"));
  assert.ok(glyphDefByItemId("glyph-mana-aegis"));
  assert.ok(glyphDefByItemId("glyph-disruptor-cascade"));
  const ids = new Set(GLYPH_DEFS.map((def) => def.itemId));
  assert.equal(ids.size, GLYPH_DEFS.length);
});

test("empowered boss glyph drop is one-or-none from the full pool", () => {
  const pool = glyphDropItemIds();
  assert.equal(pool.length, GLYPH_DEFS.length);
  assert.equal(EMPOWERED_BOSS_GLYPH_DROP_CHANCE, 0.1);

  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.1), null);
  assert.equal(rollEmpoweredBossGlyphItemId(() => 0.99), null);

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
