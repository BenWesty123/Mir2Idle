// Diagnostic: end-to-end check that an armed Simulation Mode window is CREDITED
// (not silently discarded) when the player leaves the zone, returns to town, or
// switches character - and that switching back does not credit the same window
// twice.
//
// Controls are clicked through the DOM rather than by real pointer events: the
// AFK overlay is modal, and the whole point is to exercise the paths a mobile
// player could reach through it before the z-index fix.
//
// Run: node tools/afk-sim-mode-flow-probe.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAVE_KEY = "lom-idle-v2-save";
const PORT = Number(process.env.PORT ?? 4177);
const url = `http://localhost:${PORT}/?testHarness=1`;
const THIRTY_MIN_MS = 30 * 60 * 1000;

const save = JSON.parse(readFileSync(join(root, "tests/fixtures/saves/warrior-offline-spellkit-v1.json"), "utf8"));

const readSave = `(() => {
  const raw = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}) || "null");
  const id = raw?.ui?.activeCharacterId ?? raw?.activeCharacterId;
  const out = { activeId: id, characters: {} };
  for (const [classId, ch] of Object.entries(raw?.characters ?? {})) {
    out.characters[classId] = {
      kills: ch?.game?.kills ?? 0,
      mode: ch?.game?.mode ?? null,
      simArmedAt: ch?.game?.simulationMode?.startedAt ?? null,
    };
  }
  return out;
})()`;

async function boot(browser, errors, contextOptions = {}) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    window.__clockOffset = 0;
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + window.__clockOffset;
  });
  await context.addInitScript(({ key, payload }) => {
    localStorage.setItem(key, JSON.stringify(payload));
  }, { key: SAVE_KEY, payload: { ...save, savedAt: Date.now() - 1000 } });

  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__lomTest?.runOfflineZoneProgress);
  await page.waitForTimeout(3000);
  return { context, page };
}

const clickSel = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing selector: ${sel}`);
  el.click();
  return true;
}, selector);

const advanceClock = (page, ms) => page.evaluate((delta) => { window.__clockOffset += delta; }, ms);

const armed = (page) => page.evaluate(() => {
  const overlay = document.querySelector("#simulationModeOverlay");
  return Boolean(overlay && !overlay.hidden);
});

const browser = await chromium.launch();
const results = {};

// --- Scenario 1: Return To Town while armed must credit the window ------------
{
  const errors = [];
  const { context, page } = await boot(browser, errors);
  const before = await page.evaluate(readSave);
  await clickSel(page, "#simulationModeButton");
  const armedOk = await armed(page);
  await advanceClock(page, THIRTY_MIN_MS);
  await clickSel(page, "#returnToTown");
  await page.waitForTimeout(2500);
  const after = await page.evaluate(readSave);
  results.returnToTown = {
    armedOverlayShown: armedOk,
    killsBefore: before.characters.Warrior.kills,
    killsAfter: after.characters.Warrior.kills,
    credited: after.characters.Warrior.kills > before.characters.Warrior.kills,
    simCleared: after.characters.Warrior.simArmedAt == null,
    mode: after.characters.Warrior.mode,
    errors,
  };
  await context.close();
}

// --- Scenario 2: switching character credits once, not twice -----------------
{
  const errors = [];
  const { context, page } = await boot(browser, errors);
  const before = await page.evaluate(readSave);
  await clickSel(page, "#simulationModeButton");
  await advanceClock(page, THIRTY_MIN_MS);

  await clickSel(page, '[data-open-scene="characterSelect"]');
  await page.waitForTimeout(500);
  await clickSel(page, '[data-select-player-class="Wizard"]');
  await page.waitForTimeout(3000);
  const afterSwitch = await page.evaluate(readSave);

  // Sit on the wizard a while, then come back. The old build restored the
  // warrior's original startedAt and credited this stretch a second time.
  await advanceClock(page, THIRTY_MIN_MS);
  await clickSel(page, '[data-open-scene="characterSelect"]');
  await page.waitForTimeout(500);
  await clickSel(page, '[data-select-player-class="Warrior"]');
  await page.waitForTimeout(3000);
  const afterReturn = await page.evaluate(readSave);

  results.characterSwitch = {
    killsBefore: before.characters.Warrior.kills,
    killsAfterSwitchAway: afterSwitch.characters.Warrior.kills,
    killsAfterSwitchBack: afterReturn.characters.Warrior.kills,
    creditedOnSwitchAway: afterSwitch.characters.Warrior.kills > before.characters.Warrior.kills,
    armParkedOnOutgoingCharacter: afterSwitch.characters.Warrior.simArmedAt != null,
    doubleCredited: afterReturn.characters.Warrior.kills > afterSwitch.characters.Warrior.kills,
    errors,
  };
  await context.close();
}

// --- Scenario 3: on a phone viewport the overlay must actually block ---------
{
  const errors = [];
  const { context, page } = await boot(browser, errors, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await clickSel(page, "#simulationModeButton");
  await page.waitForTimeout(500);
  results.mobileModality = await page.evaluate(() => {
    // The boot-time notices intentionally sit above the modal band; hide them so
    // the hit test measures the overlay against the topbar and nothing else.
    for (const el of document.querySelectorAll(".prototype-stats-notice-overlay")) el.hidden = true;
    const overlay = document.querySelector("#simulationModeOverlay");
    const topbar = document.querySelector(".game-topbar");
    // Whatever sits under a tap on the topbar must be the overlay, not the
    // topbar's own controls, or Simulation Mode is not modal on mobile.
    const box = topbar?.getBoundingClientRect();
    const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
    return {
      compactUi: document.body.classList.contains("compact-ui"),
      overlayZ: getComputedStyle(overlay).zIndex,
      topbarZ: getComputedStyle(topbar).zIndex,
      topbarTapBlocked: Boolean(hit && overlay.contains(hit)),
    };
  });
  results.mobileModality.errors = errors;
  await context.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
