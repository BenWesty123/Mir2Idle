$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib\phase-monster-lib.ps1")
$data = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data"
foreach ($idx in 128, 129) {
  $lib = [PhaseMonsterLib]::new((Join-Path $data ("Monster\{0:D3}.Lib" -f $idx)))
  Write-Host "=== Monster $idx ==="
  foreach ($f in @(80, 86, 224, 232, 233, 242, 352, 361, 362, 376)) {
    $img = $lib.ReadImage($f)
    if ($null -ne $img) {
      Write-Host ("  frame {0}: {1}x{2} ox={3} oy={4}" -f $f, $img.Bitmap.Width, $img.Bitmap.Height, $img.OffsetX, $img.OffsetY)
      $img.Dispose()
    } else {
      Write-Host ("  frame {0}: MISSING" -f $f)
    }
  }
  $lib.Dispose()
}

$magicPath = Join-Path $data "Magic.Lib"
if (-not (Test-Path $magicPath)) { $magicPath = Join-Path $data "Data\Magic.Lib" }
Write-Host "Magic lib: $magicPath exists=$(Test-Path $magicPath)"
Get-ChildItem (Join-Path $data "*") -Filter "Magic*.Lib" | Select-Object -First 10 Name, FullName
