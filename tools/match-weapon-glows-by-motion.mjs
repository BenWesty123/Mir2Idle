#!/usr/bin/env node
/**
 * Score CWeaponEffect ↔ weapon pairs by motion tracking.
 *
 * A weapon's effect is drawn on the same frame counter as the weapon, so across an
 * animation the vector from the weapon's centroid to the glow's centroid stays
 * nearly constant — the FX rides the weapon through the swing. For a wrong weapon
 * the offset wanders. Score = RMS deviation of that offset across frames (lower is
 * better), which is shape-agnostic and works for streak/burst FX that defeat
 * outline matching.
 *
 * Usage:
 *   node tools/match-weapon-glows-by-motion.mjs --validate            (aura pairs)
 *   node tools/match-weapon-glows-by-motion.mjs --check-mappings      (every mapped pair vs all shapes)
 *   node tools/match-weapon-glows-by-motion.mjs --glows 44,48 --top 5
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commonDir = path.join(root, "public", "sprite-sets", "common");
const mappingsPath = path.join(root, "tools", "weapon-glow-mappings.json");
const crystalItemsPath = path.join(root, "src", "data", "crystal-items.json");

const ANCHOR = 300; // virtual anchor; only relative positions matter
const FRAME_PLAN = [];
for (let i = 0; i < 4; i++) FRAME_PLAN.push(["standing", i]);
for (let i = 0; i < 6; i++) FRAME_PLAN.push(["walking", i]);
for (let i = 0; i < 6; i++) FRAME_PLAN.push(["attack1", i]);
for (let i = 0; i < 6; i++) FRAME_PLAN.push(["attack2", i]);

const MIN_SHARED_FRAMES = 9;
const MAX_MEAN_OFFSET = 48;

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const validate = argv.includes("--validate");
const checkMappings = argv.includes("--check-mappings");
const topN = Number(flag("top", 5));

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
    // optional decoration
  }
  return byShape;
}

/** Luma-weighted centroid of one frame in anchor-relative coordinates. */
function frameCentroid(sheet, atlas, frame, useLuma) {
  if (!frame || frame.empty || !frame.w) return null;
  const sx0 = (frame.slot ?? 0) * atlas.slotWidth;
  let mass = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const si = ((y * sheet.width) + (sx0 + x)) * 4;
      const a = sheet.data[si + 3];
      if (a < 8) continue;
      const luma = useLuma
        ? ((0.299 * sheet.data[si]) + (0.587 * sheet.data[si + 1]) + (0.114 * sheet.data[si + 2])) / 255
        : 1;
      const w = (a / 255) * luma;
      mass += w;
      sumX += w * (ANCHOR + (frame.offsetX ?? 0) + x);
      sumY += w * (ANCHOR + (frame.offsetY ?? 0) + y);
    }
  }
  if (mass < 25) return null;
  return { x: sumX / mass, y: sumY / mass, mass };
}

async function loadCentroids(layer, index) {
  const atlas = readJson(path.join(commonDir, layer, `${index}.json`));
  const { data, info } = await sharp(path.join(commonDir, layer, `${index}.png`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sheet = { data, width: info.width, height: info.height };
  return FRAME_PLAN.map(([action, idx]) => {
    const frames = atlas.actions?.[action]?.frames ?? [];
    return frameCentroid(sheet, atlas, frames[idx], layer === "weaponGlow");
  });
}

/** RMS deviation of the glow→weapon offset across shared frames. */
function trackScore(glowCentroids, weaponCentroids) {
  const offsets = [];
  for (let f = 0; f < FRAME_PLAN.length; f++) {
    const g = glowCentroids[f];
    const w = weaponCentroids[f];
    if (!g || !w) continue;
    offsets.push({ dx: g.x - w.x, dy: g.y - w.y });
  }
  if (offsets.length < MIN_SHARED_FRAMES) return null;
  const mx = offsets.reduce((s, o) => s + o.dx, 0) / offsets.length;
  const my = offsets.reduce((s, o) => s + o.dy, 0) / offsets.length;
  const meanDist = Math.hypot(mx, my);
  if (meanDist > MAX_MEAN_OFFSET) return null;
  const varSum = offsets.reduce((s, o) => s + ((o.dx - mx) ** 2) + ((o.dy - my) ** 2), 0);
  return {
    rms: Math.sqrt(varSum / offsets.length),
    meanOffset: meanDist,
    frames: offsets.length,
  };
}

async function main() {
  const mappings = fs.existsSync(mappingsPath) ? (readJson(mappingsPath).mappings ?? []) : [];
  const names = weaponNames();

  const glowFilter = flag("glows", null);
  let glowIndexes;
  if (glowFilter) glowIndexes = glowFilter.split(",").map(Number);
  else if (validate) glowIndexes = mappings.filter((m) => m.family === "aura").map((m) => m.glow);
  else if (checkMappings) glowIndexes = mappings.map((m) => m.glow);
  else glowIndexes = listIndexes("weaponGlow");

  const truth = new Map(mappings.map((m) => [m.glow, m.weaponShape]));
  const weaponIndexes = listIndexes("weapon");

  const weapons = new Map();
  for (const shape of weaponIndexes) {
    weapons.set(shape, await loadCentroids("weapon", shape).catch(() => null));
  }

  let hits = 0;
  let total = 0;
  for (const glowIndex of glowIndexes.sort((a, b) => a - b)) {
    const glow = await loadCentroids("weaponGlow", glowIndex).catch(() => null);
    if (!glow) continue;
    const ranked = [];
    for (const [shape, weapon] of weapons) {
      if (!weapon) continue;
      const s = trackScore(glow, weapon);
      if (s) ranked.push({ shape, ...s });
    }
    ranked.sort((a, b) => a.rms - b.rms);
    const expected = truth.get(glowIndex) ?? null;
    const rank = expected == null ? -1 : ranked.findIndex((r) => r.shape === expected);
    if (expected != null) {
      total += 1;
      if (rank === 0) hits += 1;
    }
    const label = (shape) => {
      const n = names.get(shape) ?? [];
      return `${shape}${n.length ? `(${n[0]})` : ""}`;
    };
    console.log(
      `glow ${String(glowIndex).padStart(2)}${expected != null ? ` mapped->${expected} rank ${rank + 1}` : ""} | ` +
      ranked.slice(0, topN).map((r) => `${label(r.shape)}:${r.rms.toFixed(1)}px@${r.frames}f`).join("  ") +
      (expected != null && rank !== 0 ? "   <-- DISAGREES" : ""),
    );
  }
  if (total) console.log(`\nmapped pair is rank-1 for ${hits}/${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
