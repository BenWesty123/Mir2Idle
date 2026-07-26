Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$outDir = Join-Path $PSScriptRoot "..\tile-review\fire-hell-knight-compare"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$ids = @(243, 244, 245, 246)
$names = @{
  243 = "Hell Knight"
  244 = "Hell Knight Captain"
  245 = "Hell Knight Guard"
  246 = "Hell Knight Elite"
}

$thumbs = New-Object System.Collections.Generic.List[object]

foreach ($id in $ids) {
  $jsonPath = Join-Path $PSScriptRoot "..\public\monsters\monster\$id.json"
  $pngPath = Join-Path $PSScriptRoot "..\public\monsters\monster\$id.png"
  $json = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
  $src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))

  $standing = $json.actions.standing.frames
  if (-not $standing -or $standing.Count -eq 0) { throw "No standing frames for $id" }
  $frame = $standing[0]
  $sw = [int]$json.slotWidth
  $sh = [int]$json.slotHeight

  if ($null -ne $frame.sheetX) {
    $sx = [int]$frame.sheetX
    $sy = [int]$frame.sheetY
    $w = [int]$frame.w
    $h = [int]$frame.h
  } else {
    $slot = [int]$frame.slot
    $sx = $slot * $sw
    $sy = 0
    $w = $sw
    $h = $sh
  }

  $crop = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), $sx, $sy, $w, $h, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $c = $crop.GetPixel($x, $y)
      if ($c.A -gt 16) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) { $minX = 0; $minY = 0; $maxX = $w - 1; $maxY = $h - 1 }
  $tw = $maxX - $minX + 1
  $th = $maxY - $minY + 1
  $trim = New-Object System.Drawing.Bitmap $tw, $th
  $g2 = [System.Drawing.Graphics]::FromImage($trim)
  $g2.DrawImage($crop, (New-Object System.Drawing.Rectangle 0, 0, $tw, $th), $minX, $minY, $tw, $th, [System.Drawing.GraphicsUnit]::Pixel)
  $g2.Dispose()
  $crop.Dispose()
  $src.Dispose()

  $outFile = Join-Path $outDir "knight-$id.png"
  $trim.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $thumbs.Add([pscustomobject]@{ id = $id; name = $names[$id]; path = $outFile; w = $tw; h = $th; bmp = $trim })
  Write-Host "OK $id $($names[$id]) ${tw}x${th}"
}

$pad = 24
$labelH = 36
$maxH = ($thumbs | Measure-Object -Property h -Maximum).Maximum
$totalW = (($thumbs | ForEach-Object { $_.w } | Measure-Object -Sum).Sum) + $pad * ($thumbs.Count + 1)
$totalH = $maxH + $pad * 2 + $labelH
$sheet = New-Object System.Drawing.Bitmap $totalW, $totalH
$gs = [System.Drawing.Graphics]::FromImage($sheet)
$gs.Clear([System.Drawing.Color]::FromArgb(255, 18, 16, 14))
$gs.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$font = New-Object System.Drawing.Font "Segoe UI", 12
$brush = [System.Drawing.Brushes]::WhiteSmoke
$x = $pad
foreach ($t in $thumbs) {
  $y = $pad + $labelH + [int](($maxH - $t.h) / 2)
  $gs.DrawImage($t.bmp, $x, $y)
  $gs.DrawString("$($t.id) $($t.name)", $font, $brush, $x, $pad)
  $x += $t.w + $pad
  $t.bmp.Dispose()
}
$sheetPath = Join-Path $outDir "hell-knights-compare.png"
$sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gs.Dispose()
$sheet.Dispose()
Write-Host "Wrote $sheetPath"
Start-Process $sheetPath
