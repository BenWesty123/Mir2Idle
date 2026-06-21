import { removeRetiredTestingDefaultMagic } from "./sanitizeCharacter.js";

/**
 * @param {object} character
 * @param {string} classId
 * @param {object} [options]
 * @param {number} [options.starterGearVersion]
 * @param {string} [options.taoistClassId]
 * @param {string} [options.starterSwordItemId]
 * @param {(inventory: object, itemId: string, quantity: number) => boolean} [options.backfillStarterItem]
 */
export function backfillStarterGear(character, classId, options = {}) {
  const {
    starterGearVersion = 1,
    taoistClassId = "Taoist",
    starterSwordItemId = "wooden-sword",
    backfillStarterItem = () => false,
  } = options;

  if ((Number(character.game?.starterGearVersion) || 0) >= starterGearVersion) return character;
  if (classId === taoistClassId) backfillStarterItem(character.inventory, starterSwordItemId, 1);
  character.game.starterGearVersion = starterGearVersion;
  return character;
}

/**
 * Restore one character slot from saved data onto a default template.
 *
 * @param {object | null | undefined} savedCharacter
 * @param {string} classId
 * @param {object} defaultCharacter
 * @param {object} options
 * @param {(game: object, fallbackGold: number, classId: string) => object} options.sanitizeGame
 * @param {(inventory: object, hotbar: object, fallbackGold: number) => object} options.sanitizeInventory
 * @param {(hotbar: object, inventory: object) => object} options.sanitizeHotbar
 * @param {(classId: string, magic: object) => object} options.sanitizeMagic
 * @param {(battle: object) => object} options.sanitizeBattle
 * @param {number} [options.starterGearVersion]
 * @param {string} [options.taoistClassId]
 * @param {string} [options.starterSwordItemId]
 * @param {(inventory: object, itemId: string, quantity: number) => boolean} [options.backfillStarterItem]
 */
export function restoreCharacterSnapshot(savedCharacter, classId, defaultCharacter, options) {
  const character = structuredClone(defaultCharacter);
  character.classId = classId;
  if (!savedCharacter || typeof savedCharacter !== "object") return character;

  const fallbackGold = savedCharacter.inventory?.gold ?? character.game.progress.gold;
  character.game = options.sanitizeGame(savedCharacter.game, fallbackGold, classId);
  character.inventory = options.sanitizeInventory(
    savedCharacter.inventory,
    savedCharacter.hotbar,
    character.game.progress.gold,
  );
  character.game.progress.gold = character.inventory.gold;
  character.hotbar = options.sanitizeHotbar(savedCharacter.hotbar, character.inventory);
  character.magic = options.sanitizeMagic(classId, savedCharacter.magic);
  character.battle = options.sanitizeBattle(savedCharacter.battle);
  backfillStarterGear(character, classId, options);
  return character;
}

/**
 * Restore legacy flat snapshot (pre multi-character) into one active character slot.
 *
 * @param {object} snapshot
 * @param {string} classId
 * @param {object} defaultCharacter
 * @param {object} options
 */
export function restoreLegacyCharacterSnapshot(snapshot, classId, defaultCharacter, options) {
  const fallbackGold = snapshot.inventory?.gold ?? snapshot.game?.progress?.gold;
  return restoreCharacterSnapshot(
    {
      game: snapshot.game,
      inventory: snapshot.inventory,
      hotbar: snapshot.hotbar,
      magic: snapshot.magic,
      battle: snapshot.battle,
    },
    classId,
    defaultCharacter,
    {
      ...options,
      sanitizeGame: (game, _gold, id) => options.sanitizeGame(game, fallbackGold, id),
    },
  );
}

/**
 * @param {object} snapshot
 * @param {object} options
 * @param {string[]} options.characterIds
 * @param {(classId: string) => object} options.createDefaultCharacter
 * @param {(classId: unknown) => string} options.normalizeCharacterId
 * @param {(game: object, fallbackGold: number, classId: string) => object} options.sanitizeGame
 * @param {(inventory: object, hotbar: object, fallbackGold: number) => object} options.sanitizeInventory
 * @param {(hotbar: object, inventory: object) => object} options.sanitizeHotbar
 * @param {(classId: string, magic: object) => object} options.sanitizeMagic
 * @param {(battle: object) => object} options.sanitizeBattle
 * @param {number} [options.starterGearVersion]
 * @param {string} [options.taoistClassId]
 * @param {string} [options.starterSwordItemId]
 * @param {(inventory: object, itemId: string, quantity: number) => boolean} [options.backfillStarterItem]
 * @param {Iterable<string>} [options.retiredWizardSpells]
 * @param {string} [options.wizardClassId]
 */
export function restoreCharactersFromSnapshot(snapshot, options) {
  const {
    characterIds,
    createDefaultCharacter,
    normalizeCharacterId,
    retiredWizardSpells = [],
    wizardClassId = "Wizard",
  } = options;

  const characters = Object.fromEntries(
    characterIds.map((classId) => [classId, createDefaultCharacter(classId)]),
  );

  const sanitizeMagicWithRetired = (classId, magic) => {
    const sanitized = options.sanitizeMagic(classId, magic);
    return removeRetiredTestingDefaultMagic(classId, sanitized, {
      wizardClassId,
      retiredSpellIds: retiredWizardSpells,
    });
  };

  const restoreOptions = {
    ...options,
    sanitizeMagic: sanitizeMagicWithRetired,
  };

  if (snapshot.characters && typeof snapshot.characters === "object") {
    for (const classId of characterIds) {
      characters[classId] = restoreCharacterSnapshot(
        snapshot.characters[classId],
        classId,
        characters[classId],
        restoreOptions,
      );
    }
    return characters;
  }

  const activeClassId = normalizeCharacterId(snapshot.battle?.combatClass);
  characters[activeClassId] = restoreLegacyCharacterSnapshot(
    snapshot,
    activeClassId,
    characters[activeClassId],
    restoreOptions,
  );
  return characters;
}
