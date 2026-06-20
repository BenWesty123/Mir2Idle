param(
  [string]$ItemsPath = "$PSScriptRoot\..\src\data\items.json",
  [string]$InputRoot = "$PSScriptRoot\..\public\item-icons\items",
  [string]$OutputRoot = "$PSScriptRoot\..\public\item-icons",
  [int]$MaxAtlasHeight = 4000
)

# NOTE: This builds a COMMITTED dev artifact. It writes the atlas PNG and a
# coordinate map (items-atlas.json) into the source public/ tree and NEVER
# edits src/data/items.json. The game merges these coordinates onto item icons
# at load time, so the dev build and the itch release render from the exact
# same committed files (packaging only copies them). Run via:
#   npm run build:item-atlas   (after changing or adding item icons)

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

# Write a coordinate map instead of rewriting items.json. The game loads this
# map and merges sx/sy/w/h onto each item icon at runtime (see applyItemIconAtlas
# in src/app.monolith.js), so items.json stays a pure CSV-generated source file.
$frames = [ordered]@{}
foreach ($name in ($packed.Keys | Sort-Object)) {
  $frame = $packed[$name]
  $frames[$name] = [ordered]@{ sx = $frame.sx; sy = $frame.sy; w = $frame.w; h = $frame.h }
}
$map = [ordered]@{
  sheet = "./public/item-icons/items-atlas.png"
  width = $atlasWidth
  height = $atlasHeight
  frames = $frames
}
$mapPath = Join-Path $OutputRoot "items-atlas.json"
$map | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $mapPath
Write-Output "Built item icon atlas with $($packed.Count) frames -> $atlasPath"
Write-Output "Wrote item icon atlas map -> $mapPath"
