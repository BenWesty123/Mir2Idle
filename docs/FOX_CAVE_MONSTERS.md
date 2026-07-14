# Fox Cave — Crystal monster roster

Source: Crystal `Fox01` / `Fox02` / `Fox03` maps + `crystal-monsters.json` + `Envir\Drops\MongchonProvince\Fox\`.

Region: **Mongchon Province**. Three connected maps:

| Map file | Title | Role |
|----------|-------|------|
| `Fox01` | Sealed Maze | Outer floors |
| `Fox02` | Sacred Fox Hill | Mid floors |
| `Fox03` | Sacred Fox Temple | Inner temple / boss room |

Crystal does **not** set `isBoss: true` on any of these. In practice:

- **Great Fox Spirit** (single spawn on Fox03, 15k HP / 30k XP) is the real temple boss.
- Our idle dungeon gallery currently lists **Red Fox Man** as the Fox Cave boss (Lv 55).

---

## At a glance (by map)

Counts are total Crystal respawn slots (`count` summed across all respawn entries).

### Fox01 — Sealed Maze

| Count | Monster | Lv | Notes |
|------:|---------|---:|-------|
| 202 | Black Fox Man | 55 | Core fox |
| 200 | White Fox Man | 55 | Core fox |
| 160 | Red Fox Man | 55 | Core fox |
| 128 | Electric Element | 37 | Core fox support |
| 95 | Cloud Element | 39 | Core fox support |
| 38 | Brown Frog Spider | 43 | Insect Cave spillover |
| 28 | Big Hedge Kek Tal | 40 | Insect Cave spillover |
| 28 | Hedge Kek Tal | 38 | Insect Cave spillover |
| 24 | Red Frog Spider | 35 | Insect Cave spillover |
| 9 | Trap Rock | 52 | Core fox |

### Fox02 — Sacred Fox Hill

| Count | Monster | Lv | Notes |
|------:|---------|---:|-------|
| 376 | Black Fox Man | 55 | Core fox |
| 370 | White Fox Man | 55 | Core fox |
| 270 | Red Fox Man | 55 | Core fox |
| 230 | Cloud Element | 39 | Core fox support |
| 174 | Electric Element | 37 | Core fox support |
| 62 | Trap Rock | 52 | Core fox |
| 40 | Red Frog Spider | 35 | Insect Cave spillover |
| 30 | Hedge Kek Tal | 38 | Insect Cave spillover |
| 30 | Brown Frog Spider | 43 | Insect Cave spillover |
| 30 | Big Hedge Kek Tal | 40 | Insect Cave spillover |
| 1 | Trap Rock 1 | 52 | Core fox (variant) |

### Fox03 — Sacred Fox Temple

| Count | Monster | Lv | Notes |
|------:|---------|---:|-------|
| 40 | Red Fox Man | 55 | Core fox |
| 40 | Black Fox Man | 55 | Core fox |
| 40 | White Fox Man | 55 | Core fox |
| 7 | Cloud Element | 39 | Core fox support |
| 7 | Electric Element | 37 | Core fox support |
| 4 | Guardian Rock | 52 | Fixed positions around temple |
| **1** | **Great Fox Spirit** | **60** | **Temple boss** |

---

## Core Fox Cave monsters

Drop tables under `MongchonProvince\Fox\…`.

### Red Fox Man

| Field | Value |
|-------|-------|
| Crystal index | 216 |
| Image | 128 |
| Level | 55 |
| HP | 800 |
| XP | 5000 |
| AC / AMC | 5 / 15 |
| DC / MC | 40–75 / 30 |
| Acc / Agi | 16 / 16 |
| Attack / move | 1800 / 800 ms |
| Role | High magic damage fox; listed as idle “Fox Cave boss” |

Notable drops: Nephrite / Red Jade belts & shoes, Red Scale Boots, Flame Disruptor, Frost Crunch, Magic Drug (S), Admission Orb.

### Black Fox Man

| Field | Value |
|-------|-------|
| Crystal index | 217 |
| Image | 127 |
| Level | 55 |
| HP | 1500 |
| XP | 5000 |
| AC / AMC | 20 / 5 |
| DC | 10–65 |
| Acc / Agi | 5 / 8 |
| Attack / move | 2200 / 1200 ms |
| Role | Tankier physical fox; densest spawn on Fox01/02 |

Notable drops: Great Axe, Serpent Sword, Mage Staff, Double Blades, Requiem / Red Jade / Five String necklaces, Tao Power Bracelet, Red Jade / Nok Chi rings, Black / Dragon Boots, Bronze / Steel belts, warrior books (Protection Field, Twin Drake Blade, Lion Roar, Blade Avalanche, etc.).

### White Fox Man

| Field | Value |
|-------|-------|
| Crystal index | 218 |
| Image | 129 |
| Level | 55 |
| HP | 1200 |
| XP | 5200 |
| AC / AMC | 10 / 25 |
| DC | 25–55 |
| Acc / Agi | 16 / 16 |
| Attack / move | 2200 / 1500 ms |
| Role | Mid fox; **Blue Fox set** source |

Notable drops: Blue Fox Collar / Bracelet / Ring, Hero / Purity / Hwan Devil necklaces, Silk Boots, Adamantine Belt, Taoist books (Vampirism, Summon Holy Deva, Hallucination, Purification, Swift Feet).

### Trap Rock / Trap Rock 1

| Field | Trap Rock | Trap Rock 1 |
|-------|-----------|-------------|
| Crystal index | 219 | 220 |
| Image | 130 | 130 |
| Level | 52 | 52 |
| HP | 700 | 700 |
| XP | 1500 | 1500 |
| AC / AMC | 15 / 5 | 15 / 5 |
| DC | 16–39 | 16–39 |
| Acc / Agi | 17 / 17 | 17 / 17 |
| Attack / move | 1500 / 900 | 1500 / 900 |
| Drops | Empty table | Empty table |

Stationary / trap-style rocks. Trap Rock 1 only appears once on Fox02.

### Guardian Rock

| Field | Value |
|-------|-------|
| Crystal index | 221 |
| Image | 131 |
| Level | 52 |
| HP | 1200 |
| XP | 4000 |
| AC / AMC | 10 / 15 |
| DC | 22–55 |
| Acc / Agi | 17 / 15 |
| Attack / move | 1500 / 5000 ms |
| Spawns | **4 fixed** on Fox03 only |
| Drops | Potions / gold only (no gear) |

Very slow mover; temple guardians around Great Fox Spirit.

### Electric Element

| Field | Value |
|-------|-------|
| Crystal index | 222 |
| Image | 132 |
| Level | 37 |
| HP | 1000 |
| XP | 2000 |
| AC / AMC | 100 / 100 |
| DC | 20–32 |
| Acc / Agi | 13 / 13 |
| Attack / move | 1500 / 1050 ms |
| Drops | Gold + HP/MP Drug Large + Sun Potion (M) only |

Extremely high defence; low level relative to fox men.

### Cloud Element

| Field | Value |
|-------|-------|
| Crystal index | 223 |
| Image | 133 |
| Level | 39 |
| HP | 1500 |
| XP | 4000 |
| AC / AMC | 100 / 100 |
| DC | 25–80 |
| Acc / Agi | 18 / 16 |
| Attack / move | 1500 / 1050 ms |
| Drops | Same as Electric Element (potions / gold) |

Harder-hitting twin of Electric Element.

---

## Temple boss

### Great Fox Spirit

| Field | Value |
|-------|-------|
| Crystal index | 228 |
| Image | 134 |
| Level | 60 |
| HP | **15000** |
| XP | **30000** |
| AC / AMC | 20 / 20 |
| DC / MC | 50–90 / 50–90 |
| Acc / Agi | 16 / 16 |
| Attack / move | 2500 / 2500 ms |
| Spawns | **1** on Fox03 (Sacred Fox Temple) |
| Drop path | `WoomyonWoods\InsectCave\GreatFoxSpirit` |

Crystal files this under Insect Cave drops, but the map respawn places it in Fox Cave’s temple. Our idle gallery currently lists Great Fox Spirit under **Insect Cave**, not Fox Cave.

---

## Insect Cave spillover (also on Fox01 / Fox02)

These use Insect Cave drop paths. Present in Crystal Fox map respawns; may or may not belong in an idle “Fox Cave” zone depending on design intent.

| Monster | Idx | Img | Lv | HP | XP | AC/AMC | DC | Notes |
|---------|----:|----:|---:|---:|---:|--------|----|-------|
| Hedge Kek Tal | 224 | 135 | 38 | 700 | 2400 | 13/18 | 20–52 | Fox01/02 |
| Big Hedge Kek Tal | 225 | 136 | 40 | 800 | 2100 | 15/19 | 25–57 | Fox01/02 |
| Brown Frog Spider | 226 | 138 | 43 | 880 | 2230 | 13/18 | 33–51 | Fox01/02 |
| Red Frog Spider | 227 | 137 | 35 | 760 | 1950 | 15/17 | 29–45 | Fox01/02 |

---

## Suggested idle grouping

If we port Fox Cave as one zone/dungeon:

1. **Normal enemies:** Red / Black / White Fox Man, Trap Rock, Electric Element, Cloud Element, Guardian Rock (temple).
2. **Boss options:**
   - **Great Fox Spirit** (Crystal temple boss), and/or
   - **Red Fox Man** (current idle gallery label).
3. **Optional omit:** Insect Cave spillover mobs (Kek Tals / Frog Spiders) unless we want shared trash with Insect Cave.

---

*Generated from Crystal export data for design reference. Not live game content.*
