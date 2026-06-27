#!/usr/bin/env pwsh
# Witch Doctor (220) — Crystal-accurate combat FX:
#   AttackRange1 cast @304 x9 @100ms on caster | targetBurst @318 x10 @60ms on target
#   (Crystal: ObjectRangeAttack + Effect 304-312; hit 318-327 @600ms — not Attack1 blend)
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 220
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

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($prop.Name -eq "attack1Blend" -or $prop.Name -eq "attackRange1Blend") { continue }
  $actions[$prop.Name] = $prop.Value
}

$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in $action.Value.frames) {
    $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
  }
}

$castSrc = 304..312
$hitSrc = 318..327

function Read-FrameMeta($lib, [int]$srcFrame) {
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
  foreach ($src in $castSrc) {
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { Write-Warning "Missing cast frame $src"; continue }
    $packed += [pscustomobject]@{ kind = "cast"; meta = $meta }
  }
  foreach ($src in $hitSrc) {
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { Write-Warning "Missing hit frame $src"; continue }
    $packed += [pscustomobject]@{ kind = "hit"; meta = $meta }
  }
}
finally {
  $lib.Dispose()
}

if ($packed.Count -lt 2) { throw "Could not read Witch Doctor FX frames from lib" }

$bodyWidth = $baseSlots * $slotWidth
$sheetHeight = $slotHeight
foreach ($entry in $packed) {
  $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h)
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$sheetX = $bodyWidth
$castJson = @()
$hitJson = @()
try {
  $newWidth = $bodyWidth
  foreach ($entry in $packed) { $newWidth += [int]$entry.meta.w }

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

    foreach ($entry in $packed) {
      $m = $entry.meta
      $frameJson = [ordered]@{
        sheetX = $sheetX
        srcFrame = $m.srcFrame
        w = $m.w
        h = $m.h
        offsetX = $m.offsetX
        offsetY = $m.offsetY
      }
      if ($entry.kind -eq "cast") { $castJson += $frameJson } else { $hitJson += $frameJson }

      $graphics.DrawImage($m.image.Bitmap, $sheetX, 0, $m.w, $m.h)
      $sheetX += [int]$m.w
      $m.image.Dispose()
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

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetHeight = $sheetHeight
  bodyWidth = $bodyWidth
  actions = $actions
  castEffect = [ordered]@{
    interval = 100
    frames = @($castJson)
  }
  projectile = [ordered]@{
    style = "targetBurst"
    anchor = "target"
    interval = 60
    delayMs = 0
    moveDurationMs = 900
    burstDurationMs = 600
    frames = @($hitJson)
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Witch Doctor $Index : body ${bodyWidth}px + FX packed to ${newWidth}px wide, sheetH=$sheetHeight"
