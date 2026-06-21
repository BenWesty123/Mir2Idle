import test from "node:test";
import assert from "node:assert/strict";
import {
  accountUpgradeMaxTier,
  LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID,
  sanitizeAccountUpgradeState,
} from "../src/persistence/sanitizeUpgrades.js";

const upgradeDefs = [
  { id: "boss-empowerment", maxTier: 1 },
  { id: "xp-bonus", rebirthCosts: [1, 2, 3] },
  { id: "autocast-slots", rebirthCostFn: "linear" },
];

test("accountUpgradeMaxTier", () => {
  assert.equal(accountUpgradeMaxTier({ maxTier: 2 }), 2);
  assert.equal(accountUpgradeMaxTier({ rebirthCosts: [1, 2] }), 2);
  assert.equal(accountUpgradeMaxTier({ rebirthCostFn: "linear" }), Infinity);
  assert.equal(accountUpgradeMaxTier({}), 1);
});

test("sanitizeAccountUpgradeState: merges purchased flags and caps tiers", () => {
  const result = sanitizeAccountUpgradeState(
    {
      purchased: { "boss-empowerment": true },
      tiers: { "xp-bonus": 99, "boss-empowerment": 0 },
    },
    upgradeDefs,
  );
  assert.equal(result.tiers["boss-empowerment"], 1);
  assert.equal(result.tiers["xp-bonus"], 3);
  assert.equal(result.tiers["autocast-slots"], undefined);
});

test("sanitizeAccountUpgradeState: migrates legacy rebirth base stat tier", () => {
  const result = sanitizeAccountUpgradeState(
    { tiers: { [LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID]: 2 } },
    upgradeDefs,
    { rebirthBaseStatUpgradeIds: ["rebirth-stat-dc", "rebirth-stat-mc"] },
  );
  assert.equal(result.tiers["rebirth-stat-dc"], 2);
  assert.equal(result.tiers["rebirth-stat-mc"], 2);
});
