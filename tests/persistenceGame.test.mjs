import test from "node:test";
import assert from "node:assert/strict";
import { crystalExperienceForLevel } from "../src/battleData.js";
import { sanitizeCharacterGameState } from "../src/persistence/sanitizeGame.js";

const zoneIds = ["zone-bicheon-1", "zone-bichon-mine"];

test("sanitizeCharacterGameState: town when zone id is unknown", () => {
  const game = sanitizeCharacterGameState(
    { mode: "zone", activeZoneId: "fake-zone", progress: { level: 2, experience: 5, gold: 100 } },
    { zoneIds, miningZoneId: "zone-bichon-mine", fallbackLevel: 1, fallbackGold: 50 },
  );
  assert.equal(game.mode, "town");
  assert.equal(game.activeZoneId, null);
  assert.equal(game.progress.level, 2);
  assert.equal(game.progress.gold, 100);
});

test("sanitizeCharacterGameState: preserves mining mode for mine zone", () => {
  const game = sanitizeCharacterGameState(
    {
      mode: "mining",
      activeZoneId: "zone-bichon-mine",
      miningSpotId: "spot-a",
      miningNextRollAt: 99,
    },
    {
      zoneIds,
      miningZoneId: "zone-bichon-mine",
      resolveMiningSpotId: (id) => (id === "spot-a" ? "spot-a" : null),
    },
  );
  assert.equal(game.mode, "mining");
  assert.equal(game.activeZoneId, "zone-bichon-mine");
  assert.equal(game.miningSpotId, "spot-a");
  assert.equal(game.miningNextRollAt, 99);
});

test("sanitizeCharacterGameState: clamps counters and recent loot", () => {
  const game = sanitizeCharacterGameState(
    {
      mode: "zone",
      activeZoneId: "zone-bicheon-1",
      kills: -3,
      zoneKills: 4.9,
      recentLoot: ["a", "b", "c", "d", "e", "f", "g"],
    },
    {
      zoneIds,
      sanitizeDropPity: () => ({ "zone-bicheon-1": 2 }),
      sanitizeBossKills: () => ({ "zone-bicheon-1": 1 }),
    },
  );
  assert.equal(game.mode, "zone");
  assert.equal(game.kills, 0);
  assert.equal(game.zoneKills, 4);
  assert.equal(game.recentLoot.length, 6);
  assert.equal(game.dropPity["zone-bicheon-1"], 2);
  assert.equal(game.bossKills["zone-bicheon-1"], 1);
});

test("sanitizeCharacterGameState: normalizes overflow experience on load", () => {
  const need3 = crystalExperienceForLevel(3);
  const need4 = crystalExperienceForLevel(4);
  const game = sanitizeCharacterGameState(
    {
      mode: "town",
      progress: { level: 3, experience: need3 + need4 + 5, gold: 99 },
    },
    { fallbackLevel: 1, fallbackGold: 0 },
  );
  assert.equal(game.progress.level, 5);
  assert.equal(game.progress.experience, 5);
  assert.equal(game.progress.gold, 99);
});
