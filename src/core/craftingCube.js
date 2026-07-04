import { itemCanBeEmpowered, listEmpowerSlotsFromEntry } from "./empoweredItems.js";

export const HAVOC_CRYSTAL_ITEM_ID = "havoc-crystal";
export const ADAMANTINE_ORE_ITEM_ID = "adamantine-ore";
export const FOCUS_PRISM_ITEM_ID = "focus-prism";

export const CRAFTING_CUBE_SALVAGE_ONLY_EMPOWERED_ERROR = "Can only salvage Empowered Items";

export const CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID = "focus-prism";
export const CRAFTING_CUBE_FOCUS_PRISM_LABEL = "Focus Prism";
export const CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST = 4;
export const CRAFTING_CUBE_FOCUS_PRISM_REQUIREMENTS_ERROR = "Place four Havoc Crystals in the cube.";

export const CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID = "empower-reroll";
export const CRAFTING_CUBE_EMPOWER_REROLL_LABEL = "Random Empowerment Reroll";
export const CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR = "Place one empowered item and one Havoc Crystal.";

export const CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID = "empower-reroll-targeted";
export const CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_LABEL = "Targeted Empowerment Reroll";
export const CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST = 4;
export const CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_REQUIREMENTS_ERROR =
  "Place one empowered item, four Havoc Crystals, and one Adamantine Ore.";

export const CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID = "empower-swap";
export const CRAFTING_CUBE_EMPOWER_SWAP_LABEL = "Random Empowerment Swap";
export const CRAFTING_CUBE_EMPOWER_SWAP_CRYSTAL_COST = 4;
export const CRAFTING_CUBE_EMPOWER_SWAP_REQUIREMENTS_ERROR =
  "Place two empowered items and four Havoc Crystals.";

export const CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID = "empower-swap-targeted";
export const CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_LABEL = "Targeted Empowerment Swap";
export const CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_PRISM_COST = 4;
export const CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_REQUIREMENTS_ERROR =
  "Place two empowered items, four Focus Prisms, and one Adamantine Ore.";

/** Gold charged (in addition to materials) when a recipe is crafted. */
export const CRAFTING_CUBE_RECIPE_GOLD_COSTS = {
  [CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID]: 25000,
  [CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID]: 10000,
  [CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID]: 25000,
  [CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID]: 25000,
  [CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID]: 50000,
};

/** @param {string} recipeId */
export function craftingCubeRecipeGoldCost(recipeId) {
  return Math.max(0, Math.trunc(Number(CRAFTING_CUBE_RECIPE_GOLD_COSTS[recipeId]) || 0));
}

function goldSummary(recipeId) {
  const cost = craftingCubeRecipeGoldCost(recipeId);
  return cost > 0 ? ` + ${cost.toLocaleString("en-US")} gold` : "";
}

/** @type {{ id: string, label: string, summary: string }[]} */
export const CRAFTING_CUBE_RECIPES = [
  {
    id: CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID,
    label: CRAFTING_CUBE_FOCUS_PRISM_LABEL,
    summary: `${CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST} Havoc Crystals${goldSummary(CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID,
    label: CRAFTING_CUBE_EMPOWER_REROLL_LABEL,
    summary: `1 empowered item + 1 Havoc Crystal${goldSummary(CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID,
    label: CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_LABEL,
    summary: `1 empowered item + ${CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST} Havoc Crystals + 1 Adamantine Ore${goldSummary(CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID,
    label: CRAFTING_CUBE_EMPOWER_SWAP_LABEL,
    summary: `2 empowered items + ${CRAFTING_CUBE_EMPOWER_SWAP_CRYSTAL_COST} Havoc Crystals${goldSummary(CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID,
    label: CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_LABEL,
    summary: `2 empowered items + ${CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_PRISM_COST} Focus Prisms + 1 Adamantine Ore${goldSummary(CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID)}`,
  },
];

/** @param {object | null | undefined} entry */
export function isEmpoweredSalvageEntry(entry) {
  const tier = Math.max(0, Math.trunc(Number(entry?.empowerTier) || 0));
  return Boolean(entry?.empowered) && tier > 0;
}

/**
 * @param {object[]} entries Non-empty list of inventory entries staged in the cube.
 * @returns {{ ok: boolean, error: string | null, totalCrystals: number }}
 */
export function validateCraftingCubeSalvageEntries(entries) {
  if (!entries.length) {
    return { ok: false, error: "Place items in the cube first.", totalCrystals: 0 };
  }
  for (const entry of entries) {
    if (!isEmpoweredSalvageEntry(entry)) {
      return { ok: false, error: CRAFTING_CUBE_SALVAGE_ONLY_EMPOWERED_ERROR, totalCrystals: 0 };
    }
  }
  const totalCrystals = entries.reduce(
    (sum, entry) => sum + Math.max(0, Math.trunc(Number(entry.empowerTier) || 0)),
    0,
  );
  return { ok: true, error: null, totalCrystals };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   empoweredEntry?: object,
 *   empoweredItem?: object,
 *   crystalEntry?: object,
 * }}
 */
export function validateCraftingCubeEmpowerReroll(boardEntries) {
  let empoweredEntry = null;
  let empoweredItem = null;
  let crystalEntry = null;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === ADAMANTINE_ORE_ITEM_ID) {
      return {
        ok: false,
        error: "Remove Adamantine Ore for random reroll, or use four Havoc Crystals for targeted reroll.",
      };
    }

    if (item.id === HAVOC_CRYSTAL_ITEM_ID) {
      if (crystalEntry) {
        return { ok: false, error: "Place only one Havoc Crystal stack." };
      }
      if (Math.max(1, Math.trunc(Number(entry.quantity) || 1)) < 1) {
        return { ok: false, error: CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR };
      }
      crystalEntry = entry;
      continue;
    }

    if (isEmpoweredSalvageEntry(entry) && itemCanBeEmpowered(item)) {
      if (empoweredEntry) {
        return { ok: false, error: "Place only one empowered item." };
      }
      empoweredEntry = entry;
      empoweredItem = item;
      continue;
    }

    return { ok: false, error: CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR };
  }

  if (!empoweredEntry || !empoweredItem || !crystalEntry) {
    return { ok: false, error: CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR };
  }

  return {
    ok: true,
    error: null,
    empoweredEntry,
    empoweredItem,
    crystalEntry,
  };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   empoweredEntry?: object,
 *   empoweredItem?: object,
 *   crystalEntry?: object,
 *   adamantineEntry?: object,
 * }}
 */
export function validateCraftingCubeTargetedEmpowerReroll(boardEntries) {
  let empoweredEntry = null;
  let empoweredItem = null;
  let crystalEntry = null;
  let adamantineEntry = null;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === HAVOC_CRYSTAL_ITEM_ID) {
      if (crystalEntry) {
        return { ok: false, error: "Place only one Havoc Crystal stack." };
      }
      crystalEntry = entry;
      continue;
    }

    if (item.id === ADAMANTINE_ORE_ITEM_ID) {
      if (adamantineEntry) {
        return { ok: false, error: "Place only one Adamantine Ore." };
      }
      adamantineEntry = entry;
      continue;
    }

    if (isEmpoweredSalvageEntry(entry) && itemCanBeEmpowered(item)) {
      if (empoweredEntry) {
        return { ok: false, error: "Place only one empowered item." };
      }
      empoweredEntry = entry;
      empoweredItem = item;
      continue;
    }

    return { ok: false, error: CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_REQUIREMENTS_ERROR };
  }

  if (!empoweredEntry || !empoweredItem || !crystalEntry || !adamantineEntry) {
    return { ok: false, error: CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_REQUIREMENTS_ERROR };
  }

  const crystalQty = Math.max(1, Math.trunc(Number(crystalEntry.quantity) || 1));
  if (crystalQty < CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST) {
    return {
      ok: false,
      error: `Need at least ${CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST} Havoc Crystals for targeted reroll.`,
    };
  }

  return {
    ok: true,
    error: null,
    empoweredEntry,
    empoweredItem,
    crystalEntry,
    adamantineEntry,
  };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{ ok: boolean, error: string | null, crystalEntry?: object }}
 */
export function validateCraftingCubeFocusPrismCraft(boardEntries) {
  let crystalEntry = null;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === HAVOC_CRYSTAL_ITEM_ID) {
      if (crystalEntry) {
        return { ok: false, error: "Place only one Havoc Crystal stack." };
      }
      crystalEntry = entry;
      continue;
    }

    return { ok: false, error: CRAFTING_CUBE_FOCUS_PRISM_REQUIREMENTS_ERROR };
  }

  if (!crystalEntry) {
    return { ok: false, error: CRAFTING_CUBE_FOCUS_PRISM_REQUIREMENTS_ERROR };
  }

  const crystalQty = Math.max(1, Math.trunc(Number(crystalEntry.quantity) || 1));
  if (crystalQty < CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST) {
    return {
      ok: false,
      error: `Need at least ${CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST} Havoc Crystals.`,
    };
  }

  return { ok: true, error: null, crystalEntry };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   empoweredEntryA?: object,
 *   empoweredItemA?: object,
 *   empoweredEntryB?: object,
 *   empoweredItemB?: object,
 *   crystalEntry?: object,
 * }}
 */
export function validateCraftingCubeEmpowerSwap(boardEntries) {
  const empoweredRows = [];
  let crystalEntry = null;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === HAVOC_CRYSTAL_ITEM_ID) {
      if (crystalEntry) {
        return { ok: false, error: "Place only one Havoc Crystal stack." };
      }
      crystalEntry = entry;
      continue;
    }

    if (isEmpoweredSalvageEntry(entry) && itemCanBeEmpowered(item)) {
      empoweredRows.push(row);
      continue;
    }

    return { ok: false, error: CRAFTING_CUBE_EMPOWER_SWAP_REQUIREMENTS_ERROR };
  }

  if (empoweredRows.length !== 2 || !crystalEntry) {
    return { ok: false, error: CRAFTING_CUBE_EMPOWER_SWAP_REQUIREMENTS_ERROR };
  }

  const crystalQty = Math.max(1, Math.trunc(Number(crystalEntry.quantity) || 1));
  if (crystalQty < CRAFTING_CUBE_EMPOWER_SWAP_CRYSTAL_COST) {
    return {
      ok: false,
      error: `Need at least ${CRAFTING_CUBE_EMPOWER_SWAP_CRYSTAL_COST} Havoc Crystals.`,
    };
  }

  const [rowA, rowB] = [...empoweredRows].sort((left, right) => (
    String(left.entry.id).localeCompare(String(right.entry.id))
  ));
  if (!listEmpowerSlotsFromEntry(rowA.entry).length || !listEmpowerSlotsFromEntry(rowB.entry).length) {
    return { ok: false, error: "Both items need at least one empowerment to swap." };
  }

  return {
    ok: true,
    error: null,
    empoweredEntryA: rowA.entry,
    empoweredItemA: rowA.item,
    empoweredEntryB: rowB.entry,
    empoweredItemB: rowB.item,
    crystalEntry,
  };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   empoweredEntryA?: object,
 *   empoweredItemA?: object,
 *   empoweredEntryB?: object,
 *   empoweredItemB?: object,
 *   focusPrismEntry?: object,
 *   adamantineEntry?: object,
 * }}
 */
export function validateCraftingCubeTargetedEmpowerSwap(boardEntries) {
  const empoweredRows = [];
  let focusPrismEntry = null;
  let adamantineEntry = null;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === FOCUS_PRISM_ITEM_ID) {
      if (focusPrismEntry) {
        return { ok: false, error: "Place only one Focus Prism stack." };
      }
      focusPrismEntry = entry;
      continue;
    }

    if (item.id === ADAMANTINE_ORE_ITEM_ID) {
      if (adamantineEntry) {
        return { ok: false, error: "Place only one Adamantine Ore." };
      }
      adamantineEntry = entry;
      continue;
    }

    if (isEmpoweredSalvageEntry(entry) && itemCanBeEmpowered(item)) {
      empoweredRows.push(row);
      continue;
    }

    return { ok: false, error: CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_REQUIREMENTS_ERROR };
  }

  if (empoweredRows.length !== 2 || !focusPrismEntry || !adamantineEntry) {
    return { ok: false, error: CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_REQUIREMENTS_ERROR };
  }

  const prismQty = Math.max(1, Math.trunc(Number(focusPrismEntry.quantity) || 1));
  if (prismQty < CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_PRISM_COST) {
    return {
      ok: false,
      error: `Need at least ${CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_PRISM_COST} Focus Prisms.`,
    };
  }

  const [rowA, rowB] = [...empoweredRows].sort((left, right) => (
    String(left.entry.id).localeCompare(String(right.entry.id))
  ));
  if (!listEmpowerSlotsFromEntry(rowA.entry).length || !listEmpowerSlotsFromEntry(rowB.entry).length) {
    return { ok: false, error: "Both items need at least one empowerment to swap." };
  }

  return {
    ok: true,
    error: null,
    empoweredEntryA: rowA.entry,
    empoweredItemA: rowA.item,
    empoweredEntryB: rowB.entry,
    empoweredItemB: rowB.item,
    focusPrismEntry,
    adamantineEntry,
  };
}

/**
 * Pick inventory entry ids to stage for a crafting-cube recipe autofill.
 * Only materials are autofilled — empowered items must be placed by the player.
 * @param {string} recipeId
 * @param {object[]} inventoryEntries Bag entries (not equipped / hotbar).
 * @param {(itemId: string) => object | null | undefined} resolveItem
 * @returns {string[]}
 */
export function craftingCubeAutofillEntryIds(recipeId, inventoryEntries, resolveItem) {
  const crystalStacks = [];
  const focusPrismStacks = [];
  const adamantineOres = [];

  for (const entry of inventoryEntries) {
    if (!entry?.id || !entry.itemId) continue;
    const item = resolveItem(entry.itemId);
    if (!item) continue;

    if (item.id === HAVOC_CRYSTAL_ITEM_ID) {
      crystalStacks.push(entry);
      continue;
    }
    if (item.id === FOCUS_PRISM_ITEM_ID) {
      focusPrismStacks.push(entry);
      continue;
    }
    if (item.id === ADAMANTINE_ORE_ITEM_ID) {
      adamantineOres.push(entry);
    }
  }

  crystalStacks.sort((a, b) => {
    const qtyDelta = Math.max(1, Math.trunc(Number(b.quantity) || 1))
      - Math.max(1, Math.trunc(Number(a.quantity) || 1));
    if (qtyDelta !== 0) return qtyDelta;
    return String(a.id).localeCompare(String(b.id));
  });
  focusPrismStacks.sort((a, b) => {
    const qtyDelta = Math.max(1, Math.trunc(Number(b.quantity) || 1))
      - Math.max(1, Math.trunc(Number(a.quantity) || 1));
    if (qtyDelta !== 0) return qtyDelta;
    return String(a.id).localeCompare(String(b.id));
  });
  adamantineOres.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  if (
    recipeId === CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID
    || recipeId === CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID
    || recipeId === CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID
  ) {
    return crystalStacks[0] ? [crystalStacks[0].id] : [];
  }

  if (recipeId === CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID) {
    const picks = [];
    if (crystalStacks[0]) picks.push(crystalStacks[0].id);
    if (adamantineOres[0]) picks.push(adamantineOres[0].id);
    return picks;
  }

  if (recipeId === CRAFTING_CUBE_TARGETED_EMPOWER_SWAP_RECIPE_ID) {
    const picks = [];
    if (focusPrismStacks[0]) picks.push(focusPrismStacks[0].id);
    if (adamantineOres[0]) picks.push(adamantineOres[0].id);
    return picks;
  }

  return [];
}
