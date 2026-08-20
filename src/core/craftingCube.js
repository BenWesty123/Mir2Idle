import { itemCanBeEmpowered, listEmpowerSlotsFromEntry } from "./empoweredItems.js";
import { isGlyphItem } from "../glyphModifiers.js";

export const HAVOC_CRYSTAL_ITEM_ID = "havoc-crystal";
export const ADAMANTINE_ORE_ITEM_ID = "adamantine-ore";
export const FOCUS_PRISM_ITEM_ID = "focus-prism";
export const RUBY_ORE_ITEM_ID = "ruby-ore";
export const EMERALD_ORE_ITEM_ID = "emerald-ore";
export const AMETHYST_ORE_ITEM_ID = "amethyst-ore";
export const GOLD_ORE_ITEM_ID = "gold-ore";
export const COPPER_ORE_ITEM_ID = "copper-ore";
export const SILVER_ORE_ITEM_ID = "silver-ore";
export const OFFENSIVE_ATTUNEMENT_STONE_ITEM_ID = "offensive-attunement-stone";
export const DEFENSIVE_ATTUNEMENT_STONE_ITEM_ID = "defensive-attunement-stone";
export const UTILITY_ATTUNEMENT_STONE_ITEM_ID = "utility-attunement-stone";
export const ATTUNEMENT_STONE_ITEM_IDS = Object.freeze([
  OFFENSIVE_ATTUNEMENT_STONE_ITEM_ID,
  DEFENSIVE_ATTUNEMENT_STONE_ITEM_ID,
  UTILITY_ATTUNEMENT_STONE_ITEM_ID,
]);
export const ATTUNEMENT_STONE_ITEM_ID_SET = new Set(ATTUNEMENT_STONE_ITEM_IDS);
export const ATTUNEMENT_STONE_FAMILY_BY_ITEM_ID = Object.freeze({
  [OFFENSIVE_ATTUNEMENT_STONE_ITEM_ID]: "offensive",
  [DEFENSIVE_ATTUNEMENT_STONE_ITEM_ID]: "defensive",
  [UTILITY_ATTUNEMENT_STONE_ITEM_ID]: "utility",
});
export const ATTUNEMENT_STONE_ORE_BY_ITEM_ID = Object.freeze({
  [OFFENSIVE_ATTUNEMENT_STONE_ITEM_ID]: RUBY_ORE_ITEM_ID,
  [DEFENSIVE_ATTUNEMENT_STONE_ITEM_ID]: EMERALD_ORE_ITEM_ID,
  [UTILITY_ATTUNEMENT_STONE_ITEM_ID]: AMETHYST_ORE_ITEM_ID,
});
export const WOOMA_HEART_ITEM_ID = "wooma-heart";
export const ZUMA_RELIC_ITEM_ID = "zuma-relic";
export const IWT_SOUL_ITEM_ID = "iwt-soul";
export const IZT_SOUL_ITEM_ID = "izt-soul";
export const DD_SOUL_ITEM_ID = "dd-soul";
export const MYSTERY_CAVE_TICKET_ITEM_ID = "mystery-cave-ticket";
export const MYSTERY_CAVE_SOUL_ITEM_ID = MYSTERY_CAVE_TICKET_ITEM_ID;
export const STONE_HEART_ITEM_ID = "stone-heart";
export const HOG_TOOTH_ITEM_ID = "hog-tooth";

export const CRAFTING_CUBE_SALVAGE_ONLY_EMPOWERED_ERROR = "Can only salvage Empowered Items";

export const CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID = "focus-prism";
export const CRAFTING_CUBE_FOCUS_PRISM_LABEL = "Focus Prism";
export const CRAFTING_CUBE_FOCUS_PRISM_CRYSTAL_COST = 4;
export const CRAFTING_CUBE_FOCUS_PRISM_REQUIREMENTS_ERROR = "Place four Havoc Crystals in the cube.";

export const CRAFTING_CUBE_OFFENSIVE_ATTUNEMENT_STONE_RECIPE_ID = "offensive-attunement-stone";
export const CRAFTING_CUBE_DEFENSIVE_ATTUNEMENT_STONE_RECIPE_ID = "defensive-attunement-stone";
export const CRAFTING_CUBE_UTILITY_ATTUNEMENT_STONE_RECIPE_ID = "utility-attunement-stone";
export const CRAFTING_CUBE_ATTUNEMENT_STONE_RECIPES = Object.freeze([
  {
    recipeId: CRAFTING_CUBE_OFFENSIVE_ATTUNEMENT_STONE_RECIPE_ID,
    stoneItemId: OFFENSIVE_ATTUNEMENT_STONE_ITEM_ID,
    oreItemId: RUBY_ORE_ITEM_ID,
    label: "Offensive Attunement Stone",
    oreLabel: "Ruby Ore",
  },
  {
    recipeId: CRAFTING_CUBE_DEFENSIVE_ATTUNEMENT_STONE_RECIPE_ID,
    stoneItemId: DEFENSIVE_ATTUNEMENT_STONE_ITEM_ID,
    oreItemId: EMERALD_ORE_ITEM_ID,
    label: "Defensive Attunement Stone",
    oreLabel: "Emerald Ore",
  },
  {
    recipeId: CRAFTING_CUBE_UTILITY_ATTUNEMENT_STONE_RECIPE_ID,
    stoneItemId: UTILITY_ATTUNEMENT_STONE_ITEM_ID,
    oreItemId: AMETHYST_ORE_ITEM_ID,
    label: "Utility Attunement Stone",
    oreLabel: "Amethyst Ore",
  },
]);
export const CRAFTING_CUBE_ATTUNEMENT_STONE_RECIPE_BY_ID = Object.freeze(
  Object.fromEntries(CRAFTING_CUBE_ATTUNEMENT_STONE_RECIPES.map((row) => [row.recipeId, row])),
);

export const CRAFTING_CUBE_IWT_SOUL_RECIPE_ID = "iwt-soul";
export const CRAFTING_CUBE_IWT_SOUL_LABEL = "IWT Soul";
export const CRAFTING_CUBE_IWT_SOUL_HEART_COST = 2;
export const CRAFTING_CUBE_IWT_SOUL_RELIC_COST = 1;
export const CRAFTING_CUBE_IWT_SOUL_REQUIREMENTS_ERROR =
  "Place two Wooma Hearts and one Zuma Relic in the cube.";

export const CRAFTING_CUBE_IZT_SOUL_RECIPE_ID = "izt-soul";
export const CRAFTING_CUBE_IZT_SOUL_LABEL = "IZT Soul";
export const CRAFTING_CUBE_IZT_SOUL_HEART_COST = 1;
export const CRAFTING_CUBE_IZT_SOUL_RELIC_COST = 2;
export const CRAFTING_CUBE_IZT_SOUL_REQUIREMENTS_ERROR =
  "Place one Wooma Heart and two Zuma Relics in the cube.";

export const CRAFTING_CUBE_DD_SOUL_RECIPE_ID = "dd-soul";
export const CRAFTING_CUBE_DD_SOUL_LABEL = "DD Soul";
export const CRAFTING_CUBE_DD_SOUL_STONE_HEART_COST = 1;
export const CRAFTING_CUBE_DD_SOUL_HOG_TOOTH_COST = 1;
export const CRAFTING_CUBE_DD_SOUL_REQUIREMENTS_ERROR =
  "Place one Stone Heart and one Hog Tooth in the cube.";

export const CRAFTING_CUBE_MYSTERY_CAVE_TICKET_RECIPE_ID = "mystery-cave-ticket";
export const CRAFTING_CUBE_MYSTERY_CAVE_TICKET_LABEL = "Mystery Cave Ticket";
export const CRAFTING_CUBE_MYSTERY_CAVE_TICKET_MATERIALS = Object.freeze([
  { itemId: WOOMA_HEART_ITEM_ID, cost: 1, label: "Wooma Heart" },
  { itemId: ZUMA_RELIC_ITEM_ID, cost: 1, label: "Zuma Relic" },
  { itemId: RUBY_ORE_ITEM_ID, cost: 1, label: "Ruby Ore" },
  { itemId: EMERALD_ORE_ITEM_ID, cost: 1, label: "Emerald Ore" },
  { itemId: AMETHYST_ORE_ITEM_ID, cost: 1, label: "Amethyst Ore" },
  { itemId: ADAMANTINE_ORE_ITEM_ID, cost: 1, label: "Adamantine Ore" },
  { itemId: GOLD_ORE_ITEM_ID, cost: 1, label: "Gold Ore" },
  { itemId: COPPER_ORE_ITEM_ID, cost: 1, label: "Copper Ore" },
  { itemId: SILVER_ORE_ITEM_ID, cost: 1, label: "Silver Ore" },
]);
export const CRAFTING_CUBE_MYSTERY_CAVE_TICKET_REQUIREMENTS_ERROR =
  "Place 1 Wooma Heart, 1 Zuma Relic, and 1 of each ore (Ruby, Emerald, Amethyst, Adamantine, Gold, Copper, Silver).";

export const CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID = "empower-reroll";
export const CRAFTING_CUBE_EMPOWER_REROLL_LABEL = "Random Empowerment Reroll";
// TEMP free random empower reroll — undo after testing (no crystal, no gold).
export const TEMP_FREE_EMPOWER_REROLL = false;
export const CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR = TEMP_FREE_EMPOWER_REROLL
  ? "Place one empowered item."
  : "Place one empowered item and one Havoc Crystal.";
export const CRAFTING_CUBE_EMPOWER_REROLL_OPTIONAL_STONE_HINT =
  "Optional: add one Attunement Stone for a 50% chance to force that family.";

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

export const CRAFTING_CUBE_GLYPH_RECYCLE_RECIPE_ID = "glyph-recycle";
export const CRAFTING_CUBE_GLYPH_RECYCLE_LABEL = "Glyph Recycle";
export const CRAFTING_CUBE_GLYPH_RECYCLE_GLYPH_COST = 2;
export const CRAFTING_CUBE_GLYPH_RECYCLE_REQUIREMENTS_ERROR =
  "Place exactly two glyphs in the cube.";

/** Gold charged (in addition to materials) when a recipe is crafted. */
export const CRAFTING_CUBE_RECIPE_GOLD_COSTS = {
  [CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID]: 25000,
  [CRAFTING_CUBE_OFFENSIVE_ATTUNEMENT_STONE_RECIPE_ID]: 0,
  [CRAFTING_CUBE_DEFENSIVE_ATTUNEMENT_STONE_RECIPE_ID]: 0,
  [CRAFTING_CUBE_UTILITY_ATTUNEMENT_STONE_RECIPE_ID]: 0,
  [CRAFTING_CUBE_IWT_SOUL_RECIPE_ID]: 0,
  [CRAFTING_CUBE_IZT_SOUL_RECIPE_ID]: 0,
  [CRAFTING_CUBE_DD_SOUL_RECIPE_ID]: 0,
  [CRAFTING_CUBE_MYSTERY_CAVE_TICKET_RECIPE_ID]: 0,
  [CRAFTING_CUBE_GLYPH_RECYCLE_RECIPE_ID]: 100000,
  [CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID]: TEMP_FREE_EMPOWER_REROLL ? 0 : 10000,
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
  ...CRAFTING_CUBE_ATTUNEMENT_STONE_RECIPES.map((row) => ({
    id: row.recipeId,
    label: row.label,
    summary: `1 ${row.oreLabel}${goldSummary(row.recipeId)}`,
  })),
  {
    id: CRAFTING_CUBE_IWT_SOUL_RECIPE_ID,
    label: CRAFTING_CUBE_IWT_SOUL_LABEL,
    summary: `${CRAFTING_CUBE_IWT_SOUL_HEART_COST} Wooma Hearts + ${CRAFTING_CUBE_IWT_SOUL_RELIC_COST} Zuma Relic${goldSummary(CRAFTING_CUBE_IWT_SOUL_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_IZT_SOUL_RECIPE_ID,
    label: CRAFTING_CUBE_IZT_SOUL_LABEL,
    summary: `${CRAFTING_CUBE_IZT_SOUL_HEART_COST} Wooma Heart + ${CRAFTING_CUBE_IZT_SOUL_RELIC_COST} Zuma Relics${goldSummary(CRAFTING_CUBE_IZT_SOUL_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_DD_SOUL_RECIPE_ID,
    label: CRAFTING_CUBE_DD_SOUL_LABEL,
    summary: `${CRAFTING_CUBE_DD_SOUL_STONE_HEART_COST} Stone Heart + ${CRAFTING_CUBE_DD_SOUL_HOG_TOOTH_COST} Hog Tooth${goldSummary(CRAFTING_CUBE_DD_SOUL_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_MYSTERY_CAVE_TICKET_RECIPE_ID,
    label: CRAFTING_CUBE_MYSTERY_CAVE_TICKET_LABEL,
    summary: `1 Wooma Heart + 1 Zuma Relic + 1 Ruby, Emerald, Amethyst, Adamantine, Gold, Copper, and Silver Ore${goldSummary(CRAFTING_CUBE_MYSTERY_CAVE_TICKET_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_GLYPH_RECYCLE_RECIPE_ID,
    label: CRAFTING_CUBE_GLYPH_RECYCLE_LABEL,
    summary: `${CRAFTING_CUBE_GLYPH_RECYCLE_GLYPH_COST} Glyphs${goldSummary(CRAFTING_CUBE_GLYPH_RECYCLE_RECIPE_ID)} → random glyph (not the ones used)`,
  },
  {
    id: CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID,
    label: CRAFTING_CUBE_EMPOWER_REROLL_LABEL,
    summary: TEMP_FREE_EMPOWER_REROLL
      ? `1 empowered item (optional Attunement Stone)${goldSummary(CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID)}`
      : `1 empowered item + 1 Havoc Crystal (optional Attunement Stone)${goldSummary(CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID)}`,
  },
  {
    id: CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID,
    label: CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_LABEL,
    summary: `1 empowered item + ${CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_CRYSTAL_COST} Havoc Crystals + 1 Adamantine Ore (optional Attunement Stone)${goldSummary(CRAFTING_CUBE_TARGETED_EMPOWER_REROLL_RECIPE_ID)}`,
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

/** @param {string | null | undefined} itemId */
export function attunementFamilyForStoneItemId(itemId) {
  return ATTUNEMENT_STONE_FAMILY_BY_ITEM_ID[itemId] || null;
}

/** @param {string | null | undefined} itemId */
export function isAttunementStoneItemId(itemId) {
  return ATTUNEMENT_STONE_ITEM_ID_SET.has(itemId);
}

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
 *   attunementStoneEntry?: object,
 *   attunementFamily?: string | null,
 * }}
 */
export function validateCraftingCubeEmpowerReroll(boardEntries) {
  let empoweredEntry = null;
  let empoweredItem = null;
  let crystalEntry = null;
  let attunementStoneEntry = null;
  let attunementFamily = null;

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

    if (isAttunementStoneItemId(item.id)) {
      if (attunementStoneEntry) {
        return { ok: false, error: "Place only one Attunement Stone." };
      }
      attunementStoneEntry = entry;
      attunementFamily = attunementFamilyForStoneItemId(item.id);
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

  if (!empoweredEntry || !empoweredItem || (!TEMP_FREE_EMPOWER_REROLL && !crystalEntry)) {
    return { ok: false, error: CRAFTING_CUBE_EMPOWER_REROLL_REQUIREMENTS_ERROR };
  }

  return {
    ok: true,
    error: null,
    empoweredEntry,
    empoweredItem,
    crystalEntry,
    attunementStoneEntry,
    attunementFamily,
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
 *   attunementStoneEntry?: object,
 *   attunementFamily?: string | null,
 * }}
 */
export function validateCraftingCubeTargetedEmpowerReroll(boardEntries) {
  let empoweredEntry = null;
  let empoweredItem = null;
  let crystalEntry = null;
  let adamantineEntry = null;
  let attunementStoneEntry = null;
  let attunementFamily = null;

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

    if (isAttunementStoneItemId(item.id)) {
      if (attunementStoneEntry) {
        return { ok: false, error: "Place only one Attunement Stone." };
      }
      attunementStoneEntry = entry;
      attunementFamily = attunementFamilyForStoneItemId(item.id);
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
    attunementStoneEntry,
    attunementFamily,
  };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries
 * @param {string} recipeId
 * @returns {{ ok: boolean, error: string | null, oreEntry?: object, recipe?: object }}
 */
export function validateCraftingCubeAttunementStoneCraft(boardEntries, recipeId) {
  const recipe = CRAFTING_CUBE_ATTUNEMENT_STONE_RECIPE_BY_ID[recipeId];
  if (!recipe) {
    return { ok: false, error: "Select an Attunement Stone recipe." };
  }

  let oreEntry = null;
  const requirementsError = `Place one ${recipe.oreLabel} in the cube.`;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === recipe.oreItemId) {
      if (oreEntry) {
        return { ok: false, error: `Place only one ${recipe.oreLabel}.` };
      }
      oreEntry = entry;
      continue;
    }

    return { ok: false, error: requirementsError };
  }

  if (!oreEntry) {
    return { ok: false, error: requirementsError };
  }

  return { ok: true, error: null, oreEntry, recipe };
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
 * @param {{ entry: object, item: object }[]} boardEntries
 * @param {{
 *   itemId: string,
 *   cost: number,
 *   singular: string,
 *   plural: string,
 *   onlyOneStackError: string,
 * }} materialA
 * @param {{
 *   itemId: string,
 *   cost: number,
 *   singular: string,
 *   plural: string,
 *   onlyOneStackError: string,
 * }} materialB
 * @param {string} requirementsError
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   entryA?: object,
 *   entryB?: object,
 * }}
 */
function validateCraftingCubeTwoMaterialCraft(boardEntries, materialA, materialB, requirementsError) {
  let entryA = null;
  let entryB = null;

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (item.id === materialA.itemId) {
      if (entryA) return { ok: false, error: materialA.onlyOneStackError };
      entryA = entry;
      continue;
    }

    if (item.id === materialB.itemId) {
      if (entryB) return { ok: false, error: materialB.onlyOneStackError };
      entryB = entry;
      continue;
    }

    return { ok: false, error: requirementsError };
  }

  if (!entryA || !entryB) {
    return { ok: false, error: requirementsError };
  }

  const qtyA = Math.max(1, Math.trunc(Number(entryA.quantity) || 1));
  if (qtyA < materialA.cost) {
    const label = materialA.cost === 1 ? materialA.singular : materialA.plural;
    return { ok: false, error: `Need at least ${materialA.cost} ${label}.` };
  }

  const qtyB = Math.max(1, Math.trunc(Number(entryB.quantity) || 1));
  if (qtyB < materialB.cost) {
    const label = materialB.cost === 1 ? materialB.singular : materialB.plural;
    return { ok: false, error: `Need at least ${materialB.cost} ${label}.` };
  }

  return { ok: true, error: null, entryA, entryB };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @param {number} heartCost
 * @param {number} relicCost
 * @param {string} requirementsError
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   heartEntry?: object,
 *   relicEntry?: object,
 * }}
 */
function validateCraftingCubeHeartRelicSoulCraft(boardEntries, heartCost, relicCost, requirementsError) {
  const result = validateCraftingCubeTwoMaterialCraft(
    boardEntries,
    {
      itemId: WOOMA_HEART_ITEM_ID,
      cost: heartCost,
      singular: "Wooma Heart",
      plural: "Wooma Hearts",
      onlyOneStackError: "Place only one Wooma Heart stack.",
    },
    {
      itemId: ZUMA_RELIC_ITEM_ID,
      cost: relicCost,
      singular: "Zuma Relic",
      plural: "Zuma Relics",
      onlyOneStackError: "Place only one Zuma Relic stack.",
    },
    requirementsError,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    error: null,
    heartEntry: result.entryA,
    relicEntry: result.entryB,
  };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   heartEntry?: object,
 *   relicEntry?: object,
 * }}
 */
export function validateCraftingCubeIwtSoulCraft(boardEntries) {
  return validateCraftingCubeHeartRelicSoulCraft(
    boardEntries,
    CRAFTING_CUBE_IWT_SOUL_HEART_COST,
    CRAFTING_CUBE_IWT_SOUL_RELIC_COST,
    CRAFTING_CUBE_IWT_SOUL_REQUIREMENTS_ERROR,
  );
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   heartEntry?: object,
 *   relicEntry?: object,
 * }}
 */
export function validateCraftingCubeIztSoulCraft(boardEntries) {
  return validateCraftingCubeHeartRelicSoulCraft(
    boardEntries,
    CRAFTING_CUBE_IZT_SOUL_HEART_COST,
    CRAFTING_CUBE_IZT_SOUL_RELIC_COST,
    CRAFTING_CUBE_IZT_SOUL_REQUIREMENTS_ERROR,
  );
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   stoneHeartEntry?: object,
 *   hogToothEntry?: object,
 * }}
 */
export function validateCraftingCubeDdSoulCraft(boardEntries) {
  const result = validateCraftingCubeTwoMaterialCraft(
    boardEntries,
    {
      itemId: STONE_HEART_ITEM_ID,
      cost: CRAFTING_CUBE_DD_SOUL_STONE_HEART_COST,
      singular: "Stone Heart",
      plural: "Stone Hearts",
      onlyOneStackError: "Place only one Stone Heart stack.",
    },
    {
      itemId: HOG_TOOTH_ITEM_ID,
      cost: CRAFTING_CUBE_DD_SOUL_HOG_TOOTH_COST,
      singular: "Hog Tooth",
      plural: "Hog Teeth",
      onlyOneStackError: "Place only one Hog Tooth stack.",
    },
    CRAFTING_CUBE_DD_SOUL_REQUIREMENTS_ERROR,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    error: null,
    stoneHeartEntry: result.entryA,
    hogToothEntry: result.entryB,
  };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   entriesByItemId?: Record<string, object>,
 * }}
 */
export function validateCraftingCubeMysteryCaveTicketCraft(boardEntries) {
  const byId = new Map();
  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;
    if (byId.has(item.id)) {
      return { ok: false, error: `Place only one ${item.name || item.id} stack.` };
    }
    byId.set(item.id, entry);
  }

  const required = new Set(CRAFTING_CUBE_MYSTERY_CAVE_TICKET_MATERIALS.map((mat) => mat.itemId));
  for (const itemId of byId.keys()) {
    if (!required.has(itemId)) {
      return { ok: false, error: CRAFTING_CUBE_MYSTERY_CAVE_TICKET_REQUIREMENTS_ERROR };
    }
  }

  const entriesByItemId = {};
  for (const mat of CRAFTING_CUBE_MYSTERY_CAVE_TICKET_MATERIALS) {
    const entry = byId.get(mat.itemId);
    if (!entry) return { ok: false, error: CRAFTING_CUBE_MYSTERY_CAVE_TICKET_REQUIREMENTS_ERROR };
    const qty = Math.max(1, Math.trunc(Number(entry.quantity) || 1));
    if (qty < mat.cost) return { ok: false, error: `Need at least ${mat.cost} ${mat.label}.` };
    entriesByItemId[mat.itemId] = entry;
  }
  return { ok: true, error: null, entriesByItemId };
}

/**
 * @param {{ entry: object, item: object }[]} boardEntries Staged cube entries with item defs.
 * @returns {{
 *   ok: boolean,
 *   error: string | null,
 *   glyphEntryA?: object,
 *   glyphItemA?: object,
 *   glyphEntryB?: object,
 *   glyphItemB?: object,
 *   excludeItemIds?: string[],
 * }}
 */
export function validateCraftingCubeGlyphRecycle(boardEntries) {
  const glyphRows = [];

  for (const row of boardEntries) {
    const entry = row?.entry;
    const item = row?.item;
    if (!entry || !item) continue;

    if (isGlyphItem(item)) {
      glyphRows.push(row);
      continue;
    }

    return { ok: false, error: CRAFTING_CUBE_GLYPH_RECYCLE_REQUIREMENTS_ERROR };
  }

  if (glyphRows.length !== CRAFTING_CUBE_GLYPH_RECYCLE_GLYPH_COST) {
    return { ok: false, error: CRAFTING_CUBE_GLYPH_RECYCLE_REQUIREMENTS_ERROR };
  }

  const [rowA, rowB] = [...glyphRows].sort((left, right) => (
    String(left.entry.id).localeCompare(String(right.entry.id))
  ));
  const excludeItemIds = [...new Set(
    [rowA.item?.id, rowB.item?.id].filter(Boolean).map((id) => String(id)),
  )];

  return {
    ok: true,
    error: null,
    glyphEntryA: rowA.entry,
    glyphItemA: rowA.item,
    glyphEntryB: rowB.entry,
    glyphItemB: rowB.item,
    excludeItemIds,
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
  if (recipeId === CRAFTING_CUBE_MYSTERY_CAVE_TICKET_RECIPE_ID || recipeId === "mystery-cave-soul") {
    const byId = new Map();
    for (const entry of inventoryEntries) {
      if (!entry?.id || !entry.itemId) continue;
      if (!resolveItem(entry.itemId)) continue;
      if (!byId.has(entry.itemId)) byId.set(entry.itemId, []);
      byId.get(entry.itemId).push(entry);
    }
    const byQtyThenId = (a, b) => {
      const qtyDelta = Math.max(1, Math.trunc(Number(b.quantity) || 1))
        - Math.max(1, Math.trunc(Number(a.quantity) || 1));
      if (qtyDelta !== 0) return qtyDelta;
      return String(a.id).localeCompare(String(b.id));
    };
    for (const list of byId.values()) list.sort(byQtyThenId);
    const picks = [];
    for (const mat of CRAFTING_CUBE_MYSTERY_CAVE_TICKET_MATERIALS) {
      const hit = byId.get(mat.itemId)?.[0];
      if (hit) picks.push(hit.id);
    }
    return picks;
  }
  const crystalStacks = [];
  const focusPrismStacks = [];
  const adamantineOres = [];
  const attunementOreById = {
    [RUBY_ORE_ITEM_ID]: [],
    [EMERALD_ORE_ITEM_ID]: [],
    [AMETHYST_ORE_ITEM_ID]: [],
  };
  const woomaHeartStacks = [];
  const zumaRelicStacks = [];
  const stoneHeartStacks = [];
  const hogToothStacks = [];
  const glyphEntries = [];

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
      continue;
    }
    if (attunementOreById[item.id]) {
      attunementOreById[item.id].push(entry);
      continue;
    }
    if (item.id === WOOMA_HEART_ITEM_ID) {
      woomaHeartStacks.push(entry);
      continue;
    }
    if (item.id === ZUMA_RELIC_ITEM_ID) {
      zumaRelicStacks.push(entry);
      continue;
    }
    if (item.id === STONE_HEART_ITEM_ID) {
      stoneHeartStacks.push(entry);
      continue;
    }
    if (item.id === HOG_TOOTH_ITEM_ID) {
      hogToothStacks.push(entry);
      continue;
    }
    if (isGlyphItem(item)) {
      glyphEntries.push(entry);
    }
  }

  const byQtyThenId = (a, b) => {
    const qtyDelta = Math.max(1, Math.trunc(Number(b.quantity) || 1))
      - Math.max(1, Math.trunc(Number(a.quantity) || 1));
    if (qtyDelta !== 0) return qtyDelta;
    return String(a.id).localeCompare(String(b.id));
  };

  crystalStacks.sort(byQtyThenId);
  focusPrismStacks.sort(byQtyThenId);
  adamantineOres.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const oreId of Object.keys(attunementOreById)) {
    attunementOreById[oreId].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  woomaHeartStacks.sort(byQtyThenId);
  zumaRelicStacks.sort(byQtyThenId);
  stoneHeartStacks.sort(byQtyThenId);
  hogToothStacks.sort(byQtyThenId);
  glyphEntries.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const attunementRecipe = CRAFTING_CUBE_ATTUNEMENT_STONE_RECIPE_BY_ID[recipeId];
  if (attunementRecipe) {
    const ores = attunementOreById[attunementRecipe.oreItemId] || [];
    return ores[0] ? [ores[0].id] : [];
  }

  if (
    recipeId === CRAFTING_CUBE_FOCUS_PRISM_RECIPE_ID
    || (recipeId === CRAFTING_CUBE_EMPOWER_REROLL_RECIPE_ID && !TEMP_FREE_EMPOWER_REROLL)
    || recipeId === CRAFTING_CUBE_EMPOWER_SWAP_RECIPE_ID
  ) {
    return crystalStacks[0] ? [crystalStacks[0].id] : [];
  }

  if (
    recipeId === CRAFTING_CUBE_IWT_SOUL_RECIPE_ID
    || recipeId === CRAFTING_CUBE_IZT_SOUL_RECIPE_ID
  ) {
    const picks = [];
    if (woomaHeartStacks[0]) picks.push(woomaHeartStacks[0].id);
    if (zumaRelicStacks[0]) picks.push(zumaRelicStacks[0].id);
    return picks;
  }

  if (recipeId === CRAFTING_CUBE_DD_SOUL_RECIPE_ID) {
    const picks = [];
    if (stoneHeartStacks[0]) picks.push(stoneHeartStacks[0].id);
    if (hogToothStacks[0]) picks.push(hogToothStacks[0].id);
    return picks;
  }

  if (recipeId === CRAFTING_CUBE_GLYPH_RECYCLE_RECIPE_ID) {
    return glyphEntries.slice(0, CRAFTING_CUBE_GLYPH_RECYCLE_GLYPH_COST).map((entry) => entry.id);
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
