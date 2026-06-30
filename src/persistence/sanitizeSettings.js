export const MUSIC_SETTINGS_VERSION = 2;
export const DEFAULT_MUSIC_VOLUME = 0.35;
export const DEFAULT_MUSIC_ENABLED = true;
export const DEFAULT_SFX_ENABLED = true;
export const DEFAULT_SFX_VOLUME = 0.55;
export const DEFAULT_PROTOTYPE_STATS_ENABLED = true;
export const MUSIC_MODE_PLAYLIST = "playlist";
export const MUSIC_MODE_TRACK = "track";

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizedVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizedMusicMode(value) {
  return value === MUSIC_MODE_TRACK ? MUSIC_MODE_TRACK : MUSIC_MODE_PLAYLIST;
}

/**
 * @param {object | null | undefined} savedSettings
 */
export function sanitizeSettingsState(savedSettings = {}) {
  const hasCurrentMusicSettings = Number(savedSettings.musicSettingsVersion) >= MUSIC_SETTINGS_VERSION;
  return {
    musicEnabled: hasCurrentMusicSettings && Object.prototype.hasOwnProperty.call(savedSettings, "musicEnabled")
      ? savedSettings.musicEnabled === true
      : DEFAULT_MUSIC_ENABLED,
    musicVolume: normalizedVolume(savedSettings.musicVolume ?? DEFAULT_MUSIC_VOLUME),
    musicMode: normalizedMusicMode(savedSettings.musicMode),
    sfxEnabled: Object.prototype.hasOwnProperty.call(savedSettings, "sfxEnabled")
      ? savedSettings.sfxEnabled === true
      : DEFAULT_SFX_ENABLED,
    sfxVolume: normalizedVolume(savedSettings.sfxVolume ?? DEFAULT_SFX_VOLUME),
    prototypeStatsEnabled: Object.prototype.hasOwnProperty.call(savedSettings, "prototypeStatsEnabled")
      ? savedSettings.prototypeStatsEnabled === true
      : DEFAULT_PROTOTYPE_STATS_ENABLED,
    prototypeStatsNoticeVersion: Math.max(0, Math.trunc(Number(savedSettings.prototypeStatsNoticeVersion) || 0)),
    prototypeResetNoticeVersion: Math.max(0, Math.trunc(Number(savedSettings.prototypeResetNoticeVersion) || 0)),
    prototypeResetNoticeLastSeenAt: Math.max(0, Math.trunc(Number(savedSettings.prototypeResetNoticeLastSeenAt) || 0)),
    cloudBackupNoticeVersion: Math.max(0, Math.trunc(Number(savedSettings.cloudBackupNoticeVersion) || 0)),
    cloudBackupNoticeLastSeenAt: Math.max(0, Math.trunc(Number(savedSettings.cloudBackupNoticeLastSeenAt) || 0)),
  };
}
