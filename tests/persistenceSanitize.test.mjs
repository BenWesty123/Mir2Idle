import test from "node:test";
import assert from "node:assert/strict";
import {
  DROP_PITY_KILLS,
  sanitizeAccountStats,
  sanitizeBossKills,
  sanitizeBossRespawns,
  sanitizeDropPity,
} from "../src/persistence/sanitizeStats.js";

/** Mimics zoneTracksBossRespawn for known boss zones in characterization tests. */
const bossZones = new Set(["zone-wooma-temple-kr", "zone-bug-cave-kr"]);
const zoneFilter = (zoneId) => bossZones.has(zoneId);
const pityZoneIds = ["zone-bicheon-1", "zone-bicheon-2"];

test("sanitizeBossKills: keeps boss zones and truncates counts", () => {
  const result = sanitizeBossKills(
    { "zone-wooma-temple-kr": 2.9, "fake-zone": 9, ignored: 1 },
    zoneFilter,
  );
  assert.deepEqual(result, { "zone-wooma-temple-kr": 2 });
});

test("sanitizeBossKills: empty or invalid input", () => {
  assert.deepEqual(sanitizeBossKills(null, zoneFilter), {});
  assert.deepEqual(sanitizeBossKills(undefined, zoneFilter), {});
});

test("sanitizeBossRespawns: keeps boss zones and truncates timestamps", () => {
  const result = sanitizeBossRespawns(
    { "zone-wooma-temple-kr": 1710001000000.7, "fake-zone": 1 },
    zoneFilter,
  );
  assert.deepEqual(result, { "zone-wooma-temple-kr": 1710001000000 });
});

test("sanitizeAccountStats: normalizes rebirth counters and nested boss kills", () => {
  const result = sanitizeAccountStats(
    {
      rebirthCount: -1,
      rebirthPointsGained: 5.4,
      rebirthPointsSpent: "2",
      bossKills: { "zone-bug-cave-kr": 1, "ignored-zone": 3 },
    },
    zoneFilter,
  );
  assert.deepEqual(result, {
    rebirthCount: 0,
    rebirthPointsGained: 5,
    rebirthPointsSpent: 2,
    bossKills: { "zone-bug-cave-kr": 1 },
  });
});

test("sanitizeDropPity: clamps per zone and ignores invalid root", () => {
  assert.deepEqual(sanitizeDropPity(null, pityZoneIds), {});
  assert.deepEqual(sanitizeDropPity(undefined, pityZoneIds), {});

  const result = sanitizeDropPity(
    { "zone-bicheon-1": 99, "zone-bicheon-2": -3, "not-a-zone": 4 },
    pityZoneIds,
    DROP_PITY_KILLS,
  );
  assert.deepEqual(result, {
    "zone-bicheon-1": DROP_PITY_KILLS,
    "zone-bicheon-2": 0,
  });
});

test("DROP_PITY_KILLS matches live cap", () => {
  assert.equal(DROP_PITY_KILLS, 8);
});
