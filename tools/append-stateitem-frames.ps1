param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$ItemsPath = "",
  [string]$OutputRoot = "",
  [int[]]$FrameList = @()
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($ItemsPath)) {
  $ItemsPath = Join-Path $repoRoot "src\data\items.json"
}
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $repoRoot "public\ui\character"
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

$metadataPath = Join-Path $OutputRoot "stateitems.json"
$metadata = [ordered]@{}
if (Test-Path -LiteralPath $metadataPath) {
  $existing = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
  foreach ($property in $existing.PSObject.Properties) {
    $metadata[[string]$property.Name] = $property.Value
  }
}

$items = (Get-Content -LiteralPath (Resolve-Path $ItemsPath) -Raw | ConvertFrom-Json).items
$frames = if ($FrameList.Count) {
  @($FrameList)
} else {
  @(
    $items |
      Where-Object { $_.slot -in @("weapon", "armour", "helmet") -and $_.icon -and $_.icon.frame -ne $null } |
      ForEach-Object { [int]$_.icon.frame }
  ) | Sort-Object -Unique
}

$libraryPath = Join-Path $DataRoot "Stateitem.Lib"
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "Stateitem library not found: $libraryPath"
}

$outRoot = Resolve-Path $OutputRoot
$lib = [CrystalSingleLib]::new((Resolve-Path $libraryPath))
$added = 0

try {
  foreach ($frame in $frames) {
    if ($metadata.Contains([string]$frame)) { continue }
    $image = $lib.ReadImage($frame)
    if ($image -eq $null) { continue }
    try {
      $fileName = "stateitem-$frame.png"
      $image.Bitmap.Save((Join-Path $outRoot $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
      $metadata[[string]$frame] = [ordered]@{
        src = "./public/ui/character/$fileName"
        x = $image.OffsetX
        y = $image.OffsetY
        w = $image.Bitmap.Width
        h = $image.Bitmap.Height
      }
      $added++
    }
    finally {
      $image.Dispose()
    }
  }
}
finally {
  $lib.Dispose()
}

$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath
Write-Output "Appended $added stateitem frames (total $($metadata.Count))"
