import fs from "node:fs";

function parseMapType1(filePath) {
  const bytes = fs.readFileSync(filePath);
  let offSet = 21;
  const w = bytes.readInt16LE(offSet);
  offSet += 2;
  const xor = bytes.readInt16LE(offSet);
  offSet += 2;
  const h = bytes.readInt16LE(offSet);
  const width = w ^ xor;
  const height = h ^ xor;
  offSet = 54;

  const backImages = new Map();
  const middleImages = new Map();
  const frontByLib = new Map();
  let walkable = 0;
  let blocked = 0;

  const cellBytes = 15;
  const expectedCells = width * height;
  if (54 + expectedCells * cellBytes !== bytes.length) {
    console.warn(`size mismatch for ${filePath}: expected ${54 + expectedCells * cellBytes}, got ${bytes.length}`);
  }

  for (let i = 0; i < expectedCells; i++) {
      const backImage = bytes.readInt32LE(offSet) ^ 0xaa38aa38;
      offSet += 4;
      const middleImage = bytes.readInt16LE(offSet) ^ xor;
      offSet += 2;
      const frontImage = bytes.readInt16LE(offSet) ^ xor;
      offSet += 2;
      offSet += 1; // doorIndex (at S+8 after front)
      offSet += 1; // doorOffset
      offSet += 1; // frontAnimationFrame
      offSet += 1; // frontAnimationTick
      let frontIndex = bytes[offSet] + 2;
      offSet += 1; // frontIndex byte
      offSet += 1; // light
      offSet += 1; // unknown (next cell starts at offSet++)

      if (frontIndex === 102) frontIndex = 90;
      if (frontIndex >= 255) frontIndex = -1;

      const backBlocked = (backImage & 0x20000000) !== 0;
      const noFloor = (frontImage & 0x8000) !== 0; // actually middle check in server - use back for high wall
      if (backBlocked) blocked++;
      else walkable++;

      if (backImage > 0 && (backImage & 0x20000000) === 0) {
        backImages.set(backImage, (backImages.get(backImage) || 0) + 1);
      }
      if (middleImage > 0 && (middleImage & 0x8000) === 0) {
        const key = `lib1:${middleImage}`;
        middleImages.set(key, (middleImages.get(key) || 0) + 1);
      }
      if (frontIndex >= 0 && frontImage > 0 && (frontImage & 0x8000) === 0) {
        const key = `lib${frontIndex}:${frontImage}`;
        frontByLib.set(key, (frontByLib.get(key) || 0) + 1);
      }
    }

  const top = (map, n = 12) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} (${c})`);

  return { width, height, walkable, blocked, backImages: top(backImages), middleImages: top(middleImages), frontByLib: top(frontByLib) };
}

const maps = [
  ["SnakePre (Viper Cave 1)", "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/snakepre.map"],
  ["SnakePre2 (Viper Cave 2)", "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/snakepre2.map"],
  ["SNAKE (Yimoogi Nest)", "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/SNAKE.map"],
  ["LABY01 (Viper Maze)", "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/LABY01.map"],
  ["LABYROOM", "C:/Users/bb-we/Documents/Crystal-master/Next/NextClient/Map/LABYROOM.map"],
];

for (const [label, path] of maps) {
  const r = parseMapType1(path);
  console.log(`\n=== ${label} ===`);
  console.log(`Size: ${r.width}x${r.height}, walkable cells: ${r.walkable}, blocked: ${r.blocked}`);
  console.log("Top floor tiles (Tiles.Lib index 0):", r.backImages.join(", "));
  console.log("Top middle tiles (Smtiles lib 1):", r.middleImages.join(", "));
  console.log("Top front objects:", r.frontByLib.join(", "));
}
