param(
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("D2071.map", "D2072.map"),
  [int]$SampleX = 40,
  [int]$SampleY = 40,
  [int]$AnchorCols = 8,
  [int]$AnchorRows = 6
)

$ErrorActionPreference = "Stop"

function Read-Type1Map($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $xor = [BitConverter]::ToInt16($bytes, 23)
  $width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
  $back = [long[]]::new($width * $height)
  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $i = ($x * $height) + $y
      $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $offset += 15
    }
  }
  return [pscustomobject]@{ Width = $width; Height = $height; Back = $back }
}

function Get-Cell($map, $x, $y) { return ($x * $map.Height) + $y }

function Frame-ToSlot([int]$frame) {
  if ($frame -ge 1950 -and $frame -le 1954) { $frame = 3100 + ($frame - 1950) }
  if ($frame -ge 3100 -and $frame -le 3104) { return $frame - 3100 }
  return 0
}

function Get-AnchorSlot($map, $x, $y) {
  $ax = $x - ($x % 2)
  $ay = $y - ($y % 2)
  $frame = (($map.Back[(Get-Cell $map $ax $ay)] -band 0x1FFFFFFF) - 1)
  return Frame-ToSlot $frame
}

$map = Read-Type1Map (Join-Path $MapRoot $MapNames[0])
$anchor = @()
for ($gy = 0; $gy -lt $AnchorRows; $gy++) {
  $row = @()
  $y = $SampleY + ($gy * 2)
  for ($gx = 0; $gx -lt $AnchorCols; $gx++) {
    $x = $SampleX + ($gx * 2)
    $row += (Get-AnchorSlot $map $x $y)
  }
  $anchor += ,@($row)
}

# Crystal back tiles cover 2x2 cells — duplicate each slot for idle's per-cell grid.
$expanded = @()
foreach ($anchorRow in $anchor) {
  $doubled = @()
  foreach ($slot in $anchorRow) {
    $doubled += $slot
    $doubled += $slot
  }
  $expanded += ,@($doubled)
  $expanded += ,@($doubled)
}

$outPath = Join-Path $PSScriptRoot "..\tile-review\prajna-temple-tile-pattern.json"
[ordered]@{
  sourceMaps = $MapNames
  sampleOrigin = @{ x = $SampleX; y = $SampleY }
  anchorPattern = $anchor
  expandedPattern = $expanded
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $outPath -Encoding UTF8

Write-Host "Anchor pattern ($AnchorCols x $AnchorRows) from $($MapNames[0]):"
$anchor | ForEach-Object { Write-Host ("  [" + ($_ -join ", ") + "]") }
Write-Host ""
Write-Host "Expanded pattern for phase1Data.js:"
Write-Host "const PRAJNA_TEMPLE_TILE_PATTERN = ["
foreach ($row in $expanded) {
  Write-Host ("  [" + ($row -join ", ") + "],")
}
Write-Host "];"
