import assert from "node:assert/strict";
import test from "node:test";

import worker from "../tools/stats-worker/worker.js";
import {
  ITEM_INTEGRITY_RULES_VERSION,
  ITEM_RULES,
} from "../tools/stats-worker/itemLegality.js";

function emptyStats() {
  return {
    dc: [0, 0], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0],
    hp: 0, mp: 0, accuracy: 0, agility: 0, luck: 0, attackSpeed: 0,
    poisonAttack: 0, freezing: 0, magicResist: 0, poisonResist: 0,
    healthRecovery: 0, poisonRecovery: 0, strong: 0, xpBonusPercent: 0,
  };
}

// The shape the worker stores: every bonus-stat key present, zero-filled.
function emptyStoredStats() {
  return {
    dc: [0, 0], mc: [0, 0], sc: [0, 0], ac: [0, 0], amc: [0, 0],
    hp: 0, mp: 0, accuracy: 0, agility: 0, luck: 0, attackSpeed: 0,
    poisonAttack: 0, freezing: 0, magicResist: 0, poisonResist: 0,
    healthRecovery: 0, poisonRecovery: 0, strong: 0, xpBonusPercent: 0,
    goldBonusPercent: 0, bonusAwakeningSoulChancePercent: 0,
    damageTakenReductionPercent: 0, critChancePercent: 0, critDamagePercent: 0,
    skillLevelBonusPercent: 0, potionRestoreBonusPercent: 0,
    dropChanceBonusPercent: 0,
  };
}

const weaponId = Object.keys(ITEM_RULES).find((id) => ITEM_RULES[id].slots.includes("weapon"));

function equipmentEntry(overrides = {}) {
  return {
    instanceId: "item-1",
    itemId: weaponId,
    smithLevel: 0,
    weaponRefineLevel: 0,
    gemCount: 0,
    empowered: false,
    empowerTier: 0,
    bonusStats: emptyStats(),
    smithBonusStats: emptyStats(),
    empowerBonusStats: emptyStats(),
    empowerSpellBonuses: {},
    ...overrides,
  };
}

function payload(entry = equipmentEntry(), rulesVersion = ITEM_INTEGRITY_RULES_VERSION) {
  return {
    playerId: "test-player-123",
    integrityRulesVersion: rulesVersion,
    saveVersion: 8,
    account: { characterLevels: { Warrior: 10 }, highestCharacterLevel: 10 },
    characters: [{ characterClass: "Warrior", level: 10, equipment: { weapon: entry } }],
  };
}

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() { this.db.queries.push(this); return this.db.existing; }
  async all() {
    this.db.queries.push(this);
    const placeholders = (this.sql.match(/\?/g) ?? []).length;
    assert.equal(this.args.length, placeholders, "D1 bind count should match SQL placeholders");
    return { results: this.db.results };
  }
  async run() {
    this.db.queries.push(this);
    const placeholders = (this.sql.match(/\?/g) ?? []).length;
    assert.equal(this.args.length, placeholders, "D1 bind count should match SQL placeholders");
    return { meta: { changes: 1 } };
  }
}

class FakeDb {
  constructor({ existing = null, results = [] } = {}) {
    this.existing = existing;
    this.results = results;
    this.queries = [];
  }
  prepare(sql) { return new FakeStatement(this, sql); }
}

async function postStats(db, body, extraEnv = {}) {
  return worker.fetch(new Request("https://stats.example/stats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { DB: db, ALLOWED_ORIGIN: "*", ADMIN_TOKEN: "secret", ...extraEnv });
}

function insertStatus(db) {
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  return insert?.args[18];
}

test("legal current payload is stored as clear", async () => {
  const db = new FakeDb();
  const response = await postStats(db, payload());
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "clear");
});

// The client omits zero-valued bonus stats to stay under the browser's 64 KiB
// keepalive quota, so a sparse payload must round-trip to the same stored gear
// and must not read as a different (cheating) item than the padded form did.
test("omitted zero-valued bonus stats round-trip to zero defaults and stay clear", async () => {
  const db = new FakeDb();
  const entry = equipmentEntry({ bonusStats: {}, smithBonusStats: {}, empowerBonusStats: {} });
  const response = await postStats(db, payload(entry));
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "clear");
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  const stored = JSON.parse(insert.args[14])[0].equipment.weapon;
  assert.deepEqual(stored.bonusStats, emptyStoredStats());
  assert.deepEqual(stored.smithBonusStats, emptyStoredStats());
  assert.deepEqual(stored.empowerBonusStats, emptyStoredStats());
});

test("potionRestoreBonusPercent survives into another player's Social view", async () => {
  const db = new FakeDb();
  const entry = equipmentEntry({ bonusStats: { potionRestoreBonusPercent: 15 } });
  const response = await postStats(db, payload(entry));
  assert.equal(response.status, 200);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  const stored = JSON.parse(insert.args[14])[0].equipment.weapon;
  assert.equal(stored.bonusStats.potionRestoreBonusPercent, 15);
});

test("awakening souls upsert stores the current held count, not a lifetime max", async () => {
  const db = new FakeDb();
  const body = payload();
  body.account.awakeningSoulsHeld = 94;
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.ok(insert);
  assert.match(insert.sql, /awakening_souls_held = excluded\.awakening_souls_held/);
  assert.doesNotMatch(insert.sql, /awakening_souls_held = MAX\(/);
  assert.equal(insert.args[15], 94);
});

test("impossible equipment is flagged but not automatically excluded", async () => {
  const smithBonusStats = emptyStats();
  smithBonusStats.dc[1] = 20;
  const db = new FakeDb();
  const response = await postStats(db, payload(equipmentEntry({ smithLevel: 20, smithBonusStats })));
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "flagged");
  assert.notEqual(insertStatus(db), "excluded");
});

test("character levels through the Social cap stay visible", async () => {
  const db = new FakeDb();
  const body = payload();
  body.account.characterLevels = { Warrior: 130, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 130;
  body.characters = [{ characterClass: "Warrior", level: 130, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "clear");
});

test("impossible character levels are automatically excluded from Social", async () => {
  const db = new FakeDb();
  const body = payload();
  body.account.characterLevels = { Warrior: 160, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 160;
  body.characters = [{ characterClass: "Warrior", level: 160, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "excluded");
});

test("auto-hidden level-cap exclusions can return once they are legal again", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 0,
      character_levels: JSON.stringify({ Warrior: 105, Wizard: 1, Taoist: 1 }),
      character_stats: JSON.stringify([{ characterClass: "Warrior", level: 105, equipment: {} }]),
      combined_character_levels: 107,
      integrity_status: "excluded",
      integrity_reason: JSON.stringify([{
        code: "invalid_level",
        detail: "A submitted character level exceeds the current cap of 100.",
      }]),
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload();
  body.account.characterLevels = { Warrior: 105, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 105;
  body.characters = [{ characterClass: "Warrior", level: 105, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "clear");
});

test("manual Social exclusions stay hidden after a later legal submission", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 0,
      character_levels: JSON.stringify({ Warrior: 80, Wizard: 1, Taoist: 1 }),
      character_stats: JSON.stringify([{ characterClass: "Warrior", level: 80, equipment: {} }]),
      combined_character_levels: 82,
      integrity_status: "excluded",
      integrity_reason: JSON.stringify([{
        code: "manual_exclusion",
        detail: "Manually removed from Social by an administrator.",
      }]),
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const response = await postStats(db, payload());
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "excluded");
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  const reason = JSON.parse(insert.args[19]);
  assert.equal(reason[0]?.code, "manual_exclusion");
});

test("missing integrity version enters review instead of bypassing validation", async () => {
  const db = new FakeDb();
  await postStats(db, payload(equipmentEntry(), null));
  assert.equal(insertStatus(db), "flagged");
});

test("missing integrity version remains legacy during configured rollout grace", async () => {
  const db = new FakeDb();
  await postStats(db, payload(equipmentEntry(), null), { INTEGRITY_ENFORCE_AFTER: "2099-01-01T00:00:00Z" });
  assert.equal(insertStatus(db), "legacy");
});

test("admin review API requires its secret", async () => {
  const db = new FakeDb();
  const response = await worker.fetch(new Request("https://stats.example/admin/integrity"), {
    DB: db,
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGIN: "*",
  });
  assert.equal(response.status, 401);
});

test("admin can approve removal after authentication", async () => {
  const db = new FakeDb();
  const response = await worker.fetch(new Request("https://stats.example/admin/integrity/review", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ playerId: "test-player-123", action: "exclude" }),
  }), { DB: db, ADMIN_TOKEN: "secret", ALLOWED_ORIGIN: "*" });
  assert.equal(response.status, 200);
  const update = db.queries.find((query) => /integrity_status = 'excluded'/.test(query.sql));
  assert.ok(update);
});

test("admin can manually exclude an exact player ID", async () => {
  const db = new FakeDb({ existing: { player_id: "manual-player-123" } });
  const response = await worker.fetch(new Request("https://stats.example/admin/integrity/manual-exclude", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ player: "manual-player-123" }),
  }), { DB: db, ADMIN_TOKEN: "secret", ALLOWED_ORIGIN: "*" });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.playerId, "manual-player-123");
  const update = db.queries.find((query) => /manual_exclusion/.test(query.args[0] ?? ""));
  assert.deepEqual(update.args.slice(1), ["manual-player-123"]);
});

test("admin can manually exclude one account by its public Social label", async () => {
  const db = new FakeDb({ results: [{ player_id: "abcdef12-unique-account" }] });
  const response = await worker.fetch(new Request("https://stats.example/admin/integrity/manual-exclude", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ player: "Player abcdef12" }),
  }), { DB: db, ADMIN_TOKEN: "secret", ALLOWED_ORIGIN: "*" });
  assert.equal(response.status, 200);
  const prefixQuery = db.queries.find((query) => /substr\(player_id/.test(query.sql));
  assert.deepEqual(prefixQuery.args, [8, "abcdef12"]);
  const data = await response.json();
  assert.equal(data.playerId, "abcdef12-unique-account");
});

test("manual Social exclusion refuses an ambiguous public label", async () => {
  const db = new FakeDb({
    results: [
      { player_id: "abcdef12-first-account" },
      { player_id: "abcdef12-second-account" },
    ],
  });
  const response = await worker.fetch(new Request("https://stats.example/admin/integrity/manual-exclude", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ player: "Player abcdef12" }),
  }), { DB: db, ADMIN_TOKEN: "secret", ALLOWED_ORIGIN: "*" });
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.equal(data.matches.length, 2);
  assert.equal(db.queries.some((query) => /UPDATE leaderboard/.test(query.sql)), false);
});

test("public leaderboard hides excluded rows and levels above the cap", async () => {
  const db = new FakeDb({ results: [] });
  const response = await worker.fetch(new Request("https://stats.example/leaderboard?scope=accounts"), {
    DB: db,
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGIN: "*",
  });
  assert.equal(response.status, 200);
  const select = db.queries.find((query) => /FROM leaderboard/.test(query.sql));
  assert.match(select.sql, /integrity_status, 'legacy'\) != 'excluded'/);
  assert.match(select.sql, /highest_level <= 150/);
  assert.doesNotMatch(select.sql, /integrity_status\s*=\s*'flagged'/);
});

test("integrity review page contains no embedded admin secret", async () => {
  const response = await worker.fetch(new Request("https://stats.example/integrity"), {
    DB: new FakeDb(),
    ADMIN_TOKEN: "secret-value-must-not-leak",
    ALLOWED_ORIGIN: "*",
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Integrity Review/);
  assert.doesNotMatch(html, /secret-value-must-not-leak/);
});

test("weaker character snapshots do not overwrite stronger Social progress", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 0,
      rebirth_points_gained: 0,
      rebirth_points_spent: 0,
      character_levels: JSON.stringify({ Warrior: 58, Wizard: 50, Taoist: 49 }),
      character_stats: JSON.stringify([{ characterClass: "Warrior", level: 58, equipment: {} }]),
      combined_character_levels: 157,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload();
  body.account.characterLevels = { Warrior: 1, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 1;
  body.account.rebirthCount = 0;
  body.characters = [{ characterClass: "Warrior", level: 1, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.characterSnapshotUpdated, false);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.equal(insert.args[13], JSON.stringify({ Warrior: 58, Wizard: 50, Taoist: 49 }));
  assert.equal(insert.args[16], 157);
  assert.match(insert.args[14], /"level":58/);
});

test("equal or higher combined levels still refresh the Social character snapshot", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 0,
      character_levels: JSON.stringify({ Warrior: 10, Wizard: 1, Taoist: 1 }),
      character_stats: JSON.stringify([{ characterClass: "Warrior", level: 10, equipment: {} }]),
      combined_character_levels: 12,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload(equipmentEntry({ smithLevel: 3 }));
  body.account.characterLevels = { Warrior: 10, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 10;
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.characterSnapshotUpdated, true);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.match(insert.args[14], /"smithLevel":3/);
});

test("rebirth may reset Social character levels even when combined drops", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 1,
      character_levels: JSON.stringify({ Warrior: 58, Wizard: 50, Taoist: 49 }),
      character_stats: JSON.stringify([{ characterClass: "Warrior", level: 58, equipment: {} }]),
      combined_character_levels: 157,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload();
  body.account.characterLevels = { Warrior: 1, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 1;
  body.account.rebirthCount = 2;
  body.characters = [{ characterClass: "Warrior", level: 1, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.characterSnapshotUpdated, true);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.equal(insert.args[13], JSON.stringify({ Warrior: 1, Wizard: 1, Taoist: 1 }));
  assert.equal(insert.args[16], 3);
});

test("ascended board ranks only players who have ascended", async () => {
  const db = new FakeDb({ results: [] });
  const response = await worker.fetch(new Request("https://stats.example/leaderboard?scope=accounts&board=ascended"), {
    DB: db,
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGIN: "*",
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.board, "ascended");
  const select = db.queries.find((query) => /FROM leaderboard/.test(query.sql));
  assert.match(select.sql, /ascension_count > 0/);
  assert.match(select.sql, /ORDER BY ascension_count DESC/);
  assert.match(select.sql, /integrity_status, 'legacy'\) != 'excluded'/);
});

test("standard board stays ranked by combined levels", async () => {
  const db = new FakeDb({ results: [] });
  const response = await worker.fetch(new Request("https://stats.example/leaderboard?scope=accounts"), {
    DB: db,
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGIN: "*",
  });
  const data = await response.json();
  assert.equal(data.board, "standard");
  const select = db.queries.find((query) => /FROM leaderboard/.test(query.sql));
  assert.doesNotMatch(select.sql, /ascension_count > 0/);
  assert.match(select.sql, /ORDER BY combined_character_levels DESC/);
});

test("ascension stats climb, and a slower best time does not replace a faster one", async () => {
  const day = 24 * 60 * 60 * 1000;
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 2,
      character_levels: JSON.stringify({ Warrior: 20, Wizard: 1, Taoist: 1 }),
      character_stats: "[]",
      combined_character_levels: 22,
      ascension_count: 4,
      ascension_points: 30,
      current_highest_level: 20,
      current_journey_ms: 2 * day,
      best_journey_ms: 5 * day,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload();
  body.account.characterLevels = { Warrior: 21, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 21;
  body.account.rebirthCount = 2;
  body.account.ascensionCount = 3;
  body.account.ascensionPoints = 24;
  body.account.currentJourneyMs = 3 * day;
  body.account.bestJourneyMs = 9 * day;
  body.characters = [{ characterClass: "Warrior", level: 21, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.equal(insert.args[23], 4);
  assert.equal(insert.args[24], 30);
  assert.equal(insert.args[25], 21);
  assert.equal(insert.args[26], 3 * day);
  assert.equal(insert.args[27], 5 * day);
});

test("a faster best time is kept, and ascension may reset the current level and clock", async () => {
  const day = 24 * 60 * 60 * 1000;
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 2,
      character_levels: JSON.stringify({ Warrior: 80, Wizard: 70, Taoist: 60 }),
      character_stats: "[]",
      combined_character_levels: 210,
      ascension_count: 4,
      ascension_points: 30,
      current_highest_level: 80,
      current_journey_ms: 12 * day,
      best_journey_ms: 9 * day,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload();
  body.account.characterLevels = { Warrior: 1, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 1;
  body.account.rebirthCount = 3;
  body.account.ascensionCount = 5;
  body.account.ascensionPoints = 38;
  body.account.currentJourneyMs = 60 * 1000;
  body.account.bestJourneyMs = 4 * day;
  body.characters = [{ characterClass: "Warrior", level: 1, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.characterSnapshotUpdated, true);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.equal(insert.args[23], 5);
  assert.equal(insert.args[24], 38);
  assert.equal(insert.args[25], 1);
  assert.equal(insert.args[26], 60 * 1000);
  assert.equal(insert.args[27], 4 * day);
});

test("an older client that omits ascension fields does not wipe them", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 1,
      character_levels: JSON.stringify({ Warrior: 10 }),
      character_stats: "[]",
      combined_character_levels: 10,
      ascension_count: 2,
      ascension_points: 16,
      current_journey_ms: 5000,
      best_journey_ms: 80000,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const response = await postStats(db, payload());
  assert.equal(response.status, 200);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.equal(insert.args[23], 2);
  assert.equal(insert.args[24], 16);
  assert.equal(insert.args[26], 5000);
  assert.equal(insert.args[27], 80000);
});

test("ascended RP stores points gained this world, not the lifetime total or the balance", async () => {
  const db = new FakeDb({
    existing: {
      boss_kills: "{}",
      rebirth_count: 3,
      rebirth_points_gained: 9000,
      character_levels: JSON.stringify({ Warrior: 20, Wizard: 1, Taoist: 1 }),
      character_stats: "[]",
      combined_character_levels: 22,
      rebirth_points_held: 400,
      integrity_status: "clear",
      integrity_reason: "[]",
      integrity_fingerprint: "",
      integrity_approved_fingerprint: "",
    },
  });
  const body = payload();
  body.account.characterLevels = { Warrior: 21, Wizard: 1, Taoist: 1 };
  body.account.highestCharacterLevel = 21;
  body.account.rebirthCount = 3;
  body.account.rebirthPointsGained = 9000;
  body.account.rebirthPointsHeld = 40;
  body.account.runRebirthPointsGained = 150;
  body.characters = [{ characterClass: "Warrior", level: 21, equipment: {} }];
  const response = await postStats(db, body);
  assert.equal(response.status, 200);
  const insert = db.queries.find((query) => /INSERT INTO leaderboard/.test(query.sql));
  assert.equal(insert.args[11], 9000);
  assert.equal(insert.args[28], 150);
});
