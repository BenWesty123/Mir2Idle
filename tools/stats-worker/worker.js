import { PANEL_HTML } from "./panelHtml.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

const BOSS_ZONE_IDS = new Set([
  "zone-wooma-temple-kr",
  "zone-bug-cave-kr",
  "zone-stone-temple-kr",
  "zone-zuma-temple-kr",
  "zone-prajna-cave-kr",
  "zone-prajna-temple-kr",
]);

// No legitimate character can exceed this level in the current prototype content.
const LEADERBOARD_MAX_VALID_LEVEL = 100;

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "*";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  return {
    "access-control-allow-origin": allowedOrigin === "*" ? origin : allowedOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function intValue(value, fallback = 0, max = 2147483647) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(max, number));
}

function textValue(value, maxLength = 80) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function characterClassValue(value) {
  const text = textValue(value, 24);
  if (!text) return null;
  return text.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || null;
}

function sanitizeBossKills(kills = {}) {
  const output = {};
  if (!kills || typeof kills !== "object" || Array.isArray(kills)) return output;
  for (const [zoneId, count] of Object.entries(kills)) {
    if (!BOSS_ZONE_IDS.has(zoneId)) continue;
    output[zoneId] = intValue(count);
  }
  return output;
}

function parseBossKills(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return sanitizeBossKills(value);
  if (typeof value === "string" && value.trim()) {
    try {
      return sanitizeBossKills(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return {};
}

function mergeBossKills(...sources) {
  const output = {};
  for (const source of sources) {
    for (const [zoneId, count] of Object.entries(source ?? {})) {
      output[zoneId] = Math.max(output[zoneId] ?? 0, intValue(count));
    }
  }
  return output;
}

function bossKillsTotal(kills) {
  return Object.values(kills).reduce((sum, count) => sum + intValue(count), 0);
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeStatRange(value) {
  if (!Array.isArray(value)) return [0, 0];
  return [intValue(value[0]), intValue(value[1])];
}

const EQUIPMENT_SLOT_IDS = new Set([
  "weapon", "armour", "helmet", "torch", "necklace", "braceletL",
  "braceletR", "ringL", "ringR", "amulet", "belt", "boots",
]);

function itemIdValue(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
  return cleaned || null;
}

const BONUS_STAT_RANGE_KEYS = ["dc", "mc", "sc", "ac", "amc"];
const BONUS_STAT_SCALAR_KEYS = [
  "hp", "mp", "accuracy", "agility", "luck", "attackSpeed",
  "poisonAttack", "freezing", "magicResist", "poisonResist",
  "healthRecovery", "poisonRecovery", "strong",
];

function signedIntValue(value, max = 99999) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return 0;
  return Math.max(-max, Math.min(max, number));
}

function normalizeBonusStatsPayload(value) {
  const source = parseJsonObject(value);
  const output = {};
  for (const key of BONUS_STAT_RANGE_KEYS) {
    const range = Array.isArray(source[key]) ? source[key] : [0, 0];
    output[key] = [signedIntValue(range[0]), signedIntValue(range[1])];
  }
  for (const key of BONUS_STAT_SCALAR_KEYS) {
    output[key] = signedIntValue(source[key]);
  }
  return output;
}

function normalizeEquipmentPayload(value) {
  const source = parseJsonObject(value);
  const output = {};
  for (const [slotId, entry] of Object.entries(source)) {
    if (!EQUIPMENT_SLOT_IDS.has(slotId)) continue;
    const itemId = itemIdValue(entry?.itemId ?? entry);
    if (!itemId) continue;
    output[slotId] = {
      itemId,
      smithLevel: intValue(entry?.smithLevel, 0, 99),
      weaponRefineLevel: intValue(entry?.weaponRefineLevel, 0, 99),
      gemCount: intValue(entry?.gemCount, 0, 99),
      bonusStats: normalizeBonusStatsPayload(entry?.bonusStats),
      smithBonusStats: normalizeBonusStatsPayload(entry?.smithBonusStats),
    };
  }
  return output;
}

function normalizeSkillsPayload(value) {
  const source = parseJsonObject(value);
  const output = {};
  let count = 0;
  for (const [spellId, level] of Object.entries(source)) {
    if (count >= 64) break;
    const key = itemIdValue(spellId);
    if (!key) continue;
    output[key] = intValue(level, 0, 99);
    count += 1;
  }
  return output;
}

function normalizeCharacterStatsPayload(payload) {
  const characterClass = characterClassValue(payload?.characterClass ?? payload?.classId ?? payload?.class);
  if (!characterClass) return null;
  const stats = payload?.stats && typeof payload.stats === "object" ? payload.stats : {};
  return {
    characterClass,
    level: Math.max(1, intValue(payload?.level ?? payload?.highestLevel, 1, 200)),
    experience: intValue(payload?.experience),
    kills: intValue(payload?.kills),
    zoneKills: intValue(payload?.zoneKills),
    gold: intValue(payload?.gold),
    playtimeMs: intValue(payload?.playtimeMs, 0, 365 * 24 * 60 * 60 * 1000),
    activeZoneId: textValue(payload?.activeZoneId, 80),
    equipment: normalizeEquipmentPayload(payload?.equipment),
    skills: normalizeSkillsPayload(payload?.skills),
    stats: {
      hp: intValue(stats.hp),
      maxHp: intValue(stats.maxHp),
      mp: intValue(stats.mp),
      maxMp: intValue(stats.maxMp),
      dc: normalizeStatRange(stats.dc),
      mc: normalizeStatRange(stats.mc),
      sc: normalizeStatRange(stats.sc),
      ac: normalizeStatRange(stats.ac),
      amc: normalizeStatRange(stats.amc),
      accuracy: intValue(stats.accuracy),
      agility: intValue(stats.agility),
      luck: intValue(stats.luck),
    },
  };
}

function normalizeAccountStatsPayload(payload = {}) {
  const account = payload?.account && typeof payload.account === "object" ? payload.account : payload;
  const characterLevels = parseJsonObject(account?.characterLevels);
  const normalizedLevels = {};
  for (const [classId, level] of Object.entries(characterLevels)) {
    const key = characterClassValue(classId);
    if (!key) continue;
    normalizedLevels[key] = Math.max(1, intValue(level, 1, 200));
  }
  return {
    rebirthCount: intValue(account?.rebirthCount),
    rebirthPointsGained: intValue(account?.rebirthPointsGained),
    rebirthPointsSpent: intValue(account?.rebirthPointsSpent),
    rebirthPointsHeld: intValue(account?.rebirthPointsHeld),
    awakeningSoulsHeld: intValue(account?.awakeningSoulsHeld),
    totalGold: intValue(account?.totalGold ?? payload?.gold),
    bossKills: sanitizeBossKills(account?.bossKills ?? payload?.bossKills),
    bossKillsTotal: intValue(account?.bossKillsTotal),
    characterLevels: normalizedLevels,
    highestCharacterLevel: Math.max(1, intValue(account?.highestCharacterLevel ?? payload?.highestLevel, 1, 200)),
  };
}

function normalizeStatsPayload(payload) {
  const characters = Array.isArray(payload?.characters)
    ? payload.characters.map(normalizeCharacterStatsPayload).filter(Boolean).slice(0, 6)
    : [];
  const account = normalizeAccountStatsPayload(payload);
  const bossKills = mergeBossKills(account.bossKills, ...characters.map((character) => sanitizeBossKills(character.bossKills)));
  const characterLevels = { ...account.characterLevels };
  for (const character of characters) {
    characterLevels[character.characterClass] = Math.max(
      characterLevels[character.characterClass] ?? 1,
      character.level,
    );
  }
  const highestCharacterLevel = Math.max(
    account.highestCharacterLevel,
    ...Object.values(characterLevels),
    ...characters.map((character) => character.level),
    1,
  );
  return {
    playerId: textValue(payload?.playerId, 120),
    activeCharacterId: characterClassValue(payload?.activeCharacterId ?? payload?.characterClass),
    highestLevel: highestCharacterLevel,
    experience: intValue(payload?.experience ?? characters.reduce((best, character) => Math.max(best, character.experience), 0)),
    kills: intValue(payload?.kills ?? characters.reduce((sum, character) => sum + character.kills, 0)),
    zoneKills: intValue(payload?.zoneKills ?? characters.reduce((best, character) => Math.max(best, character.zoneKills), 0)),
    bossKills,
    gold: account.totalGold,
    playtimeMs: intValue(payload?.playtimeMs ?? characters.reduce((sum, character) => sum + character.playtimeMs, 0), 0, 365 * 24 * 60 * 60 * 1000),
    activeZoneId: textValue(payload?.activeZoneId, 80),
    saveVersion: Math.max(1, intValue(payload?.saveVersion, 1, 99)),
    reason: textValue(payload?.reason, 40),
    account: {
      ...account,
      bossKills,
      bossKillsTotal: bossKillsTotal(bossKills),
      characterLevels,
      highestCharacterLevel,
    },
    characters,
  };
}

function combinedCharacterLevels(levels = {}) {
  return Object.values(parseJsonObject(levels)).reduce((sum, level) => sum + intValue(level), 0);
}

function levelExceedsLeaderboardCap(level) {
  return intValue(level) > LEADERBOARD_MAX_VALID_LEVEL;
}

function statsExceedMaxLevel(stats) {
  if (levelExceedsLeaderboardCap(stats?.highestLevel)) return true;
  for (const level of Object.values(stats?.account?.characterLevels ?? {})) {
    if (levelExceedsLeaderboardCap(level)) return true;
  }
  for (const character of stats?.characters ?? []) {
    if (levelExceedsLeaderboardCap(character?.level)) return true;
  }
  return false;
}

function rowExceedsMaxLevel(row) {
  if (levelExceedsLeaderboardCap(row?.highest_level)) return true;
  for (const level of Object.values(parseJsonObject(row?.character_levels))) {
    if (levelExceedsLeaderboardCap(level)) return true;
  }
  for (const entry of parseJsonArray(row?.character_stats)) {
    if (levelExceedsLeaderboardCap(entry?.level)) return true;
  }
  return false;
}

async function deleteLeaderboardRow(env, playerId) {
  await env.DB.prepare(`
    DELETE FROM leaderboard
    WHERE player_id = ?
  `).bind(playerId).run();
}

function formatLeaderboardCharacters(characterLevels, characterStats) {
  const levels = parseJsonObject(characterLevels);
  const stats = parseJsonArray(characterStats);
  const statsByClass = Object.fromEntries(
    stats
      .map((entry) => [characterClassValue(entry?.characterClass), entry])
      .filter(([classId]) => Boolean(classId)),
  );
  return Object.entries(levels)
    .map(([classId, level]) => {
      const summary = statsByClass[classId] ?? null;
      return {
        characterClass: classId,
        level: Math.max(1, intValue(level, 1, 200)),
        experience: intValue(summary?.experience),
        kills: intValue(summary?.kills),
        gold: intValue(summary?.gold),
        stats: summary?.stats ?? null,
        equipment: normalizeEquipmentPayload(summary?.equipment),
        skills: normalizeSkillsPayload(summary?.skills),
      };
    })
    .sort((left, right) => right.level - left.level || left.characterClass.localeCompare(right.characterClass));
}

async function upsertLeaderboardRow(env, stats) {
  const existing = await env.DB.prepare(`
    SELECT boss_kills, rebirth_count, rebirth_points_gained, rebirth_points_spent
    FROM leaderboard
    WHERE player_id = ?
  `).bind(stats.playerId).first();
  const bossKills = mergeBossKills(parseBossKills(existing?.boss_kills), stats.bossKills);
  const bossKillsJson = JSON.stringify(bossKills);
  const characterLevelsJson = JSON.stringify(stats.account.characterLevels ?? {});
  const characterStatsJson = JSON.stringify(stats.characters ?? []);
  const combinedLevels = combinedCharacterLevels(stats.account.characterLevels);
  const awakeningSoulsHeld = intValue(stats.account.awakeningSoulsHeld);

  await env.DB.prepare(`
    INSERT INTO leaderboard (
      player_id,
      highest_level,
      experience,
      kills,
      zone_kills,
      boss_kills,
      gold,
      playtime_ms,
      active_zone_id,
      save_version,
      rebirth_count,
      rebirth_points_gained,
      rebirth_points_spent,
      character_levels,
      character_stats,
      awakening_souls_held,
      combined_character_levels,
      last_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      highest_level = MAX(leaderboard.highest_level, excluded.highest_level),
      experience = MAX(leaderboard.experience, excluded.experience),
      kills = MAX(leaderboard.kills, excluded.kills),
      zone_kills = MAX(leaderboard.zone_kills, excluded.zone_kills),
      boss_kills = excluded.boss_kills,
      gold = MAX(leaderboard.gold, excluded.gold),
      playtime_ms = MAX(leaderboard.playtime_ms, excluded.playtime_ms),
      active_zone_id = excluded.active_zone_id,
      save_version = excluded.save_version,
      rebirth_count = MAX(leaderboard.rebirth_count, excluded.rebirth_count),
      rebirth_points_gained = MAX(leaderboard.rebirth_points_gained, excluded.rebirth_points_gained),
      rebirth_points_spent = MAX(leaderboard.rebirth_points_spent, excluded.rebirth_points_spent),
      character_levels = excluded.character_levels,
      character_stats = excluded.character_stats,
      awakening_souls_held = MAX(leaderboard.awakening_souls_held, excluded.awakening_souls_held),
      combined_character_levels = MAX(leaderboard.combined_character_levels, excluded.combined_character_levels),
      last_reason = excluded.last_reason,
      last_seen = CURRENT_TIMESTAMP
  `).bind(
    stats.playerId,
    stats.highestLevel,
    stats.experience,
    stats.kills,
    stats.zoneKills,
    bossKillsJson,
    stats.gold,
    stats.playtimeMs,
    stats.activeZoneId,
    stats.saveVersion,
    stats.account.rebirthCount,
    stats.account.rebirthPointsGained,
    stats.account.rebirthPointsSpent,
    characterLevelsJson,
    characterStatsJson,
    awakeningSoulsHeld,
    combinedLevels,
    stats.reason,
  ).run();
}

async function handleStatsPost(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected JSON body." }, 400, headers);
  }

  const stats = normalizeStatsPayload(body);
  if (!stats.playerId) return json({ error: "Missing playerId." }, 400, headers);
  if (String(stats.playerId).includes(":")) {
    return json({ error: "Use account playerId without character suffix." }, 400, headers);
  }

  if (statsExceedMaxLevel(stats)) {
    await deleteLeaderboardRow(env, stats.playerId);
    return json({ ok: true, rejected: "invalid_level" }, 200, headers);
  }

  await upsertLeaderboardRow(env, stats);
  return json({ ok: true, characters: stats.characters.length }, 200, headers);
}

function publicPlayerLabel(playerId) {
  const accountId = String(playerId ?? "").split(":")[0];
  return `Player ${accountId.slice(0, 8)}`;
}

function characterClassFromPlayerId(playerId) {
  const [, characterClass] = String(playerId ?? "").split(":");
  return characterClass || null;
}

function leaderboardLimitValue(value) {
  if (value == null || value === "") return 250;
  return Math.max(1, Math.min(500, intValue(value, 250, 500)));
}

function leaderboardScopeValue(value) {
  const scope = String(value ?? "accounts").toLowerCase();
  return ["characters", "accounts", "all"].includes(scope) ? scope : "accounts";
}

async function leaderboardRows(env, scope, limit) {
  const scopeWhere = {
    accounts: "instr(player_id, ':') = 0",
    characters: "instr(player_id, ':') > 0",
    all: "1 = 1",
  }[scope] ?? "1 = 1";
  return env.DB.prepare(`
    SELECT
      player_id,
      highest_level,
      experience,
      kills,
      zone_kills,
      boss_kills,
      gold,
      active_zone_id,
      playtime_ms,
      rebirth_count,
      rebirth_points_gained,
      rebirth_points_spent,
      character_levels,
      character_stats,
      awakening_souls_held,
      combined_character_levels,
      last_seen
    FROM leaderboard
    WHERE ${scopeWhere}
      AND highest_level <= ?
    ORDER BY combined_character_levels DESC, awakening_souls_held DESC, highest_level DESC, experience DESC, kills DESC
    LIMIT ?
  `).bind(LEADERBOARD_MAX_VALID_LEVEL, limit).all();
}

async function handleLeaderboardGet(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);

  const url = new URL(request.url);
  const limit = leaderboardLimitValue(url.searchParams.get("limit"));
  let scope = leaderboardScopeValue(url.searchParams.get("scope"));
  let results = await leaderboardRows(env, scope, limit);
  if ((results.results ?? []).length === 0 && scope === "accounts") {
    scope = "characters";
    results = await leaderboardRows(env, scope, limit);
  }

  const rows = (results.results ?? [])
    .filter((row) => !rowExceedsMaxLevel(row))
    .map((row, index) => {
      const bossKills = parseBossKills(row.boss_kills);
      const characterLevels = parseJsonObject(row.character_levels);
      const characterStats = parseJsonArray(row.character_stats);
      const combinedLevels = intValue(row.combined_character_levels) || combinedCharacterLevels(characterLevels);
      return {
        rank: index + 1,
        player: publicPlayerLabel(row.player_id),
        characterClass: characterClassFromPlayerId(row.player_id),
        level: row.highest_level,
        combinedCharacterLevels: combinedLevels,
        awakeningSoulsHeld: intValue(row.awakening_souls_held),
        experience: row.experience,
        kills: row.kills,
        zoneKills: row.zone_kills,
        bossKills,
        bossKillsTotal: bossKillsTotal(bossKills),
        gold: row.gold,
        zone: row.active_zone_id,
        playtimeMs: row.playtime_ms,
        rebirthCount: intValue(row.rebirth_count),
        rebirthPointsGained: intValue(row.rebirth_points_gained),
        rebirthPointsSpent: intValue(row.rebirth_points_spent),
        characterLevels,
        characterStats,
        characters: formatLeaderboardCharacters(characterLevels, characterStats),
        lastSeen: row.last_seen,
      };
    });

  return json({ scope, limit, rows }, 200, headers);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    if (url.pathname === "/stats" && request.method === "POST") return handleStatsPost(request, env, headers);
    if (url.pathname === "/leaderboard" && request.method === "GET") return handleLeaderboardGet(request, env, headers);
    if ((url.pathname === "/" || url.pathname === "/panel") && request.method === "GET") {
      return new Response(PANEL_HTML, {
        status: 200,
        headers: {
          ...headers,
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return json({ error: "Not found." }, 404, headers);
  },
};
