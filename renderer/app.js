/* The document layer. The URL is a path into docs/: "/" is the directory, newest edit first, and
   "/plans/ingest" renders docs/plans/ingest.md (or .yaml). A document is Markdown with Obsidian style
   frontmatter, figures as fenced YAML, and [[wiki links]] to other documents. Nothing here draws. */
(function () {
  "use strict";

  var KINDS = {
    seq: { mount: "seq-mount", pre: "data-spec" },
    flow: { mount: "flow-mount", pre: "data-flowspec" },
    erd: { mount: "erd-mount", pre: "data-erdspec" },
    tbl: { mount: "table-mount", pre: "data-tblspec" },
    cg: { mount: "cg-mount", pre: "data-cgspec" },
    screen: { mount: "screen-mount", pre: "data-screenspec" },
    tour: { mount: "tour-mount", pre: null },
    walk: { mount: null, pre: null }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var md = window.markdownit({ html: true, linkify: true, typographer: false });

  /* ---------- frontmatter and wiki links ---------- */

  function splitFrontmatter(src) {
    src = src.replace(/^\s*\n/, "");
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
    if (!m) { return { meta: {}, body: src }; }
    var meta = {};
    try { meta = window.jsyaml.load(m[1]) || {}; } catch (e) { meta = { _error: e.message }; }
    return { meta: meta, body: src.slice(m[0].length) };
  }

  /* [[page]] and [[page|label]] become links to /page. Lines inside fences are left alone. */
  function wikiLinks(body) {
    var inFence = false;
    return body.split("\n").map(function (line) {
      if (/^\s*```/.test(line)) { inFence = !inFence; return line; }
      if (inFence) { return line; }
      return line.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, target, label) {
        var t = target.trim().replace(/\.md$/, "");
        return "[" + (label || t) + "](/" + t.split("/").map(encodeURIComponent).join("/") + ")";
      });
    }).join("\n");
  }

  /* Title comes from the frontmatter, else the first h1, else the path. The h1 is lifted out of the
     body either way so it is never drawn twice. */
  function pickTitle(meta, tokens, fallback) {
    if (meta.title) { return { title: esc(meta.title), tokens: tokens }; }
    for (var i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type === "heading_open" && tokens[i].tag === "h1") {
        var text = md.renderer.renderInline(tokens[i + 1].children, md.options, {});
        return { title: text, tokens: tokens.slice(0, i).concat(tokens.slice(i + 3)) };
      }
    }
    return { title: esc(fallback), tokens: tokens };
  }

  /* The frontmatter box. It sits in the last tenth of the header, top right, one row per key that is
     set, so a reader sees what kind of document this is without it taking a line from the title. */
  function fmBox(meta, stamp) {
    var rows = [];
    var row = function (k, v, cls) { rows.push("<dt>" + esc(k) + '</dt><dd class="' + (cls || "") + '">' + v + "</dd>"); };
    if (meta.type) { row("type", esc(meta.type)); }
    if (meta.status) { row("status", esc(meta.status), "status status-" + String(meta.status).toLowerCase().replace(/[^a-z0-9]+/g, "-")); }
    var tags = [].concat(meta.tags || []);
    if (tags.length) { row("tags", tags.map(function (t) { return "#" + esc(String(t).replace(/^#/, "")); }).join(" ")); }
    if (meta.parent) {
      var p = String(meta.parent).replace(/^\[\[|\]\]$/g, "").replace(/\.md$/, "");
      row("parent", '<a href="/' + esc(p.split("/").map(encodeURIComponent).join("/")) + '">' + esc(p) + "</a>");
    }
    if (meta.order !== undefined && meta.order !== null && meta.order !== "") { row("order", esc(meta.order)); }
    if (meta.link) { row("link", '<a href="' + esc(meta.link) + '">' + esc(String(meta.link).replace(/^https?:\/\//, "").replace(/\/.*$/, "")) + "</a>"); }
    var created = meta["create-date"] || meta.created || meta.date;
    if (created) { row("created", esc(String(created instanceof Date ? created.toISOString().slice(0, 10) : created).split(",")[0])); }
    if (stamp) { row("edited", esc(stamp)); }
    if (meta._error) { row("frontmatter", esc(meta._error), "bad"); }
    return rows.length ? '<aside class="fm" aria-label="Document metadata"><dl>' + rows.join("") + "</dl></aside>" : "";
  }

  /* ---------- figures ---------- */

  function fenceInfo(token) {
    var bits = (token.info || "").trim().split(/\s+/);
    var kind = bits[0] || "", slug = bits[1] || "", flags = bits.slice(2);
    return { kind: kind, slug: slug, flags: flags, known: !!KINDS[kind] || kind === "erd-key" || kind === "html" };
  }

  function figureFor(info, content, errors) {
    if (info.kind === "html") { return { html: content, wide: info.flags.indexOf("wide") >= 0 }; }
    if (info.kind === "erd-key") {
      return { html: '<figure class="figcard"><div class="scroll erd-key-mount"></div>' +
                     '<div class="tblock"><div class="nm">' + esc(info.slug || "erd/crows-foot-key") + "</div></div></figure>", wide: false };
    }
    var spec;
    try { spec = window.jsyaml.load(content); }
    catch (e) { errors.push(info.slug + ": " + e.message); return { html: '<div class="doc-error">' + esc(info.slug + ": " + e.message) + "</div>", wide: false }; }
    if (!info.slug) { errors.push(info.kind + " fence without a slug"); }
    return { html: figureHtml(info.kind, info.slug || ("anon-" + Math.random().toString(36).slice(2)), spec), wide: info.flags.indexOf("wide") >= 0 };
  }

  function figureHtml(kind, key, spec) {
    window.EngDoc.registries[kind][key] = spec;
    var k = KINDS[kind];
    if (kind === "walk") {
      return '<div class="wt" data-wt="' + esc(key) + '" tabindex="0" role="group" aria-label="' + esc(spec.title || key) + '">' +
             '<div class="wt-stage"></div><div class="wt-bar">' +
             '<button class="wt-prev" type="button" aria-label="Previous step">&#9664;</button>' +
             '<input class="wt-range" type="range" min="0" max="1" value="0" aria-label="Step">' +
             '<button class="wt-next" type="button" aria-label="Next step">&#9654;</button>' +
             '<span class="wt-count"></span></div><p class="wt-note"></p></div>' +
             '<div class="tblock" style="border-top:none; margin-top:8px"><div class="nm">' + esc(key) + "</div></div>";
    }
    if (kind === "tour") { return '<div class="tour-mount" data-ex="' + esc(key) + '"></div>'; }
    return '<figure class="figcard"><div class="scroll"><div class="' + k.mount + '" data-ex="' + esc(key) + '"></div></div>' +
           '<details class="specview"><summary>view spec</summary><button class="speccopy" type="button">copy yaml</button>' +
           "<pre " + k.pre + '="' + esc(key) + '"></pre></details>' +
           '<div class="tblock"><div class="nm">' + esc(key) + "</div></div></figure>";
  }

  /* ---------- prose ---------- */

  /* Idea and support. Plain text is support wherever it sits: a paragraph, a list item at any depth,
     a table cell. Bold is the authoring notation for an idea, and every bold span, wherever it falls in
     the run, becomes one. The output never carries weight: brightness is the whole signal. */
  function ideaSupport(inline) {
    var ch = inline.children || [];
    while (ch.length && ch[0].type === "text" && ch[0].content === "") { ch.shift(); }
    if (!ch.length) { return; }
    for (var i = 0; i < ch.length; i++) {
      if (ch[i].type === "strong_open") { ch[i] = tok("html_inline", '<span class="idea">'); }
      else if (ch[i].type === "strong_close") { ch[i] = tok("html_inline", "</span>"); }
    }
    ch.unshift(tok("html_inline", '<span class="support">'));
    ch.push(tok("html_inline", "</span>"));
  }
  function tok(type, content) { var t = new md.core.State.prototype.Token(type, "", 0); t.content = content; return t; }

  function prepare(tokens) {
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === "bullet_list_open") { t.attrJoin("class", "pts"); }
      if (t.type === "ordered_list_open") { t.attrJoin("class", "shows"); }
      if (t.type === "heading_open" && t.tag === "h4") { t.attrJoin("class", "notes-h"); }
      if (t.type === "heading_open" && t.tag === "h2") { t.attrJoin("class", "part"); }
      if (t.type === "inline" && i > 0 && (tokens[i - 1].type === "paragraph_open" || tokens[i - 1].type === "td_open")) {
        ideaSupport(t);
      }
    }
  }

  function renderTokens(tokens) { return tokens.length ? md.renderer.render(tokens, md.options, {}) : ""; }

  function topLevelBlocks(tokens) {
    var blocks = [], i = 0;
    while (i < tokens.length) {
      var t = tokens[i];
      if (t.nesting === 1) {
        var j = i + 1;
        while (j < tokens.length && !(tokens[j].nesting === -1 && tokens[j].level === t.level)) { j++; }
        blocks.push(tokens.slice(i, j + 1)); i = j + 1;
      } else { blocks.push([t]); i++; }
    }
    return blocks;
  }
  function isHeading(block, tag) { return block[0].type === "heading_open" && (!tag || block[0].tag === tag); }
  function flat(blocks) { return [].concat.apply([], blocks); }

  /* ---------- page ---------- */

  function clearRegistries() {
    var reg = window.EngDoc.registries;
    Object.keys(reg).forEach(function (k) { Object.keys(reg[k]).forEach(function (key) { delete reg[k][key]; }); });
  }

  function renderDoc(src, ctx) {
    clearRegistries();
    var fm = splitFrontmatter(src), errors = [];
    var tokens = md.parse(wikiLinks(fm.body), {});
    prepare(tokens);
    var picked = pickTitle(fm.meta, tokens, ctx.path);
    var blocks = topLevelBlocks(picked.tokens);

    var head = [], cur = null, sections = [];
    function flush() { if (cur) { sections.push(cur); cur = null; } }
    function open(h3) { flush(); cur = { h3: h3, rail: [], figs: [], wide: false }; }
    blocks.forEach(function (b) {
      if (isHeading(b, "h2")) { flush(); sections.push({ part: renderTokens(b) }); return; }
      if (isHeading(b, "h3")) { open(b); return; }
      if (!cur && sections.length === 0) { head.push(b); return; }
      if (!cur) { open(null); }
      if (b[0].type === "fence") {
        var info = fenceInfo(b[0]);
        if (info.known) {
          var fig = figureFor(info, b[0].content, errors);
          cur.figs.push(fig.html); if (fig.wide) { cur.wide = true; }
          return;
        }
      }
      cur.rail.push(b);
    });
    flush();

    var out = '<header class="doc-head"><div class="head-main"><h1>' + picked.title + "</h1>" +
              (head.length ? renderTokens(flat(head)) : "") + "</div>" + fmBox(fm.meta, ctx.stamp) + "</header>";
    sections.forEach(function (s) {
      if (s.part) { out += s.part; return; }
      var rail = renderTokens(flat(s.rail)), h3 = s.h3 ? renderTokens(s.h3) : "";
      if (!s.figs.length) { out += '<div class="section cols-1">' + h3 + '<div class="blk">' + rail + "</div></div>"; }
      else {
        out += '<div class="section' + (s.wide ? " wide" : "") + '">' + h3 + '<div class="rail">' + rail + "</div>" +
               '<div class="figure">' + s.figs.join("") + "</div></div>";
      }
    });
    if (errors.length) { out = '<div class="doc-errors">' + errors.map(esc).join("<br>") + "</div>" + out; }
    return { html: out, title: picked.title.replace(/<[^>]+>/g, "") };
  }

  /* A .yaml document is one figure: { kind, title?, ...spec }. */
  function renderYamlDoc(src, ctx) {
    clearRegistries();
    var spec;
    try { spec = window.jsyaml.load(src) || {}; }
    catch (e) { return { html: '<div class="doc-errors">' + esc(ctx.path + ": " + e.message) + "</div>", title: ctx.path }; }
    var kind = spec.kind, key = ctx.path.replace(/\.ya?ml$/, "");
    if (!KINDS[kind]) { return { html: '<div class="doc-errors">' + esc(ctx.path + ": kind must be one of " + Object.keys(KINDS).join(", ")) + "</div>", title: ctx.path }; }
    var body = {}; Object.keys(spec).forEach(function (k) { if (k !== "kind") { body[k] = spec[k]; } });
    return { html: '<header class="doc-head"><div class="head-main"><h1>' + esc(spec.title || key) + "</h1></div>" + fmBox(spec, ctx.stamp) + "</header>" +
                   '<div class="section wide"><div class="figure">' + figureHtml(kind, key, body) + "</div></div>",
             title: spec.title || key };
  }

  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) { return "just now"; }
    if (s < 3600) { return Math.round(s / 60) + " min ago"; }
    if (s < 86400) { return Math.round(s / 3600) + " h ago"; }
    if (s < 86400 * 14) { return Math.round(s / 86400) + " d ago"; }
    return iso.slice(0, 10);
  }

  /* The directory. A view into docs/, newest edit first, one row per file. */
  function renderIndex(list) {
    var rows = list.map(function (d) {
      var meta = {};
      if (d.frontmatter) { try { meta = window.jsyaml.load(d.frontmatter) || {}; } catch (e) { meta = {}; } }
      var href = "/" + d.path.replace(/\.md$/, "").split("/").map(encodeURIComponent).join("/");
      var title = meta.title || d.title || d.path;
      var chips = [];
      if (meta.type) { chips.push('<span class="meta-chip type">' + esc(meta.type) + "</span>"); }
      if (meta.status) { chips.push('<span class="meta-chip status">' + esc(meta.status) + "</span>"); }
      [].concat(meta.tags || []).forEach(function (t) { chips.push('<span class="meta-chip tag">#' + esc(String(t).replace(/^#/, "")) + "</span>"); });
      return '<li class="dir-row"><a class="dir-title" href="' + href + '">' + esc(title) + "</a>" +
             '<span class="dir-path">' + esc(d.path) + "</span>" +
             '<span class="dir-chips">' + chips.join("") + "</span>" +
             '<time class="dir-time" datetime="' + esc(d.mtime) + '" title="' + esc(d.mtime) + '">' + esc(ago(d.mtime)) + "</time></li>";
    });
    return "<header><h1>docs/</h1>" + '<p class="meta"><span class="meta-chip date">' + list.length + (list.length === 1 ? " document" : " documents") +
           ', newest edit first</span></p></header><ul class="dir">' + rows.join("") + "</ul>";
  }

  /* ---------- routing and painting ---------- */

  var root = document.querySelector("main");

  function paint(result) {
    var y = window.scrollY;
    root.innerHTML = result.html;
    try { window.EngDoc.mount(root); } catch (e) { console.error("engdoc mount", e); }
    document.title = result.title || "engdoc";
    window.EngDoc.rebuildToc();
    window.scrollTo(0, y);
  }

  function stampFrom(res) {
    var lm = res.headers.get("last-modified");
    return lm ? new Date(lm).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "";
  }

  function renderSource(path, src, stamp) {
    return /\.ya?ml$/.test(path) ? renderYamlDoc(src, { path: path, stamp: stamp }) : renderDoc(src, { path: path, stamp: stamp });
  }

  window.EngDocApp = { renderDoc: renderDoc, renderIndex: renderIndex, renderYamlDoc: renderYamlDoc, splitFrontmatter: splitFrontmatter };

  var inline = document.getElementById("doc-source");
  if (inline) {
    var ip = inline.getAttribute("data-path") || "doc.md";
    paint(renderSource(ip, inline.textContent, inline.getAttribute("data-stamp") || ""));
    return;
  }

  var current = { path: null, index: false };

  function fetchFirst(paths) {
    if (!paths.length) { return Promise.reject(new Error("not found")); }
    return fetch("/docs/" + paths[0], { cache: "no-store" }).then(function (r) {
      if (r.ok) { return r.text().then(function (t) { return { path: paths[0], text: t, res: r }; }); }
      return fetchFirst(paths.slice(1));
    });
  }

  function loadDoc(rel) {
    var candidates = /\.(md|ya?ml)$/.test(rel) ? [rel] : [rel + ".md", rel + ".yaml", rel + ".yml"];
    fetchFirst(candidates).then(function (got) {
      current = { path: got.path, index: false };
      paint(renderSource(got.path, got.text, stampFrom(got.res)));
    }).catch(function () {
      root.innerHTML = '<div class="doc-errors">' + esc("no document at docs/" + rel + " (.md or .yaml)") + '</div><p class="support"><a href="/">back to the directory</a></p>';
      window.EngDoc.rebuildToc();
    });
  }

  function loadIndex() {
    current = { path: null, index: true };
    fetch("/__docs", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (list) {
      root.innerHTML = renderIndex(list);
      document.title = "docs/";
      window.EngDoc.rebuildToc();
    });
  }

  function route() {
    var rel = decodeURIComponent(location.pathname.replace(/^\/+/, "")).replace(/^docs\//, "");
    if (!rel) { loadIndex(); } else { loadDoc(rel); }
  }
  route();

  /* The server says which file changed. The open document re-renders in place and keeps its scroll
     position, the directory refreshes for any document, and a renderer change reloads the page. */
  if (window.EventSource) {
    var es = new EventSource("/__reload");
    es.onmessage = function (e) {
      var path = (JSON.parse(e.data || "{}").path || "");
      if (/^renderer\//.test(path)) { location.reload(); return; }
      if (/^docs\//.test(path)) {
        if (current.index) { loadIndex(); }
        else if (current.path && path === "docs/" + current.path) { loadDoc(current.path); }
      }
    };
  }

})();
