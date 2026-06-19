param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = "$PSScriptRoot\..\public\monsters",
  [ValidateSet("right", "left")]
  [string]$GuardSide = "right",
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

$config = if ($GuardSide -eq "right") {
  [ordered]@{
    imageIndex = 99
    outputIndex = 371
    projectileLibrary = "Magic2"
    projectileStart = 10
    projectileCount = 5
    projectileStyle = "targetBurst"
    projectileInterval = 60
    rangeBlend = @{ start = 296; count = 5; offset = 0; interval = 100; directional = $false; fixed = $true }
  }
} else {
  [ordered]@{
    imageIndex = 100
    outputIndex = 373
    projectileLibrary = "Magic"
    projectileStart = 10
    projectileCount = 6
    projectileStyle = "travel"
    projectileInterval = 30
    rangeBlend = @{ start = 296; count = 5; offset = 5; interval = 100; directional = $true; fixed = $false }
  }
}

$actions = [ordered]@{
  standing = @{ start = 0; count = 4; offset = 4; interval = 500 }
  walking = @{ start = 32; count = 6; offset = 6; interval = 100 }
  attack1 = @{ start = 80; count = 6; offset = 6; interval = 100 }
  attackRange1 = @{ start = 224; count = 6; offset = 6; interval = 100; directional = $true }
  struck = @{ start = 128; count = 2; offset = 2; interval = 200 }
  die = @{ start = 144; count = 10; offset = 10; interval = 100 }
  dead = @{ start = 153; count = 1; offset = 10; interval = 1000; reverse = $true }
  revive = @{ start = 144; count = 10; offset = 10; interval = 100 }
  attack1Blend = @{ start = 272; count = 3; offset = 3; interval = 100; directional = $true }
  attackRange1Blend = $config.rangeBlend
}

$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $config.imageIndex)
$projectileLibrary = Join-Path $DataRoot ("{0}.Lib" -f $config.projectileLibrary)
$monsterOut = Join-Path (Resolve-Path $OutputRoot) "monster"
New-Item -ItemType Directory -Force -Path $monsterOut | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$frames = New-Object System.Collections.Generic.List[object]
$slot = 0
$slotWidth = 1
$slotHeight = 1
$projSlotWidth = 1
$projSlotHeight = 1

function Add-Frame {
  param($Action, $SrcFrame, $Lib, [switch]$Projectile)
  $image = $Lib.ReadImage($SrcFrame)
  if ($image -ne $null) {
    if ($Projectile) {
      $script:projSlotWidth = [Math]::Max($script:projSlotWidth, $image.Bitmap.Width)
      $script:projSlotHeight = [Math]::Max($script:projSlotHeight, $image.Bitmap.Height)
    } else {
      $script:slotWidth = [Math]::Max($script:slotWidth, $image.Bitmap.Width)
      $script:slotHeight = [Math]::Max($script:slotHeight, $image.Bitmap.Height)
    }
  }
  $frames.Add([pscustomobject]@{
    action = $Action
    slot = $script:slot
    srcFrame = $SrcFrame
    image = $image
    projectile = [bool]$Projectile
  }) | Out-Null
  $script:slot += 1
}

function Resolve-SrcFrame($spec, $actionKey, [int]$i) {
  if ($spec.reverse) { return $spec.start - $i }
  if ($spec.fixed) { return $spec.start + $i }
  if ($spec.directional) { return $spec.start + ($Direction * $spec.offset) + $i }
  return $spec.start + ($Direction * $spec.offset) + $i
}

$lib = [PhaseMonsterLib]::new((Resolve-Path $library))
$projLib = [PhaseMonsterLib]::new((Resolve-Path $projectileLibrary))
try {
  foreach ($action in $actions.GetEnumerator()) {
    $spec = $action.Value
    for ($i = 0; $i -lt $spec.count; $i++) {
      $srcFrame = Resolve-SrcFrame $spec $action.Key $i
      Add-Frame -Action $action.Key -SrcFrame $srcFrame -Lib $lib
    }
  }
  for ($i = 0; $i -lt $config.projectileCount; $i++) {
    Add-Frame -Action "projectile" -SrcFrame ($config.projectileStart + $i) -Lib $projLib -Projectile
  }

  $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    foreach ($frame in $frames) {
      if ($frame.image -eq $null) { continue }
      $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
    }
    $sheet.Save((Join-Path $monsterOut "$($config.outputIndex).png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }

  $jsonActions = [ordered]@{}
  foreach ($action in $actions.GetEnumerator()) {
    $actionFrames = @()
    foreach ($frame in $frames | Where-Object { $_.action -eq $action.Key }) {
      if ($frame.image -eq $null) {
        $actionFrames += [ordered]@{ slot = $frame.slot; srcFrame = $frame.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
      } else {
        $actionFrames += [ordered]@{
          slot = $frame.slot
          srcFrame = $frame.srcFrame
          w = $frame.image.Bitmap.Width
          h = $frame.image.Bitmap.Height
          offsetX = $frame.image.OffsetX
          offsetY = $frame.image.OffsetY
        }
      }
    }
    $jsonActions[$action.Key] = [ordered]@{ interval = $action.Value.interval; frames = @($actionFrames) }
  }

  $projectileFrames = @()
  foreach ($frame in $frames | Where-Object { $_.action -eq "projectile" }) {
    if ($frame.image -eq $null) {
      $projectileFrames += [ordered]@{ slot = $frame.slot; srcFrame = $frame.srcFrame; w = 0; h = 0; offsetX = 0; offsetY = 0; empty = $true }
    } else {
      $projectileFrames += [ordered]@{
        slot = $frame.slot
        srcFrame = $frame.srcFrame
        w = $frame.image.Bitmap.Width
        h = $frame.image.Bitmap.Height
        offsetX = $frame.image.OffsetX
        offsetY = $frame.image.OffsetY
      }
    }
  }

  $atlas = [ordered]@{
    layer = "monster"
    index = $config.outputIndex
    direction = $Direction
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    actions = $jsonActions
    projectile = [ordered]@{
      style = $config.projectileStyle
      interval = $config.projectileInterval
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      frameSlotWidth = $projSlotWidth
      frameSlotHeight = $projSlotHeight
      delayMs = 0
      moveDurationMs = 500
      burstDurationMs = 300
      frames = @($projectileFrames)
    }
  }

  [System.IO.File]::WriteAllText((Join-Path $monsterOut "$($config.outputIndex).json"), ($atlas | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
}
finally {
  foreach ($frame in $frames) {
    if ($frame.image -ne $null) { $frame.image.Dispose() }
  }
  $lib.Dispose()
  $projLib.Dispose()
}

Write-Output "Built Prajna $GuardSide guard image=$($config.imageIndex) -> $($config.outputIndex) ($($frames.Count) slots, ${slotWidth}x${slotHeight})"
