param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string]$OutputRoot = "../tile-review/bdd-remaining-overviews"
)

$ErrorActionPreference = "Stop"

$overviewScript = Join-Path $PSScriptRoot "build-bdd-overview.ps1"
if (-not (Test-Path $overviewScript)) { throw "Missing $overviewScript" }

function Get-MapPath([string]$FileName) {
  return Join-Path $MapRoot $FileName
}

$floors = @(
  [ordered]@{
    id = "d2009"
    floor = 9
    mapFile = "D2009.map"
    mapTitle = "SoleSpiritHall"
    mapLabel = "Sole Spirit Hall (BDD 9F)"
    imagePrefix = "d2009-overview"
    pickCommand = "use bdd sole-spirit spot X, Y"
    bullets = @(
      "Side branch from HwanMaJin (D2007) or link from D2010 - three standard wave pockets at (33,33), (49,51), (69,71)"
      "Crystal skip warp at (19, 20) jumps straight to D2011 Zuma Palace"
    )
    legend = @(
      @{ color = "#f39c12"; label = "Farming pockets (33,33 / 49,51 / 69,71)" }
      @{ color = "#2ecc71"; label = "Entry from D2007 or D2010" }
      @{ color = "#9b59b6"; label = "Skip exit to Zuma Palace" }
    )
    markers = @(
      @{ x = 69; y = 71; className = "hub"; title = "East pocket - WhiteBoar20, ZumaArcher20, BugBatMaggot" }
      @{ x = 49; y = 51; className = "hub"; title = "Center pocket - ZumaGuardian20/21, ZumaStatue20" }
      @{ x = 33; y = 33; className = "hub"; title = "North pocket - ZumaStatue20, WedgeMoth, ZumaStatue21" }
      @{ x = 83; y = 83; className = "entry"; title = "Entry from HwanMaJin D2007 (20, 86)" }
      @{ x = 83; y = 84; className = "entry"; title = "Entry from D2010 link (60, 150)" }
      @{ x = 19; y = 20; className = "exit"; title = "Skip warp to D2011 Zuma Palace" }
    )
  },
  [ordered]@{
    id = "d2010"
    floor = 10
    mapFile = "D2010.map"
    mapTitle = "HwanMaJin"
    mapLabel = "HwanMaJin II (BDD 10F)"
    imagePrefix = "d2010-overview"
    pickCommand = "use bdd hmj2 spot X, Y"
    bullets = @(
      "200x200 map - main forward route from Noble Hog north exit (26, 23) on D2008, landing near (84, 87)"
      "Two mega-clusters at (50, 50) west and (150, 150) east; forward exit to Prison Hall at (218, 42)"
    )
    legend = @(
      @{ color = "#f39c12"; label = "West hub (50, 50)" }
      @{ color = "#e74c3c"; label = "East hub + boss spawns (150, 150)" }
      @{ color = "#2ecc71"; label = "Entry from Noble Hog D2008" }
      @{ color = "#9b59b6"; label = "Exit to Prison Hall / link to Sole Spirit" }
    )
    markers = @(
      @{ x = 150; y = 150; className = "boss"; title = "East mega-cluster - WhiteBoar21, ZumaGuardian21, dense mob lines" }
      @{ x = 50; y = 50; className = "hub"; title = "West cluster - WhiteBoar20, ZumaArcher20, ZumaArcher21" }
      @{ x = 84; y = 87; className = "entry"; title = "Entry from Noble Hog D2008 (26, 23)" }
      @{ x = 30; y = 31; className = "spawn"; title = "North internal pocket (67, 53 warp target)" }
      @{ x = 218; y = 42; className = "exit"; title = "Exit forward to Prison Hall D2012" }
      @{ x = 60; y = 150; className = "exit"; title = "Side link to Sole Spirit Hall D2009" }
    )
  },
  [ordered]@{
    id = "d2011"
    floor = 11
    mapFile = "D2011.map"
    mapTitle = "ZumaPalace"
    mapLabel = "Zuma Palace (BDD 11F)"
    imagePrefix = "d2011-overview"
    pickCommand = "use bdd zuma-palace spot X, Y"
    bullets = @(
      "Incarnated ZT boss spawn at center pocket (49, 51) - boss-swarm candidate like Wooma Palace South"
      "Crystal skip at (19, 20) jumps to Dark Devil Palace D2013"
    )
    legend = @(
      @{ color = "#e74c3c"; label = "Incarnated ZT boss pocket (49, 51)" }
      @{ color = "#f39c12"; label = "East / north farming pockets" }
      @{ color = "#9b59b6"; label = "Skip exit to Dark Devil Palace" }
    )
    markers = @(
      @{ x = 49; y = 51; className = "boss"; title = "Center boss pocket - IncarnatedZT + Zuma lines" }
      @{ x = 69; y = 71; className = "hub"; title = "East pocket - ZumaStatue20, ZumaArcher20" }
      @{ x = 33; y = 33; className = "hub"; title = "North pocket - ZumaArcher20/21" }
      @{ x = 19; y = 20; className = "exit"; title = "Skip warp to Dark Devil Palace D2013" }
    )
  },
  [ordered]@{
    id = "d2012"
    floor = 12
    mapFile = "D2012.map"
    mapTitle = "PrisonHall"
    mapLabel = "Prison Hall (BDD 12F)"
    imagePrefix = "d2012-overview"
    pickCommand = "use bdd prison-hall spot X, Y"
    bullets = @(
      "Connector map from D2010 (218, 42) - three wave pockets same layout as Sole Spirit Hall"
      "Side exit at (18, 21) goes to bonguk1 in Crystal (probably unused for idle)"
    )
    legend = @(
      @{ color = "#f39c12"; label = "Wave pockets (33,33 / 49,51 / 69,71)" }
      @{ color = "#2ecc71"; label = "Entry from D2010" }
      @{ color = "#9b59b6"; label = "Side town exit" }
    )
    markers = @(
      @{ x = 69; y = 71; className = "hub"; title = "East pocket - ZumaStatue20, ZumaArcher20, BugBatMaggot" }
      @{ x = 49; y = 51; className = "hub"; title = "Center pocket - ZumaGuardian20/21, ZumaStatue20/21" }
      @{ x = 33; y = 33; className = "hub"; title = "North pocket - ZumaStatue20, WedgeMoth" }
      @{ x = 86; y = 90; className = "entry"; title = "Entry from D2010 (218, 42)" }
      @{ x = 18; y = 21; className = "exit"; title = "Side exit to bonguk1" }
    )
  },
  [ordered]@{
    id = "d2013"
    floor = 13
    mapFile = "D2013.map"
    mapTitle = "DarkDevilPalace"
    mapLabel = "Dark Devil Palace (BDD 13F)"
    imagePrefix = "d2013-overview"
    pickCommand = "use bdd dark-devil spot X, Y"
    bullets = @(
      "Final BDD boss - DarkDevil spawn at center pocket (49, 51)"
      "Reachable via D2011 skip warp or linear progression through Prison Hall"
    )
    legend = @(
      @{ color = "#e74c3c"; label = "Dark Devil boss (49, 51)" }
      @{ color = "#f39c12"; label = "East / north pockets" }
      @{ color = "#2ecc71"; label = "Entry from Zuma Palace skip" }
    )
    markers = @(
      @{ x = 49; y = 51; className = "boss"; title = "Dark Devil boss room - DarkDevil x1" }
      @{ x = 69; y = 71; className = "hub"; title = "East pocket - ZumaArcher20, ZumaGuardian20/21" }
      @{ x = 33; y = 33; className = "hub"; title = "North pocket - ZumaArcher20/Statue20/21" }
      @{ x = 83; y = 85; className = "entry"; title = "Entry from Zuma Palace skip (19, 20)" }
    )
  }
)

$hubRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $hubRoot | Out-Null

$built = New-Object System.Collections.Generic.List[object]

foreach ($floor in $floors) {
  $mapPath = Get-MapPath $floor.mapFile
  if (-not (Test-Path $mapPath)) {
    throw "Missing Crystal map: $mapPath"
  }

  $outDir = Join-Path $hubRoot $floor.id
  Write-Host "Building overview $($floor.mapLabel) -> $outDir"

  $resultJson = & $overviewScript `
    -DataRoot $DataRoot `
    -MapPath $mapPath `
    -OutputRoot (Join-Path $OutputRoot $floor.id) `
    -MapTitle $floor.mapTitle `
    -MapLabel $floor.mapLabel `
    -ImagePrefix $floor.imagePrefix `
    -PickCommand $floor.pickCommand `
    -HubLink "../index.html" `
    -Bullets $floor.bullets `
    -Legend $floor.legend `
    -Markers $floor.markers

  $result = $resultJson | ConvertFrom-Json
  $built.Add([ordered]@{
    id = $floor.id
    floor = $floor.floor
    mapFile = $floor.mapFile
    mapLabel = $floor.mapLabel
    pickCommand = $floor.pickCommand
    href = "$($floor.id)/index.html"
    preview = "$($floor.id)/$($floor.imagePrefix).png"
    scaledWidth = $result.scaledWidth
    scaledHeight = $result.scaledHeight
    mapWidth = $result.mapWidth
    mapHeight = $result.mapHeight
  })
}

$floorCards = ($built | ForEach-Object {
  $f = $_
  @"
    <article class="floor-card">
      <a href="$($f.href)">
        <img src="$($f.preview)" alt="$($f.mapLabel)" loading="lazy" />
        <div class="floor-body">
          <h2>Floor $($f.floor) - $($f.mapLabel)</h2>
          <p class="file"><code>$($f.mapFile)</code> &middot; $($f.mapWidth) x $($f.mapHeight) cells</p>
          <p class="hint">Click the map to open full-floor picker. Hover for coords, click to copy.</p>
          <p class="cmd"><code>$($f.pickCommand)</code></p>
        </div>
      </a>
    </article>
"@
}) -join "`n"

$hubHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BDD floors 9-13 - location pickers</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 14px/1.45 Segoe UI, sans-serif; background: #12151c; color: #e8dcc0; }
    main { max-width: 1200px; margin: 0 auto; padding: 24px 20px 40px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .intro { color: #b9aa88; max-width: 900px; margin-bottom: 24px; }
    .intro ul { margin: 10px 0 0; padding-left: 20px; }
    .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .floor-card { background: #171411; border: 1px solid #2a241c; border-radius: 10px; overflow: hidden; }
    .floor-card a { color: inherit; text-decoration: none; display: block; }
    .floor-card img { width: 100%; height: auto; display: block; image-rendering: pixelated; background: #0d1016; border-bottom: 1px solid #2a241c; }
    .floor-body { padding: 14px 16px 16px; }
    .floor-body h2 { margin: 0 0 6px; font-size: 16px; color: #c9a24d; }
    .file { margin: 0 0 8px; font-size: 12px; color: #9a8b74; font-family: Consolas, monospace; }
    .hint { margin: 0 0 8px; color: #b9aa88; font-size: 13px; }
    .cmd { margin: 0; font-size: 12px; color: #d4bc86; }
    code { color: #d4bc86; }
  </style>
</head>
<body>
  <main>
    <h1>Black Dragon Dungeon - remaining floors (9-13)</h1>
    <p class="intro">
      Full clickable floor maps for every BDD section not yet in the game. Open a floor, hover for coordinates,
      click anywhere to copy <code>X, Y</code> for the party stand / stamp focus.
      <ul>
        <li>Floors 1-8 are already implemented (King Hog is the current end).</li>
        <li>After King Hog, Crystal north exit on D2008 goes to <strong>D2010</strong>, not D2009.</li>
        <li>D2009 is a side branch; Crystal also has skip warps (D2009 to D2011, D2011 to D2013).</li>
      </ul>
    </p>
    <div class="grid">
$floorCards
    </div>
  </main>
</body>
</html>
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $hubRoot "index.html"), $hubHtml, $utf8NoBom)

[ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  hub = (Join-Path $hubRoot "index.html")
  floors = @($built.ToArray())
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $hubRoot "manifest.json") -Encoding UTF8

Write-Output "Built $($built.Count) floor overviews + hub at $hubRoot"
Write-Output "Open: $(Join-Path $hubRoot 'index.html')"
