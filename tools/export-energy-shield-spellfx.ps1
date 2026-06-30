param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $PSScriptRoot "../public/spellfx/EnergyShield"
}
$OutputRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutputRoot)).Path

function Export-SpellLayer {
  param(
    [BossGalleryMonsterLib]$Lib,
    [int]$Start,
    [int]$Count,
    [string]$SheetName,
    [int]$Interval = 100
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
    interval = $Interval
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    frames = $jsonFrames
  }
}

$magic2LibPath = Join-Path $DataRoot "Magic2.Lib"
if (-not (Test-Path -LiteralPath $magic2LibPath)) { throw "Magic2.Lib not found at $magic2LibPath" }

$magic2Lib = [BossGalleryMonsterLib]::new((Resolve-Path $magic2LibPath))
try {
  # Crystal BuffEffect: cast Magic2 1890 x6 @ 600ms, loop Magic2 1900 x2 @ 800ms
  $cast = Export-SpellLayer -Lib $magic2Lib -Start 1890 -Count 6 -SheetName "cast.png" -Interval 100
  $loop = Export-SpellLayer -Lib $magic2Lib -Start 1900 -Count 2 -SheetName "loop.png" -Interval 400

  $atlas = [ordered]@{
    spellId = "EnergyShield"
    direction = 2
    blend = "screen"
    layers = @(
      [ordered]@{
        sheet = $cast.sheet
        interval = $cast.interval
        slotWidth = $cast.slotWidth
        slotHeight = $cast.slotHeight
        library = "Magic2"
        baseIndex = 1890
        anchor = "player"
        frames = $cast.frames
      },
      [ordered]@{
        sheet = $loop.sheet
        interval = $loop.interval
        slotWidth = $loop.slotWidth
        slotHeight = $loop.slotHeight
        library = "Magic2"
        baseIndex = 1900
        anchor = "player"
        frames = $loop.frames
      }
    )
  }

  $jsonPath = Join-Path $OutputRoot "atlas.json"
  [System.IO.File]::WriteAllText($jsonPath, ($atlas | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Wrote $jsonPath"
}
finally {
  $magic2Lib.Dispose()
}
