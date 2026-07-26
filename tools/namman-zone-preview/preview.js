const INDEX_URL = "../../public/maptiles/index.json";
const OBJECTS_INDEX_URL = "../../public/mapobjects/index.json";
const SHEET_BASE = "../../public/maptiles/";
const OBJECTS_BASE = "../../public/mapobjects/";

// Mirrors src/phase1Data.js NAMMAN_FIELD_VISUALS + NAMMAN_TILE_PATTERN
const ZONE = {
  groundTopRows: 8,
  groundBottomRows: 1,
  tileAnchor2x2: true,
  tilePatternTopFill: true,
  decorationRows: [-4.2, -3.4, -3.0, -2.6, -2.1, -1.6, -1.2, -0.8, 0.45, 0.75, 1.05, 1.35],
  decorations: [
    { id: "nm-catalog-56", slots: [0], worldX: 220, repeatEvery: 4800 },
    { id: "nm-catalog-46", slots: [1], worldX: 1000, repeatEvery: 4800 },
    { id: "nm-catalog-80", slots: [2], worldX: 1780, repeatEvery: 4800 },
    { id: "nm-catalog-86", slots: [3], worldX: 2560, repeatEvery: 4800 },
    { id: "nm-catalog-155", slots: [4], worldX: 3340, repeatEvery: 4800 },
    { id: "nm-catalog-296", slots: [5], worldX: 4120, repeatEvery: 4800 },
  ],
};

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

// Constants copied from app.monolith.js
const LANE_Y = 0.78;
const MAP_LANE_ROW_STEP = 28;
const MAP_TILE_ANCHOR_ROW_STEP = 32;
const MAP_TILE_LANE_ANCHOR_ROW = 4;

const state = {
  set: null,
  sheet: null,
  decorSet: null,
  decorSheet: null,
  pattern: structuredClone(DEFAULT_PATTERN),
};

const els = {
  stage: document.getElementById("stage"),
  stageW: document.getElementById("stageW"),
  stageH: document.getElementById("stageH"),
  cameraX: document.getElementById("cameraX"),
  cameraXVal: document.getElementById("cameraXVal"),
  showDecor: document.getElementById("showDecor"),
  showOverlay: document.getElementById("showOverlay"),
  showPlayer: document.getElementById("showPlayer"),
  status: document.getElementById("status"),
  patternText: document.getElementById("patternText"),
  diag: document.getElementById("diag"),
};

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function setStatus(text, ok) {
  els.status.textContent = text;
  els.status.classList.toggle("ok", !!ok);
}

function patternRowForAnchor(anchorMapRow) {
  const pattern = state.pattern;
  const last = pattern.length - 1;
  if (!ZONE.tilePatternTopFill) {
    return positiveModulo(Math.trunc(anchorMapRow / 2), pattern.length);
  }
  const stepsAboveLane = Math.floor((MAP_TILE_LANE_ANCHOR_ROW - anchorMapRow) / 2);
  if (stepsAboveLane < 0) return -1; // below lane: hashed sand (see slotFor)
  return stepsAboveLane === 0 ? last : Math.max(0, last - stepsAboveLane);
}

function slotFor(anchorMapRow, worldColumn) {
  if (ZONE.tilePatternTopFill) {
    const stepsAboveLane = Math.floor((MAP_TILE_LANE_ANCHOR_ROW - anchorMapRow) / 2);
    if (stepsAboveLane < 0) {
      const sandSlots = [2, 3, 4];
      const seed = worldColumn * 2654435761 + anchorMapRow * 40503;
      return sandSlots[positiveModulo(seed, sandSlots.length)];
    }
  }
  const rowPattern = state.pattern[patternRowForAnchor(anchorMapRow)];
  return positiveModulo(rowPattern[positiveModulo(worldColumn, rowPattern.length)], state.set.tiles.length);
}

function drawMapTile(ctx, slot, x, y) {
  const tile = state.set.tiles[positiveModulo(slot, state.set.tiles.length)];
  if (!tile) return;
  const sw = state.set.slotWidth;
  const sh = state.set.slotHeight;
  const sourceW = Number(tile.w) || sw;
  const sourceH = Number(tile.h) || sh;
  const destX = x + (Number(tile.offsetX) || 0);
  const destY = y + (Number(tile.offsetY) || 0);
  ctx.drawImage(state.sheet, tile.slot * sw, 0, sourceW, sourceH, destX, destY, sourceW, sourceH);
}

function drawBackdrop(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#5a7a9a");
  g.addColorStop(0.45, "#8aa3b0");
  g.addColorStop(1, "#2a2418");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function hashSeed(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function drawDecorations(ctx, scrollCameraX, baseY, stageW) {
  if (!state.decorSet || !state.decorSheet) return;
  const rows = ZONE.decorationRows;
  for (const deco of ZONE.decorations) {
    const period = Math.max(1, deco.repeatEvery || 4800);
    const slot = deco.slots[0];
    const meta = state.decorSet.objects?.[slot] || state.decorSet.tiles?.[slot];
    const dw = Number(meta?.w) || state.decorSet.slotWidth;
    const dh = Number(meta?.h) || state.decorSet.slotHeight;
    const start = Math.floor((scrollCameraX - stageW) / period) - 1;
    const end = Math.ceil((scrollCameraX + stageW * 2) / period) + 1;
    for (let i = start; i <= end; i++) {
      const worldX = (deco.worldX || 0) + i * period;
      const seed = hashSeed(deco.id + ":" + i);
      const row = rows[seed % rows.length];
      const x = worldX - scrollCameraX;
      const y = baseY + row * MAP_LANE_ROW_STEP - dh + 20;
      if (x > stageW + dw || x < -dw) continue;
      ctx.drawImage(
        state.decorSheet,
        slot * state.decorSet.slotWidth,
        0,
        dw,
        dh,
        Math.round(x),
        Math.round(y),
        dw,
        dh
      );
    }
  }
}

function render() {
  if (!state.set || !state.sheet) return;
  const stageW = Math.max(320, Number(els.stageW.value) || 780);
  const stageH = Math.max(240, Number(els.stageH.value) || 500);
  const cameraX = Number(els.cameraX.value) || 0;
  els.cameraXVal.textContent = String(cameraX);
  const canvas = els.stage;
  canvas.width = stageW;
  canvas.height = stageH;
  const ctx = canvas.getContext("2d");

  drawBackdrop(ctx, stageW, stageH);

  const groundTop = ZONE.groundTopRows;
  const groundBottom = ZONE.groundBottomRows;
  const firstGroundRow = -groundTop;
  const rows = 5 + groundBottom;
  const cols = Math.ceil(stageW / state.set.slotWidth) + 10;
  const baseY = Math.floor(stageH * LANE_Y) - 34;
  const scrollCameraX = cameraX;
  const scroll = Math.floor(positiveModulo(scrollCameraX, state.set.slotWidth));
  const tileColumn = Math.floor(scrollCameraX / state.set.slotWidth);

  const lastLaneRow = rows - 1;
  const firstAnchorRow = Math.floor((firstGroundRow * MAP_LANE_ROW_STEP) / MAP_TILE_ANCHOR_ROW_STEP);
  const lastAnchorRowFromLane = Math.ceil((lastLaneRow * MAP_LANE_ROW_STEP) / MAP_TILE_ANCHOR_ROW_STEP) + 1;
  const sampleTile = state.set.tiles[0];
  const tileDrawBottom = (Number(sampleTile?.offsetY) || 0) + (Number(sampleTile?.h) || state.set.slotHeight) - 58;
  const minAnchorForStage = Math.ceil((stageH - baseY - tileDrawBottom) / MAP_TILE_ANCHOR_ROW_STEP);
  const lastAnchorRow = Math.max(lastAnchorRowFromLane, minAnchorForStage + 1);
  let firstDrawAnchorRow = firstAnchorRow % 2 === 0 ? firstAnchorRow : firstAnchorRow + 1;
  if (ZONE.tilePatternTopFill) {
    const stripTopAnchor = MAP_TILE_LANE_ANCHOR_ROW - (Math.max(1, state.pattern.length) - 1) * 2;
    const evenStripTop = stripTopAnchor % 2 === 0 ? stripTopAnchor : stripTopAnchor - 1;
    firstDrawAnchorRow = Math.min(firstDrawAnchorRow, evenStripTop);
  }

  const diag = [];
  for (let anchorRow = firstDrawAnchorRow; anchorRow < lastAnchorRow; anchorRow += 2) {
    const patternRow = patternRowForAnchor(anchorRow);
    diag.push("anchor " + anchorRow + " -> pattern[" + patternRow + "]" + (anchorRow === MAP_TILE_LANE_ANCHOR_ROW ? "  << walk lane tile" : "") + (anchorRow > MAP_TILE_LANE_ANCHOR_ROW ? "  (below lane, mixed sand)" : ""));
    for (let col = -5; col < cols; col++) {
      const worldColumn = col + tileColumn;
      const slot = slotFor(anchorRow, worldColumn);
      const x = col * state.set.slotWidth - scroll - 24;
      const y = baseY + anchorRow * MAP_TILE_ANCHOR_ROW_STEP - 58;
      drawMapTile(ctx, slot, x, y);
    }
    if (els.showOverlay.checked) {
      const y = baseY + anchorRow * MAP_TILE_ANCHOR_ROW_STEP - 58 + (Number(sampleTile?.offsetY) || 0) + 12;
      ctx.fillStyle = "rgba(80, 220, 255, 0.9)";
      ctx.font = "bold 12px Segoe UI, sans-serif";
      ctx.fillText("p" + patternRow + " @R" + anchorRow, 8, y);
    }
  }

  if (els.showDecor.checked) drawDecorations(ctx, scrollCameraX, baseY, stageW);

  const laneY = Math.floor(stageH * LANE_Y);
  if (els.showOverlay.checked) {
    ctx.strokeStyle = "rgba(107, 158, 74, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, laneY);
    ctx.lineTo(stageW, laneY);
    ctx.stroke();
    ctx.fillStyle = "rgba(107, 158, 74, 0.95)";
    ctx.font = "bold 13px Segoe UI, sans-serif";
    ctx.fillText("LANE.y (player feet)", 8, laneY - 6);
  }

  if (els.showPlayer.checked) {
    const px = stageW * 0.34;
    ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
    ctx.beginPath();
    ctx.arc(px, laneY - 18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("player", px + 14, laneY - 14);
  }

  els.diag.textContent = [
    "firstDrawAnchorRow=" + firstDrawAnchorRow + " lastAnchorRow=" + lastAnchorRow,
    "baseY=" + baseY + " laneY=" + laneY + " MAP_TILE_LANE_ANCHOR_ROW=" + MAP_TILE_LANE_ANCHOR_ROW,
    "",
    ...diag,
  ].join("\n");

  setStatus(
    "Rendered " + state.pattern.length + " pattern rows via game top-fill mapping. Scroll camera to check the horizontal loop.",
    true
  );
}

function formatPattern(pattern) {
  return (
    "const NAMMAN_TILE_PATTERN = [\n" +
    pattern.map((row) => "  [" + row.join(", ") + "],").join("\n") +
    "\n];"
  );
}

function parsePattern(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No array found in pattern text");
  const parsed = Function("return (" + match[0] + ")")();
  if (!Array.isArray(parsed) || !parsed.length || !Array.isArray(parsed[0])) {
    throw new Error("Pattern must be a 2D array");
  }
  return parsed.map((row) => row.map((n) => Number(n) | 0));
}

async function loadAssets() {
  const tileIndex = await fetch(INDEX_URL, { cache: "no-store" }).then((r) => r.json());
  const set = tileIndex.sets.find((entry) => entry.id === "namman");
  if (!set) throw new Error("namman maptiles set missing");
  const sheet = new Image();
  sheet.src = SHEET_BASE + set.sheet;
  await sheet.decode();
  state.set = set;
  state.sheet = sheet;

  try {
    const objIndex = await fetch(OBJECTS_INDEX_URL, { cache: "no-store" }).then((r) => r.json());
    const decorSet = objIndex.sets.find((entry) => entry.id === "namman-catalog");
    if (decorSet) {
      const decorSheet = new Image();
      decorSheet.src = OBJECTS_BASE + decorSet.sheet;
      await decorSheet.decode();
      state.decorSet = decorSet;
      state.decorSheet = decorSheet;
    }
  } catch (error) {
    console.warn("Decorations unavailable", error);
  }
}

els.patternText.value = formatPattern(state.pattern);

document.getElementById("btnReload").addEventListener("click", () => {
  loadAssets().then(render).catch((error) => setStatus(String(error.message || error)));
});
document.getElementById("btnCopyDiag").addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.diag.textContent);
  setStatus("Copied anchor diagnostics.", true);
});
document.getElementById("btnApplyPattern").addEventListener("click", () => {
  try {
    state.pattern = parsePattern(els.patternText.value);
    render();
    setStatus("Applied pasted pattern.", true);
  } catch (error) {
    setStatus(String(error.message || error));
  }
});
document.getElementById("btnResetPattern").addEventListener("click", () => {
  state.pattern = structuredClone(DEFAULT_PATTERN);
  els.patternText.value = formatPattern(state.pattern);
  render();
  setStatus("Reset to zone default pattern.", true);
});

["stageW", "stageH", "cameraX", "showDecor", "showOverlay", "showPlayer"].forEach((id) => {
  els[id].addEventListener("input", render);
  els[id].addEventListener("change", render);
});

loadAssets()
  .then(render)
  .catch((error) => setStatus(String(error.message || error)));