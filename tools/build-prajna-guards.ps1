$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
& (Join-Path $scriptDir "build-prajna-guard-combat-atlas.ps1") -GuardSide right
& (Join-Path $scriptDir "build-prajna-guard-combat-atlas.ps1") -GuardSide left
