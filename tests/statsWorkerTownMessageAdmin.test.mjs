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

  async all() {
    this.db.queries.push(this);
    return { results: this.db.rows };
  }

  async run() {
    this.db.queries.push(this);
    return { meta: { changes: this.db.changes } };
  }
}

class FakeDb {
  constructor({ rows = [], changes = 1 } = {}) {
    this.rows = rows;
    this.changes = changes;
    this.queries = [];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

function request(path, options = {}, db = new FakeDb()) {
  return worker.fetch(new Request(`https://stats.example${path}`, options), {
    DB: db,
    ALLOWED_ORIGIN: "*",
    ADMIN_TOKEN: "correct-token",
  });
}

function adminHeaders() {
  return { authorization: "Bearer correct-token" };
}

test("message moderation page loads without exposing data", async () => {
  const response = await request("/messages");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Town Message Moderation/);
});

test("message moderation API requires the admin token", async () => {
  const response = await request("/admin/town-messages?status=visible");
  assert.equal(response.status, 401);
});

test("message moderation API returns private review details", async () => {
  const db = new FakeDb({
    rows: [{
      id: 7,
      player_id: "abcdef12-private",
      character_class: "Wizard",
      character_level: 31,
      body: "A message to review.",
      created_at: "2026-06-30 08:00:00",
      expires_at: "2026-07-14 08:00:00",
      status: "visible",
    }],
  });
  const response = await request("/admin/town-messages?status=visible", { headers: adminHeaders() }, db);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.rows[0], {
    id: 7,
    playerId: "abcdef12-private",
    playerLabel: "Player abcdef12",
    characterClass: "Wizard",
    characterLevel: 31,
    body: "A message to review.",
    createdAt: "2026-06-30 08:00:00",
    expiresAt: "2026-07-14 08:00:00",
    status: "visible",
  });
});

test("message moderation can remove a message", async () => {
  const db = new FakeDb();
  const response = await request("/admin/town-messages/review", {
    method: "POST",
    headers: { ...adminHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ messageId: 12, action: "remove" }),
  }, db);
  assert.equal(response.status, 200);
  const update = db.queries.find((query) => /SET status = 'removed'/.test(query.sql));
  assert.deepEqual(update.args, [12]);
});

test("message moderation can restore a message", async () => {
  const db = new FakeDb();
  const response = await request("/admin/town-messages/review", {
    method: "POST",
    headers: { ...adminHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ messageId: 13, action: "restore" }),
  }, db);
  assert.equal(response.status, 200);
  const update = db.queries.find((query) => /SET status = 'visible'/.test(query.sql));
  assert.match(update.sql, /datetime\('now', '\+14 days'\)/);
  assert.deepEqual(update.args, [13]);
});
