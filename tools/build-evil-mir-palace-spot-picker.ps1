param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2083.map",
  [string]$OutputRoot = "../tile-review/evil-mir-palace-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapWidth = 200,
  [int]$MapHeight = 200
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal D2083.map (EvilMirPalace) - 200x200 but only ~4% walkable: a narrow
# processional approach, not an open room. Crystal spawns MirStatue x6 and
# nothing else. Entry from Molten Rock Cave lands at (39, 89); the dragon stands
# at (82, 44), and the existing boss stamp crops x64-99 / y26-61 around him.
# Planned idle GD floor 8 (trash) - the point is to show the part of the palace
# the boss stamp never reveals, so candidates below exclude that crop.
# Found by scanning for tiles whose 3-lane arena corridor (y-1..y+1, x-3..x+13)
# is fully walkable, then ranked by openness of the 21x11 framing box.
$markers = @(
  @{ x = 82; y = 44; className = "boss"; title = "Evil Mir - existing boss stand (floor 9)" },
  @{ x = 39; y = 89; className = "exit"; title = "Arrival from Molten Rock Cave (D2082 374,273)" },
  @{ x = 54; y = 74; className = "wave"; title = "Arena candidate - lower approach" },
  @{ x = 45; y = 69; className = "wave"; title = "Arena candidate - entrance hall" },
  @{ x = 64; y = 72; className = "wave"; title = "Arena candidate - mid approach" },
  @{ x = 51; y = 61; className = "wave"; title = "Arena candidate - west landing" },
  @{ x = 61; y = 57; className = "wave"; title = "Arena candidate - upper approach" },
  @{ x = 73; y = 62; className = "wave"; title = "Arena candidate - dragon steps" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Evil Mir boss stand (82, 44)" },
  @{ color = "#3498db"; label = "Arena candidates (3-lane corridor clear)" },
  @{ color = "#9b59b6"; label = "Arrival from Molten Rock Cave (39, 89)" }
)

$bullets = @(
  "Crystal D2083.map (EvilMirPalace) - 200x200 but only ~4% walkable: a narrow approach, not an open hall",
  "Planned Past Bicheon GD floor 8 - the trash room inside the palace, before the Evil Mir fight on floor 9.",
  "Every candidate sits outside the boss stamp crop (x64-99, y26-61) so the floor shows new geography.",
  "Click the map, then reply with the coordinates and I will put that crop in the game."
)

$candidates = @(
  [ordered]@{
    id = "lower-approach"
    label = "Lower approach"
    mapX = 54
    mapY = 74
    note = "98% open - the best framed stand on the map. 21 tiles from the arrival point and 41 from the dragon, so it shows the stretch of palace the boss crop never reveals. Only a few tiles of its crop overlap the boss stamp."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "entrance-hall"
    label = "Entrance hall"
    mapX = 45
    mapY = 69
    note = "Closest to where players arrive from Molten Rock Cave (21 tiles). 84% open - some wall in frame, but the most 'just walked in' of the set."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "mid-approach"
    label = "Mid approach"
    mapX = 64
    mapY = 72
    note = "95% open, halfway between the arrival point and the dragon."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "west-landing"
    label = "West landing"
    mapX = 51
    mapY = 61
    note = "79% open - the tightest of the set, walls on both sides. Reads as a corridor rather than a chamber."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "upper-approach"
    label = "Upper approach"
    mapX = 61
    mapY = 57
    note = "97% open, closer to the dragon end of the hall without entering the boss crop."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "dragon-steps"
    label = "Dragon steps"
    mapX = 73
    mapY = 62
    note = "96% open and only 20 tiles from Evil Mir - the most dramatic framing, but its crop overlaps the lower part of the boss stamp, so it repeats scenery players already see on floor 9."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "evil-mir"
    label = "Evil Mir boss stand"
    mapX = 82
    mapY = 44
    note = "The existing floor 9 boss stamp focus. Reference only, not a trash stand."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "arrival"
    label = "Arrival from Molten Rock Cave"
    mapX = 39
    mapY = 89
    note = "Where D2082 (374, 273) drops players in. Walkable but its 3-lane corridor is blocked, so it cannot host the arena itself."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Evil Mir Palace full-map overview (200x200)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "EvilMirPalace" `
  -MapLabel "Evil Mir Palace" `
  -ImagePrefix "evilmirpalace-overview" `
  -PickCommand "use palace spot X, Y" `
  -HubLink "./index.html" `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers | ConvertFrom-Json

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  if (($cropX + $CropWCells) -gt $MapWidth) { $cropX = [Math]::Max(0, $MapWidth - $CropWCells) }
  if (($cropY + $CropHCells) -gt $MapHeight) { $cropY = [Math]::Max(0, $MapHeight - $CropHCells) }

  $previewFile = "spot-$($spot.id).png"
  $previewPath = Join-Path $previewDir $previewFile

  Write-Host "Building preview $($spot.id) at map ($($spot.mapX), $($spot.mapY))..."
  & $stampScript `
    -DataRoot $DataRoot `
    -MapPath $MapPath `
    -OutputRoot (Resolve-Path $previewDir).Path `
    -StampId "preview-$($spot.id)" `
    -SheetFile $previewFile `
    -StampLabel $spot.label `
    -SkipIndex `
    -CropX $cropX `
    -CropY $cropY `
    -CropWCells $CropWCells `
    -CropHCells $CropHCells `
    -FocusMapX $spot.mapX `
    -FocusMapY $spot.mapY | Out-Null

  if (-not (Test-Path $previewPath)) { throw "Preview not created: $previewPath" }

  $focusX = ($spot.mapX - $cropX) * 48
  $focusY = ($spot.mapY - $cropY) * 32
  $built.Add([ordered]@{
    id = $spot.id
    label = $spot.label
    role = $spot.role
    mapX = $spot.mapX
    mapY = $spot.mapY
    cropX = $cropX
    cropY = $cropY
    cropWCells = $CropWCells
    cropHCells = $CropHCells
    focusX = $focusX
    focusY = $focusY
    note = $spot.note
    recommended = [bool]$spot.recommended
    previewFile = "previews/$previewFile"
  })

  $rec = if ($spot.recommended) { '<span class="badge rec">Recommended</span>' } else { "" }
  $roleBadge = switch ($spot.role) {
    "wave" { '<span class="badge wave">Arena</span>' }
    "boss" { '<span class="badge boss">Evil Mir</span>' }
    "exit" { '<span class="badge exit">Arrival</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "evil-mir-palace-gd-8-center" -StampLabel "Evil Mir Palace GD Floor 8" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">D2083.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use palace spot ' + $spot.mapX + ', ' + $spot.mapY + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Evil Mir Palace (EvilMirPalace) - GD floor 8 spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "D2083.map"
  mapTitle = "EvilMirPalace"
  mapLabel = "Evil Mir Palace"
  zoneHint = "zone-past-bicheon-gd-8 (planned GD floor 8 trash)"
  stampHint = "evil-mir-palace-gd-8-center"
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewScale = $overviewJson.overviewScale
  scaledWidth = $overviewJson.scaledWidth
  scaledHeight = $overviewJson.scaledHeight
  mapWidth = $MapWidth
  mapHeight = $MapHeight
  spots = @($built.ToArray())
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  (Join-Path $outRoot "spots.json"),
  ($manifest | ConvertTo-Json -Depth 6),
  $utf8NoBom
)

$metaPath = Join-Path $outRoot "meta.json"
$meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
$markersJson = ($meta.markers | ForEach-Object {
  "        { x: $($_.x), y: $($_.y), className: `"$($_.className)`", title: `"$($_.title -replace '"','\"')`" }"
}) -join ",`n"

$legendHtml = ($legend | ForEach-Object {
  "      <span><i class=`"dot`" style=`"background:$($_.color)`"></i> $($_.label)</span>"
}) -join "`n"

$bulletHtml = ($bullets | ForEach-Object { "      <li>$_</li>" }) -join "`n"

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Evil Mir Palace - GD floor 8 spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; --entry:#2e6b4a; --exit:#5a3d7a; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; color:#f4dfb0; }
    h2 { margin:0 0 14px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:1080px; }
    .meta ul { margin:8px 0 0; padding-left:20px; }
    .section { padding:20px 24px 8px; }
    .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:16px 0; }
    .coords-bar { font-family:Consolas,monospace; background:#1b2029; border:1px solid #3a4354; padding:8px 12px; border-radius:6px; min-width:360px; }
    .viewer { position:relative; display:inline-block; border:1px solid var(--line); background:#050504; max-width:100%; overflow:auto; border-radius:8px; }
    #mapImage { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; cursor:crosshair; }
    .marker { position:absolute; transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width:12px; height:12px; border-radius:50%; border:2px solid #fff; }
    .marker.boss { background:#e74c3c; width:14px; height:14px; }
    .marker.wave { background:#3498db; }
    .marker.exit { background:#9b59b6; width:10px; height:10px; }
    .legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; color:var(--muted); }
    .legend span { display:inline-flex; align-items:center; gap:6px; }
    .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { padding:0; border:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; flex-basis:100%; }
    .badge { font-size:11px; padding:2px 8px; border-radius:999px; }
    .badge.rec { background:var(--rec); color:#dff3e4; }
    .badge.boss { background:var(--boss); color:#f8d8d8; }
    .badge.wave { background:var(--wave); color:#d8e8f8; }
    .badge.exit { background:var(--exit); color:#eadcf5; }
    figure { margin:0; border:1px solid var(--line); border-radius:8px; overflow:auto; background:#050504; }
    figure img { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; }
    figcaption { padding:8px 10px; font-size:12px; color:var(--muted); border-top:1px solid var(--line); }
    .note { margin:0; color:var(--muted); font-size:13px; }
    .pick { margin:0; color:var(--accent); }
    .cmd { margin:0; font-size:11px; color:var(--muted); word-break:break-all; }
    code { color:#d4bc86; }
    a { color:var(--accent); }
  </style>
</head>
<body>
  <header>
    <h1>Evil Mir Palace - GD floor 8 spot picker</h1>
    <p class="meta">
      Crystal <code>D2083.map</code> (<strong>EvilMirPalace</strong>) - 200x200 but only ~4% walkable.
      Planned Past Bicheon GD floor 8: the trash room inside the palace, before the Evil Mir fight on floor 9.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>, then reply with those numbers and I will put the crop in the game.
    </p>
    <ul class="meta">
      <li>Crystal monster seed: MirStatue x6 only - we are using the Oma roster instead, so no new monster art.</li>
      <li>Evil Mir boss stand (floor 9): <code>(82, 44)</code>, stamp crop x64-99 / y26-61</li>
      <li>Arrival from Molten Rock Cave: <code>(39, 89)</code> &lt;- D2082 (374, 273)</li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map overview</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use palace spot X, Y</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="evilmirpalace-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Evil Mir Palace overview" />
    </div>
    <div class="legend">
$legendHtml
    </div>
  </section>

  <section class="section">
    <h2>Arena candidates</h2>
    <div class="grid">
$($cards -join "`n")
    </div>
  </section>

  <script>
    const meta = {
      cropX: $($meta.cropX),
      cropY: $($meta.cropY),
      cellWidth: 48,
      cellHeight: 32,
      scale: $($overviewJson.overviewScale),
      dots: [
$markersJson
      ]
    };
    const viewer = document.getElementById("viewer");
    const img = document.getElementById("mapImage");
    const coords = document.getElementById("coords");
    const toggle = document.getElementById("toggleMarkers");

    function mapPointToPixel(mapX, mapY) {
      return {
        left: (mapX - meta.cropX) * meta.cellWidth * meta.scale,
        top: (mapY - meta.cropY) * meta.cellHeight * meta.scale
      };
    }

    function pixelToMap(clientX, clientY) {
      const rect = img.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width * img.naturalWidth;
      const py = (clientY - rect.top) / rect.height * img.naturalHeight;
      return {
        mapX: Math.floor(px / (meta.cellWidth * meta.scale)) + meta.cropX,
        mapY: Math.floor(py / (meta.cellHeight * meta.scale)) + meta.cropY
      };
    }

    function renderMarkers() {
      viewer.querySelectorAll(".marker").forEach((node) => node.remove());
      if (!toggle.checked) return;
      for (const marker of meta.dots) {
        const point = mapPointToPixel(marker.x, marker.y);
        const node = document.createElement("div");
        node.className = "marker dot " + marker.className;
        node.style.left = point.left + "px";
        node.style.top = point.top + "px";
        node.title = marker.title + " (" + marker.x + ", " + marker.y + ")";
        viewer.appendChild(node);
      }
    }

    img.addEventListener("mousemove", (event) => {
      const { mapX, mapY } = pixelToMap(event.clientX, event.clientY);
      coords.textContent = "Map coordinate: " + mapX + ", " + mapY;
    });

    img.addEventListener("click", async (event) => {
      const { mapX, mapY } = pixelToMap(event.clientX, event.clientY);
      const text = mapX + ", " + mapY;
      coords.textContent = "Copied: " + text + "  ->  use palace spot " + text;
      try { await navigator.clipboard.writeText(text); } catch {}
    });

    toggle.addEventListener("change", renderMarkers);
    img.addEventListener("load", renderMarkers);
    renderMarkers();
  </script>
</body>
</html>
"@

$htmlPath = Join-Path $outRoot "index.html"
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)

Write-Output ([ordered]@{
  outputRoot = $outRoot
  html = $htmlPath
  spotCount = $built.Count
  overviewImage = (Join-Path $outRoot "evilmirpalace-overview.png")
} | ConvertTo-Json)
