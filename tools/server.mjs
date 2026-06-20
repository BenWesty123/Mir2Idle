import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 4177);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    let requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    if (requested.endsWith("/")) requested += "index.html";
    let filePath = normalize(join(root, requested));
    if (!filePath.startsWith(normalize(root))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      if (extname(filePath)) throw new Error("not found");
      filePath = join(filePath, "index.html");
      body = await readFile(filePath);
    }
    res.writeHead(200, {
      "content-type": types[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store, max-age=0",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`LOM Idle V2 running at http://localhost:${port}`);
});
