param(
  [string]$OutputRoot = "$PSScriptRoot\..\public\monsters",
  [int]$Direction = 6
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "decode-mir2-wil.ps1")

$monsterOut = Join-Path (Resolve-Path $OutputRoot) "monster"
New-Item -ItemType Directory -Force -Path $monsterOut | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$configs = @(
  [ordered]@{
    id = 901
    name = "Mir3StoneColossus"
    wil = Join-Path $root "new content\extracted\Mir3Mobs\Mir3Mobs\Mon1.Wil"
    wix = Join-Path $root "new content\extracted\Mir3Mobs\Mir3Mobs\Mon1.WIX"
    scale = 1.0
    direction = 0
  },
  [ordered]@{
    id = 902
    name = "KillmasterOverseer"
    wil = Join-Path $root "new content\extracted\Killmaster Mobs 2\Mon25.wil"
    wix = Join-Path $root "new content\extracted\Killmaster Mobs 2\Mon25.WIX"
    scale = 1.2
  },
  [ordered]@{
    id = 903
    name = "Mon51HalberdLord"
    wil = Join-Path $root "new content\extracted\Mon51\Mon51.wil"
    wix = Join-Path $root "new content\extracted\Mon51\Mon51.WIX"
    scale = 0.82
  },
  [ordered]@{
    id = 904
    name = "NewMagicBeast"
    wil = Join-Path $root "new content\extracted\NewMobsMagic\mon\Mon6.wil"
    wix = Join-Path $root "new content\extracted\NewMobsMagic\mon\Mon6.wix"
    scale = 1.0
  }
)

$actions = [ordered]@{
  standing = @{ start = 0; count = 4; offset = 4; interval = 500 }
  walking = @{ start = 32; count = 6; offset = 6; interval = 100 }
  attack1 = @{ start = 80; count = 6; offset = 6; interval = 100 }
  struck = @{ start = 128; count = 2; offset = 2; interval = 200 }
  die = @{ start = 144; count = 10; offset = 10; interval = 100 }
  dead = @{ start = 153; count = 1; offset = 10; interval = 1000; absolute = $true }
  revive = @{ start = 144; count = 10; offset = 10; interval = 100; reverse = $true; reverseStart = 153 }
}

function Resolve-LabFrameIndex($spec, [int]$i, [int]$FrameDirection) {
  if ($spec.absolute) { return $spec.start + $i }
  if ($spec.reverse) { return $spec.reverseStart - $i }
  return $spec.start + ($FrameDirection * $spec.offset) + $i
}

foreach ($config in $configs) {
  if (-not (Test-Path -LiteralPath $config.wil)) { throw "Missing WIL: $($config.wil)" }
  if (-not (Test-Path -LiteralPath $config.wix)) { throw "Missing WIX: $($config.wix)" }

  $frames = New-Object System.Collections.Generic.List[object]
  $slot = 0
  $slotWidth = 1
  $slotHeight = 1

  $lib = [Mir2WilLibrary]::new($config.wil, $config.wix)
  try {
    foreach ($action in $actions.GetEnumerator()) {
      $spec = $action.Value
      $frameDirection = if ($null -ne $config.direction) { [int]$config.direction } else { $Direction }
      for ($i = 0; $i -lt $spec.count; $i++) {
        $srcFrame = Resolve-LabFrameIndex $spec $i $frameDirection
        $image = $lib.ReadFrame($srcFrame)
        if ($image -ne $null) {
          $slotWidth = [Math]::Max($slotWidth, [int][Math]::Ceiling($image.Bitmap.Width * $config.scale))
          $slotHeight = [Math]::Max($slotHeight, [int][Math]::Ceiling($image.Bitmap.Height * $config.scale))
        }
        $frames.Add([pscustomobject]@{
          action = $action.Key
          slot = $slot
          srcFrame = $srcFrame
          image = $image
        }) | Out-Null
        $slot += 1
      }
    }

    $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      foreach ($frame in $frames) {
        if ($frame.image -eq $null) { continue }
        $drawWidth = [int][Math]::Ceiling($frame.image.Bitmap.Width * $config.scale)
        $drawHeight = [int][Math]::Ceiling($frame.image.Bitmap.Height * $config.scale)
        $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, $slotHeight - $drawHeight, $drawWidth, $drawHeight)
      }
      $sheet.Save((Join-Path $monsterOut "$($config.id).png"), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $graphics.Dispose()
      $sheet.Dispose()
    }

    $jsonActions = [ordered]@{}
    foreach ($action in $actions.GetEnumerator()) {
      $actionFrames = @()
      foreach ($frame in $frames | Where-Object { $_.action -eq $action.Key }) {
        if ($frame.image -eq $null) {
          $actionFrames += [ordered]@{ slot = $frame.slot; srcFrame = $frame.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
        } else {
          $drawWidth = [int][Math]::Ceiling($frame.image.Bitmap.Width * $config.scale)
          $drawHeight = [int][Math]::Ceiling($frame.image.Bitmap.Height * $config.scale)
          $actionFrames += [ordered]@{
            slot = $frame.slot
            srcFrame = $frame.srcFrame
            w = $drawWidth
            h = $drawHeight
            offsetX = [int][Math]::Round($frame.image.OffsetX * $config.scale)
            offsetY = [int][Math]::Round($frame.image.OffsetY * $config.scale)
          }
        }
      }
      $jsonActions[$action.Key] = [ordered]@{ interval = $action.Value.interval; frames = @($actionFrames) }
    }

    $atlas = [ordered]@{
      layer = "monster"
      index = $config.id
      direction = if ($null -ne $config.direction) { [int]$config.direction } else { $Direction }
      source = $config.name
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      actions = $jsonActions
    }

    [System.IO.File]::WriteAllText((Join-Path $monsterOut "$($config.id).json"), ($atlas | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
    Write-Output "Built new-content lab monster $($config.id) $($config.name) ($($frames.Count) slots, ${slotWidth}x${slotHeight})"
  }
  finally {
    foreach ($frame in $frames) { if ($frame.image -ne $null) { $frame.image.Dispose() } }
    $lib.Dispose()
  }
}

$layersPath = Join-Path (Resolve-Path $OutputRoot) "layers.json"
if (Test-Path -LiteralPath $layersPath) {
  $layers = Get-Content -LiteralPath $layersPath -Raw | ConvertFrom-Json
  $indexes = @($layers.layers.monster.indexes)
  foreach ($config in $configs) {
    if ($indexes -notcontains $config.id) { $indexes += $config.id }
  }
  $layers.layers.monster.indexes = @($indexes | Sort-Object)
  $layers.layers.monster.count = $layers.layers.monster.indexes.Count
  [System.IO.File]::WriteAllText($layersPath, ($layers | ConvertTo-Json -Depth 20), $utf8NoBom)
}
