param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/RCK.map",
  [string]$OutputRoot = "../tile-review/red-cavern-kr-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-red-cavern-kr-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal RCK.map (RedCavern_KR) - respawns + movements from MirDB export
$markers = @(
  @{ x = 50; y = 55; className = "boss"; title = "Devourer respawn hub (406-411, spread 150) - DreamDevourer + DarkDevourer" },
  @{ x = 17; y = 104; className = "entry"; title = "Warp-in from Red Cavern 12F (56, 26) lands here" },
  @{ x = 16; y = 105; className = "exit"; title = "Exit west - returns to RedCavern_12F (55, 27)" },
  @{ x = 40; y = 134; className = "exit"; title = "Exit south - returns to RedCavern_12F (55, 27)" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Devourer respawn hub (50, 55)" },
  @{ color = "#2ecc71"; label = "Entry from Red Cavern 12F (17, 104)" },
  @{ color = "#3498db"; label = "Exits back to Red Cavern 12F (16, 105) / (40, 134)" }
)

$bullets = @(
  "Crystal RCK.map (RedCavern_KR) - 150x150, light 0",
  "Trash + boss respawns share hub (50, 55): GhastlyLeecher, MutatedManworm, CrazyManworm, CyanoGhast, DreamDevourer, DarkDevourer",
  "Players warp in from RedCavern_12F at (56, 26) and land at (17, 104)",
  "Two exit tiles return to RedCavern_12F (55, 27): (16, 105) and (40, 134)",
  "Click anywhere on the full map to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{
    id = "devourer-hub"
    label = "Devourer respawn hub"
    mapX = 50
    mapY = 55
    note = "Crystal boss/trash respawn center - spread 150. DreamDevourer (delay 30) and DarkDevourer (delay 70) share this hub with the four trash lines."
    recommended = $true
    role = "boss"
  },
  [ordered]@{
    id = "kr-entry"
    label = "KR entry (from RC12)"
    mapX = 17
    mapY = 104
    note = "Where players appear when entering from RedCavern_12F warp (56, 26). South-west approach to the arena."
    recommended = $false
    role = "entry"
  },
  [ordered]@{
    id = "hub-north"
    label = "North of hub"
    mapX = 50
    mapY = 35
    note = "Open floor north of the respawn hub - candidate party stand if hub feels crowded."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-south"
    label = "South of hub"
    mapX = 50
    mapY = 75
    note = "Open floor south of the respawn hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-west"
    label = "West of hub"
    mapX = 30
    mapY = 55
    note = "West pocket off the central hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-east"
    label = "East of hub"
    mapX = 70
    mapY = 55
    note = "East pocket off the central hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "exit-west"
    label = "West exit tile"
    mapX = 16
    mapY = 105
    note = "Crystal exit back to RedCavern_12F - usually not a party stand, marked for layout reference."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "exit-south"
    label = "South exit tile"
    mapX = 40
    mapY = 134
    note = "Second exit back to RedCavern_12F - south edge of the room."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Red Cavern KR full-map overview..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "RedCavern_KR" `
  -MapLabel "Red Cavern - King's Room (RCK)" `
  -ImagePrefix "rck-overview" `
  -PickCommand "use red-cavern kr spot X, Y" `
  -HubLink "../red-cavern-decoration-picker/index.html" `
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
    "boss" { '<span class="badge boss">Boss</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">RCK.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use red-cavern kr spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-red-cavern-kr-stamp.ps1 -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Red Cavern King's Room (RCK) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "RCK.map"
  mapTitle = "RedCavern_KR"
  mapLabel = "Red Cavern - King's Room"
  zoneHint = "zone-red-cavern-kr"
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
  <title>Red Cavern King's Room - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; --entry:#2e6b4a; --exit:#2e4a7a; }
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
    .marker.entry { background:#2ecc71; }
    .marker.exit { background:#3498db; width:10px; height:10px; }
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
    .badge.exit { background:var(--exit); color:#d8e8f8; }
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
    <h1>Red Cavern - King's Room spot picker</h1>
    <p class="meta">
      Crystal <code>RCK.map</code> (RedCavern_KR). Mock KR for <code>zone-red-cavern-kr</code>.
      <strong>Hover</strong> the full map for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a preset card below: <code>use red-cavern kr spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Zone hint: <code>zone-red-cavern-kr</code> (not wired in game yet)</li>
      <li>Devourer respawn hub: <code>(50, 55)</code></li>
      <li>Entry from Red Cavern 12F: <code>(17, 104)</code></li>
      <li>Lane decorations: <a href="../red-cavern-decoration-picker/index.html">red-cavern-decoration-picker</a></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use red-cavern kr spot X, Y</code> or <code>use red-cavern kr spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="rck-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Red Cavern KR overview" />
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
  overviewImage = (Join-Path $outRoot "rck-overview.png")
} | ConvertTo-Json)
