param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string]$OutputRoot = "../tile-review/bdd-remaining-spot-picker",
  [int]$CropWCells = 32,
  [int]$CropHCells = 28,
  [int]$HalfCropW = 16,
  [int]$HalfCropH = 14
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }

function Get-MapPath([string]$FileName) {
  return Join-Path $MapRoot $FileName
}

# Crystal maps D2009-D2013 - respawn hubs, boss pockets, and warp landing tiles.
$candidates = @(
  # --- Floor 9: Sole Spirit Hall (D2009) ---
  [ordered]@{
    id = "sole-east"
    label = "East pocket"
    floor = 9
    zoneHint = "zone-bdd-9"
    mapPath = (Get-MapPath "D2009.map")
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapX = 69
    mapY = 71
    note = "Largest farming pocket - WhiteBoar20, ZumaArcher20, BugBatMaggot lines + ZumaArcher21. Same layout as Wooma/Noble Hog east rooms."
    recommended = $true
    section = "9F - Sole Spirit Hall (D2009)"
    role = "wave"
  },
  [ordered]@{
    id = "sole-center"
    label = "Center pocket"
    floor = 9
    zoneHint = "zone-bdd-9"
    mapPath = (Get-MapPath "D2009.map")
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapX = 49
    mapY = 51
    note = "Mid map cluster - ZumaGuardian20/21 and ZumaStatue20 lines."
    recommended = $true
    section = "9F - Sole Spirit Hall (D2009)"
    role = "wave"
  },
  [ordered]@{
    id = "sole-north"
    label = "North pocket"
    floor = 9
    zoneHint = "zone-bdd-9"
    mapPath = (Get-MapPath "D2009.map")
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapX = 33
    mapY = 33
    note = "North chamber - ZumaStatue20, WedgeMoth, ZumaStatue21."
    recommended = $false
    section = "9F - Sole Spirit Hall (D2009)"
    role = "wave"
  },
  [ordered]@{
    id = "sole-entry-hwanmajin"
    label = "Entry from HwanMaJin"
    floor = 9
    zoneHint = "zone-bdd-9"
    mapPath = (Get-MapPath "D2009.map")
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapX = 83
    mapY = 83
    note = "Crystal warp landing from D2007 exit (20, 86) - side branch into Sole Spirit Hall."
    recommended = $false
    section = "9F - Sole Spirit Hall (D2009)"
    role = "entry"
  },
  [ordered]@{
    id = "sole-entry-d2010"
    label = "Entry from D2010 link"
    floor = 9
    zoneHint = "zone-bdd-9"
    mapPath = (Get-MapPath "D2009.map")
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapX = 83
    mapY = 84
    note = "Alternate entry from D2010 HwanMaJin (60, 150) warp."
    recommended = $false
    section = "9F - Sole Spirit Hall (D2009)"
    role = "entry"
  },
  [ordered]@{
    id = "sole-exit-zuma"
    label = "Exit toward Zuma Palace"
    floor = 9
    zoneHint = "zone-bdd-9"
    mapPath = (Get-MapPath "D2009.map")
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapX = 19
    mapY = 20
    note = "Crystal skip-ahead warp tile - jumps straight to D2011 Zuma Palace (287, 280). Use if you want a shortcut floor link."
    recommended = $false
    section = "9F - Sole Spirit Hall (D2009)"
    role = "exit"
  },

  # --- Floor 10: HwanMaJin section 2 (D2010) ---
  [ordered]@{
    id = "hmj2-east"
    label = "East mega-cluster"
    floor = 10
    zoneHint = "zone-bdd-10"
    mapPath = (Get-MapPath "D2010.map")
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapX = 150
    mapY = 150
    note = "Primary respawn hub on D2010 - dense WhiteBoar/Zuma/Statue/Guardian/WedgeMoth lines plus WhiteBoar21 and ZumaGuardian21 boss spawns."
    recommended = $true
    section = "10F - HwanMaJin II (D2010)"
    role = "wave"
  },
  [ordered]@{
    id = "hmj2-west"
    label = "West cluster"
    floor = 10
    zoneHint = "zone-bdd-10"
    mapPath = (Get-MapPath "D2010.map")
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapX = 50
    mapY = 50
    note = "West respawn pocket - WhiteBoar20 and ZumaArcher20 heavy lines + ZumaArcher21."
    recommended = $true
    section = "10F - HwanMaJin II (D2010)"
    role = "wave"
  },
  [ordered]@{
    id = "hmj2-entry-noble-hog"
    label = "Entry from Noble Hog"
    floor = 10
    zoneHint = "zone-bdd-10"
    mapPath = (Get-MapPath "D2010.map")
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapX = 84
    mapY = 87
    note = "Warp landing from D2008 north exit (26, 23) after King Hog area - main forward route from floor 8."
    recommended = $false
    section = "10F - HwanMaJin II (D2010)"
    role = "entry"
  },
  [ordered]@{
    id = "hmj2-hub-north"
    label = "North hub pocket"
    floor = 10
    zoneHint = "zone-bdd-10"
    mapPath = (Get-MapPath "D2010.map")
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapX = 30
    mapY = 31
    note = "Internal north pocket (67, 53) warp target - smaller stand area on the 200x200 map."
    recommended = $false
    section = "10F - HwanMaJin II (D2010)"
    role = "wave"
  },
  [ordered]@{
    id = "hmj2-exit-prison"
    label = "Exit toward Prison Hall"
    floor = 10
    zoneHint = "zone-bdd-10"
    mapPath = (Get-MapPath "D2010.map")
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapX = 218
    mapY = 42
    note = "Crystal forward warp to D2012 Prison Hall (86, 90)."
    recommended = $false
    section = "10F - HwanMaJin II (D2010)"
    role = "exit"
  },
  [ordered]@{
    id = "hmj2-link-sole"
    label = "Link back to Sole Spirit"
    floor = 10
    zoneHint = "zone-bdd-10"
    mapPath = (Get-MapPath "D2010.map")
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapX = 60
    mapY = 150
    note = "Side link warp to D2009 Sole Spirit Hall (83, 84)."
    recommended = $false
    section = "10F - HwanMaJin II (D2010)"
    role = "exit"
  },

  # --- Floor 11: Zuma Palace (D2011) ---
  [ordered]@{
    id = "zuma-boss"
    label = "Center boss pocket"
    floor = 11
    zoneHint = "zone-bdd-11"
    mapPath = (Get-MapPath "D2011.map")
    mapFile = "D2011.map"
    mapTitle = "ZumaPalace"
    mapX = 49
    mapY = 51
    note = "Incarnated ZT spawn (x1) with ZumaArcher20/Statue20/Guardian20 lines - boss-swarm candidate like Wooma Palace South."
    recommended = $true
    section = "11F - Zuma Palace (D2011)"
    role = "boss"
  },
  [ordered]@{
    id = "zuma-east"
    label = "East pocket"
    floor = 11
    zoneHint = "zone-bdd-11"
    mapPath = (Get-MapPath "D2011.map")
    mapFile = "D2011.map"
    mapTitle = "ZumaPalace"
    mapX = 69
    mapY = 71
    note = "East farming pocket - ZumaStatue20 and ZumaArcher20 lines."
    recommended = $false
    section = "11F - Zuma Palace (D2011)"
    role = "wave"
  },
  [ordered]@{
    id = "zuma-north"
    label = "North pocket"
    floor = 11
    zoneHint = "zone-bdd-11"
    mapPath = (Get-MapPath "D2011.map")
    mapFile = "D2011.map"
    mapTitle = "ZumaPalace"
    mapX = 33
    mapY = 33
    note = "North pocket - ZumaArcher20 lines + ZumaArcher21."
    recommended = $false
    section = "11F - Zuma Palace (D2011)"
    role = "wave"
  },
  [ordered]@{
    id = "zuma-exit-dark-devil"
    label = "Exit toward Dark Devil Palace"
    floor = 11
    zoneHint = "zone-bdd-11"
    mapPath = (Get-MapPath "D2011.map")
    mapFile = "D2011.map"
    mapTitle = "ZumaPalace"
    mapX = 19
    mapY = 20
    note = "Crystal skip-ahead warp - jumps to D2013 Dark Devil Palace (83, 85), bypassing Prison Hall."
    recommended = $false
    section = "11F - Zuma Palace (D2011)"
    role = "exit"
  },

  # --- Floor 12: Prison Hall (D2012) ---
  [ordered]@{
    id = "prison-east"
    label = "East pocket"
    floor = 12
    zoneHint = "zone-bdd-12"
    mapPath = (Get-MapPath "D2012.map")
    mapFile = "D2012.map"
    mapTitle = "PrisonHall"
    mapX = 69
    mapY = 71
    note = "East wave pocket - ZumaStatue20, ZumaArcher20, BugBatMaggot + ZumaArcher21."
    recommended = $true
    section = "12F - Prison Hall (D2012)"
    role = "wave"
  },
  [ordered]@{
    id = "prison-center"
    label = "Center pocket"
    floor = 12
    zoneHint = "zone-bdd-12"
    mapPath = (Get-MapPath "D2012.map")
    mapFile = "D2012.map"
    mapTitle = "PrisonHall"
    mapX = 49
    mapY = 51
    note = "Center cluster - ZumaGuardian20/21 and ZumaStatue20/21."
    recommended = $true
    section = "12F - Prison Hall (D2012)"
    role = "wave"
  },
  [ordered]@{
    id = "prison-north"
    label = "North pocket"
    floor = 12
    zoneHint = "zone-bdd-12"
    mapPath = (Get-MapPath "D2012.map")
    mapFile = "D2012.map"
    mapTitle = "PrisonHall"
    mapX = 33
    mapY = 33
    note = "North pocket - ZumaStatue20 and WedgeMoth."
    recommended = $false
    section = "12F - Prison Hall (D2012)"
    role = "wave"
  },
  [ordered]@{
    id = "prison-entry"
    label = "Entry from D2010"
    floor = 12
    zoneHint = "zone-bdd-12"
    mapPath = (Get-MapPath "D2012.map")
    mapFile = "D2012.map"
    mapTitle = "PrisonHall"
    mapX = 86
    mapY = 90
    note = "Warp landing from D2010 exit (218, 42)."
    recommended = $false
    section = "12F - Prison Hall (D2012)"
    role = "entry"
  },
  [ordered]@{
    id = "prison-exit-town"
    label = "Side exit (town link)"
    floor = 12
    zoneHint = "zone-bdd-12"
    mapPath = (Get-MapPath "D2012.map")
    mapFile = "D2012.map"
    mapTitle = "PrisonHall"
    mapX = 18
    mapY = 21
    note = "Crystal side exit to bonguk1 - probably not used for idle progression."
    recommended = $false
    section = "12F - Prison Hall (D2012)"
    role = "exit"
  },

  # --- Floor 13: Dark Devil Palace (D2013) ---
  [ordered]@{
    id = "dark-devil-boss"
    label = "Dark Devil boss room"
    floor = 13
    zoneHint = "zone-bdd-13"
    mapPath = (Get-MapPath "D2013.map")
    mapFile = "D2013.map"
    mapTitle = "DarkDevilPalace"
    mapX = 49
    mapY = 51
    note = "Final BDD boss - DarkDevil spawn (x1) with ZumaArcher20/Statue20 support lines."
    recommended = $true
    section = "13F - Dark Devil Palace (D2013)"
    role = "boss"
  },
  [ordered]@{
    id = "dark-devil-east"
    label = "East pocket"
    floor = 13
    zoneHint = "zone-bdd-13"
    mapPath = (Get-MapPath "D2013.map")
    mapFile = "D2013.map"
    mapTitle = "DarkDevilPalace"
    mapX = 69
    mapY = 71
    note = "East pocket - ZumaArcher20 and ZumaGuardian20/21 lines (pre-boss farming)."
    recommended = $false
    section = "13F - Dark Devil Palace (D2013)"
    role = "wave"
  },
  [ordered]@{
    id = "dark-devil-north"
    label = "North pocket"
    floor = 13
    zoneHint = "zone-bdd-13"
    mapPath = (Get-MapPath "D2013.map")
    mapFile = "D2013.map"
    mapTitle = "DarkDevilPalace"
    mapX = 33
    mapY = 33
    note = "North pocket - ZumaArcher20/Statue20 + ZumaArcher21."
    recommended = $false
    section = "13F - Dark Devil Palace (D2013)"
    role = "wave"
  },
  [ordered]@{
    id = "dark-devil-entry"
    label = "Entry from Zuma Palace skip"
    floor = 13
    zoneHint = "zone-bdd-13"
    mapPath = (Get-MapPath "D2013.map")
    mapFile = "D2013.map"
    mapTitle = "DarkDevilPalace"
    mapX = 83
    mapY = 85
    note = "Warp landing from D2011 skip tile (19, 20)."
    recommended = $false
    section = "13F - Dark Devil Palace (D2013)"
    role = "entry"
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$previewDir = Join-Path $outRoot "previews"
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$built = New-Object System.Collections.Generic.List[object]
$sectionOrder = @(
  "9F - Sole Spirit Hall (D2009)",
  "10F - HwanMaJin II (D2010)",
  "11F - Zuma Palace (D2011)",
  "12F - Prison Hall (D2012)",
  "13F - Dark Devil Palace (D2013)"
)
$cardsBySection = @{}
foreach ($section in $sectionOrder) { $cardsBySection[$section] = New-Object System.Collections.Generic.List[string] }

foreach ($spot in $candidates) {
  if (-not (Test-Path $spot.mapPath)) {
    throw "Missing Crystal map file: $($spot.mapPath)"
  }

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
    floor = $spot.floor
    zoneHint = $spot.zoneHint
    section = $spot.section
    role = $spot.role
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
  $roleBadge = switch ($spot.role) {
    "boss" { '<span class="badge boss">Boss</span>' }
    "wave" { '<span class="badge wave">Wave</span>' }
    "entry" { '<span class="badge entry">Entry</span>' }
    "exit" { '<span class="badge exit">Exit</span>' }
    default { "" }
  }
  $stampName = "bdd-$($spot.id)-center"
  $cardHtml = @(
    '<article class="card" id="spot-' + $spot.id + '">'
    '<header><strong>' + $spot.label + '</strong> ' + $rec + ' ' + $roleBadge
    '<span class="coords">' + $spot.mapFile + ' (' + $spot.mapX + ', ' + $spot.mapY + ') · ' + $spot.zoneHint + '</span></header>'
    '<figure><img src="previews/' + $previewFile + '" alt="' + $spot.label + '" loading="lazy" />'
    '<figcaption>Center = party stand. Preview crop ' + $CropWCells + 'x' + $CropHCells + ' cells.</figcaption></figure>'
    '<p class="note">' + $spot.note + '</p>'
    '<p class="pick">Reply: <code>use bdd remaining spot ' + $spot.id + '</code></p>'
    '<p class="cmd"><code>powershell -File tools/build-bdd-1f-stamp.ps1 -MapPath "' + $spot.mapPath + '" -StampId "' + $stampName + '" -FocusMapX ' + $spot.mapX + ' -FocusMapY ' + $spot.mapY + ' -CropX ' + $cropX + ' -CropY ' + $cropY + ' -CropWCells 36 -CropHCells 36</code></p>'
    '</article>'
  ) -join "`n"
  $cardsBySection[$spot.section].Add($cardHtml)
}

$manifest = [ordered]@{
  title = "BDD remaining floors - spot picker"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  maps = @(
    [ordered]@{ file = "D2009.map"; title = "SoleSpiritHall"; floor = 9; zoneHint = "zone-bdd-9" },
    [ordered]@{ file = "D2010.map"; title = "HwanMaJin"; floor = 10; zoneHint = "zone-bdd-10" },
    [ordered]@{ file = "D2011.map"; title = "ZumaPalace"; floor = 11; zoneHint = "zone-bdd-11" },
    [ordered]@{ file = "D2012.map"; title = "PrisonHall"; floor = 12; zoneHint = "zone-bdd-12" },
    [ordered]@{ file = "D2013.map"; title = "DarkDevilPalace"; floor = 13; zoneHint = "zone-bdd-13" }
  )
  progressionNotes = @(
    "After King Hog (D2008), Crystal north exit (26, 23) goes to D2010 - not D2009.",
    "D2009 is reachable from D2007 side exit or D2010 link (60, 150).",
    "Crystal has skip warps: D2009 (19, 20) -> D2011, and D2011 (19, 20) -> D2013.",
    "Idle game will likely use linear floors 9-13; pick one stand per floor."
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
  <title>BDD floors 9-13 - spot picker</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c; --rec:#3d6b4a; --boss:#7a2e2e; --wave:#2e4a6b; --entry:#2e6b4a; --exit:#5a3d7a; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px 12px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:1.35rem; }
    h2 { margin:0 0 14px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); max-width:1080px; }
    .meta ul { margin:8px 0 0; padding-left:20px; }
    .section { padding:20px 24px 8px; }
    .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:10px; }
    .card header { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }
    .coords { color:var(--muted); font-size:12px; font-family:Consolas,monospace; flex-basis:100%; }
    .badge { font-size:11px; padding:2px 8px; border-radius:999px; }
    .badge.rec { background:var(--rec); color:#dff3e4; }
    .badge.boss { background:var(--boss); color:#f5dcdc; }
    .badge.wave { background:var(--wave); color:#dce8f5; }
    .badge.entry { background:var(--entry); color:#dcf5e8; }
    .badge.exit { background:var(--exit); color:#eadcf5; }
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
    <h1>Black Dragon Dungeon - remaining floors (9-13)</h1>
    <p class="meta">
      Pick party stand locations for the five BDD sections not yet in the game. Each card centers on the map cell
      for <code>arenaSpawnMap</code> / stamp focus. Floors 1-8 are done; King Hog is the current end.
      <strong>Suggested picks per floor:</strong>
      <ul>
        <li><strong>9F Sole Spirit Hall</strong> - <code>sole-east</code> or <code>sole-center</code> (waves)</li>
        <li><strong>10F HwanMaJin II</strong> - <code>hmj2-east</code> or <code>hmj2-west</code> (waves)</li>
        <li><strong>11F Zuma Palace</strong> - <code>zuma-boss</code> (Incarnated ZT boss swarm)</li>
        <li><strong>12F Prison Hall</strong> - <code>prison-east</code> or <code>prison-center</code> (waves)</li>
        <li><strong>13F Dark Devil Palace</strong> - <code>dark-devil-boss</code> (final boss)</li>
      </ul>
      Crystal warp chain differs (skip tiles exist). Reply with e.g. <code>use bdd remaining spot dark-devil-boss</code>.
    </p>
  </header>
$($sectionHtml -join "`n")
</body>
</html>
"@

$htmlPath = Join-Path $outRoot "index.html"
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)

Write-Output "Wrote $($built.Count) spot previews to $outRoot"
Write-Output "Open: $htmlPath"
