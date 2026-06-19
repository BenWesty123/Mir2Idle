param(
  [string]$WilPath = "",
  [string]$WixPath = "",
  [string]$OutDir = "",
  [int[]]$FrameIndexes = @(),
  [int]$MaxFrames = 12
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("Mir2WilLibrary" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public sealed class Mir2WilLibrary : IDisposable
{
    private readonly FileStream wilStream;
    private readonly BinaryReader wilReader;
    private readonly byte[] palette;
    private readonly int[] positions;
    private readonly bool directColor16;
    public string Title { get; private set; }
    public int Count { get; private set; }

    public Mir2WilLibrary(string wilPath, string wixPath)
    {
        if (string.IsNullOrWhiteSpace(wixPath))
        {
            string dir = Path.GetDirectoryName(wilPath) ?? "";
            string baseName = Path.GetFileNameWithoutExtension(wilPath);
            foreach (string ext in new[] { ".WIX", ".wix", ".Wix" })
            {
                string candidate = Path.Combine(dir, baseName + ext);
                if (File.Exists(candidate)) { wixPath = candidate; break; }
            }
        }
        if (!File.Exists(wilPath)) throw new FileNotFoundException("WIL not found", wilPath);
        if (!File.Exists(wixPath)) throw new FileNotFoundException("WIX not found", wixPath);

        byte[] wixBytes = File.ReadAllBytes(wixPath);
        if (wixBytes.Length < 52) throw new InvalidDataException("WIX too small");
        int wixCount = BitConverter.ToInt32(wixBytes, 44);
        int headerSize = 48;
        if (wixBytes.Length < headerSize + wixCount * 4) throw new InvalidDataException("WIX truncated");
        positions = new int[wixCount];
        Buffer.BlockCopy(wixBytes, headerSize, positions, 0, wixCount * 4);

        wilStream = new FileStream(wilPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        wilReader = new BinaryReader(wilStream);
        byte[] titleBytes = new byte[40];
        wilStream.Position = 0;
        int titleRead = wilStream.Read(titleBytes, 0, titleBytes.Length);
        if (titleRead != titleBytes.Length) throw new InvalidDataException("Failed to read WIL title");
        Title = System.Text.Encoding.ASCII.GetString(titleBytes).TrimEnd('\0', ' ');
        wilStream.Position = 44;
        int wilCount = wilReader.ReadInt32();
        int colorCount = wilReader.ReadInt32();
        int paletteSize = wilReader.ReadInt32();
        if (wilCount != wixCount) throw new InvalidDataException(string.Format("WIL/WIX count mismatch: {0} vs {1}", wilCount, wixCount));
        if (paletteSize <= 0 || paletteSize > 4096) throw new InvalidDataException(string.Format("Unexpected palette size {0}", paletteSize));
        palette = wilReader.ReadBytes(paletteSize);
        directColor16 = colorCount > 256;
        Count = wilCount;
    }

    public Mir2WilFrame ReadFrame(int index)
    {
        if (index < 0 || index >= Count) return null;
        int position = positions[index];
        if (position <= 0 || position + 8 > wilStream.Length) return null;
        wilStream.Position = position;
        short width = wilReader.ReadInt16();
        short height = wilReader.ReadInt16();
        short offsetX = wilReader.ReadInt16();
        short offsetY = wilReader.ReadInt16();
        if (width <= 0 || height <= 0) return null;
        int bytesPerPixel = directColor16 ? 2 : 1;
        int dataSize = width * height * bytesPerPixel;
        if (position + 8 + dataSize > wilStream.Length) return null;
        byte[] pixels = wilReader.ReadBytes(dataSize);
        Bitmap bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try
        {
            int stride = data.Stride;
            IntPtr scan0 = data.Scan0;
            for (int y = 0; y < height; y++)
            {
                int srcY = height - 1 - y;
                int srcRow = srcY * width;
                int dstRow = y * stride;
                for (int x = 0; x < width; x++)
                {
                    int color;
                    if (directColor16)
                    {
                        int src = (srcRow + x) * 2;
                        ushort value = (ushort)(pixels[src] | (pixels[src + 1] << 8));
                        color = Rgb565ToArgb(value);
                    }
                    else
                    {
                        byte idx = pixels[srcRow + x];
                        color = PaletteToArgb(idx);
                    }
                    Marshal.WriteInt32(scan0, dstRow + x * 4, color);
                }
            }
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
        return new Mir2WilFrame(bitmap, offsetX, offsetY, width, height);
    }

    private int PaletteToArgb(byte index)
    {
        if (index == 0) return 0;
        int paletteIndex = index * 4;
        if (paletteIndex + 3 >= palette.Length) return unchecked((int)0xFF808080);
        byte b = palette[paletteIndex];
        byte g = palette[paletteIndex + 1];
        byte r = palette[paletteIndex + 2];
        return (255 << 24) | (r << 16) | (g << 8) | b;
    }

    private int Rgb565ToArgb(ushort value)
    {
        if (value == 0) return 0;
        int r = (value >> 11) & 0x1F;
        int g = (value >> 5) & 0x3F;
        int b = value & 0x1F;
        r = (r << 3) | (r >> 2);
        g = (g << 2) | (g >> 4);
        b = (b << 3) | (b >> 2);
        return (255 << 24) | (r << 16) | (g << 8) | b;
    }

    public void Dispose()
    {
        wilReader.Dispose();
        wilStream.Dispose();
    }
}

public sealed class Mir2WilFrame : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }
    public short Width { get; private set; }
    public short Height { get; private set; }

    public Mir2WilFrame(Bitmap bitmap, short offsetX, short offsetY, short width, short height)
    {
        Bitmap = bitmap;
        OffsetX = offsetX;
        OffsetY = offsetY;
        Width = width;
        Height = height;
    }

    public void Dispose()
    {
        Bitmap.Dispose();
    }
}
'@
}

if (-not $WilPath) { return }

if (-not $WixPath) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($WilPath)
  $dir = [System.IO.Path]::GetDirectoryName($WilPath)
  foreach ($ext in @(".WIX", ".wix")) {
    $candidate = Join-Path $dir ($base + $ext)
    if (Test-Path -LiteralPath $candidate) { $WixPath = $candidate; break }
  }
}

$lib = [Mir2WilLibrary]::new($WilPath, $WixPath)
try {
  Write-Output "Decoded $($lib.Title) with $($lib.Count) frames from $(Split-Path -Leaf $WilPath)"
  if (-not $OutDir) { return }

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $indexes = if ($FrameIndexes -and $FrameIndexes.Length) {
    $FrameIndexes | Where-Object { $_ -ge 0 -and $_ -lt $lib.Count } | Select-Object -Unique
  } else {
    @()
  }
  if (-not $indexes.Count -and $lib.Count -gt 0) {
    $span = [Math]::Max(1, $lib.Count - 1)
    $den = [Math]::Max(1, $MaxFrames - 1)
    $indexes = 0..($MaxFrames - 1) | ForEach-Object { [int][Math]::Round($_ * $span / $den) }
  }

  $exported = 0
  foreach ($index in $indexes) {
    $frame = $lib.ReadFrame($index)
    if ($frame -eq $null) { continue }
    try {
      $outPath = Join-Path $OutDir ("frame-{0:D5}.png" -f $index)
      $frame.Bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $exported += 1
    }
    finally {
      $frame.Dispose()
    }
  }
  Write-Output "Exported $exported frames to $OutDir"
}
finally {
  $lib.Dispose()
}
