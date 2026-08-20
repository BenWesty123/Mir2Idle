param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/64.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "blood-gorge-gd-3-center",
  [string]$StampLabel = "Blood Gorge GD Floor 3",
  [int]$FocusMapX = 249,
  [int]$FocusMapY = 76,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapSize = 300
)

$ErrorActionPreference = "Stop"

$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)
if (($cropX + $CropWCells) -gt $MapSize) { $cropX = [Math]::Max(0, $MapSize - $CropWCells) }
if (($cropY + $CropHCells) -gt $MapSize) { $cropY = [Math]::Max(0, $MapSize - $CropHCells) }

& (Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1") `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -StampId $StampId `
  -StampLabel $StampLabel `
  -CropX $cropX `
  -CropY $cropY `
  -CropWCells $CropWCells `
  -CropHCells $CropHCells `
  -FocusMapX $FocusMapX `
  -FocusMapY $FocusMapY
