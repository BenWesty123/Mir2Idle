# Data Notes

## Crystal item export

`crystal-items.json` is generated from:

```text
C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Server.MirDB
```

It keeps the original Crystal item names, icon frame numbers, prices, item
types, and stat values. Use it as the reference file when choosing real items
from the old game.

Regenerate it with:

```powershell
powershell -ExecutionPolicy Bypass -File tools/export-crystal-items.ps1
```

## Crystal map and monster export

`crystal-maps.json` and `crystal-monsters.json` are generated from the same
server database. They keep the original map titles, map files, respawns,
monster stats, monster sprite IDs, and drop-file paths.

Regenerate them with:

```powershell
powershell -ExecutionPolicy Bypass -File tools/export-crystal-world.ps1
```

The Phase 1 prototype audit can then be rebuilt with:

```powershell
node tools/build-phase1-content-audit.mjs
```

The playable Phase 1 item file is generated from the curated warrior selection
and the zone drop audit with:

```powershell
node tools/build-phase1-items.mjs
```

Missing cave monster browser atlases can be exported from Crystal's Monster
libraries with:

```powershell
powershell -ExecutionPolicy Bypass -File tools/export-monster-atlases.ps1
```

## Editable idle items

`items.json` is the smaller idle-game item list. In Phase 1 it is generated
from `content-audit/phase-1/warrior-item-selection.csv` plus the curated
`content-audit/phase-1/idle-drop-items.csv`, so edit those inputs and
regenerate when we want to rename items, rebalance stats, decide drop rates, or
choose which items are available in a zone. The raw Crystal drop audit remains
in `drop-candidates-by-zone.csv` as source reference data.

Equipable items should use `"stackable": false` and `"maxStack": 1`. Potions
and other consumables can use `"stackable": true` with a higher `maxStack`;
the prototype uses 64 per potion slot.
Weapon and armour items can also include a `visual` block, for example
`"visual": { "layer": "weapon", "index": 13 }`, which maps the equipped item
back to the Crystal sprite layer index.

Equipable items can include a Crystal-derived `requirements` block. Requirement
types currently supported by the prototype are `level`, `maxAC`, `maxAMC`,
`maxDC`, `maxMC`, `maxSC`, `maxLevel`, `minAC`, `minAMC`, `minDC`, `minMC`,
and `minSC`.

`items.editable.csv` contains the same starter items in a spreadsheet-friendly
shape. It is not consumed by the game yet; it is there so item stats can be
planned quickly and then copied into `items.json`.

## Icon review pages

The extracted item icon review pages are:

```text
tile-review/items-icons-000000-001999/index.html
tile-review/stateitem-icons-000000-001999/index.html
tile-review/dnitems-icons-000000-001999/index.html
```

When a new item is added to `items.json`, its icon should point at the matching
frame from the relevant Crystal icon library.
