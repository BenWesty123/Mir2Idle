param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$GalleryRoot = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("BossGalleryMonsterLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class BossGalleryMonsterLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public BossGalleryMonsterLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public BossGalleryMonsterImage ReadImage(int index)
    {
        if (index < 0 || index >= offsets.Length || offsets[index] <= 0) return null;
        stream.Position = offsets[index];
        short w = reader.ReadInt16();
        short h = reader.ReadInt16();
        short ox = reader.ReadInt16();
        short oy = reader.ReadInt16();
        reader.ReadInt16();
        reader.ReadInt16();
        byte shadow = reader.ReadByte();
        int len = reader.ReadInt32();
        bool hasMask = (shadow >> 7) == 1;
        if (w <= 0 || h <= 0 || len <= 0) return null;
        byte[] compressed = reader.ReadBytes(len);
        if (hasMask)
        {
            reader.ReadInt16();
            reader.ReadInt16();
            reader.ReadInt16();
            reader.ReadInt16();
            int maskLen = reader.ReadInt32();
            reader.ReadBytes(maskLen);
        }

        byte[] raw;
        using (var input = new MemoryStream(compressed))
        using (var gzip = new GZipStream(input, CompressionMode.Decompress))
        using (var output = new MemoryStream())
        {
            gzip.CopyTo(output);
            raw = output.ToArray();
        }
        if (raw.Length < w * h * 4) return null;

        Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try
        {
            for (int y = 0; y < h; y++)
                Marshal.Copy(raw, y * w * 4, data.Scan0 + y * data.Stride, w * 4);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }

        return new BossGalleryMonsterImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class BossGalleryMonsterImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public BossGalleryMonsterImage(Bitmap bitmap, short offsetX, short offsetY)
    {
        Bitmap = bitmap;
        OffsetX = offsetX;
        OffsetY = offsetY;
    }

    public void Dispose()
    {
        Bitmap.Dispose();
    }
}
"@
}

if (-not $GalleryRoot) {
  $GalleryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\tile-review\dungeon-boss-gallery"))
}

function Export-RawFrameThumb {
  param(
    [string]$LibraryPath,
    [int]$SrcFrame,
    [string]$OutputPath,
    [int]$CanvasW = 320,
    [int]$CanvasH = 280
  )

  if (-not (Test-Path -LiteralPath $LibraryPath)) { return $false }
  $lib = [BossGalleryMonsterLib]::new((Resolve-Path $LibraryPath))
  try {
    $image = $lib.ReadImage($SrcFrame)
    if ($null -eq $image) { return $false }
    $canvas = New-Object System.Drawing.Bitmap $CanvasW, $CanvasH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $g.Clear([System.Drawing.Color]::FromArgb(255, 18, 17, 15))
      $scale = [Math]::Min(1.0, [Math]::Min(($CanvasW - 20) / [Math]::Max(1, $image.Bitmap.Width), ($CanvasH - 20) / [Math]::Max(1, $image.Bitmap.Height)))
      $drawW = [Math]::Max(1, [int]($image.Bitmap.Width * $scale))
      $drawH = [Math]::Max(1, [int]($image.Bitmap.Height * $scale))
      $anchorX = [Math]::Floor($CanvasW * 0.5) + [int]($image.OffsetX * $scale) - [int]($drawW * 0.5)
      $anchorY = [Math]::Floor($CanvasH * 0.82) + [int]($image.OffsetY * $scale) - $drawH
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $g.DrawImage($image.Bitmap, $anchorX, $anchorY, $drawW, $drawH)
      New-Item -ItemType Directory -Force -Path (Split-Path $OutputPath -Parent) | Out-Null
      $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      return $true
    }
    finally {
      $g.Dispose()
      $canvas.Dispose()
      $image.Dispose()
    }
  }
  finally {
    $lib.Dispose()
  }
}

if ($MyInvocation.InvocationName -ne '.') {
$special = @(
  @{
    boss = "Great Fox Spirit"
    file = "images/boss-05-great-fox-spirit.png"
    library = Join-Path $DataRoot "Monster\134.Lib"
    frame = 318
  },
  @{
    boss = "Evil Mir"
    file = "images/boss-27-evil-mir.png"
    library = Join-Path $DataRoot "Dragon.Lib"
    frame = 60
  }
)

$metaPath = Join-Path $GalleryRoot "gallery.json"
$meta = Get-Content $metaPath -Raw | ConvertFrom-Json
$cards = @($meta.cards)

foreach ($entry in $special) {
  $outPath = Join-Path $GalleryRoot $entry.file
  $ok = Export-RawFrameThumb -LibraryPath $entry.library -SrcFrame $entry.frame -OutputPath $outPath
  Write-Output "$($entry.boss): $(if ($ok) { 'exported' } else { 'FAILED' }) from $(Split-Path $entry.library -Leaf) frame $($entry.frame)"
  for ($i = 0; $i -lt $cards.Count; $i++) {
    if ($cards[$i].boss -eq $entry.boss) {
      $cards[$i] = [pscustomobject]@{
        order = $cards[$i].order
        dungeon = $cards[$i].dungeon
        region = $cards[$i].region
        boss = $cards[$i].boss
        level = $cards[$i].level
        image = $cards[$i].image
        file = if ($ok) { $entry.file } else { $null }
        missing = -not $ok
      }
    }
  }
}

[pscustomobject]@{
  generated = (Get-Date).ToString("o")
  direction = $meta.direction
  cards = $cards
} | ConvertTo-Json -Depth 6 | Set-Content -Path $metaPath -Encoding UTF8
}
