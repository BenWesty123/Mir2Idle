#!/usr/bin/env pwsh
# Append Crystal-accurate swarm walk/attack/stand directions for Hell Cavern trash mobs.
# Skips Hell Keeper (218) — stationary boss with moveMs 0.
$ErrorActionPreference = "Stop"

$indexes = @(215, 216, 217, 219, 220, 226, 227)
$scriptPath = Join-Path $PSScriptRoot "append-monster-swarm-directions.ps1"

& $scriptPath -Indexes $indexes

Write-Host "Done. Run: node tools/build-monster-walk-compare.mjs"
