param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterDir = "$PSScriptRoot\..\public\monsters\monster",
  [int[]]$Indexes = @(40, 49)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Get-MonsterLibActionFrames {
  param([string]$LibraryPath)
  $actionNames = @{
    0  = "standing"
    1  = "walking"
    9  = "attack1"
    14 = "attackRange1"
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
      $actions[$actionNames[$action]] = @{
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

if (-not ("SwarmMonsterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class SwarmMonsterLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public SwarmMonsterLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public SwarmMonsterImage ReadImage(int index)
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
        return new SwarmMonsterImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class SwarmMonsterImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public SwarmMonsterImage(Bitmap bitmap, short offsetX, short offsetY)
    {
        Bitmap = bitmap;
        OffsetX = offsetX;
        OffsetY = offsetY;
    }

    public void Dispose() { Bitmap.Dispose(); }
}
"@
}

# MirDirection: Up=0, Right=2, Down=4, DownLeft=5, Left=6, UpLeft=7
$directionalActions = @(
  @{ name = "walkNorth"; base = "walking"; direction = 0 }
  @{ name = "walkSouth"; base = "walking"; direction = 4 }
  @{ name = "walkEast"; base = "walking"; direction = 2 }
  @{ name = "walkNorthWest"; base = "walking"; direction = 7 }
  @{ name = "walkSouthWest"; base = "walking"; direction = 5 }
  @{ name = "attackNorthWest"; base = "attack1"; direction = 7 }
  @{ name = "attackSouthWest"; base = "attack1"; direction = 5 }
  @{ name = "standingNorthWest"; base = "standing"; direction = 7 }
  @{ name = "standingSouthWest"; base = "standing"; direction = 5 }
  @{ name = "attackRangeNorthWest"; base = "attackRange1"; direction = 7 }
  @{ name = "attackRangeSouthWest"; base = "attackRange1"; direction = 5 }
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($index in $Indexes) {
  $atlasPath = Join-Path $MonsterDir "$index.json"
  $pngPath = Join-Path $MonsterDir "$index.png"
  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $index)
  if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Atlas not found: $atlasPath" }
  if (-not (Test-Path -LiteralPath $pngPath)) { throw "Sheet not found: $pngPath" }
  if (-not (Test-Path -LiteralPath $library)) { throw "Library not found: $library" }

  $atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json
  $libActions = Get-MonsterLibActionFrames -LibraryPath $library
  $slotWidth = [int]$atlas.slotWidth
  $slotHeight = [int]$atlas.slotHeight
  $nextSlot = 0
  foreach ($action in $atlas.actions.PSObject.Properties) {
    foreach ($frame in $action.Value.frames) {
      $nextSlot = [Math]::Max($nextSlot, [int]$frame.slot + 1)
    }
  }

  $newFrames = New-Object System.Collections.Generic.List[object]
  $lib = [SwarmMonsterLib]::new((Resolve-Path $library))
  try {
    $primaryDirection = [int]$atlas.direction
    if (-not ($atlas.actions.PSObject.Properties.Name -contains "attackRange1")) {
      $rangeSpec = $libActions["attackRange1"]
      if ($null -ne $rangeSpec) {
        for ($i = 0; $i -lt $rangeSpec.count; $i++) {
          $srcFrame = if ($rangeSpec.reverse) {
            $rangeSpec.start - $i
          } else {
            $rangeSpec.start + ($primaryDirection * $rangeSpec.offset) + $i
          }
          $image = $lib.ReadImage($srcFrame)
          $newFrames.Add([pscustomobject]@{
            action = "attackRange1"
            interval = $rangeSpec.interval
            slot = $nextSlot
            srcFrame = $srcFrame
            image = $image
          }) | Out-Null
          $nextSlot += 1
        }
      }
    }

    foreach ($entry in $directionalActions) {
      if ($atlas.actions.PSObject.Properties.Name -contains $entry.name) { continue }
      $spec = $libActions[$entry.base]
      if ($null -eq $spec) { Write-Warning "Missing $($entry.base) in lib $index"; continue }
      for ($i = 0; $i -lt $spec.count; $i++) {
        $srcFrame = if ($spec.reverse) {
          $spec.start - $i
        } else {
          $spec.start + ($entry.direction * $spec.offset) + $i
        }
        $image = $lib.ReadImage($srcFrame)
        $newFrames.Add([pscustomobject]@{
          action = $entry.name
          interval = $spec.interval
          slot = $nextSlot
          srcFrame = $srcFrame
          image = $image
        }) | Out-Null
        $nextSlot += 1
      }
    }
  }
  finally {
    $lib.Dispose()
  }

  if ($newFrames.Count -eq 0) {
    Write-Host "Monster $index already has swarm directional actions"
    continue
  }

  $existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
  $existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
  $existingSheet.Dispose()
  try {
    $newWidth = $slotWidth * $nextSlot
    $sheet = [System.Drawing.Bitmap]::new($newWidth, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($existingCopy, 0, 0, $existingCopy.Width, $existingCopy.Height)
      foreach ($frame in $newFrames) {
        if ($null -eq $frame.image) { continue }
        $graphics.DrawImage($frame.image.Bitmap, $frame.slot * $slotWidth, 0, $frame.image.Bitmap.Width, $frame.image.Bitmap.Height)
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

  $actions = [ordered]@{}
  foreach ($prop in $atlas.actions.PSObject.Properties) {
    $actions[$prop.Name] = $prop.Value
  }
  foreach ($actionName in ($newFrames | ForEach-Object { $_.action } | Select-Object -Unique)) {
    if ($actions.Contains($actionName)) { continue }
    $frames = @($newFrames | Where-Object { $_.action -eq $actionName })
    if ($frames.Count -eq 0) { continue }
    $jsonFrames = @()
    foreach ($frame in $frames) {
      if ($null -eq $frame.image) {
        $jsonFrames += [ordered]@{
          slot = $frame.slot
          srcFrame = $frame.srcFrame
          w = 0
          h = 0
          offsetX = 0
          offsetY = 0
          empty = $true
        }
      } else {
        $jsonFrames += [ordered]@{
          slot = $frame.slot
          srcFrame = $frame.srcFrame
          w = $frame.image.Bitmap.Width
          h = $frame.image.Bitmap.Height
          offsetX = $frame.image.OffsetX
          offsetY = $frame.image.OffsetY
        }
        $frame.image.Dispose()
      }
    }
    $actions[$actionName] = [ordered]@{
      interval = $frames[0].interval
      frames = $jsonFrames
    }
  }

  $output = [ordered]@{
    layer = $atlas.layer
    index = $atlas.index
    direction = $atlas.direction
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    actions = $actions
  }
  [System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Appended swarm directions to monster $index ($($newFrames.Count) frames)"
}
