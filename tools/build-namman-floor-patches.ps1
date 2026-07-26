param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/NAMMAN.map"
)

$ErrorActionPreference = "Stop"
$builder = Join-Path $PSScriptRoot "build-red-cavern-floor-patch.ps1"

$patches = @(
  @{
    RegionJson = "./tile-review/namman-grass-patch-a-region.json"
    OutputPng = "../public/maptiles/namman-grass-patch-a.png"
  },
  @{
    RegionJson = "./tile-review/namman-grass-patch-b-region.json"
    OutputPng = "../public/maptiles/namman-grass-patch-b.png"
  },
  @{
    RegionJson = "./tile-review/namman-grass-patch-c-region.json"
    OutputPng = "../public/maptiles/namman-grass-patch-c.png"
  }
)

foreach ($patch in $patches) {
  & $builder `
    -DataRoot $DataRoot `
    -MapPath $MapPath `
    -RegionJson $patch.RegionJson `
    -OutputPng $patch.OutputPng
}
