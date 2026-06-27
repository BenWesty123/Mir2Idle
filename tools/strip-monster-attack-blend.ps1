#!/usr/bin/env pwsh
# Remove attack1Blend (and trim packed FX pixels) from a monster atlas.
param(
  [Parameter(Mandatory = $true)]
  [int]$Index,
  [string]$MonsterRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $MonsterRoot) {
  $MonsterRoot = Join-Path $toolsDir "..\public\monsters\monster"
}
$MonsterRoot = (Resolve-Path -LiteralPath $MonsterRoot).Path

$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
if (-not $atlas.actions.attack1Blend) {
  Write-Host "Skip $Index : no attack1Blend"
  exit 0
}

$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
$bodyWidth = if ($atlas.PSObject.Properties.Name -contains "bodyWidth") {
  [int]$atlas.bodyWidth
} else {
  $maxSlot = -1
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($prop.Name -match "Blend$") { continue }
    foreach ($frame in $prop.Value.frames) {
      if ($null -ne $frame.slot) { $maxSlot = [Math]::Max($maxSlot, [int]$frame.slot) }
    }
  }
  ($maxSlot + 1) * $slotWidth
}

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($prop.Name -eq "attack1Blend") { continue }
  $actions[$prop.Name] = $prop.Value
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$copyH = [Math]::Min($slotHeight, $existingSheet.Height)
try {
  $sheet = [System.Drawing.Bitmap]::new($bodyWidth, $copyH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage(
      $existingSheet,
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $copyH),
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $copyH),
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $tempPath = "$pngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::Copy($tempPath, $pngPath, $true)
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
finally {
  $existingSheet.Dispose()
}

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  bodyWidth = $bodyWidth
  actions = $actions
}
if ($atlas.castEffect) { $output.castEffect = $atlas.castEffect }
if ($atlas.projectile) { $output.projectile = $atlas.projectile }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Stripped attack1Blend from monster $Index (sheet ${bodyWidth}px wide)"
