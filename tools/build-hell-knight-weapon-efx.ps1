#!/usr/bin/env pwsh
# Hell Knights (243-246) — Crystal DrawBlend weapon EFX from each knight's own lib.
# Crystal MonsterObject.cs (HellKnight1-4):
#   Appear/Standing: 224 + FrameIndex + Dir*4
#   Walking:         256 + FrameIndex + Dir*6
#   Attack1:         304 + FrameIndex + Dir*6
#   Struck:          352 + FrameIndex + Dir*2
#   Die:             368 + FrameIndex + Dir*4
#   Attack2:         400 + FrameIndex + Dir*6  (unused in idle)
#
# Packs standing/walking/attack/struck/die blends for west (6) + SW (5) + NW (7),
# plus N/S/E walking blends for swarm directions.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int[]]$Indexes = @(243, 244, 245, 246)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

function Get-NonBlendBaseSlots($actions) {
  $baseSlots = 0
  foreach ($prop in $actions.PSObject.Properties) {
    if ($prop.Name -match "Blend$") { continue }
    foreach ($frame in @($prop.Value.frames)) {
      if ($null -eq $frame.slot) { continue }
      $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
    }
  }
  return $baseSlots
}

function Get-SrcFrame([int]$base, [int]$frameIndex, [int]$dir, [int]$stride) {
  return $base + $frameIndex + ($dir * $stride)
}

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

function Append-HellKnightWeaponEfx([int]$Index) {
  $atlasPath = Join-Path $MonsterRoot "$Index.json"
  $pngPath = Join-Path $MonsterRoot "$Index.png"
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
  if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight

  # Keep non-blend body actions only (rebuild FX each run).
  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($prop.Name -match "Blend$") { continue }
    $actions[$prop.Name] = $prop.Value
  }

  $baseSlots = if ($atlas.bodyWidth -and [int]$atlas.bodyWidth -gt 0) {
    [Math]::Max(1, [int]([Math]::Floor([int]$atlas.bodyWidth / $slotWidth)))
  } else {
    Get-NonBlendBaseSlots ([pscustomobject]$actions)
  }
  $bodyWidth = $baseSlots * $slotWidth

  $standCount = @($actions.standing.frames).Count
  $walkCount = @($actions.walking.frames).Count
  $attackCount = @($actions.attack1.frames).Count
  $struckCount = @($actions.struck.frames).Count
  $dieCount = @($actions.die.frames).Count

  # name, bodyActionForCount, base, stride, dir
  $blendDefs = @(
    @{ name = "standingBlend"; count = $standCount; base = 224; stride = 4; dir = 6; intervalAction = "standing" }
    @{ name = "standingSouthWestBlend"; count = $standCount; base = 224; stride = 4; dir = 5; intervalAction = "standing" }
    @{ name = "standingNorthWestBlend"; count = $standCount; base = 224; stride = 4; dir = 7; intervalAction = "standing" }
    @{ name = "walkingBlend"; count = $walkCount; base = 256; stride = 6; dir = 6; intervalAction = "walking" }
    @{ name = "walkingSouthWestBlend"; count = $walkCount; base = 256; stride = 6; dir = 5; intervalAction = "walking" }
    @{ name = "walkingNorthWestBlend"; count = $walkCount; base = 256; stride = 6; dir = 7; intervalAction = "walking" }
    @{ name = "walkingNorthBlend"; count = $walkCount; base = 256; stride = 6; dir = 0; intervalAction = "walking" }
    @{ name = "walkingSouthBlend"; count = $walkCount; base = 256; stride = 6; dir = 4; intervalAction = "walking" }
    @{ name = "walkingEastBlend"; count = $walkCount; base = 256; stride = 6; dir = 2; intervalAction = "walking" }
    @{ name = "attack1Blend"; count = $attackCount; base = 304; stride = 6; dir = 6; intervalAction = "attack1" }
    @{ name = "attackSouthWestBlend"; count = $attackCount; base = 304; stride = 6; dir = 5; intervalAction = "attack1" }
    @{ name = "attackNorthWestBlend"; count = $attackCount; base = 304; stride = 6; dir = 7; intervalAction = "attack1" }
    @{ name = "attackRange1Blend"; count = $attackCount; base = 304; stride = 6; dir = 6; intervalAction = "attack1" }
    @{ name = "attackRangeSouthWestBlend"; count = $attackCount; base = 304; stride = 6; dir = 5; intervalAction = "attack1" }
    @{ name = "attackRangeNorthWestBlend"; count = $attackCount; base = 304; stride = 6; dir = 7; intervalAction = "attack1" }
    @{ name = "struckBlend"; count = $struckCount; base = 352; stride = 2; dir = 6; intervalAction = "struck" }
    @{ name = "dieBlend"; count = $dieCount; base = 368; stride = 4; dir = 6; intervalAction = "die" }
  )

  $packed = @()
  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  try {
    foreach ($def in $blendDefs) {
      for ($i = 0; $i -lt [int]$def.count; $i++) {
        $src = Get-SrcFrame ([int]$def.base) $i ([int]$def.dir) ([int]$def.stride)
        $meta = Read-FrameMeta $lib $src
        if ($null -eq $meta) {
          Write-Warning "$Index $($def.name)[$i] missing lib frame $src"
        }
        $packed += [pscustomobject]@{
          blend = $def.name
          attackIndex = $i
          meta = $meta
          srcFrame = $src
          intervalAction = $def.intervalAction
        }
      }
    }
  }
  finally {
    $lib.Dispose()
  }

  $drawable = @($packed | Where-Object { $null -ne $_.meta })
  if ($drawable.Count -eq 0) { throw "No drawable Hell Knight blend frames for $Index" }

  $existingSheet = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()

  $sheetHeight = $slotHeight
  foreach ($entry in $drawable) {
    $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h)
  }

  $blendJson = [ordered]@{}
  foreach ($def in $blendDefs) { $blendJson[$def.name] = @() }

  try {
    $newWidth = $bodyWidth
    foreach ($entry in $drawable) { $newWidth += [int]$entry.meta.w }

    $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $copyH = [Math]::Min($slotHeight, $existingCopy.Height)
      $copyW = [Math]::Min($bodyWidth, $existingCopy.Width)
      $graphics.DrawImage(
        $existingCopy,
        [System.Drawing.Rectangle]::new(0, 0, $copyW, $copyH),
        [System.Drawing.Rectangle]::new(0, 0, $copyW, $copyH),
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
    $interval = [int]$actions[$def.intervalAction].interval
    if ($interval -le 0) { $interval = 100 }
    $actions[$def.name] = [ordered]@{
      interval = $interval
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
  if ($atlas.PSObject.Properties.Name -contains "ed" -and $atlas.ed) {
    $output.ed = $atlas.ed
  }

  $json = $output | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText((Resolve-Path $atlasPath), $json)
  Write-Host "Hell Knight $Index : weapon EFX $($drawable.Count) frames, body ${bodyWidth}px -> sheet ${newWidth}px"
}

foreach ($index in $Indexes) {
  Append-HellKnightWeaponEfx $index
}

Write-Host "Done. Bump MONSTER_ASSET_VERSION so clients refetch."
