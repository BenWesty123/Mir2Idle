param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2083.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "evil-mir-palace-gd-8-center",
  [string]$StampLabel = "Evil Mir Palace GD Floor 8",
  [int]$FocusMapX = 57,
  [int]$FocusMapY = 74,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  [int]$MapWidth = 200,
  [int]$MapHeight = 200
)

$ErrorActionPreference = "Stop"

$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)
if (($cropX + $CropWCells) -gt $MapWidth) { $cropX = [Math]::Max(0, $MapWidth - $CropWCells) }
if (($cropY + $CropHCells) -gt $MapHeight) { $cropY = [Math]::Max(0, $MapHeight - $CropHCells) }

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
