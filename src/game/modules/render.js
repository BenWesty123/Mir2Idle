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

import { battlePanelSignature, gamePanelSignature, sceneSignature, combatSkillBarSignature, playerHudSignature, hotbarSignature, suppressSimulationRender, stageContext, lastStageDisplaySize, inventoryDragState } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els, UI_MODE, IS_GAME_UI } from "../runtime.js";

function renderOfflineReport() {
  const report = state.game.offlineReport;
  if (!els.offlineReport) return;
  if (!report) {
    els.offlineReport.hidden = true;
    els.offlineReport.innerHTML = "";
    return;
  }

  const rows = [["Away", report.duration]];
  if (report.kind === "mining") {
    rows.push(["Swings", report.swings ?? 0]);
    rows.push(["Ore finds", report.hits ?? 0]);
    if (report.drops?.length) rows.push(["Found", G.reportEntriesText(report.drops, 6)]);
    if (report.ignoredDrops?.length) rows.push(["No Room", G.reportEntriesText(report.ignoredDrops, 4)]);
    rows.push(["Result", report.capped ? "8 hour cap reached" : "Still mining"]);
  } else {
    rows.push(["Kills", report.kills ?? 0]);
    rows.push(["XP", `+${report.xp ?? 0}`]);
    rows.push(["Gold", `+${report.gold ?? 0}`]);
    if (report.level) rows.push(["Level", report.level]);
    if (report.potionsUsed?.length) rows.push(["Potions", G.reportEntriesText(report.potionsUsed, 4)]);
    if (report.drops?.length) rows.push(["Found", G.reportEntriesText(report.drops, 5)]);
    if (report.ignoredDrops?.length) rows.push(["No Room", G.reportEntriesText(report.ignoredDrops, 4)]);
    if (report.defeatedAfter) rows.push(["Result", `Defeated after ${report.defeatedAfter}`]);
    else rows.push(["Result", report.capped ? "8 hour cap reached" : "Still hunting"]);
  }

  els.offlineReport.hidden = false;
  els.offlineReport.innerHTML = `
    <div class="offline-report-window" role="dialog" aria-modal="true" aria-labelledby="offlineReportTitle">
      <header>
        <div>
          <p class="eyebrow">Offline Progress</p>
          <h2 id="offlineReportTitle">While You Were Away</h2>
        </div>
        <button type="button" data-close-offline-report aria-label="Close offline report">X</button>
      </header>
      <dl>
        ${rows.map(([label, value]) => `<dt>${G.escapeHtml(String(label))}</dt><dd>${G.escapeHtml(String(value))}</dd>`).join("")}
      </dl>
      <button type="button" class="primary" data-close-offline-report>Continue</button>
    </div>
  `;
}

function renderPrototypeStatsNotice() {
  if (!els.prototypeStatsNotice) return;
  if (!G.prototypeStatsNoticeRequired()) {
    if (G.prototypeResetNoticeRequired()) {
      renderPrototypeResetNotice();
      return;
    }

    els.prototypeStatsNotice.classList.remove("prototype-reset-notice-overlay");
    els.prototypeStatsNotice.hidden = true;
    els.prototypeStatsNotice.innerHTML = "";
    return;
  }

  els.prototypeStatsNotice.classList.remove("prototype-reset-notice-overlay");
  els.prototypeStatsNotice.hidden = false;
  els.prototypeStatsNotice.innerHTML = `
    <div class="prototype-stats-notice-window" role="dialog" aria-modal="true" aria-labelledby="prototypeStatsNoticeTitle">
      <h2 id="prototypeStatsNoticeTitle">Anonymous Prototype Stats</h2>
      <p>
        This prototype can submit anonymous per-character gameplay progress such as level, XP, kills, gold, current zone, and playtime so I can tune balance and test leaderboards.
      </p>
      <p>
        No name, email, account, or personal details are sent. You can turn this off now, or later in Options.
      </p>
      <div class="prototype-stats-notice-actions">
        <button type="button" data-disable-prototype-stats>Turn Off</button>
        <button type="button" class="primary" data-accept-prototype-stats>Continue</button>
      </div>
    </div>
  `;
}

function renderPrototypeResetNotice() {
  if (!els.prototypeStatsNotice) return;
  els.prototypeStatsNotice.classList.add("prototype-reset-notice-overlay");
  els.prototypeStatsNotice.hidden = false;
  els.prototypeStatsNotice.innerHTML = `
    <div class="prototype-stats-notice-window prototype-reset-notice-window" role="dialog" aria-modal="true" aria-labelledby="prototypeResetNoticeTitle">
      <h2 id="prototypeResetNoticeTitle">Prototype Notice</h2>
      <p>
        This is still a public prototype for testing balance, progression, and overall feel.
      </p>
      <p>
        Saves are stored locally in this browser, but future updates may reset progress or make older saves incompatible.
      </p>
      <p class="prototype-reset-notice-note">
        This reminder appears at most once per day.
      </p>
      <div class="prototype-stats-notice-actions">
        <button type="button" class="primary" data-accept-prototype-reset-notice>Got it</button>
      </div>
    </div>
  `;
}

function renderEnemyControls() {
  const indexes = (state.enemy.catalogue?.layers?.monster?.indexes ?? [3]).filter((index) => index >= 3);
  const options = indexes
    .slice(0, 60)
    .map((value) => `<option value="${value}" ${value === state.enemy.index ? "selected" : ""}>Monster ${value}</option>`)
    .join("");
  const actions = [
    ["standing", "Idle"],
    ["walking", "Walk"],
    ["attack1", "Attack"],
    ["struck", "Flinch"],
    ["die", "Die"],
    ["dead", "Dead"],
  ];
  els.enemyControls.innerHTML = `
    <label>
      Enemy
      <select id="enemyIndex">${options}</select>
    </label>
    <div class="action-grid enemy-actions">
      ${actions.map(([id, label]) => `<button data-enemy-action="${id}">${label}</button>`).join("")}
    </div>
    <div class="action-grid enemy-actions">
      <button id="playerHit">Player Flinch</button>
      <button id="enemyHit">Enemy Flinch</button>
      <button id="enemyAttack">Enemy Attack</button>
    </div>
  `;
  els.enemyControls.querySelector("#enemyIndex").addEventListener("change", async (event) => {
    state.enemy.index = Number(event.currentTarget.value);
    state.enemy.frame = 0;
    state.enemy.oneShot = false;
    state.enemy.lastTick = performance.now();
    await G.reloadEnemyAtlas();
  });
  els.enemyControls.querySelectorAll("[data-enemy-action]").forEach((button) => {
    button.addEventListener("click", () => {
      state.enemy.action = button.dataset.enemyAction;
      state.enemy.frame = 0;
      state.enemy.oneShot = false;
      state.enemy.lastTick = performance.now();
      G.updateEnemyActionButtons();
      render();
    });
  });
  els.enemyControls.querySelector("#playerHit").addEventListener("click", () => {
    G.setPlayerAction("struck", performance.now(), true);
    render();
  });
  els.enemyControls.querySelector("#enemyHit").addEventListener("click", () => G.setEnemyAction("struck", true));
  els.enemyControls.querySelector("#enemyAttack").addEventListener("click", () => G.setEnemyAction("attack1", true));
  G.updateEnemyActionButtons();
}

function renderMapControls() {
  const sets = G.preferredMapSetOrder(state.mapTileIndex.sets);
  const selectedMapSet = G.currentMapSetId();
  const mapSetLocked = state.game.mode === "zone";
  const options = sets
    .map((set) => `<option value="${set.id}" ${set.id === selectedMapSet ? "selected" : ""}>${set.label}</option>`)
    .join("");
  els.mapControls.innerHTML = `
    <label>
      Map tiles
      <select id="mapSet"${mapSetLocked ? " disabled title=\"Locked to zone tile set during combat\"" : ""}>${options}</select>
    </label>
    <label class="check">
      <input id="showEnemies" type="checkbox" ${state.showEnemies ? "checked" : ""} />
      Show enemies
    </label>
    <button id="oneStepTest" class="primary">Test one walk step</button>
    <button id="continuousWalk" class="${state.continuousWalk && state.continuousMoveAction === "walking" ? "" : "primary"}">
      ${state.continuousWalk && state.continuousMoveAction === "walking" ? "Stop walk test" : "Continuous walk"}
    </button>
    <button id="continuousRun" class="${state.continuousWalk && state.continuousMoveAction === "running" ? "" : "primary"}">
      ${state.continuousWalk && state.continuousMoveAction === "running" ? "Stop run test" : "Continuous run"}
    </button>
  `;
  els.mapControls.querySelector("#mapSet")?.addEventListener("change", (event) => {
    G.stopOneStepTest();
    G.stopContinuousWalk();
    const mapSetId = event.currentTarget.value;
    if (state.game.mode === "zone") {
      event.currentTarget.value = G.currentMapSetId();
      return;
    }
    state.mapSet = mapSetId;
    state.selectedTileSlot = Math.min(state.selectedTileSlot, Math.max(0, (G.mapSetById(mapSetId)?.tiles?.length ?? 1) - 1));
    state.zoneExportText = "";
    renderZoneEditor();
    render();
  });
  els.mapControls.querySelector("#showEnemies")?.addEventListener("change", (event) => {
    G.stopOneStepTest();
    if (event.currentTarget.checked) state.continuousWalk = false;
    state.showEnemies = event.currentTarget.checked;
    state.battle.pendingImpact = null;
  state.battle.pendingEnemyStrike = null;
    state.battle.pendingPoison = null;
    state.battle.enemyAggro = false;
    render();
  });
  els.mapControls.querySelector("#oneStepTest")?.addEventListener("click", () => {
    G.startOneStepTest();
  });
  els.mapControls.querySelector("#continuousWalk")?.addEventListener("click", () => {
    if (state.continuousWalk && state.continuousMoveAction === "walking") G.stopContinuousWalk();
    else G.startContinuousMovement("walking");
  });
  els.mapControls.querySelector("#continuousRun")?.addEventListener("click", () => {
    if (state.continuousWalk && state.continuousMoveAction === "running") G.stopContinuousWalk();
    else G.startContinuousMovement("running");
  });
}

function renderZoneEditor() {
  const target = G.zoneBuilderTarget();
  const draft = G.zoneBuilderDraft(target.id);
  const set = G.mapSetById(draft.mapSet) ?? G.currentMapSet();
  const objectSet = G.mapObjectSetById(draft.objectSet);
  if (!els.zoneEditor || !set?.tiles?.length) {
    if (els.zoneEditor) els.zoneEditor.innerHTML = "";
    return;
  }
  const exportText = state.zoneExportText || G.zonePatternExportText();
  const targetOptions = PROTOTYPE_ZONES.map((zone) => `
    <option value="${zone.id}" ${zone.id === target.id ? "selected" : ""}>${zone.label}</option>
  `).join("");
  const mapOptions = G.preferredMapSetOrder(state.mapTileIndex.sets)
    .map((entry) => `<option value="${entry.id}" ${entry.id === draft.mapSet ? "selected" : ""}>${entry.label}</option>`)
    .join("");
  els.zoneEditor.innerHTML = `
    <section class="zone-editor">
      <div class="zone-builder-controls">
        <label>
          Build zone
          <select id="zoneBuilderTarget">${targetOptions}</select>
        </label>
        <label>
          Builder tiles
          <select id="zoneBuilderMapSet">${mapOptions}</select>
        </label>
      </div>
      <p class="hint">${target.label}: ${set.label}, ${set.tiles.length} tiles available. Tile frames are printed in the export below.</p>
      <div class="tile-palette" aria-label="Tile palette">
        ${set.tiles.map((tile, index) => G.tileButtonHtml(set, tile, index)).join("")}
      </div>
      <div class="zone-pattern-grid" aria-label="Repeating lane pattern">
        ${draft.tilePattern
          .map((row, rowIndex) =>
            row
              .map((slot, colIndex) => G.patternCellHtml(set, slot, rowIndex, colIndex))
              .join(""),
          )
          .join("")}
      </div>
      ${objectSet ? G.zoneObjectEditorHtml(objectSet, draft) : ""}
      <div class="zone-actions">
        <button id="resetZonePattern">Reset pattern</button>
        <button id="previewZonePattern">Preview zone</button>
        <button id="exportZonePattern" class="primary">Export zone JSON</button>
      </div>
      <textarea id="zoneExport" spellcheck="false">${G.escapeHtml(exportText)}</textarea>
    </section>
  `;

  els.zoneEditor.querySelector("#zoneBuilderTarget")?.addEventListener("change", (event) => {
    state.zoneBuilderTargetId = event.currentTarget.value;
    const nextSet = G.mapSetById(G.zoneBuilderDraft(state.zoneBuilderTargetId).mapSet);
    state.selectedTileSlot = Math.min(state.selectedTileSlot, Math.max(0, (nextSet?.tiles?.length ?? 1) - 1));
    state.zoneExportText = "";
    renderZoneEditor();
  });
  els.zoneEditor.querySelector("#zoneBuilderMapSet")?.addEventListener("change", (event) => {
    const nextSetId = event.currentTarget.value;
    const nextSet = G.mapSetById(nextSetId);
    draft.mapSet = nextSetId;
    state.selectedTileSlot = Math.min(state.selectedTileSlot, Math.max(0, (nextSet?.tiles?.length ?? 1) - 1));
    state.zoneExportText = "";
    renderZoneEditor();
    render();
  });
  els.zoneEditor.querySelectorAll("[data-tile-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTileSlot = Number(button.dataset.tileSlot);
      renderZoneEditor();
    });
  });
  els.zoneEditor.querySelectorAll("[data-object-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedObjectSlot = Number(button.dataset.objectSlot);
      renderZoneEditor();
    });
  });
  els.zoneEditor.querySelectorAll("[data-pattern-cell]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = Number(button.dataset.row);
      const col = Number(button.dataset.col);
      draft.tilePattern[row][col] = state.selectedTileSlot;
      state.zoneExportText = G.zonePatternExportText();
      renderZoneEditor();
      render();
    });
  });
  els.zoneEditor.querySelectorAll("[data-object-pattern-cell]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = Number(button.dataset.row);
      const col = Number(button.dataset.col);
      draft.objectPattern[row][col] = state.selectedObjectSlot;
      state.zoneExportText = G.zonePatternExportText();
      renderZoneEditor();
      render();
    });
  });
  els.zoneEditor.querySelector("#resetZonePattern")?.addEventListener("click", () => {
    state.zoneBuilderDrafts[target.id] = G.createZoneBuilderDraft(target);
    const resetDraft = G.zoneBuilderDraft(target.id);
    const resetSet = G.mapSetById(resetDraft.mapSet);
    state.selectedTileSlot = Math.min(state.selectedTileSlot, Math.max(0, (resetSet?.tiles?.length ?? 1) - 1));
    state.zoneExportText = G.zonePatternExportText();
    renderZoneEditor();
    render();
  });
  els.zoneEditor.querySelector("#previewZonePattern")?.addEventListener("click", async () => {
    state.zoneBuilderPreviewZoneId = target.id;
    await G.enterZone(target.id, { preview: true });
  });
  els.zoneEditor.querySelector("#exportZonePattern")?.addEventListener("click", () => {
    state.zoneExportText = G.zonePatternExportText();
    renderZoneEditor();
  });
}

function renderInventoryStacksChanged({ hotbarChanged = false, equipmentChanged = false, playMoveSfx = true } = {}) {
  G.hideItemTooltip();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  if (hotbarChanged) hotbarSignature = "";
  G.saveGameState(true);
  if (hotbarChanged) renderHotbar();
  renderSceneOverlay();
  renderGamePanel();
  renderBattlePanel();
  if (equipmentChanged) return;
  if (playMoveSfx) G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
}

function renderStorageMove({ hotbarChanged = false, equipmentChanged = false, playMoveSfx = true } = {}) {
  G.ensureInventorySlots();
  G.ensureStorageSlots();
  G.hideItemTooltip();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  if (hotbarChanged) hotbarSignature = "";
  G.saveGameState(true);
  if (hotbarChanged) renderHotbar();
  renderSceneOverlay();
  renderGamePanel();
  renderBattlePanel();
  if (!equipmentChanged && playMoveSfx) G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
}

function renderGamePanel() {
  if (IS_GAME_UI) {
    renderGameUiPanel();
    return;
  }

  const game = state.game;
  const zone = G.activeZone();
  const signature = JSON.stringify({
    mode: game.mode,
    activeZoneId: game.activeZoneId,
    running: state.battle.running,
    phase: state.battle.phase,
    kills: game.kills,
    zoneKills: game.zoneKills,
    distance: Math.floor(game.distance / LANE_TILE_PX),
    level: game.progress.level,
    experience: game.progress.experience,
    gold: game.progress.gold,
    inventoryGold: state.inventory.gold,
    inventoryItems: state.inventory.items.map(inventoryEntrySignature),
    equipment: state.inventory.equipment,
    magic: G.magicSignature(),
    activeScene: state.activeScene,
    openScenes: state.openScenes,
    lastReward: game.lastReward,
    recentLoot: game.recentLoot,
    levelUpEffects: state.levelUpEffects.length,
    selectedTownNpcId: game.selectedTownNpcId,
  });
  if (signature === gamePanelSignature) return;
  gamePanelSignature = signature;

  if (game.mode === "town") {
    const zoneButtons = G.combatPlayableZones().map((entry) => {
      return `
        <button data-enter-zone="${entry.id}" class="primary">
          Teleport: ${entry.label}
        </button>
      `;
    }).join("");
    els.gamePanel.innerHTML = `
      <section class="game-panel">
        <p class="game-mode">Bicheon Wall</p>
        <div class="town-slots">
          <span>Click NPCs in the city</span>
          <span>Shop</span>
          <span>Refiner</span>
          <span>Storage</span>
        </div>
        <p class="battle-state">Level ${game.progress.level} | ${G.xpProgressText()} | Gold ${state.inventory.gold} | Kills ${game.kills}</p>
        <p class="battle-state">Hover an NPC to see their name. Click to open their window.</p>
        ${G.sceneButtonsHtml()}
        ${G.recentLootHtml()}
        <div class="battle-buttons">
          <button id="testLevelUp">Level Up</button>
          ${zoneButtons}
        </div>
      </section>
    `;
    G.bindSceneButtons(els.gamePanel);
    els.gamePanel.querySelector("#testLevelUp")?.addEventListener("click", () => G.testLevelUpCharacter());
    return;
  }

  if (game.mode === "mining") {
    const spot = G.activeMiningSpot();
    els.gamePanel.innerHTML = `
      <section class="game-panel">
        <p class="game-mode">${spot?.label ?? zone?.label ?? "Mine"} <span>Mining</span></p>
        <p class="battle-state">Swinging your pickaxe for ore.</p>
        ${G.sceneButtonsHtml()}
        ${G.recentLootHtml()}
        <div class="battle-buttons">
          <button id="returnToTown" class="primary">Return To Town</button>
        </div>
      </section>
    `;
    G.bindSceneButtons(els.gamePanel);
    els.gamePanel.querySelector("#returnToTown")?.addEventListener("click", () => G.returnToTown());
    return;
  }

  els.gamePanel.innerHTML = `
    <section class="game-panel">
      <p class="game-mode">${zone?.label ?? "Zone"} <span>${G.title(state.battle.phase)}</span></p>
      <p class="battle-state">
        Endless run | ${game.zoneKills} kills | ${Math.floor(game.distance / LANE_TILE_PX)} tiles travelled
      </p>
      ${game.lastReward ? `<p class="battle-state">Last reward: +${game.lastReward.xp} XP, +${game.lastReward.gold} gold</p>` : ""}
      ${G.sceneButtonsHtml()}
      ${G.recentLootHtml()}
      <div class="battle-buttons">
        <button id="testLevelUp">Level Up</button>
        <button id="returnToTown" class="primary">Return To Town</button>
      </div>
    </section>
  `;
  G.bindSceneButtons(els.gamePanel);
  els.gamePanel.querySelector("#testLevelUp")?.addEventListener("click", () => G.testLevelUpCharacter());
  els.gamePanel.querySelector("#returnToTown")?.addEventListener("click", () => G.returnToTown());
}

function renderGameUiPanel() {
  const game = state.game;
  const zone = G.activeZone();
  document.body.dataset.gameMode = game.mode;
  const signature = JSON.stringify({
    ui: UI_MODE,
    mode: game.mode,
    activeZoneId: game.activeZoneId,
    running: state.battle.running,
    phase: state.battle.phase,
    kills: game.kills,
    zoneKills: game.zoneKills,
    distance: Math.floor(game.distance / LANE_TILE_PX),
    level: game.progress.level,
    experience: game.progress.experience,
    gold: state.inventory.gold,
    openScenes: state.openScenes,
    recentLoot: game.recentLoot,
    log: state.battle.log,
    bossParty: G.bossPartySignature(),
    groupDungeonWaves: G.groupDungeonWaveSignature(),
    selectedTownNpcId: game.selectedTownNpcId,
  });
  if (signature === gamePanelSignature) return;
  gamePanelSignature = signature;

  if (game.mode === "town") {
    if (els.gameSidePanel) els.gameSidePanel.hidden = true;
    els.gamePanel.innerHTML = "";
    return;
  }

  if (game.mode === "mining") {
    if (els.gameSidePanel) els.gameSidePanel.hidden = false;
    els.gamePanel.innerHTML = `
      <section class="game-card game-status-card">
        <div class="game-card-title">
          <strong>${G.escapeHtml(zone?.label ?? "Mine")}</strong>
          <span>${state.inventory.gold}g</span>
        </div>
        <div class="game-progress-line">
          <span>Level ${game.progress.level}</span>
          <span>${G.escapeHtml(G.xpProgressText())}</span>
        </div>
        <div class="game-zone-stats">
          <span><strong>Mining</strong><small>Activity</small></span>
        </div>
        <button id="returnToTown" class="primary game-wide-button" type="button">Return To Town</button>
      </section>
      ${G.gameSideRecentLootHtml()}
      ${G.activityLogHtml()}
    `;
    G.bindSceneButtons(els.gamePanel);
    els.gamePanel.querySelector("#returnToTown")?.addEventListener("click", () => G.returnToTown());
    return;
  }

  if (els.gameSidePanel) els.gameSidePanel.hidden = false;
  const wavePanel = G.groupDungeonZone(zone) && G.groupDungeonWaveState()
    ? G.groupDungeonWaveSidePanelHtml()
    : "";
  els.gamePanel.innerHTML = `
    <section class="game-card game-status-card">
      <div class="game-card-title">
        <strong>${G.escapeHtml(zone?.label ?? "Hunting Zone")}</strong>
        <span>${state.inventory.gold}g</span>
      </div>
      <div class="game-progress-line">
        <span>Level ${game.progress.level}</span>
        <span>${G.escapeHtml(G.xpProgressText())}</span>
      </div>
      <div class="game-zone-stats">
        <span><strong>${game.zoneKills}</strong><small>Kills</small></span>
        <span><strong>${Math.floor(game.distance / LANE_TILE_PX)}</strong><small>Tiles</small></span>
        <span><strong>${G.title(state.battle.phase)}</strong><small>State</small></span>
      </div>
      <button id="returnToTown" class="primary game-wide-button" type="button">Return To Town</button>
    </section>
    ${wavePanel}
    ${G.gameSideRecentLootHtml()}
    ${G.activityLogHtml()}
  `;
  G.bindSceneButtons(els.gamePanel);
  els.gamePanel.querySelector("#returnToTown")?.addEventListener("click", () => G.returnToTown());
}

function renderSceneOverlay(options = {}) {
  const deferUserInteraction = Boolean(options.deferUserInteraction);
  const openScenes = ["characterSelect", "character", "inventory", "upgrades", "gettingStarted", "options"].filter((scene) => state.openScenes[scene]);
  const npcScene = state.activeScene === "townNpc" || state.activeScene === "storage" || state.activeScene === "bossEntry" || state.activeScene === "weaponRefine"
    ? state.activeScene
    : null;
  const overlayScenes = npcScene ? [...openScenes, npcScene] : openScenes;
  if (!overlayScenes.length) {
    G.cleanupInventoryCarry();
    els.sceneOverlay.hidden = true;
    els.sceneOverlay.innerHTML = "";
    sceneSignature = "";
    return;
  }

  const bossEntryZoneId = state.activeScene === "bossEntry" ? state.bossEntryZoneId : null;
  const signature = G.buildSceneOverlaySignature(openScenes, bossEntryZoneId);
  if (signature === sceneSignature) return;
  if (inventoryDragState) return;
  if (deferUserInteraction && G.sceneOverlayInteractionActive()) return;
  sceneSignature = signature;

  const scrollPositions = G.captureSceneScrollPositions();
  els.sceneOverlay.hidden = false;
  els.sceneOverlay.innerHTML = `
    <div class="scene-window-stack">
      ${overlayScenes.map((scene) => G.sceneWindowHtml(scene)).join("")}
    </div>
  `;
  G.bindSceneButtons(els.sceneOverlay);
  G.bindSceneScrollPreservation(els.sceneOverlay);
  G.restoreSceneScrollPositions(scrollPositions);
}

function renderSpellControls() {
  const availableFx = new Set(state.spellIndex.spells);
  const groups = SPELL_GROUPS.map((group) => {
    const options = group.items
      .map((spell) => {
        const fx = spell === "None" || availableFx.has(spell) ? "" : " (body only)";
        return `<option value="${spell}" ${spell === state.spell ? "selected" : ""}>${spellLabel(spell)}${fx}</option>`;
      })
      .join("");
    return `<optgroup label="${group.label}">${options}</optgroup>`;
  }).join("");
  const mapped = bodyActionForSpell(state.spell);
  els.spellControls.innerHTML = `
    <label>
      Spell / skill
      <select id="spell">${groups}</select>
    </label>
    <label class="check">
      <input id="syncBodyToSpell" type="checkbox" ${state.syncBodyToSpell ? "checked" : ""} />
      Sync body action
    </label>
    <label>
      Cast gap
      <input id="castCooldown" type="range" min="0" max="3000" step="250" value="${state.castCooldownMs}" />
    </label>
    <p class="hint" id="spellMapping">Body: ${PLAYER_ACTIONS[mapped]?.label ?? mapped}</p>
  `;
  els.spellControls.querySelector("#spell").addEventListener("change", async (event) => {
    const now = performance.now();
    state.spell = event.currentTarget.value;
    state.spellStartedAt = now;
    G.applySpellBodyMapping(now);
    G.updateActionButtons();
    G.updateSpellMappingText();
    await G.reloadSpell();
    render();
  });
  els.spellControls.querySelector("#syncBodyToSpell").addEventListener("change", (event) => {
    const now = performance.now();
    state.syncBodyToSpell = event.currentTarget.checked;
    state.spellStartedAt = now;
    G.applySpellBodyMapping(now);
    G.updateActionButtons();
    G.updateSpellMappingText();
    render();
  });
  els.spellControls.querySelector("#castCooldown").addEventListener("input", (event) => {
    state.castCooldownMs = Number(event.currentTarget.value);
    G.updateSpellMappingText();
  });
}

function renderLayerControls() {
  const setOptions = Object.entries(SPRITE_SETS)
    .map(([value, set]) => `<option value="${value}" ${value === state.spriteSet ? "selected" : ""}>${set.label}</option>`)
    .join("");
  const setControl = `
    <label>
      Sprite set
      <select id="spriteSet">${setOptions}</select>
    </label>
  `;

  const layerControls = G.layerNames()
    .map((layer) => {
      const indexes = state.catalogue.layers?.[layer]?.indexes ?? [0];
      const emptyOption = layer === "weapon" ? `<option value="" ${state.indexes[layer] == null ? "selected" : ""}>None</option>` : "";
      const options = indexes
        .slice(0, 120)
        .map((value) => `<option value="${value}" ${value === state.indexes[layer] ? "selected" : ""}>${value}</option>`)
        .join("");
      const capped = indexes.length > 120 ? `<option disabled>+ ${indexes.length - 120} more after export</option>` : "";
      return `
        <label>
          ${G.title(layer)}
          <select data-layer="${layer}">${emptyOption}${options}${capped}</select>
        </label>
      `;
    })
    .join("");

  els.layerControls.innerHTML = setControl + layerControls;

  els.layerControls.querySelector("#spriteSet").addEventListener("change", async (event) => {
    state.spriteSet = event.currentTarget.value;
    state.catalogue = await G.loadCatalogue(state.spriteSet);
    state.indexes = {};
    for (const layer of G.layerNames()) {
      state.indexes[layer] = layer === "weapon" ? null : state.catalogue.layers?.[layer]?.indexes?.[0] ?? 0;
    }
    G.applyEquippedVisualIndexes();
    renderLayerControls();
    await G.reloadAtlases();
  });

  els.layerControls.querySelectorAll("select").forEach((select) => {
    if (select.id === "spriteSet") return;
    select.addEventListener("change", async () => {
      state.indexes[select.dataset.layer] = select.value === "" ? null : Number(select.value);
      await G.reloadAtlases();
    });
  });
}

function renderActionControls() {
  els.actionGroups.innerHTML = ACTION_GROUPS.map((group) => {
    const buttons = group.actions
      .map((action) => {
        const spec = PLAYER_ACTIONS[action];
        return `<button data-action="${action}" title="${action}">${spec.label}</button>`;
      })
      .join("");
    return `<section><h2>${group.label}</h2><div class="action-grid">${buttons}</div></section>`;
  }).join("");

  els.actionGroups.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      G.stopOneStepTest();
      state.action = button.dataset.action;
      state.frame = 0;
      state.playerOneShot = false;
      state.lastTick = performance.now();
      G.updateActionButtons();
      render();
    });
  });
  G.updateActionButtons();
}

function renderCombatSkillBar(now = performance.now()) {
  const skills = state.battle.combatClass === "Wizard"
    ? G.learnedActiveWizardSkills()
    : state.battle.combatClass === "Taoist"
    ? G.learnedActiveTaoistSkills()
    : G.learnedActiveWarriorSkills();
  const shouldShow = G.combatSkillBarShouldShow(skills);
  if (!shouldShow) {
    if (!els.combatSkillBar.hidden || combatSkillBarSignature) {
      els.combatSkillBar.hidden = true;
      els.combatSkillBar.innerHTML = "";
      combatSkillBarSignature = "";
      G.applyCombatHudLayout({ skillBarVisible: false });
    }
    return;
  }

  const signature = JSON.stringify({
    mode: state.game.mode,
    running: state.battle.running,
    phase: state.battle.phase,
    mp: state.battle.player?.mp ?? 0,
    poisons: `${G.poisonInventoryCount("green")}:${G.poisonInventoryCount("yellow")}`,
    amulets: G.amuletInventoryCount(),
    magic: G.magicSignature(),
    autoCastSlotLimit: G.autoCastSlotLimit(),
    queuedCombatSpellId: state.battle.queuedCombatSpellId ?? "",
    flamingSwordReady: G.warriorFlamingSwordReady(),
    twinDrakeReady: G.warriorTwinDrakeReady(),
    cooldownSecond: skills.map((skill) => {
      const learned = G.learnedMagic(skill.id);
      const remaining = skill.toggle ? 0 : Math.ceil(Math.max(0, (learned?.castReadyAt ?? 0) - now) / 1000);
      return `${skill.id}:${remaining}`;
    }),
  });
  if (signature === combatSkillBarSignature) return;
  combatSkillBarSignature = signature;
  els.combatSkillBar.hidden = false;
  els.combatSkillBar.innerHTML = skills.map((skill) => G.combatSkillButtonHtml(skill, G.learnedMagic(skill.id), now)).join("");
  G.applyCombatHudLayout();
}

function renderHotbar() {
  G.normalizeHotbarSlots();
  const signature = JSON.stringify({
    autoPotionSlots: G.autoPotionSlotLimit(),
    slots: state.hotbar.slots.map((entryId, slot) => {
      const entry = G.hotbarEntryAtSlot(slot);
      return entry ? G.inventoryEntrySignature(entry) : "";
    }),
  });
  if (signature === hotbarSignature) return;
  hotbarSignature = signature;
  els.hotbar.innerHTML = Array.from({ length: HOTBAR_SLOT_COUNT }, (_, slot) => G.hotbarSlotHtml(slot)).join("");
}

function render() {
  if (suppressSimulationRender) return;
  G.ensureEquippedVisualsFresh();
  const previousStageWidth = state.stageWidth;
  G.updateStageSize();
  if (!state.battle.running && state.battle.phase === "idle" && previousStageWidth !== state.stageWidth) {
    state.battle.cameraX = state.battle.playerX - G.playerScreenX();
    state.battle.enemyX = state.battle.playerX + G.enemySpawnDistance();
  }
  const clip = G.currentClip();
  const frameCount = clip?.frames.length ?? PLAYER_ACTIONS[state.action].count;
  state.frame = Math.max(0, Math.min(state.frame, Math.max(0, frameCount - 1)));
  const displayFrame = G.playbackFrameIndex(frameCount);

  renderCanvasStage(displayFrame, frameCount);
  renderPlayerResourceHud();
  renderHotbar();

  const srcFrame = sourceFrameFor(state.action, displayFrame);
  const spec = PLAYER_ACTIONS[state.action];
  const spellText = state.spell === "None" ? "" : ` | skill ${spellLabel(state.spell)}`;
  const phaseText = state.syncBodyToSpell && state.spell !== "None" ? ` | cast gap ${state.castCooldownMs}ms` : "";
  els.readout.textContent = `${spec.label}${spellText}${phaseText} | frame ${state.frame + 1}/${frameCount} | Crystal source frame ${srcFrame} | ${G.perfReadout()}`;
  els.frameMeta.innerHTML = `
    <dt>Action</dt><dd>${state.action}</dd>
    <dt>Skill</dt><dd>${spellLabel(state.spell)}</dd>
    <dt>Mapped</dt><dd>${bodyActionForSpell(state.spell)}</dd>
    <dt>Start</dt><dd>${spec.start}</dd>
    <dt>Count</dt><dd>${spec.count}</dd>
    <dt>Skip</dt><dd>${spec.skip}</dd>
    <dt>Direction</dt><dd>2 / east</dd>
    <dt>Formula</dt><dd>start + (count + skip) * direction + frame</dd>
  `;
  renderGamePanel();
  renderBattlePanel();
  renderSceneOverlay({ deferUserInteraction: true });
  renderCombatSkillBar();
  G.applyCombatHudLayout();
}

function renderPlayerResourceHud() {
  const player = state.battle.player;
  const shouldShow = Boolean(player) && (state.game.mode === "zone" || state.game.mode === "mining" || state.battle.running || state.showEnemies);
  if (!shouldShow) {
    if (!els.playerResourceHud.hidden || playerHudSignature) {
      els.playerResourceHud.hidden = true;
      els.playerResourceHud.innerHTML = "";
      playerHudSignature = "";
    }
    return;
  }

  const hpPotions = G.potionInventoryCount("hp");
  const mpPotions = G.potionInventoryCount("mp");
  const pendingHp = (state.battle.potHealthAmount ?? 0) + (state.battle.healAmount ?? 0);
  const pendingMp = state.battle.potManaAmount ?? 0;
  const now = performance.now();
  const activeBuffs = pruneStatBuffs(state.battle.statBuffs ?? [], now).map((buff) => ({
    label: buff.label,
    bonus: statBuffBonusLabel(buff),
    remaining: formatBuffRemaining(buff.expiresAt - now),
  }));
  const signature = JSON.stringify({
    className: state.battle.combatClass,
    level: state.game.progress.level,
    hp: player.hp,
    maxHp: player.maxHp,
    mp: player.mp,
    maxMp: player.maxMp,
    pendingHp,
    pendingMp,
    hpPotions,
    mpPotions,
    activeBuffs,
  });
  if (signature === playerHudSignature) return;
  playerHudSignature = signature;

  els.playerResourceHud.hidden = false;
  const titleHtml = IS_GAME_UI
    ? `<div class="player-resource-title game-minimal"><span>Lv ${state.game.progress.level}</span></div>`
    : `
      <div class="player-resource-title">
        <strong>${G.escapeHtml(state.battle.combatClass)}</strong>
        <span>Lv ${state.game.progress.level}</span>
      </div>
    `;
  els.playerResourceHud.innerHTML = `
    ${titleHtml}
    ${G.playerResourceBarHtml("hp", "HP", player.hp, player.maxHp, pendingHp)}
    ${G.playerResourceBarHtml("mp", "MP", player.mp, player.maxMp, pendingMp)}
    <div class="player-resource-potions">
      ${G.potionQuickButtonHtml("hp", "HP", hpPotions)}
      ${G.potionQuickButtonHtml("mp", "MP", mpPotions)}
    </div>
    ${activeBuffs.length ? `<div class="player-resource-buffs">${activeBuffs.map((buff) => `<span class="player-stat-buff">${G.escapeHtml(buff.label)} ${G.escapeHtml(buff.bonus)} · ${G.escapeHtml(buff.remaining)}</span>`).join("")}</div>` : ""}
  `;
}

function renderCanvasStage(displayFrame, frameCount) {
  const drawStartedAt = performance.now();
  const canvas = G.ensureStageCanvas();
  const ctx = stageContext;
  if (!canvas || !ctx) return;

  if (canvas.width !== state.stageWidth || canvas.height !== state.stageHeight) {
    canvas.width = state.stageWidth;
    canvas.height = state.stageHeight;
    G.invalidateStampBackgroundCache();
  }
  const displayWidth = state.stageWidth * state.scale;
  const displayHeight = state.stageHeight * state.scale;
  if (displayWidth !== lastStageDisplaySize.w || displayHeight !== lastStageDisplaySize.h) {
    lastStageDisplaySize = { w: displayWidth, h: displayHeight };
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
  }
  ctx.imageSmoothingEnabled = state.smooth;
  ctx.clearRect(0, 0, state.stageWidth, state.stageHeight);

  if (state.game.mode === "town") {
    G.drawTownCanvas(ctx, displayFrame);
    G.drawLevelUpFxCanvas(ctx);
    G.drawLootNotices(ctx);
    state.perf.drawMs = performance.now() - drawStartedAt;
    return;
  }

  G.drawMapCanvas(ctx);
  G.drawGroundSpellEffectsCanvas(ctx);
  G.drawMapLightningEffectsCanvas(ctx);
  if (G.bossPartyOnField()) G.drawBossPartyDeadMembers(ctx);
  if (!G.drawStampArenaEntityLayers(ctx, displayFrame)) {
    G.drawEnemyCanvas(ctx);
    G.drawZoneMapStampForeground(ctx);
    if (G.bossPartyOnField()) {
      G.drawBossPartyLivingMembers(ctx);
      G.drawTaoistPetCanvas(ctx);
    } else {
      G.drawTaoistPetCanvas(ctx);
      G.drawPlayerCanvas(ctx, displayFrame);
    }
  }
  G.drawEnemyRangeProjectileCanvas(ctx);
  G.drawEnemyHealthBar(ctx);
  G.drawTaoistPetHealthBar(ctx);
  G.drawEnemyPoisonDots(ctx);
  G.drawEnemyDebuffBadges(ctx);
  G.drawSpellFxCanvas(ctx, displayFrame, frameCount);
  G.drawAttachedSpellFxCanvas(ctx);
  G.drawTwinDrakeReadyFxCanvas(ctx);
  G.drawCombatSkillFxCanvas(ctx);
  G.drawCombatWizardFxCanvas(ctx);
  G.drawCombatTaoistFxCanvas(ctx);
  G.drawDefenceBuffFxCanvas(ctx);
  if (state.battle.bossParty?.active || state.battle.bossParty?.finished) {
    G.drawBossPartySpellFxCanvas(ctx);
    G.drawBossPartyHealFxCanvas(ctx);
  }
  G.drawLevelUpFxCanvas(ctx);
  G.drawFloatingCombatText(ctx);
  G.drawLootNotices(ctx);
  state.perf.drawMs = performance.now() - drawStartedAt;
}

function renderBattlePanel() {
  if (IS_GAME_UI) {
    renderGameUiBattlePanel();
    return;
  }

  const battle = state.battle;
  const p = battle.player;
  const e = battle.enemy;
  if (!p || !e) {
    battlePanelSignature = "";
    els.battlePanel.innerHTML = "";
    return;
  }
  const signature = JSON.stringify({
    running: battle.running,
    gameMode: state.game.mode,
    activeZoneId: state.game.activeZoneId,
    zoneKills: state.game.zoneKills,
    phase: battle.phase,
    enemyId: battle.enemyId,
    combatClass: battle.combatClass,
    warriorSkill: battle.warriorSkill,
    wizardSpell: battle.wizardSpell,
    magic: G.magicSignature(),
    playerHp: p.hp,
    playerMp: p.mp,
    playerAttackSpeed: p.attackSpeed,
    furyUntil: Math.floor((battle.furyUntil ?? 0) / 100),
    level: battle.level,
    experience: battle.experience,
    gold: battle.gold,
    enemyHp: e.hp,
    enemyMp: e.mp,
    bossParty: G.bossPartySignature(),
    showEnemies: state.showEnemies,
    continuousWalk: state.continuousWalk,
    continuousMoveAction: state.continuousMoveAction,
    distance: state.showEnemies ? Math.round(G.enemyDistance() / 10) * 10 : 0,
    groundSpeedRatio: state.groundSpeedRatio,
    stepTestActive: state.stepTest.active,
    stepTestComplete: state.stepTest.complete,
    travelAction: battle.phase === "advance" ? G.travelAction(performance.now()) : "",
    log: battle.log,
  });
  if (signature === battlePanelSignature) return;
  battlePanelSignature = signature;

  const enemyOptions = ENEMY_TEMPLATES.map(
    (enemy) => `<option value="${enemy.id}" ${enemy.id === battle.enemyId ? "selected" : ""}>${enemy.name}</option>`,
  ).join("");
  const classOptions = COMBAT_CLASSES.map((combatClass) => {
    const disabled = combatClass.disabled ? "disabled" : "";
    const suffix = combatClass.disabled ? " (soon)" : "";
    return `<option value="${combatClass.id}" ${combatClass.id === battle.combatClass ? "selected" : ""} ${disabled}>${combatClass.label}${suffix}</option>`;
  }).join("");
  const wizardOptions = WIZARD_COMBAT_SPELLS.map((spell) => {
    const disabled = !state.wizardSpellAtlases[spell.id] ? "disabled" : "";
    const suffix = disabled ? " (missing FX)" : "";
    return `<option value="${spell.id}" ${spell.id === battle.wizardSpell ? "selected" : ""} ${disabled}>${spell.label}${suffix}</option>`;
  }).join("");
  const classAbilityControl = battle.combatClass === "Wizard"
    ? `
      <label>
        Wizard spell
        <select id="wizardSpell">${wizardOptions}</select>
      </label>
    `
    : battle.combatClass === "Taoist"
    ? `<p class="battle-state">Auto skills: ${G.escapeHtml(G.taoistAutoSummaryText())}</p>`
    : `<p class="battle-state">Auto skills: ${G.escapeHtml(G.warriorAutoSummaryText())}</p>`;
  els.battlePanel.innerHTML = `
    <label>
      Battle enemy
      <select id="battleEnemy">${enemyOptions}</select>
    </label>
    <label>
      Class
      <select id="combatClass">${classOptions}</select>
    </label>
    <div class="battle-grid">
      ${G.statBlock(battle.combatClass, p)}
      ${G.statBlock(e.name, e)}
    </div>
    <p class="battle-state">
      Level ${battle.level} | ${G.xpProgressText()} | Gold ${battle.gold}
    </p>
    <label>
      Attack speed: ${p.attackSpeed}${G.effectivePlayerAttackSpeed() !== p.attackSpeed ? ` +${G.effectivePlayerAttackSpeed() - p.attackSpeed}` : ""} (${G.playerAttackDelayMs()}ms)
      <input id="playerAttackSpeed" type="range" min="0" max="10" step="1" value="${p.attackSpeed}" />
    </label>
    <p class="battle-state">
      ${state.game.mode === "zone"
        ? `Zone: ${G.activeZone()?.label ?? "Unknown"} | Phase: ${G.title(battle.phase)} | Distance: ${Math.round(G.enemyDistance())} | Range: ${G.playerAttackRange()}`
        : state.stepTest.active || state.stepTest.complete
        ? `One-step test | ${state.stepTest.distancePx}px tile | ${state.stepTest.durationMs}ms | ground +${state.stepTest.distancePx}px`
        : state.continuousWalk ? `Deterministic ${PLAYER_ACTIONS[state.continuousMoveAction].label.toLowerCase()} | 1 cycle = ${G.movementCycleDistance(state.continuousMoveAction)}px`
        : state.showEnemies ? `Phase: ${G.title(battle.phase)} | Distance: ${Math.round(G.enemyDistance())} | Range: ${G.playerAttackRange()}` : `Ground tuning | ${state.groundSpeedRatio.toFixed(2)}x`}
      <br />
      Move model: walk ${LANE_TILE_PX}px/${WALK_CYCLE_MS}ms (${LANE.playerSpeed}px/s), run ${LANE_TILE_PX * 2}px/${RUN_CYCLE_MS}ms (${LANE.runSpeed}px/s)
    </p>
    ${classAbilityControl}
    ${G.bossPartyStatusHtml()}
    <div class="battle-buttons">
      <button id="battleToggle" class="primary">${battle.running ? "Pause Battle" : state.game.mode === "town" ? "Start Zone 1" : "Start Battle"}</button>
      <button id="battleReset">Reset</button>
    </div>
    <div class="battle-log">
      ${battle.log.map((line) => `<p>${line}</p>`).join("")}
    </div>
  `;
  els.battlePanel.querySelector("#battleEnemy").addEventListener("change", async (event) => {
    await G.selectBattleEnemy(event.currentTarget.value);
    battlePanelSignature = "";
  });
  els.battlePanel.querySelector("#playerAttackSpeed").addEventListener("input", (event) => {
    p.attackSpeed = Number(event.currentTarget.value);
    battlePanelSignature = "";
    if (battle.running) {
      battle.nextPlayerAttackAt = performance.now() + G.playerAttackDelayMs();
    }
    render();
  });
  els.battlePanel.querySelector("#combatClass").addEventListener("change", (event) => {
    battle.combatClass = event.currentTarget.value;
    battle.pendingImpact = null;
    battle.pendingEnemyStrike = null;
    battle.pendingHeal = null;
    battle.pendingPoison = null;
    battle.activeSkill = "None";
    battle.activeSkillAtlas = null;
    battle.activeWizardSpell = null;
    battle.activeWizardSpellAtlas = null;
    battle.activeTaoSpell = null;
    battle.activeTaoSpellAtlas = null;
    battle.furyUntil = 0;
    battle.furyBonus = 0;
    battlePanelSignature = "";
    render();
  });
  els.battlePanel.querySelector("#warriorSkill")?.addEventListener("change", (event) => {
    battle.warriorSkill = event.currentTarget.value;
    battlePanelSignature = "";
    render();
  });
  els.battlePanel.querySelector("#wizardSpell")?.addEventListener("change", (event) => {
    battle.wizardSpell = event.currentTarget.value;
    battlePanelSignature = "";
    render();
  });
  els.battlePanel.querySelector("#battleToggle").addEventListener("click", async () => {
    if (battle.running) G.stopBattle();
    else if (state.game.mode === "town") await G.enterZone(PROTOTYPE_ZONES[0].id);
    else G.startBattle();
    battlePanelSignature = "";
    render();
  });
  els.battlePanel.querySelector("#battleReset").addEventListener("click", async () => {
    await G.selectBattleEnemy(battle.enemyId);
    battlePanelSignature = "";
  });
}

function renderGameUiBattlePanel() {
  if (battlePanelSignature === "__game_ui_side_panel_log__") return;
  battlePanelSignature = "__game_ui_side_panel_log__";
  els.battlePanel.innerHTML = "";
}


G.renderOfflineReport = renderOfflineReport;
G.renderPrototypeStatsNotice = renderPrototypeStatsNotice;
G.renderPrototypeResetNotice = renderPrototypeResetNotice;
G.renderEnemyControls = renderEnemyControls;
G.renderMapControls = renderMapControls;
G.renderZoneEditor = renderZoneEditor;
G.renderInventoryStacksChanged = renderInventoryStacksChanged;
G.renderStorageMove = renderStorageMove;
G.renderGamePanel = renderGamePanel;
G.renderGameUiPanel = renderGameUiPanel;
G.renderSceneOverlay = renderSceneOverlay;
G.renderSpellControls = renderSpellControls;
G.renderLayerControls = renderLayerControls;
G.renderActionControls = renderActionControls;
G.renderCombatSkillBar = renderCombatSkillBar;
G.renderHotbar = renderHotbar;
G.render = render;
G.renderPlayerResourceHud = renderPlayerResourceHud;
G.renderCanvasStage = renderCanvasStage;
G.renderBattlePanel = renderBattlePanel;
G.renderGameUiBattlePanel = renderGameUiBattlePanel;
