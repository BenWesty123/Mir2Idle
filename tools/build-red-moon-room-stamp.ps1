param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D10062.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "red-moon-room-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Red Moon Room - Red Moon Evil",
  [switch]$SkipIndex,
  # Crystal RedMoonEvil fixed spawn is (23, 18) on D10062 (40x40 RedMoonRoom).
  # Crop the full room so the stamp matches the KR pocket.
  [int]$CropX = 0,
  [int]$CropY = 0,
  [int]$CropWCells = 40,
  [int]$CropHCells = 40,
  [int]$FocusMapX = 23,
  [int]$FocusMapY = 18,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

& $stampScript `
  -DataRoot $DataRoot `
  -MapPath $MapPath `
  -OutputRoot $OutputRoot `
  -StampId $StampId `
  -SheetFile $SheetFile `
  -StampLabel $StampLabel `
  -SkipIndex:$SkipIndex `
  -CropX $CropX `
  -CropY $CropY `
  -CropWCells $CropWCells `
  -CropHCells $CropHCells `
  -FocusMapX $FocusMapX `
  -FocusMapY $FocusMapY `
  -CellWidth $CellWidth `
  -CellHeight $CellHeight
