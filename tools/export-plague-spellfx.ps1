param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $PSScriptRoot "../public/spellfx/Plague"
}
$OutputRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutputRoot)).Path

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

$magicLibPath = Join-Path $DataRoot "Magic.Lib"
$magic3LibPath = Join-Path $DataRoot "Magic3.Lib"
if (-not (Test-Path -LiteralPath $magicLibPath)) { throw "Magic.Lib not found at $magicLibPath" }
if (-not (Test-Path -LiteralPath $magic3LibPath)) { throw "Magic3.Lib not found at $magic3LibPath" }

$magicLib = [BossGalleryMonsterLib]::new((Resolve-Path $magicLibPath))
$magic3Lib = [BossGalleryMonsterLib]::new((Resolve-Path $magic3LibPath))
try {
  # PlayerObject Plague: projectile Magic 1160 x3, impact Magic3 110 x10
  $projectile = Export-SpellLayer -Lib $magicLib -Start 1160 -Count 3 -SheetName "projectile.png"
  $impact = Export-SpellLayer -Lib $magic3Lib -Start 110 -Count 10 -SheetName "impact.png"

  $atlas = [ordered]@{
    spellId = "Plague"
    direction = 2
    blend = "screen"
    layers = @()
    projectile = [ordered]@{
      sheet = $projectile.sheet
      interval = 30
      slotWidth = $projectile.slotWidth
      slotHeight = $projectile.slotHeight
      library = "Magic"
      baseIndex = 1160
      frameCount = 3
      skip = 0
      facing8 = 2
      moveDurationMs = 400
      delayMs = 0
      startOffsetX = 8
      startOffsetY = -42
      endOffsetX = 40
      endOffsetY = -42
      rotate = $true
      baseAngleDeg = -90
      frames = $projectile.frames
    }
    impact = [ordered]@{
      sheet = $impact.sheet
      interval = 120
      slotWidth = $impact.slotWidth
      slotHeight = $impact.slotHeight
      library = "Magic3"
      baseIndex = 110
      anchor = "enemy"
      delayMs = 0
      frames = $impact.frames
    }
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $atlasPath = Join-Path $OutputRoot "atlas.json"
  [System.IO.File]::WriteAllText($atlasPath, ($atlas | ConvertTo-Json -Depth 8), $utf8NoBom)
  Write-Host "Wrote $atlasPath"
}
finally {
  $magicLib.Dispose()
  $magic3Lib.Dispose()
}
