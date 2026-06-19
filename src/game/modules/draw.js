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

function drawTownCanvas(ctx, displayFrame) {
  drawTownMapCanvas(ctx);
  drawTownNpcs(ctx);
  drawPlayerCanvas(ctx, displayFrame);
  drawTownNameplates(ctx);
}

function drawTownMapCanvas(ctx) {
  const stamp = G.currentTownMapStamp();
  if (stamp?.layers?.length) {
    const key = G.townMapStampSheetReady(stamp) ? G.townStampBackgroundCacheKey(stamp) : "";
    const paint = (targetCtx) => {
      drawBackdropGradient(targetCtx);
      drawTownMapStamp(targetCtx, stamp);
    };
    if (key) G.blitCachedStampBackground(ctx, key, paint);
    else paint(ctx);
    return;
  }

  drawBackdropGradient(ctx);

  const set = G.currentMapSet();
  if (!set?.tiles?.length) return;

  const sheet = G.cachedImage(`./public/maptiles/${set.sheet}`);
  if (!sheet) return;

  const rows = Math.ceil(state.stageHeight / 28) + 4;
  const cols = Math.ceil(state.stageWidth / set.slotWidth) + 4;
  const baseY = Math.floor(state.stageHeight * 0.42);
  for (let row = 0; row < rows; row++) {
    for (let col = -2; col < cols; col++) {
      const slot = G.mapLaneTileSlot(set, row, col + row * 3);
      const x = col * set.slotWidth + (row % 2 ? Math.floor(set.slotWidth / 2) : 0) - 24;
      const y = baseY + row * 28 - 58;
      drawMapTile(ctx, sheet, set, slot, x, y);
    }
  }
}

function drawTownMapStamp(ctx, stamp) {
  const townStamp = {
    ...stamp,
    anchor: "townCenter",
    offsetY: (Number(stamp.offsetY) || 0)
      + (Number(TOWN_VISUALS.mapStampOffsetY) || 0)
      + G.townViewOffsetYPx(),
  };
  const layers = (townStamp.layers ?? []).filter((layer) => !G.mapStampLayerIsGroundLightGlow(layer));
  drawStampLayerBatch(ctx, townStamp, layers);
}

function drawTownNpcs(ctx) {
  for (const npc of TOWN_NPCS) {
    const bounds = G.townNpcBounds(npc);
    const selected = npc.id === state.game.selectedTownNpcId;
    ctx.save();
    ctx.fillStyle = selected ? "rgba(216, 176, 92, 0.34)" : "rgba(0, 0, 0, 0.24)";
    ctx.beginPath();
    ctx.ellipse(bounds.centerX, bounds.bottomY - 4, bounds.width * 0.55, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!drawTownNpcSprite(ctx, npc, bounds)) {
      drawTownNpcPlaceholder(ctx, bounds, selected);
    }
    if (selected) {
      ctx.strokeStyle = "#d8b05c";
      ctx.strokeRect(bounds.left + 0.5, bounds.top + 0.5, bounds.width - 1, bounds.height - 1);
    }
    ctx.restore();
  }
}

function drawTownNpcSprite(ctx, npc, bounds) {
  const atlas = state.townNpcAtlases[npc.sprite];
  const layer = atlas?.layers?.[0];
  if (!layer?.frames?.length) return false;
  const sheet = G.cachedImage(`./public/npcs/${npc.sprite}/${layer.sheet}`);
  if (!sheet) return false;

  const totalDuration = layer.interval * layer.frames.length;
  const frameIndex = Math.floor((performance.now() % totalDuration) / layer.interval);
  const meta = layer.frames[frameIndex] ?? layer.frames[0];
  if (!meta || meta.empty) return false;
  const baseMeta = layer.frames[0] ?? meta;
  const offsetX = (meta.offsetX ?? 0) - (baseMeta.offsetX ?? 0);
  const offsetY = (meta.offsetY ?? 0) - (baseMeta.offsetY ?? 0);

  ctx.drawImage(
    sheet,
    meta.slot * layer.slotWidth,
    0,
    layer.slotWidth,
    layer.slotHeight,
    Math.round(bounds.centerX - layer.slotWidth / 2 + offsetX),
    Math.round(bounds.bottomY - layer.slotHeight + offsetY),
    layer.slotWidth,
    layer.slotHeight,
  );
  return true;
}

function drawTownNpcPlaceholder(ctx, bounds, selected) {
  ctx.fillStyle = "#3e3328";
  ctx.fillRect(bounds.left + 12, bounds.top + 26, bounds.width - 24, bounds.height - 30);
  ctx.fillStyle = "#6c4b32";
  ctx.fillRect(bounds.left + 8, bounds.top + 32, bounds.width - 16, 24);
  ctx.fillStyle = "#d8bd93";
  ctx.fillRect(bounds.left + 14, bounds.top + 8, bounds.width - 28, 24);
  ctx.fillStyle = "#2b211b";
  ctx.fillRect(bounds.left + 10, bounds.top + 4, bounds.width - 20, 10);
  ctx.strokeStyle = selected ? "#d8b05c" : "rgba(255, 238, 196, 0.32)";
  ctx.strokeRect(bounds.left + 0.5, bounds.top + 0.5, bounds.width - 1, bounds.height - 1);
}

function drawTownNameplates(ctx) {
  const hoveredNpc = TOWN_NPCS.find((npc) => npc.id === state.game.hoveredTownNpcId);
  if (!hoveredNpc) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 12px Segoe UI, system-ui, sans-serif";
  const bounds = G.townNpcBounds(hoveredNpc);
  const text = hoveredNpc.label;
  const width = Math.max(72, ctx.measureText(text).width + 16);
  const x = Math.round(bounds.centerX);
  const y = Math.round(bounds.top - 12);
  ctx.fillStyle = "rgba(10, 10, 8, 0.78)";
  ctx.fillRect(Math.round(x - width / 2), y - 10, width, 20);
  ctx.strokeStyle = "rgba(255, 238, 196, 0.48)";
  ctx.strokeRect(Math.round(x - width / 2) + 0.5, y - 9.5, width - 1, 19);
  ctx.fillStyle = "#f4ddb0";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawMapCanvas(ctx) {
  const stamp = G.currentZoneMapStamp();
  if (stamp?.layers?.length && G.zoneMapStampReplacesTiles()) {
    const key = G.zoneMapStampSheetReady(stamp) ? G.zoneStampBehindBackgroundCacheKey(stamp) : "";
    const paint = (targetCtx) => {
      drawBackdropGradient(targetCtx);
      drawZoneMapStampLayers(targetCtx, "behind");
    };
    if (key) G.blitCachedStampBackground(ctx, key, paint);
    else paint(ctx);
    return;
  }

  const set = G.currentMapSet();
  if (!set?.tiles?.length) {
    ctx.fillStyle = "#151512";
    ctx.fillRect(0, 0, state.stageWidth, state.stageHeight);
    return;
  }
  const sheet = G.cachedImage(`./public/maptiles/${set.sheet}`);
  drawBackdropGradient(ctx);
  if (!sheet) return;

  const edgeGroundRowOffset = G.currentZoneEdgeSet()?.skipTopGroundRows ?? 0;
  const groundRows = G.currentZoneGroundRows();
  const firstGroundRow = edgeGroundRowOffset - groundRows.top;
  const rows = 5 + edgeGroundRowOffset + groundRows.bottom;
  const cols = Math.ceil(state.stageWidth / set.slotWidth) + 10;
  const baseY = Math.floor(state.stageHeight * LANE.y) - 34;
  const tileCameraX = (state.battle.cameraX ?? 0) * LANE.tileScrollRatio;
  const scrollCameraX = G.movementTestScrollCameraX(tileCameraX);
  const scroll = Math.floor(G.positiveModulo(scrollCameraX, set.slotWidth));
  const tileColumn = Math.floor(scrollCameraX / set.slotWidth);

  drawCaveEdgeStrip(ctx, scrollCameraX, baseY, "top");

  const tileAnchor2x2 = G.currentZoneTileAnchor2x2();
  if (tileAnchor2x2) {
    // Crystal back tiles use 32px row step; lane row math uses 28px — convert by pixel coverage.
    const lastLaneRow = rows - 1;
    const firstAnchorRow = Math.floor((firstGroundRow * MAP_LANE_ROW_STEP) / MAP_TILE_ANCHOR_ROW_STEP);
    const lastAnchorRowFromLane = Math.ceil((lastLaneRow * MAP_LANE_ROW_STEP) / MAP_TILE_ANCHOR_ROW_STEP) + 1;
    const sampleTile = set.tiles[0];
    const tileDrawBottom = (Number(sampleTile?.offsetY) || 0)
      + (Number(sampleTile?.h) || set.slotHeight)
      - 58;
    const minAnchorForStage = Math.ceil((state.stageHeight - baseY - tileDrawBottom) / MAP_TILE_ANCHOR_ROW_STEP);
    const lastAnchorRow = Math.max(lastAnchorRowFromLane, minAnchorForStage + 1);
    const firstDrawAnchorRow = firstAnchorRow % 2 === 0 ? firstAnchorRow : firstAnchorRow + 1;
    for (let anchorRow = firstDrawAnchorRow; anchorRow < lastAnchorRow; anchorRow += 2) {
      for (let col = -5; col < cols; col++) {
        const worldColumn = col + tileColumn;
        const slot = G.mapAnchor2x2TileSlot(set, anchorRow, worldColumn);
        const { x, y } = G.mapTilePositionAnchor2x2(set, anchorRow, col, scroll, baseY);
        drawMapTile(ctx, sheet, set, slot, x, y);
      }
    }
  } else {
    for (let row = firstGroundRow; row < rows; row++) {
      for (let col = -5; col < cols; col++) {
        const worldColumn = col + tileColumn;
        const slot = G.mapLaneTileSlot(set, row, worldColumn);
        const { x, y } = G.mapTilePosition(set, row, col, scroll, baseY);
        drawMapTile(ctx, sheet, set, slot, x, y);
      }
    }
  }

  drawZoneMapStamp(ctx);
  drawZoneDecorations(ctx, scrollCameraX, baseY);
}

function drawMapTile(ctx, sheet, set, slot, x, y, alpha = 1) {
  const tile = set.tiles[G.positiveModulo(slot, set.tiles.length)];
  if (!tile) return;
  const sourceW = Number(tile.w) || set.slotWidth;
  const sourceH = Number(tile.h) || set.slotHeight;
  const destX = x + (Number(tile.offsetX) || 0);
  const destY = y + (Number(tile.offsetY) || 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    sheet,
    tile.slot * set.slotWidth,
    0,
    sourceW,
    sourceH,
    destX,
    destY,
    sourceW,
    sourceH,
  );
  ctx.restore();
}

function drawStampLayerBatch(ctx, stamp, layers) {
  if (!stamp?.sheet || !layers?.length) return;
  const sheet = G.cachedImage(`./public/mapstamps/${stamp.sheet}?v=${MAP_STAMP_ASSET_VERSION}`);
  if (!sheet) return;

  const { baseX, baseY, scale, slotWidth, slotHeight } = G.mapStampDrawBase(stamp);

  ctx.save();
  for (const layer of layers) {
    const layerWidth = Math.max(1, Math.trunc(Number(layer.w) || slotWidth));
    const layerHeight = Math.max(1, Math.trunc(Number(layer.h) || slotHeight));
    const { sx, sy } = G.stampSheetSlotOrigin(stamp, layer.slot);
    ctx.drawImage(
      sheet,
      sx,
      sy,
      layerWidth,
      layerHeight,
      baseX + Math.round((Number(layer.x) || 0) * scale),
      baseY + Math.round((Number(layer.y) || 0) * scale),
      Math.round(layerWidth * scale),
      Math.round(layerHeight * scale),
    );
  }
  ctx.restore();
}

function drawStampArenaEntityLayers(ctx, displayFrame) {
  if (!G.shouldUseStampArenaEntityLayers()) return false;
  const stamp = G.currentZoneMapStamp();
  const spawnRow = G.arenaSpawnMapRow();
  const entities = G.buildStampArenaDrawList(displayFrame);
  const fgByRow = G.stampForegroundLayersByRow(stamp, spawnRow);
  const rows = new Set([spawnRow, ...fgByRow.keys()]);
  for (const entity of entities) rows.add(entity.zRow);
  const sortedRows = [...rows].sort((a, b) => a - b);

  for (const row of sortedRows) {
    const fgLayers = fgByRow.get(row);
    if (fgLayers?.length) drawStampLayerBatch(ctx, stamp, fgLayers);
    const rowEntities = entities
      .filter((entity) => entity.zRow === row)
      .sort((a, b) => a.worldX - b.worldX || a.kindRank - b.kindRank);
    for (const entity of rowEntities) entity.draw(ctx);
  }
  return true;
}

function drawZoneMapStampLayers(ctx, depth = "behind") {
  const stamp = G.currentZoneMapStamp();
  if (!stamp?.layers?.length || !stamp.sheet) return;
  const spawnRow = G.arenaSpawnMapRow();
  const hasForeground = G.mapStampHasForegroundLayers(stamp, spawnRow);
  const layers = stamp.layers.filter((layer) => {
    const inFront = G.mapStampLayerDrawsOverEnemy(layer, spawnRow);
    if (!hasForeground) return true;
    if (depth === "behind") return !inFront;
    if (depth === "front") return inFront;
    return true;
  });
  drawStampLayerBatch(ctx, stamp, layers);
}

function drawZoneMapStamp(ctx) {
  drawZoneMapStampLayers(ctx, "behind");
}

function drawZoneMapStampForeground(ctx) {
  if (!G.mapStampHasForegroundLayers()) return;
  drawZoneMapStampLayers(ctx, "front");
}

function drawZoneDecorations(ctx, scrollCameraX, baseY) {
  const set = G.currentMapObjectSet();
  const decorations = G.currentZoneDecorations();
  if (set?.objects?.length && decorations.length) {
    const sheet = G.cachedImage(`./public/mapobjects/${set.sheet}`);
    if (sheet) {
      for (const decoration of decorations) {
        if (!Array.isArray(decoration.slots) || !decoration.slots.length) continue;

        const repeatEvery = decoration.repeatEvery ?? 0;
        const startX = repeatEvery > 0
          ? decoration.worldX - Math.ceil((decoration.worldX - scrollCameraX) / repeatEvery) * repeatEvery
          : decoration.worldX;
        const copies = repeatEvery > 0 ? Math.ceil(state.stageWidth / repeatEvery) + 3 : 1;
        for (let copy = 0; copy < copies; copy++) {
          const worldX = startX + copy * (repeatEvery || 0);
          const screenX = Math.floor(worldX - scrollCameraX);
          const decorWidth = decoration.slots.reduce((max, slotIndex) => {
            const object = set.objects[G.positiveModulo(slotIndex, set.objects.length)];
            return Math.max(max, Number(object?.w) || set.slotWidth);
          }, set.slotWidth);
          if (screenX < -decorWidth - 48 || screenX > state.stageWidth + 48) continue;
          const row = G.decorationSpawnRow(decoration, worldX);
          const y = Math.floor(baseY + row * 28 - set.slotHeight + 28);
          drawObjectPair(ctx, sheet, set, decoration.slots, screenX, y);
        }
      }
    }
  }

  drawZoneObjectPattern(ctx, scrollCameraX, baseY);
}

function drawZoneObjectPattern(ctx, scrollCameraX, baseY) {
  const pattern = G.currentZoneObjectPattern();
  if (!pattern.length) return;
  const set = G.currentZoneObjectSet();
  if (!set?.objects?.length) return;
  const sheet = G.cachedImage(`./public/mapobjects/${set.sheet}`);
  if (!sheet) return;

  const scroll = Math.floor(G.positiveModulo(scrollCameraX, set.slotWidth));
  const objectColumn = Math.floor(scrollCameraX / set.slotWidth);
  const cols = Math.ceil(state.stageWidth / set.slotWidth) + 10;
  const wallTop = Math.floor(baseY - 132);
  for (let row = 0; row < pattern.length; row++) {
    const rowPattern = pattern[row];
    if (!rowPattern?.length) continue;
    for (let col = -5; col < cols; col++) {
      const worldColumn = col + objectColumn;
      const slot = rowPattern[G.positiveModulo(worldColumn, rowPattern.length)];
      if (slot === ZONE_OBJECT_EMPTY || slot == null) continue;
      const object = set.objects[G.positiveModulo(slot, set.objects.length)];
      if (!object) continue;
      const x = col * set.slotWidth - scroll - 24;
      const y = wallTop + row * 32;
      ctx.drawImage(
        sheet,
        object.slot * set.slotWidth,
        0,
        set.slotWidth,
        set.slotHeight,
        x,
        y,
        set.slotWidth,
        set.slotHeight,
      );
    }
  }
}

function drawObjectPair(ctx, sheet, set, slots, x, y) {
  let offsetX = 0;
  for (let index = 0; index < slots.length; index++) {
    const object = set.objects[G.positiveModulo(slots[index], set.objects.length)];
    if (!object) continue;
    const width = Math.max(1, Number(object.w) || set.slotWidth);
    const height = Math.max(1, Number(object.h) || set.slotHeight);
    const sourceX = object.slot * set.slotWidth;
    const sourceY = set.slotHeight - height;
    const destY = y + (set.slotHeight - height);
    ctx.drawImage(
      sheet,
      sourceX,
      sourceY,
      width,
      height,
      x + offsetX,
      destY,
      width,
      height,
    );
    offsetX += width;
  }
}

function drawCaveEdgeStrip(ctx, scrollCameraX, baseY, edgeName) {
  const edgeSet = G.currentZoneEdgeSet();
  const edge = edgeSet?.[edgeName];
  if (!edge?.src) return;

  const y = Math.round(baseY + (edge.yOffsetFromBase ?? 0));
  const clipTop = edgeName === "bottom"
    ? Math.max(0, Math.round(baseY + (edge.clipTopOffsetFromBase ?? 0)))
    : 0;
  const clipBottom = edgeName === "top"
    ? Math.min(state.stageHeight, Math.round(baseY + (edge.clipBottomOffsetFromBase ?? 0)))
    : state.stageHeight;

  if (clipBottom <= clipTop) return;
  drawRepeatingCaveEdge(ctx, edge, scrollCameraX, y, clipTop, clipBottom);
}

function drawRepeatingCaveEdge(ctx, edge, scrollCameraX, y, clipTop = 0, clipBottom = state.stageHeight) {
  if (!edge?.src) return false;
  const image = G.cachedImage(edge.src);
  if (!image) return false;

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return false;

  const scroll = G.positiveModulo(scrollCameraX * (edge.scrollRatio ?? 1), width);
  const startX = Math.floor(-scroll) - width;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipTop, state.stageWidth, clipBottom - clipTop);
  ctx.clip();
  for (let x = startX; x < state.stageWidth + width; x += width) {
    ctx.drawImage(image, Math.round(x), y, width, height);
  }
  ctx.restore();
  return true;
}

function drawBackdropGradient(ctx) {
  if (G.currentBackdropKind() === "cave") {
    const cave = ctx.createLinearGradient(0, 0, 0, state.stageHeight);
    cave.addColorStop(0, "#030303");
    cave.addColorStop(0.42, "#080706");
    cave.addColorStop(0.45, "#0d0a08");
    cave.addColorStop(1, "#17110c");
    ctx.fillStyle = cave;
    ctx.fillRect(0, 0, state.stageWidth, state.stageHeight);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, state.stageHeight);
  sky.addColorStop(0, "#0b100e");
  sky.addColorStop(0.44, "#111814");
  sky.addColorStop(0.45, "#15150f");
  sky.addColorStop(1, "#191611");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.stageWidth, state.stageHeight);
}

function drawGroupDungeonSwarmEnemyCanvas(ctx, enemy) {
  if (!state.showEnemies || !enemy) return;
  const atlas = enemy.atlas;
  const clip = atlas?.actions?.[enemy.action];
  const meta = clip?.frames?.[enemy.frame] ?? clip?.frames?.[0];
  if (!atlas || !clip || !meta || meta.empty) return;
  const sheet = G.cachedImage(`./public/monsters/monster/${enemy.monsterIndex}.png`);
  if (!sheet) return;
  const { x: anchorX, y: anchorY } = G.swarmEnemyScreenAnchor(enemy);
  drawAtlasFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, anchorX, anchorY);
  drawEnemyActionBlendCanvas(ctx, atlas, sheet, anchorX, anchorY, enemy.action, enemy.frame);
}

function drawEnemyCanvas(ctx) {
  if (!state.showEnemies) return;
  if (G.groupDungeonSwarmActive()) return;
  if (!state.battle.enemyRevealed && state.enemy.action !== "show") return;
  const atlas = state.enemy.atlas;
  const clip = atlas?.actions?.[state.enemy.action];
  const meta = clip?.frames?.[state.enemy.frame] ?? clip?.frames?.[0];
  if (!atlas || !clip || !meta || meta.empty) return;
  const sheet = G.cachedImage(`./public/monsters/monster/${state.enemy.index}.png`);
  if (!sheet) return;
  const { x: anchorX, y: anchorY } = G.combatAnchor("enemy");
  drawAtlasFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, anchorX, anchorY);
  drawEnemyActionBlendCanvas(ctx, atlas, sheet, anchorX, anchorY, state.enemy.action, state.enemy.frame);
  drawEnemyFrostDebuffOverlay(ctx);
}

function drawEnemyActionBlendCanvas(ctx, atlas, sheet, anchorX, anchorY, action, frame) {
  const blendKey = G.enemyActionBlendKey(action);
  const blendClip = blendKey ? atlas?.actions?.[blendKey] : null;
  if (!blendClip?.frames?.length) return;
  const frameIndex = Math.max(0, Math.min(frame, blendClip.frames.length - 1));
  const blendMeta = blendClip.frames[frameIndex];
  if (!blendMeta || blendMeta.empty) return;
  G.withScreenBlend(ctx, () => {
    drawAtlasFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, blendMeta, anchorX, anchorY);
  });
}

function drawEnemyRangeProjectileCanvas(ctx) {
  const strike = state.battle.pendingEnemyStrike;
  if (!strike?.ranged || !G.enemyHasRangedMeleeAttack()) return;
  const atlas = state.enemy.atlas;
  const projectile = atlas?.projectile;
  if (!projectile?.frames?.length) return;
  const sheet = G.cachedImage(`./public/monsters/monster/${state.enemy.index}.png`);
  if (!sheet) return;
  const now = performance.now();
  const startedAt = Number(strike.startedAt) || (strike.at - (strike.moveDurationMs ?? BONE_LORD_ATTACK_IMPACT_MS));
  const moveDurationMs = Math.max(1, Number(strike.moveDurationMs) || (strike.at - startedAt));
  const slotWidth = projectile.slotWidth ?? atlas.slotWidth;
  const slotHeight = projectile.slotHeight ?? atlas.slotHeight;
  const style = projectile.style ?? "travel";

  if (style === "targetBurst") {
    if (G.isMinotaurKingEnemy() && !G.minotaurKingStrikeUsesAoe(strike)) return;
    const burstDurationMs = Math.max(1, Number(projectile.burstDurationMs) || 300);
    const burstDelayMs = Number(projectile.burstDelayMs);
    const burstStartAt = Number.isFinite(burstDelayMs)
      ? startedAt + Math.max(0, burstDelayMs)
      : strike.at - burstDurationMs;
    const burstEndAt = Number.isFinite(burstDelayMs)
      ? (Number(strike.vfxUntil) || burstStartAt + burstDurationMs)
      : strike.at;
    if (now < burstStartAt || now > burstEndAt) return;
    const frameIndex = Math.min(
      projectile.frames.length - 1,
      Math.floor((now - burstStartAt) / Math.max(1, projectile.interval ?? 60)),
    );
    const meta = projectile.frames[frameIndex] ?? projectile.frames[0];
    if (!meta || meta.empty) return;
    const targetAnchor = G.boneLordProjectileTargetAnchor();
    const frameSlotWidth = projectile.frameSlotWidth ?? slotWidth;
    const frameSlotHeight = projectile.frameSlotHeight ?? slotHeight;
    G.withScreenBlend(ctx, () => {
      drawAtlasFrame(
        ctx,
        sheet,
        frameSlotWidth,
        frameSlotHeight,
        { ...meta, offsetX: meta.offsetX + targetAnchor.x, offsetY: meta.offsetY + targetAnchor.y },
        0,
        0,
      );
    });
    return;
  }

  if (now < startedAt || now > strike.at) return;
  const travelT = Math.min(1, Math.max(0, (now - startedAt) / moveDurationMs));
  const frameIndex = Math.min(
    projectile.frames.length - 1,
    Math.floor((now - startedAt) / Math.max(1, projectile.interval ?? 30)) % projectile.frames.length,
  );
  const meta = projectile.frames[frameIndex] ?? projectile.frames[0];
  if (!meta || meta.empty) return;
  const enemyAnchor = G.combatAnchor("enemy");
  const targetAnchor = G.boneLordProjectileTargetAnchor();
  const x = enemyAnchor.x + (targetAnchor.x - enemyAnchor.x) * travelT;
  const y = enemyAnchor.y + (targetAnchor.y - enemyAnchor.y) * travelT;
  G.withScreenBlend(ctx, () => {
    drawAtlasFrame(
      ctx,
      sheet,
      slotWidth,
      slotHeight,
      { ...meta, offsetX: meta.offsetX + x, offsetY: meta.offsetY + y },
      0,
      0,
    );
  });
}

function drawEnemyAttackBlendCanvas(ctx, atlas, sheet, anchorX, anchorY) {
  drawEnemyActionBlendCanvas(ctx, atlas, sheet, anchorX, anchorY, "attack1", state.enemy.frame);
}

function drawTaoistPetCanvas(ctx) {
  const pet = state.battle.taoPet;
  if (!state.showEnemies || !pet || (!pet.active && !pet.dead)) return;
  const atlas = G.taoPetAtlasFor(pet);
  const clip = atlas?.actions?.[pet.action];
  const meta = clip?.frames?.[pet.frame] ?? clip?.frames?.[0];
  if (!atlas || !clip || !meta || meta.empty) return;
  const sheet = G.cachedImage(`./public/monsters/monster/${G.taoistPetRenderMonsterIndex(pet)}.png`);
  if (!sheet) return;
  const { x: anchorX, y: anchorY } = G.taoistPetAnchor();
  drawAtlasFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, anchorX, anchorY);
  if (pet.spellId === "SummonShinsu" && pet.shinsuVisible && pet.action === "attack1") {
    const breathFrame = pet.frame - CRYSTAL_SHINSU_ATTACK_IMPACT_FRAME;
    if (breathFrame >= 0) {
      drawEnemyActionBlendCanvas(ctx, atlas, sheet, anchorX, anchorY, "attack1", breathFrame);
    }
  }
}

function drawUnitHealthBar(ctx, bounds, hp, maxHp) {
  const width = 30;
  const height = 4;
  const x = Math.round(bounds.centerX - width / 2);
  const y = Math.round(bounds.topY - 9);
  const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = "#3b1513";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#a82622";
  ctx.fillRect(x, y, Math.round(width * pct), height);
  ctx.strokeStyle = "rgba(255, 226, 198, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
  ctx.restore();
}

function drawGroupDungeonSwarmHealthBars(ctx) {
  const swarm = state.battle.swarm;
  if (!swarm?.enemies?.length) return;
  for (const enemy of swarm.enemies) {
    if (enemy.dying || enemy.hp <= 0 || enemy.hp >= enemy.maxHp) continue;
    drawUnitHealthBar(ctx, G.swarmEnemyFrameBounds(enemy), enemy.hp, enemy.maxHp);
  }
}

function drawEnemyHealthBar(ctx) {
  if (!state.showEnemies || !state.battle.enemyRevealed) return;
  if (!state.battle.running && state.battle.phase === "idle") return;
  if (G.groupDungeonSwarmActive()) {
    drawGroupDungeonSwarmHealthBars(ctx);
    return;
  }
  if (!state.battle.enemy || state.battle.enemy.hp <= 0) return;
  drawUnitHealthBar(ctx, G.enemyFrameBounds(), state.battle.enemy.hp, state.battle.enemy.maxHp);
}

function drawTaoistPetHealthBar(ctx) {
  const pet = state.battle.taoPet;
  if (!state.showEnemies || !pet?.active || pet.hp <= 0) return;
  if (!state.battle.running && state.battle.phase === "idle") return;
  const bounds = G.taoistPetFrameBounds();
  const width = 30;
  const height = 4;
  const x = Math.round(bounds.centerX - width / 2);
  const y = Math.round(bounds.topY - 9);
  const pct = Math.max(0, Math.min(1, pet.hp / Math.max(1, pet.maxHp)));

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = "#1d2d1c";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#4fa34d";
  ctx.fillRect(x, y, Math.round(width * pct), height);
  ctx.strokeStyle = "rgba(221, 245, 201, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
  ctx.restore();
}

function drawEnemyPoisonDots(ctx) {
  const enemy = state.battle.enemy;
  const poisons = Array.isArray(enemy?.poisons) ? enemy.poisons.filter((poison) => (Number(poison.ticksRemaining) || 0) > 0) : [];
  if (!state.showEnemies || !enemy || enemy.hp <= 0 || !poisons.length) return;
  const bounds = G.enemyFrameBounds();
  const size = 4;
  const gap = 3;
  const totalWidth = poisons.length * size + (poisons.length - 1) * gap;
  let x = Math.round(bounds.centerX - totalWidth / 2);
  const y = Math.round(bounds.topY - 18);

  ctx.save();
  for (const poison of poisons) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
    ctx.fillStyle = poison.kind === "green" ? "#35b457" : "#d8b54f";
    ctx.fillRect(x, y, size, size);
    x += size + gap;
  }
  ctx.restore();
}

function drawEnemyFrostDebuffOverlay(ctx, now = performance.now()) {
  const enemy = state.battle.enemy;
  if (!state.showEnemies || !enemy || enemy.hp <= 0) return;
  const frozen = G.enemyFrozenActive(enemy, now);
  const slowed = !frozen && G.enemySlowActive(enemy, now);
  if (!frozen && !slowed) return;

  const bounds = G.enemyFrameBounds();
  const width = Math.max(48, Math.round(bounds.width ?? 96));
  const height = Math.max(64, Math.round(bounds.height ?? 112));
  const x = Math.round(bounds.centerX - width / 2);
  const y = Math.round(bounds.topY);
  const pulse = 0.82 + Math.sin(now / 160) * 0.18;

  ctx.save();
  ctx.fillStyle = frozen
    ? `rgba(168, 232, 255, ${0.38 * pulse})`
    : `rgba(118, 188, 255, ${0.24 * pulse})`;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = frozen ? "rgba(214, 244, 255, 0.72)" : "rgba(164, 214, 255, 0.52)";
  ctx.lineWidth = frozen ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.restore();
}

function drawEnemyDebuffBadges(ctx, now = performance.now()) {
  const enemy = state.battle.enemy;
  if (!state.showEnemies || !enemy || enemy.hp <= 0) return;
  const frozen = G.enemyFrozenActive(enemy, now);
  const slowed = !frozen && G.enemySlowActive(enemy, now);
  if (!frozen && !slowed) return;

  const bounds = G.enemyFrameBounds();
  const label = frozen ? "Frozen" : "Slow";
  const y = Math.round(bounds.topY - 34);

  ctx.save();
  ctx.font = "700 10px Segoe UI, system-ui, sans-serif";
  const textWidth = Math.ceil(ctx.measureText(label).width);
  const padX = 6;
  const boxW = textWidth + padX * 2;
  const boxH = 16;
  const x = Math.round(bounds.centerX - boxW / 2);
  ctx.fillStyle = "rgba(8, 18, 28, 0.82)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = frozen ? "#b8ecff" : "#8ec8ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = frozen ? "#dff7ff" : "#c8e8ff";
  ctx.fillText(label, bounds.centerX, y + boxH / 2);
  ctx.restore();
}

function drawPlayerCanvas(ctx, displayFrame) {
  const { x: anchorX, y: anchorY } = G.combatAnchor("player");
  for (const layer of G.layerNames()) {
    const atlas = state.atlases[layer];
    const index = state.indexes[layer];
    const clip = atlas?.actions?.[state.action];
    const meta = clip?.frames?.[displayFrame] ?? clip?.frames?.[0];
    if (!atlas || !clip || !meta || meta.empty) continue;
    const sheet = G.cachedImage(sheetUrl(state.spriteSet, layer, index));
    if (!sheet) continue;
    drawAtlasFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, anchorX, anchorY);
  }
}

function drawAtlasFrame(ctx, sheet, slotWidth, slotHeight, meta, anchorX, anchorY) {
  ctx.drawImage(
    sheet,
    meta.slot * slotWidth,
    0,
    slotWidth,
    slotHeight,
    anchorX + meta.offsetX,
    anchorY + meta.offsetY,
    slotWidth,
    slotHeight,
  );
}

function drawSpellFxCanvas(ctx, bodyFrame, bodyFrameCount) {
  const atlas = state.spellAtlas;
  if (!atlas) return;
  const { x: anchorX, y: anchorY } = G.combatAnchor("player");
  const now = performance.now();
  const durations = atlas.layers.map((layer) => layer.frames.length * layer.interval);
  if (atlas.projectile) durations.push(atlas.projectile.delayMs + atlas.projectile.moveDurationMs);
  const spellDriven = state.syncBodyToSpell && state.spell !== "None";
  const bodyMs = bodyFrameCount * (G.currentClip()?.interval ?? 100);
  const cycleMs = spellDriven ? Math.max(bodyMs, ...durations) + state.castCooldownMs : Math.max(1, ...durations);
  const t = (now - state.spellStartedAt) % cycleMs;
  if (spellDriven && t >= cycleMs - state.castCooldownMs) return;

  G.withScreenBlend(ctx, () => {
    for (const layer of atlas.layers) {
      const frameIndex =
        state.syncBodyToSpell && layer.frames.length === bodyFrameCount
          ? Math.min(layer.frames.length - 1, bodyFrame)
          : Math.min(layer.frames.length - 1, Math.floor(t / layer.interval));
      drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, anchorX, anchorY);
    }
    if (atlas.projectile) drawProjectileCanvas(ctx, atlas, t, anchorX, anchorY);
  });
}

function drawTwinDrakeReadyFxCanvas(ctx) {
  const atlas = state.warriorSkillAtlases.TwinDrakeBlade;
  const chargeLayer = G.warriorSkillFxLayers("TwinDrakeBlade", "charge")[0];
  const now = performance.now();
  const entries = G.twinDrakeChargeFxEntries(now);
  if (!atlas || !chargeLayer?.frames?.length || !entries.length) return;

  G.withScreenBlend(ctx, () => {
    for (const entry of entries) {
      const frameIndex = G.spellFxLayerFrameIndex(chargeLayer, entry.startedAt, now);
      if (frameIndex < 0) continue;
      drawSpellLayerCanvas(ctx, atlas.spellId, chargeLayer, frameIndex, entry.anchor.x, entry.anchor.y);
    }
  });
}

function drawAttachedSpellFxCanvas(ctx) {
  const effects = state.battle.attachedSpellFx ?? [];
  if (!effects.length) return;
  const now = performance.now();
  G.withScreenBlend(ctx, () => {
    for (const entry of effects) {
      if (now < entry.startedAt || now > entry.expiresAt) continue;
      if (entry.spellId === "MagicShield") {
        drawMagicShieldLoopFxCanvas(ctx, entry, now);
        continue;
      }
      const atlas = state.warriorSkillAtlases[entry.spellId] ?? state.wizardSpellAtlases[entry.spellId] ?? state.taoistSpellAtlases[entry.spellId];
      if (!atlas?.layers?.length) continue;
      const layers = atlas.layers.slice(entry.layerStart, entry.layerEnd);
      if (!layers.length) continue;
      const { x: anchorX, y: anchorY } = G.attachedSpellFxAnchor(entry);
      for (const layer of layers) {
        const frameIndex = G.spellFxLayerFrameIndex(layer, entry.startedAt, now);
        if (frameIndex < 0) continue;
        drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, anchorX, anchorY);
      }
    }
  });
}

function drawMagicShieldLoopFxCanvas(ctx, entry, now) {
  const atlas = state.wizardSpellAtlases?.MagicShield;
  if (!atlas?.layers?.length) return;
  const { x: anchorX, y: anchorY } = G.attachedSpellFxAnchor(entry);
  const struckAt = Number(entry.struckAt) || 0;
  const struckLayer = atlas.layers[CRYSTAL_MAGIC_SHIELD_STRUCK_LAYER];
  if (struckAt > 0 && now - struckAt < CRYSTAL_MAGIC_SHIELD_STRUCK_MS && struckLayer) {
    const frameIndex = G.spellFxLayerFrameIndex(struckLayer, struckAt, now);
    if (frameIndex < 0) return;
    drawSpellLayerCanvas(ctx, atlas.spellId, struckLayer, frameIndex, anchorX, anchorY);
    return;
  }
  const loopLayer = atlas.layers[CRYSTAL_MAGIC_SHIELD_LOOP_LAYER];
  if (!loopLayer) return;
  const frameIndex = G.spellFxLoopFrameIndex(loopLayer, G.magicShieldLoopStartedAt(entry, now), now);
  if (frameIndex < 0) return;
  drawSpellLayerCanvas(ctx, atlas.spellId, loopLayer, frameIndex, anchorX, anchorY);
}

function drawCombatSkillFxCanvas(ctx) {
  const battle = state.battle;
  const atlas = battle.activeSkillAtlas;
  if (!atlas || !state.playerOneShot || battle.activeSkill === "None") return;
  if (state.action !== G.warriorCombatSkill(battle.activeSkill).bodyAction) return;
  const { x: anchorX, y: anchorY } = G.combatAnchor("player");
  const layers = G.warriorSkillFxLayers(battle.activeSkill, "swing");
  const now = performance.now();
  const startedAt = battle.activeSkillStartedAt ?? now;

  G.withScreenBlend(ctx, () => {
    for (const layer of layers) {
      const frameIndex = G.spellFxLayerFrameIndex(layer, startedAt, now);
      if (frameIndex < 0) continue;
      drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, anchorX, anchorY);
    }
  });
}

function drawCombatWizardFxCanvas(ctx) {
  const battle = state.battle;
  const atlas = battle.activeWizardSpellAtlas;
  if (!atlas || !battle.activeWizardSpell) return;
  const spell = G.wizardCombatSpell(battle.activeWizardSpell);
  const t = performance.now() - battle.activeWizardSpellStartedAt;
  const playerAnchor = G.combatAnchor("player");
  const enemyAnchor = G.combatAnchor("enemy");
  const fxAnchor = spell.effectAnchor === "enemy" ? enemyAnchor : playerAnchor;
  const buffCast = spell.impactMode === "buff";
  const projectileTarget = buffCast ? playerAnchor : enemyAnchor;
  const hitAt = buffCast
    ? (Number(spell.impactDelayMs) || CRYSTAL_HEAL_APPLY_DELAY_MS)
    : G.wizardImpactDelay(spell, atlas);

  G.withScreenBlend(ctx, () => {
    const castLayers = battle.activeWizardSpell === "MagicShield"
      ? (atlas.layers ?? []).slice(0, CRYSTAL_MAGIC_SHIELD_CAST_LAYER_END)
      : atlas.layers;
    for (const layer of castLayers) {
      const layerDelay = layer.delayMs ?? 0;
      const layerT = t - layerDelay;
      const duration = layer.frames.length * layer.interval;
      if (layerT < 0 || layerT > duration) continue;
      const layerAnchor = layer.anchor === "enemy" ? enemyAnchor : layer.anchor === "player" ? playerAnchor : fxAnchor;
      const frameIndex = Math.min(layer.frames.length - 1, Math.floor(layerT / layer.interval));
      drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, layerAnchor.x, layerAnchor.y);
    }
    if (spell.impactMode === "projectile" || (buffCast && atlas.projectile)) {
      drawCombatProjectileCanvas(ctx, atlas, t, playerAnchor, projectileTarget, hitAt);
    }
    if (spell.impactMode === "projectile" && t >= hitAt && t <= hitAt + (spell.impactFlashMs ?? 250)) {
      drawImpactFlashCanvas(ctx, atlas, t - hitAt, enemyAnchor);
    }
  });
}

function drawCombatTaoistFxCanvas(ctx) {
  const battle = state.battle;
  const atlas = battle.activeTaoSpellAtlas;
  if (!atlas || !battle.activeTaoSpell) return;
  const spell = G.taoistCombatSpell(battle.activeTaoSpell);
  const t = performance.now() - battle.activeTaoSpellStartedAt;
  const playerAnchor = G.combatAnchor("player");
  const enemyAnchor = G.combatAnchor("enemy");
  const fxAnchor = spell.effectAnchor === "enemy" ? enemyAnchor : playerAnchor;
  const buffCast = spell.impactMode === "buff";
  const projectileTarget = buffCast ? playerAnchor : enemyAnchor;
  const hitAt = buffCast
    ? (Number(spell.impactDelayMs) || CRYSTAL_HEAL_APPLY_DELAY_MS)
    : G.wizardImpactDelay(spell, atlas);

  G.withScreenBlend(ctx, () => {
    for (const layer of atlas.layers) {
      const layerDelay = layer.delayMs ?? 0;
      const layerT = t - layerDelay;
      const duration = layer.frames.length * layer.interval;
      if (layerT < 0 || layerT > duration) continue;
      const layerAnchor = layer.anchor === "enemy" ? enemyAnchor : layer.anchor === "player" ? playerAnchor : fxAnchor;
      const frameIndex = Math.min(layer.frames.length - 1, Math.floor(layerT / layer.interval));
      drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, layerAnchor.x, layerAnchor.y);
    }
    if (spell.impactMode === "projectile" || (buffCast && atlas.projectile)) {
      drawCombatProjectileCanvas(ctx, atlas, t, playerAnchor, projectileTarget, hitAt);
    }
    if (spell.impactMode === "projectile" && t >= hitAt && t <= hitAt + (spell.impactFlashMs ?? 250)) {
      drawImpactFlashCanvas(ctx, atlas, t - hitAt, enemyAnchor);
    }
  });
}

function drawDefenceBuffFxCanvas(ctx) {
  const fx = G.defenceBuffFxList();
  if (!fx.length) return;
  const now = performance.now();
  for (const entry of fx) {
    const atlas = G.defenceBuffImpactAtlas(entry.spellId);
    if (!atlas?.layers?.length) continue;
    const t = now - entry.startAt;
    if (t < 0) continue;
    const { x: anchorX, y: anchorY } = G.defenceBuffImpactAnchor(entry);
    G.withScreenBlend(ctx, () => {
      for (const layer of atlas.layers) {
        const layerT = t - (layer.delayMs ?? 0);
        const duration = layer.frames.length * layer.interval;
        if (layerT < 0 || layerT > duration) continue;
        const frameIndex = Math.min(layer.frames.length - 1, Math.floor(layerT / layer.interval));
        drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, anchorX, anchorY);
      }
    });
  }
}

function drawGroundSpellEffectsCanvas(ctx) {
  const now = performance.now();
  const effects = (state.battle.groundSpellEffects ?? []).filter((effect) => now <= effect.expiresAt);
  if (effects.length !== (state.battle.groundSpellEffects ?? []).length) state.battle.groundSpellEffects = effects;
  if (!effects.length) return;

  const groundY = Math.floor(state.stageHeight * LANE.y);
  G.withScreenBlend(ctx, () => {
    for (const effect of effects) {
      const atlas = state.wizardSpellAtlases[effect.spellId];
      const layer = G.wizardGroundFxLayer(atlas);
      if (!layer?.frames?.length) continue;
      const duration = layer.frames.length * layer.interval;
      const frameIndex = Math.min(layer.frames.length - 1, Math.floor(((now - effect.createdAt) % duration) / layer.interval));
      if (G.groupDungeonSwarmActive() && effect.tiles?.length) {
        for (const tile of effect.tiles) {
          const x = Math.floor(tile.worldX - state.battle.cameraX);
          if (x < -layer.slotWidth || x > state.stageWidth + layer.slotWidth) continue;
          drawSpellLayerCanvas(ctx, effect.spellId, layer, frameIndex, x, G.swarmGroundSpellAnchorY(tile.mapRow));
        }
      } else {
        for (const offset of effect.offsets ?? [0]) {
          const x = Math.floor(effect.worldX + offset - state.battle.cameraX);
          if (x < -layer.slotWidth || x > state.stageWidth + layer.slotWidth) continue;
          drawSpellLayerCanvas(ctx, effect.spellId, layer, frameIndex, x, groundY);
        }
      }
    }
  });
}

function drawMapLightningEffectsCanvas(ctx) {
  const atlas = state.mapLightningAtlas;
  const layer = atlas?.layers?.[0];
  const effects = (state.battle.mapLightningEffects ?? []).filter((effect) => performance.now() <= effect.expiresAt);
  if (!layer?.frames?.length || !effects.length) return;

  const now = performance.now();
  const groundY = Math.floor(state.stageHeight * LANE.y);
  G.withScreenBlend(ctx, () => {
    for (const effect of effects) {
      const x = Math.floor(effect.worldX - state.battle.cameraX);
      if (x < -layer.slotWidth || x > state.stageWidth + layer.slotWidth) continue;
      const frameIndex = G.mapLightningFrameIndex(effect, layer, now);
      drawSpellLayerCanvas(ctx, MAP_LIGHTNING_FX_ID, layer, frameIndex, x, groundY);
    }
  });
}

function drawLevelUpFxCanvas(ctx) {
  const atlas = state.levelUpAtlas;
  if (!atlas?.layers?.length || !state.levelUpEffects.length) return;
  const now = performance.now();
  const duration = Math.max(...atlas.layers.map((layer) => layer.frames.length * layer.interval));
  const effects = state.levelUpEffects.filter((effect) => now - effect.createdAt <= duration);
  if (effects.length !== state.levelUpEffects.length) state.levelUpEffects = effects;
  if (!effects.length) return;

  const anchor = G.combatAnchor("player");
  G.withScreenBlend(ctx, () => {
    for (const effect of effects) {
      const age = Math.max(0, now - effect.createdAt);
      for (const layer of atlas.layers) {
        const frameIndex = Math.min(layer.frames.length - 1, Math.floor(age / layer.interval));
        drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, anchor.x, anchor.y);
      }
    }
  });
}

function drawFloatingCombatText(ctx) {
  const now = performance.now();
  const duration = 1050;
  const texts = state.battle.floatingTexts.filter((entry) => now - entry.createdAt < duration);
  if (texts.length !== state.battle.floatingTexts.length) state.battle.floatingTexts = texts;
  if (!texts.length) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 14px Segoe UI, system-ui, sans-serif";
  for (const entry of texts) {
    const age = now - entry.createdAt;
    const t = Math.max(0, Math.min(1, age / duration));
    const x = entry.x;
    const y = entry.y - t * 34;
    const alpha = t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillStyle = G.combatTextColor(entry.kind);
    ctx.strokeText(entry.text, x, y);
    ctx.fillText(entry.text, x, y);
  }
  ctx.restore();
}

function drawLootNotices(ctx) {
  const now = performance.now();
  const duration = 3200;
  const notices = state.game.lootToasts.filter((entry) => now - entry.createdAt < duration);
  if (notices.length !== state.game.lootToasts.length) state.game.lootToasts = notices;
  if (!notices.length) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 12px Segoe UI, system-ui, sans-serif";
  const x = Math.round(state.stageWidth / 2);
  notices.slice(-4).forEach((entry, index) => {
    const age = now - entry.createdAt;
    const t = Math.max(0, Math.min(1, age / duration));
    const alpha = t < 0.78 ? 1 : Math.max(0, 1 - (t - 0.78) / 0.22);
    const y = 28 + index * 22 - Math.min(10, t * 10);
    const textWidth = Math.min(260, Math.max(92, ctx.measureText(entry.text).width + 24));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(9, 9, 7, 0.76)";
    ctx.fillRect(Math.round(x - textWidth / 2), Math.round(y - 10), textWidth, 20);
    ctx.strokeStyle = G.lootNoticeBorder(entry.kind);
    ctx.strokeRect(Math.round(x - textWidth / 2) + 0.5, Math.round(y - 10) + 0.5, textWidth - 1, 19);
    ctx.fillStyle = G.lootNoticeColor(entry.kind);
    ctx.fillText(entry.text, x, y);
  });
  ctx.restore();
}

function drawProjectileCanvas(ctx, atlas, t, anchorX, anchorY) {
  const p = atlas.projectile;
  if (!p || t < p.delayMs) return;
  const travelT = Math.min(1, (t - p.delayMs) / Math.max(1, p.moveDurationMs));
  const frameIndex = Math.min(p.frames.length - 1, Math.floor((t - p.delayMs) / p.interval) % p.frames.length);
  const meta = p.frames[frameIndex] ?? p.frames[0];
  if (!meta || meta.empty) return;
  const moveX = p.startOffsetX + (p.endOffsetX - p.startOffsetX) * travelT;
  const moveY = p.startOffsetY + (p.endOffsetY - p.startOffsetY) * travelT;
  drawSpellFrameCanvas(ctx, atlas.spellId, p.sheet, p.slotWidth, p.slotHeight, { ...meta, offsetX: meta.offsetX + moveX, offsetY: meta.offsetY + moveY }, anchorX, anchorY);
}

function drawCombatProjectileCanvas(ctx, atlas, t, playerAnchor, enemyAnchor, impactAt = null) {
  const p = atlas.projectile;
  const moveDurationMs = Math.max(1, (Number(impactAt) || ((p?.delayMs ?? 0) + (p?.moveDurationMs ?? 0))) - (p?.delayMs ?? 0));
  if (!p || t < p.delayMs || t > p.delayMs + moveDurationMs) return;
  const travelT = Math.min(1, (t - p.delayMs) / moveDurationMs);
  const frameIndex = Math.min(p.frames.length - 1, Math.floor((t - p.delayMs) / p.interval) % p.frames.length);
  const meta = p.frames[frameIndex] ?? p.frames[0];
  if (!meta || meta.empty) return;
  // Crystal missiles interpolate map-cell draw locations; the frame offsets carry the visual height.
  const startX = playerAnchor.x;
  const startY = playerAnchor.y;
  const targetX = enemyAnchor.x;
  const targetY = enemyAnchor.y;
  const x = startX + (targetX - startX) * travelT;
  const y = startY + (targetY - startY) * travelT;
  drawSpellFrameCanvas(ctx, atlas.spellId, p.sheet, p.slotWidth, p.slotHeight, { ...meta, offsetX: meta.offsetX + x, offsetY: meta.offsetY + y }, 0, 0);
}

function drawImpactFlashCanvas(ctx, atlas, t, enemyAnchor) {
  const layer = atlas.impact ?? atlas.layers[0];
  if (!layer?.frames?.length) return;
  const frameIndex = Math.min(layer.frames.length - 1, Math.floor(t / layer.interval));
  drawSpellLayerCanvas(ctx, atlas.spellId, layer, frameIndex, enemyAnchor.x, enemyAnchor.y);
}

function drawSpellLayerCanvas(ctx, spellId, layer, frameIndex, anchorX, anchorY) {
  const meta = layer.frames[frameIndex] ?? layer.frames[0];
  if (!meta || meta.empty) return;
  drawSpellFrameCanvas(ctx, spellId, layer.sheet, layer.slotWidth, layer.slotHeight, meta, anchorX, anchorY);
}

function drawSpellFrameCanvas(ctx, spellId, sheetName, slotWidth, slotHeight, meta, anchorX, anchorY) {
  const sheet = G.cachedImage(`./public/spellfx/${spellId}/${sheetName}`);
  if (!sheet) return;
  drawAtlasFrame(ctx, sheet, slotWidth, slotHeight, meta, anchorX, anchorY);
}


G.drawTownCanvas = drawTownCanvas;
G.drawTownMapCanvas = drawTownMapCanvas;
G.drawTownMapStamp = drawTownMapStamp;
G.drawTownNpcs = drawTownNpcs;
G.drawTownNpcSprite = drawTownNpcSprite;
G.drawTownNpcPlaceholder = drawTownNpcPlaceholder;
G.drawTownNameplates = drawTownNameplates;
G.drawMapCanvas = drawMapCanvas;
G.drawMapTile = drawMapTile;
G.drawStampLayerBatch = drawStampLayerBatch;
G.drawStampArenaEntityLayers = drawStampArenaEntityLayers;
G.drawZoneMapStampLayers = drawZoneMapStampLayers;
G.drawZoneMapStamp = drawZoneMapStamp;
G.drawZoneMapStampForeground = drawZoneMapStampForeground;
G.drawZoneDecorations = drawZoneDecorations;
G.drawZoneObjectPattern = drawZoneObjectPattern;
G.drawObjectPair = drawObjectPair;
G.drawCaveEdgeStrip = drawCaveEdgeStrip;
G.drawRepeatingCaveEdge = drawRepeatingCaveEdge;
G.drawBackdropGradient = drawBackdropGradient;
G.drawGroupDungeonSwarmEnemyCanvas = drawGroupDungeonSwarmEnemyCanvas;
G.drawEnemyCanvas = drawEnemyCanvas;
G.drawEnemyActionBlendCanvas = drawEnemyActionBlendCanvas;
G.drawEnemyRangeProjectileCanvas = drawEnemyRangeProjectileCanvas;
G.drawEnemyAttackBlendCanvas = drawEnemyAttackBlendCanvas;
G.drawTaoistPetCanvas = drawTaoistPetCanvas;
G.drawUnitHealthBar = drawUnitHealthBar;
G.drawGroupDungeonSwarmHealthBars = drawGroupDungeonSwarmHealthBars;
G.drawEnemyHealthBar = drawEnemyHealthBar;
G.drawTaoistPetHealthBar = drawTaoistPetHealthBar;
G.drawEnemyPoisonDots = drawEnemyPoisonDots;
G.drawEnemyFrostDebuffOverlay = drawEnemyFrostDebuffOverlay;
G.drawEnemyDebuffBadges = drawEnemyDebuffBadges;
G.drawPlayerCanvas = drawPlayerCanvas;
G.drawAtlasFrame = drawAtlasFrame;
G.drawSpellFxCanvas = drawSpellFxCanvas;
G.drawTwinDrakeReadyFxCanvas = drawTwinDrakeReadyFxCanvas;
G.drawAttachedSpellFxCanvas = drawAttachedSpellFxCanvas;
G.drawMagicShieldLoopFxCanvas = drawMagicShieldLoopFxCanvas;
G.drawCombatSkillFxCanvas = drawCombatSkillFxCanvas;
G.drawCombatWizardFxCanvas = drawCombatWizardFxCanvas;
G.drawCombatTaoistFxCanvas = drawCombatTaoistFxCanvas;
G.drawDefenceBuffFxCanvas = drawDefenceBuffFxCanvas;
G.drawGroundSpellEffectsCanvas = drawGroundSpellEffectsCanvas;
G.drawMapLightningEffectsCanvas = drawMapLightningEffectsCanvas;
G.drawLevelUpFxCanvas = drawLevelUpFxCanvas;
G.drawFloatingCombatText = drawFloatingCombatText;
G.drawLootNotices = drawLootNotices;
G.drawProjectileCanvas = drawProjectileCanvas;
G.drawCombatProjectileCanvas = drawCombatProjectileCanvas;
G.drawImpactFlashCanvas = drawImpactFlashCanvas;
G.drawSpellLayerCanvas = drawSpellLayerCanvas;
G.drawSpellFrameCanvas = drawSpellFrameCanvas;
