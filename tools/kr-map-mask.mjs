// Render the wall/blocking silhouette of Crystal/WeMade Type1 .map files to PNGs
// so we can visually match KR client maps against Mir2DB minimap overviews.
//
// Usage:
//   node tools/kr-map-mask.mjs <mapDir> <outDir> [--names a.map,b.map] [--max 512]
//   node tools/kr-map-mask.mjs <mapDir> <outDir> --filter 640x740+   (dim filter)
//
// A cell is BLOCKED when (back & 0x20000000) OR (front & 0x8000).
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parseType1Map } from "./lib/crystal-map-lib.mjs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter none
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function maskToRgb(map, outW, outH) {
  // Nearest-neighbour downscale of blocked grid into outW x outH.
  const rgb = Buffer.alloc(outW * outH * 3);
  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const x = Math.min(map.width - 1, Math.floor((ox / outW) * map.width));
      const y = Math.min(map.height - 1, Math.floor((oy / outH) * map.height));
      const i = x * map.height + y;
      const blocked = (map.back[i] & 0x20000000) !== 0 || (map.front[i] & 0x8000) !== 0;
      const p = (oy * outW + ox) * 3;
      if (blocked) { rgb[p] = 30; rgb[p + 1] = 30; rgb[p + 2] = 36; }      // wall = dark
      else { rgb[p] = 210; rgb[p + 1] = 196; rgb[p + 2] = 150; }          // walkable = sand
    }
  }
  return rgb;
}

async function main() {
  const [mapDir, outDir] = process.argv.slice(2);
  const args = process.argv.slice(4);
  let names = null, maxPx = 448, filter = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--names") names = args[++i].split(",").map((s) => s.trim());
    else if (args[i] === "--max") maxPx = Number(args[++i]);
    else if (args[i] === "--filter") filter = args[++i];
  }
  if (!mapDir || !outDir) { console.error("need <mapDir> <outDir>"); process.exit(1); }
  await mkdir(outDir, { recursive: true });

  let list = names;
  if (!list) {
    const all = (await readdir(mapDir)).filter((n) => n.toLowerCase().endsWith(".map"));
    list = all;
  }
  const results = [];
  for (const name of list) {
    const fp = path.join(mapDir, name);
    if (!existsSync(fp)) { console.log("MISSING", name); continue; }
    try {
      const buf = await readFile(fp);
      const map = parseType1Map(buf);
      const { width: w, height: h } = map;
      if (filter) {
        const m = filter.match(/^(\d+)x(\d+)\+?$/);
        if (m && (w < +m[1] || h < +m[2])) continue;
      }
      let blocked = 0;
      const n = w * h;
      for (let i = 0; i < n; i++) {
        if ((map.back[i] & 0x20000000) !== 0 || (map.front[i] & 0x8000) !== 0) blocked++;
      }
      const walkPct = (100 * (n - blocked) / n);
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const outW = Math.max(1, Math.round(w * scale));
      const outH = Math.max(1, Math.round(h * scale));
      const rgb = maskToRgb(map, outW, outH);
      const png = encodePng(outW, outH, rgb);
      const outName = name.replace(/\.map$/i, "") + `__${w}x${h}_walk${walkPct.toFixed(0)}.png`;
      await writeFile(path.join(outDir, outName), png);
      results.push({ name, w, h, walkPct: +walkPct.toFixed(1) });
    } catch (e) {
      console.log("FAIL", name, e.message);
    }
  }
  results.sort((a, b) => a.walkPct - b.walkPct);
  for (const r of results) console.log(`${r.name.padEnd(22)} ${r.w}x${r.h}  walkable ${r.walkPct}%`);
  console.log(`\n${results.length} maps rendered to ${outDir}`);
}
main();
