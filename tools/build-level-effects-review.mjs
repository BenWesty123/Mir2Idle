#!/usr/bin/env node
/**
 * Crystal LevelEffects aura demo — animated preview on a warrior standing sprite.
 * Output: tile-review/level-effects/index.html
 *
 * Export assets first: npm run export:level-effects
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tile-review", "level-effects");
const effectsRoot = path.join(root, "public", "level-effects");
function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

const defs = readJson(path.join(root, "tools", "level-effect-defs.json"));

const CHARACTER = {
  armour: { set: "common", layer: "armour", index: 1, action: "standing" },
  hair: { set: "common", layer: "hair", index: 1, action: "standing" },
};

function spritePaths(layer, index) {
  const base = `/public/sprite-sets/${CHARACTER.armour.set}/${layer}`;
  return {
    json: `${base}/${index}.json`,
    png: `${base}/${index}.png`,
  };
}

function loadEffectManifest() {
  const effects = [];
  for (const def of defs.effects) {
    const dir = path.join(effectsRoot, def.id);
    const atlasPath = path.join(dir, "atlas.json");
    if (!fs.existsSync(atlasPath)) {
      effects.push({ ...def, missing: true });
      continue;
    }
    const atlas = readJson(atlasPath);
    effects.push({
      id: def.id,
      label: def.label,
      crystalFlag: def.crystalFlag,
      atlasRel: `/public/level-effects/${def.id}/atlas.json`,
      atlas,
      layerCount: atlas.layers?.length ?? 0,
      frameCount: (atlas.layers ?? []).reduce((sum, layer) => sum + (layer.frames?.length ?? 0), 0),
    });
  }
  return { staggerDelayMs: defs.staggerDelayMs, effects, character: CHARACTER, spritePaths: spritePaths() };
}

const manifest = loadEffectManifest();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Crystal LevelEffects aura demo</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0c0b09;
      --panel: #161310;
      --text: #e8dcc8;
      --muted: #9a8b74;
      --accent: #c9a24d;
      --line: #2a241c;
      --behind: #4a90d9;
      --front: #e67e22;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--text); }
    header { padding: 20px 24px; border-bottom: 1px solid var(--line); max-width: 1400px; }
    h1 { margin: 0 0 8px; font-size: 1.35rem; color: #f4dfb0; }
    .meta { color: var(--muted); line-height: 1.6; max-width: 900px; }
    code { color: #d4bc86; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(12, 11, 9, 0.95); z-index: 2; backdrop-filter: blur(6px); }
    .controls label { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); }
    .controls button { background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; cursor: pointer; }
    .controls button:hover { border-color: var(--accent); color: #f4dfb0; }
    .legend { display: flex; flex-wrap: wrap; gap: 16px; padding: 0 24px 16px; font-size: 13px; color: var(--muted); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .swatch { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); padding: 24px; max-width: 1400px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .card header { padding: 14px 16px; border-bottom: 1px solid var(--line); }
    .card h2 { margin: 0; font-size: 1rem; color: #f4dfb0; }
    .card .sub { margin-top: 4px; font: 12px Consolas, monospace; color: var(--muted); }
    .stage-wrap { background: #050504; padding: 12px; display: flex; justify-content: center; }
    canvas.stage { display: block; image-rendering: pixelated; image-rendering: crisp-edges; border: 1px solid var(--line); border-radius: 8px; background: radial-gradient(circle at 50% 88%, #1a1712 0%, #050504 68%); }
    .missing { color: #f88; padding: 24px; }
    .solo { padding: 24px; max-width: 1400px; }
    .solo .stage-wrap canvas { max-width: 100%; }
  </style>
</head>
<body>
  <header>
    <h1>Crystal LevelEffects aura demo</h1>
    <p class="meta" style="color:#f5c896">
      Open with the dev server: <code>http://localhost:4177/tile-review/level-effects/</code>
      (<code>npm run dev</code>). Opening the file directly causes “Failed to fetch”.
    </p>
    <p class="meta">
      Prestige/account auras from Crystal <code>PlayerObject.SetEffects()</code> — not armour effects.
      Each card loops the exported sprite strips with screen blend, draw order, and stagger delays
      matching Crystal. Re-export: <code>npm run export:level-effects</code>
    </p>
  </header>
  <div class="controls">
    <label><input type="checkbox" id="showCharacter" checked /> Show warrior reference sprite</label>
    <label><input type="checkbox" id="showAll" checked /> Show all auras at once</label>
    <button type="button" id="restart">Restart animations</button>
  </div>
  <div class="legend">
    <span><i class="swatch" style="background: var(--behind)"></i> behind-character layer</span>
    <span><i class="swatch" style="background: var(--front)"></i> in-front layer</span>
    <span>Foot anchor matches in-game combat draw point</span>
  </div>
  <div class="grid" id="grid"></div>
  <script type="application/json" id="manifest">${JSON.stringify(manifest)}</script>
  <script>
    const M = JSON.parse(document.getElementById("manifest").textContent);
    const STAGE_W = 280;
    const STAGE_H = 220;
    const ANCHOR_X = 140;
    const ANCHOR_Y = 188;
    let startedAt = performance.now();
    let raf = 0;

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load " + src));
        img.src = src;
      });
    }

    function loopFrameIndex(layer, now) {
      const interval = Math.max(1, Number(layer.interval) || 200);
      const count = Math.max(1, layer.frames?.length ?? 1);
      const t = now - startedAt - (layer.delayMs ?? 0);
      if (t < 0) return -1;
      return Math.floor(t / interval) % count;
    }

    function blitMeta(ctx, sheet, layer, frameIndex, anchorX, anchorY) {
      const meta = layer.frames?.[frameIndex] ?? layer.frames?.[0];
      if (!meta || meta.empty || !meta.w) return;
      const sx = (meta.slot ?? 0) * layer.slotWidth;
      ctx.drawImage(
        sheet,
        sx, 0, meta.w, meta.h,
        anchorX + meta.offsetX,
        anchorY + meta.offsetY,
        meta.w,
        meta.h
      );
    }

    function withScreenBlend(ctx, draw) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "screen";
      draw();
      ctx.globalCompositeOperation = prev;
    }

    function drawCharacter(ctx, charState, frameIndex) {
      const drawLayer = (atlas, sheet, action) => {
        const clip = atlas.actions?.[action] ?? atlas.actions?.standing;
        const meta = clip?.frames?.[frameIndex] ?? clip?.frames?.[0];
        if (!meta || meta.empty) return;
        const sx = (meta.slot ?? 0) * atlas.slotWidth;
        ctx.drawImage(
          sheet,
          sx, 0, meta.w, meta.h,
          ANCHOR_X + meta.offsetX,
          ANCHOR_Y + meta.offsetY,
          meta.w,
          meta.h
        );
      };
      drawLayer(charState.armour.atlas, charState.armour.sheet, charState.armour.action);
      drawLayer(charState.hair.atlas, charState.hair.sheet, charState.hair.action);
    }

    function drawAura(ctx, effect, assets, now, showCharacter) {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      ctx.strokeStyle = "rgba(255, 200, 80, 0.25)";
      ctx.beginPath();
      ctx.moveTo(0, ANCHOR_Y);
      ctx.lineTo(STAGE_W, ANCHOR_Y);
      ctx.stroke();

      const layers = effect.atlas.layers ?? [];
      const behind = layers.filter((layer) => layer.drawBehind);
      const front = layers.filter((layer) => !layer.drawBehind);

      for (const layer of behind) {
        const sheet = assets.sheets.get(layer.sheet);
        const frameIndex = loopFrameIndex(layer, now);
        if (frameIndex < 0 || !sheet) continue;
        const draw = () => blitMeta(ctx, sheet, layer, frameIndex, ANCHOR_X, ANCHOR_Y);
        if (layer.blend !== false) withScreenBlend(ctx, draw);
        else draw();
      }

      if (showCharacter && assets.character) {
        const standFrame = Math.floor((now - startedAt) / 250) % (assets.character.armour.atlas.actions.standing.frames.length || 1);
        drawCharacter(ctx, assets.character, standFrame);
      }

      for (const layer of front) {
        const sheet = assets.sheets.get(layer.sheet);
        const frameIndex = loopFrameIndex(layer, now);
        if (frameIndex < 0 || !sheet) continue;
        const draw = () => blitMeta(ctx, sheet, layer, frameIndex, ANCHOR_X, ANCHOR_Y);
        if (layer.blend !== false) withScreenBlend(ctx, draw);
        else draw();
      }
    }

    async function loadCharacter() {
      const armourPaths = ${JSON.stringify(spritePaths("armour", CHARACTER.armour.index))};
      const hairPaths = ${JSON.stringify(spritePaths("hair", CHARACTER.hair.index))};
      const [armourAtlas, hairAtlas, armourSheet, hairSheet] = await Promise.all([
        fetch(armourPaths.json).then((r) => r.json()),
        fetch(hairPaths.json).then((r) => r.json()),
        loadImage(armourPaths.png),
        loadImage(hairPaths.png),
      ]);
      return {
        armour: { atlas: armourAtlas, sheet: armourSheet, action: ${JSON.stringify(CHARACTER.armour.action)} },
        hair: { atlas: hairAtlas, sheet: hairSheet, action: ${JSON.stringify(CHARACTER.hair.action)} },
      };
    }

    async function loadEffectAssets(effect) {
      if (effect.missing) return null;
      const base = effect.atlasRel.replace(/\\/atlas.json$/, "");
      const sheets = new Map();
      await Promise.all((effect.atlas.layers ?? []).map(async (layer) => {
        sheets.set(layer.sheet, await loadImage(base + "/" + layer.sheet));
      }));
      return { sheets };
    }

    async function init() {
      const grid = document.getElementById("grid");
      const showCharacter = document.getElementById("showCharacter");
      const showAll = document.getElementById("showAll");
      const restart = document.getElementById("restart");
      const character = await loadCharacter().catch(() => null);

      const cards = [];
      for (const effect of M.effects) {
        if (effect.missing) {
          const card = document.createElement("article");
          card.className = "card";
          card.innerHTML = '<header><h2>' + effect.label + '</h2><p class="missing">Missing export — run npm run export:level-effects</p></header>';
          grid.appendChild(card);
          continue;
        }

        const assets = await loadEffectAssets(effect);
        const card = document.createElement("article");
        card.className = "card";
        card.innerHTML =
          '<header><h2>' + effect.label + '</h2>' +
          '<div class="sub">flag ' + effect.crystalFlag + ' · ' + effect.layerCount + ' layer(s) · ' + effect.frameCount + ' frames</div></header>' +
          '<div class="stage-wrap"><canvas class="stage" width="' + STAGE_W + '" height="' + STAGE_H + '"></canvas></div>';
        grid.appendChild(card);
        const canvas = card.querySelector("canvas");
        cards.push({ effect, assets: { ...assets, character }, canvas, ctx: canvas.getContext("2d") });
      }

      function frame(now) {
        for (const card of cards) {
          if (!showAll.checked && card !== cards[0]) {
            card.canvas.parentElement.parentElement.style.display = "none";
          } else {
            card.canvas.parentElement.parentElement.style.display = "";
          }
          card.ctx.imageSmoothingEnabled = false;
          drawAura(card.ctx, card.effect, card.assets, now, showCharacter.checked);
        }
        raf = requestAnimationFrame(frame);
      }

      showCharacter.addEventListener("change", () => {});
      showAll.addEventListener("change", () => {
        for (const card of cards) card.canvas.parentElement.parentElement.style.display = "";
      });
      restart.addEventListener("click", () => { startedAt = performance.now(); });

      raf = requestAnimationFrame(frame);
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
  effects: manifest.effects.length,
  missing: manifest.effects.filter((e) => e.missing).length,
}, null, 2));
