param(
  [int]$RepeatEveryPx = 3000,
  [string]$RegionJson = "./tile-review/fox-cave-fox01-corridor-region.json",
  [string]$ColumnStrip = "../public/mapedges/fox-cave-wall-columns.png",
  [string]$OutputPng = "../public/mapedges/fox-cave-corridor-edge.png"
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
$floorFrames = @($region.backFrames | ForEach-Object { [int]$_ })
if ($floorFrames.Count -lt 1) {
  $floorFrames = @(2950, 2951, 2952, 2953, 2954, 2958, 2962, 2963, 2967, 2968, 2972, 3450)
}

$pattern = @()
foreach ($row in @($region.tilePattern)) {
  $pattern += ,(@($row | ForEach-Object { [int]$_ }))
}
if ($pattern.Count -lt 1) {
  throw "Region JSON missing tilePattern"
}

$stripArgs = @{
  MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/FOX01.map"
  OutputPng = $ColumnStrip
  ReviewRoot = "../tile-review/fox-cave-wall-columns"
  ReviewTitle = "Fox Cave wall columns"
  FixedColumnStart = $fixedStart
  FixedColumnCount = $fixedCount
  LaneMapY = $laneMapY
  CellsNorthOfLane = 14
  CellsSouthScan = 6
  WallsOnly = $false
  DrawOpenLaneFloor = $true
  BasicFloorFrames = $floorFrames
  BasicFloorPattern = $pattern
}
if ($excludeCells.Count -gt 0) { $stripArgs.ExcludeCells = $excludeCells }

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

Write-Host "Fox Cave corridor edge: ${stripWidth}px strip (${fixedCount} cols). Runtime uses fox-cave-wall-columns.png."
Write-Host "Suggested yOffsetFromBase: $suggestedYOffset"
