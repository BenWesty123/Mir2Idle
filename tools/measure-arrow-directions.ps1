param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [int]$Index = 64,
  [int]$Start = 224,
  [int]$Count = 16
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
if (-not ("ZaMonsterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.IO; using System.IO.Compression; using System.Runtime.InteropServices;
public sealed class ZaMonsterLib : IDisposable {
  private readonly FileStream stream; private readonly BinaryReader reader; private readonly int[] offsets;
  public ZaMonsterLib(string path) { stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite); reader = new BinaryReader(stream); int version = reader.ReadInt32(); int count = reader.ReadInt32(); if (version >= 3) reader.ReadInt32(); offsets = new int[count]; for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32(); }
  public ZaMonsterImage ReadImage(int index) { if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null; stream.Position = offsets[index]; short w = reader.ReadInt16(); short h = reader.ReadInt16(); short ox = reader.ReadInt16(); short oy = reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); byte shadow = reader.ReadByte(); int len = reader.ReadInt32(); bool hasMask = (shadow >> 7) == 1; if (w <= 0 || h <= 0 || len <= 0) return null; byte[] compressed = reader.ReadBytes(len); if (hasMask) { reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); reader.ReadInt16(); int maskLen = reader.ReadInt32(); reader.ReadBytes(maskLen); } byte[] raw; using (var input = new MemoryStream(compressed)) using (var gzip = new GZipStream(input, CompressionMode.Decompress)) using (var output = new MemoryStream()) { gzip.CopyTo(output); raw = output.ToArray(); } if (raw.Length < w * h * 4) return null; Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb); BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb); try { for (int y = 0; y < h; y++) Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4); } finally { bitmap.UnlockBits(data); } return new ZaMonsterImage(bitmap, ox, oy); }
  public void Dispose() { reader.Dispose(); stream.Dispose(); }
}
public sealed class ZaMonsterImage : IDisposable { public Bitmap Bitmap { get; private set; } public short OffsetX { get; private set; } public short OffsetY { get; private set; } public ZaMonsterImage(Bitmap bitmap, short offsetX, short offsetY) { Bitmap = bitmap; OffsetX = offsetX; OffsetY = offsetY; } public void Dispose() { Bitmap.Dispose(); } }
"@
}

$crystalDeg = @(-90,-67.5,-45,-22.5,0,22.5,45,67.5,90,112.5,135,157.5,180,-157.5,-135,-112.5)
$monsterLib = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
$reader = [ZaMonsterLib]::new((Resolve-Path $monsterLib))
try {
  for ($dir = 0; $dir -lt $Count; $dir++) {
    $frame = $Start + $dir
    $img = $reader.ReadImage($frame)
    if ($null -eq $img) { continue }
    $bmp = $img.Bitmap
    $sumX = 0.0; $sumY = 0.0; $n = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
      for ($x = 0; $x -lt $bmp.Width; $x++) {
        if ($bmp.GetPixel($x, $y).A -gt 16) {
          $sumX += $x; $sumY += $y; $n++
        }
      }
    }
    $cx = if ($n -gt 0) { $sumX / $n } else { $img.Bitmap.Width / 2.0 }
    $cy = if ($n -gt 0) { $sumY / $n } else { $img.Bitmap.Height / 2.0 }
    $dx = $cx - [double]$img.OffsetX
    $dy = $cy - [double]$img.OffsetY
    $deg = [Math]::Atan2($dy, $dx) * 180 / [Math]::PI
    Write-Host ("dir {0,2} frame {1,3}: tip vector ({2,6:F1},{3,6:F1}) => {4,7:F1} deg  crystal={5,7:F1}" -f $dir, $frame, $dx, $dy, $deg, $crystalDeg[$dir])
    $img.Dispose()
  }
}
finally { $reader.Dispose() }
