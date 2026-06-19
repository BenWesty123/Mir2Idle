import { ACTION_GROUPS, PLAYER_ACTIONS, sourceFrameFor } from "../../playerActions.js";
import {
  ENEMY_TEMPLATES,
  PLAYER_TEMPLATE,
  attackDelayMs,
  CRYSTAL_PLAYER_ACTION_LOCK_MS,
  crystalAdjustedExperience,
  twinDrakeAttackDelayMs,
  crystalExperienceForLevel,
  crystalPlayerBaseStats,
  CRYSTAL_MAX_LUCK,
  formatStatRange,
  randomInt,
  rollDamage,
  rollStat,
  statRange,
} from "../../battleData.js";
import { SPELL_GROUPS, bodyActionForSpell, spellLabel } from "../../spellBodyActions.js";
import { loadAtlas, loadJson, missingActions, sheetUrl } from "../../atlas.js";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
  WARRIOR_COMBAT_SKILLS,
  magicIconSrc,
  CRYSTAL_SPELL_GLOBAL_LOCK_MS,
  crystalSpellCastCooldownMs,
  spellDelayMs,
  spellExperienceTarget,
  spellLevelRequirement,
  spellMpCost,
  taoistSpellById,
  taoistSpellByShape,
  warriorSpellById,
  warriorSpellByShape,
} from "../../warriorMagic.js";
import { MINING_SPOTS, PHASE1_ZONES } from "../../phase1Data.js";
import {
  GROUP_DUNGEON_SWARM_BLOCKED_RETRY_MS,
  GROUP_DUNGEON_SWARM_CELL_HEIGHT,
  GROUP_DUNGEON_SWARM_LANES,
  GROUP_DUNGEON_SWARM_SPAWN_MS,
  ensureSwarmDirectionalActions,
  fireWallCrossTiles,
  swarmAttackActionForLane,
  swarmEnemyEngagedStanceAction,
  swarmEnemyInAttackRange,
  swarmEnemyReservedTile,
  swarmEnemyTilePosition,
  swarmLaneFromMapRow,
  swarmLaneMapRow,
  swarmMeleeColumnWorldX,
  swarmPickWalkStep,
  swarmSnapTileX,
  swarmTileOccupied,
  GROUP_DUNGEON_WAVES_PER_FLOOR,
  GROUP_DUNGEON_WAVE_SPAWN_CAP,
  GROUP_DUNGEON_WAVE_FIELD_CAP,
  GROUP_DUNGEON_WAVE_REFILL_THRESHOLD,
  GROUP_DUNGEON_WAVE_REFILL_BATCH,
  GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS,
  GROUP_DUNGEON_WAVE_INSTANT_CAP,
  GROUP_DUNGEON_WAVE_BURST_STAGGER_MS,
  groupDungeonWaveSpawnCount,
  createGroupDungeonWaveState,
} from "../../groupDungeonSwarm.js";
import {
  BUFF_POTION_DURATION_MS,
  applyStatBuffsToStats,
  buffPotionDefForItem,
  formatBuffRemaining,
  isBuffPotionItem,
  pruneStatBuffs,
  sanitizeStatBuffs,
  statBuffBonusLabel,
} from "../../buffPotions.js";

import { sceneSignature, musicAudio, musicTrackIndex, musicStatusText, sfxPools, sfxPoolIndexes, sfxLastPlayedAt } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els, IS_GAME_UI } from "../runtime.js";

function playerScreenX() {
  if (!IS_GAME_UI) return LANE.playerScreenX;
  return Math.round(state.stageWidth * 0.5);
}

function ensureMusicAudio() {
  if (musicAudio) return musicAudio;
  musicAudio = new Audio();
  musicAudio.preload = "auto";
  musicAudio.volume = normalizedVolume(state.settings.musicVolume);
  musicAudio.addEventListener("ended", () => handleMusicEnded());
  musicAudio.addEventListener("error", () => {
    musicStatusText = `Could not play ${currentMusicTrack()?.id ?? "music"}.`;
    sceneSignature = "";
    G.renderSceneOverlay();
  });
  return musicAudio;
}

function currentMusicTrack() {
  return BACKGROUND_MUSIC_TRACKS[musicTrackIndex] ?? BACKGROUND_MUSIC_TRACKS[0] ?? null;
}

function normalizedVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizedMusicMode(value) {
  return value === MUSIC_MODE_TRACK ? MUSIC_MODE_TRACK : MUSIC_MODE_PLAYLIST;
}

function syncBackgroundMusic() {
  const audio = ensureMusicAudio();
  audio.volume = normalizedVolume(state.settings.musicVolume);
  if (!state.settings.musicEnabled) {
    audio.pause();
    musicStatusText = "";
    return;
  }
  if (!audio.src) setMusicTrack(musicTrackIndex, false);
  playCurrentMusic();
}

function playCurrentMusic() {
  const audio = ensureMusicAudio();
  const track = currentMusicTrack();
  if (!track) return;
  if (!audio.src || !audio.src.endsWith(track.src.replace("./", ""))) {
    audio.src = track.src;
  }
  audio.volume = normalizedVolume(state.settings.musicVolume);
  const playPromise = audio.play();
  if (playPromise?.catch) {
    playPromise
      .then(() => {
        musicStatusText = "";
        sceneSignature = "";
        G.renderSceneOverlay();
      })
      .catch(() => {
        musicStatusText = "Click Music On or Next once to start audio.";
        sceneSignature = "";
        G.renderSceneOverlay();
      });
  }
}

function setMusicTrack(index, autoplay = true, mode = state.settings.musicMode) {
  const count = BACKGROUND_MUSIC_TRACKS.length;
  if (!count) return;
  musicTrackIndex = ((Math.trunc(Number(index) || 0) % count) + count) % count;
  state.settings.musicMode = normalizedMusicMode(mode);
  const audio = ensureMusicAudio();
  const track = currentMusicTrack();
  audio.src = track.src;
  audio.currentTime = 0;
  sceneSignature = "";
  if (autoplay && state.settings.musicEnabled) playCurrentMusic();
  G.renderSceneOverlay();
}

function handleMusicEnded() {
  if (!state.settings.musicEnabled) return;
  if (normalizedMusicMode(state.settings.musicMode) === MUSIC_MODE_TRACK) {
    setMusicTrack(musicTrackIndex, true, MUSIC_MODE_TRACK);
    return;
  }
  playNextMusicTrack();
}

function playNextMusicTrack() {
  setMusicTrack(musicTrackIndex + 1, state.settings.musicEnabled, MUSIC_MODE_PLAYLIST);
}

function setMusicEnabled(enabled) {
  state.settings.musicEnabled = Boolean(enabled);
  if (state.settings.musicEnabled && !ensureMusicAudio().src) setMusicTrack(musicTrackIndex, false);
  syncBackgroundMusic();
  G.saveGameState(true);
  sceneSignature = "";
  G.renderSceneOverlay();
}

function setMusicVolume(value) {
  state.settings.musicVolume = normalizedVolume(value);
  if (musicAudio) musicAudio.volume = state.settings.musicVolume;
  G.saveGameState(true);
  sceneSignature = "";
  G.renderSceneOverlay();
}

function sfxEntry(key) {
  return state.sfxManifest?.byKey?.[key] ?? null;
}

function ensureSfxPool(key) {
  const entry = sfxEntry(key);
  if (!entry?.src) return null;
  let pool = sfxPools.get(key);
  if (!pool) {
    pool = Array.from({ length: SFX_POOL_SIZE }, () => {
      const audio = new Audio(entry.src);
      audio.preload = "auto";
      return audio;
    });
    sfxPools.set(key, pool);
    sfxPoolIndexes.set(key, 0);
  }
  return pool;
}

function playSfx(key, options = {}) {
  if (!state.settings.sfxEnabled) return false;
  const pool = ensureSfxPool(key);
  if (!pool?.length) return false;

  const now = performance.now();
  const throttleMs = Math.max(0, Number(options.throttleMs) || 0);
  if (!options.force && throttleMs > 0 && now - (sfxLastPlayedAt.get(key) ?? -Infinity) < throttleMs) return false;
  sfxLastPlayedAt.set(key, now);

  const startIndex = sfxPoolIndexes.get(key) ?? 0;
  const audio = pool.find((candidate) => candidate.paused || candidate.ended) ?? pool[startIndex];
  sfxPoolIndexes.set(key, (startIndex + 1) % pool.length);
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers can briefly reject currentTime before metadata is ready.
  }
  audio.volume = normalizedVolume(state.settings.sfxVolume) * normalizedVolume(options.volume ?? 1);
  const playPromise = audio.play();
  if (playPromise?.catch) playPromise.catch(() => {});
  return true;
}

function setSfxEnabled(enabled) {
  state.settings.sfxEnabled = Boolean(enabled);
  G.saveGameState(true);
  sceneSignature = "";
  G.renderSceneOverlay();
}

function setSfxVolume(value) {
  state.settings.sfxVolume = normalizedVolume(value);
  G.saveGameState(true);
  sceneSignature = "";
  G.renderSceneOverlay();
}

function playWeaponRefineResultFx(success, crit = false) {
  G.clearWeaponRefineResultFxTimer();
  state.weaponRefine.resultFx = {
    kind: success ? (crit ? "crit" : "success") : "fail",
    until: performance.now() + WEAPON_REFINE_RESULT_FX_MS,
  };
}

function playWeaponRefineResultSfx(success, crit = false) {
  if (success && crit) {
    playSfx("level.up", { volume: 0.5, throttleMs: 120 });
    return;
  }
  if (success) {
    playSfx("item.equip.weapon", { volume: 0.48, throttleMs: 120 });
    return;
  }
  playSfx("weapon.hit.club", { volume: 0.42, throttleMs: 120 });
}

function playerAttack(now) {
  state.battle.enemyAggro = true;
  if (state.battle.combatClass === "Wizard") {
    G.wizardAttack(now);
    return true;
  }
  if (state.battle.combatClass === "Taoist") {
    G.taoistAttack(now);
    return true;
  }
  return G.warriorAttack(now);
}

function playTwinDrakeBladeSfx(options = {}) {
  return playSpellSfx("TwinDrakeBlade", "cast", options);
}

function playWarriorSpellSwingSfx(skill, options = {}) {
  if (!skill || skill.id === BASIC_ATTACK_SKILL.id) return false;
  if (skill.id === "TwinDrakeBlade") return playTwinDrakeBladeSfx(options);
  return playSpellSfx(skill.id, "attack", options) || playSpellSfx(skill.id, "cast", options);
}

function playerFreezingStat(player = state.battle.player) {
  return Math.max(0, Math.trunc(Number(player?.freezing) || 0));
}

function playTaoPetSfx(kind, options = {}) {
  const pet = options.pet ?? state.battle.taoPet;
  const family = pet?.spellId === "SummonShinsu" ? "shinsu" : "skeleton";
  return playSfx(`pet.${family}.${kind}`, {
    volume: options.volume ?? 0.42,
    throttleMs: options.throttleMs ?? 120,
  });
}

function playTaoPetFlinchSfx(options = {}) {
  const pet = options.pet ?? state.battle.taoPet ?? state.battle.bossParty?.pet;
  const family = pet?.spellId === "SummonShinsu" ? "shinsu" : "skeleton";
  const kind = family === "shinsu" && !pet?.shinsuVisible ? "flinchBuried" : "flinch";
  return playSfx(`pet.${family}.${kind}`, {
    volume: options.volume ?? 0.42,
    throttleMs: options.throttleMs ?? 120,
  });
}

function playTaoPetAppearSfx(options = {}) {
  const pet = options.pet ?? state.battle.taoPet ?? state.battle.bossParty?.pet;
  const kind = pet?.spellId === "SummonShinsu" ? "show" : "summon";
  return playTaoPetSfx(kind, { ...options, pet });
}

function playerAttackRange(now = performance.now()) {
  if (state.battle.combatClass === "Wizard") return G.wizardAttackRange(now);
  if (state.battle.combatClass === "Taoist") return G.taoistAttackRange(now);
  const queuedWarriorSkill = G.queuedCombatSpell("Warrior")?.spell;
  if (queuedWarriorSkill?.id === "Thrusting") return THRUSTING_RANGE;
  return G.thrustingEnabled() ? THRUSTING_RANGE : LANE.warriorRange;
}

function playerEngageRange(now = performance.now()) {
  if (state.battle.combatClass === "Taoist") {
    return Math.max(LANE.aggroRange, playerAttackRange(now), G.taoistSpellEngageRange(now));
  }
  return Math.max(LANE.aggroRange, playerAttackRange(now));
}

function playerCombatLevel() {
  return Math.max(1, Math.trunc(Number(state.battle.level) || state.battle.player?.level || state.game?.progress?.level || 1));
}

function playerWeaponAttackCooldownMs(now = performance.now(), skill = null) {
  const speed = G.effectivePlayerAttackSpeed(now);
  const level = playerCombatLevel();
  if (skill?.id === "TwinDrakeBlade") return twinDrakeAttackDelayMs(speed, level);
  return attackDelayMs(speed, level);
}

function playerAttackDelayMs(now = performance.now()) {
  return playerWeaponAttackCooldownMs(now);
}

function playWeaponSwingSfx(options = {}) {
  playSfx(`weapon.swing.${options.family ?? G.currentWeaponSwingSfxFamily()}`, {
    volume: options.volume ?? 0.52,
    throttleMs: options.throttleMs ?? 90,
    force: options.force,
  });
}

function playWeaponHitSfx(options = {}) {
  playSfx(`weapon.hit.${options.family ?? G.currentWeaponHitSfxFamily()}`, {
    volume: options.volume ?? 0.5,
    throttleMs: options.throttleMs ?? 90,
    force: options.force,
  });
}

function playMiningSwingSfx() {
  // Crystal PlayAttackSound: pickaxe shape 42 falls through to SwingFist (10056, same wav as SwingLong).
  playWeaponSwingSfx({ family: "long", volume: 0.48, throttleMs: 0, force: true });
}

function playMiningHitSfx() {
  playSfx("mining.hit", { volume: 0.55, throttleMs: 0, force: true });
}

function playMonsterSfx(kind, enemy = state.battle.enemy, options = {}) {
  const monsterIndex = G.resolveMonsterSfxIndex(enemy, kind);
  if (monsterIndex == null) return false;
  return playSfx(`monster.${monsterIndex}.${kind}`, {
    volume: options.volume ?? (kind === "attack" ? 0.46 : kind === "death" ? 0.55 : 0.42),
    throttleMs: options.throttleMs ?? (kind === "death" ? 0 : 80),
    force: options.force,
  });
}

function playSpellSfx(spellId, phase = "cast", options = {}) {
  return playSfx(`spell.${spellId}.${phase}`, {
    volume: options.volume ?? 0.58,
    throttleMs: options.throttleMs ?? 80,
    force: options.force,
  });
}

function playSpellStrikeSfx(spellId, options = {}) {
  const params = {
    volume: options.volume ?? 0.5,
    throttleMs: options.throttleMs ?? 0,
    force: options.force !== false,
  };
  if (sfxEntry(`spell.${spellId}.impact`)?.src) {
    if (playSpellSfx(spellId, "impact", params)) return true;
  }
  return playSpellSfx(spellId, "cast", params);
}

function playerResourceBarHtml(kind, label, value, max, pending = 0) {
  const pct = G.resourcePercentage(value, max);
  const pendingText = pending > 0 ? ` +${Math.floor(pending)}` : "";
  return `
    <div class="player-resource-row ${kind}">
      <span class="player-resource-label">${label}</span>
      <span class="player-resource-track">
        <span class="player-resource-fill" style="width:${pct}%"></span>
      </span>
      <span class="player-resource-value">${Math.max(0, Math.floor(value))}/${Math.max(0, Math.floor(max))}${pendingText}</span>
    </div>
  `;
}

function playerFrameBounds() {
  const partyMember = G.bossPartyOnField() ? G.bossPartyControlledMember() : null;
  if (partyMember) return G.bossPartyMemberFrameBounds(partyMember);
  const anchor = G.combatAnchor("player");
  for (const layer of G.layerNames()) {
    const atlas = state.atlases[layer];
    const clip = atlas?.actions?.[state.action];
    const meta = clip?.frames?.[state.frame] ?? clip?.frames?.[0];
    if (!atlas || !clip || !meta || meta.empty) continue;
    const width = meta.w || atlas.slotWidth;
    return {
      centerX: anchor.x + meta.offsetX + width / 2,
      topY: anchor.y + meta.offsetY,
    };
  }
  return { centerX: anchor.x, topY: anchor.y - 80 };
}

function playbackFrameIndex(frameCount) {
  const spec = PLAYER_ACTIONS[state.action];
  if (!spec.reverse) return state.frame;
  return Math.max(0, frameCount - 1 - state.frame);
}


G.playerScreenX = playerScreenX;
G.ensureMusicAudio = ensureMusicAudio;
G.currentMusicTrack = currentMusicTrack;
G.normalizedVolume = normalizedVolume;
G.normalizedMusicMode = normalizedMusicMode;
G.syncBackgroundMusic = syncBackgroundMusic;
G.playCurrentMusic = playCurrentMusic;
G.setMusicTrack = setMusicTrack;
G.handleMusicEnded = handleMusicEnded;
G.playNextMusicTrack = playNextMusicTrack;
G.setMusicEnabled = setMusicEnabled;
G.setMusicVolume = setMusicVolume;
G.sfxEntry = sfxEntry;
G.ensureSfxPool = ensureSfxPool;
G.playSfx = playSfx;
G.setSfxEnabled = setSfxEnabled;
G.setSfxVolume = setSfxVolume;
G.playWeaponRefineResultFx = playWeaponRefineResultFx;
G.playWeaponRefineResultSfx = playWeaponRefineResultSfx;
G.playerAttack = playerAttack;
G.playTwinDrakeBladeSfx = playTwinDrakeBladeSfx;
G.playWarriorSpellSwingSfx = playWarriorSpellSwingSfx;
G.playerFreezingStat = playerFreezingStat;
G.playTaoPetSfx = playTaoPetSfx;
G.playTaoPetFlinchSfx = playTaoPetFlinchSfx;
G.playTaoPetAppearSfx = playTaoPetAppearSfx;
G.playerAttackRange = playerAttackRange;
G.playerEngageRange = playerEngageRange;
G.playerCombatLevel = playerCombatLevel;
G.playerWeaponAttackCooldownMs = playerWeaponAttackCooldownMs;
G.playerAttackDelayMs = playerAttackDelayMs;
G.playWeaponSwingSfx = playWeaponSwingSfx;
G.playWeaponHitSfx = playWeaponHitSfx;
G.playMiningSwingSfx = playMiningSwingSfx;
G.playMiningHitSfx = playMiningHitSfx;
G.playMonsterSfx = playMonsterSfx;
G.playSpellSfx = playSpellSfx;
G.playSpellStrikeSfx = playSpellStrikeSfx;
G.playerResourceBarHtml = playerResourceBarHtml;
G.playerFrameBounds = playerFrameBounds;
G.playbackFrameIndex = playbackFrameIndex;
