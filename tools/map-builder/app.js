const CELL_W = 48;
const CELL_H = 32;

const state = {
  config: null,
  maps: [],
  mapName: "",
  map: null,
  zoom: 1,
  panX: 40,
  panY: 40,
  layers: { back: true, middle: true, front: true },
  tool: "paint",
  paintLayer: "back",
  brush: {
    backFrame: 3450,
    middleFrame: 0,
    frontFrame: 0,
    frontSlot: 13,
  },
  paletteSlot: 0,
  paletteStart: 3448,
  paletteCount: 40,
  hoverCell: null,
  dragging: false,
  panning: false,
  lastPointer: null,
  frameCache: new Map(),
  dirty: true,
  painting: false,
  renderGeneration: 0,
  renderScheduled: false,
  fastRender: false,
  region: null,
  regionDrag: null,
  regionExport: null,
  regionExcluded: new Set(),
};

function cellKey(x, y) {
  return `${x},${y}`;
}

function parseCellKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function cellInRect(x, y, rect) {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

function pruneRegionExcluded(rect) {
  if (!rect || !state.regionExcluded.size) return;
  for (const key of [...state.regionExcluded]) {
    const { x, y } = parseCellKey(key);
    if (!cellInRect(x, y, rect)) state.regionExcluded.delete(key);
  }
}

function toggleRegionCellExcluded(x, y) {
  if (!state.region) return null;
  if (!cellInRect(x, y, state.region)) return null;
  const key = cellKey(x, y);
  const excluding = !state.regionExcluded.has(key);
  if (excluding) state.regionExcluded.add(key);
  else state.regionExcluded.delete(key);
  return excluding;
}

function refreshRegionExport() {
  if (!state.region) return;
  state.regionExport = analyzeRegion(state.region, state.regionExcluded);
  updateRegionUi();
  scheduleRender();
}

const MAX_DETAIL_CELLS = 2400;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 4;

const els = {
  mapSelect: document.querySelector("#mapSelect"),
  loadMapBtn: document.querySelector("#loadMapBtn"),
  saveMapBtn: document.querySelector("#saveMapBtn"),
  zoomRange: document.querySelector("#zoomRange"),
  zoomValue: document.querySelector("#zoomValue"),
  paintLayer: document.querySelector("#paintLayer"),
  toolPaint: document.querySelector("#toolPaint"),
  toolPick: document.querySelector("#toolPick"),
  toolRegion: document.querySelector("#toolRegion"),
  paletteSlot: document.querySelector("#paletteSlot"),
  paletteStart: document.querySelector("#paletteStart"),
  paletteCount: document.querySelector("#paletteCount"),
  loadPaletteBtn: document.querySelector("#loadPaletteBtn"),
  palette: document.querySelector("#palette"),
  brushBack: document.querySelector("#brushBack"),
  brushMiddle: document.querySelector("#brushMiddle"),
  brushFront: document.querySelector("#brushFront"),
  brushFrontSlot: document.querySelector("#brushFrontSlot"),
  layerBack: document.querySelector("#layerBack"),
  layerMiddle: document.querySelector("#layerMiddle"),
  layerFront: document.querySelector("#layerFront"),
  viewport: document.querySelector("#viewport"),
  hud: document.querySelector("#hud"),
  status: document.querySelector("#status"),
  inspector: document.querySelector("#inspector"),
  regionSummary: document.querySelector("#regionSummary"),
  regionSnippets: document.querySelector("#regionSnippets"),
  copyRegionJson: document.querySelector("#copyRegionJson"),
  copyRegionSnippets: document.querySelector("#copyRegionSnippets"),
  downloadRegionJson: document.querySelector("#downloadRegionJson"),
  clearRegionBtn: document.querySelector("#clearRegionBtn"),
};

const ctx = els.viewport.getContext("2d");

const LIB_LABELS = {
  0: "Tiles",
  1: "SmTiles",
  2: "Objects",
  90: "Objects_32bit",
};

function libLabel(slot) {
  if (slot === 90) return LIB_LABELS[90];
  if (slot >= 3 && slot <= 28) return `Objects${slot - 1}`;
  return LIB_LABELS[slot] ?? `slot ${slot}`;
}

function normalizeRect(x0, y0, x1, y1) {
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  };
}

function rectWidth(rect) {
  return rect.x1 - rect.x0 + 1;
}

function rectHeight(rect) {
  return rect.y1 - rect.y0 + 1;
}

function setActiveTool(tool) {
  state.tool = tool;
  els.toolPaint.classList.toggle("primary", tool === "paint");
  els.toolPick.classList.toggle("primary", tool === "pick");
  els.toolRegion.classList.toggle("primary", tool === "region");
  els.viewport.classList.toggle("tool-region", tool === "region");
}

function analyzeRegion(rect, excluded = state.regionExcluded) {
  const backFrameSet = new Set();
  const middleFrameSet = new Set();
  const frontMap = new Map();
  const columns = [];
  const cells = [];
  const excludedCells = [];

  for (const key of excluded) {
    const { x, y } = parseCellKey(key);
    if (cellInRect(x, y, rect)) excludedCells.push({ x, y });
  }
  excludedCells.sort((a, b) => a.x - b.x || a.y - b.y);

  for (let x = rect.x0; x <= rect.x1; x++) {
    let frontCount = 0;
    const frontEntries = [];
    for (let y = rect.y0; y <= rect.y1; y++) {
      if (excluded.has(cellKey(x, y))) continue;
      const cell = cellAt(x, y);
      if (!cell) continue;
      const backFrame = visibleBackIndex(cell.back);
      const middleFrame = cell.middle > 0 ? cell.middle - 1 : -1;
      const frontFrame = (cell.front & 0x7fff) - 1;
      if (backFrame >= 0) backFrameSet.add(backFrame);
      if (middleFrame >= 0) middleFrameSet.add(middleFrame);
      if (frontFrame >= 0 && cell.frontSlot >= 0) {
        frontCount += 1;
        const key = `${cell.frontSlot}:${frontFrame}`;
        if (!frontMap.has(key)) {
          frontMap.set(key, { slot: cell.frontSlot, frame: frontFrame, label: libLabel(cell.frontSlot) });
        }
        frontEntries.push({ y, slot: cell.frontSlot, frame: frontFrame, label: libLabel(cell.frontSlot) });
      }
      cells.push({
        x,
        y,
        backFrame,
        middleFrame,
        frontFrame,
        frontSlot: cell.frontSlot,
      });
    }
    columns.push({ mapX: x, frontCount, frontEntries });
  }

  const backFrames = [...backFrameSet].sort((a, b) => a - b);
  const frameToSlot = new Map(backFrames.map((frame, slot) => [frame, slot]));
  const patternRows = [];
  for (let y = rect.y0; y <= rect.y1; y++) {
    const row = [];
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (excluded.has(cellKey(x, y))) {
        row.push(0);
        continue;
      }
      const backFrame = visibleBackIndex(state.map.back[cellIndex(x, y)]);
      row.push(backFrame >= 0 && frameToSlot.has(backFrame) ? frameToSlot.get(backFrame) : 0);
    }
    patternRows.push(row);
  }

  const emptyWallColumns = columns.filter((col) => col.frontCount === 0).map((col) => col.mapX);
  const wallColumns = columns.filter((col) => col.frontCount > 0).map((col) => col.mapX);
  const uniqueFront = [...frontMap.values()].sort((a, b) => a.slot - b.slot || a.frame - b.frame);

  const snippets = [
    `# Region from ${state.mapName}`,
    `# Cells (${rect.x0}, ${rect.y0}) → (${rect.x1}, ${rect.y1})  ${rectWidth(rect)}×${rectHeight(rect)}`,
    "",
    "# Floor tiles (Tiles.Lib) — use in build-*-tiles.ps1:",
    `[int[]]$Frames = @(${backFrames.join(", ")})`,
    "",
    "# tilePattern for phase1Data.js (slot indices into mapSet):",
    `const TILE_PATTERN = [`,
    ...patternRows.map((row) => `  [${row.join(", ")}],`),
    `];`,
    "",
    "# Wall column strip (tools/build-crystal-wall-column-strip.ps1):",
    `-FixedColumnStart ${rect.x0} \\`,
    `-FixedColumnCount ${rectWidth(rect)} \\`,
    ...(emptyWallColumns.length
      ? [`-ExcludeMapX @(${emptyWallColumns.join(", ")}) \\`, `-LaneMapY ${rect.y1} \\`]
      : [`-LaneMapY ${rect.y1} \\`]),
    `-CellsNorthOfLane 14 -CellsSouthScan 6`,
    ...(excludedCells.length
      ? [
        "",
        `# Excluded cells (Shift+click in Region tool to toggle):`,
        `-ExcludeCells @(${excludedCells.map(({ x, y }) => "'${x},${y}'").join(", ")}) \\`,
      ]
      : []),
    "",
    "# Game edge set (after building PNG):",
    `columnCount: ${wallColumns.length || rectWidth(rect)},`,
    `columnWidth: 48,`,
    `# suggested yOffsetFromBase: tune in dev`,
    "",
    "# Front / wall objects in box:",
    ...uniqueFront.map((entry) => `#   ${entry.label} frame ${entry.frame} (slot ${entry.slot})`),
  ].join("\n");

  return {
    mapName: state.mapName,
    bounds: { ...rect, width: rectWidth(rect), height: rectHeight(rect) },
    backFrames,
    middleFrames: [...middleFrameSet].sort((a, b) => a - b),
    frontObjects: uniqueFront,
    tilePattern: patternRows,
    wallColumns,
    emptyWallColumns,
    columnCount: wallColumns.length || rectWidth(rect),
    laneMapY: rect.y1,
    cells,
    excludedCells,
    snippets,
  };
}

function updateRegionUi() {
  if (!state.regionExport) {
    els.regionSummary.textContent = "No region selected";
    els.regionSnippets.textContent = "Select a region…";
    return;
  }
  const exp = state.regionExport;
  const b = exp.bounds;
  els.regionSummary.textContent = [
    `${exp.mapName}`,
    `Box (${b.x0}, ${b.y0}) → (${b.x1}, ${b.y1})`,
    `${b.width}×${b.height} cells`,
    `Back frames: ${exp.backFrames.join(", ") || "(none)"}`,
    `Front objects: ${exp.frontObjects.length}`,
    `Wall columns: ${exp.wallColumns.length} / ${b.width}`,
    exp.excludedCells?.length ? `Excluded cells: ${exp.excludedCells.length} (Shift+click to toggle)` : "",
    exp.emptyWallColumns.length ? `Skip columns (no front art): ${exp.emptyWallColumns.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  els.regionSnippets.textContent = exp.snippets;
}

function finalizeRegion(rect) {
  if (!state.map || rectWidth(rect) < 1 || rectHeight(rect) < 1) {
    state.region = null;
    state.regionExport = null;
    updateRegionUi();
    return;
  }
  state.region = rect;
  pruneRegionExcluded(rect);
  state.regionExport = analyzeRegion(rect, state.regionExcluded);
  updateRegionUi();
  const skipNote = state.regionExcluded.size ? `, ${state.regionExcluded.size} excluded` : "";
  setStatus(`Region (${rect.x0},${rect.y0})→(${rect.x1},${rect.y1}) — ${state.regionExport.backFrames.length} floor frames, ${state.regionExport.frontObjects.length} front objects${skipNote}`);
  scheduleRender();
}

function clearRegion() {
  state.region = null;
  state.regionDrag = null;
  state.regionExport = null;
  state.regionExcluded.clear();
  updateRegionUi();
  scheduleRender();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  setStatus("Copied to clipboard");
}

function downloadRegionJson() {
  if (!state.regionExport) return;
  const blob = new Blob([JSON.stringify(state.regionExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `${state.mapName.replace(/\.map$/i, "")}-region-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${anchor.download}`);
}

function drawRegionOverlay() {
  const rect = state.regionDrag ?? state.region;
  if (!rect) return;
  const x = rect.x0 * CELL_W;
  const y = rect.y0 * CELL_H;
  const w = rectWidth(rect) * CELL_W;
  const h = rectHeight(rect) * CELL_H;
  ctx.fillStyle = "rgba(126, 182, 255, 0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(126, 182, 255, 0.95)";
  ctx.lineWidth = Math.max(2 / state.zoom, 1);
  ctx.strokeRect(x + 0.5 / state.zoom, y + 0.5 / state.zoom, w, h);
  drawRegionExcludedOverlay(rect);
}

function drawRegionExcludedOverlay(rect) {
  if (!state.regionExcluded.size) return;
  ctx.fillStyle = "rgba(248, 113, 113, 0.38)";
  ctx.strokeStyle = "rgba(248, 113, 113, 0.95)";
  ctx.lineWidth = Math.max(1.5 / state.zoom, 1);
  for (const key of state.regionExcluded) {
    const { x, y } = parseCellKey(key);
    if (!cellInRect(x, y, rect)) continue;
    const px = x * CELL_W;
    const py = y * CELL_H;
    ctx.fillRect(px, py, CELL_W, CELL_H);
    ctx.strokeRect(px + 0.5 / state.zoom, py + 0.5 / state.zoom, CELL_W, CELL_H);
  }
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle("error", isError);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

function frameKey(slot, frame) {
  return `${slot}:${frame}`;
}

async function loadFrame(slot, frame) {
  const key = frameKey(slot, frame);
  if (state.frameCache.has(key)) return state.frameCache.get(key);
  try {
    const data = await fetchJson(`/api/lib/frame?slot=${slot}&frame=${frame}`);
    const canvas = document.createElement("canvas");
    canvas.width = data.width;
    canvas.height = data.height;
    const c = canvas.getContext("2d");
    const bytes = Uint8ClampedArray.from(atob(data.rgba), (ch) => ch.charCodeAt(0));
    c.putImageData(new ImageData(bytes, data.width, data.height), 0, 0);
    const entry = { canvas, width: data.width, height: data.height, offsetX: data.offsetX, offsetY: data.offsetY };
    state.frameCache.set(key, entry);
    return entry;
  } catch {
    state.frameCache.set(key, null);
    return null;
  }
}

function visibleBackIndex(rawBack) {
  if (!rawBack) return -1;
  const frame = (rawBack & 0x1fffffff) - 1;
  if (frame < 0) return -1;
  if (frame >= 1950 && frame <= 1999) return frame + 1000;
  return frame;
}

function cellIndex(x, y) {
  return x * state.map.height + y;
}

function cellAt(x, y) {
  if (!state.map || x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return null;
  const i = cellIndex(x, y);
  return {
    x,
    y,
    back: state.map.back[i],
    middle: state.map.middle[i],
    front: state.map.front[i],
    frontSlot: state.map.frontSlot[i],
  };
}

function screenToCell(clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const worldX = (sx - state.panX) / state.zoom;
  const worldY = (sy - state.panY) / state.zoom;
  return {
    x: Math.floor(worldX / CELL_W),
    y: Math.floor(worldY / CELL_H),
    sx,
    sy,
  };
}

function packBack(index) {
  return index >= 0 ? index + 1 : 0;
}

function packTile(index) {
  return index >= 0 ? index + 1 : 0;
}

function applyBrush(x, y) {
  if (!state.map) return;
  const i = cellIndex(x, y);
  if (state.paintLayer === "back") {
    const ax = x - (x % 2);
    const ay = y - (y % 2);
    const ai = cellIndex(ax, ay);
    state.map.back[ai] = packBack(state.brush.backFrame);
  } else if (state.paintLayer === "middle") {
    state.map.middle[i] = packTile(state.brush.middleFrame);
  } else {
    state.map.front[i] = packTile(state.brush.frontFrame);
    state.map.frontSlot[i] = state.brush.frontSlot;
  }
  state.dirty = true;
}

function pickFromCell(x, y) {
  const cell = cellAt(x, y);
  if (!cell) return;
  if (state.paintLayer === "back") {
    const ax = x - (x % 2);
    const ay = y - (y % 2);
    state.brush.backFrame = visibleBackIndex(state.map.back[cellIndex(ax, ay)]) ?? 0;
    els.brushBack.value = state.brush.backFrame;
  } else if (state.paintLayer === "middle") {
    state.brush.middleFrame = Math.max(0, cell.middle - 1);
    els.brushMiddle.value = state.brush.middleFrame;
  } else {
    state.brush.frontFrame = Math.max(0, (cell.front & 0x7fff) - 1);
    state.brush.frontSlot = cell.frontSlot;
    els.brushFront.value = state.brush.frontFrame;
    els.brushFrontSlot.value = state.brush.frontSlot;
  }
  setStatus(`Picked ${state.paintLayer} brush from (${x}, ${y})`);
}

function updateInspector(x, y) {
  const cell = cellAt(x, y);
  if (!cell) {
    els.inspector.textContent = "Out of bounds";
    return;
  }
  const backIdx = visibleBackIndex(cell.back);
  els.inspector.textContent = [
    `Cell (${x}, ${y})`,
    `Back raw: ${cell.back}  -> frame ${backIdx}`,
    `Middle: ${cell.middle}  -> ${Math.max(0, cell.middle - 1)}`,
    `Front: ${cell.front} slot ${cell.frontSlot} -> ${Math.max(0, (cell.front & 0x7fff) - 1)}`,
  ].join("\n");
}

function visibleCellBounds(viewW, viewH) {
  const x0 = Math.max(0, Math.floor(-state.panX / state.zoom / CELL_W) - 1);
  const y0 = Math.max(0, Math.floor(-state.panY / state.zoom / CELL_H) - 1);
  const x1 = Math.min(state.map.width - 1, Math.ceil((viewW - state.panX) / state.zoom / CELL_W) + 1);
  const y1 = Math.min(state.map.height - 1, Math.ceil((viewH - state.panY) / state.zoom / CELL_H) + 1);
  return { x0, y0, x1, y1, count: Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1) };
}

function drawCellPlaceholder(x, y, layer) {
  const px = x * CELL_W;
  const py = y * CELL_H;
  if (layer === "back") {
    ctx.fillStyle = "#2a2418";
    ctx.fillRect(px, py, CELL_W, CELL_H);
    return;
  }
  if (layer === "middle") {
    ctx.fillStyle = "rgba(80, 120, 80, 0.35)";
    ctx.fillRect(px, py, CELL_W, CELL_H);
    return;
  }
  ctx.fillStyle = "rgba(140, 90, 60, 0.45)";
  ctx.fillRect(px, py, CELL_W, 4);
}

async function drawCellLayer(x, y, layer, gen, fastMode) {
  if (gen !== state.renderGeneration) return false;
  const cell = cellAt(x, y);
  if (!cell) return true;
  const px = x * CELL_W;
  const py = y * CELL_H;

  if (layer === "back") {
    if ((x & 1) || (y & 1)) return true;
    const frame = visibleBackIndex(cell.back);
    if (frame < 0) return true;
    const cached = state.frameCache.get(frameKey(0, frame));
    if (fastMode) {
      if (cached) ctx.drawImage(cached.canvas, px, py);
      else drawCellPlaceholder(x, y, "back");
      return true;
    }
    const img = cached ?? await loadFrame(0, frame);
    if (gen !== state.renderGeneration) return false;
    if (img) ctx.drawImage(img.canvas, px, py);
    return true;
  }

  if (layer === "middle") {
    const frame = cell.middle - 1;
    if (frame < 0) return true;
    if (fastMode) {
      drawCellPlaceholder(x, y, "middle");
      return true;
    }
    const cached = state.frameCache.get(frameKey(1, frame));
    const img = cached ?? await loadFrame(1, frame);
    if (gen !== state.renderGeneration) return false;
    if (img) ctx.drawImage(img.canvas, px, py);
    return true;
  }

  const frame = (cell.front & 0x7fff) - 1;
  const slot = cell.frontSlot;
  if (frame < 0 || slot < 0) return true;
  if (fastMode) {
    drawCellPlaceholder(x, y, "front");
    return true;
  }
  const cached = state.frameCache.get(frameKey(slot, frame));
  const img = cached ?? await loadFrame(slot, frame);
  if (gen !== state.renderGeneration) return false;
  if (!img) return true;
  const drawY = py + CELL_H - img.height;
  ctx.drawImage(img.canvas, px, drawY);
  return true;
}

async function renderMap(gen) {
  if (!state.map || gen !== state.renderGeneration) return;
  const viewW = els.viewport.width;
  const viewH = els.viewport.height;
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  const bounds = visibleCellBounds(viewW, viewH);
  const fastMode = bounds.count > MAX_DETAIL_CELLS || state.zoom < 0.5;
  state.fastRender = fastMode;

  const layers = fastMode
    ? (state.layers.back ? ["back"] : [])
    : [
      ...(state.layers.back ? ["back"] : []),
      ...(state.layers.middle ? ["middle"] : []),
      ...(state.layers.front ? ["front"] : []),
    ];

  for (const layer of layers) {
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const ok = await drawCellLayer(x, y, layer, gen, fastMode);
        if (!ok) {
          ctx.restore();
          return;
        }
      }
    }
  }

  if (gen !== state.renderGeneration) {
    ctx.restore();
    return;
  }

  if (state.hoverCell && state.tool !== "region") {
    const { x, y } = state.hoverCell;
    ctx.strokeStyle = "rgba(126, 182, 255, 0.9)";
    ctx.lineWidth = Math.max(1 / state.zoom, 0.5);
    ctx.strokeRect(x * CELL_W + 0.5 / state.zoom, y * CELL_H + 0.5 / state.zoom, CELL_W, CELL_H);
  }

  drawRegionOverlay();

  ctx.restore();
  if (gen === state.renderGeneration) state.dirty = false;
}

function scheduleRender() {
  state.dirty = true;
  if (state.renderScheduled) return;
  state.renderScheduled = true;
  requestAnimationFrame(() => {
    state.renderScheduled = false;
    if (!state.dirty || !state.map) return;
    const gen = ++state.renderGeneration;
    renderMap(gen).catch((error) => setStatus(error.message, true));
  });
}

function resizeViewport() {
  const rect = els.viewport.parentElement.getBoundingClientRect();
  els.viewport.width = Math.max(320, Math.floor(rect.width));
  els.viewport.height = Math.max(240, Math.floor(rect.height));
  scheduleRender();
}

async function loadConfig() {
  state.config = await fetchJson("/api/config");
  if (!state.config.dataExists || !state.config.mapExists) {
    setStatus("Crystal paths missing — edit tools/map-builder/paths.json", true);
  }
}

async function loadMapList() {
  const data = await fetchJson("/api/maps");
  state.maps = data.maps;
  els.mapSelect.innerHTML = "";
  for (const name of state.maps) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    els.mapSelect.append(opt);
  }
}

async function loadMap(name) {
  setStatus(`Loading ${name}…`);
  state.frameCache.clear();
  const data = await fetchJson(`/api/map/${encodeURIComponent(name)}`);
  state.mapName = data.name;
  state.map = {
    width: data.width,
    height: data.height,
    xor: data.xor,
    back: Int32Array.from(data.back),
    middle: Int16Array.from(data.middle),
    front: Int16Array.from(data.front),
    frontSlot: Int8Array.from(data.frontSlot),
  };
  state.panX = 40;
  state.panY = 40;
  setStatus(`Loaded ${name} (${data.width}×${data.height})`);
  scheduleRender();
}

async function saveMap() {
  if (!state.map) return;
  setStatus("Saving…");
  const payload = {
    name: state.mapName,
    width: state.map.width,
    height: state.map.height,
    xor: state.map.xor,
    back: Array.from(state.map.back),
    middle: Array.from(state.map.middle),
    front: Array.from(state.map.front),
    frontSlot: Array.from(state.map.frontSlot),
  };
  const data = await fetchJson("/api/map/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  setStatus(`Saved ${data.fileName} → ${data.saved}`);
}

async function loadPalette() {
  state.paletteSlot = Number(els.paletteSlot.value) || 0;
  state.paletteStart = Number(els.paletteStart.value) || 0;
  state.paletteCount = Number(els.paletteCount.value) || 40;
  els.palette.innerHTML = "";
  const meta = await fetchJson(
    `/api/lib/range-meta?slot=${state.paletteSlot}&start=${state.paletteStart}&count=${state.paletteCount}`,
  );
  for (const entry of meta.frames) {
    if (!entry.visible) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-item";
    button.title = `Frame ${entry.frame}`;
    const canvas = document.createElement("canvas");
    const label = document.createElement("span");
    label.textContent = String(entry.frame);
    button.append(canvas, label);
    button.addEventListener("click", async () => {
      document.querySelectorAll(".palette-item.active").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      const img = await loadFrame(state.paletteSlot, entry.frame);
      if (!img) return;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img.canvas, 0, 0);
      if (state.paintLayer === "back" && state.paletteSlot === 0) {
        state.brush.backFrame = entry.frame;
        els.brushBack.value = entry.frame;
      } else if (state.paintLayer === "middle" && state.paletteSlot === 1) {
        state.brush.middleFrame = entry.frame;
        els.brushMiddle.value = entry.frame;
      } else if (state.paintLayer === "front") {
        state.brush.frontFrame = entry.frame;
        state.brush.frontSlot = state.paletteSlot;
        els.brushFront.value = entry.frame;
        els.brushFrontSlot.value = state.paletteSlot;
      }
    });
    els.palette.append(button);
    loadFrame(state.paletteSlot, entry.frame).then((img) => {
      if (!img) return;
      canvas.width = Math.min(img.width, 48);
      canvas.height = Math.min(img.height, 48);
      canvas.getContext("2d").drawImage(img.canvas, 0, 0, canvas.width, canvas.height);
    });
  }
}

function bindUi() {
  els.loadMapBtn.addEventListener("click", () => {
    const name = els.mapSelect.value;
    if (name) loadMap(name);
  });
  els.saveMapBtn.addEventListener("click", () => saveMap());
  els.loadPaletteBtn.addEventListener("click", () => loadPalette());
  els.paintLayer.addEventListener("change", () => {
    state.paintLayer = els.paintLayer.value;
  });
  els.toolPaint.addEventListener("click", () => setActiveTool("paint"));
  els.toolPick.addEventListener("click", () => setActiveTool("pick"));
  els.toolRegion.addEventListener("click", () => setActiveTool("region"));
  els.copyRegionJson.addEventListener("click", () => {
    if (state.regionExport) copyText(JSON.stringify(state.regionExport, null, 2)).catch((e) => setStatus(e.message, true));
  });
  els.copyRegionSnippets.addEventListener("click", () => {
    if (state.regionExport) copyText(state.regionExport.snippets).catch((e) => setStatus(e.message, true));
  });
  els.downloadRegionJson.addEventListener("click", () => downloadRegionJson());
  els.clearRegionBtn.addEventListener("click", () => clearRegion());
  for (const [key, el] of [["back", els.layerBack], ["middle", els.layerMiddle], ["front", els.layerFront]]) {
    el.addEventListener("change", () => {
      state.layers[key] = el.checked;
      scheduleRender();
    });
  }
  els.zoomRange.addEventListener("input", () => {
    state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(els.zoomRange.value) || 1));
    els.zoomRange.value = String(state.zoom);
    els.zoomValue.textContent = `${state.zoom.toFixed(2)}x`;
    scheduleRender();
  });
  for (const input of [els.brushBack, els.brushMiddle, els.brushFront, els.brushFrontSlot]) {
    input.addEventListener("change", () => {
      state.brush.backFrame = Number(els.brushBack.value) || 0;
      state.brush.middleFrame = Number(els.brushMiddle.value) || 0;
      state.brush.frontFrame = Number(els.brushFront.value) || 0;
      state.brush.frontSlot = Number(els.brushFrontSlot.value) || 13;
    });
  }

  els.viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * delta));
    if (nextZoom === state.zoom) return;
    state.zoom = nextZoom;
    els.zoomRange.value = String(state.zoom);
    els.zoomValue.textContent = `${state.zoom.toFixed(2)}x`;
    scheduleRender();
  }, { passive: false });

  els.viewport.addEventListener("pointerdown", (event) => {
    els.viewport.setPointerCapture(event.pointerId);
    state.lastPointer = { x: event.clientX, y: event.clientY };
    if (event.button === 1 || event.button === 2 || event.altKey) {
      state.panning = true;
      return;
    }
    const cell = screenToCell(event.clientX, event.clientY);
    if (state.tool === "region") {
      if (event.shiftKey && state.region) {
        const excluding = toggleRegionCellExcluded(cell.x, cell.y);
        if (excluding !== null) {
          refreshRegionExport();
          setStatus(
            excluding
              ? `Excluded (${cell.x}, ${cell.y}) — ${state.regionExcluded.size} cell(s) omitted from export`
              : `Restored (${cell.x}, ${cell.y}) — ${state.regionExcluded.size} cell(s) omitted from export`,
          );
          return;
        }
      }
      state.regionDrag = normalizeRect(cell.x, cell.y, cell.x, cell.y);
      state.region = null;
      state.regionExport = null;
      state.regionExcluded.clear();
      updateRegionUi();
      scheduleRender();
      return;
    }
    if (state.tool === "pick") {
      pickFromCell(cell.x, cell.y);
      return;
    }
    state.painting = true;
    applyBrush(cell.x, cell.y);
    scheduleRender();
  });

  els.viewport.addEventListener("pointermove", (event) => {
    const cell = screenToCell(event.clientX, event.clientY);
    state.hoverCell = { x: cell.x, y: cell.y };
    const fastHint = state.fastRender ? " · overview mode (zoom in for walls)" : "";
    const regionHint = state.tool === "region" && state.region
      ? " · Shift+click cell to exclude/include"
      : "";
    els.hud.textContent = `Cell (${cell.x}, ${cell.y}) · zoom ${state.zoom.toFixed(2)}x · pan (${Math.round(state.panX)}, ${Math.round(state.panY)})${fastHint}${regionHint}`;
    updateInspector(cell.x, cell.y);
    if (state.panning && state.lastPointer) {
      state.panX += event.clientX - state.lastPointer.x;
      state.panY += event.clientY - state.lastPointer.y;
      state.lastPointer = { x: event.clientX, y: event.clientY };
      scheduleRender();
      return;
    }
    if (state.regionDrag && state.tool === "region") {
      state.regionDrag = normalizeRect(state.regionDrag.x0, state.regionDrag.y0, cell.x, cell.y);
      scheduleRender();
      return;
    }
    if (state.painting && state.tool === "paint") {
      applyBrush(cell.x, cell.y);
      scheduleRender();
    }
  });

  els.viewport.addEventListener("pointerup", (event) => {
    if (els.viewport.hasPointerCapture(event.pointerId)) {
      els.viewport.releasePointerCapture(event.pointerId);
    }
    if (state.regionDrag && state.tool === "region") {
      const rect = state.regionDrag;
      state.regionDrag = null;
      finalizeRegion(rect);
    }
    state.painting = false;
    state.panning = false;
    state.lastPointer = null;
    scheduleRender();
  });

  els.viewport.addEventListener("pointercancel", (event) => {
    if (els.viewport.hasPointerCapture(event.pointerId)) {
      els.viewport.releasePointerCapture(event.pointerId);
    }
    state.regionDrag = null;
    state.painting = false;
    state.panning = false;
    state.lastPointer = null;
  });

  els.viewport.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("resize", resizeViewport);
}

async function boot() {
  bindUi();
  setActiveTool("paint");
  resizeViewport();
  await loadConfig();
  await loadMapList();
  const hell = state.maps.find((m) => /^hell01\.map$/i.test(m));
  if (hell) {
    els.mapSelect.value = hell;
    await loadMap(hell);
  }
  els.brushBack.value = state.brush.backFrame;
  els.paletteStart.value = state.paletteStart;
  await loadPalette();
}

boot().catch((error) => setStatus(error.message, true));
