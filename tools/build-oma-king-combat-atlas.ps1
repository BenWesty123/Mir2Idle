#!/usr/bin/env pwsh
# Oma King / Oma King Spirit (126) — Crystal DrawBlend attack FX.
#   Attack2 body (mass-burst / CompleteAttack): dir 6 @ 464 + 6*20 = 584..603
#   Attack2 blend (non-directional): 656 + FrameIndex  (656..675)
#   Attack1 blend dir 6, FrameIndex >= 3: 624 + FI + 6*4 - 3 = 648,649,650
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 126,
  [int]$Direction = 6
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
  if ($prop.Name -in @("attack1Blend", "attackRange1Blend", "attackRange1")) { continue }
  $actions[$prop.Name] = $prop.Value
}

$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in $action.Value.frames) {
    $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
  }
}

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

$rangeSrc = @()
for ($i = 0; $i -lt 20; $i++) { $rangeSrc += (464 + ($Direction * 20) + $i) }
$rangeBlendSrc = @()
for ($i = 0; $i -lt 20; $i++) { $rangeBlendSrc += (656 + $i) }
# Pad Attack1 blend to the 6-frame melee clip; Crystal only DrawBlend from frame 3.
$meleeBlendSrc = @($null, $null, $null, 648, 649, 650)

$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
$rangePacked = @()
$rangeBlendPacked = @()
$meleeBlendPacked = @()
try {
  foreach ($src in $rangeSrc) {
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { throw "Missing Attack2 body frame $src" }
    $rangePacked += $meta
  }
  foreach ($src in $rangeBlendSrc) {
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { throw "Missing Attack2 blend frame $src" }
    $rangeBlendPacked += $meta
  }
  foreach ($src in $meleeBlendSrc) {
    if ($null -eq $src) {
      $meleeBlendPacked += $null
      continue
    }
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { throw "Missing Attack1 blend frame $src" }
    $meleeBlendPacked += $meta
  }
}
finally {
  $lib.Dispose()
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$rangeCount = $rangePacked.Count
$newBodySlots = $baseSlots + $rangeCount
$bodyWidth = $newBodySlots * $slotWidth
$sheetHeight = [Math]::Max($slotHeight, $existingCopy.Height)
foreach ($meta in ($rangePacked + $rangeBlendPacked + ($meleeBlendPacked | Where-Object { $_ }))) {
  $sheetHeight = [Math]::Max($sheetHeight, [int]$meta.h)
}

$fxWidth = 0
foreach ($meta in $rangeBlendPacked) { $fxWidth += [int]$meta.w }
foreach ($meta in $meleeBlendPacked) {
  if ($null -ne $meta) { $fxWidth += [int]$meta.w }
}
$newWidth = $bodyWidth + $fxWidth

$rangeJson = @()
$rangeBlendJson = @()
$meleeBlendJson = @()

try {
  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $copyW = [Math]::Min($existingCopy.Width, $baseSlots * $slotWidth)
    $copyH = [Math]::Min($slotHeight, $existingCopy.Height)
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new(0, 0, $copyW, $copyH),
      [System.Drawing.Rectangle]::new(0, 0, $copyW, $copyH),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    for ($i = 0; $i -lt $rangePacked.Count; $i++) {
      $m = $rangePacked[$i]
      $slot = $baseSlots + $i
      $graphics.DrawImage($m.image.Bitmap, $slot * $slotWidth, 0, $m.w, $m.h)
      $rangeJson += [ordered]@{
        slot = $slot
        srcFrame = $m.srcFrame
        w = $m.w
        h = $m.h
        offsetX = $m.offsetX
        offsetY = $m.offsetY
      }
      $m.image.Dispose()
    }

    $sheetX = $bodyWidth
    foreach ($m in $rangeBlendPacked) {
      $rangeBlendJson += [ordered]@{
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
    foreach ($m in $meleeBlendPacked) {
      if ($null -eq $m) {
        $meleeBlendJson += [ordered]@{ empty = $true; w = 0; h = 0; offsetX = 0; offsetY = 0 }
        continue
      }
      $meleeBlendJson += [ordered]@{
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

$actions["attackRange1"] = [ordered]@{
  interval = 100
  frames = @($rangeJson)
}
$actions["attackRange1Blend"] = [ordered]@{
  interval = 100
  frames = @($rangeBlendJson)
}
$actions["attack1Blend"] = [ordered]@{
  interval = 100
  frames = @($meleeBlendJson)
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
  # Idle lane puts the party off the king, so replay Attack2 DrawBlend on each
  # hit target. Crystal itself only DrawBlends at the monster's DrawLocation.
  projectile = [ordered]@{
    style = "burst"
    anchor = "targets"
    spawnAt = "start"
    drawBlend = $true
    scale = 1.25
    interval = 100
    burstDurationMs = $rangeBlendJson.Count * 100
    frames = @($rangeBlendJson)
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Oma King {0}: attackRange1 x{1} (584..603), Attack2 blend x{2} (656..675), Attack1 blend 648-650, sheet {3}x{4}" -f `
  $Index, $rangeJson.Count, $rangeBlendJson.Count, $newWidth, $sheetHeight)
