import path from "node:path";
import {
  isAssassinOrArcherGear,
  loadCrystalItems,
  loadItemsDoc,
  saveItemsDoc,
  slugFor,
  weaponOrArmourFromCrystal,
} from "./lib/item-from-crystal.mjs";

const root = path.resolve(import.meta.dirname, "..");
const crystalItems = loadCrystalItems(root);
const itemsDoc = loadItemsDoc(root);
const publicIconRoot = path.join(root, "public/item-icons/items");

const existingIds = new Set(itemsDoc.items.map((item) => item.id));
const existingCrystalNames = new Set(
  itemsDoc.items.map((item) => item.source?.name).filter(Boolean),
);

const added = [];
const skipped = [];

for (const crystal of crystalItems) {
  if (crystal.type !== "Weapon" && crystal.type !== "Armour") continue;
  if (isAssassinOrArcherGear(crystal.requiredClass)) continue;
  if (existingCrystalNames.has(crystal.name)) continue;

  const def = weaponOrArmourFromCrystal(crystal, root, publicIconRoot);
  if (existingIds.has(def.id)) {
    skipped.push(`${crystal.name} -> id ${def.id} already taken`);
    continue;
  }

  itemsDoc.items.push(def);
  existingIds.add(def.id);
  existingCrystalNames.add(crystal.name);
  added.push(def.id);
}

itemsDoc.items.sort((a, b) => a.id.localeCompare(b.id));
saveItemsDoc(root, itemsDoc);

console.log(`Added ${added.length} Crystal weapons/armours (War/Wiz/Tao only).`);
if (added.length) console.log(added.join(", "));
if (skipped.length) {
  console.warn(`Skipped ${skipped.length} items due to id collision:`);
  for (const line of skipped) console.warn(`  ${line}`);
}
