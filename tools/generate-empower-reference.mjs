/**
 * Dev-only empower tracker. Regenerates docs/EMPOWER_REFERENCE.md from live tables.
 * Not packaged for itch — run: npm run empower:ref
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  empowerReferenceCatalog,
  empowerRollDescriptionsForItem,
  empowerSlotGroupForItem,
  itemCanBeEmpowered,
  weaponEmpowerClass,
  weaponEmpowerClassLabel,
} from "../src/core/empoweredItems.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const itemsPath = join(root, "src/data/items.json");
const mdPath = join(root, "docs/EMPOWER_REFERENCE.md");
const htmlPath = join(root, "tools/empower-reference.html");

const items = JSON.parse(readFileSync(itemsPath, "utf8")).items ?? [];

function itemLevel(item) {
  const req = item?.requirements;
  if (req?.type === "level") return Number(req.amount) || 0;
  return Number(req?.level) || 0;
}

function buildMarkdown() {
  const catalog = empowerReferenceCatalog();
  const generatedAt = new Date().toISOString().slice(0, 10);
  const lines = [
    "# Empower reference (dev only)",
    "",
    "> **Private dev sheet** — not shipped to players. Regenerate after table changes:",
    "> `npm run empower:ref`",
    "",
    `Last generated: ${generatedAt}`,
    "",
    "## System overview",
    "",
    "- Boss fights can be empowered (rebirth upgrade + 100k gold) for doubled boss drop rates.",
    "- Equippable boss loot: **10%** chance to become empowered (`BOSS_EMPOWER_ITEM_CHANCE`; dev may override via `BOSS_EMPOWER_ITEM_CHANCE_DEV`).",
    "- Tier roll (unique stats per item): " + catalog.tierWeights.map((row) => `${row.tier}× ${row.percent}%`).join(", ") + ".",
    "- Item name suffix: one `*` per empowerment tier (max 4).",
    "- Flat stats live on `empowerBonusStats`; spell bonuses on `empowerSpellBonuses`.",
    "",
    "## Weapon classes",
    "",
    ...catalog.weaponRules.map((rule) => `- ${rule}`),
    "",
  ];

  for (const weaponClass of catalog.weaponClasses) {
    lines.push(`### ${weaponClass.label}`);
    lines.push("");
    lines.push(weaponClass.description);
    lines.push("");
    for (const roll of weaponClass.rolls) {
      lines.push(`- ${roll}`);
    }
    lines.push("");
  }

  lines.push("## Spell-specific empowers");
  lines.push("");
  lines.push("| Spell | Requirement | Roll | Combat hook |");
  lines.push("| --- | --- | --- | --- |");
  lines.push("| Flame Disruptor | Wizard or Universal weapon (base MC) | +10–35% damage | `applyEquippedSpellDamageBonus` |");
  lines.push("");
  lines.push("## Other slot roll tables");
  lines.push("");

  for (const group of catalog.slotGroups) {
    if (group.id === "weapon") continue;
    lines.push(`### ${group.label}`);
    lines.push("");
    if (group.slots?.length) {
      lines.push(`Slots: \`${group.slots.join("`, `")}\``);
      lines.push("");
    }
    if (group.legacy) {
      lines.push("Legacy level-scaled rolls from each item's base stats (no fixed table yet).");
      lines.push("");
      continue;
    }
    for (const roll of group.rolls) {
      lines.push(`- ${roll}`);
    }
    lines.push("");
  }

  lines.push("## Per-item candidate pools");
  lines.push("");
  lines.push("Grouped by slot. Weapons show their class and actual roll pool from `empowerCandidateRolls()`.");
  lines.push("");

  const equippable = items
    .filter((item) => itemCanBeEmpowered(item))
    .sort((a, b) => {
      const slotOrder = String(a.slot ?? "").localeCompare(String(b.slot ?? ""));
      if (slotOrder !== 0) return slotOrder;
      const levelDiff = itemLevel(a) - itemLevel(b);
      if (levelDiff !== 0) return levelDiff;
      return String(a.name ?? a.id).localeCompare(String(b.name ?? b.id));
    });

  let currentSlot = null;
  for (const item of equippable) {
    const group = empowerSlotGroupForItem(item);
    const rolls = empowerRollDescriptionsForItem(item);
    const slotKey = group?.id ?? item.slot ?? "other";

    if (slotKey !== currentSlot) {
      currentSlot = slotKey;
      lines.push(`### ${group?.label ?? item.slot}`);
      lines.push("");
    }

    const tags = [];
    const classId = weaponEmpowerClass(item);
    if (classId) tags.push(weaponEmpowerClassLabel(classId));
    if (group?.legacy) tags.push("legacy");
    const tagText = tags.length ? ` (${tags.join(", ")})` : "";
    lines.push(`**${item.name ?? item.id}** (\`${item.id}\`)${tagText}`);
    if (!rolls.length) {
      lines.push("- *(legacy pool)*");
    } else {
      for (const roll of rolls) {
        lines.push(`- ${roll}`);
      }
    }
    lines.push("");
  }

  lines.push("## Still TODO / notes");
  lines.push("");
  lines.push("- Necklace: legacy rolls only — fixed table not defined.");
  lines.push("- Wizard/Tao-specific empower pools (beyond damage + spell) not started.");
  lines.push("- More spell-specific empowers (MP cost, etc.) not started.");
  lines.push("- `BOSS_EMPOWER_SKIP_REBIRTH_UNLOCK` may still be `true` for dev testing.");
  lines.push("- Set `BOSS_EMPOWER_ITEM_CHANCE_DEV` to `null` before release.");
  lines.push("");

  return lines.join("\n");
}

function buildHtml() {
  const catalog = empowerReferenceCatalog();
  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    catalog,
    items: items
      .filter((item) => itemCanBeEmpowered(item))
      .map((item) => {
        const classId = weaponEmpowerClass(item);
        return {
          id: item.id,
          name: item.name,
          slot: item.slot,
          level: itemLevel(item),
          groupId: empowerSlotGroupForItem(item)?.id ?? null,
          weaponClass: classId,
          weaponClassLabel: classId ? weaponEmpowerClassLabel(classId) : null,
          rolls: empowerRollDescriptionsForItem(item),
        };
      }),
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Empower reference (dev)</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #12100d; color: #e8dcc0; }
    header { padding: 16px 20px; border-bottom: 1px solid #4a3820; background: #1a140e; }
    h1 { margin: 0 0 6px; font-size: 20px; color: #ffe0a0; }
    .note { margin: 0; color: #bda678; font-size: 13px; }
    main { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: calc(100vh - 72px); }
    nav { border-right: 1px solid #4a3820; padding: 12px; overflow: auto; }
    nav button { display: block; width: 100%; margin: 0 0 6px; padding: 8px 10px; text-align: left;
      border: 1px solid #4a3820; background: #0f0c08; color: #d5bd88; cursor: pointer; }
    nav button.active { border-color: #f1d095; color: #ffe0a0; background: #35220e; }
    section { padding: 16px 20px; overflow: auto; }
    h2 { margin: 0 0 10px; color: #deb887; font-size: 16px; }
    h3 { margin: 18px 0 8px; color: #c9a86a; font-size: 14px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; }
    li.spell { color: #c9a0ff; }
    .meta { color: #9f8757; font-size: 12px; margin-bottom: 14px; }
    .class-card, .item-card { border: 1px solid #4a3820; background: #0f0c08; padding: 10px 12px; }
    .class-card { margin-bottom: 14px; }
    .class-card p, .item-card small { color: #9f8757; margin: 4px 0 8px; }
    .class-card strong, .item-card strong { color: #ffe0a0; }
    .item-grid { display: grid; gap: 10px; }
    .tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border: 1px solid #4a3820;
      border-radius: 3px; font-size: 10px; color: #c9a86a; }
    .tag.warrior { color: #e8a060; border-color: #6a4020; }
    .tag.wizard { color: #a0c9ff; border-color: #304a6a; }
    .tag.tao { color: #80d8a0; border-color: #2a5a3a; }
    .tag.universal { color: #ffe0a0; border-color: #6a5520; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .filter-row button { padding: 5px 10px; border: 1px solid #4a3820; background: #0f0c08; color: #d5bd88; cursor: pointer; }
    .filter-row button.active { border-color: #f1d095; color: #ffe0a0; }
  </style>
</head>
<body>
  <header>
    <h1>Empower reference</h1>
    <p class="note">Dev-only — regenerate with <code>npm run empower:ref</code>. Served at <code>/tools/empower-reference.html</code>.</p>
  </header>
  <main>
    <nav id="tabs"></nav>
    <section id="content"></section>
  </main>
  <script type="application/json" id="empower-data">${payload.replace(/</g, "\\u003c")}</script>
  <script>
    const data = JSON.parse(document.getElementById("empower-data").textContent);
    const tabs = document.getElementById("tabs");
    const content = document.getElementById("content");
    const views = [
      { id: "overview", label: "Overview" },
      ...data.catalog.slotGroups.map((g) => ({ id: g.id, label: g.label })),
      { id: "items", label: "Per item" },
    ];
    let active = "overview";
    let itemClassFilter = "all";

    function rollList(rolls) {
      return rolls.map((roll) => {
        const spell = /Flame Disruptor/.test(roll);
        return '<li class="' + (spell ? 'spell' : '') + '">' + roll + '</li>';
      }).join("");
    }

    function renderWeaponClassCard(weaponClass) {
      return '<article class="class-card">' +
        '<strong>' + weaponClass.label + '</strong>' +
        '<p>' + weaponClass.description + '</p>' +
        '<ul>' + rollList(weaponClass.rolls) + '</ul>' +
        '</article>';
    }

    function render() {
      tabs.innerHTML = views.map((v) =>
        '<button type="button" class="' + (active === v.id ? "active" : "") + '" data-view="' + v.id + '">' + v.label + '</button>'
      ).join("");

      tabs.querySelectorAll("button[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => { active = btn.dataset.view; render(); });
      });

      if (active === "overview") {
        const tiers = data.catalog.tierWeights.map((r) => r.tier + "× " + r.percent + "%").join(" · ");
        content.innerHTML =
          '<p class="meta">Generated ' + data.generatedAt.slice(0, 10) + '</p>' +
          '<h2>Drop rules</h2><ul>' +
          '<li>' + data.catalog.itemChancePercent + '% chance on equippable boss loot</li>' +
          '<li>Tiers: ' + tiers + ' (1–4 unique rolls per item)</li>' +
          '<li>Empowered names show one * per tier in loot log and inventory</li>' +
          '</ul>' +
          '<p class="meta">Open a slot tab for roll tables. Weapon uses class-based pools inside the Weapon tab.</p>';
        return;
      }

      if (active === "items") {
        const filters = [{ id: "all", label: "All" }].concat(
          (data.catalog.weaponClasses || []).map((c) => ({ id: c.id, label: c.label }))
        );
        const filterHtml = '<div class="filter-row">' + filters.map((f) =>
          '<button type="button" class="' + (itemClassFilter === f.id ? "active" : "") + '" data-filter="' + f.id + '">' + f.label + '</button>'
        ).join("") + '</div>';

        const filtered = data.items.filter((item) =>
          itemClassFilter === "all" || item.weaponClass === itemClassFilter
        );

        const byGroup = {};
        for (const item of filtered) {
          const key = item.groupId || item.slot || "other";
          if (!byGroup[key]) byGroup[key] = [];
          byGroup[key].push(item);
        }
        content.innerHTML = filterHtml + Object.entries(byGroup).map(([groupId, rows]) => {
          const label = data.catalog.slotGroups.find((g) => g.id === groupId)?.label || groupId;
          return '<h2>' + label + '</h2><div class="item-grid">' + rows.map((item) =>
            '<article class="item-card"><strong>' + item.name + '</strong> <small>(' + item.id + ')</small>' +
            (item.weaponClassLabel ? '<span class="tag ' + item.weaponClass + '">' + item.weaponClassLabel + '</span>' : '') +
            '<ul>' + (item.rolls.length ? rollList(item.rolls) : '<li><em>legacy pool</em></li>') + '</ul></article>'
          ).join("") + '</div>';
        }).join("");

        content.querySelectorAll("[data-filter]").forEach((btn) => {
          btn.addEventListener("click", () => { itemClassFilter = btn.dataset.filter; render(); });
        });
        return;
      }

      const group = data.catalog.slotGroups.find((g) => g.id === active);
      if (!group) { content.innerHTML = ""; return; }

      if (group.id === "weapon") {
        const rules = (data.catalog.weaponRules || []).map((rule) => "<li>" + rule + "</li>").join("");
        content.innerHTML =
          '<h2>' + group.label + '</h2>' +
          (group.rolls.length ? '<h3>Always available</h3><ul>' + rollList(group.rolls) + '</ul>' : '') +
          '<h3>Classification</h3><ul>' + rules + '</ul>' +
          '<h3>Empower pools by class</h3>' +
          (data.catalog.weaponClasses || []).map(renderWeaponClassCard).join("");
        return;
      }

      content.innerHTML =
        '<h2>' + group.label + '</h2>' +
        (group.legacy ? '<p>Legacy level-scaled rolls.</p>' : '<ul>' + rollList(group.rolls) + '</ul>');
    }
    render();
  </script>
</body>
</html>`;
}

const markdown = buildMarkdown();
writeFileSync(mdPath, markdown, "utf8");
writeFileSync(htmlPath, buildHtml(), "utf8");
console.log(`Wrote ${mdPath}`);
console.log(`Wrote ${htmlPath}`);
