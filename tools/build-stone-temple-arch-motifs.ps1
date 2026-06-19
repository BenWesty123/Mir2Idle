param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("D711.map", "D712.map", "D713.map", "D714.map", "D715.map", "D716.map", "D717.map"),
  [string]$OutputRoot = "../tile-review/stone-temple-arch-motifs",
  [int]$TallMinHeight = 180,
  [int]$MaxMotifs = 80,
  [int]$SearchRadius = 4,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalArchMotifLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalArchMotifLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalArchMotifLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalArchMotifImage ReadImage(int index)
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
        return new CrystalArchMotifImage(bitmap, ox, oy, w, h);
    }

    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}

public sealed class CrystalArchMotifImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }
    public int Width { get; private set; }
    public int Height { get; private set; }

    public CrystalArchMotifImage(Bitmap bitmap, short offsetX, short offsetY, int width, int height)
    {
        Bitmap = bitmap; OffsetX = offsetX; OffsetY = offsetY; Width = width; Height = height;
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

function Read-Type1Map($path, [string]$name) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if (-not ($bytes.Length -ge 54 -and $bytes[0] -eq 0x10 -and $bytes[2] -eq 0x61 -and $bytes[7] -eq 0x31 -and $bytes[14] -eq 0x31)) {
    throw "Only Type1 maps are supported: $path"
  }
  $xor = [BitConverter]::ToInt16($bytes, 23)
  $width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
  $count = $width * $height
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)
  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
      $slot = [int]$bytes[$offset + 12] + 2
      if ($slot -eq 102) { $slot = 90 }
      if ($slot -ge 255) { $slot = -1 }
      $frontIndex[$i] = $slot
      $offset += 15
    }
  }
  return [pscustomobject]@{ Name = $name; Width = $width; Height = $height; Front = $front; FrontIndex = $frontIndex }
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
  $lib = [CrystalArchMotifLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$frame) {
  $key = "$slot`:$frame"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }
  $lib = Get-MapLib $slot
  if ($null -eq $lib) { $loadedImages[$key] = $null; return $null }
  $image = $lib.ReadImage($frame)
  $loadedImages[$key] = $image
  return $image
}

function Get-FrontCell($map, [int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $map.Width -or $y -ge $map.Height) { return $null }
  $i = ($x * $map.Height) + $y
  $frame = ($map.Front[$i] -band 0x7FFF) - 1
  $slot = $map.FrontIndex[$i]
  if ($frame -lt 0 -or $slot -lt 0 -or $slot -eq 200) { return $null }
  $image = Get-MapImage $slot $frame
  if ($null -eq $image) { return $null }
  return [pscustomobject]@{
    MapName = $map.Name; X = $x; Y = $y; Slot = $slot; Frame = $frame
    Width = $image.Width; Height = $image.Height; Image = $image
  }
}

function Test-TallCell($cell) {
  return ($null -ne $cell) -and $cell.Height -ge $TallMinHeight
}

function Get-MotifSignature($cells) {
  $minX = ($cells | Measure-Object -Property X -Minimum).Minimum
  $minY = ($cells | Measure-Object -Property Y -Minimum).Minimum
  @($cells | Sort-Object Y, X, Slot, Frame | ForEach-Object {
    "$($_.X - $minX),$($_.Y - $minY),$($_.Slot):$($_.Frame)"
  }) -join "|"
}

function Render-Motif($cells, [string]$path) {
  $minX = ($cells | Measure-Object -Property X -Minimum).Minimum
  $minY = ($cells | Measure-Object -Property Y -Minimum).Minimum
  $draws = New-Object System.Collections.Generic.List[object]
  foreach ($cell in $cells) {
    $image = $cell.Image
    $drawX = (($cell.X - $minX) * $CellWidth) + $image.OffsetX
    $drawY = (($cell.Y - $minY) * $CellHeight) + $image.OffsetY + $CellHeight - $image.Height
    $draws.Add([pscustomobject]@{ Bitmap = $image.Bitmap; X = $drawX; Y = $drawY; Right = $drawX + $image.Width; Bottom = $drawY + $image.Height })
  }
  $minDrawX = ($draws | Measure-Object -Property X -Minimum).Minimum
  $minDrawY = ($draws | Measure-Object -Property Y -Minimum).Minimum
  $maxRight = ($draws | Measure-Object -Property Right -Maximum).Maximum
  $maxBottom = ($draws | Measure-Object -Property Bottom -Maximum).Maximum
  $pad = 4
  $width = [Math]::Max(1, $maxRight - $minDrawX + $pad * 2)
  $height = [Math]::Max(1, $maxBottom - $minDrawY + $pad * 2)
  $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  foreach ($draw in $draws) {
    $graphics.DrawImage($draw.Bitmap, $draw.X - $minDrawX + $pad, $draw.Y - $minDrawY + $pad)
  }
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  return [pscustomobject]@{ Width = $width; Height = $height }
}

$out = Join-Path $PSScriptRoot $OutputRoot
$asmDir = Join-Path $out "assemblies"
New-Item -ItemType Directory -Force -Path $asmDir | Out-Null

$motifs = @{}
$motifList = New-Object System.Collections.Generic.List[object]

foreach ($mapName in $MapNames) {
  $mapPath = Join-Path $MapRoot $mapName
  if (-not (Test-Path $mapPath)) { continue }
  $map = Read-Type1Map $mapPath $mapName

  for ($x = 0; $x -lt $map.Width; $x++) {
    for ($y = 0; $y -lt $map.Height; $y++) {
      $seed = Get-FrontCell $map $x $y
      if (-not (Test-TallCell $seed)) { continue }

      $cells = New-Object System.Collections.Generic.List[object]
      $seen = @{}
      for ($dx = -$SearchRadius; $dx -le $SearchRadius; $dx++) {
        for ($dy = -$SearchRadius; $dy -le $SearchRadius; $dy++) {
          $cell = Get-FrontCell $map ($x + $dx) ($y + $dy)
          if ($null -eq $cell) { continue }
          $key = "$($cell.X),$($cell.Y)"
          if ($seen.ContainsKey($key)) { continue }
          $seen[$key] = $true
          $cells.Add($cell)
        }
      }

      $tallCount = @($cells | Where-Object { $_.Height -ge $TallMinHeight }).Count
      if ($tallCount -lt 1) { continue }
      if ($cells.Count -lt 2) { continue }

      $sig = Get-MotifSignature @($cells.ToArray())
      if ($motifs.ContainsKey($sig)) {
        $motifs[$sig].Count++
        continue
      }

      $frameList = @($cells | Sort-Object Y, X | ForEach-Object { "$($_.Slot):$($_.Frame)" }) -join ", "
      $motifs[$sig] = [pscustomobject]@{
        Signature = $sig
        Count = 1
        FirstMap = $mapName
        SeedFrame = "$($seed.Slot):$($seed.Frame)"
        CellCount = $cells.Count
        TallCount = $tallCount
        Frames = $frameList
        Cells = @($cells.ToArray())
      }
      $motifList.Add($motifs[$sig])
    }
  }
}

$ranked = @($motifList | Sort-Object -Property Count -Descending | Select-Object -First $MaxMotifs)
$groups = New-Object System.Collections.Generic.List[object]
$number = 0
foreach ($motif in $ranked) {
  $number++
  $file = "assemblies/motif_{0:D4}.png" -f $number
  $size = Render-Motif $motif.Cells (Join-Path $out $file)
  $groups.Add([pscustomobject]@{
    Number = $number
    AssemblyFile = $file
    Width = $size.Width
    Height = $size.Height
    Count = $motif.Count
    CellCount = $motif.CellCount
    TallCount = $motif.TallCount
    SeedFrame = $motif.SeedFrame
    FirstMap = $motif.FirstMap
    Frames = $motif.Frames
  })
}

$catalog = [pscustomobject]@{
  title = "Stone Temple arch motifs (gap-tolerant)"
  note = "Grouped front objects within $SearchRadius cells of any pillar frame (height >= $TallMinHeight). Full walk-through arches span multiple cells with gaps; 4-neighbor catalog misses these."
  groups = $groups.ToArray()
}

$catalog | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $out "catalog.json") -Encoding UTF8

# HTML index
$cards = foreach ($g in $groups) {
@"
    <article class="card" id="motif-$($g.Number)">
      <div class="head"><strong># $($g.Number)</strong> <span class="badge">$($g.Count)x on maps</span></div>
      <img src="$($g.AssemblyFile)" alt="motif $($g.Number)" loading="lazy" />
      <p>Seed: <code>$($g.SeedFrame)</code> | $($g.CellCount) cells ($($g.TallCount) tall) | $($g.Width)x$($g.Height) px</p>
      <p class="frames"><code>$([System.Net.WebUtility]::HtmlEncode($g.Frames))</code></p>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Stone Temple Arch Motifs</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font: 14px Segoe UI, sans-serif; }
    header { padding: 16px 20px; background: #1a1a1a; border-bottom: 1px solid #333; }
    h1 { margin: 0 0 6px; }
    p.lead { margin: 0; color: #bbb; max-width: 900px; line-height: 1.5; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; padding: 16px; }
    .card { background: #1c1c1c; border: 1px solid #333; padding: 12px; display: grid; gap: 8px; }
    .card img { width: 100%; height: 220px; object-fit: contain; image-rendering: pixelated; background: #050505; }
    .badge { background: #2d4a2d; color: #9fdf9f; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .frames { font-size: 11px; color: #aaa; word-break: break-all; margin: 0; }
    code { color: #c9e6ff; }
  </style>
</head>
<body>
  <header>
    <h1>Stone Temple pillar-arch motifs</h1>
    <p class="lead">These are real map placements: every tall pillar frame (Objects7 height &ge; $TallMinHeight px) plus all front objects within $SearchRadius cells. The old catalog used 4-neighbor grouping only, which merged floor rubble (5621&ndash;5626, 48&times;32) and missed arches that span walkable gaps.</p>
  </header>
  <main>
$($cards -join "`n")
  </main>
</body>
</html>
"@
$html | Set-Content (Join-Path $out "index.html") -Encoding UTF8

Write-Host "Built $($groups.Count) arch motifs at $out"
