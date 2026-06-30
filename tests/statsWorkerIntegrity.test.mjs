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

test("impossible equipment is flagged but not automatically excluded", async () => {
  const smithBonusStats = emptyStats();
  smithBonusStats.dc[1] = 20;
  const db = new FakeDb();
  const response = await postStats(db, payload(equipmentEntry({ smithLevel: 20, smithBonusStats })));
  assert.equal(response.status, 200);
  assert.equal(insertStatus(db), "flagged");
  assert.notEqual(insertStatus(db), "excluded");
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

test("public leaderboard excludes only administrator-excluded rows", async () => {
  const db = new FakeDb({ results: [] });
  const response = await worker.fetch(new Request("https://stats.example/leaderboard?scope=accounts"), {
    DB: db,
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGIN: "*",
  });
  assert.equal(response.status, 200);
  const select = db.queries.find((query) => /FROM leaderboard/.test(query.sql));
  assert.match(select.sql, /integrity_status, 'legacy'\) != 'excluded'/);
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
