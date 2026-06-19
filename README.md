# LOM Idle V2

Clean restart for a browser-based Legend of Mir idle game.

The first milestone is animation correctness, not idle-game mechanics. The app
currently renders a layered player sprite facing east (`MirDirection.Right`,
direction `2`) using the same frame formula as Crystal:

```text
sourceFrame = start + (count + skip) * direction + frameIndex
```

The full east-facing player action list is mirrored from
`Client/MirObjects/Frames.cs` in the Crystal source tree.

The main game stage now renders through a single canvas. Map tiles, player
layers, monsters, spell layers, projectiles, and combat impact flashes are
drawn with canvas `drawImage`; the surrounding controls and debug panels remain
ordinary DOM. The readout includes a lightweight FPS and canvas draw-time
counter for performance tuning.

## Run

```powershell
npm run dev
```

Then open `http://localhost:4177`.

No install is needed for this first version. It uses only Node's built-in HTTP
server and browser JavaScript modules.

## Asset Source

The full game asset source is expected at:

```text
C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data
```

`tools/extract-player-east.json` is the V2 extraction manifest. It is designed
for the existing Crystal `Idle/tools/lib-exporter` batch command, but extends
the old action list to include all player actions from Crystal's frame table.

Current generated sets:

- `public/sprite-sets/common`: `CArmour`, `CHair`, `CWeapon`
- `public/sprite-sets/archer`: `AArmour`, `AHair`, split `AWeapon L/R`
- `public/sprite-sets/assassin`: `ARArmour`, `ARHair`, `ARWeapon`, `ARWeapon S`
- `public/monsters`: starter west-facing monsters from `Monster/*.Lib`
- `public/spellfx`: native spell/effect atlases from `Magic*.Lib`

The spell selector is mapped back to Crystal body clips. For example,
`HeavenlySword` plays `attack2`, `CrescentSlash` plays `attack3`, Archer shots
play `attackRange2`, `ExplosiveTrap` plays `harvest`, and ordinary caster
spells play `spell`. Spells with no exported effect atlas still preview the
correct body animation as "body only".

Use `tools/prepare-class-assets.ps1` before exporting Archer or Assassin. It
renames the source `.Lib` files into temporary numeric staging folders so the
existing exporter can read class-specific weapon variants.

Use `tools/prepare-monster-assets.ps1` before exporting monsters. The current
monster manifest uses Crystal's default monster frame set facing west
(`MirDirection.Left`, direction `6`): stand, walk, attack, struck/flinch, die,
dead, revive.

## Battle Prototype

The current battle loop is intentionally simple. The Warrior and starter enemies
use static HP, MP, DC, MC, SC, AC, AMC, Accuracy, Agility, Luck, and attack speed
values in `src/battleData.js`. Combat rolls attack and defence stats as
min/max values: physical damage is `max(1, roll(DC) - roll(AC))`; wizard and
taoist spell damage use `MC` or `SC` against `AMC`. Luck runs from 0-10 and
biases the attack stat roll toward its maximum, with 10 always rolling max.
Auto battle triggers attack/flinch/death animations.

## Item Data

The Crystal server item database can be exported with
`npm run export:crystal-items`. The generated reference file is
`src/data/crystal-items.json`; the smaller hand-editable prototype item list is
`src/data/items.json`. Starter item icons copied from Crystal live in
`public/item-icons/items`.
