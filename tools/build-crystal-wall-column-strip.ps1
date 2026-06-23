param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell01.map",
  [string]$OutputPng = "../public/mapedges/hell-cavern-1-wall-columns.png",
  [string]$ReviewRoot = "../tile-review/hell-cavern-1-wall-columns",
  [string]$ReviewTitle = "Hell Cavern wall columns",
  [int]$StartX = 12,
  [int]$LaneMapY = 45,
  [int]$MaxColumns = 64,
  # When FixedColumnStart >= 0, export exactly FixedColumnCount map columns (no open-lane scan).
  [int]$FixedColumnStart = -1,
  [int]$FixedColumnCount = 0,
  [int[]]$ExcludeMapX = @(),
  [string[]]$ExcludeCells = @(),
  [int]$CellsNorthOfLane = 9,
  [int]$CellsSouthScan = 4,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  # When true, omit floor back/middle/front floor slices — only tall wall sprites.
  [bool]$WallsOnly = $false,
  # When true, still draw floor slices in the open walk lane (default skips them for transparent overlay).
  [bool]$DrawOpenLaneFloor = $false,
  # When set, paint every cell with these Tiles.Lib back frames before walls (e.g. 3850-3854).
  [int[]]$BasicFloorFrames = @(),
  # Optional slot grid (same shape as zone tilePattern); indexes into BasicFloorFrames per map cell.
  [object[]]$BasicFloorPattern = @(),
  # Map-cell floor paint overrides: "x,y:backFrame" (Tiles.Lib), applied after basic floor fill.
  [string[]]$FloorCellOverrides = @()
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# Reuse corridor-edge lib via dot-source pattern
. {
  if (-not ("CrystalWallColumnLib" -as [type])) {
    Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
public sealed class CrystalWallColumnLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public CrystalWallColumnLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }
    public CrystalWallColumnImage ReadImage(int index)
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
        return new CrystalWallColumnImage(bitmap);
    }
    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class CrystalWallColumnImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalWallColumnImage(Bitmap bitmap) { Bitmap = bitmap; }
    public void Dispose() { Bitmap.Dispose(); }
}
"@
  }
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
  $lib = [CrystalWallColumnLib]::new($path)
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
  $y0 = $laneY - 1
  $y2 = $laneY + 1
  foreach ($y in @($y0, $laneY, $y2)) {
    if ($y -lt 0 -or $y -ge $map.Height) { continue }
    if (Test-TallWallCell $map $x $y) { return $false }
    $cell = Get-CellOffset $map $x $y
    if ($map.Back[$cell] -eq 0) { return $false }
  }
  return $true
}

function Get-ColumnSignature($map, [int]$x, [int]$laneY) {
  $parts = New-Object System.Collections.Generic.List[string]
  for ($y = [Math]::Max(0, $laneY - 10); $y -lt $laneY; $y++) {
    if (Test-ExcludedMapCell $x $y) { continue }
    $cell = Get-CellOffset $map $x $y
    $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
    $frontSlot = $map.FrontIndex[$cell]
    if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
    $image = Get-MapImage $frontSlot $frontFrame
    if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
    $parts.Add("$y`:$frontSlot`:$frontFrame")
  }
  return ($parts -join "|")
}

function Test-SkipFloorCell($map, [int]$x, [int]$y, [int]$laneY, [bool]$DrawOpenLaneFloor) {
  if ($DrawOpenLaneFloor) { return $false }
  if ($y -lt ($laneY - 1) -or $y -gt ($laneY + 1)) { return $false }
  return Test-OpenLaneColumn $map $x $laneY
}

function Register-ExcludedMapCell([string]$pair) {
  if ($pair -match '^\s*(\d+)\s*,\s*(\d+)\s*$') {
    $script:excludeCellSet["$($matches[1]),$($matches[2])"] = $true
  }
}

function Test-ExcludedMapCell([int]$x, [int]$y) {
  return $script:excludeCellSet.ContainsKey("${x},${y}")
}

$script:excludeCellSet = @{}
foreach ($pair in $ExcludeCells) { Register-ExcludedMapCell $pair }

$script:floorCellOverrideSet = @{}
foreach ($entry in $FloorCellOverrides) {
  if ($entry -match '^\s*(\d+)\s*,\s*(\d+)\s*:\s*(\d+)\s*$') {
    $script:floorCellOverrideSet["$($matches[1]),$($matches[2])"] = [int]$matches[3]
  }
}

function Get-FloorCellOverrideFrame([int]$x, [int]$y) {
  $key = "${x},${y}"
  if ($script:floorCellOverrideSet.ContainsKey($key)) {
    return $script:floorCellOverrideSet[$key]
  }
  return $null
}

function Test-FloorCellOverride([int]$x, [int]$y) {
  return $script:floorCellOverrideSet.ContainsKey("${x},${y}")
}

function Draw-BackFrameCellSlice($graphics, [int]$backFrame, [int]$x, [int]$y, [int]$drawY) {
  $image = Get-MapImage 0 (Get-VisibleBackFrame $backFrame)
  if ($null -eq $image) { return $false }
  $bitmap = $image.Bitmap
  if ($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) {
    $graphics.DrawImageUnscaled($bitmap, 0, $drawY)
    return $true
  }
  $ax = $x -band (-2)
  $ay = $y -band (-2)
  $srcX = 0
  $srcY = 0
  if ($bitmap.Width -ge ($CellWidth * 2) -and $bitmap.Height -ge ($CellHeight * 2)) {
    $srcX = ($x - $ax) * $CellWidth
    $srcY = ($y - $ay) * $CellHeight
  }
  if ($srcX + $CellWidth -gt $bitmap.Width -or $srcY + $CellHeight -gt $bitmap.Height) { return $false }
  $srcRect = [System.Drawing.Rectangle]::new($srcX, $srcY, $CellWidth, $CellHeight)
  $destRect = [System.Drawing.Rectangle]::new(0, $drawY, $CellWidth, $CellHeight)
  $graphics.DrawImage($bitmap, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  return $true
}

function Test-SpriteOverlapsFloorOverrideCell([int]$x, [int]$anchorY, [int]$spriteHeight, [int]$cropY, [int]$cropEndY) {
  if (Test-FloorCellOverride $x $anchorY) { return $true }
  $span = Get-SpriteMapYSpan $anchorY $spriteHeight $cropY $cropEndY
  for ($yCheck = $span.Top; $yCheck -le $span.Bottom; $yCheck++) {
    if (Test-FloorCellOverride $x $yCheck) { return $true }
  }
  return $false
}

function Apply-ColumnFloorCellOverrides($graphics, [int]$x, [int]$cropY, [int]$endY) {
  # Opaque cave-black (matches R01 void tiles); tile art 2957 has transparent pixels that
  # would let the scrolling red-cavern ground show through the overlay.
  $black = [Drawing.Color]::FromArgb(255, 8, 0, 0)
  $brush = New-Object Drawing.SolidBrush($black)
  try {
    for ($y = $cropY; $y -le $endY; $y++) {
      if (-not (Test-FloorCellOverride $x $y)) { continue }
      $drawY = ($y - $cropY) * $CellHeight
      $prevMode = $graphics.CompositingMode
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      try {
        $graphics.FillRectangle($brush, 0, $drawY, $CellWidth, $CellHeight)
      }
      finally {
        $graphics.CompositingMode = $prevMode
      }
    }
  }
  finally {
    $brush.Dispose()
  }
}

function Draw-BackCellSlice($graphics, $map, [int]$x, [int]$y, [int]$drawY) {
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
    $graphics.DrawImageUnscaled($bitmap, 0, $drawY)
    return
  }
  $srcX = ($x - $ax) * $CellWidth
  $srcY = ($y - $ay) * $CellHeight
  if ($srcX + $CellWidth -gt $bitmap.Width -or $srcY + $CellHeight -gt $bitmap.Height) { return }
  $srcRect = [System.Drawing.Rectangle]::new($srcX, $srcY, $CellWidth, $CellHeight)
  $destRect = [System.Drawing.Rectangle]::new(0, $drawY, $CellWidth, $CellHeight)
  $graphics.DrawImage($bitmap, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-BasicFloorSlice($graphics, [int]$backFrame, [int]$drawY) {
  $image = Get-MapImage 0 $backFrame
  if ($null -eq $image) { return $false }
  $bitmap = $image.Bitmap
  if ($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) {
    $graphics.DrawImageUnscaled($bitmap, 0, $drawY)
    return $true
  }
  $srcW = [Math]::Min($CellWidth, $bitmap.Width)
  $srcH = [Math]::Min($CellHeight, $bitmap.Height)
  $srcRect = [System.Drawing.Rectangle]::new(0, 0, $srcW, $srcH)
  $destRect = [System.Drawing.Rectangle]::new(0, $drawY, $CellWidth, $CellHeight)
  $graphics.DrawImage($bitmap, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  return $true
}

function Resolve-BasicFloorFrame([int]$x, [int]$y, [int[]]$basicFrames, $basicFloorPattern) {
  if ($basicFrames.Count -le 0) { return $null }
  $patternRows = @($basicFloorPattern)
  if ($patternRows.Count -gt 0) {
    $patternRow = @($patternRows[(($y % $patternRows.Count) + $patternRows.Count) % $patternRows.Count])
    $slot = [int]$patternRow[(($x % $patternRow.Count) + $patternRow.Count) % $patternRow.Count]
    return $basicFrames[(($slot % $basicFrames.Count) + $basicFrames.Count) % $basicFrames.Count]
  }
  return $basicFrames[(($x + $y) % $basicFrames.Count + $basicFrames.Count) % $basicFrames.Count]
}

function Fill-ColumnBasicFloor($graphics, [int]$x, [int]$cropY, [int]$endY, [int[]]$basicFrames, $basicFloorPattern) {
  if ($basicFrames.Count -le 0) { return $false }
  for ($y = $cropY; $y -le $endY; $y++) {
    if (Test-FloorCellOverride $x $y) { continue }
    $frame = Resolve-BasicFloorFrame $x $y $basicFrames $basicFloorPattern
    if ($null -eq $frame) { continue }
    $drawY = ($y - $cropY) * $CellHeight
    Draw-BackFrameCellSlice $graphics $frame $x $y $drawY | Out-Null
  }
  return $true
}

function Get-CorridorCropBounds($map, [int]$cropX, [int]$cropWCells, [int]$laneY, [int]$cellsNorth, [int]$cellsSouthScan) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $cropY = [Math]::Max(0, $laneY - $cellsNorth)
  $scanEndY = [Math]::Min($map.Height - 1, $laneY + $cellsSouthScan)
  $maxBottom = (($laneY - $cropY) + 2) * $CellHeight
  for ($y = $cropY; $y -le $scanEndY; $y++) {
    for ($x = $cropX; $x -le $endX; $x++) {
      if (Test-ExcludedMapCell $x $y) { continue }
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      $bottom = (($y - $cropY) + 1) * $CellHeight
      if ($bottom -gt $maxBottom) { $maxBottom = $bottom }
    }
  }
  $cropHCells = [Math]::Max($cellsNorth + 2, [Math]::Ceiling($maxBottom / [double]$CellHeight) + 1)
  return [pscustomobject]@{ CropY = $cropY; CropHCells = $cropHCells }
}

function Test-BackMacroBlockExcluded([int]$x, [int]$y) {
  $ax = $x -band (-2)
  $ay = $y -band (-2)
  foreach ($dx in @(0, 1)) {
    foreach ($dy in @(0, 1)) {
      if (Test-ExcludedMapCell ($ax + $dx) ($ay + $dy)) { return $true }
    }
  }
  return $false
}

function Get-SpriteMapYSpan([int]$anchorY, [int]$spriteHeight, [int]$cropY, [int]$cropEndY) {
  if ($spriteHeight -le 0) { return @{ Top = $anchorY; Bottom = $anchorY } }
  $cellsHigh = [Math]::Max(1, [Math]::Ceiling($spriteHeight / [double]$CellHeight))
  $top = [Math]::Max($cropY, $anchorY - $cellsHigh + 1)
  $bottom = [Math]::Min($cropEndY, $anchorY)
  return @{ Top = $top; Bottom = $bottom }
}

function Test-SpriteOverlapsExcludedCell([int]$x, [int]$anchorY, [int]$spriteHeight, [int]$cropY, [int]$cropEndY) {
  if (Test-ExcludedMapCell $x $anchorY) { return $true }
  $span = Get-SpriteMapYSpan $anchorY $spriteHeight $cropY $cropEndY
  for ($yCheck = $span.Top; $yCheck -le $span.Bottom; $yCheck++) {
    if (Test-ExcludedMapCell $x $yCheck) { return $true }
  }
  return $false
}

function Test-FloorSpriteOverlapsExcludedCell([int]$x, [int]$anchorY, [int]$spriteHeight, [int]$cropY, [int]$cropEndY) {
  if (Test-ExcludedMapCell $x $anchorY) { return $true }
  if ($spriteHeight -le $CellHeight) { return $false }
  $cellsHigh = [Math]::Max(1, [Math]::Ceiling($spriteHeight / [double]$CellHeight))
  $top = [Math]::Max($cropY, $anchorY - $cellsHigh + 1)
  for ($yCheck = $top; $yCheck -le $anchorY; $yCheck++) {
    if (Test-ExcludedMapCell $x $yCheck) { return $true }
  }
  return $false
}

function Render-WallColumn($map, [int]$x, [int]$cropY, [int]$cropHCells, [int]$laneY, [bool]$WallsOnly, [bool]$DrawOpenLaneFloor, [int[]]$BasicFloorFrames, $BasicFloorPattern) {
  $bitmapH = $cropHCells * $CellHeight
  $bitmap = [System.Drawing.Bitmap]::new($CellWidth, $bitmapH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $endY = $cropY + $cropHCells - 1
    $basicFloorBase = $BasicFloorFrames.Count -gt 0
    if ($basicFloorBase) {
      Fill-ColumnBasicFloor $graphics $x $cropY $endY $BasicFloorFrames $BasicFloorPattern | Out-Null
    }

    if (-not $WallsOnly) {
      for ($y = $cropY; $y -le $endY; $y++) {
        if (Test-ExcludedMapCell $x $y) { continue }
        if (Test-FloorCellOverride $x $y) { continue }
        $drawY = ($y - $cropY) * $CellHeight
        if (Test-SkipFloorCell $map $x $y $laneY $DrawOpenLaneFloor) { continue }
        $cell = Get-CellOffset $map $x $y
        if (-not $basicFloorBase) {
          if (-not (Test-BackMacroBlockExcluded $x $y)) {
            Draw-BackCellSlice $graphics $map $x $y $drawY
          }
        }
        $midFrame = $map.Middle[$cell] - 1
        if ($midFrame -ge 0) {
          $image = Get-MapImage 1 $midFrame
          if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
            if (-not (Test-FloorSpriteOverlapsExcludedCell $x $y $image.Bitmap.Height $cropY $endY)) {
              $graphics.DrawImageUnscaled($image.Bitmap, 0, $drawY)
            }
          }
        }
        $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
        $frontSlot = $map.FrontIndex[$cell]
        if ($frontFrame -ge 0 -and $frontSlot -ne -1 -and $frontSlot -ne 200) {
          $image = Get-MapImage $frontSlot $frontFrame
          if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
            if (-not (Test-FloorSpriteOverlapsExcludedCell $x $y $image.Bitmap.Height $cropY $endY)) {
              $graphics.DrawImageUnscaled($image.Bitmap, 0, $drawY)
            }
          }
        }
      }
    }
    for ($y = $cropY; $y -le $endY; $y++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      if (Test-SpriteOverlapsExcludedCell $x $y $image.Bitmap.Height $cropY $endY) { continue }
      if (Test-SpriteOverlapsFloorOverrideCell $x $y $image.Bitmap.Height $cropY $endY) { continue }
      $drawY = (($y - $cropY) + 1) * $CellHeight - $image.Bitmap.Height
      $graphics.DrawImageUnscaled($image.Bitmap, 0, $drawY)
    }
    Apply-ColumnFloorCellOverrides $graphics $x $cropY $endY
  }
  finally { $graphics.Dispose() }
  return $bitmap
}

function Find-TileablePeriod($signatures) {
  $len = $signatures.Count
  if ($len -lt 2) { return $len }
  for ($period = 1; $period -le [Math]::Min(24, $len); $period++) {
    $ok = $true
    for ($i = 0; $i -lt ($len - $period); $i++) {
      if ($signatures[$i] -ne $signatures[$i + $period]) { $ok = $false; break }
    }
    if ($ok -and ($signatures[$len - 1] -eq $signatures[$period - 1])) { return $period }
  }
  # Collapse to unique repeating cycle by deduping identical neighbors then take first N unique pattern
  $deduped = New-Object System.Collections.Generic.List[string]
  $last = $null
  foreach ($sig in $signatures) {
    if ($sig -ne $last) { $deduped.Add($sig); $last = $sig }
  }
  if ($deduped.Count -le 24) { return $deduped.Count }
  return [Math]::Min(24, $len)
}

$map = Read-Type1Map $MapPath
$columnXs = New-Object System.Collections.Generic.List[int]
$signatures = New-Object System.Collections.Generic.List[string]
if ($FixedColumnStart -ge 0 -and $FixedColumnCount -gt 0) {
  $endX = [Math]::Min($map.Width - 1, $FixedColumnStart + $FixedColumnCount - 1)
  $exclude = @{}
  foreach ($skipX in $ExcludeMapX) { $exclude[[string]$skipX] = $true }
  for ($x = $FixedColumnStart; $x -le $endX; $x++) {
    if ($exclude.ContainsKey([string]$x)) { continue }
    $columnXs.Add($x)
    $signatures.Add((Get-ColumnSignature $map $x $LaneMapY))
  }
  if ($columnXs.Count -lt 2) { throw "Need at least 2 columns after ExcludeMapX on $MapPath" }
  $period = $columnXs.Count
  $useCount = $columnXs.Count
}
else {
  for ($x = $StartX; $x -lt $map.Width; $x++) {
    if (-not (Test-OpenLaneColumn $map $x $LaneMapY)) {
      if ($columnXs.Count -gt 0) { break }
      continue
    }
    if ($columnXs.Count -ge $MaxColumns) { break }
    $columnXs.Add($x)
    $signatures.Add((Get-ColumnSignature $map $x $LaneMapY))
  }
  if ($columnXs.Count -lt 2) { throw "Need at least 2 open corridor columns from x=$StartX on $MapPath" }
  $period = Find-TileablePeriod @($signatures.ToArray())
  $useCount = [Math]::Min($period, $columnXs.Count)
}
$bounds = Get-CorridorCropBounds $map $columnXs[0] (($columnXs[$columnXs.Count - 1] - $columnXs[0]) + 1) $LaneMapY $CellsNorthOfLane $CellsSouthScan
$cropY = $bounds.CropY
$cropHCells = $bounds.CropHCells
$bitmapH = $cropHCells * $CellHeight

$sheet = [System.Drawing.Bitmap]::new($CellWidth * $useCount, $bitmapH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sheetGraphics = [System.Drawing.Graphics]::FromImage($sheet)
$columnBitmaps = New-Object System.Collections.Generic.List[System.Drawing.Bitmap]
try {
  $sheetGraphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  for ($col = 0; $col -lt $useCount; $col++) {
    $columnBitmaps.Add((Render-WallColumn $map $columnXs[$col] $cropY $cropHCells $LaneMapY $WallsOnly $DrawOpenLaneFloor $BasicFloorFrames $BasicFloorPattern))
  }
  for ($col = 0; $col -lt $useCount; $col++) {
    $sheetGraphics.DrawImageUnscaled($columnBitmaps[$col], $col * $CellWidth, 0)
  }
  $outPath = Join-Path $PSScriptRoot $OutputPng
  New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
  $sheet.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  foreach ($colBitmap in $columnBitmaps) { if ($null -ne $colBitmap) { $colBitmap.Dispose() } }
  $sheetGraphics.Dispose()
  $sheet.Dispose()
  foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
  foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }
}

$lanePixelY = (($LaneMapY - $cropY) + 1) * $CellHeight
$reviewDir = Join-Path $PSScriptRoot $ReviewRoot
New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
$outPath = Join-Path $PSScriptRoot $OutputPng
$reviewPng = Join-Path $reviewDir (Split-Path $OutputPng -Leaf)
if ($outPath -ne $reviewPng) {
  Copy-Item -LiteralPath $outPath -Destination $reviewPng -Force
}

$meta = [ordered]@{
  mapPath = $MapPath
  startX = $StartX
  fixedColumnStart = $FixedColumnStart
  fixedColumnCount = $FixedColumnCount
  excludeMapX = @($ExcludeMapX)
  excludeCells = @($ExcludeCells)
  drawOpenLaneFloor = $DrawOpenLaneFloor
  basicFloorFrames = @($BasicFloorFrames)
  basicFloorPatternRows = @($BasicFloorPattern).Count
  floorCellOverrides = @($FloorCellOverrides)
  floorCellOverrideCount = $script:floorCellOverrideSet.Count
  laneMapY = $LaneMapY
  columnCount = $useCount
  columnWidth = $CellWidth
  heightPx = $bitmapH
  lanePixelY = $lanePixelY
  tileablePeriod = $period
  scannedColumns = $columnXs.Count
  suggestedYOffsetFromBase = -($lanePixelY + 28)
  suggestedClipBottomOffsetFromBase = -30
  columnMapX = @($columnXs[0..($useCount - 1)])
  columnSignatures = @($signatures[0..($useCount - 1)])
}
$meta | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $reviewDir "meta.json") -Encoding UTF8

$html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>$ReviewTitle</title>
  <style>
    body { margin:0; background:#111; color:#eee; font:14px Segoe UI,sans-serif; padding:16px; }
    img { image-rendering:pixelated; background:repeating-conic-gradient(#2a2620 0% 25%,#1a1814 0% 50%) 50%/16px 16px; max-width:100%; }
    code { color:#e8c978; }
    .cols { display:flex; overflow:hidden; width:min(100%, $($CellWidth * $useCount * 3)px); margin-top:12px; }
    .cols img { width:$($CellWidth * $useCount)px; flex:0 0 auto; }
  </style>
</head>
<body>
  <h1>$ReviewTitle</h1>
  <p>Per-map-column wall strip ($useCount columns x $($CellWidth)px). Scrolls like floor tiles — each column is one map cell wide, so neighbours always match. Pattern repeats every <code>$useCount</code> columns ($($useCount * $CellWidth)px).</p>
  <p>Wall rule: front-layer sprites taller/wider than 48x32 floor slices. Lane column is transparent.</p>
  <p>Suggested <code>columnCount=$useCount</code>, <code>columnWidth=$CellWidth</code>, <code>yOffsetFromBase=$($meta.suggestedYOffsetFromBase)</code></p>
  <img src="$(Split-Path $OutputPng -Leaf)" alt="wall columns" />
  <p>Tiled preview (3 cycles):</p>
  <div class="cols">
    <img src="$(Split-Path $OutputPng -Leaf)" />
    <img src="$(Split-Path $OutputPng -Leaf)" />
    <img src="$(Split-Path $OutputPng -Leaf)" />
  </div>
</body>
</html>
"@
$html | Set-Content -LiteralPath (Join-Path $reviewDir "index.html") -Encoding UTF8
Write-Output ($meta | ConvertTo-Json -Depth 6)
