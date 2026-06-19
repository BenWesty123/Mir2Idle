param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = "$PSScriptRoot\..\public\monsters",
  [int[]]$Indexes = @(24, 25, 26),
  [int]$Direction = 6,
  [switch]$UseLibFrames = $true
)

function Get-MonsterLibActionFrames {
  param([string]$LibraryPath)

  $actionNames = @{
    0  = "standing"
    1  = "walking"
    9  = "attack1"
    18 = "struck"
    21 = "die"
    22 = "dead"
    24 = "show"
    25 = "hide"
    28 = "revive"
  }

  $fs = [System.IO.File]::OpenRead($LibraryPath)
  $br = New-Object System.IO.BinaryReader($fs)
  try {
    $null = $br.ReadInt32()
    $null = $br.ReadInt32()
    $frameSeek = $br.ReadInt32()
    $fs.Seek($frameSeek, [System.IO.SeekOrigin]::Begin) | Out-Null
    $frameCount = $br.ReadInt32()
    $actions = [ordered]@{}
    for ($i = 0; $i -lt $frameCount; $i++) {
      $action = [int]$br.ReadByte()
      $start = $br.ReadInt32()
      $count = $br.ReadInt32()
      $skip = $br.ReadInt32()
      $interval = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $reverse = $br.ReadBoolean()
      $null = $br.ReadBoolean()
      if (-not $actionNames.ContainsKey($action)) { continue }
      $name = $actionNames[$action]
      $actions[$name] = @{
        start = $start
        count = $count
        offset = $count + $skip
        interval = $interval
        reverse = $reverse
      }
    }
    return $actions
  }
  finally {
    $br.Close()
    $fs.Close()
  }
}

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

$defaultActions = [ordered]@{
  standing = @{ start = 0; count = 4; offset = 4; interval = 500 }
  walking = @{ start = 32; count = 6; offset = 6; interval = 100 }
  attack1 = @{ start = 80; count = 6; offset = 6; interval = 100 }
  struck = @{ start = 128; count = 2; offset = 2; interval = 200 }
  die = @{ start = 144; count = 10; offset = 10; interval = 100 }
  dead = @{ start = 144; count = 1; offset = 10; interval = 1000; frameOffset = 9 }
  revive = @{ start = 144; count = 10; offset = 10; interval = 100 }
}

$monsterOut = Join-Path (Resolve-Path $OutputRoot) "monster"
New-Item -ItemType Directory -Force -Path $monsterOut | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-JsonFile {
  param([string]$Path, [string]$Json)
  [System.IO.File]::WriteAllText($Path, $Json, $utf8NoBom)
}

foreach ($index in $Indexes) {
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $library)) {
    throw "Monster library not found: $library"
  }

  $actions = if ($UseLibFrames) {
    Get-MonsterLibActionFrames -LibraryPath $library
  } else {
    $defaultActions
  }

  $frames = New-Object System.Collections.Generic.List[object]
  $slot = 0
  $slotWidth = 1
  $slotHeight = 1

  $lib = [PhaseMonsterLib]::new((Resolve-Path $library))
  try {
    foreach ($action in $actions.GetEnumerator()) {
      $spec = $action.Value
      for ($i = 0; $i -lt $spec.count; $i++) {
        $srcFrame = if ($spec.reverse) {
          $spec.start - $i
        } else {
          $spec.start + ($Direction * $spec.offset) + $i
        }
        $image = $lib.ReadImage($srcFrame)
        if ($image -ne $null) {
          $slotWidth = [Math]::Max($slotWidth, $image.Bitmap.Width)
          $slotHeight = [Math]::Max($slotHeight, $image.Bitmap.Height)
        }
        $frames.Add([pscustomobject]@{
          action = $action.Key
          slot = $slot
          srcFrame = $srcFrame
          image = $image
        }) | Out-Null
        $slot += 1
      }
    }

    $sheet = [System.Drawing.Bitmap]::new($slotWidth * $frames.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      foreach ($frame in $frames) {
        if ($frame.image -eq $null) { continue }
        $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
      }
      $sheet.Save((Join-Path $monsterOut "$index.png"), [System.Drawing.Imaging.ImageFormat]::Png)
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
          $actionFrames += [ordered]@{
            slot = $frame.slot
            srcFrame = $frame.srcFrame
            w = 0
            h = 0
            offsetX = 0
            offsetY = 0
            empty = $true
          }
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
      $jsonActions[$action.Key] = [ordered]@{
        interval = $action.Value.interval
        frames = @($actionFrames)
      }
    }

    $atlas = [ordered]@{
      layer = "monster"
      index = $index
      direction = $Direction
      slotWidth = $slotWidth
      slotHeight = $slotHeight
      actions = $jsonActions
    }
    Write-JsonFile -Path (Join-Path $monsterOut "$index.json") -Json ($atlas | ConvertTo-Json -Depth 20 -Compress)
  }
  finally {
    foreach ($frame in $frames) {
      if ($frame.image -ne $null) { $frame.image.Dispose() }
    }
    $lib.Dispose()
  }

  Write-Output "Exported monster $index"
}

$layersPath = Join-Path (Resolve-Path $OutputRoot) "layers.json"
if (Test-Path -LiteralPath $layersPath) {
  $layers = Get-Content -LiteralPath $layersPath -Raw | ConvertFrom-Json
  $currentIndexes = @($layers.layers.monster.indexes)
  $mergedIndexes = @($currentIndexes + $Indexes) | Sort-Object -Unique
  $layers.layers.monster.count = ($mergedIndexes | Measure-Object).Count
  $layers.layers.monster.indexes = @($mergedIndexes)
} else {
  $layers = [ordered]@{
    direction = $Direction
    actions = @($actions.Keys)
    layers = [ordered]@{
      monster = [ordered]@{
        count = $Indexes.Count
        indexes = @($Indexes | Sort-Object -Unique)
      }
    }
  }
}
Write-JsonFile -Path $layersPath -Json ($layers | ConvertTo-Json -Depth 20)
