#!/usr/bin/env pwsh
# Repack all Hell Cavern trash/boss atlases with variable-width FX columns (sheetX).
$ErrorActionPreference = "Stop"

$configs = @(
  @{ Index = 217; Label = "Hell Cannibal" }
  @{ Index = 218; Label = "Hell Keeper" }
)

$repackScript = Join-Path $PSScriptRoot "repack-monster-fx-atlas.ps1"
$hellBoltScript = Join-Path $PSScriptRoot "build-hell-bolt-combat-atlas.ps1"
$witchDoctorScript = Join-Path $PSScriptRoot "build-witch-doctor-combat-atlas.ps1"
$hellSlasherScript = Join-Path $PSScriptRoot "build-hell-slasher-combat-atlas.ps1"

foreach ($config in $configs) {
  Write-Host "=== $($config.Label) ($($config.Index)) ==="
  $params = @{
    Index = $config.Index
  }
  if ($config.EmptySrcFrames) {
    $params.EmptySrcFrames = $config.EmptySrcFrames
  }
  & $repackScript @params
}

Write-Host "=== Hell Slasher (215) ==="
& $hellSlasherScript

Write-Host "=== Hell Bolt (219) ==="
& $hellBoltScript

Write-Host "=== Witch Doctor (220) ==="
& $witchDoctorScript

Write-Host "Done. Run: node tools/build-hell-cavern-fx-review.mjs"
