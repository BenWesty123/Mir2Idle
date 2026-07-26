// Boot the LIVE site (www.lom2idle.com) with an injected save and log boot
// progress + errors. Read-only diagnostic: only touches the local headless
// browser's storage. Usage: node tools/_repro-stuck-live.mjs <save.json> [maxWaitMs]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const savePath = process.argv[2];
const maxWaitMs = Number(process.argv[3] || 120000);
const save = JSON.parse(readFileSync(savePath, "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const t0 = Date.now();
const elapsed = () => Date.now() - t0;
page.on("pageerror", (e) => console.log(`[pageerror +${elapsed()}ms]`, e.message.slice(0, 400)));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    console.log(`[console.${m.type()} +${elapsed()}ms]`, m.text().slice(0, 300));
  }
});
page.on("requestfailed", (r) => console.log(`[requestfailed +${elapsed()}ms]`, r.url().slice(0, 140), r.failure()?.errorText));

await page.addInitScript(({ s }) => {
  localStorage.setItem("lom-idle-v2-save", JSON.stringify(s));
}, { s: save });

await page.goto("https://www.lom2idle.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
console.log(`domcontentloaded at +${elapsed()}ms`);

let lastStatus = "";
let booted = false;
while (elapsed() < maxWaitMs) {
  let info = null;
  try {
    info = await Promise.race([
      page.evaluate(() => ({
        status: document.querySelector("#status")?.textContent ?? "(no #status)",
        bad: document.querySelector("#status")?.classList?.contains("bad") ?? false,
        panel: (document.querySelector("#gamePanel")?.innerHTML ?? "").length,
      })),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch (e) {
    console.log(`[evaluate failed +${elapsed()}ms]`, String(e).slice(0, 200));
  }
  if (info === null) {
    console.log(`[+${elapsed()}ms] main thread BLOCKED (evaluate >5s)`);
  } else {
    if (info.status !== lastStatus) {
      console.log(`[+${elapsed()}ms] status: "${info.status}"${info.bad ? " (BAD/error)" : ""} panelHtml=${info.panel}`);
      lastStatus = info.status;
    }
    if (info.panel > 0 && !info.status.includes("Loading")) { booted = true; break; }
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

console.log(booted
  ? `BOOTED OK after ${elapsed()}ms`
  : `NOT BOOTED after ${elapsed()}ms - status: "${lastStatus}"`);
await page.screenshot({ path: "tools/_repro-stuck-live.png" });
await browser.close();
