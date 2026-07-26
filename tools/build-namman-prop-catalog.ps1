param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("NAMMAN.map"),
  [string]$OutputRoot = "../tile-review/namman-prop-catalog",
  [int]$MaxGroupCells = 24,
  [int]$MaxGroups = 800,
  [int]$CellWidth = 48,
  [int]$CellHeight = 32
)

& (Join-Path $PSScriptRoot "build-bdd-prop-catalog.ps1") `
  -DataRoot $DataRoot `
  -MapRoot $MapRoot `
  -MapNames $MapNames `
  -OutputRoot $OutputRoot `
  -MaxGroupCells $MaxGroupCells `
  -MaxGroups $MaxGroups `
  -CellWidth $CellWidth `
  -CellHeight $CellHeight
