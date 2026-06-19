# Solo Play and Future Season Play

The current prototype should keep moving as Solo Play: local save, fast iteration,
and no server dependency for ordinary testing.

Future Season Play should be treated as a separate verified mode. In Season Play,
the server must own the real character state and the client should only send
player intentions.

## Core Rule

Never trust browser-owned Season state for leaderboard progress.

The client must not submit final stats, edited item stats, gold totals, XP totals,
or invented inventory. It should only submit actions such as:

- create a season character
- enter a zone
- equip an owned item instance
- toggle or queue a skill
- use a potion
- buy or sell an item
- combine duplicate equipment
- claim server-calculated offline progress

The server should validate ownership, requirements, drop rolls, combat outcomes,
XP, gold, inventory, and equipped item stats from server-owned data.

## Solo Play

Solo Play can continue using local saves. It can remain flexible and easy to
test, even if players can edit their own local state.

Solo Play progress should not be treated as verified leaderboard progress.

## Season Play

Season Play should store server-owned state, likely including:

- character class, level, XP, HP, MP, gold, and playtime
- inventory item instances
- equipped item instance IDs
- learned skills and skill levels
- active zone and offline timestamp
- potion and hotbar state
- smith/refine results

Item instances should store IDs and server-owned modifiers, not client-provided
final stats.

Example:

```json
{
  "instanceId": "item_12345",
  "baseItemId": "steel-sword",
  "refineLevel": 2,
  "bonusStats": {
    "dc": [0, 1]
  }
}
```

The server should calculate the final item stats from the item database,
refine level, and server-owned bonus stats.

## How To Keep Current Work Season-Ready

When adding new Solo Play features, prefer:

- shared data files for items, monsters, zones, drops, spells, and XP
- pure rule functions for combat, drops, potion ticks, smith chances, and XP
- UI handlers that call rules rather than containing all rules inline
- save-state code that stays separate from gameplay rules
- deterministic enough logic that a server can later run the same calculations

This does not mean Season Play must be built now. It just keeps the path open.
