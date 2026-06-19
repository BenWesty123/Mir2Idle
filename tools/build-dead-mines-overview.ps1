param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string]$OutputRoot = "../tile-review/dead-mines-overview",
  [double]$OverviewScale = 0.25,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalOverviewLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalOverviewLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public CrystalOverviewLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalOverviewImage ReadImage(int index)
    {
        if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
        stream.Position = offsets[index];
        short w = reader.ReadInt16();
        short h = reader.ReadInt16();
        reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16();
        byte shadow = reader.ReadByte();
        int len = reader.ReadInt32();
        bool hasMask = (shadow >> 7) == 1;
        if (w <= 0 || h <= 0 || len <= 0) return null;
        byte[] compressed = reader.ReadBytes(len);
        if (hasMask)
        {
            reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16();
            reader.ReadBytes(reader.ReadInt32());
        }
        byte[] raw;
        using (var input = new MemoryStream(compressed))
        using (var gzip = new GZipStream(input, CompressionMode.Decompress))
        using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); }
        if (raw.Length < w * h * 4) return null;
        Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); }
        finally { bitmap.UnlockBits(data); }
        return new CrystalOverviewImage(bitmap);
    }

    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}

public sealed class CrystalOverviewImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalOverviewImage(Bitmap bitmap) { Bitmap = bitmap; }
    public void Dispose() { Bitmap.Dispose(); }
}
"@
}

function Get-MapLibRelativePath([int]$slot) {
  if ($slot -eq 0) { return "Map/WemadeMir2/Tiles.Lib" }
  if ($slot -eq 1) { return "Map/WemadeMir2/SmTiles.Lib" }
  if ($slot -eq 2) { return "Map/WemadeMir2/Objects.Lib" }
  if ($slot -ge 3 -and $slot -le 28) { return "Map/WemadeMir2/Objects$($slot - 1).Lib" }
  if ($slot -eq 90) { return "Map/WemadeMir2/Objects_32bit.Lib" }
  return $null
}

function Read-Type1Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $xor = [BitConverter]::ToInt16($bytes, 23)
  $width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
  $count = $width * $height
  $back = [long[]]::new($count)
  $middle = [int[]]::new($count)
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)
  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $middle[$i] = [BitConverter]::ToInt16($bytes, $offset + 4) -bxor $xor
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
      $slot = [int]$bytes[$offset + 12] + 2
      if ($slot -eq 102) { $slot = 90 }
      if ($slot -ge 255) { $slot = -1 }
      $frontIndex[$i] = $slot
      $offset += 15
    }
  }
  return @{
    Width = $width
    Height = $height
    Back = $back
    Middle = $middle
    Front = $front
    FrontIndex = $frontIndex
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

function Get-VisibleBackFrame([int]$backFrame) {
  if ($backFrame -ge 1950 -and $backFrame -le 1999) { return $backFrame + 1101 }
  if ($backFrame -ge 3051 -and $backFrame -le 3055) { return $backFrame }
  return $backFrame
}

$loadedLibs = @{}
$loadedImages = @{}

function Get-MapLib([int]$slot) {
  $key = [string]$slot
  if ($loadedLibs.ContainsKey($key)) { return $loadedLibs[$key] }
  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) { $loadedLibs[$key] = $null; return $null }
  $path = Join-Path (Resolve-Path $DataRoot) $relative
  if (-not (Test-Path $path)) { $loadedLibs[$key] = $null; return $null }
  $lib = [CrystalOverviewLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$index) {
  if ($index -lt 0) { return $null }
  $key = "$slot`:$index"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }
  $lib = Get-MapLib $slot
  if ($null -eq $lib) { $loadedImages[$key] = $null; return $null }
  $image = $lib.ReadImage($index)
  $loadedImages[$key] = $image
  return $image
}

function Render-DeadMineOverview {
  param(
    [string]$MapPath,
    [int]$CropX = 0,
    [int]$CropY = 0,
    [int]$CropWCells,
    [int]$CropHCells
  )

  $map = Read-Type1Map $MapPath
  if (-not $CropWCells) { $CropWCells = $map.Width }
  if (-not $CropHCells) { $CropHCells = $map.Height }
  $CropX = [Math]::Max(0, [Math]::Min($CropX, $map.Width - 1))
  $CropY = [Math]::Max(0, [Math]::Min($CropY, $map.Height - 1))
  $CropWCells = [Math]::Min($CropWCells, $map.Width - $CropX)
  $CropHCells = [Math]::Min($CropHCells, $map.Height - $CropY)

  $fullW = $CropWCells * $CellWidth
  $fullH = $CropHCells * $CellHeight
  $canvas = [System.Drawing.Bitmap]::new($fullW, $fullH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 18, 16, 14))
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor

    function Draw-CellImage($image, [int]$drawX, [int]$drawY, [bool]$floorSized) {
      if ($null -eq $image) { return }
      $y = if ($floorSized) { $drawY } else { $drawY + $CellHeight - $image.Bitmap.Height }
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $y)
    }

    for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
      for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
        if (($x -band 1) -ne 0 -or ($y -band 1) -ne 0) { continue }
        $cell = Get-CellOffset $map $x $y
        $backImage = $map.Back[$cell]
        if ($backImage -eq 0) { continue }
        $backFrame = Get-VisibleBackFrame (($backImage -band 0x1FFFFFFF) - 1)
        if ($backFrame -lt 0) { continue }
        Draw-CellImage (Get-MapImage 0 $backFrame) (($x - $CropX) * $CellWidth) (($y - $CropY) * $CellHeight) $true
      }
    }

    for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
      for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
        $cell = Get-CellOffset $map $x $y
        $middleFrame = $map.Middle[$cell] - 1
        if ($middleFrame -lt 0) { continue }
        $image = Get-MapImage 1 $middleFrame
        if ($null -eq $image -or -not (Test-FloorSized $image.Bitmap)) { continue }
        Draw-CellImage $image (($x - $CropX) * $CellWidth) (($y - $CropY) * $CellHeight) $true
      }
    }

    for ($pass = 0; $pass -lt 2; $pass++) {
      for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
        for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
          $cell = Get-CellOffset $map $x $y
          $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
          $frontSlot = $map.FrontIndex[$cell]
          if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
          $image = Get-MapImage $frontSlot $frontFrame
          if ($null -eq $image) { continue }
          $floorSized = Test-FloorSized $image.Bitmap
          if (($pass -eq 0 -and -not $floorSized) -or ($pass -eq 1 -and $floorSized)) { continue }
          Draw-CellImage $image (($x - $CropX) * $CellWidth) (($y - $CropY) * $CellHeight) $floorSized
        }
      }
    }
  }
  finally {
    $graphics.Dispose()
  }

  $scaledW = [Math]::Max(1, [int][Math]::Round($fullW * $OverviewScale))
  $scaledH = [Math]::Max(1, [int][Math]::Round($fullH * $OverviewScale))
  $scaled = [System.Drawing.Bitmap]::new($scaledW, $scaledH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
  try {
    $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $scaledGraphics.DrawImage($canvas, 0, 0, $scaledW, $scaledH)
  }
  finally {
    $scaledGraphics.Dispose()
  }

  $canvas.Dispose()
  return @{
    Bitmap = $scaled
    CropX = $CropX
    CropY = $CropY
    CropWCells = $CropWCells
    CropHCells = $CropHCells
    ScaledW = $scaledW
    ScaledH = $scaledH
    MapWidth = $map.Width
    MapHeight = $map.Height
  }
}

$candidates = @(
  @{
    id = "d401"
    file = "D401.map"
    label = "D401 - Dead Mine Entrance"
    blurb = "Main entrance tunnel from Bichon Province."
    entry = @{ x = 25; y = 181 }
    hints = @(@{ x = 100; y = 100; title = "Central cavern" })
  },
  @{
    id = "d402"
    file = "D402.map"
    label = "D402 - East of Dead Mine"
    blurb = "East branch with wider ore corridors."
    entry = @{ x = 11; y = 145 }
    hints = @(@{ x = 95; y = 95; title = "Mid tunnel" })
  },
  @{
    id = "d403"
    file = "D403.map"
    label = "D403 - 1F Dead Mine"
    blurb = "First floor mining routes."
    entry = @{ x = 11; y = 104 }
    hints = @(@{ x = 100; y = 100; title = "1F crossroads" })
  },
  @{
    id = "d404"
    file = "D404.map"
    label = "D404 - B2 Dead Mine"
    blurb = "Second floor; Old Skeleton quest at (104, 101)."
    entry = @{ x = 11; y = 150 }
    hints = @(@{ x = 104; y = 101; title = "Old Skeleton (quest)" })
  },
  @{
    id = "d405"
    file = "D405.map"
    label = "D405 - Ore Storage Place"
    blurb = "Crystal ore storage cavern - strong mining candidate."
    entry = @{ x = 12; y = 145 }
    hints = @(
      @{ x = 60; y = 80; title = "North storage alcove" },
      @{ x = 100; y = 100; title = "Central ore room" },
      @{ x = 140; y = 120; title = "South storage pit" }
    )
    default = $true
  },
  @{
    id = "d406"
    file = "D406.map"
    label = "D406 - South Dead Mine"
    blurb = "Southern deep mine branch."
    entry = @{ x = 185; y = 122 }
    hints = @(@{ x = 100; y = 100; title = "Deep south chamber" })
  }
)

$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$mapMetas = @()
foreach ($candidate in $candidates) {
  $mapPath = Join-Path $MapRoot $candidate.file
  if (-not (Test-Path $mapPath)) {
    Write-Warning "Missing map file: $mapPath"
    continue
  }
  Write-Host "Rendering $($candidate.label)..."
  $render = Render-DeadMineOverview -MapPath $mapPath
  $imagePath = Join-Path $outRoot "$($candidate.id)-overview.png"
  $render.Bitmap.Save($imagePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $render.Bitmap.Dispose()

  $dots = @(
    @{ x = $candidate.entry.x; y = $candidate.entry.y; className = "entry"; title = "GM teleporter entry" }
  )
  foreach ($hint in $candidate.hints) {
    $dots += @{ x = $hint.x; y = $hint.y; className = "hint"; title = $hint.title }
  }

  $mapMetas += @{
    id = $candidate.id
    label = $candidate.label
    blurb = $candidate.blurb
    image = "$($candidate.id)-overview.png"
    cropX = $render.CropX
    cropY = $render.CropY
    cropWCells = $render.CropWCells
    cropHCells = $render.CropHCells
    mapWidth = $render.MapWidth
    mapHeight = $render.MapHeight
    scaledWidth = $render.ScaledW
    scaledHeight = $render.ScaledH
    default = [bool]$candidate.default
    dots = $dots
  }
}

foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

$metaJson = ($mapMetas | ConvertTo-Json -Depth 6)
Set-Content -LiteralPath (Join-Path $outRoot "maps-meta.json") -Value $metaJson -Encoding UTF8

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Dead Mines - Crystal Map Picker</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 14px/1.45 Segoe UI, sans-serif; background: #12151c; color: #e8dcc0; }
    main { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p, li { color: #b9aa88; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 16px 0; }
    .coords { font-family: Consolas, monospace; background: #1b2029; border: 1px solid #3a4354; padding: 8px 12px; border-radius: 6px; min-width: 320px; }
    select { background: #1b2029; color: #e8dcc0; border: 1px solid #3a4354; padding: 8px 10px; border-radius: 6px; min-width: 280px; }
    .viewer { position: relative; display: inline-block; border: 1px solid #3a4354; background: #0d1016; max-width: 100%; overflow: auto; }
    #mapImage { display: block; max-width: 100%; height: auto; image-rendering: pixelated; cursor: crosshair; }
    .marker { position: absolute; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; }
    .marker.entry { background: #2ecc71; }
    .marker.hint { background: #3498db; width: 10px; height: 10px; border-width: 1px; }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .note { margin-top: 8px; color: #d4c4a0; }
  </style>
</head>
<body>
  <main>
    <h1>Dead Mines - Mining Spot Picker</h1>
    <p>Rendered from Crystal Dead Mine maps (D401-D406). Pick a floor, <strong>hover</strong> for coordinates, <strong>click</strong> to copy <code>X,Y</code> for where the idle miner should stand.</p>
    <ul>
      <li>Green = GM teleporter entry for that floor</li>
      <li>Blue = suggested scenic spots (starting points only)</li>
      <li>Default recommendation: <strong>D405 Ore Storage Place</strong></li>
    </ul>
    <div class="toolbar">
      <label>Map <select id="mapSelect"></select></label>
      <div class="coords" id="coords">Hover the map…</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show markers</label>
    </div>
    <p class="note" id="mapBlurb"></p>
    <div class="viewer" id="viewer">
      <img id="mapImage" alt="Dead Mine overview" />
    </div>
    <div class="legend">
      <span><i class="dot" style="background:#2ecc71"></i> GM entry</span>
      <span><i class="dot" style="background:#3498db"></i> Suggested spot</span>
    </div>
  </main>
  <script>
    const maps = $metaJson;
    const cellWidth = $CellWidth;
    const cellHeight = $CellHeight;
    const scale = $OverviewScale;
    const mapSelect = document.getElementById("mapSelect");
    const mapBlurb = document.getElementById("mapBlurb");
    const viewer = document.getElementById("viewer");
    const img = document.getElementById("mapImage");
    const coords = document.getElementById("coords");
    const toggle = document.getElementById("toggleMarkers");
    let active = null;

    for (const map of maps) {
      const option = document.createElement("option");
      option.value = map.id;
      option.textContent = map.label;
      mapSelect.appendChild(option);
    }

    function setActive(map) {
      active = map;
      img.src = map.image;
      img.width = map.scaledWidth;
      img.height = map.scaledHeight;
      mapBlurb.textContent = map.blurb + " (" + map.mapWidth + "x" + map.mapHeight + " cells)";
      renderMarkers();
    }

    function mapPointToPixel(mapX, mapY) {
      return {
        left: (mapX - active.cropX) * cellWidth * scale,
        top: (mapY - active.cropY) * cellHeight * scale
      };
    }

    function pixelToMap(clientX, clientY) {
      const rect = img.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width * img.naturalWidth;
      const py = (clientY - rect.top) / rect.height * img.naturalHeight;
      const mapX = Math.floor(px / (cellWidth * scale)) + active.cropX;
      const mapY = Math.floor(py / (cellHeight * scale)) + active.cropY;
      return { mapX, mapY };
    }

    function renderMarkers() {
      viewer.querySelectorAll(".marker").forEach((node) => node.remove());
      if (!toggle.checked || !active) return;
      for (const marker of active.dots || []) {
        const point = mapPointToPixel(marker.x, marker.y);
        const node = document.createElement("div");
        node.className = "marker dot " + marker.className;
        node.style.left = point.left + "px";
        node.style.top = point.top + "px";
        node.title = marker.title + " (" + marker.x + ", " + marker.y + ")";
        viewer.appendChild(node);
      }
    }

    mapSelect.addEventListener("change", () => {
      const map = maps.find((entry) => entry.id === mapSelect.value);
      if (map) setActive(map);
    });

    img.addEventListener("mousemove", (event) => {
      if (!active) return;
      const { mapX, mapY } = pixelToMap(event.clientX, event.clientY);
      coords.textContent = active.id.toUpperCase() + " - Map coordinate: " + mapX + ", " + mapY;
    });

    img.addEventListener("click", async (event) => {
      if (!active) return;
      const { mapX, mapY } = pixelToMap(event.clientX, event.clientY);
      const text = active.id.toUpperCase() + " " + mapX + ", " + mapY;
      coords.textContent = "Copied: " + text;
      try { await navigator.clipboard.writeText(text); } catch {}
    });

    toggle.addEventListener("change", renderMarkers);
    img.addEventListener("load", renderMarkers);

    const defaultMap = maps.find((entry) => entry.default) || maps[0];
    mapSelect.value = defaultMap.id;
    setActive(defaultMap);
  </script>
</body>
</html>
"@

Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Value $html -Encoding UTF8

Write-Host "Wrote $($mapMetas.Count) map overviews to $outRoot"
Write-Host "Open: $(Join-Path $outRoot 'index.html')"
