import fs from "node:fs";

const csvPath = new URL("../content-audit/phase-1/idle-drop-items.csv", import.meta.url);
const text = fs.readFileSync(csvPath, "utf8");
const lines = text.trimEnd().split(/\r?\n/);
const header = lines[0].split(",");
const colZt1 = "Zuma Temple 1 chance";
const colZt2 = "Zuma Temple 2 chance";
for (const col of [colZt1, colZt2]) {
  if (!header.includes(col)) header.push(col);
}
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const zumaTempleRate = 0.005;
const zumaPool = [
  "platinum-necklace",
  "blue-jade-necklace",
  "convex-lens",
  "bamboo-pipe",
  "moral-ring",
  "iron-ring",
  "charm-ring",
  "skeleton-ring",
  "coral-ring",
  "sun-potion",
  "sun-potion-medium",
  "iron-armour",
  "wizard-robe",
  "pearl-armour",
  "skeleton-helmet",
  "shaman-helmet",
  "dcstone-xl",
  "mcstone-xl",
  "scstone-xl",
];

const newRows = [
  ["yes", "iron-armour", "Iron Armour", "armour", "armour", "any", "level 33", "AC 5-15, AMC 3-4", "333", "IronArmour(M)"],
  ["yes", "wizard-robe", "Wizard Robe", "armour", "armour", "any", "level 33", "MC 3-5, AC 3-5, AMC 4-5", "335", "WizardRobe(M)"],
  ["yes", "pearl-armour", "Pearl Armour", "armour", "armour", "any", "level 33", "SC 2-5, AC 3-6, AMC 3-4", "337", "PearlArmour(M)"],
  ["yes", "dcstone-xl", "DCStone (XL)", "stone", "stone", "any", "level 38", "DC 2-3", "645", "DCStone(XL)"],
  ["yes", "mcstone-xl", "MCStone (XL)", "stone", "stone", "any", "level 38", "MC 2-3", "650", "MCStone(XL)"],
  ["yes", "scstone-xl", "SCStone (XL)", "stone", "stone", "any", "level 38", "SC 2-3", "655", "SCStone(XL)"],
  ["yes", "zuma-judgement-mace", "Zuma Judgement Mace", "weapon", "weapon", "any", "level 29", "DC 15-32", "243", "ZumaJudgementMace"],
  ["yes", "zuma-war-mage-staff", "Zuma War Mage Staff", "weapon", "weapon", "any", "level 29", "MC 13-26", "258", "ZumaWarMageStaff"],
  ["yes", "zuma-soul-spring-wand", "Zuma Soul Spring Wand", "weapon", "weapon", "any", "level 29", "SC 13-24", "271", "ZumaSoulSpringWand"],
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

const existingIds = new Set();
const out = [stringifyRow(header)];
for (let li = 1; li < lines.length; li++) {
  const cells = parseCsvLine(lines[li]);
  while (cells.length < header.length) cells.push("");
  const id = cells[idx["Item ID"]];
  existingIds.add(id);
  if (zumaPool.includes(id)) {
    cells[idx[colZt1]] = String(zumaTempleRate);
    cells[idx[colZt2]] = String(zumaTempleRate);
    const notesIdx = idx.Notes;
    if (notesIdx != null) {
      const note = cells[notesIdx] ?? "";
      if (!note.includes("Zuma Temple")) {
        cells[notesIdx] = note ? `${note}; Zuma Temple` : "Zuma Temple";
      }
    }
  }
  out.push(stringifyRow(cells));
}

for (const row of newRows) {
  const id = row[1];
  if (existingIds.has(id)) continue;
  const cells = Array(header.length).fill("");
  for (const [key, colIdx] of Object.entries(idx)) {
    const sourceIdx = ["Keep?", "Item ID", "Name", "Type", "Slot", "Class", "Requirement", "Stats", "Crystal Index", "Crystal Name"].indexOf(key);
    if (sourceIdx >= 0) cells[colIdx] = row[sourceIdx] ?? "";
  }
  if (zumaPool.includes(id)) {
    cells[idx[colZt1]] = String(zumaTempleRate);
    cells[idx[colZt2]] = String(zumaTempleRate);
  }
  cells[idx.Notes] = "Zuma Temple";
  out.push(stringifyRow(cells));
}

fs.writeFileSync(csvPath, `${out.join("\n")}\n`);
console.log(`Updated ${csvPath.pathname} (${out.length - 1} rows, ${zumaPool.length} Zuma pool items @ ${zumaTempleRate})`);
