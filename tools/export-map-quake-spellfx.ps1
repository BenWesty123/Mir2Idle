param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "public\spellfx\MapQuake"
}

. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

# Crystal SpellObject MapQuake1/2 (Hell Lord floor bursts):
#   MapQuake1: Libraries.Monsters[HellLord] 27, 12 frames, 1200ms, Blend=false
#   MapQuake2: Libraries.Monsters[HellLord] 39, 13 frames, 1300ms, Blend=false
$libraryPath = Join-Path $DataRoot "Monster\247.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "HellLord lib not found at $libraryPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$layers = @(
  [ordered]@{ name = "quake1"; variant = 1; start = 27; count = 12; interval = 100; durationMs = 1200; blend = $false }
  [ordered]@{ name = "quake2"; variant = 2; start = 39; count = 13; interval = 100; durationMs = 1300; blend = $false }
)

$lib = [PhaseMonsterLib]::new((Resolve-Path $libraryPath))
try {
  $atlasLayers = New-Object System.Collections.Generic.List[object]
  $sheetIndex = 0

  foreach ($layerDef in $layers) {
    $frames = New-Object System.Collections.Generic.List[object]
    $slotWidth = 1
    $slotHeight = 1

    for ($i = 0; $i -lt $layerDef.count; $i++) {
      $srcFrame = $layerDef.start + $i
      $frameImage = $lib.ReadImage($srcFrame)
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

    $sheetPath = "l$sheetIndex.png"
    $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      foreach ($frame in $frames) {
        if ($frame.image -eq $null) { continue }
        $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
      }
      $sheet.Save((Join-Path $OutputRoot $sheetPath), [System.Drawing.Imaging.ImageFormat]::Png)
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

    $atlasLayers.Add([ordered]@{
      sheet = $sheetPath
      name = $layerDef.name
      variant = $layerDef.variant
      interval = $layerDef.interval
      durationMs = $layerDef.durationMs
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      library = "HellLord"
      baseIndex = $layerDef.start
      anchor = "ground"
      blend = $layerDef.blend
      frames = $jsonFrames
    }) | Out-Null

    foreach ($frame in $frames) {
      if ($frame.image -ne $null) { $frame.image.Dispose() }
    }
    $sheetIndex++
  }

  $atlas = [ordered]@{
    spellId = "MapQuake"
    source = "Crystal MapQuake1/2: HellLord 247.Lib frames 27 (12f/1200ms) + 39 (13f/1300ms)"
    layers = $atlasLayers
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $OutputRoot "atlas.json"), ($atlas | ConvertTo-Json -Depth 20), $utf8NoBom)
  Write-Output "Exported MapQuake to $OutputRoot"
}
finally {
  $lib.Dispose()
}
