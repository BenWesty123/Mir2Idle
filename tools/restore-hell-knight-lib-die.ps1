#!/usr/bin/env pwsh
# Restore Hell Knight die body to the .Lib FrameSet (count=4, offset=4).
# Crystal uses BodyLibrary.Frames when present - HellKnight libs say:
#   Die  start=144 count=4 skip=0  -> west 168..171
#   Dead start=147 count=1 skip=3  -> west 171
#   Revive reverse of die
# Does not compact the sheet; only rewrites die/dead/revive action frames in-place.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int[]]$Indexes = @(243, 244, 245, 246),
  [int]$Direction = 6
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($index in $Indexes) {
  $atlasPath = Join-Path $MonsterRoot "$index.json"
  $pngPath = Join-Path $MonsterRoot "$index.png"
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  $slotWidth = [int]$atlas.slotWidth
  $dir = if ($null -ne $atlas.direction) { [int]$atlas.direction } else { $Direction }

  $dieStartSlot = [int]$atlas.actions.die.frames[0].slot
  $dieSrc = @(0..3 | ForEach-Object { 144 + ($dir * 4) + $_ })
  $deadSrc = 147 + ($dir * 4)  # Frame(147,1,3) OffSet=4
  $reviveSrc = @($dieSrc[3], $dieSrc[2], $dieSrc[1], $dieSrc[0])

  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  $blit = New-Object System.Collections.Generic.List[object]
  try {
    $slot = $dieStartSlot
    foreach ($pair in @(
      @{ name = "die"; srcs = $dieSrc; interval = 100 },
      @{ name = "dead"; srcs = @($deadSrc); interval = 1000 },
      @{ name = "revive"; srcs = $reviveSrc; interval = 100 }
    )) {
      foreach ($src in @($pair.srcs)) {
        $image = $lib.ReadImage([int]$src)
        if ($null -eq $image) { throw "$index missing frame $src" }
        $clone = [System.Drawing.Bitmap]::new($image.Bitmap)
        $blit.Add([pscustomobject]@{
          action = $pair.name
          interval = $pair.interval
          slot = $slot
          srcFrame = [int]$src
          Bitmap = $clone
          w = $clone.Width
          h = $clone.Height
          offsetX = $image.OffsetX
          offsetY = $image.OffsetY
        }) | Out-Null
        $image.Dispose()
        $slot += 1
      }
    }
  }
  finally {
    $lib.Dispose()
  }

  $existing = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
  $existingCopy = [System.Drawing.Bitmap]::new($existing)
  $existing.Dispose()
  $sheet = [System.Drawing.Bitmap]::new($existingCopy.Width, $existingCopy.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)
    foreach ($frame in $blit) {
      $x = [int]$frame.slot * $slotWidth
      $g.SetClip([System.Drawing.Rectangle]::new($x, 0, $slotWidth, $sheet.Height))
      $g.Clear([System.Drawing.Color]::Transparent)
      $g.ResetClip()
      $g.DrawImage($frame.Bitmap, $x, 0, $frame.w, $frame.h)
    }
    $tempPath = "$pngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $g.Dispose()
    $sheet.Dispose()
    $existingCopy.Dispose()
    foreach ($frame in $blit) { $frame.Bitmap.Dispose() }
  }
  Move-Item -LiteralPath $tempPath -Destination $pngPath -Force

  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($prop.Name -eq "die" -or $prop.Name -eq "dead" -or $prop.Name -eq "revive") { continue }
    $actions[$prop.Name] = $prop.Value
  }
  foreach ($actionName in @("die", "dead", "revive")) {
    $group = @($blit | Where-Object { $_.action -eq $actionName })
    $frames = @()
    foreach ($frame in $group) {
      $frames += [ordered]@{
        slot = [int]$frame.slot
        srcFrame = [int]$frame.srcFrame
        w = [int]$frame.w
        h = [int]$frame.h
        offsetX = [int]$frame.offsetX
        offsetY = [int]$frame.offsetY
      }
    }
    $actions[$actionName] = [ordered]@{
      interval = $group[0].interval
      frames = $frames
    }
  }

  $ordered = [ordered]@{}
  foreach ($key in @("standing", "walking", "attack1", "struck", "die", "dead", "revive", "attackRange1")) {
    if ($actions.Contains($key)) { $ordered[$key] = $actions[$key] }
  }
  foreach ($key in @($actions.Keys)) {
    if (-not $ordered.Contains($key)) { $ordered[$key] = $actions[$key] }
  }

  $output = [ordered]@{}
  foreach ($prop in $atlas.PSObject.Properties) {
    if ($prop.Name -eq "actions") { continue }
    $output[$prop.Name] = $prop.Value
  }
  $output.actions = $ordered

  $json = $output | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($atlasPath, $json, $utf8NoBom)
  Write-Host "Monster $index : restored lib die $($dieSrc[0])..$($dieSrc[3]) (4f), dead $deadSrc"
}
