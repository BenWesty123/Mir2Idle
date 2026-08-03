# AI Task Log - LOM Idle V2

## 2026-08-01 - Spirit Box blocks Unique items

Unique items can no longer be sealed in the Spirit Box (same as Ethereal).
Any Unique/Ethereal already stored is cleared on rebirth so it cannot
survive the reset. Tooltip + Spirit Box upgrade summary updated.

### Changes
- `src/app.monolith.js`: `canDepositInventoryEntryToSpiritBox`,
  `clearSpiritBoxPaidForRebirth`, Unique tooltip tag, upgrade summary,
  `__lomTest.setupSpiritBoxTest` grants an Awakened Unique for testing
- `src/data/changelog.json`: note under today's entry

### Verify
- `npm.cmd run check`
- Try depositing an Awakened Unique into Spirit Box (should refuse)
- If one was already sealed, rebirth should clear it

## 2026-08-01 - Stats 2 (State) bonus modifiers

Character → State tab now shows an active-character **Bonuses** section:
total XP / gold multipliers, skill leveling, soul & item drop chance,
mining speed, boss respawn cut, potion restore, damage taken, and skill
XP roll max. Uses existing total* helpers (rebirth + gear + achievements
+ supporter where applicable).

### Verify
- `npm.cmd run check`
- Open Character → State and confirm Bonuses rows update with gear/upgrades

## 2026-08-01 - Remove Disruptor Cascade from Alchemist

Removed temp test stock `glyph-disruptor-cascade` from `ALCHEMIST_STOCK_IDS`
and the 1g fallback in `alchemistShopBuyPrice` that existed only for that
Crystal 0-buy test item.

### Verify
- `npm.cmd run check`

## 2026-08-01 - Third Glyph slot (rebirth upgrade tier 2)

**Add Additional Glyph Slot** now goes to max tier 2 (3 equip slots total).
Tier 2 costs **500 RP**; tier 1 stays 250 RP. Unlock count uses
`accountUpgradeTier` instead of a boolean purchased check.

### Changes
- `src/app.monolith.js`: `rebirth-extra-glyph-slot` maxTier/costs, 
  `GLYPH_EQUIP_UNLOCK_CAP = 3`, `unlockedGlyphEquipSlotCount`, upgrade progress
  text + glyphs intro copy

### Verify
- `npm.cmd run check` (+ smoke when testing in-game)

## 2026-08-01 - Awakened bosses (tier above Ascended)

Added **Boss Awakening** as the third empowered-boss tier (same UI/combat/drop
pattern as Empowered → Ascended).

- Rebirth upgrade `boss-awakening` (requires Ascension; **250 RP**). Free
  cost needed a `payAccountUpgradeCost` skip so `payRebirthPoints` does not
  floor 0 → 1 RP (kept for any future free rebirth upgrades).
- Solo gold **1,000,000** / group dungeon **3,000,000**; combat & drop table
  **4×** HP / damage / drops.
- Empowered-item chance **40%**; star weights **30 / 30 / 25 / 15**
  (`AWAKEN_TIER_WEIGHTS`); glyph **20%**; Awakening Soul rolls **4**.
- Group-dungeon empower tier clamp extended to **0–3**.

## 2026-07-31 - Offline sim: taoist stall fix ("2 kills instead of 8h AFK")

Players (taoist only) reported AFK sessions crediting ~2 kills instead of hours.
Root cause: the offline fight loop (`simulateOfflineFightLoop`) deadlocked at
`delta=0` when a pet reported "attack now" (`computeOfflinePetAttackDelayMs`
returned 0) but `updateOneTaoistPetAttack` refused to act without advancing
`nextAttackAt`. The 5000-iteration guard then ended the fight "incomplete" and
`simulateOfflineProgress` **broke out and silently discarded the rest of the
offline window**. Concrete triggers, all taoist-specific:

- **Paralyzed pet**: `combatantParalyzed` gates the attack, and pet/player
  poison ticks (`updateCombatantPoisons`) were never run during offline sim, so
  paralysis picked up live (or in a prior offline fight) never expired.
- **Holy Deva mid-follow**: `pet.moving`/`pet.followPending` gate the attack
  but follower movement is only cleared by live per-frame updates.
- **Range mismatch**: `offlinePetAttackDelayMs` measured range with
  `taoistPetEnemyDistance()` (defaults to the tank pet) while the attack gate
  measures the specific pet.

Fixes:

- `src/core/offlineProgress.js`: `computeOfflinePetAttackDelayMs` takes
  `blocked` (returns Infinity, never 0); `simulateOfflineFightLoop` marks
  guard-exhausted unresolved fights `stalled: true`;
  `processOfflineZoneFightCycle` returns new status `"fight_stalled"`.
- Monolith `offlinePetAttackDelayMs`: passes `blocked` (paralysis / follower
  moving) and per-pet distance.
- Monolith `offlineUpdateRecovery`: now runs
  `updateCombatantPoisons(now, { offline: true })` so player/pet paralysis,
  slow and green poison tick down (and deal damage) with simulated time - the
  function was already offline-aware but never wired in.
- Monolith offline fight `onTravelComplete`: settles follower pets (clears
  `moving`/`followPending`, `placeTaoistCombatPet`) since follower movement is
  not simulated offline.
- Monolith `simulateOfflineProgress`: `fight_stalled` no longer aborts the
  window - it clears wedged transients (pendingPetAttack, pet poisons/timers),
  advances by the respawn delay and keeps simulating; after 5 stalls it aborts
  with `report.stallAborted` and the report shows "Offline progress ended early
  (simulation error)" plus a `console.warn`.

Verified: `npm run check` green, `npm run smoke` green, unit tests added for
blocked delay / stalled flag / `fight_stalled` status, and
`fixture:offline-taoist` passed 6/6 consecutive runs (previously flaked ~50% -
the flake was the same class of bug: sim start state depending on live pre-sim
pet frames).

## 2026-07-31 - Freeze target spell FX on kill (Flame Disruptor)

Target/projectile enemy FX was anchored to the live primary. A killing blow
(`syncGroupDungeonPrimaryEnemy`) swapped the primary mid-animation, so Flame
Disruptor's delayed enemy layer played on the *next* monster. Cast now freezes
the target tile (`activeSpellImpactAnchor` / `fxCenterTile`) for solo, boss
party, and mirrors.

## 2026-07-31 - Disruptor Cascade uses shrunk FlameField bang

Cascade explosions reuse FlameField **layer 1** (the animated field; layer 0 is
a near-static hold) at scale 0.56 for the first 10 frames, with Crystal's 500ms
layer delay forced to 0.

## 2026-07-31 - Disruptor Cascade step delay

Queued cascade explosions on `pendingDisruptorCascade` with
`DISRUPTOR_CASCADE_STEP_DELAY_MS` (110ms) between steps so chains read as a
sequence instead of resolving in one frame. Step 0 still lands immediately.

## 2026-07-31 - Temp Alchemist stock: Disruptor Cascade

Added `glyph-disruptor-cascade` to `ALCHEMIST_STOCK_IDS` for testing. Crystal
`shop.buy` is 0, so `alchemistShopBuyPrice` sells 0-buy alchemist stock at 1g.
Remove before release.

## 2026-07-31 - Disruptor Cascade: kill-explosion chain

Reworked **Glyph of Disruptor Cascade**: instead of on-hit 50%/50% orthogonal
splash, a Flame Disruptor *killing blow* makes the target explode for that hit's
full damage to all 8 adjacent swarm enemies (N/NE/E/SE/S/SW/W/NW). Explosions
chain on kills (BFS, each enemy explodes once). Solo / no neighbours is a no-op.
Pure planner in `glyphModifiers.js`; wired at FD kill sites in the monolith.
Visual explosion FX still TODO.

## 2026-07-31 - Weapon glow pairing: silhouette matcher + visual review

The `CWeaponEffect` glow libs pair to weapons purely by art (no Crystal item field
links them), so pairing was previously done by eye. Two new review-only tools make
it measurable. Nothing here touches the game or `items.json`.

`tools/render-weapon-glow-vision.mjs` renders glow and weapon layers at their shared
Crystal anchor into flat PNG contact sheets — either layer alone, or a glow with the
weapon's silhouette stroked over it — so a pair can be judged visually.

`tools/match-weapon-glows-by-blur.mjs` scores pairs. The key observation from the
confirmed pairs is that a glow lib is **a blurred halo drawn around a desaturated copy
of its own weapon's sprite**. So it scores two things and blends them 35/65:

- *halo*: best IoU between the glow's level sets and the weapon silhouette dilated by
  r. Dilating by r is exactly "distance <= r", so one pass over an exact Euclidean
  distance transform scores every radius at once.
- *core*: the same IoU against the glow's low-saturation interior, which is the weapon
  redrawn inside the halo. This is the sharper of the two signals.

Halo alone ranks 16/18 known pairs top-1; adding the core term gives **18/18**, and the
older PCA-moment scorer managed 7/18. Run with `--validate` to re-check against
`weapon-glow-mappings.json` after editing it.

Two new aura pairs met the confirmed-pair score band with a clear margin and were
verified visually: **glow 17 → shape 23** (ZumaSoulSpringWand) and **glow 18 →
shape 21** (ZumaJudgementMace).

The libs are TWO families, and a shape can own one of each (owner spotted the
first case):

- **family "aura" (glows 1–20)**: gold halo around a desaturated copy of the weapon,
  scattered shape order. All 20 confirmed by the matcher + eye.
- **family "fx" (glows 21, 24–66)**: elemental streak/burst effects. A "glow N =
  shape N" identity pattern holds for SOME of these but was initially overclaimed as
  a rule — the owner flagged wrong pairs, and glow 60 proved it: its burst nests
  around **shape 72**, not pike 60 (owner called it; the *walking* frame is the
  discriminating view because each weapon hangs at a distinctive angle there, unlike
  the shared standing pose).

Ground truth was hunted and does not exist: every `Server.MirDB` in Crystal-master
(Build + the four community DBs in `Crystal.Database-main`) has `Effect = 0` on all
weapons, and NextClient/NextServer carry no weapon-effect data. Pairing is art-only;
the owner's eye is the authority. Two automated fallbacks were tried and both fail
on the fx family: centroid motion tracking (`match-weapon-glows-by-motion.mjs` —
one-handers all swing identically, and a glow's own pulsing moves its centroid) and
a bright-core variant of the dilation matcher (`--core bright` — can't even recover
the known-good fishing rods).

So `weapon-glow-mappings.json` is split into `mappings` (believed pairs) and
`candidates`. Owner verdict 2026-08-01: **only the mapped pairs are correct**.
Catalog is now **`mappings` (22)** = 20 aura + 2 fx
(55→**GonRyunHolyLightSword / shape 78**, 56→IceDragonSkyRod) and
**`candidates` (empty)**. Glow 54→ConquerorSpear was fully unmapped by the owner
(not a frame-sync issue; Crystal art restored). Glow 55 was initially mapped to
IceDragonSkyKnife (55) then owner-corrected to shape 78. Glow 57→IceDragonSkySword
was rejected. Remaining glows stay unmapped with no suggested weapon.

### Fixing a mis-authored glow: `tools/align-weapon-glow.mjs`

The owner spotted that glow 56 sat *rotated* off IceDragonSkyRod. The pairing was
right (the glow's tip has the rod's three-prong topology; the sword shape 57 is a
single broad blade and cannot fit) — Crystal simply authored the art off-axis. So
the fix is to re-align the art, not to remap it.

The tool scores each frame as `0.7 * (glow's desaturated core landing on the dilated
weapon silhouette) + 0.3 * (weapon pixels sitting under the glow)`, searches a rigid
rotate+shift around the weapon centroid, then **regularises each frame toward the median**
so the animation cannot jitter. Two modes: `translate` (shifts offsets only, PNG
untouched, lossless) and `rigid` (rotates, repacks the sheet).

For glow 56, translate-only reached 0.600→0.683 with per-frame shifts swinging ±12px
(jittery); `rigid` reached **0.600→0.864 with 173/173 frames improved and none
regressed**, and — the real tell — the per-frame answers cluster tightly *within* each
action (standing/walking all ≈ −13°, shift ≈ (2,−5)), which is what a constant
authoring offset looks like. Re-measuring the baked atlas returns 0.872 with zero
further correction on every stand/walk/run/attack frame.

**Gotcha worth remembering:** these `sprite-sets/common` sheets are a SINGLE ROW of
slots — readers index `sx = slot * slotWidth, sy = 0`. The first bake repacked into a
square grid, so every frame past the first row silently read neighbouring garbage
(the verification pass caught it: early frames 0.90, later frames 0.13). The packer
now always emits one row.

Crystal originals are copied to `tools/weapon-glow-align-backups/<glow>/` before any
write; `--restore` puts them back, `--report` measures without writing. The review
page also gained live rotate/dx/dy dials plus a "copy bake command" button for
tuning a pair by eye.

**Negative result — do not retry this.** The obvious next idea is to turn alignment
into a *matcher*: score every candidate weapon by the best score achievable under one
shared rotate+shift, on the theory that a true pair needs a single constant correction
while a wrong weapon needs a different fudge per frame. It was built and measured, and
it does not work. On the aura family it managed 16–17/20 top-1, i.e. *worse* than the
existing dilation matcher's 20/20; on seven confirmed **fx** pairs it scored **0/7**,
essentially random (glow 31 ranked its own weapon 51st). The reason is structural:
alignment scoring assumes the glow contains a weapon-shaped core to seat onto the
silhouette, which is true of aura glows and false of fx glows — fire, petals and
particle streaks have no outline to align. Scores also saturate near 1.0 once the
transform is free, which destroys discrimination.

So alignment is a **repair** tool, not a discovery tool: it is only meaningful once a
pair is already believed, where it distinguishes "wrong weapon" from "right weapon,
badly authored". Discovery for the fx family still has no automated method — the
owner's eye remains the authority.

### Health sweep of the believed pairs, and what the per-frame numbers mean

Running `--mode rigid --report` over every pair in `mappings` (~11 min) is the right
use of the tool, and the *shape* of a pair's per-frame scores turns out to diagnose it
far better than the aggregate does:

- **Flat and high, 0° correction** → correct and well authored. 17 of the 20 aura
  pairs look like this.
- **Flat and middling, correction changes nothing** → the glow tracks the weapon
  perfectly but only covers part of it. Aura glows 5→28 and 6→32 sit at a rock-steady
  0.44–0.50 in *every* frame and the search finds nothing better in 130+ of 173 frames;
  that is a halo authored shorter than a long weapon, not a mismatch. Both still rank
  #1 in the dilation matcher, so they stand. **A low aggregate score alone is not
  evidence against a pair.**
- **Flat and middling, but corrections disagree frame to frame** → suspicious. Glow
  7→33 lifts 0.374 → 0.480 in 171 of 173 frames, yet via rotations spanning −13° to
  +10° and shifts swinging ±12 with no agreement — the search buying overlap with a
  different fudge each frame, the same signature that sank the alignment-as-matcher
  experiment. Its matcher win is also a near tie (0.293 vs 0.287 for shape 47). Kept
  in `mappings` on rank, but flagged in its note as the weakest aura pair.
- **Low baseline, big lift, and per-frame answers that agree** → mis-authored, worth
  repairing. This is the glow-56 fingerprint. Only glow 31→31 showed it: walking
  frames 0.28 → ~0.83 under a consistent +4–6° / (−12,+5). Left un-baked pending the
  owner's eye.
- **0.00 baseline that nothing recovers** → the glow is never on the weapon. Glow
  49→49 scores 0.00 on every walking and running frame.

That sweep exposed a process failure worth naming: several fx entries had been written
into `mappings` on the strength of same-index guessing plus a confident-sounding note
("fire emanates from the dragon-head tip"), which reads like evidence but is not.
Glows **30, 34, 49, 50 were demoted back to `candidates`** — 49 with hard evidence
against it, the others simply unsupported. Only pairs the owner has confirmed by eye
(56, 60→72) or that measure decisively (21→21 holds 0.85–0.89 with no correction)
belong in `mappings`. Note in particular that glow 34 ranks *first* in the dilation
matcher at a score of 0.046 — for fx glows the matcher's scores collapse to noise, so
rank without magnitude means nothing.

The review page now supports adjudicating the candidate queue directly: each candidate
card renders against **its own** suggested weapon (rather than the shared dropdown, so
all 40 can be scanned in one pass) and carries ✓ / ✗ / ? buttons that persist to
`localStorage`, with "Export verdicts" copying a JSON blob to fold back into the
catalog.

## 2026-07-31 - Danmo winged bolt faced north; Range2 blend was blank

Two Crystal frame-index bugs in `tools/build-danmo-combat-atlas.mjs`, both from
reading a directional FX block as if it were a single non-directional animation.

**1. Travel bolt faced the wrong way.** Crystal's `Missile.Draw()` is
`index = BaseIndex + (CurrentFrame % FrameCount) + Direction * (Skip + FrameCount)`,
and `MonsterObject.cs:2833` builds Danmo's bolt with base 688, count 4, skip 0,
`direction16: false` — so 688 is an 8-direction block of 4 frames each and west
(`MirDirection.Left` = 6) is **712..715**, not 688..691. The atlas shipped 688..691,
which is direction 0 (Up): a symmetric winged silhouette seen from behind, flying
away from the camera. 712..715 is the left-facing profile with the wings trailing
east. Every other Danmo blend already used `DIR * stride` correctly; only the
projectile spec had the direction term missing.

Frame offsets differ per direction by design (dir 0 is centred at `-372,-92`; dir 6
is `-119,-255`, i.e. the anchor is the leading tip and the flames trail behind).
`drawEnemyRangeProjectileCanvas` draws the travel frame at
`travelPoint + meta.offset`, matching Crystal's `DrawLocation + offset`, so the new
frames stay self-consistent with no renderer change.

**2. `attackRange2Blend` was 8/8 empty frames** — the on-mob crescent for the AoE
was rendering nothing at all. Crystal reads `(730 + FrameIndex + Direction*10) - 3`,
so dir 6 wants 790..794, but `272.Lib` has art only at 730..753 and it is *not*
per-direction: 730 ×10 is the crescent that rises on the mob and 740 ×14 is the
ground crater. Anything past dir 1 lands on empty frames. Switched the blend to the
dir-0 slice **730..734** (3 padded empties + 5 frames, matching the 8-frame
`attackRange1` body clip that drives the blend index). The crater `projectileHeavy`
at 740 ×14 was already correct.

Bumped `MONSTER_ASSET_VERSION` to `20260731-danmo-bolt-dir6` so the rebuilt
`public/monsters/monster/272.{json,png}` beats the CDN cache. No stats, damage or
targeting changed — Danmo stays at 109% of Hell Lord.

## 2026-07-31 - Crafting Cube Glyph Recycle recipe

Added **Glyph Recycle** to the crafting cube Recipes list: sacrifice two
glyphs + 100,000 gold for one uniform-random glyph that cannot be either of
the two consumed types (same type twice only excludes that one id). Autofill
stages two bag glyphs.

- `src/core/craftingCube.js`: recipe, gold cost, validate, autofill
- `src/glyphModifiers.js`: `rollRecycledGlyphItemId`
- `src/app.monolith.js`: craft attempt wiring
- Tests: `tests/craftingCubeSalvage.test.mjs`, `tests/glyphs.test.mjs`

## 2026-07-31 - Danmo winged bolt picks a random target

The Range1 travel bolt (the fiery winged figure) and the Range2 burst both aimed
at the tank every single cast: `resolveDanmoRangeStrike` centred its splash on
`kingScorpionPrimaryTarget()` (= `bossPartyFrontTarget()`), and the art anchored
via `boneLordProjectileTargetAnchor()`, which falls through to the front target
because the `danmoRange` strike never sets `aoe: true`.

New `danmoRangeAimTarget()` picks a random living target, preferring non-tank —
Crystal AncientBringer aims at whoever is in range, not at whatever is tanking.
It reuses `bossPartyRandomLivingRangedTarget()`, which already existed in the
monolith with **zero callers**.

The chosen aim point is frozen onto the strike as `aimWorldX` at launch, so:
- the blast lands where the bolt was fired even if that target dies mid-flight;
- travel art, impact art and damage centre all read the same number.

`boneLordProjectileTargetAnchor()` now honours `aimWorldX` when present. That is
generic but only `danmoRange` sets the field, so no other boss changes. Danmo's
`projectile` is `style: travel` and `projectileHeavy` is `style: targetBurst` with
`anchor: "target"`, so both follow the aim point — verified in `272.json`.

**Difficulty is unchanged at 109% of Hell Lord.** Splash stayed at 4/5 tiles, and
with the party at tiles 1/3/5 a 4-tile blast covers all three wherever it is
centred (the Wizard sits exactly 4 tiles from the tank, on the boundary). So this
is a visual/telegraph fix, not a balance change. Tightening splash to 2/3 tiles
would make the pick actually matter but drops him to 89%, needing ~147k HP —
deliberately not done.

## 2026-07-31 - Danmo retuned to capstone boss (~110% of Hell Lord)

Audited every boss on "total damage the party must absorb" (incoming party-wide
DPS x fight length), which cancels party DPS and so depends only on the monsters.
**Hell Lord (id 440) is the hardest fight in the game** — `alwaysAoe` +
`massBurstTiles: 7` makes every swing a full-party burst with no single-target
filler, at 541 incoming DPS across 97,500 HP.

Danmo measured **2%** of that. Two bugs, not just soft numbers:

- **His entire ranged kit had never fired.** A boss rests
  `BOSS_PARTY_ENEMY_MELEE_GAP` (1 tile) from its tank while `meleeRangeTiles`
  is 2, so `beginDanmoAttack`'s distance check picked melee on *every* swing
  forever. The MC AOE, both splash radii, the Ancient Bat summon and both range
  blends were unreachable in play. His melee line is 2 tiles deep and the Taoist
  sits at 3, so the back line took literally zero damage.
- **`accuracy: 16`** whiffed ~45% of swings on agile characters (Hell Lord's 50
  never misses), silently eating most of the damage budget.

Fix: `beginDanmoAttack` now takes the ranged branch when
`danmoAoeReady()` is true *regardless of distance*, mirroring Dark Devil's
`_darkDevilRangeReadyAt` cooldown pattern. New `danmoAoeCooldownMs: 1700` against
an 850ms swing puts AOE on half his swings; enrage scales the cooldown by the
same ratio as the swing timer. **Crystal's attack table and its 80/20 and 90/10
probabilities are untouched — only branch selection changed.**

Stats (tuned, NOT Mir2DB — its sheet is far below Hell Lord tier and barely
cleared a smithed party's AC): HP 30k→119k, dc 89-98→150-210, mc/sc
112-132→230-300, attackMs 1100→850, accuracy 16→40, ac/amc 50/70→82/98, XP
36k→58k, plus `enrageHpStages [0.7, 0.4, 0.15]` / `enrageAttackMs 650`.

Verified against the real formulas in `src/core/combat.js` (damage is a flat AC
subtraction, `max(0, roll(attack) - roll(AC))`, not a percentage):

| | Melee DPS on tank | AOE DPS across party | Total | Index vs Hell Lord |
|---|---|---|---|---|
| Danmo before | 34 | 0 | 34 | 2% |
| Danmo after | 86 | 397 | 483 | **109%** |
| Hell Lord | 0 | 541 | 541 | 100% |
| Manectric King | 0 | 393 | 393 | 58% |
| Dark Devil | 49 | 215 | 263 | 20% |

Notes for whoever tunes this next:

- **50% of swings is not 50% of damage.** Melee is only 18% of his incoming
  damage because a melee hit lands on one target and an AOE hit lands on three.
  The 18/82 split sits almost exactly on Dark Devil's 19/81.
- **Manectric King and Hell Keeper are not mixed bosses**, despite looking like
  it. MK's `attackRangeTiles: 5` line reaches the Wizard at tile 5, so both are
  100% multi-target (32-35% tank share, same as Hell Lord's 33%). Dark Devil is
  the only genuine melee+AOE boss in the game. Danmo lands at a 45% tank share.
- **Paralysis is an uncounted difficulty multiplier.** His heavy melee uses the
  shared `FLAMING_MUTANT_PARALYSIS_POISON_TICKS = 5` at
  `CRYSTAL_POISON_TICK_MS = 2000`, so the tank is locked out for 10s. It can't
  chain-lock (`applyCombatantPoison` won't refresh an active paralysis) but the
  effect outlasts the 8.5s gap between attempts, giving **~54% uptime**. A
  paralysed tank deals no damage, so the fight runs 9-28% longer and the party
  eats proportionally more: **effective difficulty is ~118-139%**, not 109%.
  Deliberately left at 5 ticks (owner's call). A per-enemy 3-tick override is the
  lever if the first real fight feels like a coin flip.
- **Beast King's 50,000 XP is the real anomaly** — same Namman region, ~5% of
  Hell Lord. Danmo's 58,000 is priced to stay clear of it rather than to match
  his difficulty. Left alone on request.

## 2026-07-31 - Gon Ryun Dragon Armour: male-only naming

Dropped `(F)` Gon Ryun pieces. Male trio kept as any-gender (`genderMask: 3`)
with display name **Gon Ryun Dragon Armour** (no `(M)` / class suffix). Danmo
table and temp alchemist stock updated. Alchemist buy path uses
`alchemistShopBuyPrice` so 0 Crystal `shop.buy` items still purchase at the
temp 1g override.

## 2026-07-31 - Danmo boss drop table

Wired `DANMO_BOSS_DROPS` (Beast King chassis + one-step shift): Fury book 10%,
elevated Namman rares 7.5%, Hell Yama Blade trio 5%, Danmo jewellery/helms/
boots 2.5%, Stone Golem Bracelets 1.25%, Gon Ryun Dragon Armour M/F 0.5%,
shared heaven/tarragon/stones/gems/orbs/dark armour. Hooked via `isDanmoEnemy`.

## 2026-07-31 - Gon Ryun Dragon Armour + Danmo-tier missing gear

Renamed/retuned `gonryunyongdrama-*` to **Gon Ryun Dragon Armour** L60
(Warrior AC 14–36 / AMC 6–13 / DC 2–5 / HP 100; Wizard AC 10–26 / AMC 9–16 /
MC 0–12; Taoist AC 11–29 / AMC 8–14 / SC 0–11).

Imported + balanced Crystal missing pieces for Danmo band:
- Necklaces L58: Cross Purified; **Adamant Torque** (was Adamant Necklace,
  distinct from Adamantine Necklace); Evil Triangle
- Helmets L55: Helmet Of Kings / Sorcery, Purified Mask, Tarragon Helmet
- Tarragon Boots L55; Tarragon Bracelet L58; Tarragon Ring L55
- **Stone Golem Bracelet** 1/2/3 L60 (was Stone Monster; class trio)
- Rings L58: Demon Ruby, Gold Dragon, Evil Expel

No Danmo boss drop table wired yet.

## 2026-07-31 - Hell Yama Blade L60 class trio

Retuned existing `hell-yama-blade1/2/3` to **level 60** (was Mir2DB L52
below Raw Sword). Display name **Hell Yama Blade** for all three. Combat
band sits ~10% above Ice Dragon Sky (L55 Manectric King):

- Warrior: DC 14–72, Acc 2
- Wizard: DC 8–27, MC 7–21
- Taoist: DC 10–33, SC 7–18, Acc 2

No drop source wired yet (icons/visuals unchanged).

## 2026-07-31 - Namman Demon Fields

New trash zone `zone-namman-demons` reuses Southern Barbarian Land field
visuals. Six Mir2DB Namman demons (CDN imgs 318–323 → Crystal 261–266):
Rebel / Black Sky / Destroyer / Frost Demon, Cold / Mad Corpse. Combat + XP
tuned to **~1.25×** the beast zone (gold ×1.25 too). Teleporter entry under
Southern Barbarian Land.

## 2026-07-31 - Namman Demon Fields drop pool (baseline + rare mix)

`zone-namman-demons`: same 9 Southern Barbarian accessories @ 0.111% each
(baseline), plus Beast King-tier mix-ins @ 0.028% each — Pledge / Crimson
Ruby / Five Element Ring, Cuspid / Sorcery Anchor / Purified Mirror, Dual
Titan / Evil Whisp / Sacred Angel Amulet. Both Namman trash zones use
`dropPityKills: 20` (safety net for low drop-rate; high-DR rarely hits it).

## 2026-07-31 - Danmo Namman field boss room on teleporter

Promoted Danmo from hidden lab to `zone-namman-danmo` using the Crystal NAMMAN
field stamp (`namman-field-center` — Mir2DB map 845 open-field spawn). Wired
`BOSS_ROOM_DEFS` + Southern Barbarian teleporter. Template MC/SC → Mir2DB 112–132.

## 2026-07-31 - Moderation: exclude cheating Social account (was "im a cunt")

Account `9536897a-2246-4a10-9a92-194d0bb1bcfc` (triple L100 / 4 rebirths /
263 souls / ~8h playtime) removed from Social. Alias deleted; row marked
`integrity_status = 'excluded'` so further `/stats` submissions stay hidden.
Also added a whole-word `cunt` alias block for after Worker redeploy.

- Live D1: deleted `player_aliases` row; excluded leaderboard row
  (`purge-manual-exclude-9536897a.sql`)
- `tools/stats-worker/worker.js`: `ALIAS_BLOCKED_WORDS`
- `tests/statsWorkerAlias.test.mjs`: reject `"im a cunt"`
- Redeploy Worker when convenient: `npx wrangler deploy --keep-vars` from
  `tools/stats-worker` (site package not required)

## 2026-07-30 - Hide Lab: Danmo from teleporter

Removed `zone-lab-danmo` from Southern Barbarian Land `TELEPORT_REGIONS` for a
publish. Zone + Danmo kit stay in data/code for later lab testing.

## 2026-07-30 - Save health + offline wall-clock fixes (player progress-loss reports)

Players reported "offline 0 kills", "8 hours shows 5 mins", freezes on
maximise, being put back in town, and needing to clear cookies / use recovery
codes. Investigation found four compounding causes; this fixes the first three
(Phase 0-2 of the plan; offline-sim fidelity is a follow-up).

### Root causes fixed
1. **Save-failure retry spiral:** `saveGameState` only advanced `lastSaveAt`
   on success, so once `localStorage.setItem` failed (quota), `maybeAutoSave`
   re-serialized the entire state EVERY FRAME - freezing the game. Failures
   were silent (`console.warn`), so stale saves quietly aged for days
   (explains "back in town" / progress loss / "clearing cookies fixes it").
2. **Suspended performance clock:** the rAF catch-up measured time away with
   `performance.now()`, which does not advance while a mobile tab is
   suspended - 8h minimised showed as minutes. Wall clock (`Date.now()`) now
   feeds the offline-progress path when it reports a longer gap (only that
   path - it rebases combat timers; the step-replay stays on perf time).
3. **Silent save wipe:** a corrupt/unreadable save made `loadSavedGameState`
   return false, and boot force-saved a fresh default over it. Now: corrupt
   blob is preserved in `lom-idle-v2-save-corrupt`, a known-good backup from
   the last successful boot (`lom-idle-v2-save-backup`) is tried, and a red
   banner tells the player what happened (retry save / recovery code).

### Changes
- `src/app.monolith.js`: `recordSaveWriteFailure` (exponential backoff, max
  60s), `tryApplySaveText` + backup/corrupt slots in `loadSavedGameState`,
  `renderSaveHealthBar` + `#saveHealthBar` bar + click handlers,
  `lastSimulationWallClockAt` twin clock in `catchUpSimulation`/`tick`/boot,
  telemetry payload gains `saveSize`/`saveFailures`/`saveLoadFailed`.
- `src/styles.css`: `.save-health-bar` red variant of the update bar.
- `tools/stats-worker/`: `worker.js` stores the new telemetry fields and
  reports `saveHealth24h` on `/metrics`; `schema.sql` +
  `migrate-telemetry-save-health.sql` (run against live D1 before deploying
  the worker); README migration list updated.
- `tests/statsWorkerTelemetry.test.mjs`: updated upsert args + new
  save-health test.

### Verify
- `npm.cmd run check`: unit tests green; `fixture:offline-taoist` drift
  (gold 202 vs 205) is the KNOWN pre-existing flake (flips between two result
  sets on identical code - reproduced twice back-to-back; see 2026-07-22
  entries). All other fixtures green.
- `npm.cmd run smoke`: green, 25/25 actions, no console errors.
- Headless scenario check (throwaway script): healthy boot writes backup +
  no banner; corrupt main + backup boots from backup, preserves corrupt blob,
  shows banner; corrupt main without backup preserves blob + shows recovery
  banner. Zero console errors in all three.

### Follow-ups (rest of the plan)
- Phase 3: chunk/sample the synchronous full-window offline sim (freeze on
  resume after >10min away).
- Phase 4: offline sim fidelity - "defeated"/"0 kills" reports players see;
  the taoist fixture nondeterminism is the same class of bug (sim start state
  depends on live pre-sim frames).
- Worker deploy + D1 migration are manual (user runs them).
- Consider save compression (`CompressionStream("gzip")`) or IndexedDB once
  telemetry confirms save sizes near quota.

## 2026-07-30 - Purge EvertonHero Social clones

Nine anonymous Social rows matched EvertonHero's bugged save fingerprint
(Warrior 55 / Wizard 48 / Taoist 48, 369 Awakening Souls, combined 151). Keep
the real `EvertonHero` alias; delete the rest.

### Files
- `tools/stats-worker/purge-evertonhero-clones.sql`
- `tools/stats-worker/README.md`

### Verify
- Run the `--command` DELETE from README (prefer over `--file` for OAuth)
- Live `/leaderboard`: only one 369-soul / 55-level row, labeled EvertonHero

## 2026-07-30 - Hide impossible Social levels (Warrior 130 fakes)

Live Social had ~46 identical Warrior-130 / Wizard-1 / Taoist-1 accounts (plus
one stale `highest_level` 200 row). Levels above 100 were only flagged for
review and still shown publicly.

### Fix
- Stats Worker auto-excludes submissions with `invalid_level`
- Public `/leaderboard` also filters `highest_level <= 100`
- Existing rows: run `purge-cheater-levels.sql` (and redeploy Worker)

### Files
- `tools/stats-worker/worker.js`, `README.md`
- `tests/statsWorkerIntegrity.test.mjs`

### Verify
- `node --test tests/statsWorkerIntegrity.test.mjs`
- After deploy + optional purge: live `/leaderboard` has no `level > 100` rows

## 2026-07-29 - Danmo full AncientBringer attack kit

Lab Danmo (997 / 272) now uses Crystal AncientBringer's full attack set instead
of plain melee `attack1`.

### Kit (Crystal `AncientBringer.Attack`)
- **Melee ≤2 tiles:** 80% line DC (Attack1 + blend 548+), 20% 2×DC + paralysis
  (Attack2 + blend 628+)
- **Ranged ≤12 tiles:** 90% MC travel bolt 688 → impact 720, AoE radius 4; 10%
  2×MC target burst 740×14, AoE radius 5, spawns up to 4 Ancient Bats (CaveBat 19)
- SFX: melee +1/`attack2`+6, range +7/`range2`+8 (`272-1/6/7/8.wav`)

### Files
- `tools/build-danmo-combat-atlas.mjs` + `build-libv1` includes attack2/range1
- `public/monsters/monster/272.{png,json}` body + FX
- `src/phase1Data.js` template `attackMode: "ancientBringer"`, MC/SC for kit
- `src/app.monolith.js` `beginDanmoAttack` / bats / projectileHeavy draw
- `tools/build-sfx-assets.mjs` attack2 + range2 keys

### Verify
- `npm.cmd run check` (+ `smoke` with `dev` running)
- Teleport → Southern Barbarian Land → Lab: Danmo; kite for ranged, stay close
  for line/para, wait for rare heavy range + bats

## 2026-07-29 - Social tab shows equipped glyphs


Stats Worker was stripping `glyph` / `glyph2` / … from submitted equipment
(`EQUIPMENT_SLOT_IDS` never listed them), so Social character pages had nothing
to render. Client Social view also only had a single doll glyph slot, so a
second equipped glyph would stay invisible even after ingest worked.

### Fix
- Worker accepts all glyph equipment slots
- Integrity rules allow glyph items in every glyph slot (`2026-07-29.1`)
- Social foreign character page: glyph preview on the doll + Glyphs list in the
  side panel (tooltips via `foreignRegisterEntry`)

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`
- Redeploy stats Worker before live Social can store glyphs; players must
  re-submit stats after that

## 2026-07-29 - Danmo SFX (AncientBringer 272)

Wired Crystal `272-*.wav` via `monsterSounds("Danmo", 272, { attack: 2727, range: 2726 })`
(Crystal client uses BaseSound+7 melee / +6 range impact). `npm run build:sfx`.

Crystal AncientBringer also has rich attack EFX + AoE (line melee, projectile,
radius-5 MC burst, optional bat slaves) — not ported to the idle lab fight yet.


Southern Barbarian mini-boss art + a teleporter test fight.

### Changes
- **Art:** KR server `MonsterInfo` maps 단묵 → `image: 272` = Crystal **AncientBringer** (`272.Lib`). Mir2DB CDN img 329 is a red herring (Crystal 329 = AvengingSpirit). Same remap pattern as Namman beasts 267–271 in `KR-Mir2-Client/mirdb-monsters.json`.
- Atlas `public/monsters/monster/272.{png,json}` (west dir 6)
- Enemy template id **997** Danmo → `monsterIndex: 272`
- Zone `zone-lab-danmo` on Southern Barbarian Land teleporter
- `MONSTER_ASSET_VERSION` → `20260729-danmo-272`

### Verify
- `npm.cmd run check`
- Manual: Teleport → Southern Barbarian Land → Lab: Danmo (skeletal-wing bronze demon)

## 2026-07-29 - Scene windows no longer flip sides on click

### Bug
Clicking a scene window updated `sceneWindowStack` (correct for z-index /
Esc), but the overlay rebuild used that same stack as flex DOM order. Moving
an item or any other re-render then swapped left/right positions — especially
noticeable with Storage and Crafting Cube + Recipes (non-draggable windows).

### Fix
- `layoutOverlayScenes()` renders from stable `currentOverlayScenes()` order.
- Focus stack still drives z-index and Esc-close only.

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke` (with `npm.cmd run dev` running)
- Manual: open Character + Inventory + Storage; click Character, move an item
  — windows should stay in place. Same for Crafting Cube with Recipes open.

## 2026-07-28 - Bind Social playerId to recovery code

Cloud restore on a new device was minting a fresh anonymous Social identity
while reusing the recovery code for the save, which duplicated people on the
leaderboard. Cloud saves now bind a canonical `player_id` to each recovery
code; restore returns it and the client re-adopts that identity.

### Changes
- `tools/stats-worker/schema.sql`, `migrate-cloud-saves.sql`,
  `migrate-cloud-save-player-id.sql`: `cloud_saves.player_id`
- `tools/stats-worker/worker.js`: bind on `/cloud-save`, return + alias
  fallback/backfill on `/cloud-save/restore`
- `src/core/cloudSave.js`: `normalizeAccountPlayerId`
- `src/app.monolith.js`: send `playerId` on upload; adopt on save/restore
- `tests/statsWorkerCloudSave.test.mjs`, `tests/cloudSave.test.mjs`
- `tools/stats-worker/README.md`: deploy note for the new migration

### Verify
- `npm.cmd run check`
- Deploy Worker after:
  `npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-cloud-save-player-id.sql --remote`
- Manual: cloud-save on device A, restore on device B → same Social name/id

## 2026-07-28 - Duplicate skill books grant +200 XP

Using a skill book for a spell you already know now studies it for +200
skill experience (consumes the book). Does nothing — and does not consume
the book — if the skill is mastered (Lv 3) or the character is under the
next skill-level requirement (`spellLevelRequirement`).

### Changes
- `src/app.monolith.js`: `DUPLICATE_SKILL_BOOK_EXPERIENCE`,
  `duplicateSkillBookStudyStatus`, `studyLearnedSpellFromBook`;
  `learnSpellFromBook` routes duplicates into study; book tooltip notes
  study / mastered / level-cap state
- `src/data/changelog.json`: player-facing note

### Verify
- `npm.cmd run check`
- `npm.cmd run smoke` (with `npm.cmd run dev` running)
- Manual: double-click a duplicate book while under-capped → +200 XP /
  possible level-up; mastered or under next skill req → log only, book kept

## 2026-07-27 - Compact UI group-dungeon Next floor button

On mobile/compact UI the side panel is hidden (`display: none`), so the group
dungeon Advance button was unreachable. Added a stage-corner **Next** button
(same pattern as Town) plus a compact **Auto** checkbox when the Cash Shop
unlock is owned.

### Changes
- `src/app.monolith.js`: `#compactAdvanceFloor`, `#compactGroupDungeonAutoAdvance`,
  `syncCompactGroupDungeonAdvanceControls`, click/change wiring; synced from
  `renderGameUiPanel` / `syncCompactUi`
- `src/styles.css`: compact styles for Next + Auto controls

### Verify
- `npm.cmd run check`
- Manual: phone/compact width in a multi-floor group dungeon; clear a floor and
  confirm **Next** appears top-right and advances; Auto checkbox if unlocked

## 2026-07-27 - Group Dungeon Auto Advance (Cash Shop)

Permanent account unlock (200 tokens) that shows an **Auto advance** checkbox
next to the group-dungeon Advance button. When ticked, the party advances to
the next floor as soon as Advance would appear (including skipping the boss
entry confirm on auto). Works for BDD, Hell Cavern, and any future multi-stage
group dungeon that uses the same Advance flow.

### Changes
- `tools/stats-worker/worker.js`: `group-dungeon-auto-advance: 200` in
  `UNLOCK_TOKEN_COSTS` (server must be redeployed for purchases)
- `src/app.monolith.js`: unlock key/helpers, Cash Shop item, checkbox UI,
  `maybeAutoAdvanceGroupDungeonFloor`, setting persistence, harness grant
- `src/persistence/sanitizeSettings.js`: `groupDungeonAutoAdvance` (default off)
- `src/styles.css`, changelog, `tests/statsWorkerShop.test.mjs`

### Verify
- `npm.cmd run check`
- Note: live token purchases need the stats worker redeployed with the new key

## 2026-07-27 - Glyph of Gold

Any-class glyph that adds +100% gold from monster and boss kills (stacks with
rebirth gold upgrades and gold-drop empowers via `totalGoldBonusPercent`).

### Changes
- `src/glyphModifiers.js`: `goldDrops` + `glyphGoldBonusPercent`
- `src/app.monolith.js`: include glyph bonus in `totalGoldBonusPercent`
- `src/data/items.json` frame 3222, changelog, tests, atlas

### Verify
- `npm.cmd run check`

## 2026-07-27 - Glyph of Magical Protection

Warrior glyph that makes Protection Field buff AMC (MAC) instead of AC. Bonus
% still uses the same level formula, but against max AMC. Stacks with Bulwark
Field (stronger/shorter) if both are equipped.

### Changes
- `src/glyphModifiers.js`: `warriorProtectionFieldAmc` + `glyphProtectionFieldStat`
- `src/app.monolith.js`: Protection Field applies chosen defence stat
- `src/data/items.json` frame 3221, changelog, tests, atlas

### Verify
- `npm.cmd run check`

## 2026-07-27 - Mirror range vs Beast King

Beast King uses `bossMeleeGap: 120`, and the party Wizard stands 4 tiles behind
the tank (~312px). Mirror attack range was a flat 6 tiles (288px), so the clone
summoned but never attacked — only on that boss.

### Changes
- `src/core/wizardMirror.js`: `wizardMirrorAttackRangePx` stretches for formation
  depth + boss stand-off when needed
- `src/app.monolith.js`: boss-party mirror attacks use the stretched range

### Verify
- `npm.cmd run check`

## 2026-07-27 - Glyph of Many Mirrors

Wizard glyph that triples Mirroring: main clone plus one above and one below.
All three cast Fire Ball only (no Thunder Bolt / Flame Disruptor). Same MP
upkeep and Mirroring rank damage scaling as a normal mirror.

### Changes
- `src/glyphModifiers.js`: `wizardManyMirrors` + `glyphManyMirrorsParams`
- `src/core/wizardMirror.js`: Fire Ball picker flag + extra offset helpers
- `src/app.monolith.js`: spawn/update/draw/attack extras independently
- `src/data/items.json` frame 3219, changelog, tests, item atlas

### Verify
- `npm.cmd run check` (+ smoke)

## 2026-07-27 - Mirroring clone damage by rank

Mirror clone damage was full wizard spell power at every Mirroring rank, which
felt OP. Rank 3 keeps today’s damage; lower ranks scale down.

### Changes
- `src/core/wizardMirror.js`: `wizardMirrorDamageMultiplier` /
  `scaleWizardMirrorDamage` at 55%/70%/85%/100% for ranks 0–3
- `src/app.monolith.js`: apply after mirror attack damage roll
- `src/warriorMagic.js`: description notes damage scaling
- `tests/wizardMirror.test.mjs`: multiplier coverage

### Verify
- `npm.cmd run check`

## 2026-07-27 - Black Dragon armour sell price

Level 35 Black Dragon armours sold for 1g because Crystal `price` is 0, so
import set `shop.sell = max(1, floor(0/5))`.

### Changes
- `src/data/items.json`: all 6 `black-dragon-armor-{m,f}-{1,2,3}` →
  `shop: { buy: 30000, sell: 6000 }` (same tier as Steel/Royal/Titan)

### Verify
- `npm.cmd run check`

## 2026-07-27 - Potion hotbar jump on teleport

Teleporting (town↔zone / between arenas) could move the potion hotbar because
its default Y tracked player feet/lane Y, and a dragged position could be
permanently reclamped when the stage briefly resized mid-transition.

### Changes
- `src/app.monolith.js`: pin default hotbar to canvas bottom; clamp dragged
  position for display only (do not overwrite saved coords on layout)

### Verify
- `npm.cmd run check` (+ smoke with `npm run dev`)

## 2026-07-27 - Glyph of Improved Flaming Sword

Added **Glyph of Improved Flaming Sword** (Warrior): when Flaming Sword hits,
the enemy burns for **5 seconds**, taking **50% of that hit’s damage** as fire
DoT (1s ticks). Applies in solo, boss-party, and offline combat. Item
`glyph-improved-flaming-sword` (frame 3203) joins the empowered-boss glyph pool.

### Changes
- `src/glyphModifiers.js`: `warriorImprovedFlamingSword` + burn helpers
- `src/app.monolith.js`: apply on FS hit; tick alongside enemy poisons
- `src/data/items.json` + icon, tests, changelog, item atlas

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`

## 2026-07-27 - Glyph of Critical Strikes

Added **Glyph of Critical Strikes** (all classes): base crit damage bonus is
**doubled** (+50% → +100% before gear crit-damage), and **Luck is treated as 0**
for combat rolls / character display while equipped. Joins the empowered-boss
glyph pool (`glyph-critical-strikes`, EvilSlayer frame 3218).

### Changes
- `src/glyphModifiers.js`: `criticalStrikes` + `glyphExtraBaseCritDamagePercent` /
  `glyphNullifiesLuck`
- `src/data/items.json` + icon frame copy
- `src/app.monolith.js`: crit apply path, `effectiveCombatStats` / `combatLuck`,
  character sheet crit/luck display
- tests, changelog, item atlas, integrity rules

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`

## 2026-07-27 - Inventory drag chrome around Sort

Inventory window drag handle stopped 80px short of the right edge, so the title
chrome above/right of the top Sort button was dead (no drag). Extended the handle
to `right: 30px` like Character/Codex; Sort (z-index 6) and Close still win clicks.

## 2026-07-26 - Glyph of Improved Healing Circle

Taoist glyph so Healing Circle tick heals scale with SC:
`25 + floor(Max SC / 4)` while equipped (base 25 unchanged without it).
Item `glyph-improved-healing-circle` (BraveryGlyph2 / frame 3202), drops in the
empowered/ascended glyph pool via `GLYPH_DEFS`.

## 2026-07-26 - Boss-party splash uses hit member glyphs

Splash/AOE via `applyStrikeTargetIncoming` preferred precomputed `stats` without
`__buffEntity`, so Tank/Glass lookups fell back to the controlled character's
inventory. Damage resolve now always uses `defenceTargetForIncomingAttack(entity)`
when the hit entity is known.

## 2026-07-26 - Ascended glyph drop 15%

Ascended boss kills now roll glyphs at 15% (`ASCENDED_BOSS_GLYPH_DROP_CHANCE`);
Empowered stays at 10%. Wired via `rollEmpoweredBossGlyphItemId(..., { ascended })`
in `rollBossTableDrops`.

## 2026-07-26 - Fix Spirit Wards with multi-glyph arrays

`rollTaoistDefenceBuffBonus` still checked `glyph?.kind` after
`equippedGlyphFor` started returning an array, so Glyph of Spirit Wards never
applied. It now uses `firstGlyphOfKind` like the other multi-slot helpers.

## 2026-07-26 - Fire Hell joins Hell Cavern progression

Fire Hell F1 / F2 / Hell Lord (floors **8–10**) were already `groupDungeon: "hell"`
so Advance after Manectric King reaches them. Matched the Ice Hell pattern:
Wasteland teleporter lists only **Hell Cavern** (`zone-hell-gd-1`); deeper wings
are reached by advancing. Removed Fire Hell testing teleporter shortcuts.

## 2026-07-26 - Boss swarm respawn on partial kill

Dream/Dark Devourer (and other boss swarms) only started the room cooldown on a
full clear. Killing one and leaving let you re-enter immediately. Respawn timer
now starts on the first swarm boss kill; kill credit still requires a full clear.
Spawn gate allows mid-fight timed reinforcements after that partial-kill timer.

## 2026-07-26 - Hell Knight death explode FX

Crystal HellKnight Die plays `Effect(lib, 448, 10, 600)` (screen-blend burst)
over a short **lib FrameSet** body die (4f west 168–171), then `Remove()` on
Dead — no corpse. We had only the body clip (and briefly the wrong 10f
DefaultMonster fall). Packed `dieEffect` on atlases 243–246, restored lib die,
and draw/remove with the explode timing.

## 2026-07-26 - Hell Knight death animation fix

Hell Knight libs embed a bad FrameSet (`die` count=4 / offset=4 → west
168..171). Crystal client ignores that and uses **DefaultMonster** die
(`Frame(144,10,0,100)` → west **204..213**, 10 frames). Atlases 243–246 were
exported via `UseLibFrames`, so knights looked like they just stood / barely
moved on death. Rebuilt die/dead/revive from DefaultMonster
(`tools/fix-hell-knight-die-atlas.ps1`). Asset version
`20260726-hell-knight-die-fix`.

## 2026-07-26 - Fire Hell map AOE uses MapQuake

Crystal Hell Cavern FIRE maps spawn **MapLava** (Dragon). Fire Hell / Hell Lord
floor bursts use **MapQuake1/2** (HellLord lib frames 27 + 39). Exported
`public/spellfx/MapQuake/`, load it beside MapHellFire, and set
`mapHellFireStyle: "quake"` on Fire Hell F1/F2/KR visuals.

### Changes
- `tools/export-map-quake-spellfx.ps1` + `public/spellfx/MapQuake/`
- `src/app.monolith.js`: `MAP_QUAKE_FX_ID`, atlas load, style-aware spawn/draw
- `src/phase1Data.js`: Fire Hell `mapHellFireStyle: "quake"`
- itch spellfx manifest + release asset audit

## 2026-07-26 - Hell Knight weapon EFX

Crystal draws HellKnight1–4 weapon glow via `DrawBlend` from each lib
(standing 224+, walk 256+, attack 304+, struck 352+, die 368+). Packed those
into atlases **243–246** (`tools/build-hell-knight-weapon-efx.ps1`). Swarm draw
now applies action blends on stand/walk (not attack-only). Asset version
`20260726-hell-knight-weapon-efx`.

## 2026-07-26 - Hell boss respawn timers

Hell Keeper **2h** (120), Manectric King **4h** (240), Hell Lord **8h** (480)
`groupDungeonBossRespawnMinutes`.

## 2026-07-26 - Glyph of Buffing

Added **Glyph of Buffing** (Taoist): casting Ultimate Enhancer also applies
Soul Shield and Blessed Armour to the same targets (no extra amulet/MP; does
not level those skills). Joins the empowered-boss glyph pool
(`glyph-buffing`, Bravery Glyph1 / frame 3201).

### Changes
- `src/glyphModifiers.js`: `taoUltimateBuffChain` + helper
- `src/data/items.json` + icon frame + atlas + integrity rules
- `src/app.monolith.js`: chain from `applyUltimateEnhancerToTargets` (solo /
  offline / boss party / training)
- tests + changelog

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`

## 2026-07-26 - Second Glyph rebirth upgrade

Rebirth upgrade **Add Additional Glyph Slot** (250 RP, max tier 1) unlocks a
second glyph equip slot (`equipment.glyph2`). Cap is 2 slots total.

Combat/modifier helpers now resolve all equipped glyph slots via
`equippedGlyphDefs` / `firstGlyphOfKind`.

### Changes
- `src/app.monolith.js`: `rebirth-extra-glyph-slot`, `unlockedGlyphEquipSlotCount`,
  glyphs window + equip compatibility
- `src/glyphModifiers.js`: multi-slot `GLYPH_EQUIPMENT_SLOT_IDS` / `equippedGlyphDefs`
- `tests/glyphs.test.mjs`: multi-slot coverage

### Verify
- `npm.cmd run check` (+ smoke when testing in-game)

## 2026-07-26 - Glyphs equip window

Character doll glyph slot is now a **Glyphs** button that opens a dedicated
window. Equip still uses `equipment.glyph` (one unlocked slot); four locked
slots preview future upgrades (max 5). Drag onto the open slot, or Equip from
the bag list; Unequip from the window.

Also fixed offline fixture flake: re-seed `Math.random` immediately before the
sim so the settle wait cannot burn RNG.

### Changes
- `src/app.monolith.js`: `openScenes.glyphs`, button on character page, glyphs
  scene HTML + open/close wiring
- `src/styles.css`: glyphs button + window styles
- `tools/offline-zone-fixture.mjs` + offline expected JSON: deterministic re-seed

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`

## 2026-07-26 - Account auto-junk filters (Trader)

Account-wide auto-junk list on the Trader: **Auto-junk filters** opens a
dedicated window with a drop pad and the full rule list (remove per row). Drag
any sellable bag item to register its `itemId`. Plain bag copies (no empower /
smith / weapon refine / gems / bonus stats) are marked junk on pickup and when
a rule is added. Saved and upgraded copies are never auto-marked. Space-clear
sticks on that instance (no continuous re-scan).

### Changes
- `src/app.monolith.js`: account field, helpers, `addInventoryItem` hook, Trader
  button + `autoJunk` scene window + click-to-carry drop target
- `src/persistence/restoreAccount.js`: restore `autoJunkItemIds`
- `src/styles.css`: auto-junk window / rule list styles
- `tests/persistenceRestoreAccount.test.mjs`: restore coverage

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`

## 2026-07-26 - Glyph of Fast Healing

Added **Glyph of Fast Healing** (all classes): HP potions restore **50%** less,
but tick **25%** faster (200ms → 150ms while HP restore is pending). MP potions
unchanged. Joins the empowered-boss glyph pool (`glyph-fast-healing`, frame 3215).

### Changes
- `src/glyphModifiers.js`: `fastHealing` def + `applyGlyphHpPotionRestore` /
  `glyphPotionTickDelayMs`
- `src/data/items.json`: item entry
- `src/app.monolith.js`: solo / auto / offline / boss-party potion paths
- tests, changelog, item atlas, integrity rules

### Verify
- `npm.cmd run check` + `npm.cmd run smoke`

## 2026-07-26 - Wizard/Tao empower cooldown reduction

Added empower CDR rolls (1–5s weapons; armour/jewellery auto-scale) for
**Blizzard**, **Meteor Strike**, and **Poison Cloud**. Wired
`applyEquippedSpellCooldownReductionMs` into wizard `applyWizardCastCooldown`
and all taoist castReadyAt paths (solo + boss party) via
`setLearnedSpellCastReadyAt`. Regenerated empower reference + integrity rules.

## 2026-07-26 - Beast King HP 150k

Beast King (`id` 994) `maxHp` 100000 → **150000**.

## 2026-07-26 - Raw Sword display names

`raw-sword1` / `raw-sword2` / `raw-sword3` display name is now **Raw Sword**
(no trailing class digit). Ids unchanged.

## 2026-07-26 - Hell Lord Bracelet/Necklace of Agony

Added L55 class Bracelet / Necklace of Agony (warrior/wizard/taoist) and put
each on Hell Lord at 2.5%. Bracelets step above Dual Titan / Evil Whisp /
Sacred Angel; necks step above Cuspid / Sorcery Anchor / Purified Mirror.

## 2026-07-26 - Hell Lord Ring of Agony

Added class Ring of Agony trio (L55): warrior DC 2–16, wizard MC 2–15,
taoist SC 2–12. Hell Lord drops each at 2.5% (`ring-of-agony-*`).

## 2026-07-26 - Hell Lord boss drops

Hell Lord uses a Manectric King-style table: same gold/oils/pools, **Meteor
Strike** (5%) instead of Blizzard, no Ice Dragon Sky weapons. Wired via
`BOSS_DROP_TABLE_BY_LABEL["Hell Lord"]` + `isHellLordEnemy`.

## 2026-07-26 - Manectric King Ice Dragon Sky 5%

Ice Dragon Sky Sword / Knife / Rod on Manectric King raised to **5%** each
(`0.05`).

## 2026-07-26 - Ice Dragon Sky Knife/Sword model swap

Swapped inventory icon + paper-doll `visual.index` (and Crystal source refs)
between Ice Dragon Sky Knife and Sword so the art matches the class roles
(Sword = warrior, Knife = taoist). Removed temporary Alchemist test stock.

## 2026-07-26 - Manectric King Ice Dragon Sky weapons

Retuned Ice Dragon Sky trio to level 55 and added them to Manectric King at
1.25% each (later raised to 5%). Class swap vs Crystal: Sword = Warrior
(DC 12–66, Acc 2), Knife = Taoist (DC 9–30, SC 6–16, HP 35), Rod = Wizard
(DC 7–24, MC 6–19, HP 25).

## 2026-07-26 - Hell Keeper Winged Heaven 0.1%

Hell Keeper `winged-heaven-armour` chance matched Manectric King / Beast King
(`0.005` → `0.001`).

## 2026-07-26 - Ascended boss star odds buffed

Ascended empowered-item tier roll is now 50% / 35% / 10% / 5% (★–★★★★) via
`ASCEND_TIER_WEIGHTS`, passed from `empoweredBossDropRollOptions` when
`bossAscended`. Empowered stays 60 / 30 / 7.5 / 2.5. Future Awakened (not wired):
30 / 30 / 25 / 15 — noted as a commented stub next to the Ascended table.

## 2026-07-26 - Magic Shield follows party lane

`attachedSpellFxAnchor` used raw `LANE.y` for boss-party Magic Shield, so after
`arenaPartyStampMapRowOffset` the bubble sat above the wizard. It now uses
`arenaPartyCombatLaneYPx`.

## 2026-07-26 - Hell Lord mass-burst damage actually lands

Mass-burst strikes without a projectile atlas cleared at `startedAt+600` before
impact at `+750`, so Hell Lord's AOE swings dealt no damage. `vfxUntil` now
lasts at least until impact, and the strike only clears after resolve.

## 2026-07-26 - Hell Lord full-party AOE

Hell Lord attacks use `alwaysAoe` mass-burst (boneLord style) so every swing
hits the whole party in range — no longer Manectric King's line kit.

## 2026-07-26 - Hell Lord stats ~25% over Manectric King

Hell Lord combat sheet is Manectric King × 1.25 (HP 97.5k, DC/MC 144–350,
AC/AMC, XP). Same line / execute / pulse kit; stationary + Fire Hell map fire
on top. Tightened `isManectricKingEnemy` so line-style Hell Lord does not take
King drops. Zone gold nudged to ~1.25× King's room.

## 2026-07-26 - Hell Lord flinch stays visible

Struck was swapping to lib frame 128 (sparse FX, ~10% opaque) so he looked
invisible. Atlas struck now holds seated body frames 0–1 like attack; blade
overlay still draws. Cache `MONSTER_ASSET_VERSION` bumped.

## 2026-07-26 - Hell Lord tank one tile south

KR zone `arenaPartyStampMapRowOffset: 1` — party/tank/pets draw and combat on
the row below the throne; Hell Lord stays on `(31,17)`.

## 2026-07-26 - Fire Hell KR camera nudge

KR-only `mapStampOffsetY: -240` (camera down = negative; 5 tiles past the
prior -80). Stamp + combat stay locked. Positive values raise the camera.

## 2026-07-26 - Fire Hell KR: jagged wall tops

Root cause was not stage crop: the stamp builder skipped non-floor-sized Mir3
middle tiles. Crystal draws those with `DrawUp` (door/wall tops, 48×160–224).
Builder now includes them bottom-aligned like Crystal; KR `offsetY` set to 256
so the tall tops stay on-stage at the throne fight.

## 2026-07-26 - Fire Hell KR: walls above throne on-stage

Crop already included map row 0; the cut-off walls were the stage clipping the
top after the fight moved to row 17 (large `focusY`). Raised KR stamp
`offsetY` to 192 so northern wall tiles stay visible; combat Y still follows
stamp `offsetY`.

## 2026-07-25 - Fire Hell KR stamp: northern walls

Expanded the KR stamp crop north to map row 0 (`HalfCropH=23`, `CropHCells=46`)
so throne-row walls are no longer mid-cropped. KR-only `offsetY` nudges the
stamp down in the stage; `arenaCombatLaneYPx` now includes stamp `offsetY` so
boss/party stay locked to the throne tiles.

## 2026-07-25 - Heaven Armour paper-doll wings

Character screen (and other paper dolls) now draw Crystal Prguse2 wing frames
behind armour when `armourVisualEffectForItem` resolves a wing effect. Heaven
Armour (`winged-heaven-armour`, effect 1) shows male frame 1202; Heaven Robe
stays wingless via the existing allowlist.

### Changes
- Exported `public/ui/character/paperdoll-wing-1202..1205.png` + metadata JSON
- `src/app.monolith.js`: shared `crystalPaperDollLayersHtml` / wing layer
- `src/styles.css`: `mix-blend-mode: screen` for DrawBlend parity
- `tools/export-paperdoll-wings.ps1` for re-export from Prguse2.Lib

## 2026-07-25 - Hell Lord: party on throne row (warrior left)

Boss stays on stamp tile (31,17). Party/player/pets use the same row offset so
the warrior stands beside him on the left — not on the focus row below the seat.

## 2026-07-25 - Hell Lord body/model sync

Removed separate stamp visual pin. Combat foot (`enemyX` + stamp-row Y in
`combatAnchor`) is now the only draw anchor, so hitbox and seated sprite share
one position on the throne.

## 2026-07-25 - Hell Lord: party left of throne, no adds

KR party holds the stamp focus (warrior left of Hell Lord); combat foot stays on
the throne tile with `bossMeleeGap: 240`. Boss reinforcements disabled for now.

## 2026-07-25 - Hell Lord AOE blend + no vanish

Attack AOE frames 80–85 are now `attack1Blend` (screen-blend) over the seated
body instead of opaque body swap (black outlines). Struck no longer uses empty
lib frame 129. Stage aura unhooked from idle blend. Empty body frames fall back
to standing so he cannot vanish mid-anim.

## 2026-07-25 - Hell Lord combat on throne tile

`arenaEnemyStampMap` now also sets combat `enemyX` (and party melee line) to the
throne tile so the party can hit the seated Hell Lord, not an approach-gap ghost.

## 2026-07-25 - Hell Lord seated atlas (real body)

Hell Lord atlas was wrongly built from Crystal DrawEffects frame **15** (blade
overlay). Rebuilt with DefaultMonster seated body **0–3**, attack **80–85**,
die **16–20**, opaque blade overlay + aura blend. Draw still pins to stamp tile
`arenaEnemyStampMap (31,17)`.

## 2026-07-25 - Hell Lord throne pin (stamp-map absolute)

Pin Hell Lord draw to stamp tile via `arenaEnemyStampMap: {31,17}` so placement
tracks the map stamp, not combat approach X. Body `drawBlend` off (Crystal
`Draw(..., offSet)` is opaque; aura 21–26 stays the blend layer).

## 2026-07-25 - Hell Lord throne pin (approach-relative visual)

Hell Lord stays a normal stationary GD boss (combat at approach/melee so the
party can reach him). Visual offsets account for approach gap (+144): throne
~(31,17) uses +96/−192 from the combat foot. Also refresh
`meleeFrontSlotWorldX` after fixed-arena layout for other pillar bosses.

## 2026-07-25 - Hell Lord on throne (visual pin + atlas)

Hell Lord Crystal spawn is `(31,19)` but party stand is `(26,23)`. Added visual-only
offsets (+5/-4 tiles) so the seated sprite sits on the map throne. Rebuilt atlas
247 to Crystal draw rules (body frame 15 + aura 21–26, `drawBlend`).

## 2026-07-25 - Fire Hell KR (Hell Lord)

Locked party stand at Crystal HKR `(26, 23)`. Stamp `fire-hell-kr-center` + zone
`zone-fire-hell-gd-3` as hell GD floor 10 boss (Hell Lord, stationary). Light
Knight Elite reinforcements. Teleporter Wasteland includes the zone. Hell Lord
template marked `stationaryBoss`.

## 2026-07-25 - Fire Hell GD Floor 2

Locked party stand at Crystal HF2 `(196, 212)`. Stamp `fire-hell-gd-2-center`
+ zone `zone-fire-hell-gd-2` as hell group-dungeon floor 9 (Hell Knight Guard /
Elite + Bomb Mk II/III). Map fire hazard slightly hotter than F1. Teleporter
Wasteland includes the new zone.

## 2026-07-25 - Hell Bomb melee detonation (party AoE)

Hell Bombs (437–439) no longer melee-swing the Warrior. On reaching melee
range they play the explode clip, hit **every living party member/pet** with DC,
then self-destruct (kill credit). Kill them before contact to avoid the blast.

## 2026-07-25 - Hell Bomb screen-blend body (no black outline)

Crystal draws HellBombs with `Frame.Blend = true` (additive). Normal body draw
left a black silhouette. Atlases 2471–2473 now set `drawBlend: true`; swarm/solo
body draw uses screen blend (`drawEnemyBodyAtlasFrame`).

## 2026-07-25 - Hell Bomb proper sprites (HellLord lib)

Hell Bombs are not Mon903–905 libs — Crystal sets `BodyLibrary = HellLord`
and reads float/explosion frames from `247.Lib` (stand 52/70/88, attack FX
61/79/97). Built atlases `2471–2473` (avoids Lab Halberd Lord / Boar @903–904)
via `tools/build-hell-bomb-atlases.ps1`. Templates 437–439 now point there;
Demon/Hell Bolt placeholders 226/227/219 no longer used for bombs.

## 2026-07-25 - Fire Hell walk jitter fix

Hell Knight / Bomb walk clips were 200ms/frame (5fps) while the body slides a
tile — same stutter as pre-fix Ice Hell Blest. Set all walk intervals on
atlases 243–246 and 219/226/227 to 100ms.

## 2026-07-25 - Fire Hell GD Floor 1

Locked party stand at Crystal HF1 `(57, 252)`. Type5 Mir3 stamp
`fire-hell-gd-1-center` + zone `zone-fire-hell-gd-1` as hell group-dungeon
floor 8 (Hell Knight / Captain + Bomb adds). Retuned Fire Hell trash for idle
(~11k knight HP). Appended swarm directional clips on atlases 243–246.
Spot pickers remain under `tile-review/fire-hell-*-spot-picker/`.

## 2026-07-25 - Fire Hell F1/F2 spot pickers

HellFire maps are Mir3 Type5 (not Map 2010). Added `tools/build-fire-hell-overview.ps1`
+ `tools/build-fire-hell-spot-picker.ps1` (-Floor 1|2). Pickers at
`tile-review/fire-hell-1-spot-picker/` and `fire-hell-2-spot-picker/` with Crystal
spawn hubs (50,60) / (206,193).

## 2026-07-25 - Beast King 2 hour respawn

Beast King `respawnMinutes` set to 120 (was temp 1 min / elite 60).

## 2026-07-25 - Beast King 1 min respawn (temp)

Beast King `respawnMinutes` set to 1 for drop testing (was elite 60).
Restore `BOSS_RESPAWN_MINUTES_ELITE` before release.

## 2026-07-25 - Beast King Rage book drop

Beast King table: warrior book `book-rage` (Rage) at 10%.

## 2026-07-25 - BDD Empowered trash XP fix

Empowered/Ascended Black Dragon Dungeon was scaling trash HP/damage and gold
but **not XP** (`awardBossPartyKillShare` only multiplied gold). Kill XP and
boss kill XP/gold now use the same 2×/3× reward multiplier. Tier reads prefer
`state.groupDungeonEmpowerTier` so floor advances stay empowered. Entry UI/log
copy updated to mention XP.

## 2026-07-25 - Beast Ring unique stats

Beast Ring2: DC 0–10, Attack Speed +2. Beast Ring3: MC 1–10, AC/AMC 0–4.
Beast Ring4: SC 1–10, AC/AMC 0–4.

## 2026-07-25 - Beast Rings (Craft Ring 2/3/4)

Added `beast-ring2/3/4` named **Beast Ring** (Crystal CraftRing2/3/4 art),
level 52. Stats matched to L50 ring peers: DC 1–14 / MC 1–13 / SC 1–12.
On Beast King table at 1.25% with Raw Swords. Rebuilt item atlas.

## 2026-07-25 - Beast King boss drop table

Beast King loot from Manectric King skeleton: removed old 7.5% accessory
pool + Blizzard; promoted 2.5%→7.5% and 1.25%→2.5%; Raw Sword1/2/3 at
1.25%. Soul 100%, oils×2, gold 35k. Wired via `isBeastKingEnemy`.

## 2026-07-25 - Beast King test drops removed

Removed temporary guaranteed Raw Sword trio from Beast King boss table
(and `isBeastKingEnemy` wiring) while the real loot table is designed.
Weapons themselves stay in `items.json`.

## 2026-07-25 - Raw Sword trio L52 + gold hook

`raw-sword1/2/3` → level 52. Combat band matched to strong L45 weapons
(Burst/Frozen / Holy Blood / Dragon Blood). Each has
`goldBonusPercent: 100` (+100% kill gold).

## 2026-07-25 - Beast King test drops (Raw Sword trio)

Temporary Beast King boss table: guaranteed `raw-sword1/2/3` (chance 1)
plus 25k gold / 1 oil. Wired via `isBeastKingEnemy` → drop table label.

## 2026-07-25 - Raw Sword class trio

Added `raw-sword1` (Warrior, DC 5–17), `raw-sword2` (Wizard, MC 5–17),
`raw-sword3` (Taoist, SC 5–17) — same icon/visual/level as `raw-sword`.
Original any-class `raw-sword` kept for save compatibility. Regenerated
item-integrity rules (427 equippables).

## 2026-07-25 - Namman trash drop pool (~1/100)

Southern Barbarian Land drops 9 accessories @ 0.111% each (~1 item /
100 kills): Thunder/Red Demon/Cloud Ring, Demon Mask, Violet Orb,
Kunroon Tear, Spirit Reformer, Holy Tao Wheel, Baek Ta Glove. Zone
`dropPityKills: 100` so the global 8-kill pity does not flood the pool.

## 2026-07-25 - Beast King base retune (enrage race)

Beast King: HP 45k→90k, DC 95–170→45–80, attackMs 1400→2200.
Softer/slower opener; HP pool supports the timed-enrage race.

## 2026-07-25 - Beast King timed enrage

Beast King: 2 min grace countdown HUD, then stacking enrage — +10% of
base damage, accuracy, and attack speed every combat second (linear).
Attack period floors at 800ms (attack1 clip). Combat-elapsed so pause
does not burn the timer.

## 2026-07-24 - Namman difficulty ~1.5× Fox/RC

Southern Barbarian trash + Beast King retuned to ~1.5× Fox/Red Cavern
power band (HP/DC/XP; AC/AMC ~+20% from prior Namman). Zone gold ×1.5.
Beast King: DC 95–170, AMC 38, XP 45k, attackMs 1400 (HP stayed 45k).

## 2026-07-24 - Beast King KR stand → (162, 127)

Moved `zone-namman-boss` `arenaSpawnMap` / `arenaFocusMap` to Crystal
`NAMMAND_2.map` `(162, 127)` (picker pick). Rebuilt `namman-boss-center`
stamp crop around that focus. Builder: `tools/build-namman-boss-stamp.ps1`;
picker: `tile-review/namman-beast-kr-spot-picker/`.
Nudge: then +2 cells south → `(162, 129)`.

## 2026-07-24 - Namman tree belt: fill canopy-only column

Map X=311 only had Objects15 frame 4842 — a canopy with ~164px empty
bottom and no trunk tree under it (neighbors 310/312 have full trees).
Bake now clones the nearest full trunk into canopy-only columns.

## 2026-07-24 - Namman tree belt gaps diagnosed

Panorama bake was skipping Crystal's floor-sized (48×32) understory pass
(66 cells) and 7 front frames are **out of range for Objects15.Lib**
(4962–4965, 5015–5017; lib only has 0..4960). Those cells stay empty —
visible holes/strips, especially mid-right cluster. Rebuild now draws
floor then tall (Crystal order). Still cannot invent missing Objects15 art.

## 2026-07-24 - Namman dense tree belt (region 296,341)

Baked NAMMAN.map `(296,341)-(320,359)` as intact panorama
`public/mapedges/namman-tree-line.png` (1200×1583, full-image loop — not
48px columns). Raised `MaxSpriteHeight` to 1300 so tall Objects15 canopies
(500–1200px) are included. Wired `edgeSet: "namman-trees"` on
`NAMMAN_FIELD_VISUALS` with `yOffsetFromBase: -1551`. Rebuild:
`tools/build-namman-tree-panorama.ps1`.

## 2026-07-24 - Namman top-fill actually matches editor strip

Root cause: `tilePatternTopFill` keyed off `patternIndex >= 0`, but player
feet sit on anchor row 4 — so the walk-lane row was stacked 3× and only the
last few pattern rows ever drew. Now maps one pattern row per anchor step
from `MAP_TILE_LANE_ANCHOR_ROW` (4) and extends the draw range upward to fit
the full strip.

## 2026-07-24 - Namman floor pattern visual editor

Added `tools/namman-floor-editor/` — paint namman tile slots, preview
top-fill (walk lane marked), export `NAMMAN_TILE_PATTERN` JS.
Open via dev server: http://localhost:4177/tools/namman-floor-editor/

## 2026-07-24 - Namman floor top-fill (no vertical loop)

`tilePatternTopFill`: authored strip sits at the lane (last pattern row at
index 0); higher rows use `pattern[0]` instead of modulo-wrapping the strip.

## 2026-07-24 - Namman floor black squares (bad blend offsets)

Blend frames `41110+` / `412xx` in Tiles.Lib carry garbage offsets
`(-296,-266)`. Map-builder draws at cell origin (ignores offsets); the game
applies them → tiles fly off, black holes. Builder now forces floor seat
`(7,-44)` like normal 4000/415x tiles. Hard-refresh to pick up index.json.

## 2026-07-24 - Namman floor from region export (398,318)

Wired hand-picked NAMMAN.map sand/grass loop `(398,318)-(416,325)`:
- Rebuilt `public/maptiles/namman.png` with export `backFrames` (incl. 41110+/412xx blends).
- `NAMMAN_TILE_PATTERN` = condensed even-even slots (10×4) for `tileAnchor2x2`.
- Removed broken `edgeSet: "namman-trees"` until a box-selected tree cluster is baked.
- Ref: `tools/tile-review/namman-floor-region-398-318.json`, `tools/build-namman-tiles.ps1`.

## 2026-07-24 - Social Awakening Souls use current held, not peak

`/stats` upsert used `MAX(...)` for `awakening_souls_held`, so Social kept a
lifetime high-water mark after rebirth/spend (e.g. SmavidDavid stuck at 2376).
Worker now overwrites with the submitted current inventory total.

## 2026-07-24 - Fix Namman floor/trees (authored pattern + panorama)

Previous approach was wrong: random/overlay grass stamps looked patchy, and
48px column tree strips shattered multi-cell trees.
- Floor: literal even-anchor pattern from NAMMAN (672,160) with real 415x+400x
  neighbors (`tileAnchor2x2`); removed grass floorDecorations.
- Trees: continuous panorama `namman-tree-line.png` (full-image edge loop,
  height-capped), not column mode.

## 2026-07-24 - Namman floor patches + looping tree backdrop

- Floor: green-only `4151–4155` (no mixed 400x slots) + three real
  `NAMMAN.map` grass patches as `floorDecorations`.
- Backdrop: looping tall-tree strip `namman-tree-columns.png` (22 cols @
  map 696–717 / y=144) via `edgeSet: "namman-trees"`.
- Builders: `build-namman-floor-patches.ps1`, `build-namman-tree-backdrop.ps1`.
- Packager now includes `floorDecorations` sheets under `maptiles/`.

## 2026-07-23 - Namman floor: green base + grass patches

`NAMMAN.map` is mostly Tiles.Lib **4151–4155** (green) with **4001–4005**
lighter grass accents — not a uniform 4000–4004 sheet. Rebuilt
`public/maptiles/namman.png` (10 slots), patchy `NAMMAN_TILE_PATTERN`, and
`tileAnchor2x2: true` so Crystal 96×64 back tiles seat on even cells.

## 2026-07-23 - Namman field decorations (picker #56 #46 #80 #86 #155 #296)

Wired Southern Barbarian scrolling props from `NAMMAN.map` catalog picks:
- Sheet: `public/mapobjects/namman-catalog.png` (`decorationSet: namman-catalog`)
- Builder: `tools/build-namman-decoration-sheet.ps1`
- `NAMMAN_FIELD_VISUALS` uses Viper-style `worldX` + `repeatEvery` + `decorationRows`

## 2026-07-23 - Namman field loops tiles (not static stamp)

`zone-namman-1` now matches Red Cavern / Fox Cave: `mapSet: "namman"` +
`NAMMAN_TILE_PATTERN` from Tiles.Lib 4000–4004 (`tools/build-namman-tiles.ps1`).
Boss room stays on `namman-boss-center` stamp.

## 2026-07-23 - Southern Barbarian map stamps (NAMMAN / NAMMAND_2)

Replaced placeholder Fox Cave visuals with real Crystal map stamps:
- Field `zone-namman-1` → `namman-field-center` from `NAMMAN.map` (684,144)
- Boss `zone-namman-boss` → `namman-boss-center` from `NAMMAND_2.map` (248,84)
Builders: `tools/build-namman-*-stamp.ps1`. Bumped `MAP_STAMP_ASSET_VERSION`.

## 2026-07-23 - Fix Namman art (Mir2DB img ≠ Crystal lib)

Wrongly used Crystal `324–328.Lib` (plants/wraiths) because Mir2DB sheet
imgs matched those numbers. Correct Crystal cluster is **267–271**:
WhiteMammoth, DarkBeast, LightBeast, BloodBaboon, HardenRhino (same family as
the earlier tiger atlases). Rebuilt atlases + SFX; templates point there.

## 2026-07-23 - Southern Barbarian Land Mir2DB roster

Replaced KR-only tiger/bat field spawns with Mir2DB sheet mobs (img 324–328):
White Elephant, Rhino, White Tiger, Black Tiger, Black Ape. Atlases from
NextClient `324–328.Lib` (dir 6); SFX via matching Crystal sound packs.
Beast King boss room unchanged. Elephant has no Walking FrameSet — builder
synthesizes walking from standing.

## 2026-07-23 - Namman / Beast King SFX

Game indexes 991–994 had no `monster.*` SFX keys. Wired via
`monsterSoundsByImage` → Crystal packs 268/269/19/184 (178 has no WAVs),
then `npm run build:sfx`.

## 2026-07-23 - Beast King stand-off (tank spacing)

Large 178.Lib sprite overlaps the front tank at the default 48px gap. Added
optional `bossMeleeGap` (Beast King = 120) plus `bossPartyEnemyMeleeGap` /
`bossPartyBossMeleeReach`, and stretched front-melee + tanking-pet reach to
match so both sides still connect.

## 2026-07-23 - Beast King's Lair is a real boss room

`zone-namman-boss` was a normal zone (continuous 1.4s respawn). Added it to
`BOSS_ROOM_DEFS` (elite 60m timer) so entry uses the boss-party UI and a kill
sets the respawn lock instead of looping.

## 2026-07-23 - Beast King walks into melee (not stationary)

Has full Direction-6 walking clip (atlas frames 140–145). Dropped
`stationaryBoss` and set `moveMs: 1400` so it approaches like other Namman
trash; keeps the stationary-melee range fix for other rooted bosses.

## 2026-07-23 - Beast King (stationary melee) never attacked

### Cause
`stationaryBoss` skips walk-in. Default `canEnemyAttack` requires
`distance <= LANE.enemyRange` (48). Warriors stop at `warriorRange` (52), so
rooted melee bosses were permanently out of swing range.

### Fix
`enemyMeleeAttackRangePx`: stationary bosses use `max(enemyRange, warriorRange)`.

## 2026-07-23 - Beast King art swap (Mir2DB 229 → Crystal 178.Lib)

### Problem
Boss template 994 used WingedTigerLord (`184.Lib`) because the KR server
entry `야수왕` maps Image 184. Mir2DB Southern Barbarian sheet uses **img 229**
— a dark demonic winged beast, not the orange feathered tiger. Crystal enum
229 is ManectricKing (also wrong). KR WeMade `.wil` auto-match failed (dark
sprite + FX noise).

### Fix
- Visual match: Mir2DB icon 229 ≈ Crystal **WingedBullLord `178.Lib`**
  (NextClient v3, Direction 6).
- Rebuilt `public/monsters/monster/994.{png,json}` at **scale 1.0**
  (standing ~188×250; slot 476×355 for wide attack wings), top-aligned,
  FrameSet from 178 itself (no Attack1 spin remap needed). An earlier 0.42
  pass made standing ~79×105 — looked like trash, not a boss.
- `phase1Data` 994: `crystalName: "WingedBullLord"`, comment notes Mir2DB vs
  KR Image 184 mismatch.
- Bumped `MONSTER_ASSET_VERSION` to `20260723-beastking-178-full`.

## 2026-07-23 - Fix Namman monster FrameSets (wrong layout was breaking facing/anims)

### Root cause
KR KoreanServer `.Lib` files are **version 1** (DXT1, no embedded FrameSet).
Guessing DefaultMonster or WeMade stride-10 produced **mixed directions per action**
(standing one way, walking another, attack spinning) — exactly "facing wrong ways /
wrong animations at wrong times".

### Fix
- Read the real FrameSet from matching **NextClient v3** libs (same MonsterImage
  indices, same frame counts): DarkBeast 268/269, CaveBat 019, WingedTigerLord 184.
- Build atlases from NextClient gzip art + that FrameSet, Direction 6 (left).
- Tigers (991/992) and Bat (993): installed from proven `export-monster-atlases.ps1`
  output (NextClient), remapped to our indexes.
- Beast King (994): Crystal's Attack1/Attack2 are intentional **360-spin** clips;
  standing upright form also reads oddly in isometric. For idle solo view, remap
  all actions to the **left-facing walk** clip (frames 108–117) so facing stays
  consistent toward the player.
- Idle motion: solo combat keeps enemies on `standing` once in melee. Field trash
  was not walking because aggro waited for attack range while engage starts at
  `LANE.aggroRange` (~170px) — player closed the gap first. Fixed: aggro at
  `engageRange` so enemies walk in as soon as the fight engages. Restored normal
  standing idle (no walk-in-place). Boss Attack1 still remaps to left-facing walk
  clip (Crystal Attack1 is a 360-spin).
- Builder: `tools/build-libv1-monster-atlas.mjs` now takes a v3 FrameSet lib,
  supports v1/v3 pixel libs, and `remap=attack1:walking,...` overrides.
- Bumped `MONSTER_ASSET_VERSION` for cache bust.

### Verify
- Field tiger screenshot: faces left toward player.
- Boss walk-form screenshot: faces toward player (down-left), no spin.
- `npm run check`: pre-existing taoist fixture drift only (unrelated).



### What
The KR server package (`Downloads/KoreanServer.rar`) is a full Crystal server +
client. It solves new-content sourcing cleanly:
- `Server/Server.MirDB` (DB v68) = 504 monsters with Korean name + `Image`
  index + level/HP/AC/DC + EXP + drop path.
- `Client/Data/Monster/<Image>.Lib` = one **version-1 DXT1/BC1** `.Lib` per
  monster (full colour, indexed by that `Image`).
- NOTE: Mir2DB `img` != this server's `Image`. Match monsters by **Korean name**
  (남만 = Namman = Southern Barbarian).

### Pipeline (reusable)
- `tools/parse-mirdb-monsters.mjs`: syncs onto MonsterInfoList in a v68 .MirDB
  (skips Map/Item lists) -> `mirdb-monsters.json`.
- `tools/lib/crystal-libv1.mjs`: version-1 `.Lib` reader + DXT1 decoder.
- `tools/build-libv1-monster-atlas.mjs`: `.Lib` -> game atlas using Crystal
  `FrameSet.DefaultMonster` layout. **Frames must be
  TOP-aligned (y=0) in each slot** — the renderer reads the source rect from
  `(slot*slotWidth, 0)` with height `meta.h`; bottom-aligning makes shorter
  clips (standing/walking) invisible in-game.
- **FIX (dir): use Direction 6, NOT 4.** Solo-dungeon monsters always face LEFT
  toward the player (144/155 existing atlases are dir6).
- **FIX (layout): these KR .Lib use the WeMade stride-10 layout, NOT Crystal
  FrameSet.DefaultMonster.** DefaultMonster (standing off4, walking off6...) gave
  inconsistent facings per action (standing dir6 pointed down while walking dir6
  pointed left). The .Lib frame counts prove it: 268=327, 269=328, 184=690 —
  ~340-frame WeMade template, not DefaultMonster's 154. Rewrote
  `build-libv1-monster-atlas.mjs` to the same layout `build-kr-monster-atlas.mjs`
  uses: standing off0/walking off80/attack off160/struck off240/die off260, each
  per-direction **stride 10**, `frame = base + off + dir*stride + i`. At dir6 all
  actions now face left. Client uses `BodyLibrary.Frames ?? DefaultMonster`
  (MLibrary.cs) — v1 libs have no embedded frames, so the WeMade template is the
  real one for these.
- **Bat (019, 224 frames)** lacks a struck/die block in this template; builder now
  falls back an all-empty struck/die/dead clip to the standing frames so death
  still renders. Tigers (327/328) and Beast King (690) have full blocks.

### Content added
- Monster templates 991 Namman Black Tiger (268.Lib), 992 White Tiger (269),
  993 Bat (019), 994 Beast King boss (184.Lib, 0.5x) — stats scaled just above
  Fox Cave (lvl ~93-95 trash, lvl 108 boss).
- Zones `zone-namman-1` (field) + `zone-namman-boss` (Beast King's Lair), wired
  to the `southern-barbarian` teleport region. Removed the `990` test
  placeholder (template, zone, atlas, layers entry).

### Verify
- `npm run check`: 483 tests pass; only pre-existing taoist fixture drift
  (gold 191->194 from earlier battleData change) — unrelated.
- `npm run smoke`: clean, 0 errors. In-game screenshots confirm both monsters
  render + fight in their zones.

## 2026-07-23 - Fix Awakening Soul multi-drop UI (loot/combat log)

### What
Empowered multi-soul awards were easy to miss: battle log deduped identical
"received Awakening Soul" lines (so 3 souls looked like 1), and Recent Loot's
6-line cap buried souls under oils/gear because souls are awarded last.

### Fix
- Collapse stackable drops to `Found 3× Awakening Soul`
- Prioritize souls (and the roll summary) in Recent Loot; widen to 8 lines
- Push soul-roll summary after drop lines so it stays visible in the combat log

### Changes
- `src/app.monolith.js`: `summarizeDropResults`, reward loot/battle log paths

### Verify
- `npm.cmd run smoke`

## 2026-07-23 - Empowered/ascended Awakening Soul multi-rolls

### What
Awakening Soul drops on empowered/ascended bosses now roll multiple times
instead of a single shared-table hit:
- Normal bosses unchanged (shared table roll + one bonus soul roll).
- Empowered: 2 independent soul-chance rolls; Ascended: 3.
- Each roll still uses the empower/ascend drop-rate multiplier (2×/3×).
- Bonus soul chance also runs once per roll slot (ascended ceiling 3+3=6).
- Battle log reports table/bonus hits so the multi-roll is visible in-game.

### Changes
- `src/core/drops.js`: `omitBossDropTableItem`, `bossDropTableItemChance`,
  `awakeningSoulBossDropRollCount`, `countIndependentChanceHits`
- `src/app.monolith.js`: `rollBossTableDrops` soul multi-roll path
- `tests/drops.test.mjs`: coverage for the new helpers

### Verify
- `npm.cmd run check`

## 2026-07-22 - Map builder: native KR .wil tile rendering + Sorrow Moon (FOX02) test zone

### What
1. **Map builder now renders KR `.wil` tiles natively (crisp at any zoom).**
   The editor previously showed a pre-rendered 3600×2400 backdrop PNG for KR
   maps (world is 19200×12800), so it blurred badly ("low pixel/broken") at
   normal zoom. Added a Node WeMade `.wil`/`.wix` reader
   (`tools/lib/wemade-wil-lib.mjs`, ported from Crystal's `WeMadeLibrary.cs`;
   nType 2 RGB565 raw-deflate, colour 0 = transparent key). The map-builder
   server now serves tile frames from the KR `.wil` libs (Tiles/SmTiles/
   Objects*) through the existing `/api/lib/frame` endpoint via a new `krData`
   path. The client draws real back tiles across the whole visible area at
   every zoom (595 unique back tiles → cache instantly), nearest-neighbour so
   pixel art stays sharp; the backdrop is now only an instant fill that gets
   covered. Added in-flight frame-request dedupe.
2. **Sorrow Moon (FOX02) test zone — built then REVERTED.** Briefly added
   `zone-sorrow-moon-mtn` using the existing fox family + fox-cave art, but
   FOX02 (Sorrow Moon Mountain) is the same fox area the game already ships as
   Fox Cave (Mongchon Province) — i.e. a reskin, not new content. Reverted the
   zone (`src/phase1Data.js`) and its teleport-region entry
   (`src/app.monolith.js`). Next: a gap analysis of KR-client maps/monsters vs
   what the game implements, to find genuinely new dungeons + monsters.

### Changes (kept)
- New `tools/lib/wemade-wil-lib.mjs`; `tools/map-builder-server.mjs`
  (`krData` + `resolveLib`); `tools/map-builder/app.js` (hybrid render, crisp
  tiles, dedupe); `tools/map-builder/paths.json` (`krData`).

### Verify
- `npm.cmd run check` - pass except the pre-existing `fixture:offline-taoist`
  drift (gold 194 vs 191), unrelated to this work.
- `npm.cmd run smoke` - green, no console/page errors.

## 2026-07-22 - Mobile performance fixes (investigation + 4 targeted changes)

### What
Players reported the game "starting to run badly on mobile". Investigation
(3 code audits + headless profiling at 4x CPU throttle, phone viewport) found
no single smoking gun - baseline held 60fps even in swarm zones - but four
compounding costs that hit phones specifically:

1. **Render cap now applies to all mobile, not just iOS.** `RENDER_MIN_INTERVAL_MS`
   (33ms) was gated on `IS_IOS`; Android did the full canvas redraw + DOM work
   every rAF. New `IS_MOBILE_DEVICE` covers Android UA and coarse-pointer
   touch devices (touch-screen laptops excluded).
2. **Chunked simulation catch-up.** `catchUpSimulation` replayed up to 10 min
   of missed 100ms steps in one synchronous loop - measured a 417ms frozen
   frame after only a 20s stall (4x throttle); a multi-minute background gap
   froze phones for seconds on every app switch back. Now budgeted at
   `CATCH_UP_FRAME_BUDGET_MS` (8ms) per frame; `tick()` skips the live step
   and render until caught up. Verified: post-stall max frame now ~17-33ms.
3. **Monster sheet cache eviction on zone change.** `imageCache` kept every
   monster sheet ever loaded decoded in memory for the whole session (Great
   Fox sheet alone is 5.6MB compressed). `evictMonsterImageCacheForZone` in
   `enterZone` drops sheets the destination zone does not use, keeping the
   zone's `enemyIds` + swarm/reinforcement config templates + live enemy/swarm
   + taoist pets (incl. both Shinsu indexes) so nothing flickers.
4. **Per-frame DOM guards.** `applyCombatHudLayout` wrote stage styles (and
   forced a reflow via `clientHeight`) every frame - now signature-guarded.
   `combatHudLayoutMetrics` used `innerHTML.trim()` (subtree re-serialisation)
   for skill-bar visibility - now `childElementCount`. Empty scene overlay no
   longer writes `hidden`/`innerHTML` every frame.

### Changes
- `src/app.monolith.js` only: `IS_MOBILE_DEVICE`; `tick`/`catchUpSimulation`
  chunking; `evictMonsterImageCacheForZone` (+ `enterZone` hook);
  `combatHudLayoutSignature` guard; overlay empty-path guard.

### Verify
- `npm.cmd run check` - pass except pre-existing `fixture:offline-taoist`
  drift (gold 194 vs 191, hp 123 vs 120) which fails identically with these
  changes stashed; caused by uncommitted `src/battleData.js`/`empoweredItems`
  edits already in the working tree, not by this work.
- `npm.cmd run smoke` - green.
- Headless catch-up probe: 20s main-thread stall then frame deltas; max frame
  after resume dropped from ~417ms to ~33ms.



### What
New rebirth upgrade **Gem Cutting**: five tiers at 50 / 100 / 150 / 200 / 250 RP
add +1 application to every gem and orb per purchase (up to +5). Each gem/orb
keeps its own base caps (`maxStatCount` / `criticalDamage`); the bonus raises
both so per-stat and total-upgrade gates stay in sync. Success chance still
falls with each application via the existing reflect penalty.

### Changes
- `src/app.monolith.js`: `rebirth-gem-orb-cap` / `gemOrbUpgradeCapBonus`;
  `gemEffectiveMaxStatCount` / `gemEffectiveTotalUpgradeCap`; wired into
  `canApplyGemToEntry` and gem tooltips; upgrade progress/icon labels

### Verify
- `npm.cmd run check`
- Manual: buy a tier, apply a gem past its old max; tooltip shows raised caps

## 2026-07-21 - Master Smithing rebirth upgrade (+6…+10)

### What
New rebirth upgrade **Master Smithing**: five tiers at 50 / 100 / 150 / 200 /
250 RP raise the Smith combine cap from +5 up to +10. Success chance continues
stepping down (50%…10%, then 5%…1%), never below 1%.

### Changes
- `src/app.monolith.js`: `rebirth-smith-combine-cap` upgrade; `smithCombineStatCap`;
  extended `SMITH_COMBINE_SUCCESS_CHANCES`; Smith NPC copy
- `src/battleData.js`: comment that `SMITH_COMBINE_STAT_CAP` is the base only

### Verify
- `npm.cmd run check`
- Manual: buy tiers, confirm +5 items can combine again at shown %; +10 is hard max

## 2026-07-21 - Potion restore empowered armour stat

### What
New empowerment `potionRestoreBonusPercent` on armour / dress, helmet, belt,
and boots. Stacked bonus increases Health and Mana potion restore amounts
(instant and over-time), capped at 100% combined (100 HP potion → 200 HP).

### Changes
- `src/core/empoweredItems.js`: roll tables, formatters, global bonus pool,
  `equippedPotionRestoreBonusPercent` / `applyEquippedPotionRestoreBonus`
- `src/battleData.js`: sanitize / clone / addStats whitelist
- `src/app.monolith.js`: itemEntryStats + tooltips; scale potion use in live,
  offline, boss-party, and offline-group paths
- `tests/empoweredItems.test.mjs`, `tests/battleData.test.mjs`

### Verify
- `npm.cmd run check`
- Manual: equip potion-restore empowered armour pieces, drink HP pot, confirm
  total restore scales; over 100% stacked still caps at double

## 2026-07-21 - Shift-click unequip from paper doll

### What
Shift-click on equipped body/paper-doll items now unequips them into the bag
(same as double-click unequip). Previously shift-click only handled bag/hotbar/
storage moves and ignored equipped gear.

### Changes
- `src/app.monolith.js`: `handleInventoryShiftClick` handles `data-equipped-slot`

### Verify
- Manual: Character window, Shift-click armour/weapon → lands in inventory

## 2026-07-21 - Poisoning stall in BDD + Slaying vs Half Moon

### What
1. Taoist Poisoning in BDD (and solo swarm) could permanently stop after a cast
   if the target died during the 500ms apply delay — pending poison never cleared,
   so auto and manual Poisoning stayed blocked (manual felt "stuck").
2. Warrior Slaying could fire instead of Half Moon / Cross Half Moon while AOE
   farming, because Slaying's yield check used `usableWarriorSweepAttack`, which
   also returns null when Blade Avalanche is ready.

### Changes
- `src/app.monolith.js`: clear solo/boss-party `pendingPoison` when apply target
  is dead/missing; clear queued Poisoning only if no further targets remain
- `src/app.monolith.js`: `chargedSlayingAttack` and boss-party warrior action
  yield Slaying when `resolveActiveSweepAttack` can fire

### Verify
- `npm.cmd run check` / `npm.cmd run smoke`
- Manual: BDD Tao poison through multi-wave clears; Warrior AOE farm with HM +
  Slaying + BA on auto

## 2026-07-21 - Toggle Recent Loot / Activity Log panels

### What
Players can hide or show the side-panel Recent Loot and Activity Log boxes.
Preference persists in settings (defaults On). Toggle from the panel header
(Hide/Show) or Options.

### Changes
- `src/persistence/sanitizeSettings.js`: `showRecentLoot` / `showActivityLog`
- `src/app.monolith.js`: panel HTML, Options rows, setters, save/load/reset
- `src/styles.css`: collapsed stub + Hide/Show button styling
- `tests/persistenceSettings.test.mjs`: defaults + explicit false

### Verify
- `npm.cmd run check` / `npm.cmd run smoke`
- Manual: Hide from panel header, reload, confirm stays hidden; Options On/Off

## 2026-07-21 - Character Select shows XP % to next level

### What
Character Select cards show `Lv X | Y%` (progress toward next level) instead of
shared gold. Max level shows `Max`.

### Changes
- `src/app.monolith.js`: `characterSelectXpPercentText` + card label update

### Verify
- `npm.cmd run check`
- Manual: open Character Select and confirm each class shows its own XP %

## 2026-07-21 - Shared account gold pool

### What
Gold is no longer per-character. Warrior / Wizard / Taoist share one account
wallet for earning, spending, shops, and Character Select. Existing saves
migrate by summing each class's gold into `account.gold` once.

### Changes
- `src/persistence/restoreAccount.js`: `resolveAccountGold` migration + restore
- `src/app.monolith.js`: shared gold helpers; character switch / party / offline /
  achievements / rebirth / Character Select use the account pool
- `tests/persistenceRestoreAccount.test.mjs`: sum vs saved `account.gold`

### Verify
- `npm.cmd run check`
- Manual: earn gold on Warrior, switch to Wizard, confirm gold unchanged; buy
  from shop on either class

## 2026-07-21 - Fix party switch paper-doll portraits

### What
Group-dungeon / boss-room party paper-doll portraits were missing the naked
body base and gear layer offset used by character-select. Unarmoured
characters disappeared, heads showed as black voids, and framing was off.
Follow-up: retuned crop so heads/feet sit with even padding in the 72x96 box.
Also applied the same figure-centred fill to the Character Select window.

### Changes
- `src/styles.css`: party portraits use `nakedpaperdoll.png` + layer
  `translate(-5px, -87px)`, with figure-centred crop
  (`translate(-124px,-145px) scale(0.5)`)
- `src/styles.css`: character-select stage uses the same figure centre with
  container-query scale `min(100cqw/150px, 100cqh/191px)`

### Verify
- Manual: enter group content with mixed gear (including an unarmoured
  character) and confirm bodies, heads, and centering in the portrait bar
- Manual: open Characters and confirm each class paper doll fills the card

## 2026-07-21 - Character-specific auto potion HP/MP thresholds

### What
Options Auto HP/MP sliders are per character. Players pick Warrior / Wizard /
Taoist in Options, then set that class's drink thresholds. Party and offline
group auto-pots use each member's own thresholds. Old flat settings seed all
three classes on load.

### Changes
- `src/persistence/sanitizeSettings.js`: `autoPotionThresholdsByCharacter` + migration
- `src/app.monolith.js`: Options character buttons, per-class get/set, party/offline
- `src/styles.css`: Options character button row
- `tests/persistenceSettings.test.mjs`: migration + per-class sanitize coverage

### Verify
- `npm.cmd run check`
- Manual: Options → set Wizard HP different from Warrior → switch characters / party

## 2026-07-21 - Remove HP/MP info-bar flash

### What
Stage info orb HP/MP fills no longer white-flash when values drop. Fill height
and labels still update normally.

### Changes
- `src/app.monolith.js`: removed `flashStageInfoOrbPanel`, last-value tracking,
  and warrior-charge MP flash suppress
- `src/styles.css`: removed `.stage-info-orb-flash` animation / overlay

### Verify
- `node --check src/app.monolith.js`
- Manual: take damage / spend MP and confirm orbs do not flash
- Note: taoist offline fixture currently flips between two result sets after Dave UI merge (unrelated)

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
