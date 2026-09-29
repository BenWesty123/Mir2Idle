import {
  sanitizeItemBonusStats,
  sanitizeSmithBonusStats,
} from "../battleData.js";
import { sanitizeEmpowerSpellBonuses } from "../core/empoweredItems.js";
import { sanitizeEntryDurability, sanitizeWeaponRefineLevel } from "./sanitizeCharacter.js";
import { sanitizeMysteryCaveBestWave, sanitizeMysteryCaveKills } from "../mysteryCave.js";

const SMITH_RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];
const SMITH_SCALAR_KEYS = [
  "hp", "mp", "accuracy", "agility", "luck", "attackSpeed",
  "poisonAttack", "freezing", "magicResist", "poisonResist",
  "healthRecovery", "poisonRecovery", "strong",
];

const SAVED_ITEM_ID_ALIASES = Object.freeze({
  "mystery-cave-soul": "mystery-cave-ticket",
});

/** @param {unknown} itemId */
export function migrateSavedItemId(itemId) {
  const id = String(itemId ?? "");
  return SAVED_ITEM_ID_ALIASES[id] ?? id;
}

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
 * Clamp a saved stack size. Non-stackables (maxStack <= 1) always become 1 so a
 * corrupted quantity cannot be partially consumed by crafts that take 1/unit.
 * @param {unknown} quantity
 * @param {number} [maxStack=1]
 * @returns {number}
 */
export function sanitizeEntryQuantity(quantity, maxStack = 1) {
  const raw = Math.max(1, Math.trunc(Number(quantity) || 1));
  const cap = Math.max(1, Math.trunc(Number(maxStack) || 1));
  return Math.min(raw, cap);
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
  const mysteryCaveKills = sanitizeMysteryCaveKills(savedEntry?.mysteryCaveKills ?? savedEntry?.mysteryCaveWaves);
  if (mysteryCaveKills > 0) fields.mysteryCaveKills = mysteryCaveKills;
  const mysteryCaveTier = Math.max(0, Math.min(3, Math.trunc(Number(savedEntry?.mysteryCaveTier) || 0)));
  if (mysteryCaveTier > 0) fields.mysteryCaveTier = mysteryCaveTier;
  if (savedEntry?.mysteryCaveBestWave != null && savedEntry?.mysteryCaveBestWave !== "") {
    fields.mysteryCaveBestWave = sanitizeMysteryCaveBestWave(savedEntry.mysteryCaveBestWave, mysteryCaveKills);
  }
  if (savedEntry?.mysteryCaveRandom) fields.mysteryCaveRandom = true;
  const randomSeed = Math.trunc(Number(savedEntry?.mysteryCaveRandomSeed) || 0);
  if (fields.mysteryCaveRandom && randomSeed) fields.mysteryCaveRandomSeed = randomSeed >>> 0;
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
 *   maxStackForEntry?: (savedEntry: object) => number,
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
    maxStackForEntry = null,
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
    const itemId = migrateSavedItemId(savedEntry.itemId);
    const quantity = typeof maxStackForEntry === "function"
      ? sanitizeEntryQuantity(savedEntry.quantity, maxStackForEntry({ ...savedEntry, itemId }))
      : Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1));
    items.push({
      id,
      itemId,
      quantity,
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
 *   maxStackForEntry?: (savedEntry: object) => number,
 * }} config
 */
export function sanitizeStorageState(savedStorage = {}, config) {
  const {
    pageSize,
    baseSlots,
    maxPages,
    normalizeEntryFields = () => ({}),
    maxStackForEntry = null,
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
    const itemId = migrateSavedItemId(savedEntry.itemId);
    const quantity = typeof maxStackForEntry === "function"
      ? sanitizeEntryQuantity(savedEntry.quantity, maxStackForEntry({ ...savedEntry, itemId }))
      : Math.max(1, Math.trunc(Number(savedEntry.quantity) || 1));
    items.push({
      id,
      itemId,
      quantity,
      slot: Number.isInteger(savedEntry.slot) ? savedEntry.slot : null,
      ...normalizeEntryFields(savedEntry),
    });
  }

  // Storage pages are derived from independent unlock flags: the gold page
  // (page2Purchased) and each token page. Any item sitting on a page the
  // account does not own is knocked loose so it cannot be accessed for free.
  const page2Purchased = Boolean(savedStorage.page2Purchased);
  const tokenPageUnlocked = Boolean(savedStorage.tokenPageUnlocked);
  const tokenPage4Unlocked = Boolean(savedStorage.tokenPage4Unlocked);
  const tokenPage5Unlocked = Boolean(savedStorage.tokenPage5Unlocked);
  const pagesUnlocked = Math.min(
    maxPages,
    1
      + (page2Purchased ? 1 : 0)
      + (tokenPageUnlocked ? 1 : 0)
      + (tokenPage4Unlocked ? 1 : 0)
      + (tokenPage5Unlocked ? 1 : 0),
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
    tokenPage4Unlocked,
    tokenPage5Unlocked,
    maxSlots: baseSlots,
    nextInstanceId: Math.max(maxGeneratedId + 1, Math.trunc(Number(savedStorage.nextInstanceId) || 1), 1),
    items,
  };
}

const BONUS_RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];

/**
 * Persist only non-zero bonus keys. Load fills the rest back to 0.
 * @param {object | null | undefined} stats
 * @returns {object | null}
 */
export function compactBonusStatsForPersist(stats) {
  const bonus = sanitizeItemBonusStats(stats);
  const compact = {};
  for (const [key, value] of Object.entries(bonus)) {
    if (BONUS_RANGE_KEYS.includes(key)) {
      const min = Math.trunc(Number(value?.[0]) || 0);
      const max = Math.trunc(Number(value?.[1]) || 0);
      if (min !== 0 || max !== 0) compact[key] = [min, max];
      continue;
    }
    if (value !== 0) compact[key] = value;
  }
  return Object.keys(compact).length ? compact : null;
}

/**
 * Snapshot-only: drop default item fields so full bags fit under the cloud
 * 1.8 MB cap. Do not use this on live inventory — combat expects full objects.
 * When smithLevel > 0, smithBonusStats is always written so load does not
 * treat gem bonusStats as a legacy combined smith blob.
 * @param {object | null | undefined} entry
 */
export function compactInventoryEntryForPersist(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const compacted = {
    id: entry.id,
    itemId: migrateSavedItemId(entry.itemId),
    quantity: Math.max(1, Math.trunc(Number(entry.quantity) || 1)),
  };
  if (Number.isInteger(entry.slot)) compacted.slot = entry.slot;

  const smithLevel = sanitizeSmithLevel(entry);
  const weaponRefineLevel = sanitizeWeaponRefineLevel(entry.weaponRefineLevel);
  const gemCount = Math.max(0, Math.trunc(Number(entry.gemCount) || 0));
  const empowered = Boolean(entry.empowered);
  const empowerTier = Math.max(0, Math.min(4, Math.trunc(Number(entry.empowerTier) || 0)));
  const mark = sanitizeInventoryMark(entry.inventoryMark);
  const bonusStats = compactBonusStatsForPersist(entry.bonusStats);
  const smithBonusStats = compactBonusStatsForPersist(entry.smithBonusStats);
  const empowerBonusStats = compactBonusStatsForPersist(entry.empowerBonusStats);
  const empowerSpellBonuses = sanitizeEmpowerSpellBonuses(entry.empowerSpellBonuses);

  if (smithLevel > 0) compacted.smithLevel = smithLevel;
  if (weaponRefineLevel > 0) compacted.weaponRefineLevel = weaponRefineLevel;
  if (gemCount > 0) compacted.gemCount = gemCount;
  if (empowered) compacted.empowered = true;
  if (empowerTier > 0) compacted.empowerTier = empowerTier;
  if (bonusStats) compacted.bonusStats = bonusStats;
  if (smithLevel > 0) compacted.smithBonusStats = smithBonusStats ?? {};
  else if (smithBonusStats) compacted.smithBonusStats = smithBonusStats;
  if (empowerBonusStats) compacted.empowerBonusStats = empowerBonusStats;
  if (Object.keys(empowerSpellBonuses).length) compacted.empowerSpellBonuses = empowerSpellBonuses;
  if (mark) compacted.inventoryMark = mark;

  const mysteryCaveKills = sanitizeMysteryCaveKills(entry.mysteryCaveKills ?? entry.mysteryCaveWaves);
  if (mysteryCaveKills > 0) compacted.mysteryCaveKills = mysteryCaveKills;
  const mysteryCaveTier = Math.max(0, Math.min(3, Math.trunc(Number(entry.mysteryCaveTier) || 0)));
  if (mysteryCaveTier > 0) compacted.mysteryCaveTier = mysteryCaveTier;
  if (entry.mysteryCaveBestWave != null && entry.mysteryCaveBestWave !== "") {
    compacted.mysteryCaveBestWave = sanitizeMysteryCaveBestWave(entry.mysteryCaveBestWave, mysteryCaveKills);
  }
  if (entry.mysteryCaveRandom) compacted.mysteryCaveRandom = true;
  const randomSeed = Math.trunc(Number(entry.mysteryCaveRandomSeed) || 0);
  if (compacted.mysteryCaveRandom && randomSeed) compacted.mysteryCaveRandomSeed = randomSeed >>> 0;

  const maxDura = Math.trunc(Number(entry.maxDura));
  const currentDura = Math.trunc(Number(entry.currentDura));
  if (Number.isFinite(maxDura) && maxDura > 0) compacted.maxDura = maxDura;
  if (Number.isFinite(currentDura)) compacted.currentDura = currentDura;

  return compacted;
}

/**
 * @param {object | null | undefined} inventory
 */
export function compactInventoryStateForPersist(inventory) {
  if (!inventory || typeof inventory !== "object") return inventory;
  return {
    ...inventory,
    items: Array.isArray(inventory.items)
      ? inventory.items.map((entry) => compactInventoryEntryForPersist(entry))
      : inventory.items,
  };
}

/**
 * Compact bag/storage items on a save snapshot. Live character state is untouched.
 * @param {object | null | undefined} snapshot
 */
export function compactSaveSnapshotForPersist(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const next = { ...snapshot };
  if (next.inventory && typeof next.inventory === "object") {
    next.inventory = compactInventoryStateForPersist(next.inventory);
  }
  if (next.account && typeof next.account === "object") {
    next.account = { ...next.account };
    if (next.account.storage && typeof next.account.storage === "object") {
      next.account.storage = compactInventoryStateForPersist(next.account.storage);
    }
  }
  if (next.characters && typeof next.characters === "object" && !Array.isArray(next.characters)) {
    next.characters = Object.fromEntries(Object.entries(next.characters).map(([classId, character]) => {
      if (!character || typeof character !== "object" || !character.inventory) return [classId, character];
      return [classId, {
        ...character,
        inventory: compactInventoryStateForPersist(character.inventory),
      }];
    }));
  }
  return next;
}
