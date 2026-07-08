import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const iconRoot = path.join(root, "tile-review/items-icons-000000-001999/images");
const items = [
  { label: "StoneHeart (frame 448)", file: path.join(iconRoot, "frame_000448.png") },
  { label: "PigHoof (frame 0)", file: path.join(iconRoot, "frame_000000.png") },
  { label: "PigEar (also frame 0)", file: path.join(iconRoot, "frame_000000.png") },
  { label: "WoomaHeart / ZumaHeart (frame 448)", file: path.join(root, "public/item-icons/items/frame_000448.png") },
];

for (const item of items) {
  const stat = fs.statSync(item.file);
  console.log(`${item.label}: ${stat.size} bytes`);
}

const b64 = (file) => fs.readFileSync(file).toString("base64");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>StoneHeart & PigHoof icons</title>
  <style>
    body { font-family: sans-serif; background: #111; color: #eee; padding: 24px; }
    .row { display: flex; gap: 24px; flex-wrap: wrap; }
    .item { text-align: center; background: #222; padding: 16px; border-radius: 8px; min-width: 180px; }
    img { width: 64px; height: 64px; image-rendering: pixelated; background: #000; border: 1px solid #444; }
    .note { margin-top: 24px; color: #aaa; max-width: 720px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Crystal item icon preview</h1>
  <div class="row">
    ${items
      .map(
        (item) =>
          `<div class="item"><img src="data:image/png;base64,${b64(item.file)}" alt="${item.label}" /><div>${item.label}</div></div>`,
      )
      .join("")}
  </div>
  <p class="note">PigHoof and PigEar both point at Crystal frame 0 in the item DB — usually a blank/missing icon slot. StoneHeart shares frame 448 with WoomaHeart and ZumaHeart.</p>
</body>
</html>`;

const out = path.join(root, "tools/_preview-icons/stoneheart-pighoof-preview.html");
fs.writeFileSync(out, html);
console.log("Wrote", out);
