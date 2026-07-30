import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceWizardMirrorFollow,
  pickWizardMirrorAttackSpell,
  resolveWizardMirrorUpkeep,
  scaleWizardMirrorDamage,
  wizardMirrorCastSfxPhase,
  wizardMirrorDamageMultiplier,
  wizardMirrorDurationMs,
  wizardMirrorAttackRangePx,
  wizardMirrorManyExtraOffsets,
  wizardMirrorTargetInRange,
} from "../src/core/wizardMirror.js";
import { glyphManyMirrorsParams, glyphDefById } from "../src/glyphModifiers.js";

test("mirror uses Thunder Bolt on undead regardless of Flame Disruptor", () => {
  assert.equal(pickWizardMirrorAttackSpell({ enemyUndead: true, flameDisruptorLearned: true }), "ThunderBolt");
});

test("mirror prefers Flame Disruptor on living targets only when learned", () => {
  assert.equal(pickWizardMirrorAttackSpell({ enemyUndead: false, flameDisruptorLearned: true }), "FlameDisruptor");
  assert.equal(pickWizardMirrorAttackSpell({ enemyUndead: false, flameDisruptorLearned: false }), "ThunderBolt");
});

test("Many Mirrors glyph forces Fire Ball regardless of target or Flame Disruptor", () => {
  assert.equal(pickWizardMirrorAttackSpell({
    enemyUndead: false,
    flameDisruptorLearned: true,
    fireballOnly: true,
  }), "FireBall");
  assert.equal(pickWizardMirrorAttackSpell({
    enemyUndead: true,
    flameDisruptorLearned: false,
    fireballOnly: true,
  }), "FireBall");
});

test("Many Mirrors extras sit above and below the main clone", () => {
  assert.deepEqual(wizardMirrorManyExtraOffsets(28), [
    { id: "above", offsetY: -28 },
    { id: "below", offsetY: 28 },
  ]);
  assert.deepEqual(glyphManyMirrorsParams(glyphDefById("wizardManyMirrors")), { offsetY: 28 });
  assert.equal(glyphManyMirrorsParams(null), null);
});

test("mirror leaves target spell sound for impact instead of playing it twice", () => {
  assert.equal(wizardMirrorCastSfxPhase("target"), null);
  assert.equal(wizardMirrorCastSfxPhase("projectile"), "fly");
  assert.equal(wizardMirrorCastSfxPhase("ground"), "cast");
});

test("mirror range is six tiles from the Wizard rather than its visual offset", () => {
  assert.equal(wizardMirrorTargetInRange(100, 388, 48), true);
  assert.equal(wizardMirrorTargetInRange(100, 389, 48), false);
});

test("boss-party mirror range stretches for backline Wizard + large bossMeleeGap", () => {
  // Beast King: Wizard is 4 tiles behind the tank, boss rests 120px out → 312px.
  const beastKingRange = wizardMirrorAttackRangePx(48, {
    formationDepthPx: 4 * 48,
    enemyMeleeGapPx: 120,
  });
  assert.equal(beastKingRange, 312);
  assert.equal(wizardMirrorTargetInRange(0, 312, 48), false);
  assert.equal(wizardMirrorTargetInRange(0, 312, 48, beastKingRange), true);
  // Normal 48px stand-off still uses the base 6-tile range.
  assert.equal(wizardMirrorAttackRangePx(48, {
    formationDepthPx: 4 * 48,
    enemyMeleeGapPx: 48,
  }), 288);
});

test("mirror drains 10 MP for every elapsed second and catches up deterministically", () => {
  assert.deepEqual(resolveWizardMirrorUpkeep({ ownerMp: 55, nextUpkeepAt: 2000, now: 4500 }), {
    ownerMp: 25,
    nextUpkeepAt: 5000,
    ticks: 3,
    spentMp: 30,
    exhausted: false,
  });
});

test("mirror expires when upkeep drains its owner to zero MP", () => {
  assert.deepEqual(resolveWizardMirrorUpkeep({ ownerMp: 8, nextUpkeepAt: 2000, now: 2000 }), {
    ownerMp: 0,
    nextUpkeepAt: 3000,
    ticks: 1,
    spentMp: 8,
    exhausted: true,
  });
});

test("mirror duration keeps the game-specific 2 to 9 minute progression", () => {
  assert.equal(wizardMirrorDurationMs(0), 120000);
  assert.equal(wizardMirrorDurationMs(3), 540000);
  assert.equal(wizardMirrorDurationMs(99), 540000);
});

test("mirror damage scales to full power only at Mirroring rank 3", () => {
  assert.equal(wizardMirrorDamageMultiplier(0), 0.55);
  assert.equal(wizardMirrorDamageMultiplier(1), 0.7);
  assert.equal(wizardMirrorDamageMultiplier(2), 0.85);
  assert.equal(wizardMirrorDamageMultiplier(3), 1);
  assert.equal(wizardMirrorDamageMultiplier(99), 1);
  assert.equal(scaleWizardMirrorDamage(1000, 0), 550);
  assert.equal(scaleWizardMirrorDamage(1000, 1), 700);
  assert.equal(scaleWizardMirrorDamage(1000, 2), 850);
  assert.equal(scaleWizardMirrorDamage(1000, 3), 1000);
  assert.equal(scaleWizardMirrorDamage(1, 0), 1);
  assert.equal(scaleWizardMirrorDamage(0, 3), 0);
});

test("mirror waits for its reaction delay before following", () => {
  assert.deepEqual(advanceWizardMirrorFollow({
    worldX: 52,
    desiredWorldX: 100,
    now: 1400,
    lastMoveAt: 1300,
    followAfter: 1500,
    walkSpeed: 100,
    runSpeed: 180,
  }), {
    worldX: 52,
    lastMoveAt: 1400,
    moving: false,
    action: "stance",
  });
});

test("mirror follows after reacting and stops exactly at its target", () => {
  const moving = advanceWizardMirrorFollow({
    worldX: 52,
    desiredWorldX: 100,
    now: 1600,
    lastMoveAt: 1500,
    followAfter: 1500,
    walkSpeed: 100,
    runSpeed: 180,
  });
  assert.equal(moving.moving, true);
  assert.equal(moving.action, "walking");
  assert.equal(moving.worldX, 62);

  const arrived = advanceWizardMirrorFollow({
    worldX: 99.5,
    desiredWorldX: 100,
    now: 1700,
    lastMoveAt: 1600,
    followAfter: 1500,
    walkSpeed: 100,
    runSpeed: 180,
  });
  assert.equal(arrived.worldX, 100);
  assert.equal(arrived.moving, false);
  assert.equal(arrived.action, "stance");
});

test("mirror cannot move while casting", () => {
  const result = advanceWizardMirrorFollow({
    worldX: 52,
    desiredWorldX: 100,
    now: 2000,
    lastMoveAt: 1900,
    movementBlocked: true,
    walkSpeed: 100,
    runSpeed: 180,
  });
  assert.equal(result.worldX, 52);
  assert.equal(result.moving, false);
});

test("mirror uses normal run speed without a catch-up multiplier", () => {
  const result = advanceWizardMirrorFollow({
    worldX: 0,
    desiredWorldX: 100,
    now: 1100,
    lastMoveAt: 1000,
    ownerRunning: true,
    walkSpeed: 100,
    runSpeed: 180,
  });
  assert.equal(result.worldX, 18);
  assert.equal(result.action, "running");
});
