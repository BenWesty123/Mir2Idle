# Collaboration boundaries (two developers)

<!--
This is the Antigravity-native copy of the collaboration rule (mirrors
.cursor/rules/collaboration-boundaries.mdc for the Cursor user). Antigravity
auto-loads rules from this .agents/rules/ folder. If it is not applied
automatically, open the Customizations -> Rules panel and set this rule to
"Always On".
-->

This repo is worked on by two people, each with their own AI assistant. To avoid
breaking each other's work in the single-file monolith (`src/app.monolith.js`),
work is split by AREA. **Before editing, determine which developer you are
assisting and stay inside that developer's area.**

If you are unsure which developer you are assisting, ASK. Do not assume.

## Roles

- **Owner / logic developer (Westy):** owns all gameplay logic, data, and
  systems. This is the default role.
- **UI / visual contributor:** owns ONLY the UI and visual presentation. Their
  AI must NOT touch gameplay logic, data, or systems.

---

## If you are the UI / visual contributor's AI

You may ONLY change how the game LOOKS and how UI is laid out / drawn. You may
NOT change how the game BEHAVES, its numbers, its data, or its saved state.

### ALLOWED (UI / visual area)
- Canvas/stage rendering and draw functions in `src/app.monolith.js`, e.g.
  `drawBackdropGradient` and the canvas draw code (~line 28307+), sprite/frame
  drawing, colors, gradients, visual FX/particles, layout math for what's drawn.
- UI panel + window building/layout in `src/app.monolith.js`, e.g.
  `renderGamePanel` (side panel UI), `renderSceneOverlay`
  (Character/Inventory/Upgrades/Shop/Storage windows), and other `render*` /
  UI-building helpers: markup, CSS/style strings, class names, spacing, fonts,
  icons, button placement, tooltip presentation.
- Item / paper-doll icon ART and the atlas code that merges it:
  `applyItemIconAtlas`, `applyStateItemAtlas`, and the committed atlas artifacts
  in `public/` (`public/item-icons/*`, `public/ui/character/stateitems-atlas.*`).
  Regenerate atlases with `npm run build:item-atlas` /
  `npm run build:stateitem-atlas` after changing icon images (see AGENTS.md).
- Other art/assets under `public/` (images, UI chrome), and `index.html` /
  page-level styling for presentation only.

### OFF-LIMITS (logic developer's area - do NOT edit)
- Combat and battle loops: `updateBattle`, `playerAttack`, `enemyAttack`,
  `tick` (main game loop), boss-party fights (`beginBossPartyFight`,
  `updateBossPartyBattle`), swarm/dungeon logic.
- Drops, loot, and economy: `rollZoneDrops`, `zoneDropCandidates`,
  `bossDropTableForEnemy`, `rollBossTableDrops`, gold/XP logic.
- Progression & systems: `applyOfflineProgress`, `simulateOfflineProgress`,
  spawning (`spawnNextEnemy`), zone entry (`enterZone`), tuning constants,
  `ACCOUNT_UPGRADE_DEFS`, `BOSS_ROOM_DEFS`, `TESTING_XP_MULTIPLIER`.
- Inventory/equipment LOGIC (`addInventoryItem`, equip logic) - you may restyle
  how inventory looks, but not change slot counts, stacking, or item behavior.
- Saves & migration: `saveGameState`, `loadSavedGameState`, `import*`, and every
  `sanitize*` / `restore*` function. Never change save structure.
- Input wiring `bindControls` and event handlers that drive game actions
  (you may adjust the visual result, not what an action does).
- ALL sibling data/logic modules and data files:
  `src/data/*.json`, `src/bossDrops.js`, `src/battleData.js`,
  `src/warriorMagic.js`, `src/phase1Data.js`, `src/playerActions.js`,
  `src/spellBodyActions.js`, `src/buffPotions.js`, `src/groupDungeonSwarm.js`,
  `src/zumaArcherSwarm.js`, `src/atlas.js`, `src/core/*`,
  `src/persistence/*`, and `tools/`.

### If a requested change is off-limits
STOP. Do not make the edit. Say clearly that the change is in the logic
developer's area and outside the UI/visual scope, explain briefly which
system/function it touches, and suggest either (a) a UI/visual-only alternative
that achieves the visible goal, or (b) coordinating with the owner via a Pull
Request. Getting a visual result must never be done by changing game logic,
numbers, data, or save behavior.

Line numbers drift - always locate code by function/const NAME (use the
`NAVIGATION MAP` comment block near the top of `src/app.monolith.js`).

---

## If you are the owner / logic developer's AI

You may work anywhere, but be considerate of in-flight UI work: prefer editing
DATA (JSON) and logic over rewriting large UI/render blocks, so merges stay
clean. Follow all other rules in `AGENTS.md`.

## Both roles - always
- Work on your own branch and merge to `main` via a Pull Request; never both
  commit straight to `main`.
- Run `npm run check` before pushing; for `app.monolith.js` changes also run
  `npm run smoke` (with `npm run dev` running).
- Keep branches short-lived and pull `main` often to minimize monolith conflicts.
