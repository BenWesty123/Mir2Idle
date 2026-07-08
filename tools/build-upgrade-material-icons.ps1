param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$publicRoot = Join-Path $ProjectRoot "public\item-icons\items"
New-Item -ItemType Directory -Force -Path $publicRoot | Out-Null

function Save-GreyscaleHeart {
  param(
    [string]$SourcePath,
    [string]$DestPath
  )

  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourcePath))
  try {
    $dest = New-Object System.Drawing.Bitmap $source.Width, $source.Height, $source.PixelFormat
    for ($y = 0; $y -lt $source.Height; $y++) {
      for ($x = 0; $x -lt $source.Width; $x++) {
        $pixel = $source.GetPixel($x, $y)
        if ($pixel.A -lt 8) {
          $dest.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
          continue
        }
        $gray = [int][Math]::Round(0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B)
        $gray = [Math]::Min(255, [Math]::Max(0, $gray + 18))
        $dest.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, $gray, $gray, $gray))
      }
    }
    $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $source.Dispose()
    if ($dest) { $dest.Dispose() }
  }
}

$heartSource = Join-Path $ProjectRoot "tile-review\items-icons-000000-001999\images\frame_000448.png"
$boarSource = Join-Path $ProjectRoot "tile-review\items-icons-002770-002770\images\frame_002770.png"
$stoneHeartDest = Join-Path $publicRoot "stone-heart.png"
$hogToothDest = Join-Path $publicRoot "hog-tooth.png"

if (-not (Test-Path -LiteralPath $heartSource)) {
  throw "Missing heart source: $heartSource"
}
if (-not (Test-Path -LiteralPath $boarSource)) {
  throw "Missing BoarTooth source: $boarSource"
}

Save-GreyscaleHeart -SourcePath $heartSource -DestPath $stoneHeartDest
Copy-Item -LiteralPath $boarSource -Destination $hogToothDest -Force

Write-Output "Wrote $stoneHeartDest"
Write-Output "Wrote $hogToothDest"
