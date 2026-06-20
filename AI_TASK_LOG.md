# AI Task Log - LOM Idle V2

Every AI/developer should add a short dated entry here after doing meaningful work.

Use this format:

```md
## YYYY-MM-DD - Name/Tool

### Changed
- ...

### Checked
- ...

### Notes / Risks
- ...

### Suggested Next Step
- ...
```

## 2026-06-16 - Codex

### Changed
- Created this shared AI handoff system.
- Created `AI_HANDOFF.md` as the project context file for future AI sessions.

### Checked
- Confirmed the intended working folder is `C:\Users\bb-we\Documents\LOM Idle Backup\lom-idle-v2 - Cursor`.

### Notes / Risks
- No game source files were changed in this entry.
- Any AI working here should read `AI_HANDOFF.md` and this log before making edits.

### Suggested Next Step
- Fix or verify the release audit path handling, then do a focused playtest/check pass before adding more major features.

## 2026-06-16 - Codex

### Changed
- Added persisted group dungeon offline run metadata.
- Routed group dungeon offline progress into a dedicated numeric simulator instead of compressed visual boss-party catch-up.
- The simulator advances BDD-style waves, applies party XP/gold sharing, auto-potion use, incoming damage, death checks, and the 8 hour offline cap.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- Drops were intentionally left alone.
- The simulator is designed for long-term group XP accuracy, not frame-perfect spell replay.
- Existing saves without group dungeon run metadata will still fall back to the older behaviour until the player enters BDD again and saves.

### Suggested Next Step
- Test closing/reopening during Black Dragon Dungeon and compare the offline report against live kill rate.

## 2026-06-16 - Codex

### Changed
- Fixed group XP offline simulation leaving the live BDD wave counter at the simulated wave.
- Offline group progress now awards XP/gold, syncs character state, then resets the visible group dungeon run for a fresh wave sequence.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- This keeps offline rewards, but avoids reopening BDD on Wave 4+ after returning/refreshing.
- The first visible wave is still internally wave 1; if the UI should literally say wave 0, that is a separate display/design change.

### Suggested Next Step
- Re-test: enter BDD, wait long enough for offline progress, close/reopen, confirm rewards apply and the visible wave sequence starts fresh.

## 2026-06-16 - Codex

### Changed
- Fixed the offline group simulator report flag being attached to the old catch-up path instead of the group-dungeon path.
- Positioned and preloaded offline-created BDD party members so assists render after closing/reopening.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- A very short offline window can still show 0 kills if the party genuinely would not finish a monster before returning.
- The visible BDD run should reset after offline progress is applied.

### Suggested Next Step
- Re-test BDD with a longer offline window and confirm party members remain visible after dismissing the offline report.

## 2026-06-16 - Codex

### Changed
- Restored saved group-hunt assist selections during save load before automatic zone battle startup.
- This fixes quick refresh rebuilding BDD as leader-only because pending assists were empty.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- This uses the saved groupDungeonRun class list only when the saved active zone is still that group dungeon.
- Returning to town still clears the run/assist restore path.

### Suggested Next Step
- Refresh while in BDD and confirm Warrior/Taoist/Wizard assists reappear immediately, even before offline progress triggers.

## 2026-06-16 - Codex

### Changed
- Made group-hunt party restore more defensive by storing groupDungeonRun on character game state as well as the top-level save snapshot.
- Added a load-time fallback that reads the active character's saved groupDungeonRun, then infers party members from characters saved as running in the same group dungeon if needed.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- If an already-damaged save has overwritten every assist character back to town/not-running, re-enter BDD with assists once to seed the marker.

### Suggested Next Step
- Re-enter BDD with assists once, wait for autosave, refresh, and confirm all party members return.

## 2026-06-16 - Group Dungeon Refresh Party Restore
- Fixed BDD/group dungeon refresh losing assist characters by preserving `game.groupDungeonRun` through character game sanitization.
- Added runtime/reset `groupDungeonRun` fields and restored `state.game.groupDungeonRun` during save load.
- Updated group dungeon location persistence so `state.game.groupDungeonRun` stays synchronized with the active party snapshot.
- Updated `beginBossPartyFight` to rebuild selected assists from a restored group dungeon run before falling back to pending boss-entry selections.
- Verification: `npm.cmd run check` passed. Background browser boot check at `http://localhost:4177/?ui=game&v=20260616-group-run-restore-check` had no console errors.
- Follow-up cleanup: `state.game.groupDungeonRun` is now explicitly cleared when leaving group content or entering non-group zones. Final verification: `npm.cmd run check` passed and background boot check at `?v=20260616-group-run-restore-final` had no console errors.

## 2026-06-16 - Group Dungeon Assist Selection Priority Follow-up
- User confirmed BDD refresh still restored only Taoist after entering with Warrior/Wizard assists.
- Fixed stale restored group runs overriding fresh boss-entry assist selections. `beginBossPartyFight` now uses `pendingBossAssistSelection` first, then falls back to restored `state.game.groupDungeonRun` only when no fresh assists were selected.
- `beginBossPartyFight` now writes a full `state.game.groupDungeonRun` immediately after class IDs are resolved, before the first character capture.
- Group party entry now force-saves immediately after `persistCharacterGameLocation`, so refreshing soon after entry should keep the selected party.
- Verification: `npm.cmd run check` passed.

## 2026-06-16 - Live Monolith Group Dungeon Refresh Fix
- Root cause found: live app runs `src/app.js -> src/app.monolith.js`; earlier fixes were applied only to experimental split files under `src/game/modules`, so the browser never used them.
- Ported group dungeon party persistence into `src/app.monolith.js`:
  - Added `groupDungeonOfflineRunSnapshot`, `sanitizeGroupDungeonOfflineRun`, and `savedGroupDungeonRunFromCharacters`.
  - Added top-level `groupDungeonRun` to save snapshots.
  - Preserved `game.groupDungeonRun` through character sanitization, active character apply, serialization, default character state, runtime state, and reset state.
  - Restored saved group runs in `applySaveSnapshot` and rebuilt pending assist selections from the saved party.
  - Updated `persistCharacterGameLocation` to save/clear group run state for group zones vs town/mining/normal zones.
  - Updated `beginBossPartyFight` so fresh assist selections override restored stale runs, then force-saves immediately after party creation.
- Added a temporary non-visual `window.__LOM_PARTY_DEBUG__()` hook to inspect live/saved party state while debugging. Remove before packaging if not needed.
- Updated `src/app.js` and `index.html` cache-bust strings to `20260616-group-party-restore` so the patched monolith loads immediately.
- Verification: `npm.cmd run check` passed twice; `node --check src/app.monolith.js` passed; server response for `/src/app.monolith.js` contains the hook and `pendingSelected` patch.

## 2026-06-16 - Codex

### Changed
- Fixed group/offline resume freezing party members by rebasing boss-party member action timers, animation clocks, spell cooldowns, pet timers, swarm enemy timers, and timed combat effects from simulated time back to live browser time.
- Bumped cache-bust strings to `20260616-offline-party-rebase`.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- This only changes resume timing after offline progress; it does not change offline rewards, drops, stats, or wave selection.

### Suggested Next Step
- Re-test BDD: enter with assists, refresh/close and reopen after offline progress, dismiss the report, and confirm all characters animate and act.
## 2026-06-17 - Codex

### Changed
- Fixed Firewall/ground spell visuals freezing after offline progress by rebasing `createdAt` from simulated time back to live browser time.
- Hardened ground spell frame calculation so future/stale timestamps cannot produce a negative frame index.
- Bumped cache-bust strings to `20260617-firewall-visual-rebase`.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- This only affects ground spell visual timing after offline resume; damage ticks and duration still use the existing rebased timers.

### Suggested Next Step
- Re-test with Wizard Firewall active during offline progress and confirm the fire animates immediately after dismissing the offline report.
## 2026-06-17 - Codex

### Changed
- Routed group dungeon offline progress through a numeric XP/gold simulator instead of replaying visual boss-party combat ticks.
- Added `groupDungeonRun` to pending offline progress for both saved offline loads and long browser catch-up.
- Resets visible group waves after offline rewards are applied so the player resumes a fresh active run.
- Bumped cache-bust strings to `20260617-group-offline-numeric`.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- Group XP floors still intentionally ignore item drops; this pass is about kill count/XP/gold accuracy.
- The simulator estimates party DPS numerically and should be much closer to live kill rate than the old visual replay path.

### Suggested Next Step
- Re-run the 5 minute live vs 5 minute offline comparison in BDD and compare kills again.
## 2026-06-17 - Codex

### Changed
- Fixed group offline reports showing `NaNs` by guarding numeric simulator HP, DPS, incoming damage, and elapsed-time math against non-finite values.
- Added safe fallbacks for stat ranges and enemy max HP in group offline simulation.
- Bumped cache-bust strings to `20260617-group-offline-nan-guard`.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- This is a robustness fix for the new numeric group simulator. If live/offline kill counts still differ after this, the next pass is calibration of the DPS estimate.

### Suggested Next Step
- Re-test closing BDD for 5 minutes and confirm the offline popup shows a real duration and nonzero simulated kills.
## 2026-06-17 - Codex

### Changed
- Added live group dungeon kill-pace tracking and persistence per character.
- Numeric group offline simulation now uses observed live kill interval for group XP floors when available, instead of only rough DPS estimates.
- When observed live pace exists, offline group simulation no longer invents incoming damage wipes for that sustain-proven floor.
- Bumped cache-bust strings to `20260617-group-offline-live-pace`.

### Checked
- Passed: `npm.cmd run check`.

### Notes / Risks
- A short live warmup is needed to collect at least two kill intervals before offline can use observed pace.
- This is deliberately scoped to group dungeon XP floors, not boss rooms.

### Suggested Next Step
- Run BDD live for a minute or two, then close for 5 minutes and compare offline kills against live pace.
## 2026-06-17 - Codex - group offline pace floor
- Issue: Group dungeon offline progress could report false defeat after roughly 1-2 minutes even though the same party survived live combat for 5+ minutes.
- Cause: the uncalibrated offline fallback simulated one enemy at a time and applied a rough incoming-damage model that does not account for live swarm overlap, Firewall ticks, healing, pets, positioning, or multi-target pressure.
- Change: group dungeon offline progress now prefers recorded live kill pace; when no sample exists yet, the fallback uses a swarm-adjusted kill time and does not apply the rough incoming damage model to endless group XP floors.
- Cache bust: 20260617-group-offline-pace-floor.
- Passed: `npm.cmd run check`.
## 2026-06-17 - Codex - group offline consumables
- Issue: Group dungeon offline progress awarded kills but did not spend MP or Taoist consumables such as amulets and poisons.
- Change: numeric group offline simulation now spends MP over simulated time for Warrior/Wizard/Taoist autocast skills, consumes Taoist amulets for Soul Fire Ball/summons/buffs, consumes green/yellow poison for Poisoning, and lets existing auto-MP potion logic react as MP drops.
- Change: when simulated spell resources run short, the group offline sim stops trusting observed live kill pace for the rest of that offline run and falls back to stat/resource-based pacing.
- UI: offline report now has a Consumables row separate from Potions.
- Cache bust: 20260617-group-offline-consumables.
- Checked: `npm.cmd run check` passed.
## 2026-06-17 - Codex - group wave reset on fresh entry
- Issue: Group dungeons could appear to start on a later wave after leaving/re-entering because `stopBattle()` persisted the active wave before clearing swarm state, and `beginBossPartyFight()` reused saved `groupDungeonRun.waveNumber`.
- Change: fresh group dungeon entry now resets saved run progress to wave 1 / 0 killed / non-endless every time, while still reusing the saved party member selection when present.
- Change: stopping an active group dungeon clears saved group run state for all party members before persisting the paused zone state.
- Cache bust: 20260617-group-wave-reset.
- Checked: `npm.cmd run check` passed.

## 2026-06-17 - Codex - group wave clear condition
- Issue: Group dungeons still jumped to wave 4 after entry because inishGroupDungeonWaveIfReady() treated all monsters being spawned/deployed as the wave being cleared.
- Cause: waves 1, 2, and 3 spawn their full quota immediately, making groupDungeonWaveOutstandingCount() zero even while those monsters were alive.
- Change: waves now advance only when killedThisWave >= targetThisWave; pending spawns still refill normally for larger waves.
- Cache bust: 20260617-wave-clear-fix.
- Checked: `npm.cmd run check` passed.

## 2026-06-18 - Codex - swarm Firewall placement
- Issue: Wizard FireWall in group swarm fights always anchored to the fixed melee/centre tile, so repeated casts did not spread fire to enemies standing on other cells.
- Change: group swarm FireWall now scores Crystal-style cross placements against living enemy reserved tiles, ignores tiles already covered by active FireWall, and casts at the center that covers the most currently uncovered enemies.
- Change: FireWall auto/queued gating in boss-party swarm fights now allows another cast while useful enemy tiles remain uncovered, but still falls back to other spells once all occupied enemy tiles are burning.
- Cache bust: `20260618-swarm-firewall-spread`.
- Checked: `npm.cmd run check` passed; browser booted `http://127.0.0.1:4177/?ui=game&v=20260618-swarm-firewall-spread` with no console errors.

## 2026-06-18 - Codex - group front camera
- Issue: In group dungeon content the camera followed the controlled character, so playing Wizard/Taoist at the back shifted the view away from the front line and enemy swarm.
- Change: group dungeon camera now anchors to the party melee front character slot when a boss party is active; solo/non-group content still follows the controlled player.
- Cache bust: `20260618-group-front-camera`.
- Checked: `npm.cmd run check` passed; browser booted `http://127.0.0.1:4177/?ui=game&v=20260618-group-front-camera` with no console errors.

## 2026-06-18 - Codex - condensed combat log
- Issue: Boss/group combat logs were flooded by every hit, miss, burn tick, and cast, making real fight events unreadable.
- Change: boss-party combat now condenses repeated damage/miss/resist/cast spam into one rolling `Combat:` summary line while leaving milestone events visible (waves, deaths, step-ups, loot, respawn, level up).
- UI: the rolling combat summary has a distinct framed style in the activity log, and important event lines get a slightly brighter treatment.
- Cache bust: `20260618-condensed-combat-log`.
- Checked: `npm.cmd run check` passed; browser booted `http://127.0.0.1:4177/?ui=game&v=20260618-condensed-combat-log` with no console errors.

## 2026-06-18 - Codex - quiet combat log
- Follow-up: removed the rolling `Combat:` summary row from boss/group logs after review; repeated hit/miss/burn/cast spam is now simply filtered out.
- Milestone event lines still remain visible (waves, defeats, falls, step-ups, loot, level ups, respawn/return messages).
- Cache bust: `20260618-quiet-combat-log`.
- Checked: `npm.cmd run check` passed; browser booted `http://127.0.0.1:4177/?ui=game&v=20260618-quiet-combat-log` with no console errors.

## 2026-06-18 - Codex - hide FireWall ground log
- Follow-up: filtered the noisy `FireWall burns on the ground.` message from boss/group activity logs.
- Cache bust: `20260618-hide-firewall-ground-log`.
- Checked: live `node --check src/app.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&v=20260618-hide-firewall-ground-log` with no console errors; full `npm.cmd run check` is currently blocked by existing split-module syntax error in `src/game/modules/coreD.js` (`entryZone` redeclared).

## 2026-06-18 - Codex - corpse underlay in stamped arenas
- Issue: in BDD/group dungeon stamped arenas, dead swarm enemies could render above living player characters because same-row entities were sorted left-to-right before kind rank could matter.
- Change: stamped arena rows now draw corpse entities as a dedicated underlay pass before sorting/drawing living party, pets, and enemies.
- Cache bust: `20260618-corpse-underlay`.
- Checked: live `node --check src/app.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&v=20260618-corpse-underlay` with no console errors.

## 2026-06-18 - Codex - inventory sort button
- Added a small `Sort` button to the Crystal inventory window.
- Sort behavior: merges matching partial stackable bag stacks, then reassigns non-equipped/non-hotbar bag slots by equipment type, requirement value, item name, item power, and instance id. Equipped items and hotbar entries are left alone.
- Cache bust: `20260618-inventory-sort`.
- Checked: `node --check src/app.js` and `node --check src/app.monolith.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260618-inventory-sort`, the Sort button was visible, and there were no console errors. Full `npm.cmd run check` is still blocked by existing split-module syntax error in `src/game/modules/coreD.js` (`entryZone` redeclared).

## 2026-06-18 - Codex - inventory trash confirmation
- Added destroy-by-dropping-outside: when carrying an inventory-origin item, clicking somewhere with no valid drop target now opens a confirm box before deleting it.
- Destroy behavior: deletes the whole carried stack/item; clears hotbar references; clears equipment slot and reapplies equipment visuals/stats if the destroyed item was equipped.
- Storage-origin items are not trashed by this first pass.
- Cache bust: `20260618-inventory-trash-confirm`.
- Checked: `node --check src/app.js` and `node --check src/app.monolith.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260618-inventory-trash-confirm` with no console errors. Full `npm.cmd run check` is still blocked by existing split-module syntax error in `src/game/modules/coreD.js` (`entryZone` redeclared).

## 2026-06-19 - Codex - Crystal-style inventory trash confirm
- Follow-up: replaced the native Chrome `window.confirm` item-destroy prompt with an in-game Crystal-style confirmation panel rendered through the scene overlay.
- Flow: dropping an inventory-origin item outside valid targets sets `pendingInventoryDestroyEntryId`; the overlay shows item icon/name plus `Destroy` and `Cancel`; only `Destroy` calls the existing delete path.
- Cache bust: `20260619-game-trash-confirm`.
- Checked: `node --check src/app.js` and `node --check src/app.monolith.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260619-game-trash-confirm` with no console errors. Full `npm.cmd run check` is still blocked by existing split-module syntax error in `src/game/modules/coreD.js` (`entryZone` redeclared).

## 2026-06-19 - Codex - inventory trash title spacing
- UI fix: moved the in-game trash confirmation content down slightly and gave the title a taller line box so `Destroy Item` no longer clips against the dialog frame.
- Cache bust: `20260619-trash-title-spacing`.
- Checked: `node --check src/app.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260619-trash-title-spacing` with no console errors.

## 2026-06-19 - Codex - trash confirm snooze
- Added `Yes, don't ask me again for 5 minutes` to the in-game inventory trash confirmation.
- Behavior: pressing it destroys the current item and suppresses future trash confirmations for five minutes in the current session; during the suppress window, dropping inventory items outside valid targets destroys them immediately.
- Cache bust: `20260619-trash-snooze`.
- Checked: `node --check src/app.js` and `node --check src/app.monolith.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260619-trash-snooze` with no console errors.

## 2026-06-19 - Codex - roomier trash confirm
- UI fix: made the inventory trash confirmation panel wider/taller, added more padding, allowed long item names to wrap, and gave the long 5-minute suppress button its own comfortable row.
- Cache bust: `20260619-trash-roomier`.
- Checked: `node --check src/app.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260619-trash-roomier` with no console errors.

## 2026-06-19 - Codex - taller trash confirm
- UI fix: increased the trash confirmation panel minimum height and added more vertical spacing before the action buttons.
- Cache bust: `20260619-trash-taller`.
- Checked: `node --check src/app.js` passed.

## 2026-06-19 - Codex - trash confirm frame fit
- UI fix: kept trash confirmation text/button sizes the same, changed the panel to a fixed border-box height, moved title safely below the top frame, and pulled the action buttons up so they do not clip at the bottom.
- Cache bust: `20260619-trash-fit-frame`.
- Checked: `node --check src/app.js` passed.

## 2026-06-19 - Codex - trash confirm close and button fit
- UI fix: added a real transparent cancel button over the trash confirmation window's top-right X.
- UI fix: increased the panel frame height and bottom padding while keeping text/buttons the same size, so action buttons sit above the lower decorative frame.
- Cache bust: `20260619-trash-close-fit`.
- Checked: `node --check src/app.js` and `node --check src/app.monolith.js` passed; browser booted `http://127.0.0.1:4177/?ui=game&scene=inventory&v=20260619-trash-close-fit` with no console errors.

## 2026-06-20 - Cursor - hardening pass for AI-assisted edits

### Changed
- One source of truth: deleted the dead `src/game/` split and its tooling (`tools/split-app.mjs`, `check-game-modules.mjs`, `fix-shared-state.mjs`, `fix-runtime-exports.mjs`, `extract-constants.mjs`). The live game is now unambiguously `src/app.js` -> `src/app.monolith.js` -> sibling modules. Removed `src/game/` copying from `tools/package-itch.mjs` and the `split:app` script.
- Guardrails + docs: added `AGENTS.md`, `COOKBOOK.md`, an always-on Cursor rule (`.cursor/rules/source-of-truth.mdc`), and a `NAVIGATION MAP` comment at the top of the monolith. Rewrote `AI_HANDOFF.md` to match reality (monolith is the entry point) and regenerated its system map with current line numbers.
- Static analysis + tests wired into `npm run check`: added `oxlint` (`.oxlintrc.json`, correctness rules as errors) and a `node --test` suite (`tests/battleData`, `tests/buffPotions`, `tests/warriorMagic`, `tests/bossDrops`). Fixed a real `no-undef` bug Oxlint surfaced: `equipInventoryEntryToSlot` used `item` without defining it.
- Boss drops extracted from the monolith into `src/bossDrops.js` (data + `bossGemDrops`/`bossOrbDrops` helpers + `BOSS_DROP_TABLE_BY_LABEL` + `validateBossDropTables`). `bossDropTableForEnemy` now looks up that map. Added validation tests that fail on a bad chance or an item id missing from `items.json`.
- Cache-busting made automatic for releases: `tools/package-itch.mjs` `patchCacheBusting()` now re-stamps every `?v=` token across packaged HTML/JS - including `src/app.js`'s `import "./app.monolith.js?v=..."`, which was previously left pinned to a hand-typed version. JS stamping is anchored to a `.js`/`.mjs` specifier so it never touches the `?v=${MONSTER_ASSET_VERSION}` / `${MAP_STAMP_ASSET_VERSION}` asset URLs. Build fails loudly if a required file has no token. Documented the dev-no-store vs release-stamp model in `AGENTS.md`, `AI_HANDOFF.md`, and the rule.

### Checked
- `npm.cmd run check` passes: oxlint clean (warnings only), `node --check` on all source + tools, 29/29 unit tests, and `verify:itch:source`.
- Verified the cache-bust regex on the real `src/app.js` (stamps the import exactly once, leaves the comment's `"?v="` intact) and confirmed it leaves `src/app.monolith.js` asset versions untouched.

### Notes / Risks
- Did not run a full `npm.cmd run package:itch` end-to-end this pass (heavy asset copy + PowerShell atlas builds). The stamping logic itself is verified in isolation; a real package run is the only remaining end-to-end confirmation.
- Data inconsistency surfaced by the new tests: `black-dragon-slayer`, `black-dragon-staff`, `black-dragon-soul-sabre` are referenced by boss tables but absent from `items.json`, so they never drop. They are allow-listed in `tests/bossDrops.test.mjs` (KNOWN_MISSING_ITEM_IDS) to preserve current behavior; fix by adding them to `items.json` or deleting their entries in `src/bossDrops.js`.

### Suggested Next Step
- Retire the manual "bump the cache-bust string" ritual from older entries above - it is no longer needed. Optionally run `npm.cmd run package:itch` once to confirm the stamped bundle end-to-end.

## 2026-06-20 - Cursor - cleanup, real bug fixes, boss-drop typo

### Changed
- Removed leftover clutter: deleted `src/app.monolith.js.bak` and `src/app.monolith.js.bak-frankenstein` (two ~1.1 MB duplicate monoliths that polluted every grep) and the one-off `tools/_extract-boss-drops.mjs`. (Confirmed `src/game/` and the 5 split tools were already gone - the prior session's deletions did land; an earlier stale file index made it look otherwise.)
- Fixed 2 real latent bugs oxlint flagged (`no-constant-binary-expression`): `Number(x) ?? fallback` never falls back because `Number()` returns `NaN`, not nullish. `app.monolith.js` line ~14688 (`spawnIntervalMs` on boss-swarm restore) and ~15831 (boss-party target anchor `x`) now use a `Number.isFinite(...) ? ... : fallback` guard, so a missing/corrupt value yields the intended default instead of `NaN`.
- Linting hardened: promoted `no-constant-binary-expression` to **error** (so that NaN-fallback class can't return) and configured `no-unused-expressions` as error with `allowShortCircuit`/`allowTernary` (the 8 flagged sites were all the deliberate `playSpellSfx("impact") || playSpellSfx("cast")` idiom; genuine no-ops still fail). Fixed the lone redundant `Boolean(...)` in `warriorSlayingPending` and a `unicorn` regex hint in `tools/build-phase1-content-audit.mjs`. `npm.cmd run check` is now warning-free.
- Boss-drop content bug fixed: `src/bossDrops.js` referenced `black-dragon-slayer` / `black-dragon-staff` / `black-dragon-soul-sabre` in 2 tables (Incarnated Wooma Taurus @ 10%, and the table at ~L380 @ 2.5%). No `black-*` item exists; the real L40 class trio is `dragon-slayer` / `dragon-staff` / `soul-sabre` (used correctly in 11 other tables). Renamed the 6 references to the real ids, so those weapons now actually drop as authored. Removed the now-unneeded `KNOWN_MISSING_ITEM_IDS` allowlist from `tests/bossDrops.test.mjs`; that test now enforces strict id validation.

### Checked
- `npm.cmd run check` passes: oxlint clean (zero warnings), `node --check` on all source + tools, 29/29 unit tests (boss-drop id test now strict, no allowlist), `verify:itch:source`.
- Proved the new lint guardrails are live with a throwaway probe: a genuine no-op statement and a `Number(x) ?? 10` both error; a `fn() || fn()` short-circuit passes.
- Confirmed the rename creates no duplicate drop entries (neither affected table already listed the real ids).

### Notes / Risks
- The black-dragon rename means Incarnated Wooma Taurus now drops dragon-slayer/dragon-staff/soul-sabre at 10% each (and the other boss at 2.5%) - these were authored rates that were silently dead before. Reversible if brand-new "black dragon" items were actually intended (would require defining them in items.json with real stats/icons).
- Still not run end-to-end this pass: a full `npm.cmd run package:itch`. Session work is uncommitted in git.

### Suggested Next Step
- Optionally run `npm.cmd run package:itch` once to confirm the cache-bust stamp end-to-end, then commit the session's work.

## 2026-06-20 - Cursor - Phase 6 start: coupling scan + first stat-helper extraction

### Changed
- Phase 6 (shrink the monolith) kicked off the safe way. First ran a static coupling scan: of 1,775 top-level functions, ~826 (7.6k lines) never touch `state`/DOM/canvas, but the large "system" clusters (smith combine, combat ranges, item helpers) are NOT dependency-closed - they bottom out in the global `state` singleton and a shared helper web (`itemDefinition`, `inventoryEntries`, render-signature setters, etc.). Key finding: a clean "lift a whole system into its own file" is blocked by that shared-state coupling (the same thing that forced the old `src/game/` split to use a global `G` registry and then fail).
- Given that, extracted the first genuinely dependency-closed pure set: the stat-object arithmetic helpers `cloneStats`, `addStats`, `addRange`, `sanitizeItemBonusStats`. Moved verbatim from `app.monolith.js` into `src/battleData.js` (the existing "stats & formulas" module), added them to the monolith's `battleData.js` import, and removed the originals. No behavior change.
- Added 4 unit tests for them in `tests/battleData.test.mjs` (alias precedence, deep-copy of ranges, range/scalar accumulation, truncation + zeroed-shape coercion).

### Checked
- `npm.cmd run check` passes: oxlint clean, all `node --check`, 33/33 tests (was 29), `verify:itch:source`. oxlint's `no-undef`/`no-redeclare` confirm every call site now resolves through the import with no leftover duplicate definitions.

### Notes / Risks
- This first extraction is small/foundational by design (proof the pattern still holds). The bulk of the monolith (state-coupled logic) cannot move this cleanly without an architectural decision: either (A) introduce a shared `src/state.js` module that systems import (the "real" split, but structurally similar to the failed `G` registry - higher risk, now backed by lint+tests), or (B) keep extracting pure leaves into themed modules (low risk, modest size reduction). Awaiting that decision before going bigger.
- Nav-map line numbers in `app.monolith.js` drift slightly upward (~85 fewer lines); the map says "search by name", so left as-is.
- Session remains uncommitted in git per request.

### Suggested Next Step
- Decide path A vs B for the rest of Phase 6. If B, next safe targets are more pure leaves (e.g. item predicates `isOreItem`/`isStackableItem`/... once their constant deps move too). If A, scope the shared-state module carefully behind the test suite.

## 2026-06-20 - Cursor - boot-test harness; decided AGAINST further monolith splitting

### Changed
- Committed the prior session's work as the first git checkpoint (`32d07be`).
- Stood up runtime verification (kept): installed `playwright` (devDep) + Chromium and added `npm run smoke` (wraps `tools/smoke-game.mjs`), which boots the game headless and fails on any console/page error. `npm run check` only covers syntax/lint/unit tests and cannot catch runtime/eval-order regressions - smoke can. Documented it in AGENTS.md, AI_HANDOFF.md, and the always-on rule as the extra step for `app.monolith.js` changes.
- Briefly prototyped Path A (a shared `src/state.js` the monolith fills via `Object.assign`) to enable splitting whole systems out of the monolith. It worked (check + smoke green), but I then REVERTED it - see decision below. The monolith again declares `const state = {...}` directly.

### Decision: stop splitting the monolith
- The explicit goal is "make it easier for LOWER-level AIs to work on this". Judged against that, further splitting the 28k-line monolith is net-negative: its systems are mutually recursive and share a large helper web, so each extracted file would need circular imports back into app.monolith.js plus handling of reassigned render-cache vars (`gamePanelSignature`, etc.). That is MORE context and MORE footguns for a weak model, not less.
- The high-value weak-AI wins were already delivered in Phases 1-5: one source of truth (no dead-copy trap), oxlint (catches their undefined/dup errors), unit tests + smoke (red/green signal), navigation map + AGENTS.md + COOKBOOK + always-on rule (find code, verify changes), data-driven boss drops. The `state.js` foundation only paid off if we kept splitting, so it was reverted to avoid leftover indirection.

### Checked
- Baseline (32d07be) and post-revert both boot clean via `npm run smoke` (`errors: []`, assets loaded). `npm.cmd run check` green: 33/33 tests, oxlint clean, all node --check.

### Notes / Risks
- Net change kept this session beyond the checkpoint: the smoke harness + its docs. The codebase is otherwise back to the committed checkpoint's structure (no state.js).
- Smoke test needs the dev server running + Playwright; intentionally NOT part of `npm run check` (keeps check fast/browser-free).

### Suggested Next Step
- Treat the hardening project as done. Future work should stay inside the monolith using the guardrails; only extract a piece if it is genuinely self-contained and pure (like the data modules), never a tangled "system".
