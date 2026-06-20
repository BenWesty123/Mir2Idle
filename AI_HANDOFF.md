# AI Handoff - LOM Idle V2

Shared project context for any AI or developer working on this repo. Read this and `AGENTS.md` before making changes, then read `AI_TASK_LOG.md` for recent history.

## Source of truth (most important section)

The entire live game is `src/app.monolith.js` (~28,000 lines). It is loaded like this:

```
src/app.js          ->  import "./app.monolith.js"
src/app.monolith.js ->  imports the sibling data/logic modules in src/
```

There is no `src/game/` directory. A modular `src/game/` split was attempted by an earlier AI, but it was never wired into the running app, drifted out of sync, and even contained a syntax error - so edits made to it never reached the browser. It was deleted in June 2026. **Do not recreate or "re-split" into `src/game/`.** (A proper, tested re-split is planned later as its own effort; until then the monolith is canonical.)

Rule of thumb: if a file is not reachable from `src/app.js`, editing it does nothing. Always confirm reachability before claiming a change works.

## Project goal

LOM Idle V2 is a browser-based idle prototype inspired by the Crystal/Mir2 files. The aim is a playable public prototype with:

- Multiple local characters/classes: Warrior, Wizard, Taoist.
- Zone-based idle combat.
- Boss/KR fights with respawn timers.
- Group hunts and multi-character boss assists.
- Inventory, equipment, drops, shop, storage, mining, refining, spells, potions, saves, offline progress, sound, and Crystal-style UI.

## Key files

- `src/app.js` - entry point; imports the monolith.
- `src/app.monolith.js` - the whole game (logic + UI + canvas rendering). Has a `NAVIGATION MAP` comment at the top. The live `state` object is declared here (search `const state = {`).
- `src/data/items.json` - item definitions and their zone-drop data (`item.drop.zones`, `item.drop.chances`, `item.drop.enemyChances`).
- `src/bossDrops.js` - boss loot tables (keyed by boss display label) plus pure validators; imported by the monolith and by the tests.
- `src/battleData.js` - player/enemy stats and the damage / XP / stat-roll formulas, plus the stat-object arithmetic helpers (`cloneStats`, `addStats`, `addRange`, `sanitizeItemBonusStats`). Pure functions; unit-tested.
- `src/warriorMagic.js`, `src/spellBodyActions.js` - spell/skill definitions and helpers.
- `src/phase1Data.js` - zones, mining spots, monster/progression data.
- `src/playerActions.js`, `src/groupDungeonSwarm.js`, `src/zumaArcherSwarm.js`, `src/buffPotions.js`, `src/atlas.js` - supporting data/logic imported by the monolith.
- `public/` - runtime assets (sprites, atlases, audio). Large; gitignored/cursorignored.
- `tools/` - build/audit/export/release tools and the dev server (`tools/server.mjs`).
- `tests/` - `node --test` unit tests, run by `npm run check`.
- `dist/` - generated release output. Never edit as source.

## System map inside `app.monolith.js`

Line numbers are approximate and drift - search by the function/const NAME. Boss loot tables now live in `src/bossDrops.js`, not here.

- Imports of sibling modules: top of file (~1-91)
- `TESTING_XP_MULTIPLIER` (must be 1 for release): ~124
- Tuning constants (inventory/storage sizes, boss respawn, boss-party combat, FX/lightning timings): ~124-640
- `ACCOUNT_UPGRADE_DEFS` (account/rebirth upgrades): ~163
- `BOSS_ROOM_DEFS` (boss rooms + "empower" config): ~353
- `init()` boot + asset loading (loads `items.json` etc.): ~2236
- Saves: `saveGameState`, `loadSavedGameState`, `exportGameSave`, `importGameSaveFromText`: ~2458
- Save migration / load normalisation: `sanitize*`, `restore*`: ~2500-3850
- Offline progress: `applyOfflineProgress` (~3853), `simulateOfflineProgress` (~4060)
- Audio: `syncBackgroundMusic` (~4900), `playSfx` (~5000)
- Inventory + equipment: `addInventoryItem` (~7306) and nearby
- `renderGamePanel` (side panel UI): ~11314
- `renderSceneOverlay` (Character/Inventory/Upgrades/Shop/Storage windows): ~11735
- `enterZone` (zone + teleport entry): ~14032
- `bindControls` (DOM input wiring): ~16861
- `tick()` MAIN GAME LOOP: ~17390
- Boss-party (KR) fights: `beginBossPartyFight` (~17532), `updateBossPartyBattle` (~18400)
- Boss drop selection: `bossDropTableForEnemy` (~21803), `rollBossTableDrops` just below - tables come from `src/bossDrops.js`
- Solo combat loop: `updateBattle` (~22369), `playerAttack` (~22531), `enemyAttack` (~25903)
- Zone drops: `rollZoneDrops` / `zoneDropCandidates`: ~26285
- `spawnNextEnemy`: ~26374
- Canvas drawing / stage rendering: `drawBackdropGradient` (~28307) onward

## Commands

```powershell
npm.cmd run dev      # dev server at http://localhost:4177
npm.cmd run check    # lint + syntax-check the live monolith + unit tests (run this before claiming done)
npm.cmd run smoke    # boot the game headless and fail on any console/page error (needs dev server running + playwright)
npm.cmd run package:itch
npm.cmd run verify:itch
```

`npm run check` only catches syntax/lint/unit-test problems - it does NOT prove the game boots. For changes to `app.monolith.js`, also run `npm run smoke` (in another terminal, with `npm run dev` running): it loads the game in headless Chromium and fails if there are any console or page errors. This is the only automated way to catch runtime/eval-order regressions in the monolith.

## Releasing + cache-busting

The game is shipped as a static HTML bundle to itch.io, whose CDN caches files for a long time keyed by their full URL (query string included). Stale caches are avoided with a `?v=` cache-bust token, handled in two different ways:

- **Local dev** (`tools/server.mjs`): every response is sent with `Cache-Control: no-store, max-age=0`, so the browser always re-fetches the latest source. The `?v=` value in `src/app.js` is irrelevant in dev - you never need to touch it.
- **Release** (`tools/package-itch.mjs`): `patchCacheBusting()` re-stamps every `?v=` token in the packaged HTML/JS with a fresh per-build timestamp (`buildVersion`). This covers both the entry `<script>` in `index.html` AND the in-source module import `src/app.js` -> `"./app.monolith.js?v=..."`, so a changed monolith can never be served from a stale cache. The JS stamp is anchored to a `.js`/`.mjs` specifier so it does NOT disturb the `?v=${MONSTER_ASSET_VERSION}` / `${MAP_STAMP_ASSET_VERSION}` asset URLs inside the monolith. If a required file (`index.html`, `src/app.js`) has no `?v=` token to stamp, the build fails loudly rather than shipping a stale-cache risk.

Practical rule: **do NOT hand-bump cache-bust strings.** Earlier task-log entries describe manually editing the `?v=` in `app.js`/`index.html` after every change - that ritual is now obsolete. Just edit code and run `npm.cmd run package:itch`.

## Verifying a change

1. Confirm the edited file is reachable from `src/app.js`.
2. `npm.cmd run check` must pass (lint + monolith syntax check + unit tests).
3. `npm.cmd run dev`, then `npm.cmd run smoke` (headless boot, fails on console/page errors). Then open http://localhost:4177 and confirm the change behaves as intended.
4. Add a short entry to `AI_TASK_LOG.md` (what changed, what was checked, any remaining risk).

## Important development rules

- Preserve player saves whenever possible. If you change save structure, add compatibility/migration logic in the `sanitize*` / `restore*` functions.
- Do not remove old item definitions just because drops changed; players may already own them.
- Do not edit generated `dist/` output as source.
- Be careful with boss-party code (`beginBossPartyFight` / `updateBossPartyBattle`); it is complex and easy to regress.
- Keep class systems consistent: Warrior, Wizard, and Taoist skills should share the same manual/auto/passive rules unless there is a deliberate exception.
- If changing drops, item stats, class stats, spell damage, monster stats, or Crystal-derived values, check the Crystal/source data rather than guessing.
- Prefer changing DATA (`src/data/*.json`, sibling data modules) over monolith logic when possible. See `COOKBOOK.md`.

## Things to watch

- Package size and itch file count as assets grow.
- Save compatibility as more account/character-wide systems are added.
- Boss-party regressions.
- Class skill logic diverging between Warrior/Wizard/Taoist.
- Drop balance across zones and KR bosses.
- Group dungeon XP/reward balance.

## Future season play

Solo play uses local saves and is not cheat-proof. Future season play should be server-authoritative if leaderboards/rewards matter. There is/was planning around keeping solo local and adding season play later (see `docs/season-play-architecture.md`).
