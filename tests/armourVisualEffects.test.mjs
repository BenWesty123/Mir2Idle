import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ARMOUR_WING_EFFECT_ITEM_IDS,
  ARMOUR_VISUAL_EFFECT_ITEM_IDS,
  ARMOUR_SPECIAL_EFFECT_DEFS,
  armourVisualEffectForItem,
  LEVEL_EFFECT_VISUAL_BASE,
} from "../src/armourVisualEffects.js";
import {
  LEVEL_EFFECT_ARMOUR_ASSIGNMENTS,
  levelEffectVisualIdForKey,
} from "../src/levelVisualEffects.js";

function loadItem(id) {
  const data = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "..", "src", "data", "items.json"), "utf8"),
  );
  return (data.items ?? []).find((item) => item.id === id) ?? null;
}

test("oma-king-robe has no native armour effect when visualEffect unset", () => {
  const effect = armourVisualEffectForItem({
    id: "oma-king-robe",
    slot: "armour",
  });
  assert.equal(effect, null);
});

test("oma-king-armour plays Crystal effect 100", () => {
  const item = loadItem("oma-king-armour");
  assert.ok(item, "expected oma-king-armour in items.json");
  assert.equal(item.visualEffect, 100);
  assert.equal(item.requirements?.amount, 63);
  const effect = armourVisualEffectForItem(item);
  assert.equal(effect?.kind, "special");
  assert.equal(effect?.id, 100);
  assert.equal(effect?.label, "Oma King Armour");
  assert.equal(ARMOUR_SPECIAL_EFFECT_DEFS[100]?.atlasPath, "./public/armour-effects/oma-king-robe/atlas.json");
});

test("heaven-armour (Heaven Robe) wing effect stays disabled", () => {
  assert.equal(ARMOUR_WING_EFFECT_ITEM_IDS.has("heaven-armour"), false);
  const effect = armourVisualEffectForItem({
    id: "heaven-armour",
    slot: "armour",
    visualEffect: 1,
  });
  assert.equal(effect, null);
});

test("winged-heaven-armour resolves Crystal wing effect 1", () => {
  assert.equal(ARMOUR_WING_EFFECT_ITEM_IDS.has("winged-heaven-armour"), true);
  const effect = armourVisualEffectForItem({
    id: "winged-heaven-armour",
    slot: "armour",
    visualEffect: 1,
  });
  assert.equal(effect?.kind, "wing");
  assert.equal(effect?.effectId, 1);
  assert.equal(effect?.index, 0);
});

test("black dragon effect 101 resolves when visualEffect is set on item", () => {
  const effect = armourVisualEffectForItem({
    id: "black-dragon-armor-m-1",
    slot: "armour",
    visualEffect: 101,
  });
  assert.equal(effect?.kind, "special");
  assert.equal(effect?.id, 101);
});

test("level effect auras resolve from visualEffect ids 200+", () => {
  const phoenixId = levelEffectVisualIdForKey("phoenix");
  assert.equal(phoenixId, LEVEL_EFFECT_VISUAL_BASE + 8);
  const effect = armourVisualEffectForItem({
    id: "oma-king-robe",
    slot: "armour",
    visualEffect: phoenixId,
  });
  assert.equal(effect?.kind, "special");
  assert.equal(effect?.label, "Phoenix");
  assert.match(effect?.atlasPath ?? "", /level-effects\/phoenix\/atlas\.json$/);
});

test("level effect assignments are opt-in per armour", () => {
  assert.deepEqual(LEVEL_EFFECT_ARMOUR_ASSIGNMENTS, {});
  assert.equal(ARMOUR_VISUAL_EFFECT_ITEM_IDS.size, 0);
});
