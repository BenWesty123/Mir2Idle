param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/NAMMAND_2.map",
  [string]$OutputRoot = "../public/mapstamps",
  [string]$StampId = "namman-boss-center",
  [string]$SheetFile = "",
  [string]$StampLabel = "Beast King's Lair - Ancient City Ruins (NAMMAND_2)",
  [switch]$SkipIndex,
  # Party stand from namman-beast-kr-spot-picker (162, 129).
  [int]$CropX = 144,
  [int]$CropY = 111,
  [int]$CropWCells = 36,
  [int]$CropHCells = 36,
  [int]$FocusMapX = 162,
  [int]$FocusMapY = 129,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32,
  # Dominant NAMMAND_2 back tiles (4150-4154 + grass 4000-4004).
  [int[]]$FloorFillFrames = @(4150, 4151, 4152, 4153, 4154)
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
