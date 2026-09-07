/**
 * Mystery Cave — timed boss-swarm gauntlet.
 *
 * Every run spawns the full moving-boss roster, easiest → hardest, one wave
 * every 10 seconds. Rooms that fight as a pack spawn together on that tick
 * (Dream + Dark Devourer, three Incarnated Wooma Taurus, IZT + both Incarnated
 * Red Thunder Zuma). Difficulty is Empowered / Ascended / Awakened on both
 * ticket types. Random (separate ticket): infinite remix that picks a body and a
 * stat donor independently from the whole walking roster, ranked by threat; the
 * donor window is capped at Wooma Taurus for the opening spawns and widens to the
 * full ladder by spawn 45, one silly chest item per 5 kills. Stationary room
 * bosses stay out (Evil Centipede, Great Fox Spirit,
 * Hell Keeper, Hell Lord, Red Moon Evil, Guardian Rock).
 */

import { BOSS_DROP_TABLE_BY_LABEL, BOSS_GEM_ITEM_IDS, BOSS_ORB_ITEM_IDS } from "./bossDrops.js";
import { itemCanBeEmpowered, rollEmpoweredItemDrop } from "./core/empoweredItems.js";
import { rollEmpoweredBossGlyphItemId } from "./glyphModifiers.js";
import { PHASE1_ENEMY_TEMPLATES } from "./phase1Data.js";

export const MYSTERY_CAVE_ZONE_ID = "zone-mystery-cave";
export const MYSTERY_CAVE_RANDOM_ZONE_ID = "zone-mystery-cave-random";
export const MYSTERY_CAVE_RANDOM_TICKET_ITEM_ID = "mystery-cave-random-ticket";
/** One Random Cave run per day, account-wide, however many tickets you hold. */
export const MYSTERY_CAVE_RANDOM_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MYSTERY_CAVE_SPAWN_INTERVAL_MS = 10_000;
export const MYSTERY_CAVE_MAX_KILLS = 9999;
export const MYSTERY_CAVE_RANDOM_SPAWN_CAP = 10_000;
export const MYSTERY_CAVE_RANDOM_LOOT_PER_KILLS = 5;
/** Lowest-level equip in the game; pinned in tests so cheap gear stays chest-eligible. */
export const MYSTERY_CAVE_RANDOM_WOODEN_SWORD_ITEM_ID = "wooden-sword";
export const MYSTERY_CAVE_SCARECROW_TEMPLATE_ID = 39;
export const MYSTERY_CAVE_CHICKEN_TEMPLATE_ID = 29;
export const MYSTERY_CAVE_ZUMA_TAURUS_TEMPLATE_ID = 272;
export const MYSTERY_CAVE_OMA_KING_TEMPLATE_ID = 472;
/**
 * Templates that walk and fight but are not real enemies, so they never make a
 * Random Cave body or stat donor. The Trainer is the DPS-test dummy — a 9999 HP,
 * 1 damage, 0 XP wall that just clogs a lane. The zero-experience check below
 * catches any future dummy added the same way.
 */
export const MYSTERY_CAVE_RANDOM_EXCLUDED_TEMPLATE_IDS = Object.freeze([
  290, // Trainer (DPS-test dummy)
]);
/** Hardest donor the opening spawns can roll — the low-gear guardrail. */
export const MYSTERY_CAVE_RANDOM_GUARDRAIL_TEMPLATE_ID = 256; // Wooma Taurus
/** Spawns 1..N are capped at the guardrail donor. */
export const MYSTERY_CAVE_RANDOM_GUARDRAIL_SPAWNS = 5;
/** Spawn at which the donor window first reaches the top of the ladder. */
export const MYSTERY_CAVE_RANDOM_FULL_LADDER_SPAWN = 45;
/** Ladder steps the window floor climbs per spawn once the ceiling has topped out. */
export const MYSTERY_CAVE_RANDOM_FLOOR_STEP_PER_SPAWN = 1.2;
/**
 * Monsters whose projectile / bloom overlay can be stolen for a Random Cave attack.
 * Every entry here has a `projectile.frames` block in `public/monsters/monster/<index>.json`
 * (deduped by monsterIndex); anything without one is skipped silently at draw time.
 */
export const MYSTERY_CAVE_RANDOM_ATTACK_FX_TEMPLATE_IDS = Object.freeze([
  268, // Zuma Archer
  271, // Red Thunder Zuma
  279, // Bone Lord
  285, // Right Guard
  286, // Left Guard
  287, // Minotaur King
  292, // King Scorpion
  293, // Manectric King
  294, // Flame Queen
  295, // Flaming Mutant
  296, // Scaly Beast
  319, // Dark Devil
  429, // Hell Bolt
  430, // Witch Doctor
  447, // Red Fox Man
  449, // White Fox Man
  452, // Great Fox Spirit
  454, // Red Moon Evil
  465, // Crystal Spider
  471, // Frost Tiger
  472, // Oma King
  997, // Danmo
]);
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
  465: "Crystal Spider",
  256: "Wooma Taurus",
  279: "Bone Lord",
  272: "Zuma Taurus",
  464: "Red Evil Ape",
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
  473, // Evil Mir (lab test)
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
 * - The two Red Moon Valley mid-bosses sit by raw score, next to the bosses
 *   their statlines were copied from: Crystal Spider just under Wooma Taurus,
 *   Red Evil Ape just after its Zuma Taurus twin.
 * Beast King is a 150k HP wall that barely hits back — placed by time cost next
 * to Danmo rather than by its low damage score.
 */
export const MYSTERY_CAVE_SPAWN_WAVES = [
  { templateIds: [266] }, // Evil Snake
  { templateIds: [465] }, // Crystal Spider
  { templateIds: [256] }, // Wooma Taurus
  { templateIds: [279] }, // Bone Lord
  { templateIds: [272] }, // Zuma Taurus
  { templateIds: [464] }, // Red Evil Ape
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
  return Math.max(0, Math.min(MYSTERY_CAVE_MAX_KILLS, Math.trunc(Number(value) || 0)));
}

/**
 * Stored timestamp for when the next Random Cave run unlocks. A value further
 * out than a full cooldown means the clock moved backwards (system time change,
 * save moved between machines), so it is dropped rather than locking the player
 * out for longer than a day.
 */
export function sanitizeMysteryCaveRandomReadyAt(value, now = Date.now()) {
  const readyAt = Math.max(0, Math.trunc(Number(value) || 0));
  if (!readyAt) return 0;
  const at = Math.max(0, Math.trunc(Number(now) || 0));
  if (readyAt > at + MYSTERY_CAVE_RANDOM_COOLDOWN_MS) return 0;
  return readyAt;
}

export function mysteryCaveRandomCooldownRemainingMs(readyAt, now = Date.now()) {
  return Math.max(0, sanitizeMysteryCaveRandomReadyAt(readyAt, now) - now);
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
  if (typeof zone === "string") {
    return zone === MYSTERY_CAVE_ZONE_ID || zone === MYSTERY_CAVE_RANDOM_ZONE_ID;
  }
  return zone.id === MYSTERY_CAVE_ZONE_ID
    || zone.id === MYSTERY_CAVE_RANDOM_ZONE_ID
    || zone.mysteryCave === true;
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

export function createMysteryCaveRng(seed) {
  let state = (Math.trunc(Number(seed) || 1) >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function mysteryCaveRandomSeedFromIndex(seed, index) {
  const base = (Math.trunc(Number(seed) || 1) >>> 0) || 1;
  const step = (Math.trunc(Number(index) || 0) + 1) >>> 0;
  return (Math.imul(base ^ (step * 0x9e3779b9), 0x85ebca6b) >>> 0) || 1;
}

export function mysteryCaveRandomLootCount(kills) {
  return Math.floor(sanitizeMysteryCaveKills(kills) / MYSTERY_CAVE_RANDOM_LOOT_PER_KILLS);
}

/**
 * Random Cave payouts are ONE roll for the whole run, from 1 up to a ceiling that
 * each kill raises by a flat amount. Ten kills means "up to 250,000 gold", not
 * "250,000 gold" — the run can still pay out 12. That single wide roll is the
 * point: it is what makes a deep run a gamble rather than a guaranteed salary.
 * Do not turn this into a per-kill roll that gets summed; averaging many rolls
 * collapses the spread and the low-roll gut-punch disappears.
 */
export const MYSTERY_CAVE_RANDOM_PAYOUT_MIN = 1;
export const MYSTERY_CAVE_RANDOM_GOLD_MAX_PER_KILL = 25_000;
/**
 * XP ceiling per kill, as a multiple of the anchor from
 * `mysteryCaveBestBossExperienceUpToKills`. The average roll is half the ceiling,
 * which lands ~0.62× the normal cave's XP for the same kills.
 *
 * This was 1.25 against the old wave-only anchor. Making that anchor monotonic
 * raised it from 40,000 to 58,000 at saturation, so the factor came down by the
 * same ratio to keep payouts where they were tuned — the bug fix was meant to
 * stop XP going backwards, not to hand out 45% more of it.
 *
 * Remember the fight tier multiplies this by up to 4× and the account XP rate
 * (rebirth / gear / supporter) multiplies again on claim, so the number here is
 * several times smaller than what a real player banks.
 */
export const MYSTERY_CAVE_RANDOM_XP_MAX_FACTOR = 0.86;

export function mysteryCaveRandomGoldRange(kills) {
  const n = sanitizeMysteryCaveKills(kills);
  return {
    min: n > 0 ? MYSTERY_CAVE_RANDOM_PAYOUT_MIN : 0,
    max: n * MYSTERY_CAVE_RANDOM_GOLD_MAX_PER_KILL,
  };
}

let mysteryCaveBestBossXpPrefixCache = null;

/**
 * Highest sheet XP any normal-cave wave up to this kill count pays.
 *
 * `mysteryCaveFurthestBossExperienceSource` reports only the single wave the
 * kill count lands on, and the wave ladder is ordered by fight difficulty, not
 * by XP — so that value can DROP as kills rise. Anchoring Random Cave XP on it
 * directly meant one extra kill could cut your payout: 24 kills paid 46% less
 * than 23, with smaller dips at 10, 11 and 15. Taking the running maximum makes
 * the anchor non-decreasing, so another kill is never a downgrade.
 */
export function mysteryCaveBestBossExperienceUpToKills(kills) {
  const n = sanitizeMysteryCaveKills(kills);
  if (n <= 0) return 0;
  if (!mysteryCaveBestBossXpPrefixCache) {
    const span = Math.max(1, buildMysteryCaveSpawnQueue().length);
    const prefix = new Array(span);
    let best = 0;
    for (let i = 0; i < span; i += 1) {
      const xp = Math.max(0, Math.trunc(Number(mysteryCaveFurthestBossExperienceSource(i + 1).xp) || 0));
      if (xp > best) best = xp;
      prefix[i] = best;
    }
    mysteryCaveBestBossXpPrefixCache = prefix;
  }
  const prefix = mysteryCaveBestBossXpPrefixCache;
  return prefix[Math.min(prefix.length, n) - 1];
}

export function mysteryCaveRandomExperienceRange(kills) {
  const n = sanitizeMysteryCaveKills(kills);
  const anchorXp = Math.max(1, mysteryCaveBestBossExperienceUpToKills(n));
  return {
    min: n > 0 ? MYSTERY_CAVE_RANDOM_PAYOUT_MIN : 0,
    max: Math.round(n * anchorXp * MYSTERY_CAVE_RANDOM_XP_MAX_FACTOR),
  };
}

function rollMysteryCaveRandomIntInclusive(min, max, rng) {
  const lo = Math.max(0, Math.trunc(Number(min) || 0));
  const hi = Math.max(lo, Math.trunc(Number(max) || 0));
  return lo + Math.floor(rngUnit(rng) * (hi - lo + 1));
}

export function mysteryCaveRandomGoldReward(kills, tier = 0, seed = 1) {
  const { min, max } = mysteryCaveRandomGoldRange(kills);
  if (max <= 0) return 0;
  const rng = createMysteryCaveRng(mysteryCaveRandomSeedFromIndex(seed, 0x61d));
  return rollMysteryCaveRandomIntInclusive(min, max, rng) * mysteryCaveStatMultiplier(tier);
}

export function mysteryCaveRandomExperienceReward(kills, tier = 0, seed = 1) {
  const { min, max } = mysteryCaveRandomExperienceRange(kills);
  if (max <= 0) return 0;
  const rng = createMysteryCaveRng(mysteryCaveRandomSeedFromIndex(seed, 0xe4e));
  return rollMysteryCaveRandomIntInclusive(min, max, rng)
    * mysteryCaveStatMultiplier(tier)
    * MYSTERY_CAVE_XP_MULTIPLIER;
}

/**
 * Every monster that can legally walk into a Random Cave lane: has a sprite, moves,
 * and is not one of the arena-locked stationary bosses. Used for both bodies and
 * combat donors, so a Chicken body can carry Oma King stats and vice versa.
 */
function mysteryCaveRandomEligibleTemplates() {
  const seen = new Set();
  const out = [];
  for (const template of PHASE1_ENEMY_TEMPLATES) {
    if (!template || seen.has(template.id)) continue;
    seen.add(template.id);
    if (isMysteryCaveIneligibleBoss(template)) continue;
    if (MYSTERY_CAVE_EXCLUDED_STATIONARY_TEMPLATE_IDS.includes(template.id)) continue;
    if (MYSTERY_CAVE_RANDOM_EXCLUDED_TEMPLATE_IDS.includes(template.id)) continue;
    if (!(Number(template.experience) > 0)) continue;
    if ((Number(template.moveMs) || 0) <= 0) continue;
    if (template.monsterIndex == null) continue;
    out.push(template);
  }
  return out;
}

/**
 * Rough "how scary is this to stand next to" score: HP wall × damage per second.
 * The `+ LANE_COST` term keeps tanky-but-feeble monsters honest — low damage per
 * hit reads as harmless, but a lane you cannot clear before the next spawn buries
 * you anyway, so time-to-kill has to count for something on its own.
 */
const MYSTERY_CAVE_RANDOM_LANE_COST_DPS = 10;

function mysteryCaveRandomThreatScore(template) {
  const hp = Math.max(1, Math.trunc(Number(template?.maxHp) || 0));
  const high = (range) => (Array.isArray(range) ? Math.max(0, Number(range[1]) || 0) : 0);
  const damage = Math.max(high(template?.dc), high(template?.mc), high(template?.sc));
  const attackSeconds = Math.max(0.4, (Number(template?.attackMs) || 1500) / 1000);
  return hp * ((damage / attackSeconds) + MYSTERY_CAVE_RANDOM_LANE_COST_DPS);
}

let mysteryCaveRandomLadderCache = null;

/**
 * Combat donors, weakest → strongest by threat score. This is the whole eligible
 * roster (Chicken through Oma King), not just the boss ladder, so the difficulty
 * window can widen in small steps instead of jumping from trash to boss.
 * Ranked independently of `MYSTERY_CAVE_SPAWN_WAVES` — that order is hand-tuned
 * for the normal cave's fixed sequence and is not a difficulty ranking.
 */
export function mysteryCaveRandomCombatDonorIds() {
  if (mysteryCaveRandomLadderCache) return mysteryCaveRandomLadderCache;
  const ranked = mysteryCaveRandomEligibleTemplates()
    .map((template) => ({ id: template.id, score: mysteryCaveRandomThreatScore(template) }))
    .sort((a, b) => (a.score - b.score) || (a.id - b.id))
    .map((entry) => entry.id);
  mysteryCaveRandomLadderCache = Object.freeze(ranked);
  return mysteryCaveRandomLadderCache;
}

/** Bodies are a uniform pick from the same roster — looks mean nothing here. */
export function mysteryCaveRandomVisualTemplateIds() {
  return mysteryCaveRandomCombatDonorIds();
}

/**
 * The difficulty band for a spawn, as indices into the donor ladder. The ceiling
 * sits on the guardrail donor for the opening spawns, then climbs to the top of
 * the ladder by `MYSTERY_CAVE_RANDOM_FULL_LADDER_SPAWN`. The floor stays at zero
 * until then, so a lucky run can keep rolling harmless donors well past wave 50;
 * afterwards it climbs too, which is what eventually ends every run.
 */
export function mysteryCaveRandomCombatWindow(spawnIndex) {
  const ids = mysteryCaveRandomCombatDonorIds();
  const last = Math.max(0, ids.length - 1);
  let guardIndex = ids.indexOf(MYSTERY_CAVE_RANDOM_GUARDRAIL_TEMPLATE_ID);
  if (guardIndex < 0) guardIndex = Math.min(last, Math.round(last * 0.6));
  const index = Math.max(0, Math.trunc(Number(spawnIndex) || 0));
  const guardSpawns = Math.max(1, MYSTERY_CAVE_RANDOM_GUARDRAIL_SPAWNS);
  const topIndex = Math.max(guardSpawns, MYSTERY_CAVE_RANDOM_FULL_LADDER_SPAWN - 1);
  let maxIndex = guardIndex;
  if (index >= guardSpawns) {
    const steps = Math.max(1, topIndex - guardSpawns + 1);
    const t = Math.min(1, (index - guardSpawns + 1) / steps);
    maxIndex = Math.min(last, guardIndex + Math.round((last - guardIndex) * t));
  }
  const overflow = Math.max(0, index - topIndex);
  const minIndex = Math.min(
    maxIndex,
    Math.round(overflow * MYSTERY_CAVE_RANDOM_FLOOR_STEP_PER_SPAWN),
  );
  return { ids, minIndex, maxIndex, guardIndex, topIndex };
}

/**
 * Stat jitter only. The donor pick carries the difficulty curve, so this stays
 * near 1× for the whole ramp and only escalates once the ladder has topped out —
 * otherwise the two ramps compound and the run dies on a cliff instead of a curve.
 */
export function mysteryCaveRandomStatMultiplier(spawnIndex, rng = Math.random) {
  const index = Math.max(0, Math.trunc(Number(spawnIndex) || 0));
  const { topIndex } = mysteryCaveRandomCombatWindow(index);
  const overflow = Math.max(0, index - topIndex);
  const min = 0.75 + overflow * 0.18;
  const max = 1.25 + overflow * 0.35;
  const unit = rngUnit(rng);
  return min + unit * Math.max(0, max - min);
}

export function mysteryCaveRandomAttackFxChance(spawnIndex) {
  const index = Math.max(0, Math.trunc(Number(spawnIndex) || 0));
  return Math.min(0.35, Math.max(0, (index - 3) * 0.02));
}

function rngUnit(rng) {
  const roll = typeof rng === "function" ? Number(rng()) : Number(rng);
  return Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
}

function pickMysteryCaveWeightedKey(weights, rng = Math.random) {
  const entries = Object.entries(weights ?? {}).filter(([, weight]) => (Number(weight) || 0) > 0);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  let cursor = rngUnit(rng) * total;
  for (const [key, weight] of entries) {
    cursor -= Number(weight);
    if (cursor < 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Flat pick inside the window — every donor in range is equally likely, so lucky streaks exist. */
function pickFromDonorSpan(ids, lo, hi, rng) {
  const min = Math.max(0, Math.min(lo, hi));
  const max = Math.min(ids.length - 1, Math.max(lo, hi));
  const span = Math.max(1, max - min + 1);
  return ids[min + Math.min(span - 1, Math.floor(rngUnit(rng) * span))];
}

function pickMysteryCaveCombatTemplateId(spawnIndex, rng) {
  const { ids, minIndex, maxIndex } = mysteryCaveRandomCombatWindow(spawnIndex);
  if (!ids.length) return MYSTERY_CAVE_SCARECROW_TEMPLATE_ID;
  return pickFromDonorSpan(ids, minIndex, maxIndex, rng);
}

export function buildMysteryCaveRandomPlanEntry(seed, spawnIndex) {
  const index = Math.max(0, Math.trunc(Number(spawnIndex) || 0));
  const rng = createMysteryCaveRng(mysteryCaveRandomSeedFromIndex(seed, index));
  const visualIds = mysteryCaveRandomVisualTemplateIds();
  const visualTemplateId = Math.trunc(Number(pickMysteryCavePoolItem(visualIds, rng)) || MYSTERY_CAVE_SCARECROW_TEMPLATE_ID);
  const combatTemplateId = pickMysteryCaveCombatTemplateId(index, rng);
  const statMultiplier = mysteryCaveRandomStatMultiplier(index, rng);
  let attackFxTemplateId = 0;
  if (rng() < mysteryCaveRandomAttackFxChance(index)) {
    attackFxTemplateId = Math.trunc(Number(pickMysteryCavePoolItem(MYSTERY_CAVE_RANDOM_ATTACK_FX_TEMPLATE_IDS, rng)) || 0);
  }
  return {
    templateId: visualTemplateId,
    combatTemplateId,
    statMultiplier,
    attackFxTemplateId,
    spawnDelayMs: index * MYSTERY_CAVE_SPAWN_INTERVAL_MS,
    spawnAtMs: index * MYSTERY_CAVE_SPAWN_INTERVAL_MS,
    waveIndex: index,
    lane: MYSTERY_CAVE_LANES[index % MYSTERY_CAVE_LANES.length],
  };
}

export function ensureMysteryCaveRandomSpawnPlan(bossSwarm, upToIndex = 0) {
  if (!bossSwarm?.mysteryCaveRandom) return bossSwarm?.spawnPlan ?? [];
  if (!Array.isArray(bossSwarm.spawnPlan)) bossSwarm.spawnPlan = [];
  const seed = (Math.trunc(Number(bossSwarm.mysteryCaveRandomSeed) || 1) >>> 0) || 1;
  const need = Math.min(
    MYSTERY_CAVE_RANDOM_SPAWN_CAP - 1,
    Math.max(0, Math.trunc(Number(upToIndex) || 0)),
  );
  while (bossSwarm.spawnPlan.length <= need) {
    bossSwarm.spawnPlan.push(buildMysteryCaveRandomPlanEntry(seed, bossSwarm.spawnPlan.length));
  }
  bossSwarm.totalSpawns = MYSTERY_CAVE_RANDOM_SPAWN_CAP;
  return bossSwarm.spawnPlan;
}

function mysteryCaveRandomLootWeights(kills) {
  const t = Math.min(1, sanitizeMysteryCaveKills(kills) / 40);
  const mix = (early, late) => early * (1 - t) + late * t;
  return {
    sunPotion: mix(0.55, 0.12),
    plainItem: mix(0.25, 0.18),
    star1: mix(0.12, 0.22),
    star2: mix(0.06, 0.22),
    star3: mix(0.02, 0.16),
    star4: mix(0.005, 0.10),
  };
}

function itemHasZoneDrop(item) {
  const drop = item?.drop;
  if (!drop) return false;
  if (Number(drop.chance) > 0) return true;
  const chances = drop.chances;
  if (chances && typeof chances === "object") {
    if (Object.values(chances).some((chance) => Number(chance) > 0)) return true;
  }
  const enemyChances = drop.enemyChances;
  if (enemyChances && typeof enemyChances === "object") {
    for (const byZone of Object.values(enemyChances)) {
      if (!byZone || typeof byZone !== "object") continue;
      if (Object.values(byZone).some((chance) => Number(chance) > 0)) return true;
    }
  }
  return Array.isArray(drop.zones) && drop.zones.length > 0;
}

function mysteryCaveRandomBossDropItemIds() {
  const ids = new Set();
  for (const table of Object.values(BOSS_DROP_TABLE_BY_LABEL)) {
    for (const pool of [table?.items, table?.awakenedItems]) {
      for (const entry of Array.isArray(pool) ? pool : []) {
        const id = String(entry?.id ?? "").trim();
        if (!id || (Number(entry?.chance) || 0) <= 0) continue;
        ids.add(id);
      }
    }
  }
  return ids;
}

/** Equipables that actually drop from zone tables (`items.json` drop files) or boss tables. */
export function mysteryCaveRandomDroppableEquipIds(items) {
  const bossIds = mysteryCaveRandomBossDropItemIds();
  const ids = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    if (!itemCanBeEmpowered(item) || !isMysteryCaveEquipmentDropItem(item)) continue;
    if (!bossIds.has(id) && !itemHasZoneDrop(item)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Flat pick from the droppable pool — no item is singled out. The joke is that a
 * Wooden Sword is in there on equal footing with endgame gear and can come out
 * empowered, not that it is likelier than anything else.
 */
function pickMysteryCaveRandomEquipId(ids, rng) {
  if (!ids.length) return null;
  return pickMysteryCavePoolItem(ids, rng) ?? ids[0];
}

/**
 * One chest pick per 5 kills. Range opens with kills: early runs lean sun potions,
 * later runs can still roll a potion. Any droppable equip can come out at any star
 * tier, so the whole pool from Wooden Sword up is eligible for a 4★ roll.
 */
export function rollMysteryCaveRandomChestItems(kills, items = [], rng = Math.random) {
  const count = mysteryCaveRandomLootCount(kills);
  const weights = mysteryCaveRandomLootWeights(kills);
  const equipIds = mysteryCaveRandomDroppableEquipIds(items);
  const lookup = Array.isArray(items)
    ? (id) => items.find((item) => item.id === id)
    : () => null;
  const grants = [];
  for (let i = 0; i < count; i += 1) {
    const kind = pickMysteryCaveWeightedKey(weights, rng);
    if (kind === "sunPotion" || !equipIds.length) {
      grants.push({ itemId: MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID, quantity: 1 });
      continue;
    }
    const wantStars = kind === "star1" ? 1
      : kind === "star2" ? 2
        : kind === "star3" ? 3
          : kind === "star4" ? 4
            : 0;
    const itemId = pickMysteryCaveRandomEquipId(equipIds, rng);
    if (!itemId) {
      grants.push({ itemId: MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID, quantity: 1 });
      continue;
    }
    if (wantStars <= 0) {
      grants.push({ itemId, quantity: 1 });
      continue;
    }
    const item = lookup(itemId);
    const roll = item ? rollEmpoweredItemDrop(item, rng, {
      itemChance: 1,
      tierWeights: [{ tier: wantStars, weight: 1 }],
    }) : null;
    if (!roll) {
      grants.push({ itemId, quantity: 1 });
      continue;
    }
    grants.push({
      itemId,
      quantity: 1,
      empowered: true,
      empowerTier: roll.empowerTier,
      empowerBonusStats: roll.empowerBonusStats,
      empowerSpellBonuses: roll.empowerSpellBonuses,
    });
  }
  return grants;
}
