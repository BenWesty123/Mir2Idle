param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data",
  [string]$OutputRoot = "",
  [int]$Direction = 6
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

function Get-MonsterLibActionFrames {
  param([string]$LibraryPath)

  $actionNames = @{
    0  = "standing"
    1  = "walking"
    9  = "attack1"
    18 = "struck"
    21 = "die"
    22 = "dead"
    24 = "show"
    25 = "hide"
    28 = "revive"
  }

  $fs = [System.IO.File]::OpenRead($LibraryPath)
  $br = New-Object System.IO.BinaryReader($fs)
  try {
    $null = $br.ReadInt32()
    $null = $br.ReadInt32()
    $frameSeek = $br.ReadInt32()
    $fs.Seek($frameSeek, [System.IO.SeekOrigin]::Begin) | Out-Null
    $frameCount = $br.ReadInt32()
    $actions = [ordered]@{}
    for ($i = 0; $i -lt $frameCount; $i++) {
      $action = [int]$br.ReadByte()
      $start = $br.ReadInt32()
      $count = $br.ReadInt32()
      $skip = $br.ReadInt32()
      $interval = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $null = $br.ReadInt32()
      $reverse = $br.ReadBoolean()
      $null = $br.ReadBoolean()
      if (-not $actionNames.ContainsKey($action)) { continue }
      $actions[$actionNames[$action]] = @{
        start = $start
        count = $count
        offset = $count + $skip
        interval = $interval
        reverse = $reverse
      }
    }
    return $actions
  }
  finally {
    $br.Close()
    $fs.Close()
  }
}

function Export-StandingThumb {
  param(
    [int]$ImageIndex,
    [string]$OutputPath,
    [int]$CanvasW = 220,
    [int]$CanvasH = 200
  )

  $library = Join-Path $DataRoot ("Monster\{0:D3}.Lib" -f $ImageIndex)
  if (-not (Test-Path -LiteralPath $library)) { return $false }

  $actions = Get-MonsterLibActionFrames -LibraryPath $library
  $spec = $actions.standing
  if (-not $spec) { $spec = ($actions.GetEnumerator() | Select-Object -First 1).Value }
  if (-not $spec) { return $false }

  $srcFrame = if ($spec.reverse) { $spec.start } else { $spec.start + ($Direction * $spec.offset) }

  $lib = [BossGalleryMonsterLib]::new((Resolve-Path $library))
  try {
    $image = $lib.ReadImage($srcFrame)
    if ($null -eq $image) { return $false }

    $canvas = New-Object System.Drawing.Bitmap $CanvasW, $CanvasH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $g.Clear([System.Drawing.Color]::FromArgb(255, 18, 17, 15))
      $anchorX = [Math]::Floor($CanvasW * 0.5) + $image.OffsetX
      $anchorY = [Math]::Floor($CanvasH * 0.78) + $image.OffsetY
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $g.DrawImage($image.Bitmap, $anchorX, $anchorY, $image.Bitmap.Width, $image.Bitmap.Height)
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

$dungeons = @(
  @{ order = 1;  dungeon = "Oma Cave / Natural Cave"; region = "Bichon Province"; bosses = @(
    @{ name = "Bone Elite"; level = 50; image = 26 },
    @{ name = "Oma King Spirit"; level = 60; image = 126 }
  )},
  @{ order = 2;  dungeon = "Dead Mine"; region = "Bichon Province"; bosses = @(
    @{ name = "Ghoul"; level = 50; image = 74 }
  )},
  @{ order = 3;  dungeon = "Sabuk Tomb"; region = "Mongchon Province"; bosses = @(
    @{ name = "Zombie51 (no dedicated boss)"; level = 25; image = 73 }
  )},
  @{ order = 4;  dungeon = "Mineral Mines"; region = "Tao Village"; bosses = @(
    @{ name = "Great Ghoul"; level = 40; image = 74 }
  )},
  @{ order = 5;  dungeon = "Insect Cave"; region = "Woomyon Woods"; bosses = @(
    @{ name = "Khazard"; level = 50; image = 86 },
    @{ name = "Great Fox Spirit"; level = 60; image = 134 }
  )},
  @{ order = 6;  dungeon = "Stone Tomb / Lost Cave"; region = "Mongchon Province"; bosses = @(
    @{ name = "Evil Snake"; level = 50; image = 49 },
    @{ name = "White Boar"; level = 50; image = 48 }
  )},
  @{ order = 7;  dungeon = "Wooma Temple"; region = "Woomyon Woods"; bosses = @(
    @{ name = "Wooma Taurus"; level = 60; image = 34 }
  )},
  @{ order = 8;  dungeon = "Bug Cave"; region = "Mongchon Province"; bosses = @(
    @{ name = "Evil Centipede"; level = 99; image = 41 }
  )},
  @{ order = 9;  dungeon = "Prajna Stone Cave"; region = "Prajna Island"; bosses = @(
    @{ name = "Bone Lord"; level = 60; image = 93 }
  )},
  @{ order = 10; dungeon = "Zuma Temple"; region = "Mongchon Province"; bosses = @(
    @{ name = "Red Thunder Zuma"; level = 54; image = 67 },
    @{ name = "Zuma Taurus"; level = 60; image = 68 }
  )},
  @{ order = 11; dungeon = "Prajna Temple"; region = "Prajna Island"; bosses = @(
    @{ name = "Minotaur King"; level = 60; image = 101 }
  )},
  @{ order = 12; dungeon = "Fox Cave"; region = "Mongchon Province"; bosses = @(
    @{ name = "Red Fox Man"; level = 55; image = 128 }
  )},
  @{ order = 13; dungeon = "Ancient Stone Temple"; region = "Ancient Caves"; bosses = @(
    @{ name = "Ancient King Hog"; level = 80; image = 76 }
  )},
  @{ order = 14; dungeon = "Ancient Prajna Cave"; region = "Ancient Caves"; bosses = @(
    @{ name = "Ancient Bone Lord"; level = 60; image = 93 }
  )},
  @{ order = 15; dungeon = "Ancient Zuma Temple"; region = "Ancient Caves"; bosses = @(
    @{ name = "Ancient Zuma Taurus"; level = 100; image = 68 }
  )},
  @{ order = 16; dungeon = "Black Dragon Dungeon"; region = "Castle Gi-Ryoong"; bosses = @(
    @{ name = "King Scorpion"; level = 70; image = 75 },
    @{ name = "Dark Devil"; level = 70; image = 77 }
  )},
  @{ order = 17; dungeon = "Red Valley"; region = "Tao Village"; bosses = @(
    @{ name = "Red Moon Evil"; level = 60; image = 62 }
  )},
  @{ order = 18; dungeon = "Lunar Cave"; region = "Tao Village"; bosses = @(
    @{ name = "Flying Statue"; level = 80; image = 202 },
    @{ name = "Stoning Statue"; level = 80; image = 201 }
  )},
  @{ order = 19; dungeon = "Viper Cave"; region = "Serpent Valley"; bosses = @(
    @{ name = "Guardian Viper"; level = 55; image = 114 },
    @{ name = "Yimoogi"; level = 70; image = 113 }
  )},
  @{ order = 20; dungeon = "Oma Valley"; region = "Past Bichon"; bosses = @(
    @{ name = "Oma King"; level = 60; image = 126 }
  )},
  @{ order = 21; dungeon = "Hell Cavern"; region = "Wasteland"; bosses = @(
    @{ name = "Hell Keeper"; level = 60; image = 218 },
    @{ name = "Witch Doctor"; level = 60; image = 220 }
  )},
  @{ order = 22; dungeon = "Dead Forest Ruins"; region = "Dead Forest"; bosses = @(
    @{ name = "White Mammoth"; level = 60; image = 267 }
  )},
  @{ order = 23; dungeon = "Swamp (Tucson)"; region = "Mongchon Province"; bosses = @(
    @{ name = "Tucson General"; level = 100; image = 296 }
  )},
  @{ order = 24; dungeon = "Ancient Wooma Temple"; region = "Ancient Caves"; bosses = @(
    @{ name = "Ancient Wooma Taurus"; level = 105; image = 34 }
  )},
  @{ order = 25; dungeon = "Troll Mine"; region = "Seokcho Valley"; bosses = @(
    @{ name = "General Meow Meow"; level = 80; image = 284 }
  )},
  @{ order = 26; dungeon = "Ancient Natural Cave"; region = "Ancient Caves"; bosses = @(
    @{ name = "Ancient Bone Elite"; level = 99; image = 26 }
  )},
  @{ order = 27; dungeon = "Evil Mir Lair"; region = "Past Bichon"; bosses = @(
    @{ name = "Evil Mir"; level = 99; image = 900; missing = $true }
  )},
  @{ order = 28; dungeon = "Red Cavern"; region = "Wasteland"; bosses = @(
    @{ name = "Dream Devourer"; level = 100; image = 163 },
    @{ name = "Dark Devourer"; level = 100; image = 159 }
  )}
)

$resolvedOut = if ($OutputRoot) { $OutputRoot } else { Join-Path $PSScriptRoot "..\tile-review\dungeon-boss-gallery" }
$resolvedOut = [System.IO.Path]::GetFullPath($resolvedOut)
New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null
$imageRoot = Join-Path $resolvedOut "images"

$cards = @()
foreach ($entry in $dungeons) {
  foreach ($boss in $entry.bosses) {
    $slug = ($boss.name -replace '[^a-zA-Z0-9]+', '-').Trim('-').ToLower()
    $fileName = "boss-$($entry.order.ToString('00'))-$slug.png"
    $outPath = Join-Path $imageRoot $fileName
    $exported = $false
    if (-not $boss.missing) {
      $exported = Export-StandingThumb -ImageIndex $boss.image -OutputPath $outPath
    }
    $cards += [pscustomobject]@{
      order = $entry.order
      dungeon = $entry.dungeon
      region = $entry.region
      boss = $boss.name
      level = $boss.level
      image = $boss.image
      file = if ($exported) { "images/$fileName" } else { $null }
      missing = [bool]($boss.missing -or -not $exported)
    }
  }
}

$metaObj = [pscustomobject]@{
  generated = (Get-Date).ToString("o")
  direction = $Direction
  cards = $cards
}
$metaObj | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $resolvedOut "gallery.json") -Encoding UTF8

$html = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Crystal Dungeon Boss Gallery</title>
  <style>
    :root { --bg:#12110f; --panel:#1e1c18; --border:#3a342c; --text:#e8dcc8; --muted:#9a8f7e; --accent:#c9a24d; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:13px/1.45 "Segoe UI", Tahoma, sans-serif; }
    header { position:sticky; top:0; z-index:5; background:#181612; border-bottom:1px solid var(--border); padding:14px 18px; }
    header h1 { margin:0 0 4px; font-size:18px; color:var(--accent); }
    header p { margin:0; color:var(--muted); font-size:12px; }
    main { padding:16px 18px 40px; max-width:1800px; }
    section { margin-bottom:28px; }
    section h2 { margin:0 0 4px; font-size:16px; color:var(--accent); }
    section .region { color:var(--muted); font-size:12px; margin-bottom:10px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:12px; }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
    .thumb { height:200px; display:flex; align-items:flex-end; justify-content:center; background:#12110f; border-bottom:1px solid var(--border); }
    .thumb img { image-rendering:pixelated; image-rendering:crisp-edges; max-width:100%; max-height:100%; object-fit:contain; }
    .thumb .missing { color:#ffb4b4; font-size:12px; padding:20px; text-align:center; }
    .meta { padding:10px 12px; }
    .meta h3 { margin:0 0 4px; font-size:14px; }
    .meta p { margin:0; color:var(--muted); font-size:12px; }
  </style>
</head>
<body>
  <header>
    <h1>Crystal Dungeon Boss Gallery</h1>
    <p>Standing pose · direction 6 · exported from Crystal Monster/*.Lib</p>
  </header>
  <main id="app"></main>
  <script>
    async function main() {
      const data = await fetch('./gallery.json').then(r => r.json());
      const byDungeon = new Map();
      for (const card of data.cards) {
        const key = card.order + '|' + card.dungeon;
        if (!byDungeon.has(key)) byDungeon.set(key, { order: card.order, dungeon: card.dungeon, region: card.region, bosses: [] });
        byDungeon.get(key).bosses.push(card);
      }
      const app = document.getElementById('app');
      for (const group of [...byDungeon.values()].sort((a,b) => a.order - b.order)) {
        const section = document.createElement('section');
        section.innerHTML = `<h2>${group.order}. ${group.dungeon}</h2><div class="region">${group.region}</div>`;
        const grid = document.createElement('div');
        grid.className = 'grid';
        for (const boss of group.bosses) {
          const card = document.createElement('article');
          card.className = 'card';
          const thumb = document.createElement('div');
          thumb.className = 'thumb';
          if (boss.file) {
            const img = document.createElement('img');
            img.src = boss.file;
            img.alt = boss.boss;
            thumb.append(img);
          } else {
            thumb.innerHTML = `<div class="missing">Sprite missing<br/>Monster ${boss.image}.Lib not in client data</div>`;
          }
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.innerHTML = `<h3>${boss.boss}</h3><p>Lv ${boss.level} · Monster image ${boss.image}</p>`;
          card.append(thumb, meta);
          grid.append(card);
        }
        section.append(grid);
        app.append(section);
      }
    }
    main();
  </script>
</body>
</html>
'@
Set-Content -Path (Join-Path $resolvedOut "index.html") -Value $html -Encoding UTF8

Write-Output "Exported $($cards.Count) boss cards to $resolvedOut"
