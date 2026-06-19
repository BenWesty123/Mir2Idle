#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const GAME = path.resolve(import.meta.dirname, "../src/game");
const RUNTIME = path.join(GAME, "runtime.js");
const CONSTANTS = path.join(GAME, "constants.js");

const runtime = fs.readFileSync(RUNTIME, "utf8");
const lines = runtime.split(/\r?\n/);

const start = lines.findIndex((l) => l.startsWith("const TESTING_XP"));
const end = lines.findIndex((l) => l === "export let state;");
if (start < 0 || end < 0) throw new Error("constants block not found");

const block = lines.slice(start, end);
const exported = block.map((line) => {
  if (line.startsWith("const ")) return line.replace(/^const /, "export const ");
  if (line.startsWith("function ")) return line.replace(/^function /, "export function ");
  if (line.startsWith("async function ")) return line.replace(/^async function /, "export async function ");
  return line;
});

const names = [];
for (const line of exported) {
  const m = line.match(/^export (?:async )?(?:function|const) (\w+)/);
  if (m) names.push(m[1]);
}

const installBody = names.map((n) => `  g.${n} = ${n};`).join("\n");
const constantsFile = `${exported.join("\n")}

/** Expose game constants on globalThis so split modules match monolith scope. */
export function installConstants() {
  const g = globalThis;
${installBody}
}
`;

fs.writeFileSync(CONSTANTS, constantsFile);

const newRuntime = [
  ...lines.slice(0, start),
  'import { installConstants } from "./constants.js";',
  "installConstants();",
  "",
  ...lines.slice(end),
].join("\n");

fs.writeFileSync(RUNTIME, newRuntime);

const indexPath = path.join(GAME, "index.js");
const index = fs.readFileSync(indexPath, "utf8");
if (!index.includes("installConstants")) {
  fs.writeFileSync(
    indexPath,
    `import { installConstants } from "./constants.js";\ninstallConstants();\n\n${index}`,
  );
}

console.log(`Extracted ${names.length} constants/helpers to constants.js`);
