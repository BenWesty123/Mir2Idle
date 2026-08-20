# Glyph reference (dev only)

> **Private dev sheet** — not shipped to players. Regenerate after glyph changes:
> `npm run glyph:ref`

Last generated: 2026-08-10

## Icon frames for new glyphs

Matching Body Glyph frames **3200–3227 are all in use**. For new glyphs, pick an unused
frame from **[`GLYPH_ICON_POOL.md`](./GLYPH_ICON_POOL.md)** (derived variants starting at
**3230**). Preview: `docs/glyph-variant-preview/index.html`. Generate more with
`npm run glyph:variants` / promote with `npm run glyph:variants:promote`.

## Drop rules

- Empowered bosses: **10%** chance to drop one random glyph.
- Ascended bosses: **15%** chance.
- Equip slots: `glyph`, `glyph2`, `glyph3`, `glyph4`, `glyph5` (5 slots).
- Pool size: **33** glyphs (uniform pick when a drop hits).

## Glyphs

### Warrior

#### Glyph of Blade Momentum

- Item id: `glyph-blade-momentum`
- Class: Warrior
- Level: 35
- Spells: TwinDrakeBlade
- Each Twin Drake Blade hit increases your attack speed by 1 (up to the normal attack-speed limit). Missing, using any other warrior skill, or swinging normally resets the bonus.

#### Glyph of Bulwark Field

- Item id: `glyph-bulwark-field`
- Class: Warrior
- Level: 35
- Spells: ProtectionField
- Protection Field grants a much stronger AC bonus for a short time.

#### Glyph of Flaming Avalanche

- Item id: `glyph-flaming-avalanche`
- Class: Warrior
- Level: 35
- Spells: FlamingSword, BladeAvalanche
- Flaming Sword also unleashes Blade Avalanche. Requires Blade Avalanche learned.

#### Glyph of Flaming Bulwark

- Item id: `glyph-flaming-bulwark`
- Class: Warrior
- Level: 35
- Spells: FlamingSword
- Activating Flaming Sword briefly reduces the damage you take.

#### Glyph of Improved Flaming Sword

- Item id: `glyph-improved-flaming-sword`
- Class: Warrior
- Level: 35
- Spells: FlamingSword
- Flaming Sword burns the enemy for 5 seconds, dealing 50% of the hit as fire damage over time.

#### Glyph of Magical Protection

- Item id: `glyph-magical-protection`
- Class: Warrior
- Level: 35
- Spells: ProtectionField
- Protection Field buffs AMC (MAC) instead of AC.

#### Glyph of Slow Destruction

- Item id: `glyph-slow-destruction`
- Class: Warrior
- Level: 35
- Spells: —
- DC increased by 150%, but attack speed no longer affects you.

#### Glyph of Twin Fury

- Item id: `glyph-twin-fury`
- Class: Warrior
- Level: 35
- Spells: TwinDrakeBlade
- Twin Drake Blade hits much harder, but needs time to recover after each use.

### Wizard

#### Glyph of Battle Wizard

- Item id: `glyph-battle-wizard`
- Class: Wizard
- Level: 35
- Spells: —
- While in melee range of an enemy: +25% armour and damage. At range: −25% armour and damage.

#### Glyph of Deep Frost

- Item id: `glyph-deep-frost`
- Class: Wizard
- Level: 35
- Spells: FrostCrunch
- Frost Crunch is now effective against bosses, but at a significantly reduced rate

#### Glyph of Disruptor Cascade

- Item id: `glyph-disruptor-cascade`
- Class: Wizard
- Level: 35
- Spells: FlameDisruptor
- When Flame Disruptor lands the killing blow, the target explodes and deals that hit's damage to every adjacent enemy. Explosions chain on kills.

#### Glyph of Eternal Firewall

- Item id: `glyph-eternal-firewall`
- Class: Wizard
- Level: 35
- Spells: FireWall
- Fire Wall lasts much longer.

#### Glyph of Frenzied Disruptor

- Item id: `glyph-frenzied-disruptor`
- Class: Wizard
- Level: 35
- Spells: FlameDisruptor
- When Flame Disruptor critically strikes, its casting speed doubles and then fades back to normal over 5 seconds.

#### Glyph of Infinite Mana

- Item id: `glyph-infinite-mana`
- Class: Wizard
- Level: 35
- Spells: —
- You regenerate 5 mana every second.

#### Glyph of Mana Aegis

- Item id: `glyph-mana-aegis`
- Class: Wizard
- Level: 35
- Spells: MagicShield
- Magic Shield is half as effective, and mana is drained before health.

#### Glyph of Many Mirrors

- Item id: `glyph-many-mirrors`
- Class: Wizard
- Level: 35
- Spells: Mirroring
- Mirroring summons three clones (one above and one below). They can only cast Fire Ball.

### Taoist

#### Glyph of Angelic Deva

- Item id: `glyph-angelic-deva`
- Class: Taoist
- Level: 35
- Spells: SummonHolyDeva
- Your Deva no longer attacks. Instead it casts Mass Healing at your proficiency.

#### Glyph of Buffing

- Item id: `glyph-buffing`
- Class: Taoist
- Level: 35
- Spells: UltimateEnhancer
- Ultimate Enhancer also applies Soul Shield and Blessed Armour to the same targets.

#### Glyph of Demonic Deva

- Item id: `glyph-demonic-deva`
- Class: Taoist
- Level: 35
- Spells: SummonHolyDeva
- Your Deva hits harder and attacks multiple enemies at once, but you can no longer cast healing spells.

#### Glyph of Improved Healing Circle

- Item id: `glyph-improved-healing-circle`
- Class: Taoist
- Level: 39
- Spells: HealingCircle
- Healing Circle restore amount scales with your Spirit (SC).

#### Glyph of Instant Healing

- Item id: `glyph-instant-healing`
- Class: Taoist
- Level: 35
- Spells: Healing
- Healing restores health instantly, but only for half the usual amount.

#### Glyph of Pet Might

- Item id: `glyph-pet-might`
- Class: Taoist
- Level: 35
- Spells: SummonSkeleton, SummonShinsu, SummonHolyDeva
- Your pets add your physical power (DC) to their attacks. (Holy Deva base damage is still SC × 2; this glyph adds DC on top.)

#### Glyph of Spirit Wards

- Item id: `glyph-spirit-wards`
- Class: Taoist
- Level: 35
- Spells: SoulShield, BlessedArmour
- Soul Shield and Blessed Armour scale from your Spirit rather than your level.

#### Glyph of the Monk

- Item id: `glyph-monk`
- Class: Taoist
- Level: 35
- Spells: —
- While no pets are summoned: +50% DC and SC.

### All classes

#### Glyph of Critical Strikes

- Item id: `glyph-critical-strikes`
- Class: All classes
- Level: 35
- Spells: —
- Base critical strike damage is doubled, but Luck no longer affects you.

#### Glyph of Efficient Learning

- Item id: `glyph-efficient-learning`
- Class: All classes
- Level: 35
- Spells: —
- Spell skill practice experience gain is increased by 100%.

#### Glyph of Fast Healing

- Item id: `glyph-fast-healing`
- Class: All classes
- Level: 35
- Spells: —
- HP potions heal 25% faster, but restore 50% less.

#### Glyph of Glass Canon

- Item id: `glyph-glass-canon`
- Class: All classes
- Level: 35
- Spells: —
- Damage done increased by 50%. Damage taken increased by 100%.

#### Glyph of Gold

- Item id: `glyph-gold`
- Class: All classes
- Level: 35
- Spells: —
- Gold drops from monsters and bosses are increased by 100%.

#### Glyph of Revival

- Item id: `glyph-revival`
- Class: All classes
- Level: 35
- Spells: —
- Revives you to full health once, then breaks.

#### Glyph of Tank

- Item id: `glyph-tank`
- Class: All classes
- Level: 35
- Spells: —
- Damage taken decreased by 25%. Damage done decreased by 50%.

#### Glyph of the Hero

- Item id: `glyph-hero`
- Class: All classes
- Level: 35
- Spells: —
- You take all damage your party members would receive.

#### Glyph of Vitality

- Item id: `glyph-vitality`
- Class: All classes
- Level: 35
- Spells: —
- Maximum health is doubled, but you cannot use Sun Potions (or similar restoratives).

