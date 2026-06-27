#!/usr/bin/env node
/**
 * Side-by-side walk clip review: BDD Evil Tongs (40) vs Hell Slasher (215).
 * Output: tile-review/monster-walk-compare/index.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tile-review", "monster-walk-compare");

const WALK_ACTIONS = [
  "walking",
  "walkNorth",
  "walkSouth",
  "walkNorthWest",
  "walkSouthWest",
];

const MONSTERS = [
  {
    id: "bdd-evil-tongs",
    label: "Evil Tongs (BDD 1F trash)",
    index: 40,
    templateId: 288,
    zone: "zone-bdd-1",
    moveMs: 1200,
    actions: WALK_ACTIONS,
  },
  {
    id: "demon",
    label: "Demon (Hell GD floor 1)",
    index: 226,
    templateId: 424,
    zone: "zone-hell-gd-1",
    moveMs: 1500,
    actions: WALK_ACTIONS,
  },
  {
    id: "demon-warrior",
    label: "Demon Warrior (Hell GD floor 1)",
    index: 227,
    templateId: 425,
    zone: "zone-hell-gd-1",
    moveMs: 1500,
    actions: WALK_ACTIONS,
  },
  {
    id: "hell-slasher",
    label: "Hell Slasher (Hell GD floor 1)",
    index: 215,
    templateId: 426,
    zone: "zone-hell-gd-1",
    moveMs: 1800,
    actions: WALK_ACTIONS,
  },
  {
    id: "hell-pirate",
    label: "Hell Pirate (Hell GD floor 1)",
    index: 216,
    templateId: 427,
    zone: "zone-hell-gd-1",
    moveMs: 1800,
    actions: WALK_ACTIONS,
  },
  {
    id: "hell-cannibal",
    label: "Hell Cannibal (Hell GD floor 1)",
    index: 217,
    templateId: 428,
    zone: "zone-hell-gd-1",
    moveMs: 1800,
    actions: WALK_ACTIONS,
  },
  {
    id: "hell-bolt",
    label: "Hell Bolt (Hell GD floor 1)",
    index: 219,
    templateId: 429,
    zone: "zone-hell-gd-1",
    moveMs: 1000,
    actions: WALK_ACTIONS,
  },
  {
    id: "witch-doctor",
    label: "Witch Doctor (Hell GD floor 1)",
    index: 220,
    templateId: 430,
    zone: "zone-hell-gd-1",
    moveMs: 1000,
    actions: WALK_ACTIONS,
  },
];

function loadAtlas(index) {
  const jsonPath = path.join(root, "public", "monsters", "monster", `${index}.json`);
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function clipSummary(atlas, actionName) {
  const clip = atlas.actions?.[actionName];
  if (!clip?.frames?.length) return null;
  const interval = Math.trunc(Number(clip.interval) || 0);
  const count = clip.frames.length;
  return {
    action: actionName,
    frameCount: count,
    intervalMs: interval,
    cycleMs: interval * count,
    srcFrames: clip.frames.map((f) => f.srcFrame),
    frames: clip.frames.map((f, i) => ({
      i,
      slot: f.slot,
      srcFrame: f.srcFrame,
      w: f.w,
      h: f.h,
      offsetX: f.offsetX,
      offsetY: f.offsetY,
      empty: Boolean(f.empty),
    })),
  };
}

const manifest = MONSTERS.map((entry) => {
  const atlas = loadAtlas(entry.index);
  const clips = entry.actions
    .map((name) => clipSummary(atlas, name))
    .filter(Boolean);
  return {
    ...entry,
    slotWidth: atlas.slotWidth,
    slotHeight: atlas.slotHeight,
    png: `../../public/monsters/monster/${entry.index}.png`,
    clips,
    allWalkActions: Object.keys(atlas.actions || {}).filter((k) => /walk/i.test(k)),
  };
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Walk clip compare — BDD vs Hell</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header, section { padding:20px 24px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 8px; font-size:1.35rem; color:#f4dfb0; }
    h2 { margin:0 0 12px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:960px; }
    .grid { display:grid; gap:20px; grid-template-columns:repeat(auto-fit,minmax(420px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
    .card header { padding:0; border:0; margin-bottom:12px; }
    .stats { font-family:Consolas,monospace; font-size:12px; color:var(--muted); margin:8px 0; }
    .stats strong { color:var(--text); }
    .clip { margin:16px 0; padding-top:12px; border-top:1px solid var(--line); }
    .clip h3 { margin:0 0 8px; font-size:0.95rem; }
    canvas.strip { display:block; image-rendering:pixelated; image-rendering:crisp-edges; background:#050504; border:1px solid var(--line); border-radius:6px; padding:8px; max-width:100%; }
    canvas.preview { display:block; margin:8px auto; image-rendering:pixelated; image-rendering:crisp-edges; background:#050504; border:1px solid var(--line); border-radius:6px; }
    .frame-table { width:100%; border-collapse:collapse; font-size:11px; font-family:Consolas,monospace; margin-top:8px; }
    .frame-table th, .frame-table td { border:1px solid var(--line); padding:4px 6px; text-align:left; }
    .frame-table th { color:var(--muted); font-weight:600; }
    .badge { display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; background:#2e4a6b; color:#d8e8f8; margin-left:8px; }
    .note { color:var(--muted); font-size:13px; margin-top:12px; }
    code { color:#d4bc86; }
  </style>
</head>
<body>
  <header>
    <h1>Walk clip compare — BDD vs Hell Cavern</h1>
    <p class="meta">
      Exported atlases from <code>public/monsters/monster/</code>. Drawn with the same slot blit as in-game swarm combat.
      Crystal directions: <code>walking</code> = west (6), plus <code>walkNorth</code>, <code>walkSouth</code>,
      <code>walkNorthWest</code>, <code>walkSouthWest</code> from lib frame tables.
      Rebuild: <code>powershell -File tools/append-hell-cavern-swarm-directions.ps1</code>
    </p>
  </header>
  <section>
    <div class="grid" id="cards"></div>
  </section>
  <script type="application/json" id="manifest">${JSON.stringify(manifest)}</script>
  <script>
    const manifest = JSON.parse(document.getElementById("manifest").textContent);

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    function drawFrame(ctx, sheet, slotWidth, slotHeight, meta, x, y, scale) {
      ctx.drawImage(
        sheet,
        meta.slot * slotWidth,
        0,
        slotWidth,
        slotHeight,
        x + meta.offsetX * scale,
        y + meta.offsetY * scale,
        slotWidth * scale,
        slotHeight * scale,
      );
    }

    function renderStrip(canvas, sheet, atlas, clip, scale) {
      const pad = 8;
      const footY = 200;
      let minX = Infinity;
      let maxX = -Infinity;
      const layouts = clip.frames.map((meta, i) => {
        const x = pad + i * (atlas.slotWidth * scale + pad);
        minX = Math.min(minX, x + meta.offsetX * scale);
        maxX = Math.max(maxX, x + meta.offsetX * scale + meta.w * scale);
        return { meta, drawX: x, drawY: footY };
      });
      canvas.width = Math.max(320, maxX - Math.min(0, minX) + pad * 2);
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,200,80,0.35)";
      ctx.fillRect(0, footY, canvas.width, 2);
      for (const { meta, drawX, drawY } of layouts) {
        drawFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, drawX, drawY, scale);
        ctx.fillStyle = "#9a8b74";
        ctx.font = "11px Consolas, monospace";
        ctx.fillText(String(meta.i), drawX + 2, footY + 14);
      }
    }

    function startPreview(canvas, sheet, atlas, clip) {
      const scale = 1;
      const footY = 180;
      canvas.width = 280;
      canvas.height = 220;
      const ctx = canvas.getContext("2d");
      let frame = 0;
      let last = performance.now();
      function tick(now) {
        const dt = now - last;
        if (dt >= clip.intervalMs) {
          frame = (frame + 1) % clip.frameCount;
          last = now;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255,200,80,0.35)";
        ctx.fillRect(0, footY, canvas.width, 2);
        const meta = clip.frames[frame];
        const drawX = Math.floor(canvas.width / 2 - atlas.slotWidth / 2);
        drawFrame(ctx, sheet, atlas.slotWidth, atlas.slotHeight, meta, drawX, footY, scale);
        ctx.fillStyle = "#9a8b74";
        ctx.font = "12px Consolas, monospace";
        ctx.fillText("frame " + frame + " / " + (clip.frameCount - 1) + "  (" + clip.intervalMs + "ms)", 8, 16);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function frameTable(clip) {
      const rows = clip.frames.map((f) =>
        "<tr><td>" + f.i + "</td><td>" + f.slot + "</td><td>" + f.srcFrame + "</td><td>" +
        f.w + "×" + f.h + "</td><td>" + f.offsetX + ", " + f.offsetY + "</td></tr>"
      ).join("");
      return '<table class="frame-table"><thead><tr><th>#</th><th>slot</th><th>srcFrame</th><th>size</th><th>offset</th></tr></thead><tbody>' + rows + "</tbody></table>";
    }

    async function init() {
      const root = document.getElementById("cards");
      for (const entry of manifest) {
        const sheet = await loadImage(entry.png);
        const card = document.createElement("article");
        card.className = "card";
        const walkList = entry.allWalkActions.join(", ") || "(none)";
        const primary = entry.clips[0];
        card.innerHTML =
          "<header><strong>" + entry.label + "</strong><span class=\\"badge\\">monster " + entry.index + "</span></header>" +
          '<div class="stats">template <strong>' + entry.templateId + "</strong> · zone <strong>" + entry.zone + "</strong> · moveMs <strong>" + entry.moveMs + "</strong></div>" +
          '<div class="stats">slot <strong>' + entry.slotWidth + "×" + entry.slotHeight + "</strong> · walk actions: <strong>" + walkList + "</strong></div>" +
          '<p class="note">Primary swarm clip: <code>' + (primary?.action || "?") + "</code> — " +
          (primary ? primary.frameCount + " frames × " + primary.intervalMs + "ms = " + primary.cycleMs + "ms/cycle" : "") + "</p>" +
          '<div id="clips-' + entry.id + '"></div>';
        root.appendChild(card);
        const clipsRoot = card.querySelector("#clips-" + entry.id);
        for (const clip of entry.clips) {
          const block = document.createElement("div");
          block.className = "clip";
          block.innerHTML = "<h3>" + clip.action + " — " + clip.frameCount + " frames @ " + clip.intervalMs + "ms</h3>";
          const strip = document.createElement("canvas");
          strip.className = "strip";
          block.appendChild(strip);
          const preview = document.createElement("canvas");
          preview.className = "preview";
          block.appendChild(preview);
          block.insertAdjacentHTML("beforeend", frameTable(clip));
          clipsRoot.appendChild(block);
          renderStrip(strip, sheet, entry, clip, 0.85);
          if (/^walk/i.test(clip.action)) startPreview(preview, sheet, entry, clip);
        }
      }
    }

    init().catch((err) => {
      document.body.insertAdjacentHTML("beforeend", '<pre style="color:#f88;padding:24px">' + err + "</pre>");
    });
  </script>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(JSON.stringify({ html: path.join(outDir, "index.html"), monsters: manifest.map((m) => m.index) }, null, 2));
