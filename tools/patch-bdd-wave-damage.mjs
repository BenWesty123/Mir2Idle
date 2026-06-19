import fs from "node:fs";

const path = "src/phase1Data.js";
let content = fs.readFileSync(path, "utf8");

const WAVE = new Set([
  288, 289, 297, 298, 299, 300, 301, 302, 303, 304, 305, 307, 308, 309, 310, 311, 312, 313, 315,
]);

for (const id of [...WAVE].sort((a, b) => a - b)) {
  const re = new RegExp(String.raw`(\{\s*\n\s*id: ${id},[\s\S]*?)(\n  \})`, "m");
  const match = content.match(re);
  if (!match) {
    throw new Error(`Missing enemy template id ${id}`);
  }
  let block = match[1];
  block = block.replace(/dc: \[(\d+), (\d+)\]/, (_, a, b) => `dc: [${a * 2}, ${b * 2}]`);
  block = block.replace(/mc: \[(\d+), (\d+)\]/, (_, a, b) => {
    if (Number(a) === 0 && Number(b) === 0) return "mc: [0, 0]";
    return `mc: [${a * 2}, ${b * 2}]`;
  });
  block = block.replace(/sc: \[(\d+), (\d+)\]/, (_, a, b) => {
    if (Number(a) === 0 && Number(b) === 0) return "sc: [0, 0]";
    return `sc: [${a * 2}, ${b * 2}]`;
  });
  content = content.replace(match[1], block);
}

content = content.replace(
  /\/\/ (Purgatory Hall \(zone-bdd-3\)|Wooma Palace North \(zone-bdd-5\)|HwanMaJin \(zone-bdd-6\)) variants — \+50% AMC, AC, and HP vs solo-dungeon originals; do not reuse elsewhere\./g,
  "// $1 variants — +50% AMC, AC, and HP; +100% DC vs solo-dungeon originals; BDD wave only.",
);

fs.writeFileSync(path, content);
console.log(`Doubled dc/mc/sc on ${WAVE.size} BDD wave templates.`);
