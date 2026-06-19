param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$AtlasPath = "$PSScriptRoot\..\public\monsters\monster\34.json",
  [int]$Index = 34,
  [int]$Direction = 6,
  [int]$BlendStart = 224,
  [int]$BlendOffset = 6,
  [int]$BlendCount = 6,
  [string]$BlendAction = "attack1Blend"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("PhaseMonsterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class PhaseMonsterLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public PhaseMonsterLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public PhaseMonsterImage ReadImage(int index)
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

        return new PhaseMonsterImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class PhaseMonsterImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public PhaseMonsterImage(Bitmap bitmap, short offsetX, short offsetY)
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

$atlasPath = Resolve-Path $AtlasPath
$atlasDir = Split-Path $atlasPath -Parent
$pngPath = Join-Path $atlasDir "$Index.png"
$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
if (-not (Test-Path -LiteralPath $library)) { throw "Monster library not found: $library" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Monster sheet not found: $pngPath" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
$existingSlots = 0
foreach ($action in $atlas.actions.PSObject.Properties) {
  foreach ($frame in $action.Value.frames) {
    $existingSlots = [Math]::Max($existingSlots, [int]$frame.slot + 1)
  }
}

$blendFrames = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  for ($i = 0; $i -lt $BlendCount; $i++) {
    $srcFrame = $BlendStart + ($Direction * $BlendOffset) + $i
    $image = $lib.ReadImage($srcFrame)
    if ($null -eq $image) {
      Write-Warning "Missing blend frame $srcFrame"
      $blendFrames += [ordered]@{
        slot = $existingSlots + $i
        srcFrame = $srcFrame
        w = 0
        h = 0
        offsetX = 0
        offsetY = 0
        empty = $true
      }
      continue
    }
    $blendFrames += [ordered]@{
      slot = $existingSlots + $i
      srcFrame = $srcFrame
      w = $image.Bitmap.Width
      h = $image.Bitmap.Height
      offsetX = $image.OffsetX
      offsetY = $image.OffsetY
      image = $image
    }
  }
}
finally {
  $lib.Dispose()
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()
try {
  $newWidth = $slotWidth * ($existingSlots + $BlendCount)
  $sheet = [System.Drawing.Bitmap]::new($newWidth, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)
    foreach ($frame in $blendFrames) {
      if ($null -eq $frame.image) { continue }
      $graphics.DrawImage(
        $frame.image.Bitmap,
        [int]$frame.slot * $slotWidth,
        0,
        $frame.image.Bitmap.Width,
        $frame.image.Bitmap.Height
      )
    }
    $tempPath = "$pngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
finally {
  $existingCopy.Dispose()
}

$jsonBlendFrames = @()
foreach ($frame in $blendFrames) {
  if ($frame.empty) {
    $jsonBlendFrames += [ordered]@{
      slot = $frame.slot
      srcFrame = $frame.srcFrame
      w = 0
      h = 0
      offsetX = 0
      offsetY = 0
      empty = $true
    }
  } else {
    $jsonBlendFrames += [ordered]@{
      slot = $frame.slot
      srcFrame = $frame.srcFrame
      w = $frame.w
      h = $frame.h
      offsetX = $frame.offsetX
      offsetY = $frame.offsetY
    }
    $frame.image.Dispose()
  }
}

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  $actions[$prop.Name] = $prop.Value
}
$actions[$BlendAction] = [ordered]@{
  interval = $actions.attack1.interval
  frames = @($jsonBlendFrames)
}

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  actions = $actions
}
$json = $output | ConvertTo-Json -Depth 20 -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, $json, $utf8NoBom)
Write-Output "Appended $BlendCount $BlendAction frames to monster $Index (slots $existingSlots-$($existingSlots + $BlendCount - 1))"
