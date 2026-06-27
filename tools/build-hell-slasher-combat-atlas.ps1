#!/usr/bin/env pwsh
# Hell Slasher (215) — Crystal-accurate directional slash FX:
#   DrawBlend (304 + FrameIndex + Direction * 4) - 2 on attack frames 2-5 only.
#   attack1Blend dir 6 (west) | attackSouthWestBlend dir 5 | attackNorthWestBlend dir 7
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 215,
  [int]$FxBase = 304
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
$attackCount = @($atlas.actions.attack1.frames).Count
if ($attackCount -le 0) { throw "$Index has no attack1 frames" }

$blendSkip = @(
  "attack1Blend", "attackNorthWestBlend", "attackSouthWestBlend",
  "attackRange1Blend", "standingBlend", "walkingBlend", "dieBlend"
)

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($blendSkip -contains $prop.Name) { continue }
  $actions[$prop.Name] = $prop.Value
}

$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in $action.Value.frames) {
    $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
  }
}

function Get-BlendSrcFrame([int]$dir, [int]$attackFrameIndex) {
  if ($attackFrameIndex -lt 2 -or $attackFrameIndex -ge 6) { return -1 }
  return $FxBase + $attackFrameIndex + ($dir * 4) - 2
}

$blendDefs = @(
  @{ name = "attack1Blend"; dir = 6 }
  @{ name = "attackSouthWestBlend"; dir = 5 }
  @{ name = "attackNorthWestBlend"; dir = 7 }
)

function Read-FrameMeta($lib, [int]$srcFrame) {
  if ($srcFrame -lt 0) { return $null }
  $image = $lib.ReadImage($srcFrame)
  if ($null -eq $image) { return $null }
  return [pscustomobject]@{
    srcFrame = $srcFrame
    w = $image.Bitmap.Width
    h = $image.Bitmap.Height
    offsetX = $image.OffsetX
    offsetY = $image.OffsetY
    image = $image
  }
}

$packed = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  foreach ($def in $blendDefs) {
    for ($i = 0; $i -lt $attackCount; $i++) {
      $src = Get-BlendSrcFrame $def.dir $i
      if ($src -lt 0) {
        $packed += [pscustomobject]@{ blend = $def.name; attackIndex = $i; meta = $null; srcFrame = -1 }
        continue
      }
      $meta = Read-FrameMeta $lib $src
      if ($null -eq $meta) { Write-Warning "$($def.name) missing lib frame $src" }
      $packed += [pscustomobject]@{ blend = $def.name; attackIndex = $i; meta = $meta; srcFrame = $src }
    }
  }
}
finally {
  $lib.Dispose()
}

$drawable = @($packed | Where-Object { $null -ne $_.meta })
if ($drawable.Count -eq 0) { throw "No drawable Hell Slasher blend frames" }

$bodyWidth = $baseSlots * $slotWidth
$sheetHeight = $slotHeight
foreach ($entry in $drawable) {
  $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h)
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$blendJson = [ordered]@{}
foreach ($def in $blendDefs) { $blendJson[$def.name] = @() }

try {
  $newWidth = $bodyWidth
  foreach ($entry in $drawable) { $newWidth += [int]$entry.meta.w }

  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $slotHeight),
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, [Math]::Min($slotHeight, $existingCopy.Height)),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    $sheetX = $bodyWidth
    foreach ($entry in $packed) {
      if ($null -eq $entry.meta) {
        $frameJson = [ordered]@{
          srcFrame = -1
          w = 0
          h = 0
          offsetX = 0
          offsetY = 0
          empty = $true
        }
      }
      else {
        $m = $entry.meta
        $frameJson = [ordered]@{
          sheetX = $sheetX
          srcFrame = $m.srcFrame
          w = $m.w
          h = $m.h
          offsetX = $m.offsetX
          offsetY = $m.offsetY
        }
        $graphics.DrawImage($m.image.Bitmap, $sheetX, 0, $m.w, $m.h)
        $sheetX += [int]$m.w
        $m.image.Dispose()
      }
      $blendJson[$entry.blend] += $frameJson
    }

    $tempPath = "$pngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
finally {
  $existingCopy.Dispose()
}

foreach ($def in $blendDefs) {
  $actions[$def.name] = [ordered]@{
    interval = $atlas.actions.attack1.interval
    frames = @($blendJson[$def.name])
  }
}

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetHeight = $sheetHeight
  bodyWidth = $bodyWidth
  actions = $actions
}
if ($atlas.castEffect) { $output.castEffect = $atlas.castEffect }
if ($atlas.projectile) { $output.projectile = $atlas.projectile }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Hell Slasher $Index : 3 directional slash blends, body ${bodyWidth}px + FX to ${newWidth}px"
