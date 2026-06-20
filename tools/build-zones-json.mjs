import fs from "node:fs";
import path from "node:path";
import { PHASE1_ZONES } from "../src/phase1Data.js";

const root = path.resolve(import.meta.dirname, "..");
const outPath = path.join(root, "src/data/zones.json");
const zones = PHASE1_ZONES.map((zone) => ({
  id: zone.id,
  label: zone.label ?? zone.name ?? zone.id,
  description: zone.description ?? "",
}));
const payload = {
  schemaVersion: 1,
  source: "src/phase1Data.js",
  zones,
};
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${zones.length} zones to ${outPath}`);
