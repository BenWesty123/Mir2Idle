import {
  sanitizeItemBonusStats,
  sanitizeSmithBonusStats,
} from "../battleData.js";
import { sanitizeEmpowerSpellBonuses } from "../core/empoweredItems.js";
import { sanitizeEntryDurability, sanitizeWeaponRefineLevel } from "./sanitizeCharacter.js";

const SMITH_RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];
const SMITH_SCALAR_KEYS = [
  "hp", "mp", "accuracy", "agility", "luck", "attackSpeed",
  "poisonAttack", "freezing", "magicResist", "poisonResist",
  "healthRecovery", "poisonRecovery", "strong",
];

/** @param {unknown} mark */
export function sanitizeInventoryMark(mark) {
  if (mark === "junk" || mark === "saved") return mark;
  return null;
}

/**
 * Successful smith-combine count. Accepts legacy `refineLevel` from old saves.
 * @param {object | null | undefined} savedEntry
 */
export function sanitizeSmithLevel(savedEntry) {
  const raw = savedEntry?.smithLevel ?? savedEntry?.refineLevel;
  return Math.max(0, Math.trunc(Number(raw) || 0));
}

/**
 * @param {object | null | undefined} stats
 */
function smithBonusStatScore(stats) {
  const smith = sanitizeSmithBonusStats(stats);
  let total = 0;
  for (const key of SMITH_RANGE_KEYS) {
    total += Math.abs(smith[key][0]) + Math.abs(smith[key][1]);
  }
  for (const key of SMITH_SCALAR_KEYS) {
    total += Math.abs(smith[key]);
  }
  return total;
}

/**
 * @param {object} bonus
 * @param {number} smithLevel
 */
function splitLegacySmithBonusStats(bonus, smithLevel) {
  const smith = sanitizeSmithBonusStats({});
  const remaining = sanitizeItemBonusStats(bonus);

  for (const key of SMITH_RANGE_KEYS) {
    const smithPart = Math.min(remaining[key][1], smithLevel);
    smith[key][1] = smithPart;
    remaining[key][1] -= smithPart;
  }
  for (const key of SMITH_SCALAR_KEYS) {
    const smithPart = Math.min(remaining[key], smithLevel);
    smith[key] = smithPart;
    remaining[key] -= smithPart;
  }

  return { bonusStats: remaining, smithBonusStats: smith };
}

/**
 * Split legacy combined bonusStats into gem/orb bonuses vs smith-combine bonuses.
 * @param {object | null | undefined} savedEntry
 */
function migrateSmithBonusFields(savedEntry) {
  const bonus = sanitizeItemBonusStats(savedEntry?.bonusStats);
  const smithLevel = sanitizeSmithLevel(savedEntry);

  if (smithLevel === 0) {
    return {
      bonusStats: bonus,
      smithBonusStats: sanitizeSmithBonusStats(savedEntry?.smithBonusStats),
    };
  }

  if (savedEntry?.smithBonusStats != null) {
    const smithBonusStats = sanitizeSmithBonusStats(savedEntry.smithBonusStats);
    if (smithBonusStatScore(smithBonusStats) === 0) {
      return splitLegacySmithBonusStats(bonus, smithLevel);
    }
    return { bonusStats: bonus, smithBonusStats };
  }

  return splitLegacySmithBonusStats(bonus, smithLevel);
}

/**
 * @param {object | null | undefined} savedEntry
 * @param {object | null | undefined} item
 * @param {(item: object) => boolean} isStackable
 */
export function normalizeInventoryEntryFields(savedEntry, item, isStackable) {
  const { bonusStats, smithBonusStats } = migrateSmithBonusFields(savedEntry);
  const fields = {
    smithLevel: sanitizeSmithLevel(savedEntry),
    weaponRefineLevel: sanitizeWeaponRefineLevel(savedEntry?.weaponRefineLevel),
    gemCount: Math.max(0, Math.trunc(Number(savedEntry?.gemCount) || 0)),
    empowered: Boolean(savedEntry?.empowered),
    empowerTier: Math.max(0, Math.min(4, Math.trunc(Number(savedEntry?.empowerTier) || 0))),
    bonusStats,
    smithBonusStats,
    empowerBonusStats: sanitizeItemBonusStats(savedEntry?.empowerBonusStats),
    empowerSpellBonuses: sanitizeEmpowerSpellBonuses(savedEntry?.empowerSpellBonuses),
    inventoryMark: sanitizeInventoryMark(savedEntry?.inventoryMark),
  };
  const dura = sanitizeEntryDurability(savedEntry, item, isStackable);
  if (dura) {
    fields.maxDura = dura.maxDura;
    fields.currentDura = dura.currentDura;
  }
  return fields;
}

/**
 * @param {object | null | undefined} savedInventory
 * @param {object | null | undefined} savedHotbar
 * @param {{
 *   fallbackGold?: number,
 *   equipmentSlotIds: string[],
 *   pageSize: number,
 *   maxSlots: number,
 *   maxPages: number,
 *   normalizeEntryFields?: (savedEntry: object) => object,
 * }} config
 */
export function sanitizeInventoryState(savedInventory = {}, savedHotbar = {}, config) {
  const {
    fallbackGold = 0,
    equipmentSlotIds,
    pageSize,
    maxSlots,
    maxPages,
    normalizeEntryFields = () => ({}),
  } = config;

  const usedIds = new Set();
  let maxGeneratedId = 0;
  const items = [];

  for (const savedEntry of Array.isArray(savedInventory.items) ? savedInventory.items : []) {
    if (!savedEntry?.itemId) continue;
    const id = typeof savedEntry.id === "string" && savedEntry.id ? savedEntry.id : "";
    if (!id || usedIds.has(id)) continue;
    usedIds.add(id);
    const generatedId = /^item-(\d+)$/.exec(id)?.[1];
    if (generatedId) maxGeneratedId = Math.max(maxGeneratedId, Number(generatedId));
    items.push({
      id,
      itemId: savedEntry.itemId,
      quantity: Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1)),
      slot: Number.isInteger(savedEntry.slot) ? savedEntry.slot : null,
      ...normalizeEntryFields(savedEntry),
    });
  }

  const savedEquippedIds = new Set(Object.values(savedInventory.equipment ?? {}).filter(Boolean));
  const savedHotbarIds = new Set((savedHotbar?.slots ?? []).filter(Boolean));
  const savedBagItems = items.filter((entry) => !savedEquippedIds.has(entry.id) && !savedHotbarIds.has(entry.id));
  const needsSecondPage = savedBagItems.length > pageSize
    || savedBagItems.some((entry) => Number.isInteger(entry.slot) && entry.slot >= pageSize);
  // The gold page and the 250-token page are independent unlock flags. Legacy
  // saves only stored a page count, so migrate that into goldPageUnlocked.
  const tokenPageUnlocked = Boolean(savedInventory.tokenPageUnlocked);
  const goldPageUnlocked = (typeof savedInventory.goldPageUnlocked === "boolean"
    ? savedInventory.goldPageUnlocked
    : Math.max(1, Math.trunc(Number(savedInventory.pagesUnlocked) || 1)) >= 2)
    || needsSecondPage;
  const pagesUnlocked = Math.min(
    maxPages,
    1 + (goldPageUnlocked ? 1 : 0) + (tokenPageUnlocked ? 1 : 0),
  );
  const inventory = {
    gold: Math.max(0, Math.trunc(Number(savedInventory.gold ?? fallbackGold) || 0)),
    pagesUnlocked,
    goldPageUnlocked,
    tokenPageUnlocked,
    maxSlots: Math.min(maxSlots, pagesUnlocked * pageSize),
    nextInstanceId: Math.max(maxGeneratedId + 1, Math.trunc(Number(savedInventory.nextInstanceId) || 1), 1),
    items,
    equipment: Object.fromEntries(equipmentSlotIds.map((slotId) => [slotId, null])),
  };

  const availableEntryIds = new Set(items.map((entry) => entry.id));
  const equippedIds = new Set();
  for (const slotId of equipmentSlotIds) {
    const entryId = savedInventory.equipment?.[slotId] ?? null;
    if (!availableEntryIds.has(entryId) || equippedIds.has(entryId)) continue;
    inventory.equipment[slotId] = entryId;
    equippedIds.add(entryId);
  }
  return inventory;
}

/**
 * @param {object | null | undefined} savedStorage
 * @param {{
 *   pageSize: number,
 *   baseSlots: number,
 *   maxPages: number,
 *   normalizeEntryFields?: (savedEntry: object) => object,
 * }} config
 */
export function sanitizeStorageState(savedStorage = {}, config) {
  const {
    pageSize,
    baseSlots,
    maxPages,
    normalizeEntryFields = () => ({}),
  } = config;

  const usedIds = new Set();
  let maxGeneratedId = 0;
  const items = [];

  for (const savedEntry of Array.isArray(savedStorage.items) ? savedStorage.items : []) {
    if (!savedEntry?.itemId) continue;
    let id = typeof savedEntry.id === "string" && savedEntry.id ? savedEntry.id : "";
    if (!id || usedIds.has(id)) {
      maxGeneratedId += 1;
      id = `storage-item-${maxGeneratedId}`;
    }
    usedIds.add(id);
    const generatedId = /^storage-item-(\d+)$/.exec(id)?.[1];
    if (generatedId) maxGeneratedId = Math.max(maxGeneratedId, Number(generatedId));
    items.push({
      id,
      itemId: savedEntry.itemId,
      quantity: Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1)),
      slot: Number.isInteger(savedEntry.slot) ? savedEntry.slot : null,
      ...normalizeEntryFields(savedEntry),
    });
  }

  // Storage pages are derived from two independent unlock flags: the gold page
  // (page2Purchased) and the 250-token page. Any item sitting on a page the
  // account does not own is knocked loose so it cannot be accessed for free.
  const page2Purchased = Boolean(savedStorage.page2Purchased);
  const tokenPageUnlocked = Boolean(savedStorage.tokenPageUnlocked);
  const pagesUnlocked = Math.min(
    maxPages,
    1 + (page2Purchased ? 1 : 0) + (tokenPageUnlocked ? 1 : 0),
  );
  const usableSlots = pagesUnlocked * pageSize;
  for (const entry of items) {
    if (Number.isInteger(entry.slot) && entry.slot >= usableSlots) {
      entry.slot = null;
    }
  }

  return {
    pagesUnlocked,
    page2Purchased,
    tokenPageUnlocked,
    maxSlots: baseSlots,
    nextInstanceId: Math.max(maxGeneratedId + 1, Math.trunc(Number(savedStorage.nextInstanceId) || 1), 1),
    items,
  };
}
