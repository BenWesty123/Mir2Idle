// Load a save into localStorage, boot the game, screenshot the combat scene,
// and run a headless offline combat report for the active zone.
//   node tools/_shot-game-zone.mjs <save.json> <out.png> [reportMs]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const savePath = process.argv[2];
const out = process.argv[3] || "C:/Users/bb-we/Documents/KR-Mir2-Client/shot-zone.png";
const reportMs = Number(process.argv[4] || 120000);
const SAVE_KEY = "lom-idle-v2-save";
const save = JSON.parse(readFileSync(savePath, "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

await page.addInitScript(({ key, s }) => { localStorage.setItem(key, JSON.stringify(s)); }, { key: SAVE_KEY, s: save });
await page.goto("http://localhost:4177/?testHarness=1", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__lomTest?.inspectInventory, undefined, { timeout: 120000 });
const dismiss = [
  "button:has-text('Got it')",
  "button:has-text('Continue')",
  "button:has-text('Turn Off')",
  "button:has-text(\"I've Saved It\")",
  "[data-dismiss-demo-live-site-bar]",
];
for (let pass = 0; pass < 5; pass++) {
  await page.waitForTimeout(1200);
  for (const sel of dismiss) {
    try { await page.click(sel, { timeout: 600 }); } catch { /* not present */ }
  }
}
await page.waitForTimeout(6000);
await page.screenshot({ path: out });

const info = await page.evaluate(() => window.__lomTest.inspectInventory());
let report = null;
try { report = await page.evaluate((ms) => window.__lomTest.runOfflineZoneProgress(ms), reportMs); } catch (e) { report = { error: String(e) }; }
console.log("inspect:", JSON.stringify(info));
console.log("report:", JSON.stringify(report));
console.log("errors:", errors.length ? errors.slice(0, 8) : "none");
await browser.close();
