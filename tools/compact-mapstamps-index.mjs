import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// The stamp builders (tools/build-*-stamp.ps1) write public/mapstamps/index.json
// with ConvertTo-Json, which pretty-prints. Every stamp carries per-cell `layers`
// and `assets` arrays, so the indentation alone grew the file past Cloudflare
// Pages' 25 MiB per-file upload limit (30.2 MiB pretty vs 5.2 MiB compact) - and
// the game fetches the whole index at boot. Run this after rebuilding a stamp.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "public/mapstamps/index.json");

const before = fs.readFileSync(indexPath, "utf8");
const compact = `${JSON.stringify(JSON.parse(before))}\n`;

const mib = (text) => (Buffer.byteLength(text) / 1024 / 1024).toFixed(2);

if (compact === before) {
  console.log(`public/mapstamps/index.json already compact (${mib(before)} MiB).`);
  process.exit(0);
}

fs.writeFileSync(indexPath, compact);
console.log(`Compacted public/mapstamps/index.json: ${mib(before)} MiB -> ${mib(compact)} MiB`);
