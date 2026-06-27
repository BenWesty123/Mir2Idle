param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "public\spellfx\MapHellFire"
}

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

$libraryPath = Join-Path $DataRoot "Dragon.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "Dragon.Lib not found at $libraryPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

# Crystal Spell.MapLava: Libraries.Dragon 440 (20 frames, 1600ms) + 470 (10 frames, 800ms).
$layers = @(
  [ordered]@{ name = "burst"; start = 440; count = 20; interval = 80; blend = $false }
  [ordered]@{ name = "flare"; start = 470; count = 10; interval = 80; blend = $true }
)

$lib = [BossGalleryMonsterLib]::new((Resolve-Path $libraryPath))
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
      interval = $layerDef.interval
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      library = "Dragon"
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
    spellId = "MapHellFire"
    source = "Crystal MapLava: Libraries.Dragon 440 (20f) + 470 (10f), TickSpeed 500ms"
    layers = $atlasLayers
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $OutputRoot "atlas.json"), ($atlas | ConvertTo-Json -Depth 20), $utf8NoBom)
  Write-Output "Exported MapHellFire to $OutputRoot"
}
finally {
  $lib.Dispose()
}
