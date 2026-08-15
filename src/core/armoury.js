/**
 * Armoury kits: per-character equipment presets (slot → entry id).
 * Base 2 kits; a 3rd kit is an account-wide cash-shop unlock.
 */

export const ARMOURY_BASE_KIT_COUNT = 2;
export const ARMOURY_MAX_KIT_COUNT = 3;
export const ARMOURY_KIT_3_UNLOCK_KEY = "armoury-kit-3";
export const ARMOURY_KIT_3_TOKEN_COST = 300;

/** Storage entry ids are account-wide; bag entry ids (`item-N`) are per character. */
export const ARMOURY_ACCOUNT_ENTRY_ID_PREFIX = "storage-item-";

/**
 * Bag entry ids are allocated from a per-character counter, so `item-5` on the
 * Warrior and `item-5` on the Wizard are different objects. Only account-scoped
 * (storage) ids may be rewritten across every character's kits.
 * @param {unknown} entryId
 */
export function isAccountScopedArmouryEntryId(entryId) {
  return typeof entryId === "string" && entryId.startsWith(ARMOURY_ACCOUNT_ENTRY_ID_PREFIX);
}

/**
 * @param {string[]} equipmentSlotIds
 * @param {number} [kitCount]
 */
export function createEmptyArmouryKit(equipmentSlotIds = [], kitCount = ARMOURY_MAX_KIT_COUNT) {
  void kitCount;
  return {
    equipment: Object.fromEntries(equipmentSlotIds.map((slotId) => [slotId, null])),
  };
}

/**
 * @param {string[]} equipmentSlotIds
 */
export function createDefaultArmouryState(equipmentSlotIds = []) {
  return {
    kits: Array.from({ length: ARMOURY_MAX_KIT_COUNT }, () => createEmptyArmouryKit(equipmentSlotIds)),
    activeKitIndex: null,
  };
}

/**
 * @param {unknown} kit
 * @param {string[]} equipmentSlotIds
 */
export function sanitizeArmouryKit(kit, equipmentSlotIds = []) {
  const equipment = Object.fromEntries(equipmentSlotIds.map((slotId) => [slotId, null]));
  if (!kit || typeof kit !== "object") return { equipment };
  const seen = new Set();
  const raw = kit.equipment && typeof kit.equipment === "object" ? kit.equipment : kit;
  for (const slotId of equipmentSlotIds) {
    const entryId = raw?.[slotId];
    if (typeof entryId !== "string" || !entryId || seen.has(entryId)) {
      equipment[slotId] = null;
      continue;
    }
    seen.add(entryId);
    equipment[slotId] = entryId;
  }
  return { equipment };
}

/**
 * @param {unknown} saved
 * @param {string[]} equipmentSlotIds
 */
export function sanitizeArmouryState(saved, equipmentSlotIds = []) {
  const base = createDefaultArmouryState(equipmentSlotIds);
  if (!saved || typeof saved !== "object") return base;
  const rawKits = Array.isArray(saved.kits) ? saved.kits : [];
  base.kits = Array.from({ length: ARMOURY_MAX_KIT_COUNT }, (_, index) => (
    sanitizeArmouryKit(rawKits[index], equipmentSlotIds)
  ));
  const active = Math.trunc(Number(saved.activeKitIndex));
  base.activeKitIndex = Number.isInteger(active) && active >= 0 && active < ARMOURY_MAX_KIT_COUNT
    ? active
    : null;
  return base;
}

/**
 * @param {object} armoury
 * @param {string[]} equipmentSlotIds
 */
export function cloneArmouryState(armoury, equipmentSlotIds = []) {
  return sanitizeArmouryState(armoury, equipmentSlotIds);
}

/**
 * @param {object | null | undefined} kit
 * @param {string[]} equipmentSlotIds
 */
export function armouryKitIsEmpty(kit, equipmentSlotIds = []) {
  if (!kit?.equipment || typeof kit.equipment !== "object") return true;
  return equipmentSlotIds.every((slotId) => !kit.equipment[slotId]);
}

/**
 * @param {Record<string, string | null | undefined>} equipment
 * @param {string[]} equipmentSlotIds
 */
export function snapshotEquipmentToArmouryKit(equipment, equipmentSlotIds = []) {
  const kit = createEmptyArmouryKit(equipmentSlotIds);
  const seen = new Set();
  for (const slotId of equipmentSlotIds) {
    const entryId = equipment?.[slotId];
    if (typeof entryId !== "string" || !entryId || seen.has(entryId)) {
      kit.equipment[slotId] = null;
      continue;
    }
    seen.add(entryId);
    kit.equipment[slotId] = entryId;
  }
  return kit;
}

/**
 * @param {object} armoury
 * @param {string} oldId
 * @param {string} newId
 * @returns {boolean} true if any kit slot changed
 */
export function remappointArmouryEntryId(armoury, oldId, newId) {
  if (!armoury?.kits || typeof oldId !== "string" || !oldId) return false;
  if (typeof newId !== "string" || !newId || oldId === newId) return false;
  let changed = false;
  for (const kit of armoury.kits) {
    if (!kit?.equipment) continue;
    for (const [slotId, entryId] of Object.entries(kit.equipment)) {
      if (entryId !== oldId) continue;
      kit.equipment[slotId] = newId;
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {object} armoury
 * @param {string} entryId
 * @returns {boolean}
 */
export function clearArmouryEntryId(armoury, entryId) {
  if (!armoury?.kits || typeof entryId !== "string" || !entryId) return false;
  let changed = false;
  for (const kit of armoury.kits) {
    if (!kit?.equipment) continue;
    for (const [slotId, id] of Object.entries(kit.equipment)) {
      if (id !== entryId) continue;
      kit.equipment[slotId] = null;
      changed = true;
    }
  }
  return changed;
}

/**
 * Drop kit refs that are not present in the known entry-id set.
 * @param {object} armoury
 * @param {Iterable<string>} knownEntryIds
 * @returns {boolean}
 */
export function pruneArmouryUnknownEntries(armoury, knownEntryIds) {
  const known = knownEntryIds instanceof Set ? knownEntryIds : new Set(knownEntryIds ?? []);
  if (!armoury?.kits) return false;
  let changed = false;
  for (const kit of armoury.kits) {
    if (!kit?.equipment) continue;
    for (const [slotId, entryId] of Object.entries(kit.equipment)) {
      if (!entryId || known.has(entryId)) continue;
      kit.equipment[slotId] = null;
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {boolean} kit3Owned
 */
export function armouryUnlockedKitCount(kit3Owned) {
  return kit3Owned ? ARMOURY_MAX_KIT_COUNT : ARMOURY_BASE_KIT_COUNT;
}
