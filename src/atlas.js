const atlasCache = new Map();

export async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  const text = await res.text();
  const normalized = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return JSON.parse(normalized);
}

export async function loadAtlas(spriteSet, layer, index) {
  if (index == null || index === "") return null;
  const key = `${spriteSet}:${layer}:${index}`;
  if (!atlasCache.has(key)) {
    atlasCache.set(key, loadJson(`./public/sprite-sets/${spriteSet}/${layer}/${index}.json`));
  }
  return atlasCache.get(key);
}

export function sheetUrl(spriteSet, layer, index) {
  return `./public/sprite-sets/${spriteSet}/${layer}/${index}.png`;
}

export function layerNames() {
  return ["armour", "hair", "weapon"];
}

export function missingActions(atlas, actions) {
  if (!atlas) return actions;
  return actions.filter((action) => !atlas.actions?.[action]);
}
