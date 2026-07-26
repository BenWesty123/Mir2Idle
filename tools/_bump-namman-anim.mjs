import fs from "node:fs";

for (const id of [991, 992, 993, 994]) {
  const j = JSON.parse(fs.readFileSync(`public/monsters/monster/${id}.json`, "utf8"));
  console.log(
    id,
    "stand",
    j.actions.standing.interval + "ms",
    "atk",
    j.actions.attack1.interval + "ms",
  );
}

const path = "src/app.monolith.js";
let s = fs.readFileSync(path, "utf8");
const ver = "20260723-namman-anim";
s = s.replace(/const MONSTER_ASSET_VERSION = "[^"]+"/, `const MONSTER_ASSET_VERSION = "${ver}"`);
fs.writeFileSync(path, s);
console.log("asset version", ver);
