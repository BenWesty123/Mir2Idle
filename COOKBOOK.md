# COOKBOOK - common changes, step by step

Copy-paste recipes for the most common edits. Prefer these data edits over changing logic in `src/app.monolith.js`.

Golden rule: **copy an existing entry and change the values** rather than inventing new fields. After any change run `npm.cmd run check`, then `npm.cmd run dev` and load http://localhost:4177 to confirm.

---

## 1. Add or change an item

File: `src/data/items.json` (array under `items`).

1. Find an existing item of the same kind (weapon, armour, ring, potion, ...).
2. Copy its whole `{ ... }` entry and paste it as a new array element.
3. Change at least its `id` (must be unique) and `name`. Adjust stats/icon as needed.
4. Run `npm.cmd run check` (the drop-data test validates ids/chances).

Do not delete or rename existing item `id`s - players may already own them. Add new ones instead.

---

## 2. Make an item drop in a zone (or tune its rate)

Zone drops are data-driven: each item carries its own drop info in `src/data/items.json`.

```jsonc
{
  "id": "leather-boots",
  "name": "Leather Boots",
  // ...other fields...
  "drop": {
    "zones": ["zone-bone-cave-1"],          // zones this item can drop in
    "chances": { "zone-bone-cave-1": 0.05 }, // per-zone chance (0..1)
    "enemyChances": {                          // OPTIONAL: per-enemy override
      "42": { "zone-bone-cave-1": 0.1 }       // enemy id 42 -> 10% in that zone
    }
  }
}
```

- To make an item drop somewhere, add the zone id to `drop.zones` and a chance in `drop.chances`.
- `chance` is a probability per kill, `0`..`1`. Keep it in that range (a test enforces this).
- Find valid zone ids in `src/phase1Data.js` (`PHASE1_ZONES`).

---

## 3. Add or tune a BOSS drop

File: `src/bossDrops.js`. The tables live in `BOSS_DROP_TABLE_BY_LABEL`, keyed by the boss's display label (e.g. `"Wooma Taurus"`). Each table looks like:

```js
const WOMA_TAURUS_BOSS_DROPS = {
  gold: 20000,
  // benedictionOils: 2,    // optional; guaranteed Benediction Oils on kill (defaults to 1)
  items: [
    { id: "great-axe", chance: 0.3 },
    { id: "dragon-sword", chance: 1 / 55 },
    ...bossGemDrops(0.05),   // shared helper: every gem at 5%
    ...bossOrbDrops(0.01),   // shared helper: every orb at 1%
  ],
};
```

- To tune a rate, edit a `{ id, chance }` line. `chance` is the per-kill probability in `(0, 1]`.
- Every `id` must exist in `items.json`. The unit tests (run by `npm.cmd run check`) verify every id exists and every chance is in range, so a typo fails the build instead of silently never dropping.
- `bossGemDrops()` / `bossOrbDrops()` expand to all gems/orbs at the given rate - reuse them instead of pasting 12 lines.
- Which enemy uses which table is decided by `bossDropTableForEnemy(...)` in `src/app.monolith.js` (the `isXEnemy` checks). Add a new boss only if a matching enemy predicate exists.

---

## 4. Add or edit a zone

File: `src/phase1Data.js` (`PHASE1_ZONES`).

1. Copy an existing zone object, paste it, give it a unique `id`.
2. Adjust its fields (name, monsters, mapSet, etc.) to match the template you copied.
3. Reference the new zone id from item `drop.zones` (recipe 2) if it should drop loot.

---

## 5. Tune XP / leveling or damage formulas

File: `src/battleData.js` (pure, unit-tested functions): `crystalExperienceForLevel`, `rollDamage`, `rollStat`, `statRange`.

- Change the formula, then update/add a test in `tests/` so the intended behaviour is locked in.
- `npm.cmd run check` runs the tests.
- `TESTING_XP_MULTIPLIER` near the top of `app.monolith.js` must be `1` for any release build.

---

## 6. Verify your change

```powershell
npm.cmd run check    # lint + syntax-check the live monolith + unit tests
npm.cmd run dev      # then open http://localhost:4177 and confirm in-game
```

If `check` fails, read the first error - the linter points at the exact file/line (e.g. a duplicate declaration or a typo).
