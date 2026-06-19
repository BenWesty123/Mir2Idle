param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$ItemLib = "Items.Lib",
  [string]$OutputRoot = "../tile-review/items-icons-000000-001999",
  [int]$StartFrame = 0,
  [int]$FrameCount = 2000,
  [int]$MaxVisible = 1000
)

& (Join-Path $PSScriptRoot "export-map-tile-review.ps1") `
  -DataRoot $DataRoot `
  -MapLib $ItemLib `
  -OutputRoot $OutputRoot `
  -StartFrame $StartFrame `
  -FrameCount $FrameCount `
  -MaxVisible $MaxVisible `
  -MaxWidth 96 `
  -MaxHeight 96
