param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapLib = "Map/WemadeMir2/Tiles.Lib",
  [string]$MapIndex = "../public/maptiles/index.json",
  [string]$OutputSheet = "../public/maptiles/fox-cave.png",
  [string]$SetId = "fox-cave",
  [string]$Label = "Fox Cave",
  # Crystal FOX01 walkable back tiles from map-builder region (36,257)-(61,270).
  [int[]]$Frames = @(2950, 2951, 2952, 2953, 2954, 2958, 2962, 2963, 2967, 2968, 2972, 3450)
)

$ErrorActionPreference = "Stop"

function Export-TileRange([int]$start, [int]$count, [string]$folderName) {
  $outputRoot = "..\tile-review\$folderName"
  $out = Join-Path $PSScriptRoot $outputRoot
  & (Join-Path $PSScriptRoot "export-map-tile-review.ps1") `
    -DataRoot $DataRoot `
    -MapLib $MapLib `
    -OutputRoot $outputRoot `
    -StartFrame $start `
    -FrameCount $count `
    -MaxVisible 200 `
    -IncludeAllFrames | Out-Null
  $tiles = (Get-Content (Join-Path $out "tiles.json") -Raw | ConvertFrom-Json).tiles
  foreach ($tile in $tiles) {
    $tile | Add-Member -NotePropertyName imagePath -NotePropertyValue (Join-Path $out $tile.file) -Force
  }
  return $tiles
}

$byFrame = @{}
# Export in clumps — 3450 sits far from the 2950 band and MaxVisible caps a single sweep.
foreach ($range in @(
  @{ start = 2948; count = 30; folder = "fox-cave-tiles-build-a" },
  @{ start = 3448; count = 8; folder = "fox-cave-tiles-build-b" }
)) {
  foreach ($tile in (Export-TileRange $range.start $range.count $range.folder)) {
    $byFrame[[string]$tile.frame] = $tile
  }
}

$picked = foreach ($frame in $Frames) {
  $key = [string]$frame
  if (-not $byFrame.ContainsKey($key)) { throw "Tile frame $frame not found in Tiles.Lib export" }
  $byFrame[$key]
}

Add-Type -AssemblyName System.Drawing
$bitmaps = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1
try {
  foreach ($tile in $picked) {
    $bitmap = [System.Drawing.Bitmap]::FromFile($tile.imagePath)
    $bitmaps.Add($bitmap)
    $slotWidth = [Math]::Max($slotWidth, $bitmap.Width)
    $slotHeight = [Math]::Max($slotHeight, $bitmap.Height)
  }

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $bitmaps.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  for ($slot = 0; $slot -lt $bitmaps.Count; $slot++) {
    $graphics.DrawImageUnscaled($bitmaps[$slot], $slot * $slotWidth, 0)
  }
  $graphics.Dispose()

  $sheetPath = Join-Path $PSScriptRoot $OutputSheet
  New-Item -ItemType Directory -Force -Path (Split-Path $sheetPath) | Out-Null
  $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()
}
finally {
  foreach ($bitmap in $bitmaps) { $bitmap.Dispose() }
}

$tiles = for ($slot = 0; $slot -lt $picked.Count; $slot++) {
  $tile = $picked[$slot]
  [ordered]@{
    slot = $slot
    srcFrame = [int]$tile.frame
    w = [int]$tile.width
    h = [int]$tile.height
    offsetX = [int]$tile.offsetX
    offsetY = [int]$tile.offsetY
  }
}

$indexPath = Join-Path $PSScriptRoot $MapIndex
$index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
$existing = @($index.sets | Where-Object { $_.id -ne $SetId })
$entry = [ordered]@{
  id = $SetId
  label = $Label
  sheet = Split-Path $sheetPath -Leaf
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  tiles = $tiles
}
$index.sets = @($entry) + $existing
$index | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $indexPath -Encoding UTF8

Write-Host "Fox Cave tiles: $($tiles.Count) slots ($slotWidth x $slotHeight)"
$tiles | ForEach-Object { Write-Host "  slot $($_.slot) <- frame $($_.srcFrame)" }
