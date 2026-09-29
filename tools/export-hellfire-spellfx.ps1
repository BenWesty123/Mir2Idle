param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

# Crystal PlayerObject Spell.HellFire:
#   caster:  Effect(Libraries.Magic, 920, 10, ...)  -- already in l0.png
#   attack:  Effect(Libraries.Magic, 930, 6, 500, dest) { Rate = 0.7F }
#            one burst per cell, stagger i * 50ms
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $PSScriptRoot "../public/spellfx/HellFire"
}
$OutputRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutputRoot)).Path

function Export-SpellLayer {
  param(
    [BossGalleryMonsterLib]$Lib,
    [int]$Start,
    [int]$Count,
    [string]$SheetName,
    [int]$Interval = 83
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

$magicLibPath = Join-Path $DataRoot "Magic.Lib"
if (-not (Test-Path -LiteralPath $magicLibPath)) { throw "Magic.Lib not found at $magicLibPath" }

$magicLib = [BossGalleryMonsterLib]::new((Resolve-Path $magicLibPath))
try {
  $impact = Export-SpellLayer -Lib $magicLib -Start 930 -Count 6 -SheetName "impact.png" -Interval 83
  $impactMeta = [ordered]@{
    sheet = $impact.sheet
    interval = $impact.interval
    slotWidth = $impact.slotWidth
    slotHeight = $impact.slotHeight
    library = "Magic"
    baseIndex = 930
    anchor = "cell"
    delayMs = 0
    frames = $impact.frames
  }

  $atlasPath = Join-Path $OutputRoot "atlas.json"
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "HellFire atlas.json not found at $atlasPath" }
  $metaPath = Join-Path $OutputRoot "_impact.meta.json"
  $mergePath = Join-Path $OutputRoot "_merge-impact.mjs"
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($metaPath, ($impactMeta | ConvertTo-Json -Depth 8), $utf8NoBom)
  [System.IO.File]::WriteAllText($mergePath, @"
import fs from 'node:fs';
const atlasPath = process.argv[2];
const metaPath = process.argv[3];
const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
atlas.impact = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
fs.writeFileSync(atlasPath, JSON.stringify(atlas, null, 2) + '\n');
"@, $utf8NoBom)

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { throw "node is required to merge HellFire impact into atlas.json" }
  & node $mergePath $atlasPath $metaPath
  if ($LASTEXITCODE -ne 0) { throw "Failed to merge HellFire impact into atlas.json" }
  Remove-Item -LiteralPath $metaPath, $mergePath -Force

  Write-Host "Wrote $atlasPath impact.png (Magic 930 x6)"
}
finally {
  $magicLib.Dispose()
}
