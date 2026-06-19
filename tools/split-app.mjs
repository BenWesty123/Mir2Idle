#!/usr/bin/env node
/**
 * Splits src/app.js into src/game/ modules using a shared gameApi (G) registry.
 * Run: node tools/split-app.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const MONOLITH = path.join(SRC, "app.monolith.js");
const APP = path.join(SRC, "app.js");
const GAME_DIR = path.join(SRC, "game");

const BOOTSTRAP_FNS = new Set([
  "init",
  "preloadSpellAtlasSheets",
  "loadWarriorSkillAtlases",
  "loadCombatSpellAtlases",
  "loadTownNpcAtlases",
]);

const STATE_INIT_FNS = new Set([
  "createDefaultAccountUpgradeState",
  "createDefaultAccountStats",
  "clonePattern",
  "initialOpenScenesFromUrl",
]);

const RESERVED = new Set([
  "if", "for", "while", "switch", "catch", "return", "typeof", "instanceof", "new", "await", "delete", "void",
  "true", "false", "null", "undefined", "async", "function", "class", "import", "export", "from", "default",
  "const", "let", "var", "try", "else", "case", "break", "continue", "throw", "do", "in", "of", "super", "this",
  "Math", "Number", "String", "Object", "Array", "Map", "Set", "Promise", "Date", "JSON", "performance", "document",
  "window", "console", "Error", "parseInt", "parseFloat", "isNaN", "isFinite", "requestAnimationFrame", "cancelAnimationFrame",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "Intl", "URL", "URLSearchParams", "structuredClone",
  "queueMicrotask", "Symbol", "BigInt", "RegExp", "AbortController", "fetch", "Image", "Audio",
]);

function moduleForFixed(name) {
  if (STATE_INIT_FNS.has(name) || BOOTSTRAP_FNS.has(name)) return null;
  if (/^(bossParty|BossParty|freezeBoss|updateBossParty|syncBossParty|bossPartyLeader|bossPartyMember|bossPartyControlled|bossPartyOffline|bossPartyVisual|bossPartyCamera|mobileBoss|stationaryBoss|bossFront|leaderMember|controlledMember|controlledVisual|controlledRecovery|partyMember|partyFront|partyLine|empowerBoss|bossEntry|bossAssist|bossEmpower|completeBossParty|finalizeBossParty|simulateBossParty|snapshotBossParty|bossPartyOnField|freezeBossParty|updateBossPartyMember|persistBossParty|serializeBossParty|restoreBossParty|ensureBossParty|initBossParty|startBossParty|stopBossParty|resetBossParty|awardBossParty|renderBossParty|drawBossParty|playBossParty|bossMelee|bossStep|memberSpell|partyOffline|returnAllCharactersToTown)/.test(name)) return "bossParty";
  if (/^offline/.test(name)) return "offline";
  if (/^(save|loadSaved|loadCatalogue|serialize|restore|sanitize|applySave|createSave|parseSave|exportSave|importGame|exportGame|clearTransientBattle|migrate|cloneInventory|cloneStorage|cloneHotbar|cloneMagic|cloneDecorations|createDefault|performAccount|resetCharacter|resetAccount|resetNonRebirth|resetRuntime|resetSaved|applyCharacter|captureActive|persistCharacter|normalizeSaved|normalizeCharacter|legacyCharacter|backfill|deductItem|addItemQuantityToStorage|createStorage|accountAwakened|accountRebirth|accountTotal|accountBoss|accountStats|awakeningSoul|canPerformRebirth|payRebirth|trackRebirth|ensureAccount|syncAccount|finiteNumberOrNull|totalPlaytimeMs|maybeAutoSave|removeRetiredTesting)/.test(name)) return "persist";
  if (/^(play|setMusic|setSfx|ensureMusic|ensureSfx|syncBackground|handleMusic|currentMusic|normalizedVolume|normalizedMusic|sfxEntry|ensureSfxPool)/.test(name)) return "audio";
  if (/^render/.test(name)) return "render";
  if (/^draw/.test(name)) return "draw";
  if (/^trainingRoom/.test(name)) return "training";
  if (/^(mining|rollMining|enterMining|activeMining|ensureMining|pickRandomMining|miningSpot|tryAddMining|updateMining)/.test(name)) return "mining";
  if (/^(inventory|storage|hotbar|equipment|weaponRefine|smith|refiner|buyAccount|accountUpgrade|sellInventory|addInventory|removeInventory|createInventory|consumeOne|unlockInventory|unlockStorage|mergeBossPartyMemberSpell|seedStarter|syncInventory|syncStorage|syncBossPartyControlledInventory|syncBossPartyInventory|hasInventory|availableInventory|availableHotbar|availablePurchase|addPurchasedPotions|inventoryPage|storagePage|inventoryItem|inventoryQuantity|inventoryDrag|equip|unequip|toggleEquip|itemTooltip|itemIcon|itemLabel|itemStats|resolveItem|lookupItem|formatItem|isJunkOre|orePurity|allAccountUpgrade)/.test(name)) return "inventory";
  if (/^prototype/.test(name)) return "stats";
  if (/^(updateGroupDungeon|groupDungeon|swarm|fireWall|waveSpawn|waveRefill|waveState|ensureSwarm|groupDungeonWave)/.test(name)) return "groupDungeon";
  if (/^(zone|activeZone|arena|mapObject|currentMap|currentZone|tilePreview|objectPreview|objectButton|tileButton|patternCell|objectPattern|zoneObject|zoneBuilder|zonePattern|zoneVisual|zoneExport|createZone|preferredMapSet|mapObjectSet|currentZoneEdge|currentZoneStamp|decoration|tileAnchor|groundTile|mapStamp|stampBackground|edgeSet|caveEdge)/.test(name)) return "zone";
  if (/^(teleport|town|npc|enterTown|openScene|closeScene|renderScene|sceneOverlay|townView|townNpc|selectedTown|hoveredTown|persistScene|restoreScene|sceneScroll|gameShell|labShell)/.test(name)) return "town";
  if (/^(resetBattle|startBattle|stopBattle|updateBattle|combat|attack|enemy|playerAttack|cast|spell|warrior|wizard|taoist|levelMagic|floatingText|pushBattle|pushRecent|reduceEnemy|setEnemy|clearTransientCombat|selectBattle|ensureMapStamp|playerScreenX|combatAnchor|combatPlayable|isRoomOnly|isTraining|trainingDummy|activeCombat|updateCombat|tickCombat|simulateFight|pendingImpact|pendingHeal|pendingPoison|autoUse|tryAuto|tryCast|spendMp|playCast|syncBody|bodyAction|magicShield|soulFire|twinDrake|flamingSword|slaying|thrusting|fury|potHealth|potMana|healAmount|statBuff|defenceBuff|ultimateEnhancer|summonSkeleton|summonShinsu|taoPet|petSupport|petAttack|petStat|enemyAttack|enemyStrike|monsterWalk|aggroRange|laneY|walkCycle|continuousWalk|continuousMove|oneStep|stepTest|startContinuous|stopContinuous|playbackFrame|layerNames|updateAction|updateCoverage)/.test(name)) return "combat";
  if (name === "title") return "combat";
  const c = name.charCodeAt(0);
  if (c < 73) return "coreA";
  if (c < 81) return "coreB";
  if (c < 97) return "coreC";
  if (c < 105) return "coreD";
  if (c < 113) return "coreE";
  return "coreF";
}

function parseFunctions(lines) {
  const fns = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(async )?function (\w+)\s*\(/);
    if (!m) continue;
    let depth = 0;
    let started = false;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth += 1;
          started = true;
        } else if (ch === "}") {
          depth -= 1;
        }
      }
      if (started && depth === 0) {
        end = j;
        break;
      }
    }
    fns.push({ name: m[2], start: i, end, async: !!m[1] });
  }
  return fns;
}

function rewriteCrossModuleCalls(body, localNames, foreignNames) {
  let out = body;
  const sorted = [...foreignNames].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (localNames.has(name) || RESERVED.has(name)) continue;
    const re = new RegExp(`(?<![.\\w$])${name}(?=\\s*\\()`, "g");
    out = out.replace(re, `G.${name}`);
  }
  return out;
}

function rewriteImports(block, relativeToSrc) {
  const prefix = relativeToSrc === "game" ? ".." : relativeToSrc === "modules" ? "../.." : ".";
  return block.replace(/from "\.\//g, `from "${prefix}/`);
}

function extractSection(lines, start, end) {
  return lines.slice(start, end + 1).join("\n");
}

function main() {
  if (!fs.existsSync(APP) && !fs.existsSync(MONOLITH)) {
    console.error("Missing app.js");
    process.exit(1);
  }

  if (!fs.existsSync(MONOLITH)) {
    fs.copyFileSync(APP, MONOLITH);
    console.log("Backed up to app.monolith.js");
  }

  const lines = fs.readFileSync(MONOLITH, "utf8").split(/\r?\n/);
  let importEnd = lines.findIndex((l) => l.startsWith("const TESTING_XP"));
  while (importEnd > 0 && lines[importEnd - 1].trim().startsWith("//")) importEnd -= 1;
  while (importEnd > 0 && lines[importEnd - 1].trim() === "") importEnd -= 1;
  const imports = lines.slice(0, importEnd).join("\n");
  const gameImports = `${rewriteImports(imports, "game")}\nimport { G } from "./gameApi.js";\n`;
  const moduleImports = `${rewriteImports(imports, "modules")}\nimport { G } from "../gameApi.js";\n`;

  const stateLine = lines.findIndex((l) => l === "const state = {");
  const constants = lines.slice(importEnd, stateLine).join("\n");

  const stateEnd = lines.findIndex((l, i) => i > stateLine && l === "};");
  const stateBody = lines.slice(stateLine + 1, stateEnd).join("\n");

  const moduleVarsStart = lines.findIndex((l) => l.startsWith("let battlePanelSignature"));
  const rootLine = lines.findIndex((l) => l.startsWith("const root = document"));
  const shellStart = lines.findIndex((l) => l.startsWith("function labShellHtml"));
  const elsStart = lines.findIndex((l) => l.startsWith("const els = {"));
  let elsEnd = elsStart;
  while (elsEnd < lines.length && lines[elsEnd].trim() !== "};") elsEnd++;
  const initCallEnd = lines.findIndex((l, i) => i > elsEnd && l.startsWith("async function init")) - 1;

  const RUNTIME_EXPORTS = new Set(["saveReady", "lastSimulationAt", "sessionStartedAt"]);

  let moduleVars = lines.slice(moduleVarsStart, rootLine).join("\n");
  for (const name of RUNTIME_EXPORTS) {
    moduleVars = moduleVars.replace(new RegExp(`^let ${name} `, "m"), `export let ${name} `);
  }
  const domBootstrap = lines.slice(rootLine, shellStart).join("\n");
  const shellBlock = lines.slice(shellStart, elsStart).join("\n");
  const elsBlock = lines.slice(elsStart, elsEnd + 1).join("\n");
  const initCall = lines.slice(elsEnd + 1, initCallEnd + 1).join("\n");

  const fns = parseFunctions(lines);
  const byModule = new Map();
  const stateInitFns = [];

  for (const fn of fns) {
    if (STATE_INIT_FNS.has(fn.name)) {
      stateInitFns.push(fn);
      continue;
    }
    const mod = moduleForFixed(fn.name);
    if (!mod) continue;
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod).push(fn);
  }

  const allNames = new Set(fns.map((f) => f.name));

  fs.rmSync(GAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(GAME_DIR, "modules"), { recursive: true });

  fs.writeFileSync(path.join(GAME_DIR, "gameApi.js"), `/** Cross-module call registry (filled when modules load). */\nexport const G = {};\n`);

  let stateInitSource = "";
  for (const fn of stateInitFns) {
    stateInitSource += `${extractSection(lines, fn.start, fn.end)}\n\n`;
  }

  const stateInitCalls = stateBody
    .replace(/createDefaultAccountUpgradeState\(\)/g, "G.createDefaultAccountUpgradeState()")
    .replace(/createDefaultAccountStats\(\)/g, "G.createDefaultAccountStats()")
    .replace(/clonePattern\(/g, "G.clonePattern(")
    .replace(/initialOpenScenesFromUrl\(\)/g, "G.initialOpenScenesFromUrl()");

  const runtimeContent = `${gameImports}

${constants}

export let state;

${stateInitSource}
export function initGameState() {
  state = {
${stateInitCalls}
  };
}

${moduleVars}

${shellBlock}

${domBootstrap}

${elsBlock}

${stateInitFns.map((f) => `G.${f.name} = ${f.name};`).join("\n")}
`;
  fs.writeFileSync(path.join(GAME_DIR, "runtime.js"), runtimeContent);

  const bootstrapFns = fns.filter((f) => BOOTSTRAP_FNS.has(f.name));
  const bootstrapNames = new Set(bootstrapFns.map((f) => f.name));
  const foreignForBootstrap = new Set([...allNames].filter((n) => !bootstrapNames.has(n)));

  let bootstrapBody = "";
  for (const fn of bootstrapFns) {
    let chunk = extractSection(lines, fn.start, fn.end);
    chunk = chunk.replace(/\brequestAnimationFrame\(tick\)/g, "requestAnimationFrame(G.tick)");
    chunk = chunk.replace(/\bsaveReady\s*=/g, "saveReady ="); // keep direct — imported from runtime
    bootstrapBody += `${rewriteCrossModuleCalls(chunk, bootstrapNames, foreignForBootstrap)}\n\n`;
  }

  const bootstrapRuntimeImports = "import { state, els, initGameState, saveReady, lastSimulationAt } from \"./runtime.js\";";

  const moduleOrder = [
    "persist", "audio", "stats", "offline", "mining", "training", "inventory", "zone", "town",
    "render", "draw", "combat", "groupDungeon", "bossParty",
    "coreA", "coreB", "coreC", "coreD", "coreE", "coreF",
  ];

  for (const mod of moduleOrder) {
    const modFns = byModule.get(mod);
    if (!modFns?.length) continue;

    const localNames = new Set(modFns.map((f) => f.name));
    const foreignNames = new Set([...allNames].filter((n) => !localNames.has(n)));

    let body = "";
    for (const fn of modFns) {
      body += `${rewriteCrossModuleCalls(extractSection(lines, fn.start, fn.end), localNames, foreignNames)}\n\n`;
    }

    const register = [...localNames].map((n) => `G.${n} = ${n};`).join("\n");
    fs.writeFileSync(
      path.join(GAME_DIR, "modules", `${mod}.js`),
      `${moduleImports}
import { state, els } from "../runtime.js";

${body}
${register}
`,
    );
  }

  const importLines = moduleOrder.filter((m) => byModule.has(m)).map((m) => `import "./modules/${m}.js";`).join("\n");

  fs.writeFileSync(
    path.join(GAME_DIR, "bootstrap.js"),
    `${gameImports}
${bootstrapRuntimeImports}

${bootstrapBody}
${bootstrapFns.map((f) => `G.${f.name} = ${f.name};`).join("\n")}

export async function boot() {
  initGameState();
  await G.init();
}
`,
  );

  fs.writeFileSync(
    path.join(GAME_DIR, "index.js"),
    `${importLines}
import { boot } from "./bootstrap.js";
import { els } from "./runtime.js";

boot().catch(async (err) => {
  els.status.textContent = err.message;
  els.status.classList.add("bad");
});
`,
  );

  fs.writeFileSync(APP, `/** Game entry — logic split under ./game/ (see app.monolith.js for original). */\nimport "./game/index.js";\n`);

  console.log(
    "Split complete:",
    [...byModule.entries()].map(([k, v]) => `${k}:${v.length}`).join(", "),
  );
}

main();
