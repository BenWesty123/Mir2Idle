param(
  [string]$ItemsPath = "$PSScriptRoot\..\src\data\items.json",
  [string]$InputRoot = "$PSScriptRoot\..\public\item-icons\items",
  [string]$OutputRoot = "$PSScriptRoot\..\dist\itch\public\item-icons",
  [int]$MaxAtlasHeight = 4000
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Read-JsonFile([string]$Path) {
  $text = Get-Content -LiteralPath $Path -Raw
  if ($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF) {
    $text = $text.Substring(1)
  }
  return $text | ConvertFrom-Json
}

if (-not (Test-Path -LiteralPath $ItemsPath)) {
  throw "Missing items.json at $ItemsPath"
}

$itemsData = Read-JsonFile $ItemsPath
$entries = @()
$seen = @{}

foreach ($item in $itemsData.items) {
  $src = [string]$item.icon.src
  if ([string]::IsNullOrWhiteSpace($src) -or $src -notmatch "item-icons/items/") { continue }
  $fileName = [System.IO.Path]::GetFileName($src)
  if ($seen.ContainsKey($fileName)) { continue }
  $pngPath = Join-Path $InputRoot $fileName
  if (-not (Test-Path -LiteralPath $pngPath)) {
    throw "Missing item icon for $($item.id): $pngPath"
  }
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
  if ($bitmap.Width -le 0 -or $bitmap.Height -le 0) {
    $bitmap.Dispose()
    throw "Invalid dimensions for $fileName"
  }
  $seen[$fileName] = $true
  $entries += [pscustomobject]@{
    FileName = $fileName
    Bitmap = $bitmap
    Width = $bitmap.Width
    Height = $bitmap.Height
  }
}

if (-not $entries.Count) {
  throw "No item icon PNGs found to atlas."
}

$entries = $entries | Sort-Object FileName
$padding = 2
$columns = 1
$rows = $entries.Count

while ($columns -lt $entries.Count) {
  $columns++
  $rows = [Math]::Ceiling($entries.Count / $columns)
  $cellHeights = @(for ($row = 0; $row -lt $rows; $row++) { 0 })
  for ($index = 0; $index -lt $entries.Count; $index++) {
    $row = [Math]::Floor($index / $columns)
    $cellHeights[$row] = [Math]::Max($cellHeights[$row], $entries[$index].Height)
  }
  $estimatedHeight = ($cellHeights | Measure-Object -Sum).Sum + ($padding * ($rows + 1))
  if ($estimatedHeight -le $MaxAtlasHeight) { break }
}

$cellWidths = @(for ($column = 0; $column -lt $columns; $column++) { 0 })
$cellHeights = @(for ($row = 0; $row -lt $rows; $row++) { 0 })
for ($index = 0; $index -lt $entries.Count; $index++) {
  $column = $index % $columns
  $row = [Math]::Floor($index / $columns)
  $cellWidths[$column] = [Math]::Max($cellWidths[$column], $entries[$index].Width)
  $cellHeights[$row] = [Math]::Max($cellHeights[$row], $entries[$index].Height)
}

$columnOffsets = @(0) * $columns
$columnOffsets[0] = $padding
for ($column = 1; $column -lt $columns; $column++) {
  $columnOffsets[$column] = $columnOffsets[$column - 1] + $cellWidths[$column - 1] + $padding
}

$rowOffsets = @(0) * $rows
$rowOffsets[0] = $padding
for ($row = 1; $row -lt $rows; $row++) {
  $rowOffsets[$row] = $rowOffsets[$row - 1] + $cellHeights[$row - 1] + $padding
}

$atlasWidth = ($cellWidths | Measure-Object -Sum).Sum + ($padding * ($columns + 1))
$atlasHeight = ($cellHeights | Measure-Object -Sum).Sum + ($padding * ($rows + 1))
if ($atlasWidth -le 0 -or $atlasHeight -le 0 -or $atlasHeight -gt $MaxAtlasHeight) {
  throw "Invalid item icon atlas size ${atlasWidth}x${atlasHeight} (${columns}x${rows} grid)"
}

Write-Output "Item icon atlas target size: ${atlasWidth}x${atlasHeight} from $($entries.Count) icons (${columns}x${rows} grid)"

$atlas = New-Object System.Drawing.Bitmap $atlasWidth, $atlasHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($atlas)
$packed = @{}

try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  for ($index = 0; $index -lt $entries.Count; $index++) {
    $entry = $entries[$index]
    $column = $index % $columns
    $row = [Math]::Floor($index / $columns)
    $drawX = $columnOffsets[$column]
    $drawY = $rowOffsets[$row]
    $graphics.DrawImage($entry.Bitmap, $drawX, $drawY)
    $packed[$entry.FileName] = [ordered]@{
      sheet = "./public/item-icons/items-atlas.png"
      sx = $drawX
      sy = $drawY
      w = $entry.Width
      h = $entry.Height
    }
  }
}
finally {
  $graphics.Dispose()
  foreach ($entry in $entries) { $entry.Bitmap.Dispose() }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$atlasPath = Join-Path $OutputRoot "items-atlas.png"
$atlas.Save($atlasPath, [System.Drawing.Imaging.ImageFormat]::Png)
$atlas.Dispose()

$updated = 0
foreach ($item in $itemsData.items) {
  $src = [string]$item.icon.src
  if ([string]::IsNullOrWhiteSpace($src) -or $src -notmatch "item-icons/items/") { continue }
  $fileName = [System.IO.Path]::GetFileName($src)
  $frame = $packed[$fileName]
  if (-not $frame) { continue }
  $item.icon | Add-Member -NotePropertyName sheet -NotePropertyValue $frame.sheet -Force
  $item.icon | Add-Member -NotePropertyName sx -NotePropertyValue $frame.sx -Force
  $item.icon | Add-Member -NotePropertyName sy -NotePropertyValue $frame.sy -Force
  $item.icon | Add-Member -NotePropertyName w -NotePropertyValue $frame.w -Force
  $item.icon | Add-Member -NotePropertyName h -NotePropertyValue $frame.h -Force
  $item.icon.PSObject.Properties.Remove("src")
  $updated++
}

$itemsData | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ItemsPath
Write-Output "Built item icon atlas with $($packed.Count) frames -> $atlasPath"
Write-Output "Updated $updated item icon entries in $ItemsPath"
