/** Crystal LevelEffects prestige auras — armour visualEffect ids 200+. */
export const LEVEL_EFFECT_VISUAL_BASE = 200;

export const LEVEL_EFFECT_VISUAL_DEFS = [
  { key: "mist", label: "Mist" },
  { key: "red-dragon", label: "Red Dragon" },
  { key: "blue-dragon", label: "Blue Dragon" },
  { key: "rebirth1", label: "Rebirth 1" },
  { key: "rebirth2", label: "Rebirth 2" },
  { key: "rebirth3", label: "Rebirth 3" },
  { key: "new-blue", label: "New Blue" },
  { key: "yellow-dragon", label: "Yellow Dragon" },
  { key: "phoenix", label: "Phoenix" },
].map((entry, index) => ({
  id: LEVEL_EFFECT_VISUAL_BASE + index,
  key: entry.key,
  label: entry.label,
  atlasPath: `./public/level-effects/${entry.key}/atlas.json`,
  blend: "screen",
}));

export const LEVEL_EFFECT_VISUAL_BY_KEY = Object.fromEntries(
  LEVEL_EFFECT_VISUAL_DEFS.map((def) => [def.key, def]),
);

/** Active level-aura assignment (one armour at a time while testing). */
export const LEVEL_EFFECT_ARMOUR_ASSIGNMENTS = {};

export function levelEffectVisualIdForKey(key) {
  return LEVEL_EFFECT_VISUAL_BY_KEY[key]?.id ?? null;
}
