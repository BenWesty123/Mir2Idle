param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath2F = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2004.map",
  [string]$MapPathKing = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2006.map",
  [string]$OutputRoot = "../tile-review/bdd-2f-spot-picker",
  [int]$CropWCells = 32,
  [int]$CropHCells = 28,
  [int]$HalfCropW = 16,
  [int]$HalfCropH = 14
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$stampScript = Join-Path $PSScriptRoot "build-bdd-2f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }

# Crystal BlackDragonDungeon_2F (D2004) + WoomaPalace / King Scorpion room (D2006).
$candidates = @(
  [ordered]@{
    id = "king-scorpion"
    label = "King Scorpion room"
    mapPath = $MapPathKing
    mapFile = "D2006.map"
    mapTitle = "WoomaPalace"
    mapX = 49
    mapY = 51
    note = "Crystal King Scorpion spawn (x1) with Ghoul21 / ZumaArcher21 / WoomaGuardian6 lines. Deepest BDD boss pocket before later palaces."
    recommended = $true
    section = "King Scorpion (D2006)"
  },
  [ordered]@{
    id = "king-north"
    label = "Wooma north pocket"
    mapPath = $MapPathKing
    mapFile = "D2006.map"
    mapTitle = "WoomaPalace"
    mapX = 33
    mapY = 33
    note = "Smaller north chamber on D2006 - ZumaStatue20 single spawn."
    recommended = $false
    section = "King Scorpion (D2006)"
  },
  [ordered]@{
    id = "king-south"
    label = "Wooma south pocket"
    mapPath = $MapPathKing
    mapFile = "D2006.map"
    mapTitle = "WoomaPalace"
    mapX = 69
    mapY = 71
    note = "South farming pocket on D2006 - WoomaGuardian6 lines."
    recommended = $false
    section = "King Scorpion (D2006)"
  },
  [ordered]@{
    id = "hub-east"
    label = "2F east hub"
    mapPath = $MapPath2F
    mapFile = "D2004.map"
    mapTitle = "BlackDragonDungeon_2F"
    mapX = 70
    mapY = 67
    note = "Largest open pocket on Crystal BDD 2F - Ghoul21 + ZumaArcher21 respawn cluster."
    recommended = $true
    section = "Crystal BDD 2F (D2004)"
  },
  [ordered]@{
    id = "mid-west"
    label = "2F west mid"
    mapPath = $MapPath2F
    mapFile = "D2004.map"
    mapTitle = "BlackDragonDungeon_2F"
    mapX = 37
    mapY = 51
    note = "Secondary respawn cluster on D2004."
    recommended = $false
    section = "Crystal BDD 2F (D2004)"
  },
  [ordered]@{
    id = "north-mini"
    label = "2F north mini-boss"
    mapPath = $MapPath2F
    mapFile = "D2004.map"
    mapTitle = "BlackDragonDungeon_2F"
    mapX = 39
    mapY = 36
    note = "North pocket with ZumaArcher20 + ZumaStatue20 single spawns."
    recommended = $false
    section = "Crystal BDD 2F (D2004)"
  },
  [ordered]@{
    id = "stairs-lower"
    label = "2F stair landing (lower)"
    mapPath = $MapPath2F
    mapFile = "D2004.map"
    mapTitle = "BlackDragonDungeon_2F"
    mapX = 30
    mapY = 81
    note = "Warp-in from BlackDragonDungeon_1F (D2003) - lower stair tile."
    recommended = $false
    section = "Crystal BDD 2F (D2004)"
  },
  [ordered]@{
    id = "stairs-upper"
    label = "2F stair landing (upper)"
    mapPath = $MapPath2F
    mapFile = "D2004.map"
    mapTitle = "BlackDragonDungeon_2F"
    mapX = 30
    mapY = 92
    note = "Alternate stair landing from BDD 1F."
    recommended = $false
    section = "Crystal BDD 2F (D2004)"
  },
  [ordered]@{
    id = "south-exit"
    label = "2F south exit"
    mapPath = $MapPath2F
    mapFile = "D2004.map"
    mapTitle = "BlackDragonDungeon_2F"
    mapX = 84
    mapY = 86
    note = "Movement tile toward Purgatory Hall (D2005)."
    recommended = $false
    section = "Crystal BDD 2F (D2004)"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]
$sectionOrder = @("King Scorpion (D2006)", "Crystal BDD 2F (D2004)")
$cardsBySection = @{}
foreach ($section in $sectionOrder) { $cardsBySection[$section] = New-Object System.Collections.Generic.List[string] }

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  $previewFile = "spot-$($spot.id).png"
  $previewPath = Join-Path $previewDir $previewFile

  Write-Host "Building preview $($spot.id) on $($spot.mapFile) at ($($spot.mapX), $($spot.mapY))..."
  & $stampScript `
    -DataRoot $DataRoot `
    -MapPath $spot.mapPath `
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
    section = $spot.section
    mapFile = $spot.mapFile
    mapTitle = $spot.mapTitle
    mapPath = $spot.mapPath
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
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec
    '<span class="coords">' + $spot.mapFile + ' (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Crop ' + $CropWCells + 'x' + $CropHCells + ' cells on ' + $spot.mapTitle + '.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use bdd 2f spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-bdd-2f-stamp.ps1 -MapPath "' + $spot.mapPath + '" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells 36 -CropHCells 36</code></p>'
    '</article>'
  ) -join "`n"
  $cardsBySection[$spot.section].Add($cardHtml)
}

$manifest = [ordered]@{
  maps = @(
    [ordered]@{ file = "D2004.map"; title = "BlackDragonDungeon_2F"; role = "Crystal BDD second floor" },
    [ordered]@{ file = "D2006.map"; title = "WoomaPalace"; role = "King Scorpion boss room" }
  )
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  spots = @($built.ToArray())
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  (Join-Path $outRoot "spots.json"),
  ($manifest | ConvertTo-Json -Depth 6),
  $utf8NoBom
)

$sectionHtml = New-Object System.Collections.Generic.List[string]
foreach ($section in $sectionOrder) {
  if ($cardsBySection[$section].Count -le 0) { continue }
  $sectionHtml.Add('<section class="section"><h2>' + $section + '</h2><div class="grid">' + ($cardsBySection[$section] -join "`n") + '</div></section>')
}

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BDD 2F / King Scorpion — spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; }
    h2 { margin:0 0 14px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:980px; }
    .section { padding:20px 24px 8px; }
    .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; }
    .badge.rec { background:var(--rec); color:#dff3e4; font-size:11px; padding:2px 8px; border-radius:999px; }
    figure { margin:0; border:1px solid var(--line); border-radius:8px; overflow:auto; background:#050504; }
    figure img { display:block; max-width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; }
    figcaption { padding:8px 10px; font-size:12px; color:var(--muted); border-top:1px solid var(--line); }
    .note { margin:0; color:var(--muted); font-size:13px; }
    .pick { margin:0; color:var(--accent); }
    .cmd { margin:0; font-size:11px; color:var(--muted); word-break:break-all; }
    code { color:#d4bc86; }
  </style>
</head>
<body>
  <header>
    <h1>Black Dragon Dungeon — floor 2 / King Scorpion room</h1>
    <p class="meta">
      Pick where the party stands for <strong>zone-bdd-2</strong>. Each card centers on the map cell used for
      <code>arenaSpawnMap</code> / stamp focus. <strong>King Scorpion</strong> in Crystal lives on
      <code>D2006.map</code> (Wooma Palace) at (49, 51) - not on literal BDD 2F (<code>D2004.map</code>).
      Current game 1F uses <code>D2001.map</code> at (59, 98). Pick one:
      <code>use bdd 2f spot &lt;id&gt;</code> - e.g. <code>use bdd 2f spot king-scorpion</code>.
    </p>
  </header>
$($sectionHtml -join "`n")
</body>
</html>
"@

$htmlPath = Join-Path $outRoot "index.html"
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)

Write-Output "Wrote $($built.Count) spot previews to $outRoot"
