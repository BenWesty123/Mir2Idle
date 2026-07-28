/**
 * Glyph spell modifiers — equipped in the `glyph` slot.
 * Fixed-identity rewrites of class spells (not random empowers).
 */

/** @typedef {"taoist" | "wizard" | "warrior" | "any"} GlyphClassId */

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
    id: "taoHealingInstant",
    itemId: "glyph-instant-healing",
    classId: "taoist",
    label: "Glyph of Instant Healing",
    description: "Healing restores health instantly, but only for half the usual amount.",
    spellIds: ["Healing"],
    kind: "taoHealingInstant",
    params: { healFraction: 0.5 },
    implemented: true,
  },
  {
    id: "taoHealingCircleFromSc",
    itemId: "glyph-improved-healing-circle",
    classId: "taoist",
    label: "Glyph of Improved Healing Circle",
    description: "Healing Circle restore amount scales with your Spirit (SC).",
    spellIds: ["HealingCircle"],
    kind: "taoHealingCircleFromSc",
    params: { scDivisor: 4 },
    implemented: true,
  },
  {
    id: "taoUltimateBuffChain",
    itemId: "glyph-buffing",
    classId: "taoist",
    label: "Glyph of Buffing",
    description: "Ultimate Enhancer also applies Soul Shield and Blessed Armour to the same targets.",
    spellIds: ["UltimateEnhancer", "SoulShield", "BlessedArmour"],
    kind: "taoUltimateBuffChain",
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
    id: "wizardManaRegen",
    itemId: "glyph-infinite-mana",
    classId: "wizard",
    label: "Glyph of Infinite Mana",
    description: "You regenerate 5 mana every second.",
    spellIds: [],
    kind: "wizardManaRegen",
    params: { mpPerSecond: 5 },
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
    id: "wizardManyMirrors",
    itemId: "glyph-many-mirrors",
    classId: "wizard",
    label: "Glyph of Many Mirrors",
    description: "Mirroring summons three clones (one above and one below). They can only cast Fire Ball.",
    spellIds: ["Mirroring"],
    kind: "wizardManyMirrors",
    params: { offsetY: 28 },
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
    id: "warriorImprovedFlamingSword",
    itemId: "glyph-improved-flaming-sword",
    classId: "warrior",
    label: "Glyph of Improved Flaming Sword",
    description: "Flaming Sword burns the enemy for 5 seconds, dealing 50% of the hit as fire damage over time.",
    spellIds: ["FlamingSword"],
    kind: "warriorImprovedFlamingSword",
    params: { durationMs: 5000, damageFraction: 0.5, tickMs: 1000 },
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
  {
    id: "warriorProtectionFieldAmc",
    itemId: "glyph-magical-protection",
    classId: "warrior",
    label: "Glyph of Magical Protection",
    description: "Protection Field buffs AMC (MAC) instead of AC.",
    spellIds: ["ProtectionField"],
    kind: "warriorProtectionFieldAmc",
    params: { stat: "amc" },
    implemented: true,
  },
  {
    id: "glassCannon",
    itemId: "glyph-glass-canon",
    classId: "any",
    label: "Glyph of Glass Canon",
    description: "Damage done increased by 50%. Damage taken increased by 100%.",
    spellIds: [],
    kind: "glassCannon",
    params: { outgoingMultiplier: 1.5, incomingMultiplier: 2 },
    implemented: true,
  },
  {
    id: "goldDrops",
    itemId: "glyph-gold",
    classId: "any",
    label: "Glyph of Gold",
    description: "Gold drops from monsters and bosses are increased by 100%.",
    spellIds: [],
    kind: "goldDrops",
    params: { bonusPercent: 100 },
    implemented: true,
  },
  {
    id: "tank",
    itemId: "glyph-tank",
    classId: "any",
    label: "Glyph of Tank",
    description: "Damage taken decreased by 25%. Damage done decreased by 50%.",
    spellIds: [],
    kind: "tank",
    params: { outgoingMultiplier: 0.5, incomingMultiplier: 0.75 },
    implemented: true,
  },
  {
    id: "revival",
    itemId: "glyph-revival",
    classId: "any",
    label: "Glyph of Revival",
    description: "Revives you to full health once, then breaks.",
    spellIds: [],
    kind: "revival",
    implemented: true,
  },
  {
    id: "battleWizard",
    itemId: "glyph-battle-wizard",
    classId: "wizard",
    label: "Glyph of Battle Wizard",
    description: "While in melee range of an enemy: +25% armour and damage. At range: −25% armour and damage.",
    spellIds: [],
    kind: "battleWizard",
    params: {
      meleeOutgoingMultiplier: 1.25,
      meleeDefenceMultiplier: 1.25,
      rangedOutgoingMultiplier: 0.75,
      rangedDefenceMultiplier: 0.75,
    },
    implemented: true,
  },
  {
    id: "monk",
    itemId: "glyph-monk",
    classId: "taoist",
    label: "Glyph of the Monk",
    description: "While no pets are summoned: +50% DC and SC.",
    spellIds: [],
    kind: "monk",
    params: { dcScMultiplier: 1.5 },
    implemented: true,
  },
  {
    id: "hero",
    itemId: "glyph-hero",
    classId: "any",
    label: "Glyph of the Hero",
    description: "You take all damage your party members would receive.",
    spellIds: [],
    kind: "hero",
    implemented: true,
  },
  {
    id: "fastHealing",
    itemId: "glyph-fast-healing",
    classId: "any",
    label: "Glyph of Fast Healing",
    description: "HP potions heal 25% faster, but restore 50% less.",
    spellIds: [],
    kind: "fastHealing",
    params: { healFraction: 0.5, tickDelayFraction: 0.75 },
    implemented: true,
  },
  {
    id: "criticalStrikes",
    itemId: "glyph-critical-strikes",
    classId: "any",
    label: "Glyph of Critical Strikes",
    description: "Base critical strike damage is doubled, but Luck no longer affects you.",
    spellIds: [],
    kind: "criticalStrikes",
    params: {
      // Adds another copy of the global base crit bonus (+50%), doubling it to +100%.
      extraBaseCritDamagePercent: 50,
    },
    implemented: true,
  },
];

const GLYPH_BY_ID = new Map(GLYPH_DEFS.map((def) => [def.id, def]));
const GLYPH_BY_ITEM_ID = new Map(GLYPH_DEFS.map((def) => [def.itemId, def]));

/** Fixed chance an empowered boss kill awards exactly one glyph (before choosing which). */
export const EMPOWERED_BOSS_GLYPH_DROP_CHANCE = 0.1;
/** Ascended bosses: same one-glyph roll at a higher chance. */
export const ASCENDED_BOSS_GLYPH_DROP_CHANCE = 0.15;

/**
 * @returns {string[]}
 */
export function glyphDropItemIds() {
  return GLYPH_DEFS.map((def) => def.itemId).filter(Boolean);
}

/**
 * Empowered/Ascended bosses: chance to drop exactly one glyph, chosen uniformly from all glyphs.
 * Empowered 10%; Ascended 15%.
 * @param {() => number} [rng] returns a value in [0, 1)
 * @param {{ ascended?: boolean }} [options]
 * @returns {string | null}
 */
export function rollEmpoweredBossGlyphItemId(rng = Math.random, options = {}) {
  const chance = options?.ascended
    ? ASCENDED_BOSS_GLYPH_DROP_CHANCE
    : EMPOWERED_BOSS_GLYPH_DROP_CHANCE;
  const chanceRoll = typeof rng === "function" ? Number(rng()) : Math.random();
  if (!(chanceRoll < chance)) return null;
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

/** Equipment keys for glyph slots 1–5 (`glyph`, `glyph2`, …). */
export const GLYPH_EQUIPMENT_SLOT_IDS = ["glyph", "glyph2", "glyph3", "glyph4", "glyph5"];

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyphOrGlyphs
 * @returns {GlyphDef[]}
 */
export function asGlyphList(glyphOrGlyphs) {
  if (glyphOrGlyphs == null) return [];
  return (Array.isArray(glyphOrGlyphs) ? glyphOrGlyphs : [glyphOrGlyphs]).filter(Boolean);
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyphOrGlyphs
 * @param {string} kind
 * @returns {GlyphDef | null}
 */
export function firstGlyphOfKind(glyphOrGlyphs, kind) {
  const want = String(kind || "");
  return asGlyphList(glyphOrGlyphs).find((g) => g.kind === want && g.implemented !== false) ?? null;
}

/**
 * Resolve every equipped glyph definition from an inventory snapshot.
 * @param {object | null | undefined} inventory
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {GlyphDef[]}
 */
export function equippedGlyphDefs(inventory, itemLookup = null) {
  const defs = [];
  const items = Array.isArray(inventory?.items) ? inventory.items : [];
  for (const slotId of GLYPH_EQUIPMENT_SLOT_IDS) {
    const entryId = inventory?.equipment?.[slotId] ?? null;
    if (!entryId) continue;
    const entry = items.find((row) => row?.id === entryId);
    if (!entry?.itemId) continue;
    const fromTable = glyphDefByItemId(entry.itemId);
    if (fromTable) {
      defs.push(fromTable);
      continue;
    }
    if (typeof itemLookup === "function") {
      const item = itemLookup(entry.itemId);
      const modifier = item?.glyph?.modifier;
      const def = glyphDefById(modifier) ?? glyphDefByItemId(item?.id);
      if (def) defs.push(def);
    }
  }
  return defs;
}

/**
 * Resolve the first equipped glyph definition (legacy helper).
 * @param {object | null | undefined} inventory
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {GlyphDef | null}
 */
export function equippedGlyphDef(inventory, itemLookup = null) {
  return equippedGlyphDefs(inventory, itemLookup)[0] ?? null;
}

/**
 * @param {object | null | undefined} inventory
 * @param {string} kind
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {boolean}
 */
export function hasGlyphModifier(inventory, kind, itemLookup = null) {
  return Boolean(firstGlyphOfKind(equippedGlyphDefs(inventory, itemLookup), kind));
}

/**
 * @param {object | null | undefined} inventory
 * @param {string} spellId
 * @param {(itemId: string) => object | null | undefined} [itemLookup]
 * @returns {GlyphDef | null}
 */
export function glyphModifierForSpell(inventory, spellId, itemLookup = null) {
  const id = String(spellId || "");
  return equippedGlyphDefs(inventory, itemLookup).find(
    (def) => def.implemented !== false && Array.isArray(def.spellIds) && def.spellIds.includes(id),
  ) ?? null;
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
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function rollTaoistDefenceBuffBonus(level, maxSc, glyph = null) {
  const match = firstGlyphOfKind(glyph, "taoDefenceBuffFromSc");
  if (match) {
    return rollDefenceBuffBonusFromSc(maxSc, match.params);
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
  const match = firstGlyphOfKind(glyph, "wizardFireWallDuration");
  if (!match) return base;
  if (String(spellId) !== "FireWall") return base;
  const mult = Math.max(1, Number(match.params?.durationMultiplier) || 2);
  return Math.trunc(base * mult);
}

/**
 * Additive gold-drop bonus percent from Glyph of Gold (100 => double gold).
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function glyphGoldBonusPercent(glyph = null) {
  const match = firstGlyphOfKind(glyph, "goldDrops");
  if (!match) return 0;
  return Math.max(0, Math.trunc(Number(match.params?.bonusPercent) || 100));
}

/**
 * @param {number} bonus
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphProtectionFieldBonus(bonus, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(bonus) || 0));
  const match = firstGlyphOfKind(glyph, "warriorProtectionFieldBurst");
  if (!match) return base;
  const mult = Math.max(1, Number(match.params?.bonusMultiplier) || 2);
  return Math.trunc(base * mult);
}

/**
 * @param {number} durationMs
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphProtectionFieldDuration(durationMs, glyph = null) {
  const match = firstGlyphOfKind(glyph, "warriorProtectionFieldBurst");
  if (!match) {
    return Math.max(0, Math.trunc(Number(durationMs) || 0));
  }
  return Math.max(0, Math.trunc(Number(match.params?.durationMs) || 5000));
}

/**
 * Which defence stat Protection Field buffs. Magical Protection switches AC → AMC.
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {"ac" | "amc"}
 */
export function glyphProtectionFieldStat(glyph = null) {
  const match = firstGlyphOfKind(glyph, "warriorProtectionFieldAmc");
  if (!match) return "ac";
  const stat = String(match.params?.stat || "amc").toLowerCase();
  return stat === "amc" ? "amc" : "ac";
}

/**
 * @param {number} ownerMaxDc
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function glyphPetOwnerDcBonus(ownerMaxDc, glyph = null) {
  const match = firstGlyphOfKind(glyph, "taoPetOwnerDc");
  if (!match) return 0;
  const fraction = Math.max(0, Number(match.params?.ownerDcFraction) || 1);
  return Math.floor(Math.max(0, Math.trunc(Number(ownerMaxDc) || 0)) * fraction);
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {boolean}
 */
export function glyphHealingIsInstant(glyph = null) {
  return Boolean(firstGlyphOfKind(glyph, "taoHealingInstant"));
}

/**
 * Glyph of Buffing: Ultimate Enhancer also applies Soul Shield + Blessed Armour.
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {boolean}
 */
export function glyphChainsDefenceBuffsWithUltimate(glyph = null) {
  return Boolean(firstGlyphOfKind(glyph, "taoUltimateBuffChain"));
}

/**
 * Halves Healing amount when Glyph of Instant Healing is active.
 * @param {number} amount
 * @param {string | null | undefined} spellId
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphHealingAmount(amount, spellId, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(amount) || 0));
  const match = firstGlyphOfKind(glyph, "taoHealingInstant");
  if (!match) return base;
  if (String(spellId) !== "Healing") return base;
  const fraction = Math.max(0, Number(match.params?.healFraction) || 0.5);
  return Math.max(0, Math.trunc(base * fraction));
}

/**
 * Glyph of Improved Healing Circle: add floor(maxSc / scDivisor) to each tick.
 * Without the glyph, returns the flat base heal unchanged.
 * @param {number} baseHeal
 * @param {number} maxSc
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function healingCircleTickHealAmount(baseHeal, maxSc, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(baseHeal) || 0));
  const match = firstGlyphOfKind(glyph, "taoHealingCircleFromSc");
  if (!match) return base;
  const divisor = Math.max(1, Number(match.params?.scDivisor) || 4);
  const sc = Math.max(0, Math.trunc(Number(maxSc) || 0));
  return base + Math.floor(sc / divisor);
}

/**
 * Glyph of Fast Healing: HP potions restore a fraction of the usual amount.
 * @param {number} amount
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphHpPotionRestore(amount, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(amount) || 0));
  const match = firstGlyphOfKind(glyph, "fastHealing");
  if (!match) return base;
  const fraction = Math.max(0, Number(match.params?.healFraction) || 0.5);
  return Math.max(0, Math.trunc(base * fraction));
}

/**
 * Glyph of Fast Healing: shorten potion tick delay while HP restore is pending.
 * @param {number} baseDelayMs
 * @param {GlyphDef | null | undefined} glyph
 * @param {{ hpPending?: boolean }} [options]
 * @returns {number}
 */
export function glyphPotionTickDelayMs(baseDelayMs, glyph = null, options = {}) {
  const base = Math.max(1, Math.trunc(Number(baseDelayMs) || 0));
  const match = firstGlyphOfKind(glyph, "fastHealing");
  if (!options.hpPending || !match) return base;
  const fraction = Math.max(0.1, Math.min(1, Number(match.params?.tickDelayFraction) || 0.75));
  return Math.max(1, Math.round(base * fraction));
}

/**
 * Glyph of Critical Strikes: Luck no longer biases damage rolls.
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {boolean}
 */
export function glyphNullifiesLuck(glyph = null) {
  return Boolean(firstGlyphOfKind(glyph, "criticalStrikes"));
}

/**
 * Extra base crit-damage percent points while Glyph of Critical Strikes is equipped.
 * Stacks on top of {@link CRIT_BASE_DAMAGE_PERCENT} so the base +50% becomes +100%.
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function glyphExtraBaseCritDamagePercent(glyph = null) {
  const match = firstGlyphOfKind(glyph, "criticalStrikes");
  if (!match) return 0;
  return Math.max(0, Math.trunc(Number(match.params?.extraBaseCritDamagePercent) || 50));
}

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {{ mpPerHp: number } | null}
 */
export function glyphMagicShieldMpParams(glyph = null) {
  const match = firstGlyphOfKind(glyph, "wizardMagicShieldMp");
  if (!match) return null;
  return {
    mpPerHp: Math.max(1, Math.trunc(Number(match.params?.mpPerHp) || 2)),
  };
}

/**
 * Passive mana regeneration from Glyph of Infinite Mana (MP per second).
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function glyphManaRegenPerSecond(glyph = null) {
  const match = firstGlyphOfKind(glyph, "wizardManaRegen");
  if (!match) return 0;
  return Math.max(0, Number(match.params?.mpPerSecond) || 5);
}

/**
 * Accrue mana from elapsed simulated time at a fixed MP/s rate.
 * Advances `regenAt` by only the milliseconds consumed by whole MP points,
 * so offline fight steps of uneven length still grant the correct total.
 *
 * @param {number} currentMp
 * @param {number} maxMp
 * @param {number} now
 * @param {number} regenAt previous accrual timestamp (0 = start at now)
 * @param {number} mpPerSecond
 * @returns {{ mp: number, regenAt: number, gained: number }}
 */
export function accrueGlyphManaRegen(currentMp, maxMp, now, regenAt, mpPerSecond) {
  const rate = Math.max(0, Number(mpPerSecond) || 0);
  const max = Math.max(0, Math.trunc(Number(maxMp) || 0));
  let mp = Math.max(0, Math.min(max, Math.trunc(Number(currentMp) || 0)));
  const t = Number(now) || 0;
  if (rate <= 0 || max <= 0) {
    return { mp, regenAt: 0, gained: 0 };
  }
  if (mp >= max) {
    return { mp, regenAt: t, gained: 0 };
  }
  let at = Number(regenAt) || 0;
  if (!(at > 0)) {
    return { mp, regenAt: t, gained: 0 };
  }
  const elapsed = Math.max(0, t - at);
  if (elapsed <= 0) {
    return { mp, regenAt: at, gained: 0 };
  }
  const room = max - mp;
  const gained = Math.min(room, Math.floor((elapsed * rate) / 1000));
  if (gained <= 0) {
    return { mp, regenAt: at, gained: 0 };
  }
  // Consume exact ms for whole MP so fractional seconds carry into the next tick.
  const consumedMs = Math.floor((gained * 1000) / rate);
  mp += gained;
  return { mp, regenAt: at + consumedMs, gained };
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
  const match = firstGlyphOfKind(glyph, "wizardFlameDisruptorSplash");
  if (!match) return null;
  return {
    chance: Math.max(0, Math.min(1, Number(match.params?.chance) || 0.5)),
    damageFraction: Math.max(0, Number(match.params?.damageFraction) || 0.5),
  };
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {{ offsetY: number } | null}
 */
export function glyphManyMirrorsParams(glyph = null) {
  const match = firstGlyphOfKind(glyph, "wizardManyMirrors");
  if (!match) return null;
  return {
    offsetY: Math.max(8, Math.trunc(Number(match.params?.offsetY) || 28)),
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
  const match = firstGlyphOfKind(glyph, "warriorFlamingSwordDr");
  if (!match) return null;
  return {
    reductionPercent: Math.max(0, Math.min(100, Math.trunc(Number(match.params?.reductionPercent) || 25))),
    durationMs: Math.max(0, Math.trunc(Number(match.params?.durationMs) || 3000)),
  };
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {{ durationMs: number, damageFraction: number, tickMs: number } | null}
 */
export function glyphImprovedFlamingSwordParams(glyph = null) {
  const match = firstGlyphOfKind(glyph, "warriorImprovedFlamingSword");
  if (!match) return null;
  return {
    durationMs: Math.max(0, Math.trunc(Number(match.params?.durationMs) || 5000)),
    damageFraction: Math.max(0, Number(match.params?.damageFraction) || 0.5),
    tickMs: Math.max(1, Math.trunc(Number(match.params?.tickMs) || 1000)),
  };
}

/**
 * Total burn damage from a Flaming Sword hit (50% of dealt damage by default).
 * @param {number} hitDamage
 * @param {number} damageFraction
 * @returns {number}
 */
export function flamingSwordBurnTotalDamage(hitDamage, damageFraction) {
  return Math.max(0, Math.trunc((Number(hitDamage) || 0) * (Number(damageFraction) || 0)));
}

/**
 * Build a refreshable burn state for an enemy after an Improved Flaming Sword hit.
 * @param {number} hitDamage
 * @param {{ durationMs: number, damageFraction: number, tickMs: number }} params
 * @param {number} now
 * @returns {{ remainingDamage: number, ticksRemaining: number, tickMs: number, nextTickAt: number, appliedAt: number } | null}
 */
export function buildFlamingSwordBurnState(hitDamage, params, now) {
  if (!params || params.durationMs <= 0 || params.damageFraction <= 0) return null;
  const total = flamingSwordBurnTotalDamage(hitDamage, params.damageFraction);
  if (total <= 0) return null;
  const tickMs = Math.max(1, Math.trunc(Number(params.tickMs) || 1000));
  const ticksRemaining = Math.max(1, Math.round(params.durationMs / tickMs));
  return {
    remainingDamage: total,
    ticksRemaining,
    tickMs,
    nextTickAt: now + tickMs,
    appliedAt: now,
  };
}

/**
 * Damage dealt by the next burn tick (last tick takes the remainder).
 * @param {{ remainingDamage?: number, ticksRemaining?: number } | null | undefined} burn
 * @returns {number}
 */
export function flamingSwordBurnTickDamage(burn) {
  const remaining = Math.max(0, Math.trunc(Number(burn?.remainingDamage) || 0));
  const ticks = Math.max(0, Math.trunc(Number(burn?.ticksRemaining) || 0));
  if (remaining <= 0 || ticks <= 0) return 0;
  if (ticks === 1) return remaining;
  return Math.floor(remaining / ticks);
}

/**
 * @param {number} damage
 * @param {string | null | undefined} spellId
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphTwinDrakeDamage(damage, spellId, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(damage) || 0));
  const match = firstGlyphOfKind(glyph, "warriorTwinDrakeBurst");
  if (!match) return base;
  if (String(spellId) !== "TwinDrakeBlade") return base;
  const mult = Math.max(1, Number(match.params?.damageMultiplier) || 2);
  return Math.trunc(base * mult);
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {number} cooldown ms, or 0 if glyph inactive
 */
export function glyphTwinDrakeCooldownMs(glyph = null) {
  const match = firstGlyphOfKind(glyph, "warriorTwinDrakeBurst");
  if (!match) return 0;
  return Math.max(0, Math.trunc(Number(match.params?.cooldownMs) || 2000));
}

const COMBAT_DAMAGE_GLYPH_DEFAULTS = {
  glassCannon: { outgoingMultiplier: 1.5, incomingMultiplier: 2 },
  tank: { outgoingMultiplier: 0.5, incomingMultiplier: 0.75 },
};

/**
 * Shared outgoing/incoming damage multipliers for Glass Canon / Tank glyphs.
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {{ outgoingMultiplier: number, incomingMultiplier: number } | null}
 */
export function glyphCombatDamageParams(glyph = null) {
  const match = asGlyphList(glyph).find((g) => g.implemented !== false && COMBAT_DAMAGE_GLYPH_DEFAULTS[g.kind]);
  if (!match) return null;
  const defaults = COMBAT_DAMAGE_GLYPH_DEFAULTS[match.kind];
  return {
    outgoingMultiplier: Math.max(0, Number(match.params?.outgoingMultiplier) || defaults.outgoingMultiplier),
    incomingMultiplier: Math.max(0, Number(match.params?.incomingMultiplier) || defaults.incomingMultiplier),
  };
}

/** @deprecated Prefer glyphCombatDamageParams — kept for older call sites/tests. */
export function glyphGlassCannonParams(glyph = null) {
  return glyphCombatDamageParams(glyph);
}

/**
 * @param {number} damage
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphCombatDamageOutgoing(damage, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(damage) || 0));
  const params = glyphCombatDamageParams(glyph);
  if (!params) return base;
  return Math.max(0, Math.trunc(base * params.outgoingMultiplier));
}

/**
 * @param {number} damage
 * @param {GlyphDef | null | undefined} glyph
 * @returns {number}
 */
export function applyGlyphCombatDamageIncoming(damage, glyph = null) {
  const base = Math.max(0, Math.trunc(Number(damage) || 0));
  const params = glyphCombatDamageParams(glyph);
  if (!params) return base;
  return Math.max(0, Math.trunc(base * params.incomingMultiplier));
}

/** @deprecated Prefer applyGlyphCombatDamageOutgoing */
export function applyGlyphGlassCannonOutgoing(damage, glyph = null) {
  return applyGlyphCombatDamageOutgoing(damage, glyph);
}

/** @deprecated Prefer applyGlyphCombatDamageIncoming */
export function applyGlyphGlassCannonIncoming(damage, glyph = null) {
  return applyGlyphCombatDamageIncoming(damage, glyph);
}

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {boolean}
 */
export function glyphIsRevival(glyph = null) {
  return Boolean(firstGlyphOfKind(glyph, "revival"));
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {boolean}
 */
export function glyphIsHero(glyph = null) {
  return Boolean(firstGlyphOfKind(glyph, "hero"));
}

/**
 * @param {GlyphDef | GlyphDef[] | null | undefined} glyph
 * @returns {{
 *   meleeOutgoingMultiplier: number,
 *   meleeDefenceMultiplier: number,
 *   rangedOutgoingMultiplier: number,
 *   rangedDefenceMultiplier: number,
 * } | null}
 */
export function glyphBattleWizardParams(glyph = null) {
  const match = firstGlyphOfKind(glyph, "battleWizard");
  if (!match) return null;
  return {
    meleeOutgoingMultiplier: Math.max(0, Number(match.params?.meleeOutgoingMultiplier) || 1.25),
    meleeDefenceMultiplier: Math.max(0, Number(match.params?.meleeDefenceMultiplier) || 1.25),
    rangedOutgoingMultiplier: Math.max(0, Number(match.params?.rangedOutgoingMultiplier) || 0.75),
    rangedDefenceMultiplier: Math.max(0, Number(match.params?.rangedDefenceMultiplier) || 0.75),
  };
}

/**
 * @param {number} distancePx
 * @param {number} meleeRangePx
 * @returns {boolean}
 */
export function isWithinMeleeRange(distancePx, meleeRangePx) {
  const distance = Math.max(0, Number(distancePx) || 0);
  const reach = Math.max(0, Number(meleeRangePx) || 0);
  return distance <= reach;
}

/**
 * @param {number} damage
 * @param {GlyphDef | null | undefined} glyph
 * @param {boolean | null | undefined} inMelee null/undefined = stance inactive (no change)
 * @returns {number}
 */
export function applyGlyphBattleWizardOutgoing(damage, glyph = null, inMelee = null) {
  const base = Math.max(0, Math.trunc(Number(damage) || 0));
  if (inMelee == null) return base;
  const params = glyphBattleWizardParams(glyph);
  if (!params) return base;
  const mult = inMelee ? params.meleeOutgoingMultiplier : params.rangedOutgoingMultiplier;
  return Math.max(0, Math.trunc(base * mult));
}

/**
 * Scale AC/AMC armour ranges for Battle Wizard melee/range stance.
 * @param {{ ac?: number[], amc?: number[] }} defence
 * @param {GlyphDef | null | undefined} glyph
 * @param {boolean | null | undefined} inMelee null/undefined = stance inactive (no change)
 * @returns {{ ac: number[], amc: number[] }}
 */
export function applyGlyphBattleWizardDefence(defence, glyph = null, inMelee = null) {
  const ac = Array.isArray(defence?.ac) ? [...defence.ac] : [0, 0];
  const amc = Array.isArray(defence?.amc) ? [...defence.amc] : [...ac];
  if (inMelee == null) return { ac, amc };
  const params = glyphBattleWizardParams(glyph);
  if (!params) return { ac, amc };
  const mult = inMelee ? params.meleeDefenceMultiplier : params.rangedDefenceMultiplier;
  const scale = (range) => [
    Math.max(0, Math.trunc((Number(range[0]) || 0) * mult)),
    Math.max(0, Math.trunc((Number(range[1]) || 0) * mult)),
  ];
  return { ac: scale(ac), amc: scale(amc) };
}

/**
 * @param {GlyphDef | null | undefined} glyph
 * @returns {{ dcScMultiplier: number } | null}
 */
export function glyphMonkParams(glyph = null) {
  const match = firstGlyphOfKind(glyph, "monk");
  if (!match) return null;
  return {
    dcScMultiplier: Math.max(0, Number(match.params?.dcScMultiplier) || 1.5),
  };
}

/**
 * +50% DC/SC while no pets are out (Glyph of the Monk).
 * @param {{ dc?: number[], sc?: number[] }} stats
 * @param {GlyphDef | null | undefined} glyph
 * @param {boolean} petsSummoned
 * @returns {{ dc: number[], sc: number[] }}
 */
export function applyGlyphMonkCombatStats(stats, glyph = null, petsSummoned = false) {
  const dc = Array.isArray(stats?.dc) ? [...stats.dc] : [0, 0];
  const sc = Array.isArray(stats?.sc) ? [...stats.sc] : [0, 0];
  const params = glyphMonkParams(glyph);
  if (!params || petsSummoned) return { dc, sc };
  const mult = params.dcScMultiplier;
  const scale = (range) => [
    Math.max(0, Math.trunc((Number(range[0]) || 0) * mult)),
    Math.max(0, Math.trunc((Number(range[1]) || 0) * mult)),
  ];
  return { dc: scale(dc), sc: scale(sc) };
}

/**
 * Tooltip / UI helper.
 * @param {GlyphDef | null | undefined} def
 * @returns {string}
 */
export function glyphDescription(def) {
  return def?.description ?? "";
}
