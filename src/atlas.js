const atlasCache = new Map();
let packagedAtlasBundlePromise;

function packagedAtlasBundleUrl() {
  return globalThis.document
    ?.querySelector('meta[name="lom-atlas-bundle"]')
    ?.getAttribute("content")
    ?.trim() ?? "";
}

function parseJsonText(text) {
  const normalized = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return JSON.parse(normalized);
}

function packagedAtlasKey(url) {
  const key = String(url).split(/[?#]/, 1)[0].replace(/\\/g, "/").replace(/^\.\//, "");
  return /^(?:public\/sprite-sets\/common\/(?:armour|hair|weapon|wing)\/\d+|public\/monsters\/monster\/\d+)\.json$/.test(key)
    ? key
    : null;
}

async function loadPackagedAtlasBundle() {
  if (packagedAtlasBundlePromise === undefined) {
    const bundleUrl = packagedAtlasBundleUrl();
    packagedAtlasBundlePromise = bundleUrl
      ? fetch(bundleUrl, { cache: "no-store" })
          .then(async (res) => (res.ok ? parseJsonText(await res.text()) : null))
          .catch(() => null)
      : Promise.resolve(null);
  }
  return packagedAtlasBundlePromise;
}

export async function loadJson(url) {
  const bundleKey = packagedAtlasKey(url);
  if (bundleKey) {
    const bundle = await loadPackagedAtlasBundle();
    if (Object.prototype.hasOwnProperty.call(bundle?.atlases ?? {}, bundleKey)) {
      return bundle.atlases[bundleKey];
    }
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return parseJsonText(await res.text());
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
