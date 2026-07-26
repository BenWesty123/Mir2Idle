param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = ""
)

# Crystal CharacterDialog draws paper-doll wings from Prguse2:
#   wingOffset = WingEffect == 1 ? 2 : 4
#   genderOffset = Male ? 0 : 1
#   Libraries.Prguse2.DrawBlend(1200 + wingOffset + genderOffset, ...)
# Heaven Armour uses visualEffect/WingEffect 1 → male frame 1202.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $repoRoot "public\ui\character"
}

if (-not ("CrystalPaperDollWingLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalPaperDollWingLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public CrystalPaperDollWingLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalPaperDollWingImage ReadImage(int index)
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
        return new CrystalPaperDollWingImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalPaperDollWingImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalPaperDollWingImage(Bitmap bitmap, short offsetX, short offsetY)
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

$libraryPath = Join-Path $DataRoot "Prguse2.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "Prguse2.Lib not found at $libraryPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$lib = [CrystalPaperDollWingLib]::new((Resolve-Path $libraryPath))
$meta = [ordered]@{}

try {
  # effect 1 male/female, effect 2 male/female
  foreach ($frame in @(1202, 1203, 1204, 1205)) {
    $image = $lib.ReadImage($frame)
    if ($image -eq $null) {
      Write-Warning "Missing Prguse2 frame $frame"
      continue
    }
    try {
      $fileName = "paperdoll-wing-$frame.png"
      $image.Bitmap.Save((Join-Path $OutputRoot $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
      $meta[[string]$frame] = [ordered]@{
        src = "./public/ui/character/$fileName"
        x = [int]$image.OffsetX
        y = [int]$image.OffsetY
        w = [int]$image.Bitmap.Width
        h = [int]$image.Bitmap.Height
        blend = $true
      }
      Write-Output ("Exported {0}: {1}x{2} @ ({3},{4})" -f $fileName, $image.Bitmap.Width, $image.Bitmap.Height, $image.OffsetX, $image.OffsetY)
    }
    finally {
      $image.Dispose()
    }
  }
}
finally {
  $lib.Dispose()
}

$metaPath = Join-Path $OutputRoot "paperdoll-wings.json"
$meta | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metaPath
Write-Output "Wrote $metaPath"
