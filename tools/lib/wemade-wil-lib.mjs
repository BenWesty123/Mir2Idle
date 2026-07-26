// Minimal Node reader for WeMade .wil/.wix image libraries (the KR Mir2 client
// art format). Ported from Crystal-master/LibraryEditor/Graphics/WeMadeLibrary.cs
// and the C# WilExporter. Exposes the same shape as CrystalMapLib so the map
// builder server can serve KR tiles the same way it serves Crystal .Lib frames.
//
// Supports the formats the KR map art actually uses:
//   nType 2 = new WeMade design (RGB565, raw-deflate compressed)   <- Tiles/SmTiles/Objects
//   nType 5 = 32-bit BGRA
// Transparency: WeMade images have no alpha channel; colour 0x0000 is the
// transparent key, so we emit alpha 0 for those pixels (matches in-game draw).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// base header size per nType (bytes before pixel/data block)
const IMAGE_STRUCT_SIZE = [8, 16, 16, 17, 16, 16];

function findIndexPath(wilPath) {
  const base = wilPath.replace(/\.[^.]*$/, "");
  for (const ext of [".wix", ".WIX", ".Wix"]) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  return null;
}

export class WeMadeWilLib {
  #fd;
  #offsets;
  nType = 0;
  count = 0;

  constructor(wilPath) {
    this.path = wilPath;
    const wixPath = findIndexPath(wilPath);
    if (!wixPath) throw new Error("WIX not found for " + wilPath);
    this.#fd = fs.openSync(wilPath, "r");

    const header = Buffer.alloc(51);
    fs.readSync(this.#fd, header, 0, 51, 0);
    if (header[40] === 1 || header[40] === 6) this.nType = 2;
    else if (header[2] === 73 || header[2] === 72) this.nType = 3;
    else if (header[48] === 32) this.nType = 5;
    if ((this.nType === 2 || this.nType === 0) && header.readInt16LE(49) === 32) this.nType = 5;

    // Index file
    const wix = fs.readFileSync(wixPath);
    let start;
    if (this.nType === 2 || this.nType === 5) start = 52;
    else if (this.nType === 3) start = (wix.readUInt16LE(26) !== 0xb13a) ? 24 : 28;
    else start = 48;
    const offsets = [];
    for (let p = start; p + 4 <= wix.length; p += 4) offsets.push(wix.readInt32LE(p));
    this.#offsets = offsets;
    this.count = offsets.length;
  }

  close() {
    if (this.#fd != null) { fs.closeSync(this.#fd); this.#fd = null; }
  }

  readFrame(index) { return this.readFrameSafe(index); }

  // Fast: read only the width/height header (no pixel inflate).
  frameDims(index) {
    if (index < 0 || index >= this.count) return null;
    const pos = this.#offsets[index];
    if (pos <= 0) return null;
    if (this.nType !== 2 && this.nType !== 5) return null;
    const head = Buffer.alloc(IMAGE_STRUCT_SIZE[this.nType]);
    fs.readSync(this.#fd, head, 0, head.length, pos);
    return { width: head.readInt16LE(0), height: head.readInt16LE(2) };
  }

  readFrameSafe(index) {
    if (index < 0 || index >= this.count) return null;
    const pos = this.#offsets[index];
    if (pos <= 0) return null;
    try { return this.#read(pos); } catch { return null; }
  }

  #read(pos) {
    if (this.nType !== 2 && this.nType !== 5) return null; // KR map art is all nType 2
    const head = Buffer.alloc(IMAGE_STRUCT_SIZE[this.nType]);
    fs.readSync(this.#fd, head, 0, head.length, pos);
    const width = head.readInt16LE(0);
    const height = head.readInt16LE(2);
    const offsetX = head.readInt16LE(4);
    const offsetY = head.readInt16LE(6);
    const nSize = head.readInt32LE(12);
    if (width <= 0 || height <= 0 || nSize < 6) return null;

    // data block: 1 byte compressed flag + 5 skipped + payload(nSize-6)
    const dataPos = pos + IMAGE_STRUCT_SIZE[this.nType];
    const prefix = Buffer.alloc(6);
    fs.readSync(this.#fd, prefix, 0, 6, dataPos);
    const compressed = prefix[0];
    const payload = Buffer.alloc(nSize - 6);
    fs.readSync(this.#fd, payload, 0, payload.length, dataPos + 6);
    let bytes = compressed === 8 ? zlib.inflateRawSync(payload) : payload;

    const rgba = Buffer.alloc(width * height * 4);
    const is32 = this.nType === 5 && bytes.length >= width * height * 4;
    let j = 0;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const d = (y * width + x) * 4;
        if (is32) {
          // stored BGRA
          if (j + 4 > bytes.length) break;
          rgba[d] = bytes[j + 2];
          rgba[d + 1] = bytes[j + 1];
          rgba[d + 2] = bytes[j];
          rgba[d + 3] = bytes[j + 3];
          j += 4;
        } else {
          if (j + 2 > bytes.length) break;
          const c = bytes[j] | (bytes[j + 1] << 8);
          j += 2;
          if (c === 0) { rgba[d] = 0; rgba[d + 1] = 0; rgba[d + 2] = 0; rgba[d + 3] = 0; }
          else {
            rgba[d] = (c & 0xf800) >> 8;
            rgba[d + 1] = (c & 0x07e0) >> 3;
            rgba[d + 2] = (c & 0x001f) << 3;
            rgba[d + 3] = 255;
          }
        }
      }
    }
    return { width, height, offsetX, offsetY, rgba };
  }
}

export function wilRelativeName(slot) {
  if (slot === 0) return "Tiles.wil";
  if (slot === 1) return "SmTiles.wil";
  if (slot === 2) return "Objects.wil";
  if (slot >= 3 && slot <= 28) return `Objects${slot - 1}.wil`;
  if (slot === 90) return "Objects_32bit.wil";
  return null;
}

export function wilLabel(slot) {
  const n = wilRelativeName(slot);
  return n ? path.basename(n, ".wil") : `slot ${slot}`;
}

const wilCache = new Map();
export function getWilLib(dataRoot, slot) {
  const name = wilRelativeName(slot);
  if (!name) return null;
  const full = path.join(dataRoot, name);
  if (wilCache.has(full)) return wilCache.get(full);
  if (!fs.existsSync(full)) { wilCache.set(full, null); return null; }
  let lib = null;
  try { lib = new WeMadeWilLib(full); } catch { lib = null; }
  wilCache.set(full, lib);
  return lib;
}
