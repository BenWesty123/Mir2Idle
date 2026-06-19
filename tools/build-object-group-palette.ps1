param(
  [string]$ReviewRoot = "../tile-review/wooma-temple-object-picker",
  [string]$OutputRoot = "../public/mapobjects",
  [string]$SheetName = "wooma-temple-picked-groups.png",
  [string]$IndexName = "index.json",
  [string]$SetId = "wooma-temple-picked-groups",
  [string]$Label = "Wooma Temple Picked Groups",
  [int[]]$Groups = @(3, 4, 5, 6, 7)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$reviewPath = Join-Path $PSScriptRoot $ReviewRoot
$metadataPath = Join-Path $reviewPath "objects.json"
if (-not (Test-Path $metadataPath)) {
  throw "Object picker metadata not found: $metadataPath"
}

$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$picked = foreach ($groupNumber in $Groups) {
  $group = $metadata.groups | Where-Object { $_.Number -eq $groupNumber } | Select-Object -First 1
  if ($null -eq $group) {
    throw "Group $groupNumber was not found in $metadataPath"
  }
  $group
}

$bitmaps = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1
try {
  foreach ($group in $picked) {
    $imagePath = Join-Path $reviewPath $group.File
    if (-not (Test-Path $imagePath)) {
      throw "Group image not found: $imagePath"
    }
    $bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)
    $bitmaps.Add($bitmap)
    $slotWidth = [Math]::Max($slotWidth, $bitmap.Width)
    $slotHeight = [Math]::Max($slotHeight, $bitmap.Height)
  }

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $bitmaps.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    for ($slot = 0; $slot -lt $bitmaps.Count; $slot++) {
      $bitmap = $bitmaps[$slot]
      $graphics.DrawImageUnscaled($bitmap, $slot * $slotWidth, $slotHeight - $bitmap.Height)
    }
  }
  finally {
    $graphics.Dispose()
  }

  $outRoot = Join-Path $PSScriptRoot $OutputRoot
  New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
  $sheetPath = Join-Path $outRoot $SheetName
  $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()
}
finally {
  foreach ($bitmap in $bitmaps) { $bitmap.Dispose() }
}

$objects = @()
for ($slot = 0; $slot -lt $picked.Count; $slot++) {
  $group = $picked[$slot]
  $objects += [ordered]@{
    slot = $slot
    srcGroup = [int]$group.Number
    frames = [string]$group.Frames
    w = [int]$group.Width
    h = [int]$group.Height
    offsetX = 0
    offsetY = 0
  }
}

$indexPath = Join-Path $outRoot $IndexName
if (Test-Path $indexPath) {
  $index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
  $existing = @($index.sets | Where-Object { $_.id -ne $SetId })
} else {
  $existing = @()
}

$custom = [ordered]@{
  id = $SetId
  label = $Label
  sheet = $SheetName
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  objects = $objects
}

$index = [ordered]@{
  sets = @($custom) + $existing
}
$index | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $indexPath -Encoding UTF8

Write-Output "${Label}: exported $($objects.Count) groups"
Write-Output ($objects | ForEach-Object { "$($_.slot): group $($_.srcGroup) ($($_.frames))" })
