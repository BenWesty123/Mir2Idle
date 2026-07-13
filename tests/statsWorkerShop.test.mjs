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
  constructor({ balances = {}, stripeEvents = [], recentMessage = null, unlocks = [], subscriptions = {} } = {}) {
    this.balances = { ...balances };
    this.stripeEvents = new Set(stripeEvents);
    this.recentMessage = recentMessage;
    this.unlocks = new Set(unlocks);
    this.subscriptions = { ...subscriptions };
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
    if (/INSERT INTO account_subscriptions/.test(sql)) {
      this.subscriptions[`${args[0]}::${args[1]}`] = args[2];
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
    if (/SELECT expires_at FROM account_subscriptions/.test(sql)) {
      const key = `${args[0]}::${args[1]}`;
      return key in this.subscriptions ? { expires_at: this.subscriptions[key] } : null;
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
    if (/SELECT subscription_key, expires_at FROM account_subscriptions/.test(sql)) {
      const code = args[0];
      const results = Object.entries(this.subscriptions)
        .filter(([entry]) => entry.startsWith(`${code}::`))
        .map(([entry, expiresAt]) => ({ subscription_key: entry.slice(code.length + 2), expires_at: expiresAt }));
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

test("unlock-page charges 500 tokens for the teleport ring", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 550 } });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "teleport-ring" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.unlockKey, "teleport-ring");
  assert.equal(data.balance, 50);
  assert.equal(db.balances[VALID_CODE], 50);
  assert.ok(db.unlocks.has(`${VALID_CODE}::teleport-ring`));
});

test("unlock-page rejects the teleport ring when the balance is below 500", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 400 } });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "teleport-ring" }),
  }, { DB: db });
  assert.equal(response.status, 402);
  assert.equal(db.balances[VALID_CODE], 400);
  assert.ok(!db.unlocks.has(`${VALID_CODE}::teleport-ring`));
});

test("unlock-page charges 300 tokens for time logging", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 300 } });
  const response = await request("/shop/unlock-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, unlockKey: "time-logging" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.unlockKey, "time-logging");
  assert.equal(data.balance, 0);
  assert.ok(db.unlocks.has(`${VALID_CODE}::time-logging`));
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

test("shop spend charges 200 tokens for spirit-box-deposit", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 250 } });
  const response = await request("/shop/spend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, spendKey: "spirit-box-deposit" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.spendKey, "spirit-box-deposit");
  assert.equal(data.balance, 50);
  assert.equal(db.balances[VALID_CODE], 50);
});

test("shop spend is not idempotent and can charge repeatedly", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 500 } });
  const first = await request("/shop/spend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, spendKey: "spirit-box-deposit" }),
  }, { DB: db });
  assert.equal(first.status, 200);
  const second = await request("/shop/spend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, spendKey: "spirit-box-deposit" }),
  }, { DB: db });
  assert.equal(second.status, 200);
  const data = await second.json();
  assert.equal(data.balance, 100);
  assert.equal(db.balances[VALID_CODE], 100);
});

test("shop spend rejects when the balance is below 200", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 150 } });
  const response = await request("/shop/spend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, spendKey: "spirit-box-deposit" }),
  }, { DB: db });
  assert.equal(response.status, 402);
  const data = await response.json();
  assert.equal(data.code, "INSUFFICIENT_TOKENS");
  assert.equal(db.balances[VALID_CODE], 150);
});

test("shop spend rejects an unknown spend key", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 300 } });
  const response = await request("/shop/spend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, spendKey: "not-a-real-spend" }),
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

const DAY_MS = 24 * 60 * 60 * 1000;

test("subscribe charges 1000 tokens and sets a 28-day expiry", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 1200 } });
  const before = Date.now();
  const response = await request("/shop/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, subscriptionKey: "monthly-supporter" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.subscriptionKey, "monthly-supporter");
  assert.equal(data.balance, 200);
  assert.equal(db.balances[VALID_CODE], 200);
  // Expiry is ~28 days out (allow a small window for clock drift during the test).
  assert.ok(data.expiresAt >= before + 28 * DAY_MS);
  assert.ok(data.expiresAt <= Date.now() + 28 * DAY_MS + 5000);
});

test("subscribe extends from the current expiry when still active", async () => {
  const activeUntil = Date.now() + 10 * DAY_MS;
  const db = new FakeDb({
    balances: { [VALID_CODE]: 1000 },
    subscriptions: { [`${VALID_CODE}::monthly-supporter`]: activeUntil },
  });
  const response = await request("/shop/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, subscriptionKey: "monthly-supporter" }),
  }, { DB: db });
  assert.equal(response.status, 200);
  const data = await response.json();
  // Should extend from the existing expiry, not from now: ~38 days total.
  assert.ok(data.expiresAt >= activeUntil + 28 * DAY_MS - 5000);
  assert.equal(db.balances[VALID_CODE], 0);
});

test("subscribe returns 402 and writes nothing when the balance is too low", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 999 } });
  const response = await request("/shop/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, subscriptionKey: "monthly-supporter" }),
  }, { DB: db });
  assert.equal(response.status, 402);
  const data = await response.json();
  assert.equal(data.code, "INSUFFICIENT_TOKENS");
  assert.equal(db.balances[VALID_CODE], 999);
  assert.ok(!(`${VALID_CODE}::monthly-supporter` in db.subscriptions));
});

test("subscribe rejects an unknown subscription key", async () => {
  const db = new FakeDb({ balances: { [VALID_CODE]: 5000 } });
  const response = await request("/shop/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode: VALID_CODE, subscriptionKey: "lifetime-supporter" }),
  }, { DB: db });
  assert.equal(response.status, 400);
  assert.equal(db.balances[VALID_CODE], 5000);
});

test("unlocks GET returns active subscriptions and omits expired ones", async () => {
  const db = new FakeDb({
    balances: { [VALID_CODE]: 5 },
    subscriptions: {
      [`${VALID_CODE}::monthly-supporter`]: Date.now() + 5 * DAY_MS,
    },
  });
  const response = await request(
    `/shop/unlocks?recoveryCode=${encodeURIComponent(VALID_CODE)}`,
    { method: "GET" },
    { DB: db },
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.subscriptions);
  assert.ok(Number(data.subscriptions["monthly-supporter"]) > Date.now());

  const expiredDb = new FakeDb({
    balances: { [VALID_CODE]: 5 },
    subscriptions: { [`${VALID_CODE}::monthly-supporter`]: Date.now() - DAY_MS },
  });
  const expiredResponse = await request(
    `/shop/unlocks?recoveryCode=${encodeURIComponent(VALID_CODE)}`,
    { method: "GET" },
    { DB: expiredDb },
  );
  const expiredData = await expiredResponse.json();
  assert.equal(expiredData.subscriptions["monthly-supporter"], undefined);
});
