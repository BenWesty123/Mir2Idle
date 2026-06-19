param(
  [string]$CatalogRoot = "../tile-review/prajna-temple-prop-catalog",
  [string]$OutputRoot = "../tile-review/prajna-temple-decoration-picker",
  [int]$MaxItems = 48,
  [int]$Columns = 6,
  [int]$CellWidth = 160,
  [int]$CellHeight = 220,
  [int]$LabelHeight = 28
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$catalogPath = Join-Path $PSScriptRoot $CatalogRoot
$catalog = Get-Content -LiteralPath (Join-Path $catalogPath "catalog.json") -Raw | ConvertFrom-Json
$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$groups = @(
  $catalog.groups |
    Where-Object { $_.Category -in @("assembly", "tall-single", "other") } |
    Sort-Object Count -Descending |
    Select-Object -First $MaxItems
)

$rows = [Math]::Ceiling($groups.Count / $Columns)
$sheetWidth = $Columns * $CellWidth
$sheetHeight = $rows * ($CellHeight + $LabelHeight)
$sheet = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Gainsboro
$bg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 24, 22, 18))
$cards = New-Object System.Collections.Generic.List[string]

try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 18, 16, 14))
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  for ($index = 0; $index -lt $groups.Count; $index++) {
    $group = $groups[$index]
    $col = $index % $Columns
    $row = [Math]::Floor($index / $Columns)
    $x = $col * $CellWidth
    $y = $row * ($CellHeight + $LabelHeight)

    $graphics.FillRectangle($bg, $x + 4, $y + 4, $CellWidth - 8, $CellHeight + $LabelHeight - 8)

    $assemblyPath = Join-Path $catalogPath $group.AssemblyFile
    if (-not (Test-Path $assemblyPath)) { throw "Missing assembly PNG: $assemblyPath" }
    $bitmap = [System.Drawing.Bitmap]::FromFile($assemblyPath)
    try {
      $scale = [Math]::Min(($CellWidth - 24) / $bitmap.Width, ($CellHeight - 24) / $bitmap.Height)
      $drawW = [Math]::Max(1, [Math]::Floor($bitmap.Width * $scale))
      $drawH = [Math]::Max(1, [Math]::Floor($bitmap.Height * $scale))
      $drawX = $x + [Math]::Floor(($CellWidth - $drawW) / 2)
      $drawY = $y + $LabelHeight + [Math]::Floor(($CellHeight - $drawH) / 2)
      $graphics.DrawImage($bitmap, $drawX, $drawY, $drawW, $drawH)
    }
    finally {
      $bitmap.Dispose()
    }

    $label = "#$($group.Number)  $($group.Category)  used $($group.Count)x  $($group.Width)x$($group.Height)"
    $graphics.DrawString($label, $font, $brush, $x + 8, $y + 6)

    $cards.Add(@"
    <article class="card">
      <header><strong>#$($group.Number)</strong> <span>$($group.Category)</span> <span>used $($group.Count)x</span></header>
      <img src="../prajna-temple-prop-catalog/$($group.AssemblyFile)" alt="#$($group.Number)" loading="lazy" />
      <p>$($group.Width)x$($group.Height) · $($group.Frames)</p>
    </article>
"@)
  }

  $sheetPath = Join-Path $outRoot "picker-sheet.png"
  $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $sheet.Dispose()
  $font.Dispose()
  if ($null -ne $bg) { $bg.Dispose() }
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prajna Temple Decoration Picker</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #12110f; color: #ece6d8; font: 13px/1.45 Segoe UI, sans-serif; }
      header { padding: 16px 18px; border-bottom: 1px solid #4a3f2c; background: #1c1914; }
      h1 { margin: 0 0 6px; color: #f4dfb0; font-size: 22px; }
      p { margin: 0; color: #b9ad94; max-width: 920px; }
      .sheet { padding: 16px; }
      .sheet img { width: min(100%, 1200px); image-rendering: pixelated; border: 1px solid #3b3224; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; padding: 16px; }
      .card { border: 1px solid #3b3224; background: #1a1712; padding: 10px; display: grid; gap: 8px; }
      .card header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: #e8c978; }
      .card img { width: 100%; image-rendering: pixelated; background: #0e0d0b; }
      .card p { margin: 0; color: #9f947d; font-size: 12px; word-break: break-all; }
      code { color: #e8c978; }
    </style>
  </head>
  <body>
    <header>
      <h1>Prajna Temple Decoration Picker</h1>
      <p>Top $($groups.Count) decorations from Crystal D207 maps. Pick catalog numbers here, then set <code>AssemblyNumbers</code> in <code>tools/build-prajna-temple-decoration-sheet.ps1</code> and rebuild the game sheet.</p>
      <p>Full catalog with in-map previews: <a href="../prajna-temple-prop-catalog/index.html">prajna-temple-prop-catalog/index.html</a></p>
    </header>
    <section class="sheet">
      <img src="picker-sheet.png" alt="Prajna Temple decoration picker sheet" />
    </section>
    <section class="grid">
$($cards -join "`n")
    </section>
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Encoding UTF8
Write-Host "Prajna Temple decoration picker: $sheetPath ($($groups.Count) items)"
Write-Host "Open: $(Resolve-Path (Join-Path $outRoot 'index.html'))"
