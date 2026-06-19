import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import { PHASE1_ZONES } from "../src/phase1Data.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, "outputs", "drop-review");
const outputPath = path.join(outputDir, "current-drop-items.xlsx");

const itemsPath = path.join(projectRoot, "src", "data", "items.json");
const itemData = JSON.parse(await fs.readFile(itemsPath, "utf8"));

const zones = PHASE1_ZONES.map((zone) => ({
  id: zone.id,
  label: zone.label ?? zone.name ?? zone.id,
}));

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rangeText(value) {
  if (!Array.isArray(value)) return value ? String(value) : "";
  if (!value[0] && !value[1]) return "";
  return value[0] === value[1] ? String(value[0]) : `${value[0]}-${value[1]}`;
}

function statsText(item) {
  const stats = item.stats ?? {};
  const parts = [];
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    const value = rangeText(stats[key]);
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
  if (item.recovery?.hp || item.recovery?.mp) {
    const recovery = [];
    if (item.recovery.hp) recovery.push(`HP ${item.recovery.hp}`);
    if (item.recovery.mp) recovery.push(`MP ${item.recovery.mp}`);
    parts.push(`Regen ${recovery.join("/")}`);
  }
  return parts.join(", ");
}

function requirementText(item) {
  const req = item.requirements;
  if (!req || !req.amount) return "";
  return `${req.type ?? "level"} ${req.amount}`;
}

function chanceForZone(item, zoneId) {
  if (!item.drop?.zones?.includes(zoneId)) return "";
  const chance = item.drop?.chances?.[zoneId] ?? item.drop?.chance ?? "";
  return chance === "" ? "" : Number(chance);
}

const droppedItems = itemData.items
  .filter((item) => Array.isArray(item.drop?.zones) && item.drop.zones.length)
  .sort((a, b) => {
    const levelDiff = (a.requirements?.amount ?? 0) - (b.requirements?.amount ?? 0);
    return levelDiff || String(a.type).localeCompare(String(b.type)) || a.name.localeCompare(b.name);
  });

const headers = [
  "Keep?",
  "Item ID",
  "Name",
  "Type",
  "Slot",
  "Class",
  "Requirement",
  "Stats",
  "Crystal Index",
  "Crystal Name",
  ...zones.map((zone) => `${zone.label} chance`),
  "Notes",
];

const rows = [
  headers,
  ...droppedItems.map((item) => [
    "yes",
    item.id,
    item.name,
    item.type ?? "",
    item.slot ?? "",
    item.class ?? "any",
    requirementText(item),
    statsText(item),
    item.source?.crystalIndex ?? "",
    item.source?.name ?? "",
    ...zones.map((zone) => chanceForZone(item, zone.id)),
    "",
  ]),
];

const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
const workbook = await Workbook.fromCSV(csv, { sheetName: "Dropped Items" });

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath);
console.log(`items=${droppedItems.length}`);
