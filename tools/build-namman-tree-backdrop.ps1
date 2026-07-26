param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/NAMMAN.map",
  [string]$OutputPng = "../public/mapedges/namman-tree-columns.png",
  [string]$ReviewRoot = "../tile-review/namman-tree-columns",
  # Dense tree belt north of NE scenic pocket walkway (NAMMAN ~696-717 @ y=144).
  [int]$FixedColumnStart = 696,
  [int]$FixedColumnCount = 22,
  [int]$LaneMapY = 144,
  [int]$CellsNorthOfLane = 20,
  [int]$CellsSouthScan = 1
)

$ErrorActionPreference = "Stop"

$metaJson = & (Join-Path $PSScriptRoot "build-crystal-wall-column-strip.ps1") `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputPng $OutputPng `
  -ReviewRoot $ReviewRoot `
  -ReviewTitle "Southern Barbarian tree backdrop" `
  -FixedColumnStart $FixedColumnStart `
  -FixedColumnCount $FixedColumnCount `
  -LaneMapY $LaneMapY `
  -CellsNorthOfLane $CellsNorthOfLane `
  -CellsSouthScan $CellsSouthScan `
  -WallsOnly $true `
  -DrawOpenLaneFloor $false | ConvertFrom-Json

Write-Host "Namman tree columns: $OutputPng ($($metaJson.columnCount) cols x $($metaJson.columnWidth)px)"
Write-Host "Suggested yOffsetFromBase: $($metaJson.suggestedYOffsetFromBase)"
Write-Host "Strip size: $($metaJson.stripWidth) x $($metaJson.stripHeight)"
$metaJson | ConvertTo-Json -Depth 6
