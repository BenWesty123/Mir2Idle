import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BOSS_DROP_TABLE_BY_LABEL, clampChance, validateBossDropTables } from "../src/bossDrops.js";

const EXPECTED_LABELS = [
  "Wooma Taurus",
  "Incarnated Wooma Taurus",
  "Incarnated Zuma Taurus",
  "Evil Snake",
  "Zuma Taurus",
  "Evil Centipede",
  "Bone Lord",
  "King Scorpion",
  "Minotaur King",
  "Yimoogi",
  "Oma King Spirit",
  "King Hog",
  "Dream Devourer",
  "Dark Devourer",
  "Great Fox Spirit",
  "Beast King",
  "Danmo",
  "Dark Devil",
  "Hell Keeper",
  "Manectric King",
  "Hell Lord",
];

function loadKnownItemIds() {
  const file = path.join(import.meta.dirname, "..", "src", "data", "items.json");
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const data = JSON.parse(text);
  return new Set((data.items ?? []).map((item) => item.id));
}

test("every expected boss has a drop table and there are no extras", () => {
  for (const label of EXPECTED_LABELS) {
    assert.ok(BOSS_DROP_TABLE_BY_LABEL[label], `missing drop table for ${label}`);
  }
  assert.equal(Object.keys(BOSS_DROP_TABLE_BY_LABEL).length, EXPECTED_LABELS.length);
});

test("boss drop tables are structurally valid (gold present, chances in (0,1])", () => {
  const problems = validateBossDropTables(BOSS_DROP_TABLE_BY_LABEL);
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});

test("every boss drop item id exists in items.json", () => {
  const knownItemIds = loadKnownItemIds();
  assert.ok(knownItemIds.size > 0, "items.json should define items");
  const unknown = [];
  for (const [label, table] of Object.entries(BOSS_DROP_TABLE_BY_LABEL)) {
    for (const entry of table.items) {
      if (!knownItemIds.has(entry.id)) {
        unknown.push(`${label}: ${entry.id}`);
      }
    }
    for (const entry of table.awakenedItems ?? []) {
      if (!knownItemIds.has(entry.id)) {
        unknown.push(`${label} (awakened): ${entry.id}`);
      }
    }
  }
  assert.deepEqual(unknown, [], `\nUnknown item ids in boss drops:\n${unknown.join("\n")}`);
});

test("Wooma Taurus awakened exclusives include Awakened Soul Spring Wand at 1%", () => {
  const table = BOSS_DROP_TABLE_BY_LABEL["Wooma Taurus"];
  const wand = (table.awakenedItems ?? []).find((entry) => entry.id === "awakened-soul-spring-wand");
  assert.ok(wand, "expected awakened-soul-spring-wand on Wooma Taurus awakenedItems");
  assert.equal(wand.chance, 0.01);
});

test("Evil Centipede / Evil Snake awakened exclusives for Judgement Mace and War Mage Staff", () => {
  const centipede = BOSS_DROP_TABLE_BY_LABEL["Evil Centipede"];
  const snake = BOSS_DROP_TABLE_BY_LABEL["Evil Snake"];
  const mace = (centipede.awakenedItems ?? []).find((entry) => entry.id === "awakened-judgement-mace");
  const staff = (snake.awakenedItems ?? []).find((entry) => entry.id === "awakened-war-mage-staff");
  assert.ok(mace, "expected awakened-judgement-mace on Evil Centipede awakenedItems");
  assert.equal(mace.chance, 0.01);
  assert.ok(staff, "expected awakened-war-mage-staff on Evil Snake awakenedItems");
  assert.equal(staff.chance, 0.01);
});

test("clampChance keeps values within [0,1]", () => {
  assert.equal(clampChance(0.5), 0.5);
  assert.equal(clampChance(0), 0);
  assert.equal(clampChance(1), 1);
  assert.equal(clampChance(-1), 0);
  assert.equal(clampChance(2), 1);
  assert.equal(clampChance("nope"), 0);
});

test("validateBossDropTables flags bad data", () => {
  const bad = {
    "Test Boss": { gold: 10, items: [{ id: "x", chance: 5 }, { chance: 0.1 }] },
  };
  const problems = validateBossDropTables(bad, new Set(["y"]));
  assert.ok(problems.some((p) => p.includes("out-of-range chance")));
  assert.ok(problems.some((p) => p.includes("missing its id")));
  assert.ok(problems.some((p) => p.includes("not a known item id")));
});
