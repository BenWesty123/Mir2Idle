// Reader for Crystal/WeMade version-1 .Lib files (DXT1/BC1 compressed frames).
// Format: int32 version(=1), int32 count, count*int32 offsets, then per image:
//   int16 Width, Height, X, Y, ShadowX, ShadowY; byte Shadow; int32 Length;
//   byte[Length] FBytes (DXT1); if (Shadow>>7): mask layer (same header + DXT1).
// Dimensions are padded up to a multiple of 4 for the DXT1 grid.
import fs from "node:fs";

function rgb565(c) {
  const r = (c >> 11) & 0x1f, g = (c >> 5) & 0x3f, b = c & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

// Decode DXT1 into RGBA at padded dimensions (pw x ph), then caller crops.
function decodeDxt1(data, pw, ph) {
  const out = Buffer.alloc(pw * ph * 4);
  const bw = pw / 4, bh = ph / 4;
  let p = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const c0 = data.readUInt16LE(p), c1 = data.readUInt16LE(p + 2);
      const bits = data.readUInt32LE(p + 4);
      p += 8;
      const col = [rgb565(c0), rgb565(c1), [0, 0, 0], [0, 0, 0]];
      const alpha = [255, 255, 255, 255];
      if (c0 > c1) {
        col[2] = [Math.round((2 * col[0][0] + col[1][0]) / 3), Math.round((2 * col[0][1] + col[1][1]) / 3), Math.round((2 * col[0][2] + col[1][2]) / 3)];
        col[3] = [Math.round((col[0][0] + 2 * col[1][0]) / 3), Math.round((col[0][1] + 2 * col[1][1]) / 3), Math.round((col[0][2] + 2 * col[1][2]) / 3)];
      } else {
        col[2] = [Math.round((col[0][0] + col[1][0]) / 2), Math.round((col[0][1] + col[1][1]) / 2), Math.round((col[0][2] + col[1][2]) / 2)];
        col[3] = [0, 0, 0]; alpha[3] = 0;
      }
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const idx = (bits >> (2 * (py * 4 + px))) & 0x3;
          const x = bx * 4 + px, y = by * 4 + py;
          const o = (y * pw + x) * 4;
          const c = col[idx];
          let a = alpha[idx];
          // Crystal treats pure black as transparent
          if (c[0] === 0 && c[1] === 0 && c[2] === 0) a = 0;
          out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = a;
        }
      }
    }
  }
  return out;
}

export class CrystalLibV1 {
  #fd;
  #offsets;
  constructor(filePath) {
    this.path = filePath;
    this.#fd = fs.openSync(filePath, "r");
    const head = Buffer.alloc(8);
    fs.readSync(this.#fd, head, 0, 8, 0);
    this.version = head.readInt32LE(0);
    this.count = head.readInt32LE(4);
    const table = Buffer.alloc(this.count * 4);
    fs.readSync(this.#fd, table, 0, this.count * 4, 8);
    this.#offsets = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) this.#offsets[i] = table.readInt32LE(i * 4);
  }
  close() { if (this.#fd != null) { fs.closeSync(this.#fd); this.#fd = null; } }

  readFrame(index) {
    if (index < 0 || index >= this.count) return null;
    const pos = this.#offsets[index];
    if (pos <= 0) return null;
    const hdr = Buffer.alloc(17);
    fs.readSync(this.#fd, hdr, 0, 17, pos);
    const width = hdr.readInt16LE(0), height = hdr.readInt16LE(2);
    const x = hdr.readInt16LE(4), y = hdr.readInt16LE(6);
    const shadow = hdr.readUInt8(12);
    const length = hdr.readInt32LE(13);
    if (width <= 0 || height <= 0 || length <= 0 || width > 2048 || height > 2048) return null;
    const data = Buffer.alloc(length);
    fs.readSync(this.#fd, data, 0, length, pos + 17);
    const pw = width + ((4 - (width % 4)) % 4);
    const ph = height + ((4 - (height % 4)) % 4);
    if (data.length < (pw / 4) * (ph / 4) * 8) return null;
    const padded = decodeDxt1(data, pw, ph);
    // crop to width x height
    const rgba = Buffer.alloc(width * height * 4);
    for (let row = 0; row < height; row++) padded.copy(rgba, row * width * 4, row * pw * 4, row * pw * 4 + width * 4);
    return { width, height, offsetX: x, offsetY: y, rgba };
  }
}
