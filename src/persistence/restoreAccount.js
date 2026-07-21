/**
 * Account-level save restore and cross-character boss-data migration.
 */

/**
 * @param {object | null | undefined} savedStorage
 */
export function detectUnpaidStoragePage2(savedStorage) {
  return Math.trunc(Number(savedStorage?.pagesUnlocked) || 1) >= 2
    && !savedStorage?.page2Purchased;
}

/**
 * @param {Record<string, number>} accountBossKills
 * @param {Record<string, object>} characters
 * @param {object} options
 * @param {string[]} options.characterIds
 * @param {(kills: unknown) => Record<string, number>} options.sanitizeBossKills
 */
export function mergeAccountBossKills(accountBossKills, characters, options) {
  const { characterIds, sanitizeBossKills } = options;
  const merged = { ...sanitizeBossKills(accountBossKills ?? {}) };
  for (const classId of characterIds) {
    const kills = sanitizeBossKills(characters[classId]?.game?.bossKills ?? {});
    for (const [zoneId, count] of Object.entries(kills)) {
      merged[zoneId] = Math.max(merged[zoneId] ?? 0, count);
    }
  }
  return merged;
}

/**
 * @param {Record<string, number>} accountBossRespawns
 * @param {Record<string, object>} characters
 * @param {object} options
 * @param {string[]} options.characterIds
 * @param {(respawns: unknown) => Record<string, number>} options.sanitizeBossRespawns
 */
export function mergeAccountBossRespawns(accountBossRespawns, characters, options) {
  const { characterIds, sanitizeBossRespawns } = options;
  const merged = { ...sanitizeBossRespawns(accountBossRespawns ?? {}) };
  for (const classId of characterIds) {
    const respawns = sanitizeBossRespawns(characters[classId]?.game?.bossRespawns ?? {});
    for (const [zoneId, readyAt] of Object.entries(respawns)) {
      if (readyAt > (merged[zoneId] ?? 0)) merged[zoneId] = readyAt;
    }
  }
  return merged;
}

/**
 * Shared account gold. New saves store `account.gold`. Older saves without that
 * field sum every character wallet once so nothing is lost on migrate.
 *
 * @param {object | null | undefined} snapshotAccount
 * @param {Record<string, object>} characters
 * @param {string[]} characterIds
 * @returns {number}
 */
export function resolveAccountGold(snapshotAccount, characters, characterIds) {
  const saved = snapshotAccount && typeof snapshotAccount === "object" ? snapshotAccount : {};
  if (Object.prototype.hasOwnProperty.call(saved, "gold")) {
    return Math.max(0, Math.trunc(Number(saved.gold) || 0));
  }
  let total = 0;
  for (const classId of characterIds ?? []) {
    const character = characters?.[classId];
    total += Math.max(
      0,
      Math.trunc(Number(character?.inventory?.gold ?? character?.game?.progress?.gold) || 0),
    );
  }
  return total;
}

/**
 * @param {object} snapshot
 * @param {Record<string, object>} characters
 * @param {object} options
 * @param {(storage: unknown) => object} options.sanitizeStorage
 * @param {(upgrades: unknown) => object} options.sanitizeUpgrades
 * @param {(respawns: unknown) => Record<string, number>} options.sanitizeBossRespawns
 * @param {(stats: unknown) => object} options.sanitizeAccountStats
 * @param {(codex: unknown) => object} [options.sanitizeCodex]
 * @param {(achievements: unknown) => object} [options.sanitizeAchievements]
 * @param {(ownedUnlocks: unknown) => object} [options.sanitizeOwnedUnlocks]
 * @param {(subscriptions: unknown) => object} [options.sanitizeSubscriptions]
 * @param {(spiritBox: unknown) => object} [options.sanitizeSpiritBox]
 * @param {string[]} options.characterIds
 * @param {(kills: unknown) => Record<string, number>} options.sanitizeBossKills
 */
export function restoreAccountFromSnapshot(snapshot, characters, options) {
  const savedStorageRaw = snapshot.account?.storage ?? snapshot.storage;
  const hadUnpaidStoragePage2 = detectUnpaidStoragePage2(savedStorageRaw);

  const account = {
    storage: options.sanitizeStorage(savedStorageRaw),
    upgrades: options.sanitizeUpgrades(snapshot.account?.upgrades ?? snapshot.upgrades),
    rebirthPoints: Math.max(0, Math.trunc(Number(snapshot.account?.rebirthPoints) || 0)),
    gold: resolveAccountGold(snapshot.account, characters, options.characterIds),
    bossRespawns: mergeAccountBossRespawns(
      options.sanitizeBossRespawns(snapshot.account?.bossRespawns),
      characters,
      options,
    ),
    stats: options.sanitizeAccountStats(snapshot.account?.stats),
    codex: typeof options.sanitizeCodex === "function"
      ? options.sanitizeCodex(snapshot.account?.codex)
      : { items: {} },
    achievements: typeof options.sanitizeAchievements === "function"
      ? options.sanitizeAchievements(snapshot.account?.achievements)
      : { enabled: false, unlocked: {} },
    ownedUnlocks: typeof options.sanitizeOwnedUnlocks === "function"
      ? options.sanitizeOwnedUnlocks(snapshot.account?.ownedUnlocks)
      : {},
    subscriptions: typeof options.sanitizeSubscriptions === "function"
      ? options.sanitizeSubscriptions(snapshot.account?.subscriptions)
      : {},
    spiritBox: typeof options.sanitizeSpiritBox === "function"
      ? options.sanitizeSpiritBox(snapshot.account?.spiritBox)
      : { paid: false, entry: null },
  };

  account.stats = {
    ...account.stats,
    bossKills: mergeAccountBossKills(account.stats.bossKills, characters, options),
  };

  return { account, hadUnpaidStoragePage2 };
}

/**
 * Resolve an in-progress group dungeon run from snapshot + character slots.
 *
 * @param {object} snapshot
 * @param {string | null} activeZoneId
 * @param {string} activeCharacterId
 * @param {object} options
 * @param {string[]} options.characterIds
 * @param {(run: unknown, activeZoneId: string | null, classId: string) => object | null} options.sanitizeGroupDungeonRun
 * @param {(waveNumber: number, zone: object | null | undefined) => number} options.groupDungeonWaveSpawnCount
 * @param {(zoneId: string) => object | null | undefined} options.findZone
 * @param {Record<string, object>} [options.charactersFallback]
 */
export function resolveSavedGroupDungeonRun(snapshot, activeZoneId, activeCharacterId, options) {
  const {
    characterIds,
    sanitizeGroupDungeonRun,
    groupDungeonWaveSpawnCount,
    findZone,
    charactersFallback = {},
  } = options;

  const topLevel = sanitizeGroupDungeonRun(snapshot?.groupDungeonRun, activeZoneId, activeCharacterId);
  if (topLevel?.zoneId === activeZoneId) return topLevel;

  const activeCharacter = snapshot?.characters?.[activeCharacterId];
  const characterRun = sanitizeGroupDungeonRun(
    activeCharacter?.game?.groupDungeonRun,
    activeZoneId,
    activeCharacterId,
  );
  if (characterRun?.zoneId === activeZoneId) return characterRun;

  const chars = snapshot?.characters && typeof snapshot.characters === "object"
    ? snapshot.characters
    : charactersFallback;
  const classIds = characterIds.filter((classId) => {
    const character = chars?.[classId];
    return character?.game?.mode === "zone"
      && character?.game?.activeZoneId === activeZoneId
      && character?.battle?.running !== false;
  });
  if (!classIds.length) return null;

  const zone = findZone(activeZoneId);
  return sanitizeGroupDungeonRun({
    zoneId: activeZoneId,
    leaderClassId: activeCharacterId,
    classIds,
    waveNumber: 1,
    killedThisWave: 0,
    targetThisWave: groupDungeonWaveSpawnCount(1, zone),
    endless: false,
  }, activeZoneId, activeCharacterId);
}

/**
 * @param {object} snapshot
 * @param {object} options
 * @param {string[]} options.characterTabIds
 * @param {(classId: unknown) => string} options.normalizeCharacterId
 */
export function restoreSaveUiMeta(snapshot, options) {
  const { characterTabIds, normalizeCharacterId } = options;
  return {
    activeCharacterId: normalizeCharacterId(snapshot.activeCharacterId ?? snapshot.battle?.combatClass),
    characterTab: characterTabIds.includes(snapshot.characterTab) ? snapshot.characterTab : "character",
    hairIndex: Number.isInteger(snapshot.indexes?.hair) ? snapshot.indexes.hair : 0,
  };
}
