param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapLib = "Map/WemadeMir2/Tiles.Lib",
  [string]$MapIndex = "../public/maptiles/index.json",
  [string]$OutputSheet = "../public/maptiles/namman.png",
  [string]$SetId = "namman",
  [string]$Label = "Southern Barbarian Land",
  # NAMMAN.map region (398,318)-(416,325) — hand-picked sand/grass loop sample.
  # tools/tile-review/namman-floor-region-398-318.json
  [int[]]$Frames = @(
    4000, 4001, 4002, 4003, 4004, 4005, 4006,
    4010, 4011, 4015, 4016,
    4150, 4151, 4152, 4154,
    41110, 41111, 41112, 41113, 41114, 41115,
    41213, 41217, 41221
  )
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
foreach ($range in @(
  @{ start = 3998; count = 30; folder = "namman-tiles-build-grass" },
  @{ start = 4148; count = 12; folder = "namman-tiles-build-base" },
  @{ start = 41100; count = 30; folder = "namman-tiles-build-blend-a" },
  @{ start = 41200; count = 30; folder = "namman-tiles-build-blend-b" }
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

# Crystal floor tiles normally seat at (7,-44). Some high blend frames (41110+/412xx)
# carry garbage lib offsets (-296,-266). Map-builder ignores offsets when drawing;
# our game applies them — normalize so the authored region seats correctly.
$floorOffsetX = 7
$floorOffsetY = -44
foreach ($tile in $picked) {
  if ([int]$tile.offsetX -ne $floorOffsetX -or [int]$tile.offsetY -ne $floorOffsetY) {
    Write-Host "Normalizing frame $($tile.frame) offset ($($tile.offsetX),$($tile.offsetY)) -> ($floorOffsetX,$floorOffsetY)"
  }
  $tile.offsetX = $floorOffsetX
  $tile.offsetY = $floorOffsetY
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
$indexText = Get-Content -LiteralPath $indexPath -Raw
if ($indexText.Length -gt 0 -and [int][char]$indexText[0] -eq 0xFEFF) {
  $indexText = $indexText.Substring(1)
}
$index = $indexText | ConvertFrom-Json
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
$json = $index | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($indexPath, $json)  # UTF-8 no BOM

Write-Host "Namman tiles: $($tiles.Count) slots ($slotWidth x $slotHeight)"
$tiles | ForEach-Object { Write-Host "  slot $($_.slot) <- frame $($_.srcFrame) off=$($_.offsetX),$($_.offsetY)" }
