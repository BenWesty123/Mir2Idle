import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const dropMatch = app.match(/const OMA_KING_SPIRIT_BOSS_DROPS = \{[\s\S]*?\n\};/);
const dropIds = [...dropMatch[0].matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
const items = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8")).items;
const byId = Object.fromEntries(items.map((item) => [item.id, item]));
const publicIconRoot = path.join(root, "public/item-icons/items");

const copied = [];
const missing = [];

for (const id of dropIds) {
  const item = byId[id];
  const frame = item?.icon?.frame;
  if (frame == null) continue;
  const dest = path.join(publicIconRoot, frameFileName(frame));
  if (fs.existsSync(dest)) continue;
  if (copyItemIcon(root, frame, publicIconRoot)) copied.push(`${id} (${frameFileName(frame)})`);
  else missing.push(`${id} (${frameFileName(frame)})`);
}

console.log(`Copied ${copied.length} icons:`);
for (const line of copied) console.log(`  ${line}`);
if (missing.length) {
  console.log(`Still missing ${missing.length} review PNGs:`);
  for (const line of missing) console.log(`  ${line}`);
}
