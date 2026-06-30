param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $PSScriptRoot "../public/spellfx/HealingCircle"
}
$OutputRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutputRoot)).Path

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

function Export-SpellLayer {
  param(
    [BossGalleryMonsterLib]$Lib,
    [int]$Start,
    [int]$Count,
    [string]$SheetName,
    [int]$Interval = 60
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
    images = @($frames | ForEach-Object { $_.image })
  }
}

$magic3LibPath = Join-Path $DataRoot "Magic3.Lib"
if (-not (Test-Path -LiteralPath $magic3LibPath)) { throw "Magic3.Lib not found at $magic3LibPath" }

$magic3Lib = [BossGalleryMonsterLib]::new((Resolve-Path $magic3LibPath))
try {
  # PlayerObject cast: Magic3 620 x10; SpellObject field body: Magic3 630 x11 @ 80ms
  $cast = Export-SpellLayer -Lib $magic3Lib -Start 620 -Count 10 -SheetName "l0.png" -Interval 60
  $ground = Export-SpellLayer -Lib $magic3Lib -Start 630 -Count 11 -SheetName "ground.png" -Interval 80

  $atlas = [ordered]@{
    spellId = "HealingCircle"
    direction = 2
    blend = "screen"
    layers = @(
      [ordered]@{
        sheet = $cast.sheet
        interval = $cast.interval
        slotWidth = $cast.slotWidth
        slotHeight = $cast.slotHeight
        library = "Magic3"
        baseIndex = 620
        frames = $cast.frames
      }
    )
    ground = [ordered]@{
      sheet = $ground.sheet
      interval = $ground.interval
      slotWidth = $ground.slotWidth
      slotHeight = $ground.slotHeight
      library = "Magic3"
      baseIndex = 630
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
  foreach ($img in @($cast.images) + @($ground.images)) {
    if ($img -ne $null) { $img.Dispose() }
  }
  $magic3Lib.Dispose()
}
