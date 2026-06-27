param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell03.map",
  [string]$OutputRoot = "../tile-review/hell-overpass-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$overviewScript = Join-Path $toolsDir "build-bdd-overview.ps1"
$stampScript = Join-Path $toolsDir "build-hell-overpass-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal HELL03 (HellOverpass) - boss KR + entries from MirDB export
$markers = @(
  @{ x = 206; y = 95; className = "boss"; title = "Recommended party stand - between Hell Keeper and Cave Witch" },
  @{ x = 206; y = 90; className = "exit"; title = "Crystal Hell Keeper spawn (418)" },
  @{ x = 206; y = 99; className = "exit"; title = "Crystal Cave Witch spawn (417)" },
  @{ x = 201; y = 110; className = "wave"; title = "East mixed trash hub - demons + Witch Doctor" },
  @{ x = 107; y = 128; className = "wave"; title = "Central crossroads hub" },
  @{ x = 20; y = 275; className = "entry"; title = "GM / west entry (MOVE HELL03 20 275)" },
  @{ x = 282; y = 230; className = "entry"; title = "Entry from HellCavern_2F south exit (HELL02 17, 281)" },
  @{ x = 195; y = 95; className = "wave"; title = "West of boss pair - wider lane for party stand" }
)

$legend = @(
  @{ color = "#f39c12"; label = "Recommended party stand (206, 95)" },
  @{ color = "#e74c3c"; label = "Crystal boss spawns - Hell Keeper (206, 90) / Cave Witch (206, 99)" },
  @{ color = "#3498db"; label = "Other candidate stands / trash hubs" },
  @{ color = "#2ecc71"; label = "Map entries (20, 275 / 282, 230)" }
)

$bullets = @(
  "Crystal hell03.map (HellOverpass) - 300x300, fire damage map",
  "Hell group dungeon floor 3 boss room mock - dual boss Hell Keeper + Cave Witch",
  "Crystal spawns only bosses here (1x Hell Keeper + 1x Cave Witch) - no trash in KR pocket",
  "Click anywhere on the full map to copy coordinates for arenaSpawnMap / arenaFocusMap",
  "Floor tiles: Tiles.Lib 3501-3505 · lane decorations: ../hell-cavern-decoration-picker/index.html"
)

$candidates = @(
  [ordered]@{
    id = "boss-room-mid"
    label = "Boss room center (between bosses)"
    mapX = 206
    mapY = 95
    note = "Crystal kings-room pocket. Party stand midway between Hell Keeper (206, 90) and Cave Witch (206, 99). Best default for hell GD floor 3 dual-boss swarm."
    recommended = $true
    role = "boss"
  },
  [ordered]@{
    id = "boss-room-west"
    label = "West of boss pair"
    mapX = 195
    mapY = 95
    note = "Same east boss alcove, shifted west for a longer walk lane before the stationary Hell Keeper."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "east-hub"
    label = "East mixed hub"
    mapX = 201
    mapY = 110
    note = "Crystal trash respawn hub just west of the KR - Demon mix + Witch Doctor. More props, less open."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "boss-room-north"
    label = "North of Hell Keeper"
    mapX = 206
    mapY = 86
    note = "Tight to Hell Keeper spawn - usually too close for a comfortable party stand."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "boss-room-south"
    label = "South of Cave Witch"
    mapX = 206
    mapY = 104
    note = "Below Cave Witch spawn - reference for boss placement only."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "central-cross"
    label = "Central crossroads"
    mapX = 107
    mapY = 128
    note = "Mid-map trash hub - far from Crystal boss KR, wide junction layout."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "mid-west"
    label = "Mid-west hub"
    mapX = 52
    mapY = 102
    note = "West-side trash hub on the overpass spine."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south-east"
    label = "South-east pocket"
    mapX = 242
    mapY = 201
    note = "Far south-east trash hub - open pocket, far from bosses."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "entry-gm"
    label = "West entry (GM tile)"
    mapX = 20
    mapY = 275
    note = "Crystal GM teleporter landing (MOVE HELL03 20 275). Reference for how players enter the map."
    recommended = $false
    role = "entry"
  },
  [ordered]@{
    id = "entry-hc2"
    label = "Entry from HELL02"
    mapX = 282
    mapY = 230
    note = "Where HELL02 south exit delivers players (HELL02 17, 281 -> HELL03 282, 230)."
    recommended = $false
    role = "entry"
  }
)

$outRoot = Join-Path $toolsDir $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Hell Overpass full-map overview (300x300 - may take several minutes)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "HellOverpass" `
  -MapLabel "Hell Overpass" `
  -ImagePrefix "hell03-overview" `
  -PickCommand "use hell overpass spot X, Y" `
  -HubLink "../hell-cavern-decoration-picker/index.html" `
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
    "boss" { '<span class="badge boss">Boss room</span>' }
    "wave" { '<span class="badge wave">Hub</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">hell03.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use hell overpass spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-hell-overpass-stamp.ps1 -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Hell Overpass (HELL03) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "hell03.map"
  mapTitle = "HellOverpass"
  mapLabel = "Hell Overpass"
  zoneHint = "zone-hell-gd-3"
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
  <title>Hell Overpass - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; --entry:#2e6b4a; --exit:#9b59b6; }
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
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; }
    .badge { font-size:11px; padding:2px 8px; border-radius:999px; }
    .badge.rec { background:var(--rec); color:#dff3e4; }
    .badge.boss { background:var(--boss); color:#f8d8d8; }
    .badge.wave { background:var(--wave); color:#d8e8f8; }
    .badge.entry { background:var(--entry); color:#dff3e4; }
    .badge.exit { background:var(--exit); color:#e8d8f8; }
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
    <h1>Hell Overpass - group dungeon floor 3 boss spot picker</h1>
    <p class="meta">
      Crystal <code>hell03.map</code> (HellOverpass). Mock arena for <code>zone-hell-gd-3</code> dual-boss floor.
      <strong>Hover</strong> the full map for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a preset card below: <code>use hell overpass spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Zone hint: <code>zone-hell-gd-3</code> (Hell Keeper + Cave Witch boss swarm)</li>
      <li>Crystal boss spawns: Hell Keeper <code>(206, 90)</code> · Cave Witch <code>(206, 99)</code></li>
      <li>Recommended default party stand: <code>(206, 95)</code> - between both bosses</li>
      <li>Related: <a href="../hell-cavern-2-spot-picker/index.html">HELL02 spot picker</a> · <a href="../hell-cavern-decoration-picker/index.html">decorations</a></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use hell overpass spot X, Y</code> or <code>use hell overpass spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="hell03-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Hell Overpass overview" />
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
  overviewImage = (Join-Path $outRoot "hell03-overview.png")
} | ConvertTo-Json)
