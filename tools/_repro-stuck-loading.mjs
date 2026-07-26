// Repro harness for the "stuck on Loading atlases..." report.
// Injects a player save, boots the game, and logs boot progress + main-thread
// stalls + errors. Usage: node tools/_repro-stuck-loading.mjs <save.json> [maxWaitMs]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const savePath = process.argv[2];
const maxWaitMs = Number(process.argv[3] || 120000);
const save = JSON.parse(readFileSync(savePath, "utf8"));
console.log("savedAt:", save.savedAt, new Date(save.savedAt).toISOString(),
  "ageMs:", Date.now() - save.savedAt);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log(`[pageerror +${elapsed()}ms]`, e.message));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    console.log(`[console.${m.type()} +${elapsed()}ms]`, m.text().slice(0, 300));
  }
});

const t0 = Date.now();
const elapsed = () => Date.now() - t0;

await page.addInitScript(({ s }) => {
  localStorage.setItem("lom-idle-v2-save", JSON.stringify(s));
}, { s: save });

await page.goto("http://localhost:4177/?testHarness=1", { waitUntil: "domcontentloaded", timeout: 60000 });
console.log(`domcontentloaded at +${elapsed()}ms`);

let lastStatus = "";
let booted = false;
while (elapsed() < maxWaitMs) {
  const pollStart = elapsed();
  let info = null;
  try {
    // This evaluate stalls while the page's main thread is blocked, so a big
    // gap between pollStart and pollEnd = synchronous freeze in the page.
    info = await Promise.race([
      page.evaluate(() => ({
        status: document.querySelector("#status")?.textContent ?? "(no #status)",
        bad: document.querySelector("#status")?.classList?.contains("bad") ?? false,
        harness: Boolean(window.__lomTest),
      })),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch (e) {
    console.log(`[evaluate failed +${elapsed()}ms]`, String(e).slice(0, 200));
  }
  const pollEnd = elapsed();
  if (info === null) {
    console.log(`[+${pollEnd}ms] main thread BLOCKED (evaluate did not return within 5s)`);
  } else {
    if (pollEnd - pollStart > 1500) {
      console.log(`[+${pollEnd}ms] main thread was blocked ~${pollEnd - pollStart}ms`);
    }
    if (info.status !== lastStatus) {
      console.log(`[+${pollEnd}ms] status: "${info.status}"${info.bad ? " (BAD/error)" : ""} harness=${info.harness}`);
      lastStatus = info.status;
    }
    if (info.harness) { booted = true; break; }
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

console.log(booted
  ? `BOOTED OK after ${elapsed()}ms`
  : `NOT BOOTED after ${elapsed()}ms - status: "${lastStatus}"`);
await page.screenshot({ path: "tools/_repro-stuck-loading.png" });
await browser.close();
