#!/usr/bin/env pwsh
# Hell Keeper (218) — Crystal-accurate physical attack castEffect @ lib frames 32-39.
# Magic attack uses existing attack1Blend (Crystal Attack2 draw blend @ 40+FrameIndex).
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 218
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("PhaseMonsterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.IO; using System.IO.Compression; using System.Runtime.InteropServices;
public sealed class PhaseMonsterLib : IDisposable {
  private readonly FileStream stream; private readonly BinaryReader reader; private readonly int[] offsets;
  public PhaseMonsterLib(string path) {
    stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    reader = new BinaryReader(stream);
    int version = reader.ReadInt32(); int count = reader.ReadInt32();
    if (version >= 3) reader.ReadInt32();
    offsets = new int[count];
    for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
  }
  public PhaseMonsterImage ReadImage(int index) {
    if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
    stream.Position = offsets[index];
    short w = reader.ReadInt16(); short h = reader.ReadInt16();
    short ox = reader.ReadInt16(); short oy = reader.ReadInt16();
    reader.ReadInt16(); reader.ReadInt16();
    byte shadow = reader.ReadByte(); int len = reader.ReadInt32();
    bool hasMask = (shadow >> 7) == 1;
    if (w <= 0 || h <= 0 || len <= 0) return null;
    byte[] compressed = reader.ReadBytes(len);
    if (hasMask) { reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); int maskLen = reader.ReadInt32(); reader.ReadBytes(maskLen); }
    byte[] raw;
    using (var input = new MemoryStream(compressed))
    using (var gzip = new GZipStream(input, CompressionMode.Decompress))
    using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); }
    if (raw.Length < w * h * 4) return null;
    Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); }
    finally { bitmap.UnlockBits(data); }
    return new PhaseMonsterImage(bitmap, ox, oy);
  }
  public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class PhaseMonsterImage : IDisposable {
  public Bitmap Bitmap { get; private set; }
  public short OffsetX { get; private set; }
  public short OffsetY { get; private set; }
  public PhaseMonsterImage(Bitmap bitmap, short offsetX, short offsetY) { Bitmap = bitmap; OffsetX = offsetX; OffsetY = offsetY; }
  public void Dispose() { Bitmap.Dispose(); }
}
"@
}

$atlasPath = Join-Path $MonsterRoot "$Index.json"
$pngPath = Join-Path $MonsterRoot "$Index.png"
$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }
if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
if ($atlas.castEffect) {
  Write-Host "Skip Hell Keeper ($Index): castEffect already present"
  exit 0
}

$slotHeight = [int]$atlas.slotHeight
$castSrc = 32..39

$castMeta = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  foreach ($src in $castSrc) {
    $image = $lib.ReadImage([int]$src)
    if ($null -eq $image) { Write-Warning "Missing cast frame $src"; continue }
    $castMeta += [pscustomobject]@{
      srcFrame = [int]$src
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

if ($castMeta.Count -lt 1) { throw "Could not read Hell Keeper cast frames from lib" }

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$sheetX = $existingCopy.Width
$sheetHeight = [Math]::Max($slotHeight, $existingCopy.Height)
foreach ($entry in $castMeta) { $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.h) }

$castJson = @()
try {
  $newWidth = $sheetX
  foreach ($entry in $castMeta) { $newWidth += [int]$entry.w }

  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)

    foreach ($entry in $castMeta) {
      $castJson += [ordered]@{
        sheetX = $sheetX
        srcFrame = $entry.srcFrame
        w = $entry.w
        h = $entry.h
        offsetX = $entry.offsetX
        offsetY = $entry.offsetY
      }
      $graphics.DrawImage($entry.image.Bitmap, $sheetX, 0, $entry.w, $entry.h)
      $sheetX += [int]$entry.w
      $entry.image.Dispose()
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

$output = [ordered]@{}
foreach ($prop in $atlas.PSObject.Properties) {
  if ($prop.Name -ne "castEffect") { $output[$prop.Name] = $prop.Value }
}
$output.castEffect = [ordered]@{
  interval = 100
  frames = @($castJson)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Hell Keeper $Index : appended castEffect ($($castJson.Count) frames), sheet now ${newWidth}px wide"
