param(
  [int]$Index = 93,
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data"
)

$actionNames = @{
  0  = "standing"
  1  = "walking"
  9  = "attack1"
  10 = "attack2"
  11 = "attackRange1"
  12 = "attackRange2"
  18 = "struck"
  21 = "die"
  22 = "dead"
  24 = "show"
  25 = "hide"
  28 = "revive"
}

$library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
$fs = [System.IO.File]::OpenRead($library)
$br = New-Object System.IO.BinaryReader($fs)
$null = $br.ReadInt32()
$null = $br.ReadInt32()
$frameSeek = $br.ReadInt32()
$fs.Seek($frameSeek, [System.IO.SeekOrigin]::Begin) | Out-Null
$frameCount = $br.ReadInt32()
$actions = [ordered]@{}
for ($i = 0; $i -lt $frameCount; $i++) {
  $action = [int]$br.ReadByte()
  $start = $br.ReadInt32()
  $count = $br.ReadInt32()
  $skip = $br.ReadInt32()
  $interval = $br.ReadInt32()
  $null = $br.ReadInt32()
  $null = $br.ReadInt32()
  $null = $br.ReadInt32()
  $null = $br.ReadInt32()
  $reverse = $br.ReadBoolean()
  $null = $br.ReadBoolean()
  if (-not $actionNames.ContainsKey($action)) {
    Write-Output ("unknown action {0}: start={1} count={2} offset={3}" -f $action, $start, $count, ($count + $skip))
    continue
  }
  $name = $actionNames[$action]
  $actions[$name] = @{
    start = $start
    count = $count
    offset = $count + $skip
    interval = $interval
    reverse = $reverse
  }
}
$br.Close()
$fs.Close()

Write-Output "Monster $Index lib actions:"
foreach ($entry in $actions.GetEnumerator()) {
  $spec = $entry.Value
  Write-Output ("  {0}: start={1} count={2} offset={3} interval={4}" -f $entry.Key, $spec.start, $spec.count, $spec.offset, $spec.interval)
}
