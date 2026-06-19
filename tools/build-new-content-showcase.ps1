param(
  [string]$Root = "C:\Users\bb-we\Documents\LOM Idle Backup\lom-idle-v2 - Cursor\new content",
  [int]$MaxHdGroups = 80,
  [int]$FramesPerHdGroup = 4,
  [int]$MaxLibFrames = 180
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Extracted = Join-Path $Root "extracted"
$Showcase = Join-Path $Root "show-and-tell"
$Assets = Join-Path $Showcase "assets"
New-Item -ItemType Directory -Force -Path $Assets | Out-Null

function New-CleanDirectory {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function RelPath {
  param([string]$Path)
  return ($Path.Substring($Showcase.Length + 1) -replace "\\", "/")
}

function SafeName {
  param([string]$Name)
  return (($Name -replace '[^\w\-. ]', '_') -replace '\s+', '-').Trim("-")
}

if (-not ("NewContentCrystalLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class NewContentCrystalLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public NewContentCrystalLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public NewContentCrystalImage ReadImage(int index)
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
            if (maskLen > 0) reader.ReadBytes(maskLen);
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

        return new NewContentCrystalImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class NewContentCrystalImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public NewContentCrystalImage(Bitmap bitmap, short offsetX, short offsetY)
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

function Copy-ImageAsPng {
  param([string]$Source, [string]$Destination)
  $dir = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $bitmap = [System.Drawing.Bitmap]::FromFile($Source)
  try {
    $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $bitmap.Dispose()
  }
}

function Test-UsefulImage {
  param([string]$Path)
  try {
    $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
    try {
      return $bitmap.Width -gt 8 -and $bitmap.Height -gt 8
    }
    finally {
      $bitmap.Dispose()
    }
  }
  catch {
    return $false
  }
}

function Select-RepresentativeImages {
  param(
    [object[]]$Files,
    [int]$Count = 4
  )
  $filesArray = @($Files)
  if ($filesArray.Count -eq 0) { return @() }
  if ($filesArray.Count -le $Count) { return $filesArray }

  $selected = New-Object System.Collections.Generic.List[object]
  $lastIndex = $filesArray.Count - 1
  $denominator = [Math]::Max(1, $Count - 1)
  for ($slot = 0; $slot -lt $Count; $slot += 1) {
    $slotIndex = [int][Math]::Round(($slot * $lastIndex) / $denominator)
    $best = $null
    for ($radius = 0; $radius -le $lastIndex -and -not $best; $radius += 1) {
      foreach ($offset in @(-$radius, $radius)) {
        $candidateIndex = $slotIndex + $offset
        if ($candidateIndex -lt 0 -or $candidateIndex -gt $lastIndex) { continue }
        $candidate = $filesArray[$candidateIndex]
        if ($selected.Contains($candidate)) { continue }
        if (Test-UsefulImage $candidate.FullName) {
          $best = $candidate
          break
        }
      }
    }
    if (-not $best) { $best = $filesArray[$slotIndex] }
    if (-not $selected.Contains($best)) {
      $selected.Add($best) | Out-Null
    }
  }
  return @($selected.ToArray())
}

function HtmlEscape {
  param([string]$Text)
  return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Get-WilPair {
  param([string]$WilPath)
  $dir = Split-Path -Parent $WilPath
  $base = [System.IO.Path]::GetFileNameWithoutExtension($WilPath)
  foreach ($ext in @(".WIX", ".wix", ".Wix")) {
    $candidate = Join-Path $dir ($base + $ext)
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

function Test-UsefulWilFrame {
  param([object]$Frame)
  if ($Frame -eq $null -or $Frame.Width -lt 12 -or $Frame.Height -lt 12) { return $false }
  $bitmap = $Frame.Bitmap
  $stepX = [Math]::Max(1, [int]($bitmap.Width / 16))
  $stepY = [Math]::Max(1, [int]($bitmap.Height / 16))
  $opaque = 0
  for ($y = 0; $y -lt $bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $bitmap.Width; $x += $stepX) {
      if ($bitmap.GetPixel($x, $y).A -gt 0) {
        $opaque += 1
        if ($opaque -ge 3) { return $true }
      }
    }
  }
  return $false
}

function Export-WilPreviewCard {
  param(
    [string]$Label,
    [string]$WilPath,
    [string]$OutDir,
    [int]$Wanted = 10,
    [int]$MaxScan = 600,
    [int]$StartFrame = 0
  )
  if (-not (Test-Path -LiteralPath $WilPath)) { return "" }
  $wixPath = Get-WilPair $WilPath
  if (-not $wixPath) { return "" }

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $lib = $null
  try {
    $lib = [Mir2WilLibrary]::new($WilPath, $wixPath)
    $imgHtml = @()
    $exported = 0
    $limit = [Math]::Min($lib.Count, [Math]::Max($StartFrame, 0) + $MaxScan)
    $step = if ($lib.Count -gt 1800) { 3 } elseif ($lib.Count -gt 900) { 2 } else { 1 }
    for ($frameIndex = [Math]::Max($StartFrame, 0); $frameIndex -lt $limit -and $exported -lt $Wanted; $frameIndex += $step) {
      $frame = $lib.ReadFrame($frameIndex)
      if ($frame -eq $null) { continue }
      try {
        if (-not (Test-UsefulWilFrame $frame)) { continue }
        $dest = Join-Path $OutDir ("{0}-frame-{1:D5}.png" -f (SafeName $Label), $frameIndex)
        $frame.Bitmap.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
        $imgHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $Label) frame $frameIndex`"><figcaption>$frameIndex<br>$($frame.Width)x$($frame.Height)</figcaption></figure>"
        $exported += 1
      }
      finally {
        $frame.Dispose()
      }
    }
    if (-not $exported) {
      return "<article class=`"card`"><h3>$(HtmlEscape $Label)</h3><p>$($lib.Count) frames, but no useful non-empty previews were found in the sampled range.</p></article>"
    }
    return "<article class=`"card wide`"><h3>$(HtmlEscape $Label)</h3><p>$($lib.Count) frames in <code>$(HtmlEscape (Split-Path -Leaf $WilPath))</code>.</p><div class=`"frames koreanframes`">$($imgHtml -join '')</div></article>"
  }
  catch {
    return "<article class=`"card`"><h3>$(HtmlEscape $Label)</h3><p>Could not decode: $(HtmlEscape $_.Exception.Message)</p></article>"
  }
  finally {
    if ($lib -ne $null) { $lib.Dispose() }
  }
}

function Convert-Rgb565ToColor {
  param([UInt16]$Value)
  if ($Value -eq 0) { return [System.Drawing.Color]::FromArgb(0, 0, 0, 0) }
  $r = ($Value -shr 11) -band 0x1F
  $g = ($Value -shr 5) -band 0x3F
  $b = $Value -band 0x1F
  $r = ($r -shl 3) -bor ($r -shr 2)
  $g = ($g -shl 2) -bor ($g -shr 4)
  $b = ($b -shl 3) -bor ($b -shr 2)
  return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Get-KoreanWilOffsets {
  param([string]$WixPath)
  $bytes = [System.IO.File]::ReadAllBytes($WixPath)
  if ($bytes.Length -lt 32) { return @() }
  $count = [BitConverter]::ToInt32($bytes, 20)
  $tableStart = 28
  $maxCount = [Math]::Floor(($bytes.Length - $tableStart) / 4)
  if ($count -le 0 -or $count -gt $maxCount) { $count = $maxCount }
  $offsets = New-Object int[] $count
  for ($i = 0; $i -lt $count; $i += 1) {
    $offsets[$i] = [BitConverter]::ToInt32($bytes, $tableStart + ($i * 4))
  }
  return $offsets
}

function Read-KoreanWilFrame {
  param(
    [byte[]]$WilBytes,
    [int]$Offset
  )
  if ($Offset -le 0 -or $Offset + 24 -ge $WilBytes.Length) { return $null }
  $w = [BitConverter]::ToInt16($WilBytes, $Offset)
  $h = [BitConverter]::ToInt16($WilBytes, $Offset + 2)
  if ($w -le 0 -or $h -le 0 -or $w -gt 1024 -or $h -gt 1024) { return $null }

  $cursor = $Offset + 21
  if ($cursor -ge $WilBytes.Length) { return $null }
  $bitmap = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    for ($y = 0; $y -lt $h; $y += 1) {
      if ($cursor + 2 -gt $WilBytes.Length) { break }
      $rowWords = [BitConverter]::ToUInt16($WilBytes, $cursor)
      $cursor += 2
      if ($rowWords -eq 0) { continue }
      $rowEnd = [Math]::Min($WilBytes.Length, $cursor + ($rowWords * 2))
      $x = 0
      while ($cursor + 4 -le $rowEnd -and $x -lt $w) {
        $command = [BitConverter]::ToUInt16($WilBytes, $cursor)
        $cursor += 2
        $count = [BitConverter]::ToUInt16($WilBytes, $cursor)
        $cursor += 2
        if ($command -eq 0x00C0) {
          $x += $count
        } elseif ($command -eq 0x00C1) {
          for ($i = 0; $i -lt $count -and $cursor + 2 -le $rowEnd -and $x -lt $w; $i += 1) {
            $value = [BitConverter]::ToUInt16($WilBytes, $cursor)
            $cursor += 2
            $bitmap.SetPixel($x, $y, (Convert-Rgb565ToColor $value))
            $x += 1
          }
        } else {
          $cursor = $rowEnd
          break
        }
      }
      if ($cursor -lt $rowEnd) { $cursor = $rowEnd }
    }
    return $bitmap
  }
  catch {
    $bitmap.Dispose()
    return $null
  }
}

function Test-UsefulBitmap {
  param([System.Drawing.Bitmap]$Bitmap)
  if ($Bitmap -eq $null -or $Bitmap.Width -lt 8 -or $Bitmap.Height -lt 8) { return $false }
  $stepX = [Math]::Max(1, [int]($Bitmap.Width / 16))
  $stepY = [Math]::Max(1, [int]($Bitmap.Height / 16))
  $opaque = 0
  for ($y = 0; $y -lt $Bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += $stepX) {
      if ($Bitmap.GetPixel($x, $y).A -gt 0) {
        $opaque += 1
        if ($opaque -ge 3) { return $true }
      }
    }
  }
  return $false
}

function Export-KoreanWilPreviewCard {
  param(
    [string]$Label,
    [string]$WilPath,
    [string]$OutDir,
    [int]$Wanted = 10,
    [int]$MaxScan = 900,
    [int]$StartFrame = 0
  )
  if (-not (Test-Path -LiteralPath $WilPath)) { return "" }
  $wixPath = Get-WilPair $WilPath
  if (-not $wixPath) { return "" }

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  try {
    $wilBytes = [System.IO.File]::ReadAllBytes($WilPath)
    $offsets = @(Get-KoreanWilOffsets $wixPath)
    if (-not $offsets.Count) { throw "No WIX offsets found." }
    $imgHtml = @()
    $exported = 0
    $end = [Math]::Min($offsets.Count, [Math]::Max($StartFrame, 0) + $MaxScan)
    $step = if ($MaxScan -le 500) { 1 } elseif ($offsets.Count -gt 4000) { 5 } elseif ($offsets.Count -gt 1600) { 3 } elseif ($offsets.Count -gt 800) { 2 } else { 1 }
    for ($frameIndex = [Math]::Max($StartFrame, 0); $frameIndex -lt $end -and $exported -lt $Wanted; $frameIndex += $step) {
      $bitmap = Read-KoreanWilFrame -WilBytes $wilBytes -Offset $offsets[$frameIndex]
      if ($bitmap -eq $null) { continue }
      try {
        if (-not (Test-UsefulBitmap $bitmap)) { continue }
        $dest = Join-Path $OutDir ("{0}-frame-{1:D5}.png" -f (SafeName $Label), $frameIndex)
        $bitmap.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
        $imgHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $Label) frame $frameIndex`"><figcaption>$frameIndex<br>$($bitmap.Width)x$($bitmap.Height)</figcaption></figure>"
        $exported += 1
      }
      finally {
        $bitmap.Dispose()
      }
    }
    if (-not $exported) {
      return "<article class=`"card`"><h3>$(HtmlEscape $Label)</h3><p>$($offsets.Count) frames, but no useful previews were found in the sampled range.</p></article>"
    }
    return "<article class=`"card wide`"><h3>$(HtmlEscape $Label)</h3><p>$($offsets.Count) indexed frames in <code>$(HtmlEscape (Split-Path -Leaf $WilPath))</code>.</p><div class=`"frames koreanframes`">$($imgHtml -join '')</div></article>"
  }
  catch {
    return "<article class=`"card`"><h3>$(HtmlEscape $Label)</h3><p>Could not decode Korean WIL: $(HtmlEscape $_.Exception.Message)</p></article>"
  }
}

New-CleanDirectory $Assets

. (Join-Path $PSScriptRoot "decode-mir2-wil.ps1")

$decodedWilPacks = @(
  @{
    Name = "Mir3Mobs"
    Root = Join-Path $Extracted "Mir3Mobs\Mir3Mobs"
    AssetFolder = "mir3-mobs"
    Description = "Mir3 custom mob pack"
    Recurse = $false
  },
  @{
    Name = "Killmaster Mobs 2"
    Root = Join-Path $Extracted "Killmaster Mobs 2"
    AssetFolder = "killmaster-mobs-2"
    Description = "Killmaster monster pack"
    Recurse = $false
  },
  @{
    Name = "Mon51"
    Root = Join-Path $Extracted "Mon51"
    AssetFolder = "mon51"
    Description = "Mon51 monster library"
    Recurse = $false
  },
  @{
    Name = "NewMobsMagic WIL"
    Root = Join-Path $Extracted "NewMobsMagic\mon"
    AssetFolder = "new-mobs-magic-wil"
    Description = "NewMobsMagic monster WIL libraries"
    Recurse = $false
  }
)

foreach ($decodedPack in $decodedWilPacks) {
  if (-not (Test-Path -LiteralPath $decodedPack.Root)) { continue }
  Write-Output "Decoding $($decodedPack.Name) WIL/WIX libraries..."
  $decodeArgs = @{
    Mir3Root = $decodedPack.Root
    OutRoot = (Join-Path $Assets $decodedPack.AssetFolder)
  }
  if ($decodedPack.Recurse) { $decodeArgs.Recurse = $true }
  & (Join-Path $PSScriptRoot "export-mir3-mobs-showcase.ps1") @decodeArgs | Out-Host
}

$summary = @()
$sections = New-Object System.Collections.Generic.List[string]

$packs = Get-ChildItem -LiteralPath $Extracted -Directory | Sort-Object Name
foreach ($pack in $packs) {
  $files = Get-ChildItem -LiteralPath $pack.FullName -Recurse -File
  $summary += [pscustomobject]@{
    Pack = $pack.Name
    Files = $files.Count
    MB = [Math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 2)
    Extensions = (($files | Group-Object Extension | Sort-Object Count -Descending | Select-Object -First 8 | ForEach-Object { "$($_.Name): $($_.Count)" }) -join ", ")
  }
}

# KoreanData2017: old Korean client data libraries. Sample the useful visual sets.
$koreanRoot = Join-Path $Extracted "KoreanData2017\Data"
if (Test-Path -LiteralPath $koreanRoot) {
  $koreanOut = Join-Path $Assets "korean-data-2017"
  New-Item -ItemType Directory -Force -Path $koreanOut | Out-Null

  $koreanGroups = @(
    @{
      Id = "korean-map-core"
      Title = "KoreanData2017 - Core Map Libraries"
      Description = "Root map/object sets. These are good candidates for reusable zone lanes, cave floors, walls, cliffs, buildings, furniture, and smaller object props."
      Libs = @(
        @{ Label = "Ground"; Path = "Ground.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Tiles"; Path = "Tilesc.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Tiles30"; Path = "Tiles30c.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Small Tiles"; Path = "SmTilesc.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Walls"; Path = "Wallsc.wil"; Wanted = 8; MaxScan = 700 },
        @{ Label = "Cliffs"; Path = "Cliffsc.wil"; Wanted = 8; MaxScan = 700 },
        @{ Label = "Dungeon Objects"; Path = "Dungeonsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Small Objects"; Path = "SmObjectsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Animations"; Path = "Animationsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Houses"; Path = "Housesc.wil"; Wanted = 8; MaxScan = 900 },
        @{ Label = "Furniture"; Path = "Furnituresc.wil"; Wanted = 8; MaxScan = 900 }
      )
    },
    @{
      Id = "korean-theme-sets"
      Title = "KoreanData2017 - Theme Sets"
      Description = "The same map library types repeated for Forest, Sand, Snow, and Wood themes. These are probably the most interesting pieces for future zones."
      Libs = @(
        @{ Label = "Forest Tiles"; Path = "Forest\Tilesc.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Forest Objects"; Path = "Forest\SmObjectsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Forest Walls"; Path = "Forest\Wallsc.wil"; Wanted = 8; MaxScan = 800 },
        @{ Label = "Sand Tiles"; Path = "Sand\Tilesc.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Sand Objects"; Path = "Sand\SmObjectsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Sand Walls"; Path = "Sand\Wallsc.wil"; Wanted = 8; MaxScan = 800 },
        @{ Label = "Snow Tiles"; Path = "Snow\Tilesc.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Snow Objects"; Path = "Snow\SmObjectsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Snow Walls"; Path = "Snow\Wallsc.wil"; Wanted = 8; MaxScan = 800 },
        @{ Label = "Wood Tiles"; Path = "Wood\Tilesc.wil"; Wanted = 8; MaxScan = 500 },
        @{ Label = "Wood Objects"; Path = "Wood\SmObjectsc.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Wood Walls"; Path = "Wood\Wallsc.wil"; Wanted = 8; MaxScan = 800 }
      )
    },
    @{
      Id = "korean-ui-items"
      Title = "KoreanData2017 - UI, Items, Equipment"
      Description = "Inventory/store/equipment libraries and map thumbnails. These may be useful for cleaner UI assets or missing item icons."
      Libs = @(
        @{ Label = "Inventory"; Path = "Inventory.wil"; Wanted = 16; MaxScan = 900 },
        @{ Label = "Store Items"; Path = "Storeitem.wil"; Wanted = 16; MaxScan = 900 },
        @{ Label = "Equipment"; Path = "Equip.wil"; Wanted = 16; MaxScan = 900 },
        @{ Label = "Monster Images"; Path = "MonImg.wil"; Wanted = 10; MaxScan = 900 },
        @{ Label = "Mini Map"; Path = "Mmap.wil"; Wanted = 8; MaxScan = 700 },
        @{ Label = "Female Mini Map"; Path = "Fmmap.wil"; Wanted = 8; MaxScan = 700 }
      )
    },
    @{
      Id = "korean-characters-weapons"
      Title = "KoreanData2017 - Characters and Weapons"
      Description = "Male/female humanoid and weapon overlay libraries. These are large animation libraries; this page only samples early usable frames."
      Libs = @(
        @{ Label = "Male Humanoid Ex1"; Path = "M-HumEx1.wil"; Wanted = 10; MaxScan = 1400 },
        @{ Label = "Female Humanoid Ex1"; Path = "WM-HumEx1.wil"; Wanted = 10; MaxScan = 1400 },
        @{ Label = "Male Weapon 1"; Path = "M-Weapon1.wil"; Wanted = 10; MaxScan = 1400 },
        @{ Label = "Male Weapon 2"; Path = "M-Weapon2.wil"; Wanted = 10; MaxScan = 1400 },
        @{ Label = "Female Weapon 1"; Path = "WM-Weapon1.wil"; Wanted = 10; MaxScan = 1400 },
        @{ Label = "Female Weapon 2"; Path = "WM-Weapon2.wil"; Wanted = 10; MaxScan = 1400 }
      )
    }
  )

  foreach ($group in $koreanGroups) {
    $cards = New-Object System.Collections.Generic.List[string]
    foreach ($libSpec in $group.Libs) {
      $wilPath = Join-Path $koreanRoot $libSpec.Path
      $outDir = Join-Path $koreanOut (SafeName ($group.Id + "-" + $libSpec.Label))
      $card = Export-KoreanWilPreviewCard -Label $libSpec.Label -WilPath $wilPath -OutDir $outDir -Wanted $libSpec.Wanted -MaxScan $libSpec.MaxScan
      if ($card) { $cards.Add($card) | Out-Null }
    }
    if ($cards.Count) {
      $sections.Add("<section id=`"$($group.Id)`"><h2>$(HtmlEscape $group.Title)</h2><p>$(HtmlEscape $group.Description)</p><div class=`"grid`">$($cards -join "`n")</div></section>")
    }
  }

  $monImgPath = Join-Path $koreanRoot "MonImg.wil"
  if (Test-Path -LiteralPath $monImgPath) {
    $cards = New-Object System.Collections.Generic.List[string]
    foreach ($slice in @(0, 420, 840, 1260, 1680)) {
      $outDir = Join-Path $koreanOut ("monster-images-{0:D4}" -f $slice)
      $wanted = if ($slice -eq 0) { 120 } else { 18 }
      $scan = if ($slice -eq 0) { 420 } else { 320 }
      $card = Export-KoreanWilPreviewCard -Label ("MonImg frames {0}-{1}" -f $slice, ($slice + $scan - 1)) -WilPath $monImgPath -OutDir $outDir -Wanted $wanted -MaxScan $scan -StartFrame $slice
      if ($card) { $cards.Add($card) | Out-Null }
    }
    if ($cards.Count) {
      $sections.Add("<section id=`"korean-monster-images`"><h2>KoreanData2017 - Monster Images</h2><p>This pack does not appear to include full monster combat animation libraries like <code>Mon1.wil</code>, <code>Mon2.wil</code>, etc. It does include <code>MonImg.wil</code>, which looks like static monster image/thumb data. These slices sample across all 2,000 indexed frames so we can see what is in there.</p><div class=`"grid`">$($cards -join "`n")</div></section>")
    }
  }
}

# HD MOBS: direct PNG frame previews by leaf monster folder.
$hdRoot = Join-Path $Extracted "HD MOBS"
if (Test-Path -LiteralPath $hdRoot) {
  $hdOut = Join-Path $Assets "hd-mobs"
  New-Item -ItemType Directory -Force -Path $hdOut | Out-Null
  $cards = New-Object System.Collections.Generic.List[string]
  $groups = Get-ChildItem -LiteralPath $hdRoot -Recurse -Directory |
    Where-Object { $_.Name -ne "Placements" -and @(Get-ChildItem -LiteralPath $_.FullName -File -Filter "*.PNG" -ErrorAction SilentlyContinue).Count -gt 0 } |
    Sort-Object FullName |
    Select-Object -First $MaxHdGroups
  foreach ($group in $groups) {
    $relativeGroup = $group.FullName.Substring($hdRoot.Length).TrimStart("\")
    $safe = SafeName $relativeGroup
    $frameFiles = Get-ChildItem -LiteralPath $group.FullName -File -Filter "*.PNG" | Sort-Object Name
    $samples = @()
    $samples = Select-RepresentativeImages -Files $frameFiles -Count $FramesPerHdGroup
    $imgHtml = @()
    $i = 0
    foreach ($sample in $samples) {
      $dest = Join-Path $hdOut ("{0}-{1:D2}.png" -f $safe, $i)
      Copy-Item -LiteralPath $sample.FullName -Destination $dest -Force
      $imgHtml += "<img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $relativeGroup) frame $i`">"
      $i += 1
    }
    $cards.Add("<article class=`"card`"><h3>$(HtmlEscape $relativeGroup)</h3><p>$($frameFiles.Count) PNG frames</p><div class=`"frames`">$($imgHtml -join '')</div></article>")
  }
  $sections.Add("<section id=`"HD-MOBS`"><h2>HD MOBS</h2><p>Direct PNG frames, already grouped by dungeon and monster. Showing $($groups.Count) monster folders out of the extracted pack.</p><div class=`"grid`">$($cards -join "`n")</div></section>")
}

# Nemos weapons: convert item/state BMP previews.
$nemosRoot = Join-Path $Extracted "NemosWeps\NemosWeps"
if (Test-Path -LiteralPath $nemosRoot) {
  $nemosOut = Join-Path $Assets "nemos-weps"
  New-Item -ItemType Directory -Force -Path $nemosOut | Out-Null
  $cards = New-Object System.Collections.Generic.List[string]
  foreach ($weapon in (Get-ChildItem -LiteralPath $nemosRoot -Directory | Sort-Object Name)) {
    $imgHtml = @()
    $bmpFiles = Get-ChildItem -LiteralPath $weapon.FullName -Recurse -File -Filter "*.bmp" | Sort-Object FullName
    $i = 0
    foreach ($bmp in $bmpFiles) {
      $dest = Join-Path $nemosOut ("{0}-{1:D2}.png" -f (SafeName $weapon.Name), $i)
      Copy-ImageAsPng -Source $bmp.FullName -Destination $dest
      $label = $bmp.Directory.Name
      $imgHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $weapon.Name) $label`"><figcaption>$(HtmlEscape $label)</figcaption></figure>"
      $i += 1
    }
    $wilCount = @(Get-ChildItem -LiteralPath $weapon.FullName -File -Filter "*.Wil").Count
    $cards.Add("<article class=`"card weapon`"><h3>$(HtmlEscape $weapon.Name)</h3><p>$wilCount WIL animation library file(s), $($bmpFiles.Count) preview BMP(s)</p><div class=`"frames`">$($imgHtml -join '')</div></article>")
  }
  $sections.Add("<section id=`"NemosWeps`"><h2>NemosWeps</h2><p>Weapon pack with WIL/WIX animation libraries plus item and character-page BMP previews. The BMP previews below were converted to PNG for the browser.</p><div class=`"grid`">$($cards -join "`n")</div></section>")
}

# HighQualitySpells: export sample Crystal Lib frames.
$spellRoot = Join-Path $Extracted "HighQualitySpells"
if (Test-Path -LiteralPath $spellRoot) {
  $spellOut = Join-Path $Assets "high-quality-spells"
  New-Item -ItemType Directory -Force -Path $spellOut | Out-Null
  $cards = New-Object System.Collections.Generic.List[string]
  foreach ($libFile in (Get-ChildItem -LiteralPath $spellRoot -File -Filter "*.Lib" | Sort-Object Name)) {
    $lib = [NewContentCrystalLib]::new($libFile.FullName)
    try {
      $imgHtml = @()
      $exported = 0
      $decodeErrors = 0
      for ($frame = 0; $frame -lt $lib.Count -and $exported -lt $MaxLibFrames; $frame += 1) {
        $image = $null
        try {
          $image = $lib.ReadImage($frame)
        }
        catch {
          $decodeErrors += 1
          if ($decodeErrors -gt 8) { break }
          continue
        }
        if ($image -eq $null) { continue }
        try {
          if ($image.Bitmap.Width -le 1 -or $image.Bitmap.Height -le 1) { continue }
          $dest = Join-Path $spellOut ("{0}-frame-{1:D5}.png" -f (SafeName $libFile.BaseName), $frame)
          $image.Bitmap.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
          $imgHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$($libFile.Name) frame $frame`"><figcaption>$frame</figcaption></figure>"
          $exported += 1
        }
        finally {
          $image.Dispose()
        }
      }
      $decodeNote = if ($exported -gt 0) {
        "$($lib.Count) frames in library, first $exported non-empty frames previewed."
      } else {
        "$($lib.Count) indexed frames found, but this library did not decode with the current Crystal .Lib reader. It likely needs an older WIL/LIB decoder before we can preview/import it."
      }
      $cards.Add("<article class=`"card wide`"><h3>$($libFile.Name)</h3><p>$(HtmlEscape $decodeNote)</p><div class=`"frames spellframes`">$($imgHtml -join '')</div></article>")
    }
    finally {
      $lib.Dispose()
    }
  }
  $sections.Add("<section id=`"HighQualitySpells`"><h2>HighQualitySpells</h2><p>Crystal .Lib spell effect libraries. These decode with our existing Crystal image format reader, so these are real exported frames rather than placeholders.</p><div class=`"stack`">$($cards -join "`n")</div></section>")
}

# NewMobsMagic: GIF previews and WIL/WIX inventory.
$magicRoot = Join-Path $Extracted "NewMobsMagic"
if (Test-Path -LiteralPath $magicRoot) {
  $magicOut = Join-Path $Assets "new-mobs-magic"
  New-Item -ItemType Directory -Force -Path $magicOut | Out-Null
  $gifHtml = @()
  foreach ($gif in (Get-ChildItem -LiteralPath $magicRoot -File -Filter "*.GIF" | Sort-Object Name)) {
    $dest = Join-Path $magicOut $gif.Name
    Copy-Item -LiteralPath $gif.FullName -Destination $dest -Force
    $gifHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $gif.Name)`"><figcaption>$(HtmlEscape $gif.Name)</figcaption></figure>"
  }
  $wilRows = Get-ChildItem -LiteralPath $magicRoot -Recurse -File -Include "*.wil","*.wix" |
    Sort-Object FullName |
    ForEach-Object {
      $rel = $_.FullName.Substring($magicRoot.Length).TrimStart("\")
      "<tr><td>$(HtmlEscape $rel)</td><td>$([Math]::Round($_.Length / 1MB, 2)) MB</td></tr>"
    }
  $sections.Add("<section id=`"NewMobsMagic`"><h2>NewMobsMagic</h2><p>Mostly old .wil/.wix monster libraries, plus a few GIF previews and a Monster.DB support file. We can decode these later if we want to import them; for now this page shows the available previews and inventory.</p><div class=`"frames`">$($gifHtml -join '')</div><details><summary>WIL/WIX library list</summary><table><thead><tr><th>File</th><th>Size</th></tr></thead><tbody>$($wilRows -join "`n")</tbody></table></details></section>")
}

# Generic direct PNG packs, such as TitanMonsters2.
$handledDirectPngPacks = @("HD MOBS", "NemosWeps", "NewMobsMagic", "HighQualitySpells")
foreach ($pack in (Get-ChildItem -LiteralPath $Extracted -Directory | Sort-Object Name)) {
  if ($handledDirectPngPacks -contains $pack.Name) { continue }
  $pngFiles = @(Get-ChildItem -LiteralPath $pack.FullName -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -ieq ".png" } |
    Sort-Object FullName)
  if (-not $pngFiles.Count) { continue }

  $packOut = Join-Path $Assets ("direct-png-" + (SafeName $pack.Name))
  New-Item -ItemType Directory -Force -Path $packOut | Out-Null
  $cards = New-Object System.Collections.Generic.List[string]
  $leafFolders = $pngFiles | Group-Object DirectoryName | Sort-Object Name
  foreach ($leaf in $leafFolders) {
    $folderFiles = @($leaf.Group | Sort-Object Name)
    $relFolder = $leaf.Name.Substring($pack.FullName.Length).TrimStart("\")
    if (-not $relFolder) { $relFolder = $pack.Name }

    if ($folderFiles.Count -gt 200) {
      $chunkSize = 80
      for ($start = 0; $start -lt $folderFiles.Count; $start += $chunkSize) {
        if ($cards.Count -ge 40) { break }
        $chunk = @($folderFiles | Select-Object -Skip $start -First $chunkSize)
        $samples = Select-RepresentativeImages -Files $chunk -Count 4
        $imgHtml = @()
        $i = 0
        foreach ($sample in $samples) {
          $dest = Join-Path $packOut ("{0}-frames-{1:D5}-{2:D2}.png" -f (SafeName $relFolder), $start, $i)
          Copy-Item -LiteralPath $sample.FullName -Destination $dest -Force
          $imgHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $pack.Name) frame $start sample $i`"><figcaption>$(HtmlEscape $sample.BaseName)</figcaption></figure>"
          $i += 1
        }
        $end = [Math]::Min($folderFiles.Count - 1, $start + $chunkSize - 1)
        $cards.Add("<article class=`"card`"><h3>$(HtmlEscape $relFolder) frames $start-$end</h3><p>$($chunk.Count) PNG frames in this slice.</p><div class=`"frames`">$($imgHtml -join '')</div></article>")
      }
    } else {
      if ($cards.Count -ge 40) { break }
      $samples = @()
      $samples = Select-RepresentativeImages -Files $folderFiles -Count $FramesPerHdGroup
      $imgHtml = @()
      $i = 0
      foreach ($sample in $samples) {
        $dest = Join-Path $packOut ("{0}-{1:D2}.png" -f (SafeName $relFolder), $i)
        Copy-Item -LiteralPath $sample.FullName -Destination $dest -Force
        $imgHtml += "<figure><img src=`"$(RelPath $dest)`" alt=`"$(HtmlEscape $relFolder) frame $i`"><figcaption>$(HtmlEscape $sample.BaseName)</figcaption></figure>"
        $i += 1
      }
      $cards.Add("<article class=`"card`"><h3>$(HtmlEscape $relFolder)</h3><p>$($folderFiles.Count) PNG frames</p><div class=`"frames`">$($imgHtml -join '')</div></article>")
    }
  }
  if ($cards.Count) {
    $sectionId = SafeName $pack.Name
    $sections.Add("<section id=`"$sectionId`"><h2>$(HtmlEscape $pack.Name)</h2><p>Direct PNG-frame pack. Showing representative frame slices; this is likely much easier to preview/import than WIL/WIX-only packs.</p><div class=`"grid`">$($cards -join "`n")</div></section>")
  }
}

# Decoded legacy Mir WIL+WIX packs.
foreach ($decodedPack in $decodedWilPacks) {
  $decodedAssets = Join-Path $Assets $decodedPack.AssetFolder
  $manifestPath = Join-Path $decodedAssets "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath)) { continue }
  $entries = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $cards = New-Object System.Collections.Generic.List[string]
  foreach ($entry in ($entries | Sort-Object Library)) {
    $folder = Join-Path $decodedAssets $entry.Folder
    if (-not (Test-Path -LiteralPath $folder)) { continue }
    $imgHtml = @()
    foreach ($png in (Get-ChildItem -LiteralPath $folder -File -Filter "*.png" | Sort-Object Name)) {
      $imgHtml += "<figure><img src=`"$(RelPath $png.FullName)`" alt=`"$(HtmlEscape $entry.Library) $(HtmlEscape $png.BaseName)`"><figcaption>$(HtmlEscape $png.BaseName)</figcaption></figure>"
    }
    if (-not $imgHtml.Count) { continue }
    $cards.Add("<article class=`"card`"><h3>$(HtmlEscape $entry.Library)</h3><p>$($entry.Frames) indexed frames, $($entry.UsefulFrames) useful previews found, largest $($entry.Largest).</p><div class=`"frames mir3frames`">$($imgHtml -join '')</div></article>")
  }
  if ($cards.Count) {
    $sectionId = SafeName $decodedPack.Name
    $sections.Add("<section id=`"$sectionId`"><h2>$(HtmlEscape $decodedPack.Name)</h2><p>Decoded from <code>Mon*.wil</code> + <code>Mon*.wix</code> library pairs ($($decodedPack.Description)). Each card shows sampled animation frames spread across the library.</p><div class=`"grid`">$($cards -join "`n")</div></section>")
  }
}

# Generic WIL/WIX library inventory for packs that do not have direct preview support yet.
$handledLibraryInventoryPacks = @("NemosWeps", "NewMobsMagic", "HighQualitySpells", "Mir3Mobs", "Killmaster Mobs 2", "Mon51")
$librarySections = New-Object System.Collections.Generic.List[string]
foreach ($pack in (Get-ChildItem -LiteralPath $Extracted -Directory | Sort-Object Name)) {
  if ($handledLibraryInventoryPacks -contains $pack.Name) { continue }
  $libs = @(Get-ChildItem -LiteralPath $pack.FullName -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -iin @(".wil", ".wix") } |
    Sort-Object FullName)
  if (-not $libs.Count) { continue }
  $rows = $libs | ForEach-Object {
    $rel = $_.FullName.Substring($pack.FullName.Length).TrimStart("\")
    "<tr><td>$(HtmlEscape $pack.Name)</td><td>$(HtmlEscape $rel)</td><td>$([Math]::Round($_.Length / 1MB, 2)) MB</td></tr>"
  }
  $librarySections.Add($rows -join "`n")
}
if ($librarySections.Count) {
  $sections.Add("<section id=`"wil-wix-needs-decode`"><h2>WIL/WIX Library Packs Needing Decode</h2><p>These packs extracted successfully, but are old WIL/WIX libraries rather than browser-viewable PNG frames. They may contain useful new mobs, but need a compatible WIL/WIX decoder before we can judge/import them properly.</p><details open><summary>Library inventory</summary><table><thead><tr><th>Pack</th><th>File</th><th>Size</th></tr></thead><tbody>$($librarySections -join "`n")</tbody></table></details></section>")
}

$summaryRows = $summary | ForEach-Object {
  "<tr><td>$(HtmlEscape $_.Pack)</td><td>$($_.Files)</td><td>$($_.MB)</td><td>$(HtmlEscape $_.Extensions)</td></tr>"
}

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>LOM Idle V2 - New Content Show and Tell</title>
  <style>
    :root { color-scheme: dark; --bg:#11100e; --panel:#1b1712; --line:#57452b; --text:#ead9b8; --muted:#b79d6d; --accent:#d09a46; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 13px/1.45 "Segoe UI", Arial, sans-serif; }
    header { position: sticky; top: 0; z-index: 2; background: rgba(17,16,14,.96); border-bottom: 1px solid var(--line); padding: 14px 18px; }
    h1 { margin: 0 0 4px; color: #f1c879; font-size: 22px; }
    h2 { margin: 26px 0 10px; color: #f1c879; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
    h3 { margin: 0 0 6px; font-size: 14px; color: #ffd992; }
    p { margin: 0 0 10px; color: var(--muted); }
    main { padding: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; background: #15120e; }
    th, td { border: 1px solid #3f321f; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { color: #f1c879; background: #211a12; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
    .stack { display: grid; gap: 12px; }
    .card { border: 1px solid #44351f; background: var(--panel); padding: 10px; min-height: 132px; }
    .card.wide { overflow: hidden; }
    .frames { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-end; }
    .frames img { max-width: 96px; max-height: 96px; image-rendering: pixelated; background: #080706; border: 1px solid #2e2518; object-fit: contain; }
    .mir3frames img { max-width: 128px; max-height: 128px; }
    .koreanframes img { max-width: 128px; max-height: 128px; }
    .spellframes { max-height: 430px; overflow: auto; align-items: center; }
    .spellframes img { max-width: 90px; max-height: 90px; }
    figure { margin: 0; display: grid; gap: 3px; justify-items: center; color: #a78f63; font-size: 11px; }
    details { margin-top: 10px; }
    summary { cursor: pointer; color: var(--accent); }
    code { color: #f1c879; }
    nav { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    nav a { color: var(--accent); text-decoration: none; border: 1px solid #4a3a24; padding: 4px 8px; background: #1a1510; }
    nav a:hover { border-color: #8a6a3a; }
  </style>
</head>
<body>
  <header>
    <h1>New Content Show and Tell</h1>
    <p>Generated from <code>$(HtmlEscape $Root)</code>. This is a review gallery only; nothing here has been added to the live game.</p>
    <nav>
      <a href="#Mir3Mobs">Mir3Mobs (decoded WIL/WIX)</a>
      <a href="#korean-map-core">KoreanData maps</a>
      <a href="#korean-theme-sets">KoreanData themes</a>
      <a href="#korean-ui-items">KoreanData UI/items</a>
      <a href="#korean-characters-weapons">KoreanData characters</a>
      <a href="#korean-monster-images">KoreanData monster images</a>
      <a href="#Killmaster-Mobs-2">Killmaster Mobs 2 (decoded)</a>
      <a href="#Mon51">Mon51 (decoded)</a>
      <a href="#NewMobsMagic-WIL">NewMobsMagic WIL (decoded)</a>
      <a href="#TitanMonsters2">TitanMonsters2 (PNG previews)</a>
      <a href="#HD-MOBS">HD MOBS</a>
      <a href="#HighQualitySpells">HighQualitySpells</a>
      <a href="#NewMobsMagic">NewMobsMagic</a>
      <a href="#NemosWeps">NemosWeps</a>
    </nav>
  </header>
  <main>
    <section>
      <h2>Pack Summary</h2>
      <table><thead><tr><th>Pack</th><th>Files</th><th>Extracted MB</th><th>Extensions</th></tr></thead><tbody>$($summaryRows -join "`n")</tbody></table>
    </section>
    $($sections -join "`n")
  </main>
</body>
</html>
"@

[System.IO.File]::WriteAllText((Join-Path $Showcase "index.html"), $html, [System.Text.UTF8Encoding]::new($false))
"showcase=$(Join-Path $Showcase "index.html")"
