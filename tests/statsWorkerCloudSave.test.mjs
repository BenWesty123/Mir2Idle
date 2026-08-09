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
    if (/INSERT INTO cloud_saves/.test(this.sql)) {
      const [recoveryCode, , saveData, , , playerId] = this.args;
      this.db.cloudSaves.set(recoveryCode, {
        ...(this.db.cloudSaves.get(recoveryCode) ?? {}),
        player_id: this.db.cloudSaves.get(recoveryCode)?.player_id || playerId || null,
        save_data: saveData,
        saved_at: "2026-06-27 12:00:00",
      });
    }
    if (/UPDATE cloud_saves\s+SET player_id/.test(this.sql)) {
      const [playerId, recoveryCode] = this.args;
      const row = this.db.cloudSaves.get(recoveryCode);
      if (row && !row.player_id) row.player_id = playerId;
    }
    return { meta: { changes: 1 } };
  }

  async first() {
    this.db.queries.push(this);
    if (/SELECT player_id FROM cloud_saves WHERE recovery_code/.test(this.sql)) {
      const row = this.db.cloudSaves.get(this.args[0]);
      return row ? { player_id: row.player_id ?? null } : null;
    }
    if (/SELECT save_data FROM cloud_saves WHERE recovery_code/.test(this.sql)) {
      const row = this.db.cloudSaves.get(this.args[0]);
      return row?.save_data != null ? { save_data: row.save_data } : null;
    }
    if (/SELECT player_id FROM player_aliases/.test(this.sql)) {
      const matches = this.db.aliases
        .filter((row) => row.recovery_code === this.args[0])
        .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
      return matches[0] ? { player_id: matches[0].player_id } : null;
    }
    if (/SELECT saved_at(?:, player_id)? FROM cloud_saves/.test(this.sql)
      || /SELECT saved_at, player_id FROM cloud_saves/.test(this.sql)) {
      const row = this.db.cloudSaves.get(this.args[0]);
      return {
        saved_at: row?.saved_at ?? "2026-06-27 12:00:00",
        player_id: row?.player_id ?? null,
      };
    }
    if (/SELECT save_data, save_version, saved_at/.test(this.sql)) {
      return this.db.restoreRow;
    }
    return null;
  }
}

class FakeDb {
  constructor({ restoreRow = null, cloudSaves = {}, aliases = [] } = {}) {
    this.restoreRow = restoreRow;
    this.cloudSaves = new Map(Object.entries(cloudSaves));
    this.aliases = aliases;
    this.queries = [];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

const recoveryCode = "MIR-ABCD-2345-EFGH-6789";
const playerId = "11111111-2222-3333-4444-555555555555";
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
  const { response, db } = await post("/cloud-save", {
    recoveryCode: recoveryCode.toLowerCase(),
    playerId,
    save,
  });
  assert.equal(response.status, 200);
  const upsert = db.queries.find((query) => /INSERT INTO cloud_saves/.test(query.sql));
  assert.ok(upsert);
  assert.equal(upsert.args[0], recoveryCode);
  assert.equal(upsert.args[1], 1);
  assert.deepEqual(JSON.parse(upsert.args[2]), save);
  assert.equal(upsert.args[5], playerId);
  const body = await response.json();
  assert.equal(body.playerId, playerId);
});

test("cloud save keeps the first bound player id when a new device uploads", async () => {
  const originalId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const { response, db } = await post("/cloud-save", {
    recoveryCode,
    playerId: "ffffffff-0000-1111-2222-333333333333",
    save,
  }, new FakeDb({
    cloudSaves: {
      [recoveryCode]: { player_id: originalId, saved_at: "2026-06-01 00:00:00" },
    },
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.playerId, originalId);
  const upsert = db.queries.find((query) => /INSERT INTO cloud_saves/.test(query.sql));
  // Bind arg is the resolved canonical id (original), and COALESCE keeps it.
  assert.equal(upsert.args[5], originalId);
});

test("cloud save rejects malformed recovery codes and snapshots", async () => {
  assert.equal((await post("/cloud-save", { recoveryCode: "bad", save })).response.status, 400);
  assert.equal((await post("/cloud-save", { recoveryCode, save: { version: 1 } })).response.status, 400);
});

test("cloud restore returns the stored snapshot and bound player id", async () => {
  const row = {
    save_data: JSON.stringify(save),
    save_version: 1,
    saved_at: "2026-06-27 12:00:00",
    player_id: playerId,
  };
  const { response } = await post("/cloud-save/restore", { recoveryCode }, new FakeDb({ restoreRow: row }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.save, save);
  assert.equal(body.recoveryCode, recoveryCode);
  assert.equal(body.playerId, playerId);
});

test("cloud restore falls back to an alias claimed with the recovery code", async () => {
  const row = {
    save_data: JSON.stringify(save),
    save_version: 1,
    saved_at: "2026-06-27 12:00:00",
    player_id: null,
  };
  const { response, db } = await post("/cloud-save/restore", { recoveryCode }, new FakeDb({
    restoreRow: row,
    cloudSaves: { [recoveryCode]: { player_id: null, saved_at: row.saved_at } },
    aliases: [{
      player_id: playerId,
      recovery_code: recoveryCode,
      created_at: "2026-05-01 00:00:00",
    }],
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.playerId, playerId);
  const backfill = db.queries.find((query) => /UPDATE cloud_saves\s+SET player_id/.test(query.sql));
  assert.ok(backfill);
  assert.equal(backfill.args[0], playerId);
  assert.equal(backfill.args[1], recoveryCode);
});

test("cloud restore reports an unknown code without creating data", async () => {
  const { response } = await post("/cloud-save/restore", { recoveryCode });
  assert.equal(response.status, 404);
});

test("cloud save rejects weaker progress overwriting a stronger backup", async () => {
  const strongSave = {
    version: 1,
    savedAt: 2000,
    activeCharacterId: "Warrior",
    account: { stats: { rebirthCount: 0 } },
    characters: {
      Warrior: { game: { progress: { level: 58 } } },
      Wizard: { game: { progress: { level: 50 } } },
      Taoist: { game: { progress: { level: 49 } } },
    },
  };
  const weakSave = {
    version: 1,
    savedAt: 3000,
    activeCharacterId: "Warrior",
    account: { stats: { rebirthCount: 0 } },
    characters: {
      Warrior: { game: { progress: { level: 1 } } },
      Wizard: { game: { progress: { level: 1 } } },
      Taoist: { game: { progress: { level: 1 } } },
    },
  };
  const { response, db } = await post("/cloud-save", {
    recoveryCode,
    playerId,
    save: weakSave,
  }, new FakeDb({
    cloudSaves: {
      [recoveryCode]: {
        player_id: playerId,
        save_data: JSON.stringify(strongSave),
        saved_at: "2026-08-05 12:00:00",
      },
    },
  }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "stale_progress");
  assert.equal(db.queries.some((query) => /INSERT INTO cloud_saves/.test(query.sql)), false);
});

test("cloud save accepts a rebirth reset that lowers character levels", async () => {
  const beforeRebirth = {
    version: 1,
    savedAt: 2000,
    activeCharacterId: "Warrior",
    account: { stats: { rebirthCount: 1 } },
    characters: {
      Warrior: { game: { progress: { level: 58 } } },
      Wizard: { game: { progress: { level: 50 } } },
      Taoist: { game: { progress: { level: 49 } } },
    },
  };
  const afterRebirth = {
    version: 1,
    savedAt: 3000,
    activeCharacterId: "Warrior",
    account: { stats: { rebirthCount: 2 } },
    characters: {
      Warrior: { game: { progress: { level: 1 } } },
      Wizard: { game: { progress: { level: 1 } } },
      Taoist: { game: { progress: { level: 1 } } },
    },
  };
  const { response, db } = await post("/cloud-save", {
    recoveryCode,
    playerId,
    save: afterRebirth,
  }, new FakeDb({
    cloudSaves: {
      [recoveryCode]: {
        player_id: playerId,
        save_data: JSON.stringify(beforeRebirth),
        saved_at: "2026-08-05 12:00:00",
      },
    },
  }));
  assert.equal(response.status, 200);
  const upsert = db.queries.find((query) => /INSERT INTO cloud_saves/.test(query.sql));
  assert.ok(upsert);
  assert.deepEqual(JSON.parse(upsert.args[2]), afterRebirth);
});
