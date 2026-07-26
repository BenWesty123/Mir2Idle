// node tools/_shot-map.mjs <mapName.map> <out.png> [waitMs]
import { chromium } from "playwright";
const mapName = process.argv[2];
const out = process.argv[3] || "C:/Users/bb-we/Documents/KR-Mir2-Client/mapshot.png";
const waitMs = Number(process.argv[4] || 9000);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:4178/", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector("#mapSelect")?.options.length > 1, { timeout: 20000 });
const has = await page.$eval("#mapSelect", (sel, n) => [...sel.options].some((o) => o.value === n), mapName);
if (!has) { console.log("MAP NOT IN LIST:", mapName); await browser.close(); process.exit(2); }
await page.selectOption("#mapSelect", mapName);
await page.click("#loadMapBtn");
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
console.log("map:", mapName, "| status:", await page.locator("#status").textContent().catch(() => "?"));
console.log("errors:", errors.length ? errors.slice(0, 6) : "none");
await browser.close();
