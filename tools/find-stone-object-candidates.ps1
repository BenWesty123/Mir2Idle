param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string[]]$Libraries = @(
    "NPC/12.Lib",
    "NPC/33.Lib",
    "NPC/34.Lib",
    "NPC/79.Lib",
    "NPC/80.Lib",
    "Deco.Lib",
    "Effect.Lib",
    "Effect2.Lib",
    "Gate/00.Lib",
    "Gate/01.Lib",
    "Gate/02.Lib",
    "Gate/03.Lib",
    "Gate/04.Lib",
    "Gate/05.Lib",
    "Gate/06.Lib",
    "Gate/07.Lib",
    "Gate/08.Lib",
    "Gate/09.Lib",
    "Gate/10.Lib",
    "Gate/11.Lib",
    "Gate/12.Lib",
    "Gate/13.Lib",
    "Gate/14.Lib",
    "Map/WemadeMir2/Objects.Lib",
    "Map/WemadeMir2/Objects2.Lib",
    "Map/WemadeMir2/Objects3.Lib",
    "Map/WemadeMir2/Objects4.Lib",
    "Map/WemadeMir2/Objects5.Lib",
    "Map/WemadeMir2/Objects6.Lib",
    "Map/WemadeMir2/Objects7.Lib",
    "Map/WemadeMir2/Objects8.Lib",
    "Map/WemadeMir2/Objects9.Lib",
    "Map/WemadeMir2/Objects10.Lib",
    "Map/WemadeMir2/Objects11.Lib",
    "Map/WemadeMir2/Objects12.Lib",
    "Map/WemadeMir2/Objects13.Lib",
    "Map/WemadeMir2/Objects14.Lib"
  ),
  [string]$OutputRoot = "../tile-review/stone-object-candidates",
  [int]$TopPerLib = 28,
  [int]$MaxWidth = 220,
  [int]$MaxHeight = 220
)

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalStoneObjectScanLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalStoneObjectScanLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalStoneObjectScanLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalStoneObjectScanImage ReadImage(int index)
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

        return new CrystalStoneObjectScanImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalStoneObjectScanImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalStoneObjectScanImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Get-StoneCandidateScore($bitmap) {
  $visible = 0
  $stone = 0
  $dark = 0
  $green = 0
  $transparent = 0
  $stepY = [Math]::Max(1, [Math]::Floor($bitmap.Height / 56))
  $stepX = [Math]::Max(1, [Math]::Floor($bitmap.Width / 56))
  for ($y = 0; $y -lt $bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $bitmap.Width; $x += $stepX) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -le 8) {
        $transparent++
        continue
      }
      $visible++
      $max = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
      $min = [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))
      $brightness = ($pixel.R + $pixel.G + $pixel.B) / 3.0
      $spread = $max - $min
      if ($pixel.G -gt ($pixel.R * 1.12) -and $pixel.G -gt ($pixel.B * 1.08) -and $pixel.G -gt 42) { $green++ }
      if ($brightness -lt 115) { $dark++ }
      if ($brightness -ge 14 -and $brightness -lt 165 -and $spread -lt 70 -and $pixel.G -lt 155) { $stone++ }
    }
  }
  if ($visible -lt 6) { return 0 }
  $visibleRatio = $visible / [Math]::Max(1, ($visible + $transparent))
  $stoneRatio = $stone / $visible
  $darkRatio = $dark / $visible
  $greenRatio = $green / $visible
  if ($greenRatio -gt 0.42) { return 0 }
  if ($visibleRatio -gt 0.96 -and ($bitmap.Width * $bitmap.Height) -gt 4096) { return 0 }
  $size = [Math]::Sqrt($bitmap.Width * $bitmap.Height)
  $sizeScore = 1.0
  if ($size -lt 24) { $sizeScore = 0.5 }
  elseif ($size -gt 140) { $sizeScore = [Math]::Max(0.25, 1.0 - (($size - 140) / 150.0)) }
  $floatingScore = if ($visibleRatio -lt 0.75) { 1.25 } else { 0.9 }
  return [Math]::Round((($stoneRatio * 650) + ($darkRatio * 280) - ($greenRatio * 420)) * $sizeScore * $floatingScore, 3)
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$imageRoot = Join-Path $outRoot "images"
New-Item -ItemType Directory -Force -Path $imageRoot | Out-Null

$allCandidates = New-Object System.Collections.Generic.List[object]
foreach ($library in $Libraries) {
  $libPath = Join-Path (Resolve-Path $DataRoot) $library
  if (-not (Test-Path $libPath)) { continue }
  Write-Output "Scanning $library"
  $candidates = New-Object System.Collections.Generic.List[object]
  $lib = [CrystalStoneObjectScanLib]::new($libPath)
  try {
    for ($frame = 0; $frame -lt $lib.Count; $frame++) {
      $image = $lib.ReadImage($frame)
      if ($null -eq $image) { continue }
      try {
        $bitmap = $image.Bitmap
        if ($bitmap.Width -gt $MaxWidth -or $bitmap.Height -gt $MaxHeight -or $bitmap.Width -lt 12 -or $bitmap.Height -lt 12) { continue }
        $score = Get-StoneCandidateScore $bitmap
        if ($score -le 220) { continue }
        $candidates.Add([ordered]@{
          source = $library
          frame = $frame
          width = $bitmap.Width
          height = $bitmap.Height
          offsetX = $image.OffsetX
          offsetY = $image.OffsetY
          score = $score
        })
      }
      finally {
        $image.Dispose()
      }
    }
  }
  finally {
    $lib.Dispose()
  }
  $top = @($candidates | Sort-Object score -Descending | Select-Object -First $TopPerLib)
  foreach ($item in $top) { $allCandidates.Add($item) }
}

$ranked = @($allCandidates | Sort-Object score -Descending)
foreach ($item in $ranked) {
  $libPath = Join-Path (Resolve-Path $DataRoot) $item.source
  $safeSource = ($item.source -replace '[\\/:\.]', '-').ToLowerInvariant()
  $name = "{0}-frame_{1:D6}.png" -f $safeSource, $item.frame
  $path = Join-Path $imageRoot $name
  $lib = [CrystalStoneObjectScanLib]::new($libPath)
  try {
    $image = $lib.ReadImage($item.frame)
    if ($null -ne $image) {
      $image.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
      $image.Dispose()
      $item.file = "images/$name"
    }
  }
  finally {
    $lib.Dispose()
  }
}

$ranked | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outRoot "candidates.json")

$cards = foreach ($item in $ranked) {
  @"
    <article class="tile">
      <img src="$($item.file)" alt="$($item.source) frame $($item.frame)" loading="lazy" />
      <strong>$($item.source)</strong>
      <b>Frame $($item.frame)</b>
      <span>$($item.width)x$($item.height), offset $($item.offsetX), $($item.offsetY), score $($item.score)</span>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Floating Stone Object Candidates</title>
    <style>
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      p { margin: 0; color: #aaa; }
      main { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 10px; padding: 12px; }
      .tile { border: 1px solid #333; background: #1b1b1b; padding: 8px; display: grid; gap: 6px; }
      img { width: 128px; height: 128px; object-fit: contain; image-rendering: pixelated; background: #d2c29b; justify-self: center; }
      strong, b, span { display: block; }
      b { color: #f1d095; }
      span { color: #aaa; font-size: 11px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Floating Stone Object Candidates</h1>
      <p>Automated scan for small grey/brown/dark object frames. Tell me the source and frame number if you spot it.</p>
    </header>
    <main>
$($cards -join "`n")
    </main>
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html")
Write-Output "Wrote $($ranked.Count) candidates"
Write-Output $outRoot
