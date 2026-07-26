param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/HF1.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "fire-hell-gd-1-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Fire Hell GD Floor 1",
  [switch]$SkipIndex,
  [int]$CropX = 39,
  [int]$CropY = 234,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 57,
  [int]$FocusMapY = 252,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  [int]$StampOffsetY = -4,
  # Mir3 sand Tiles5c (slot 232) frames used only when a back cell is empty.
  [int]$FloorFillSlot = 232,
  [int[]]$FloorFillFrames = @(0, 1, 2, 3, 4)
)

if ([string]::IsNullOrWhiteSpace($SheetFile)) {
  $SheetFile = "$StampId-stamp.png"
}

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

function Get-Mir3LibRelativePath([int]$slot) {
  if ($slot -lt 200 -or $slot -gt 274) { return $null }
  $states = @("", "wood", "sand", "snow", "forest")
  $leaves = @(
    "Tilesc", "Tiles30c", "Tiles5c", "Smtilesc", "Housesc", "Cliffsc", "Dungeonsc",
    "Innersc", "Furnituresc", "Wallsc", "smObjectsc", "Animationsc", "Object1c", "Object2c"
  )
  $rel = $slot - 200
  $group = [int][Math]::Floor($rel / 15)
  $leaf = $rel % 15
  if ($group -ge $states.Length -or $leaf -ge $leaves.Length) { return $null }
  $state = $states[$group]
  $leafName = $leaves[$leaf]
  if ([string]::IsNullOrEmpty($state)) { return "Map/WemadeMir3/$leafName.Lib" }
  return "Map/WemadeMir3/$state/$leafName.Lib"
}

function Get-MapLibRelativePath([int]$slot) {
  if ($slot -eq 0) { return "Map/WemadeMir2/Tiles.Lib" }
  if ($slot -eq 1) { return "Map/WemadeMir2/SmTiles.Lib" }
  if ($slot -eq 2) { return "Map/WemadeMir2/Objects.Lib" }
  if ($slot -ge 3 -and $slot -le 28) { return "Map/WemadeMir2/Objects$($slot - 1).Lib" }
  if ($slot -eq 90) { return "Map/WemadeMir2/Objects_32bit.Lib" }
  $mir3 = Get-Mir3LibRelativePath $slot
  if ($null -ne $mir3) { return $mir3 }
  return $null
}

function Read-Type5Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -lt 28 -or $bytes[0] -ne 0) {
    throw "Not a Mir3 Type5 map (expected leading 0): $path"
  }
  $width = [BitConverter]::ToInt16($bytes, 22)
  $height = [BitConverter]::ToInt16($bytes, 24)
  if ($width -le 0 -or $height -le 0) { throw "Invalid Type5 dimensions in $path" }

  $count = $width * $height
  $back = [long[]]::new($count)
  $backIndex = [int[]]::new($count)
  $middle = [int[]]::new($count)
  $middleIndex = [int[]]::new($count)
  $front = [int[]]::new($count)
  $frontIndex = [int[]]::new($count)
  $frontAnimFrame = [byte[]]::new($count)
  $frontAnimTick = [byte[]]::new($count)

  for ($i = 0; $i -lt $count; $i++) {
    $backIndex[$i] = -1
    $middleIndex[$i] = -1
    $frontIndex[$i] = -1
  }

  $offset = 28
  for ($x = 0; $x -lt [Math]::Floor($width / 2); $x++) {
    for ($y = 0; $y -lt [Math]::Floor($height / 2); $y++) {
      for ($i = 0; $i -lt 4; $i++) {
        $sx = ($x * 2) + ($i % 2)
        $sy = ($y * 2) + [Math]::Floor($i / 2)
        $cell = ($sx * $height) + $sy
        $backIndex[$cell] = if ($bytes[$offset] -ne 255) { [int]$bytes[$offset] + 200 } else { -1 }
        $back[$cell] = [BitConverter]::ToUInt16($bytes, $offset + 1) + 1
      }
      $offset += 3
    }
  }

  $offset = 28 + (3 * ([Math]::Floor($width / 2) + ($width % 2)) * [Math]::Floor($height / 2))
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $cell = ($x * $height) + $y
      $flag = $bytes[$offset]; $offset++
      $offset++ # MiddleAnimationFrame
      $frontAnim = $bytes[$offset]
      if ($frontAnim -eq 255) { $frontAnim = 0 }
      $frontAnimFrame[$cell] = [byte]($frontAnim -band 0x8F)
      $frontAnimTick[$cell] = 0
      $offset++
      $frontIndex[$cell] = if ($bytes[$offset] -ne 255) { [int]$bytes[$offset] + 200 } else { -1 }; $offset++
      $middleIndex[$cell] = if ($bytes[$offset] -ne 255) { [int]$bytes[$offset] + 200 } else { -1 }; $offset++
      $middle[$cell] = [BitConverter]::ToUInt16($bytes, $offset) + 1; $offset += 2
      $front[$cell] = [BitConverter]::ToUInt16($bytes, $offset) + 1; $offset += 2
      if ($front[$cell] -eq 1 -and $frontIndex[$cell] -eq 200) { $frontIndex[$cell] = -1 }
      $offset += 3
      $offset += 2
      if (($flag -band 1) -ne 1) { $back[$cell] = $back[$cell] -bor 0x20000000 }
      if (($flag -band 2) -ne 2) { $front[$cell] = $front[$cell] -bor 0x8000 }
    }
  }

  return [pscustomobject]@{
    Width = $width
    Height = $height
    Back = $back
    BackIndex = $backIndex
    Middle = $middle
    MiddleIndex = $middleIndex
    Front = $front
    FrontIndex = $frontIndex
    FrontAnimFrame = $frontAnimFrame
    FrontAnimTick = $frontAnimTick
  }
}

function Get-CellOffset($map, [int]$x, [int]$y) {
  return ($x * $map.Height) + $y
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

function Get-VisibleBackFrame([int]$backFrame) {
  return $backFrame
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

$map = Read-Type5Map $MapPath
$CropX = [Math]::Max(0, [Math]::Min($CropX, $map.Width - 1))
$CropY = [Math]::Max(0, [Math]::Min($CropY, $map.Height - 1))
$CropWCells = [Math]::Min($CropWCells, $map.Width - $CropX)
$CropHCells = [Math]::Min($CropHCells, $map.Height - $CropY)

$assets = [ordered]@{}
$layers = New-Object System.Collections.Generic.List[object]
$animatedLayers = New-Object System.Collections.Generic.List[object]
$assetList = New-Object System.Collections.Generic.List[object]

function Ensure-StampAsset([int]$slotId, [int]$frame) {
  $image = Get-MapImage $slotId $frame
  if ($null -eq $image) { return $null }
  $key = "$slotId`:$frame"
  if (-not $assets.Contains($key)) {
    $assets[$key] = [pscustomobject]@{
      Key = $key
      SourceSlot = $slotId
      SourceFrame = $frame
      Slot = $assetList.Count
      W = $image.Bitmap.Width
      H = $image.Bitmap.Height
      OffsetX = [int]$image.OffsetX
      OffsetY = [int]$image.OffsetY
      Image = $image
    }
    $assetList.Add($assets[$key])
  }
  return $assets[$key]
}

function Add-Layer([int]$slotId, [int]$frame, [int]$mapX, [int]$mapY, [int]$x, [int]$y, [bool]$floorSized, [string]$Kind) {
  $asset = Ensure-StampAsset $slotId $frame
  if ($null -eq $asset) { return }
  $layers.Add([pscustomobject]@{
    slot = $asset.Slot
    x = $x
    y = $y
    w = $asset.W
    h = $asset.H
    source = $asset.Key
    floor = $floorSized
    kind = $Kind
    mapCol = $mapX
    mapRow = $mapY
    inFront = ($Kind -eq "front" -and -not $floorSized -and $mapY -gt $FocusMapY)
  })
}

# Crystal GameScene: FrontAnimationFrame bit 0x80 = DrawBlend; lower 7 bits = frame count.
# AnimationCount advances every 100ms, so intervalMs = 100 * (1 + FrontAnimationTick).
# Positioning matches Crystal's blend draw for Objects13 (slot 14): 
#   Point(drawX, drawY - 3*CellHeight) with library offsets, where drawY is the (+1) cell step.
function Add-AnimatedBlendLayer([int]$slotId, [int]$baseFrame, [int]$frameCount, [int]$animTick, [int]$mapX, [int]$mapY) {
  if ($frameCount -le 0) { return }
  $frameEntries = New-Object System.Collections.Generic.List[object]
  $baseAsset = $null
  for ($i = 0; $i -lt $frameCount; $i++) {
    $asset = Ensure-StampAsset $slotId ($baseFrame + $i)
    if ($null -eq $asset) { continue }
    if ($null -eq $baseAsset) { $baseAsset = $asset }
    $frameEntries.Add([ordered]@{
      slot = $asset.Slot
      w = $asset.W
      h = $asset.H
      offsetX = $asset.OffsetX
      offsetY = $asset.OffsetY
      sourceFrame = $asset.SourceFrame
    }) | Out-Null
  }
  if ($null -eq $baseAsset -or $frameEntries.Count -eq 0) { return }

  $cellDrawX = ($mapX - $CropX) * $CellWidth
  $cellDrawY = (($mapY - $CropY) + 1) * $CellHeight
  if ($slotId -eq 14 -or $slotId -eq 27 -or ($slotId -gt 99 -and $slotId -lt 199)) {
    $drawX = $cellDrawX + $baseAsset.OffsetX
    $drawY = $cellDrawY - (3 * $CellHeight) + $baseAsset.OffsetY
  } else {
    # Crystal else-branch: DrawBlend at (drawX, drawY - height) without offsets.
    $drawX = $cellDrawX
    $drawY = $cellDrawY - $baseAsset.H
  }

  $animatedLayers.Add([pscustomobject]@{
    x = $drawX
    y = $drawY
    w = $baseAsset.W
    h = $baseAsset.H
    source = $baseAsset.Key
    kind = "front"
    mapCol = $mapX
    mapRow = $mapY
    inFront = ($mapY -gt $FocusMapY)
    blend = $true
    interval = 100 * (1 + [Math]::Max(0, $animTick))
    frames = @($frameEntries.ToArray())
  })
}

function Get-VisibleBackFrame([int]$backFrame) {
  return $backFrame
}

function Test-CellHasWall($map, [int]$x, [int]$y) {
  $cell = Get-CellOffset $map $x $y
  $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
  $frontSlot = $map.FrontIndex[$cell]
  if ($frontFrame -lt 0 -or $frontSlot -lt 0) { return $false }
  $image = Get-MapImage $frontSlot $frontFrame
  if ($null -eq $image) { return $false }
  return -not (Test-FloorSized $image.Bitmap)
}

for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
  for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
    if (($x -band 1) -ne 0 -or ($y -band 1) -ne 0) { continue }
    $cell = Get-CellOffset $map $x $y
    $backImage = $map.Back[$cell]
    $backSlot = $map.BackIndex[$cell]
    if ($backSlot -lt 0 -or $backImage -eq 0) { continue }
    $backFrame = Get-VisibleBackFrame (($backImage -band 0x1FFFFFFF) - 1)
    if ($backFrame -lt 0) { continue }
    $drawX = ($x - $CropX) * $CellWidth
    $drawY = ($y - $CropY) * $CellHeight
    Add-Layer $backSlot $backFrame $x $y $drawX $drawY $true "back"
  }
}

for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
  for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
    if (($x -band 1) -ne 0 -or ($y -band 1) -ne 0) { continue }
    $cell = Get-CellOffset $map $x $y
    if (($map.Back[$cell] -band 0x1FFFFFFF) -ne 0 -and $map.BackIndex[$cell] -ge 0) { continue }
    if (Test-CellHasWall $map $x $y) { continue }
    $tileX = [Math]::Floor(($x - $CropX) / 2)
    $tileY = [Math]::Floor(($y - $CropY) / 2)
    $frame = $FloorFillFrames[($tileX + $tileY) % $FloorFillFrames.Length]
    $drawX = ($x - $CropX) * $CellWidth
    $drawY = ($y - $CropY) * $CellHeight
    Add-Layer $FloorFillSlot $frame $x $y $drawX $drawY $true "fill"
  }
}

for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
  for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
    $cell = Get-CellOffset $map $x $y
    $middleFrame = $map.Middle[$cell] - 1
    $middleSlot = $map.MiddleIndex[$cell]
    if ($middleSlot -lt 0 -or $middleFrame -lt 0) { continue }
    $image = Get-MapImage $middleSlot $middleFrame
    if ($null -eq $image) { continue }
    $floorSized = Test-FloorSized $image.Bitmap
    $drawX = ($x - $CropX) * $CellWidth
    # Crystal GameScene: floor-sized middle tiles sit on the cell; tall Mir3 middle
    # pieces use DrawUp (bottom-align to (row+1)*CellHeight). Skipping non-floor
    # middle was cutting Fire Hell KR wall/door tops into jagged voids.
    $drawY = if ($floorSized) {
      ($y - $CropY) * $CellHeight
    } else {
      (($y - $CropY) + 1) * $CellHeight - $image.Bitmap.Height
    }
    Add-Layer $middleSlot $middleFrame $x $y $drawX $drawY $floorSized "middle"
  }
}

for ($pass = 0; $pass -lt 2; $pass++) {
  for ($y = $CropY; $y -lt ($CropY + $CropHCells); $y++) {
    for ($x = $CropX; $x -lt ($CropX + $CropWCells); $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -lt 0) { continue }
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
      $animRaw = [int]$map.FrontAnimFrame[$cell]
      $blend = ($animRaw -band 0x80) -ne 0
      $animCount = $animRaw -band 0x7F
      # Blend-animated front props (torches/flames): bake the full strip and draw additively at runtime.
      # Do not also bake frame 0 as a normal opaque layer — black "smoke" pixels are meant for DrawBlend.
      # Tall (non-floor) objects are processed on pass 1 — same pass as other props.
      if ($blend -and $animCount -gt 1 -and -not $floorSized) {
        Add-AnimatedBlendLayer $frontSlot $frontFrame $animCount ([int]$map.FrontAnimTick[$cell]) $x $y
        continue
      }
      Add-Layer $frontSlot $frontFrame $x $y $drawX $drawY $floorSized "front"
    }
  }
}

function Save-StampSheet([System.Collections.Generic.List[object]]$assetList, [int]$slotWidth, [int]$slotHeight, [string]$sheetPath, [int]$MaxSheetWidth = 8192) {
  $count = [Math]::Max(1, $assetList.Count)
  $maxColumns = [Math]::Max(1, [Math]::Floor($MaxSheetWidth / $slotWidth))
  $columns = [Math]::Min($count, $maxColumns)
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
$outRoot = if ([System.IO.Path]::IsPathRooted($OutputRoot)) {
  $OutputRoot
} else {
  Join-Path $PSScriptRoot $OutputRoot
}
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$sheetPath = Join-Path $outRoot $SheetFile
$sheetInfo = Save-StampSheet $assetList $slotWidth $slotHeight $sheetPath

# Patch layer slot indices to grid positions in sheet
for ($i = 0; $i -lt $layers.Count; $i++) {
  $layerSlot = $layers[$i].slot
  $asset = $assetList[$layerSlot]
  $layers[$i].slot = ($asset.SheetRow * $sheetInfo.columns) + $asset.SheetCol
}
for ($i = 0; $i -lt $animatedLayers.Count; $i++) {
  $anim = $animatedLayers[$i]
  $patchedFrames = @()
  foreach ($frame in $anim.frames) {
    $asset = $assetList[$frame.slot]
    $patched = [ordered]@{}
    foreach ($prop in $frame.GetEnumerator()) {
      if ($prop.Key -eq "slot") {
        $patched.slot = ($asset.SheetRow * $sheetInfo.columns) + $asset.SheetCol
      } else {
        $patched[$prop.Key] = $prop.Value
      }
    }
    $patchedFrames += $patched
  }
  $anim.frames = $patchedFrames
}

$stamp = [ordered]@{
  id = $StampId
  label = $StampLabel
  sheet = $SheetFile
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  sheetColumns = $sheetInfo.columns
  sheetRows = $sheetInfo.rows
  width = $CropWCells * $CellWidth
  height = $CropHCells * $CellHeight
  focusX = ($FocusMapX - $CropX) * $CellWidth
  focusY = ($FocusMapY - $CropY) * $CellHeight
  anchor = "arenaSpawn"
  offsetX = 0
  offsetY = $StampOffsetY
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
  animatedLayers = @($animatedLayers.ToArray() | ForEach-Object {
    $entry = [ordered]@{
      x = $_.x
      y = $_.y
      w = $_.w
      h = $_.h
      source = $_.source
      mapCol = $_.mapCol
      mapRow = $_.mapRow
      kind = $_.kind
      blend = $true
      interval = $_.interval
      frames = @($_.frames)
    }
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

if (-not $SkipIndex) {
  $indexPath = Join-Path $outRoot "index.json"
  $existingStamps = @()
  if (Test-Path $indexPath) {
    $parsed = Get-Content $indexPath -Raw | ConvertFrom-Json
    $existingStamps = @($parsed.stamps | Where-Object { $_.id -ne $StampId })
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $indexJson = ([ordered]@{ stamps = @($existingStamps + @($stamp)) } | ConvertTo-Json -Depth 12)
  [System.IO.File]::WriteAllText($indexPath, $indexJson, $utf8NoBom)
}

foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }

[ordered]@{
  outputRoot = $outRoot
  sheet = $sheetPath
  assetCount = $assetList.Count
  layerCount = $layers.Count
  animatedLayerCount = $animatedLayers.Count
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
