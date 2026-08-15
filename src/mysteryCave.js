/**
 * Mystery Cave — timed boss-swarm gauntlet.
 *
 * Every run spawns the full moving-boss roster, easiest → hardest, one every
 * 10 seconds. Difficulty is the existing Empowered / Ascended / Awakened
 * fight. Stationary room bosses stay out (Evil Centipede, Great Fox Spirit,
 * Hell Keeper, Hell Lord, Red Moon Evil, Guardian Rock).
 */

export const MYSTERY_CAVE_ZONE_ID = "zone-mystery-cave";
export const MYSTERY_CAVE_SPAWN_INTERVAL_MS = 10_000;
export const MYSTERY_CAVE_LANES = [-1, 0, 1];

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
 * Moving named bosses, easiest → hardest.
 * Template ids must match PHASE1_ENEMY_TEMPLATES.
 */
export const MYSTERY_CAVE_BOSS_TEMPLATE_IDS = [
  256, // Wooma Taurus
  266, // Evil Snake
  272, // Zuma Taurus
  279, // Bone Lord
  414, // Yimoogi
  287, // Minotaur King
  445, // Dream Devourer
  446, // Dark Devourer
  292, // King Scorpion
  316, // King Hog
  291, // Oma King Spirit
  293, // Manectric King
  997, // Danmo
  994, // Beast King
  471, // Frost Tiger
  472, // Oma King
];

export function buildMysteryCaveSpawnQueue() {
  return MYSTERY_CAVE_BOSS_TEMPLATE_IDS.map((templateId, index) => ({
    templateId,
    spawnDelayMs: index * MYSTERY_CAVE_SPAWN_INTERVAL_MS,
    lane: MYSTERY_CAVE_LANES[index % MYSTERY_CAVE_LANES.length],
  }));
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
