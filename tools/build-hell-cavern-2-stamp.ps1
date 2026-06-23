param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell02.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "hell-cavern-2-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Hell Cavern 2F",
  [switch]$SkipIndex,
  [int]$CropX = 110,
  [int]$CropY = 82,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 128,
  [int]$FocusMapY = 100,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$stampScript = Join-Path $PSScriptRoot "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal HELL02 walkable back tiles (Tiles.Lib 3600-3604).
$hellFloorFrames = @(3600, 3601, 3602, 3603, 3604)

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
  -FloorFillFrames $hellFloorFrames
