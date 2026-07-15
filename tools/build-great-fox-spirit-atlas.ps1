# Export Crystal GreatFoxSpirit (Mon134) using all five Crystal combat stages
# plus AttackRange1 / SpellEffect hit FX (375 / 395 / 415 × 20).
# Body + DrawBlend + projectile frames are shelf-packed under an 8192px texture limit.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$MaxSheetEdge = 8192
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$Index = 134
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
if (-not (Test-Path -LiteralPath $libPath)) { throw "Missing $libPath" }
New-Item -ItemType Directory -Force -Path $MonsterRoot | Out-Null

$packed = New-Object System.Collections.Generic.List[object]
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
        $packed.Add([pscustomobject]@{
          stage = $stage
          action = $action.Key
          interval = [int]$spec.interval
          kind = "body"
          srcFrame = $src
          empty = ($null -eq $image)
          image = $image
          w = if ($image) { $image.Bitmap.Width } else { 0 }
          h = if ($image) { $image.Bitmap.Height } else { 0 }
          offsetX = if ($image) { $image.OffsetX } else { 0 }
          offsetY = if ($image) { $image.OffsetY } else { 0 }
        })
      }
      if ($spec.blendStart -ge 0) {
        for ($i = 0; $i -lt $spec.count; $i++) {
          $src = $spec.blendStart + $i
          $image = $lib.ReadImage($src)
          $packed.Add([pscustomobject]@{
            stage = $stage
            action = "$($action.Key)Blend"
            interval = [int]$spec.interval
            kind = "blend"
            srcFrame = $src
            empty = ($null -eq $image)
            image = $image
            w = if ($image) { $image.Bitmap.Width } else { 0 }
            h = if ($image) { $image.Bitmap.Height } else { 0 }
            offsetX = if ($image) { $image.OffsetX } else { 0 }
            offsetY = if ($image) { $image.OffsetY } else { 0 }
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
      $packed.Add([pscustomobject]@{
        stage = -1
        action = "hitVariant$variant"
        interval = 70
        kind = "hit"
        variant = $variant
        srcFrame = $src
        empty = ($null -eq $image)
        image = $image
        w = if ($image) { $image.Bitmap.Width } else { 0 }
        h = if ($image) { $image.Bitmap.Height } else { 0 }
        offsetX = if ($image) { $image.OffsetX } else { 0 }
        offsetY = if ($image) { $image.OffsetY } else { 0 }
      })
    }
  }
}
finally { $lib.Dispose() }

$bodyFrames = @($packed | Where-Object { $_.kind -eq "body" -and -not $_.empty })
if ($bodyFrames.Count -eq 0) { throw "No body frames for Great Fox Spirit" }

# Shelf-pack actual frame bounds so the sheet stays within GPU-safe limits.
$pad = 1
$cursorX = 0
$cursorY = 0
$rowHeight = 0
$sheetWidth = 1
$sheetHeight = 1
foreach ($f in $packed) {
  if ($f.empty -or $f.w -le 0 -or $f.h -le 0) {
    $f | Add-Member -NotePropertyName sheetX -NotePropertyValue 0 -Force
    $f | Add-Member -NotePropertyName sheetY -NotePropertyValue 0 -Force
    continue
  }
  $placeW = [int]$f.w + $pad
  $placeH = [int]$f.h + $pad
  if ($placeW -gt $MaxSheetEdge -or $placeH -gt $MaxSheetEdge) {
    throw ("Frame {0} ({1}x{2}) exceeds MaxSheetEdge {3}" -f $f.srcFrame, $f.w, $f.h, $MaxSheetEdge)
  }
  if ($cursorX -gt 0 -and ($cursorX + $placeW) -gt $MaxSheetEdge) {
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
}

if ($sheetWidth -gt $MaxSheetEdge -or $sheetHeight -gt $MaxSheetEdge) {
  throw ("Packed sheet {0}x{1} exceeds MaxSheetEdge {2}" -f $sheetWidth, $sheetHeight, $MaxSheetEdge)
}

$slotWidth = 1
$slotHeight = 1
foreach ($f in $bodyFrames) {
  $slotWidth = [Math]::Max($slotWidth, [int]$f.w)
  $slotHeight = [Math]::Max($slotHeight, [int]$f.h)
}

$sheet = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$stageActions = @()
for ($i = 0; $i -lt $stageStarts.Count; $i++) {
  $stageActions += ,([ordered]@{})
}
$hitVariants = @(
  [ordered]@{ frames = @() },
  [ordered]@{ frames = @() },
  [ordered]@{ frames = @() }
)
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  foreach ($f in $packed) {
    if (-not $f.empty) {
      $graphics.DrawImage($f.image.Bitmap, [int]$f.sheetX, [int]$f.sheetY, [int]$f.w, [int]$f.h)
      $f.image.Dispose()
    }
    $frameJson = if ($f.empty) {
      [ordered]@{ sheetX = 0; sheetY = 0; srcFrame = $f.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
    } else {
      [ordered]@{
        sheetX = [int]$f.sheetX
        sheetY = [int]$f.sheetY
        srcFrame = $f.srcFrame
        w = [int]$f.w
        h = [int]$f.h
        offsetX = [int]$f.offsetX
        offsetY = [int]$f.offsetY
      }
    }
    if ($f.kind -eq "hit") {
      $hitVariants[[int]$f.variant].frames += $frameJson
      continue
    }
    $actions = $stageActions[[int]$f.stage]
    if (-not $actions.Contains($f.action)) {
      $actions[$f.action] = [ordered]@{ interval = [int]$f.interval; frames = @() }
    }
    $actions[$f.action].frames += $frameJson
  }

  $tempPath = "$pngPath.tmp.png"
  $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
}
finally {
  $graphics.Dispose()
  $sheet.Dispose()
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
  sheetWidth = $sheetWidth
  sheetHeight = $sheetHeight
  stage = 0
  actions = $stageActions[0]
  stages = $stagesJson
  projectile = [ordered]@{
    style = "targetBurst"
    anchor = "target"
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
Write-Host ("Great Fox Spirit stages 0-{0} + hit FX: {1} → {2}x{3} (slot {4}x{5})" -f `
  ($stageStarts.Count - 1), ($stageActions[0].Keys -join ", "), $sheetWidth, $sheetHeight, $slotWidth, $slotHeight)
