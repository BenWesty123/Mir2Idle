import { access, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "public/audio/sfx/manifest.json"), "utf8"));
const crystalMonsters = JSON.parse(await readFile(join(root, "src/data/crystal-monsters.json"), "utf8"));

const PRAJNA_TEMPLE = [
  { phaseId: 280, name: "Minotaur", crystalName: "Minotaur" },
  { phaseId: 281, name: "Ice Minotaur", crystalName: "IceMinotaur" },
  { phaseId: 282, name: "Electric Minotaur", crystalName: "ElectricMinotaur" },
  { phaseId: 283, name: "Wind Minotaur", crystalName: "WindMinotaur" },
  { phaseId: 284, name: "Fire Minotaur", crystalName: "FireMinotaur" },
  { phaseId: 285, name: "Right Guard", crystalName: "RightGuard", range: true },
  { phaseId: 286, name: "Left Guard", crystalName: "LeftGuard", range: true },
];

const EXTRA = [
  { name: "Minotaur King", crystalName: "MinotaurKing", range: true },
];

function crystalEntry(name) {
  return crystalMonsters.monsters.find((m) => m.name === name);
}

function expectedSoundId(image, slot) {
  return image * 10 + slot;
}

function expectedWav(image, slot) {
  return `${String(image).padStart(3, "0")}-${slot}.wav`;
}

async function fileExists(rel) {
  try {
    await access(join(root, rel.replace(/^\.\//, "")));
    return true;
  } catch {
    return false;
  }
}

const issues = [];
const ok = [];

for (const monster of [...PRAJNA_TEMPLE, ...EXTRA]) {
  const crystal = crystalEntry(monster.crystalName);
  if (!crystal) {
    issues.push(`${monster.name}: missing from crystal-monsters.json`);
    continue;
  }
  const monsterIndex = crystal.crystalIndex;
  const image = crystal.image;
  const kinds = ["attack", "flinch", "death", ...(monster.range ? ["range"] : [])];
  const slots = { attack: 1, flinch: 2, death: 3, range: 5 };

  for (const kind of kinds) {
    const key = `monster.${monsterIndex}.${kind}`;
    const entry = manifest.byKey[key];
    const wantId = expectedSoundId(image, slots[kind]);
    const wantFile = expectedWav(image, slots[kind]);

    if (!entry) {
      issues.push(`${monster.name} ${kind}: manifest key ${key} missing`);
      continue;
    }
    if (entry.id !== wantId) {
      issues.push(`${monster.name} ${kind}: id ${entry.id} should be ${wantId}`);
    }
    if (entry.sourceFile !== wantFile) {
      issues.push(`${monster.name} ${kind}: source ${entry.sourceFile} should be ${wantFile}`);
    }
    if (!(await fileExists(entry.src))) {
      issues.push(`${monster.name} ${kind}: file missing ${entry.src}`);
    } else {
      ok.push(`${monster.name} ${kind}: ${entry.sourceFile} (${entry.id})`);
    }
  }
}

const stalePatterns = [/^361\d-/, /^363\d-/, /^365\d-/, /^367\d-/, /^369\d-/, /^371\d-/, /^373\d-/];
const filesDir = join(root, "public/audio/sfx/files");
const { readdir } = await import("node:fs/promises");
const files = await readdir(filesDir);
const stale = files.filter((f) => stalePatterns.some((re) => re.test(f)));

console.log("Prajna Temple SFX audit\n");
console.log(`OK (${ok.length}):`);
for (const line of ok) console.log(`  ✓ ${line}`);
if (issues.length) {
  console.log(`\nISSUES (${issues.length}):`);
  for (const line of issues) console.log(`  ✗ ${line}`);
} else {
  console.log("\nNo mapping issues found.");
}
if (stale.length) {
  console.log(`\nStale files still on disk (${stale.length}) — safe to delete:`);
  for (const f of stale) console.log(`  - ${f}`);
}

process.exit(issues.length ? 1 : 0);
