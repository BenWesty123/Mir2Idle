// Packager-INDEPENDENT release check.
//
// Unlike tools/audit-itch-package.mjs (which re-derives "used assets" with the
// same logic as the packager and therefore can't catch a wrong subset), this
// boots the ACTUAL packaged dist/itch build in a real headless browser and
// observes what the running game requests and renders. It fails if:
//   - the page logs any console/page error,
//   - any asset request returns >= 400 (a file that was not copied),
//   - item icons fall back to individual frame files (means the atlas/map is broken),
//   - any monster sprite referenced in the game data is missing from the package.
//
// Run: npm run verify:itch:build   (after npm run package:itch)
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { PHASE1_ENEMY_TEMPLATES } from "../src/phase1Data.js";

const root = path.resolve(import.meta.dirname, "..");
const packageRoot = path.join(root, "dist/itch");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

function fail(message) {
  console.error(`\nRELEASE CHECK FAILED:\n${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(packageRoot, "index.html"))) {
  fail("dist/itch/index.html not found. Run `npm run package:itch` first.");
}

// Static server rooted at dist/itch (mirrors tools/server.mjs behaviour).
function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      let requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      if (requested.endsWith("/")) requested += "index.html";
      const filePath = path.normalize(path.join(packageRoot, requested));
      if (!filePath.startsWith(path.normalize(packageRoot))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const body = fs.readFileSync(filePath);
      res.writeHead(200, { "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// --- 1. Static cross-check: every referenced monster sprite is in the package ---
// Derived directly from the game data (not from the packager's own "used" set),
// so it catches a sprite that was left out of the copied subset (the "Minotaur
// renders as a torch" class of bug).
const SUMMON_PET_INDICES = [78, 79, 80];
const monsterIndices = new Set(
  PHASE1_ENEMY_TEMPLATES
    .map((enemy) => enemy?.monsterIndex)
    .filter((index) => Number.isFinite(Number(index)))
    .map((index) => Math.trunc(Number(index))),
);
for (const index of SUMMON_PET_INDICES) monsterIndices.add(index);

const missingMonsters = [];
for (const index of monsterIndices) {
  for (const ext of ["json", "png"]) {
    const rel = `public/monsters/monster/${index}.${ext}`;
    if (!fs.existsSync(path.join(packageRoot, rel))) missingMonsters.push(rel);
  }
}

// --- 2. Boot the packaged build and observe the running game ---
const server = await startServer();
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();

const errors = [];
const failedResponses = [];
const requests = [];

async function visit(query) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror @${query}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console @${query}: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 400) failedResponses.push(`${r.status()} @${query}: ${r.url()}`); });
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(`${base}/${query}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const frameImgs = await page.locator('img[src*="item-icons/items/frame_"]').count();
  const sprites = await page.locator(".item-icon-sprite").count();
  await page.close();
  return { query, frameImgs, sprites };
}

const scenes = [];
scenes.push(await visit("?ui=game"));
scenes.push(await visit("?ui=game&scene=inventory"));
scenes.push(await visit("?ui=game&scene=character"));
await browser.close();
server.close();

const requestedAtlas = requests.some((u) => u.includes("item-icons/items-atlas.png"));
const individualFrameRequests = requests.filter((u) => /item-icons\/items\/frame_/.test(u));
const inventory = scenes.find((s) => s.query.includes("inventory"));

// --- Report ---
console.log("Itch release boot check");
console.log(`Served: dist/itch  |  monster sprites referenced: ${monsterIndices.size}`);
for (const s of scenes) console.log(`  ${s.query} -> sprites:${s.sprites} frameImgs:${s.frameImgs}`);
console.log(`  item atlas requested: ${requestedAtlas}  |  individual-frame requests: ${individualFrameRequests.length}`);

const problems = [];
if (missingMonsters.length) problems.push(`Monster sprites missing from package:\n  - ${missingMonsters.join("\n  - ")}`);
if (errors.length) problems.push(`Console/page errors in the packaged build:\n  - ${errors.join("\n  - ")}`);
if (failedResponses.length) problems.push(`Asset requests that failed (file not copied into the package):\n  - ${failedResponses.join("\n  - ")}`);
if (!requestedAtlas) problems.push("Packaged build never requested item-icons/items-atlas.png — item icons should crop from the committed atlas.");
if (individualFrameRequests.length) problems.push(`Packaged build requested ${individualFrameRequests.length} individual item-icon frame PNG(s) — those are not shipped; icons must use the atlas.`);
if (inventory && inventory.sprites === 0) problems.push("Inventory rendered 0 item-icon atlas sprites — icons may not be rendering.");
if (inventory && inventory.frameImgs > 0) problems.push("Inventory still references individual item-icon frame <img> tags — expected atlas sprites only.");

if (problems.length) fail(problems.join("\n\n"));

console.log("\nRelease boot check passed: the packaged build boots clean, crops item icons from the committed atlas, and ships every referenced monster sprite.");
