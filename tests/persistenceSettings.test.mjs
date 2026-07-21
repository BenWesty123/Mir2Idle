import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_POTION_CHARACTER_IDS,
  AUTO_POTION_THRESHOLD_MAX,
  AUTO_POTION_THRESHOLD_MIN,
  DEFAULT_AUTO_POTION_HP_THRESHOLD,
  DEFAULT_AUTO_POTION_MP_THRESHOLD,
  DEFAULT_MUSIC_ENABLED,
  DEFAULT_SFX_ENABLED,
  DEFAULT_SHOW_ACTIVITY_LOG,
  DEFAULT_SHOW_RECENT_LOOT,
  MUSIC_MODE_PLAYLIST,
  MUSIC_MODE_TRACK,
  MUSIC_SETTINGS_VERSION,
  SCENE_WINDOW_EDGE_PAD,
  clampSceneWindowCoords,
  createDefaultAutoPotionThresholdsByCharacter,
  normalizedAutoPotionThreshold,
  normalizedMusicMode,
  normalizedVolume,
  sanitizeAutoPotionThresholdsByCharacter,
  sanitizeSceneWindowPosition,
  sanitizeSceneWindowPositions,
  sanitizeSettingsState,
  sceneWindowPositionFitsBounds,
} from "../src/persistence/sanitizeSettings.js";

test("normalizedVolume clamps to [0, 1]", () => {
  assert.equal(normalizedVolume(0.5), 0.5);
  assert.equal(normalizedVolume(-1), 0);
  assert.equal(normalizedVolume(2), 1);
  assert.equal(normalizedVolume("bad"), 0);
});

test("normalizedAutoPotionThreshold clamps to allowed range", () => {
  assert.equal(normalizedAutoPotionThreshold(0.5), 0.5);
  assert.equal(normalizedAutoPotionThreshold(0), AUTO_POTION_THRESHOLD_MIN);
  assert.equal(normalizedAutoPotionThreshold(2), AUTO_POTION_THRESHOLD_MAX);
  assert.equal(normalizedAutoPotionThreshold("bad"), DEFAULT_AUTO_POTION_HP_THRESHOLD);
  assert.equal(normalizedAutoPotionThreshold(undefined, 0.7), 0.7);
});

test("normalizedMusicMode", () => {
  assert.equal(normalizedMusicMode(MUSIC_MODE_TRACK), MUSIC_MODE_TRACK);
  assert.equal(normalizedMusicMode("other"), MUSIC_MODE_PLAYLIST);
});

test("sanitizeSettingsState: defaults when music settings version is old", () => {
  const result = sanitizeSettingsState({ musicSettingsVersion: 0 });
  assert.equal(result.musicEnabled, DEFAULT_MUSIC_ENABLED);
  assert.equal(result.sfxEnabled, DEFAULT_SFX_ENABLED);
  assert.equal(result.showRecentLoot, DEFAULT_SHOW_RECENT_LOOT);
  assert.equal(result.showActivityLog, DEFAULT_SHOW_ACTIVITY_LOG);
  assert.equal(result.autoPotionHpThreshold, DEFAULT_AUTO_POTION_HP_THRESHOLD);
  assert.equal(result.autoPotionMpThreshold, DEFAULT_AUTO_POTION_MP_THRESHOLD);
  assert.deepEqual(result.autoPotionThresholdsByCharacter, createDefaultAutoPotionThresholdsByCharacter());
});

test("sanitizeSettingsState: honors explicit flags at current version", () => {
  const result = sanitizeSettingsState({
    musicSettingsVersion: MUSIC_SETTINGS_VERSION,
    musicEnabled: false,
    musicVolume: 0.8,
    musicMode: MUSIC_MODE_TRACK,
    sfxEnabled: false,
    sfxVolume: 0.2,
    showRecentLoot: false,
    showActivityLog: false,
    autoPotionHpThreshold: 0.35,
    autoPotionMpThreshold: 0.7,
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
  assert.equal(result.showRecentLoot, false);
  assert.equal(result.showActivityLog, false);
  assert.equal(result.autoPotionHpThreshold, 0.35);
  assert.equal(result.autoPotionMpThreshold, 0.7);
  assert.deepEqual(result.autoPotionThresholdsByCharacter, createDefaultAutoPotionThresholdsByCharacter(0.35, 0.7));
  assert.equal(result.prototypeStatsEnabled, false);
  assert.equal(result.prototypeStatsNoticeVersion, 2);
  assert.equal(result.cloudBackupNoticeVersion, 1);
  assert.equal(result.cloudBackupNoticeLastSeenAt, 123456);
});

test("sanitizeAutoPotionThresholdsByCharacter: seeds from legacy flat thresholds", () => {
  const result = sanitizeAutoPotionThresholdsByCharacter(undefined, 0.25, 0.8);
  for (const classId of AUTO_POTION_CHARACTER_IDS) {
    assert.deepEqual(result[classId], { hp: 0.25, mp: 0.8 });
  }
});

test("sanitizeAutoPotionThresholdsByCharacter: keeps per-class values", () => {
  const result = sanitizeAutoPotionThresholdsByCharacter({
    Warrior: { hp: 0.4, mp: 0.6 },
    Wizard: { hp: 0.2, mp: 0.9 },
    Taoist: { hp: 0.55, mp: 0.35 },
  }, 0.5, 0.5);
  assert.deepEqual(result.Warrior, { hp: 0.4, mp: 0.6 });
  assert.deepEqual(result.Wizard, { hp: 0.2, mp: 0.9 });
  assert.deepEqual(result.Taoist, { hp: 0.55, mp: 0.35 });
  assert.equal(sanitizeSettingsState({
    autoPotionThresholdsByCharacter: result,
    autoPotionHpThreshold: 0.1,
    autoPotionMpThreshold: 0.1,
  }).autoPotionHpThreshold, 0.4);
});

test("sanitizeSceneWindowPosition", () => {
  assert.deepEqual(sanitizeSceneWindowPosition({ x: 120.6, y: 80.2 }), { x: 121, y: 80 });
  assert.equal(sanitizeSceneWindowPosition(null), null);
  assert.equal(sanitizeSceneWindowPosition({ x: "bad", y: 1 }), null);
});

test("sceneWindowPositionFitsBounds keeps windows fully on-screen", () => {
  assert.equal(sceneWindowPositionFitsBounds(8, 8, 200, 100, 800, 600), true);
  assert.equal(sceneWindowPositionFitsBounds(0, 8, 200, 100, 800, 600), false);
  assert.equal(sceneWindowPositionFitsBounds(700, 8, 200, 100, 800, 600), false);
  assert.equal(sceneWindowPositionFitsBounds(1800, 900, 200, 100, 800, 600), false);
  assert.equal(sceneWindowPositionFitsBounds(8, 8, 0, 0, 800, 600), true);
});

test("clampSceneWindowCoords pins to the padded viewport", () => {
  assert.deepEqual(clampSceneWindowCoords(-40, -10, 200, 100, 800, 600), {
    x: SCENE_WINDOW_EDGE_PAD,
    y: SCENE_WINDOW_EDGE_PAD,
  });
  assert.deepEqual(clampSceneWindowCoords(900, 700, 200, 100, 800, 600), {
    x: 800 - 200 - SCENE_WINDOW_EDGE_PAD,
    y: 600 - 100 - SCENE_WINDOW_EDGE_PAD,
  });
});

test("sanitizeSceneWindowPositions", () => {
  assert.deepEqual(sanitizeSceneWindowPositions({
    character: { x: 10, y: 20 },
    inventory: { x: "nope", y: 5 },
    codex: { x: 80, y: 90 },
    upgrades: { x: 64, y: 72 },
    leaderboard: { x: 12, y: 34 },
  }), {
    character: { x: 10, y: 20 },
    inventory: null,
    codex: { x: 80, y: 90 },
    upgrades: { x: 64, y: 72 },
    leaderboard: { x: 12, y: 34 },
  });
  assert.deepEqual(sanitizeSceneWindowPositions(undefined), {
    character: null,
    inventory: null,
    codex: null,
    upgrades: null,
    leaderboard: null,
  });
});

test("sanitizeSettingsState: includes scene window positions", () => {
  const result = sanitizeSettingsState({
    sceneWindowPositions: {
      character: { x: 40, y: 50 },
      inventory: { x: 300, y: 120 },
      codex: { x: 120, y: 80 },
      upgrades: { x: 90, y: 60 },
      leaderboard: { x: 15, y: 25 },
    },
  });
  assert.deepEqual(result.sceneWindowPositions, {
    character: { x: 40, y: 50 },
    inventory: { x: 300, y: 120 },
    codex: { x: 120, y: 80 },
    upgrades: { x: 90, y: 60 },
    leaderboard: { x: 15, y: 25 },
  });
});
