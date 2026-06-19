import fs from "node:fs";
import path from "node:path";
import { frameFileName, reviewIconSourcePath } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalPath = path.join(root, "src/data/crystal-items.json");
const itemsPath = path.join(root, "src/data/items.json");
const dropCsvPath = path.join(root, "content-audit/phase-1/idle-drop-items.csv");
const outDir = path.join(root, "tile-review/crystal-item-catalog");
const publicIconRoot = path.join(root, "public/item-icons/items");

const requirementTypes = {
  0: "level",
  1: "maxAC",
  2: "maxAMC",
  3: "maxDC",
  4: "maxMC",
  5: "maxSC",
  6: "maxLevel",
  7: "minAC",
  8: "minAMC",
  9: "minDC",
  10: "minMC",
  11: "minSC",
};

const classLabels = {
  warrior: { label: "Warrior", stat: "DC", color: "#e07a5f" },
  wizard: { label: "Wizard", stat: "MC", color: "#6ea8fe" },
  taoist: { label: "Taoist", stat: "SC", color: "#7dcea0" },
  hybrid: { label: "Hybrid / Multi-stat", stat: "Mixed", color: "#d4b86a" },
  other: { label: "Other / Utility", stat: "—", color: "#a8a29e" },
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else value += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [headers, ...entries] = rows.filter((entry) => entry.some((cell) => cell.trim()));
  return entries.map((entry) => Object.fromEntries(headers.map((header, index) => [header, entry[index] ?? ""])));
}

function displayName(name) {
  return name
    .replace(/\(([^)]+)\)/g, " ($1)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function statMax(range) {
  return Math.max(Number(range?.[0] ?? 0), Number(range?.[1] ?? 0));
}

function statRange(range) {
  const min = Number(range?.[0] ?? 0);
  const max = Number(range?.[1] ?? 0);
  if (min === 0 && max === 0) return "";
  if (min === max) return String(min);
  return `${min}-${max}`;
}

function classFromMask(mask) {
  if (mask === 1) return "warrior";
  if (mask === 2) return "wizard";
  if (mask === 4) return "taoist";
  return null;
}

function primaryStatClass(item) {
  const locked = classFromMask(Number(item.requiredClass) || 31);
  if (locked) return locked;

  const dc = statMax(item.stats?.dc);
  const mc = statMax(item.stats?.mc);
  const sc = statMax(item.stats?.sc);
  const peak = Math.max(dc, mc, sc);

  if (peak > 0) {
    const winners = [];
    if (dc === peak) winners.push("warrior");
    if (mc === peak) winners.push("wizard");
    if (sc === peak) winners.push("taoist");
    if (winners.length === 1) return winners[0];
    return "hybrid";
  }

  const reqType = requirementTypes[item.requiredType] ?? "";
  if (/DC/i.test(reqType)) return "warrior";
  if (/MC/i.test(reqType)) return "wizard";
  if (/SC/i.test(reqType)) return "taoist";

  return "other";
}

function requirementLabel(item) {
  const type = requirementTypes[item.requiredType] ?? "none";
  const amount = Number(item.requiredAmount) || 0;
  if (amount <= 0 || type === "none") return "";
  if (type === "level") return `Lv ${amount}`;
  return `${type.replace(/^max|^min/, (m) => m).replace("max", "max ").replace("min", "min ")} ${amount}`.replace("max max", "max").replace("min min", "min");
}

function statsSummary(item) {
  const s = item.stats ?? {};
  const parts = [];
  const dc = statRange(s.dc);
  const mc = statRange(s.mc);
  const sc = statRange(s.sc);
  const ac = statRange(s.ac);
  const amc = statRange(s.amc);
  if (dc) parts.push(`DC ${dc}`);
  if (mc) parts.push(`MC ${mc}`);
  if (sc) parts.push(`SC ${sc}`);
  if (ac) parts.push(`AC ${ac}`);
  if (amc) parts.push(`AMC ${amc}`);
  if (s.hp) parts.push(`HP +${s.hp}`);
  if (s.mp) parts.push(`MP +${s.mp}`);
  if (s.accuracy) parts.push(`Acc +${s.accuracy}`);
  if (s.agility) parts.push(`Agi +${s.agility}`);
  if (s.luck) parts.push(`Luck +${s.luck}`);
  if (s.attackSpeed) parts.push(`ASpeed ${s.attackSpeed}`);
  return parts.join(", ");
}

function iconHref(frame) {
  const file = frameFileName(frame);
  const publicPath = path.join(publicIconRoot, file);
  if (fs.existsSync(publicPath)) return `../../public/item-icons/items/${file}`;
  const reviewPath = reviewIconSourcePath(root, frame);
  if (reviewPath) {
    const rel = path.relative(outDir, reviewPath).split(path.sep).join("/");
    return rel;
  }
  return "";
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const crystalItems = JSON.parse(fs.readFileSync(crystalPath, "utf8")).items;
const gameItems = fs.existsSync(itemsPath)
  ? JSON.parse(fs.readFileSync(itemsPath, "utf8")).items
  : [];
const gameByCrystalName = new Map(gameItems.filter((i) => i.source?.name).map((i) => [i.source.name, i]));

const dropRows = fs.existsSync(dropCsvPath) ? parseCsv(fs.readFileSync(dropCsvPath, "utf8")) : [];
const dropsByCrystalName = new Map(
  dropRows
    .filter((r) => r["Keep?"] === "yes" && r["Crystal Name"])
    .map((r) => {
      const zones = Object.entries(r)
        .filter(([k, v]) => k.endsWith(" chance") && Number(v) > 0)
        .map(([k, v]) => `${k.replace(" chance", "")} (${v})`);
      return [r["Crystal Name"], { id: r["Item ID"], zones }];
    }),
);

const allCatalogItems = crystalItems.map((item) => {
  const frame = Number(item.icon?.frame) || 0;
  const statClass = primaryStatClass(item);
  const game = gameByCrystalName.get(item.name);
  const drop = dropsByCrystalName.get(item.name);
  return {
    crystalIndex: item.crystalIndex,
    name: item.name,
    displayName: displayName(item.name),
    type: item.type,
    statClass,
    statClassLabel: classLabels[statClass].label,
    primaryStat: classLabels[statClass].stat,
    requiredClass: Number(item.requiredClass) || 31,
    requiredClassLabel: classFromMask(Number(item.requiredClass) || 31) ?? "all",
    requirement: requirementLabel(item),
    stats: statsSummary(item),
    price: Number(item.price) || 0,
    frame,
    icon: iconHref(frame),
    inGame: Boolean(game),
    gameId: game?.id ?? "",
    dropZones: drop?.zones ?? [],
    gameDropZones: game?.drop?.zones ?? [],
    tooltip: item.tooltip ?? "",
  };
});

const catalogItems = allCatalogItems.filter((item) => item.icon);

catalogItems.sort((a, b) => {
  const classOrder = ["warrior", "wizard", "taoist", "hybrid", "other"];
  const ca = classOrder.indexOf(a.statClass);
  const cb = classOrder.indexOf(b.statClass);
  if (ca !== cb) return ca - cb;
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  return a.displayName.localeCompare(b.displayName);
});

const counts = {
  total: catalogItems.length,
  excludedNoIcon: allCatalogItems.length - catalogItems.length,
  crystalTotal: crystalItems.length,
  inGame: catalogItems.filter((i) => i.inGame).length,
  byClass: Object.fromEntries(
    Object.keys(classLabels).map((key) => [key, catalogItems.filter((i) => i.statClass === key).length]),
  ),
  byType: {},
};
for (const item of catalogItems) {
  counts.byType[item.type] = (counts.byType[item.type] ?? 0) + 1;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "catalog.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), counts, classLabels, items: catalogItems }, null, 2)}\n`,
);

const csvHeaders = [
  "Stat Class",
  "Type",
  "Display Name",
  "Crystal Name",
  "Crystal Index",
  "Requirement",
  "Stats",
  "Price",
  "In Game",
  "Game ID",
  "Drop Zones (CSV)",
  "Icon Frame",
];
const csvLines = [
  csvHeaders.join(","),
  ...catalogItems.map((item) =>
    [
      item.statClassLabel,
      item.type,
      item.displayName,
      item.name,
      item.crystalIndex,
      item.requirement,
      item.stats,
      item.price,
      item.inGame ? "yes" : "no",
      item.gameId,
      item.dropZones.join("; "),
      item.frame,
    ]
      .map(csvEscape)
      .join(","),
  ),
];
fs.writeFileSync(path.join(outDir, "crystal-items.csv"), `${csvLines.join("\n")}\n`);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Crystal Item Catalog</title>
    <style>
      :root { color-scheme: dark; --bg: #111; --panel: #1a1a1a; --line: #333; --text: #ececec; --muted: #9ca3af; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font: 13px/1.45 Segoe UI, system-ui, sans-serif; }
      header { position: sticky; top: 0; z-index: 10; background: #161616; border-bottom: 1px solid var(--line); padding: 14px 18px; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      .sub { margin: 0; color: var(--muted); max-width: 960px; }
      .stats { margin-top: 8px; color: #cbd5e1; font-size: 12px; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }
      .controls input, .controls select { background: #222; color: var(--text); border: 1px solid #444; border-radius: 4px; padding: 6px 10px; }
      #search { min-width: 260px; }
      .pill { border: 1px solid #444; background: #222; color: #eee; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
      .pill.active { border-color: #888; background: #333; }
      .pill.warrior.active { border-color: #e07a5f; background: #3a221c; }
      .pill.wizard.active { border-color: #6ea8fe; background: #1a2740; }
      .pill.taoist.active { border-color: #7dcea0; background: #1a2e22; }
      .pill.hybrid.active { border-color: #d4b86a; background: #2e2818; }
      .layout { display: grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 120px); }
      aside { border-right: 1px solid var(--line); background: #141414; padding: 12px; overflow: auto; }
      aside h2 { margin: 0 0 8px; font-size: 14px; color: #ddd; }
      .type-list { display: grid; gap: 4px; margin-bottom: 16px; }
      .type-btn { text-align: left; border: 1px solid transparent; background: transparent; color: #ccc; padding: 6px 8px; border-radius: 4px; cursor: pointer; }
      .type-btn:hover { background: #222; }
      .type-btn.active { background: #262626; border-color: #555; color: #fff; }
      main { overflow: auto; padding: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #2a2a2a; padding: 8px 10px; vertical-align: top; text-align: left; }
      th { position: sticky; top: 0; background: #181818; z-index: 1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #aaa; }
      tr:hover td { background: #181818; }
      .icon { width: 36px; height: 36px; object-fit: contain; image-rendering: pixelated; background: #090909; border: 1px solid #333; }
      .name { font-weight: 600; }
      .code { color: #94a3b8; font-size: 11px; }
      .badge { display: inline-block; font-size: 10px; padding: 2px 7px; border-radius: 999px; margin-right: 4px; }
      .badge.ingame { background: #1e3a2f; color: #86efac; }
      .badge.nogame { background: #2a2222; color: #aaa; }
      .class-warrior { color: #f4a261; }
      .class-wizard { color: #90caf9; }
      .class-taoist { color: #81c784; }
      .class-hybrid { color: #f2cc60; }
      .class-other { color: #bdbdbd; }
      .empty { padding: 40px; color: var(--muted); text-align: center; }
      @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--line); } }
    </style>
  </head>
  <body>
    <header>
      <h1>Crystal Item Catalog</h1>
      <p class="sub">${counts.total} Crystal items with icons (${counts.excludedNoIcon} without local images excluded). Grouped by primary stat class: Warrior (DC), Wizard (MC), Taoist (SC), plus hybrid and utility. Also exported as <code>crystal-items.csv</code>.</p>
      <p class="stats" id="summary"></p>
      <div class="controls">
        <input id="search" type="search" placeholder="Search name, type, stats, game id…" />
        <label><input id="ingameOnly" type="checkbox" /> In game only</label>
        <select id="sort">
          <option value="class-name">Class → Name</option>
          <option value="type-name">Type → Name</option>
          <option value="index">Crystal index</option>
          <option value="price-desc">Price (high)</option>
        </select>
        <button type="button" class="pill active" data-class="all">All classes</button>
        <button type="button" class="pill warrior" data-class="warrior">Warrior (DC)</button>
        <button type="button" class="pill wizard" data-class="wizard">Wizard (MC)</button>
        <button type="button" class="pill taoist" data-class="taoist">Taoist (SC)</button>
        <button type="button" class="pill hybrid" data-class="hybrid">Hybrid</button>
        <button type="button" class="pill other" data-class="other">Other</button>
      </div>
    </header>
    <div class="layout">
      <aside>
        <h2>Item types</h2>
        <div class="type-list" id="typeList"></div>
      </aside>
      <main>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Item</th>
              <th>Class</th>
              <th>Type</th>
              <th>Requirement</th>
              <th>Stats</th>
              <th>Game</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
        <div class="empty hidden" id="empty">No items match the current filters.</div>
      </main>
    </div>
    <script>
      const state = { class: "all", type: "all", q: "", inGameOnly: false, sort: "class-name" };
      let catalog = null;

      const rowsEl = document.getElementById("rows");
      const emptyEl = document.getElementById("empty");
      const summaryEl = document.getElementById("summary");
      const typeListEl = document.getElementById("typeList");

      function compare(a, b) {
        if (state.sort === "index") return a.crystalIndex - b.crystalIndex;
        if (state.sort === "price-desc") return b.price - a.price || a.displayName.localeCompare(b.displayName);
        if (state.sort === "type-name") return a.type.localeCompare(b.type) || a.displayName.localeCompare(b.displayName);
        const order = ["warrior", "wizard", "taoist", "hybrid", "other"];
        const ca = order.indexOf(a.statClass);
        const cb = order.indexOf(b.statClass);
        return ca - cb || a.type.localeCompare(b.type) || a.displayName.localeCompare(b.displayName);
      }

      function matches(item) {
        if (state.class !== "all" && item.statClass !== state.class) return false;
        if (state.type !== "all" && item.type !== state.type) return false;
        if (state.inGameOnly && !item.inGame) return false;
        if (!state.q) return true;
        const hay = [
          item.displayName, item.name, item.type, item.statClassLabel, item.requirement,
          item.stats, item.gameId, item.dropZones.join(" "), item.gameDropZones.join(" "),
        ].join(" ").toLowerCase();
        return hay.includes(state.q);
      }

      function renderTypes() {
        const types = [...new Set(catalog.items.map((i) => i.type))].sort();
        typeListEl.innerHTML = [
          '<button type="button" class="type-btn active" data-type="all">All types</button>',
          ...types.map((type) => {
            const count = catalog.items.filter((i) => i.type === type).length;
            return \`<button type="button" class="type-btn" data-type="\${type}">\${type} (\${count})</button>\`;
          }),
        ].join("");
        typeListEl.querySelectorAll(".type-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            state.type = btn.dataset.type;
            typeListEl.querySelectorAll(".type-btn").forEach((el) => el.classList.toggle("active", el === btn));
            renderRows();
          });
        });
      }

      function renderRows() {
        const visible = catalog.items.filter(matches).sort(compare);
        summaryEl.textContent = \`Showing \${visible.length} of \${catalog.counts.total} · \${catalog.counts.inGame} in LOM Idle · Warrior \${catalog.counts.byClass.warrior} · Wizard \${catalog.counts.byClass.wizard} · Taoist \${catalog.counts.byClass.taoist} · Hybrid \${catalog.counts.byClass.hybrid} · Other \${catalog.counts.byClass.other}\`;
        rowsEl.innerHTML = visible.map((item) => {
          const icon = \`<img class="icon" src="\${item.icon}" alt="" loading="lazy" />\`;
          const game = item.inGame
            ? \`<span class="badge ingame">in game</span><div class="code">\${item.gameId}</div>\`
            : \`<span class="badge nogame">not added</span>\`;
          const drops = [...new Set([...(item.dropZones || []), ...(item.gameDropZones || [])])];
          const dropLine = drops.length ? \`<div class="code">\${drops.slice(0, 3).join("; ")}\${drops.length > 3 ? "…" : ""}</div>\` : "";
          return \`<tr>
            <td>\${icon}</td>
            <td><div class="name">\${item.displayName}</div><div class="code">#\${item.crystalIndex} · \${item.name}</div></td>
            <td class="class-\${item.statClass}">\${item.statClassLabel}</td>
            <td>\${item.type}</td>
            <td>\${item.requirement || "—"}</td>
            <td>\${item.stats || "—"}</td>
            <td>\${game}\${dropLine}</td>
          </tr>\`;
        }).join("");
        emptyEl.classList.toggle("hidden", visible.length > 0);
      }

      document.querySelectorAll(".pill[data-class]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.class = btn.dataset.class;
          document.querySelectorAll(".pill[data-class]").forEach((el) => el.classList.toggle("active", el === btn));
          renderRows();
        });
      });
      document.getElementById("search").addEventListener("input", (e) => {
        state.q = e.target.value.trim().toLowerCase();
        renderRows();
      });
      document.getElementById("ingameOnly").addEventListener("change", (e) => {
        state.inGameOnly = e.target.checked;
        renderRows();
      });
      document.getElementById("sort").addEventListener("change", (e) => {
        state.sort = e.target.value;
        renderRows();
      });

      fetch("catalog.json")
        .then((r) => r.json())
        .then((data) => {
          catalog = data;
          renderTypes();
          renderRows();
        })
        .catch((err) => {
          summaryEl.textContent = "Failed to load catalog.json. Run: npm run build:crystal-item-catalog";
          console.error(err);
        });
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), html);

console.log(
  `Wrote ${catalogItems.length} items to ${path.relative(root, outDir)} (${counts.excludedNoIcon} excluded, no icon)`,
);
console.log(`  HTML: tile-review/crystal-item-catalog/index.html`);
console.log(`  CSV:  tile-review/crystal-item-catalog/crystal-items.csv`);
