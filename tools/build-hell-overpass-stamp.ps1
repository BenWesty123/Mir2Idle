param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell03.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "hell-overpass-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Hell Overpass",
  [switch]$SkipIndex,
  [int]$CropX = 188,
  [int]$CropY = 77,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 206,
  [int]$FocusMapY = 95,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

$toolsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$stampScript = Join-Path $toolsDir "build-bdd-1f-stamp.ps1"
if (-not (Test-Path $stampScript)) { throw "Missing $stampScript" }
if (-not (Test-Path $MapPath)) { throw "Missing Crystal map: $MapPath" }

# Crystal HELL03 walkable back tiles (Tiles.Lib 3501-3505).
$hellFloorFrames = @(3501, 3502, 3503, 3504, 3505)

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
