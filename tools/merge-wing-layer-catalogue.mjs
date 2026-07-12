import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const cataloguePath = path.join(root, "public/sprite-sets/common/layers.json");
const wingDir = path.join(root, "public/sprite-sets/common/wing");

if (!fs.existsSync(wingDir)) {
  console.error("No wing layer output found — run export:wing-sprites first.");
  process.exit(1);
}

let catalogue;
try {
  const fromGit = execSync("git show HEAD:public/sprite-sets/common/layers.json", {
    cwd: root,
    encoding: "utf8",
  });
  catalogue = JSON.parse(fromGit);
} catch {
  catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
}

const indexes = fs.readdirSync(wingDir)
  .filter((name) => /^\d+\.json$/.test(name))
  .map((name) => Number(path.basename(name, ".json")))
  .filter((index) => Number.isFinite(index))
  .sort((a, b) => a - b);

catalogue.layers ??= {};
catalogue.layers.wing = { count: indexes.length, indexes };
fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`Merged wing layer into ${cataloguePath} (${indexes.length} indexes: ${indexes.join(", ")})`);
