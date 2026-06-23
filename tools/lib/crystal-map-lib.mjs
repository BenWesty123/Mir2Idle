import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const BACK_XOR = 0xaa38aa38;

export function libRelativePath(slot) {
  if (slot === 0) return "Map/WemadeMir2/Tiles.Lib";
  if (slot === 1) return "Map/WemadeMir2/SmTiles.Lib";
  if (slot === 2) return "Map/WemadeMir2/Objects.Lib";
  if (slot >= 3 && slot <= 28) return `Map/WemadeMir2/Objects${slot - 1}.Lib`;
  if (slot === 90) return "Map/WemadeMir2/Objects_32bit.Lib";
  return null;
}

export function libLabel(slot) {
  const relative = libRelativePath(slot);
  return relative ? path.basename(relative, ".Lib") : `slot ${slot}`;
}

export function visibleBackFrame(frame) {
  if (frame >= 1950 && frame <= 1999) return frame + 1000;
  return frame;
}

export function cellIndex(map, x, y) {
  return x * map.height + y;
}

export function parseType1Map(buffer) {
  if (buffer.length < 54) throw new Error("Map file too small");
  const xor = buffer.readInt16LE(23);
  const width = buffer.readInt16LE(21) ^ xor;
  const height = buffer.readInt16LE(25) ^ xor;
  const count = width * height;
  const back = new Int32Array(count);
  const middle = new Int16Array(count);
  const front = new Int16Array(count);
  const frontSlot = new Int8Array(count);
  let offset = 54;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = x * height + y;
      back[i] = buffer.readInt32LE(offset) ^ BACK_XOR;
      offset += 4;
      middle[i] = buffer.readInt16LE(offset) ^ xor;
      offset += 2;
      front[i] = buffer.readInt16LE(offset) ^ xor;
      offset += 2;
      offset += 1; // doorIndex
      offset += 1; // doorOffset
      offset += 1; // frontAnimationFrame
      offset += 1; // frontAnimationTick
      let slot = buffer.readUInt8(offset) + 2;
      offset += 1;
      offset += 1; // light
      offset += 1; // unknown
      if (slot === 102) slot = 90;
      if (slot >= 255) slot = -1;
      frontSlot[i] = slot;
    }
  }
  return { width, height, xor, back, middle, front, frontSlot };
}

export function encodeType1Map(map) {
  const headerSize = 54;
  const cellBytes = 15;
  const out = Buffer.alloc(headerSize + map.width * map.height * cellBytes);
  out[0] = 0x10;
  out[2] = 0x61;
  out[7] = 0x31;
  out[14] = 0x31;
  out.writeInt16LE(map.width ^ map.xor, 21);
  out.writeInt16LE(map.xor, 23);
  out.writeInt16LE(map.height ^ map.xor, 25);
  let offset = headerSize;
  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const i = x * map.height + y;
      out.writeInt32LE(map.back[i] ^ BACK_XOR, offset);
      offset += 4;
      out.writeInt16LE(map.middle[i] ^ map.xor, offset);
      offset += 2;
      out.writeInt16LE(map.front[i] ^ map.xor, offset);
      offset += 2;
      offset += 4; // door + anim fields left zero
      let slot = map.frontSlot[i];
      if (slot === 90) slot = 100;
      else if (slot >= 0) slot -= 2;
      else slot = 253;
      out.writeUInt8(slot, offset);
      offset += 1;
      offset += 2; // light + unknown
    }
  }
  return out;
}

export function mapToJson(map) {
  return {
    width: map.width,
    height: map.height,
    xor: map.xor,
    back: Array.from(map.back),
    middle: Array.from(map.middle),
    front: Array.from(map.front),
    frontSlot: Array.from(map.frontSlot),
  };
}

export function mapFromJson(raw) {
  const count = raw.width * raw.height;
  return {
    width: raw.width,
    height: raw.height,
    xor: raw.xor,
    back: Int32Array.from(raw.back),
    middle: Int16Array.from(raw.middle),
    front: Int16Array.from(raw.front),
    frontSlot: Int8Array.from(raw.frontSlot),
  };
}

export class CrystalMapLib {
  #stream;
  #offsets;

  constructor(filePath) {
    this.path = filePath;
    this.#stream = fs.openSync(filePath, "r");
    const header = Buffer.alloc(12);
    fs.readSync(this.#stream, header, 0, 12, 0);
    const version = header.readInt32LE(0);
    const count = header.readInt32LE(4);
    let tableOffset = 8;
    if (version >= 3) tableOffset = 12;
    const table = Buffer.alloc(count * 4);
    fs.readSync(this.#stream, table, 0, count * 4, tableOffset);
    this.#offsets = new Int32Array(count);
    for (let i = 0; i < count; i++) this.#offsets[i] = table.readInt32LE(i * 4);
    this.count = count;
  }

  close() {
    if (this.#stream != null) {
      fs.closeSync(this.#stream);
      this.#stream = null;
    }
  }

  readFrame(index) {
    return this.readFrameSafe(index);
  }

  #readFrameAt(fileOffset) {
    const head = Buffer.alloc(17);
    fs.readSync(this.#stream, head, 0, 17, fileOffset);
    const width = head.readInt16LE(0);
    const height = head.readInt16LE(2);
    const offsetX = head.readInt16LE(4);
    const offsetY = head.readInt16LE(6);
    head.readInt16LE(8);
    head.readInt16LE(10);
    const shadow = head.readUInt8(12);
    const len = head.readInt32LE(13);
    const hasMask = (shadow & 0x80) !== 0;
    if (width <= 0 || height <= 0 || len <= 0) return null;
    let pos = fileOffset + 17;
    const compressed = Buffer.alloc(len);
    fs.readSync(this.#stream, compressed, 0, len, pos);
    pos += len;
    if (hasMask) {
      const skip = Buffer.alloc(8);
      fs.readSync(this.#stream, skip, 0, 8, pos);
      pos += 8;
      const maskLenBuf = Buffer.alloc(4);
      fs.readSync(this.#stream, maskLenBuf, 0, 4, pos);
      const maskLen = maskLenBuf.readInt32LE(0);
      pos += 4 + maskLen;
    }
    const raw = zlib.gunzipSync(compressed);
    if (raw.length < width * height * 4) return null;
    return { width, height, offsetX, offsetY, rgba: raw.subarray(0, width * height * 4) };
  }

  readFrameSafe(index) {
    if (index < 0 || index >= this.#offsets.length) return null;
    const fileOffset = this.#offsets[index];
    if (fileOffset <= 0) return null;
    try {
      return this.#readFrameAt(fileOffset);
    } catch {
      return null;
    }
  }
}

const libCache = new Map();

export function getMapLib(dataRoot, slot) {
  const relative = libRelativePath(slot);
  if (!relative) return null;
  const fullPath = path.join(dataRoot, relative);
  const key = fullPath;
  if (libCache.has(key)) return libCache.get(key);
  if (!fs.existsSync(fullPath)) return null;
  const lib = new CrystalMapLib(fullPath);
  libCache.set(key, lib);
  return lib;
}

export function backTileIndex(backValue) {
  if (!backValue) return -1;
  return (backValue & 0x1fffffff) - 1;
}

export function frontTileIndex(frontValue) {
  if (!frontValue) return -1;
  return (frontValue & 0x7fff) - 1;
}

export function packBackTile(index) {
  return index >= 0 ? (index + 1) : 0;
}

export function packMiddleTile(index) {
  return index >= 0 ? (index + 1) : 0;
}

export function packFrontTile(index) {
  return index >= 0 ? (index + 1) : 0;
}
