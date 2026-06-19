import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const projectRoot = new URL("..", import.meta.url);
const crystalSoundRoot = "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Sound";
const soundListPath = join(crystalSoundRoot, "SoundList.lst");
const outputRoot = new URL("../public/audio/sfx/", import.meta.url);
const reviewRoot = new URL("../tile-review/crystal-sfx/", import.meta.url);

const groups = [
  {
    id: "movement",
    label: "Footsteps",
    entries: [
      sound("footstep.field.walk.left", "Field walk left", 10009),
      sound("footstep.field.walk.right", "Field walk right", 10010),
      sound("footstep.field.run.left", "Field run left", 10011),
      sound("footstep.field.run.right", "Field run right", 10012),
      sound("footstep.cave.walk.left", "Cave walk left", 10021),
      sound("footstep.cave.walk.right", "Cave walk right", 10022),
      sound("footstep.cave.run.left", "Cave run left", 10023),
      sound("footstep.cave.run.right", "Cave run right", 10024),
    ],
  },
  {
    id: "weapons",
    label: "Weapons",
    entries: [
      sound("weapon.swing.short", "Short swing", 10050),
      sound("weapon.swing.wood", "Wooden swing", 10051),
      sound("weapon.swing.sword", "Sword swing", 10052),
      sound("weapon.swing.sword2", "Heavy sword swing", 10053),
      sound("weapon.swing.axe", "Axe swing", 10054),
      sound("weapon.swing.club", "Club swing", 10055),
      sound("weapon.swing.long", "Long weapon swing", 10056),
      sound("weapon.hit.short", "Short weapon hit", 10060),
      sound("weapon.hit.wood", "Wooden hit", 10061),
      sound("weapon.hit.sword", "Sword hit", 10062),
      sound("weapon.hit.sword2", "Heavy sword hit", 10063),
      sound("weapon.hit.axe", "Axe hit", 10064),
      sound("weapon.hit.club", "Club hit", 10065),
      sound("mining.hit", "Mine wall hit", 10091),
    ],
  },
  {
    id: "warrior-spells",
    label: "Warrior Spells",
    entries: [
      spellSound("spell.Slaying.attack", "Slaying attack (male)", 2, 0),
      spellSound("spell.Thrusting.attack", "Thrusting attack", 3, 0),
      spellSound("spell.HalfMoon.attack", "Half Moon attack", 4, 0),
      spellSound("spell.TwinDrakeBlade.cast", "Twin Drake Blade cast", 6, 0),
      spellSound("spell.FlamingSword.attack", "Flaming Sword attack", 8, 1),
    ],
  },
  {
    id: "wizard-spells",
    label: "Wizard Spells",
    entries: [
      spellSound("spell.FireBall.cast", "Fireball cast", 31, 0),
      spellSound("spell.FireBall.fly", "Fireball travel", 31, 1),
      spellSound("spell.FireBall.impact", "Fireball impact", 31, 2),
      spellSound("spell.GreatFireBall.cast", "Great Fire Ball cast", 34, 0),
      spellSound("spell.GreatFireBall.fly", "Great Fire Ball travel", 34, 1),
      spellSound("spell.GreatFireBall.impact", "Great Fire Ball impact", 34, 2),
      spellSound("spell.ElectricShock.cast", "Electric Shock cast", 33, 0),
      spellSound("spell.ElectricShock.impact", "Electric Shock impact", 33, 1),
      spellSound("spell.ThunderBolt.cast", "Thunder Bolt", 36, 0),
      spellSound("spell.FireWall.cast", "Fire Wall cast", 39, 0),
      spellSound("spell.FireWall.impact", "Fire Wall placement", 39, 1),
      spellSound("spell.FrostCrunch.cast", "Frost Crunch cast", 41, 0),
      spellSound("spell.FrostCrunch.fly", "Frost Crunch travel", 41, 1),
      spellSound("spell.FrostCrunch.impact", "Frost Crunch impact", 41, 2),
    ],
  },
  {
    id: "taoist-spells",
    label: "Taoist Spells",
    entries: [
      spellSound("spell.Healing.cast", "Healing cast", 61, 0),
      spellSound("spell.Healing.impact", "Healing restore", 61, 1),
      spellSound("spell.Poisoning.cast", "Poisoning cast", 63, 0),
      spellSound("spell.Poisoning.impact", "Poisoning impact", 63, 1),
      spellSound("spell.SoulFireBall.cast", "Soul Fire Ball cast", 64, 0),
      spellSound("spell.SoulFireBall.fly", "Soul Fire Ball travel", 64, 1),
      spellSound("spell.SoulFireBall.impact", "Soul Fire Ball impact", 64, 2),
      spellSound("spell.SummonSkeleton.cast", "Summon Skeleton cast", 65, 0),
      spellSound("spell.SummonShinsu.cast", "Summon Shinsu cast", 78, 0),
      spellSound("spell.SoulShield.cast", "Soul Shield cast", 69, 0),
      spellSound("spell.SoulShield.impact", "Soul Shield bless", 69, 1),
      spellSound("spell.BlessedArmour.cast", "Blessed Armour cast", 71, 0),
      spellSound("spell.BlessedArmour.impact", "Blessed Armour bless", 71, 1),
      sound("pet.skeleton.summon", "Bone Familiar appear", 785),
      sound("pet.skeleton.attack", "Bone Familiar attack", 781),
      sound("pet.skeleton.hit", "Bone Familiar hit", 784),
      sound("pet.skeleton.flinch", "Bone Familiar flinch", 782),
      sound("pet.skeleton.death", "Bone Familiar death", 783),
      sound("pet.shinsu.summon", "Shinsu summon", 795),
      sound("pet.shinsu.show", "Shinsu emerge", 796),
      sound("pet.shinsu.attack", "Shinsu attack windup", 801),
      sound("pet.shinsu.hit", "Shinsu fire breath", 804),
      sound("pet.shinsu.flinch", "Shinsu flinch", 802),
      sound("pet.shinsu.flinchBuried", "Shinsu buried flinch", 792),
      sound("pet.shinsu.death", "Shinsu death", 803),
    ],
  },
  {
    id: "human",
    label: "Human Flinch And Death",
    entries: [
      sound("player.flinch", "Male flinch", 10138),
      sound("player.death", "Male death", 10144),
    ],
  },
  {
    id: "monster",
    label: "Current Monster Actions",
    entries: [
      ...monsterSounds("Hen", 3),
      ...monsterSounds("Deer", 4),
      ...monsterSounds("Scarecrow", 5),
      ...monsterSounds("Hooking Cat", 6),
      ...monsterSounds("Raking Cat", 7),
      ...monsterSounds("Yob", 8),
      ...monsterSounds("Oma", 9),
      ...monsterSounds("Yeti", 11),
      ...monsterSounds("Spitting Spider", 12),
      ...monsterSounds("Skeleton", 22),
      ...monsterSounds("Cave Bat", 19),
      ...monsterSounds("Cave Maggot", 20),
      ...monsterSounds("Scorpion", 21),
      ...monsterSounds("Bone Fighter", 23),
      ...monsterSounds("Axe Skeleton", 24),
      ...monsterSounds("Bone Warrior", 25),
      ...monsterSounds("Bone Elite", 26),
      ...monsterSounds("Zombie 2 / Priest Zombie", 69, { attack: 701 }),
      ...monsterSounds("Zombie 3 / Cl Zombie", 70),
      ...monsterSounds("Zombie 4 / Nd Zombie", 71),
      ...monsterSounds("Zombie 5 / Crawler Zombie", 72),
      ...monsterSounds("Shaman Zombie", 73),
      ...monsterSounds("Ghoul", 74),
      ...monsterSounds("Spider Frog", 81),
      ...monsterSounds("Horo Blaster", 82),
      ...monsterSounds("Blue Horo Blaster", 83),
      ...monsterSounds("Kek Tal", 84),
      ...monsterSounds("Violet Kek Tal", 85),
      ...monsterSounds("Khazard", 86),
      ...monsterSounds("Dung", 27),
      ...monsterSounds("Dark", 28),
      ...monsterSounds("Wooma Soldier", 29),
      ...monsterSounds("Wooma Fighter", 30),
      ...monsterSounds("Wooma Warrior", 31),
      ...monsterSounds("Flaming Wooma", 32),
      ...monsterSounds("Wooma Guardian", 33),
      ...monsterSounds("Wooma Taurus", 34),
      ...monsterSounds("Whimpering Bee", 35),
      ...monsterSounds("Giant Worm", 36),
      ...monsterSounds("Centipede", 37),
      ...monsterSounds("Black Maggot", 38),
      ...monsterSounds("Tongs", 39),
      ...monsterSounds("Evil Tongs", 40),
      ...monsterSounds("Evil Centipede", 41),
      ...monsterSounds("Wedge Moth", 44),
      ...monsterSounds("Red Boar", 45),
      ...monsterSounds("Black Boar", 46),
      ...monsterSounds("Snake Scorpion", 47),
      ...monsterSounds("White Boar", 48, { attack: 480 }),
      ...monsterSounds("Evil Snake", 49),
      ...monsterSoundsByImage("King Scorpion", 75, 75, { range: 755 }),
      ...monsterSounds("Giant Rat", 63),
      ...monsterSounds("Zuma Archer", 64),
      ...monsterSounds("Zuma Statue", 65),
      ...monsterSounds("Zuma Guardian", 66),
      ...monsterSounds("Red Thunder Zuma", 67),
      ...monsterSounds("Zuma Taurus", 68),
      ...monsterSounds("Ronin Ghoul", 87),
      ...monsterSounds("Toxic Ghoul", 88),
      ...monsterSounds("Bone Captain", 89),
      ...monsterSounds("Bone Spearman", 90),
      ...monsterSounds("Bone Blademan", 91),
      ...monsterSounds("Bone Archer", 92),
      ...monsterSounds("Bone Lord", 93, { range: 935 }),
      // Prajna Temple: monsterIndex is crystalIndex; Crystal BaseSound uses image * 10.
      ...monsterSoundsByImage("Minotaur", 361, 94),
      ...monsterSoundsByImage("Ice Minotaur", 363, 95),
      ...monsterSoundsByImage("Electric Minotaur", 365, 96),
      ...monsterSoundsByImage("Wind Minotaur", 367, 97),
      ...monsterSoundsByImage("Fire Minotaur", 369, 98),
      ...monsterSoundsByImage("Right Guard", 371, 99, { range: 995 }),
      ...monsterSoundsByImage("Left Guard", 373, 100, { range: 1005 }),
      ...monsterSoundsByImage("Minotaur King", 375, 101, { range: 1015 }),
    ],
  },
  {
    id: "map-hazards",
    label: "Map Hazards",
    entries: [
      sound("map.lightning", "Kings Tomb map lightning", 8301),
    ],
  },
  {
    id: "ui-items",
    label: "UI And Items",
    entries: [
      sound("ui.button", "Button", 10103),
      sound("ui.npc", "NPC click", 10103),
      sound("ui.gold", "Gold", 10106),
      sound("ui.teleport", "Teleport", 10110),
      sound("item.potion.use", "Use potion", 10107),
      sound("item.potion.click", "Potion click", 10108),
      sound("item.equip.weapon", "Equip weapon", 10111),
      sound("item.equip.armour", "Equip armour", 10112),
      sound("item.equip.ring", "Equip ring", 10113),
      sound("item.equip.bracelet", "Equip bracelet", 10114),
      sound("item.equip.necklace", "Equip necklace", 10115),
      sound("item.equip.helmet", "Equip helmet", 10116),
      sound("item.equip.boots", "Equip boots", 10117),
      sound("item.move", "Move item", 10118),
      sound("level.up", "Level up", 10156),
    ],
  },
];

function sound(key, label, id) {
  return { key, label, id };
}

function spellSound(key, label, spellId, variant) {
  return { key, label, id: 20000 + spellId * 10 + variant, spellId, variant };
}

function monsterSounds(label, monsterIndex, ids = {}) {
  const base = `monster.${monsterIndex}`;
  const soundBase = monsterIndex * 10;
  const entries = [
    sound(`${base}.attack`, `${label} attack`, ids.attack ?? soundBase + 1),
    sound(`${base}.flinch`, `${label} flinch`, ids.flinch ?? soundBase + 2),
    sound(`${base}.death`, `${label} death`, ids.death ?? soundBase + 3),
  ];
  if (ids.range != null) {
    entries.push(sound(`${base}.range`, `${label} range attack`, ids.range));
  }
  return entries;
}

function monsterSoundsByImage(label, monsterIndex, imageIndex, ids = {}) {
  const soundBase = imageIndex * 10;
  return monsterSounds(label, monsterIndex, {
    attack: ids.attack ?? soundBase + 1,
    flinch: ids.flinch ?? soundBase + 2,
    death: ids.death ?? soundBase + 3,
    range: ids.range,
  });
}

function parseSoundList(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/\s+/g, "");
    const match = /^(\d+):(.+)$/.exec(clean);
    if (!match) continue;
    map.set(Number(match[1]), match[2]);
  }
  return map;
}

function fallbackFilenames(id) {
  if (id > 20000) {
    const spellId = Math.floor((id - 20000) / 10);
    const variant = id % 10;
    return [
      `M${spellId}-${variant}.wav`,
      `${String(spellId).padStart(3, "0")}-${variant}.wav`,
    ];
  }
  return [`${String(Math.floor(id / 10)).padStart(3, "0")}-${id % 10}.wav`];
}

function soundFilenames(id, soundList) {
  const listed = soundList.get(id);
  const names = listed ? [listed, ...fallbackFilenames(id)] : fallbackFilenames(id);
  return [...new Set(names)];
}

function safeFileName(name) {
  return name.replace(/[^a-z0-9._-]+/gi, "-");
}

function reviewHtml(manifest) {
  const rows = manifest.groups.map((group) => `
    <section>
      <h2>${escapeHtml(group.label)}</h2>
      <div class="grid">
        ${group.entries.map((key) => {
          const entry = manifest.byKey[key];
          return `
            <article>
              <strong>${escapeHtml(entry.label)}</strong>
              <span>${escapeHtml(entry.key)}</span>
              <code>${entry.id}: ${escapeHtml(entry.sourceFile)}</code>
              <audio controls src="../../${entry.src.replace("./", "")}"></audio>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Crystal SFX Review</title>
    <style>
      body { margin: 0; background: #111; color: #eadfba; font: 14px/1.4 Arial, sans-serif; }
      header { position: sticky; top: 0; z-index: 2; padding: 16px 20px; background: #050505; border-bottom: 1px solid #6b5627; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      p { margin: 0; color: #b9aa7c; }
      section { padding: 18px 20px; border-bottom: 1px solid #2b2315; }
      h2 { margin: 0 0 12px; font-size: 18px; color: #ffd36a; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
      article { display: grid; gap: 6px; padding: 10px; background: #1a160f; border: 1px solid #4d3b1e; }
      strong { color: #fff0a8; }
      span { color: #bfc9cc; font-size: 12px; }
      code { color: #c7a35b; font-size: 12px; }
      audio { width: 100%; height: 32px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Crystal SFX Review</h1>
      <p>First-pass sound effects for the current LOM Idle prototype.</p>
    </header>
    ${rows}
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

await rm(new URL("files/", outputRoot), { recursive: true, force: true });
await mkdir(new URL("files/", outputRoot), { recursive: true });
await mkdir(reviewRoot, { recursive: true });

const soundList = parseSoundList(await readFile(soundListPath, "utf8"));
const byKey = {};
const missing = [];

for (const group of groups) {
  for (const entry of group.entries) {
    let copied = null;
    for (const sourceFile of soundFilenames(entry.id, soundList)) {
      const sourcePath = join(crystalSoundRoot, sourceFile);
      const destName = safeFileName(`${entry.id}-${basename(sourceFile)}`);
      const destUrl = new URL(`files/${destName}`, outputRoot);
      try {
        await copyFile(sourcePath, destUrl);
        copied = { sourceFile, destName };
        break;
      } catch {
        // Try the next filename convention.
      }
    }
    if (!copied) {
      missing.push({ ...entry, sourceFile: soundFilenames(entry.id, soundList).join(" or ") });
      continue;
    }
    byKey[entry.key] = {
      ...entry,
      group: group.id,
      sourceFile: copied.sourceFile,
      src: `./public/audio/sfx/files/${copied.destName}`,
    };
  }
}

const manifest = {
  generatedFrom: soundListPath,
  missing,
  groups: groups.map((group) => ({
    id: group.id,
    label: group.label,
    entries: group.entries.map((entry) => entry.key).filter((key) => byKey[key]),
  })),
  byKey,
};

await writeFile(new URL("manifest.json", outputRoot), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL("index.html", reviewRoot), reviewHtml(manifest));

console.log(`Prepared ${Object.keys(byKey).length} SFX entries.`);
if (missing.length) {
  console.log(`Missing ${missing.length} entries:`);
  for (const entry of missing) console.log(`- ${entry.key}: ${entry.id} ${entry.sourceFile}`);
}
console.log(`Review page: ${new URL("index.html", reviewRoot).pathname}`);
