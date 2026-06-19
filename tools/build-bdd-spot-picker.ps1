param(
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2001.map",
  [string]$OutputRoot = "../tile-review/bdd-spot-picker",
  [int]$CropWCells = 32,
  [int]$CropHCells = 28,
  [int]$HalfCropW = 16,
  [int]$HalfCropH = 14
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }

# Crystal D2001 (BlackDragonDungeon) — official warp-in + mob respawn hubs from crystal-maps.json
$candidates = @(
  [ordered]@{
    id = "entry"
    label = "Castle warp-in"
    mapX = 57
    mapY = 66
    note = "Where Gi-Ryoong teleports you into the first cave (D2001 movements)."
    recommended = $false
  },
  [ordered]@{
    id = "hub-main"
    label = "Main chamber hub"
    mapX = 250
    mapY = 210
    note = 'Largest open room - dual mob lines + mini-boss spawns (265/267/266/268).'
    recommended = $true
  },
  [ordered]@{
    id = "north-mid"
    label = "North mid cave"
    mapX = 240
    mapY = 115
    note = 'Secondary respawn cluster (265/267, count 7).'
    recommended = $false
  },
  [ordered]@{
    id = "west-upper"
    label = "West upper"
    mapX = 146
    mapY = 74
    note = "Smaller north-west pocket."
    recommended = $false
  },
  [ordered]@{
    id = "north-west"
    label = "North-west corner"
    mapX = 107
    mapY = 68
    note = "Tight north-west pocket."
    recommended = $false
  },
  [ordered]@{
    id = "west-mid"
    label = "West mid"
    mapX = 110
    mapY = 186
    note = "West-side farming pocket."
    recommended = $false
  },
  [ordered]@{
    id = "center-west"
    label = "Center-west"
    mapX = 171
    mapY = 213
    note = "Between entry corridor and main hub."
    recommended = $false
  },
  [ordered]@{
    id = "upper-mid"
    label = "Upper mid"
    mapX = 205
    mapY = 187
    note = "Upper-west chamber."
    recommended = $false
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$built = New-Object System.Collections.Generic.List[object]
$cards = New-Object System.Collections.Generic.List[string]

foreach ($spot in $candidates) {
  $cropX = [Math]::Max(0, $spot.mapX - $HalfCropW)
  $cropY = [Math]::Max(0, $spot.mapY - $HalfCropH)
  $previewFile = "spot-$($spot.id).png"
  $previewPath = Join-Path $previewDir $previewFile

  Write-Host "Building preview $($spot.id) at map ($($spot.mapX), $($spot.mapY))..."
  & $stampScript `
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
    '<span class="coords">map (' + $spot.mapX + ', ' + $spot.mapY + ')</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use bdd spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-bdd-1f-stamp.ps1 -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells 36 -CropHCells 36</code></p>'
    '</article>'
  ) -join "`n"
  $cards.Add($cardHtml)
}

$manifest = [ordered]@{
  map = "D2001.map"
  mapTitle = "BlackDragonDungeon"
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

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BDD D2001 — player stand spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; }
    .meta { color:var(--muted); max-width:920px; }
    main { padding:20px 24px 40px; display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { padding:0; border:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
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
    <h1>Black Dragon Dungeon — first cave player spot</h1>
    <p class="meta">
      Crystal <code>D2001.map</code> (BlackDragonDungeon). Each card is a candidate stand position for the group dungeon party.
      The preview centers on the map cell where characters would stand (<code>arenaSpawnMap</code> / stamp focus).
      Pick one: <code>use bdd spot &lt;id&gt;</code> — e.g. <code>use bdd spot hub-main</code>.
    </p>
  </header>
  <main>
$($cards -join "`n")
  </main>
</body>
</html>
"@

$htmlPath = Join-Path $outRoot "index.html"
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)

Write-Output "Wrote $($built.Count) spot previews to $outRoot"
