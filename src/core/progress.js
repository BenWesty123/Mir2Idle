import { crystalExperienceForLevel } from "../battleData.js";

/**
 * Apply XP to a { level, experience } progress object. Pure — no DOM, audio, or
 * network side-effects. Matches live leveling math used by offline progress.
 *
 * @param {{ level: number, experience: number }} progress
 * @param {number} xp
 * @returns {{ progress: { level: number, experience: number }, levels: number[] }}
 */
export function applyExperienceToProgress(progress, xp) {
  const levels = [];
  let level = Math.max(1, Math.trunc(Number(progress?.level) || 1));
  let experience = Math.max(0, Math.trunc(Number(progress?.experience) || 0))
    + Math.max(0, Math.trunc(Number(xp) || 0));

  let nextLevelXp = crystalExperienceForLevel(level);
  while (Number.isFinite(nextLevelXp) && experience >= nextLevelXp) {
    experience -= nextLevelXp;
    level += 1;
    levels.push(level);
    nextLevelXp = crystalExperienceForLevel(level);
  }

  return { progress: { level, experience }, levels };
}

/**
 * Collapse overflow XP in a saved progress snapshot into level-ups (no new XP
 * granted). Used on load when a save stores experience >= next level threshold.
 *
 * @param {{ level?: number, experience?: number }} progress
 * @returns {{ level: number, experience: number }}
 */
export function normalizeSavedProgress(progress) {
  return applyExperienceToProgress(progress, 0).progress;
}
