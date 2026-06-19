param(
  [string]$CatalogRoot = "../tile-review/bdd-prop-catalog",
  [string]$OutputRoot = "../tile-review/bdd-decoration-picker",
  [int]$MaxItems = 64,
  [int]$Columns = 6,
  [int]$CellWidth = 180,
  [int]$CellHeight = 240,
  [int]$LabelHeight = 32
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
$font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$smallFont = New-Object System.Drawing.Font("Segoe UI", 8)
$brush = [System.Drawing.Brushes]::Gainsboro
$muted = [System.Drawing.Brushes]::DarkGray
$bg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 24, 22, 18))
$cards = New-Object System.Collections.Generic.List[string]
$manifest = New-Object System.Collections.Generic.List[object]

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
      $scale = [Math]::Min(($CellWidth - 24) / $bitmap.Width, ($CellHeight - 32) / $bitmap.Height)
      $drawW = [Math]::Max(1, [Math]::Floor($bitmap.Width * $scale))
      $drawH = [Math]::Max(1, [Math]::Floor($bitmap.Height * $scale))
      $drawX = $x + [Math]::Floor(($CellWidth - $drawW) / 2)
      $drawY = $y + $LabelHeight + [Math]::Floor(($CellHeight - $drawH) / 2)
      $graphics.DrawImage($bitmap, $drawX, $drawY, $drawW, $drawH)
    }
    finally {
      $bitmap.Dispose()
    }

    $graphics.DrawString("#$($group.Number)", $font, $brush, $x + 8, $y + 6)
    $graphics.DrawString("$($group.Category) · $($group.Count)x · $($group.Width)x$($group.Height)", $smallFont, $muted, $x + 8, $y + 22)

    $manifest.Add([ordered]@{
      Number = [int]$group.Number
      Category = $group.Category
      Count = [int]$group.Count
      Width = [int]$group.Width
      Height = [int]$group.Height
      Frames = $group.Frames
      AssemblyFile = $group.AssemblyFile
      SheetSlot = $null
    })

    $cards.Add(@"
    <article class="card" id="catalog-$($group.Number)">
      <header><strong>#$($group.Number)</strong> <span class="badge">$($group.Category)</span> <span class="muted">used $($group.Count)x</span></header>
      <figure class="assembly">
        <img src="../bdd-prop-catalog/$($group.AssemblyFile)" alt="#$($group.Number)" loading="lazy" />
        <figcaption>Assembly</figcaption>
      </figure>
      <figure class="preview">
        <img src="../bdd-prop-catalog/$($group.PreviewFile)" alt="In-map #$($group.Number)" loading="lazy" />
        <figcaption>In-map preview</figcaption>
      </figure>
      <p class="meta">$($group.Width)x$($group.Height) · <code>$($group.Frames)</code></p>
      <p class="pick">Reply: <code>use bdd decor #$($group.Number)</code></p>
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
  $smallFont.Dispose()
  if ($null -ne $bg) { $bg.Dispose() }
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outRoot "manifest.json") -Encoding UTF8

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>BDD Decoration Picker</title>
    <style>
      :root { color-scheme: dark; --zoom: 1; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #12110f; color: #ece6d8; font: 13px/1.45 Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 5; padding: 16px 18px; border-bottom: 1px solid #4a3f2c; background: #1c1914; }
      h1 { margin: 0 0 6px; color: #f4dfb0; font-size: 22px; }
      header p { margin: 0 0 6px; color: #b9ad94; max-width: 960px; }
      .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 10px; }
      .controls input[type=range] { width: 180px; }
      .filter-btn { border: 1px solid #5a4c34; background: #2a241b; color: #f2e5c8; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
      .filter-btn.active { background: #5c4a28; border-color: #c9a962; }
      .sheet { padding: 16px; }
      .sheet img { width: min(100%, 1400px); image-rendering: pixelated; border: 1px solid #3b3224; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 16px; }
      .card { border: 1px solid #3b3224; background: #1a1712; padding: 10px; display: grid; gap: 8px; }
      .card.hidden { display: none; }
      .card header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #3a3020; color: #f6e7bc; }
      .muted { color: #9f947d; font-size: 12px; }
      figure { margin: 0; display: grid; gap: 4px; }
      figcaption { font-size: 11px; color: #8f846c; }
      .assembly img, .preview img {
        width: calc(var(--w, 120) * 1px * var(--zoom));
        height: calc(var(--h, 200) * 1px * var(--zoom));
        image-rendering: pixelated;
        object-fit: contain;
        max-width: 100%;
        background: #0e0d0b;
        border: 1px solid #333027;
      }
      .assembly img { background: repeating-conic-gradient(#2a2620 0% 25%, #1a1814 0% 50%) 50% / 16px 16px; }
      .meta { margin: 0; color: #9f947d; font-size: 11px; word-break: break-all; }
      .pick { margin: 0; color: #d5c6aa; font-size: 12px; }
      code { color: #e8c978; }
    </style>
  </head>
  <body>
    <header>
      <h1>Black Dragon Dungeon Decoration Picker</h1>
      <p>All $($groups.Count) props from Crystal <code>D2001.map</code>. Pick catalog numbers for corridor decoration — no edge walls. Full catalog: <a href="../bdd-prop-catalog/index.html">bdd-prop-catalog</a></p>
      <p>Game sheet: <code>public/mapobjects/bdd-dungeon-catalog.png</code> · set id <code>bdd-dungeon-catalog</code></p>
      <div class="controls">
        <label>Zoom <input id="zoom" type="range" min="0.5" max="2" step="0.1" value="1" /><output id="zoomValue">1x</output></label>
        <button type="button" class="filter-btn active" data-filter="all">All</button>
        <button type="button" class="filter-btn" data-filter="tall-single">Tall single</button>
        <button type="button" class="filter-btn" data-filter="assembly">Multi-part</button>
      </div>
    </header>
    <section class="sheet">
      <h2>Overview sheet</h2>
      <img src="picker-sheet.png" alt="BDD decoration picker sheet" />
    </section>
    <section class="grid">
$($cards -join "`n")
    </section>
    <script>
      const slider = document.querySelector("#zoom");
      const output = document.querySelector("#zoomValue");
      const cards = Array.from(document.querySelectorAll(".card"));
      function applyZoom() {
        document.documentElement.style.setProperty("--zoom", slider.value);
        output.value = slider.value + "x";
      }
      function applyFilter(kind) {
        cards.forEach((card) => {
          const badge = card.querySelector(".badge")?.textContent || "";
          const hide = kind !== "all" && badge !== kind;
          card.classList.toggle("hidden", hide);
        });
      }
      slider.addEventListener("input", applyZoom);
      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          applyFilter(btn.dataset.filter);
        });
      });
      applyZoom();
    </script>
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Encoding UTF8
Write-Host "BDD decoration picker: $sheetPath ($($groups.Count) items)"
Write-Host "Open: $(Resolve-Path (Join-Path $outRoot 'index.html'))"
