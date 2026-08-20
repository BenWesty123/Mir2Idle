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
  isMysteryCaveEquipmentDropItem,
  mysteryCaveEquipmentDropEntries,
  rollMysteryCaveEquipmentReward,
  mysteryCaveTierLabel,
  mysteryCavePulledFightStartAt,
  mysteryCaveStatMultiplier,
} from "../src/mysteryCave.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    [256], // Wooma Taurus
    [279], // Bone Lord
    [272], // Zuma Taurus
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
  assert.equal(mysteryCaveRareOreCount(23), 115);
  assert.equal(mysteryCaveRareOreCount(2, 1), 20);
  assert.equal(mysteryCaveRareOreCount(2, 2), 30);
  assert.equal(mysteryCaveRareOreCount(2, 3), 40);
  assert.equal(mysteryCaveRareOreCount(23, 3), 460);
});

test("Mystery Cave sun potions are 2 small and 1 medium per boss kill times difficulty", () => {
  assert.deepEqual(mysteryCaveSunPotionCounts(0), { small: 0, medium: 0 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2), { small: 4, medium: 2 });
  assert.deepEqual(mysteryCaveSunPotionCounts(23), { small: 46, medium: 23 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2, 1), { small: 8, medium: 4 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2, 2), { small: 12, medium: 6 });
  assert.deepEqual(mysteryCaveSunPotionCounts(2, 3), { small: 16, medium: 8 });
  assert.deepEqual(mysteryCaveSunPotionCounts(23, 3), { small: 184, medium: 92 });
});

test("Mystery Cave gems are 1 per kill and orbs are 1 per 3 kills times difficulty", () => {
  assert.deepEqual(mysteryCaveGemOrbCounts(0), { gems: 0, orbs: 0 });
  assert.deepEqual(mysteryCaveGemOrbCounts(2), { gems: 2, orbs: 0 });
  assert.deepEqual(mysteryCaveGemOrbCounts(3), { gems: 3, orbs: 1 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10), { gems: 10, orbs: 3 });
  assert.deepEqual(mysteryCaveGemOrbCounts(23), { gems: 23, orbs: 7 });
  assert.deepEqual(mysteryCaveGemOrbCounts(2, 1), { gems: 4, orbs: 0 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10, 1), { gems: 20, orbs: 6 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10, 2), { gems: 30, orbs: 9 });
  assert.deepEqual(mysteryCaveGemOrbCounts(10, 3), { gems: 40, orbs: 12 });
  assert.deepEqual(mysteryCaveGemOrbCounts(23, 3), { gems: 92, orbs: 28 });
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
  assert.equal(mysteryCaveBenedictionOilCount(23), 23);
  assert.equal(mysteryCaveBenedictionOilCount(2, 1), 4);
  assert.equal(mysteryCaveBenedictionOilCount(2, 2), 6);
  assert.equal(mysteryCaveBenedictionOilCount(2, 3), 8);
  assert.equal(mysteryCaveBenedictionOilCount(23, 3), 92);
});

test("Mystery Cave Awakening Souls are 2 per boss kill times difficulty", () => {
  assert.equal(mysteryCaveAwakeningSoulCount(0), 0);
  assert.equal(mysteryCaveAwakeningSoulCount(2), 4);
  assert.equal(mysteryCaveAwakeningSoulCount(23), 46);
  assert.equal(mysteryCaveAwakeningSoulCount(2, 1), 8);
  assert.equal(mysteryCaveAwakeningSoulCount(2, 2), 12);
  assert.equal(mysteryCaveAwakeningSoulCount(2, 3), 16);
  assert.equal(mysteryCaveAwakeningSoulCount(23, 3), 184);
});

test("Mystery Cave Havoc Crystals are 1 per boss kill times difficulty", () => {
  assert.equal(mysteryCaveHavocCrystalCount(0), 0);
  assert.equal(mysteryCaveHavocCrystalCount(1), 1);
  assert.equal(mysteryCaveHavocCrystalCount(23), 23);
  assert.equal(mysteryCaveHavocCrystalCount(23, 1), 46);
  assert.equal(mysteryCaveHavocCrystalCount(23, 2), 69);
  assert.equal(mysteryCaveHavocCrystalCount(23, 3), 92);
});

test("Mystery Cave Black Iron is 1 per kill with purity by difficulty", () => {
  assert.equal(mysteryCaveBlackIronCount(0), 0);
  assert.equal(mysteryCaveBlackIronCount(2), 2);
  assert.equal(mysteryCaveBlackIronCount(23), 23);
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
  assert.equal(mysteryCaveGoldReward(23), 2_300_000);
  assert.equal(mysteryCaveGoldReward(2, 1), 400_000);
  assert.equal(mysteryCaveGoldReward(2, 2), 600_000);
  assert.equal(mysteryCaveGoldReward(2, 3), 800_000);
  assert.equal(mysteryCaveGoldReward(23, 3), 9_200_000);
  assert.equal(mysteryCaveTierLabel(0), "Normal");
  assert.equal(mysteryCaveTierLabel(1), "Empowered");
  assert.equal(mysteryCaveTierLabel(2), "Ascended");
  assert.equal(mysteryCaveTierLabel(3), "Awakened");
});

test("Mystery Cave EXP is kills times furthest-boss XP times difficulty times 10", () => {
  assert.equal(MYSTERY_CAVE_XP_MULTIPLIER, 10);
  assert.equal(mysteryCaveFurthestBossExperienceSource(8).name, "Yimoogi");
  assert.equal(mysteryCaveFurthestBossExperienceSource(8).xp, 20_000);
  assert.equal(mysteryCaveExperienceReward(8), 1_600_000);
  assert.equal(mysteryCaveExperienceReward(8, null, 1), 3_200_000);
  assert.equal(mysteryCaveExperienceReward(8, null, 2), 4_800_000);
  assert.equal(mysteryCaveExperienceReward(8, null, 3), 6_400_000);
  assert.equal(mysteryCaveExperienceReward(6), 900_000);
  assert.equal(mysteryCaveFurthestBossExperienceSource(6).name, "Minotaur King");
  assert.equal(mysteryCaveExperienceReward(23), 9_200_000);
  assert.equal(mysteryCaveExperienceReward(23, null, 3), 36_800_000);
  assert.equal(mysteryCaveFurthestBossExperienceSource(23).name, "Oma King");
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
  assert.equal(mysteryCaveDropLabelForRun(6), "Minotaur King");
  assert.equal(mysteryCaveDropLabelForRun(23), "Oma King");
  assert.equal(mysteryCaveDropLabelForRun(9), "Incarnated Wooma Taurus");
  assert.equal(mysteryCaveDropLabelForRun(1, mysteryCaveBestWaveFromKills(23)), "Oma King");
  const minotaur = mysteryCaveEquipmentDropEntries(BOSS_DROP_TABLE_BY_LABEL["Minotaur King"], (id) => byId.get(id));
  assert.ok(minotaur.length > 0);
  assert.equal(minotaur.some((row) => row.id === "awakening-soul"), false);
  assert.ok(minotaur.every((row) => isMysteryCaveEquipmentDropItem(byId.get(row.id))));
  const rolled = rollMysteryCaveEquipmentReward(6, null, 0, (id) => byId.get(id), () => 0);
  assert.equal(rolled.label, "Minotaur King");
  assert.equal(rolled.itemIds.length, 6);
  assert.ok(rolled.itemIds.every((id) => minotaur.some((row) => row.id === id)));
  const full = rollMysteryCaveEquipmentReward(23, null, 0, (id) => byId.get(id), () => 0);
  assert.equal(full.label, "Oma King");
  assert.equal(full.itemIds.length, 23);
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
  for (const label of ["Evil Snake", "Minotaur King", "Oma King", "Incarnated Zuma Taurus"]) {
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
