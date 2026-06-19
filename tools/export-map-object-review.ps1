param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$ObjectLib = "Map/WemadeMir2/Objects.Lib",
  [string]$OutputRoot = "../tile-review/wemade-mir2-objects-000000-001999",
  [int]$StartFrame = 0,
  [int]$FrameCount = 2000,
  [int]$MaxVisible = 600,
  [int]$MaxWidth = 192,
  [int]$MaxHeight = 128
)

& (Join-Path $PSScriptRoot "export-map-tile-review.ps1") `
  -DataRoot $DataRoot `
  -MapLib $ObjectLib `
  -OutputRoot $OutputRoot `
  -StartFrame $StartFrame `
  -FrameCount $FrameCount `
  -MaxVisible $MaxVisible `
  -MaxWidth $MaxWidth `
  -MaxHeight $MaxHeight
