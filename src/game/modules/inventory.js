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

import { battlePanelSignature, gamePanelSignature, sceneSignature, combatSkillBarSignature, hotbarSignature, inventoryDragState } from "../sharedState.js";
import { G } from "../gameApi.js";

import { state, els, root } from "../runtime.js";

function seedStarterInventory() {
  if (state.inventory.items.length) return;
  addInventoryItem("wooden-sword");
  addInventoryItem("base-dress");
  addInventoryItem("hp-drug-small", 5);
  addInventoryItem("mp-drug-small", 5);
}

function inventoryPageCount() {
  return Math.max(1, Math.ceil(INVENTORY_MAX_SLOTS / INVENTORY_PAGE_SIZE));
}

function syncInventoryCapacity(inventory = state.inventory) {
  if (!inventory) return;
  inventory.pagesUnlocked = Math.max(1, Math.min(inventoryPageCount(), Math.trunc(Number(inventory.pagesUnlocked) || 1)));
  inventory.maxSlots = Math.min(INVENTORY_MAX_SLOTS, inventory.pagesUnlocked * INVENTORY_PAGE_SIZE);
  if (inventory === state.inventory && state.inventoryPage >= inventoryPageCount()) {
    state.inventoryPage = inventoryPageCount() - 1;
  }
}

function mergeBossPartyMemberSpellCooldowns(member, magicState) {
  if (!member?.magic?.learned || !magicState?.learned) return;
  for (const [spellId, memberLearned] of Object.entries(member.magic.learned)) {
    const liveLearned = magicState.learned[spellId];
    if (!liveLearned) continue;
    const memberReady = Number(memberLearned.castReadyAt) || 0;
    const liveReady = Number(liveLearned.castReadyAt) || 0;
    if (memberReady > liveReady) liveLearned.castReadyAt = memberReady;
  }
}

function inventoryPageUnlocked(page) {
  syncInventoryCapacity();
  return page >= 0 && page < state.inventory.pagesUnlocked;
}

function inventoryPageUnlockCost(page) {
  return page === 1 ? INVENTORY_PAGE_2_UNLOCK_COST : Infinity;
}

function unlockInventoryPage(page) {
  syncInventoryCapacity();
  if (inventoryPageUnlocked(page)) {
    state.inventoryPage = page;
    sceneSignature = "";
    G.renderSceneOverlay();
    return true;
  }
  if (page !== state.inventory.pagesUnlocked || page >= inventoryPageCount()) return false;
  const cost = inventoryPageUnlockCost(page);
  if (state.inventory.gold < cost) {
    G.pushBattleLog(`Need ${cost.toLocaleString()} gold to unlock Items ${page + 1}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  state.inventory.gold -= cost;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.inventory.gold;
  state.inventory.pagesUnlocked = page + 1;
  syncInventoryCapacity();
  G.ensureInventorySlots();
  G.syncBossPartyInventoryCapacityFromState();
  state.inventoryPage = page;
  G.pushBattleLog(`Unlocked Items ${page + 1}.`);
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  return true;
}

function storagePageCount() {
  return Math.max(1, Math.ceil(STORAGE_MAX_SLOTS / STORAGE_PAGE_SIZE));
}

function syncStorageCapacity(storage = state.account.storage) {
  if (!storage) return;
  storage.pagesUnlocked = Math.max(1, Math.min(storagePageCount(), Math.trunc(Number(storage.pagesUnlocked) || 1)));
  storage.maxSlots = Math.min(STORAGE_MAX_SLOTS, storage.pagesUnlocked * STORAGE_PAGE_SIZE);
  if (storage === state.account.storage && state.storagePage >= storagePageCount()) {
    state.storagePage = storagePageCount() - 1;
  }
}

function storagePageUnlocked(page) {
  syncStorageCapacity();
  return page >= 0 && page < state.account.storage.pagesUnlocked;
}

function storagePageUnlockCost(page) {
  return page === 1 ? STORAGE_PAGE_2_UNLOCK_COST : Infinity;
}

function unlockStoragePage(page) {
  syncStorageCapacity();
  if (storagePageUnlocked(page)) {
    state.storagePage = page;
    sceneSignature = "";
    G.renderSceneOverlay();
    return true;
  }
  if (page !== state.account.storage.pagesUnlocked || page >= storagePageCount()) return false;
  const cost = storagePageUnlockCost(page);
  if (state.inventory.gold < cost) {
    G.pushBattleLog(`Need ${cost.toLocaleString()} gold to unlock Storage ${page + 1}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  state.inventory.gold -= cost;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.inventory.gold;
  state.account.storage.pagesUnlocked = page + 1;
  if (page === 1) state.account.storage.page2Purchased = true;
  syncStorageCapacity();
  G.ensureStorageSlots();
  G.syncBossPartyInventoryCapacityFromState();
  state.storagePage = page;
  G.pushBattleLog(`Unlocked Storage ${page + 1}.`);
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  return true;
}

function buyAccountUpgrade(upgradeId) {
  state.account.upgrades = G.sanitizeAccountUpgradeState(state.account.upgrades);
  const upgrade = accountUpgradeById(upgradeId);
  if (!upgrade) return false;
  if (upgrade.planned) {
    G.pushBattleLog(`${upgrade.label} is not available yet.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }
  if (accountUpgradeIsMaxed(upgrade)) {
    G.pushBattleLog(`${upgrade.label} is already maxed.`);
    return false;
  }
  if (!G.canAffordAccountUpgrade(upgrade)) {
    G.pushBattleLog(`Need ${G.missingAccountUpgradeCostText(upgrade)} to unlock ${upgrade.label}.`);
    battlePanelSignature = "";
    G.renderBattlePanel();
    return false;
  }

  const previousTier = accountUpgradeTier(upgrade.id);
  if (!G.payAccountUpgradeCost(upgrade)) return false;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.inventory.gold;
  if (!state.account.upgrades.tiers) state.account.upgrades.tiers = {};
  state.account.upgrades.tiers[upgrade.id] = previousTier + 1;
  G.normalizeAutoCastSpellsForClass(state.battle.combatClass);
  if (upgrade.effect === "baseStatBonus" || upgrade.effect === "baseLuck") {
    G.applyEquippedStatsToBattlePlayer();
    G.restoreBattlePlayerResources();
  }
  G.pushBattleLog(previousTier > 0
    ? `${upgrade.label} upgraded for all characters.`
    : `${upgrade.label} unlocked for all characters.`);
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  combatSkillBarSignature = "";
  hotbarSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  G.renderCombatSkillBar();
  G.renderHotbar();
  G.saveGameState(true);
  return true;
}

function accountUpgradeGoldCost(upgrade) {
  return Math.max(0, Math.trunc(Number(upgrade?.cost) || 0));
}

function accountUpgradeItemCosts(upgrade) {
  return Array.isArray(upgrade?.itemCosts)
    ? upgrade.itemCosts
      .map((cost) => ({
        itemId: String(cost?.itemId ?? ""),
        quantity: Math.max(1, Math.trunc(Number(cost?.quantity) || 1)),
      }))
      .filter((cost) => cost.itemId && G.itemDefinition(cost.itemId))
    : [];
}

function inventoryItemQuantity(itemId) {
  return G.carriedInventoryEntries()
    .filter((entry) => entry.itemId === itemId)
    .reduce((total, entry) => total + Math.max(1, Math.trunc(Number(entry.quantity) || 1)), 0);
}

function accountUpgradeCostText(upgrade) {
  const parts = [];
  const goldCost = accountUpgradeGoldCost(upgrade);
  if (goldCost > 0) parts.push(`${goldCost.toLocaleString()}g`);
  for (const cost of accountUpgradeItemCosts(upgrade)) {
    const item = G.itemDefinition(cost.itemId);
    parts.push(`${cost.quantity}x ${item?.name ?? cost.itemId} (Have ${inventoryItemQuantity(cost.itemId)})`);
  }
  return parts.length ? parts.join(" + ") : "Free";
}

function accountUpgradeEffectLabel(upgrade) {
  if (upgrade?.effectLabel) return upgrade.effectLabel;
  if (upgrade?.effect === "autocastSlots") return "Autocast slots";
  if (upgrade?.effect === "autoPotionSlots") return "Auto potion slots";
  if (upgrade?.effect === "xpBonusPercent") return "XP gained";
  if (upgrade?.effect === "baseStatBonus") return G.rebirthStatUpgradeEffectLabel(upgrade);
  if (upgrade?.effect === "baseLuck") return "Base luck";
  if (upgrade?.effect === "bossEmpowerment") return "Boss empowerment";
  return "Upgrade";
}

function accountUpgradeCurrentValue(upgrade) {
  if (upgrade?.effect === "autocastSlots") return G.autoCastSlotLimit();
  if (upgrade?.effect === "autoPotionSlots") return G.autoPotionSlotLimit();
  return 0;
}

function accountUpgradeMaxValue(upgrade) {
  if (upgrade?.effect === "autocastSlots") return G.maxAutoCastSlotLimit();
  if (upgrade?.effect === "autoPotionSlots") return G.maxAutoPotionSlotLimit();
  return accountUpgradeCurrentValue(upgrade);
}

function accountUpgradeProgressText(upgrade) {
  if (upgrade?.planned && upgrade.progressText) return upgrade.progressText;
  const tier = accountUpgradeTier(upgrade.id);
  const step = Math.max(0, Math.trunc(Number(upgrade?.value) || 0));
  if (upgrade?.effect === "xpBonusPercent") {
    const current = tier * step;
    if (accountUpgradeIsMaxed(upgrade)) return `+${current}%`;
    return `+${current}% -> +${current + step}%`;
  }
  if (upgrade?.effect === "baseStatBonus" || upgrade?.effect === "baseLuck") {
    const current = tier * step;
    if (accountUpgradeIsMaxed(upgrade)) return `+${current}`;
    return `+${current} -> +${current + step}`;
  }
  if (upgrade?.effect === "bossEmpowerment") {
    return tier >= 1 ? "Unlocked" : "Locked -> Unlocked";
  }
  const current = accountUpgradeCurrentValue(upgrade);
  const max = accountUpgradeMaxValue(upgrade);
  if (accountUpgradeIsMaxed(upgrade)) return `${current}/${max}`;
  const next = Math.min(max, current + step);
  return `${current} -> ${next}`;
}

function accountUpgradeRequirementHtml(upgrade) {
  if (upgrade?.planned) {
    return `
      <div class="upgrade-material planned">
        <span class="upgrade-material-icon">?</span>
        <span>${G.escapeHtml(upgrade.requirementText ?? "Future requirement")}</span>
        <strong>Later</strong>
      </div>
    `;
  }
  if (accountUpgradeUsesRebirthPoints(upgrade)) {
    const cost = accountUpgradeRebirthCost(upgrade);
    if (cost == null) {
      return `<div class="upgrade-material met"><span>Maxed</span></div>`;
    }
    const owned = G.accountRebirthPoints();
    return `
      <div class="upgrade-material ${owned >= cost ? "met" : "missing"}">
        <span class="upgrade-material-icon rebirth">P</span>
        <span>Rebirth Points</span>
        <strong>${owned}/${cost}</strong>
      </div>
    `;
  }
  const rows = [];
  const goldCost = accountUpgradeGoldCost(upgrade);
  if (goldCost > 0) {
    const owned = Math.max(0, Number(state.inventory.gold) || 0);
    rows.push(`
      <div class="upgrade-material ${owned >= goldCost ? "met" : "missing"}">
        <span class="upgrade-material-icon gold">G</span>
        <span>Gold</span>
        <strong>${owned.toLocaleString()}/${goldCost.toLocaleString()}</strong>
      </div>
    `);
  }
  for (const cost of accountUpgradeItemCosts(upgrade)) {
    const item = G.itemDefinition(cost.itemId);
    const owned = inventoryItemQuantity(cost.itemId);
    const met = owned >= cost.quantity;
    rows.push(`
      <div class="upgrade-material has-tooltip ${met ? "met" : "missing"}" data-tooltip-item="${G.escapeHtml(cost.itemId)}">
        ${G.itemIconMarkup(item)}
        <span>${G.escapeHtml(item?.name ?? cost.itemId)}</span>
        <strong>${owned}/${cost.quantity}</strong>
      </div>
    `);
  }
  return rows.length ? rows.join("") : `<div class="upgrade-material met"><span>Free</span></div>`;
}

function accountUpgradeSourceText(upgrade) {
  if (upgrade?.planned && upgrade.sourceHint) return upgrade.sourceHint;
  const zones = [
    ...new Set(accountUpgradeItemCosts(upgrade).flatMap((cost) => {
      const item = G.itemDefinition(cost.itemId);
      return Array.isArray(item?.drop?.zones) ? item.drop.zones : [];
    })),
  ];
  const zoneText = zones.length ? zones.map(zoneLabel).join(", ") : "";
  if (upgrade?.sourceHint && zoneText) return `${upgrade.sourceHint} (${zoneText})`;
  if (upgrade?.sourceHint) return upgrade.sourceHint;
  return zoneText ? `Drops in ${zoneText}` : "Source not set";
}

function removeInventoryItemQuantity(itemId, quantity) {
  let remaining = Math.max(1, Math.trunc(Number(quantity) || 1));
  const entryIds = G.carriedInventoryEntries()
    .filter((entry) => entry.itemId === itemId)
    .map((entry) => entry.id);
  for (const entryId of entryIds) {
    const entry = inventoryEntryById(entryId);
    if (!entry) continue;
    const taken = Math.min(remaining, Math.max(1, Math.trunc(Number(entry.quantity) || 1)));
    if (!removeInventoryEntry(entry.id, taken)) return false;
    remaining -= taken;
    if (remaining <= 0) return true;
  }
  return false;
}

function allAccountUpgradeDefs() {
  return [...ACCOUNT_UPGRADE_DEFS, ...ACCOUNT_UPGRADE_PREVIEW_DEFS];
}

function accountUpgradesForCategory(categoryId) {
  return allAccountUpgradeDefs().filter((upgrade) => upgrade.category === categoryId);
}

function addInventoryItem(itemId, quantity = 1) {
  syncInventoryCapacity();
  const item = G.itemDefinition(itemId);
  if (!item) return [];
  const added = [];
  let remaining = Math.max(1, Math.floor(Number(quantity) || 1));
  const maxStack = G.maxItemStack(item);

  while (remaining > 0) {
    if (G.isStackableItem(item)) {
      const existing = G.carriedInventoryEntries().find((entry) => entry.itemId === itemId && entry.quantity < maxStack);
      if (existing) {
        const add = Math.min(remaining, maxStack - existing.quantity);
        existing.quantity += add;
        remaining -= add;
        added.push(existing);
        continue;
      }
      const add = Math.min(remaining, maxStack);
      if (inventoryUsedSlots() >= state.inventory.maxSlots) break;
      const entry = createInventoryEntry(itemId, add);
      state.inventory.items.push(entry);
      added.push(entry);
      remaining -= add;
      continue;
    }

    if (inventoryUsedSlots() >= state.inventory.maxSlots) break;
    const entry = createInventoryEntry(itemId, 1);
    state.inventory.items.push(entry);
    added.push(entry);
    remaining -= 1;
  }

  G.syncBossPartyControlledInventoryFromState();
  gamePanelSignature = "";
  return added;
}

function hasInventorySpaceFor(itemId) {
  syncInventoryCapacity();
  G.ensureInventorySlots();
  const item = G.itemDefinition(itemId);
  if (!item) return false;
  if (G.isStackableItem(item)) {
    const maxStack = G.maxItemStack(item);
    if (G.carriedInventoryEntries().some((entry) => entry.itemId === itemId && entry.quantity < maxStack)) return true;
  }
  return inventoryUsedSlots() < state.inventory.maxSlots;
}

function availableInventoryCapacityForItem(item) {
  syncInventoryCapacity();
  if (!item) return 0;
  const freeSlots = Math.max(0, state.inventory.maxSlots - inventoryUsedSlots());
  if (!G.isStackableItem(item)) return freeSlots;
  const maxStack = G.maxItemStack(item);
  const partialSpace = G.carriedInventoryEntries()
    .filter((entry) => entry.itemId === item.id)
    .reduce((sum, entry) => sum + Math.max(0, maxStack - Math.max(1, Math.trunc(Number(entry.quantity) || 1))), 0);
  return partialSpace + freeSlots * maxStack;
}

function availableHotbarCapacityForPotion(item) {
  if (!G.isPotionItem(item)) return 0;
  const maxStack = G.maxItemStack(item);
  let capacity = 0;
  for (let slot = 0; slot < HOTBAR_SLOT_COUNT; slot++) {
    const entry = hotbarEntryAtSlot(slot);
    if (entry?.itemId === item.id) {
      capacity += Math.max(0, maxStack - Math.max(1, Math.trunc(Number(entry.quantity) || 1)));
    } else if (!state.hotbar.slots[slot]) {
      capacity += G.isStackableItem(item) ? maxStack : 1;
    }
  }
  return capacity;
}

function availablePurchaseCapacityForItem(item) {
  if (!item) return 0;
  if (G.isPotionItem(item)) {
    return availableInventoryCapacityForItem(item) + availableHotbarCapacityForPotion(item);
  }
  return availableInventoryCapacityForItem(item);
}

function addPurchasedPotionsToHotbarFirst(itemId, quantity = 1) {
  const item = G.itemDefinition(itemId);
  const requested = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!item || !G.isPotionItem(item) || requested <= 0) {
    return { added: 0, remaining: requested };
  }

  const maxStack = G.maxItemStack(item);
  let remaining = requested;
  let added = 0;

  for (let slot = 0; slot < HOTBAR_SLOT_COUNT && remaining > 0; slot++) {
    const entry = hotbarEntryAtSlot(slot);
    if (!entry || entry.itemId !== itemId) continue;
    const stack = Math.max(1, Math.trunc(Number(entry.quantity) || 1));
    if (stack >= maxStack) continue;
    const add = Math.min(remaining, maxStack - stack);
    entry.quantity = stack + add;
    remaining -= add;
    added += add;
  }

  for (let slot = 0; slot < HOTBAR_SLOT_COUNT && remaining > 0; slot++) {
    if (state.hotbar.slots[slot]) continue;
    const add = G.isStackableItem(item) ? Math.min(remaining, maxStack) : 1;
    const entry = createInventoryEntry(itemId, add);
    entry.slot = null;
    state.inventory.items.push(entry);
    state.hotbar.slots[slot] = entry.id;
    remaining -= add;
    added += add;
  }

  G.ensureInventorySlots();
  return { added, remaining };
}

function inventoryQuantityForItem(itemId) {
  return state.inventory.items
    .filter((entry) => entry.itemId === itemId && !G.isEquippedEntry(entry.id))
    .reduce((sum, entry) => sum + Math.max(1, Math.trunc(Number(entry.quantity) || 1)), 0);
}

function createInventoryEntry(itemId, quantity = 1, options = {}) {
  const slot = G.nextFreeInventorySlot();
  const item = G.itemDefinition(itemId);
  const entry = {
    id: G.allocateInventoryEntryId(),
    itemId,
    quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
    slot: Number.isInteger(slot) ? slot : null,
    ...normalizeInventoryEntryFields({}, item),
  };
  if (options.refineLevel != null) {
    entry.refineLevel = Math.max(0, Math.trunc(Number(options.refineLevel) || 0));
  }
  if (options.weaponRefineLevel != null) {
    entry.weaponRefineLevel = G.sanitizeWeaponRefineLevel(options.weaponRefineLevel);
  }
  if (options.bonusStats) {
    entry.bonusStats = G.sanitizeItemBonusStats(options.bonusStats);
  }
  const dura = G.sanitizeEntryDurability(options, item);
  if (dura) {
    entry.maxDura = dura.maxDura;
    entry.currentDura = dura.currentDura;
  }
  return entry;
}

function removeInventoryEntry(entryId, quantity = 1) {
  const entry = inventoryEntryById(entryId);
  if (!entry || G.isEquippedEntry(entry.id)) return false;
  entry.quantity -= Math.max(1, Math.floor(Number(quantity) || 1));
  if (entry.quantity <= 0) {
    G.clearHotbarEntry(entry.id);
    state.inventory.items = state.inventory.items.filter((candidate) => candidate.id !== entry.id);
  }
  G.ensureInventorySlots();
  gamePanelSignature = "";
  sceneSignature = "";
  hotbarSignature = "";
  G.syncBossPartyControlledInventoryFromState();
  return true;
}

function consumeOneInventoryUnit(entryId) {
  const entry = inventoryEntryById(entryId);
  if (!entry || G.isEquippedEntry(entry.id)) return false;
  const quantity = Math.max(1, Math.trunc(Number(entry.quantity) || 1));
  if (quantity > 1) {
    entry.quantity = quantity - 1;
    G.ensureInventorySlots();
    gamePanelSignature = "";
    sceneSignature = "";
    hotbarSignature = "";
    G.syncBossPartyControlledInventoryFromState();
    return true;
  }
  return removeInventoryEntry(entry.id, 1);
}

function sellInventoryEntry(entryId) {
  const entry = inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item || G.isEquippedEntry(entry.id) || G.isHotbarEntry(entry.id)) return false;

  const quantity = Math.max(1, Number(entry.quantity) || 1);
  const value = G.itemSellValue(item, quantity);
  if (value <= 0) return false;

  removeInventoryEntry(entry.id, quantity);
  state.inventory.gold += value;
  state.game.progress.gold = state.inventory.gold;
  state.battle.gold = state.game.progress.gold;
  G.playSfx("ui.gold", { volume: 0.55, throttleMs: 80 });
  G.pushBattleLog(`Sold ${quantity > 1 ? `${quantity}x ` : ""}${item.name} for ${value} gold.`);
  G.hideItemTooltip();
  sceneSignature = "";
  gamePanelSignature = "";
  battlePanelSignature = "";
  G.renderSceneOverlay();
  G.renderGamePanel();
  G.renderBattlePanel();
  return true;
}

function isJunkOreItem(item) {
  return Boolean(item) && G.isOreItem(item) && item.id !== REFINER_ORE_ITEM_ID;
}

function weaponRefineStagedRecord(entryId) {
  return state.weaponRefine?.stagedEntries?.[entryId] ?? null;
}

function weaponRefineEntryById(entryId) {
  return weaponRefineStagedRecord(entryId)?.entry ?? inventoryEntryById(entryId);
}

function weaponRefineResultFxKind() {
  const fx = state.weaponRefine?.resultFx;
  if (!fx) return null;
  if (performance.now() >= fx.until) {
    state.weaponRefine.resultFx = null;
    return null;
  }
  return fx.kind;
}

function weaponRefineResultFxActive() {
  return Boolean(weaponRefineResultFxKind());
}

function weaponRefineUsedEntryIds() {
  const board = state.weaponRefine;
  const ids = new Set();
  if (board.weaponEntryId) ids.add(board.weaponEntryId);
  for (const id of board.oreEntryIds) if (id) ids.add(id);
  for (const id of board.materialEntryIds) if (id) ids.add(id);
  return ids;
}

function weaponRefineSlotEntry(kind, index = 0) {
  const board = state.weaponRefine;
  let entryId = null;
  if (kind === "weapon") entryId = board.weaponEntryId;
  else if (kind === "ore") entryId = board.oreEntryIds[index] ?? null;
  else if (kind === "material") entryId = board.materialEntryIds[index] ?? null;
  if (!entryId) return { entry: null, item: null };
  const entry = weaponRefineEntryById(entryId);
  return { entry, item: entry ? G.itemDefinition(entry.itemId) : null };
}

function weaponRefineBoardReady() {
  return Boolean(state.weaponRefine.weaponEntryId);
}

function weaponRefineOreCount() {
  return state.weaponRefine.oreEntryIds.filter(Boolean).length;
}

function weaponRefineMaterialCount() {
  return state.weaponRefine.materialEntryIds.filter(Boolean).length;
}

function weaponRefineBoardEntries(kind) {
  const board = state.weaponRefine;
  const entryIds = kind === "ore" ? board.oreEntryIds : board.materialEntryIds;
  return entryIds
    .filter(Boolean)
    .map((entryId) => {
      const entry = weaponRefineEntryById(entryId);
      const item = entry ? G.itemDefinition(entry.itemId) : null;
      return entry && item ? { entry, item } : null;
    })
    .filter(Boolean);
}

function weaponRefineExistingStatPenalty(entry) {
  if (G.sanitizeWeaponRefineLevel(entry?.weaponRefineLevel) < WEAPON_REFINE_PENALTY_FROM_LEVEL) return 0;
  const bonusStats = G.sanitizeItemBonusStats(entry?.bonusStats);
  const addedStats = Math.trunc(Number(bonusStats.dc?.[1]) || 0)
    + Math.trunc(Number(bonusStats.mc?.[1]) || 0)
    + Math.trunc(Number(bonusStats.sc?.[1]) || 0);
  return Math.min(
    WEAPON_REFINE_EXISTING_STAT_PENALTY_CAP,
    addedStats * WEAPON_REFINE_EXISTING_STAT_PENALTY,
  );
}

function weaponRefineItemSuccessFromStat(refineStat) {
  let remaining = Math.max(0, Math.trunc(Number(refineStat) || 0));
  let bonus = 0;
  const tier1 = Math.min(WEAPON_REFINE_ITEM_TIER1_STAT, remaining);
  bonus += tier1 * WEAPON_REFINE_ITEM_TIER1_RATE;
  remaining -= tier1;
  const tier2 = Math.min(WEAPON_REFINE_ITEM_TIER2_STAT, remaining);
  bonus += tier2 * WEAPON_REFINE_ITEM_TIER2_RATE;
  remaining -= tier2;
  bonus += remaining * WEAPON_REFINE_ITEM_TIER3_RATE;
  return Math.min(WEAPON_REFINE_ITEM_SUCCESS_CAP, bonus);
}

function weaponRefineGoldCost(weaponEntry) {
  const nextLevel = G.sanitizeWeaponRefineLevel(weaponEntry?.weaponRefineLevel) + 1;
  return WEAPON_REFINE_GOLD_PER_LEVEL * nextLevel;
}

function weaponRefineCostPreview() {
  if (!weaponRefineBoardReady()) return null;
  const weaponEntry = weaponRefineEntryById(state.weaponRefine.weaponEntryId);
  if (!weaponEntry) return null;
  const cost = weaponRefineGoldCost(weaponEntry);
  return {
    cost,
    canAfford: state.inventory.gold >= cost,
  };
}

function weaponRefineChancePreview() {
  if (!weaponRefineBoardReady()) return null;
  return G.computeWeaponRefineChance();
}

function weaponRefineChanceText(preview = weaponRefineChancePreview()) {
  if (!preview) return "Place a weapon to preview success chance.";
  if (preview.autoFail) return `0% — ${preview.reason}`;
  const statLabel = smithStatLabel(preview.statKey);
  return `${preview.chance}% success · targets +${WEAPON_REFINE_STAT_INCREASE} ${statLabel} · ${WEAPON_REFINE_CRIT_CHANCE}% crit for ×${WEAPON_REFINE_CRIT_MULTIPLIER}`;
}

function weaponRefineCostText(costPreview = weaponRefineCostPreview()) {
  if (!costPreview) return "Place a weapon to see refine cost.";
  const afford = costPreview.canAfford ? "" : " — not enough gold";
  return `Cost: ${costPreview.cost.toLocaleString()} gold${afford}`;
}

function smithCombineBonusStatScore(bonusStats) {
  const stats = G.sanitizeItemBonusStats(bonusStats);
  let total = 0;
  for (const key of ["dc", "mc", "sc", "ac", "amc"]) {
    total += Math.abs(stats[key][0]) + Math.abs(stats[key][1]);
  }
  for (const key of ["hp", "mp", "accuracy", "agility", "luck", "attackSpeed"]) {
    total += Math.abs(stats[key]);
  }
  return total;
}

function smithCombineDurabilityScore(entry, item) {
  if (entry?.currentDura == null) return G.itemDefinitionMaxDura(item);
  return Math.max(0, Math.trunc(Number(entry.currentDura) || 0));
}

function smithCombineEntryPriority(entry, item) {
  return [
    G.sanitizeWeaponRefineLevel(entry?.weaponRefineLevel),
    Math.max(0, Math.trunc(Number(entry?.refineLevel) || 0)),
    smithCombineBonusStatScore(entry?.bonusStats),
    G.isEquippedEntry(entry?.id) ? 1 : 0,
    smithCombineDurabilityScore(entry, item),
  ];
}

function smithCombineWouldConsumeBetterItem(target, material, item) {
  return G.compareSmithCombineEntries(target, material, item) > 0;
}

function smithCombineOptions() {
  const groups = new Map();
  for (const entry of inventoryEntries()) {
    const item = G.itemDefinition(entry.itemId);
    if (!G.canSmithCombineItem(item)) continue;
    const entries = groups.get(entry.itemId) ?? [];
    entries.push(entry);
    groups.set(entry.itemId, entries);
  }

  return [...groups.entries()]
    .map(([itemId, entries]) => {
      const item = G.itemDefinition(itemId);
      const { target, material, sortedEntries } = G.resolveSmithCombinePair(entries, item);
      const stat = smithUpgradeStat(target, item);
      const chance = smithCombineSuccessChance(target);
      return { item, entries: sortedEntries, target, material, stat, chance };
    })
    .filter((option) => option.item && option.entries.length >= 2 && option.target && option.material && option.target.id !== option.material.id && option.stat);
}

function smithUpgradeStat(entry, item) {
  const stats = G.itemEntryStats(entry, item);
  const baseStats = G.itemEntryStats(null, item);
  const preferredRangeStat = smithPreferredUpgradeStatKey(item, baseStats);
  if (preferredRangeStat === SMITH_RANDOM_TRIPLE_STAT) {
    const stat = smithRangeUpgradeStat("dc", stats, 0);
    return stat ? { ...stat, label: "DC/MC/SC", randomTriple: true } : null;
  }
  if (preferredRangeStat) return smithRangeUpgradeStat(preferredRangeStat, stats, 0);

  const candidates = [];
  for (const [key, priority] of [
    ["dc", 0],
    ["mc", 0],
    ["sc", 0],
    ["ac", 1],
    ["amc", 1],
  ]) {
    const candidate = smithRangeUpgradeStat(key, stats, priority);
    if (candidate) candidates.push(candidate);
  }
  for (const [key, label, priority] of [
    ["accuracy", "Acc", 2],
    ["agility", "Agi", 2],
    ["luck", "Luck", 2],
    ["attackSpeed", "A Speed", 2],
    ["hp", "HP", 3],
    ["mp", "MP", 3],
  ]) {
    const value = Number(stats[key]) || 0;
    if (value > 0) candidates.push({ key, label, value, priority, range: false });
  }
  return candidates.sort((a, b) => b.value - a.value || a.priority - b.priority)[0] ?? null;
}

function smithPreferredUpgradeStatKey(item, baseStats) {
  const slot = String(item?.slot ?? item?.type ?? "").toLowerCase();
  const defensiveItem = SMITH_DEFENSIVE_UPGRADE_SLOTS.has(slot);

  if (slot === "weapon") return smithWeaponUpgradeStatKey(baseStats);

  const characterId = G.normalizeCharacterId(state.activeCharacterId);
  if (characterId === "Warrior" && smithRangeStatValue(baseStats, "dc") > 0) return "dc";
  if (characterId === "Wizard" && !defensiveItem && smithRangeStatValue(baseStats, "mc") > 0) return "mc";

  if (characterId === "Warrior" || characterId === "Wizard") return smithBestDefensiveUpgradeStatKey(baseStats);

  return null;
}

function smithWeaponUpgradeStatKey(baseStats, { rollTriple = false } = {}) {
  const hasDc = smithRangeStatValue(baseStats, "dc") > 0;
  const hasMc = smithRangeStatValue(baseStats, "mc") > 0;
  const hasSc = smithRangeStatValue(baseStats, "sc") > 0;

  if (hasDc && hasMc && hasSc) {
    if (rollTriple) return ["dc", "mc", "sc"][Math.floor(Math.random() * 3)];
    return SMITH_RANDOM_TRIPLE_STAT;
  }
  if (hasDc && hasMc) return "mc";
  if (hasDc && hasSc) return "sc";
  if (hasDc) return "dc";
  if (hasMc) return "mc";
  if (hasSc) return "sc";
  return null;
}

function smithBestDefensiveUpgradeStatKey(stats) {
  return smithBestRangeStat(stats, ["ac", "amc"]);
}

function smithBestRangeStat(stats, keys) {
  return keys
    .map((key, priority) => ({ key, priority, value: smithRangeStatValue(stats, key) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.priority - b.priority)[0]?.key ?? null;
}

function smithRangeUpgradeStat(key, stats, priority) {
  const value = smithRangeStatValue(stats, key);
  if (value <= 0) return null;
  return {
    key,
    label: smithStatLabel(key),
    value,
    priority,
    range: true,
    index: 1,
  };
}

function smithRangeStatValue(stats, key) {
  const range = stats?.[key];
  return Math.max(Number(range?.[0]) || 0, Number(range?.[1]) || 0);
}

function smithStatLabel(key) {
  return {
    dc: "DC",
    mc: "MC",
    sc: "SC",
    ac: "AC",
    amc: "AMC",
  }[key] ?? key.toUpperCase();
}

function smithCombineSuccessChance(entry) {
  const refineLevel = Math.max(0, Math.trunc(Number(entry?.refineLevel) || 0));
  return SMITH_COMBINE_SUCCESS_CHANCES[Math.min(refineLevel, SMITH_COMBINE_SUCCESS_CHANCES.length - 1)] ?? 0.05;
}

function smithChanceText(chance) {
  return `${Math.round(Math.max(0, Math.min(1, Number(chance) || 0)) * 100)}%`;
}

function equipmentSlotToGemSlot(slotId) {
  if (slotId === "braceletL" || slotId === "braceletR") return "bracelet";
  if (slotId === "ringL" || slotId === "ringR") return "ring";
  return slotId;
}

function itemIconSrc(item) {
  if (!item) return "";
  return item.icon?.src ?? item.icon?.sheet ?? "";
}

function itemIconMarkup(item, className = "") {
  if (!item?.icon) return "";
  const icon = item.icon;
  const classAttr = className ? ` class="${G.escapeHtml(className)}"` : "";
  if (icon.sheet) {
    const w = Math.max(1, Math.trunc(Number(icon.w) || 32));
    const h = Math.max(1, Math.trunc(Number(icon.h) || 32));
    const sx = Math.max(0, Math.trunc(Number(icon.sx) || 0));
    const sy = Math.max(0, Math.trunc(Number(icon.sy) || 0));
    return `<span${classAttr} style="display:inline-block;width:${w}px;height:${h}px;max-width:28px;max-height:28px;background:url('${G.escapeHtml(icon.sheet)}') -${sx}px -${sy}px no-repeat;image-rendering:pixelated;" role="img" aria-hidden="true"></span>`;
  }
  const src = icon.src ?? "";
  if (!src) return "";
  return `<img${classAttr} src="${G.escapeHtml(src)}" alt="" />`;
}

function accountUpgradeById(upgradeId) {
  return ACCOUNT_UPGRADE_DEFS.find((upgrade) => upgrade.id === upgradeId) ?? null;
}

function accountUpgradeUsesRebirthPoints(upgrade) {
  return upgrade?.currency === "rebirthPoints";
}

function accountUpgradeTier(upgradeId) {
  return Math.max(0, Math.trunc(Number(state.account.upgrades?.tiers?.[upgradeId]) || 0));
}

function accountUpgradeMaxTier(upgrade) {
  if (Array.isArray(upgrade?.rebirthCosts)) return upgrade.rebirthCosts.length;
  if (Number.isFinite(upgrade?.maxTier)) return Math.max(1, Math.trunc(upgrade.maxTier));
  if (upgrade?.rebirthCostFn === "linear") return Infinity;
  return 1;
}

function accountUpgradeRebirthCost(upgrade) {
  const tier = accountUpgradeTier(upgrade.id);
  if (tier >= accountUpgradeMaxTier(upgrade)) return null;
  if (Array.isArray(upgrade?.rebirthCosts)) return upgrade.rebirthCosts[tier] ?? null;
  if (upgrade?.rebirthCostFn === "linear") return tier + 1;
  return null;
}

function accountUpgradeIsMaxed(upgrade) {
  const maxTier = accountUpgradeMaxTier(upgrade);
  if (!Number.isFinite(maxTier)) return false;
  return accountUpgradeTier(upgrade.id) >= maxTier;
}

function accountUpgradePurchased(upgradeId) {
  return accountUpgradeTier(upgradeId) >= 1;
}

function accountUpgradeValue(effect) {
  return ACCOUNT_UPGRADE_DEFS.reduce((total, upgrade) => {
    if (upgrade.effect !== effect) return total;
    const tier = accountUpgradeTier(upgrade.id);
    if (tier <= 0) return total;
    return total + tier * Math.max(0, Math.trunc(Number(upgrade.value) || 0));
  }, 0);
}

function inventoryEntryAtSlot(slot) {
  G.ensureInventorySlots();
  return inventoryEntries().find((entry) => entry.slot === slot) ?? null;
}

function inventoryEntries() {
  return state.inventory.items.filter((entry) => !G.isEquippedEntry(entry.id) && !G.isHotbarEntry(entry.id));
}

function inventoryUsedSlots() {
  return inventoryEntries().length;
}

function inventoryEntryById(entryId) {
  return state.inventory.items.find((entry) => entry.id === entryId) ?? null;
}

function storageEntries() {
  G.ensureStorageSlots();
  return state.account.storage.items;
}

function storageUsedSlots() {
  return storageEntries().length;
}

function storageEntryById(entryId) {
  return state.account.storage.items.find((entry) => entry.id === entryId) ?? null;
}

function storageEntryAtSlot(slot) {
  G.ensureStorageSlots();
  return storageEntries().find((entry) => entry.slot === slot) ?? null;
}

function equippedSlotForEntry(entryId) {
  return Object.entries(state.inventory.equipment).find(([, equippedId]) => equippedId === entryId)?.[0] ?? null;
}

function hotbarSlotForEntry(entryId) {
  return state.hotbar.slots.findIndex((candidate) => candidate === entryId);
}

function hotbarEntryAtSlot(slot) {
  const entryId = state.hotbar.slots[slot] ?? null;
  return entryId ? inventoryEntryById(entryId) : null;
}

function hotbarSlotIndex(slot) {
  return Math.max(0, Math.min(HOTBAR_SLOT_COUNT - 1, Number(slot) || 0));
}

async function equipStorageEntryToSlot(entryId, slotId) {
  G.ensureStorageSlots();
  const check = G.canEquipStorageEntryToSlot(entryId, slotId);
  if (!check.ok) {
    G.rejectInventoryMove(check.reason);
    return false;
  }

  const entry = check.entry;
  const item = check.item;
  const sourceStorageSlot = Number.isInteger(entry.slot) ? entry.slot : G.nextFreeStorageSlot();
  const targetEntryId = state.inventory.equipment[slotId];
  const targetEntry = targetEntryId ? inventoryEntryById(targetEntryId) : null;

  state.account.storage.items = state.account.storage.items.filter((candidate) => candidate.id !== entry.id);
  entry.id = G.allocateInventoryEntryId();
  entry.slot = null;
  state.inventory.items.push(entry);

  if (targetEntry) {
    state.inventory.items = state.inventory.items.filter((candidate) => candidate.id !== targetEntry.id);
    targetEntry.id = G.allocateStorageEntryId();
    targetEntry.slot = sourceStorageSlot < state.account.storage.maxSlots ? sourceStorageSlot : G.nextFreeStorageSlot();
    state.account.storage.items.push(targetEntry);
  }

  state.inventory.equipment[slotId] = entry.id;
  G.playSfx(G.itemEquipSfxKey(item), { volume: 0.5, throttleMs: 80 });
  await G.applyEquipmentChanges();
  G.renderStorageMove({ equipmentChanged: true });
  return true;
}

function orePurity(entry, item = null) {
  const resolvedItem = item ?? G.itemDefinition(entry?.itemId);
  if (!G.isOreItem(resolvedItem) || entry?.currentDura == null) return 0;
  return Math.max(0, Math.floor(Number(entry.currentDura) / ORE_PURITY_UNIT));
}

function equippedEntry(slotId) {
  const entryId = state.inventory.equipment[slotId];
  return state.inventory.items.find((entry) => entry.id === entryId) ?? null;
}

function inventoryEntrySignature(entry) {
  const duraPart = entry.currentDura != null ? `:${entry.currentDura}/${entry.maxDura ?? ""}` : "";
  return `${entry.id}:${entry.itemId}:${entry.quantity}:${entry.slot ?? ""}:${entry.refineLevel ?? 0}:${entry.weaponRefineLevel ?? 0}:${entry.gemCount ?? 0}${duraPart}:${JSON.stringify(G.sanitizeItemBonusStats(entry.bonusStats))}`;
}

async function equipInventoryEntry(entryId) {
  const entry = inventoryEntryById(entryId);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  if (!entry || !item || !G.isEquipableItem(item)) return;
  const slotId = G.targetEquipmentSlot(item);
  if (!slotId) return;
  await equipInventoryEntryToSlot(entryId, slotId);
}

async function equipInventoryEntryToSlot(entryId, slotId) {
  G.ensureInventorySlots();
  const check = G.canEquipEntryToSlot(entryId, slotId);
  if (!check.ok) {
    G.rejectInventoryMove(check.reason);
    return;
  }
  const entry = check.entry;
  const sourceEquipmentSlot = equippedSlotForEntry(entry.id);
  const targetEntryId = state.inventory.equipment[slotId];
  if (targetEntryId === entry.id) return;

  const targetEntry = targetEntryId ? inventoryEntryById(targetEntryId) : null;
  const sourceInventorySlot = Number.isInteger(entry.slot) ? entry.slot : null;
  const targetCanUseSourceEquipmentSlot = sourceEquipmentSlot
    && targetEntry
    && G.canEquipEntryToSlot(targetEntry.id, sourceEquipmentSlot).ok;

  if (targetEntry) {
    if (targetCanUseSourceEquipmentSlot) {
      state.inventory.equipment[sourceEquipmentSlot] = targetEntry.id;
      targetEntry.slot = null;
    } else {
      if (sourceInventorySlot === null && inventoryUsedSlots() >= state.inventory.maxSlots) {
        G.rejectInventoryMove("Cannot equip: inventory is full.");
        return;
      }
      if (sourceEquipmentSlot) state.inventory.equipment[sourceEquipmentSlot] = null;
      targetEntry.slot = sourceInventorySlot ?? G.nextFreeInventorySlot();
    }
  } else if (sourceEquipmentSlot) {
    state.inventory.equipment[sourceEquipmentSlot] = null;
  }

  state.inventory.equipment[slotId] = entry.id;
  entry.slot = null;
  G.playSfx(G.itemEquipSfxKey(item), { volume: 0.5, throttleMs: 80 });
  await G.applyEquipmentChanges();
}

async function unequipSlot(slotId) {
  const entryId = state.inventory.equipment[slotId];
  if (!entryId) return;
  if (inventoryUsedSlots() >= state.inventory.maxSlots) {
    G.pushBattleLog("Cannot unequip: inventory is full.");
    sceneSignature = "";
    G.renderSceneOverlay();
    return;
  }
  state.inventory.equipment[slotId] = null;
  const entry = state.inventory.items.find((candidate) => candidate.id === entryId);
  if (entry) entry.slot = G.nextFreeInventorySlot();
  G.playSfx("item.move", { volume: 0.42, throttleMs: 80 });
  await G.applyEquipmentChanges();
}

function equippedVisualItem(layer) {
  for (const slot of EQUIPMENT_SLOTS) {
    const entry = equippedEntry(slot.id);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (item?.visual?.layer === layer) return item;
  }
  return null;
}

function accountUpgradeHtml(upgrade) {
  const planned = Boolean(upgrade.planned);
  const tier = accountUpgradeTier(upgrade.id);
  const maxed = !planned && accountUpgradeIsMaxed(upgrade);
  const canAfford = !planned && !maxed && G.canAffordAccountUpgrade(upgrade);
  const stateClass = planned ? "planned" : maxed ? "purchased" : canAfford ? "ready" : "locked";
  const disabled = maxed || !canAfford ? "disabled" : "";
  const buttonText = planned
    ? "Planned"
    : maxed
      ? (Number.isFinite(accountUpgradeMaxTier(upgrade)) && accountUpgradeMaxTier(upgrade) > 1 ? "Maxed" : "Unlocked")
      : canAfford
        ? (tier > 0 ? "Upgrade" : "Unlock")
        : `Need ${G.missingAccountUpgradeItemLabel(upgrade)}`;
  const statusText = planned ? "Future" : maxed ? "Maxed" : canAfford ? "Ready" : "Locked";
  return `
    <article class="upgrade-card ${stateClass}">
      <div class="upgrade-card-main">
        <div class="upgrade-card-title">
          <strong>${G.escapeHtml(upgrade.label)}</strong>
          <span>${G.escapeHtml(statusText)}</span>
        </div>
        <span class="upgrade-card-summary">${G.escapeHtml(upgrade.summary)}</span>
        <div class="upgrade-progress">
          <span>${G.escapeHtml(accountUpgradeEffectLabel(upgrade))}</span>
          <strong>${G.escapeHtml(accountUpgradeProgressText(upgrade))}</strong>
        </div>
        <small class="upgrade-source">${G.escapeHtml(accountUpgradeSourceText(upgrade))}</small>
      </div>
      <div class="upgrade-requirements">
        ${accountUpgradeRequirementHtml(upgrade)}
      </div>
      <button type="button" data-buy-account-upgrade="${G.escapeHtml(upgrade.id)}" ${disabled}>${buttonText}</button>
    </article>
  `;
}

function equippedItem(slotId) {
  const entry = equippedEntry(slotId);
  return entry ? G.itemDefinition(entry.itemId) : null;
}

function inventorySceneHtml() {
  G.ensureInventorySlots();
  const pageCount = inventoryPageCount();
  if (!inventoryPageUnlocked(state.inventoryPage)) state.inventoryPage = 0;
  const pageStart = state.inventoryPage * INVENTORY_PAGE_SIZE;
  const visibleSlots = Math.min(INVENTORY_PAGE_SIZE, state.inventory.maxSlots - pageStart);
  return `
    <section class="crystal-inventory" aria-label="Inventory">
      ${inventoryPageTabsHtml(pageCount)}
      <span class="crystal-inventory-gold">${state.inventory.gold}</span>
      <span class="crystal-inventory-weight">${inventoryUsedSlots()}/${state.inventory.maxSlots}</span>
      ${Array.from({ length: visibleSlots }, (_, index) => G.crystalInventorySlotHtml(pageStart + index, index)).join("")}
    </section>
  `;
}

function storageSceneHtml() {
  G.ensureStorageSlots();
  const pageCount = storagePageCount();
  if (!storagePageUnlocked(state.storagePage)) state.storagePage = 0;
  const pageStart = state.storagePage * STORAGE_PAGE_SIZE;
  const visibleSlots = Math.min(STORAGE_PAGE_SIZE, state.account.storage.maxSlots - pageStart);
  return `
    <section class="crystal-storage" aria-label="Storage">
      <span class="crystal-storage-title" aria-hidden="true"></span>
      ${storagePageTabsHtml(pageCount)}
      ${storagePageUnlockConfirmHtml()}
      <span class="crystal-storage-count">${storageUsedSlots()}/${state.account.storage.maxSlots}</span>
      ${Array.from({ length: visibleSlots }, (_, index) => G.crystalStorageSlotHtml(pageStart + index, index)).join("")}
    </section>
  `;
}

function inventoryPageTabsHtml(pageCount = inventoryPageCount()) {
  return Array.from({ length: pageCount }, (_, page) => {
    const active = page === state.inventoryPage ? " active" : "";
    const secondary = page > 0 ? " secondary" : "";
    const locked = inventoryPageUnlocked(page) ? "" : " locked";
    const left = page === 0 ? 6 : 76 + (page - 1) * 70;
    const label = page === 0 ? "" : inventoryPageUnlocked(page) ? `ITEMS ${page + 1}` : `${inventoryPageUnlockCost(page).toLocaleString()}g`;
    const title = inventoryPageUnlocked(page) ? `Items ${page + 1}` : `Unlock Items ${page + 1} for ${inventoryPageUnlockCost(page).toLocaleString()} gold`;
    return `
      <button
        class="crystal-inventory-tab${active}${secondary}${locked}"
        type="button"
        data-inventory-page="${page}"
        style="left:${left}px;"
        title="${title}"
      >${label}</button>
    `;
  }).join("");
}

function storagePageTabsHtml(pageCount = storagePageCount()) {
  return Array.from({ length: pageCount }, (_, page) => {
    const pageClass = page === 0 ? "page-1" : "page-2";
    const active = page === state.storagePage ? " active" : "";
    const locked = storagePageUnlocked(page) ? "" : " locked";
    const title = storagePageUnlocked(page)
      ? `Storage ${page + 1}`
      : `Unlock Storage ${page + 1} for ${storagePageUnlockCost(page).toLocaleString()} gold`;
    return `
      <button
        class="crystal-storage-page ${pageClass}${active}${locked}"
        type="button"
        data-storage-page="${page}"
        title="${title}"
        aria-label="${title}"
      ></button>
    `;
  }).join("");
}

function storagePageUnlockConfirmHtml() {
  const page = state.pendingStoragePageUnlock;
  if (page === null || !Number.isInteger(page) || storagePageUnlocked(page)) {
    return "";
  }
  const cost = storagePageUnlockCost(page);
  const canAfford = state.inventory.gold >= cost;
  return `
    <div class="crystal-storage-unlock-confirm" role="dialog" aria-label="Confirm storage unlock">
      <p class="crystal-storage-unlock-text">
        Unlock Storage ${page + 1} for <strong>${cost.toLocaleString()}</strong> gold?
      </p>
      <div class="crystal-storage-unlock-actions">
        <button
          type="button"
          class="crystal-storage-unlock-confirm-btn"
          data-confirm-storage-page-unlock="${page}"
          ${canAfford ? "" : "disabled"}
        >Unlock</button>
        <button type="button" class="crystal-storage-unlock-cancel-btn" data-cancel-storage-page-unlock>Cancel</button>
      </div>
      ${canAfford ? "" : `<p class="crystal-storage-unlock-note">Need ${cost.toLocaleString()} gold (you have ${state.inventory.gold.toLocaleString()}).</p>`}
    </div>
  `;
}

function equipmentSlotHtml(slot) {
  const entry = equippedEntry(slot.id);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  return `
    <div class="equipment-slot ${item ? "has-tooltip" : ""}" data-equipment-slot="${slot.id}" ${item ? `data-tooltip-item="${item.id}" data-tooltip-entry="${entry.id}"` : ""}>
      <span>${slot.label}</span>
      <strong>${item ? G.escapeHtml(G.itemDisplayName(item, entry)) : "Empty"}</strong>
      ${item ? `<button data-unequip-slot="${slot.id}">Unequip</button>` : ""}
    </div>
  `;
}

function inventoryDropTargetAt(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const dropTarget = target?.closest?.(
    "[data-inventory-entry], [data-storage-entry], [data-inventory-slot], [data-equipment-slot], [data-hotbar-slot], [data-storage-slot], [data-refine-slot]",
  );
  return dropTarget && root.contains(dropTarget) ? dropTarget : null;
}

function inventoryDropTargetAccepts(dropTarget) {
  if (!inventoryDragState || !dropTarget) return false;
  const sourceEntry = inventoryDragState.sourceContainer === "inventory"
    ? inventoryEntryById(inventoryDragState.entryId)
    : inventoryDragState.sourceContainer === "storage"
      ? storageEntryById(inventoryDragState.entryId)
      : null;
  const sourceItem = sourceEntry ? G.itemDefinition(sourceEntry.itemId) : null;
  const equipmentSlot = dropTarget.closest("[data-equipment-slot]");
  if (equipmentSlot && root.contains(equipmentSlot)) {
    if (G.isGemUpgradeItem(sourceItem) && inventoryDragState.sourceContainer === "inventory") {
      const slotEntry = equippedEntry(equipmentSlot.dataset.equipmentSlot);
      return Boolean(slotEntry && G.canApplyGemToEntry(inventoryDragState.entryId, slotEntry.id).ok);
    }
    if (inventoryDragState.sourceContainer === "storage") {
      return G.canEquipStorageEntryToSlot(inventoryDragState.entryId, equipmentSlot.dataset.equipmentSlot).ok;
    }
    return G.canEquipEntryToSlot(inventoryDragState.entryId, equipmentSlot.dataset.equipmentSlot).ok;
  }
  const targetInventoryEntry = dropTarget.closest("[data-inventory-entry]");
  if (targetInventoryEntry && root.contains(targetInventoryEntry) && inventoryDragState.sourceContainer === "inventory") {
    const targetEntryId = targetInventoryEntry.dataset.inventoryEntry;
    if (!targetEntryId || targetEntryId === inventoryDragState.entryId) return true;
    if (G.isGemUpgradeItem(sourceItem)) {
      return G.canApplyGemToEntry(inventoryDragState.entryId, targetEntryId).ok;
    }
    const targetEntry = inventoryEntryById(targetEntryId);
    return G.stackEntriesCombinable(sourceEntry, targetEntry);
  }
  const targetStorageEntry = dropTarget.closest("[data-storage-entry]");
  if (targetStorageEntry && root.contains(targetStorageEntry) && inventoryDragState.sourceContainer === "storage") {
    const targetEntryId = targetStorageEntry.dataset.storageEntry;
    if (!targetEntryId || targetEntryId === inventoryDragState.entryId) return true;
    const sourceEntry = storageEntryById(inventoryDragState.entryId);
    const targetEntry = storageEntryById(targetEntryId);
    return G.stackEntriesCombinable(sourceEntry, targetEntry);
  }
  const storageSlot = dropTarget.closest("[data-storage-slot]");
  if (storageSlot && root.contains(storageSlot)) {
    return G.canDropEntryToStorageSlot(
      inventoryDragState.entryId,
      Number(storageSlot.dataset.storageSlot),
      inventoryDragState.sourceContainer,
      inventoryDragState.sourceEquipmentSlot,
    ).ok;
  }
  const inventorySlot = dropTarget.closest("[data-inventory-slot]");
  if (inventorySlot && root.contains(inventorySlot)) {
    if (inventoryDragState.sourceContainer === "weaponRefine") return true;
    if (inventoryDragState.sourceContainer === "storage") {
      return G.canWithdrawStorageEntryToInventorySlot(inventoryDragState.entryId, Number(inventorySlot.dataset.inventorySlot)).ok;
    }
    return G.canDropEntryToInventorySlot(
      inventoryDragState.entryId,
      Number(inventorySlot.dataset.inventorySlot),
      inventoryDragState.sourceEquipmentSlot,
    ).ok;
  }
  const hotbarSlot = dropTarget.closest("[data-hotbar-slot]");
  if (hotbarSlot && root.contains(hotbarSlot)) {
    if (inventoryDragState.sourceContainer === "storage") return false;
    return G.canDropEntryToHotbarSlot(inventoryDragState.entryId, Number(hotbarSlot.dataset.hotbarSlot)).ok;
  }
  const refineSlot = dropTarget.closest("[data-refine-slot]");
  if (refineSlot && root.contains(refineSlot)) {
    const kind = refineSlot.dataset.refineSlot;
    const index = Number(refineSlot.dataset.refineIndex) || 0;
    if (kind !== "ore" && kind !== "material") return false;
    if (inventoryDragState.sourceContainer === "storage") return false;
    const entry = weaponRefineEntryById(inventoryDragState.entryId) ?? inventoryEntryById(inventoryDragState.entryId);
    const item = entry ? G.itemDefinition(entry.itemId) : null;
    if (kind === "ore") return G.canPlaceWeaponRefineOre(entry, item, index);
    return G.canPlaceWeaponRefineMaterial(entry, item, index);
  }
  return false;
}

function inventoryItemHtml(entry) {
  const item = G.itemDefinition(entry.itemId);
  if (!item) return `<div class="inventory-item missing"><span>?</span><strong>${G.escapeHtml(entry.itemId)}</strong></div>`;
  const stack = G.isStackableItem(item) ? `<span class="item-qty">${entry.quantity}</span>` : "";
  const equipped = G.isEquippedEntry(entry.id);
  const requirement = G.itemRequirementStatus(item);
  const locked = !requirement.ok && (G.isEquipableItem(item) || G.isBookItem(item));
  const tag = equipped ? "Equipped" : G.isStackableItem(item) ? `Stack ${entry.quantity}/${G.maxItemStack(item)}` : "Item";
  const command = G.isEquipableItem(item)
    ? `<button data-equip-entry="${entry.id}" ${equipped || !requirement.ok ? "disabled" : ""}>${equipped ? "Equipped" : requirement.ok ? "Equip" : "Locked"}</button>`
    : G.isPotionItem(item) || G.isBenedictionOilItem(item)
    ? `<button data-use-entry="${entry.id}">Use</button>`
    : "";
  return `
    <div class="inventory-item has-tooltip ${equipped ? "equipped" : ""} ${locked ? "locked" : ""}" data-tooltip-item="${item.id}" data-tooltip-entry="${entry.id}">
        ${G.itemIconMarkup(item)}
      ${stack}
      <strong>${G.escapeHtml(G.itemDisplayName(item, entry))}</strong>
      <span>${requirement.ok ? tag : requirement.reason}</span>
      ${command}
    </div>
  `;
}

function itemTooltipHtml(item, entry = null) {
  return `
    <strong>${G.escapeHtml(G.itemDisplayName(item, entry))}</strong>
    <span>${G.escapeHtml(G.title(item.type))}${item.slot ? ` | ${G.escapeHtml(G.slotLabel(item.slot))}` : ""}</span>
    ${entry?.refineLevel ? `<span>Smith: +${Math.max(0, Math.trunc(Number(entry.refineLevel) || 0))}</span>` : ""}
    ${entry?.gemCount ? `<span>Gem upgrades: ${Math.max(0, Math.trunc(Number(entry.gemCount) || 0))}</span>` : ""}
    ${entry?.weaponRefineLevel ? `<span>Refine: +${Math.max(0, Math.trunc(Number(entry.weaponRefineLevel) || 0))} / ${WEAPON_REFINE_MAX}</span>` : ""}
    ${entry && G.isOreItem(item) ? G.itemOreTooltipHtml(entry, item) : ""}
    ${entry && G.itemUsesEntryDurability(item) && !G.isOreItem(item) ? G.itemDurabilityTooltipHtml(entry, item) : ""}
    ${item.source?.name ? `<span>Crystal: ${G.escapeHtml(item.source.name)} #${item.source.crystalIndex}</span>` : ""}
    ${item.visual ? `<span>Visual: ${G.escapeHtml(item.visual.layer)} ${item.visual.index}</span>` : ""}
    ${G.itemSpellTooltipHtml(item)}
    ${G.itemRequirementTooltipHtml(item)}
    ${G.isGemUpgradeItem(item) ? G.itemGemTooltipHtml(item) : ""}
    ${G.isBookItem(item) ? "" : G.isBenedictionOilItem(item) ? G.itemBenedictionTooltipHtml(item, entry) : G.isPotionItem(item) ? G.itemPotionTooltipHtml(item) : G.isPoisonItem(item) ? G.itemPoisonTooltipHtml(item) : G.isTaoistAmuletItem(item) ? G.itemAmuletTooltipHtml(item) : itemStatsTooltipHtml(G.itemEntryStats(entry, item))}
    ${item.stackable ? `<span>Stack: ${G.maxItemStack(item)}</span>` : ""}
  `;
}

function itemStatsTooltipHtml(stats) {
  const lines = [];
  for (const [key, label] of [
    ["dc", "DC"],
    ["mc", "MC"],
    ["sc", "SC"],
    ["ac", "AC"],
    ["amc", "AMC"],
  ]) {
    if (G.hasRangeValue(stats?.[key])) lines.push(`<dt>${label}</dt><dd>${formatStatRange(stats[key])}</dd>`);
  }
  for (const [key, label] of [
    ["hp", "HP"],
    ["mp", "MP"],
    ["accuracy", "Acc"],
    ["agility", "Agi"],
    ["luck", "Luck"],
    ["attackSpeed", "A Speed"],
    ["poisonAttack", "Poison"],
    ["freezing", "Freezing"],
    ["magicResist", "Magic Resist"],
    ["poisonResist", "Poison Resist"],
    ["healthRecovery", "HP Recovery"],
    ["poisonRecovery", "Poison Recovery"],
    ["strong", "Strong"],
  ]) {
    const value = Number(stats?.[key]) || 0;
    if (value !== 0) lines.push(`<dt>${label}</dt><dd>${value > 0 ? `+${value}` : value}</dd>`);
  }
  if (!lines.length) return `<p>No stat bonus</p>`;
  return `<dl>${lines.join("")}</dl>`;
}

function smithNpcSceneHtml(npc) {
  const rows = smithCombineOptions().map(smithCombineRowHtml).join("");
  return `
    <section class="npc-panel crystal-npc-text npc-shop-panel smith-panel">
      <p>Combine two matching equipment items. The weaker copy is consumed. The best copy is kept (Ref level, smith +, stats, durability). Success adds +1 to the kept item's strongest stat.</p>
      <div class="npc-shop-summary">
        <span>Success chance</span>
        <strong>By + level / gem type</strong>
      </div>
      <div class="npc-shop-list smith-combine-list" data-preserve-scroll="npc-smith-combine">
        ${rows || `<span class="trader-empty">Bring me two matching equipment items.</span>`}
      </div>
    </section>
  `;
}

function refinerNpcSceneHtml(npc) {
  const junk = G.junkOreSellPreview();
  const sellLabel = junk.count > 0
    ? `Sell all junk ore (${junk.count.toLocaleString()} · ${junk.gold.toLocaleString()}g)`
    : "Sell all junk ore";
  return `
    <section class="npc-panel crystal-npc-text refiner-panel">
      <p>${G.escapeHtml(npc.panel)} Black iron ore is kept for weapon refining.</p>
      <div class="refiner-actions">
        <button type="button" class="refiner-action-button primary" data-open-weapon-refine>Refine weapon</button>
        <button type="button" class="refiner-action-button" data-head-to-mines>Head to the mines</button>
        <button type="button" class="refiner-action-button"${junk.count > 0 ? "" : " disabled"} data-sell-all-junk-ore>${G.escapeHtml(sellLabel)}</button>
      </div>
    </section>
  `;
}

function weaponRefineSceneHtml() {
  const oreFilled = weaponRefineOreCount();
  const materialFilled = weaponRefineMaterialCount();
  const chancePreview = weaponRefineChancePreview();
  const costPreview = weaponRefineCostPreview();
  const refineFx = weaponRefineResultFxKind();
  const canRefine = weaponRefineBoardReady()
    && chancePreview
    && !chancePreview.autoFail
    && costPreview?.canAfford
    && !refineFx;
  const weaponPickerRows = G.refineEligibleInventoryEntries("weapon")
    .map(({ entry, item }) => weaponRefinePickerRowHtml(entry, item))
    .join("");

  return `
    <section class="npc-panel crystal-npc-text weapon-refine-panel">
      <p class="weapon-refine-intro">
        You can input up to 5 black iron ore and 5 bits of jewellery to refine your weapon.
        Jewellery uses whichever of DC, MC, or SC totals the highest across your pieces:
        +1% per stat for the first 20, +2% for the next 20, then +0.5% beyond that (up to 50% from jewellery).
        Black iron ore and purity add up to 50% more. Best jewellery and ore can reach 100% success through Ref +5.
        From Ref +6 onward, existing refine stats on the weapon reduce success chance.
        Refine costs 50,000 gold per level (+1 costs 50k, +2 costs 100k, and so on). Gold is spent even if the refine fails.
        Failed refines will break the weapon.
      </p>
      <div class="weapon-refine-board">
        <div class="weapon-refine-row weapon-refine-row-weapon">
          <span class="weapon-refine-row-label">Weapon</span>
          ${weaponRefineSlotHtml("weapon", 0, { large: true })}
        </div>
        <div class="weapon-refine-row">
          <span class="weapon-refine-row-label">Ore</span>
          <div class="weapon-refine-slot-row">
            ${Array.from({ length: WEAPON_REFINE_ORE_SLOTS }, (_, index) => weaponRefineSlotHtml("ore", index)).join("")}
          </div>
        </div>
        <div class="weapon-refine-row">
          <span class="weapon-refine-row-label">Jewellery</span>
          <div class="weapon-refine-slot-row">
            ${Array.from({ length: WEAPON_REFINE_MATERIAL_SLOTS }, (_, index) => weaponRefineSlotHtml("material", index)).join("")}
          </div>
        </div>
      </div>
      <p class="weapon-refine-hint">
        Drag black iron ore and jewellery from inventory into the slots.
        Drag out of a slot to remove it.
        Ore ${oreFilled}/${WEAPON_REFINE_ORE_SLOTS} · Jewellery ${materialFilled}/${WEAPON_REFINE_MATERIAL_SLOTS}
      </p>
      <p class="weapon-refine-cost">${G.escapeHtml(weaponRefineCostText(costPreview))}</p>
      <p class="weapon-refine-chance">${G.escapeHtml(weaponRefineChanceText(chancePreview))}</p>
      ${refineFx ? `<p class="weapon-refine-result weapon-refine-result-${G.escapeHtml(refineFx)}">${refineFx === "fail" ? "The weapon shattered…" : refineFx === "crit" ? "Critical refine!" : "Refine successful!"}</p>` : ""}
      <div class="weapon-refine-weapon-picker">
        <p class="weapon-refine-picker-label">Place weapon</p>
        <div class="npc-shop-list weapon-refine-picker" data-preserve-scroll="weapon-refine-picker">
          ${weaponPickerRows || `<span class="trader-empty">No eligible weapons in your bag.</span>`}
        </div>
      </div>
      <div class="weapon-refine-actions">
        <button type="button" class="refiner-action-button primary"${canRefine ? "" : " disabled"} data-attempt-weapon-refine>${costPreview ? `Refine weapon (${costPreview.cost.toLocaleString()}g)` : "Refine weapon"}</button>
      </div>
    </section>
  `;
}

function weaponRefineSlotHtml(kind, index, { large = false } = {}) {
  const picker = state.weaponRefine.picker ?? { kind: "weapon", index: 0 };
  const selected = kind === "weapon" && picker.kind === kind && picker.index === index;
  const refineFx = kind === "weapon" ? weaponRefineResultFxKind() : null;
  const { entry, item } = weaponRefineSlotEntry(kind, index);
  const slotClass = [
    "weapon-refine-slot",
    large ? "weapon-refine-slot-weapon" : "",
    selected ? "selected" : "",
    entry ? "filled" : "",
    kind === "ore" || kind === "material" ? "weapon-refine-slot-drop" : "",
    refineFx ? `weapon-refine-fx-${refineFx}` : "",
    refineFx ? "weapon-refine-fx-active" : "",
  ].filter(Boolean).join(" ");
  const purity = entry && item && kind === "ore" ? `<span class="weapon-refine-purity">P${orePurity(entry, item)}</span>` : "";
  const filledContent = entry && item
    ? `
      <div
        class="weapon-refine-slot-item has-tooltip ${kind === "weapon" ? "" : "weapon-refine-slot-draggable"}"
        ${kind === "weapon" ? "" : `data-refine-board-entry="${G.escapeHtml(entry.id)}" data-refine-board-kind="${G.escapeHtml(kind)}" data-refine-board-index="${index}"`}
        data-tooltip-item="${G.escapeHtml(item.id)}"
        data-tooltip-entry="${G.escapeHtml(entry.id)}"
        title="${G.escapeHtml(G.itemDisplayName(item, entry))}"
      >
        ${G.itemIconMarkup(item)}
        ${purity}
        ${kind === "weapon" && refineFx === "fail" ? `<span class="weapon-refine-crack" aria-hidden="true"></span>` : ""}
      </div>
    `
    : `<span class="weapon-refine-slot-empty">+</span>`;

  if (kind === "weapon") {
    return `
      <button
        type="button"
        class="${slotClass}"
        data-refine-slot="${G.escapeHtml(kind)}"
        data-refine-index="${index}"
        ${refineFx ? "disabled" : ""}
        title="${entry && item ? G.escapeHtml(G.itemDisplayName(item, entry)) : "Select weapon slot"}"
      >${filledContent}</button>
    `;
  }

  return `
    <div
      class="${slotClass}"
      data-refine-slot="${G.escapeHtml(kind)}"
      data-refine-index="${index}"
      title="${kind === "ore" ? "Drop black iron ore here" : "Drop jewellery here"}"
    >${filledContent}</div>
  `;
}

function weaponRefinePickerRowHtml(entry, item) {
  const purity = G.isOreItem(item) ? ` | Purity ${orePurity(entry, item)}` : "";
  const statHint = G.isRefineJewelleryItem(item) ? G.refineJewelleryStatHint(entry, item) : "";
  return `
    <div class="npc-shop-row weapon-refine-picker-row" data-tooltip-item="${G.escapeHtml(item.id)}" data-tooltip-entry="${G.escapeHtml(entry.id)}">
        ${G.itemIconMarkup(item)}
      <span class="npc-shop-item">
        <strong>${G.escapeHtml(G.itemDisplayName(item, entry))}</strong>
        <span>${G.escapeHtml(statHint || G.shopItemMetaText(item))}${purity}</span>
      </span>
      <button type="button" data-refine-pick="${G.escapeHtml(entry.id)}">Place</button>
    </div>
  `;
}

function smithCombineRowHtml(option) {
  const { item, target, material, entries, stat, chance } = option;
  const count = entries.length;
  const keepName = G.itemDisplayName(item, target);
  const consumeName = G.itemDisplayName(item, material);
  const consumeLabel = keepName === consumeName
    ? "plain copy"
    : G.escapeHtml(consumeName);
  return `
    <div class="npc-shop-row smith-combine-row" data-tooltip-item="${G.escapeHtml(item.id)}" data-tooltip-entry="${G.escapeHtml(target.id)}">
        ${G.itemIconMarkup(item)}
      <span class="npc-shop-item">
        <strong>${G.escapeHtml(keepName)}</strong>
        <span>${count} owned | Keeps best | +1 ${G.escapeHtml(stat.label)} | Consumes ${consumeLabel}</span>
      </span>
      <span class="npc-shop-price">${smithChanceText(chance)}</span>
      <button type="button" data-smith-combine="${G.escapeHtml(target.id)}">Combine</button>
    </div>
  `;
}

function hotbarSlotHtml(slot) {
  const entry = hotbarEntryAtSlot(slot);
  const item = entry ? G.itemDefinition(entry.itemId) : null;
  const x = 12 + slot * 35;
  const key = slot + 1;
  const autoSlot = G.autoPotionSlots().includes(slot);
  const itemHtml = item
    ? `
      <button
        class="hotbar-item has-tooltip"
        type="button"
        data-hotbar-use-entry="${entry.id}"
        data-inventory-entry="${entry.id}"
        data-tooltip-item="${G.escapeHtml(item.id)}"
        data-tooltip-entry="${G.escapeHtml(entry.id)}"
        draggable="false"
        title="${G.escapeHtml(G.itemDisplayName(item, entry))}"
      >
        ${G.itemIconMarkup(item)}
        ${G.isStackableItem(item) && entry.quantity > 1 ? `<span class="hotbar-qty">${entry.quantity}</span>` : ""}
      </button>
    `
    : "";
  return `
    <div
      class="hotbar-slot ${item ? "filled" : ""} ${autoSlot ? "auto-slot" : ""}"
      data-hotbar-slot="${slot}"
      style="left:${x}px; top:3px;"
      title="Hotbar ${key}${autoSlot ? " auto potion" : ""}"
    >
      <span class="hotbar-key">${key}</span>
      ${autoSlot ? `<span class="hotbar-auto">Auto</span>` : ""}
      ${itemHtml}
    </div>
  `;
}


G.seedStarterInventory = seedStarterInventory;
G.inventoryPageCount = inventoryPageCount;
G.syncInventoryCapacity = syncInventoryCapacity;
G.mergeBossPartyMemberSpellCooldowns = mergeBossPartyMemberSpellCooldowns;
G.inventoryPageUnlocked = inventoryPageUnlocked;
G.inventoryPageUnlockCost = inventoryPageUnlockCost;
G.unlockInventoryPage = unlockInventoryPage;
G.storagePageCount = storagePageCount;
G.syncStorageCapacity = syncStorageCapacity;
G.storagePageUnlocked = storagePageUnlocked;
G.storagePageUnlockCost = storagePageUnlockCost;
G.unlockStoragePage = unlockStoragePage;
G.buyAccountUpgrade = buyAccountUpgrade;
G.accountUpgradeGoldCost = accountUpgradeGoldCost;
G.accountUpgradeItemCosts = accountUpgradeItemCosts;
G.inventoryItemQuantity = inventoryItemQuantity;
G.accountUpgradeCostText = accountUpgradeCostText;
G.accountUpgradeEffectLabel = accountUpgradeEffectLabel;
G.accountUpgradeCurrentValue = accountUpgradeCurrentValue;
G.accountUpgradeMaxValue = accountUpgradeMaxValue;
G.accountUpgradeProgressText = accountUpgradeProgressText;
G.accountUpgradeRequirementHtml = accountUpgradeRequirementHtml;
G.accountUpgradeSourceText = accountUpgradeSourceText;
G.removeInventoryItemQuantity = removeInventoryItemQuantity;
G.allAccountUpgradeDefs = allAccountUpgradeDefs;
G.accountUpgradesForCategory = accountUpgradesForCategory;
G.addInventoryItem = addInventoryItem;
G.hasInventorySpaceFor = hasInventorySpaceFor;
G.availableInventoryCapacityForItem = availableInventoryCapacityForItem;
G.availableHotbarCapacityForPotion = availableHotbarCapacityForPotion;
G.availablePurchaseCapacityForItem = availablePurchaseCapacityForItem;
G.addPurchasedPotionsToHotbarFirst = addPurchasedPotionsToHotbarFirst;
G.inventoryQuantityForItem = inventoryQuantityForItem;
G.createInventoryEntry = createInventoryEntry;
G.removeInventoryEntry = removeInventoryEntry;
G.consumeOneInventoryUnit = consumeOneInventoryUnit;
G.sellInventoryEntry = sellInventoryEntry;
G.isJunkOreItem = isJunkOreItem;
G.weaponRefineStagedRecord = weaponRefineStagedRecord;
G.weaponRefineEntryById = weaponRefineEntryById;
G.weaponRefineResultFxKind = weaponRefineResultFxKind;
G.weaponRefineResultFxActive = weaponRefineResultFxActive;
G.weaponRefineUsedEntryIds = weaponRefineUsedEntryIds;
G.weaponRefineSlotEntry = weaponRefineSlotEntry;
G.weaponRefineBoardReady = weaponRefineBoardReady;
G.weaponRefineOreCount = weaponRefineOreCount;
G.weaponRefineMaterialCount = weaponRefineMaterialCount;
G.weaponRefineBoardEntries = weaponRefineBoardEntries;
G.weaponRefineExistingStatPenalty = weaponRefineExistingStatPenalty;
G.weaponRefineItemSuccessFromStat = weaponRefineItemSuccessFromStat;
G.weaponRefineGoldCost = weaponRefineGoldCost;
G.weaponRefineCostPreview = weaponRefineCostPreview;
G.weaponRefineChancePreview = weaponRefineChancePreview;
G.weaponRefineChanceText = weaponRefineChanceText;
G.weaponRefineCostText = weaponRefineCostText;
G.smithCombineBonusStatScore = smithCombineBonusStatScore;
G.smithCombineDurabilityScore = smithCombineDurabilityScore;
G.smithCombineEntryPriority = smithCombineEntryPriority;
G.smithCombineWouldConsumeBetterItem = smithCombineWouldConsumeBetterItem;
G.smithCombineOptions = smithCombineOptions;
G.smithUpgradeStat = smithUpgradeStat;
G.smithPreferredUpgradeStatKey = smithPreferredUpgradeStatKey;
G.smithWeaponUpgradeStatKey = smithWeaponUpgradeStatKey;
G.smithBestDefensiveUpgradeStatKey = smithBestDefensiveUpgradeStatKey;
G.smithBestRangeStat = smithBestRangeStat;
G.smithRangeUpgradeStat = smithRangeUpgradeStat;
G.smithRangeStatValue = smithRangeStatValue;
G.smithStatLabel = smithStatLabel;
G.smithCombineSuccessChance = smithCombineSuccessChance;
G.smithChanceText = smithChanceText;
G.equipmentSlotToGemSlot = equipmentSlotToGemSlot;
G.itemIconSrc = itemIconSrc;
G.itemIconMarkup = itemIconMarkup;
G.accountUpgradeById = accountUpgradeById;
G.accountUpgradeUsesRebirthPoints = accountUpgradeUsesRebirthPoints;
G.accountUpgradeTier = accountUpgradeTier;
G.accountUpgradeMaxTier = accountUpgradeMaxTier;
G.accountUpgradeRebirthCost = accountUpgradeRebirthCost;
G.accountUpgradeIsMaxed = accountUpgradeIsMaxed;
G.accountUpgradePurchased = accountUpgradePurchased;
G.accountUpgradeValue = accountUpgradeValue;
G.inventoryEntryAtSlot = inventoryEntryAtSlot;
G.inventoryEntries = inventoryEntries;
G.inventoryUsedSlots = inventoryUsedSlots;
G.inventoryEntryById = inventoryEntryById;
G.storageEntries = storageEntries;
G.storageUsedSlots = storageUsedSlots;
G.storageEntryById = storageEntryById;
G.storageEntryAtSlot = storageEntryAtSlot;
G.equippedSlotForEntry = equippedSlotForEntry;
G.hotbarSlotForEntry = hotbarSlotForEntry;
G.hotbarEntryAtSlot = hotbarEntryAtSlot;
G.hotbarSlotIndex = hotbarSlotIndex;
G.equipStorageEntryToSlot = equipStorageEntryToSlot;
G.orePurity = orePurity;
G.equippedEntry = equippedEntry;
G.inventoryEntrySignature = inventoryEntrySignature;
G.equipInventoryEntry = equipInventoryEntry;
G.equipInventoryEntryToSlot = equipInventoryEntryToSlot;
G.unequipSlot = unequipSlot;
G.equippedVisualItem = equippedVisualItem;
G.accountUpgradeHtml = accountUpgradeHtml;
G.equippedItem = equippedItem;
G.inventorySceneHtml = inventorySceneHtml;
G.storageSceneHtml = storageSceneHtml;
G.inventoryPageTabsHtml = inventoryPageTabsHtml;
G.storagePageTabsHtml = storagePageTabsHtml;
G.storagePageUnlockConfirmHtml = storagePageUnlockConfirmHtml;
G.equipmentSlotHtml = equipmentSlotHtml;
G.inventoryDropTargetAt = inventoryDropTargetAt;
G.inventoryDropTargetAccepts = inventoryDropTargetAccepts;
G.inventoryItemHtml = inventoryItemHtml;
G.itemTooltipHtml = itemTooltipHtml;
G.itemStatsTooltipHtml = itemStatsTooltipHtml;
G.smithNpcSceneHtml = smithNpcSceneHtml;
G.refinerNpcSceneHtml = refinerNpcSceneHtml;
G.weaponRefineSceneHtml = weaponRefineSceneHtml;
G.weaponRefineSlotHtml = weaponRefineSlotHtml;
G.weaponRefinePickerRowHtml = weaponRefinePickerRowHtml;
G.smithCombineRowHtml = smithCombineRowHtml;
G.hotbarSlotHtml = hotbarSlotHtml;
