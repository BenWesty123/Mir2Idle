import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GROUP_DUNGEON_SWARM_TILE_PX,
  swarmLaneMapRow,
  swarmPickCenterLaneStep,
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
