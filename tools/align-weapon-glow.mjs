#!/usr/bin/env node
/**
 * Re-align a CWeaponEffect glow atlas so it tracks its weapon shape, frame by frame.
 *
 * Crystal positions every frame independently via offsetX/offsetY, so a glow that
 * looks "rotated" off its weapon is often just per-frame offsets drifting. Two modes:
 *
 *   translate (default) - per-frame integer shift only. Rewrites offsetX/offsetY and
 *                         leaves the PNG byte-identical, so no art is resampled.
 *   rigid               - per-frame rotate + shift around the weapon centroid. Repacks
 *                         the sheet (resamples, so slightly softer pixels).
 *
 * Scoring per frame: 0.7 * (glow's desaturated core landing on the dilated weapon
 * silhouette) + 0.3 * (weapon pixels sitting under the glow). Per-frame winners are
 * then regularised toward the median so the animation does not jitter.
 *
 * Usage:
 *   node tools/align-weapon-glow.mjs --glow 56 --weapon 56 --report
 *   node tools/align-weapon-glow.mjs --glow 56 --weapon 56
 *   node tools/align-weapon-glow.mjs --glow 56 --weapon 56 --mode rigid
 *   node tools/align-weapon-glow.mjs --glow 56 --fixed -12,1,-5
 *   node tools/align-weapon-glow.mjs --glow 56 --restore
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commonDir = path.join(root, "public", "sprite-sets", "common");
const backupRoot = path.join(root, "tools", "weapon-glow-align-backups");

const WORLD = 360;
const AX = 180;
const AY = 220;
const ALPHA_MIN = 8;
const DILATE = 2;
const SHIFT_RANGE = 12;
const ANGLE_RANGE = 14;
/** A frame keeps its own fit only if it beats the shared median by this much. */
const MEDIAN_TOLERANCE = 0.04;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) out[t.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else out._.push(t);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const glowIndex = Number(args.glow);
const weaponIndex = Number(args.weapon ?? args.glow);
const report = Boolean(args.report);
const restore = Boolean(args.restore);
const mode = args.mode === "rigid" ? "rigid" : "translate";
const fixedSpec = typeof args.fixed === "string" ? args.fixed.split(",").map(Number) : null;

if (!Number.isFinite(glowIndex)) {
  console.error("Usage: node tools/align-weapon-glow.mjs --glow N [--weapon N] [--mode translate|rigid] [--report|--restore]");
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}

async function loadLayer(layer, index) {
  const jsonPath = path.join(commonDir, layer, `${index}.json`);
  const pngPath = path.join(commonDir, layer, `${index}.png`);
  const atlas = readJson(jsonPath);
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { atlas, sheet: { data, width: info.width, height: info.height }, jsonPath, pngPath };
}

/**
 * Pull one frame's pixels into anchor space.
 * kind "weapon" keeps everything; "glow" also flags the desaturated core, which is
 * the copy of the weapon drawn inside the halo.
 */
function extract(layer, frame, kind) {
  if (!frame || frame.empty || !frame.w) return null;
  const sx0 = (frame.slot ?? 0) * layer.atlas.slotWidth;
  const all = [];
  const core = [];
  let mass = 0;
  let mx = 0;
  let my = 0;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const si = ((y * layer.sheet.width) + (sx0 + x)) * 4;
      const a = layer.sheet.data[si + 3];
      if (a < ALPHA_MIN) continue;
      const px = AX + (frame.offsetX ?? 0) + x;
      const py = AY + (frame.offsetY ?? 0) + y;
      if (px < 0 || py < 0 || px >= WORLD || py >= WORLD) continue;
      const r = layer.sheet.data[si];
      const g = layer.sheet.data[si + 1];
      const b = layer.sheet.data[si + 2];
      const w = a / 255;
      all.push({ x: px, y: py, w });
      mass += w;
      mx += w * px;
      my += w * py;
      if (kind === "glow") {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max > 0 ? (max - min) / max : 0;
        const luma = ((0.299 * r) + (0.587 * g) + (0.114 * b)) / 255;
        if (sat < 0.38 && max > 50) core.push({ x: px, y: py, w: w * luma });
      }
    }
  }
  if (mass < 5) return null;
  return { all, core: core.length > 30 ? core : all, cx: mx / mass, cy: my / mass, mass };
}

function toMask(pts, dilate) {
  const m = new Uint8Array(WORLD * WORLD);
  for (const p of pts) m[((p.y | 0) * WORLD) + (p.x | 0)] = 1;
  if (!dilate) return m;
  const out = new Uint8Array(WORLD * WORLD);
  for (let y = dilate; y < WORLD - dilate; y++) {
    for (let x = dilate; x < WORLD - dilate; x++) {
      let v = 0;
      for (let dy = -dilate; dy <= dilate && !v; dy++) {
        for (let dx = -dilate; dx <= dilate; dx++) {
          if (m[((y + dy) * WORLD) + (x + dx)]) { v = 1; break; }
        }
      }
      out[(y * WORLD) + x] = v;
    }
  }
  return out;
}

function scoreFit(glow, weapon, ang, dx, dy) {
  const rad = ang * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const px = weapon.cx;
  const py = weapon.cy;

  let hit = 0;
  let tot = 0;
  for (const p of glow.core) {
    const rx = p.x - px;
    const ry = p.y - py;
    const nx = Math.round(px + (rx * c) - (ry * s) + dx);
    const ny = Math.round(py + (rx * s) + (ry * c) + dy);
    if (nx < 0 || ny < 0 || nx >= WORLD || ny >= WORLD) continue;
    tot += p.w;
    hit += p.w * weapon.mask[(ny * WORLD) + nx];
  }
  const coreOnWeapon = tot ? hit / tot : 0;

  // Reverse term stops the fit from sliding the glow off the weapon entirely.
  let wHit = 0;
  let wTot = 0;
  for (const p of weapon.all) {
    const rx = p.x - px - dx;
    const ry = p.y - py - dy;
    const ox = Math.round(px + (rx * c) + (ry * s));
    const oy = Math.round(py - (rx * s) + (ry * c));
    wTot += p.w;
    if (ox < 0 || oy < 0 || ox >= WORLD || oy >= WORLD) continue;
    wHit += p.w * glow.mask[(oy * WORLD) + ox];
  }
  const weaponUnderGlow = wTot ? wHit / wTot : 0;

  return (0.7 * coreOnWeapon) + (0.3 * weaponUnderGlow);
}

function searchFrame(glow, weapon) {
  const base = scoreFit(glow, weapon, 0, 0, 0);
  let best = { score: base, ang: 0, dx: 0, dy: 0 };
  const angles = mode === "rigid"
    ? Array.from({ length: (ANGLE_RANGE * 2) + 1 }, (_, i) => i - ANGLE_RANGE)
    : [0];
  for (const ang of angles) {
    for (let dx = -SHIFT_RANGE; dx <= SHIFT_RANGE; dx++) {
      for (let dy = -SHIFT_RANGE; dy <= SHIFT_RANGE; dy++) {
        const sc = scoreFit(glow, weapon, ang, dx, dy);
        if (sc > best.score) best = { score: sc, ang, dx, dy };
      }
    }
  }
  if (mode === "rigid" && best.ang !== 0) {
    // Refine the winning angle at half-degree resolution.
    for (let ang = best.ang - 1; ang <= best.ang + 1; ang += 0.5) {
      for (let dx = best.dx - 2; dx <= best.dx + 2; dx++) {
        for (let dy = best.dy - 2; dy <= best.dy + 2; dy++) {
          const sc = scoreFit(glow, weapon, ang, dx, dy);
          if (sc > best.score) best = { score: sc, ang, dx, dy };
        }
      }
    }
  }
  return { ...best, base };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function transformPixel(p, ang, dx, dy, pivot) {
  const rad = ang * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rx = p.x - pivot.x;
  const ry = p.y - pivot.y;
  return {
    x: pivot.x + (rx * c) - (ry * s) + dx,
    y: pivot.y + (rx * s) + (ry * c) + dy,
  };
}

function rasterize(pixels) {
  if (!pixels.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pixels) {
    const x0 = Math.floor(p.x);
    const y0 = Math.floor(p.y);
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x0 + 1 > maxX) maxX = x0 + 1;
    if (y0 + 1 > maxY) maxY = y0 + 1;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const buf = Buffer.alloc(w * h * 4);
  for (const p of pixels) {
    const x = p.x - minX;
    const y = p.y - minY;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const samples = [
      [x0, y0, (1 - fx) * (1 - fy)],
      [x0 + 1, y0, fx * (1 - fy)],
      [x0, y0 + 1, (1 - fx) * fy],
      [x0 + 1, y0 + 1, fx * fy],
    ];
    for (const [sx, sy, weight] of samples) {
      if (sx < 0 || sy < 0 || sx >= w || sy >= h || weight <= 0) continue;
      const di = ((sy * w) + sx) * 4;
      const wa = p.a * weight;
      const oa = buf[di + 3];
      const na = Math.min(255, oa + wa);
      if (na <= 0) continue;
      buf[di] = Math.min(255, ((buf[di] * oa) + (p.r * wa)) / na);
      buf[di + 1] = Math.min(255, ((buf[di + 1] * oa) + (p.g * wa)) / na);
      buf[di + 2] = Math.min(255, ((buf[di + 2] * oa) + (p.b * wa)) / na);
      buf[di + 3] = na;
    }
  }
  return { buf, w, h, offsetX: minX, offsetY: minY };
}

function backupPaths(index) {
  const dir = path.join(backupRoot, String(index));
  return {
    dir,
    json: path.join(dir, `${index}.json`),
    png: path.join(dir, `${index}.png`),
    meta: path.join(dir, "align-meta.json"),
  };
}

function restoreBackup() {
  const bak = backupPaths(glowIndex);
  if (!fs.existsSync(bak.json) || !fs.existsSync(bak.png)) {
    console.error(`No backup at ${bak.dir}`);
    process.exit(1);
  }
  fs.copyFileSync(bak.json, path.join(commonDir, "weaponGlow", `${glowIndex}.json`));
  fs.copyFileSync(bak.png, path.join(commonDir, "weaponGlow", `${glowIndex}.png`));
  console.log(`Restored glow ${glowIndex} from ${bak.dir}`);
}

async function main() {
  if (restore) {
    restoreBackup();
    return;
  }

  const glow = await loadLayer("weaponGlow", glowIndex);
  const weapon = await loadLayer("weapon", weaponIndex);

  // Pass 1: measure every shared frame.
  const fits = [];
  for (const [action, clip] of Object.entries(glow.atlas.actions ?? {})) {
    const gFrames = clip?.frames ?? [];
    const wFrames = weapon.atlas.actions?.[action]?.frames ?? [];
    for (let i = 0; i < gFrames.length; i++) {
      const gFrame = gFrames[i];
      const g = extract(glow, gFrame, "glow");
      const w = wFrames[i] ? extract(weapon, wFrames[i], "weapon") : null;
      if (!g) {
        fits.push({ action, index: i, glow: null, weapon: null, fit: null });
        continue;
      }
      if (!w) {
        fits.push({ action, index: i, glow: g, weapon: null, fit: null });
        continue;
      }
      g.mask = toMask(g.all, 0);
      w.mask = toMask(w.all, DILATE);
      const fit = fixedSpec && fixedSpec.length >= 3 && fixedSpec.every(Number.isFinite)
        ? {
          ang: fixedSpec[0],
          dx: fixedSpec[1],
          dy: fixedSpec[2],
          base: scoreFit(g, w, 0, 0, 0),
          score: scoreFit(g, w, fixedSpec[0], fixedSpec[1], fixedSpec[2]),
        }
        : searchFrame(g, w);
      fits.push({ action, index: i, glow: g, weapon: w, fit });
    }
  }

  // Pass 2: regularise. A frame only keeps its own fit if the shared median is
  // meaningfully worse for it; otherwise it uses the median so motion stays smooth.
  const measured = fits.filter((f) => f.fit);
  const med = {
    ang: median(measured.map((f) => f.fit.ang)),
    dx: Math.round(median(measured.map((f) => f.fit.dx))),
    dy: Math.round(median(measured.map((f) => f.fit.dy))),
  };
  let kept = 0;
  for (const f of measured) {
    const medScore = scoreFit(f.glow, f.weapon, med.ang, med.dx, med.dy);
    if (f.fit.score - medScore <= MEDIAN_TOLERANCE) {
      f.applied = { ...med, score: medScore, base: f.fit.base, source: "median" };
    } else {
      f.applied = { ...f.fit, source: "frame" };
      kept += 1;
    }
  }
  for (const f of fits) {
    if (!f.applied) f.applied = { ...med, score: 0, base: 0, source: "median-fallback" };
  }

  const baseMean = measured.reduce((s, f) => s + f.fit.base, 0) / measured.length;
  const newMean = measured.reduce((s, f) => s + f.applied.score, 0) / measured.length;
  const improved = measured.filter((f) => f.applied.score > f.fit.base + 0.005).length;
  const regressed = measured.filter((f) => f.applied.score < f.fit.base - 0.005).length;

  console.log(`glow ${glowIndex} → weapon ${weaponIndex}  [mode: ${mode}]`);
  console.log(`  median correction: rot ${med.ang}°, shift (${med.dx}, ${med.dy})`);
  console.log(`  alignment score:   ${baseMean.toFixed(3)} → ${newMean.toFixed(3)} over ${measured.length} frames`);
  console.log(`  frames improved ${improved}, regressed ${regressed}, using own fit ${kept}`);

  if (report) {
    const byAction = {};
    for (const f of measured) {
      byAction[f.action] ??= [];
      byAction[f.action].push(f);
    }
    for (const [action, list] of Object.entries(byAction).slice(0, 6)) {
      console.log(`  ${action}: ` + list.map((f) =>
        `f${f.index} ${f.fit.base.toFixed(2)}→${f.applied.score.toFixed(2)}` +
        `(${f.applied.ang ? `${f.applied.ang}° ` : ""}${f.applied.dx},${f.applied.dy})`).join("  "));
    }
    console.log("\n[report only] nothing written.");
    return;
  }

  const bak = backupPaths(glowIndex);
  fs.mkdirSync(bak.dir, { recursive: true });
  if (!fs.existsSync(bak.json)) fs.copyFileSync(glow.jsonPath, bak.json);
  if (!fs.existsSync(bak.png)) fs.copyFileSync(glow.pngPath, bak.png);

  const newAtlas = { ...glow.atlas, actions: {} };

  if (mode === "translate") {
    // Lossless: shift each frame by editing its offsets, PNG untouched.
    for (const [action, clip] of Object.entries(glow.atlas.actions ?? {})) {
      newAtlas.actions[action] = {
        ...clip,
        frames: (clip.frames ?? []).map((frame, i) => {
          const f = fits.find((x) => x.action === action && x.index === i);
          if (!frame || frame.empty || !frame.w || !f?.applied) return { ...frame };
          return {
            ...frame,
            offsetX: (frame.offsetX ?? 0) + Math.round(f.applied.dx),
            offsetY: (frame.offsetY ?? 0) + Math.round(f.applied.dy),
          };
        }),
      };
    }
    fs.writeFileSync(glow.jsonPath, `${JSON.stringify(newAtlas, null, 2)}\n`);
    console.log(`\n  wrote ${glow.jsonPath} (offsets only — PNG untouched)`);
  } else {
    // Rigid: rebuild the sheet with rotated frames.
    const rasters = new Map();
    for (const [action, clip] of Object.entries(glow.atlas.actions ?? {})) {
      const gFrames = clip?.frames ?? [];
      for (let i = 0; i < gFrames.length; i++) {
        const frame = gFrames[i];
        if (!frame || frame.empty || !frame.w) continue;
        const f = fits.find((x) => x.action === action && x.index === i);
        const pivot = f?.weapon ? { x: f.weapon.cx, y: f.weapon.cy } : { x: AX, y: AY };
        const sx0 = (frame.slot ?? 0) * glow.atlas.slotWidth;
        const pixels = [];
        for (let y = 0; y < frame.h; y++) {
          for (let x = 0; x < frame.w; x++) {
            const si = ((y * glow.sheet.width) + (sx0 + x)) * 4;
            const a = glow.sheet.data[si + 3];
            if (a < ALPHA_MIN) continue;
            const src = { x: AX + (frame.offsetX ?? 0) + x, y: AY + (frame.offsetY ?? 0) + y };
            const t = transformPixel(src, f.applied.ang, f.applied.dx, f.applied.dy, pivot);
            pixels.push({
              x: t.x - AX,
              y: t.y - AY,
              r: glow.sheet.data[si],
              g: glow.sheet.data[si + 1],
              b: glow.sheet.data[si + 2],
              a,
            });
          }
        }
        const raster = rasterize(pixels);
        if (raster) rasters.set(`${action}:${i}`, raster);
      }
    }

    // These atlases are a single row of slots (readers index at sx = slot * slotWidth,
    // sy = 0), so the rebuilt sheet must stay one row too.
    const live = [...rasters.values()];
    const sw = Math.max(...live.map((r) => r.w)) + 1;
    const sh = Math.max(...live.map((r) => r.h)) + 1;
    const sheetW = live.length * sw;
    const sheetH = sh;
    const sheet = Buffer.alloc(sheetW * sheetH * 4);
    newAtlas.slotWidth = sw;
    newAtlas.slotHeight = sh;

    let slot = 0;
    for (const [action, clip] of Object.entries(glow.atlas.actions ?? {})) {
      const frames = [];
      for (let i = 0; i < (clip.frames?.length ?? 0); i++) {
        const orig = clip.frames[i];
        const raster = rasters.get(`${action}:${i}`);
        if (!raster) {
          frames.push({ ...orig, empty: true, w: 0, h: 0, slot: 0 });
          continue;
        }
        const ox = slot * sw;
        for (let y = 0; y < raster.h; y++) {
          for (let x = 0; x < raster.w; x++) {
            const si = ((y * raster.w) + x) * 4;
            const di = ((y * sheetW) + (ox + x)) * 4;
            sheet[di] = raster.buf[si];
            sheet[di + 1] = raster.buf[si + 1];
            sheet[di + 2] = raster.buf[si + 2];
            sheet[di + 3] = raster.buf[si + 3];
          }
        }
        frames.push({
          slot,
          srcFrame: orig.srcFrame,
          w: raster.w,
          h: raster.h,
          offsetX: raster.offsetX,
          offsetY: raster.offsetY,
          empty: false,
        });
        slot += 1;
      }
      newAtlas.actions[action] = { ...clip, frames };
    }

    await sharp(sheet, { raw: { width: sheetW, height: sheetH, channels: 4 } }).png().toFile(glow.pngPath);
    fs.writeFileSync(glow.jsonPath, `${JSON.stringify(newAtlas, null, 2)}\n`);
    console.log(`\n  wrote ${glow.pngPath} + ${glow.jsonPath}`);
  }

  fs.writeFileSync(bak.meta, JSON.stringify({
    glow: glowIndex,
    weapon: weaponIndex,
    mode,
    median: med,
    baseMean: Number(baseMean.toFixed(4)),
    newMean: Number(newMean.toFixed(4)),
    frames: measured.length,
    improved,
    regressed,
    alignedAt: new Date().toISOString(),
    corrections: fits.map((f) => ({ action: f.action, frame: f.index, ...f.applied })),
  }, null, 2));
  console.log(`  backup ${bak.dir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
