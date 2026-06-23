param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/R01.map",
  [string]$RegionJson = "./tile-review/red-cavern-r01-alt-floor-patch-region.json",
  [string]$OutputPng = "../public/maptiles/red-cavern-alt-floor-patch.png",
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalRedCavernFloorPatchLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
public sealed class CrystalRedCavernFloorPatchLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public CrystalRedCavernFloorPatchLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }
    public CrystalRedCavernFloorPatchImage ReadImage(int index)
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
        if (hasMask) { reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt32(); reader.ReadBytes(reader.ReadInt32()); }
        byte[] raw;
        using (var input = new MemoryStream(compressed))
        using (var gzip = new GZipStream(input, CompressionMode.Decompress))
        using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); }
        if (raw.Length < w * h * 4) return null;
        Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); }
        finally { bitmap.UnlockBits(data); }
        return new CrystalRedCavernFloorPatchImage(bitmap);
    }
    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class CrystalRedCavernFloorPatchImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalRedCavernFloorPatchImage(Bitmap bitmap) { Bitmap = bitmap; }
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
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)
  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
      $slot = [int]$bytes[$offset + 12] + 2
      if ($slot -eq 102) { $slot = 90 }
      if ($slot -ge 255) { $slot = -1 }
      $frontIndex[$i] = $slot
      $offset += 15
    }
  }
  return [pscustomobject]@{ Width = $width; Height = $height; Back = $back; Front = $front; FrontIndex = $frontIndex }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Get-VisibleBackFrame([int]$backFrame) {
  if ($backFrame -ge 1950 -and $backFrame -le 1999) { return $backFrame + 1000 }
  return $backFrame
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
  $lib = [CrystalRedCavernFloorPatchLib]::new($path)
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

function Draw-BackCellSlice($graphics, $map, [int]$x, [int]$y, [int]$originX, [int]$originY, [int]$destX, [int]$destY) {
  $ax = $x -band (-2)
  $ay = $y -band (-2)
  $cell = Get-CellOffset $map $ax $ay
  $backImage = $map.Back[$cell]
  if ($backImage -eq 0) { return }
  $backFrame = Get-VisibleBackFrame (($backImage -band 0x1FFFFFFF) - 1)
  $image = Get-MapImage 0 $backFrame
  if ($null -eq $image) { return }
  $bitmap = $image.Bitmap
  if ($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) {
    if ($x -ne $ax -or $y -ne $ay) { return }
    $graphics.DrawImageUnscaled($bitmap, $destX, $destY)
    return
  }
  $srcX = ($x - $ax) * $CellWidth
  $srcY = ($y - $ay) * $CellHeight
  if ($srcX + $CellWidth -gt $bitmap.Width -or $srcY + $CellHeight -gt $bitmap.Height) { return }
  $srcRect = [System.Drawing.Rectangle]::new($srcX, $srcY, $CellWidth, $CellHeight)
  $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $CellWidth, $CellHeight)
  $graphics.DrawImage($bitmap, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-FrontCell($graphics, $map, [int]$x, [int]$y, [int]$originY, [int]$destX) {
  $cell = Get-CellOffset $map $x $y
  $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
  $frontSlot = $map.FrontIndex[$cell]
  if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { return }
  $image = Get-MapImage $frontSlot $frontFrame
  if ($null -eq $image) { return }
  $bitmap = $image.Bitmap
  if (Test-FloorSized $bitmap) {
    $drawY = ($y - $originY) * $CellHeight
    $graphics.DrawImageUnscaled($bitmap, $destX, $drawY)
    return
  }
  $drawY = (($y - $originY) + 1) * $CellHeight - $bitmap.Height
  $graphics.DrawImageUnscaled($bitmap, $destX, $drawY)
}

$regionPath = Join-Path $PSScriptRoot $RegionJson
$region = Get-Content -LiteralPath $regionPath -Raw | ConvertFrom-Json
$map = Read-Type1Map $MapPath

$width = [int]$region.bounds.width * $CellWidth
$height = [int]$region.bounds.height * $CellHeight
$bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $x0 = [int]$region.bounds.x0
  $y0 = [int]$region.bounds.y0
  $x1 = [int]$region.bounds.x1
  $y1 = [int]$region.bounds.y1
  for ($y = $y0; $y -le $y1; $y++) {
    for ($x = $x0; $x -le $x1; $x++) {
      $destX = ($x - $x0) * $CellWidth
      $destY = ($y - $y0) * $CellHeight
      Draw-BackCellSlice $graphics $map $x $y $x0 $y0 $destX $destY
    }
  }
  for ($y = $y0; $y -le $y1; $y++) {
    for ($x = $x0; $x -le $x1; $x++) {
      $destX = ($x - $x0) * $CellWidth
      Draw-FrontCell $graphics $map $x $y $y0 $destX
    }
  }
  $outPath = Join-Path $PSScriptRoot $OutputPng
  New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
  $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Red Cavern floor patch: $outPath (${width}x${height})"
}
finally {
  $graphics.Dispose()
  $bitmap.Dispose()
  foreach ($lib in $loadedLibs.Values) { if ($null -ne $lib) { $lib.Dispose() } }
}
