import { ACTION_GROUPS, PLAYER_ACTIONS, sourceFrameFor } from "../../playerActions.js";
import {
  ENEMY_TEMPLATES,
  PLAYER_TEMPLATE,
  attackDelayMs,
  CRYSTAL_PLAYER_ACTION_LOCK_MS,
  crystalAdjustedExperience,
  twinDrakeAttackDelayMs,
  crystalExperienceForLevel,
  crystalPlayerBaseStats,
  CRYSTAL_MAX_LUCK,
  formatStatRange,
  randomInt,
  rollDamage,
  rollStat,
  statRange,
} from "../../battleData.js";
import { SPELL_GROUPS, bodyActionForSpell, spellLabel } from "../../spellBodyActions.js";
import { loadAtlas, loadJson, missingActions, sheetUrl } from "../../atlas.js";
import {
  BASIC_ATTACK_SKILL,
  CRYSTAL_TAOIST_SPELLS,
  CRYSTAL_WARRIOR_SPELLS,
  CRYSTAL_WIZARD_SPELLS,
  WARRIOR_COMBAT_SKILLS,
  magicIconSrc,
  CRYSTAL_SPELL_GLOBAL_LOCK_MS,
  crystalSpellCastCooldownMs,
  spellDelayMs,
  spellExperienceTarget,
  spellLevelRequirement,
  spellMpCost,
  taoistSpellById,
  taoistSpellByShape,
  warriorSpellById,
  warriorSpellByShape,
} from "../../warriorMagic.js";
import { MINING_SPOTS, PHASE1_ZONES } from "../../phase1Data.js";
import {
  GROUP_DUNGEON_SWARM_BLOCKED_RETRY_MS,
  GROUP_DUNGEON_SWARM_CELL_HEIGHT,
  GROUP_DUNGEON_SWARM_LANES,
  GROUP_DUNGEON_SWARM_SPAWN_MS,
  ensureSwarmDirectionalActions,
  fireWallCrossTiles,
  swarmAttackActionForLane,
  swarmEnemyEngagedStanceAction,
  swarmEnemyInAttackRange,
  swarmEnemyReservedTile,
  swarmEnemyTilePosition,
  swarmLaneFromMapRow,
  swarmLaneMapRow,
  swarmMeleeColumnWorldX,
  swarmPickWalkStep,
  swarmSnapTileX,
  swarmTileOccupied,
  GROUP_DUNGEON_WAVES_PER_FLOOR,
  GROUP_DUNGEON_WAVE_SPAWN_CAP,
  GROUP_DUNGEON_WAVE_FIELD_CAP,
  GROUP_DUNGEON_WAVE_REFILL_THRESHOLD,
  GROUP_DUNGEON_WAVE_REFILL_BATCH,
  GROUP_DUNGEON_WAVE_REFILL_COOLDOWN_MS,
  GROUP_DUNGEON_WAVE_INSTANT_CAP,
  GROUP_DUNGEON_WAVE_BURST_STAGGER_MS,
  groupDungeonWavesPerFloor,
  groupDungeonWaveSpawnCount,
  createGroupDungeonWaveState,
} from "../../groupDungeonSwarm.js";
import {
  BUFF_POTION_DURATION_MS,
  applyStatBuffsToStats,
  buffPotionDefForItem,
  formatBuffRemaining,
  isBuffPotionItem,
  pruneStatBuffs,
  sanitizeStatBuffs,
  statBuffBonusLabel,
} from "../../buffPotions.js";

import { battlePanelSignature, gamePanelSignature, sceneSignature, sceneOverlayInteractionUntil, combatSkillBarSignature, playerHudSignature, hotbarSignature, musicTrackIndex, musicStatusText, bossPartyVisualAtlasCache, stampBackgroundCache, imageCache } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els } from "../runtime.js";

function nextFreeSlotInInventoryState(inventory) {
  G.syncInventoryCapacity(inventory);
  const used = new Set();
  for (const entry of inventory.items ?? []) {
    const slot = entry.slot;
    if (Number.isInteger(slot) && slot >= 0 && slot < inventory.maxSlots) used.add(slot);
  }
  for (let slot = 0; slot < inventory.maxSlots; slot++) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

function magicStateForPersistence(magic) {
  const cloned = G.cloneMagicState(magic);
  for (const learned of Object.values(cloned.learned ?? {})) {
    learned.castReadyAt = 0;
  }
  return cloned;
}

function isGroupContentZone(zone = G.activeZone()) {
  return Boolean(zone && (G.groupDungeonZone(zone) || G.bossRoomDef(zone.id)));
}

function presentOfflineMiningReport(report) {
  const duration = G.formatDuration(report.elapsedMs);
  const dropsText = G.reportCountText(report.drops, 5);
  const ignoredText = G.reportCountText(report.ignoredDrops, 3);
  const lines = [
    `Offline mining ${duration}: ${report.swings} swings, ${report.hits} ore finds`,
  ];
  if (dropsText) lines.push(`Found ${dropsText}`);
  if (ignoredText) lines.push(`No room for ${ignoredText}`);
  if (report.capped) lines.push("Offline cap reached: 8h");

  state.game.offlineReport = {
    kind: "mining",
    duration,
    swings: report.swings,
    hits: report.hits,
    drops: [...report.drops.entries()],
    ignoredDrops: [...report.ignoredDrops.entries()],
    capped: report.capped,
  };
  state.game.recentLoot = [...lines, ...state.game.recentLoot].slice(0, 6);
  for (const line of [...lines].reverse()) G.pushBattleLog(line);
  G.addLootNotice(`Offline: ${report.hits} ore`, "item");
  G.renderOfflineReport();
}

function maxStatBuffRemainingMs(buff) {
  if (buff?.kind === "magicShield" || buff?.stat === "damageReduction") return 30 * 60 * 1000;
  if (buff?.stat === "ac" || buff?.stat === "amc") return 30 * 60 * 1000;
  if (buff?.kind === "ultimateEnhancer") return 30 * 60 * 1000;
  return BUFF_POTION_DURATION_MS;
}

function presentOfflineReport(report) {
  const duration = G.formatDuration(report.elapsedMs);
  const dropsText = G.reportCountText(report.drops, 3);
  const ignoredText = G.reportCountText(report.ignoredDrops, 2);
  const potionText = G.reportCountText(report.potionsUsed, 2);
  const isBossParty = report.kind === "bossParty";
  const lines = isBossParty
    ? [
      `Offline party ${duration}: ${report.kills} kills`,
      `+${report.xp} XP, +${report.gold} gold`,
    ]
    : [
      `Offline ${duration}: ${report.kills} kills`,
      `+${report.xp} XP, +${report.gold} gold`,
    ];
  if (report.wavesCleared > 0) lines.push(`Waves cleared: ${report.wavesCleared}`);
  if (report.levels.length) lines.push(`Level ${report.levels.at(-1)}`);
  if (dropsText) lines.push(`Found ${dropsText}`);
  if (ignoredText) lines.push(`No room for ${ignoredText}`);
  if (potionText) lines.push(`Used ${potionText}`);
  if (report.diedAtMs) lines.push(`Defeated after ${G.formatDuration(report.diedAtMs)}`);
  if (report.capped) lines.push("Offline cap reached: 8h");

  state.game.offlineReport = {
    kind: isBossParty ? "bossParty" : "zone",
    duration,
    kills: report.kills,
    xp: report.xp,
    gold: report.gold,
    level: report.levels.at(-1) ?? null,
    drops: [...report.drops.entries()],
    ignoredDrops: [...report.ignoredDrops.entries()],
    potionsUsed: [...report.potionsUsed.entries()],
    defeatedAfter: report.diedAtMs ? G.formatDuration(report.diedAtMs) : "",
    capped: report.capped,
  };
  state.game.recentLoot = [...lines, ...state.game.recentLoot].slice(0, 6);
  for (const line of [...lines].reverse()) G.pushBattleLog(line);
  G.addLootNotice(report.diedAtMs ? "Offline: defeated" : `Offline: ${report.kills} kills`, report.diedAtMs ? "full" : "item");
  G.renderOfflineReport();
}

function loadPrototypeStatsPlayerId() {
  try {
    const existing = localStorage.getItem(STATS_PLAYER_ID_KEY);
    if (existing) return existing;
    const generated = globalThis.crypto?.randomUUID?.() ?? `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STATS_PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function loadPrototypeStatsConfig() {
  const config = await loadJson(STATS_CONFIG_URL).catch(() => ({}));
  const endpoint = typeof config.endpoint === "string" ? config.endpoint.trim() : "";
  state.prototypeStats.endpoint = endpoint;
  state.prototypeStats.configured = Boolean(endpoint) && config.enabled !== false;
  state.prototypeStats.statusText = state.prototypeStats.configured
    ? "Anonymous progress stats ready."
    : "Stats endpoint not configured yet.";
}

function maybeSubmitPrototypeStats(now) {
  if (!G.prototypeStatsCanSubmit()) return;
  if (state.prototypeStats.submitting) return;
  if (now - state.prototypeStats.lastSubmittedAt < STATS_SUBMIT_INTERVAL_MS) return;
  void G.submitPrototypeStats("interval", now);
}

function incrementReportCount(map, label, amount = 1) {
  map.set(label, (map.get(label) ?? 0) + amount);
}

function invalidateUi() {
  battlePanelSignature = "";
  gamePanelSignature = "";
  sceneSignature = "";
  combatSkillBarSignature = "";
  playerHudSignature = "";
  hotbarSignature = "";
}

function objectFrameList(set) {
  return set?.objects?.map((object, slot) => ({ slot, frame: object.srcFrame })) ?? [];
}

function missingAccountUpgradeItemLabel(upgrade) {
  if (G.accountUpgradeUsesRebirthPoints(upgrade)) return "Rebirth Points";
  for (const cost of G.accountUpgradeItemCosts(upgrade)) {
    const item = itemDefinition(cost.itemId);
    if (G.inventoryItemQuantity(cost.itemId) < cost.quantity) return item?.name ?? "Item";
  }
  return state.inventory.gold < G.accountUpgradeGoldCost(upgrade) ? "Gold" : "Item";
}

function missingAccountUpgradeCostText(upgrade) {
  const parts = [];
  if (G.accountUpgradeUsesRebirthPoints(upgrade)) {
    const cost = G.accountUpgradeRebirthCost(upgrade);
    if (cost != null && G.accountRebirthPoints() < cost) {
      parts.push(`${cost - G.accountRebirthPoints()} Rebirth Point${cost - G.accountRebirthPoints() === 1 ? "" : "s"}`);
    }
    return parts.length ? parts.join(", ") : "Rebirth Points";
  }
  const goldCost = G.accountUpgradeGoldCost(upgrade);
  if (state.inventory.gold < goldCost) parts.push(`${(goldCost - state.inventory.gold).toLocaleString()} gold`);
  for (const cost of G.accountUpgradeItemCosts(upgrade)) {
    const item = itemDefinition(cost.itemId);
    const missing = cost.quantity - G.inventoryItemQuantity(cost.itemId);
    if (missing > 0) parts.push(`${missing}x ${item?.name ?? cost.itemId}`);
  }
  return parts.length ? parts.join(", ") : "the required materials";
}

function payAccountUpgradeCost(upgrade) {
  if (!G.canAffordAccountUpgrade(upgrade)) return false;
  if (G.accountUpgradeUsesRebirthPoints(upgrade)) {
    const cost = G.accountUpgradeRebirthCost(upgrade);
    if (cost == null || G.accountRebirthPoints() < cost) return false;
    return G.payRebirthPoints(cost);
  }
  state.inventory.gold -= G.accountUpgradeGoldCost(upgrade);
  for (const cost of G.accountUpgradeItemCosts(upgrade)) {
    if (!G.removeInventoryItemQuantity(cost.itemId, cost.quantity)) return false;
  }
  return true;
}

function normalizeUpgradeCategory(categoryId) {
  return ACCOUNT_UPGRADE_CATEGORIES.some((category) => category.id === categoryId)
    ? categoryId
    : ACCOUNT_UPGRADE_CATEGORIES[0].id;
}

function isWeaponRefineStagedEntry(entryId) {
  return Boolean(G.weaponRefineStagedRecord(entryId));
}

function isRefineJewelleryItem(item) {
  return Boolean(item?.slot) && REFINE_JEWELLERY_SLOTS.has(item.slot);
}

function pickWeaponRefineStatKey(totalDC, totalMC, totalSC) {
  if (totalDC >= totalMC && totalDC >= totalSC && totalDC > 0) return { key: "dc", value: totalDC };
  if (totalMC >= totalDC && totalMC >= totalSC && totalMC > 0) return { key: "mc", value: totalMC };
  if (totalSC >= totalDC && totalSC >= totalMC && totalSC > 0) return { key: "sc", value: totalSC };
  return { key: null, value: 0 };
}

function openWeaponRefineScene() {
  if (state.game.mode !== "town") return;
  state.activeScene = "weaponRefine";
  state.openScenes.inventory = true;
  if (!state.weaponRefine.picker) state.weaponRefine.picker = { kind: "weapon", index: 0 };
  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.playSfx("ui.button", { volume: 0.35, throttleMs: 120 });
}

function junkOreInventoryEntries() {
  G.ensureInventorySlots();
  return G.inventoryEntries()
    .map((entry) => ({ entry, item: itemDefinition(entry.itemId) }))
    .filter(({ entry, item }) => G.isJunkOreItem(item)
      && !isEquippedEntry(entry.id)
      && !isHotbarEntry(entry.id)
      && itemSellValue(item, Math.max(1, Number(entry.quantity) || 1)) > 0);
}

function junkOreSellPreview() {
  const rows = junkOreInventoryEntries();
  const count = rows.reduce((sum, { entry }) => sum + Math.max(1, Number(entry.quantity) || 1), 0);
  const gold = rows.reduce((sum, { entry, item }) => {
    const quantity = Math.max(1, Number(entry.quantity) || 1);
    return sum + itemSellValue(item, quantity);
  }, 0);
  return { count, gold };
}

function isGemUpgradeItem(item) {
  return Boolean(item?.gem && (item.gem.stat || item.gem.durabilityBonus > 0));
}

function isBookItem(item) {
  return item?.type === "book" && Boolean(item.spell);
}

function learnedMagic(spellId) {
  return state.magic.learned[spellId] ?? null;
}

function magicSpellById(spellId) {
  return warriorSpellById(spellId) ?? G.wizardSpellById(spellId) ?? taoistSpellById(spellId);
}

function magicSpellByShape(shape) {
  return warriorSpellByShape(shape) ?? taoistSpellByShape(shape) ?? null;
}

function magicSignature() {
  normalizeAutoCastSpellsForClass(state.battle.combatClass);
  const spells = G.characterSkillSpells();
  return spells
    .map((spell) => {
      const learned = learnedMagic(spell.id);
      return learned
        ? `${spell.id}:${learned.level}:${learned.experience}:${learned.autoCast ? 1 : 0}:${Math.floor((learned.castReadyAt ?? 0) / 100)}`
        : `${spell.id}:locked`;
    })
    .join("|") || `${state.battle.combatClass}:no-spells`;
}

function noteSceneOverlayInteraction(untilMs = 500) {
  sceneOverlayInteractionUntil = Math.max(sceneOverlayInteractionUntil, performance.now() + untilMs);
}

function isWizardCombatSpellId(spellId) {
  return WIZARD_COMBAT_SPELLS.some((spell) => spell.id === spellId);
}

function isTaoistCombatSpellId(spellId) {
  return TAOIST_COMBAT_SPELLS.some((spell) => spell.id === spellId);
}

function isWarriorCombatSkillId(spellId) {
  return G.combatAutoCastSpells("Warrior").some((skill) => skill.id === spellId);
}

function isQueuedCombatSpell(spellId, classId = state.battle.combatClass) {
  return state.battle.queuedCombatSpellId === spellId && G.combatAutoCastClassForSpell(spellId) === classId;
}

function maxAccountUpgradeValue(effect) {
  return ACCOUNT_UPGRADE_DEFS.reduce((total, upgrade) => (
    total + (upgrade.effect === effect ? Math.max(0, Math.trunc(Number(upgrade.value) || 0)) : 0)
  ), 0);
}

function maxAutoCastSlotLimit() {
  return BASE_AUTOCAST_SLOTS + maxAccountUpgradeValue("autocastSlots");
}

function maxAutoPotionSlotLimit() {
  return Math.min(HOTBAR_SLOT_COUNT, BASE_AUTO_POTION_SLOTS + maxAccountUpgradeValue("autoPotionSlots"));
}

function normalizeAutoCastSpellsForClass(classId = state.battle.combatClass, preferredSpellId = null) {
  const limit = Math.max(1, G.autoCastSlotLimit());
  const active = G.combatAutoCastSpells(classId)
    .map((spell) => ({ spell, learned: learnedMagic(spell.id) }))
    .filter(({ learned }) => learned?.autoCast)
    .sort((a, b) => G.autoCastPriorityForClass(classId, a.spell) - G.autoCastPriorityForClass(classId, b.spell));
  if (active.length <= limit) return active.map(({ spell }) => spell);

  const keep = [];
  const preferred = active.find(({ spell }) => spell.id === preferredSpellId);
  if (preferred) keep.push(preferred);
  for (const entry of active) {
    if (keep.length >= limit) break;
    if (keep.some(({ spell }) => spell.id === entry.spell.id)) continue;
    keep.push(entry);
  }
  const keepIds = new Set(keep.map(({ spell }) => spell.id));
  for (const { spell, learned } of active) {
    learned.autoCast = keepIds.has(spell.id);
  }
  return keep.map(({ spell }) => spell);
}

function normalizeWizardAutoSpells(preferredSpellId = null) {
  return normalizeAutoCastSpellsForClass("Wizard", preferredSpellId);
}

function learnSpellFromBook(entryId) {
  const entry = G.inventoryEntryById(entryId);
  const item = entry ? itemDefinition(entry.itemId) : null;
  if (!entry || !isBookItem(item)) return false;
  const spell = magicSpellByShape(item.spell?.shape) ?? magicSpellById(item.spell?.id);
  if (!spell) {
    G.pushBattleLog(`${item.name} does not map to a known spell yet.`);
    return false;
  }
  if (learnedMagic(spell.id)) {
    G.pushBattleLog(`${spell.label} is already learned.`);
    return false;
  }
  const requirement = itemRequirementStatus(item);
  if (!requirement.ok) {
    G.pushBattleLog(`Cannot learn ${spell.label}: ${requirement.reason}.`);
    return false;
  }

  state.magic.learned[spell.id] = {
    spellId: spell.id,
    level: 0,
    experience: 0,
    key: null,
    autoCast: false,
    castReadyAt: 0,
    learnedAt: performance.now(),
  };
  G.removeInventoryEntry(entry.id, 1);
  G.applyEquippedStatsToBattlePlayer();
  state.characterTab = "skill";
  G.playSfx("item.move", { volume: 0.44, throttleMs: 80 });
  G.pushBattleLog(`Learned ${spell.label}.`);
  G.addLootNotice(`Learned ${spell.label}`, "level");
  sceneSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  G.renderSceneOverlay();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
  G.renderGamePanel();
  return true;
}

function maybeAutoWarriorCharge(now) {
  if (state.battle.combatClass !== "Warrior") return false;
  if (G.warriorSlayingPending()) return false;
  for (const spellId of WARRIOR_AUTO_CHARGE_ORDER) {
    if (G.warriorChargeReady(spellId)) continue;
    const skill = warriorSpellById(spellId);
    const learned = learnedMagic(spellId);
    if (!skill || !learned?.autoCast) continue;
    if (!G.canUseWarriorSkill(skill, learned, now, { requireAuto: true })) continue;
    G.castWarriorCharge(skill, learned, spellMpCost(skill, learned), now);
    return true;
  }
  return false;
}

function nextFreeInventorySlot() {
  G.syncInventoryCapacity();
  const maxSlots = state.inventory.maxSlots;
  const used = new Set();
  for (const entry of G.inventoryEntries()) {
    const slot = entry.slot;
    if (Number.isInteger(slot) && slot >= 0 && slot < maxSlots) used.add(slot);
  }
  for (let slot = 0; slot < maxSlots; slot++) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

function itemEntryById(entryId) {
  return G.inventoryEntryById(entryId) ?? G.storageEntryById(entryId);
}

function nextFreeStorageSlot() {
  G.ensureStorageSlots();
  const maxSlots = state.account.storage.maxSlots;
  const used = new Set(G.storageEntries().map((entry) => Number.isInteger(entry.slot) ? entry.slot : null).filter((slot) => slot !== null));
  for (let slot = 0; slot < maxSlots; slot++) {
    if (!used.has(slot)) return slot;
  }
  return maxSlots;
}

function mergeEntryIntoStack(sourceEntry, targetEntry) {
  if (!G.sameStackableItem(sourceEntry, targetEntry)) return false;
  const item = itemDefinition(sourceEntry.itemId);
  const available = maxItemStack(item) - targetEntry.quantity;
  const amount = Math.min(available, sourceEntry.quantity);
  if (amount <= 0) return false;
  targetEntry.quantity += amount;
  sourceEntry.quantity -= amount;
  return sourceEntry.quantity <= 0;
}

function isHotbarEntry(entryId) {
  return G.hotbarSlotForEntry(entryId) >= 0;
}

function moveInventoryEntryToSlot(entryId, slot) {
  G.ensureInventorySlots();
  const targetSlot = Math.max(0, Math.min(state.inventory.maxSlots - 1, Number(slot)));
  const entry = state.inventory.items.find((candidate) => candidate.id === entryId);
  if (!entry || isEquippedEntry(entry.id) || entry.slot === targetSlot) return;
  const occupant = G.inventoryEntryAtSlot(targetSlot);
  if (occupant && occupant.id !== entry.id) {
    if (G.stackEntriesCombinable(entry, occupant)) {
      const hotbarChanged = G.hotbarSlotForEntry(entryId) >= 0;
      mergeEntryIntoStack(entry, occupant);
      if (entry.quantity <= 0) {
        G.clearHotbarEntry(entry.id);
        state.inventory.items = state.inventory.items.filter((candidate) => candidate.id !== entry.id);
      }
      G.renderInventoryStacksChanged({ hotbarChanged });
      return;
    }
    occupant.slot = entry.slot;
  }
  entry.slot = targetSlot;
  G.renderInventoryStacksChanged({ playMoveSfx: true });
}

function moveStorageEntryToStorageSlot(entryId, slot) {
  G.ensureStorageSlots();
  const entry = G.storageEntryById(entryId);
  if (!entry) return false;
  const maxSlots = state.account.storage.maxSlots;
  const targetSlot = Math.max(0, Math.min(maxSlots - 1, Number(slot)));
  if (entry.slot === targetSlot) return true;
  const targetEntry = G.storageEntryAtSlot(targetSlot);
  if (targetEntry && G.sameStackableItem(entry, targetEntry)) {
    const consumed = mergeEntryIntoStack(entry, targetEntry);
    if (consumed) state.account.storage.items = state.account.storage.items.filter((candidate) => candidate.id !== entry.id);
    G.renderStorageMove();
    return true;
  }
  if (targetEntry) targetEntry.slot = entry.slot;
  entry.slot = targetSlot;
  G.renderStorageMove();
  return true;
}

function itemDefinition(itemId) {
  return state.itemData.items.find((item) => item.id === itemId) ?? null;
}

function itemEntryStats(entry, item = itemDefinition(entry?.itemId)) {
  const stats = G.cloneStats({
    maxHp: Number(item?.stats?.hp) || 0,
    maxMp: Number(item?.stats?.mp) || 0,
    dc: [...(item?.stats?.dc ?? [0, 0])],
    mc: [...(item?.stats?.mc ?? [0, 0])],
    sc: [...(item?.stats?.sc ?? [0, 0])],
    ac: [...(item?.stats?.ac ?? [0, 0])],
    amc: [...(item?.stats?.amc ?? [0, 0])],
    accuracy: Number(item?.stats?.accuracy) || 0,
    agility: Number(item?.stats?.agility) || 0,
    luck: Number(item?.stats?.luck) || 0,
    attackSpeed: Number(item?.stats?.attackSpeed) || 0,
    freezing: Number(item?.stats?.Freezing ?? item?.stats?.freezing) || 0,
    poisonAttack: Number(item?.stats?.poisonAttack) || 0,
    magicResist: Number(item?.stats?.magicResist) || 0,
    poisonResist: Number(item?.stats?.poisonResist) || 0,
    healthRecovery: Number(item?.stats?.healthRecovery) || 0,
    poisonRecovery: Number(item?.stats?.poisonRecovery) || 0,
    strong: Number(item?.stats?.strong) || 0,
  });
  const bonusStats = G.sanitizeItemBonusStats(entry?.bonusStats);
  G.addStats(stats, bonusStats);
  return {
    hp: stats.maxHp,
    mp: stats.maxMp,
    dc: stats.dc,
    mc: stats.mc,
    sc: stats.sc,
    ac: stats.ac,
    amc: stats.amc,
    accuracy: stats.accuracy,
    agility: stats.agility,
    luck: stats.luck,
    attackSpeed: stats.attackSpeed,
    freezing: stats.freezing,
    poisonAttack: stats.poisonAttack,
    magicResist: stats.magicResist,
    poisonResist: stats.poisonResist,
    healthRecovery: stats.healthRecovery,
    poisonRecovery: stats.poisonRecovery,
    strong: stats.strong,
  };
}

function itemDisplayName(item, entry = null) {
  const smithLevel = Math.max(0, Math.trunc(Number(entry?.refineLevel) || 0));
  const weaponRefineLevel = Math.max(0, Math.trunc(Number(entry?.weaponRefineLevel) || 0));
  const luckLabel = entry && item?.slot === "weapon" ? G.benedictionLuckLabel(G.weaponEntryLuck(entry, item)) : "";
  const suffixParts = [];
  if (smithLevel > 0) suffixParts.push(`+${smithLevel}`);
  if (weaponRefineLevel > 0) suffixParts.push(`Ref +${weaponRefineLevel}`);
  if (luckLabel) suffixParts.push(luckLabel);
  if (entry && isOreItem(item)) {
    const purity = G.orePurity(entry, item);
    if (purity > 0) suffixParts.push(`P${purity}`);
  }
  const suffix = suffixParts.join(", ");
  return `${item?.name ?? "Item"}${suffix ? ` (${suffix})` : ""}`;
}

function itemDefinitionMaxDura(item) {
  return Math.max(0, Math.trunc(Number(item?.durability) || 0));
}

function isOreItem(item) {
  return Boolean(item) && (item.type === "ore" || ORE_ITEM_IDS.has(item.id));
}

function isPickaxeItem(item) {
  return Boolean(item) && (item.canMine === true || item.id === "pickaxe");
}

function itemUsesEntryDurability(item) {
  if (!item || isStackableItem(item)) return false;
  return itemDefinitionMaxDura(item) > 0;
}

function normalizeInventoryEntryFields(savedEntry, item = null) {
  const resolvedItem = item ?? itemDefinition(savedEntry?.itemId);
  const fields = {
    refineLevel: Math.max(0, Math.trunc(Number(savedEntry?.refineLevel) || 0)),
    weaponRefineLevel: G.sanitizeWeaponRefineLevel(savedEntry?.weaponRefineLevel),
    gemCount: Math.max(0, Math.trunc(Number(savedEntry?.gemCount) || 0)),
    bonusStats: G.sanitizeItemBonusStats(savedEntry?.bonusStats),
  };
  const dura = G.sanitizeEntryDurability(savedEntry, resolvedItem);
  if (dura) {
    fields.maxDura = dura.maxDura;
    fields.currentDura = dura.currentDura;
  }
  return fields;
}

function isStackableItem(item) {
  return Boolean(item?.stackable) && maxItemStack(item) > 1;
}

function maxItemStack(item) {
  return Math.max(1, Math.floor(Number(item?.maxStack) || 1));
}

function isPotionItem(item) {
  return Boolean(item) && item.type === "potion";
}

function isBenedictionOilItem(item) {
  return Boolean(item) && (item.scroll?.kind === "benediction" || item.id === BENEDICTION_OIL_ITEM_ID);
}

function isWoomaTaurusEnemy(enemy) {
  if (!enemy) return false;
  return enemy.id === WOMA_TAURUS_ENEMY_ID || enemy.crystalName === "WoomaTaurus";
}

function isIncarnatedWoomaTaurusEnemy(enemy) {
  if (!enemy) return false;
  const incarnatedId = G.INCARNATED_WT_ENEMY_ID ?? 306;
  return enemy.id === incarnatedId || enemy.crystalName === "IncarnatedWT";
}

function isIncarnatedZumaTaurusEnemy(enemy) {
  if (!enemy) return false;
  const incarnatedId = G.INCARNATED_ZT_ENEMY_ID ?? 317;
  return enemy.id === incarnatedId || enemy.crystalName === "IncarnatedZT";
}

function isKingHogEnemy(enemy) {
  if (!enemy) return false;
  return enemy.id === (G.KING_HOG_ENEMY_ID ?? 316) || enemy.crystalName === "KingHog";
}

function isOmaKingSpiritEnemy(enemy) {
  if (!enemy) return false;
  return enemy.id === OMA_KING_SPIRIT_ENEMY_ID || enemy.crystalName === "OmaKingSpirit";
}

function isPoisonItem(item) {
  return Boolean(item) && (item.type === "poison" || Boolean(item.poison));
}

function isTaoistAmuletItem(item) {
  return Boolean(item) && (item.type === "amulet" || Boolean(item.amulet));
}

function poisonItemKind(item) {
  if (!isPoisonItem(item)) return null;
  if (item.poison?.type === "green" || Number(item.shape) === 1) return "green";
  return "yellow";
}

function potionRestoreAmount(item, kind) {
  if (!isPotionItem(item)) return 0;
  return Math.max(0, Math.floor(Number(item.stats?.[kind]) || 0));
}

function potionShape(item) {
  return Math.max(0, Math.floor(Number(item?.shape) || 0));
}

function potionRestoreMode(item) {
  return potionShape(item) === 1 ? "instant" : "overTime";
}

function potionRestoreParts(hpRestore, mpRestore) {
  const parts = [];
  if (hpRestore > 0) parts.push(`${hpRestore} HP`);
  if (mpRestore > 0) parts.push(`${mpRestore} MP`);
  return parts.join(" and ");
}

function potionInventoryCount(kind) {
  return G.carriedInventoryEntries().reduce((sum, entry) => {
    const item = itemDefinition(entry.itemId);
    return sum + (potionRestoreAmount(item, kind) > 0 ? entry.quantity : 0);
  }, 0);
}

function poisonInventoryEntries(kind = null) {
  return G.carriedInventoryEntries().filter((entry) => {
    const item = itemDefinition(entry.itemId);
    if (!isPoisonItem(item)) return false;
    return !kind || poisonItemKind(item) === kind;
  });
}

function poisonInventoryCount(kind = null) {
  return poisonInventoryEntries(kind).reduce((sum, entry) => sum + Math.max(1, Math.floor(Number(entry.quantity) || 1)), 0);
}

function isEquipableItem(item) {
  return item && G.compatibleEquipmentSlots(item).length > 0 && !isStackableItem(item);
}

function isEquippedEntry(entryId) {
  return Object.values(state.inventory.equipment).includes(entryId);
}

function partyAssistPickerHtml() {
  return `
      <div class="boss-entry-actions">
        ${BOSS_ASSIST_OPTIONS.map(bossAssistOptionHtml).join("")}
      </div>
      <p class="boss-entry-note">Optionally bring saved characters into the fight.</p>
  `;
}

function optionsSceneHtml() {
  const track = G.currentMusicTrack();
  const volume = Math.round(G.normalizedVolume(state.settings.musicVolume) * 100);
  const sfxVolume = Math.round(G.normalizedVolume(state.settings.sfxVolume) * 100);
  const musicMode = G.normalizedMusicMode(state.settings.musicMode);
  const statsReady = state.prototypeStats.configured;
  const statsEnabled = statsReady && state.settings.prototypeStatsEnabled;
  return `
    <section class="options-panel">
      <div class="options-row">
        <div>
          <strong>Getting Started Guide</strong>
          <span>Stats, potions, auto pots, skills, and other basics.</span>
        </div>
        <button type="button" data-open-scene="gettingStarted">Open Guide</button>
      </div>
      <div class="options-row">
        <div>
          <strong>Anonymous Stats</strong>
          <span>${statsReady
            ? (statsEnabled ? "Account progress tracking enabled" : "Account progress tracking disabled")
            : "Leaderboard endpoint not configured yet"}</span>
        </div>
        <button
          type="button"
          class="${statsEnabled ? "active" : ""}"
          data-toggle-prototype-stats
          ${statsReady ? "" : "disabled"}
        >
          ${statsReady ? (statsEnabled ? "On" : "Off") : "Not Set"}
        </button>
      </div>
      ${state.prototypeStats.statusText ? `<p class="options-note">${G.escapeHtml(state.prototypeStats.statusText)}</p>` : ""}
      <div class="options-row">
        <div>
          <strong>Music</strong>
          <span>${state.settings.musicEnabled ? (musicMode === MUSIC_MODE_TRACK ? "Selected track looping" : "Playlist looping") : "Background music disabled"}</span>
        </div>
        <button type="button" class="${state.settings.musicEnabled ? "active" : ""}" data-toggle-music>
          ${state.settings.musicEnabled ? "On" : "Off"}
        </button>
      </div>
      <label class="options-volume">
        <span>Music Volume</span>
        <input type="range" min="0" max="100" step="1" value="${volume}" data-music-volume />
        <strong>${volume}%</strong>
      </label>
      <div class="options-row">
        <div>
          <strong>Now Playing</strong>
          <span>${G.escapeHtml(track?.label ?? "No track selected")}${track ? ` (${G.escapeHtml(track.id)})` : ""}</span>
        </div>
        <button type="button" data-music-next>Playlist</button>
      </div>
      ${musicStatusText ? `<p class="options-note">${G.escapeHtml(musicStatusText)}</p>` : ""}
      <div class="options-row">
        <div>
          <strong>Sound Effects</strong>
          <span>${state.settings.sfxEnabled ? "Combat and UI sounds enabled" : "Sound effects disabled"}</span>
        </div>
        <button type="button" class="${state.settings.sfxEnabled ? "active" : ""}" data-toggle-sfx>
          ${state.settings.sfxEnabled ? "On" : "Off"}
        </button>
      </div>
      <label class="options-volume">
        <span>SFX Volume</span>
        <input type="range" min="0" max="100" step="1" value="${sfxVolume}" data-sfx-volume />
        <strong>${sfxVolume}%</strong>
      </label>
      <div class="music-track-list">
        ${BACKGROUND_MUSIC_TRACKS.map((entry, index) => `
          <button
            type="button"
            class="${index === musicTrackIndex && musicMode === MUSIC_MODE_TRACK ? "active" : ""}"
            data-music-track="${index}"
          >
            <span>${G.escapeHtml(entry.id)}</span>
            <strong>${G.escapeHtml(entry.label)}</strong>
          </button>
        `).join("")}
      </div>
      <div class="options-row">
        <div>
          <strong>Export Save</strong>
          <span>Download your progress as a file to back up or play on another PC.</span>
        </div>
        <button type="button" data-export-save>Download</button>
      </div>
      <div class="options-save-transfer">
        <div class="options-save-transfer-header">
          <div>
            <strong>Import Save</strong>
            <span>Replace this browser&apos;s progress with a save from another device.</span>
          </div>
          <label class="options-save-transfer-file">
            <input type="file" accept=".json,application/json" data-import-save-file hidden />
            <span>Choose File</span>
          </label>
        </div>
        <textarea id="saveImportText" spellcheck="false" placeholder="Paste save JSON here, or choose a file above."></textarea>
        <button type="button" class="primary" data-import-save>Import Save</button>
      </div>
      <div class="options-row options-row-danger">
        <div>
          <strong>Reset Save</strong>
          <span>Permanently delete all saved progress and start fresh.</span>
        </div>
        <button type="button" data-reset-save>Reset Save</button>
      </div>
    </section>
  `;
}

function itemSpellTooltipHtml(item) {
  if (!isBookItem(item)) return "";
  const spell = magicSpellByShape(item.spell?.shape) ?? magicSpellById(item.spell?.id);
  if (!spell) return `<span>Teaches: unknown spell #${G.escapeHtml(item.spell?.shape ?? item.spell?.id ?? "")}</span>`;
  const learned = learnedMagic(spell.id);
  return `
    <span>Teaches: ${G.escapeHtml(spell.label)}${learned ? " (learned)" : ""}</span>
    <span>${G.escapeHtml(spell.description ?? "")}</span>
  `;
}

function itemRequirementTooltipHtml(item) {
  const requirement = itemRequirementStatus(item);
  const label = itemRequirementLabel(item.requirements);
  if (!label) return "";
  return `<span class="${requirement.ok ? "requirement-ok" : "requirement-bad"}">Requires: ${G.escapeHtml(label)}${requirement.ok ? "" : ` (${G.escapeHtml(requirement.reason)})`}</span>`;
}

function itemGemTooltipHtml(item) {
  const gem = item.gem;
  if (!gem) return "";
  const statLabel = G.gemUpgradeStatLabel(gem);
  const amount = gem.durabilityBonus > 0 ? gem.durabilityBonus : (gem.stat?.amount ?? 1);
  const kindLabel = gem.kind === "orb" ? "Orb (safe — item never breaks on failure)" : "Gem (failed upgrades can destroy the item)";
  const slotLabels = Object.entries(GEM_VALID_SLOT_FLAGS)
    .filter(([, flag]) => (Math.trunc(Number(gem.unique) || 0) & flag) !== 0)
    .map(([slotId]) => G.slotLabel(slotId))
    .join(", ");
  return `
    <span>${G.escapeHtml(kindLabel)}</span>
    <span>Adds +${amount} ${G.escapeHtml(statLabel)} on success</span>
    <span>Base success: ${Math.max(0, Math.trunc(Number(gem.criticalRate) || 0))}% (drops as stat is added)</span>
    <span>Max ${Math.max(0, Math.trunc(Number(gem.maxStatCount) || 0))} ${G.escapeHtml(statLabel)} / ${Math.max(0, Math.trunc(Number(gem.criticalDamage) || 0))} total upgrades</span>
    ${slotLabels ? `<span>Valid on: ${G.escapeHtml(slotLabels)}</span>` : ""}
    <span>Drag onto equipment to apply</span>
  `;
}

function itemBenedictionTooltipHtml(item, entry = null) {
  const weaponEntryId = state.inventory.equipment?.weapon ?? null;
  const weaponEntry = weaponEntryId ? G.inventoryEntryById(weaponEntryId) : null;
  const weaponItem = weaponEntry ? itemDefinition(weaponEntry.itemId) : null;
  const weaponLuck = weaponEntry && weaponItem?.slot === "weapon" ? G.weaponEntryLuck(weaponEntry, weaponItem) : null;
  const rates = weaponLuck == null ? null : G.benedictionOutcomeRates(weaponLuck);
  const totalLuck = weaponLuck == null ? null : Math.max(-CRYSTAL_MAX_LUCK, Math.min(CRYSTAL_MAX_LUCK, 1 + weaponLuck));
  const equippedLine = weaponEntry && weaponItem
    ? `<span>Equipped weapon: ${G.escapeHtml(itemDisplayName(weaponItem, weaponEntry))}${weaponLuck != null ? ` (${G.escapeHtml(G.benedictionLuckLabel(weaponLuck))})` : ""}${rates ? ` — bless ${rates.bless.toFixed(1)}%, curse ${rates.curse.toFixed(0)}%, no effect ${rates.none.toFixed(1)}%` : ""}${totalLuck != null ? ` — combat max-hit ${G.combatMaxHitChancePercent(totalLuck).toFixed(0)}%` : ""}</span>`
    : `<span>Requires an equipped weapon.</span>`;
  return `
    <span>Blesses your equipped weapon for +1 Luck (max +${BENEDICTION_MAX_WEAPON_LUCK}).</span>
    <span>5% curse chance. Bless rates: +0 guaranteed, +1→+2 20%, +2→+4 10%, +4 and above 5%. Cursed weapons recover on the next successful bless.</span>
    <span>Total luck = base 1 + weapon luck. Luck ${CRYSTAL_MAX_LUCK} always rolls maximum damage.</span>
    ${equippedLine}
  `;
}

function itemOreTooltipHtml(entry, item) {
  const purity = G.orePurity(entry, item);
  const percent = G.entryDurabilityPercent(entry, item);
  return `<span>Purity: ${purity}${percent != null ? ` (${percent}% durability)` : ""}</span>`;
}

function itemDurabilityTooltipHtml(entry, item) {
  const percent = G.entryDurabilityPercent(entry, item);
  if (percent == null) return "";
  return `<span>Durability: ${percent}%</span>`;
}

function itemPotionTooltipHtml(item) {
  const def = buffPotionDefForItem(item);
  if (def) {
    const classes = def.classes.join(" / ");
    const durationMin = Math.round(BUFF_POTION_DURATION_MS / 60000);
    return `<span>Buff (${G.escapeHtml(classes)}): ${G.escapeHtml(statBuffBonusLabel(def))} for ${durationMin} min</span>`;
  }
  const restores = [];
  const hp = potionRestoreAmount(item, "hp");
  const mp = potionRestoreAmount(item, "mp");
  if (hp > 0) restores.push(`${hp} HP`);
  if (mp > 0) restores.push(`${mp} MP`);
  if (!restores.length) return `<p>No restore effect</p>`;
  const mode = potionRestoreMode(item) === "instant" ? "instantly" : "over time";
  return `<span>Restores ${G.escapeHtml(mode)}: ${G.escapeHtml(restores.join(" and "))}</span>`;
}

function itemPoisonTooltipHtml(item) {
  const kind = poisonItemKind(item);
  if (kind === "green") return `<span>Used by Poisoning: damage over time.</span>`;
  return `<span>Used by Poisoning: weakens monster defences.</span>`;
}

function itemAmuletTooltipHtml() {
  return `<span>Used by Taoist spells such as Soul Fire Ball.</span>`;
}

function itemRequirementStatus(item, stats = G.characterTotalStats()) {
  const req = item?.requirements;
  if (!req || req.type === "none") return { ok: true, reason: "" };
  if (!G.classRequirementMet(req.classMask)) return { ok: false, reason: "wrong class" };
  const amount = Number(req.amount) || 0;
  const checks = {
    level: { value: state.game.progress.level, label: `level ${amount}` },
    maxAC: { value: stats.ac[1], label: `AC ${amount}` },
    maxAMC: { value: stats.amc[1], label: `AMC ${amount}` },
    maxDC: { value: stats.dc[1], label: `DC ${amount}` },
    maxMC: { value: stats.mc[1], label: `MC ${amount}` },
    maxSC: { value: stats.sc[1], label: `SC ${amount}` },
    maxLevel: { value: state.game.progress.level, label: `max level ${amount}`, max: true },
    minAC: { value: stats.ac[0], label: `AC ${amount}` },
    minAMC: { value: stats.amc[0], label: `AMC ${amount}` },
    minDC: { value: stats.dc[0], label: `DC ${amount}` },
    minMC: { value: stats.mc[0], label: `MC ${amount}` },
    minSC: { value: stats.sc[0], label: `SC ${amount}` },
  };
  const check = checks[req.type];
  if (!check) return { ok: true, reason: "" };
  const ok = check.max ? check.value <= amount : check.value >= amount;
  return { ok, reason: ok ? "" : `requires ${check.label}` };
}

function itemRequirementLabel(req) {
  if (!req || req.type === "none") return "";
  const amount = Number(req.amount) || 0;
  const labels = {
    level: `Level ${amount}`,
    maxAC: `Max AC ${amount}`,
    maxAMC: `Max AMC ${amount}`,
    maxDC: `Max DC ${amount}`,
    maxMC: `Max MC ${amount}`,
    maxSC: `Max SC ${amount}`,
    maxLevel: `Level at most ${amount}`,
    minAC: `Min AC ${amount}`,
    minAMC: `Min AMC ${amount}`,
    minDC: `Min DC ${amount}`,
    minMC: `Min MC ${amount}`,
    minSC: `Min SC ${amount}`,
  };
  return labels[req.type] ?? "";
}

function markGroupDungeonWaveUiDirty() {
  gamePanelSignature = "";
}

function invalidateGroupDungeonWaveUi() {
  markGroupDungeonWaveUiDirty();
  G.renderGamePanel();
}

function onGroupDungeonWaveCleared(now = performance.now()) {
  const waves = G.groupDungeonWaveState();
  if (!waves) return;
  const zone = G.groupDungeonWaveZone?.() ?? G.activeZone();
  const wavesPerFloor = groupDungeonWavesPerFloor(zone);
  G.pushBattleLog(`Wave ${waves.waveNumber} cleared.`);

  if (waves.waveNumber >= wavesPerFloor && !waves.endless) {
    G.continueGroupDungeonEndlessWaves(now);
    return;
  }

  waves.waveNumber += 1;
  G.startGroupDungeonWave(now);
}

function maybeKillGroupDungeonSwarmEnemy(enemy, now) {
  if (!G.groupDungeonSwarmActive() || !enemy?.swarmId || enemy.hp > 0) return;
  const swarmEnemy = G.findGroupDungeonSwarmEnemy(enemy.swarmId);
  if (swarmEnemy && !swarmEnemy.dying) onGroupDungeonSwarmEnemyKilled(swarmEnemy, now);
}

function pruneGroupDungeonSwarmEnemies(now) {
  const swarm = state.battle.swarm;
  if (!swarm) return;
  G.reconcileGroupDungeonSwarmDeaths(now);
  swarm.enemies = swarm.enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    if (!enemy.dying) return false;
    return !enemy.removeAt || now < enemy.removeAt;
  });
}

function onGroupDungeonSwarmEnemyKilled(swarmEnemy, now = performance.now()) {
  if (!swarmEnemy || swarmEnemy.dying) return;
  G.awardGroupDungeonSwarmKill(swarmEnemy, now);
  swarmEnemy.dying = true;
  swarmEnemy.hp = 0;
  G.setSwarmEnemyAction(swarmEnemy, "die", true, now);
  G.playMonsterSfx("death", swarmEnemy);
  G.pushBattleLog(`${swarmEnemy.name} is defeated.`);
  const waves = G.groupDungeonWaveState();
  if (waves) waves.killedThisWave += 1;
  markGroupDungeonWaveUiDirty();
  G.syncGroupDungeonPrimaryEnemy();
}

function partyEntryZone() {
  return PROTOTYPE_ZONES.find((zone) => zone.id === state.bossEntryZoneId) ?? null;
}

function incrementAccountBossKill(zoneId) {
  if (!G.bossRoomDef(zoneId)) return;
  const kills = G.accountBossKills();
  kills[zoneId] = Math.max(0, Math.trunc(Number(kills[zoneId]) || 0)) + 1;
  G.ensureAccountStats();
  state.account.stats.bossKills = kills;
  G.syncAccountBossKillsToCharacters();
}

function incrementBossKill(zoneId, gameState = null) {
  incrementAccountBossKill(zoneId);
  if (gameState) {
    gameState.bossKills = { ...accountBossKills() };
  }
}

function itemSellValue(item, quantity = 1) {
  return Math.max(0, Number(item?.shop?.sell) || 0) * Math.max(1, Number(quantity) || 1);
}

function itemBuyValue(item, quantity = 1) {
  return Math.max(0, Number(item?.shop?.buy) || 0) * Math.max(1, Number(quantity) || 1);
}

function openTownNpc(npcId) {
  const npc = TOWN_NPCS.find((entry) => entry.id === npcId) ?? null;
  state.game.selectedTownNpcId = npc?.id ?? null;
  if (npc?.role === "Teleport") state.teleportBrowseRegionId = null;
  state.activeScene = npc?.role === "Storage" ? "storage" : state.game.selectedTownNpcId ? "townNpc" : null;
  if (npc?.role === "Storage") state.openScenes.inventory = true;
  if (state.game.selectedTownNpcId) G.playSfx("ui.npc", { volume: 0.46, throttleMs: 120 });
  sceneSignature = "";
  gamePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.render();
}

function positionItemTooltip(event) {
  const margin = 14;
  const width = els.itemTooltip.offsetWidth || 230;
  const height = els.itemTooltip.offsetHeight || 160;
  let x = event.clientX + margin;
  let y = event.clientY + margin;
  if (x + width > window.innerWidth - margin) x = event.clientX - width - margin;
  if (y + height > window.innerHeight - margin) y = window.innerHeight - height - margin;
  els.itemTooltip.style.left = `${Math.max(margin, x)}px`;
  els.itemTooltip.style.top = `${Math.max(margin, y)}px`;
}

function layoutBossPartyMembers(members, frontX, controlledClassId = state.activeCharacterId) {
  for (const member of members) {
    G.bossPartyInitMemberVisuals(member);
    member.targetWorldX = null;
    member.meleeAdvanceFromX = null;
    member.meleeAdvanceStartedAt = null;
    if (!member.alive || member.hp <= 0) continue;
    member.worldX = G.bossPartyMemberLineWorldX(frontX, member.classId);
  }

  const controlled = members.find((member) => member.classId === controlledClassId) ?? members[0];
  if (controlled) state.battle.playerX = controlled.worldX;
}

function positionBossPartyMembers(members, controlledClassId = state.activeCharacterId) {
  const frontX = state.battle.playerX + BOSS_PARTY_FRONT_OFFSET;
  layoutBossPartyMembers(members, frontX, controlledClassId);
}

function positionBossPartyMembersForFixedSpawn(members, spawnX, controlledClassId = state.activeCharacterId) {
  layoutBossPartyMembers(members, Math.round(spawnX - BOSS_PARTY_ENEMY_MELEE_GAP), controlledClassId);
}

function placeTaoistCombatPet(pet) {
  if (!pet) return pet;
  const isShinsu = pet.spellId === "SummonShinsu";
  if (G.enemyUsesFixedArenaSpawn()) {
    if (isShinsu && G.bossPartyOnField()) {
      pet.worldX = G.bossPartyShinsuPetWorldX();
    } else {
      pet.worldX = G.fixedArenaPetWorldX();
      const shift = G.shiftFixedArenaPartyForPet(pet.worldX);
      if (shift > 0) {
        G.pushBattleLog(G.bossPartyOnField()
          ? "The party steps back to make room for the pet."
          : "You step back to make room for the pet.");
      }
    }
  } else if (G.bossPartyOnField()) {
    pet.worldX = G.bossPartyPetWorldXFor(pet);
  } else {
    pet.worldX = G.taoistPetSummonWorldX();
  }
  return pet;
}

async function preloadBossPartyVisualAtlases(members) {
  await Promise.all(members.map((member) => preloadBossPartyMemberVisualAtlases(member)));
  G.render();
}

async function preloadBossPartyMemberVisualAtlases(member) {
  member.visualIndexes = G.bossPartyMemberVisualIndexes(member);
  member.visualAtlases = member.visualAtlases ?? {};
  await Promise.all(G.layerNames().map(async (layer) => {
    const index = member.visualIndexes[layer];
    if (index == null || index === "") {
      member.visualAtlases[layer] = null;
      return;
    }
    const key = `${state.spriteSet}:${layer}:${index}`;
    if (!bossPartyVisualAtlasCache.has(key)) {
      bossPartyVisualAtlasCache.set(key, loadAtlas(state.spriteSet, layer, index).catch(() => null));
    }
    const atlas = await bossPartyVisualAtlasCache.get(key);
    member.visualAtlases[layer] = atlas;
    if (atlas) await loadCachedImage(sheetUrl(state.spriteSet, layer, index)).catch(() => null);
  }));
}

function loadBossPartyMemberMagicIntoState(member) {
  if (!member?.magic) return;
  state.magic = G.cloneMagicState(member.magic);
  G.removeRetiredTestingDefaultMagic(member.classId, state.magic);
  normalizeAutoCastSpellsForClass(member.classId);
}

function partyBossEffects() {
  if (!state.battle.bossParty) return [];
  if (!Array.isArray(state.battle.bossParty.effects)) state.battle.bossParty.effects = [];
  return state.battle.bossParty.effects;
}

function partyBossImpacts() {
  if (!state.battle.bossParty) return [];
  if (!Array.isArray(state.battle.bossParty.impacts)) state.battle.bossParty.impacts = [];
  return state.battle.bossParty.impacts;
}

function partyBossHealFx() {
  if (!state.battle.bossParty) return [];
  if (!Array.isArray(state.battle.bossParty.healFx)) state.battle.bossParty.healFx = [];
  return state.battle.bossParty.healFx;
}

function partyPetCanTank() {
  const pet = state.battle.bossParty?.pet;
  return Boolean(pet?.active) && (pet.hp ?? 0) > 0 && pet.spellId !== "SummonShinsu";
}

function isEvilCentipedeEnemy(enemy = state.battle.enemy) {
  return enemy?.attackMode === "evilCentipede" || enemy?.crystalName === "EvilCentipede";
}

function isEvilSnakeEnemy(enemy = state.battle.enemy) {
  return enemy?.id === EVIL_SNAKE_ENEMY_ID || enemy?.crystalName === "EvilSnake";
}

function isZumaTaurusEnemy(enemy = state.battle.enemy) {
  return enemy?.id === ZUMA_TAURUS_ENEMY_ID || enemy?.crystalName === "ZumaTaurus";
}

function isBoneLordEnemy(enemy = state.battle.enemy) {
  return enemy?.attackMode === "boneLord" || enemy?.id === BONE_LORD_ENEMY_ID || enemy?.crystalName === "BoneLord";
}

function isPrajnaGuardEnemy(enemy = state.battle.enemy) {
  return enemy?.attackMode === "prajnaGuard"
    || PRAJNA_GUARD_ENEMY_IDS.has(enemy?.id)
    || enemy?.crystalName === "RightGuard"
    || enemy?.crystalName === "LeftGuard";
}

function isMinotaurKingEnemy(enemy = state.battle.enemy) {
  return enemy?.attackMode === "minotaurKing"
    || enemy?.id === MINOTAUR_KING_ENEMY_ID
    || enemy?.crystalName === "MinotaurKing";
}

function minotaurKingSplashRadiusPx(enemy = state.battle.enemy) {
  const tiles = Math.max(1, Math.trunc(Number(enemy?.aoeSplashTiles) || 3));
  return tiles * LANE_TILE_PX;
}

function minotaurKingAoeInterval(enemy = state.battle.enemy) {
  return Math.max(1, Math.trunc(Number(enemy?.aoeSplashEvery) || MINOTAUR_KING_AOE_EVERY_N_ATTACKS));
}

function minotaurKingAttackCount(enemy = state.battle.enemy) {
  return Math.max(0, Math.trunc(Number(enemy?.minotaurKingAttackCount) || 0));
}

function minotaurKingAoeChance(enemy = state.battle.enemy) {
  const chance = Number(enemy?.aoeSplashChance);
  return Number.isFinite(chance) ? Math.max(0, Math.min(1, chance)) : 0;
}

function minotaurKingAttackIsAoe(count, enemy = state.battle.enemy) {
  if (count > 0 && count % minotaurKingAoeInterval(enemy) === 0) return true;
  const chance = minotaurKingAoeChance(enemy);
  return chance > 0 && Math.random() < chance;
}

function minotaurKingStrikeUsesAoe(strike = state.battle.pendingEnemyStrike) {
  return Boolean(strike?.aoe);
}

function minotaurKingSplashTargets(primaryTarget, enemy = state.battle.enemy) {
  if (!primaryTarget) return [];
  const party = state.battle.bossParty;
  if (!party) return [primaryTarget];
  const radiusPx = minotaurKingSplashRadiusPx(enemy);
  const primaryX = Number(primaryTarget.worldX) || 0;
  const targets = [primaryTarget];
  const consider = (entity) => {
    if (!entity || entity === primaryTarget || (entity.hp ?? 0) <= 0) return;
    if (Math.abs((Number(entity.worldX) || 0) - primaryX) > radiusPx) return;
    targets.push(entity);
  };
  consider(party.pet);
  for (const member of party.members ?? []) {
    if (member.alive && member.hp > 0) consider(member);
  }
  return targets;
}

function isRedThunderZumaEnemy(enemy = state.battle.enemy) {
  return enemy?.id === RED_THUNDER_ZUMA_ENEMY_ID
    || enemy?.id === (G.INCARNATED_RTZ_ENEMY_ID ?? 318)
    || enemy?.crystalName === "RedThunderZuma";
}

function isIncarnatedRedThunderZumaEnemy(enemy) {
  if (!enemy) return false;
  const id = Math.trunc(Number(enemy?.id ?? enemy?.templateId) || 0);
  return id === (G.INCARNATED_RTZ_ENEMY_ID ?? 318);
}

function isWarriorChargeSkill(skill) {
  return WARRIOR_CHARGE_SKILL_IDS.has(skill?.id);
}

function maybeNotifyMagicShieldStruck(memberClassId, now = performance.now()) {
  if (!G.magicShieldFxActive(memberClassId, now)) return;
  let entry = (state.battle.attachedSpellFx ?? []).find(
    (candidate) => candidate.spellId === "MagicShield" && (candidate.memberClassId ?? null) === memberClassId,
  );
  if (!entry) {
    const buffs = pruneStatBuffs(G.entityStatBuffList(G.magicShieldFxEntity(memberClassId)), now);
    const shield = buffs.find((buff) => buff.kind === "magicShield");
    if (!shield) return;
    G.startMagicShieldLoopFx({ expiresAt: shield.expiresAt, memberClassId, now });
    entry = (state.battle.attachedSpellFx ?? []).find(
      (candidate) => candidate.spellId === "MagicShield" && (candidate.memberClassId ?? null) === memberClassId,
    );
  }
  if (entry) entry.struckAt = now;
}

function notifyWizardMagicShieldStruckOnHit(target, now = performance.now()) {
  const memberClassId = G.magicShieldStruckMemberClassId(target);
  if (memberClassId !== undefined) maybeNotifyMagicShieldStruck(memberClassId, now);
}

function isHalfMoonAttackSkill(skill) {
  return skill?.id === "HalfMoon";
}

function isThrustingAttackWindow() {
  const distance = G.enemyDistance();
  return distance > LANE.warriorRange && distance <= THRUSTING_RANGE;
}

function poisonCandidateForEnemy(enemy, now = performance.now()) {
  const green = poisonInventoryEntries("green")[0] ?? null;
  const yellow = poisonInventoryEntries("yellow")[0] ?? null;
  if (green && poisonNeedsApply(enemy, "green", now)) return green;
  if (yellow && poisonNeedsApply(enemy, "yellow", now)) return yellow;
  return null;
}

function poisonNeedsApply(enemy, kind, now) {
  const active = G.enemyPoison(enemy, kind);
  if (!active) return true;
  const ticksRemaining = Math.max(0, Math.trunc(Number(active.ticksRemaining) || 0));
  const tickMs = Math.max(1, Math.trunc(Number(active.tickMs) || CRYSTAL_POISON_TICK_MS));
  const nextTickAt = Number(active.nextTickAt) || now;
  return ticksRemaining <= 2 || nextTickAt + (ticksRemaining - 1) * tickMs - now <= tickMs * 2;
}

function levelPassiveWeaponMagic(now) {
  if (state.battle.combatClass === "Warrior") {
    const fencing = learnedMagic("Fencing");
    const spell = warriorSpellById("Fencing");
    if (fencing && spell) levelWarriorMagic(spell, fencing, now);
    return;
  }

  if (state.battle.combatClass === "Taoist") {
    const spiritSword = learnedMagic("SpiritSword");
    const spell = taoistSpellById("SpiritSword");
    if (spiritSword && spell) G.levelMagicSkill(spell, spiritSword, now);
  }
}

function levelWarriorMagic(spell, learned, now = performance.now()) {
  return G.levelMagicSkill(spell, learned, now);
}

function needsTaoistDefenceBuff(spellId, now = performance.now(), options = {}) {
  return needsDefenceBuff(spellId, now, options);
}

function needsDefenceBuff(spellId, now = performance.now(), options = {}) {
  const kind = G.defenceBuffKind(spellId);
  if (!kind) return false;
  if (spellId === "MagicShield") {
    const playerBuffs = options.playerBuffs ?? state.battle.statBuffs;
    return !G.hasActiveDefenceBuffOnList(playerBuffs, kind, now);
  }
  return G.taoistPartyDefenceBuffTargets(now).some(
    (entry) => entry.entity
      && entry.entity.hp > 0
      && !G.hasActiveDefenceBuffOnList(G.entityStatBuffList(entry.entity), kind, now),
  );
}

function pushDefenceBuff(buffList, spell, bonus, expiresAt, learned = null) {
  const kind = G.defenceBuffKind(spell.id);
  const list = Array.isArray(buffList) ? buffList.filter((buff) => buff.kind !== kind) : [];
  if (spell.id === "MagicShield") {
    list.push({
      kind,
      label: spell.label,
      stat: "damageReduction",
      minBonus: 0,
      maxBonus: 0,
      reductionPercent: G.rollMagicShieldReductionPercent(learned),
      expiresAt,
    });
    return list;
  }
  const stat = G.defenceBuffStat(spell.id);
  list.push({
    kind,
    label: spell.label,
    stat,
    minBonus: 0,
    maxBonus: bonus,
    expiresAt,
  });
  return list;
}

function needsUltimateEnhancerTarget(entity, now = performance.now()) {
  return Boolean(entity) && (entity.hp ?? 0) > 0 && !G.hasUltimateEnhancerBuff(entity, now);
}

function pushUltimateEnhancerBuff(buffList, spell, stat, bonus, expiresAt) {
  const list = Array.isArray(buffList) ? buffList.filter((buff) => buff.kind !== ULTIMATE_ENHANCER_BUFF_KIND) : [];
  list.push({
    kind: ULTIMATE_ENHANCER_BUFF_KIND,
    label: spell.label,
    stat,
    minBonus: 0,
    maxBonus: bonus,
    expiresAt,
  });
  return list;
}

function maybeCastTaoistUltimateEnhancer(now) {
  const battle = state.battle;
  if (battle.combatClass !== "Taoist" || battle.phase !== "engaged") return false;
  if (G.queuedCombatSpell("Taoist")) return false;
  const castBundle = G.usableTaoistUltimateEnhancer(now);
  return Boolean(castBundle && G.castTaoistUltimateEnhancer(castBundle, now));
}

function maybeCastWizardDefenceBuff(now) {
  const battle = state.battle;
  if (battle.combatClass !== "Wizard" || battle.phase !== "engaged") return false;
  if (G.queuedCombatSpell("Wizard")?.spell.id === "MagicShield") return false;
  const castBundle = G.usableWizardDefenceBuff(now);
  return Boolean(castBundle && G.castWizardDefenceBuff(castBundle, now));
}

function maybeCastTaoistDefenceBuffs(now) {
  const battle = state.battle;
  if (battle.combatClass !== "Taoist" || battle.phase !== "engaged") return false;
  if (G.queuedCombatSpell("Taoist")) return false;
  for (const spellId of ["SoulShield", "BlessedArmour"]) {
    const castBundle = G.usableTaoistDefenceBuff(spellId, now);
    if (castBundle && G.castTaoistDefenceBuff(castBundle, now)) return true;
  }
  return false;
}

function maybeCastTaoistSummonPet(now) {
  const battle = state.battle;
  if (battle.combatClass !== "Taoist" || battle.phase !== "engaged") return false;
  if (G.queuedCombatSpell("Taoist")) return false;
  for (const spellId of ["SummonSkeleton", "SummonShinsu"]) {
    const summon = G.usableTaoistSummonSpell(spellId, now);
    if (summon && G.castTaoistSummonPet(summon, now)) return true;
  }
  return false;
}

function maybeCastTaoistSummonSkeleton(now) {
  return maybeCastTaoistSummonPet(now);
}

function markTaoistPetDead(now = performance.now(), options = {}) {
  const pet = state.battle.taoPet;
  if (!pet || pet.dead) return;
  pet.active = false;
  pet.dead = true;
  pet.hp = 0;
  pet.healAmount = 0;
  pet.healTickAt = 0;
  pet.action = "die";
  pet.frame = 0;
  pet.oneShot = true;
  pet.lastTick = now;
  state.battle.taoPetDiedThisFight = true;
  state.battle.nextPlayerAttackAt = 0;
  state.battle.nextEnemyAttackAt = 0;
  if (options.sound !== false) G.playTaoPetSfx("death", { volume: 0.46, throttleMs: 120 });
  if (options.log !== false) G.pushBattleLog(options.message ?? `${pet.name} falls.`);
  battlePanelSignature = "";
  combatSkillBarSignature = "";
}

function maybeCastTaoistSoulFireBall(now) {
  const battle = state.battle;
  if (battle.combatClass !== "Taoist" || battle.phase !== "engaged") return false;
  if (battle.pendingImpact?.spellId === "SoulFireBall") return false;
  if (G.activeTaoistSpellVisualBlocksSecondary(now)) return false;
  const soulFireBall = G.usableTaoistSoulFireBall(now);
  if (!soulFireBall) return false;
  if (battle.activeTaoSpellStartedAt === now && battle.activeTaoSpell !== "SoulFireBall") return false;
  return G.castTaoistSoulFireBall(soulFireBall, now, { secondary: true });
}

function mapLightningSettings(zone = G.activeZone()) {
  if (!zone?.mapLightning) return null;
  const min = Math.max(0, Math.trunc(Number(zone.mapLightningDamageMin ?? zone.mapLightningDamage) || 50));
  const max = Math.max(min, Math.trunc(Number(zone.mapLightningDamageMax ?? zone.mapLightningDamage) || 150));
  return { min, max };
}

function mapLightningActive() {
  const settings = mapLightningSettings();
  if (!settings) return false;
  const battle = state.battle;
  if (!battle.running || battle.bossParty?.finished) return false;
  if (battle.bossParty?.active) {
    return !G.bossPartyAllMembersDead() && (battle.enemy?.hp ?? 0) > 0;
  }
  if (battle.phase !== "engaged" || (battle.player?.hp ?? 0) <= 0) return false;
  return Boolean(battle.enemy && battle.enemy.hp > 0);
}

function initMapLightningSchedule(now = performance.now()) {
  if (!mapLightningSettings()) {
    state.battle.mapLightningEffects = [];
    state.battle.nextMapLightningAt = 0;
    return;
  }
  state.battle.mapLightningEffects = [];
  state.battle.nextMapLightningAt = now + G.randomMapLightningIntervalMs();
}

function mapLightningTargetWorldX(target) {
  const worldX = Number(target?.worldX);
  if (Number.isFinite(worldX)) return worldX;
  if (target?.solo) return Number(state.battle.playerX) || 0;
  return Number(state.battle.playerX) || 0;
}

function mapLightningTargets() {
  const party = state.battle.bossParty;
  if (party?.active) {
    return (party.members ?? []).filter((member) => member.alive && member.hp > 0);
  }
  if ((state.battle.player?.hp ?? 0) > 0) {
    return [{ solo: true, classId: state.battle.combatClass, name: state.battle.combatClass, worldX: state.battle.playerX }];
  }
  return [];
}

function pickMapLightningWorldX(anchorWorldX) {
  const anchor = Math.round(Number(anchorWorldX) || 0);
  const spreadPx = MAP_LIGHTNING_SPREAD_TILES * LANE_TILE_PX;
  if (Math.random() < 0.25) return anchor;
  return Math.round(anchor - spreadPx + Math.random() * spreadPx * 2);
}

function mapLightningStrikeTargets(effect) {
  const party = state.battle.bossParty;
  if (party?.active && effect.targetClassId) {
    const member = party.members.find((member) => member.classId === effect.targetClassId && member.alive && member.hp > 0);
    return member ? [member] : [];
  }
  if (effect.solo && (state.battle.player?.hp ?? 0) > 0) {
    return [{
      solo: true,
      classId: state.battle.combatClass,
      name: state.battle.combatClass,
      worldX: state.battle.playerX,
    }];
  }
  return mapLightningTargets();
}

function mapLightningStrikeHitsTarget(effect, target) {
  if (effect.targetClassId || effect.solo) return true;
  return Math.abs(mapLightningTargetWorldX(target) - effect.worldX) <= MAP_LIGHTNING_HIT_RADIUS_PX;
}

function mapLightningFrameIndex(effect, layer, now) {
  const variantFrames = Math.max(1, Math.trunc(Number(state.mapLightningAtlas?.variantFrameCount) || 5));
  const variantIndex = Math.max(0, Math.min(2, Math.trunc(Number(effect.variantIndex) || 0)));
  const age = Math.max(0, now - effect.createdAt);
  const localFrame = Math.min(variantFrames - 1, Math.floor(age / Math.max(1, layer.interval || 120)));
  return variantIndex * variantFrames + localFrame;
}

function incomingAttackDefenceStat(target, defenceType) {
  if (defenceType === "MACAgility" || defenceType === "MAC") return target.amc ?? target.ac;
  return target.ac;
}

function incomingDamageReductionPercent(target, now = performance.now()) {
  const buffEntity = target?.__buffEntity ?? target;
  const classId = buffEntity?.classId
    ?? (buffEntity === state.battle.player ? state.battle.combatClass : null);
  if (classId && classId !== "Wizard") return 0;
  const buffs = pruneStatBuffs(G.entityStatBuffList(buffEntity), now);
  const shield = buffs.find((buff) => buff.kind === "magicShield");
  return Math.max(0, Math.min(100, Math.trunc(Number(shield?.reductionPercent) || 0)));
}

function learnedActiveWarriorSkills() {
  return WARRIOR_COMBAT_SKILLS.filter((skill) => skill.id !== BASIC_ATTACK_SKILL.id && !skill.passive && learnedMagic(skill.id));
}

function learnedActiveWizardSkills() {
  return WIZARD_COMBAT_SPELLS.filter((spell) => learnedMagic(spell.id));
}

function learnedActiveTaoistSkills() {
  return TAOIST_COMBAT_SPELLS.filter((spell) => learnedMagic(spell.id));
}

function normalizeHotbarSlots() {
  for (let slot = 0; slot < HOTBAR_SLOT_COUNT; slot++) {
    const entryId = state.hotbar.slots[slot];
    if (!entryId) continue;
    const entry = G.inventoryEntryById(entryId);
    if (!entry || isEquippedEntry(entry.id)) state.hotbar.slots[slot] = null;
  }
}

function movementSurfaceSfxKey() {
  return G.currentBackdropKind() === "cave" ? "cave" : "field";
}

function maybePlayPlayerFootstep(previousFrame, nextFrame, action = state.action) {
  if (previousFrame === nextFrame || !["walking", "running"].includes(action)) return;
  if (G.bossPartyActiveFight()) return;
  const side = G.footstepSideForFrame(nextFrame);
  if (!side) return;
  const moveType = action === "running" ? "run" : "walk";
  const surface = movementSurfaceSfxKey();
  const played = G.playSfx(`footstep.${surface}.${moveType}.${side}`, {
    volume: action === "running" ? 0.36 : 0.28,
    throttleMs: action === "running" ? 110 : 160,
  });
  if (!played && surface === "cave" && moveType === "walk") {
    G.playSfx("footstep.cave.walk.left", { volume: 0.24, throttleMs: 160 });
  }
}

function maybePlayEnemyFootstep(previousFrame, nextFrame, action = state.enemy.action) {
  if (previousFrame === nextFrame || action !== "walking") return;
  if (G.bossPartyActiveFight()) {
    const desired = G.bossPartyDesiredEnemyX();
    const current = Number(state.battle.enemyX);
    if (desired != null && Number.isFinite(current) && Math.abs(desired - current) <= BOSS_PARTY_ENEMY_MELEE_GAP + 6) return;
  }
  const side = G.footstepSideForFrame(nextFrame);
  if (!side) return;
  const surface = movementSurfaceSfxKey();
  const played = G.playSfx(`footstep.${surface}.walk.${side}`, { volume: 0.16, throttleMs: 180 });
  if (!played && surface === "cave") G.playSfx("footstep.cave.walk.left", { volume: 0.14, throttleMs: 180 });
}

function maybePlayMiningSwingSfx(previousFrame, nextFrame) {
  if (state.game.mode !== "mining" || state.action !== "mine") return;
  if (previousFrame === nextFrame || previousFrame >= 1 || nextFrame < 1) return;
  G.playMiningSwingSfx();
}

function itemEquipSfxKey(item) {
  if (!item) return "item.move";
  if (item.type === "weapon") return "item.equip.weapon";
  if (item.type === "armour") return "item.equip.armour";
  if (item.type === "helmet") return "item.equip.helmet";
  if (item.type === "ring") return "item.equip.ring";
  if (item.type === "bracelet") return "item.equip.bracelet";
  if (item.type === "necklace") return "item.equip.necklace";
  if (item.type === "boots") return "item.equip.boots";
  return "item.move";
}

function isEnemyOneShotAction() {
  return state.enemy.oneShot || state.enemy.action === "struck" || state.enemy.action === "die" || state.enemy.action === "show";
}

function isPlayerOneShotAction() {
  return state.playerOneShot
    || state.action === "struck"
    || state.action === "die"
    || (state.game.mode === "mining" && state.action === "mine");
}

function nextPlayerActionAfterOneShot() {
  if (state.game.mode === "mining") return "stance";
  if (state.battle.returnToStandAt && (state.battle.player?.hp ?? 0) > 0) return "stance";
  if (G.bossPartyActiveFight()) return "stance";
  if (isBattleEngaged()) {
    if (G.wizardHoldsCombatPosition()) return "stance";
    return G.canPlayerAttack() ? "stance" : "walking";
  }
  return state.playerOneShot && isPlayerMeleeAction(state.action) ? "stance" : "standing";
}

function isPlayerMeleeAction(action) {
  return action === "attack1" || action === "attack2" || action === "attack3" || action === "attack4" || action === "mine";
}

function isPlayerSmoothLoopAction() {
  return state.action === "walking" || state.action === "running" || state.action === "mountWalking" || state.action === "mountRunning";
}

function movementDistanceForAction(action, elapsedMs) {
  const spec = PLAYER_ACTIONS[action];
  const cycleMs = spec.count * spec.interval;
  return (Math.max(0, elapsedMs) / cycleMs) * movementCycleDistance(action);
}

function movementCycleDistance(action) {
  return action === "running" || action === "mountRunning" ? LANE_TILE_PX * 2 : LANE_TILE_PX;
}

function isBattleEngaged() {
  return state.battle.running && state.battle.phase === "engaged" && (state.battle.player?.hp ?? 0) > 0 && (state.battle.enemy?.hp ?? 0) > 0;
}

function potionQuickButtonHtml(kind, label, count) {
  return `<button type="button" class="player-potion-button ${kind}" data-use-potion-kind="${kind}" ${count > 0 ? "" : "disabled"}>${label} x${count}</button>`;
}

function perfReadout() {
  return `FPS ${state.perf.fps || "--"} | draw ${state.perf.drawMs.toFixed(1)}ms | canvas nodes 1`;
}

function invalidateStampBackgroundCache() {
  stampBackgroundCache.key = "";
}

function mapTilePosition(set, row, col, scroll, baseY) {
  return {
    x: col * set.slotWidth - scroll + (row % 2 ? Math.floor(set.slotWidth / 2) : 0) - 24,
    y: baseY + row * MAP_LANE_ROW_STEP - 58,
  };
}

function mapTilePositionAnchor2x2(set, anchorRow, col, scroll, baseY) {
  return {
    x: col * set.slotWidth - scroll - 24,
    y: baseY + anchorRow * MAP_TILE_ANCHOR_ROW_STEP - 58,
  };
}

function mapLaneTileSlot(set, row, worldColumn) {
  const pattern = G.currentZonePattern();
  const rowPattern = pattern[positiveModulo(row, pattern.length)];
  return positiveModulo(rowPattern[positiveModulo(worldColumn, rowPattern.length)], set.tiles.length);
}

function mapAnchor2x2TileSlot(set, anchorMapRow, worldColumn) {
  const pattern = G.currentZonePattern();
  const patternRow = positiveModulo(Math.trunc(anchorMapRow / 2), pattern.length);
  const rowPattern = pattern[patternRow];
  return positiveModulo(rowPattern[positiveModulo(worldColumn, rowPattern.length)], set.tiles.length);
}

function lootNoticeColor(kind) {
  if (kind === "level") return "#e6f0ff";
  if (kind === "gold") return "#e2ba54";
  if (kind === "full") return "#d98572";
  return "#d8d0bf";
}

function lootNoticeBorder(kind) {
  if (kind === "level") return "rgba(158, 205, 255, 0.82)";
  if (kind === "gold") return "rgba(226, 186, 84, 0.72)";
  if (kind === "full") return "rgba(217, 133, 114, 0.72)";
  return "rgba(216, 208, 191, 0.54)";
}

function loadCachedImage(src) {
  let existing = imageCache.get(src);
  if (existing?.complete && existing.naturalWidth > 0) return Promise.resolve(existing);
  if (existing?.complete) {
    imageCache.delete(src);
    existing = null;
  }
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(existing), { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      G.render();
      resolve(image);
    };
    image.onerror = (event) => {
      imageCache.delete(src);
      reject(event);
    };
    image.src = src;
    imageCache.set(src, image);
  });
}

function movementTestScrollCameraX(tileCameraX) {
  if (state.continuousWalk) {
    return state.continuousWalkStartScrollX + (tileCameraX - state.continuousWalkStartCameraX * LANE.tileScrollRatio);
  }
  if (!state.stepTest.active && !state.stepTest.complete) return tileCameraX * state.groundSpeedRatio;
  return state.stepTest.startScrollX + (tileCameraX - state.stepTest.startCameraX * LANE.tileScrollRatio);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function mapSetById(mapSetId) {
  return state.mapTileIndex.sets.find((set) => set.id === mapSetId) ?? null;
}


G.nextFreeSlotInInventoryState = nextFreeSlotInInventoryState;
G.magicStateForPersistence = magicStateForPersistence;
G.isGroupContentZone = isGroupContentZone;
G.presentOfflineMiningReport = presentOfflineMiningReport;
G.maxStatBuffRemainingMs = maxStatBuffRemainingMs;
G.presentOfflineReport = presentOfflineReport;
G.loadPrototypeStatsPlayerId = loadPrototypeStatsPlayerId;
G.loadPrototypeStatsConfig = loadPrototypeStatsConfig;
G.maybeSubmitPrototypeStats = maybeSubmitPrototypeStats;
G.incrementReportCount = incrementReportCount;
G.invalidateUi = invalidateUi;
G.objectFrameList = objectFrameList;
G.missingAccountUpgradeItemLabel = missingAccountUpgradeItemLabel;
G.missingAccountUpgradeCostText = missingAccountUpgradeCostText;
G.payAccountUpgradeCost = payAccountUpgradeCost;
G.normalizeUpgradeCategory = normalizeUpgradeCategory;
G.isWeaponRefineStagedEntry = isWeaponRefineStagedEntry;
G.isRefineJewelleryItem = isRefineJewelleryItem;
G.pickWeaponRefineStatKey = pickWeaponRefineStatKey;
G.openWeaponRefineScene = openWeaponRefineScene;
G.junkOreInventoryEntries = junkOreInventoryEntries;
G.junkOreSellPreview = junkOreSellPreview;
G.isGemUpgradeItem = isGemUpgradeItem;
G.isBookItem = isBookItem;
G.learnedMagic = learnedMagic;
G.magicSpellById = magicSpellById;
G.magicSpellByShape = magicSpellByShape;
G.magicSignature = magicSignature;
G.noteSceneOverlayInteraction = noteSceneOverlayInteraction;
G.isWizardCombatSpellId = isWizardCombatSpellId;
G.isTaoistCombatSpellId = isTaoistCombatSpellId;
G.isWarriorCombatSkillId = isWarriorCombatSkillId;
G.isQueuedCombatSpell = isQueuedCombatSpell;
G.maxAccountUpgradeValue = maxAccountUpgradeValue;
G.maxAutoCastSlotLimit = maxAutoCastSlotLimit;
G.maxAutoPotionSlotLimit = maxAutoPotionSlotLimit;
G.normalizeAutoCastSpellsForClass = normalizeAutoCastSpellsForClass;
G.normalizeWizardAutoSpells = normalizeWizardAutoSpells;
G.learnSpellFromBook = learnSpellFromBook;
G.maybeAutoWarriorCharge = maybeAutoWarriorCharge;
G.nextFreeInventorySlot = nextFreeInventorySlot;
G.itemEntryById = itemEntryById;
G.nextFreeStorageSlot = nextFreeStorageSlot;
G.mergeEntryIntoStack = mergeEntryIntoStack;
G.isHotbarEntry = isHotbarEntry;
G.moveInventoryEntryToSlot = moveInventoryEntryToSlot;
G.moveStorageEntryToStorageSlot = moveStorageEntryToStorageSlot;
G.itemDefinition = itemDefinition;
G.itemEntryStats = itemEntryStats;
G.itemDisplayName = itemDisplayName;
G.itemDefinitionMaxDura = itemDefinitionMaxDura;
G.isOreItem = isOreItem;
G.isPickaxeItem = isPickaxeItem;
G.itemUsesEntryDurability = itemUsesEntryDurability;
G.normalizeInventoryEntryFields = normalizeInventoryEntryFields;
G.isStackableItem = isStackableItem;
G.maxItemStack = maxItemStack;
G.isPotionItem = isPotionItem;
G.isBenedictionOilItem = isBenedictionOilItem;
G.isWoomaTaurusEnemy = isWoomaTaurusEnemy;
G.isIncarnatedWoomaTaurusEnemy = isIncarnatedWoomaTaurusEnemy;
G.isIncarnatedZumaTaurusEnemy = isIncarnatedZumaTaurusEnemy;
G.isOmaKingSpiritEnemy = isOmaKingSpiritEnemy;
G.isKingHogEnemy = isKingHogEnemy;
G.isPoisonItem = isPoisonItem;
G.isTaoistAmuletItem = isTaoistAmuletItem;
G.poisonItemKind = poisonItemKind;
G.potionRestoreAmount = potionRestoreAmount;
G.potionShape = potionShape;
G.potionRestoreMode = potionRestoreMode;
G.potionRestoreParts = potionRestoreParts;
G.potionInventoryCount = potionInventoryCount;
G.poisonInventoryEntries = poisonInventoryEntries;
G.poisonInventoryCount = poisonInventoryCount;
G.isEquipableItem = isEquipableItem;
G.isEquippedEntry = isEquippedEntry;
G.partyAssistPickerHtml = partyAssistPickerHtml;
G.optionsSceneHtml = optionsSceneHtml;
G.itemSpellTooltipHtml = itemSpellTooltipHtml;
G.itemRequirementTooltipHtml = itemRequirementTooltipHtml;
G.itemGemTooltipHtml = itemGemTooltipHtml;
G.itemBenedictionTooltipHtml = itemBenedictionTooltipHtml;
G.itemOreTooltipHtml = itemOreTooltipHtml;
G.itemDurabilityTooltipHtml = itemDurabilityTooltipHtml;
G.itemPotionTooltipHtml = itemPotionTooltipHtml;
G.itemPoisonTooltipHtml = itemPoisonTooltipHtml;
G.itemAmuletTooltipHtml = itemAmuletTooltipHtml;
G.itemRequirementStatus = itemRequirementStatus;
G.itemRequirementLabel = itemRequirementLabel;
G.markGroupDungeonWaveUiDirty = markGroupDungeonWaveUiDirty;
G.invalidateGroupDungeonWaveUi = invalidateGroupDungeonWaveUi;
G.onGroupDungeonWaveCleared = onGroupDungeonWaveCleared;
G.maybeKillGroupDungeonSwarmEnemy = maybeKillGroupDungeonSwarmEnemy;
G.pruneGroupDungeonSwarmEnemies = pruneGroupDungeonSwarmEnemies;
G.onGroupDungeonSwarmEnemyKilled = onGroupDungeonSwarmEnemyKilled;
G.partyEntryZone = partyEntryZone;
G.incrementAccountBossKill = incrementAccountBossKill;
G.incrementBossKill = incrementBossKill;
G.itemSellValue = itemSellValue;
G.itemBuyValue = itemBuyValue;
G.openTownNpc = openTownNpc;
G.positionItemTooltip = positionItemTooltip;
G.layoutBossPartyMembers = layoutBossPartyMembers;
G.positionBossPartyMembers = positionBossPartyMembers;
G.positionBossPartyMembersForFixedSpawn = positionBossPartyMembersForFixedSpawn;
G.placeTaoistCombatPet = placeTaoistCombatPet;
G.preloadBossPartyVisualAtlases = preloadBossPartyVisualAtlases;
G.preloadBossPartyMemberVisualAtlases = preloadBossPartyMemberVisualAtlases;
G.loadBossPartyMemberMagicIntoState = loadBossPartyMemberMagicIntoState;
G.partyBossEffects = partyBossEffects;
G.partyBossImpacts = partyBossImpacts;
G.partyBossHealFx = partyBossHealFx;
G.partyPetCanTank = partyPetCanTank;
G.isEvilCentipedeEnemy = isEvilCentipedeEnemy;
G.isEvilSnakeEnemy = isEvilSnakeEnemy;
G.isZumaTaurusEnemy = isZumaTaurusEnemy;
G.isBoneLordEnemy = isBoneLordEnemy;
G.isPrajnaGuardEnemy = isPrajnaGuardEnemy;
G.isMinotaurKingEnemy = isMinotaurKingEnemy;
G.minotaurKingSplashRadiusPx = minotaurKingSplashRadiusPx;
G.minotaurKingAoeInterval = minotaurKingAoeInterval;
G.minotaurKingAttackCount = minotaurKingAttackCount;
G.minotaurKingAoeChance = minotaurKingAoeChance;
G.minotaurKingAttackIsAoe = minotaurKingAttackIsAoe;
G.minotaurKingStrikeUsesAoe = minotaurKingStrikeUsesAoe;
G.minotaurKingSplashTargets = minotaurKingSplashTargets;
G.isRedThunderZumaEnemy = isRedThunderZumaEnemy;
G.isIncarnatedRedThunderZumaEnemy = isIncarnatedRedThunderZumaEnemy;
G.isWarriorChargeSkill = isWarriorChargeSkill;
G.maybeNotifyMagicShieldStruck = maybeNotifyMagicShieldStruck;
G.notifyWizardMagicShieldStruckOnHit = notifyWizardMagicShieldStruckOnHit;
G.isHalfMoonAttackSkill = isHalfMoonAttackSkill;
G.isThrustingAttackWindow = isThrustingAttackWindow;
G.poisonCandidateForEnemy = poisonCandidateForEnemy;
G.poisonNeedsApply = poisonNeedsApply;
G.levelPassiveWeaponMagic = levelPassiveWeaponMagic;
G.levelWarriorMagic = levelWarriorMagic;
G.needsTaoistDefenceBuff = needsTaoistDefenceBuff;
G.needsDefenceBuff = needsDefenceBuff;
G.pushDefenceBuff = pushDefenceBuff;
G.needsUltimateEnhancerTarget = needsUltimateEnhancerTarget;
G.pushUltimateEnhancerBuff = pushUltimateEnhancerBuff;
G.maybeCastTaoistUltimateEnhancer = maybeCastTaoistUltimateEnhancer;
G.maybeCastWizardDefenceBuff = maybeCastWizardDefenceBuff;
G.maybeCastTaoistDefenceBuffs = maybeCastTaoistDefenceBuffs;
G.maybeCastTaoistSummonPet = maybeCastTaoistSummonPet;
G.maybeCastTaoistSummonSkeleton = maybeCastTaoistSummonSkeleton;
G.markTaoistPetDead = markTaoistPetDead;
G.maybeCastTaoistSoulFireBall = maybeCastTaoistSoulFireBall;
G.mapLightningSettings = mapLightningSettings;
G.mapLightningActive = mapLightningActive;
G.initMapLightningSchedule = initMapLightningSchedule;
G.mapLightningTargetWorldX = mapLightningTargetWorldX;
G.mapLightningTargets = mapLightningTargets;
G.pickMapLightningWorldX = pickMapLightningWorldX;
G.mapLightningStrikeTargets = mapLightningStrikeTargets;
G.mapLightningStrikeHitsTarget = mapLightningStrikeHitsTarget;
G.mapLightningFrameIndex = mapLightningFrameIndex;
G.incomingAttackDefenceStat = incomingAttackDefenceStat;
G.incomingDamageReductionPercent = incomingDamageReductionPercent;
G.learnedActiveWarriorSkills = learnedActiveWarriorSkills;
G.learnedActiveWizardSkills = learnedActiveWizardSkills;
G.learnedActiveTaoistSkills = learnedActiveTaoistSkills;
G.normalizeHotbarSlots = normalizeHotbarSlots;
G.movementSurfaceSfxKey = movementSurfaceSfxKey;
G.maybePlayPlayerFootstep = maybePlayPlayerFootstep;
G.maybePlayEnemyFootstep = maybePlayEnemyFootstep;
G.maybePlayMiningSwingSfx = maybePlayMiningSwingSfx;
G.itemEquipSfxKey = itemEquipSfxKey;
G.isEnemyOneShotAction = isEnemyOneShotAction;
G.isPlayerOneShotAction = isPlayerOneShotAction;
G.nextPlayerActionAfterOneShot = nextPlayerActionAfterOneShot;
G.isPlayerMeleeAction = isPlayerMeleeAction;
G.isPlayerSmoothLoopAction = isPlayerSmoothLoopAction;
G.movementDistanceForAction = movementDistanceForAction;
G.movementCycleDistance = movementCycleDistance;
G.isBattleEngaged = isBattleEngaged;
G.potionQuickButtonHtml = potionQuickButtonHtml;
G.perfReadout = perfReadout;
G.invalidateStampBackgroundCache = invalidateStampBackgroundCache;
G.mapTilePosition = mapTilePosition;
G.mapTilePositionAnchor2x2 = mapTilePositionAnchor2x2;
G.mapLaneTileSlot = mapLaneTileSlot;
G.mapAnchor2x2TileSlot = mapAnchor2x2TileSlot;
G.lootNoticeColor = lootNoticeColor;
G.lootNoticeBorder = lootNoticeBorder;
G.loadCachedImage = loadCachedImage;
G.movementTestScrollCameraX = movementTestScrollCameraX;
G.positiveModulo = positiveModulo;
G.mapSetById = mapSetById;
