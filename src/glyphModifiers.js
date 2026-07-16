/**
 * Glyph spell modifiers — equipped in the `glyph` slot.
 * Fixed-identity rewrites of class spells (not random empowers).
 */

/** @typedef {"taoist" | "wizard" | "warrior"} GlyphClassId */

/**
 * @typedef {object} GlyphDef
 * @property {string} id
 * @property {string} itemId
 * @property {GlyphClassId} classId
 * @property {string} label
 * @property {string} description
 * @property {string[]} spellIds
 * @property {string} kind
 * @property {Record<string, number | string | boolean>} [params]
 * @property {boolean} [implemented]
 */

/** @type {GlyphDef[]} */
export const GLYPH_DEFS = [
  {
    id: "taoDefenceBuffFromSc",
    itemId: "glyph-spirit-wards",
    classId: "taoist",
    label: "Glyph of Spirit Wards",
    description: "Soul Shield and Blessed Armour scale from your Spirit rather than your level.",
    spellIds: ["SoulShield", "BlessedArmour"],
    kind: "taoDefenceBuffFromSc",
    params: { scDivisor: 5, baseBonus: 4 },
    implemented: true,
  },
  {
    id: "taoPetOwnerDc",
    itemId: "glyph-pet-might",
    classId: "taoist",
    label: "Glyph of Pet Might",
    description: "Your pets add your physical power to their attacks.",
    spellIds: ["SummonSkeleton", "SummonShinsu", "SummonHolyDeva"],
    kind: "taoPetOwnerDc",
    params: { ownerDcFraction: 1 },
    implemented: true,
  },
  {
    id: "wizardMagicShieldMp",
    itemId: "glyph-mana-aegis",
    classId: "wizard",
    label: "Glyph of Mana Aegis",
    description: "Magic Shield no longer reduces damage. Instead, mana is drained before health.",
    spellIds: ["MagicShield"],
    kind: "wizardMagicShieldMp",
    params: { mpPerHp: 2 },
    implemented: true,
  },
  {
    id: "wizardFireWallDuration",
    itemId: "glyph-eternal-firewall",
    classId: "wizard",
    label: "Glyph of Eternal Firewall",
    description: "Fire Wall lasts much longer.",
    spellIds: ["FireWall"],
    kind: "wizardFireWallDuration",
    params: { durationMultiplier: 2 },
    implemented: true,
  },
  {
    id: "wizardFlameDisruptorSplash",
    itemId: "glyph-disruptor-cascade",
    classId: "wizard",
    label: "Glyph of Disruptor Cascade",
    description: "Flame Disruptor can also strike enemies next to the target for reduced damage.",
    spellIds: ["FlameDisruptor"],
    kind: "wizardFlameDisruptorSplash",
    params: { chance: 0.5, damageFraction: 0.5 },
    implemented: true,
  },
  {
    id: "warriorFlamingSwordDr",
    itemId: "glyph-flaming-bulwark",
    classId: "warrior",
    label: "Glyph of Flaming Bulwark",
    description: "Activating Flaming Sword briefly reduces the damage you take.",
    spellIds: ["FlamingSword"],
    kind: "warriorFlamingSwordDr",
    params: { reductionPercent: 25, durationMs: 3000 },
    implemented: true,
  },
  {
    id: "warriorTwinDrakeBurst",
    itemId: "glyph-twin-fury",
    classId: "warrior",
    label: "Glyph of Twin Fury",
    description: "Twin Drake Blade hits much harder, but needs time to recover after each use.",
    spellIds: ["TwinDrakeBlade"],
    kind: "warriorTwinDrakeBurst",
    params: { damageMultiplier: 2, cooldownMs: 2000 },
    implemented: true,
  },
  {
    id: "warriorProtectionFieldBurst",
    itemId: "glyph-bulwark-field",
    classId: "warrior",
    label: "Glyph of Bulwark Field",
    description: "Protection Field grants a much stronger AC bonus for a short time.",
    spellIds: ["ProtectionField"],
    kind: "warriorProtectionFieldBurst",
    params: { bonusMultiplier: 2, durationMs: 5000 },
    implemented: true,
  },
];

const GLYPH_BY_ID = new Map(GLYPH_DEFS.map((def) => [def.id, def]));
const GLYPH_BY_ITEM_ID = new Map(GLYPH_DEFS.map((def) => [def.itemId, def]));

/** Fixed chance an empowered boss kill awards exactly one glyph (before choosing which). */
export const EMPOWERED_BOSS_GLYPH_DROP_CHANCE = 0.1;

/**
 * @returns {string[]}
 */
export function glyphDropItemIds() {
  return GLYPH_DEFS.map((def) => def.itemId).filter(Boolean);
}

/**
 * Empowered bosses only: 10% chance to drop exactly one glyph, chosen uniformly from all glyphs.
 * @param {() => number} [rng] returns a value in [0, 1)
 * @returns {string | null}
 */
export function rollEmpoweredBossGlyphItemId(rng = Math.random) {
  const chanceRoll = typeof rng === "function" ? Number(rng()) : Math.random();
  if (!(chanceRoll < EMPOWERED_BOSS_GLYPH_DROP_CHANCE)) return null;
  const ids = glyphDropItemIds();
  if (!ids.length) return null;
  const pickRoll = typeof rng === "function" ? Number(rng()) : Math.random();
  const index = Math.min(ids.length - 1, Math.max(0, Math.floor(pickRoll * ids.length)));
  return ids[index] ?? null;
}

/**
 * @param {string | null | undefined} id
 * @returns {GlyphDef | null}
 */
export function glyphDefById(id) {
  if (!id) return null;
  return GLYPH_BY_ID.get(String(id)) ?? null;
}

/**
 * @param {string | null | undefined} itemId
 * @returns {GlyphDef | null}
 */
export function glyphDefByItemId(itemId) {
  if (!itemId) return null;
  return GLYPH_BY_ITEM_ID.get(String(itemId)) ?? null;
}

/**
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function isGlyphItem(item) {
  return item?.slot === "glyph" || Boolean(glyphDefByItemId(item?.id) || glyphDefById(item?.glyph?.modifier));
}

/**
 * Resolve the equipped glyph definition from an inventory snapshot.
 * @param {object | null | undefined} inventory
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {GlyphDef | null}
 */
export function equippedGlyphDef(inventory, itemLookup = null) {
  const entryId = inventory?.equipment?.glyph ?? null;
  if (!entryId) return null;
  const entry = (inventory?.items ?? []).find((row) => row?.id === entryId);
  if (!entry?.itemId) return null;
  const fromTable = glyphDefByItemId(entry.itemId);
  if (fromTable) return fromTable;
  if (typeof itemLookup === "function") {
    const item = itemLookup(entry.itemId);
    const modifier = item?.glyph?.modifier;
    return glyphDefById(modifier) ?? glyphDefByItemId(item?.id);
  }
  return null;
}

/**
 * @param {object | null | undefined} inventory
 * @param {string} kind
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {boolean}
 */
export function hasGlyphModifier(inventory, kind, itemLookup = null) {
  const def = equippedGlyphDef(inventory, itemLookup);
  return Boolean(def && def.kind === kind && def.implemented !== false);
}

/**
 * @param {object | null | undefined} inventory
 * @param {string} spellId
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {GlyphDef | null}
 */
export function glyphModifierForSpell(inventory, spellId, itemLookup = null) {
  const def = equippedGlyphDef(inventory, itemLookup);
  if (!def || def.implemented === false) return null;
  if (!def.spellIds.includes(String(spellId))) return null;
  return def;
}

/**
 * Vanilla Tao defence buff: floor(level / 7) + 4.
 * @param {number} level
 * @returns {number}
 */
export function rollDefenceBuffBonusFromLevel(level) {
  return Math.floor(Math.max(1, Math.trunc(Number(level) || 1)) / 7) + 4;
}

/**
 * Glyph SC formula: floor(maxSc / scDivisor) + baseBonus.
 * @param {number} maxSc
 * @param {{ scDivisor?: number, baseBonus?: number }} [params]
 * @returns {number}
 */
export function rollDefenceBuffBonusFromSc(maxSc, params = {}) {
  const divisor = Math.max(1, Math.trunc(Number(params.scDivisor) || 5));
  const base = Math.max(0, Math.trunc(Number(params.baseBonus) || 4));
  const sc = Math.max(0, Math.trunc(Number(maxSc) || 0));
  return Math.floor(sc / divisor) + base;
}

/**
 * @param {number} level
 * @param {number} maxSc
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function rollTaoistDefenceBuffBonus(level, maxSc, glyph = null) {
  if (glyph?.kind === "taoDefenceBuffFromSc") {
    return rollDefenceBuffBonusFromSc(maxSc, glyph.params);
  }
  return rollDefenceBuffBonusFromLevel(level);
}

/**
 * @param {number} durationMs
 * @param {string | null | undefined} spellId
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphGroundDuration(durationMs, spellId, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(durationMs) || 0));
  if (!glyph || glyph.kind !== "wizardFireWallDuration") return base;
  if (String(spellId) !== "FireWall") return base;
  const mult = Math.max(1, Number(glyph.params?.durationMultiplier) || 2);
  return Math.trunc(base * mult);
}

/**
 * @param {number} bonus
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphProtectionFieldBonus(bonus, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(bonus) || 0));
  if (glyph?.kind !== "warriorProtectionFieldBurst") return base;
  const mult = Math.max(1, Number(glyph.params?.bonusMultiplier) || 2);
  return Math.trunc(base * mult);
}

/**
 * @param {number} durationMs
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphProtectionFieldDuration(durationMs, glyph = null) {
  if (glyph?.kind !== "warriorProtectionFieldBurst") {
    return Math.max(0, Math.trunc(Number(durationMs) || 0));
  }
  return Math.max(0, Math.trunc(Number(glyph.params?.durationMs) || 5000));
}

/**
 * @param {number} ownerMaxDc
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function glyphPetOwnerDcBonus(ownerMaxDc, glyph = null) {
  if (glyph?.kind !== "taoPetOwnerDc") return 0;
  const fraction = Math.max(0, Number(glyph.params?.ownerDcFraction) || 1);
  return Math.floor(Math.max(0, Math.trunc(Number(ownerMaxDc) || 0)) * fraction);
}

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {{ mpPerHp: number } | null}
 */
export function glyphMagicShieldMpParams(glyph = null) {
  if (glyph?.kind !== "wizardMagicShieldMp") return null;
  return {
    mpPerHp: Math.max(1, Math.trunc(Number(glyph.params?.mpPerHp) || 2)),
  };
}

/**
 * Convert incoming HP damage into MP spend + leftover HP damage.
 * @param {number} damage
 * @param {number} currentMp
 * @param {{ mpPerHp?: number } | null | undefined} params
 * @returns {{ hpDamage: number, mpSpent: number, remainingMp: number, shieldBroken: boolean }}
 */
export function absorbDamageWithManaAegis(damage, currentMp, params = null) {
  const amount = Math.max(0, Math.trunc(Number(damage) || 0));
  const mp = Math.max(0, Math.trunc(Number(currentMp) || 0));
  const mpPerHp = Math.max(1, Math.trunc(Number(params?.mpPerHp) || 2));
  if (amount <= 0) {
    return { hpDamage: 0, mpSpent: 0, remainingMp: mp, shieldBroken: false };
  }
  if (mp <= 0) {
    return { hpDamage: amount, mpSpent: 0, remainingMp: 0, shieldBroken: true };
  }
  const maxAbsorbableHp = Math.floor(mp / mpPerHp);
  const absorbedHp = Math.min(amount, maxAbsorbableHp);
  const mpSpent = absorbedHp * mpPerHp;
  const remainingMp = mp - mpSpent;
  return {
    hpDamage: amount - absorbedHp,
    mpSpent,
    remainingMp,
    shieldBroken: remainingMp <= 0,
  };
}

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {{ chance: number, damageFraction: number } | null}
 */
export function glyphFlameDisruptorSplashParams(glyph = null) {
  if (glyph?.kind !== "wizardFlameDisruptorSplash") return null;
  return {
    chance: Math.max(0, Math.min(1, Number(glyph.params?.chance) || 0.5)),
    damageFraction: Math.max(0, Number(glyph.params?.damageFraction) || 0.5),
  };
}

/**
 * @param {number} primaryDamage
 * @param {number} damageFraction
 * @returns {number}
 */
export function flameDisruptorSplashDamage(primaryDamage, damageFraction = 0.5) {
  const damage = Math.max(0, Math.trunc(Number(primaryDamage) || 0));
  const fraction = Math.max(0, Number(damageFraction) || 0);
  return Math.max(0, Math.trunc(damage * fraction));
}

/**
 * @param {number} chance
 * @param {() => number} [random]
 * @returns {boolean}
 */
export function rollFlameDisruptorSplashChance(chance, random = Math.random) {
  const c = Math.max(0, Math.min(1, Number(chance) || 0));
  if (c <= 0) return false;
  if (c >= 1) return true;
  return random() < c;
}

/** Buff kind pushed when Flaming Bulwark glyph procs on Flaming Sword toggle. */
export const FLAMING_SWORD_GLYPH_DR_KIND = "flamingSwordGlyphDr";

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {{ reductionPercent: number, durationMs: number } | null}
 */
export function glyphFlamingSwordDrParams(glyph = null) {
  if (glyph?.kind !== "warriorFlamingSwordDr") return null;
  return {
    reductionPercent: Math.max(0, Math.min(100, Math.trunc(Number(glyph.params?.reductionPercent) || 25))),
    durationMs: Math.max(0, Math.trunc(Number(glyph.params?.durationMs) || 3000)),
  };
}

/**
 * @param {number} damage
 * @param {string | null | undefined} spellId
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphTwinDrakeDamage(damage, spellId, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(damage) || 0));
  if (glyph?.kind !== "warriorTwinDrakeBurst") return base;
  if (String(spellId) !== "TwinDrakeBlade") return base;
  const mult = Math.max(1, Number(glyph.params?.damageMultiplier) || 2);
  return Math.trunc(base * mult);
}

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number} cooldown ms, or 0 if glyph inactive
 */
export function glyphTwinDrakeCooldownMs(glyph = null) {
  if (glyph?.kind !== "warriorTwinDrakeBurst") return 0;
  return Math.max(0, Math.trunc(Number(glyph.params?.cooldownMs) || 2000));
}

/**
 * Tooltip / UI helper.
 * @param {GlyphDef | null | undefined} def
 * @returns {string}
 */
export function glyphDescription(def) {
  return def?.description ?? "";
}
