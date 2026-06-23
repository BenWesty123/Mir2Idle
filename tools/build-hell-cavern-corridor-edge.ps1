param(
  [ValidateSet("1", "2")]
  [string]$Floor = "1"
)

$mapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map"
$common = @{
  CropWCells = 28
  CellsNorthOfLane = 9
  CellsSouthScan = 10
  AutoCrop = $true
}

if ($Floor -eq "1") {
  & (Join-Path $PSScriptRoot "build-bdd-corridor-edge.ps1") @common `
    -MapPath (Join-Path $mapRoot "hell01.map") `
    -OutputPng "../public/mapedges/hell-cavern-1-edge.png" `
    -ReviewRoot "../tile-review/hell-cavern-1-corridor-edge" `
    -ReviewImageName "hell-cavern-1-edge.png" `
    -ReviewTitle "Hell Cavern 1 back wall strip" `
    -ReviewBlurb "HELL01 farm corridor near spawn (24, 45). Walls detected automatically: front-layer sprites that are not 48x32 floor slices." `
    -CropX 12 `
    -LaneMapY 45
}
else {
  & (Join-Path $PSScriptRoot "build-bdd-corridor-edge.ps1") @common `
    -MapPath (Join-Path $mapRoot "hell02.map") `
    -OutputPng "../public/mapedges/hell-cavern-2-edge.png" `
    -ReviewRoot "../tile-review/hell-cavern-2-corridor-edge" `
    -ReviewImageName "hell-cavern-2-edge.png" `
    -ReviewTitle "Hell Cavern 2 back wall strip" `
    -ReviewBlurb "HELL02 deeper farm corridor near (128, 100). Walls detected automatically: front-layer sprites that are not 48x32 floor slices." `
    -CropX 112 `
    -LaneMapY 100
}
