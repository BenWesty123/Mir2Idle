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

// TESTING ONLY -- REMOVE BEFORE PUBLISHING AN UPDATE.
// Global XP multiplier for faster local testing. Set to 1 before packaging.
import { G } from "./gameApi.js";


import { installConstants } from "./constants.js";
installConstants();

export let state;

function createDefaultAccountStats() {
  return {
    rebirthCount: 0,
    rebirthPointsGained: 0,
    rebirthPointsSpent: 0,
    bossKills: {},
  };
}

function createDefaultAccountUpgradeState() {
  return {
    tiers: {},
  };
}

function initialOpenScenesFromUrl() {
  const scene = new URLSearchParams(window.location.search).get("scene");
  const scenes = new Set(String(scene ?? "").split(",").filter(Boolean));
  return {
    character: scene === "both" || scenes.has("character"),
    inventory: scene === "both" || scenes.has("inventory"),
    upgrades: scenes.has("upgrades"),
    characterSelect: scenes.has("characterSelect") || scenes.has("characters"),
    gettingStarted: scenes.has("gettingStarted") || scenes.has("guide"),
    options: scenes.has("options"),
  };
}

function clonePattern(pattern) {
  return pattern.map((row) => [...row]);
}


export function initGameState() {
  state = {
  spriteSet: "common",
  action: "standing",
  frame: 0,
  playerOneShot: false,
  paused: false,
  smooth: true,
  scale: 1,
  spell: "None",
  syncBodyToSpell: true,
  castCooldownMs: 1000,
  spellIndex: { spells: [] },
  spellAtlas: null,
  spellStartedAt: performance.now(),
  warriorSkillAtlases: {},
  wizardSpellAtlases: {},
  taoistSpellAtlases: {},
  taoistDefenceBuffImpactAtlases: {},
  taoPetAtlas: null,
  taoPetAtlases: {},
  levelUpAtlas: null,
  healingRestoreAtlas: null,
  sfxManifest: { byKey: {}, groups: [] },
  townNpcAtlases: {},
  characterStateItems: {},
  levelUpEffects: [],
  activeCharacterId: "Warrior",
  characters: {},
  account: {
    storage: {
      pagesUnlocked: 1,
      page2Purchased: false,
      maxSlots: STORAGE_BASE_SLOTS,
      nextInstanceId: 1,
      items: [],
    },
    upgrades: G.createDefaultAccountUpgradeState(),
    rebirthPoints: 0,
    bossRespawns: {},
    stats: G.createDefaultAccountStats(),
  },
  settings: {
    musicEnabled: DEFAULT_MUSIC_ENABLED,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    musicMode: MUSIC_MODE_PLAYLIST,
    sfxEnabled: DEFAULT_SFX_ENABLED,
    sfxVolume: DEFAULT_SFX_VOLUME,
    prototypeStatsEnabled: DEFAULT_PROTOTYPE_STATS_ENABLED,
    prototypeStatsNoticeVersion: 0,
    prototypeResetNoticeVersion: 0,
    prototypeResetNoticeLastSeenAt: 0,
  },
  prototypeStats: {
    playerId: "",
    endpoint: "",
    configured: false,
    submitting: false,
    lastSubmittedAt: 0,
    lastPayloadHash: "",
    statusText: "",
  },
  itemData: { items: [] },
  mapTileIndex: { sets: [] },
  mapObjectIndex: { sets: [] },
  mapStampIndex: { stamps: [] },
  mapSet: "wemade-mir2-custom",
  zonePattern: G.clonePattern(DEFAULT_ZONE_PATTERN),
  zoneDecorations: DEFAULT_ZONE_DECORATIONS.map((decoration) => ({ ...decoration, slots: [...decoration.slots], frames: [...decoration.frames] })),
  zoneBuilderTargetId: "zone-bone-cave-1",
  zoneBuilderDrafts: {},
  zoneBuilderPreviewZoneId: null,
  selectedTileSlot: 0,
  selectedObjectSlot: ZONE_OBJECT_EMPTY,
  zoneExportText: "",
  activeScene: null,
  weaponRefine: createDefaultWeaponRefineState(),
  bossEntryZoneId: null,
  bossAssistSelection: [],
  bossEmpowerSelected: false,
  pendingBossAssistSelection: [],
  teleportRegionId: DEFAULT_TELEPORT_REGION_ID,
  teleportBrowseRegionId: null,
  openScenes: G.initialOpenScenesFromUrl(),
  characterTab: "character",
  inventoryPage: 0,
  storagePage: 0,
  pendingStoragePageUnlock: null,
  upgradeCategory: "combat",
  game: {
    mode: "town",
    activeZoneId: null,
    kills: 0,
    zoneKills: 0,
    distance: 0,
    playtimeMs: 0,
    lastReward: null,
    recentLoot: [],
    lootToasts: [],
    dropPity: {},
    bossRespawns: {},
    bossKills: {},
    selectedTownNpcId: null,
    hoveredTownNpcId: null,
    offlineReport: null,
    miningNextRollAt: 0,
    miningSpotId: null,
    groupDungeonRun: null,
    progress: {
      level: PLAYER_TEMPLATE.level,
      experience: PLAYER_TEMPLATE.experience,
      gold: PLAYER_TEMPLATE.gold,
    },
  },
  inventory: {
    gold: PLAYER_TEMPLATE.gold,
    pagesUnlocked: 1,
    maxSlots: INVENTORY_BASE_SLOTS,
    nextInstanceId: 1,
    items: [],
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, null])),
  },
  hotbar: {
    slots: Array(HOTBAR_SLOT_COUNT).fill(null),
  },
  magic: {
    learned: {},
  },
  groundSpeedRatio: 1,
  showEnemies: false,
  continuousWalk: false,
  continuousMoveAction: "walking",
  continuousWalkStartedAt: 0,
  continuousWalkStartX: 0,
  continuousWalkStartCameraX: 0,
  continuousWalkStartScrollX: 0,
  stepTest: {
    active: false,
    complete: false,
    startAt: 0,
    startX: 0,
    startCameraX: 0,
    startScrollX: 0,
    durationMs: WALK_CYCLE_MS,
    distancePx: LANE_TILE_PX,
  },
  enemy: {
    index: 0,
    action: "standing",
    frame: 0,
    oneShot: false,
    lastTick: performance.now(),
    catalogue: null,
    atlas: null,
  },
  battle: {
    running: false,
    enemyId: 0,
    player: null,
    enemy: null,
    nextPlayerAttackAt: 0,
    nextEnemyAttackAt: 0,
    returnToStandAt: 0,
    lastMotionAt: performance.now(),
    phase: "idle",
    playerX: 0,
    enemyX: 0,
    cameraX: 0,
    travelStartedAt: performance.now(),
    travelStartedX: 0,
    enemyAggro: false,
    enemyRevealed: true,
    nextEnemySpawnAt: 0,
    combatClass: "Warrior",
    warriorSkill: "None",
    wizardSpell: "FireBall",
    queuedCombatSpellId: null,
    activeSkill: "None",
    activeSkillAtlas: null,
    activeSkillStartedAt: 0,
    activeWizardSpell: null,
    activeWizardSpellAtlas: null,
    activeWizardSpellStartedAt: 0,
    activeTaoSpell: null,
    activeTaoSpellAtlas: null,
    activeTaoSpellStartedAt: 0,
    pendingImpact: null,
    pendingPetAttack: null,
    pendingEnemyStrike: null,
    pendingHeal: null,
    pendingPoison: null,
    pendingDefenceBuff: null,
    pendingUltimateEnhancer: null,
    defenceBuffFx: [],
    pendingTaoPet: null,
    petStatBuffs: [],
    taoPet: null,
    taoPetDiedThisFight: false,
    bossParty: null,
    lockedArenaWorldX: null,
    lockedCameraX: null,
    groundSpellEffects: [],
    mapLightningEffects: [],
    nextMapLightningAt: 0,
    lastPlayerAttackCooldownMs: 0,
    wizardSpellLockUntil: 0,
    lastNoMpLogAt: 0,
    furyUntil: 0,
    furyBonus: 0,
    slayingReady: false,
    slayingReadyAt: 0,
    flamingSwordReady: false,
    flamingSwordReadyAt: 0,
    flamingSwordExpiresAt: 0,
    twinDrakeReady: false,
    twinDrakeReadyAt: 0,
    twinDrakeChargeFxStartedAt: 0,
    twinDrakeChargeFxUntil: 0,
    pendingTwinDrakeHits: [],
    attachedSpellFx: [],
    potHealthAmount: 0,
    potManaAmount: 0,
    potTickAt: 0,
    healAmount: 0,
    healTickAt: 0,
    statBuffs: [],
    autoPotionReadyAt: { hp: 0, mp: 0 },
    floatingTexts: [],
    level: 1,
    experience: 0,
    gold: 0,
    log: [],
  },
  indexes: { armour: 0, hair: 0, weapon: null },
  atlasIndexes: { armour: null, hair: null, weapon: null },
  atlases: { armour: null, hair: null, weapon: null },
  catalogue: null,
  lastTick: performance.now(),
  perf: {
    frames: 0,
    fps: 0,
    lastFpsAt: performance.now(),
    drawMs: 0,
  },
  stageWidth: 520,
  stageHeight: 260,
  };
}

export * from "./sharedState.js";


function labShellHtml() {
  return `
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">LOM Idle V2</p>
        <h1>Crystal animation lab</h1>
      </div>
      <div class="topbar-actions">
        <button type="button" data-reset-save>Reset Save</button>
        <div class="status" id="status">Loading atlases...</div>
      </div>
    </header>

    <section class="workspace">
      <aside class="panel controls">
        <div class="field-grid" id="layerControls"></div>
        <div class="field-grid" id="mapControls"></div>
        <div class="field-grid" id="enemyControls"></div>
        <div class="field-grid" id="spellControls"></div>
        <div class="field-grid compact">
          <label>
            Scale
            <input id="scale" type="range" min="1" max="5" step="1" value="1" />
          </label>
          <label class="check">
            <input id="smooth" type="checkbox" checked />
            Smooth HD scaling
          </label>
          <button class="primary" id="pause">Pause</button>
        </div>
        <div id="actionGroups" class="action-groups"></div>
      </aside>

      <section class="stage-panel">
        <div class="stage-shell">
          <div class="player-resource-hud" id="playerResourceHud" hidden></div>
          <div class="stage" id="stage">
            <div class="crystal-hotbar" id="hotbar" aria-label="Potion hotbar"></div>
            <div class="combat-skill-bar" id="combatSkillBar" hidden></div>
          </div>
        </div>
        <div class="readout" id="readout"></div>
      </section>

      <aside class="panel notes">
        <h2>Prototype Loop</h2>
        <div id="gamePanel"></div>
        <h2>Level Builder</h2>
        <div id="zoneEditor"></div>
        <h2>Frame Source</h2>
        <dl id="frameMeta"></dl>
        <h2>Battle</h2>
        <div id="battlePanel"></div>
        <h2>Coverage</h2>
        <div id="coverage"></div>
      </aside>
    </section>
    <section id="sceneOverlay" class="scene-overlay" hidden></section>
    <section id="offlineReport" class="offline-report-overlay" hidden></section>
    <section id="prototypeStatsNotice" class="prototype-stats-notice-overlay" hidden></section>
    <aside id="itemTooltip" class="item-tooltip floating" hidden></aside>
  </main>
`;
}

function gameShellHtml() {
  return `
  <main class="game-shell">
    <header class="game-topbar">
      <div class="game-brand">
        <p class="eyebrow">LOM Idle V2</p>
        <h1>Legend of Mir Idle</h1>
      </div>
      <nav class="game-top-actions" aria-label="Game windows">
        <button type="button" data-open-scene="character">Character</button>
        <button type="button" data-open-scene="inventory">Inventory</button>
        <button type="button" data-open-scene="upgrades">Upgrades</button>
        <button type="button" data-open-scene="characterSelect">Characters</button>
        <button type="button" data-open-scene="gettingStarted">Guide</button>
        <button type="button" data-open-scene="options">Options</button>
      </nav>
      <div class="status" id="status">Loading atlases...</div>
    </header>

    <section class="game-layout">
      <section class="game-stage-area">
        <div class="game-stage-card">
          <div class="stage-shell game-stage-shell">
            <div class="player-resource-hud" id="playerResourceHud" hidden></div>
            <div class="stage" id="stage">
              <div class="crystal-hotbar" id="hotbar" aria-label="Potion hotbar"></div>
              <div class="combat-skill-bar" id="combatSkillBar" hidden></div>
            </div>
          </div>
          <div class="game-activity-panel" id="battlePanel"></div>
        </div>
      </section>

      <aside class="game-side-panel" id="gameSidePanel">
        <div id="gamePanel"></div>
      </aside>
    </section>

    <section id="sceneOverlay" class="scene-overlay" hidden></section>
    <section id="offlineReport" class="offline-report-overlay" hidden></section>
    <section id="prototypeStatsNotice" class="prototype-stats-notice-overlay" hidden></section>
    <aside id="itemTooltip" class="item-tooltip floating" hidden></aside>

    <div class="dev-only" hidden>
      <div id="layerControls"></div>
      <div id="mapControls"></div>
      <div id="enemyControls"></div>
      <div id="spellControls"></div>
      <div id="actionGroups"></div>
      <div id="readout"></div>
      <dl id="frameMeta"></dl>
      <div id="zoneEditor"></div>
      <div id="coverage"></div>
      <input id="scale" type="range" min="1" max="5" step="1" value="1" />
      <input id="smooth" type="checkbox" checked />
      <button id="pause" type="button">Pause</button>
    </div>
  </main>
`;
}


export const root = document.querySelector("#app");
export const query = new URLSearchParams(window.location.search);
export const UI_MODE = query.get("ui") === "lab" ? "lab" : "game";
export const IS_GAME_UI = UI_MODE === "game";

document.body.dataset.ui = UI_MODE;

root.innerHTML = IS_GAME_UI ? gameShellHtml() : labShellHtml();


export const els = {
  status: document.querySelector("#status"),
  layerControls: document.querySelector("#layerControls"),
  mapControls: document.querySelector("#mapControls"),
  enemyControls: document.querySelector("#enemyControls"),
  spellControls: document.querySelector("#spellControls"),
  actionGroups: document.querySelector("#actionGroups"),
  stage: document.querySelector("#stage"),
  playerResourceHud: document.querySelector("#playerResourceHud"),
  hotbar: document.querySelector("#hotbar"),
  combatSkillBar: document.querySelector("#combatSkillBar"),
  readout: document.querySelector("#readout"),
  frameMeta: document.querySelector("#frameMeta"),
  gamePanel: document.querySelector("#gamePanel"),
  gameSidePanel: document.querySelector("#gameSidePanel"),
  zoneEditor: document.querySelector("#zoneEditor"),
  battlePanel: document.querySelector("#battlePanel"),
  coverage: document.querySelector("#coverage"),
  sceneOverlay: document.querySelector("#sceneOverlay"),
  offlineReport: document.querySelector("#offlineReport"),
  prototypeStatsNotice: document.querySelector("#prototypeStatsNotice"),
  itemTooltip: document.querySelector("#itemTooltip"),
  scale: document.querySelector("#scale"),
  smooth: document.querySelector("#smooth"),
  pause: document.querySelector("#pause"),
};

G.createDefaultAccountStats = createDefaultAccountStats;
G.createDefaultAccountUpgradeState = createDefaultAccountUpgradeState;
G.initialOpenScenesFromUrl = initialOpenScenesFromUrl;
G.clonePattern = clonePattern;

