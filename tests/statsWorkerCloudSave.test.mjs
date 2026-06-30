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
    return { meta: { changes: 1 } };
  }

  async first() {
    this.db.queries.push(this);
    if (/SELECT saved_at FROM cloud_saves/.test(this.sql)) return { saved_at: "2026-06-27 12:00:00" };
    return this.db.restoreRow;
  }
}

class FakeDb {
  constructor(restoreRow = null) {
    this.restoreRow = restoreRow;
    this.queries = [];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

const recoveryCode = "MIR-ABCD-2345-EFGH-6789";
const save = {
  version: 1,
  savedAt: 123456,
  activeCharacterId: "Warrior",
  characters: { Warrior: { game: { progress: { level: 7 } } } },
};

async function post(path, body, db = new FakeDb()) {
  const response = await worker.fetch(new Request(`https://stats.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { DB: db, ALLOWED_ORIGIN: "*", ADMIN_TOKEN: "secret" });
  return { response, db };
}

test("cloud save stores a versioned snapshot under its normalized recovery code", async () => {
  const { response, db } = await post("/cloud-save", { recoveryCode: recoveryCode.toLowerCase(), save });
  assert.equal(response.status, 200);
  const upsert = db.queries.find((query) => /INSERT INTO cloud_saves/.test(query.sql));
  assert.ok(upsert);
  assert.equal(upsert.args[0], recoveryCode);
  assert.equal(upsert.args[1], 1);
  assert.deepEqual(JSON.parse(upsert.args[2]), save);
});

test("cloud save rejects malformed recovery codes and snapshots", async () => {
  assert.equal((await post("/cloud-save", { recoveryCode: "bad", save })).response.status, 400);
  assert.equal((await post("/cloud-save", { recoveryCode, save: { version: 1 } })).response.status, 400);
});

test("cloud restore returns the stored snapshot", async () => {
  const row = { save_data: JSON.stringify(save), save_version: 1, saved_at: "2026-06-27 12:00:00" };
  const { response } = await post("/cloud-save/restore", { recoveryCode }, new FakeDb(row));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.save, save);
  assert.equal(body.recoveryCode, recoveryCode);
});

test("cloud restore reports an unknown code without creating data", async () => {
  const { response } = await post("/cloud-save/restore", { recoveryCode });
  assert.equal(response.status, 404);
});
