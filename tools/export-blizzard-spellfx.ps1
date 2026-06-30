param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $PSScriptRoot "../public/spellfx/Blizzard"
}
$OutputRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutputRoot)).Path

$libraryPath = Join-Path $DataRoot "Magic2.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "Magic2.Lib not found at $libraryPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

function Export-SpellLayer {
  param(
    [BossGalleryMonsterLib]$Lib,
    [int]$Start,
    [int]$Count,
    [string]$SheetName
  )

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

  $sheetPath = Join-Path $OutputRoot $SheetName
  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($frame in $frames) {
      if ($frame.image -eq $null) { continue }
      $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
    }
    $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
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

  return [ordered]@{
    sheet = $SheetName
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    frames = $jsonFrames
  }
}

$lib = [BossGalleryMonsterLib]::new((Resolve-Path $libraryPath))
try {
  # PlayerObject cast: Magic2 1540 x8
  $cast = Export-SpellLayer -Lib $lib -Start 1540 -Count 8 -SheetName "l0.png"
  # SpellObject field body: Magic2 1550 x30, 100ms/frame (3s field)
  $ground = Export-SpellLayer -Lib $lib -Start 1550 -Count 30 -SheetName "ground.png"

  $atlas = [ordered]@{
    spellId = "Blizzard"
    direction = 2
    blend = "screen"
    layers = @(
      [ordered]@{
        sheet = $cast.sheet
        interval = 60
        slotWidth = $cast.slotWidth
        slotHeight = $cast.slotHeight
        library = "Magic2"
        baseIndex = 1540
        frames = $cast.frames
      }
    )
    ground = [ordered]@{
      sheet = $ground.sheet
      interval = 100
      slotWidth = $ground.slotWidth
      slotHeight = $ground.slotHeight
      library = "Magic2"
      baseIndex = 1550
      anchor = "enemy"
      delayMs = 0
      frames = $ground.frames
    }
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $atlasPath = Join-Path $OutputRoot "atlas.json"
  [System.IO.File]::WriteAllText($atlasPath, ($atlas | ConvertTo-Json -Depth 8), $utf8NoBom)
  Write-Host "Wrote $atlasPath"
}
finally {
  $lib.Dispose()
}
