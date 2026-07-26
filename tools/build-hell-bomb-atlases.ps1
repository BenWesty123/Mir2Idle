# Build Hell Bomb atlases (Crystal HellBomb1/2/3) from HellLord 247.Lib.
# Crystal: BodyLibrary = HellLord; FrameSet.HellBomb standing at 52/70/88 (9 frames, blend);
# attack FX Effect from HellLord at 61/79/97.
#
# Atlas indices 2471–2473 (not Crystal enum 903–905): Lab Halberd Lord / White Boar
# already own public/monsters/monster/903–904.
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [string]$PreviewRoot = "$PSScriptRoot\..\docs\fire-hell-bombs"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$libPath = Join-Path $DataRoot "Monster\247.Lib"
if (-not (Test-Path -LiteralPath $libPath)) { throw "Missing HellLord lib: $libPath" }
New-Item -ItemType Directory -Force -Path $MonsterRoot | Out-Null
New-Item -ItemType Directory -Force -Path $PreviewRoot | Out-Null

$bombs = @(
  @{ Index = 2471; Label = "HellBomb1"; Stand = 52..60; AttackFx = 61..67; AttackInterval = 100 }
  @{ Index = 2472; Label = "HellBomb2"; Stand = 70..78; AttackFx = 79..87; AttackInterval = 100 }
  @{ Index = 2473; Label = "HellBomb3"; Stand = 88..96; AttackFx = 97..104; AttackInterval = 100 }
)

function Pack-BombAtlas($def, $lib) {
  $standFrames = @($def.Stand)
  $fxFrames = @($def.AttackFx)
  # Body actions: bombs are stationary floaters (Crystal OffSet=0). Reuse stand for walk/struck.
  $actionSpecs = [ordered]@{
    standing = @{ frames = $standFrames; interval = 100 }
    walking  = @{ frames = $standFrames; interval = 100 }
    attack1  = @{ frames = $standFrames; interval = 100 }
    struck   = @{ frames = $standFrames; interval = 100 }
    die      = @{ frames = $standFrames; interval = 80 }
    dead     = @{ frames = @($standFrames[-1]); interval = 1000 }
    revive   = @{ frames = @($standFrames | Sort-Object -Descending); interval = 80 }
  }

  $packedBody = New-Object System.Collections.Generic.List[object]
  $packedBlend = New-Object System.Collections.Generic.List[object]

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

  foreach ($src in $fxFrames) {
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

  $pngPath = Join-Path $MonsterRoot "$($def.Index).png"
  $atlasPath = Join-Path $MonsterRoot "$($def.Index).json"
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
    $actions["attack1Blend"] = [ordered]@{ interval = [int]$def.AttackInterval; frames = @($blendFrames) }

    # Crystal HellBombs are facing-independent (Frame OffSet=0). Alias directional
    # swarm clips to the same float/attack frames so GD tests and runtime pass.
    $dirAliases = [ordered]@{
      walkNorth = "walking"
      walkSouth = "walking"
      walkNorthWest = "walking"
      walkSouthWest = "walking"
      attackNorthWest = "attack1"
      attackSouthWest = "attack1"
      standingNorthWest = "standing"
      standingSouthWest = "standing"
    }
    foreach ($pair in $dirAliases.GetEnumerator()) {
      $src = $actions[$pair.Value]
      if ($null -ne $src) {
        $actions[$pair.Key] = [ordered]@{
          interval = $src.interval
          frames = @($src.frames)
        }
      }
    }

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
    index = [int]$def.Index
    direction = 0
    # Crystal Frame.Blend = true — body is additive FX; normal draw shows a black outline.
    drawBlend = $true
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    sheetHeight = $sheetHeight
    bodyWidth = $bodyWidth
    actions = $actions
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host ("{0} ({1}): body+blend {2}x{3} → {4}" -f $def.Label, $def.Index, $newWidth, $sheetHeight, $pngPath)
}

# Preview strip of all three stand cycles
$lib = [PhaseMonsterLib]::new((Resolve-Path $libPath))
try {
  foreach ($def in $bombs) {
    Pack-BombAtlas $def $lib
  }

  # Combined compare strip
  $allStand = @()
  foreach ($def in $bombs) { $allStand += @($def.Stand) }
  $imgs = New-Object System.Collections.Generic.List[object]
  foreach ($i in $allStand) {
    $image = $lib.ReadImage([int]$i)
    if ($null -ne $image) { $imgs.Add([pscustomobject]@{ image = $image }) }
  }
  if ($imgs.Count -gt 0) {
    $pad = 4
    $maxH = 1
    $totalW = 0
    foreach ($e in $imgs) {
      $maxH = [Math]::Max($maxH, $e.image.Bitmap.Height)
      $totalW += $e.image.Bitmap.Width + $pad
    }
    $sheet = [System.Drawing.Bitmap]::new($totalW, $maxH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $g.Clear([System.Drawing.Color]::Transparent)
      $x = 0
      foreach ($e in $imgs) {
        $g.DrawImage($e.image.Bitmap, $x, 0)
        $x += $e.image.Bitmap.Width + $pad
        $e.image.Dispose()
      }
      $previewPath = Join-Path $PreviewRoot "hell-bombs-stand-compare.png"
      $sheet.Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Host "Preview: $previewPath"
    }
    finally {
      $g.Dispose()
      $sheet.Dispose()
    }
  }
}
finally { $lib.Dispose() }
