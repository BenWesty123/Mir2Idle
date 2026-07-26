param(
  [Parameter(Mandatory = $true)][ValidateSet(1, 2, "kr", "KR")][string]$Floor,
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [double]$OverviewScale = 0
)

$ErrorActionPreference = "Stop"

$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$overviewScript = Join-Path $toolsDir "build-fire-hell-overview.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }

$floorKey = if ($Floor -eq "KR") { "kr" } else { "$Floor" }

$floorDefs = @{
  "1" = [ordered]@{
    MapFile = "HF1.map"
    MapTitle = "HellFire_1F"
    MapLabel = "Fire Hell - Floor 1"
    ImagePrefix = "fire-hell-1-overview"
    OutputRoot = "../tile-review/fire-hell-1-spot-picker"
    ZoneHint = "zone-fire-hell-gd-1"
    PickWord = "fire hell 1"
    HubX = 50
    HubY = 60
    HubNote = "Crystal spawn hub (HellKnight1/2 + HellBomb1, spread 200 around 50,60)."
    TrashNote = "Hell Knight / Hell Knight Captain + Hell Bomb trash"
    Span = 24
  }
  "2" = [ordered]@{
    MapFile = "HF2.map"
    MapTitle = "HellFire_2F"
    MapLabel = "Fire Hell - Floor 2"
    ImagePrefix = "fire-hell-2-overview"
    OutputRoot = "../tile-review/fire-hell-2-spot-picker"
    ZoneHint = "zone-fire-hell-gd-2"
    PickWord = "fire hell 2"
    HubX = 206
    HubY = 193
    HubNote = "Crystal spawn hub (HellKnight2/3 + HellBomb1/2, spread 300 around 206,193)."
    TrashNote = "Hell Knight Guard / Elite + Hell Bomb Mk II/III trash"
    Span = 24
  }
  "kr" = [ordered]@{
    MapFile = "HKR.map"
    MapTitle = "HellFire_KingsRoom"
    MapLabel = "Fire Hell - KR (Hell Lord)"
    ImagePrefix = "fire-hell-kr-overview"
    OutputRoot = "../tile-review/fire-hell-kr-spot-picker"
    ZoneHint = "zone-fire-hell-gd-3"
    PickWord = "fire hell kr"
    HubX = 31
    HubY = 19
    HubNote = "Crystal Hell Lord spawn (31,19). Knight Elite + Bomb Mk III trash hub at (22,30)."
    TrashNote = "Boss: Hell Lord. Adds nearby: Hell Knight Elite + Hell Bomb Mk III"
    Span = 10
    ExtraTargets = @(
      [ordered]@{ id = "trashhub"; label = "Trash spawn hub"; tx = 22; ty = 30; rec = $false; note = "Crystal Knight Elite + Bomb Mk III respawn hub (spread 30)." }
      [ordered]@{ id = "entry"; label = "Entry from HF3"; tx = 15; ty = 37; rec = $false; note = "Crystal movement destination from HF3 into the kings room." }
    )
  }
}

$def = $floorDefs[$floorKey]
if (-not $def) { throw "Unknown floor: $Floor" }
$MapPath = Join-Path $MapRoot $def.MapFile
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

function Read-Type5Walkable($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $width = [BitConverter]::ToInt16($bytes, 22)
  $height = [BitConverter]::ToInt16($bytes, 24)
  $walkable = New-Object "System.Collections.Generic.HashSet[string]"
  $offset = 28 + (3 * ([Math]::Floor($width / 2) + ($width % 2)) * [Math]::Floor($height / 2))
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $flag = $bytes[$offset]
      $offset += 14
      if (($flag -band 1) -eq 1) { [void]$walkable.Add("$x,$y") }
    }
  }
  return [pscustomobject]@{ Width = $width; Height = $height; Walkable = $walkable }
}

$map = Read-Type5Walkable $MapPath

function Snap-ToWalkable([int]$tx, [int]$ty) {
  $tx = $tx - ($tx -band 1); $ty = $ty - ($ty -band 1)
  for ($r = 0; $r -le 80; $r += 2) {
    for ($dx = -$r; $dx -le $r; $dx += 2) {
      for ($dy = -$r; $dy -le $r; $dy += 2) {
        if ([Math]::Abs($dx) -ne $r -and [Math]::Abs($dy) -ne $r) { continue }
        $nx = $tx + $dx; $ny = $ty + $dy
        if ($map.Walkable.Contains("$nx,$ny")) { return @($nx, $ny) }
      }
    }
  }
  return $null
}

$cx = $def.HubX
$cy = $def.HubY
$span = if ($def.Span) { [int]$def.Span } else { 24 }
$targets = @(
  [ordered]@{ id = "hub";        label = "Spawn hub";             tx = $cx;          ty = $cy;          rec = $true;  note = $def.HubNote },
  [ordered]@{ id = "north";      label = "North of hub";          tx = $cx;          ty = $cy - $span;  rec = $false; note = "Open floor north of the Crystal spawn hub." },
  [ordered]@{ id = "south";      label = "South of hub";          tx = $cx;          ty = $cy + $span;  rec = $false; note = "Open floor south of the Crystal spawn hub." },
  [ordered]@{ id = "west";       label = "West of hub";           tx = $cx - $span;  ty = $cy;          rec = $false; note = "Open floor west of the Crystal spawn hub." },
  [ordered]@{ id = "east";       label = "East of hub";           tx = $cx + $span;  ty = $cy;          rec = $false; note = "Open floor east of the Crystal spawn hub." },
  [ordered]@{ id = "northwest";  label = "North-west pocket";     tx = $cx - $span;  ty = $cy - $span;  rec = $false; note = "Diagonal pocket for a different backdrop." },
  [ordered]@{ id = "southeast";  label = "South-east pocket";     tx = $cx + $span;  ty = $cy + $span;  rec = $false; note = "Diagonal pocket for a different backdrop." }
)
if ($def.ExtraTargets) {
  $targets = @($targets) + @($def.ExtraTargets)
}

$candidates = New-Object System.Collections.Generic.List[object]
$seen = @{}
foreach ($t in $targets) {
  $snap = Snap-ToWalkable $t.tx $t.ty
  if ($null -eq $snap) { continue }
  $key = "$($snap[0]),$($snap[1])"
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true
  $candidates.Add([ordered]@{
    id = $t.id; label = $t.label; mapX = $snap[0]; mapY = $snap[1]; note = $t.note; recommended = [bool]$t.rec; role = "wave"
  })
}

$markers = @()
foreach ($c in $candidates) {
  $cls = if ($c.recommended) { "boss" } else { "wave" }
  $markers += @{ x = $c.mapX; y = $c.mapY; className = $cls; title = $c.label }
}

$legend = @(
  @{ color = "#f39c12"; label = "Recommended stand (Crystal spawn hub)" },
  @{ color = "#3498db"; label = "Alternate open-floor stands" }
)

$bullets = @(
  "Crystal $($def.MapFile) ($($def.MapTitle)) - $($map.Width)x$($map.Height) Mir3 Type5 map",
  "Trash plan: $($def.TrashNote)",
  "Crystal only stores one huge spread hub - pick the party stand from the map yourself",
  "Click anywhere on the full map to copy coordinates for arenaSpawnMap / arenaFocusMap"
)

$outRoot = Join-Path $toolsDir $def.OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

Write-Host "Building $($def.MapLabel) full-map overview ($($map.Width)x$($map.Height) - may take a few minutes)..."
$overviewJson = & $overviewScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $def.OutputRoot `
  -MapTitle $def.MapTitle `
  -MapLabel $def.MapLabel `
  -ImagePrefix $def.ImagePrefix `
  -PickCommand "use $($def.PickWord) spot X, Y" `
  -HubLink $(if ($Floor -eq 1) { "../fire-hell-2-spot-picker/index.html" } else { "../fire-hell-1-spot-picker/index.html" }) `
  -Bullets $bullets `
  -Legend $legend `
  -Markers $markers `
  -OverviewScale $OverviewScale `
  -SkipFullPng | ConvertFrom-Json

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  $previewFile = "spot-$($spot.id).png"
  $previewPath = Join-Path $previewDir $previewFile
  $previewRelRoot = ($def.OutputRoot.TrimEnd('/', '\') + "/previews")

  Write-Host "Building preview $($spot.id) at map ($($spot.mapX), $($spot.mapY))..."
  & $overviewScript `
    -DataRoot $DataRoot `
    -MapPath $MapPath `
    -OutputRoot $previewRelRoot `
    -MapTitle $def.MapTitle `
    -MapLabel $spot.label `
    -ImagePrefix ("spot-" + $spot.id) `
    -CropX $cropX `
    -CropY $cropY `
    -CropWCells $CropWCells `
    -CropHCells $CropHCells `
    -OverviewScale 1 `
    -SkipHtml `
    -SkipFullPng | Out-Null

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

  $rec = if ($spot.recommended) { '<span class="badge rec">Recommended</span>' } else { "" }
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' <span class="badge wave">Stand</span>'
    '<span class="coords">' + $def.MapFile + ' (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use ' + $def.PickWord + ' spot ' + $spot.id + '</code></p>'
  ) -join "`n"
  $cardHtml += "`n</article>"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  title = "$($def.MapLabel) ($($def.MapTitle)) - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  map = $def.MapFile
  mapTitle = $def.MapTitle
  mapLabel = $def.MapLabel
  zoneHint = $def.ZoneHint
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
[System.IO.File]::WriteAllText((Join-Path $outRoot "spots.json"), ($manifest | ConvertTo-Json -Depth 6), $utf8NoBom)

$metaPath = Join-Path $outRoot "meta.json"
$meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
$markersJson = ($meta.markers | ForEach-Object {
  "        { x: $($_.x), y: $($_.y), className: `"$($_.className)`", title: `"$($_.title -replace '"','\"')`" }"
}) -join ",`n"

$legendHtml = ($legend | ForEach-Object {
  "      <span><i class=`"dot`" style=`"background:$($_.color)`"></i> $($_.label)</span>"
}) -join "`n"

$bulletHtml = ($bullets | ForEach-Object { "      <li>$_</li>" }) -join "`n"
$otherFloor = if ($Floor -eq 1) { 2 } else { 1 }
$otherLink = "../fire-hell-$otherFloor-spot-picker/index.html"

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>$($def.MapLabel) - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0b0f14; --panel:#111821; --text:#dbe8f0; --muted:#7d94a8; --accent:#5db4d6; --line:#1c2a36; --rec:#2e5a6b; --wave:#2e4a6b; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; color:#bfe4f4; }
    h2 { margin:0 0 14px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:1080px; }
    .meta ul { margin:8px 0 0; padding-left:20px; }
    .section { padding:20px 24px 8px; }
    .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:16px 0; }
    .coords-bar { font-family:Consolas,monospace; background:#12202b; border:1px solid #24455a; padding:8px 12px; border-radius:6px; min-width:360px; }
    .viewer { position:relative; display:inline-block; border:1px solid var(--line); background:#04070a; max-width:100%; overflow:auto; border-radius:8px; }
    #mapImage { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; cursor:crosshair; }
    .marker { position:absolute; transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width:12px; height:12px; border-radius:50%; border:2px solid #fff; }
    .marker.boss { background:#f39c12; width:14px; height:14px; }
    .marker.wave { background:#3498db; }
    .legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; color:var(--muted); }
    .legend span { display:inline-flex; align-items:center; gap:6px; }
    .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { padding:0; border:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; }
    .badge { font-size:11px; padding:2px 8px; border-radius:999px; }
    .badge.rec { background:var(--rec); color:#d4f0fa; }
    .badge.wave { background:var(--wave); color:#d8e8f8; }
    figure { margin:0; border:1px solid var(--line); border-radius:8px; overflow:auto; background:#04070a; }
    figure img { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; }
    figcaption { padding:8px 10px; font-size:12px; color:var(--muted); border-top:1px solid var(--line); }
    .note { margin:0; color:var(--muted); font-size:13px; }
    .pick { margin:0; color:var(--accent); }
    code { color:#8fd0e6; }
    a { color:var(--accent); }
  </style>
</head>
<body>
  <header>
    <h1>$($def.MapLabel) - group dungeon spot picker</h1>
    <p class="meta">
      Crystal <code>$($def.MapFile)</code> ($($def.MapTitle)). Mock arena for <code>$($def.ZoneHint)</code>.
      Also: <a href="$otherLink">Fire Hell Floor $otherFloor</a>.
      <strong>Hover</strong> the full map for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.
      Or pick a preset card below: <code>use $($def.PickWord) spot &lt;id&gt;</code>.
    </p>
    <ul class="meta">
      <li>Zone hint: <code>$($def.ZoneHint)</code></li>
      <li>Recommended default: Crystal spawn hub (see orange marker)</li>
    </ul>
  </header>

  <section class="section">
    <h2>Full map - click for spawn coordinates</h2>
    <ul class="meta">
$bulletHtml
      <li>Then reply: <code>use $($def.PickWord) spot X, Y</code> or <code>use $($def.PickWord) spot &lt;id&gt;</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords-bar" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="$($def.ImagePrefix).png" width="$($overviewJson.scaledWidth)" height="$($overviewJson.scaledHeight)" alt="$($def.MapLabel) overview" />
    </div>
    <div class="legend">
$legendHtml
    </div>
  </section>

  <section class="section">
    <h2>Preset candidate stands</h2>
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
  floor = $Floor
  outputRoot = $outRoot
  html = $htmlPath
  spotCount = $built.Count
  overviewImage = (Join-Path $outRoot "$($def.ImagePrefix).png")
} | ConvertTo-Json)
