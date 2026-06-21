# Core Migration Plan (in-place, not a rewrite)

This is the agreed engineering direction for making LOM Idle maintainable,
testable, and season-ready **without** rewriting the game. It is the "how and in
what order" companion to `docs/season-play-architecture.md` (the "why and what").

## Decision

Evolve the existing game in place by extracting a pure simulation **core** out of
`src/app.monolith.js`, one tested slice at a time. Do **not** freeze the project
and rebuild a parallel "V3".

### Why in-place wins here

- The simulation already runs **headless**. `tick()` separates
  `runSimulationStep(now)` from `render()`; `catchUpSimulation()` runs
  `runSimulationStep` in a loop with `suppressSimulationRender = true`; and
  `simulateOfflineProgress` / `applyOfflineProgress` advance the whole game with
  no renderer. The hard part of a sim/render split is therefore *already done* -
  the coupling is "shared mutable `state` + sprinkled side-effects", not
  "rendering fused into the rules".
- The successful extractions (`battleData`, `warriorMagic`, `buffPotions`,
  `bossDrops`, `groupDungeonSwarm`, `zumaArcherSwarm`) are the **most stable,
  tested** code in the repo. The pattern works.
- The one split that failed (`src/game/`) failed because it was a **parallel dead
  copy the browser never ran** (see `AI_HANDOFF.md`). That is a process mistake,
  not evidence that extraction is dangerous. The rule below prevents repeating it.
- The 30k-line monolith encodes years of settled edge cases (offline catch-up,
  boss-party fights, swarm dungeons, save migration, combat timing, the FX/anim
  phase machine). A rewrite re-opens all of those closed bugs; extraction keeps
  them closed.
- The renderer/UI already works and is the most tedious thing to rebuild. A
  rewrite throws away the working part to fix the broken part.

### The one rule that makes this safe

**Only extract into a module that the live `src/app.js -> app.monolith.js` chain
imports and actually runs.** Never create a parallel tree. After every extraction,
the monolith imports the new module and calls it; the old inline code is deleted
in the same change. If a file is not reachable from `src/app.js`, editing it does
nothing.

## Long-term goal

A single **engine-agnostic simulation core** that both runtimes share:

```
            +-------------------------+
            |   core/  (pure rules)   |   no DOM, no canvas, no localStorage,
            |  combat, xp, drops,     |   no Audio, no performance.now()
            |  offline, smith/refine  |   deterministic given (state, input, rng, clock)
            +------------+------------+
                         |
        +----------------+-----------------+
        |                                  |
+-------v--------+                 +--------v---------+
|  Browser shell |                 |  Server (Worker) |
|  renderer + UI |                 |  Season authority|
|  + localStorage|                 |  + D1 storage    |
|  (Solo Play)   |                 |  (Season Play)   |
+----------------+                 +------------------+
```

- **Solo Play** stays exactly as today: local save, instant iteration, client runs
  the core. Players may edit local state; Solo progress is never leaderboard-verified.
- **Season Play** (later): the server runs the *same* `core/` to own state and
  validate client *intentions* (the action list in `season-play-architecture.md`).
  Cheat-resistant because the browser is never authoritative.

The core must be **deterministic**: same `(state, action, seededRng, clock)` in,
same state out. That single property is what lets the server replay/validate and
what makes the rules unit-testable without a browser.

## Target layers (destination, reached gradually)

- `src/core/` - pure rules. Combat resolution, XP/leveling, drop rolls, potion
  ticks, smith/refine odds, offline progress. Input: state + action + injected
  rng + injected clock. Output: new state + a list of **events**.
- `src/data/` - already exists. Items, zones, monsters, drops, spells (shared by
  client and server). Keep growing this; prefer data over logic.
- `src/persistence/` - save load/migrate (the `sanitize*` / `restore*` family),
  separated from rules.
- shell (stays in `app.monolith.js` for now) - renderer, canvas, UI, input,
  audio, `requestAnimationFrame`. Consumes core events; never computes rules.
- `tools/stats-worker/` - already exists. Becomes the season authority by importing
  `src/core/` once the core is engine-agnostic.

### The event seam (how we de-couple side-effects)

Today the rules call `pushBattleLog(...)`, `playSfx(...)`, and write frame
counters inline. The core can't do that on a server. So core functions will
**return events** instead of performing I/O:

```
{ type: "damage", target: "enemy", amount: 42, crit: false }
{ type: "sfx", key: "weapon.hit.sword" }
{ type: "log", text: "..." }
{ type: "levelUp", level: 13 }
{ type: "drop", itemId: "...", qty: 1 }
```

The browser shell turns events into sound/animation/DOM. The server turns the
same events into authoritative state changes and discards the cosmetic ones. This
is the key refactor that makes the core runnable anywhere.

## Phased plan

Each phase ships independently, keeps the game playable, and lands with
`npm run check` green (plus `npm run smoke` for monolith changes).

### Phase 0 - Safety net (do first, cheap, high value)

Add **characterization tests** that pin current behavior before moving any code,
focused on what keeps breaking and what's about to move:

- save round-trip + migration: load an old save snapshot, assert normalized shape
  (guards the `sanitize*`/`restore*` family).
- offline progress determinism: given a fixed start state + elapsed + seeded rng,
  `simulateOfflineProgress` yields a stable result.
- combat math already in modules (extend existing `battleData`/`warriorMagic` tests).

Deliverable: a `tests/` suite that fails loudly if an extraction changes behavior.

### Phase 1 - Seed `src/core/` with already-pure logic

Move the genuinely pure helpers that still live in the monolith into
`src/core/` (e.g. drop-roll selection, XP application, attack-timing math that
isn't already in `battleData`). Monolith imports them back. No behavior change.

Deliverable: `src/core/` exists, is imported by the live game, and is unit-tested.
Validates the premise at low cost. **If this proves painful or `state` is too
tangled to separate, that is the real signal to reconsider a rewrite - and we'll
have learned it in days, not months.**

### Phase 2 - Introduce the event seam in combat

Refactor `playerAttack` / `enemyAttack` / spell casts so the damage/drop/log/sfx
decisions are computed by `src/core/` returning events, and the monolith applies
them (sound, animation, battle log). Combat keeps behaving identically; the rules
become I/O-free.

Deliverable: combat outcomes computed by a headless, tested core; shell only
renders the events.

### Phase 3 - Offline + drops + smith/refine through the core

Route offline catch-up, zone/boss drops, and smith/refine odds through
`src/core/`. These are the systems a season server must own and validate.

Deliverable: every "progress-affecting" calculation lives in the testable core.

### Phase 4 - Persistence split

Lift `sanitize*` / `restore*` into `src/persistence/`. Solo uses it against
localStorage; Season later uses the same shapes server-side.

### Phase 5 - Season authority (separate, opt-in mode)

Import `src/core/` into the Worker. Client sends intentions; server runs the core,
owns state, and feeds the leaderboard. Solo Play is untouched. See
`season-play-architecture.md` for the intention list and item-instance model.

## Guardrails (every phase)

- The live chain is `src/app.js -> app.monolith.js -> src/core/ + src/data/ + ...`.
  A module not in that chain does nothing - never make a parallel copy.
- `npm run check` must pass (lint + monolith syntax + tests). For monolith
  changes also run `npm run smoke`. For release changes, `npm run release:itch`
  must boot-verify green.
- Preserve saves: extend `sanitize*` / `restore*`, never silently drop fields.
- Prefer data (`src/data/`) over logic. Keep packaging copy-only.
- One slice per change, each with tests. No big-bang.

## What we explicitly are NOT doing

- Not freezing the game and building a blank "V3".
- Not rewriting the renderer/UI (it works; it's the expensive thing to rebuild).
- Not recreating `src/game/`.
- Not adding a package-time atlas rebuild (packaging stays copy-only).

## When to revisit the rewrite question

Switch strategy only if: Phase 1 proves `state` genuinely cannot be separated from
render/animation concerns; OR the visual engine itself is changing (new art style
/ WebGL); OR seasons replace local saves entirely (back-compat pressure drops). In
all three the extraction work so far is still reusable, so starting here loses
nothing.
