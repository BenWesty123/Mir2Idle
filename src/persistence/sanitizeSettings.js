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

/** Padding from the viewport edge for draggable scene windows. */
export const SCENE_WINDOW_EDGE_PAD = 8;

/**
 * @param {unknown} value
 * @returns {{ x: number, y: number } | null}
 */
export function sanitizeSceneWindowPosition(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * True when the window's top-left keeps the full window inside the viewport (with pad).
 * Unknown sizes are treated as fitting so callers can measure later.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {number} [pad]
 */
export function sceneWindowPositionFitsBounds(
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  pad = SCENE_WINDOW_EDGE_PAD,
) {
  const px = Math.round(Number(x));
  const py = Math.round(Number(y));
  if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  const vw = Math.max(0, Math.round(Number(viewportWidth) || 0));
  const vh = Math.max(0, Math.round(Number(viewportHeight) || 0));
  if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0) return true;
  const maxX = Math.max(pad, vw - w - pad);
  const maxY = Math.max(pad, vh - h - pad);
  return px >= pad && py >= pad && px <= maxX && py <= maxY;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {number} [pad]
 * @returns {{ x: number, y: number }}
 */
export function clampSceneWindowCoords(
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  pad = SCENE_WINDOW_EDGE_PAD,
) {
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  const vw = Math.max(0, Math.round(Number(viewportWidth) || 0));
  const vh = Math.max(0, Math.round(Number(viewportHeight) || 0));
  const maxX = Math.max(pad, vw - w - pad);
  const maxY = Math.max(pad, vh - h - pad);
  return {
    x: Math.max(pad, Math.min(Math.round(Number(x) || 0), maxX)),
    y: Math.max(pad, Math.min(Math.round(Number(y) || 0), maxY)),
  };
}

/**
 * @param {unknown} saved
 */
export function sanitizeSceneWindowPositions(saved) {
  const positions = saved && typeof saved === "object" ? saved : {};
  return {
    character: sanitizeSceneWindowPosition(positions.character),
    inventory: sanitizeSceneWindowPosition(positions.inventory),
  };
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
    demoLiveSiteBannerLastSeenAt: Math.max(0, Math.trunc(Number(savedSettings.demoLiveSiteBannerLastSeenAt) || 0)),
    unfairSkillPurgeVersion: Math.max(0, Math.trunc(Number(savedSettings.unfairSkillPurgeVersion) || 0)),
    sceneWindowPositions: sanitizeSceneWindowPositions(savedSettings.sceneWindowPositions),
  };
}
