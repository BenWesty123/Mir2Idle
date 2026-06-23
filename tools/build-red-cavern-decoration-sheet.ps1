param(
  [string]$CatalogRoot = "../tile-review/red-cavern-prop-catalog",
  [int[]]$AssemblyNumbers = @(),
  # Pick catalog numbers from tile-review/red-cavern-decoration-picker/index.html, then rebuild.
  [string]$OutputRoot = "../public/mapobjects",
  [string]$SheetName = "red-cavern-catalog.png",
  [string]$SetId = "red-cavern-catalog",
  [string]$Label = "Red Cavern Catalog Decor"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ($AssemblyNumbers.Count -eq 0) {
  throw "AssemblyNumbers is empty. Open tile-review/red-cavern-decoration-picker/index.html, pick catalog numbers, then pass -AssemblyNumbers @(1, 2, ...)"
}

$catalogPath = Join-Path $PSScriptRoot $CatalogRoot
$catalogRaw = Get-Content -LiteralPath (Join-Path $catalogPath "catalog.json") -Raw
$catalog = $catalogRaw | ConvertFrom-Json
$byNumber = @{}
foreach ($group in $catalog.groups) { $byNumber[[int]$group.Number] = $group }

$bitmaps = New-Object System.Collections.Generic.List[object]
$objects = New-Object System.Collections.Generic.List[object]
try {
  foreach ($number in $AssemblyNumbers) {
    if (-not $byNumber.ContainsKey($number)) { throw "Catalog group #$number not found" }
    $group = $byNumber[$number]
    $path = Join-Path $catalogPath $group.AssemblyFile
    if (-not (Test-Path $path)) { throw "Missing assembly PNG: $path" }
    $bitmap = [System.Drawing.Bitmap]::FromFile($path)
    $bitmaps.Add($bitmap)
    $objects.Add([ordered]@{
      slot = $objects.Count
      srcCatalog = $number
      w = [int]$group.Width
      h = [int]$group.Height
      offsetX = 0
      offsetY = 0
    })
  }

  $slotWidth = ($objects | ForEach-Object { $_.w } | Measure-Object -Maximum).Maximum
  $slotHeight = ($objects | ForEach-Object { $_.h } | Measure-Object -Maximum).Maximum
  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $objects.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    for ($slot = 0; $slot -lt $bitmaps.Count; $slot++) {
      $bitmap = $bitmaps[$slot]
      $graphics.DrawImageUnscaled($bitmap, $slot * $slotWidth, $slotHeight - $bitmap.Height)
    }
    $outDir = Join-Path $PSScriptRoot $OutputRoot
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $sheetPath = Join-Path $outDir $SheetName
    $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }

  $indexPath = Join-Path $outDir "index.json"
  $index = if (Test-Path $indexPath) { Get-Content $indexPath -Raw | ConvertFrom-Json } else { [ordered]@{ sets = @() } }
  $existing = @($index.sets | Where-Object { $_.id -ne $SetId })
  $entry = [ordered]@{
    id = $SetId
    label = $Label
    sheet = $SheetName
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    objects = @($objects.ToArray())
  }
  $index.sets = @($entry) + $existing
  $json = $index | ConvertTo-Json -Depth 20
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($indexPath, $json, $utf8NoBom)

  Write-Host "Red Cavern decoration sheet: $sheetPath ($slotWidth x $slotHeight, $($objects.Count) slots)"
  $objects | ForEach-Object { Write-Host "  slot $($_.slot) <- catalog #$($_.srcCatalog) ($($_.w)x$($_.h))" }
}
finally {
  foreach ($bitmap in $bitmaps) { if ($null -ne $bitmap) { $bitmap.Dispose() } }
}
