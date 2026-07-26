param(
  [Parameter(Mandatory = $true)]
  [string]$MapPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputRoot,
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapTitle = "",
  [string]$MapLabel = "",
  [string]$ImagePrefix = "overview",
  [string]$PickCommand = "use fire hell spot X, Y",
  [string]$HubLink = "../fire-hell-1-spot-picker/index.html",
  [string[]]$Bullets = @(),
  [array]$Legend = @(),
  [array]$Markers = @(),
  [int]$CropX = 0,
  [int]$CropY = 0,
  [int]$CropWCells = 0,
  [int]$CropHCells = 0,
  [double]$OverviewScale = 0,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  [switch]$SkipHtml,
  [switch]$SkipFullPng
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

function Get-Mir3LibRelativePath([int]$slot) {
  # Mirrors NextClient MapLibraryCache ResolveSlotPath for WemadeMir3 (200..274).
  if ($slot -lt 200 -or $slot -gt 274) { return $null }
  $states = @("", "wood", "sand", "snow", "forest")
  $leaves = @(
    "Tilesc", "Tiles30c", "Tiles5c", "Smtilesc", "Housesc", "Cliffsc", "Dungeonsc",
    "Innersc", "Furnituresc", "Wallsc", "smObjectsc", "Animationsc", "Object1c", "Object2c"
  )
  $rel = $slot - 200
  $group = [int][Math]::Floor($rel / 15)
  $leaf = $rel % 15
  if ($group -ge $states.Length -or $leaf -ge $leaves.Length) { return $null }
  $state = $states[$group]
  $leafName = $leaves[$leaf]
  if ([string]::IsNullOrEmpty($state)) { return "Map/WemadeMir3/$leafName.Lib" }
  return "Map/WemadeMir3/$state/$leafName.Lib"
}

function Get-MapLibRelativePath([int]$slot) {
  if ($slot -eq 0) { return "Map/WemadeMir2/Tiles.Lib" }
  if ($slot -eq 1) { return "Map/WemadeMir2/SmTiles.Lib" }
  if ($slot -eq 2) { return "Map/WemadeMir2/Objects.Lib" }
  if ($slot -ge 3 -and $slot -le 28) { return "Map/WemadeMir2/Objects$($slot - 1).Lib" }
  if ($slot -eq 90) { return "Map/WemadeMir2/Objects_32bit.Lib" }
  $mir3 = Get-Mir3LibRelativePath $slot
  if ($null -ne $mir3) { return $mir3 }
  return $null
}

function Read-Type5Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -lt 28 -or $bytes[0] -ne 0) {
    throw "Not a Mir3 Type5 map (expected leading 0): $path"
  }
  $width = [BitConverter]::ToInt16($bytes, 22)
  $height = [BitConverter]::ToInt16($bytes, 24)
  if ($width -le 0 -or $height -le 0) { throw "Invalid Type5 dimensions in $path" }

  $count = $width * $height
  $back = [long[]]::new($count)
  $backIndex = [int[]]::new($count)
  $middle = [int[]]::new($count)
  $middleIndex = [int[]]::new($count)
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)
  $walkable = [bool[]]::new($count)

  for ($i = 0; $i -lt $count; $i++) {
    $backIndex[$i] = -1
    $middleIndex[$i] = -1
    $frontIndex[$i] = -1
  }

  $offset = 28
  for ($x = 0; $x -lt [Math]::Floor($width / 2); $x++) {
    for ($y = 0; $y -lt [Math]::Floor($height / 2); $y++) {
      for ($i = 0; $i -lt 4; $i++) {
        $sx = ($x * 2) + ($i % 2)
        $sy = ($y * 2) + [Math]::Floor($i / 2)
        $cell = ($sx * $height) + $sy
        $backIndex[$cell] = if ($bytes[$offset] -ne 255) { [int]$bytes[$offset] + 200 } else { -1 }
        $back[$cell] = [BitConverter]::ToUInt16($bytes, $offset + 1) + 1
      }
      $offset += 3
    }
  }

  $offset = 28 + (3 * ([Math]::Floor($width / 2) + ($width % 2)) * [Math]::Floor($height / 2))
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $cell = ($x * $height) + $y
      $flag = $bytes[$offset]; $offset++
      $offset++ # MiddleAnimationFrame
      $frontAnim = $bytes[$offset]
      if ($frontAnim -eq 255) { $frontAnim = 0 }
      $offset++
      $frontIndex[$cell] = if ($bytes[$offset] -ne 255) { [int]$bytes[$offset] + 200 } else { -1 }; $offset++
      $middleIndex[$cell] = if ($bytes[$offset] -ne 255) { [int]$bytes[$offset] + 200 } else { -1 }; $offset++
      $middle[$cell] = [BitConverter]::ToUInt16($bytes, $offset) + 1; $offset += 2
      $front[$cell] = [BitConverter]::ToUInt16($bytes, $offset) + 1; $offset += 2
      if ($front[$cell] -eq 1 -and $frontIndex[$cell] -eq 200) { $frontIndex[$cell] = -1 }
      $offset += 3 # doors unused
      $offset += 2 # light (+ unknown)

      $walkable[$cell] = (($flag -band 1) -eq 1)
      if (-not $walkable[$cell]) { $back[$cell] = $back[$cell] -bor 0x20000000 }
      if (($flag -band 2) -ne 2) { $front[$cell] = $front[$cell] -bor 0x8000 }
    }
  }

  return [pscustomobject]@{
    Width = $width
    Height = $height
    Back = $back
    BackIndex = $backIndex
    Middle = $middle
    MiddleIndex = $middleIndex
    Front = $front
    FrontIndex = $frontIndex
    Walkable = $walkable
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

if (-not (Test-Path $MapPath)) { throw "Missing map file: $MapPath" }

$script:loadedLibs = @{}
$script:loadedImages = @{}

function Get-MapLib([int]$slot) {
  $key = [string]$slot
  if ($script:loadedLibs.ContainsKey($key)) { return $script:loadedLibs[$key] }
  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) { $script:loadedLibs[$key] = $null; return $null }
  $path = Join-Path (Resolve-Path $DataRoot) $relative
  if (-not (Test-Path $path)) { $script:loadedLibs[$key] = $null; return $null }
  $lib = [CrystalOverviewLib]::new($path)
  $script:loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$index) {
  if ($index -lt 0 -or $slot -lt 0) { return $null }
  $key = "$slot`:$index"
  if ($script:loadedImages.ContainsKey($key)) { return $script:loadedImages[$key] }
  $lib = Get-MapLib $slot
  if ($null -eq $lib) { $script:loadedImages[$key] = $null; return $null }
  $image = $lib.ReadImage($index)
  $script:loadedImages[$key] = $image
  return $image
}

$map = Read-Type5Map $MapPath
if ([string]::IsNullOrWhiteSpace($MapTitle)) { $MapTitle = [System.IO.Path]::GetFileNameWithoutExtension($MapPath) }
if ([string]::IsNullOrWhiteSpace($MapLabel)) { $MapLabel = $MapTitle }

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

Write-Host "Rendering Type5 Mir3 overview $($map.Width)x$($map.Height) crop $($CropWCells)x$($CropHCells) @ scale $([Math]::Round($OverviewScale, 3))..."

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

  # Back tiles (even cells only - Mir3 packs 2x2 with shared art).
  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      if (($x -band 1) -ne 0 -or ($y -band 1) -ne 0) { continue }
      $cell = Get-CellOffset $map $x $y
      $slot = $map.BackIndex[$cell]
      $backImage = $map.Back[$cell]
      if ($slot -lt 0 -or $backImage -eq 0) { continue }
      $backFrame = ($backImage -band 0x1FFFFFFF) - 1
      if ($backFrame -lt 0) { continue }
      Draw-CellImage (Get-MapImage $slot $backFrame) (($x - $CropX) * $CellWidth) (($y - $CropY) * $CellHeight) $true
    }
  }

  # Middle layer
  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      $cell = Get-CellOffset $map $x $y
      $slot = $map.MiddleIndex[$cell]
      $middleFrame = $map.Middle[$cell] - 1
      if ($slot -lt 0 -or $middleFrame -lt 0) { continue }
      $image = Get-MapImage $slot $middleFrame
      if ($null -eq $image -or -not (Test-FloorSized $image.Bitmap)) { continue }
      Draw-CellImage $image (($x - $CropX) * $CellWidth) (($y - $CropY) * $CellHeight) $true
    }
  }

  # Front layer: tall props then floor-sized
  for ($pass = 0; $pass -lt 2; $pass++) {
    for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
      for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
        $cell = Get-CellOffset $map $x $y
        $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
        $frontSlot = $map.FrontIndex[$cell]
        if ($frontFrame -lt 0 -or $frontSlot -lt 0) { continue }
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

if (-not $SkipFullPng) {
  $fullPath = Join-Path $outRoot "$ImagePrefix-full.png"
  $canvas.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
}

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
foreach ($entry in $script:loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $script:loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

# Persist walkability sample + dims for the spot picker (optional companion).
$metaPath = Join-Path $outRoot "meta.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$metaObj = [ordered]@{
  cropX = $CropX
  cropY = $CropY
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  mapWidth = $map.Width
  mapHeight = $map.Height
  overviewScale = $OverviewScale
  scaledWidth = $scaledW
  scaledHeight = $scaledH
  cellWidth = $CellWidth
  cellHeight = $CellHeight
  markers = @($Markers)
}
[System.IO.File]::WriteAllText($metaPath, ($metaObj | ConvertTo-Json -Depth 6), $utf8NoBom)

if (-not $SkipHtml) {
  $markersJson = ($Markers | ForEach-Object {
    "        { x: $($_.x), y: $($_.y), className: `"$($_.className)`", title: `"$($_.title -replace '"','\"')`" }"
  }) -join ",`n"

  $mapFileName = [System.IO.Path]::GetFileName($MapPath)
  $bulletHtml = if ($Bullets.Count -gt 0) {
    ($Bullets | ForEach-Object { "      <li>$_</li>" }) -join "`n"
  } else {
    "      <li>Click anywhere to copy coordinates for the party stand spot.</li>"
  }

  $legendHtml = if ($Legend.Count -gt 0) {
    ($Legend | ForEach-Object {
      "      <span><i class=`"dot`" style=`"background:$($_.color)`"></i> $($_.label)</span>"
    }) -join "`n"
  } else {
    @"
      <span><i class="dot" style="background:#f39c12"></i> Spawn hub</span>
      <span><i class="dot" style="background:#3498db"></i> Alternate stand</span>
"@
  }

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
    a { color: #c9a24d; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 16px 0; }
    .coords { font-family: Consolas, monospace; background: #1b2029; border: 1px solid #3a4354; padding: 8px 12px; border-radius: 6px; min-width: 360px; }
    .viewer { position: relative; display: inline-block; border: 1px solid #3a4354; background: #0d1016; max-width: 100%; overflow: auto; }
    #mapImage { display: block; max-width: 100%; height: auto; image-rendering: pixelated; cursor: crosshair; }
    .marker { position: absolute; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 0 0 1px rgba(0,0,0,.7); }
    .marker.dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; }
    .marker.boss { background: #f39c12; width: 14px; height: 14px; }
    .marker.wave { background: #3498db; }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  </style>
</head>
<body>
  <main>
    <p><a href="$HubLink">&larr; Fire Hell pickers</a></p>
    <h1>$MapLabel</h1>
    <p>Crystal <code>$mapFileName</code> ($MapTitle) - Mir3 Type5 map. <strong>Hover</strong> for coordinates. <strong>Click</strong> to copy <code>X, Y</code>.</p>
    <ul>
      <li>Map size: $($map.Width) x $($map.Height) cells</li>
$bulletHtml
      <li>Then reply: <code>$PickCommand</code></li>
    </ul>
    <div class="toolbar">
      <div class="coords" id="coords">Hover the map...</div>
      <label><input type="checkbox" id="toggleMarkers" checked /> Show reference markers</label>
    </div>
    <div class="viewer" id="viewer">
      <img id="mapImage" src="$ImagePrefix.png" width="$scaledW" height="$scaledH" alt="$MapLabel overview" />
    </div>
    <div class="legend">
$legendHtml
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
  [System.IO.File]::WriteAllText((Join-Path $outRoot "index.html"), $html, $utf8NoBom)
}

Write-Output ([ordered]@{
  outputRoot = $outRoot
  mapWidth = $map.Width
  mapHeight = $map.Height
  cropX = $CropX
  cropY = $CropY
  overviewScale = $OverviewScale
  scaledWidth = $scaledW
  scaledHeight = $scaledH
  overviewImage = (Join-Path $outRoot "$ImagePrefix.png")
} | ConvertTo-Json)
