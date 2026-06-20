import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const auditRoot = path.join(root, "content-audit", "phase-1");
const crystalRoot = "C:/Users/bb-we/Documents/Crystal-master";
const dropRoot = path.join(crystalRoot, "Build/Server/Release/Envir/Drops");
const enumPath = path.join(crystalRoot, "Shared/Enums.cs");

const reqNames = [
  "Level",
  "MaxAC",
  "MaxAMC",
  "MaxDC",
  "MaxMC",
  "MaxSC",
  "MaxLevel",
  "MinAC",
  "MinAMC",
  "MinDC",
  "MinMC",
  "MinSC",
];

const classBits = [
  ["Warrior", 1],
  ["Wizard", 2],
  ["Taoist", 4],
  ["Assassin", 8],
  ["Archer", 16],
];

const equipmentTypes = new Set([
  "Weapon",
  "Armour",
  "Helmet",
  "Necklace",
  "Bracelet",
  "Ring",
  "Belt",
  "Boots",
  "Amulet",
  "Stone",
  "Torch",
]);

const sensibleGearTypes = new Set([
  "Weapon",
  "Armour",
  "Helmet",
  "Necklace",
  "Bracelet",
  "Ring",
  "Belt",
  "Boots",
]);

function loadJson(relativePath) {
  return readFile(path.join(root, relativePath), "utf8").then(JSON.parse);
}

function decodeClass(mask) {
  if (mask === 31) return "Any";
  if (mask === 7) return "War/Wiz/Tao";
  const labels = classBits.filter(([, bit]) => (mask & bit) !== 0).map(([name]) => name);
  return labels.length ? labels.join("/") : `Mask ${mask}`;
}

function decodeGender(mask) {
  if (mask === 1) return "Male";
  if (mask === 2) return "Female";
  if (mask === 3) return "Any";
  return `Mask ${mask}`;
}

function reqText(item) {
  return `${reqNames[item.requiredType] ?? `Type ${item.requiredType}`} ${item.requiredAmount}`;
}

function rangeText(range) {
  return `${range?.[0] ?? 0}-${range?.[1] ?? 0}`;
}

function statsText(stats) {
  const parts = [];
  for (const key of ["dc", "ac", "amc", "mc", "sc"]) {
    const value = stats[key];
    if (Array.isArray(value) && (value[0] || value[1])) parts.push(`${key.toUpperCase()} ${rangeText(value)}`);
  }
  for (const key of ["hp", "mp", "accuracy", "agility", "luck", "attackSpeed"]) {
    if (stats[key]) parts.push(`${key} ${stats[key]}`);
  }
  return parts.join(", ") || "-";
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.map(([header]) => csvValue(header)).join(","),
    ...rows.map((row) => columns.map(([, getter]) => csvValue(getter(row))).join(",")),
  ].join("\n");
}

function parseMonsterEnum(text) {
  const result = new Map();
  const match = text.match(/public enum Monster : ushort\s*\{([\s\S]*?)\n\}/);
  if (!match) return result;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    const entry = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)/);
    if (entry) result.set(Number(entry[2]), entry[1]);
  }
  return result;
}

function hasCurrentMonsterAsset(monster) {
  return monster.image >= 0 && monster.image <= 23;
}

function monsterRow(monster, imageNames) {
  return {
    crystalIndex: monster.crystalIndex,
    name: monster.name,
    image: monster.image,
    imageName: imageNames.get(monster.image) ?? `Image ${monster.image}`,
    level: monster.level,
    hp: monster.stats.hp,
    ac: rangeText(monster.stats.ac),
    amc: rangeText(monster.stats.amc),
    dc: rangeText(monster.stats.dc),
    accuracy: monster.stats.accuracy,
    agility: monster.stats.agility,
    attackSpeed: monster.attackSpeed,
    moveSpeed: monster.moveSpeed,
    experience: monster.experience,
    dropPath: monster.dropPath,
    currentAsset: hasCurrentMonsterAsset(monster),
  };
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readDropEntries(dropPath) {
  if (!dropPath) return [];
  const fullPath = path.join(dropRoot, `${dropPath}.txt`);
  if (!(await fileExists(fullPath))) return [];
  const text = await readFile(fullPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(";"))
    .map((line) => {
      const match = line.match(/^(\d+)\/(\d+)\s+(.+?)(?:\s+(Q|LV\d+))?$/i);
      return {
        raw: line,
        numerator: match ? Number(match[1]) : null,
        denominator: match ? Number(match[2]) : null,
        itemName: match ? match[3].trim() : line,
        tag: match?.[4] ?? "",
      };
    });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((candidate) => candidate.some((cell) => cell.trim()));
  if (!headers) return [];

  return body.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function markdownTable(rows, columns) {
  const headers = columns.map(([header]) => header);
  const body = rows.map((row) => columns.map(([, getter]) => String(getter(row) ?? "")));
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((line) => line[index].length)),
  );
  const render = (values) => `| ${values.map((value, index) => value.padEnd(widths[index])).join(" | ")} |`;
  return [
    render(headers),
    render(widths.map((width) => "-".repeat(width))),
    ...body.map(render),
  ].join("\n");
}

function compactMonsterTable(rows) {
  return markdownTable(rows, [
    ["Crystal", (x) => x.name],
    ["Idx", (x) => x.crystalIndex],
    ["Sprite", (x) => `${x.image} ${x.imageName}`],
    ["Lv", (x) => x.level],
    ["HP", (x) => x.hp],
    ["AC", (x) => x.ac],
    ["DC", (x) => x.dc],
    ["Atk/Move", (x) => `${x.attackSpeed}/${x.moveSpeed}`],
    ["Drop", (x) => x.dropPath || "-"],
    ["Sheet", (x) => (x.currentAsset ? "ready" : "needs export")],
  ]);
}

function compactItemTable(rows) {
  return markdownTable(rows, [
    ["Item", (x) => x.name],
    ["Type", (x) => x.type],
    ["Req", (x) => reqText(x)],
    ["Class", (x) => decodeClass(x.requiredClass)],
    ["Stats", (x) => statsText(x.stats)],
    ["Icon", (x) => x.icon?.frame ?? x.iconFrame],
    ["Buy", (x) => x.price],
  ]);
}

function compactCsvItemTable(rows) {
  return markdownTable(rows, [
    ["Item", (x) => x.Name],
    ["Type", (x) => x.Type],
    ["Req", (x) => x.Requirement],
    ["Class", (x) => x.Class],
    ["Stats", (x) => x.Stats || "-"],
    ["Icon", (x) => x["Icon Frame"]],
    ["Buy", (x) => x.Price],
  ]);
}

const [{ monsters }, { maps }, { items }, enumText] = await Promise.all([
  loadJson("src/data/crystal-monsters.json"),
  loadJson("src/data/crystal-maps.json"),
  loadJson("src/data/crystal-items.json"),
  readFile(enumPath, "utf8"),
]);

const imageNames = parseMonsterEnum(enumText);
const monsterByName = new Map(monsters.map((monster) => [monster.name, monster]));

const phaseZones = [
  {
    id: "bicheon-1",
    label: "Bicheon 1",
    note: "Crystal map title is BichonProvince; Chicken is named Hen in the DB.",
    requested: [
      ["Chicken", "Hen"],
      ["Deer", "Deer"],
      ["Scarecrow", "Scarecrow"],
    ],
  },
  {
    id: "bicheon-2",
    label: "Bicheon 2",
    requested: [
      ["RakingCat", "RakingCat"],
      ["HookingCat", "HookingCat"],
      ["Yob", "Yob"],
    ],
  },
  {
    id: "bicheon-3",
    label: "Bicheon 3",
    note: "Yeti is the province ForestYeti, not SnowYeti.",
    requested: [
      ["Oma", "Oma"],
      ["Yeti", "ForestYeti"],
      ["Spitting Spider", "SpittingSpider"],
    ],
  },
  {
    id: "bone-cave-1",
    label: "Bone Cave 1",
    note: "Limited to NaturalCave/OmaCave. BoneArcher is intentionally omitted because its Crystal entry belongs to PrajnaStoneCave.",
    requested: [
      ["Bone Skeleton", "Skeleton"],
      ["Cave Bat", "CaveBat"],
      ["Cave Maggot", "CaveMaggot"],
      ["Scorpion", "Scorpion"],
    ],
  },
  {
    id: "bone-cave-2",
    label: "Bone Cave 2",
    note: "NaturalCave/OmaCave tougher local skeleton set.",
    requested: [
      ["BoneWarrior", "BoneWarrior"],
      ["AxeSkeleton", "AxeSkeleton"],
      ["BoneFighter", "BoneFighter"],
    ],
  },
  {
    id: "bone-cave-kr",
    label: "Bone Cave KR",
    note: "Boss room candidate.",
    requested: [["Bone Elite", "BoneElite"]],
  },
];

const zoneMonsterRows = phaseZones.map((zone) => ({
  ...zone,
  monsters: zone.requested
    .map(([requestedName, crystalName]) => ({
      requestedName,
      crystalName,
      monster: monsterByName.get(crystalName),
    }))
    .filter((entry) => entry.monster)
    .map((entry) => ({
      requestedName: entry.requestedName,
      ...monsterRow(entry.monster, imageNames),
    })),
}));

const boneFamilyNames = [
  "CaveBat",
  "CaveMaggot",
  "Scorpion",
  "Skeleton",
  "Skeleton0",
  "AxeSkeleton",
  "AxeSkeleton0",
  "BoneFighter",
  "BoneFighter0",
  "BoneWarrior",
  "BoneWarrior0",
  "BoneElite",
];
const boneFamily = boneFamilyNames
  .map((name) => monsterByName.get(name))
  .filter(Boolean)
  .map((monster) => monsterRow(monster, imageNames));

const importantMapTitles = new Set([
  "BichonProvince",
  "NaturalCave",
  "OmaCave_1F",
  "OmaCave_2F",
  "OmaCave_3F",
]);

const monsterNamesByIndex = new Map(monsters.map((monster) => [monster.crystalIndex, monster.name]));
const importantMaps = maps
  .filter((map) => importantMapTitles.has(map.title))
  .map((map) => ({
    index: map.index,
    title: map.title,
    fileName: map.fileName,
    respawnCount: map.respawns.length,
    monsters: [...new Set(map.respawns.map((respawn) => monsterNamesByIndex.get(respawn.monsterIndex)).filter(Boolean))],
  }));

function warriorCanUse(item) {
  return item.requiredClass === 0 || (item.requiredClass & 1) !== 0;
}

function lowRequirement(item) {
  return item.requiredAmount <= 16;
}

const warriorItemCandidates = items
  .filter((item) => equipmentTypes.has(item.type))
  .filter(warriorCanUse)
  .filter(lowRequirement)
  .map((item) => ({
    crystalIndex: item.crystalIndex,
    name: item.name,
    type: item.type,
    requiredType: item.requiredType,
    requirement: reqText(item),
    requiredAmount: item.requiredAmount,
    requiredClass: item.requiredClass,
    class: decodeClass(item.requiredClass),
    requiredGender: item.requiredGender,
    gender: decodeGender(item.requiredGender),
    iconFrame: item.icon.frame,
    shape: item.shape,
    price: item.price,
    stats: item.stats,
    statsText: statsText(item.stats),
  }))
  .sort((a, b) => a.type.localeCompare(b.type) || a.requiredAmount - b.requiredAmount || a.name.localeCompare(b.name));

const sensibleGear = warriorItemCandidates
  .filter((item) => sensibleGearTypes.has(item.type))
  .filter((item) => item.price > 0)
  .filter((item) => !/[?[\]]/.test(item.name))
  .filter((item) => !item.name.startsWith("Mystery"));

const gearShortlistNames = new Set([
  "WoodenSword",
  "Dagger",
  "EbonySword",
  "BronzeSword",
  "ShortSword",
  "IronSword",
  "BronzeAxe",
  "HookedSword",
  "SteelAxe",
  "BoneDecapitator",
  "BaseDress(M)",
  "LightArmour(M)",
  "MediumArmour(M)",
  "BoneRobe(M)",
  "BronzeHelmet",
  "MagicHelmet",
  "BoneHood",
  "GoldNecklace",
  "PrecisionNecklace",
  "BlackNecklace",
  "CopperRing",
  "HornRing",
  "BlueRing",
  "GaleRing",
  "IronBracelet",
  "ThinBracelet",
  "LeatherGlove",
  "LargeBracelet",
  "LeatherBelt",
  "ChainBelt",
  "LowShoes",
  "LeatherBoots",
]);
const gearShortlist = sensibleGear
  .filter((item) => gearShortlistNames.has(item.name))
  .sort((a, b) => a.requiredAmount - b.requiredAmount || a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

const curatedItemSelectionPath = path.join(auditRoot, "warrior-item-selection.csv");
const curatedItemSelection = (await fileExists(curatedItemSelectionPath))
  ? parseCsv(await readFile(curatedItemSelectionPath, "utf8"))
  : [];
const selectedDropItemNames = curatedItemSelection.length
  ? new Set(curatedItemSelection.map((item) => item.Name))
  : new Set(warriorItemCandidates.map((item) => item.name));

const warriorBooks = items
  .filter((item) => item.type === "Book" && (item.requiredClass & 1) !== 0)
  .map((item) => ({
    crystalIndex: item.crystalIndex,
    name: item.name,
    shape: item.shape,
    level: item.requiredAmount,
    iconFrame: item.icon.frame,
    price: item.price,
    inPrototypeLevel: item.requiredAmount <= 16,
  }));

const potionCandidates = items
  .filter((item) => item.type === "Potion")
  .filter((item) => ["(HP)DrugSmall", "(MP)DrugSmall", "(HP)DrugMedium", "(MP)DrugMedium", "SunPotion", "SunPotion(M)"].includes(item.name))
  .map((item) => ({
    crystalIndex: item.crystalIndex,
    name: item.name,
    iconFrame: item.icon.frame,
    price: item.price,
    hp: item.stats.hp,
    mp: item.stats.mp,
    stackSize: item.stackSize,
  }));

const dropSources = [];
for (const zone of zoneMonsterRows) {
  for (const monster of zone.monsters) {
    const entries = await readDropEntries(monster.dropPath);
    dropSources.push({
      zone: zone.label,
      monster: monster.name,
      dropPath: monster.dropPath,
      entries,
      warriorRelevant: entries.filter((entry) =>
        selectedDropItemNames.has(entry.itemName) ||
        warriorBooks.some((item) => item.name === entry.itemName) ||
        potionCandidates.some((item) => item.name === entry.itemName) ||
        entry.itemName === "Gold",
      ),
    });
  }
}

await mkdir(auditRoot, { recursive: true });

await writeFile(
  path.join(auditRoot, "monster-candidates.json"),
  JSON.stringify({ zones: zoneMonsterRows, boneFamily, maps: importantMaps }, null, 2),
);

await writeFile(
  path.join(auditRoot, "warrior-item-candidates.json"),
  JSON.stringify({ candidates: warriorItemCandidates, sensibleGear, gearShortlist, curatedItemSelection, warriorBooks, potionCandidates }, null, 2),
);

if (curatedItemSelection.length) {
  await writeFile(
    path.join(auditRoot, "warrior-item-selection.json"),
    JSON.stringify({ source: curatedItemSelectionPath, items: curatedItemSelection }, null, 2),
  );
}

await writeFile(
  path.join(auditRoot, "drop-candidates-by-zone.json"),
  JSON.stringify({ sources: dropSources }, null, 2),
);

await writeFile(
  path.join(auditRoot, "warrior-item-candidates.csv"),
  toCsv(warriorItemCandidates, [
    ["Crystal Index", (x) => x.crystalIndex],
    ["Name", (x) => x.name],
    ["Type", (x) => x.type],
    ["Requirement", (x) => x.requirement],
    ["Class", (x) => x.class],
    ["Gender", (x) => x.gender],
    ["Icon Frame", (x) => x.iconFrame],
    ["Shape", (x) => x.shape],
    ["Price", (x) => x.price],
    ["Stats", (x) => x.statsText],
  ]),
);

await writeFile(
  path.join(auditRoot, "drop-candidates-by-zone.csv"),
  toCsv(
    dropSources.flatMap((source) =>
      source.warriorRelevant.map((entry) => ({
        zone: source.zone,
        monster: source.monster,
        dropPath: source.dropPath,
        raw: entry.raw,
        itemName: entry.itemName,
        numerator: entry.numerator,
        denominator: entry.denominator,
      })),
    ),
    [
      ["Zone", (x) => x.zone],
      ["Monster", (x) => x.monster],
      ["Drop Path", (x) => x.dropPath],
      ["Raw Drop", (x) => x.raw],
      ["Item", (x) => x.itemName],
      ["Numerator", (x) => x.numerator],
      ["Denominator", (x) => x.denominator],
    ],
  ),
);

const reviewPages = [
  "tile-review/wemade-mir2-tiles-000000-001999/index.html",
  "tile-review/wemade-mir2-tiles-002000-003999/index.html",
  "tile-review/wemade-mir2-tiles-004000-005999/index.html",
  "tile-review/wemade-mir2-tiles-006000-007999/index.html",
  "tile-review/wemade-mir2-tiles-008000-009999/index.html",
  "tile-review/phase1-shanda-mir2-tiles-000000-003999/index.html",
  "tile-review/phase1-shanda-mir2-objects-000000-003999/index.html",
  "tile-review/phase1-wemade-mir3-dungeons-000000-003999/index.html",
  "tile-review/phase1-wemade-mir3-smobjects-000000-003999/index.html",
].map((relativePath) => path.join(root, relativePath));

const report = `# Phase 1 Content Audit

Generated from Crystal's local files. Main sources:

- ${path.join(root, "src/data/crystal-monsters.json")}
- ${path.join(root, "src/data/crystal-maps.json")}
- ${path.join(root, "src/data/crystal-items.json")}
- ${dropRoot}

## Main Findings

- The DB calls the province map **BichonProvince**, not Bicheon, and the requested Chicken is named **Hen**.
- The requested Yeti for the first outdoor zones should be **ForestYeti**. **SnowYeti** exists, but it is level 65 and not right for this prototype.
- Cave monster scope is now **NaturalCave/OmaCave only**. PrajnaStoneCave monsters are deliberately excluded from this prototype pass.
- Current monster sprite sheets cover Crystal monster images **0-23**. That means Bicheon 1-3, CaveBat, CaveMaggot, Scorpion, Skeleton, and BoneFighter are ready; AxeSkeleton, BoneWarrior, and BoneElite still need sprite export before implementation.

## Zone Monster Candidates

${zoneMonsterRows
  .map((zone) => `### ${zone.label}\n\n${zone.note ? `${zone.note}\n\n` : ""}${compactMonsterTable(zone.monsters)}`)
  .join("\n\n")}

## Natural/Oma Cave Monster Candidates

${compactMonsterTable(boneFamily)}

## Map Respawn Evidence

${markdownTable(importantMaps, [
  ["Map", (x) => x.title],
  ["Index", (x) => x.index],
  ["File", (x) => x.fileName],
  ["Respawns", (x) => x.respawnCount],
  ["Notable Monsters", (x) => x.monsters.slice(0, 12).join(", ")],
])}

## Warrior Items Up To Level 16

Raw candidate count: **${warriorItemCandidates.length}**. Sensible gear count after ignoring event-looking/debug-looking items: **${sensibleGear.length}**.

Your curated Phase 1 item selection is saved here:

- ${curatedItemSelection.length ? curatedItemSelectionPath : "No curated item CSV found yet."}
${curatedItemSelection.length ? `\nCurated item count: **${curatedItemSelection.length}**.\n\n${compactCsvItemTable(curatedItemSelection)}` : ""}

Full pick list:

- ${path.join(auditRoot, "warrior-item-candidates.csv")}
- ${path.join(auditRoot, "warrior-item-candidates.json")}

${curatedItemSelection.length ? "The raw pick list remains above for reference, but the curated CSV should now be treated as the working Phase 1 item list." : `Suggested first-pass shortlist:\n\n${compactItemTable(gearShortlist)}`}

## Warrior Books

${markdownTable(warriorBooks, [
  ["Book", (x) => x.name],
  ["Crystal Index", (x) => x.crystalIndex],
  ["Shape", (x) => x.shape],
  ["Level", (x) => x.level],
  ["Icon", (x) => x.iconFrame],
  ["Prototype", (x) => (x.inPrototypeLevel ? "yes" : "later")],
])}

For a level-16 public prototype, Crystal gives us **Fencing** at level 7 and **Slaying** at level 15. Thrusting is level 22, so it is useful for testing but outside the first progression cap.

## Shop Potion Candidates

${markdownTable(potionCandidates, [
  ["Item", (x) => x.name],
  ["Crystal Index", (x) => x.crystalIndex],
  ["Icon", (x) => x.iconFrame],
  ["HP", (x) => x.hp],
  ["MP", (x) => x.mp],
  ["Stack", (x) => x.stackSize],
  ["Buy", (x) => x.price],
])}

## Drop Source Files

I pulled the original per-monster drop files for the selected monsters into:

- ${path.join(auditRoot, "drop-candidates-by-zone.csv")}
- ${path.join(auditRoot, "drop-candidates-by-zone.json")}

We should still convert these into **zone drop tables**, because the idle prototype already decided to roll drops per zone rather than per enemy. The CSV is the pick-from list.

## Tile Review Pages

Existing grass/base tile pages and new cave candidate pages:

${reviewPages.map((page) => `- ${page}`).join("\n")}

## Recommended Phase 2 Input Needed

1. Export the missing NaturalCave/OmaCave monster sprites: AxeSkeleton, BoneWarrior, and BoneElite.
2. Pick the cave tile frames/objects from the review pages.
3. Convert the curated item CSV plus original drop CSV into zone drop tables.
`;

await writeFile(path.join(auditRoot, "phase-1-content-audit.md"), report);

console.log(`Wrote ${path.join(auditRoot, "phase-1-content-audit.md")}`);
