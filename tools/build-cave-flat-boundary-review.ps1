param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("D001.map", "D002.map", "D003.map", "D011.map", "D012.map"),
  [string]$OutputRoot = "../tile-review/cave-flat-boundary-review",
  [int]$MaxSamples = 80,
  [int]$WindowCells = 22,
  [int]$CropNorthCells = 10,
  [int]$CropSouthCells = 9,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalFlatBoundaryLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalFlatBoundaryLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalFlatBoundaryLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalFlatBoundaryImage ReadImage(int index)
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

        return new CrystalFlatBoundaryImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalFlatBoundaryImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalFlatBoundaryImage(Bitmap bitmap, short offsetX, short offsetY)
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
  if (-not ($bytes.Length -ge 15 -and $bytes[0] -eq 0x10 -and $bytes[2] -eq 0x61 -and $bytes[7] -eq 0x31 -and $bytes[14] -eq 0x31)) {
    throw "Only Type1 cave maps are supported by this review script: $path"
  }

  $xor = [BitConverter]::ToInt16($bytes, 23)
  $width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
  $count = $width * $height
  $back = [long[]]::new($count)
  $middle = [int[]]::new($count)
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)
  $blocked = [byte[]]::new($count)

  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $middle[$i] = [BitConverter]::ToInt16($bytes, $offset + 4) -bxor $xor
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
      if ((($back[$i] -band 0x20000000) -ne 0) -or (($front[$i] -band 0x8000) -ne 0)) {
        $blocked[$i] = 1
      }
      $slot = [int]$bytes[$offset + 12] + 2
      if ($slot -eq 102) { $slot = 90 }
      if ($slot -ge 255) { $slot = -1 }
      $frontIndex[$i] = $slot
      $offset += 15
    }
  }

  return [pscustomobject]@{
    Name = $name
    Path = $path
    Width = $width
    Height = $height
    Back = $back
    Middle = $middle
    Front = $front
    FrontIndex = $frontIndex
    Blocked = $blocked
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) {
  return ($x * $map.Height) + $y
}

function Test-BlockedCell($map, [int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $map.Width -or $y -ge $map.Height) { return $true }
  $cell = Get-CellOffset $map $x $y
  return $map.Blocked[$cell] -ne 0
}

function Test-BoundaryAt($map, [int]$x, [int]$y, [string]$kind) {
  if ($y -le 0 -or $y -ge $map.Height) { return $false }
  $northBlocked = Test-BlockedCell $map $x ($y - 1)
  $southBlocked = Test-BlockedCell $map $x $y
  if ($kind -eq "wall-above") { return $northBlocked -and -not $southBlocked }
  if ($kind -eq "wall-below") { return (-not $northBlocked) -and $southBlocked }
  return $northBlocked -ne $southBlocked
}

function Get-FrontFrame($map, [int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $map.Width -or $y -ge $map.Height) { return -1 }
  $cell = Get-CellOffset $map $x $y
  return ($map.Front[$cell] -band 0x7FFF) - 1
}

function Get-FrontSlot($map, [int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $map.Width -or $y -ge $map.Height) { return -1 }
  $cell = Get-CellOffset $map $x $y
  return $map.FrontIndex[$cell]
}

function Test-WallLikeFrame([int]$slot, [int]$frame) {
  if ($frame -lt 0) { return $false }
  if ($slot -eq 2 -and $frame -ge 4430 -and $frame -le 4575) { return $true }
  if ($slot -eq 3 -and $frame -ge 3600 -and $frame -le 3760) { return $true }
  return $false
}

$loadedLibs = @{}
$loadedImages = @{}

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

  $lib = [CrystalFlatBoundaryLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$index) {
  if ($index -lt 0) { return $null }
  $key = "$slot`:$index"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }

  $lib = Get-MapLib $slot
  if ($null -eq $lib) {
    $loadedImages[$key] = $null
    return $null
  }

  $image = $lib.ReadImage($index)
  $loadedImages[$key] = $image
  return $image
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
      $cell = Get-CellOffset $map $x $y
      $drawX = ($x - $cropX) * $CellWidth
      $drawY = ($y - $cropY) * $CellHeight

      if (($x -band 1) -eq 0 -and ($y -band 1) -eq 0) {
        $backImage = $map.Back[$cell]
        if ($backImage -ne 0) {
          $backFrame = ($backImage -band 0x1FFFFFFF) - 1
          $image = Get-MapImage 0 $backFrame
          if ($null -ne $image) {
            $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
          }
        }
      }

      $midFrame = $map.Middle[$cell] - 1
      if ($midFrame -ge 0) {
        $image = Get-MapImage 1 $midFrame
        if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
          $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
        }
      }

      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -ge 0 -and $frontSlot -ne -1 -and $frontSlot -ne 200) {
        $image = Get-MapImage $frontSlot $frontFrame
        if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
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
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }

      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }

      $drawX = ($x - $cropX) * $CellWidth
      $drawY = (($y - $cropY) + 1) * $CellHeight - $image.Bitmap.Height
      $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
    }
  }
}

function Render-MapCrop($map, $sample, [string]$path) {
  $cropX = [Math]::Max(0, $sample.X0)
  $cropY = [Math]::Max(0, $sample.Y - $CropNorthCells)
  $cropWCells = [Math]::Min($map.Width - $cropX, $sample.WidthCells)
  $cropHCells = [Math]::Min($map.Height - $cropY, $CropNorthCells + $CropSouthCells + 1)

  $bitmap = [System.Drawing.Bitmap]::new($cropWCells * $CellWidth, $cropHCells * $CellHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.Clear([System.Drawing.Color]::FromArgb(24, 19, 15))
    Draw-FloorLayers $graphics $map $cropX $cropY $cropWCells $cropHCells
    Draw-TallFrontObjects $graphics $map $cropX $cropY $cropWCells $cropHCells
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  return [pscustomobject]@{
    CropX = $cropX
    CropY = $cropY
    CropWCells = $cropWCells
    CropHCells = $cropHCells
    Width = $cropWCells * $CellWidth
    Height = $cropHCells * $CellHeight
  }
}

function Get-LongestBoundaryRun($map, [int]$x0, [int]$y, [int]$width, [string]$kind) {
  $longest = 0
  $current = 0
  for ($x = $x0; $x -lt ($x0 + $width); $x++) {
    if (Test-BoundaryAt $map $x $y $kind) {
      $current++
      if ($current -gt $longest) { $longest = $current }
    } else {
      $current = 0
    }
  }
  return $longest
}

function Get-FrameSummary($map, [int]$x0, [int]$y, [int]$width) {
  $counts = @{}
  $wallHits = 0
  $objectCells = 0
  $startY = [Math]::Max(0, $y - $CropNorthCells)
  $endY = [Math]::Min($map.Height - 1, $y + 3)
  for ($cy = $startY; $cy -le $endY; $cy++) {
    for ($cx = $x0; $cx -lt ($x0 + $width) -and $cx -lt $map.Width; $cx++) {
      $frame = Get-FrontFrame $map $cx $cy
      if ($frame -lt 0) { continue }
      $slot = Get-FrontSlot $map $cx $cy
      $objectCells++
      if (Test-WallLikeFrame $slot $frame) { $wallHits++ }
      $key = "$slot`:$frame"
      if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
      $counts[$key]++
    }
  }

  $summary = @($counts.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 10 | ForEach-Object { "$($_.Key)($($_.Value))" }) -join ", "
  return [pscustomobject]@{
    ObjectCells = $objectCells
    WallHits = $wallHits
    Summary = $summary
  }
}

function Find-FlatBoundaryCandidates($map) {
  $items = New-Object 'System.Collections.Generic.List[object]'
  $stepX = [Math]::Max(4, [Math]::Floor($WindowCells / 2))
  $boundary = [byte[]]::new($map.Width)
  $height = $map.Height
  $blocked = $map.Blocked
  for ($kindIndex = 0; $kindIndex -lt 2; $kindIndex++) {
    $kind = if ($kindIndex -eq 0) { "wall-above" } else { "wall-below" }
    for ($y = 1; $y -lt $map.Height; $y++) {
      for ($x = 0; $x -lt $map.Width; $x++) {
        $north = $blocked[($x * $height) + ($y - 1)] -ne 0
        $south = $blocked[($x * $height) + $y] -ne 0
        if ($kind -eq "wall-above") {
          $boundary[$x] = if ($north -and -not $south) { 1 } else { 0 }
        } else {
          $boundary[$x] = if ((-not $north) -and $south) { 1 } else { 0 }
        }
      }

      for ($x0 = 0; $x0 -le ($map.Width - $WindowCells); $x0 += $stepX) {
        $boundaryCount = 0
        $longestRun = 0
        $currentRun = 0
        for ($wx = $x0; $wx -lt ($x0 + $WindowCells); $wx++) {
          if ($boundary[$wx] -ne 0) {
            $boundaryCount++
            $currentRun++
            if ($currentRun -gt $longestRun) { $longestRun = $currentRun }
          } else {
            $currentRun = 0
          }
        }
        if ($boundaryCount -lt 4) { continue }

        $score = ($boundaryCount * 30) + ($longestRun * 16)
        $items.Add([pscustomobject]@{
          MapName = $map.Name
          Map = $map
          Kind = $kind
          X0 = $x0
          X1 = $x0 + $WindowCells - 1
          Y = $y
          WidthCells = $WindowCells
          BoundaryCells = $boundaryCount
          LongestRun = $longestRun
          ObjectCells = 0
          WallHits = 0
          Frames = ""
          Score = $score
        })
      }
    }
  }
  return @($items.ToArray())
}

function Select-DiverseSamples($candidates) {
  $selected = New-Object 'System.Collections.Generic.List[object]'
  $perMap = @{}
  $sorted = @($candidates | Sort-Object -Property @{ Expression = "Score"; Descending = $true }, @{ Expression = "BoundaryCells"; Descending = $true }, @{ Expression = "LongestRun"; Descending = $true })
  foreach ($candidate in $sorted) {
    if (-not $perMap.ContainsKey($candidate.MapName)) { $perMap[$candidate.MapName] = 0 }
    if ($perMap[$candidate.MapName] -ge [Math]::Ceiling($MaxSamples / [Math]::Max(1, $MapNames.Count)) + 4) { continue }

    $near = $false
    foreach ($existing in $selected) {
      if ($existing.MapName -eq $candidate.MapName -and
          [Math]::Abs($existing.Y - $candidate.Y) -lt 9 -and
          [Math]::Abs((($existing.X0 + $existing.X1) / 2) - (($candidate.X0 + $candidate.X1) / 2)) -lt 14) {
        $near = $true
        break
      }
    }
    if ($near) { continue }

    $selected.Add($candidate)
    $perMap[$candidate.MapName]++
    if ($selected.Count -ge $MaxSamples) { break }
  }
  return @($selected.ToArray())
}

function ConvertTo-HtmlText([string]$value) {
  return [System.Net.WebUtility]::HtmlEncode($value)
}

$maps = foreach ($name in $MapNames) {
  $path = Join-Path $MapRoot $name
  Read-Type1Map $path $name
}

$allCandidates = New-Object 'System.Collections.Generic.List[object]'
foreach ($map in $maps) {
  foreach ($candidate in (Find-FlatBoundaryCandidates $map)) {
    $allCandidates.Add($candidate)
  }
}

$samples = Select-DiverseSamples @($allCandidates.ToArray())

foreach ($sample in $samples) {
  $frameInfo = Get-FrameSummary $sample.Map $sample.X0 $sample.Y $sample.WidthCells
  $sample.ObjectCells = $frameInfo.ObjectCells
  $sample.WallHits = $frameInfo.WallHits
  $sample.Frames = $frameInfo.Summary
  $sample.Score += ($frameInfo.WallHits * 3) + $frameInfo.ObjectCells
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$imageRoot = Join-Path $outRoot "images"
New-Item -ItemType Directory -Force -Path $imageRoot | Out-Null

$rendered = New-Object 'System.Collections.Generic.List[object]'
$sampleIndex = 1
try {
  foreach ($sample in $samples) {
    $fileName = "flat_{0:D3}_{1}.png" -f $sampleIndex, ($sample.MapName -replace "[^A-Za-z0-9]", "")
    $imagePath = Join-Path $imageRoot $fileName
    $crop = Render-MapCrop $sample.Map $sample $imagePath
    $rendered.Add([pscustomobject]@{
      Number = $sampleIndex
      File = "images/$fileName"
      MapName = $sample.MapName
      Kind = $sample.Kind
      X0 = $sample.X0
      X1 = $sample.X1
      Y = $sample.Y
      BoundaryCells = $sample.BoundaryCells
      LongestRun = $sample.LongestRun
      ObjectCells = $sample.ObjectCells
      WallHits = $sample.WallHits
      Score = $sample.Score
      Frames = $sample.Frames
      CropX = $crop.CropX
      CropY = $crop.CropY
      Width = $crop.Width
      Height = $crop.Height
    })
    $sampleIndex++
  }
}
finally {
  foreach ($entry in $loadedImages.Values) {
    if ($null -ne $entry) { $entry.Dispose() }
  }
  foreach ($entry in $loadedLibs.Values) {
    if ($null -ne $entry) { $entry.Dispose() }
  }
}

$metadata = [ordered]@{
  sourceMaps = @($MapNames)
  candidateCount = $allCandidates.Count
  samples = @($rendered.ToArray())
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outRoot "samples.json") -Encoding UTF8

$cards = foreach ($item in $rendered) {
  $frames = ConvertTo-HtmlText $item.Frames
  $kind = if ($item.Kind -eq "wall-above") { "Wall above, open floor below" } else { "Open floor above, wall below" }
  @"
    <article class="card" style="--w:$($item.Width); --h:$($item.Height)">
      <img src="$($item.File)" alt="Flat boundary candidate $($item.Number)" loading="lazy" />
      <div class="meta">
        <strong>#$($item.Number) - $($item.MapName) - $kind</strong>
        <span>Map cells x$($item.X0)-$($item.X1), boundary y$($item.Y) - boundary cells $($item.BoundaryCells)/$WindowCells - longest straight run $($item.LongestRun)</span>
        <span>Wall-like frame hits: $($item.WallHits) - score $($item.Score)</span>
        <span>Frames nearby: $frames</span>
      </div>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Cave Flat Boundary Review</title>
    <style>
      :root { color-scheme: dark; --zoom: 1; }
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      p { margin: 0; color: #aaa; max-width: 980px; }
      code { color: #e8c06f; }
      .controls { display: flex; gap: 10px; align-items: center; margin-top: 10px; color: #ddd; }
      .controls input { width: 220px; }
      main { display: grid; grid-template-columns: 1fr; gap: 14px; padding: 14px; }
      .card { border: 1px solid #333; background: #1b1b1b; padding: 10px; display: grid; gap: 8px; overflow-x: auto; }
      .card img { width: calc(var(--w) * 1px * var(--zoom)); height: calc(var(--h) * 1px * var(--zoom)); image-rendering: pixelated; max-width: none; background: #18130f; }
      .meta { display: grid; gap: 3px; min-width: 620px; }
      strong { color: #fff1cf; font-size: 13px; }
      span { color: #aaa; font-size: 12px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Cave Flat Boundary Review</h1>
      <p>These are real rendered strips from cave maps, ranked by long left-to-right walkable/blocked boundaries. This pass is looking for flatter wall lips/edges, not just repeated wall frame numbers.</p>
      <div class="controls">
        <label for="zoom">Zoom</label>
        <input id="zoom" type="range" min="0.5" max="3" step="0.25" value="1" />
        <output id="zoomValue">1x</output>
      </div>
    </header>
    <main>
$($cards -join "`n")
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
Write-Output "Rendered $($rendered.Count) flat boundary cave crops from $($allCandidates.Count) candidates."
Write-Output $outRoot
