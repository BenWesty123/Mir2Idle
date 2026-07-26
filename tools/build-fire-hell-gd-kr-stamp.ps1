param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/HKR.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "fire-hell-kr-center",
  [string]$StampLabel = "Fire Hell KR (Hell Lord)",
  [int]$FocusMapX = 26,
  [int]$FocusMapY = 23,
  # Extra northern cells so throne-row walls/ceilings are not cropped mid-tile
  # when the party fights on the Hell Lord seat (map row ~17).
  [int]$CropWCells = 36,
  [int]$CropHCells = 46,
  [int]$HalfCropW = 18,
  [int]$HalfCropH = 23
)

$ErrorActionPreference = "Stop"

$cropX = [Math]::Max(0, $FocusMapX - $HalfCropW)
$cropY = [Math]::Max(0, $FocusMapY - $HalfCropH)

# StampOffsetY keeps northern tall middle walls (Crystal DrawUp) on-stage when the
# fight sits on row 17 (large focusY after northern crop expansion).
& (Join-Path $PSScriptRoot "build-fire-hell-stamp.ps1") `
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
  -StampOffsetY 256
