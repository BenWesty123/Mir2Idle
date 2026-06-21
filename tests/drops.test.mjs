import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceDropPity,
  buildZoneDropCandidates,
  rollBossTableDropSelection,
  rollChanceTable,
  rollRedThunderZumaDropIds,
  shouldForceDropPity,
  weightedDropCandidate,
} from "../src/core/drops.js";

test("rollBossTableDropSelection: empty table", () => {
  assert.deepEqual(rollBossTableDropSelection(null), { oilCount: 0, itemIds: [] });
});

test("rollBossTableDropSelection: guaranteed pool drop when all rolls miss", () => {
  const rng = () => 1; // always fail individual rolls; fallback index clamps safely
  const table = {
    benedictionOils: 2,
    items: [{ id: "a", chance: 0.5 }, { id: "b", chance: 0.5 }],
  };
  const result = rollBossTableDropSelection(table, rng);
  assert.equal(result.oilCount, 2);
  assert.equal(result.itemIds.length, 1);
  assert.equal(result.itemIds[0], "b");
});

test("rollBossTableDropSelection: collects hits from independent rolls", () => {
  const sequence = [0, 0];
  const rng = () => sequence.shift() ?? 1;
  const table = { items: [{ id: "a", chance: 0.5 }, { id: "b", chance: 0.5 }] };
  const result = rollBossTableDropSelection(table, rng);
  assert.deepEqual(result.itemIds, ["a", "b"]);
});

test("rollChanceTable: independent chance checks", () => {
  const candidates = [{ item: { id: "x" }, chance: 0.5 }, { item: { id: "y" }, chance: 0.5 }];
  const hits = rollChanceTable(candidates, () => 0.1);
  assert.equal(hits.length, 2);
});

test("buildZoneDropCandidates: zone and enemy-specific chances", () => {
  const items = [
    {
      id: "potion",
      drop: { zones: ["zone-a"], chance: 0.01, chances: { "zone-a": 0.02 } },
    },
    {
      id: "sword",
      drop: {
        zones: ["zone-a"],
        chance: 0.01,
        enemyChances: { "42": { "zone-a": 0.08 } },
      },
    },
    { id: "other", drop: { zones: ["zone-b"], chance: 0.5 } },
  ];
  const result = buildZoneDropCandidates(items, "zone-a", 42);
  assert.equal(result.length, 2);
  assert.equal(result.find((entry) => entry.item.id === "potion").chance, 0.02);
  assert.equal(result.find((entry) => entry.item.id === "sword").chance, 0.08);
});

test("advanceDropPity / shouldForceDropPity", () => {
  assert.equal(advanceDropPity(3, true), 0);
  assert.equal(advanceDropPity(3, false), 4);
  assert.equal(shouldForceDropPity(7, 8), false);
  assert.equal(shouldForceDropPity(8, 8), true);
});

test("weightedDropCandidate: respects weights with deterministic rng", () => {
  const candidates = [{ id: "a", chance: 0.1 }, { id: "b", chance: 0.9 }];
  assert.equal(weightedDropCandidate(candidates, () => 0).id, "a");
  assert.equal(weightedDropCandidate(candidates, () => 0.5).id, "b");
});

test("rollRedThunderZumaDropIds: deterministic with seeded rng", () => {
  const config = {
    guaranteedIds: ["a", "b"],
    bonusWeaponIds: ["axe"],
    bonusWeaponChance: 1,
    zumaWeaponIds: ["z1"],
    zumaWeaponChance: 1,
  };
  const sequence = [0, 0];
  const rng = () => sequence.shift() ?? 0;
  assert.deepEqual(rollRedThunderZumaDropIds(config, rng), ["a", "axe", "z1"]);
});
