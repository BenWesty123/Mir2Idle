param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = "../public/maptiles",
  [int]$SamplesPerSet = 96
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
    public int Count { get { return offsets.Length; } }

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

$sets = @(
  @{ id = "wemade-mir2"; label = "Wemade Mir2"; file = "Map/WemadeMir2/Tiles.Lib" },
  @{ id = "shanda-mir2"; label = "Shanda Mir2"; file = "Map/ShandaMir2/Tiles.Lib" },
  @{ id = "wemade-mir3"; label = "Wemade Mir3"; file = "Map/WemadeMir3/Tilesc.Lib" },
  @{ id = "wood"; label = "Mir3 Wood"; file = "Map/WemadeMir3/Wood/Tilesc.Lib" },
  @{ id = "sand"; label = "Mir3 Sand"; file = "Map/WemadeMir3/Sand/Tilesc.Lib" },
  @{ id = "snow"; label = "Mir3 Snow"; file = "Map/WemadeMir3/Snow/Tilesc.Lib" },
  @{ id = "forest"; label = "Mir3 Forest"; file = "Map/WemadeMir3/Forest/Tilesc.Lib" }
)

$root = Resolve-Path $DataRoot
$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
$index = [ordered]@{ sets = @() }

function Test-VisibleTile($bitmap) {
  $visible = 0
  for ($y = 0; $y -lt $bitmap.Height; $y += [Math]::Max(1, [Math]::Floor($bitmap.Height / 8))) {
    for ($x = 0; $x -lt $bitmap.Width; $x += [Math]::Max(1, [Math]::Floor($bitmap.Width / 8))) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -gt 0 -and ($pixel.R + $pixel.G + $pixel.B) -gt 10) { $visible++ }
    }
  }
  return $visible -gt 8
}

foreach ($set in $sets) {
  $path = Join-Path $root $set.file
  if (-not (Test-Path $path)) { continue }
  $lib = [CrystalLib]::new($path)
  $picked = New-Object System.Collections.Generic.List[object]
  $images = New-Object System.Collections.Generic.List[object]
  $slotWidth = 1
  $slotHeight = 1
  try {
    for ($i = 0; $i -lt $lib.Count -and $picked.Count -lt $SamplesPerSet; $i++) {
      $image = $lib.ReadImage($i)
      if ($null -eq $image) { continue }
      if ($image.Bitmap.Width -gt 192 -or $image.Bitmap.Height -gt 128 -or -not (Test-VisibleTile $image.Bitmap)) {
        $image.Dispose()
        continue
      }
      $slot = $picked.Count
      $images.Add($image)
      $slotWidth = [Math]::Max($slotWidth, $image.Bitmap.Width)
      $slotHeight = [Math]::Max($slotHeight, $image.Bitmap.Height)
      $picked.Add([ordered]@{
        slot = $slot
        srcFrame = $i
        w = $image.Bitmap.Width
        h = $image.Bitmap.Height
        offsetX = $image.OffsetX
        offsetY = $image.OffsetY
      })
    }

    if ($picked.Count -eq 0) { continue }
    $sheet = [System.Drawing.Bitmap]::new($slotWidth * $picked.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    for ($slot = 0; $slot -lt $picked.Count; $slot++) {
      $graphics.DrawImageUnscaled($images[$slot].Bitmap, $slot * $slotWidth, 0)
    }
    $graphics.Dispose()
    $sheetName = "$($set.id).png"
    $sheetPath = Join-Path $outRoot $sheetName
    $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $sheet.Dispose()

    $index.sets += [ordered]@{
      id = $set.id
      label = $set.label
      sheet = $sheetName
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      tiles = @($picked.ToArray())
    }
    Write-Output "$($set.label): exported $($picked.Count) tiles"
  }
  finally {
    foreach ($image in $images) { $image.Dispose() }
    $lib.Dispose()
  }
}

$index | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $outRoot "index.json")
