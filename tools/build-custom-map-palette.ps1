param(
  [string]$ReviewRoot = "../tile-review/wemade-mir2-tiles-000000-001999",
  [string]$MapIndex = "../public/maptiles/index.json",
  [string]$OutputSheet = "../public/maptiles/wemade-mir2-custom.png",
  [string]$SetId = "wemade-mir2-custom",
  [string]$Label = "Wemade Mir2 Custom",
  [int[]]$Frames = @(450, 451, 452, 453, 454, 465, 468)
)

Add-Type -AssemblyName System.Drawing

$reviewPath = Join-Path $PSScriptRoot $ReviewRoot
$tilesPath = Join-Path $reviewPath "tiles.json"
if (-not (Test-Path $tilesPath)) {
  throw "Review tiles metadata not found: $tilesPath"
}

$metadata = Get-Content -LiteralPath $tilesPath -Raw | ConvertFrom-Json
$picked = foreach ($frame in $Frames) {
  $tile = $metadata.tiles | Where-Object { $_.frame -eq $frame } | Select-Object -First 1
  if ($null -eq $tile) {
    throw "Frame $frame was not found in $tilesPath"
  }
  $tile
}

$bitmaps = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1
try {
  foreach ($tile in $picked) {
    $imagePath = Join-Path $reviewPath $tile.file
    if (-not (Test-Path $imagePath)) {
      throw "Tile image not found: $imagePath"
    }
    $bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)
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

$tiles = @()
for ($slot = 0; $slot -lt $picked.Count; $slot++) {
  $tile = $picked[$slot]
  $tiles += [ordered]@{
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
$custom = [ordered]@{
  id = $SetId
  label = $Label
  sheet = Split-Path $sheetPath -Leaf
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  tiles = $tiles
}
$index.sets = @($custom) + $existing
$index | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $indexPath

Write-Output "${Label}: exported $($tiles.Count) tiles"
Write-Output ($tiles | ForEach-Object { "$($_.slot): frame $($_.srcFrame)" })
