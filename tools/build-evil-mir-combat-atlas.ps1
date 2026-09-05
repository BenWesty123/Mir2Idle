# Evil Mir (Dragon.Lib) — Crystal image 900.
# Body clips are NOT guesses: Dragon.Lib is a v3 lib and embeds its own FrameSet.
# Dump it with: node tools/dump-lib-frames.mjs <path>\Dragon.Lib
#   Standing start=0  count=10 skip=-10 @1000
#   AttackRange1 start=10 count=6 skip=4 @120
#   Struck   start=40 count=2  skip=-2  @200
#   Attack1  start=42 count=8  skip=-8  @120
#   Die      start=42 count=7  skip=-7  @120
#   Dead     start=48 count=1  skip=-1  @1000
#   Revive   start=42 count=7  skip=-7  @120   (no Reverse flag — plays FORWARD)
#
# `skip` matters. The client draws
#   DrawFrame = Start + (Count + Skip) * Direction + FrameIndex
# so (Count + Skip) is the per-direction stride. Every clip above has stride 0 —
# direction-independent — EXCEPT AttackRange1, whose stride is 10. We render this
# monster as Direction 2 (Right, matching the 90 + 2*10 = 110 overlay below), so
# its body block is 30..35, NOT 10..15 (that is Direction 0). The three blocks
# 10..15 / 20..25 / 30..35 are each padded to 10 with 4x1 stubs at 16-19/26-29/36-39,
# and 32/33 reach 392-400px wide where Direction 0's 12/13 are only 332 — using the
# wrong block visibly misaligns the bolt against its overlay.
#
# There is NO death animation and no dead pose. Body frames are fully accounted for
# (0-9 standing, 10-39 AttackRange1 x3 directions, 40-41 struck, 42-49 attack1), and
# Die/Dead just truncate the attack clip, freezing him reared up at 357px instead of
# the 333px standing height. That is deliberate: Server EvilMir.Die() never kills him
# on the DragonLink path — it sets Sleeping and restores full HP after 5 minutes, so
# the intended boss goes DORMANT and reawakens, and never needs to look dead.
# `collapse` below is our own alias for the full 42..49 attack including the final
# settle frame, so our phase-1 transition lowers his head to standing height and goes
# still (dormant) rather than freezing mid-rear.
# Attack1: overlays 60–67 + 68–81, plus rain 230/240/250/260/270 (5 frames).
# AttackRange1 overlay: SetDirection(Left) → Right → 90+2*10 = 110–119 (10 frames).
# Projectile: CreateProjectile(60, 10, 10, 0) dir 12 west → 60+12*10 = 180–189.
# Hit: 200–219.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 900,
  [int]$MaxSheetEdge = 8192
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$libPath = Join-Path $DataRoot "Dragon.Lib"
$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
$fxSheetName = "${Index}-fx.png"
$fxPngPath = Join-Path $MonsterRoot $fxSheetName
if (-not (Test-Path -LiteralPath $libPath)) { throw "Missing $libPath" }
New-Item -ItemType Directory -Force -Path $MonsterRoot | Out-Null

function New-FrameMeta([object]$image, [int]$srcFrame) {
  if ($null -eq $image) {
    return [pscustomobject]@{
      srcFrame = $srcFrame
      empty = $true
      image = $null
      w = 0
      h = 0
      offsetX = 0
      offsetY = 0
    }
  }
  return [pscustomobject]@{
    srcFrame = $srcFrame
    empty = $false
    image = $image
    w = [int]$image.Bitmap.Width
    h = [int]$image.Bitmap.Height
    offsetX = [int]$image.OffsetX
    offsetY = [int]$image.OffsetY
  }
}

function ConvertTo-FrameJson([object]$f) {
  if ($f.empty) {
    return [ordered]@{
      sheetX = 0
      sheetY = 0
      srcFrame = [int]$f.srcFrame
      w = 0
      h = 0
      offsetX = 0
      offsetY = 0
      empty = $true
    }
  }
  return [ordered]@{
    sheetX = [int]$f.sheetX
    sheetY = [int]$f.sheetY
    srcFrame = [int]$f.srcFrame
    w = [int]$f.w
    h = [int]$f.h
    offsetX = [int]$f.offsetX
    offsetY = [int]$f.offsetY
  }
}

function Pack-FrameSheet {
  param(
    [System.Collections.IEnumerable]$Frames,
    [string]$PngPath,
    [int]$MaxEdge
  )

  $list = @($Frames)
  $pad = 1
  $cursorX = 0
  $cursorY = 0
  $rowHeight = 0
  $sheetWidth = 1
  $sheetHeight = 1
  $uniqueBySrc = @{}

  foreach ($f in $list) {
    if ($f.empty -or $f.w -le 0 -or $f.h -le 0) {
      $f | Add-Member -NotePropertyName sheetX -NotePropertyValue 0 -Force
      $f | Add-Member -NotePropertyName sheetY -NotePropertyValue 0 -Force
      continue
    }

    $key = [string]$f.srcFrame
    if ($uniqueBySrc.ContainsKey($key)) {
      $existing = $uniqueBySrc[$key]
      $f | Add-Member -NotePropertyName sheetX -NotePropertyValue $existing.sheetX -Force
      $f | Add-Member -NotePropertyName sheetY -NotePropertyValue $existing.sheetY -Force
      if ($f.image -and $f.image -ne $existing.image) {
        $f.image.Dispose()
        $f.image = $null
      }
      continue
    }

    $placeW = [int]$f.w + $pad
    $placeH = [int]$f.h + $pad
    if ($placeW -gt $MaxEdge -or $placeH -gt $MaxEdge) {
      throw ("Frame {0} ({1}x{2}) exceeds MaxSheetEdge {3}" -f $f.srcFrame, $f.w, $f.h, $MaxEdge)
    }
    if ($cursorX -gt 0 -and ($cursorX + $placeW) -gt $MaxEdge) {
      $cursorX = 0
      $cursorY += $rowHeight
      $rowHeight = 0
    }
    $f | Add-Member -NotePropertyName sheetX -NotePropertyValue $cursorX -Force
    $f | Add-Member -NotePropertyName sheetY -NotePropertyValue $cursorY -Force
    $cursorX += $placeW
    $rowHeight = [Math]::Max($rowHeight, $placeH)
    $sheetWidth = [Math]::Max($sheetWidth, $cursorX)
    $sheetHeight = [Math]::Max($sheetHeight, $cursorY + $rowHeight)
    $uniqueBySrc[$key] = $f
  }

  if ($sheetWidth -gt $MaxEdge -or $sheetHeight -gt $MaxEdge) {
    throw ("Packed sheet {0}x{1} exceeds MaxSheetEdge {2}" -f $sheetWidth, $sheetHeight, $MaxEdge)
  }

  $sheet = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($entry in $uniqueBySrc.GetEnumerator()) {
      $f = $entry.Value
      if ($f.empty -or -not $f.image) { continue }
      $graphics.DrawImage($f.image.Bitmap, [int]$f.sheetX, [int]$f.sheetY, [int]$f.w, [int]$f.h)
      $f.image.Dispose()
      $f.image = $null
    }
    $tempPath = "$PngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -LiteralPath $tempPath -Destination $PngPath -Force
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }

  return [pscustomobject]@{
    sheetWidth = $sheetWidth
    sheetHeight = $sheetHeight
    uniqueCount = $uniqueBySrc.Count
  }
}

$bodySpecs = @(
  @{ action = "standing"; start = 0; count = 10; interval = 1000 },
  @{ action = "attack1"; start = 42; count = 8; interval = 120 },
  @{ action = "attackRange1"; start = 30; count = 6; interval = 120 },
  @{ action = "struck"; start = 40; count = 2; interval = 200 },
  @{ action = "die"; start = 42; count = 7; interval = 120 },
  @{ action = "dead"; start = 48; count = 1; interval = 1000 },
  @{ action = "revive"; start = 42; count = 7; interval = 120 },
  @{ action = "collapse"; start = 42; count = 8; interval = 120 }
)
$blendSpecs = @(
  @{ action = "attack1Blend"; start = 60; count = 8; interval = 120 },
  @{ action = "attackRange1Blend"; start = 110; count = 10; interval = 120 },
  @{ action = "castEffect"; start = 68; count = 14; interval = 120 }
)
$projSrc = @()
for ($i = 0; $i -lt 10; $i++) { $projSrc += (180 + $i) }
$impactSrc = @()
for ($i = 0; $i -lt 20; $i++) { $impactSrc += (200 + $i) }
$rainSrc = @()
foreach ($base in @(230, 240, 250, 260, 270)) {
  for ($i = 0; $i -lt 5; $i++) { $rainSrc += ($base + $i) }
}

$lib = [PhaseMonsterLib]::new((Resolve-Path $libPath))
$bodyPacked = @()
$fxPacked = @()
try {
  foreach ($spec in ($bodySpecs + $blendSpecs)) {
    $clamp = if ($null -ne $spec.clampSrc) { [int]$spec.clampSrc } else { 100000 }
    for ($i = 0; $i -lt $spec.count; $i++) {
      $src = [Math]::Min($spec.start + $i, $clamp)
      $meta = New-FrameMeta ($lib.ReadImage($src)) $src
      $meta | Add-Member -NotePropertyName action -NotePropertyValue $spec.action
      $meta | Add-Member -NotePropertyName interval -NotePropertyValue $spec.interval
      $bodyPacked += $meta
    }
  }
  foreach ($src in $projSrc) {
    $meta = New-FrameMeta ($lib.ReadImage($src)) $src
    $meta | Add-Member -NotePropertyName kind -NotePropertyValue "projectile"
    $fxPacked += $meta
  }
  foreach ($src in $impactSrc) {
    $meta = New-FrameMeta ($lib.ReadImage($src)) $src
    $meta | Add-Member -NotePropertyName kind -NotePropertyValue "impact"
    $fxPacked += $meta
  }
  foreach ($src in $rainSrc) {
    $meta = New-FrameMeta ($lib.ReadImage($src)) $src
    $meta | Add-Member -NotePropertyName kind -NotePropertyValue "massRain"
    $fxPacked += $meta
  }
}
finally {
  $lib.Dispose()
}

$slotWidth = 1
$slotHeight = 1
foreach ($f in $bodyPacked) {
  if ($f.action -in @("standing", "attack1", "attackRange1", "struck", "die", "dead", "revive", "collapse")) {
    $slotWidth = [Math]::Max($slotWidth, [int]$f.w)
    $slotHeight = [Math]::Max($slotHeight, [int]$f.h)
  }
}

$bodySheet = Pack-FrameSheet -Frames $bodyPacked -PngPath $pngPath -MaxEdge $MaxSheetEdge
$fxSheet = Pack-FrameSheet -Frames $fxPacked -PngPath $fxPngPath -MaxEdge $MaxSheetEdge

$actions = [ordered]@{}
$castFrames = @()
$projFrames = @()
$impactFrames = @()
$rainFrames = @()

foreach ($f in $bodyPacked) {
  $frameJson = ConvertTo-FrameJson $f
  if ($f.action -eq "castEffect") {
    $castFrames += ,$frameJson
    continue
  }
  if (-not $actions.Contains($f.action)) {
    $actions[$f.action] = [ordered]@{ interval = [int]$f.interval; frames = @() }
  }
  $actions[$f.action].frames += ,$frameJson
}

foreach ($f in $fxPacked) {
  $frameJson = ConvertTo-FrameJson $f
  if ($f.kind -eq "projectile") { $projFrames += ,$frameJson }
  elseif ($f.kind -eq "impact") { $impactFrames += ,$frameJson }
  elseif ($f.kind -eq "massRain") { $rainFrames += ,$frameJson }
}

$rainVariants = @()
for ($v = 0; $v -lt 5; $v++) {
  $slice = @()
  for ($i = 0; $i -lt 5; $i++) {
    $slice += ,$rainFrames[($v * 5) + $i]
  }
  $rainVariants += ,$slice
}

$output = [ordered]@{
  layer = "monster"
  index = $Index
  direction = 2
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetWidth = [int]$bodySheet.sheetWidth
  sheetHeight = [int]$bodySheet.sheetHeight
  actions = $actions
  drawBlend = $false
  castEffect = [ordered]@{
    interval = 120
    frames = @($castFrames)
  }
  projectile = [ordered]@{
    style = "travel"
    rotate = $false
    drawBlend = $true
    sheet = $fxSheetName
    sheetWidth = [int]$fxSheet.sheetWidth
    sheetHeight = [int]$fxSheet.sheetHeight
    interval = 80
    frames = @($projFrames)
    impactInterval = 30
    impactBurstDurationMs = 600
    impactFrames = @($impactFrames)
  }
  massRain = [ordered]@{
    interval = 80
    durationMs = 400
    variants = @($rainVariants)
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Evil Mir {0}: body {1}x{2} ({3} unique) slot {4}x{5}; fx {6} {7}x{8} ({9} unique)" -f `
  $Index, $bodySheet.sheetWidth, $bodySheet.sheetHeight, $bodySheet.uniqueCount, $slotWidth, $slotHeight, `
  $fxSheetName, $fxSheet.sheetWidth, $fxSheet.sheetHeight, $fxSheet.uniqueCount)
