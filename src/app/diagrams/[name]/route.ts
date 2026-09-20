import fs from "node:fs/promises";
import path from "node:path";

const DIAGRAMS_DIR = path.join(process.cwd(), "diagrams");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const fileName = path.basename(name);
  if (fileName !== name) {
    return new Response("Not found", { status: 404 });
  }

  const root = path.resolve(DIAGRAMS_DIR);
  const filePath = path.join(root, fileName);
  if (!filePath.startsWith(root + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return new Response("Not found", { status: 404 });
    }
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await fs.readFile(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}