// One self-contained HTML per document, the shape the artifact host wants: no doctype or <html>, the
// renderer and both vendored libraries inlined, and the Markdown carried in a script tag the app reads
// instead of fetching. Usage: node build.mjs docs/example.md [dist/out.html]
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const docRel = process.argv[2] || "docs/example.md";
const outFile = process.argv[3] || path.join("dist", path.basename(docRel, ".md") + ".html");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const src = read(docRel);
const title = (src.match(/^#\s+(.+)$/m) || [, path.basename(docRel)])[1].trim();
const stamp = ""+ new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const inlineDoc = src.replace(/<\/script/gi, "<\\/script");
const scripts = ["renderer/vendor/dagre.js", "renderer/vendor/prism.js", "renderer/vendor/markdown-it.min.js", "renderer/vendor/js-yaml.min.js", "renderer/lib.js", "renderer/app.js"];
const html = `<title>${title.replace(/[<&]/g, (c) => ({ "<": "&lt;", "&": "&amp;" }[c]))}</title>
<style>
${read("renderer/lib.css")}
${read("renderer/app.css")}
</style>
<nav class="toc" aria-label="Sections"><div class="toc-dashes"></div><div class="toc-panel"></div></nav>
<main></main>
<script type="text/markdown" id="doc-source" data-path="${docRel}" data-stamp="${stamp}">
${inlineDoc}
</script>
${scripts.map((s) => `<script>\n${read(s)}\n</script>`).join("\n")}
`;
fs.mkdirSync(path.dirname(path.join(ROOT, outFile)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outFile), html);
console.log(`wrote ${outFile} (${(html.length / 1024).toFixed(0)} KB) from ${docRel}`);
