# AI Handoff - LOM Idle V2

This file is the shared project context for any AI or developer working on this repo. Read it before making changes.

## Source Of Truth

Working folder:

`C:\Users\bb-we\Documents\LOM Idle Backup\lom-idle-v2 - Cursor`

Use this folder as the active project unless Ben says otherwise.

Do not treat older Codex folders or built `dist` output as the source of truth.

## Project Goal

LOM Idle V2 is a browser-based idle prototype inspired by the Crystal/Mir2 files. The aim is a playable public prototype with:

- Multiple local characters/classes: Warrior, Wizard, Taoist.
- Zone-based idle combat.
- Boss/KR fights with respawn timers.
- Group hunts and future multi-character boss assists.
- Inventory, equipment, drops, shop, storage, mining, refining, spells, potions, saves, offline progress, sound, and Crystal-style UI.

## Current High-Level Status

The project has moved from a single large script into a modular structure under `src/game/`.

Important files and folders:

- `src/app.js` - entry point; imports the game module index.
- `src/app.monolith.js` - older/reference monolith. Avoid editing unless intentionally syncing old logic.
- `src/game/index.js` - module import order and bootstrap entry.
- `src/game/runtime.js` - shared state/constants/data definitions.
- `src/game/gameApi.js` - cross-module `G` registry.
- `src/game/modules/` - main game systems.
- `src/data/items.json` - item data.
- `src/phase1Data.js` - zones, drops, monsters, and progression data.
- `public/` - runtime assets.
- `tools/` - build/audit/export/release tools.
- `dist/` - generated output. Do not manually edit as source.

## Important Development Rules

- Preserve player saves whenever possible.
- Do not remove old item definitions just because drops changed; players may already own them.
- Do not edit generated `dist/itch` output as source.
- Prefer changing source files under `src/`, `public/`, and `tools/`.
- Run checks after meaningful changes.
- Be careful with boss-party code; it is complex and easy to regress.
- Keep class systems consistent where possible. Warrior, Wizard, and Taoist skills should share the same manual/auto/passive rules unless there is a deliberate exception.
- If changing drops, item stats, class stats, spell damage, monster stats, or Crystal-derived values, check the Crystal/source data rather than guessing.
- If changing save structure, add compatibility/migration logic.

## Commands

Common dev commands:

```powershell
cd "C:\Users\bb-we\Documents\LOM Idle Backup\lom-idle-v2 - Cursor"
npm.cmd run dev
```

If PowerShell blocks npm scripts, use:

```powershell
npm.cmd run dev
```

Useful checks:

```powershell
npm.cmd run check
npm.cmd run audit:itch
npm.cmd run verify:itch
```

Release-related scripts may include:

```powershell
npm.cmd run audit:release
npm.cmd run release:itch
```

If `audit:release` reports item icons missing, check whether it is a path-normalisation false positive involving paths like `./public/item-icons/...` before assuming assets are genuinely missing.

## Architecture Notes

The current module split uses a shared registry:

```js
export const G = {};
```

Modules attach functions to `G` and call across systems through it. This is pragmatic after splitting the old monolith, but it means missing dependencies can be hidden until runtime. When changing one module, search for related `G.someFunction` reads/writes.

Likely system locations:

- Combat loop: `src/game/modules/combat.js`
- Boss party / boss KR fights: `src/game/modules/bossParty.js`
- Group hunts / Black Dragon Dungeon: `src/game/modules/groupDungeon.js`
- Mining: `src/game/modules/mining.js`
- Inventory/equipment/refining/shop/storage: `src/game/modules/inventory.js`
- Town/NPC scenes: `src/game/modules/town.js`
- Save/load/migrations: `src/game/modules/persist.js`
- Offline progress: `src/game/modules/offline.js`
- Rendering/UI: `src/game/modules/render.js`, `src/game/modules/draw.js`
- Audio/SFX/music: `src/game/modules/audio.js`
- Stats/leaderboard tracking: `src/game/modules/stats.js`
- Zones/progression: `src/game/modules/zone.js`

## Known Larger Systems

### Boss Fights

Boss/KR fights now include more fleshed-out logic, respawn timers, party/assist concepts, drops, visuals, sounds, and offline hooks. Treat this system carefully. Bugs here can affect combat, save state, rewards, pets, and UI.

### Group Hunts

Black Dragon Dungeon is the first basic group hunt. It appears to be wave/swarm based, with monsters approaching the party. It may need balance and design work before it feels rewarding.

### Mining And Refining

Mining exists as a mode reached through the Refiner. Mining rolls ore/purity. Refining uses weapon + ore + jewellery + gold and can fail/break the weapon.

### Future Season Play

Solo play currently uses local saves and is not cheat-proof. Future season play should be server-authoritative if leaderboards/rewards matter. There is/was planning around keeping solo local and adding season play later.

## Current Things To Watch

- Package size and itch file count as assets grow.
- Save compatibility as more account/character-wide systems are added.
- Boss-party regressions.
- Class skill logic diverging between Warrior/Wizard/Taoist.
- Drop balance across zones and KR bosses.
- Group dungeon XP/reward balance.
- Any release audit false positives caused by path handling.

## Before Starting Work

1. Read this file.
2. Read `AI_TASK_LOG.md`.
3. Inspect the relevant source files before editing.
4. Run the appropriate checks after editing.
5. Add a short entry to `AI_TASK_LOG.md` describing what changed, what was checked, and any remaining risk.
