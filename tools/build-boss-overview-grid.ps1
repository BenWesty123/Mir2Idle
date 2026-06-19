param(
  [string]$GalleryRoot = "$PSScriptRoot\..\tile-review\dungeon-boss-gallery"
)

Add-Type -AssemblyName System.Drawing
$GalleryRoot = [System.IO.Path]::GetFullPath($GalleryRoot)
$meta = Get-Content (Join-Path $GalleryRoot "gallery.json") -Raw | ConvertFrom-Json
$cards = @($meta.cards | Where-Object { $_.file })

$cols = 6
$cellW = 240
$cellH = 260
$rows = [Math]::Ceiling($cards.Count / $cols)
$width = $cols * $cellW
$height = 50 + $rows * $cellH

$bmp = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
  $g.Clear([System.Drawing.Color]::FromArgb(255, 18, 17, 15))
  $titleFont = New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Bold)
  $labelFont = New-Object System.Drawing.Font "Segoe UI", 9
  $smallFont = New-Object System.Drawing.Font "Segoe UI", 8
  $gold = [System.Drawing.Color]::FromArgb(255, 201, 162, 77)
  $text = [System.Drawing.Color]::FromArgb(255, 232, 220, 200)
  $muted = [System.Drawing.Color]::FromArgb(255, 154, 143, 126)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.DrawString("Crystal Dungeon Bosses (low -> high difficulty)", $titleFont, (New-Object System.Drawing.SolidBrush $gold), 12, 12)

  for ($i = 0; $i -lt $cards.Count; $i++) {
    $card = $cards[$i]
    $col = $i % $cols
    $row = [Math]::Floor($i / $cols)
    $x = $col * $cellW + 8
    $y = 50 + $row * $cellH + 8

    $panel = New-Object System.Drawing.Bitmap ($cellW - 16), ($cellH - 16)
    $pg = [System.Drawing.Graphics]::FromImage($panel)
    try {
      $pg.Clear([System.Drawing.Color]::FromArgb(255, 30, 28, 24))
      $imgPath = Join-Path $GalleryRoot ($card.file -replace '/', '\')
      if (Test-Path $imgPath) {
        $img = [System.Drawing.Image]::FromFile($imgPath)
        try {
          $pg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $targetH = 150
          $scale = $targetH / [Math]::Max(1, $img.Height)
          $drawW = [Math]::Max(1, [int]($img.Width * $scale))
          $drawH = [Math]::Max(1, [int]($img.Height * $scale))
          $ix = [int](($panel.Width - $drawW) / 2)
          $iy = 10
          $pg.DrawImage($img, $ix, $iy, $drawW, $drawH)
        } finally { $img.Dispose() }
      }
      $pg.DrawString($card.dungeon, $smallFont, (New-Object System.Drawing.SolidBrush $muted), 6, 168)
      $pg.DrawString($card.boss, $labelFont, (New-Object System.Drawing.SolidBrush $text), 6, 184)
      $pg.DrawString("Lv $($card.level)", $smallFont, (New-Object System.Drawing.SolidBrush $gold), 6, 204)
    } finally {
      $pg.Dispose()
    }
    $g.DrawImage($panel, $x, $y)
    $panel.Dispose()
  }

  $out = Join-Path $GalleryRoot "boss-overview-grid.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $out
}
finally {
  $g.Dispose()
  $bmp.Dispose()
}
