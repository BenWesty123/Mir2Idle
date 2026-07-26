import { chromium } from "playwright";
const target = process.argv[2];
const out = process.argv[3] || "C:/Users/bb-we/Documents/KR-Mir2-Client/preview.png";
const fullPage = process.argv[4] !== "viewport";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto(target, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000); // let CDN icons load
await page.screenshot({ path: out, fullPage });
await browser.close();
console.log("shot ->", out);
