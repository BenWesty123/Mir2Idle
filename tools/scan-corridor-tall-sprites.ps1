param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/R01.map",
  [string]$RegionJson = "./tile-review/red-cavern-r01-corridor-region.json",
  [int]$LaneMapY = 34,
  [int]$CellsNorthOfLane = 14,
  [int]$CellsSouthScan = 6,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalWallColumnLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.IO; using System.IO.Compression; using System.Runtime.InteropServices;
public sealed class CrystalWallColumnLib : IDisposable {
  private readonly FileStream stream; private readonly BinaryReader reader; private readonly int[] offsets;
  public CrystalWallColumnLib(string path) {
    stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    reader = new BinaryReader(stream);
    int version = reader.ReadInt32(); int count = reader.ReadInt32();
    if (version >= 3) reader.ReadInt32();
    offsets = new int[count]; for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
  }
  public CrystalWallColumnImage ReadImage(int index) {
    if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
    stream.Position = offsets[index];
    short w = reader.ReadInt16(); short h = reader.ReadInt16();
    reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16();
    byte shadow = reader.ReadByte(); int len = reader.ReadInt32();
    bool hasMask = (shadow >> 7) == 1;
    if (w <= 0 || h <= 0 || len <= 0) return null;
    byte[] compressed = reader.ReadBytes(len);
    if (hasMask) { reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt32(); reader.ReadBytes(reader.ReadInt32()); }
    byte[] raw; using (var input = new MemoryStream(compressed)) using (var gzip = new GZipStream(input, CompressionMode.Decompress)) using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); }
    if (raw.Length < w * h * 4) return null;
    Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); } finally { bitmap.UnlockBits(data); }
    return new CrystalWallColumnImage(bitmap);
  }
  public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class CrystalWallColumnImage : IDisposable { public Bitmap Bitmap { get; private set; } public CrystalWallColumnImage(Bitmap b) { Bitmap = b; } public void Dispose() { Bitmap.Dispose(); } }
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
  $back = [long[]]::new($count); $middle = [int[]]::new($count); $front = [int[]]::new($count); $frontIndex = [int[]]::new($count)
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
  return [pscustomobject]@{ Width = $width; Height = $height; Back = $back; Middle = $middle; Front = $front; FrontIndex = $frontIndex }
}

$loadedLibs = @{}; $loadedImages = @{}
function Get-MapImage([int]$slot, [int]$index) {
  if ($index -lt 0) { return $null }
  $key = "$slot`:$index"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }
  $rel = Get-MapLibRelativePath $slot
  if ($null -eq $rel) { return $null }
  $path = Join-Path (Resolve-Path $DataRoot) $rel
  if (-not (Test-Path $path)) { return $null }
  if (-not $loadedLibs.ContainsKey([string]$slot)) { $loadedLibs[[string]$slot] = [CrystalWallColumnLib]::new($path) }
  $image = $loadedLibs[[string]$slot].ReadImage($index)
  $loadedImages[$key] = $image
  return $image
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

$region = Get-Content (Join-Path $PSScriptRoot $RegionJson) -Raw | ConvertFrom-Json
$excluded = @{}
foreach ($entry in @($region.excludedCells)) { $excluded["$($entry.x),$($entry.y)"] = $true }
$x0 = [int]$region.bounds.x0; $x1 = [int]$region.bounds.x1
$cropY = [Math]::Max(0, $LaneMapY - $CellsNorthOfLane)
$map = Read-Type1Map $MapPath
$endY = [Math]::Min($map.Height - 1, $LaneMapY + $CellsSouthScan)
$results = @()
for ($x = $x0; $x -le $x1; $x++) {
  for ($y = $cropY; $y -le $endY; $y++) {
    if ($excluded.ContainsKey("$x,$y")) { continue }
    $cell = ($x * $map.Height) + $y
    $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
    $frontSlot = $map.FrontIndex[$cell]
    if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
    $image = Get-MapImage $frontSlot $frontFrame
    if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
    $results += [pscustomobject]@{
      x = $x; y = $y; slot = $frontSlot; frame = $frontFrame
      w = $image.Bitmap.Width; h = $image.Bitmap.Height
    }
  }
}
$results | Sort-Object x, y | Format-Table -AutoSize
Write-Host "Tall non-excluded sprites: $($results.Count)"
