/**
 * Crystal-style cell grid for Black Dragon Dungeon (group dungeon) swarm combat.
 *
 * Mirrors Crystal Server MonsterObject semantics:
 * - A monster always sits in the middle of exactly one cell; one monster per cell.
 * - Walking is a single-cell transition: the logical cell snaps to the
 *   destination immediately (Walk vacates the old cell), the sprite animates
 *   across, and MoveSpeed gates the next step.
 * - When the desired direction is blocked, MonsterObject.MoveTo rotates
 *   clockwise or counter-clockwise (random) through the compass until any
 *   walkable direction is found — monsters always move if a move is possible.
 * - When adjacent to the target's cell the monster stops and attacks
 *   (ProcessTarget), facing the target.
 *
 * Arena constraints: a band of three lanes (north / centre / south), and
 * movement limited to Up, Down, Left, UpLeft, DownLeft. No eastward steps.
 */

export const GROUP_DUNGEON_SWARM_TILE_PX = 48;
export const GROUP_DUNGEON_SWARM_CELL_HEIGHT = 32;
/** One map row per lane — matches Crystal CellHeight (32px) vertical adjacency. */
export const GROUP_DUNGEON_SWARM_MAP_ROW_STEP = 1;
export const GROUP_DUNGEON_SWARM_LANES = [-1, 0, 1];
export const GROUP_DUNGEON_SWARM_MAX_ALIVE = 9;
export const GROUP_DUNGEON_SWARM_SPAWN_MS = 2600;
/** Max monsters on the field while a large wave (>20) is still deploying. */
export const GROUP_DUNGEON_WAVE_FIELD_CAP = 20;
/** Refill when living count drops below this (spawn REFILL_BATCH at a time). */
export const GROUP_DUNGEON_WAVE_REFILL_THRESHOLD = 17;
export const GROUP_DUNGEON_WAVE_REFILL_BATCH = 3;
export const GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS = 350;
/** Waves at or below this size spawn their full quota immediately. */
export const GROUP_DUNGEON_WAVE_INSTANT_CAP = 20;
export const GROUP_DUNGEON_WAVE_BURST_STAGGER_MS = 45;
export const GROUP_DUNGEON_WAVES_PER_FLOOR = 10;
export const GROUP_DUNGEON_WAVE_SPAWN_BASE = 10;
export const GROUP_DUNGEON_WAVE_SPAWN_STEP = 5;
export const GROUP_DUNGEON_WAVE_SPAWN_CAP = 60;
/** Retry cadence while boxed in (Crystal ProcessAI re-ticks blocked monsters). */
export const GROUP_DUNGEON_SWARM_BLOCKED_RETRY_MS = 280;

/** Wave 1 = 10, +5 per wave, 60 from wave 10 onward (default floors). */
export function groupDungeonWaveConfig(zone = null) {
  const hasCustomWaves = zone?.groupDungeonWavesPerFloor != null;
  const hasCustomSpawn = zone?.groupDungeonWaveSpawnBase != null
    || zone?.groupDungeonWaveSpawnStep != null
    || zone?.groupDungeonWaveSpawnCap != null;

  return {
    wavesPerFloor: hasCustomWaves
      ? Math.max(1, Math.trunc(Number(zone.groupDungeonWavesPerFloor)))
      : GROUP_DUNGEON_WAVES_PER_FLOOR,
    spawnBase: zone?.groupDungeonWaveSpawnBase != null
      ? Math.max(1, Math.trunc(Number(zone.groupDungeonWaveSpawnBase)))
      : GROUP_DUNGEON_WAVE_SPAWN_BASE,
    spawnStep: zone?.groupDungeonWaveSpawnStep != null
      ? Math.max(0, Math.trunc(Number(zone.groupDungeonWaveSpawnStep)))
      : GROUP_DUNGEON_WAVE_SPAWN_STEP,
    spawnCap: zone?.groupDungeonWaveSpawnCap != null
      ? Math.max(1, Math.trunc(Number(zone.groupDungeonWaveSpawnCap)))
      : GROUP_DUNGEON_WAVE_SPAWN_CAP,
    useLegacyFinalWaveCap: !hasCustomWaves && !hasCustomSpawn,
  };
}

export function groupDungeonWavesPerFloor(zone = null) {
  return groupDungeonWaveConfig(zone).wavesPerFloor;
}

export function groupDungeonWaveSpawnCount(waveNumber, zone = null) {
  const wave = Math.max(1, Math.trunc(Number(waveNumber) || 1));
  const config = groupDungeonWaveConfig(zone);

  if (wave > config.wavesPerFloor) return config.spawnCap;

  if (config.useLegacyFinalWaveCap && wave >= config.wavesPerFloor) {
    return config.spawnCap;
  }

  return Math.min(
    config.spawnCap,
    config.spawnBase + (wave - 1) * config.spawnStep,
  );
}

export function createGroupDungeonWaveState(now = performance.now(), waveNumber = 1, zone = null) {
  return {
    waveNumber: Math.max(1, Math.trunc(Number(waveNumber) || 1)),
    spawnedThisWave: 0,
    killedThisWave: 0,
    targetThisWave: groupDungeonWaveSpawnCount(waveNumber, zone),
    spawningComplete: false,
    betweenWaves: false,
    floorComplete: false,
    endless: false,
    nextSpawnAt: now + 500,
  };
}

export function swarmSnapTileX(worldX) {
  return Math.round(Number(worldX) / GROUP_DUNGEON_SWARM_TILE_PX) * GROUP_DUNGEON_SWARM_TILE_PX;
}

export function swarmIsAttackAction(action) {
  return action === "attack1"
    || action === "attack2"
    || action === "attackNorthWest"
    || action === "attackSouthWest"
    || action === "attackRange1"
    || action === "attackRangeNorthWest"
    || action === "attackRangeSouthWest"
    || action === "attackRange2";
}

/** One Crystal cell east of the snapped front-liner — monsters stop on this column. */
export function swarmMeleeColumnWorldX(frontWorldX) {
  return swarmSnapTileX(frontWorldX) + GROUP_DUNGEON_SWARM_TILE_PX;
}

export function swarmSameTile(ax, bx) {
  return swarmSnapTileX(ax) === swarmSnapTileX(bx);
}

export function swarmClampLane(lane) {
  return Math.max(-1, Math.min(1, Math.trunc(Number(lane) || 0)));
}

export function swarmLaneMapRow(lane, arenaSpawnRow) {
  return Math.trunc(Number(arenaSpawnRow) || 0) + swarmClampLane(lane) * GROUP_DUNGEON_SWARM_MAP_ROW_STEP;
}

export function swarmLaneFromMapRow(mapRow, arenaSpawnRow) {
  const delta = (Math.trunc(Number(mapRow) || 0) - Math.trunc(Number(arenaSpawnRow) || 0))
    / GROUP_DUNGEON_SWARM_MAP_ROW_STEP;
  return swarmClampLane(Math.round(delta));
}

export function swarmEnemyTilePosition(enemy) {
  return {
    worldX: swarmSnapTileX(enemy.worldX),
    mapRow: Math.trunc(Number(enemy.mapRow) || 0),
  };
}

/** Crystal FireBang / IceStorm: 3×3 square centered on the target cell. */
export function spellBangAreaTiles(centerWorldX, centerMapRow) {
  const cx = swarmSnapTileX(centerWorldX);
  const row = Math.trunc(Number(centerMapRow) || 0);
  const step = GROUP_DUNGEON_SWARM_MAP_ROW_STEP;
  const tiles = [];
  for (let dLane = -1; dLane <= 1; dLane += 1) {
    for (let dX = -1; dX <= 1; dX += 1) {
      tiles.push({
        worldX: cx + dX * GROUP_DUNGEON_SWARM_TILE_PX,
        mapRow: row + dLane * step,
      });
    }
  }
  return tiles;
}

/** Crystal ground fields: square centered on the target cell (radius 1 = 3×3, 2 = 5×5). */
export function spellGroundAreaTiles(centerWorldX, centerMapRow, radius = 2) {
  const cx = swarmSnapTileX(centerWorldX);
  const row = Math.trunc(Number(centerMapRow) || 0);
  const step = GROUP_DUNGEON_SWARM_MAP_ROW_STEP;
  const r = Math.max(0, Math.trunc(Number(radius) || 0));
  const tiles = [];
  for (let dLane = -r; dLane <= r; dLane += 1) {
    for (let dX = -r; dX <= r; dX += 1) {
      tiles.push({
        worldX: cx + dX * GROUP_DUNGEON_SWARM_TILE_PX,
        mapRow: row + dLane * step,
      });
    }
  }
  return tiles;
}

/** Crystal Blizzard / MeteorStrike: 5×5 square centered on the target cell. */
export function spellStormAreaTiles(centerWorldX, centerMapRow) {
  return spellGroundAreaTiles(centerWorldX, centerMapRow, 2);
}

/** Crystal FireWall: center cell plus four orthogonal neighbours. */
export function fireWallCrossTiles(centerWorldX, centerMapRow) {
  const cx = swarmSnapTileX(centerWorldX);
  const row = Math.trunc(Number(centerMapRow) || 0);
  const step = GROUP_DUNGEON_SWARM_MAP_ROW_STEP;
  return [
    { worldX: cx, mapRow: row },
    { worldX: cx - GROUP_DUNGEON_SWARM_TILE_PX, mapRow: row },
    { worldX: cx + GROUP_DUNGEON_SWARM_TILE_PX, mapRow: row },
    { worldX: cx, mapRow: row - step },
    { worldX: cx, mapRow: row + step },
  ];
}

/** A walking monster owns its destination cell (Crystal vacates the origin on Walk). */
export function swarmEnemyReservedTile(enemy) {
  if (enemy.stepToX != null) {
    return {
      worldX: swarmSnapTileX(enemy.stepToX),
      mapRow: Math.trunc(Number(enemy.stepToMapRow) || 0),
    };
  }
  return swarmEnemyTilePosition(enemy);
}

export function swarmTileOccupied(worldX, mapRow, enemies, excludeId) {
  const x = swarmSnapTileX(worldX);
  const row = Math.trunc(mapRow);
  return enemies.some((other) => {
    if (other.id === excludeId || other.hp <= 0 || other.dying) return false;
    const otherTile = swarmEnemyReservedTile(other);
    if (otherTile.mapRow !== row) return false;
    return swarmSameTile(otherTile.worldX, x);
  });
}

/** Crystal MirDirection table (Up=0 … UpLeft=7). Eastward entries are forbidden here. */
const SWARM_DIRECTIONS = [
  { dx: 0, dLane: -1, walk: "walkNorth", allowed: true },      // 0 Up
  { dx: 1, dLane: -1, walk: null, allowed: false },            // 1 UpRight
  { dx: 1, dLane: 0, walk: null, allowed: false },             // 2 Right
  { dx: 1, dLane: 1, walk: null, allowed: false },             // 3 DownRight
  { dx: 0, dLane: 1, walk: "walkSouth", allowed: true },       // 4 Down
  { dx: -1, dLane: 1, walk: "walkSouthWest", allowed: true },  // 5 DownLeft
  { dx: -1, dLane: 0, walk: "walking", allowed: true },        // 6 Left
  { dx: -1, dLane: -1, walk: "walkNorthWest", allowed: true }, // 7 UpLeft
];

/** Crystal Functions.DirectionFromPoint: octant of the delta vector. */
export function swarmDirectionFromDelta(dxTiles, dLanes) {
  if (!dxTiles && !dLanes) return 6;
  const octant = ((Math.round(Math.atan2(dLanes, dxTiles) / (Math.PI / 4)) % 8) + 8) % 8;
  return [2, 3, 4, 5, 6, 7, 0, 1][octant];
}

/** Crystal MapControl.Direction16 — missile facing index (0–15). */
export function crystalDirection16(sourceX, sourceY, destX, destY) {
  const cx = sourceX;
  const cy = sourceY;
  const ax = cx;
  const ay = 0;
  const bx = destX;
  let by = destY;
  const bc = Math.hypot(bx - cx, by - cy);
  if (bc === 0) return 0;
  const ac = bc;
  by -= cy;
  by += bc;
  const ab = Math.hypot(bx - ax, by - ay);
  let cosine = (ac * ac + bc * bc - ab * ab) / (2 * ac * bc);
  cosine = Math.max(-1, Math.min(1, cosine));
  let angle = Math.acos(cosine) * (180 / Math.PI);
  if (destX < cx) angle = 360 - angle;
  angle += 11.25;
  if (angle >= 360) angle -= 360;
  return Math.floor(angle / 22.5) % 16;
}

/** Pick a travel-projectile atlas frame (supports Crystal direction16 strips). */
export function travelProjectileFrameMeta(projectile, fromX, fromY, toX, toY) {
  if (!projectile?.frames?.length) return null;
  if (projectile.direction16 && projectile.frames.length >= 16) {
    const dir = crystalDirection16(fromX, fromY, toX, toY);
    return projectile.frames[dir] ?? projectile.frames[0];
  }
  return projectile.frames[0];
}

/** Screen-space travel angle (radians) for canvas rotation of the base projectile sprite. */
export function travelProjectileAngleRad(fromX, fromY, toX, toY, baseAngleRad = (97 * Math.PI) / 180) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return baseAngleRad;
  return Math.atan2(dy, dx) - baseAngleRad;
}

export function travelProjectileBaseFrame(projectile) {
  if (!projectile?.frames?.length) return null;
  const index = Math.max(0, Math.trunc(Number(projectile.baseFrame) || 0));
  return projectile.frames[index] ?? projectile.frames[0];
}

/** Map-tile endpoints for Crystal Missile.Direction16 (equal X/Y cell units, not screen px). */
export function swarmProjectileTileCoords(fromWorldX, fromMapRow, toWorldX, toMapRow) {
  return {
    fromTileX: Math.round(Number(fromWorldX) / GROUP_DUNGEON_SWARM_TILE_PX),
    fromTileY: Math.trunc(Number(fromMapRow) || 0),
    toTileX: Math.round(Number(toWorldX) / GROUP_DUNGEON_SWARM_TILE_PX),
    toTileY: Math.trunc(Number(toMapRow) || 0),
  };
}

/** Crystal Missile.Draw: travel in cell space (48px X, 32px Y per tile). */
export function swarmProjectileTravelPoint(fromAnchor, tileCoords, travelT, torsoLiftPx = 0) {
  const t = Math.min(1, Math.max(0, Number(travelT) || 0));
  const dxPx = (tileCoords.toTileX - tileCoords.fromTileX) * GROUP_DUNGEON_SWARM_TILE_PX;
  const dyPx = (tileCoords.toTileY - tileCoords.fromTileY) * GROUP_DUNGEON_SWARM_CELL_HEIGHT;
  return {
    x: fromAnchor.x + dxPx * t,
    y: fromAnchor.y + dyPx * t + torsoLiftPx * t,
  };
}

/** Screen point where a Zuma Archer arrow should leave the bow (uses the live attack frame). */
export function swarmEnemyRangedProjectileOrigin(enemy, screenAnchor) {
  const atlas = enemy?.atlas;
  if (!atlas?.actions || !screenAnchor) return screenAnchor;
  const clip = atlas.actions[enemy.action]
    ?? atlas.actions.attack1
    ?? atlas.actions.standing;
  const frameIndex = Math.max(0, Math.min(Number(enemy.frame) || 0, (clip?.frames?.length ?? 1) - 1));
  const meta = clip?.frames?.[frameIndex] ?? clip?.frames?.[0];
  if (!meta || meta.empty) return screenAnchor;
  const w = Math.max(1, Number(meta.w) || 80);
  const h = Math.max(1, Number(meta.h) || 96);
  // Release point on the west-facing bow within the drawn body bounds (not the foot cell anchor).
  return {
    x: screenAnchor.x + Math.trunc(Number(meta.offsetX) || 0) + Math.round(w * 0.14),
    y: screenAnchor.y + Math.trunc(Number(meta.offsetY) || 0) + Math.round(h * 0.34),
  };
}

/**
 * The party occupies the cell one tile west of the melee column on the centre
 * lane, so every cell in the melee column (any lane) is within Crystal's
 * range-1 attack adjacency.
 */
export function swarmEnemyInAttackRange(enemy, meleeCol) {
  return swarmEnemyTilePosition(enemy).worldX <= swarmSnapTileX(meleeCol);
}

/** Attack clip faces the party cell: north lane swings down-left, south lane up-left. */
export function swarmAttackActionForLane(lane) {
  const clamped = swarmClampLane(lane);
  if (clamped < 0) return "attackSouthWest";
  if (clamped > 0) return "attackNorthWest";
  return "attack1";
}

/** Ranged attack clip uses the same lane-facing set when directional range clips exist. */
export function swarmRangeAttackActionForLane(lane) {
  const clamped = swarmClampLane(lane);
  if (clamped < 0) return "attackRangeSouthWest";
  if (clamped > 0) return "attackRangeNorthWest";
  return "attackRange1";
}

/** Idle between attacks: Crystal keeps Target.Direction while in ProcessTarget range. */
export function swarmStanceActionForLane(lane) {
  const clamped = swarmClampLane(lane);
  if (clamped < 0) return "standingSouthWest";
  if (clamped > 0) return "standingNorthWest";
  return "standing";
}

export function swarmEnemyEngagedStanceAction(enemy, meleeCol, arenaSpawnRow) {
  if (!swarmEnemyInAttackRange(enemy, meleeCol)) return "standing";
  const lane = swarmLaneFromMapRow(swarmEnemyTilePosition(enemy).mapRow, arenaSpawnRow);
  return swarmStanceActionForLane(lane);
}

/**
 * Move the final side-lane enemy into the empty centre melee cell. This covers
 * either one lone survivor or a final pair split north/south, allowing the
 * party's primary melee attack to finish the encounter. The lower id makes a
 * two-enemy choice stable across frames.
 */
export function swarmPickCenterLaneStep(enemies, meleeCol, arenaSpawnRow) {
  const alive = (enemies ?? []).filter((enemy) => enemy.hp > 0 && !enemy.dying);
  if (alive.length < 1 || alive.length > 2) return null;

  const targetX = swarmSnapTileX(meleeCol);
  const targetRow = swarmLaneMapRow(0, arenaSpawnRow);
  const split = alive
    .map((enemy) => ({
      enemy,
      tile: swarmEnemyTilePosition(enemy),
      lane: swarmLaneFromMapRow(swarmEnemyTilePosition(enemy).mapRow, arenaSpawnRow),
    }))
    .filter(({ enemy, tile, lane }) => (
      !enemy.stationaryBoss
      && enemy.stepToX == null
      && tile.worldX === targetX
      && (lane === -1 || lane === 1)
    ));
  const loneSideEnemy = alive.length === 1 && split.length === 1;
  const splitSideEnemies = alive.length === 2
    && split.length === 2
    && new Set(split.map((entry) => entry.lane)).size === 2;
  if (!loneSideEnemy && !splitSideEnemies) return null;
  if (swarmTileOccupied(targetX, targetRow, alive, null)) return null;

  const chosen = split.sort((a, b) => Number(a.enemy.id) - Number(b.enemy.id))[0];
  return {
    enemyId: chosen.enemy.id,
    toX: targetX,
    toMapRow: targetRow,
    action: chosen.lane < 0 ? "walkSouth" : "walkNorth",
  };
}

/**
 * Crystal MonsterObject.MoveTo: try the direction toward the target, then
 * rotate NextDir/PreviousDir (random pick) through the rest of the compass
 * until a walkable cell is found. Returns null only when fully boxed in.
 */
export function swarmPickWalkStep(enemy, meleeCol, arenaSpawnRow, enemies, random = Math.random) {
  const tile = swarmEnemyTilePosition(enemy);
  const lane = swarmLaneFromMapRow(tile.mapRow, arenaSpawnRow);
  const minCol = swarmSnapTileX(meleeCol);
  const targetCol = minCol - GROUP_DUNGEON_SWARM_TILE_PX;

  const tryDirection = (dirId) => {
    const dir = SWARM_DIRECTIONS[dirId];
    if (!dir.allowed) return null;
    const toLane = lane + dir.dLane;
    if (toLane < -1 || toLane > 1) return null;
    const toX = tile.worldX + dir.dx * GROUP_DUNGEON_SWARM_TILE_PX;
    if (toX < minCol) return null;
    const toMapRow = swarmLaneMapRow(toLane, arenaSpawnRow);
    if (swarmTileOccupied(toX, toMapRow, enemies, enemy.id)) return null;
    return { toX, toMapRow, action: dir.walk };
  };

  const desired = swarmDirectionFromDelta(
    Math.round((targetCol - tile.worldX) / GROUP_DUNGEON_SWARM_TILE_PX),
    -lane,
  );
  let step = tryDirection(desired);
  if (step) return step;

  const rotation = random() < 0.5 ? 1 : 7;
  let dirId = desired;
  for (let i = 0; i < 7; i += 1) {
    dirId = (dirId + rotation) % 8;
    step = tryDirection(dirId);
    if (step) return step;
  }
  return null;
}

const SWARM_DIRECTION_FALLBACKS = {
  walkNorth: "walking",
  walkSouth: "walking",
  walkNorthWest: "walking",
  walkSouthWest: "walking",
  attackNorthWest: "attack1",
  attackSouthWest: "attack1",
  attackRange1: "attack1",
  attackRangeNorthWest: "attackRange1",
  attackRangeSouthWest: "attackRange1",
  attackRange2: "attack1",
  standingNorthWest: "standing",
  standingSouthWest: "standing",
};

function resolveSwarmEnemyAction(enemy, action) {
  if (!enemy?.atlas?.actions) return action;
  if (enemy.atlas.actions[action]?.frames?.length) return action;
  const fallback = SWARM_DIRECTION_FALLBACKS[action];
  if (fallback && enemy.atlas.actions[fallback]?.frames?.length) return fallback;
  if (enemy.atlas.actions.standing?.frames?.length) return "standing";
  return action;
}

/** Fallback only when directional clips were not exported from Crystal libs. */
export function ensureSwarmDirectionalActions(atlas) {
  if (!atlas?.actions) return atlas;
  const actions = atlas.actions;
  for (const [name, fallback] of Object.entries(SWARM_DIRECTION_FALLBACKS)) {
    if (!actions[name]?.frames?.length && actions[fallback]) actions[name] = actions[fallback];
  }
  return atlas;
}

export { resolveSwarmEnemyAction };
