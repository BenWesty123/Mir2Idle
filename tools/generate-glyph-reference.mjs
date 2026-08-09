/**
 * Dev-only glyph tracker. Regenerates tools/glyph-reference.html from live defs.
 * Not packaged for players — run: npm run glyph:ref
 * View at http://localhost:4177/tools/glyph-reference.html (with npm run dev).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASCENDED_BOSS_GLYPH_DROP_CHANCE,
  EMPOWERED_BOSS_GLYPH_DROP_CHANCE,
  GLYPH_DEFS,
  GLYPH_EQUIPMENT_SLOT_IDS,
} from "../src/glyphModifiers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const itemsPath = join(root, "src/data/items.json");
const htmlPath = join(root, "tools/glyph-reference.html");
const mdPath = join(root, "docs/GLYPH_REFERENCE.md");

const items = JSON.parse(readFileSync(itemsPath, "utf8")).items ?? [];
const itemById = new Map(items.map((item) => [item.id, item]));

const CLASS_LABEL = {
  warrior: "Warrior",
  wizard: "Wizard",
  taoist: "Taoist",
  any: "All classes",
};

const CLASS_ORDER = ["warrior", "wizard", "taoist", "any"];

function iconPublicPath(item) {
  const src = item?.icon?.src;
  if (typeof src === "string" && src.includes("item-icons/")) {
    // JSON uses ./public/... — HTML in tools/ needs ../public/...
    return src.replace(/^\.\//, "../");
  }
  const frame = item?.icon?.frame;
  if (frame != null) {
    return `../public/item-icons/items/frame_${String(frame).padStart(6, "0")}.png`;
  }
  return null;
}

function buildRows() {
  return GLYPH_DEFS.map((def) => {
    const item = itemById.get(def.itemId) ?? null;
    return {
      id: def.id,
      itemId: def.itemId,
      label: def.label,
      description: def.description || item?.description || "",
      classId: def.classId,
      classLabel: CLASS_LABEL[def.classId] ?? def.classId,
      spellIds: Array.isArray(def.spellIds) ? def.spellIds : [],
      kind: def.kind,
      implemented: def.implemented !== false,
      level: Number(item?.requirements?.amount) || Number(item?.requirements?.level) || 0,
      icon: iconPublicPath(item),
      sell: Number(item?.shop?.sell) || 0,
    };
  }).sort((a, b) => {
    const ao = CLASS_ORDER.indexOf(a.classId);
    const bo = CLASS_ORDER.indexOf(b.classId);
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label);
  });
}

function buildMarkdown(rows, generatedAt) {
  const lines = [
    "# Glyph reference (dev only)",
    "",
    "> **Private dev sheet** — not shipped to players. Regenerate after glyph changes:",
    "> `npm run glyph:ref`",
    "",
    `Last generated: ${generatedAt}`,
    "",
    "## Icon frames for new glyphs",
    "",
    "Matching Body Glyph frames **3200–3227 are all in use**. For new glyphs, pick an unused",
    "frame from **[`GLYPH_ICON_POOL.md`](./GLYPH_ICON_POOL.md)** (derived variants starting at",
    "**3230**). Preview: `docs/glyph-variant-preview/index.html`. Generate more with",
    "`npm run glyph:variants` / promote with `npm run glyph:variants:promote`.",
    "",
    "## Drop rules",
    "",
    `- Empowered bosses: **${Math.round(EMPOWERED_BOSS_GLYPH_DROP_CHANCE * 100)}%** chance to drop one random glyph.`,
    `- Ascended bosses: **${Math.round(ASCENDED_BOSS_GLYPH_DROP_CHANCE * 100)}%** chance.`,
    `- Equip slots: \`${GLYPH_EQUIPMENT_SLOT_IDS.join("`, `")}\` (${GLYPH_EQUIPMENT_SLOT_IDS.length} slots).`,
    `- Pool size: **${rows.length}** glyphs (uniform pick when a drop hits).`,
    "",
    "## Glyphs",
    "",
  ];

  let lastClass = null;
  for (const row of rows) {
    if (row.classId !== lastClass) {
      lastClass = row.classId;
      lines.push(`### ${row.classLabel}`);
      lines.push("");
    }
    const spells = row.spellIds.length ? row.spellIds.join(", ") : "—";
    lines.push(`#### ${row.label}`);
    lines.push("");
    lines.push(`- Item id: \`${row.itemId}\``);
    lines.push(`- Class: ${row.classLabel}`);
    lines.push(`- Level: ${row.level || "—"}`);
    lines.push(`- Spells: ${spells}`);
    lines.push(`- ${row.description}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildHtml(rows, generatedAt) {
  const payload = JSON.stringify({
    generatedAt,
    empoweredChancePercent: Math.round(EMPOWERED_BOSS_GLYPH_DROP_CHANCE * 100),
    ascendedChancePercent: Math.round(ASCENDED_BOSS_GLYPH_DROP_CHANCE * 100),
    slotIds: GLYPH_EQUIPMENT_SLOT_IDS,
    glyphs: rows,
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glyph reference</title>
  <style>
    :root {
      --bg: #100e0c;
      --panel: #1a1612;
      --line: #3d3226;
      --text: #e8dcc4;
      --muted: #9a8b72;
      --gold: #e0c48a;
      --warrior: #e07a5f;
      --wizard: #6ea8fe;
      --taoist: #7dcea0;
      --any: #c9b87a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 "Segoe UI", system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 10% -10%, #2a2118 0%, transparent 55%),
        radial-gradient(900px 500px at 100% 0%, #1a2430 0%, transparent 50%),
        var(--bg);
      min-height: 100vh;
    }
    header {
      padding: 28px 24px 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(0,0,0,0.25);
    }
    h1 { margin: 0 0 6px; font-size: 28px; color: var(--gold); letter-spacing: 0.02em; }
    .note { margin: 0; color: var(--muted); }
    .note code { color: var(--gold); }
    main { padding: 18px 24px 40px; max-width: 1200px; margin: 0 auto; }
    .meta {
      display: flex; flex-wrap: wrap; gap: 10px 18px;
      margin: 0 0 16px; color: var(--muted); font-size: 13px;
    }
    .meta strong { color: var(--text); font-weight: 600; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .filters button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--muted);
      padding: 7px 12px;
      cursor: pointer;
      border-radius: 4px;
    }
    .filters button.active { color: var(--gold); border-color: var(--gold); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    article {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 12px;
      padding: 12px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .icon {
      width: 56px; height: 56px;
      image-rendering: pixelated;
      background: #0a0908;
      border: 1px solid #2a241c;
      border-radius: 4px;
      object-fit: contain;
    }
    .icon.missing {
      display: grid; place-items: center;
      color: var(--muted); font-size: 11px;
    }
    .body strong { display: block; font-size: 15px; color: #fff4dc; margin-bottom: 2px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
    .tag {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--muted);
    }
    .tag.warrior { color: var(--warrior); border-color: #6a3a2e; }
    .tag.wizard { color: var(--wizard); border-color: #2e456a; }
    .tag.taoist { color: var(--taoist); border-color: #2e5a42; }
    .tag.any { color: var(--any); border-color: #5a5030; }
    .desc { margin: 0; color: var(--text); }
    .spells { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
    .spells code { color: #cdb892; }
    .id { margin-top: 6px; color: #6f6350; font-size: 11px; }
    h2 { margin: 22px 0 10px; font-size: 16px; color: var(--gold); }
    .empty { color: var(--muted); padding: 24px 0; }
  </style>
</head>
<body>
  <header>
    <h1>Glyph reference</h1>
    <p class="note">Dev-only — regenerate with <code>npm run glyph:ref</code>. Open via <code>/tools/glyph-reference.html</code>.</p>
  </header>
  <main>
    <div class="meta" id="meta"></div>
    <div class="filters" id="filters"></div>
    <div id="content"></div>
  </main>
  <script type="application/json" id="glyph-data">${payload.replace(/</g, "\\u003c")}</script>
  <script>
    const data = JSON.parse(document.getElementById("glyph-data").textContent);
    const filters = document.getElementById("filters");
    const content = document.getElementById("content");
    const meta = document.getElementById("meta");
    const views = [
      { id: "all", label: "All" },
      { id: "warrior", label: "Warrior" },
      { id: "wizard", label: "Wizard" },
      { id: "taoist", label: "Taoist" },
      { id: "any", label: "All classes" },
    ];
    let active = "all";

    meta.innerHTML =
      "<span>Generated <strong>" + data.generatedAt + "</strong></span>" +
      "<span>Empowered drop <strong>" + data.empoweredChancePercent + "%</strong></span>" +
      "<span>Ascended drop <strong>" + data.ascendedChancePercent + "%</strong></span>" +
      "<span>Slots <strong>" + data.slotIds.length + "</strong> (" + data.slotIds.join(", ") + ")</span>" +
      "<span>Glyphs <strong>" + data.glyphs.length + "</strong></span>";

    function card(row) {
      const icon = row.icon
        ? '<img class="icon" src="' + row.icon + '" alt="" width="56" height="56" />'
        : '<div class="icon missing">?</div>';
      const spells = row.spellIds.length
        ? '<p class="spells">Spells: ' + row.spellIds.map((id) => "<code>" + id + "</code>").join(", ") + "</p>"
        : '<p class="spells">No linked spell (passive / global)</p>';
      return '<article>' + icon +
        '<div class="body">' +
        "<strong>" + row.label + "</strong>" +
        '<div class="tags">' +
        '<span class="tag ' + row.classId + '">' + row.classLabel + "</span>" +
        (row.level ? '<span class="tag">Lv ' + row.level + "</span>" : "") +
        "</div>" +
        '<p class="desc">' + row.description + "</p>" +
        spells +
        '<div class="id">' + row.itemId + " · " + row.kind + "</div>" +
        "</div></article>";
    }

    function render() {
      filters.innerHTML = views.map((v) =>
        '<button type="button" class="' + (active === v.id ? "active" : "") + '" data-view="' + v.id + '">' + v.label + "</button>"
      ).join("");
      filters.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => { active = btn.dataset.view; render(); });
      });

      const rows = data.glyphs.filter((row) => active === "all" || row.classId === active);
      if (!rows.length) {
        content.innerHTML = '<p class="empty">No glyphs in this filter.</p>';
        return;
      }

      if (active === "all") {
        const order = ["warrior", "wizard", "taoist", "any"];
        content.innerHTML = order.map((classId) => {
          const group = rows.filter((row) => row.classId === classId);
          if (!group.length) return "";
          const label = group[0].classLabel;
          return "<h2>" + label + " (" + group.length + ")</h2><div class=\\"grid\\">" +
            group.map(card).join("") + "</div>";
        }).join("");
        return;
      }

      content.innerHTML = '<div class="grid">' + rows.map(card).join("") + "</div>";
    }

    render();
  </script>
</body>
</html>
`;
}

const generatedAt = new Date().toISOString().slice(0, 10);
const rows = buildRows();
writeFileSync(htmlPath, buildHtml(rows, generatedAt));
writeFileSync(mdPath, buildMarkdown(rows, generatedAt));
console.log(`Wrote ${htmlPath}`);
console.log(`Wrote ${mdPath}`);
console.log(`Glyphs: ${rows.length}`);
