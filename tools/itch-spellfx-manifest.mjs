import fs from "node:fs";
import path from "node:path";
import { WARRIOR_COMBAT_SKILLS } from "../src/warriorMagic.js";

export const WIZARD_COMBAT_SPELL_IDS = ["FireBall", "GreatFireBall", "ThunderBolt", "TurnUndead", "Vampirism", "FireWall", "FrostCrunch", "IceStorm", "FlameDisruptor", "MagicShield"];
export const TAOIST_COMBAT_SPELL_IDS = [
  "Healing",
  "Poisoning",
  "SoulFireBall",
  "SummonSkeleton",
  "SummonShinsu",
  "SummonHolyDeva",
  "SoulShield",
  "BlessedArmour",
  "MassHealing",
  "UltimateEnhancer",
];
export const TAOIST_DEFENCE_BUFF_IMPACT_FX = {
  SoulShield: "SoulShieldImpact",
  BlessedArmour: "BlessedArmourImpact",
};
export const LEVEL_UP_FX_ID = "LevelUp";
export const HEALING_RESTORE_FX_ID = "HealingRestore";
export const REVIVE_FX_ID = "Revive";
export const MAP_LIGHTNING_FX_ID = "MapLightning";
export const MAP_HELL_FIRE_FX_ID = "MapHellFire";
export const TOWN_IDLE_TELEPORT_FX_ID = "Teleport";

const NESTED_ATLAS_SHEET_KEYS = ["projectile", "impact", "ground", "cast", "charge"];

export function packagedSpellfxSpellIds() {
  return [
    ...new Set([
      ...WARRIOR_COMBAT_SKILLS.filter((skill) => skill.id !== "None").map((skill) => skill.id),
      ...WIZARD_COMBAT_SPELL_IDS,
      ...TAOIST_COMBAT_SPELL_IDS,
      ...Object.values(TAOIST_DEFENCE_BUFF_IMPACT_FX),
      LEVEL_UP_FX_ID,
      HEALING_RESTORE_FX_ID,
      REVIVE_FX_ID,
      MAP_LIGHTNING_FX_ID,
      MAP_HELL_FIRE_FX_ID,
      TOWN_IDLE_TELEPORT_FX_ID,
    ]),
  ];
}

export function collectSpellfxAtlasAssetPaths(spellId, atlas) {
  const paths = new Set();
  const addSheet = (sheet) => {
    if (sheet) paths.add(`spellfx/${spellId}/${sheet}`);
  };

  for (const layer of atlas.layers ?? []) addSheet(layer.sheet);
  for (const sheet of atlas.sheets ?? []) addSheet(sheet);
  addSheet(atlas.sheet);
  for (const key of NESTED_ATLAS_SHEET_KEYS) addSheet(atlas[key]?.sheet);

  return [...paths];
}

export function loadSpellfxAtlas(root, spellId) {
  const atlasPath = path.join(root, "public/spellfx", spellId, "atlas.json");
  if (!fs.existsSync(atlasPath)) return null;
  return JSON.parse(fs.readFileSync(atlasPath, "utf8"));
}

export function buildUsedSpellfxFiles(root) {
  const files = new Set(["spellfx/index.json"]);
  for (const spellId of packagedSpellfxSpellIds()) {
    files.add(`spellfx/${spellId}/atlas.json`);
    const atlas = loadSpellfxAtlas(root, spellId);
    if (!atlas) continue;
    for (const assetPath of collectSpellfxAtlasAssetPaths(spellId, atlas)) files.add(assetPath);
  }
  return files;
}

export function findMissingPublicFiles(root, relativePaths) {
  return [...relativePaths].filter((relativePath) => !fs.existsSync(path.join(root, "public", relativePath)));
}
