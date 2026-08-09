param(
  # Comma-separated source frame numbers (e.g. "3200,3220,3227"). Empty = curated sample set.
  [string]$Sources = "",
  # Output directory for preview PNGs + HTML gallery (not wired into the game).
  [string]$OutDir = "$PSScriptRoot\..\docs\glyph-variant-preview",
  # Also write numbered frames into the live items folder (off by default).
  [switch]$Promote,
  # First frame number when promoting (defaults to 3230).
  [int]$PromoteStart = 3230,
  # Scale factor for the HTML preview thumbs (source stays 1x).
  [int]$PreviewScale = 4
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ItemsDir = Join-Path $PSScriptRoot "..\public\item-icons\items"

function ClampByte([double]$v) {
  if ($v -lt 0) { return [byte]0 }
  if ($v -gt 255) { return [byte]255 }
  return [byte][Math]::Round($v)
}

function RgbToHsl([byte]$r, [byte]$g, [byte]$b) {
  $rf = $r / 255.0; $gf = $g / 255.0; $bf = $b / 255.0
  $max = [Math]::Max($rf, [Math]::Max($gf, $bf))
  $min = [Math]::Min($rf, [Math]::Min($gf, $bf))
  $l = ($max + $min) / 2.0
  if ($max -eq $min) {
    return @{ H = 0.0; S = 0.0; L = $l }
  }
  $d = $max - $min
  $s = if ($l -gt 0.5) { $d / (2.0 - $max - $min) } else { $d / ($max + $min) }
  $h = 0.0
  if ($max -eq $rf) { $h = (($gf - $bf) / $d) + $(if ($gf -lt $bf) { 6.0 } else { 0.0 }) }
  elseif ($max -eq $gf) { $h = (($bf - $rf) / $d) + 2.0 }
  else { $h = (($rf - $gf) / $d) + 4.0 }
  $h /= 6.0
  return @{ H = $h; S = $s; L = $l }
}

function HueToRgb([double]$p, [double]$q, [double]$t) {
  if ($t -lt 0) { $t += 1 }
  if ($t -gt 1) { $t -= 1 }
  if ($t -lt 1.0 / 6.0) { return $p + ($q - $p) * 6.0 * $t }
  if ($t -lt 0.5) { return $q }
  if ($t -lt 2.0 / 3.0) { return $p + ($q - $p) * (2.0 / 3.0 - $t) * 6.0 }
  return $p
}

function HslToRgb([double]$h, [double]$s, [double]$l) {
  if ($s -le 0) {
    $v = ClampByte ($l * 255.0)
    return @{ R = $v; G = $v; B = $v }
  }
  $q = if ($l -lt 0.5) { $l * (1 + $s) } else { $l + $s - $l * $s }
  $p = 2 * $l - $q
  $r = HueToRgb $p $q ($h + 1.0 / 3.0)
  $g = HueToRgb $p $q $h
  $b = HueToRgb $p $q ($h - 1.0 / 3.0)
  return @{ R = (ClampByte ($r * 255.0)); G = (ClampByte ($g * 255.0)); B = (ClampByte ($b * 255.0)) }
}

function CloneBitmap([System.Drawing.Bitmap]$src) {
  $dst = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
      $dst.SetPixel($x, $y, $src.GetPixel($x, $y))
    }
  }
  return $dst
}

function TransformBitmap {
  param(
    [System.Drawing.Bitmap]$Src,
    [switch]$FlipH,
    [double]$HueDeg = 0,
    [double]$SatMul = 1.0,
    [double]$LightAdd = 0.0,
    [ValidateSet("none", "rb", "rg", "gb")]
    [string]$ChannelSwap = "none"
  )

  $work = CloneBitmap $Src
  if ($FlipH) {
    $work.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
  }

  $needColor = ($HueDeg -ne 0) -or ($SatMul -ne 1.0) -or ($LightAdd -ne 0.0) -or ($ChannelSwap -ne "none")
  if (-not $needColor) { return $work }

  $hueShift = (($HueDeg % 360) + 360) % 360
  $hueShift /= 360.0

  for ($y = 0; $y -lt $work.Height; $y++) {
    for ($x = 0; $x -lt $work.Width; $x++) {
      $c = $work.GetPixel($x, $y)
      if ($c.A -eq 0) { continue }

      $r = [int]$c.R; $g = [int]$c.G; $b = [int]$c.B
      switch ($ChannelSwap) {
        "rb" { $tmp = $r; $r = $b; $b = $tmp }
        "rg" { $tmp = $r; $r = $g; $g = $tmp }
        "gb" { $tmp = $g; $g = $b; $b = $tmp }
      }

      if (($HueDeg -ne 0) -or ($SatMul -ne 1.0) -or ($LightAdd -ne 0.0)) {
        $hsl = RgbToHsl ([byte]$r) ([byte]$g) ([byte]$b)
        $h = ($hsl.H + $hueShift) % 1.0
        $s = [Math]::Max(0.0, [Math]::Min(1.0, $hsl.S * $SatMul))
        $l = [Math]::Max(0.0, [Math]::Min(1.0, $hsl.L + $LightAdd))
        $rgb = HslToRgb $h $s $l
        $r = $rgb.R; $g = $rgb.G; $b = $rgb.B
      }

      $work.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int]$c.A, $r, $g, $b))
    }
  }
  return $work
}

function SavePng([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function ScaleNearest([System.Drawing.Bitmap]$src, [int]$scale) {
  $dst = New-Object System.Drawing.Bitmap ($src.Width * $scale), ($src.Height * $scale), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $dst.Width, $dst.Height)
  $g.Dispose()
  return $dst
}

# Curated transforms: label -> params
$Transforms = @(
  @{ Id = "orig"; Label = "original"; FlipH = $false; HueDeg = 0; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "flip"; Label = "flip H"; FlipH = $true; HueDeg = 0; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "hue60"; Label = "hue +60"; FlipH = $false; HueDeg = 60; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "hue120"; Label = "hue +120"; FlipH = $false; HueDeg = 120; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "hue180"; Label = "hue +180"; FlipH = $false; HueDeg = 180; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "hue240"; Label = "hue +240"; FlipH = $false; HueDeg = 240; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "flip-hue90"; Label = "flip + hue +90"; FlipH = $true; HueDeg = 90; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "flip-hue200"; Label = "flip + hue +200"; FlipH = $true; HueDeg = 200; SatMul = 1.15; LightAdd = 0.0; ChannelSwap = "none" },
  @{ Id = "swap-rb"; Label = "swap R/B"; FlipH = $false; HueDeg = 0; SatMul = 1.0; LightAdd = 0.0; ChannelSwap = "rb" },
  @{ Id = "cold"; Label = "cold (sat+ light-)"; FlipH = $false; HueDeg = 200; SatMul = 1.25; LightAdd = -0.06; ChannelSwap = "none" },
  @{ Id = "fire"; Label = "fire (hue+sat)"; FlipH = $false; HueDeg = 20; SatMul = 1.35; LightAdd = 0.04; ChannelSwap = "none" },
  @{ Id = "shadow"; Label = "shadow"; FlipH = $true; HueDeg = 260; SatMul = 0.85; LightAdd = -0.12; ChannelSwap = "none" }
)

if ([string]::IsNullOrWhiteSpace($Sources)) {
  $sourceList = @(3200, 3205, 3210, 3215, 3220, 3225, 3226, 3227)
} else {
  $sourceList = @($Sources.Split(",") | ForEach-Object { [int]($_.Trim()) })
}

if (Test-Path -LiteralPath $OutDir) {
  Remove-Item -LiteralPath $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutDir | Out-Null
$previewDir = Join-Path $OutDir "preview"
New-Item -ItemType Directory -Path $previewDir | Out-Null

$promoteNext = $PromoteStart
$manifest = @()
$htmlRows = New-Object System.Collections.Generic.List[string]

foreach ($frame in $sourceList) {
  $srcPath = Join-Path $ItemsDir ("frame_{0:D6}.png" -f $frame)
  if (-not (Test-Path -LiteralPath $srcPath)) {
    Write-Warning "Missing source $srcPath - skipping"
    continue
  }

  $srcBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcPath).Path)
  $rowCells = New-Object System.Collections.Generic.List[string]
  $rowCells.Add("<th class='src'>#$frame</th>") | Out-Null

  foreach ($t in $Transforms) {
    $outName = "from_{0:D6}__{1}.png" -f $frame, $t.Id
    $outPath = Join-Path $OutDir $outName
    $bmp = TransformBitmap -Src $srcBmp -FlipH:$t.FlipH -HueDeg $t.HueDeg -SatMul $t.SatMul -LightAdd $t.LightAdd -ChannelSwap $t.ChannelSwap
    SavePng $bmp $outPath

    $previewBmp = ScaleNearest $bmp $PreviewScale
    $previewPath = Join-Path $previewDir $outName
    SavePng $previewBmp $previewPath
    $previewBmp.Dispose()

    $promotedFrame = $null
    if ($Promote -and $t.Id -ne "orig") {
      $promotedFrame = $promoteNext
      $livePath = Join-Path $ItemsDir ("frame_{0:D6}.png" -f $promoteNext)
      SavePng $bmp $livePath
      $promoteNext++
    }

    $manifest += [pscustomobject]@{
      sourceFrame = $frame
      transform = $t.Id
      label = $t.Label
      file = $outName
      promotedFrame = $promotedFrame
    }

    $rowCells.Add(("<td><img src='preview/{0}' alt='{1}' title='{1}'/><div class='cap'>{1}</div></td>" -f $outName, $t.Label)) | Out-Null
    $bmp.Dispose()
  }

  $srcBmp.Dispose()
  $htmlRows.Add("<tr>" + ($rowCells -join "") + "</tr>") | Out-Null
}

$manifestPath = Join-Path $OutDir "manifest.json"
($manifest | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$thLabels = ($Transforms | ForEach-Object { "<th>$($_.Label)</th>" }) -join ""
$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Glyph icon variants</title>
  <style>
    body { margin: 24px; font: 14px/1.4 Segoe UI, system-ui, sans-serif; background: #1a1d24; color: #e8eaed; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #9aa0a6; margin: 0 0 20px; }
    table { border-collapse: collapse; }
    th, td { padding: 8px 10px; text-align: center; vertical-align: middle; border-bottom: 1px solid #2d323c; }
    th { color: #9aa0a6; font-weight: 600; font-size: 12px; }
    th.src { color: #e8eaed; text-align: left; }
    img { image-rendering: pixelated; background: #0f1115; border-radius: 4px; }
    .cap { margin-top: 4px; font-size: 11px; color: #9aa0a6; }
    code { background: #2d323c; padding: 1px 5px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Glyph icon variants</h1>
  <p>Sources: $($sourceList -join ', '). Native size 36x32, preview x$PreviewScale. Files in <code>docs/glyph-variant-preview/</code> - not wired into the game until promoted.</p>
  <table>
    <thead><tr><th></th>$thLabels</tr></thead>
    <tbody>
      $($htmlRows -join "`n      ")
    </tbody>
  </table>
</body>
</html>
"@
$htmlPath = Join-Path $OutDir "index.html"
Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

Write-Host "Wrote $($manifest.Count) variants to $OutDir"
Write-Host "Open: $htmlPath"
if ($Promote) {
  Write-Host "Promoted frames $PromoteStart .. $($promoteNext - 1) into $ItemsDir"
  Write-Host "Remember: npm run build:item-atlas after wiring icons in items.json"
}

# Agent-facing catalog of unused glyph icon frames (regenerated when promoting).
$poolPath = Join-Path $PSScriptRoot "..\docs\GLYPH_ICON_POOL.md"
$promoted = @($manifest | Where-Object { $null -ne $_.promotedFrame })
if ($Promote -and $promoted.Count -gt 0) {
  $date = Get-Date -Format "yyyy-MM-dd"
  $rows = foreach ($p in $promoted) {
    $frame = "{0:D6}" -f [int]$p.promotedFrame
    $src = "{0:D6}" -f [int]$p.sourceFrame
    "| ``frame_$frame.png`` | $frame | $src | $($p.transform) | $($p.label) |"
  }
  $frameList = ($promoted | ForEach-Object { $_.promotedFrame }) -join ", "
  $first = $PromoteStart
  $last = $promoteNext - 1
  $poolMd = @"
# Glyph icon pool (unused frames)

> **For agents / glyph authors.** These frames are ready to assign to new glyphs.
> They are derived variants (flip / hue / channel swap / themed tints) of Body Glyph
> frames 3200-3227. Preview gallery: ``docs/glyph-variant-preview/index.html``.
>
> Regenerate / re-promote: ``npm run glyph:variants:promote``
> (see ``tools/generate-glyph-variants.ps1``).

Last updated: $date

## How to use on a new glyph

1. Pick an **unused** frame from the table below (prefer colored sources over near-white ones like 3200 / 3220 - hue shifts barely show on those).
2. Set the glyph item ``icon.src`` to:
   ``./public/item-icons/items/frame_00XXXX.png``
3. Run ``npm run build:item-atlas`` so the atlas picks it up.
4. Mark the frame as used in this file (move its row to **In use** or delete it) when you ship the glyph.

Original matching Body Glyph range **3200-3227 is exhausted** (all assigned to existing glyphs). Do not reuse those for new glyphs unless replacing an icon on purpose.

## Available (unused) frames $first-$last

| File | Frame | Source | Transform | Label |
|------|------:|-------:|-----------|-------|
$($rows -join "`n")

## Quick pick list

Frames: ``$frameList``

## Notes

- PNGs live in ``public/item-icons/items/``. The atlas only packs icons referenced from ``items.json``, so unused pool frames do not bloat the shipped atlas until assigned.
- Gallery / contact sheet (not required in-game): ``docs/glyph-variant-preview/``.
- Stronger looking picks tend to come from sources **3205, 3210, 3215, 3225, 3226, 3227** with ``hue*``, ``cold``, ``fire``, ``shadow``, or ``flip-hue*``.
"@
  Set-Content -LiteralPath $poolPath -Value $poolMd -Encoding UTF8
  Write-Host "Wrote icon pool catalog: $poolPath"
} elseif (-not $Promote) {
  Write-Host "Tip: npm run glyph:variants:promote writes frames 3230+ and docs/GLYPH_ICON_POOL.md"
}
