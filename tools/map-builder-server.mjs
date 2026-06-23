import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseType1Map,
  encodeType1Map,
  mapToJson,
  mapFromJson,
  getMapLib,
  libLabel,
  libRelativePath,
  visibleBackFrame,
  backTileIndex,
  frontTileIndex,
} from "./lib/crystal-map-lib.mjs";

const toolsRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.join(toolsRoot, "..");
const uiRoot = path.join(toolsRoot, "map-builder");
const configPath = path.join(uiRoot, "paths.json");
const port = Number(process.env.MAP_BUILDER_PORT ?? 4178);

const defaults = {
  crystalData: "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Data",
  crystalMap: "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map",
  exportDir: path.join(projectRoot, "tile-review", "map-builder-exports"),
};

async function loadConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = { ...defaults, ...JSON.parse(raw) };
    if (parsed.exportDir && !path.isAbsolute(parsed.exportDir)) {
      parsed.exportDir = path.resolve(path.dirname(configPath), parsed.exportDir);
    }
    return parsed;
  } catch {
    return { ...defaults };
  }
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function safeMapName(name) {
  const base = path.basename(name);
  if (!/^[\w.-]+\.map$/i.test(base)) return null;
  return base;
}

async function listMaps(mapRoot) {
  if (!existsSync(mapRoot)) return [];
  const entries = await readdir(mapRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".map"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

createServer(async (req, res) => {
  try {
    const config = await loadConfig();
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/config") {
      return json(res, 200, {
        crystalData: config.crystalData,
        crystalMap: config.crystalMap,
        exportDir: config.exportDir,
        dataExists: existsSync(config.crystalData),
        mapExists: existsSync(config.crystalMap),
      });
    }

    if (url.pathname === "/api/maps") {
      return json(res, 200, { maps: await listMaps(config.crystalMap) });
    }

    if (url.pathname.startsWith("/api/map/") && req.method === "GET") {
      const name = safeMapName(url.pathname.slice("/api/map/".length));
      if (!name) return json(res, 400, { error: "Invalid map name" });
      const filePath = path.join(config.crystalMap, name);
      if (!existsSync(filePath)) return json(res, 404, { error: "Map not found" });
      const buffer = await readFile(filePath);
      const map = parseType1Map(buffer);
      return json(res, 200, { name, ...mapToJson(map) });
    }

    if (url.pathname === "/api/map/save" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const name = safeMapName(body?.name ?? "edited.map");
      if (!name || !body?.width || !body?.height) return json(res, 400, { error: "Invalid payload" });
      const map = mapFromJson(body);
      const outDir = config.exportDir;
      await mkdir(outDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outName = name.replace(/\.map$/i, `-${stamp}.map`);
      const outPath = path.join(outDir, outName);
      await writeFile(outPath, encodeType1Map(map));
      return json(res, 200, { saved: outPath, fileName: outName });
    }

    if (url.pathname === "/api/lib/slots") {
      const slots = [];
      for (let slot = 0; slot <= 28; slot++) {
        const relative = libRelativePath(slot);
        if (!relative) continue;
        const lib = getMapLib(config.crystalData, slot);
        slots.push({
          slot,
          label: libLabel(slot),
          count: lib?.count ?? 0,
          available: Boolean(lib),
        });
      }
      const lib90 = getMapLib(config.crystalData, 90);
      slots.push({ slot: 90, label: libLabel(90), count: lib90?.count ?? 0, available: Boolean(lib90) });
      return json(res, 200, { slots });
    }

    if (url.pathname === "/api/lib/frame") {
      const slot = Number(url.searchParams.get("slot") ?? 0);
      const frame = Number(url.searchParams.get("frame"));
      if (!Number.isFinite(frame)) return json(res, 400, { error: "frame required" });
      const lib = getMapLib(config.crystalData, slot);
      if (!lib) return json(res, 404, { error: "Lib not found" });
      const image = lib.readFrameSafe(Math.trunc(frame));
      if (!image) return json(res, 404, { error: "Frame empty" });
      return json(res, 200, {
        slot,
        frame: Math.trunc(frame),
        width: image.width,
        height: image.height,
        offsetX: image.offsetX,
        offsetY: image.offsetY,
        rgba: image.rgba.toString("base64"),
      });
    }

    if (url.pathname === "/api/lib/range-meta") {
      const slot = Number(url.searchParams.get("slot") ?? 0);
      const start = Number(url.searchParams.get("start") ?? 0);
      const count = Math.min(200, Math.max(1, Number(url.searchParams.get("count") ?? 40)));
      const lib = getMapLib(config.crystalData, slot);
      if (!lib) return json(res, 404, { error: "Lib not found" });
      const frames = [];
      for (let i = 0; i < count; i++) {
        const frame = start + i;
        if (frame >= lib.count) break;
        const image = lib.readFrameSafe(frame);
        frames.push({
          frame,
          width: image?.width ?? 0,
          height: image?.height ?? 0,
          visible: Boolean(image && image.width > 0 && image.height > 0),
        });
      }
      return json(res, 200, { slot, start, frames, libCount: lib.count });
    }

    // Static UI
    let requested = decodeURIComponent(url.pathname);
    if (requested === "/") requested = "/index.html";
    const filePath = path.normalize(path.join(uiRoot, requested));
    if (!filePath.startsWith(path.normalize(uiRoot))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch (error) {
    json(res, 500, { error: String(error?.message ?? error) });
  }
}).listen(port, () => {
  console.log(`Crystal Map Builder at http://localhost:${port}`);
  console.log(`Edit paths in tools/map-builder/paths.json if Crystal is elsewhere.`);
});
