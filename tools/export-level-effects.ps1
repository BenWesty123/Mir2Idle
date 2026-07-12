param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$DefsPath = (Join-Path $PSScriptRoot "level-effect-defs.json"),
  [string]$OutputRoot = (Join-Path $PSScriptRoot "../public/level-effects")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not (Test-Path -LiteralPath $DefsPath)) {
  throw "Missing defs: $DefsPath"
}

$defs = Get-Content -LiteralPath $DefsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$libraryPaths = @{
  Effect = Join-Path $DataRoot "Effect.Lib"
  Magic3 = Join-Path $DataRoot "Magic3.Lib"
}

foreach ($lib in $libraryPaths.Values) {
  if (-not (Test-Path -LiteralPath $lib)) {
    throw "Crystal library not found: $lib"
  }
}

function Export-LevelEffectLayer {
  param(
    [string]$LibraryPath,
    [int]$Start,
    [int]$Count,
    [int]$DurationMs,
    [string]$SheetPath
  )

  $interval = [Math]::Max(1, [Math]::Round($DurationMs / $Count))
  $Lib = [BossGalleryMonsterLib]::new($LibraryPath)
  $frames = New-Object System.Collections.Generic.List[object]
  $slotWidth = 1
  $slotHeight = 1

  for ($i = 0; $i -lt $Count; $i++) {
    $srcFrame = $Start + $i
    $frameImage = $Lib.ReadImage($srcFrame)
    if ($frameImage -ne $null) {
      $slotWidth = [Math]::Max($slotWidth, $frameImage.Bitmap.Width)
      $slotHeight = [Math]::Max($slotHeight, $frameImage.Bitmap.Height)
    }
    $frames.Add([pscustomobject]@{
      slot = $i
      srcFrame = $srcFrame
      image = $frameImage
    }) | Out-Null
  }
  $Lib.Dispose()

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($frame in $frames) {
      if ($frame.image -eq $null) { continue }
      $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
    }
    $sheet.Save($SheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }

  $jsonFrames = @()
  foreach ($frame in $frames) {
    if ($frame.image -eq $null) {
      $jsonFrames += [ordered]@{ slot = $frame.slot; srcFrame = $frame.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
    }
    else {
      $jsonFrames += [ordered]@{
        slot = $frame.slot
        srcFrame = $frame.srcFrame
        w = $frame.image.Bitmap.Width
        h = $frame.image.Bitmap.Height
        offsetX = $frame.image.OffsetX
        offsetY = $frame.image.OffsetY
        empty = $false
      }
    }
  }

  return [pscustomobject]@{
    interval = $interval
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    frames = $jsonFrames
  }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

foreach ($effect in $defs.effects) {
  $effectDir = Join-Path $OutputRoot $effect.id
  New-Item -ItemType Directory -Force -Path $effectDir | Out-Null

  $atlasLayers = @()
  $layerIndex = 0
  foreach ($layer in $effect.layers) {
    $libraryPath = $libraryPaths[$layer.library]
    if (-not $libraryPath) { throw "Unknown library name: $($layer.library)" }
    $sheetName = "layer$layerIndex.png"
    $sheetPath = Join-Path $effectDir $sheetName
    $exported = Export-LevelEffectLayer -LibraryPath $libraryPath -Start $layer.start -Count $layer.count -DurationMs $layer.durationMs -SheetPath $sheetPath
    $atlasLayers += [ordered]@{
      sheet = $sheetName
      library = $layer.library
      baseIndex = $layer.start
      interval = $exported.interval
      slotWidth = $exported.slotWidth
      slotHeight = $exported.slotHeight
      blend = [bool]$layer.blend
      drawBehind = [bool]$layer.drawBehind
      delayMs = [int]$layer.delayMs
      frames = $exported.frames
    }
    $layerIndex++
  }

  $atlas = [ordered]@{
    id = $effect.id
    label = $effect.label
    crystalFlag = $effect.crystalFlag
    direction = 2
    blend = "screen"
    durationMs = ($effect.layers | ForEach-Object { $_.durationMs } | Measure-Object -Maximum).Maximum
    layers = $atlasLayers
  }

  $atlasPath = Join-Path $effectDir "atlas.json"
  $json = $atlas | ConvertTo-Json -Depth 8
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($atlasPath, $json, $utf8NoBom)
  Write-Host ("Wrote {0} ({1} layer(s))" -f $effect.label, $atlasLayers.Count)
}

Write-Host "Level effects exported to $OutputRoot"
