#!/usr/bin/env pwsh
# Repack monster combat FX (attack1Blend / castEffect / projectile) at each frame's real width.
# Body clips stay on fixed slotWidth columns; FX uses absolute sheetX after bodyWidth.
param(
  [Parameter(Mandatory = $true)]
  [int]$Index,
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "",
  [int[]]$EmptySrcFrames = @(),
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $toolsDir "lib\phase-monster-lib.ps1")

if (-not $MonsterRoot) {
  $MonsterRoot = Join-Path $toolsDir "..\public\monsters\monster"
}
$MonsterRoot = (Resolve-Path -LiteralPath $MonsterRoot).Path

$BlendSkipActions = @(
  "attack1Blend", "attackRange1Blend", "standingBlend", "walkingBlend", "dieBlend"
)

function Get-SrcFrame($frame) {
  if ($null -eq $frame) { return -1 }
  if ($null -ne $frame.srcFrame -and [int]$frame.srcFrame -ge 0) { return [int]$frame.srcFrame }
  if ($null -ne $frame.src -and [int]$frame.src -ge 0) { return [int]$frame.src }
  return -1
}

function Test-HasSheetX($frame) {
  if ($null -eq $frame) { return $false }
  if ($frame.PSObject.Properties.Name -notcontains "sheetX") { return $false }
  return $null -ne $frame.sheetX -and [string]$frame.sheetX -match "^\d"
}

function Test-AlreadyPacked($frames) {
  if (-not $frames -or $frames.Count -eq 0) { return $true }
  $drawable = @($frames | Where-Object { $_ -and -not $_.empty })
  if ($drawable.Count -eq 0) { return $true }
  return ($drawable | Where-Object { -not (Test-HasSheetX $_) }).Count -eq 0
}

function Read-FrameMeta($lib, [int]$srcFrame) {
  $image = $lib.ReadImage($srcFrame)
  if ($null -eq $image) { return $null }
  return [pscustomobject]@{
    srcFrame = $srcFrame
    w = $image.Bitmap.Width
    h = $image.Bitmap.Height
    offsetX = $image.OffsetX
    offsetY = $image.OffsetY
    image = $image
  }
}

function ConvertTo-JsonFrame($meta, [int]$sheetX) {
  if ($null -eq $meta) {
    return [ordered]@{
      srcFrame = -1
      w = 0
      h = 0
      offsetX = 0
      offsetY = 0
      empty = $true
    }
  }
  return [ordered]@{
    sheetX = $sheetX
    srcFrame = $meta.srcFrame
    w = $meta.w
    h = $meta.h
    offsetX = $meta.offsetX
    offsetY = $meta.offsetY
  }
}

$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight

$blendFrames = @()
if ($atlas.actions.attack1Blend) { $blendFrames = @($atlas.actions.attack1Blend.frames) }
$castFrames = @()
if ($atlas.castEffect) { $castFrames = @($atlas.castEffect.frames) }
$hitFrames = @()
if ($atlas.projectile) { $hitFrames = @($atlas.projectile.frames) }

if ($blendFrames.Count -eq 0 -and $castFrames.Count -eq 0 -and $hitFrames.Count -eq 0) {
  Write-Host "Skip $Index : no FX clips to repack"
  exit 0
}

if (-not $Force) {
  $needsWork = $false
  if ($blendFrames.Count -gt 0 -and -not (Test-AlreadyPacked $blendFrames)) { $needsWork = $true }
  if ($castFrames.Count -gt 0 -and -not (Test-AlreadyPacked $castFrames)) { $needsWork = $true }
  if ($hitFrames.Count -gt 0 -and -not (Test-AlreadyPacked $hitFrames)) { $needsWork = $true }
  if (-not $needsWork) {
    Write-Host "Skip $Index : FX already packed with sheetX"
    exit 0
  }
}

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($BlendSkipActions -contains $prop.Name) { continue }
  $actions[$prop.Name] = $prop.Value
}

$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in $action.Value.frames) {
    $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
  }
}

$bodyWidth = $baseSlots * $slotWidth
$packed = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  foreach ($frame in $blendFrames) {
    $src = Get-SrcFrame $frame
    if ($src -lt 0 -or ($EmptySrcFrames -contains $src)) {
      $packed += [pscustomobject]@{ kind = "blend"; meta = $null; srcFrame = $src }
      continue
    }
    if ($frame.empty -and -not $Force) {
      $packed += [pscustomobject]@{ kind = "blend"; meta = $null; srcFrame = $src }
      continue
    }
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) {
      Write-Warning "$Index missing blend lib frame $src"
      $packed += [pscustomobject]@{ kind = "blend"; meta = $null; srcFrame = $src }
      continue
    }
    $packed += [pscustomobject]@{ kind = "blend"; meta = $meta; srcFrame = $src }
  }

  foreach ($frame in $castFrames) {
    $src = Get-SrcFrame $frame
    if ($src -lt 0 -or $frame.empty) {
      $packed += [pscustomobject]@{ kind = "cast"; meta = $null; srcFrame = $src }
      continue
    }
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) {
      Write-Warning "$Index missing cast lib frame $src"
      $packed += [pscustomobject]@{ kind = "cast"; meta = $null; srcFrame = $src }
      continue
    }
    $packed += [pscustomobject]@{ kind = "cast"; meta = $meta; srcFrame = $src }
  }

  foreach ($frame in $hitFrames) {
    $src = Get-SrcFrame $frame
    if ($src -lt 0 -or $frame.empty) {
      $packed += [pscustomobject]@{ kind = "hit"; meta = $null; srcFrame = $src }
      continue
    }
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) {
      Write-Warning "$Index missing hit lib frame $src"
      $packed += [pscustomobject]@{ kind = "hit"; meta = $null; srcFrame = $src }
      continue
    }
    $packed += [pscustomobject]@{ kind = "hit"; meta = $meta; srcFrame = $src }
  }
}
finally {
  $lib.Dispose()
}

$drawable = @($packed | Where-Object { $null -ne $_.meta })
if ($drawable.Count -eq 0) {
  Write-Warning "Skip $Index : no drawable FX frames"
  exit 0
}

$sheetHeight = $slotHeight
foreach ($entry in $drawable) {
  $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h)
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$blendJson = @()
$castJson = @()
$hitJson = @()
$newWidth = $bodyWidth
foreach ($entry in $drawable) { $newWidth += [int]$entry.meta.w }

try {
  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $copyH = [Math]::Min($slotHeight, $existingCopy.Height)
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $copyH),
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $copyH),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    $sheetX = $bodyWidth
    foreach ($entry in $packed) {
      $frameJson = $null
      if ($null -eq $entry.meta) {
        $frameJson = ConvertTo-JsonFrame $null 0
        if ($entry.srcFrame -ge 0) { $frameJson.srcFrame = $entry.srcFrame }
      }
      else {
        $frameJson = ConvertTo-JsonFrame $entry.meta $sheetX
        $graphics.DrawImage($entry.meta.image.Bitmap, $sheetX, 0, $entry.meta.w, $entry.meta.h)
        $sheetX += [int]$entry.meta.w
        $entry.meta.image.Dispose()
      }

      switch ($entry.kind) {
        "blend" { $blendJson += $frameJson }
        "cast" { $castJson += $frameJson }
        "hit" { $hitJson += $frameJson }
      }
    }

    $tempPath = "$pngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
finally {
  $existingCopy.Dispose()
}

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetHeight = $sheetHeight
  bodyWidth = $bodyWidth
  actions = $actions
}

if ($blendJson.Count -gt 0) {
  $output.actions.attack1Blend = [ordered]@{
    interval = $atlas.actions.attack1Blend.interval
    frames = @($blendJson)
  }
}
if ($castJson.Count -gt 0) {
  $output.castEffect = [ordered]@{
    interval = $atlas.castEffect.interval
    frames = @($castJson)
  }
}
if ($hitJson.Count -gt 0) {
  $output.projectile = [ordered]@{
    style = $atlas.projectile.style
    anchor = $atlas.projectile.anchor
    interval = $atlas.projectile.interval
    frames = @($hitJson)
  }
  foreach ($prop in $atlas.projectile.PSObject.Properties) {
    if ($prop.Name -in @("style", "anchor", "interval", "frames")) { continue }
    $output.projectile[$prop.Name] = $prop.Value
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "$Index : body ${bodyWidth}px + FX packed to ${newWidth}px wide, sheetH=$sheetHeight"
