param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = "$PSScriptRoot\..\public\monsters",
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

$bossConfigs = @(
  [ordered]@{
    name = "ManectricKing"
    index = 229
    projectileStart = 720
    projectileCount = 12
    projectileInterval = 100
    burstDurationMs = 1200
    burstDelayMs = 150
    attackRange1Start = 504
    attackRange1Count = 6
    attackRange1Offset = 9
  },
  [ordered]@{
    name = "FlameQueen"
    index = 242
    projectileStart = 729
    projectileCount = 10
    projectileInterval = 100
    burstDurationMs = 1000
    burstDelayMs = 150
    # 242.Lib stores range frames at 720-725 (non-directional); offset*direction lands on empty slots.
    attackRange1Start = 720
    attackRange1Count = 6
    attackRange1Fixed = $true
  },
  [ordered]@{
    name = "FlamingMutant"
    index = 200
    projectileStart = 320
    projectileCount = 10
    projectileInterval = 100
    burstDurationMs = 1000
    burstDelayMs = 350
    attackRange1Start = 224
    attackRange1Count = 6
    attackRange1Offset = 6
    projectileAnchor = "target"
  },
  [ordered]@{
    name = "ScalyBeast"
    index = 345
    projectileStart = 392
    projectileCount = 3
    projectileInterval = 100
    burstDurationMs = 300
    burstDelayMs = 0
    projectileAnchor = "boss"
  }
)

$baseActions = [ordered]@{
  standing = @{ start = 0; count = 4; offset = 4; interval = 500 }
  walking = @{ start = 32; count = 6; offset = 6; interval = 100 }
  attack1 = @{ start = 80; count = 6; offset = 6; interval = 100 }
  struck = @{ start = 128; count = 2; offset = 2; interval = 200 }
  die = @{ start = 144; count = 10; offset = 10; interval = 100 }
  dead = @{ start = 153; count = 1; offset = 10; interval = 1000; reverse = $true }
  revive = @{ start = 144; count = 10; offset = 10; interval = 100 }
}

$monsterOut = Join-Path (Resolve-Path $OutputRoot) "monster"
New-Item -ItemType Directory -Force -Path $monsterOut | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Resolve-SrcFrame($spec, [int]$i) {
  if ($spec.reverse) { return $spec.start - $i }
  if ($spec.fixed) { return $spec.start + $i }
  if ($spec.directional) { return $spec.start + ($Direction * $spec.offset) + $i }
  return $spec.start + ($Direction * $spec.offset) + $i
}

foreach ($config in $bossConfigs) {
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $config.index)
  if (-not (Test-Path -LiteralPath $library)) { throw "Monster library not found: $library" }

  $actions = [ordered]@{}
  foreach ($entry in $baseActions.GetEnumerator()) { $actions[$entry.Key] = $entry.Value }
  if ($config.attackRange1Start) {
    $actions.attackRange1 = @{
      start = $config.attackRange1Start
      count = $config.attackRange1Count
      offset = if ($config.attackRange1Offset) { $config.attackRange1Offset } else { 0 }
      interval = 100
      fixed = [bool]$config.attackRange1Fixed
      directional = -not [bool]$config.attackRange1Fixed
    }
  }

  $frames = New-Object System.Collections.Generic.List[object]
  $slot = 0
  $slotWidth = 1
  $slotHeight = 1

  function Add-FrameLocal {
    param($Action, $SrcFrame, $Lib, [switch]$Projectile)
    $image = $Lib.ReadImage($SrcFrame)
    if ($image -ne $null) {
      $script:slotWidth = [Math]::Max($script:slotWidth, $image.Bitmap.Width)
      $script:slotHeight = [Math]::Max($script:slotHeight, $image.Bitmap.Height)
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

  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  try {
    foreach ($action in $actions.GetEnumerator()) {
      $spec = $action.Value
      for ($i = 0; $i -lt $spec.count; $i++) {
        Add-FrameLocal -Action $action.Key -SrcFrame (Resolve-SrcFrame $spec $i) -Lib $lib
      }
    }
    for ($i = 0; $i -lt $config.projectileCount; $i++) {
      Add-FrameLocal -Action "projectile" -SrcFrame ($config.projectileStart + $i) -Lib $lib -Projectile
    }

    $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      foreach ($frame in $frames) {
        if ($frame.image -eq $null) { continue }
        $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
      }
      $sheet.Save((Join-Path $monsterOut "$($config.index).png"), [System.Drawing.Imaging.ImageFormat]::Png)
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
      index = $config.index
      direction = $Direction
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      actions = $jsonActions
      projectile = [ordered]@{
        style = "targetBurst"
        anchor = if ($config.projectileAnchor) { $config.projectileAnchor } else { "boss" }
        interval = $config.projectileInterval
        slotWidth = $slotWidth
        slotHeight = $slotHeight
        frameSlotWidth = $slotWidth
        frameSlotHeight = $slotHeight
        delayMs = 0
        moveDurationMs = 500
        burstDelayMs = $config.burstDelayMs
        burstDurationMs = $config.burstDurationMs
        frames = @($projectileFrames)
      }
    }

    [System.IO.File]::WriteAllText((Join-Path $monsterOut "$($config.index).json"), ($atlas | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
    Write-Output "Built $($config.name) -> $($config.index) ($($frames.Count) slots)"
  }
  finally {
    foreach ($frame in $frames) { if ($frame.image -ne $null) { $frame.image.Dispose() } }
    $lib.Dispose()
  }
}
