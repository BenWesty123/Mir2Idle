import { ITEM_INTEGRITY_RULES_VERSION, ITEM_RULES } from "./itemRules.generated.js";

const RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];
const SCALAR_KEYS = [
  "hp", "mp", "accuracy", "agility", "luck", "attackSpeed",
  "poisonAttack", "freezing", "magicResist", "poisonResist",
  "healthRecovery", "poisonRecovery", "strong", "xpBonusPercent",
];
const REFINE_KEYS = new Set(["dc:1", "mc:1", "sc:1"]);

function statEntries(stats = {}) {
  const entries = [];
  for (const key of RANGE_KEYS) {
    const range = Array.isArray(stats[key]) ? stats[key] : [0, 0];
    entries.push({ target: `${key}:0`, value: Math.trunc(Number(range[0]) || 0) });
    entries.push({ target: `${key}:1`, value: Math.trunc(Number(range[1]) || 0) });
  }
  for (const key of SCALAR_KEYS) entries.push({ target: key, value: Math.trunc(Number(stats[key]) || 0) });
  return entries;
}

function violation(code, characterClass, slotId, itemId, detail) {
  return { code, characterClass, slotId, itemId, detail };
}

function valueMatchesRoll(value, roll) {
  const numeric = Number(value);
  const min = Number(roll.min);
  const max = Number(roll.max);
  const step = Number(roll.step ?? 1);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max || step <= 0) return false;
  const units = (numeric - min) / step;
  return Math.abs(units - Math.round(units)) < 0.000001;
}

// Empowerments can be moved between items via the crafting cube (empowerment swap),
// so an item may legally carry a roll that is not in its own table. Build a pool of
// every legal empower roll, keyed by target, so swapped empowerments validate against
// the union of all item tables instead of only the host item's table.
const SWAP_EMPOWER_POOL = buildSwapEmpowerPool();

function empowerRollTarget(roll) {
  if (roll.type === "spell") return `spell:${roll.spellId}:${roll.kind}`;
  return roll.range ? `stat:${roll.key}:${roll.index}` : `stat:${roll.key}`;
}

function buildSwapEmpowerPool() {
  const pool = new Map();
  for (const rule of Object.values(ITEM_RULES)) {
    if (!rule?.empower?.allowed) continue;
    for (const roll of rule.empower.rolls ?? []) {
      const target = empowerRollTarget(roll);
      if (!pool.has(target)) pool.set(target, []);
      pool.get(target).push(roll);
    }
  }
  return pool;
}

// True when `value` is a legal empower roll for `target` on ANY item, i.e. it could
// have been swapped onto this item. Luck is the only swap-restricted roll: it may
// only be moved onto weapons (mirrors canPlaceEmpowerSlotOnItem in the client).
function swapEmpowerRollLegal(target, value, isWeapon) {
  if (target === "stat:luck" && !isWeapon) return false;
  const rolls = SWAP_EMPOWER_POOL.get(target);
  if (!rolls) return false;
  return rolls.some((roll) => valueMatchesRoll(value, roll));
}

function validateSmith(entry, rule, context) {
  const violations = [];
  const level = Math.trunc(Number(entry.smithLevel) || 0);
  const values = statEntries(entry.smithBonusStats);
  const score = values.reduce((sum, row) => sum + Math.abs(row.value), 0);
  if (level < 0 || level > rule.smithCap) {
    violations.push(violation("smith_level", ...context, `Smith +${level} exceeds +${rule.smithCap}.`));
  }
  if (values.some((row) => row.value < 0)) {
    violations.push(violation("smith_negative", ...context, "Smith bonuses cannot be negative."));
  }
  if (score !== level) {
    violations.push(violation("smith_total", ...context, `Smith bonuses total ${score}, expected ${level}.`));
  }
  return violations;
}

function validateGemAndRefine(entry, rule, context) {
  const violations = [];
  const refineLevel = Math.trunc(Number(entry.weaponRefineLevel) || 0);
  const gemCount = Math.trunc(Number(entry.gemCount) || 0);
  const allValues = statEntries(entry.bonusStats);
  const benedictionLuck = allValues.find((row) => row.target === "luck")?.value ?? 0;
  if (rule.benedictionLuck) {
    const minLuck = Math.trunc(Number(rule.benedictionLuck.min) || 0);
    const maxLuck = Math.trunc(Number(rule.benedictionLuck.max) || 0);
    if (benedictionLuck < minLuck || benedictionLuck > maxLuck) {
      violations.push(violation(
        "benediction_luck",
        ...context,
        `Benediction Luck ${benedictionLuck} is outside the legal range ${minLuck} to +${maxLuck}.`,
      ));
    }
  }
  const values = rule.benedictionLuck
    ? allValues.filter((row) => row.target !== "luck")
    : allValues;
  if (refineLevel < 0 || refineLevel > rule.refineCap) {
    violations.push(violation("refine_level", ...context, `Refine +${refineLevel} is invalid for this item.`));
  }
  if (gemCount < 0 || gemCount > rule.gems.maxUses) {
    violations.push(violation("gem_count", ...context, `${gemCount} gem upgrades exceeds the legal cap of ${rule.gems.maxUses}.`));
  }
  if (values.some((row) => row.value < 0)) {
    violations.push(violation("upgrade_negative", ...context, "Gem/refine bonuses cannot be negative."));
  }

  let possibleRefinePoints = Math.max(0, refineLevel * 2);
  let inferredGemUses = 0;
  for (const row of values.filter((candidate) => candidate.value > 0)) {
    let remaining = row.value;
    if (rule.refineCap > 0 && REFINE_KEYS.has(row.target) && possibleRefinePoints > 0) {
      const refineShare = Math.min(remaining, possibleRefinePoints);
      remaining -= refineShare;
      possibleRefinePoints -= refineShare;
    }
    if (remaining <= 0) continue;
    const gemRule = rule.gems.targets[row.target];
    if (!gemRule) {
      violations.push(violation("upgrade_stat", ...context, `${row.target} cannot be added by a legal gem or refinement.`));
      continue;
    }
    if (remaining > gemRule.max) {
      violations.push(violation("gem_stat_cap", ...context, `${row.target} bonus ${remaining} exceeds ${gemRule.max}.`));
    }
    const largestIncrement = Math.max(...gemRule.increments, 1);
    inferredGemUses += Math.ceil(remaining / largestIncrement);
  }
  if (inferredGemUses > gemCount) {
    violations.push(violation("gem_total", ...context, `Bonuses require at least ${inferredGemUses} gem upgrades, but item records ${gemCount}.`));
  }
  const bonusScore = values.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  if (bonusScore < refineLevel) {
    violations.push(violation("refine_total", ...context, `Refine +${refineLevel} has insufficient recorded stat bonuses.`));
  }
  return violations;
}

function validateEmpower(entry, rule, context) {
  const violations = [];
  const isWeapon = Array.isArray(rule.slots) && rule.slots.includes("weapon");
  const tier = Math.trunc(Number(entry.empowerTier) || 0);
  const empowered = Boolean(entry.empowered);
  const statValues = statEntries(entry.empowerBonusStats).filter((row) => row.value !== 0);
  const spellValues = [];
  for (const [spellId, bonuses] of Object.entries(entry.empowerSpellBonuses ?? {})) {
    for (const [kind, value] of Object.entries(bonuses ?? {})) {
      if (Number(value) !== 0) spellValues.push({ spellId, kind, value: Number(value) });
    }
  }
  if (!rule.empower.allowed && (empowered || tier > 0 || statValues.length || spellValues.length)) {
    return [violation("empower_item", ...context, "This item cannot be empowered.")];
  }
  if (tier < 0 || tier > rule.empower.maxTier) {
    violations.push(violation("empower_tier", ...context, `Empower tier ${tier} exceeds ${rule.empower.maxTier}.`));
  }
  if ((tier > 0 || statValues.length || spellValues.length) && !empowered) {
    violations.push(violation("empower_flag", ...context, "Empower bonuses exist without the empowered flag."));
  }
  if (statValues.some((row) => row.value < 0) || spellValues.some((row) => row.value < 0)) {
    violations.push(violation("empower_negative", ...context, "Empower bonuses cannot be negative."));
  }
  for (const row of statValues.filter((candidate) => candidate.value > 0)) {
    const [key, indexText] = row.target.split(":");
    const roll = rule.empower.rolls.find((candidate) => (
      candidate.type === "stat"
      && candidate.key === key
      && (candidate.range ? candidate.index === Number(indexText) : indexText == null)
    ));
    const swapTarget = indexText == null ? `stat:${key}` : `stat:${key}:${indexText}`;
    if ((!roll || !valueMatchesRoll(row.value, roll)) && !swapEmpowerRollLegal(swapTarget, row.value, isWeapon)) {
      violations.push(violation("empower_stat", ...context, `${row.target} empower value ${row.value} is not a legal roll.`));
    }
  }
  for (const row of spellValues.filter((candidate) => candidate.value > 0)) {
    const roll = rule.empower.rolls.find((candidate) => (
      candidate.type === "spell" && candidate.spellId === row.spellId && candidate.kind === row.kind
    ));
    const swapTarget = `spell:${row.spellId}:${row.kind}`;
    if ((!roll || !valueMatchesRoll(row.value, roll)) && !swapEmpowerRollLegal(swapTarget, row.value, isWeapon)) {
      violations.push(violation("empower_spell", ...context, `${row.spellId} ${row.kind} ${row.value} is not a legal roll.`));
    }
  }
  const rollCount = statValues.filter((row) => row.value > 0).length + spellValues.filter((row) => row.value > 0).length;
  if (rollCount > tier) {
    violations.push(violation("empower_total", ...context, `Empower tier ${tier} has ${rollCount} recorded rolls.`));
  }
  return violations;
}

export function validateEquipmentPayload(characters = []) {
  const violations = [];
  for (const character of characters ?? []) {
    const characterClass = String(character?.characterClass ?? "Unknown");
    for (const [slotId, entry] of Object.entries(character?.equipment ?? {})) {
      const itemId = String(entry?.itemId ?? "");
      const rule = ITEM_RULES[itemId];
      const context = [characterClass, slotId, itemId];
      if (!rule) {
        violations.push(violation("unknown_item", ...context, "Item is not present in the current legal-item rules."));
        continue;
      }
      if (!rule.slots.includes(slotId)) {
        violations.push(violation("wrong_slot", ...context, `${rule.name} cannot be equipped in ${slotId}.`));
      }
      violations.push(...validateSmith(entry, rule, context));
      violations.push(...validateGemAndRefine(entry, rule, context));
      violations.push(...validateEmpower(entry, rule, context));
    }
  }
  return {
    valid: violations.length === 0,
    rulesVersion: ITEM_INTEGRITY_RULES_VERSION,
    violations,
  };
}

export function integrityFingerprint(result) {
  return JSON.stringify((result?.violations ?? []).map((row) => [
    row.code, row.characterClass, row.slotId, row.itemId, row.detail,
  ]));
}

export { ITEM_INTEGRITY_RULES_VERSION, ITEM_RULES };
