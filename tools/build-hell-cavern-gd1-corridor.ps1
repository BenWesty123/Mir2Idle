param(
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell01.map",
  [int]$FocusMapX = 141,
  [int]$LaneMapY = 51,
  [int]$FixedColumnStart = 123,
  [int]$FixedColumnCount = 37
)

$ErrorActionPreference = "Stop"

# Open walk lane at (141, 51) — exclude from wall column front pass so floor shows through.
$excludeCells = @(
  "130,54", "136,48", "136,50", "136,52", "138,54", "138,56", "140,56", "142,56",
  "144,46", "144,48", "144,50", "144,52", "144,54", "144,56",
  "146,52", "146,54", "146,56", "152,48", "154,50", "154,52", "154,54",
  "156,50", "156,52", "156,54", "156,56", "158,50", "158,52",
  "160,50", "160,52", "160,56", "162,54", "162,56", "164,54", "164,56"
)

# Must match HELL_CAVERN_1_TILE_PATTERN in src/phase1Data.js (slot indices into 3450-3454).
$basicFloorPattern = @(
  @(3, 1, 0, 0, 0, 4, 0, 1, 0, 0, 0, 3),
  @(3, 0, 0, 0, 0, 1, 1, 0, 0, 4, 2, 0),
  @(1, 3, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1),
  @(2, 3, 0, 0, 0, 0, 1, 4, 2, 4, 2, 4),
  @(1, 3, 0, 3, 0, 0, 3, 4, 0, 2, 2, 1),
  @(1, 3, 0, 0, 0, 0, 2, 4, 0, 0, 0, 0)
)

& (Join-Path $PSScriptRoot "build-crystal-wall-column-strip.ps1") `
  -MapPath $MapPath `
  -OutputPng "../public/mapedges/hell-cavern-1-wall-columns.png" `
  -ReviewRoot "../tile-review/hell-cavern-gd1-wall-columns" `
  -ReviewTitle "Hell Cavern GD1 corridor ($FocusMapX, $LaneMapY)" `
  -FixedColumnStart $FixedColumnStart `
  -FixedColumnCount $FixedColumnCount `
  -LaneMapY $LaneMapY `
  -CellsNorthOfLane 14 `
  -CellsSouthScan 6 `
  -DrawOpenLaneFloor $true `
  -BasicFloorFrames @(3450, 3451, 3452, 3453, 3454) `
  -BasicFloorPattern $basicFloorPattern `
  -ExcludeCells $excludeCells
