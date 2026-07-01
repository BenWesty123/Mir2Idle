import assert from "node:assert/strict";
import test from "node:test";

import worker from "../tools/stats-worker/worker.js";

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

  async run() {
    this.db.queries.push(this);
    return { success: true };
  }

  async first() {
    this.db.queries.push(this);
    if (/online_now/.test(this.sql)) return this.db.overall;
    if (/sessions_24h/.test(this.sql)) return this.db.recent;
    return null;
  }

  async all() {
    this.db.queries.push(this);
    return { results: this.db.rows ?? [] };
  }
}

class FakeDb {
  constructor({ overall = null, recent = null, rows = [] } = {}) {
    this.overall = overall;
    this.recent = recent;
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

test("telemetry heartbeat upserts a session with clamped deltas", async () => {
  const db = new FakeDb();
  const response = await request("/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "abcdef12-3456:Wizard",
      sessionId: "sess-123",
      foregroundMs: 40000,
      backgroundMs: 5000,
      combatMs: 30000,
      idleMs: 15000,
      totalMs: 45000,
    }),
  }, db);

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);

  const insert = db.queries.find((query) => /INSERT INTO telemetry_sessions/.test(query.sql));
  assert.ok(insert, "expected a telemetry upsert");
  // Character suffix is stripped to the account id.
  assert.deepEqual(insert.args, ["sess-123", "abcdef12-3456", 40000, 5000, 30000, 15000, 45000]);
});

test("telemetry rejects a payload missing player or session id", async () => {
  const db = new FakeDb();
  const response = await request("/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: "abcdef12", foregroundMs: 1000 }),
  }, db);
  assert.equal(response.status, 400);
  assert.equal(db.queries.length, 0);
});

test("telemetry clamps an over-long heartbeat delta", async () => {
  const db = new FakeDb();
  await request("/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "player-a",
      sessionId: "sess-x",
      foregroundMs: 999_999_999,
      totalMs: 999_999_999,
    }),
  }, db);
  const insert = db.queries.find((query) => /INSERT INTO telemetry_sessions/.test(query.sql));
  // 10 minute cap.
  assert.equal(insert.args[2], 600_000);
  assert.equal(insert.args[6], 600_000);
});

test("metrics returns aggregated activity with hours", async () => {
  const db = new FakeDb({
    overall: {
      online_now: 3,
      dau: 12,
      wau: 40,
      total_players: 120,
      total_sessions: 800,
      foreground_ms: 3_600_000 * 10,
      background_ms: 3_600_000 * 2,
      combat_ms: 3_600_000 * 7,
      idle_ms: 3_600_000 * 5,
      total_ms: 3_600_000 * 12,
    },
    recent: {
      sessions_24h: 30,
      players_24h: 12,
      foreground_ms_24h: 3_600_000 * 4,
      background_ms_24h: 3_600_000 * 1,
      combat_ms_24h: 3_600_000 * 3,
      idle_ms_24h: 3_600_000 * 2,
      avg_session_ms_24h: 600_000,
    },
  });
  const response = await request("/metrics", { method: "GET" }, db);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.onlineNow, 3);
  assert.equal(data.dau, 12);
  assert.equal(data.wau, 40);
  assert.equal(data.totalPlayers, 120);
  assert.equal(data.allTime.foregroundHours, 10);
  assert.equal(data.allTime.combatHours, 7);
  assert.equal(data.last24h.foregroundHours, 4);
  assert.equal(data.last24h.avgSessionMinutes, 10);
});
