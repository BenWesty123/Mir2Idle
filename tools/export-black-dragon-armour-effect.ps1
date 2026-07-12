param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = (Join-Path $PSScriptRoot "../public/armour-effects/black-dragon-armour")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

$libraryPath = Join-Path $DataRoot "CHumEffect/04.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "CHumEffect/04.Lib not found at $libraryPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$start = 0
$count = 10
$durationMs = 1500
$interval = [Math]::Max(1, [Math]::Round($durationMs / $count))

$Lib = [BossGalleryMonsterLib]::new($libraryPath)
$frames = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1

for ($i = 0; $i -lt $count; $i++) {
  $srcFrame = $start + $i
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
$Lib.Dispose()

$sheetPath = Join-Path $OutputRoot "loop.png"
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

$atlas = [ordered]@{
  effectId = 101
  label = "Black Dragon Armour"
  direction = 2
  blend = "screen"
  drawBehind = $false
  durationMs = $durationMs
  layers = @(
    [ordered]@{
      sheet = "loop.png"
      interval = $interval
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      library = "CHumEffect"
      baseIndex = $start
      frames = $jsonFrames
    }
  )
}

$atlasPath = Join-Path $OutputRoot "atlas.json"
$atlas | ConvertTo-Json -Depth 8 | Set-Content -Path $atlasPath -Encoding UTF8
Write-Host "Wrote Black Dragon armour effect to $OutputRoot ($count frames @ ${interval}ms)"
