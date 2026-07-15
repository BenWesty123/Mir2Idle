# Pack Crystal Thunder/Cloud Element Attack1 DrawBlend (lib frames 64+FrameIndex)
# into attack1Blend on atlases 132 / 133 using sheetX (tall FX wider than body slots).
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [ValidateSet("electric", "cloud", "both")]
  [string]$Which = "both"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

function Pack-ElementBlend {
  param([int]$Index, [string]$Label)

  $atlasPath = Join-Path $MonsterRoot "$Index.json"
  $pngPath = Join-Path $MonsterRoot "$Index.png"
  $libPath = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
  if (-not (Test-Path -LiteralPath $libPath)) { throw "Missing lib: $libPath" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight
  $attack = $atlas.actions.attack1
  if (-not $attack -or -not $attack.frames) { throw "Atlas $Index missing attack1" }
  $attackCount = @($attack.frames).Count

  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($prop.Name -match "Blend$") { continue }
    $actions[$prop.Name] = $prop.Value
  }

  $baseSlots = 0
  foreach ($action in $actions.GetEnumerator()) {
    foreach ($frame in @($action.Value.frames)) {
      if ($null -ne $frame.slot) { $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1) }
    }
  }
  $bodyWidth = $baseSlots * $slotWidth

  $packed = New-Object System.Collections.Generic.List[object]
  $lib = [PhaseMonsterLib]::new((Resolve-Path $libPath))
  try {
    for ($i = 0; $i -lt $attackCount; $i++) {
      $src = 64 + $i
      $image = $lib.ReadImage($src)
      if ($null -eq $image) {
        $packed.Add([pscustomobject]@{
          empty = $true
          srcFrame = $src
          w = 0; h = 0; offsetX = 0; offsetY = 0
          image = $null
        })
        continue
      }
      $packed.Add([pscustomobject]@{
        empty = $false
        srcFrame = $src
        w = $image.Bitmap.Width
        h = $image.Bitmap.Height
        offsetX = $image.OffsetX
        offsetY = $image.OffsetY
        image = $image
      })
    }
  }
  finally { $lib.Dispose() }

  if (-not ($packed | Where-Object { -not $_.empty })) {
    throw "No blend frames found for $Label ($Index)"
  }

  $sheetHeight = $slotHeight
  foreach ($entry in $packed) {
    if (-not $entry.empty) { $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.h) }
  }

  $existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()

  $sheetX = $bodyWidth
  $blendJson = @()
  try {
    $newWidth = $bodyWidth
    foreach ($entry in $packed) {
      if (-not $entry.empty) { $newWidth += [int]$entry.w }
    }

    $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage(
        $existingCopy,
        [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $slotHeight),
        [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, [Math]::Min($slotHeight, $existingCopy.Height)),
        [System.Drawing.GraphicsUnit]::Pixel
      )

      foreach ($entry in $packed) {
        if ($entry.empty) {
          $blendJson += [ordered]@{
            sheetX = $sheetX; srcFrame = $entry.srcFrame
            w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true
          }
          continue
        }
        $blendJson += [ordered]@{
          sheetX = $sheetX
          srcFrame = $entry.srcFrame
          w = $entry.w
          h = $entry.h
          offsetX = $entry.offsetX
          offsetY = $entry.offsetY
        }
        $graphics.DrawImage($entry.image.Bitmap, $sheetX, 0, $entry.w, $entry.h)
        $sheetX += [int]$entry.w
        $entry.image.Dispose()
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

  $actions["attack1Blend"] = [ordered]@{
    interval = [int]$attack.interval
    frames = @($blendJson)
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
  if ($atlas.projectile) { $output.projectile = $atlas.projectile }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Element $Index ($Label): attack1Blend ×$attackCount → ${newWidth}px wide, sheetH=$sheetHeight"
}

$specs = @{
  electric = @{ Index = 132; Label = "ElectricElement" }
  cloud = @{ Index = 133; Label = "CloudElement" }
}
$run = if ($Which -eq "both") { @("electric", "cloud") } else { @($Which) }
foreach ($key in $run) {
  $spec = $specs[$key]
  Pack-ElementBlend -Index ([int]$spec.Index) -Label $spec.Label
}
