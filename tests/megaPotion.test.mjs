import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.join(import.meta.dirname, "..");

function loadItems() {
  return JSON.parse(fs.readFileSync(path.join(root, "src", "data", "items.json"), "utf8")).items ?? [];
}

function itemById(id) {
  return loadItems().find((entry) => entry.id === id) ?? null;
}

test("Mega Potion restores 200 HP + 250 MP over time at 350g", () => {
  const item = itemById("mega-potion");
  assert.ok(item, "expected mega-potion in items.json");
  assert.equal(item.name, "Mega Potion");
  assert.equal(item.type, "potion");
  assert.equal(item.shape, 0);
  assert.equal(item.stats.hp, 200);
  assert.equal(item.stats.mp, 250);
  assert.equal(item.shop.buy, 350);
  assert.equal(item.shop.sell, 70);
  assert.equal(item.potionFamily, undefined);
  assert.equal(item.drop, undefined);
  assert.equal(item.icon.frame, 1705);
  assert.equal(item.icon.src, "./public/item-icons/items/frame_001705.png");
});

test("Ultra Potion restores 250 HP + 300 MP over time at 450g", () => {
  const item = itemById("ultra-potion");
  assert.ok(item, "expected ultra-potion in items.json");
  assert.equal(item.name, "Ultra Potion");
  assert.equal(item.type, "potion");
  assert.equal(item.shape, 0);
  assert.equal(item.stats.hp, 250);
  assert.equal(item.stats.mp, 300);
  assert.equal(item.shop.buy, 450);
  assert.equal(item.shop.sell, 90);
  assert.equal(item.potionFamily, undefined);
  assert.equal(item.drop, undefined);
  assert.equal(item.icon.frame, 3319);
  assert.equal(item.icon.src, "./public/item-icons/items/frame_003319.png");
});
