#!/usr/bin/env pwsh
# Hell Knights (243-246) - Crystal death/appear explode Effect.
# MonsterObject Die (and Appear): Effect(lib, 448, 10, 600) with Blend=true.
# Packed as atlas.dieEffect (time-based, like castEffect).
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int[]]$Indexes = @(243, 244, 245, 246),
  [int]$DieEffectBase = 448,
  [int]$DieEffectCount = 10,
  [int]$DieEffectDurationMs = 600
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$interval = [Math]::Max(1, [int][Math]::Floor($DieEffectDurationMs / $DieEffectCount))

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

foreach ($index in $Indexes) {
  $atlasPath = Join-Path $MonsterRoot "$index.json"
  $pngPath = Join-Path $MonsterRoot "$index.png"
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
  if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  if ($atlas.dieEffect -and @($atlas.dieEffect.frames).Count -ge $DieEffectCount) {
    Write-Host "Skip $index : dieEffect already present"
    continue
  }

  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  $packed = New-Object System.Collections.Generic.List[object]
  try {
    for ($i = 0; $i -lt $DieEffectCount; $i++) {
      $src = $DieEffectBase + $i
      $meta = Read-FrameMeta $lib $src
      if ($null -eq $meta) { throw "$index missing dieEffect lib frame $src" }
      $clone = [System.Drawing.Bitmap]::new($meta.image.Bitmap)
      $meta.image.Dispose()
      $packed.Add([pscustomobject]@{
        srcFrame = $src
        w = $clone.Width
        h = $clone.Height
        offsetX = $meta.offsetX
        offsetY = $meta.offsetY
        Bitmap = $clone
      }) | Out-Null
    }
  }
  finally {
    $lib.Dispose()
  }

  $existing = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
  $existingCopy = [System.Drawing.Bitmap]::new($existing)
  $existing.Dispose()

  $sheetX = $existingCopy.Width
  $sheetHeight = [Math]::Max([int]$atlas.sheetHeight, $existingCopy.Height)
  foreach ($entry in $packed) { $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.h) }
  # Body die frames can be taller than the old 256px sheet - grow if needed.
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($prop.Name -match "Blend$") { continue }
    foreach ($f in @($prop.Value.frames)) {
      if ($null -ne $f.h) { $sheetHeight = [Math]::Max($sheetHeight, [int]$f.h) }
    }
  }

  $fxWidth = 0
  foreach ($entry in $packed) { $fxWidth += [int]$entry.w }
  $newWidth = $sheetX + $fxWidth

  $dieJson = @()
  try {
    $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $g.Clear([System.Drawing.Color]::Transparent)
      $g.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)
      foreach ($entry in $packed) {
        $dieJson += [ordered]@{
          sheetX = $sheetX
          srcFrame = [int]$entry.srcFrame
          w = [int]$entry.w
          h = [int]$entry.h
          offsetX = [int]$entry.offsetX
          offsetY = [int]$entry.offsetY
        }
        $g.DrawImage($entry.Bitmap, $sheetX, 0, $entry.w, $entry.h)
        $sheetX += [int]$entry.w
      }
      $tempPath = "$pngPath.tmp.png"
      $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
    }
    finally {
      $g.Dispose()
      $sheet.Dispose()
    }
  }
  finally {
    $existingCopy.Dispose()
    foreach ($entry in $packed) { $entry.Bitmap.Dispose() }
  }

  $output = [ordered]@{}
  foreach ($prop in $atlas.PSObject.Properties) {
    if ($prop.Name -eq "dieEffect" -or $prop.Name -eq "sheetHeight") { continue }
    $output[$prop.Name] = $prop.Value
  }
  $output.sheetHeight = $sheetHeight
  $output.dieEffect = [ordered]@{
    interval = $interval
    durationMs = $DieEffectDurationMs
    frames = $dieJson
  }

  $json = $output | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($atlasPath, $json, $utf8NoBom)
  Write-Host "Monster $index : dieEffect $DieEffectBase..$($DieEffectBase + $DieEffectCount - 1) (${DieEffectCount}f / ${DieEffectDurationMs}ms), sheet ${newWidth}x${sheetHeight}"
}
