param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = ""
)

if (-not $OutputRoot) {
  $OutputRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\tile-review\dungeon-boss-gallery\probe"))
}
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

. (Join-Path $PSScriptRoot "export-special-boss-thumbs.ps1") | Out-Null

$probes = @(
  @{ label = "fox"; library = Join-Path $DataRoot "Monster\134.Lib"; frames = @(0, 10, 60, 120, 180, 240, 250, 300, 318, 335) },
  @{ label = "mir"; library = Join-Path $DataRoot "Dragon.Lib"; frames = @(0, 1, 2, 3, 10, 60, 68, 90, 120, 200, 300, 310) }
)

foreach ($group in $probes) {
  foreach ($frame in $group.frames) {
    $out = Join-Path $OutputRoot ("{0}_{1:D4}.png" -f $group.label, $frame)
    $ok = Export-RawFrameThumb -LibraryPath $group.library -SrcFrame $frame -OutputPath $out
    Write-Output ("{0} frame {1}: {2}" -f $group.label, $frame, $(if ($ok) { "ok" } else { "empty" }))
  }
}
