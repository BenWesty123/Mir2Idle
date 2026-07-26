import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const save = JSON.parse(readFileSync(process.argv[2] || "tools/_tmp-zone-namman-1.json", "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(({ s }) => localStorage.setItem("lom-idle-v2-save", JSON.stringify(s)), { s: save });
await page.goto("http://localhost:4177/?testHarness=1", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__lomTest?.inspectInventory, undefined, { timeout: 120000 });
for (const sel of ["button:has-text('Got it')", "button:has-text(\"I've Saved It\")", "button:has-text('Turn Off')"]) {
  try { await page.click(sel, { timeout: 400 }); } catch {}
}
await page.waitForTimeout(4000);
const samples = [];
for (let i = 0; i < 20; i++) {
  samples.push(await page.evaluate(() => {
    const e = window.__lomTest?.state?.enemy;
    const b = window.__lomTest?.state?.battle;
    const atlas = e?.atlas;
    const clip = atlas?.actions?.[e?.action];
    return {
      index: e?.index,
      action: e?.action,
      frame: e?.frame,
      oneShot: e?.oneShot,
      interval: clip?.interval,
      clipLen: clip?.frames?.length,
      src: clip?.frames?.[e?.frame]?.srcFrame,
      enemyX: b?.enemyX,
      playerX: b?.playerX,
      phase: b?.phase,
    };
  }));
  await page.waitForTimeout(200);
}
console.log(JSON.stringify(samples, null, 2));
await browser.close();
