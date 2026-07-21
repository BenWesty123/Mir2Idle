#!/usr/bin/env pwsh
# Manectric King (229) - Crystal-accurate attack FX (west / MirDirection.Left = 6):
#   Attack1 DrawBlend:  440 + FrameIndex + Dir*6  -> west 476..481  (body aura)
#   Attack2 DrawBlend:  576 + FrameIndex + Dir*8  -> west 624..631  (line beam)
#   Attack2 Effect:     640 + Dir*10, 10 frames   -> west 700..709  (secondary bolt)
#   AttackRange1 Effect:720, 12 frames            -> mass-burst explosion (projectile)
#
# Idle wiring: attack1Blend = Attack1 aura; castEffect = Attack2 line beam (time-based).
# Mass-burst path clears castEffect and uses projectile 720; line path plays castEffect.
#
# IMPORTANT: projectile frames are always re-extracted from the Crystal lib and packed with
# sheetX. Do NOT rely on leftover slot columns on the existing PNG — an earlier FX rebuild
# cropped slots 45-56 and made the AOE explosion invisible.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 229,
  [int]$Direction = 6,
  [int]$Attack1BlendBase = 440,
  [int]$Attack1BlendCount = 6,
  [int]$Attack1BlendOffset = 6,
  [int]$Attack2BlendBase = 576,
  [int]$Attack2BlendCount = 8,
  [int]$Attack2BlendOffset = 8,
  [int]$ProjectileBase = 720,
  [int]$ProjectileCount = 12,
  [int]$CastInterval = 100
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
  if ($prop.Name -in @(
    "attack1Blend", "attack2Blend", "attackRange1Blend",
    "attackNorthWestBlend", "attackSouthWestBlend",
    "attackRangeNorthWestBlend", "attackRangeSouthWestBlend"
  )) { continue }
  $actions[$prop.Name] = $prop.Value
}

# Body occupies fixed slot columns from action frames only (not projectile).
$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in @($action.Value.frames)) {
    if ($null -ne $frame.slot) {
      $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
    }
  }
}
$bodyWidth = $baseSlots * $slotWidth

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

$attack1Start = $Attack1BlendBase + ($Direction * $Attack1BlendOffset)
$attack2Start = $Attack2BlendBase + ($Direction * $Attack2BlendOffset)

$packed = [System.Collections.Generic.List[object]]::new()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  for ($i = 0; $i -lt $ProjectileCount; $i++) {
    $src = $ProjectileBase + $i
    $packed.Add([pscustomobject]@{ kind = "projectile"; meta = (Read-FrameMeta $lib $src); srcFrame = $src }) | Out-Null
  }
  for ($i = 0; $i -lt $Attack1BlendCount; $i++) {
    $src = $attack1Start + $i
    $packed.Add([pscustomobject]@{ kind = "attack1Blend"; meta = (Read-FrameMeta $lib $src); srcFrame = $src }) | Out-Null
  }
  for ($i = 0; $i -lt $Attack2BlendCount; $i++) {
    $src = $attack2Start + $i
    $packed.Add([pscustomobject]@{ kind = "castEffect"; meta = (Read-FrameMeta $lib $src); srcFrame = $src }) | Out-Null
  }
}
finally {
  $lib.Dispose()
}

$drawable = @($packed | Where-Object { $null -ne $_.meta })
if ($drawable.Count -eq 0) { throw "No drawable Manectric King FX frames" }
$projectileDrawable = @($packed | Where-Object { $_.kind -eq "projectile" -and $null -ne $_.meta })
if ($projectileDrawable.Count -eq 0) { throw "No drawable mass-burst projectile frames (720+)" }

$sheetHeight = $slotHeight
foreach ($entry in $drawable) { $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h) }

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$newWidth = $bodyWidth
foreach ($entry in $drawable) { $newWidth += [int]$entry.meta.w }

$projectileJson = [System.Collections.Generic.List[object]]::new()
$attack1Json = [System.Collections.Generic.List[object]]::new()
$castJson = [System.Collections.Generic.List[object]]::new()

try {
  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $copyW = [Math]::Min($bodyWidth, $existingCopy.Width)
    $copyH = [Math]::Min($sheetHeight, $existingCopy.Height)
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new(0, 0, $copyW, $copyH),
      [System.Drawing.Rectangle]::new(0, 0, $copyW, $copyH),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    $sheetX = $bodyWidth
    foreach ($entry in $packed) {
      if ($null -eq $entry.meta) {
        $empty = [ordered]@{ srcFrame = $entry.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
        if ($entry.kind -eq "projectile") { $projectileJson.Add($empty) | Out-Null }
        elseif ($entry.kind -eq "attack1Blend") { $attack1Json.Add($empty) | Out-Null }
        else { $castJson.Add($empty) | Out-Null }
        continue
      }
      $m = $entry.meta
      $frameJson = [ordered]@{
        sheetX = $sheetX
        srcFrame = $m.srcFrame
        w = $m.w
        h = $m.h
        offsetX = $m.offsetX
        offsetY = $m.offsetY
      }
      if ($entry.kind -eq "projectile") { $projectileJson.Add($frameJson) | Out-Null }
      elseif ($entry.kind -eq "attack1Blend") { $attack1Json.Add($frameJson) | Out-Null }
      else { $castJson.Add($frameJson) | Out-Null }
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

$actions["attack1Blend"] = [ordered]@{
  interval = 100
  frames = @($attack1Json.ToArray())
}

# Preserve targetBurst timing from the prior atlas when present.
$prevProj = $atlas.projectile
$projectileOut = [ordered]@{
  style = if ($prevProj.style) { $prevProj.style } else { "targetBurst" }
  anchor = if ($prevProj.anchor) { $prevProj.anchor } else { "boss" }
  interval = if ($null -ne $prevProj.interval) { [int]$prevProj.interval } else { 100 }
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  frameSlotWidth = $slotWidth
  frameSlotHeight = $slotHeight
  delayMs = if ($null -ne $prevProj.delayMs) { [int]$prevProj.delayMs } else { 0 }
  moveDurationMs = if ($null -ne $prevProj.moveDurationMs) { [int]$prevProj.moveDurationMs } else { 500 }
  burstDelayMs = if ($null -ne $prevProj.burstDelayMs) { [int]$prevProj.burstDelayMs } else { 150 }
  burstDurationMs = if ($null -ne $prevProj.burstDurationMs) { [int]$prevProj.burstDurationMs } else { 1200 }
  frames = @($projectileJson.ToArray())
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
    interval = $CastInterval
    frames = @($castJson.ToArray())
  }
  projectile = $projectileOut
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Manectric King {0}: projectile {1}..{2} ({3} frames), attack1Blend {4}..{5}, castEffect {6}..{7}, body {8}px + FX to {9}px, sheetH={10}" -f `
  $Index, $ProjectileBase, ($ProjectileBase + $ProjectileCount - 1), $projectileJson.Count, `
  $attack1Start, ($attack1Start + $Attack1BlendCount - 1), `
  $attack2Start, ($attack2Start + $Attack2BlendCount - 1), `
  $bodyWidth, $newWidth, $sheetHeight)
