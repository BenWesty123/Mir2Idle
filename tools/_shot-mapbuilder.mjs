import { chromium } from "playwright";

const url = "http://localhost:4178/";
const out = process.argv[2] || "C:/Users/bb-we/Documents/KR-Mir2-Client/mapbuilder-fox02.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.argv[3] || 9000));
await page.screenshot({ path: out });
console.log("status:", await page.locator("#status").textContent().catch(() => "?"));
console.log("errors:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
