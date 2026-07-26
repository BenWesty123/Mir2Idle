import { chromium } from "playwright";

const url = "http://localhost:4178/";
const out = process.argv[2] || "C:/Users/bb-we/Documents/KR-Mir2-Client/mapbuilder-fox02-zoom.png";
const steps = Number(process.argv[3] || 34); // wheel-in steps toward ~1x

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
const frameReq = { total: 0, bad: 0, samples: [] };
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/api/lib/frame")) {
    frameReq.total++;
    if (r.status() !== 200) { frameReq.bad++; if (frameReq.samples.length < 5) frameReq.samples.push(r.status() + " " + u.slice(u.indexOf("?"))); }
  }
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);

const box = await page.locator("#viewport").boundingBox();
const cx = box.x + box.width * 0.4;
const cy = box.y + box.height * 0.45;
await page.mouse.move(cx, cy);
for (let i = 0; i < steps; i++) {
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(60);
}
await page.mouse.move(cx + 3, cy + 3); // refresh HUD
await page.waitForTimeout(5000); // let tile frames stream in
if (process.argv[4] === "noback") {
  await page.locator("#layerTerrain").uncheck();
  await page.locator("#layerWalls").uncheck();
  await page.waitForTimeout(4000);
}
await page.screenshot({ path: out });
console.log("status:", await page.locator("#status").textContent().catch(() => "?"));
console.log("hud:", await page.locator("#hud").textContent().catch(() => "?"));
console.log("frameReq:", JSON.stringify(frameReq));
console.log("errors:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
