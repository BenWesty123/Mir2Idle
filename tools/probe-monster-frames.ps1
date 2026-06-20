param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [int]$Index = 64,
  [int]$Start = 220,
  [int]$End = 280
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
$monsterLib = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $Index)
$reader = [ZaMonsterLib]::new((Resolve-Path $monsterLib))
try {
  for ($i = $Start; $i -le $End; $i++) {
    $img = $reader.ReadImage($i)
    if ($img) {
      Write-Host ("{0}: {1}x{2} ox={3} oy={4}" -f $i, $img.Bitmap.Width, $img.Bitmap.Height, $img.OffsetX, $img.OffsetY)
      $img.Dispose()
    }
  }
}
finally { $reader.Dispose() }
