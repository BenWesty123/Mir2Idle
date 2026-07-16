# Pack Guardian Rock (Mon131): body 0-8 + attack FX blend 12-21 (Crystal Effect start 12 ×10).
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$Index = 131
$libPath = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
New-Item -ItemType Directory -Force -Path $MonsterRoot | Out-Null

$actionSpecs = [ordered]@{
  standing = @{ frames = 0..3; interval = 800 }
  walking = @{ frames = 0..3; interval = 200 }
  attack1 = @{ frames = 4..8; interval = 120 }
  struck = @{ frames = 9..11; interval = 200 }
  die = @{ frames = 9..11; interval = 150 }
  dead = @{ frames = @(11); interval = 1000 }
}
$blendSrc = 12..21

$packedBody = New-Object System.Collections.Generic.List[object]
$packedBlend = New-Object System.Collections.Generic.List[object]
$lib = [PhaseMonsterLib]::new((Resolve-Path $libPath))
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
  foreach ($src in $blendSrc) {
    $image = $lib.ReadImage([int]$src)
    $packedBlend.Add([pscustomobject]@{
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
$blendWidth = 0
foreach ($f in $packedBlend) {
  if (-not $f.empty) {
    $blendWidth += [int]$f.w
    $sheetHeight = [Math]::Max($sheetHeight, [int]$f.h)
  }
}
$bodyWidth = $packedBody.Count * $slotWidth
$newWidth = $bodyWidth + $blendWidth

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
  $blendFrames = @()
  foreach ($f in $packedBlend) {
    if ($f.empty) {
      $blendFrames += [ordered]@{ sheetX = $sheetX; srcFrame = $f.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
      continue
    }
    $graphics.DrawImage($f.image.Bitmap, $sheetX, 0, $f.w, $f.h)
    $blendFrames += [ordered]@{
      sheetX = $sheetX; srcFrame = $f.srcFrame; w = $f.w; h = $f.h
      offsetX = $f.offsetX; offsetY = $f.offsetY
    }
    $sheetX += [int]$f.w
    $f.image.Dispose()
  }
  $actions["attack1Blend"] = [ordered]@{ interval = 100; frames = @($blendFrames) }

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
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetHeight = $sheetHeight
  bodyWidth = $bodyWidth
  actions = $actions
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host ("Guardian Rock: {0} → {1}x{2}" -f ($actions.Keys -join ", "), $newWidth, $sheetHeight)
