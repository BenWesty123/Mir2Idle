import { sanitizeStatBuffs } from "../buffPotions.js";

export const WEAPON_REFINE_MAX = 10;
export const MAGIC_SPELL_MAX_LEVEL = 3;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * @param {number} value
 * @returns {number}
 */
export function sanitizeWeaponRefineLevel(value) {
  return Math.max(0, Math.min(WEAPON_REFINE_MAX, Math.trunc(Number(value) || 0)));
}

/**
 * @param {object | null | undefined} item
 * @returns {number}
 */
export function itemDefinitionMaxDura(item) {
  return Math.max(0, Math.trunc(Number(item?.durability) || 0));
}

/**
 * @param {object | null | undefined} item
 * @param {(item: object) => boolean} isStackable
 * @returns {boolean}
 */
export function itemUsesEntryDurability(item, isStackable) {
  if (!item || isStackable(item)) return false;
  return itemDefinitionMaxDura(item) > 0;
}

/**
 * @param {object | null | undefined} savedEntry
 * @param {object | null | undefined} item
 * @param {(item: object) => boolean} isStackable
 * @returns {{ maxDura: number, currentDura: number } | null}
 */
export function sanitizeEntryDurability(savedEntry, item, isStackable) {
  if (!itemUsesEntryDurability(item, isStackable)) return null;
  const maxDura = Math.max(1, Math.trunc(Number(savedEntry?.maxDura) || itemDefinitionMaxDura(item)));
  let currentDura = Math.trunc(Number(savedEntry?.currentDura));
  if (!Number.isFinite(currentDura)) currentDura = maxDura;
  currentDura = Math.max(0, Math.min(maxDura, currentDura));
  return { maxDura, currentDura };
}

/**
 * @param {object | null | undefined} savedHotbar
 * @param {Iterable<string>} availableEntryIds
 * @param {Iterable<string>} equippedIds
 * @param {number} slotCount
 */
export function sanitizeHotbarState(savedHotbar, availableEntryIds, equippedIds, slotCount) {
  const available = new Set(availableEntryIds);
  const equipped = new Set(equippedIds);
  return {
    slots: Array.from({ length: slotCount }, (_, slot) => {
      const entryId = savedHotbar?.slots?.[slot] ?? null;
      return available.has(entryId) && !equipped.has(entryId) ? entryId : null;
    }),
  };
}

/**
 * @param {object | null | undefined} savedMagic
 * @param {(spellId: string) => boolean} isValidSpellId
 * @param {number} [maxLevel=MAGIC_SPELL_MAX_LEVEL]
 */
export function sanitizeMagicState(savedMagic, isValidSpellId, maxLevel = MAGIC_SPELL_MAX_LEVEL) {
  const learned = savedMagic?.learned ?? {};
  const cap = Math.max(0, Math.trunc(Number(maxLevel) || MAGIC_SPELL_MAX_LEVEL));
  return {
    learned: Object.fromEntries(
      Object.entries(learned)
        .filter(([spellId]) => isValidSpellId(spellId))
        .map(([spellId, savedSpell]) => [
          spellId,
          {
            spellId,
            level: Math.max(0, Math.min(cap, Math.trunc(Number(savedSpell.level) || 0))),
            experience: Math.max(0, Math.trunc(Number(savedSpell.experience) || 0)),
            key: savedSpell.key ?? null,
            autoCast: Boolean(savedSpell.autoCast),
            castReadyAt: 0,
            learnedAt: Number(savedSpell.learnedAt) || 0,
          },
        ]),
    ),
  };
}

/**
 * @param {object | null | undefined} savedBattle
 */
export function sanitizeCharacterBattleState(savedBattle = {}) {
  return {
    running: savedBattle?.running !== false,
    paused: savedBattle?.paused === true,
    playerHp: finiteNumberOrNull(savedBattle?.playerHp),
    playerMp: finiteNumberOrNull(savedBattle?.playerMp),
    potHealthAmount: Math.max(0, Math.trunc(Number(savedBattle?.potHealthAmount) || 0)),
    potManaAmount: Math.max(0, Math.trunc(Number(savedBattle?.potManaAmount) || 0)),
    healAmount: Math.max(0, Math.trunc(Number(savedBattle?.healAmount) || 0)),
    vampAmount: Math.max(0, Math.trunc(Number(savedBattle?.vampAmount) || 0)),
    statBuffs: sanitizeStatBuffs(savedBattle?.statBuffs),
    petStatBuffs: sanitizeStatBuffs(savedBattle?.petStatBuffs),
  };
}

/**
 * @param {string} classId
 * @param {object} magic
 * @param {object} [options]
 * @param {string} [options.wizardClassId]
 * @param {Iterable<string>} [options.retiredSpellIds]
 */
export function removeRetiredTestingDefaultMagic(classId, magic, options = {}) {
  const wizardClassId = options.wizardClassId ?? "Wizard";
  const retiredSpellIds = options.retiredSpellIds ?? [];
  if (classId !== wizardClassId) return magic;
  if (!magic.learned || typeof magic.learned !== "object") magic.learned = {};
  for (const spellId of retiredSpellIds) {
    const learned = magic.learned[spellId];
    if (learned && !learned.learnedAt) delete magic.learned[spellId];
  }
  return magic;
}
