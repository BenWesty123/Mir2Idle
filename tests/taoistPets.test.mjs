import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  crystalHolyDevaStats,
  resolveTaoistPetTargetCoordinates,
  resolveTaoistPetTargetWorldX,
  shouldKeepHolyDevaBetweenSoloFights,
  taoistPetCombatStats,
  taoistPetLayerBlendModes,
  taoistPetLevelFromSpellLevel,
} from "../src/core/taoistPets.js";

const baseStats = {
  maxHp: 1200,
  dc: [23, 35],
  ac: [30, 30],
  amc: [38, 38],
  attackMs: 2000,
};

test("taoistPetLevelFromSpellLevel maps spell tiers to pet levels 0/2/4/7", () => {
  assert.deepEqual([0, 1, 2, 3].map(taoistPetLevelFromSpellLevel), [0, 2, 4, 7]);
  assert.equal(taoistPetLevelFromSpellLevel(99), 7);
});

test("taoistPetCombatStats applies Crystal scaling plus 25% buff", () => {
  assert.deepEqual(taoistPetCombatStats({
    maxHp: 140,
    dc: [12, 23],
    ac: [2, 4],
    amc: [3, 6],
  }, 7), {
    maxHp: 350,
    dc: [23, 37],
    ac: [20, 22],
    amc: [21, 25],
  });
});

test("Holy Deva spell level zero summons pet level zero with 25% buff", () => {
  assert.deepEqual(crystalHolyDevaStats(baseStats, 0), {
    level: 0,
    maxPetLevel: 1,
    maxHp: 1500,
    dc: [28, 43],
    ac: [37, 37],
    amc: [47, 47],
    attackMs: 1930,
    moveSpeed: 48 / 0.67,
  });
});

test("Holy Deva spell level three summons pet level seven with 25% buff", () => {
  assert.deepEqual(crystalHolyDevaStats(baseStats, 3), {
    level: 7,
    maxPetLevel: 7,
    maxHp: 1675,
    dc: [37, 52],
    ac: [55, 55],
    amc: [65, 65],
    attackMs: 1510,
    moveSpeed: 120,
  });
});

test("Holy Deva spell levels are clamped to Crystal's zero-to-three range", () => {
  assert.equal(crystalHolyDevaStats(baseStats, -4).level, 0);
  assert.equal(crystalHolyDevaStats(baseStats, 99).level, 7);
});

test("living and pending Holy Devas persist between solo enemies", () => {
  assert.equal(shouldKeepHolyDevaBetweenSoloFights({
    spellId: "SummonHolyDeva",
    active: true,
    dead: false,
    hp: 1200,
  }, null), true);
  assert.equal(shouldKeepHolyDevaBetweenSoloFights(null, {
    spellId: "SummonHolyDeva",
  }), true);
  assert.equal(shouldKeepHolyDevaBetweenSoloFights({
    spellId: "SummonHolyDeva",
    active: false,
    dead: true,
    hp: 0,
  }, null), false);
  assert.equal(shouldKeepHolyDevaBetweenSoloFights({
    spellId: "SummonSkeleton",
    active: true,
    dead: false,
    hp: 100,
  }, null), false);
});

test("Holy Deva runtime assets use east-facing Crystal layers and summon audio", () => {
  const atlas = JSON.parse(fs.readFileSync(
    new URL("../public/monsters/monster/117.json", import.meta.url),
    "utf8",
  ));
  const sfx = JSON.parse(fs.readFileSync(
    new URL("../public/audio/sfx/manifest.json", import.meta.url),
    "utf8",
  ));

  assert.equal(atlas.direction, 2);
  assert.equal(atlas.actions.standing.frames[0].srcFrame, 8);
  assert.equal(atlas.actions.attack1.frames[0].srcFrame, 92);
  assert.equal(atlas.overlays.standing.frames.length, 4);
  assert.equal(atlas.overlays.attack1.frames.length, 6);
  assert.equal(sfx.byKey["pet.holydeva.summon"].sourceFile, "117-5.wav");
});

test("Holy Deva uses Crystal's blended base and normally drawn colour overlay", () => {
  assert.deepEqual(taoistPetLayerBlendModes({ overlays: {} }), {
    base: "screen",
    overlay: "source-over",
  });
  assert.deepEqual(taoistPetLayerBlendModes({}), {
    base: "source-over",
    overlay: null,
  });
});

test("Holy Deva target position does not coerce a missing enemy coordinate to the player origin", () => {
  assert.equal(resolveTaoistPetTargetWorldX(null, 240), 240);
  assert.equal(resolveTaoistPetTargetWorldX(undefined, 240), 240);
  assert.equal(resolveTaoistPetTargetWorldX(384, 240), 384);
});

test("Holy Deva resolves group-dungeon lightning against the real swarm monster", () => {
  assert.deepEqual(resolveTaoistPetTargetCoordinates({
    worldX: 432,
    mapRow: 27,
  }, 240), {
    worldX: 432,
    mapRow: 27,
  });
  assert.deepEqual(resolveTaoistPetTargetCoordinates(null, 240), {
    worldX: 240,
    mapRow: null,
  });
});
