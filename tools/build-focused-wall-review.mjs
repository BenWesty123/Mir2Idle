import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceId = "oma-cave-wall-objects-004400-004639";
const sourceDir = path.join(root, "tile-review", sourceId);
const outputDir = path.join(root, "tile-review", "oma-cave-wall-focus-4495-4520");
const tiles = JSON.parse(fs.readFileSync(path.join(sourceDir, "tiles.json"), "utf8")).tiles;

const mapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D001.map";
const usage = fs.existsSync(mapPath) ? d001FrontUsage(mapPath) : new Map();
const wantedFrames = [
  4495, 4496, 4497, 4498, 4499,
  4500, 4501, 4502, 4503, 4504,
  4505, 4506, 4507, 4508, 4509,
  4510, 4511, 4512,
  4514, 4515, 4516,
  4518, 4519, 4520,
];

const wanted = wantedFrames
  .map((frame) => tiles.find((tile) => tile.frame === frame))
  .filter(Boolean);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "index.html"), html(wanted));

function html(items) {
  const edgeTiles = items.filter((tile) => tile.height <= 48);
  const tallTiles = items.filter((tile) => tile.height > 48);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Oma Cave Wall Focus 4495-4520</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; padding: 12px 16px; border-bottom: 1px solid #333; background: #181818; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      h2 { margin: 20px 16px 8px; color: #f0d69a; font-size: 16px; }
      p { margin: 0; color: #aaa; }
      main { padding-bottom: 24px; }
      .controls { display: flex; align-items: center; gap: 10px; margin-top: 10px; color: #ddd; }
      .controls input { width: 220px; }
      .strip { display: flex; align-items: flex-end; gap: 4px; overflow-x: auto; margin: 0 16px 12px; padding: 10px; border: 1px solid #333; background: #0b0b0b; }
      .strip-item { display: grid; gap: 4px; justify-items: center; min-width: 52px; }
      .strip-item img { max-width: none; image-rendering: pixelated; }
      .strip-item span { color: #ddd; font-size: 11px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 12px; padding: 0 16px 12px; }
      .card { border: 1px solid #333; background: #1b1b1b; padding: 8px; display: grid; gap: 8px; }
      .card.focus { border-color: #d8a84d; box-shadow: 0 0 0 1px #d8a84d inset; }
      .preview { display: grid; grid-template-columns: 1fr; gap: 6px; }
      .stage { min-height: 72px; display: grid; place-items: center; overflow: auto; border: 1px solid #2b2b2b; }
      .stage.black { background: #000; }
      .stage.cave { background: #2b2118; }
      .stage.checker {
        background-color: #222;
        background-image:
          linear-gradient(45deg, #333 25%, transparent 25%),
          linear-gradient(-45deg, #333 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #333 75%),
          linear-gradient(-45deg, transparent 75%, #333 75%);
        background-position: 0 0, 0 8px, 8px -8px, -8px 0;
        background-size: 16px 16px;
      }
      img { max-width: none; image-rendering: pixelated; object-fit: contain; }
      .wall-img { width: calc(var(--w) * var(--scale, 2)); height: calc(var(--h) * var(--scale, 2)); }
      .strip .wall-img { width: calc(var(--w) * var(--strip-scale, 1)); height: calc(var(--h) * var(--strip-scale, 1)); }
      strong { display: flex; justify-content: space-between; gap: 8px; color: #fff1cf; }
      span { color: #aaa; font-size: 11px; }
      code { color: #e5bd68; }
    </style>
  </head>
  <body>
    <header>
      <h1>Oma Cave Wall Focus: Frames 4495-4520</h1>
      <p>These are real front-layer frames used by <code>D001.map</code>. Frame <code>4507</code> is highlighted.</p>
      <div class="controls">
        <label for="scale">Card zoom</label>
        <input id="scale" type="range" min="1" max="5" step="0.5" value="2" />
        <output id="scaleValue">2x</output>
      </div>
    </header>
    <main>
      <h2>Short Wall-Edge Tiles</h2>
      ${strip(edgeTiles)}
      <section class="grid">
        ${edgeTiles.map((tile) => card(tile, "edge")).join("\n")}
      </section>
      <h2>Tall Cliff Wall Columns</h2>
      ${strip(tallTiles)}
      <section class="grid">
        ${tallTiles.map((tile) => card(tile, "tall")).join("\n")}
      </section>
    </main>
    <script>
      const slider = document.querySelector("#scale");
      const output = document.querySelector("#scaleValue");
      const applyScale = () => {
        document.documentElement.style.setProperty("--scale", slider.value);
        output.value = slider.value + "x";
      };
      slider.addEventListener("input", applyScale);
      applyScale();
    </script>
  </body>
</html>`;
}

function card(tile, kind) {
  const file = `../${sourceId}/${tile.file}`;
  const useCount = usage.get(tile.frame) ?? 0;
  const focus = tile.frame === 4507 ? " focus" : "";
  return `<article class="card ${kind}${focus}" style="--w:${tile.width}px; --h:${tile.height}px;">
    <strong><span>Frame ${tile.frame}</span><span>Used ${useCount}</span></strong>
    <div class="preview">
      <div class="stage cave"><img class="wall-img" src="${file}" alt="Frame ${tile.frame} on cave colour" /></div>
      <div class="stage checker"><img class="wall-img" src="${file}" alt="Frame ${tile.frame} on checker" /></div>
    </div>
    <span>${tile.width}x${tile.height}, offset ${tile.offsetX}, ${tile.offsetY}</span>
  </article>`;
}

function strip(items) {
  return `<section class="strip">
    ${items.map((tile) => {
      const file = `../${sourceId}/${tile.file}`;
      const focus = tile.frame === 4507 ? " focus" : "";
      return `<div class="strip-item${focus}" style="--w:${tile.width}px; --h:${tile.height}px;">
        <img class="wall-img" src="${file}" alt="Frame ${tile.frame}" />
        <span>${tile.frame}</span>
      </div>`;
    }).join("\n")}
  </section>`;
}

function d001FrontUsage(fileName) {
  const bytes = fs.readFileSync(fileName);
  const int16 = (offset) => bytes.readInt16LE(offset);
  const xor = int16(23);
  const width = int16(21) ^ xor;
  const height = int16(25) ^ xor;
  let offset = 54;
  const counts = new Map();
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const frontImage = int16(offset + 6) ^ xor;
      const frontIndex = bytes[offset + 12] + 2;
      offset += 15;
      if (frontIndex !== 2) continue;
      const frame = (frontImage & 0x7fff) - 1;
      if (frame < 0) continue;
      counts.set(frame, (counts.get(frame) ?? 0) + 1);
    }
  }
  return counts;
}
