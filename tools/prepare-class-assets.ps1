param(
    [string]$CrystalData = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
    [string]$OutRoot = "$PSScriptRoot\generated-data"
)

$ErrorActionPreference = "Stop"

function Reset-Dir([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Copy-Numeric-Libs([string]$SourceDir, [string]$DestDir) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    Get-ChildItem -File -LiteralPath $SourceDir -Filter "*.Lib" |
        Where-Object { $_.BaseName -match '^\d+$' } |
        ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $DestDir $_.Name) -Force
        }
}

function Copy-Suffixed-Libs([string]$SourceDir, [string]$DestDir, [string]$Suffix) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    Get-ChildItem -File -LiteralPath $SourceDir -Filter "* $Suffix.Lib" |
        ForEach-Object {
            if ($_.BaseName -match '^(\d+)\s+') {
                $name = "{0}.Lib" -f $Matches[1]
                Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $DestDir $name) -Force
            }
        }
}

$archer = Join-Path $OutRoot "archer"
Reset-Dir $archer
Copy-Numeric-Libs (Join-Path $CrystalData "AArmour") (Join-Path $archer "AArmour")
Copy-Numeric-Libs (Join-Path $CrystalData "AHair") (Join-Path $archer "AHair")
Copy-Suffixed-Libs (Join-Path $CrystalData "AWeapon") (Join-Path $archer "AWeaponL") "L"
Copy-Suffixed-Libs (Join-Path $CrystalData "AWeapon") (Join-Path $archer "AWeaponR") "R"

$assassin = Join-Path $OutRoot "assassin"
Reset-Dir $assassin
Copy-Numeric-Libs (Join-Path $CrystalData "ARArmour") (Join-Path $assassin "ARArmour")
Copy-Numeric-Libs (Join-Path $CrystalData "ARHair") (Join-Path $assassin "ARHair")
Copy-Numeric-Libs (Join-Path $CrystalData "ARWeapon") (Join-Path $assassin "ARWeapon")
Copy-Suffixed-Libs (Join-Path $CrystalData "ARWeapon") (Join-Path $assassin "ARWeaponS") "S"

Write-Host "Prepared class asset staging at $OutRoot"
