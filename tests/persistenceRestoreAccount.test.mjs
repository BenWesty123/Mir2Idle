import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  detectUnpaidStoragePage2,
  mergeAccountBossKills,
  mergeAccountBossRespawns,
  resolveSavedGroupDungeonRun,
  restoreAccountFromSnapshot,
  restoreSaveUiMeta,
} from "../src/persistence/restoreAccount.js";
import { sanitizeAccountStats, sanitizeBossKills, sanitizeBossRespawns } from "../src/persistence/sanitizeStats.js";
import { sanitizeStorageState } from "../src/persistence/sanitizeInventory.js";
import { sanitizeAccountUpgradeState } from "../src/persistence/sanitizeUpgrades.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalSave = JSON.parse(readFileSync(join(__dirname, "fixtures/saves/minimal-v1.json"), "utf8"));

const bossZones = new Set(["zone-wooma-temple-kr", "zone-bug-cave-kr"]);
const zoneFilter = (zoneId) => bossZones.has(zoneId);
const characterIds = ["Warrior", "Wizard", "Taoist"];

function accountOptions() {
  return {
    characterIds,
    sanitizeStorage: (storage) => sanitizeStorageState(storage, {
      pageSize: 40,
      baseSlots: 80,
      maxPages: 2,
    }),
    sanitizeUpgrades: (upgrades) => sanitizeAccountUpgradeState(upgrades, []),
    sanitizeBossRespawns: (respawns) => sanitizeBossRespawns(respawns, zoneFilter),
    sanitizeAccountStats: (stats) => sanitizeAccountStats(stats, zoneFilter),
    sanitizeBossKills: (kills) => sanitizeBossKills(kills, zoneFilter),
  };
}

test("detectUnpaidStoragePage2", () => {
  assert.equal(detectUnpaidStoragePage2({ pagesUnlocked: 2, page2Purchased: false }), true);
  assert.equal(detectUnpaidStoragePage2({ pagesUnlocked: 2, page2Purchased: true }), false);
  assert.equal(detectUnpaidStoragePage2({ pagesUnlocked: 1 }), false);
});

test("mergeAccountBossKills: takes max per zone across account + characters", () => {
  const merged = mergeAccountBossKills(
    { "zone-wooma-temple-kr": 1 },
    {
      Warrior: { game: { bossKills: { "zone-wooma-temple-kr": 3, "fake-zone": 9 } } },
      Wizard: { game: { bossKills: { "zone-bug-cave-kr": 2 } } },
    },
    accountOptions(),
  );
  assert.equal(merged["zone-wooma-temple-kr"], 3);
  assert.equal(merged["zone-bug-cave-kr"], 2);
  assert.equal(merged["fake-zone"], undefined);
});

test("mergeAccountBossRespawns: keeps latest timestamp per zone", () => {
  const merged = mergeAccountBossRespawns(
    { "zone-wooma-temple-kr": 100 },
    {
      Warrior: { game: { bossRespawns: { "zone-wooma-temple-kr": 250 } } },
      Wizard: { game: { bossRespawns: { "zone-wooma-temple-kr": 150 } } },
    },
    accountOptions(),
  );
  assert.equal(merged["zone-wooma-temple-kr"], 250);
});

test("restoreAccountFromSnapshot: restores account block from minimal fixture", () => {
  const characters = {
    Warrior: { game: { bossKills: { "zone-wooma-temple-kr": 2 } } },
    Wizard: { game: {} },
    Taoist: { game: {} },
  };
  const { account, hadUnpaidStoragePage2 } = restoreAccountFromSnapshot(minimalSave, characters, accountOptions());
  assert.equal(hadUnpaidStoragePage2, false);
  assert.equal(account.rebirthPoints, 0);
  assert.equal(account.stats.rebirthCount, 1);
  assert.equal(account.stats.bossKills["zone-bug-cave-kr"], 1);
  assert.equal(account.stats.bossKills["zone-wooma-temple-kr"], 2);
  assert.equal(account.storage.pagesUnlocked, 1);
  assert.deepEqual(account.spiritBox, { paid: false, entry: null });
});

test("restoreAccountFromSnapshot: keeps spirit box entry when sanitizer provided", () => {
  const characters = {
    Warrior: { game: {} },
    Wizard: { game: {} },
    Taoist: { game: {} },
  };
  const options = {
    ...accountOptions(),
    sanitizeSpiritBox: (saved) => ({
      paid: Boolean(saved?.paid),
      entry: saved?.entry?.itemId
        ? {
          id: "spirit-box-item",
          itemId: saved.entry.itemId,
          quantity: Math.max(1, Math.trunc(Number(saved.entry.quantity) || 1)),
          slot: null,
        }
        : null,
    }),
  };
  const snapshot = {
    ...minimalSave,
    account: {
      ...minimalSave.account,
      spiritBox: { paid: true, entry: { itemId: "wooma-heart", quantity: 2 } },
    },
  };
  const { account } = restoreAccountFromSnapshot(snapshot, characters, options);
  assert.equal(account.spiritBox.paid, true);
  assert.equal(account.spiritBox.entry.itemId, "wooma-heart");
  assert.equal(account.spiritBox.entry.quantity, 2);
});

test("restoreSaveUiMeta", () => {
  const meta = restoreSaveUiMeta(
    { activeCharacterId: "Wizard", characterTab: "skills", indexes: { hair: 2 } },
    { characterTabIds: ["character", "skills"], normalizeCharacterId: (id) => id ?? "Warrior" },
  );
  assert.equal(meta.activeCharacterId, "Wizard");
  assert.equal(meta.characterTab, "skills");
  assert.equal(meta.hairIndex, 2);
});

test("resolveSavedGroupDungeonRun: prefers character run matching active zone", () => {
  const run = { zoneId: "zone-a", classIds: ["Warrior", "Wizard"] };
  const resolved = resolveSavedGroupDungeonRun(
    {
      characters: {
        Warrior: { game: { groupDungeonRun: run, mode: "zone", activeZoneId: "zone-a" }, battle: { running: true } },
      },
    },
    "zone-a",
    "Warrior",
    {
      characterIds,
      sanitizeGroupDungeonRun: (value) => value,
      groupDungeonWaveSpawnCount: () => 5,
      findZone: () => ({ id: "zone-a" }),
    },
  );
  assert.deepEqual(resolved, run);
});
