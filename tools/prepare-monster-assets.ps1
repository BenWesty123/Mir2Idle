param(
    [string]$CrystalData = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
    [string]$OutRoot = "$PSScriptRoot\generated-data\monsters",
    [int]$Count = 24
)

$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath $OutRoot) {
    Remove-Item -LiteralPath $OutRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $OutRoot "Monster") | Out-Null

Get-ChildItem -File -LiteralPath (Join-Path $CrystalData "Monster") -Filter "*.Lib" |
    Sort-Object Name |
    Select-Object -First $Count |
    ForEach-Object {
        if ($_.BaseName -match '^0*(\d+)$') {
            $name = "{0}.Lib" -f ([int]$Matches[1])
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $OutRoot "Monster\$name") -Force
        }
    }

Write-Host "Prepared $Count monster libs at $OutRoot"
