param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2001.map",
  [string]$OutputPng = "../public/mapedges/bdd-corridor-edge.png",
  [string]$ReviewRoot = "../tile-review/bdd-corridor-edge",
  [string]$ReviewImageName = "bdd-corridor-edge.png",
  [string]$ReviewTitle = "Corridor Edge",
  [string]$ReviewBlurb = "",
  [int]$CropX = 234,
  [int]$CropY = 201,
  [int]$CropWCells = 28,
  [int]$CropHCells = 13,
  [int]$LaneMapY = 210,
  [int]$CellsNorthOfLane = 9,
  [int]$CellsSouthScan = 10,
  [bool]$AutoCrop = $true,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalBddEdgeLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalBddEdgeLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public CrystalBddEdgeLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalBddEdgeImage ReadImage(int index)
    {
        if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
        stream.Position = offsets[index];
        short w = reader.ReadInt16();
        short h = reader.ReadInt16();
        short ox = reader.ReadInt16();
        short oy = reader.ReadInt16();
        reader.ReadInt16();
        reader.ReadInt16();
        byte shadow = reader.ReadByte();
        int len = reader.ReadInt32();
        bool hasMask = (shadow >> 7) == 1;
        if (w <= 0 || h <= 0 || len <= 0) return null;
        byte[] compressed = reader.ReadBytes(len);
        if (hasMask)
        {
            reader.ReadInt16();
            reader.ReadInt16();
            reader.ReadInt16();
            reader.ReadInt16();
            int maskLen = reader.ReadInt32();
            reader.ReadBytes(maskLen);
        }
        byte[] raw;
        using (var input = new MemoryStream(compressed))
        using (var gzip = new GZipStream(input, CompressionMode.Decompress))
        using (var output = new MemoryStream())
        {
            gzip.CopyTo(output);
            raw = output.ToArray();
        }
        if (raw.Length < w * h * 4) return null;
        Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try
        {
            for (int y = 0; y < h; y++)
                Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4);
        }
        finally { bitmap.UnlockBits(data); }
        return new CrystalBddEdgeImage(bitmap, ox, oy);
    }

    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}

public sealed class CrystalBddEdgeImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalBddEdgeImage(Bitmap bitmap, short offsetX, short offsetY)
    {
        Bitmap = bitmap;
    }
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
  return [pscustomobject]@{ Width = $width; Height = $height; Back = $back; Middle = $middle; Front = $front; FrontIndex = $frontIndex }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Get-VisibleBackFrame([int]$backFrame) {
  if ($backFrame -ge 1950 -and $backFrame -le 1999) { return $backFrame + 1000 }
  if ($backFrame -ge 2950 -and $backFrame -le 2959) { return $backFrame }
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
  $lib = [CrystalBddEdgeLib]::new($path)
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

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

function Test-TallWallCell($map, [int]$x, [int]$y) {
  $cell = Get-CellOffset $map $x $y
  $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
  $frontSlot = $map.FrontIndex[$cell]
  if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { return $false }
  $image = Get-MapImage $frontSlot $frontFrame
  if ($null -eq $image) { return $false }
  return -not (Test-FloorSized $image.Bitmap)
}

function Test-OpenLaneColumn($map, [int]$x, [int]$laneY) {
  foreach ($y in @(($laneY - 1), $laneY, ($laneY + 1))) {
    if ($y -lt 0 -or $y -ge $map.Height) { continue }
    if (Test-TallWallCell $map $x $y) { return $false }
    $cell = Get-CellOffset $map $x $y
    if ($map.Back[$cell] -eq 0) { return $false }
  }
  return $true
}

function Get-CorridorCropBounds($map, [int]$cropX, [int]$cropWCells, [int]$laneY, [int]$cellsNorth, [int]$cellsSouthScan) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $cropY = [Math]::Max(0, $laneY - $cellsNorth)
  $scanEndY = [Math]::Min($map.Height - 1, $laneY + $cellsSouthScan)
  $minTop = 0
  $maxBottom = (($laneY - $cropY) + 4) * $CellHeight

  for ($y = $cropY; $y -le $scanEndY; $y++) {
    for ($x = $cropX; $x -le $endX; $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      $bottom = (($y - $cropY) + 1) * $CellHeight
      $top = $bottom - $image.Bitmap.Height
      if ($top -lt $minTop) { $minTop = $top }
      if ($bottom -gt $maxBottom) { $maxBottom = $bottom }
    }
  }

  if ($minTop -lt 0) {
    $shiftCells = [Math]::Ceiling((0 - $minTop) / [double]$CellHeight)
    $cropY = [Math]::Max(0, $cropY - $shiftCells)
    $minTop = 0
    $maxBottom = $maxBottom + ($shiftCells * $CellHeight)
  }

  $cropHCells = [Math]::Max(
    ($cellsNorth + 4),
    [Math]::Ceiling($maxBottom / [double]$CellHeight) + 1
  )

  return [pscustomobject]@{
    CropX = $cropX
    CropY = $cropY
    CropWCells = $cropWCells
    CropHCells = $cropHCells
    LaneMapY = $laneY
    LanePixelY = (($laneY - $cropY) + 1) * $CellHeight
  }
}

$map = Read-Type1Map $MapPath
if ($AutoCrop) {
  $bounds = Get-CorridorCropBounds $map $CropX $CropWCells $LaneMapY $CellsNorthOfLane $CellsSouthScan
  $CropX = $bounds.CropX
  $CropY = $bounds.CropY
  $CropWCells = $bounds.CropWCells
  $CropHCells = $bounds.CropHCells
}

$endX = [Math]::Min($map.Width - 1, $CropX + $CropWCells - 1)
$endY = [Math]::Min($map.Height - 1, $CropY + $CropHCells - 1)
$bitmapW = ($endX - $CropX + 1) * $CellWidth
$bitmapH = ($endY - $CropY + 1) * $CellHeight
$bitmap = [System.Drawing.Bitmap]::new($bitmapW, $bitmapH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

  for ($y = $CropY; $y -le $endY; $y++) {
    for ($x = $CropX; $x -le $endX; $x++) {
      $drawX = ($x - $CropX) * $CellWidth
      $drawY = ($y - $CropY) * $CellHeight
      $openLane = Test-OpenLaneColumn $map $x $LaneMapY

      if (($x -band 1) -eq 0 -and ($y -band 1) -eq 0) {
        $cell = Get-CellOffset $map $x $y
        $backImage = $map.Back[$cell]
        if ($backImage -ne 0 -and -not $openLane) {
          $backFrame = Get-VisibleBackFrame (($backImage -band 0x1FFFFFFF) - 1)
          $image = Get-MapImage 0 $backFrame
          if ($null -ne $image) {
            $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
          }
        }
      }

      $cell = Get-CellOffset $map $x $y
      $midFrame = $map.Middle[$cell] - 1
      if ($midFrame -ge 0 -and -not $openLane) {
        $image = Get-MapImage 1 $midFrame
        if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
          $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
        }
      }

      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -ge 0 -and $frontSlot -ne -1 -and $frontSlot -ne 200) {
        $image = Get-MapImage $frontSlot $frontFrame
        if ($null -ne $image -and (Test-FloorSized $image.Bitmap) -and -not $openLane) {
          $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
        }
      }
    }
  }

  for ($y = $CropY; $y -le $endY; $y++) {
    for ($x = $CropX; $x -le $endX; $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      $drawX = ($x - $CropX) * $CellWidth
      $drawY = (($y - $CropY) + 1) * $CellHeight - $image.Bitmap.Height
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
    }
  }

  $outPath = Join-Path $PSScriptRoot $OutputPng
  $outDir = Split-Path $outPath -Parent
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $bitmap.Dispose()
  foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
  foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }
}

$lanePixelY = (($LaneMapY - $CropY) + 1) * $CellHeight
$reviewDir = Join-Path $PSScriptRoot $ReviewRoot
New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot $OutputPng) -Destination (Join-Path $reviewDir $ReviewImageName) -Force

$meta = [ordered]@{
  mapPath = $MapPath
  cropX = $CropX
  cropY = $CropY
  cropWCells = ($endX - $CropX + 1)
  cropHCells = ($endY - $CropY + 1)
  widthPx = $bitmapW
  heightPx = $bitmapH
  laneMapY = $LaneMapY
  lanePixelY = $lanePixelY
  repeatEveryPx = $bitmapW
  suggestedYOffsetFromBase = -($lanePixelY + 28)
  suggestedClipBottomOffsetFromBase = -30
}
$meta | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reviewDir "meta.json") -Encoding UTF8

$mapName = Split-Path $MapPath -Leaf
$blurb = if ($ReviewBlurb) { $ReviewBlurb } else { "From Crystal <code>$mapName</code> cells x=$CropX-$endX, y=$CropY-$endY. Open lane at map y=$LaneMapY is transparent so scrolling floor shows through. Wall cells = front-layer sprites taller/wider than 48×32 floor tiles." }

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>$ReviewTitle</title>
    <style>
      body { margin: 0; background: #111; color: #eee; font: 14px Segoe UI, sans-serif; padding: 16px; }
      img { image-rendering: pixelated; background: repeating-conic-gradient(#2a2620 0% 25%, #1a1814 0% 50%) 50% / 16px 16px; max-width: 100%; }
      code { color: #e8c978; }
      .row { margin-top: 12px; color: #bbb; }
    </style>
  </head>
  <body>
    <h1>$ReviewTitle</h1>
    <p>$blurb</p>
    <p class="row">Repeat width: <code>$bitmapW px</code> · Lane baseline in image: <code>$lanePixelY px</code> from top · Suggested <code>yOffsetFromBase</code>: <code>$($meta.suggestedYOffsetFromBase)</code></p>
    <img src="$ReviewImageName" alt="$ReviewTitle" />
    <p class="row">Tiled preview (3x):</p>
    <div style="display:flex; overflow:hidden; width:min(100%, $($bitmapW * 3)px);">
      <img src="$ReviewImageName" style="width:${bitmapW}px" />
      <img src="$ReviewImageName" style="width:${bitmapW}px" />
      <img src="$ReviewImageName" style="width:${bitmapW}px" />
    </div>
  </body>
</html>
"@
$html | Set-Content -LiteralPath (Join-Path $reviewDir "index.html") -Encoding UTF8

Write-Output ($meta | ConvertTo-Json)
