#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const GAME = path.resolve(import.meta.dirname, "../src/game");
const RUNTIME = path.join(GAME, "runtime.js");

const RUNTIME_EXPORTS = ["root", "els", "query", "UI_MODE", "IS_GAME_UI"];

let runtime = fs.readFileSync(RUNTIME, "utf8");
for (const name of RUNTIME_EXPORTS) {
  runtime = runtime.replace(new RegExp(`^const ${name} `, "m"), `export const ${name} `);
}
fs.writeFileSync(RUNTIME, runtime);

function patchRuntimeImport(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(/\/\/ TESTING ONLY[^\n]*\n\/\/ Global XP[^\n]*\n\n?/g, "");
  const used = RUNTIME_EXPORTS.filter((n) => new RegExp(`\\b${n}\\b`).test(text));
  const base = used.includes("state") || used.includes("els") ? used : used;
  const allNeeded = [...new Set([
    ...( /\bstate\b/.test(text) ? ["state"] : []),
    ...( /\bels\b/.test(text) ? ["els"] : []),
    ...used,
  ])];
  if (!allNeeded.length) return;
  const rel = path.relative(path.dirname(filePath), RUNTIME).replace(/\\/g, "/");
  const importPath = rel.startsWith(".") ? rel : `./${rel}`;
  const line = `import { ${allNeeded.join(", ")} } from "${importPath}";`;
  const m = text.match(/^import \{([^}]+)\} from ["'].*runtime\.js["'];/m);
  if (m) {
    const merged = [...new Set([...m[1].split(",").map((s) => s.trim()), ...allNeeded])];
    text = text.replace(m[0], `import { ${merged.join(", ")} } from "${importPath}";`);
  } else {
    const idx = text.indexOf('import { G } from');
    text = `${text.slice(0, idx)}\n${line}\n${text.slice(idx)}`;
  }
  fs.writeFileSync(filePath, text);
}

for (const f of fs.readdirSync(path.join(GAME, "modules"))) {
  patchRuntimeImport(path.join(GAME, "modules", f));
}
patchRuntimeImport(path.join(GAME, "bootstrap.js"));
console.log("Patched runtime exports and module imports.");
