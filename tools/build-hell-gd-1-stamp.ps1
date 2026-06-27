param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell01.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "hell-gd-1-center",
  [string]$StampLabel = "Hell Cavern GD Floor 1",
  [int]$FocusMapX = 143,
  [int]$FocusMapY = 49,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)

& (Join-Path $PSScriptRoot "build-hell-cavern-1-stamp.ps1") `
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
