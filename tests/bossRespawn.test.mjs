import test from "node:test";
import assert from "node:assert/strict";
import { adjustedBossRespawnMinutes } from "../src/core/bossRespawn.js";

test("adjustedBossRespawnMinutes: 5% per tier up to 50% cap", () => {
  assert.equal(adjustedBossRespawnMinutes(30, 0), 30);
  assert.equal(adjustedBossRespawnMinutes(30, 5), 29);
  assert.equal(adjustedBossRespawnMinutes(30, 50), 15);
  assert.equal(adjustedBossRespawnMinutes(60, 50), 30);
  assert.equal(adjustedBossRespawnMinutes(120, 50), 60);
  assert.equal(adjustedBossRespawnMinutes(30, 60), 15);
});

test("adjustedBossRespawnMinutes: zero base stays zero", () => {
  assert.equal(adjustedBossRespawnMinutes(0, 50), 0);
});
