param(
  [string]$Root = "../public/spellfx",
  [int]$Threshold = 30
)

Add-Type -AssemblyName System.Drawing

$spellRoot = Resolve-Path (Join-Path $PSScriptRoot $Root)
$files = Get-ChildItem -Path $spellRoot -Recurse -Filter *.png

foreach ($file in $files) {
  $source = [System.Drawing.Bitmap]::FromFile($file.FullName)
  $bitmap = New-Object System.Drawing.Bitmap $source.Width, $source.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.DrawImageUnscaled($source, 0, 0)
  $graphics.Dispose()
  $source.Dispose()

  $changed = 0
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -eq 255 -and ($pixel.R + $pixel.G + $pixel.B) -le $Threshold) {
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
        $changed++
      }
    }
  }

  if ($changed -gt 0) {
    $temp = "$($file.FullName).tmp.png"
    $bitmap.Save($temp, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Move-Item -LiteralPath $temp -Destination $file.FullName -Force
    Write-Output "$($file.FullName): cleared $changed pixels"
  } else {
    $bitmap.Dispose()
  }
}
