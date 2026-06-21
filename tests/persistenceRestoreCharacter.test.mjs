import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  backfillStarterGear,
  restoreCharacterSnapshot,
  restoreCharactersFromSnapshot,
} from "../src/persistence/restoreCharacter.js";
import { sanitizeCharacterGameState } from "../src/persistence/sanitizeGame.js";
import {
  removeRetiredTestingDefaultMagic,
  sanitizeCharacterBattleState,
  sanitizeHotbarState,
  sanitizeMagicState,
} from "../src/persistence/sanitizeCharacter.js";
import { sanitizeInventoryState } from "../src/persistence/sanitizeInventory.js";
import { sanitizeBossKills, sanitizeBossRespawns, sanitizeDropPity } from "../src/persistence/sanitizeStats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalSave = JSON.parse(readFileSync(join(__dirname, "fixtures/saves/minimal-v1.json"), "utf8"));

const zoneIds = ["zone-bicheon-1", "zone-bichon-mine", "zone-wooma-temple-kr", "zone-bug-cave-kr"];
const equipmentSlotIds = [
  "weapon", "armour", "helmet", "torch", "necklace", "braceletL", "braceletR",
  "ringL", "ringR", "amulet", "belt", "boots", "stone", "mount",
];

function createDefaultCharacter(classId) {
  return {
    classId,
    game: {
      mode: "town",
      activeZoneId: null,
      kills: 0,
      progress: { level: 1, experience: 0, gold: 0 },
      starterGearVersion: 1,
      dropPity: {},
      bossKills: {},
      bossRespawns: {},
      recentLoot: [],
    },
    inventory: { gold: 0, pagesUnlocked: 1, maxSlots: 40, nextInstanceId: 1, items: [], equipment: {} },
    hotbar: { slots: [null, null, null, null, null, null] },
    magic: { learned: {} },
    battle: sanitizeCharacterBattleState(),
  };
}

const bossZones = new Set(["zone-wooma-temple-kr", "zone-bug-cave-kr"]);
const zoneFilter = (zoneId) => bossZones.has(zoneId);

function testRestoreOptions() {
  return {
    characterIds: ["Warrior", "Wizard", "Taoist"],
    createDefaultCharacter,
    normalizeCharacterId: (id) => (id === "Wizard" ? "Wizard" : "Warrior"),
    starterGearVersion: 1,
    backfillStarterItem: (inventory, itemId) => {
      inventory.items.push({ id: "item-new", itemId, quantity: 1, slot: 0 });
      return true;
    },
    sanitizeGame: (game, gold, classId) => sanitizeCharacterGameState(game, {
      fallbackGold: gold,
      fallbackLevel: 1,
      zoneIds,
      miningZoneId: "zone-bichon-mine",
      fallbackClassId: classId,
      sanitizeDropPity: (pity) => sanitizeDropPity(pity, zoneIds, 100),
      sanitizeBossKills: (kills) => sanitizeBossKills(kills, zoneFilter),
      sanitizeBossRespawns: (respawns) => sanitizeBossRespawns(respawns, zoneFilter),
    }),
    sanitizeInventory: (inventory, hotbar, gold) => sanitizeInventoryState(inventory, hotbar, {
      fallbackGold: gold,
      equipmentSlotIds,
      pageSize: 40,
      maxSlots: 80,
      maxPages: 2,
    }),
    sanitizeHotbar: (hotbar, inventory) => sanitizeHotbarState(
      hotbar,
      (inventory.items ?? []).map((entry) => entry.id),
      Object.values(inventory.equipment ?? {}).filter(Boolean),
      6,
    ),
    sanitizeMagic: (classId, magic) => removeRetiredTestingDefaultMagic(
      classId,
      sanitizeMagicState(magic, (spellId) => spellId === "Fury"),
      { retiredSpellIds: ["FireBall"] },
    ),
    sanitizeBattle: sanitizeCharacterBattleState,
    retiredWizardSpells: ["FireBall"],
  };
}

test("backfillStarterGear: adds Taoist sword once", () => {
  const character = createDefaultCharacter("Taoist");
  character.game.starterGearVersion = 0;
  backfillStarterGear(character, "Taoist", testRestoreOptions());
  assert.equal(character.game.starterGearVersion, 1);
  assert.equal(character.inventory.items.length, 1);
  assert.equal(character.inventory.items[0].itemId, "wooden-sword");
});

test("restoreCharacterSnapshot: returns default for missing save", () => {
  const restored = restoreCharacterSnapshot(null, "Warrior", createDefaultCharacter("Warrior"), testRestoreOptions());
  assert.equal(restored.game.mode, "town");
  assert.equal(restored.inventory.gold, 0);
});

test("restoreCharactersFromSnapshot: restores multi-character save fixture", () => {
  const characters = restoreCharactersFromSnapshot(minimalSave, testRestoreOptions());
  const warrior = characters.Warrior;
  assert.equal(warrior.game.kills, 12);
  assert.equal(warrior.inventory.gold, 500);
  assert.equal(warrior.game.progress.level, 3);
  assert.equal(warrior.game.dropPity["zone-bicheon-1"], 99);
  assert.equal(warrior.game.bossKills["zone-wooma-temple-kr"], 2);
  assert.equal(characters.Wizard.game.mode, "town");
});

test("restoreCharactersFromSnapshot: legacy flat snapshot restores active class only", () => {
  const legacy = {
    battle: { combatClass: "Wizard" },
    game: { mode: "zone", activeZoneId: "zone-bicheon-1", progress: { level: 2, experience: 10, gold: 250 } },
    inventory: { gold: 250, items: [{ id: "item-1", itemId: "wooden-sword", quantity: 1, slot: 0 }], equipment: {} },
    hotbar: { slots: [null, null, null, null, null, null] },
    magic: { learned: {} },
  };
  const characters = restoreCharactersFromSnapshot(legacy, testRestoreOptions());
  assert.equal(characters.Wizard.game.mode, "zone");
  assert.equal(characters.Wizard.game.activeZoneId, "zone-bicheon-1");
  assert.equal(characters.Wizard.inventory.gold, 250);
  assert.equal(characters.Warrior.game.mode, "town");
});
