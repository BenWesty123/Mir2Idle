param(
  [Parameter(Mandatory = $true)][string]$NpcId,
  [Parameter(Mandatory = $true)][int]$Image,
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = "",
  [int]$FrameCount = 4,
  [int]$Interval = 450
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "public\npcs"
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

$libraryPath = Join-Path $DataRoot ("NPC\{0:D2}.Lib" -f $Image)
if (-not (Test-Path -LiteralPath $libraryPath)) {
  $libraryPath = Join-Path $DataRoot ("NPC\{0}.Lib" -f $Image)
}
if (-not (Test-Path -LiteralPath $libraryPath)) {
  throw "NPC library not found for image $Image"
}

$outDir = Join-Path (Resolve-Path $OutputRoot) $NpcId
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$frames = New-Object System.Collections.Generic.List[object]
$slotWidth = 1
$slotHeight = 1

$lib = [CrystalSingleLib]::new((Resolve-Path $libraryPath))
try {
for ($i = 0; $i -lt $FrameCount; $i++) {
    $frameImage = $lib.ReadImage($i)
    if ($frameImage -ne $null) {
      $slotWidth = [Math]::Max($slotWidth, $frameImage.Bitmap.Width)
      $slotHeight = [Math]::Max($slotHeight, $frameImage.Bitmap.Height)
    }
    $frames.Add([pscustomobject]@{ slot = $i; srcFrame = $i; image = $frameImage }) | Out-Null
  }

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($frame in $frames) {
      if ($frame.image -eq $null) { continue }
      $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
    }
    $sheet.Save((Join-Path $outDir "standing.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }

  $jsonFrames = @()
  foreach ($frame in $frames) {
    if ($frame.image -eq $null) {
      $jsonFrames += [ordered]@{ slot = $frame.slot; srcFrame = $frame.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
    } else {
      $jsonFrames += [ordered]@{
        slot = $frame.slot
        srcFrame = $frame.srcFrame
        w = $frame.image.Bitmap.Width
        h = $frame.image.Bitmap.Height
        offsetX = $frame.image.OffsetX
        offsetY = $frame.image.OffsetY
        empty = $false
      }
    }
  }

  $atlas = [ordered]@{
    npcId = $NpcId
    source = $Source
    layers = @([ordered]@{
      sheet = "standing.png"
      interval = $Interval
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      library = "{0:D2}" -f $Image
      baseIndex = 0
      anchor = "player"
      delayMs = 0
      frames = @($jsonFrames)
    })
  }
  $atlas | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outDir "atlas.json")
}
finally {
  foreach ($frame in $frames) {
    if ($frame.image -ne $null) { $frame.image.Dispose() }
  }
  $lib.Dispose()
}

Write-Output "Exported NPC $NpcId from image $Image"
