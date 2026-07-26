import fs from "node:fs";
const m = JSON.parse(fs.readFileSync("C:/Users/bb-we/Documents/KR-Mir2-Client/mirdb-monsters.json", "utf8"));
for (const h of m.filter((x) => /야수|남만|흑호|백호|박쥐/.test(x.name))) {
  console.log(`Image ${h.image}  "${h.name}"  Lv${h.level} HP${h.hp}`);
}
console.log("image 184:", m.find((x) => x.image === 184));
