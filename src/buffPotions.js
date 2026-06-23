/** Crystal shape-3 potions: durability minutes × stat bonuses (Impact / Magic / Taoist). */

export const BUFF_POTION_DURATION_MS = 5 * 60 * 1000;

export const BUFF_POTION_DEFS = {
  "impact-drug-s": {
    kind: "impact",
    label: "Impact",
    stat: "dc",
    classes: ["Warrior"],
    minBonus: 0,
    maxBonus: 5,
  },
  "magic-drug-s": {
    kind: "magic",
    label: "Magic",
    stat: "mc",
    classes: ["Wizard"],
    minBonus: 0,
    maxBonus: 3,
  },
  "taoist-drug-s": {
    kind: "taoist",
    label: "Taoist",
    stat: "sc",
    classes: ["Taoist"],
    minBonus: 0,
    maxBonus: 3,
  },
  "impact-drug-m": {
    kind: "impact",
    label: "Impact",
    stat: "dc",
    classes: ["Warrior"],
    minBonus: 0,
    maxBonus: 7,
  },
  "magic-drug-m": {
    kind: "magic",
    label: "Magic",
    stat: "mc",
    classes: ["Wizard"],
    minBonus: 0,
    maxBonus: 5,
  },
  "taoist-drug-m": {
    kind: "taoist",
    label: "Taoist",
    stat: "sc",
    classes: ["Taoist"],
    minBonus: 0,
    maxBonus: 5,
  },
  "impact-drug-l": {
    kind: "impact",
    label: "Impact",
    stat: "dc",
    classes: ["Warrior"],
    minBonus: 0,
    maxBonus: 9,
  },
  "magic-drug-l": {
    kind: "magic",
    label: "Magic",
    stat: "mc",
    classes: ["Wizard"],
    minBonus: 0,
    maxBonus: 7,
  },
  "taoist-drug-l": {
    kind: "taoist",
    label: "Taoist",
    stat: "sc",
    classes: ["Taoist"],
    minBonus: 0,
    maxBonus: 7,
  },
};

export function buffPotionDefForItem(item) {
  if (!item?.id) return null;
  return BUFF_POTION_DEFS[item.id] ?? null;
}

export function isBuffPotionItem(item) {
  return Boolean(buffPotionDefForItem(item));
}

export function sanitizeStatBuffs(saved = [], now = performance.now()) {
  if (!Array.isArray(saved)) return [];
  return saved
    .map((entry) => {
      const kind = String(entry?.kind ?? "");
      const expiresAt = Number(entry?.expiresAt);
      if (!kind || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
      if (entry?.stat === "damageReduction") {
        const reductionPercent = Math.max(0, Math.min(100, Math.trunc(Number(entry?.reductionPercent) || 0)));
        if (reductionPercent <= 0) return null;
        return {
          kind,
          label: String(entry?.label ?? kind),
          stat: "damageReduction",
          minBonus: 0,
          maxBonus: 0,
          reductionPercent,
          expiresAt,
        };
      }
      const stat = entry?.stat === "dc" || entry?.stat === "mc" || entry?.stat === "sc"
        || entry?.stat === "ac" || entry?.stat === "amc"
        ? entry.stat
        : null;
      if (!stat) return null;
      return {
        kind,
        label: String(entry?.label ?? kind),
        stat,
        minBonus: Math.max(0, Math.trunc(Number(entry?.minBonus) || 0)),
        maxBonus: Math.max(0, Math.trunc(Number(entry?.maxBonus) || 0)),
        expiresAt,
      };
    })
    .filter(Boolean);
}

export function pruneStatBuffs(buffList, now = performance.now()) {
  if (!Array.isArray(buffList)) return [];
  return buffList.filter((buff) => Number(buff.expiresAt) > now);
}

export function applyStatBuffsToStats(stats, buffList) {
  if (!stats || !Array.isArray(buffList)) return;
  for (const buff of buffList) {
    const range = stats[buff.stat];
    if (!Array.isArray(range) || range.length < 2) continue;
    range[0] += buff.minBonus;
    range[1] += buff.maxBonus;
  }
}

export function buffRemainingMs(buff, now = performance.now()) {
  return Math.max(0, Math.trunc(Number(buff?.expiresAt) || 0) - now);
}

export function formatBuffRemaining(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function statBuffBonusLabel(buff) {
  if (buff?.stat === "damageReduction") {
    return `${Math.max(0, Math.trunc(Number(buff.reductionPercent) || 0))}% DR`;
  }
  const min = buff.minBonus;
  const max = buff.maxBonus;
  const tag = buff.stat === "amc" ? "MAC" : buff.stat.toUpperCase();
  if (min > 0 && max > 0 && min !== max) return `+${min}-${max} ${tag}`;
  if (max > 0) return `+${max} ${tag}`;
  if (min > 0) return `+${min} ${tag}`;
  return tag;
}
