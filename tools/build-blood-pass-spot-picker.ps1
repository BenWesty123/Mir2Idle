param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/65.map",
  [string]$OutputRoot = "../tile-review/blood-pass-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapWidth = 300,
  [int]$MapHeight = 200
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal 65.map (BloodPass) - 300x200. Planned idle GD floor 4.
# East exit back to Blood Gorge; SW exit on to Blood Land / Oma King.
$markers = @(
  @{ x = 150; y = 100; className = "wave"; title = "Map center" },
  @{ x = 150; y = 50; className = "wave"; title = "North pocket" },
  @{ x = 150; y = 150; className = "wave"; title = "South pocket" },
  @{ x = 80; y = 100; className = "wave"; title = "West pocket" },
  @{ x = 220; y = 100; className = "wave"; title = "East pocket" },
  @{ x = 70; y = 140; className = "wave"; title = "SW pocket toward Blood Land" },
  @{ x = 220; y = 50; className = "wave"; title = "NE pocket" },
  @{ x = 220; y = 150; className = "wave"; title = "SE pocket" },
  @{ x = 268; y = 106; className = "exit"; title = "Back to Blood Gorge (64.map)" },
  @{ x = 45; y = 155; className = "exit"; title = "On to Blood Land (66.map)" }
)

$legend = @(
  @{ color = "#3498db"; label = "Preset pockets" },
  @{ color = "#9b59b6"; label = "Exits (Blood Gorge / Blood Land)" }
)

$bullets = @(
  "Crystal 65.map (BloodPass) - 300x200 outdoor map",
  "Planned Past Bicheon GD floor 4. Click the map, then reply with the coordinates and I will put that crop in the game."
)

$candidates = @(
  [ordered]@{
    id = "center"
    label = "Map center"
    mapX = 150
    mapY = 100
    note = "Middle of Blood Pass."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "north"
    label = "North"
    mapX = 150
    mapY = 50
    note = "North pocket."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south"
    label = "South"
    mapX = 150
    mapY = 150
    note = "South pocket."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "west"
    label = "West"
    mapX = 80
    mapY = 100
    note = "West side, toward Blood Land."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "east"
    label = "East"
    mapX = 220
    mapY = 100
    note = "East side, toward Blood Gorge."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "sw"
    label = "Southwest"
    mapX = 70
    mapY = 140
    note = "SW pocket near the Blood Land exit."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "ne"
    label = "Northeast"
    mapX = 220
    mapY = 50
    note = "NE pocket."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "se"
    label = "Southeast"
    mapX = 220
    mapY = 150
    note = "SE pocket."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "blood-land-exit"
    label = "Blood Land exit"
    mapX = 45
    mapY = 155
    note = "Warp on to Blood Land (66.map). Exit tile, not a stand."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "blood-gorge-exit"
    label = "Blood Gorge exit"
    mapX = 268
    mapY = 106
    note = "Warp back to Blood Gorge (64.map). Exit tile, not a stand."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Blood Pass full-map overview (300x200)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "BloodPass" `
  -MapLabel "Blood Pass" `
  -ImagePrefix "bloodpass-overview" `
  -PickCommand "use blood pass spot X, Y" `
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
    "wave" { '<span class="badge wave">Pocket</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "blood-pass-gd-4-center" -StampLabel "Blood Pass GD Floor 4" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">65.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use blood pass spot ' + $spot.mapX + ', ' + $spot.mapY + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Blood Pass (BloodPass) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "65.map"
  mapTitle = "BloodPass"
  mapLabel = "Blood Pass"
  zoneHint = "zone-past-bicheon-gd-4 (planned GD floor 4)"
  stampHint = "blood-pass-gd-4-center"
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
  <title>Blood Pass - spot picker</title>
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
    <h1>Blood Pass - spot picker</h1>
    <p class="meta">
      Crystal <code>65.map</code> (<strong>BloodPass</strong>) - 300x200.
      Planned Past Bicheon GD floor 4.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>, then reply with those numbers and I will put the crop in the game.
    </p>
    <ul class="meta">
      <li>Back to Blood Gorge: <code>(268, 106)</code></li>
      <li>On to Blood Land: <code>(45, 155)</code></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map overview</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use blood pass spot X, Y</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="bloodpass-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Blood Pass overview" />
    </div>
    <div class="legend">
$legendHtml
    </div>
  </section>

  <section class="section">
    <h2>Preset pockets</h2>
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
      coords.textContent = "Copied: " + text + "  ->  use blood pass spot " + text;
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
  overviewImage = (Join-Path $outRoot "bloodpass-overview.png")
} | ConvertTo-Json)
