// Export every Dragon.Lib frame (Evil Mir's library) as a PNG plus an index that
// records the library's OWN embedded FrameSet, so animations can be reviewed
// instead of inferred. Feeds tools/evil-mir-animations.html.
//
// Usage:
//   node tools/build-evil-mir-animation-reference.mjs [pathToDragon.Lib]
//
// Output (gitignored): tools/generated-data/evil-mir-anim/{index.json,<n>.png}
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, gunzipSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LIB = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data/Dragon.Lib";
const LIB_PATH = resolve(process.argv[2] ?? DEFAULT_LIB);
const OUT_DIR = join(HERE, "generated-data", "evil-mir-anim");

const MIR_ACTIONS = [
  "Standing", "Walking", "Running", "Pushed", "DashL", "DashR", "DashFail", "Stance", "Stance2",
  "Attack1", "Attack2", "Attack3", "Attack4", "Attack5",
  "AttackRange1", "AttackRange2", "AttackRange3", "Special", "Struck", "Harvest", "Spell",
  "Die", "Dead", "Skeleton", "Show", "Hide", "Stoned", "Appear", "Revive", "SitDown", "Mine",
  "Sneek", "DashAttack", "Lunge", "WalkingBow", "RunningBow", "Jump",
];

// Crystal MirDirection.
const DIRECTIONS = ["Up", "UpRight", "Right", "DownRight", "Down", "DownLeft", "Left", "UpLeft"];

// Blocks we can name with confidence, from Client/MirObjects/MonsterObject.cs.
// Anything not covered here still gets exported and shown as an unlabelled run.
const LABELLED_BLOCKS = [
  { from: 60, to: 67, label: "Attack1 head overlay", note: "Effect(Dragon, 60, 8) — drawn blended over the body" },
  { from: 68, to: 81, label: "Attack1 cast overlay", note: "Effect(Dragon, 68, 14) — the longer second overlay" },
  { from: 90, to: 99, label: "AttackRange1 overlay — Up", note: "Effect(Dragon, 90 + Direction*10, 10)" },
  { from: 100, to: 109, label: "AttackRange1 overlay — UpRight", note: "Effect(Dragon, 90 + Direction*10, 10)" },
  { from: 110, to: 119, label: "AttackRange1 overlay — Right", note: "What we ship: Direction 2" },
  { from: 180, to: 189, label: "Bolt projectile", note: "CreateProjectile(60, 10, 10, 0), stride 10 per direction" },
  { from: 200, to: 219, label: "Bolt impact burst", note: "20 frames" },
  { from: 230, to: 234, label: "Mass rain variant 1", note: "Attack1 spawns 8-14 of these around the party" },
  { from: 240, to: 244, label: "Mass rain variant 2", note: "" },
  { from: 250, to: 254, label: "Mass rain variant 3", note: "" },
  { from: 260, to: 264, label: "Mass rain variant 4", note: "" },
  { from: 270, to: 274, label: "Mass rain variant 5", note: "" },
  { from: 280, to: 284, label: "Unreferenced tall block", note: "~1250px — no client code path draws it" },
  { from: 300, to: 302, label: "DragonStatue standing", note: "Frames.cs: one frame per direction" },
  { from: 310, to: 319, label: "DragonStatue attack overlay — Up", note: "Effect(Dragon, 310 + (Direction/3)*20, 10)" },
  { from: 320, to: 322, label: "DragonStatue standing (alt)", note: "Frames.cs" },
  { from: 330, to: 339, label: "DragonStatue attack overlay — Right", note: "Effect(Dragon, 310 + (Direction/3)*20, 10)" },
  { from: 350, to: 384, label: "DragonStatue beam on target", note: "Effect(Dragon, 350, 35) — 35 frames, drawn on the victim" },
  { from: 400, to: 404, label: "MapLightning variant 1", note: "Spell.MapLightning + RedThunderZuma — a full-height strike pillar, NOT a body" },
  { from: 410, to: 414, label: "MapLightning variant 2", note: "Effect(Dragon, 400 + rand(3)*10, 5)" },
  { from: 420, to: 424, label: "MapLightning variant 3", note: "" },
  { from: 440, to: 459, label: "MapLava (base, unblended)", note: "Spell.MapLava — Effect(Dragon, 440, 20) { Blend = false }" },
  { from: 470, to: 479, label: "MapLava (blended overlay)", note: "Spell.MapLava — Effect(Dragon, 470, 10)" },
];

/* ---------- minimal PNG writer (no deps) ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- .Lib reader (mirrors tools/lib/phase-monster-lib.ps1) ---------- */

const lib = readFileSync(LIB_PATH);
let cursor = 0;
const readI32 = () => { const v = lib.readInt32LE(cursor); cursor += 4; return v; };

const version = readI32();
const imageCount = readI32();
const frameSeek = version >= 3 ? readI32() : 0;
const offsets = [];
for (let i = 0; i < imageCount; i++) offsets.push(readI32());

function readImage(index) {
  const at = offsets[index];
  if (!(at > 0)) return null;
  let p = at;
  const w = lib.readInt16LE(p); p += 2;
  const h = lib.readInt16LE(p); p += 2;
  const ox = lib.readInt16LE(p); p += 2;
  const oy = lib.readInt16LE(p); p += 2;
  p += 4; // two unused shorts
  p += 1; // shadow byte (high bit = has mask, which we do not need)
  const len = lib.readInt32LE(p); p += 4;
  if (w <= 0 || h <= 0 || len <= 0) return null;

  let raw;
  try { raw = gunzipSync(lib.subarray(p, p + len)); }
  catch { return null; }
  if (raw.length < w * h * 4) return null;

  // GDI+ Format32bppArgb is B,G,R,A in memory; PNG wants R,G,B,A.
  const rgba = Buffer.alloc(w * h * 4);
  let opaque = 0;
  for (let i = 0; i < w * h; i++) {
    const s = i * 4;
    const a = raw[s + 3];
    rgba[s] = raw[s + 2];
    rgba[s + 1] = raw[s + 1];
    rgba[s + 2] = raw[s];
    rgba[s + 3] = a;
    if (a > 8) opaque++;
  }
  return { w, h, ox, oy, opaque, rgba };
}

/* ---------- embedded FrameSet ---------- */

const declared = [];
if (version >= 3 && frameSeek > 0) {
  cursor = frameSeek;
  const frameCount = readI32();
  for (let i = 0; i < frameCount; i++) {
    const action = lib.readUInt8(cursor); cursor += 1;
    const f = {
      action: MIR_ACTIONS[action] ?? `#${action}`,
      start: readI32(), count: readI32(), skip: readI32(), interval: readI32(),
      effectStart: readI32(), effectCount: readI32(), effectSkip: readI32(), effectInterval: readI32(),
    };
    f.reverse = lib.readUInt8(cursor) === 1; cursor += 1;
    f.blend = lib.readUInt8(cursor) === 1; cursor += 1;
    f.stride = f.count + f.skip; // client: Start + stride*Direction + FrameIndex
    declared.push(f);
  }
}

/* ---------- export ---------- */

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const frames = {};
let written = 0;
let bytes = 0;
for (let i = 0; i < imageCount; i++) {
  const img = readImage(i);
  if (!img) continue;
  // 4x1 padding stubs sit between direction blocks; keep them out of the page.
  const stub = img.w <= 8 && img.h <= 8;
  if (stub || img.opaque === 0) {
    frames[i] = { stub: true, w: img.w, h: img.h };
    continue;
  }
  const png = encodePng(img.w, img.h, img.rgba);
  writeFileSync(join(OUT_DIR, `${i}.png`), png);
  written++;
  bytes += png.length;
  // Every confirmed head frame sits on the same baseline (oy + h === 158) and is
  // ~320px+ wide. Flagging that makes any unused head animation elsewhere in the
  // 527 slots jump out instead of hiding among the FX and the giant body frames.
  const bottom = img.oy + img.h;
  frames[i] = {
    file: `${i}.png`,
    w: img.w, h: img.h, ox: img.ox, oy: img.oy,
    bottom,
    opaque: img.opaque,
    headLike: bottom === 158 && img.w >= 300,
  };
}

// Frames owned by direction-independent clips. A directional clip must not walk
// into them: AttackRange1 has stride 10 from 10, so "direction 3" would be 40..45,
// which is really Struck + Attack1. Those frames all decode fine, so a
// drawable-only test wrongly reports 7 direction blocks instead of 3.
const claimedByFixedClips = new Set();
for (const f of declared) {
  if (f.stride !== 0) continue;
  for (let n = 0; n < f.count; n++) claimedByFixedClips.add(f.start + n);
}

// Expand each declared clip over the directions its stride actually reaches.
const clips = [];
for (const f of declared) {
  const variants = [];
  const maxDirections = f.stride > 0 ? DIRECTIONS.length : 1;
  for (let d = 0; d < maxDirections; d++) {
    const list = [];
    for (let n = 0; n < f.count; n++) list.push(f.start + f.stride * d + n);
    if (!list.every((idx) => frames[idx] && !frames[idx].stub)) break;
    if (f.stride > 0 && list.some((idx) => claimedByFixedClips.has(idx))) break;
    // Real direction blocks are padded out to the stride with 4x1 stubs.
    const padding = [];
    for (let n = f.count; n < f.stride; n++) padding.push(f.start + f.stride * d + n);
    variants.push({
      direction: f.stride > 0 ? DIRECTIONS[d] : null,
      directionIndex: f.stride > 0 ? d : null,
      frames: list,
      paddedToStride: padding.length > 0 && padding.every((idx) => frames[idx]?.stub),
    });
  }
  clips.push({ ...f, variants });
}

// Mark what the frame table actually points at. Anything head-sized and NOT
// referenced is a clip the animators drew that Crystal never wires up — which is
// how frames 50..59 (a second idle, same height profile as Standing 0..9) surface.
for (const c of clips) {
  for (const v of c.variants) {
    for (const idx of v.frames) {
      if (frames[idx]) frames[idx].referenced = true;
    }
  }
}
const unreferencedHeadFrames = Object.entries(frames)
  .filter(([, f]) => f.headLike && !f.referenced)
  .map(([k]) => Number(k))
  .sort((a, b) => a - b);

// Contiguous runs of exported frames, so nothing in the lib is hidden.
const runs = [];
let run = null;
for (let i = 0; i < imageCount; i++) {
  const drawable = frames[i] && !frames[i].stub;
  if (drawable) {
    if (!run) { run = { from: i, to: i }; runs.push(run); }
    else run.to = i;
  } else if (run && i > run.to + 1) {
    run = null;
  } else if (!drawable) {
    run = null;
  }
}
for (const r of runs) {
  const hit = LABELLED_BLOCKS.find((b) => b.from <= r.from && r.to <= b.to)
    ?? LABELLED_BLOCKS.find((b) => b.from === r.from);
  r.label = hit?.label ?? null;
  r.note = hit?.note ?? "";
}

const payload = {
  lib: LIB_PATH, version, imageCount, frameSeek,
  generatedAt: new Date().toISOString(),
  directions: DIRECTIONS,
  clips, runs, labelledBlocks: LABELLED_BLOCKS, unreferencedHeadFrames, frames,
};
writeFileSync(join(OUT_DIR, "index.json"), `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(join(OUT_DIR, "index.html"), renderHtml(payload));

/* ---------- viewer page ----------
   The data is inlined so the page opens straight off disk (no dev server, no
   fetch/file:// problems). Images are plain relative <img> src in the same folder.
   Frames are absolutely positioned by their real offsetX/offsetY inside a shared
   clip-sized box, so playback matches how the client draws them. */
function renderHtml(data) {
  const CSS = String.raw`
:root{--bg:#100e0c;--panel:#1a1612;--line:#3d3226;--text:#e8dcc4;--muted:#9a8b72;
--gold:#e0c48a;--warn:#e07a5f;--good:#7dcea0;--info:#6ea8fe}
*{box-sizing:border-box}
body{margin:0;font:14px/1.45 "Segoe UI",system-ui,sans-serif;color:var(--text);min-height:100vh;
background:radial-gradient(1200px 600px at 10% -10%,#2a2118 0,transparent 55%),
radial-gradient(900px 500px at 100% 0,#1a2430 0,transparent 50%),var(--bg)}
header{padding:26px 24px 14px;border-bottom:1px solid var(--line);background:rgba(0,0,0,.28)}
h1{margin:0 0 6px;font-size:27px;color:var(--gold);letter-spacing:.02em}
h2{margin:34px 0 4px;font-size:19px;color:var(--gold);border-bottom:1px solid var(--line);padding-bottom:6px}
p.note{margin:0 0 8px;color:var(--muted);max-width:105ch}
code{color:var(--gold);font-family:Consolas,ui-monospace,monospace}
main{padding:18px 24px 60px;max-width:1500px;margin:0 auto}
.toolbar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:14px 0 6px;padding:10px 14px;
background:var(--panel);border:1px solid var(--line);border-radius:8px;position:sticky;top:0;z-index:5}
.toolbar label{display:flex;gap:7px;align-items:center;color:var(--muted)}
.toolbar input[type=range]{width:150px}
button{font:inherit;color:var(--text);background:#2a2218;border:1px solid var(--line);
border-radius:6px;padding:5px 11px;cursor:pointer}
button:hover{border-color:var(--gold);color:var(--gold)}
.grid{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;align-items:flex-start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;min-width:240px}
.card.flagged{border-color:var(--warn);box-shadow:0 0 0 1px rgba(224,122,95,.25)}
.card h3{margin:0 0 2px;font-size:15px;color:var(--gold)}
.card .sub{color:var(--muted);font-size:12px;margin-bottom:9px;font-family:Consolas,monospace;word-break:break-all}
.tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid var(--line);
color:var(--muted);margin:0 4px 4px 0}
.tag.warn{color:var(--warn);border-color:var(--warn)}
.tag.good{color:var(--good);border-color:var(--good)}
.tag.info{color:var(--info);border-color:var(--info)}
.stage{position:relative;margin:6px auto 8px;border:1px solid var(--line);border-radius:6px;overflow:hidden;
background:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px) 0 0/100% 24px,#0b0a09}
.stage .baseline{position:absolute;left:0;right:0;border-top:1px dashed rgba(224,196,138,.45)}
.stage img{position:absolute;image-rendering:pixelated;display:none}
.stage img.on{display:block}
.film{display:flex;flex-wrap:wrap;gap:6px}
.film figure{margin:0;text-align:center}
.film img{display:block;background:#0b0a09;border:1px solid var(--line);border-radius:4px;image-rendering:pixelated}
.film figcaption{font:11px Consolas,monospace;color:var(--muted);margin-top:2px}
.film figure.cur img{border-color:var(--gold)}
.empty{color:var(--warn)}`;

  const JS = String.raw`
var D = window.__EVILMIR__;
var out = document.getElementById('out');
var players = [];
document.getElementById('meta').textContent =
  'v' + D.version + ' \u00b7 ' + D.imageCount + ' slots \u00b7 ' + D.clips.length + ' declared clips';

function stageFor(ids, intervalMs) {
  var fr = [];
  for (var i = 0; i < ids.length; i++) {
    var m = D.frames[ids[i]];
    if (m && !m.stub) fr.push({ id: ids[i], m: m });
  }
  if (!fr.length) return null;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  fr.forEach(function (f) {
    minX = Math.min(minX, f.m.ox); minY = Math.min(minY, f.m.oy);
    maxX = Math.max(maxX, f.m.ox + f.m.w); maxY = Math.max(maxY, f.m.oy + f.m.h);
  });
  var stage = document.createElement('div');
  stage.className = 'stage';
  stage.dataset.w = maxX - minX;
  stage.dataset.h = maxY - minY;
  var base = document.createElement('div');
  base.className = 'baseline';
  base.dataset.top = 158 - minY;
  stage.appendChild(base);
  var imgs = fr.map(function (f) {
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.src = f.m.file;
    img.dataset.x = f.m.ox - minX; img.dataset.y = f.m.oy - minY;
    img.dataset.w = f.m.w; img.dataset.h = f.m.h;
    stage.appendChild(img);
    return img;
  });
  var p = { stage: stage, imgs: imgs, fr: fr, interval: Math.max(16, intervalMs), i: 0, acc: 0, film: null };
  players.push(p);
  return p;
}

function filmFor(p) {
  var film = document.createElement('div');
  film.className = 'film';
  p.fr.forEach(function (f) {
    var fig = document.createElement('figure');
    var img = document.createElement('img');
    img.loading = 'lazy'; img.src = f.m.file;
    img.dataset.w = f.m.w; img.dataset.h = f.m.h;
    var cap = document.createElement('figcaption');
    cap.textContent = f.id + ' \u00b7 ' + f.m.w + '\u00d7' + f.m.h;
    fig.appendChild(img); fig.appendChild(cap); film.appendChild(fig);
  });
  p.film = film;
  return film;
}

function card(o) {
  var el = document.createElement('div');
  el.className = 'card' + (o.flagged ? ' flagged' : '');
  var h = document.createElement('h3'); h.textContent = o.title;
  var s = document.createElement('div'); s.className = 'sub'; s.textContent = o.sub;
  el.appendChild(h); el.appendChild(s);
  (o.tags || []).forEach(function (t) {
    var tag = document.createElement('span');
    tag.className = 'tag ' + (t.kind || ''); tag.textContent = t.text;
    el.appendChild(tag);
  });
  var p = stageFor(o.ids, o.interval);
  if (!p) {
    var q = document.createElement('p'); q.className = 'empty'; q.textContent = 'no drawable frames';
    el.appendChild(q); return el;
  }
  el.appendChild(p.stage); el.appendChild(filmFor(p));
  return el;
}

function section(title, note) {
  var h = document.createElement('h2'); h.textContent = title; out.appendChild(h);
  if (note) { var p = document.createElement('p'); p.className = 'note'; p.innerHTML = note; out.appendChild(p); }
  var g = document.createElement('div'); g.className = 'grid'; out.appendChild(g);
  return g;
}

var g1 = section('Declared clips (from the library\u2019s own FrameSet)',
  'The only animations Crystal will ever play for this monster. <code>stride = count + skip</code> '
  + 'is the per-direction step; stride 0 means direction-independent. We render '
  + '<strong>Direction 2 (Right)</strong>. Dashed line is the shared <code>oy + h = 158</code> baseline.');
D.clips.forEach(function (c) {
  c.variants.forEach(function (v) {
    var tags = [];
    if (c.reverse) tags.push({ text: 'Reverse = true', kind: 'warn' });
    if (c.blend) tags.push({ text: 'blend', kind: 'info' });
    if (v.directionIndex === 2) tags.push({ text: 'shipped direction', kind: 'good' });
    if (c.stride > 0) tags.push({ text: 'stride ' + c.stride, kind: 'info' });
    if (v.paddedToStride) tags.push({ text: 'padded with stubs', kind: '' });
    g1.appendChild(card({
      title: c.action + (v.direction ? ' \u2014 ' + v.direction + ' (' + v.directionIndex + ')' : ''),
      sub: 'start=' + c.start + ' count=' + c.count + ' skip=' + c.skip + ' @' + c.interval
        + 'ms \u2192 ' + v.frames.join(', '),
      tags: tags, ids: v.frames, interval: c.interval
    }));
  });
});

if (D.unreferencedHeadFrames && D.unreferencedHeadFrames.length) {
  var g2 = section('Head frames the FrameSet never references',
    'Same sprite width and the same <code>oy + h = 158</code> baseline as the confirmed head clips, '
    + 'but nothing in the frame table points at them \u2014 drawn and left unwired. This is where a '
    + 'death or dormant pose would be hiding.');
  var runs = [];
  D.unreferencedHeadFrames.forEach(function (id) {
    var last = runs[runs.length - 1];
    if (last && id === last[last.length - 1] + 1) last.push(id); else runs.push([id]);
  });
  runs.forEach(function (r) {
    g2.appendChild(card({
      title: 'Unreferenced ' + r[0] + '\u2013' + r[r.length - 1],
      sub: r.length + ' frame' + (r.length === 1 ? '' : 's') + ' \u00b7 absent from the FrameSet',
      tags: [{ text: 'unwired', kind: 'warn' }, { text: 'head-sized', kind: 'good' }],
      ids: r, interval: 120, flagged: true
    }));
  });
}

var g3 = section('Every frame block in the library',
  'Contiguous runs of drawable frames across all ' + D.imageCount + ' slots, so nothing is hidden: '
    + 'attack overlays, the bolt projectile and impact, the mass-rain variants, the DragonStatue '
  + 'clips, and the shared MapLightning / MapLava spell effects that other monsters draw from '
  + 'this same library.');
D.runs.forEach(function (r) {
  var ids = [];
  for (var i = r.from; i <= r.to; i++) if (D.frames[i] && !D.frames[i].stub) ids.push(i);
  if (!ids.length) return;
  var tags = [];
  if (ids.some(function (i) { return D.frames[i].headLike; })) tags.push({ text: 'head-sized', kind: 'good' });
  if (ids.every(function (i) { return D.frames[i].referenced; })) tags.push({ text: 'in FrameSet', kind: 'info' });
  g3.appendChild(card({
    title: r.label || ('Frames ' + r.from + '\u2013' + r.to),
    sub: r.from + '\u2013' + r.to + ' \u00b7 ' + ids.length + ' frames' + (r.note ? ' \u00b7 ' + r.note : ''),
    tags: tags, ids: ids, interval: 120
  }));
});

var zoomEl = document.getElementById('zoom'), speedEl = document.getElementById('speed');
var loopEl = document.getElementById('loopAll'), filmEl = document.getElementById('showFilm');
var headEl = document.getElementById('headOnly');

function applyZoom() {
  var z = Number(zoomEl.value);
  document.getElementById('zoomVal').textContent = z.toFixed(2) + '\u00d7';
  players.forEach(function (p) {
    p.stage.style.width = Math.round(p.stage.dataset.w * z) + 'px';
    p.stage.style.height = Math.round(p.stage.dataset.h * z) + 'px';
    var b = p.stage.querySelector('.baseline');
    b.style.top = Math.round(b.dataset.top * z) + 'px';
    p.imgs.forEach(function (img) {
      img.style.left = Math.round(img.dataset.x * z) + 'px';
      img.style.top = Math.round(img.dataset.y * z) + 'px';
      img.style.width = Math.round(img.dataset.w * z) + 'px';
      img.style.height = Math.round(img.dataset.h * z) + 'px';
    });
    if (p.film) {
      var s = z * 0.4;
      p.film.querySelectorAll('img').forEach(function (img) {
        img.style.width = Math.round(img.dataset.w * s) + 'px';
        img.style.height = Math.round(img.dataset.h * s) + 'px';
      });
    }
  });
}

function paint(p) {
  p.imgs.forEach(function (img, i) { img.classList.toggle('on', i === p.i); });
  if (p.film) p.film.querySelectorAll('figure').forEach(function (f, i) { f.classList.toggle('cur', i === p.i); });
}

function step(d) {
  players.forEach(function (p) { p.i = (p.i + d + p.fr.length) % p.fr.length; paint(p); });
}

var last = performance.now();
function tick(now) {
  var dt = now - last; last = now;
  if (loopEl.checked) {
    var mult = Number(speedEl.value);
    players.forEach(function (p) {
      p.acc += dt * mult;
      while (p.acc >= p.interval) {
        p.acc -= p.interval;
        p.i = (p.i + 1) % p.fr.length;
        paint(p);
      }
    });
  }
  requestAnimationFrame(tick);
}

zoomEl.addEventListener('input', applyZoom);
speedEl.addEventListener('input', function () {
  document.getElementById('speedVal').textContent = Number(speedEl.value).toFixed(2) + '\u00d7';
});
filmEl.addEventListener('change', function () {
  players.forEach(function (p) { if (p.film) p.film.style.display = filmEl.checked ? '' : 'none'; });
});
headEl.addEventListener('change', function () {
  players.forEach(function (p) {
    var any = p.fr.some(function (f) { return f.m.headLike; });
    p.stage.closest('.card').style.display = (!headEl.checked || any) ? '' : 'none';
  });
});
document.getElementById('stepBack').addEventListener('click', function () { loopEl.checked = false; step(-1); });
document.getElementById('stepFwd').addEventListener('click', function () { loopEl.checked = false; step(1); });

applyZoom();
players.forEach(paint);
requestAnimationFrame(tick);`;

  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>Evil Mir animation reference</title>",
    `<style>${CSS}</style></head><body>`,
    "<header><h1>Evil Mir animation reference</h1>",
    "<p class=\"note\">Every frame in <code>Dragon.Lib</code>, plus the <strong>frame table the",
    "library embeds itself</strong> — Crystal <code>.Lib</code> v3 stores its own",
    "<code>FrameSet</code>, which <code>MLibrary.Initialize</code> seeks to and",
    "<code>Frame(BinaryReader)</code> reads. Nothing here is inferred. Frames sit at their real",
    "<code>offsetX/offsetY</code>, so playback matches the client:",
    "<code>DrawFrame = Start + (Count + Skip) × Direction + FrameIndex</code>.</p>",
    `<p class="note">Generated ${data.generatedAt} from <code>${data.lib}</code>.`,
    "Rebuild with <code>node tools/build-evil-mir-animation-reference.mjs</code>.</p></header>",
    "<main><div class=\"toolbar\">",
    '<label>Zoom <input id="zoom" type="range" min="0.25" max="1.5" step="0.05" value="0.7" /><span id="zoomVal">0.70×</span></label>',
    '<label>Speed <input id="speed" type="range" min="0.15" max="2.5" step="0.05" value="1" /><span id="speedVal">1.00×</span></label>',
    '<label><input id="loopAll" type="checkbox" checked /> Animate</label>',
    '<label><input id="showFilm" type="checkbox" checked /> Filmstrips</label>',
    '<label><input id="headOnly" type="checkbox" /> Head-sized only</label>',
    '<button id="stepBack">◀ Step</button><button id="stepFwd">Step ▶</button>',
    '<span id="meta" style="color:var(--muted);font-family:Consolas,monospace"></span>',
    "</div><div id=\"out\"></div></main>",
    `<script>window.__EVILMIR__=${json};</${"script"}>`,
    `<script>${JS}</${"script"}>`,
    "</body></html>",
    "",
  ].join("\n");
}

console.log(`${LIB_PATH}`);
console.log(`  v${version}, ${imageCount} slots, ${declared.length} declared clips`);
console.log(`  exported ${written} PNGs (${(bytes / 1048576).toFixed(1)} MB) -> ${OUT_DIR}`);
if (unreferencedHeadFrames.length) {
  console.log(`  head-sized frames the FrameSet never references: ${unreferencedHeadFrames.join(", ")}`);
}
for (const c of clips) {
  console.log(`  ${c.action.padEnd(13)} start=${String(c.start).padStart(4)} count=${String(c.count).padStart(2)}`
    + ` stride=${String(c.stride).padStart(2)} @${String(c.interval).padStart(4)}`
    + `  ${c.variants.length} usable direction block(s)${c.reverse ? "  [REVERSE]" : ""}`);
}
