param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D001.map",
  [string]$OutputRoot = "../tile-review/oma-cave-map-context",
  [int]$MaxSamplesPerGroup = 8,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalMapContextLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalMapContextLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalMapContextLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalMapContextImage ReadImage(int index)
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

        return new CrystalMapContextImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalMapContextImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalMapContextImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Read-Type1Map($path) {
  if (-not (Test-Path $path)) { throw "Map file not found: $path" }
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

  return [pscustomobject]@{
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

function Get-FrontFrame($map, [int]$x, [int]$y) {
  $i = Get-CellOffset $map $x $y
  return ($map.Front[$i] -band 0x7FFF) - 1
}

$candidateGroups = @(
  [pscustomobject]@{ Id = "4430-4441"; Label = "Candidate wall/edge group 4430-4441"; Min = 4430; Max = 4441 },
  [pscustomobject]@{ Id = "4443-4454"; Label = "Candidate wall/edge group 4443-4454"; Min = 4443; Max = 4454 },
  [pscustomobject]@{ Id = "4456-4466"; Label = "Candidate wall/edge group 4456-4466"; Min = 4456; Max = 4466 },
  [pscustomobject]@{ Id = "4469-4480"; Label = "Candidate horizontal edge group 4469-4480"; Min = 4469; Max = 4480 },
  [pscustomobject]@{ Id = "4495-4520"; Label = "Candidate cliff/wall face group 4495-4520"; Min = 4495; Max = 4520 },
  [pscustomobject]@{ Id = "4526-4536"; Label = "Candidate wall/edge group 4526-4536"; Min = 4526; Max = 4536 },
  [pscustomobject]@{ Id = "4538-4555"; Label = "Candidate horizontal edge group 4538-4555"; Min = 4538; Max = 4555 },
  [pscustomobject]@{ Id = "4557-4575"; Label = "Candidate horizontal edge group 4557-4575"; Min = 4557; Max = 4575 }
)

function Find-CandidateGroup([int]$frame) {
  foreach ($group in $candidateGroups) {
    if ($frame -ge $group.Min -and $frame -le $group.Max) { return $group }
  }
  return $null
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

  $lib = [CrystalMapContextLib]::new($path)
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
  $marginX = 6
  $marginNorth = 8
  $marginSouth = 7
  $runWidth = $sample.X1 - $sample.X0 + 1
  $cropX = [Math]::Max(0, $sample.X0 - $marginX)
  $cropY = [Math]::Max(0, $sample.Y - $marginNorth)
  $cropWCells = [Math]::Min($map.Width - $cropX, $runWidth + ($marginX * 2))
  $cropHCells = [Math]::Min($map.Height - $cropY, 1 + $marginNorth + $marginSouth)
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

function Get-HorizontalRuns($map) {
  $runs = New-Object 'System.Collections.Generic.List[object]'
  for ($y = 0; $y -lt $map.Height; $y++) {
    $x = 0
    while ($x -lt $map.Width) {
      $cell = Get-CellOffset $map $x $y
      $frame = ($map.Front[$cell] -band 0x7FFF) - 1
      $slot = $map.FrontIndex[$cell]
      $group = if ($slot -eq 2) { Find-CandidateGroup $frame } else { $null }
      if ($null -eq $group) {
        $x++
        continue
      }

      $x0 = $x
      $frames = New-Object 'System.Collections.Generic.List[int]'
      while ($x -lt $map.Width) {
        $runCell = Get-CellOffset $map $x $y
        $runFrame = ($map.Front[$runCell] -band 0x7FFF) - 1
        $runSlot = $map.FrontIndex[$runCell]
        $runGroup = if ($runSlot -eq 2) { Find-CandidateGroup $runFrame } else { $null }
        if ($null -eq $runGroup -or $runGroup.Id -ne $group.Id) { break }
        $frames.Add($runFrame)
        $x++
      }

      $len = $x - $x0
      if ($len -ge 2) {
        $frameList = @($frames | Sort-Object -Unique)
        $runs.Add([pscustomobject]@{
          GroupId = $group.Id
          GroupLabel = $group.Label
          X0 = $x0
          X1 = $x - 1
          Y = $y
          Len = $len
          Frames = ($frameList -join ", ")
        })
      }
    }
  }
  return @($runs.ToArray())
}

function Select-RepresentativeRuns($runs) {
  $selected = New-Object 'System.Collections.Generic.List[object]'
  foreach ($group in $candidateGroups) {
    $groupRuns = @($runs | Where-Object { $_.GroupId -eq $group.Id } | Sort-Object -Property @{ Expression = "Len"; Descending = $true }, @{ Expression = "Y"; Descending = $false }, @{ Expression = "X0"; Descending = $false })
    $picked = New-Object 'System.Collections.Generic.List[object]'
    foreach ($run in $groupRuns) {
      $near = $false
      foreach ($existing in $picked) {
        if ([Math]::Abs($run.X0 - $existing.X0) -lt 10 -and [Math]::Abs($run.Y - $existing.Y) -lt 10) {
          $near = $true
          break
        }
      }
      if ($near) { continue }
      $picked.Add($run)
      if ($picked.Count -ge $MaxSamplesPerGroup) { break }
    }
    foreach ($run in $picked) { $selected.Add($run) }
  }
  return @($selected.ToArray())
}

function ConvertTo-HtmlText([string]$value) {
  return [System.Net.WebUtility]::HtmlEncode($value)
}

$map = Read-Type1Map $MapPath
$runs = Get-HorizontalRuns $map
$samples = Select-RepresentativeRuns $runs

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$imageRoot = Join-Path $outRoot "images"
New-Item -ItemType Directory -Force -Path $imageRoot | Out-Null

$rendered = New-Object System.Collections.Generic.List[object]
$sampleIndex = 1
try {
  foreach ($sample in $samples) {
    $fileName = "sample_{0:D3}.png" -f $sampleIndex
    $imagePath = Join-Path $imageRoot $fileName
    $crop = Render-MapCrop $map $sample $imagePath
    $rendered.Add([pscustomobject]@{
      Number = $sampleIndex
      File = "images/$fileName"
      GroupId = $sample.GroupId
      GroupLabel = $sample.GroupLabel
      X0 = $sample.X0
      X1 = $sample.X1
      Y = $sample.Y
      Len = $sample.Len
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
  sourceMap = $MapPath
  width = $map.Width
  height = $map.Height
  horizontalRunsFound = $runs.Count
  samples = @($rendered.ToArray())
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outRoot "samples.json") -Encoding UTF8

$cards = foreach ($item in $rendered) {
  $title = ConvertTo-HtmlText "$($item.GroupLabel)"
  $frames = ConvertTo-HtmlText $item.Frames
  @"
    <article class="card" style="--w:$($item.Width); --h:$($item.Height)">
      <img src="$($item.File)" alt="Oma Cave map crop $($item.Number)" loading="lazy" />
      <div class="meta">
        <strong>#$($item.Number) - $title</strong>
        <span>Map cells x$($item.X0)-$($item.X1), y$($item.Y) · run length $($item.Len)</span>
        <span>Frames: $frames</span>
        <span>Crop starts at x$($item.CropX), y$($item.CropY)</span>
      </div>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Oma Cave Map Context Review</title>
    <style>
      :root { color-scheme: dark; --zoom: 1; }
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      p { margin: 0; color: #aaa; }
      code { color: #e8c06f; }
      .controls { display: flex; gap: 10px; align-items: center; margin-top: 10px; color: #ddd; }
      .controls input { width: 220px; }
      main { display: grid; grid-template-columns: 1fr; gap: 14px; padding: 14px; }
      .card { border: 1px solid #333; background: #1b1b1b; padding: 10px; display: grid; gap: 8px; overflow-x: auto; }
      .card img { width: calc(var(--w) * 1px * var(--zoom)); height: calc(var(--h) * 1px * var(--zoom)); image-rendering: pixelated; max-width: none; background: #18130f; }
      .meta { display: grid; gap: 3px; min-width: 520px; }
      strong { color: #fff1cf; font-size: 13px; }
      span { color: #aaa; font-size: 12px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Oma Cave Map Context Review</h1>
      <p>Real crops from <code>D001.map</code>, composited with floor tiles and front objects using Crystal's layer order. Pick the crop that has the horizontal wall/edge you want.</p>
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
Write-Output "Rendered $($rendered.Count) contextual Oma Cave map crops from $($runs.Count) horizontal runs."
Write-Output $outRoot
