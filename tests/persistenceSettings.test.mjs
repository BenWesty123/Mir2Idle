import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MUSIC_ENABLED,
  DEFAULT_SFX_ENABLED,
  MUSIC_MODE_PLAYLIST,
  MUSIC_MODE_TRACK,
  MUSIC_SETTINGS_VERSION,
  normalizedMusicMode,
  normalizedVolume,
  sanitizeSceneWindowPosition,
  sanitizeSceneWindowPositions,
  sanitizeSettingsState,
} from "../src/persistence/sanitizeSettings.js";

test("normalizedVolume clamps to [0, 1]", () => {
  assert.equal(normalizedVolume(0.5), 0.5);
  assert.equal(normalizedVolume(-1), 0);
  assert.equal(normalizedVolume(2), 1);
  assert.equal(normalizedVolume("bad"), 0);
});

test("normalizedMusicMode", () => {
  assert.equal(normalizedMusicMode(MUSIC_MODE_TRACK), MUSIC_MODE_TRACK);
  assert.equal(normalizedMusicMode("other"), MUSIC_MODE_PLAYLIST);
});

test("sanitizeSettingsState: defaults when music settings version is old", () => {
  const result = sanitizeSettingsState({ musicSettingsVersion: 0 });
  assert.equal(result.musicEnabled, DEFAULT_MUSIC_ENABLED);
  assert.equal(result.sfxEnabled, DEFAULT_SFX_ENABLED);
});

test("sanitizeSettingsState: honors explicit flags at current version", () => {
  const result = sanitizeSettingsState({
    musicSettingsVersion: MUSIC_SETTINGS_VERSION,
    musicEnabled: false,
    musicVolume: 0.8,
    musicMode: MUSIC_MODE_TRACK,
    sfxEnabled: false,
    sfxVolume: 0.2,
    prototypeStatsEnabled: false,
    prototypeStatsNoticeVersion: 2,
    cloudBackupNoticeVersion: 1,
    cloudBackupNoticeLastSeenAt: 123456,
  });
  assert.equal(result.musicEnabled, false);
  assert.equal(result.musicVolume, 0.8);
  assert.equal(result.musicMode, MUSIC_MODE_TRACK);
  assert.equal(result.sfxEnabled, false);
  assert.equal(result.sfxVolume, 0.2);
  assert.equal(result.prototypeStatsEnabled, false);
  assert.equal(result.prototypeStatsNoticeVersion, 2);
  assert.equal(result.cloudBackupNoticeVersion, 1);
  assert.equal(result.cloudBackupNoticeLastSeenAt, 123456);
});

test("sanitizeSceneWindowPosition", () => {
  assert.deepEqual(sanitizeSceneWindowPosition({ x: 120.6, y: 80.2 }), { x: 121, y: 80 });
  assert.equal(sanitizeSceneWindowPosition(null), null);
  assert.equal(sanitizeSceneWindowPosition({ x: "bad", y: 1 }), null);
});

test("sanitizeSceneWindowPositions", () => {
  assert.deepEqual(sanitizeSceneWindowPositions({
    character: { x: 10, y: 20 },
    inventory: { x: "nope", y: 5 },
  }), {
    character: { x: 10, y: 20 },
    inventory: null,
  });
  assert.deepEqual(sanitizeSceneWindowPositions(undefined), {
    character: null,
    inventory: null,
  });
});

test("sanitizeSettingsState: includes scene window positions", () => {
  const result = sanitizeSettingsState({
    sceneWindowPositions: {
      character: { x: 40, y: 50 },
      inventory: { x: 300, y: 120 },
    },
  });
  assert.deepEqual(result.sceneWindowPositions, {
    character: { x: 40, y: 50 },
    inventory: { x: 300, y: 120 },
  });
});
