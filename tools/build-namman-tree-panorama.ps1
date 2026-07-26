param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/NAMMAN.map",
  [string]$OutputPng = "../public/mapedges/namman-tree-line.png",
  [string]$ReviewRoot = "../tile-review/namman-tree-line",
  # Dense tree belt — region export (296,341)-(320,359). Bake intact (no 48px columns).
  # Tall Objects15 canopy sprites are 500–1200px; keep MaxSpriteHeight high enough to include them.
  [int]$CropX = 296,
  [int]$LaneMapY = 359,
  [int]$CropWCells = 25,
  [int]$CellsNorthOfLane = 18,
  [int]$MaxSpriteHeight = 1300,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalNammanTreePanoramaLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
public sealed class CrystalNammanTreePanoramaLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public CrystalNammanTreePanoramaLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }
    public CrystalNammanTreePanoramaImage ReadImage(int index)
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
        return new CrystalNammanTreePanoramaImage(bitmap);
    }
    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class CrystalNammanTreePanoramaImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalNammanTreePanoramaImage(Bitmap bitmap) { Bitmap = bitmap; }
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
  $lib = [CrystalNammanTreePanoramaLib]::new($path)
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

if (-not (Test-Path $MapPath)) { throw "Missing map: $MapPath" }
$map = Read-Type1Map $MapPath

$cropY = [Math]::Max(0, $LaneMapY - $CellsNorthOfLane)
$endX = [Math]::Min($map.Width - 1, $CropX + $CropWCells - 1)
$endY = $LaneMapY

# Measure how far tall sprites stick above the crop top so we pad the canvas.
$maxOverhang = 0
for ($y = $cropY; $y -le $endY; $y++) {
  for ($x = $CropX; $x -le $endX; $x++) {
    $cell = Get-CellOffset $map $x $y
    $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
    $frontSlot = $map.FrontIndex[$cell]
    if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
    $image = Get-MapImage $frontSlot $frontFrame
    if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
    if ($image.Bitmap.Height -gt $MaxSpriteHeight) { continue }
    $anchorBottom = (($y - $cropY) + 1) * $CellHeight
    $top = $anchorBottom - $image.Bitmap.Height
    if ($top -lt 0) { $maxOverhang = [Math]::Max($maxOverhang, -$top) }
  }
}

$padTop = [Math]::Ceiling($maxOverhang / [double]$CellHeight) * $CellHeight
$width = ($endX - $CropX + 1) * $CellWidth
$height = (($endY - $cropY + 1) * $CellHeight) + $padTop
$lanePixelY = $padTop + (($LaneMapY - $cropY) + 1) * $CellHeight
$suggestedYOffset = -($lanePixelY - 32)

$bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor

  # Mirror Crystal MapRenderer: floor-sized fronts first (cell top-left), then tall
  # objects bottom-anchored. Skipping the 48x32 understory leaves visible holes /
  # "missing strips" between canopy columns.
  $drawnFloor = 0
  $drawnTall = 0
  $missFrames = New-Object 'System.Collections.Generic.HashSet[int]'

  for ($y = $cropY; $y -le $endY; $y++) {
    for ($x = $CropX; $x -le $endX; $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image) {
        [void]$missFrames.Add($frontFrame)
        continue
      }
      if (-not (Test-FloorSized $image.Bitmap)) { continue }
      $drawX = ($x - $CropX) * $CellWidth
      $drawY = $padTop + ($y - $cropY) * $CellHeight
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
      $drawnFloor++
    }
  }

  # Collect tall placements so we can patch columns that only have a floating
  # canopy (large transparent bottom pad, no full trunk tree in that column).
  $tallPlacements = New-Object System.Collections.Generic.List[object]

  for ($y = $cropY; $y -le $endY; $y++) {
    for ($x = $CropX; $x -le $endX; $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      if ($image.Bitmap.Height -gt $MaxSpriteHeight) { continue }
      $drawX = ($x - $CropX) * $CellWidth
      $drawY = $padTop + (($y - $cropY) + 1) * $CellHeight - $image.Bitmap.Height
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
      $drawnTall++

      $padBot = 0
      for ($py = $image.Bitmap.Height - 1; $py -ge 0; $py--) {
        $rowHit = $false
        for ($px = 0; $px -lt $image.Bitmap.Width; $px += 2) {
          if ($image.Bitmap.GetPixel($px, $py).A -gt 16) { $rowHit = $true; break }
        }
        if ($rowHit) { break }
        $padBot++
      }
      $tallPlacements.Add([pscustomobject]@{
        X = $x; Y = $y; Frame = $frontFrame; Slot = $frontSlot
        Height = $image.Bitmap.Height; PadBot = $padBot
        DrawX = $drawX; DrawY = $drawY
      }) | Out-Null
    }
  }

  # Patch "canopy-only" columns (e.g. map X=311 / Objects15 4842): sprite has ~164px
  # empty bottom and no full tree underneath, so a whole vertical strip is see-through.
  # Clone the nearest neighbouring full trunk tree into that column.
  $filledCols = New-Object 'System.Collections.Generic.HashSet[int]'
  $byCol = $tallPlacements | Group-Object X
  foreach ($group in $byCol) {
    $colX = [int]$group.Name
    $hasFull = $false
    $hasFloating = $false
    foreach ($p in $group.Group) {
      if ($p.PadBot -le 32 -and $p.Height -ge 200) { $hasFull = $true }
      if ($p.PadBot -ge 96) { $hasFloating = $true }
    }
    if (-not $hasFloating -or $hasFull) { continue }

    $donor = $null
    foreach ($delta in @(1, -1, 2, -2)) {
      $nx = $colX + $delta
      $nGroup = $byCol | Where-Object { [int]$_.Name -eq $nx }
      if ($null -eq $nGroup) { continue }
      $donor = $nGroup.Group |
        Where-Object { $_.PadBot -le 32 -and $_.Height -ge 400 } |
        Sort-Object Height -Descending |
        Select-Object -First 1
      if ($null -ne $donor) { break }
    }
    if ($null -eq $donor) { continue }

    $donorImage = Get-MapImage $donor.Slot $donor.Frame
    if ($null -eq $donorImage) { continue }
    $fillX = ($colX - $CropX) * $CellWidth
    $graphics.DrawImageUnscaled($donorImage.Bitmap, $fillX, $donor.DrawY)
    [void]$filledCols.Add($colX)
    Write-Host "Filled canopy-only column $colX with neighbor tree frame $($donor.Frame) from x=$($donor.X)"
  }

  Write-Host "Drew floor-sized=$drawnFloor tall=$drawnTall canopyFills=$($filledCols.Count)"
  if ($missFrames.Count -gt 0) {
    $missList = ($missFrames | Sort-Object) -join ', '
    Write-Host "MISS (out of range for Objects15.Lib): $missList"
    Write-Host "Those cells stay empty - Objects15.Lib only has frames 0..4960."
  }

  $outPath = Join-Path $PSScriptRoot $OutputPng
  New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null

  # Trim empty transparent rows at the top — oversized pad makes runtime offsets nonsense.
  $minY = $height
  for ($y = 0; $y -lt $height; $y++) {
    $hit = $false
    for ($x = 0; $x -lt $width; $x += 2) {
      if ($bitmap.GetPixel($x, $y).A -gt 8) { $hit = $true; break }
    }
    if ($hit) { $minY = $y; break }
  }
  $trimTop = [Math]::Max(0, $minY - 4)
  if ($trimTop -gt 0) {
    $trimmedH = $height - $trimTop
    $trimmed = [System.Drawing.Bitmap]::new($width, $trimmedH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $tg = [System.Drawing.Graphics]::FromImage($trimmed)
    try {
      $tg.Clear([System.Drawing.Color]::Transparent)
      $tg.DrawImage($bitmap, 0, 0, [System.Drawing.Rectangle]::new(0, $trimTop, $width, $trimmedH), [System.Drawing.GraphicsUnit]::Pixel)
    }
    finally { $tg.Dispose() }
    $bitmap.Dispose()
    $bitmap = $trimmed
    $height = $trimmedH
    $lanePixelY = $lanePixelY - $trimTop
    $suggestedYOffset = -($lanePixelY - 32)
  }

  $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $reviewDir = Join-Path $PSScriptRoot $ReviewRoot
  New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
  Copy-Item -LiteralPath $outPath -Destination (Join-Path $reviewDir (Split-Path $OutputPng -Leaf)) -Force

  Write-Host "Namman tree panorama: $outPath (${width}x${height}) trimTop=$trimTop"
  Write-Host "Crop ($CropX,$cropY)-($endX,$endY) padTop=$padTop lanePixelY=$lanePixelY"
  Write-Host "Suggested yOffsetFromBase: $suggestedYOffset"
  Write-Host "Loop width px: $width (use full-image edge repeat, NOT column mode)"
}
finally {
  $graphics.Dispose()
  $bitmap.Dispose()
  foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
  foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }
}
