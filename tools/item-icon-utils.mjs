import fs from "node:fs";
import path from "node:path";

export function frameFileName(frame) {
  return `frame_${String(frame).padStart(6, "0")}.png`;
}

export function reviewIconSourcePath(projectRoot, frame) {
  const fileName = frameFileName(frame);
  const tileReviewRoot = path.join(projectRoot, "tile-review");
  if (!fs.existsSync(tileReviewRoot)) return null;

  for (const entry of fs.readdirSync(tileReviewRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^items-icons-(\d+)-(\d+)$/);
    if (!match) continue;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (frame < start || frame > end) continue;
    const sourcePath = path.join(tileReviewRoot, entry.name, "images", fileName);
    if (fs.existsSync(sourcePath)) return sourcePath;
  }

  const fallback = path.join(tileReviewRoot, "items-icons-000000-001999/images", fileName);
  return fs.existsSync(fallback) ? fallback : null;
}

export function copyItemIcon(
  projectRoot,
  frame,
  publicIconRoot = path.join(projectRoot, "public/item-icons/items"),
) {
  const sourcePath = reviewIconSourcePath(projectRoot, frame);
  if (!sourcePath) return false;
  const outputPath = path.join(publicIconRoot, frameFileName(frame));
  fs.mkdirSync(publicIconRoot, { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
  return true;
}
