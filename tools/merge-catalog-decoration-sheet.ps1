param(
  [string[]]$Images = @(
    "../public/mapobjects/stone-temple-assembly-65.png",
    "../public/mapobjects/stone-temple-assembly-122.png"
  ),
  [string]$Output = "../public/mapobjects/stone-temple-catalog.png"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$bitmaps = foreach ($relative in $Images) {
  $path = Join-Path $PSScriptRoot $relative
  if (-not (Test-Path $path)) { throw "Missing image: $path" }
  [System.Drawing.Bitmap]::FromFile($path)
}

$slotWidth = ($bitmaps | ForEach-Object { $_.Width } | Measure-Object -Maximum).Maximum
$slotHeight = ($bitmaps | ForEach-Object { $_.Height } | Measure-Object -Maximum).Maximum
$sheet = [System.Drawing.Bitmap]::new($slotWidth * $bitmaps.Count, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  for ($slot = 0; $slot -lt $bitmaps.Count; $slot++) {
    $bitmap = $bitmaps[$slot]
    $graphics.DrawImageUnscaled($bitmap, $slot * $slotWidth, $slotHeight - $bitmap.Height)
  }
  $outPath = Join-Path $PSScriptRoot $Output
  $sheet.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $sheet.Dispose()
  foreach ($bitmap in $bitmaps) { $bitmap.Dispose() }
}

Write-Output "Wrote $outPath (${slotWidth}x${slotHeight} per slot, $($bitmaps.Count) slots)"
