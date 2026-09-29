/**
 * Mega / Ultra Potion icon picker — unique Crystal flask frames.
 *
 * Run: node tools/build-mega-ultra-potion-icon-picker.mjs
 * Open: http://localhost:4177/tools/mega-ultra-potion-icons/index.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.join(root, "tools/mega-ultra-potion-icons");
const iconDir = path.join(outDir, "icons");
const publicIconRoot = path.join(root, "public/item-icons/items");

const MEGA_ID = "mega-potion";
const ULTRA_ID = "ultra-potion";

const FOOD_RE = /dumpling|soup|broth|tea|apple|marshmallow|mackeral|mackerel|gobby|tinker|fruit|clam/i;
const OTHER_RE = /pill|oil|wonderdrug|exp\d|exp%|helmet|glove|boots|boxof/i;
const FLASK_NAME_RE = /\b(potion|drug|elixir|flask|wine|liquor|water|aid|sun)\b/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sourcePathForFrame(frame) {
  const file = frameFileName(frame);
  const publicPath = path.join(publicIconRoot, file);
  if (fs.existsSync(publicPath)) return publicPath;
  return reviewIconSourcePath(root, frame);
}

function copyFrameIcon(frame) {
  const src = sourcePathForFrame(frame);
  if (!src) return false;
  fs.mkdirSync(iconDir, { recursive: true });
  fs.copyFileSync(src, path.join(iconDir, frameFileName(frame)));
  return true;
}

function familyName(name) {
  return String(name)
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\d+$/g, "")
    .replace(/%/g, "")
    .trim() || name;
}

function includeCrystal(crystal) {
  const type = String(crystal.type || crystal.crystalType || "");
  const name = String(crystal.name || "");
  if (type === "Potion") return true;
  if (["Nothing", "Scroll"].includes(type) && FLASK_NAME_RE.test(name)) return true;
  return false;
}

function bucketFor(name, type) {
  if (FOOD_RE.test(name)) return "food";
  if (OTHER_RE.test(name)) return "other";
  if (type === "Potion" || FLASK_NAME_RE.test(name)) return "flask";
  return "other";
}

function statsLine(stats = {}) {
  const parts = [];
  if (Number(stats.hp)) parts.push(`${stats.hp} HP`);
  if (Number(stats.mp)) parts.push(`${stats.mp} MP`);
  return parts.join(" + ");
}

const crystalItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8")).items;
const gameItems = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8")).items;

const usedByFrame = new Map();
let megaFrame = null;
let ultraFrame = null;
for (const item of gameItems) {
  const frame = item.icon?.frame;
  if (frame == null) continue;
  if (!usedByFrame.has(frame)) usedByFrame.set(frame, []);
  usedByFrame.get(frame).push({ id: item.id, name: item.name });
  if (item.id === MEGA_ID) megaFrame = frame;
  if (item.id === ULTRA_ID) ultraFrame = frame;
}

const byFrame = new Map();
for (const crystal of crystalItems) {
  if (!includeCrystal(crystal)) continue;
  const name = String(crystal.name || "");
  const type = String(crystal.type || crystal.crystalType || "");
  const frame = crystal.icon?.frame ?? crystal.image;
  if (frame == null || frame === 0) continue;
  if (!byFrame.has(frame)) {
    byFrame.set(frame, {
      frame,
      names: [],
      types: new Set(),
      hp: 0,
      mp: 0,
      shape: Number(crystal.shape) || 0,
    });
  }
  const row = byFrame.get(frame);
  if (type === "Potion") row.names.unshift(name);
  else row.names.push(name);
  row.types.add(type || "Unknown");
  row.hp = Math.max(row.hp, Number(crystal.stats?.hp) || 0);
  row.mp = Math.max(row.mp, Number(crystal.stats?.mp) || 0);
  if (crystal.shape != null) row.shape = Number(crystal.shape) || 0;
}

const cards = [];
let copied = 0;
let missing = 0;
for (const row of [...byFrame.values()].sort((a, b) => a.frame - b.frame)) {
  const used = usedByFrame.get(row.frame) || [];
  const names = [...new Set(row.names)];
  const title = names[0];
  const hasIcon = copyFrameIcon(row.frame);
  if (hasIcon) copied += 1;
  else missing += 1;
  const inGame = used.filter((u) => u.id !== MEGA_ID && u.id !== ULTRA_ID);
  const isCurrentMega = row.frame === megaFrame;
  const isCurrentUltra = row.frame === ultraFrame;
  const primaryType = row.types.has("Potion") ? "Potion" : [...row.types][0] || "";
  cards.push({
    frame: row.frame,
    title,
    family: familyName(title),
    names,
    types: [...row.types],
    bucket: bucketFor(title, primaryType),
    stats: statsLine({ hp: row.hp, mp: row.mp }),
    instant: row.shape === 1,
    usedBy: inGame.map((u) => u.name),
    unused: inGame.length === 0 && !isCurrentMega && !isCurrentUltra,
    isCurrentMega,
    isCurrentUltra,
    hasIcon,
  });
}

const payload = {
  megaFrame,
  ultraFrame,
  cards,
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mega / Ultra Potion icon options</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #10131a;
      --panel: #1a2130;
      --border: #2d3648;
      --text: #e8edf7;
      --muted: #9aa8c0;
      --accent: #d4b45a;
      --mega: #e07a5f;
      --ultra: #7aa2ff;
      --ok: #7dcea0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 system-ui, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 5;
      background: #121722;
      border-bottom: 1px solid var(--border);
      padding: 14px 20px 12px;
    }
    h1 { margin: 0 0 6px; font-size: 20px; }
    .sub { margin: 0 0 12px; color: var(--muted); max-width: 90ch; }
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .pick {
      display: flex;
      gap: 10px;
      align-items: center;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 12px 8px 8px;
      min-width: 220px;
    }
    .pick img, .pick .empty {
      width: 48px;
      height: 48px;
      image-rendering: pixelated;
      background: #0b0e14;
      border-radius: 6px;
    }
    .pick .empty { display: grid; place-items: center; color: var(--muted); }
    .pick b { display: block; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
    .pick.mega b { color: var(--mega); }
    .pick.ultra b { color: var(--ultra); }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .filters input[type="search"] {
      background: #0d1118;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 8px;
      padding: 6px 10px;
      min-width: 220px;
    }
    button {
      background: #243049;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 5px 10px;
      cursor: pointer;
    }
    button.active { background: #3a4d72; border-color: #6f86b3; }
    button.mega { border-color: var(--mega); }
    button.ultra { border-color: var(--ultra); }
    main { padding: 16px 20px 80px; }
    section h2 {
      margin: 18px 0 10px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 10px;
    }
    article {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      display: grid;
      gap: 6px;
    }
    article.selected-mega { outline: 2px solid var(--mega); }
    article.selected-ultra { outline: 2px solid var(--ultra); }
    article.current { border-color: var(--accent); }
    .icon {
      height: 84px;
      display: grid;
      place-items: center;
      background: #0b0e14;
      border-radius: 8px;
    }
    .icon img {
      max-width: 72px;
      max-height: 72px;
      image-rendering: pixelated;
    }
    .missing { color: var(--muted); font-weight: 700; }
    .name { font-weight: 650; font-size: 13px; }
    .meta, .used { color: var(--muted); font-size: 11px; }
    .badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .badge {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: 999px;
      background: #2a3344;
      color: var(--muted);
    }
    .badge.ok { background: rgba(125,206,160,.15); color: var(--ok); }
    .badge.warn { background: rgba(212,180,90,.15); color: var(--accent); }
    .actions { display: flex; gap: 6px; }
    .actions button { flex: 1; font-size: 11px; padding: 4px 6px; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header>
    <h1>Mega / Ultra Potion — icon options</h1>
    <p class="sub">
      Unused Crystal flasks first. Click <b>Mega</b> or <b>Ultra</b> on a card, then tell me the two frame numbers.
      Current stand-ins are XL HP Drug (813) and Medium Sun Potion (312).
    </p>
    <div class="picks">
      <div class="pick mega" id="megaPick"></div>
      <div class="pick ultra" id="ultraPick"></div>
      <button type="button" id="copyBtn">Copy frame numbers</button>
    </div>
    <div class="filters">
      <input id="search" type="search" placeholder="Search name or frame">
      <button type="button" class="chip active" data-view="unused">Unused flasks</button>
      <button type="button" class="chip" data-view="used">Already in game</button>
      <button type="button" class="chip" data-view="other">Food / pills / oils</button>
      <button type="button" class="chip" data-view="all">Everything</button>
    </div>
  </header>
  <main id="main"></main>
  <script>
    const DATA = ${JSON.stringify(payload)};
    const state = {
      view: "unused",
      search: "",
      mega: DATA.megaFrame,
      ultra: DATA.ultraFrame,
    };

    const main = document.getElementById("main");
    const megaPick = document.getElementById("megaPick");
    const ultraPick = document.getElementById("ultraPick");
    const copyBtn = document.getElementById("copyBtn");

    function cardByFrame(frame) {
      return DATA.cards.find((c) => c.frame === frame);
    }

    function iconTag(frame) {
      const card = cardByFrame(frame);
      if (!card?.hasIcon) return '<div class="empty">?</div>';
      return '<img src="./icons/frame_' + String(frame).padStart(6, "0") + '.png" alt="">';
    }

    function renderPick(el, label, frame) {
      const card = cardByFrame(frame);
      el.innerHTML = iconTag(frame) +
        "<div><b>" + label + "</b><span>" +
        (card ? ("frame " + frame + " · " + card.title) : "not set") +
        "</span></div>";
    }

    function visible(card) {
      const q = state.search.trim().toLowerCase();
      if (q) {
        const hay = [card.title, card.family, card.frame, ...(card.names || []), ...(card.usedBy || [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (state.view === "all") return true;
      if (state.view === "used") return !card.unused;
      if (state.view === "other") return card.bucket !== "flask";
      return card.unused && card.bucket === "flask";
    }

    function groups(list) {
      if (state.view === "unused" || state.view === "all") {
        return [["All matching icons", list]];
      }
      const map = new Map();
      for (const card of list) {
        const key = card.unused ? card.family : (card.usedBy[0] || card.family);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(card);
      }
      return [...map.entries()];
    }

    function render() {
      renderPick(megaPick, "Mega Potion", state.mega);
      renderPick(ultraPick, "Ultra Potion", state.ultra);
      const list = DATA.cards.filter(visible);
      const html = groups(list).map(([title, cards]) => {
        const arts = cards.map((card) => {
          const cls = [
            card.frame === state.mega ? "selected-mega" : "",
            card.frame === state.ultra ? "selected-ultra" : "",
            card.isCurrentMega || card.isCurrentUltra ? "current" : "",
          ].filter(Boolean).join(" ");
          const badges = [];
          if (card.unused) badges.push('<span class="badge ok">Unused</span>');
          if (card.isCurrentMega) badges.push('<span class="badge warn">Current Mega</span>');
          if (card.isCurrentUltra) badges.push('<span class="badge warn">Current Ultra</span>');
          if (card.instant) badges.push('<span class="badge">Instant</span>');
          if (card.usedBy.length) badges.push('<span class="badge">In game</span>');
          const used = card.usedBy.length ? '<div class="used">Used by ' + card.usedBy.join(", ") + "</div>" : "";
          const img = card.hasIcon
            ? '<img src="./icons/frame_' + String(card.frame).padStart(6, "0") + '.png" alt="">'
            : '<span class="missing">?</span>';
          return '<article class="' + cls + '" data-frame="' + card.frame + '">' +
            '<div class="icon">' + img + "</div>" +
            '<div class="name">' + card.title + "</div>" +
            '<div class="meta">frame ' + card.frame + (card.stats ? " · " + card.stats : "") + "</div>" +
            '<div class="badges">' + badges.join("") + "</div>" +
            used +
            '<div class="actions">' +
              '<button type="button" class="mega" data-assign="mega">Mega</button>' +
              '<button type="button" class="ultra" data-assign="ultra">Ultra</button>' +
            "</div></article>";
        }).join("");
        return "<section><h2>" + title + " · " + cards.length + "</h2><div class=\\"grid\\">" + arts + "</div></section>";
      }).join("");
      main.innerHTML = html || "<p class=\\"sub\\">No icons match.</p>";
    }

    document.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.view = btn.dataset.view;
        render();
      });
    });
    document.getElementById("search").addEventListener("input", (e) => {
      state.search = e.target.value;
      render();
    });
    main.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-assign]");
      if (!btn) return;
      const frame = Number(e.target.closest("article")?.dataset.frame);
      if (!frame) return;
      const which = btn.dataset.assign;
      if (which === "mega") {
        if (state.ultra === frame) state.ultra = null;
        state.mega = frame;
      } else {
        if (state.mega === frame) state.mega = null;
        state.ultra = frame;
      }
      render();
    });
    copyBtn.addEventListener("click", async () => {
      const text = "Mega frame " + state.mega + ", Ultra frame " + state.ultra;
      try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied"; }
      catch { copyBtn.textContent = text; }
      setTimeout(() => { copyBtn.textContent = "Copy frame numbers"; }, 1500);
    });
    render();
  </script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

const unusedFlasks = cards.filter((c) => c.unused && c.bucket === "flask" && c.hasIcon);
console.log(`Copied ${copied} icons (${missing} missing)`);
console.log(`Unused flasks with art: ${unusedFlasks.length}`);
console.log("Open: http://localhost:4177/tools/mega-ultra-potion-icons/index.html");
