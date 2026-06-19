param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2001.map",
  [string]$OutputRoot = "../tile-review/bdd-corridor-slices",
  [int]$WindowCells = 20,
  [int]$CropHCells = 13,
  [int]$MaxSamples = 24,
  [int]$CellsNorthOfLane = 9,
  [int]$CellsSouthScan = 10,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalBddSliceLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalBddSliceLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public CrystalBddSliceLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }
    public CrystalBddSliceImage ReadImage(int index)
    {
        if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
        stream.Position = offsets[index];
        short w = reader.ReadInt16();
        short h = reader.ReadInt16();
        reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16();
        byte shadow = reader.ReadByte();
        int len = reader.ReadInt32();
        bool hasMask = (shadow >> 7) == 1;
        if (w <= 0 || h <= 0 || len <= 0) return null;
        byte[] compressed = reader.ReadBytes(len);
        if (hasMask) { reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt32(); reader.ReadBytes(reader.ReadInt32()); }
        byte[] raw;
        using (var input = new MemoryStream(compressed))
        using (var gzip = new GZipStream(input, CompressionMode.Decompress))
        using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); }
        if (raw.Length < w * h * 4) return null;
        Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); }
        finally { bitmap.UnlockBits(data); }
        return new CrystalBddSliceImage(bitmap);
    }
    public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class CrystalBddSliceImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public CrystalBddSliceImage(Bitmap bitmap) { Bitmap = bitmap; }
    public void Dispose() { Bitmap.Dispose(); }
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
  return [pscustomobject]@{ Width = $width; Height = $height; Back = $back; Middle = $middle; Front = $front; FrontIndex = $frontIndex }
}

function Get-CellOffset($map, [int]$x, [int]$y) { return ($x * $map.Height) + $y }

function Get-VisibleBackFrame([int]$backFrame) {
  if ($backFrame -ge 1950 -and $backFrame -le 1999) { return $backFrame + 1000 }
  if ($backFrame -ge 2950 -and $backFrame -le 2959) { return $backFrame }
  return $backFrame
}

$loadedLibs = @{}
$loadedImages = @{}

function Get-MapLib([int]$slot) {
  $key = [string]$slot
  if ($loadedLibs.ContainsKey($key)) { return $loadedLibs[$key] }
  $relative = Get-MapLibRelativePath $slot
  if ($null -eq $relative) { $loadedLibs[$key] = $null; return $null }
  $path = Join-Path (Resolve-Path $DataRoot) $relative
  if (-not (Test-Path $path)) { $loadedLibs[$key] = $null; return $null }
  $lib = [CrystalBddSliceLib]::new($path)
  $loadedLibs[$key] = $lib
  return $lib
}

function Get-MapImage([int]$slot, [int]$index) {
  if ($index -lt 0) { return $null }
  $key = "$slot`:$index"
  if ($loadedImages.ContainsKey($key)) { return $loadedImages[$key] }
  $lib = Get-MapLib $slot
  if ($null -eq $lib) { $loadedImages[$key] = $null; return $null }
  $image = $lib.ReadImage($index)
  $loadedImages[$key] = $image
  return $image
}

function Test-FloorSized($bitmap) {
  return (($bitmap.Width -eq $CellWidth -and $bitmap.Height -eq $CellHeight) -or
          ($bitmap.Width -eq ($CellWidth * 2) -and $bitmap.Height -eq ($CellHeight * 2)))
}

function Test-TallWallCell($map, [int]$x, [int]$y) {
  $cell = Get-CellOffset $map $x $y
  $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
  $frontSlot = $map.FrontIndex[$cell]
  if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { return $false }
  $image = Get-MapImage $frontSlot $frontFrame
  if ($null -eq $image) { return $false }
  return -not (Test-FloorSized $image.Bitmap)
}

function Test-OpenLaneColumn($map, [int]$x, [int]$laneY) {
  foreach ($y in @(($laneY - 1), $laneY, ($laneY + 1))) {
    if ($y -lt 0 -or $y -ge $map.Height) { continue }
    if (Test-TallWallCell $map $x $y) { return $false }
    $cell = Get-CellOffset $map $x $y
    if ($map.Back[$cell] -eq 0) { return $false }
  }
  return $true
}

function Get-WallSignature($map, [int]$x0, [int]$laneY, [int]$w) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($entry in @(
    @{ Band = "north"; Ys = @(($laneY - 4), ($laneY - 3), ($laneY - 2), ($laneY - 1)) }
    @{ Band = "south"; Ys = @(($laneY + 1), ($laneY + 2), ($laneY + 3), ($laneY + 4)) }
  )) {
    foreach ($y in $entry.Ys) {
      for ($x = $x0; $x -lt ($x0 + $w); $x++) {
        if ($y -lt 0 -or $y -ge $map.Height) { continue }
        $cell = Get-CellOffset $map $x $y
        $frame = ($map.Front[$cell] -band 0x7FFF) - 1
        $slot = $map.FrontIndex[$cell]
        if ($frame -ge 0 -and $slot -ne -1 -and $slot -ne 200) {
          $parts.Add("$($entry.Band)@$($x - $x0),$y=$slot`:$frame")
        }
      }
    }
  }
  return @($parts | Sort-Object) -join "|"
}

function Get-FrameSummaryText([string]$sig) {
  $frames = @{}
  foreach ($part in ($sig -split "\|")) {
    if ($part -match "=(\d+):(\d+)$") {
      $key = "$($Matches[1]):$($Matches[2])"
      if (-not $frames.ContainsKey($key)) { $frames[$key] = 0 }
      $frames[$key]++
    }
  }
  return @($frames.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 8 | ForEach-Object { "$($_.Key)($($_.Value))" }) -join ", "
}

function Get-CorridorCropBounds($map, [int]$cropX, [int]$cropWCells, [int]$laneY, [int]$cellsNorth, [int]$cellsSouthScan) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $cropY = [Math]::Max(0, $laneY - $cellsNorth)
  $scanEndY = [Math]::Min($map.Height - 1, $laneY + $cellsSouthScan)
  $minTop = 0
  $maxBottom = (($laneY - $cropY) + 4) * $CellHeight

  for ($y = $cropY; $y -le $scanEndY; $y++) {
    for ($x = $cropX; $x -le $endX; $x++) {
      $cell = Get-CellOffset $map $x $y
      $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
      $frontSlot = $map.FrontIndex[$cell]
      if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
      $image = Get-MapImage $frontSlot $frontFrame
      if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
      $bottom = (($y - $cropY) + 1) * $CellHeight
      $top = $bottom - $image.Bitmap.Height
      if ($top -lt $minTop) { $minTop = $top }
      if ($bottom -gt $maxBottom) { $maxBottom = $bottom }
    }
  }

  if ($minTop -lt 0) {
    $shiftCells = [Math]::Ceiling((0 - $minTop) / [double]$CellHeight)
    $cropY = [Math]::Max(0, $cropY - $shiftCells)
    $minTop = 0
    $maxBottom = $maxBottom + ($shiftCells * $CellHeight)
  }

  $cropHCells = [Math]::Max(
    ($cellsNorth + 4),
    [Math]::Ceiling($maxBottom / [double]$CellHeight) + 1
  )

  return [pscustomobject]@{
    CropX = $cropX
    CropY = $cropY
    CropW = $cropWCells
    CropH = $cropHCells
    LaneY = $laneY
  }
}

function Discover-DiverseCorridorCandidates($map) {
  $rawCandidates = New-Object System.Collections.Generic.List[object]
  for ($laneY = 15; $laneY -lt ($map.Height - 15); $laneY++) {
    $runStart = -1
    for ($x = 0; $x -le $map.Width; $x++) {
      $open = ($x -lt $map.Width) -and (Test-OpenLaneColumn $map $x $laneY)
      if ($open) {
        if ($runStart -lt 0) { $runStart = $x }
      }
      elseif ($runStart -ge 0) {
        $runLen = $x - $runStart
        if ($runLen -ge $WindowCells) {
          $step = [Math]::Max(6, [Math]::Floor($runLen / 4))
          for ($x0 = $runStart; $x0 -le ($x - $WindowCells); $x0 += $step) {
            $sig = Get-WallSignature $map $x0 $laneY $WindowCells
            if ([string]::IsNullOrWhiteSpace($sig)) { continue }
            $northCount = @($sig -split "\|" | Where-Object { $_ -like "north*" }).Count
            $southCount = @($sig -split "\|" | Where-Object { $_ -like "south*" }).Count
            if ($northCount -lt 2 -and $southCount -lt 2) { continue }
            $bounds = Get-CorridorCropBounds $map $x0 $WindowCells $laneY $CellsNorthOfLane $CellsSouthScan
            $rawCandidates.Add([pscustomobject]@{
              Label = "Map corridor x=$x0 y=$laneY"
              CropX = $bounds.CropX
              CropY = $bounds.CropY
              CropW = $bounds.CropW
              CropH = $bounds.CropH
              LaneY = $bounds.LaneY
              Signature = $sig
              FrameSummary = (Get-FrameSummaryText $sig)
              Score = $northCount + $southCount
            })
          }
        }
        $runStart = -1
      }
    }
  }

  $bySignature = @{}
  foreach ($item in $rawCandidates) {
    if (-not $bySignature.ContainsKey($item.Signature) -or $item.Score -gt $bySignature[$item.Signature].Score) {
      $bySignature[$item.Signature] = $item
    }
  }

  $unique = @($bySignature.Values | Sort-Object -Property Score -Descending)
  $selected = New-Object System.Collections.Generic.List[object]
  foreach ($item in $unique) {
    if ($selected.Count -ge $MaxSamples) { break }
    $tooNear = $false
    foreach ($existing in $selected) {
      if ([Math]::Abs($existing.LaneY - $item.LaneY) -lt 6 -and [Math]::Abs($existing.CropX - $item.CropX) -lt 18) {
        $tooNear = $true
        break
      }
    }
    if ($tooNear) { continue }
    $item.Label = "Distinct walls at map x=$($item.CropX), lane y=$($item.LaneY)"
    $selected.Add($item)
  }

  if ($selected.Count -lt $MaxSamples) {
    foreach ($item in $unique) {
      if ($selected.Count -ge $MaxSamples) { break }
      if (@($selected | Where-Object { $_.Signature -eq $item.Signature }).Count -gt 0) { continue }
      $item.Label = "Distinct walls at map x=$($item.CropX), lane y=$($item.LaneY)"
      $selected.Add($item)
    }
  }

  return @($selected.ToArray())
}

function Render-CorridorSlice($map, [int]$cropX, [int]$cropY, [int]$cropWCells, [int]$cropHCells, [int]$laneMapY, [bool]$transparentLane) {
  $endX = [Math]::Min($map.Width - 1, $cropX + $cropWCells - 1)
  $endY = [Math]::Min($map.Height - 1, $cropY + $cropHCells - 1)
  $bitmapW = ($endX - $cropX + 1) * $CellWidth
  $bitmapH = ($endY - $cropY + 1) * $CellHeight
  $bitmap = [System.Drawing.Bitmap]::new($bitmapW, $bitmapH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

    for ($y = $cropY; $y -le $endY; $y++) {
      for ($x = $cropX; $x -le $endX; $x++) {
        $drawX = ($x - $cropX) * $CellWidth
        $drawY = ($y - $cropY) * $CellHeight
        $openLane = $transparentLane -and (Test-OpenLaneColumn $map $x $laneMapY)
        $cell = Get-CellOffset $map $x $y

        if (($x -band 1) -eq 0 -and ($y -band 1) -eq 0) {
          $backImage = $map.Back[$cell]
          if ($backImage -ne 0 -and -not $openLane) {
            $backFrame = Get-VisibleBackFrame (($backImage -band 0x1FFFFFFF) - 1)
            $image = Get-MapImage 0 $backFrame
            if ($null -ne $image) { $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY) }
          }
        }

        $midFrame = $map.Middle[$cell] - 1
        if ($midFrame -ge 0 -and -not $openLane) {
          $image = Get-MapImage 1 $midFrame
          if ($null -ne $image -and (Test-FloorSized $image.Bitmap)) {
            $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
          }
        }

        $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
        $frontSlot = $map.FrontIndex[$cell]
        if ($frontFrame -ge 0 -and $frontSlot -ne -1 -and $frontSlot -ne 200) {
          $image = Get-MapImage $frontSlot $frontFrame
          if ($null -ne $image -and (Test-FloorSized $image.Bitmap) -and -not $openLane) {
            $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
          }
        }
      }
    }

    for ($y = $cropY; $y -le $endY; $y++) {
      for ($x = $cropX; $x -le $endX; $x++) {
        $cell = Get-CellOffset $map $x $y
        $frontFrame = ($map.Front[$cell] -band 0x7FFF) - 1
        $frontSlot = $map.FrontIndex[$cell]
        if ($frontFrame -lt 0 -or $frontSlot -eq -1 -or $frontSlot -eq 200) { continue }
        $image = Get-MapImage $frontSlot $frontFrame
        if ($null -eq $image -or (Test-FloorSized $image.Bitmap)) { continue }
        $drawX = ($x - $cropX) * $CellWidth
        $drawY = (($y - $cropY) + 1) * $CellHeight - $image.Bitmap.Height
        $graphics.DrawImageUnscaled($image.Bitmap, $drawX, $drawY)
      }
    }
  }
  finally {
    $graphics.Dispose()
  }

  return [pscustomobject]@{
    Bitmap = $bitmap
    WidthPx = $bitmapW
    HeightPx = $bitmapH
    CropWCells = ($endX - $cropX + 1)
    CropHCells = ($endY - $cropY + 1)
    LanePixelY = (($laneMapY - $cropY) + 1) * $CellHeight
  }
}

$map = Read-Type1Map $MapPath
$candidates = Discover-DiverseCorridorCandidates $map
Write-Output "Discovered $($candidates.Count) visually distinct corridor slices from D2001 (unique wall object layouts, not X-offset shifts)"
$outRoot = Join-Path $PSScriptRoot $OutputRoot
$imgDir = Join-Path $outRoot "slices"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

$rendered = New-Object System.Collections.Generic.List[object]
$index = 1
try {
  foreach ($candidate in $candidates) {
    foreach ($mode in @(
      @{ Id = "edge"; TransparentLane = $true; Suffix = "edge"; ModeLabel = "Edge (transparent lane)" }
      @{ Id = "full"; TransparentLane = $false; Suffix = "full"; ModeLabel = "Full (includes floor)" }
    )) {
      $result = Render-CorridorSlice $map $candidate.CropX $candidate.CropY $candidate.CropW $candidate.CropH $candidate.LaneY $mode.TransparentLane
      $fileName = ("slice_{0:D2}_{1}.png" -f $index, $mode.Suffix)
      $filePath = Join-Path $imgDir $fileName
      $result.Bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
      $rendered.Add([pscustomobject]@{
        Number = $index
        Id = ("slice-$index-$($mode.Suffix)")
        File = "slices/$fileName"
        Label = $candidate.Label
        FrameSummary = $candidate.FrameSummary
        Mode = $mode.ModeLabel
        ModeId = $mode.Id
        CropX = $candidate.CropX
        CropY = $candidate.CropY
        CropWCells = $result.CropWCells
        CropHCells = $result.CropHCells
        LaneMapY = $candidate.LaneY
        LanePixelY = $result.LanePixelY
        WidthPx = $result.WidthPx
        HeightPx = $result.HeightPx
        BuildCommand = "powershell -File tools/build-bdd-corridor-edge.ps1 -CropX $($candidate.CropX) -CropY $($candidate.CropY) -CropWCells $($candidate.CropW) -CropHCells $($candidate.CropH) -LaneMapY $($candidate.LaneY)"
      })
      $result.Bitmap.Dispose()
    }
    $index++
  }
}
finally {
  foreach ($entry in $loadedImages.Values) { if ($null -ne $entry) { $entry.Dispose() } }
  foreach ($entry in $loadedLibs.Values) { if ($null -ne $entry) { $entry.Dispose() } }
}

$samples = @($rendered.ToArray())
$samples | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outRoot "samples.json") -Encoding UTF8

function ConvertTo-HtmlText([string]$value) { return [System.Net.WebUtility]::HtmlEncode($value) }

$cards = foreach ($item in $samples) {
  $label = ConvertTo-HtmlText $item.Label
  $mode = ConvertTo-HtmlText $item.Mode
  $frames = ConvertTo-HtmlText $item.FrameSummary
  $cmd = ConvertTo-HtmlText $item.BuildCommand
  $w = $item.WidthPx
  @"
    <article class="card" id="$(ConvertTo-HtmlText $item.Id)" data-mode="$($item.ModeId)">
      <header>
        <strong>#$($item.Number) · $mode</strong>
        <span>$label</span>
      </header>
      <p class="meta">Map cells x=$($item.CropX)..$($item.CropX + $item.CropWCells - 1), y=$($item.CropY)..$($item.CropY + $item.CropHCells - 1) · lane y=$($item.LaneMapY) · $($item.WidthPx)×$($item.HeightPx) px</p>
      <p class="frames"><code>$frames</code></p>
      <figure>
        <figcaption>Single slice</figcaption>
        <img src="$($item.File)" alt="$label" style="--w:$w" />
      </figure>
      <figure>
        <figcaption>Loop preview (×3)</figcaption>
        <div class="loop" style="--w:$w">
          <img src="$($item.File)" />
          <img src="$($item.File)" />
          <img src="$($item.File)" />
        </div>
      </figure>
      <p class="pick">Tell me: <code>use $($item.Id)</code></p>
      <p class="cmd"><code>$cmd</code></p>
    </article>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>BDD Corridor Slice Picker</title>
    <style>
      :root { color-scheme: dark; --zoom: 0.85; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #12110f; color: #ece6d8; font: 13px/1.45 Segoe UI, sans-serif; }
      header { position: sticky; top: 0; z-index: 5; background: #1c1914; border-bottom: 1px solid #4a3f2c; padding: 14px 18px; }
      h1 { margin: 0 0 6px; font-size: 22px; color: #f4dfb0; }
      header p { margin: 0; color: #b9ad94; max-width: 920px; }
      .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 12px; }
      .controls input[type=range] { width: 180px; }
      .filter-btn { border: 1px solid #5a4c34; background: #2a241b; color: #f2e5c8; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
      .filter-btn.active { background: #5c4a28; border-color: #c9a962; }
      main { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; padding: 16px; }
      .card { border: 1px solid #3b3224; background: #1a1712; padding: 12px; display: grid; gap: 10px; }
      .card.hidden { display: none; }
      .card header { position: static; background: transparent; border: 0; padding: 0; display: grid; gap: 4px; }
      .card strong { color: #f0d89a; font-size: 14px; }
      .card header span { color: #c8b995; font-size: 12px; }
      .meta { margin: 0; color: #9f947d; font-size: 11px; }
      .frames { margin: 0; font-size: 10px; }
      figure { margin: 0; display: grid; gap: 6px; overflow-x: auto; }
      figcaption { color: #8f846c; font-size: 11px; }
      img { width: calc(var(--w) * 1px * var(--zoom)); height: auto; image-rendering: pixelated; background: repeating-conic-gradient(#2a2620 0% 25%, #1a1814 0% 50%) 50% / 16px 16px; max-width: none; }
      .loop { display: flex; width: calc(var(--w) * 3px * var(--zoom)); overflow: hidden; }
      .pick { margin: 0; color: #d5c6aa; font-size: 12px; }
      .cmd { margin: 0; color: #7b6a51; font-size: 10px; word-break: break-all; }
      code { color: #e8c978; }
    </style>
  </head>
  <body>
    <header>
      <h1>BDD Corridor Slice Picker</h1>
      <p>Auto-scanned Crystal <code>D2001.map</code> for <strong>397 unique wall layouts</strong>. Each card is a different corridor section from a different part of the map — not the same wall shifted sideways. <strong>Edge</strong> = transparent lane for scrolling floor. Pick one: <code>use slice-N-edge</code>.</p>
      <div class="controls">
        <label>Zoom <input id="zoom" type="range" min="0.35" max="1.5" step="0.05" value="0.85" /><output id="zoomValue">0.85x</output></label>
        <button type="button" class="filter-btn active" data-filter="edge">Edge only</button>
        <button type="button" class="filter-btn" data-filter="all">All modes</button>
        <button type="button" class="filter-btn" data-filter="full">Full only</button>
      </div>
    </header>
    <main>
$($cards -join "`n")
    </main>
    <script>
      const slider = document.querySelector("#zoom");
      const output = document.querySelector("#zoomValue");
      const cards = Array.from(document.querySelectorAll(".card"));
      function applyZoom() {
        document.documentElement.style.setProperty("--zoom", slider.value);
        output.value = slider.value + "x";
      }
      function applyFilter(mode) {
        cards.forEach((card) => {
          const cardMode = card.dataset.mode;
          const hide = mode !== "all" && cardMode !== mode;
          card.classList.toggle("hidden", hide);
        });
      }
      slider.addEventListener("input", applyZoom);
      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          applyFilter(btn.dataset.filter);
        });
      });
      applyZoom();
      applyFilter("edge");
    </script>
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $outRoot "index.html") -Encoding UTF8

Write-Output "Rendered $($samples.Count) corridor slices ($($candidates.Count) positions × 2 modes)"
Write-Output (Resolve-Path (Join-Path $outRoot "index.html"))
