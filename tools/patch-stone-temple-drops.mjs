import fs from "node:fs";

const csvPath = new URL("../content-audit/phase-1/idle-drop-items.csv", import.meta.url);
const text = fs.readFileSync(csvPath, "utf8");
const lines = text.trimEnd().split(/\r?\n/);
const header = lines[0].split(",");
const col1 = "Stone Temple 1 chance";
const col2 = "Stone Temple 2 chance";
const colW = "White Boar chance";
for (const c of [col1, col2, colW]) {
  if (!header.includes(c)) header.push(c);
}
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const st1 = {
  "hp-drug-medium": 0.016,
  "mp-drug-medium": 0.016,
  "sun-potion": 0.01,
  "sun-potion-medium": 0.004,
  "hp-drug-small": 0.01,
  "mp-drug-small": 0.008,
  "prince-dagger": 0.004,
  "martial-sword": 0.004,
  "kriss-sword": 0.004,
  "steel-sword": 0.005,
  "power-axe": 0.002,
  "heavy-armour": 0.004,
  "magic-robe": 0.004,
  "soul-armour": 0.004,
  "brass-helmet": 0.005,
  "black-ring": 0.004,
  "death-gauntlet": 0.003,
  "gold-bracelet": 0.003,
  "horn-ring": 0.004,
  "bronze-helmet": 0.003,
  "iron-sword": 0.003,
  "hooked-sword": 0.003,
  "dcstone-m": 0.0004,
};

const st2 = {
  "hp-drug-medium": 0.018,
  "mp-drug-medium": 0.018,
  "hp-drug-large": 0.003,
  "mp-drug-large": 0.003,
  "sun-potion": 0.012,
  "sun-potion-medium": 0.006,
  "hp-drug-small": 0.01,
  "mp-drug-small": 0.008,
  "prince-dagger": 0.005,
  "martial-sword": 0.005,
  "kriss-sword": 0.005,
  "power-axe": 0.003,
  "purifier-sword": 0.002,
  "heavy-armour": 0.006,
  "magic-robe": 0.006,
  "soul-armour": 0.006,
  "steel-belt": 0.004,
  "shaman-helmet": 0.002,
  "death-gauntlet": 0.004,
  "gold-bracelet": 0.004,
  "black-ring": 0.004,
  "charm-ring": 0.003,
  "claw-necklace": 0.003,
  "convex-lens": 0.003,
  "bamboo-pipe": 0.003,
  "black-iron-belt": 0.002,
  "expel-ring": 0.001,
};

const whiteBoar = {
  "hp-drug-large": 0.08,
  "mp-drug-large": 0.08,
  "sun-potion-medium": 0.025,
  "purifier-sword": 0.02,
  "heavy-armour": 0.012,
  "magic-robe": 0.012,
  "soul-armour": 0.012,
  "shaman-helmet": 0.008,
  "death-gauntlet": 0.01,
  "great-axe": 0.004,
  "mage-staff": 0.004,
  "serpent-sword": 0.004,
  "black-boots": 0.005,
  "spell-bracelet": 0.004,
  "dcstone-l": 0.003,
  "mcstone-l": 0.003,
  "scstone-l": 0.003,
  "expel-ring": 0.006,
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

const out = [stringifyRow(header)];
for (let li = 1; li < lines.length; li++) {
  const cells = parseCsvLine(lines[li]);
  while (cells.length < header.length) cells.push("");
  const id = cells[idx["Item ID"]];
  if (st1[id] != null) cells[idx[col1]] = String(st1[id]);
  if (st2[id] != null) cells[idx[col2]] = String(st2[id]);
  if (whiteBoar[id] != null) cells[idx[colW]] = String(whiteBoar[id]);
  const notesIdx = idx.Notes;
  if (notesIdx != null && cells[notesIdx] && (st1[id] || st2[id] || whiteBoar[id])) {
    if (!cells[notesIdx].includes("Stone Temple")) {
      cells[notesIdx] = cells[notesIdx] ? `${cells[notesIdx]}; Stone Temple` : "Stone Temple";
    }
  }
  out.push(stringifyRow(cells));
}
fs.writeFileSync(csvPath, `${out.join("\n")}\n`);
console.log(`Updated ${csvPath.pathname} (${out.length - 1} rows)`);
