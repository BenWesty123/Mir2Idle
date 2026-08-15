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
  "Crystal Spider",
  "Frost Tiger",
  "Oma King",
  "Zuma Taurus",
  "Red Evil Ape",
  "Evil Centipede",
  "Bone Lord",
  "King Scorpion",
  "Minotaur King",
  "Red Moon Evil",
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

function loadItemsById() {
  const file = path.join(import.meta.dirname, "..", "src", "data", "items.json");
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const data = JSON.parse(text);
  return new Map((data.items ?? []).map((item) => [item.id, item]));
}

function loadKnownItemIds() {
  return new Set(loadItemsById().keys());
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

test("Frost Tiger uses Danmo chassis without Hell Yama Blade or Dark Armour", () => {
  const table = BOSS_DROP_TABLE_BY_LABEL["Frost Tiger"];
  const ids = table.items.map((entry) => entry.id);
  assert.equal(table.gold, 35000);
  assert.equal(table.benedictionOils, 2);
  assert.ok(ids.includes("awakening-soul"));
  assert.ok(ids.includes("cloud-ring"));
  assert.ok(ids.includes("gonryunyongdrama-m-1"));
  for (const id of [
    "tarragon-belt",
    "tarragon-boots",
    "tarragon-bracelet",
    "tarragon-helmet",
    "tarragon-ring",
  ]) {
    const entry = table.items.find((item) => item.id === id);
    assert.ok(entry, `expected ${id} on Frost Tiger`);
    assert.equal(entry.chance, 0.025);
  }
  for (const id of [
    "gon-ryun-holy-light-sword-1",
    "gon-ryun-holy-light-sword-2",
    "gon-ryun-holy-light-sword-3",
    "evil-dragon-ring-1",
    "evil-dragon-ring-2",
    "evil-dragon-ring-3",
    "dragon-necklace-1",
    "dragon-necklace-2",
    "dragon-necklace-3",
    "golden-dragon-bracelet-1",
    "golden-dragon-bracelet-2",
    "golden-dragon-bracelet-3",
  ]) {
    const entry = table.items.find((item) => item.id === id);
    assert.ok(entry, `expected ${id} on Frost Tiger`);
    assert.equal(entry.chance, 0.0125);
  }
  for (const id of ["stone-golem-bracelet1", "stone-golem-bracelet2", "stone-golem-bracelet3"]) {
    const entry = table.items.find((item) => item.id === id);
    assert.ok(entry, `expected ${id} on Frost Tiger`);
    assert.equal(entry.chance, 0.025);
  }
  for (const id of ["book-magic-booster", "book-energy-shield", "book-slashing-burst"]) {
    const entry = table.items.find((item) => item.id === id);
    assert.ok(entry, `expected ${id} on Frost Tiger`);
    assert.equal(entry.chance, 0.05);
  }
  assert.equal(
    ids.filter((id) => id.startsWith("book-")).sort().join(","),
    "book-energy-shield,book-magic-booster,book-slashing-burst",
  );
  assert.equal(ids.some((id) => id.startsWith("hell-yama-blade")), false);
  assert.equal(ids.some((id) => id.endsWith("-dark-armour")), false);
  assert.equal(ids.includes("heaven-armour"), false);
  for (const id of ["gonryunyongdrama-m-1", "gonryunyongdrama-m-2", "gonryunyongdrama-m-3"]) {
    assert.equal(table.items.find((item) => item.id === id).chance, 0.01);
  }
  for (const id of ["tarragon-armour-m-1", "tarragon-armour-m-2", "tarragon-armour-m-3"]) {
    assert.equal(table.items.find((item) => item.id === id).chance, 0.025);
  }
});

test("Frost Tiger and Danmo drop Tarragon Belt at 2.5%", () => {
  for (const label of ["Frost Tiger", "Danmo"]) {
    const entry = BOSS_DROP_TABLE_BY_LABEL[label].items.find((item) => item.id === "tarragon-belt");
    assert.ok(entry, `expected tarragon-belt on ${label}`);
    assert.equal(entry.chance, 0.025);
  }
});

test("Oma King copies Frost Tiger loot without books, robe, spirit ring, or Tarragon Armour", () => {
  const table = BOSS_DROP_TABLE_BY_LABEL["Oma King"];
  const ids = table.items.map((entry) => entry.id);
  assert.equal(table.gold, 35000);
  assert.equal(table.benedictionOils, 2);
  assert.equal(ids.some((id) => id.startsWith("book-")), false);
  assert.equal(ids.includes("oma-king-robe"), false);
  assert.equal(ids.includes("oma-spirit-ring"), false);
  assert.equal(ids.some((id) => id.startsWith("tarragon-armour")), false);
  assert.ok(ids.includes("gon-ryun-holy-light-sword-1"));
  assert.ok(ids.includes("tarragon-belt"));
  assert.equal(ids.includes("heaven-armour"), false);
  assert.equal(table.items.find((item) => item.id === "golden-dragon-bracelet-1").chance, 0.025);
  assert.equal(table.items.find((item) => item.id === "stone-golem-bracelet1").chance, 0.05);
  assert.equal(table.items.find((item) => item.id === "oma-king-armour").chance, 0.0125);
  for (const id of ["barbarian-sword", "bone-carved-fan", "slaughter-pike"]) {
    assert.equal(table.items.find((item) => item.id === id).chance, 0.025);
    assert.equal(
      (BOSS_DROP_TABLE_BY_LABEL["Frost Tiger"].items ?? []).some((item) => item.id === id),
      false,
    );
  }
  for (const id of [
    "r-dragon-ring-1",
    "r-dragon-ring-2",
    "r-dragon-ring-3",
    "evil-dragon-bracelet-1",
    "evil-dragon-bracelet-2",
    "evil-dragon-bracelet-3",
    "evil-dragon-necklace-1",
    "evil-dragon-necklace-2",
    "evil-dragon-necklace-3",
  ]) {
    assert.equal(table.items.find((item) => item.id === id).chance, 0.0125);
    assert.equal(
      (BOSS_DROP_TABLE_BY_LABEL["Frost Tiger"].items ?? []).some((item) => item.id === id),
      false,
    );
  }
  assert.equal(
    (BOSS_DROP_TABLE_BY_LABEL["Frost Tiger"].items ?? []).some((item) => item.id === "oma-king-armour"),
    false,
  );
});

test("Oma King accessory tiers are 5% / 2.5% / 1.25%", () => {
  const table = BOSS_DROP_TABLE_BY_LABEL["Oma King"];
  const chance = (id) => table.items.find((item) => item.id === id)?.chance;
  for (const id of ["cloud-ring", "tarragon-belt", "stone-golem-bracelet1", "gold-dragon-ring", "demon-mask"]) {
    assert.equal(chance(id), 0.05, `${id} should be lowest-tier 5%`);
  }
  for (const id of ["evil-dragon-ring-1", "dragon-necklace-2", "golden-dragon-bracelet-3"]) {
    assert.equal(chance(id), 0.025, `${id} should be L63 2.5%`);
  }
  for (const id of ["r-dragon-ring-1", "evil-dragon-bracelet-2", "evil-dragon-necklace-3"]) {
    assert.equal(chance(id), 0.0125, `${id} should be L66 1.25%`);
  }
  assert.equal(chance("black-tiger-hammer"), 0.075);
  assert.equal(chance("fan-of-crane"), 0.075);
  assert.equal(chance("staff-of-lotus"), 0.075);
  assert.equal(
    BOSS_DROP_TABLE_BY_LABEL["Frost Tiger"].items.find((item) => item.id === "evil-dragon-ring-1")?.chance,
    0.0125,
  );
});

test("Oma King L66 weapons are class-locked Wizard / Warrior / Taoist", () => {
  const byId = loadItemsById();
  const sword = byId.get("barbarian-sword");
  const pike = byId.get("slaughter-pike");
  const fan = byId.get("bone-carved-fan");
  assert.equal(sword?.class, "wizard");
  assert.equal(sword?.requirements?.classMask, 2);
  assert.equal(sword?.requirements?.amount, 66);
  assert.deepEqual(sword?.stats?.mc, [14, 41]);
  assert.equal(pike?.class, "warrior");
  assert.equal(pike?.requirements?.classMask, 1);
  assert.deepEqual(pike?.stats?.dc, [38, 90]);
  assert.equal(pike?.stats?.attackSpeed, 2);
  assert.equal(fan?.class, "taoist");
  assert.equal(fan?.requirements?.classMask, 4);
  assert.equal(fan?.name, "Bone Carved Fan");
  assert.equal(pike?.name, "Slaughter Pike");
});

test("Oma King L66 Evil Dragon jewellery is class-locked and named Evil Dragon", () => {
  const byId = loadItemsById();
  const expected = [
    ["r-dragon-ring-1", "Evil Dragon Ring", "warrior", 1, [5, 23], "dc"],
    ["r-dragon-ring-2", "Evil Dragon Ring", "wizard", 2, [4, 23], "mc"],
    ["r-dragon-ring-3", "Evil Dragon Ring", "taoist", 4, [4, 19], "sc"],
    ["evil-dragon-bracelet-1", "Evil Dragon Bracelet", "warrior", 1, [10, 20], "dc"],
    ["evil-dragon-bracelet-2", "Evil Dragon Bracelet", "wizard", 2, [8, 18], "mc"],
    ["evil-dragon-bracelet-3", "Evil Dragon Bracelet", "taoist", 4, [8, 18], "sc"],
    ["evil-dragon-necklace-1", "Evil Dragon Necklace", "warrior", 1, [8, 19], "dc"],
    ["evil-dragon-necklace-2", "Evil Dragon Necklace", "wizard", 2, [6, 19], "mc"],
    ["evil-dragon-necklace-3", "Evil Dragon Necklace", "taoist", 4, [6, 19], "sc"],
  ];
  for (const [id, name, cls, mask, range, key] of expected) {
    const item = byId.get(id);
    assert.ok(item, `expected ${id}`);
    assert.equal(item.name, name);
    assert.equal(item.class, cls);
    assert.equal(item.requirements?.classMask, mask);
    assert.equal(item.requirements?.amount, 66);
    assert.deepEqual(item.stats?.[key], range);
  }
  assert.equal(byId.get("evil-dragon-ring-1")?.name, "Red Dragon Ring");
  assert.equal(byId.get("evil-dragon-ring-1")?.requirements?.amount, 63);
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
