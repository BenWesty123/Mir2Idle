const INDEX_URL = "../../public/maptiles/index.json";
const SHEET_BASE = "../../public/maptiles/";
const DEFAULT_PATTERN = [
  [14, 12, 13, 14, 11, 14, 12, 14, 13, 11],
  [13, 14, 11, 14, 13, 12, 14, 11, 14, 13],
  [14, 11, 14, 12, 14, 13, 11, 14, 12, 14],
  [12, 14, 13, 14, 11, 14, 13, 12, 14, 11],
  [14, 13, 12, 11, 14, 12, 14, 13, 11, 14],
  [12, 13, 5, 9, 10, 6, 13, 14, 13, 13],
  [14, 5, 7, 20, 17, 8, 6, 12, 11, 13],
  [6, 7, 1, 19, 16, 3, 8, 9, 10, 6],
  [4, 4, 4, 4, 4, 4, 4, 4, 2, 4],
];

const state = {
  set: null,
  sheet: null,
  selected: 0,
  pattern: structuredClone(DEFAULT_PATTERN),
  painting: false,
  paintSlot: 0,
};

const els = {
  palette: document.getElementById("palette"),
  grid: document.getElementById("grid"),
  rowLabels: document.getElementById("rowLabels"),
  preview: document.getElementById("preview"),
  export: document.getElementById("export"),
  status: document.getElementById("status"),
  cols: document.getElementById("cols"),
  rows: document.getElementById("rows"),
  fillMode: document.getElementById("fillMode"),
  fillRepeats: document.getElementById("fillRepeats"),
};

function setStatus(text, ok = false) {
  els.status.textContent = text;
  els.status.classList.toggle("ok", ok);
}

async function loadSet() {
  const res = await fetch(INDEX_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load " + INDEX_URL);
  const index = await res.json();
  const set = index.sets?.find((entry) => entry.id === "namman");
  if (!set) throw new Error("namman set missing from maptiles/index.json");
  const sheet = new Image();
  sheet.src = SHEET_BASE + set.sheet;
  await sheet.decode();
  state.set = set;
  state.sheet = sheet;
}

function drawTile(ctx, slot, dx, dy, dw, dh) {
  const sw = state.set.slotWidth;
  const sh = state.set.slotHeight;
  ctx.drawImage(state.sheet, slot * sw, 0, sw, sh, dx, dy, dw, dh);
}

function tileCss(slot) {
  const sw = state.set.slotWidth;
  const sh = state.set.slotHeight;
  const scale = 72 / sw;
  return {
    backgroundImage: 'url("' + state.sheet.src + '")',
    backgroundSize: state.set.tiles.length * sw * scale + "px " + sh * scale + "px",
    backgroundPosition: -slot * sw * scale + "px 0",
  };
}

function renderPalette() {
  els.palette.innerHTML = "";
  for (const tile of state.set.tiles) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (tile.slot === state.selected ? " selected" : "");
    const canvas = document.createElement("canvas");
    canvas.width = state.set.slotWidth;
    canvas.height = state.set.slotHeight;
    drawTile(canvas.getContext("2d"), tile.slot, 0, 0, canvas.width, canvas.height);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = "<strong>slot " + tile.slot + "</strong><br>frame " + tile.srcFrame;
    btn.append(canvas, meta);
    btn.addEventListener("click", () => {
      state.selected = tile.slot;
      renderPalette();
    });
    els.palette.append(btn);
  }
}

function resizePattern(rows, cols) {
  const next = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(state.pattern[r]?.[c] ?? state.pattern[r]?.[0] ?? state.selected ?? 0);
    }
    next.push(row);
  }
  state.pattern = next;
}

function blankRow() {
  const cols = state.pattern[0]?.length || Number(els.cols.value) || 10;
  const fillSlot = state.selected ?? state.pattern[0]?.[0] ?? 0;
  return Array.from({ length: cols }, () => fillSlot);
}

function addRowTop() {
  if (state.pattern.length >= 24) return;
  state.pattern = [blankRow(), ...state.pattern.map((row) => row.slice())];
  renderAll();
  setStatus("Added lane at top.", true);
}

function addRowBottom() {
  if (state.pattern.length >= 24) return;
  state.pattern = [...state.pattern.map((row) => row.slice()), blankRow()];
  renderAll();
  setStatus("Added lane at bottom.", true);
}

function removeRowTop() {
  if (state.pattern.length <= 1) return;
  state.pattern = state.pattern.slice(1).map((row) => row.slice());
  renderAll();
  setStatus("Removed top lane.", true);
}

function removeRowBottom() {
  if (state.pattern.length <= 1) return;
  state.pattern = state.pattern.slice(0, -1).map((row) => row.slice());
  renderAll();
  setStatus("Removed bottom lane.", true);
}

function renderRowLabels() {
  const mode = els.fillMode.value;
  const rows = state.pattern.length;
  els.rowLabels.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    const div = document.createElement("div");
    div.className = "row-label";
    let badge = '<span class="badge">row ' + r + "</span>";
    if (mode === "lastLane" && r === rows - 1) badge += ' <span class="badge lane">walk lane</span>';
    if (mode === "lastLane" && r === 0) badge += ' <span class="badge fill">fills upward</span>';
    if (mode === "firstLane" && r === 0) badge += ' <span class="badge lane">walk lane</span>';
    if (mode === "firstLane" && r === rows - 1) badge += ' <span class="badge fill">fills upward</span>';
    div.innerHTML = badge;
    els.rowLabels.append(div);
  }
}

function paintCell(r, c, slot) {
  if (r < 0 || c < 0 || r >= state.pattern.length || c >= state.pattern[0].length) return;
  state.pattern[r][c] = slot;
}

function renderGrid() {
  const rows = state.pattern.length;
  const cols = state.pattern[0].length;
  els.cols.value = String(cols);
  els.rows.value = String(rows);
  els.grid.style.gridTemplateColumns = "repeat(" + cols + ", 72px)";
  els.grid.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      Object.assign(cell.style, tileCss(state.pattern[r][c]));
      cell.title = "row " + r + ", col " + c + " -> slot " + state.pattern[r][c];
      cell.addEventListener("mousedown", (event) => {
        if (event.button === 2) {
          state.selected = state.pattern[r][c];
          renderPalette();
          return;
        }
        if (event.button !== 0) return;
        state.painting = true;
        state.paintSlot = state.selected;
        paintCell(r, c, state.paintSlot);
        renderAll();
      });
      cell.addEventListener("mouseenter", () => {
        if (!state.painting) return;
        paintCell(r, c, state.paintSlot);
        renderAll();
      });
      els.grid.append(cell);
    }
  }
  renderRowLabels();
}

function buildPreviewRows() {
  const mode = els.fillMode.value;
  const repeats = Math.max(0, Number(els.fillRepeats.value) || 0);
  const pattern = state.pattern;
  if (mode === "none") return pattern.map((row) => row.slice());
  if (mode === "lastLane") {
    const fill = pattern[0];
    return Array.from({ length: repeats }, () => fill.slice()).concat(pattern.map((row) => row.slice()));
  }
  const fill = pattern[pattern.length - 1];
  const strip = pattern.slice().reverse();
  return Array.from({ length: repeats }, () => fill.slice()).concat(strip.map((row) => row.slice()));
}

function renderPreview() {
  const rows = buildPreviewRows();
  const cols = rows[0].length;
  const tw = state.set.slotWidth;
  const th = state.set.slotHeight;
  const canvas = els.preview;
  canvas.width = cols * tw;
  canvas.height = rows.length * th;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0b09";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(ctx, rows[r][c], c * tw, r * th, tw, th);
    }
  }
  const laneY = canvas.height - th;
  ctx.strokeStyle = "rgba(107, 158, 74, 0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1, laneY + 1, canvas.width - 2, th - 2);
  ctx.fillStyle = "rgba(107, 158, 74, 0.9)";
  ctx.font = "bold 14px Segoe UI, sans-serif";
  ctx.fillText("walk lane", 8, laneY + 18);
}

function renderExport() {
  const lines = state.pattern.map((row) => "  [" + row.join(", ") + "],");
  const frames = state.pattern.map((row) => row.map((slot) => state.set.tiles[slot]?.srcFrame ?? "?"));
  const frameLines = frames.map((row) => "  [" + row.join(", ") + "],");
  els.export.value = [
    "const NAMMAN_TILE_PATTERN = [",
    ...lines,
    "];",
    "",
    "// Crystal frames:",
    "/*",
    ...frameLines,
    "*/",
    "",
    "// fillMode preview: " + els.fillMode.value,
    "// Game expects tilePatternTopFill with last row = walk lane.",
  ].join("\n");
}

function renderAll() {
  renderGrid();
  renderPreview();
  renderExport();
}

function resetToDefault() {
  state.pattern = structuredClone(DEFAULT_PATTERN);
  renderAll();
  setStatus("Reset to current zone pattern.", true);
}

async function copyExport() {
  await navigator.clipboard.writeText(els.export.value);
  setStatus("Copied pattern JS to clipboard.", true);
}

document.getElementById("btnReset").addEventListener("click", resetToDefault);
document.getElementById("btnCopy").addEventListener("click", copyExport);
document.getElementById("btnAddTop").addEventListener("click", addRowTop);
document.getElementById("btnAddBottom").addEventListener("click", addRowBottom);
document.getElementById("btnRemoveTop").addEventListener("click", removeRowTop);
document.getElementById("btnRemoveBottom").addEventListener("click", removeRowBottom);
els.cols.addEventListener("change", () => {
  resizePattern(Number(els.rows.value) || 1, Number(els.cols.value) || 1);
  renderAll();
});
els.rows.addEventListener("change", () => {
  const want = Math.max(1, Math.min(24, Number(els.rows.value) || 1));
  const have = state.pattern.length;
  if (want > have) {
    // Growing the row count inserts new lanes at the top.
    const extras = Array.from({ length: want - have }, () => blankRow());
    state.pattern = extras.concat(state.pattern.map((row) => row.slice()));
  } else if (want < have) {
    // Shrinking removes from the top so the walk lane (bottom) stays put.
    state.pattern = state.pattern.slice(have - want).map((row) => row.slice());
  }
  resizePattern(want, Number(els.cols.value) || state.pattern[0].length);
  renderAll();
});
els.fillMode.addEventListener("change", renderAll);
els.fillRepeats.addEventListener("change", renderAll);
window.addEventListener("mouseup", () => { state.painting = false; });
window.addEventListener("contextmenu", (event) => {
  if (event.target.classList && event.target.classList.contains("cell")) event.preventDefault();
});

loadSet()
  .then(() => {
    renderPalette();
    renderAll();
    setStatus("Loaded " + state.set.tiles.length + " namman tiles.", true);
  })
  .catch((error) => {
    setStatus(String(error.message || error));
    console.error(error);
  });