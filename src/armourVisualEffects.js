import {
  LEVEL_EFFECT_ARMOUR_ASSIGNMENTS,
  LEVEL_EFFECT_VISUAL_BASE,
  LEVEL_EFFECT_VISUAL_DEFS,
  levelEffectVisualIdForKey,
} from "./levelVisualEffects.js";

/** Crystal Player frame table — wing/effect animation slices (east-facing). */
export const PLAYER_WING_ACTIONS = {
  standing: { start: 0, count: 8, offset: 8, interval: 250 },
  walking: { start: 64, count: 6, offset: 6, interval: 100 },
  running: { start: 112, count: 6, offset: 6, interval: 100 },
  stance: { start: 160, count: 1, offset: 1, interval: 1000 },
  stance2: { start: 332, count: 1, offset: 6, interval: 1000 },
  attack1: { start: 168, count: 6, offset: 6, interval: 100 },
  attack2: { start: 216, count: 6, offset: 6, interval: 100 },
  attack3: { start: 264, count: 8, offset: 8, interval: 100 },
  attack4: { start: 448, count: 6, offset: 6, interval: 100 },
  spell: { start: 328, count: 6, offset: 6, interval: 100 },
  harvest: { start: 376, count: 2, offset: 2, interval: 300 },
  struck: { start: 392, count: 3, offset: 3, interval: 100 },
  die: { start: 416, count: 4, offset: 4, interval: 100 },
  dead: { start: 419, count: 1, offset: 4, interval: 1000 },
  revive: { start: 416, count: 4, offset: 4, interval: 100 },
  mine: { start: 216, count: 6, offset: 6, interval: 100 },
  lunge: { start: 300, count: 1, offset: 6, interval: 1000 },
  sneek: { start: 496, count: 6, offset: 6, interval: 100 },
  dashAttack: { start: 112, count: 3, offset: 3, interval: 100 },
  walkingBow: { start: 0, count: 6, offset: 6, interval: 100 },
  runningBow: { start: 48, count: 6, offset: 6, interval: 100 },
  attackRange1: { start: 96, count: 8, offset: 8, interval: 100 },
  attackRange2: { start: 160, count: 8, offset: 8, interval: 100 },
  attackRange3: { start: 224, count: 8, offset: 8, interval: 100 },
  jump: { start: 288, count: 8, offset: 8, interval: 100 },
  mountStanding: { start: 448, count: 4, offset: 4, interval: 500 },
  mountWalking: { start: 480, count: 8, offset: 8, interval: 100 },
  mountRunning: { start: 544, count: 6, offset: 6, interval: 100 },
  mountStruck: { start: 592, count: 3, offset: 3, interval: 100 },
  mountAttack: { start: 616, count: 6, offset: 6, interval: 100 },
};

export const ARMOUR_WING_LAYER = "wing";

/** Looping armour overlays from Crystal Effect.Lib / CHumEffect (effect id 100–199). */
const NATIVE_ARMOUR_SPECIAL_EFFECT_DEFS = {
  100: {
    id: 100,
    label: "Oma King Robe",
    atlasPath: "./public/armour-effects/oma-king-robe/atlas.json",
    durationMs: 3600,
    blend: "screen",
    drawBehind: false,
  },
  101: {
    id: 101,
    label: "Black Dragon Armour",
    atlasPath: "./public/armour-effects/black-dragon-armour/atlas.json",
    durationMs: 1500,
    blend: "screen",
    drawBehind: false,
  },
};

const LEVEL_ARMOUR_SPECIAL_EFFECT_DEFS = Object.fromEntries(
  LEVEL_EFFECT_VISUAL_DEFS.map((def) => [def.id, def]),
);

export const ARMOUR_SPECIAL_EFFECT_DEFS = {
  ...NATIVE_ARMOUR_SPECIAL_EFFECT_DEFS,
  ...LEVEL_ARMOUR_SPECIAL_EFFECT_DEFS,
};

/**
 * Wing overlays (Crystal CHumEffect, effect ids 1–99). Opt-in per item —
 * Heaven Robe stays wingless; Heaven Armour uses Crystal effect 1 → wing 0.
 */
export const ARMOUR_WING_EFFECT_ITEM_IDS = new Set(["winged-heaven-armour"]);

/** Items that receive visualEffect from Crystal or level-aura assignments at build. */
export const ARMOUR_VISUAL_EFFECT_ITEM_IDS = new Set(Object.keys(LEVEL_EFFECT_ARMOUR_ASSIGNMENTS));

export function armourVisualEffectForItem(item) {
  if (!item || item.slot !== "armour") return null;
  const effectId = Number(item.visualEffect);
  if (!Number.isFinite(effectId) || effectId <= 0) return null;
  if (effectId < 100) {
    if (!ARMOUR_WING_EFFECT_ITEM_IDS.has(item.id)) return null;
    return { kind: "wing", effectId, index: effectId - 1 };
  }
  const def = ARMOUR_SPECIAL_EFFECT_DEFS[effectId];
  if (!def) return null;
  return { kind: "special", ...def };
}

export function visualEffectForArmourItemId(itemId) {
  const levelKey = LEVEL_EFFECT_ARMOUR_ASSIGNMENTS[itemId];
  if (levelKey) return levelEffectVisualIdForKey(levelKey);
  return null;
}

export function wingActionInterval(action, clip) {
  return PLAYER_WING_ACTIONS[action]?.interval ?? clip?.interval ?? 100;
}

export { LEVEL_EFFECT_VISUAL_BASE };
