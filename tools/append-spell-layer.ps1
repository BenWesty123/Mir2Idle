param(
  [Parameter(Mandatory = $true)][string]$Library,
  [Parameter(Mandatory = $true)][string]$Atlas,
  [Parameter(Mandatory = $true)][string]$OutputName,
  [Parameter(Mandatory = $true)][int]$BaseIndex,
  [Parameter(Mandatory = $true)][int]$Count,
  [int]$TotalDurationMs = 400,
  [string]$Anchor = "enemy",
  [int]$DelayMs = 0
)

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public CrystalLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalImage ReadImage(int index)
    {
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

        return new CrystalImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalImage(Bitmap bitmap, short offsetX, short offsetY)
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

$libraryPath = Resolve-Path $Library
$atlasPath = Resolve-Path $Atlas
$spellDir = Split-Path $atlasPath
$outputPath = Join-Path $spellDir $OutputName

$lib = [CrystalLib]::new($libraryPath)
$frames = New-Object System.Collections.Generic.List[object]
$images = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1

try {
  for ($slot = 0; $slot -lt $Count; $slot++) {
    $srcFrame = $BaseIndex + $slot
    $image = $lib.ReadImage($srcFrame)
    $images.Add($image)
    $slotWidth = [Math]::Max($slotWidth, $image.Bitmap.Width)
    $slotHeight = [Math]::Max($slotHeight, $image.Bitmap.Height)
    $frames.Add([ordered]@{
      slot = $slot
      srcFrame = $srcFrame
      w = $image.Bitmap.Width
      h = $image.Bitmap.Height
      offsetX = $image.OffsetX
      offsetY = $image.OffsetY
      empty = $false
    })
  }

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  for ($slot = 0; $slot -lt $Count; $slot++) {
    $graphics.DrawImageUnscaled($images[$slot].Bitmap, $slot * $slotWidth, 0)
  }
  $graphics.Dispose()
  $sheet.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()

  $atlasJson = Get-Content $atlasPath -Raw | ConvertFrom-Json
  $layer = [ordered]@{
    sheet = $OutputName
    interval = [Math]::Max(1, [Math]::Round($TotalDurationMs / $Count))
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    library = [System.IO.Path]::GetFileNameWithoutExtension($Library)
    baseIndex = $BaseIndex
    anchor = $Anchor
    delayMs = $DelayMs
    frames = @($frames.ToArray())
  }
  $keptLayers = @($atlasJson.layers | Where-Object { $_.sheet -ne $OutputName })
  $atlasJson.layers = @($keptLayers + ([pscustomobject]$layer))
  $atlasJson | ConvertTo-Json -Depth 20 | Set-Content $atlasPath
  Write-Output "Added $OutputName layer to $Atlas from frames $BaseIndex-$($BaseIndex + $Count - 1)"
}
finally {
  foreach ($image in $images) { $image.Dispose() }
  $lib.Dispose()
}
