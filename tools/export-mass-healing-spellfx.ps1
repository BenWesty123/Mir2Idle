param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = "../public/spellfx/MassHealing"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

$libraryPath = Join-Path $DataRoot "Magic.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "Magic.Lib not found at $libraryPath"
}

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

$lib = [BossGalleryMonsterLib]::new((Resolve-Path $libraryPath))
try {
  $cast = Export-SpellLayer -Lib $lib -Start 1790 -Count 10 -SheetName "l0.png"
  $impact = Export-SpellLayer -Lib $lib -Start 1800 -Count 10 -SheetName "target.png" -Interval 100

  $atlas = [ordered]@{
    spellId = "MassHealing"
    direction = 2
    blend = "screen"
    layers = @(
      [ordered]@{
        sheet = $cast.sheet
        interval = $cast.interval
        slotWidth = $cast.slotWidth
        slotHeight = $cast.slotHeight
        library = "Magic"
        baseIndex = 1790
        frames = $cast.frames
      },
      [ordered]@{
        sheet = $impact.sheet
        interval = $impact.interval
        slotWidth = $impact.slotWidth
        slotHeight = $impact.slotHeight
        library = "Magic"
        baseIndex = 1800
        anchor = "player"
        delayMs = 500
        frames = $impact.frames
      }
    )
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $OutputRoot "atlas.json"), ($atlas | ConvertTo-Json -Depth 20), $utf8NoBom)
  Write-Output "Exported MassHealing cast=$($cast.frames.Count) impact=$($impact.frames.Count) to $OutputRoot"
}
finally {
  foreach ($img in @($cast.images) + @($impact.images)) {
    if ($img -ne $null) { $img.Dispose() }
  }
  $lib.Dispose()
}
