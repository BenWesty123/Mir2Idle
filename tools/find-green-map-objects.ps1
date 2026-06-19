param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string[]]$MapLibs = @(
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
    "Map/WemadeMir2/Objects14.Lib",
    "Map/WemadeMir2/Objects15.Lib",
    "Map/WemadeMir2/Objects16.Lib",
    "Map/WemadeMir2/Objects17.Lib",
    "Map/WemadeMir2/Objects18.Lib",
    "Map/WemadeMir2/Objects19.Lib",
    "Map/WemadeMir2/Objects20.Lib",
    "Map/WemadeMir2/Objects21.Lib",
    "Map/WemadeMir2/Objects22.Lib",
    "Map/WemadeMir2/Objects23.Lib",
    "Map/WemadeMir2/Objects24.Lib",
    "Map/WemadeMir2/Objects25.Lib",
    "Map/WemadeMir2/Objects26.Lib",
    "Map/WemadeMir2/Objects27.lib",
    "Map/WemadeMir3/Forest/SmObjectsc.Lib",
    "Map/WemadeMir3/Wood/SmObjectsc.Lib",
    "Map/WemadeMir3/SmObjectsc.Lib",
    "Map/WemadeMir3/Object1c.Lib",
    "Map/WemadeMir3/Object2c.Lib"
  ),
  [string]$OutputRoot = "../tile-review/green-object-candidates",
  [int]$TopPerLib = 36,
  [int]$MaxWidth = 512,
  [int]$MaxHeight = 512
)

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalGreenObjectScanLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalGreenObjectScanLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalGreenObjectScanLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalGreenObjectScanImage ReadImage(int index)
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

        return new CrystalGreenObjectScanImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalGreenObjectScanImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalGreenObjectScanImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Get-GreenScore($bitmap) {
  $visible = 0
  $green = 0
  $stepY = [Math]::Max(1, [Math]::Floor($bitmap.Height / 40))
  $stepX = [Math]::Max(1, [Math]::Floor($bitmap.Width / 40))
  for ($y = 0; $y -lt $bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $bitmap.Width; $x += $stepX) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -le 0) { continue }
      $visible++
      if ($pixel.G -gt ($pixel.R * 1.08) -and $pixel.G -gt ($pixel.B * 1.05) -and $pixel.G -gt 35) {
        $green++
      }
    }
  }
  if ($visible -eq 0) { return 0 }
  $greenRatio = $green / $visible
  $heightWeight = [Math]::Min(2.0, $bitmap.Height / 96.0)
  $areaWeight = [Math]::Min(1.5, ($bitmap.Width * $bitmap.Height) / 12000.0)
  return [Math]::Round($greenRatio * 1000 * $heightWeight * $areaWeight, 3)
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$imageRoot = Join-Path $outRoot "images"
New-Item -ItemType Directory -Force -Path $imageRoot | Out-Null

$allCandidates = New-Object System.Collections.Generic.List[object]
foreach ($mapLib in $MapLibs) {
  $libPath = Join-Path (Resolve-Path $DataRoot) $mapLib
  if (-not (Test-Path $libPath)) { continue }
  Write-Output "Scanning $mapLib"
  $candidates = New-Object System.Collections.Generic.List[object]
  $lib = [CrystalGreenObjectScanLib]::new($libPath)
  try {
    for ($frame = 0; $frame -lt $lib.Count; $frame++) {
      $image = $lib.ReadImage($frame)
      if ($null -eq $image) { continue }
      try {
        $bitmap = $image.Bitmap
        if ($bitmap.Width -gt $MaxWidth -or $bitmap.Height -gt $MaxHeight -or $bitmap.Height -lt 48) { continue }
        $score = Get-GreenScore $bitmap
        if ($score -le 10) { continue }
        $candidates.Add([ordered]@{
          source = $mapLib
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
  $lib = [CrystalGreenObjectScanLib]::new($libPath)
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
      <span>$($item.width)x$($item.height), score $($item.score)</span>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Green Object Candidates</title>
    <style>
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      p { margin: 0; color: #aaa; }
      main { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: 12px; }
      .tile { border: 1px solid #333; background: #1b1b1b; padding: 8px; display: grid; gap: 6px; }
      img { width: 128px; height: 128px; object-fit: contain; image-rendering: pixelated; background: #050505; justify-self: center; }
      strong, b, span { display: block; overflow-wrap: anywhere; }
      span { color: #aaa; font-size: 11px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Green Object Candidates</h1>
      <p>Ranked by tall/large green pixels. Tell me source + frame for anything useful.</p>
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
