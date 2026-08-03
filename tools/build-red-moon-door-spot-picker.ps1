param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D10052.map",
  [string]$OutputRoot = "../tile-review/red-moon-door-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapSize = 200
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal D10052 - ONLY map with the Red Moon Room door (140, 23) -> D10062.
$markers = @(
  @{ x = 140; y = 23; className = "boss"; title = "RED MOON ROOM DOOR - warp to D10062 RedMoonRoom (12, 24)" },
  @{ x = 150; y = 150; className = "wave"; title = "Trash hub (spread 150) - Bat/Great/Root/BigApe/EvilApe" },
  @{ x = 98; y = 185; className = "exit"; title = "Exit south to RedValley_4F D1004 (216, 132)" },
  @{ x = 183; y = 178; className = "exit"; title = "Exit SE to RedValley_5F D10054 (79, 13)" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Red Moon Room door (140, 23)" },
  @{ color = "#3498db"; label = "Trash hub (150, 150)" },
  @{ color = "#9b59b6"; label = "Exits to 4F / D10054" }
)

$bullets = @(
  "Crystal D10052.map (RedValley_5F pocket) - 200x200 - antechamber to Red Moon Evil",
  "THE door: (140, 23) -> D10062 RedMoonRoom (12, 24). Not on D10051.",
  "Idle zone: zone-red-valley-gd-6 (Red Moon Valley - Moon Door, GD floor 7)",
  "MirDB trash hub (150, 150): SpiderBat / GreatSpider / RootSpider / BigApe / EvilApe",
  "Click the overview to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{ id = "moon-door"; label = "Red Moon Room door"; mapX = 140; mapY = 23; note = "Crystal entrance tile to Red Moon Evil (140, 23)."; recommended = $false; role = "boss" },
  [ordered]@{ id = "stand-142-32"; label = "Live stand (142, 32)"; mapX = 142; mapY = 32; note = "Selected party stand (5 east / 2 south from 137, 30). Forward = east."; recommended = $true; role = "boss" },
  [ordered]@{ id = "stand-137-30"; label = "Prior stand (137, 30)"; mapX = 137; mapY = 30; note = "Previous live stand."; recommended = $false; role = "boss" },
  [ordered]@{ id = "door-south"; label = "South of door"; mapX = 140; mapY = 35; note = "Stand just south of the door tile."; recommended = $false; role = "wave" },
  [ordered]@{ id = "door-west"; label = "West of door"; mapX = 125; mapY = 23; note = "West of the door."; recommended = $false; role = "wave" },
  [ordered]@{ id = "door-east"; label = "East of door"; mapX = 155; mapY = 23; note = "East of the door."; recommended = $false; role = "wave" },
  [ordered]@{ id = "trash-hub"; label = "Trash hub"; mapX = 150; mapY = 150; note = "MirDB dense trash hub - alternate farm stand."; recommended = $false; role = "wave" },
  [ordered]@{ id = "hub-north"; label = "North of trash hub"; mapX = 150; mapY = 120; note = "Toward the Moon Door from the hub."; recommended = $false; role = "wave" },
  [ordered]@{ id = "exit-4f"; label = "Exit to 4F (D1004)"; mapX = 98; mapY = 185; note = "Warp to Crystal Spider floor - layout reference."; recommended = $false; role = "exit" },
  [ordered]@{ id = "exit-d10054"; label = "Exit to D10054"; mapX = 183; mapY = 178; note = "Warp to sibling RedValley_5F pocket - layout reference."; recommended = $false; role = "exit" }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Moon Door overview (D10052, ${MapSize}x${MapSize})..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "RedValley_5F" `
  -MapLabel "Red Moon Valley - Moon Door (D10052)" `
  -ImagePrefix "d10052-overview" `
  -PickCommand "use red moon door spot X, Y" `
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
    note = $spot.note
    recommended = [bool]$spot.recommended
    previewFile = "previews/$previewFile"
  })

  $rec = if ($spot.recommended) { '<span class="badge rec">Recommended / live</span>' } else { "" }
  $roleBadge = switch ($spot.role) {
    "boss" { '<span class="badge boss">Door</span>' }
    "wave" { '<span class="badge wave">Alt</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "red-valley-gd-6-center" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cards.Add(@(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">D10052.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use red moon door spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n")
}

$manifest = [ordered]@{
  title = "Red Moon Door (D10052) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "D10052.map"
  mapTitle = "RedValley_5F"
  mapLabel = "Red Moon Valley - Moon Door"
  zoneHint = "zone-red-valley-gd-6"
  stampHint = "red-valley-gd-6-center"
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
[System.IO.File]::WriteAllText((Join-Path $outRoot "spots.json"), ($manifest | ConvertTo-Json -Depth 6), $utf8NoBom)

$meta = Get-Content -LiteralPath (Join-Path $outRoot "meta.json") -Raw | ConvertFrom-Json
$markersJson = ($meta.markers | ForEach-Object {
  "        { x: $($_.x), y: $($_.y), className: `"$($_.className)`", title: `"$($_.title -replace '"','\"')`" }"
}) -join ",`n"
$legendHtml = ($legend | ForEach-Object { "      <span><i class=`"dot`" style=`"background:$($_.color)`"></i> $($_.label)</span>" }) -join "`n"
$bulletHtml = ($bullets | ForEach-Object { "      <li>$_</li>" }) -join "`n"

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Red Moon Door - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; --exit:#5a3d7a; }
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
    .marker.wave { background:#3498db; width:10px; height:10px; }
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
    <h1>Red Moon Door - spot picker</h1>
    <p class="meta">
      Crystal <code>D10052.map</code> - the <strong>only</strong> RedValley_5F pocket with the
      Red Moon Room door at <code>(140, 23)</code> -> <code>D10062</code>.
      Idle zone <code>zone-red-valley-gd-6</code>.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a card: <code>use red moon door spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Recommended / live: door <code>(140, 23)</code></li>
      <li>Previous: <a href="../red-valley-5f-spot-picker/index.html">Floor 5 D10051</a> (no Moon door)</li>
      <li>Final KR: Red Moon Evil on <code>D10062</code></li>
    </ul>
  </header>
  <section class="section">
    <h2>Full map - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use red moon door spot X, Y</code> or <code>use red moon door spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="d10052-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Moon Door overview" />
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
      return { left: (mapX - meta.cropX) * meta.cellWidth * meta.scale, top: (mapY - meta.cropY) * meta.cellHeight * meta.scale };
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
      coords.textContent = "Copied: " + text + "  ->  use red moon door spot " + text;
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
Write-Output ([ordered]@{ outputRoot = $outRoot; html = $htmlPath; spotCount = $built.Count } | ConvertTo-Json)
