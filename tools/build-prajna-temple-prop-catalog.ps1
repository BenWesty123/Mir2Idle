param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("D2071.map", "D2072.map", "D2073.map", "D2074.map", "D2075.map", "D2076.map", "D2077.map"),
  [string]$OutputRoot = "../tile-review/prajna-temple-prop-catalog",
  [int]$MaxGroupCells = 16,
  [int]$MaxGroups = 500,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalStoneTempleCatalogLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalStoneTempleCatalogLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalStoneTempleCatalogLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalStoneTempleCatalogImage ReadImage(int index)
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
        finally
        {
            bitmap.UnlockBits(data);
        }

        return new CrystalStoneTempleCatalogImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalStoneTempleCatalogImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalStoneTempleCatalogImage(Bitmap bitmap, short offsetX, short offsetY)
    {
        Bitmap = bitmap;
        OffsetX = offsetX;
        OffsetY = offsetY;
    }

    public void Dispose()
    {
        Bitmap.Dispose();
    }
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

function Read-Type1Map($path, [string]$name) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if (-not ($bytes.Length -ge 54 -and $bytes[0] -eq 0x10 -and $bytes[2] -eq 0x61 -and $bytes[7] -eq 0x31 -and $bytes[14] -eq 0x31)) {
    throw "Only Type1 maps are supported: $path"
  }
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
  return [pscustomobject]@{ Name = $name; Width = $width; Height = $height; Back = $back; Middle = $middle; Front = $front; FrontIndex = $frontIndex }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Get-FrontObjectCell($map, [int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $map.Width -or $y -ge $map.Height) { return $null }
  $i = Get-CellOffset $map $x $y
  $frame = ($map.Front[$i] -band 0x7FFF) - 1
  $slot = $map.FrontIndex[$i]
  if ($frame -lt 0 -or $slot -lt 0 -or $slot -eq 200) { return $null }
  return [pscustomobject]@{ MapName = $map.Name; X = $x; Y = $y; Slot = $slot; Frame = $frame }
}

$loadedLibs = @{}
$loadedImages = @{}
$usefulImageCache = @{}

function Get-MapLib([int]$slot) {
  $key = [string]$slot
  if ($loadedLibs.ContainsKey($key)) { return $loadedLibs[$key] }
  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) { $loadedLibs[$key] = $null; return $null }
  $path = Join-Path (Resolve-Path $DataRoot) $relative
  if (-not (Test-Path $path)) { $loadedLibs[$key] = $null; return $null }
  $lib = [CrystalStoneTempleCatalogLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$frame) {
  if ($frame -lt 0) { return $null }
  $key = "$slot`:$frame"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }
  $lib = Get-MapLib $slot
  if ($null -eq $lib) { $loadedImages[$key] = $null; return $null }
  $image = $lib.ReadImage($frame)
  $loadedImages[$key] = $image
  return $image
}

function Test-UsefulObjectImage([int]$slot, [int]$frame) {
  $key = "$slot`:$frame"
  if ($usefulImageCache.ContainsKey($key)) { return $usefulImageCache[$key] }
  $image = Get-MapImage $slot $frame
  if ($null -eq $image) { $usefulImageCache[$key] = $false; return $false }
  $visible = 0; $bright = 0; $brightness = 0
  $stepX = [Math]::Max(1, [Math]::Floor($image.Bitmap.Width / 18))
  $stepY = [Math]::Max(1, [Math]::Floor($image.Bitmap.Height / 18))
  for ($y = 0; $y -lt $image.Bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $image.Bitmap.Width; $x += $stepX) {
      $pixel = $image.Bitmap.GetPixel($x, $y)
      if ($pixel.A -le 10) { continue }
      $visible++; $sum = [int]$pixel.R + [int]$pixel.G + [int]$pixel.B; $brightness += $sum
      if ($sum -gt 90) { $bright++ }
    }
  }
  $average = if ($visible -gt 0) { $brightness / $visible } else { 0 }
  $useful = $visible -gt 8 -and $average -gt 18 -and $bright -ge [Math]::Max(3, [Math]::Floor($visible * 0.025))
  $usefulImageCache[$key] = $useful
  return $useful
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
    ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

function Test-BitmapHasVisibleArt($bitmap) {
  $visible = 0; $brightness = 0
  $stepX = [Math]::Max(1, [Math]::Floor($bitmap.Width / 12))
  $stepY = [Math]::Max(1, [Math]::Floor($bitmap.Height / 12))
  for ($y = 0; $y -lt $bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $bitmap.Width; $x += $stepX) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -le 12) { continue }
      $visible++
      $brightness += [int]$pixel.R + [int]$pixel.G + [int]$pixel.B
    }
  }
  if ($visible -lt 6) { return $false }
  return ($brightness / $visible) -gt 24
}

function Get-GroupCategory($cells) {
  $images = @()
  foreach ($cell in $cells) {
    $image = Get-MapImage $cell.Slot $cell.Frame
    if ($null -ne $image) { $images += $image.Bitmap }
  }
  if ($images.Count -eq 0) { return "skip" }
  if ($cells.Count -gt 1) {
    $allFloorSized = $true
    foreach ($bitmap in $images) {
      if (-not (Test-FloorSized $bitmap)) { $allFloorSized = $false; break }
    }
    if ($allFloorSized) { return "floor-slice" }
    return "assembly"
  }
  $bitmap = $images[0]
  if (Test-FloorSized $bitmap) { return "floor-slice" }
  if ($bitmap.Height -ge 120) { return "tall-single" }
  if ($bitmap.Width -le 64 -and $bitmap.Height -le 80) { return "small-bit" }
  return "other"
}

function Test-IncludeDecorationGroup($cells) {
  $category = Get-GroupCategory $cells
  return $category -ne "skip" -and $category -ne "floor-slice" -and $category -ne "small-bit"
}

function New-ObjectCellTable($map) {
  $table = @{}
  for ($x = 0; $x -lt $map.Width; $x++) {
    for ($y = 0; $y -lt $map.Height; $y++) {
      $cell = Get-FrontObjectCell $map $x $y
      if ($null -eq $cell) { continue }
      if (-not (Test-UsefulObjectImage $cell.Slot $cell.Frame)) { continue }
      $table["$x,$y"] = $cell
    }
  }
  return $table
}

function Get-ConnectedComponents($map, $cellTable) {
  $visited = @{}
  $components = New-Object System.Collections.Generic.List[object]
  $offsets = @(@(1, 0), @(-1, 0), @(0, 1), @(0, -1))
  foreach ($key in @($cellTable.Keys)) {
    if ($visited.ContainsKey($key)) { continue }
    $queue = New-Object System.Collections.Generic.Queue[string]
    $component = New-Object System.Collections.Generic.List[object]
    $visited[$key] = $true
    $queue.Enqueue($key)
    while ($queue.Count -gt 0) {
      $currentKey = $queue.Dequeue()
      $cell = $cellTable[$currentKey]
      $component.Add($cell)
      foreach ($offset in $offsets) {
        $nx = $cell.X + $offset[0]; $ny = $cell.Y + $offset[1]
        $nextKey = "$nx,$ny"
        if ($visited.ContainsKey($nextKey) -or -not $cellTable.ContainsKey($nextKey)) { continue }
        $visited[$nextKey] = $true
        $queue.Enqueue($nextKey)
      }
    }
    $components.Add([pscustomobject]@{ Map = $map; Cells = @($component.ToArray()) })
  }
  return @($components.ToArray())
}

function Get-ComponentSignature($cells) {
  $minX = ($cells | Measure-Object -Property X -Minimum).Minimum
  $minY = ($cells | Measure-Object -Property Y -Minimum).Minimum
  @($cells | Sort-Object -Property Y, X, Slot, Frame | ForEach-Object { "$($_.X - $minX),$($_.Y - $minY),$($_.Slot):$($_.Frame)" }) -join "|"
}

function Get-FrameListText($cells) {
  @($cells | Sort-Object -Property Y, X, Slot, Frame | ForEach-Object { "$($_.Slot):$($_.Frame)" }) -join ", "
}

function Get-LibLabel([int]$slot) {
  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) { return "slot $slot" }
  return [System.IO.Path]::GetFileNameWithoutExtension($relative)
}

function Render-ObjectAssembly($cells, [string]$path) {
  $minX = ($cells | Measure-Object -Property X -Minimum).Minimum
  $minY = ($cells | Measure-Object -Property Y -Minimum).Minimum
  $draws = New-Object System.Collections.Generic.List[object]
  $left = 0; $top = 0; $right = 1; $bottom = 1; $first = $true
  foreach ($cell in $cells) {
    $image = Get-MapImage $cell.Slot $cell.Frame
    if ($null -eq $image) { continue }
    $x = ($cell.X - $minX) * $CellWidth
    $y = (($cell.Y - $minY) + 1) * $CellHeight - $image.Bitmap.Height
    if ($first) {
      $left = $x; $top = $y; $right = $x + $image.Bitmap.Width; $bottom = $y + $image.Bitmap.Height; $first = $false
    } else {
      $left = [Math]::Min($left, $x); $top = [Math]::Min($top, $y)
      $right = [Math]::Max($right, $x + $image.Bitmap.Width); $bottom = [Math]::Max($bottom, $y + $image.Bitmap.Height)
    }
    $draws.Add([pscustomobject]@{ Image = $image; X = $x; Y = $y; Cell = $cell })
  }
  if ($draws.Count -eq 0) { return $null }
  $pad = 12
  $width = [Math]::Max(1, [Math]::Ceiling($right - $left + ($pad * 2)))
  $height = [Math]::Max(1, [Math]::Ceiling($bottom - $top + ($pad * 2)))
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    foreach ($draw in $draws) {
      $graphics.DrawImageUnscaled($draw.Image.Bitmap, [Math]::Round($draw.X - $left + $pad), [Math]::Round($draw.Y - $top + $pad))
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    if (-not (Test-BitmapHasVisibleArt $bitmap)) { return $null }
  }
  finally {
    $graphics.Dispose(); $bitmap.Dispose()
  }
  return [pscustomobject]@{ Width = $width; Height = $height; Draws = @($draws.ToArray()) }
}

function Render-PartStrip($draws, [string]$path) {
  if ($draws.Count -eq 0) { return $null }
  $slotPad = 10
  $slots = @()
  $totalWidth = $slotPad
  $maxHeight = 1
  foreach ($draw in $draws) {
    $w = $draw.Image.Bitmap.Width + 16
    $h = $draw.Image.Bitmap.Height + 28
    $slots += [pscustomobject]@{ Draw = $draw; SlotWidth = $w; SlotHeight = $h }
    $totalWidth += $w + $slotPad
    $maxHeight = [Math]::Max($maxHeight, $h)
  }
  $bitmap = [System.Drawing.Bitmap]::new($totalWidth, $maxHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 28, 26, 22))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $x = $slotPad
    foreach ($slot in $slots) {
      $draw = $slot.Draw
      $img = $draw.Image.Bitmap
      $baseY = $maxHeight - 8 - $img.Height
      $graphics.DrawImageUnscaled($img, $x + 8, $baseY)
      $x += $slot.SlotWidth + $slotPad
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose(); $bitmap.Dispose()
  }
  return [pscustomobject]@{ Width = $bitmap.Width; Height = $bitmap.Height }
}

function Get-VisibleBackFrame([int]$backFrame) {
  # Prajna Temple maps store 1950-1954 on the back layer; visible floor art is 3100-3104.
  if ($backFrame -ge 1950 -and $backFrame -le 1954) { return 3100 + ($backFrame - 1950) }
  if ($backFrame -ge 3100 -and $backFrame -le 3104) { return $backFrame }
  return $backFrame
}

function Draw-FloorLayers($graphics, $map, [int]$cropX, [int]$cropY, [int]$cropWCells, [int]$cropHCells) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $endY = [Math]::Min($map.Height - 1, $cropY + $cropHCells - 1)
  for ($y = $cropY; $y -le $endY; $y++) {
    for ($x = $cropX; $x -le $endX; $x++) {
      $cellIndex = Get-CellOffset $map $x $y
      $drawX = ($x - $cropX) * $CellWidth
      $drawY = ($y - $cropY) * $CellHeight
      if (($x -band 1) -eq 0 -and ($y -band 1) -eq 0) {
        $backImage = $map.Back[$cellIndex]
        if ($backImage -ne 0) {
          $backFrame = Get-VisibleBackFrame (($backImage -band 0x1FFFFFFF) - 1)
          $image = Get-MapImage 0 $backFrame
          if ($null -ne $image) { $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY) }
        }
      }
      $middleFrame = $map.Middle[$cellIndex] - 1
      if ($middleFrame -ge 0) {
        $image = Get-MapImage 1 $middleFrame
        if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) { $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY) }
      }
    }
  }
}

function Draw-TallFrontObjects($graphics, $map, [int]$cropX, [int]$cropY, [int]$cropWCells, [int]$cropHCells, $highlightCells) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $endY = [Math]::Min($map.Height - 1, $cropY + $cropHCells - 1)
  for ($y = $cropY; $y -le $endY; $y++) {
    for ($x = $cropX; $x -le $endX; $x++) {
      $cellIndex = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cellIndex] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cellIndex]
      if ($frontFrame -lt 0 -or $frontSlot -lt 0 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or -not (Test-UsefulObjectImage $frontSlot $frontFrame)) { continue }
      if (Test-FloorSized $image.Bitmap) { continue }
      $drawX = ($x - $cropX) * $CellWidth
      $drawY = (($y - $cropY) + 1) * $CellHeight - $image.Bitmap.Height
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
    }
  }
}

function Render-InMapPreview($component, [string]$path) {
  $map = $component.Map
  $cells = $component.Cells
  $minX = [Math]::Max(0, (($cells | Measure-Object -Property X -Minimum).Minimum) - 3)
  $maxX = [Math]::Min($map.Width - 1, (($cells | Measure-Object -Property X -Maximum).Maximum) + 3)
  $minY = [Math]::Max(0, (($cells | Measure-Object -Property Y -Minimum).Minimum) - 4)
  $maxY = [Math]::Min($map.Height - 1, (($cells | Measure-Object -Property Y -Maximum).Maximum) + 4)
  $cropWCells = $maxX - $minX + 1
  $cropHCells = $maxY - $minY + 1
  $bitmap = [System.Drawing.Bitmap]::new($cropWCells * $CellWidth, $cropHCells * $CellHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 42, 36, 30))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    Draw-FloorLayers $graphics $map $minX $minY $cropWCells $cropHCells
    Draw-TallFrontObjects $graphics $map $minX $minY $cropWCells $cropHCells $cells
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(200, 120, 220, 120), 2)
    try {
      foreach ($cell in $cells) {
        $graphics.DrawRectangle($pen, (($cell.X - $minX) * $CellWidth) + 1, (($cell.Y - $minY) * $CellHeight) + 1, $CellWidth - 2, $CellHeight - 2)
      }
    }
    finally { $pen.Dispose() }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose(); $bitmap.Dispose()
  }
  return [pscustomobject]@{ Width = $bitmap.Width; Height = $bitmap.Height }
}

function ConvertTo-HtmlText([string]$value) { return [System.Net.WebUtility]::HtmlEncode($value) }

$maps = foreach ($name in $MapNames) {
  $path = Join-Path $MapRoot $name
  if (-not (Test-Path $path)) { Write-Warning "Skipping missing map: $path"; continue }
  Read-Type1Map $path $name
}

$groupCounts = @{}
$largeComponentCount = 0
$skippedFloorCount = 0

foreach ($map in $maps) {
  $cellTable = New-ObjectCellTable $map
  foreach ($component in (Get-ConnectedComponents $map $cellTable)) {
    if ($component.Cells.Count -gt $MaxGroupCells) { $largeComponentCount++; continue }
    if (-not (Test-IncludeDecorationGroup $component.Cells)) { $skippedFloorCount++; continue }
    $signature = Get-ComponentSignature $component.Cells
    if (-not $groupCounts.ContainsKey($signature)) {
      $groupCounts[$signature] = [pscustomobject]@{
        Signature = $signature
        Count = 0
        Cells = $component.Cells
        Map = $component.Map
        FirstMap = $component.Map.Name
        Frames = Get-FrameListText $component.Cells
        Category = (Get-GroupCategory $component.Cells)
      }
    }
    $groupCounts[$signature].Count++
  }
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$assemblyRoot = Join-Path $outRoot "assemblies"
$partsRoot = Join-Path $outRoot "parts"
$previewRoot = Join-Path $outRoot "in-map"
New-Item -ItemType Directory -Force -Path $assemblyRoot, $partsRoot, $previewRoot | Out-Null

$renderedGroups = New-Object System.Collections.Generic.List[object]
$groupIndex = 1
foreach ($entry in @($groupCounts.Values | Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = { if ($_.Category -eq "assembly") { 0 } elseif ($_.Category -eq "tall-single") { 1 } else { 2 } } }, @{ Expression = { $_.Cells.Count }; Descending = $true } | Select-Object -First $MaxGroups)) {
  $assemblyFile = "assemblies/assembly_{0:D4}.png" -f $groupIndex
  $partsFile = "parts/parts_{0:D4}.png" -f $groupIndex
  $previewFile = "in-map/preview_{0:D4}.png" -f $groupIndex
  $assembly = Render-ObjectAssembly $entry.Cells (Join-Path $outRoot $assemblyFile)
  if ($null -eq $assembly) { continue }
  $partsSize = Render-PartStrip $assembly.Draws (Join-Path $outRoot $partsFile)
  $previewSize = Render-InMapPreview ([pscustomobject]@{ Map = $entry.Map; Cells = $entry.Cells }) (Join-Path $outRoot $previewFile)
  $partLabels = @($assembly.Draws | ForEach-Object {
    $lib = Get-LibLabel $_.Cell.Slot
    "$lib`:$($_.Cell.Frame) @($($_.Cell.X - ($entry.Cells | Measure-Object X -Minimum).Minimum),$($_.Cell.Y - ($entry.Cells | Measure-Object Y -Minimum).Minimum))"
  })
  $renderedGroups.Add([pscustomobject]@{
    Number = $groupIndex
    AssemblyFile = $assemblyFile
    PartsFile = $partsFile
    PreviewFile = $previewFile
    Width = $assembly.Width
    Height = $assembly.Height
    PartsWidth = $partsSize.Width
    PartsHeight = $partsSize.Height
    PreviewWidth = $previewSize.Width
    PreviewHeight = $previewSize.Height
    Count = $entry.Count
    CellCount = $entry.Cells.Count
    Category = $entry.Category
    FirstMap = $entry.FirstMap
    Frames = $entry.Frames
    PartLabels = ($partLabels -join " | ")
  })
  $groupIndex++
}

$metadata = [ordered]@{
  title = "Prajna Temple Prop Catalog"
  sourceMaps = @($maps | ForEach-Object { $_.Name })
  maxGroupCells = $MaxGroupCells
  largeComponentCount = $largeComponentCount
  skippedFloorSlices = $skippedFloorCount
  groups = @($renderedGroups.ToArray())
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outRoot "catalog.json") -Encoding UTF8

function Build-CategorySection([string]$title, [string]$description, [string]$filterKey, $items) {
  if ($items.Count -eq 0) { return "" }
  $cards = foreach ($item in $items) {
    $frames = ConvertTo-HtmlText $item.Frames
    $parts = ConvertTo-HtmlText $item.PartLabels
    $category = ConvertTo-HtmlText $item.Category
    @"
    <article class="card" data-category="$category" data-cells="$($item.CellCount)">
      <div class="card-head">
        <strong>#$($item.Number)</strong>
        <span class="badge">$category</span>
        <span class="badge muted">used $($item.Count)x</span>
        <span class="badge muted">$($item.CellCount) part(s)</span>
      </div>
      <p class="hint">Sprites below are the exact Crystal frames placed together as in the maps.</p>
      <figure class="assembly">
        <img src="$($item.AssemblyFile)" alt="Assembly $($item.Number)" style="--w:$($item.Width);--h:$($item.Height)" loading="lazy" />
        <figcaption>Full decoration (transparent)</figcaption>
      </figure>
      <figure class="parts">
        <img src="$($item.PartsFile)" alt="Parts $($item.Number)" style="--w:$($item.PartsWidth);--h:$($item.PartsHeight)" loading="lazy" />
        <figcaption>Each sprite in the assembly</figcaption>
      </figure>
      <figure class="preview">
        <img src="$($item.PreviewFile)" alt="In-map $($item.Number)" style="--w:$($item.PreviewWidth);--h:$($item.PreviewHeight)" loading="lazy" />
        <figcaption>How it sits on the real dungeon floor</figcaption>
      </figure>
      <div class="meta">
        <span>Maps: $($item.Count)x placements, first seen <code>$($item.FirstMap)</code></span>
        <span>Frames: <code>$frames</code></span>
        <span>Parts: $parts</span>
      </div>
    </article>
"@
  }
  @"
      <section class="section" data-section="$filterKey">
        <h2>$title</h2>
        <p class="section-note">$description</p>
        <div class="grid">$($cards -join "`n")</div>
      </section>
"@
}

$assemblyItems = @($renderedGroups | Where-Object { $_.Category -eq "assembly" })
$tallItems = @($renderedGroups | Where-Object { $_.Category -eq "tall-single" })
$otherItems = @($renderedGroups | Where-Object { $_.Category -notin @("assembly", "tall-single") })

$sections = @(
  (Build-CategorySection "Multi-part decorations" "Connected placements: every sprite that touches on the map is grouped into one assembly. These are the props you want for idle lanes." "assembly" $assemblyItems)
  (Build-CategorySection "Single tall props" "One map cell, but tall (pillars, torches, statues). Safe to use alone as lane decorations." "tall" $tallItems)
  (Build-CategorySection "Other useful props" "Unusual shapes that are not floor slices." "other" $otherItems)
) -join "`n"

$mapList = ConvertTo-HtmlText ($metadata.sourceMaps -join ", ")
$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prajna Temple Prop Catalog</title>
    <style>
      :root { color-scheme: dark; --zoom: 1; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #12110f; color: #ece6d8; font: 13px/1.45 Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 5; background: #1c1914; border-bottom: 1px solid #4a3f2c; padding: 14px 18px; }
      h1 { margin: 0 0 6px; font-size: 22px; color: #f4dfb0; }
      h2 { margin: 0 0 8px; font-size: 18px; color: #f0d89a; }
      p { margin: 0; color: #b9ad94; max-width: 920px; }
      .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 12px; }
      .controls label { display: flex; gap: 8px; align-items: center; color: #ddd; }
      .controls input[type=range] { width: 180px; }
      .filter-btn { border: 1px solid #5a4c34; background: #2a241b; color: #f2e5c8; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
      .filter-btn.active { background: #5c4a28; border-color: #c9a962; }
      main { padding: 8px 0 28px; }
      .section { padding: 8px 14px 0; }
      .section-note { margin: 0 0 12px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
      .card { border: 1px solid #3b3224; background: #1a1712; padding: 12px; display: grid; gap: 10px; }
      .card-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #3a3020; color: #f6e7bc; }
      .badge.muted { background: #26221b; color: #b7aa90; }
      .hint { margin: 0; font-size: 12px; color: #9f947d; }
      figure { margin: 0; display: grid; gap: 5px; }
      figcaption { font-size: 11px; color: #8f846c; }
      .assembly img, .parts img, .preview img {
        width: calc(var(--w) * 1px * var(--zoom));
        height: calc(var(--h) * 1px * var(--zoom));
        image-rendering: pixelated;
        object-fit: contain;
        max-width: 100%;
      }
      .assembly img { background: repeating-conic-gradient(#2a2620 0% 25%, #1a1814 0% 50%) 50% / 16px 16px; }
      .parts img { background: #1c1915; border: 1px solid #333027; }
      .preview img { background: #0e0d0b; border: 1px solid #333027; }
      .meta { display: grid; gap: 4px; font-size: 12px; color: #b5a992; }
      code { color: #e8c978; font-size: 11px; word-break: break-all; }
      .stats { margin-top: 8px; color: #a89a7e; font-size: 12px; }
      .hidden { display: none !important; }
    </style>
  </head>
  <body>
    <header>
      <h1>Prajna Temple Prop Catalog</h1>
      <p>From Crystal maps <code>$mapList</code>. Each card is a <strong>complete decoration</strong>: assembled sprite, labeled parts, and in-map preview. Floor tile slices and random 1-cell debris are excluded.</p>
      <p class="stats">$($renderedGroups.Count) decorations cataloged · $($skippedFloorCount) floor-slice groups skipped · $largeComponentCount oversized clusters skipped</p>
      <div class="controls">
        <label>Zoom <input id="zoom" type="range" min="0.5" max="2.5" step="0.25" value="1" /><output id="zoomValue">1x</output></label>
        <button type="button" class="filter-btn active" data-filter="all">All</button>
        <button type="button" class="filter-btn" data-filter="assembly">Multi-part</button>
        <button type="button" class="filter-btn" data-filter="tall">Tall single</button>
        <button type="button" class="filter-btn" data-filter="other">Other</button>
      </div>
    </header>
    <main>
$sections
    </main>
    <script>
      const slider = document.querySelector("#zoom");
      const output = document.querySelector("#zoomValue");
      function applyZoom() {
        document.documentElement.style.setProperty("--zoom", slider.value);
        output.value = slider.value + "x";
      }
      slider.addEventListener("input", applyZoom);
      applyZoom();

      const buttons = [...document.querySelectorAll(".filter-btn")];
      const sections = [...document.querySelectorAll(".section")];
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          buttons.forEach((entry) => entry.classList.toggle("active", entry === button));
          const filter = button.dataset.filter;
          sections.forEach((section) => {
            const show = filter === "all" || section.dataset.section === filter;
            section.classList.toggle("hidden", !show);
          });
        });
      });
    </script>
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Encoding UTF8

try {
  foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
  foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }
} catch {
  Write-Warning $_.Exception.Message
}

Write-Output "Prajna Temple catalog: $($renderedGroups.Count) decorations"
Write-Output "Open: $(Resolve-Path (Join-Path $outRoot 'index.html'))"
