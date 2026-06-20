param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [int]$Index = 64,
  [int]$ProjectileStart = 227,
  [int]$DirectionStride = 1,
  [string]$OutDir = "$PSScriptRoot\..\public\debug\zuma-arrow-rotation"
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

$monsterLib = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
if (-not (Test-Path -LiteralPath $monsterLib)) { throw "Monster library not found: $monsterLib" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$reader = [ZaMonsterLib]::new((Resolve-Path $monsterLib))
$frames = @()
try {
  for ($dir = 0; $dir -lt 16; $dir++) {
    $srcFrame = $ProjectileStart + ($dir * $DirectionStride)
    $image = $reader.ReadImage($srcFrame)
    if ($null -eq $image) { continue }
    $name = "dir{0:D2}-f{1}" -f $dir, $srcFrame
    $pngPath = Join-Path $OutDir "$name.png"
    $image.Bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $frames += [ordered]@{
      dir = $dir
      srcFrame = $srcFrame
      file = "$name.png"
      w = $image.Bitmap.Width
      h = $image.Bitmap.Height
      offsetX = $image.OffsetX
      offsetY = $image.OffsetY
    }
    $image.Dispose()
  }
}
finally {
  $reader.Dispose()
}
if ($frames.Count -eq 0) { throw "No projectile frames found from $ProjectileStart" }

$base = $frames | Where-Object { $_.srcFrame -eq $ProjectileStart } | Select-Object -First 1
if (-not $base) { $base = $frames[0] }
$metaJson = ($frames | ConvertTo-Json -Depth 5 -Compress)
$htmlHead = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Zuma Archer Arrow Rotation Debug</title>
  <style>
    body { font: 14px/1.45 system-ui, sans-serif; background: #12110f; color: #e8dcc8; margin: 24px; }
    h1, h2 { margin: 0 0 12px; }
    p, li { max-width: 920px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin: 16px 0 28px; }
    .card { border: 1px solid #3b3224; background: #1a1712; padding: 10px; }
    .card img { image-rendering: pixelated; background:
      linear-gradient(45deg, #2a2620 25%, transparent 25%) 0 0/16px 16px,
      linear-gradient(-45deg, #2a2620 25%, transparent 25%) 0 0/16px 16px,
      linear-gradient(45deg, transparent 75%, #2a2620 75%) 0 0/16px 16px,
      linear-gradient(-45deg, transparent 75%, #2a2620 75%) 0 0/16px 16px,
      #1f1b16; }
    canvas { image-rendering: pixelated; border: 1px solid #3b3224; background: #1f1b16; display: block; margin-top: 8px; }
    label { display: inline-flex; align-items: center; gap: 8px; margin-right: 16px; }
    input[type=range] { width: 220px; }
    code { color: #f0c987; }
    .row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
    .muted { color: #a89878; }
  </style>
</head>
<body>
  <h1>Zuma Archer arrow rotation debug</h1>
  <p>Monster <code>$Index</code>, base projectile frame <code>$ProjectileStart</code> (Crystal direction 0). Each direction uses stride <code>$DirectionStride</code>.</p>
  <p class="muted">Base sprite: Crystal dir 3, frame 227 — points <strong>west</strong> (180 deg). Rotation = atan2(target - arrow) - 180 deg.</p>

  <h2>1. Raw Crystal direction sprites</h2>
  <div class="grid" id="rawGrid"></div>

  <h2>2. Base frame + canvas rotation (what the game does now)</h2>
  <div class="row">
    <div class="card">
      <strong>Base sprite (dir 3, frame $($ProjectileStart))</strong>
      <img id="baseImg" src="$($base.file)" width="$($base.w * 4)" height="$($base.h * 4)" alt="base arrow" />
      <div class="muted">offsetX=$($base.offsetX), offsetY=$($base.offsetY), $($base.w)x$($base.h)</div>
    </div>
    <div class="card">
      <strong>Rotated preview</strong>
      <label>baseAngleDeg <input id="baseAngle" type="range" min="-180" max="180" step="1" value="180" /> <span id="baseAngleVal">180</span> deg</label>
      <label>travel angle <input id="travelAngle" type="range" min="-180" max="180" step="1" value="0" /> <span id="travelAngleVal">0</span> deg</label>
      <canvas id="rotCanvas" width="240" height="240"></canvas>
      <div class="muted">rotation applied = travelAngle - baseAngle. Blue line = travel direction.</div>
    </div>
  </div>

  <h2>3. Compare rotation vs Crystal dir sprite (16 directions)</h2>
  <div class="grid" id="compareGrid"></div>

  <script>window.ARROW_DEBUG_FRAMES = $metaJson;</script>
  <script src="app.js"></script>
</body>
</html>
"@

$html = $htmlHead

$htmlPath = Join-Path $OutDir "index.html"
$appJsPath = Join-Path $OutDir "app.js"
$appJsSource = Join-Path $PSScriptRoot "zuma-arrow-rotation-debug.js"
if (-not (Test-Path -LiteralPath $appJsSource)) { throw "Missing $appJsSource" }
Copy-Item -LiteralPath $appJsSource -Destination $appJsPath -Force
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)
Write-Host "Wrote $htmlPath and $appJsPath"
