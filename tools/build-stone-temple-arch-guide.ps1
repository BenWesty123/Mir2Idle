param(
  [string]$MotifRoot = "../tile-review/stone-temple-arch-motifs",
  [string]$CatalogRoot = "../tile-review/stone-temple-prop-catalog",
  [int[]]$MotifIds = @(1, 2, 3, 7, 21, 60),
  [int[]]$SingleCornerFrames = @(4053, 4060, 4061, 4974, 4976, 4983)
)

$ErrorActionPreference = "Stop"
$motifPath = Join-Path $PSScriptRoot $MotifRoot
$catPath = Join-Path $PSScriptRoot $CatalogRoot
$motifCatalog = Get-Content (Join-Path $motifPath "catalog.json") -Raw | ConvertFrom-Json
$propCatalog = Get-Content (Join-Path $catPath "catalog.json") -Raw | ConvertFrom-Json

function Html([string]$v) { [System.Net.WebUtility]::HtmlEncode($v) }

$byMotif = @{}
foreach ($g in $motifCatalog.groups) { $byMotif[[int]$g.Number] = $g }

$byProp = @{}
foreach ($g in $propCatalog.groups) { $byProp[[int]$g.Number] = $g }

$wrongNote = @"
<p class="warn"><strong>Previous picks were wrong.</strong> Catalog #5 (frames 5621&ndash;5626) is floor rubble (48&times;32 pebbles), not an arch. #6/#7 (4120/4170) are different corner props. The real Stone Temple pillar arches use <code>Objects7</code> frames in the <code>4048&ndash;4080</code> and <code>4974&ndash;4983</code> families, placed across several map cells with walkable gaps between pillars.</p>
"@

$motifCards = foreach ($id in $MotifIds) {
  $m = $byMotif[$id]
  if ($null -eq $m) { continue }
@"
    <article class="card">
      <div class="head"><strong>Motif #$id</strong> <span class="badge ok">$($m.Count)&times; on maps</span></div>
      <img src="../stone-temple-arch-motifs/$($m.AssemblyFile)" alt="motif $id" loading="lazy" />
      <p>$($m.CellCount) cells ($($m.TallCount) tall pillars) &middot; seed <code>$(Html $m.SeedFrame)</code></p>
      <p class="frames"><code>$(Html $m.Frames)</code></p>
    </article>
"@
}

$singleTiles = foreach ($f in $SingleCornerFrames) {
  $src = "../stone-temple-tall-4048/images/frame_{0:D6}.png" -f $f
  if ($f -ge 4970) { $src = "../stone-temple-all-4974/images/frame_{0:D6}.png" -f $f }
@"
    <article class="tile">
      <img src="$src" alt="frame $f" loading="lazy" />
      <strong>Objects7:$f</strong>
      <span>One map cell &mdash; corner pillar + lintel sprite</span>
    </article>
"@
}

$badCards = foreach ($id in @(5, 6, 7, 65, 122)) {
  $p = $byProp[$id]
  if ($null -eq $p) { continue }
  $label = switch ($id) {
    5 { "WRONG: floor rubble (5621-5626 are 48x32)" }
    6 { "WRONG pick: not the main temple arch" }
    7 { "WRONG pick: not the main temple arch" }
    65 { "Wall chunk, not pillar arch" }
    122 { "Objects.Lib snippet, rare on these maps" }
    default { "" }
  }
@"
    <article class="card bad">
      <div class="head"><strong>Old catalog #$id</strong> <span class="badge bad">$label</span></div>
      <img src="../stone-temple-prop-catalog/$($p.AssemblyFile)" alt="bad $id" loading="lazy" />
      <p class="frames"><code>$(Html $p.Frames)</code></p>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Stone Temple Pillar Arch (corrected)</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font: 14px Segoe UI, sans-serif; }
    header { padding: 16px 20px; background: #1a1a1a; border-bottom: 1px solid #333; }
    h1 { margin: 0 0 8px; }
    p { margin: 0 0 8px; color: #bbb; line-height: 1.5; max-width: 920px; }
    .warn { background: #3a2a10; border: 1px solid #6a5020; padding: 10px 12px; border-radius: 6px; color: #f0d8a8; }
    section { padding: 16px 20px; border-bottom: 1px solid #2a2a2a; }
    h2 { margin: 0 0 12px; font-size: 17px; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .card { background: #1c1c1c; border: 1px solid #333; padding: 12px; display: grid; gap: 8px; }
    .card.bad { opacity: 0.75; border-color: #522; }
    .card img { width: 100%; height: 240px; object-fit: contain; image-rendering: pixelated; background: #050505; }
    .badge { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
    .badge.ok { background: #2d4a2d; color: #9fdf9f; }
    .badge.bad { background: #4a2020; color: #efb0b0; }
    .frames { font-size: 11px; color: #999; word-break: break-all; margin: 0; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .tile { background: #1c1c1c; border: 1px solid #333; padding: 8px; text-align: center; }
    .tile img { width: 72px; height: 200px; object-fit: contain; image-rendering: pixelated; background: #050505; }
    code { color: #c9e6ff; }
    a { color: #8cf; }
  </style>
</head>
<body>
  <header>
    <h1>Stone Temple pillar arch (corrected)</h1>
    $wrongNote
    <p>Full walk-through arches are built from several adjacent map cells. The old catalog only joined <em>touching</em> cells, so it merged pebble floor tiles and missed arches with gaps between pillars.</p>
    <p><a href="../stone-temple-arch-motifs/index.html">Open full arch-motif catalog (60 placements)</a> &middot; <a href="index.html">Original prop catalog</a></p>
  </header>
  <section>
    <h2>Real arch placements from D711&ndash;D717 (gap-tolerant grouping)</h2>
    <main>
$($motifCards -join "`n")
    </main>
  </section>
  <section>
    <h2>Single-cell corner pieces (Objects7) &mdash; one slice of an arch</h2>
    <div class="tiles">
$($singleTiles -join "`n")
    </div>
  </section>
  <section>
    <h2>Previously highlighted (incorrect)</h2>
    <main>
$($badCards -join "`n")
    </main>
  </section>
</body>
</html>
"@

$out = Join-Path $catPath "pillar-arch-guide.html"
$html | Set-Content $out -Encoding UTF8
Write-Host "Wrote $out"
