/**
 * Headless XP/hour comparison — uses battleData XP math + simplified combat loop.
 * Not a full app.js sim; useful for balance trends. Re-run after combat changes.
 */
import {
  PHASE1_ENEMY_TEMPLATES,
  PHASE1_ZONES,
} from "../src/phase1Data.js";
import {
  attackDelayMs,
  crystalAdjustedExperience,
  crystalPlayerBaseStats,
  rollDamage,
} from "../src/battleData.js";
import {
  GROUP_DUNGEON_SWARM_SPAWN_MS,
  GROUP_DUNGEON_WAVE_FIELD_CAP,
  GROUP_DUNGEON_WAVE_INSTANT_CAP,
  GROUP_DUNGEON_WAVE_REFILL_BATCH,
  GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS,
  GROUP_DUNGEON_WAVE_REFILL_THRESHOLD,
  GROUP_DUNGEON_WAVES_PER_FLOOR,
  groupDungeonWaveSpawnCount,
} from "../src/groupDungeonSwarm.js";

const HOUR_MS = 60 * 60 * 1000;
const SIM_MS = HOUR_MS;
const SEED = 0x1d4e5;
const PLAYER_LEVEL = 50;
const EXP_RATE = 1;
const RESPawn_MS = 1400;
const WALK_SPEED = 96;
const RUN_SPEED = 192;
const TRAVEL_WALK_DISTANCE = 96;
const WARRIOR_RANGE = 52;
const ARENA_SPAWN_DISTANCE = 180;

const ENEMY_BY_ID = Object.fromEntries(PHASE1_ENEMY_TEMPLATES.map((e) => [e.id, e]));
const ZONE_BY_ID = Object.fromEntries(PHASE1_ZONES.map((z) => [z.id, z]));

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.trunc(Math.imul(t ^ (t >>> 15), 1 | t));
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function avgStat(stat) {
  if (Array.isArray(stat)) return ((Number(stat[0]) || 0) + (Number(stat[1]) || 0)) / 2;
  return Number(stat) || 0;
}

const GEAR_PRESETS = {
  Warrior: {
    maxHp: 2200,
    dc: [32, 48],
    mc: [0, 0],
    sc: [0, 0],
    ac: [4, 10],
    amc: [2, 8],
    accuracy: 12,
    agility: 15,
    luck: 3,
    attackSpeed: 2,
  },
  Wizard: {
    maxHp: 1400,
    dc: [0, 0],
    mc: [30, 44],
    sc: [0, 0],
    ac: [2, 6],
    amc: [4, 12],
    accuracy: 10,
    agility: 12,
    luck: 2,
    attackSpeed: 0,
  },
  Taoist: {
    maxHp: 1600,
    dc: [0, 0],
    mc: [0, 0],
    sc: [24, 38],
    ac: [3, 8],
    amc: [3, 10],
    accuracy: 11,
    agility: 14,
    luck: 2,
    attackSpeed: 1,
  },
};

function buildFighter(classId) {
  const preset = GEAR_PRESETS[classId] ?? GEAR_PRESETS.Warrior;
  const base = crystalPlayerBaseStats(classId, PLAYER_LEVEL);
  const attack = classId === "Wizard" ? preset.mc : classId === "Taoist" ? preset.sc : preset.dc;
  return {
    classId,
    level: PLAYER_LEVEL,
    hp: preset.maxHp,
    maxHp: preset.maxHp,
    attack,
    defence: { ac: preset.ac, amc: preset.amc },
    accuracy: preset.accuracy ?? base.accuracy,
    agility: preset.agility ?? base.agility,
    luck: preset.luck ?? 1,
    attackMs: attackDelayMs(preset.attackSpeed ?? 0, PLAYER_LEVEL),
    nextAttackAt: 0,
  };
}

function xpPerKill(baseXp, monsterLevel, partySize = 1) {
  const share = Math.max(1, partySize);
  const perShare = Math.floor(Math.max(0, baseXp) / share);
  return crystalAdjustedExperience(perShare, PLAYER_LEVEL, monsterLevel, true, EXP_RATE);
}

function travelMs(spawnDistance = ARENA_SPAWN_DISTANCE) {
  const distance = Math.max(0, spawnDistance - WARRIOR_RANGE);
  const walkDistance = Math.min(distance, TRAVEL_WALK_DISTANCE);
  const runDistance = Math.max(0, distance - walkDistance);
  return Math.round(walkDistance / WALK_SPEED * 1000 + runDistance / RUN_SPEED * 1000);
}

function pickZoneEnemy(zone, rng) {
  const ids = zone.enemyIds ?? [];
  const id = ids[pickInt(rng, 0, ids.length - 1)];
  return ENEMY_BY_ID[id];
}

function simulateSoloZone(zoneId, classId = "Warrior") {
  const zone = ZONE_BY_ID[zoneId];
  const rng = mulberry32(SEED ^ zoneId.length);
  const fighter = buildFighter(classId);
  let elapsed = 0;
  let xp = 0;
  let kills = 0;
  let deaths = 0;
  const spawnDistance = Number(zone.arenaSpawnDistance) > 0 ? zone.arenaSpawnDistance : ARENA_SPAWN_DISTANCE;

  while (elapsed < SIM_MS) {
    const template = pickZoneEnemy(zone, rng);
    if (!template) break;

    elapsed += travelMs(spawnDistance);
    if (elapsed >= SIM_MS) break;

    let enemyHp = template.maxHp;
    let playerHp = fighter.maxHp;
    let nextPlayer = 0;
    let nextEnemy = template.attackMs ?? 2000;

    while (elapsed < SIM_MS && enemyHp > 0 && playerHp > 0) {
      const dt = Math.min(nextPlayer, nextEnemy, 50);
      elapsed += dt;
      nextPlayer -= dt;
      nextEnemy -= dt;

      if (nextPlayer <= 0) {
        const dmg = rollDamage(fighter.attack, template.ac ?? template.amc, fighter.luck);
        enemyHp -= dmg;
        nextPlayer = fighter.attackMs;
      }
      if (enemyHp <= 0) break;
      if (nextEnemy <= 0) {
        const dmg = rollDamage(template.dc ?? template.mc ?? template.sc, fighter.defence.ac, template.luck ?? 0);
        playerHp -= dmg;
        nextEnemy = template.attackMs ?? 2000;
      }
    }

    if (playerHp <= 0) {
      deaths += 1;
      elapsed += 5000;
      continue;
    }

    kills += 1;
    xp += xpPerKill(template.experience ?? 0, template.level ?? 0, 1);
    elapsed += RESPawn_MS;
  }

  return { zoneId, label: zone.label, mode: "solo", partySize: 1, classId, xp, kills, deaths, hours: elapsed / HOUR_MS };
}

function simulateBddParty(partyClasses = ["Warrior", "Wizard", "Taoist"]) {
  const zone = ZONE_BY_ID["zone-bdd-1"];
  const rng = mulberry32(SEED ^ 0xBDD);
  const party = partyClasses.map((classId) => buildFighter(classId));
  const partySize = party.length;

  let elapsed = 0;
  let xpLeader = 0;
  let kills = 0;
  let deaths = 0;
  let waveNumber = 1;
  let spawnedThisWave = 0;
  let killedThisWave = 0;
  let targetThisWave = groupDungeonWaveSpawnCount(1);
  let nextSpawnAt = 500;
  const enemies = [];

  function pickEnemyTemplate() {
    const id = pickInt(rng, 0, 1) === 0 ? 288 : 289;
    return ENEMY_BY_ID[id];
  }

  function spawnEnemy(now) {
    const t = pickEnemyTemplate();
    enemies.push({
      template: t,
      hp: t.maxHp,
      nextAttackAt: now + (t.attackMs ?? 2000),
    });
    spawnedThisWave += 1;
  }

  function startWave(now) {
    spawnedThisWave = 0;
    killedThisWave = 0;
    targetThisWave = groupDungeonWaveSpawnCount(waveNumber);
    nextSpawnAt = now + 500;
    if (targetThisWave <= GROUP_DUNGEON_WAVE_INSTANT_CAP) {
      while (spawnedThisWave < targetThisWave && enemies.length < GROUP_DUNGEON_WAVE_FIELD_CAP) {
        spawnEnemy(now);
      }
    }
  }

  function waveOutstanding() {
    return Math.max(0, targetThisWave - killedThisWave - enemies.length);
  }

  function maybeRefill(now) {
    if (waveOutstanding() <= 0) return;
    const living = enemies.length;
    const fieldCap = GROUP_DUNGEON_WAVE_FIELD_CAP;
    if (living >= fieldCap) return;
    if (living >= GROUP_DUNGEON_WAVE_REFILL_THRESHOLD && targetThisWave > GROUP_DUNGEON_WAVE_INSTANT_CAP) return;
    if (now < nextSpawnAt && living > 0) return;
    const batch = Math.min(GROUP_DUNGEON_WAVE_REFILL_BATCH, waveOutstanding(), fieldCap - living);
    for (let i = 0; i < batch; i += 1) spawnEnemy(now);
    if (waveOutstanding() > 0) nextSpawnAt = now + GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS;
  }

  function onWaveCleared(now) {
    if (waveNumber >= GROUP_DUNGEON_WAVES_PER_FLOOR) {
      waveNumber = GROUP_DUNGEON_WAVES_PER_FLOOR + 1;
    } else {
      waveNumber += 1;
    }
    startWave(now);
  }

  startWave(0);

  while (elapsed < SIM_MS) {
    const dt = 50;
    elapsed += dt;

    maybeRefill(elapsed);

    for (const member of party) {
      if (elapsed < member.nextAttackAt) continue;
      const target = enemies.find((e) => e.hp > 0);
      if (!target) continue;
      const dmg = rollDamage(member.attack, target.template.ac ?? target.template.amc, member.luck);
      target.hp -= dmg;
      member.nextAttackAt = elapsed + member.attackMs;
      if (target.hp <= 0) {
        kills += 1;
        killedThisWave += 1;
        const idx = enemies.indexOf(target);
        if (idx >= 0) enemies.splice(idx, 1);
        xpLeader += xpPerKill(target.template.experience ?? 0, target.template.level ?? 0, partySize);
      }
    }

    for (const enemy of enemies) {
      if (elapsed < enemy.nextAttackAt) continue;
      const target = party[pickInt(rng, 0, party.length - 1)];
      const dmg = rollDamage(
        enemy.template.dc ?? enemy.template.mc ?? enemy.template.sc,
        target.defence.ac,
        enemy.template.luck ?? 0,
      );
      target.hp -= dmg;
      enemy.nextAttackAt = elapsed + (enemy.template.attackMs ?? 2000);
    }

    if (party.every((m) => m.hp <= 0)) {
      for (const m of party) {
        m.hp = m.maxHp;
      }
      deaths += 1;
      elapsed += 10000;
    }

    if (waveOutstanding() <= 0 && enemies.length === 0) {
      onWaveCleared(elapsed);
    }
  }

  return {
    zoneId: zone.id,
    label: zone.label,
    mode: "bdd-party",
    partySize,
    partyClasses,
    xp: xpLeader,
    kills,
    deaths,
    hours: elapsed / HOUR_MS,
    finalWave: waveNumber,
  };
}

function reportRow(result) {
  const xpPerHour = Math.round(result.xp / result.hours);
  const killsPerHour = Math.round(result.kills / result.hours);
  return {
    ...result,
    xpPerHour,
    killsPerHour,
    xpPerKill: result.kills ? Math.round(result.xp / result.kills) : 0,
  };
}

const soloZones = [
  "zone-stone-temple-2",
  "zone-prajna-temple-2",
  "zone-zuma-temple-2",
  "zone-prajna-cave-2",
];

const results = [
  simulateBddParty(["Warrior", "Wizard", "Taoist"]),
  simulateBddParty(["Warrior"]),
  ...soloZones.map((id) => simulateSoloZone(id, "Warrior")),
].map(reportRow);

results.sort((a, b) => b.xpPerHour - a.xpPerHour);

console.log("XP comparison sim — 1 hour each, level 50 geared chars, no rebirth XP upgrades");
console.log("Gear preset: Warrior DC 32-48, Wizard MC 30-44, Taoist SC 24-38 (mid-game BDD-ready)");
console.log(`Combat: rollDamage RNG, party XP split floor(total/n), seed ${SEED}`);
console.log("");
console.log("Rank | XP/hr   | Kills/hr | XP/kill | Mode        | Zone");
console.log("-----|---------|----------|---------|-------------|-----");
for (let i = 0; i < results.length; i += 1) {
  const r = results[i];
  const mode = r.mode === "bdd-party" ? `BDD x${r.partySize}` : "Solo";
  console.log(
    `${String(i + 1).padStart(4)} | ${String(r.xpPerHour).padStart(7)} | ${String(r.killsPerHour).padStart(8)} | ${String(r.xpPerKill).padStart(7)} | ${mode.padEnd(11)} | ${r.label}`,
  );
}

const bdd3 = results.find((r) => r.mode === "bdd-party" && r.partySize === 3);
const bestSolo = results.filter((r) => r.mode === "solo").sort((a, b) => b.xpPerHour - a.xpPerHour)[0];
console.log("");
if (bdd3 && bestSolo) {
  const ratio = (bdd3.xpPerHour / bestSolo.xpPerHour).toFixed(2);
  console.log(`BDD 3-man (${bdd3.xpPerHour} XP/hr) vs best solo ${bestSolo.label} (${bestSolo.xpPerHour} XP/hr): ${ratio}x`);
}
