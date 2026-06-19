param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/0.map",
  [string]$OutputRoot = "../public/mapstamps",
  [int]$CropX = 314,
  [int]$CropY = 234,
  [int]$CropWCells = 44,
  [int]$CropHCells = 42,
  [int]$FocusMapX = 336,
  [int]$FocusMapY = 260,
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

function Read-Type100Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -lt 8 -or $bytes[0] -ne 1 -or $bytes[2] -ne 0x43 -or $bytes[3] -ne 0x23) {
    throw "Only Type100 maps are supported: $path"
  }
  $width = [BitConverter]::ToInt16($bytes, 4)
  $height = [BitConverter]::ToInt16($bytes, 6)
  $count = $width * $height
  $backIndex = New-Object int[] $count
  $back = New-Object long[] $count
  $middleIndex = New-Object int[] $count
  $middle = New-Object int[] $count
  $frontIndex = New-Object int[] $count
  $front = New-Object int[] $count

  $offset = 8
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $backIndex[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset); $offset += 4
      $middleIndex[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $middle[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $frontIndex[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $front[$i] = [BitConverter]::ToInt16($bytes, $offset); $offset += 2
      $offset += 12
    }
  }

  return [pscustomobject]@{
    Width = $width
    Height = $height
    BackIndex = $backIndex
    Back = $back
    MiddleIndex = $middleIndex
    Middle = $middle
    FrontIndex = $frontIndex
    Front = $front
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) {
  return ($x * $map.Height) + $y
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

function Normalize-FrontSlot([int]$slot) {
  if ($slot -eq 102) { return 90 }
  if ($slot -ge 255 -or $slot -lt 0) { return -1 }
  return $slot
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

$map = Read-Type100Map $MapPath
$CropX = [Math]::Max(0, [Math]::Min($CropX, $map.Width - 1))
$CropY = [Math]::Max(0, [Math]::Min($CropY, $map.Height - 1))
$CropWCells = [Math]::Min($CropWCells, $map.Width - $CropX)
$CropHCells = [Math]::Min($CropHCells, $map.Height - $CropY)

$assets = [ordered]@{}
$layers = New-Object System.Collections.Generic.List[object]
$assetList = New-Object System.Collections.Generic.List[object]

function Test-GroundLightGlowFrame([int]$slotId, [int]$frame) {
  # 100x100 ground glow only. Lamp posts are frame 2733; do not skip those.
  return ($slotId -eq 2 -and $frame -ge 2723 -and $frame -le 2732)
}

function Add-Layer([int]$slotId, [int]$frame, [int]$mapX, [int]$mapY, [int]$x, [int]$y, [bool]$floorSized, [string]$Kind) {
  if (Test-GroundLightGlowFrame $slotId $frame) { return }
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
    $cell = Get-CellOffset $map $x $y
    $drawX = ($x - $CropX) * $CellWidth
    $drawY = ($y - $CropY) * $CellHeight

    if (($x -band 1) -eq 0 -and ($y -band 1) -eq 0) {
      $backImage = $map.Back[$cell]
      $backSlot = [int]$map.BackIndex[$cell]
      if ($backImage -ne 0 -and $backSlot -ge 0) {
        $backFrame = ($backImage -band 0x1FFFFFFF) - 1
        if ($backFrame -ge 0) {
          Add-Layer $backSlot $backFrame $x $y $drawX $drawY $true "back"
        }
      }
    }

    $middleFrame = $map.Middle[$cell] - 1
    $middleSlot = [int]$map.MiddleIndex[$cell]
    if ($middleFrame -ge 0 -and $middleSlot -ge 0) {
      $middleImage = Get-MapImage $middleSlot $middleFrame
      if ($null -ne $middleImage -and (Test-FloorSized $middleImage.Bitmap)) {
        Add-Layer $middleSlot $middleFrame $x $y $drawX $drawY $true "middle"
      }
    }

    $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
    $frontSlot = Normalize-FrontSlot ([int]$map.FrontIndex[$cell])
    if ($frontFrame -ge 0 -and $frontSlot -ge 0 -and $frontSlot -ne 200) {
      $frontImage = Get-MapImage $frontSlot $frontFrame
      if ($null -ne $frontImage -and (Test-FloorSized $frontImage.Bitmap)) {
        Add-Layer $frontSlot $frontFrame $x $y $drawX $drawY $true "front"
      }
    }
  }
}

for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
  for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
    $cell = Get-CellOffset $map $x $y
    $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
    $frontSlot = Normalize-FrontSlot ([int]$map.FrontIndex[$cell])
    if ($frontFrame -lt 0 -or $frontSlot -lt 0 -or $frontSlot -eq 200) { continue }
    $frontImage = Get-MapImage $frontSlot $frontFrame
    if ($null -eq $frontImage) { continue }
    if (Test-FloorSized $frontImage.Bitmap) { continue }
    $drawX = ($x - $CropX) * $CellWidth
    $drawY = (($y - $CropY) + 1) * $CellHeight - $frontImage.Bitmap.Height
    Add-Layer $frontSlot $frontFrame $x $y $drawX $drawY $false "front"
  }
}

function Save-StampSheet([System.Collections.Generic.List[object]]$assetList, [int]$slotWidth, [int]$slotHeight, [string]$sheetPath) {
  $count = [Math]::Max(1, $assetList.Count)
  $columns = [Math]::Min($count, 256)
  $rows = [Math]::Ceiling($count / $columns)
  $sheetW = $columns * $slotWidth
  $sheetH = $rows * $slotHeight
  $sheet = [System.Drawing.Bitmap]::new($sheetW, $sheetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    for ($i = 0; $i -lt $assetList.Count; $i++) {
      $asset = $assetList[$i]
      $col = $i % $columns
      $row = [Math]::Floor($i / $columns)
      $graphics.DrawImageUnscaled($asset.Image.Bitmap, $col * $slotWidth, $row * $slotHeight)
      $asset | Add-Member -NotePropertyName SheetCol -NotePropertyValue $col -Force
      $asset | Add-Member -NotePropertyName SheetRow -NotePropertyValue $row -Force
    }
    $dir = Split-Path $sheetPath -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    if (Test-Path $sheetPath) { Remove-Item $sheetPath -Force }
    $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }
  return [pscustomobject]@{ columns = $columns; rows = $rows; width = $sheetW; height = $sheetH }
}

$slotWidth = [Math]::Max(1, (@($assetList | ForEach-Object { $_.W }) | Measure-Object -Maximum).Maximum)
$slotHeight = [Math]::Max(1, (@($assetList | ForEach-Object { $_.H }) | Measure-Object -Maximum).Maximum)
$outRoot = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$sheetPath = Join-Path $outRoot "bicheon-wall-center-stamp.png"
$sheetInfo = Save-StampSheet $assetList $slotWidth $slotHeight $sheetPath

for ($i = 0; $i -lt $layers.Count; $i++) {
  $layerSlot = $layers[$i].slot
  $asset = $assetList[$layerSlot]
  $layers[$i].slot = ($asset.SheetRow * $sheetInfo.columns) + $asset.SheetCol
}

$stamp = [ordered]@{
  id = "bicheon-wall-center"
  label = "Bicheon Wall Center"
  sheet = "bicheon-wall-center-stamp.png"
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetColumns = $sheetInfo.columns
  sheetRows = $sheetInfo.rows
  width = $CropWCells * $CellWidth
  height = $CropHCells * $CellHeight
  focusX = ($FocusMapX - $CropX) * $CellWidth
  focusY = ($FocusMapY - $CropY) * $CellHeight
  anchor = "townCenter"
  offsetX = 0
  offsetY = 0
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
      slot = ($_.SheetRow * $sheetInfo.columns) + $_.SheetCol
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
  $existingStamps = @($parsed.stamps | Where-Object { $_.id -ne "bicheon-wall-center" })
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
  mapWidth = $map.Width
  mapHeight = $map.Height
} | ConvertTo-Json
