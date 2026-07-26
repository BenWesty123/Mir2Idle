// Measure boot time + request count under emulated slow network.
// Usage: node tools/_repro-slow-network.mjs <save.json> <latencyMs> [maxWaitMs]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const savePath = process.argv[2];
const latencyMs = Number(process.argv[3] || 300);
const maxWaitMs = Number(process.argv[4] || 300000);
const save = JSON.parse(readFileSync(savePath, "utf8"));

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: latencyMs,
  downloadThroughput: (1.5 * 1024 * 1024) / 8, // ~1.5 Mbps
  uploadThroughput: (750 * 1024) / 8,
});

let requests = 0;
page.on("request", () => { requests += 1; });
const t0 = Date.now();
const elapsed = () => Date.now() - t0;
page.on("pageerror", (e) => console.log(`[pageerror +${elapsed()}ms]`, e.message.slice(0, 200)));

await page.addInitScript(({ s }) => {
  localStorage.setItem("lom-idle-v2-save", JSON.stringify(s));
}, { s: save });

await page.goto("http://localhost:4177/?testHarness=1", { waitUntil: "domcontentloaded", timeout: maxWaitMs });
console.log(`domcontentloaded +${elapsed()}ms (requests so far: ${requests})`);

try {
  await page.waitForFunction(() => window.__lomTest?.inspectInventory, undefined, { timeout: maxWaitMs });
  console.log(`BOOTED at +${elapsed()}ms, total requests: ${requests}, emulated latency: ${latencyMs}ms`);
} catch {
  const status = await page.evaluate(() => document.querySelector("#status")?.textContent).catch(() => "?");
  console.log(`NOT BOOTED after ${elapsed()}ms, requests: ${requests}, status: "${status}"`);
}
await browser.close();
