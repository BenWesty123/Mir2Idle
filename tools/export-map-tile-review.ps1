param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapLib = "Map/WemadeMir2/Tiles.Lib",
  [string]$OutputRoot = "../tile-review/wemade-mir2",
  [int]$StartFrame = 0,
  [int]$FrameCount = 2000,
  [int]$MaxVisible = 800,
  [int]$MaxWidth = 192,
  [int]$MaxHeight = 128,
  [switch]$IncludeAllFrames
)

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalTileReviewLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalTileReviewLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalTileReviewLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalTileReviewImage ReadImage(int index)
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

        return new CrystalTileReviewImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalTileReviewImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalTileReviewImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Test-VisibleTile($bitmap) {
  $visible = 0
  $stepY = [Math]::Max(1, [Math]::Floor($bitmap.Height / 10))
  $stepX = [Math]::Max(1, [Math]::Floor($bitmap.Width / 10))
  for ($y = 0; $y -lt $bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $bitmap.Width; $x += $stepX) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -gt 0 -and ($pixel.R + $pixel.G + $pixel.B) -gt 12) { $visible++ }
    }
  }
  return $visible -gt 8
}

$libPath = Join-Path (Resolve-Path $DataRoot) $MapLib
if (-not (Test-Path $libPath)) {
  throw "Map lib not found: $libPath"
}

$outRoot = Join-Path $PSScriptRoot $OutputRoot
$imageRoot = Join-Path $outRoot "images"
New-Item -ItemType Directory -Force -Path $imageRoot | Out-Null

$items = New-Object System.Collections.Generic.List[object]
$lib = [CrystalTileReviewLib]::new($libPath)
try {
  $endFrame = [Math]::Min($lib.Count - 1, $StartFrame + $FrameCount - 1)
  for ($frame = $StartFrame; $frame -le $endFrame -and $items.Count -lt $MaxVisible; $frame++) {
    $image = $lib.ReadImage($frame)
    if ($null -eq $image) { continue }
    try {
      if ($image.Bitmap.Width -gt $MaxWidth -or $image.Bitmap.Height -gt $MaxHeight -or (-not $IncludeAllFrames -and -not (Test-VisibleTile $image.Bitmap))) {
        continue
      }
      $name = "frame_{0:D6}.png" -f $frame
      $path = Join-Path $imageRoot $name
      $image.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
      $items.Add([ordered]@{
        frame = $frame
        file = "images/$name"
        width = $image.Bitmap.Width
        height = $image.Bitmap.Height
        offsetX = $image.OffsetX
        offsetY = $image.OffsetY
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

$jsonPath = Join-Path $outRoot "tiles.json"
@{
  source = $MapLib
  startFrame = $StartFrame
  frameCount = $FrameCount
  exported = $items.Count
  tiles = @($items.ToArray())
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath

$cards = foreach ($item in $items) {
  @"
    <article class="tile">
      <img src="$($item.file)" alt="Frame $($item.frame)" loading="lazy" />
      <strong>Frame $($item.frame)</strong>
      <span>$($item.width)x$($item.height), offset $($item.offsetX), $($item.offsetY)</span>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Wemade Mir2 Tile Review</title>
    <style>
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      p { margin: 0; color: #aaa; }
      main { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; padding: 12px; }
      .tile { border: 1px solid #333; background: #1b1b1b; padding: 8px; display: grid; gap: 6px; }
      img { width: 96px; height: 64px; object-fit: contain; image-rendering: pixelated; background: #050505; justify-self: center; }
      strong, span { display: block; }
      span { color: #aaa; font-size: 11px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Wemade Mir2 Tile Review</h1>
      <p>Exported $($items.Count) visible tiles from frames $StartFrame to $($StartFrame + $FrameCount - 1). Tell me the frame numbers you want in the builder.</p>
    </header>
    <main>
$($cards -join "`n")
    </main>
  </body>
</html>
"@

$htmlPath = Join-Path $outRoot "index.html"
$html | Set-Content -LiteralPath $htmlPath
Write-Output "Exported $($items.Count) tiles"
Write-Output $outRoot
