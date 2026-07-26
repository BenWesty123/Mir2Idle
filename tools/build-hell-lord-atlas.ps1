# Rebuild Hell Lord (247) to match Crystal draw rules.
# Crystal:
#   BodyLibrary uses FrameSet.DefaultMonster for the seated lord (Standing 0-3).
#   Attack1 body frames 80+ are a huge FX sheet with black keys — Crystal still
#   Draw()s them as body, but in our canvas they need screen-blend as an OVERLAY
#   while the seated body stays visible (otherwise black outlines / flicker).
#   DrawEffects: frame 15 blade (opaque) on Standing/Attack1/Struck.
#   Die/Dead: frames 16-20 via DrawEffects (DefaultMonster die slots empty in lib).
#   ExtraByte > 3: aura 21-26 (optional stageBlend — not auto-played yet).
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$Index = 247
$libPath = Join-Path $DataRoot "Monster\247.Lib"
if (-not (Test-Path -LiteralPath $libPath)) { throw "Missing HellLord lib: $libPath" }

# Seated body stays on attack; AOE 80-85 goes to attack1Blend (screen-blend).
# Struck lib frame 128 is a sparse FX stub (not the seated lord) — holding seated
# body frames so flinch never swaps him for a near-empty sheet (looks invisible).
$actionSpecs = [ordered]@{
  standing = @{ frames = @(0, 1, 2, 3); interval = 500 }
  walking  = @{ frames = @(0, 1, 2, 3); interval = 200 }
  attack1  = @{ frames = @(0, 0, 0, 0, 0, 0); interval = 100 }
  struck   = @{ frames = @(0, 1); interval = 200 }
  die      = @{ frames = 16..20; interval = 100 }
  dead     = @{ frames = @(20); interval = 1000 }
  revive   = @{ frames = @(20, 19, 18, 17, 16); interval = 100 }
}
$aoeSrc = 80..85
$bladeSrc = @(15)
$auraSrc = 21..26

$lib = [PhaseMonsterLib]::new((Resolve-Path $libPath))
$packedBody = New-Object System.Collections.Generic.List[object]
$packedAoe = New-Object System.Collections.Generic.List[object]
$packedBlade = New-Object System.Collections.Generic.List[object]
$packedAura = New-Object System.Collections.Generic.List[object]
try {
  foreach ($action in $actionSpecs.GetEnumerator()) {
    foreach ($src in @($action.Value.frames)) {
      $image = $lib.ReadImage([int]$src)
      $packedBody.Add([pscustomobject]@{
        action = $action.Key
        interval = [int]$action.Value.interval
        srcFrame = [int]$src
        empty = ($null -eq $image)
        image = $image
        w = if ($image) { $image.Bitmap.Width } else { 0 }
        h = if ($image) { $image.Bitmap.Height } else { 0 }
        offsetX = if ($image) { $image.OffsetX } else { 0 }
        offsetY = if ($image) { $image.OffsetY } else { 0 }
      })
    }
  }
  foreach ($src in $aoeSrc) {
    $image = $lib.ReadImage([int]$src)
    $packedAoe.Add([pscustomobject]@{
      srcFrame = [int]$src
      empty = ($null -eq $image)
      image = $image
      w = if ($image) { $image.Bitmap.Width } else { 0 }
      h = if ($image) { $image.Bitmap.Height } else { 0 }
      offsetX = if ($image) { $image.OffsetX } else { 0 }
      offsetY = if ($image) { $image.OffsetY } else { 0 }
    })
  }
  foreach ($src in $bladeSrc) {
    $image = $lib.ReadImage([int]$src)
    $packedBlade.Add([pscustomobject]@{
      srcFrame = [int]$src
      empty = ($null -eq $image)
      image = $image
      w = if ($image) { $image.Bitmap.Width } else { 0 }
      h = if ($image) { $image.Bitmap.Height } else { 0 }
      offsetX = if ($image) { $image.OffsetX } else { 0 }
      offsetY = if ($image) { $image.OffsetY } else { 0 }
    })
  }
  foreach ($src in $auraSrc) {
    $image = $lib.ReadImage([int]$src)
    $packedAura.Add([pscustomobject]@{
      srcFrame = [int]$src
      empty = ($null -eq $image)
      image = $image
      w = if ($image) { $image.Bitmap.Width } else { 0 }
      h = if ($image) { $image.Bitmap.Height } else { 0 }
      offsetX = if ($image) { $image.OffsetX } else { 0 }
      offsetY = if ($image) { $image.OffsetY } else { 0 }
    })
  }
}
finally { $lib.Dispose() }

$slotWidth = 1
$slotHeight = 1
foreach ($f in $packedBody) {
  if (-not $f.empty) {
    $slotWidth = [Math]::Max($slotWidth, [int]$f.w)
    $slotHeight = [Math]::Max($slotHeight, [int]$f.h)
  }
}
$sheetHeight = $slotHeight
$extraWidth = 0
foreach ($f in @($packedAoe + $packedBlade + $packedAura)) {
  if (-not $f.empty) {
    $extraWidth += [int]$f.w
    $sheetHeight = [Math]::Max($sheetHeight, [int]$f.h)
  }
}
$bodyWidth = $packedBody.Count * $slotWidth
$newWidth = $bodyWidth + $extraWidth

$pngPath = Join-Path $MonsterRoot "$Index.png"
$atlasPath = Join-Path $MonsterRoot "$Index.json"
$sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$actions = [ordered]@{}
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $slot = 0
  foreach ($f in $packedBody) {
    if (-not $f.empty) {
      $graphics.DrawImage($f.image.Bitmap, $slot * $slotWidth, 0, $f.w, $f.h)
      $f.image.Dispose()
    }
    if (-not $actions.Contains($f.action)) {
      $actions[$f.action] = [ordered]@{ interval = $f.interval; frames = @() }
    }
    $actions[$f.action].frames += $(if ($f.empty) {
      [ordered]@{ slot = $slot; srcFrame = $f.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
    } else {
      [ordered]@{ slot = $slot; srcFrame = $f.srcFrame; w = $f.w; h = $f.h; offsetX = $f.offsetX; offsetY = $f.offsetY }
    })
    $slot += 1
  }

  $sheetX = $bodyWidth

  function Add-SheetFrames($list, [ref]$xRef) {
    $frames = @()
    foreach ($f in $list) {
      if ($f.empty) {
        $frames += [ordered]@{ sheetX = $xRef.Value; srcFrame = $f.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
        continue
      }
      $graphics.DrawImage($f.image.Bitmap, $xRef.Value, 0, $f.w, $f.h)
      $frames += [ordered]@{
        sheetX = $xRef.Value; srcFrame = $f.srcFrame; w = $f.w; h = $f.h
        offsetX = $f.offsetX; offsetY = $f.offsetY
      }
      $xRef.Value += [int]$f.w
      $f.image.Dispose()
    }
    return ,$frames
  }

  $x = $sheetX
  $aoeFrames = Add-SheetFrames $packedAoe ([ref]$x)
  $bladeFrames = Add-SheetFrames $packedBlade ([ref]$x)
  $auraFrames = Add-SheetFrames $packedAura ([ref]$x)

  # AOE attack FX — drawn via attack1Blend with screen-blend (removes black keys).
  $actions["attack1Blend"] = [ordered]@{ interval = 100; frames = @($aoeFrames) }
  $actions["standingBlade"] = [ordered]@{ interval = 1000; frames = @($bladeFrames) }
  $actions["walkingBlade"] = [ordered]@{ interval = 1000; frames = @($bladeFrames) }
  $actions["attack1Blade"] = [ordered]@{ interval = 1000; frames = @($bladeFrames) }
  # Stage aura kept for later ExtraByte wiring — not hooked to standingBlend.
  $actions["stageBlend"] = [ordered]@{ interval = 100; frames = @($auraFrames) }

  $temp = "$pngPath.tmp.png"
  $sheet.Save($temp, [System.Drawing.Imaging.ImageFormat]::Png)
  Move-Item -LiteralPath $temp -Destination $pngPath -Force
}
finally {
  $graphics.Dispose()
  $sheet.Dispose()
}

$output = [ordered]@{
  layer = "monster"
  index = $Index
  direction = 0
  drawBlend = $false
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetHeight = $sheetHeight
  bodyWidth = $bodyWidth
  actions = $actions
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Hell Lord {0}: seated body + blended AOE 80-85 + blade → {1}x{2}" -f $Index, $newWidth, $sheetHeight)
