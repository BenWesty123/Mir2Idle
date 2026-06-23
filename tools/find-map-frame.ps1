param([int]$TargetFrame = 181, [int]$TargetSlot = 15)
$mapPath = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/R01.map"
$bytes = [IO.File]::ReadAllBytes($mapPath)
$xor = [BitConverter]::ToInt16($bytes, 23)
$width = [BitConverter]::ToInt16($bytes, 21) -bxor $xor
$height = [BitConverter]::ToInt16($bytes, 25) -bxor $xor
for ($x = 21; $x -le 51; $x++) {
  for ($y = 12; $y -le 40; $y++) {
    $i = ($x * $height) + $y
    $cellOffset = 54 + ($i * 15)
    $front = [BitConverter]::ToInt16($bytes, $cellOffset + 6) -bxor $xor
    $slot = [int]$bytes[$cellOffset + 12] + 2
    if ($slot -eq 102) { $slot = 90 }
    $frame = ($front -band 0x7FFF) - 1
    if ($frame -eq $TargetFrame -and $slot -eq $TargetSlot) {
      Write-Host "x=$x y=$y slot=$slot frame=$frame"
    }
  }
}
