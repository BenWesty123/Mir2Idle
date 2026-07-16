/**
 * Builds an interactive Fox Cave floor tile picker so you can click dark
 * patches and export the exact cells for replacement.
 *
 * Usage: node tools/build-fox-cave-tile-picker.mjs
 * Open:  tile-review/fox-cave-tile-picker/index.html
 *    or: http://localhost:4179/  (optional static serve — printed on run)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tile-review", "fox-cave-tile-picker");
const indexPath = path.join(root, "public", "maptiles", "index.json");
const phase1Path = path.join(root, "src", "phase1Data.js");
const regionPath = path.join(root, "tools", "tile-review", "fox-cave-fox01-corridor-region.json");

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

const mapIndex = readJson(indexPath);
const set = mapIndex.sets.find((entry) => entry.id === "fox-cave");
if (!set) throw new Error("fox-cave map set missing from public/maptiles/index.json");

const phase1 = fs.readFileSync(phase1Path, "utf8");
const patternMatch = phase1.match(/const FOX_CAVE_TILE_PATTERN = (\[[\s\S]*?\n\]);/);
if (!patternMatch) throw new Error("FOX_CAVE_TILE_PATTERN not found in phase1Data.js");
const tilePattern = Function(`"use strict"; return (${patternMatch[1]});`)();

let bounds = { x0: 36, y0: 257, width: 26, height: 14 };
if (fs.existsSync(regionPath)) {
  const region = readJson(regionPath);
  if (region.bounds) bounds = region.bounds;
}

const payload = {
  generatedAt: new Date().toISOString(),
  setId: set.id,
  // Root-relative so both file:// (via ../..) and --serve (/public/...) work after rewrite below.
  sheet: `../../public/maptiles/${set.sheet}`,
  sheetServe: `/public/maptiles/${set.sheet}`,
  slotWidth: set.slotWidth,
  slotHeight: set.slotHeight,
  tiles: set.tiles,
  bounds,
  tilePattern,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "data.json"), `${JSON.stringify(payload, null, 2)}\n`);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fox Cave Floor Tile Picker</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #121212;
      --panel: #1b1b1b;
      --line: #333;
      --text: #ececec;
      --muted: #9ca3af;
      --mark: #ef4444;
      --mark-bg: rgba(239, 68, 68, 0.28);
      --accent: #60a5fa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 13px/1.45 Segoe UI, system-ui, sans-serif;
    }
    header {
      position: sticky; top: 0; z-index: 5;
      background: #161616; border-bottom: 1px solid var(--line);
      padding: 12px 16px;
    }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .sub { margin: 0; color: var(--muted); max-width: 920px; }
    .controls {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      margin-top: 10px;
    }
    button, select {
      background: #222; color: var(--text); border: 1px solid #444;
      border-radius: 4px; padding: 6px 10px; cursor: pointer;
    }
    button.primary { border-color: var(--accent); background: #1a2740; }
    button:hover { background: #2a2a2a; }
    .stats { color: #cbd5e1; margin-left: 4px; }
    .layout {
      display: grid;
      grid-template-columns: 220px 1fr 320px;
      gap: 0;
      min-height: calc(100vh - 120px);
    }
    aside, .export {
      background: var(--panel);
      border-right: 1px solid var(--line);
      padding: 12px;
      overflow: auto;
    }
    .export { border-right: 0; border-left: 1px solid var(--line); }
    aside h2, .export h2 { margin: 0 0 8px; font-size: 13px; color: #ddd; }
    .palette {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }
    .pal-item {
      border: 1px solid #333; background: #0d0d0d; border-radius: 4px;
      padding: 6px; text-align: center; cursor: pointer;
    }
    .pal-item.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
    .pal-item canvas { width: 100%; image-rendering: pixelated; background: #080808; }
    .pal-item .meta { font-size: 11px; color: var(--muted); margin-top: 4px; }
    main { overflow: auto; padding: 16px; }
    #grid {
      display: grid;
      gap: 1px;
      background: #000;
      width: max-content;
      border: 1px solid #333;
    }
    .cell {
      position: relative;
      width: 48px; height: 32px;
      background: #111;
      cursor: pointer;
      overflow: hidden;
    }
    .cell canvas { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
    .cell.marked { outline: 2px solid var(--mark); outline-offset: -2px; background: var(--mark-bg); }
    .cell.hover-slot { outline: 2px solid var(--accent); outline-offset: -2px; }
    .cell .tag {
      position: absolute; left: 1px; top: 0;
      font-size: 9px; line-height: 1; color: #fff;
      text-shadow: 0 0 2px #000, 0 0 2px #000;
      pointer-events: none;
    }
    .cell.empty .tag { color: #888; }
    textarea {
      width: 100%; height: 280px; resize: vertical;
      background: #0d0d0d; color: #d1d5db; border: 1px solid #333;
      border-radius: 4px; padding: 8px; font: 11px/1.4 ui-monospace, Consolas, monospace;
    }
    .hint { color: var(--muted); font-size: 12px; margin: 8px 0; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      aside, .export { border: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <header>
    <h1>Fox Cave Floor Tile Picker</h1>
    <p class="sub">
      Click floor cells that look too dark (or otherwise wrong). Marked cells are listed on the right —
      copy that JSON and paste it back in chat so I can swap them.
    </p>
    <div class="controls">
      <button type="button" id="clearBtn">Clear marks</button>
      <button type="button" id="markSlotBtn">Mark all of selected slot</button>
      <button type="button" id="copyBtn" class="primary">Copy marked JSON</button>
      <button type="button" id="downloadBtn">Download JSON</button>
      <label class="stats"><input type="checkbox" id="showLabels" checked /> Show slot #</label>
      <span class="stats" id="summary"></span>
    </div>
  </header>
  <div class="layout">
    <aside>
      <h2>Tile palette</h2>
      <p class="hint">Click a slot to highlight every cell using it. Dark patches are often slot 11 (frame 3450).</p>
      <div class="palette" id="palette"></div>
    </aside>
    <main>
      <div id="grid"></div>
    </main>
    <section class="export">
      <h2>Marked cells</h2>
      <p class="hint" id="markCount">0 marked</p>
      <textarea id="out" readonly placeholder="Click tiles to mark them…"></textarea>
    </section>
  </div>
  <script>
    const state = {
      data: null,
      sheet: null,
      marked: new Set(),
      selectedSlot: null,
      showLabels: true,
    };

    const els = {
      grid: document.getElementById("grid"),
      palette: document.getElementById("palette"),
      out: document.getElementById("out"),
      summary: document.getElementById("summary"),
      markCount: document.getElementById("markCount"),
      showLabels: document.getElementById("showLabels"),
    };

    function key(r, c) { return r + "," + c; }

    function frameForSlot(slot) {
      return state.data.tiles.find((t) => t.slot === slot)?.srcFrame ?? null;
    }

    function drawSlot(canvas, slot) {
      const ctx = canvas.getContext("2d");
      const { slotWidth, slotHeight, sheet } = state.data;
      canvas.width = slotWidth;
      canvas.height = slotHeight;
      ctx.clearRect(0, 0, slotWidth, slotHeight);
      if (!state.sheet || slot == null || slot < 0) return;
      ctx.drawImage(
        state.sheet,
        slot * slotWidth, 0, slotWidth, slotHeight,
        0, 0, slotWidth, slotHeight,
      );
    }

    function exportPayload() {
      const { bounds, tilePattern } = state.data;
      const cells = [...state.marked].map((k) => {
        const [r, c] = k.split(",").map(Number);
        const slot = tilePattern[r][c];
        return {
          patternRow: r,
          patternCol: c,
          mapX: bounds.x0 + c,
          mapY: bounds.y0 + r,
          slot,
          frame: frameForSlot(slot),
        };
      }).sort((a, b) => a.patternRow - b.patternRow || a.patternCol - b.patternCol);

      const bySlot = {};
      for (const cell of cells) {
        const sk = String(cell.slot);
        bySlot[sk] = (bySlot[sk] || 0) + 1;
      }

      return {
        zone: "zone-fox-cave-1",
        mapSet: "fox-cave",
        note: "Replace these Fox Cave floor cells — clicked in tile-review/fox-cave-tile-picker",
        markedCount: cells.length,
        bySlot,
        cells,
      };
    }

    function refreshExport() {
      const payload = exportPayload();
      els.out.value = JSON.stringify(payload, null, 2);
      els.markCount.textContent = payload.markedCount + " marked";
      els.summary.textContent =
        "Pattern " + state.data.tilePattern[0].length + "×" + state.data.tilePattern.length +
        " · map (" + state.data.bounds.x0 + "," + state.data.bounds.y0 + ") → (" +
        (state.data.bounds.x0 + state.data.bounds.width - 1) + "," +
        (state.data.bounds.y0 + state.data.bounds.height - 1) + ")" +
        (state.selectedSlot == null ? "" : " · highlighting slot " + state.selectedSlot);
    }

    function renderPalette() {
      els.palette.innerHTML = "";
      for (const tile of state.data.tiles) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "pal-item" + (state.selectedSlot === tile.slot ? " active" : "");
        const canvas = document.createElement("canvas");
        drawSlot(canvas, tile.slot);
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = "slot " + tile.slot + " · #" + tile.srcFrame;
        item.append(canvas, meta);
        item.addEventListener("click", () => {
          state.selectedSlot = state.selectedSlot === tile.slot ? null : tile.slot;
          renderPalette();
          renderGrid();
          refreshExport();
        });
        els.palette.appendChild(item);
      }
    }

    function renderGrid() {
      const pattern = state.data.tilePattern;
      const rows = pattern.length;
      const cols = pattern[0].length;
      els.grid.style.gridTemplateColumns = "repeat(" + cols + ", 48px)";
      els.grid.innerHTML = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const slot = pattern[r][c];
          const cell = document.createElement("div");
          cell.className = "cell";
          if (state.marked.has(key(r, c))) cell.classList.add("marked");
          if (state.selectedSlot != null && slot === state.selectedSlot) cell.classList.add("hover-slot");
          const canvas = document.createElement("canvas");
          drawSlot(canvas, slot);
          cell.appendChild(canvas);
          if (state.showLabels) {
            const tag = document.createElement("div");
            tag.className = "tag";
            tag.textContent = String(slot);
            cell.appendChild(tag);
          }
          cell.title =
            "pattern (" + r + "," + c + ") · map (" +
            (state.data.bounds.x0 + c) + "," + (state.data.bounds.y0 + r) +
            ") · slot " + slot + " · frame " + frameForSlot(slot);
          cell.addEventListener("click", () => {
            const k = key(r, c);
            if (state.marked.has(k)) state.marked.delete(k);
            else state.marked.add(k);
            cell.classList.toggle("marked", state.marked.has(k));
            refreshExport();
          });
          els.grid.appendChild(cell);
        }
      }
    }

    document.getElementById("clearBtn").addEventListener("click", () => {
      state.marked.clear();
      renderGrid();
      refreshExport();
    });
    document.getElementById("markSlotBtn").addEventListener("click", () => {
      if (state.selectedSlot == null) {
        alert("Select a palette slot first (left side).");
        return;
      }
      const pattern = state.data.tilePattern;
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < pattern[r].length; c++) {
          if (pattern[r][c] === state.selectedSlot) state.marked.add(key(r, c));
        }
      }
      renderGrid();
      refreshExport();
    });
    document.getElementById("copyBtn").addEventListener("click", async () => {
      refreshExport();
      await navigator.clipboard.writeText(els.out.value);
      els.summary.textContent = "Copied " + state.marked.size + " marked cells to clipboard";
    });
    document.getElementById("downloadBtn").addEventListener("click", () => {
      refreshExport();
      const blob = new Blob([els.out.value], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fox-cave-tiles-to-change.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    els.showLabels.addEventListener("change", () => {
      state.showLabels = els.showLabels.checked;
      renderGrid();
    });

    fetch("data.json")
      .then((r) => r.json())
      .then((data) => {
        state.data = data;
        const img = new Image();
        img.onload = () => {
          state.sheet = img;
          renderPalette();
          renderGrid();
          refreshExport();
        };
        img.onerror = () => {
          els.summary.textContent = "Failed to load tile sheet: " + data.sheet;
        };
        // Prefer /public/... when served; fall back to relative path for file:// opens.
        img.src = location.protocol.startsWith("http")
          ? (data.sheetServe || data.sheet)
          : data.sheet;
      })
      .catch((err) => {
        els.summary.textContent = "Failed to load data.json — run: node tools/build-fox-cave-tile-picker.mjs";
        console.error(err);
      });
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), html);

const preferPort = Number(process.env.FOX_TILE_PICKER_PORT ?? 4179);
const serve = process.argv.includes("--serve");

console.log(`Wrote ${path.relative(root, outDir)}/index.html`);
console.log(`  data: ${path.relative(root, path.join(outDir, "data.json"))}`);
console.log(`  pattern: ${tilePattern[0].length}×${tilePattern.length}, ${set.tiles.length} slots`);

if (!serve) {
  console.log("Open that HTML, or re-run with --serve for http://localhost:4179/");
  process.exit(0);
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".js": "text/javascript; charset=utf-8",
};

createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";

    let resolved;
    if (rel.startsWith("/public/")) {
      resolved = path.normalize(path.join(root, rel.slice(1)));
    } else {
      resolved = path.normalize(path.join(outDir, rel));
    }

    if (!resolved.startsWith(root) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "content-type": mime[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(resolved).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
}).listen(preferPort, () => {
  console.log(`Fox Cave tile picker at http://localhost:${preferPort}/`);
});
