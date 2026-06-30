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

  async first() {
    this.db.queries.push(this);
    if (/SELECT created_at\s+FROM town_messages/.test(this.sql)) return this.db.recent;
    if (/INSERT INTO town_messages/.test(this.sql)) {
      return {
        id: 9,
        player_id: this.args[0],
        character_class: this.args[1],
        character_level: this.args[2],
        body: this.args[3],
        created_at: "2026-06-29 12:00:00",
      };
    }
    return null;
  }
}

class FakeDb {
  constructor({ rows = [], recent = null } = {}) {
    this.rows = rows;
    this.recent = recent;
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

test("town noticeboard returns the safe public Social identifier", async () => {
  const db = new FakeDb({
    rows: [{
      id: 3,
      player_id: "abcdef12-3456-7890",
      character_class: "Wizard",
      character_level: 22,
      body: "Meet me in Bicheon.",
      created_at: "2026-06-29 11:30:00",
    }],
  });
  const response = await request("/town-messages", { method: "GET" }, db);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.messages[0], {
    id: 3,
    player: "Player abcdef12",
    characterClass: "Wizard",
    characterLevel: 22,
    body: "Meet me in Bicheon.",
    createdAt: "2026-06-29 11:30:00",
  });
  assert.equal("playerId" in data.messages[0], false);
});

test("town noticeboard validates and stores a plain-text message", async () => {
  const db = new FakeDb();
  const response = await request("/town-messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "player-abcdefgh",
      characterClass: "Taoist",
      characterLevel: 17,
      body: "  Looking for a group.\u0000  ",
    }),
  }, db);
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.message.body, "Looking for a group.");
  assert.equal(data.message.player, "Player player-a");
  const insert = db.queries.find((query) => /INSERT INTO town_messages/.test(query.sql));
  assert.deepEqual(insert.args, ["player-abcdefgh", "Taoist", 17, "Looking for a group."]);
});

test("town noticeboard enforces the posting cooldown", async () => {
  const db = new FakeDb({ recent: { created_at: "2026-06-29 12:00:00" } });
  const response = await request("/town-messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "player-abcdefgh",
      characterClass: "Warrior",
      characterLevel: 9,
      body: "Second message",
    }),
  }, db);
  assert.equal(response.status, 429);
});
