# AGENTS.md - LOM Idle V2

Browser-based Legend of Mir idle RPG. Vanilla JavaScript ES modules - no framework, no runtime dependencies - served by a small Node dev server.

## CRITICAL: one source of truth
The entire live game is **`src/app.monolith.js`** (~28k lines), loaded via **`src/app.js`**.

There is NO `src/game/` split anymore. It was a dead duplicate that the browser never ran, and it was deleted. **Never recreate it.** If you edit a file that is not in the `src/app.js` -> `app.monolith.js` -> sibling-modules import chain, your change does nothing.

## Run and verify
- Dev server: `npm run dev` (PowerShell: `npm.cmd run dev`), then open http://localhost:4177
- ALWAYS run before claiming a change is done: `npm run check` (lint + syntax-check the live monolith + unit tests). It must pass.
- For `app.monolith.js` changes, also run `npm run smoke` (with `npm run dev` running): it boots the game in headless Chromium and fails on any console/page error - the only automated catch for runtime regressions, which `check` cannot see.

## Releasing + cache-busting
- Package for itch.io: `npm run package:itch` (PowerShell: `npm.cmd run package:itch`).
- Cache-busting is AUTOMATIC. The packager re-stamps every `?v=` token with a fresh per-build timestamp - both the entry `<script>` in `index.html` and `src/app.js`'s `import "./app.monolith.js?v=..."`. **Do NOT hand-edit `?v=` strings.** The old "bump the cache-bust string in `app.js` and `index.html`" ritual is obsolete.
- In dev, `tools/server.mjs` sends `Cache-Control: no-store`, so the browser always re-fetches the latest source; the `?v=` value is irrelevant locally.

## Where things live
- Game logic + UI + rendering: `src/app.monolith.js` (see its `NAVIGATION MAP` comment, and the system map in `AI_HANDOFF.md`).
- Item data and their zone drops: `src/data/items.json`
- Boss loot tables: `src/bossDrops.js`
- Shared data/formulas: `src/battleData.js` (stats, damage, XP), `src/warriorMagic.js`, `src/phase1Data.js` (zones), `src/spellBodyActions.js`, `src/buffPotions.js`, `src/playerActions.js`, `src/groupDungeonSwarm.js`, `src/zumaArcherSwarm.js`, `src/atlas.js`
- Build/release/dev tools: `tools/`
- Unit tests: `tests/`
- Generated release output: `dist/` (never edit as source)

## Common tasks
See **`COOKBOOK.md`** for copy-paste recipes (add an item, tune a drop, add a boss drop, add a zone).

## House rules
- Preserve player saves; add migration logic when changing save structure.
- Prefer editing JSON data over monolith logic when possible.
- Don't edit `dist/` as source.
- Deeper context and change history: `AI_HANDOFF.md` and `AI_TASK_LOG.md` (add an entry to the log after meaningful changes).
