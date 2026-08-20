import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARMOURY_BASE_KIT_COUNT,
  ARMOURY_KIT_3_TOKEN_COST,
  ARMOURY_KIT_3_UNLOCK_KEY,
  ARMOURY_MAX_KIT_COUNT,
  armouryKitIsEmpty,
  armouryUnlockedKitCount,
  clearArmouryEntryId,
  createDefaultArmouryState,
  isAccountScopedArmouryEntryId,
  pruneArmouryUnknownEntries,
  remappointArmouryEntryId,
  sanitizeArmouryState,
  snapshotEquipmentToArmouryKit,
} from "../src/core/armoury.js";

const SLOTS = ["weapon", "armour", "helmet", "ringL", "ringR"];

describe("armoury", () => {
  it("exposes kit-3 cash shop constants", () => {
    assert.equal(ARMOURY_KIT_3_UNLOCK_KEY, "armoury-kit-3");
    assert.equal(ARMOURY_KIT_3_TOKEN_COST, 300);
    assert.equal(ARMOURY_BASE_KIT_COUNT, 2);
    assert.equal(ARMOURY_MAX_KIT_COUNT, 3);
    assert.equal(armouryUnlockedKitCount(false), 2);
    assert.equal(armouryUnlockedKitCount(true), 3);
  });

  it("defaults to three empty kit slots", () => {
    const armoury = createDefaultArmouryState(SLOTS);
    assert.equal(armoury.kits.length, 3);
    assert.equal(armoury.activeKitIndex, null);
    assert.ok(armouryKitIsEmpty(armoury.kits[0], SLOTS));
  });

  it("sanitizes kits, drops duplicate entry ids, and clamps active index", () => {
    const sanitized = sanitizeArmouryState({
      activeKitIndex: 99,
      kits: [
        { equipment: { weapon: "a", armour: "a", helmet: "b" } },
        { weapon: "c" },
      ],
    }, SLOTS);
    assert.equal(sanitized.activeKitIndex, null);
    assert.equal(sanitized.kits[0].equipment.weapon, "a");
    assert.equal(sanitized.kits[0].equipment.armour, null);
    assert.equal(sanitized.kits[0].equipment.helmet, "b");
    assert.equal(sanitized.kits[1].equipment.weapon, "c");
    assert.ok(armouryKitIsEmpty(sanitized.kits[2], SLOTS));
  });

  it("snapshots current equipment into a kit", () => {
    const kit = snapshotEquipmentToArmouryKit({
      weapon: "w1",
      armour: "a1",
      helmet: null,
      ringL: "w1",
      ringR: "r1",
    }, SLOTS);
    assert.equal(kit.equipment.weapon, "w1");
    assert.equal(kit.equipment.armour, "a1");
    assert.equal(kit.equipment.ringL, null);
    assert.equal(kit.equipment.ringR, "r1");
    assert.equal(armouryKitIsEmpty(kit, SLOTS), false);
  });

  it("repoints and clears entry ids across kits", () => {
    const armoury = sanitizeArmouryState({
      kits: [
        { equipment: { weapon: "old", armour: "keep" } },
        { equipment: { weapon: "old" } },
      ],
    }, SLOTS);
    assert.equal(remappointArmouryEntryId(armoury, "old", "new"), true);
    assert.equal(armoury.kits[0].equipment.weapon, "new");
    assert.equal(armoury.kits[1].equipment.weapon, "new");
    assert.equal(armoury.kits[0].equipment.armour, "keep");
    assert.equal(clearArmouryEntryId(armoury, "new"), true);
    assert.equal(armoury.kits[0].equipment.weapon, null);
    assert.equal(armoury.kits[1].equipment.weapon, null);
    assert.equal(armoury.kits[0].equipment.armour, "keep");
  });

  it("treats only storage ids as account-wide", () => {
    // Bag ids come from a per-character counter, so `item-5` means a different
    // object on each character and must never be rewritten account-wide.
    assert.equal(isAccountScopedArmouryEntryId("storage-item-4"), true);
    assert.equal(isAccountScopedArmouryEntryId("item-4"), false);
    assert.equal(isAccountScopedArmouryEntryId("guest-4"), false);
    assert.equal(isAccountScopedArmouryEntryId("spirit-box-item"), false);
    assert.equal(isAccountScopedArmouryEntryId(null), false);
  });

  it("prunes unknown entry ids", () => {
    const armoury = sanitizeArmouryState({
      kits: [{ equipment: { weapon: "alive", armour: "gone" } }],
    }, SLOTS);
    assert.equal(pruneArmouryUnknownEntries(armoury, ["alive"]), true);
    assert.equal(armoury.kits[0].equipment.weapon, "alive");
    assert.equal(armoury.kits[0].equipment.armour, null);
  });
});
