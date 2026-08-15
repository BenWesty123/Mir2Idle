param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/64.map",
  [string]$OutputRoot = "../tile-review/blood-gorge-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapSize = 300
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal 64.map (BloodGorge) - outdoor farm between East/West Pass and Blood Pass.
# Planned idle GD floor 3 trash: same oma mix as F1 plus FlailOma / OmaGuard.
$markers = @(
  @{ x = 249; y = 76; className = "boss"; title = "Trial stand (249, 76) - current pick" },
  @{ x = 150; y = 150; className = "wave"; title = "Oma farm centroid (Axe/Sword/Crossbow/Winged + FlailOma + Yin/Yang)" },
  @{ x = 100; y = 100; className = "wave"; title = "OmaGuard hub (x10, spread 250)" },
  @{ x = 150; y = 105; className = "wave"; title = "North of farm centroid" },
  @{ x = 105; y = 150; className = "wave"; title = "West of farm centroid" },
  @{ x = 195; y = 150; className = "wave"; title = "East of farm centroid" },
  @{ x = 150; y = 195; className = "wave"; title = "South of farm centroid" },
  @{ x = 60; y = 80; className = "wave"; title = "Blood Pass approach" },
  @{ x = 200; y = 200; className = "wave"; title = "SE pocket toward East Pass" },
  @{ x = 29; y = 59; className = "exit"; title = "Exit NW to Blood Pass (65.map) - king path" },
  @{ x = 272; y = 239; className = "exit"; title = "Exit SE to East Pass (632.map)" },
  @{ x = 166; y = 264; className = "exit"; title = "Exit south to West Pass (631.map)" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Trial stand (249, 76)" },
  @{ color = "#3498db"; label = "Farm hubs / offsets" },
  @{ color = "#9b59b6"; label = "Exits to Blood Pass / East Pass / West Pass" }
)

$bullets = @(
  "Crystal 64.map (BloodGorge) - 300x300 outdoor farm, light 0, noReconnect to 63",
  "Planned idle group-dungeon floor 3 trash: Axe / Sword / Crossbow / Winged oma + FlailOma / OmaGuard",
  "Almost every Crystal respawn is one giant farm at (150, 150) spread 150. OmaGuard is a second hub at (100, 100) spread 250",
  "Yin/Yang Devil Nodes spawn in the same centroid - Crystal rares, not the idle F3 wave",
  "Forward exit is NW to Blood Pass (65.map). SE/south exits go back to East Pass / West Pass",
  "Click the overview to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{
    id = "trial-249-76"
    label = "Trial (249, 76)"
    mapX = 249
    mapY = 76
    note = "Current try: NE gorge pocket, east of the farm centroid and north of East Pass. Still inside the OmaGuard spread-250 overlay; near the edge of the oma spread-150 farm."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "center-farm"
    label = "Farm centroid"
    mapX = 150
    mapY = 150
    note = "Crystal spawn heart: Axe/Sword/Crossbow/Winged oma (spread 150) plus FlailOma x10. Yin/Yang Nodes also sit here. Default Blood Gorge GD floor 3 stand if the trial pocket is too tight."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "north-pocket"
    label = "North of centroid"
    mapX = 150
    mapY = 105
    note = "Offset stand still inside the spread-150 farm, toward the Blood Pass (NW) side of the gorge."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "west-pocket"
    label = "West of centroid"
    mapX = 105
    mapY = 150
    note = "Offset west of the farm heart, overlapping the OmaGuard spread-250 overlay."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "east-pocket"
    label = "East of centroid"
    mapX = 195
    mapY = 150
    note = "Offset east of the farm heart, toward East Pass. Still inside spread 150."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south-pocket"
    label = "South of centroid"
    mapX = 150
    mapY = 195
    note = "Offset south of the farm heart, toward West Pass. Still inside spread 150."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "guard-hub"
    label = "OmaGuard hub"
    mapX = 100
    mapY = 100
    note = "Crystal OmaGuard x10, spread 250. NW of the oma centroid and closer to Blood Pass. Good if F3 should look Guard-weighted."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "pass-approach"
    label = "Blood Pass approach"
    mapX = 60
    mapY = 80
    note = "NW gorge pocket on the way to Blood Pass. Inside the Guard spread-250 overlay; edge of the oma farm."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "se-pocket"
    label = "SE toward East Pass"
    mapX = 200
    mapY = 200
    note = "South-east pocket still inside the spread-150 farm, toward the East Pass exit."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "blood-pass-exit"
    label = "Blood Pass exit"
    mapX = 29
    mapY = 59
    note = "Crystal warp to BloodPass (65.map) at dest (267, 106). Forward king-path exit - layout reference, not a farm stand."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "east-pass-exit"
    label = "East Pass exit"
    mapX = 272
    mapY = 239
    note = "Crystal warp to EastPass (632.map) at dest (25, 34). Back-path exit - layout reference, not a farm stand."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "west-pass-exit"
    label = "West Pass exit"
    mapX = 166
    mapY = 264
    note = "Crystal warp to WestPass (631.map) at dest (99, 22). Back-path exit - layout reference, not a farm stand."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Blood Gorge full-map overview (300x300 - may take several minutes)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "BloodGorge" `
  -MapLabel "Blood Gorge" `
  -ImagePrefix "bloodgorge-overview" `
  -PickCommand "use blood gorge spot X, Y" `
  -HubLink "./index.html" `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers | ConvertFrom-Json

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
    "wave" { '<span class="badge wave">Wave</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "blood-gorge-gd-3-center" -StampLabel "Blood Gorge GD Floor 3" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">64.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use blood gorge spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Blood Gorge (BloodGorge) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "64.map"
  mapTitle = "BloodGorge"
  mapLabel = "Blood Gorge"
  zoneHint = "zone-past-bicheon-gd-3 (planned GD floor 3)"
  stampHint = "blood-gorge-gd-3-center"
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
  <title>Blood Gorge - spot picker</title>
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
    <h1>Blood Gorge - spot picker</h1>
    <p class="meta">
      Crystal <code>64.map</code> (<strong>BloodGorge</strong>) - outdoor farm on the Blood Pass / Blood Land path.
      Planned idle GD floor 3 trash (oma + Flail / Guard).
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a card: <code>use blood gorge spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Trying: <code>(249, 76)</code></li>
      <li>Crystal farm centroid: <code>(150, 150)</code></li>
      <li>OmaGuard hub: <code>(100, 100)</code></li>
      <li>Forward exit (Blood Pass): <code>(29, 59)</code></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map overview - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use blood gorge spot X, Y</code> or <code>use blood gorge spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="bloodgorge-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Blood Gorge overview" />
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
      coords.textContent = "Copied: " + text + "  ->  use blood gorge spot " + text;
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
  overviewImage = (Join-Path $outRoot "bloodgorge-overview.png")
} | ConvertTo-Json)
