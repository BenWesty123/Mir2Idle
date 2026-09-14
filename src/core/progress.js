import { crystalExperienceForLevel } from "../battleData.js";

/**
 * Apply XP to a { level, experience } progress object. Pure — no DOM, audio, or
 * network side-effects. Matches live leveling math used by offline progress.
 *
 * @param {{ level: number, experience: number }} progress
 * @param {number} xp
 * @param {number} [requirementScale=1] Ascension "Swift Learning" discount on
 *   the XP needed per level; 1 is no discount.
 * @returns {{ progress: { level: number, experience: number }, levels: number[] }}
 */
export function applyExperienceToProgress(progress, xp, requirementScale = 1) {
  const levels = [];
  let level = Math.max(1, Math.trunc(Number(progress?.level) || 1));
  let experience = Math.max(0, Math.trunc(Number(progress?.experience) || 0))
    + Math.max(0, Math.trunc(Number(xp) || 0));

  let nextLevelXp = crystalExperienceForLevel(level, requirementScale);
  while (Number.isFinite(nextLevelXp) && experience >= nextLevelXp) {
    experience -= nextLevelXp;
    level += 1;
    levels.push(level);
    nextLevelXp = crystalExperienceForLevel(level, requirementScale);
  }

  return { progress: { level, experience }, levels };
}

/**
 * Collapse overflow XP in a saved progress snapshot into level-ups (no new XP
 * granted). Used on load when a save stores experience >= next level threshold.
 *
 * Deliberately uses the undiscounted curve: the sanitizers have no account
 * state to read Swift Learning from, and they do not need it. The live loop
 * already levels up the moment experience reaches the discounted requirement,
 * so a save can only ever hold experience below it — leaving this nothing to
 * collapse either way.
 *
 * @param {{ level?: number, experience?: number }} progress
 * @returns {{ level: number, experience: number }}
 */
export function normalizeSavedProgress(progress) {
  return applyExperienceToProgress(progress, 0).progress;
}
