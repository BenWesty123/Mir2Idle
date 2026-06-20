/**
 * Generates a god-mode test save for LOM Idle V2.
 * Run: node tools/generate-test-save.mjs
 * Output: saves/lom-idle-v2-test-god-mode.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
  CRYSTAL_TAOIST_SPELLS,
} from "../src/warriorMagic.js";
import { CRYSTAL_MAX_LEVEL } from "../src/battleData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "saves", "lom-idle-v2-test-god-mode.json");

const SAVE_VERSION = 1;
const LEVEL = CRYSTAL_MAX_LEVEL;
const GOLD = 99_999_999;
const MUSIC_SETTINGS_VERSION = 2;

const EQUIPMENT_SLOTS = [
  "weapon", "armour", "helmet", "torch", "necklace",
  "braceletL", "braceletR", "ringL", "ringR", "amulet", "belt", "boots", "stone", "mount",
];

const GOD_BONUS = {
  dc: [500, 500],
  mc: [500, 500],
  sc: [500, 500],
  ac: [200, 200],
  amc: [200, 200],
  hp: 50_000,
  mp: 50_000,
  accuracy: 100,
  agility: 100,
  luck: 10,
  attackSpeed: 20,
};

const CLASS_GEAR = {
  Warrior: {
    weapon: "sword-of-war-god",
    armour: "heaven-armour",
    helmet: "great-helmet",
    necklace: "hero-necklace",
    braceletL: "8-trigram-wheel",
    braceletR: "8-trigram-wheel",
    ringL: "boundless-ring",
    ringR: "oma-spirit-ring",
    belt: "black-iron-belt",
    stone: "dcstone",
    boots: "black-boots",
  },
  Wizard: {
    weapon: "blade-of-sorcery",
    armour: "heaven-armour",
    helmet: "great-helmet",
    necklace: "hero-necklace",
    braceletL: "8-trigram-wheel",
    braceletR: "8-trigram-wheel",
    ringL: "boundless-ring",
    ringR: "oma-spirit-ring",
    belt: "black-iron-belt",
    stone: "dcstone",
    boots: "black-boots",
  },
  Taoist: {
    weapon: "heaven-sword",
    armour: "heaven-armour",
    helmet: "tao-coronet",
    necklace: "hero-necklace",
    braceletL: "8-trigram-wheel",
    braceletR: "8-trigram-wheel",
    ringL: "boundless-ring",
    ringR: "oma-spirit-ring",
    belt: "black-iron-belt",
    stone: "dcstone",
    boots: "black-boots",
  },
};

const CLASS_SPELLS = {
  Warrior: CRYSTAL_WARRIOR_SPELLS,
  Wizard: CRYSTAL_WIZARD_SPELLS,
  Taoist: CRYSTAL_TAOIST_SPELLS,
};

function buildLearnedSpells(spellList) {
  const now = Date.now();
  return Object.fromEntries(
    spellList.map((spell) => [
      spell.id,
      {
        spellId: spell.id,
        level: 3,
        experience: 999_999,
        key: null,
        autoCast: true,
        castReadyAt: 0,
        learnedAt: now,
      },
    ]),
  );
}

function buildInventory(classId, gearMap) {
  let nextId = 1;
  const items = [];
  const equipment = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null]));

  function addItem(itemId, quantity = 1, slot = null, bonusStats = null) {
    const id = `item-${nextId++}`;
    const entry = {
      id,
      itemId,
      quantity,
      slot,
      refineLevel: 0,
      weaponRefineLevel: 0,
      gemCount: 0,
      bonusStats: bonusStats ?? {},
    };
    items.push(entry);
    return id;
  }

  for (const [slotId, itemId] of Object.entries(gearMap)) {
    if (!itemId || !EQUIPMENT_SLOTS.includes(slotId)) continue;
    const id = addItem(itemId, 1, null, GOD_BONUS);
    equipment[slotId] = id;
  }

  const bag = [
    ["hp-drug-xl", 999],
    ["mp-drug-xl", 999],
    ["impact-drug-m", 99],
    ["magic-drug-m", 99],
    ["taoist-drug-m", 99],
    ["green-poison", 99],
    ["yellow-poison", 99],
  ];
  let bagSlot = 0;
  for (const [itemId, quantity] of bag) {
    addItem(itemId, quantity, bagSlot++);
  }

  return {
    gold: GOLD,
    pagesUnlocked: 2,
    maxSlots: 80,
    nextInstanceId: nextId,
    items,
    equipment,
  };
}

function buildCharacter(classId) {
  const inventory = buildInventory(classId, CLASS_GEAR[classId] ?? {});
  return {
    classId,
    game: {
      mode: "town",
      activeZoneId: null,
      kills: 0,
      zoneKills: 0,
      distance: 0,
      playtimeMs: 0,
      lastReward: null,
      recentLoot: [],
      dropPity: {},
      bossRespawns: {},
      bossKills: {},
      progress: {
        level: LEVEL,
        experience: 0,
        gold: GOLD,
      },
      starterGearVersion: 1,
      miningNextRollAt: 0,
      miningSpotId: null,
      groupDungeonRun: null,
    },
    inventory,
    hotbar: { slots: [null, null, null, null, null, null] },
    magic: { learned: buildLearnedSpells(CLASS_SPELLS[classId] ?? []) },
    battle: {
      running: false,
      paused: false,
      playerHp: null,
      playerMp: null,
      potHealthAmount: 0,
      potManaAmount: 0,
      healAmount: 0,
      statBuffs: [],
      petStatBuffs: [],
    },
  };
}

const warrior = buildCharacter("Warrior");
const wizard = buildCharacter("Wizard");
const taoist = buildCharacter("Taoist");

const snapshot = {
  version: SAVE_VERSION,
  savedAt: Date.now(),
  activeCharacterId: "Warrior",
  groupDungeonRun: null,
  characters: {
    Warrior: warrior,
    Wizard: wizard,
    Taoist: taoist,
  },
  account: {
    storage: {
      pagesUnlocked: 2,
      page2Purchased: true,
      maxSlots: 80,
      nextInstanceId: 1,
      items: [],
    },
    upgrades: { tiers: {} },
    rebirthPoints: 0,
    bossRespawns: {},
    stats: {
      rebirthCount: 0,
      rebirthPointsGained: 0,
      rebirthPointsSpent: 0,
      bossKills: {},
    },
  },
  game: { ...warrior.game },
  inventory: warrior.inventory,
  hotbar: warrior.hotbar,
  magic: warrior.magic,
  battle: {
    combatClass: "Warrior",
    ...warrior.battle,
  },
  indexes: { armour: 0, hair: 0, weapon: null },
  characterTab: "character",
  settings: {
    musicSettingsVersion: MUSIC_SETTINGS_VERSION,
    musicEnabled: true,
    musicVolume: 0.5,
    musicMode: "zone",
    musicTrackId: "30001",
    sfxEnabled: true,
    sfxVolume: 0.5,
    prototypeStatsEnabled: true,
    prototypeStatsNoticeVersion: 1,
    prototypeResetNoticeVersion: 0,
    prototypeResetNoticeLastSeenAt: 0,
  },
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${OUT_PATH}`);
console.log(`Level ${LEVEL} Warrior/Wizard/Taoist, ${GOLD.toLocaleString()} gold, mastered skills, god-tier gear.`);
