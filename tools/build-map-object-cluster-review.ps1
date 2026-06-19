param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("D021.map", "D022.map", "D023.map", "D024.map"),
  [string]$OutputRoot = "../tile-review/wooma-temple-object-picker",
  [int]$MaxGroupCells = 12,
  [int]$MaxGroups = 240,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalObjectClusterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalObjectClusterLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalObjectClusterLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalObjectClusterImage ReadImage(int index)
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

        return new CrystalObjectClusterImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalObjectClusterImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalObjectClusterImage(Bitmap bitmap, short offsetX, short offsetY)
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
  if (-not (Test-Path $path)) { throw "Map file not found: $path" }
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

  return [pscustomobject]@{
    Name = $name
    Width = $width
    Height = $height
    Back = $back
    Middle = $middle
    Front = $front
    FrontIndex = $frontIndex
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) {
  return ($x * $map.Height) + $y
}

function Get-FrontObjectCell($map, [int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $map.Width -or $y -ge $map.Height) { return $null }
  $i = Get-CellOffset $map $x $y
  $frame = ($map.Front[$i] -band 0x7FFF) - 1
  $slot = $map.FrontIndex[$i]
  if ($frame -lt 0 -or $slot -lt 0 -or $slot -eq 200) { return $null }
  return [pscustomobject]@{
    MapName = $map.Name
    X = $x
    Y = $y
    Slot = $slot
    Frame = $frame
  }
}

$loadedLibs = @{}
$loadedImages = @{}
$usefulImageCache = @{}

function Get-MapLib([int]$slot) {
  $key = [string]$slot
  if ($loadedLibs.ContainsKey($key)) { return $loadedLibs[$key] }

  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) {
    $loadedLibs[$key] = $null
    return $null
  }

  $path = Join-Path (Resolve-Path $DataRoot) $relative
  if (-not (Test-Path $path)) {
    $loadedLibs[$key] = $null
    return $null
  }

  $lib = [CrystalObjectClusterLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$frame) {
  if ($frame -lt 0) { return $null }
  $key = "$slot`:$frame"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }

  $lib = Get-MapLib $slot
  if ($null -eq $lib) {
    $loadedImages[$key] = $null
    return $null
  }

  $image = $lib.ReadImage($frame)
  $loadedImages[$key] = $image
  return $image
}

function Test-UsefulObjectImage([int]$slot, [int]$frame) {
  $key = "$slot`:$frame"
  if ($usefulImageCache.ContainsKey($key)) { return $usefulImageCache[$key] }
  $image = Get-MapImage $slot $frame
  if ($null -eq $image) {
    $usefulImageCache[$key] = $false
    return $false
  }

  $visible = 0
  $bright = 0
  $brightness = 0
  $stepX = [Math]::Max(1, [Math]::Floor($image.Bitmap.Width / 18))
  $stepY = [Math]::Max(1, [Math]::Floor($image.Bitmap.Height / 18))
  for ($y = 0; $y -lt $image.Bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $image.Bitmap.Width; $x += $stepX) {
      $pixel = $image.Bitmap.GetPixel($x, $y)
      if ($pixel.A -le 10) { continue }
      $visible++
      $sum = [int]$pixel.R + [int]$pixel.G + [int]$pixel.B
      $brightness += $sum
      if ($sum -gt 90) { $bright++ }
    }
  }

  $average = if ($visible -gt 0) { $brightness / $visible } else { 0 }
  $useful = $visible -gt 8 -and $average -gt 18 -and $bright -ge [Math]::Max(3, [Math]::Floor($visible * 0.025))
  $usefulImageCache[$key] = $useful
  return $useful
}

function Add-FrameCount($table, [string]$key, $cell) {
  if (-not $table.ContainsKey($key)) {
    $table[$key] = [pscustomobject]@{
      Slot = $cell.Slot
      Frame = $cell.Frame
      Count = 0
      Maps = @{}
    }
  }
  $table[$key].Count++
  if (-not $table[$key].Maps.ContainsKey($cell.MapName)) { $table[$key].Maps[$cell.MapName] = 0 }
  $table[$key].Maps[$cell.MapName]++
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
        $nx = $cell.X + $offset[0]
        $ny = $cell.Y + $offset[1]
        $nextKey = "$nx,$ny"
        if ($visited.ContainsKey($nextKey) -or -not $cellTable.ContainsKey($nextKey)) { continue }
        $visited[$nextKey] = $true
        $queue.Enqueue($nextKey)
      }
    }

    $components.Add([pscustomobject]@{
      Map = $map
      Cells = @($component.ToArray())
    })
  }

  return @($components.ToArray())
}

function Get-ComponentSignature($cells) {
  $minX = ($cells | Measure-Object -Property X -Minimum).Minimum
  $minY = ($cells | Measure-Object -Property Y -Minimum).Minimum
  @($cells |
    Sort-Object -Property Y, X, Slot, Frame |
    ForEach-Object { "$($_.X - $minX),$($_.Y - $minY),$($_.Slot):$($_.Frame)" }) -join "|"
}

function Get-FrameListText($cells) {
  @($cells |
    Sort-Object -Property Y, X, Slot, Frame |
    ForEach-Object { "$($_.Slot):$($_.Frame)" }) -join ", "
}

function Render-ObjectOnly($cells, [string]$path) {
  $minX = ($cells | Measure-Object -Property X -Minimum).Minimum
  $minY = ($cells | Measure-Object -Property Y -Minimum).Minimum
  $draws = New-Object System.Collections.Generic.List[object]
  $left = 0
  $top = 0
  $right = 1
  $bottom = 1
  $first = $true

  foreach ($cell in $cells) {
    $image = Get-MapImage $cell.Slot $cell.Frame
    if ($null -eq $image) { continue }
    $x = ($cell.X - $minX) * $CellWidth
    $y = (($cell.Y - $minY) + 1) * $CellHeight - $image.Bitmap.Height
    if ($first) {
      $left = $x
      $top = $y
      $right = $x + $image.Bitmap.Width
      $bottom = $y + $image.Bitmap.Height
      $first = $false
    } else {
      $left = [Math]::Min($left, $x)
      $top = [Math]::Min($top, $y)
      $right = [Math]::Max($right, $x + $image.Bitmap.Width)
      $bottom = [Math]::Max($bottom, $y + $image.Bitmap.Height)
    }
    $draws.Add([pscustomobject]@{ Image = $image; X = $x; Y = $y })
  }

  if ($draws.Count -eq 0) { return $null }
  $pad = 8
  $width = [Math]::Max(1, [Math]::Ceiling($right - $left + ($pad * 2)))
  $height = [Math]::Max(1, [Math]::Ceiling($bottom - $top + ($pad * 2)))
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    foreach ($draw in $draws) {
      $graphics.DrawImageUnscaled($draw.Image.Bitmap, [Math]::Round($draw.X - $left + $pad), [Math]::Round($draw.Y - $top + $pad))
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  return [pscustomobject]@{ Width = $width; Height = $height }
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
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
          $backFrame = ($backImage -band 0x1FFFFFFF) - 1
          $image = Get-MapImage 0 $backFrame
          if ($null -ne $image) { $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY) }
        }
      }

      $middleFrame = $map.Middle[$cellIndex] - 1
      if ($middleFrame -ge 0) {
        $image = Get-MapImage 1 $middleFrame
        if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) { $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY) }
      }

      $frontFrame = ($map.Front[$cellIndex] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cellIndex]
      if ($frontFrame -ge 0 -and $frontSlot -ge 0 -and $frontSlot -ne 200) {
        $image = Get-MapImage $frontSlot $frontFrame
        if ($null -ne $image -and (Test-UsefulObjectImage $frontSlot $frontFrame) -and (Test-FloorSized $image.Bitmap)) {
          $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
        }
      }
    }
  }
}

function Draw-TallFrontObjects($graphics, $map, [int]$cropX, [int]$cropY, [int]$cropWCells, [int]$cropHCells) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $endY = [Math]::Min($map.Height - 1, $cropY + $cropHCells - 1)
  for ($y = $cropY; $y -le $endY; $y++) {
    for ($x = $cropX; $x -le $endX; $x++) {
      $cellIndex = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cellIndex] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cellIndex]
      if ($frontFrame -lt 0 -or $frontSlot -lt 0 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if (-not (Test-UsefulObjectImage $frontSlot $frontFrame)) { continue }
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      $drawX = ($x - $cropX) * $CellWidth
      $drawY = (($y - $cropY) + 1) * $CellHeight - $image.Bitmap.Height
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
    }
  }
}

function Render-ContextCrop($component, [string]$path) {
  $map = $component.Map
  $cells = $component.Cells
  $minX = [Math]::Max(0, (($cells | Measure-Object -Property X -Minimum).Minimum) - 4)
  $maxX = [Math]::Min($map.Width - 1, (($cells | Measure-Object -Property X -Maximum).Maximum) + 4)
  $minY = [Math]::Max(0, (($cells | Measure-Object -Property Y -Minimum).Minimum) - 5)
  $maxY = [Math]::Min($map.Height - 1, (($cells | Measure-Object -Property Y -Maximum).Maximum) + 5)
  $cropWCells = $maxX - $minX + 1
  $cropHCells = $maxY - $minY + 1

  $bitmap = [System.Drawing.Bitmap]::new($cropWCells * $CellWidth, $cropHCells * $CellHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(18, 15, 12))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    Draw-FloorLayers $graphics $map $minX $minY $cropWCells $cropHCells
    Draw-TallFrontObjects $graphics $map $minX $minY $cropWCells $cropHCells
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 243, 205, 116), 2)
    try {
      foreach ($cell in $cells) {
        $graphics.DrawRectangle($pen, (($cell.X - $minX) * $CellWidth) + 1, (($cell.Y - $minY) * $CellHeight) + 1, $CellWidth - 2, $CellHeight - 2)
      }
    }
    finally {
      $pen.Dispose()
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  return [pscustomobject]@{ Width = $bitmap.Width; Height = $bitmap.Height }
}

function ConvertTo-HtmlText([string]$value) {
  return [System.Net.WebUtility]::HtmlEncode($value)
}

$maps = foreach ($name in $MapNames) {
  Read-Type1Map (Join-Path $MapRoot $name) $name
}

$frameCounts = @{}
$groupCounts = @{}
$largeComponentCount = 0

foreach ($map in $maps) {
  $cellTable = New-ObjectCellTable $map
  foreach ($cell in $cellTable.Values) {
    Add-FrameCount $frameCounts "$($cell.Slot):$($cell.Frame)" $cell
  }

  foreach ($component in (Get-ConnectedComponents $map $cellTable)) {
    if ($component.Cells.Count -gt $MaxGroupCells) {
      $largeComponentCount++
      continue
    }
    $signature = Get-ComponentSignature $component.Cells
    if (-not $groupCounts.ContainsKey($signature)) {
      $groupCounts[$signature] = [pscustomobject]@{
        Signature = $signature
        Count = 0
        Cells = $component.Cells
        Map = $component.Map
        FirstMap = $component.Map.Name
        Frames = Get-FrameListText $component.Cells
      }
    }
    $groupCounts[$signature].Count++
  }
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$groupRoot = Join-Path $outRoot "groups"
$contextRoot = Join-Path $outRoot "contexts"
$frameRoot = Join-Path $outRoot "frames"
New-Item -ItemType Directory -Force -Path $groupRoot, $contextRoot, $frameRoot | Out-Null

$renderedGroups = New-Object System.Collections.Generic.List[object]
$groupIndex = 1
foreach ($entry in @($groupCounts.Values | Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = { $_.Cells.Count }; Descending = $true }, Frames | Select-Object -First $MaxGroups)) {
  $groupFile = "group_{0:D4}.png" -f $groupIndex
  $contextFile = "context_{0:D4}.png" -f $groupIndex
  $groupSize = Render-ObjectOnly $entry.Cells (Join-Path $groupRoot $groupFile)
  $contextSize = Render-ContextCrop $entry (Join-Path $contextRoot $contextFile)
  if ($null -ne $groupSize) {
    $renderedGroups.Add([pscustomobject]@{
      Number = $groupIndex
      File = "groups/$groupFile"
      ContextFile = "contexts/$contextFile"
      Width = $groupSize.Width
      Height = $groupSize.Height
      ContextWidth = $contextSize.Width
      ContextHeight = $contextSize.Height
      Count = $entry.Count
      CellCount = $entry.Cells.Count
      FirstMap = $entry.FirstMap
      Frames = $entry.Frames
    })
    $groupIndex++
  }
}

$renderedFrames = New-Object System.Collections.Generic.List[object]
$frameIndex = 1
foreach ($entry in @($frameCounts.Values | Sort-Object -Property @{ Expression = "Count"; Descending = $true }, Slot, Frame)) {
  $image = Get-MapImage $entry.Slot $entry.Frame
  if ($null -eq $image) { continue }
  $file = "frame_{0:D4}_slot_{1:D3}_frame_{2:D6}.png" -f $frameIndex, $entry.Slot, $entry.Frame
  $image.Bitmap.Save((Join-Path $frameRoot $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $mapText = @($entry.Maps.GetEnumerator() | Sort-Object -Property Name | ForEach-Object { "$($_.Name):$($_.Value)" }) -join ", "
  $renderedFrames.Add([pscustomobject]@{
    Number = $frameIndex
    File = "frames/$file"
    Slot = $entry.Slot
    Frame = $entry.Frame
    Width = $image.Bitmap.Width
    Height = $image.Bitmap.Height
    OffsetX = $image.OffsetX
    OffsetY = $image.OffsetY
    Count = $entry.Count
    Maps = $mapText
  })
  $frameIndex++
}

$metadata = [ordered]@{
  sourceMaps = @($MapNames)
  maxGroupCells = $MaxGroupCells
  largeComponentCount = $largeComponentCount
  groups = @($renderedGroups.ToArray())
  frames = @($renderedFrames.ToArray())
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outRoot "objects.json") -Encoding UTF8

$groupCards = foreach ($item in $renderedGroups) {
  $frames = ConvertTo-HtmlText $item.Frames
  @"
    <article class="card group-card">
      <div class="image-row">
        <figure>
          <img src="$($item.File)" alt="Object group $($item.Number)" style="--w:$($item.Width);--h:$($item.Height)" loading="lazy" />
          <figcaption>Object only</figcaption>
        </figure>
        <figure>
          <img src="$($item.ContextFile)" alt="Object group $($item.Number) context" style="--w:$($item.ContextWidth);--h:$($item.ContextHeight)" loading="lazy" />
          <figcaption>Map context</figcaption>
        </figure>
      </div>
      <div class="meta">
        <strong>Group $($item.Number) - used $($item.Count)x - $($item.CellCount) cell(s)</strong>
        <span>First seen: $($item.FirstMap)</span>
        <span>Frames: $frames</span>
      </div>
    </article>
"@
}

$frameCards = foreach ($item in $renderedFrames) {
  $maps = ConvertTo-HtmlText $item.Maps
  @"
    <article class="card frame-card">
      <img src="$($item.File)" alt="Frame $($item.Slot):$($item.Frame)" style="--w:$($item.Width);--h:$($item.Height)" loading="lazy" />
      <div class="meta">
        <strong>Slot $($item.Slot), Frame $($item.Frame)</strong>
        <span>$($item.Width)x$($item.Height), offset $($item.OffsetX), $($item.OffsetY)</span>
        <span>Used $($item.Count)x - $maps</span>
      </div>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Wooma Temple Object Picker</title>
    <style>
      :root { color-scheme: dark; --zoom: 1; }
      body { margin: 0; background: #10100e; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 4; background: #181612; border-bottom: 1px solid #3a3123; padding: 12px 16px; }
      h1 { margin: 0 0 5px; font-size: 20px; color: #f2dcaa; }
      h2 { margin: 24px 14px 10px; color: #f2dcaa; font-size: 17px; }
      p { margin: 0; color: #b9ad94; max-width: 1040px; }
      .controls { display: flex; gap: 10px; align-items: center; margin-top: 10px; color: #ddd; }
      .controls input { width: 220px; }
      main { padding: 0 0 18px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; padding: 0 14px; }
      .group-grid { grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); }
      .card { border: 1px solid #342b1e; background: #191712; padding: 10px; display: grid; gap: 8px; overflow: auto; }
      .image-row { display: flex; gap: 10px; align-items: start; overflow-x: auto; }
      figure { margin: 0; display: grid; gap: 4px; color: #998d75; font-size: 11px; }
      img { width: calc(var(--w) * 1px * var(--zoom)); height: calc(var(--h) * 1px * var(--zoom)); image-rendering: pixelated; object-fit: contain; background: #060606; max-width: none; justify-self: start; }
      .frame-card > img { justify-self: center; }
      .meta { display: grid; gap: 3px; min-width: 220px; }
      strong { color: #fff0c7; }
      span { color: #b7ac94; font-size: 12px; }
      code { color: #e6c77a; }
    </style>
  </head>
  <body>
    <header>
      <h1>Wooma Temple Object Picker</h1>
      <p>Built from real front-layer object placements in <code>$($MapNames -join ", ")</code>. Group cards are connected placements up to $MaxGroupCells cells, with highlighted map context beside them. Individual frames are below for exact picking.</p>
      <div class="controls">
        <label for="zoom">Zoom</label>
        <input id="zoom" type="range" min="0.5" max="3" step="0.25" value="1" />
        <output id="zoomValue">1x</output>
      </div>
    </header>
    <main>
      <h2>Grouped Placements</h2>
      <section class="grid group-grid">
$($groupCards -join "`n")
      </section>
      <h2>Individual Frames</h2>
      <section class="grid">
$($frameCards -join "`n")
      </section>
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
    </script>
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Encoding UTF8

try {
  foreach ($entry in $loadedImages.Values) {
    if ($null -ne $entry) { $entry.Dispose() }
  }
  foreach ($entry in $loadedLibs.Values) {
    if ($null -ne $entry) { $entry.Dispose() }
  }
} catch {
  Write-Warning $_.Exception.Message
}

Write-Output "Rendered $($renderedGroups.Count) grouped placements and $($renderedFrames.Count) individual frames."
Write-Output $outRoot
