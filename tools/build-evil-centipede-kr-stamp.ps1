param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/d606.map",
  [string]$OutputRoot = "../public/mapstamps",
  [int]$CropX = 69,
  [int]$CropY = 156,
  [int]$CropWCells = 29,
  [int]$CropHCells = 30,
  [int]$FocusMapX = 83,
  [int]$FocusMapY = 168,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not ("CrystalKrStampLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalKrStampLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;

    public CrystalKrStampLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalKrStampImage ReadImage(int index)
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

        return new CrystalKrStampImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalKrStampImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalKrStampImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Get-MapLibRelativePath([int]$slot) {
  if ($slot -eq 0) { return "Map/WemadeMir2/Tiles.Lib" }
  if ($slot -eq 1) { return "Map/WemadeMir2/SmTiles.Lib" }
  if ($slot -eq 2) { return "Map/WemadeMir2/Objects.Lib" }
  if ($slot -ge 3 -and $slot -le 28) { return "Map/WemadeMir2/Objects$($slot - 1).Lib" }
  if ($slot -eq 90) { return "Map/WemadeMir2/Objects_32bit.Lib" }
  return $null
}

function Read-Type1Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $xor = [BitConverter]::ToInt16($bytes, 23)
  $width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
  $count = $width * $height
  $back = [long[]]::new($count)
  $middle = [int[]]::new($count)
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)

  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $middle[$i] = [BitConverter]::ToInt16($bytes, $offset + 4) -bxor $xor
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
      $slot = [int]$bytes[$offset + 12] + 2
      if ($slot -eq 102) { $slot = 90 }
      if ($slot -ge 255) { $slot = -1 }
      $frontIndex[$i] = $slot
      $offset += 15
    }
  }

  return [pscustomobject]@{
    Width = $width
    Height = $height
    Back = $back
    Middle = $middle
    Front = $front
    FrontIndex = $frontIndex
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) {
  return ($x * $map.Height) + $y
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

$loadedLibs = @{}
$loadedImages = @{}

function Get-MapLib([int]$slot) {
  $key = [string]$slot
  if ($loadedLibs.ContainsKey($key)) { return $loadedLibs[$key] }
  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) {
    $loadedLibs[$key] = $null
    return $null
  }
  $path = Join-Path (Resolve-Path $DataRoot) $relative
  if (-not (Test-Path $path)) {
    $loadedLibs[$key] = $null
    return $null
  }
  $lib = [CrystalKrStampLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$index) {
  if ($index -lt 0) { return $null }
  $key = "$slot`:$index"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }
  $lib = Get-MapLib $slot
  if ($null -eq $lib) {
    $loadedImages[$key] = $null
    return $null
  }
  $image = $lib.ReadImage($index)
  $loadedImages[$key] = $image
  return $image
}

$map = Read-Type1Map $MapPath
$CropX = [Math]::Max(0, [Math]::Min($CropX, $map.Width - 1))
$CropY = [Math]::Max(0, [Math]::Min($CropY, $map.Height - 1))
$CropWCells = [Math]::Min($CropWCells, $map.Width - $CropX)
$CropHCells = [Math]::Min($CropHCells, $map.Height - $CropY)

$assets = [ordered]@{}
$layers = New-Object System.Collections.Generic.List[object]
$assetList = New-Object System.Collections.Generic.List[object]

function Add-Layer([int]$slotId, [int]$frame, [int]$mapX, [int]$mapY, [int]$x, [int]$y, [bool]$floorSized, [string]$Kind) {
  $image = Get-MapImage $slotId $frame
  if ($null -eq $image) { return }
  $key = "$slotId`:$frame"
  if (-not $assets.Contains($key)) {
    $assets[$key] = [pscustomobject]@{
      Key = $key
      SourceSlot = $slotId
      SourceFrame = $frame
      Slot = $assetList.Count
      W = $image.Bitmap.Width
      H = $image.Bitmap.Height
      Image = $image
    }
    $assetList.Add($assets[$key])
  }
  $asset = $assets[$key]
  $layers.Add([pscustomobject]@{
    slot = $asset.Slot
    x = $x
    y = $y
    w = $asset.W
    h = $asset.H
    source = $key
    floor = $floorSized
    kind = $Kind
    mapCol = $mapX
    mapRow = $mapY
    inFront = ($Kind -eq "front" -and -not $floorSized -and $mapY -gt $FocusMapY)
  })
}

for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
  for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
    if (($x -band 1) -ne 0 -or ($y -band 1) -ne 0) { continue }
    $cell = Get-CellOffset $map $x $y
    $backImage = $map.Back[$cell]
    if ($backImage -eq 0) { continue }
    $backFrame = ($backImage -band 0x1FFFFFFF) - 1
    if ($backFrame -lt 0) { continue }
    $drawX = ($x - $CropX) * $CellWidth
    $drawY = ($y - $CropY) * $CellHeight
    Add-Layer 0 $backFrame $x $y $drawX $drawY $true "back"
  }
}

for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
  for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
    $cell = Get-CellOffset $map $x $y
    $middleFrame = $map.Middle[$cell] - 1
    if ($middleFrame -lt 0) { continue }
    $image = Get-MapImage 1 $middleFrame
    if ($null -eq $image -or -not (Test-FloorSized $image.Bitmap)) { continue }
    $drawX = ($x - $CropX) * $CellWidth
    $drawY = ($y - $CropY) * $CellHeight
    Add-Layer 1 $middleFrame $x $y $drawX $drawY $true "middle"
  }
}

for ($pass = 0; $pass -lt 2; $pass++) {
  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image) { continue }
      $floorSized = Test-FloorSized $image.Bitmap
      if (($pass -eq 0 -and -not $floorSized) -or ($pass -eq 1 -and $floorSized)) { continue }
      $drawX = ($x - $CropX) * $CellWidth
      $drawY = if ($floorSized) {
        ($y - $CropY) * $CellHeight
      } else {
        (($y - $CropY) + 1) * $CellHeight - $image.Bitmap.Height
      }
      Add-Layer $frontSlot $frontFrame $x $y $drawX $drawY $floorSized "front"
    }
  }
}

$slotWidth = [Math]::Max(1, (@($assetList | ForEach-Object { $_.W }) | Measure-Object -Maximum).Maximum)
$slotHeight = [Math]::Max(1, (@($assetList | ForEach-Object { $_.H }) | Measure-Object -Maximum).Maximum)
$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$sheetPath = Join-Path $outRoot "evil-centipede-kr-center-stamp.png"
$sheet = [System.Drawing.Bitmap]::new([Math]::Max(1, $assetList.Count * $slotWidth), $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
try {
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  foreach ($asset in $assetList) {
    $graphics.DrawImageUnscaled($asset.Image.Bitmap, $asset.Slot * $slotWidth, 0)
  }
  $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $sheet.Dispose()
}

$stamp = [ordered]@{
  id = "evil-centipede-kr-center"
  label = "Evil Centipede KR Center"
  sheet = "evil-centipede-kr-center-stamp.png"
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  width = $CropWCells * $CellWidth
  height = $CropHCells * $CellHeight
  focusX = ($FocusMapX - $CropX) * $CellWidth
  focusY = ($FocusMapY - $CropY) * $CellHeight
  anchor = "arenaSpawn"
  offsetX = 0
  offsetY = -4
  spawnMapX = $FocusMapX
  spawnMapY = $FocusMapY
  layers = @($layers.ToArray() | ForEach-Object {
    $entry = [ordered]@{
      slot = $_.slot
      x = $_.x
      y = $_.y
      w = $_.w
      h = $_.h
      source = $_.source
      mapCol = $_.mapCol
      mapRow = $_.mapRow
      kind = $_.kind
    }
    if ($_.floor) { $entry.floor = $true }
    if ($_.inFront) { $entry.inFront = $true }
    $entry
  })
  assets = @($assetList.ToArray() | ForEach-Object {
    [ordered]@{
      slot = $_.Slot
      sourceSlot = $_.SourceSlot
      sourceFrame = $_.SourceFrame
      w = $_.W
      h = $_.H
    }
  })
}

$indexPath = Join-Path $outRoot "index.json"
$existingStamps = @()
if (Test-Path $indexPath) {
  $parsed = Get-Content $indexPath -Raw | ConvertFrom-Json
  $existingStamps = @($parsed.stamps | Where-Object { $_.id -ne "evil-centipede-kr-center" })
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$indexJson = ([ordered]@{ stamps = @($existingStamps + @($stamp)) } | ConvertTo-Json -Depth 8)
[System.IO.File]::WriteAllText($indexPath, $indexJson, $utf8NoBom)

foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

[ordered]@{
  outputRoot = $outRoot
  sheet = $sheetPath
  assetCount = $assetList.Count
  layerCount = $layers.Count
  cropX = $CropX
  cropY = $CropY
  cropWCells = $CropWCells
  cropHCells = $CropHCells
  focusX = $stamp.focusX
  focusY = $stamp.focusY
  mapPath = $MapPath
  focusMapX = $FocusMapX
  focusMapY = $FocusMapY
} | ConvertTo-Json
