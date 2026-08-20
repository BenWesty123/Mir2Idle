param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/6.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "past-bicheon-gd-1-center",
  [string]$StampLabel = "Past Bicheon GD Floor 1",
  [int]$FocusMapX = 117,
  [int]$FocusMapY = 202,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)
if (($cropX + $CropWCells) -gt 500) { $cropX = [Math]::Max(0, 500 - $CropWCells) }
if (($cropY + $CropHCells) -gt 500) { $cropY = [Math]::Max(0, 500 - $CropHCells) }

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
