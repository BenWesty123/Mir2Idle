param(
  [ValidateSet("1", "2")]
  [string]$Floor = "1"
)

if ($Floor -eq "1") {
  & (Join-Path $PSScriptRoot "build-hell-cavern-gd1-corridor.ps1")
}
else {
  & (Join-Path $PSScriptRoot "build-crystal-wall-column-strip.ps1") `
    -MapPath "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/hell02.map" `
    -OutputPng "../public/mapedges/hell-cavern-2-wall-columns.png" `
    -ReviewRoot "../tile-review/hell-cavern-2-wall-columns" `
    -ReviewTitle "Hell Cavern 2 wall columns" `
    -StartX 112 `
    -LaneMapY 100
}
