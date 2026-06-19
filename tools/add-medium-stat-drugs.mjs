import fs from "node:fs";
import path from "node:path";
import { copyItemIcon, frameFileName } from "./item-icon-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalItems = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/crystal-items.json"), "utf8"),
).items;
const itemsPath = path.join(root, "src/data/items.json");
const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const publicIconRoot = path.join(root, "public/item-icons/items");

const DRUGS = [
  {
    crystalName: "ImpactDrug(M)",
    id: "impact-drug-m",
    displayName: "Impact Drug (M)",
    buff: { kind: "impact", label: "Impact", stat: "dc", classes: ["Warrior"], minBonus: 0, maxBonus: 7 },
  },
  {
    crystalName: "MagicDrug(M)",
    id: "magic-drug-m",
    displayName: "Magic Drug (M)",
    buff: { kind: "magic", label: "Magic", stat: "mc", classes: ["Wizard"], minBonus: 0, maxBonus: 5 },
  },
  {
    crystalName: "TaoistDrug(M)",
    id: "taoist-drug-m",
    displayName: "Taoist Drug (M)",
    buff: { kind: "taoist", label: "Taoist", stat: "sc", classes: ["Taoist"], minBonus: 0, maxBonus: 5 },
  },
];

const ZUMA_TEMPLE_2_DROP = {
  zones: ["zone-zuma-temple-2"],
  chance: 0.015,
  chances: {},
  enemyChances: {
    271: { "zone-zuma-temple-2": 0.015 },
  },
};

function copyIcon(frame) {
  return copyItemIcon(root, frame, publicIconRoot);
}

function normalStats(stats = {}) {
  return {
    ac: stats.ac ?? [0, 0],
    amc: stats.amc ?? [0, 0],
    dc: stats.dc ?? [0, 0],
    mc: stats.mc ?? [0, 0],
    sc: stats.sc ?? [0, 0],
    hp: Number(stats.hp) || 0,
    mp: Number(stats.mp) || 0,
    accuracy: Number(stats.accuracy) || 0,
    agility: Number(stats.agility) || 0,
    luck: Number(stats.luck) || 0,
    attackSpeed: Number(stats.attackSpeed) || 0,
  };
}

function potionFromCrystal(crystal, id, displayName) {
  const frame = crystal.icon?.frame ?? crystal.image;
  if (frame != null) copyIcon(frame);
  return {
    id,
    name: displayName,
    type: "potion",
    slot: "consumable",
    class: "any",
    source: { crystalIndex: crystal.crystalIndex, name: crystal.name },
    icon: {
      library: "Items",
      frame,
      src: `./public/item-icons/items/${frameFileName(frame)}`,
    },
    requirements: {
      type: "none",
      amount: 0,
      classMask: 31,
      genderMask: 3,
    },
    stackable: true,
    maxStack: 64,
    stats: normalStats(crystal.stats),
    shop: {
      buy: Number(crystal.price) || 0,
      sell: Math.max(1, Math.floor((Number(crystal.price) || 0) / 5)),
    },
    shape: Number(crystal.shape) || 3,
    drop: ZUMA_TEMPLE_2_DROP,
    crystalType: "Potion",
  };
}

const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const added = [];
for (const drug of DRUGS) {
  const crystal = crystalItems.find((item) => item.name === drug.crystalName);
  if (!crystal) {
    console.warn(`Missing crystal item: ${drug.crystalName}`);
    continue;
  }
  if (existingIds.has(drug.id)) {
    const existing = itemsDoc.items.find((item) => item.id === drug.id);
    existing.drop = ZUMA_TEMPLE_2_DROP;
    console.log(`Updated drop for ${drug.id}`);
    continue;
  }
  itemsDoc.items.push(potionFromCrystal(crystal, drug.id, drug.displayName));
  existingIds.add(drug.id);
  added.push(drug.id);
}

if (added.length) {
  fs.writeFileSync(itemsPath, `${JSON.stringify(itemsDoc, null, 2)}\n`, "utf8");
}
console.log(`Added ${added.length} medium stat drugs: ${added.join(", ") || "(none)"}`);

const selectionPath = path.join(root, "content-audit/phase-1/warrior-item-selection.csv");
const idlePath = path.join(root, "content-audit/phase-1/idle-drop-items.csv");

const newSelectionRows = [
  [676, "ImpactDrug(M)", "Potion", "Level 0", "Any", "Any", 425, 3, 1000, "Warrior buff (M)"],
  [679, "MagicDrug(M)", "Potion", "Level 0", "Any", "Any", 423, 3, 1000, "Wizard buff (M)"],
  [682, "TaoistDrug(M)", "Potion", "Level 0", "Any", "Any", 421, 3, 1000, "Taoist buff (M)"],
];

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function stringifyRow(cells) {
  return cells
    .map((cell) => {
      const s = String(cell ?? "");
      return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

function appendSelection() {
  const text = fs.readFileSync(selectionPath, "utf8").trimEnd();
  const lines = text.split(/\r?\n/);
  const existing = new Set(lines.slice(1).map((line) => line.split(",")[1]));
  const addedRows = [];
  for (const row of newSelectionRows) {
    if (existing.has(row[1])) continue;
    addedRows.push(stringifyRow(row));
  }
  if (!addedRows.length) return 0;
  fs.writeFileSync(selectionPath, `${lines.join("\n")}\n${addedRows.join("\n")}\n`);
  return addedRows.length;
}

function patchIdleDrops() {
  const text = fs.readFileSync(idlePath, "utf8").trimEnd();
  const lines = text.split(/\r?\n/);
  let header = parseCsvLine(lines[0]);
  const redThunderCol = "Red Thunder Zuma chance";
  if (!header.includes(redThunderCol)) {
    const zuma2Idx = header.indexOf("Zuma Temple 2 chance");
    header.splice(zuma2Idx + 1, 0, redThunderCol);
    lines[0] = stringifyRow(header);
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const meta = {
    "impact-drug-m": ["Impact Drug (M)", "potion", "consumable", "any", "", "Warrior buff", 676, "ImpactDrug(M)"],
    "magic-drug-m": ["Magic Drug (M)", "potion", "consumable", "any", "", "Wizard buff", 679, "MagicDrug(M)"],
    "taoist-drug-m": ["Taoist Drug (M)", "potion", "consumable", "any", "", "Taoist buff", 682, "TaoistDrug(M)"],
  };

  const out = [lines[0]];
  const existingIds = new Set();
  let patched = 0;

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    while (cells.length < header.length) cells.push("");
    if (cells.length > header.length) cells.length = header.length;
    const id = cells[idx["Item ID"]];
    existingIds.add(id);
    if (meta[id]) {
      cells[idx[redThunderCol]] = "0.015";
      const notes = cells[idx.Notes] || "";
      if (!notes.includes("Zuma Temple")) cells[idx.Notes] = notes ? `${notes}; Zuma Temple` : "Zuma Temple";
      patched += 1;
    }
    out.push(stringifyRow(cells));
  }

  for (const [id, m] of Object.entries(meta)) {
    if (existingIds.has(id)) continue;
    const cells = Array(header.length).fill("");
    cells[idx["Keep?"]] = "yes";
    cells[idx["Item ID"]] = id;
    cells[idx.Name] = m[0];
    cells[idx.Type] = m[1];
    cells[idx.Slot] = m[2];
    cells[idx.Class] = m[3];
    cells[idx.Requirement] = m[4];
    cells[idx.Stats] = m[5];
    cells[idx["Crystal Index"]] = String(m[6]);
    cells[idx["Crystal Name"]] = m[7];
    cells[idx.Notes] = "Zuma Temple";
    cells[idx[redThunderCol]] = "0.015";
    out.push(stringifyRow(cells));
    patched += 1;
  }

  fs.writeFileSync(idlePath, `${out.join("\n")}\n`);
  return patched;
}

const sel = appendSelection();
const idle = patchIdleDrops();
console.log(`CSV: added ${sel} selection rows, patched ${idle} idle drop rows.`);
