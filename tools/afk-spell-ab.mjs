// Diagnostic: compare which spells fire LIVE vs OFFLINE over the same window.
// Uses per-spell practice XP as the cast counter (every successful cast calls
// levelMagicSkill / levelWarriorMagic on both paths).
// Run: node tools/afk-spell-ab.mjs [seconds] [class]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAVE_KEY = "lom-idle-v2-save";
const PORT = Number(process.env.PORT ?? 4177);
const seconds = Number(process.argv[2] ?? 120);
const classes = process.argv[3] ? [process.argv[3]] : ["warrior", "wizard", "taoist"];
const url = `http://localhost:${PORT}/?testHarness=1`;

async function waitForServer(probe, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetch(probe, { redirect: "follow" })).ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server not reachable at ${probe}`);
}

async function ensureDevServer() {
  try {
    await waitForServer(`http://localhost:${PORT}/`, 2);
    return null;
  } catch {
    const child = spawn(process.execPath, ["tools/server.mjs"], {
      cwd: root, stdio: "pipe", env: { ...process.env, PORT: String(PORT) },
    });
    await waitForServer(`http://localhost:${PORT}/`);
    return child;
  }
}

const readState = `(() => {
  const raw = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}) || "null");
  const id = raw?.ui?.activeCharacterId ?? raw?.activeCharacterId;
  const ch = raw?.characters?.[id];
  const spells = {};
  for (const [spellId, l] of Object.entries(ch?.magic?.learned ?? {})) {
    spells[spellId] = (Number(l.level) || 0) * 100000 + (Number(l.experience) || 0);
  }
  return {
    classId: id,
    kills: ch?.game?.kills ?? 0,
    experience: ch?.game?.progress?.experience ?? 0,
    level: ch?.game?.progress?.level ?? 0,
    hp: ch?.battle?.playerHp ?? null,
    mp: ch?.battle?.playerMp ?? null,
    spells,
  };
})()`;

function spellDelta(before, after) {
  const out = {};
  for (const spellId of Object.keys(after.spells)) {
    const delta = (after.spells[spellId] ?? 0) - (before.spells[spellId] ?? 0);
    out[spellId] = delta;
  }
  return out;
}

const server = await ensureDevServer();
const browser = await chromium.launch({
  args: ["--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"],
});

for (const klass of classes) {
  const savePath = join(root, `tests/fixtures/saves/${klass}-offline-spellkit-v1.json`);
  const save = JSON.parse(readFileSync(savePath, "utf8"));
  const out = { class: klass, windowSeconds: seconds };

  for (const arm of ["live", "offline"]) {
    const context = await browser.newContext();
    await context.addInitScript((s) => {
      let st = s >>> 0;
      Math.random = () => {
        st = (st + 0x6d2b79f5) >>> 0;
        let t = Math.imul(st ^ (st >>> 15), 1 | st);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, 123456789);
    await context.addInitScript(({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload));
    }, { key: SAVE_KEY, payload: { ...save, savedAt: Date.now() - 1000 } });

    const page = await context.newPage();
    page.setDefaultTimeout(900000);
    const errs = [];
    page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" || m.text().includes("[offline]")) errs.push(`${m.type()}: ${m.text()}`);
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__lomTest?.runOfflineZoneProgress);
    await page.waitForTimeout(4000);

    const before = await page.evaluate(readState);
    let report = null;
    if (arm === "live") {
      await page.waitForTimeout(seconds * 1000);
    } else {
      report = await page.evaluate((ms) => window.__lomTest.runOfflineZoneProgress(ms), seconds * 1000);
      await page.waitForTimeout(8000);
    }
    const after = await page.evaluate(readState);

    out[arm] = {
      kills: arm === "offline" ? report?.kills : after.kills - before.kills,
      xp: arm === "offline" ? report?.xp : after.experience - before.experience,
      hp: arm === "offline" ? report?.playerHp : after.hp,
      mp: arm === "offline" ? report?.playerMp : after.mp,
      died: arm === "offline" ? report?.playerDied : null,
      spellPractice: spellDelta(before, after),
      errors: errs.slice(0, 8),
    };
    await context.close();
  }

  const live = out.live.spellPractice;
  const off = out.offline.spellPractice;
  out.neverCastOffline = Object.keys(live).filter((id) => live[id] > 0 && !(off[id] > 0));
  out.neverCastLive = Object.keys(off).filter((id) => off[id] > 0 && !(live[id] > 0));
  console.log(JSON.stringify(out, null, 2));
}

await browser.close();
if (server) server.kill();
