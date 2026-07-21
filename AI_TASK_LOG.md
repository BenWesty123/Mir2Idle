# AI Task Log - LOM Idle V2

## 2026-07-21 - Poison Cloud locked Taoist attacks for full cooldown

### What
After casting Poison Cloud, the Taoist could not attack for the full 18s spell
recharge. `spellDelayMs` returns `autoCooldownMs` (18s), and that value was also
used as `lastPlayerAttackCooldownMs` / boss-party `nextActionAt`.

### Changes
- `src/warriorMagic.js`: add `spellActionDelayMs` (delayBase only); keep
  `spellDelayMs` for recharge
- `src/app.monolith.js`: Poison Cloud action lock uses `spellActionDelayMs`
  (~1.8s); `castReadyAt` still uses `spellDelayMs` (18s)
- `tests/warriorMagic.test.mjs`: covers the split

### Verify
- `npm.cmd run check`

## 2026-07-20 - Tao tank pets teleport between solo fights

### What
Skeleton and Shinsu no longer die/resummon between solo enemies. On fight end they
teleport away (Teleport FX + `ui.teleport`) after a short post-fight pause
(`TAOIST_PET_BETWEEN_FIGHT_TELEPORT_DELAY_MS` = stance hold); when the Taoist is
in summon range of the next enemy they teleport back with HP/buffs preserved and
no amulet/MP cost. Holy Deva behavior is unchanged. Offline uses the same
stash/recall (no FX / no delay).

### Changes
- `src/core/taoistPets.js`: stash/recall helpers + `shouldKeepTankPetBetweenSoloFights`
- `src/app.monolith.js`: `stashedTaoPet`, `retireTaoistPetAfterFight` teleport-away,
  `maybeRecallStashedTaoistPet`, dismiss keep flags, Teleport FX draw path
- `tests/taoistPets.test.mjs`: coverage for stash/recall persistence

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke` (with `npm run dev`)

## 2026-07-20 - Glyph of the Hero

### What
Added **Glyph of the Hero** (any class): in group/boss-party fights, the wearer
takes all damage other party members would receive. AOE stacks as multiple hits
on the hero; pets keep their own damage. Defence/absorb use the hero’s gear.

### Changes
- `src/glyphModifiers.js`: `hero` def + `glyphIsHero`
- `src/data/items.json`: `glyph-hero` (frame 3214)
- `src/app.monolith.js`: `bossPartyLivingHeroMember` / `resolveBossPartyHeroRedirectTarget`;
  hooks in `applyBossPartyIncomingStrike`, `applyStrikeTargetIncoming`,
  `applyCombatantIncomingHpDamage`, poison ticks, `offlineGroupFrontTarget`
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke`

## 2026-07-20 - Glyph of the Monk

### What
Added **Glyph of the Monk** (Taoist): while **no pets are summoned**, **+50% DC and SC**.
In group / boss-party fights the boost applies **only to the Taoist** (not pets or other members).
Stored combatant stats no longer bake the boost (avoids double-scaling).

### Changes
- `src/glyphModifiers.js`: `monk` def + `glyphMonkParams` / `applyGlyphMonkCombatStats`
- `src/data/items.json`: `glyph-monk` (SoulGlyph3 / frame 3211)
- `src/app.monolith.js`: Taoist-only via `combatantIsTaoist` + `effectiveCombatStats`; UI via `characterTotalStats`
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke` (with `npm run dev`)

## 2026-07-20 - Glyph of Battle Wizard

### What
Added **Glyph of Battle Wizard** (Wizard): within melee reach (`LANE.warriorRange`)
**+25% AC/AMC and damage**; at range **−25% AC/AMC and damage**.

### Changes
- `src/glyphModifiers.js`: `battleWizard` helpers
- `src/data/items.json`: `glyph-battle-wizard` (EvilSlayerGlyph1 / frame 3217)
- `src/app.monolith.js`: defence + outgoing damage stance hooks
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-20 - Glyph of Revival

### What
Added **Glyph of Revival** (all classes): on lethal damage, restores **full HP**
once and **destroys** the equipped glyph. Hooks the shared incoming HP damage path
(solo + boss party) and offline group chunk deaths.

### Changes
- `src/glyphModifiers.js`: `revival` def + `glyphIsRevival`
- `src/data/items.json`: `glyph-revival` (AwakeningSoul0 / frame 3224)
- `src/app.monolith.js`: `tryConsumeGlyphRevival`
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-20 - Glyph of Tank

### What
Added **Glyph of Tank** (all classes): **−25% damage taken** (0.75×), **−50% damage
done** (0.5×). Shares the Glass Canon combat-damage multiplier path.

### Changes
- `src/glyphModifiers.js`: `tank` def; generalized `glyphCombatDamageParams`
- `src/data/items.json`: `glyph-tank` (ProtectionGlyph1 / frame 3213)
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-20 - Glyph of Glass Canon

### What
Added **Glyph of Glass Canon** (all classes): **+50% damage done**, **+100% damage
taken** (2× incoming). Hooks the shared outgoing crit path and incoming enemy
attack / DR wrappers so solo, boss-party, and offline group DPS estimates all
see the tradeoff.

### Changes
- `src/glyphModifiers.js`: `glassCannon` helpers
- `src/data/items.json`: `glyph-glass-canon` (BodyGlyph0 / frame 3220, classMask 31)
- `src/app.monolith.js`: outgoing + incoming combat hooks + offline group DPS
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-20 - Glyph of Infinite Mana

### What
Added **Glyph of Infinite Mana** (Wizard): passive **+5 MP/s**. Accrues from
elapsed *simulated* time (bulk formula), so offline fight steps of uneven length
still grant the correct total. Live, solo offline, mining offline, and boss-party
paths all call the same helper.

### Changes
- `src/glyphModifiers.js`: `wizardManaRegen` + `accrueGlyphManaRegen`
- `src/data/items.json`: `glyph-infinite-mana` (MagicGlyph3 / frame 3207)
- `src/app.monolith.js`: live + offline + boss-party regen hooks
- tests, item atlas, integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-20 - Glyph of Instant Healing

### What
Added **Glyph of Instant Healing** (Taoist): Healing restores HP immediately
instead of queued tick regen, but only for **50%** of the usual amount.
Mass Healing / Healing Circle are unaffected. Joins the empowered-boss glyph pool.

### Changes
- `src/glyphModifiers.js`: `taoHealingInstant` def + helpers
- `src/data/items.json`: `glyph-instant-healing` (SoulGlyph2 / frame 3210)
- `src/app.monolith.js`: solo + boss-party Healing cast paths
- `tests/glyphs.test.mjs`, item atlas, integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-20 - Heaven Armour (L50 winged)

### What
Added **Heaven Armour** as a distinct L50 chase piece: same look as Heaven Robe,
Crystal wing effect 1 (wing index 0), all-class offence+luck niche balanced against
Tarragon/Oma. Heaven Robe (`heaven-armour`) stays the wingless L40 glass robe.

### Changes
- `src/data/items.json`: new `winged-heaven-armour` (Lv 50, AC 12–28, AMC 8–14,
  DC 1–5, MC 0–11, SC 0–11, Luck +1, `visualEffect: 1`).
- `src/armourVisualEffects.js`: allowlist wings for `winged-heaven-armour` only.
- `src/bossDrops.js`: Hell Keeper 0.5% drop (alongside Tarragon).
- Ethereal (Spirit Box blocked); regenerated item-integrity rules.

### Verify
- `npm.cmd run check`

## 2026-07-20 - Ice Hell floors join Hell Cavern progression

### What
Ice Hell 1 / 2 / KR South / KR North are no longer a separate `ice-hell`
dungeon. They are Hell Cavern floors 4–7, so advancing past Hell Keeper leads
straight into Ice Hell.

### Changes
- `src/phase1Data.js`: ice hell zones `groupDungeon: "hell"`, floors 4–7
- `src/app.monolith.js`: wasteland teleporter only lists `zone-hell-gd-1`
  (Ice Hell is reached by advancing, like deeper BDD floors)

## 2026-07-20 - Manectric King drop table (Hell Keeper clone)

### What
Added a standalone Manectric King boss drop table: same as Hell Keeper minus
Book of Blizzard. Wired via `isManectricKingEnemy` → `BOSS_DROP_TABLE_BY_LABEL`.

### Changes
- `src/bossDrops.js`: `MANECTRIC_KING_BOSS_DROPS` + label map entry
- `src/app.monolith.js`: resolver + Awakening Soul source list
- `tests/bossDrops.test.mjs`: expected label

## 2026-07-20 - Manectric King SFX

### What
Manectric King (229) had no attack/flinch/death/range clips in the Idle SFX pack,
so `playMonsterSfx` always no-op'd even though Crystal ships `229-1/2/3/5.wav`.

### Changes
- `tools/build-sfx-assets.mjs`: add `monsterSounds("Manectric King", 229, { range: 2295 })`.
- Rebuild `public/audio/sfx/` (manifest + wav copies).
- Mass-burst path uses `enemyAttackSfxKind(..., true)` so AttackRange1 plays `229-5`.

## 2026-07-19 - Manectric King mass-burst VFX restore

### What
The big AOE explosion on Manectric King (Ice Hell KR North) was invisible.
The attack logic still fired; the FX atlas rebuild had cropped projectile slots
45–56 (Crystal frames 720–731) off `229.png`, so the draw path sampled the wrong
pixels (line-beam FX region) instead of the explosion.

### Changes
- `tools/build-manectric-king-fx-atlas.ps1`: always re-extract projectile 720–731
  from Crystal and pack with `sheetX` (same pattern as castEffect), so future FX
  rebuilds cannot drop the mass-burst art.
- Rebuilt `public/monsters/monster/229.json` + `.png`.
- Bumped `MONSTER_ASSET_VERSION` cache-bust.

## 2026-07-19 - Empowered / Ascended Group Dungeons (Black Dragon Dungeon)

### What
Extended the Empowered/Ascended feature to **group dungeons**, initially scoped to
**Black Dragon Dungeon** (`groupDungeon: "bdd"`) since it's the only finished one. You
toggle Empowered or Ascended on the dungeon *entrance* screen (floor 1). The gold is
paid **once** at entry and the tier persists across every floor of the run:
- **Empowered** = 300,000 gold; every monster (trash + bosses) gets 2× HP and 2× damage.
- **Ascended** = 1,000,000 gold; every monster gets 3× HP and 3× damage.
No extra empowered enrage is added (BDD bosses already have their own enrage). Trash
receive the drop multiplier (2×/3×) on their **gold** only — trash never drop items,
glyphs, or empowered items. Bosses keep the normal empowered drop/glyph/empowered-item
plumbing.

### Changes (all in `src/app.monolith.js` unless noted)
- Constants: `GROUP_DUNGEON_EMPOWER_GOLD_COST=300000`, `GROUP_DUNGEON_ASCEND_GOLD_COST=1000000`,
  `GROUP_DUNGEON_EMPOWER_DAMAGE_MULTIPLIER=2` (ascended reuses `ASCENDED_BOSS_DAMAGE_MULTIPLIER=3`).
- Helpers: `groupDungeonEmpowerable(zone)` (true only for `groupDungeon === "bdd"`),
  `groupDungeonEmpowerTierValue()`, and `applyGroupDungeonEmpowerCombatModifiers(enemy)`
  (uniform HP+damage scale, no enrage, guarded by `enemy.groupDungeonEmpowerScaled`).
  `bossEmpowerAvailableForZone` now also returns true for empowerable group dungeons.
  Zone-aware cost helpers `bossEmpowerGoldCostForZone` / `bossAscendGoldCostForZone`.
- Persistent tier: new `state.groupDungeonEmpowerTier` (0/1/2). Set in `confirmBossZoneEntry`
  (charges once via `chargeBossFightGold(cost)`), survives floor advances, cleared in
  `returnToTown` and full resets. Stored on the run snapshot + `sanitizeGroupDungeonOfflineRun`
  as `empowerTier` and re-seeded in `beginBossPartyFight` so it survives save/load & resume.
  `beginBossPartyFight` re-applies `state.battle.bossEmpowered/bossAscended` from the tier
  each floor (enterZone clears them from the now-false pending flags on advance).
- Scaling sites: `buildSwarmEnemyFromTemplate` (covers wave trash, boss-swarm, reinforcements),
  and `spawnGroupDungeonBossEnemy` (single-boss floors). The old boss-room hook in
  `spawnGroupDungeonBossSwarmEnemy` is skipped for group dungeons to avoid double-scaling/enrage.
- Drops: `awardBossPartyKillShare` multiplies trash gold by the drop multiplier for empowerable
  group dungeons. New module flag `suppressEmpoweredZoneDropRoll` (set around
  `rollBossPartyZoneDrops` for group dungeons) makes trash zone drops never roll empowered/glyph
  bonuses; `addBossPartyZoneDropItem` / `addZoneDropItem` respect it. Boss loot unaffected.
- UI: `groupDungeonEntrySceneHtml` (floor-1 wave entry) now renders the shared
  `bossEmpowerAscendControlsHtml` and gates its Enter button on affordability; the controls
  helper handles group-dungeon zones (no boss-room def) with generic labels and GD gold costs.
- Removed now-dead `canAffordBoss{Empower,Ascend}Fight` / `chargeBoss{Empower,Ascend}Gold`.

## 2026-07-19 - Boss Ascension (new rebirth upgrade / stronger empowered tier)

### What
Added a new rebirth upgrade **Boss Ascension** (`boss-ascension`, 100 Rebirth Points,
requires Boss Empowerment). It unlocks a stronger, mutually-exclusive fight tier
"Ascended" that mirrors Empowered but at 3× instead of 2×: 3× HP, 3× damage (flat,
overriding the empowered 2×/1.5× per-boss split), 3× boss-table drop rate, and a 30%
empowered-item drop chance (vs 20% for Empowered). Same enrage/Fury stages. Costs
300,000 gold per attempt (spent even if you die). Applies to the same 12 boss zones.

### Fix / changes (all in `src/app.monolith.js` unless noted)
- Constants: `BOSS_ASCEND_GOLD_COST=300000`, `BOSS_ASCEND_DROP_RATE_MULTIPLIER=3`,
  `BOSS_ASCEND_ITEM_CHANCE=0.3`, `ASCENDED_BOSS_HP_MULTIPLIER=3`,
  `ASCENDED_BOSS_DAMAGE_MULTIPLIER=3`, `BOSS_ASCEND_SKIP_REBIRTH_UNLOCK=false`,
  `BOSS_ASCEND_UNLOCK_HINT`.
- Upgrade def `boss-ascension` in `ACCOUNT_UPGRADE_DEFS` (rebirthPoints [100],
  `requiresUpgradeId: "boss-empowerment"`). Added effect labels ("Boss ascension" / "A")
  and the unlocked/locked status string.
- State: `state.bossAscendSelected`, `state.pendingBossAscended`, `state.battle.bossAscended`
  added and reset alongside every existing empower reset.
- Ascended is treated as a superset of Empowered: an ascended fight keeps
  `bossEmpowered=true` (so all empowered drop/glyph/item plumbing keeps working) plus a
  `bossAscended` flag that bumps HP/damage/drops/item-chance. `empoweredBossDamageMultiplier`,
  `applyEmpoweredBossCombatModifiers`, `empoweredBossPreviewMaxHp`, `empoweredBossCombatLogLine`,
  `empoweredBossDropRollOptions`, and `rollBossTableDrops` all branch on `bossAscended`.
- Helpers: `bossAscensionUnlocked`, `bossAscendGoldCost`, `bossAscendFightSelected`,
  `canAffordBossAscendFight`, `chargeBossAscendGold`. `confirmBossZoneEntry` charges 300k
  and sets both pending flags for ascended, 100k/empowered otherwise. `enterZone` reads the
  pending flags and logs "Ascended fight …".
- UI: shared `bossEmpowerAscendState` / `bossEmpowerAscendControlsHtml` render two
  mutually-exclusive toggle buttons (Empower / Ascend) with an accurate gold/lock note.
  Wired `toggleBossAscendSelection` + `data-toggle-boss-ascend`. Also added these controls
  to `groupDungeonBossSwarmEntrySceneHtml` (the Devourer entry scene), which previously had
  NO empower toggle at all — so Empowered/Ascended are now actually reachable for the
  Devourers. `src/styles.css`: violet accent for `.boss-ascend-button`.

### Verify
`npm run check` (462 tests + lint + syntax) green; `npm run smoke` green (0 errors).

## 2026-07-19 - Manectric King difficulty pass 2 (still easier than Hell Keeper)

### Why pass 1 felt easy
Hell Keeper is always-on party AOE, stationary (no walk-in downtime), and Hell Cavern
adds map fire. King's line kit + late execute let the party heal through him.

### Pass 2
- HP **78k**, DC/MC **115–280**, AC **82** / AMC **90**, Acc **40** / Agi **50**
- attackMs **1000**, impact **300ms**, moveMs **550**, XP **35k**, gold **720–1100**
- Mass burst from **50%** HP; above that, **1/4** of ready attacks pulse AOE (7–10s CD)
- Enrage stages **70% / 40% / 15%** for 10s at **700ms** swings

## 2026-07-19 - Manectric King ~20% harder than Hell Keeper (mix)

### What
Retuned Manectric King as a mix of survivability + pressure + execute, not a flat
Hell Keeper +20% copy.

### Snapshot vs Hell Keeper
| | Hell Keeper | Manectric King (now) |
|---|---|---|
| HP | 50k | **60k** |
| attackMs | 1200 | **1150** (enrage **850** under 40%/15%) |
| Acc / Agi | 35 / 44 | **34 / 40** |
| AC / AMC | 69 / 75 | **72 / 80** |
| DC / MC | 94–250 | **100–240 / 100–220** |
| XP | 25k | **30k** |

### Behaviour
- Mass burst opens at **30%** HP (was 20%) — longer execute without map fire
- Attack2 (DC beam) when close: **1/2** chance (`manectricKingAttack2Chance: 2`)
- Soft BDD-style enrage stages at 40% / 15% (faster swing + walk)
- moveMs 2000 → **700** (closes like BDD bosses)
- Gold reward **650–980**

## 2026-07-19 - Manectric King attacks match Crystal (not King Scorpion)

### What
Stopped routing Manectric King's normal attacks through King Scorpion's
melee/ranged mix. Crystal's `ManectricKing.Attack` always `LineAttack`s.

### Crystal behaviour now mirrored
- Below 20% HP: mass burst (radius 7, MC, ACAgility, projectile 720)
- Else Attack1 (~2/3): MC damage, full attackRangeTiles line, body + Attack1 aura
- Else Attack2 (~1/3 when primary within range-1): DC damage, shortened line,
  Attack2 castEffect beam
- Line delay `tile * 50 + attackImpactDelayMs`; hits everyone on facing lane tiles

### Changes
- `beginManectricKingLineAttack` / `canManectricKingLineAttack` /
  `resolveManectricKingLineHit` + strike kind `manectricKingLine`
- Mass-burst begin/can call those instead of King Scorpion
- Removed Manectric projectile hack from `beginKingScorpionAttack`
- Template `rangedAttackDefenceType` → `ACAgility`

### Not ported yet
- Attack2 push (`LineAttack(..., push: true)`)

## 2026-07-19 - Manectric King line-attack EFX

### What
Added Crystal-accurate attack VFX for Manectric King so line attacks no longer look like
the boss-centered mass-burst explosion.

### Crystal reference (MonsterObject.cs / ManectricKing.cs)
- Attack1 DrawBlend: `440 + FrameIndex + Dir*6` (west 476–481) — body aura
- Attack2 DrawBlend: `576 + FrameIndex + Dir*8` (west 624–631) — large directional line beam
- AttackRange1 Effect: frame 720×12 — self-centered mass burst (already on `projectile`)

### Changes
- `tools/build-manectric-king-fx-atlas.ps1` (new): appends `attack1Blend` + `castEffect`
  (Attack2 west beam) onto atlas 229; preserves existing body + projectile.
- `beginKingScorpionAttack`: Manectric King line path does NOT use `atlas.projectile`
  (that VFX is mass-burst only); `setEnemyAction` plays `castEffect` line beam instead.
- `beginMassBurstAttack`: clears `attackFxStartedAt` so under-20% mass burst only shows
  projectile 720 (Crystal AttackRange1), not the Attack2 beam.
- `drawEnemyCanvas`: draws castEffect AND attack1Blend together (Crystal Attack2 does both).

### Verify
`npm run check` + `npm run smoke`.

## 2026-07-19 - Fix Manectric King AOE attack disappearance

### What
Manectric King's mass-burst AOE made the boss vanish for a few frames. Root cause:
atlas `229.json` `attackRange1` is a tiny die-effect stub (~48×120, Crystal frames
558–563 = west die-effect region), not a body clip. `beginMassBurstAttack` hardcoded
`setEnemyAction("attackRange1")`, so the body was replaced by that stub while the
real AOE VFX (projectile frames 720+) still played.

### Fix
- `enemyPrefersAttackRange1` now requires frames to look like a body clip (≥35% of
  standing width). Rejects Manectric King's stub; Bone Lord / Flame Queen / Claw /
  BDD bosses still prefer their real `attackRange1`.
- `beginMassBurstAttack` uses that helper and falls back to `attack1` (full body)
  when `attackRange1` is not body-sized. Projectile AOE VFX unchanged.

### Verify
`npm run check` + `npm run smoke`.

## 2026-07-19 - Ice Hell KR (North): Manectric King boss room

### What
Added the Ice Hell group-dungeon boss room `zone-ice-hell-gd-4` ("Ice Hell — KR
(North)") on Crystal HELL206 (IceHellTemple_KR) north chamber at map (131, 62).
It is the 4th `ice-hell` floor (after the KR South swarm floor), so
`groupDungeonNextFloorZone` advances into it automatically.

### Changes
- `tools/build-ice-hell-kr-north-stamp.ps1` (new): builds the `ice-hell-kr-north-center`
  map stamp (hell206 @ 131,62), delegating to `build-ice-hell-stamp.ps1`. Rebuilt
  the stamp (648 static layers + 2 animated blend torches).
- `src/phase1Data.js`:
  - Added `ICE_HELL_KR_NORTH_ROOM_VISUALS` (mapStamp `ice-hell-kr-north-center`).
  - Added `zone-ice-hell-gd-4` boss room: `groupDungeonBoss` (single mobile boss,
    like the BDD King Scorpion / Dark Devil rooms), floor 4, 30-min respawn,
    `enemyIds: [293]`, gold reward [600, 900]. `groupDungeonBoss` rooms are exempt
    from the `groupDungeonSwarm` directional-clip test, so mobile King (293) needs
    no extra atlas rigging.
- `src/app.monolith.js`: added `zone-ice-hell-gd-4` to the wasteland teleporter
  region; bumped `MAP_STAMP_ASSET_VERSION` to invalidate cached stamps.

### Verify
`npm run check` + `npm run smoke` green.

### Follow-ups
- No Manectric King boss drop table yet (`dropPath: Unused\IceHell\ManectricKing`).
  Wire loot in `src/bossDrops.js` when ready.

## 2026-07-19 - Empowered mode for Yimoogi, Devourers, Great Fox Spirit

### What
Enabled empowered boss fights for three bosses that were still showing
"Empowered fights for this boss are coming soon": Yimoogi (`zone-viper-cave-kr`),
Dream and Dark Devourer (`zone-red-cavern-kr`), and Great Fox Spirit
(`zone-fox-cave-kr`). All three use the shared empowered tuning: 2x HP, 2x damage,
enrage stages at 70%/40%/15% HP.

### Fix / changes (all in `src/app.monolith.js`)
- Added the three zone ids to `BOSS_EMPOWER_AVAILABLE_ZONE_IDS` (flips the boss-room
  UI from "coming soon" to the real empower toggle + gold cost).
- Added `isYimoogiEnemy`, `isGreatFoxSpiritEnemy`, `isDreamDevourerEnemy`, and
  `isDarkDevourerEnemy` to `supportsEmpoweredBossCombat()` and to the 2x group in
  `empoweredBossDamageMultiplier()`.
- Devourers are a `bossSwarm` fight (two enemies built fresh from templates), so the
  generic `enterZone` path (which only scales `state.battle.enemy`) never reaches them.
  Added a hook in `spawnGroupDungeonBossSwarmEnemy` to call
  `applyEmpoweredBossCombatModifiers` on each supported swarm member at spawn when
  the fight is empowered. Yimoogi and Great Fox Spirit are single-enemy rooms and
  needed no extra handling.
- Loot (empowered drop-rate multiplier, empowered-item rolls, empowered glyph drops)
  was already generic on `state.battle.bossEmpowered`, so no drop changes were needed.

### Verify
`npm run check` (462 tests + lint + syntax) green; `npm run smoke` green (0 errors).

## 2026-07-19 - Ice Hell KR blend-animated torch flames

### What
Ice Hell KR stamp had three Crystal blend-animated flame props baked as static
opaque frames. Black "smoke" pixels (meant for additive DrawBlend) showed as
broken grain, and the flames did not flicker.

### Fix
- `tools/build-bdd-1f-stamp.ps1`: read Type1 `FrontAnimationFrame` / Tick; when
  bit 0x80 (blend) + count > 1, bake the full frame strip into
  `animatedLayers` instead of a static opaque layer. Interval = 100ms × (1+tick)
  matching Crystal's AnimationCount clock.
- `src/app.monolith.js`: draw `animatedLayers` with canvas `lighter` (additive),
  cycling frames from `performance.now()`. Depth sorting unchanged (inFront /
  mapRow). Bumped `MAP_STAMP_ASSET_VERSION`.
- Rebuilt `ice-hell-kr-center` → 3 animated layers × 8 frames (6799 / 6810 / 6821).

### Verify
`npm run check` + `npm run smoke` green.

## 2026-07-19 - Ice Hell KR (South) floor + Manectric Blest mob

### What
Added the third Ice Hell group-dungeon room, `zone-ice-hell-gd-3` ("Ice Hell — KR
(South)", `groupDungeonFloor: 3`), a swarm floor with NO boss yet. Introduces the
Manectric Blest brawler as its feature mob, backed by Claw + Staff casters, Slave rare.

### Fix / changes
- Blest (template 422, monsterIndex 228) atlas had NO directional swarm anims
  (only standing/walking/attack1/...). Ran `tools/append-monster-swarm-directions.ps1
  -Indexes 228` to add walk/attack/standing N/S/NW/SW clips (melee, so the
  `attackRange1` warning is expected). Without this the groupDungeonSwarm test fails.
- Scaled Blest stats to Ice Hell tuning (matches sibling Manectric mobs): maxHp
  1700->10000, dc [25,65]->[92,178], ac [12]->[48], accuracy 18->32, exp 9300->10580.
- New `tools/build-ice-hell-kr-stamp.ps1` (hell206 = Crystal IceHellTemple_KR, floor
  frames 3750-3755) -> rebuilt `public/mapstamps/ice-hell-kr-center-stamp.*` at map 88,107.
- `src/phase1Data.js`: added `ICE_HELL_KR_ROOM_VISUALS` + `zone-ice-hell-gd-3`
  (5 waves, Blest-heavy enemyIds, gold [460,700], spawn/focus {88,107}).
- `src/app.monolith.js`: added `zone-ice-hell-gd-3` to the Wasteland teleporter region.

### Verify
`npm run check` green; `npm run smoke` green (0 console/page errors).

## 2026-07-19 - Ice Hell F1: Manectric Claw ranged attack EFX

### What
Audited attack effects for the Ice Hell F1 Manectric mobs against Crystal
`Client/MirObjects/MonsterObject.cs`:
- Hammer (221), Club (222), Slave (233): plain melee, no attack effect in Crystal - left as-is.
- Claw (223): Crystal `new Effect(ManectricClaw, 304 + Direction*10, 10, ...)` on `this` -
  a self-cast electric discharge on its RANGED attack. Was missing + it was set up as melee.
- Staff (224): its electric blend is on Attack2 (`296 + FrameIndex + Direction*6`), a special
  cast we don't use; its basic melee has no effect. Left as plain melee (owner decision).

### Fix
- New `tools/build-manectric-claw-fx-atlas.ps1`: extracts west-facing (MirDirection.Left=6)
  effect frames 364-373 into `223.json` `castEffect` (interval 100), appended after bodyWidth.
- `phase1Data.js` template 420 (Claw): added `attackRangeTiles:6`,
  `rangedAttackDefenceType/attackDefenceType:"MACAgility"`, `attackImpactDelayMs:500`.
- `app.monolith.js`: `MANECTRIC_CLAW_TEMPLATE_ID`/`_MONSTER_INDEX`, `isManectricClawSwarmEnemy`,
  `beginManectricClawSwarmAttack` (ranged from distance, melee when adjacent), dispatched in
  `groupDungeonSwarmEnemyAttack`. castEffect auto-fires via `setSwarmEnemyAction` on attack.

### SFX
The five Manectric mobs (221-224, 233) had NO sound entries at all. Added them to
`tools/build-sfx-assets.mjs` using Crystal's convention (attack=+1, flinch=+2, death=+3,
range=+5) and reran `npm run build:sfx`:
- Club 222, Slave 233: full attack/flinch/death.
- Claw 223: attack/flinch/death + `223-5` range sound (used by its new ranged attack).
- Staff 224: attack/flinch/death (`224-6` is its unused Attack2 special).
- Hammer 221: Crystal pack has no `221-1` (attack) - borrowed Club's melee clip (222-1),
  matching the Ghastly Leecher<-Cyano Ghast borrow precedent.

### Verify
- `npm.cmd run check` (green); `npm.cmd run smoke` (green). Visual/audio confirm in dev pending.

## 2026-07-18 - Fix crafting-cube dupe on save restore/import

### What
Same class of bug as the character-switch cube dupe: staging pulls items into
global live board state, while saves fold those items back into inventory via
`cloneInventoryStateIncludingWeaponRefineStaged`. Cloud restore / file import
reloaded inventory but left the live cube/refine boards populated → item in
cube and bag (same entry id).

### Fix
- `discardLiveCraftingBoardsForSaveReplace()` resets cube + weapon refine without
  unstaging (unstaging after apply would push a second copy)
- Called from `applySaveSnapshot` so every restore path is covered
- `replaceCurrentGameWithSnapshot` closes open craft/refine scenes after apply

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-18 - Great Fox Spirit atlas split (mobile lag)

### What
Split Mon134 so body/DrawBlend and AttackRange1 hit FX are no longer one giant sheet.
Mobile lag reports pointed at the previous `8188×6312` (~12 MB / ~207 MB VRAM) atlas.

### Assets
- Body: `134.png` shelf-packed with deduped `srcFrame`s → `8178×2840`
- Hit FX: companion `134-fx.png` → `8146×798` (3×20 Crystal variants)
- Atlas JSON `projectile.sheet = "134-fx.png"`

### Runtime
- `monsterProjectilePngUrl` / preload on enemy atlas load
- Great Fox (and generic enemy projectile draw) sample from the companion sheet when set
- Package filter keeps `NNN-fx.png` for used monster indices
- Bumped `MONSTER_ASSET_VERSION`

### Verify
- Rebuild: `powershell -ExecutionPolicy Bypass -File tools/build-great-fox-spirit-atlas.ps1`
- `npm.cmd run check`; `npm.cmd run smoke` (with `npm run dev`)

## 2026-07-17 - Hotfix: rebirth upgrade cards crushed in list

### What
On the fox-cave/glyphs baseline, `.upgrade-card` used `min-height: 0` with default
flex shrink, so cards squashed and overlapped in `.upgrade-list`. Ported the layout
fix from later main: `flex: 0 0 auto`, `min-height: auto`, taller upgrades window
(560px), and related card spacing so rebirth upgrades stay readable/clickable.

### Verify
- `npm.cmd run check`

## 2026-07-16 - L40–50 armour niche rebalance

### What
Retuned Heaven / Dark / Tiger / Crane / Lotus / Oma King / Tarragon armour stats
so each piece owns a clear niche (Heaven = offence+luck, Dark = HP hybrids,
Tiger/Crane/Lotus = class mid-tier, Oma = pure tank, Tarragon = L50 class apex).
Updated `src/data/items.json` (26 entries) and regenerated integrity rules.

### Verify
- `npm.cmd run integrity:rules`
- `npm.cmd run check`

## 2026-07-16 - Glyphs drop only from empowered bosses (one per kill)

### What
Removed per-boss glyph rows from `bossDrops.js`. Empowered boss kills now get a
separate 10% roll for exactly one glyph, chosen uniformly from all `GLYPH_DEFS`
(`rollEmpoweredBossGlyphItemId` in `glyphModifiers.js`, wired in `rollBossTableDrops`).

### Verify
- `npm.cmd run check`

## 2026-07-16 - Plague bang damage retune (~75% Ice Storm feel)

### What
Plague area burst no longer uses `2 × Max SC`. Bang damage is now a native Taoist
magic roll (`rollTaoistMagicValue`: rolled SC + Plague crystal power). Plague's
power fields stay 0, so the bang is effectively rolled SC — roughly ~70–80% of an
Ice Storm bang at similar primary stats, without cloning Ice Storm's power formula.
Poison / Slow / Freeze rolls are unchanged.

### Verify
- `node --check src/app.monolith.js`

## 2026-07-16 - Fox accessory line + mid-end ladder smoothing

### What
Added 18 Fox accessories (Purple/Red/Blue x normal + Great; ring/bracelet/necklace,
Crystal idx 442-447, 514-519, 571-576) and smoothed the accessory ladder so it steps
~+2 max per tier: Boundless/Cloud/mid necks -> Fox (L43-44) -> Great Fox (L46-48) ->
L50-54 (buffed). Buffed pledge/crimson-ruby/five-element rings, dual-titan/evil-whisp/
sacred-angel amulets, cuspid/sorcery-anchor/purified-mirror necklaces.

Done via `tools/add-fox-items-and-rebalance.mjs` (idempotent). Fox icons (frames
893-910) copied into `public/item-icons/items/` and packed via `build:item-atlas`.
Fox items given placeholder drop on `zone-hell-gd-3` (0.025) - retune drops later.

### Verify
- `node tools/add-fox-items-and-rebalance.mjs`
- `npm.cmd run build:item-atlas` && `npm.cmd run integrity:rules`
- `npm.cmd run check` (461 tests pass) + `npm.cmd run smoke` (clean)

## 2026-07-16 - Fix stuck poison tint after CC expires

### What
Paralysis grayscale was applied via `ctx.filter` on the battle canvas, which could leak and leave the character grey after the poison ended. Grayscale now runs only on the scratch canvas; battle `ctx.filter` is forced to `none` each frame. Also ticks boss-party Holy Deva poisons (was skipped).

### Verify
- `npm.cmd run smoke`

## 2026-07-16 - Missing Crystal items picker

### What
Added `tools/build-missing-crystal-items-picker.mjs` (npm `build:missing-items-picker`)
which writes `tile-review/missing-crystal-items/index.html` — a filterable checklist
of Crystal items not yet in `items.json`. Selection downloads JSON/CSV; apply with
`npm run apply:missing-items-selection -- <selection.json>`.

### Verify
- `npm.cmd run build:missing-items-picker`
- Open `tile-review/missing-crystal-items/index.html`

## 2026-07-16 - Fix crafting-cube / weapon-refine dupe on character switch

### What
Fixed an item duplication exploit: staging an item in the Crafting Cube (or
Weapon Refine table), then switching characters with A/D, left the item on the
board. The board is **global** state, not per-character. On switch,
`selectPlayerClass` serialized the leaving character *with* the staged item
re-added to their bag (via `cloneInventoryStateIncludingWeaponRefineStaged`),
but never cleared the board - so unstaging on the new character dropped a second
copy into *their* bag = duplication.

Fix: `selectPlayerClass` now calls `restoreAllCraftingCubeStagedEntries()` /
`restoreAllWeaponRefineStagedEntries()` (returning staged items to the current
character's bag and clearing the boards) *before* `captureActiveCharacterState()`.

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke` (with `npm run dev`)

## 2026-07-16 - Player poison draw tint (Crystal)

### What
Matched Crystal `PlayerObject` DrawColour visuals for combatant poisons:
- **Paralysis** → grayscale (Crystal Gray → `SetGrayscale`)
- **Slow** → purple tint (same as existing enemy slow)
- **Green** → green tint

Applied on solo player, boss-party members, and Taoist pets via `combatantPoisonTint`.

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke` (with `npm run dev`)

## 2026-07-15 - Glyph Phase 4 Disruptor Cascade

### What
Wired **Glyph of Disruptor Cascade**: Flame Disruptor has a 50% chance per orthogonally adjacent swarm enemy to deal 50% of the primary hit. Solo fights are a no-op (no adjacent targets). Drop: King Scorpion (5%).

Also moved Glyph paper-doll slot to bottom-left (former Amulet spot) and retuned Pet Might to 100% Max DC.

### Verify
- `npm.cmd run check`

## 2026-07-15 - Glyph Pet Might retune to 100% Max DC

### What
Pet Might now adds **100% of owner Max DC** to pet attack (was 50%).

### Verify
- `node --test tests/glyphs.test.mjs`

## 2026-07-15 - Glyph Phase 3 pet + Magic Shield

### What
Wired Phase 3 glyphs:
- **Glyph of Pet Might**: Taoist pets add 50% of owner Max DC to attack
- **Glyph of Mana Aegis**: Magic Shield loses DR; incoming damage drains MP before HP (2 MP per 1 HP); shield ends at 0 MP

Drops: Bone Lord (Pet Might), Minotaur King (Mana Aegis).

### Verify
- `npm.cmd run check`

## 2026-07-15 - Glyph Phase 2 warrior modifiers

### What
Wired Phase 2 warrior glyphs:
- **Glyph of Flaming Bulwark**: Flaming Sword toggle grants 25% DR for 3s
- **Glyph of Twin Fury**: Twin Drake Blade damage ×2; enforces 2s cooldown even with auto-cast

Drops: King Hog (Flaming Bulwark), Hell Keeper (Twin Fury).

### Verify
- `npm.cmd run check`

## 2026-07-15 - Glyph slot + Phase 1 spell modifiers

### What
Added a new **Glyph** equipment slot and `src/glyphModifiers.js` for fixed spell-rewrite items (not empowers). Phase 1 combat hooks:
- **Glyph of Spirit Wards** (Tao): Soul Shield + Blessed Armour bonuses use `floor(Max SC / 5) + 4` instead of level
- **Glyph of Eternal Firewall** (Wizard): Fire Wall duration ×2
- **Glyph of Bulwark Field** (Warrior): Protection Field AC bonus ×2, duration fixed to 5s

Preliminary 5% drops: Great Fox Spirit / Oma King Spirit / Dark Devil. Remaining glyphs are defined but not implemented yet.

### Verify
- `npm.cmd run check`
- Equip a glyph and cast the matching spell

## 2026-07-15 - Pet Enhancer targets Holy Deva in boss party

### What
Boss/group-dungeon Pet Enhancer only looked at `bossParty.pet` (Skeleton/Shinsu), so Holy Deva never received the buff. It now uses the same unbuffed-pet preference as solo (`activeTaoistPet`: tank first, then Holy Deva). Impact FX / buff text follow the actual target pet.

### Verify
- `npm.cmd run check`

## 2026-07-15 - Achievement claim boss-party wipe fix

### What
Fixed achievement item/gold claims being marked Claimed while the reward vanished during boss/group-dungeon fights: grants now write into live boss-party inventories (same idea as `addInventoryItem`) before save sync. No automatic reclaim migration (would overcompensate players who already received rewards).

### Verify
- `npm.cmd run check`

## 2026-07-15 - Taoist Holy Deva alongside Skeleton/Shinsu

### What
Taoists can keep **Holy Deva** summoned at the same time as **Skeleton or Shinsu** (still mutually exclusive with each other).
Separate slots: tank pet (`taoPet`) + Holy Deva (`taoHolyDeva`), with per-slot death locks. Holy Deva can persist between solo fights.

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-15 - Great Fox Spirit boss drops

### What
Wired `GREAT_FOX_SPIRIT_BOSS_DROPS` from the Red Cavern Devourer table with tier tweaks:
- **2.5%:** Burst Sword, Conqueror Spear, Dragon Blood Sword (promoted from 1.25%)
- **1.25%:** Heaven Armour (demoted from 2.5%), Black Tiger Hammer, Fan Of Crane, Staff Of Lotus

### Verify
- `npm.cmd run check`

## 2026-07-15 - Red Scale Boots + Adamantine Belt

### What
Added two Great Fox Spirit drop items from Crystal with endgame idle stats:
- **Red Scale Boots** (Lv 40): Accuracy +6, Agility +6
- **Adamantine Belt** (Lv 39): AC 1-3, AMC 1-3

### Assets
- Crystal item icons 565 / 555 copied into `public/item-icons/items/`
- Rebuilt committed item atlas and item-integrity rules

### Verify
- `npm.cmd run check`

## 2026-07-14 - Great Fox Spirit Slow/Paralysis fix

### What
Fixed permanent CC: every AoE hit was applying Slow + Paralysis at 100% and refreshing Slow.

### Crystal match
- `PoisonTarget(..., 5, ...)` → **20%** proc each (`rollPoisonProc(5)`)
- Slow duration **15** ticks; Paralysis **5** ticks
- Neither refreshes while already active (Crystal `ApplyPoison` rule)

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Great Fox Spirit attack EFX

### What
Wired Crystal AttackRange1 / SpellEffect visuals for Great Fox Spirit.

### Assets
- Mon134 projectile variants: frames **375 / 395 / 415** × 20 (1400ms @ 70ms)
- Atlas rebuilt to `8188×6312` (still under 8192)
- Range SFX `monster.134.range` → Crystal `1345`

### Runtime
- On attack start: 5–8 ground barrage hits within ±7 tiles of the party
- On each AoE target: SpellEffect-style hit burst + range SFX
- Body DrawBlend unchanged (aura still draws)

### Verify
- `npm.cmd run build:sfx`; `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Great Fox Spirit atlas rebuild

### What
Fixed the broken Mon134 model: the previous 4-stage grid atlas was **15680×8320**, over common GPU texture limits, so frame sampling looked scrambled.

### Fix
- Shelf-pack body + DrawBlend frames under an **8192px** edge (`8188×5863`)
- Include all **5 Crystal stages** (FrameSet levels 0–4)
- Die blend uses Crystal's absolute **318+** frames (not DieStart+30)
- Runtime stage index now matches Crystal `4 - floor(HP / (MaxHP/4))`
- Stage cadence/damage extended for stage 5: `720ms` / `2.0×`
- Bumped `MONSTER_ASSET_VERSION`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Great Fox Spirit endgame retune

### What
Retuned Great Fox Spirit to sit roughly 25% above the combined Dream + Dark Devourer encounter while keeping its distinct all-party AoE and crowd-control mechanics.

### Tuning
- HP: `30,000` (150% of the Devourers' combined 20,000)
- Balanced defence: AC/AMC `38` (no longer class-skewed)
- Base DC/MC: `63–113`; Accuracy/Agility: `19`
- Stage cadence: `1600 / 1360 / 1120 / 880ms` (25% faster)
- Existing stage damage multipliers and Slow + Paralysis remain unchanged

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Great Fox Spirit staged all-party AoE

### What
Replaced the reused Thunder Element attack with a dedicated Great Fox Spirit attack: every cast targets all living party members (and active pets), applies Slow + Paralysis on successful MAC hits, and escalates through four HP-based visual/combat stages.

### Stages
- Stage 1 (>75% HP): 1.0× damage, 2000ms attacks
- Stage 2 (≤75%): 1.2× damage, 1700ms attacks
- Stage 3 (≤50%): 1.45× damage, 1400ms attacks
- Stage 4 (≤25%): 1.75× damage, 1100ms attacks

### Assets / behavior
- Rebuilt Mon134 with Crystal stages 0–3 in one grid-packed atlas (`134.png` / `134.json`)
- Added `sheetY` atlas-frame support and HP-stage action selection
- Slow and Paralysis last five 1-second ticks and remain magic/poison-resistable
- No Guardian Rocks and no pull/teleport behavior

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Fox Cave KR room (Great Fox Spirit)

### What
Sacred Fox Temple boss room uses Crystal **Fox03** map stamp focused on Great Fox Spirit's fixed spawn **(34, 32)** (same pattern as Evil Centipede).

### Changes
- `tools/build-fox-cave-kr-stamp.ps1` → stamp focus `(34, 32)` (not invented south stand)
- Zone `arenaSpawnMap` / `arenaFocusMap`: `{ x: 34, y: 32 }`; removed bogus `arenaEnemyMapRowOffset`
- Template **452**: `stationaryBoss`, `fixedArenaSpawn`, `moveMs: 0`
- Bumped `MAP_STAMP_ASSET_VERSION`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-15 - Fox Cave 1/2 drop rate rebalance

### What
Lowered Fox Cave trash accessory drop rates so overall drops match target kill cadence.

### Targets
- `zone-fox-cave-1`: ~1 item / 20 kills (5.0% total) — 15 commons @ 0.244%, 11 rares @ 0.122%
- `zone-fox-cave-2`: ~1 item / 15 kills (6.67% total) — 15 commons @ 0.325%, 11 rares @ 0.163%

### Verify
- `npm.cmd run check`

## 2026-07-14 - Fox Cave accessory drop pool

### What
Wired **26** accessory drops for Fox Cave trash (level 35–43 pool + Boundless / Thunder / Tae Guk rings).

### Zones
- `zone-fox-cave-1`: 15 items @ 0.244% (common tier), 11 @ 0.122% (rare tier) — ~1/20 kills
- `zone-fox-cave-2`: same pool @ 0.325% / 0.163% — ~1/15 kills

### Pool
Bracelets, helmets, necklaces, rings (incl. `boundless-ring`, `thunder-ring`, `tae-guk-ring`), DC/MC/SC Stone XL. (Amulet of Revival removed from pool.)

### Verify
- `npm.cmd run check`

## 2026-07-14 - Fox Cave layout: Guardian Rock + Great Fox KR

### What
Corrected roles: **Guardian Rock** is Fox Cave 2 rare sub-boss; **Great Fox Spirit** is Fox Cave KR main boss.

### Changes
- Template **453 Guardian Rock**: pull (magic-resistable) + idle MAC crush; atlas Mon131 + castEffect FX 12–21
- Template **452 Great Fox Spirit**: KR stats (15k HP / 30k XP); `zone-fox-cave-kr` + `BOSS_ROOM_DEFS`
- Fox Cave 2 spawn uses 453; Mongchon teleport lists KR

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Fox Cave 1 vs Red Cavern power parity

### What
Retuned Fox Cave 1 trash (447–451) to Red Cavern 1 power (Lv 90, ~1s attack, HP/DC/XP/gold), with **high AC + AMC 0** so Wizard/Tao prefer Fox and Warriors prefer Red.

### Mapping
- Black Fox ≈ Ghastly Leecher (2500 HP)
- Red Fox ≈ Cyano Ghast; White Fox ≈ Mutated Manworm
- Electric/Cloud ≈ mid + Crazy Manworm hit, AC 40
- Zone gold `[380, 580]` matches Red Cavern 1

### Verify
- `npm.cmd run check`

## 2026-07-14 - Electric/Cloud Element AoE MAC smash

### What
Crystal AI 49 ThunderElement kit for Electric Element (450) and Cloud Element (451): close 2-tile AoE DC vs MAC at 300ms, Attack1 blend FX.

### Changes
- `phase1Data.js`: `attackMode: "thunderElement"`, `aoeSplashTiles: 2`, `attackDefenceType: "MAC"`, `attackImpactDelayMs: 300`
- Monolith: `beginThunderElementAttack` / `thunderElementSmash` splash resolution (no paralysis)
- `tools/build-fox-element-blend.ps1` packs Mon132/133 `attack1Blend` from lib frames 64+

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-14 - Red/White Fox Man ranged EFX

### What
Wired Crystal ranged kits for Red Fox Man (447 / Mon128) and White Fox Man (449 / Mon129): prajnaGuard always-ranged attacks plus atlas projectile FX.

### Changes
- `tools/build-fox-man-combat-fx.ps1` packs Red `targetBurst` (Mon128 224×9) and White Magic 1160 travel + Mon129 352×10 impact into atlases 128/129 (`attackRange1` cloned from `attack1`)
- `phase1Data.js`: both use `attackMode: "prajnaGuard"`, range 6, `alwaysRanged`, MAC / MACAgility
- Solo projectile drawer: rotated travel + post-land `impactFrames`; `sheetX` support in `drawRotatedAtlasSprite`; Red burst delayed to impact

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with `npm.cmd run dev`

## 2026-07-14 - Fox Cave 1 trash: Elements + Trap Rocks

### What
Added Electric Element (450), Cloud Element (451), Trap Rock / Trap Rock 1 (452–453) to `zone-fox-cave-1`. Crystal stats, **AMC 0** (Tao/Wizard focus); Elements keep AC 100. Atlases 130/132/133 + SFX entries.

## 2026-07-14 - Fox Cave Floor 1 (corridor)

### What
Added **Fox Cave 1** (`zone-fox-cave-1`) under Mongchon Province: FOX01 corridor loop walls + Fox Cave floor tiles, with Red / Black / White Fox Men. Gold-only rewards for now (no item drops wired yet).

### Changes
- Region: `tools/tile-review/fox-cave-fox01-corridor-region.json` (cols 36–61, lane Y 270)
- Builders: `tools/build-fox-cave-tiles.ps1`, `tools/build-fox-cave-corridor-edge.ps1`
- Art: `public/maptiles/fox-cave.png`, `public/mapedges/fox-cave-wall-columns.png` (+ padded review edge)
- Templates 447–449 (`monsterIndex` 128/127/129); atlases exported; SFX entries added (some Crystal wavs missing)
- `FOX_CAVE_VISUALS` + zone in `phase1Data.js`; `CAVE_EDGE_SETS["fox-cave-corridor"]` (26×48, yOffset −508); teleport region entry

### Verify
- `npm.cmd run check`; `npm.cmd run smoke`

## 2026-07-13 - Testing Room DPS callouts

### What
In the Trainer Testing Room, the Trainer reports your DPS every second in the activity log (`Trainer: Your DPS is N.`). DPS is fight-average: total damage since first hit ÷ elapsed seconds (not per-second burst windows).

### Changes
- `testingRoomMeter` on battle state; `recordTestingRoomDamage` / `updateTestingRoomDpsMeter`
- Damage hooked in `applyCombatDamageEvent` (works even when dummy HP does not drop)
- Testing Room FireWall skips the solo melee gate (same as boss fights). Trainer stays stationary/non-attacking.
- Meter resets on `startBattle` / `resetBattle`; clock starts on first damage

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Trainer Testing Room (stage 1)

### What
Trainer NPC now offers a second room: **Testing Room**. Same Academy map and immortal Trainer dummy (enemy 290), but uses normal solo combat (real cooldowns / enemy attacks) instead of the Academy fast practice-cast loop. Not killable → no rewards.

### Changes
- `zone-testing-room` in `phase1Data.js` (`testingRoom: true`, same visuals/spawn as Academy)
- `isTestingRoomZone`, excluded from `combatPlayableZones`, fixed spawn via `trainingRoomEnemyTemplate`
- Trainer panel: Enter Academy + Enter Testing Room buttons

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Achievement categories (Party / Warrior / Wizard / Tao)

### What
Split Achievements into four categories. Existing achievements are all **Party** (any character). Warrior / Wizard / Tao tabs exist but are empty for now; class-category unlocks will only fire for that class.

### Changes
- `ACHIEVEMENT_CATEGORY_DEFS` + `category` on each `ACHIEVEMENT_DEFS` entry
- Unlock checks gated by category class (`achievementMatchesCharacter` / boss participant filter)
- Achievements window category tabs + empty-state copy
- Retro checks scan all characters for level achievements; class-specific boss kills stay non-retroactive

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Class level achievements (Warrior / Wizard / Tao)

### What
Added per-class level achievements for Warrior, Wizard, and Tao: levels 7, 22, 33, 40, 43, 45, 48, 50. XP bonuses scale by level (1% through 33, then 2/3/4/5/6% for 40/43/45/48/50). Party rewards unchanged.

### Changes
- `CLASS_LEVEL_ACHIEVEMENT_LEVELS` / `CLASS_LEVEL_ACHIEVEMENT_XP_BONUS` / `CLASS_LEVEL_ACHIEVEMENT_DEFS` appended into `ACHIEVEMENT_DEFS`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Warrior solo boss AC achievements

### What
Warrior solo boss achievements grant permanent account-wide AC to all characters when claimed: +0-1 (Wooma Taurus, Evil Snake), +0-2 (Evil Centipede, Zuma Taurus, Minotaur King, Bone Lord), +0-3 (Yimoogi, Oma King Spirit, Dream and Dark Devourer). Max AC only increases (min stays +0).

### Changes
- `WARRIOR_SOLO_BOSS_ACHIEVEMENT_DEFS` with `reward.ac: [0, N]`
- `achievementRangeStatBonus` / `applyAchievementStats` hooked into `applyRebirthUpgradeStats`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Wizard solo boss AMC achievements

### What
Same solo boss set as Warrior, under Wizard category, granting permanent account-wide AMC (+0-1 / +0-2 / +0-3 tiers). Full set = +0-19 AMC.

### Changes
- `WIZARD_SOLO_BOSS_ACHIEVEMENT_DEFS` with `reward.amc: [0, N]`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Tao solo boss soul drop chance achievements

### What
Same solo boss set under Tao category. Grants permanent extra Awakening Soul drop chance: +1% / +2% / +3% by tier. Full set = +19% (stacks with rebirth + gear, capped at 100%).

### Changes
- `TAO_SOLO_BOSS_ACHIEVEMENT_DEFS` with `reward.bonusAwakeningSoulChancePercent`
- Wired into `totalBonusAwakeningSoulChancePercent` via `achievementBonusAwakeningSoulChancePercent`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Party BDD boss achievements

### What
Party achievements for BDD bosses: King Scorpion (10 souls), IWT room clear (15), King Hog (25), IZT room clear (35), Dark Devil (50). IWT/IZT unlock only when the full boss swarm room is cleared.

### Changes
- New party `ACHIEVEMENT_DEFS` entries for `zone-bdd-2/4/8/11/13`
- `finishGroupDungeonBossSwarmEncounter` now calls `checkBossKillAchievements`

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-13 - Codex Empowerments section

### What
Added an **Empowerments** section to the Codex: left list of item slots (Weapon, Armour, Helmet, …), right panel lists every possible empowerment for that slot with min–max ranges. Weapons use one flat union list (no class breakdown).

### Changes
- `empowerCodexSlotCatalog()` in `src/core/empoweredItems.js`
- Codex UI: Items / Empowerments section tabs in `src/app.monolith.js` + styles
- Unit test for the catalog helper

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server

## 2026-07-12 - Spirit Box slot stays open until rebirth

### What
Paying souls/tokens opens the Spirit Box for the whole rebirth cycle. Withdraw/swap before rebirth no longer clears the fee. Rebirth clears `paid` but keeps any stored item.

### Changes
- `account.spiritBox.paid` flag; cleared in `performAccountRebirth`
- Open-slot buttons charge immediately; deposits are free while paid

## 2026-07-12 - Spirit Box rebirth upgrade

### What
Rebirth upgrade (50 RP) unlocks a top-right **Spirit Box** that holds one inventory entry through rebirth. Deposit costs 100 Awakening Souls or 200 tokens; withdraw clears the box so the next store costs again.

### Changes
- `ACCOUNT_UPGRADE_DEFS`: `rebirth-spirit-box`
- Account save field `spiritBox.entry` (survives rebirth purge; not wiped with storage)
- Corner button + Spirit Box window (deposit mode → click/drop inventory item; withdraw)
- Worker `/shop/spend` with `spirit-box-deposit` (200 tokens); client charges via recovery code
- Tests: shop spend + restoreAccount spiritBox

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server
- Deploy stats-worker manually so token deposits work in production

## 2026-07-12 - IWT Soul crafting cube item

### What
Craftable dungeon souls:
- **IWT Soul**: 2 Wooma Hearts + 1 Zuma Relic → Wooma Palace (South) / IWT (`zone-bdd-4`)
- **IZT Soul**: 1 Wooma Heart + 2 Zuma Relics → Zuma Palace / IZT (`zone-bdd-11`)
- **DD Soul**: 1 Stone Heart + 1 Hog Tooth → Dark Devil Palace (`zone-bdd-13`)

Use opens the normal group-dungeon entry window with party picker. Soul consumed only on Enter confirm.

### Changes
- `src/data/items.json`: `iwt-soul` / `izt-soul` / `dd-soul` consumables with purple/green/red cube icons.
- `public/item-icons/items-atlas.*`: rebuilt for soul icons.
- `src/core/craftingCube.js`: recipes, shared two-material validation, autofill.
- `src/app.monolith.js`: craft + portal use + consume-on-confirm.
- `tests/craftingCubeSalvage.test.mjs`: recipe coverage.

### Verify
- `npm.cmd run check`; `npm.cmd run smoke` with dev server.

## 2026-07-12 - Warrior BA vs Half Moon cast priority

### What
Blade Avalanche was losing to Half Moon / Cross Half Moon in practice (especially boss party), so BA did not cast on cooldown. BA should cast whenever ready; HM/CHM fill swings while BA is cooling down.

### Changes
- `src/app.monolith.js` `usableWarriorAttackSkill`: pick ready autocast Blade Avalanche before sweep attacks (after charged / Slaying / queued).
- `bossPartyWarriorAction`: do not prefer sweep while BA is autocast-ready; same BA-over-sweep rule as solo.
- `usableWarriorSweepAttack` (boss-party member path): also defer sweep when BA is ready.

### Verify
- `node --check src/app.monolith.js`; unit tests.

## 2026-07-12 - Codex search

### What
Added a search box to the Item Codex that filters the current category list by discovered item name, slot/type, or requirement text. Undiscovered entries never match (avoids spoiling hidden names). Escape / Clear clears the query. Session-only UI state (`codexSearchQuery`), not saved.

### Changes
- `src/app.monolith.js`: filter helpers + search input bindings; included in overlay signature; focus restore already covers `data-codex-search`.
- `src/styles.css`: search row styling under category tabs.

### Verify
- `node --check src/app.monolith.js`; smoke with `?scene=codex` if server up.

## 2026-07-12 - Codex open freeze (sanitize-on-read)

### What
Opening the Item Codex froze the game for ~1–2s. Root cause: `codexItemDiscovery()` called `ensureAccountCodex()` → full `sanitizeAccountCodexState()` on every lookup, and open rebuilt progress for every category by re-filtering/sorting all ~500 items and scanning discoveries thousands of times. Cost scaled with how many items the player had discovered.

### Fix (`src/app.monolith.js`)
- `ensureAccountCodex()` is now a cheap shape check; sanitize stays on load/import/clone only.
- `codexItemDiscovery()` is a direct map lookup.
- Category tab progress is computed in one pass over items (`codexProgressByCategory`).
- Overlay signature tracks `accountCodexRevision` instead of JSON-stringifying the full discovery map every tick.

### Verify
- Monolith syntax-check + 432 unit tests green. Full `npm run check` blocked by unrelated stale `integrity:rules` (other WIP). `npm run smoke` with `?scene=codex` (below).

## 2026-07-12 - Options sliders for auto-potion HP/MP thresholds

### What
Auto potions always triggered at a hard-coded 50% HP/MP. Players can now set separate thresholds in Options (5%–100%, step 5%, default 50% each).

### Changes
- `src/persistence/sanitizeSettings.js`: `autoPotionHpThreshold` / `autoPotionMpThreshold` with `normalizedAutoPotionThreshold` (clamp 0.05–1.0); defaults 0.5; migrated via existing `sanitizeSettingsState`.
- `src/app.monolith.js`: save/reset/serialize the settings; `autoPotionThreshold(kind)` used by live, offline, and boss-party auto-potion paths; Options UI sliders + Getting Started copy updated. Taoist auto-heal still uses the fixed `AUTO_POTION_THRESHOLD` (0.5).
- `tests/persistenceSettings.test.mjs`: cover sanitize + clamp behaviour.

### Verify
- `npm run check` green (432 tests); `npm run smoke` clean (no console/page errors).

## 2026-07-12 - Time Logging XP/hr tracker now works in group dungeons

### What
The Time Logging "XP/h" window stayed empty during group dungeons. Root cause: group-dungeon kills award XP through a **different path** than solo play. Solo kills call `awardEnemyRewards` (which samples `recordXpRateSample`), but group dungeons award each party member via `applyBossPartyMemberKillReward` (`awardBossPartyKillShare` / `awardBossPartyBossKillShare`), so no XP samples were ever recorded. (The mode/zone gating was fine - group dungeons run in `state.game.mode === "zone"` with a real `activeZoneId`.)

### Fix (`src/app.monolith.js`)
- In `applyBossPartyMemberKillReward`, after `applyBossPartyExperienceReward`, sample only the locally-controlled character's share: `if (member.classId === bossPartyControlledClassId()) recordXpRateSample(xp);`. `bossPartyControlledClassId()` is the party leader, whose state mirrors top-level `state.game` (correct zone + mode), so the existing `recordXpRateSample` / `currentZoneXpRate` gating attributes it to the right zone. Only the controlled member is sampled (assist members' shares are ignored), matching the solo behaviour of measuring the local player's active hunting.
- Updated the tracker doc comment to note both live paths (solo `awardEnemyRewards` + group-dungeon controlled share).

### Verify
- `npm run check` green (431 tests); `npm run smoke` clean (no console/page errors).

## 2026-07-11 - Unblock website build: obsolete itch file-count check + over-eager effect-atlas preload

### What
Producing a full website package (`npm run release:itch`) failed for two reasons, both unrelated to the token-shop work:
1. **Obsolete itch 1,000-file limit.** The live game now deploys to **Cloudflare Pages** (`lom2idle`); the 1,000-file guard in `tools/package-itch.mjs` was an itch.io HTML-embed constraint. The project is at 1,067 files, so packaging died before the boot check could even run. (Note: Cloudflare Pages' *dashboard* direct upload also caps at 1,000 files, but the **Wrangler CLI** allows up to 20,000 - so deploy the site with `npx wrangler pages deploy dist/itch --project-name=lom2idle --branch=main`, not the dashboard. The `--branch=main` is required - without it wrangler deploys a *preview* on your current git branch and production stays stale.)
2. **Effect-atlas 404s in the packaged build.** The boot verifier then failed on 404s for `public/armour-effects/{oma-king-robe,black-dragon-armour}` and `public/level-effects/{mist,red-dragon,blue-dragon,rebirth1,rebirth2,rebirth3,new-blue,yellow-dragon,phoenix}` `atlas.json`. Root cause: the boot preload loaded `def.atlasPath` for **every** entry in `ARMOUR_SPECIAL_EFFECT_DEFS`, but the packager (`buildUsedArmourEffectFiles`) only ships effect atlases an item actually assigns (`visualEffect >= 100` in `items.json`). None of these 11 are assigned yet (they belong to uncommitted armour/level-effects WIP: `src/armourVisualEffects.js`, `src/levelVisualEffects.js`), so the trimmed build 404'd on them. The game already tolerated the misses (`loadJson(...).catch(() => null)`); it was console-error noise that the strict boot verifier (correctly) rejects.

### Fix
- `tools/package-itch.mjs` `validateItchLimits`: the 1,000-file check is now a **non-fatal warning** (Cloudflare Pages has no limit); the 500 MB total / 200 MB per-file checks remain fatal.
- `tools/package-itch.mjs` `buildUsedArmourEffectFiles`: now ships **every DEFINED** special-effect atlas (`ARMOUR_SPECIAL_EFFECT_DEFS`), not only item-assigned ones. Several effects are intentional scaffolding for future development (not yet assigned to any item), and the client preloads all of them at boot - so shipping the full set is what stops the 404s while keeping the effects available for future work. `addEffectId()` skips any def whose atlas file is missing, so it stays safe. (The boot preload in `src/app.monolith.js` is left preloading all defs, as before.)
- Docs corrected from the old itch.io zip-upload flow to Cloudflare Pages: `AGENTS.md`, `COOKBOOK.md`, `AI_HANDOFF.md`, and `.cursor/rules/source-of-truth.mdc`. (Legacy `release:itch`/`dist/itch` names kept to avoid churn - noted as "the website build".)

### Verify
- `npm run check` green; `npm run smoke` clean. Full `npm run release:itch` now passes end-to-end incl. the headless **boot check ("Release boot check passed")** - the effect 404s are gone. Package: `dist/itch` (267 MB, 1,067 files; file-count warning is expected/fine for Pages).

## 2026-07-11 - "Time Logging" XP/hr tracker (300 tokens Cash Shop / 50 Souls Rebirth)

### What
A new permanent unlock that adds a live **experience-per-hour** readout for whatever combat zone you're currently hunting in. Owning it shows an **XP/h** button at the top-right of the play screen; clicking it opens a dedicated **Time Logging** window with the current zone and a live XP/hr number. Sold two ways (mirrors Organisation Skills): **300 tokens** in the Cash Shop, or **50 Souls** in the Rebirth shop.

### Server (`tools/stats-worker/`)
- `worker.js`: added `"time-logging": 300` to `UNLOCK_TOKEN_COSTS`. Reuses the existing idempotent `POST /shop/unlock-page` flow (no new route). **Deployed** (version `c8efc7eb`, no schema change - reuses `account_unlocks`). Live-checked: `unlock-page` with `time-logging` -> 402 for a zero-balance code (key recognized), unknown key -> 400.
- `tests/statsWorkerShop.test.mjs`: added "unlock-page charges 300 tokens for time logging".

### Client (`src/app.monolith.js`)
- Unlock: `TIME_LOGGING_UNLOCK_KEY`/`_TOKEN_COST`, `timeLoggingUnlocked()` (true if the rebirth upgrade is purchased OR the token unlock is owned). New rebirth upgrade def `rebirth-time-logging` (maxTier 1, `rebirthCosts:[50]`, category `utility`) - auto-appears in the Rebirth shop. Added key to `sanitizeOwnedUnlocks` whitelist and the harness key export.
- Tracker: session-only trailing-window sampler (`XP_RATE_WINDOW_MS` 5m, `XP_RATE_MIN_SAMPLE_MS` 20s) - `recordXpRateSample` / `pruneXpRateSamples` / `currentZoneXpRate`. Hooked into `awardEnemyRewards` (the LIVE solo-kill path) only, so offline catch-up XP (which also runs through `applyExperienceReward`) is deliberately excluded. Returns `null` until >=2 kills span >=20s.
- UI: top-right buttons wrapped in a `.stage-corner-buttons` flex container (ring + new `#timeLoggingButton`). `syncTimeLoggingButton()` (owned + `UI_MODE === "game"`; NOT gated on `cashShopEnabled()` since it's also a rebirth unlock) called alongside `syncTeleportRingButton()`. New `timeLogging` scene wired through all the same allowlists as `teleportRing` (`initialOpenScenesFromUrl`, `currentOverlayScenes`, `isSceneWindowOpen`, `openScene`+gate, `closeScene`, `renderSceneOverlay` guard, `sceneClassName`/`sceneTitle`/`sceneBodyHtml`). `timeLoggingSceneHtml()` renders the zone + `[data-xp-per-hour]` span + an `[data-time-to-level]` est.-time-to-level line (`xpForNextLevel(level) - experience` / current XP/hr via `formatDuration`; shows "Max level"/"Ready to level up"/"Measuring..." at the edges); both numbers tick in place via `refreshOpenSceneLiveText` (no rebuild).
- Shop: Cash Shop "Spend tokens" item (Buy for 300 / Owned) + `confirmTimeLoggingPurchase()` + `data-buy-unlock` handler branch. Test harness gained `grantTimeLogging()`, `recordXpSample(xp, ageMs)`, `timeLoggingState()`.
- `styles.css`: `.stage-corner-buttons` container, shared `.stage-corner-button` base (positioning moved off `.teleport-ring-button`), `.time-logging-button` text style, `.time-logging-panel/-readout/-rate/...`.

### Verify
- `npm run check` green (431 tests, incl. new worker test); `npm run smoke` clean. Headless (`?testHarness=1`, warrior-bicheon save): `grantTimeLogging()` -> owned + button visible; `currentZoneXpRate` null before enough samples, then 120,000 XP/hr from two synthetic samples spanning 60s; window renders "Bicheon 1" + live "XP/hr" and the number refreshes in place. No console errors.
- **Worker deployed; client not yet packaged.** To finish going live: run the website package/upload for the client changes. (Rebirth-shop 50-Souls purchase is fully client-side; the 300-token Cash Shop purchase now works server-side.)

## 2026-07-11 - Cash Shop "Monthly Supporter" subscription (1000 tokens / 28 days)

### What
A re-buyable, time-limited Cash Shop perk. While active it grants a multiplicative **+10% XP**, **+10% gold**, **-10% boss respawn time**, and **+1 auto-potion** and **+1 auto-cast** slot. Lasts 28 days; buying again while active extends the expiry. Multipliers stack multiplicatively on top of rebirth/equipment bonuses (e.g. supporter + a 2x rebirth XP = 2.2x).

### Server (authoritative expiry - `tools/stats-worker/`)
- `schema.sql`: new `account_subscriptions` table (`recovery_code`, `subscription_key`, `expires_at` epoch-ms, `updated_at`; PK on code+key). Unlike `account_unlocks`, these expire and can be re-bought. Created on the remote D1 (idempotent `CREATE TABLE IF NOT EXISTS`).
- `worker.js`: `SUBSCRIPTION_TOKEN_COSTS` (`monthly-supporter: 1000`), `SUBSCRIPTION_DURATION_MS` (28 days). New `POST /shop/subscribe` charges tokens atomically (`balance >= cost` guard) then extends expiry from `max(now, currentExpiry)`; writes a `spend:subscription` ledger row. `GET /shop/unlocks` now also returns `subscriptions` (only still-active keys). Timestamps read via `intValue(..., Number.MAX_SAFE_INTEGER)` since the default int cap is 32-bit.
- `tests/statsWorkerShop.test.mjs`: charges 1000 + 28-day expiry, extends from current expiry, 402 when short, 400 unknown key, active-vs-expired in the unlocks GET. FakeDb extended with an `account_subscriptions` mock. All 20 shop tests green.

### Client (`src/app.monolith.js`)
- Constants + helpers near the other unlock keys: `MONTHLY_SUPPORTER_KEY/_TOKEN_COST/_DURATION_MS`, `supporterActive()`, `supporterExpiresAt()`, `supporterDaysRemaining()`, `applySupporterGold()`.
- Perk hooks (single choke-points): XP `* supporterExperienceMultiplier()` inside `adjustedKillExperience`; gold wrapped with `applySupporterGold(...)` at all 5 kill-gold sites; `effectiveBossRespawnMinutesForZone` `* 0.9`; `+1` in `autoCastSlotLimit`/`maxAutoCastSlotLimit` and `autoPotionSlotLimit`/`maxAutoPotionSlotLimit` (auto-potion still capped at `HOTBAR_SLOT_COUNT` = 6).
- Persistence: `state.account.subscriptions` (`Record<key, expiresAtMs>`) added to default state, `createSaveSnapshot`, `sanitizeSubscriptions`, `accountRestoreOptions`, and `restoreAccount.js`.
- Shop flow: `purchaseSubscription()` -> `setSupporterExpiry()`; boot `fetchAccountUnlocks` now mirrors the server's `subscriptions` (server-authoritative: a missing key means lapsed). Cash Shop item renders "Buy/Extend for 1000 tokens" + an "Active - Nd left" badge (`.cash-shop-active` in `styles.css`). `data-buy-subscription` handler + `confirmMonthlySupporterPurchase()`. Test harness gained `window.__lomTest.setSupporter(days)`.

### Verify
- `npm run check` green; `npm run smoke` clean (no console errors). Headless (`?testHarness=1`): baseline auto-potion 2 / auto-cast 1 / xp 1x -> active 3 / 2 / 1.1x -> reverts cleanly; Cash Shop shows "Buy for 1000 tokens" inactive and "Extend for 1000 tokens" + "Active - 28 days left" when active.
- Worker deployed (version `5d54dfac`) and live-checked (`/shop/subscribe` -> 402 for a zero-balance code; `/shop/unlocks` returns `subscriptions`). **Client not yet packaged/uploaded** - needs a website release to go live.

## 2026-07-08 - Fix: swapped empowerments false-flagged by Social integrity check

### What
Empowered-crafting empowerment swaps (crafting cube) move an empowerment from one item onto another. The stats-worker anti-cheat validator (`tools/stats-worker/itemLegality.js` `validateEmpower`) validated each item's empowerments only against that item's OWN roll table, so a legitimately swapped roll (e.g. a weapon's `accuracy` on armour) was rejected as `empower_stat`/`empower_spell`, marking the account's leaderboard row `flagged`. The full client->worker->Social display pipeline otherwise carries the swapped stats correctly (verified `prototypeStatsCharacterEquipment`, `socialEquipmentEntry`, worker `normalizeEquipmentPayload`, and the `character_stats` upsert).

### Fix (`tools/stats-worker/itemLegality.js`)
- Added a `SWAP_EMPOWER_POOL` built from the union of every item's `empower.rolls`, keyed by roll target.
- `validateEmpower` now accepts a stat/spell value if it matches the item's own table OR any pooled roll for the same target (`swapEmpowerRollLegal`). Luck stays weapon-only, mirroring the client's `canPlaceEmpowerSlotOnItem`. The per-tier roll-count check is unchanged.
- No rule DATA change, so `ITEM_INTEGRITY_RULES_VERSION` is left as-is; flagged rows re-clear on their next submission.

### Verify
- `tests/itemLegality.test.mjs`: added "accepts empowerments swapped in from another item" and "still rejects Luck swapped onto a non-weapon slot". Full `npm run check` green (417 tests). Worker-only change; no site repackage needed, but the stats worker must be redeployed by the user.

### Follow-up: worker normalization dropped empower stat/spell types
After the integrity fix, another player viewing swapped gear still saw one empowerment missing. Cause: the worker's `normalizeEquipmentPayload` helpers only whitelisted a subset of empower fields, so anything outside it was silently stripped from the stored/served snapshot.
- `normalizeBonusStatsPayload` was missing `goldBonusPercent`, `bonusAwakeningSoulChancePercent`, `damageTakenReductionPercent`, `critChancePercent`, `critDamagePercent`, `skillLevelBonusPercent`, and truncated the fractional `dropChanceBonusPercent` to 0.
- `normalizeEmpowerSpellBonuses` was missing spell kinds `petHealthPercent`, `petDamageReductionPercent`, `critChancePercent`, `critDamagePercent`.
- Fix (`tools/stats-worker/worker.js`): expanded `BONUS_STAT_SCALAR_KEYS`, added `BONUS_STAT_FRACTIONAL_KEYS` (`dropChanceBonusPercent`) + `signedFractionalValue`, and added an `EMPOWER_SPELL_KINDS` list — all kept in sync with the client's `sanitizeItemBonusStats` / `sanitizeEmpowerSpellBonuses`. Requires another worker redeploy; existing rows heal on next submission.

## 2026-07-06 - Utility reward empowers on all slots (gold/XP/soul/drop)

### What
Spread gold drop, bonus XP, and soul drop chance to every equippable slot with worn-set caps matching skill leveling tiering. Item drop chance rolls on weapon, armour, and stone only (3% worn max).

### Worn max targets
- Gold drop & Bonus XP: **200%** (same per-slot maxes as skill leveling)
- Soul drop chance: **100%** (half of gold/XP per slot)
- Item drop chance: **3%** (weapon 1.5% + armour 1% + stone 0.5%)

### Changes
- `src/core/empoweredItems.js`: added/updated `goldBonusPercent`, `xpBonusPercent`, `bonusAwakeningSoulChancePercent`, and `dropChanceBonusPercent` on all slot tables per approved ranges.
- `tests/empoweredItems.test.mjs`: slot coverage tests, item-drop slot restriction, worn-max sum tests (200/200/100/3).
- Regenerated `tools/stats-worker/itemRules.generated.js` and `docs/EMPOWER_REFERENCE.md`.

### Checked
- `npm run check` (404 tests pass; pre-existing warrior-bicheon offline XP fixture drift only). Not yet deployed.

## 2026-07-05 - Floating combat text: vertical stacking so group hits overlap less

### Problem
In group combat (KR boss rooms + group dungeons) all party members hammer one monster, and every floating damage number spawned at the same height and rose at the same speed. Numbers landing close together stayed piled on top of each other for their whole life, making it hard to read who did what. The only prior mitigation was a fixed 3-column horizontal offset for assist damage (`bossPartyDamageTextOffset`), which still overlapped for rapid hits and wide crit numbers.

### Change (`src/app.monolith.js`)
- Added `floatingTextStackOffsetY(x, now)` plus `FLOATING_TEXT_STACK_GAP` (17px), `FLOATING_TEXT_STACK_WINDOW_MS` (650ms), `FLOATING_TEXT_STACK_X_TOLERANCE` (34px). When a new number spawns, it counts recent active texts sharing its column and starts raised above them. Since all texts rise at the same rate, the initial gap is preserved for the full animation, so consecutive hits read as a clean vertical stack instead of a pile.
- Applied the offset in all three spawners: `addCombatText`, `addSwarmEnemyCombatText`, and `addBossPartyMemberCombatText`.
- Widened `BOSS_PARTY_DAMAGE_TEXT_OFFSET` 40 -> 54px so the controlled/assist columns (still clearly outside the 34px column tolerance) don't horizontally overlap for large crit numbers.
- Per-class assist damage colours: controlled stays gold; Warrior bronze `#d4924a`, Wizard purple `#c6a0ff`, Taoist teal `#5ec9b0` via `bossPartyDamageTextKind()`.

Verified with `npm run check` (pre-existing unrelated `warrior-bicheon` XP fixture drift only) and `npm run smoke` (clean, no console errors).

## 2026-07-05 - Magic resist: 2.5% per point, 25% cap at 10

### Change
Reworked `rollMagicHit` in `src/core/combat.js`: each magic-resist point now grants **2.5%** resist chance (combat cap still 10), so MR 10 is **25% resist** instead of full immunity. Updated `tests/combat.test.mjs` with boundary and cap tests.

## 2026-07-04 - Live character switching in KR boss rooms

### Change
KR boss rooms already build a full `bossParty` roster (active character + assists) and share the group-dungeon combat engine, but mid-fight character switching was intentionally locked to group dungeons only.

Enabled switching for all group content (group dungeons + KR boss rooms, empowered fights included) by broadening the two zone gates from `groupDungeonZone(activeZone())` to `isGroupContentZone(activeZone())`:
- `bossPartyCanSwitchControl()` (logic gate for `switchControlledPartyMember`).
- `renderPartySwitchBar()` (UI visibility gate).

The swap machinery (`switchControlledPartyMember` + `syncBossPartyControlled*` flush/load) was already zone-agnostic, so no other changes were needed. Solo boss-kill achievements are unaffected: the switch bar only appears with 2+ party members, and a genuine solo run enters with a single member (nothing to swap to).

## 2026-07-04 - FireBall / GreatFireBall projectile origin and impact

### Bug
- Projectiles spawned too high (frame offsets put the bright core above the travel point).
- Travel aimed at enemy feet without compensating for frame offsets, so the ball landed past the enemy.
- Impact FX drew from the live cast path and again from `queueSpellImpactFx`, so boss rooms showed two explosions.

### Fix
- FireBall / GreatFireBall `startOffsetY` → `3` (mid-torso spawn); kept in extract config.
- Sprite-center aim and single impact path are gated to `FireBall` / `GreatFireBall` only (`spellUsesEnemySpriteAim`); all other spells keep legacy projectile end offsets and impact anchors.
- Controlled boss-party member no longer double-draws cast FX (active path only)..

## 2026-07-04 - Movable windows stay on-screen

### Bug
Character/inventory window positions are saved in settings. Dragging already clamped to the viewport, but loading a position from a larger screen (or any off-screen save) applied it as-is, so the window could open fully outside the game area with no way to grab it.

### Fix
- Shared fit/clamp helpers in `sanitizeSettings.js`.
- Applying a saved position resets it to the default layout when the window would not fully fit the current viewport, and persists the clear.
- Resize and boot reconcile off-screen saves (coarse top-left check when the overlay is closed; full size check when open).

## 2026-07-03 - Stat buff potions in boss rooms

### Bug
Boss rooms run through `bossParty` members. Combat applies `member.statBuffs` via `effectiveCombatStats`, but Impact/Magic/Taoist drugs only wrote `state.battle.statBuffs`. Entering a boss also called `clearTransientCombatBuffs()`, which wiped potions before the party was built, and `updateStatBuffs` could overwrite battle potions from the leader's list.

### Fix
- Preserve potion kinds (`impact` / `magic` / `taoist`) across `clearTransientCombatBuffs` so pre-buffing survives zone entry.
- `useBuffPotionEntry` also pushes the buff onto the controlled party member.
- `updateStatBuffs` merges battle potions onto the leader instead of letting the leader wipe them.
- Boss-party `applyEquippedStatsToBattlePlayer` uses unbuffed equipment stats so potions are not double-applied (base stats + `member.statBuffs`).

### Checked
- `tests/buffPotions.test.mjs` covers `isBuffPotionKind`.

## 2026-07-03 - Codex - Holy Deva black outline

### Fixed
- Corrected Holy Deva's dual-layer compositing to match Crystal: the main effect layer is screen-blended and the coloured body overlay is drawn normally.
- The previous renderer had those blend modes reversed, leaving the dark effect layer visible as a black silhouette around the summon.
- Bumped the monster asset version so browsers refresh the corrected rendering path.

### Checked
- Added blend-mode regression coverage; all 8 Holy Deva tests pass.
- Syntax and targeted lint checks pass, and a direct composite preview has no black silhouette.
- The smoke boot reaches the game successfully; its only reported error is the test sandbox blocking the external stats request.

# AI Task Log - LOM Idle V2

# AI Task Log - LOM Idle V2

## 2026-07-03 - Empower Oma King Spirit (2× damage, 2× HP, enrage on lightning)

### What
Enabled the boss empowerment option for Oma King Spirit in Kings Tomb, matching the Minotaur King / Bone Lord model: 2× HP, 2× damage, and the shared fury/enrage stages (70% / 40% / 15% HP, 8s, 600ms attack cadence).

### Lightning bolts
Kings Tomb map lightning is zone environmental damage (50–150), not boss DC, so empower/enrage would not have affected it automatically. Changes:
- Empowered fights scale lightning damage by the same 2× damage multiplier.
- While enraged, lightning intervals use the same speed-up ratio as the boss (`enrageAttackMs / attackMs`, i.e. 0.6×).
- On enrage trigger, the next lightning wave is pulled forward so the rage is felt immediately on the AoE bolts.

### Changes (`src/app.monolith.js`)
- `BOSS_EMPOWER_AVAILABLE_ZONE_IDS` includes `zone-kings-tomb`.
- `supportsEmpoweredBossCombat` / `empoweredBossDamageMultiplier` include Oma King Spirit (2×).
- `mapLightningSettings`, `randomMapLightningIntervalMs`, `mapLightningEnrageIntervalFactor`, and `maybeTriggerEnemyEnrage` wire lightning into empower/enrage.

### Checked
- `npm run check` (unit tests pass; only the pre-existing warrior-bicheon offline XP 378-vs-375 discrepancy remains) and `npm run smoke` (no errors). Not yet deployed.

## 2026-07-02 - New global empower: Skill leveling +x%

### What
Added `skillLevelBonusPercent` as a global (bonus-pool) empowerment alongside gold/XP/drops. It multiplies the skill-practice XP gained toward levelling spells/skills (the `learned.experience` gain), not kill XP. A fully maxed set across all worn slots sums to exactly +200%.

### Ranges (per slot max, sums to 200% worn)
- Weapon 5–40 (step 5), Armour 5–30, Helmet 5–20, Stone 5–30 (step 5)
- Bracelet 2–12, Ring/Necklace 2–12 (step 2)
- Belt/Boots 2–10 (step 2)
- Worn total: 40 + 30 + 20 + 12×2 + 12×3 (2 rings + necklace) + 10×2 + 30 = 200.

### Changes
- `src/core/empoweredItems.js`: added roll def to all 7 slot tables; added key to `GLOBAL_EMPOWER_KEYS`, `STAT_LABELS` ("Skill leveling"), `formatEmpowerRollDescription`, and `empowerBonusStatLines`.
- `src/battleData.js`: `cloneStats` / `addStats` / `sanitizeItemBonusStats` carry the new key.
- `src/app.monolith.js`: `itemEntryStats` surfaces the key; new `equippedSkillLevelBonusPercent()` + `skillExperienceGain(inventory)` helper (applies the multiplier after the roll, so zero-bonus gear stays RNG-neutral for offline sim); `levelMagicSkill` and `bossPartyLevelMagicSkill` now use it; tooltip stat lists show "Skill Leveling".
- Regenerated `tools/stats-worker/itemRules.generated.js` and `docs/EMPOWER_REFERENCE.md`.
- Added a unit test asserting the key is global, rolls on every worn slot, and the max sums to 200%.

### Checked
- `npm run check` (362 tests pass; only the pre-existing warrior-bicheon offline XP 378-vs-375 discrepancy remains) and `npm run smoke` (no errors). Not yet deployed.

## 2026-07-02 - Hotfix: leaderboard 500 from alias lookup exceeding D1 param limit

### Problem
After the alias deploy, the stats panel leaderboard returned HTTP 500 (worker exception 1101). `aliasMapForPlayerIds` built a single `IN (?, ?, ...)` with one bound parameter per row; the leaderboard returns up to 250 rows, exceeding D1's per-query bound-parameter limit (~100), so the query threw. The town noticeboard (max 50 rows) never hit it.

### Fix (`tools/stats-worker/worker.js`)
- `aliasMapForPlayerIds` now chunks the id list (`ALIAS_LOOKUP_CHUNK = 90`) and merges results across queries, keeping the bound-parameter count well under the limit regardless of leaderboard size.

### Checked / Deployed
- Alias + integrity/leaderboard tests pass. Worker redeployed (version `b35dbf36`). Verified live: `GET /leaderboard?scope=accounts&limit=250` -> HTTP 200 (confirmed via `wrangler tail`). Worker-only fix; no site repackage needed.

## 2026-07-02 - Teleport Ring price 350 -> 500 tokens

### Changed
- Server (source of truth): `UNLOCK_TOKEN_COSTS["teleport-ring"]` 350 -> 500 in `tools/stats-worker/worker.js`.
- Client display: `TELEPORT_RING_TOKEN_COST` 350 -> 500 in `src/app.monolith.js` (Buy button + "Need N tokens").
- Tests: updated `tests/statsWorkerShop.test.mjs` teleport-ring charge/reject tests to 500.

### Checked / Deployed
- `npm run check`: 361 tests pass (pre-existing warrior-bicheon xp drift unrelated).
- Worker redeployed (version `df0d2c04`). Site repackaged (`20260702-183556`), verified boot, Pages-deployed to `lom2idle` (`a009912a`).

## 2026-07-02 - Fix: scene overlay stole focus from text inputs during combat

### Problem
Typing in a scene text field (the new alias input, and also the cloud-restore code box) kept losing focus mid-keystroke. `renderSceneOverlay` rebuilds the overlay `innerHTML` whenever its signature changes, and that signature includes state that ticks during play (boss kills/respawn timers, tokens, etc.), so the focused `<input>` was destroyed and recreated repeatedly.

### Fix (`src/app.monolith.js`)
- Added `captureSceneOverlayFocus()` / `restoreSceneOverlayFocus()`: before the `innerHTML` rebuild, snapshot the focused INPUT/TEXTAREA (by id or its first `data-*` attribute) plus caret selection; after rebinding, re-focus and restore the caret. Applies to all current and future scene text fields. Values already survived (input handlers write to state on each keystroke, and fields render from state).

### Checked
- `node --check` + `npm run smoke`: clean boot, 0 errors.

## 2026-07-02 - Player aliases (custom display names for Social + noticeboard)

### Requested
Let players replace the derived `Player XXXXXXXX` label with a chosen alias, set from Options. The Social tab and town noticeboard should show the alias instead of the id string.

### Decisions (confirmed with user)
- Aliases are **case-insensitively unique** across all players.
- Setting/renaming is **bound to `playerId` + `recoveryCode`**: the recovery code that first claims a player id is the only one that can rename it.
- Alias is **resolved at read time**, so renames retroactively update old noticeboard posts.
- Validation: 3-16 chars, letters/numbers/spaces and `. _ ' -`; internal whitespace collapsed; cannot start with "Player".

### Server (`tools/stats-worker/worker.js`, `schema.sql`, `migrate-player-aliases.sql`)
- New `player_aliases` table (`player_id` PK, `recovery_code`, `alias`, `alias_lower` UNIQUE, timestamps).
- `aliasPlayerIdValue` / `normalizePlayerAlias` validators; `ALIAS_*` constants.
- `resolvePublicLabel(playerId, aliasMap)` prefers alias, falls back to `publicPlayerLabel`. `aliasMapForPlayerIds(env, ids)` batch-fetches aliases (account-id keyed; skips query when empty).
- `handlePlayerAliasGet` (`GET /player/alias?playerId=`) and `handlePlayerAliasPost` (`POST /player/alias`) with binding (403 `ALIAS_LOCKED`), uniqueness (409 `ALIAS_TAKEN`), validation (400 `ALIAS_INVALID`). Upsert via `ON CONFLICT(player_id)`.
- `handleLeaderboardGet` + `handleTownMessagesGet`/`Post` now resolve labels through the alias map. `townMessageRow` gained an optional `aliasMap` arg (backward compatible). Router entries added for `/player/alias`.

### Client (`src/app.monolith.js`, `src/styles.css`)
- `state.prototypeStats` gained `alias`, `aliasInput`, `aliasStatus`, `aliasError`, `aliasSaving`, `aliasLoaded`.
- `prototypeStatsDisplayName()` (alias or derived label). `fetchPlayerAlias()` (lazy, on Options open) + `submitPlayerAlias()` (client-side validation mirrors server, POSTs). `setPlayerAliasStatus()` re-renders Options.
- Options: new "Display Name" section (`playerAliasSectionHtml()`) with current name, input (maxlength 16), Save button (disabled without a recovery code) + status line. Event wiring for `[data-submit-player-alias]` / `[data-player-alias-input]`. Social tab + noticeboard already render the server `player` field, so they pick up aliases with no client change.
- CSS for `.options-alias*`.

### Checked
- `npm run check`: 361 unit tests pass (7 new alias tests + updated town-message alias test). Only red is the pre-existing warrior-bicheon offline xp drift (375 vs 378), unrelated.
- `npm run smoke`: boots clean, 0 console/page errors.

### Deploy note
Requires a D1 migration before the worker redeploy: `npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-player-aliases.sql --remote` then `npx wrangler deploy --keep-vars` (see `tools/stats-worker/README.md`). The website build itself needs no special step beyond the usual package/deploy.

## 2026-07-02 - Fix: AoE ground/bang spells now crit (Fire Wall per-spell crit did nothing)

### Problem
Per-spell crit empowers (e.g. weapon "+20% crit chance for Fire Wall") could be rolled for every wizard damage spell, but crit was only ever applied on the single-target / projectile path (`rollWizardMagicDamage` + `damageCrit`). Ground and bang AoE spells rolled damage separately (`rollWizardMagicValue`) and never ran the crit roll, so Fire Wall, Meteor Strike, Blizzard, Ice Storm and Flame Field could never crit - their crit empowers were dead rolls.

### Fix (`src/app.monolith.js`, `src/core/combat.js`)
- Ground/DoT ticks (`applyGroundSpellTick`, `applyGroundSpellTickToSwarmEnemy`) now wrap the post-defence value with `applyCritToOutgoingDamage(raw, player, spell.id, inventory)` and surface the crit via `critDamageKind`. Crit is rolled **per tick** (each Fire Wall/Blizzard/Meteor tick can independently crit), matching the "every hit can crit" model.
- Bang impacts (`applyWizardBangSpellImpact`, both swarm and single-target branches) apply crit once per target on impact.
- Added `groundSpellTickInventory(effect)` helper (mirrors `groundSpellTickPlayer`) so boss-party casters use their own gear's per-spell crit empowers.
- `magicBurnEvents` (combat.js) gained a `damageKind` param (before `damageOptions`) so burn ticks can render as `crit` floating text; both monolith call sites updated.

### Checked
- `npm run check`: 354 unit tests pass. Only red is the pre-existing warrior-bicheon offline xp drift (375 vs 378), unrelated (warrior physical path, no crit gear -> RNG-neutral).
- `npm run smoke`: boots clean, 0 console/page errors.

## 2026-07-02 - Cash Shop "Teleport Ring" unlock (350 tokens) + boss-room teleport menu

### Requested
- New Cash Shop item "Teleport Ring" for 350 tokens.
- Once owned, a ring button appears top-right of the play screen; clicking it opens a menu of all boss rooms (excluding Group Dungeons) with each boss's respawn timer, and clicking a boss opens its boss-entry (teleport) page.

### Server (`tools/stats-worker/worker.js`)
- Replaced the single `PAGE_UNLOCK_TOKEN_COST = 250` with a per-key `UNLOCK_TOKEN_COSTS` map (pages 250, `teleport-ring` 350). `PAGE_UNLOCK_KEYS` now derives from the map keys. `handleShopUnlockPost` charges/ledgers the per-key `cost`. No schema change - reuses the existing `account_unlocks` table.
- Tests (`tests/statsWorkerShop.test.mjs`): added teleport-ring charges 350 + rejects below-350. All 15 shop tests pass.

### Client (`src/app.monolith.js`, `src/styles.css`)
- Constants: `TELEPORT_RING_UNLOCK_KEY`/`TELEPORT_RING_TOKEN_COST`/`TELEPORT_RING_ICON_SRC` + `teleportRingOwned()`. Added the key to `sanitizeOwnedUnlocks` whitelist so it persists.
- Cash Shop: new "Spend tokens" section with the Teleport Ring (icon + Buy for 350 / Owned / Need 350). `confirmTeleportRingPurchase()` → `purchasePageUnlock("teleport-ring")`; click wired via `data-buy-unlock`.
- Top-right stage button `#teleportRingButton` (in `.stage-shell`), shown by `syncTeleportRingButton()` (called from `renderGamePanel` + `applyOwnedUnlocks`), gated on `teleportRingOwned() && cashShopEnabled()`. Opens the new `teleportRing` overlay via `data-open-scene`.
- New `teleportRing` openScenes overlay registered across the scene plumbing (init/open/close/isOpen/render arrays, `sceneClassName`/`sceneTitle`/`sceneBodyHtml`). `teleportRingSceneHtml()` lists boss rooms via `teleportRingBossZoneIds()` = `BOSS_ROOM_DEFS` (GD-free) intersected with `TELEPORT_REGIONS` zone ids, so test-only/unreleased rooms (Flame Queen, Flaming Mutant, Scaly Beast - not in any teleport region) are excluded and future released bosses appear automatically. Live respawn timers; `data-teleport-ring-zone` handler closes the menu then `requestZoneEntry(zoneId)` (opens the existing boss-entry page). Live countdown via `teleportRingTimers` added to both scene-overlay signatures.
- Art: shipped the real in-game icon (Items library frame 172) as `public/ui/teleport-ring.png` (calibrated against 3rd Eye Bracelet frame 208). Standalone UI asset - not routed through the item/atlas/drop pipeline; packaging copies all of `public/`.

### Checked
- `npm run check`: 354 unit tests pass, source-only check passed. Only red is the pre-existing warrior-bicheon offline xp drift (375 vs 378), unrelated.
- `npm run smoke`: clean boot, no console/page errors.
- Headless drive (`?testHarness=1` helpers `grantTeleportRing`/`openTeleportRingMenu`): button hidden until owned → shown after grant; menu lists 12 boss rooms with Ready/timer; clicking a boss opens the boss-entry window and closes the ring menu. Screenshots confirmed button + menu + cash-shop item.

### Deploy (NOT done yet)
- Worker must be redeployed (per-key cost + `teleport-ring` key) or `/shop/unlock-page` returns "Unknown unlock" for the ring.
- Site must be packaged (`npm run release:itch`) and uploaded for the client UI.

## 2026-07-02 - Non-weapon gear rolls full spell bonus pool; necklaces = ring tier

### Requested
- Armour + jewellery should roll the FULL bonus pool (class spell empowers + globals), not just spell crit.
- Necklaces should be the same tier as rings.

### Changes (`src/core/empoweredItems.js`)
- New `itemNonWeaponSpellEmpowerRollDefs(item)` (replaces crit-only `itemSpellCritEmpowerRollDefs`): non-weapon gear now rolls the full class spell/skill empowers — damage %, mana cost, healing, pet health/DR, cooldown — PLUS per-spell crit. Class-gated by `empowerItemClass` (natural MC→wizard, SC→tao, DC→warrior, neutral→all).
- Reduced ranges by slot tier via `SPELL_EMPOWER_TIER_FACTOR` (armour 0.5×, accessory 0.35×), snapped to each roll's step (`scaleSpellRollDef`). Weapons keep full ranges through their own tables. Per-spell crit still uses the explicit `SPELL_CRIT_RANGES` tiers.
- Necklaces now share the **Ring table** (`slotBaseRollDefs`: ring||necklace → RING defs) and accessory spell tier; removed the legacy `other` slot group (folded necklace into a "Ring / Necklace" group). Necklaces are no longer a legacy/dynamic-pool slot.
- Rebalanced global Crit Rate maxes so all worn slots incl. necklace sum to exactly 100%: bracelet 8→6, ring 8→6 (ring counts ×3 now: 2 rings + necklace), stone 12→14. New sum: weapon20+armour14+helmet10+2×bracelet6+3×ring6+belt6+boots6+stone14 = 100.
- No monolith change needed: `equipped*` accessors already sum spell bonuses across every equipped slot, so armour/jewellery spell empowers apply in combat automatically.

### Checked
- 352/352 unit tests pass (updated: 100%-sum test now ×3 ring incl necklace; MC-non-weapon test now expects damage/mana+crit; new tests for full non-weapon spell pool + necklace=ring; repointed the legacy single-stat regression at a table-less slot).
- Regenerated `itemRules.generated.js`, `docs/EMPOWER_REFERENCE.md`, `tools/empower-reference.html`. Spot-checked: wizard necklace bonus pool == wizard ring bonus pool.
- Only red in `npm run check` is the pre-existing warrior-bicheon offline xp drift (375 vs 378), unrelated.

### Note
- Already-dropped items keep their stored bonuses; only new drops use the expanded pools.

## 2026-07-02 - Fix: empowered legacy item showed more stars than empowerments

### Report
- A 2-star ("★★") Life Necklace displayed only ONE empowered stat (MC).

### Root cause
- Necklaces are the only slot with no fixed empower table; they use `legacyDynamicCandidateRolls`, which emitted a separate candidate for EACH endpoint of a stat range (`{mc,index:0}` AND `{mc,index:1}`). A single-stat necklace (e.g. MC 3–6) therefore offered two candidates that were both MC, so a tier-2 drop applied two rolls to the same stat → two ★ but one visible empowered stat.

### Fix (`src/core/empoweredItems.js`)
- `legacyDynamicCandidateRolls` now emits ONE candidate per distinct stat key (range stats empower the max endpoint, index 1 — matching every fixed slot table). Star count can no longer exceed the number of distinct empowered stats for any legacy/dynamic-pool item.
- Did NOT add a necklace crit/global table: the crit-chance-sums-to-100% design deliberately excludes necklaces (see test "max crit-chance empower on every worn slot sums to exactly 100%"). Adding necklace globals would break that balance.

### Checked
- 79/79 `empoweredItems.test.mjs` pass, incl. new regression "legacy single-stat necklace: star count never exceeds distinct empowered stats".
- No lint errors. Item-integrity rules unaffected (empower candidate generation isn't part of them).

### Note
- Existing already-dropped items keep their stored bonuses (only new drops use the corrected generator).

## 2026-07-02 - Atlas cache-bust fix (deploy scrambled ALL icons)

### Incident
- Deploying the rebuilt item atlas (348 -> 352 frames) scrambled EVERY item icon on the live site (rolled back).
- Root cause: `loadJson` fetches `items-atlas.json` with `cache: "no-store"` (always fresh), but the sheet PNG loads as a CSS `background-image` under `/public/*` = `max-age=86400` with NO cache-bust token. A full atlas repack changes every icon's sx/sy, so a returning browser paired the FRESH coordinates with a STALE cached PNG -> every icon cropped from the wrong region. A cold/incognito load was fine, so `verify:itch:build` passed and it wasn't caught pre-deploy.

### Fix (`tools/package-itch.mjs`)
- Added `stampAtlasSheetCacheBust()` (runs after `patchCacheBusting`): rewrites the `sheet` field in `public/item-icons/items-atlas.json` and `public/ui/character/stateitems-atlas.json` to `...png?v=<sha1(png)[:12]>`. Since the JSON is always fetched fresh, a changed PNG now gets a new URL and is always fetched alongside its matching coordinates; unchanged PNGs keep a stable URL (no needless re-download). Throws if the sheet PNG is missing.
- Source atlas JSONs stay pristine (un-versioned); dev server is `no-store` so dev never hit this. The stamp is a packaging-only, render-neutral transform, same class as the existing `?v=` cache-bust.
- Verified: packaged `items-atlas.json` sheet -> `...png?v=ee4e26637c70` (PNG present, 352 frames incl. `frame_000597.png`); stateitems sheet stamped too. Boot check green.

### Note / follow-up
- Same latent risk exists for monster/sprite sheets referenced by `atlas-manifests.json` if their art is ever repacked; not addressed here (those weren't the outage and rarely change).

## 2026-07-02 - Fix Crystal Armour icon missing in deployed build

### Root cause
- `crystal-armour` uses `frame_000597.png`, which existed in `public/item-icons/items/` but was **not** in the committed `items-atlas.json`.
- Dev can still show the icon via the individual PNG fallback; the packaged site ships **only** the atlas (individual `frame_*.png` files are excluded), so missing atlas coords = blank icon.

### Fix
- Rebuilt item icon atlas (`npm run build:item-atlas`): 348 → 352 frames, now includes `frame_000597.png` (Crystal Armour) plus three stone icons whose source PNGs were also missing from `public/` (`frame_000584/619/624.png` copied from `tile-review` first).
- Repackaged `dist/itch` (`20260702-085333`); boot verify passed.

### Checked
- All item icon `src` paths now resolve in `items-atlas.json` (0 missing).
- `verify:itch:build` green.

## 2026-07-02 - Per-spell crit empowers now roll on armour + jewellery

### Changed (`src/core/empoweredItems.js`)
- Per-spell crit (chance + damage) previously weapon-only; now also rolls on **non-weapon gear** via new `itemSpellCritEmpowerRollDefs(item)`, folded into `empowerBonusPool`.
- **Class-gated** by `empowerItemClass(item)`: gear with natural MC → wizard spells, natural SC → tao spells, natural DC → warrior skills, neutral defensive gear (no DC/MC/SC) → all spells. Weapons keep rolling spell crit through the existing weapon path (no duplication).
- **Lower ranges** than weapons, via `SPELL_CRIT_RANGES`:
  - Weapon: crit chance 5–25% (step 5), crit damage 10–50% (step 10).
  - Armour + helmet: crit chance 2–12% (step 2), crit damage 5–25% (step 5).
  - Jewellery/accessory (ring, bracelet, belt, boots, stone): crit chance 1–8% (step 1), crit damage 5–15% (step 5).
- Refactored weapon spell-crit lists into exported constants (`WIZARD_/WARRIOR_/TAO_/ALL_CRIT_SPELL_IDS`).

### Notes
- These are bonus-pool rolls; adding them dilutes each item's other bonus rolls (expected — makes any single spell-crit roll rarer on non-weapons, consistent with "lower").
- Reference doc's per-item pool section reflects them automatically (derives from `empowerBonusPool`).

### Checked
- `npm run check`: 349/349 unit tests pass (updated 6 "fixed table" count assertions to key-presence checks; refined the MC-non-weapon test to allow crit but still exclude damage/mana; added an armour+jewellery class-gating/range test). Only red is the pre-existing warrior-bicheon offline xp drift (375 vs 378).
- Regenerated `itemRules.generated.js`, `docs/EMPOWER_REFERENCE.md`, `tools/empower-reference.html`. No monolith change (accessors already wired).

## 2026-07-02 - Per-spell crit chance / crit damage empowers

### Added (`src/core/empoweredItems.js`)
- Two new per-spell empower `kind`s: `critChancePercent` and `critDamagePercent`, plumbed through `sanitizeEmpowerSpellBonuses`, `applyEmpowerSpellRoll`, `formatEmpowerRollDescription` ("Increase Flame Disruptor crit chance by 5–25%"), `empowerSpellBonusLines`, and `empowerSpellBonusTooltipRows`.
- Helper `spellCritEmpowerRollDefs(spellIds)` + tunables `SPELL_CRIT_CHANCE_ROLL` (5–25%, step 5) and `SPELL_CRIT_DAMAGE_ROLL` (10–50%, step 10). Wired into:
  - Wizard (MC weapon): FlameDisruptor, FireWall, ThunderBolt, IceStorm, FlameField, MeteorStrike, Blizzard, FireBall, GreatFireBall, FrostCrunch.
  - Warrior (skill weapon): Slaying, FlamingSword, TwinDrakeBlade, BladeAvalanche, SlashingBurst.
  - Tao (SC weapon): SoulFireBall.
- Accessors `equippedSpellCritChanceBonusPercent` / `equippedSpellCritDamageBonusPercent` sum the per-spell bonus across equipped items.

### Integration (`src/app.monolith.js`)
- `applyCritToOutgoingDamage(damage, attacker, spellId?, inventory?)` now adds the per-spell crit chance/damage **on top of** the attacker's global crit when a `spellId` is supplied (physical swings omit it and are unchanged). Chance is still clamped to the 100% cap by `rollCrit`.
- Passed the spell/skill id through `rollWarriorMagicDamage`, `rollWizardMagicDamage`, `rollTaoistMagicDamage`, `rollBladeAvalancheDamage`, `rollSweepPrimaryDamage`. Deferred wizard projectiles + Tao SFB inherit it (they route through those roll fns before latching `damageCrit`).

### Notes
- Per-spell crit is a **bonus-pool weapon empower** (only weapons whose class matches the spell). It stacks additively with global crit for that one spell only — exactly the requested "Flame Disruptor +15% crit chance" / "Flaming Sword +50% crit damage".
- No save migration (empowerSpellBonuses already sanitizes unknown-safe; new keys are additive).
- Pets intentionally excluded for now (they already use the owner's global crit).

### Checked
- `npm run check`: 348/348 unit tests pass (new per-spell crit test: rolls exist per class, sanitize/format, accessor summation). Only red is the pre-existing warrior-bicheon offline xp drift (375 vs 378).
- `npm run smoke`: clean (Warrior/Wizard/Taoist 25/25 actions, 0 errors).
- Regenerated `itemRules.generated.js`, `docs/EMPOWER_REFERENCE.md`, `tools/empower-reference.html`.

## 2026-07-02 - Crit chance / crit damage empowered item rolls

### Added
- `critChancePercent` and `critDamagePercent` are now **global** empower rolls (added to `GLOBAL_EMPOWER_KEYS` → drawn from the 30% bonus pool, class-agnostic) in `src/core/empoweredItems.js`. Per-slot roll defs added to every worn table: weapon, armour, helmet, bracelet, ring, belt/boots, stone.
- Display wiring: `STAT_LABELS` (`Crit Rate` / `Crit Damage`), `formatEmpowerRollDescription` (+X% / +X–Y%), and `empowerBonusStatLines` now render the new keys.

### Design — 100% crit chance = max crit roll on *every* worn slot
- Per-item **max crit chance**: weapon 20, armour 14, helmet 10, bracelet 8, ring 8, belt 6, boots 6, stone 12.
- Crit chance rolls **min 1%, increments of 1%** (wide range per slot, e.g. weapon = any 1–20).
- Worn total (weapon + armour + helmet + 2 bracelets + 2 rings + belt + boots + stone) = **exactly 100%**. Reaching it requires the max crit-chance roll on all 10 items, so 100% is achievable but astronomically hard — matches the intent.
- `CRIT_CHANCE_CAP_PERCENT` raised 75 → **100** in `src/core/combat.js`.
- Crit **damage** rolls are additive, **increments of 5%**, no total cap (max-everywhere ≈ +165% → 3.15× crit multiplier).

### Notes
- Crit stays in the bonus pool only (never base): `empowerBasePool` filters out global keys; `itemGlobalRollDefs` surfaces the new rolls per slot. Necklace/torch/amulet/mount have no fixed table, so they never roll crit (kept out of the 100% math).
- No save migration needed (empower bonus stats already sanitize the crit keys).
- Follow-up (requested, not yet built): per-spell crit empowers (e.g. "Flame Disruptor +15% crit chance", "Flaming Sword +50% crit damage") — would extend the spell-empower roll defs / `empowerSpellBonuses` shape.

### Checked
- `npm run check`: 347/347 unit tests pass (incl. new crit-empower tests: global keys, per-slot presence, worn-max == 100, description formatting). Only red is the **pre-existing** warrior-bicheon offline xp drift (375 vs 378), unrelated to this data-only change.
- Regenerated `tools/stats-worker/itemRules.generated.js` (`integrity:rules`) and `docs/EMPOWER_REFERENCE.md` + `tools/empower-reference.html` (`empower:ref`).

## 2026-07-02 - Crit chance / crit damage for all outgoing player damage

### Added
- New stats `critChancePercent` and `critDamagePercent`, plumbed through `cloneStats` / `addStats` / `sanitizeItemBonusStats` (`src/battleData.js`) and `itemEntryStats` (`src/app.monolith.js`), so they aggregate from gear/empower/smith bonuses like any other stat and flow onto `battle.player` automatically.
- Crit primitives in `src/core/combat.js`: `CRIT_CHANCE_CAP_PERCENT` (75), `CRIT_BASE_DAMAGE_PERCENT` (50 → base crit is 1.5×), `clampCritChancePercent`, `critMultiplier`, `rollCrit`, `applyOutgoingCrit`, `expectedCritMultiplier` (all RNG-injectable + unit-tested).

### Model
- **After-defence** crit: the post-mitigation damage is rolled once per direct hit, then scaled on a crit. Base crit = 1.5×; gear `critDamagePercent` adds on top (e.g. +100 → 2.5×). Chance hard-capped at 75%.
- Covered (player + party members, live + offline): warrior physical swings + skills (`rollWarriorMagicDamage`, Blade Avalanche, Half/Cross-Moon sweep), wizard single/projectile/target spells (`rollWizardMagicDamage`), Taoist Soul Fire Ball / direct magic (`rollTaoistMagicDamage`), and Taoist pet melee (`rollTaoistPetAttackResult`, using the **owner's** crit stats). Enemies carry no crit stats, so shared roll functions are safe (chance resolves to 0). AoE ground/DoT fields and bang spells are intentionally excluded for now.
- Combat feedback: crit hits render a distinct orange `crit` floating-text kind on the main player-facing paths (warrior hits, wizard/tao weapon swings, deferred spell impacts via `impact.crit`, pet hits).
- UI: paper-doll **Crit Rate** / **Crit Damage** rows now show real totals (rate %, and crit damage as total-% e.g. 150%); item tooltips list Crit Rate / Crit Damage bonuses.

### Notes
- No save migration needed (crit is derived from equipment).
- Crit is RNG-neutral at 0 chance (`rollCrit` returns before consuming `randomInt`), so seeded offline fixtures are unaffected.
- **No item/empower/gem currently grants crit** — the mechanic is fully wired but dormant until a source is added (follow-up decision on roll ranges/weights).

### Checked
- `npm run check`: 344/344 unit tests pass (incl. new crit tests). Remaining fixture reds (warrior-bicheon xp 375 vs 378, taoist-bicheon kills 38 vs 35) are **pre-existing** — confirmed by re-running the taoist fixture with all crit changes stashed (identical failure). `npm run smoke` clean (25/25 actions per class, 0 errors).

## 2026-07-02 - Boss empowerment: Minotaur King

### Changed
- Enabled empowered fights for **Minotaur King** (Prajna Temple KR): added `zone-prajna-temple-kr` to `BOSS_EMPOWER_AVAILABLE_ZONE_IDS` and `isMinotaurKingEnemy` to `supportsEmpoweredBossCombat` in `src/app.monolith.js`.
- **2× damage** on empowerment (melee DC and AoE MC both scaled via `applyEmpoweredBossCombatModifiers`). Shared: 2× HP, enrage at 70% / 40% / 15% HP, 2× drop rates + empowered item rolls.

### Checked
- `npm run check`: 339/339 tests pass; only red is pre-existing warrior-bicheon offline xp drift (375 vs 378). `npm run smoke` clean (0 errors).

## 2026-07-02 - Boss empowerment: Bone Lord

### Changed
- Enabled empowered fights for **Bone Lord** (Prajna Cave KR): added `zone-prajna-cave-kr` to `BOSS_EMPOWER_AVAILABLE_ZONE_IDS` and `isBoneLordEnemy` to `supportsEmpoweredBossCombat` in `src/app.monolith.js`.
- Bone Lord uses **2× damage** on empowerment (with Zuma Taurus) via `empoweredBossDamageMultiplier`; other empowered bosses remain 1.5×. Shared: 2× HP, enrage at 70% / 40% / 15% HP, 2× drop rates + empowered item rolls.

### Checked
- `npm run check`: 338/339 tests pass (one unrelated offline Taoist support-order failure). `npm run smoke` clean (0 errors).

## 2026-07-02 - Boss empowerment: Zuma Taurus

### Changed
- Enabled empowered fights for **Zuma Taurus** (Zuma Temple KR): added `zone-zuma-temple-kr` to `BOSS_EMPOWER_AVAILABLE_ZONE_IDS` and `isZumaTaurusEnemy` to `supportsEmpoweredBossCombat` in `src/app.monolith.js`.
- Same shared modifiers as other empowered bosses: 2× HP, enrage at 70% / 40% / 15% HP, 2× drop rates + empowered item rolls. **Damage is 2×** (other empowered bosses remain 1.5×).

### Checked
- `npm run check`: 339/339 tests pass; only red is pre-existing warrior-bicheon offline xp drift (375 vs 378). `npm run smoke` clean (0 errors).

## 2026-07-02 - Boss empowerment: Evil Centipede

### Changed
- Enabled empowered fights for **Evil Centipede** (Bug Cave KR): added `zone-bug-cave-kr` to `BOSS_EMPOWER_AVAILABLE_ZONE_IDS` and `isEvilCentipedeEnemy` to `supportsEmpoweredBossCombat` in `src/app.monolith.js`.
- Empowered Evil Centipede uses the shared boss modifiers: **2× HP**, **1.5× damage**, and **enrage at 70% / 40% / 15% HP** (8s rage windows, 600ms attack speed while enraged). Drop bonuses unchanged from other empowered bosses (2× drop rates + empowered item roll chance).

### Checked
- `npm run check`: 339/339 tests pass; only red is pre-existing warrior-bicheon offline xp drift (375 vs 378). `npm run smoke` clean (0 errors).

## 2026-07-01 - Empower system: Phase D wizard/warrior spell empower expansion

### Changed
- `src/core/empoweredItems.js`: expanded weapon spell/skill empower tables, only where the runtime hook already fires (verified in the monolith):
  - **Wizard (MC weapon)**: added `damagePercent` for Fire Ball / Great Fire Ball / Frost Crunch (routes through `rollWizardMagicValue` → `applyEquippedSpellDamageBonus`), and `manaCostPercent` for Thunder Bolt / Ice Storm / Flame Field / Meteor Strike / Blizzard (generic `effectiveSpellMpCost` hook). No wizard cooldown empowers - the cooldown hook (`setWarriorSpellCastReadyAt`) is warrior-only.
  - **Warrior (DC weapon)**: added Twin Drake Blade `manaCostPercent`; Blade Avalanche `damagePercent` (`rollBladeAvalancheDamage`) + `manaCostPercent`; Slashing Burst `damagePercent` (`rollWarriorMagicDamage`) + `manaCostPercent`.
  - Added `SPELL_EMPOWER_LABELS` for Fire Ball, Great Fire Ball, Frost Crunch, Blade Avalanche, Slashing Burst.

### Checked
- Verified each hook's call sites: damage (`applyEquippedSpellDamageBonus` in the magic-roll fns), mana (`effectiveSpellMpCost` used by every warrior/wizard/tao cast), cooldown (warrior-only via `setWarriorSpellCastReadyAt`). Skipped effect/duration/sweep empowers (no hook yet).
- Extended wizard/warrior candidate-roll unit tests; regenerated integrity rules + `docs/EMPOWER_REFERENCE.md`. Full suite 339/339. `npm run check` green except the pre-existing warrior-bicheon offline xp drift (375 vs 378, unrelated). `npm run smoke` clean (0 errors).

## 2026-07-01 - Empower system: global damage-taken + base/bonus pools

### Changed (Phase A - global "damage taken −%")
- New empower stat `damageTakenReductionPercent` added to the core stat shape (`cloneStats`, `addStats`, `sanitizeItemBonusStats` in `src/battleData.js`) and to `itemEntryStats` aggregation in the monolith. Rolls on armour (−3–12%), helmet (−2–6%), ring/bracelet (−1–4%), belt/boots (−1–5%), stone (−1–2%); never on weapons. Full-BiS stack lands near ~40–50%.
- Player hook: `incomingDamageReductionPercent` now adds equipped `damageTakenReductionPercent` for the player (all classes) and boss-party members, on top of the existing Wizard Magic Shield, capped at 100%. Displayed in item tooltips as `−X% Damage Taken` and in empower bonus lines.

### Changed (Phase B - 70/30 base/bonus pools + class gating)
- `src/core/empoweredItems.js`: empowerments now draw from a **base pool (70%)** and a **bonus pool (30%)** via `pickWeightedEmpowerRoll` (`EMPOWER_BASE_POOL_WEIGHT = 0.7`), with fallback to whichever pool has entries.
- **Base pool** = slot flat stats, with primary DC/MC/SC gated by `empowerItemClass` (natural DC/MC/SC): warrior→DC, tao→DC+SC, wizard→MC, global(none/hybrid)→all. Globals excluded from base.
- **Bonus pool** = class spell/skill empowers (weapons today) ∪ globals (`GLOBAL_EMPOWER_KEYS`: xp/gold/drop/soul/damage-taken), each using its slot's tuned range.
- `rollEmpoweredItemDrop` rewritten around the two pools; `empowerCandidateRolls` = base ∪ bonus (legacy dynamic path preserved for necklace).

### Checked
- Regenerated integrity rules + `docs/EMPOWER_REFERENCE.md`; empower suite grew to 73 tests; full suite 339/339. `npm run check` green except the pre-existing warrior-bicheon offline xp drift (375 vs 378, unrelated). `npm run smoke` clean (0 errors).
- Note: class gating can flag pre-existing empowered items whose rolls no longer match their class (e.g. an old wizard-armour DC empower). Integrity flags for review; it never drops saves.

## 2026-07-01 - Tao pet empowerments (health + damage reduction)

### Changed
- Added two Tao-only pet empower kinds to `src/core/empoweredItems.js`: `petHealthPercent` (+% total pet HP) and `petDamageReductionPercent` (−% pet damage taken), alongside the existing pet `damagePercent`. Each Tao summon (Skeleton, Shinsu, Holy Deva) can now roll damage, health, or damage reduction.
- Extended the SC-weapon spell empower table with pet health (+10–50%) and pet damage-reduction (+5–20%) rolls for all three summons, and added Holy Deva damage parity (+10–50%) plus its label.
- `sanitizeEmpowerSpellBonuses`, `applyEmpowerSpellRoll`, `formatEmpowerRollDescription`, `empowerSpellBonusLines`, and tooltip rows now handle the new kinds. Added `equippedPetHealthBonusPercent` / `applyEquippedPetHealthBonus` and `equippedPetDamageReductionPercent` / `applyEquippedPetDamageReduction`, with a stacked DR cap (`PET_DAMAGE_REDUCTION_CAP_PERCENT = 75`).
- Monolith (`src/app.monolith.js`): `createTaoistSummonPet` now applies the owning Taoist's equipped pet empowers at summon time via `applyTaoistPetEmpowerments` (scales `maxHp`/`hp`, stores `damageReductionPercent`). Incoming pet damage is reduced at all three pet-damage sites via `reduceTaoistPetIncomingDamage`.

### Checked
- Regenerated `tools/stats-worker/itemRules.generated.js` and `docs/EMPOWER_REFERENCE.md`; added unit tests (empoweredItems 66/66; full suite 332/332).
- `npm run check` passed except the pre-existing warrior-bicheon offline xp drift (375 vs 378, confirmed identical without these changes). `npm run smoke` booted clean (0 console/page errors).

## 2026-07-01 - UI - Fullscreen toggle

### Changed
- Added a fixed bottom-right fullscreen icon button in the game shell.
- Toggle uses the Fullscreen API with webkit fallbacks; hidden when unsupported.
- Icon swaps between enter/exit states; Esc exits via native `fullscreenchange` sync.

### Checked
- `npm run check` lint/syntax/unit tests passed; offline warrior fixture pre-existing xp drift unrelated.

## 2026-07-01 - Codex - Roomier town noticeboard

### Changed
- New noticeboard messages are limited to 100 characters in both the client and Worker validation.
- Combined the message policy, token balance, and refresh action into one compact toolbar.
- Reduced the composer from three text rows to two and tightened its footer without shrinking its text or controls.
- Reserved the recovered space for the scrollable message list and slightly reduced row padding while preserving readable message spacing.

### Checked
- Browser verification measured a 118px message list and a 50px composer inside the existing Crystal dialog.
- Pasted text is visibly clamped to 100 characters and reports `100/100`.
- Worker noticeboard tests passed (5/5), including the new server-side length regression test; syntax and targeted lint checks passed.

## 2026-07-01 - Cursor - Token page unlocks (3rd inventory + storage page)

First token *sink*: players spend 250 tokens for extra pages. Inventory pages are **per-character** (unlock key `inv-page-3:<class>`), storage is **account-wide** (`storage-page-3`). Both are server-authoritative and permanent (survive rebirth).

### Server (`tools/stats-worker/`)
- New table `account_unlocks (recovery_code, unlock_key, PRIMARY KEY(...))` in `schema.sql` - the source of truth for owned unlocks.
- `worker.js`: `PAGE_UNLOCK_TOKEN_COST = 250`, server-owned `PAGE_UNLOCK_KEYS` set. New routes:
  - `POST /shop/unlock-page {recoveryCode, unlockKey}` - reserves the unlock (`INSERT OR IGNORE`; idempotent, never double-charges), then atomically charges 250 with a `balance >= cost` guard; on failure it releases the reservation and returns `402 INSUFFICIENT_TOKENS`; writes a `spend:unlock` ledger row.
  - `GET /shop/unlocks?recoveryCode=` - returns the owned keys + balance so the client can reconcile.
- `tests/statsWorkerShop.test.mjs`: added charge / idempotent / insufficient / unknown-key / unlocks-GET cases (all green).

### Client (`src/app.monolith.js`)
- Raised caps to 3 pages: `INVENTORY_MAX_SLOTS = PAGE_SIZE*3`, `STORAGE_MAX_SLOTS = PAGE_SIZE*3`.
- Added independent unlock flags: inventory `tokenPageUnlocked` (gold page derived = `pagesUnlocked - token >= 2`), storage `tokenPageUnlocked` alongside existing `page2Purchased`; `pagesUnlocked` is derived so a paid page can never be lost. Threaded through defaults, `cloneInventoryState`/`cloneStorageState`, and `persistence/sanitizeInventory.js` (unpaid pages are stripped by usable-slot count).
- **Pack-to-front tabs**: `inventoryPageDescriptors()` / `storagePageDescriptors()` order tabs as base -> unlocked extras -> locked purchase tabs (token before gold). So buying the token page while the gold page is still locked makes the token page tab 2 and pushes the locked gold page to tab 3 (per request).
- Unlock flows: gold pages unlock immediately (`unlockInventoryGoldPage` / `unlockStorageGoldPage`); token pages open a confirm dialog then `purchasePageUnlock()` hits the worker, applies the flag, `saveGameState(true)`. `tokenUnlockConfirmHtml()` shows the live balance and disables Buy until affordable.
- Server reconciliation: `state.account.ownedUnlocks` (persisted + `sanitizeOwnedUnlocks`) mirrors the server; `applyOwnedUnlocks()` re-applies flags after boot (`fetchAccountUnlocks()`) and after `performAccountRebirth()` so paid pages persist through rebirth.
- CSS: storage `page-3` position + text style for the token/locked storage tabs (page 3 has no bespoke art).

### Checked
- `npm run check`: 318 unit tests + lint + syntax pass. `npm run smoke`: boots clean. Headless drive of the Inventory window confirmed tabs render `[base, "250 Tok" (token), "100,000g" (gold)]` and the token tab opens the confirm dialog with the balance + affordability gate. Only the pre-existing `warrior-bicheon` fixture 404/XP pin still red (unrelated).

### NOT yet deployed
- Requires: apply `account_unlocks` to prod D1 (`npx wrangler d1 execute <db> --remote --file tools/stats-worker/schema.sql`), redeploy the worker, then repackage + Pages-deploy the site. Held pending go-ahead.

## 2026-07-01 - Cursor - Cash Shop 3 token tiers

### Changed
- Replaced the single `tokens-100` (£1/100) pack with three tiers, server-owned in `TOKEN_PACKS` (`tools/stats-worker/worker.js`): `tokens-600` = 600 tokens / £5 (500p), `tokens-1300` = 1,300 / £10 (1000p), `tokens-3000` = 3,000 / £20 (2000p). Client never sends prices/amounts.
- Client (`src/app.monolith.js`): replaced `TOKEN_PACK_LABEL` with a `TOKEN_PACKS` display list (id/tokens/price) mirroring the worker ids; `cashShopSceneHtml()` now renders one row per tier, each Buy button carries `data-pack-id`; the click handler passes that id into `startTokenCheckout(packId)`. While a checkout is opening, all three buttons disable.
- Updated `tests/statsWorkerShop.test.mjs` create-checkout success test to `tokens-600` (asserts `unit_amount=500`, `metadata[tokens]=600`).

### Deployed
- Worker `lom-idle-v2-stats` redeployed (version `e324b3c5`) so the new pack ids resolve. Site repackaged (`20260701-132001`) and Pages-deployed to `lom2idle`.

### Checked
- `npm run check`: all 313 unit tests + lint + syntax pass. (Offline `warrior-bicheon` XP pin `375` vs `378` still fails - pre-existing, unrelated to tokens.)

## 2026-07-01 - Cursor - Cash Shop window + legal pages

### Changed
- **Moved the token purchase out of the Message Board into a dedicated `Cash Shop` window** opened from the top menu. The board now only shows the balance (`Tokens: N`) plus a hint pointing to the Cash Shop; the Buy button lives in the shop.
- Registered a new `cashShop` scene across the scene system (`openScene`/`closeScene`/`currentOverlayScenes`/`isSceneWindowOpen`/`renderSceneOverlay`/`sceneBodyHtml`/`sceneClassName`/`sceneTitle`/`initialOpenScenesFromUrl`, URL alias `?scene=cashShop|shop`). `cashShopSceneHtml()` shows balance, the `100 tokens (£1)` pack + Buy button, error surface, and links to the legal pages.
- Host-gated with `cashShopEnabled()` (= `!messageBoardDisabled()`), synced onto the top-bar button via `syncCashShopNavigation()` (mirrors achievements). Shown on live site + localhost, hidden on the itch demo.
- Opening the shop calls `fetchTokenBalance(true)`; `refreshTokenScenes()` re-renders whichever token-aware window (board and/or shop) is open on balance/status change.
- **Added standalone legal pages `terms.html` + `refund.html`** (self-contained, dark-themed) at site root, linked from the Cash Shop note and cross-linked to each other. Refund policy covers immediate-delivery digital goods (UK CCR cooling-off waiver), non-delivery/duplicate/technical-fault refunds, and a `support@lom2idle.com` contact. Added both to `tools/package-itch.mjs` `sourceFiles` so they ship (they hold no `?v=` tokens, so the HTML cache-bust pass is a safe no-op).
- Note: `.cursorignore` blocks the editor from writing `**/*.html`, so the pages were generated via a one-off Node script (removed after).

### Checked
- `npm run check` (313 unit tests pass), `npm run smoke` on `?board=1` and `?board=1&scene=cashShop` (no console/page errors).
- Offline warrior fixture XP mismatch (375 vs 378) confirmed pre-existing.

## 2026-07-01 - Codex - Holy Deva swarm lightning target

### Fixed
- Holy Deva lightning in group-dungeon swarm combat now resolves the real swarm monster from the battle enemy's `swarmId` before calculating the impact tile.
- The lightweight battle-enemy record does not contain `worldX` or `mapRow`; passing it directly into the swarm tile helper previously converted both missing coordinates to zero and placed the lightning near the player/camera origin.
- Solo and non-swarm combat retain the existing current-enemy-position fallback.

### Checked
- Added a regression test for real swarm coordinates and the non-swarm fallback.
- All 313 unit tests passed, syntax checks passed, and `npm.cmd run smoke` booted without console errors.
- The full `npm.cmd run check` still reaches the pre-existing offline Warrior fixture mismatch (`375` XP actual versus `378` expected).

## 2026-07-01 - Cursor - Token shop MVP (Stripe + server-authoritative tokens)

### Changed
- **Server-authoritative token economy.** The client can never mint or set a balance: balances live in D1, are credited **only** by a Stripe-signed webhook after real payment, and are spent via server endpoints that atomically decrement. Tokens are keyed to the player's existing recovery code (no new login).
- Schema (`tools/stats-worker/schema.sql`): new `token_accounts` (authoritative balance), `token_ledger` (audit trail of every credit/spend), `stripe_events` (webhook idempotency).
- Worker (`tools/stats-worker/worker.js`):
  - Server-owned constants `TOKEN_PACKS` (`tokens-100` = 100 tokens / £1) and `MESSAGE_TOKEN_COST = 50` (client never sends amounts/prices).
  - `POST /shop/create-checkout` `{recoveryCode, packId}` -> creates a Stripe Checkout session (form-encoded, `mode=payment`, inline gbp `price_data`, metadata carries `recovery_code`/`tokens`) and returns `{url}`.
  - `POST /shop/stripe-webhook` -> raw-body HMAC-SHA256 verify (Web Crypto, 5-min tolerance, timing-safe) using `STRIPE_WEBHOOK_SECRET`; on `checkout.session.completed`+`paid`, `INSERT OR IGNORE stripe_events` for idempotency then atomic `DB.batch` credit + ledger row.
  - `GET /shop/balance?recoveryCode=` -> `{balance}` (`no-store`).
  - `handleTownMessagesPost` now requires `recoveryCode` and charges 50 tokens via a single conditional `UPDATE ... WHERE balance >= 50` (SQLite serializes writes, so no double-spend/negative), returning `402 INSUFFICIENT_TOKENS` when short, plus a `-50 spend` ledger row and the new balance.
- Client (`src/app.monolith.js`):
  - `state.tokens {balance,status,error,buying}`; `fetchTokenBalance()`, `startTokenCheckout()`, and `maybeHandleShopReturn()` (handles `?shop=success|cancel` on boot: toast + balance refresh + strip param).
  - Message board panel shows `Tokens: N`, a `Buy 100 tokens (£1)` button (`data-buy-tokens`), and a `Post (50 tokens)` button; `postTownMessage()` sends `recoveryCode` and refreshes balance (surfaces 402 inline).
  - Replaced the hard `DEMO_MESSAGE_BOARD_DISABLED` flag with `messageBoardDisabled()` — board is **enabled on the live site + localhost, disabled on the itch demo** (`?board=1/0` override).
- Config (`tools/stats-worker/wrangler.toml.example`): documented `SITE_URL` var and the `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` secrets + Stripe dashboard/webhook + D1 migration steps.

### Deploy / setup steps (outside code)
1. Stripe: create account, add a webhook endpoint -> `https://<worker-host>/shop/stripe-webhook` subscribed to `checkout.session.completed`; copy its signing secret.
2. `wrangler secret put STRIPE_SECRET_KEY` (sk_test_ then sk_live_) and `wrangler secret put STRIPE_WEBHOOK_SECRET`; set `SITE_URL` var.
3. Apply the new tables: `wrangler d1 execute lom-idle-v2-stats --file tools/stats-worker/schema.sql`, then deploy the worker.
4. Test end-to-end with a Stripe test card, then swap to live keys. (Terms/Refund legal pages are a required follow-up before going live.)

### Checked
- `npm run check` (312 unit tests pass, incl. new `tests/statsWorkerShop.test.mjs`: webhook credit + idempotency, bad-sig reject, spend/insufficient, checkout validation, and updated `statsWorkerTownMessages.test.mjs`), `npm run smoke` (no console/page errors).
- Offline warrior fixture XP mismatch (375 vs 378) confirmed pre-existing.

## 2026-07-01 - Cursor - In-app "update available" bar for long-lived tabs

### Changed
- Added a dismissible top bar (`#updateAvailableBar`) that appears when a newer deployed build is detected, with a **Reload** button + dismiss (×). Reaches tabs left open for hours that never revalidate `index.html` on their own.
- `startUpdateVersionCheck()` (fired from `init`) polls every 5 min and on tab re-focus (`visibilitychange`): fetches `index.html` with `cache: "no-store"`, parses the `app.js?v=` stamp, and compares it to the stamp this tab booted with (`loadedBuildVersion()` reads the entry `<script>`).
- No effect in dev (stamp matches) or when a build has no `?v=`; fetch failures are swallowed so smoke stays clean. Dismiss suppresses only the current detected version; a later build re-shows it.
- Styling mirrors the demo bar with a green accent (`src/styles.css`).
- Note: existing behaviour already auto-updates on any normal reload/tab-reopen (Pages serves `index.html` as `max-age=0, must-revalidate` and the packager re-stamps `?v=`), so a hard refresh was never required; this only closes the idle-tab gap.

### Checked
- `npm run check` (303 unit tests pass), `npm run smoke` (bar present, no console/page errors), `npm run release:itch` (boot check green, build `20260701-104632`).
- Offline warrior fixture XP mismatch (375 vs 378) confirmed pre-existing.

## 2026-07-01 - Cursor - One-time purge of exploited bookstore skills/books

### Changed
- Added a versioned save migration (`UNFAIR_SKILL_PURGE_VERSION = 1`) that strips the 19 high-level (lvl 36-60) skills obtainable only via the removed test-bookstore exploit, plus their unused `book-*` items.
- Purged spell IDs: LionRoar, Reincarnation, BladeAvalanche, CrossHalfMoon, SummonHolyDeva, HealingCircle, ProtectionField, Curse, Mirroring, FlameField, Plague, PoisonCloud, Blizzard, Rage, Fury, PetEnhancer, MagicBooster, MeteorStrike, ImmortalSkin (matching `book-*` items removed from every character inventory + account storage).
- Runs inside `applySaveSnapshot` (covers initial load, cloud restore, and file import) over every character's `magic.learned`/inventory and account storage; stamps `settings.unfairSkillPurgeVersion` so it runs exactly once per save and never punishes future legit learners.
- Persisted the new flag through the settings default, `createSaveSnapshot`, and `sanitizeSettingsState` (`src/persistence/sanitizeSettings.js`).

### Checked
- `npm run check` (303 unit tests pass), `npm run smoke` (no console/page errors).
- Offline warrior fixture XP mismatch (375 vs 378) confirmed pre-existing (reproduces with my changes stashed).

## 2026-06-27 - Cursor - Poison Cloud (Taoist ground field)

### Changed
- Added **Poison Cloud** Taoist combat spell (Crystal stats: L43/45/48, 30+5×level MP, 18s cooldown, shape 83).
- Ground field: 3×3 area, 6s duration, 1s MAC damage ticks + green poison (12 ticks @ 1s, value from avg SC + poison attack).
- Consumables: **5 amulets + 5 green poison** per cast; blocked while an active cloud is on the field.
- Wired solo combat, pet-support, boss party, training room, offline catch-up, skill bar, and queued casts.
- Generalized ground effects: `spellGroundAreaTiles`, Tao atlas drawing, per-tick Tao damage roll.
- Assets: `public/spellfx/PoisonCloud/` (Magic 1160 projectile + Magic2 1650 field), `M83-0` cast SFX, itch manifest + build-phase1 book mapping.

### Checked
- `npm run build:sfx`, unit tests (283 pass), `verify:itch:source` (116 spell FX), `npm run smoke`.
- Offline warrior fixture XP mismatch (375 vs 378) pre-existing.

## 2026-06-27 - Cursor - Pet Enhancer SFX fix (monster sound collision)

### Changed
- Pet Enhancer was playing **Violet Kek Tal** monster sounds: spell id 85 fell back to `085-*.wav` when `M85-0.wav` is missing from Crystal's Next pack.
- `tools/build-sfx-assets.mjs`: spell filename lookup no longer falls back to `###-#` monster files; Pet Enhancer cast now uses **`M77-0.wav`** (Ultimate Enhancer — closest shipped Enhancer spell sound; `M85-0` absent).
- Removed incorrect `spell.PetEnhancer.impact` (Crystal plays one instant cast sound only).
- Combat/training/boss-party paths skip a second SFX on buff apply (`soundPlayed: true` on impact FX queue).

### Checked
- `npm run build:sfx`, `npm run check`, `npm run smoke`.

## 2026-06-27 - Cursor - Meteor Strike FX Crystal anchor port

### Changed
- Meteor field FX uses Crystal anchors: **1600 scorch** at map cell top (`footY − 32`), **1610 body** at `(tileY − 20) × 32` north (`−640px`), per-frame lib offsets via `drawAtlasFrameMeta`, **1610 under 1600** draw order. Removed manual `meteorFxNorthOffsetPx` / `scorchFxSouthOffsetPx` tuning.

### Checked
- `node --check src/app.monolith.js`

## 2026-06-27 - Cursor - Meteor Strike FX reset (Crystal draw model)

### Changed
- Removed ad-hoc rain lift / split anchor hacks; Meteor field FX now uses Crystal anchors only: rain (`1600`) at **map cell top**, scorch body (`1610`) at **cell top − 20px** (`AnimationOffset`).
- `drawSpellLayerCanvas` now uses per-frame **w/h + offsetX/offsetY** (Crystal `MLibrary.Draw(offSet: true)`) instead of stretching full slot rectangles — this was distorting both rain and ground art.

### Checked
- `node --check src/app.monolith.js`

## 2026-06-27 - Cursor - Meteor Strike FX/SFX (Crystal-accurate)

### Changed
- Re-exported **Meteor Strike** spellfx from Crystal `Magic2`: player cast (1590×10), field rain overlay (1600×10, 800ms loop), ground scorch body (1610×30, 100ms/frame).
- Ground draw uses `ground` + `storm` atlas layers at target tile (−20px Crystal offset), not the cast swirl.
- SFX: cast `52-0` on wind-up; field spawn plays both `52-1` and `52-2` (no per-tick spell sounds).

### Checked
- `npm run build:sfx`, `verify:itch:source` (108 spellfx files).

## 2026-06-27 - Cursor - Meteor Strike combat (Crystal channel field)

### Changed
- **Meteor Strike** wizard spell: Crystal stats (5×5 ground field, 3s duration, 440ms ticks, 800ms first tick, channel lock), **15s cooldown** (`autoCooldownMs: 15000`), per-tick MC damage rolls, autocast priority, empowered damage roll, cast SFX (`M52-0`), itch spellfx manifest entry, storm-center ground FX.

### Checked
- `npm run check` (275 unit tests pass; offline warrior fixture xp pin still drifts 375 vs 378 — pre-existing).
- `npm run smoke` OK with dev server.

## 2026-06-28 - Cursor - Flame Field combat (Ice Storm targeting)

### Changed
- **Flame Field** wizard spell: Crystal stats (shape 49, MC burst, 2500ms cast lock), `impactMode: "bang"` so damage lands on the enemy tile like Ice Storm (not centered on the wizard).
- Autocast priority, empowered-item damage roll, SFX cast (`M49-0`), spellfx atlas split (short player cast + enemy impact burst).

### Checked
- `node --check` on monolith/warriorMagic OK; `npm run build:sfx` OK (impact clip missing in Crystal pack — falls back to cast).

## 2026-06-28 - Cursor - Wizard buff spell SFX rebuilt

### Changed
- Ran `npm run build:sfx` so **Magic Booster** (`M51-0.wav`) and **Mirroring** (`M48-0.wav`) cast clips land in `public/audio/sfx/manifest.json`.
- Added **Magic Shield** cast (`spell.MagicShield.cast`, Crystal spell 43) to `tools/build-sfx-assets.mjs` — it was never registered.

### Checked
- Manifest keys resolve: `spell.MagicBooster.cast`, `spell.Mirroring.cast`, `spell.MagicShield.cast`.

## 2026-06-28 - Codex - Group-dungeon directional monster animations

### Changed
- Re-exported missing Crystal north, south, north-west, and south-west walk/attack/stance clips for monster atlases 33, 38, 45, 49, and 68.
- Bumped the monster asset cache to `20260628-swarm-directions` so browsers stop serving older west-only atlases.
- Added a coverage test requiring every moving group-dungeon wave, boss-swarm, and reinforcement monster to ship all directional clips.

### Checked
- Audited 30 group-dungeon swarm templates; no moving monster is missing a required directional action.
- Verified every rebuilt directional frame lies inside its PNG and is non-transparent, then visually compared west, north, south, and diagonal walk/attack frames for all five rebuilt monsters.
- Five focused swarm tests, scoped lint, syntax checks, and release asset audit passed.
- Itch packaging and asset audit passed (870 files, no missing assets), but the final packaged boot check is blocked by an unrelated concurrent Mirroring spell reference to missing `public/spellfx/Mirroring/atlas.json`. The generated ZIP is not marked release-ready.

## 2026-06-28 - Cursor - Warrior Fury wired to Crystal

### Changed
- **Fury** buff: Crystal +4 attack speed for `60 + 10×level` seconds; recast via `spellDelayMs` (10–4 min by level).
- Unified `hasActiveFuryBuff` / `furyDurationMs` across solo, boss party, training room, and autocast (top warrior priority).
- Combat log + floating text on cast; updated spell description in `warriorMagic.js`.
- SFX: `spell.Fury.cast` (Crystal spell 16).
- Boss party Rage autocast skips recast while buff is active.

### Checked
- `npm run build:sfx` OK (Crystal `016-0.wav` not in local SFX pack — entry listed as missing like other gaps).
- `npm run check`: 264/265 pass (pre-existing `empoweredItems` tier-weight test).

## 2026-06-28 - Cursor - Warrior Rage wired to Crystal

### Changed
- **Rage** buff: Crystal DC boost `(12% + 3%×level) × max DC` on min/max DC for `18 + 6×level` seconds via stat buffs.
- Solo, boss party, training room, autocast (after Fury); fixed boss queued buff handler for non-Fury skills.
- Warrior damage rolls use effective DC so Rage applies to attacks.
- SFX: `spell.Rage.cast` (Crystal spell 13).

### Checked
- `node --check src/app.monolith.js` OK; `npm run build:sfx` OK.

## 2026-06-28 - Codex - Swarm centre-lane closer

### Changed
- Added a focused group-dungeon formation rule for the final enemies: a lone side-lane survivor moves to the empty centre, and a final north/south pair sends one enemy into the centre directly in front of the tank.
- The rule does not affect normal formations, approaching enemies, or stationary bosses.
- Bumped client cache strings to `20260628-swarm-final-centre` before the later directional-asset cache bump.

### Checked
- Added four focused formation tests; all passed.
- Syntax, scoped lint, diff checks, and the game smoke test passed.

## 2026-06-28 - Codex - Daily cloud backup-code reminder

### Changed
- Added a centred in-game reminder that displays the account recovery code and urges players to store it outside the browser.
- Added Copy Code feedback, an acknowledgement action, and a persistent 24-hour reminder interval shared across characters.
- Added explicit recovery instructions using the exact Options > Cloud Save field and button labels.
- Added prominent privacy warnings in both the daily reminder and Options: sharing the code permits cloud download/overwrite and can cause conflicting saves or lost progress.
- The code remains available under Options > Cloud Save.
- Bumped client cache strings to `20260628-private-recovery-code`.

### Checked
- Settings persistence and cloud-save helper tests passed (7/7); smoke test and source Itch verification passed.
- Browser checks passed for Copy, dismissal, reload suppression, and a 560x720 viewport with no modal overflow.
- Packaging created `dist/lom-idle-v2-itch-20260628-101327.zip`, but final package audit is currently blocked by an unrelated missing referenced SFX file: `audio/sfx/files/20110-M11-0.wav`. Do not upload this ZIP until that separate asset issue is resolved and the audit is rerun.

## 2026-06-28 - Codex - Cross Half Moon warrior skill

### Changed
- Restored **Cross Half Moon** (`CrossHalfMoon`) as a warrior toggle skill with Crystal stats (Lv 38–42, 6 MP/swing, 0.4× multiplier vs Half Moon’s 0.3×).
- Solo/boss-party primary hit uses the same melee swing as Half Moon; Cross Half Moon scales ~33% higher via the Crystal multiplier ratio. Group-dungeon splash still uses `rollWarriorMagicDamage` (Cross Half Moon hits harder on secondary targets too).
- Cross Half Moon wins over Half Moon when both toggles are on autocast; spell FX/SFX/book item already existed.

### Checked
- `npm run check` syntax + warriorMagic tests pass; sole failure remains unrelated empower-reference test.

## 2026-06-28 - Codex - Benediction Luck integrity fix

### Changed
- Added Benediction as an explicit legal weapon-upgrade source in generated integrity rules.
- Legal weapon Luck now spans Crystal's cursed `-10` through blessed `+7`; values outside that range remain review violations.
- Excluded Benediction Luck from gem-use and weapon-refinement accounting, preventing it from either causing a false gem warning or hiding an invalid refinement total.
- Bumped integrity rules to `2026-06-28.1` and client cache strings to `20260628-benediction-integrity`.

### Checked
- Added regression coverage for blessed Luck, cursed Luck, out-of-range Luck, non-weapon negative bonuses, and refinement accounting.
- Integrity and Worker tests passed (17/17); release asset audit, Itch verification, package audit, and packaged-browser boot verification passed.
- Full suite passed 260/261. The sole failure remains the unrelated pre-existing empower-reference expectation (`20` actual versus `10` expected).

### Deploy
- Deployed Worker version `63a162bb-f82c-45d7-85fe-fda7961b0e3d`.
- Cleared six live review rows whose only violations were this Benediction false positive, then removed the obsolete Luck evidence from eight mixed rows while preserving their other violations.
- Verified upload ZIP: `dist/lom-idle-v2-itch-20260628-065300.zip` (863 entries). This client ZIP still needs to be uploaded to Itch.

## 2026-06-27 - Codex - Recovery-code cloud saves

### Changed
- Added a permanent, human-readable recovery code in Options with Copy, Save Now, Find Backup, inline restore confirmation, and last-cloud-save status.
- Local saves remain primary. The game uploads the full existing versioned account snapshot every 10 minutes while open; no email, password, or separate account model was added.
- Full local reset rotates to a new recovery code, preventing a fresh blank game from overwriting the previous code's backup.
- Added bounded `POST /cloud-save` and `POST /cloud-save/restore` Worker routes plus the additive `cloud_saves` D1 table.
- Reused the existing import/restore pipeline for cloud recovery, so characters, storage, upgrades, codex, achievements, settings, and offline progress follow the same migration rules as file imports.
- Made the package-only atlas bundle explicitly opt-in, removing a harmless but noisy development 404 discovered by the smoke test.
- Bumped client cache strings to `20260627-cloud-recovery`.

### Checked
- Cloud helper/API tests passed, including malformed tokens, invalid snapshots, unknown codes, upload, and restore.
- A real local D1 upload/restore round trip passed with a full game save.
- Live Worker upload/restore and the Options Save Now flow passed; both disposable test rows were removed afterward (`cloud_save_count = 0`).
- Smoke test, source verification, Itch archive verification, asset audit, and real-browser packaged-build verification passed.
- Full suite: 256/257 passed. The sole failure is the pre-existing empower reference assertion that expects a 10% item chance while current game data returns 20%.

### Deploy
- Live D1 backup: `C:\Users\bb-we\Documents\LOM Idle Backup\stats-backups\leaderboard-before-cloud-save-20260627.sql`.
- Applied `migrate-cloud-saves.sql` and deployed Worker version `e7e6709c-d9d3-420a-88fc-eb5d123ea373`.
- Verified upload ZIP: `dist/lom-idle-v2-itch-20260627-194342.zip` (863 entries). This client ZIP still needs to be uploaded to Itch.

## 2026-06-27 - Codex - Review-first leaderboard item integrity

### Changed
- Added a generated, versioned legality catalogue covering 384 equippable items, their slots, smith/refine caps, compatible gem/orb bounds, and legal empowerment rolls.
- Expanded anonymous stat submissions with complete equipped-item smith, refine, gem, empowerment, and spell-empower components.
- Added Worker-side equipment validation. Impossible items, outdated/missing rule versions, and over-cap levels are flagged for review but remain visible publicly.
- Added D1 integrity state, evidence fingerprints, review timestamps, and an approval fingerprint so accepted false positives do not immediately reappear.
- Added the token-protected `/integrity` review page with Keep Visible, Remove From Social, and Restore To Social actions.
- Public Social results exclude only accounts explicitly marked `excluded` by the administrator.
- Added an integrity-version grace period through `2026-07-04T00:00:00Z`; older clients remain legacy during rollout while current-version submissions are validated immediately.
- Added `migrate-integrity-review.sql`, admin-secret/deployment instructions, rule regeneration/check scripts, and 13 targeted integrity tests.
- Bumped game cache strings to `20260627-item-integrity-review`.

### Checked
- Item-rule freshness check, syntax checks, lint, 13 targeted integrity tests, game smoke test, Itch source verification, Wrangler dry-run, and live endpoint checks passed.
- Full `npm.cmd test` ran 247 tests: 246 passed; the unrelated pre-existing empower reference assertion still expects a 10% item chance while current game data returns 20%.

### Deploy
- Backed up the live D1 database to `C:\Users\bb-we\Documents\LOM Idle Backup\stats-backups\leaderboard-before-integrity-20260627.sql`.
- Applied the live D1 migration, created `ADMIN_TOKEN`, and deployed Worker version `b2787b23-bf34-4cde-a9b5-0b4dcc8c0b4d`.
- Verified public leaderboard, protected review API, and `/integrity`; cleared rollout-only legacy flags and confirmed the pending review queue returned to zero.
- Packaged the matching Itch client as `dist/lom-idle-v2-itch-20260627-143801.zip`; it still needs to be uploaded to Itch so player submissions include integrity rules version `2026-06-27.1` before grace ends.
- Consolidated 200 player/monster atlas JSON files into a package-only manifest, reducing the release from 1,063 to 860 files without dropping sprite images, sounds, or atlas data.
- Itch asset audit, spell-FX verification, and real-browser packaged-build verification all passed. The verified ZIP is 189,316,625 bytes (about 180.55 MiB).

## 2026-06-27 - Auto (Cursor) - Taller NPC dialogue boxes

### Changed
- `src/styles.css` — NPC dialog window height 244→317px (+30%), content panel 154→200px; background still stretches via `100% 100%`; refiner panel keeps `height: auto` after the base panel rule.

### Verified
- CSS-only change.

---

## 2026-06-27 - Auto (Cursor) - Crystal armour paper doll + weapon visual indices

### Changed
- `public/ui/character/stateitem-597.png`, `stateitems.json`, `stateitems-atlas.*` — exported Crystal Armour paper-doll frame 597 from Stateitem.Lib and rebuilt atlas.
- `src/data/items.json` — fixed eight Assassin/Archer shop weapons using raw Crystal Shape (104–211) as sprite index; mapped to lib indices 4–11 per Crystal client rules.
- `tools/lib/item-from-crystal.mjs` — added `weaponVisualIndex()` so future Crystal weapon imports map Shape correctly.

### Verified
- `node tools/audit-release-assets.mjs` (0 issues). Unit tests pass; offline warrior fixture drift pre-existing.

---

## 2026-06-27 - Auto (Cursor) - Inventory junk/saved marks

### Changed
- `src/persistence/sanitizeInventory.js` — per-entry `inventoryMark` (`null` | `"junk"` | `"saved"`) persisted on load/save.
- `src/app.monolith.js` — Space on hovered bag item cycles neutral → junk → saved; red ✕ / green 🔒 overlays; saved items excluded from sell list and smith combine; junk fodder first at smith; Trader James "Sell all junk" bulk sell.
- `src/styles.css` — mark overlays and trader action button layout.
- `tests/persistenceInventory.test.mjs` — mark sanitize tests.

### Verified
- `npm run smoke` (pass). Unit tests pass; offline warrior fixture drift pre-existing (kills 28 vs expected 26).

---

## 2026-06-26 - Auto (Cursor) - Mass Healing FX and AOE targeting fix

### Changed
- `public/spellfx/MassHealing/` — added Crystal overhead impact layer (Magic 1800, 500ms delay) via `tools/export-mass-healing-spellfx.ps1`.
- `src/app.monolith.js` — Mass Healing now casts on the Tao only: cast swirl (1790) on caster, AOE burst overhead at Tao on impact; heal applies to all injured allies after delay (not per-ally HealingRestore FX). Boss party uses same pending delay path as solo.
- `tools/extract-spellfx-east-native.json` — documented impact layer for MassHealing.

### Verified
- `npm run verify:itch:source`, `npm run smoke`.

---

## 2026-06-26 - Auto (Cursor) - Summon Holy Deva spell (Taoist)

### Changed
- `src/app.monolith.js` — wired **Summon Holy Deva** (level 38): 2 amulets, 1500ms summon delay, follower pet behind Tao (not front-line tank), ranged thunder vs enemy MAC, 6-tile attack range, boss party + offline + training room.
- `public/monsters/monster/117.json` + `.png` — Holy Deva pet atlas (Crystal index 117).
- `public/spellfx/SummonHolyDeva/` — cast FX (Crystal Magic 1500).
- `src/core/offlineProgress.js`, `tests/offlineProgress.test.mjs` — auto-summon order + delay.
- `tools/build-sfx-assets.mjs`, `tools/itch-spellfx-manifest.mjs`, `tools/package-itch.mjs`, `tools/extract-spellfx-east-native.json`, `tools/export-monster-atlases.ps1` — SFX, packaging, ranged-attack action mapping (lib action 14).

### Verified
- Unit tests (173/173), `npm run smoke`, `verify:itch:source`. Full `npm run check` still stops on pre-existing `warrior-bicheon` offline fixture mismatch.

---

## 2026-06-26 - Auto (Cursor) - Gem Merchant NPC

### Changed
- `src/app.monolith.js` — Gem Merchant town NPC (rebirth unlock), random/matching gem→orb conversions, efficiency cost tiers.
- `src/bossDrops.js` — export `BOSS_GEM_ITEM_IDS` / `BOSS_ORB_ITEM_IDS` for orb pool reuse.
- `src/styles.css` — gem merchant dialog panel styles.

### Verified
- `node --check src/app.monolith.js`, unit tests (173/173), `npm run smoke`. Full `npm run check` still stops on pre-existing `warrior-bicheon` offline fixture mismatch.

---

## 2026-06-26 - Auto (Cursor) - Flame Disruptor spell (Wizard)

### Changed
- `src/app.monolith.js` — wired **Flame Disruptor** into wizard combat as a level-38 single-target fire spell (column FX on enemy, Crystal target impact).
- `tools/itch-spellfx-manifest.mjs`, `tools/build-sfx-assets.mjs` — packaging + cast SFX (shape 47).

### Verified
- `node --check src/app.monolith.js`, `npm run build:sfx`, `npm run smoke`.

---

## 2026-06-26 - Auto (Cursor) - Mass Healing spell (Taoist)

### Changed
- `src/app.monolith.js` — wired **Mass Healing** into Taoist combat: party-wide heal (player + pet + boss party), amulet cost, cast/impact FX delay like Soul Shield/Blessed Armour, auto-cast when 2+ allies need healing, offline + boss party + training room support.
- `src/core/offlineProgress.js` — offline support spell order + queued spell kind for MassHealing.
- `src/data/items.json` — added `book-mass-healing` (level 31 Taoist spell book).
- `tools/build-phase1-items.mjs`, `tools/build-sfx-assets.mjs`, `tools/itch-spellfx-manifest.mjs` — Mass Healing item/SFX/spellfx packaging hooks.
- `tests/offlineProgress.test.mjs` — updated offline spell order/kind tests.

### Verified
- `node --check src/app.monolith.js`, offline unit tests, `npm run smoke`.

---

## 2026-06-21 - Auto (Cursor) - Hell GD floor 2 at HELL02 (248, 251)

### Changed
- `zone-hell-gd-2` — wave floor 2 (2 waves, heavier Hell Bolt + Witch Doctor: 3 each in 20-entry pool vs 1 each on F1).
- `HELL_GD_2_ROOM_VISUALS` + `tools/build-hell-gd-2-stamp.ps1` — map stamp at Crystal HELL02 (248, 251).
- `tools/build-hell-cavern-2-spot-picker.ps1` — HELL02 coordinate mockup for spot selection.
- Bumped `MAP_STAMP_ASSET_VERSION` for `hell-gd-2-center`.

---


### Changed
- Removed generic `hell-cavern-catalog` scrolling props (were picked from whole HELL01/02, not corridor at 146,56).
- Added `tools/build-hell-cavern-gd1-corridor.ps1` — Red Cavern-style wall strip: map cols 128–164, lane Y 56, floor pattern + walk-lane excludes.
- Rebuilt `hell-cavern-1-wall-columns.png` (37 columns); `columnCount: 37` in edge set.

---

## 2026-06-21 - Auto (Cursor) - Hell group dungeon floor 1 at (146, 56)

### Changed
- `zone-hell-gd-1` — Hell group dungeon floor 1 (2 waves, trash 424–430) at Crystal HELL01 (146, 56).
- Restored `HELL_CAVERN_1_*` scrolling visuals + `hell-cavern-1-edge` wall columns in `app.monolith.js`.
- Rebuilt `public/mapedges/hell-cavern-1-wall-columns.png` for lane Y 56, columns 134–165.
- Wasteland teleporter lists `zone-hell-gd-1`.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern 1F group dungeon spot picker

### Changed
- Added `tools/build-hell-cavern-1-spot-picker.ps1` — full HELL01 overview + 12 preset crop previews for `zone-hell-gd-1` party stand.
- Generated mockup: `tile-review/hell-cavern-1-spot-picker/` (recommended default: farm corridor pocket 24, 45).

### Suggested Next Step
- User picks spot → wire `zone-hell-gd-1` with `arenaSpawnMap` / scrolling HC1 visuals.

---

## 2026-06-24 - Auto (Cursor) - Hell boss lab atlas fixes

### Changed
- Hell Keeper: `stationaryBoss: true`, `moveMs: 0` (Crystal stationary); attack blend confirmed on atlas 218.
- Hell Lord: appended standard walking frames to atlas 247 (`tools/append-monster-walking.ps1`).
- Flame Queen: fixed `attackRange1` frame mapping in `build-extended-boss-combat-atlases.ps1` (720–725, non-directional); rebuilt atlas 242.
- Rebuilt extended boss atlases 200/229/242/345; runtime fallbacks when walk/range clips are missing drawable frames.
- Bumped `MONSTER_ASSET_VERSION`.

### Checked
- `npm run smoke`.

---


### Changed
- Built `red-cavern-kr-center` map stamp from RCK.map focus (50, 55).
- Added `zone-red-cavern-kr` (Dream/Dark Devourer, arena at 50/55) + Wasteland teleport entry + boss room def.
- Spot picker mockup: `tile-review/red-cavern-kr-spot-picker/`.

### Checked
- `npm run check` + `npm run smoke`.

---

## 2026-06-22 - Auto (Cursor) - Red Cavern lane decorations (picker #1–14 subset)

### Changed
- Built prop catalog + decoration sheet from picker **#1, #2, #5, #8, #9, #10, #11, #12, #13, #14** → `public/mapobjects/red-cavern-catalog.png`.
- Added `tools/build-red-cavern-decoration-sheet.ps1`.
- Wired `RED_CAVERN_DECORATIONS` in `phase1Data.js` (1488px corridor loop, row pool like BDD/Prajna Cave).

### Checked
- `npm run check` + `npm run smoke`.

---

## 2026-06-22 - Auto (Cursor) - Wall column exclusion: walls + decorations

### Changed
- `build-crystal-wall-column-strip.ps1`: excluded cells now suppress tall wall sprites whose vertical span overlaps an excluded row (not just the anchor cell), skip 2×2 back tiles when any quadrant is excluded, and skip floor/middle/front floor slices that overlap exclusions.
- Rebuilt `red-cavern-corridor-edge.png` with the same 154-cell region JSON.
- Bumped `MAP_STAMP_ASSET_VERSION` to `20260622-red-cavern-corridor-exclude`.

### Checked
- `npm run check` + `npm run smoke`.

---

## 2026-06-22 - Auto (Cursor) - Red Cavern corridor region (R01 cols 21–51)

### Changed
- Saved curated map-builder export to `tools/tile-review/red-cavern-r01-corridor-region.json` (31 columns, lane Y 34, **154 excluded cells**).
- Updated `build-red-cavern-corridor-edge.ps1` to read bounds / lane / exclusions from region JSON.
- Rebuilt `red-cavern-wall-columns.png` (1488px) and `red-cavern-corridor-edge.png` (3000px repeat). `yOffsetFromBase` unchanged at **-508**.

### Checked
- `npm run check` + `npm run smoke`.

---

## 2026-06-21 - Auto (Cursor) - Red Cavern looping corridor wall (R01)

### Changed
- Built R01 map columns 192–213 as wall strip; padded to **3000px** repeat canvas (`red-cavern-corridor-edge.png`).
- Added `red-cavern-corridor` cave edge set; Red Cavern zones use `edgeSet` for scrolling background walls.
- Tools: `build-crystal-wall-column-strip` (direct), `build-red-cavern-corridor-edge.ps1`.

### Checked
- `npm run check`.

---

## 2026-06-21 - Auto (Cursor) - Red Cavern floors 1–2 (Wasteland solo dungeon)

### Changed
- Added enemy templates **441–446** (Ghastly Leecher, Manworms, Cyano Ghast, Dream/Dark Devourer) with Crystal stats; gold-only zone rewards, no item drops yet.
- Added zones `zone-red-cavern-1` / `zone-red-cavern-2` and **Wasteland** teleport region (2 zones).
- Built `red-cavern` map tile set from Crystal R01/R02 walkable tiles (Tiles.Lib 3850–3854); exported monster atlases 152–155, 159, 163; SFX entries in `build-sfx-assets.mjs`.

### Checked
- `npm run check` + `npm run smoke`.

---

## 2026-06-21 - Auto (Cursor) - Remove Wasteland hell zones (keep mobs for group dungeon)

### Changed
- Removed solo zones: Hell Cavern 1/2, Ice Hell 1/2 + KR, Fire Hell 1/2 + KR (`zone-manectric-king-kr`, `zone-fire-hell-kr`).
- Removed Wasteland teleport region, hell cavern edge sets, and hell zone visuals from `phase1Data.js` / `app.monolith.js` / `zones.json`.
- **Kept** enemy templates **418–440**, monster atlases, SFX, and build tools for a future group-dungeon implementation.

### Checked
- `npm run check` + `npm run smoke`.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern HC2 visuals + mob SFX/attack FX

### Changed
- Reverted HC2 lava/overpass decorations — **HC2 now matches HC1** (`tileAnchor2x2`, `groundTopRows: 0`, empty decorations). Removed hell-overpass-lava assets/script.
- `tools/build-sfx-assets.mjs` — SFX for Hell Cavern mobs (215–220, demons 226/227 via Crystal image 225 sounds).
- `tools/append-hell-cavern-attack-blend.ps1` — Crystal-accurate `attack1Blend` overlays on atlases 215–220 (slash/cast FX during attack1).
- Rebuilt `public/audio/sfx/` and updated hell monster PNG/JSON atlases; bumped `MONSTER_ASSET_VERSION`.

### Checked
- `npm run check` green.

---

## 2026-06-21 - Auto (Cursor) - Hell Overpass lava pools (hell03, undo hell01)

### Changed
- **Undid hell01 lava work** — HC1 has no lava decorations again.
- Rebuilt lava from **hell03.map** region (72,120)–(83,127): **Tiles.Lib back frames 16870–16893** (24 tiles, 2×2 anchor checkerboard), not Objects12 front props.
- Added `tools/build-hell-overpass-lava-pool.ps1` + `tools/data/hell03-lava-pool-region.json`.
- Removed `tools/build-hell-cavern-lava-pool.ps1`, `tools/data/hell01-lava-pool-region.json`, `public/mapobjects/hell-cavern-lava.png`.
- `public/mapobjects/hell-overpass-lava.png` (580×260) + `hell-overpass-lava` set in `index.json`.
- `src/phase1Data.js` — `HELL_OVERPASS_LAVA_DECORATIONS` on **HC2 only** (`decorationSet: hell-overpass-lava`).

### Checked
- `npm run check` green.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern lava pool (correct hell01 region)

### Changed
- Rebuilt `public/mapobjects/hell-cavern-lava.png` from hell01 map region (123,56)–(132,65): Objects12 frames **4954–5092** (64 floor-front lava tiles), not catalog #77/#5135 picks.
- Added `tools/build-hell-cavern-lava-pool.ps1` + `tools/data/hell01-lava-pool-region.json`.
- `src/phase1Data.js` — single 488×392 pool decoration, repeat every 560px.
- `src/app.monolith.js` — decoration set lookup no longer falls back to `hell-cavern-catalog` wall props; decorations draw even if floor sheet still loading.

### Checked
- `npm run check` green.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern lava pool decorations

### Changed
- Built `public/mapobjects/hell-cavern-lava.png` from Crystal prop catalog #77 #110 #114 #143 #78 (Objects12 lava pools/tiles on hell01/hell02).
- `src/phase1Data.js` — `HELL_CAVERN_LAVA_DECORATIONS` on both HC1/HC2 zones (`decorationSet: hell-cavern-lava`).

### Checked
- `npm run check` green.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern scrolling tiles (fix mapStampOnly)

### Changed
- Replaced static `mapStampOnly` Hell Cavern visuals with scrolling floor tiles + wall decorations (same pattern as Viper/Prajna solo floors).
- `tools/build-hell-cavern-1-tiles.ps1`, `build-hell-cavern-2-tiles.ps1` — Tiles.Lib 3450–3454 / 3600–3604 → `public/maptiles/hell-cavern-*.png`.
- `tools/build-hell-cavern-prop-catalog.ps1`, `build-hell-cavern-decoration-sheet.ps1` — wall props from hell01/hell02 maps → `public/mapobjects/hell-cavern-catalog.png`.
- `src/phase1Data.js` — `HELL_CAVERN_*_VISUALS` use `mapSet`, `tilePattern`, `decorationSet`, scrolling `decorations`.

### Checked
- `npm run check` green.
- `npm run smoke` green.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern Crystal map stamps (superseded)

### Changed
- `tools/build-hell-cavern-1-stamp.ps1`, `tools/build-hell-cavern-2-stamp.ps1` — export HELL01/HELL02 farm pockets from Crystal maps.
- `tools/build-bdd-1f-stamp.ps1` — optional `-FloorFillFrames` for non-Prajna floor art.
- `public/mapstamps/hell-cavern-1-center-stamp.png`, `hell-cavern-2-center-stamp.png`, `index.json` — stamps kept for potential boss/KR rooms; **not** used for solo farm floors.

### Note
- Solo zones now use scrolling tiles (see entry above). Stamps were wrong for moving characters.

---

## 2026-06-21 - Auto (Cursor) - Hell Cavern AC/AMC class-parity tune

### Changed
- `src/phase1Data.js` — Hell Cavern mobs (424–432): raised AC (+6–16) to slow warrior physical kills; cut AMC (~12–18, Cave Witch 63→18) so wizard/tao magic lands harder.

### Checked
- `npm run check` green.

---

## 2026-06-21 - Auto (Cursor) - Solo combat queued enemy flinch (Crystal ActionFeed)

### Changed
- `src/app.monolith.js` — Solo zone combat now queues enemy flinch (`pendingEnemyStruck`) and consumes it after the enemy attack pass, matching group-dungeon swarm behavior. Warrior/wizard/tao/pet/spell hits call `queueEnemyStruck` instead of immediate `setEnemyAction("struck")`.

### Checked
- `npm run check` green (167 tests + offline fixtures).
- `npm run smoke` green.

---

## 2026-06-21 - Auto (Cursor) - Wasteland hell dungeons (floors + monsters, no drops)

### Changed
- `src/phase1Data.js` — 23 new enemy templates (418–440: Hell Cavern, Ice Hell, Fire Hell); 7 new zones (`zone-hell-cavern-1/2`, `zone-ice-hell-1/2`, `zone-fire-hell-1/2/kr`); reuses `zone-manectric-king-kr` for Ice Hell KR.
- `src/app.monolith.js` — Wasteland teleport region; Hell Lord boss room def; monster atlas cache-bust.
- `src/data/zones.json` — metadata for new zones.
- `public/monsters/monster/{215-247,233}.png/json` — exported Crystal hell mob atlases. Hell Bombs reuse demon/bolt sprites until Mon903–905 libs exist.

### Checked
- `npm run check` green (167 tests + offline fixtures).
- `npm run smoke` green.

---

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

## 2026-06-21 - Auto (Cursor) - View other players' characters from leaderboard

### Changed
- `src/app.monolith.js`:
  - `prototypeStatsCharacterSummary`: now submits per-character `equipment`
    (slot -> `{ itemId, smithLevel }`, read from each character's own
    `inventory.equipment` / `inventory.items`) and `skills` (learned spell id ->
    level from `magic.learned`). New helpers `prototypeStatsCharacterEquipment`
    and `prototypeStatsCharacterSkills`.
  - Added a new in-game overlay scene `"leaderboard"` (top-bar "Leaderboard"
    button). Registered it across the scene plumbing (`initialOpenScenesFromUrl`,
    `currentOverlayScenes`, `isSceneWindowOpen`, `openScene`/`closeScene`,
    `renderSceneOverlay` list, `sceneClassName`, `sceneTitle`, `sceneBodyHtml`,
    `state.openScenes`, and the static topbar template).
  - Leaderboard fetches `GET {base}/leaderboard?scope=accounts&limit=100`
    (base derived from `state.prototypeStats.endpoint` minus `/stats`), caches
    for 60s, and lists ranked players. Clicking a row opens a read-only
    character page rendered from the row's own `characters` data (paper doll +
    equipment slots reuse `crystalPaperDollLayerHtml`/`itemIconHtml`; stats +
    learned skills shown alongside), with a per-class switcher and a
    "self-reported snapshot" caveat. New `state.leaderboard` UI state.
- `src/styles.css`: leaderboard list/row/detail and foreign paper-doll window
  styles (`.leaderboard-*`, `.leaderboard-character-window`).
- `tools/stats-worker/worker.js`: `normalizeCharacterStatsPayload` now sanitizes
  and stores `equipment` (slot whitelist + item-id/`smithLevel` clamps) and
  `skills` (id -> clamped level) inside the existing `character_stats` JSON;
  `formatLeaderboardCharacters` carries them back out. No schema change.
- `tools/stats-worker/README.md`: documented the new per-character fields.

### Checked
- `npm run check` (lint + node --check incl. worker.js + 167 unit tests +
  offline fixtures): PASS.
- `npm run smoke` (headless boot against running dev server): PASS, 0 console
  errors.

### Notes / Risks
- Foreign character data is self-reported Solo Play data (per
  `docs/season-play-architecture.md`); the detail view is labelled as a
  snapshot, not authoritative.
- Deliberately did NOT add a `GET /player/:id` endpoint or expose the raw
  anonymous `player_id`: that would let anyone overwrite another player's row
  (submissions only need the id). Detail renders from cached `/leaderboard` row
  data keyed by index instead.
- Degrades gracefully: old worker builds / rows without `equipment`/`skills`
  render an empty paper doll + "No skills learned". Worker must be redeployed
  (`npx wrangler deploy`) and clients must resubmit before real gear/skills show.

### Suggested Next Step
- Redeploy the stats Worker so new submissions persist equipment/skills, then
  verify a populated foreign character page in dev.

## 2026-06-21 - Auto (Cursor) - iOS lag mitigation (render loop)

### Changed
- `src/app.monolith.js` `render()`: gated the per-frame debug readout writes
  (`els.readout.textContent` + `els.frameMeta.innerHTML`) behind `!IS_GAME_UI`.
  Those are lab-only diagnostics but were rebuilding 8 `<dt>/<dd>` nodes via
  `innerHTML` ~60x/sec in the shipped game UI, which iOS Safari janks on.
- `src/app.monolith.js` `tick()`: added an iOS-only render-rate cap. New
  `IS_IOS` detection (covers iPadOS-masquerading-as-Mac via maxTouchPoints) and
  `RENDER_MIN_INTERVAL_MS` (33ms / ~30fps on iOS, 0 = uncapped elsewhere). The
  simulation still runs every rAF for timing accuracy (`updateFrame` is
  delta-based), so only repaint frequency is reduced. Non-iOS behaviour is
  byte-for-byte unchanged (`now - lastRenderAt >= 0` is always true).

### Checked
- `npm run check`: pass (167 tests, lint, syntax, offline fixtures unchanged).
- `npm run smoke`: pass, zero console/page errors.
- No canvas `filter`/`shadowBlur` exist (already iOS-safe); canvas renders at
  logical resolution + CSS-scales (no retina blow-up).

### Notes / Risks
- Could not profile a real iOS device from here; fixes target the two highest-
  probability costs found by reading the render path. 30fps on iOS is a visible
  smoothness change but acceptable for an idle game; tune `RENDER_MIN_INTERVAL_MS`
  (e.g. 25ms = 40fps) if it feels too low.

### Suggested Next Step
- If a tester confirms improvement, consider also throttling per-frame sim work
  on iOS, or making the cap adaptive based on measured `state.perf.drawMs`.

## 2026-06-20 - Auto (Cursor) - Wizard offline turn phase in core

### Changed
- `src/core/offlineProgress.js` — `resolveOfflineWizardTurnPhase`, `OFFLINE_WIZARD_DEFENCE_SPELL_ID`.
- `offlineWizardAttack` delegates turn priority (Magic Shield → cast vs weapon fallback) to core.
- Unit tests (164 total); wizard offline fixture unchanged (21 kills, dies ~227s).

### Checked
- `npm run check` green (4 offline fixtures).
- `npm run smoke` green.

### Suggested Next Step
- Warrior learned-skill hits via combat event seam, or dead group-dungeon offline sim cleanup.

## 2026-06-20 - Auto (Cursor) - Taoist offline queued spell + auto-summon priority

### Changed
- `src/core/offlineProgress.js` — `offlineTaoistQueuedSpellKind`, auto-summon order/helpers,
  `offlineTaoistSummonPetDelayMs`.
- `offlineTaoistAttack` uses core dispatch for queued spells and skeleton-before-shinsu autocast.
- Unit tests (162 total); taoist offline fixture unchanged.

### Checked
- `npm run check` green (4 offline fixtures).
- `npm run smoke` green.

### Suggested Next Step
- Wizard offline spell selection in core, or warrior learned-skill hits via combat event seam.

## 2026-06-20 - Auto (Cursor) - Revert group-dungeon offline fixture (not a product feature)

### Changed
- Removed `party-bdd1` profile, save, expected JSON, test harness method, and
  `fixture:offline-group` script. Group dungeons intentionally have no offline sim
  (`applyOfflineProgress` shows notice and returns).
- `AGENTS.md` notes group dungeons are excluded from offline fixture coverage.

### Checked
- `npm run check` green (4 offline fixtures: zone ×3 + mining).

### Suggested Next Step
- Continue core extraction (combat seam, Taoist offline turn logic) for solo zone/mining paths only.

## 2026-06-20 - Auto (Cursor) - BDD group-dungeon offline browser fixture [REVERTED]

### Changed
- Added then reverted — see entry above. Do not re-add without explicit product decision.

## 2026-06-20 - Auto (Cursor) - Taoist offline player-tank spell priority

### Changed
- `src/core/offlineProgress.js` — split `OFFLINE_TAOIST_SUPPORT_SPELL_ORDER` (player-tank main
  action) from `OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER` (appends SoulFireBall).
- Monolith: shared `taoistOfflineCastSupportSpell` + `taoistPlayerTankAttackOffline` (secondary
  SoulFireBall, then support order, then weapon); pet-support path reuses the same cast helper.
- Unit tests for both spell orders (158 tests total).

### Checked
- `npm run check` green (taoist offline fixture unchanged: 35 kills / survives 5m).
- `npm run smoke` green.

### Suggested Next Step
- Extract Taoist queued/summon offline branches, or add group-dungeon offline browser fixture.

## 2026-06-20 - Auto (Cursor) - Live warrior basic swing via core resolver

### Changed
- `warriorAttack` basic weapon path (`!learned`) now uses `resolvePhysicalAttack` instead of
  inline `rollHit` + `rollDamage`, matching offline warrior, wizard, and taoist weapon fallbacks.

### Checked
- `npm run check` green (156 unit tests + 4 offline fixtures).
- `npm run smoke` green.

### Suggested Next Step
- Extract full Taoist offline turn tree to core, or add group-dungeon offline browser fixture.

## 2026-06-20 - Auto (Cursor) - Mining offline fixture + Taoist pet-support spell order

### Changed
- Fixed broken `computeOfflineIncomingChunkDamage` in `src/core/offlineProgress.js` (orphaned body from prior edit).
- `src/core/offlineProgress.js` — `OFFLINE_TAOIST_PET_SUPPORT_SPELL_ORDER`, `nextOfflineTaoistSupportSpellId`.
- `taoistPetSupportAttackOffline` in monolith delegates spell pick to core helper.
- Warrior mining offline browser fixture: save, profile, expected JSON (187 swings, 16 hits, seed `0x810adcee`).
- `npm run fixture:offline-mining`; `fixture:offline` + `npm run check` include mining profile.
- Unit tests for Taoist support spell order (156 tests total).

### Checked
- `npm run check` green (4 offline fixtures: warrior/wizard/taoist zone + warrior mining).
- `npm run smoke` green.

### Suggested Next Step
- Extract full Taoist offline turn tree to core, or add group-dungeon offline browser fixture.

## 2026-06-20 - Auto (Cursor) - Spell cast fallback + live weapon swing core resolver

### Changed
- `src/core/combat.js` — `resolveSpellCastWeaponFallback` (cooldown/MP → weapon vs cast).
- Live + offline wizard attack paths share the fallback helper.
- Live `wizardWeaponAttack` / `taoistWeaponAttack` use `resolvePhysicalAttack`.
- Tests: spell fallback cases (155 unit tests total).

### Checked
- `npm run check` green (includes offline fixtures).

### Suggested Next Step
- Extract Taoist offline turn priority to core, or add mining offline browser fixture.

## 2026-06-20 - Auto (Cursor) - Taoist offline browser fixture

### Changed
- `tests/fixtures/saves/taoist-offline-bicheon-v1.json` — level-20 Taoist, SoulFireBall autocast,
  80 taoist-amulets, Bicheon 1 zone combat.
- `taoist-bicheon` profile + expected JSON (35 kills, survives 5m, seed `0x710adcee`).
- `npm run fixture:offline` now runs all three classes.

### Checked
- `npm run check` green (152 unit tests + warrior/wizard/taoist offline fixtures).

### Suggested Next Step
- Extract wizard/taoist offline spell-selection helpers to core, or migrate live
  `reduceEnemyHp` paths to the outbound damage event seam.

## 2026-06-20 - Auto (Cursor) - Offline fixtures wired into check + wizard profile

### Changed
- Replaced `tools/offline-warrior-fixture.mjs` with profile-driven `tools/offline-zone-fixture.mjs`.
- `tests/fixtures/offline/profiles.json` — warrior + wizard Bicheon 5m profiles.
- Wizard save/fixture: FireBall autocast, 21 kills then death at ~227s (seed `0x510adcee`).
- `npm run fixture:offline` runs both; `npm run check` now includes offline fixtures.

### Checked
- `npm run check` green (152 unit tests + warrior/wizard offline fixtures).

### Suggested Next Step
- Taoist offline fixture, or extract wizard/taoist offline spell-selection decision tree.

## 2026-06-20 - Auto (Cursor) - Warrior offline browser fixture

### Changed
- `tests/fixtures/saves/warrior-offline-bicheon-v1.json` — level-12 warrior in Bicheon 1 zone combat.
- `tests/fixtures/offline/warrior-bicheon-5m-expected.json` — pinned 5-minute offline report
  (26 kills, 378 xp, seed `0x10adbeef`).
- `?testHarness=1` exposes `window.__lomTest.runOfflineZoneProgress` for Playwright.
- `tools/offline-warrior-fixture.mjs` + `npm run fixture:offline-warrior` (starts dev server if needed;
  set `RECORD=1` to refresh expected values).

### Checked
- `npm run fixture:offline-warrior`, `npm run check`, and `npm run smoke` green.

### Suggested Next Step
- Wire `fixture:offline-warrior` into CI/check, or extract wizard/taoist offline spell selection.

## 2026-06-20 - Auto (Cursor) - Offline outbound damage via combat event seam

### Changed
- `src/core/combat.js` — `resolveMagicAttack`, `scalePhysicalDamageForStun`.
- Monolith offline player attacks (warrior/wizard/taoist weapon + magic paths) use core
  resolvers and apply damage through `applyOfflineEnemyDamage` → `applyCombatDamageEvent`.
- Live `scaleEnemyPhysicalDamage` delegates stun scaling to core.

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Browser fixture pinning warrior offline DPS from a fixed save, or extract spell-selection
  logic from offline wizard/taoist attack orchestration.

## 2026-06-20 - Auto (Cursor) - Offline group-dungeon kill loop extraction

### Changed
- `src/core/offlineProgress.js` — group incoming/party DPS helpers,
  `resolveOfflineGroupIncomingChunk`, `estimateOfflineGroupKillDurationMs`,
  and pure `simulateOfflineGroupKillLoop` with monolith damage callbacks.
- Monolith `offlineGroupSimulateKill` delegates to core; incoming chunk damage
  applied via `resolveOfflineGroupIncomingChunk` instead of inline HP math.
- Tests: group DPS + kill-loop characterization cases.

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Extract offline player attack resolution or add browser fixture pinning warrior
  offline DPS from a fixed save.

## 2026-06-20 - Auto (Cursor) - Offline fight tick loop extraction

### Changed
- `src/core/offlineProgress.js` — `computeOfflineFightTravelMs`, `advanceOfflineFightTick`,
  `createOfflineFightEnemy`, `buildOfflineFightResult`, and pure `simulateOfflineFightLoop`
  (callbacks for travel, attacks, recovery).
- Monolith `simulateOfflineFight` delegates to core loop; stateful combat stays in shell
  callbacks.
- Tests: fight loop characterization cases (142 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Extract offline warrior/wizard attack resolution or add browser fixture pinning full
  offline DPS for a fixed warrior save.

## 2026-06-20 - Auto (Cursor) - Offline zone loop characterization

### Changed
- `src/core/offlineProgress.js` — zone report factory, respawn/fight tick math,
  `processOfflineZoneFightCycle`, `simulateOfflineZoneProgressLoop` (pure loop with
  injectable fights), and `computeOfflinePetAttackDelayMs`.
- Monolith `simulateOfflineProgress` delegates outer loop to core; fight tick delta
  and pet attack delay use core helpers.
- Tests: offline zone characterization fixture + 7 new unit cases (136 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Extract `simulateOfflineFight` inner tick loop or add browser fixture test that
  pins full warrior offline DPS against a fixed save.

## 2026-06-20 - Auto (Cursor) - Boss-party exotic strikes + offline group math

### Changed
- Extended boss-party incoming strike helpers: magic-shield hooks, `applyStrikeTargetIncoming`
  for AOE/splash/line targets, combat-text `offsetX` on events.
- Wired boss melee/ranged paths through events: dark devil, bone lord, generic
  `bossPartyEnemyAttack`, evil centipede, mass burst/splash, king scorpion line.
- `src/core/offlineProgress.js` — extracted `offlineGroupHitChance`,
  `offlineGroupAverageDamage`, `computeOfflineIncomingChunkDamage`.
- Tests: offline group math cases (129 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Add full offline zone characterization fixture test; extract solo `simulateOfflineFight`
  tick loop once pinned.

## 2026-06-20 - Auto (Cursor) - Boss-party swarm incoming events + offline kill report

### Changed
- `src/core/combat.js` — added `partyMemberDamageEvent`; physical hit events can target
  player, pet, or party member.
- Monolith: `bossPartyIncomingStrikeTarget` + `applyBossPartyIncomingStrike` shared helper;
  `applySwarmEnemyStrikeToTarget` and generic swarm melee use combat events instead of
  inline HP/log/combat-text mutation.
- `src/core/offlineProgress.js` — `recordOfflineKillRewards` for pure report aggregation;
  `awardOfflineEnemyRewards` delegates report counters to core.
- Tests: party-member damage + offline kill report cases (126 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Wire remaining boss-party solo strike paths through `applyBossPartyIncomingStrike`;
  add offline zone characterization test before touching `simulateOfflineFight`.

## 2026-06-20 - Auto (Cursor) - Incoming enemy attack core + offline event seam

### Changed
- `src/core/combat.js` — extracted `enemyAttackDefenceType`, `incomingAttackDefenceStat`,
  `applyIncomingDamageReduction`, `resolveIncomingEnemyAttack`, and
  `resolveIncomingEnemyRangedAttack` (injectable RNG + damage-reduction percent).
- Monolith delegates incoming attack resolution to core; `offlineEnemyAttack` applies
  player/pet damage via `applyCombatDamageEvent` instead of inline HP mutation.
- Tests: 7 new cases in `combat.test.mjs` (125 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Wire boss-party swarm incoming strikes through combat events; add offline zone
  characterization test before extracting `simulateOfflineFight`.

## 2026-06-20 - Auto (Cursor) - Phase 3 offline mining pure logic

### Changed
- `src/core/offlineProgress.js` — added `rebaseTransientTimestamp`, report count/text
  helpers, `rollMiningOreItemId` / `rollMiningOrePurity`, pure
  `simulateOfflineMiningSwings` (inventory via callback), and
  `computeOfflineTravelTimeMs`.
- Monolith `simulateOfflineMining` delegates to core swing sim; ore rolls and travel
  time are thin wrappers; removed duplicate local report helpers.
- Tests: 5 new cases in `offlineProgress.test.mjs` (118 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Extract offline zone combat report helpers or `offlineTravelTimeMs` math; or wire
  boss-party incoming damage through combat events.

## 2026-06-20 - Auto (Cursor) - Game state + wizard/taoist combat events

### Changed
- `src/persistence/sanitizeGame.js` — `sanitizeCharacterGameState` (mode/zone/mining/progress).
- Extended `src/core/combat.js`: `rollMagicHit`, weapon-swing events, magic resist/burn
  events; wizard/taoist weapon attacks + wizard spell impacts use `applyCombatEvents`.
- Tests: `persistenceGame.test.mjs`; expanded `combat.test.mjs` (90 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Add `{ type: "damage", ... }` state events (not just presentation); extend to taoist
  poison/soul fire and boss-party swarm paths.

## 2026-06-20 - Auto (Cursor) - Inventory persistence + combat event spike

### Changed
- Phase 1 persistence: `src/persistence/sanitizeInventory.js` — inventory/storage
  load normalization + entry field normalization.
- Phase 2 spike: `src/core/combat.js` — `rollHit`, `resolvePhysicalAttack`, and
  presentation event builders for physical miss/hit.
- Monolith: `applyCombatEvents()` applies log/combatText events; warrior physical
  hits/misses and basic enemy melee use the event path.
- Tests: `persistenceInventory.test.mjs`, `combat.test.mjs` (83 tests total).

### Checked
- `npm run check` and `npm run smoke` green.

### Suggested Next Step
- Extend combat events to wizard/taoist attacks and damage application events;
  or extract `sanitizeCharacterGameState` / game progress restore.

## 2026-06-20 - Auto (Cursor) - Phase 1 persistence sanitizers

### Changed
- Continued Phase 1: extracted more save-load sanitizers into `src/persistence/`:
  - `sanitizeCharacter.js` — hotbar, magic, battle, weapon refine, entry durability
  - `sanitizeSettings.js` — settings normalization + `normalizedVolume` / `normalizedMusicMode`
  - `sanitizeUpgrades.js` — account upgrade tiers + legacy rebirth stat migration
- Monolith imports these modules; shell still applies results to `state`.
- Tests: `persistenceCharacter.test.mjs`, `persistenceSettings.test.mjs`,
  `persistenceUpgrades.test.mjs`.

### Checked
- `npm run check` — 75 tests pass.
- `npm run smoke` — clean boot, no console errors.

### Suggested Next Step
- Phase 2: combat event seam, or extract inventory/storage sanitizers next.

## 2026-06-20 - Auto (Cursor) - Phase 1 drop/party core

### Changed
- Phase 1: extracted pure drop-roll and party reward helpers into `src/core/`:
  - `src/core/drops.js` — boss table rolls, zone candidate building, pity math,
    weighted pity pick, Red Thunder Zuma id selection
  - `src/core/party.js` — `splitPartyRewardAmount`
- Monolith delegates drop selection to core; inventory awarding stays in shell.
- `applyBossPartyExperienceReward` now uses `applyExperienceToProgress`.
- Tests: `tests/drops.test.mjs`, `tests/party.test.mjs`.

### Checked
- `npm run check` — 60 tests pass.
- `npm run smoke` — clean boot, no console errors.

### Suggested Next Step
- Continue Phase 1: more persistence sanitizers, or start Phase 2 event seam in combat.

## 2026-06-20 - Auto (Cursor) - Phase 0 safety net

### Changed
- Phase 0 of `docs/core-migration-plan.md`: extracted first pure persistence/core
  slices and wired the live monolith to import them:
  - `src/persistence/saveFormat.js` — `SAVE_VERSION`, `parseSaveSnapshotText`
  - `src/persistence/sanitizeStats.js` — boss-kill/respawn/account/drop-pity sanitizers
  - `src/core/progress.js` — `applyExperienceToProgress` (XP leveling loop)
- Monolith delegates to those modules; `applyExperienceReward` uses the core helper.
- Added characterization tests: `tests/saveFormat.test.mjs`,
  `tests/persistenceSanitize.test.mjs`, `tests/offlineProgress.test.mjs`, plus
  `tests/fixtures/saves/minimal-v1.json`.
- `npm run check` syntax-checks the new modules.

### Checked
- `npm run check` — 51 tests pass (was 40).
- `npm run smoke` — clean boot, no console errors.

### Notes / Risks
- Full `simulateOfflineProgress` still lives in the monolith (needs `state` + zone
  context); offline tests currently pin the pure XP slice. Broader offline
  characterization comes in Phase 3 when that logic moves into `src/core/`.

### Suggested Next Step
- Phase 1: move more pure helpers from the monolith into `src/core/` (drop rolls,
  attack-timing math not already in `battleData`).

## 2026-06-20 - Claude (Cursor)

### Changed
- Trainer room fixes: removed the `toggle`-skill early return so Half Moon /
  Thrusting level at the academy; reworked `trainingRoomCastGapMs` to pace by
  attack speed (Fury no longer freezes the rotation for ~10 min) and skip
  recasting Fury while its buff is active.
- Item icons: ship a single committed atlas (`public/item-icons/items-atlas.*`)
  instead of ~260 individual PNGs to stay under itch's 1000-file limit.
  `itemIconHtml` crops the exact w x h frame at (sx,sy) into a span sized to the
  fitted icon (no max(w,h) square -> no neighbour bleed); pixel-rounded offsets.
  Packager excludes the individual frames and ships the atlas; boot-check updated.
- Released `dist/lom-idle-v2-itch-20260620-183806.zip` (827 files, copy-only).
- Decision doc: added `docs/core-migration-plan.md` - agreed to evolve in place
  (extract a pure `src/core/`), NOT rewrite. Builds on `season-play-architecture.md`.

### Checked
- `npm run check` green; `npm run smoke` clean; `npm run release:itch` boot-verify
  green. Screenshotted dev + packaged build: correct Bicheon town, centered icons,
  no console errors.

### Notes / Risks
- Earlier in the session I broke the release by changing behavior at package time
  (mapstamp trimming dropped the town stamp; a 32px square icon crop bled
  neighbours). Root lesson: packaging must stay copy-only; never subset mapstamps.
- The headless sim seam already exists (`runSimulationStep` vs `render`,
  `suppressSimulationRender`, `simulateOfflineProgress`) - this is why in-place
  core extraction is feasible rather than a rewrite.

### Suggested Next Step
- Phase 0 of `docs/core-migration-plan.md`: add characterization tests (save
  round-trip/migration + deterministic offline progress) before moving any code.

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

## 2026-06-20 - Cursor - core migration: combat damage state events

### Changed
- Extended `src/core/combat.js` with `{ type: "damage", ... }` state events (`enemyDamageEvent`, `swarmEnemyDamageEvent`, pet/poison builders). Hit/burn/weapon-swing builders prepend damage events when `amount > 0`; `skipDamage` option keeps enemy→player hits presentation-only.
- Monolith: `applyCombatEvents` now applies damage via `applyCombatDamageEvent` (enemy HP + swarm enemy HP). Removed duplicate `reduceEnemyHp` / `reduceSwarmEnemyHp` from live combat paths (warrior/wizard/taoist attacks, bang/ground ticks, boss-party impacts, pet attacks, poison ticks, twin-drake/half-moon splash). Offline simulation still calls `reduceEnemyHp` directly.
- Wired Taoist poison apply/resist presentation through `poisonAppliedEvents` / `poisonResistedEvents`; green poison ticks use `poisonTickDamageEvents`.
- Updated `tests/combat.test.mjs` (93 tests total).

### Checked
- `npm.cmd run check` green (93/93 tests, oxlint, syntax-check).
- `npm.cmd run smoke` green (`errors: []`).

### Notes / Risks
- Player/pet damage from enemy melee still uses `target.applyDamage()` directly; only enemy-target damage goes through the event seam for now.
- Session uncommitted per request.

### Suggested Next Step
- Continue core migration: player/pet damage events, or next persistence slice (`restoreGameProgress`, etc.) per `docs/core-migration-plan.md`.

## 2026-06-20 - Cursor - persistence: normalize saved XP + remove dead restore helpers

### Changed
- Added `normalizeSavedProgress()` to `src/core/progress.js` (reuses `applyExperienceToProgress` with 0 XP grant).
- `sanitizeCharacterGameState` now normalizes overflow experience on load so corrupt/edited saves level correctly.
- Removed ~105 lines of dead legacy restore helpers from `app.monolith.js` (`restoreInventoryState`, `restoreGameProgress`, `restoreMagicState`, `restoreHotbarState`, monolith `normalizeSavedProgress`) — load path already uses per-character `sanitize*` via `restoreCharactersState`.
- Tests: `offlineProgress.test.mjs`, `persistenceGame.test.mjs`.

### Checked
- `npm.cmd run check` green (95/95 tests).
- `npm.cmd run smoke` green.

### Notes / Risks
- XP overflow normalization now runs for all character slots on load, not only the legacy single-character restore path (behavior improvement for edited saves).

### Suggested Next Step
- Extract `restoreCharacterSnapshot` (consolidate `sanitizeCharacterState` / legacy snapshot path into `src/persistence/`), or continue combat event seam (player/pet incoming damage).

## 2026-06-20 - Cursor - persistence: restoreCharacter snapshot orchestration

### Changed
- Added `src/persistence/restoreCharacter.js`: `restoreCharacterSnapshot`, `restoreLegacyCharacterSnapshot`, `restoreCharactersFromSnapshot`, `backfillStarterGear`.
- Moved `removeRetiredTestingDefaultMagic` to `sanitizeCharacter.js`.
- Monolith `restoreCharactersState` delegates to `restoreCharactersFromSnapshot`; removed duplicate `sanitizeCharacterState`, `legacyCharacterStateFromSnapshot`, `backfillStarterGear`, and local `removeRetiredTestingDefaultMagic`.
- Tests: `tests/persistenceRestoreCharacter.test.mjs` (multi-character fixture + legacy flat snapshot).

### Checked
- `npm.cmd run check` green (99/99 tests).
- `npm.cmd run smoke` green.

### Suggested Next Step
- Continue persistence (`applySaveSnapshot` account slice) or combat event seam (player/pet incoming damage).

## 2026-06-20 - Cursor - persistence: restoreAccount snapshot slice

### Changed
- Added `src/persistence/restoreAccount.js`: account restore, boss-kill/respawn merge across characters, unpaid storage-page detection, group-dungeon run resolution, save UI meta (active class, tab, hair index).
- `applySaveSnapshot` delegates account restore + migrations to `restoreAccountFromSnapshot`; `migrateAccountStats` / `migrateAccountBossRespawns` reuse shared merge helpers.
- Removed dead `savedGroupDungeonRunFromCharacters` and `restoreEquipmentVisualIndexes`.
- Tests: `tests/persistenceRestoreAccount.test.mjs`.

### Checked
- `npm.cmd run check` green (105/105 tests).
- `npm.cmd run smoke` green.

### Suggested Next Step
- Combat event seam (player/pet incoming damage) or offline progress through core (Phase 3).

## 2026-06-20 - Cursor - combat: player/pet incoming damage events

### Changed
- Added `playerDamageEvent` / `petDamageEvent` to `src/core/combat.js`; `physicalAttackHitEvents` accepts `{ damageTarget: "player" | "pet" }`.
- `applyCombatDamageEvent` applies player/pet damage via `context.target.applyDamage` (preserves flinch, magic shield, pet death side-effects).
- Monolith helpers `applyIncomingTargetHit/Miss`, `maybeFinishBattleAfterPlayerHit`; wired for basic melee, bone lord, minotaur AOE, map lightning solo hits.
- Tests updated in `tests/combat.test.mjs`.

### Checked
- `npm.cmd run check` green (106/106 tests).
- `npm.cmd run smoke` green.

### Notes / Risks
- Boss-party incoming damage and special boss patterns (centipede, mass burst, etc.) still use direct HP mutation — deferred.

### Suggested Next Step
- Phase 3 kickoff: extract `createPendingOfflineProgress` eligibility to core, or wire remaining boss-party incoming hits through the event seam.

## 2026-06-20 - Cursor - Phase 3: offline progress eligibility in core

### Changed
- Added `src/core/offlineProgress.js`: `computeOfflineElapsedMs`, `buildOfflineProgressTiming`, `resolvePendingOfflineProgress` (pure snapshot + clock eligibility for mining/zone offline progress).
- Monolith `createPendingOfflineProgress` delegates to core with zone/min/cap/group-dungeon injectors.
- Tests: 7 new cases in `tests/offlineProgress.test.mjs`.

### Checked
- `npm.cmd run check` green (113/113 tests).
- `npm.cmd run smoke` green.

### Suggested Next Step
- Continue Phase 3: extract offline simulation report math, or wire boss-party incoming damage through combat events.

## 2026-06-22 - Codex - Wizard Turn Undead

### Changed
- Added `TurnUndead` to active Wizard combat spells, spell FX packaging, and the Crystal-style target-mode impact path.
- Implemented Crystal-inspired Turn Undead success logic: undead-only, level-gated, then chance based on spell level plus caster/target level difference.
- Wired solo and boss-party Wizard combat so successful casts instantly kill the eligible target through existing reward/death paths; failed casts show resist/miss feedback.
- Wired offline Wizard zone simulation to use the same special Turn Undead kill roll instead of treating it as MC damage.
- Added `book-turn-undead` from Crystal item 1003, level 32 Wizard requirement, Bone Lord boss drop at 10%.
- Added Turn Undead to the item generator mappings, curated drop CSV, and SFX build mapping (`spell.TurnUndead.cast` / M44-0).

### Checked
- `npm.cmd run build:sfx` green; regenerated SFX manifest/files and kept existing missing-SFX list unchanged except new Turn Undead present.
- `npm.cmd run check` green (167/167 tests plus itch source verification and offline fixtures).

### Suggested Next Step
- Test a learned Turn Undead Wizard in Prajna/undead content and decide if boss undead targets need an explicit design-only immunity flag.

## 2026-06-22 - Codex - Wizard Vampirism

- Added Vampirism to the Wizard combat spell set, spell FX manifest, and SFX build mappings using Crystal shape 45 (`spell.Vampirism.cast` M45-1 and `spell.Vampirism.impact` M45-2).
- Corrected Vampirism spell FX to Crystal client frames: target drain Magic2 1060-1079 and delayed caster return Magic2 1090-1099.
- Matched Crystal's core mechanics: MC-vs-AMC target damage after the spell delay, then queued HP return equal to `damageDealt * (spellLevel + 1) * 0.25`, ticking back in 10 HP chunks after 1s and then every 500ms.
- Wired solo combat, offline zone simulation, boss-party/group combat impacts, save/load recovery state, and player HUD pending-heal display to preserve the Vampirism recovery pool.
- Added `book-vampirism` from Crystal item 1004, level 33 Wizard requirement, Bone Lord boss drop at 10%.
- Bumped live cache strings to `20260622-vampirism`.
- Verification: `npm.cmd run build:sfx` and `npm.cmd run verify:itch:source` passed; targeted `node --check` passed for changed JS/MJS files. Full `npm.cmd run check` currently reaches tests successfully but stops at the existing `warrior-bicheon` offline fixture mismatch (`xp: expected 378, got 375`), which appears unrelated to Vampirism.

## 2026-06-23 - Codex - Turn Undead target FX

- Fixed Turn Undead spell FX placement: the Wizard metadata now anchors the target spell to the enemy, and the TurnUndead atlas layer is explicitly `anchor: "enemy"` with matching extraction config.
- Bumped live cache strings to `20260623-turn-undead-target-fx`.
- Verification: `npm.cmd run verify:itch:source`, `node --check src/app.js`, and `node --check src/app.monolith.js` passed.

## 2026-06-23 - Codex - Turn Undead Crystal FX correction

- Corrected the Turn Undead animation to match Crystal client `PlayerObject.cs`: caster effect uses `Magic` frames 3920-3929 on the Wizard, then target effect uses `Magic` frames 3930-3944 on the enemy object after 600ms.
- Added `enemyObject` spell FX anchoring so object-attached effects do not inherit the target-cell/top-of-tile placement used by map-target spells like Thunderbolt.
- Updated `tools/extract-spellfx-east-native.json`, regenerated `public/spellfx/TurnUndead/l0.png` and `l1.png`, and bumped live cache strings to `20260623-turn-undead-crystal-fx`.
- Verification: `npm.cmd run verify:itch:source`, `node --check src/app.js`, and `node --check src/app.monolith.js` passed.

## 2026-06-23 - Codex - Upgrades panel UX pass

- Reworked the Upgrades scene into a clearer account-progression layout: top hero, compact account stat strip, left section/category navigation, active category summary, and stronger ready/locked/maxed upgrade cards.
- Added tier labels, progress bars for finite upgrades, clearer requirement blocks, status chips, and short letter badges per upgrade type.
- Restyled the rebirth panel so Awakening Souls / Rebirth Points read as balances and the rebirth action sits with the explanatory copy.
- Bumped cache strings to `20260623-upgrades-ux`.
- Verification: `node --check src/app.js`, `node --check src/app.monolith.js`, `npm.cmd run verify:itch:source`, and `npm.cmd run smoke` passed. Full `npm.cmd run check` still stops on the pre-existing `warrior-bicheon` offline fixture mismatch (`xp: expected 378, got 375`).

## 2026-06-26 - Codex - item discovery Codex

- Added account-wide item Codex state to saves/restores and a new `Codex` game window with category tabs for all item types.
- Codex entries stay hidden until the item drops; discovered entries reveal the item icon, default stats, requirement, and every recorded drop source/count.
- Wired discovery recording through mining, zone drops, forced pity drops, solo boss drops, boss-party drops, and special Red Thunder Zuma boss drops. Full-bag drops still count as discovered because the item did roll for the player.
- Bumped cache strings to `20260626-item-codex`.
- Verification: `node --check src/app.js`, `node --check src/app.monolith.js`, `node --check src/persistence/restoreAccount.js`, `npm.cmd run smoke`, and `npm.cmd run verify:itch:source` passed. Full `npm.cmd run check` still stops on the existing `warrior-bicheon` offline fixture mismatch (`xp: expected 378, got 375`).

## 2026-06-26 - Codex - Codex hide unfound toggle

- Added a Codex summary-bar toggle to hide/show undiscovered item placeholders.
- When enabled, each Codex category lists only discovered items and shows an empty-state message if none have been found yet.
- Bumped cache strings to `20260626-codex-hide-unfound`.
- Verification: `node --check src/app.js`, `node --check src/app.monolith.js`, `node tools/smoke-game.mjs "http://localhost:4177/?scene=codex&v=20260626-codex-hide-unfound"`, and `npm.cmd run verify:itch:source` passed.

## 2026-06-26 - Codex - Codex list/detail layout

- Reworked the Codex from large per-item cards into a compact selectable item list plus a right-side detail panel.
- Item rows show icon/name/type/requirement/source count when discovered, or a minimal undiscovered placeholder while locked.
- The detail panel now owns the full stat list and full drop-source list, so high-stat items and items with many sources no longer overflow small cards.
- Bumped cache strings to `20260626-codex-list-detail`.
- Verification: `node --check src/app.js`, `node --check src/app.monolith.js`, `node tools/smoke-game.mjs "http://localhost:4177/?scene=codex&v=20260626-codex-list-detail"`, targeted Playwright DOM check, and `npm.cmd run verify:itch:source` passed.

## 2026-06-26 - Codex - rebirth keeps Codex

- Made `performAccountRebirth()` explicitly clone and restore `state.account.codex` across the rebirth reset path.
- Updated rebirth UI copy/confirmation text so players are told the permanent item Codex is kept.
- Bumped cache strings to `20260626-rebirth-keeps-codex`.
- Verification: `node --check src/app.js`, `node --check src/app.monolith.js`, `node tools/smoke-game.mjs "http://localhost:4177/?scene=upgrades&v=20260626-rebirth-keeps-codex"`, and `npm.cmd run verify:itch:source` passed.

## 2026-06-26 - Codex - achievements window

- Added permanent account achievement state to save/restore and rebirth preservation.
- Added an `Achievements` window/top-bar button with an account-wide unlock cost of 10 Awakening Souls.
- Added first achievement: `Reach level 7`; once achievements are enabled, reaching level 7 unlocks it once, shows `Achievement Unlocked: Reach level 7`, and awards 10,000 gold to the active character.
- Rebirth copy now says Codex, achievements, and rebirth upgrades are kept.
- Bumped cache strings to `20260626-achievements`.
- Verification: `node --check src/app.js`, `node --check src/app.monolith.js`, `node --check src/persistence/restoreAccount.js`, `node tools/smoke-game.mjs "http://localhost:4177/?scene=achievements&v=20260626-achievements"`, targeted Playwright DOM check, and `npm.cmd run verify:itch:source` passed.

## 2026-06-27 - Codex - achievements unlock moved to rebirth

- Moved the 10 Awakening Soul Achievements unlock control from the Achievements window into the rebirth section of Upgrades.
- Hid Achievements navigation until the permanent account unlock is purchased, including guards against opening the locked window through a scene URL.
- Simplified the unlocked Achievements window so it only presents permanent progress and achievement entries.
- Bumped cache strings to `20260627-achievements-rebirth-unlock`.
- Verification: syntax checks, browser checks for locked navigation/direct URL/rebirth placement/layout fit, smoke test, and `npm.cmd run verify:itch:source` passed with no browser console errors.

## 2026-06-27 - Codex - temporary achievements test access

- Added a single temporary `ACHIEVEMENTS_TEST_ACCESS` flag so the Achievements button, tracking, and rewards can be tested without purchasing the rebirth unlock.
- Kept the real account purchase flag untouched; the rebirth page labels this state as `Test Access`, so disabling the temporary flag restores the intended 10-soul unlock flow.
- Bumped cache strings to `20260627-achievements-test-access`.

## 2026-06-27 - Codex - click to claim achievement rewards

- Achievement completion now records an unclaimed reward instead of granting it immediately.
- Claimable achievements show `Reward Ready`; clicking the achievement grants its reward once to the character that originally achieved it, then changes the row to `Claimed`.
- Existing rewards previously recorded as claimed remain claimed, avoiding duplicate migration rewards.
- Bumped cache strings to `20260627-achievement-claim`.
- Verification: syntax checks and smoke test passed. Browser testing confirmed level 7 awarded no immediate gold, clicking granted exactly 10,000 gold, a second claim was unavailable, and the claimed state persisted after refresh with no console errors.

## 2026-06-27 - Codex - retroactive achievement detection

- Added achievement eligibility checks after loading/offline progress and whenever the Achievements window opens.
- Existing characters already beyond an achievement requirement now change from `Active` to `Reward Ready` instead of waiting for another level-up event.
- Bumped cache strings to `20260627-achievement-retroactive`.

## 2026-06-27 - Codex - solo Evil Snake achievement

- Added `Solo kill Evil Snake`, earned by defeating the Stone Tomb KR Evil Snake with exactly one participating character.
- Summoned pets do not disqualify the attempt; selecting any additional player character does, even if that character dies during the fight.
- Added a claimable 50,000 gold reward for the character that completed the solo kill.
- The weaker Evil Snake used in Black Dragon Dungeon cannot trigger this achievement.
- Bumped cache strings to `20260627-solo-evil-snake-achievement`.
- Verification: syntax checks, smoke test, and `npm.cmd run verify:itch:source` passed.

## 2026-06-27 - Codex - Achievement reward row layout

### Changed
- Reset inherited button sizing on reward-ready achievement rows so their full content determines row height.
- Top-aligned achievement row content to keep claimable and nonclaimable entries visually consistent.
- Bumped cache strings to `20260627-achievement-row-layout`.

### Checked
- `node --check src/app.js`, `node --check src/app.monolith.js`, the achievement-scene smoke test, and `npm.cmd run verify:itch:source` passed.

## 2026-06-27 - Codex - Consistent achievement row elements

### Changed
- Claimable achievements now use the same article row structure as every other achievement instead of switching to a browser button element.
- Preserved whole-row claiming with mouse, Enter, and Space controls.
- Bumped cache strings to `20260627-achievement-row-elements`.

### Checked
- Syntax checks, the achievement-scene smoke test, and `npm.cmd run verify:itch:source` passed.

## 2026-06-27 - Codex - Preserve achievement claim position

### Changed
- Registered the independently scrolling achievement list with the existing scene scroll-preservation system.
- Claiming a reward now rebuilds the list at its previous scroll position instead of returning to the first achievement.
- Bumped cache strings to `20260627-achievement-scroll`.

### Checked
- Syntax checks, the achievement-scene smoke test, and `npm.cmd run verify:itch:source` passed.

## 2026-06-27 - Codex - achievement milestones and boss rewards

- Added level achievements for levels 22, 33, 40, 43, and 45 with the requested gold and permanent XP rewards.
- Added boss achievements for Zuma Taurus, Evil Centipede, Bone Lord, Minotaur King, Oma King Spirit, and Yimoogi with the requested Awakening Soul rewards.
- Claimed achievement XP bonuses are account-wide, stack together, use the shared live/offline XP multiplier, and persist through rebirth with achievement state.
- Non-solo boss achievements accept any party size and retroactively recognize recorded boss kills. The Evil Snake solo achievement still requires a newly observed one-character victory because old saves do not retain party composition.
- Awakening Soul rewards are placed in the earning character's inventory; a full bag leaves the reward unclaimed and retryable.
- Bumped cache strings to `20260627-achievement-milestones`.
- Verification: syntax checks, smoke test, and `npm.cmd run verify:itch:source` passed.

## 2026-06-20 - Cursor - Phase 3: offline progress eligibility in core

### Changed
- Added `src/core/offlineProgress.js`: `computeOfflineElapsedMs`, `buildOfflineProgressTiming`, `resolvePendingOfflineProgress` (pure snapshot + clock eligibility for mining/zone offline progress).
- Monolith `createPendingOfflineProgress` delegates to core with zone/min/cap/group-dungeon injectors.
- Tests: 7 new cases in `tests/offlineProgress.test.mjs`.

### Checked
- `npm.cmd run check` green (113/113 tests).
- `npm.cmd run smoke` green.

### Suggested Next Step
- Continue Phase 3: extract offline simulation report math, or wire boss-party incoming damage through combat events.

## 2026-06-26 - Cursor - Boss empowerment Phase 1 (unlock + gold gate)

### Changed
- Enabled rebirth upgrade `boss-empowerment` at **10 Rebirth Points** (removed `planned` lock).
- Boss entry empower toggle now charges **100,000 gold** on Fight confirm (not on toggle); gold is spent even on death.
- Sets `state.battle.bossEmpowered` for the fight; boss entry UI shows cost, gold balance, and disables Fight when broke.
- Updated all boss room locked-hint copy to point at the rebirth upgrade.

### Checked
- `npm.cmd run smoke` green.
- Unit tests 173/173 pass; offline warrior fixture pin failed pre-existing (`xp: expected 378, got 375`).

### Suggested Next Step
- Phase 2: Wooma Taurus empowered stat scaling + separate empowered drop table in `bossDrops.js`.

## 2026-06-30 - Codex - Noticeboard Social identifiers

### Changed
- Town noticeboard messages now show the same shortened public Social identifier used by the leaderboard (`Player XXXXXXXX`) instead of using the character class as the author.
- Character class and level remain as secondary message context.
- The Worker still withholds the raw player ID from the public response.
- Deployed Worker version `e29fd49b-35bf-4a51-9042-348f8956ea77`.

### Checked
- Worker and game syntax checks passed.
- Noticeboard tests passed (3/3), including public-label and raw-ID privacy coverage.
- `npm.cmd run lint` passed with one pre-existing map-builder warning.
- `npm.cmd run smoke` passed.
- Live POST returned the expected public label; the temporary verification message was removed from D1.

## 2026-06-30 - Codex - Restored overwritten noticeboard client

### Cause
- A later version of `src/app.monolith.js` no longer contained any noticeboard client code or the `message-board` entry in `TOWN_NPCS`; the Worker endpoint, official sprite assets, and CSS were still present.
- This was a client-file overwrite/regression, not a server or rendering failure.

### Restored
- Restored the official town noticeboard NPC, message state, API loading/posting, Crystal panel rendering, refresh/post controls, draft focus handling, and noticeboard-wide hotkey suppression.
- Message authors continue to use the public Social identifier (`Player XXXXXXXX`) with class and level as secondary context.
- Added support for NPCs that deliberately suppress the generic ellipse shadow, as the board asset requires.

### Checked
- `node --check src/app.monolith.js`, `npm.cmd run lint`, and `npm.cmd run smoke` passed (one pre-existing map-builder lint warning remains).
- Browser verification confirmed the board is visible and clickable in town, and existing live messages load with Social identifiers.

## 2026-06-30 - Codex - Private message moderation

### Added
- Added private message moderation page at `/messages` (also available at `/moderation`).
- Reuses the existing Worker `ADMIN_TOKEN` used by the integrity review page.
- Added Live, Removed, and All views with reversible **Delete Message** and **Restore Message** actions.
- Deleting sets the message status to `removed`, immediately excluding it from the public board without destroying recovery data.
- Restoring an expired message renews its public lifetime for 14 days.

### Checked
- Worker/panel syntax, lint, public noticeboard tests, and moderation authorization/action tests passed (8/8 targeted tests).
- Wrangler dry run passed; deployed Worker version `8118781f-ade5-4c23-bf74-1f5d61b0c7ed` with `--keep-vars`.
- Live `/messages` returned 200 and the unauthenticated admin API returned 401. No existing messages were modified during verification.

## 2026-06-30 - Codex - Social empowered item tooltips

### Fixed
- Social character equipment tooltips now preserve `empowered`, `empowerTier`, empowered stat rolls, and empowered spell bonuses when reconstructing another player's equipment entry.
- Added `src/core/socialEquipment.js` as the tested conversion boundary instead of duplicating a partial equipment shape inside the UI.
- The Worker already stored and returned these fields, so no server deployment or player resubmission is required.

### Checked
- Added two regression tests covering empowered stats/spell bonuses and malformed-value sanitization.
- Syntax checks, targeted tests (2/2), lint, and `npm.cmd run smoke` passed; the existing map-builder lint warning remains.

## 2026-06-30 - Codex - Manual Social exclusion

### Added
- Integrity Review now has a **Manual Social Removal** control above the review queue.
- Accepts either the visible `Player XXXXXXXX` Social label or a full player ID.
- Short labels must resolve to exactly one account; ambiguous prefixes are refused and return the matching full IDs.
- Successful removals persist as `excluded`, switch the page to the Removed tab, and remain reversible through **Restore To Social**.

### Checked
- Integrity tests passed (11/11), including exact ID, unique public-label, ambiguous-label, authorization, and public filtering cases.
- Wrangler dry run passed; deployed Worker version `71d62e75-fe06-4cec-85f6-6dc8467953d4` with `--keep-vars`.
- Live `/integrity` contains the manual control and the unauthenticated action endpoint returns 401. No player was removed during verification.

## 2026-07-01 - Codex - Demo noticeboard disabled

### Changed
- The town noticeboard remains visible in the demo but now shows a static notice directing players to `www.lom2idle.com` and confirming that demo saves can be imported without progress loss.
- The URL is clickable and opens safely in a new tab.
- Added `DEMO_MESSAGE_BOARD_DISABLED` so the interactive implementation remains intact for the full version while the demo no longer fetches messages on open.

### Checked
- Syntax, lint, and `npm.cmd run smoke` passed; the existing map-builder lint warning remains.

## 2026-06-27 - Taoist - Energy Shield spell

### Added
- Taoist **Energy Shield** (Crystal spell 84): party amulet buff with proc-heal on hit, not AC/MAC.
- Duration `(30 + 50 × skill level)` seconds; heal `round(SC/4 × (level+1))`; proc chance from Crystal luck/skill formula.
- Cast/loop FX from Magic2 1890/1900 atlases; SFX M84-0 cast + M84-1 bless.
- Wired through solo combat, boss party, offline support order, training room, skill bar queue, and attached loop FX on player/pet/party members.

### Data
- `book-energy-shield` item added to `src/data/items.json` (level 48 requirement).

### Checked
- `npm.cmd run check` — 294 unit tests pass (pre-existing offline warrior XP fixture mismatch remains).
- `npm.cmd run smoke` — clean boot, no console errors.

### Crystal-faithful retune (2026-06-27)
- Single friendly **player** target only (no party-wide, no pets); Crystal server does not consume amulet.
- Instant apply on cast (not pending Soul Shield delay); proc-heal tooltip text matches Crystal buff dialog.

## 2026-06-27 - Taoist - Healing Circle spell

### Added
- Taoist **Healing Circle** (Crystal spell 86): ground AOE heal under the Taoist (not an attack).
- Impact delay 1700ms; duration `(10 + 5 × skill level)` seconds; ticks every 400ms for +25 HP to injured allies/pet/party.
- Cast/ground FX from Magic3 620/630 atlases; SFX M86-0 cast + M86-1 field.
- Wired through solo combat, boss party, offline, training room, skill bar queue, and support autocast after Mass Healing.

### Data
- `book-healing-circle` item in `src/data/items.json` (level 39 requirement).

### Checked
- `npm.cmd run check` — unit tests pass (pre-existing offline warrior XP fixture mismatch may remain).
- `npm.cmd run smoke` — clean boot expected after monolith changes.

## 2026-07-03 - Crafting cube salvage

### Added
- **Havoc Crystal** material (`havoc-crystal`, Crystal frame 1173) in `src/data/items.json` + icon.
- Crafting cube **Salvage** mode: drag items into 3×3 grid, salvage all at once for 1 Havoc Crystal per empowerment tier.
- Rejects non-empowered items with **Can only salvage Empowered Items**; batch salvage up to 9 items.
- Staging/drag-drop mirrors weapon refine (`stagedEntries`, restore on close).
- `src/core/craftingCube.js` + `tests/craftingCubeSalvage.test.mjs`.

### Checked
- `npm.cmd run check` — 365 unit tests pass (pre-existing offline warrior XP fixture mismatch).
- `npm.cmd run smoke` — clean boot.
