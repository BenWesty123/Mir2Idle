param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/6.map",
  [string]$OutputRoot = "../tile-review/past-bicheon-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  # Full PastBichon is 500x500 - overview cropped to town + oma farm belt.
  [int]$OverviewCropX = 20,
  [int]$OverviewCropY = 20,
  [int]$OverviewCropW = 400,
  [int]$OverviewCropH = 330
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal 6.map (PastBichon) - outdoor hub before Blood Gorge / Oma King / Evil Mir.
# MirDB respawns + movements. Planned idle GD floor 1 trash stand.
$markers = @(
  @{ x = 205; y = 325; className = "boss"; title = "South oma hub (Axe/Sword/Winged/Crossbow + LureSpider) - recommended GD F1 stand" },
  @{ x = 310; y = 290; className = "wave"; title = "SE oma hub" },
  @{ x = 225; y = 110; className = "wave"; title = "North oma hub" },
  @{ x = 70; y = 60; className = "wave"; title = "NW oma hub" },
  @{ x = 50; y = 270; className = "wave"; title = "SW oma hub" },
  @{ x = 400; y = 110; className = "wave"; title = "NE hub - Yin/Yang Devil Nodes + oma" },
  @{ x = 150; y = 150; className = "boss"; title = "Frost Tiger rare (x1, spread 75, delay 60) - planned GD floor 2" },
  @{ x = 250; y = 250; className = "boss"; title = "Frost Tiger rare (x1, spread 75, delay 60) - planned GD floor 2" },
  @{ x = 124; y = 156; className = "entry"; title = "Town safe zone (size 10)" },
  @{ x = 464; y = 70; className = "exit"; title = "Exit east to WestOmaValley (62.map)" },
  @{ x = 470; y = 374; className = "exit"; title = "Exit south-east to WestOmaGorge (61.map)" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Recommended F1 stand / Frost Tiger (F2)" },
  @{ color = "#3498db"; label = "Oma farm hubs" },
  @{ color = "#2ecc71"; label = "Town safe zone" },
  @{ color = "#9b59b6"; label = "Exits to West Oma Valley / West Oma Gorge" }
)

$bullets = @(
  "Crystal 6.map (PastBichon) - 500x500 outdoor hub, light 0",
  "Planned idle group-dungeon floor 1 trash: Axe / Sword / Crossbow / Winged oma + Lure Spiders",
  "Yin/Yang Devil Nodes are capped rares (NE pocket). Frost Tiger is the planned floor 2 mini-boss, not this stand",
  "Town safe zone at (124, 156) - too tight for a party farm",
  "Overview below is cropped to the town + oma belt (20,20)+(400x330) - valley/gorge exits sit just outside the east edge",
  "Click the overview to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{
    id = "south-hub"
    label = "South oma hub"
    mapX = 205
    mapY = 325
    note = "Densest MirDB mix: Axe/Sword/Winged/Crossbow oma + Lure Spiders, spread 125. Away from town. Best default Past Bicheon GD floor 1 stand."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "se-hub"
    label = "SE oma hub"
    mapX = 310
    mapY = 290
    note = "South-east pocket - Sword/Crossbow/Winged + 0-variants, spread 80. Slightly tighter than south hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "north-hub"
    label = "North oma hub"
    mapX = 225
    mapY = 110
    note = "North of town - Axe/Sword/Crossbow/Winged + Lure Spiders, spread 55. Closer to the safe zone."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "nw-hub"
    label = "NW oma hub"
    mapX = 70
    mapY = 60
    note = "North-west pocket - smaller Sword/Axe/Crossbow/Winged + Lure mix, spread 50."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "sw-hub"
    label = "SW oma hub"
    mapX = 50
    mapY = 270
    note = "South-west pocket - Axe-heavy with Winged/Crossbow/Sword + Lure, spread 50."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "ne-nodes"
    label = "NE Yin/Yang pocket"
    mapX = 400
    mapY = 110
    note = "Only Past Bicheon pocket with Yin/Yang Devil Nodes (x2 each, spread 100) plus oma. Good if F1 rares should be visible; not the main wave stand."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south-north"
    label = "North of south hub"
    mapX = 205
    mapY = 295
    note = "Offset stand still inside the south spread-125 farm."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south-east"
    label = "East of south hub"
    mapX = 235
    mapY = 325
    note = "Offset stand east of the south hub, toward the SE pocket."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "frost-tiger-a"
    label = "Frost Tiger (west)"
    mapX = 150
    mapY = 150
    note = "Crystal FrostTiger x1, spread 75, delay 60. Planned GD floor 2 mini-boss - layout reference only for floor 1."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "frost-tiger-b"
    label = "Frost Tiger (east)"
    mapX = 250
    mapY = 250
    note = "Second FrostTiger rare. Same floor 2 reference as the west spawn."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "town-safe"
    label = "Town safe zone"
    mapX = 124
    mapY = 156
    note = "Crystal safe zone (size 10) with Sentry guards. Arrival/layout reference, not a farm stand."
    recommended = $false
    role = "entry"
  },
  [ordered]@{
    id = "valley-exit"
    label = "West Oma Valley exit"
    mapX = 464
    mapY = 70
    note = "Crystal warp to WestOmaValley (62.map). Outside the overview crop. Layout reference, not a farm stand."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "gorge-exit"
    label = "West Oma Gorge exit"
    mapX = 470
    mapY = 374
    note = "Crystal warp to WestOmaGorge (61.map) - Gorge-then-Pass route toward Blood Land. Outside the overview crop."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Past Bicheon farm overview (crop $($OverviewCropX),$($OverviewCropY)+$($OverviewCropW)x$($OverviewCropH) on 500x500)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "PastBichon" `
  -MapLabel "Past Bicheon" `
  -ImagePrefix "pastbichon-overview" `
  -PickCommand "use past bicheon spot X, Y" `
  -HubLink "./index.html" `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers `
  -CropX $OverviewCropX `
  -CropY $OverviewCropY `
  -CropWCells $OverviewCropW `
  -CropHCells $OverviewCropH | ConvertFrom-Json

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  if (($cropX + $CropWCells) -gt 500) { $cropX = [Math]::Max(0, 500 - $CropWCells) }
  if (($cropY + $CropHCells) -gt 500) { $cropY = [Math]::Max(0, 500 - $CropHCells) }

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
    "boss" { '<span class="badge boss">F2 / Rare</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Town</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "past-bicheon-gd-1-center" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">6.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use past bicheon spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Past Bicheon (PastBichon) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "6.map"
  mapTitle = "PastBichon"
  mapLabel = "Past Bicheon"
  zoneHint = "zone-past-bicheon-gd-1 (planned GD floor 1)"
  stampHint = "past-bicheon-gd-1-center"
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewCrop = [ordered]@{ x = $OverviewCropX; y = $OverviewCropY; w = $OverviewCropW; h = $OverviewCropH }
  overviewScale = $overviewJson.overviewScale
  scaledWidth = $overviewJson.scaledWidth
  scaledHeight = $overviewJson.scaledHeight
  mapWidth = 500
  mapHeight = 500
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
  <title>Past Bicheon - spot picker</title>
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
    .marker.entry { background:#2ecc71; }
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
    .badge.entry { background:var(--entry); color:#dff3e4; }
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
    <h1>Past Bicheon - spot picker</h1>
    <p class="meta">
      Crystal <code>6.map</code> (<strong>PastBichon</strong>) - outdoor hub before Blood Gorge / Oma King / Evil Mir.
      Planned idle GD floor 1 trash.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a card: <code>use past bicheon spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Recommended farm: south oma hub <code>(205, 325)</code></li>
      <li>Frost Tiger rares (floor 2): <code>(150, 150)</code> and <code>(250, 250)</code></li>
      <li>Town safe zone: <code>(124, 156)</code></li>
    </ul>
  </header>

  <section class="section">
    <h2>Town + oma belt overview - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use past bicheon spot X, Y</code> or <code>use past bicheon spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="pastbichon-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Past Bicheon overview" />
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
        if (marker.x < meta.cropX || marker.y < meta.cropY) continue;
        if (marker.x >= meta.cropX + $($OverviewCropW) || marker.y >= meta.cropY + $($OverviewCropH)) continue;
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
      coords.textContent = "Copied: " + text + "  ->  use past bicheon spot " + text;
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
  overviewImage = (Join-Path $outRoot "pastbichon-overview.png")
} | ConvertTo-Json)
