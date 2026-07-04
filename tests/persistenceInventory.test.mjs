import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeItemBonusStats, sanitizeSmithBonusStats } from "../src/battleData.js";
import {
  normalizeInventoryEntryFields,
  sanitizeInventoryMark,
  sanitizeInventoryState,
  sanitizeStorageState,
} from "../src/persistence/sanitizeInventory.js";

const equipmentSlotIds = ["weapon", "armour", "helmet"];
const stackable = (item) => item?.stackable === true;

test("sanitizeInventoryMark: accepts junk and saved only", () => {
  assert.equal(sanitizeInventoryMark("junk"), "junk");
  assert.equal(sanitizeInventoryMark("saved"), "saved");
  assert.equal(sanitizeInventoryMark("neutral"), null);
  assert.equal(sanitizeInventoryMark(null), null);
});

test("normalizeInventoryEntryFields: preserves inventory mark", () => {
  const item = { id: "sword", stackable: false };
  assert.equal(normalizeInventoryEntryFields({ inventoryMark: "junk" }, item, stackable).inventoryMark, "junk");
  assert.equal(normalizeInventoryEntryFields({ inventoryMark: "saved" }, item, stackable).inventoryMark, "saved");
  assert.equal(normalizeInventoryEntryFields({ inventoryMark: "bogus" }, item, stackable).inventoryMark, null);
});

test("normalizeInventoryEntryFields: bonus stats and durability", () => {
  const item = { id: "sword", durability: 100, stackable: false };
  const fields = normalizeInventoryEntryFields(
    { smithLevel: 1.9, weaponRefineLevel: 99, bonusStats: { dc: [1, 2] }, currentDura: 50 },
    item,
    stackable,
  );
  assert.equal(fields.smithLevel, 1);
  assert.equal(fields.weaponRefineLevel, 10);
  assert.deepEqual(fields.bonusStats, sanitizeItemBonusStats({ dc: [1, 1] }));
  assert.deepEqual(fields.smithBonusStats, sanitizeSmithBonusStats({ dc: [0, 1] }));
  assert.equal(fields.currentDura, 50);
});

test("normalizeInventoryEntryFields: legacy refineLevel migrates to smithLevel", () => {
  const item = { id: "sword", stackable: false };
  const fields = normalizeInventoryEntryFields(
    { refineLevel: 3, bonusStats: { dc: [0, 3] } },
    item,
    stackable,
  );
  assert.equal(fields.smithLevel, 3);
  assert.equal(fields.smithBonusStats.dc[1], 3);
});

test("normalizeInventoryEntryFields: legacy smith bonuses migrate from bonusStats", () => {
  const item = { id: "sword", stackable: false };
  const fields = normalizeInventoryEntryFields(
    { smithLevel: 8, bonusStats: { dc: [0, 8] } },
    item,
    stackable,
  );
  assert.equal(fields.smithLevel, 8);
  assert.equal(fields.smithBonusStats.dc[1], 8);
  assert.equal(fields.bonusStats.dc[1], 0);
});

test("normalizeInventoryEntryFields: empty smithBonusStats with smithLevel re-splits legacy bonusStats", () => {
  const item = { id: "mage-staff", slot: "weapon", stackable: false };
  const fields = normalizeInventoryEntryFields(
    { smithLevel: 5, smithBonusStats: {}, bonusStats: { mc: [0, 5] } },
    item,
    stackable,
  );
  assert.equal(fields.smithBonusStats.mc[1], 5);
  assert.equal(fields.bonusStats.mc[1], 0);
});

test("sanitizeInventoryState: dedupes ids and assigns equipment", () => {
  const inventory = sanitizeInventoryState(
    {
      gold: 120,
      pagesUnlocked: 1,
      nextInstanceId: 5,
      items: [
        { id: "item-1", itemId: "wooden-sword", quantity: 1 },
        { id: "item-1", itemId: "duplicate", quantity: 1 },
        { id: "item-2", itemId: "hp-drug-small", quantity: 3, slot: 0 },
      ],
      equipment: { weapon: "item-1", armour: "missing", helmet: "item-1" },
    },
    { slots: ["item-2", "item-1"] },
    {
      equipmentSlotIds,
      pageSize: 40,
      maxSlots: 80,
      maxPages: 2,
      normalizeEntryFields: () => ({}),
    },
  );
  assert.equal(inventory.gold, 120);
  assert.equal(inventory.items.length, 2);
  assert.equal(inventory.equipment.weapon, "item-1");
  assert.equal(inventory.equipment.armour, null);
  assert.equal(inventory.equipment.helmet, null);
  assert.equal(inventory.nextInstanceId, 5);
});

test("sanitizeInventoryState: unlocks page 2 when bag exceeds page size", () => {
  const items = Array.from({ length: 41 }, (_, index) => ({
    id: `item-${index + 1}`,
    itemId: "junk",
    quantity: 1,
    slot: index,
  }));
  const inventory = sanitizeInventoryState(
    { items, pagesUnlocked: 1 },
    { slots: [] },
    {
      equipmentSlotIds,
      pageSize: 40,
      maxSlots: 80,
      maxPages: 2,
      normalizeEntryFields: () => ({}),
    },
  );
  assert.equal(inventory.pagesUnlocked, 2);
  assert.equal(inventory.maxSlots, 80);
});

test("sanitizeInventoryState: gold + token flags both count as usable pages", () => {
  const inventory = sanitizeInventoryState(
    { items: [], pagesUnlocked: 2, goldPageUnlocked: true, tokenPageUnlocked: true },
    { slots: [] },
    { equipmentSlotIds, pageSize: 40, maxSlots: 120, maxPages: 3, normalizeEntryFields: () => ({}) },
  );
  assert.equal(inventory.goldPageUnlocked, true);
  assert.equal(inventory.tokenPageUnlocked, true);
  assert.equal(inventory.pagesUnlocked, 3);
  assert.equal(inventory.maxSlots, 120);
});

test("sanitizeInventoryState: token page alone does not imply the gold page", () => {
  const inventory = sanitizeInventoryState(
    { items: [], pagesUnlocked: 1, tokenPageUnlocked: true },
    { slots: [] },
    { equipmentSlotIds, pageSize: 40, maxSlots: 120, maxPages: 3, normalizeEntryFields: () => ({}) },
  );
  assert.equal(inventory.goldPageUnlocked, false);
  assert.equal(inventory.tokenPageUnlocked, true);
  assert.equal(inventory.pagesUnlocked, 2);
});

test("sanitizeInventoryState: legacy page count migrates to goldPageUnlocked", () => {
  const inventory = sanitizeInventoryState(
    { items: [], pagesUnlocked: 2 },
    { slots: [] },
    { equipmentSlotIds, pageSize: 40, maxSlots: 120, maxPages: 3, normalizeEntryFields: () => ({}) },
  );
  assert.equal(inventory.goldPageUnlocked, true);
  assert.equal(inventory.tokenPageUnlocked, false);
  assert.equal(inventory.pagesUnlocked, 2);
});

test("sanitizeStorageState: gold + token flags open all three pages", () => {
  const storage = sanitizeStorageState(
    { pagesUnlocked: 2, page2Purchased: true, tokenPageUnlocked: true, items: [] },
    { pageSize: 80, baseSlots: 80, maxPages: 3, normalizeEntryFields: () => ({}) },
  );
  assert.equal(storage.pagesUnlocked, 3);
  assert.equal(storage.tokenPageUnlocked, true);
});

test("sanitizeStorageState: reassigns duplicate ids and strips unpurchased page 2 slots", () => {
  const storage = sanitizeStorageState(
    {
      pagesUnlocked: 2,
      page2Purchased: false,
      items: [
        { id: "storage-item-1", itemId: "gold-ore", quantity: 1, slot: 90 },
        { id: "storage-item-1", itemId: "silver-ore", quantity: 1 },
      ],
    },
    {
      pageSize: 80,
      baseSlots: 80,
      maxPages: 2,
      normalizeEntryFields: () => ({}),
    },
  );
  assert.equal(storage.pagesUnlocked, 1);
  assert.equal(storage.items.length, 2);
  assert.notEqual(storage.items[0].id, storage.items[1].id);
  assert.equal(storage.items[0].slot, null);
});
