import test from "node:test";
import assert from "node:assert/strict";
import {
  BUFF_POTION_DURATION_MS,
  buffPotionDefForItem,
  isBuffPotionItem,
  sanitizeStatBuffs,
  pruneStatBuffs,
  applyStatBuffsToStats,
  formatBuffRemaining,
  statBuffBonusLabel,
} from "../src/buffPotions.js";

test("buff duration is five minutes", () => {
  assert.equal(BUFF_POTION_DURATION_MS, 5 * 60 * 1000);
});

test("buffPotionDefForItem / isBuffPotionItem", () => {
  const def = buffPotionDefForItem({ id: "impact-drug-s" });
  assert.equal(def.kind, "impact");
  assert.equal(def.stat, "dc");
  assert.equal(buffPotionDefForItem({ id: "not-a-potion" }), null);
  assert.equal(buffPotionDefForItem(null), null);
  assert.equal(isBuffPotionItem({ id: "magic-drug-m" }), true);
  assert.equal(isBuffPotionItem({ id: "sword" }), false);
});

test("applyStatBuffsToStats adds bonuses to [min,max] stat pairs only", () => {
  const stats = { dc: [1, 2], mc: 5 };
  applyStatBuffsToStats(stats, [{ stat: "dc", minBonus: 1, maxBonus: 3 }]);
  assert.deepEqual(stats.dc, [2, 5]);
  assert.equal(stats.mc, 5); // non-array stat is left untouched
  // tolerant of missing args
  assert.doesNotThrow(() => applyStatBuffsToStats(null, []));
  assert.doesNotThrow(() => applyStatBuffsToStats(stats, null));
});

test("pruneStatBuffs drops expired buffs relative to now", () => {
  const now = 1000;
  const buffs = [
    { stat: "dc", expiresAt: 2000 },
    { stat: "mc", expiresAt: 500 },
    { stat: "sc", expiresAt: 1000 }, // exactly now -> expired
  ];
  const kept = pruneStatBuffs(buffs, now);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].stat, "dc");
});

test("sanitizeStatBuffs keeps valid future buffs and rebuilds damageReduction", () => {
  const now = 1000;
  const cleaned = sanitizeStatBuffs(
    [
      { kind: "impact", stat: "dc", minBonus: 1, maxBonus: 3, expiresAt: 5000 },
      { kind: "old", stat: "dc", minBonus: 1, maxBonus: 1, expiresAt: 100 }, // expired
      { kind: "bogus", stat: "notastat", expiresAt: 5000 }, // invalid stat
      { kind: "guard", stat: "damageReduction", reductionPercent: 30, expiresAt: 5000 },
    ],
    now,
  );
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].stat, "dc");
  assert.equal(cleaned[1].stat, "damageReduction");
  assert.equal(cleaned[1].reductionPercent, 30);
  assert.deepEqual(sanitizeStatBuffs("not-an-array", now), []);
});

test("formatBuffRemaining", () => {
  assert.equal(formatBuffRemaining(65000), "1m 5s");
  assert.equal(formatBuffRemaining(5000), "5s");
  assert.equal(formatBuffRemaining(0), "0s");
  assert.equal(formatBuffRemaining(-100), "0s");
});

test("statBuffBonusLabel", () => {
  assert.equal(statBuffBonusLabel({ stat: "dc", minBonus: 0, maxBonus: 5 }), "+5 DC");
  assert.equal(statBuffBonusLabel({ stat: "amc", minBonus: 0, maxBonus: 3 }), "+3 MAC");
  assert.equal(statBuffBonusLabel({ stat: "attackSpeed", minBonus: 4, maxBonus: 4 }), "+4 AS");
  assert.equal(statBuffBonusLabel({ stat: "dc", minBonus: 2, maxBonus: 5 }), "+2-5 DC");
  assert.equal(statBuffBonusLabel({ stat: "damageReduction", reductionPercent: 30 }), "30% DR");
});

test("sanitizeStatBuffs keeps Fury attack-speed buffs", () => {
  const now = 1_000_000;
  const buffs = sanitizeStatBuffs([{
    kind: "fury",
    label: "Fury",
    stat: "attackSpeed",
    minBonus: 4,
    maxBonus: 4,
    expiresAt: now + 60_000,
  }], now);
  assert.equal(buffs.length, 1);
  assert.equal(buffs[0].stat, "attackSpeed");
  assert.equal(buffs[0].minBonus, 4);
});

test("sanitizeStatBuffs keeps Immortal Skin max-DC penalty", () => {
  const now = 1_000_000;
  const buffs = sanitizeStatBuffs([{
    kind: "immortalSkin",
    label: "Immortal Skin",
    stat: "dc",
    minBonus: 0,
    maxBonus: -8,
    expiresAt: now + 60_000,
  }], now);
  assert.equal(buffs.length, 1);
  assert.equal(buffs[0].maxBonus, -8);
  assert.equal(statBuffBonusLabel(buffs[0]), "-8 DC");
});
