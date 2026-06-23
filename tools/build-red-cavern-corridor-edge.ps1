param(
  [int]$RepeatEveryPx = 3000,
  [string]$RegionJson = "./tile-review/red-cavern-r01-corridor-region.json",
  [string]$ColumnStrip = "../public/mapedges/red-cavern-wall-columns.png",
  [string]$OutputPng = "../public/mapedges/red-cavern-corridor-edge.png"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$regionPath = Join-Path $PSScriptRoot $RegionJson
if (-not (Test-Path $regionPath)) { throw "Region JSON not found: $regionPath" }
$region = Get-Content -LiteralPath $regionPath -Raw | ConvertFrom-Json

$excludeCells = @()
foreach ($entry in @($region.excludedCells)) {
  if ($null -ne $entry.x -and $null -ne $entry.y) {
    $excludeCells += "$($entry.x),$($entry.y)"
  }
}

$fixedStart = [int]$region.bounds.x0
$fixedCount = if ($null -ne $region.bounds.width) { [int]$region.bounds.width } else { [int]$region.columnCount }
$laneMapY = if ($null -ne $region.laneMapY) { [int]$region.laneMapY } else { [int]$region.bounds.y1 }

$stripArgs = @{
  MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/R01.map"
  OutputPng = $ColumnStrip
  ReviewRoot = "../tile-review/red-cavern-wall-columns"
  ReviewTitle = "Red Cavern wall columns"
  FixedColumnStart = $fixedStart
  FixedColumnCount = $fixedCount
  LaneMapY = $laneMapY
  CellsNorthOfLane = 14
  CellsSouthScan = 6
  WallsOnly = $false
  DrawOpenLaneFloor = $true
  BasicFloorFrames = @(3850, 3851, 3852, 3853, 3854)
  # Must match RED_CAVERN_TILE_PATTERN in src/phase1Data.js (slot indices into BasicFloorFrames).
  BasicFloorPattern = @(
    ,@(0, 2, 4, 1, 3, 0, 2, 4, 1, 3, 0, 2)
    ,@(3, 1, 0, 4, 2, 3, 1, 0, 4, 2, 3, 1)
    ,@(2, 4, 3, 0, 1, 2, 4, 3, 0, 1, 2, 4)
    ,@(1, 0, 2, 3, 4, 1, 0, 2, 3, 4, 1, 0)
    ,@(4, 3, 1, 2, 0, 4, 3, 1, 2, 0, 4, 3)
    ,@(0, 1, 3, 4, 2, 0, 1, 3, 4, 2, 0, 1)
  )
}
if ($excludeCells.Count -gt 0) { $stripArgs.ExcludeCells = $excludeCells }

$floorOverrides = @()
foreach ($entry in @($region.floorCellOverrides)) {
  if ($null -ne $entry.x -and $null -ne $entry.y -and $null -ne $entry.backFrame) {
    $floorOverrides += "$($entry.x),$($entry.y):$($entry.backFrame)"
  }
}
if ($floorOverrides.Count -gt 0) { $stripArgs.FloorCellOverrides = $floorOverrides }

$metaJson = & (Join-Path $PSScriptRoot "build-crystal-wall-column-strip.ps1") @stripArgs | ConvertFrom-Json
$suggestedYOffset = [int]$metaJson.suggestedYOffsetFromBase

$stripPath = Join-Path $PSScriptRoot $ColumnStrip
$strip = [System.Drawing.Bitmap]::FromFile($stripPath)
$stripWidth = $strip.Width
try {
  $sheet = [System.Drawing.Bitmap]::new($RepeatEveryPx, $strip.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImageUnscaled($strip, 0, 0)
  }
  finally { $graphics.Dispose() }

  $outPath = Join-Path $PSScriptRoot $OutputPng
  New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
  $sheet.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()
}
finally {
  $strip.Dispose()
}

Write-Host "Red Cavern corridor edge: ${stripWidth}px strip (${fixedCount} cols). Game loops via columnCount/columnWidth on red-cavern-wall-columns.png."
Write-Host "Suggested yOffsetFromBase: $suggestedYOffset"
