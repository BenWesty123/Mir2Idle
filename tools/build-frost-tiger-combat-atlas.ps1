#!/usr/bin/env pwsh
# Frost Tiger (102) — Crystal-accurate ranged kit:
#   AttackRange1 body dir 6 @ lib 224 + 6*6 (260..265)
#   NO caster overlay — Mon102 304x10 is MirAction.Die, not the spit
#   Magic2 projectile CreateProjectile(410, Magic2, true, 4, 30, 6)
#     index = 410 + dir16*(4+6) + frame
#     idle west (enemy on the right → player) dir16=12 => 530..533
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 102,
  [int]$Direction = 6,
  [int]$Dir16 = 12
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
$magic2 = Join-Path $DataRoot "Magic2.Lib"
if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }
if (-not (Test-Path -LiteralPath $magic2)) { throw "Missing Magic2.Lib: $magic2" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($prop.Name -in @("attack1Blend", "attackRange1Blend")) { continue }
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

$needRange = -not $actions.Contains("attackRange1") -or @($actions["attackRange1"].frames).Count -lt 6
$rangeSrc = @()
for ($i = 0; $i -lt 6; $i++) { $rangeSrc += (224 + ($Direction * 6) + $i) }
# Crystal Missile.Draw: 410 + (frame % 4) + dir16 * (skip 6 + count 4)
$projSrc = @()
for ($i = 0; $i -lt 4; $i++) { $projSrc += (410 + ($Dir16 * 10) + $i) }

$rangePacked = @()
$projPacked = @()

if ($needRange) {
  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  try {
    foreach ($src in $rangeSrc) {
      $meta = Read-FrameMeta $lib $src
      if ($null -eq $meta) { throw "Missing AttackRange1 frame $src" }
      $rangePacked += $meta
    }
  }
  finally {
    $lib.Dispose()
  }
}

$magicLib = [PhaseMonsterLib]::new((Resolve-Path $magic2))
try {
  foreach ($src in $projSrc) {
    $meta = Read-FrameMeta $magicLib $src
    if ($null -eq $meta) { throw "Missing Magic2 projectile frame $src" }
    $projPacked += $meta
  }
}
finally {
  $magicLib.Dispose()
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$rangeCount = $rangePacked.Count
$newBodySlots = $baseSlots + $rangeCount
$bodyWidth = $newBodySlots * $slotWidth
$sheetHeight = [Math]::Max($slotHeight, $existingCopy.Height)
foreach ($meta in ($rangePacked + $projPacked)) {
  $sheetHeight = [Math]::Max($sheetHeight, [int]$meta.h)
}

$fxWidth = 0
foreach ($meta in $projPacked) { $fxWidth += [int]$meta.w }
$newWidth = $bodyWidth + $fxWidth

$rangeJson = @()
$projJson = @()

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
    foreach ($m in $projPacked) {
      $projJson += [ordered]@{
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

if ($rangeJson.Count -gt 0) {
  $actions["attackRange1"] = [ordered]@{
    interval = 100
    frames = @($rangeJson)
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
  projectile = [ordered]@{
    style = "travel"
    interval = 30
    frames = @($projJson)
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Frost Tiger {0}: attackRange1 kept={1} packed={2}, projectile {3} (Magic2 {4}..{5}), body {6}px + FX to {7}px, sheetH={8}" -f `
  $Index, (-not $needRange), $rangeJson.Count, $projJson.Count, $projSrc[0], $projSrc[-1], $bodyWidth, $newWidth, $sheetHeight)
