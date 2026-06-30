param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterDir = "$PSScriptRoot\..\public\monsters\monster",
  [int[]]$Indexes = @(40, 49)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

if (-not $MonsterDir) {
  $MonsterDir = Join-Path $PSScriptRoot "..\public\monsters\monster"
}
$MonsterDir = (Resolve-Path -LiteralPath $MonsterDir).Path

$BodySkipActions = @(
  "attack1Blend", "attackRange1Blend", "standingBlend", "walkingBlend", "dieBlend"
)

function Get-BodySlotCount($atlas) {
  $max = -1
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($BodySkipActions -contains $prop.Name) { continue }
    foreach ($frame in $prop.Value.frames) {
      if ($null -ne $frame.slot) { $max = [Math]::Max($max, [int]$frame.slot) }
    }
  }
  return $max + 1
}

function Shift-SheetXFrames($frames, [int]$delta) {
  if ($delta -eq 0 -or -not $frames) { return @($frames) }
  $out = @()
  foreach ($frame in $frames) {
    if ($null -eq $frame) { continue }
    $copy = [ordered]@{}
    foreach ($prop in $frame.PSObject.Properties) {
      if ($prop.Name -eq "sheetX" -and $null -ne $prop.Value) {
        $copy.sheetX = [int]$prop.Value + $delta
      } else {
        $copy[$prop.Name] = $prop.Value
      }
    }
    $out += $copy
  }
  return $out
}

function Shift-FxFramesAfterBodyGrow($frames, [int]$slotWidth, [int]$fxShift) {
  if ($fxShift -eq 0 -or -not $frames) { return @($frames) }
  $out = @()
  foreach ($frame in $frames) {
    if ($null -eq $frame) { continue }
    $copy = [ordered]@{}
    $hasSheetX = $false
    foreach ($prop in $frame.PSObject.Properties) {
      if ($prop.Name -eq "sheetX" -and $null -ne $prop.Value) {
        $copy.sheetX = [int]$prop.Value + $fxShift
        $hasSheetX = $true
      } elseif ($prop.Name -ne "slot") {
        $copy[$prop.Name] = $prop.Value
      }
    }
    if (-not $hasSheetX -and $null -ne $frame.slot) {
      $copy.sheetX = ([int]$frame.slot * $slotWidth) + $fxShift
    }
    $out += $copy
  }
  return $out
}

function Get-MonsterLibActionFrames {
  param([string]$LibraryPath)
  $actionNames = @{
    0  = "standing"
    1  = "walking"
    9  = "attack1"
    14 = "attackRange1"
  }
  $fs = [System.IO.File]::OpenRead($LibraryPath)
  $br = New-Object System.IO.BinaryReader($fs)
  try {
    $null = $br.ReadInt32()
    $null = $br.ReadInt32()
    $frameSeek = $br.ReadInt32()
    $fs.Seek($frameSeek, [System.IO.SeekOrigin]::Begin) | Out-Null
    $frameCount = $br.ReadInt32()
    $actions = [ordered]@{}
    for ($i = 0; $i -lt $frameCount; $i++) {
      $action = [int]$br.ReadByte()
      $start = $br.ReadInt32()
      $count = $br.ReadInt32()
      $skip = $br.ReadInt32()
      $interval = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $reverse = $br.ReadBoolean()
      $null = $br.ReadBoolean()
      if (-not $actionNames.ContainsKey($action)) { continue }
      $actions[$actionNames[$action]] = @{
        start = $start
        count = $count
        offset = $count + $skip
        interval = $interval
        reverse = $reverse
      }
    }
    return $actions
  }
  finally {
    $br.Close()
    $fs.Close()
  }
}

# SwarmMonsterLib replaced by shared PhaseMonsterLib (tools/lib/phase-monster-lib.ps1)

# MirDirection: Up=0, Right=2, Down=4, DownLeft=5, Left=6, UpLeft=7
$directionalActions = @(
  @{ name = "walkNorth"; base = "walking"; direction = 0 }
  @{ name = "walkSouth"; base = "walking"; direction = 4 }
  @{ name = "walkEast"; base = "walking"; direction = 2 }
  @{ name = "walkNorthWest"; base = "walking"; direction = 7 }
  @{ name = "walkSouthWest"; base = "walking"; direction = 5 }
  @{ name = "attackNorthWest"; base = "attack1"; direction = 7 }
  @{ name = "attackSouthWest"; base = "attack1"; direction = 5 }
  @{ name = "standingNorthWest"; base = "standing"; direction = 7 }
  @{ name = "standingSouthWest"; base = "standing"; direction = 5 }
  @{ name = "attackRangeNorthWest"; base = "attackRange1"; direction = 7 }
  @{ name = "attackRangeSouthWest"; base = "attackRange1"; direction = 5 }
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($index in $Indexes) {
  $atlasPath = Join-Path $MonsterDir "$index.json"
  $pngPath = Join-Path $MonsterDir "$index.png"
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Atlas not found: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Sheet not found: $pngPath" }
  if (-not (Test-Path -LiteralPath $library)) { throw "Library not found: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  $libActions = Get-MonsterLibActionFrames -LibraryPath $library
  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight
  $bodySlots = Get-BodySlotCount $atlas
  $oldBodyWidth = if ($atlas.PSObject.Properties.Name -contains "bodyWidth") {
    [int]$atlas.bodyWidth
  } else {
    $bodySlots * $slotWidth
  }
  $nextSlot = $bodySlots

  $newFrames = New-Object System.Collections.Generic.List[object]
  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  try {
    $primaryDirection = [int]$atlas.direction
    if (-not ($atlas.actions.PSObject.Properties.Name -contains "attackRange1")) {
      $rangeSpec = $libActions["attackRange1"]
      if ($null -ne $rangeSpec) {
        for ($i = 0; $i -lt $rangeSpec.count; $i++) {
          $srcFrame = if ($rangeSpec.reverse) {
            $rangeSpec.start - $i
          } else {
            $rangeSpec.start + ($primaryDirection * $rangeSpec.offset) + $i
          }
          $image = $lib.ReadImage($srcFrame)
          $newFrames.Add([pscustomobject]@{
            action = "attackRange1"
            interval = $rangeSpec.interval
            slot = $nextSlot
            srcFrame = $srcFrame
            image = $image
          }) | Out-Null
          $nextSlot += 1
        }
      }
    }

    foreach ($entry in $directionalActions) {
      if ($atlas.actions.PSObject.Properties.Name -contains $entry.name) { continue }
      $spec = $libActions[$entry.base]
      if ($null -eq $spec) { Write-Warning "Missing $($entry.base) in lib $index"; continue }
      for ($i = 0; $i -lt $spec.count; $i++) {
        $srcFrame = if ($spec.reverse) {
          $spec.start - $i
        } else {
          $spec.start + ($entry.direction * $spec.offset) + $i
        }
        $image = $lib.ReadImage($srcFrame)
        $newFrames.Add([pscustomobject]@{
          action = $entry.name
          interval = $spec.interval
          slot = $nextSlot
          srcFrame = $srcFrame
          image = $image
        }) | Out-Null
        $nextSlot += 1
      }
    }
  }
  finally {
    $lib.Dispose()
  }

  if ($newFrames.Count -eq 0) {
    Write-Host "Monster $index already has swarm directional actions"
    continue
  }

  $existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()
  $oldSheetWidth = $existingCopy.Width
  $atlasSheetHeight = if ($null -ne $atlas.sheetHeight) { [int]$atlas.sheetHeight } else { $slotHeight }
  $sheetHeight = ($slotHeight, $atlasSheetHeight, $existingCopy.Height | Measure-Object -Maximum).Maximum
  $fxShift = $newFrames.Count * $slotWidth
  $newBodyWidth = $oldBodyWidth + $fxShift
  $fxRegionWidth = [Math]::Max(0, $oldSheetWidth - $oldBodyWidth)
  $newWidth = $newBodyWidth + $fxRegionWidth
  try {
    $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $copyH = [Math]::Min($sheetHeight, $existingCopy.Height)
      $graphics.DrawImage(
        $existingCopy,
        [System.Drawing.Rectangle]::new(0, 0, $oldBodyWidth, $copyH),
        [System.Drawing.Rectangle]::new(0, 0, $oldBodyWidth, $copyH),
        [System.Drawing.GraphicsUnit]::Pixel
      )
      foreach ($frame in $newFrames) {
        if ($null -eq $frame.image) { continue }
        $graphics.DrawImage(
          $frame.image.Bitmap,
          [int]$frame.slot * $slotWidth,
          0,
          $frame.image.Bitmap.Width,
          $frame.image.Bitmap.Height
        )
      }
      if ($fxRegionWidth -gt 0) {
        $graphics.DrawImage(
          $existingCopy,
          [System.Drawing.Rectangle]::new($newBodyWidth, 0, $fxRegionWidth, $copyH),
          [System.Drawing.Rectangle]::new($oldBodyWidth, 0, $fxRegionWidth, $copyH),
          [System.Drawing.GraphicsUnit]::Pixel
        )
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

  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    $actions[$prop.Name] = $prop.Value
  }
  foreach ($actionName in ($newFrames | ForEach-Object { $_.action } | Select-Object -Unique)) {
    if ($actions.Contains($actionName)) { continue }
    $frames = @($newFrames | Where-Object { $_.action -eq $actionName })
    if ($frames.Count -eq 0) { continue }
    $jsonFrames = @()
    foreach ($frame in $frames) {
      if ($null -eq $frame.image) {
        $jsonFrames += [ordered]@{
          slot = $frame.slot
          srcFrame = $frame.srcFrame
          w = 0
          h = 0
          offsetX = 0
          offsetY = 0
          empty = $true
        }
      } else {
        $jsonFrames += [ordered]@{
          slot = $frame.slot
          srcFrame = $frame.srcFrame
          w = $frame.image.Bitmap.Width
          h = $frame.image.Bitmap.Height
          offsetX = $frame.image.OffsetX
          offsetY = $frame.image.OffsetY
        }
        $frame.image.Dispose()
      }
    }
    $actions[$actionName] = [ordered]@{
      interval = $frames[0].interval
      frames = $jsonFrames
    }
  }

  if ($actions.Contains("attack1Blend") -and $fxShift -gt 0) {
    $blend = $actions.attack1Blend
    $actions.attack1Blend = [ordered]@{
      interval = $blend.interval
      frames = @(Shift-FxFramesAfterBodyGrow $blend.frames $slotWidth $fxShift)
    }
  }
  if ($actions.Contains("attackRange1Blend") -and $fxShift -gt 0) {
    $blend = $actions.attackRange1Blend
    $actions.attackRange1Blend = [ordered]@{
      interval = $blend.interval
      frames = @(Shift-FxFramesAfterBodyGrow $blend.frames $slotWidth $fxShift)
    }
  }

  $output = [ordered]@{
    layer = $atlas.layer
    index = $atlas.index
    direction = $atlas.direction
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    sheetHeight = $sheetHeight
    bodyWidth = $newBodyWidth
    actions = $actions
  }
  if ($atlas.castEffect) {
    $output.castEffect = [ordered]@{
      interval = $atlas.castEffect.interval
      frames = @(Shift-SheetXFrames $atlas.castEffect.frames $fxShift)
    }
  }
  if ($atlas.projectile) {
    $output.projectile = [ordered]@{}
    foreach ($prop in $atlas.projectile.PSObject.Properties) {
      if ($prop.Name -eq "frames") {
        $output.projectile.frames = @(Shift-SheetXFrames $prop.Value $fxShift)
      } else {
        $output.projectile[$prop.Name] = $prop.Value
      }
    }
  }
  foreach ($prop in $atlas.PSObject.Properties) {
    if ($prop.Name -in @(
      "layer", "index", "direction", "slotWidth", "slotHeight", "sheetHeight",
      "bodyWidth", "actions", "castEffect", "projectile"
    )) { continue }
    $output[$prop.Name] = $prop.Value
  }
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Appended swarm directions to monster $index ($($newFrames.Count) frames, bodyWidth=$newBodyWidth, fxShift=$fxShift)"
}
