param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("snakepre.map", "snakepre2.map"),
  [string]$OutputRoot = "../tile-review/viper-cave-prop-catalog",
  [int]$MaxGroupCells = 16,
  [int]$MaxGroups = 500,
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
