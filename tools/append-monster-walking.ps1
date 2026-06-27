param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int[]]$Indexes = @(247),
  [int]$Direction = 6,
  [int]$WalkStart = 32,
  [int]$WalkCount = 6,
  [int]$WalkOffset = 6,
  [int]$WalkInterval = 200
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
public sealed class PhaseMonsterLib : IDisposable {
  private readonly FileStream stream;
  private readonly BinaryReader reader;
  private readonly int[] offsets;
  public PhaseMonsterLib(string path) {
    stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    reader = new BinaryReader(stream);
    int version = reader.ReadInt32();
    int count = reader.ReadInt32();
    if (version >= 3) reader.ReadInt32();
    offsets = new int[count];
    for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
  }
  public PhaseMonsterImage ReadImage(int index) {
    if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
    stream.Position = offsets[index];
    short w = reader.ReadInt16();
    short h = reader.ReadInt16();
    short ox = reader.ReadInt16();
    short oy = reader.ReadInt16();
    reader.ReadInt16(); reader.ReadInt16();
    byte shadow = reader.ReadByte();
    int len = reader.ReadInt32();
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

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Test-WalkingPresent($atlas) {
  $frames = $atlas.actions.walking.frames
  if (-not $frames) { return $false }
  foreach ($frame in $frames) {
    if (-not $frame.empty -and [int]$frame.w -gt 0) { return $true }
  }
  return $false
}

function Append-Walking($index) {
  $atlasPath = Join-Path $MonsterRoot "$index.json"
  $pngPath = Join-Path $MonsterRoot "$index.png"
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }

  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  if (Test-WalkingPresent $atlas) {
    Write-Host "Skip $index : walking already present"
    return
  }

  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight
  $existingSlots = 0
  foreach ($action in $atlas.actions.PSObject.Properties) {
    foreach ($frame in $action.Value.frames) {
      $existingSlots = [Math]::Max($existingSlots, [int]$frame.slot + 1)
    }
  }

  $walkFrames = @()
  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  try {
    for ($i = 0; $i -lt $WalkCount; $i++) {
      $srcFrame = $WalkStart + ($Direction * $WalkOffset) + $i
      $image = $lib.ReadImage($srcFrame)
      if ($null -eq $image) {
        Write-Warning "$index missing walk frame $srcFrame"
        $walkFrames += [ordered]@{
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
      $slotWidth = [Math]::Max($slotWidth, $image.Bitmap.Width)
      $slotHeight = [Math]::Max($slotHeight, $image.Bitmap.Height)
      $walkFrames += [ordered]@{
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

  if (-not ($walkFrames | Where-Object { -not $_.empty })) {
    Write-Warning "Skip $index : no drawable walk frames"
    foreach ($frame in $walkFrames) { if ($frame.image) { $frame.image.Dispose() } }
    return
  }

  $existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()
  try {
    $newWidth = $slotWidth * ($existingSlots + $WalkCount)
    $sheet = [System.Drawing.Bitmap]::new($newWidth, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)
      foreach ($frame in $walkFrames) {
        if ($null -eq $frame.image) { continue }
        $graphics.DrawImage($frame.image.Bitmap, [int]$frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
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

  $jsonWalkFrames = @()
  foreach ($frame in $walkFrames) {
    if ($frame.empty) {
      $jsonWalkFrames += [ordered]@{
        slot = $frame.slot
        srcFrame = $frame.srcFrame
        w = 0
        h = 0
        offsetX = 0
        offsetY = 0
        empty = $true
      }
    } else {
      $jsonWalkFrames += [ordered]@{
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
  $actions.walking = [ordered]@{
    interval = $WalkInterval
    frames = @($jsonWalkFrames)
  }

  $output = [ordered]@{
    layer = $atlas.layer
    index = $atlas.index
    direction = $atlas.direction
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    actions = $actions
  }
  if ($atlas.projectile) { $output.projectile = $atlas.projectile }

  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Updated $index : walking ($WalkCount frames)"
}

foreach ($index in $Indexes) {
  Append-Walking $index
}
