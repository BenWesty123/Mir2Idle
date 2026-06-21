param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "public\spellfx\Revive"
}

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

$libraryPath = Join-Path $DataRoot "Magic2.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "Magic2.Lib not found at $libraryPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$baseIndex = 1220
$frameCount = 20
$frames = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1

$lib = [BossGalleryMonsterLib]::new((Resolve-Path $libraryPath))
try {
  for ($i = 0; $i -lt $frameCount; $i++) {
    $srcFrame = $baseIndex + $i
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

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($frame in $frames) {
      if ($frame.image -eq $null) { continue }
      $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
    }
    $sheet.Save((Join-Path $OutputRoot "l0.png"), [System.Drawing.Imaging.ImageFormat]::Png)
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

  $atlas = [ordered]@{
    spellId = "Revive"
    source = "Crystal GameScene.Revived / ObjectRevived: new Effect(Libraries.Magic2, 1220, 20, 2000, target)"
    blend = "screen"
    layers = @(
      [ordered]@{
        sheet = "l0.png"
        interval = 100
        slotWidth = $slotWidth
        slotHeight = $slotHeight
        library = "Magic2"
        baseIndex = $baseIndex
        anchor = "player"
        delayMs = 0
        frames = $jsonFrames
      }
    )
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $OutputRoot "atlas.json"), ($atlas | ConvertTo-Json -Depth 20), $utf8NoBom)
  Write-Output "Exported Revive to $OutputRoot ($($frames.Count) frames, ${slotWidth}x${slotHeight} slots)"
}
finally {
  foreach ($frame in $frames) {
    if ($frame.image -ne $null) { $frame.image.Dispose() }
  }
  $lib.Dispose()
}
