const DATA_ROOT = new URL("../../src/data/", import.meta.url);

const RARITIES = [
  { id: "common", label: "Common", pct: 15, chance: 0.15, className: "common" },
  { id: "uncommon", label: "Uncommon", pct: 10, chance: 0.1, className: "uncommon" },
  { id: "rare", label: "Rare", pct: 5, chance: 0.05, className: "rare" },
  { id: "ultra", label: "Ultra", pct: 2.5, chance: 0.025, className: "ultra" },
  { id: "epic", label: "Epic", pct: 1, chance: 0.01, className: "epic" },
  { id: "mythical", label: "Mythical", pct: 0.5, chance: 0.005, className: "mythical" },
];

const rarityById = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
const STORAGE_KEY = "lom-drop-pool-builder-v1";

const state = {
  category: "all",
  q: "",
  sort: "name-asc",
  hideInPool: false,
  dropsOnly: false,
  zoneId: "",
  zones: [],
  items: [],
  pool: {},
  loadedAt: null,
};

const els = {
  zoneSelect: document.getElementById("zoneSelect"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  hideInPool: document.getElementById("hideInPool"),
  dropsOnly: document.getElementById("dropsOnly"),
  reloadBtn: document.getElementById("reloadBtn"),
  clearPoolBtn: document.getElementById("clearPoolBtn"),
  status: document.getElementById("status"),
  categoryTabs: document.getElementById("categoryTabs"),
  rows: document.getElementById("rows"),
  empty: document.getElementById("empty"),
  poolList: document.getElementById("poolList"),
  poolCount: document.getElementById("poolCount"),
  poolZoneHint: document.getElementById("poolZoneHint"),
  exportText: document.getElementById("exportText"),
  generateBtn: document.getElementById("generateBtn"),
  copyBtn: document.getElementById("copyBtn"),
};

async function fetchJson(pathname) {
  const response = await fetch(new URL(pathname, DATA_ROOT), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${pathname} (${response.status})`);
  }
  return response.json();
}

function statMax(range) {
  return Math.max(Number(range?.[0] ?? 0), Number(range?.[1] ?? 0));
}

function statRangeText(range) {
  const min = Number(range?.[0] ?? 0);
  const max = Number(range?.[1] ?? 0);
  if (min === 0 && max === 0) return "";
  if (min === max) return String(min);
  return `${min}-${max}`;
}

function statsSummary(item) {
  const stats = item.stats ?? {};
  const parts = [];
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    const value = statRangeText(stats[key]);
    if (value) parts.push(`${key.toUpperCase()} ${value}`);
  }
  for (const [key, label] of [
    ["hp", "HP"],
    ["mp", "MP"],
    ["accuracy", "Acc"],
    ["agility", "Agi"],
    ["luck", "Luck"],
    ["attackSpeed", "ASpeed"],
  ]) {
    if (stats[key]) parts.push(`${label} ${stats[key]}`);
  }
  return parts.join(", ") || "�";
}

function statsPower(item) {
  const stats = item.stats ?? {};
  return (
    statMax(stats.dc) +
    statMax(stats.mc) +
    statMax(stats.sc) +
    statMax(stats.ac) +
    statMax(stats.amc) +
    Number(stats.hp || 0) +
    Number(stats.mp || 0)
  );
}

function requirementText(item) {
  const req = item.requirements;
  if (!req?.amount) return "�";
  return `${req.type ?? "level"} ${req.amount}`;
}

function levelRequirement(item) {
  const req = item.requirements;
  if (!req?.amount) return 0;
  if (req.type === "level" || req.type === "maxLevel") return req.amount;
  return 0;
}

function statRequirement(item) {
  const req = item.requirements;
  if (!req?.amount) return 0;
  if (req.type === "level" || req.type === "maxLevel" || req.type === "none") return 0;
  return req.amount;
}

function currentDropText(item, zoneId) {
  if (!zoneId || !item.drop?.zones?.includes(zoneId)) return "�";
  const chance = item.drop?.chances?.[zoneId] ?? item.drop?.chance;
  if (!Number.isFinite(Number(chance))) return "In zone";
  return `${(Number(chance) * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function iconSrc(item) {
  const src = item.icon?.src ?? "";
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const cleaned = src.replace(/^\.\//, "").replace(/^\//, "");
  return `/${cleaned}`;
}

function poolKey(zoneId, itemId) {
  return `${zoneId}::${itemId}`;
}

function getPoolEntries() {
  return Object.values(state.pool).filter((entry) => entry.zoneId === state.zoneId);
}

function savePool() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pool));
}

function loadPool() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.pool = raw ? JSON.parse(raw) : {};
  } catch {
    state.pool = {};
  }
}

function setStatus(text, isError = false) {
  if (!els.status) return;
  els.status.textContent = text;
  els.status.classList.toggle("error", isError);
}

function populateZones() {
  if (!els.zoneSelect) return;
  for (const zone of state.zones) {
    const option = document.createElement("option");
    option.value = zone.id;
    option.textContent = `${zone.label ?? zone.id} (${zone.id})`;
    els.zoneSelect.append(option);
  }
}

async function loadZones() {
  const data = await fetchJson("zones.json");
  state.zones = Array.isArray(data.zones) ? data.zones : [];
  populateZones();
}

async function loadItems() {
  setStatus("Loading items�");
  const data = await fetchJson("items.json");
  state.items = Array.isArray(data.items) ? data.items : [];
  state.loadedAt = new Date();
  setStatus(
    `Loaded ${state.items.length} items and ${state.zones.length} zones � ${state.loadedAt.toLocaleTimeString()}`,
  );
  renderCategoryTabs();
  render();
}

function typeCounts() {
  const counts = new Map([["all", state.items.length]]);
  for (const item of state.items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  }
  return counts;
}

function renderCategoryTabs() {
  const counts = typeCounts();
  const types = [...counts.keys()].filter((key) => key !== "all").sort();
  els.categoryTabs.innerHTML = "";

  for (const type of ["all", ...types]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tab-btn${state.category === type ? " active" : ""}`;
    btn.dataset.category = type;
    btn.innerHTML = `${type === "all" ? "All items" : type}<span class="count">${counts.get(type)}</span>`;
    btn.addEventListener("click", () => {
      state.category = type;
      renderCategoryTabs();
      render();
    });
    els.categoryTabs.append(btn);
  }
}

function compareItems(a, b) {
  switch (state.sort) {
    case "name-desc":
      return b.name.localeCompare(a.name) || a.id.localeCompare(b.id);
    case "level-desc":
      return levelRequirement(b) - levelRequirement(a) || b.name.localeCompare(a.name);
    case "level-asc":
      return levelRequirement(a) - levelRequirement(b) || a.name.localeCompare(b.name);
    case "req-desc":
      return statRequirement(b) - statRequirement(a) || b.name.localeCompare(a.name);
    case "req-asc":
      return statRequirement(a) - statRequirement(b) || a.name.localeCompare(b.name);
    case "stats-desc":
      return statsPower(b) - statsPower(a) || b.name.localeCompare(a.name);
    case "stats-asc":
      return statsPower(a) - statsPower(b) || a.name.localeCompare(b.name);
    case "type-name":
      return String(a.type).localeCompare(String(b.type)) || a.name.localeCompare(b.name);
    case "name-asc":
    default:
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  }
}

function matchesSearch(item) {
  if (!state.q) return true;
  const haystack = [
    item.id,
    item.name,
    item.type,
    item.slot,
    item.class,
    requirementText(item),
    statsSummary(item),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.q);
}

function filteredItems() {
  return state.items
    .filter((item) => state.category === "all" || item.type === state.category)
    .filter(matchesSearch)
    .filter((item) => !state.dropsOnly || (Array.isArray(item.drop?.zones) && item.drop.zones.length > 0))
    .filter((item) => {
      if (!state.hideInPool || !state.zoneId) return true;
      return !state.pool[poolKey(state.zoneId, item.id)];
    })
    .sort(compareItems);
}

function addToPool(item, rarityId) {
  if (!state.zoneId) {
    setStatus("Select a target zone before adding items.", true);
    return;
  }
  const rarity = rarityById[rarityId];
  const key = poolKey(state.zoneId, item.id);
  state.pool[key] = {
    zoneId: state.zoneId,
    itemId: item.id,
    itemName: item.name,
    itemType: item.type,
    rarityId,
    rarityLabel: rarity.label,
    chance: rarity.chance,
    pct: rarity.pct,
  };
  savePool();
  render();
}

function removeFromPool(itemId) {
  delete state.pool[poolKey(state.zoneId, itemId)];
  savePool();
  render();
}

function renderItemRows(items) {
  els.rows.innerHTML = "";
  for (const item of items) {
    const inPool = Boolean(state.zoneId && state.pool[poolKey(state.zoneId, item.id)]);
    const poolEntry = inPool ? state.pool[poolKey(state.zoneId, item.id)] : null;
    const tr = document.createElement("tr");
    if (inPool) tr.classList.add("in-pool");

    const icon = iconSrc(item);
    tr.innerHTML = `
      <td>${icon ? `<img class="icon" src="${icon}" alt="" loading="lazy" />` : ""}</td>
      <td>
        <div class="name">${item.name}</div>
        <div class="code">${item.id}</div>
        <div class="muted">${item.type}${item.class && item.class !== "any" ? ` � ${item.class}` : ""}</div>
      </td>
      <td>${requirementText(item)}</td>
      <td class="muted">${statsSummary(item)}</td>
      <td>${currentDropText(item, state.zoneId)}</td>
      <td></td>
    `;

    const actions = tr.lastElementChild;
    const group = document.createElement("div");
    group.className = "rarity-group";
    for (const rarity of RARITIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `rarity-btn ${rarity.className}${poolEntry?.rarityId === rarity.id ? " selected" : ""}`;
      btn.title = `${rarity.label} (${rarity.pct}%)`;
      btn.textContent = rarity.label;
      btn.addEventListener("click", () => addToPool(item, rarity.id));
      group.append(btn);
    }
    actions.append(group);
    els.rows.append(tr);
  }
}

function renderPool() {
  const entries = getPoolEntries().sort((a, b) => a.itemName.localeCompare(b.itemName));
  els.poolCount.textContent = String(entries.length);
  const zone = state.zones.find((z) => z.id === state.zoneId);
  els.poolZoneHint.textContent = zone
    ? `Building pool for ${zone.label} (${zone.id})`
    : "Select a zone to start building a drop pool.";

  if (!entries.length) {
    els.poolList.innerHTML = `<div class="pool-empty">No items in the pool for this zone yet.</div>`;
    return;
  }

  els.poolList.innerHTML = "";
  for (const entry of entries) {
    const div = document.createElement("div");
    div.className = "pool-item";
    div.innerHTML = `
      <div class="top">
        <div>
          <div class="name">${entry.itemName}</div>
          <div class="code">${entry.itemId}</div>
          <div class="muted">${entry.itemType}</div>
        </div>
        <button type="button" class="remove" aria-label="Remove">�</button>
      </div>
      <div style="margin-top:8px">
        <span class="badge pool">${entry.rarityLabel} � ${entry.pct}% � ${entry.chance}</span>
      </div>
    `;
    div.querySelector(".remove").addEventListener("click", () => removeFromPool(entry.itemId));
    els.poolList.append(div);
  }
}

function generateExport() {
  const entries = getPoolEntries().sort((a, b) => a.itemName.localeCompare(b.itemName));
  if (!state.zoneId) {
    els.exportText.value = "Select a target zone first.";
    return;
  }
  if (!entries.length) {
    els.exportText.value = "Add at least one item to the drop pool before exporting.";
    return;
  }

  const zone = state.zones.find((z) => z.id === state.zoneId);
  const zoneLabel = zone?.label ?? state.zoneId;
  const lines = [
    "Please add or update these zone drop chances in the game:",
    "",
    `Zone: ${zoneLabel} (${state.zoneId})`,
    "",
    "Drop pool changes:",
  ];

  for (const entry of entries) {
    lines.push(
      `- ${entry.itemName} (${entry.itemId}) � ${entry.rarityLabel} (${entry.pct}%, chance ${entry.chance})`,
    );
  }

  lines.push(
    "",
    "Implementation notes:",
    "- Update src/data/items.json drop blocks for the zone above (or idle-drop-items.csv + rebuild if that's the workflow).",
    "- Each item gets drop.zones including this zone and drop.chances[zoneId] set to the chance value.",
    "",
    "CLI shortcut (merge-item-drops.mjs):",
    `node tools/merge-item-drops.mjs --zone ${state.zoneId}${entries
      .map((entry) => ` --item ${entry.itemId}=${entry.chance}`)
      .join("")}`,
  );

  els.exportText.value = lines.join("\n");
}

function render() {
  const items = filteredItems();
  renderItemRows(items);
  els.empty.classList.toggle("hidden", items.length > 0);
  renderPool();
}

async function reloadAll() {
  await loadZones();
  await loadItems();
}

els.zoneSelect.addEventListener("change", () => {
  state.zoneId = els.zoneSelect.value;
  render();
});
els.search.addEventListener("input", () => {
  state.q = els.search.value.trim().toLowerCase();
  render();
});
els.sort.addEventListener("change", () => {
  state.sort = els.sort.value;
  render();
});
els.hideInPool.addEventListener("change", () => {
  state.hideInPool = els.hideInPool.checked;
  render();
});
els.dropsOnly.addEventListener("change", () => {
  state.dropsOnly = els.dropsOnly.checked;
  render();
});
els.reloadBtn.addEventListener("click", () => {
  reloadAll().catch((error) => setStatus(error.message, true));
});
els.clearPoolBtn.addEventListener("click", () => {
  if (!state.zoneId) return;
  for (const entry of getPoolEntries()) {
    delete state.pool[poolKey(entry.zoneId, entry.itemId)];
  }
  savePool();
  els.exportText.value = "";
  render();
});
els.generateBtn.addEventListener("click", generateExport);
els.copyBtn.addEventListener("click", async () => {
  if (!els.exportText.value.trim()) generateExport();
  try {
    await navigator.clipboard.writeText(els.exportText.value);
    setStatus("Export copied to clipboard.");
  } catch {
    els.exportText.select();
    document.execCommand("copy");
    setStatus("Export selected � press Ctrl+C to copy.");
  }
});

loadPool();
reloadAll().catch((error) => {
  setStatus(
    `${error.message}. Open this tool through npm run dev at http://localhost:4177/tools/drop-pool-builder/index.html`,
    true,
  );
});
