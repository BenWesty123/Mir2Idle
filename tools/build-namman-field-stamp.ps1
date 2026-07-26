param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/NAMMAN.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "namman-field-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Southern Barbarian Land - NAMMAN field",
  [switch]$SkipIndex,
  # Scenic NE pocket: grass + trees (684, 144).
  [int]$CropX = 666,
  [int]$CropY = 126,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 684,
  [int]$FocusMapY = 144,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  # Dominant NAMMAN back tiles (Tiles.Lib frames 4000-4004).
  [int[]]$FloorFillFrames = @(4000, 4001, 4002, 4003, 4004)
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
  -CellHeight $CellHeight `
  -FloorFillFrames $FloorFillFrames
