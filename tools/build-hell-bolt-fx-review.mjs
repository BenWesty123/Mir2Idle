#!/usr/bin/env node
/**
 * Hell Bolt (219) FX review — redirects to the combined Hell Cavern page section.
 * Also regenerates tile-review/hell-bolt-fx/ for backwards-compatible bookmarks.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("node tools/build-hell-cavern-fx-review.mjs", { cwd: root, stdio: "inherit" });

const combined = path.join(root, "tile-review", "hell-cavern-fx", "index.html");
const legacyDir = path.join(root, "tile-review", "hell-bolt-fx");
fs.mkdirSync(legacyDir, { recursive: true });
const redirect = `<!doctype html>
<meta http-equiv="refresh" content="0;url=../hell-cavern-fx/index.html#m219" />
<p><a href="../hell-cavern-fx/index.html#m219">Hell Bolt FX review (moved)</a></p>`;
fs.writeFileSync(path.join(legacyDir, "index.html"), redirect, "utf8");
console.log(JSON.stringify({ redirect: path.join(legacyDir, "index.html"), combined }, null, 2));
