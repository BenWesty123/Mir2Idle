import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PHASE1_ENEMY_TEMPLATES, PHASE1_ZONES } from "../src/phase1Data.js";
import { BOSS_DROP_TABLE_BY_LABEL, BOSS_GEM_ITEM_IDS, BOSS_ORB_ITEM_IDS } from "../src/bossDrops.js";
import { glyphDropItemIds } from "../src/glyphModifiers.js";
import {
  MYSTERY_CAVE_BOSS_TEMPLATE_IDS,
  MYSTERY_CAVE_CHEST_ITEM_ID,
  MYSTERY_CAVE_EXCLUDED_STATIONARY_TEMPLATE_IDS,
  MYSTERY_CAVE_GOLD_PER_KILL,
  MYSTERY_CAVE_XP_MULTIPLIER,
  MYSTERY_CAVE_RARE_ORE_ITEM_IDS,
  MYSTERY_CAVE_RARE_ORE_PER_KILL,
  MYSTERY_CAVE_SPAWN_INTERVAL_MS,
  MYSTERY_CAVE_SPAWN_WAVES,
  MYSTERY_CAVE_ZONE_ID,
  MYSTERY_CAVE_RANDOM_ZONE_ID,
  buildMysteryCaveSpawnQueue,
  isMysteryCaveIneligibleBoss,
  isMysteryCaveZone,
  mysteryCaveBossMaxHp,
  mysteryCaveCompletedWaveCount,
  mysteryCaveGoldReward,
  mysteryCaveExperienceReward,
  mysteryCaveFurthestBossExperienceSource,
  mysteryCaveRareOreCount,
  mysteryCaveSunPotionCounts,
  mysteryCaveGemOrbCounts,
  mysteryCaveBenedictionOilCount,
  mysteryCaveAwakeningSoulCount,
  mysteryCaveHavocCrystalCount,
  mysteryCaveBlackIronCount,
  mysteryCaveBlackIronPurityLabel,
  mysteryCaveBlackIronPurityRange,
  rollMysteryCaveBlackIronPurity,
  pickMysteryCavePoolItem,
  rollMysteryCaveGemOrbReward,
  mysteryCaveBestWaveFromKills,
  mysteryCaveDropLabelForRun,
  mysteryCaveDropLabelForWave,
  isMysteryCaveEquipmentDropItem,
  mysteryCaveEquipmentDropEntries,
  rollMysteryCaveEquipmentReward,
  mysteryCaveTierLabel,
  mysteryCavePulledFightStartAt,
  mysteryCaveStatMultiplier,
  mysteryCaveRandomLootCount,
  mysteryCaveRandomStatMultiplier,
  mysteryCaveRandomVisualTemplateIds,
  mysteryCaveRandomCombatDonorIds,
  mysteryCaveRandomCombatWindow,
  mysteryCaveRandomGoldReward,
  mysteryCaveRandomExperienceReward,
  mysteryCaveRandomGoldRange,
  mysteryCaveRandomExperienceRange,
  mysteryCaveBestBossExperienceUpToKills,
  buildMysteryCaveRandomPlanEntry,
  ensureMysteryCaveRandomSpawnPlan,
  rollMysteryCaveRandomChestItems,
  mysteryCaveRandomDroppableEquipIds,
  MYSTERY_CAVE_RANDOM_TICKET_ITEM_ID,
  MYSTERY_CAVE_SCARECROW_TEMPLATE_ID,
  MYSTERY_CAVE_CHICKEN_TEMPLATE_ID,
  MYSTERY_CAVE_ZUMA_TAURUS_TEMPLATE_ID,
  MYSTERY_CAVE_OMA_KING_TEMPLATE_ID,
  MYSTERY_CAVE_RANDOM_GUARDRAIL_TEMPLATE_ID,
  MYSTERY_CAVE_RANDOM_GUARDRAIL_SPAWNS,
  MYSTERY_CAVE_RANDOM_FULL_LADDER_SPAWN,
  MYSTERY_CAVE_RANDOM_ATTACK_FX_TEMPLATE_IDS,
  MYSTERY_CAVE_RANDOM_EXCLUDED_TEMPLATE_IDS,
  MYSTERY_CAVE_RANDOM_WOODEN_SWORD_ITEM_ID,
  MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID,
  MYSTERY_CAVE_RANDOM_COOLDOWN_MS,
  sanitizeMysteryCaveRandomReadyAt,
  mysteryCaveRandomCooldownRemainingMs,
} from "../src/mysteryCave.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Random Cave ticket is limited to one run every 24 hours", () => {
  assert.equal(MYSTERY_CAVE_RANDOM_COOLDOWN_MS, 24 * 60 * 60 * 1000);

  const now = 1_800_000_000_000;
  assert.equal(mysteryCaveRandomCooldownRemainingMs(0, now), 0, "a fresh save has no cooldown");
  assert.equal(mysteryCaveRandomCooldownRemainingMs(undefined, now), 0, "missing field reads as ready");

  const readyAt = now + MYSTERY_CAVE_RANDOM_COOLDOWN_MS;
  assert.equal(mysteryCaveRandomCooldownRemainingMs(readyAt, now), MYSTERY_CAVE_RANDOM_COOLDOWN_MS);
  assert.equal(mysteryCaveRandomCooldownRemainingMs(readyAt, readyAt), 0, "expires exactly on time");
  assert.equal(mysteryCaveRandomCooldownRemainingMs(readyAt, readyAt + 1), 0);

  // A stamp further out than one full cooldown means the clock moved backwards,
  // so it is dropped rather than locking the player out for longer than a day.
  assert.equal(sanitizeMysteryCaveRandomReadyAt(readyAt + 1, now), 0);
  assert.equal(sanitizeMysteryCaveRandomReadyAt(-5, now), 0);
  assert.equal(sanitizeMysteryCaveRandomReadyAt("nonsense", now), 0);
});

test("Mystery Cave roster is unique moving bosses in encounter order", () => {
  assert.equal(new Set(MYSTERY_CAVE_BOSS_TEMPLATE_IDS).size, MYSTERY_CAVE_BOSS_TEMPLATE_IDS.length);
  for (const templateId of MYSTERY_CAVE_BOSS_TEMPLATE_IDS) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    assert.ok(template, `missing template ${templateId}`);
    assert.equal(isMysteryCaveIneligibleBoss(template), false, `${template.name} should walk in the swarm`);
    assert.ok((Number(template.moveMs) || 0) > 0, `${template.name} has no walk speed`);
  }
  for (const templateId of MYSTERY_CAVE_EXCLUDED_STATIONARY_TEMPLATE_IDS) {
    assert.equal(MYSTERY_CAVE_BOSS_TEMPLATE_IDS.includes(templateId), false);
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    assert.ok(template, `missing excluded template ${templateId}`);
    assert.equal(isMysteryCaveIneligibleBoss(template), true, `${template.name} should stay out of Mystery Cave`);
  }
  // Every walking boss with its own drop table belongs in the swarm; the only
  // documented exclusions are the stationary ones above. Crystal Spider and Red
  // Evil Ape were missed on the first pass, so pin them explicitly.
  for (const templateId of [464, 465]) {
    assert.ok(MYSTERY_CAVE_BOSS_TEMPLATE_IDS.includes(templateId), `roster missing ${templateId}`);
  }
});

test("every Mystery Cave wave resolves to a real boss drop table", () => {
  MYSTERY_CAVE_SPAWN_WAVES.forEach((wave, waveIndex) => {
    const label = mysteryCaveDropLabelForWave(waveIndex);
    assert.ok(label, `wave ${waveIndex} has no drop label`);
    assert.ok(BOSS_DROP_TABLE_BY_LABEL[label], `wave ${waveIndex} label "${label}" has no drop table`);
  });
});

test("Mystery Cave spawn queue is waves every 10 seconds, with packs together", () => {
  const queue = buildMysteryCaveSpawnQueue();
  assert.equal(MYSTERY_CAVE_SPAWN_INTERVAL_MS, 10_000);
  assert.equal(queue.at(-1).templateId, 472);
  assert.equal(queue.length, MYSTERY_CAVE_SPAWN_WAVES.reduce((sum, wave) => sum + wave.templateIds.length, 0));
  MYSTERY_CAVE_SPAWN_WAVES.forEach((wave, waveIndex) => {
    const delay = waveIndex * MYSTERY_CAVE_SPAWN_INTERVAL_MS;
    const entries = queue.filter((entry) => entry.spawnDelayMs === delay);
    assert.deepEqual(entries.map((entry) => entry.templateId), wave.templateIds);
    for (const entry of entries) {
      assert.ok([-1, 0, 1].includes(entry.lane));
    }
  });
  const devourers = queue.filter((entry) => entry.templateId === 445 || entry.templateId === 446);
  assert.equal(devourers.length, 2);
  assert.equal(devourers[0].spawnDelayMs, devourers[1].spawnDelayMs);
  assert.equal(devourers[0].waveIndex, devourers[1].waveIndex);
  const iwts = queue.filter((entry) => entry.templateId === 306);
  assert.equal(iwts.length, 3);
  assert.ok(iwts.every((entry) => entry.spawnDelayMs === iwts[0].spawnDelayMs));
  assert.deepEqual(iwts.map((entry) => entry.lane).sort((a, b) => a - b), [-1, 0, 1]);
  const iztWave = queue.filter((entry) => entry.spawnDelayMs === queue.find((row) => row.templateId === 317).spawnDelayMs);
  assert.deepEqual(iztWave.map((entry) => entry.templateId), [317, 318, 318]);
  assert.deepEqual(iztWave.map((entry) => entry.lane), [0, -1, 1]);
  const ids = MYSTERY_CAVE_BOSS_TEMPLATE_IDS;
  assert.ok(ids.includes(318), "IZT wave includes Incarnated Red Thunder Zuma");
});

test("Mystery Cave waves run easiest to hardest by difficulty, not by zone order", () => {
  // Pinned because the ranking is a design decision, not a derived value: waves
  // are sorted by pack HP x sustained DPS, IWT/Hog/IZT stay as that sandwich,
  // and Beast King sits by Danmo on time cost.
  assert.deepEqual(MYSTERY_CAVE_SPAWN_WAVES.map((wave) => wave.templateIds), [
    [266], // Evil Snake
    [465], // Crystal Spider
    [256], // Wooma Taurus
    [279], // Bone Lord
    [272], // Zuma Taurus
    [464], // Red Evil Ape
    [292], // King Scorpion
    [287], // Minotaur King
    [291], // Oma King Spirit
    [414], // Yimoogi
    [306, 306, 306], // 3x Incarnated Wooma Taurus
    [316], // King Hog
    [317, 318, 318], // IZT + 2x Incarnated Red Thunder Zuma
    [445, 446], // Dream + Dark Devourer
    [319], // Dark Devil
    [293], // Manectric King
    [994], // Beast King
    [997], // Danmo
    [471], // Frost Tiger
    [472], // Oma King
  ]);
});

test("Mystery Cave zone is a standalone boss swarm, not a group dungeon", () => {
  const zone = PHASE1_ZONES.find((entry) => entry.id === MYSTERY_CAVE_ZONE_ID);
  assert.ok(zone, "zone-mystery-cave missing from PHASE1_ZONES");
  assert.equal(zone.mysteryCave, true);
  assert.equal(zone.bossSwarm, true);
  assert.equal(zone.groupDungeon, undefined);
  assert.ok(isMysteryCaveZone(zone));
  assert.ok(isMysteryCaveZone(MYSTERY_CAVE_ZONE_ID));
  assert.equal(zone.mapStamp, "mystery-cave-center");
  assert.deepEqual(zone.arenaSpawnMap, { x: 161, y: 81 });
  for (const templateId of MYSTERY_CAVE_BOSS_TEMPLATE_IDS) {
    assert.ok(zone.enemyIds.includes(templateId), `zone enemyIds missing ${templateId}`);
  }
});

test("Random Mystery Cave is a portal-reachable remix of the same swarm room", () => {
  const zone = PHASE1_ZONES.find((entry) => entry.id === MYSTERY_CAVE_RANDOM_ZONE_ID);
  assert.ok(zone, "zone-mystery-cave-random missing from PHASE1_ZONES");
  assert.equal(zone.mysteryCave, true);
  assert.equal(zone.mysteryCaveRandom, true);
  assert.equal(zone.bossSwarm, true);
  assert.ok(isMysteryCaveZone(zone));
  assert.ok(isMysteryCaveZone(MYSTERY_CAVE_RANDOM_ZONE_ID));
});

test("every Mystery Cave boss has swarm walk/attack fallbacks", () => {
  const required = ["walking", "attack1", "standing"];
  const missing = [];
  for (const templateId of MYSTERY_CAVE_BOSS_TEMPLATE_IDS) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    const atlasPath = path.join(root, "public", "monsters", "monster", `${template.monsterIndex}.json`);
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
    for (const action of required) {
      if (!atlas.actions?.[action]?.frames?.length) {
        missing.push(`${template.name} (${template.monsterIndex}): ${action}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("Random Cave never spawns non-combat dummies like the Trainer", () => {
  const donors = mysteryCaveRandomCombatDonorIds();
  for (const templateId of MYSTERY_CAVE_RANDOM_EXCLUDED_TEMPLATE_IDS) {
    assert.ok(!donors.includes(templateId), `excluded template ${templateId} is still in the pool`);
  }
  assert.ok(!donors.includes(290), "Trainer dummy must stay out of the Random Cave");
  for (const templateId of donors) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === templateId);
    assert.ok(
      Number(template.experience) > 0,
      `${template.name} (${templateId}) grants no XP, so it is not a real enemy`,
    );
  }
});

test("every Random Cave body and borrowed FX donor has the frames it needs", () => {
  const readAtlas = (monsterIndex) =>
    JSON.parse(
      fs.readFileSync(path.join(root, "public", "monsters", "monster", `${monsterIndex}.json`), "utf8"),
    );
  const templateFor = (id) => PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === id);
  const missingBodyFrames = [];
  for (const templateId of mysteryCaveRandomVisualTemplateIds()) {
    const template = templateFor(templateId);
    const atlas = readAtlas(template.monsterIndex);
    for (const action of ["walking", "attack1", "standing"]) {
      if (!atlas.actions?.[action]?.frames?.length) {
        missingBodyFrames.push(`${template.name} (${template.monsterIndex}): ${action}`);
      }
    }
  }
  assert.deepEqual(missingBodyFrames, []);

  const missingFx = [];
  const fxIndexes = new Set();
  for (const templateId of MYSTERY_CAVE_RANDOM_ATTACK_FX_TEMPLATE_IDS) {
    const template = templateFor(templateId);
    if (template?.monsterIndex == null) {
      missingFx.push(`template ${templateId} has no sprite`);
      continue;
    }
    if (!readAtlas(template.monsterIndex).projectile?.frames?.length) {
      missingFx.push(`${template.name} (${template.monsterIndex}): no projectile frames`);
    }
    assert.ok(!fxIndexes.has(template.monsterIndex), `duplicate FX monsterIndex ${template.monsterIndex}`);
    fxIndexes.add(template.monsterIndex);
  }
  assert.deepEqual(missingFx, []);
  assert.ok(fxIndexes.size >= 20, `FX pool should be broad (got ${fxIndexes.size})`);
});

test("Mystery Cave plain Zuma Taurus HP is the template, not awakened", () => {
  const zuma = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === 272);
  assert.ok(zuma, "Zuma Taurus template missing");
  assert.equal(zuma.maxHp, 12000);
  assert.equal(mysteryCaveStatMultiplier(0), 1);
  assert.equal(mysteryCaveStatMultiplier(1), 2);
  assert.equal(mysteryCaveStatMultiplier(2), 3);
  assert.equal(mysteryCaveStatMultiplier(3), 4);
  assert.equal(mysteryCaveBossMaxHp(zuma, 0), 12000);
  assert.equal(mysteryCaveBossMaxHp(zuma, 1), 24000);
  assert.equal(mysteryCaveBossMaxHp(zuma, 2), 36000);
  assert.equal(mysteryCaveBossMaxHp(zuma, 3), 48000);
  assert.ok(
    mysteryCaveBossMaxHp(zuma, 0) < mysteryCaveBossMaxHp(zuma, 3),
    "plain Mystery Cave Zuma must have less HP than awakened",
  );
});

test("Mystery Cave empty field pulls the next spawn to now without dumping the roster", () => {
  const fightStart = 0;
  const now = 3_000;
  const nextSpawnAtMs = 10_000;
  const pulled = mysteryCavePulledFightStartAt(fightStart, nextSpawnAtMs, now);
  assert.equal(pulled, now - nextSpawnAtMs);
  assert.equal(pulled + nextSpawnAtMs, now);
  assert.equal(pulled + 20_000, now + 10_000);
  assert.equal(mysteryCavePulledFightStartAt(0, 0, 100), 0);
  assert.equal(mysteryCavePulledFightStartAt(0, 10_000, 10_000), 0);
  assert.equal(mysteryCavePulledFightStartAt(0, 10_000, 25_000), 0);
});

test("Mystery Cave spawn HP comes from each boss template, not a random room dummy", () => {
  const expected = {
    256: 3000,
    266: 2000,
    272: 12000,
    292: 10000,
    306: 12000,
    317: 20000,
    319: 40000,
    472: 200000,
  };
  for (const [templateId, hp] of Object.entries(expected)) {
    const template = PHASE1_ENEMY_TEMPLATES.find((entry) => entry.id === Number(templateId));
    assert.equal(mysteryCaveBossMaxHp(template, 0), hp, `${template.name} plain HP`);
  }
});

test("Mystery Cave rare ores are 5 of each per boss kill times difficulty", () => {
  assert.deepEqual([...MYSTERY_CAVE_RARE_ORE_ITEM_IDS], [
    "adamantine-ore",
    "ruby-ore",
    "emerald-ore",
    "amethyst-ore",
  ]);
  assert.equal(MYSTERY_CAVE_RARE_ORE_PER_KILL, 5);
  assert.equal(mysteryCaveRareOreCount(0), 0);
  assert.equal(mysteryCaveRareOreCount(2), 10);
  assert.equal(mysteryCaveRareOreCount(25), 125);
  assert.equal(mysteryCaveRareOreCount(2, 1), 20);
  assert.equal(mysteryCaveRareOreCount(2, 2), 30);
  assert.equal(mysteryCaveRareOreCount(2, 3), 40);
  assert.equal(mysteryCaveRareOreCount(25, 3), 500);
});

test("Mystery Cave sun potions are 2 small and 1 medium per boss kill times difficulty", () => {
  assert.deepEqual(mysteryCaveSunPotionCounts(0), { small: 0, medium: 0 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2), { small: 4, medium: 2 });
  assert.deepEqual(mysteryCaveSunPotionCounts(25), { small: 50, medium: 25 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2, 1), { small: 8, medium: 4 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2, 2), { small: 12, medium: 6 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2, 3), { small: 16, medium: 8 });
  assert.deepEqual(mysteryCaveSunPotionCounts(25, 3), { small: 200, medium: 100 });
});

test("Mystery Cave gems are 1 per kill and orbs are 1 per 3 kills times difficulty", () => {
  assert.deepEqual(mysteryCaveGemOrbCounts(0), { gems: 0, orbs: 0 });
  assert.deepEqual(mysteryCaveGemOrbCounts(2), { gems: 2, orbs: 0 });
  assert.deepEqual(mysteryCaveGemOrbCounts(3), { gems: 3, orbs: 1 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10), { gems: 10, orbs: 3 });
  assert.deepEqual(mysteryCaveGemOrbCounts(25), { gems: 25, orbs: 8 });
  assert.deepEqual(mysteryCaveGemOrbCounts(2, 1), { gems: 4, orbs: 0 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10, 1), { gems: 20, orbs: 6 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10, 2), { gems: 30, orbs: 9 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10, 3), { gems: 40, orbs: 12 });
  assert.deepEqual(mysteryCaveGemOrbCounts(25, 3), { gems: 100, orbs: 32 });
});

test("Mystery Cave gems and orbs roll from the boss pools", () => {
  assert.equal(BOSS_GEM_ITEM_IDS.length, 12);
  assert.equal(BOSS_ORB_ITEM_IDS.length, 12);
  assert.equal(pickMysteryCavePoolItem(BOSS_GEM_ITEM_IDS, () => 0), BOSS_GEM_ITEM_IDS[0]);
  assert.equal(pickMysteryCavePoolItem(BOSS_ORB_ITEM_IDS, () => 0.999), BOSS_ORB_ITEM_IDS.at(-1));
  const rolled = rollMysteryCaveGemOrbReward(10, 0, () => 0);
  assert.equal(rolled.gems.length, 10);
  assert.equal(rolled.orbs.length, 3);
  assert.ok(rolled.gems.every((id) => id === BOSS_GEM_ITEM_IDS[0]));
  assert.ok(rolled.orbs.every((id) => id === BOSS_ORB_ITEM_IDS[0]));
  let i = 0;
  const cycle = () => {
    const value = ((i % 12) + 0.5) / 12;
    i += 1;
    return value;
  };
  const mixed = rollMysteryCaveGemOrbReward(12, 0, cycle);
  assert.deepEqual(mixed.gems, [...BOSS_GEM_ITEM_IDS]);
  assert.deepEqual(mixed.orbs, BOSS_ORB_ITEM_IDS.slice(0, 4));
});

test("Mystery Cave Benediction Oils are 1 per boss kill times difficulty", () => {
  assert.equal(mysteryCaveBenedictionOilCount(0), 0);
  assert.equal(mysteryCaveBenedictionOilCount(2), 2);
  assert.equal(mysteryCaveBenedictionOilCount(25), 25);
  assert.equal(mysteryCaveBenedictionOilCount(2, 1), 4);
  assert.equal(mysteryCaveBenedictionOilCount(2, 2), 6);
  assert.equal(mysteryCaveBenedictionOilCount(2, 3), 8);
  assert.equal(mysteryCaveBenedictionOilCount(25, 3), 100);
});

test("Mystery Cave Awakening Souls are 2 per boss kill times difficulty", () => {
  assert.equal(mysteryCaveAwakeningSoulCount(0), 0);
  assert.equal(mysteryCaveAwakeningSoulCount(2), 4);
  assert.equal(mysteryCaveAwakeningSoulCount(25), 50);
  assert.equal(mysteryCaveAwakeningSoulCount(2, 1), 8);
  assert.equal(mysteryCaveAwakeningSoulCount(2, 2), 12);
  assert.equal(mysteryCaveAwakeningSoulCount(2, 3), 16);
  assert.equal(mysteryCaveAwakeningSoulCount(25, 3), 200);
});

test("Mystery Cave Havoc Crystals are 1 per boss kill times difficulty", () => {
  assert.equal(mysteryCaveHavocCrystalCount(0), 0);
  assert.equal(mysteryCaveHavocCrystalCount(1), 1);
  assert.equal(mysteryCaveHavocCrystalCount(25), 25);
  assert.equal(mysteryCaveHavocCrystalCount(25, 1), 50);
  assert.equal(mysteryCaveHavocCrystalCount(25, 2), 75);
  assert.equal(mysteryCaveHavocCrystalCount(25, 3), 100);
});

test("Mystery Cave Black Iron is 1 per kill with purity by difficulty", () => {
  assert.equal(mysteryCaveBlackIronCount(0), 0);
  assert.equal(mysteryCaveBlackIronCount(2), 2);
  assert.equal(mysteryCaveBlackIronCount(25), 25);
  assert.deepEqual(mysteryCaveBlackIronPurityRange(0), { min: 7, max: 10 });
  assert.deepEqual(mysteryCaveBlackIronPurityRange(1), { min: 8, max: 10 });
  assert.deepEqual(mysteryCaveBlackIronPurityRange(2), { min: 9, max: 10 });
  assert.deepEqual(mysteryCaveBlackIronPurityRange(3), { min: 10, max: 10 });
  assert.equal(mysteryCaveBlackIronPurityLabel(0), "P7–10");
  assert.equal(mysteryCaveBlackIronPurityLabel(3), "P10");
  assert.equal(rollMysteryCaveBlackIronPurity(0, () => 0), 7);
  assert.equal(rollMysteryCaveBlackIronPurity(0, () => 0.999), 10);
  assert.equal(rollMysteryCaveBlackIronPurity(1, () => 0), 8);
  assert.equal(rollMysteryCaveBlackIronPurity(2, () => 0), 9);
  assert.equal(rollMysteryCaveBlackIronPurity(3, () => 0), 10);
  assert.equal(rollMysteryCaveBlackIronPurity(3, () => 0.999), 10);
});

test("Mystery Cave gold is 100,000 per boss kill times difficulty", () => {
  assert.equal(MYSTERY_CAVE_GOLD_PER_KILL, 100_000);
  assert.equal(mysteryCaveGoldReward(0), 0);
  assert.equal(mysteryCaveGoldReward(2), 200_000);
  assert.equal(mysteryCaveGoldReward(25), 2_500_000);
  assert.equal(mysteryCaveGoldReward(2, 1), 400_000);
  assert.equal(mysteryCaveGoldReward(2, 2), 600_000);
  assert.equal(mysteryCaveGoldReward(2, 3), 800_000);
  assert.equal(mysteryCaveGoldReward(25, 3), 10_000_000);
  assert.equal(mysteryCaveTierLabel(0), "Normal");
  assert.equal(mysteryCaveTierLabel(1), "Empowered");
  assert.equal(mysteryCaveTierLabel(2), "Ascended");
  assert.equal(mysteryCaveTierLabel(3), "Awakened");
});

test("Mystery Cave EXP is kills times furthest-boss XP times difficulty times 10", () => {
  assert.equal(MYSTERY_CAVE_XP_MULTIPLIER, 10);
  assert.equal(mysteryCaveFurthestBossExperienceSource(10).name, "Yimoogi");
  assert.equal(mysteryCaveFurthestBossExperienceSource(10).xp, 20_000);
  assert.equal(mysteryCaveExperienceReward(10), 2_000_000);
  assert.equal(mysteryCaveExperienceReward(10, null, 1), 4_000_000);
  assert.equal(mysteryCaveExperienceReward(10, null, 2), 6_000_000);
  assert.equal(mysteryCaveExperienceReward(10, null, 3), 8_000_000);
  assert.equal(mysteryCaveFurthestBossExperienceSource(2).name, "Crystal Spider");
  assert.equal(mysteryCaveExperienceReward(2), 104_000);
  assert.equal(mysteryCaveFurthestBossExperienceSource(6).name, "Red Evil Ape");
  assert.equal(mysteryCaveExperienceReward(6), 720_000);
  assert.equal(mysteryCaveExperienceReward(25), 10_000_000);
  assert.equal(mysteryCaveExperienceReward(25, null, 3), 40_000_000);
  assert.equal(mysteryCaveFurthestBossExperienceSource(25).name, "Oma King");
  const devourerWave = MYSTERY_CAVE_SPAWN_WAVES.findIndex((wave) => wave.templateIds.includes(445));
  const devourerKills = MYSTERY_CAVE_SPAWN_WAVES.slice(0, devourerWave + 1)
    .reduce((sum, wave) => sum + wave.templateIds.length, 0);
  assert.equal(mysteryCaveFurthestBossExperienceSource(devourerKills).name, "Dark Devourer");
  assert.equal(mysteryCaveFurthestBossExperienceSource(devourerKills).xp, 14_250);
  assert.equal(mysteryCaveExperienceReward(devourerKills), devourerKills * 14_250 * 10);
  assert.equal(mysteryCaveExperienceReward(0), 0);
});

test("Mystery Cave completed waves count whole packs only", () => {
  const queue = buildMysteryCaveSpawnQueue();
  const plan = queue.map((entry) => ({
    templateId: entry.templateId,
    spawnAtMs: entry.spawnDelayMs,
    waveIndex: entry.waveIndex,
  }));
  assert.equal(mysteryCaveCompletedWaveCount(plan, 0, []), 0);
  assert.equal(mysteryCaveCompletedWaveCount(plan, 1, []), 1);
  assert.equal(mysteryCaveCompletedWaveCount(plan, 1, [0]), 0);
  const devourerWave = queue.find((entry) => entry.templateId === 445).waveIndex;
  const spawnedThroughDevourers = queue.filter((entry) => entry.waveIndex <= devourerWave).length;
  assert.equal(mysteryCaveCompletedWaveCount(plan, spawnedThroughDevourers, []), devourerWave + 1);
  assert.equal(mysteryCaveCompletedWaveCount(plan, spawnedThroughDevourers, [devourerWave]), devourerWave);
  assert.equal(mysteryCaveCompletedWaveCount(plan, spawnedThroughDevourers - 1, []), devourerWave);
  assert.equal(mysteryCaveCompletedWaveCount(plan, plan.length, []), MYSTERY_CAVE_SPAWN_WAVES.length);
});

test("Mystery Cave chest item exists in items.json", () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const chest = items.find((item) => item.id === MYSTERY_CAVE_CHEST_ITEM_ID);
  assert.ok(chest, "mystery-cave-chest missing from items.json");
  assert.equal(chest.icon.frame, 122);
  assert.equal(chest.stackable, false);
  assert.equal(chest.shop.sell, 0);
});

test("Mystery Cave Ticket item exists in items.json", () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const ticket = items.find((item) => item.id === "mystery-cave-ticket");
  assert.ok(ticket, "mystery-cave-ticket missing from items.json");
  assert.equal(ticket.scroll.kind, "mystery-cave-ticket");
  assert.equal(ticket.icon.frame, 3110);
  assert.equal(ticket.stackable, true);
  assert.equal(items.some((item) => item.id === "mystery-cave-soul"), false);
});

test("Mystery Cave equipment uses the furthest boss table, one item per kill", () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const byId = new Map(items.map((item) => [item.id, item]));
  assert.equal(mysteryCaveDropLabelForRun(1), "Evil Snake");
  assert.equal(mysteryCaveDropLabelForRun(2), "Crystal Spider");
  assert.equal(mysteryCaveDropLabelForRun(6), "Red Evil Ape");
  assert.equal(mysteryCaveDropLabelForRun(8), "Minotaur King");
  assert.equal(mysteryCaveDropLabelForRun(25), "Oma King");
  assert.equal(mysteryCaveDropLabelForRun(11), "Incarnated Wooma Taurus");
  assert.equal(mysteryCaveDropLabelForRun(1, mysteryCaveBestWaveFromKills(25)), "Oma King");
  const minotaur = mysteryCaveEquipmentDropEntries(BOSS_DROP_TABLE_BY_LABEL["Minotaur King"], (id) => byId.get(id));
  assert.ok(minotaur.length > 0);
  assert.equal(minotaur.some((row) => row.id === "awakening-soul"), false);
  assert.ok(minotaur.every((row) => isMysteryCaveEquipmentDropItem(byId.get(row.id))));
  const rolled = rollMysteryCaveEquipmentReward(8, null, 0, (id) => byId.get(id), () => 0);
  assert.equal(rolled.label, "Minotaur King");
  assert.equal(rolled.itemIds.length, 8);
  assert.ok(rolled.itemIds.every((id) => minotaur.some((row) => row.id === id)));
  const full = rollMysteryCaveEquipmentReward(25, null, 0, (id) => byId.get(id), () => 0);
  assert.equal(full.label, "Oma King");
  assert.equal(full.itemIds.length, 25);
});

test("Mystery Cave equipment rolls skip souls, potions, books, gems, and orbs", () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const banned = new Set([
    "awakening-soul",
    "benediction-oil",
    ...BOSS_GEM_ITEM_IDS,
    ...BOSS_ORB_ITEM_IDS,
  ]);
  for (const label of ["Evil Snake", "Crystal Spider", "Red Evil Ape", "Minotaur King", "Oma King", "Incarnated Zuma Taurus"]) {
    const pool = mysteryCaveEquipmentDropEntries(BOSS_DROP_TABLE_BY_LABEL[label], (id) => byId.get(id), { includeAwakened: true });
    assert.ok(pool.length > 0, `${label} has no equipment`);
    for (const row of pool) {
      const item = byId.get(row.id);
      assert.equal(banned.has(row.id), false, `${label} leaked ${row.id}`);
      assert.equal(item?.type === "book" || item?.type === "potion" || item?.type === "gem", false, `${label} leaked ${row.id}`);
    }
  }
});

test("Mystery Cave equipment glyph chance matches empowered boss kills", () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const glyphs = new Set(glyphDropItemIds());
  const alwaysGlyph = rollMysteryCaveEquipmentReward(4, null, 1, (id) => byId.get(id), () => 0);
  assert.equal(alwaysGlyph.itemIds.length, 4);
  assert.ok(alwaysGlyph.itemIds.every((id) => glyphs.has(id)));
  const neverGlyph = rollMysteryCaveEquipmentReward(4, null, 1, (id) => byId.get(id), () => 0.99);
  assert.equal(neverGlyph.itemIds.length, 4);
  assert.ok(neverGlyph.itemIds.every((id) => !glyphs.has(id)));
  const normal = rollMysteryCaveEquipmentReward(4, null, 0, (id) => byId.get(id), () => 0);
  assert.ok(normal.itemIds.every((id) => !glyphs.has(id)));
});

test("Random Mystery Cave Ticket item exists in items.json", () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const ticket = items.find((item) => item.id === MYSTERY_CAVE_RANDOM_TICKET_ITEM_ID);
  assert.ok(ticket, "mystery-cave-random-ticket missing from items.json");
  assert.equal(ticket.scroll.kind, "mystery-cave-random-ticket");
  assert.equal(ticket.stackable, true);
});

test("Random Cave loot is one item per five kills and can include a wooden sword", () => {
  assert.equal(mysteryCaveRandomLootCount(0), 0);
  assert.equal(mysteryCaveRandomLootCount(4), 0);
  assert.equal(mysteryCaveRandomLootCount(5), 1);
  assert.equal(mysteryCaveRandomLootCount(14), 2);
  const woodenSword = {
    id: MYSTERY_CAVE_RANDOM_WOODEN_SWORD_ITEM_ID,
    slot: "weapon",
    type: "weapon",
    requirements: { level: 1 },
    stats: { dc: [1, 3], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
    drop: { zones: ["zone-1-grasslands"], chance: 0.03, chances: { "zone-1-grasslands": 0.03 } },
  };
  const grants = rollMysteryCaveRandomChestItems(25, [woodenSword], () => 0);
  assert.equal(grants.length, 5);
  assert.ok(grants.every((grant) => grant.itemId));

  // No item is weighted: the cheapest gear must take a flat share of the pool,
  // not the inflated one an earlier Wooden Sword bias gave it.
  const pool = [woodenSword, ...Array.from({ length: 19 }, (unused, i) => ({
    ...woodenSword,
    id: `filler-weapon-${i}`,
  }))];
  let cursor = 0.077;
  const rng = () => {
    cursor = (cursor * 9301 + 0.49297) % 1;
    return cursor;
  };
  let equips = 0;
  let swords = 0;
  for (let run = 0; run < 400; run += 1) {
    for (const grant of rollMysteryCaveRandomChestItems(40, pool, rng)) {
      if (grant.itemId === MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID) continue;
      equips += 1;
      if (grant.itemId === MYSTERY_CAVE_RANDOM_WOODEN_SWORD_ITEM_ID) swords += 1;
    }
  }
  const share = swords / Math.max(1, equips);
  assert.ok(equips > 500, `expected a decent sample (got ${equips})`);
  assert.ok(share < 0.15, `Wooden Sword must not be weighted (got ${(share * 100).toFixed(1)}%)`);
});

test("Random Cave loot only rolls items that exist in drop files", () => {
  const shopOnly = {
    id: "shop-only-impossible-blade",
    slot: "weapon",
    type: "weapon",
    requirements: { level: 1 },
    stats: { dc: [9, 9], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
  };
  const droppable = {
    id: "bronze-sword",
    slot: "weapon",
    type: "weapon",
    requirements: { level: 1 },
    stats: { dc: [3, 6], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0] },
    drop: { zones: ["zone-1-grasslands"], chance: 0.02, chances: { "zone-1-grasslands": 0.02 } },
  };
  const ids = mysteryCaveRandomDroppableEquipIds([shopOnly, droppable]);
  assert.deepEqual(ids, ["bronze-sword"]);
  const grants = rollMysteryCaveRandomChestItems(25, [shopOnly, droppable], () => 0.99);
  assert.equal(grants.length, 5);
  assert.ok(grants.every((grant) => (
    grant.itemId === MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID || grant.itemId === "bronze-sword"
  )));
  assert.ok(grants.every((grant) => grant.itemId !== shopOnly.id));

  const items = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items;
  const allowed = new Set([
    MYSTERY_CAVE_SUN_POTION_SMALL_ITEM_ID,
    ...mysteryCaveRandomDroppableEquipIds(items),
  ]);
  assert.ok(allowed.size > 8);
  let cursor = 0.17;
  const rng = () => {
    cursor = (cursor * 1.7 + 0.13) % 1;
    return cursor;
  };
  const liveGrants = rollMysteryCaveRandomChestItems(40, items, rng);
  assert.ok(liveGrants.length > 0);
  for (const grant of liveGrants) {
    assert.ok(allowed.has(grant.itemId), `Random Cave rolled undroppable ${grant.itemId}`);
  }
});

test("Random Cave spawns remix a walking visual with a widening difficulty window", () => {
  const visuals = mysteryCaveRandomVisualTemplateIds();
  const donors = mysteryCaveRandomCombatDonorIds();
  assert.deepEqual([...visuals], [...donors]);
  assert.ok(visuals.length > 100, `body pool should span the roster (got ${visuals.length})`);
  assert.ok(visuals.includes(MYSTERY_CAVE_SCARECROW_TEMPLATE_ID));
  assert.ok(visuals.includes(MYSTERY_CAVE_CHICKEN_TEMPLATE_ID));
  assert.equal(donors[0], MYSTERY_CAVE_CHICKEN_TEMPLATE_ID);
  assert.equal(donors.at(-1), MYSTERY_CAVE_OMA_KING_TEMPLATE_ID);
  assert.ok(donors.includes(MYSTERY_CAVE_ZUMA_TAURUS_TEMPLATE_ID));
  const lastIndex = donors.length - 1;
  const guardIndex = donors.indexOf(MYSTERY_CAVE_RANDOM_GUARDRAIL_TEMPLATE_ID);
  const topIndex = MYSTERY_CAVE_RANDOM_FULL_LADDER_SPAWN - 1;
  assert.ok(guardIndex > 0 && guardIndex < lastIndex);
  // Ceiling: pinned to the guardrail for the opening spawns, then climbs to the top.
  assert.equal(mysteryCaveRandomCombatWindow(0).maxIndex, guardIndex);
  assert.equal(mysteryCaveRandomCombatWindow(MYSTERY_CAVE_RANDOM_GUARDRAIL_SPAWNS - 1).maxIndex, guardIndex);
  assert.ok(mysteryCaveRandomCombatWindow(MYSTERY_CAVE_RANDOM_GUARDRAIL_SPAWNS).maxIndex > guardIndex);
  assert.ok(mysteryCaveRandomCombatWindow(20).maxIndex < lastIndex);
  assert.equal(mysteryCaveRandomCombatWindow(topIndex).maxIndex, lastIndex);
  // Floor: zero for the whole ramp (lucky runs), then climbs so runs still end.
  assert.equal(mysteryCaveRandomCombatWindow(topIndex).minIndex, 0);
  assert.ok(mysteryCaveRandomCombatWindow(topIndex + 20).minIndex > 0);
  const early = buildMysteryCaveRandomPlanEntry(1, 0);
  const late = buildMysteryCaveRandomPlanEntry(1, 30);
  assert.ok(visuals.includes(early.templateId));
  assert.ok(donors.includes(early.combatTemplateId));
  assert.ok(donors.includes(late.combatTemplateId));
  // Stats are flat jitter during the ramp so they never compound with the window.
  assert.equal(mysteryCaveRandomStatMultiplier(30, () => 1), mysteryCaveRandomStatMultiplier(0, () => 1));
  assert.ok(mysteryCaveRandomStatMultiplier(0, () => 1) <= 1.25);
  assert.ok(
    mysteryCaveRandomStatMultiplier(topIndex + 20, () => 1) > mysteryCaveRandomStatMultiplier(topIndex, () => 1),
  );
  for (let seed = 1; seed <= 200; seed += 1) {
    for (let spawn = 0; spawn < MYSTERY_CAVE_RANDOM_GUARDRAIL_SPAWNS; spawn += 1) {
      const combatId = buildMysteryCaveRandomPlanEntry(seed, spawn).combatTemplateId;
      assert.ok(
        donors.indexOf(combatId) <= guardIndex,
        `spawn ${spawn} rolled past the guardrail (${combatId})`,
      );
    }
  }
  let luckyRolls = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const combatId = buildMysteryCaveRandomPlanEntry(seed, 30).combatTemplateId;
    if (donors.indexOf(combatId) <= guardIndex) luckyRolls += 1;
  }
  assert.ok(luckyRolls >= 60, `wave 31 should still roll easy donors often (got ${luckyRolls}/200)`);
  // Payout ceilings are a flat amount per kill, and the run rolls 1..ceiling once.
  assert.deepEqual(mysteryCaveRandomGoldRange(0), { min: 0, max: 0 });
  assert.deepEqual(mysteryCaveRandomGoldRange(1), { min: 1, max: 25_000 });
  assert.deepEqual(mysteryCaveRandomGoldRange(10), { min: 1, max: 250_000 });
  assert.deepEqual(mysteryCaveRandomGoldRange(60), { min: 1, max: 1_500_000 });
  assert.equal(mysteryCaveRandomExperienceRange(0).max, 0);
  assert.equal(mysteryCaveRandomExperienceRange(10).min, 1);
  // One more kill must never lower the XP ceiling. The anchor is derived from the
  // normal cave's wave ladder, which is ordered by difficulty rather than XP, so
  // reading a single wave used to make 24 kills pay 46% less than 23.
  let previousCeiling = 0;
  for (let kills = 1; kills <= 200; kills += 1) {
    const ceiling = mysteryCaveRandomExperienceRange(kills).max;
    assert.ok(
      ceiling >= previousCeiling,
      `XP ceiling fell going from ${kills - 1} to ${kills} kills (${previousCeiling} -> ${ceiling})`,
    );
    previousCeiling = ceiling;
  }
  assert.ok(
    mysteryCaveBestBossExperienceUpToKills(24) >= mysteryCaveBestBossExperienceUpToKills(23),
    "the 24-kill anchor regression must stay fixed",
  );
  // The average roll must stay below the normal cave's XP for the same kills; the
  // fight tier (up to 4x) and the account XP rate both multiply on top.
  for (const kills of [10, 20, 45, 80]) {
    const average = (mysteryCaveRandomExperienceRange(kills).max / 2) * MYSTERY_CAVE_XP_MULTIPLIER;
    const ratio = average / mysteryCaveExperienceReward(kills, null, 0);
    assert.ok(ratio > 0.3 && ratio < 1, `XP vs normal cave drifted to ${ratio.toFixed(2)}x`);
  }
  assert.ok(mysteryCaveRandomExperienceRange(80).max > mysteryCaveRandomExperienceRange(45).max);
  const goldA = mysteryCaveRandomGoldReward(5, 0, 11);
  assert.equal(goldA, mysteryCaveRandomGoldReward(5, 0, 11), "payout must be stable for a seed");
  assert.ok(goldA >= 1 && goldA <= mysteryCaveRandomGoldRange(5).max);
  assert.equal(mysteryCaveRandomGoldReward(5, 1, 11), goldA * 2);
  assert.equal(mysteryCaveRandomExperienceReward(4, 2, 9), mysteryCaveRandomExperienceReward(4, 0, 9) * 3);
  assert.equal(mysteryCaveRandomGoldReward(0, 0, 3), 0);
  const oneKillGold = mysteryCaveRandomGoldReward(1, 0, 3);
  assert.ok(oneKillGold >= 1 && oneKillGold <= 25_000);
  // A single wide roll must actually produce low payouts, not cluster near the mean.
  let lowRolls = 0;
  for (let seed = 1; seed <= 300; seed += 1) {
    if (mysteryCaveRandomGoldReward(40, 0, seed) < mysteryCaveRandomGoldRange(40).max * 0.25) lowRolls += 1;
  }
  assert.ok(lowRolls > 30, `deep runs must still be able to pay badly (got ${lowRolls}/300)`);
  const swarm = { mysteryCaveRandom: true, mysteryCaveRandomSeed: 7, spawnPlan: [] };
  ensureMysteryCaveRandomSpawnPlan(swarm, 2);
  assert.equal(swarm.spawnPlan.length, 3);
  assert.equal(swarm.spawnPlan[2].waveIndex, 2);
});
