/**
 * Mystery Cave — timed boss-swarm gauntlet.
 *
 * Every run spawns the full moving-boss roster, easiest → hardest, one wave
 * every 10 seconds. Rooms that fight as a pack spawn together on that tick
 * (Dream + Dark Devourer, three Incarnated Wooma Taurus, IZT + both Incarnated
 * Red Thunder Zuma). Difficulty is Empowered / Ascended / Awakened.
 * Stationary room bosses stay out (Evil Centipede, Great Fox Spirit,
 * Hell Keeper, Hell Lord, Red Moon Evil, Guardian Rock).
 */

import { BOSS_DROP_TABLE_BY_LABEL, BOSS_GEM_ITEM_IDS, BOSS_ORB_ITEM_IDS } from "./bossDrops.js";
import { rollEmpoweredBossGlyphItemId } from "./glyphModifiers.js";
import { PHASE1_ENEMY_TEMPLATES } from "./phase1Data.js";

export const MYSTERY_CAVE_ZONE_ID = "zone-mystery-cave";
export const MYSTERY_CAVE_SPAWN_INTERVAL_MS = 10_000;
export const MYSTERY_CAVE_LANES = [-1, 0, 1];
export const MYSTERY_CAVE_CHEST_ITEM_ID = "mystery-cave-chest";
export const MYSTERY_CAVE_GOLD_PER_KILL = 100_000;
export const MYSTERY_CAVE_RARE_ORE_PER_KILL = 5;
export const MYSTERY_CAVE_RARE_ORE_ITEM_IDS = Object.freeze([
  "adamantine-ore",
  "ruby-ore",
  "emerald-ore",
  "amethyst-ore",
]);
export const MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID = "sun-potion";
export const MYSTERY_CAVE_SUN_POTION_MEDIUM_ITEM_ID = "sun-potion-medium";
export const MYSTERY_CAVE_SUN_POTION_SMALL_PER_KILL = 2;
export const MYSTERY_CAVE_SUN_POTION_MEDIUM_PER_KILL = 1;
export const MYSTERY_CAVE_GEMS_PER_KILL = 1;
export const MYSTERY_CAVE_ORB_KILL_DIVISOR = 3;
export const MYSTERY_CAVE_BENEDICTION_OIL_ITEM_ID = "benediction-oil";
export const MYSTERY_CAVE_BENEDICTION_OIL_PER_KILL = 1;
export const MYSTERY_CAVE_AWAKENING_SOUL_ITEM_ID = "awakening-soul";
export const MYSTERY_CAVE_AWAKENING_SOUL_PER_KILL = 2;
export const MYSTERY_CAVE_HAVOC_CRYSTAL_ITEM_ID = "havoc-crystal";
export const MYSTERY_CAVE_HAVOC_CRYSTAL_PER_KILL = 1;
export const MYSTERY_CAVE_BLACK_IRON_ORE_ITEM_ID = "black-iron-ore";
export const MYSTERY_CAVE_BLACK_IRON_PER_KILL = 1;
export const MYSTERY_CAVE_BLACK_IRON_MAX_PURITY = 10;
export const MYSTERY_CAVE_BLACK_IRON_MIN_PURITY_BY_TIER = Object.freeze([7, 8, 9, 10]);
/** Chest EXP is sheet XP × kills × difficulty, then this. Player XP rate (gear/rebirth/supporter) applies on claim. */
export const MYSTERY_CAVE_XP_MULTIPLIER = 10;

/** Item.slot values that count as Mystery Cave equipment (not gems, books, pots, souls). */
export const MYSTERY_CAVE_EQUIPMENT_SLOTS = Object.freeze([
  "weapon",
  "armour",
  "dress",
  "helmet",
  "necklace",
  "bracelet",
  "ring",
  "belt",
  "boots",
  "stone",
  "torch",
  "amulet",
  "mount",
  "glyph",
]);

/**
 * Template id → boss drop-table label. Incarnated Red Thunder Zuma uses the IZT
 * table (no dedicated sheet). Dream and Dark Devourer share one table.
 */
export const MYSTERY_CAVE_DROP_LABEL_BY_TEMPLATE_ID = Object.freeze({
  266: "Evil Snake",
  256: "Wooma Taurus",
  279: "Bone Lord",
  272: "Zuma Taurus",
  292: "King Scorpion",
  287: "Minotaur King",
  291: "Oma King Spirit",
  414: "Yimoogi",
  306: "Incarnated Wooma Taurus",
  316: "King Hog",
  317: "Incarnated Zuma Taurus",
  318: "Incarnated Zuma Taurus",
  445: "Dream Devourer",
  446: "Dark Devourer",
  319: "Dark Devil",
  293: "Manectric King",
  994: "Beast King",
  997: "Danmo",
  471: "Frost Tiger",
  472: "Oma King",
});

/** Stationary bosses that must never enter the Mystery Cave swarm. */
export const MYSTERY_CAVE_EXCLUDED_STATIONARY_TEMPLATE_IDS = [
  166, // Evil Centipede
  431, // Hell Keeper
  440, // Hell Lord
  452, // Great Fox Spirit
  453, // Guardian Rock
  454, // Red Moon Evil
];

/**
 * Spawn waves, easiest → hardest. Each wave shares one timer tick.
 * Template ids must match PHASE1_ENEMY_TEMPLATES.
 *
 * Ranked by pack HP × sustained DPS, NOT by overworld/teleporter position, so
 * BDD floor bosses interleave with the rest of the roster. Hand-placed
 * exceptions the raw score gets wrong:
 * - King Scorpion sits above Zuma Taurus for its enrage kit (ranged conversion,
 *   5-tile lines) that a flat DPS number ignores.
 * - The Devourers score like a top-5 wave on burst alone but are only 10k HP
 *   each, so they melt; they sit mid-pack instead.
 * - 3× IWT then King Hog then the IZT pack stay as that sandwich even though
 *   the IWT/IZT packs outscore Hog on raw threat.
 * Beast King is a 150k HP wall that barely hits back — placed by time cost next
 * to Danmo rather than by its low damage score.
 */
export const MYSTERY_CAVE_SPAWN_WAVES = [
  { templateIds: [266] }, // Evil Snake
  { templateIds: [256] }, // Wooma Taurus
  { templateIds: [279] }, // Bone Lord
  { templateIds: [272] }, // Zuma Taurus
  { templateIds: [292] }, // King Scorpion
  { templateIds: [287] }, // Minotaur King
  { templateIds: [291] }, // Oma King Spirit
  { templateIds: [414] }, // Yimoogi
  { templateIds: [306, 306, 306], lanes: [-1, 0, 1] }, // 3× Incarnated Wooma Taurus
  { templateIds: [316] }, // King Hog
  { templateIds: [317, 318, 318], lanes: [0, -1, 1] }, // IZT + 2× Incarnated Red Thunder Zuma
  { templateIds: [445, 446], lanes: [-1, 1] }, // Dream + Dark Devourer
  { templateIds: [319] }, // Dark Devil
  { templateIds: [293] }, // Manectric King
  { templateIds: [994] }, // Beast King
  { templateIds: [997] }, // Danmo
  { templateIds: [471] }, // Frost Tiger
  { templateIds: [472] }, // Oma King
];

/** Unique boss template ids in first-seen encounter order. */
export const MYSTERY_CAVE_BOSS_TEMPLATE_IDS = [...new Set(
  MYSTERY_CAVE_SPAWN_WAVES.flatMap((wave) => wave.templateIds),
)];

export function buildMysteryCaveSpawnQueue() {
  const queue = [];
  MYSTERY_CAVE_SPAWN_WAVES.forEach((wave, waveIndex) => {
    const spawnDelayMs = waveIndex * MYSTERY_CAVE_SPAWN_INTERVAL_MS;
    const ids = wave.templateIds ?? [];
    const lanes = Array.isArray(wave.lanes) ? wave.lanes : [];
    ids.forEach((templateId, index) => {
      queue.push({
        templateId,
        spawnDelayMs,
        waveIndex,
        lane: lanes[index] ?? MYSTERY_CAVE_LANES[index % MYSTERY_CAVE_LANES.length],
      });
    });
  });
  return queue;
}

export function sanitizeMysteryCaveKills(value) {
  return Math.max(0, Math.min(999, Math.trunc(Number(value) || 0)));
}

export function mysteryCaveGoldReward(kills, tier = 0) {
  return sanitizeMysteryCaveKills(kills) * MYSTERY_CAVE_GOLD_PER_KILL * mysteryCaveStatMultiplier(tier);
}

export function mysteryCaveRareOreCount(kills, tier = 0) {
  return sanitizeMysteryCaveKills(kills) * MYSTERY_CAVE_RARE_ORE_PER_KILL * mysteryCaveStatMultiplier(tier);
}

export function mysteryCaveSunPotionCounts(kills, tier = 0) {
  const scale = sanitizeMysteryCaveKills(kills) * mysteryCaveStatMultiplier(tier);
  return {
    small: scale * MYSTERY_CAVE_SUN_POTION_SMALL_PER_KILL,
    medium: scale * MYSTERY_CAVE_SUN_POTION_MEDIUM_PER_KILL,
  };
}

export function mysteryCaveGemOrbCounts(kills, tier = 0) {
  const n = sanitizeMysteryCaveKills(kills);
  const mult = mysteryCaveStatMultiplier(tier);
  return {
    gems: n * MYSTERY_CAVE_GEMS_PER_KILL * mult,
    orbs: Math.trunc(n / MYSTERY_CAVE_ORB_KILL_DIVISOR) * mult,
  };
}

export function mysteryCaveBenedictionOilCount(kills, tier = 0) {
  return sanitizeMysteryCaveKills(kills) * MYSTERY_CAVE_BENEDICTION_OIL_PER_KILL * mysteryCaveStatMultiplier(tier);
}

export function mysteryCaveAwakeningSoulCount(kills, tier = 0) {
  return sanitizeMysteryCaveKills(kills) * MYSTERY_CAVE_AWAKENING_SOUL_PER_KILL * mysteryCaveStatMultiplier(tier);
}

export function mysteryCaveHavocCrystalCount(kills, tier = 0) {
  return sanitizeMysteryCaveKills(kills) * MYSTERY_CAVE_HAVOC_CRYSTAL_PER_KILL * mysteryCaveStatMultiplier(tier);
}

export function mysteryCaveBlackIronCount(kills) {
  return sanitizeMysteryCaveKills(kills) * MYSTERY_CAVE_BLACK_IRON_PER_KILL;
}

export function mysteryCaveBlackIronPurityRange(tier = 0) {
  const clamped = clampMysteryCaveFightTier(tier);
  const max = MYSTERY_CAVE_BLACK_IRON_MAX_PURITY;
  const min = MYSTERY_CAVE_BLACK_IRON_MIN_PURITY_BY_TIER[clamped] ?? 7;
  return { min, max };
}

export function mysteryCaveBlackIronPurityLabel(tier = 0) {
  const { min, max } = mysteryCaveBlackIronPurityRange(tier);
  return min === max ? `P${min}` : `P${min}–${max}`;
}

export function rollMysteryCaveBlackIronPurity(tier = 0, rng = Math.random) {
  const { min, max } = mysteryCaveBlackIronPurityRange(tier);
  const roll = typeof rng === "function" ? Number(rng()) : Number(rng);
  const unit = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  return min + Math.floor(unit * (max - min + 1));
}

export function pickMysteryCavePoolItem(pool, rng = Math.random) {
  const ids = (Array.isArray(pool) ? pool : []).map((id) => String(id ?? "").trim()).filter(Boolean);
  if (!ids.length) return null;
  const roll = typeof rng === "function" ? Number(rng()) : Number(rng);
  const unit = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  return ids[Math.min(ids.length - 1, Math.floor(unit * ids.length))];
}

export function rollMysteryCaveGemOrbReward(kills, tier = 0, rng = Math.random) {
  const counts = mysteryCaveGemOrbCounts(kills, tier);
  const gems = [];
  const orbs = [];
  for (let i = 0; i < counts.gems; i++) {
    const itemId = pickMysteryCavePoolItem(BOSS_GEM_ITEM_IDS, rng);
    if (itemId) gems.push(itemId);
  }
  for (let i = 0; i < counts.orbs; i++) {
    const itemId = pickMysteryCavePoolItem(BOSS_ORB_ITEM_IDS, rng);
    if (itemId) orbs.push(itemId);
  }
  return { gems, orbs };
}

export function tallyMysteryCaveItemIds(itemIds) {
  const counts = new Map();
  for (const raw of itemIds ?? []) {
    const itemId = String(raw ?? "").trim();
    if (!itemId) continue;
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  }
  return counts;
}

export function mysteryCaveMaxWaveIndex() {
  return Math.max(0, MYSTERY_CAVE_SPAWN_WAVES.length - 1);
}

export function sanitizeMysteryCaveBestWave(value, kills = 0) {
  if (value == null || value === "") return mysteryCaveBestWaveFromKills(kills);
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return mysteryCaveBestWaveFromKills(kills);
  return Math.max(0, Math.min(mysteryCaveMaxWaveIndex(), parsed));
}

/** Wave of the Nth body in spawn order — used when a chest has no stored best wave. */
export function mysteryCaveBestWaveFromKills(kills) {
  const n = sanitizeMysteryCaveKills(kills);
  if (n <= 0) return 0;
  const queue = buildMysteryCaveSpawnQueue();
  if (!queue.length) return 0;
  const index = Math.min(queue.length, n) - 1;
  return mysteryCaveWaveIndexForPlanEntry(queue[index], index);
}

export function mysteryCaveDropLabelForTemplateId(templateId) {
  const id = Math.trunc(Number(templateId) || 0);
  return MYSTERY_CAVE_DROP_LABEL_BY_TEMPLATE_ID[id] ?? null;
}

export function mysteryCaveDropLabelForWave(waveIndex) {
  const wave = MYSTERY_CAVE_SPAWN_WAVES[Math.max(0, Math.min(mysteryCaveMaxWaveIndex(), Math.trunc(Number(waveIndex) || 0)))];
  const ids = wave?.templateIds ?? [];
  for (const templateId of ids) {
    if (templateId === 318 && ids.includes(317)) continue;
    const label = mysteryCaveDropLabelForTemplateId(templateId);
    if (label) return label;
  }
  return null;
}

export function mysteryCaveDropLabelForRun(kills, bestWave = null) {
  const wave = bestWave == null || bestWave === ""
    ? mysteryCaveBestWaveFromKills(kills)
    : sanitizeMysteryCaveBestWave(bestWave, kills);
  return mysteryCaveDropLabelForWave(wave);
}

export function isMysteryCaveEquipmentDropItem(item) {
  if (!item) return false;
  if (item.type === "glyph" || item.slot === "glyph") return true;
  const type = String(item.type ?? "");
  if (type === "book" || type === "scroll" || type === "potion" || type === "gem" || type === "material") return false;
  const slot = String(item.slot ?? "");
  if (!slot || slot === "consumable" || slot === "book" || slot === "material") return false;
  return MYSTERY_CAVE_EQUIPMENT_SLOTS.includes(slot);
}

export function mysteryCaveEquipmentDropEntries(dropTable, itemLookup, options = {}) {
  const lookup = typeof itemLookup === "function"
    ? itemLookup
    : (id) => (itemLookup instanceof Map ? itemLookup.get(id) : itemLookup?.[id]);
  const rows = [];
  const pools = [Array.isArray(dropTable?.items) ? dropTable.items : []];
  if (options.includeAwakened) {
    pools.push(Array.isArray(dropTable?.awakenedItems) ? dropTable.awakenedItems : []);
  }
  for (const pool of pools) {
    for (const entry of pool) {
      const itemId = String(entry?.id ?? "").trim();
      if (!itemId) continue;
      const item = lookup(itemId);
      if (!isMysteryCaveEquipmentDropItem(item)) continue;
      const chance = Math.max(0, Number(entry.chance) || 0);
      if (chance <= 0) continue;
      rows.push({ id: itemId, chance });
    }
  }
  return rows;
}

function pickWeightedMysteryCaveDropEntry(entries, rng = Math.random) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) return null;
  const total = rows.reduce((sum, entry) => sum + (Number(entry.chance) || 0), 0);
  const roll = typeof rng === "function" ? Number(rng()) : Number(rng);
  const unit = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  if (total <= 0) return rows[Math.min(rows.length - 1, Math.floor(unit * rows.length))];
  let cursor = unit * total;
  for (const entry of rows) {
    cursor -= Number(entry.chance) || 0;
    if (cursor < 0) return entry;
  }
  return rows[rows.length - 1];
}

/**
 * One guaranteed equipable (or glyph) per kill, all from the furthest boss's table.
 * Glyph chance is the same as a boss kill: Empowered 10% / Ascended 15% / Awakened 20%.
 * Normal runs never roll glyphs. Each glyph hit replaces that kill's table pick so
 * the chest still grants exactly `kills` items.
 */
export function rollMysteryCaveEquipmentReward(kills, bestWave = null, tier = 0, itemLookup = null, rng = Math.random) {
  const count = sanitizeMysteryCaveKills(kills);
  const clampedTier = clampMysteryCaveFightTier(tier);
  const label = mysteryCaveDropLabelForRun(count, bestWave);
  const table = label ? BOSS_DROP_TABLE_BY_LABEL[label] : null;
  const pool = mysteryCaveEquipmentDropEntries(table, itemLookup, { includeAwakened: clampedTier >= 3 });
  const itemIds = [];
  for (let i = 0; i < count; i++) {
    if (clampedTier >= 1) {
      const glyphId = rollEmpoweredBossGlyphItemId(rng, {
        ascended: clampedTier >= 2,
        awakened: clampedTier >= 3,
      });
      if (glyphId) {
        itemIds.push(glyphId);
        continue;
      }
    }
    const pick = pickWeightedMysteryCaveDropEntry(pool, rng);
    if (pick?.id) itemIds.push(pick.id);
  }
  return { itemIds, label, count };
}

export function mysteryCaveBossExperience(templateId) {
  const id = Math.trunc(Number(templateId) || 0);
  const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === id);
  return Math.max(0, Math.trunc(Number(template?.experience) || 0));
}

export function mysteryCaveFurthestBossExperienceSource(kills, bestWave = null) {
  const wave = sanitizeMysteryCaveBestWave(bestWave, kills);
  const ids = MYSTERY_CAVE_SPAWN_WAVES[wave]?.templateIds ?? [];
  let best = { xp: 0, name: null, templateId: null };
  for (const templateId of ids) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    const xp = Math.max(0, Math.trunc(Number(template?.experience) || 0));
    if (xp > best.xp) {
      best = { xp, name: template?.name ?? null, templateId };
    }
  }
  return best;
}

/** kills × furthest-boss template XP × 1/2/3/4 × MYSTERY_CAVE_XP_MULTIPLIER. */
export function mysteryCaveExperienceReward(kills, bestWave = null, tier = 0) {
  const n = sanitizeMysteryCaveKills(kills);
  const { xp } = mysteryCaveFurthestBossExperienceSource(n, bestWave);
  return n * xp * mysteryCaveStatMultiplier(tier) * MYSTERY_CAVE_XP_MULTIPLIER;
}

export function mysteryCaveTierLabel(tier = 0) {
  const clamped = clampMysteryCaveFightTier(tier);
  if (clamped >= 3) return "Awakened";
  if (clamped >= 2) return "Ascended";
  if (clamped >= 1) return "Empowered";
  return "Normal";
}

export function mysteryCaveWaveIndexForPlanEntry(entry, fallbackIndex = 0) {
  if (entry?.waveIndex != null && Number.isFinite(Number(entry.waveIndex))) {
    return Math.max(0, Math.trunc(Number(entry.waveIndex)));
  }
  const spawnAtMs = Math.max(0, Math.trunc(Number(entry?.spawnAtMs ?? entry?.spawnDelayMs) || 0));
  if (spawnAtMs > 0) return Math.trunc(spawnAtMs / MYSTERY_CAVE_SPAWN_INTERVAL_MS);
  return Math.max(0, Math.trunc(Number(fallbackIndex) || 0));
}

/** A wave counts only when every body in that pack has spawned and none of them are still alive. */
export function mysteryCaveCompletedWaveCount(spawnPlan, spawned, livingWaveIndexes = []) {
  const plan = Array.isArray(spawnPlan) ? spawnPlan : [];
  const spawnedCount = Math.max(0, Math.trunc(Number(spawned) || 0));
  const living = new Set(
    (Array.isArray(livingWaveIndexes) ? livingWaveIndexes : [])
      .map((waveIndex) => Math.trunc(Number(waveIndex)))
      .filter((waveIndex) => Number.isFinite(waveIndex)),
  );
  const waveIndexes = [];
  const seen = new Set();
  plan.forEach((entry, index) => {
    const waveIndex = mysteryCaveWaveIndexForPlanEntry(entry, index);
    if (seen.has(waveIndex)) return;
    seen.add(waveIndex);
    waveIndexes.push(waveIndex);
  });
  let completed = 0;
  for (const waveIndex of waveIndexes) {
    const indices = [];
    plan.forEach((entry, index) => {
      if (mysteryCaveWaveIndexForPlanEntry(entry, index) === waveIndex) indices.push(index);
    });
    if (!indices.length) continue;
    if (indices.some((index) => index >= spawnedCount)) continue;
    if (living.has(waveIndex)) continue;
    completed += 1;
  }
  return completed;
}

export function isMysteryCaveIneligibleBoss(template) {
  if (!template) return true;
  return Boolean(template.stationaryBoss || template.fixedArenaSpawn);
}

export function isMysteryCaveZone(zone) {
  if (!zone) return false;
  if (typeof zone === "string") return zone === MYSTERY_CAVE_ZONE_ID;
  return zone.id === MYSTERY_CAVE_ZONE_ID || zone.mysteryCave === true;
}

/** 0 plain / 1 empowered / 2 ascended / 3 awakened — same 1×/2×/3×/4× as boss rooms. */
export const MYSTERY_CAVE_TIER_MULTIPLIERS = [1, 2, 3, 4];

export function clampMysteryCaveFightTier(tier) {
  return Math.max(0, Math.min(3, Math.trunc(Number(tier) || 0)));
}

export function mysteryCaveStatMultiplier(tier = 0) {
  return MYSTERY_CAVE_TIER_MULTIPLIERS[clampMysteryCaveFightTier(tier)];
}

export function mysteryCaveBossMaxHp(template, tier = 0) {
  const base = Math.max(0, Math.trunc(Number(template?.maxHp) || 0));
  return Math.max(1, Math.round(base * mysteryCaveStatMultiplier(tier)));
}

/** When the field is empty, slide the spawn clock so the next boss is due now. Later bosses keep their 10s gaps. */
export function mysteryCavePulledFightStartAt(fightStartAt, nextSpawnAtMs, now) {
  const start = Number(fightStartAt) || 0;
  const dueOffset = Math.max(0, Math.trunc(Number(nextSpawnAtMs) || 0));
  const t = Number(now) || 0;
  if (t >= start + dueOffset) return start;
  return t - dueOffset;
}
