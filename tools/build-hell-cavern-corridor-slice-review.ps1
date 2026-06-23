param(
  [ValidateSet("1", "2")]
  [string]$Floor = "1"
)

$mapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map"
if ($Floor -eq "1") {
  & (Join-Path $PSScriptRoot "build-bdd-corridor-slice-review.ps1") `
    -MapPath (Join-Path $mapRoot "hell01.map") `
    -OutputRoot "../tile-review/hell-cavern-1-corridor-slices" `
    -MaxSamples 24
}
else {
  & (Join-Path $PSScriptRoot "build-bdd-corridor-slice-review.ps1") `
    -MapPath (Join-Path $mapRoot "hell02.map") `
    -OutputRoot "../tile-review/hell-cavern-2-corridor-slices" `
    -MaxSamples 24
}
