param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2012.map",
  [string]$OutputRoot = "../tile-review/bdd-prison-hall-spot-picker",
  [int]$CropWCells = 32,
  [int]$CropHCells = 28,
  [int]$HalfCropW = 16,
  [int]$HalfCropH = 14
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

$markers = @(
  @{ x = 69; y = 71; className = "hub"; title = "East pocket - ZumaStatue20, ZumaArcher20, BugBatMaggot" },
  @{ x = 49; y = 51; className = "hub"; title = "Center pocket - ZumaGuardian20/21, ZumaStatue20/21" },
  @{ x = 33; y = 33; className = "hub"; title = "North pocket - ZumaStatue20, WedgeMoth" },
  @{ x = 86; y = 90; className = "entry"; title = "Entry from D2010 (218, 42)" },
  @{ x = 18; y = 21; className = "exit"; title = "Side exit to bonguk1" }
)

$legend = @(
  @{ color = "#f39c12"; label = "Wave pockets (33,33 / 49,51 / 69,71)" },
  @{ color = "#2ecc71"; label = "Entry from D2010" },
  @{ color = "#9b59b6"; label = "Side town exit" }
)

$bullets = @(
  "Connector map from D2010 (218, 42) - three wave pockets, same layout as Sole Spirit Hall",
  "Side exit at (18, 21) goes to bonguk1 in Crystal (probably unused for idle)",
  "Click anywhere on the full map to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{
    id = "prison-east"
    label = "East pocket"
    mapX = 69
    mapY = 71
    note = "East wave pocket - ZumaStatue20, ZumaArcher20, BugBatMaggot + ZumaArcher21."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "prison-center"
    label = "Center pocket"
    mapX = 49
    mapY = 51
    note = "Center cluster - ZumaGuardian20/21 and ZumaStatue20/21."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "prison-north"
    label = "North pocket"
    mapX = 33
    mapY = 33
    note = "North pocket - ZumaStatue20 and WedgeMoth."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "prison-entry"
    label = "Entry from D2010"
    mapX = 86
    mapY = 90
    note = "Warp landing from D2010 exit (218, 42)."
    recommended = $false
    role = "entry"
  },
  [ordered]@{
    id = "prison-exit-town"
    label = "Side exit (town link)"
    mapX = 18
    mapY = 21
    note = "Crystal side exit to bonguk1 - probably not used for idle progression."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Prison Hall full-map overview..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "PrisonHall" `
  -MapLabel "Prison Hall (BDD 12F)" `
  -ImagePrefix "d2012-overview" `
  -PickCommand "use bdd prison-hall spot X, Y" `
  -HubLink "../bdd-remaining-overviews/index.html" `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers | ConvertFrom-Json

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
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
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampName = "bdd-$($spot.id)-center"
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">D2012.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use bdd prison-hall spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + $MapPath + '" -StampId "' + $stampName + '" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells 36 -CropHCells 36</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Prison Hall (BDD 12F) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "D2012.map"
  mapTitle = "PrisonHall"
  mapLabel = "Prison Hall (BDD 12F)"
  zoneHint = "zone-bdd-12"
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewScale = $overviewJson.overviewScale
  scaledWidth = $overviewJson.scaledWidth
  scaledHeight = $overviewJson.scaledHeight
  mapWidth = $overviewJson.mapWidth
  mapHeight = $overviewJson.mapHeight
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
  <title>Prison Hall (BDD 12F) - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --wave:#2e4a6b; --entry:#2e6b4a; --exit:#5a3d7a; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; }
    h2 { margin:0 0 14px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:1080px; }
    .meta ul { margin:8px 0 0; padding-left:20px; }
    .section { padding:20px 24px 8px; }
    .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:16px 0; }
    .coords { font-family:Consolas,monospace; background:#1b2029; border:1px solid #3a4354; padding:8px 12px; border-radius:6px; min-width:360px; }
    .viewer { position:relative; display:inline-block; border:1px solid var(--line); background:#050504; max-width:100%; overflow:auto; border-radius:8px; }
    #mapImage { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; cursor:crosshair; }
    .marker { position:absolute; transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width:12px; height:12px; border-radius:50%; border:2px solid #fff; }
    .marker.hub { background:#f39c12; }
    .marker.entry { background:#2ecc71; }
    .marker.exit { background:#9b59b6; }
    .legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; color:var(--muted); }
    .legend span { display:inline-flex; align-items:center; gap:6px; }
    .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { padding:0; border:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; }
    .badge { font-size:11px; padding:2px 8px; border-radius:999px; }
    .badge.rec { background:var(--rec); color:#dff3e4; }
    .badge.wave { background:var(--wave); color:#d8e8f8; }
    .badge.entry { background:var(--entry); color:#dff3e4; }
    .badge.exit { background:var(--exit); color:#ead8f8; }
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
    <p><a href="../bdd-remaining-overviews/index.html">&larr; All remaining BDD floors</a></p>
    <h1>Prison Hall — BDD 12F player spot picker</h1>
    <p class="meta">
      Crystal <code>D2012.map</code> (PrisonHall). Connector floor after Zuma Palace / HwanMaJin II.
      <strong>Hover</strong> the full map for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a preset card below: <code>use bdd prison-hall spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Zone hint: <code>zone-bdd-12</code></li>
      <li>Entry from D2010 at (86, 90) — warp from (218, 42)</li>
      <li>Three wave pockets: north (33, 33), center (49, 51), east (69, 71)</li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map — click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use bdd prison-hall spot X, Y</code> or <code>use bdd prison-hall spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="d2012-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Prison Hall overview" />
    </div>
    <div class="legend">
$legendHtml
    </div>
  </section>

  <section class="section">
    <h2>Preset candidate spots</h2>
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
      const mapX = Math.floor(px / (meta.cellWidth * meta.scale)) + meta.cropX;
      const mapY = Math.floor(py / (meta.cellHeight * meta.scale)) + meta.cropY;
      return { mapX, mapY };
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
      coords.textContent = "Copied: " + text;
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
  overviewImage = (Join-Path $outRoot "d2012-overview.png")
} | ConvertTo-Json)
