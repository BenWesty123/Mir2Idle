#!/usr/bin/env pwsh
# Hell Keeper (218) — export Crystal Attack2 body (lib frames 22-31) for magic swings.
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
if ($atlas.actions.attack2) {
  Write-Host "Skip Hell Keeper ($Index): attack2 already present"
  exit 0
}

$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
$oldBodyWidth = [int]$atlas.bodyWidth
$attack2Src = 22..31
$firstSlot = 22
$newBodyWidth = ($firstSlot + $attack2Src.Count) * $slotWidth
$insertWidth = $newBodyWidth - $oldBodyWidth

$attack2Frames = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  $slot = $firstSlot
  foreach ($src in $attack2Src) {
    $image = $lib.ReadImage([int]$src)
    if ($null -eq $image) { Write-Warning "Missing attack2 frame $src"; $slot++; continue }
    $attack2Frames += [ordered]@{
      slot = $slot
      srcFrame = [int]$src
      w = $image.Bitmap.Width
      h = $image.Bitmap.Height
      offsetX = $image.OffsetX
      offsetY = $image.OffsetY
      image = $image
    }
    $slot++
  }
}
finally {
  $lib.Dispose()
}

if ($attack2Frames.Count -lt 1) { throw "Could not read Hell Keeper attack2 frames from lib" }

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

try {
  $newWidth = $existingCopy.Width + $insertWidth
  $sheet = [System.Drawing.Bitmap]::new($newWidth, [Math]::Max($slotHeight, $existingCopy.Height), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($existingCopy, 0, 0, $oldBodyWidth, $existingCopy.Height)
    foreach ($entry in $attack2Frames) {
      $x = [int]$entry.slot * $slotWidth
      $graphics.DrawImage($entry.image.Bitmap, $x, 0, $entry.image.Bitmap.Width, $entry.image.Bitmap.Height)
      $entry.image.Dispose()
    }
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new($newBodyWidth, 0, $existingCopy.Width - $oldBodyWidth, $existingCopy.Height),
      [System.Drawing.Rectangle]::new($oldBodyWidth, 0, $existingCopy.Width - $oldBodyWidth, $existingCopy.Height),
      [System.Drawing.GraphicsUnit]::Pixel
    )

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

function Shift-SheetX($frames) {
  if ($null -eq $frames) { return $frames }
  $out = @()
  foreach ($frame in @($frames)) {
    $copy = [ordered]@{}
    foreach ($prop in $frame.PSObject.Properties) { $copy[$prop.Name] = $prop.Value }
    if ($null -ne $copy.sheetX) { $copy.sheetX = [int]$copy.sheetX + $insertWidth }
    $out += $copy
  }
  return $out
}

$attack2Json = @()
foreach ($entry in $attack2Frames) {
  $attack2Json += [ordered]@{
    slot = $entry.slot
    srcFrame = $entry.srcFrame
    w = $entry.w
    h = $entry.h
    offsetX = $entry.offsetX
    offsetY = $entry.offsetY
  }
}

$output = [ordered]@{}
foreach ($prop in $atlas.PSObject.Properties) {
  if ($prop.Name -eq "actions") {
    $actions = [ordered]@{}
    foreach ($actionProp in $prop.Value.PSObject.Properties) {
      $actions[$actionProp.Name] = $actionProp.Value
    }
    $actions.attack2 = [ordered]@{
      interval = 100
      frames = @($attack2Json)
    }
    if ($actions.attack1Blend) {
      $actions.attack1Blend = [ordered]@{
        interval = $actions.attack1Blend.interval
        frames = @(Shift-SheetX $actions.attack1Blend.frames)
      }
    }
    $output.actions = $actions
  } elseif ($prop.Name -eq "castEffect") {
    $output.castEffect = [ordered]@{
      interval = $prop.Value.interval
      frames = @(Shift-SheetX $prop.Value.frames)
    }
  } elseif ($prop.Name -eq "bodyWidth") {
    $output.bodyWidth = $newBodyWidth
  } else {
    $output[$prop.Name] = $prop.Value
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Hell Keeper $Index : attack2 $($attack2Json.Count) frames, body ${newBodyWidth}px (+${insertWidth}px FX shift)"
