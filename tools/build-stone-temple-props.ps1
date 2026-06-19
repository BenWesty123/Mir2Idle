param(
  [string]$ReviewRoot = "../tile-review/stone-temple-objects7-004045-004165",
  [string]$OutputRoot = "../public/mapobjects",
  [string]$SheetName = "stone-temple-props.png",
  [string]$SetId = "stone-temple-props",
  [string]$Label = "Stone Temple Props",
  [int[]]$Frames = @(4053, 4060, 4059, 4068, 4073)
)

& (Join-Path $PSScriptRoot "build-custom-map-object-palette.ps1") `
  -ReviewRoot $ReviewRoot `
  -OutputRoot $OutputRoot `
  -SheetName $SheetName `
  -SetId $SetId `
  -Label $Label `
  -Frames $Frames
