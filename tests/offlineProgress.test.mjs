import test from "node:test";
import assert from "node:assert/strict";
import { crystalExperienceForLevel } from "../src/battleData.js";
import { applyExperienceToProgress, normalizeSavedProgress } from "../src/core/progress.js";
import {
  buildOfflineProgressTiming,
  computeOfflineElapsedMs,
  advanceOfflineFightTick,
  computeOfflineFightTickDelta,
  computeOfflineFightTravelMs,
  computeOfflineGroupIncomingDps,
  computeOfflineGroupMemberDps,
  computeOfflineGroupPartyDps,
  computeOfflineIncomingChunkDamage,
  computeOfflinePetAttackDelayMs,
  computeOfflineLivingPetsAttackDelayMs,
  computeOfflineRespawnDelay,
  computeOfflineTravelTimeMs,
  createOfflineFightEnemy,
  canResumeOfflineZoneEnemy,
  createOfflineZoneReport,
  DEFAULT_OFFLINE_PROGRESS_CAP_MS,
  DEFAULT_OFFLINE_PROGRESS_MIN_MS,
  estimateOfflineGroupKillDurationMs,
  finalizeOfflineZoneReport,
  offlineGroupAverageDamage,
  offlineGroupHitChance,
  processOfflineZoneFightCycle,
  resolveOfflineGroupIncomingChunk,
  resolvePendingOfflineProgress,
  rebaseTransientTimestamp,
  recordOfflineKillRewards,
  reportCountText,
  simulateOfflineFightLoop,
  simulateOfflineGroupKillLoop,
  simulateOfflineZoneProgressLoop,
  rollMiningOreItemId,
  rollMiningOrePurity,
  buildMiningOreDropsWithRareBonus,
  simulateOfflineMiningSwings,
  nextOfflineTaoistSupportSpellId,
  OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER,
  OFFLINE_TAOIST_SUPPORT_SPELL_ORDER,
  offlineTaoistQueuedSpellKind,
  nextOfflineTaoistAutoSummonId,
  offlineTaoistSummonPetDelayMs,
  OFFLINE_TAOIST_AUTO_SUMMON_ORDER,
  resolveOfflineWizardTurnPhase,
  OFFLINE_WIZARD_DEFENCE_SPELL_ID,
} from "../src/core/offlineProgress.js";

test("applyExperienceToProgress: adds xp without leveling", () => {
  const { progress, levels } = applyExperienceToProgress({ level: 3, experience: 10 }, 15);
  assert.deepEqual(progress, { level: 3, experience: 25 });
  assert.deepEqual(levels, []);
});

test("applyExperienceToProgress: single level-up", () => {
  const need = crystalExperienceForLevel(3);
  const { progress, levels } = applyExperienceToProgress({ level: 3, experience: need - 5 }, 10);
  assert.equal(progress.level, 4);
  assert.equal(progress.experience, 5);
  assert.deepEqual(levels, [4]);
});

test("applyExperienceToProgress: multi level-up in one grant", () => {
  const need3 = crystalExperienceForLevel(3);
  const need4 = crystalExperienceForLevel(4);
  const grant = need3 - 1 + need4 + 7;
  const { progress, levels } = applyExperienceToProgress({ level: 3, experience: 1 }, grant);
  assert.equal(progress.level, 5);
  assert.equal(progress.experience, 7);
  assert.deepEqual(levels, [4, 5]);
});

test("applyExperienceToProgress: clamps bad input", () => {
  const { progress, levels } = applyExperienceToProgress({ level: 0, experience: -5 }, -10);
  assert.deepEqual(progress, { level: 1, experience: 0 });
  assert.deepEqual(levels, []);
});

test("applyExperienceToProgress: deterministic for fixed inputs", () => {
  const start = { level: 7, experience: 120 };
  const xp = 450;
  const a = applyExperienceToProgress(start, xp);
  const b = applyExperienceToProgress(start, xp);
  assert.deepEqual(a, b);
});

test("normalizeSavedProgress: collapses overflow XP without granting new XP", () => {
  const need3 = crystalExperienceForLevel(3);
  const need4 = crystalExperienceForLevel(4);
  const overflow = need3 + need4 + 12;
  assert.deepEqual(normalizeSavedProgress({ level: 3, experience: overflow }), {
    level: 5,
    experience: 12,
  });
  assert.deepEqual(normalizeSavedProgress({ level: 3, experience: 10 }), {
    level: 3,
    experience: 10,
  });
});

test("computeOfflineElapsedMs", () => {
  assert.equal(computeOfflineElapsedMs(0, 1000), null);
  assert.equal(computeOfflineElapsedMs(1000, 4500), 3500);
});

test("buildOfflineProgressTiming: below minimum returns null", () => {
  assert.equal(
    buildOfflineProgressTiming(1000, 1000 + DEFAULT_OFFLINE_PROGRESS_MIN_MS - 1),
    null,
  );
});

test("buildOfflineProgressTiming: caps elapsed window", () => {
  const savedAt = 1_000_000;
  const nowMs = savedAt + DEFAULT_OFFLINE_PROGRESS_CAP_MS + 60_000;
  const timing = buildOfflineProgressTiming(savedAt, nowMs);
  assert.equal(timing.elapsedMs, DEFAULT_OFFLINE_PROGRESS_CAP_MS);
  assert.equal(timing.rawElapsedMs, DEFAULT_OFFLINE_PROGRESS_CAP_MS + 60_000);
  assert.equal(timing.capped, true);
});

test("resolvePendingOfflineProgress: zone combat when running", () => {
  const savedAt = 1_710_000_000_000;
  const nowMs = savedAt + 120_000;
  const pending = resolvePendingOfflineProgress(
    {
      savedAt,
      game: { mode: "zone", activeZoneId: "zone-bicheon-1" },
      battle: { running: true, paused: false, playerHp: 50 },
    },
    nowMs,
    { zoneIds: ["zone-bicheon-1"], miningZoneId: "zone-bichon-mine" },
  );
  assert.equal(pending.kind, "zone");
  assert.equal(pending.elapsedMs, 120_000);
});

test("resolvePendingOfflineProgress: rejects dead player", () => {
  const savedAt = 1_710_000_000_000;
  const pending = resolvePendingOfflineProgress(
    {
      savedAt,
      game: { mode: "zone", activeZoneId: "zone-bicheon-1" },
      battle: { running: true, playerHp: 0 },
    },
    savedAt + 120_000,
    { zoneIds: ["zone-bicheon-1"] },
  );
  assert.equal(pending, null);
});

test("resolvePendingOfflineProgress: mining mode", () => {
  const savedAt = 1_710_000_000_000;
  const pending = resolvePendingOfflineProgress(
    {
      savedAt,
      game: { mode: "mining", activeZoneId: "zone-bichon-mine" },
      battle: { paused: false },
    },
    savedAt + 60_000,
    { zoneIds: ["zone-bichon-mine"], miningZoneId: "zone-bichon-mine" },
  );
  assert.equal(pending.kind, "mining");
});

test("resolvePendingOfflineProgress: paused zone returns null", () => {
  const savedAt = 1_710_000_000_000;
  const pending = resolvePendingOfflineProgress(
    {
      savedAt,
      game: { mode: "zone", activeZoneId: "zone-bicheon-1" },
      battle: { running: true, paused: true },
    },
    savedAt + 60_000,
    { zoneIds: ["zone-bicheon-1"] },
  );
  assert.equal(pending, null);
});

test("rebaseTransientTimestamp", () => {
  assert.equal(rebaseTransientTimestamp(5000, 4000, 9000), 10000);
  assert.equal(rebaseTransientTimestamp(3000, 4000, 9000), 0);
  assert.equal(rebaseTransientTimestamp(7000, 4000, 9000, 2000), 11000);
});

test("reportCountText", () => {
  const map = new Map([
    ["Gold Ore P3", 2],
    ["Silver Ore P1", 1],
  ]);
  assert.equal(reportCountText(map, 2), "Gold Ore P3 x2, Silver Ore P1");
});

test("rollMiningOreItemId / rollMiningOrePurity with injected rng", () => {
  const drops = [
    { itemId: "gold-ore", minSlot: 1, maxSlot: 50 },
    { itemId: "silver-ore", minSlot: 51, maxSlot: 100 },
  ];
  assert.equal(rollMiningOreItemId(drops, 100, () => 0.49), "gold-ore");
  assert.equal(rollMiningOreItemId(drops, 100, () => 0.99), "silver-ore");
  assert.equal(rollMiningOrePurity(() => 0), 1);
  assert.equal(rollMiningOrePurity(() => 0, 10, 5), 5);
  assert.equal(rollMiningOrePurity(() => 0.999, 10, 5), 10);
});

test("buildMiningOreDropsWithRareBonus expands rares from copper then gold", () => {
  const base = [
    { itemId: "gold-ore", minSlot: 1, maxSlot: 28 },
    { itemId: "silver-ore", minSlot: 29, maxSlot: 57 },
    { itemId: "black-iron-ore", minSlot: 58, maxSlot: 86 },
    { itemId: "adamantine-ore", minSlot: 87, maxSlot: 89 },
    { itemId: "ruby-ore", minSlot: 90, maxSlot: 91 },
    { itemId: "emerald-ore", minSlot: 92, maxSlot: 93 },
    { itemId: "amethyst-ore", minSlot: 94, maxSlot: 95 },
    { itemId: "copper-ore", minSlot: 96, maxSlot: 120 },
  ];
  const rares = ["adamantine-ore", "ruby-ore", "emerald-ore", "amethyst-ore"];
  const unchanged = buildMiningOreDropsWithRareBonus(base, rares, 0);
  assert.deepEqual(unchanged, base);

  const maxed = buildMiningOreDropsWithRareBonus(base, rares, 5);
  const weight = (drops, id) => {
    const drop = drops.find((entry) => entry.itemId === id);
    return drop ? drop.maxSlot - drop.minSlot + 1 : 0;
  };
  assert.equal(weight(maxed, "adamantine-ore"), 8);
  assert.equal(weight(maxed, "ruby-ore"), 7);
  assert.equal(weight(maxed, "emerald-ore"), 7);
  assert.equal(weight(maxed, "amethyst-ore"), 7);
  assert.equal(weight(maxed, "copper-ore"), 5);
  assert.equal(weight(maxed, "gold-ore"), 28);
  assert.equal(maxed.at(-1).maxSlot, 120);
});

test("simulateOfflineMiningSwings: deterministic hits and inventory full", () => {
  let rngStep = 0;
  const rng = () => [0.05, 0.05, 0.99][rngStep++ % 3];
  let addCount = 0;
  const report = simulateOfflineMiningSwings(3000, {
    swingCycleMs: 1000,
    hitChance: 0.1,
    rng,
    rollOre: () => ({ itemId: "copper-ore", purity: 3 }),
    formatOreLabel: (ore) => `${ore.itemId} P${ore.purity}`,
    tryAddOre: () => {
      addCount += 1;
      return addCount === 1;
    },
  });
  assert.equal(report.swings, 3);
  assert.equal(report.hits, 2);
  assert.equal(report.drops.get("copper-ore P3"), 1);
  assert.equal(report.ignoredDrops.get("copper-ore P3"), 1);
});

test("computeOfflineTravelTimeMs: walk then run", () => {
  assert.equal(
    computeOfflineTravelTimeMs(100, { walkCap: 40, playerSpeed: 10, runSpeed: 20 }),
    7000,
  );
  assert.equal(
    computeOfflineTravelTimeMs(30, { walkCap: 40, playerSpeed: 10, runSpeed: 20 }),
    3000,
  );
});

test("recordOfflineKillRewards", () => {
  const report = {
    kills: 1,
    xp: 10,
    gold: 5,
    levels: [4],
    drops: new Map([["Herb", 1]]),
    ignoredDrops: new Map(),
  };
  recordOfflineKillRewards(report, {
    xp: 20,
    gold: 3,
    levels: [5, 6],
    addedDropLabels: ["Gold Ore P1", "Gold Ore P1"],
    ignoredDropLabels: ["Silver Ore P2"],
  });
  assert.equal(report.kills, 2);
  assert.equal(report.xp, 30);
  assert.equal(report.gold, 8);
  assert.deepEqual(report.levels, [4, 5, 6]);
  assert.equal(report.drops.get("Herb"), 1);
  assert.equal(report.drops.get("Gold Ore P1"), 2);
  assert.equal(report.ignoredDrops.get("Silver Ore P2"), 1);
});

test("offlineGroupHitChance", () => {
  assert.equal(offlineGroupHitChance(10, 0), 0.98);
  assert.equal(offlineGroupHitChance(0, 99), 0.05);
});

test("offlineGroupAverageDamage", () => {
  assert.equal(offlineGroupAverageDamage([10, 20], [2, 4], 0), 12);
  assert.equal(offlineGroupAverageDamage([10, 10], [3, 3], 10), 7);
});

test("computeOfflineGroupIncomingDps", () => {
  const dps = computeOfflineGroupIncomingDps({
    attackers: 3,
    enemyAttackStat: [10, 20],
    enemyLuck: 0,
    enemyAttackMs: 1000,
    enemyAccuracy: 10,
    enemyDefenceType: "AC",
    targetDefenceStat: [2, 4],
    targetAgility: 5,
  });
  assert.ok(dps > 0);
  const macDps = computeOfflineGroupIncomingDps({
    attackers: 3,
    enemyAttackStat: [10, 20],
    enemyAttackMs: 1000,
    enemyDefenceType: "MAC",
    targetDefenceStat: [2, 4],
    targetAgility: 5,
  });
  assert.ok(macDps > dps * 0.8);
});

test("computeOfflineGroupMemberDps", () => {
  const enemy = { ac: [5, 5], amc: [5, 5], agility: 5 };
  const warrior = { classId: "Warrior", dc: [10, 20], luck: 0, accuracy: 10, attackSpeed: 0, mp: 0 };
  assert.ok(computeOfflineGroupMemberDps(warrior, enemy) >= 0.1);
});

test("computeOfflineGroupPartyDps", () => {
  const enemy = { ac: [5, 5], amc: [5, 5], agility: 5 };
  const members = [
    { classId: "Warrior", alive: true, hp: 100, dc: [10, 20], luck: 0, accuracy: 10, attackSpeed: 0, mp: 0 },
    { classId: "Wizard", alive: false, hp: 0, dc: [1, 2], mc: [5, 10], luck: 0, accuracy: 5, attackSpeed: 0, mp: 50 },
  ];
  assert.ok(computeOfflineGroupPartyDps(members, enemy) >= 0.1);
});

test("estimateOfflineGroupKillDurationMs", () => {
  assert.deepEqual(estimateOfflineGroupKillDurationMs(1000, 10, 5000), { durationMs: 5000, estimatedKillMs: 100_000 });
  assert.deepEqual(estimateOfflineGroupKillDurationMs(100, 10, 20_000), { durationMs: 10_000, estimatedKillMs: 10_000 });
  assert.deepEqual(estimateOfflineGroupKillDurationMs(100, 10, 5000), { durationMs: 5000, estimatedKillMs: 10_000 });
});

test("resolveOfflineGroupIncomingChunk", () => {
  assert.deepEqual(resolveOfflineGroupIncomingChunk(50, 20), { damage: 20, nextHp: 30, died: false });
  assert.deepEqual(resolveOfflineGroupIncomingChunk(15, 20), { damage: 20, nextHp: 0, died: true });
  assert.deepEqual(resolveOfflineGroupIncomingChunk(50, 0), { damage: 0, nextHp: 50, died: false });
});

test("simulateOfflineGroupKillLoop: party survives and kills", () => {
  const enemy = { id: "deer", maxHp: 100, ac: [1, 1], amc: [1, 1], agility: 1 };
  const members = [
    { classId: "Warrior", alive: true, hp: 500, dc: [50, 50], luck: 0, accuracy: 20, attackSpeed: 0, mp: 0 },
  ];
  const result = simulateOfflineGroupKillLoop({
    remainingMs: 60_000,
    startedAt: 1000,
    enemy,
    members,
    getFrontTarget: () => members[0],
    getIncomingDps: () => 0,
  });
  assert.equal(result.killed, true);
  assert.equal(result.partyDied, false);
  assert.ok(result.elapsedMs >= 300);
});

test("simulateOfflineGroupKillLoop: party wipe", () => {
  const enemy = { id: "wolf", maxHp: 10_000, ac: [1, 1], amc: [1, 1], agility: 1 };
  let hp = 30;
  const target = { classId: "Warrior", alive: true, get hp() { return hp; }, set hp(value) { hp = value; } };
  const result = simulateOfflineGroupKillLoop({
    remainingMs: 60_000,
    startedAt: 1000,
    enemy,
    members: [target],
    getFrontTarget: () => (target.alive && hp > 0 ? target : null),
    getIncomingDps: () => 100,
    onIncomingDamage: (member, damage) => {
      const chunk = resolveOfflineGroupIncomingChunk(hp, damage);
      hp = chunk.died ? 0 : chunk.nextHp;
      if (chunk.died) target.alive = false;
    },
  });
  assert.equal(result.partyDied, true);
  assert.equal(result.killed, false);
});

test("computeOfflineIncomingChunkDamage", () => {
  assert.equal(computeOfflineIncomingChunkDamage(12, 1000), 12);
  assert.equal(computeOfflineIncomingChunkDamage(12, 500), 6);
  assert.equal(computeOfflineIncomingChunkDamage(-1, 1000), 0);
});

test("createOfflineZoneReport", () => {
  const report = createOfflineZoneReport({ capped: true });
  assert.equal(report.elapsedMs, 0);
  assert.equal(report.capped, true);
  assert.equal(report.kills, 0);
  assert.ok(report.drops instanceof Map);
});

test("computeOfflineRespawnDelay", () => {
  assert.equal(computeOfflineRespawnDelay(500, 1400), 500);
  assert.equal(computeOfflineRespawnDelay(5000, 1400), 1400);
});

test("computeOfflineFightTickDelta", () => {
  assert.equal(computeOfflineFightTickDelta(400, 900, Infinity), 400);
  assert.equal(computeOfflineFightTickDelta(1200, 300, 50), 50);
});

test("processOfflineZoneFightCycle: player death stops progress", () => {
  const report = createOfflineZoneReport();
  const step = processOfflineZoneFightCycle(
    report,
    { elapsedMs: 2500, killed: false, playerDied: true, enemy: { id: "deer", hp: 10 } },
    120_000,
    1400,
  );
  assert.equal(step.status, "player_died");
  assert.equal(report.elapsedMs, 2500);
  assert.equal(report.diedAtMs, 2500);
  assert.deepEqual(report.finalEnemy, { id: "deer", hp: 10 });
});

test("processOfflineZoneFightCycle: kill adds respawn delay", () => {
  const report = createOfflineZoneReport();
  const step = processOfflineZoneFightCycle(
    report,
    { elapsedMs: 5000, killed: true, playerDied: false, enemy: { id: "deer" } },
    120_000,
    1400,
  );
  assert.equal(step.status, "kill_complete");
  assert.equal(step.respawnMs, 1400);
  assert.equal(report.elapsedMs, 6400);
  assert.equal(report.finalEnemy, null);
});

test("simulateOfflineZoneProgressLoop: characterization fixture", () => {
  let fightIndex = 0;
  const fights = [
    { elapsedMs: 5000, killed: true, playerDied: false, enemy: { id: "deer" } },
    { elapsedMs: 8000, killed: true, playerDied: false, enemy: { id: "hen" } },
    { elapsedMs: 3000, killed: false, playerDied: false, enemy: { id: "wolf", hp: 40 } },
  ];
  const report = simulateOfflineZoneProgressLoop(30_000, {
    startedAt: 1_000,
    respawnDelayMs: 1400,
    getPlayerHp: () => 50,
    simulateFight: () => fights[fightIndex++],
    onKill: (current) => {
      recordOfflineKillRewards(current, {
        xp: 12,
        gold: 3,
        levels: fightIndex === 1 ? [4] : [],
        addedDropLabels: ["Herb"],
      });
    },
  });
  assert.equal(report.kills, 2);
  assert.equal(report.xp, 24);
  assert.equal(report.gold, 6);
  assert.deepEqual(report.levels, [4]);
  assert.equal(report.drops.get("Herb"), 2);
  assert.equal(report.elapsedMs, 18_800);
  assert.equal(report.simulatedStartedAt, 1_000);
  assert.equal(report.simulatedEndedAt, 19_800);
  assert.deepEqual(report.finalEnemy, { id: "wolf", hp: 40 });
});

test("computeOfflinePetAttackDelayMs", () => {
  assert.equal(computeOfflinePetAttackDelayMs(null, 1000), Infinity);
  assert.equal(computeOfflinePetAttackDelayMs({ active: true, nextAttackAt: 1500 }, 1000), 500);
  assert.equal(
    computeOfflinePetAttackDelayMs({ active: true, nextAttackAt: 900 }, 1000, { outOfRange: true }),
    Infinity,
  );
  assert.equal(
    computeOfflinePetAttackDelayMs({ active: true, nextAttackAt: 900 }, 1000, { pendingPetAttack: true }),
    1,
  );
  // Jump to the pending impact instead of thrashing 1ms steps through the delay.
  assert.equal(
    computeOfflinePetAttackDelayMs(
      { active: true, nextAttackAt: 900 },
      1000,
      { pendingPetAttack: true, pendingPetAttackAt: 1500 },
    ),
    500,
  );
  // A ready-but-blocked pet (paralyzed / follower mid-move) must never return 0,
  // or the fight loop spins at delta=0 until the guard trips.
  assert.equal(
    computeOfflinePetAttackDelayMs({ active: true, nextAttackAt: 900 }, 1000, { blocked: true }),
    Infinity,
  );
  assert.equal(
    computeOfflinePetAttackDelayMs({ active: true, nextAttackAt: 1500 }, 1000, { blocked: true }),
    Infinity,
  );
});

test("computeOfflineLivingPetsAttackDelayMs: soonest living pet wins", () => {
  assert.equal(
    computeOfflineLivingPetsAttackDelayMs(
      [
        { active: true, nextAttackAt: 2000 },
        { active: true, nextAttackAt: 1200 },
      ],
      1000,
      (pet, now) => computeOfflinePetAttackDelayMs(pet, now),
    ),
    200,
  );
  assert.equal(
    computeOfflineLivingPetsAttackDelayMs(
      [
        { active: true, nextAttackAt: 900 },
        { active: true, nextAttackAt: 800 },
      ],
      1000,
      (pet, now) => computeOfflinePetAttackDelayMs(pet, now, { outOfRange: true }),
    ),
    Infinity,
  );
  assert.equal(
    computeOfflineLivingPetsAttackDelayMs(
      [
        { active: true, nextAttackAt: 2000 },
        { active: true, nextAttackAt: 900 },
      ],
      1000,
      (pet, now) => computeOfflinePetAttackDelayMs(
        pet,
        now,
        { outOfRange: pet.nextAttackAt < 1000 },
      ),
    ),
    1000,
  );
});

test("computeOfflineFightTravelMs", () => {
  assert.equal(computeOfflineFightTravelMs(2000, 1500), 1500);
  assert.equal(computeOfflineFightTravelMs(800, 1500), 800);
});

test("advanceOfflineFightTick", () => {
  assert.deepEqual(advanceOfflineFightTick(1000, 400, 5000), { elapsedMs: 1400, hitLimit: false });
  assert.deepEqual(advanceOfflineFightTick(4800, 400, 5000), { elapsedMs: 5000, hitLimit: true });
});

test("createOfflineFightEnemy", () => {
  const enemy = createOfflineFightEnemy({ id: "deer", maxHp: 20, maxMp: 0, dc: [1, 2] });
  assert.equal(enemy.hp, 20);
  assert.equal(enemy.mp, 0);
  assert.deepEqual(enemy.poisons, []);
});

test("createOfflineFightEnemy: can continue from current HP", () => {
  const enemy = createOfflineFightEnemy(
    { id: "leecher", maxHp: 2500, maxMp: 0 },
    { hp: 120, poisons: [{ kind: "green", ticksRemaining: 2 }] },
  );
  assert.equal(enemy.hp, 120);
  assert.equal(enemy.maxHp, 2500);
  assert.equal(enemy.poisons.length, 1);
});

test("canResumeOfflineZoneEnemy: only damaged living mobs resume", () => {
  assert.equal(
    canResumeOfflineZoneEnemy({ id: 1, hp: 40, maxHp: 2500 }),
    true,
  );
  assert.equal(
    canResumeOfflineZoneEnemy({ id: 1, hp: 2500, maxHp: 2500 }, { phase: "engaged" }),
    false,
  );
  assert.equal(
    canResumeOfflineZoneEnemy({ id: 1, hp: 0, maxHp: 2500 }),
    false,
  );
  assert.equal(
    canResumeOfflineZoneEnemy({ id: 1, hp: 10, maxHp: 2500 }, { trainingDummy: true }),
    false,
  );
});

test("simulateOfflineFightLoop: travel then kill", () => {
  let playerHp = 100;
  const enemy = createOfflineFightEnemy({ id: "deer", maxHp: 10, maxMp: 0, attackMs: 5000 });
  const result = simulateOfflineFightLoop({
    remainingMs: 20_000,
    startedAt: 1000,
    travelMs: 600,
    enemy,
    getPlayerHp: () => playerHp,
    getPetAttackDelayMs: () => Infinity,
    onPlayerAttack: (target) => {
      target.hp = 0;
      return true;
    },
    consumePlayerCooldownMs: () => 550,
  });
  assert.equal(result.elapsedMs, 600);
  assert.equal(result.killed, true);
  assert.equal(result.playerDied, false);
});

test("simulateOfflineFightLoop: enemy kills player", () => {
  let playerHp = 30;
  const enemy = createOfflineFightEnemy({ id: "wolf", maxHp: 100, maxMp: 0, attackMs: 1000 });
  const result = simulateOfflineFightLoop({
    remainingMs: 20_000,
    travelMs: 0,
    enemy,
    initialNextEnemyAttackMs: 1000,
    getPlayerHp: () => playerHp,
    getPetAttackDelayMs: () => Infinity,
    onPlayerAttack: () => true,
    consumePlayerCooldownMs: () => 600,
    onEnemyAttack: () => {
      playerHp = 0;
    },
    getNextEnemyAttackMs: () => 1000,
  });
  assert.equal(result.killed, false);
  assert.equal(result.playerDied, true);
  assert.equal(result.elapsedMs, 1000);
});

test("simulateOfflineFightLoop: hits remaining time cap", () => {
  const enemy = createOfflineFightEnemy({ id: "deer", maxHp: 100, maxMp: 0, attackMs: 900 });
  const result = simulateOfflineFightLoop({
    remainingMs: 2500,
    travelMs: 500,
    enemy,
    initialNextEnemyAttackMs: 900,
    getPlayerHp: () => 50,
    getPetAttackDelayMs: () => Infinity,
    onPlayerAttack: () => true,
    consumePlayerCooldownMs: () => 550,
  });
  assert.equal(result.elapsedMs, 2500);
  assert.equal(result.killed, false);
  assert.equal(result.playerDied, false);
});

test("simulateOfflineFightLoop: guard exhaustion flags a stalled fight", () => {
  const enemy = createOfflineFightEnemy({ id: "wolf", maxHp: 100, maxMp: 0, attackMs: 5000 });
  const result = simulateOfflineFightLoop({
    remainingMs: 60_000,
    travelMs: 0,
    enemy,
    maxGuard: 25,
    getPlayerHp: () => 50,
    // Pet reports "ready now" every tick but the attack handler never acts,
    // reproducing the delta=0 deadlock that discarded offline windows.
    getPetAttackDelayMs: () => 0,
    onPlayerAttack: () => false,
  });
  assert.equal(result.killed, false);
  assert.equal(result.playerDied, false);
  assert.equal(result.stalled, true);
});

test("simulateOfflineFightLoop: hitting the time cap is not a stall", () => {
  const enemy = createOfflineFightEnemy({ id: "deer", maxHp: 100, maxMp: 0, attackMs: 900 });
  const result = simulateOfflineFightLoop({
    remainingMs: 2500,
    travelMs: 500,
    enemy,
    getPlayerHp: () => 50,
    getPetAttackDelayMs: () => Infinity,
    onPlayerAttack: () => true,
    consumePlayerCooldownMs: () => 550,
  });
  assert.equal(result.elapsedMs, 2500);
  assert.equal(result.stalled, undefined);
});

test("simulateOfflineFightLoop: secondary casts fire independently of the attack cooldown", () => {
  // Live combat casts Taoist SoulFireBall/Plague/Curse every frame, gated only by
  // each spell's own timer and never by the player attack cooldown. The offline
  // sim used to take a single action per turn, which halved a Taoist's casts.
  const enemy = createOfflineFightEnemy({ id: "wolf", maxHp: 100_000, maxMp: 0, attackMs: 900 });
  let playerAttacks = 0;
  let secondaryCasts = 0;
  simulateOfflineFightLoop({
    remainingMs: 10_000,
    travelMs: 0,
    enemy,
    initialNextEnemyAttackMs: 900,
    getPlayerHp: () => 50,
    getPetAttackDelayMs: () => Infinity,
    onPlayerAttack: () => {
      playerAttacks += 1;
      return true;
    },
    // Far longer than the enemy's swing timer, so most iterations do not act.
    consumePlayerCooldownMs: () => 5000,
    onSecondaryCasts: () => {
      secondaryCasts += 1;
    },
    getNextEnemyAttackMs: () => 900,
  });
  assert.ok(playerAttacks > 0);
  assert.ok(
    secondaryCasts > playerAttacks,
    `expected secondary casts (${secondaryCasts}) to outnumber attacks (${playerAttacks})`,
  );
});

test("simulateOfflineFightLoop: a secondary cast can land the killing blow", () => {
  const enemy = createOfflineFightEnemy({ id: "wolf", maxHp: 10, maxMp: 0, attackMs: 900 });
  const result = simulateOfflineFightLoop({
    remainingMs: 10_000,
    travelMs: 0,
    enemy,
    initialNextEnemyAttackMs: 900,
    getPlayerHp: () => 50,
    getPetAttackDelayMs: () => Infinity,
    onPlayerAttack: () => true,
    consumePlayerCooldownMs: () => 5000,
    onSecondaryCasts: () => {
      enemy.hp = 0;
    },
    getNextEnemyAttackMs: () => 900,
  });
  assert.equal(result.killed, true);
  assert.equal(result.playerDied, false);
});

test("processOfflineZoneFightCycle: stalled fight reports fight_stalled", () => {
  const report = createOfflineZoneReport();
  const step = processOfflineZoneFightCycle(
    report,
    { elapsedMs: 40, killed: false, playerDied: false, stalled: true, enemy: { id: "wolf", hp: 90 } },
    120_000,
    1400,
  );
  assert.equal(step.status, "fight_stalled");
  assert.equal(report.elapsedMs, 40);
});

test("nextOfflineTaoistSupportSpellId: picks first available in default order", () => {
  assert.equal(
    nextOfflineTaoistSupportSpellId({ Healing: false, SoulShield: true, SoulFireBall: true }),
    "SoulShield",
  );
  assert.equal(
    nextOfflineTaoistSupportSpellId({ Healing: true, SoulShield: true }),
    "Healing",
  );
  assert.equal(nextOfflineTaoistSupportSpellId({}), null);
});

test("nextOfflineTaoistSupportSpellId: respects custom order", () => {
  const order = ["Poisoning", "Healing"];
  assert.equal(
    nextOfflineTaoistSupportSpellId({ Healing: true, Poisoning: true }, order),
    "Poisoning",
  );
});

test("OFFLINE_TAOIST_SUPPORT_SPELL_ORDER: player-tank support priority", () => {
  assert.deepEqual(OFFLINE_TAOIST_SUPPORT_SPELL_ORDER, [
    "MassHealing",
    "Healing",
    "HealingCircle",
    "SoulShield",
    "BlessedArmour",
    "EnergyShield",
    "UltimateEnhancer",
    "PetEnhancer",
    "Poisoning",
    "PoisonCloud",
    "Curse",
    "Plague",
  ]);
});

test("OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER: appends SoulFireBall after support", () => {
  assert.deepEqual(OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER, [
    ...OFFLINE_TAOIST_SUPPORT_SPELL_ORDER,
    "SoulFireBall",
  ]);
});

test("nextOfflineTaoistSupportSpellId: player-tank order excludes SoulFireBall unless listed", () => {
  assert.equal(
    nextOfflineTaoistSupportSpellId(
      { Healing: false, Poisoning: true, SoulFireBall: true },
      OFFLINE_TAOIST_SUPPORT_SPELL_ORDER,
    ),
    "Poisoning",
  );
  assert.equal(
    nextOfflineTaoistSupportSpellId(
      { Healing: false, Poisoning: false, SoulFireBall: true },
      OFFLINE_TAOIST_SUPPORT_SPELL_ORDER,
    ),
    null,
  );
});

test("offlineTaoistQueuedSpellKind: maps queued spells to handler kinds", () => {
  assert.equal(offlineTaoistQueuedSpellKind("SoulFireBall"), "soulFireBall");
  assert.equal(offlineTaoistQueuedSpellKind("SummonSkeleton"), "summon");
  assert.equal(offlineTaoistQueuedSpellKind("SummonShinsu"), "summon");
  assert.equal(offlineTaoistQueuedSpellKind("SummonHolyDeva"), "summon");
  assert.equal(offlineTaoistQueuedSpellKind("SoulShield"), "defenceBuff");
  assert.equal(offlineTaoistQueuedSpellKind("BlessedArmour"), "defenceBuff");
  assert.equal(offlineTaoistQueuedSpellKind("EnergyShield"), "energyShield");
  assert.equal(offlineTaoistQueuedSpellKind("HealingCircle"), "healingCircle");
  assert.equal(offlineTaoistQueuedSpellKind("MassHealing"), "massHeal");
  assert.equal(offlineTaoistQueuedSpellKind("PetEnhancer"), "petEnhancer");
  assert.equal(offlineTaoistQueuedSpellKind("PoisonCloud"), "poisonCloud");
  assert.equal(offlineTaoistQueuedSpellKind("Plague"), "plague");
  assert.equal(offlineTaoistQueuedSpellKind("Curse"), "curse");
  assert.equal(offlineTaoistQueuedSpellKind("Unknown"), null);
});

test("nextOfflineTaoistAutoSummonId: skeleton before shinsu", () => {
  assert.equal(
    nextOfflineTaoistAutoSummonId({ SummonSkeleton: true, SummonShinsu: true }),
    "SummonSkeleton",
  );
  assert.equal(
    nextOfflineTaoistAutoSummonId({ SummonSkeleton: false, SummonShinsu: true }),
    "SummonShinsu",
  );
  assert.equal(nextOfflineTaoistAutoSummonId({}), null);
});

test("OFFLINE_TAOIST_AUTO_SUMMON_ORDER: skeleton then shinsu then holy deva", () => {
  assert.deepEqual(OFFLINE_TAOIST_AUTO_SUMMON_ORDER, ["SummonSkeleton", "SummonShinsu", "SummonHolyDeva"]);
});

test("offlineTaoistSummonPetDelayMs: picks skeleton vs shinsu vs holy deva delay", () => {
  const delays = { skeletonMs: 1000, shinsuMs: 2000, holyDevaMs: 1500 };
  assert.equal(offlineTaoistSummonPetDelayMs("SummonSkeleton", delays), 1000);
  assert.equal(offlineTaoistSummonPetDelayMs("SummonShinsu", delays), 2000);
  assert.equal(offlineTaoistSummonPetDelayMs("SummonHolyDeva", delays), 1500);
  assert.equal(offlineTaoistSummonPetDelayMs("SoulFireBall", delays), 1000);
});

test("resolveOfflineWizardTurnPhase: Magic Shield before attack", () => {
  assert.equal(
    resolveOfflineWizardTurnPhase({ defenceAuto: true, hasAttackSpell: true, weaponFallback: false }),
    "defenceAuto",
  );
  assert.equal(
    resolveOfflineWizardTurnPhase({
      defenceAuto: false,
      defenceQueued: true,
      hasAttackSpell: true,
      weaponFallback: false,
    }),
    "defenceQueued",
  );
  assert.equal(
    resolveOfflineWizardTurnPhase({ hasAttackSpell: false, weaponFallback: false }),
    "weapon",
  );
  assert.equal(
    resolveOfflineWizardTurnPhase({ hasAttackSpell: true, weaponFallback: true }),
    "weapon",
  );
  assert.equal(
    resolveOfflineWizardTurnPhase({ hasAttackSpell: true, weaponFallback: false }),
    "cast",
  );
});

test("OFFLINE_WIZARD_DEFENCE_SPELL_ID: Magic Shield", () => {
  assert.equal(OFFLINE_WIZARD_DEFENCE_SPELL_ID, "MagicShield");
});
