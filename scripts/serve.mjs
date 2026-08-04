import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(root, safePath);
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(extname(filePath)) || "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(4177, "127.0.0.1");
