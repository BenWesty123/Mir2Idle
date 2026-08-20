param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/M001.map",
  [string]$OutputRoot = "../tile-review/mystery-cave-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapSize = 400
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-mystery-cave-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal M001.map (MysteryCave) - 400x400, noReconnect to E603 ConnectionPath.
# Every Crystal respawn is (200, 200) spread 200. No movement warps.
$markers = @(
  @{ x = 42; y = 158; className = "boss"; title = "Current idle stand (42, 158)" },
  @{ x = 200; y = 200; className = "wave"; title = "Crystal spawn centroid (200, 200) spread 200" },
  @{ x = 126; y = 78; className = "wave"; title = "North cave pocket (126, 78)" },
  @{ x = 274; y = 78; className = "wave"; title = "NE cave pocket (274, 78)" },
  @{ x = 290; y = 242; className = "wave"; title = "SE cave pocket (290, 242)" },
  @{ x = 210; y = 318; className = "wave"; title = "South cave pocket (210, 318)" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Current idle stand (42, 158)" },
  @{ color = "#3498db"; label = "Crystal hub / cave pockets" }
)

$bullets = @(
  "Crystal M001.map (MysteryCave) - 400x400, light 2, noReconnect to E603 ConnectionPath",
  "All Crystal respawns sit on (200, 200) spread 200: Deer, Scarecrow, Giant Keratoid, Oma Warrior, Bone Elite, Ghoul, Wooma Guardian, Evil Tongs, White Boar, Evil Snake, Wooma Taurus (trash + named)",
  "No movement warps on this map. Open floor at the centroid; walls/props live in the pockets",
  "Idle gauntlet currently stands at (42, 158). Bosses walk in from the east",
  "Click the overview to copy coordinates. Reply: use mystery cave spot X, Y"
)

$candidates = @(
  [ordered]@{
    id = "current-idle"
    label = "Current idle stand"
    mapX = 42
    mapY = 158
    note = "Wired now for zone-mystery-cave. Cave walls around the party, east approach is open for swarm walk-in."
    recommended = $true
    role = "boss"
  },
  [ordered]@{
    id = "spawn-hub"
    label = "Crystal spawn centroid"
    mapX = 200
    mapY = 200
    note = "Every Crystal respawn uses this hub with spread 200. Wide open floor, almost no walls in a 36x36 crop."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "north-pocket"
    label = "North cave pocket"
    mapX = 126
    mapY = 78
    note = "Walled pocket north of the centroid. Some east-side props."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "ne-pocket"
    label = "NE cave pocket"
    mapX = 274
    mapY = 78
    note = "Walled pocket north-east of the centroid."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "se-pocket"
    label = "SE cave pocket"
    mapX = 290
    mapY = 242
    note = "Walled pocket south-east of the centroid."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south-pocket"
    label = "South cave pocket"
    mapX = 210
    mapY = 318
    note = "Walled pocket south of the centroid."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-west"
    label = "West of centroid"
    mapX = 160
    mapY = 200
    note = "Offset west of the Crystal spawn heart, still on the open floor."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-east"
    label = "East of centroid"
    mapX = 240
    mapY = 200
    note = "Offset east of the Crystal spawn heart, still on the open floor."
    recommended = $false
    role = "wave"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

# 400x400 at 48px is ~1 GB; overview uses 24x16 cells then scales.
$overviewCellWidth = 24
$overviewCellHeight = 16

Write-Host "Building Mystery Cave full-map overview (400x400 - may take a few minutes)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "MysteryCave" `
  -MapLabel "Mystery Cave" `
  -ImagePrefix "mysterycave-overview" `
  -PickCommand "use mystery cave spot X, Y" `
  -HubLink "./index.html" `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers `
  -CellWidth $overviewCellWidth `
  -CellHeight $overviewCellHeight | ConvertFrom-Json

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  if (($cropX + $CropWCells) -gt $MapSize) { $cropX = [Math]::Max(0, $MapSize - $CropWCells) }
  if (($cropY + $CropHCells) -gt $MapSize) { $cropY = [Math]::Max(0, $MapSize - $CropHCells) }

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
    "boss" { '<span class="badge boss">Current</span>' }
    "wave" { '<span class="badge wave">Pocket</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-mystery-cave-stamp.ps1 -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">M001.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use mystery cave spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Mystery Cave (M001) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "M001.map"
  mapTitle = "MysteryCave"
  mapLabel = "Mystery Cave"
  zoneHint = "zone-mystery-cave"
  stampHint = "mystery-cave-center"
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewScale = $overviewJson.overviewScale
  scaledWidth = $overviewJson.scaledWidth
  scaledHeight = $overviewJson.scaledHeight
  mapWidth = $MapSize
  mapHeight = $MapSize
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
  <title>Mystery Cave - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; }
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
    <h1>Mystery Cave - spot picker</h1>
    <p class="meta">
      Crystal <code>M001.map</code> (<strong>MysteryCave</strong>) for <code>zone-mystery-cave</code>.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a card: <code>use mystery cave spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Current idle stand: <code>(42, 158)</code></li>
      <li>Crystal spawn centroid: <code>(200, 200)</code></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map overview - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use mystery cave spot X, Y</code> or <code>use mystery cave spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="mysterycave-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Mystery Cave overview" />
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
      cellWidth: $overviewCellWidth,
      cellHeight: $overviewCellHeight,
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
      coords.textContent = "Copied: " + text + "  ->  use mystery cave spot " + text;
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
  overviewImage = (Join-Path $outRoot "mysterycave-overview.png")
} | ConvertTo-Json)
