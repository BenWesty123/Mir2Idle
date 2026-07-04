param(
  [string]$DataRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  [string]$OutputRoot = "../tile-review/crafting-cube-sprite-candidates"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("CrystalNpcTileLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

public sealed class CrystalNpcTileLib : IDisposable
{
    private readonly FileStream stream;
    private readonly BinaryReader reader;
    private readonly int[] offsets;
    public int Count { get { return offsets.Length; } }

    public CrystalNpcTileLib(string path)
    {
        stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        reader = new BinaryReader(stream);
        int version = reader.ReadInt32();
        int count = reader.ReadInt32();
        if (version >= 3) reader.ReadInt32();
        offsets = new int[count];
        for (int i = 0; i < count; i++) offsets[i] = reader.ReadInt32();
    }

    public CrystalNpcTileImage ReadImage(int index)
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

        return new CrystalNpcTileImage(bitmap, ox, oy);
    }

    public void Dispose()
    {
        reader.Dispose();
        stream.Dispose();
    }
}

public sealed class CrystalNpcTileImage : IDisposable
{
    public Bitmap Bitmap { get; private set; }
    public short OffsetX { get; private set; }
    public short OffsetY { get; private set; }

    public CrystalNpcTileImage(Bitmap bitmap, short offsetX, short offsetY)
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

$candidates = @(
  @{ id = "mysterious-pillar-76"; label = "MysteriousPillar"; source = "NPC/76.Lib"; db = "MysteriousPillar, StrangePillar, WierdPillar, TrollMine/Pillar"; recommended = $true },
  @{ id = "pillar-77"; label = "Pillar"; source = "NPC/77.Lib"; db = "TaoistVillage/TreePath/Pillar" },
  @{ id = "gm-stone-12"; label = "GM_Stone"; source = "NPC/12.Lib"; db = "GM/GM-Stone" },
  @{ id = "timestone-33"; label = "TimeStone"; source = "NPC/33.Lib"; db = "PrajnaIsland/Timestone" },
  @{ id = "timestone-34"; label = "TimeStone"; source = "NPC/34.Lib"; db = "PastBichon/Timestone" },
  @{ id = "mysterious-stone-79"; label = "MysteriousStone (teleport)"; source = "NPC/79.Lib"; db = "OmaCave/Stone - used in game"; inUse = $true },
  @{ id = "mysterious-stone-80"; label = "MysteriousStone alt"; source = "NPC/80.Lib"; db = "WoomaTemple/Stone" }
)

$root = Join-Path $PSScriptRoot $OutputRoot
New-Item -ItemType Directory -Force -Path $root | Out-Null
$dataRootResolved = Resolve-Path $DataRoot

function Export-NpcLibTiles($candidate) {
  $outDir = Join-Path $root $candidate.id
  $imageDir = Join-Path $outDir "images"
  New-Item -ItemType Directory -Force -Path $imageDir | Out-Null

  $libPath = Join-Path $dataRootResolved $candidate.source
  if (-not (Test-Path -LiteralPath $libPath)) {
    return @{ exported = 0; skipped = $true }
  }

  $tiles = New-Object System.Collections.Generic.List[object]
  $lib = [CrystalNpcTileLib]::new($libPath)
  try {
    for ($frame = 0; $frame -lt $lib.Count; $frame++) {
      $image = $lib.ReadImage($frame)
      if ($null -eq $image) { continue }
      try {
        $bitmap = $image.Bitmap
        if ($bitmap.Width -lt 8 -or $bitmap.Height -lt 8) { continue }
        if ($bitmap.Width -gt 320 -or $bitmap.Height -gt 360) { continue }
        $file = "images/frame_{0:D6}.png" -f $frame
        $bitmap.Save((Join-Path $outDir $file), [System.Drawing.Imaging.ImageFormat]::Png)
        $tiles.Add([ordered]@{
          frame = $frame
          file = $file
          width = $bitmap.Width
          height = $bitmap.Height
          offsetX = $image.OffsetX
          offsetY = $image.OffsetY
        })
      }
      finally {
        $image.Dispose()
      }
    }
  }
  finally {
    $lib.Dispose()
  }

  [ordered]@{
    frameCount = $lib.Count
    exported = $tiles.Count
    source = $candidate.source
    tiles = $tiles
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outDir "tiles.json")

  return @{ exported = $tiles.Count; skipped = $false }
}

$sections = foreach ($candidate in $candidates) {
  $result = Export-NpcLibTiles $candidate
  if ($result.skipped) { continue }
  $jsonPath = Join-Path $root (Join-Path $candidate.id "tiles.json")
  $data = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
  $cards = foreach ($tile in $data.tiles) {
    $file = "$($candidate.id)/$($tile.file)"
    $pick = if ($tile.frame -eq 0) { " pick" } else { "" }
    @"
        <article class="tile$pick">
          <img src="$file" alt="$($candidate.label) frame $($tile.frame)" loading="lazy" />
          <strong>Frame $($tile.frame)</strong>
          <span>$($tile.width)x$($tile.height), offset $($tile.offsetX), $($tile.offsetY)</span>
        </article>
"@
  }
  $badge = if ($candidate.inUse) { '<span class="badge in-use">In game (teleport)</span>' }
           elseif ($candidate.recommended) { '<span class="badge rec">Top pick</span>' }
           else { "" }
  @"
    <section>
      <header class="section-head">
        <div>
          <h2>$($candidate.label) $badge</h2>
          <p>$($candidate.source) | $($candidate.db) | $($data.exported) visible frames</p>
        </div>
      </header>
      <div class="grid">
$($cards -join "`n")
      </div>
    </section>
"@
}

$html = @"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Crafting Cube - world sprite candidates</title>
    <style>
      body { margin: 0; background: #111; color: #eee; font: 13px Segoe UI, sans-serif; }
      .top { position: sticky; top: 0; z-index: 3; background: #181818; border-bottom: 1px solid #333; padding: 12px 16px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      h2 { margin: 0; font-size: 17px; color: #f1d095; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      p { margin: 0; color: #aaa; }
      section { padding: 14px 16px 18px; border-bottom: 1px solid #2d2d2d; }
      .section-head { margin-bottom: 10px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; }
      .tile { border: 1px solid #333; background: #1b1b1b; padding: 8px; display: grid; gap: 6px; }
      .tile.pick { border-color: #c9a227; box-shadow: 0 0 0 1px rgba(201,162,39,.2); }
      img { width: 112px; height: 112px; object-fit: contain; image-rendering: pixelated; background: #2a2418; justify-self: center; }
      strong, span { display: block; }
      span { color: #aaa; font-size: 11px; }
      .badge { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 3px 8px; border-radius: 999px; }
      .badge.rec { background: rgba(201,162,39,.15); color: #e8c85a; }
      .badge.in-use { background: rgba(80,140,220,.15); color: #8ec5ff; }
      .note { margin-top: 8px; max-width: 80ch; line-height: 1.5; }
      code { color: #d8b4fe; }
    </style>
  </head>
  <body>
    <header class="top">
      <h1>Crafting Cube - world sprite candidates</h1>
      <p class="note">
        Town interactables like the <strong>Mysterious Stone</strong> are not human NPCs - they use
        <code>TOWN_NPCS</code> + a single-frame atlas in <code>public/npcs/{id}/</code> exported from a Crystal
        <code>NPC/*.Lib</code>. Frame 0 is highlighted in gold when it is the usual standing/default pose.
      </p>
    </header>
$($sections -join "`n")
  </body>
</html>
"@

$html | Set-Content -LiteralPath (Join-Path $root "index.html")
Write-Output (Join-Path $root "index.html")
