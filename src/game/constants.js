import { ACTION_GROUPS, PLAYER_ACTIONS, sourceFrameFor } from "../playerActions.js";
import {
  ENEMY_TEMPLATES,
  PLAYER_TEMPLATE,
  attackDelayMs,
  CRYSTAL_PLAYER_ACTION_LOCK_MS,
  crystalAdjustedExperience,
  twinDrakeAttackDelayMs,
  crystalExperienceForLevel,
  crystalPlayerBaseStats,
  CRYSTAL_MAX_LUCK,
  formatStatRange,
  randomInt,
  rollDamage,
  rollStat,
  statRange,
} from "../battleData.js";
import { SPELL_GROUPS, bodyActionForSpell, spellLabel } from "../spellBodyActions.js";
import { loadAtlas, loadJson, missingActions, sheetUrl } from "../atlas.js";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
  WARRIOR_COMBAT_SKILLS,
  magicIconSrc,
  CRYSTAL_SPELL_GLOBAL_LOCK_MS,
  crystalSpellCastCooldownMs,
  spellDelayMs,
  spellExperienceTarget,
  spellLevelRequirement,
  spellMpCost,
  taoistSpellById,
  taoistSpellByShape,
  warriorSpellById,
  warriorSpellByShape,
} from "../warriorMagic.js";
import { MINING_SPOTS, PHASE1_ZONES } from "../phase1Data.js";
import {
  GROUP_DUNGEON_SWARM_BLOCKED_RETRY_MS,
  GROUP_DUNGEON_SWARM_CELL_HEIGHT,
  GROUP_DUNGEON_SWARM_LANES,
  GROUP_DUNGEON_SWARM_SPAWN_MS,
  ensureSwarmDirectionalActions,
  fireWallCrossTiles,
  swarmAttackActionForLane,
  swarmEnemyEngagedStanceAction,
  swarmEnemyInAttackRange,
  swarmEnemyReservedTile,
  swarmEnemyTilePosition,
  swarmLaneFromMapRow,
  swarmLaneMapRow,
  swarmMeleeColumnWorldX,
  swarmPickWalkStep,
  swarmSnapTileX,
  swarmTileOccupied,
  GROUP_DUNGEON_WAVES_PER_FLOOR,
  GROUP_DUNGEON_WAVE_SPAWN_CAP,
  GROUP_DUNGEON_WAVE_FIELD_CAP,
  GROUP_DUNGEON_WAVE_REFILL_THRESHOLD,
  GROUP_DUNGEON_WAVE_REFILL_BATCH,
  GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS,
  GROUP_DUNGEON_WAVE_INSTANT_CAP,
  GROUP_DUNGEON_WAVE_BURST_STAGGER_MS,
  groupDungeonWavesPerFloor,
  groupDungeonWaveSpawnCount,
  createGroupDungeonWaveState,
} from "../groupDungeonSwarm.js";
import {
  BUFF_POTION_DURATION_MS,
  applyStatBuffsToStats,
  buffPotionDefForItem,
  formatBuffRemaining,
  isBuffPotionItem,
  pruneStatBuffs,
  sanitizeStatBuffs,
  statBuffBonusLabel,
} from "../buffPotions.js";

export const TESTING_XP_MULTIPLIER = 1;

export const SPRITE_SETS = {
  common: { label: "Warrior / Wizard / Taoist", folders: "CArmour + CHair + CWeapon" },
};

export const COMBAT_ANCHORS = {
  player: { x: 0.34, y: 0.78 },
  enemy: { x: 0.68, y: 0.78 },
};

export const LANE_TILE_PX = 48;
export const MAP_LANE_ROW_STEP = 28;
export const MAP_TILE_ANCHOR_ROW_STEP = 32;
export const WALK_CYCLE_MS = PLAYER_ACTIONS.walking.count * PLAYER_ACTIONS.walking.interval;
export const RUN_CYCLE_MS = PLAYER_ACTIONS.running.count * PLAYER_ACTIONS.running.interval;
export const WALK_SPEED = Math.round(LANE_TILE_PX / (WALK_CYCLE_MS / 1000));
export const RUN_SPEED = Math.round((LANE_TILE_PX * 2) / (RUN_CYCLE_MS / 1000));
export const TRAVEL_WALK_DISTANCE = LANE_TILE_PX * 2;
export const INVENTORY_PAGE_SIZE = 40;
export const INVENTORY_BASE_SLOTS = INVENTORY_PAGE_SIZE;
export const INVENTORY_MAX_SLOTS = INVENTORY_PAGE_SIZE * 2;
export const INVENTORY_PAGE_2_UNLOCK_COST = 100000;
export const STORAGE_PAGE_SIZE = 80;
export const STORAGE_BASE_SLOTS = STORAGE_PAGE_SIZE;
export const STORAGE_MAX_SLOTS = STORAGE_PAGE_SIZE * 2;
export const STORAGE_PAGE_2_UNLOCK_COST = 1000000;
export const STORAGE_SLOT_COUNT = STORAGE_MAX_SLOTS;
export const STORAGE_COLUMNS = 10;
export const REBIRTH_ENABLED = false;
export const HOTBAR_SLOT_COUNT = 6;
export const BASE_AUTOCAST_SLOTS = 1;
export const BASE_AUTO_POTION_SLOTS = 2;
export const ACCOUNT_UPGRADE_CATEGORIES = [
  { id: "combat", label: "Combat", summary: "Automation and combat control." },
  { id: "utility", label: "Utility", summary: "Potion handling and quality of life." },
  { id: "rebirth", label: "Rebirth", summary: "Rebirth converts Awakening Souls into Rebirth Points for permanent buffs." },
  { id: "bosses", label: "Bosses", summary: "Future boss-fight features." },
];
export const ACCOUNT_UPGRADE_DEFS = [
  {
    id: "autocast-slot-2",
    label: "Second Autocast Slot",
    category: "combat",
    cost: 0,
    itemCosts: [{ itemId: "large-bone", quantity: 1 }],
    effect: "autocastSlots",
    value: 1,
    sourceHint: "Drops from Bone Elite",
    summary: "Allows every character to keep two combat skills set to auto.",
  },
  {
    id: "autocast-slot-3",
    label: "Third Autocast Slot",
    category: "combat",
    cost: 0,
    itemCosts: [{ itemId: "zuma-relic", quantity: 1 }],
    effect: "autocastSlots",
    value: 1,
    sourceHint: "Drops from Zuma Taurus",
    summary: "Allows every character to keep three combat skills set to auto.",
  },
  {
    id: "auto-potion-slot-3",
    label: "Third Auto Potion Slot",
    category: "utility",
    cost: 0,
    itemCosts: [{ itemId: "ghoul-heart", quantity: 1 }],
    effect: "autoPotionSlots",
    value: 1,
    sourceHint: "Drops from Ghoul",
    summary: "Allows hotbar slot 3 to trigger auto potions.",
  },
  {
    id: "auto-potion-slot-4",
    label: "Fourth Auto Potion Slot",
    category: "utility",
    cost: 0,
    itemCosts: [{ itemId: "wooma-heart", quantity: 1 }],
    effect: "autoPotionSlots",
    value: 1,
    sourceHint: "Drops from Wooma Taurus",
    summary: "Allows hotbar slot 4 to trigger auto potions.",
  },
  {
    id: "rebirth-xp",
    label: "XP Blessing",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "xpBonusPercent",
    value: 10,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases XP gained by 10% per purchase.",
  },
  {
    id: "rebirth-stat-dc",
    label: "Base DC +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "dc",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base DC by 1 per purchase.",
  },
  {
    id: "rebirth-stat-mc",
    label: "Base MC +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "mc",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base MC by 1 per purchase.",
  },
  {
    id: "rebirth-stat-sc",
    label: "Base SC +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "sc",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base SC by 1 per purchase.",
  },
  {
    id: "rebirth-stat-ac",
    label: "Base AC +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "ac",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base AC by 1 per purchase.",
  },
  {
    id: "rebirth-stat-amc",
    label: "Base AMC +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "amc",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base AMC by 1 per purchase.",
  },
  {
    id: "rebirth-stat-accuracy",
    label: "Base Accuracy +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "accuracy",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base accuracy by 1 per purchase.",
  },
  {
    id: "rebirth-stat-agility",
    label: "Base Agility +1",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseStatBonus",
    stat: "agility",
    value: 1,
    rebirthCostFn: "linear",
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base agility by 1 per purchase.",
  },
  {
    id: "rebirth-luck",
    label: "Fortune's Favor",
    category: "rebirth",
    currency: "rebirthPoints",
    effect: "baseLuck",
    value: 1,
    rebirthCosts: [5, 10, 20, 40, 80],
    sourceHint: "Spent when unlocking rebirth upgrades",
    summary: "Increases base luck by 1 per purchase.",
  },
  {
    id: "boss-empowerment",
    label: "Boss Empowerment",
    category: "bosses",
    currency: "rebirthPoints",
    effect: "bossEmpowerment",
    value: 1,
    rebirthCosts: [1],
    planned: true,
    progressText: "Locked",
    requirementText: "Not available yet",
    sourceHint: "Coming in a future update",
    summary: "Unlock empowered boss fights for improved drops.",
  },
];
export const REBIRTH_BASE_STAT_UPGRADE_IDS = [
  "rebirth-stat-dc",
  "rebirth-stat-mc",
  "rebirth-stat-sc",
  "rebirth-stat-ac",
  "rebirth-stat-amc",
  "rebirth-stat-accuracy",
  "rebirth-stat-agility",
];
export const LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID = "rebirth-base-stats";
export const ACCOUNT_UPGRADE_PREVIEW_DEFS = [];
export const BOSS_RESPAWN_MINUTES_STANDARD = 30;
export const BOSS_RESPAWN_MINUTES_ELITE = 60;
export const BOSS_ROOM_DEFS = {
  "zone-wooma-temple-kr": {
    bossName: "Wooma Taurus",
    respawnMinutes: BOSS_RESPAWN_MINUTES_STANDARD,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Wooma Taurus for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-bug-cave-kr": {
    bossName: "Evil Centipede",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Evil Centipede for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-stone-temple-kr": {
    bossName: "Evil Snake",
    respawnMinutes: BOSS_RESPAWN_MINUTES_STANDARD,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Evil Snake for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-zuma-temple-kr": {
    bossName: "Zuma Taurus",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Zuma Taurus for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-prajna-cave-kr": {
    bossName: "Bone Lord",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Bone Lord for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-prajna-temple-kr": {
    bossName: "Minotaur King",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Minotaur King for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-manectric-king-kr": {
    bossName: "Manectric King",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Manectric King for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-flame-queen-kr": {
    bossName: "Flame Queen",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Flame Queen for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-flaming-mutant-kr": {
    bossName: "Flaming Mutant",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Flaming Mutant for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-scaly-beast-kr": {
    bossName: "Scaly Beast",
    respawnMinutes: BOSS_RESPAWN_MINUTES_ELITE,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Scaly Beast for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
  "zone-kings-tomb": {
    bossName: "Oma King Spirit",
    respawnMinutes: 120,
    unlockHint: "Select saved characters to call into the fight.",
    empowerLabel: "Empower Oma King Spirit for better drops",
    empowerRequirement: "Boss Empowerment is not available yet.",
  },
};
export const BOSS_ASSIST_OPTIONS = [
  { classId: "Warrior", label: "Summon Warrior" },
  { classId: "Wizard", label: "Summon Wizard" },
  { classId: "Taoist", label: "Summon Tao" },
];
export const BOSS_PARTY_ORDER = ["Warrior", "Taoist", "Wizard"];
export const BOSS_PARTY_MEMBER_ACTION_GAP_MS = 350;
export const BOSS_PARTY_FRONT_OFFSET = LANE_TILE_PX;
export const BOSS_PARTY_MEMBER_LINE_SLOTS = {
  Warrior: 0,
  Taoist: 2,
  Wizard: 4,
};
// Boss melee/positioning, mirroring the normal-fight spacing in LANE.* below.
// Literals are used because LANE and THRUSTING_RANGE are defined later in the file.
export const BOSS_PARTY_ENEMY_MELEE_GAP = 48; // boss resting distance from its front target (matches LANE.enemyRange)
export const BOSS_PARTY_ENEMY_APPROACH_GAP = 144; // boss spawns this far out, then steps in to melee
export const BOSS_PARTY_BOSS_APPROACH_SPEED = 52; // slower walk-in than LANE.enemySpeed so the boss does not snap closed
// Crystal MonsterObject.Walk: snap 1 cell, ActionTime += 300, MoveTime += MoveSpeed.
export const CRYSTAL_MONSTER_WALK_ACTION_MS = 300;
export const BOSS_PARTY_BOSS_REACH = 56; // boss may melee its front target within this range
export const BOSS_PARTY_WARRIOR_REACH = 52; // member weapon reach (matches LANE.warriorRange)
export const BOSS_PARTY_THRUSTING_REACH = 100; // Warrior 2-tile Thrusting reach (matches THRUSTING_RANGE)
export const BOSS_PARTY_PET_STAND_GAP = 48; // a tanking pet stands this far in front of the Warrior
export const BOSS_PARTY_SHINSU_LINE_SLOT = 1; // party line slot between Warrior (0) and Taoist (2)
export const BOSS_PARTY_ASSIST_SFX_SCALE = 0.6; // assist members' combat SFX volume vs the controlled character
export const BOSS_PARTY_DAMAGE_TEXT_OFFSET = 40; // px the assist members' damage numbers sit left/right of the controlled character's
export const BOSS_PARTY_CAMERA_LERP_MS = 280; // ease camera back after a front-liner finishes stepping up
export const LEVEL_UP_FX_ID = "LevelUp";
export const HEALING_RESTORE_FX_ID = "HealingRestore"; // Magic.Lib frame 370 -- the heal-lands-on-target effect (Crystal)
export const MAP_LIGHTNING_FX_ID = "MapLightning";
export const MAP_LIGHTNING_MIN_INTERVAL_MS = 1000;
export const MAP_LIGHTNING_MAX_INTERVAL_MS = 5000;
export const MAP_LIGHTNING_EFFECT_MS = 600;
export const MAP_LIGHTNING_HIT_DELAY_MS = 500;
export const MAP_LIGHTNING_RESOLVE_GRACE_MS = 1500;
export const MAP_LIGHTNING_SPREAD_TILES = 10;
export const MAP_LIGHTNING_HIT_RADIUS_PX = LANE_TILE_PX * 1.5;
export const TAOIST_DEFENCE_BUFF_IMPACT_FX = {
  SoulShield: "SoulShieldImpact",
  BlessedArmour: "BlessedArmourImpact",
};
export const CRYSTAL_POT_DELAY_MS = 200;
export const CRYSTAL_HEAL_DELAY_MS = 600;
export const CRYSTAL_HEAL_APPLY_DELAY_MS = 500;
export const CRYSTAL_TWIN_DRAKE_SECOND_HIT_DELAY_MS = 400;
export const CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS = 500;
export const CRYSTAL_MAGIC_SHIELD_STRUCK_MS = 600;
export const CRYSTAL_MAGIC_SHIELD_CAST_LAYER_END = 1;
export const CRYSTAL_MAGIC_SHIELD_LOOP_LAYER = 1;
export const CRYSTAL_MAGIC_SHIELD_STRUCK_LAYER = 2;
export const WARRIOR_CHARGE_SKILL_IDS = new Set(["FlamingSword", "TwinDrakeBlade"]);
export const WARRIOR_AUTO_CHARGE_ORDER = ["FlamingSword", "TwinDrakeBlade"];
export const CRYSTAL_POISON_APPLY_DELAY_MS = 500;
export const CRYSTAL_POISON_TICK_MS = 2000;
export const CRYSTAL_POISON_RESIST_WEIGHT = 10;
export const EVIL_CENTIPEDE_ATTACK_IMPACT_MS = 500;
export const BONE_LORD_ATTACK_IMPACT_MS = 500;

// Crystal PlayerObject.PlayAttackSound / MonsterObject.PlayStruckSound weapon-shape groups.
export const CRYSTAL_WEAPON_SWING_SFX_GROUPS = {
  wood: [0, 23, 28, 40],
  short: [1, 12],
  sword: [2, 8, 11, 15, 18, 20, 25, 31, 33, 34, 37, 41],
  sword2: [3, 5, 7, 9, 13, 19, 24, 26, 29, 32, 35],
  axe: [4, 14, 16, 38],
  long: [6, 10, 17, 22, 27, 30, 36, 39, 42],
  club: [21],
};
export const CRYSTAL_WEAPON_HIT_SFX_GROUPS = {
  wood: [0, 23, 28, 40],
  short: [1, 12, 6, 10, 17, 22, 27, 30, 36, 39],
  sword: [2, 8, 11, 15, 18, 20, 25, 31, 33, 34, 37, 41],
  sword2: [3, 5, 7, 9, 13, 19, 24, 26, 29, 32, 35],
  axe: [4, 14, 16, 38],
  club: [21],
};

export function buildCrystalWeaponSfxLookup(groups) {
  const lookup = new Map();
  for (const [family, shapes] of Object.entries(groups)) {
    for (const shape of shapes) lookup.set(shape, family);
  }
  return lookup;
}

export const WEAPON_SWING_SFX_BY_SHAPE = buildCrystalWeaponSfxLookup(CRYSTAL_WEAPON_SWING_SFX_GROUPS);
export const WEAPON_HIT_SFX_BY_SHAPE = buildCrystalWeaponSfxLookup(CRYSTAL_WEAPON_HIT_SFX_GROUPS);
export const EVIL_CENTIPEDE_GREEN_POISON_CHANCE = 5;
export const EVIL_CENTIPEDE_PARALYSIS_POISON_CHANCE = 15;
export const EVIL_CENTIPEDE_GREEN_POISON_TICKS = 15;
export const EVIL_CENTIPEDE_PARALYSIS_POISON_TICKS = 5;
export const CRYSTAL_SUMMON_SKELETON_DELAY_MS = 500;
export const CRYSTAL_SUMMON_SKELETON_PET_INDEX = 78;
export const CRYSTAL_SUMMON_SKELETON_AMULET_COST = 1;
export const CRYSTAL_SUMMON_SKELETON_PET_STATS = {
  name: "Bone Familiar",
  level: 15,
  maxHp: 140,
  dc: [12, 23],
  ac: [2, 4],
  amc: [3, 6],
  accuracy: 20,
  agility: 20,
  luck: 0,
  attackMs: 1500,
};
export const CRYSTAL_SUMMON_SHINSU_DELAY_MS = 500;
export const CRYSTAL_SUMMON_SHINSU_PET_INDEX = 79;
export const CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX = 80;
export const CRYSTAL_SUMMON_SHINSU_AMULET_COST = 5;
export const CRYSTAL_SUMMON_SHINSU_ATTACK_RANGE_PX = LANE_TILE_PX * 2;
export const CRYSTAL_SHINSU_ATTACK_IMPACT_FRAME = 3;
export const CRYSTAL_SUMMON_SHINSU_PET_STATS = {
  name: "Shinsu",
  level: 32,
  maxHp: 160,
  dc: [7, 25],
  ac: [8, 8],
  amc: [5, 5],
  accuracy: 25,
  agility: 17,
  luck: 0,
  attackMs: 1500,
};
export const TAOIST_SUMMON_AMULET_COST_BY_SPELL = {
  SummonSkeleton: CRYSTAL_SUMMON_SKELETON_AMULET_COST,
  SummonShinsu: CRYSTAL_SUMMON_SHINSU_AMULET_COST,
};
export const SAVE_KEY = "lom-idle-v2-save";
export const SAVE_VERSION = 1;
export const STARTER_GEAR_VERSION = 1;
export const SAVE_INTERVAL_MS = 2000;
export const SIMULATION_STEP_MS = 100;
export const MAX_SIMULATION_CATCH_UP_MS = 10 * 60 * 1000;
export const BOSS_PARTY_CATCHUP_MAX_STEPS = 12000;
export const OFFLINE_PROGRESS_CAP_MS = 8 * 60 * 60 * 1000;
export const OFFLINE_PROGRESS_MIN_MS = 30 * 1000;
export const DROP_PITY_KILLS = 8;
export const COMBAT_STANCE_HOLD_MS = 1000;
// Taoist support/queue polling — must not shorten weapon swing cooldown.
export const TAOIST_COMBAT_POLL_MS = 250;
export const BENEDICTION_OIL_ITEM_ID = "benediction-oil";
export const GEM_STAT_INDEPENDENT = true;
export const GEM_FAIL_DESTROY_CHANCE = 3 / 15;
export const SPECIAL_ITEM_MODE = {
  Paralize: 0x0001,
  Teleport: 0x0002,
  ClearRing: 0x0004,
  Protection: 0x0008,
  Revival: 0x0010,
  Muscle: 0x0020,
  Flame: 0x0040,
  Healing: 0x0080,
  Probe: 0x0100,
  Skill: 0x0200,
  NoDuraLoss: 0x0400,
};
export const GEM_VALID_SLOT_FLAGS = {
  weapon: SPECIAL_ITEM_MODE.Paralize,
  armour: SPECIAL_ITEM_MODE.Teleport,
  helmet: SPECIAL_ITEM_MODE.ClearRing,
  necklace: SPECIAL_ITEM_MODE.Protection,
  bracelet: SPECIAL_ITEM_MODE.Revival,
  ring: SPECIAL_ITEM_MODE.Muscle,
  amulet: SPECIAL_ITEM_MODE.Flame,
  belt: SPECIAL_ITEM_MODE.Healing,
  boots: SPECIAL_ITEM_MODE.Probe,
  stone: SPECIAL_ITEM_MODE.Skill,
};
export const AWAKENING_SOUL_ITEM_ID = "awakening-soul";
export const AWAKENING_SOUL_BOSS_SOURCES = [
  "Wooma Taurus",
  "Evil Centipede",
  "Evil Snake",
  "Zuma Taurus",
  "Bone Lord",
  "Minotaur King",
  "Oma King Spirit",
];
export const WOMA_TAURUS_ENEMY_ID = 256;
export const INCARNATED_WT_ENEMY_ID = 306;
export const INCARNATED_ZT_ENEMY_ID = 317;
export const INCARNATED_RTZ_ENEMY_ID = 318;
export const DEFAULT_ARENA_BOSS_SPAWN_X = 300;
export const EVIL_CENTIPEDE_ENEMY_ID = 166;
export const EVIL_SNAKE_ENEMY_ID = 266;
export const BOSS_GEM_ITEM_IDS = [
  "accuracygem",
  "agilitygem",
  "braverygem",
  "disillusiongem",
  "endurancegem",
  "evilslayergem",
  "freezinggem",
  "magicgem",
  "poisongem",
  "protectiongem",
  "soulgem",
  "stormgem",
];
export const BOSS_ORB_ITEM_IDS = [
  "accuracyorb",
  "agilityorb",
  "braveryorb",
  "disillusionorb",
  "enduranceorb",
  "evilslayerorb",
  "freezingorb",
  "magicorb",
  "poisonorb",
  "protectionorb",
  "soulorb",
  "stormorb",
];
export function bossGemDrops(chance = 0.05) {
  return BOSS_GEM_ITEM_IDS.map((id) => ({ id, chance }));
}
export function bossOrbDrops(chance = 0.01) {
  return BOSS_ORB_ITEM_IDS.map((id) => ({ id, chance }));
}

export const WOMA_TAURUS_BOSS_DROPS = {
  gold: 20000,
  items: [
    { id: "wooma-heart", chance: 0.1 },
    { id: "awakening-soul", chance: 0.1 },
    { id: "great-axe", chance: 0.3 },
    { id: "mage-staff", chance: 0.3 },
    { id: "serpent-sword", chance: 0.3 },
    { id: "dragon-sword", chance: 1 / 55 },
    { id: "dcstone-l", chance: 0.2 },
    { id: "mcstone-l", chance: 0.2 },
    { id: "scstone-l", chance: 0.2 },
    { id: "expel-ring", chance: 0.2 },
    { id: "spell-bracelet", chance: 0.2 },
    { id: "black-iron-bracelet", chance: 0.2 },
    { id: "book-frost-crunch", chance: 0.2 },
    { id: "book-half-moon", chance: 0.1 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const INCARNATED_WT_BOSS_DROPS = {
  gold: 20000,
  items: [
    { id: "awakening-soul", chance: 0.2 },
    { id: "black-dragon-slayer", chance: 1 / 10 },
    { id: "black-dragon-staff", chance: 1 / 10 },
    { id: "black-dragon-soul-sabre", chance: 1 / 10 },
    { id: "skeleton-helmet", chance: 1 / 10 },
    { id: "heaven-armour", chance: 0.05 },
    { id: "steel-armour", chance: 0.05 },
    { id: "titan-armour", chance: 0.05 },
    { id: "dragon-robe", chance: 0.05 },
    { id: "claw-necklace", chance: 0.1 },
    { id: "pearl-necklace", chance: 0.1 },
    { id: "life-necklace", chance: 0.1 },
    { id: "spirit-necklace", chance: 0.1 },
    { id: "gale-necklace", chance: 0.1 },
    { id: "green-bead", chance: 0.05 },
    { id: "demonic-bells", chance: 0.05 },
    { id: "soul-necklace", chance: 0.05 },
    { id: "knight-bracelet", chance: 0.05 },
    { id: "soul-spring-bracelet", chance: 0.05 },
    { id: "dragon-bracelet", chance: 0.05 },
    { id: "dragon-ring", chance: 0.1 },
    { id: "ruby-ring", chance: 0.1 },
    { id: "platinum-ring", chance: 0.1 },
    { id: "spirit-ring", chance: 0.05 },
    { id: "power-ring", chance: 0.05 },
    { id: "violet-ring", chance: 0.05 },
    { id: "titan-ring", chance: 0.05 },
    { id: "judgement-mace", chance: 0.05 },
    { id: "war-mage-staff", chance: 0.05 },
    { id: "soul-spring-wand", chance: 0.05 },
    { id: "war-spirit-blade", chance: 0.06 },
    { id: "magic-scythe", chance: 0.06 },
    { id: "stone-bamboo-fan", chance: 0.06 },
    { id: "black-iron-helmet", chance: 0.05 },
    { id: "dragon-slayer", chance: 0.025 },
    { id: "dragon-staff", chance: 0.025 },
    { id: "soul-sabre", chance: 0.025 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const EVIL_SNAKE_BOSS_DROPS = {
  gold: 20000,
  items: [
    { id: "awakening-soul", chance: 0.1 },
    { id: "great-axe", chance: 0.3 },
    { id: "mage-staff", chance: 0.3 },
    { id: "serpent-sword", chance: 0.3 },
    { id: "dragon-sword", chance: 1 / 150 },
    { id: "dcstone-l", chance: 0.2 },
    { id: "mcstone-l", chance: 0.2 },
    { id: "scstone-l", chance: 0.2 },
    { id: "expel-ring", chance: 0.2 },
    { id: "spell-bracelet", chance: 0.2 },
    { id: "black-iron-bracelet", chance: 0.2 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const ZUMA_TAURUS_BOSS_DROPS = {
  gold: 20000,
  items: [
    { id: "zuma-relic", chance: 0.1 },
    { id: "awakening-soul", chance: 0.2 },
    { id: "book-twin-drake-blade", chance: 0.1 },
    { id: "zuma-judgement-mace", chance: 1 / 10 },
    { id: "zuma-war-mage-staff", chance: 1 / 10 },
    { id: "zuma-soul-spring-wand", chance: 1 / 10 },
    { id: "skeleton-helmet", chance: 1 / 10 },
    { id: "iron-armour", chance: 0.05 },
    { id: "wizard-robe", chance: 0.05 },
    { id: "pearl-armour", chance: 0.05 },
    { id: "claw-necklace", chance: 0.1 },
    { id: "pearl-necklace", chance: 0.1 },
    { id: "life-necklace", chance: 0.1 },
    { id: "spirit-necklace", chance: 0.1 },
    { id: "gale-necklace", chance: 0.1 },
    { id: "green-bead", chance: 0.05 },
    { id: "demonic-bells", chance: 0.05 },
    { id: "soul-necklace", chance: 0.05 },
    { id: "knight-bracelet", chance: 0.05 },
    { id: "soul-spring-bracelet", chance: 0.05 },
    { id: "dragon-bracelet", chance: 0.05 },
    { id: "dragon-ring", chance: 0.1 },
    { id: "ruby-ring", chance: 0.1 },
    { id: "platinum-ring", chance: 0.1 },
    { id: "spirit-ring", chance: 0.05 },
    { id: "power-ring", chance: 0.05 },
    { id: "violet-ring", chance: 0.05 },
    { id: "titan-ring", chance: 0.05 },
    { id: "judgement-mace", chance: 0.05 },
    { id: "war-mage-staff", chance: 0.05 },
    { id: "soul-spring-wand", chance: 0.05 },
    { id: "war-spirit-blade", chance: 0.06 },
    { id: "magic-scythe", chance: 0.06 },
    { id: "stone-bamboo-fan", chance: 0.06 },
    { id: "black-iron-helmet", chance: 0.05 },
    { id: "dragon-slayer", chance: 0.025 },
    { id: "dragon-staff", chance: 0.025 },
    { id: "soul-sabre", chance: 0.025 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const EVIL_CENTIPEDE_BOSS_DROPS = {
  gold: 12500,
  items: [
    { id: "book-ultimate-enhancer", chance: 0.15 },
    { id: "dragon-sword", chance: 1 / 25 },
    { id: "awakening-soul", chance: 0.2 },
    { id: "great-axe", chance: 1 / 20 },
    { id: "mage-staff", chance: 1 / 20 },
    { id: "serpent-sword", chance: 1 / 20 },
    { id: "skeleton-helmet", chance: 1 / 20 },
    { id: "claw-necklace", chance: 0.05 },
    { id: "pearl-necklace", chance: 0.05 },
    { id: "life-necklace", chance: 0.05 },
    { id: "spirit-necklace", chance: 0.05 },
    { id: "gale-necklace", chance: 0.05 },
    { id: "green-bead", chance: 0.025 },
    { id: "demonic-bells", chance: 0.025 },
    { id: "soul-necklace", chance: 0.025 },
    { id: "knight-bracelet", chance: 0.025 },
    { id: "soul-spring-bracelet", chance: 0.025 },
    { id: "dragon-bracelet", chance: 0.025 },
    { id: "dragon-ring", chance: 0.05 },
    { id: "ruby-ring", chance: 0.05 },
    { id: "platinum-ring", chance: 0.05 },
    { id: "spirit-ring", chance: 0.025 },
    { id: "power-ring", chance: 0.025 },
    { id: "violet-ring", chance: 0.025 },
    { id: "titan-ring", chance: 0.025 },
    { id: "judgement-mace", chance: 0.05 },
    { id: "war-mage-staff", chance: 0.05 },
    { id: "soul-spring-wand", chance: 0.05 },
    { id: "black-iron-helmet", chance: 0.025 },
    { id: "dragon-slayer", chance: 0.025 },
    { id: "dragon-staff", chance: 0.025 },
    { id: "soul-sabre", chance: 0.025 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const BONE_LORD_BOSS_DROPS = {
  gold: 16000,
  items: [
    { id: "book-summon-shinsu", chance: 0.1 },
    { id: "awakening-soul", chance: 0.15 },
    { id: "judgement-mace", chance: 0.07 },
    { id: "war-mage-staff", chance: 0.07 },
    { id: "soul-spring-wand", chance: 0.07 },
    { id: "war-spirit-blade", chance: 0.03 },
    { id: "magic-scythe", chance: 0.03 },
    { id: "stone-bamboo-fan", chance: 0.03 },
    { id: "skeleton-helmet", chance: 1 / 15 },
    { id: "black-iron-helmet", chance: 0.04 },
    { id: "iron-armour", chance: 0.05 },
    { id: "wizard-robe", chance: 0.05 },
    { id: "pearl-armour", chance: 0.05 },
    { id: "claw-necklace", chance: 0.08 },
    { id: "pearl-necklace", chance: 0.08 },
    { id: "life-necklace", chance: 0.08 },
    { id: "spirit-necklace", chance: 0.08 },
    { id: "gale-necklace", chance: 0.07 },
    { id: "green-bead", chance: 0.04 },
    { id: "demonic-bells", chance: 0.04 },
    { id: "soul-necklace", chance: 0.04 },
    { id: "knight-bracelet", chance: 0.04 },
    { id: "soul-spring-bracelet", chance: 0.04 },
    { id: "dragon-bracelet", chance: 0.04 },
    { id: "dragon-ring", chance: 0.08 },
    { id: "ruby-ring", chance: 0.08 },
    { id: "platinum-ring", chance: 0.08 },
    { id: "spirit-ring", chance: 0.04 },
    { id: "power-ring", chance: 0.04 },
    { id: "violet-ring", chance: 0.04 },
    { id: "titan-ring", chance: 0.04 },
    { id: "death-gauntlet", chance: 0.03 },
    { id: "smash-wheel", chance: 0.025 },
    { id: "smash-ring", chance: 0.025 },
    { id: "dragon-slayer", chance: 0.025 },
    { id: "dragon-staff", chance: 0.025 },
    { id: "soul-sabre", chance: 0.025 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const KING_SCORPION_BOSS_DROPS = {
  gold: 16000,
  items: [
    { id: "awakening-soul", chance: 0.15 },
    { id: "judgement-mace", chance: 0.07 },
    { id: "war-mage-staff", chance: 0.07 },
    { id: "soul-spring-wand", chance: 0.07 },
    { id: "war-spirit-blade", chance: 0.03 },
    { id: "magic-scythe", chance: 0.03 },
    { id: "stone-bamboo-fan", chance: 0.03 },
    { id: "skeleton-helmet", chance: 1 / 15 },
    { id: "black-iron-helmet", chance: 0.04 },
    { id: "iron-armour", chance: 0.05 },
    { id: "wizard-robe", chance: 0.05 },
    { id: "pearl-armour", chance: 0.05 },
    { id: "claw-necklace", chance: 0.08 },
    { id: "pearl-necklace", chance: 0.08 },
    { id: "life-necklace", chance: 0.08 },
    { id: "spirit-necklace", chance: 0.08 },
    { id: "gale-necklace", chance: 0.07 },
    { id: "green-bead", chance: 0.04 },
    { id: "demonic-bells", chance: 0.04 },
    { id: "soul-necklace", chance: 0.04 },
    { id: "knight-bracelet", chance: 0.04 },
    { id: "soul-spring-bracelet", chance: 0.04 },
    { id: "dragon-bracelet", chance: 0.04 },
    { id: "dragon-ring", chance: 0.08 },
    { id: "ruby-ring", chance: 0.08 },
    { id: "platinum-ring", chance: 0.08 },
    { id: "spirit-ring", chance: 0.04 },
    { id: "power-ring", chance: 0.04 },
    { id: "violet-ring", chance: 0.04 },
    { id: "titan-ring", chance: 0.04 },
    { id: "death-gauntlet", chance: 0.03 },
    { id: "smash-wheel", chance: 0.025 },
    { id: "smash-ring", chance: 0.025 },
    { id: "dragon-sword", chance: 1 / 70 },
    { id: "black-dragon-slayer", chance: 0.025 },
    { id: "black-dragon-staff", chance: 0.025 },
    { id: "black-dragon-soul-sabre", chance: 0.025 },
    { id: "book-ice-storm", chance: 0.1 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const OMA_KING_SPIRIT_BOSS_DROPS = {
  gold: 35000,
  benedictionOils: 2,
  items: [
    { id: "awakening-soul", chance: 0.5 },
    { id: "oma-spirit-ring", chance: 0.2 },
    { id: "oma-king-robe", chance: 0.03 },
    { id: "heaven-sword", chance: 0.005 },
    { id: "heaven-armour", chance: 0.005 },
    { id: "sword-of-war-god", chance: 0.03 },
    { id: "blade-of-sorcery", chance: 0.03 },
    { id: "dragon-slayer", chance: 0.06 },
    { id: "dragon-staff", chance: 0.06 },
    { id: "soul-sabre", chance: 0.06 },
    { id: "judgement-mace", chance: 0.15 },
    { id: "war-mage-staff", chance: 0.15 },
    { id: "soul-spring-wand", chance: 0.15 },
    { id: "war-spirit-blade", chance: 0.15 },
    { id: "magic-scythe", chance: 0.15 },
    { id: "stone-bamboo-fan", chance: 0.15 },
    { id: "steel-armour", chance: 0.1 },
    { id: "dragon-robe", chance: 0.1 },
    { id: "titan-armour", chance: 0.1 },
    { id: "skeleton-helmet", chance: 0.08 },
    { id: "black-iron-helmet", chance: 0.05 },
    { id: "shaman-helmet", chance: 0.05 },
    { id: "brass-helmet", chance: 0.04 },
    { id: "death-gauntlet", chance: 0.05 },
    { id: "claw-necklace", chance: 0.08 },
    { id: "pearl-necklace", chance: 0.08 },
    { id: "life-necklace", chance: 0.08 },
    { id: "spirit-necklace", chance: 0.08 },
    { id: "gale-necklace", chance: 0.07 },
    { id: "green-bead", chance: 0.05 },
    { id: "demonic-bells", chance: 0.05 },
    { id: "soul-necklace", chance: 0.05 },
    { id: "knight-bracelet", chance: 0.06 },
    { id: "soul-spring-bracelet", chance: 0.06 },
    { id: "dragon-bracelet", chance: 0.06 },
    { id: "dragon-ring", chance: 0.08 },
    { id: "ruby-ring", chance: 0.08 },
    { id: "platinum-ring", chance: 0.08 },
    { id: "power-ring", chance: 0.06 },
    { id: "titan-ring", chance: 0.06 },
    { id: "violet-ring", chance: 0.06 },
    { id: "spirit-ring", chance: 0.06 },
    { id: "expel-ring", chance: 0.06 },
    { id: "gale-ring", chance: 0.05 },
    { id: "impact-drug-m", chance: 0.12 },
    { id: "magic-drug-m", chance: 0.12 },
    { id: "taoist-drug-m", chance: 0.12 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const KING_HOG_BOSS_DROPS = {
  gold: 35000,
  benedictionOils: 2,
  items: [
    { id: "awakening-soul", chance: 0.75 },
    { id: "oma-spirit-ring", chance: 0.2 },
    { id: "heaven-sword", chance: 0.005 },
    { id: "heaven-armour", chance: 0.005 },
    { id: "sword-of-war-god", chance: 0.03 },
    { id: "blade-of-sorcery", chance: 0.03 },
    { id: "dragon-slayer", chance: 0.06 },
    { id: "dragon-staff", chance: 0.06 },
    { id: "soul-sabre", chance: 0.06 },
    { id: "judgement-mace", chance: 0.15 },
    { id: "war-mage-staff", chance: 0.15 },
    { id: "soul-spring-wand", chance: 0.15 },
    { id: "war-spirit-blade", chance: 0.15 },
    { id: "magic-scythe", chance: 0.15 },
    { id: "stone-bamboo-fan", chance: 0.15 },
    { id: "steel-armour", chance: 0.1 },
    { id: "dragon-robe", chance: 0.1 },
    { id: "titan-armour", chance: 0.1 },
    { id: "skeleton-helmet", chance: 0.08 },
    { id: "black-iron-helmet", chance: 0.05 },
    { id: "shaman-helmet", chance: 0.05 },
    { id: "brass-helmet", chance: 0.04 },
    { id: "death-gauntlet", chance: 0.05 },
    { id: "claw-necklace", chance: 0.08 },
    { id: "pearl-necklace", chance: 0.08 },
    { id: "life-necklace", chance: 0.08 },
    { id: "spirit-necklace", chance: 0.08 },
    { id: "gale-necklace", chance: 0.07 },
    { id: "green-bead", chance: 0.05 },
    { id: "demonic-bells", chance: 0.05 },
    { id: "soul-necklace", chance: 0.05 },
    { id: "knight-bracelet", chance: 0.06 },
    { id: "soul-spring-bracelet", chance: 0.06 },
    { id: "dragon-bracelet", chance: 0.06 },
    { id: "dragon-ring", chance: 0.08 },
    { id: "ruby-ring", chance: 0.08 },
    { id: "platinum-ring", chance: 0.08 },
    { id: "power-ring", chance: 0.06 },
    { id: "titan-ring", chance: 0.06 },
    { id: "violet-ring", chance: 0.06 },
    { id: "spirit-ring", chance: 0.06 },
    { id: "expel-ring", chance: 0.06 },
    { id: "gale-ring", chance: 0.05 },
    { id: "impact-drug-m", chance: 0.12 },
    { id: "magic-drug-m", chance: 0.12 },
    { id: "taoist-drug-m", chance: 0.12 },
    ...bossGemDrops(0.1),
    ...bossOrbDrops(0.02),
  ],
};
export const DARK_DEVIL_BOSS_DROPS = {
  gold: 45000,
  benedictionOils: 3,
  items: [
    { id: "awakening-soul", chance: 0.85 },
    { id: "oma-spirit-ring", chance: 0.25 },
    { id: "heaven-sword", chance: 0.008 },
    { id: "heaven-armour", chance: 0.008 },
    { id: "sword-of-war-god", chance: 0.04 },
    { id: "blade-of-sorcery", chance: 0.04 },
    { id: "dragon-slayer", chance: 0.08 },
    { id: "dragon-staff", chance: 0.08 },
    { id: "soul-sabre", chance: 0.08 },
    { id: "judgement-mace", chance: 0.18 },
    { id: "war-mage-staff", chance: 0.18 },
    { id: "soul-spring-wand", chance: 0.18 },
    { id: "war-spirit-blade", chance: 0.18 },
    { id: "magic-scythe", chance: 0.18 },
    { id: "stone-bamboo-fan", chance: 0.18 },
    { id: "steel-armour", chance: 0.12 },
    { id: "dragon-robe", chance: 0.12 },
    { id: "titan-armour", chance: 0.12 },
    { id: "skeleton-helmet", chance: 0.1 },
    { id: "black-iron-helmet", chance: 0.06 },
    { id: "shaman-helmet", chance: 0.06 },
    { id: "brass-helmet", chance: 0.05 },
    { id: "death-gauntlet", chance: 0.06 },
    { id: "claw-necklace", chance: 0.1 },
    { id: "pearl-necklace", chance: 0.1 },
    { id: "life-necklace", chance: 0.1 },
    { id: "spirit-necklace", chance: 0.1 },
    { id: "gale-necklace", chance: 0.08 },
    { id: "green-bead", chance: 0.06 },
    { id: "demonic-bells", chance: 0.06 },
    { id: "soul-necklace", chance: 0.06 },
    { id: "knight-bracelet", chance: 0.08 },
    { id: "soul-spring-bracelet", chance: 0.08 },
    { id: "dragon-bracelet", chance: 0.08 },
    { id: "dragon-ring", chance: 0.1 },
    { id: "ruby-ring", chance: 0.1 },
    { id: "platinum-ring", chance: 0.1 },
    { id: "power-ring", chance: 0.08 },
    { id: "titan-ring", chance: 0.08 },
    { id: "violet-ring", chance: 0.08 },
    { id: "spirit-ring", chance: 0.08 },
    { id: "expel-ring", chance: 0.08 },
    { id: "gale-ring", chance: 0.06 },
    { id: "impact-drug-m", chance: 0.15 },
    { id: "magic-drug-m", chance: 0.15 },
    { id: "taoist-drug-m", chance: 0.15 },
    ...bossGemDrops(0.12),
    ...bossOrbDrops(0.025),
  ],
};
export const MINOTAUR_KING_BOSS_DROPS = {
  gold: 25000,
  items: [
    { id: "awakening-soul", chance: 0.22 },
    { id: "sword-of-war-god", chance: 0.01 },
    { id: "blade-of-sorcery", chance: 0.01 },
    { id: "heaven-sword", chance: 0.01 },
    { id: "steel-armour", chance: 0.06 },
    { id: "dragon-robe", chance: 0.06 },
    { id: "titan-armour", chance: 0.06 },
    { id: "dragon-slayer", chance: 0.03 },
    { id: "dragon-staff", chance: 0.03 },
    { id: "soul-sabre", chance: 0.03 },
    { id: "war-spirit-blade", chance: 0.05 },
    { id: "magic-scythe", chance: 0.05 },
    { id: "stone-bamboo-fan", chance: 0.05 },
    { id: "skeleton-helmet", chance: 0.08 },
    { id: "black-iron-helmet", chance: 0.05 },
    { id: "death-gauntlet", chance: 0.05 },
    { id: "claw-necklace", chance: 0.1 },
    { id: "pearl-necklace", chance: 0.1 },
    { id: "life-necklace", chance: 0.1 },
    { id: "spirit-necklace", chance: 0.1 },
    { id: "gale-necklace", chance: 0.08 },
    { id: "green-bead", chance: 0.05 },
    { id: "demonic-bells", chance: 0.05 },
    { id: "soul-necklace", chance: 0.05 },
    { id: "knight-bracelet", chance: 0.05 },
    { id: "soul-spring-bracelet", chance: 0.05 },
    { id: "dragon-bracelet", chance: 0.05 },
    { id: "dragon-ring", chance: 0.1 },
    { id: "ruby-ring", chance: 0.1 },
    { id: "platinum-ring", chance: 0.1 },
    { id: "spirit-ring", chance: 0.05 },
    { id: "power-ring", chance: 0.05 },
    { id: "violet-ring", chance: 0.05 },
    { id: "titan-ring", chance: 0.05 },
    { id: "impact-drug-m", chance: 0.12 },
    { id: "magic-drug-m", chance: 0.12 },
    { id: "taoist-drug-m", chance: 0.12 },
    ...bossGemDrops(0.05),
    ...bossOrbDrops(0.01),
  ],
};
export const BOSS_DROP_TABLE_BY_LABEL = {
  "Wooma Taurus": WOMA_TAURUS_BOSS_DROPS,
  "Incarnated Wooma Taurus": INCARNATED_WT_BOSS_DROPS,
  "Incarnated Zuma Taurus": ZUMA_TAURUS_BOSS_DROPS,
  "Evil Snake": EVIL_SNAKE_BOSS_DROPS,
  "Zuma Taurus": ZUMA_TAURUS_BOSS_DROPS,
  "Evil Centipede": EVIL_CENTIPEDE_BOSS_DROPS,
  "Bone Lord": BONE_LORD_BOSS_DROPS,
  "King Scorpion": KING_SCORPION_BOSS_DROPS,
  "Minotaur King": MINOTAUR_KING_BOSS_DROPS,
  "Oma King Spirit": OMA_KING_SPIRIT_BOSS_DROPS,
  "King Hog": KING_HOG_BOSS_DROPS,
  "Dark Devil": DARK_DEVIL_BOSS_DROPS,
};
export const RED_THUNDER_ZUMA_ENEMY_ID = 271;
export const ZUMA_TAURUS_ENEMY_ID = 272;
export const BONE_LORD_ENEMY_ID = 279;
export const MINOTAUR_KING_ENEMY_ID = 287;
export const OMA_KING_SPIRIT_ENEMY_ID = 291;
export const KING_HOG_ENEMY_ID = 316;
export const DARK_DEVIL_ENEMY_ID = 319;
export const MINOTAUR_KING_AOE_EVERY_N_ATTACKS = 5;
export const PRAJNA_GUARD_ENEMY_IDS = new Set([285, 286]);
export const RED_THUNDER_ZUMA_ZUMA_WEAPON_CHANCE = 0.02;
export const RED_THUNDER_ZUMA_BONUS_WEAPON_CHANCE = 0.012;
export const ZUMA_THUNDER_GUARANTEED_DROP_IDS = [
  "platinum-necklace",
  "blue-jade-necklace",
  "convex-lens",
  "bamboo-pipe",
  "moral-ring",
  "iron-ring",
  "charm-ring",
  "skeleton-ring",
  "coral-ring",
  "sun-potion",
  "sun-potion-medium",
  "iron-armour",
  "wizard-robe",
  "pearl-armour",
  "skeleton-helmet",
  "shaman-helmet",
  "dcstone-xl",
  "mcstone-xl",
  "scstone-xl",
];
export const RED_THUNDER_ZUMA_BONUS_WEAPON_IDS = ["great-axe", "mage-staff", "serpent-sword"];
export const RED_THUNDER_ZUMA_ZUMA_WEAPON_IDS = [
  "zuma-judgement-mace",
  "zuma-war-mage-staff",
  "zuma-soul-spring-wand",
];
export const SKILL_BOOK_BOSS_DROP_BY_ITEM_ID = Object.fromEntries(
  Object.entries(BOSS_DROP_TABLE_BY_LABEL).flatMap(([label, table]) => (
    table.items
      .filter((entry) => String(entry.id).startsWith("book-"))
      .map((entry) => [entry.id, label])
  )),
);
export const BENEDICTION_MAX_WEAPON_LUCK = 7;
export const BENEDICTION_CURSE_CHANCE = 5;
export const SMITH_COMBINE_SUCCESS_CHANCES = [0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
export const SMITH_DEFENSIVE_UPGRADE_SLOTS = new Set(["armour", "belt", "boots", "boot", "shoes", "shoe", "helmet"]);
export const SMITH_RANDOM_TRIPLE_STAT = "__random_triple__";
export const WEAPON_REFINE_MAX = 10;
export const ORE_PURITY_UNIT = 1000;
export const ORE_ITEM_IDS = new Set(["gold-ore", "silver-ore", "copper-ore", "black-iron-ore"]);
export const REFINER_ORE_ITEM_ID = "black-iron-ore";
export const WEAPON_REFINE_ORE_SLOTS = 5;
export const WEAPON_REFINE_MATERIAL_SLOTS = 5;
export const REFINE_JEWELLERY_SLOTS = new Set(["ring", "bracelet", "necklace", "amulet"]);
export const WEAPON_REFINE_STAT_INCREASE = 1;
export const WEAPON_REFINE_CRIT_CHANCE = 10;
export const WEAPON_REFINE_CRIT_MULTIPLIER = 2;
export const WEAPON_REFINE_EXISTING_STAT_PENALTY = 6;
export const WEAPON_REFINE_EXISTING_STAT_PENALTY_CAP = 50;
export const WEAPON_REFINE_PENALTY_FROM_LEVEL = 5;
export const WEAPON_REFINE_MAX_CHANCE = 100;
// Jewellery success uses tiered rates on the winning DC/MC/SC total (see weaponRefineItemSuccessFromStat).
export const WEAPON_REFINE_ITEM_TIER1_STAT = 20;
export const WEAPON_REFINE_ITEM_TIER1_RATE = 1;
export const WEAPON_REFINE_ITEM_TIER2_STAT = 20;
export const WEAPON_REFINE_ITEM_TIER2_RATE = 2;
export const WEAPON_REFINE_ITEM_TIER3_RATE = 0.5;
export const WEAPON_REFINE_ITEM_SUCCESS_CAP = 50;
export const WEAPON_REFINE_ORE_PER_PIECE = 2;
export const WEAPON_REFINE_PURITY_PER_POINT = 1;
export const WEAPON_REFINE_ORE_SUCCESS_CAP = 50;
export const WEAPON_REFINE_RESULT_FX_MS = 1100;
export const WEAPON_REFINE_GOLD_PER_LEVEL = 50000;

export function createDefaultWeaponRefineState() {
  return {
    weaponEntryId: null,
    oreEntryIds: Array(WEAPON_REFINE_ORE_SLOTS).fill(null),
    materialEntryIds: Array(WEAPON_REFINE_MATERIAL_SLOTS).fill(null),
    stagedEntries: {},
    picker: { kind: "weapon", index: 0 },
    resultFx: null,
    resultFxTimer: null,
  };
}

export const MINING_ZONE_ID = "zone-bichon-mine";
export const MINING_PICKAXE_WEAPON_INDEX = 42;
// Crystal mine uses attack2/mine frames (6 x 100ms), then Stance until StanceDelay (2500ms).
// Idle uses COMBAT_STANCE_HOLD_MS (1000ms) between swings.
export const MINING_SWING_MS = 600;
export const MINING_SWING_CYCLE_MS = MINING_SWING_MS + COMBAT_STANCE_HOLD_MS;
// Base ore find rate per swing (1 in 10); upgradeable later.
export const MINING_HIT_CHANCE = 0.1;
export const MINING_TOTAL_SLOTS = 120;
// Slot roll 1–120 on each successful hit (~10% of swings). Copper is highest, but only slightly.
export const MINING_ORE_DROPS = [
  { itemId: "gold-ore", minSlot: 1, maxSlot: 28 },
  { itemId: "silver-ore", minSlot: 29, maxSlot: 57 },
  { itemId: "black-iron-ore", minSlot: 58, maxSlot: 86 },
  { itemId: "copper-ore", minSlot: 87, maxSlot: 120 },
];
export const AUTO_POTION_THRESHOLD = 0.5;
export const AUTO_POTION_COOLDOWN_MS = 1000;
export const CRYSTAL_MAGIC_RESIST_WEIGHT = 10;

export const LANE = {
  playerScreenX: 150,
  y: 0.78,
  spawnMargin: 100,
  respawnDelayMs: 1400,
  playerSpeed: WALK_SPEED,
  runSpeed: RUN_SPEED,
  enemySpeed: WALK_SPEED,
  tileScrollRatio: 1,
  aggroRange: 170,
  warriorRange: 52,
  wizardRange: 148,
  enemyRange: 48,
};
export const THRUSTING_RANGE = LANE_TILE_PX * 2 + 4;
export const TAOIST_PET_SUMMON_MIN_GAP = 16;
export const TAOIST_PET_ENEMY_GAP = LANE.enemyRange - 4;
export const TAOIST_VISIBLE_RANGE_MARGIN = 72;
export const TAOIST_SOUL_FIRE_BALL_LANE_RANGE = LANE_TILE_PX * 6;
export const TAOIST_SUMMON_SKELETON_LANE_RANGE = LANE_TILE_PX * 5;

export function playerScreenX() {
  if (!IS_GAME_UI) return LANE.playerScreenX;
  return Math.round(state.stageWidth * 0.5);
}

export const DEFAULT_ZONE_PATTERN = [
  [0, 2, 1, 4, 0, 3, 2, 1, 0, 4, 3, 1],
  [3, 1, 4, 2, 0, 1, 3, 4, 2, 0, 1, 4],
  [1, 0, 2, 3, 1, 4, 0, 2, 3, 1, 4, 0],
  [4, 2, 0, 1, 3, 2, 4, 0, 1, 3, 2, 0],
  [2, 4, 3, 0, 1, 4, 2, 3, 0, 1, 4, 2],
];

export const ZONE_DECORATION_SET = "wemade-mir2-custom-objects";
export const ZONE_OBJECT_EMPTY = -1;
export const DEFAULT_OBJECT_PATTERN_ROWS = 3;
export const DEFAULT_OBJECT_PATTERN_COLS = 24;
export const DEFAULT_ZONE_DECORATIONS = [
  { id: "mir2-pair-1123-1124", slots: [0, 1], frames: [1123, 1124], worldX: 470, row: 0, repeatEvery: 720 },
  { id: "mir2-pair-1034-1035", slots: [2, 3], frames: [1034, 1035], worldX: 830, row: 0, repeatEvery: 720 },
];

export const CAVE_EDGE_SETS = {
  "oma-cave-selected": {
    skipTopGroundRows: 1,
    top: {
      src: "./public/mapedges/oma-cave-top-edge.png",
      yOffsetFromBase: -372,
      clipBottomOffsetFromBase: -30,
      scrollRatio: 1,
    },
  },
};

export const PROTOTYPE_ZONES = PHASE1_ZONES;
export const TELEPORT_REGIONS = [
  {
    id: "bicheon-province",
    label: "Bicheon Province",
    zoneIds: [
      "zone-bicheon-1",
      "zone-bicheon-2",
      "zone-bicheon-3",
      "zone-bone-cave-1",
      "zone-bone-cave-2",
      "zone-bone-cave-kr",
      "zone-dead-mines-1",
      "zone-dead-mines-2",
      "zone-dead-mines-kr",
      "zone-kings-tomb",
    ],
  },
  {
    id: "woomyon-woods",
    label: "Woomyon Woods",
    zoneIds: [
      "zone-insect-cave-1",
      "zone-insect-cave-2",
      "zone-insect-cave-kr",
      "zone-wooma-temple-1",
      "zone-wooma-temple-2",
      "zone-wooma-temple-kr",
    ],
  },
  {
    id: "mongchon-province",
    label: "Mongchon Province",
    zoneIds: [
      "zone-bug-cave-1",
      "zone-bug-cave-2",
      "zone-bug-cave-kr",
      "zone-stone-temple-1",
      "zone-stone-temple-2",
      "zone-stone-temple-kr",
      "zone-zuma-temple-1",
      "zone-zuma-temple-2",
      "zone-zuma-temple-kr",
    ],
  },
  {
    id: "prajna-island",
    label: "Prajna Island",
    zoneIds: [
      "zone-prajna-cave-1",
      "zone-prajna-cave-2",
      "zone-prajna-cave-kr",
      "zone-prajna-temple-1",
      "zone-prajna-temple-2",
      "zone-prajna-temple-kr",
    ],
  },
  {
    id: "castle-gi-ryoong",
    label: "Castle Gi-Ryoong",
    zoneIds: [
      "zone-bdd-1",
      "zone-bdd-2",
      "zone-bdd-3",
      "zone-bdd-4",
      "zone-bdd-5",
      "zone-bdd-6",
      "zone-bdd-7",
      "zone-bdd-8",
      "zone-bdd-10",
      "zone-bdd-11",
      "zone-bdd-12",
      "zone-bdd-13",
    ],
  },
  {
    id: "extended-boss-lab",
    label: "Extended Boss Lab",
    zoneIds: [
      "zone-manectric-king-kr",
      "zone-flame-queen-kr",
      "zone-flaming-mutant-kr",
      "zone-scaly-beast-kr",
      "zone-lab-stone-colossus",
      "zone-lab-overseer",
      "zone-lab-halberd-lord",
      "zone-lab-white-boar",
    ],
  },
];
export const DEFAULT_TELEPORT_REGION_ID = TELEPORT_REGIONS[0].id;

export const TOWN_VISUALS = {
  mapStamp: "bicheon-wall-center",
  backdrop: "field",
  mapStampOffsetY: 0,
  mapStampBottomPadding: 8,
  mapStampViewUpTiles: 0,
  npcOffsetXTiles: -3,
  stageMinHeight: 360,
  stageMaxHeight: 480,
};

export const MAP_STAMP_ASSET_VERSION = "20260619-bdd-dark-devil-27-34";
export const MONSTER_ASSET_VERSION = "20260619-dark-devil-77";

export const TOWN_NPCS = [
  {
    id: "test-shopkeeper",
    label: "Alchemist Samuel",
    role: "Shop",
    sprite: "shopkeeper",
    x: 0.58,
    y: 0.55,
    width: 56,
    height: 76,
  },
  {
    id: "trader",
    label: "Trader James",
    role: "Trader",
    sprite: "trader",
    x: 0.72,
    y: 0.55,
    width: 56,
    height: 76,
  },
  {
    id: "storage",
    label: "Storage Jake",
    role: "Storage",
    sprite: "storage",
    x: 0.84,
    y: 0.55,
    width: 56,
    height: 76,
    panel: "Store and withdraw account items.",
  },
  {
    id: "smith",
    label: "Blacksmith Vincent",
    role: "Smith",
    sprite: "smith",
    x: 0.28,
    y: 0.55,
    width: 52,
    height: 68,
    panel: "Combine duplicate equipment.",
  },
  {
    id: "refiner",
    label: "Blacksmith Bill",
    role: "Refiner",
    sprite: "refiner",
    x: 0.28,
    y: 0.55,
    yOffsetTiles: -2,
    width: 72,
    height: 84,
    panel: "Refine weapons and mine ore.",
  },
  {
    id: "teleport-stone",
    label: "Mysterious Stone",
    role: "Teleport",
    sprite: "teleport-stone",
    x: 0.43,
    y: 0.55,
    width: 80,
    height: 112,
    panel: "Teleport to any hunting zone.",
  },
  {
    id: "trainer",
    label: "Trainer",
    role: "Trainer",
    sprite: "teleporter",
    x: 0.28,
    y: 0.55,
    yOffsetTiles: 2,
    width: 84,
    height: 88,
    panel: "Enter the Bichon academy training room.",
  },
];

export const ALCHEMIST_STOCK_IDS = [
  "hp-drug-small",
  "mp-drug-small",
  "hp-drug-medium",
  "mp-drug-medium",
  "hp-drug-large",
  "mp-drug-large",
  "hp-drug-xl",
  "mp-drug-xl",
  "green-poison",
  "yellow-poison",
  "taoist-amulet",
];

export const COMBAT_CLASSES = [
  { id: "Warrior", label: "Warrior" },
  { id: "Wizard", label: "Wizard" },
  { id: "Taoist", label: "Taoist" },
];

export const CHARACTER_SELECT_CLASSES = [
  {
    id: "Warrior",
    label: "Warrior",
    role: "Weapon combat",
    image: "./public/ui/character-select/warrior.png",
  },
  {
    id: "Wizard",
    label: "Wizard",
    role: "Magic combat",
    image: "./public/ui/character-select/wizard.png",
  },
  {
    id: "Taoist",
    label: "Taoist",
    role: "Spirit combat",
    image: "./public/ui/character-select/taoist.png",
  },
];
export const CHARACTER_IDS = CHARACTER_SELECT_CLASSES.map((entry) => entry.id);

export const EQUIPMENT_SLOTS = [
  { id: "weapon", label: "Weapon" },
  { id: "armour", label: "Armour" },
  { id: "helmet", label: "Helmet" },
  { id: "torch", label: "Torch" },
  { id: "necklace", label: "Necklace" },
  { id: "braceletL", label: "Bracelet L" },
  { id: "braceletR", label: "Bracelet R" },
  { id: "ringL", label: "Ring L" },
  { id: "ringR", label: "Ring R" },
  { id: "amulet", label: "Amulet" },
  { id: "belt", label: "Belt" },
  { id: "boots", label: "Boots" },
  { id: "stone", label: "Stone" },
  { id: "mount", label: "Mount" },
];

export const CHARACTER_TABS = [
  { id: "character", label: "Character", slot: 0, x: 8 },
  { id: "status", label: "Status", slot: 1, x: 70 },
  { id: "state", label: "State", slot: 2, x: 132 },
  { id: "skill", label: "Skill", slot: 3, x: 194 },
];

export const CRYSTAL_EQUIPMENT_SLOT_POSITIONS = {
  weapon: { x: 123, y: 7 },
  armour: { x: 163, y: 7 },
  helmet: { x: 203, y: 7 },
  torch: { x: 203, y: 134 },
  necklace: { x: 203, y: 98 },
  braceletL: { x: 8, y: 170 },
  braceletR: { x: 203, y: 170 },
  ringL: { x: 8, y: 206 },
  ringR: { x: 203, y: 206 },
  amulet: { x: 8, y: 242 },
  boots: { x: 48, y: 242 },
  belt: { x: 88, y: 242 },
  stone: { x: 128, y: 242 },
  mount: { x: 203, y: 62 },
};

export const CHARACTER_PAPER_DOLL_FRAMES = {
  30: { src: "./public/ui/character/stateitem-30.png", x: 75, y: 186, w: 28, h: 57 },
  31: { src: "./public/ui/character/stateitem-31.png", x: 73, y: 179, w: 32, h: 67 },
  36: { src: "./public/ui/character/stateitem-36.png", x: 71, y: 172, w: 36, h: 74 },
  54: { src: "./public/ui/character/stateitem-54.png", x: 57, y: 139, w: 52, h: 115 },
  60: { src: "./public/ui/character/stateitem-60.png", x: 92, y: 194, w: 80, h: 128 },
  110: { src: "./public/ui/character/stateitem-110.png", x: 130, y: 172, w: 16, h: 20 },
  hair: { src: "./public/ui/character/hair-441.png", x: 131, y: 173, w: 16, h: 14 },
};

export const STATUS_VALUE_ROWS = [
  { label: "HP", key: "hp", x: 126, y: 20 },
  { label: "MP", key: "mp", x: 126, y: 38 },
  { label: "AC", key: "ac", x: 126, y: 56 },
  { label: "AMC", key: "amc", x: 126, y: 74 },
  { label: "DC", key: "dc", x: 126, y: 92 },
  { label: "MC", key: "mc", x: 126, y: 110 },
  { label: "SC", key: "sc", x: 126, y: 128 },
  { label: "Crit Rate", key: "critRate", x: 126, y: 146 },
  { label: "Crit Damage", key: "critDamage", x: 126, y: 164 },
  { label: "A Speed", key: "attackSpeed", x: 126, y: 182 },
  { label: "Acc", key: "accuracy", x: 126, y: 200 },
  { label: "Agi", key: "agility", x: 126, y: 218 },
  { label: "Luck", key: "luck", x: 126, y: 236 },
];

export const WIZARD_COMBAT_SPELL_META = {
  FireBall: {
    effectAnchor: "player",
    impactMode: "projectile",
    impactFlashMs: 600,
  },
  GreatFireBall: {
    effectAnchor: "player",
    impactMode: "projectile",
    impactFlashMs: 600,
  },
  ThunderBolt: {
    effectAnchor: "player",
    impactMode: "target",
    impactDelayMs: 500,
  },
  FireWall: {
    effectAnchor: "player",
    impactMode: "ground",
    impactDelayMs: 500,
    groundTickMs: 2000,
    groundWidthTiles: 3,
    groundDurationBaseMs: 10000,
    groundDurationPerPowerMs: 500,
  },
  FrostCrunch: {
    effectAnchor: "player",
    impactMode: "projectile",
    impactFlashMs: 600,
  },
  IceStorm: {
    effectAnchor: "player",
    impactMode: "bang",
    impactDelayMs: 500,
  },
  MagicShield: {
    effectAnchor: "player",
    impactMode: "buff",
    impactDelayMs: CRYSTAL_HEAL_APPLY_DELAY_MS,
  },
};
export const WIZARD_COMBAT_SPELLS = ["FireBall", "GreatFireBall", "ThunderBolt", "FireWall", "FrostCrunch", "IceStorm", "MagicShield"]
  .map((spellId) => {
    const spell = CRYSTAL_WIZARD_SPELLS.find((entry) => entry.id === spellId);
    return spell ? { ...spell, ...WIZARD_COMBAT_SPELL_META[spellId] } : null;
  })
  .filter(Boolean);
export const RETIRED_TEST_DEFAULT_WIZARD_SPELLS = new Set(["FireBall", "GreatFireBall", "ThunderBolt"]);
export const TAOIST_COMBAT_SPELL_META = {
  Healing: {
    effectAnchor: "player",
    impactMode: "heal",
    impactDelayMs: CRYSTAL_HEAL_APPLY_DELAY_MS,
  },
  Poisoning: {
    effectAnchor: "player",
    impactMode: "poison",
    impactDelayMs: CRYSTAL_POISON_APPLY_DELAY_MS,
  },
  SoulFireBall: {
    effectAnchor: "player",
    impactMode: "projectile",
    impactFlashMs: 600,
  },
  SummonSkeleton: {
    effectAnchor: "player",
    impactMode: "summon",
    impactDelayMs: CRYSTAL_SUMMON_SKELETON_DELAY_MS,
  },
  SummonShinsu: {
    effectAnchor: "player",
    impactMode: "summon",
    impactDelayMs: CRYSTAL_SUMMON_SHINSU_DELAY_MS,
  },
  SoulShield: {
    effectAnchor: "player",
    impactMode: "buff",
    impactDelayMs: CRYSTAL_HEAL_APPLY_DELAY_MS,
  },
  BlessedArmour: {
    effectAnchor: "player",
    impactMode: "buff",
    impactDelayMs: CRYSTAL_HEAL_APPLY_DELAY_MS,
  },
  UltimateEnhancer: {
    effectAnchor: "player",
    impactMode: "buff",
    impactDelayMs: CRYSTAL_HEAL_APPLY_DELAY_MS,
  },
};
export const TAOIST_COMBAT_SPELLS = ["Healing", "Poisoning", "SoulFireBall", "SummonSkeleton", "SummonShinsu", "SoulShield", "BlessedArmour", "UltimateEnhancer"]
  .map((spellId) => {
    const spell = CRYSTAL_TAOIST_SPELLS.find((entry) => entry.id === spellId);
    return spell ? { ...spell, ...TAOIST_COMBAT_SPELL_META[spellId] } : null;
  })
  .filter(Boolean);

export const BACKGROUND_MUSIC_TRACKS = [
  { id: "30001", label: "Map music 30001", src: "./public/audio/music/30001.wav" },
  { id: "30002", label: "Map music 30002", src: "./public/audio/music/30002.wav" },
  { id: "30003", label: "Map music 30003", src: "./public/audio/music/30003.wav" },
  { id: "30004", label: "Map music 30004", src: "./public/audio/music/30004.wav" },
  { id: "30005", label: "Map music 30005", src: "./public/audio/music/30005.wav" },
  { id: "30007", label: "Map music 30007", src: "./public/audio/music/30007.wav" },
  { id: "30008", label: "Map music 30008", src: "./public/audio/music/30008.wav" },
];
export const DEFAULT_MUSIC_VOLUME = 0.35;
export const DEFAULT_MUSIC_ENABLED = true;
export const MUSIC_SETTINGS_VERSION = 2;
export const MUSIC_MODE_PLAYLIST = "playlist";
export const MUSIC_MODE_TRACK = "track";
export const DEFAULT_SFX_ENABLED = true;
export const DEFAULT_SFX_VOLUME = 0.55;
export const SFX_POOL_SIZE = 4;
export const DEFAULT_PROTOTYPE_STATS_ENABLED = true;
export const STATS_NOTICE_VERSION = 1;
export const PROTOTYPE_RESET_NOTICE_VERSION = 1;
export const PROTOTYPE_RESET_NOTICE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const STATS_CONFIG_URL = "./public/stats/config.json";
export const STATS_PLAYER_ID_KEY = "lom-idle-v2-anonymous-player-id";
export const STATS_SUBMIT_INTERVAL_MS = 60 * 1000;



/** Expose game constants on globalThis so split modules match monolith scope. */
export function installConstants() {
  const g = globalThis;
  g.TESTING_XP_MULTIPLIER = TESTING_XP_MULTIPLIER;
  g.SPRITE_SETS = SPRITE_SETS;
  g.COMBAT_ANCHORS = COMBAT_ANCHORS;
  g.LANE_TILE_PX = LANE_TILE_PX;
  g.MAP_LANE_ROW_STEP = MAP_LANE_ROW_STEP;
  g.MAP_TILE_ANCHOR_ROW_STEP = MAP_TILE_ANCHOR_ROW_STEP;
  g.WALK_CYCLE_MS = WALK_CYCLE_MS;
  g.RUN_CYCLE_MS = RUN_CYCLE_MS;
  g.WALK_SPEED = WALK_SPEED;
  g.RUN_SPEED = RUN_SPEED;
  g.TRAVEL_WALK_DISTANCE = TRAVEL_WALK_DISTANCE;
  g.INVENTORY_PAGE_SIZE = INVENTORY_PAGE_SIZE;
  g.INVENTORY_BASE_SLOTS = INVENTORY_BASE_SLOTS;
  g.INVENTORY_MAX_SLOTS = INVENTORY_MAX_SLOTS;
  g.INVENTORY_PAGE_2_UNLOCK_COST = INVENTORY_PAGE_2_UNLOCK_COST;
  g.STORAGE_PAGE_SIZE = STORAGE_PAGE_SIZE;
  g.STORAGE_BASE_SLOTS = STORAGE_BASE_SLOTS;
  g.STORAGE_MAX_SLOTS = STORAGE_MAX_SLOTS;
  g.STORAGE_PAGE_2_UNLOCK_COST = STORAGE_PAGE_2_UNLOCK_COST;
  g.STORAGE_SLOT_COUNT = STORAGE_SLOT_COUNT;
  g.STORAGE_COLUMNS = STORAGE_COLUMNS;
  g.REBIRTH_ENABLED = REBIRTH_ENABLED;
  g.HOTBAR_SLOT_COUNT = HOTBAR_SLOT_COUNT;
  g.BASE_AUTOCAST_SLOTS = BASE_AUTOCAST_SLOTS;
  g.BASE_AUTO_POTION_SLOTS = BASE_AUTO_POTION_SLOTS;
  g.ACCOUNT_UPGRADE_CATEGORIES = ACCOUNT_UPGRADE_CATEGORIES;
  g.ACCOUNT_UPGRADE_DEFS = ACCOUNT_UPGRADE_DEFS;
  g.REBIRTH_BASE_STAT_UPGRADE_IDS = REBIRTH_BASE_STAT_UPGRADE_IDS;
  g.LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID = LEGACY_REBIRTH_BASE_STAT_UPGRADE_ID;
  g.ACCOUNT_UPGRADE_PREVIEW_DEFS = ACCOUNT_UPGRADE_PREVIEW_DEFS;
  g.BOSS_RESPAWN_MINUTES_STANDARD = BOSS_RESPAWN_MINUTES_STANDARD;
  g.BOSS_RESPAWN_MINUTES_ELITE = BOSS_RESPAWN_MINUTES_ELITE;
  g.BOSS_ROOM_DEFS = BOSS_ROOM_DEFS;
  g.BOSS_ASSIST_OPTIONS = BOSS_ASSIST_OPTIONS;
  g.BOSS_PARTY_ORDER = BOSS_PARTY_ORDER;
  g.BOSS_PARTY_MEMBER_ACTION_GAP_MS = BOSS_PARTY_MEMBER_ACTION_GAP_MS;
  g.BOSS_PARTY_FRONT_OFFSET = BOSS_PARTY_FRONT_OFFSET;
  g.BOSS_PARTY_MEMBER_LINE_SLOTS = BOSS_PARTY_MEMBER_LINE_SLOTS;
  g.BOSS_PARTY_ENEMY_MELEE_GAP = BOSS_PARTY_ENEMY_MELEE_GAP;
  g.BOSS_PARTY_ENEMY_APPROACH_GAP = BOSS_PARTY_ENEMY_APPROACH_GAP;
  g.BOSS_PARTY_BOSS_APPROACH_SPEED = BOSS_PARTY_BOSS_APPROACH_SPEED;
  g.CRYSTAL_MONSTER_WALK_ACTION_MS = CRYSTAL_MONSTER_WALK_ACTION_MS;
  g.BOSS_PARTY_BOSS_REACH = BOSS_PARTY_BOSS_REACH;
  g.BOSS_PARTY_WARRIOR_REACH = BOSS_PARTY_WARRIOR_REACH;
  g.BOSS_PARTY_THRUSTING_REACH = BOSS_PARTY_THRUSTING_REACH;
  g.BOSS_PARTY_PET_STAND_GAP = BOSS_PARTY_PET_STAND_GAP;
  g.BOSS_PARTY_SHINSU_LINE_SLOT = BOSS_PARTY_SHINSU_LINE_SLOT;
  g.BOSS_PARTY_ASSIST_SFX_SCALE = BOSS_PARTY_ASSIST_SFX_SCALE;
  g.BOSS_PARTY_DAMAGE_TEXT_OFFSET = BOSS_PARTY_DAMAGE_TEXT_OFFSET;
  g.BOSS_PARTY_CAMERA_LERP_MS = BOSS_PARTY_CAMERA_LERP_MS;
  g.LEVEL_UP_FX_ID = LEVEL_UP_FX_ID;
  g.HEALING_RESTORE_FX_ID = HEALING_RESTORE_FX_ID;
  g.MAP_LIGHTNING_FX_ID = MAP_LIGHTNING_FX_ID;
  g.MAP_LIGHTNING_MIN_INTERVAL_MS = MAP_LIGHTNING_MIN_INTERVAL_MS;
  g.MAP_LIGHTNING_MAX_INTERVAL_MS = MAP_LIGHTNING_MAX_INTERVAL_MS;
  g.MAP_LIGHTNING_EFFECT_MS = MAP_LIGHTNING_EFFECT_MS;
  g.MAP_LIGHTNING_HIT_DELAY_MS = MAP_LIGHTNING_HIT_DELAY_MS;
  g.MAP_LIGHTNING_RESOLVE_GRACE_MS = MAP_LIGHTNING_RESOLVE_GRACE_MS;
  g.MAP_LIGHTNING_SPREAD_TILES = MAP_LIGHTNING_SPREAD_TILES;
  g.MAP_LIGHTNING_HIT_RADIUS_PX = MAP_LIGHTNING_HIT_RADIUS_PX;
  g.TAOIST_DEFENCE_BUFF_IMPACT_FX = TAOIST_DEFENCE_BUFF_IMPACT_FX;
  g.CRYSTAL_POT_DELAY_MS = CRYSTAL_POT_DELAY_MS;
  g.CRYSTAL_HEAL_DELAY_MS = CRYSTAL_HEAL_DELAY_MS;
  g.CRYSTAL_HEAL_APPLY_DELAY_MS = CRYSTAL_HEAL_APPLY_DELAY_MS;
  g.CRYSTAL_TWIN_DRAKE_SECOND_HIT_DELAY_MS = CRYSTAL_TWIN_DRAKE_SECOND_HIT_DELAY_MS;
  g.CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS = CRYSTAL_TWIN_DRAKE_CHARGE_FX_MS;
  g.CRYSTAL_MAGIC_SHIELD_STRUCK_MS = CRYSTAL_MAGIC_SHIELD_STRUCK_MS;
  g.CRYSTAL_MAGIC_SHIELD_CAST_LAYER_END = CRYSTAL_MAGIC_SHIELD_CAST_LAYER_END;
  g.CRYSTAL_MAGIC_SHIELD_LOOP_LAYER = CRYSTAL_MAGIC_SHIELD_LOOP_LAYER;
  g.CRYSTAL_MAGIC_SHIELD_STRUCK_LAYER = CRYSTAL_MAGIC_SHIELD_STRUCK_LAYER;
  g.WARRIOR_CHARGE_SKILL_IDS = WARRIOR_CHARGE_SKILL_IDS;
  g.WARRIOR_AUTO_CHARGE_ORDER = WARRIOR_AUTO_CHARGE_ORDER;
  g.CRYSTAL_POISON_APPLY_DELAY_MS = CRYSTAL_POISON_APPLY_DELAY_MS;
  g.CRYSTAL_POISON_TICK_MS = CRYSTAL_POISON_TICK_MS;
  g.CRYSTAL_POISON_RESIST_WEIGHT = CRYSTAL_POISON_RESIST_WEIGHT;
  g.EVIL_CENTIPEDE_ATTACK_IMPACT_MS = EVIL_CENTIPEDE_ATTACK_IMPACT_MS;
  g.BONE_LORD_ATTACK_IMPACT_MS = BONE_LORD_ATTACK_IMPACT_MS;
  g.CRYSTAL_WEAPON_SWING_SFX_GROUPS = CRYSTAL_WEAPON_SWING_SFX_GROUPS;
  g.CRYSTAL_WEAPON_HIT_SFX_GROUPS = CRYSTAL_WEAPON_HIT_SFX_GROUPS;
  g.buildCrystalWeaponSfxLookup = buildCrystalWeaponSfxLookup;
  g.WEAPON_SWING_SFX_BY_SHAPE = WEAPON_SWING_SFX_BY_SHAPE;
  g.WEAPON_HIT_SFX_BY_SHAPE = WEAPON_HIT_SFX_BY_SHAPE;
  g.EVIL_CENTIPEDE_GREEN_POISON_CHANCE = EVIL_CENTIPEDE_GREEN_POISON_CHANCE;
  g.EVIL_CENTIPEDE_PARALYSIS_POISON_CHANCE = EVIL_CENTIPEDE_PARALYSIS_POISON_CHANCE;
  g.EVIL_CENTIPEDE_GREEN_POISON_TICKS = EVIL_CENTIPEDE_GREEN_POISON_TICKS;
  g.EVIL_CENTIPEDE_PARALYSIS_POISON_TICKS = EVIL_CENTIPEDE_PARALYSIS_POISON_TICKS;
  g.CRYSTAL_SUMMON_SKELETON_DELAY_MS = CRYSTAL_SUMMON_SKELETON_DELAY_MS;
  g.CRYSTAL_SUMMON_SKELETON_PET_INDEX = CRYSTAL_SUMMON_SKELETON_PET_INDEX;
  g.CRYSTAL_SUMMON_SKELETON_AMULET_COST = CRYSTAL_SUMMON_SKELETON_AMULET_COST;
  g.CRYSTAL_SUMMON_SKELETON_PET_STATS = CRYSTAL_SUMMON_SKELETON_PET_STATS;
  g.CRYSTAL_SUMMON_SHINSU_DELAY_MS = CRYSTAL_SUMMON_SHINSU_DELAY_MS;
  g.CRYSTAL_SUMMON_SHINSU_PET_INDEX = CRYSTAL_SUMMON_SHINSU_PET_INDEX;
  g.CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX = CRYSTAL_SUMMON_SHINSU_VISIBLE_PET_INDEX;
  g.CRYSTAL_SUMMON_SHINSU_AMULET_COST = CRYSTAL_SUMMON_SHINSU_AMULET_COST;
  g.CRYSTAL_SUMMON_SHINSU_ATTACK_RANGE_PX = CRYSTAL_SUMMON_SHINSU_ATTACK_RANGE_PX;
  g.CRYSTAL_SHINSU_ATTACK_IMPACT_FRAME = CRYSTAL_SHINSU_ATTACK_IMPACT_FRAME;
  g.CRYSTAL_SUMMON_SHINSU_PET_STATS = CRYSTAL_SUMMON_SHINSU_PET_STATS;
  g.TAOIST_SUMMON_AMULET_COST_BY_SPELL = TAOIST_SUMMON_AMULET_COST_BY_SPELL;
  g.SAVE_KEY = SAVE_KEY;
  g.SAVE_VERSION = SAVE_VERSION;
  g.STARTER_GEAR_VERSION = STARTER_GEAR_VERSION;
  g.SAVE_INTERVAL_MS = SAVE_INTERVAL_MS;
  g.SIMULATION_STEP_MS = SIMULATION_STEP_MS;
  g.MAX_SIMULATION_CATCH_UP_MS = MAX_SIMULATION_CATCH_UP_MS;
  g.BOSS_PARTY_CATCHUP_MAX_STEPS = BOSS_PARTY_CATCHUP_MAX_STEPS;
  g.OFFLINE_PROGRESS_CAP_MS = OFFLINE_PROGRESS_CAP_MS;
  g.OFFLINE_PROGRESS_MIN_MS = OFFLINE_PROGRESS_MIN_MS;
  g.DROP_PITY_KILLS = DROP_PITY_KILLS;
  g.COMBAT_STANCE_HOLD_MS = COMBAT_STANCE_HOLD_MS;
  g.TAOIST_COMBAT_POLL_MS = TAOIST_COMBAT_POLL_MS;
  g.BENEDICTION_OIL_ITEM_ID = BENEDICTION_OIL_ITEM_ID;
  g.GEM_STAT_INDEPENDENT = GEM_STAT_INDEPENDENT;
  g.GEM_FAIL_DESTROY_CHANCE = GEM_FAIL_DESTROY_CHANCE;
  g.SPECIAL_ITEM_MODE = SPECIAL_ITEM_MODE;
  g.GEM_VALID_SLOT_FLAGS = GEM_VALID_SLOT_FLAGS;
  g.AWAKENING_SOUL_ITEM_ID = AWAKENING_SOUL_ITEM_ID;
  g.AWAKENING_SOUL_BOSS_SOURCES = AWAKENING_SOUL_BOSS_SOURCES;
  g.WOMA_TAURUS_ENEMY_ID = WOMA_TAURUS_ENEMY_ID;
  g.INCARNATED_WT_ENEMY_ID = INCARNATED_WT_ENEMY_ID;
  g.INCARNATED_ZT_ENEMY_ID = INCARNATED_ZT_ENEMY_ID;
  g.INCARNATED_RTZ_ENEMY_ID = INCARNATED_RTZ_ENEMY_ID;
  g.DEFAULT_ARENA_BOSS_SPAWN_X = DEFAULT_ARENA_BOSS_SPAWN_X;
  g.EVIL_CENTIPEDE_ENEMY_ID = EVIL_CENTIPEDE_ENEMY_ID;
  g.EVIL_SNAKE_ENEMY_ID = EVIL_SNAKE_ENEMY_ID;
  g.WOMA_TAURUS_BOSS_DROPS = WOMA_TAURUS_BOSS_DROPS;
  g.INCARNATED_WT_BOSS_DROPS = INCARNATED_WT_BOSS_DROPS;
  g.EVIL_SNAKE_BOSS_DROPS = EVIL_SNAKE_BOSS_DROPS;
  g.ZUMA_TAURUS_BOSS_DROPS = ZUMA_TAURUS_BOSS_DROPS;
  g.EVIL_CENTIPEDE_BOSS_DROPS = EVIL_CENTIPEDE_BOSS_DROPS;
  g.BONE_LORD_BOSS_DROPS = BONE_LORD_BOSS_DROPS;
  g.KING_SCORPION_BOSS_DROPS = KING_SCORPION_BOSS_DROPS;
  g.OMA_KING_SPIRIT_BOSS_DROPS = OMA_KING_SPIRIT_BOSS_DROPS;
  g.KING_HOG_BOSS_DROPS = KING_HOG_BOSS_DROPS;
  g.DARK_DEVIL_BOSS_DROPS = DARK_DEVIL_BOSS_DROPS;
  g.MINOTAUR_KING_BOSS_DROPS = MINOTAUR_KING_BOSS_DROPS;
  g.BOSS_DROP_TABLE_BY_LABEL = BOSS_DROP_TABLE_BY_LABEL;
  g.BOSS_GEM_ITEM_IDS = BOSS_GEM_ITEM_IDS;
  g.BOSS_ORB_ITEM_IDS = BOSS_ORB_ITEM_IDS;
  g.bossGemDrops = bossGemDrops;
  g.bossOrbDrops = bossOrbDrops;
  g.RED_THUNDER_ZUMA_ENEMY_ID = RED_THUNDER_ZUMA_ENEMY_ID;
  g.ZUMA_TAURUS_ENEMY_ID = ZUMA_TAURUS_ENEMY_ID;
  g.BONE_LORD_ENEMY_ID = BONE_LORD_ENEMY_ID;
  g.MINOTAUR_KING_ENEMY_ID = MINOTAUR_KING_ENEMY_ID;
  g.OMA_KING_SPIRIT_ENEMY_ID = OMA_KING_SPIRIT_ENEMY_ID;
  g.KING_HOG_ENEMY_ID = KING_HOG_ENEMY_ID;
  g.DARK_DEVIL_ENEMY_ID = DARK_DEVIL_ENEMY_ID;
  g.MINOTAUR_KING_AOE_EVERY_N_ATTACKS = MINOTAUR_KING_AOE_EVERY_N_ATTACKS;
  g.PRAJNA_GUARD_ENEMY_IDS = PRAJNA_GUARD_ENEMY_IDS;
  g.RED_THUNDER_ZUMA_ZUMA_WEAPON_CHANCE = RED_THUNDER_ZUMA_ZUMA_WEAPON_CHANCE;
  g.RED_THUNDER_ZUMA_BONUS_WEAPON_CHANCE = RED_THUNDER_ZUMA_BONUS_WEAPON_CHANCE;
  g.ZUMA_THUNDER_GUARANTEED_DROP_IDS = ZUMA_THUNDER_GUARANTEED_DROP_IDS;
  g.RED_THUNDER_ZUMA_BONUS_WEAPON_IDS = RED_THUNDER_ZUMA_BONUS_WEAPON_IDS;
  g.RED_THUNDER_ZUMA_ZUMA_WEAPON_IDS = RED_THUNDER_ZUMA_ZUMA_WEAPON_IDS;
  g.SKILL_BOOK_BOSS_DROP_BY_ITEM_ID = SKILL_BOOK_BOSS_DROP_BY_ITEM_ID;
  g.BENEDICTION_MAX_WEAPON_LUCK = BENEDICTION_MAX_WEAPON_LUCK;
  g.BENEDICTION_CURSE_CHANCE = BENEDICTION_CURSE_CHANCE;
  g.SMITH_COMBINE_SUCCESS_CHANCES = SMITH_COMBINE_SUCCESS_CHANCES;
  g.SMITH_DEFENSIVE_UPGRADE_SLOTS = SMITH_DEFENSIVE_UPGRADE_SLOTS;
  g.SMITH_RANDOM_TRIPLE_STAT = SMITH_RANDOM_TRIPLE_STAT;
  g.WEAPON_REFINE_MAX = WEAPON_REFINE_MAX;
  g.ORE_PURITY_UNIT = ORE_PURITY_UNIT;
  g.ORE_ITEM_IDS = ORE_ITEM_IDS;
  g.REFINER_ORE_ITEM_ID = REFINER_ORE_ITEM_ID;
  g.WEAPON_REFINE_ORE_SLOTS = WEAPON_REFINE_ORE_SLOTS;
  g.WEAPON_REFINE_MATERIAL_SLOTS = WEAPON_REFINE_MATERIAL_SLOTS;
  g.REFINE_JEWELLERY_SLOTS = REFINE_JEWELLERY_SLOTS;
  g.WEAPON_REFINE_STAT_INCREASE = WEAPON_REFINE_STAT_INCREASE;
  g.WEAPON_REFINE_CRIT_CHANCE = WEAPON_REFINE_CRIT_CHANCE;
  g.WEAPON_REFINE_CRIT_MULTIPLIER = WEAPON_REFINE_CRIT_MULTIPLIER;
  g.WEAPON_REFINE_EXISTING_STAT_PENALTY = WEAPON_REFINE_EXISTING_STAT_PENALTY;
  g.WEAPON_REFINE_EXISTING_STAT_PENALTY_CAP = WEAPON_REFINE_EXISTING_STAT_PENALTY_CAP;
  g.WEAPON_REFINE_PENALTY_FROM_LEVEL = WEAPON_REFINE_PENALTY_FROM_LEVEL;
  g.WEAPON_REFINE_MAX_CHANCE = WEAPON_REFINE_MAX_CHANCE;
  g.WEAPON_REFINE_ITEM_TIER1_STAT = WEAPON_REFINE_ITEM_TIER1_STAT;
  g.WEAPON_REFINE_ITEM_TIER1_RATE = WEAPON_REFINE_ITEM_TIER1_RATE;
  g.WEAPON_REFINE_ITEM_TIER2_STAT = WEAPON_REFINE_ITEM_TIER2_STAT;
  g.WEAPON_REFINE_ITEM_TIER2_RATE = WEAPON_REFINE_ITEM_TIER2_RATE;
  g.WEAPON_REFINE_ITEM_TIER3_RATE = WEAPON_REFINE_ITEM_TIER3_RATE;
  g.WEAPON_REFINE_ITEM_SUCCESS_CAP = WEAPON_REFINE_ITEM_SUCCESS_CAP;
  g.WEAPON_REFINE_ORE_PER_PIECE = WEAPON_REFINE_ORE_PER_PIECE;
  g.WEAPON_REFINE_PURITY_PER_POINT = WEAPON_REFINE_PURITY_PER_POINT;
  g.WEAPON_REFINE_ORE_SUCCESS_CAP = WEAPON_REFINE_ORE_SUCCESS_CAP;
  g.WEAPON_REFINE_RESULT_FX_MS = WEAPON_REFINE_RESULT_FX_MS;
  g.WEAPON_REFINE_GOLD_PER_LEVEL = WEAPON_REFINE_GOLD_PER_LEVEL;
  g.createDefaultWeaponRefineState = createDefaultWeaponRefineState;
  g.MINING_ZONE_ID = MINING_ZONE_ID;
  g.MINING_PICKAXE_WEAPON_INDEX = MINING_PICKAXE_WEAPON_INDEX;
  g.MINING_SWING_MS = MINING_SWING_MS;
  g.MINING_SWING_CYCLE_MS = MINING_SWING_CYCLE_MS;
  g.MINING_HIT_CHANCE = MINING_HIT_CHANCE;
  g.MINING_TOTAL_SLOTS = MINING_TOTAL_SLOTS;
  g.MINING_ORE_DROPS = MINING_ORE_DROPS;
  g.AUTO_POTION_THRESHOLD = AUTO_POTION_THRESHOLD;
  g.AUTO_POTION_COOLDOWN_MS = AUTO_POTION_COOLDOWN_MS;
  g.CRYSTAL_MAGIC_RESIST_WEIGHT = CRYSTAL_MAGIC_RESIST_WEIGHT;
  g.LANE = LANE;
  g.THRUSTING_RANGE = THRUSTING_RANGE;
  g.TAOIST_PET_SUMMON_MIN_GAP = TAOIST_PET_SUMMON_MIN_GAP;
  g.TAOIST_PET_ENEMY_GAP = TAOIST_PET_ENEMY_GAP;
  g.TAOIST_VISIBLE_RANGE_MARGIN = TAOIST_VISIBLE_RANGE_MARGIN;
  g.TAOIST_SOUL_FIRE_BALL_LANE_RANGE = TAOIST_SOUL_FIRE_BALL_LANE_RANGE;
  g.TAOIST_SUMMON_SKELETON_LANE_RANGE = TAOIST_SUMMON_SKELETON_LANE_RANGE;
  g.playerScreenX = playerScreenX;
  g.DEFAULT_ZONE_PATTERN = DEFAULT_ZONE_PATTERN;
  g.ZONE_DECORATION_SET = ZONE_DECORATION_SET;
  g.ZONE_OBJECT_EMPTY = ZONE_OBJECT_EMPTY;
  g.DEFAULT_OBJECT_PATTERN_ROWS = DEFAULT_OBJECT_PATTERN_ROWS;
  g.DEFAULT_OBJECT_PATTERN_COLS = DEFAULT_OBJECT_PATTERN_COLS;
  g.DEFAULT_ZONE_DECORATIONS = DEFAULT_ZONE_DECORATIONS;
  g.CAVE_EDGE_SETS = CAVE_EDGE_SETS;
  g.PROTOTYPE_ZONES = PROTOTYPE_ZONES;
  g.TELEPORT_REGIONS = TELEPORT_REGIONS;
  g.DEFAULT_TELEPORT_REGION_ID = DEFAULT_TELEPORT_REGION_ID;
  g.TOWN_VISUALS = TOWN_VISUALS;
  g.MAP_STAMP_ASSET_VERSION = MAP_STAMP_ASSET_VERSION;
  g.TOWN_NPCS = TOWN_NPCS;
  g.ALCHEMIST_STOCK_IDS = ALCHEMIST_STOCK_IDS;
  g.COMBAT_CLASSES = COMBAT_CLASSES;
  g.CHARACTER_SELECT_CLASSES = CHARACTER_SELECT_CLASSES;
  g.CHARACTER_IDS = CHARACTER_IDS;
  g.EQUIPMENT_SLOTS = EQUIPMENT_SLOTS;
  g.CHARACTER_TABS = CHARACTER_TABS;
  g.CRYSTAL_EQUIPMENT_SLOT_POSITIONS = CRYSTAL_EQUIPMENT_SLOT_POSITIONS;
  g.CHARACTER_PAPER_DOLL_FRAMES = CHARACTER_PAPER_DOLL_FRAMES;
  g.STATUS_VALUE_ROWS = STATUS_VALUE_ROWS;
  g.WIZARD_COMBAT_SPELL_META = WIZARD_COMBAT_SPELL_META;
  g.WIZARD_COMBAT_SPELLS = WIZARD_COMBAT_SPELLS;
  g.RETIRED_TEST_DEFAULT_WIZARD_SPELLS = RETIRED_TEST_DEFAULT_WIZARD_SPELLS;
  g.TAOIST_COMBAT_SPELL_META = TAOIST_COMBAT_SPELL_META;
  g.TAOIST_COMBAT_SPELLS = TAOIST_COMBAT_SPELLS;
  g.BACKGROUND_MUSIC_TRACKS = BACKGROUND_MUSIC_TRACKS;
  g.DEFAULT_MUSIC_VOLUME = DEFAULT_MUSIC_VOLUME;
  g.DEFAULT_MUSIC_ENABLED = DEFAULT_MUSIC_ENABLED;
  g.MUSIC_SETTINGS_VERSION = MUSIC_SETTINGS_VERSION;
  g.MUSIC_MODE_PLAYLIST = MUSIC_MODE_PLAYLIST;
  g.MUSIC_MODE_TRACK = MUSIC_MODE_TRACK;
  g.DEFAULT_SFX_ENABLED = DEFAULT_SFX_ENABLED;
  g.DEFAULT_SFX_VOLUME = DEFAULT_SFX_VOLUME;
  g.SFX_POOL_SIZE = SFX_POOL_SIZE;
  g.DEFAULT_PROTOTYPE_STATS_ENABLED = DEFAULT_PROTOTYPE_STATS_ENABLED;
  g.STATS_NOTICE_VERSION = STATS_NOTICE_VERSION;
  g.PROTOTYPE_RESET_NOTICE_VERSION = PROTOTYPE_RESET_NOTICE_VERSION;
  g.PROTOTYPE_RESET_NOTICE_INTERVAL_MS = PROTOTYPE_RESET_NOTICE_INTERVAL_MS;
  g.STATS_CONFIG_URL = STATS_CONFIG_URL;
  g.STATS_PLAYER_ID_KEY = STATS_PLAYER_ID_KEY;
  g.STATS_SUBMIT_INTERVAL_MS = STATS_SUBMIT_INTERVAL_MS;
}
