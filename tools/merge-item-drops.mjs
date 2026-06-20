import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const itemsPath = path.join(root, "src/data/items.json");

function usage() {
  console.log([
    "Usage:",
    "  node tools/merge-item-drops.mjs --zone <zone-id> --item <item-id>=<chance> [--item <item-id>=<chance> ...]",
    "",
    "Example:",
    "  node tools/merge-item-drops.mjs --zone zone-viper-cave-1 --item wooden-sword=0.01667",
    "",
    "This tool only adds or updates drop chances on existing items. It never removes items.",
  ].join("\n"));
}

function argValues(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] !== name) continue;
    if (process.argv[i + 1]) values.push(process.argv[i + 1]);
    i++;
  }
  return values;
}

const zone = argValues("--zone")[0];
const itemArgs = argValues("--item");

if (!zone || !itemArgs.length || process.argv.includes("--help")) {
  usage();
  process.exit(zone && itemArgs.length ? 0 : 1);
}

const data = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const items = Array.isArray(data.items) ? data.items : [];
const byId = new Map(items.map((item) => [item.id, item]));
const updates = [];

for (const itemArg of itemArgs) {
  const [id, chanceText] = itemArg.split("=");
  const chance = Number(chanceText);
  if (!id || !Number.isFinite(chance) || chance <= 0 || chance > 1) {
    throw new Error(`Invalid --item value "${itemArg}". Expected item-id=chance where chance is > 0 and <= 1.`);
  }
  const item = byId.get(id);
  if (!item) {
    throw new Error(`Unknown item id "${id}". Refusing to create/remove item definitions.`);
  }
  updates.push([item, Number(chance.toFixed(5))]);
}

for (const [item, chance] of updates) {
  item.drop = item.drop ?? {};
  item.drop.zones = Array.from(new Set([...(item.drop.zones ?? []), zone])).sort();
  item.drop.chances = item.drop.chances ?? {};
  item.drop.chances[zone] = chance;
  item.drop.chance = Math.max(Number(item.drop.chance) || 0, chance);
}

fs.writeFileSync(itemsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated ${updates.length} item drop chance(s) for ${zone}.`);
