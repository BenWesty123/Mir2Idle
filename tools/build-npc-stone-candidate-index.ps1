param(
  [string]$ReviewRoot = "../tile-review/npc-stone-candidates"
)

$root = Join-Path $PSScriptRoot $ReviewRoot
$candidates = @(
  @{ id = "gm-stone-12"; label = "GM_Stone"; source = "NPC/12.Lib"; db = "GM/GM-Stone" },
  @{ id = "timestone-33"; label = "TimeStone"; source = "NPC/33.Lib"; db = "PrajnaIsland/Timestone" },
  @{ id = "timestone-34"; label = "TimeStone"; source = "NPC/34.Lib"; db = "PastBichon/Timestone" },
  @{ id = "mysterious-stone-79"; label = "MysteriousStone"; source = "NPC/79.Lib"; db = "OmaCave/Stone, StoneTemple/Stone, ZumaTemple/Stone" },
  @{ id = "mysterious-stone-80"; label = "MysteriousStone"; source = "NPC/80.Lib"; db = "WoomaTemple/Stone" }
)

$sections = foreach ($candidate in $candidates) {
  $jsonPath = Join-Path $root (Join-Path $candidate.id "tiles.json")
  if (-not (Test-Path $jsonPath)) { continue }
  $data = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
  $cards = foreach ($tile in $data.tiles) {
    $file = "$($candidate.id)/$($tile.file)"
    @"
        <article class="tile">
          <img src="$file" alt="$($candidate.label) frame $($tile.frame)" loading="lazy" />
          <strong>Frame $($tile.frame)</strong>
          <span>$($tile.width)x$($tile.height), offset $($tile.offsetX), $($tile.offsetY)</span>
        </article>
"@
  }
  @"
    <section>
      <header class="section-head">
        <div>
          <h2>$($candidate.label)</h2>
          <p>$($candidate.source) | $($candidate.db) | $($data.exported) visible frames</p>
        </div>
        <a href="$($candidate.id)/index.html">Open only this lib</a>
      </header>
      <div class="grid">
$($cards -join "`n")
      </div>
    </section>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Teleport Stone Candidate Review</title>
    <style>
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      .top { position: sticky; top: 0; z-index: 3; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      h2 { margin: 0; font-size: 17px; color: #f1d095; }
      p { margin: 0; color: #aaa; }
      a { color: #6fc3ff; text-decoration: none; }
      section { padding: 14px 16px 18px; border-bottom: 1px solid #2d2d2d; }
      .section-head { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin-bottom: 10px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; }
      .tile { border: 1px solid #333; background: #1b1b1b; padding: 8px; display: grid; gap: 6px; }
      img { width: 112px; height: 112px; object-fit: contain; image-rendering: pixelated; background: #050505; justify-self: center; }
      strong, span { display: block; }
      span { color: #aaa; font-size: 11px; }
    </style>
  </head>
  <body>
    <header class="top">
      <h1>Teleport Stone Candidate Review</h1>
      <p>Stone-related NPC libraries from Crystal. Tell me the library and frame number you want to use.</p>
    </header>
$($sections -join "`n")
  </body>
</html>
"@

New-Item -ItemType Directory -Force -Path $root | Out-Null
$html | Set-Content -LiteralPath (Join-Path $root "index.html")
Write-Output (Join-Path $root "index.html")
