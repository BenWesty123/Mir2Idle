param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell202.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "ice-hell-gd-2-center",
  [string]$StampLabel = "Ice Hell GD Floor 2",
  [int]$FocusMapX = 443,
  [int]$FocusMapY = 61,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  # IceHellTemple(S) (hell202) walkable back-tile frames.
  [int[]]$FloorFillFrames = @(3750, 3751, 3752, 3753, 3754)
)

$ErrorActionPreference = "Stop"

$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)

& (Join-Path $PSScriptRoot "build-ice-hell-stamp.ps1") `
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
  -FocusMapY $FocusMapY `
  -FloorFillFrames $FloorFillFrames
