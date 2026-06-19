param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2071.map",
  [string]$OutputRoot = "../tile-review/prajna-temple-floor-comparison",
  [int]$CropX = 24,
  [int]$CropY = 38,
  [int]$CropWCells = 64,
  [int]$CropHCells = 14,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  [int]$StageWidth = 960,
  [int]$StageHeight = 540,
  [int]$GroundTopRows = 10
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalTempleFloorLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalTempleFloorLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public CrystalTempleFloorLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }
    public CrystalTempleFloorImage ReadImage(int index)
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
        return new CrystalTempleFloorImage(bitmap);
    }
    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class CrystalTempleFloorImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalTempleFloorImage(Bitmap bitmap) { Bitmap = bitmap; }
    public void Dispose() { Bitmap.Dispose(); }
}
"@
}

function Get-MapLibRelativePath([int]$slot) {
  if ($slot -eq 0) { return "Map/WemadeMir2/Tiles.Lib" }
  if ($slot -eq 1) { return "Map/WemadeMir2/SmTiles.Lib" }
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
  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $middle[$i] = [BitConverter]::ToInt16($bytes, $offset + 4) -bxor $xor
      $offset += 15
    }
  }
  return [pscustomobject]@{ Width = $width; Height = $height; Back = $back; Middle = $middle }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Get-TempleBackFrame([int]$backFrame) {
  if ($backFrame -ge 1950 -and $backFrame -le 1954) { return 3100 + ($backFrame - 1950) }
  if ($backFrame -ge 3100 -and $backFrame -le 3104) { return $backFrame }
  return -1
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
    ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
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
  $lib = [CrystalTempleFloorLib]::new($path)
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

function Positive-Modulo([int]$value, [int]$divisor) {
  return (($value % $divisor) + $divisor) % $divisor
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

# --- Crystal D2071 floor (back + middle floor-sized only) ---
$map = Read-Type1Map $MapPath
$crystalW = $CropWCells * $CellWidth
$crystalH = $CropHCells * $CellHeight
$crystal = [System.Drawing.Bitmap]::new($crystalW, $crystalH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$cg = [System.Drawing.Graphics]::FromImage($crystal)
try {
  $cg.Clear([System.Drawing.Color]::FromArgb(255, 18, 16, 14))
  $cg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      if (($x -band 1) -ne 0 -or ($y -band 1) -ne 0) { continue }
      $cell = Get-CellOffset $map $x $y
      $backFrame = Get-TempleBackFrame (($map.Back[$cell] -band 0x1FFFFFFF) - 1)
      if ($backFrame -ge 0) {
        $image = Get-MapImage 0 $backFrame
        if ($null -ne $image) {
          $dx = ($x - $CropX) * $CellWidth
          $dy = ($y - $CropY) * $CellHeight
          $cg.DrawImageUnscaled($image.Bitmap, $dx, $dy)
        }
      }
    }
  }
  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      $cell = Get-CellOffset $map $x $y
      $middleFrame = $map.Middle[$cell] - 1
      if ($middleFrame -lt 0) { continue }
      $image = Get-MapImage 1 $middleFrame
      if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
        $dx = ($x - $CropX) * $CellWidth
        $dy = ($y - $CropY) * $CellHeight
        $cg.DrawImageUnscaled($image.Bitmap, $dx, $dy)
      }
    }
  }
}
finally { $cg.Dispose() }

$crystalPath = Join-Path $outRoot "crystal-d2071-floor.png"
$crystal.Save($crystalPath, [System.Drawing.Imaging.ImageFormat]::Png)

# --- Idle lane floor (matches app.js drawMapCanvas) ---
$indexPath = Join-Path $PSScriptRoot "../public/maptiles/index.json"
$index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
$set = $index.sets | Where-Object { $_.id -eq "prajna-temple" } | Select-Object -First 1
if (-not $set) { throw "prajna-temple tile set not found" }
$sheetPath = Join-Path $PSScriptRoot ("../public/maptiles/" + $set.sheet)
$sheetBmp = [System.Drawing.Bitmap]::FromFile($sheetPath)

$patternPath = Join-Path $PSScriptRoot "../tile-review/prajna-temple-tile-pattern.json"
$pattern = if (Test-Path $patternPath) {
  (Get-Content -LiteralPath $patternPath -Raw | ConvertFrom-Json).anchorPattern
} else { throw "Missing $patternPath (run build-prajna-temple-tile-pattern.ps1 first)" }

$idle = [System.Drawing.Bitmap]::new($StageWidth, $StageHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ig = [System.Drawing.Graphics]::FromImage($idle)
try {
  $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, $StageWidth, $StageHeight),
    [System.Drawing.Color]::FromArgb(255, 20, 18, 16),
    [System.Drawing.Color]::FromArgb(255, 10, 9, 8),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
  $ig.FillRectangle($bg, 0, 0, $StageWidth, $StageHeight)
  $bg.Dispose()

  $slotWidth = [int]$set.slotWidth
  $slotHeight = [int]$set.slotHeight
  $laneY = 0.78
  $baseY = [Math]::Floor($StageHeight * $laneY) - 34
  $firstGroundRow = -$GroundTopRows
  $rows = 5
  $scrollCameraX = 0
  $scroll = 0
  $tileColumn = 0
  $cols = [Math]::Ceiling($StageWidth / $slotWidth) + 10
  $tileCount = @($set.tiles).Count

  $laneRowStep = 28
  $anchorRowStep = 32
  $lastLaneRow = $rows - 1
  $firstAnchorRow = [Math]::Floor(($firstGroundRow * $laneRowStep) / $anchorRowStep)
  $lastAnchorRowFromLane = [Math]::Ceiling(($lastLaneRow * $laneRowStep) / $anchorRowStep) + 1
  $sampleTile = @($set.tiles)[0]
  $tileDrawBottom = ([int]$sampleTile.offsetY) + ([int]$sampleTile.h) - 58
  $minAnchorForStage = [Math]::Ceiling(($StageHeight - $baseY - $tileDrawBottom) / $anchorRowStep)
  $lastAnchorRow = [Math]::Max($lastAnchorRowFromLane, $minAnchorForStage + 1)
  $firstDrawAnchorRow = if (($firstAnchorRow -band 1) -eq 0) { $firstAnchorRow } else { $firstAnchorRow + 1 }
  for ($anchorRow = $firstDrawAnchorRow; $anchorRow -lt $lastAnchorRow; $anchorRow += 2) {
    for ($col = -5; $col -lt $cols; $col++) {
      $worldColumn = $col + $tileColumn
      $patternRowIndex = Positive-Modulo ([Math]::Floor($anchorRow / 2)) $pattern.Count
      $patternRow = $pattern[$patternRowIndex]
      $slot = $patternRow[(Positive-Modulo $worldColumn $patternRow.Count)]
      $tile = $set.tiles | Where-Object { [int]$_.slot -eq [int]$slot } | Select-Object -First 1
      if (-not $tile) { continue }
      $sourceW = [int]$tile.w
      $sourceH = [int]$tile.h
      $destX = ($col * $slotWidth) - $scroll - 24 + ([int]$tile.offsetX)
      $destY = $baseY + ($anchorRow * $anchorRowStep) - 58 + ([int]$tile.offsetY)
      $srcX = [int]$tile.slot * $slotWidth
      $ig.DrawImage($sheetBmp, [System.Drawing.Rectangle]::new($destX, $destY, $sourceW, $sourceH), [System.Drawing.Rectangle]::new($srcX, 0, $sourceW, $sourceH), [System.Drawing.GraphicsUnit]::Pixel)
    }
  }
}
finally { $ig.Dispose() }

$idlePath = Join-Path $outRoot "idle-prajna-temple-floor.png"
$idle.Save($idlePath, [System.Drawing.Imaging.ImageFormat]::Png)

# --- Floor-band crop of idle (for pixel-aligned compare width) ---
$floorTop = [Math]::Max(0, $baseY + ($firstAnchorRow * $anchorRowStep) - 58 + (-44))
$floorBottom = [Math]::Min($StageHeight, $baseY + (($lastAnchorRow - 1) * $anchorRowStep) - 58 + $slotHeight)
$floorH = [Math]::Max(1, $floorBottom - $floorTop)
$idleFloor = [System.Drawing.Bitmap]::new($StageWidth, $floorH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fg = [System.Drawing.Graphics]::FromImage($idleFloor)
try {
  $fg.DrawImage($idle, 0, 0, [System.Drawing.Rectangle]::new(0, $floorTop, $StageWidth, $floorH), [System.Drawing.GraphicsUnit]::Pixel)
}
finally { $fg.Dispose() }
$idleFloorPath = Join-Path $outRoot "idle-floor-band.png"
$idleFloor.Save($idleFloorPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Scale crystal to same width as idle floor band for overlay compare
$scaledCrystalH = [Math]::Max(1, [int][Math]::Round($crystalH * ($StageWidth / [double]$crystalW)))
$scaledCrystal = [System.Drawing.Bitmap]::new($StageWidth, $scaledCrystalH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($scaledCrystal)
try {
  $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $sg.DrawImage($crystal, 0, 0, $StageWidth, $scaledCrystalH)
}
finally { $sg.Dispose() }
$scaledCrystalPath = Join-Path $outRoot "crystal-d2071-floor-scaled.png"
$scaledCrystal.Save($scaledCrystalPath, [System.Drawing.Imaging.ImageFormat]::Png)

$crystal.Dispose()
$idle.Dispose()
$idleFloor.Dispose()
$scaledCrystal.Dispose()
$sheetBmp.Dispose()
foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

$meta = [ordered]@{
  map = "D2071.map"
  crop = @{ x = $CropX; y = $CropY; w = $CropWCells; h = $CropHCells }
  crystalNative = @{ width = $crystalW; height = $crystalH }
  idleStage = @{ width = $StageWidth; height = $StageHeight; groundTopRows = $GroundTopRows }
  tileFrames = @(3100, 3101, 3102, 3103, 3104)
  notes = "Crystal uses 48x32 cells with 2x2 back-tile anchors on even (x,y). Idle draws one 96x64 tile per even map row, 96px apart, pattern indexed by mapRow/2."
}
$meta | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outRoot "meta.json") -Encoding UTF8

$html = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prajna Temple Floor Comparison</title>
  <style>
    :root { color-scheme: dark; --zoom: 1; }
    body { margin: 0; background: #12110f; color: #ece6d8; font: 14px/1.45 Segoe UI, sans-serif; }
    header { padding: 16px 20px; border-bottom: 1px solid #4a3f2c; background: #1c1914; }
    h1 { margin: 0 0 8px; color: #f4dfb0; font-size: 22px; }
    p, li { color: #b9ad94; max-width: 960px; }
    main { padding: 16px 20px 32px; display: grid; gap: 24px; }
    section { display: grid; gap: 10px; }
    h2 { margin: 0; color: #f0d89a; font-size: 18px; }
    .panel { border: 1px solid #3b3224; background: #1a1712; padding: 12px; overflow: auto; }
    img { image-rendering: pixelated; max-width: none; width: calc(100% * var(--zoom)); height: auto; display: block; }
    .controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
    label { display: flex; gap: 8px; align-items: center; color: #ddd; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }
    code { color: #e8c978; }
  </style>
</head>
<body>
  <header>
    <h1>Prajna Temple Floor — Crystal vs Idle</h1>
    <p>Side-by-side reference from <code>D2071.map</code> (PrajnaTemple_1F) and the current idle lane renderer.</p>
    <ul>
      <li><strong>Left:</strong> Crystal back/middle floor tiles only (48×32 cells, native map crop ${CropWCells}×${CropHCells}).</li>
      <li><strong>Right:</strong> Idle <code>drawMapCanvas</code> simulation (${StageWidth}×${StageHeight}, groundTopRows=${GroundTopRows}).</li>
      <li><strong>Bottom:</strong> Same-width scaled Crystal strip vs idle floor band crop.</li>
    </ul>
    <div class="controls">
      <label>Zoom <input id="zoom" type="range" min="0.5" max="3" step="0.25" value="1" /><output id="zoomVal">1×</output></label>
    </div>
  </header>
  <main>
    <div class="grid-2">
      <section>
        <h2>Crystal — D2071 floor (native)</h2>
        <div class="panel"><img src="crystal-d2071-floor.png" alt="Crystal D2071 floor" /></div>
      </section>
      <section>
        <h2>Idle — current Prajna Temple lane</h2>
        <div class="panel"><img src="idle-prajna-temple-floor.png" alt="Idle Prajna Temple floor" /></div>
      </section>
    </div>
    <section>
      <h2>Width-matched floor strips</h2>
      <div class="grid-2">
        <div class="panel"><img src="crystal-d2071-floor-scaled.png" alt="Crystal scaled" /></div>
        <div class="panel"><img src="idle-floor-band.png" alt="Idle floor band" /></div>
      </div>
    </section>
  </main>
  <script>
    const zoom = document.getElementById("zoom");
    const zoomVal = document.getElementById("zoomVal");
    const apply = () => { document.documentElement.style.setProperty("--zoom", zoom.value); zoomVal.textContent = zoom.value + "×"; };
    zoom.addEventListener("input", apply); apply();
  </script>
</body>
</html>
'@
$html = $html.Replace('${CropWCells}', [string]$CropWCells).Replace('${CropHCells}', [string]$CropHCells).Replace('${StageWidth}', [string]$StageWidth).Replace('${StageHeight}', [string]$StageHeight).Replace('${GroundTopRows}', [string]$GroundTopRows)
$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Encoding UTF8

Write-Host "Prajna Temple floor comparison:"
Write-Host "  Crystal: $crystalPath ($crystalW x $crystalH)"
Write-Host "  Idle:    $idlePath"
Write-Host "  Open:    $(Resolve-Path (Join-Path $outRoot 'index.html'))"
