param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell02.map",
  [string]$OutputRoot = "../tile-review/hell-cavern-2-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$overviewScript = Join-Path $toolsDir "build-bdd-overview.ps1"
$stampScript = Join-Path $toolsDir "build-hell-cavern-2-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal HELL02 (HellCavern_2F) - entries from HELL01 east exits + deep farm corridor art at (128, 100)
$markers = @(
  @{ x = 128; y = 100; className = "boss"; title = "Deep farm corridor pocket - HC2 edge/stamp tuning anchor (recommended wave stand)" },
  @{ x = 16; y = 31; className = "entry"; title = "Entry from HellCavern_1F north exit (HELL01 280, 107)" },
  @{ x = 15; y = 279; className = "entry"; title = "Entry from HellCavern_1F south exit (HELL01 280, 193)" },
  @{ x = 64; y = 100; className = "wave"; title = "West corridor - closer to HC1 north entry" },
  @{ x = 192; y = 100; className = "wave"; title = "East corridor - deeper than farm pocket" },
  @{ x = 128; y = 52; className = "wave"; title = "North branch off main corridor" },
  @{ x = 128; y = 168; className = "wave"; title = "South branch off main corridor" },
  @{ x = 240; y = 140; className = "wave"; title = "Far east pocket - wider room feel" }
)

$legend = @(
  @{ color = "#f39c12"; label = "Farm corridor / recommended stand (128, 100)" },
  @{ color = "#3498db"; label = "Wave corridor candidates" },
  @{ color = "#2ecc71"; label = "Entries from Hell Cavern 1F (16, 31 / 15, 279)" }
)

$bullets = @(
  "Crystal hell02.map (HellCavern_2F) - 300x300, light 0",
  "Hell group dungeon floor 2 trash: same roster as floor 1 but heavier Hell Bolt + Witch Doctor mix",
  "Prior HC2 corridor edge + center stamp were tuned around farm pocket (128, 100) - strong default",
  "Click anywhere on the full map to copy coordinates for arenaSpawnMap / arenaFocusMap",
  "Lane decorations: ../hell-cavern-decoration-picker/index.html · back wall strip: ../hell-cavern-2-corridor-edge/index.html"
)

$candidates = @(
  [ordered]@{
    id = "farm-corridor"
    label = "Deep farm corridor pocket"
    mapX = 128
    mapY = 100
    note = "Existing HC2 corridor edge + hell-cavern-2-center stamp anchor. Open walkable lane with hell floor tiles 3600-3604. Best default for scrolling group-dungeon floor 2."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "farm-north"
    label = "North of farm pocket"
    mapX = 128
    mapY = 72
    note = "Same east-west corridor lane, one screen north of the tuned farm focus."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "farm-south"
    label = "South of farm pocket"
    mapX = 128
    mapY = 128
    note = "Same corridor lane, south continuation from the farm pocket."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "west-mid"
    label = "West mid corridor"
    mapX = 64
    mapY = 100
    note = "Between HC1 north entry and the farm pocket - narrower west spine."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "east-mid"
    label = "East mid corridor"
    mapX = 192
    mapY = 100
    note = "East of the farm pocket on the main corridor - slightly deeper layout."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "north-branch"
    label = "North branch junction"
    mapX = 128
    mapY = 52
    note = "North fork off the main corridor - more props, less open lane."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "south-branch"
    label = "South branch junction"
    mapX = 128
    mapY = 168
    note = "South fork off the main corridor."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "deep-east"
    label = "Deep east pocket"
    mapX = 240
    mapY = 140
    note = "Far east respawn-style pocket - wider room, more clutter."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "entry-north"
    label = "HC1 north entry tile"
    mapX = 16
    mapY = 31
    note = "Where players arrive from HELL01 north exit. Usually too narrow for a party stand - marked for layout reference."
    recommended = $false
    role = "entry"
  },
  [ordered]@{
    id = "entry-south"
    label = "HC1 south entry tile"
    mapX = 15
    mapY = 279
    note = "Where players arrive from HELL01 south exit. Reference only - not a combat stand."
    recommended = $false
    role = "entry"
  }
)

$outRoot = Join-Path $toolsDir $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Hell Cavern 2F full-map overview (300x300 - may take several minutes)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "HellCavern_2F" `
  -MapLabel "Hell Cavern - 2F" `
  -ImagePrefix "hell02-overview" `
  -PickCommand "use hell cavern 2 spot X, Y" `
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
    "boss" { '<span class="badge boss">Hub</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">hell02.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use hell cavern 2 spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-hell-cavern-2-stamp.ps1 -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Hell Cavern 2F (HELL02) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "hell02.map"
  mapTitle = "HellCavern_2F"
  mapLabel = "Hell Cavern - 2F"
  zoneHint = "zone-hell-gd-2"
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
  <title>Hell Cavern 2F - spot picker</title>
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
    <h1>Hell Cavern 2F - group dungeon floor 2 spot picker</h1>
    <p class="meta">
      Crystal <code>hell02.map</code> (HellCavern_2F). Mock arena for <code>zone-hell-gd-2</code>.
      <strong>Hover</strong> the full map for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a preset card below: <code>use hell cavern 2 spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Zone hint: <code>zone-hell-gd-2</code> (Hell group dungeon floor 2 - swarm, 2 waves, heavier ranged mix)</li>
      <li>Recommended default: farm corridor pocket <code>(128, 100)</code> - matches existing HC2 edge art</li>
      <li>Lane decorations: <a href="../hell-cavern-decoration-picker/index.html">hell-cavern-decoration-picker</a></li>
      <li>Back wall strip: <a href="../hell-cavern-2-corridor-edge/index.html">hell-cavern-2-corridor-edge</a></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use hell cavern 2 spot X, Y</code> or <code>use hell cavern 2 spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="hell02-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Hell Cavern 2F overview" />
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
  overviewImage = (Join-Path $outRoot "hell02-overview.png")
} | ConvertTo-Json)
