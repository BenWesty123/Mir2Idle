param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $repoRoot "tile-review\character-select"
}

if (-not ("CrystalSingleLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalSingleLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public int Count { get { return offsets.Length; } }

    public CrystalSingleLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalSingleImage ReadImage(int index)
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
        return new CrystalSingleImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalSingleImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalSingleImage(Bitmap bitmap, short offsetX, short offsetY)
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

$libraryPath = Join-Path $DataRoot "ChrSel.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "ChrSel library not found: $libraryPath"
}

$outRoot = $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$metadata = New-Object System.Collections.Generic.List[object]
$lib = [CrystalSingleLib]::new((Resolve-Path $libraryPath))
try {
  for ($frame = 0; $frame -lt $lib.Count; $frame++) {
    $image = $lib.ReadImage($frame)
    if ($image -eq $null) { continue }
    try {
      $fileName = "frame-{0:D4}.png" -f $frame
      $image.Bitmap.Save((Join-Path $outRoot $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
      $metadata.Add([pscustomobject]@{
        frame = $frame
        file = $fileName
        width = $image.Bitmap.Width
        height = $image.Bitmap.Height
        offsetX = $image.OffsetX
        offsetY = $image.OffsetY
      }) | Out-Null
    }
    finally {
      $image.Dispose()
    }
  }
}
finally {
  $lib.Dispose()
}

$metadata | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outRoot "frames.json")

$cards = $metadata | ForEach-Object {
  @"
<figure>
  <img src="$($_.file)" loading="lazy" />
  <figcaption>Frame $($_.frame)<br />$($_.width)x$($_.height)<br />offset $($_.offsetX),$($_.offsetY)</figcaption>
</figure>
"@
}

@"
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ChrSel.Lib Review</title>
  <style>
    body { margin: 0; background: #151515; color: #ddd; font: 12px Arial, sans-serif; }
    header { position: sticky; top: 0; z-index: 1; background: #202020; padding: 12px; border-bottom: 1px solid #444; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; padding: 12px; }
    figure { margin: 0; background: #242424; border: 1px solid #444; padding: 8px; }
    img { display: block; max-width: 100%; height: auto; margin: 0 auto 8px; background: #080808; image-rendering: pixelated; }
    figcaption { color: #cfcfcf; line-height: 1.35; }
  </style>
</head>
<body>
  <header><strong>ChrSel.Lib Review</strong> - $($metadata.Count) non-empty frames</header>
  <main>
    $($cards -join "`n")
  </main>
</body>
</html>
"@ | Set-Content -LiteralPath (Join-Path $outRoot "index.html")

Write-Output "Exported $($metadata.Count) character select frames to $outRoot"
