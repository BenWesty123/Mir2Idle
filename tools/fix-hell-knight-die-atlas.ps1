#!/usr/bin/env pwsh
# Hell Knights (243-246) - fix truncated die clips.
#
# Crystal client uses DefaultMonster frames for HellKnight1-4:
#   Die  Frame(144, 10, 0, 100)  -> west = 204..213
#   Dead Frame(153, 1, 9, 1000) -> west = 213
#   Revive = die reversed
#
# The .Lib embedded FrameSet incorrectly says die count=4 / offset=4
# (west 168..171), so UseLibFrames exports look like they "stand" / barely
# collapse. Rebuild die/dead/revive from DefaultMonster and keep the rest.
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

function Get-DefaultMonsterDieActions([int]$Dir) {
  $dieSrc = @()
  for ($i = 0; $i -lt 10; $i++) { $dieSrc += (144 + ($Dir * 10) + $i) }
  $reviveSrc = @()
  for ($i = 0; $i -lt 10; $i++) { $reviveSrc += $dieSrc[(9 - $i)] }
  return [ordered]@{
    die = @{ interval = 100; srcFrames = $dieSrc }
    dead = @{ interval = 1000; srcFrames = @($dieSrc[9]) }
    revive = @{ interval = 100; srcFrames = $reviveSrc }
  }
}

function Clone-NonSlotFrameProps($frame) {
  $copy = [ordered]@{}
  foreach ($prop in $frame.PSObject.Properties) {
    if ($prop.Name -eq "slot") { continue }
    $copy[$prop.Name] = $prop.Value
  }
  return $copy
}

foreach ($index in $Indexes) {
  $atlasPath = Join-Path $MonsterRoot "$index.json"
  $pngPath = Join-Path $MonsterRoot "$index.png"
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
  if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight
  $sheetHeight = if ($atlas.sheetHeight) { [int]$atlas.sheetHeight } else { $slotHeight }
  $dir = if ($null -ne $atlas.direction) { [int]$atlas.direction } else { $Direction }
  $dieActions = Get-DefaultMonsterDieActions $dir

  $oldDie = $atlas.actions.die
  $oldDead = $atlas.actions.dead
  $oldRevive = $atlas.actions.revive
  if (-not $oldDie -or -not $oldDie.frames -or @($oldDie.frames).Count -lt 1) {
    throw "$index missing die action"
  }

  $dieStartSlot = [int]$oldDie.frames[0].slot
  $oldDieCount = @($oldDie.frames).Count
  $oldDeadCount = if ($oldDead -and $oldDead.frames) { @($oldDead.frames).Count } else { 0 }
  $oldReviveCount = if ($oldRevive -and $oldRevive.frames) { @($oldRevive.frames).Count } else { 0 }
  $oldBlockSlots = $oldDieCount + $oldDeadCount + $oldReviveCount
  $newDieCount = 10
  $newDeadCount = 1
  $newReviveCount = 10
  $newBlockSlots = $newDieCount + $newDeadCount + $newReviveCount
  $slotDelta = $newBlockSlots - $oldBlockSlots
  $expectedDie0 = 144 + ($dir * 10)
  if ($slotDelta -eq 0 -and $oldDieCount -eq 10 -and ([int]$oldDie.frames[0].srcFrame) -eq $expectedDie0) {
    Write-Host "Monster $index die already DefaultMonster west - skip"
    continue
  }

  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  $newDieFrames = New-Object System.Collections.Generic.List[object]
  try {
    $slot = $dieStartSlot
    foreach ($actionName in @("die", "dead", "revive")) {
      $spec = $dieActions[$actionName]
      $i = 0
      foreach ($src in @($spec.srcFrames)) {
        $image = $lib.ReadImage([int]$src)
        if ($null -eq $image) { throw "$index missing lib frame $src for $actionName[$i]" }
        $clone = [System.Drawing.Bitmap]::new($image.Bitmap)
        $newDieFrames.Add([pscustomobject]@{
          action = $actionName
          slot = $slot
          srcFrame = [int]$src
          interval = [int]$spec.interval
          Bitmap = $clone
          w = $clone.Width
          h = $clone.Height
          offsetX = $image.OffsetX
          offsetY = $image.OffsetY
        }) | Out-Null
        $image.Dispose()
        $slot += 1
        $i += 1
      }
    }
  }
  finally {
    $lib.Dispose()
  }

  $oldBodyWidth = if ($atlas.bodyWidth) { [int]$atlas.bodyWidth } else {
    $maxSlot = -1
    foreach ($prop in $atlas.actions.PSObject.Properties) {
      if ($prop.Name -match "Blend$") { continue }
      foreach ($f in @($prop.Value.frames)) {
        if ($null -ne $f.slot) { $maxSlot = [Math]::Max($maxSlot, [int]$f.slot) }
      }
    }
    ($maxSlot + 1) * $slotWidth
  }
  $fxShift = $slotDelta * $slotWidth
  $newBodyWidth = $oldBodyWidth + $fxShift

  $existing = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
  $existingCopy = [System.Drawing.Bitmap]::new($existing)
  $existing.Dispose()
  $oldSheetWidth = $existingCopy.Width
  $fxRegionWidth = [Math]::Max(0, $oldSheetWidth - $oldBodyWidth)
  $newWidth = $newBodyWidth + $fxRegionWidth
  $outHeight = [Math]::Max($sheetHeight, $existingCopy.Height)

  try {
    $sheet = [System.Drawing.Bitmap]::new($newWidth, $outHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $g.Clear([System.Drawing.Color]::Transparent)
      $copyH = [Math]::Min($outHeight, $existingCopy.Height)
      $beforeW = $dieStartSlot * $slotWidth
      if ($beforeW -gt 0) {
        $g.DrawImage(
          $existingCopy,
          [System.Drawing.Rectangle]::new(0, 0, $beforeW, $copyH),
          [System.Drawing.Rectangle]::new(0, 0, $beforeW, $copyH),
          [System.Drawing.GraphicsUnit]::Pixel
        )
      }
      foreach ($frame in $newDieFrames) {
        $g.DrawImage($frame.Bitmap, [int]$frame.slot * $slotWidth, 0, $frame.w, $frame.h)
      }
      $oldAfterStart = ($dieStartSlot + $oldBlockSlots) * $slotWidth
      $oldAfterWidth = $oldBodyWidth - $oldAfterStart
      if ($oldAfterWidth -gt 0) {
        $newAfterStart = ($dieStartSlot + $newBlockSlots) * $slotWidth
        $g.DrawImage(
          $existingCopy,
          [System.Drawing.Rectangle]::new($newAfterStart, 0, $oldAfterWidth, $copyH),
          [System.Drawing.Rectangle]::new($oldAfterStart, 0, $oldAfterWidth, $copyH),
          [System.Drawing.GraphicsUnit]::Pixel
        )
      }
      if ($fxRegionWidth -gt 0) {
        $g.DrawImage(
          $existingCopy,
          [System.Drawing.Rectangle]::new($newBodyWidth, 0, $fxRegionWidth, $copyH),
          [System.Drawing.Rectangle]::new($oldBodyWidth, 0, $fxRegionWidth, $copyH),
          [System.Drawing.GraphicsUnit]::Pixel
        )
      }

      $tempPath = "$pngPath.tmp.png"
      $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
    }
    finally {
      $g.Dispose()
      $sheet.Dispose()
    }
  }
  finally {
    $existingCopy.Dispose()
    foreach ($frame in $newDieFrames) { $frame.Bitmap.Dispose() }
  }

  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    $name = $prop.Name
    if ($name -eq "die" -or $name -eq "dead" -or $name -eq "revive") { continue }

    if ($name -match "Blend$") {
      $frames = @()
      foreach ($f in @($prop.Value.frames)) {
        $copy = Clone-NonSlotFrameProps $f
        if ($null -ne $f.sheetX) {
          $copy.sheetX = [int]$f.sheetX + $fxShift
        } elseif ($null -ne $f.slot) {
          $copy.sheetX = ([int]$f.slot * $slotWidth) + $fxShift
        }
        $frames += $copy
      }
      $actions[$name] = [ordered]@{
        interval = $prop.Value.interval
        frames = $frames
      }
      continue
    }

    $frames = @()
    foreach ($f in @($prop.Value.frames)) {
      $copy = [ordered]@{}
      foreach ($fp in $f.PSObject.Properties) { $copy[$fp.Name] = $fp.Value }
      if ($null -ne $f.slot -and [int]$f.slot -ge ($dieStartSlot + $oldBlockSlots)) {
        $copy.slot = [int]$f.slot + $slotDelta
      }
      $frames += $copy
    }
    $actions[$name] = [ordered]@{
      interval = $prop.Value.interval
      frames = $frames
    }
  }

  foreach ($actionName in @("die", "dead", "revive")) {
    $group = @($newDieFrames | Where-Object { $_.action -eq $actionName })
    $jsonFrames = @()
    foreach ($frame in $group) {
      $jsonFrames += [ordered]@{
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
      frames = $jsonFrames
    }
  }

  $ordered = [ordered]@{}
  foreach ($key in @("standing", "walking", "attack1", "struck", "die", "dead", "revive", "attackRange1")) {
    if ($actions.Contains($key)) { $ordered[$key] = $actions[$key] }
  }
  foreach ($key in @($actions.Keys)) {
    if (-not $ordered.Contains($key)) { $ordered[$key] = $actions[$key] }
  }

  $output = [ordered]@{
    layer = $atlas.layer
    index = $atlas.index
    direction = $dir
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    sheetHeight = $outHeight
    bodyWidth = $newBodyWidth
    actions = $ordered
  }
  if ($atlas.castEffect) { $output.castEffect = $atlas.castEffect }
  if ($atlas.projectile) { $output.projectile = $atlas.projectile }
  if ($atlas.drawBlend) { $output.drawBlend = $atlas.drawBlend }

  $json = $output | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($atlasPath, $json, $utf8NoBom)
  $msg = "Monster $index : die ${oldDieCount}f to 10f (src $($dieActions.die.srcFrames[0])..$($dieActions.die.srcFrames[9])), bodyWidth $oldBodyWidth to $newBodyWidth"
  Write-Host $msg
}
