param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterRoot = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Direction = 6
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

# Crystal MonsterObject.DrawBlend formulas for direction 6 (south-west lane).
$configs = @(
  @{
    Index = 215
    Label = "Hell Slasher"
    # Attack1 blend only on frame indices 2-5: (304 + FrameIndex + Direction * 4) - 2
    SrcFrames = @($null, $null, (304 + 2 + ($Direction * 4) - 2), (304 + 3 + ($Direction * 4) - 2), (304 + 4 + ($Direction * 4) - 2), (304 + 5 + ($Direction * 4) - 2))
  },
  @{
    Index = 216
    Label = "Hell Pirate"
    # Pirate slash overlay is Attack2 in Crystal; map onto attack1 frames 3-5.
    SrcFrames = @($null, $null, $null, (280 + 3 + ($Direction * 4) - 3), (280 + 4 + ($Direction * 4) - 3), (280 + 5 + ($Direction * 4) - 3))
  },
  @{
    Index = 217
    Label = "Hell Cannibal"
    SrcFrames = @(304, 305, 306, 307, 308, 309)
  },
  @{
    Index = 218
    Label = "Hell Keeper"
    # Keeper uses Attack2 blend at 40 + FrameIndex; attack1 has 8 frames in our atlas.
    SrcFrames = @(40, 41, 42, 43, 44, 45, 46, 47)
  },
  @{
    Index = 219
    Label = "Hell Bolt"
    # Cast burst on the bolt body during Attack1 (Crystal standing effect at 304).
    SrcFrames = @(304, 305, 306, 307, 308, 309, 310, 311, 312, 313)
  },
  @{
    Index = 220
    Label = "Witch Doctor"
    SrcFrames = @(304, 305, 306, 307, 308, 309, 310, 311, 312, 313)
  }
)

function Append-AttackBlend($config) {
  $index = [int]$config.Index
  $atlasPath = Join-Path $MonsterRoot "$index.json"
  $pngPath = Join-Path $MonsterRoot "$index.png"
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Missing atlas: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Missing sheet: $pngPath" }

  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $library)) { throw "Missing lib: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  if ($atlas.actions.attack1Blend) {
    Write-Host "Skip $($config.Label) ($index): attack1Blend already present"
    return
  }

  $attackCount = @($atlas.actions.attack1.frames).Count
  if ($attackCount -le 0) { throw "$index has no attack1 frames" }

  $srcFrames = @($config.SrcFrames)
  if ($srcFrames.Count -lt $attackCount) {
    $srcFrames = $srcFrames + (@($null) * ($attackCount - $srcFrames.Count))
  } elseif ($srcFrames.Count -gt $attackCount) {
    $srcFrames = $srcFrames[0..($attackCount - 1)]
  }

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
    for ($i = 0; $i -lt $attackCount; $i++) {
      $src = $srcFrames[$i]
      if ($null -eq $src) {
        $blendFrames += [ordered]@{
          slot = $existingSlots + $i
          srcFrame = -1
          w = 0
          h = 0
          offsetX = 0
          offsetY = 0
          empty = $true
        }
        continue
      }
      $image = $lib.ReadImage([int]$src)
      if ($null -eq $image) {
        Write-Warning "$($config.Label) missing blend frame $src (attack frame $i)"
        $blendFrames += [ordered]@{
          slot = $existingSlots + $i
          srcFrame = [int]$src
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

  if (-not ($blendFrames | Where-Object { -not $_.empty })) {
    Write-Warning "Skip $($config.Label) ($index): no drawable blend frames"
    foreach ($frame in $blendFrames) { if ($frame.image) { $frame.image.Dispose() } }
    return
  }

  $existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()
  try {
    $newWidth = $slotWidth * ($existingSlots + $attackCount)
    $sheet = [System.Drawing.Bitmap]::new($newWidth, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)
      foreach ($frame in $blendFrames) {
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
  $actions.attack1Blend = [ordered]@{
    interval = $atlas.actions.attack1.interval
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
  if ($atlas.projectile) { $output.projectile = $atlas.projectile }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Updated $($config.Label) ($index): attack1Blend ($attackCount frames)"
}

foreach ($config in $configs) {
  Append-AttackBlend $config
}
