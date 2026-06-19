param(
  [string]$CatalogRoot = "../tile-review/bdd-prop-catalog",
  [int[]]$AssemblyNumbers = @(10, 12, 11, 14, 32, 28, 23),
  [string]$OutputRoot = "../public/mapobjects",
  [string]$SheetName = "bdd-dungeon-catalog.png",
  [string]$SetId = "bdd-dungeon-catalog",
  [string]$Label = "Black Dragon Dungeon Catalog Decor"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

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
  $index | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $indexPath -Encoding UTF8

  Write-Host "BDD decoration sheet: $sheetPath ($slotWidth x $slotHeight, $($objects.Count) slots)"
  $objects | ForEach-Object { Write-Host "  slot $($_.slot) <- catalog #$($_.srcCatalog) ($($_.w)x$($_.h))" }
}
finally {
  foreach ($bitmap in $bitmaps) { if ($null -ne $bitmap) { $bitmap.Dispose() } }
}
