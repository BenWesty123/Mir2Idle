import test from "node:test";
import assert from "node:assert/strict";
import {
  ADAMANTINE_ORE_ITEM_ID,
  CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID,
  CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST,
  CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID,
  CRAFTING_CUBE_FOCUS_PRISM_REQUIREMENTS_ERROR,
  CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR,
  CRAFTING_CUBE_EMPOWER_SWAP_CRYSTAL_COST,
  CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID,
  CRAFTING_CUBE_EMPOWER_SWAP_REQUIREMENTS_ERROR,
  CRAFTING_CUBE_SALVAGE_ONLY_EMPOWERED_ERROR,
  CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST,
  CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID,
  CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_REQUIREMENTS_ERROR,
  CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_PRISM_COST,
  CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID,
  CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_REQUIREMENTS_ERROR,
  FOCUS_PRISM_ITEM_ID,
  HAVOC_CRYSTAL_ITEM_ID,
  craftingCubeAutofillEntryIds,
  validateCraftingCubeEmpowerReroll,
  validateCraftingCubeEmpowerSwap,
  validateCraftingCubeFocusPrismCraft,
  validateCraftingCubeSalvageEntries,
  validateCraftingCubeTargetedEmpowerReroll,
  validateCraftingCubeTargetedEmpowerSwap,
} from "../src/core/craftingCube.js";

const EMPOWERED_WEAPON = {
  id: "great-axe",
  slot: "weapon",
  type: "weapon",
  requirements: { level: 31 },
  stats: { dc: [0, 35], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
};

const HAVOC_CRYSTAL = { id: HAVOC_CRYSTAL_ITEM_ID, type: "material", slot: "material" };
const ADAMANTINE_ORE = { id: ADAMANTINE_ORE_ITEM_ID, type: "ore", slot: "material" };
const FOCUS_PRISM = { id: FOCUS_PRISM_ITEM_ID, type: "material", slot: "material" };

test("salvage grants one Havoc Crystal per empowerment tier", () => {
  const result = validateCraftingCubeSalvageEntries([
    { empowered: true, empowerTier: 1 },
    { empowered: true, empowerTier: 4 },
    { empowered: true, empowerTier: 2 },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.totalCrystals, 7);
});

test("salvage rejects non-empowered items in the grid", () => {
  const result = validateCraftingCubeSalvageEntries([
    { empowered: true, empowerTier: 2 },
    { empowered: false, empowerTier: 0 },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_SALVAGE_ONLY_EMPOWERED_ERROR);
});

test("salvage rejects empty grid", () => {
  const result = validateCraftingCubeSalvageEntries([]);
  assert.equal(result.ok, false);
  assert.equal(result.error, "Place items in the cube first.");
});

test("empower reroll accepts one empowered item and one havoc crystal", () => {
  const result = validateCraftingCubeEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 2, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 3 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.empoweredEntry?.empowerTier, 2);
  assert.equal(result.crystalEntry?.quantity, 3);
});

test("empower reroll rejects extra items in the cube", () => {
  const result = validateCraftingCubeEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 1 }, item: HAVOC_CRYSTAL },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 1 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, "Place only one Havoc Crystal stack.");
});

test("empower reroll rejects missing ingredients", () => {
  const result = validateCraftingCubeEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR);
});

test("empower reroll rejects adamantine ore (use targeted recipe)", () => {
  const result = validateCraftingCubeEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 1 }, item: HAVOC_CRYSTAL },
    { entry: { itemId: ADAMANTINE_ORE_ITEM_ID }, item: ADAMANTINE_ORE },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, /Adamantine Ore/i);
});

test("targeted empower reroll accepts empowered item, four crystals, and adamantine", () => {
  const result = validateCraftingCubeTargetedEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 2, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 6 }, item: HAVOC_CRYSTAL },
    { entry: { itemId: ADAMANTINE_ORE_ITEM_ID }, item: ADAMANTINE_ORE },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.crystalEntry?.quantity, 6);
  assert.equal(result.adamantineEntry?.itemId, ADAMANTINE_ORE_ITEM_ID);
});

test("targeted empower reroll rejects insufficient havoc crystals", () => {
  const result = validateCraftingCubeTargetedEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 3 }, item: HAVOC_CRYSTAL },
    { entry: { itemId: ADAMANTINE_ORE_ITEM_ID }, item: ADAMANTINE_ORE },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, new RegExp(`${CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST}`));
});

test("targeted empower reroll rejects missing adamantine", () => {
  const result = validateCraftingCubeTargetedEmpowerReroll([
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 4 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_REQUIREMENTS_ERROR);
});

test("autofill picks only havoc crystals for random reroll", () => {
  const empowered = { id: "e-weapon", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 2 };
  const crystals = { id: "e-crystal", itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 7 };
  const resolveItem = (itemId) => {
    if (itemId === EMPOWERED_WEAPON.id) return EMPOWERED_WEAPON;
    if (itemId === HAVOC_CRYSTAL_ITEM_ID) return HAVOC_CRYSTAL;
    if (itemId === ADAMANTINE_ORE_ITEM_ID) return ADAMANTINE_ORE;
    return null;
  };
  const picks = craftingCubeAutofillEntryIds(
    CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID,
    [crystals, empowered],
    resolveItem,
  );
  assert.deepEqual(picks, ["e-crystal"]);
});

test("autofill adds crystals and adamantine for targeted reroll, not empowered items", () => {
  const low = { id: "e-low", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 1 };
  const high = { id: "e-high", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 4 };
  const crystals = { id: "e-crystal", itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 12 };
  const ore = { id: "e-ore", itemId: ADAMANTINE_ORE_ITEM_ID };
  const resolveItem = (itemId) => {
    if (itemId === EMPOWERED_WEAPON.id) return EMPOWERED_WEAPON;
    if (itemId === HAVOC_CRYSTAL_ITEM_ID) return HAVOC_CRYSTAL;
    if (itemId === ADAMANTINE_ORE_ITEM_ID) return ADAMANTINE_ORE;
    return null;
  };
  const picks = craftingCubeAutofillEntryIds(
    CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID,
    [low, crystals, ore, high],
    resolveItem,
  );
  assert.deepEqual(picks, ["e-crystal", "e-ore"]);
});

test("autofill omits adamantine for random reroll", () => {
  const empowered = { id: "e-weapon", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 1 };
  const crystals = { id: "e-crystal", itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 2 };
  const ore = { id: "e-ore", itemId: ADAMANTINE_ORE_ITEM_ID };
  const resolveItem = (itemId) => {
    if (itemId === EMPOWERED_WEAPON.id) return EMPOWERED_WEAPON;
    if (itemId === HAVOC_CRYSTAL_ITEM_ID) return HAVOC_CRYSTAL;
    if (itemId === ADAMANTINE_ORE_ITEM_ID) return ADAMANTINE_ORE;
    return null;
  };
  const picks = craftingCubeAutofillEntryIds(
    CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID,
    [empowered, crystals, ore],
    resolveItem,
  );
  assert.deepEqual(picks, ["e-crystal"]);
});

test("focus prism craft accepts four havoc crystals in one stack", () => {
  const result = validateCraftingCubeFocusPrismCraft([
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 6 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.crystalEntry?.quantity, 6);
});

test("focus prism craft rejects fewer than four havoc crystals", () => {
  const result = validateCraftingCubeFocusPrismCraft([
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 3 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, new RegExp(`${CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST}`));
});

test("focus prism craft rejects extra items in the cube", () => {
  const result = validateCraftingCubeFocusPrismCraft([
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 4 }, item: HAVOC_CRYSTAL },
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id },
      item: EMPOWERED_WEAPON,
    },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_FOCUS_PRISM_REQUIREMENTS_ERROR);
});

test("autofill pulls only havoc crystals for focus prism recipe", () => {
  const empowered = { id: "e-weapon", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 2 };
  const crystals = { id: "e-crystal", itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 9 };
  const resolveItem = (itemId) => {
    if (itemId === EMPOWERED_WEAPON.id) return EMPOWERED_WEAPON;
    if (itemId === HAVOC_CRYSTAL_ITEM_ID) return HAVOC_CRYSTAL;
    return null;
  };
  const picks = craftingCubeAutofillEntryIds(
    CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID,
    [empowered, crystals],
    resolveItem,
  );
  assert.deepEqual(picks, ["e-crystal"]);
});

test("empower swap accepts two empowered items and four havoc crystals", () => {
  const result = validateCraftingCubeEmpowerSwap([
    {
      entry: { id: "a", empowered: true, empowerTier: 2, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 3], mc: [0, 2] } },
      item: EMPOWERED_WEAPON,
    },
    {
      entry: { id: "b", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 5] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 4 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.empoweredEntryA?.id, "a");
  assert.equal(result.empoweredEntryB?.id, "b");
});

test("empower swap rejects one empowered item", () => {
  const result = validateCraftingCubeEmpowerSwap([
    {
      entry: { empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 1] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 4 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_EMPOWER_SWAP_REQUIREMENTS_ERROR);
});

test("empower swap rejects insufficient havoc crystals", () => {
  const result = validateCraftingCubeEmpowerSwap([
    {
      entry: { id: "a", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 1] } },
      item: EMPOWERED_WEAPON,
    },
    {
      entry: { id: "b", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 2] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 3 }, item: HAVOC_CRYSTAL },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, new RegExp(`${CRAFTING_CUBE_EMPOWER_SWAP_CRYSTAL_COST}`));
});

test("autofill pulls only havoc crystals for empower swap", () => {
  const low = { id: "e-low", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 1 };
  const high = { id: "e-high", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 3 };
  const mid = { id: "e-mid", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 2 };
  const crystals = { id: "e-crystal", itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 8 };
  const resolveItem = (itemId) => (itemId === EMPOWERED_WEAPON.id ? EMPOWERED_WEAPON : itemId === HAVOC_CRYSTAL_ITEM_ID ? HAVOC_CRYSTAL : null);
  const picks = craftingCubeAutofillEntryIds(
    CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID,
    [low, mid, high, crystals],
    resolveItem,
  );
  assert.deepEqual(picks, ["e-crystal"]);
});

test("targeted empower swap accepts two empowered items, four focus prisms, and adamantine", () => {
  const result = validateCraftingCubeTargetedEmpowerSwap([
    {
      entry: { id: "a", empowered: true, empowerTier: 2, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 3], mc: [0, 2] } },
      item: EMPOWERED_WEAPON,
    },
    {
      entry: { id: "b", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 5] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: FOCUS_PRISM_ITEM_ID, quantity: 4 }, item: FOCUS_PRISM },
    { entry: { itemId: ADAMANTINE_ORE_ITEM_ID }, item: ADAMANTINE_ORE },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.empoweredEntryA?.id, "a");
  assert.equal(result.empoweredEntryB?.id, "b");
});

test("targeted empower swap rejects havoc crystals instead of focus prisms", () => {
  const result = validateCraftingCubeTargetedEmpowerSwap([
    {
      entry: { id: "a", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 1] } },
      item: EMPOWERED_WEAPON,
    },
    {
      entry: { id: "b", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 2] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: HAVOC_CRYSTAL_ITEM_ID, quantity: 4 }, item: HAVOC_CRYSTAL },
    { entry: { itemId: ADAMANTINE_ORE_ITEM_ID }, item: ADAMANTINE_ORE },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_REQUIREMENTS_ERROR);
});

test("targeted empower swap rejects insufficient focus prisms", () => {
  const result = validateCraftingCubeTargetedEmpowerSwap([
    {
      entry: { id: "a", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 1] } },
      item: EMPOWERED_WEAPON,
    },
    {
      entry: { id: "b", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 2] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: FOCUS_PRISM_ITEM_ID, quantity: 3 }, item: FOCUS_PRISM },
    { entry: { itemId: ADAMANTINE_ORE_ITEM_ID }, item: ADAMANTINE_ORE },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, new RegExp(`${CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_PRISM_COST}`));
});

test("targeted empower swap rejects missing adamantine", () => {
  const result = validateCraftingCubeTargetedEmpowerSwap([
    {
      entry: { id: "a", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 1] } },
      item: EMPOWERED_WEAPON,
    },
    {
      entry: { id: "b", empowered: true, empowerTier: 1, itemId: EMPOWERED_WEAPON.id, empowerBonusStats: { dc: [0, 2] } },
      item: EMPOWERED_WEAPON,
    },
    { entry: { itemId: FOCUS_PRISM_ITEM_ID, quantity: 4 }, item: FOCUS_PRISM },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error, CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_REQUIREMENTS_ERROR);
});

test("autofill pulls focus prisms and adamantine for targeted empower swap", () => {
  const low = { id: "e-low", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 1 };
  const high = { id: "e-high", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 3 };
  const mid = { id: "e-mid", itemId: EMPOWERED_WEAPON.id, empowered: true, empowerTier: 2 };
  const prisms = { id: "e-prism", itemId: FOCUS_PRISM_ITEM_ID, quantity: 8 };
  const ore = { id: "e-ore", itemId: ADAMANTINE_ORE_ITEM_ID };
  const resolveItem = (itemId) => {
    if (itemId === EMPOWERED_WEAPON.id) return EMPOWERED_WEAPON;
    if (itemId === FOCUS_PRISM_ITEM_ID) return FOCUS_PRISM;
    if (itemId === ADAMANTINE_ORE_ITEM_ID) return ADAMANTINE_ORE;
    return null;
  };
  const picks = craftingCubeAutofillEntryIds(
    CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID,
    [low, mid, high, prisms, ore],
    resolveItem,
  );
  assert.deepEqual(picks, ["e-prism", "e-ore"]);
});
