// Dump live enemy atlas + crop the combat canvas around the enemy.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const save = process.argv[2] || "tools/_tmp-zone-namman-1.json";
const out = process.argv[3] || "C:/Users/bb-we/Documents/KR-Mir2-Client/enemy-crop.png";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const saveJson = fs.readFileSync(save, "utf8");
await page.addInitScript((raw) => {
  const data = JSON.parse(raw);
  localStorage.setItem("lom-idle-v2-save", JSON.stringify(data));
}, saveJson);
await page.goto("http://localhost:4177/?v=" + Date.now(), { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__lomTest?.state?.enemy?.atlas, null, { timeout: 60000 });
await page.waitForTimeout(2000);
for (const label of ["I've Saved It", "Turn Off", "Close", "OK", "Got it"]) {
  const btn = page.getByRole("button", { name: label });
  if (await btn.count()) { try { await btn.first().click({ timeout: 500 }); } catch {} }
}
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const t = window.__lomTest;
  const enemy = t?.state?.enemy || t?.state?.battle?.enemy;
  const atlas = t?.state?.enemy?.atlas;
  return {
    zone: t?.state?.game?.activeZoneId,
    action: t?.state?.enemy?.action,
    frame: t?.state?.enemy?.frame,
    index: t?.state?.enemy?.index,
    atlasDir: atlas?.direction,
    frameSource: atlas?.frameSource,
    standing: atlas?.actions?.standing?.frames?.map((f) => f.srcFrame),
    walking: atlas?.actions?.walking?.frames?.map((f) => f.srcFrame),
    attack1: atlas?.actions?.attack1?.frames?.map((f) => f.srcFrame),
  };
});
console.log(JSON.stringify(info, null, 2));
const canvas = page.locator("canvas").first();
await canvas.screenshot({ path: out });
await browser.close();
console.log("->", out);
