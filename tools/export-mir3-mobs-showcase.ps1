param(
  [string]$Mir3Root = "C:\Users\bb-we\Documents\LOM Idle Backup\lom-idle-v2 - Cursor\new content\extracted\Mir3Mobs\Mir3Mobs",
  [string]$OutRoot = "C:\Users\bb-we\Documents\LOM Idle Backup\lom-idle-v2 - Cursor\new content\show-and-tell\assets\mir3-mobs",
  [int]$SamplesPerLib = 8,
  [int]$MinFrameSize = 40,
  [switch]$Recurse
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function SafeName {
  param([string]$Name)
  return (($Name -replace '[^\w\-. ]', '_') -replace '\s+', '-').Trim("-")
}

. (Join-Path $PSScriptRoot "decode-mir2-wil.ps1")

function Get-UsefulWilFrameIndexes {
  param(
    [string]$WilPath,
    [string]$WixPath,
    [int]$MinSize = 40,
    [int]$MaxCollect = 400
  )
  $wilBytes = [System.IO.File]::ReadAllBytes($WilPath)
  $wixBytes = [System.IO.File]::ReadAllBytes($WixPath)
  $count = [BitConverter]::ToInt32($wilBytes, 44)
  $useful = New-Object System.Collections.Generic.List[int]
  for ($i = 0; $i -lt $count; $i++) {
    $pos = [BitConverter]::ToInt32($wixBytes, 48 + ($i * 4))
    if ($pos -le 0 -or $pos + 4 -ge $wilBytes.Length) { continue }
    $w = [BitConverter]::ToInt16($wilBytes, $pos)
    $h = [BitConverter]::ToInt16($wilBytes, $pos + 2)
    if ($w -ge $MinSize -and $h -ge $MinSize) {
      $useful.Add($i) | Out-Null
      if ($useful.Count -ge $MaxCollect) { break }
    }
  }
  return @($useful)
}

function Select-SampleIndexes {
  param([int[]]$Indexes, [int]$Count = 8)
  if (-not $Indexes -or -not $Indexes.Count) { return @() }
  if ($Indexes.Count -le $Count) { return $Indexes }
  $last = $Indexes.Count - 1
  $picked = New-Object System.Collections.Generic.List[int]
  for ($slot = 0; $slot -lt $Count; $slot++) {
    $idx = [int][Math]::Round($slot * $last / [Math]::Max(1, $Count - 1))
    $frame = $Indexes[$idx]
    if (-not $picked.Contains($frame)) { $picked.Add($frame) | Out-Null }
  }
  return @($picked.ToArray())
}

if (Test-Path -LiteralPath $OutRoot) {
  Remove-Item -LiteralPath $OutRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutRoot | Out-Null

$manifest = New-Object System.Collections.Generic.List[object]
$wilFiles = Get-ChildItem -LiteralPath $Mir3Root -File -Filter "Mon*.Wil" -Recurse:$Recurse | Sort-Object FullName
if (-not $wilFiles.Count) {
  $wilFiles = Get-ChildItem -LiteralPath $Mir3Root -File -Filter "Mon*.wil" -Recurse:$Recurse | Sort-Object FullName
}

foreach ($wilFile in $wilFiles) {
  $wixFile = Join-Path $wilFile.DirectoryName ($wilFile.BaseName + ".WIX")
  if (-not (Test-Path -LiteralPath $wixFile)) {
    $wixFile = Join-Path $wilFile.DirectoryName ($wilFile.BaseName + ".wix")
  }
  if (-not (Test-Path -LiteralPath $wixFile)) {
    Write-Warning "Missing WIX for $($wilFile.Name)"
    continue
  }

  $relativeDir = $wilFile.DirectoryName.Substring($Mir3Root.Length).TrimStart("\")
  $outName = if ($relativeDir) { SafeName (Join-Path $relativeDir $wilFile.BaseName) } else { SafeName $wilFile.BaseName }
  try {
    $libOut = Join-Path $OutRoot $outName
    New-Item -ItemType Directory -Force -Path $libOut | Out-Null
    $useful = Get-UsefulWilFrameIndexes -WilPath $wilFile.FullName -WixPath $wixFile -MinSize $MinFrameSize
    $sampleIndexes = Select-SampleIndexes -Indexes $useful -Count $SamplesPerLib
    if (-not $sampleIndexes.Count) { $sampleIndexes = @(0) }

    $lib = [Mir2WilLibrary]::new($wilFile.FullName, $wixFile)
    try {
    $exported = 0
    $largest = @{ w = 0; h = 0; index = -1 }
    foreach ($index in $sampleIndexes) {
      $frame = $lib.ReadFrame($index)
      if ($frame -eq $null) { continue }
      try {
        if ($frame.Width -gt $largest.w -or $frame.Height -gt $largest.h) {
          $largest.w = $frame.Width
          $largest.h = $frame.Height
          $largest.index = $index
        }
        $outPath = Join-Path $libOut ("frame-{0:D5}.png" -f $index)
        $frame.Bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $exported += 1
      }
      finally {
        $frame.Dispose()
      }
    }
    $title = ($lib.Title -replace '^[^\w]+', '').Trim()
    $largestLabel = if ($largest.index -ge 0) {
      ($largest.w.ToString() + "x" + $largest.h.ToString() + " at frame " + $largest.index.ToString())
    } else { "n/a" }
    $manifest.Add([pscustomobject]@{
      Library = $wilFile.BaseName
      Title = $title
      Frames = $lib.Count
      UsefulFrames = $useful.Count
      Exported = $exported
      Largest = $largestLabel
      Folder = (Split-Path -Leaf $libOut)
    }) | Out-Null
    Write-Output ("{0}: {1}/{2} frames exported ({3} useful)" -f $wilFile.BaseName, $exported, $lib.Count, $useful.Count)
    }
    finally {
      $lib.Dispose()
    }
  }
  catch {
    Write-Warning ("{0}: skipped ({1})" -f $wilFile.Name, $_.Exception.Message)
  }
}

$manifestPath = Join-Path $OutRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Output "manifest=$manifestPath"
