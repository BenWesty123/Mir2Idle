import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GROUP_DUNGEON_SWARM_TILE_PX,
  adjacentEightTiles,
  fireWallLaneStripTiles,
  wizardFireWallBlocksAdditionalGroundEffect,
  clampHellfireEastBound,
  pickBestUncoveredGroundAreaCenter,
  spellGroundAreaTiles,
  swarmCellKey,
  swarmLaneMapRow,
  swarmPickCenterLaneStep,
  swarmWalkableTiles,
} from "../src/groupDungeonSwarm.js";
import { PHASE1_ENEMY_TEMPLATES, PHASE1_ZONES } from "../src/phase1Data.js";

const meleeCol = GROUP_DUNGEON_SWARM_TILE_PX * 10;
const arenaRow = 100;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directionalActions = [
  "walkNorth", "walkSouth", "walkNorthWest", "walkSouthWest",
  "attackNorthWest", "attackSouthWest", "standingNorthWest", "standingSouthWest",
];

function enemy(id, lane, overrides = {}) {
  return {
    id,
    hp: 100,
    dying: false,
    stationaryBoss: false,
    worldX: meleeCol,
    mapRow: swarmLaneMapRow(lane, arenaRow),
    stepToX: null,
    ...overrides,
  };
}

test("normal Fire Wall may add another ground effect; Hellfire may not", () => {
  assert.equal(wizardFireWallBlocksAdditionalGroundEffect(false, true), false);
  assert.equal(wizardFireWallBlocksAdditionalGroundEffect(false, false), false);
  assert.equal(wizardFireWallBlocksAdditionalGroundEffect(true, false), false);
  assert.equal(wizardFireWallBlocksAdditionalGroundEffect(true, true), true);
});

test("pickBestUncoveredGroundAreaCenter keeps an existing 3x3 and only shifts to uncovered tiles", () => {
  const tile = GROUP_DUNGEON_SWARM_TILE_PX;
  const firstEnemy = { worldX: meleeCol, mapRow: arenaRow };
  const secondEnemy = { worldX: meleeCol + tile * 4, mapRow: arenaRow };
  const first = pickBestUncoveredGroundAreaCenter({
    enemyTiles: [firstEnemy, secondEnemy],
    radius: 1,
    meleeWorldX: meleeCol,
  });
  assert.ok(first);
  const covered = new Set(spellGroundAreaTiles(first.worldX, first.mapRow, 1).map(swarmCellKey));
  assert.ok(covered.has(swarmCellKey(firstEnemy)));

  const next = pickBestUncoveredGroundAreaCenter({
    enemyTiles: [firstEnemy, secondEnemy],
    activeTileKeys: covered,
    radius: 1,
    meleeWorldX: meleeCol,
  });
  assert.ok(next);
  assert.notEqual(swarmCellKey(next), swarmCellKey(first));
  const nextCovered = new Set(spellGroundAreaTiles(next.worldX, next.mapRow, 1).map(swarmCellKey));
  assert.ok(nextCovered.has(swarmCellKey(secondEnemy)));
  assert.equal(nextCovered.has(swarmCellKey(firstEnemy)), false);

  const none = pickBestUncoveredGroundAreaCenter({
    enemyTiles: [firstEnemy, secondEnemy],
    activeTileKeys: new Set([...covered, ...nextCovered]),
    radius: 1,
    meleeWorldX: meleeCol,
  });
  assert.equal(none, null);
});

test("adjacentEightTiles is the 8 neighbours around a cell", () => {
  const tiles = adjacentEightTiles(meleeCol, arenaRow);
  assert.equal(tiles.length, 8);
  assert.equal(tiles.some((t) => t.worldX === meleeCol && t.mapRow === arenaRow), false);
  assert.ok(tiles.some((t) => t.worldX === meleeCol + GROUP_DUNGEON_SWARM_TILE_PX && t.mapRow === arenaRow));
  assert.ok(tiles.some((t) => t.worldX === meleeCol + GROUP_DUNGEON_SWARM_TILE_PX && t.mapRow === arenaRow + 1));
});

test("swarmWalkableTiles carpets 3 lanes from melee to eastmost", () => {
  const east = meleeCol + GROUP_DUNGEON_SWARM_TILE_PX * 2;
  const tiles = swarmWalkableTiles(meleeCol, arenaRow, east);
  assert.equal(tiles.length, 9);
  assert.ok(tiles.every((tile) => tile.worldX >= meleeCol && tile.worldX <= east));
  const rows = new Set(tiles.map((tile) => tile.mapRow));
  assert.deepEqual([...rows].sort((a, b) => a - b), [arenaRow - 1, arenaRow, arenaRow + 1]);
});

test("clampHellfireEastBound stays on-screen and in spell range", () => {
  const tile = GROUP_DUNGEON_SWARM_TILE_PX;
  const melee = tile * 10;
  const rangeEast = melee + tile * 9;
  const farVisible = melee + tile * 20;
  assert.equal(clampHellfireEastBound(melee, farVisible, rangeEast), rangeEast);
  const shortVisible = melee + tile * 3;
  assert.equal(clampHellfireEastBound(melee, shortVisible, rangeEast), shortVisible);
  assert.equal(clampHellfireEastBound(melee, melee - tile, melee - tile), melee);
});

test("fireWallLaneStripTiles is 3-wide along the lane", () => {
  const tiles = fireWallLaneStripTiles(0, GROUP_DUNGEON_SWARM_TILE_PX * 2, 0, 3);
  assert.equal(tiles.length, 5);
  assert.ok(tiles.some((tile) => tile.worldX === 0 && tile.mapRow === 0));
  assert.ok(tiles.some((tile) => tile.worldX === -GROUP_DUNGEON_SWARM_TILE_PX));
  assert.ok(tiles.some((tile) => tile.worldX === GROUP_DUNGEON_SWARM_TILE_PX * 3));
});

test("split final enemies close the empty centre melee lane", () => {
  const result = swarmPickCenterLaneStep([
    enemy(7, -1),
    enemy(9, 1),
  ], meleeCol, arenaRow);

  assert.deepEqual(result, {
    enemyId: 7,
    toX: meleeCol,
    toMapRow: arenaRow,
    action: "walkSouth",
  });
});

test("a lone side-lane survivor closes the empty centre melee lane", () => {
  assert.deepEqual(swarmPickCenterLaneStep([
    enemy(12, 1),
  ], meleeCol, arenaRow), {
    enemyId: 12,
    toX: meleeCol,
    toMapRow: arenaRow,
    action: "walkNorth",
  });
});

test("split-lane rule only applies to the exact two-survivor formation", () => {
  assert.equal(swarmPickCenterLaneStep([
    enemy(1, -1),
    enemy(2, 0),
    enemy(3, 1),
  ], meleeCol, arenaRow), null);

  assert.equal(swarmPickCenterLaneStep([
    enemy(1, -1),
    enemy(2, 0),
  ], meleeCol, arenaRow), null);
});

test("split-lane rule does not move stationary or distant enemies", () => {
  assert.equal(swarmPickCenterLaneStep([
    enemy(1, -1, { stationaryBoss: true }),
    enemy(2, 1),
  ], meleeCol, arenaRow), null);

  assert.equal(swarmPickCenterLaneStep([
    enemy(1, -1, { worldX: meleeCol + GROUP_DUNGEON_SWARM_TILE_PX }),
    enemy(2, 1),
  ], meleeCol, arenaRow), null);
});

test("every moving group-dungeon swarm monster has directional clips", () => {
  const templateIds = new Set();
  for (const zone of PHASE1_ZONES.filter((entry) => entry.groupDungeon)) {
    if (!zone.groupDungeonBoss && !zone.groupDungeonBossSwarm) {
      for (const id of zone.enemyIds ?? []) templateIds.add(id);
    }
    if (zone.groupDungeonBossSwarm) {
      for (const entry of zone.groupDungeonBossSwarmConfig?.spawnQueue ?? []) {
        templateIds.add(entry.templateId);
      }
      if (zone.groupDungeonBossSwarmConfig?.templateId) {
        templateIds.add(zone.groupDungeonBossSwarmConfig.templateId);
      }
    }
    if (zone.groupDungeonBossReinforcementsConfig?.templateId) {
      templateIds.add(zone.groupDungeonBossReinforcementsConfig.templateId);
    }
  }

  const missing = [];
  for (const templateId of templateIds) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    if (!template || template.stationaryBoss) continue;
    const atlasPath = path.join(root, "public", "monsters", "monster", `${template.monsterIndex}.json`);
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
    for (const action of directionalActions) {
      if (!atlas.actions?.[action]?.frames?.length) {
        missing.push(`${template.name} (${template.monsterIndex}): ${action}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test("HellFire atlas includes Crystal attack EFX (Magic 930)", () => {
  const atlasPath = path.join(root, "public", "spellfx", "HellFire", "atlas.json");
  const sheetPath = path.join(root, "public", "spellfx", "HellFire", "impact.png");
  const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
  assert.equal(atlas.impact?.baseIndex, 930);
  assert.equal(atlas.impact?.frames?.length, 6);
  assert.equal(atlas.impact?.sheet, "impact.png");
  assert.ok(fs.existsSync(sheetPath));
});

test("every group-dungeon boss floor has a respawn timer", () => {
  const bosses = PHASE1_ZONES.filter((zone) => (
    zone.groupDungeon && (zone.groupDungeonBoss || zone.groupDungeonBossSwarm)
  ));
  assert.ok(bosses.length > 0, "expected at least one group-dungeon boss floor");
  for (const zone of bosses) {
    assert.ok(
      Math.trunc(Number(zone.groupDungeonBossRespawnMinutes) || 0) > 0,
      `${zone.id} needs groupDungeonBossRespawnMinutes for the entry roster`,
    );
  }

  const byDungeon = new Map();
  for (const zone of bosses) {
    const list = byDungeon.get(zone.groupDungeon) ?? [];
    list.push(zone.id);
    byDungeon.set(zone.groupDungeon, list);
  }
  for (const [dungeonId, zoneIds] of byDungeon) {
    assert.ok(zoneIds.length >= 1, `${dungeonId} should list bosses for the entry roster`);
  }
});

test("Zuma Taurus attack blend FX sits after bodyWidth (sheetX, not stale slots)", () => {
  const atlasPath = path.join(root, "public", "monsters", "monster", "68.json");
  const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
  const bodyWidth = Number(atlas.bodyWidth) || 0;
  const blendFrames = atlas.actions?.attack1Blend?.frames ?? [];
  assert.ok(bodyWidth > 0, "expected bodyWidth on atlas 68");
  assert.ok(blendFrames.length > 0, "expected attack1Blend on Zuma Taurus");
  for (const frame of blendFrames) {
    if (frame.empty) continue;
    const sheetX = Number(frame.sheetX);
    assert.ok(Number.isFinite(sheetX), "attack1Blend must use sheetX after directional rebuild");
    assert.ok(sheetX >= bodyWidth, `blend frame sheetX ${sheetX} must be at or after bodyWidth ${bodyWidth}`);
  }
});
