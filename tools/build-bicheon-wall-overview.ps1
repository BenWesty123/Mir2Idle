param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/0.map",
  [string]$OutputRoot = "../tile-review/bicheon-wall-overview",
  [int]$CropX = 300,
  [int]$CropY = 180,
  [int]$CropWCells = 320,
  [int]$CropHCells = 240,
  [double]$OverviewScale = 0.18,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  [int]$StampCropX = 314,
  [int]$StampCropY = 234,
  [int]$StampCropW = 44,
  [int]$StampCropH = 42,
  [int]$StampFocusX = 336,
  [int]$StampFocusY = 260
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
        reader.ReadInt16();
        reader.ReadInt16();
        reader.ReadInt16();
        reader.ReadInt16();
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

function Read-Type100Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -lt 8 -or $bytes[0] -ne 1 -or $bytes[2] -ne 0x43 -or $bytes[3] -ne 0x23) {
    throw "Only Type100 maps are supported: $path"
  }
  $width = [BitConverter]::ToInt16($bytes, 4)
  $height = [BitConverter]::ToInt16($bytes, 6)
  $count = $width * $height
  $backIndex = New-Object int[] $count
  $back = New-Object long[] $count
  $middleIndex = New-Object int[] $count
  $middle = New-Object int[] $count
  $frontIndex = New-Object int[] $count
  $front = New-Object int[] $count
  $offset = 8
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $backIndex[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset); $offset += 4
      $middleIndex[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $middle[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $frontIndex[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $offset += 12
    }
  }
  return [pscustomobject]@{ Width = $width; Height = $height; BackIndex = $backIndex; Back = $back; MiddleIndex = $middleIndex; Middle = $middle; FrontIndex = $frontIndex; Front = $front }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Test-FloorSized($bitmap, [int]$cellW, [int]$cellH) {
  return (($bitmap.Width -eq $cellW -and $bitmap.Height -eq $cellH) -or ($bitmap.Width -eq ($cellW * 2) -and $bitmap.Height -eq ($cellH * 2)))
}

function Normalize-FrontSlot([int]$slot) {
  if ($slot -eq 102) { return 90 }
  if ($slot -ge 255 -or $slot -lt 0) { return -1 }
  return $slot
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

$map = Read-Type100Map $MapPath
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
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 24, 28, 36))
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
      $backFrame = ($backImage -band 0x1FFFFFFF) - 1
      if ($backFrame -lt 0) { continue }
      $backSlot = [Math]::Max(0, [int]$map.BackIndex[$cell])
      $drawX = ($x - $CropX) * $CellWidth
      $drawY = ($y - $CropY) * $CellHeight
      Draw-CellImage (Get-MapImage $backSlot $backFrame) $drawX $drawY $true
    }
  }

  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      $cell = Get-CellOffset $map $x $y
      $middleFrame = $map.Middle[$cell] - 1
      if ($middleFrame -lt 0) { continue }
      $middleSlot = [Math]::Max(0, [int]$map.MiddleIndex[$cell])
      $image = Get-MapImage $middleSlot $middleFrame
      if ($null -eq $image -or -not (Test-FloorSized $image.Bitmap $CellWidth $CellHeight)) { continue }
      Draw-CellImage $image (($x - $CropX) * $CellWidth) (($y - $CropY) * $CellHeight) $true
    }
  }

  for ($pass = 0; $pass -lt 2; $pass++) {
    for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
      for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
        $cell = Get-CellOffset $map $x $y
        $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
        $frontSlot = Normalize-FrontSlot ([int]$map.FrontIndex[$cell])
        if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
        $image = Get-MapImage $frontSlot $frontFrame
        if ($null -eq $image) { continue }
        $floorSized = Test-FloorSized $image.Bitmap $CellWidth $CellHeight
        if (($pass -eq 0 -and -not $floorSized) -or ($pass -eq 1 -and $floorSized)) { continue }
        $drawX = ($x - $CropX) * $CellWidth
        $drawY = ($y - $CropY) * $CellHeight
        Draw-CellImage $image $drawX $drawY $floorSized
      }
    }
  }
}
finally {
  $graphics.Dispose()
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$fullPath = Join-Path $outRoot "city-overview-full.png"
$canvas.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)

$scaledW = [Math]::Max(1, [int][Math]::Round($fullW * $OverviewScale))
$scaledH = [Math]::Max(1, [int][Math]::Round($fullH * $OverviewScale))
$scaled = [System.Drawing.Bitmap]::new($scaledW, $scaledH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
try {
  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $scaledGraphics.DrawImage($canvas, 0, 0, $scaledW, $scaledH)
  $overviewPath = Join-Path $outRoot "city-overview.png"
  $scaled.Save($overviewPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $scaledGraphics.Dispose()
  $scaled.Dispose()
}

$canvas.Dispose()
foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

$meta = [ordered]@{
  mapPath = $MapPath
  cropX = $CropX
  cropY = $CropY
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  cellWidth = $CellWidth
  cellHeight = $CellHeight
  overviewScale = $OverviewScale
  fullWidth = $fullW
  fullHeight = $fullH
  scaledWidth = $scaledW
  scaledHeight = $scaledH
  currentStamp = @{
    cropX = $StampCropX
    cropY = $StampCropY
    cropWCells = $StampCropW
    cropHCells = $StampCropH
    focusX = $StampFocusX
    focusY = $StampFocusY
  }
  safeZones = @(
    @{ x = 328; y = 264; label = "Safe zone" },
    @{ x = 304; y = 256; label = "Safe zone" },
    @{ x = 267; y = 256; label = "Safe zone" },
    @{ x = 331; y = 330; label = "Safe zone" },
    @{ x = 288; y = 616; label = "Start point (south)" }
  )
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$metaJson = $meta | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $outRoot "meta.json"), $metaJson, $utf8NoBom)

$htmlPath = Join-Path $outRoot "index.html"
$htmlTemplate = Join-Path $PSScriptRoot "bicheon-wall-overview-index.html"
if (-not (Test-Path $htmlTemplate)) {
  throw "Missing HTML template: $htmlTemplate"
}
Copy-Item -LiteralPath $htmlTemplate -Destination $htmlPath -Force

[ordered]@{
  outputRoot = $outRoot
  fullImage = $fullPath
  overviewImage = (Join-Path $outRoot "city-overview.png")
  html = (Join-Path $outRoot "index.html")
  scaledWidth = $scaledW
  scaledHeight = $scaledH
} | ConvertTo-Json
