param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $repoRoot "public\ui\storage"
}

if (-not ("CrystalStorageUiLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalStorageUiLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public CrystalStorageUiLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalStorageUiImage ReadImage(int index)
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
        return new CrystalStorageUiImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalStorageUiImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalStorageUiImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Export-Frame {
  param(
    [Parameter(Mandatory = $true)][string]$Library,
    [Parameter(Mandatory = $true)][int]$Frame,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $libraryPath = Join-Path $DataRoot "$Library.Lib"
  if (-not (Test-Path -LiteralPath $libraryPath)) {
    throw "Library not found: $libraryPath"
  }

  $lib = [CrystalStorageUiLib]::new((Resolve-Path $libraryPath))
  try {
    $image = $lib.ReadImage($Frame)
    if ($image -eq $null) {
      throw "Frame $Frame not found in $Library"
    }
    try {
      $fileName = "$Name.png"
      $path = Join-Path $OutputRoot $fileName
      $image.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
      return [ordered]@{
        sheet = $fileName
        library = $Library
        frame = $Frame
        width = $image.Bitmap.Width
        height = $image.Bitmap.Height
        offsetX = $image.OffsetX
        offsetY = $image.OffsetY
      }
    }
    finally {
      $image.Dispose()
    }
  }
  finally {
    $lib.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$layers = @(
  Export-Frame -Library "Prguse" -Frame 586 -Name "background"
  Export-Frame -Library "Title" -Frame 0 -Name "title"
  Export-Frame -Library "Title" -Frame 743 -Name "page-1"
  Export-Frame -Library "Title" -Frame 744 -Name "page-1-pressed"
  Export-Frame -Library "Title" -Frame 745 -Name "page-2"
  Export-Frame -Library "Title" -Frame 746 -Name "page-2-pressed"
  Export-Frame -Library "Title" -Frame 483 -Name "rent"
  Export-Frame -Library "Title" -Frame 113 -Name "protect"
  Export-Frame -Library "Title" -Frame 114 -Name "protect-hover"
  Export-Frame -Library "Title" -Frame 115 -Name "protect-pressed"
  Export-Frame -Library "Prguse2" -Frame 360 -Name "close"
  Export-Frame -Library "Prguse2" -Frame 361 -Name "close-hover"
  Export-Frame -Library "Prguse2" -Frame 362 -Name "close-pressed"
)

$atlas = [ordered]@{
  uiId = "storage"
  source = "Crystal Client StorageDialog: Libraries.Prguse frame 586, Libraries.Title storage controls, Libraries.Prguse2 close frames 360-362"
  layers = $layers
}

$atlas | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputRoot "atlas.json")
Write-Output "Exported storage UI to $OutputRoot"
