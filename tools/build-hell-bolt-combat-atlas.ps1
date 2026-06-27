#!/usr/bin/env pwsh
# Hell Bolt (219) — Crystal-accurate combat FX:
#   Body clips stay on fixed 148px slots; spell FX packed at sheetX with each frame's real width.
#   castEffect @304 x11 @100ms | targetBurst @315 x10 @60ms on target
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 219
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
$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($prop.Name -eq "attack1Blend") { continue }
  $actions[$prop.Name] = $prop.Value
}

$baseSlots = 0
foreach ($action in $actions.GetEnumerator()) {
  foreach ($frame in $action.Value.frames) {
    $baseSlots = [Math]::Max($baseSlots, [int]$frame.slot + 1)
  }
}

$castSrc = 304..314
$hitSrc = 315..324

function Read-FrameMeta($lib, [int]$srcFrame) {
  $image = $lib.ReadImage($srcFrame)
  if ($null -eq $image) { return $null }
  return [pscustomobject]@{
    srcFrame = $srcFrame
    w = $image.Bitmap.Width
    h = $image.Bitmap.Height
    offsetX = $image.OffsetX
    offsetY = $image.OffsetY
    image = $image
  }
}

$packed = @()
$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
try {
  foreach ($src in $castSrc) {
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { Write-Warning "Missing cast frame $src"; continue }
    $packed += [pscustomobject]@{ kind = "cast"; meta = $meta }
  }
  foreach ($src in $hitSrc) {
    $meta = Read-FrameMeta $lib $src
    if ($null -eq $meta) { Write-Warning "Missing hit frame $src"; continue }
    $packed += [pscustomobject]@{ kind = "hit"; meta = $meta }
  }
}
finally {
  $lib.Dispose()
}

if ($packed.Count -lt 2) { throw "Could not read Hell Bolt FX frames from lib" }

$bodyWidth = $baseSlots * $slotWidth
$sheetHeight = $slotHeight
foreach ($entry in $packed) {
  $sheetHeight = [Math]::Max($sheetHeight, [int]$entry.meta.h)
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()

$sheetX = $bodyWidth
$castJson = @()
$hitJson = @()
try {
  $newWidth = $bodyWidth
  foreach ($entry in $packed) { $newWidth += [int]$entry.meta.w }

  $sheet = [System.Drawing.Bitmap]::new($newWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    # Body region only — first baseSlots columns at 148px, top slotHeight row.
    $graphics.DrawImage(
      $existingCopy,
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, $slotHeight),
      [System.Drawing.Rectangle]::new(0, 0, $bodyWidth, [Math]::Min($slotHeight, $existingCopy.Height)),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    foreach ($entry in $packed) {
      $m = $entry.meta
      $frameJson = [ordered]@{
        sheetX = $sheetX
        srcFrame = $m.srcFrame
        w = $m.w
        h = $m.h
        offsetX = $m.offsetX
        offsetY = $m.offsetY
      }
      if ($entry.kind -eq "cast") { $castJson += $frameJson } else { $hitJson += $frameJson }

      $graphics.DrawImage($m.image.Bitmap, $sheetX, 0, $m.w, $m.h)
      $sheetX += [int]$m.w
      $m.image.Dispose()
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

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetHeight = $sheetHeight
  bodyWidth = $bodyWidth
  actions = $actions
  castEffect = [ordered]@{
    interval = 100
    frames = @($castJson)
  }
  projectile = [ordered]@{
    style = "targetBurst"
    anchor = "target"
    interval = 60
    delayMs = 0
    moveDurationMs = 900
    burstDurationMs = 600
    frames = @($hitJson)
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Hell Bolt $Index : body ${bodyWidth}px + FX packed to ${newWidth}px wide, sheetH=$sheetHeight"
