import fs from "node:fs";
import path from "node:path";

const src = "C:/Users/bb-we/Documents/KR-Mir2-Client/next-export/monster";
const dst = "public/monsters/monster";
const map = { 268: 991, 269: 992, 19: 993 };

for (const [from, to] of Object.entries(map)) {
  fs.copyFileSync(path.join(src, `${from}.png`), path.join(dst, `${to}.png`));
  const j = JSON.parse(fs.readFileSync(path.join(src, `${from}.json`), "utf8"));
  j.index = Number(to);
  j.source = `NextClient/${from}.Lib`;
  if (j.actions?.die?.frames?.length && j.actions?.dead) {
    const dieLast = j.actions.die.frames[j.actions.die.frames.length - 1];
    if (dieLast && !dieLast.empty) {
      j.actions.dead = {
        interval: 1000,
        frames: [{
          slot: dieLast.slot,
          srcFrame: dieLast.srcFrame,
          w: dieLast.w,
          h: dieLast.h,
          offsetX: dieLast.offsetX,
          offsetY: dieLast.offsetY,
        }],
      };
    }
  }
  fs.writeFileSync(path.join(dst, `${to}.json`), JSON.stringify(j));
  console.log(
    to,
    "stand",
    j.actions.standing.frames.map((f) => f.srcFrame).join(","),
    "atk",
    j.actions.attack1.frames.map((f) => f.srcFrame).join(","),
  );
}

const monolith = "src/app.monolith.js";
let s = fs.readFileSync(monolith, "utf8");
s = s.replace(
  /const MONSTER_ASSET_VERSION = "[^"]+"/,
  'const MONSTER_ASSET_VERSION = "20260723-namman-ps-export"',
);
fs.writeFileSync(monolith, s);
console.log("asset version bumped");
