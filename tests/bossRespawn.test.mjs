import test from "node:test";
import assert from "node:assert/strict";
import { adjustedBossRespawnMinutes, clampBossRespawnReadyAt } from "../src/core/bossRespawn.js";

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

test("clampBossRespawnReadyAt: keeps in-range timestamps", () => {
  const now = 1_700_000_000_000;
  const delay = 30 * 60 * 1000;
  assert.equal(clampBossRespawnReadyAt(now + delay, now, delay), now + delay);
  assert.equal(clampBossRespawnReadyAt(now + 1, now, delay), now + 1);
  assert.equal(clampBossRespawnReadyAt(now - 1, now, delay), now - 1);
});

test("clampBossRespawnReadyAt: clears impossible far-future readyAt (clock skew)", () => {
  const now = 1_700_000_000_000;
  const delay = 8 * 60 * 60 * 1000;
  // ~340 hours ahead — typical after a ~14-day device clock skew on restore.
  assert.equal(clampBossRespawnReadyAt(now + 340 * 60 * 60 * 1000, now, delay), 0);
  assert.equal(clampBossRespawnReadyAt(now + delay + 1, now, delay), 0);
  assert.equal(clampBossRespawnReadyAt(0, now, delay), 0);
  assert.equal(clampBossRespawnReadyAt(now + 60_000, now, 0), 0);
});
