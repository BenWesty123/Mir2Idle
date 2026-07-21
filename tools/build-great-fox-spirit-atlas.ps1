# Export Crystal GreatFoxSpirit (Mon134) using all five Crystal combat stages.
# Body + DrawBlend pack into 134.png; AttackRange1 / SpellEffect hit FX pack into
# a separate 134-fx.png so the main body texture stays far under GPU limits.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$MaxSheetEdge = 8192
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$Index = 134
$FxSheetName = "${Index}-fx.png"
# Crystal Client Frames.cs GreatFoxSpirit levels 0-4 + MonsterObject DrawBlend rules.
$stageStarts = @(
  @{ standing = 0; attack1 = 22; struck = 20 },
  @{ standing = 60; attack1 = 82; struck = 80 },
  @{ standing = 120; attack1 = 142; struck = 140 },
  @{ standing = 180; attack1 = 202; struck = 200 },
  @{ standing = 240; attack1 = 262; struck = 260 }
)
# Crystal AttackRange1 / SpellEffect.GreatFoxSpirit: 375 + (0..2)*20, 20 frames, 1400ms.
$hitVariantStarts = @(375, 395, 415)
$libPath = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
$fxPngPath = Join-Path $MonsterRoot $FxSheetName
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

$bodyPacked = New-Object System.Collections.Generic.List[object]
$hitPacked = New-Object System.Collections.Generic.List[object]
$lib = [PhaseMonsterLib]::new((Resolve-Path $libPath))
try {
  for ($stage = 0; $stage -lt $stageStarts.Count; $stage++) {
    $stageInfo = $stageStarts[$stage]
    $actionSpecs = [ordered]@{
      standing = @{ start = [int]$stageInfo.standing; count = 20; interval = 100; blendStart = [int]$stageInfo.standing + 30 }
      walking = @{ start = [int]$stageInfo.standing; count = 20; interval = 100; blendStart = -1 }
      attack1 = @{ start = [int]$stageInfo.attack1; count = 8; interval = 120; blendStart = [int]$stageInfo.attack1 + 30 }
      struck = @{ start = [int]$stageInfo.struck; count = 2; interval = 200; blendStart = -1 }
      # Crystal DrawBlend for Die uses absolute 318+, not DieStart+30.
      die = @{ start = 300; count = 18; interval = 120; blendStart = 318 }
      dead = @{ start = 317; count = 1; interval = 1000; blendStart = -1 }
    }
    foreach ($action in $actionSpecs.GetEnumerator()) {
      $spec = $action.Value
      for ($i = 0; $i -lt $spec.count; $i++) {
        $src = $spec.start + $i
        $image = $lib.ReadImage($src)
        $meta = New-FrameMeta $image $src
        $bodyPacked.Add([pscustomobject]@{
          stage = $stage
          action = $action.Key
          interval = [int]$spec.interval
          kind = "body"
          srcFrame = $meta.srcFrame
          empty = $meta.empty
          image = $meta.image
          w = $meta.w
          h = $meta.h
          offsetX = $meta.offsetX
          offsetY = $meta.offsetY
        })
      }
      if ($spec.blendStart -ge 0) {
        for ($i = 0; $i -lt $spec.count; $i++) {
          $src = $spec.blendStart + $i
          $image = $lib.ReadImage($src)
          $meta = New-FrameMeta $image $src
          $bodyPacked.Add([pscustomobject]@{
            stage = $stage
            action = "$($action.Key)Blend"
            interval = [int]$spec.interval
            kind = "blend"
            srcFrame = $meta.srcFrame
            empty = $meta.empty
            image = $meta.image
            w = $meta.w
            h = $meta.h
            offsetX = $meta.offsetX
            offsetY = $meta.offsetY
          })
        }
      }
    }
  }

  for ($variant = 0; $variant -lt $hitVariantStarts.Count; $variant++) {
    $start = [int]$hitVariantStarts[$variant]
    for ($i = 0; $i -lt 20; $i++) {
      $src = $start + $i
      $image = $lib.ReadImage($src)
      $meta = New-FrameMeta $image $src
      $hitPacked.Add([pscustomobject]@{
        stage = -1
        action = "hitVariant$variant"
        interval = 70
        kind = "hit"
        variant = $variant
        srcFrame = $meta.srcFrame
        empty = $meta.empty
        image = $meta.image
        w = $meta.w
        h = $meta.h
        offsetX = $meta.offsetX
        offsetY = $meta.offsetY
      })
    }
  }
}
finally { $lib.Dispose() }

$bodyFrames = @($bodyPacked | Where-Object { -not $_.empty })
if ($bodyFrames.Count -eq 0) { throw "No body frames for Great Fox Spirit" }

$slotWidth = 1
$slotHeight = 1
foreach ($f in $bodyFrames) {
  $slotWidth = [Math]::Max($slotWidth, [int]$f.w)
  $slotHeight = [Math]::Max($slotHeight, [int]$f.h)
}

$bodySheet = Pack-FrameSheet -Frames $bodyPacked -PngPath $pngPath -MaxEdge $MaxSheetEdge
$fxSheet = Pack-FrameSheet -Frames $hitPacked -PngPath $fxPngPath -MaxEdge $MaxSheetEdge

$stageActions = @()
for ($i = 0; $i -lt $stageStarts.Count; $i++) {
  $stageActions += ,([ordered]@{})
}
$hitVariants = @(
  [ordered]@{ frames = @() },
  [ordered]@{ frames = @() },
  [ordered]@{ frames = @() }
)

foreach ($f in $bodyPacked) {
  $frameJson = ConvertTo-FrameJson $f
  $actions = $stageActions[[int]$f.stage]
  if (-not $actions.Contains($f.action)) {
    $actions[$f.action] = [ordered]@{ interval = [int]$f.interval; frames = @() }
  }
  $actions[$f.action].frames += $frameJson
}

foreach ($f in $hitPacked) {
  $hitVariants[[int]$f.variant].frames += ,(ConvertTo-FrameJson $f)
}

foreach ($actions in $stageActions) {
  if ($actions.Contains("standingBlend") -and -not $actions.Contains("walkingBlend")) {
    $actions["walkingBlend"] = $actions["standingBlend"]
  }
}

$stagesJson = @()
for ($i = 0; $i -lt $stageActions.Count; $i++) {
  $stagesJson += ,[ordered]@{ stage = $i; actions = $stageActions[$i] }
}

$output = [ordered]@{
  layer = "monster"
  index = $Index
  direction = 0
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetWidth = [int]$bodySheet.sheetWidth
  sheetHeight = [int]$bodySheet.sheetHeight
  stage = 0
  actions = $stageActions[0]
  stages = $stagesJson
  projectile = [ordered]@{
    style = "targetBurst"
    anchor = "target"
    sheet = $FxSheetName
    sheetWidth = [int]$fxSheet.sheetWidth
    sheetHeight = [int]$fxSheet.sheetHeight
    interval = 70
    burstDurationMs = 1400
    burstDelayMs = 300
    variants = @(
      [ordered]@{ startFrame = 375; frames = @($hitVariants[0].frames) },
      [ordered]@{ startFrame = 395; frames = @($hitVariants[1].frames) },
      [ordered]@{ startFrame = 415; frames = @($hitVariants[2].frames) }
    )
    frames = @($hitVariants[0].frames)
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Great Fox Spirit body stages 0-{0}: {1} → {2}x{3} ({4} unique frames, slot {5}x{6})" -f `
  ($stageStarts.Count - 1), ($stageActions[0].Keys -join ", "), `
  $bodySheet.sheetWidth, $bodySheet.sheetHeight, $bodySheet.uniqueCount, $slotWidth, $slotHeight)
Write-Host ("Great Fox Spirit hit FX → {0} ({1}x{2}, {3} unique frames)" -f `
  $FxSheetName, $fxSheet.sheetWidth, $fxSheet.sheetHeight, $fxSheet.uniqueCount)
