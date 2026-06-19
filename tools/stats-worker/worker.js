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
      last_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  const where = {
    accounts: "WHERE instr(player_id, ':') = 0",
    characters: "WHERE instr(player_id, ':') > 0",
    all: "",
  }[scope] ?? "";
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
      last_seen
    FROM leaderboard
    ${where}
    ORDER BY highest_level DESC, experience DESC, kills DESC
    LIMIT ?
  `).bind(limit).all();
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

  const rows = (results.results ?? []).map((row, index) => {
    const bossKills = parseBossKills(row.boss_kills);
    return {
      rank: index + 1,
      player: publicPlayerLabel(row.player_id),
      characterClass: characterClassFromPlayerId(row.player_id),
      level: row.highest_level,
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
      characterLevels: parseJsonObject(row.character_levels),
      characterStats: parseJsonArray(row.character_stats),
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

    return json({ error: "Not found." }, 404, headers);
  },
};
