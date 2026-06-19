param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2005.map",
  [string]$OutputRoot = "../tile-review/bdd-purgatory-overview",
  [string]$MapTitle = "PurgatoryHall",
  [string]$MapLabel = "Purgatory Hall (BDD connector)",
  [string]$ImagePrefix = "d2005-overview",
  [int]$CropX = 0,
  [int]$CropY = 0,
  [int]$CropWCells = 0,
  [int]$CropHCells = 0,
  [double]$OverviewScale = 0,
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
  return [pscustomobject]@{
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

$map = Read-Type1Map $MapPath
if ($CropWCells -le 0) { $CropWCells = $map.Width }
if ($CropHCells -le 0) { $CropHCells = $map.Height }
$CropX = [Math]::Max(0, [Math]::Min($CropX, $map.Width - 1))
$CropY = [Math]::Max(0, [Math]::Min($CropY, $map.Height - 1))
$CropWCells = [Math]::Min($CropWCells, $map.Width - $CropX)
$CropHCells = [Math]::Min($CropHCells, $map.Height - $CropY)

$fullW = $CropWCells * $CellWidth
$fullH = $CropHCells * $CellHeight
if ($OverviewScale -le 0) {
  $OverviewScale = [Math]::Min(1.0, 4200 / [Math]::Max($fullW, $fullH))
}

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

$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$fullPath = Join-Path $outRoot "$ImagePrefix-full.png"
$canvas.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)

$scaledW = [Math]::Max(1, [int][Math]::Round($fullW * $OverviewScale))
$scaledH = [Math]::Max(1, [int][Math]::Round($fullH * $OverviewScale))
$scaled = [System.Drawing.Bitmap]::new($scaledW, $scaledH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
try {
  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $scaledGraphics.DrawImage($canvas, 0, 0, $scaledW, $scaledH)
  $overviewPath = Join-Path $outRoot "$ImagePrefix.png"
  $scaled.Save($overviewPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $scaledGraphics.Dispose()
  $scaled.Dispose()
}

$canvas.Dispose()
foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

# Crystal PurgatoryHall (D2005) - connector between BDD 2F and Wooma Palace.
$markers = @(
  @{ x = 49; y = 51; className = "hub"; title = "Center hub (recommended party stand)" },
  @{ x = 33; y = 33; className = "spawn"; title = "North pocket - BugBat / Ghoul21" },
  @{ x = 69; y = 71; className = "spawn"; title = "East pocket - ZumaStatue20 + RedBoar" },
  @{ x = 83; y = 85; className = "entry"; title = "GM teleporter warp-in" },
  @{ x = 85; y = 86; className = "exit"; title = "Exit back to BDD 2F (D2004)" },
  @{ x = 19; y = 20; className = "exit"; title = "Exit forward to Wooma Palace (D2006)" }
)

$markersJson = ($markers | ForEach-Object {
  "        { x: $($_.x), y: $($_.y), className: `"$($_.className)`", title: `"$($_.title)`" }"
}) -join ",`n"

$mapFileName = [System.IO.Path]::GetFileName($MapPath)

[ordered]@{
  mapPath = $MapPath
  mapFile = $mapFileName
  mapTitle = $MapTitle
  mapLabel = $MapLabel
  mapWidth = $map.Width
  mapHeight = $map.Height
  cropX = $CropX
  cropY = $CropY
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  overviewScale = $OverviewScale
  scaledWidth = $scaledW
  scaledHeight = $scaledH
  markers = $markers
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outRoot "meta.json") -Encoding UTF8

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>$MapLabel - $mapFileName Overview</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 14px/1.45 Segoe UI, sans-serif; background: #12151c; color: #e8dcc0; }
    main { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p, li { color: #b9aa88; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 16px 0; }
    .coords { font-family: Consolas, monospace; background: #1b2029; border: 1px solid #3a4354; padding: 8px 12px; border-radius: 6px; min-width: 360px; }
    .viewer { position: relative; display: inline-block; border: 1px solid #3a4354; background: #0d1016; max-width: 100%; overflow: auto; }
    #mapImage { display: block; max-width: 100%; height: auto; image-rendering: pixelated; cursor: crosshair; }
    .marker { position: absolute; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; }
    .marker.boss { background: #e74c3c; width: 14px; height: 14px; }
    .marker.spawn { background: #3498db; }
    .marker.hub { background: #f39c12; }
    .marker.entry { background: #2ecc71; }
    .marker.exit { background: #9b59b6; }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  </style>
</head>
<body>
  <main>
    <h1>$MapLabel</h1>
    <p>Full Crystal <code>$mapFileName</code> ($MapTitle) render. <strong>Hover</strong> for map coordinates. <strong>Click</strong> to copy <code>X, Y</code> for the party stand spot.</p>
    <ul>
      <li>Map size: $CropWCells x $CropHCells cells ($($map.Width) x $($map.Height) total)</li>
      <li>Orange dot = recommended center hub (49, 51) - Ghoul21 / ZumaArcher21 respawns</li>
      <li>Blue dots = north (33, 33) and east (69, 71) farming pockets</li>
      <li>Green dot = GM teleporter warp-in (83, 85)</li>
      <li>Purple dots = exits to BDD 2F (85, 86) and Wooma Palace (19, 20)</li>
      <li>Click anywhere to copy coordinates, then reply: <code>use bdd purgatory spot X, Y</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="$ImagePrefix.png" width="$scaledW" height="$scaledH" alt="$MapLabel overview" />
    </div>
    <div class="legend">
      <span><i class="dot" style="background:#f39c12"></i> Center hub</span>
      <span><i class="dot" style="background:#3498db"></i> Mob pockets</span>
      <span><i class="dot" style="background:#2ecc71"></i> GM warp-in</span>
      <span><i class="dot" style="background:#9b59b6"></i> Map exits</span>
    </div>
  </main>
  <script>
    const meta = {
      cropX: $CropX,
      cropY: $CropY,
      cellWidth: $CellWidth,
      cellHeight: $CellHeight,
      scale: $OverviewScale,
      dots: [
$markersJson
      ],
      rects: []
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

Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Value $html -Encoding UTF8

[ordered]@{
  outputRoot = $outRoot
  html = (Join-Path $outRoot "index.html")
  overviewImage = (Join-Path $outRoot "$ImagePrefix.png")
  scaledWidth = $scaledW
  scaledHeight = $scaledH
  mapWidth = $map.Width
  mapHeight = $map.Height
  overviewScale = $OverviewScale
} | ConvertTo-Json
