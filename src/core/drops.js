/**
 * Pure drop-roll selection. Resolves nothing against inventory or item catalogs;
 * the shell maps ids to items and awards them.
 */

/**
 * @param {number} baseChance
 * @param {number} bonusPercentPoints additive percentage points (e.g. 0.5 = +0.5%)
 * @returns {number}
 */
export function adjustedDropChance(baseChance, bonusPercentPoints = 0) {
  const base = Math.max(0, Number(baseChance) || 0);
  const bonus = Math.max(0, Number(bonusPercentPoints) || 0) / 100;
  return Number(Math.min(1, base + bonus).toFixed(5));
}

/**
 * @param {{ item: object, chance: number }[]} candidates
 * @param {number} bonusPercentPoints
 * @returns {{ item: object, chance: number }[]}
 */
export function applyDropChanceBonus(candidates, bonusPercentPoints = 0) {
  const bonus = Math.max(0, Number(bonusPercentPoints) || 0);
  if (!bonus || !candidates?.length) return candidates ?? [];
  return candidates.map((candidate) => ({
    ...candidate,
    chance: adjustedDropChance(candidate.chance, bonus),
  }));
}

/**
 * @param {{ benedictionOils?: number, items?: { id: string, chance: number }[] } | null | undefined} dropTable
 * @param {number} bonusPercentPoints
 * @returns {{ benedictionOils?: number, items?: { id: string, chance: number }[] } | null | undefined}
 */
export function applyDropChanceBonusToBossTable(dropTable, bonusPercentPoints = 0) {
  const bonus = Math.max(0, Number(bonusPercentPoints) || 0);
  if (!dropTable || !bonus) return dropTable;
  const items = Array.isArray(dropTable.items) ? dropTable.items : [];
  if (!items.length) return dropTable;
  return {
    ...dropTable,
    items: items.map((entry) => ({
      ...entry,
      chance: adjustedDropChance(entry.chance, bonus),
    })),
  };
}

/**
 * Multiplies each boss-table item chance (e.g. empowered fights at 2×).
 * @param {{ benedictionOils?: number, items?: { id: string, chance: number }[] } | null | undefined} dropTable
 * @param {number} multiplier
 * @returns {{ benedictionOils?: number, items?: { id: string, chance: number }[] } | null | undefined}
 */
export function scaleBossDropTableChances(dropTable, multiplier = 1) {
  const scale = Number(multiplier) || 1;
  if (!dropTable || scale <= 0 || scale === 1) return dropTable;
  const items = Array.isArray(dropTable.items) ? dropTable.items : [];
  if (!items.length) return dropTable;
  return {
    ...dropTable,
    items: items.map((entry) => ({
      ...entry,
      chance: Number(Math.min(1, Math.max(0, (Number(entry.chance) || 0) * scale)).toFixed(5)),
    })),
  };
}

/**
 * @param {{ items?: { id: string }[] } | null | undefined} dropTable
 * @param {string} itemId
 * @returns {boolean}
 */
export function bossDropTableHasItem(dropTable, itemId) {
  return Array.isArray(dropTable?.items)
    && dropTable.items.some((entry) => entry?.id === itemId);
}

/**
 * Independent bonus roll for an extra boss drop (e.g. Awakening Soul).
 * @param {{ items?: { id: string }[] } | null | undefined} dropTable
 * @param {string} itemId
 * @param {number} bonusChancePercent
 * @param {() => number} [rng]
 * @param {number} [maxChancePercent=100]
 * @returns {boolean}
 */
export function rollBonusBossDropItem(
  dropTable,
  itemId,
  bonusChancePercent,
  rng = Math.random,
  maxChancePercent = 100,
) {
  if (!bossDropTableHasItem(dropTable, itemId)) return false;
  const chance = Math.min(
    Math.max(0, Number(maxChancePercent) || 0) / 100,
    Math.max(0, Number(bonusChancePercent) || 0) / 100,
  );
  if (chance <= 0) return false;
  return rng() < chance;
}

/**
 * @param {{ benedictionOils?: number, items?: { id: string, chance: number }[] } | null | undefined} dropTable
 * @param {() => number} [rng]
 * @returns {{ oilCount: number, itemIds: string[] }}
 */
export function rollBossTableDropSelection(dropTable, rng = Math.random) {
  if (!dropTable) return { oilCount: 0, itemIds: [] };

  const oilCount = Math.max(0, Math.trunc(Number(dropTable.benedictionOils ?? 1)));
  const itemIds = [];
  const items = Array.isArray(dropTable.items) ? dropTable.items : [];

  let poolDropped = false;
  for (const entry of items) {
    if (rng() >= entry.chance) continue;
    itemIds.push(entry.id);
    poolDropped = true;
  }

  if (!poolDropped && items.length) {
    const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
    itemIds.push(items[index].id);
  }

  return { oilCount, itemIds };
}

/**
 * @param {{ item: object, chance: number }[]} candidates
 * @param {() => number} [rng]
 * @returns {{ item: object, chance: number }[]}
 */
export function rollChanceTable(candidates, rng = Math.random) {
  const hits = [];
  for (const candidate of candidates) {
    if (rng() < candidate.chance) hits.push(candidate);
  }
  return hits;
}

/**
 * @param {object[]} items
 * @param {string} zoneId
 * @param {string | number | null | undefined} [enemyId]
 * @returns {{ item: object, chance: number }[]}
 */
export function buildZoneDropCandidates(items, zoneId, enemyId = null) {
  return (items ?? [])
    .filter((item) => item.drop?.zones?.includes(zoneId))
    .map((item) => {
      const zoneChance = item.drop?.chances?.[zoneId];
      const enemyChance = item.drop?.enemyChances?.[String(enemyId ?? "")]?.[zoneId];
      return {
        item,
        chance: Math.max(
          0,
          Math.min(
            1,
            Math.max(Number(zoneChance ?? item.drop?.chance) || 0, Number(enemyChance) || 0),
          ),
        ),
      };
    });
}

/**
 * @param {number} currentPity
 * @param {boolean} receivedDrop
 * @returns {number}
 */
export function advanceDropPity(currentPity, receivedDrop) {
  if (receivedDrop) return 0;
  return Math.max(0, Math.trunc(Number(currentPity) || 0)) + 1;
}

/**
 * @param {number} dryKills
 * @param {number} [maxPity=8]
 * @returns {boolean}
 */
export function shouldForceDropPity(dryKills, maxPity = 8) {
  return Math.max(0, Math.trunc(Number(dryKills) || 0)) >= Math.max(0, Math.trunc(Number(maxPity) || 8));
}

/**
 * @param {{ chance: number }[]} candidates
 * @param {() => number} [rng]
 * @returns {{ chance: number } | null}
 */
export function weightedDropCandidate(candidates, rng = Math.random) {
  if (!candidates?.length) return null;
  const weighted = candidates.filter((candidate) => candidate.chance > 0);
  if (!weighted.length) {
    return candidates[Math.floor(rng() * candidates.length)] ?? null;
  }
  const total = weighted.reduce((sum, candidate) => sum + candidate.chance, 0);
  let roll = rng() * total;
  for (const candidate of weighted) {
    roll -= candidate.chance;
    if (roll <= 0) return candidate;
  }
  return weighted.at(-1) ?? null;
}

/**
 * @param {{
 *   guaranteedIds: string[],
 *   bonusWeaponIds: string[],
 *   bonusWeaponChance: number,
 *   zumaWeaponIds: string[],
 *   zumaWeaponChance: number,
 * }} config
 * @param {() => number} [rng]
 * @returns {string[]}
 */
export function rollRedThunderZumaDropIds(config, rng = Math.random) {
  const itemIds = [];
  const { guaranteedIds, bonusWeaponIds, bonusWeaponChance, zumaWeaponIds, zumaWeaponChance } = config;

  if (guaranteedIds?.length) {
    const index = Math.floor(rng() * guaranteedIds.length);
    itemIds.push(guaranteedIds[index]);
  }

  for (const itemId of bonusWeaponIds ?? []) {
    if (rng() < bonusWeaponChance) itemIds.push(itemId);
  }

  if (zumaWeaponIds?.length && rng() < zumaWeaponChance) {
    const index = Math.floor(rng() * zumaWeaponIds.length);
    itemIds.push(zumaWeaponIds[index]);
  }

  return itemIds;
}
