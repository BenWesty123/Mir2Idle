#!/usr/bin/env node
/**
 * Hell Cavern monster FX atlas review — all trash + boss atlases on one page.
 * Output: tile-review/hell-cavern-fx/index.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tile-review", "hell-cavern-fx");
const monsterDir = path.join(root, "public", "monsters", "monster");

const MONSTERS = [
  { index: 226, label: "Demon", enemyId: 424 },
  { index: 227, label: "Demon Warrior", enemyId: 425 },
  { index: 215, label: "Hell Slasher", enemyId: 426 },
  { index: 216, label: "Hell Pirate", enemyId: 427 },
  { index: 217, label: "Hell Cannibal", enemyId: 428 },
  { index: 219, label: "Hell Bolt", enemyId: 429 },
  { index: 220, label: "Witch Doctor", enemyId: 430 },
  { index: 218, label: "Hell Keeper (boss)", enemyId: 431 },
];

function readPngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function sxFor(meta, slotW) {
  if (Number.isFinite(Number(meta.sheetX))) return Number(meta.sheetX);
  if (Number.isFinite(Number(meta.slot))) return meta.slot * slotW;
  return 0;
}

function buildManifest(entry) {
  const atlasPath = path.join(monsterDir, `${entry.index}.json`);
  const pngPath = path.join(monsterDir, `${entry.index}.png`);
  if (!fs.existsSync(atlasPath) || !fs.existsSync(pngPath)) {
    return { ...entry, missing: true };
  }

  const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
  const pngBuf = fs.readFileSync(pngPath);
  const { w: pngW, h: pngH } = readPngSize(pngBuf);
  const slotW = atlas.slotWidth;
  const slotH = atlas.slotHeight;
  const sheetH = atlas.sheetHeight ?? pngH;

  const skipBlend = new Set([
    "attack1Blend", "attackRange1Blend", "standingBlend", "walkingBlend", "dieBlend",
  ]);
  let bodySlots = 0;
  for (const [name, clip] of Object.entries(atlas.actions ?? {})) {
    if (skipBlend.has(name)) continue;
    for (const f of clip.frames ?? []) bodySlots = Math.max(bodySlots, (f.slot ?? 0) + 1);
  }

  const blendFrames = (atlas.actions?.attack1Blend?.frames ?? []).map((f, i) => ({
    i, kind: "blend", ...f, sx: sxFor(f, slotW),
  }));
  const castFrames = (atlas.castEffect?.frames ?? []).map((f, i) => ({
    i, kind: "cast", ...f, sx: sxFor(f, slotW),
  }));
  const hitFrames = (atlas.projectile?.frames ?? []).map((f, i) => ({
    i, kind: "hit", ...f, sx: sxFor(f, slotW),
  }));

  const fxFrames = [...blendFrames, ...castFrames, ...hitFrames].filter((f) => !f.empty && f.w > 0);
  const wideFx = fxFrames.filter((f) => f.w > slotW);
  const packedFx = fxFrames.filter((f) => Number.isFinite(Number(f.sheetX)));

  return {
    ...entry,
    png: `../../public/monsters/monster/${entry.index}.png`,
    pngW,
    pngH,
    slotWidth: slotW,
    slotHeight: slotH,
    sheetHeight: sheetH,
    bodyWidth: atlas.bodyWidth ?? bodySlots * slotW,
    bodySlots,
    blendInterval: atlas.actions?.attack1Blend?.interval ?? null,
    castInterval: atlas.castEffect?.interval ?? null,
    hitInterval: atlas.projectile?.interval ?? null,
    blendFrames,
    castFrames,
    hitFrames,
    fxCount: fxFrames.length,
    wideFxCount: wideFx.length,
    packedFxCount: packedFx.length,
    needsRepack: wideFx.length > 0 && packedFx.length < wideFx.length,
  };
}

const manifest = { monsters: MONSTERS.map(buildManifest) };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hell Cavern FX atlas review</title>
  <style>
    :root { color-scheme: dark; --bg:#0e0d0b; --panel:#171411; --text:#e8dcc8; --muted:#9a8b74; --accent:#c9a24d; --line:#2a241c;
      --body:#4a90d9; --blend:#9b59b6; --cast:#2ecc71; --hit:#e74c3c; --warn:#e67e22; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 "Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px; border-bottom:1px solid var(--line); max-width:1600px; }
    h1 { margin:0 0 8px; font-size:1.35rem; color:#f4dfb0; }
    h2 { margin:0 0 12px; font-size:1.05rem; color:var(--accent); }
    .meta { color:var(--muted); line-height:1.6; max-width:1600px; }
    code { color:#d4bc86; }
    nav { display:flex; flex-wrap:wrap; gap:8px; padding:16px 24px; border-bottom:1px solid var(--line); position:sticky; top:0; background:rgba(14,13,11,0.95); z-index:2; backdrop-filter:blur(6px); }
    nav a { color:var(--text); text-decoration:none; padding:6px 12px; border:1px solid var(--line); border-radius:999px; font-size:13px; }
    nav a:hover, nav a.active { border-color:var(--accent); color:#f4dfb0; }
    nav a.warn { border-color:var(--warn); color:#f5c896; }
    section.monster { padding:24px; border-bottom:1px solid var(--line); max-width:1600px; scroll-margin-top:64px; }
    .legend { display:flex; flex-wrap:wrap; gap:16px; margin:12px 0; font-size:13px; }
    .legend span { display:inline-flex; align-items:center; gap:6px; }
    .swatch { width:14px; height:14px; border-radius:3px; display:inline-block; }
    .stats { display:flex; flex-wrap:wrap; gap:12px; margin:10px 0 16px; font:12px Consolas,monospace; }
    .stats span { background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:4px 8px; }
    .stats .bad { border-color:var(--warn); color:#f5c896; }
    .sheet-wrap { overflow:auto; border:1px solid var(--line); border-radius:8px; background:#050504; padding:8px; max-width:100%; }
    canvas.sheet { display:block; image-rendering:pixelated; image-rendering:crisp-edges; }
    .grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px; }
    .card h3 { margin:0 0 6px; font-size:0.9rem; }
    .card .sub { font-size:11px; color:var(--muted); font-family:Consolas,monospace; margin-bottom:6px; }
    canvas.frame { display:block; image-rendering:pixelated; image-rendering:crisp-edges; background:#050504; border:1px solid var(--line); border-radius:6px; max-width:100%; }
    .missing { color:#f88; padding:24px; }
  </style>
</head>
<body>
  <header>
    <h1>Hell Cavern FX atlas review</h1>
    <p class="meta">
      All Hell group dungeon monsters. Body clips use fixed <code>slotWidth</code> columns;
      spell/attack FX should be packed at <code>sheetX</code> with each frame's real width
      (same as <code>drawAtlasFrameMeta</code> in <code>app.monolith.js</code>).
      Rebuild atlases: <code>powershell -File tools/repack-hell-cavern-fx-atlases.ps1</code>
    </p>
    <div class="legend">
      <span><i class="swatch" style="background:var(--body)"></i> body slots</span>
      <span><i class="swatch" style="background:var(--blend)"></i> attack1Blend</span>
      <span><i class="swatch" style="background:var(--cast)"></i> castEffect</span>
      <span><i class="swatch" style="background:var(--hit)"></i> projectile / hit</span>
    </div>
  </header>
  <nav id="nav"></nav>
  <div id="sections"></div>
  <script type="application/json" id="manifest">${JSON.stringify(manifest)}</script>
  <script>
    const M = JSON.parse(document.getElementById("manifest").textContent);

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    function blitMeta(ctx, sheet, meta, slotW, slotH, dx, dy, scale) {
      const w = meta.w || slotW;
      const h = meta.h || slotH;
      const sx = Number.isFinite(Number(meta.sheetX)) ? meta.sheetX : (meta.slot ?? 0) * slotW;
      ctx.drawImage(sheet, sx, 0, w, h, dx + meta.offsetX * scale, dy + meta.offsetY * scale, w * scale, h * scale);
    }

    function drawOverview(canvas, sheet, mon) {
      const slotW = mon.slotWidth;
      const scale = Math.min(1, 1100 / mon.pngW, 280 / mon.pngH);
      canvas.width = Math.ceil(mon.pngW * scale);
      canvas.height = Math.ceil(mon.pngH * scale);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, 0, 0, canvas.width, canvas.height);

      const bodyEnd = mon.bodyWidth / slotW;
      for (let slot = 0; slot < bodyEnd; slot++) {
        const x = slot * slotW * scale;
        ctx.strokeStyle = "rgba(74,144,217,0.35)";
        ctx.strokeRect(x, 0, slotW * scale, canvas.height);
      }

      const tint = (frames, color, stroke) => {
        for (const meta of frames) {
          if (meta.empty || !meta.w) continue;
          const x = meta.sx * scale;
          const w = meta.w * scale;
          ctx.fillStyle = color;
          ctx.fillRect(x, 0, w, canvas.height);
          ctx.strokeStyle = stroke;
          ctx.strokeRect(x, 0, w, canvas.height);
        }
      };
      tint(mon.blendFrames, "rgba(155,89,182,0.15)", "rgba(155,89,182,0.55)");
      tint(mon.castFrames, "rgba(46,204,113,0.15)", "rgba(46,204,113,0.55)");
      tint(mon.hitFrames, "rgba(231,76,60,0.15)", "rgba(231,76,60,0.55)");

      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(mon.bodyWidth * scale, 0);
      ctx.lineTo(mon.bodyWidth * scale, canvas.height);
      ctx.stroke();
      ctx.fillStyle = "#9a8b74";
      ctx.font = "11px Consolas, monospace";
      ctx.fillText(mon.pngW + "×" + mon.pngH + " · slotW=" + slotW, 8, 14);
    }

    function addFrameCard(root, sheet, mon, meta, tint) {
      if (meta.empty || !meta.w) return;
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML =
        '<h3>#' + meta.i + ' · ' + meta.kind + ' · src ' + (meta.srcFrame ?? meta.src ?? "?") + '</h3>' +
        '<div class="sub">sheetX=' + meta.sx + ' · ' + meta.w + '×' + meta.h +
        (meta.w > mon.slotWidth ? ' · <strong style="color:#f5c896">wider than slot</strong>' : '') +
        '</div>';
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr 1fr";
      row.style.gap = "8px";

      const c1 = document.createElement("canvas");
      const c2 = document.createElement("canvas");
      const cw = Math.min(260, Math.max(mon.slotWidth, meta.w) + 12);
      const ch = Math.min(300, Math.max(mon.slotHeight, meta.h) + 12);
      c1.width = c2.width = cw;
      c1.height = c2.height = ch;
      c1.className = c2.className = "frame";

      row.innerHTML = '<div><div class="sub">source strip</div></div><div><div class="sub">blitMeta @ foot</div></div>';
      row.children[0].appendChild(c1);
      row.children[1].appendChild(c2);
      card.appendChild(row);
      root.appendChild(card);

      const cctx = c1.getContext("2d");
      const gctx = c2.getContext("2d");
      cctx.imageSmoothingEnabled = gctx.imageSmoothingEnabled = false;
      cctx.strokeStyle = tint;
      cctx.drawImage(sheet, meta.sx, 0, meta.w, mon.pngH, 0, 0, meta.w, mon.pngH);
      cctx.strokeRect(0, 0, meta.w, meta.h);
      const footY = ch - 8;
      gctx.strokeStyle = "rgba(255,200,80,0.6)";
      gctx.beginPath(); gctx.moveTo(0, footY - 32); gctx.lineTo(cw, footY - 32); gctx.stroke();
      blitMeta(gctx, sheet, meta, mon.slotWidth, mon.slotHeight, cw / 2 - 20, footY, 1);
    }

    async function init() {
      const nav = document.getElementById("nav");
      const sections = document.getElementById("sections");

      for (const mon of M.monsters) {
        const id = "m" + mon.index;
        const a = document.createElement("a");
        a.href = "#" + id;
        a.textContent = mon.index + " " + mon.label;
        if (mon.needsRepack) a.className = "warn";
        nav.appendChild(a);

        const sec = document.createElement("section");
        sec.className = "monster";
        sec.id = id;
        if (mon.missing) {
          sec.innerHTML = '<h2>' + mon.label + ' (' + mon.index + ')</h2><p class="missing">Missing atlas files</p>';
          sections.appendChild(sec);
          continue;
        }

        sec.innerHTML =
          '<h2>' + mon.label + ' — atlas ' + mon.index + ' (enemy ' + mon.enemyId + ')</h2>' +
          '<div class="stats" id="stats-' + mon.index + '"></div>' +
          '<div class="sheet-wrap"><canvas class="sheet" id="sheet-' + mon.index + '"></canvas></div>' +
          (mon.fxCount ? '<h2 style="margin-top:20px">FX frames</h2><div class="grid" id="fx-' + mon.index + '"></div>' : '<p class="meta">No attack FX clips — body-only atlas.</p>');
        sections.appendChild(sec);

        const stats = sec.querySelector("#stats-" + mon.index);
        stats.innerHTML = [
          '<span>PNG ' + mon.pngW + '×' + mon.pngH + '</span>',
          '<span>slot ' + mon.slotWidth + '×' + mon.slotHeight + '</span>',
          '<span>body ' + mon.bodyWidth + 'px (' + mon.bodySlots + ' slots)</span>',
          '<span>FX ' + mon.fxCount + ' (' + mon.wideFxCount + ' wider than slot)</span>',
          mon.needsRepack ? '<span class="bad">needs repack — wide FX still on slot grid</span>' : '<span>sheetX packed OK</span>',
        ].join("");

        const sheet = await loadImage(mon.png);
        drawOverview(document.getElementById("sheet-" + mon.index), sheet, mon);

        if (mon.fxCount) {
          const fxRoot = document.getElementById("fx-" + mon.index);
          const all = [...mon.blendFrames, ...mon.castFrames, ...mon.hitFrames];
          const tints = { blend: "#9b59b6", cast: "#2ecc71", hit: "#e74c3c" };
          for (const meta of all) addFrameCard(fxRoot, sheet, mon, meta, tints[meta.kind] || "#fff");
        }
      }

      const links = [...nav.querySelectorAll("a")];
      const obs = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
        }
      }, { rootMargin: "-20% 0px -60% 0px" });
      document.querySelectorAll("section.monster").forEach((s) => obs.observe(s));
    }

    init().catch((err) => {
      document.body.insertAdjacentHTML("beforeend", '<pre style="color:#f88;padding:24px">' + err + "</pre>");
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
console.log(JSON.stringify({ html: path.join(outDir, "index.html"), monsters: manifest.monsters.length }, null, 2));
