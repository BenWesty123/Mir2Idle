# Pack Fox Man ranged FX into monster atlases 128 / 129.
# Red Fox (128): Crystal Type0 impact Mon128 224x9 @300ms → projectile targetBurst
# White Fox (129): Magic 1160x3 travel bolt + Mon129 352x10 impact → travel + impactFrames
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [ValidateSet("red", "white", "both")]
  [string]$Which = "both"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")

function Read-PackedFrame($lib, [int]$srcFrame) {
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

function Pack-FoxAtlas {
  param(
    [int]$Index,
    [hashtable]$Spec
  )

  $atlasPath = Join-Path $MonsterRoot "$Index.json"
  $pngPath = Join-Path $MonsterRoot "$Index.png"
  $monsterLibPath = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
  if (-not (Test-Path -LiteralPath $monsterLibPath)) { throw "Missing lib: $monsterLibPath" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json

  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight
  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    if ($prop.Name -in @("attack1Blend", "attackRange1Blend")) { continue }
    $actions[$prop.Name] = $prop.Value
  }
  if (-not $actions.Contains("attackRange1")) {
    if (-not $actions.Contains("attack1")) { throw "Atlas $Index missing attack1 to clone as attackRange1" }
    $actions["attackRange1"] = $actions["attack1"]
  }

  $baseSlots = 0
  foreach ($action in $actions.GetEnumerator()) {
    foreach ($frame in @($action.Value.frames)) {
      if ($null -ne $frame.slot) { $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1) }
    }
  }
  $bodyWidth = $baseSlots * $slotWidth

  $packed = New-Object System.Collections.Generic.List[object]
  $monsterLib = [PhaseMonsterLib]::new((Resolve-Path $monsterLibPath))
  try {
    foreach ($src in @($Spec.HitFrames)) {
      $meta = Read-PackedFrame $monsterLib $src
      if ($null -eq $meta) { throw "Missing hit frame $src in Monster $Index" }
      $packed.Add([pscustomobject]@{ kind = "hit"; meta = $meta })
    }
  }
  finally { $monsterLib.Dispose() }

  if ($Spec.TravelFrames) {
    $magicLib = [PhaseMonsterLib]::new((Resolve-Path (Join-Path $DataRoot "Magic.Lib")))
    try {
      foreach ($src in @($Spec.TravelFrames)) {
        $meta = Read-PackedFrame $magicLib $src
        if ($null -eq $meta) { throw "Missing Magic.Lib travel frame $src" }
        $packed.Add([pscustomobject]@{ kind = "travel"; meta = $meta })
      }
    }
    finally { $magicLib.Dispose() }
  }

  $sheetHeight = $slotHeight
  foreach ($entry in $packed) { $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h) }

  $existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()

  $sheetX = $bodyWidth
  $hitJson = @()
  $travelJson = @()
  try {
    $newWidth = $bodyWidth
    foreach ($entry in $packed) { $newWidth += [int]$entry.meta.w }

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
        $m = $entry.meta
        $frameJson = [ordered]@{
          sheetX = $sheetX
          srcFrame = $m.srcFrame
          w = $m.w
          h = $m.h
          offsetX = $m.offsetX
          offsetY = $m.offsetY
        }
        if ($entry.kind -eq "travel") { $travelJson += $frameJson } else { $hitJson += $frameJson }
        $graphics.DrawImage($m.image.Bitmap, $sheetX, 0, $m.w, $m.h)
        $sheetX += [int]$m.w
        $m.image.Dispose()
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

  $projectile = if ($Spec.Style -eq "travel") {
    [ordered]@{
      style = "travel"
      rotate = $true
      baseFrame = 0
      baseAngleDeg = 180
      interval = 30
      frames = @($travelJson)
      impactInterval = 60
      impactBurstDurationMs = 600
      impactFrames = @($hitJson)
    }
  } else {
    [ordered]@{
      style = "targetBurst"
      anchor = "target"
      interval = [int]$Spec.HitInterval
      # Align with prajnaGuard attackImpactDelayMs so the hit plays on the target at land time.
      burstDelayMs = [int]$(if ($null -ne $Spec.BurstDelayMs) { $Spec.BurstDelayMs } else { 500 })
      burstDurationMs = [int]$Spec.BurstDurationMs
      frames = @($hitJson)
    }
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
    projectile = $projectile
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Fox Man $Index ($($Spec.Label)): packed FX → ${newWidth}px wide, sheetH=$sheetHeight, style=$($Spec.Style)"
}

$specs = @{
  red = @{
    Index = 128
    Label = "RedFoxman"
    Style = "targetBurst"
    HitFrames = 224..232
    HitInterval = 33
    BurstDelayMs = 500
    BurstDurationMs = 300
  }
  white = @{
    Index = 129
    Label = "WhiteFoxman"
    Style = "travel"
    TravelFrames = 1160..1162
    HitFrames = 352..361
  }
}

$run = if ($Which -eq "both") { @("red", "white") } else { @($Which) }
foreach ($key in $run) {
  $spec = $specs[$key]
  Pack-FoxAtlas -Index ([int]$spec.Index) -Spec $spec
}
