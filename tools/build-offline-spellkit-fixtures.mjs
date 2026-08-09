// Generates the "spell kit" offline fixture saves: a level-50 character of each
// class with every class spell learned at max level and auto-cast on, full
// gear, and auto-potions in the first two hotbar slots.
//
// The original offline fixtures (warrior/wizard/taoist -bicheon-v1) are
// level-12/20 characters with at most ONE learned spell, so they never exercise
// the offline simulation's spell-selection path. These do.
//
// Run: node tools/build-offline-spellkit-fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
} from "../src/warriorMagic.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const itemData = JSON.parse(readFileSync(join(root, "src/data/items.json"), "utf8"));
const ITEMS = itemData.items ?? itemData;

const CHARACTER_LEVEL = 60;
const ZONE_ID = "zone-wooma-temple-1";
// Book-taught spells are stripped by the one-time "unfair skill" purge unless the
// save already records that migration as done. These characters legitimately own
// their whole kit, so stamp it.
const UNFAIR_SKILL_PURGE_VERSION = 1;
// Learn everything at skill level 1 with no practice XP: every cast then earns
// measurable practice XP, which is how the live/offline A/B counts casts.
const SPELL_LEVEL = 1;
// A character only gets BASE_AUTOCAST_SLOTS (1) auto-cast slot until the account
// buys the three upgrades. Without them the game trims the auto-cast set down to
// the single highest-priority spell, so a fixture that flags everything would
// only ever cast one spell. Buy the upgrades and flag exactly four spells, so the
// set survives normalizeAutoCastSpellsForClass untouched.
const ACCOUNT_UPGRADE_TIERS = {
  "autocast-slot-2": 1,
  "autocast-slot-3": 1,
  "autocast-slot-4": 1,
  "auto-potion-slot-3": 1,
  "auto-potion-slot-4": 1,
  "auto-potion-slot-5": 1,
};
const AUTO_CAST_IDS = {
  Warrior: ["Fury", "TwinDrakeBlade", "FlamingSword", "HalfMoon"],
  Wizard: ["MagicShield", "GreatFireBall", "ThunderBolt", "FireBall"],
  Taoist: ["Healing", "SummonSkeleton", "Poisoning", "SoulFireBall"],
};
const CLASS_MASK = { Warrior: 1, Wizard: 2, Taoist: 4 };
const SPELLS = {
  Warrior: CRYSTAL_WARRIOR_SPELLS,
  Wizard: CRYSTAL_WIZARD_SPELLS,
  Taoist: CRYSTAL_TAOIST_SPELLS,
};
const GEAR_SLOTS = [
  "weapon", "armour", "helmet", "necklace", "braceletL", "braceletR",
  "ringL", "ringR", "belt", "boots",
];
const EQUIPMENT_SLOT_KEYS = [
  ...GEAR_SLOTS, "torch", "amulet", "stone", "mount",
];

function itemLevel(item) {
  return Math.max(0, Math.trunc(Number(item?.requirements?.amount) || 0));
}

function usableBy(item, classId) {
  if (itemLevel(item) > CHARACTER_LEVEL) return false;
  const mask = Number(item?.requirements?.classMask);
  if (Number.isFinite(mask) && mask > 0 && !(mask & CLASS_MASK[classId])) return false;
  const klass = String(item?.class ?? "any").toLowerCase();
  return klass === "any" || klass === classId.toLowerCase();
}

/** Crude power score so each slot gets the best gear the class can wear. */
function powerScore(item, classId) {
  const stats = item?.stats ?? {};
  const range = (value) => (Array.isArray(value) ? (Number(value[0]) + Number(value[1])) / 2 : Number(value) || 0);
  const offence = classId === "Wizard"
    ? range(stats.mc)
    : classId === "Taoist"
      ? range(stats.sc)
      : range(stats.dc);
  return offence * 4
    + range(stats.ac) * 2
    + range(stats.amc) * 2
    + (Number(stats.hp) || 0) / 10
    + (Number(stats.mp) || 0) / 20
    + (Number(stats.accuracy) || 0) * 3
    + (Number(stats.agility) || 0) * 2
    + (Number(stats.attackSpeed) || 0) * 6;
}

function bestItemForSlot(slotId, classId) {
  const wantedType = slotId.startsWith("bracelet")
    ? "bracelet"
    : slotId.startsWith("ring")
      ? "ring"
      : slotId;
  const candidates = ITEMS
    .filter((item) => item.type === wantedType && usableBy(item, classId))
    .sort((a, b) => powerScore(b, classId) - powerScore(a, classId));
  return candidates[0] ?? null;
}

function buildCharacter(classId, { active }) {
  const items = [];
  const equipment = Object.fromEntries(EQUIPMENT_SLOT_KEYS.map((slot) => [slot, null]));
  let nextId = 1;
  const addItem = (itemId, quantity, slot) => {
    const entry = { id: `item-${nextId}`, itemId, quantity, slot };
    nextId += 1;
    items.push(entry);
    return entry;
  };

  if (active) {
    for (const slotId of GEAR_SLOTS) {
      const item = bestItemForSlot(slotId, classId);
      if (!item) continue;
      equipment[slotId] = addItem(item.id, 1, null).id;
    }
    // Hotbar slots 0 and 1 are the base auto-potion slots.
    const hpPotion = addItem("hp-drug-xl", 64, 0);
    const mpPotion = addItem("mp-drug-xl", 64, 1);
    addItem("hp-drug-xl", 64, 2);
    addItem("mp-drug-xl", 64, 3);
    if (classId === "Taoist") {
      // SoulFireBall eats an amulet per cast. A single stack runs dry partway
      // through a long comparison run, which silently turns a combat-pacing
      // measurement into an ammo-supply measurement, so carry spares.
      addItem("taoist-amulet", 64, 4);
      for (let i = 0; i < 8; i += 1) addItem("taoist-amulet", 64, null);
      addItem("yellow-poison", 64, 5);
      addItem("green-poison", 64, 6);
    }

    const learned = {};
    const autoCastIds = new Set(AUTO_CAST_IDS[classId] ?? []);
    for (const spell of SPELLS[classId]) {
      learned[spell.id] = {
        spellId: spell.id,
        level: SPELL_LEVEL,
        experience: 0,
        key: null,
        autoCast: autoCastIds.has(spell.id),
        castReadyAt: 0,
        learnedAt: 1,
      };
    }

    return {
      classId,
      game: {
        mode: "zone",
        activeZoneId: ZONE_ID,
        kills: 0,
        zoneKills: 0,
        distance: 0,
        playtimeMs: 3600000,
        progress: { level: CHARACTER_LEVEL, experience: 0, gold: 5000000 },
        dropPity: {},
        bossKills: {},
        bossRespawns: {},
        recentLoot: [],
      },
      inventory: {
        gold: 5000000,
        pagesUnlocked: 1,
        maxSlots: 40,
        nextInstanceId: nextId,
        items,
        equipment,
      },
      hotbar: { slots: [hpPotion.id, mpPotion.id, null, null, null, null] },
      magic: { learned },
      battle: { running: true, paused: false },
    };
  }

  return {
    classId,
    game: {
      mode: "town",
      activeZoneId: null,
      kills: 0,
      zoneKills: 0,
      distance: 0,
      playtimeMs: 0,
      progress: { level: 1, experience: 0, gold: 0 },
      dropPity: {},
      bossKills: {},
      bossRespawns: {},
      recentLoot: [],
    },
    inventory: {
      gold: 0,
      pagesUnlocked: 1,
      maxSlots: 40,
      nextInstanceId: 1,
      items: [],
      equipment: Object.fromEntries(EQUIPMENT_SLOT_KEYS.map((slot) => [slot, null])),
    },
    hotbar: { slots: [null, null, null, null, null, null] },
    magic: { learned: {} },
    battle: { running: false, paused: false },
  };
}

for (const activeClassId of ["Warrior", "Wizard", "Taoist"]) {
  const save = {
    version: 1,
    savedAt: 0,
    activeCharacterId: activeClassId,
    characters: Object.fromEntries(
      ["Warrior", "Wizard", "Taoist"].map((classId) => [
        classId,
        buildCharacter(classId, { active: classId === activeClassId }),
      ]),
    ),
    account: {
      storage: { pagesUnlocked: 1, page2Purchased: false, maxSlots: 80, nextInstanceId: 1, items: [] },
      upgrades: { tiers: { ...ACCOUNT_UPGRADE_TIERS } },
      rebirthPoints: 0,
      bossRespawns: {},
      stats: { rebirthCount: 0, rebirthPointsGained: 0, rebirthPointsSpent: 0, bossKills: {} },
    },
    settings: {
      musicEnabled: false,
      musicVolume: 0,
      sfxEnabled: false,
      sfxVolume: 0,
      unfairSkillPurgeVersion: UNFAIR_SKILL_PURGE_VERSION,
    },
  };
  const outPath = join(root, `tests/fixtures/saves/${activeClassId.toLowerCase()}-offline-spellkit-v1.json`);
  writeFileSync(outPath, `${JSON.stringify(save, null, 2)}\n`, "utf8");
  const learned = save.characters[activeClassId].magic.learned;
  const equipped = Object.entries(save.characters[activeClassId].inventory.equipment)
    .filter(([, id]) => id)
    .length;
  const autoOn = Object.values(learned).filter((entry) => entry.autoCast).map((entry) => entry.spellId);
  const missing = (AUTO_CAST_IDS[activeClassId] ?? []).filter((id) => !learned[id]);
  if (missing.length) throw new Error(`${activeClassId} auto-cast ids not in spell list: ${missing.join(", ")}`);
  console.log(`${activeClassId}: ${Object.keys(learned).length} spells, ${equipped} equipped, auto=[${autoOn.join(", ")}] -> ${outPath}`);
}
