import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const itemsPath = path.join(root, "src/data/items.json");
const crystalItemsPath = path.join(root, "src/data/crystal-items.json");

const crystalRaw = JSON.parse(fs.readFileSync(crystalItemsPath, "utf8"));
const catalog = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const crystalList = Array.isArray(crystalRaw) ? crystalRaw : crystalRaw.items;

const byCrystalIndex = new Map();
const byCrystalName = new Map();
for (const item of crystalList) {
  if (item.crystalIndex != null) byCrystalIndex.set(Number(item.crystalIndex), item);
  if (item.name) byCrystalName.set(item.name, item);
}

let updated = 0;
for (const item of catalog.items) {
  const crystal = (item.source?.crystalIndex != null && byCrystalIndex.get(Number(item.source.crystalIndex)))
    ?? (item.source?.name && byCrystalName.get(item.source.name))
    ?? null;
  if (!crystal) continue;
  let changed = false;
  if (Number(crystal.set) > 0 && item.set !== Number(crystal.set)) {
    item.set = Number(crystal.set);
    changed = true;
  }
  if (crystal.type && item.crystalType !== crystal.type) {
    item.crystalType = crystal.type;
    changed = true;
  }
  if (changed) updated += 1;
}

fs.writeFileSync(itemsPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Merged set metadata onto ${updated} items (${catalog.items.length} total).`);
