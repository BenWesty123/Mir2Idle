import { readFileSync } from "fs";
import { crystalExperienceForLevel, crystalAdjustedExperience } from "../src/battleData.js";
import { PHASE1_ENEMY_TEMPLATES } from "../src/phase1Data.js";

const list = [...PHASE1_ENEMY_TEMPLATES].sort((a, b) => a.level - b.level);

function mobsNear(playerLevel, band = 5) {
  return list.filter((m) => Math.abs(m.level - playerLevel) <= band);
}

function avgAdjustedXp(playerLevel, band = 5) {
  const mobs = mobsNear(playerLevel, band);
  if (!mobs.length) return null;
  const total = mobs.reduce(
    (s, m) => s + crystalAdjustedExperience(m.experience, playerLevel, m.level),
    0
  );
  return { avg: total / mobs.length, mobs };
}

console.log("=== Kills per level (±5 mob level band, crystal-adjusted XP) ===\n");
console.log(
  "Level | XP to next | Nearby mobs (count)        | Avg XP/kill | Kills needed"
);
console.log(
  "------|------------|----------------------------|-------------|-------------"
);

for (let pl = 1; pl <= 60; pl++) {
  const need = crystalExperienceForLevel(pl);
  const { avg, mobs } = avgAdjustedXp(pl, 5) ?? { avg: null, mobs: [] };
  const names =
    mobs.length <= 3
      ? mobs.map((m) => m.name).join(", ")
      : `${mobs.slice(0, 2).map((m) => m.name).join(", ")} +${mobs.length - 2}`;
  const kills = avg ? Math.round(need / avg) : "-";
  const avgR = avg ? Math.round(avg) : "-";
  console.log(
    `${String(pl).padStart(5)} | ${String(need).padStart(10)} | ${(names + ` (${mobs.length})`).padEnd(26)} | ${String(avgR).padStart(11)} | ${String(kills).padStart(12)}`
  );
}

console.log("\n=== Content-band averages (what you'd farm in each zone) ===\n");

const bands = [
  { label: "Bicheon / starter", min: 1, max: 8, player: 5 },
  { label: "Outskirts / early", min: 9, max: 15, player: 12 },
  { label: "Oma / Bone Tomb", min: 16, max: 22, player: 19 },
  { label: "Dead Mines", min: 23, max: 28, player: 25 },
  { label: "Insect Cave", min: 29, max: 33, player: 31 },
  { label: "Wooma Temple 1", min: 30, max: 35, player: 33 },
  { label: "Wooma Temple 2", min: 35, max: 40, player: 38 },
  { label: "Bug Cave / Stone 1", min: 40, max: 45, player: 42 },
  { label: "Stone Tomb 2", min: 45, max: 50, player: 47 },
  { label: "Zuma Temple 1-2", min: 34, max: 54, player: 50 },
  { label: "Zuma KR / endgame", min: 54, max: 60, player: 57 },
];

for (const band of bands) {
  const mobs = list.filter((m) => m.level >= band.min && m.level <= band.max);
  if (!mobs.length) continue;
  const pl = band.player;
  const avgMobLvl = mobs.reduce((s, m) => s + m.level, 0) / mobs.length;
  const avgBase = mobs.reduce((s, m) => s + m.experience, 0) / mobs.length;
  const avgAdj =
    mobs.reduce(
      (s, m) => s + crystalAdjustedExperience(m.experience, pl, m.level),
      0
    ) / mobs.length;
  const need = crystalExperienceForLevel(pl);
  const kills = Math.round(need / avgAdj);
  console.log(
    `${band.label.padEnd(22)} @ player L${pl}: ${mobs.length} mobs, avg mob L${avgMobLvl.toFixed(1)}, ~${Math.round(avgAdj)} XP/kill → ~${kills} kills for L${pl}→${pl + 1} (${need} XP)`
  );
}

// Cumulative estimate using band-appropriate avg at each level
console.log("\n=== Cumulative kills 1→60 (using ±5 band avg at each level) ===\n");
let total = 0;
for (let pl = 1; pl < 60; pl++) {
  const need = crystalExperienceForLevel(pl);
  const r = avgAdjustedXp(pl, 5);
  if (r) total += need / r.avg;
}
console.log(`Total kills (approx): ${Math.round(total).toLocaleString()}`);
