param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell02.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "hell-gd-2-center",
  [string]$StampLabel = "Hell Cavern GD Floor 2",
  [int]$FocusMapX = 251,
  [int]$FocusMapY = 253,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 18
)

$ErrorActionPreference = "Stop"

$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)

& (Join-Path $toolsDir "build-hell-cavern-2-stamp.ps1") `
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
