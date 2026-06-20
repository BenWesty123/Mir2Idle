param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data"
)

$ErrorActionPreference = "Stop"
$tools = $PSScriptRoot

Write-Host "=== Export base Zuma Archer (monster 64) ==="
& (Join-Path $tools "export-monster-atlases.ps1") -DataRoot $DataRoot -Indexes 64 -Direction 6

Write-Host "=== Append swarm directional walk/attack clips ==="
& (Join-Path $tools "append-monster-swarm-directions.ps1") -DataRoot $DataRoot -Indexes 64

Write-Host "=== Append canvas-rotated travel arrow projectile ==="
& (Join-Path $tools "append-zuma-archer-range.ps1") -DataRoot $DataRoot -Index 64 -BaseAngleDeg 107 -Force

Write-Host "Done - monster 64 atlas rebuilt from Crystal lib."
