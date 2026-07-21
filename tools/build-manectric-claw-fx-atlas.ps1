#!/usr/bin/env pwsh
# Manectric Claw (223) - Crystal-accurate ranged attack FX:
#   Client MonsterObject.cs: new Effect(ManectricClaw, 304 + Direction*10, 10, 10*Frame.Interval, this)
#   Self-anchored electric discharge on the caster during its ranged attack.
#   Swarm mobs face West (MirDirection.Left = 6) toward the party -> frames 364-373.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 223,
  [int]$CastBase = 364,
  [int]$CastCount = 10,
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

# Preserve every existing body/directional action; drop any stale FX clips we re-derive.
$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($prop.Name -in @("attack1Blend", "attackRange1Blend", "attackNorthWestBlend", "attackSouthWestBlend", "attackRangeNorthWestBlend", "attackRangeSouthWestBlend")) { continue }
  $actions[$prop.Name] = $prop.Value
}

# Body occupies fixed slot columns; FX gets appended after bodyWidth.
$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in $action.Value.frames) {
    $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
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

$packed = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  for ($i = 0; $i -lt $CastCount; $i++) {
    $src = $CastBase + $i
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { Write-Warning "Missing cast frame $src" }
    $packed += [pscustomobject]@{ meta = $meta; srcFrame = $src }
  }
}
finally {
  $lib.Dispose()
}

$drawable = @($packed | Where-Object { $null -ne $_.meta })
if ($drawable.Count -eq 0) { throw "No drawable Manectric Claw cast frames ($CastBase..$($CastBase + $CastCount - 1))" }

$sheetHeight = $slotHeight
foreach ($entry in $drawable) { $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h) }

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$castJson = @()
$newWidth = $bodyWidth
foreach ($entry in $drawable) { $newWidth += [int]$entry.meta.w }

try {
  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $copyH = [Math]::Min($sheetHeight, $existingCopy.Height)
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $copyH),
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $copyH),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    $sheetX = $bodyWidth
    foreach ($entry in $packed) {
      if ($null -eq $entry.meta) {
        $castJson += [ordered]@{ srcFrame = $entry.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
        continue
      }
      $m = $entry.meta
      $castJson += [ordered]@{ sheetX = $sheetX; srcFrame = $m.srcFrame; w = $m.w; h = $m.h; offsetX = $m.offsetX; offsetY = $m.offsetY }
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
    interval = $CastInterval
    frames = @($castJson)
  }
}
if ($atlas.projectile) { $output.projectile = $atlas.projectile }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Manectric Claw $Index : castEffect $CastCount frames ($CastBase..$($CastBase + $CastCount - 1)), body ${bodyWidth}px + FX to ${newWidth}px, sheetH=$sheetHeight"
