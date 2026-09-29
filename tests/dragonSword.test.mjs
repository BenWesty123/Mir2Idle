import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.join(import.meta.dirname, "..");

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

test("Dragon Sword equips on Max DC 30, matching Crystal RequiredType.MaxDC", () => {
  const item = (loadJson("src/data/items.json").items ?? []).find((entry) => entry.id === "dragon-sword");
  assert.ok(item, "expected dragon-sword in items.json");
  assert.equal(item.requirements?.type, "maxDC");
  assert.equal(item.requirements?.amount, 30);

  const crystal = (loadJson("src/data/crystal-items.json").items ?? []).find(
    (entry) => entry.crystalIndex === 245 && entry.name === "DragonSword",
  );
  assert.ok(crystal, "expected Crystal DragonSword at index 245");
  assert.equal(crystal.requiredType, 3, "Crystal RequiredType.MaxDC");
  assert.equal(crystal.requiredAmount, 30);
});
