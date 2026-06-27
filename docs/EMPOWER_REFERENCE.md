# Empower reference (dev only)

> **Private dev sheet** — not shipped to players. Regenerate after table changes:
> `npm run empower:ref`

Last generated: 2026-06-27

## System overview

- Boss fights can be empowered (rebirth upgrade + 100k gold) for doubled boss drop rates.
- Equippable boss loot: **10%** chance to become empowered (`BOSS_EMPOWER_ITEM_CHANCE`; dev may override via `BOSS_EMPOWER_ITEM_CHANCE_DEV`).
- Tier roll (unique stats per item): 1× 60%, 2× 30%, 3× 7.5%, 4× 2.5%.
- Item name suffix: one `*` per empowerment tier (max 4).
- Flat stats live on `empowerBonusStats`; spell bonuses on `empowerSpellBonuses`.

## Weapon classes

- Weapons are classified by base DC / MC / SC (gems, smith, and empower bonuses ignored).
- Warrior weapon — DC only. Wizard weapon — DC + MC. Tao weapon — DC + SC. Universal weapon — DC + MC + SC.
- Warrior and Universal weapons roll DC empower plus Acc, A Speed, Freezing, and Poison.
- Warrior weapons also roll warrior skill damage and Flaming Sword cooldown empowers.
- Wizard and Universal weapons roll MC empower; MC weapons also roll wizard spell damage and mana cost empowers.
- Tao and Universal weapons roll SC empower; SC weapons also roll tao spell healing, damage, and pet damage empowers.
- All weapons may roll gold drop, bonus XP, item drop chance, and Awakening Soul drop chance empowers.
- Luck — all weapon classes.

### Warrior weapon

Base DC only — no MC or SC.

- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

### Wizard weapon

Base DC + MC — no SC.

- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

### Tao weapon

Base DC + SC — no MC.

- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

### Universal weapon

Base DC + MC + SC.

- +1–5 DC
- +1–3 MC
- +1–3 SC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

## Spell-specific empowers

| Spell | Requirement | Roll | Combat hook |
| --- | --- | --- | --- |
| Flame Disruptor | Wizard or Universal weapon (base MC) | +10–35% damage | `applyEquippedSpellDamageBonus` |

## Other slot roll tables

### Armour

Slots: `armour`, `dress`

- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

### Helmet

Slots: `helmet`

- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

### Bracelet

Slots: `bracelet`

- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

### Ring

Slots: `ring`

- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

### Belt / Boots

Slots: `belt`, `boots`

- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

### Stone

Slots: `stone`

- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

### Other

Slots: `necklace`

Legacy level-scaled rolls from each item's base stats (no fixed table yet).

## Per-item candidate pools

Grouped by slot. Weapons show their class and actual roll pool from `empowerCandidateRolls()`.

### Armour

**Base Dress** (`base-dress`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Light Armour** (`light-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Solid Armour** (`solid-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Bone Robe** (`bone-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Medium Armour** (`medium-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Crystal Armour** (`crystal-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Mir Armour (F)1** (`mir-armour-f-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Mir Armour (F)2** (`mir-armour-f-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Mir Armour (F)3** (`mir-armour-f-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Mir Armour (M)1** (`mir-armour-m-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Mir Armour (M)2** (`mir-armour-m-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Mir Armour (M)3** (`mir-armour-m-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Heavy Armour** (`heavy-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Heavy Armour (F)** (`heavy-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Magic Robe** (`magic-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Magic Robe (F)** (`magic-robe-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Soul Armour** (`soul-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Soul Armour (F)** (`soul-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Fire Magic Robe (F)** (`fire-magic-robe-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Fire Magic Robe (M)** (`fire-magic-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tao Armour** (`tao-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tao Armour (F)** (`tao-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Thick Armour (F)** (`thick-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Thick Armour (M)** (`thick-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Fine Iron Armour (F)** (`fine-iron-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Fine Iron Armour (M)** (`fine-iron-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Fire Robe (F)** (`fire-robe-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Fire Robe (M)** (`fire-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Iron Armour** (`iron-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Iron Armour (F)** (`iron-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Pearl Armour** (`pearl-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Pearl Armour (F)** (`pearl-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Witch Robe (F)** (`witch-robe-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Wizard Robe** (`wizard-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Ying Yang Robe (F)** (`ying-yang-robe-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Ying Yang Robe (M)** (`ying-yang-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Dragon Armor (F)1** (`black-dragon-armor-f-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Dragon Armor (F)2** (`black-dragon-armor-f-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Dragon Armor (F)3** (`black-dragon-armor-f-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Dragon Armor (M)1** (`black-dragon-armor-m-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Dragon Armor (M)2** (`black-dragon-armor-m-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Dragon Armor (M)3** (`black-dragon-armor-m-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Dragon Robe** (`dragon-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Dragon Robe (F)** (`dragon-robe-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Heaven Armour** (`heaven-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Royal Armour (F)** (`royal-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Royal Armour (M)** (`royal-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Steel Armour** (`steel-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Steel Armour (F)** (`steel-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Studded Armour (F)** (`studded-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Studded Armour (M)** (`studded-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Titan Armour** (`titan-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Titan Armour (F)** (`titan-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Blue Dark Armour (F)** (`blue-dark-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Blue Dark Armour (M)** (`blue-dark-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Green Dark Armour (F)** (`green-dark-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Green Dark Armour (M)** (`green-dark-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Red Dark Armour (F)** (`red-dark-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Red Dark Armour (M)** (`red-dark-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Tiger Armour (F)** (`black-tiger-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Black Tiger Armour (M)** (`black-tiger-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Crane Armour (F)** (`crane-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Crane Armour (M)** (`crane-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Lotus Armour (F)** (`lotus-armour-f`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Lotus Armour (M)** (`lotus-armour`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe** (`oma-king-robe`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe (F)1** (`oma-king-robe-f-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe (F)2** (`oma-king-robe-f-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe (F)3** (`oma-king-robe-f-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe (M)1** (`oma-king-robe-m-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe (M)2** (`oma-king-robe-m-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Oma King Robe (M)3** (`oma-king-robe-m-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tarragon Armour (F)1** (`tarragon-armour-f-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tarragon Armour (F)2** (`tarragon-armour-f-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tarragon Armour (F)3** (`tarragon-armour-f-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tarragon Armour (M)1** (`tarragon-armour-m-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tarragon Armour (M)2** (`tarragon-armour-m-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Tarragon Armour (M)3** (`tarragon-armour-m-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Raiders Armour (F)1** (`raiders-armour-f-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Raiders Armour (F)2** (`raiders-armour-f-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Raiders Armour (F)3** (`raiders-armour-f-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Raiders Armour (M)1** (`raiders-armour-m-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Raiders Armour (M)2** (`raiders-armour-m-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Raiders Armour (M)3** (`raiders-armour-m-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Gonryunyongdrama (?) (F)1** (`gonryunyongdrama-f-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Gonryunyongdrama (?) (F)2** (`gonryunyongdrama-f-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Gonryunyongdrama (?) (F)3** (`gonryunyongdrama-f-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Gonryunyongdrama (?) (M)1** (`gonryunyongdrama-m-1`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Gonryunyongdrama (?) (M)2** (`gonryunyongdrama-m-2`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

**Gonryunyongdrama (?) (M)3** (`gonryunyongdrama-m-3`)
- +1–5 AC
- +1–5 AMC
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +10–100 HP (step 10)
- +10–100 MP (step 10)
- +1–3 Agi
- +5–20% Bonus XP

### Belt / Boots

**Leather Belt** (`leather-belt`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Strong Leather Belt** (`strong-leather-belt`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Chain Belt** (`chain-belt`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Steel Buckle** (`steel-buckle`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Bronze Strap** (`bronze-strap`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Black Iron Belt** (`black-iron-belt`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Steel Belt** (`steel-belt`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Gold Belt** (`gold-belt`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Low Shoes** (`low-shoes`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Leather Boots** (`leather-boots`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Silk Boots** (`silk-boots`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Black Boots** (`black-boots`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

**Dragon Boots** (`dragon-boots`)
- +1–3 AC
- +1–3 AMC
- +1–2 DC
- +1–2 SC
- +1–2 MC
- +1–2 Agi
- +1–2 Acc
- +1 Poison Resist
- +1 Magic Resist
- +10–30 HP (step 10)
- +10–30 MP (step 10)

### Bracelet

**3rd Eye Bracelet** (`3rd-eye-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Dragon Bracelet** (`dragon-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Knight Bracelet** (`knight-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Soul Spring Bracelet** (`soul-spring-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Strain Bracelet** (`strain-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Iron Bracelet** (`iron-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Worn Iron Bracelet** (`worn-iron-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Thin Bracelet** (`thin-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Leather Glove** (`leather-glove`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Silver Bracelet** (`silver-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Steel Bangle** (`steel-bangle`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Steel Bracelet** (`steel-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Large Bracelet** (`large-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Mundane Glove** (`mundane-glove`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Nok Chi Wheel** (`nok-chi-wheel`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Tao Protect Bracelet** (`tao-protect-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Spirit Bracelet** (`spirit-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Sharp Bracelet** (`sharp-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Hard Glove** (`hard-glove`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Magic Bracelet** (`magic-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Ebony Bracelet** (`ebony-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Evade Bracelet** (`evade-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Monk Bangle** (`monk-bangle`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Monk Bracelet** (`monk-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Death Gauntlet** (`death-gauntlet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Gold Bracelet** (`gold-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Nephrite Bracelet** (`nephrite-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Bug Bracelet** (`bug-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Bronze Glove** (`bronze-glove`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Spell Bracelet** (`spell-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Black Iron Bracelet** (`black-iron-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Steel Glove** (`steel-glove`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Bracer Of Magic** (`bracer-of-magic`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Hwan Devil Bracelet** (`hwan-devil-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Smash Wheel** (`smash-wheel`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Tao Power Bracelet** (`tao-power-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Five String Bracelet** (`five-string-bracelet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**8 Trigram Wheel** (`8-trigram-wheel`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Bok Ma Wheel** (`bok-ma-wheel`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Hang Ma Wheel** (`hang-ma-wheel`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Steel Gauntlet** (`steel-gauntlet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Baek Ta Glove** (`baek-ta-glove`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Holy Tao Wheel** (`holy-tao-wheel`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Spirit Reformer** (`spirit-reformer`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Dual Titan Amulet** (`dual-titan-amulet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Evil Whisp Amulet** (`evil-whisp-amulet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

**Sacred Angel Amulet** (`sacred-angel-amulet`)
- +1–2 AC
- +1–2 AMC
- +1–4 DC
- +1–3 SC
- +1–3 MC
- +1 Poison Resist
- +1 Magic Resist
- +1–3 Agi
- +1–3 Acc

### Helmet

**Black Iron Helmet** (`black-iron-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Skeleton Helmet** (`skeleton-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Bronze Helmet** (`bronze-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Superior Bronze Helmet** (`superior-bronze-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Bone Hood** (`bone-hood`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Magic Helmet** (`magic-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Superior Magic Helmet** (`superior-magic-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Brass Helmet** (`brass-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Shaman Helmet** (`shaman-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Steel Helmet** (`steel-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Helmet Of Hero** (`helmet-of-hero`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Great Helmet** (`great-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Royal Helmet** (`royal-helmet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Tao Coronet** (`tao-coronet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

**Wisdom Coronet** (`wisdom-coronet`)
- +1–3 AC
- +1–3 AMC
- +1–3 DC
- +1–2 MC
- +1–2 SC
- +10–20 HP (step 10)
- +10–20 MP (step 10)

### material

**Awakening Soul** (`awakening-soul`)
- +AC

**Black Iron Ore** (`black-iron-ore`)
- +AC

**Copper Ore** (`copper-ore`)
- +AC

**Ghoul Heart** (`ghoul-heart`)
- +AC

**Gold Bar** (`gold-bar`)
- +AC

**Gold Ore** (`gold-ore`)
- +AC

**Large Bone** (`large-bone`)
- +AC

**Silver Ore** (`silver-ore`)
- +AC

**Wooma Heart** (`wooma-heart`)
- +AC

**Zuma Relic** (`zuma-relic`)
- +AC

### Other

**Amethyst Necklace** (`amethyst-necklace`) (legacy)
- +DC
- +DC

**Blue Thunder Necklace** (`blue-thunder-necklace`) (legacy)
- +MC
- +MC

**Demon Mask** (`demon-mask`) (legacy)
- +DC
- +DC

**Demonic Bells** (`demonic-bells`) (legacy)
- +MC

**Elusion Necklace** (`elusion-necklace`) (legacy)
- +Agi

**Green Bead** (`green-bead`) (legacy)
- +DC
- +DC

**Kunroon Tear** (`kunroon-tear`) (legacy)
- +DC
- +DC
- +SC
- +SC

**Life Necklace** (`life-necklace`) (legacy)
- +MC
- +MC

**Pearl Necklace** (`pearl-necklace`) (legacy)
- +SC
- +SC

**Platinum Necklace** (`platinum-necklace`) (legacy)
- +MC

**Soul Necklace** (`soul-necklace`) (legacy)
- +SC
- +SC

**Spirit Power Necklace** (`spirit-power-necklace`) (legacy)
- +SC
- +SC

**Tiger Necklace** (`tiger-necklace`) (legacy)
- +SC

**Violet Orb** (`violet-orb`) (legacy)
- +MC
- +MC

**Gold Necklace** (`gold-necklace`) (legacy)
- +Agi

**Golden Pendant** (`golden-pendant`) (legacy)
- +Agi

**Precision Necklace** (`precision-necklace`) (legacy)
- +Acc

**Precision Pendant** (`precision-pendant`) (legacy)
- +DC

**Black Crystal Pendant** (`black-crystal-pendant`) (legacy)
- +DC
- +DC

**Black Necklace** (`black-necklace`) (legacy)
- +DC

**Ebony Necklace** (`ebony-necklace`) (legacy)
- +MC

**Yellow Crystal Pendant** (`yellow-crystal-pendant`) (legacy)
- +SC
- +SC

**Yellow Necklace** (`yellow-necklace`) (legacy)
- +SC

**Jade Necklace** (`jade-necklace`) (legacy)
- +SC
- +SC

**Spirit Necklace** (`spirit-necklace`) (legacy)
- +SC

**Skill Necklace** (`skill-necklace`) (legacy)
- +HP
- +Acc

**Amber Necklace** (`amber-necklace`) (legacy)
- +MC

**Naga Necklace** (`naga-necklace`) (legacy)
- +DC

**Phoenix Bead** (`phoenix-bead`) (legacy)
- +SC
- +SC

**Worn Bead of Phoenix** (`worn-bead-of-phoenix`) (legacy)
- +SC
- +SC

**Lantern Necklace** (`lantern-necklace`) (legacy)
- +DC

**Gale Necklace** (`gale-necklace`) (legacy)
- +DC
- +A Speed

**Blue Crystal Necklace** (`blue-crystal-necklace`) (legacy)
- +MC
- +MC

**Warrior Necklace** (`warrior-necklace`) (legacy)
- +DC
- +DC

**Blue Jade Necklace** (`blue-jade-necklace`) (legacy)
- +DC
- +DC

**Nephrite Necklace** (`nephrite-necklace`) (legacy)
- +SC
- +SC

**Bamboo Pipe** (`bamboo-pipe`) (legacy)
- +SC
- +SC

**Claw Necklace** (`claw-necklace`) (legacy)
- +DC

**Convex Lens** (`convex-lens`) (legacy)
- +MC
- +MC

**Strong Bamboo Flute** (`strong-bamboo-flute`) (legacy)
- +SC

**Five String Necklace** (`five-string-necklace`) (legacy)
- +MC
- +MC

**Hwan Devil Necklace** (`hwan-devil-necklace`) (legacy)
- +MC
- +MC

**Smash Pendulum** (`smash-pendulum`) (legacy)
- +DC

**Adamantine Necklace** (`adamantine-necklace`) (legacy)
- +MC
- +MC

**Hero Necklace** (`hero-necklace`) (legacy)
- +DC
- +DC

**Requiem Necklace** (`requiem-necklace`) (legacy)
- +DC
- +SC
- +SC

**Cuspid Necklace** (`cuspid-necklace`) (legacy)
- +DC
- +DC

**Purified Mirror** (`purified-mirror`) (legacy)
- +DC
- +DC
- +SC
- +SC

**Sorcery Anchor** (`sorcery-anchor`) (legacy)
- +MC
- +MC

### Ring

**Boundless Ring** (`boundless-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Cloud Ring** (`cloud-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Dragon Ring** (`dragon-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Evil Slayer Ring** (`evil-slayer-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Iron Ring** (`iron-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Jade Snow Ring** (`jade-snow-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Platinum Ring** (`platinum-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Poison Ring** (`poison-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Power Ring** (`power-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Red Demon Ring** (`red-demon-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Ruby Ring** (`ruby-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Skeleton Ring** (`skeleton-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Tae Guk Ring** (`tae-guk-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Thunder Ring** (`thunder-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Titan Ring** (`titan-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Violet Ring** (`violet-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**White Jade Ring** (`white-jade-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Copper Ring** (`copper-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Old Copper Ring** (`old-copper-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Glass Ring** (`glass-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Hexagonal Ring** (`hexagonal-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Horn Ring** (`horn-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Mundane Ring** (`mundane-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Nok Chi Ring** (`nok-chi-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Tao Protect Ring** (`tao-protect-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Spirit Ring** (`spirit-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Blue Ring** (`blue-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Gale Ring** (`gale-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Paralysis Ring** (`paralysis-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Protection Ring** (`protection-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Recovery Ring** (`recovery-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Black Ring** (`black-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Gold Ring** (`gold-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Pearl Ring** (`pearl-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Serpent Eye Ring** (`serpent-eye-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Charm Ring** (`charm-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Moral Ring** (`moral-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Nephrite Ring** (`nephrite-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Bug Ring** (`bug-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Coral Ring** (`coral-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Expel Ring** (`expel-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Twin Gold Ring** (`twin-gold-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Hwan Devil Ring** (`hwan-devil-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Purity Ring** (`purity-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Red Orchid Ring** (`red-orchid-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Smash Ring** (`smash-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Five String Ring** (`five-string-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Noble Ring** (`noble-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Oma Spirit Ring** (`oma-spirit-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Soul Ring** (`soul-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Crimson Ruby Ring** (`crimson-ruby-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Five Element Ring** (`five-element-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

**Pledge Ring** (`pledge-ring`)
- +1–6 DC
- +1–4 MC
- +1–4 SC
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–3 AC
- +1–3 AMC

### Stone

**DCStone** (`dcstone`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Health Stone** (`health-stone`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Power Stone** (`power-stone`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Health Stone (S)** (`health-stone-s`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Magic Stone (S)** (`magic-stone-s`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Power Stone (S)** (`power-stone-s`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**DCStone (S)** (`dcstone-s`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**MCStone (S)** (`mcstone-s`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**SCStone (S)** (`scstone-s`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Health Stone (M)** (`health-stone-m`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Magic Stone (M)** (`magic-stone-m`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**Power Stone (M)** (`power-stone-m`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**DCStone (M)** (`dcstone-m`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**MCStone (M)** (`mcstone-m`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**SCStone (M)** (`scstone-m`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**DCStone (L)** (`dcstone-l`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**MCStone (L)** (`mcstone-l`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**SCStone (L)** (`scstone-l`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**DCStone (XL)** (`dcstone-xl`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**MCStone (XL)** (`mcstone-xl`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

**SCStone (XL)** (`scstone-xl`)
- +1–3 DC
- +1–3 SC
- +1–3 MC
- +1–2 AC
- +1–2 AMC

### Weapon

**Blood Stealer Sword** (`blood-stealer-sword`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Wooden Sword** (`wooden-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Dagger** (`dagger`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Sharp Dagger** (`sharp-dagger`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Ebony Sword** (`ebony-sword`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Bronze Sword** (`bronze-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bronze Warrior Sword** (`bronze-warrior-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bronze Short Sword** (`bronze-short-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Short Sword** (`short-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Broken Sword** (`broken-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Iron Sword** (`iron-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bone Decapitator** (`bone-decapitator`) (Universal weapon)
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Pickaxe** (`pickaxe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bronze Axe** (`bronze-axe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Solid Bronze Axe** (`solid-bronze-axe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Hooked Sword** (`hooked-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Scimitar** (`scimitar`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Sharp Scimitar** (`sharp-scimitar`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Sharp Sword** (`sharp-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Sharp Trident** (`sharp-trident`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Trident** (`trident`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Steel Axe** (`steel-axe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Hard Steel Sword** (`hard-steel-sword`)
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance

**Steel Sword** (`steel-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Hooked Spear** (`hooked-spear`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Keen Kriss Sword** (`keen-kriss-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Kriss Sword** (`kriss-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Martial Sabre** (`martial-sabre`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Martial Sword** (`martial-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Mir Sword1** (`mir-sword1`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Mir Sword2** (`mir-sword2`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Mir Sword3** (`mir-sword3`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Prince Dagger** (`prince-dagger`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Spear With Hook** (`spear-with-hook`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Spirit Blade1** (`spirit-blade1`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Spirit Blade2** (`spirit-blade2`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Spirit Blade3** (`spirit-blade3`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Power Axe** (`power-axe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Purifier Sword** (`purifier-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Great Axe** (`great-axe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Mage Staff** (`mage-staff`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Serpent Sword** (`serpent-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Solid Bronze Staff** (`solid-bronze-staff`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Solid Great Axe** (`solid-great-axe`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Solid Serpent Sword** (`solid-serpent-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Fire Blood Sword** (`fire-blood-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Zuma Judgement Mace** (`zuma-judgement-mace`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Zuma Soul Spring Wand** (`zuma-soul-spring-wand`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Zuma War Mage Staff** (`zuma-war-mage-staff`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Blades Of Darkness** (`blades-of-darkness`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Dragon Sword** (`dragon-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Fiend Bow** (`fiend-bow`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Judgement Mace** (`judgement-mace`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Soul Spring Wand** (`soul-spring-wand`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**War Mage Staff** (`war-mage-staff`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Black Dragon Slayer** (`black-dragon-slayer`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Black Dragon Soul Sabre** (`black-dragon-soul-sabre`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Black Dragon Staff** (`black-dragon-staff`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Red Moon Sword** (`red-moon-sword`) (Universal weapon)
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Freezing Blades** (`freezing-blades`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Lithe Bow** (`lithe-bow`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Magic Scythe** (`magic-scythe`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Stone Bamboo Fan** (`stone-bamboo-fan`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**War Spirit Blade** (`war-spirit-blade`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Dragon Slayer** (`dragon-slayer`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Dragon Staff** (`dragon-staff`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Malefic Bow** (`malefic-bow`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Royal Blades** (`royal-blades`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Soul Sabre** (`soul-sabre`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Blade Of Sorcery** (`blade-of-sorcery`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Blades Of Magi** (`blades-of-magi`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bow Of Force** (`bow-of-force`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Heaven Sword** (`heaven-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Sword Of War God** (`sword-of-war-god`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bastard Sword** (`bastard-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Burst Sword** (`burst-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Conqueror Spear** (`conqueror-spear`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Dragon Blood Sword** (`dragon-blood-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Frozen Sabre** (`frozen-sabre`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Holy Blood Spear** (`holy-blood-spear`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Black Tiger Hammer** (`black-tiger-hammer`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Fan Of Crane** (`fan-of-crane`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Staff Of Lotus** (`staff-of-lotus`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Hell Yama Blade1** (`hell-yama-blade1`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Hell Yama Blade2** (`hell-yama-blade2`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Hell Yama Blade3** (`hell-yama-blade3`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Bluish Green Blood Slaughter Pike** (`bluish-green-blood-slaughter-pike`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Gon Ryun Holy Light Sword (?)1** (`gon-ryun-holy-light-sword-1`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Gon Ryun Holy Light Sword (?)2** (`gon-ryun-holy-light-sword-2`) (Wizard weapon)
- +1–3 MC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

**Gon Ryun Holy Light Sword (?)3** (`gon-ryun-holy-light-sword-3`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Barbarian Sword** (`barbarian-sword`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Bone Carved Fan** (`bone-carved-fan`)
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Ice Dragon Sky Knife** (`ice-dragon-sky-knife`) (Warrior weapon)
- +1–5 DC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Slaying damage by 5–35%
- Increase Flaming Sword damage by 5–25%
- Reduce Flaming Sword cooldown by 1–5 seconds
- Increase Twin Drake Blade damage by 5–25%

**Ice Dragon Sky Rod** (`ice-dragon-sky-rod`) (Universal weapon)
- +1–5 DC
- +1–3 MC
- +1–3 SC
- +1–3 Acc
- +1–2 A Speed
- +1–2 Freezing
- +1–2 Poison
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Ice Dragon Sky Sword** (`ice-dragon-sky-sword`) (Tao weapon)
- +1–3 SC
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Healing healing by 5–25%
- Increase Mass Healing healing by 5–25%
- Increase Soul Fire Ball damage by 10–35%
- Increase Skeleton damage by 10–50%
- Increase Shinsu damage by 10–50%

**Raw Sword** (`raw-sword`)
- +1–2 Luck
- +5–25% Gold drop
- +1–5% Bonus XP
- +0%–2% Item drop chance
- +5–25% Awakening Soul drop chance
- Increase Flame Disruptor damage by 10–35%
- Increase Fire Wall damage by 5–25%
- Increase Thunder Bolt damage by 10–35%
- Increase Ice Storm damage by 5–25%
- Reduce mana cost of Flame Disruptor by 10–40%
- Reduce mana cost of Fire Wall by 10–40%

## Still TODO / notes

- Necklace: legacy rolls only — fixed table not defined.
- Wizard/Tao-specific empower pools (beyond damage + spell) not started.
- More spell-specific empowers (MP cost, etc.) not started.
- `BOSS_EMPOWER_SKIP_REBIRTH_UNLOCK` may still be `true` for dev testing.
- Set `BOSS_EMPOWER_ITEM_CHANCE_DEV` to `null` before release.
