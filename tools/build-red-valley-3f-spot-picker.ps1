param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D10031.map",
  [string]$OutputRoot = "../tile-review/red-valley-3f-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal D10031 (RedValley_3F) - idle GD floor after Crystal Spider
# (zone-red-valley-gd-3 / Red Moon Valley - Floor 3, groupDungeonFloor 4).
# MirDB hub (150,150) spread 150: LureSpider / SpiderBat / GreatSpider / RootSpider /
# BigApe dense + BigApe3 x2.
$markers = @(
  @{ x = 150; y = 150; className = "boss"; title = "Mixed spider/ape hub (spread 150) - Lure/Bat/Great/Root/BigApe (+ BigApe3 x2)" },
  @{ x = 149; y = 103; className = "exit"; title = "Exit north to RedValley_4F D1004 (120, 37) - Crystal Spider floor" },
  @{ x = 290; y = 151; className = "exit"; title = "Exit east to RedValley_2F D1002 (14, 27)" }
)

$legend = @(
  @{ color = "#e74c3c"; label = "Mixed hub (150, 150)" },
  @{ color = "#9b59b6"; label = "Exits to 4F / 2F" }
)

$bullets = @(
  "Crystal D10031.map (RedValley_3F) - 300x300 - spider + ape mix floor",
  "Idle zone: zone-red-valley-gd-3 (Red Moon Valley - Floor 3, GD floor 4 after Crystal Nest)",
  "MirDB hub (150, 150) spread 150: LureSpider / SpiderBat / GreatSpider / RootSpider / BigApe + BigApe3 x2",
  "Idle waves: Spider Bat / Lure / Big Ape / Great / Venom / Gang (no Root on waves)",
  "Click the overview to copy coordinates for arenaSpawnMap / stamp focus"
)

$candidates = @(
  [ordered]@{
    id = "mixed-hub"
    label = "Mixed spider/ape hub"
    mapX = 150
    mapY = 150
    note = "MirDB trash hub (150, 150)."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "stand-187-107"
    label = "Live stand (187, 107)"
    mapX = 187
    mapY = 107
    note = "Selected party stand for zone-red-valley-gd-3 (one tile south of 187, 106)."
    recommended = $true
    role = "wave"
  },
  [ordered]@{
    id = "hub-north"
    label = "North of hub"
    mapX = 150
    mapY = 125
    note = "North toward the D1004 (Crystal Spider) exit."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-south"
    label = "South of hub"
    mapX = 150
    mapY = 175
    note = "South of hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-west"
    label = "West of hub"
    mapX = 125
    mapY = 150
    note = "West offset from hub."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-east"
    label = "East of hub"
    mapX = 175
    mapY = 150
    note = "East toward the D1002 exit."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-nw"
    label = "Northwest pocket"
    mapX = 125
    mapY = 125
    note = "NW diagonal - between hub and Crystal Spider exit."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-se"
    label = "Southeast pocket"
    mapX = 175
    mapY = 175
    note = "SE diagonal."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "hub-ne"
    label = "Northeast toward 2F exit"
    mapX = 220
    mapY = 150
    note = "Further east toward RedValley_2F warp at (290, 151)."
    recommended = $false
    role = "wave"
  },
  [ordered]@{
    id = "exit-4f-north"
    label = "Exit to 4F (Crystal Spider)"
    mapX = 149
    mapY = 103
    note = "Warp to RedValley_4F D1004 - layout reference, not a fight stand."
    recommended = $false
    role = "exit"
  },
  [ordered]@{
    id = "exit-2f-east"
    label = "Exit to 2F (east)"
    mapX = 290
    mapY = 151
    note = "Warp to RedValley_2F D1002 - layout reference, not a fight stand."
    recommended = $false
    role = "exit"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building RedValley_3F overview (D10031, 300x300)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -MapTitle "RedValley_3F" `
  -MapLabel "Red Moon Valley 3F - spider + ape mix" `
  -ImagePrefix "d10031-overview" `
  -PickCommand "use red moon valley 3f spot X, Y" `
  -HubLink "./index.html" `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers | ConvertFrom-Json

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  if (($cropX + $CropWCells) -gt 300) { $cropX = [Math]::Max(0, 300 - $CropWCells) }
  if (($cropY + $CropHCells) -gt 300) { $cropY = [Math]::Max(0, 300 - $CropHCells) }

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
    "boss" { '<span class="badge boss">Boss</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampCmd = 'powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + ($MapPath -replace '\\','/') + '" -StampId "red-valley-gd-3-center" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $CropWCells + ' -CropHCells ' + $CropHCells
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">D10031.map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use red moon valley 3f spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>' + $stampCmd + '</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "Red Moon Valley 3F (D10031) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = "D10031.map"
  mapTitle = "RedValley_3F"
  mapLabel = "Red Moon Valley 3F - spider + ape mix"
  zoneHint = "zone-red-valley-gd-3"
  stampHint = "red-valley-gd-3-center"
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewScale = $overviewJson.overviewScale
  scaledWidth = $overviewJson.scaledWidth
  scaledHeight = $overviewJson.scaledHeight
  mapWidth = 300
  mapHeight = 300
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
  <title>Red Moon Valley 3F - spot picker</title>
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
    <h1>Red Moon Valley 3F - spot picker</h1>
    <p class="meta">
      Crystal <code>D10031.map</code> (<strong>RedValley_3F</strong>) - spider + ape mix floor
      after Crystal Spider. Idle zone <code>zone-red-valley-gd-3</code>.
      <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a card: <code>use red moon valley 3f spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Recommended / live: hub <code>(150, 150)</code></li>
      <li>Previous: <a href="../crystal-spider-spot-picker/index.html">Crystal Spider (D1004)</a></li>
      <li>All floors: <a href="../red-moon-valley-spot-picker/index.html">Red Moon Valley spot picker</a></li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use red moon valley 3f spot X, Y</code> or <code>use red moon valley 3f spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="d10031-overview.png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="Red Moon Valley 3F overview" />
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
      coords.textContent = "Copied: " + text + "  ->  use red moon valley 3f spot " + text;
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
  overviewImage = (Join-Path $outRoot "d10031-overview.png")
} | ConvertTo-Json)
