#!/usr/bin/env node
/**
 * Suggest weapon ↔ CWeaponEffect glow matches.
 *
 * Primary signal: silhouette orientation / elongation / aspect (PCA).
 * Secondary: native-offset weapon coverage (glow should contain the weapon).
 *
 * Also writes tile-review/weapon-glows/suggestions.html for visual shortlists.
 *
 * Usage:
 *   node tools/suggest-weapon-glow-matches.mjs
 *   node tools/suggest-weapon-glow-matches.mjs --validate
 *   node tools/suggest-weapon-glow-matches.mjs --top 8
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const glowDir = path.join(root, "public", "sprite-sets", "common", "weaponGlow");
const weaponDir = path.join(root, "public", "sprite-sets", "common", "weapon");
const cataloguePath = path.join(root, "public", "sprite-sets", "common", "layers.json");
const mappingsPath = path.join(root, "tools", "weapon-glow-mappings.json");
const crystalItemsPath = path.join(root, "src", "data", "crystal-items.json");
const outJsonPath = path.join(root, "tools", "weapon-glow-suggestions.json");
const outHtmlPath = path.join(root, "tile-review", "weapon-glows", "suggestions.html");

const CANVAS = 220;
const ANCHOR_X = 110;
const ANCHOR_Y = 150;
const ALPHA_THRESHOLD = 20;
const COVER_FLOOR = 0.72;

const args = new Set(process.argv.slice(2));
const topN = Number(process.argv.find((a, i, arr) => arr[i - 1] === "--top") ?? 8);
const runValidate = args.has("--validate") || args.has("--validate-only");
const validateOnly = args.has("--validate-only");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function loadWeaponNames() {
  const byShape = new Map();
  try {
    const items = readJson(crystalItemsPath);
    const arr = Array.isArray(items) ? items : (items.items ?? Object.values(items));
    for (const it of arr) {
      if (!it || it.type !== "Weapon" || typeof it.shape !== "number") continue;
      if (!byShape.has(it.shape)) byShape.set(it.shape, []);
      const list = byShape.get(it.shape);
      if (list.length < 3 && !list.includes(it.name)) list.push(it.name);
    }
  } catch {
    // optional
  }
  return byShape;
}

function listIndexes(dir) {
  return fs.readdirSync(dir)
    .filter((name) => /^\d+\.json$/.test(name))
    .map((name) => Number(path.basename(name, ".json")))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

async function loadSheet(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function pickFrames(atlas) {
  const standing = atlas.actions?.standing?.frames ?? [];
  const attack = atlas.actions?.attack1?.frames ?? [];
  const frames = [];
  if (standing[0]) frames.push(standing[0]);
  if (standing[2]) frames.push(standing[2]);
  if (attack[2]) frames.push(attack[2]);
  if (attack[4]) frames.push(attack[4]);
  return frames.length ? frames : standing.slice(0, 2);
}

function frameMoments(sheet, atlas, frame) {
  if (!frame || frame.empty || !frame.w || !frame.h) return null;
  const sx0 = (frame.slot ?? 0) * atlas.slotWidth;
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const alpha = sheet.data[((y * sheet.width) + (sx0 + x)) * 4 + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      n += 1;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumYY += y * y;
      sumXY += x * y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (n < 10) return null;
  const cx = sumX / n;
  const cy = sumY / n;
  const mu20 = (sumXX / n) - (cx * cx);
  const mu02 = (sumYY / n) - (cy * cy);
  const mu11 = (sumXY / n) - (cx * cy);
  const angle = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
  const tmp = Math.sqrt((((mu20 - mu02) / 2) ** 2) + (mu11 ** 2));
  const l1 = ((mu20 + mu02) / 2) + tmp;
  const l2 = ((mu20 + mu02) / 2) - tmp;
  const elong = Math.sqrt(Math.max(1e-6, l1)) / Math.sqrt(Math.max(1e-6, l2));
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  return { n, angle, elong, aspect: bw / Math.max(1, bh), bw, bh };
}

function blitWorldMask(sheet, atlas, frame, out) {
  if (!frame || frame.empty || !frame.w || !frame.h) return 0;
  const sx0 = (frame.slot ?? 0) * atlas.slotWidth;
  let painted = 0;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const alpha = sheet.data[((y * sheet.width) + (sx0 + x)) * 4 + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      const dx = ANCHOR_X + (frame.offsetX ?? 0) + x;
      const dy = ANCHOR_Y + (frame.offsetY ?? 0) + y;
      if (dx < 0 || dy < 0 || dx >= CANVAS || dy >= CANVAS) continue;
      out[(dy * CANVAS) + dx] = 1;
      painted += 1;
    }
  }
  return painted;
}

function weaponCoverage(glowMask, weaponMask) {
  let weapon = 0;
  let covered = 0;
  for (let i = 0; i < glowMask.length; i++) {
    if (!weaponMask[i]) continue;
    weapon += 1;
    if (glowMask[i]) covered += 1;
  }
  return weapon ? covered / weapon : 0;
}

function angDiff(a, b) {
  let d = Math.abs(a - b) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

function shapeScore(glowMoments, weaponMoments) {
  if (!glowMoments || !weaponMoments) return 0;
  const ad = angDiff(glowMoments.angle, weaponMoments.angle);
  const elongSim = Math.min(glowMoments.elong, weaponMoments.elong)
    / Math.max(glowMoments.elong, weaponMoments.elong);
  const aspectSim = Math.min(glowMoments.aspect, weaponMoments.aspect)
    / Math.max(glowMoments.aspect, weaponMoments.aspect);
  // Glows are usually larger; prefer weapon pixel counts in a sensible band.
  const ratio = glowMoments.n / Math.max(1, weaponMoments.n);
  const sizeFit = ratio >= 1.5 && ratio <= 20
    ? 1 - Math.min(1, Math.abs(Math.log(ratio / 5)) / 2)
    : 0.15;
  return (0.48 * (1 - (ad / (Math.PI / 2))))
    + (0.24 * elongSim)
    + (0.18 * aspectSim)
    + (0.10 * sizeFit);
}

async function analyze(dir, index) {
  const atlas = readJson(path.join(dir, `${index}.json`));
  const sheet = await loadSheet(path.join(dir, `${index}.png`));
  const frames = pickFrames(atlas);
  const moments = [];
  const worldMasks = [];
  for (const frame of frames) {
    moments.push(frameMoments(sheet, atlas, frame));
    const mask = new Uint8Array(CANVAS * CANVAS);
    blitWorldMask(sheet, atlas, frame, mask);
    worldMasks.push(mask);
  }
  return { index, moments, worldMasks, atlas, sheet, frames };
}

function scorePair(glow, weapon) {
  const n = Math.min(glow.moments.length, weapon.moments.length);
  if (!n) return { shape: 0, cover: 0, score: 0 };
  let shape = 0;
  let cover = 0;
  let usable = 0;
  for (let i = 0; i < n; i++) {
    const s = shapeScore(glow.moments[i], weapon.moments[i]);
    const c = weaponCoverage(glow.worldMasks[i], weapon.worldMasks[i]);
    if (!glow.moments[i] || !weapon.moments[i]) continue;
    shape += s;
    cover += c;
    usable += 1;
  }
  if (!usable) return { shape: 0, cover: 0, score: 0 };
  shape /= usable;
  cover /= usable;
  // Hard-ish gate: glow should mostly contain the weapon when drawn at native offsets.
  const coverTerm = cover < COVER_FLOOR ? cover * 0.35 : cover;
  const score = (0.72 * shape) + (0.28 * coverTerm);
  return { shape, cover, score };
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function labelWeapon(shape, namesByShape) {
  const names = namesByShape.get(shape) ?? [];
  return names.length ? names.join(", ") : `shape ${shape}`;
}

function writeSuggestionsHtml(suggestions, namesByShape, mappedCount, unmappedCount) {
  const cards = suggestions.map((s) => {
    if (s.empty) {
      return `<article class="card empty"><h2>Glow ${s.glow}</h2><p>Nearly empty — skip.</p></article>`;
    }
    const cands = s.candidates.map((c, i) => `
      <div class="cand">
        <div class="cand-meta">
          <strong>#${i + 1}</strong>
          shape ${c.weaponShape} — ${labelWeapon(c.weaponShape, namesByShape)}
          <span class="scores">score ${formatPct(c.score)} · shape ${formatPct(c.shape)} · cover ${formatPct(c.cover)}</span>
        </div>
        <canvas class="stage" width="200" height="170"
          data-glow="${s.glow}" data-weapon="${c.weaponShape}"></canvas>
      </div>`).join("");
    return `<article class="card" id="g${s.glow}">
      <h2>Glow ${s.glow}</h2>
      <p class="sub">Best shape guesses — check visually, then tell me which to lock in.</p>
      <div class="cands">${cands}</div>
    </article>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weapon glow match suggestions</title>
  <style>
    :root { color-scheme: dark; --bg:#0c0b09; --panel:#161310; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px; border-bottom:1px solid var(--line); max-width:1400px; }
    h1 { margin:0 0 8px; color:#f4dfb0; font-size:1.3rem; }
    .meta { color:var(--muted); max-width:900px; }
    code { color:#d4bc86; }
    nav { display:flex; flex-wrap:wrap; gap:6px; padding:12px 24px; border-bottom:1px solid var(--line); }
    nav a { color:var(--text); text-decoration:none; padding:4px 10px; border:1px solid var(--line); border-radius:999px; font:12px Consolas,monospace; }
    .grid { display:flex; flex-direction:column; gap:18px; padding:24px; max-width:1400px; }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; }
    .card h2 { margin:0 0 4px; color:#f4dfb0; }
    .sub { margin:0 0 12px; color:var(--muted); font-size:13px; }
    .cands { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; }
    .cand { background:#0f0d0b; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
    .cand-meta { padding:8px 10px; font-size:12px; border-bottom:1px solid var(--line); }
    .scores { display:block; color:var(--muted); margin-top:4px; font:11px Consolas,monospace; }
    canvas.stage { display:block; width:100%; image-rendering:pixelated; background:radial-gradient(circle at 50% 88%, #1a1712 0%, #050504 68%); }
    .empty { opacity:0.6; }
  </style>
</head>
<body>
  <header>
    <h1>Weapon glow match suggestions</h1>
    <p class="meta">
      Auto-ranked shortlists for unmapped glows. Open via the dev server:
      <code>http://localhost:4177/tile-review/weapon-glows/suggestions.html</code>
    </p>
    <p class="meta">${mappedCount} already mapped · ${unmappedCount} still open. These are guesses — confirm visually before locking in.</p>
  </header>
  <nav>${suggestions.filter((s) => !s.empty).map((s) => `<a href="#g${s.glow}">${s.glow}</a>`).join("")}</nav>
  <div class="grid">${cards}</div>
  <script>
    const STAGE_W = 200, STAGE_H = 170, AX = 100, AY = 140;
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(src));
        img.src = src;
      });
    }
    async function loadLayer(layer, index) {
      const base = "/public/sprite-sets/common/" + layer + "/" + index;
      const [atlas, sheet] = await Promise.all([
        fetch(base + ".json").then((r) => r.json()),
        loadImage(base + ".png"),
      ]);
      return { atlas, sheet };
    }
    function blit(ctx, sheet, atlas, action, frameIndex) {
      const clip = atlas.actions?.[action] ?? atlas.actions?.standing;
      const meta = clip?.frames?.[frameIndex] ?? clip?.frames?.[0];
      if (!meta || meta.empty || !meta.w) return;
      const sx = (meta.slot ?? 0) * atlas.slotWidth;
      ctx.drawImage(sheet, sx, 0, meta.w, meta.h, AX + meta.offsetX, AY + meta.offsetY, meta.w, meta.h);
    }
    async function paint(canvas) {
      const glowId = Number(canvas.dataset.glow);
      const weaponId = Number(canvas.dataset.weapon);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const [armour, hair, weapon, glow] = await Promise.all([
        loadLayer("armour", 1),
        loadLayer("hair", 1),
        loadLayer("weapon", weaponId),
        loadLayer("weaponGlow", glowId),
      ]);
      function frame(now) {
        const fi = Math.floor(now / 280) % 4;
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        blit(ctx, armour.sheet, armour.atlas, "standing", fi);
        blit(ctx, hair.sheet, hair.atlas, "standing", fi);
        blit(ctx, weapon.sheet, weapon.atlas, "standing", fi);
        const prev = ctx.globalCompositeOperation;
        const prevA = ctx.globalAlpha;
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.45;
        blit(ctx, glow.sheet, glow.atlas, "standing", fi);
        ctx.globalAlpha = prevA;
        ctx.globalCompositeOperation = prev;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    document.querySelectorAll("canvas.stage").forEach((c) => paint(c).catch(() => {}));
  </script>
</body>
</html>`;
  fs.mkdirSync(path.dirname(outHtmlPath), { recursive: true });
  fs.writeFileSync(outHtmlPath, html, "utf8");
}

async function main() {
  const mappings = readJson(mappingsPath).mappings ?? [];
  const mappedGlows = new Set(mappings.map((m) => m.glow));
  const mappedShapes = new Set(mappings.map((m) => m.weaponShape));
  const namesByShape = loadWeaponNames();
  const catalogue = readJson(cataloguePath);
  const allWeapons = catalogue.layers?.weapon?.indexes ?? listIndexes(weaponDir);
  const allGlows = listIndexes(glowDir);

  if (runValidate) {
    console.log("Validating against known mappings...");
    const knownGlows = [];
    const knownWeapons = [];
    for (const m of mappings) {
      knownGlows.push(await analyze(glowDir, m.glow));
      knownWeapons.push(await analyze(weaponDir, m.weaponShape));
    }
    let top1 = 0;
    let top3 = 0;
    for (let i = 0; i < mappings.length; i++) {
      const ranked = knownWeapons
        .map((weapon, wi) => ({ mapping: mappings[wi], ...scorePair(knownGlows[i], weapon) }))
        .sort((a, b) => b.score - a.score);
      const selfRank = ranked.findIndex((r) => r.mapping.weaponShape === mappings[i].weaponShape) + 1;
      if (selfRank === 1) top1 += 1;
      if (selfRank <= 3) top3 += 1;
      const self = ranked[selfRank - 1];
      const best = ranked[0];
      const mark = selfRank === 1 ? "OK " : `R${selfRank}`;
      console.log(
        `  glow ${String(mappings[i].glow).padStart(2)} → ${labelWeapon(mappings[i].weaponShape, namesByShape).padEnd(30)} ` +
        `${mark}  self=${formatPct(self.score)} best=${formatPct(best.score)}` +
        (selfRank === 1 ? "" : ` (best: ${labelWeapon(best.mapping.weaponShape, namesByShape)})`),
      );
    }
    console.log(`\nTop-1: ${top1}/${mappings.length}   Top-3: ${top3}/${mappings.length}`);
    if (validateOnly) return;
  }

  const glowIds = allGlows.filter((id) => !mappedGlows.has(id));
  const weaponIds = allWeapons.filter((id) => !mappedShapes.has(id));
  console.log(`\nAnalyzing ${glowIds.length} unmapped glows × ${weaponIds.length} unmapped weapons...`);
  const glows = [];
  for (const id of glowIds) glows.push(await analyze(glowDir, id));
  const weapons = [];
  for (const id of weaponIds) weapons.push(await analyze(weaponDir, id));

  const suggestions = [];
  for (const glow of glows) {
    const avgPixels = glow.moments.reduce((a, m) => a + (m?.n ?? 0), 0) / Math.max(1, glow.moments.length);
    if (avgPixels < 20) {
      suggestions.push({ glow: glow.index, empty: true, candidates: [] });
      continue;
    }
    const ranked = weapons
      .map((weapon) => ({
        weaponShape: weapon.index,
        names: namesByShape.get(weapon.index) ?? [],
        ...scorePair(glow, weapon),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topN));
    suggestions.push({ glow: glow.index, empty: false, candidates: ranked });
  }

  const flat = [];
  for (const s of suggestions) {
    if (s.empty || !s.candidates.length) continue;
    const best = s.candidates[0];
    const second = s.candidates[1];
    const margin = second ? best.score - second.score : best.score;
    flat.push({ glow: s.glow, margin, ...best });
  }
  flat.sort((a, b) => b.score - a.score || b.margin - a.margin);

  const usedGlows = new Set();
  const usedWeapons = new Set();
  const assigned = [];
  for (const row of flat) {
    if (usedGlows.has(row.glow) || usedWeapons.has(row.weaponShape)) continue;
    if (row.score < 0.62 || row.cover < COVER_FLOOR || row.margin < 0.015) continue;
    usedGlows.add(row.glow);
    usedWeapons.add(row.weaponShape);
    assigned.push(row);
  }

  console.log("\n=== Confident unique suggestions ===");
  if (!assigned.length) console.log("  (none cleared the confidence bar — use the shortlist page)");
  for (const row of assigned) {
    console.log(
      `Glow ${String(row.glow).padStart(2)} → shape ${String(row.weaponShape).padStart(2)} ` +
      `${labelWeapon(row.weaponShape, namesByShape).padEnd(36)} ` +
      `score ${formatPct(row.score)}  shape ${formatPct(row.shape)}  cover ${formatPct(row.cover)}  margin ${formatPct(row.margin)}`,
    );
  }

  console.log(`\n=== Top ${topN} shortlist per glow ===`);
  for (const s of suggestions) {
    if (s.empty) {
      console.log(`Glow ${s.glow}: (nearly empty — skip)`);
      continue;
    }
    const lines = s.candidates.slice(0, 5).map((c, i) => {
      const label = c.names.length ? c.names.join(", ") : `shape ${c.weaponShape}`;
      return `  ${i + 1}. shape ${String(c.weaponShape).padStart(2)} ${label.padEnd(34)} score ${formatPct(c.score)} cover ${formatPct(c.cover)}`;
    });
    console.log(`Glow ${s.glow}:\n${lines.join("\n")}`);
  }

  fs.writeFileSync(outJsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    method: "PCA orientation/elongation/aspect + native-offset weapon coverage",
    topN,
    assigned,
    suggestions,
  }, null, 2) + "\n");
  writeSuggestionsHtml(suggestions, namesByShape, mappings.length, glowIds.length);
  console.log(`\nWrote ${outJsonPath}`);
  console.log(`Wrote ${outHtmlPath}`);
  console.log("Open: http://localhost:4177/tile-review/weapon-glows/suggestions.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
