import { attackDelayMs, CRYSTAL_MAX_LUCK, statRange } from "../battleData.js";

/** Default minimum away-time before offline progress runs (30s). */
export const DEFAULT_OFFLINE_PROGRESS_MIN_MS = 30 * 1000;

/** Default maximum simulated offline window (8h). */
export const DEFAULT_OFFLINE_PROGRESS_CAP_MS = 8 * 60 * 60 * 1000;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * @param {number} savedAt
 * @param {number} nowMs
 * @returns {number | null} elapsed ms, or null when savedAt is missing
 */
export function computeOfflineElapsedMs(savedAt, nowMs) {
  const saved = Math.max(0, Math.trunc(Number(savedAt) || 0));
  if (!saved) return null;
  return Math.max(0, Math.trunc(Number(nowMs) || 0) - saved);
}

/**
 * @param {number} savedAt
 * @param {number} nowMs
 * @param {object} [options]
 * @param {number} [options.minMs]
 * @param {number} [options.capMs]
 * @returns {{ elapsedMs: number, rawElapsedMs: number, capped: boolean, savedAt: number } | null}
 */
export function buildOfflineProgressTiming(savedAt, nowMs, options = {}) {
  const minMs = Math.max(0, Math.trunc(Number(options.minMs) || DEFAULT_OFFLINE_PROGRESS_MIN_MS));
  const capMs = Math.max(minMs, Math.trunc(Number(options.capMs) || DEFAULT_OFFLINE_PROGRESS_CAP_MS));
  const rawElapsedMs = computeOfflineElapsedMs(savedAt, nowMs);
  if (rawElapsedMs == null || rawElapsedMs < minMs) return null;
  return {
    elapsedMs: Math.min(rawElapsedMs, capMs),
    rawElapsedMs,
    capped: rawElapsedMs > capMs,
    savedAt: Math.max(0, Math.trunc(Number(savedAt) || 0)),
  };
}

/**
 * Decide whether a save snapshot qualifies for offline mining or zone progress.
 * Pure given snapshot + clock + injected zone/group-dungeon helpers.
 *
 * @param {object} snapshot
 * @param {number} nowMs
 * @param {object} [options]
 * @param {string[]} [options.zoneIds]
 * @param {string | null} [options.miningZoneId]
 * @param {number} [options.minMs]
 * @param {number} [options.capMs]
 * @param {(run: unknown, activeZoneId: string | null | undefined, classId: string | null | undefined) => object | null} [options.sanitizeGroupDungeonRun]
 */
export function resolvePendingOfflineProgress(snapshot, nowMs, options = {}) {
  const {
    zoneIds = [],
    miningZoneId = null,
    sanitizeGroupDungeonRun = () => null,
  } = options;

  const timing = buildOfflineProgressTiming(snapshot?.savedAt, nowMs, options);
  if (!timing) return null;

  const activeZoneId = snapshot?.game?.activeZoneId;
  const zoneExists = zoneIds.includes(activeZoneId);
  const savedHp = finiteNumberOrNull(snapshot?.battle?.playerHp);
  const wasRunning = snapshot?.battle?.running !== false;
  const wasPaused = snapshot?.battle?.paused === true;
  const activeCharacterId = snapshot?.activeCharacterId ?? snapshot?.battle?.combatClass;

  const pending = { ...timing };
  const groupDungeonRun = sanitizeGroupDungeonRun(snapshot?.groupDungeonRun, activeZoneId, activeCharacterId);
  if (groupDungeonRun?.zoneId === activeZoneId) pending.groupDungeonRun = groupDungeonRun;

  if (snapshot?.game?.mode === "mining" && activeZoneId === miningZoneId && !wasPaused) {
    return { ...pending, kind: "mining" };
  }

  if (snapshot?.game?.mode !== "zone" || !zoneExists || !wasRunning || wasPaused) return null;
  if (savedHp != null && savedHp <= 0) return null;

  return { ...pending, kind: "zone" };
}

/**
 * Shift a future timestamp from simulated time to wall-clock time after offline catch-up.
 *
 * @param {number} value
 * @param {number} simulatedNow
 * @param {number} actualNow
 * @param {number} [maxRemainingMs=Infinity]
 */
export function rebaseTransientTimestamp(value, simulatedNow, actualNow, maxRemainingMs = Infinity) {
  const timestamp = Number(value) || 0;
  if (timestamp <= simulatedNow) return 0;
  const remaining = timestamp - simulatedNow;
  const cappedRemaining = Number.isFinite(maxRemainingMs)
    ? Math.min(remaining, Math.max(0, maxRemainingMs))
    : remaining;
  return cappedRemaining > 0 ? actualNow + cappedRemaining : 0;
}

/**
 * @param {Map<string, number>} map
 * @param {string} label
 * @param {number} [amount=1]
 */
export function incrementReportCount(map, label, amount = 1) {
  map.set(label, (map.get(label) ?? 0) + amount);
}

/**
 * @param {[string, number][]} entries
 * @param {number} [limit=3]
 */
export function reportEntriesText(entries, limit = 3) {
  return entries
    .slice(0, limit)
    .map(([label, count]) => `${label}${count > 1 ? ` x${count}` : ""}`)
    .join(", ");
}

/**
 * @param {Map<string, number>} map
 * @param {number} [limit=3]
 */
export function reportCountText(map, limit = 3) {
  return reportEntriesText([...map.entries()], limit);
}

/**
 * @param {{ minSlot: number, maxSlot: number, itemId: string }[]} oreDrops
 * @param {number} totalSlots
 * @param {() => number} [rng]
 * @param {string} [fallbackItemId="silver-ore"]
 */
export function rollMiningOreItemId(oreDrops, totalSlots, rng = Math.random, fallbackItemId = "silver-ore") {
  const slots = Math.max(1, Math.trunc(Number(totalSlots) || 1));
  const slot = 1 + Math.floor(rng() * slots);
  for (const drop of oreDrops) {
    if (slot >= drop.minSlot && slot <= drop.maxSlot) return drop.itemId;
  }
  return fallbackItemId;
}

/**
 * @param {() => number} [rng]
 * @param {number} [maxPurity=10]
 * @param {number} [minPurity=1]
 */
export function rollMiningOrePurity(rng = Math.random, maxPurity = 10, minPurity = 1) {
  const cap = Math.max(1, Math.trunc(Number(maxPurity) || 10));
  const min = Math.max(1, Math.min(cap, Math.trunc(Number(minPurity) || 1)));
  const span = cap - min + 1;
  return min + Math.floor(rng() * span);
}

/**
 * Pure offline mining swing simulation (inventory mutation via callback).
 *
 * @param {number} limitMs
 * @param {object} options
 * @param {number} options.swingCycleMs
 * @param {number} options.hitChance
 * @param {boolean} [options.capped]
 * @param {() => number} [options.rng]
 * @param {() => { itemId: string, purity: number }} [options.rollOre]
 * @param {(ore: { itemId: string, purity: number }) => string} [options.formatOreLabel]
 * @param {(ore: { itemId: string, purity: number }) => boolean} [options.tryAddOre]
 */
export function simulateOfflineMiningSwings(limitMs, options) {
  const swingCycleMs = Math.max(1, Math.trunc(Number(options.swingCycleMs) || 1));
  const hitChance = Math.max(0, Math.min(1, Number(options.hitChance) || 0));
  const rng = options.rng ?? Math.random;
  const safeLimitMs = Math.max(0, Math.trunc(Number(limitMs) || 0));

  let simMs = 0;
  let swings = 0;
  let hits = 0;
  const drops = new Map();
  const ignoredDrops = new Map();

  while (simMs + swingCycleMs <= safeLimitMs) {
    simMs += swingCycleMs;
    swings += 1;
    if (rng() >= hitChance) continue;
    hits += 1;
    const ore = options.rollOre?.() ?? { itemId: "silver-ore", purity: 1 };
    const label = options.formatOreLabel?.(ore) ?? ore.itemId;
    const added = options.tryAddOre?.(ore) !== false;
    incrementReportCount(added ? drops : ignoredDrops, label);
  }

  return {
    kind: "mining",
    elapsedMs: simMs,
    swings,
    hits,
    drops,
    ignoredDrops,
    capped: Boolean(options.capped),
  };
}

/**
 * Time to walk/run from spawn distance to attack range (ms).
 *
 * @param {number} distance px between spawn and attack range
 * @param {object} [options]
 * @param {number} [options.walkCap] px walked before running
 * @param {number} [options.playerSpeed] walk speed px/s
 * @param {number} [options.runSpeed] run speed px/s
 */
export function computeOfflineTravelTimeMs(distance, options = {}) {
  const safeDistance = Math.max(0, Number(distance) || 0);
  const walkCap = Math.max(0, Number(options.walkCap) || 0);
  const playerSpeed = Math.max(1, Number(options.playerSpeed) || 1);
  const runSpeed = Math.max(1, Number(options.runSpeed) || 1);
  const walkDistance = Math.min(safeDistance, walkCap);
  const runDistance = Math.max(0, safeDistance - walkCap);
  return Math.round((walkDistance / playerSpeed + runDistance / runSpeed) * 1000);
}

/**
 * Merge one offline kill's rewards into an offline progress report.
 *
 * @param {object} report
 * @param {object} rewards
 * @param {number} [rewards.xp]
 * @param {number} [rewards.gold]
 * @param {number[]} [rewards.levels]
 * @param {string[]} [rewards.addedDropLabels]
 * @param {string[]} [rewards.ignoredDropLabels]
 */
export function recordOfflineKillRewards(report, rewards = {}) {
  report.kills = (report.kills ?? 0) + 1;
  report.xp = (report.xp ?? 0) + Math.max(0, Math.trunc(Number(rewards.xp) || 0));
  report.gold = (report.gold ?? 0) + Math.max(0, Math.trunc(Number(rewards.gold) || 0));
  if (Array.isArray(rewards.levels) && rewards.levels.length) {
    report.levels = [...(report.levels ?? []), ...rewards.levels];
  }
  if (!report.drops) report.drops = new Map();
  if (!report.ignoredDrops) report.ignoredDrops = new Map();
  for (const label of rewards.addedDropLabels ?? []) {
    incrementReportCount(report.drops, label);
  }
  for (const label of rewards.ignoredDropLabels ?? []) {
    incrementReportCount(report.ignoredDrops, label);
  }
}

/**
 * Approximate hit chance used by offline group-dungeon catch-up.
 */
export function offlineGroupHitChance(accuracy, agility) {
  const acc = Math.max(0, Math.trunc(Number(accuracy) || 0));
  const agi = Math.max(0, Math.trunc(Number(agility) || 0));
  return Math.max(0.05, Math.min(0.98, (acc + 1) / (agi + 1)));
}

/**
 * Average expected damage per swing for offline group simulation.
 */
export function offlineGroupAverageDamage(attackStat, defenceStat, luck = 0) {
  const [attackMin, attackMax] = statRange(attackStat);
  const [defenceMin, defenceMax] = statRange(defenceStat);
  const attackAvg = (attackMin + attackMax) / 2;
  const defenceAvg = (defenceMin + defenceMax) / 2;
  const luckBonus = Math.max(0, Math.min(CRYSTAL_MAX_LUCK, Number(luck) || 0)) / Math.max(1, CRYSTAL_MAX_LUCK);
  const luckyAttack = attackAvg + (attackMax - attackAvg) * luckBonus;
  return Math.max(1, luckyAttack - defenceAvg);
}

/** Support buffs/heals before weapon when Taoist is player-tanking offline. */
export const OFFLINE_TAOIST_SUPPORT_SPELL_ORDER = [
  "Healing",
  "MassHealing",
  "SoulShield",
  "BlessedArmour",
  "EnergyShield",
  "HealingCircle",
  "UltimateEnhancer",
  "PetEnhancer",
  "Poisoning",
  "PoisonCloud",
  "Curse",
  "Plague",
];

/** Pet-tank path tries support spells first, then SoulFireBall. */
export const OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER = [
  ...OFFLINE_TAOIST_SUPPORT_SPELL_ORDER,
  "SoulFireBall",
];

/**
 * @param {Record<string, boolean>} availability spellId -> usable now
 * @param {string[]} [order]
 */
export function nextOfflineTaoistSupportSpellId(availability, order = OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER) {
  return order.find((spellId) => availability[spellId]) ?? null;
}

/**
 * Maps a queued Taoist combat spell to its offline handler kind.
 *
 * @param {string | null | undefined} spellId
 * @returns {"soulFireBall" | "healing" | "massHeal" | "healingCircle" | "poisoning" | "poisonCloud" | "summon" | "defenceBuff" | "energyShield" | "ultimateEnhancer" | "petEnhancer" | null}
 */
export function offlineTaoistQueuedSpellKind(spellId) {
  switch (spellId) {
    case "SoulFireBall":
      return "soulFireBall";
    case "Healing":
      return "healing";
    case "MassHealing":
      return "massHeal";
    case "HealingCircle":
      return "healingCircle";
    case "Poisoning":
      return "poisoning";
    case "PoisonCloud":
      return "poisonCloud";
    case "Plague":
      return "plague";
    case "Curse":
      return "curse";
    case "SummonSkeleton":
    case "SummonShinsu":
    case "SummonHolyDeva":
      return "summon";
    case "SoulShield":
    case "BlessedArmour":
      return "defenceBuff";
    case "EnergyShield":
      return "energyShield";
    case "UltimateEnhancer":
      return "ultimateEnhancer";
    case "PetEnhancer":
      return "petEnhancer";
    default:
      return null;
  }
}

/** Autocast summon priority during offline catch-up (skeleton before shinsu before holy deva). */
export const OFFLINE_TAOIST_AUTO_SUMMON_ORDER = ["SummonSkeleton", "SummonShinsu", "SummonHolyDeva"];

/**
 * @param {Record<string, boolean>} availability spellId -> usable now
 * @param {string[]} [order]
 */
export function nextOfflineTaoistAutoSummonId(availability, order = OFFLINE_TAOIST_AUTO_SUMMON_ORDER) {
  return order.find((spellId) => availability[spellId]) ?? null;
}

/**
 * @param {string} spellId
 * @param {{ skeletonMs: number, shinsuMs: number, holyDevaMs?: number }} delays
 */
export function offlineTaoistSummonPetDelayMs(spellId, delays) {
  if (spellId === "SummonHolyDeva") return delays.holyDevaMs ?? delays.skeletonMs;
  if (spellId === "SummonShinsu") return delays.shinsuMs;
  return delays.skeletonMs;
}

/** Wizard defence spell checked before attack spells during offline catch-up. */
export const OFFLINE_WIZARD_DEFENCE_SPELL_ID = "MagicShield";

/**
 * Offline wizard turn priority: autocast Magic Shield, queued Magic Shield, then cast or weapon.
 *
 * @param {object} phases
 * @param {boolean} [phases.defenceAuto]
 * @param {boolean} [phases.defenceQueued]
 * @param {boolean} [phases.hasAttackSpell]
 * @param {boolean} [phases.weaponFallback]
 * @returns {"defenceAuto" | "defenceQueued" | "cast" | "weapon" | "idle"}
 */
export function resolveOfflineWizardTurnPhase(phases) {
  if (phases.defenceAuto) return "defenceAuto";
  if (phases.defenceQueued) return "defenceQueued";
  if (!phases.hasAttackSpell || phases.weaponFallback) return "weapon";
  if (phases.hasAttackSpell) return "cast";
  return "idle";
}

/**
 * @param {number} incomingDps
 * @param {number} chunkMs
 */
export function computeOfflineIncomingChunkDamage(incomingDps, chunkMs) {
  const dps = Math.max(0, Number(incomingDps) || 0);
  const chunk = Math.max(0, Math.trunc(Number(chunkMs) || 0));
  return Math.max(0, Math.round(dps * (chunk / 1000)));
}

/**
 * Approximate incoming DPS for offline group-dungeon catch-up.
 *
 * @param {object} options
 * @param {number} options.attackers
 * @param {unknown} options.enemyAttackStat
 * @param {number} [options.enemyLuck]
 * @param {number} [options.enemyAttackMs]
 * @param {number} [options.enemyAccuracy]
 * @param {"AC" | "MAC"} [options.enemyDefenceType]
 * @param {unknown} options.targetDefenceStat
 * @param {number} [options.targetAgility]
 */
export function computeOfflineGroupIncomingDps(options) {
  const attackers = Math.max(0, Math.trunc(Number(options.attackers) || 0));
  const damage = offlineGroupAverageDamage(
    options.enemyAttackStat,
    options.targetDefenceStat,
    options.enemyLuck,
  );
  const defenceType = options.enemyDefenceType === "MAC" ? "MAC" : "AC";
  const hitChance = defenceType === "MAC"
    ? 0.85
    : offlineGroupHitChance(options.enemyAccuracy, options.targetAgility);
  const attackMs = Math.max(500, Math.trunc(Number(options.enemyAttackMs) || 1500));
  return attackers * damage * hitChance * 1000 / attackMs;
}

/**
 * Approximate member DPS for offline group-dungeon catch-up.
 *
 * @param {object} member
 * @param {object} enemy
 */
export function computeOfflineGroupMemberDps(member, enemy) {
  const physical = offlineGroupAverageDamage(member.dc, enemy.ac, member.luck)
    * offlineGroupHitChance(member.accuracy, enemy.agility);
  const physicalDelay = Math.max(500, attackDelayMs(member.attackSpeed ?? 0));
  let dps = physical * 1000 / physicalDelay;
  const magic = member.classId === "Wizard"
    ? offlineGroupAverageDamage(member.mc, enemy.amc, member.luck) * 1.15
    : member.classId === "Taoist"
      ? offlineGroupAverageDamage(member.sc, enemy.amc, member.luck) * 0.85
      : 0;
  if (magic > 0 && (member.mp ?? 0) > 0) {
    const castDelay = member.classId === "Wizard" ? 1800 : 2200;
    dps += magic * offlineGroupHitChance(member.accuracy, enemy.agility) * 1000 / castDelay;
  }
  return Math.max(0.1, dps);
}

/**
 * @param {object[]} members
 * @param {object} enemy
 */
export function computeOfflineGroupPartyDps(members, enemy) {
  return (members ?? [])
    .filter((member) => member.alive && member.hp > 0)
    .reduce((sum, member) => sum + computeOfflineGroupMemberDps(member, enemy), 0);
}

/**
 * @param {number} enemyMaxHp
 * @param {number} partyDps
 * @param {number} remainingMs
 */
export function estimateOfflineGroupKillDurationMs(enemyMaxHp, partyDps, remainingMs) {
  const dps = Math.max(0.1, Number(partyDps) || 0);
  const hp = Math.max(0, Number(enemyMaxHp) || 0);
  const remaining = Math.max(0, Math.trunc(Number(remainingMs) || 0));
  const estimatedKillMs = Math.max(300, Math.ceil((hp / dps) * 1000));
  return { durationMs: Math.min(remaining, estimatedKillMs), estimatedKillMs };
}

/**
 * @param {number} currentHp
 * @param {number} damage
 */
export function resolveOfflineGroupIncomingChunk(currentHp, damage) {
  const amount = Math.max(0, Math.trunc(Number(damage) || 0));
  const hp = Math.max(0, Math.trunc(Number(currentHp) || 0));
  if (amount <= 0) return { damage: 0, nextHp: hp, died: false };
  const nextHp = Math.max(0, hp - amount);
  return { damage: amount, nextHp, died: nextHp <= 0 };
}

/**
 * @param {number} elapsedMs
 * @param {object} enemy
 * @param {boolean} partyDied
 * @param {boolean} killed
 */
export function buildOfflineGroupKillResult(elapsedMs, enemy, partyDied, killed) {
  return {
    elapsedMs: Math.max(0, Math.trunc(Number(elapsedMs) || 0)),
    partyDied: Boolean(partyDied),
    killed: Boolean(killed),
    enemy,
  };
}

/**
 * Pure offline group-dungeon kill catch-up loop; monolith supplies party state callbacks.
 *
 * @param {object} options
 * @param {number} options.remainingMs
 * @param {number} [options.startedAt=0]
 * @param {number} [options.chunkMs=1000]
 * @param {object} options.enemy
 * @param {object[]} [options.members]
 * @param {(now: number) => void} [options.onTick]
 * @param {() => object | null} [options.getFrontTarget]
 * @param {(enemy: object, target: object) => number} [options.getIncomingDps]
 * @param {(target: object, damage: number, now: number) => void} [options.onIncomingDamage]
 */
export function simulateOfflineGroupKillLoop(options) {
  const enemy = options.enemy;
  const partyDps = computeOfflineGroupPartyDps(options.members ?? [], enemy);
  const remaining = Math.max(0, Math.trunc(Number(options.remainingMs) || 0));
  const { durationMs, estimatedKillMs } = estimateOfflineGroupKillDurationMs(
    enemy?.maxHp ?? 0,
    partyDps,
    remaining,
  );
  const chunkCap = Math.max(1, Math.trunc(Number(options.chunkMs) || 1000));
  const startedAt = Math.trunc(Number(options.startedAt) || 0);
  let elapsed = 0;

  while (elapsed < durationMs) {
    const chunk = Math.min(chunkCap, durationMs - elapsed);
    const now = startedAt + elapsed + chunk;
    options.onTick?.(now);

    const target = options.getFrontTarget?.();
    if (!target) return buildOfflineGroupKillResult(elapsed, enemy, true, false);

    const incomingDps = options.getIncomingDps?.(enemy, target) ?? 0;
    const damage = computeOfflineIncomingChunkDamage(incomingDps, chunk);
    if (damage > 0) options.onIncomingDamage?.(target, damage, now);

    elapsed += chunk;
    if (!options.getFrontTarget?.()) return buildOfflineGroupKillResult(elapsed, enemy, true, false);
  }

  return buildOfflineGroupKillResult(elapsed, enemy, false, durationMs >= estimatedKillMs);
}

/**
 * @param {object} [pending]
 */
export function createOfflineZoneReport(pending = {}) {
  return {
    elapsedMs: 0,
    capped: Boolean(pending.capped),
    kills: 0,
    xp: 0,
    gold: 0,
    levels: [],
    drops: new Map(),
    ignoredDrops: new Map(),
    potionsUsed: new Map(),
    damageTaken: 0,
    diedAtMs: 0,
    finalEnemy: null,
  };
}

/**
 * @param {number} remainingMs
 * @param {number} respawnDelayMs
 */
export function computeOfflineRespawnDelay(remainingMs, respawnDelayMs) {
  const remaining = Math.max(0, Math.trunc(Number(remainingMs) || 0));
  const delay = Math.max(0, Math.trunc(Number(respawnDelayMs) || 0));
  return Math.min(delay, remaining);
}

/**
 * Next simulation tick length inside one offline fight.
 */
export function computeOfflineFightTickDelta(nextPlayerAttack, nextEnemyAttack, nextPetAttack = Infinity) {
  const playerMs = Math.max(0, Math.trunc(Number(nextPlayerAttack) || 0));
  const enemyMs = Math.max(1, Math.trunc(Number(nextEnemyAttack) || 1));
  const petMs = Number.isFinite(nextPetAttack) ? Math.max(0, Number(nextPetAttack)) : Infinity;
  return Math.min(playerMs, enemyMs, petMs);
}

/**
 * @param {number} travelMs
 * @param {number} remainingMs
 */
export function computeOfflineFightTravelMs(travelMs, remainingMs) {
  const travel = Math.max(0, Math.trunc(Number(travelMs) || 0));
  const remaining = Math.max(0, Math.trunc(Number(remainingMs) || 0));
  return Math.min(travel, remaining);
}

/**
 * @param {number} elapsedMs
 * @param {number} delta
 * @param {number} remainingMs
 */
export function advanceOfflineFightTick(elapsedMs, delta, remainingMs) {
  const limit = Math.max(0, Math.trunc(Number(remainingMs) || 0));
  const current = Math.max(0, Math.trunc(Number(elapsedMs) || 0));
  const step = Math.max(0, Math.trunc(Number(delta) || 0));
  if (current + step > limit) {
    return { elapsedMs: limit, hitLimit: true };
  }
  return { elapsedMs: current + step, hitLimit: false };
}

/**
 * @param {object} template
 */
export function createOfflineFightEnemy(template) {
  return {
    ...template,
    hp: template.maxHp,
    mp: template.maxMp,
    poisons: [],
    debuffs: { slowUntil: 0, frozenUntil: 0 },
  };
}

/**
 * @param {number} elapsedMs
 * @param {object} enemy
 * @param {number} playerHp
 */
export function buildOfflineFightResult(elapsedMs, enemy, playerHp) {
  const hp = Math.max(0, Math.trunc(Number(playerHp) || 0));
  return {
    elapsedMs: Math.max(0, Math.trunc(Number(elapsedMs) || 0)),
    killed: (enemy?.hp ?? 0) <= 0,
    playerDied: hp <= 0,
    enemy,
  };
}

/**
 * Pure offline fight tick loop; monolith supplies stateful callbacks.
 *
 * @param {object} options
 * @param {number} options.remainingMs
 * @param {number} [options.startedAt=0]
 * @param {number} [options.travelMs=0]
 * @param {object} options.enemy
 * @param {number} [options.initialNextEnemyAttackMs]
 * @param {number} [options.maxGuard=5000]
 * @param {() => number} [options.getPlayerHp]
 * @param {(simNow: number) => number} [options.getPetAttackDelayMs]
 * @param {(enemy: object, now: number) => boolean} [options.isEnemyFrozen]
 * @param {(simNow: number) => void} [options.onTravelComplete]
 * @param {(now: number) => void} [options.onRecovery]
 * @param {(enemy: object, now: number) => boolean} [options.onPlayerAttack]
 * @param {(now: number) => void} [options.onPetAttack]
 * @param {(enemy: object, now: number) => void} [options.onEnemyAttack]
 * @param {(now: number) => number} [options.consumePlayerCooldownMs]
 * @param {(enemy: object, now: number) => number} [options.getNextEnemyAttackMs]
 */
export function simulateOfflineFightLoop(options) {
  const limit = Math.max(0, Math.trunc(Number(options.remainingMs) || 0));
  const startedAt = Math.trunc(Number(options.startedAt) || 0);
  const enemy = options.enemy;
  const maxGuard = Math.max(1, Math.trunc(Number(options.maxGuard) || 5000));
  const getPlayerHp = options.getPlayerHp ?? (() => 1);

  let elapsedMs = computeOfflineFightTravelMs(options.travelMs, limit);
  options.onTravelComplete?.(startedAt + elapsedMs);

  if (getPlayerHp() <= 0) return buildOfflineFightResult(elapsedMs, enemy, 0);
  if (elapsedMs >= limit) return buildOfflineFightResult(elapsedMs, enemy, getPlayerHp());

  let nextPlayerAttack = 0;
  let nextEnemyAttack = Math.max(
    1,
    Math.trunc(Number(options.initialNextEnemyAttackMs ?? enemy?.attackMs) || 2500),
  );
  let guard = 0;

  while (elapsedMs < limit && (enemy?.hp ?? 0) > 0 && getPlayerHp() > 0 && guard < maxGuard) {
    guard += 1;
    const nextPetAttack = options.getPetAttackDelayMs?.(startedAt + elapsedMs) ?? Infinity;
    const delta = computeOfflineFightTickDelta(nextPlayerAttack, nextEnemyAttack, nextPetAttack);
    const step = advanceOfflineFightTick(elapsedMs, delta, limit);
    if (step.hitLimit) {
      elapsedMs = step.elapsedMs;
      options.onRecovery?.(startedAt + elapsedMs);
      return buildOfflineFightResult(elapsedMs, enemy, getPlayerHp());
    }

    elapsedMs = step.elapsedMs;
    nextPlayerAttack -= delta;
    nextEnemyAttack -= delta;
    const now = startedAt + elapsedMs;
    options.onRecovery?.(now);
    if (getPlayerHp() <= 0) break;

    if (nextPlayerAttack <= 0) {
      if (options.onPlayerAttack?.(enemy, now)) {
        nextPlayerAttack += Math.max(0, Math.trunc(Number(options.consumePlayerCooldownMs?.(now)) || 0));
      }
    }
    if ((enemy?.hp ?? 0) <= 0) break;

    options.onPetAttack?.(now);
    if ((enemy?.hp ?? 0) <= 0) break;

    if (nextEnemyAttack <= 0 && !options.isEnemyFrozen?.(enemy, now)) {
      options.onEnemyAttack?.(enemy, now);
      nextEnemyAttack += Math.max(
        1,
        Math.trunc(Number(options.getNextEnemyAttackMs?.(enemy, now) ?? enemy?.attackMs) || 2500),
      );
      options.onRecovery?.(now);
    }
  }

  return buildOfflineFightResult(elapsedMs, enemy, getPlayerHp());
}

/**
 * Apply one offline fight result to a zone report and decide whether to continue.
 *
 * @param {object} report
 * @param {{ elapsedMs?: number, killed?: boolean, playerDied?: boolean, enemy?: object | null }} fightResult
 * @param {number} limitMs
 * @param {number} respawnDelayMs
 * @returns {{ status: "player_died" | "fight_incomplete" | "kill_complete", respawnMs?: number }}
 */
export function processOfflineZoneFightCycle(report, fightResult, limitMs, respawnDelayMs) {
  const limit = Math.max(0, Math.trunc(Number(limitMs) || 0));
  report.elapsedMs = Math.min(
    limit,
    (report.elapsedMs ?? 0) + Math.max(0, Math.trunc(Number(fightResult.elapsedMs) || 0)),
  );
  report.finalEnemy = fightResult.enemy ?? null;

  if (fightResult.playerDied) {
    report.diedAtMs = report.elapsedMs;
    return { status: "player_died" };
  }
  if (!fightResult.killed) {
    return { status: "fight_incomplete" };
  }

  const respawnMs = computeOfflineRespawnDelay(limit - report.elapsedMs, respawnDelayMs);
  report.finalEnemy = null;
  report.elapsedMs = Math.min(report.elapsedMs + respawnMs, limit);
  return { status: "kill_complete", respawnMs };
}

/**
 * @param {object} report
 * @param {number} limitMs
 * @param {number} [startedAt]
 */
export function finalizeOfflineZoneReport(report, limitMs, startedAt) {
  const limit = Math.max(0, Math.trunc(Number(limitMs) || 0));
  report.elapsedMs = Math.min(Math.max(0, Math.trunc(Number(report.elapsedMs) || 0)), limit);
  if (startedAt != null) report.simulatedEndedAt = startedAt + report.elapsedMs;
  return report;
}

/**
 * Pure offline zone loop used for characterization tests and gradual monolith extraction.
 *
 * @param {number} limitMs
 * @param {object} options
 * @param {object} [options.pending]
 * @param {number} [options.startedAt=0]
 * @param {number} [options.respawnDelayMs=1400]
 * @param {() => number} [options.getPlayerHp]
 * @param {(remainingMs: number) => object} [options.simulateFight]
 * @param {(report: object) => void} [options.onKill]
 * @param {(simNow: number, report: object) => void} [options.onRecovery]
 */
export function simulateOfflineZoneProgressLoop(limitMs, options = {}) {
  const limit = Math.max(0, Math.trunc(Number(limitMs) || 0));
  const report = createOfflineZoneReport(options.pending ?? {});
  const startedAt = Math.trunc(Number(options.startedAt) || 0);
  const respawnDelayMs = Math.max(0, Math.trunc(Number(options.respawnDelayMs) || 1400));
  const playerHp = options.getPlayerHp ?? (() => 1);

  report.simulatedStartedAt = startedAt;

  while (report.elapsedMs < limit && playerHp() > 0) {
    const remainingMs = limit - report.elapsedMs;
    const fightResult = options.simulateFight?.(remainingMs) ?? {
      elapsedMs: 0,
      killed: false,
      playerDied: false,
      enemy: null,
    };
    const step = processOfflineZoneFightCycle(report, fightResult, limit, respawnDelayMs);
    if (step.status === "player_died" || step.status === "fight_incomplete") break;
    options.onKill?.(report);
    options.onRecovery?.(startedAt + report.elapsedMs, report);
  }

  return finalizeOfflineZoneReport(report, limit, startedAt);
}

/**
 * Delay until the taoist pet's next offline swing inside one fight tick loop.
 *
 * @param {object | null | undefined} pet
 * @param {number} simNow
 * @param {object} [options]
 * @param {boolean} [options.pendingPetAttack]
 * @param {boolean} [options.shinsuShowPending]
 * @param {boolean} [options.outOfRange]
 */
export function computeOfflinePetAttackDelayMs(pet, simNow, options = {}) {
  if (!pet?.active) return Infinity;
  const readyIn = Math.max(0, (pet.nextAttackAt ?? 0) - simNow);
  if (readyIn > 0) return readyIn;
  if (options.pendingPetAttack) return 1;
  if (options.shinsuShowPending) return 1;
  if (options.outOfRange) return Infinity;
  return 0;
}
