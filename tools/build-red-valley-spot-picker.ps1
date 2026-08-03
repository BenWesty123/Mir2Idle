param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string]$OutputRoot = "../tile-review/red-moon-valley-spot-picker",
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  # Full overviews for maps larger than this are cropped around the floor hub (memory).
  [int]$FullOverviewMaxCells = 200
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }

function Get-MapPath([string]$FileName) {
  return Join-Path $MapRoot $FileName
}

# Idle GD floors -> Crystal Red Moon Valley (RedValley_*) pockets (MirDB / GM teleporter).
$floors = @(
  [ordered]@{
    id = "gd1"
    section = "GD 2 - Red Moon Valley 1F (D10011) - early spiders"
    zoneHint = "zone-red-valley-gd-1"
    stampId = "red-valley-gd-1-center"
    mapFile = "D10011.map"
    mapTitle = "RedValley_1F"
    mapLabel = "Red Moon Valley 1F"
    hubX = 200
    hubY = 200
    roleDefault = "wave"
  },
  [ordered]@{
    id = "gd2"
    section = "GD 3 - Red Moon Valley 4F (D1004) - Crystal Spider"
    zoneHint = "zone-red-valley-gd-2"
    stampId = "red-valley-gd-2-center"
    mapFile = "D1004.map"
    mapTitle = "RedValley_4F"
    mapLabel = "Red Moon Valley 4F"
    hubX = 150
    hubY = 150
    roleDefault = "boss"
  },
  [ordered]@{
    id = "gd3"
    section = "GD 4 - Red Moon Valley 3F (D10031) - spider + ape mix"
    zoneHint = "zone-red-valley-gd-3"
    stampId = "red-valley-gd-3-center"
    mapFile = "D10031.map"
    mapTitle = "RedValley_3F"
    mapLabel = "Red Moon Valley 3F"
    hubX = 150
    hubY = 150
    roleDefault = "wave"
  },
  [ordered]@{
    id = "gd4"
    section = "GD 5 - Red Moon Valley 5F pocket (D10053) - Red Evil Ape"
    zoneHint = "zone-red-valley-gd-4"
    stampId = "red-valley-gd-4-center"
    mapFile = "D10053.map"
    mapTitle = "RedValley_5F"
    mapLabel = "Red Moon Valley 5F (Red Evil Ape pocket)"
    hubX = 75
    hubY = 75
    roleDefault = "boss"
  },
  [ordered]@{
    id = "gd5"
    section = "GD 6 - Red Moon Valley 5F (D10051) - heavier ape/spider"
    zoneHint = "zone-red-valley-gd-5"
    stampId = "red-valley-gd-5-center"
    mapFile = "D10051.map"
    mapTitle = "RedValley_5F"
    mapLabel = "Red Moon Valley 5F"
    hubX = 150
    hubY = 150
    roleDefault = "wave"
  },
  [ordered]@{
    id = "rme"
    section = "GD 7 - Red Moon Room (D10062) - Red Moon Evil"
    zoneHint = "zone-red-moon-evil-kr"
    stampId = "red-moon-room-center"
    mapFile = "D10062.map"
    mapTitle = "RedMoonRoom"
    mapLabel = "Red Moon Room"
    hubX = 23
    hubY = 18
    roleDefault = "boss"
  }
)

$candidates = @(
  # --- GD1 D10011 ---
  [ordered]@{ id = "gd1-hub"; floorId = "gd1"; label = "1F respawn hub"; mapX = 200; mapY = 200; recommended = $true; role = "wave"; note = "Crystal trash hub (Venom/Gang/SpiderBat/RootSpider count 40/5, spread 200). Current live stamp focus." }
  [ordered]@{ id = "gd1-north"; floorId = "gd1"; label = "North of hub"; mapX = 200; mapY = 170; recommended = $false; role = "wave"; note = "Same open floor, one screen north of the MirDB hub." }
  [ordered]@{ id = "gd1-south"; floorId = "gd1"; label = "South of hub"; mapX = 200; mapY = 230; recommended = $false; role = "wave"; note = "South of hub - still inside the spread-200 farm area." }
  [ordered]@{ id = "gd1-west"; floorId = "gd1"; label = "West of hub"; mapX = 170; mapY = 200; recommended = $false; role = "wave"; note = "West offset from hub." }
  [ordered]@{ id = "gd1-east"; floorId = "gd1"; label = "East of hub"; mapX = 230; mapY = 200; recommended = $false; role = "wave"; note = "East offset from hub." }
  [ordered]@{ id = "gd1-sobo"; floorId = "gd1"; label = "EvilApeSobo pocket"; mapX = 240; mapY = 278; recommended = $false; role = "boss"; note = "Crystal EvilApeSobo fixed-ish spawn (count 1, spread 10) - quest/side pocket, not the main GD1 wave stand." }

  # --- GD2 D1004 Crystal Spider ---
  [ordered]@{ id = "gd2-hub"; floorId = "gd2"; label = "4F Crystal Spider hub"; mapX = 150; mapY = 150; recommended = $true; role = "boss"; note = "CrystalSpider (x1) + Lure/Bat/Root/BigApe/EvilApe lines at (150,150) spread 150. Current live focus." }
  [ordered]@{ id = "gd2-north"; floorId = "gd2"; label = "North of hub"; mapX = 150; mapY = 125; recommended = $false; role = "wave"; note = "Party stand north of the boss hub if center feels crowded." }
  [ordered]@{ id = "gd2-south"; floorId = "gd2"; label = "South of hub"; mapX = 150; mapY = 175; recommended = $false; role = "wave"; note = "South of hub." }
  [ordered]@{ id = "gd2-west"; floorId = "gd2"; label = "West of hub"; mapX = 125; mapY = 150; recommended = $false; role = "wave"; note = "West of hub." }
  [ordered]@{ id = "gd2-east"; floorId = "gd2"; label = "East of hub"; mapX = 175; mapY = 150; recommended = $false; role = "wave"; note = "East of hub." }

  # --- GD3 D10031 ---
  [ordered]@{ id = "gd3-hub"; floorId = "gd3"; label = "3F mixed hub"; mapX = 150; mapY = 150; recommended = $true; role = "wave"; note = "Lure/Bat/Great/Root/BigApe (+ BigApe3 x2) hub. Current live focus." }
  [ordered]@{ id = "gd3-north"; floorId = "gd3"; label = "North of hub"; mapX = 150; mapY = 125; recommended = $false; role = "wave"; note = "North offset." }
  [ordered]@{ id = "gd3-south"; floorId = "gd3"; label = "South of hub"; mapX = 150; mapY = 175; recommended = $false; role = "wave"; note = "South offset." }
  [ordered]@{ id = "gd3-west"; floorId = "gd3"; label = "West of hub"; mapX = 125; mapY = 150; recommended = $false; role = "wave"; note = "West offset." }
  [ordered]@{ id = "gd3-east"; floorId = "gd3"; label = "East of hub"; mapX = 175; mapY = 150; recommended = $false; role = "wave"; note = "East offset." }

  # --- GD4 D10053 Red Evil Ape ---
  [ordered]@{ id = "gd4-hub"; floorId = "gd4"; label = "Red Evil Ape hub"; mapX = 75; mapY = 75; recommended = $true; role = "boss"; note = "RedEvilApe (x1) + CrystalSpider (x1) + spider/ape trash on 100x100 pocket. Current live focus." }
  [ordered]@{ id = "gd4-north"; floorId = "gd4"; label = "North of hub"; mapX = 75; mapY = 55; recommended = $false; role = "wave"; note = "North of center on the small pocket map." }
  [ordered]@{ id = "gd4-south"; floorId = "gd4"; label = "South of hub"; mapX = 75; mapY = 90; recommended = $false; role = "wave"; note = "South of center." }
  [ordered]@{ id = "gd4-west"; floorId = "gd4"; label = "West of hub"; mapX = 55; mapY = 75; recommended = $false; role = "wave"; note = "West of center." }
  [ordered]@{ id = "gd4-east"; floorId = "gd4"; label = "East of hub"; mapX = 90; mapY = 75; recommended = $false; role = "wave"; note = "East of center." }

  # --- GD5 D10051 ---
  [ordered]@{ id = "gd5-hub"; floorId = "gd5"; label = "5F heavy hub"; mapX = 150; mapY = 150; recommended = $true; role = "wave"; note = "Dense spider/ape lines + CrystalSpider x1. Current live focus on 200x200 map." }
  [ordered]@{ id = "gd5-north"; floorId = "gd5"; label = "North of hub"; mapX = 150; mapY = 120; recommended = $false; role = "wave"; note = "North offset." }
  [ordered]@{ id = "gd5-south"; floorId = "gd5"; label = "South of hub"; mapX = 150; mapY = 175; recommended = $false; role = "wave"; note = "South offset." }
  [ordered]@{ id = "gd5-west"; floorId = "gd5"; label = "West of hub"; mapX = 120; mapY = 150; recommended = $false; role = "wave"; note = "West offset." }
  [ordered]@{ id = "gd5-east"; floorId = "gd5"; label = "East of hub"; mapX = 175; mapY = 150; recommended = $false; role = "wave"; note = "East offset." }

  # --- RME D10062 ---
  [ordered]@{ id = "rme-boss"; floorId = "rme"; label = "Red Moon Evil spawn"; mapX = 23; mapY = 18; recommended = $true; role = "boss"; note = "Crystal RedMoonEvil fixed spawn (count 1, spread 0). Current live stamp / arenaSpawnMap." }
  [ordered]@{ id = "rme-gm-stand"; floorId = "rme"; label = "GM warp stand"; mapX = 21; mapY = 21; recommended = $false; role = "entry"; note = "Crystal GM teleporter stand tile near the boss - useful tank position reference." }
  [ordered]@{ id = "rme-trash-hub"; floorId = "rme"; label = "Room trash hub"; mapX = 17; mapY = 21; recommended = $false; role = "wave"; note = "Crystal room trash lines (SpiderBat / BigApe / Lure / EvilApe variants) hub." }
)

$floorById = @{}
foreach ($floor in $floors) { $floorById[$floor.id] = $floor }

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$overviewMetaByFloor = @{}
foreach ($floor in $floors) {
  $mapPath = Get-MapPath $floor.mapFile
  if (-not (Test-Path $mapPath)) { throw "Missing Crystal map: $mapPath" }

  # Read map size via overview path's Type1 header (lightweight) - stamp script not needed.
  $bytes = [System.IO.File]::ReadAllBytes($mapPath)
  $xor = [BitConverter]::ToInt16($bytes, 23)
  $mapW = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $mapH = [BitConverter]::ToInt16($bytes, 25) -bxor $xor

  $cropX = 0
  $cropY = 0
  $cropW = $mapW
  $cropH = $mapH
  $overviewNote = "Full map overview."
  if ($mapW -gt $FullOverviewMaxCells -or $mapH -gt $FullOverviewMaxCells) {
    $cropW = [Math]::Min($mapW, 160)
    $cropH = [Math]::Min($mapH, 160)
    $cropX = [Math]::Max(0, [Math]::Min($mapW - $cropW, $floor.hubX - [int]($cropW / 2)))
    $cropY = [Math]::Max(0, [Math]::Min($mapH - $cropH, $floor.hubY - [int]($cropH / 2)))
    $overviewNote = "Cropped overview around hub ($($floor.hubX), $($floor.hubY)) - full map is $($mapW)x$($mapH)."
  }

  $markers = @(
    @{ x = $floor.hubX; y = $floor.hubY; className = "boss"; title = "$($floor.mapLabel) primary hub / current focus" }
  )
  foreach ($spot in $candidates) {
    if ($spot.floorId -ne $floor.id) { continue }
    if ($spot.mapX -eq $floor.hubX -and $spot.mapY -eq $floor.hubY) { continue }
    $markers += @{
      x = $spot.mapX
      y = $spot.mapY
      className = $(if ($spot.role -eq "boss") { "boss" } elseif ($spot.role -eq "entry") { "entry" } else { "wave" })
      title = $spot.label
    }
  }

  $prefix = "$($floor.id)-overview"
  Write-Host "Building overview for $($floor.mapFile) ($($mapW)x$($mapH)) crop ($cropX,$cropY)+${cropW}x${cropH}..."
  $overviewJson = & $overviewScript `
    -DataRoot $DataRoot `
    -MapPath $mapPath `
    -OutputRoot $OutputRoot `
    -MapTitle $floor.mapTitle `
    -MapLabel $floor.mapLabel `
    -ImagePrefix $prefix `
    -PickCommand "use red moon valley $($floor.id) spot X, Y" `
    -HubLink "./index.html" `
    -Bullets @($overviewNote, "Zone: $($floor.zoneHint)", "Stamp: $($floor.stampId)") `
    -Legend @(
      @{ color = "#e74c3c"; label = "Primary hub / boss" },
      @{ color = "#3498db"; label = "Alt wave stand" },
      @{ color = "#2ecc71"; label = "Entry / stand ref" }
    ) `
    -Markers $markers `
    -CropX $cropX `
    -CropY $cropY `
    -CropWCells $cropW `
    -CropHCells $cropH | ConvertFrom-Json

  $overviewMetaByFloor[$floor.id] = [ordered]@{
    image = "$prefix.png"
    mapFile = $floor.mapFile
    mapTitle = $floor.mapTitle
    mapLabel = $floor.mapLabel
    zoneHint = $floor.zoneHint
    stampId = $floor.stampId
    mapWidth = $mapW
    mapHeight = $mapH
    cropX = $cropX
    cropY = $cropY
    cropWCells = $cropW
    cropHCells = $cropH
    overviewScale = $overviewJson.overviewScale
    scaledWidth = $overviewJson.scaledWidth
    scaledHeight = $overviewJson.scaledHeight
    overviewNote = $overviewNote
    markers = $markers
  }
}

$built = New-Object System.Collections.Generic.List[object]
$cardsByFloor = @{}
foreach ($floor in $floors) { $cardsByFloor[$floor.id] = New-Object System.Collections.Generic.List[string] }

foreach ($spot in $candidates) {
  $floor = $floorById[$spot.floorId]
  $mapPath = Get-MapPath $floor.mapFile
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  # Keep crop inside map bounds for small rooms (D10053 / D10062).
  $meta = $overviewMetaByFloor[$floor.id]
  if (($cropX + $CropWCells) -gt $meta.mapWidth) { $cropX = [Math]::Max(0, $meta.mapWidth - $CropWCells) }
  if (($cropY + $CropHCells) -gt $meta.mapHeight) { $cropY = [Math]::Max(0, $meta.mapHeight - $CropHCells) }
  $useW = [Math]::Min($CropWCells, $meta.mapWidth)
  $useH = [Math]::Min($CropHCells, $meta.mapHeight)

  $previewFile = "spot-$($spot.id).png"
  $previewPath = Join-Path $previewDir $previewFile
  Write-Host "Building preview $($spot.id) on $($floor.mapFile) at ($($spot.mapX), $($spot.mapY))..."
  & $stampScript `
    -DataRoot $DataRoot `
    -MapPath $mapPath `
    -OutputRoot (Resolve-Path $previewDir).Path `
    -StampId "preview-$($spot.id)" `
    -SheetFile $previewFile `
    -StampLabel $spot.label `
    -SkipIndex `
    -CropX $cropX `
    -CropY $cropY `
    -CropWCells $useW `
    -CropHCells $useH `
    -FocusMapX $spot.mapX `
    -FocusMapY $spot.mapY | Out-Null

  if (-not (Test-Path $previewPath)) { throw "Preview not created: $previewPath" }

  $built.Add([ordered]@{
    id = $spot.id
    label = $spot.label
    floorId = $floor.id
    section = $floor.section
    zoneHint = $floor.zoneHint
    stampId = $floor.stampId
    role = $spot.role
    mapFile = $floor.mapFile
    mapTitle = $floor.mapTitle
    mapX = $spot.mapX
    mapY = $spot.mapY
    cropX = $cropX
    cropY = $cropY
    cropWCells = $useW
    cropHCells = $useH
    note = $spot.note
    recommended = [bool]$spot.recommended
    previewFile = "previews/$previewFile"
  })

  $rec = if ($spot.recommended) { '<span class="badge rec">Recommended / live</span>' } else { "" }
  $roleBadge = switch ($spot.role) {
    "boss" { '<span class="badge boss">Boss</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    default { "" }
  }
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">' + $floor.mapFile + ' (' + $spot.mapX + ', ' + $spot.mapY + ') - ' + $floor.zoneHint + '</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party / boss stand. Preview crop ' + $useW + 'x' + $useH + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use red moon valley spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + $mapPath.Replace('\','/') + '" -StampId "' + $floor.stampId + '" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells ' + $useW + ' -CropHCells ' + $useH + '</code></p>'
    '</article>'
  ) -join "`n"
  $cardsByFloor[$floor.id].Add($cardHtml)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$manifest = [ordered]@{
  title = "Red Moon Valley - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  floors = @($floors | ForEach-Object {
    $meta = $overviewMetaByFloor[$_.id]
    [ordered]@{
      id = $_.id
      section = $_.section
      zoneHint = $_.zoneHint
      stampId = $_.stampId
      mapFile = $_.mapFile
      mapTitle = $_.mapTitle
      hubX = $_.hubX
      hubY = $_.hubY
      overview = $meta
    }
  })
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  spots = @($built.ToArray())
}
[System.IO.File]::WriteAllText(
  (Join-Path $outRoot "spots.json"),
  ($manifest | ConvertTo-Json -Depth 8),
  $utf8NoBom
)

$sectionHtml = New-Object System.Collections.Generic.List[string]
foreach ($floor in $floors) {
  $meta = $overviewMetaByFloor[$floor.id]
  $markersJson = ($meta.markers | ForEach-Object {
    "            { x: $($_.x), y: $($_.y), className: `"$($_.className)`", title: `"$($_.title -replace '"','\"')`" }"
  }) -join ",`n"

  $viewerId = "viewer-$($floor.id)"
  $imgId = "map-$($floor.id)"
  $coordsId = "coords-$($floor.id)"
  $toggleId = "toggle-$($floor.id)"

  $overviewBlock = @"
    <div class="toolbar">
      <div class="coords-bar" id="$coordsId">Hover the map...</div>
      <label><input type="checkbox" id="$toggleId" checked /> Show markers</label>
    </div>
    <div class="viewer" id="$viewerId">
      <img id="$imgId" src="$($meta.image)" width="$($meta.scaledWidth)" height="$($meta.scaledHeight)" alt="$($floor.mapLabel) overview" />
    </div>
    <p class="note">$($meta.overviewNote) Click to copy <code>X, Y</code>, then reply <code>use red moon valley $($floor.id) spot X, Y</code>.</p>
    <script>
      (function () {
        const meta = {
          cropX: $($meta.cropX),
          cropY: $($meta.cropY),
          cellWidth: 48,
          cellHeight: 32,
          scale: $($meta.overviewScale),
          floorId: "$($floor.id)",
          dots: [
$markersJson
          ]
        };
        const viewer = document.getElementById("$viewerId");
        const img = document.getElementById("$imgId");
        const coords = document.getElementById("$coordsId");
        const toggle = document.getElementById("$toggleId");
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
          coords.textContent = "Copied: " + text + "  ->  use red moon valley " + meta.floorId + " spot " + text;
          try { await navigator.clipboard.writeText(text); } catch {}
        });
        toggle.addEventListener("change", renderMarkers);
        img.addEventListener("load", renderMarkers);
        renderMarkers();
      })();
    </script>
"@

  $sectionHtml.Add(@"
  <section class="section" id="floor-$($floor.id)">
    <h2>$($floor.section)</h2>
    <p class="meta">Map <code>$($floor.mapFile)</code> ($($meta.mapWidth)x$($meta.mapHeight)) - zone <code>$($floor.zoneHint)</code> - stamp <code>$($floor.stampId)</code></p>
$overviewBlock
    <div class="grid">
$($cardsByFloor[$floor.id] -join "`n")
    </div>
  </section>
"@)
}

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Red Moon Valley - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; --entry:#2e6b4a; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; color:#f4dfb0; }
    h2 { margin:0 0 10px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:1100px; }
    .meta ul { margin:8px 0 0; padding-left:20px; }
    .section { padding:22px 24px 10px; border-top:1px solid var(--line); }
    .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:12px 0; }
    .coords-bar { font-family:Consolas,monospace; background:#1b2029; border:1px solid #3a4354; padding:8px 12px; border-radius:6px; min-width:320px; }
    .viewer { position:relative; display:inline-block; border:1px solid var(--line); background:#050504; max-width:100%; overflow:auto; border-radius:8px; }
    .viewer img { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; cursor:crosshair; }
    .marker { position:absolute; transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width:12px; height:12px; border-radius:50%; border:2px solid #fff; }
    .marker.boss { background:#e74c3c; width:14px; height:14px; }
    .marker.wave { background:#3498db; }
    .marker.entry { background:#2ecc71; }
    .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); margin-top:16px; }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { padding:0; border:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; flex-basis:100%; }
    .badge { font-size:11px; padding:2px 8px; border-radius:999px; }
    .badge.rec { background:var(--rec); color:#dff3e4; }
    .badge.boss { background:var(--boss); color:#f8d8d8; }
    .badge.wave { background:var(--wave); color:#d8e8f8; }
    .badge.entry { background:var(--entry); color:#dff3e4; }
    figure { margin:0; border:1px solid var(--line); border-radius:8px; overflow:auto; background:#050504; }
    figure img { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; }
    figcaption { padding:8px 10px; font-size:12px; color:var(--muted); border-top:1px solid var(--line); }
    .note { margin:8px 0; color:var(--muted); font-size:13px; }
    .pick { margin:0; color:var(--accent); }
    .cmd { margin:0; font-size:11px; color:var(--muted); word-break:break-all; }
    code { color:#d4bc86; }
    a { color:var(--accent); }
    .toc a { margin-right:12px; }
  </style>
</head>
<body>
  <header>
    <h1>Red Moon Valley - spot picker</h1>
    <p class="meta">
      Crystal <strong>Tao Village -> Tree Path -> Red Moon Valley -> Red Moon Room</strong>.
      Pick party/boss stands for each idle GD floor. Hover/click an overview to copy coords, or use a preset card.
      Reply e.g. <code>use red moon valley spot gd1-hub</code> or <code>use red moon valley gd2 spot 150, 140</code>.
    </p>
    <ul class="meta toc">
      <li><a href="#floor-gd1">GD2 - D10011</a> - <a href="#floor-gd2">GD3 - D1004 Crystal Spider</a> - <a href="#floor-gd3">GD4 - D10031</a></li>
      <li><a href="#floor-gd4">GD5 - D10053 Red Evil Ape</a> - <a href="#floor-gd5">GD6 - D10051</a> - <a href="#floor-rme">GD7 - D10062 RME</a></li>
      <li>Tree Path (GD1) is separate: <a href="../tree-path-spot-picker/index.html">tree-path-spot-picker</a></li>
    </ul>
  </header>
$($sectionHtml -join "`n")
</body>
</html>
"@

$htmlPath = Join-Path $outRoot "index.html"
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)

Write-Output ([ordered]@{
  outputRoot = $outRoot
  html = $htmlPath
  spotCount = $built.Count
  floorCount = $floors.Count
} | ConvertTo-Json)
