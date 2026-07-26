import fs from "node:fs";
const m = JSON.parse(fs.readFileSync("C:/Users/bb-we/Documents/KR-Mir2-Client/mirdb-monsters.json", "utf8"));
const pats = process.argv.slice(2);
const re = new RegExp(pats.join("|"));
const hits = m.filter((x) => re.test(x.name));
console.log(`roster ${m.length}, matches ${hits.length} for /${pats.join("|")}/`);
for (const h of hits) console.log(`  Image ${h.image}  "${h.name}"  Lv${h.level} HP${h.hp} DC${h.minDC}-${h.maxDC} exp${h.exp}`);
