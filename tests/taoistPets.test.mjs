import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  crystalHolyDevaStats,
  resolveTaoistPetTargetCoordinates,
  resolveTaoistPetTargetWorldX,
  shouldKeepHolyDevaBetweenSoloFights,
} from "../src/core/taoistPets.js";

const baseStats = {
  maxHp: 1200,
  dc: [23, 35],
  ac: [30, 30],
  amc: [38, 38],
  attackMs: 2000,
};

test("Holy Deva level zero matches Crystal base stats", () => {
  assert.deepEqual(crystalHolyDevaStats(baseStats, 0), {
    level: 0,
    maxPetLevel: 1,
    maxHp: 1200,
    dc: [23, 35],
    ac: [30, 30],
    amc: [38, 38],
    attackMs: 1930,
    moveSpeed: 48 / 0.67,
  });
});

test("Holy Deva spell level three uses Crystal pet scaling and speed floors", () => {
  assert.deepEqual(crystalHolyDevaStats(baseStats, 3), {
    level: 3,
    maxPetLevel: 7,
    maxHp: 1260,
    dc: [26, 38],
    ac: [36, 36],
    amc: [44, 44],
    attackMs: 1510,
    moveSpeed: 120,
  });
});

test("Holy Deva spell levels are clamped to Crystal's zero-to-three range", () => {
  assert.equal(crystalHolyDevaStats(baseStats, -4).level, 0);
  assert.equal(crystalHolyDevaStats(baseStats, 99).level, 3);
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
