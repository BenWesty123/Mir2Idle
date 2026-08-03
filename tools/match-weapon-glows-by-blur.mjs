#!/usr/bin/env node
/**
 * Match CWeaponEffect glows to weapon shapes by blur correlation.
 *
 * Every confirmed pair shows the same thing: the glow art is a blurred, dilated
 * copy of that weapon's own sprite drawn at the same anchor. So blurring the
 * weapon's alpha and correlating it against the glow's alpha identifies the pair
 * far more reliably than silhouette moments do.
 *
 * Usage:
 *   node tools/match-weapon-glows-by-blur.mjs --validate
 *   node tools/match-weapon-glows-by-blur.mjs --top 4 --out tools/weapon-glow-blur-matches.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commonDir = path.join(root, "public", "sprite-sets", "common");
const mappingsPath = path.join(root, "tools", "weapon-glow-mappings.json");
const crystalItemsPath = path.join(root, "src", "data", "crystal-items.json");

const WORLD = 240;
const ANCHOR_X = 120;
const ANCHOR_Y = 165;
const MAX_RADIUS = 40;
const CORE_SATURATION = 0.34;
const CORE_MAX_RADIUS = 5;
// A correct glow is a dilation of the weapon at every brightness level, each with
// its own radius, so scoring several levels is far sharper than scoring one.
const LEVELS = [0.12, 0.3, 0.55];
const FRAME_PLAN = [
  ["standing", 0],
  ["standing", 2],
  ["attack1", 2],
  ["walking", 3],
];

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const validate = argv.includes("--validate");
const topN = Number(flag("top", 4));
const coreMode = flag("core", "desat");
const BRIGHT_CORE_FLOOR = 0.55;
const outPath = flag("out", path.join(root, "tools", "weapon-glow-blur-matches.json"));

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}

function listIndexes(layer) {
  return fs.readdirSync(path.join(commonDir, layer))
    .filter((n) => /^\d+\.json$/.test(n))
    .map((n) => Number(path.basename(n, ".json")))
    .sort((a, b) => a - b);
}

function weaponNames() {
  const byShape = new Map();
  try {
    const doc = readJson(crystalItemsPath);
    const items = Array.isArray(doc) ? doc : (doc.items ?? Object.values(doc));
    for (const it of items) {
      if (!it || it.type !== "Weapon" || typeof it.shape !== "number") continue;
      if (!byShape.has(it.shape)) byShape.set(it.shape, []);
      const list = byShape.get(it.shape);
      if (list.length < 2 && !list.includes(it.name)) list.push(it.name);
    }
  } catch {
    // optional
  }
  return byShape;
}

/**
 * Intensity field for one frame, blitted at the Crystal anchor.
 * Glow art is additive, so its visible extent tracks luminance, not just alpha.
 */
function frameField(sheet, atlas, frame, useLuma) {
  const field = new Float32Array(WORLD * WORLD);
  const mask = new Uint8Array(WORLD * WORLD);
  const core = new Uint8Array(WORLD * WORLD);
  if (!frame || frame.empty || !frame.w) return { field, mask, core, mass: 0 };
  const sx0 = (frame.slot ?? 0) * atlas.slotWidth;
  let mass = 0;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const si = ((y * sheet.width) + (sx0 + x)) * 4;
      const a = sheet.data[si + 3];
      if (a < 8) continue;
      const dx = ANCHOR_X + (frame.offsetX ?? 0) + x;
      const dy = ANCHOR_Y + (frame.offsetY ?? 0) + y;
      if (dx < 0 || dy < 0 || dx >= WORLD || dy >= WORLD) continue;
      const r = sheet.data[si];
      const g = sheet.data[si + 1];
      const b = sheet.data[si + 2];
      const luma = useLuma ? ((0.299 * r) + (0.587 * g) + (0.114 * b)) / 255 : 1;
      const value = (a / 255) * luma;
      const idx = (dy * WORLD) + dx;
      field[idx] = value;
      mask[idx] = 1;
      mass += value;
      if (useLuma) {
        // The lib draws a desaturated copy of the weapon inside a saturated halo.
        const max = Math.max(r, g, b);
        const sat = max > 0 ? (max - Math.min(r, g, b)) / max : 0;
        if (sat < CORE_SATURATION && max > 40) core[idx] = 1;
      }
    }
  }
  return { field, mask, core, mass };
}

async function loadFields(layer, index) {
  const useLuma = layer === "weaponGlow";
  const atlas = readJson(path.join(commonDir, layer, `${index}.json`));
  const { data, info } = await sharp(path.join(commonDir, layer, `${index}.png`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sheet = { data, width: info.width, height: info.height };
  const fields = [];
  for (const [action, idx] of FRAME_PLAN) {
    const frames = atlas.actions?.[action]?.frames ?? [];
    fields.push(frameField(sheet, atlas, frames[idx], useLuma));
  }
  const result = { index, fields, totalMass: fields.reduce((s, f) => s + f.mass, 0) };
  if (useLuma) {
    if (coreMode === "bright") {
      // FX-family glows hide the weapon as the pale bright centre of the burst.
      for (const f of fields) {
        let max = 0;
        for (let i = 0; i < f.field.length; i++) if (f.field[i] > max) max = f.field[i];
        const floor = max * BRIGHT_CORE_FLOOR;
        f.core = new Uint8Array(f.field.length);
        if (max > 0.2) {
          for (let i = 0; i < f.field.length; i++) if (f.field[i] >= floor) f.core[i] = 1;
        }
      }
    }
    result.cores = fields.map((f) => f.core);
    result.coreCounts = fields.map((f) => {
      let n = 0;
      for (let i = 0; i < f.core.length; i++) n += f.core[i];
      return n;
    });
    result.masks = [];
    result.maskCounts = [];
    for (const level of LEVELS) {
      const perFrame = [];
      const counts = [];
      for (const f of fields) {
        const m = new Uint8Array(WORLD * WORLD);
        let n = 0;
        for (let i = 0; i < f.field.length; i++) {
          if (f.field[i] >= level) { m[i] = 1; n += 1; }
        }
        perFrame.push(m);
        counts.push(n);
      }
      result.masks.push(perFrame);
      result.maskCounts.push(counts);
    }
  }
  return result;
}

/** Felzenszwalb 1D squared-distance transform. */
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + (q * q)) - (f[v[k]] + (v[k] * v[k]))) / ((2 * q) - (2 * v[k]));
    while (s <= z[k]) {
      k -= 1;
      s = ((f[q] + (q * q)) - (f[v[k]] + (v[k] * v[k]))) / ((2 * q) - (2 * v[k]));
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k += 1;
    d[q] = ((q - v[k]) * (q - v[k])) + f[v[k]];
  }
}

/** Exact Euclidean distance (in px) from every pixel to the nearest set pixel. */
function distanceTransform(mask) {
  const INF = 1e12;
  const grid = new Float64Array(WORLD * WORLD);
  for (let i = 0; i < grid.length; i++) grid[i] = mask[i] ? 0 : INF;
  const f = new Float64Array(WORLD);
  const d = new Float64Array(WORLD);
  const v = new Int32Array(WORLD);
  const z = new Float64Array(WORLD + 1);
  for (let x = 0; x < WORLD; x++) {
    for (let y = 0; y < WORLD; y++) f[y] = grid[(y * WORLD) + x];
    edt1d(f, WORLD, d, v, z);
    for (let y = 0; y < WORLD; y++) grid[(y * WORLD) + x] = d[y];
  }
  for (let y = 0; y < WORLD; y++) {
    const row = y * WORLD;
    for (let x = 0; x < WORLD; x++) f[x] = grid[row + x];
    edt1d(f, WORLD, d, v, z);
    for (let x = 0; x < WORLD; x++) grid[row + x] = Math.sqrt(d[x]);
  }
  return grid;
}

/**
 * Best IoU between the glow mask and the weapon mask dilated by r, over all r.
 * Dilating by r is exactly "distance <= r", so one histogram pass scores every r.
 */
function bestDilationIoU(dist, glowMask, glowCount, maxRadius = MAX_RADIUS) {
  if (!glowCount) return { iou: 0, radius: null };
  const allHist = new Float64Array(maxRadius + 2);
  const hitHist = new Float64Array(maxRadius + 2);
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d > maxRadius) continue;
    const bin = Math.ceil(d);
    allHist[bin] += 1;
    if (glowMask[i]) hitHist[bin] += 1;
  }
  let all = 0;
  let hit = 0;
  let best = 0;
  let bestRadius = null;
  for (let r = 0; r <= maxRadius; r++) {
    all += allHist[r];
    hit += hitHist[r];
    const iou = hit / ((all + glowCount) - hit);
    if (iou > best) { best = iou; bestRadius = r; }
  }
  return { iou: best, radius: bestRadius };
}

async function main() {
  const mappings = fs.existsSync(mappingsPath) ? (readJson(mappingsPath).mappings ?? []) : [];
  const mappedGlows = new Set(mappings.map((m) => m.glow));
  const mappedShapes = new Set(mappings.map((m) => m.weaponShape));
  const truth = new Map(mappings.map((m) => [m.glow, m.weaponShape]));
  const names = weaponNames();

  const glowFilter = flag("glows", null);
  const shapeFilter = flag("shapes", null);
  const wanted = glowFilter ? new Set(glowFilter.split(",").map(Number)) : null;

  const glowIndexes = listIndexes("weaponGlow").filter((i) => (wanted
    ? wanted.has(i)
    : (validate ? mappedGlows.has(i) : !mappedGlows.has(i))));
  const weaponIndexes = listIndexes("weapon").filter((i) => (shapeFilter === "all" || validate
    ? true
    : !mappedShapes.has(i)));

  const glows = [];
  for (const index of glowIndexes) {
    const g = await loadFields("weaponGlow", index);
    if (g.totalMass < 40) continue;
    glows.push(g);
  }

  const scores = new Map(glows.map((g) => [g.index, new Map()]));

  for (const shape of weaponIndexes) {
    const w = await loadFields("weapon", shape).catch(() => null);
    if (!w || w.totalMass < 20) continue;
    const dists = w.fields.map((f) => (f.mass < 5 ? null : distanceTransform(f.mask)));
    for (const g of glows) {
      let sum = 0;
      let used = 0;
      let coreSum = 0;
      let coreUsed = 0;
      let radius = null;
      for (let f = 0; f < FRAME_PLAN.length; f++) {
        if (!dists[f] || g.fields[f].mass < 5) continue;
        for (let l = 0; l < LEVELS.length; l++) {
          const { iou, radius: r } = bestDilationIoU(dists[f], g.masks[l][f], g.maskCounts[l][f]);
          sum += iou;
          used += 1;
          if (f === 0 && l === 1) radius = r;
        }
        if (g.coreCounts[f] > 30) {
          coreSum += bestDilationIoU(dists[f], g.cores[f], g.coreCounts[f], CORE_MAX_RADIUS).iou;
          coreUsed += 1;
        }
      }
      if (!used) continue;
      const halo = sum / used;
      const core = coreUsed ? coreSum / coreUsed : null;
      scores.get(g.index).set(shape, {
        score: core == null ? halo : (0.35 * halo) + (0.65 * core),
        halo,
        core,
        radius,
      });
    }
    process.stderr.write(`.`);
  }
  process.stderr.write("\n");

  const results = [];
  for (const g of glows) {
    const ranked = [...scores.get(g.index).entries()]
      .map(([shape, v]) => ({ shape, ...v, names: names.get(shape) ?? [] }))
      .sort((a, b) => b.score - a.score);
    results.push({
      glow: g.index,
      truth: truth.get(g.index) ?? null,
      margin: ranked.length > 1 ? ranked[0].score - ranked[1].score : 0,
      candidates: ranked.slice(0, topN),
    });
  }

  if (validate) {
    let top1 = 0; let top3 = 0;
    for (const r of results) {
      const rank = r.candidates.findIndex((c) => c.shape === r.truth);
      const allRank = [...scores.get(r.glow).entries()].sort((a, b) => b[1].score - a[1].score)
        .findIndex(([shape]) => shape === r.truth);
      if (allRank === 0) top1 += 1;
      if (allRank >= 0 && allRank < 3) top3 += 1;
      console.log(
        `glow ${String(r.glow).padStart(2)} truth shape ${String(r.truth).padStart(2)} ` +
        `rank ${allRank + 1} | top: ${r.candidates.map((c) => `${c.shape}(${c.score.toFixed(3)})`).join(" ")}` +
        (rank === 0 ? "" : "   <-- MISS"),
      );
    }
    console.log(`\ntop-1 ${top1}/${results.length}   top-3 ${top3}/${results.length}`);
    return;
  }

  results.sort((a, b) => b.margin - a.margin);
  fs.writeFileSync(outPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    method: "dilation IoU (glow level sets vs weapon silhouette dilated by r, at native anchor)",
    levels: LEVELS,
    frames: FRAME_PLAN.map(([a, i]) => `${a}[${i}]`),
    results,
  }, null, 2)}\n`);
  for (const r of results) {
    console.log(
      `glow ${String(r.glow).padStart(2)} margin ${r.margin.toFixed(3)} -> ` +
      r.candidates.map((c) => `${c.shape}:${c.score.toFixed(3)}${c.names.length ? `(${c.names[0]})` : ""}`).join("  "),
    );
  }
  console.log(`\nwrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
