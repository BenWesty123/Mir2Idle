param(
  [string]$ReviewRoot = "../tile-review/wemade-mir2-objects-000000-001999",
  [string]$OutputRoot = "../public/mapobjects",
  [string]$SheetName = "wemade-mir2-custom-objects.png",
  [string]$IndexName = "index.json",
  [string]$SetId = "wemade-mir2-custom-objects",
  [string]$Label = "Wemade Mir2 Custom Objects",
  [int[]]$Frames = @(1123, 1124)
)

Add-Type -AssemblyName System.Drawing

$reviewPath = Join-Path $PSScriptRoot $ReviewRoot
$tilesPath = Join-Path $reviewPath "tiles.json"
if (-not (Test-Path $tilesPath)) {
  throw "Review metadata not found: $tilesPath"
}

$metadata = Get-Content -LiteralPath $tilesPath -Raw | ConvertFrom-Json
$picked = foreach ($frame in $Frames) {
  $object = $metadata.tiles | Where-Object { $_.frame -eq $frame } | Select-Object -First 1
  if ($null -eq $object) {
    throw "Frame $frame was not found in $tilesPath"
  }
  $object
}

$bitmaps = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1
try {
  foreach ($object in $picked) {
    $imagePath = Join-Path $reviewPath $object.file
    if (-not (Test-Path $imagePath)) {
      throw "Object image not found: $imagePath"
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
    $graphics.DrawImageUnscaled($bitmaps[$slot], $slot * $slotWidth, $slotHeight - $bitmaps[$slot].Height)
  }
  $graphics.Dispose()

  $outRoot = Join-Path $PSScriptRoot $OutputRoot
  New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
  $sheetPath = Join-Path $outRoot $SheetName
  $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()
}
finally {
  foreach ($bitmap in $bitmaps) { $bitmap.Dispose() }
}

$objects = @()
for ($slot = 0; $slot -lt $picked.Count; $slot++) {
  $object = $picked[$slot]
  $objects += [ordered]@{
    slot = $slot
    srcFrame = [int]$object.frame
    w = [int]$object.width
    h = [int]$object.height
    offsetX = [int]$object.offsetX
    offsetY = [int]$object.offsetY
  }
}

$indexPath = Join-Path $outRoot $IndexName
if (Test-Path $indexPath) {
  $index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
  $existing = @($index.sets | Where-Object { $_.id -ne $SetId })
} else {
  $existing = @()
}

$custom = [ordered]@{
  id = $SetId
  label = $Label
  sheet = $SheetName
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  objects = $objects
}

$index = [ordered]@{
  sets = @($custom) + $existing
}
$index | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $indexPath

Write-Output "${Label}: exported $($objects.Count) objects"
Write-Output ($objects | ForEach-Object { "$($_.slot): frame $($_.srcFrame)" })
