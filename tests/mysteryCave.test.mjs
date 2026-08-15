import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PHASE1_ENEMY_TEMPLATES, PHASE1_ZONES } from "../src/phase1Data.js";
import {
  MYSTERY_CAVE_BOSS_TEMPLATE_IDS,
  MYSTERY_CAVE_EXCLUDED_STATIONARY_TEMPLATE_IDS,
  MYSTERY_CAVE_SPAWN_INTERVAL_MS,
  MYSTERY_CAVE_ZONE_ID,
  buildMysteryCaveSpawnQueue,
  isMysteryCaveIneligibleBoss,
  isMysteryCaveZone,
} from "../src/mysteryCave.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Mystery Cave roster is unique moving bosses in encounter order", () => {
  assert.equal(new Set(MYSTERY_CAVE_BOSS_TEMPLATE_IDS).size, MYSTERY_CAVE_BOSS_TEMPLATE_IDS.length);
  for (const templateId of MYSTERY_CAVE_BOSS_TEMPLATE_IDS) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    assert.ok(template, `missing template ${templateId}`);
    assert.equal(isMysteryCaveIneligibleBoss(template), false, `${template.name} should walk in the swarm`);
    assert.ok((Number(template.moveMs) || 0) > 0, `${template.name} has no walk speed`);
  }
  for (const templateId of MYSTERY_CAVE_EXCLUDED_STATIONARY_TEMPLATE_IDS) {
    assert.equal(MYSTERY_CAVE_BOSS_TEMPLATE_IDS.includes(templateId), false);
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    assert.ok(template, `missing excluded template ${templateId}`);
    assert.equal(isMysteryCaveIneligibleBoss(template), true, `${template.name} should stay out of Mystery Cave`);
  }
});

test("Mystery Cave spawn queue is every moving boss, one every 10 seconds", () => {
  const queue = buildMysteryCaveSpawnQueue();
  assert.equal(queue.length, MYSTERY_CAVE_BOSS_TEMPLATE_IDS.length);
  assert.equal(MYSTERY_CAVE_SPAWN_INTERVAL_MS, 10_000);
  assert.equal(queue.at(-1).templateId, 472);
  for (let i = 0; i < queue.length; i += 1) {
    assert.equal(queue[i].templateId, MYSTERY_CAVE_BOSS_TEMPLATE_IDS[i]);
    assert.equal(queue[i].spawnDelayMs, i * MYSTERY_CAVE_SPAWN_INTERVAL_MS);
    assert.ok([-1, 0, 1].includes(queue[i].lane));
  }
  assert.equal(new Set(queue.map((entry) => entry.templateId)).size, queue.length);
});

test("Mystery Cave zone is a standalone boss swarm, not a group dungeon", () => {
  const zone = PHASE1_ZONES.find((entry) => entry.id === MYSTERY_CAVE_ZONE_ID);
  assert.ok(zone, "zone-mystery-cave missing from PHASE1_ZONES");
  assert.equal(zone.mysteryCave, true);
  assert.equal(zone.bossSwarm, true);
  assert.equal(zone.groupDungeon, undefined);
  assert.ok(isMysteryCaveZone(zone));
  assert.ok(isMysteryCaveZone(MYSTERY_CAVE_ZONE_ID));
  for (const templateId of MYSTERY_CAVE_BOSS_TEMPLATE_IDS) {
    assert.ok(zone.enemyIds.includes(templateId), `zone enemyIds missing ${templateId}`);
  }
});

test("every Mystery Cave boss has swarm walk/attack fallbacks", () => {
  const required = ["walking", "attack1", "standing"];
  const missing = [];
  for (const templateId of MYSTERY_CAVE_BOSS_TEMPLATE_IDS) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    const atlasPath = path.join(root, "public", "monsters", "monster", `${template.monsterIndex}.json`);
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
    for (const action of required) {
      if (!atlas.actions?.[action]?.frames?.length) {
        missing.push(`${template.name} (${template.monsterIndex}): ${action}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
