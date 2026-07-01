import assert from "node:assert/strict";
import test from "node:test";

import worker from "../tools/stats-worker/worker.js";

const VALID_CODE = "MIR-ABCD-EFGH-JKLM-NPQR";
const WEBHOOK_SECRET = "whsec_test_secret";

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
    return this.db.run(this.sql, this.args);
  }

  async first() {
    return this.db.first(this.sql, this.args);
  }

  async all() {
    return this.db.all(this.sql, this.args);
  }
}

class FakeDb {
  constructor({ balances = {}, stripeEvents = [], recentMessage = null, unlocks = [] } = {}) {
    this.balances = { ...balances };
    this.stripeEvents = new Set(stripeEvents);
    this.recentMessage = recentMessage;
    this.unlocks = new Set(unlocks);
    this.calls = [];
    this.nextMessageId = 1;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  run(sql, args) {
    this.calls.push({ sql, args });
    if (/INSERT OR IGNORE INTO stripe_events/.test(sql)) {
      const id = args[0];
      if (this.stripeEvents.has(id)) return { meta: { changes: 0 } };
      this.stripeEvents.add(id);
      return { meta: { changes: 1 } };
    }
    if (/INSERT OR IGNORE INTO account_unlocks/.test(sql)) {
      const key = `${args[0]}::${args[1]}`;
      if (this.unlocks.has(key)) return { meta: { changes: 0 } };
      this.unlocks.add(key);
      return { meta: { changes: 1 } };
    }
    if (/DELETE FROM account_unlocks/.test(sql)) {
      this.unlocks.delete(`${args[0]}::${args[1]}`);
      return { meta: { changes: 1 } };
    }
    if (/UPDATE token_accounts\s+SET balance = balance - \?/.test(sql)) {
      const [cost, code] = args;
      const balance = this.balances[code] ?? 0;
      if (balance >= cost) {
        this.balances[code] = balance - cost;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (/INSERT INTO token_accounts/.test(sql)) {
      const [code, amount] = args;
      this.balances[code] = (this.balances[code] ?? 0) + amount;
      return { meta: { changes: 1 } };
    }
    if (/INSERT INTO token_ledger/.test(sql)) return { meta: { changes: 1 } };
    return { meta: { changes: 1 } };
  }

  first(sql, args) {
    this.calls.push({ sql, args });
    if (/FROM town_messages\s+WHERE player_id = \?/.test(sql)) return this.recentMessage;
    if (/INSERT INTO town_messages/.test(sql)) {
      return {
        id: this.nextMessageId++,
        player_id: args[0],
        character_class: args[1],
        character_level: args[2],
        body: args[3],
        created_at: "2026-07-01T00:00:00Z",
      };
    }
    if (/SELECT balance FROM token_accounts/.test(sql)) return { balance: this.balances[args[0]] ?? 0 };
    return null;
  }

  all(sql, args) {
    this.calls.push({ sql, args });
    if (/SELECT unlock_key FROM account_unlocks/.test(sql)) {
      const code = args[0];
      const results = [...this.unlocks]
        .filter((entry) => entry.startsWith(`${code}::`))
        .map((entry) => ({ unlock_key: entry.slice(code.length + 2) }));
      return { results };
    }
    return { results: [] };
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

function request(path, options, env) {
  return worker.fetch(new Request(`https://stats.example${path}`, options), {
    ALLOWED_ORIGIN: "*",
    ...env,
  });
}

async function stripeSignatureHeader(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

function webhookBody({ eventId = "evt_1", tokens = 100, recoveryCode = VALID_CODE } = {}) {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", metadata: { recovery_code: recoveryCode, tokens: String(tokens) } } },
  });
}

test("webhook credits tokens on a valid signature", async () => {
  const db = new FakeDb();
  const body = webhookBody({ tokens: 100 });
  const signature = await stripeSignatureHeader(body, WEBHOOK_SECRET);
  const response = await request("/shop/stripe-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body,
  }, { DB: db, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.credited, 100);
  assert.equal(db.balances[VALID_CODE], 100);
});

test("webhook does not double-credit a duplicate event id", async () => {
  const db = new FakeDb({ stripeEvents: ["evt_dupe"] });
  const body = webhookBody({ eventId: "evt_dupe", tokens: 100 });
  const signature = await stripeSignatureHeader(body, WEBHOOK_SECRET);
  const response = await request("/shop/stripe-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body,
  }, { DB: db, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.duplicate, true);
  assert.equal(db.balances[VALID_CODE] ?? 0, 0);
  assert.ok(!db.calls.some((call) => /INSERT INTO token_accounts/.test(call.sql)), "must not credit");
});

test("webhook rejects a bad signature", async () => {
  const db = new FakeDb();
  const body = webhookBody();
  const response = await request("/shop/stripe-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=123,v1=deadbeef" },
    body,
  }, { DB: db, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });

  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 0);
});

test("message post deducts tokens and succeeds when balance is sufficient", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 100 } });
  const response = await request("/town-messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "abcdef12-account",
      recoveryCode: VALID_CODE,
      characterClass: "Warrior",
      characterLevel: 10,
      body: "Hello adventurers",
    }),
  }, { DB: db });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.balance, 50);
  assert.equal(db.balances[VALID_CODE], 50);
  assert.ok(db.calls.some((call) => /INSERT INTO town_messages/.test(call.sql)), "message inserted");
});

test("message post returns 402 and inserts nothing when balance is too low", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 10 } });
  const response = await request("/town-messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "abcdef12-account",
      recoveryCode: VALID_CODE,
      characterClass: "Warrior",
      characterLevel: 10,
      body: "Hello adventurers",
    }),
  }, { DB: db });

  assert.equal(response.status, 402);
  const data = await response.json();
  assert.equal(data.code, "INSUFFICIENT_TOKENS");
  assert.equal(db.balances[VALID_CODE], 10);
  assert.ok(!db.calls.some((call) => /INSERT INTO town_messages/.test(call.sql)), "no message inserted");
});

test("create-checkout rejects an invalid recovery code", async () => {
  const db = new FakeDb();
  const response = await request("/shop/create-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: "not-a-code", packId: "tokens-100" }),
  }, { DB: db, STRIPE_SECRET_KEY: "sk_test_x" });
  assert.equal(response.status, 400);
});

test("create-checkout rejects an unknown token pack", async () => {
  const db = new FakeDb();
  const response = await request("/shop/create-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, packId: "tokens-999999" }),
  }, { DB: db, STRIPE_SECRET_KEY: "sk_test_x" });
  assert.equal(response.status, 400);
});

test("create-checkout returns a Stripe session url on success", async () => {
  const db = new FakeDb();
  const originalFetch = globalThis.fetch;
  let capturedBody = "";
  globalThis.fetch = async (url, init) => {
    capturedBody = String(init?.body ?? "");
    assert.match(String(url), /checkout\/sessions/);
    return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await request("/shop/create-checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryCode: VALID_CODE, packId: "tokens-600" }),
    }, { DB: db, STRIPE_SECRET_KEY: "sk_test_x", SITE_URL: "https://example.test" });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.url, "https://checkout.stripe.test/session_123");
    assert.match(capturedBody, /unit_amount%5D=500/);
    assert.match(capturedBody, /metadata%5Btokens%5D=600/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unlock-page charges 250 tokens and records the unlock", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 300 } });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "inv-page-3:warrior" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.unlockKey, "inv-page-3:warrior");
  assert.equal(data.balance, 50);
  assert.equal(db.balances[VALID_CODE], 50);
  assert.ok(db.unlocks.has(`${VALID_CODE}::inv-page-3:warrior`));
});

test("unlock-page is idempotent and never double-charges", async () => {
  const db = new FakeDb({
    balances: { [VALID_CODE]: 300 },
    unlocks: [`${VALID_CODE}::storage-page-3`],
  });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "storage-page-3" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.alreadyOwned, true);
  assert.equal(db.balances[VALID_CODE], 300);
});

test("unlock-page rejects when the balance is too low and releases the reservation", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 100 } });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "inv-page-3:wizard" }),
  }, { DB: db });
  assert.equal(response.status, 402);
  const data = await response.json();
  assert.equal(data.code, "INSUFFICIENT_TOKENS");
  assert.equal(db.balances[VALID_CODE], 100);
  assert.ok(!db.unlocks.has(`${VALID_CODE}::inv-page-3:wizard`));
});

test("unlock-page rejects an unknown unlock key", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 300 } });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "inv-page-99:warrior" }),
  }, { DB: db });
  assert.equal(response.status, 400);
  assert.equal(db.balances[VALID_CODE], 300);
});

test("unlocks GET returns the owned unlock keys", async () => {
  const db = new FakeDb({
    balances: { [VALID_CODE]: 42 },
    unlocks: [`${VALID_CODE}::storage-page-3`, `${VALID_CODE}::inv-page-3:taoist`],
  });
  const response = await request(
    `/shop/unlocks?recoveryCode=${encodeURIComponent(VALID_CODE)}`,
    { method: "GET" },
    { DB: db },
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.unlocks.sort(), ["inv-page-3:taoist", "storage-page-3"]);
  assert.equal(data.balance, 42);
});
