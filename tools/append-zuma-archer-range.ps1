param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$MonsterDir = "$PSScriptRoot\..\public\monsters\monster",
  [int]$Index = 64,
  [int]$ProjectileFrame = 224,
  [int]$DirectionCount = 16,
  [int]$BaseAngleDeg = 107,
  [switch]$Force,
  [switch]$UpdateAngleOnly
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("ZaMonsterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
public sealed class ZaMonsterLib : IDisposable {
  private readonly FileStream stream;
  private readonly BinaryReader reader;
  private readonly int[] offsets;
  public ZaMonsterLib(string path) {
    stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    reader = new BinaryReader(stream);
    int version = reader.ReadInt32();
    int count = reader.ReadInt32();
    if (version >= 3) reader.ReadInt32();
    offsets = new int[count];
    for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
  }
  public ZaMonsterImage ReadImage(int index) {
    if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
    stream.Position = offsets[index];
    short w = reader.ReadInt16();
    short h = reader.ReadInt16();
    short ox = reader.ReadInt16();
    short oy = reader.ReadInt16();
    reader.ReadInt16(); reader.ReadInt16();
    byte shadow = reader.ReadByte();
    int len = reader.ReadInt32();
    bool hasMask = (shadow >> 7) == 1;
    if (w <= 0 || h <= 0 || len <= 0) return null;
    byte[] compressed = reader.ReadBytes(len);
    if (hasMask) { reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); int maskLen = reader.ReadInt32(); reader.ReadBytes(maskLen); }
    byte[] raw;
    using (var input = new MemoryStream(compressed))
    using (var gzip = new GZipStream(input, CompressionMode.Decompress))
    using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); }
    if (raw.Length < w * h * 4) return null;
    Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); }
    finally { bitmap.UnlockBits(data); }
    return new ZaMonsterImage(bitmap, ox, oy);
  }
  public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class ZaMonsterImage : IDisposable {
  public Bitmap Bitmap { get; private set; }
  public short OffsetX { get; private set; }
  public short OffsetY { get; private set; }
  public ZaMonsterImage(Bitmap bitmap, short offsetX, short offsetY) { Bitmap = bitmap; OffsetX = offsetX; OffsetY = offsetY; }
  public void Dispose() { Bitmap.Dispose(); }
}
"@
}

$atlasPath = Join-Path $MonsterDir "$Index.json"
$pngPath = Join-Path $MonsterDir "$Index.png"
$monsterLib = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
if (-not (Test-Path -LiteralPath $atlasPath)) { throw "Atlas not found: $atlasPath" }
if (-not (Test-Path -LiteralPath $pngPath)) { throw "Sheet not found: $pngPath" }
if (-not (Test-Path -LiteralPath $monsterLib)) { throw "Monster library not found: $monsterLib" }

$atlas = Get-Content -LiteralPath $atlasPath -Raw | ConvertFrom-Json

if ($UpdateAngleOnly) {
  if (-not $atlas.projectile) { throw "Monster $Index has no projectile block to update" }
  $atlas.projectile.baseAngleDeg = $BaseAngleDeg
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($atlasPath, ($atlas | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
  Write-Host "Updated monster $Index projectile baseAngleDeg to $BaseAngleDeg (JSON only, body atlas untouched)"
  exit 0
}

if ($atlas.projectile -and -not $Force) {
  Write-Host "Monster $Index already has a projectile (use -Force to replace sheet, or -UpdateAngleOnly to tweak rotation)"
  exit 0
}

$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
$baseSlotCount = 0
foreach ($action in $atlas.actions.PSObject.Properties) {
  if ($action.Name -eq "attackRange1") { continue }
  foreach ($frame in $action.Value.frames) {
    $baseSlotCount = [Math]::Max($baseSlotCount, [int]$frame.slot + 1)
  }
}

$projectileFrames = New-Object System.Collections.Generic.List[object]
$projectileImages = New-Object System.Collections.Generic.List[object]
$monsterReader = [ZaMonsterLib]::new((Resolve-Path $monsterLib))
try {
  $srcFrame = $ProjectileFrame
  $image = $monsterReader.ReadImage($srcFrame)
  if ($null -eq $image) { throw "Projectile frame $srcFrame missing in monster lib $Index" }
  $projectileImages.Add($image) | Out-Null
  $projectileFrames.Add([ordered]@{
    slot = $baseSlotCount
    srcFrame = $srcFrame
    direction = 0
    w = $image.Bitmap.Width
    h = $image.Bitmap.Height
    offsetX = $image.OffsetX
    offsetY = $image.OffsetY
  }) | Out-Null
}
finally {
  $monsterReader.Dispose()
}

$existingSheet = [System.Drawing.Bitmap]::FromFile($pngPath)
$existingCopy = [System.Drawing.Bitmap]::new($existingSheet)
$existingSheet.Dispose()
try {
  $baseWidth = $slotWidth * $baseSlotCount
  $newWidth = $slotWidth * ($baseSlotCount + 1)
  $sheet = [System.Drawing.Bitmap]::new($newWidth, $slotHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($existingCopy, 0, 0, $baseWidth, $slotHeight)
    $image = $projectileImages[0]
    $graphics.DrawImage($image.Bitmap, $baseSlotCount * $slotWidth, 0, $image.Bitmap.Width, $image.Bitmap.Height)
    $tempPath = "$pngPath.tmp.png"
    $sheet.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -LiteralPath $tempPath -Destination $pngPath -Force
  }
  finally {
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
finally {
  $existingCopy.Dispose()
  foreach ($image in $projectileImages) { $image.Dispose() }
}

$actions = [ordered]@{}
foreach ($prop in $atlas.actions.PSObject.Properties) {
  if ($prop.Name -eq "attackRange1") { continue }
  $actions[$prop.Name] = $prop.Value
}

$output = [ordered]@{
  layer = $atlas.layer
  index = $atlas.index
  direction = $atlas.direction
  slotWidth = $slotWidth
  slotHeight = $slotHeight
  actions = $actions
  projectile = [ordered]@{
    style = "travel"
    rotate = $true
    baseFrame = 0
    baseAngleDeg = $BaseAngleDeg
    interval = 30
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    frames = @($projectileFrames[0])
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($atlasPath, ($output | ConvertTo-Json -Depth 20 -Compress), $utf8NoBom)
Write-Host "Set Zuma Archer projectile to monster $Index frame $ProjectileFrame (canvas-rotated travel arrow)"
