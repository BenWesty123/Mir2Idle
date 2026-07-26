// Crystal .Lib version >= 2 reader (gzip BGRA frames). Used by NextClient Data/Monster.
import fs from "node:fs";
import zlib from "node:zlib";

export class CrystalLibV3 {
  #fd;
  #offsets;
  constructor(filePath) {
    this.path = filePath;
    this.#fd = fs.openSync(filePath, "r");
    const head = Buffer.alloc(12);
    fs.readSync(this.#fd, head, 0, 12, 0);
    this.version = head.readInt32LE(0);
    this.count = head.readInt32LE(4);
    let tableAt = 8;
    if (this.version >= 3) {
      this.frameSeek = head.readInt32LE(8);
      tableAt = 12;
    }
    const table = Buffer.alloc(this.count * 4);
    fs.readSync(this.#fd, table, 0, this.count * 4, tableAt);
    this.#offsets = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) this.#offsets[i] = table.readInt32LE(i * 4);
  }
  close() {
    if (this.#fd != null) {
      fs.closeSync(this.#fd);
      this.#fd = null;
    }
  }
  readFrame(index) {
    if (index < 0 || index >= this.count) return null;
    const pos = this.#offsets[index];
    if (pos <= 0) return null;
    const hdr = Buffer.alloc(17);
    fs.readSync(this.#fd, hdr, 0, 17, pos);
    const width = hdr.readInt16LE(0);
    const height = hdr.readInt16LE(2);
    const x = hdr.readInt16LE(4);
    const y = hdr.readInt16LE(6);
    const shadow = hdr.readUInt8(12);
    const length = hdr.readInt32LE(13);
    if (width <= 0 || height <= 0 || length <= 0 || width > 4096 || height > 4096) return null;
    const compressed = Buffer.alloc(length);
    fs.readSync(this.#fd, compressed, 0, length, pos + 17);
    let raw;
    try {
      raw = zlib.gunzipSync(compressed);
    } catch {
      return null;
    }
    if (raw.length < width * height * 4) return null;
    // Crystal stores BGRA; convert to RGBA.
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      rgba[o] = raw[o + 2];
      rgba[o + 1] = raw[o + 1];
      rgba[o + 2] = raw[o];
      rgba[o + 3] = raw[o + 3];
    }
    return { width, height, offsetX: x, offsetY: y, rgba };
  }
}
