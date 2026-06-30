import assert from "node:assert/strict";
import test from "node:test";

import { socialEquipmentEntry } from "../src/core/socialEquipment.js";

test("Social equipment entries preserve empowered stats and spell bonuses", () => {
  const entry = socialEquipmentEntry({
    itemId: "dragon-slayer",
    smithLevel: 3,
    weaponRefineLevel: 2,
    gemCount: 4,
    empowered: true,
    empowerTier: 2,
    bonusStats: { luck: 1 },
    smithBonusStats: { dc: [0, 3] },
    empowerBonusStats: { dc: [1, 4], accuracy: 2 },
    empowerSpellBonuses: {
      FlamingSword: { damagePercent: 12, cooldownReductionSeconds: 1 },
    },
  }, "lb:Warrior:weapon");

  assert.equal(entry.id, "lb:Warrior:weapon");
  assert.equal(entry.empowered, true);
  assert.equal(entry.empowerTier, 2);
  assert.deepEqual(entry.empowerBonusStats.dc, [1, 4]);
  assert.equal(entry.empowerBonusStats.accuracy, 2);
  assert.deepEqual(entry.empowerSpellBonuses.FlamingSword, {
    damagePercent: 12,
    cooldownReductionSeconds: 1,
  });
});

test("Social equipment entries sanitize malformed empowered values", () => {
  const entry = socialEquipmentEntry({
    itemId: "wooden-sword",
    empowered: true,
    empowerTier: -5,
    empowerBonusStats: { dc: ["bad", 2] },
    empowerSpellBonuses: { FireBall: { damagePercent: "bad" } },
  }, "lb:Wizard:weapon");

  assert.equal(entry.empowerTier, 0);
  assert.deepEqual(entry.empowerBonusStats.dc, [0, 2]);
  assert.deepEqual(entry.empowerSpellBonuses, {});
});
