param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell206.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "ice-hell-kr-center",
  [string]$StampLabel = "Ice Hell KR (South)",
  [int]$FocusMapX = 92,
  [int]$FocusMapY = 98,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18,
  # IceHellTemple_KR (hell206) walkable back-tile frames.
  [int[]]$FloorFillFrames = @(3750, 3751, 3752, 3753, 3754, 3755)
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
