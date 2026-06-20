param(
  [string]$InputRoot = "$PSScriptRoot\..\public\ui\character",
  [string]$OutputRoot = "$PSScriptRoot\..\public\ui\character",
  [int]$MaxAtlasHeight = 4000
)

# NOTE: This builds a COMMITTED dev artifact. It writes the atlas PNG and a
# coordinate map (stateitems-atlas.json) into the source public/ tree and NEVER
# edits stateitems.json. The game merges these coordinates at load time (see
# applyStateItemAtlas in src/app.monolith.js), so dev and the itch release
# render from the same committed files. Run via:
#   npm run build:stateitem-atlas   (after changing paper-doll stateitems)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$metadataPath = Join-Path $InputRoot "stateitems.json"
if (-not (Test-Path -LiteralPath $metadataPath)) {
  throw "Missing stateitems.json at $metadataPath"
}

$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$entries = @()
foreach ($property in $metadata.PSObject.Properties) {
  $frame = [int]$property.Name
  $entry = $property.Value
  $pngPath = Join-Path $InputRoot ("stateitem-$frame.png")
  if (-not (Test-Path -LiteralPath $pngPath)) { continue }
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
  if ($bitmap.Width -le 0 -or $bitmap.Height -le 0) {
    $bitmap.Dispose()
    throw "Invalid dimensions for stateitem-$frame.png"
  }
  $entries += [pscustomobject]@{
    Frame = $frame
    Bitmap = $bitmap
    Meta = $entry
  }
}

if (-not $entries.Count) {
  throw "No stateitem PNGs found to atlas."
}

$entries = $entries | Sort-Object Frame
$padding = 2
$columns = 1
$rows = $entries.Count

while ($columns -lt $entries.Count) {
  $columns++
  $rows = [Math]::Ceiling($entries.Count / $columns)
  $cellHeights = @(for ($row = 0; $row -lt $rows; $row++) { 0 })
  for ($index = 0; $index -lt $entries.Count; $index++) {
    $row = [Math]::Floor($index / $columns)
    $cellHeights[$row] = [Math]::Max($cellHeights[$row], $entries[$index].Bitmap.Height)
  }
  $estimatedHeight = ($cellHeights | Measure-Object -Sum).Sum + ($padding * ($rows + 1))
  if ($estimatedHeight -le $MaxAtlasHeight) { break }
}

$cellWidths = @(for ($column = 0; $column -lt $columns; $column++) { 0 })
$cellHeights = @(for ($row = 0; $row -lt $rows; $row++) { 0 })
for ($index = 0; $index -lt $entries.Count; $index++) {
  $column = $index % $columns
  $row = [Math]::Floor($index / $columns)
  $cellWidths[$column] = [Math]::Max($cellWidths[$column], $entries[$index].Bitmap.Width)
  $cellHeights[$row] = [Math]::Max($cellHeights[$row], $entries[$index].Bitmap.Height)
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
  throw "Invalid atlas size ${atlasWidth}x${atlasHeight} (${columns}x${rows} grid)"
}

Write-Output "Atlas target size: ${atlasWidth}x${atlasHeight} from $($entries.Count) frames (${columns}x${rows} grid)"

$atlas = New-Object System.Drawing.Bitmap $atlasWidth, $atlasHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($atlas)
$packed = [ordered]@{}

try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  for ($index = 0; $index -lt $entries.Count; $index++) {
    $entry = $entries[$index]
    $column = $index % $columns
    $row = [Math]::Floor($index / $columns)
    $drawX = $columnOffsets[$column]
    $drawY = $rowOffsets[$row]
    $graphics.DrawImage($entry.Bitmap, $drawX, $drawY)
    $packed[[string]$entry.Frame] = [ordered]@{
      sheet = "./public/ui/character/stateitems-atlas.png"
      sx = $drawX
      sy = $drawY
      x = $entry.Meta.x
      y = $entry.Meta.y
      w = $entry.Meta.w
      h = $entry.Meta.h
    }
  }
}
finally {
  $graphics.Dispose()
  foreach ($entry in $entries) { $entry.Bitmap.Dispose() }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$atlasPath = Join-Path $OutputRoot "stateitems-atlas.png"
$atlas.Save($atlasPath, [System.Drawing.Imaging.ImageFormat]::Png)
$atlas.Dispose()

# Write a coordinate map instead of overwriting stateitems.json. The game loads
# this map and merges sheet/sx/sy onto each paper-doll frame at runtime (the x/y/w/h
# placement still comes from the untouched stateitems.json).
$frames = [ordered]@{}
foreach ($key in ($packed.Keys)) {
  $frame = $packed[$key]
  $frames[[string]$key] = [ordered]@{ sx = $frame.sx; sy = $frame.sy }
}
$map = [ordered]@{
  sheet = "./public/ui/character/stateitems-atlas.png"
  frames = $frames
}
$mapPath = Join-Path $OutputRoot "stateitems-atlas.json"
$map | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $mapPath
Write-Output "Built stateitem atlas with $($packed.Count) frames -> $atlasPath"
Write-Output "Wrote stateitem atlas map -> $mapPath"
