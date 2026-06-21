import test from "node:test";
import assert from "node:assert/strict";
import {
  finiteNumberOrNull,
  itemUsesEntryDurability,
  sanitizeCharacterBattleState,
  sanitizeEntryDurability,
  sanitizeHotbarState,
  sanitizeMagicState,
  sanitizeWeaponRefineLevel,
  WEAPON_REFINE_MAX,
} from "../src/persistence/sanitizeCharacter.js";

test("finiteNumberOrNull", () => {
  assert.equal(finiteNumberOrNull(null), null);
  assert.equal(finiteNumberOrNull(""), null);
  assert.equal(finiteNumberOrNull("12.5"), 12.5);
  assert.equal(finiteNumberOrNull("nope"), null);
});

test("sanitizeWeaponRefineLevel clamps to weapon refine max", () => {
  assert.equal(sanitizeWeaponRefineLevel(-1), 0);
  assert.equal(sanitizeWeaponRefineLevel(WEAPON_REFINE_MAX + 5), WEAPON_REFINE_MAX);
});

test("sanitizeEntryDurability: null for stackables and zero-dura items", () => {
  const stackable = (item) => item.stackable === true;
  assert.equal(sanitizeEntryDurability({}, { id: "potion", stackable: true }, stackable), null);
  assert.equal(sanitizeEntryDurability({}, { id: "sword", durability: 0 }, stackable), null);
});

test("sanitizeEntryDurability: clamps current dura", () => {
  const stackable = () => false;
  const item = { id: "sword", durability: 100 };
  assert.deepEqual(
    sanitizeEntryDurability({ currentDura: 150, maxDura: 80 }, item, stackable),
    { maxDura: 80, currentDura: 80 },
  );
});

test("sanitizeHotbarState: drops missing or equipped entries", () => {
  const result = sanitizeHotbarState(
    { slots: ["e1", "e2", "e3"] },
    ["e1", "e3"],
    ["e1"],
    3,
  );
  assert.deepEqual(result.slots, [null, null, "e3"]);
});

test("sanitizeMagicState: filters invalid spells and clamps levels", () => {
  const result = sanitizeMagicState(
    {
      learned: {
        Fury: { level: 9, experience: -5, autoCast: true, learnedAt: 100 },
        FakeSpell: { level: 1 },
      },
    },
    (spellId) => spellId === "Fury",
    3,
  );
  assert.deepEqual(Object.keys(result.learned), ["Fury"]);
  assert.equal(result.learned.Fury.level, 3);
  assert.equal(result.learned.Fury.experience, 0);
  assert.equal(result.learned.Fury.autoCast, true);
  assert.equal(result.learned.Fury.castReadyAt, 0);
});

test("sanitizeCharacterBattleState: normalizes battle snapshot fields", () => {
  const result = sanitizeCharacterBattleState({
    running: false,
    paused: true,
    playerHp: "42",
    playerMp: "",
    potHealthAmount: 3.7,
    statBuffs: [],
  });
  assert.equal(result.running, false);
  assert.equal(result.paused, true);
  assert.equal(result.playerHp, 42);
  assert.equal(result.playerMp, null);
  assert.equal(result.potHealthAmount, 3);
});

test("itemUsesEntryDurability", () => {
  const stackable = (item) => item.type === "stack";
  assert.equal(itemUsesEntryDurability({ type: "stack", durability: 10 }, stackable), false);
  assert.equal(itemUsesEntryDurability({ type: "weapon", durability: 10 }, stackable), true);
});
