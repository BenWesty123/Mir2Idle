import { PANEL_HTML } from "./panelHtml.js";
import { INTEGRITY_PANEL_HTML } from "./integrityPanelHtml.js";
import { MESSAGE_MODERATION_PANEL_HTML } from "./messageModerationPanelHtml.js";
import {
  ITEM_INTEGRITY_RULES_VERSION,
  integrityFingerprint,
  validateEquipmentPayload,
} from "./itemLegality.js";

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
// The whole save is stored as a single D1 row value, whose hard ceiling is 2 MB
// ("Maximum string, BLOB or table row size"). Cap below that with margin for the
// other small row columns (version, timestamps, recovery code) + JSON wrapper.
const MAX_CLOUD_SAVE_REQUEST_BYTES = 1_800_000;
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOWN_MESSAGE_MAX_LENGTH = 100;
const TOWN_MESSAGE_POST_COOLDOWN_SECONDS = 60;
const TOWN_MESSAGE_CLASSES = new Set(["Warrior", "Wizard", "Taoist"]);

// Player-chosen public display name (alias). Letters, numbers, spaces and a small
// set of punctuation; trimmed with internal runs of whitespace collapsed.
const ALIAS_MIN_LENGTH = 3;
const ALIAS_MAX_LENGTH = 16;
const ALIAS_PATTERN = /^[A-Za-z0-9 ._'-]+$/;

// Server-owned token economy. The client NEVER sends token amounts or prices;
// these are the only source of truth. `gbpPence` is the charged price.
const TOKEN_PACKS = {
  "tokens-600": { tokens: 600, gbpPence: 500, label: "600 Tokens" },
  "tokens-1300": { tokens: 1300, gbpPence: 1000, label: "1,300 Tokens" },
  "tokens-3000": { tokens: 3000, gbpPence: 2000, label: "3,000 Tokens" },
};
const MESSAGE_TOKEN_COST = 50;
// One-off token unlocks and their token price. The keys AND costs are server-owned
// so the client cannot invent unlocks or set its own price. Inventory pages are
// per-character; storage is account-wide; the Teleport Ring is account-wide.
const UNLOCK_TOKEN_COSTS = {
  "storage-page-3": 250,
  "inv-page-3:warrior": 250,
  "inv-page-3:wizard": 250,
  "inv-page-3:taoist": 250,
  "teleport-ring": 500,
};
const PAGE_UNLOCK_KEYS = new Set(Object.keys(UNLOCK_TOKEN_COSTS));
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
const DEFAULT_SITE_URL = "https://www.lom2idle.com";

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "*";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  return {
    "access-control-allow-origin": allowedOrigin === "*" ? origin : allowedOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
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

// Account-scoped player id (no character `:suffix`), matching the client's
// anonymous UUID / `anon-...` / `player-...` shapes used everywhere else.
function aliasPlayerIdValue(value) {
  const id = textValue(value, 80);
  if (!id) return null;
  if (id.includes(":")) return null;
  if (!/^[a-z0-9_-]{8,80}$/i.test(id)) return null;
  return id;
}

// Returns a clean alias, or null if it fails validation. Collapses internal
// whitespace and blocks aliases that impersonate the default `Player ...` label.
function normalizePlayerAlias(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < ALIAS_MIN_LENGTH || trimmed.length > ALIAS_MAX_LENGTH) return null;
  if (!ALIAS_PATTERN.test(trimmed)) return null;
  if (/^player\b/i.test(trimmed)) return null;
  return trimmed;
}

function townMessageBody(value) {
  if (typeof value !== "string") return "";
  const printable = [...value].filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  }).join("");
  return printable
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, TOWN_MESSAGE_MAX_LENGTH);
}

function townMessageRow(row, aliasMap) {
  return {
    id: intValue(row?.id),
    player: resolvePublicLabel(row?.player_id, aliasMap),
    characterClass: TOWN_MESSAGE_CLASSES.has(row?.character_class) ? row.character_class : "Adventurer",
    characterLevel: intValue(row?.character_level, 1, LEADERBOARD_MAX_VALID_LEVEL),
    body: String(row?.body ?? ""),
    createdAt: row?.created_at ?? null,
  };
}

async function handleTownMessagesGet(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const url = new URL(request.url);
  const requestedLimit = url.searchParams.get("limit");
  const limit = requestedLimit == null ? 30 : Math.max(1, Math.min(50, intValue(requestedLimit, 30, 50)));
  const result = await env.DB.prepare(`
    SELECT id, player_id, character_class, character_level, body, created_at
    FROM town_messages
    WHERE status = 'visible' AND expires_at > CURRENT_TIMESTAMP
    ORDER BY id DESC
    LIMIT ?
  `).bind(limit).all();
  const messages = result?.results ?? [];
  const aliasMap = await aliasMapForPlayerIds(env, messages.map((row) => row.player_id));
  return json({ messages: messages.map((row) => townMessageRow(row, aliasMap)) }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

async function handleTownMessagesPost(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const parsed = await boundedJsonBody(request, 4_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const playerId = textValue(parsed.value?.playerId, 80);
  const recoveryCode = normalizeRecoveryCode(parsed.value?.recoveryCode);
  const characterClass = characterClassValue(parsed.value?.characterClass);
  const characterLevel = intValue(parsed.value?.characterLevel, 1, LEADERBOARD_MAX_VALID_LEVEL);
  const body = townMessageBody(parsed.value?.body);
  if (!playerId || !/^[a-z0-9_-]{8,80}$/i.test(playerId)) return json({ error: "Invalid player identity." }, 400, headers);
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  if (!TOWN_MESSAGE_CLASSES.has(characterClass)) return json({ error: "Invalid character class." }, 400, headers);
  if (!body) return json({ error: "Write a message first." }, 400, headers);

  const recent = await env.DB.prepare(`
    SELECT created_at
    FROM town_messages
    WHERE player_id = ? AND created_at > datetime('now', ?)
    ORDER BY id DESC
    LIMIT 1
  `).bind(playerId, `-${TOWN_MESSAGE_POST_COOLDOWN_SECONDS} seconds`).first();
  if (recent) return json({ error: "Please wait a minute before posting again." }, 429, headers);

  // Atomic conditional spend: the `balance >= cost` guard means concurrent
  // requests can never drive the balance negative or double-spend (SQLite
  // serializes writes), so no separate transaction is needed here.
  const charge = await env.DB.prepare(`
    UPDATE token_accounts
    SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
    WHERE recovery_code = ? AND balance >= ?
  `).bind(MESSAGE_TOKEN_COST, recoveryCode, MESSAGE_TOKEN_COST).run();
  if ((charge?.meta?.changes ?? 0) !== 1) {
    return json({ error: "Not enough tokens.", code: "INSUFFICIENT_TOKENS" }, 402, headers);
  }

  const inserted = await env.DB.prepare(`
    INSERT INTO town_messages (player_id, character_class, character_level, body)
    VALUES (?, ?, ?, ?)
    RETURNING id, player_id, character_class, character_level, body, created_at
  `).bind(playerId, characterClass, Math.max(1, characterLevel), body).first();
  await env.DB.prepare(`
    INSERT INTO token_ledger (recovery_code, delta, reason, ref)
    VALUES (?, ?, 'spend:message', ?)
  `).bind(recoveryCode, -MESSAGE_TOKEN_COST, String(inserted?.id ?? "")).run();

  const balanceRow = await env.DB.prepare(
    "SELECT balance FROM token_accounts WHERE recovery_code = ?",
  ).bind(recoveryCode).first();
  const aliasMap = await aliasMapForPlayerIds(env, [inserted?.player_id ?? playerId]);
  return json({ ok: true, message: townMessageRow(inserted, aliasMap), balance: intValue(balanceRow?.balance) }, 201, {
    ...headers,
    "cache-control": "no-store",
  });
}

function townMessageAdminStatusFilter(value) {
  const status = String(value ?? "visible").toLowerCase();
  return ["visible", "removed", "all"].includes(status) ? status : "visible";
}

function adminTownMessageRow(row) {
  return {
    id: intValue(row?.id),
    playerId: String(row?.player_id ?? ""),
    playerLabel: publicPlayerLabel(row?.player_id),
    characterClass: TOWN_MESSAGE_CLASSES.has(row?.character_class) ? row.character_class : "Adventurer",
    characterLevel: intValue(row?.character_level, 1, LEADERBOARD_MAX_VALID_LEVEL),
    body: String(row?.body ?? ""),
    createdAt: row?.created_at ?? null,
    expiresAt: row?.expires_at ?? null,
    status: row?.status === "removed" ? "removed" : "visible",
  };
}

function normalizeRecoveryCode(value) {
  let compact = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("MIR")) compact = compact.slice(3);
  if (compact.length !== 16) return "";
  if ([...compact].some((character) => !RECOVERY_CODE_ALPHABET.includes(character))) return "";
  return `MIR-${compact.match(/.{1,4}/g).join("-")}`;
}

async function boundedJsonBody(request, maxBytes = MAX_CLOUD_SAVE_REQUEST_BYTES) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "Save is too large." };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, status: 413, error: "Save is too large." };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Expected JSON body." };
  }
}

function validCloudSaveSnapshot(save) {
  return Boolean(
    save
      && typeof save === "object"
      && !Array.isArray(save)
      && Number.isInteger(Number(save.version))
      && Number(save.version) >= 1
      && save.characters
      && typeof save.characters === "object"
      && !Array.isArray(save.characters),
  );
}

async function handleCloudSavePost(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const parsed = await boundedJsonBody(request);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const recoveryCode = normalizeRecoveryCode(parsed.value?.recoveryCode);
  const save = parsed.value?.save;
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  if (!validCloudSaveSnapshot(save)) return json({ error: "Invalid save snapshot." }, 400, headers);

  const saveData = JSON.stringify(save);
  const saveSize = new TextEncoder().encode(saveData).byteLength;
  if (saveSize > MAX_CLOUD_SAVE_REQUEST_BYTES) return json({ error: "Save is too large." }, 413, headers);
  const clientSavedAt = intValue(save.savedAt, 0, Number.MAX_SAFE_INTEGER);
  await env.DB.prepare(`
    INSERT INTO cloud_saves (
      recovery_code, save_version, save_data, client_saved_at, save_size, created_at, saved_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(recovery_code) DO UPDATE SET
      save_version = excluded.save_version,
      save_data = excluded.save_data,
      client_saved_at = excluded.client_saved_at,
      save_size = excluded.save_size,
      saved_at = CURRENT_TIMESTAMP
  `).bind(recoveryCode, intValue(save.version, 1, 999), saveData, clientSavedAt, saveSize).run();

  const row = await env.DB.prepare(`SELECT saved_at FROM cloud_saves WHERE recovery_code = ?`)
    .bind(recoveryCode)
    .first();
  return json({ ok: true, recoveryCode, savedAt: row?.saved_at ?? new Date().toISOString() }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

async function handleCloudSaveRestore(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const parsed = await boundedJsonBody(request, 8_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const recoveryCode = normalizeRecoveryCode(parsed.value?.recoveryCode);
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);

  const row = await env.DB.prepare(`
    SELECT save_data, save_version, saved_at
    FROM cloud_saves
    WHERE recovery_code = ?
  `).bind(recoveryCode).first();
  if (!row) return json({ error: "No cloud save found for that recovery code." }, 404, headers);

  let save;
  try {
    save = JSON.parse(row.save_data);
  } catch {
    return json({ error: "The stored cloud save is damaged." }, 500, headers);
  }
  if (!validCloudSaveSnapshot(save)) return json({ error: "The stored cloud save is invalid." }, 500, headers);
  return json({ ok: true, recoveryCode, savedAt: row.saved_at, saveVersion: row.save_version, save }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
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
  "braceletR", "ringL", "ringR", "amulet", "belt", "boots", "stone", "mount",
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
  "healthRecovery", "poisonRecovery", "strong", "xpBonusPercent",
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

function normalizeEmpowerSpellBonuses(value) {
  const source = parseJsonObject(value);
  const output = {};
  for (const [spellId, raw] of Object.entries(source)) {
    const key = itemIdValue(spellId);
    if (!key) continue;
    const row = parseJsonObject(raw);
    const normalized = {};
    for (const kind of ["damagePercent", "manaCostPercent", "healingPercent", "cooldownReductionSeconds"]) {
      const amount = signedIntValue(row[kind]);
      if (amount !== 0) normalized[kind] = amount;
    }
    if (Object.keys(normalized).length) output[key] = normalized;
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
      instanceId: textValue(entry?.instanceId, 80),
      itemId,
      smithLevel: intValue(entry?.smithLevel, 0, 99),
      weaponRefineLevel: intValue(entry?.weaponRefineLevel, 0, 99),
      gemCount: intValue(entry?.gemCount, 0, 99),
      empowered: Boolean(entry?.empowered),
      empowerTier: intValue(entry?.empowerTier, 0, 99),
      bonusStats: normalizeBonusStatsPayload(entry?.bonusStats),
      smithBonusStats: normalizeBonusStatsPayload(entry?.smithBonusStats),
      empowerBonusStats: normalizeBonusStatsPayload(entry?.empowerBonusStats),
      empowerSpellBonuses: normalizeEmpowerSpellBonuses(entry?.empowerSpellBonuses),
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
    integrityRulesVersion: textValue(payload?.integrityRulesVersion, 40),
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

function integrityVersionEnforcementActive(env, now = Date.now()) {
  const enforceAt = Date.parse(String(env.INTEGRITY_ENFORCE_AFTER ?? ""));
  return !Number.isFinite(enforceAt) || now >= enforceAt;
}

function statsIntegrityResult(stats, enforceOutdatedVersion = true) {
  const currentRules = stats.integrityRulesVersion === ITEM_INTEGRITY_RULES_VERSION;
  const shouldValidateItems = currentRules || enforceOutdatedVersion;
  const itemResult = shouldValidateItems
    ? validateEquipmentPayload(stats.characters)
    : { valid: true, rulesVersion: ITEM_INTEGRITY_RULES_VERSION, violations: [] };
  const violations = [...itemResult.violations];
  if (!currentRules && enforceOutdatedVersion) {
    violations.push({
      code: "outdated_rules",
      characterClass: null,
      slotId: null,
      itemId: null,
      detail: `Submission used integrity rules ${stats.integrityRulesVersion ?? "missing"}; expected ${ITEM_INTEGRITY_RULES_VERSION}.`,
    });
  }
  if (statsExceedMaxLevel(stats)) {
    violations.push({
      code: "invalid_level",
      characterClass: null,
      slotId: null,
      itemId: null,
      detail: `A submitted character level exceeds the current cap of ${LEADERBOARD_MAX_VALID_LEVEL}.`,
    });
  }
  return {
    valid: violations.length === 0,
    reviewable: shouldValidateItems || violations.length > 0,
    rulesVersion: stats.integrityRulesVersion ?? "legacy",
    violations,
  };
}

function nextIntegrityState(existing, integrity) {
  const previousStatus = textValue(existing?.integrity_status, 24) ?? "legacy";
  const fingerprint = integrityFingerprint(integrity);
  if (previousStatus === "excluded") {
    return { status: "excluded", fingerprint, reason: JSON.stringify(integrity.violations) };
  }
  if (!integrity.reviewable) {
    return {
      status: previousStatus === "legacy" ? "legacy" : previousStatus,
      fingerprint: existing?.integrity_fingerprint ?? "",
      reason: existing?.integrity_reason ?? null,
    };
  }
  if (integrity.valid) return { status: "clear", fingerprint: "", reason: null };
  if (fingerprint && fingerprint === String(existing?.integrity_approved_fingerprint ?? "")) {
    return { status: "approved", fingerprint, reason: JSON.stringify(integrity.violations) };
  }
  return { status: "flagged", fingerprint, reason: JSON.stringify(integrity.violations) };
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

async function upsertLeaderboardRow(env, stats, integrity) {
  const existing = await env.DB.prepare(`
    SELECT
      boss_kills,
      rebirth_count,
      rebirth_points_gained,
      rebirth_points_spent,
      integrity_status,
      integrity_reason,
      integrity_fingerprint,
      integrity_approved_fingerprint
    FROM leaderboard
    WHERE player_id = ?
  `).bind(stats.playerId).first();
  const bossKills = mergeBossKills(parseBossKills(existing?.boss_kills), stats.bossKills);
  const bossKillsJson = JSON.stringify(bossKills);
  const characterLevelsJson = JSON.stringify(stats.account.characterLevels ?? {});
  const characterStatsJson = JSON.stringify(stats.characters ?? []);
  const combinedLevels = combinedCharacterLevels(stats.account.characterLevels);
  const awakeningSoulsHeld = intValue(stats.account.awakeningSoulsHeld);
  const integrityState = nextIntegrityState(existing, integrity);
  const flaggedAt = integrityState.status === "flagged" ? new Date().toISOString() : null;

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
      last_reason,
      integrity_status,
      integrity_reason,
      integrity_fingerprint,
      integrity_rules_version,
      integrity_flagged_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      combined_character_levels = excluded.combined_character_levels,
      last_reason = excluded.last_reason,
      integrity_status = excluded.integrity_status,
      integrity_reason = excluded.integrity_reason,
      integrity_fingerprint = excluded.integrity_fingerprint,
      integrity_rules_version = excluded.integrity_rules_version,
      integrity_flagged_at = CASE
        WHEN excluded.integrity_status = 'flagged' AND excluded.integrity_fingerprint != COALESCE(leaderboard.integrity_fingerprint, '')
          THEN excluded.integrity_flagged_at
        ELSE leaderboard.integrity_flagged_at
      END,
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
    integrityState.status,
    integrityState.reason,
    integrityState.fingerprint,
    integrity.rulesVersion,
    flaggedAt,
  ).run();
  return integrityState;
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

  const integrity = statsIntegrityResult(stats, integrityVersionEnforcementActive(env));
  await upsertLeaderboardRow(env, stats, integrity);
  return json({
    ok: true,
    characters: stats.characters.length,
  }, 200, headers);
}

function publicPlayerLabel(playerId) {
  const accountId = String(playerId ?? "").split(":")[0];
  return `Player ${accountId.slice(0, 8)}`;
}

// Prefer a player's chosen alias (resolved at read time so name changes apply
// retroactively to old rows), falling back to the derived `Player XXXXXXXX`.
function resolvePublicLabel(playerId, aliasMap) {
  const accountId = String(playerId ?? "").split(":")[0];
  const alias = aliasMap?.get(accountId);
  return alias ? String(alias) : publicPlayerLabel(playerId);
}

// Batch-fetch aliases for a set of (possibly character-suffixed) player ids and
// return an account-id -> alias map. Skips the query entirely when empty. Chunked
// so the bound-parameter count stays well under D1's per-query limit even when the
// leaderboard returns hundreds of rows.
const ALIAS_LOOKUP_CHUNK = 90;
async function aliasMapForPlayerIds(env, playerIds) {
  const unique = [...new Set((playerIds ?? [])
    .map((id) => String(id ?? "").split(":")[0])
    .filter(Boolean))];
  const map = new Map();
  if (!unique.length || !env?.DB) return map;
  for (let index = 0; index < unique.length; index += ALIAS_LOOKUP_CHUNK) {
    const chunk = unique.slice(index, index + ALIAS_LOOKUP_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const result = await env.DB.prepare(
      `SELECT player_id, alias FROM player_aliases WHERE player_id IN (${placeholders})`,
    ).bind(...chunk).all();
    for (const row of result?.results ?? []) {
      if (row?.player_id && row?.alias) map.set(row.player_id, row.alias);
    }
  }
  return map;
}

function characterClassFromPlayerId(playerId) {
  const [, characterClass] = String(playerId ?? "").split(":");
  return characterClass || null;
}

async function constantTimeTokenMatch(left, right) {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function adminAuthorized(request, env) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return constantTimeTokenMatch(token, String(env.ADMIN_TOKEN ?? ""));
}

async function handleAdminTownMessagesGet(request, env, headers) {
  if (!env.ADMIN_TOKEN) return json({ error: "ADMIN_TOKEN is not configured." }, 503, headers);
  if (!(await adminAuthorized(request, env))) return json({ error: "Unauthorized." }, 401, headers);
  const status = townMessageAdminStatusFilter(new URL(request.url).searchParams.get("status"));
  let statement;
  if (status === "all") {
    statement = env.DB.prepare(`
      SELECT id, player_id, character_class, character_level, body, created_at, expires_at, status
      FROM town_messages
      ORDER BY id DESC
      LIMIT 250
    `);
  } else if (status === "visible") {
    statement = env.DB.prepare(`
      SELECT id, player_id, character_class, character_level, body, created_at, expires_at, status
      FROM town_messages
      WHERE status = 'visible' AND expires_at > CURRENT_TIMESTAMP
      ORDER BY id DESC
      LIMIT 250
    `);
  } else {
    statement = env.DB.prepare(`
      SELECT id, player_id, character_class, character_level, body, created_at, expires_at, status
      FROM town_messages
      WHERE status = ?
      ORDER BY id DESC
      LIMIT 250
    `).bind(status);
  }
  const result = await statement.all();
  return json({ status, rows: (result?.results ?? []).map(adminTownMessageRow) }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

async function handleAdminTownMessagesReview(request, env, headers) {
  if (!env.ADMIN_TOKEN) return json({ error: "ADMIN_TOKEN is not configured." }, 503, headers);
  if (!(await adminAuthorized(request, env))) return json({ error: "Unauthorized." }, 401, headers);
  const parsed = await boundedJsonBody(request, 2_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const messageId = intValue(parsed.value?.messageId);
  const action = String(parsed.value?.action ?? "").toLowerCase();
  if (!messageId || !["remove", "restore"].includes(action)) {
    return json({ error: "Expected messageId and remove or restore action." }, 400, headers);
  }
  const statement = action === "remove"
    ? env.DB.prepare("UPDATE town_messages SET status = 'removed' WHERE id = ?")
    : env.DB.prepare(`
        UPDATE town_messages
        SET status = 'visible',
            expires_at = CASE
              WHEN expires_at <= CURRENT_TIMESTAMP THEN datetime('now', '+14 days')
              ELSE expires_at
            END
        WHERE id = ?
      `);
  const result = await statement.bind(messageId).run();
  if (!result.meta?.changes) return json({ error: "Message not found." }, 404, headers);
  return json({ ok: true, messageId, action }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

function integrityStatusFilter(value) {
  const status = String(value ?? "flagged").toLowerCase();
  return ["flagged", "excluded", "all"].includes(status) ? status : "flagged";
}

async function handleAdminIntegrityGet(request, env, headers) {
  if (!env.ADMIN_TOKEN) return json({ error: "ADMIN_TOKEN is not configured." }, 503, headers);
  if (!(await adminAuthorized(request, env))) return json({ error: "Unauthorized." }, 401, headers);
  const status = integrityStatusFilter(new URL(request.url).searchParams.get("status"));
  const where = status === "all" ? "integrity_status IN ('flagged', 'excluded', 'approved')" : "integrity_status = ?";
  const statement = env.DB.prepare(`
    SELECT
      player_id,
      integrity_status,
      integrity_reason,
      integrity_rules_version,
      integrity_flagged_at,
      integrity_reviewed_at,
      last_seen
    FROM leaderboard
    WHERE ${where}
    ORDER BY COALESCE(integrity_flagged_at, last_seen) DESC
    LIMIT 500
  `);
  const results = status === "all" ? await statement.all() : await statement.bind(status).all();
  const rows = (results.results ?? []).map((row) => ({
    playerId: row.player_id,
    playerLabel: publicPlayerLabel(row.player_id),
    status: row.integrity_status,
    reason: row.integrity_reason,
    rulesVersion: row.integrity_rules_version,
    flaggedAt: row.integrity_flagged_at,
    reviewedAt: row.integrity_reviewed_at,
    lastSeen: row.last_seen,
  }));
  return json({ status, rows }, 200, headers);
}

function manualPlayerLookupValue(value) {
  const input = String(value ?? "").trim().replace(/^player\s+/i, "");
  if (input.length < 8 || input.length > 120 || !/^[a-z0-9_:-]+$/i.test(input)) return null;
  return input;
}

async function handleAdminIntegrityManualExclude(request, env, headers) {
  if (!env.ADMIN_TOKEN) return json({ error: "ADMIN_TOKEN is not configured." }, 503, headers);
  if (!(await adminAuthorized(request, env))) return json({ error: "Unauthorized." }, 401, headers);
  const parsed = await boundedJsonBody(request, 2_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const lookup = manualPlayerLookupValue(parsed.value?.playerId ?? parsed.value?.player);
  if (!lookup) {
    return json({ error: "Enter Player XXXXXXXX or a full player ID." }, 400, headers);
  }

  const exact = await env.DB.prepare(`
    SELECT player_id
    FROM leaderboard
    WHERE player_id = ?
    LIMIT 1
  `).bind(lookup).first();
  let matches = exact ? [exact] : [];
  if (!matches.length) {
    const result = await env.DB.prepare(`
      SELECT player_id
      FROM leaderboard
      WHERE substr(player_id, 1, ?) = ?
      ORDER BY last_seen DESC
      LIMIT 6
    `).bind(lookup.length, lookup).all();
    matches = result?.results ?? [];
  }
  if (!matches.length) return json({ error: "No Social player matches that identifier." }, 404, headers);
  if (matches.length > 1) {
    return json({
      error: "More than one player matches. Use the full player ID.",
      matches: matches.map((row) => ({
        playerId: row.player_id,
        playerLabel: publicPlayerLabel(row.player_id),
      })),
    }, 409, headers);
  }

  const playerId = matches[0].player_id;
  const reason = JSON.stringify([{
    code: "manual_exclusion",
    detail: "Manually removed from Social by an administrator.",
  }]);
  const result = await env.DB.prepare(`
    UPDATE leaderboard
    SET
      integrity_status = 'excluded',
      integrity_reason = ?,
      integrity_reviewed_at = CURRENT_TIMESTAMP
    WHERE player_id = ?
  `).bind(reason, playerId).run();
  if (!result.meta?.changes) return json({ error: "Player not found." }, 404, headers);
  return json({
    ok: true,
    playerId,
    playerLabel: publicPlayerLabel(playerId),
    action: "exclude",
  }, 200, headers);
}

async function handleAdminIntegrityReview(request, env, headers) {
  if (!env.ADMIN_TOKEN) return json({ error: "ADMIN_TOKEN is not configured." }, 503, headers);
  if (!(await adminAuthorized(request, env))) return json({ error: "Unauthorized." }, 401, headers);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected JSON body." }, 400, headers);
  }
  const playerId = textValue(body?.playerId, 120);
  const action = String(body?.action ?? "").toLowerCase();
  if (!playerId || !["keep", "exclude", "restore"].includes(action)) {
    return json({ error: "Expected playerId and keep, exclude, or restore action." }, 400, headers);
  }

  let statement;
  if (action === "exclude") {
    statement = env.DB.prepare(`
      UPDATE leaderboard
      SET integrity_status = 'excluded', integrity_reviewed_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `);
  } else if (action === "keep") {
    statement = env.DB.prepare(`
      UPDATE leaderboard
      SET
        integrity_status = 'approved',
        integrity_approved_fingerprint = integrity_fingerprint,
        integrity_reviewed_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `);
  } else {
    statement = env.DB.prepare(`
      UPDATE leaderboard
      SET
        integrity_status = 'clear',
        integrity_reason = NULL,
        integrity_fingerprint = '',
        integrity_approved_fingerprint = NULL,
        integrity_reviewed_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `);
  }
  const result = await statement.bind(playerId).run();
  if (!result.meta?.changes) return json({ error: "Player not found." }, 404, headers);
  return json({ ok: true, playerId, action }, 200, headers);
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
      AND COALESCE(integrity_status, 'legacy') != 'excluded'
    ORDER BY combined_character_levels DESC, awakening_souls_held DESC, highest_level DESC, experience DESC, kills DESC
    LIMIT ?
  `).bind(limit).all();
}

const MAX_TELEMETRY_DELTA_MS = 10 * 60 * 1000;

function telemetryMs(value) {
  return intValue(value, 0, MAX_TELEMETRY_DELTA_MS);
}

function normalizeTelemetryPayload(body) {
  const playerId = textValue(body?.playerId, 120);
  const sessionId = textValue(body?.sessionId, 80);
  const foregroundMs = telemetryMs(body?.foregroundMs);
  const backgroundMs = telemetryMs(body?.backgroundMs);
  const combatMs = telemetryMs(body?.combatMs);
  const idleMs = telemetryMs(body?.idleMs);
  const totalMs = telemetryMs(body?.totalMs) || Math.min(MAX_TELEMETRY_DELTA_MS, foregroundMs + backgroundMs);
  return { playerId, sessionId, foregroundMs, backgroundMs, combatMs, idleMs, totalMs };
}

async function handleTelemetryPost(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected JSON body." }, 400, headers);
  }

  const t = normalizeTelemetryPayload(body);
  if (!t.playerId || !t.sessionId) return json({ error: "Missing playerId or sessionId." }, 400, headers);
  const accountId = String(t.playerId).split(":")[0];

  await env.DB.prepare(`
    INSERT INTO telemetry_sessions (
      session_id, player_id, first_seen, last_seen,
      foreground_ms, background_ms, combat_ms, idle_ms, total_ms, heartbeats
    )
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(session_id) DO UPDATE SET
      last_seen = CURRENT_TIMESTAMP,
      foreground_ms = foreground_ms + excluded.foreground_ms,
      background_ms = background_ms + excluded.background_ms,
      combat_ms = combat_ms + excluded.combat_ms,
      idle_ms = idle_ms + excluded.idle_ms,
      total_ms = total_ms + excluded.total_ms,
      heartbeats = heartbeats + 1
  `).bind(
    t.sessionId,
    accountId,
    t.foregroundMs,
    t.backgroundMs,
    t.combatMs,
    t.idleMs,
    t.totalMs,
  ).run();

  return json({ ok: true }, 200, headers);
}

function telemetryHours(ms) {
  return Math.round((intValue(ms) / 3_600_000) * 100) / 100;
}

async function handleMetricsGet(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);

  const overall = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN last_seen >= datetime('now', '-5 minutes') THEN player_id END) AS online_now,
      COUNT(DISTINCT CASE WHEN last_seen >= datetime('now', '-1 day') THEN player_id END) AS dau,
      COUNT(DISTINCT CASE WHEN last_seen >= datetime('now', '-7 days') THEN player_id END) AS wau,
      COUNT(DISTINCT player_id) AS total_players,
      COUNT(*) AS total_sessions,
      SUM(foreground_ms) AS foreground_ms,
      SUM(background_ms) AS background_ms,
      SUM(combat_ms) AS combat_ms,
      SUM(idle_ms) AS idle_ms,
      SUM(total_ms) AS total_ms
    FROM telemetry_sessions
  `).first();

  const recent = await env.DB.prepare(`
    SELECT
      COUNT(*) AS sessions_24h,
      COUNT(DISTINCT player_id) AS players_24h,
      SUM(foreground_ms) AS foreground_ms_24h,
      SUM(background_ms) AS background_ms_24h,
      SUM(combat_ms) AS combat_ms_24h,
      SUM(idle_ms) AS idle_ms_24h,
      AVG(total_ms) AS avg_session_ms_24h
    FROM telemetry_sessions
    WHERE last_seen >= datetime('now', '-1 day')
  `).first();

  return json({
    onlineNow: intValue(overall?.online_now),
    dau: intValue(overall?.dau),
    wau: intValue(overall?.wau),
    totalPlayers: intValue(overall?.total_players),
    totalSessions: intValue(overall?.total_sessions),
    allTime: {
      foregroundHours: telemetryHours(overall?.foreground_ms),
      backgroundHours: telemetryHours(overall?.background_ms),
      combatHours: telemetryHours(overall?.combat_ms),
      idleHours: telemetryHours(overall?.idle_ms),
      totalHours: telemetryHours(overall?.total_ms),
    },
    last24h: {
      sessions: intValue(recent?.sessions_24h),
      players: intValue(recent?.players_24h),
      foregroundHours: telemetryHours(recent?.foreground_ms_24h),
      backgroundHours: telemetryHours(recent?.background_ms_24h),
      combatHours: telemetryHours(recent?.combat_ms_24h),
      idleHours: telemetryHours(recent?.idle_ms_24h),
      avgSessionMinutes: Math.round((intValue(recent?.avg_session_ms_24h) / 60_000) * 10) / 10,
    },
  }, 200, headers);
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

  const leaderboardRowsRaw = results.results ?? [];
  const aliasMap = await aliasMapForPlayerIds(env, leaderboardRowsRaw.map((row) => row.player_id));
  const rows = leaderboardRowsRaw
    .map((row, index) => {
      const bossKills = parseBossKills(row.boss_kills);
      const characterLevels = parseJsonObject(row.character_levels);
      const characterStats = parseJsonArray(row.character_stats);
      const combinedLevels = intValue(row.combined_character_levels) || combinedCharacterLevels(characterLevels);
      return {
        rank: index + 1,
        player: resolvePublicLabel(row.player_id, aliasMap),
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

function timingSafeEqual(a, b) {
  const aStr = String(a ?? "");
  const bStr = String(b ?? "");
  if (aStr.length !== bStr.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aStr.length; i += 1) {
    mismatch |= aStr.charCodeAt(i) ^ bStr.charCodeAt(i);
  }
  return mismatch === 0;
}

// Verifies a Stripe webhook signature without the Stripe SDK: recompute
// HMAC-SHA256 over "<timestamp>.<rawBody>" and compare to the v1 signature,
// rejecting stale timestamps to blunt replay attacks.
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = {};
  for (const segment of String(signatureHeader).split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) (parts[key.trim()] ||= value.trim());
  }
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, parts.v1);
}

function siteUrl(env) {
  const configured = textValue(env.SITE_URL, 200);
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

async function handleShopCreateCheckout(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments are not configured." }, 500, headers);
  const parsed = await boundedJsonBody(request, 4_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const recoveryCode = normalizeRecoveryCode(parsed.value?.recoveryCode);
  const packId = textValue(parsed.value?.packId, 40);
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  const pack = packId ? TOKEN_PACKS[packId] : null;
  if (!pack) return json({ error: "Unknown token pack." }, 400, headers);

  const base = siteUrl(env);
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${base}/?shop=success`);
  form.set("cancel_url", `${base}/?shop=cancel`);
  form.set("client_reference_id", recoveryCode);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "gbp");
  form.set("line_items[0][price_data][unit_amount]", String(pack.gbpPence));
  form.set("line_items[0][price_data][product_data][name]", pack.label);
  form.set("metadata[recovery_code]", recoveryCode);
  form.set("metadata[tokens]", String(pack.tokens));
  form.set("metadata[pack_id]", packId);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const session = await stripeResponse.json().catch(() => null);
  if (!stripeResponse.ok || !session?.url) {
    return json({ error: "Could not start checkout." }, 502, headers);
  }
  return json({ ok: true, url: session.url }, 200, { ...headers, "cache-control": "no-store" });
}

async function handleShopStripeWebhook(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const rawBody = await request.text();
  const valid = await verifyStripeSignature(
    rawBody,
    request.headers.get("stripe-signature"),
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!valid) return json({ error: "Invalid signature." }, 400, headers);

  let event = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid payload." }, 400, headers);
  }

  // Only completed, paid checkouts credit tokens. Everything else is acked.
  if (event?.type !== "checkout.session.completed" || event?.data?.object?.payment_status !== "paid") {
    return json({ received: true }, 200, headers);
  }

  const eventId = textValue(event?.id, 120);
  const metadata = event?.data?.object?.metadata ?? {};
  const recoveryCode = normalizeRecoveryCode(metadata.recovery_code);
  const tokens = intValue(metadata.tokens, 0);
  if (!eventId || !recoveryCode || tokens <= 0) {
    // Malformed but validly-signed - ack so Stripe stops retrying.
    return json({ received: true }, 200, headers);
  }

  const dedupe = await env.DB.prepare(
    "INSERT OR IGNORE INTO stripe_events (event_id) VALUES (?)",
  ).bind(eventId).run();
  if ((dedupe?.meta?.changes ?? 0) !== 1) {
    // Already processed this event - do not credit again.
    return json({ received: true, duplicate: true }, 200, headers);
  }

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO token_accounts (recovery_code, balance)
      VALUES (?, ?)
      ON CONFLICT(recovery_code) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = CURRENT_TIMESTAMP
    `).bind(recoveryCode, tokens),
    env.DB.prepare(`
      INSERT INTO token_ledger (recovery_code, delta, reason, ref)
      VALUES (?, ?, 'credit:purchase', ?)
    `).bind(recoveryCode, tokens, eventId),
  ]);

  return json({ received: true, credited: tokens }, 200, headers);
}

async function handleShopBalanceGet(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const url = new URL(request.url);
  const recoveryCode = normalizeRecoveryCode(url.searchParams.get("recoveryCode"));
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  const row = await env.DB.prepare(
    "SELECT balance FROM token_accounts WHERE recovery_code = ?",
  ).bind(recoveryCode).first();
  return json({ ok: true, balance: intValue(row?.balance) }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

// Returns every one-off unlock the account owns (server source of truth), so
// the client can re-apply them after a save reset, rebirth, or device change.
async function handleShopUnlocksGet(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const url = new URL(request.url);
  const recoveryCode = normalizeRecoveryCode(url.searchParams.get("recoveryCode"));
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  const rows = await env.DB.prepare(
    "SELECT unlock_key FROM account_unlocks WHERE recovery_code = ?",
  ).bind(recoveryCode).all();
  const unlocks = (rows?.results ?? [])
    .map((row) => String(row.unlock_key))
    .filter((key) => PAGE_UNLOCK_KEYS.has(key));
  const balanceRow = await env.DB.prepare(
    "SELECT balance FROM token_accounts WHERE recovery_code = ?",
  ).bind(recoveryCode).first();
  return json({ ok: true, unlocks, balance: intValue(balanceRow?.balance) }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

// Buys a one-off page unlock for PAGE_UNLOCK_TOKEN_COST tokens. Idempotent:
// re-requesting an owned unlock never charges again.
async function handleShopUnlockPost(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const parsed = await boundedJsonBody(request, 4_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const recoveryCode = normalizeRecoveryCode(parsed.value?.recoveryCode);
  const unlockKey = textValue(parsed.value?.unlockKey, 60);
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  if (!PAGE_UNLOCK_KEYS.has(unlockKey)) return json({ error: "Unknown unlock." }, 400, headers);
  const cost = UNLOCK_TOKEN_COSTS[unlockKey];

  // Reserve the unlock first (idempotent). If the row already existed the player
  // already owns it, so we never charge a second time.
  const reserve = await env.DB.prepare(
    "INSERT OR IGNORE INTO account_unlocks (recovery_code, unlock_key) VALUES (?, ?)",
  ).bind(recoveryCode, unlockKey).run();
  if ((reserve?.meta?.changes ?? 0) !== 1) {
    const ownedRow = await env.DB.prepare(
      "SELECT balance FROM token_accounts WHERE recovery_code = ?",
    ).bind(recoveryCode).first();
    return json({ ok: true, alreadyOwned: true, unlockKey, balance: intValue(ownedRow?.balance) }, 200, {
      ...headers,
      "cache-control": "no-store",
    });
  }

  // Newly reserved - charge atomically. The `balance >= cost` guard means
  // concurrent requests can never drive the balance negative.
  const charge = await env.DB.prepare(`
    UPDATE token_accounts
    SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
    WHERE recovery_code = ? AND balance >= ?
  `).bind(cost, recoveryCode, cost).run();
  if ((charge?.meta?.changes ?? 0) !== 1) {
    // Could not pay - release the reservation so they can retry after buying tokens.
    await env.DB.prepare(
      "DELETE FROM account_unlocks WHERE recovery_code = ? AND unlock_key = ?",
    ).bind(recoveryCode, unlockKey).run();
    return json({ error: "Not enough tokens.", code: "INSUFFICIENT_TOKENS" }, 402, headers);
  }

  await env.DB.prepare(`
    INSERT INTO token_ledger (recovery_code, delta, reason, ref)
    VALUES (?, ?, 'spend:unlock', ?)
  `).bind(recoveryCode, -cost, unlockKey).run();

  const balanceRow = await env.DB.prepare(
    "SELECT balance FROM token_accounts WHERE recovery_code = ?",
  ).bind(recoveryCode).first();
  return json({ ok: true, unlockKey, balance: intValue(balanceRow?.balance) }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

async function handlePlayerAliasGet(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const url = new URL(request.url);
  const playerId = aliasPlayerIdValue(url.searchParams.get("playerId"));
  if (!playerId) return json({ error: "Invalid player identity." }, 400, headers);
  const row = await env.DB.prepare(
    "SELECT alias FROM player_aliases WHERE player_id = ?",
  ).bind(playerId).first();
  return json({ ok: true, alias: row?.alias ?? null }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

async function handlePlayerAliasPost(request, env, headers) {
  if (!env.DB) return json({ error: "Database binding DB is missing." }, 500, headers);
  const parsed = await boundedJsonBody(request, 2_000);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, headers);
  const playerId = aliasPlayerIdValue(parsed.value?.playerId);
  const recoveryCode = normalizeRecoveryCode(parsed.value?.recoveryCode);
  const alias = normalizePlayerAlias(parsed.value?.alias);
  if (!playerId) return json({ error: "Invalid player identity." }, 400, headers);
  if (!recoveryCode) return json({ error: "Invalid recovery code." }, 400, headers);
  if (!alias) {
    return json({
      error: "Alias must be 3-16 characters using letters, numbers, spaces or . _ ' -",
      code: "ALIAS_INVALID",
    }, 400, headers);
  }

  // Binding: only the recovery code that first claimed a player id can rename it.
  const existing = await env.DB.prepare(
    "SELECT recovery_code FROM player_aliases WHERE player_id = ?",
  ).bind(playerId).first();
  if (existing && existing.recovery_code !== recoveryCode) {
    return json({ error: "This name is managed by another account.", code: "ALIAS_LOCKED" }, 403, headers);
  }

  // Case-insensitive uniqueness across every other player.
  const taken = await env.DB.prepare(
    "SELECT player_id FROM player_aliases WHERE alias_lower = ? AND player_id <> ?",
  ).bind(alias.toLowerCase(), playerId).first();
  if (taken) return json({ error: "That name is already taken.", code: "ALIAS_TAKEN" }, 409, headers);

  try {
    await env.DB.prepare(`
      INSERT INTO player_aliases (player_id, recovery_code, alias, alias_lower)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        alias = excluded.alias,
        alias_lower = excluded.alias_lower,
        recovery_code = excluded.recovery_code,
        updated_at = CURRENT_TIMESTAMP
    `).bind(playerId, recoveryCode, alias, alias.toLowerCase()).run();
  } catch {
    // The unique index can still trip under a race; report it as taken.
    return json({ error: "That name is already taken.", code: "ALIAS_TAKEN" }, 409, headers);
  }

  return json({ ok: true, alias }, 200, {
    ...headers,
    "cache-control": "no-store",
  });
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    if (url.pathname === "/stats" && request.method === "POST") return handleStatsPost(request, env, headers);
    if (url.pathname === "/telemetry" && request.method === "POST") return handleTelemetryPost(request, env, headers);
    if (url.pathname === "/metrics" && request.method === "GET") return handleMetricsGet(request, env, headers);
    if (url.pathname === "/cloud-save" && request.method === "POST") return handleCloudSavePost(request, env, headers);
    if (url.pathname === "/cloud-save/restore" && request.method === "POST") return handleCloudSaveRestore(request, env, headers);
    if (url.pathname === "/leaderboard" && request.method === "GET") return handleLeaderboardGet(request, env, headers);
    if (url.pathname === "/shop/create-checkout" && request.method === "POST") return handleShopCreateCheckout(request, env, headers);
    if (url.pathname === "/shop/stripe-webhook" && request.method === "POST") return handleShopStripeWebhook(request, env, headers);
    if (url.pathname === "/shop/balance" && request.method === "GET") return handleShopBalanceGet(request, env, headers);
    if (url.pathname === "/shop/unlocks" && request.method === "GET") return handleShopUnlocksGet(request, env, headers);
    if (url.pathname === "/shop/unlock-page" && request.method === "POST") return handleShopUnlockPost(request, env, headers);
    if (url.pathname === "/player/alias" && request.method === "GET") return handlePlayerAliasGet(request, env, headers);
    if (url.pathname === "/player/alias" && request.method === "POST") return handlePlayerAliasPost(request, env, headers);
    if (url.pathname === "/town-messages" && request.method === "GET") return handleTownMessagesGet(request, env, headers);
    if (url.pathname === "/town-messages" && request.method === "POST") return handleTownMessagesPost(request, env, headers);
    if (url.pathname === "/admin/town-messages" && request.method === "GET") return handleAdminTownMessagesGet(request, env, headers);
    if (url.pathname === "/admin/town-messages/review" && request.method === "POST") return handleAdminTownMessagesReview(request, env, headers);
    if (url.pathname === "/admin/integrity" && request.method === "GET") return handleAdminIntegrityGet(request, env, headers);
    if (url.pathname === "/admin/integrity/manual-exclude" && request.method === "POST") return handleAdminIntegrityManualExclude(request, env, headers);
    if (url.pathname === "/admin/integrity/review" && request.method === "POST") return handleAdminIntegrityReview(request, env, headers);
    if (url.pathname === "/integrity" && request.method === "GET") {
      return new Response(INTEGRITY_PANEL_HTML, {
        status: 200,
        headers: {
          ...headers,
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-frame-options": "DENY",
          "referrer-policy": "no-referrer",
        },
      });
    }
    if ((url.pathname === "/messages" || url.pathname === "/moderation") && request.method === "GET") {
      return new Response(MESSAGE_MODERATION_PANEL_HTML, {
        status: 200,
        headers: {
          ...headers,
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
          "x-frame-options": "DENY",
          "referrer-policy": "no-referrer",
        },
      });
    }
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
