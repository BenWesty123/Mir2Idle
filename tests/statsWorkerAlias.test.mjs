import assert from "node:assert/strict";
import test from "node:test";

import worker from "../tools/stats-worker/worker.js";

const VALID_CODE = "MIR-ABCD-EFGH-JKLM-NPQR";
const OTHER_CODE = "MIR-ABCD-EFGH-JKLM-NPQS";

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    this.db.queries.push(this);
    if (/SELECT recovery_code FROM player_aliases WHERE player_id = \?/.test(this.sql)) {
      const row = this.db.aliases.get(this.args[0]);
      return row ? { recovery_code: row.recovery_code } : null;
    }
    if (/SELECT player_id FROM player_aliases WHERE alias_lower = \? AND player_id <> \?/.test(this.sql)) {
      const [aliasLower, playerId] = this.args;
      for (const [key, row] of this.db.aliases) {
        if (row.alias_lower === aliasLower && key !== playerId) return { player_id: key };
      }
      return null;
    }
    if (/SELECT alias FROM player_aliases WHERE player_id = \?/.test(this.sql)) {
      const row = this.db.aliases.get(this.args[0]);
      return row ? { alias: row.alias } : null;
    }
    return null;
  }

  async all() {
    this.db.queries.push(this);
    if (/SELECT player_id, alias FROM player_aliases WHERE player_id IN/.test(this.sql)) {
      const results = [];
      for (const playerId of this.args) {
        const row = this.db.aliases.get(playerId);
        if (row) results.push({ player_id: playerId, alias: row.alias });
      }
      return { results };
    }
    return { results: this.db.rows };
  }

  async run() {
    this.db.queries.push(this);
    if (/INSERT INTO player_aliases/.test(this.sql)) {
      const [playerId, recoveryCode, alias, aliasLower] = this.args;
      this.db.aliases.set(playerId, { recovery_code: recoveryCode, alias, alias_lower: aliasLower });
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }
}

class FakeDb {
  constructor({ aliases = {}, rows = [] } = {}) {
    this.aliases = new Map(Object.entries(aliases));
    this.rows = rows;
    this.queries = [];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

function request(path, options, db) {
  return worker.fetch(new Request(`https://stats.example${path}`, options), {
    DB: db,
    ALLOWED_ORIGIN: "*",
  });
}

function postAlias(db, body) {
  return request("/player/alias", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, db);
}

test("player alias: claim a new name and read it back", async () => {
  const db = new FakeDb();
  const response = await postAlias(db, { playerId: "player-abcdefgh", recoveryCode: VALID_CODE, alias: "  Sir  Galahad  " });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.alias, "Sir Galahad");
  assert.equal(db.aliases.get("player-abcdefgh").alias_lower, "sir galahad");

  const getResponse = await request("/player/alias?playerId=player-abcdefgh", { method: "GET" }, db);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), { ok: true, alias: "Sir Galahad" });
});

test("player alias: the owning recovery code can rename", async () => {
  const db = new FakeDb({ aliases: { "player-abcdefgh": { recovery_code: VALID_CODE, alias: "Old", alias_lower: "old" } } });
  const response = await postAlias(db, { playerId: "player-abcdefgh", recoveryCode: VALID_CODE, alias: "Newer" });
  assert.equal(response.status, 200);
  assert.equal(db.aliases.get("player-abcdefgh").alias, "Newer");
});

test("player alias: rejects invalid names", async () => {
  const db = new FakeDb();
  for (const alias of ["ab", "x".repeat(17), "no@symbols", "Player One"]) {
    const response = await postAlias(db, { playerId: "player-abcdefgh", recoveryCode: VALID_CODE, alias });
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(alias)}`);
    const data = await response.json();
    assert.equal(data.code, "ALIAS_INVALID");
  }
});

test("player alias: rejects a name taken by another player (case-insensitive)", async () => {
  const db = new FakeDb({ aliases: { "player-someone1": { recovery_code: OTHER_CODE, alias: "Taken", alias_lower: "taken" } } });
  const response = await postAlias(db, { playerId: "player-abcdefgh", recoveryCode: VALID_CODE, alias: "TAKEN" });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "ALIAS_TAKEN");
});

test("player alias: another recovery code cannot rename a claimed player id", async () => {
  const db = new FakeDb({ aliases: { "player-abcdefgh": { recovery_code: VALID_CODE, alias: "Mine", alias_lower: "mine" } } });
  const response = await postAlias(db, { playerId: "player-abcdefgh", recoveryCode: OTHER_CODE, alias: "Stolen" });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "ALIAS_LOCKED");
});

test("player alias: rejects a missing recovery code", async () => {
  const db = new FakeDb();
  const response = await postAlias(db, { playerId: "player-abcdefgh", recoveryCode: "nope", alias: "Valid Name" });
  assert.equal(response.status, 400);
});

test("town noticeboard resolves the alias for a message author", async () => {
  const db = new FakeDb({
    aliases: { "abcdef12-3456-7890": { recovery_code: VALID_CODE, alias: "Gandalf", alias_lower: "gandalf" } },
    rows: [{
      id: 3,
      player_id: "abcdef12-3456-7890",
      character_class: "Wizard",
      character_level: 22,
      body: "You shall not pass.",
      created_at: "2026-06-29 11:30:00",
    }],
  });
  const response = await request("/town-messages", { method: "GET" }, db);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.messages[0].player, "Gandalf");
  assert.equal("playerId" in data.messages[0], false);
});
