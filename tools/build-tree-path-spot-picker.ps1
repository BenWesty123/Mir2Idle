param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/12.map",
  [string]$OutputRoot = "../tile-review/tree-path-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  # Full Treepath is 350x500 - overview cropped to spider farm rectangle.
  [int]$OverviewCropX = 40,
  [int]$OverviewCropY = 40,
  [int]$OverviewCropW = 280,
  [int]$OverviewCropH = 280
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal 12.map (Treepath) - outdoor approach from Tao Village / Woomyon Woods(N)
# before Red Valley. MirDB respawns + movements.
$markers = @(
  @{ x = 200; y = 200; className = "boss"; title = "Center spider hub (Venom/Gang/Lure/Great/Root) - recommended GD stand" },
  @{ x = 100; y = 100; className = "wave"; title = "NW spider hub" },
  @{ x = 300; y = 100; className = "wave"; title = "NE spider hub" },
  @{ x = 100; y = 300; className = "wave"; title = "SW spider hub" },
  @{ x = 300; y = 300; className = "wave"; title = "SE spider hub" },
  @{ x = 250; y = 250; className = "boss"; title = "CrystalSpider (x1, spread 250)" },
  @{ x = 50; y = 270; className = "boss"; title = "BloodyLureSpider quest spawn (x1, spread 5)" },
  @{ x = 89; y = 13; className = "exit"; title = "Exit north to RedValley_1F D10011 (269, 384)" },
  @{ x = 320; y = 119; className = "exit"; title = "Exit east to RedValley_1F D10011 (269, 384)" },
  @{ x = 15; y = 294; className = "exit"; title = "Exit west to Lunar_1F" },
  @{ x = 323; y = 476; className = "entry"; title = "South edge toward WoomyonWoods(N) / Tao Village approach" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Center hub / CrystalSpider / BloodyLure" },
  @{ color = "#3498db"; label = "Corner spider hubs (100/300)" },
  @{ color = "#9b59b6"; label = "Exits to Red Valley / Lunar" },
  @{ color = "#2ecc71"; label = "South woods edge (Woomyon / Tao Village)" }
)

$bullets = @(
  "Crystal 12.map (Treepath) - 350x500 outdoor map, light 4",
  "Tao Village approach woods BEFORE Red Valley - Crystal name is Tree Path (not Red Tree Path)",
  "Trash hubs: VenomSpider, GangSpider, LureSpider, GreatSpider, RootSpider at five pockets",
  "Rare: CrystalSpider (250, 250) and BloodyLureSpider quest (50, 270)",
  "Warps into RedValley_1F (D10011) from (89, 13) and (320, 119)",
  "Overview below is cropped to the spider farm (40,40)+(280x280) - full map is larger to the south",
  "Click the overview to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{
    id = "center-hub"
    label = "Center spider hub"
    mapX = 200
    mapY = 200
    note = "Main MirDB hub - Venom/Gang/Lure/Great (x20) + RootSpider (x5), spread 100. Best default Tree Path GD stand."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "nw-hub"
    label = "NW spider hub"
    mapX = 100
    mapY = 100
    note = "North-west pocket - same spider mix as center."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "ne-hub"
    label = "NE spider hub"
    mapX = 300
    mapY = 100
    note = "North-east pocket - closer to the east Red Valley warp (320, 119)."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "sw-hub"
    label = "SW spider hub"
    mapX = 100
    mapY = 300
    note = "South-west pocket - near BloodyLureSpider quest tile and Lunar exit."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "se-hub"
    label = "SE spider hub"
    mapX = 300
    mapY = 300
    note = "South-east pocket - same spider mix."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "crystal-spider"
    label = "Crystal Spider roam"
    mapX = 250
    mapY = 250
    note = "CrystalSpider x1 with huge spread 250 - rare outdoor roam, not the Red Valley 4F KR."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "bloody-lure"
    label = "Bloody Lure Spider"
    mapX = 50
    mapY = 270
    note = "Quest BloodyLureSpider (x1, spread 5) - Tiny fixed pocket, not a wave farm."
    recommended = $false
    role = "boss"
  },
  [ordered]@{
    id = "center-north"
    label = "North of center hub"
    mapX = 200
    mapY = 170
    note = "Offset stand still inside center spread-100 farm."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "center-south"
    label = "South of center hub"
    mapX = 200
    mapY = 230
    note = "Offset stand south of center hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "rv-exit-north"
    label = "Red Valley exit (north)"
    mapX = 89
    mapY = 13
    note = "Crystal warp to RedValley_1F D10011 (269, 384). Layout reference, not a farm stand."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "rv-exit-east"
    label = "Red Valley exit (east)"
    mapX = 320
    mapY = 119
    note = "Second warp to RedValley_1F D10011 (269, 384)."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "woods-edge"
    label = "South woods edge"
    mapX = 323
    mapY = 476
    note = "Toward WoomyonWoods(N) / Tao Village approach. Outside the farm overview crop."
    recommended = $false
    role = "entry"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building Tree Path spider-farm overview (crop $($OverviewCropX),$($OverviewCropY)+$($OverviewCropW)x$($OverviewCropH) on 350x500)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "Treepath" `
  -MapLabel "Tree Path" `
  -ImagePrefix "treepath-overview" `
  -PickCommand "use tree path spot X, Y" `
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
  if (($cropX + $CropWCells) -gt 350) { $cropX = [Math]::Max(0, 350 - $CropWCells) }
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
    "boss" { '<span class="badge boss">Rare</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "tree-path-center" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">12.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use tree path spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Tree Path (Treepath) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "12.map"
  mapTitle = "Treepath"
  mapLabel = "Tree Path"
  zoneHint = "zone-tree-path (planned GD floor 1)"
  stampHint = "tree-path-center"
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewCrop = [ordered]@{ x = $OverviewCropX; y = $OverviewCropY; w = $OverviewCropW; h = $OverviewCropH }
  overviewScale = $overviewJson.overviewScale
  scaledWidth = $overviewJson.scaledWidth
  scaledHeight = $overviewJson.scaledHeight
  mapWidth = 350
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
  <title>Tree Path - spot picker</title>
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
    <h1>Tree Path - spot picker</h1>
    <p class="meta">
      Crystal <code>12.map</code> (<strong>Treepath</strong>) - outdoor spider woods from Tao Village,
      before Red Valley. Planned idle GD floor 1.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a card: <code>use tree path spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Recommended farm: center hub <code>(200, 200)</code></li>
      <li>Exits to Red Valley 1F: <code>(89, 13)</code> and <code>(320, 119)</code></li>
      <li>Related: <a href="../red-moon-valley-spot-picker/index.html">Red Moon Valley spot picker</a></li>
    </ul>
  </header>

  <section class="section">
    <h2>Spider farm overview - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use tree path spot X, Y</code> or <code>use tree path spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="treepath-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Tree Path overview" />
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
        // Skip markers outside the overview crop (e.g. south woods edge).
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
      coords.textContent = "Copied: " + text + "  ->  use tree path spot " + text;
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
  overviewImage = (Join-Path $outRoot "treepath-overview.png")
} | ConvertTo-Json)
