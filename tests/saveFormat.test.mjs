import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SAVE_VERSION, parseSaveSnapshotText } from "../src/persistence/saveFormat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalSavePath = join(__dirname, "fixtures/saves/minimal-v1.json");
const minimalSave = readFileSync(minimalSavePath, "utf8");

test("SAVE_VERSION is pinned at 1", () => {
  assert.equal(SAVE_VERSION, 1);
});

test("parseSaveSnapshotText: accepts minimal v1 fixture", () => {
  const result = parseSaveSnapshotText(minimalSave);
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.version, 1);
  assert.ok(result.snapshot.characters.Warrior);
});

test("parseSaveSnapshotText: rejects empty input", () => {
  const result = parseSaveSnapshotText("   ");
  assert.equal(result.ok, false);
  assert.match(result.error, /paste a save file/i);
});

test("parseSaveSnapshotText: rejects invalid JSON", () => {
  const result = parseSaveSnapshotText("{not json");
  assert.equal(result.ok, false);
  assert.match(result.error, /valid json/i);
});

test("parseSaveSnapshotText: rejects unsupported version", () => {
  const result = parseSaveSnapshotText(JSON.stringify({ version: 99, characters: {} }));
  assert.equal(result.ok, false);
  assert.match(result.error, /not supported/i);
});

test("parseSaveSnapshotText: rejects missing characters", () => {
  const result = parseSaveSnapshotText(JSON.stringify({ version: 1 }));
  assert.equal(result.ok, false);
  assert.match(result.error, /character data/i);
});

test("parseSaveSnapshotText: round-trip preserves snapshot shape", () => {
  const parsed = parseSaveSnapshotText(minimalSave);
  assert.equal(parsed.ok, true);
  const roundTrip = parseSaveSnapshotText(JSON.stringify(parsed.snapshot));
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.snapshot, parsed.snapshot);
});
