import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:4177/";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);
const status = await page.locator("#status").count() ? await page.locator("#status").textContent() : "(no #status)";
const title = await page.title();
const bodyHtml = await page.evaluate(() => document.body?.innerHTML?.slice(0, 500) ?? "");
console.log(JSON.stringify({ title, status: status?.trim(), bodyHtml, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
