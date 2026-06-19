param(
  [string]$MapRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  [string[]]$MapNames = @("D021.map", "D022.map", "D023.map", "D024.map"),
  [int]$Top = 40
)

$ErrorActionPreference = "Stop"

function Add-Count($table, [string]$key) {
  if (-not $table.ContainsKey($key)) { $table[$key] = 0 }
  $table[$key]++
}

function Format-TopFrames($table, [int]$top) {
  @($table.GetEnumerator() |
    Sort-Object -Property Value -Descending |
    Select-Object -First $top |
    ForEach-Object { [pscustomobject]@{ Frame = $_.Key; Count = $_.Value } })
}

function Read-Type1MapFrameUsage([string]$path) {
  if (-not (Test-Path $path)) { throw "Map file not found: $path" }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if (-not ($bytes.Length -ge 54 -and $bytes[0] -eq 0x10 -and $bytes[2] -eq 0x61 -and $bytes[7] -eq 0x31 -and $bytes[14] -eq 0x31)) {
    throw "Only Type1 maps are supported: $path"
  }

  $xor = [BitConverter]::ToInt16($bytes, 23)
  $width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
  $height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
  $backCounts = @{}
  $middleCounts = @{}
  $frontCounts = @{}
  $blocked = 0

  $offset = 54
  for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
      $back = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
      $middle = [BitConverter]::ToInt16($bytes, $offset + 4) -bxor $xor
      $front = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
      $slot = [int]$bytes[$offset + 12] + 2
      if ($slot -eq 102) { $slot = 90 }
      if ($slot -ge 255) { $slot = -1 }

      $backFrame = ($back -band 0x1FFFFFFF) - 1
      $middleFrame = $middle - 1
      $frontFrame = ($front -band 0x7FFF) - 1
      if ($backFrame -ge 0) { Add-Count $backCounts "0:$backFrame" }
      if ($middleFrame -ge 0) { Add-Count $middleCounts "1:$middleFrame" }
      if ($frontFrame -ge 0 -and $slot -ge 0 -and $slot -ne 200) { Add-Count $frontCounts "$slot`:$frontFrame" }
      if ((($back -band 0x20000000) -ne 0) -or (($front -band 0x8000) -ne 0)) { $blocked++ }
      $offset += 15
    }
  }

  [pscustomobject]@{
    Width = $width
    Height = $height
    Cells = $width * $height
    Blocked = $blocked
    Back = $backCounts
    Middle = $middleCounts
    Front = $frontCounts
  }
}

$totalBack = @{}
$totalMiddle = @{}
$totalFront = @{}
$summaries = foreach ($name in $MapNames) {
  $usage = Read-Type1MapFrameUsage (Join-Path $MapRoot $name)
  foreach ($entry in $usage.Back.GetEnumerator()) {
    if (-not $totalBack.ContainsKey($entry.Key)) { $totalBack[$entry.Key] = 0 }
    $totalBack[$entry.Key] += $entry.Value
  }
  foreach ($entry in $usage.Middle.GetEnumerator()) {
    if (-not $totalMiddle.ContainsKey($entry.Key)) { $totalMiddle[$entry.Key] = 0 }
    $totalMiddle[$entry.Key] += $entry.Value
  }
  foreach ($entry in $usage.Front.GetEnumerator()) {
    if (-not $totalFront.ContainsKey($entry.Key)) { $totalFront[$entry.Key] = 0 }
    $totalFront[$entry.Key] += $entry.Value
  }

  [pscustomobject]@{
    Map = $name
    Size = "$($usage.Width)x$($usage.Height)"
    Cells = $usage.Cells
    Blocked = $usage.Blocked
    TopBack = (Format-TopFrames $usage.Back 8)
    TopMiddle = (Format-TopFrames $usage.Middle 8)
    TopFront = (Format-TopFrames $usage.Front 16)
  }
}

[ordered]@{
  maps = $summaries
  totals = [ordered]@{
    back = Format-TopFrames $totalBack $Top
    middle = Format-TopFrames $totalMiddle $Top
    front = Format-TopFrames $totalFront $Top
  }
} | ConvertTo-Json -Depth 8
