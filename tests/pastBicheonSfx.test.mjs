import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sfx = JSON.parse(fs.readFileSync(
  new URL("../public/audio/sfx/manifest.json", import.meta.url),
  "utf8",
));

// Past Bicheon Idle templates use Crystal image index as monsterIndex.
const PAST_BICHEON = [
  { name: "Axe Oma", index: 118 },
  { name: "Sword Oma", index: 119 },
  { name: "Crossbow Oma", index: 120 },
  { name: "Winged Oma", index: 121 },
  { name: "Flail Oma", index: 122 },
  { name: "Oma Guard", index: 123 },
  { name: "Oma King", index: 126 },
  { name: "Frost Tiger", index: 102, range: true },
];

test("Past Bicheon monsters have attack/flinch/death SFX", () => {
  for (const monster of PAST_BICHEON) {
    for (const kind of ["attack", "flinch", "death"]) {
      const key = `monster.${monster.index}.${kind}`;
      const entry = sfx.byKey[key];
      assert.ok(entry?.src, `${monster.name} missing ${key}`);
      const slot = { attack: 1, flinch: 2, death: 3 }[kind];
      assert.equal(entry.sourceFile, `${String(monster.index).padStart(3, "0")}-${slot}.wav`);
    }
    if (monster.range) {
      const key = `monster.${monster.index}.range`;
      assert.ok(sfx.byKey[key]?.src, `${monster.name} missing ${key}`);
    }
  }
});
