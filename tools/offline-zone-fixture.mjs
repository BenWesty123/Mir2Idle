// Deterministic offline progress characterization (Playwright + seeded RNG).
// Run: node tools/offline-zone-fixture.mjs [profile]
// Profiles: tests/fixtures/offline/profiles.json  (kind: zone | mining)
// Record: RECORD=1 node tools/offline-zone-fixture.mjs warrior-mining
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAVE_KEY = "lom-idle-v2-save";
const PORT = Number(process.env.PORT ?? 4177);
const RECORD = process.env.RECORD === "1";
const profileName = process.argv[2] ?? process.env.OFFLINE_FIXTURE_PROFILE ?? "warrior-bicheon";

const profiles = JSON.parse(readFileSync(join(root, "tests/fixtures/offline/profiles.json"), "utf8"));
const profile = profiles[profileName];
if (!profile) {
  console.error(`Unknown offline fixture profile: ${profileName}`);
  process.exit(1);
}

const profileKind = profile.kind ?? "zone";
const saveTemplate = JSON.parse(readFileSync(join(root, profile.savePath), "utf8"));
const expectedPath = join(root, profile.expectedPath);
const elapsedMs = Math.max(0, Math.trunc(Number(profile.elapsedMs) || 0));
const rngSeed = Math.trunc(Number(profile.seed) || 0);
const baseUrl = process.argv[3] ?? `http://localhost:${PORT}/?testHarness=1`;
const runMethod = profileKind === "mining" ? "runOfflineMiningProgress" : "runOfflineZoneProgress";
let expected = null;
if (!RECORD) {
  expected = JSON.parse(readFileSync(expectedPath, "utf8"));
}

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server not reachable at ${url}`);
}

async function ensureDevServer() {
  const probe = `http://localhost:${PORT}/`;
  try {
    await waitForServer(probe, 2);
    return null;
  } catch {
    const child = spawn(process.execPath, ["tools/server.mjs"], {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, PORT: String(PORT) },
    });
    await waitForServer(probe);
    return child;
  }
}

function buildSavePayload() {
  const save = structuredClone(saveTemplate);
  save.savedAt = Date.now() - 1000;
  return save;
}

function assertMatch(actual, label, expectedValue) {
  if (actual !== expectedValue) {
    throw new Error(`${label}: expected ${expectedValue}, got ${actual}`);
  }
}

function assertZoneReport(result, zoneExpected) {
  assertMatch(result.kills, "kills", zoneExpected.kills);
  assertMatch(result.xp, "xp", zoneExpected.xp);
  assertMatch(result.gold, "gold", zoneExpected.gold);
  assertMatch(result.elapsedMs, "elapsedMs", zoneExpected.elapsedMs);
  assertMatch(result.playerDied, "playerDied", zoneExpected.playerDied);
  assertMatch(result.playerHp, "playerHp", zoneExpected.playerHp);
  assertMatch(result.damageTaken, "damageTaken", zoneExpected.damageTaken);
  const levelsJson = JSON.stringify(result.levels ?? []);
  const expectedLevelsJson = JSON.stringify(zoneExpected.levels ?? []);
  if (levelsJson !== expectedLevelsJson) {
    throw new Error(`levels: expected ${expectedLevelsJson}, got ${levelsJson}`);
  }
}

function assertMiningReport(result, miningExpected) {
  assertMatch(result.swings, "swings", miningExpected.swings);
  assertMatch(result.hits, "hits", miningExpected.hits);
  assertMatch(result.elapsedMs, "elapsedMs", miningExpected.elapsedMs);
  assertMatch(result.inventoryItems, "inventoryItems", miningExpected.inventoryItems);
  const dropsJson = JSON.stringify(result.drops ?? {});
  const expectedDropsJson = JSON.stringify(miningExpected.drops ?? {});
  if (dropsJson !== expectedDropsJson) {
    throw new Error(`drops: expected ${expectedDropsJson}, got ${dropsJson}`);
  }
  const ignoredJson = JSON.stringify(result.ignoredDrops ?? {});
  const expectedIgnoredJson = JSON.stringify(miningExpected.ignoredDrops ?? {});
  if (ignoredJson !== expectedIgnoredJson) {
    throw new Error(`ignoredDrops: expected ${expectedIgnoredJson}, got ${ignoredJson}`);
  }
}

const server = await ensureDevServer();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

await page.addInitScript((seed) => {
  function mulberry32(localSeed) {
    let state = localSeed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  Math.random = mulberry32(seed);
}, rngSeed);

await page.addInitScript(({ key, save }) => {
  localStorage.setItem(key, JSON.stringify(save));
}, { key: SAVE_KEY, save: buildSavePayload() });

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(
  () => window.__lomTest?.runOfflineZoneProgress && window.__lomTest?.runOfflineMiningProgress,
  undefined,
  { timeout: 120000 },
);
await page.waitForTimeout(3000);

const result = await page.evaluate(
  ({ method, ms }) => window.__lomTest[method](ms),
  { method: runMethod, ms: elapsedMs },
);

await browser.close();
if (server) server.kill();

if (errors.length) {
  console.error(JSON.stringify({ profile: profileName, errors, result }, null, 2));
  process.exit(1);
}

if (result?.error) {
  console.error(JSON.stringify({ profile: profileName, errors: [result.error], result }, null, 2));
  process.exit(1);
}

if (RECORD) {
  mkdirSync(dirname(expectedPath), { recursive: true });
  writeFileSync(expectedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "recorded", profile: profileName, path: expectedPath, result }, null, 2));
  process.exit(0);
}

try {
  if (profileKind === "mining") assertMiningReport(result, expected);
  else assertZoneReport(result, expected);
} catch (err) {
  console.error(JSON.stringify({ profile: profileName, error: err.message, result, expected }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  profile: profileName,
  kind: profileKind,
  result,
  seed: rngSeed,
  elapsedMs,
}, null, 2));
process.exit(0);
