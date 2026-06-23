param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapLib = "Map/WemadeMir2/Tiles.Lib",
  [string]$MapIndex = "../public/maptiles/index.json",
  [string]$OutputSheet = "../public/maptiles/red-cavern.png",
  [string]$SetId = "red-cavern",
  [string]$Label = "Red Cavern",
  # Crystal R01/R02 walkable back tiles (Tiles.Lib 3850-3854).
  [int[]]$Frames = @(3850, 3851, 3852, 3853, 3854)
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
foreach ($tile in (Export-TileRange 3848 10 "red-cavern-tiles-build")) {
  $byFrame[[string]$tile.frame] = $tile
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

Write-Host "Red Cavern tiles: $($tiles.Count) slots ($slotWidth x $slotHeight)"
$tiles | ForEach-Object { Write-Host "  slot $($_.slot) <- frame $($_.srcFrame)" }
