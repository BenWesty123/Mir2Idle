import fs from "node:fs";
import path from "node:path";
import { buildUsedSpellfxFiles, findMissingPublicFiles } from "./itch-spellfx-manifest.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const requirePackage = args.has("--require-package");
const sourceOnly = args.has("--source-only");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function walk(directory, relativeRoot = "") {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

const requiredSpellfx = buildUsedSpellfxFiles(root);
const missingSource = findMissingPublicFiles(root, requiredSpellfx);

console.log("Itch release verification");
console.log(`Spell FX assets required: ${requiredSpellfx.size}`);

if (missingSource.length) {
  console.error("\nMissing spell FX files in public/:");
  for (const entry of missingSource) console.error(`  - ${entry}`);
  fail("\nFix missing source assets before packaging.");
}

console.log(`Source spell FX: OK (${requiredSpellfx.size} files present)`);

if (sourceOnly) {
  console.log("Source-only check passed.");
  process.exit(0);
}

const packagePublicRoot = path.join(root, "dist/itch/public");
if (!fs.existsSync(packagePublicRoot)) {
  if (requirePackage) {
    fail("dist/itch/public not found. Run `npm run package:itch` first.");
  }
  console.log("Package folder not found; skipping packaged asset check.");
  console.log("Run `npm run release:itch` before uploading to itch.io.");
  process.exit(0);
}

const packaged = new Set(walk(packagePublicRoot));
const missingPackage = [...requiredSpellfx].filter((entry) => !packaged.has(entry));

if (missingPackage.length) {
  console.error("\nSpell FX files missing from dist/itch/public:");
  for (const entry of missingPackage) console.error(`  - ${entry}`);
  fail("\nPackage is incomplete. Re-run `npm run package:itch` after fixing tools/itch-spellfx-manifest.mjs or public assets.");
}

console.log(`Packaged spell FX: OK (${requiredSpellfx.size} files included)`);
console.log("Itch release verification passed.");
