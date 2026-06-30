import { sanitizeItemBonusStats, sanitizeSmithBonusStats } from "../battleData.js";
import { sanitizeEmpowerSpellBonuses } from "./empoweredItems.js";

function nonNegativeInt(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function socialEquipmentEntry(raw, entryId) {
  if (!raw?.itemId || !entryId) return null;
  return {
    id: entryId,
    itemId: raw.itemId,
    quantity: 1,
    smithLevel: nonNegativeInt(raw.smithLevel),
    weaponRefineLevel: nonNegativeInt(raw.weaponRefineLevel),
    gemCount: nonNegativeInt(raw.gemCount),
    empowered: Boolean(raw.empowered),
    empowerTier: nonNegativeInt(raw.empowerTier),
    bonusStats: sanitizeItemBonusStats(raw.bonusStats),
    smithBonusStats: sanitizeSmithBonusStats(raw.smithBonusStats),
    empowerBonusStats: sanitizeItemBonusStats(raw.empowerBonusStats),
    empowerSpellBonuses: sanitizeEmpowerSpellBonuses(raw.empowerSpellBonuses),
  };
}
