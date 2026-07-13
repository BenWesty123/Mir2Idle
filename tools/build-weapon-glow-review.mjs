#!/usr/bin/env node
/**
 * Crystal CWeaponEffect weapon glow review — each lib overlaid on a warrior + weapon.
 * Output: tile-review/weapon-glows/index.html
 *
 * Export first: npm run export:weapon-glow-sprites
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tile-review", "weapon-glows");
const glowDir = path.join(root, "public", "sprite-sets", "common", "weaponGlow");
const cataloguePath = path.join(root, "public", "sprite-sets", "common", "layers.json");
const crystalItemsPath = path.join(root, "src", "data", "crystal-items.json");
const mappingsPath = path.join(root, "tools", "weapon-glow-mappings.json");

const CHARACTER = {
  armourIndex: 1,
  hairIndex: 1,
  weaponIndex: 32,
  action: "standing",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function loadWeaponGlowMappings() {
  if (!fs.existsSync(mappingsPath)) return [];
  const data = readJson(mappingsPath);
  return Array.isArray(data?.mappings) ? data.mappings : [];
}

function loadWeaponOptions(mappings) {
  const mappedShapes = new Set(mappings.map((m) => m.weaponShape));
  const glowByShape = new Map(mappings.map((m) => [m.weaponShape, m.glow]));
  const catalogue = readJson(cataloguePath);
  const indexes = catalogue.layers?.weapon?.indexes ?? [];
  const nameByShape = new Map();
  try {
    const items = readJson(crystalItemsPath);
    const arr = Array.isArray(items) ? items : (items.items ?? Object.values(items));
    for (const it of arr) {
      if (!it || it.type !== "Weapon" || typeof it.shape !== "number") continue;
      if (!nameByShape.has(it.shape)) nameByShape.set(it.shape, []);
      const list = nameByShape.get(it.shape);
      if (list.length < 3) list.push(it.name);
    }
  } catch {
    // crystal item names are optional decoration for the dropdown
  }
  return indexes.map((index) => {
    const names = nameByShape.get(index) ?? [];
    const label = names.length ? `${index} — ${names.join(", ")}` : `shape ${index}`;
    const mappedGlow = glowByShape.get(index);
    return {
      index,
      label: mappedGlow != null ? `${label} ✓ glow ${mappedGlow}` : label,
      mapped: mappedShapes.has(index),
      mappedGlow: mappedGlow ?? null,
    };
  });
}

function spritePaths(layer, index) {
  const base = `/public/sprite-sets/common/${layer}`;
  return { json: `${base}/${index}.json`, png: `${base}/${index}.png` };
}

function loadGlowManifest() {
  if (!fs.existsSync(glowDir)) {
    return { missingExport: true, glows: [], mappedGlows: [], mappings: [] };
  }
  const mappings = loadWeaponGlowMappings();
  const mappedGlowIds = new Set(mappings.map((m) => m.glow));
  const glowById = new Map();
  const indexes = fs.readdirSync(glowDir)
    .filter((name) => /^\d+\.json$/.test(name))
    .map((name) => Number(path.basename(name, ".json")))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  for (const index of indexes) {
    const atlas = readJson(path.join(glowDir, `${index}.json`));
    const clip = atlas.actions?.[CHARACTER.action] ?? atlas.actions?.standing;
    const frames = clip?.frames ?? [];
    const nonEmpty = frames.filter((f) => !f.empty && f.w > 0).length;
    glowById.set(index, {
      index,
      crystalEffectId: index,
      png: `/public/sprite-sets/common/weaponGlow/${index}.png`,
      json: `/public/sprite-sets/common/weaponGlow/${index}.json`,
      slotWidth: atlas.slotWidth,
      slotHeight: atlas.slotHeight,
      frameCount: frames.length,
      nonEmptyFrames: nonEmpty,
      interval: clip?.interval ?? 250,
      empty: nonEmpty === 0,
    });
  }

  const glows = indexes.filter((index) => !mappedGlowIds.has(index)).map((index) => glowById.get(index));
  const mappedGlows = mappings.map((mapping) => ({
    ...mapping,
    glowMeta: glowById.get(mapping.glow) ?? null,
    weaponLabel: mapping.weaponNames?.[0] ?? `shape ${mapping.weaponShape}`,
  }));

  return {
    missingExport: false,
    glows,
    mappedGlows,
    mappings,
    mappedCount: mappings.length,
    unmappedCount: glows.length,
    character: CHARACTER,
    blendRate: 0.4,
    weaponOptions: loadWeaponOptions(mappings),
  };
}

const manifest = loadGlowManifest();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Crystal weapon glow review</title>
  <style>
    :root { color-scheme: dark; --bg:#0c0b09; --panel:#161310; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --glow:#e67e22; --weapon:#4a90d9; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px; border-bottom:1px solid var(--line); max-width:1500px; }
    h1 { margin:0 0 8px; font-size:1.35rem; color:#f4dfb0; }
    .meta { color:var(--muted); line-height:1.6; max-width:920px; }
    code { color:#d4bc86; }
    .controls { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:16px 24px; border-bottom:1px solid var(--line); position:sticky; top:0; background:rgba(12,11,9,0.95); z-index:2; }
    .controls label { display:inline-flex; align-items:center; gap:8px; color:var(--muted); }
    .controls button { background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:8px; padding:8px 14px; cursor:pointer; }
    .legend { display:flex; flex-wrap:wrap; gap:16px; padding:0 24px 16px; font-size:13px; color:var(--muted); }
    .swatch { width:14px; height:14px; border-radius:3px; display:inline-block; margin-right:6px; }
    .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); padding:24px; max-width:1500px; }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
    .card header { padding:12px 14px; border-bottom:1px solid var(--line); }
    .card h2 { margin:0; font-size:0.95rem; color:#f4dfb0; }
    .card .sub { margin-top:4px; font:12px Consolas,monospace; color:var(--muted); }
    .stage-wrap { background:#050504; padding:10px; display:flex; justify-content:center; }
    canvas.stage { display:block; image-rendering:pixelated; image-rendering:crisp-edges; border:1px solid var(--line); border-radius:8px; background:radial-gradient(circle at 50% 88%, #1a1712 0%, #050504 68%); }
    .empty { opacity:0.55; }
    .missing { color:#f88; padding:24px; }
    nav { display:flex; flex-wrap:wrap; gap:6px; padding:12px 24px; border-bottom:1px solid var(--line); max-height:120px; overflow:auto; }
    nav a { color:var(--text); text-decoration:none; padding:4px 10px; border:1px solid var(--line); border-radius:999px; font:12px Consolas,monospace; }
    nav a:hover { border-color:var(--accent); color:#f4dfb0; }
    .section-title { padding:16px 24px 0; margin:0; font-size:1rem; color:#f4dfb0; max-width:1500px; }
    .section-meta { padding:4px 24px 12px; margin:0; color:var(--muted); font-size:13px; max-width:1500px; }
    .mapped-grid { padding-top:8px; }
    .card.mapped { border-color:#3a4a2a; }
    .card.mapped header h2 { color:#b8d4a0; }
    .mapped-pill { display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; background:#2a3320; color:#b8d4a0; font:11px Consolas,monospace; }
    option.mapped-weapon { color:#9a8b74; }
  </style>
</head>
<body>
  <header>
    <h1>Crystal weapon glow review</h1>
    <p class="meta" style="color:#f5c896">
      Open with the dev server running: <code>http://localhost:4177/tile-review/weapon-glows/</code>
      (<code>npm run dev</code>). Double-clicking the HTML file will fail with “Failed to fetch”.
    </p>
    <p class="meta">
      <code>CWeaponEffect</code> overlays drawn with screen blend at 40% on the same frame as the weapon
      (<code>PlayerObject.DrawWeapon</code>). Crystal maps <code>item.effect</code> on weapons directly to
      <code>CWeaponEffect[effect]</code> when <code>WeaponEffect &gt; 0</code>. No weapons in the phase-1 item DB
      use this field yet, but ${manifest.glows.length + manifest.mappedCount} glow libraries ship in the client data.
      Mapped pairs live in <code>tools/weapon-glow-mappings.json</code> (not applied to items yet).
      Re-export: <code>npm run export:weapon-glow-sprites</code>
    </p>
    <p class="meta">
      <strong>${manifest.mappedCount}</strong> mapped · <strong>${manifest.unmappedCount}</strong> still to assign
    </p>
  </header>
  <div class="controls">
    <label>Weapon
      <select id="weaponSelect"></select>
    </label>
    <label><input type="checkbox" id="showCharacter" checked /> Character + weapon base</label>
    <label><input type="checkbox" id="showGlow" checked /> Glow overlay</label>
    <label>Glow strength <input type="range" id="blendRate" min="0" max="100" value="40" /> <span id="blendLabel">40%</span></label>
    <label>Hue <input type="range" id="hue" min="0" max="360" value="0" /> <span id="hueLabel">0°</span></label>
    <label>Saturation <input type="range" id="sat" min="0" max="300" value="100" /> <span id="satLabel">100%</span></label>
    <label><input type="checkbox" id="hideMappedWeapons" checked /> Hide mapped weapons in dropdown</label>
    <button type="button" id="resetTint">Reset tint</button>
    <button type="button" id="restart">Restart</button>
  </div>
  <div class="legend">
    <span><i class="swatch" style="background:var(--weapon)"></i>weapon base</span>
    <span><i class="swatch" style="background:var(--glow)"></i>glow (screen blend)</span>
  </div>
  <nav id="nav"></nav>
  <h2 class="section-title">Unmapped glows</h2>
  <p class="section-meta" id="unmappedMeta"></p>
  <div class="grid" id="grid"></div>
  <h2 class="section-title">Mapped</h2>
  <p class="section-meta" id="mappedMeta">Edit <code>tools/weapon-glow-mappings.json</code> then run <code>npm run review:weapon-glows</code>.</p>
  <div class="grid mapped-grid" id="mappedGrid"></div>
  <script type="application/json" id="manifest">${JSON.stringify(manifest)}</script>
  <script>
    const M = JSON.parse(document.getElementById("manifest").textContent);
    const STAGE_W = 260, STAGE_H = 210, ANCHOR_X = 130, ANCHOR_Y = 178;
    let startedAt = performance.now();

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(src));
        img.src = src;
      });
    }

    function blitFrame(ctx, sheet, atlas, action, frameIndex, anchorX, anchorY) {
      const clip = atlas.actions?.[action] ?? atlas.actions?.standing;
      const meta = clip?.frames?.[frameIndex] ?? clip?.frames?.[0];
      if (!meta || meta.empty || !meta.w) return;
      const sx = (meta.slot ?? 0) * atlas.slotWidth;
      ctx.drawImage(sheet, sx, 0, meta.w, meta.h, anchorX + meta.offsetX, anchorY + meta.offsetY, meta.w, meta.h);
    }

    function withScreenBlend(ctx, rate, filter, draw) {
      const prevOp = ctx.globalCompositeOperation;
      const prevAlpha = ctx.globalAlpha;
      const prevFilter = ctx.filter;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = rate;
      ctx.filter = filter;
      draw();
      ctx.filter = prevFilter;
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevOp;
    }

    function spritePaths(layer, index) {
      const base = "/public/sprite-sets/common/" + layer;
      return { json: base + "/" + index + ".json", png: base + "/" + index + ".png" };
    }

    async function loadLayer(layer, index) {
      const paths = spritePaths(layer, index);
      const [atlas, sheet] = await Promise.all([
        fetch(paths.json).then((r) => r.json()),
        loadImage(paths.png),
      ]);
      return { atlas, sheet };
    }

    async function loadCharacterAssets(weaponIndex) {
      const [armour, hair, weapon] = await Promise.all([
        loadLayer("armour", ${CHARACTER.armourIndex}),
        loadLayer("hair", ${CHARACTER.hairIndex}),
        loadLayer("weapon", weaponIndex),
      ]);
      return { armour, hair, weapon };
    }

    let character = null;
    let cards = [];
    let mappedCards = [];

    function tintFilter(hueDeg, satPct) {
      return (hueDeg === 0 && satPct === 100)
        ? "none"
        : "hue-rotate(" + hueDeg + "deg) saturate(" + satPct + "%)";
    }

    function populateWeaponSelect(hideMapped) {
      const weaponSelect = document.getElementById("weaponSelect");
      const previous = Number(weaponSelect.value);
      weaponSelect.innerHTML = "";
      const options = M.weaponOptions.filter((opt) => !hideMapped || !opt.mapped);
      let selected = options.some((opt) => opt.index === previous) ? previous : null;
      if (selected == null && options.length) selected = options[0].index;
      for (const opt of options) {
        const el = document.createElement("option");
        el.value = String(opt.index);
        el.textContent = opt.label;
        if (opt.mapped) el.className = "mapped-weapon";
        if (opt.index === selected) el.selected = true;
        weaponSelect.appendChild(el);
      }
      return selected ?? ${CHARACTER.weaponIndex};
    }

    async function buildGlowCard(glow, parent, nav, mappedInfo) {
      const id = "g" + glow.index;
      if (!mappedInfo) {
        const a = document.createElement("a");
        a.href = "#" + id;
        a.textContent = String(glow.index);
        if (glow.empty) a.style.opacity = "0.5";
        nav.appendChild(a);
      }

      const card = document.createElement("article");
      card.className = "card" + (glow.empty ? " empty" : "") + (mappedInfo ? " mapped" : "");
      card.id = id;
      const title = mappedInfo
        ? "Glow " + glow.index + " → " + mappedInfo.weaponLabel
        : "Glow " + glow.index;
      const sub = mappedInfo
        ? "weapon shape " + mappedInfo.weaponShape + " · CWeaponEffect[" + glow.index + "]"
        : "CWeaponEffect[" + glow.index + "] · crystal weapon effect id " + glow.crystalEffectId +
          " · " + glow.nonEmptyFrames + "/" + glow.frameCount + " standing frames";
      card.innerHTML =
        '<header><h2>' + title + (mappedInfo ? '<span class="mapped-pill">mapped</span>' : "") + '</h2>' +
        '<div class="sub">' + sub + '</div></header>' +
        '<div class="stage-wrap"><canvas class="stage" width="' + STAGE_W + '" height="' + STAGE_H + '"></canvas></div>';
      parent.appendChild(card);

      const [glowAtlas, glowSheet] = await Promise.all([
        fetch(glow.json).then((r) => r.json()),
        loadImage(glow.png).catch(() => null),
      ]);
      const entry = {
        glow,
        glowAtlas,
        glowSheet,
        mappedInfo,
        weaponShape: mappedInfo?.weaponShape ?? null,
        tint: mappedInfo?.tint ?? null,
        canvas: card.querySelector("canvas"),
        ctx: card.querySelector("canvas").getContext("2d"),
      };
      if (mappedInfo?.weaponShape != null) {
        entry.weaponAssets = await loadLayer("weapon", mappedInfo.weaponShape).catch(() => null);
      }
      return entry;
    }

    async function init() {
      const grid = document.getElementById("grid");
      const mappedGrid = document.getElementById("mappedGrid");
      const nav = document.getElementById("nav");
      if (M.missingExport) {
        grid.innerHTML = '<p class="missing">Run npm run export:weapon-glow-sprites first.</p>';
        return;
      }

      document.getElementById("unmappedMeta").textContent =
        M.unmappedCount + " glow libraries still available to match.";
      document.getElementById("mappedMeta").textContent =
        M.mappedCount + " mapped pairs in tools/weapon-glow-mappings.json (not applied to items yet).";

      const hideMappedWeapons = document.getElementById("hideMappedWeapons");
      let weaponIndex = populateWeaponSelect(hideMappedWeapons.checked);
      character = await loadCharacterAssets(weaponIndex).catch(() => null);

      const weaponSelect = document.getElementById("weaponSelect");
      weaponSelect.onchange = async () => {
        weaponIndex = Number(weaponSelect.value);
        character = await loadCharacterAssets(weaponIndex).catch(() => character);
      };
      hideMappedWeapons.onchange = async () => {
        weaponIndex = populateWeaponSelect(hideMappedWeapons.checked);
        character = await loadCharacterAssets(weaponIndex).catch(() => character);
      };

      cards = [];
      for (const glow of M.glows) {
        cards.push(await buildGlowCard(glow, grid, nav, null));
      }

      mappedCards = [];
      for (const mapping of M.mappedGlows) {
        if (!mapping.glowMeta) continue;
        mappedCards.push(await buildGlowCard(mapping.glowMeta, mappedGrid, nav, mapping));
      }

      const showCharacter = document.getElementById("showCharacter");
      const showGlow = document.getElementById("showGlow");
      const blendRate = document.getElementById("blendRate");
      const blendLabel = document.getElementById("blendLabel");
      const hue = document.getElementById("hue");
      const hueLabel = document.getElementById("hueLabel");
      const sat = document.getElementById("sat");
      const satLabel = document.getElementById("satLabel");
      document.getElementById("restart").onclick = () => { startedAt = performance.now(); };
      blendRate.oninput = () => { blendLabel.textContent = blendRate.value + "%"; };
      hue.oninput = () => { hueLabel.textContent = hue.value + "°"; };
      sat.oninput = () => { satLabel.textContent = sat.value + "%"; };
      document.getElementById("resetTint").onclick = () => {
        hue.value = "0"; sat.value = "100";
        hueLabel.textContent = "0°"; satLabel.textContent = "100%";
      };

      function drawCard(card, action, frameIndex, rate, filter, useMappedWeapon) {
        const ctx = card.ctx;
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        ctx.imageSmoothingEnabled = false;
        ctx.strokeStyle = "rgba(255,200,80,0.25)";
        ctx.beginPath(); ctx.moveTo(0, ANCHOR_Y); ctx.lineTo(STAGE_W, ANCHOR_Y); ctx.stroke();

        const weaponAssets = useMappedWeapon ? card.weaponAssets : character?.weapon;
        const armourAssets = useMappedWeapon ? null : character?.armour;
        const hairAssets = useMappedWeapon ? null : character?.hair;

        if (showCharacter.checked) {
          if (armourAssets) blitFrame(ctx, armourAssets.sheet, armourAssets.atlas, action, frameIndex, ANCHOR_X, ANCHOR_Y);
          if (hairAssets) blitFrame(ctx, hairAssets.sheet, hairAssets.atlas, action, frameIndex, ANCHOR_X, ANCHOR_Y);
          if (weaponAssets) blitFrame(ctx, weaponAssets.sheet, weaponAssets.atlas, action, frameIndex, ANCHOR_X, ANCHOR_Y);
        }

        if (showGlow.checked && card.glowSheet && !card.glow.empty) {
          const cardFilter = card.tint
            ? tintFilter(card.tint.hue ?? 0, card.tint.saturate ?? 100)
            : filter;
          withScreenBlend(ctx, rate, cardFilter, () => {
            blitFrame(ctx, card.glowSheet, card.glowAtlas, action, frameIndex, ANCHOR_X, ANCHOR_Y);
          });
        }
      }

      function frame(now) {
        const action = ${JSON.stringify(CHARACTER.action)};
        const frameIndex = Math.floor((now - startedAt) / 250) % 4;
        const rate = Number(blendRate.value) / 100;
        const hueDeg = Number(hue.value);
        const satPct = Number(sat.value);
        const filter = tintFilter(hueDeg, satPct);

        for (const card of cards) drawCard(card, action, frameIndex, rate, filter, false);
        for (const card of mappedCards) drawCard(card, action, frameIndex, rate, filter, true);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    init().catch((err) => {
      document.body.insertAdjacentHTML("beforeend", '<pre class="missing">' + err + "</pre>");
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
console.log(JSON.stringify({
  html: path.join(outDir, "index.html"),
  mapped: manifest.mappedCount ?? 0,
  unmapped: manifest.unmappedCount ?? 0,
  empty: manifest.glows?.filter((g) => g.empty).length ?? 0,
}, null, 2));
