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

import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function zoneObjectEditorHtml(set, draft) {
  const objectPattern = draft.objectPattern?.length ? draft.objectPattern : G.createEmptyObjectPattern();
  const emptyActive = state.selectedObjectSlot === ZONE_OBJECT_EMPTY ? " active" : "";
  return `
    <div class="zone-object-editor">
      <p class="hint">Cliff wall layer: choose a wall object slot, then paint the object grid. Use Empty to erase.</p>
      <div class="object-palette" aria-label="Object palette">
        <button class="object-button empty${emptyActive}" data-object-slot="${ZONE_OBJECT_EMPTY}" title="Empty object cell">
          <span>Empty</span>
        </button>
        ${set.objects.map((object, index) => objectButtonHtml(set, object, index)).join("")}
      </div>
      <div class="object-pattern-grid" aria-label="Repeating cliff wall pattern">
        ${objectPattern
          .map((row, rowIndex) =>
            row
              .map((slot, colIndex) => objectPatternCellHtml(set, slot, rowIndex, colIndex))
              .join(""),
          )
          .join("")}
      </div>
    </div>
  `;
}

function objectButtonHtml(set, object, index) {
  const active = index === state.selectedObjectSlot ? " active" : "";
  return `
    <button
      class="object-button${active}"
      data-object-slot="${index}"
      title="${set.label} slot ${index}, frame ${object.srcFrame ?? index}"
      style="${objectPreviewStyle(set, object)}"
    >
      <span>${index}</span>
    </button>
  `;
}

function objectPatternCellHtml(set, slot, row, col) {
  const isEmpty = slot === ZONE_OBJECT_EMPTY || slot == null;
  const selected = slot === state.selectedObjectSlot ? " selected" : "";
  const object = isEmpty ? null : set.objects[G.positiveModulo(slot, set.objects.length)];
  return `
    <button
      class="object-pattern-cell${selected}${isEmpty ? " empty" : ""}"
      data-object-pattern-cell="true"
      data-row="${row}"
      data-col="${col}"
      title="Wall row ${row + 1}, column ${col + 1}: ${isEmpty ? "empty" : `slot ${slot}`}"
      ${object ? `style="${objectPreviewStyle(set, object, 1.35)}"` : ""}
    >
      <span>${isEmpty ? "" : slot}</span>
    </button>
  `;
}

function tileButtonHtml(set, tile, index) {
  const active = index === state.selectedTileSlot ? " active" : "";
  const frameLabel = tile.srcFrame ?? index;
  return `
    <button
      class="tile-button${active}"
      data-tile-slot="${index}"
      title="${set.label} slot ${index}, frame ${frameLabel}"
      style="${tilePreviewStyle(set, tile)}"
    >
      <span>${index}</span>
    </button>
  `;
}

function patternCellHtml(set, slot, row, col) {
  const tile = set.tiles[G.positiveModulo(slot, set.tiles.length)] ?? set.tiles[0];
  const selected = slot === state.selectedTileSlot ? " selected" : "";
  return `
    <button
      class="pattern-cell${selected}"
      data-pattern-cell="true"
      data-row="${row}"
      data-col="${col}"
      title="Row ${row + 1}, column ${col + 1}: slot ${slot}"
      style="${tilePreviewStyle(set, tile)}"
    >
      <span>${slot}</span>
    </button>
  `;
}

function tilePreviewStyle(set, tile) {
  const width = 48;
  const height = 32;
  const scale = width / set.slotWidth;
  return [
    `--tile-width:${width}px`,
    `--tile-height:${height}px`,
    `background-image:url("./public/maptiles/${set.sheet}")`,
    `background-size:${set.slotWidth * set.tiles.length * scale}px ${set.slotHeight * scale}px`,
    `background-position:${-(tile.slot * set.slotWidth * scale)}px 0px`,
  ].join(";");
}

function objectPreviewStyle(set, object, previewScale = 1) {
  const width = 34 * previewScale;
  const height = 34 * previewScale;
  const scale = Math.min(width / set.slotWidth, height / set.slotHeight);
  return [
    `--object-width:${width}px`,
    `--object-height:${height}px`,
    `background-image:url("./public/mapobjects/${set.sheet}")`,
    `background-size:${set.slotWidth * set.objects.length * scale}px ${set.slotHeight * scale}px`,
    `background-position:${-(object.slot * set.slotWidth * scale)}px 0px`,
  ].join(";");
}

function zonePatternExportText() {
  const target = zoneBuilderTarget();
  const draft = zoneBuilderDraft(target.id);
  const set = G.mapSetById(draft.mapSet) ?? currentMapSet();
  const objectSet = mapObjectSetById(draft.objectSet);
  const tileFrames = set?.tiles?.map((tile, slot) => ({ slot, frame: tile.srcFrame })) ?? [];
  return JSON.stringify(
    {
      id: target.id,
      label: target.label,
      mapSet: draft.mapSet,
      backdrop: draft.backdrop,
      edgeSet: draft.edgeSet,
      groundTopRows: draft.groundTopRows ?? 0,
      groundBottomRows: draft.groundBottomRows ?? 0,
      tilePattern: draft.tilePattern,
      tileFrames,
      objectSet: draft.objectSet,
      objectPattern: draft.objectPattern,
      objectFrames: G.objectFrameList(objectSet),
      decorationSet: draft.decorationSet ?? ZONE_DECORATION_SET,
      decorations: draft.decorations,
      repeat: {
        columns: draft.tilePattern[0]?.length ?? 0,
        rows: draft.tilePattern.length,
      },
    },
    null,
    2,
  );
}

function zoneLabel(zoneId) {
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId);
  if (zone?.label) return zone.label;
  const fallback = String(zoneId ?? "")
    .replace(/^zone-\d+-/, "")
    .split("-")
    .filter(Boolean)
    .map(title)
    .join(" ");
  return fallback || "Unknown";
}

function arenaBossSpawnWorldX(zone = activeZone()) {
  const configured = Number(zone?.arenaBossSpawnX);
  if (Number.isFinite(configured) && configured > 0) return Math.round(configured);
  return DEFAULT_ARENA_BOSS_SPAWN_X;
}

function activeZone() {
  return PROTOTYPE_ZONES.find((zone) => zone.id === state.game.activeZoneId) ?? null;
}

function zoneDropCandidates(zone, enemy = null) {
  return state.itemData.items
    .filter((item) => item.drop?.zones?.includes(zone.id))
    .map((item) => {
      const zoneChance = item.drop?.chances?.[zone.id];
      const enemyChance = item.drop?.enemyChances?.[String(enemy?.id)]?.[zone.id];
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

function mapStampArenaAnchorWorldX() {
  if (G.bossPartyOnField()) {
    const front = G.bossPartyFrontTarget() ?? G.bossPartyNextAliveMember();
    return Math.round(Number(front?.worldX ?? state.battle.playerX) || 0);
  }
  return Math.round(Number(state.battle.playerX) || 0);
}

function mapStampArenaWorldX() {
  const arenaLocked = state.battle.lockedArenaWorldX ?? state.battle.bossParty?.lockedArenaWorldX;
  if (arenaLocked != null) return arenaLocked;
  if (currentZoneMapStamp()) return mapStampArenaAnchorWorldX();
  if (G.bossPartyOnField()) {
    const front = G.bossPartyFrontTarget() ?? G.bossPartyNextAliveMember();
    const frontX = Number(front?.worldX ?? state.battle.playerX) || 0;
    const desiredEnemy = G.bossPartyDesiredEnemyX();
    const enemyX = Number.isFinite(desiredEnemy)
      ? desiredEnemy
      : (Number(state.battle.enemyX) || frontX + BOSS_PARTY_ENEMY_MELEE_GAP);
    return Math.round((frontX + enemyX) / 2);
  }
  const playerX = Number(state.battle.playerX) || 0;
  const enemyX = Number(state.battle.enemyX);
  if (state.battle.phase === "engaged" && Number.isFinite(enemyX)) {
    return Math.round((playerX + enemyX) / 2);
  }
  return Math.round(playerX + G.enemySpawnDistance() * 0.5);
}

function zoneStampBehindBackgroundCacheKey(stamp = currentZoneMapStamp()) {
  if (!stamp) return "";
  const anchor = mapStampAnchor(stamp);
  return [
    "zone-behind",
    stamp.id,
    state.game.activeZoneId,
    state.stageWidth,
    state.stageHeight,
    state.smooth ? 1 : 0,
    MAP_STAMP_ASSET_VERSION,
    arenaSpawnMapRow(),
    anchor.x,
    anchor.y,
  ].join("|");
}

function zoneMapStampSheetReady(stamp = currentZoneMapStamp()) {
  if (!stamp?.sheet) return false;
  return Boolean(G.cachedImage(`./public/mapstamps/${stamp.sheet}?v=${MAP_STAMP_ASSET_VERSION}`));
}

function zoneMapStampReplacesTiles(zone = activeZone()) {
  const stamp = currentZoneMapStamp();
  if (!stamp?.layers?.length) return false;
  if (zone?.mapStampOnly === true || state.game.mode === "mining") return true;
  const mapSetId = zone?.mapSet ?? currentMapSetId();
  const set = G.mapSetById(mapSetId);
  return !(set?.tiles?.length);
}

function arenaSpawnMapRow(zone = activeZone()) {
  const spot = state.game.mode === "mining" ? G.activeMiningSpot() : null;
  const spawnRow = Math.trunc(Number(spot?.arenaSpawnMap?.y ?? zone?.arenaSpawnMap?.y) || 0);
  if (spawnRow > 0) return spawnRow;
  const focusRow = Math.trunc(Number(spot?.arenaFocusMap?.y ?? zone?.arenaFocusMap?.y) || 0);
  return focusRow > 0 ? focusRow : 0;
}

function mapStampLayerDrawsOverEnemy(layer, spawnRow = arenaSpawnMapRow()) {
  if (!spawnRow || !layer) return false;
  if (layer.kind === "back" || layer.kind === "middle" || layer.floor) return false;
  if (layer.inFront === true) return true;
  const mapRow = Math.trunc(Number(layer.mapRow) || 0);
  return mapRow > spawnRow;
}

function mapStampHasForegroundLayers(stamp = currentZoneMapStamp(), spawnRow = arenaSpawnMapRow()) {
  return Boolean(stamp?.layers?.some((layer) => mapStampLayerDrawsOverEnemy(layer, spawnRow)));
}

function mapStampLayerIsGroundLightGlow(layer) {
  const match = /^(\d+):(\d+)$/.exec(String(layer?.source ?? ""));
  if (!match) return false;
  const slot = Number(match[1]);
  const frame = Number(match[2]);
  return slot === 2 && frame >= 2723 && frame <= 2732;
}

function mapStampDrawBase(stamp) {
  const anchor = mapStampAnchor(stamp);
  const scale = Math.max(0.1, Number(stamp.scale) || 1);
  const offsetX = Number(stamp.offsetX) || 0;
  const offsetY = Number(stamp.offsetY) || 0;
  const focusX = Number(stamp.focusX) || 0;
  const focusY = Number(stamp.focusY) || 0;
  const slotWidth = Math.max(1, Math.trunc(Number(stamp.slotWidth) || 1));
  const slotHeight = Math.max(1, Math.trunc(Number(stamp.slotHeight) || 1));
  const baseX = Math.round(anchor.x - focusX * scale + offsetX);
  const baseY = stamp.anchor === "townBottom"
    ? Math.round(anchor.y - Number(stamp.height) * scale + offsetY)
    : Math.round(anchor.y - focusY * scale + offsetY);
  return { baseX, baseY, scale, slotWidth, slotHeight };
}

function mapStampAnchor(stamp) {
  if (stamp.anchor === "townBottom") {
    return {
      x: Math.round(state.stageWidth * 0.5),
      y: Math.round(state.stageHeight - (Number(TOWN_VISUALS.mapStampBottomPadding) || 0)),
    };
  }
  if (stamp.anchor === "townCenter") {
    return {
      x: Math.round(state.stageWidth * 0.5),
      y: Math.round(state.stageHeight * 0.55),
    };
  }
  if (stamp.anchor === "arenaSpawn") {
    return {
      x: Math.round(mapStampArenaWorldX() - (state.battle.cameraX ?? 0)),
      y: Math.round(arenaLaneYPx()),
    };
  }
  if (stamp.anchor === "enemy" && state.battle.enemy) {
    return G.combatAnchor("enemy");
  }
  if (stamp.anchor === "player" && state.battle.player) {
    return G.combatAnchor("player");
  }
  return {
    x: Math.round(state.stageWidth * 0.5),
    y: Math.round(state.stageHeight * LANE.y),
  };
}

function decorationSpawnRow(decoration, worldX) {
  if (typeof decoration?.row === "number") return decoration.row;
  const rows = Array.isArray(decoration?.rows) && decoration.rows.length
    ? decoration.rows
    : currentZoneDecorationRows();
  if (!rows.length) return 0;
  const seed = Math.trunc(worldX) + G.hashDecorationSeed(String(decoration?.id ?? ""));
  return rows[G.positiveModulo(seed, rows.length)];
}

function currentMapSet() {
  return state.mapTileIndex.sets.find((set) => set.id === currentMapSetId()) ?? state.mapTileIndex.sets[0];
}

function zoneVisualDraft(zone = activeZone()) {
  if (!zone || state.game.mode !== "zone") return null;
  if (state.zoneBuilderPreviewZoneId !== zone.id) return null;
  return state.zoneBuilderDrafts[zone.id] ?? null;
}

function currentMapSetId() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "zone" && draft?.mapSet) return draft.mapSet;
  if (state.game.mode === "zone" && zone?.mapSet) return zone.mapSet;
  return state.mapSet;
}

function currentZonePattern() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "zone" && Array.isArray(draft?.tilePattern) && draft.tilePattern.length) {
    return draft.tilePattern;
  }
  if (state.game.mode === "zone" && Array.isArray(zone?.tilePattern) && zone.tilePattern.length) {
    return zone.tilePattern;
  }
  return state.zonePattern?.length ? state.zonePattern : DEFAULT_ZONE_PATTERN;
}

function currentZoneDecorations() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "zone" && draft && Object.hasOwn(draft, "decorations")) {
    return Array.isArray(draft.decorations) ? draft.decorations : [];
  }
  if (state.game.mode === "zone" && zone && Object.hasOwn(zone, "decorations")) {
    return Array.isArray(zone.decorations) ? zone.decorations : [];
  }
  return state.zoneDecorations;
}

function currentZoneDecorationRows() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "zone" && draft && Object.hasOwn(draft, "decorationRows")) {
    return Array.isArray(draft.decorationRows) ? draft.decorationRows : [];
  }
  if (state.game.mode === "zone" && zone && Object.hasOwn(zone, "decorationRows")) {
    return Array.isArray(zone.decorationRows) ? zone.decorationRows : [];
  }
  return [];
}

function currentZoneGroundRows() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  const top = state.game.mode === "zone" ? draft?.groundTopRows ?? zone?.groundTopRows ?? 0 : 0;
  const bottom = state.game.mode === "zone" ? draft?.groundBottomRows ?? zone?.groundBottomRows ?? 0 : 0;
  return {
    top: Math.max(0, Number(top) || 0),
    bottom: Math.max(0, Number(bottom) || 0),
  };
}

function currentZoneTileAnchor2x2() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "zone" && draft && Object.hasOwn(draft, "tileAnchor2x2")) {
    return draft.tileAnchor2x2 === true;
  }
  if (state.game.mode === "zone" && zone?.tileAnchor2x2 === true) {
    return true;
  }
  return false;
}

function currentZoneObjectSet() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  const objectSetId = state.game.mode === "zone" ? draft?.objectSet ?? zone?.objectSet : null;
  return objectSetId ? mapObjectSetById(objectSetId) : null;
}

function currentZoneObjectPattern() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "zone" && Array.isArray(draft?.objectPattern) && draft.objectPattern.length) {
    return draft.objectPattern;
  }
  if (state.game.mode === "zone" && Array.isArray(zone?.objectPattern) && zone.objectPattern.length) {
    return zone.objectPattern;
  }
  return [];
}

function currentZoneMapStamp() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  if (state.game.mode === "mining") {
    const spot = G.activeMiningSpot();
    const stampId = spot?.mapStamp ?? null;
    return stampId ? state.mapStampIndex.stamps.find((stamp) => stamp.id === stampId) ?? null : null;
  }
  if (state.game.mode !== "zone") return null;
  const stampId = draft?.mapStamp ?? zone?.mapStamp ?? null;
  return stampId ? state.mapStampIndex.stamps.find((stamp) => stamp.id === stampId) ?? null : null;
}

function currentZoneEdgeSet() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  const edgeSetId = state.game.mode === "zone" ? draft?.edgeSet ?? zone?.edgeSet : null;
  return edgeSetId ? CAVE_EDGE_SETS[edgeSetId] ?? null : null;
}

function zoneBuilderTarget() {
  return PROTOTYPE_ZONES.find((zone) => zone.id === state.zoneBuilderTargetId) ?? PROTOTYPE_ZONES[0];
}

function zoneBuilderDraft(zoneId = state.zoneBuilderTargetId) {
  const zone = PROTOTYPE_ZONES.find((entry) => entry.id === zoneId) ?? PROTOTYPE_ZONES[0];
  if (!state.zoneBuilderDrafts[zone.id]) {
    state.zoneBuilderDrafts[zone.id] = createZoneBuilderDraft(zone);
  }
  return state.zoneBuilderDrafts[zone.id];
}

function createZoneBuilderDraft(zone) {
  const hasZoneDecorations = Object.hasOwn(zone, "decorations");
  const objectPattern = Array.isArray(zone.objectPattern) && zone.objectPattern.length
    ? G.clonePattern(zone.objectPattern)
    : G.createEmptyObjectPattern();
  return {
    mapSet: zone.mapSet ?? state.mapSet,
    backdrop: zone.backdrop ?? "field",
    edgeSet: zone.edgeSet ?? null,
    groundTopRows: zone.groundTopRows ?? 0,
    groundBottomRows: zone.groundBottomRows ?? 0,
    decorationSet: zone.decorationSet ?? ZONE_DECORATION_SET,
    decorationRows: Array.isArray(zone.decorationRows) ? [...zone.decorationRows] : zone.decorationRows,
    objectSet: zone.objectSet ?? null,
    objectPattern,
    tilePattern: G.clonePattern(Array.isArray(zone.tilePattern) && zone.tilePattern.length ? zone.tilePattern : DEFAULT_ZONE_PATTERN),
    tileAnchor2x2: zone.tileAnchor2x2 === true,
    decorations: G.cloneDecorations(hasZoneDecorations ? zone.decorations : state.zoneDecorations),
  };
}

function currentMapObjectSet() {
  const zone = activeZone();
  const draft = zoneVisualDraft(zone);
  const decorationSetId = state.game.mode === "zone"
    ? draft?.decorationSet ?? zone?.decorationSet ?? ZONE_DECORATION_SET
    : ZONE_DECORATION_SET;
  return state.mapObjectIndex.sets.find((set) => set.id === decorationSetId) ?? state.mapObjectIndex.sets[0];
}

function mapObjectSetById(objectSetId) {
  return state.mapObjectIndex.sets.find((set) => set.id === objectSetId) ?? null;
}

function preferredMapSetOrder(sets) {
  const priority = ["wemade-mir2-custom", "oma-cave", "prajna-cave", "prajna-temple", "wooma-temple", "stone-temple", "zuma-temple", "wemade-mir2", "forest", "shanda-mir2", "wemade-mir3", "wood", "sand", "snow"];
  return [...sets].sort((a, b) => {
    const aIndex = priority.indexOf(a.id);
    const bIndex = priority.indexOf(b.id);
    const aRank = aIndex === -1 ? priority.length : aIndex;
    const bRank = bIndex === -1 ? priority.length : bIndex;
    return aRank - bRank || a.label.localeCompare(b.label);
  });
}

function arenaLaneYRatio(zone = activeZone()) {
  const ratio = Number(zone?.arenaLaneY);
  return Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : LANE.y;
}

function arenaLaneYPx(zone = activeZone()) {
  return Math.floor(state.stageHeight * arenaLaneYRatio(zone));
}


G.zoneObjectEditorHtml = zoneObjectEditorHtml;
G.objectButtonHtml = objectButtonHtml;
G.objectPatternCellHtml = objectPatternCellHtml;
G.tileButtonHtml = tileButtonHtml;
G.patternCellHtml = patternCellHtml;
G.tilePreviewStyle = tilePreviewStyle;
G.objectPreviewStyle = objectPreviewStyle;
G.zonePatternExportText = zonePatternExportText;
G.zoneLabel = zoneLabel;
G.arenaBossSpawnWorldX = arenaBossSpawnWorldX;
G.activeZone = activeZone;
G.zoneDropCandidates = zoneDropCandidates;
G.mapStampArenaAnchorWorldX = mapStampArenaAnchorWorldX;
G.mapStampArenaWorldX = mapStampArenaWorldX;
G.zoneStampBehindBackgroundCacheKey = zoneStampBehindBackgroundCacheKey;
G.zoneMapStampSheetReady = zoneMapStampSheetReady;
G.zoneMapStampReplacesTiles = zoneMapStampReplacesTiles;
G.arenaSpawnMapRow = arenaSpawnMapRow;
G.mapStampLayerDrawsOverEnemy = mapStampLayerDrawsOverEnemy;
G.mapStampHasForegroundLayers = mapStampHasForegroundLayers;
G.mapStampLayerIsGroundLightGlow = mapStampLayerIsGroundLightGlow;
G.mapStampDrawBase = mapStampDrawBase;
G.mapStampAnchor = mapStampAnchor;
G.decorationSpawnRow = decorationSpawnRow;
G.currentMapSet = currentMapSet;
G.zoneVisualDraft = zoneVisualDraft;
G.currentMapSetId = currentMapSetId;
G.currentZonePattern = currentZonePattern;
G.currentZoneDecorations = currentZoneDecorations;
G.currentZoneDecorationRows = currentZoneDecorationRows;
G.currentZoneGroundRows = currentZoneGroundRows;
G.currentZoneTileAnchor2x2 = currentZoneTileAnchor2x2;
G.currentZoneObjectSet = currentZoneObjectSet;
G.currentZoneObjectPattern = currentZoneObjectPattern;
G.currentZoneMapStamp = currentZoneMapStamp;
G.currentZoneEdgeSet = currentZoneEdgeSet;
G.zoneBuilderTarget = zoneBuilderTarget;
G.zoneBuilderDraft = zoneBuilderDraft;
G.createZoneBuilderDraft = createZoneBuilderDraft;
G.currentMapObjectSet = currentMapObjectSet;
G.mapObjectSetById = mapObjectSetById;
G.preferredMapSetOrder = preferredMapSetOrder;
G.arenaLaneYRatio = arenaLaneYRatio;
G.arenaLaneYPx = arenaLaneYPx;
