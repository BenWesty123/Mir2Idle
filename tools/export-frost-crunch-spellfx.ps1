param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $PSScriptRoot "../public/spellfx/FrostCrunch"
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
    if ($null -ne $frameImage) {
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
      if ($null -eq $frame.image) { continue }
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
    if ($null -eq $frame.image) {
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
  # Crystal PlayerObject FrostCrunch:
  #   cast:      Effect(Libraries.Magic2, 400, 10, ...)
  #   projectile: CreateProjectile(410, Libraries.Magic2, true, 4, 30, 6)
  #               index = 410 + dir16*(4+6) + frame; idle east dir16=4 => Magic2 450..453
  #   impact:    Effect(Libraries.Magic2, 570, 8, 600, target)
  $cast = Export-SpellLayer -Lib $magic2Lib -Start 400 -Count 10 -SheetName "l0.png" -Interval 60
  $projectile = Export-SpellLayer -Lib $magic2Lib -Start 450 -Count 4 -SheetName "p0.png" -Interval 30
  $impact = Export-SpellLayer -Lib $magic2Lib -Start 570 -Count 8 -SheetName "impact.png" -Interval 75

  $atlas = [ordered]@{
    spellId = "FrostCrunch"
    direction = 2
    blend = "screen"
    layers = @(
      [ordered]@{
        sheet = $cast.sheet
        interval = $cast.interval
        slotWidth = $cast.slotWidth
        slotHeight = $cast.slotHeight
        library = "Magic2"
        baseIndex = 400
        frames = $cast.frames
      }
    )
    projectile = [ordered]@{
      sheet = $projectile.sheet
      interval = $projectile.interval
      slotWidth = $projectile.slotWidth
      slotHeight = $projectile.slotHeight
      library = "Magic2"
      baseIndex = 450
      frameCount = 4
      skip = 6
      facing8 = 2
      moveDurationMs = 400
      delayMs = 320
      startOffsetX = 12
      startOffsetY = 3
      endOffsetX = 110
      endOffsetY = -22
      frames = $projectile.frames
    }
    impact = [ordered]@{
      sheet = $impact.sheet
      interval = $impact.interval
      slotWidth = $impact.slotWidth
      slotHeight = $impact.slotHeight
      library = "Magic2"
      baseIndex = 570
      anchor = "enemy"
      delayMs = 0
      frames = $impact.frames
    }
  }

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $atlasPath = Join-Path $OutputRoot "atlas.json"
  [System.IO.File]::WriteAllText($atlasPath, ($atlas | ConvertTo-Json -Depth 8), $utf8NoBom)
  Write-Host "Wrote $atlasPath"
  Write-Host "Sheets: l0.png p0.png impact.png"
}
finally {
  $magic2Lib.Dispose()
}
