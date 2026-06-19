import fs from "node:fs";
import path from "node:path";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const dropMatch = app.match(/const OMA_KING_SPIRIT_BOSS_DROPS = \{[\s\S]*?\n\};/);
const dropIds = [...dropMatch[0].matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);

const items = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8")).items;
const crystalItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
const stateitems = JSON.parse(fs.readFileSync(path.join(root, "public/ui/character/stateitems.json"), "utf8"));
const layers = JSON.parse(fs.readFileSync(path.join(root, "public/sprite-sets/common/layers.json"), "utf8"));
const byId = Object.fromEntries(items.map((item) => [item.id, item]));
const crystalByName = Object.fromEntries(crystalItems.map((item) => [item.name, item]));

function crystalFor(item) {
  return crystalByName[item.source?.name] ?? null;
}

function publicIconExists(src) {
  if (!src) return false;
  const rel = src.replace(/^\/public\//, "");
  return fs.existsSync(path.join(root, "public", rel));
}

function reviewIconExists(frame) {
  return Boolean(reviewIconSourcePath(root, frame));
}

for (const id of dropIds) {
  const item = byId[id];
  if (!item) {
    console.log(`MISSING ITEM DEF: ${id}`);
    continue;
  }
  const crystal = crystalFor(item);
  const issues = [];
  const frame = item.icon?.frame;
  if (!publicIconExists(item.icon?.src)) {
    issues.push(`bag icon missing (${item.icon?.src}) review=${reviewIconExists(frame) ? "yes" : "no"}`);
  }
  if (["weapon", "armour", "helmet"].includes(item.slot)) {
    if (frame != null && !stateitems[String(frame)]) {
      issues.push(`character screen stateitem missing for frame ${frame}`);
    }
    if (item.visual) {
      const indexes = layers.layers?.[item.visual.layer]?.indexes ?? [];
      if (!indexes.includes(item.visual.index)) {
        issues.push(`world visual index ${item.visual.index} not exported for ${item.visual.layer}`);
      }
      if (crystal?.shape != null && item.visual.index !== crystal.shape) {
        issues.push(`visual.index ${item.visual.index} should be crystal shape ${crystal.shape}`);
      }
      const atlasJson = path.join(root, "public/sprite-sets/common", item.visual.layer, `${item.visual.index}.json`);
      const atlasPng = path.join(root, "public/sprite-sets/common", item.visual.layer, `${item.visual.index}.png`);
      if (!fs.existsSync(atlasJson) || !fs.existsSync(atlasPng)) {
        issues.push(`world sprite atlas missing for ${item.visual.layer}/${item.visual.index}`);
      }
    } else if (item.slot === "weapon" || item.slot === "armour") {
      issues.push("missing visual block");
    }
  }
  if (issues.length) console.log(`${id}: ${issues.join("; ")}`);
}
