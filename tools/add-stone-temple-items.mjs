import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const selectionPath = path.join(root, "content-audit/phase-1/warrior-item-selection.csv");
const idlePath = path.join(root, "content-audit/phase-1/idle-drop-items.csv");

const newSelectionRows = [
  [488, "StrainBracelet", "Bracelet", "Level 24", "Any", "Any", 201, 0, 5000, "DC 1-1, AC 0-1"],
  [484, "MagicBracelet", "Bracelet", "Level 18", "Any", "Any", 205, 0, 5000, "AC 0-1, AMC 1-2"],
  [550, "BlueJadeNecklace", "Necklace", "Level 23", "Any", "Any", 246, 0, 7000, "DC 2-2"],
  [418, "MoralRing", "Ring", "Level 23", "Any", "Any", 153, 0, 4000, "SC 1-2"],
  [412, "SkeletonRing", "Ring", "Level 30", "Any", "Any", 177, 0, 5000, "DC 0-3"],
  [599, "SkeletonHelmet", "Helmet", "Level 30", "Any", "Any", 103, 0, 8000, "AC 2-3"],
  [556, "LifeNecklace", "Necklace", "MaxMC 25", "Any", "Any", 320, 0, 15000, "MC 1-5"],
  [498, "SteelGlove", "Bracelet", "Level 30", "Any", "Any", 187, 0, 20000, "AC 0-4"],
  [675, "ImpactDrug(S)", "Potion", "Level 0", "Any", "Any", 425, 3, 1000, "Warrior buff (S)"],
  [678, "MagicDrug(S)", "Potion", "Level 0", "Any", "Any", 423, 3, 1000, "Wizard buff (S)"],
  [681, "TaoistDrug(S)", "Potion", "Level 0", "Any", "Any", 421, 3, 1000, "Taoist buff (S)"],
];

const newIdleRows = {
  "strain-bracelet": { st1: 0.003, st2: 0.004, wb: 0.01 },
  "magic-bracelet": { st1: 0.003, st2: 0.004, wb: 0.01 },
  "blue-jade-necklace": { st2: 0.003, wb: 0.01 },
  "moral-ring": { st2: 0.002, wb: 0.006 },
  "skeleton-ring": { st2: 0.002, wb: 0.005 },
  "skeleton-helmet": { wb: 0.008 },
  "life-necklace": { wb: 0.003 },
  "steel-glove": { wb: 0.006 },
  "impact-drug-s": { wb: 0.015 },
  "magic-drug-s": { wb: 0.015 },
  "taoist-drug-s": { wb: 0.015 },
};

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
  const added = [];
  for (const row of newSelectionRows) {
    if (existing.has(row[1])) continue;
    added.push(stringifyRow(row));
  }
  if (!added.length) return 0;
  fs.writeFileSync(selectionPath, `${lines.join("\n")}\n${added.join("\n")}\n`);
  return added.length;
}

function patchIdleDrops() {
  const text = fs.readFileSync(idlePath, "utf8").trimEnd();
  const lines = text.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const col1 = "Stone Temple 1 chance";
  const col2 = "Stone Temple 2 chance";
  const colW = "White Boar chance";
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const meta = {
    "strain-bracelet": ["Strain Bracelet", "bracelet", "bracelet", "any", "level 24", "DC 1-1, AC 0-1", 488, "StrainBracelet"],
    "magic-bracelet": ["Magic Bracelet", "bracelet", "bracelet", "any", "level 18", "AC 0-1, AMC 1-2", 484, "MagicBracelet"],
    "blue-jade-necklace": ["Blue Jade Necklace", "necklace", "necklace", "any", "level 23", "DC 2-2", 550, "BlueJadeNecklace"],
    "moral-ring": ["Moral Ring", "ring", "ring", "any", "level 23", "SC 1-2", 418, "MoralRing"],
    "skeleton-ring": ["Skeleton Ring", "ring", "ring", "any", "level 30", "DC 0-3", 412, "SkeletonRing"],
    "skeleton-helmet": ["Skeleton Helmet", "helmet", "helmet", "any", "level 30", "AC 2-3", 599, "SkeletonHelmet"],
    "life-necklace": ["Life Necklace", "necklace", "necklace", "any", "maxMC 25", "MC 1-5", 556, "LifeNecklace"],
    "steel-glove": ["Steel Glove", "bracelet", "bracelet", "any", "level 30", "AC 0-4", 498, "SteelGlove"],
    "impact-drug-s": ["Impact Drug (S)", "potion", "consumable", "any", "", "Warrior buff", 675, "ImpactDrug(S)"],
    "magic-drug-s": ["Magic Drug (S)", "potion", "consumable", "any", "", "Wizard buff", 678, "MagicDrug(S)"],
    "taoist-drug-s": ["Taoist Drug (S)", "potion", "consumable", "any", "", "Taoist buff", 681, "TaoistDrug(S)"],
  };

  const out = [lines[0]];
  const existingIds = new Set();

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    while (cells.length < header.length) cells.push("");
    const id = cells[idx["Item ID"]];
    existingIds.add(id);
    const patch = newIdleRows[id];
    if (patch) {
      if (patch.st1 != null) cells[idx[col1]] = String(patch.st1);
      if (patch.st2 != null) cells[idx[col2]] = String(patch.st2);
      if (patch.wb != null) cells[idx[colW]] = String(patch.wb);
      const notes = cells[idx.Notes] || "";
      if (!notes.includes("Stone Temple")) cells[idx.Notes] = notes ? `${notes}; Stone Temple` : "Stone Temple";
    }
    out.push(stringifyRow(cells));
  }

  for (const [id, patch] of Object.entries(newIdleRows)) {
    if (existingIds.has(id)) continue;
    const m = meta[id];
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
    cells[idx.Notes] = "Stone Temple";
    if (patch.st1 != null) cells[idx[col1]] = String(patch.st1);
    if (patch.st2 != null) cells[idx[col2]] = String(patch.st2);
    if (patch.wb != null) cells[idx[colW]] = String(patch.wb);
    out.push(stringifyRow(cells));
  }

  fs.writeFileSync(idlePath, `${out.join("\n")}\n`);
  return Object.keys(newIdleRows).length;
}

const sel = appendSelection();
const idle = patchIdleDrops();
console.log(`Added ${sel} warrior selection rows, patched ${idle} idle drop items.`);
