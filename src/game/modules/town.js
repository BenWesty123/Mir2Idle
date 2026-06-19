import { ACTION_GROUPS, PLAYER_ACTIONS, sourceFrameFor } from "../../playerActions.js";
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
} from "../../battleData.js";
import { SPELL_GROUPS, bodyActionForSpell, spellLabel } from "../../spellBodyActions.js";
import { loadAtlas, loadJson, missingActions, sheetUrl } from "../../atlas.js";
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
} from "../../warriorMagic.js";
import { MINING_SPOTS, PHASE1_ZONES } from "../../phase1Data.js";
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
} from "../../groupDungeonSwarm.js";
import {
  BUFF_POTION_DURATION_MS,
  applyStatBuffsToStats,
  buffPotionDefForItem,
  formatBuffRemaining,
  isBuffPotionItem,
  pruneStatBuffs,
  sanitizeStatBuffs,
  statBuffBonusLabel,
} from "../../buffPotions.js";

import { gamePanelSignature, sceneSignature, sceneOverlayInteractionUntil } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

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

function sceneOverlayInteractionActive() {
  return performance.now() < sceneOverlayInteractionUntil;
}

function openScene(scene, updateUrl = true) {
  if (!["character", "inventory", "upgrades", "characterSelect", "gettingStarted", "options"].includes(scene)) return;
  state.game.selectedTownNpcId = null;
  if (state.activeScene === "townNpc" || state.activeScene === "storage" || state.activeScene === "bossEntry" || state.activeScene === "weaponRefine") state.activeScene = null;
  if (scene === "characterSelect") {
    state.openScenes.character = false;
    state.openScenes.inventory = false;
    state.openScenes.upgrades = false;
    state.openScenes.gettingStarted = false;
    state.openScenes.options = false;
  } else {
    state.openScenes.characterSelect = false;
  }
  state.openScenes[scene] = true;
  G.playSfx("ui.button", { volume: 0.35, throttleMs: 80 });
  if (updateUrl) G.setSceneUrl();
  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
}

function closeScene(scene = null, updateUrl = true) {
  if (typeof scene === "boolean") {
    updateUrl = scene;
    scene = null;
  }
  if (scene === "character" || scene === "inventory" || scene === "upgrades" || scene === "characterSelect" || scene === "gettingStarted" || scene === "options") {
    state.openScenes[scene] = false;
  } else if (scene === "weaponRefine") {
    G.restoreAllWeaponRefineStagedEntries();
    state.weaponRefine.picker = { kind: "weapon", index: 0 };
    state.activeScene = state.game.selectedTownNpcId ? "townNpc" : null;
  } else if (scene === "townNpc" || scene === "storage" || scene === "bossEntry") {
    state.game.selectedTownNpcId = null;
    if (scene === "storage") state.pendingStoragePageUnlock = null;
    if (state.activeScene === "townNpc" || state.activeScene === "storage" || state.activeScene === "bossEntry" || state.activeScene === "weaponRefine") state.activeScene = null;
    if (scene === "bossEntry") {
      state.bossEntryZoneId = null;
      state.bossEmpowerSelected = false;
    }
    if (scene === "townNpc") G.resetWeaponRefineState();
  } else {
    if (state.activeScene === "weaponRefine" || Object.keys(state.weaponRefine?.stagedEntries ?? {}).length) {
      G.restoreAllWeaponRefineStagedEntries();
      state.weaponRefine.picker = { kind: "weapon", index: 0 };
    }
    if (state.activeScene === "townNpc" || state.activeScene === "storage" || state.activeScene === "weaponRefine") state.game.selectedTownNpcId = null;
    state.bossEntryZoneId = null;
    state.activeScene = null;
    state.openScenes.character = false;
    state.openScenes.inventory = false;
    state.openScenes.upgrades = false;
    state.openScenes.characterSelect = false;
    state.openScenes.gettingStarted = false;
    state.openScenes.options = false;
  }
  if (updateUrl) G.setSceneUrl();
  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
}

function selectedTownNpc() {
  return TOWN_NPCS.find((npc) => npc.id === state.game.selectedTownNpcId) ?? null;
}

function townNpcSceneHtml() {
  const npc = selectedTownNpc();
  if (!npc) {
    return `<p class="battle-state">No NPC selected.</p>`;
  }
  if (npc.role === "Teleport") return teleportNpcSceneHtml(npc);
  if (npc.role === "Trainer") return G.trainerNpcSceneHtml(npc);
  if (npc.role === "Trader") return G.traderNpcSceneHtml(npc);
  if (npc.role === "Shop") return G.alchemistNpcSceneHtml(npc);
  if (npc.role === "Smith") return G.smithNpcSceneHtml(npc);
  if (npc.role === "Refiner") return G.refinerNpcSceneHtml(npc);
  if (npc.role === "Storage") return G.storageSceneHtml();
  return `
    <section class="npc-panel">
      <strong>${G.escapeHtml(npc.label)}</strong>
      <span>${G.escapeHtml(npc.panel)}</span>
      <div class="battle-buttons">
        <button class="primary">Open ${G.escapeHtml(npc.role)}</button>
      </div>
    </section>
  `;
}

function teleportRegionById(regionId) {
  return TELEPORT_REGIONS.find((region) => region.id === regionId) ?? TELEPORT_REGIONS[0];
}

function teleportRegionZones(region) {
  const zoneIds = new Set(region.zoneIds ?? []);
  return PROTOTYPE_ZONES.filter((zone) => zoneIds.has(zone.id));
}

function teleportNpcSceneHtml(npc) {
  const browseRegionId = state.teleportBrowseRegionId;
  if (!browseRegionId) {
    const regionButtons = TELEPORT_REGIONS.map((entry) => {
      const zoneCount = teleportRegionZones(entry).length;
      return `
        <button type="button" data-teleport-region="${G.escapeHtml(entry.id)}" class="teleport-region-button">
          <strong>${G.escapeHtml(entry.label)}</strong>
          <span>${zoneCount} ${zoneCount === 1 ? "zone" : "zones"}</span>
        </button>
      `;
    }).join("");
    return `
      <section class="npc-panel crystal-npc-text teleport-panel">
        <span>${G.escapeHtml(npc.panel)}</span>
        <div class="teleport-region-list" data-preserve-scroll="npc-teleport-regions">
          ${regionButtons}
        </div>
      </section>
    `;
  }

  const region = teleportRegionById(browseRegionId);
  const regionZones = teleportRegionZones(region);
  const zoneButtons = regionZones.map((zone) => {
    return `
      <button data-enter-zone="${zone.id}" class="teleport-zone-button">
        <strong>${G.escapeHtml(zone.label)}</strong>
      </button>
    `;
  }).join("");
  return `
    <section class="npc-panel crystal-npc-text teleport-panel">
      <header class="teleport-zone-header">
        <button type="button" data-teleport-back class="teleport-back-button">Back</button>
        <strong>${G.escapeHtml(region.label)}</strong>
      </header>
      <div class="teleport-zone-list" data-preserve-scroll="npc-teleport-zones-${G.escapeHtml(region.id)}">
        ${zoneButtons || `<span class="teleport-empty">No hunting grounds open here yet.</span>`}
      </div>
    </section>
  `;
}

function townStampBackgroundCacheKey(stamp = G.currentTownMapStamp()) {
  if (!stamp) return "";
  return [
    "town",
    stamp.id,
    state.stageWidth,
    state.stageHeight,
    state.smooth ? 1 : 0,
    MAP_STAMP_ASSET_VERSION,
    TOWN_VISUALS.mapStampOffsetY,
    TOWN_VISUALS.mapStampViewUpTiles,
    Number(stamp.offsetY) || 0,
    Number(stamp.scale) || 1,
  ].join("|");
}

function townMapStampSheetReady(stamp = G.currentTownMapStamp()) {
  if (!stamp?.sheet) return false;
  return Boolean(G.cachedImage(`./public/mapstamps/${stamp.sheet}?v=${MAP_STAMP_ASSET_VERSION}`));
}

function townViewOffsetYPx() {
  return (Number(TOWN_VISUALS.mapStampViewUpTiles) || 0) * MAP_TILE_ANCHOR_ROW_STEP;
}

function townNpcAt(x, y) {
  return TOWN_NPCS.find((npc) => {
    const bounds = townNpcBounds(npc);
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }) ?? null;
}

function townNpcBounds(npc) {
  const npcOffsetX = (Number(TOWN_VISUALS.npcOffsetXTiles) || 0) * LANE_TILE_PX;
  const npcOffsetY = (Number(npc.yOffsetTiles) || 0) * LANE_TILE_PX;
  const centerX = Math.round(state.stageWidth * npc.x + npcOffsetX);
  const bottomY = Math.round(state.stageHeight * npc.y + npcOffsetY + townViewOffsetYPx());
  const spriteSize = townNpcSpriteSize(npc);
  const width = spriteSize.width;
  const height = spriteSize.height;
  return {
    centerX,
    bottomY,
    width,
    height,
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: bottomY - height,
    bottom: bottomY,
  };
}

function townNpcSpriteSize(npc) {
  const layer = state.townNpcAtlases[npc.sprite]?.layers?.[0];
  return {
    width: layer?.slotWidth ?? npc.width,
    height: layer?.slotHeight ?? npc.height,
  };
}


G.labShellHtml = labShellHtml;
G.gameShellHtml = gameShellHtml;
G.sceneOverlayInteractionActive = sceneOverlayInteractionActive;
G.openScene = openScene;
G.closeScene = closeScene;
G.selectedTownNpc = selectedTownNpc;
G.townNpcSceneHtml = townNpcSceneHtml;
G.teleportRegionById = teleportRegionById;
G.teleportRegionZones = teleportRegionZones;
G.teleportNpcSceneHtml = teleportNpcSceneHtml;
G.townStampBackgroundCacheKey = townStampBackgroundCacheKey;
G.townMapStampSheetReady = townMapStampSheetReady;
G.townViewOffsetYPx = townViewOffsetYPx;
G.townNpcAt = townNpcAt;
G.townNpcBounds = townNpcBounds;
G.townNpcSpriteSize = townNpcSpriteSize;
