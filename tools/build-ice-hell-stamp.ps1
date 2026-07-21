param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell201.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "ice-hell-1-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Ice Hell 1F",
  [switch]$SkipIndex,
  [int]$CropX = 6,
  [int]$CropY = 27,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 24,
  [int]$FocusMapY = 45,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  # Ice Hell walkable back-tile frames (Tiles.Lib). Defaults to IceHellCavern (hell201) floor.
  [int[]]$FloorFillFrames = @(3700, 3701, 3702, 3703, 3704)
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
