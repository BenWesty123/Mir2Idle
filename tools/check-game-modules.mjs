import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const gameDir = path.resolve(import.meta.dirname, "../src/game");
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
}

walk(gameDir);
for (const file of files) {
  execSync(`node --check "${file}"`, { stdio: "inherit" });
}
console.log(`Checked ${files.length} game module files.`);
