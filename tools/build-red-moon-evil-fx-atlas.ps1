#!/usr/bin/env pwsh
# Red Moon Evil (62) — Crystal SpellEffect.RedMoonEvil target hit FX:
#   Libraries.Monsters[RedMoonEvil] frames 32..37 (6), 400ms, Blend=false.
# Packed onto the existing body sheet as projectile (style targetBurst, anchor targets).
param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 62,
  [int]$HitStart = 32,
  [int]$HitCount = 6,
  [int]$HitInterval = 67
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
if ($atlas.projectile -and $atlas.projectile.frames -and @($atlas.projectile.frames).Count -gt 0) {
  Write-Host "Skip Red Moon Evil ($Index): projectile already present"
  exit 0
}

$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
$frameCount = 0
foreach ($prop in $atlas.actions.PSObject.Properties) {
  $frameCount += @($prop.Value.frames).Count
}
$bodyWidth = $slotWidth * $frameCount

$srcSheet = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
$bodyWidth = $srcSheet.Width

$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
$hitImages = @()
$hitMaxH = $slotHeight
try {
  for ($i = 0; $i -lt $HitCount; $i++) {
    $src = $HitStart + $i
    $img = $lib.ReadImage($src)
    if ($null -ne $img) {
      $hitMaxH = [Math]::Max($hitMaxH, $img.Bitmap.Height)
    }
    $hitImages += ,$img
  }

  $hitWidths = @()
  foreach ($img in $hitImages) {
    if ($null -eq $img) { $hitWidths += 1 }
    else { $hitWidths += [Math]::Max(1, $img.Bitmap.Width) }
  }
  $fxWidth = 0
  foreach ($w in $hitWidths) { $fxWidth += $w }
  $sheetHeight = [Math]::Max($srcSheet.Height, $hitMaxH)
  $newWidth = $bodyWidth + $fxWidth

  $sheet = New-Object System.Drawing.Bitmap $newWidth, $sheetHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($sheet)
  $hitJson = @()
  try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcSheet, 0, 0)
    $x = $bodyWidth
    for ($i = 0; $i -lt $hitImages.Count; $i++) {
      $img = $hitImages[$i]
      $w = $hitWidths[$i]
      if ($null -eq $img) {
        $hitJson += [ordered]@{
          sheetX = $x; sheetY = 0; srcFrame = ($HitStart + $i)
          w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true
        }
      } else {
        $g.DrawImage($img.Bitmap, $x, 0)
        $hitJson += [ordered]@{
          sheetX = $x; sheetY = 0; srcFrame = ($HitStart + $i)
          w = [int]$img.Bitmap.Width; h = [int]$img.Bitmap.Height
          offsetX = [int]$img.OffsetX; offsetY = [int]$img.OffsetY
        }
        $img.Dispose()
      }
      $x += $w
    }
  } finally {
    $g.Dispose()
  }

  $srcSheet.Dispose()
  $srcSheet = $null
  $tmpPath = "$pngPath.tmp.png"
  $sheet.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()
  Move-Item -LiteralPath $tmpPath -Destination $pngPath -Force

  # Rebuild JSON from a hashtable so ConvertTo-Json stays happy.
  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    $actions[$prop.Name] = $prop.Value
  }
  $output = [ordered]@{
    layer = $atlas.layer
    index = [int]$atlas.index
    direction = [int]$atlas.direction
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    sheetHeight = $sheetHeight
    bodyWidth = $bodyWidth
    actions = $actions
    projectile = [ordered]@{
      style = "targetBurst"
      anchor = "targets"
      blend = $false
      interval = $HitInterval
      burstDurationMs = 400
      frames = $hitJson
    }
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Red Moon Evil $Index : SpellEffect hit FX $HitStart..$($HitStart + $HitCount - 1) packed (${bodyWidth}px body + ${fxWidth}px FX), sheetH=$sheetHeight"
} finally {
  $lib.Dispose()
  if ($null -ne $srcSheet) { try { $srcSheet.Dispose() } catch {} }
}
