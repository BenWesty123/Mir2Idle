param([int]$Index = 64)
$path = "$PSScriptRoot\..\public\monsters\monster\$Index.json"
$a = Get-Content $path -Raw | ConvertFrom-Json
Write-Host ("slotWidth={0} slotHeight={1}" -f $a.slotWidth, $a.slotHeight)
foreach ($p in $a.actions.PSObject.Properties) {
  $frames = $p.Value.frames
  $empty = 0
  $slots = @()
  foreach ($fr in $frames) {
    if ($fr.empty) { $empty++ }
    $slots += $fr.slot
  }
  Write-Host ("{0,-18} frames={1,3} empty={2} slots=[{3}]" -f $p.Name, $frames.Count, $empty, ($slots -join ','))
}
