// Static files plus one server-sent-events endpoint that says which file changed. No dependencies.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 4747);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".yaml": "text/yaml; charset=utf-8", ".yml": "text/yaml; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

// Every folder directly under docs/, gitignored ones included. Nothing is listed by name.
const DOCS = path.join(ROOT, "docs");
function folders() {
  if (!fs.existsSync(DOCS)) return [];
  return fs.readdirSync(DOCS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name).sort();
}

const clients = new Set();
let pending = new Map();
function broadcast(rel) {
  const msg = `data: ${JSON.stringify({ path: rel })}\n\n`;
  for (const res of clients) res.write(msg);
}
fs.watch(ROOT, { recursive: true }, (_event, file) => {
  if (!file) return;
  const rel = String(file).split(path.sep).join("/");
  if (rel.startsWith("dist/") || rel.startsWith(".git/") || rel.startsWith("node_modules/")) return;
  clearTimeout(pending.get(rel));
  pending.set(rel, setTimeout(() => { pending.delete(rel); broadcast(rel); console.log("changed", rel); }, 80));
});

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__reload") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write("retry: 500\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (u.pathname === "/__folders") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(folders()));
    return;
  }
  if (u.pathname === "/__docs") {
    // The directory: every document under docs/, newest edit first, with the frontmatter and
    // title the listing needs. Paths keep their folder. Read whole because the files are small.
    const out = [];
    for (const top of folders()) {
      (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.name.startsWith(".")) continue;
          if (e.isDirectory()) { walk(p); continue; }
          if (!/\.(md|ya?ml)$/.test(e.name)) continue;
          const st = fs.statSync(p), text = fs.readFileSync(p, "utf8");
          const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
          const h1 = text.match(/^#\s+(.+)$/m);
          out.push({ path: path.relative(DOCS, p).split(path.sep).join("/"), mtime: st.mtime.toISOString(),
            size: st.size, title: h1 ? h1[1].trim() : null, frontmatter: fm ? fm[1] : null });
        }
      })(path.join(DOCS, top));
    }
    out.sort((a, b) => b.mtime.localeCompare(a.mtime));
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(out));
    return;
  }
  let rel = decodeURIComponent(u.pathname);
  if (rel === "/" || rel.endsWith("/")) rel = "/index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (rel.endsWith(".md")) { res.writeHead(404); res.end("no such document"); return; }
    // Any other path is the app shell, so /?doc=... and deep links work.
    res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
    res.end(fs.readFileSync(path.join(ROOT, "index.html")));
    return;
  }
  const st = fs.statSync(file);
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store",
    "last-modified": st.mtime.toUTCString() });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`engdoc on http://localhost:${PORT}/  (each folder of docs/ lists its documents, /<folder>/<name> renders docs/<folder>/<name>.md)`));
