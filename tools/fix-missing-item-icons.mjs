import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const itemsPath = path.join(root, "src/data/items.json");
const crystalItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
const publicIconRoot = path.join(root, "public/item-icons/items");

function copyIcon(frame) {
  return copyItemIcon(root, frame, publicIconRoot);
}

function crystalFrameFor(item) {
  const crystal = crystalItems.find((entry) => entry.name === item.source?.name);
  return crystal?.icon?.frame ?? crystal?.image ?? null;
}

const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const fixed = [];
const missingPng = [];

for (const item of itemsDoc.items) {
  const broken =
    !item.icon?.frame ||
    item.icon.src?.includes("frame_undefined") ||
    item.icon.src?.includes("undefined");
  if (!broken) continue;

  const frame = crystalFrameFor(item);
  if (frame == null) {
    console.warn(`No crystal frame for ${item.id} (${item.source?.name})`);
    continue;
  }

  if (!copyIcon(frame)) {
    missingPng.push({ id: item.id, frame });
  }

  item.icon = {
    library: "Items",
    frame,
    src: `/public/item-icons/items/${frameFileName(frame)}`,
  };
  fixed.push(`${item.id} -> frame ${frame}`);
}

if (fixed.length) {
  fs.writeFileSync(itemsPath, `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");
}

console.log(`Fixed ${fixed.length} item icons:`);
for (const line of fixed) console.log(`  ${line}`);
if (missingPng.length) {
  console.warn("Missing review PNGs (run export-item-icon-review.ps1):");
  for (const entry of missingPng) console.warn(`  ${entry.id}: ${frameFileName(entry.frame)}`);
}
