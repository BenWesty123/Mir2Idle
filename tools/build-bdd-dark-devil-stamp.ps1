param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2013.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "bdd-dark-devil-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Dark Devil Palace (BDD 13F)",
  [switch]$SkipIndex,
  [int]$CropX = 9,
  [int]$CropY = 16,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 27,
  [int]$FocusMapY = 34,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }

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
