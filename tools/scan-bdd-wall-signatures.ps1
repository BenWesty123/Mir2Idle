param(
  [string]$MapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/D2001.map",
  [int]$WindowCells = 20,
  [int]$MaxSamples = 40
)

$bytes = [System.IO.File]::ReadAllBytes($MapPath)
$xor = [BitConverter]::ToInt16($bytes, 23)
$width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
$height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
$count = $width * $height
$back = [long[]]::new($count)
$front = [int[]]::new($count)
$frontIndex = [int[]]::new($count)
$offset = 54
for ($x = 0; $x -lt $width; $x++) {
  for ($y = 0; $y -lt $height; $y++) {
    $i = ($x * $height) + $y
    $back[$i] = [BitConverter]::ToInt32($bytes, $offset) -bxor 0xAA38AA38
    $front[$i] = [BitConverter]::ToInt16($bytes, $offset + 6) -bxor $xor
    $slot = [int]$bytes[$offset + 12] + 2
    if ($slot -eq 102) { $slot = 90 }
    if ($slot -ge 255) { $slot = -1 }
    $frontIndex[$i] = $slot
    $offset += 15
  }
}

function Get-Cell([int]$x, [int]$y) { return ($x * $height) + $y }

function Test-Blocked([int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $width -or $y -ge $height) { return $true }
  $i = Get-Cell $x $y
  $frame = ($front[$i] -band 0x7FFF) - 1
  if ($frame -ge 0 -and $frontIndex[$i] -ne -1 -and $frontIndex[$i] -ne 200) { return $true }
  if ($back[$i] -eq 0) { return $false }
  return $false
}

function Test-OpenLaneColumn([int]$x, [int]$laneY) {
  foreach ($y in @(($laneY - 1), $laneY, ($laneY + 1))) {
    if (Test-Blocked $x $y) { return $false }
  }
  return $true
}

function Get-WallSignature([int]$x0, [int]$laneY, [int]$w) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($entry in @(
    @{ Band = "north"; Ys = @(($laneY - 4), ($laneY - 3), ($laneY - 2), ($laneY - 1)) }
    @{ Band = "south"; Ys = @(($laneY + 1), ($laneY + 2), ($laneY + 3), ($laneY + 4)) }
  )) {
    foreach ($y in $entry.Ys) {
      for ($x = $x0; $x -lt ($x0 + $w); $x++) {
        if ($y -lt 0 -or $y -ge $height) { continue }
        $i = Get-Cell $x $y
        $frame = ($front[$i] -band 0x7FFF) - 1
        $slot = $frontIndex[$i]
        if ($frame -ge 0 -and $slot -ne -1 -and $slot -ne 200) {
          $relX = $x - $x0
          $parts.Add("$($entry.Band)@$relX,$y=$slot`:$frame")
        }
      }
    }
  }
  return @($parts | Sort-Object) -join "|"
}

function Get-FrameSummary([string]$sig) {
  $frames = @{}
  foreach ($part in ($sig -split "\|")) {
    if ($part -match "=(\d+):(\d+)$") {
      $key = "$($Matches[1]):$($Matches[2])"
      if (-not $frames.ContainsKey($key)) { $frames[$key] = 0 }
      $frames[$key]++
    }
  }
  return @($frames.GetEnumerator() | Sort-Object -Property Value -Descending | ForEach-Object { "$($_.Key)($($_.Value))" }) -join ", "
}

$rawCandidates = New-Object System.Collections.Generic.List[object]
for ($laneY = 15; $laneY -lt ($height - 15); $laneY++) {
  $runStart = -1
  for ($x = 0; $x -le $width; $x++) {
    $open = ($x -lt $width) -and (Test-OpenLaneColumn $x $laneY)
    if ($open) {
      if ($runStart -lt 0) { $runStart = $x }
    }
    elseif ($runStart -ge 0) {
      $runLen = $x - $runStart
      if ($runLen -ge $WindowCells) {
        $step = [Math]::Max(6, [Math]::Floor($runLen / 4))
        for ($x0 = $runStart; $x0 -le ($x - $WindowCells); $x0 += $step) {
          $sig = Get-WallSignature $x0 $laneY $WindowCells
          if ([string]::IsNullOrWhiteSpace($sig)) { continue }
          $northCount = @($sig -split "\|" | Where-Object { $_ -like "north*" }).Count
          $southCount = @($sig -split "\|" | Where-Object { $_ -like "south*" }).Count
          if ($northCount -lt 2 -and $southCount -lt 2) { continue }
          $rawCandidates.Add([pscustomobject]@{
            LaneY = $laneY
            CropX = $x0
            CropY = [Math]::Max(0, $laneY - 9)
            CropW = $WindowCells
            CropH = 13
            Signature = $sig
            NorthCount = $northCount
            SouthCount = $southCount
            FrameSummary = (Get-FrameSummary $sig)
            Score = $northCount + $southCount
          })
        }
      }
      $runStart = -1
    }
  }
}

$bySignature = @{}
foreach ($item in $rawCandidates) {
  if (-not $bySignature.ContainsKey($item.Signature)) {
    $bySignature[$item.Signature] = $item
  }
  elseif ($item.Score -gt $bySignature[$item.Signature].Score) {
    $bySignature[$item.Signature] = $item
  }
}

$unique = @($bySignature.Values | Sort-Object -Property Score -Descending)
Write-Output "Map ${width}x${height} | raw windows: $($rawCandidates.Count) | unique wall signatures: $($unique.Count)"

$selected = New-Object System.Collections.Generic.List[object]
foreach ($item in $unique) {
  if ($selected.Count -ge $MaxSamples) { break }
  $tooNear = $false
  foreach ($existing in $selected) {
    if ([Math]::Abs($existing.LaneY - $item.LaneY) -lt 6 -and [Math]::Abs($existing.CropX - $item.CropX) -lt 18) {
      $tooNear = $true
      break
    }
  }
  if ($tooNear) { continue }
  $selected.Add($item)
}

if ($selected.Count -lt $MaxSamples) {
  foreach ($item in $unique) {
    if ($selected.Count -ge $MaxSamples) { break }
    if (@($selected | Where-Object { $_.Signature -eq $item.Signature }).Count -gt 0) { continue }
    $selected.Add($item)
  }
}

$selected | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot "../tile-review/bdd-corridor-slices/discovered-candidates.json") -Encoding UTF8

foreach ($item in $selected) {
  Write-Output ("y={0} x={1} score={2} frames={3}" -f $item.LaneY, $item.CropX, $item.Score, $item.FrameSummary)
}
