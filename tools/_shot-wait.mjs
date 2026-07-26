import { readFileSync } from "node:fs";
import { chromium } from "playwright";
const [savePath, out, waitMs] = [process.argv[2], process.argv[3], Number(process.argv[4] || 16000)];
const save = JSON.parse(readFileSync(savePath, "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.addInitScript(({ s }) => localStorage.setItem("lom-idle-v2-save", JSON.stringify(s)), { s: save });
await page.goto("http://localhost:4177/?testHarness=1", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__lomTest?.inspectInventory, undefined, { timeout: 120000 });
const dismiss = ["button:has-text('Got it')", "button:has-text('Continue')", "button:has-text(\"I've Saved It\")", "button:has-text('Turn Off')", "[data-dismiss-demo-live-site-bar]"];
for (let p = 0; p < 4; p++) { await page.waitForTimeout(700); for (const sel of dismiss) { try { await page.click(sel, { timeout: 400 }); } catch {} } }
await page.waitForTimeout(waitMs);
for (const sel of dismiss) { try { await page.click(sel, { timeout: 400 }); } catch {} }
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(out, JSON.stringify(await page.evaluate(() => window.__lomTest.inspectInventory())), "errors:", errors.slice(0, 5));
await browser.close();
