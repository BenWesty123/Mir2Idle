param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2006.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "bdd-wooma-north-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Wooma Palace North (BDD 5F)",
  [switch]$SkipIndex,
  [int]$CropX = 1,
  [int]$CropY = 11,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 19,
  [int]$FocusMapY = 29,
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
