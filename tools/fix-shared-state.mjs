#!/usr/bin/env node
/** Wire split game modules to shared mutable module state (was broken across files). */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GAME = path.join(ROOT, "src/game");
const RUNTIME = path.join(GAME, "runtime.js");

const SHARED_VARS = [
  "battlePanelSignature",
  "gamePanelSignature",
  "sceneSignature",
  "sceneOverlayInteractionUntil",
  "sceneScrollPositions",
  "combatSkillBarSignature",
  "playerHudSignature",
  "hotbarSignature",
  "lastSimulationAt",
  "suppressSimulationRender",
  "musicAudio",
  "musicTrackIndex",
  "musicStatusText",
  "sfxPools",
  "sfxPoolIndexes",
  "sfxLastPlayedAt",
  "bossPartyVisualAtlasCache",
  "stageCanvas",
  "stageContext",
  "stampBackgroundCache",
  "lastStageShellSize",
  "lastStageDisplaySize",
  "inventoryDragState",
  "saveReady",
  "lastSaveAt",
  "pendingSavedPlayerResources",
  "pendingOfflineProgress",
  "sessionStartedAt",
  "atlasReloadVersion",
  "queuedAtlasReloadKey",
  "imageCache",
];

function extractSharedBlock(runtimeText) {
  const start = runtimeText.indexOf("let battlePanelSignature");
  const end = runtimeText.indexOf("\n\nfunction labShellHtml");
  if (start < 0 || end < 0) throw new Error("Could not find shared state block in runtime.js");
  return runtimeText.slice(start, end).trimEnd();
}

function exportSharedBlock(block) {
  return block
    .replace(/^let /gm, "export let ")
    .replace(/^const /gm, "export const ");
}

function usedVars(text) {
  return SHARED_VARS.filter((name) => new RegExp(`\\b${name}\\b`).test(text));
}

function upsertSharedImport(filePath, vars) {
  if (!vars.length) return false;
  let text = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(path.dirname(filePath), path.join(GAME, "sharedState.js")).replace(/\\/g, "/");
  const importLine = `import { ${vars.join(", ")} } from "${rel.startsWith(".") ? rel : `./${rel}`}";`;
  const existing = text.match(/^import \{([^}]+)\} from ["'].*sharedState\.js["'];/m);
  if (existing) {
    const merged = [...new Set([...existing[1].split(",").map((s) => s.trim()), ...vars])].sort();
    text = text.replace(existing[0], `import { ${merged.join(", ")} } from "${rel.startsWith(".") ? rel : `./${rel}`}";`);
  } else {
    const gameApiIdx = text.indexOf('import { G } from');
    const insertAt = gameApiIdx >= 0 ? gameApiIdx : text.lastIndexOf('from "../buffPotions.js";') + 'from "../buffPotions.js";'.length + 1;
    text = `${text.slice(0, insertAt)}\n${importLine}\n${text.slice(insertAt)}`;
  }
  fs.writeFileSync(filePath, text);
  return true;
}

function main() {
  const runtimeText = fs.readFileSync(RUNTIME, "utf8");
  const block = extractSharedBlock(runtimeText);
  const sharedPath = path.join(GAME, "sharedState.js");
  fs.writeFileSync(sharedPath, `${exportSharedBlock(block)}\n`);

  const newRuntime = runtimeText.replace(`${block}\n\n`, 'export * from "./sharedState.js";\n\n');
  fs.writeFileSync(RUNTIME, newRuntime);

  const targets = [
    path.join(GAME, "bootstrap.js"),
    ...fs.readdirSync(path.join(GAME, "modules")).map((f) => path.join(GAME, "modules", f)),
  ];

  let fixed = 0;
  for (const file of targets) {
    if (!file.endsWith(".js")) continue;
    const vars = usedVars(fs.readFileSync(file, "utf8"));
    if (upsertSharedImport(file, vars)) {
      fixed++;
      console.log(path.basename(file), "->", vars.length, "vars");
    }
  }
  console.log(`sharedState.js written; updated ${fixed} files.`);
}

main();
