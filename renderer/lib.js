
(function () {
  "use strict";

  var COL = {
    ink: "var(--ink)",
    soft: "var(--ink-soft)",
    faint: "var(--ink-faint)",
    line: "var(--line)",
    surface: "var(--surface)",
    surface2: "var(--surface2)",
    act: "var(--act)",
    actSoft: "var(--act-soft)",
    fail: "var(--crash)",
    noteBg: "var(--note-bg)",
    noteEdge: "var(--note-edge)",
    noteInk: "var(--note-ink)"
  };

  /* One source of truth for note geometry: the layout needs it to size the canvas and the renderer
     needs it to draw the box. They drifted apart, which is how a long note got clipped. */
  function noteWidth(n) {
    return Math.max(String(n.label).length * 6.8 + 26, n.span + 90, 130);
  }

  function noteExtent(notes) {
    var right = 0;
    notes.forEach(function (n) { right = Math.max(right, n.cx + noteWidth(n) / 2); });
    return right;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Layout engine: walks a spec's steps top-to-bottom, assigning y positions,
     tracking activation bars, and measuring frames. */
  function layoutSequence(spec) {
    var actors = spec.actors;
    var SP = spec.spacing || 172;
    var X0 = 108;
    var ROW = 44;
    var LIFE_TOP = 52;

    var ai = {};
    actors.forEach(function (a, i) { ai[a.id] = i; });
    var ax = function (id) { return X0 + ai[id] * SP; };

    var msgs = [], selfs = [], notes = [], frames = [], acts = [], bands = [];
    var actStacks = {};
    /* A lifeline runs top-to-bottom unless a create/destroy narrows it. */
    var lifeStart = {}, lifeEnd = {}, born = {};
    actors.forEach(function (a) { actStacks[a.id] = []; lifeStart[a.id] = LIFE_TOP; });

    var num = 0;
    var y = LIFE_TOP;

    function openAct(id, yy) { actStacks[id].push(yy); }
    function closeAct(id, yy) {
      var s = actStacks[id].pop();
      if (s != null) acts.push({ id: id, y0: s, y1: yy });
    }

    function walk(steps, depth) {
      var minI = Infinity, maxI = -Infinity;
      var see = function (id) {
        minI = Math.min(minI, ai[id]);
        maxI = Math.max(maxI, ai[id]);
      };

      steps.forEach(function (s) {
        if (s.type === "divider") {
          y += 26;
          bands.push({ y: y, label: s.label });
          y += 14;
        } else if (s.type === "create") {
          y += ROW;
          see(s.actor);
          born[s.actor] = y;
          lifeStart[s.actor] = y + 18;
          y += 8;
        } else if (s.type === "destroy") {
          y += ROW - 12;
          see(s.actor);
          lifeEnd[s.actor] = y;
        } else if (s.type === "msg") {
          y += ROW;
          see(s.from); see(s.to);
          if (spec.autonumber) { num += 1; }
          var x1r = ax(s.from), x2r = ax(s.to);
          var dir = x2r > x1r ? 1 : -1;
          var srcActive = actStacks[s.from].length > 0;
          var tgtWillBeActive = actStacks[s.to].length > 0 || (s.kind === "sync" && s.activate !== false);
          var x1 = x1r + (srcActive ? 5 * dir : 0);
          var x2 = x2r - (tgtWillBeActive ? 5 * dir : 0);
          msgs.push(Object.assign({}, s, { y: y, x1: x1, x2: x2, dir: dir, n: spec.autonumber ? num : null }));
          if (s.kind === "sync" && s.activate !== false) openAct(s.to, y);
          if (s.kind === "return" && s.deactivate !== false) closeAct(s.from, y);
        } else if (s.type === "self") {
          y += ROW;
          see(s.actor);
          var active = actStacks[s.actor].length > 0;
          if (spec.autonumber) { num += 1; }
          selfs.push(Object.assign({}, s, { y: y, x: ax(s.actor) + (active ? 5 : 0), n: spec.autonumber ? num : null }));
          y += 10;
        } else if (s.type === "note") {
          y += ROW;
          var ids = s.over || [s.actor];
          ids.forEach(see);
          var xs = ids.map(ax);
          notes.push(Object.assign({}, s, {
            y: y - 20,
            cx: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2,
            span: Math.max.apply(null, xs) - Math.min.apply(null, xs)
          }));
          y += 2;
        } else if (s.type === "activate") {
          openAct(s.actor, y + 6);
          see(s.actor);
        } else if (s.type === "deactivate") {
          closeAct(s.actor, y + ROW * 0.4);
        } else if (s.type === "gap") {
          y += s.h || 18;
        } else if (s.type === "block") {
          var y0 = y + 18;
          y = y0 + 8;
          var dividers = [];
          var ext = { minI: Infinity, maxI: -Infinity };
          s.sections.forEach(function (sec, k) {
            if (k > 0) {
              y += 12;
              dividers.push({ y: y, label: sec.label });
              y += 6;
            }
            var e = walk(sec.steps, depth + 1);
            ext.minI = Math.min(ext.minI, e.minI);
            ext.maxI = Math.max(ext.maxI, e.maxI);
          });
          y += 20;
          frames.push({
            kind: s.kind,
            firstGuard: s.sections[0].label,
            y0: y0, y1: y,
            minI: ext.minI, maxI: ext.maxI,
            depth: depth, dividers: dividers
          });
          minI = Math.min(minI, ext.minI);
          maxI = Math.max(maxI, ext.maxI);
        }
      });
      return { minI: minI, maxI: maxI };
    }

    walk(spec.steps, 0);

    var bottom = y + 30;
    actors.forEach(function (a) {
      while (actStacks[a.id].length) closeAct(a.id, bottom - 16);
    });

    actors.forEach(function (a) {
      if (lifeEnd[a.id] === undefined) { lifeEnd[a.id] = bottom; }
    });

    return {
      actors: actors, ax: ax, lifeStart: lifeStart, lifeEnd: lifeEnd, born: born, bands: bands,
      msgs: msgs, selfs: selfs, notes: notes, frames: frames, acts: acts,
      X0: X0, SP: SP, LIFE_TOP: LIFE_TOP, bottom: bottom,
      /* Notes are sized from their own text, so one wider than the actor span used to run past the
         viewBox and get clipped. The canvas grows to cover them instead. */
      width: Math.ceil(Math.max(X0 * 2 + SP * (actors.length - 1), noteExtent(notes) + 14)),
      height: bottom + 8
    };
  }

  /* Renderer: spec -> SVG markup string. All colors are CSS custom properties
     so the figure follows the page theme. */
  function renderSequence(spec, uid) {
    var L = layoutSequence(spec);
    var m = function (name) { return "url(#" + uid + "-" + name + ")"; };
    var out = [];

    out.push('<svg class="seq" viewBox="0 0 ' + L.width + " " + L.height + '" style="width:100%; max-width:' + L.width + "px; min-width:" + L.width + 'px; display:block" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(spec.title) + '">');

    out.push("<defs>");
    out.push('<marker id="' + uid + '-sync" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 Z" fill="' + COL.ink + '"/></marker>');
    out.push('<marker id="' + uid + '-open" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 1.5 L8.5 5 L2 8.5" fill="none" stroke="' + COL.ink + '" stroke-width="1.4" stroke-linecap="round"/></marker>');
    out.push('<marker id="' + uid + '-syncFail" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 Z" fill="' + COL.fail + '"/></marker>');
    out.push('<marker id="' + uid + '-openFail" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 1.5 L8.5 5 L2 8.5" fill="none" stroke="' + COL.fail + '" stroke-width="1.4" stroke-linecap="round"/></marker>');
    out.push("</defs>");

    L.actors.forEach(function (a) {
      out.push('<line x1="' + L.ax(a.id) + '" y1="' + L.lifeStart[a.id] + '" x2="' + L.ax(a.id) + '" y2="' + L.lifeEnd[a.id] + '" stroke="' + COL.faint + '" stroke-width="1" stroke-dasharray="4 4"/>');
    });

    /* Phase dividers: a full-width band, the sequence analogue of a section heading. */
    L.bands.forEach(function (d) {
      var tw = String(d.label).length * 6.4 + 26, cx = L.width / 2;
      out.push('<line x1="14" y1="' + d.y + '" x2="' + (L.width - 14) + '" y2="' + d.y + '" stroke="' + COL.faint + '" stroke-width="1.2"/>');
      out.push('<rect x="' + (cx - tw / 2) + '" y="' + (d.y - 11) + '" width="' + tw + '" height="22" rx="3" fill="' + COL.surface2 + '" stroke="' + COL.faint + '" stroke-width="1.2"/>');
      out.push('<text x="' + cx + '" y="' + (d.y + 4) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="' + COL.soft + '" letter-spacing="0.06em">' + esc(d.label) + "</text>");
    });

    L.frames.forEach(function (f) {
      var fx0 = L.X0 + f.minI * L.SP - 58 + f.depth * 14;
      var fx1 = L.X0 + f.maxI * L.SP + 64 - f.depth * 14;
      var tw = f.kind.length * 8 + 18;
      out.push("<g>");
      out.push('<rect x="' + fx0 + '" y="' + f.y0 + '" width="' + (fx1 - fx0) + '" height="' + (f.y1 - f.y0) + '" fill="none" stroke="' + COL.faint + '" stroke-width="1.2" rx="2"/>');
      out.push('<path d="M' + fx0 + " " + f.y0 + " H" + (fx0 + tw) + " V" + (f.y0 + 12) + " L" + (fx0 + tw - 7) + " " + (f.y0 + 19) + " H" + fx0 + ' Z" fill="' + COL.surface2 + '" stroke="' + COL.faint + '" stroke-width="1.2"/>');
      out.push('<text x="' + (fx0 + 8) + '" y="' + (f.y0 + 13.5) + '" font-size="11" font-weight="700" fill="' + COL.ink + '">' + esc(f.kind) + "</text>");
      if (f.firstGuard) {
        out.push('<text x="' + (fx0 + tw + 10) + '" y="' + (f.y0 + 13.5) + '" font-size="10.5" fill="' + COL.soft + '">[' + esc(f.firstGuard) + "]</text>");
      }
      f.dividers.forEach(function (d) {
        out.push('<line x1="' + fx0 + '" y1="' + d.y + '" x2="' + fx1 + '" y2="' + d.y + '" stroke="' + COL.faint + '" stroke-width="1" stroke-dasharray="5 4"/>');
        if (d.label) {
          out.push('<text x="' + (fx0 + 10) + '" y="' + (d.y + 14) + '" font-size="10.5" fill="' + COL.soft + '">[' + esc(d.label) + "]</text>");
        }
      });
      out.push("</g>");
    });

    L.acts.forEach(function (a) {
      out.push('<rect x="' + (L.ax(a.id) - 5) + '" y="' + a.y0 + '" width="10" height="' + Math.max(a.y1 - a.y0, 12) + '" fill="' + COL.actSoft + '" stroke="' + COL.act + '" stroke-width="1.1" rx="1.5"/>');
    });

    L.msgs.forEach(function (msg, mi) {
      var failed = msg.status === "fail";
      var color = failed ? COL.fail : COL.ink;
      var dashed = msg.kind === "return";
      var marker = failed
        ? (msg.kind === "sync" ? m("syncFail") : m("openFail"))
        : (msg.kind === "sync" ? m("sync") : m("open"));
      var midX = (msg.x1 + msg.x2) / 2;
      out.push('<g data-k="m' + mi + '">');
      out.push('<line x1="' + msg.x1 + '" y1="' + msg.y + '" x2="' + msg.x2 + '" y2="' + msg.y + '" stroke="' + color + '" stroke-width="1.4"' + (dashed ? ' stroke-dasharray="6 4"' : "") + ' marker-end="' + marker + '"/>');
      if (failed) {
        var xc = msg.x2 - msg.dir * 16;
        out.push('<g stroke="' + COL.fail + '" stroke-width="2" stroke-linecap="round">');
        out.push('<line x1="' + (xc - 5) + '" y1="' + (msg.y - 5) + '" x2="' + (xc + 5) + '" y2="' + (msg.y + 5) + '"/>');
        out.push('<line x1="' + (xc - 5) + '" y1="' + (msg.y + 5) + '" x2="' + (xc + 5) + '" y2="' + (msg.y - 5) + '"/>');
        out.push("</g>");
      }
      var tfill = failed ? COL.fail : (msg.kind === "return" ? COL.soft : COL.ink);
      var numPrefix = msg.n ? '<tspan fill="' + COL.faint + '" font-weight="700">' + msg.n + "</tspan>  " : "";
      out.push('<text x="' + midX + '" y="' + (msg.y - 8) + '" text-anchor="middle" font-size="11.5" fill="' + tfill + '" font-weight="' + (msg.kind === "sync" ? 600 : 400) + '">' + numPrefix + esc(msg.label) + "</text>");
      out.push("</g>");
    });

    L.selfs.forEach(function (s, si) {
      out.push('<g data-k="s' + si + '">');
      out.push('<path d="M' + s.x + " " + s.y + " H" + (s.x + 44) + " V" + (s.y + 20) + " H" + (s.x + 2) + '" fill="none" stroke="' + COL.ink + '" stroke-width="1.4" marker-end="' + m("sync") + '"/>');
      var sn = s.n ? '<tspan fill="' + COL.faint + '" font-weight="700">' + s.n + "</tspan>  " : "";
      out.push('<text x="' + (s.x + 54) + '" y="' + (s.y + 14) + '" font-size="11.5" fill="' + COL.soft + '">' + sn + esc(s.label) + "</text>");
      out.push("</g>");
    });

    L.notes.forEach(function (n, ni) {
      var w = noteWidth(n);
      var x = Math.max(8, Math.min(n.cx - w / 2, L.width - w - 8));
      var tx = x + w / 2;
      out.push('<g data-k="n' + ni + '">');
      out.push('<path d="M' + x + " " + n.y + " H" + (x + w - 12) + " L" + (x + w) + " " + (n.y + 12) + " V" + (n.y + 28) + " H" + x + ' Z" fill="' + COL.noteBg + '" stroke="' + COL.noteEdge + '" stroke-width="1.1"/>');
      out.push('<path d="M' + (x + w - 12) + " " + n.y + " V" + (n.y + 12) + " H" + (x + w) + '" fill="none" stroke="' + COL.noteEdge + '" stroke-width="1.1"/>');
      out.push('<text x="' + (tx - 4) + '" y="' + (n.y + 18.5) + '" text-anchor="middle" font-size="10.5" fill="' + COL.noteInk + '">' + esc(n.label) + "</text>");
      out.push("</g>");
    });

    L.actors.forEach(function (a) {
      var by = L.born[a.id] !== undefined ? L.born[a.id] - 18 : 16;
      out.push("<g>");
      out.push('<rect x="' + (L.ax(a.id) - 62) + '" y="' + by + '" width="124" height="36" rx="3" fill="' + COL.surface + '" stroke="' + COL.ink + '" stroke-width="1.3"/>');
      out.push('<text x="' + L.ax(a.id) + '" y="' + (by + 22.5) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + COL.ink + '">' + esc(a.label) + "</text>");
      out.push("</g>");
      if (L.lifeEnd[a.id] < L.bottom) {
        var dx = L.ax(a.id), dy = L.lifeEnd[a.id];
        out.push('<g stroke="' + COL.fail + '" stroke-width="2.4" stroke-linecap="round">');
        out.push('<line x1="' + (dx - 9) + '" y1="' + (dy - 9) + '" x2="' + (dx + 9) + '" y2="' + (dy + 9) + '"/>');
        out.push('<line x1="' + (dx - 9) + '" y1="' + (dy + 9) + '" x2="' + (dx + 9) + '" y2="' + (dy - 9) + '"/>');
        out.push("</g>");
      }
    });

    out.push("</svg>");
    return out.join("");
  }

  function renderLegend() {
    var out = [];
    out.push('<svg class="seq" viewBox="0 0 640 236" style="width:100%; max-width:640px; min-width:520px; display:block" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Notation key">');
    out.push("<defs>");
    out.push('<marker id="lg-sync" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 Z" fill="' + COL.ink + '"/></marker>');
    out.push('<marker id="lg-open" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 1.5 L8.5 5 L2 8.5" fill="none" stroke="' + COL.ink + '" stroke-width="1.4" stroke-linecap="round"/></marker>');
    out.push('<marker id="lg-failo" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 1.5 L8.5 5 L2 8.5" fill="none" stroke="' + COL.fail + '" stroke-width="1.4" stroke-linecap="round"/></marker>');
    out.push("</defs>");

    function label(y, text) {
      return '<text class="sans" x="215" y="' + (y + 4) + '" font-size="12" fill="' + COL.soft + '">' + esc(text) + "</text>";
    }

    out.push('<line x1="30" y1="24" x2="190" y2="24" stroke="' + COL.ink + '" stroke-width="1.4" marker-end="url(#lg-sync)"/>' + label(24, "sync call — blocking, filled head"));
    out.push('<line x1="30" y1="56" x2="190" y2="56" stroke="' + COL.ink + '" stroke-width="1.4" marker-end="url(#lg-open)"/>' + label(56, "async message — open head"));
    out.push('<line x1="30" y1="88" x2="190" y2="88" stroke="' + COL.ink + '" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#lg-open)"/>' + label(88, "return / response — dashed"));
    out.push('<g><line x1="30" y1="120" x2="190" y2="120" stroke="' + COL.fail + '" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#lg-failo)"/><g stroke="' + COL.fail + '" stroke-width="2" stroke-linecap="round"><line x1="169" y1="115" x2="179" y2="125"/><line x1="169" y1="125" x2="179" y2="115"/></g></g>' + label(120, "failed response — red, ✕ before head"));
    out.push('<rect x="102" y="143" width="10" height="18" rx="1.5" fill="' + COL.actSoft + '" stroke="' + COL.act + '" stroke-width="1.1"/>' + label(152, "activation bar — lifeline doing work"));
    out.push('<g><rect x="60" y="172" width="96" height="24" fill="none" stroke="' + COL.faint + '" stroke-width="1.2" rx="2"/><path d="M60 172 H92 V181 L86 187 H60 Z" fill="' + COL.surface2 + '" stroke="' + COL.faint + '" stroke-width="1.2"/><text x="66" y="181.5" font-size="9.5" font-weight="700" fill="' + COL.ink + '">alt</text></g>' + label(184, "frame — alt / loop / opt with [guards]"));
    out.push('<path d="M74 205 H134 L142 213 V227 H74 Z" fill="' + COL.noteBg + '" stroke="' + COL.noteEdge + '" stroke-width="1.1"/>' + label(216, "note — context / annotation"));

    out.push("</svg>");
    return out.join("");
  }

  var SPECS = {};


  /* ---------- component 02 · flowchart ---------- */
  /* Decision nodes are elongated hexagons, not diamonds: a diamond's area grows with the
     SQUARE of its label, so any real question ("did this fetch complete past the deadline?")
     either overflows or forces a comically tall figure. The chamfer keeps the diamond's
     diagonal read while the body grows horizontally like every other node. */
  var FL = { chamfer: 16, gapY: 30, gutter: 74, minW: 156, maxW: 430 };

  function textW(t, px, mono) { return String(t).length * px * (mono ? 0.605 : 0.55); }

  function flowSize(n) {
    var w = textW(n.label, 12, true) + 40;
    if (n.note) { w = Math.max(w, textW(n.note, 10.5, true) + 34); }
    if (n.type === "decision") { w += FL.chamfer * 2; }
    w = Math.max(FL.minW, Math.min(Math.round(w), FL.maxW));
    return { w: w, h: n.note ? 50 : 36 };
  }

  function toneOf(n) {
    if (n.tone === "good") { return { edge: COL.act, fill: COL.actSoft, ink: COL.act }; }
    if (n.tone === "fail") { return { edge: COL.fail, fill: "var(--crash-soft)", ink: COL.fail }; }
    if (n.tone === "muted") { return { edge: COL.line, fill: COL.surface2, ink: COL.soft }; }
    return { edge: COL.line, fill: COL.surface, ink: COL.ink };
  }

  function nodeShape(n, x, y, s) {
    var t = toneOf(n), r;
    if (n.type === "terminal") {
      r = '<rect x="' + x + '" y="' + y + '" width="' + s.w + '" height="' + s.h + '" rx="' + (s.h / 2) +
          '" fill="' + t.fill + '" stroke="' + t.edge + '" stroke-width="1.5"/>';
    } else if (n.type === "decision") {
      var c = FL.chamfer, x2 = x + s.w, ym = y + s.h / 2;
      r = '<path d="M' + (x + c) + ',' + y + ' H' + (x2 - c) + ' L' + x2 + ',' + ym + ' L' + (x2 - c) + ',' + (y + s.h) +
          ' H' + (x + c) + ' L' + x + ',' + ym + ' Z" fill="' + t.fill + '" stroke="' + t.edge + '" stroke-width="1.5"/>';
    } else {
      r = '<rect x="' + x + '" y="' + y + '" width="' + s.w + '" height="' + s.h + '" rx="6" fill="' + t.fill +
          '" stroke="' + t.edge + '" stroke-width="1.5"/>';
    }
    var cx = x + s.w / 2, ly = n.note ? y + s.h / 2 - 3 : y + s.h / 2 + 4;
    r += '<text x="' + cx + '" y="' + ly + '" text-anchor="middle" style="font:700 12px var(--mono); fill:' + t.ink + '">' + esc(n.label) + "</text>";
    if (n.note) {
      r += '<text x="' + cx + '" y="' + (y + s.h / 2 + 14) + '" text-anchor="middle" style="font:10.5px var(--mono); fill:' + COL.soft + '">' + esc(n.note) + "</text>";
    }
    return r;
  }

  /* Spine layout: nodes flow top-to-bottom in spec order. A node with lane:"right" leaves the
     spine and parks in the right gutter at the row of whichever node points at it. */
  function layoutFlow(spec) {
    var byId = {}, spine = [], gutter = [];
    spec.nodes.forEach(function (n) {
      byId[n.id] = { n: n, s: flowSize(n) };
      (n.lane === "right" ? gutter : spine).push(n.id);
    });
    var maxSpineW = 0, maxGutW = 0;
    spine.forEach(function (id) { maxSpineW = Math.max(maxSpineW, byId[id].s.w); });
    gutter.forEach(function (id) { maxGutW = Math.max(maxGutW, byId[id].s.w); });

    var hasLoop = (spec.edges || []).some(function (e) { return e.side === "left"; });
    var leftPad = hasLoop ? 62 : 14;
    var cx = leftPad + maxSpineW / 2;
    var gutX = cx + maxSpineW / 2 + FL.gutter;

    var y = 14;
    spine.forEach(function (id) {
      var it = byId[id];
      it.x = cx - it.s.w / 2; it.y = y; it.cx = cx; it.cy = y + it.s.h / 2;
      y += it.s.h + FL.gapY;
    });
    (spec.edges || []).forEach(function (e) {
      if (e.side !== "right") { return; }
      var src = byId[e.from], dst = byId[e.to];
      if (!src || !dst || dst.x !== undefined) { return; }
      dst.x = gutX; dst.y = src.cy - dst.s.h / 2; dst.cx = gutX + dst.s.w / 2; dst.cy = src.cy;
    });
    gutter.forEach(function (id) {
      var it = byId[id];
      if (it.x === undefined) { it.x = gutX; it.y = 14; it.cx = gutX + it.s.w / 2; it.cy = 14 + it.s.h / 2; }
    });
    return { byId: byId, spine: spine, w: Math.ceil(gutX + (maxGutW || 0) + 16), h: Math.ceil(y + 4), cx: cx, leftX: leftPad - 14 };
  }

  function renderFlow(spec, uid) {
    var L = layoutFlow(spec), B = L.byId, out = "", i;
    var mk = function (id, c) {
      return '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
             '<path d="M0,0 L10,5 L0,10 z" fill="' + c + '"/></marker>';
    };
    var defs = "<defs>" + mk(uid + "-a", COL.soft) + mk(uid + "-g", COL.act) + mk(uid + "-f", COL.fail) + "</defs>";
    var arrow = function (tone) { return tone === "good" ? uid + "-g" : tone === "fail" ? uid + "-f" : uid + "-a"; };
    var stroke = function (tone) { return tone === "good" ? COL.act : tone === "fail" ? COL.fail : COL.soft; };

    (spec.groups || []).forEach(function (g) {
      var xs = [], ys = [], ye = [];
      g.nodes.forEach(function (id) { var it = B[id]; if (it) { xs.push(it.x); ys.push(it.y); ye.push(it.y + it.s.h); } });
      if (!xs.length) { return; }
      var gx = Math.min.apply(null, xs) - 26, gy = Math.min.apply(null, ys) - 26;
      var gw = (Math.max.apply(null, xs.map(function (x, k) { return x + B[g.nodes[k]].s.w; })) + 26) - gx;
      var gh = (Math.max.apply(null, ye) + 22) - gy;
      out += '<rect x="' + gx + '" y="' + gy + '" width="' + gw + '" height="' + gh + '" rx="8" fill="none" stroke="' + COL.act +
             '" stroke-width="1.3" stroke-dasharray="7 5"/>';
      out += '<rect x="' + gx + '" y="' + gy + '" width="' + (textW(g.label, 10, true) + 20) + '" height="18" fill="' + COL.surface2 +
             '" stroke="' + COL.act + '" stroke-width="1.3"/>';
      out += '<text x="' + (gx + 10) + '" y="' + (gy + 13) + '" style="font:700 10px var(--mono); fill:' + COL.act + '">' + esc(g.label) + "</text>";
      if (g.note) { out += '<text x="' + (gx + textW(g.label, 10, true) + 30) + '" y="' + (gy + 13) + '" style="font:10.5px var(--mono); fill:' + COL.soft + '">' + esc(g.note) + "</text>"; }
    });

    (spec.edges || []).forEach(function (e) {
      var a = B[e.from], b = B[e.to];
      if (!a || !b) { return; }
      var col = stroke(e.tone), am = arrow(e.tone), p = "";
      var ek = e.from + "~" + e.to;
      if (e.side === "right") {
        p = '<path d="M' + (a.x + a.s.w) + ',' + a.cy + ' H' + b.x + '" fill="none" stroke="' + col + '" stroke-width="1.6" marker-end="url(#' + am + ')"/>';
        if (e.label) { p += '<text x="' + ((a.x + a.s.w + b.x) / 2) + '" y="' + (a.cy - 7) + '" text-anchor="middle" style="font:700 10px var(--mono); fill:' + col + '">' + esc(e.label) + "</text>"; }
      } else if (e.side === "left") {
        var lx = L.leftX;
        p = '<path d="M' + a.x + ',' + a.cy + ' H' + lx + ' V' + b.cy + ' H' + b.x + '" fill="none" stroke="' + col +
            '" stroke-width="1.6" marker-end="url(#' + am + ')"/>';
        if (e.label) { p += '<text x="' + (lx + 7) + '" y="' + ((a.cy + b.cy) / 2) + '" style="font:700 10px var(--mono); fill:' + col + '">' + esc(e.label) + "</text>"; }
      } else {
        p = '<line x1="' + a.cx + '" y1="' + (a.y + a.s.h) + '" x2="' + b.cx + '" y2="' + (b.y - 2) + '" stroke="' + col +
            '" stroke-width="1.6" marker-end="url(#' + am + ')"/>';
        if (e.label) { p += '<text x="' + (a.cx + 10) + '" y="' + ((a.y + a.s.h + b.y) / 2 + 4) + '" style="font:700 10px var(--mono); fill:' + col + '">' + esc(e.label) + "</text>"; }
        if (e.note) { p += '<text x="' + (a.cx + 10) + '" y="' + ((a.y + a.s.h + b.y) / 2 + 17) + '" style="font:10px var(--mono); fill:' + COL.soft + '">' + esc(e.note) + "</text>"; }
      }
      out += '<g data-k="' + esc(ek) + '">' + p + "</g>";
    });

    spec.nodes.forEach(function (n) {
      var it = B[n.id];
      out += '<g data-k="' + esc(n.id) + '">' + nodeShape(n, it.x, it.y, it.s) + "</g>";
    });

    return '<svg class="seq" viewBox="0 0 ' + L.w + " " + L.h + '" role="img" aria-label="' + esc(spec.alt || spec.title || "flowchart") +
           '" style="width:100%; min-width:' + Math.min(L.w, 680) + 'px; height:auto; display:block">' + defs + out + "</svg>";
  }

  var FLOWS = {};


  /* ---------- component 05 · entity relationship diagram ---------- */
  /* Crow's-foot notation. Every relationship end carries two marks: cardinality (one = bar,
     many = foot) and modality (mandatory = bar, optional = circle). Edges anchor at a named
     COLUMN, not at the table box, so a foreign key points from the row that holds it. */
  var ER = { headH: 30, rowH: 22, minW: 194, maxW: 340, gutterX: 118, gutterY: 46, pad: 14 };

  /* signs widens every row by one glyph, so a diff sign fits between the key badge and the type. */
  function erdTableSize(t, signs) {
    var w = textW(t.label, 12.5, true) + 44;
    t.columns.forEach(function (c) {
      w = Math.max(w, textW(c.name, 11.5, true) + textW(c.type || "", 10.5, true) + 74 + (signs ? 14 : 0));
    });
    return { w: Math.max(ER.minW, Math.min(Math.round(w), ER.maxW)), h: ER.headH + t.columns.length * ER.rowH + 6 };
  }

  /* spec.layout === "auto" hands placement to dagre (inlined above as ErdAuto): a layered
     left-to-right rank assignment, which is what a schema of any size actually needs. The
     grid path below stays for small figures, where hand placement reads better than a solver. */
  function layoutErdAuto(spec) {
    var g = new ErdAuto.Graph({ directed: true });
    g.setGraph({ rankdir: spec.rankdir || "LR", nodesep: 46, ranksep: 132, marginx: 14, marginy: 14 });
    g.setDefaultEdgeLabel(function () { return {}; });
    var T = {};
    spec.tables.forEach(function (t) {
      var sz = erdTableSize(t, !!spec.diff);
      T[t.id] = { t: t, s: sz };
      g.setNode(t.id, { width: sz.w, height: sz.h });
    });
    (spec.rels || []).forEach(function (r) {
      var f = String(r.from).split(".")[0], to = String(r.to).split(".")[0];
      if (T[f] && T[to] && f !== to) { g.setEdge(f, to); }
    });
    ErdAuto.layout(g);
    spec.tables.forEach(function (t) {
      var n = g.node(t.id), it = T[t.id];
      it.x = Math.round(n.x - it.s.w / 2); it.y = Math.round(n.y - it.s.h / 2);
      it.x1 = it.x + it.s.w; it.y1 = it.y + it.s.h;
    });
    return { T: T, w: Math.ceil(g.graph().width), h: Math.ceil(g.graph().height) };
  }

  /* Placement is dagre's job by default. A spec opts out by placing its tables (any `col`/`row`) or
     by asking for `layout: "grid"` — worth doing under about five tables, where a hand grid reads
     better than a solver.

     If the solver is missing the grid path still draws something, but a spec that expected auto
     placement gets a diagonal instead of a layout, so say so rather than degrading in silence. */
  function layoutErd(spec) {
    /* Free placement wins over every solver: it is what a dragged layout serializes to, so a spec
       carrying x/y is a layout somebody arranged on purpose and nothing may second-guess it. */
    if ((spec.tables || []).some(function (t) { return t.x !== undefined || t.y !== undefined; })) {
      var TF = {}, edgeX = 0, edgeY = 0;
      spec.tables.forEach(function (t) {
        var sz = erdTableSize(t, !!spec.diff), x = t.x || 0, y = t.y || 0;
        TF[t.id] = { t: t, s: sz, x: x, y: y, x1: x + sz.w, y1: y + sz.h };
        edgeX = Math.max(edgeX, x + sz.w);
        edgeY = Math.max(edgeY, y + sz.h);
      });
      var frame = spec.canvas || [];
      return { T: TF, w: Math.ceil(frame[0] || edgeX + ER.pad), h: Math.ceil(frame[1] || edgeY + ER.pad) };
    }
    var handPlaced = (spec.tables || []).some(function (t) { return t.col !== undefined || t.row !== undefined; });
    var wantsSolver = !handPlaced && spec.layout !== "grid";
    if (wantsSolver && typeof ErdAuto === "undefined" && typeof console !== "undefined") {
      console.warn("erd: dagre (ErdAuto) is not on the page, so tables fall back to a diagonal grid. " +
                   "Copy the inlined dagre <script> across when cloning this artifact.");
    }
    if (wantsSolver && typeof ErdAuto !== "undefined") { return layoutErdAuto(spec); }
    if (spec.layout === "auto" && typeof ErdAuto !== "undefined") { return layoutErdAuto(spec); }
    var T = {}, colW = {}, rowH = {};
    /* A table naming no cell used to default to (0,0) along with every other unplaced table, so a
       spec written for the solver — or loaded where the solver is absent — silently stacked all of
       its tables on one square. Unplaced tables now walk their own cell: ugly for a big schema, but
       always readable, and never a pile. */
    var unplaced = 0;
    spec.tables.forEach(function (t) {
      var s = erdTableSize(t, !!spec.diff);
      if (t.col === undefined && t.row === undefined) { t = Object.assign({}, t, { col: unplaced, row: unplaced }); unplaced += 1; }
      T[t.id] = { t: t, s: s, col: t.col || 0, row: t.row || 0 };
      colW[t.col || 0] = Math.max(colW[t.col || 0] || 0, s.w);
      rowH[t.row || 0] = Math.max(rowH[t.row || 0] || 0, s.h);
    });
    var colX = {}, x = ER.pad;
    Object.keys(colW).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
      colX[c] = x; x += colW[c] + ER.gutterX;
    });
    var rowY = {}, y = ER.pad;
    Object.keys(rowH).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      rowY[r] = y; y += rowH[r] + ER.gutterY;
    });
    Object.keys(T).forEach(function (id) {
      var it = T[id];
      it.x = colX[it.col]; it.y = rowY[it.row];
      it.x1 = it.x + it.s.w; it.y1 = it.y + it.s.h;
    });
    return { T: T, w: Math.ceil(x - ER.gutterX + ER.pad), h: Math.ceil(y - ER.gutterY + ER.pad) };
  }

  /* "table.column" -> the y of that column's row; "table" alone -> the header. */
  function erdAnchor(L, ref) {
    var bits = String(ref).split("."), it = L.T[bits[0]];
    if (!it) { return null; }
    if (bits.length === 1) { return { it: it, y: it.y + ER.headH / 2, col: null }; }
    var idx = -1;
    it.t.columns.forEach(function (c, i) { if (c.name === bits[1]) { idx = i; } });
    if (idx < 0) { return { it: it, y: it.y + ER.headH / 2, col: null }; }
    return { it: it, y: it.y + ER.headH + idx * ER.rowH + ER.rowH / 2, col: bits[1], idx: idx };
  }

  /* dir = +1 when the mark sits on the table's right edge and the line runs away to the right. */
  function crowFoot(x, y, dir, card, color) {
    var g = "", s = 'stroke="' + color + '" stroke-width="1.5" fill="none"';
    var many = card === "1..N" || card === "0..N";
    var optional = card === "0..1" || card === "0..N";
    if (many) {
      var tip = x + dir * 13;
      /* Toes on the table, apex pointing away down the line, so the mark turns with whichever edge
         it stands on. Drawn the other way round it reads as an arrowhead aimed into the box, which is
         the opposite of every published crow's-foot chart. */
      g += '<path d="M' + x + "," + (y - 7) + " L" + tip + "," + y + " L" + x + "," + (y + 7) + '" ' + s + "/>";
      g += '<line x1="' + x + '" y1="' + y + '" x2="' + tip + '" y2="' + y + '" ' + s + "/>";
    }
    /* Zero-or-many is a circle and a foot, with no bar between them: the bar means "exactly one of
       these", so drawing it here rendered the mark a reader parses as 0..1 sitting beside a foot. */
    if (card !== "0..N") {
      var barA = x + dir * (many ? 17 : 9);
      g += '<line x1="' + barA + '" y1="' + (y - 6) + '" x2="' + barA + '" y2="' + (y + 6) + '" ' + s + "/>";
    }
    if (optional) {
      g += '<circle cx="' + (x + dir * (many ? 20 : 17)) + '" cy="' + y + '" r="4" ' + s + ' fill="' + COL.surface + '"/>';
    } else if (!many) {
      g += '<line x1="' + (x + dir * 16) + '" y1="' + (y - 6) + '" x2="' + (x + dir * 16) + '" y2="' + (y + 6) + '" ' + s + "/>";
    }
    return g;
  }

  /* An edge leaves each table through a short straight stub and the two stubs are joined by a
     bezier. The stubs are where the crow's feet live, so the marks stay flat against the table edge
     and identical at every angle, and the bezier is what lets the tables move: it is a function of the
     two endpoints alone, so dragging a table redraws its edges from box positions with no router. */
  var ER_STUB = 26;

  /* Which side each end leaves from. A table wholly left of the other exits right, and the other
     exits left. Overlapping spans, which includes a table's edge to itself, both exit right and the
     bezier loops back. */
  function erdExits(a, b) {
    if (a.it.x1 <= b.it.x) { return { adir: 1, bdir: -1 }; }
    if (b.it.x1 <= a.it.x) { return { adir: -1, bdir: 1 }; }
    return { adir: 1, bdir: 1 };
  }

  /* ex, when given, is where the tail's straight run leaves its box: an anchor that sits inside the
     box, like a button in a screen, runs flat to ex first and the stub begins there. */
  function erdEdgePath(ax, ay, adir, bx, by, bdir, ex) {
    var sx = (ex == null ? ax : ex) + adir * ER_STUB, tx = bx + bdir * ER_STUB;
    var c = Math.max(40, Math.abs(tx - sx) * 0.5, adir === bdir ? 70 : 0);
    return "M" + ax + "," + ay + " H" + sx + " C" + (sx + adir * c) + "," + ay + " " + (tx + bdir * c) + "," + by +
           " " + tx + "," + by + " H" + bx;
  }

  /* A short gloss just past a stub, on the side the curve bends away from. The lo-fi mockup uses it
     for the name of a tap. The ERD carries no labels on its lines: anything a shape cannot say goes in
     a column comment, on the column it is about. */
  function erdEndLabel(text, x, y, dir, otherY, color) {
    var above = otherY >= y;
    return '<text x="' + (x + dir * (ER_STUB + 4)) + '" y="' + (above ? y - 7 : y + 13) + '" text-anchor="' + (dir > 0 ? "start" : "end") +
           '" style="font:9.5px var(--mono); fill:' + (color || COL.faint) + '">' + esc(text) + "</text>";
  }

  /* The inside of one edge group: line, two marks, a label at either end. Shared by the first render and every redraw
     so the two can never drift apart. The group element itself is left alone on redraw, which is what
     keeps a walkthrough's grip on it. */
  function erdEdgeInner(L, r) {
    var a = erdAnchor(L, r.from), b = erdAnchor(L, r.to);
    if (!a || !b) { return ""; }
    var ex = erdExits(a, b), col = r.tone === "muted" ? COL.faint : COL.soft;
    var ax = ex.adir > 0 ? a.it.x1 : a.it.x, bx = ex.bdir > 0 ? b.it.x1 : b.it.x;
    var out = '<path class="erd-line" d="' + erdEdgePath(ax, a.y, ex.adir, bx, b.y, ex.bdir) + '" fill="none" stroke="' + col + '" stroke-width="1.4"/>';
    out += crowFoot(ax, a.y, ex.adir, r.fromCard || "1", col);
    out += crowFoot(bx, b.y, ex.bdir, r.toCard || "1", col);
    return out;
  }

  /* Layout again from the spec, then let whatever is on screen override where the tables sit. */
  function erdRelayout(spec, positions) {
    var L = layoutErd(spec);
    Object.keys(positions).forEach(function (id) {
      var it = L.T[id];
      if (!it) { return; }
      it.x = positions[id].x; it.y = positions[id].y;
      it.x1 = it.x + it.s.w; it.y1 = it.y + it.s.h;
    });
    return L;
  }

  function erdRedraw(svg) {
    var spec = ERDS[svg.getAttribute("data-spec")];
    if (!spec) { return; }
    var positions = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) { positions[g.getAttribute("data-node")] = cvPos(g); });
    var L = erdRelayout(spec, positions);
    svg.querySelectorAll(".erd-edges > g").forEach(function (g) {
      var r = (spec.rels || [])[+g.getAttribute("data-ri")];
      if (r) { g.innerHTML = erdEdgeInner(L, r); }
    });
  }

  /* Dropping a table writes the positions on screen back into the spec shown under the figure, the
     same way a call graph does. Copy that JSON over the spec and the arrangement is what everyone
     sees on the same link. col and row are dropped from the copy, since x/y now decide. */
  function erdSpecWithLayout(svg, key) {
    var base = ERDS[key];
    if (!base) { return null; }
    var at = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) { at[g.getAttribute("data-node")] = cvPos(g); });
    var vb = svg.viewBox.baseVal, out = {};
    Object.keys(base).forEach(function (k) { if (k !== "tables") { out[k] = base[k]; } });
    out.canvas = [Math.round(vb.width), Math.round(vb.height)];
    out.tables = base.tables.map(function (t) {
      var copy = {}, at1 = at[t.id];
      Object.keys(t).forEach(function (k) { if (k !== "col" && k !== "row") { copy[k] = t[k]; } });
      if (at1) { copy.x = at1.x; copy.y = at1.y; }
      return copy;
    });
    return out;
  }

  function erdSyncSpec(svg) {
    var card = svg.closest ? svg.closest(".figcard") : null, pre = card && card.querySelector("pre[data-erdspec]");
    if (!pre) { return; }
    var spec = erdSpecWithLayout(svg, svg.getAttribute("data-spec"));
    if (spec) { pre.textContent = specText(spec); }
  }

  function renderErd(spec, uid, key) {
    /* The diff vocabulary is the call graph's: table, table.column, from~to. A column inherits its
       table's mark, which cgDiffMark already does for a row and its file. */
    var L = layoutErd(spec), mark = cgDiffMark(spec), out = "";

    spec.tables.forEach(function (t) {
      var it = L.T[t.id], s = it.s, tm = mark(t.id);
      /* Everything inside is relative to the table's own origin, so a drag is one transform. The key
         stays on the whole table, as it always has: an ERD walkthrough dims tables as units. */
      out += '<g class="cv-box' + (tm ? " " + tm : "") + '" data-node="' + esc(t.id) + '" data-k="' + esc(t.id) + '" data-w="' + s.w + '" data-h="' + s.h +
             '" transform="translate(' + it.x + "," + it.y + ')">';
      out += '<rect class="erd-plate" x="0" y="0" width="' + s.w + '" height="' + s.h + '" rx="7" fill="' + COL.surface + '" stroke="' + COL.ink + '" stroke-width="1.5"/>';
      out += '<path class="erd-rule" d="M0,' + ER.headH + " H" + s.w + '" stroke="' + COL.ink + '" stroke-width="1.5"/>';
      /* The header is a hover target for every edge of the table. Its hit area stops short of the eye. */
      out += '<g class="erd-head"><rect class="erd-headhit" x="1.5" y="1.5" width="' + (s.w - 32) + '" height="' + (ER.headH - 2) + '" rx="5"/>' +
             '<text class="erd-title" x="12" y="20" style="font:700 12.5px var(--mono); fill:' + COL.ink + '">' + esc(t.label) + "</text>" +
             (tm ? '<text class="erd-sign" x="' + (s.w - 33) + '" y="20" text-anchor="end">' + CG_SIGN[tm] + "</text>" : "") + "</g>";
      t.columns.forEach(function (c, i) {
        var cy = ER.headH + i * ER.rowH + ER.rowH / 2;
        /* A comment hangs off the row: the whole row is the hit area, a dotted underline under the
           name says there is one, and the panel opens above the table like a call graph docstring. */
        var cm = mark(t.id + "." + c.name), nameW = Math.round(textW(c.name, 11.5, true));
        out += '<g class="erd-col' + (cm ? " " + cm : "") + '" data-key="' + esc(t.id + "." + c.name) + '" data-col="' + esc(c.name) + '"' +
               (c.comment ? ' data-doc="' + esc(c.comment) + '" tabindex="0" role="button" aria-label="' +
               esc(c.name + ", column comment on hover") + '"' : "") + ">";
        if (c.key === "pk" || c.key === "fk") {
          out += '<rect x="1.5" y="' + (cy - ER.rowH / 2) + '" width="' + (s.w - 3) + '" height="' + ER.rowH +
                 '" fill="' + (c.key === "pk" ? COL.actSoft : COL.surface2) + '"/>';
        }
        out += '<rect class="erd-band" x="1.5" y="' + (cy - ER.rowH / 2) + '" width="' + (s.w - 3) + '" height="' + ER.rowH + '" rx="3"/>';
        out += '<text class="erd-name" x="12" y="' + (cy + 4) + '" style="font:' + (c.key === "pk" ? "700 " : "") +
               '11.5px var(--mono); fill:' + COL.ink + '">' + esc(c.name) + "</text>";
        var after = 12 + nameW + 7;
        if (c.key) {
          out += '<text x="' + after + '" y="' + (cy + 4) +
                 '" style="font:700 8.5px var(--mono); fill:' + (c.key === "pk" ? COL.act : COL.soft) +
                 '; letter-spacing:0.06em">' + c.key.toUpperCase() + "</text>";
          after += Math.round(textW(c.key.toUpperCase(), 8.5, true)) + 8;
        }
        /* The sign follows the badge rather than sitting at the far right, where the type is. */
        if (cm) {
          out += '<text class="erd-sign" x="' + after + '" y="' + (cy + 4) + '">' + CG_SIGN[cm] + "</text>";
        }
        if (c.type) {
          out += '<text x="' + (s.w - 12) + '" y="' + (cy + 4) + '" text-anchor="end" style="font:10.5px var(--mono); fill:' + COL.faint + '">' + esc(c.type) + "</text>";
        }
        if (c.comment) {
          out += '<path class="erd-docline" d="M12,' + (cy + 7) + " H" + (12 + nameW) + '"/>';
        }
        /* Every row is a hover target, whether or not it has a comment: the hit area is the row. */
        out += '<rect class="erd-colhit" x="1.5" y="' + (cy - ER.rowH / 2) + '" width="' + (s.w - 3) + '" height="' + ER.rowH + '"/>';
        out += "</g>";
      });
      out += cvChrome(t.label, s.w, s.h);
      out += "</g>";
    });

    /* Edges go over the tables. Under them, an edge crossing behind a table looked as if it left that
       table at some odd row. Over them, a crossing is a crossing, and the hover above sorts out which
       edge is which. data-fa and data-ta keep the column level anchors the hover matches on. */
    out += '<g class="erd-edges">';
    (spec.rels || []).forEach(function (r, ri) {
      var fromT = String(r.from).split(".")[0], toT = String(r.to).split(".")[0];
      var em = mark(r.from + "~" + r.to);
      out += '<g class="cv-edge' + (em ? " " + em : "") + '" data-k="r' + ri + '" data-ri="' + ri + '" data-from="' + esc(fromT) + '" data-to="' + esc(toT) +
             '" data-fa="' + esc(r.from) + '" data-ta="' + esc(r.to) + '">' + erdEdgeInner(L, r) + "</g>";
    });
    out += "</g>";

    return '<svg class="seq cv" data-canvas="erd" data-spec="' + esc(key || "") + '" viewBox="0 0 ' + L.w + " " + L.h +
           '" role="img" aria-label="' + esc(spec.alt || spec.title || "entity relationship diagram") +
           '" style="width:100%; min-width:' + Math.min(L.w, 700) + 'px; height:auto; display:block">' + out + "</svg>";
  }

  /* Standalone key: the four crow's-foot ends, drawn against a stub line. */
  function renderErdKey() {
    var rows = [
      ["1", "exactly one", "two bars — mandatory, and never more than one"],
      ["0..1", "zero or one", "circle — the row may not exist"],
      ["1..N", "one or many", "foot plus bar — at least one is required"],
      ["0..N", "zero or many", "foot plus circle — the common child side"]
    ];
    var out = "", y = 40;
    out += '<text class="sans" x="30" y="18" style="font:12px var(--sans); fill:' + COL.soft + '">' +
           'A mark says how many rows of the table it touches take part, not what its column points at.' + "</text>";
    rows.forEach(function (r) {
      out += '<line x1="52" y1="' + y + '" x2="150" y2="' + y + '" stroke="' + COL.soft + '" stroke-width="1.4"/>';
      out += crowFoot(52, y, 1, r[0], COL.soft);
      out += '<text x="164" y="' + (y + 4) + '" style="font:700 11.5px var(--mono); fill:' + COL.ink + '">' + esc(r[0]) + "</text>";
      out += '<text x="216" y="' + (y + 4) + '" style="font:11.5px var(--mono); fill:' + COL.ink + '">' + esc(r[1]) + "</text>";
      out += '<text class="sans" x="330" y="' + (y + 4) + '" style="font:12px var(--sans); fill:' + COL.soft + '">' + esc(r[2]) + "</text>";
      y += 34;
    });
    out += '<rect x="30" y="' + (y + 4) + '" width="120" height="20" rx="3" fill="' + COL.actSoft + '" stroke="' + COL.act + '" stroke-width="1.2"/>';
    out += '<text x="40" y="' + (y + 18) + '" style="font:700 11px var(--mono); fill:' + COL.ink + '">id</text>';
    out += '<text x="60" y="' + (y + 18) + '" style="font:700 8.5px var(--mono); fill:' + COL.act + '">PK</text>';
    out += '<text class="sans" x="164" y="' + (y + 18) + '" style="font:12px var(--sans); fill:' + COL.soft + '">primary key — tinted, bold</text>';
    y += 30;
    out += '<rect x="30" y="' + (y + 4) + '" width="120" height="20" rx="3" fill="' + COL.surface2 + '" stroke="' + COL.line + '" stroke-width="1.2"/>';
    out += '<text x="40" y="' + (y + 18) + '" style="font:11px var(--mono); fill:' + COL.ink + '">photo_id</text>';
    out += '<text x="97" y="' + (y + 18) + '" style="font:700 8.5px var(--mono); fill:' + COL.soft + '">FK</text>';
    out += '<text class="sans" x="164" y="' + (y + 18) + '" style="font:12px var(--sans); fill:' + COL.soft + '">foreign key — where its edge starts, and the far mark is its own count</text>';
    return '<svg class="seq" viewBox="0 0 660 ' + (y + 40) + '" role="img" aria-label="Crow\'s foot cardinality key" style="width:100%; max-width:660px; min-width:560px; height:auto; display:block">' + out + "</svg>";
  }

  var ERDS = {};



  var TABLES = {};

  var WALKS = {};



  var SCREENS = {};

  /* ---------- component 04 · lo-fi mockup ---------- */
  /* Lo-fi mobile screens. Deliberately not a design: a topbar, a list, and a button are enough
     to say where a tap goes, and anything more invites arguing about visual design in a document
     about navigation. Links anchor at the element that is tapped, so an arrow leaves the button
     itself rather than the edge of the screen. Screens are canvas boxes, so they drag, fold and
     expand like the tables of an ERD, and their arrows are the ERD's stub and bezier. */
  var SC = { w: 196, h: 348, pad: 9, barH: 30, rowH: 20, rowGap: 7, btnH: 32, gutterX: 108, gutterY: 44, radius: 14, thumb: 26, labelH: 18, marginR: 96 };

  /* Everything inside a screen is relative to the screen's own origin, which sits at the label
     above the frame so the label travels with the frame when it is dragged. The frame starts
     SC.labelH down. A spec places screens by col and row on a grid, or by x and y once any screen
     carries them, which is what a dragged layout writes back. */
  function scLayout(spec) {
    var S = {}, colW = {}, rowH = {};
    var free = spec.screens.some(function (sc) { return sc.x != null || sc.y != null; });
    spec.screens.forEach(function (sc) {
      var sh = sc.h || SC.h;
      S[sc.id] = { sc: sc, w: SC.w, sh: sh, h: sh + SC.labelH, col: sc.col || 0, row: sc.row || 0, el: {} };
      colW[sc.col || 0] = SC.w;
      rowH[sc.row || 0] = Math.max(rowH[sc.row || 0] || 0, sh + SC.labelH);
    });
    if (free) {
      Object.keys(S).forEach(function (id) { S[id].x = S[id].sc.x || 0; S[id].y = S[id].sc.y || 0; });
    } else {
      var colX = {}, x = 12;
      Object.keys(colW).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) { colX[c] = x; x += SC.w + SC.gutterX; });
      var rowY = {}, y = 8;
      Object.keys(rowH).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) { rowY[r] = y; y += rowH[r] + SC.gutterY; });
      Object.keys(S).forEach(function (id) { S[id].x = colX[S[id].col]; S[id].y = rowY[S[id].row]; });
    }

    var maxX = 0, maxY = 0;
    Object.keys(S).forEach(function (id) {
      var it = S[id], t0 = SC.labelH;
      it.x1 = it.x + it.w; it.y1 = it.y + it.h;
      maxX = Math.max(maxX, it.x1); maxY = Math.max(maxY, it.y1);
      /* Topbar pins to the top, docked buttons stack up from the bottom, the rest flows between. */
      var top = t0, bottomCursor = t0 + it.sh - SC.pad, flow = [];
      it.sc.elements.forEach(function (e) {
        if (e.type === "topbar") { it.el[e.id || "topbar"] = { x: 0, y: t0, w: it.w, h: SC.barH, e: e }; top = t0 + SC.barH; }
        else if (e.type === "button" && e.dock !== false) {
          var bw = Math.round(it.w * (e.width || 0.86));
          var bx = e.align === "left" ? SC.pad
                 : e.align === "right" ? it.w - SC.pad - bw
                 : (it.w - bw) / 2;
          bottomCursor -= SC.btnH;
          it.el[e.id] = { x: bx, y: bottomCursor, w: bw, h: SC.btnH, e: e };
          bottomCursor -= 8;
        } else { flow.push(e); }
      });
      var fy = top + SC.pad, iw = it.w - SC.pad * 2;
      flow.forEach(function (e) {
        if (e.type === "list") {
          var n = e.rows || (e.items ? e.items.length : 3);
          it.el[e.id || ("list" + fy)] = { x: SC.pad, y: fy, w: iw, h: n * (SC.rowH + SC.rowGap), e: e, rows: n };
          fy += n * (SC.rowH + SC.rowGap) + 6;
        } else if (e.type === "block") {
          var h = e.h || 56;
          it.el[e.id || ("block" + fy)] = { x: SC.pad, y: fy, w: iw, h: h, e: e };
          fy += h + 8;
        } else if (e.type === "media") {
          var mh = e.h || 104;
          it.el[e.id || ("media" + fy)] = { x: SC.pad, y: fy, w: iw, h: mh, e: e };
          fy += mh + 8;
        } else if (e.type === "thumbs") {
          it.el[e.id || ("thumbs" + fy)] = { x: SC.pad, y: fy, w: iw, h: SC.thumb + 8, e: e };
          fy += SC.thumb + 16;
        } else if (e.type === "button") {
          var bw2 = Math.round(it.w * (e.width || 0.86));
          it.el[e.id] = { x: (it.w - bw2) / 2, y: fy, w: bw2, h: SC.btnH, e: e };
          fy += SC.btnH + 8;
        }
      });
    });
    var size = spec.canvas || [Math.ceil(maxX + SC.marginR), Math.ceil(maxY + 26)];
    return { S: S, w: size[0], h: size[1] };
  }

  /* A tap's arrow. The tail runs straight along the tapped button's own row to the frame edge and out
     through a stub, the head is a stub into the side of the screen it opens, and between them is the
     ERD's bezier. Which side each end uses depends only on where the two screens sit, so a dragged
     screen redraws its arrows from box positions alone and nothing routes. */
  function scEdgeGeom(L, lk) {
    var fb = String(lk.from).split("."), src = L.S[fb[0]], dst = L.S[String(lk.to).split(".")[0]];
    if (!src || !dst) { return null; }
    var el = src.el[fb[1]];
    if (!el) { return null; }
    var ex = erdExits({ it: src }, { it: dst });
    return { dst: dst, adir: ex.adir, bdir: ex.bdir,
             ax: src.x + (ex.adir > 0 ? el.x + el.w : el.x), ay: src.y + el.y + el.h / 2, ex: ex.adir > 0 ? src.x1 : src.x,
             bx: ex.bdir > 0 ? dst.x1 : dst.x, by: dst.y + SC.labelH + dst.sh / 2 };
  }

  /* Several arrows into one side of one screen fan out around its middle, ordered by where they
     come from, so two heads never land on the same point. */
  function scEdges(L, links) {
    var geoms = links.map(function (lk) { return scEdgeGeom(L, lk); }), slots = {};
    geoms.forEach(function (g) {
      if (g) { (slots[g.dst.sc.id + "/" + g.bdir] = slots[g.dst.sc.id + "/" + g.bdir] || []).push(g); }
    });
    Object.keys(slots).forEach(function (k) {
      var arr = slots[k].sort(function (a, b) { return a.ay - b.ay; });
      arr.forEach(function (g, i) { g.by += (i - (arr.length - 1) / 2) * 22; });
    });
    return geoms;
  }

  function scEdgeInner(g, lk, uid) {
    if (!g) { return ""; }
    var out = '<path d="' + erdEdgePath(g.ax, g.ay, g.adir, g.bx, g.by, g.bdir, g.ex) + '" fill="none" stroke="' + COL.act +
              '" stroke-width="1.6" marker-end="url(#' + uid + '-nav)"/>';
    /* The label glosses the tap, so it sits at the tail, just past the stub. */
    if (lk.label) { out += erdEndLabel(lk.label, g.ex, g.ay, g.adir, g.by, COL.act); }
    return out;
  }

  function scRelayout(spec, positions) {
    var L = scLayout(spec);
    Object.keys(positions).forEach(function (id) {
      var it = L.S[id];
      if (!it) { return; }
      it.x = positions[id].x; it.y = positions[id].y;
      it.x1 = it.x + it.w; it.y1 = it.y + it.h;
    });
    return L;
  }

  function scRedraw(svg) {
    var spec = SCREENS[svg.getAttribute("data-spec")];
    if (!spec) { return; }
    var positions = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) { positions[g.getAttribute("data-node")] = cvPos(g); });
    var L = scRelayout(spec, positions), links = spec.links || [], geoms = scEdges(L, links), uid = svg.getAttribute("data-uid");
    svg.querySelectorAll(".sc-edges > g").forEach(function (g) {
      var li = +g.getAttribute("data-li");
      if (links[li]) { g.innerHTML = scEdgeInner(geoms[li], links[li], uid); }
    });
  }

  /* Dropping a screen writes the positions on screen into the spec under the figure, the same way a
     call graph and an ERD do. col and row are dropped from the copy, since x and y now decide. */
  function scSpecWithLayout(svg, key) {
    var base = SCREENS[key];
    if (!base) { return null; }
    var at = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) { at[g.getAttribute("data-node")] = cvPos(g); });
    var vb = svg.viewBox.baseVal, out = {};
    Object.keys(base).forEach(function (k) { if (k !== "screens") { out[k] = base[k]; } });
    out.canvas = [Math.round(vb.width), Math.round(vb.height)];
    out.screens = base.screens.map(function (sc) {
      var copy = {}, at1 = at[sc.id];
      Object.keys(sc).forEach(function (k) { if (k !== "col" && k !== "row") { copy[k] = sc[k]; } });
      if (at1) { copy.x = at1.x; copy.y = at1.y; }
      return copy;
    });
    return out;
  }

  function scSyncSpec(svg) {
    var card = svg.closest ? svg.closest(".figcard") : null, pre = card && card.querySelector("pre[data-screenspec]");
    if (!pre) { return; }
    var spec = scSpecWithLayout(svg, svg.getAttribute("data-spec"));
    if (spec) { pre.textContent = specText(spec); }
  }

  function scSkeleton(x, y, w, h, uid, accent) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="url(#' + uid +
           (accent ? "-hatchA" : "-hatch") + ')" stroke="' + (accent ? COL.act : COL.line) + '" stroke-width="1"/>';
  }

  /* Lo-fi media glyphs: enough to say "a picture goes here" or "this is live video" without
     drawing anything anyone could mistake for real art direction. */
  function scGlyph(kind, cx, cy, k) {
    k = k || 1;
    var c = COL.line;
    var st = 'fill="none" stroke="' + c + '" stroke-width="' + (1.6 * Math.max(k, 0.62)).toFixed(2) +
             '" stroke-linejoin="round" stroke-linecap="round"';
    var n = function (v) { return +(v * k).toFixed(2); };
    if (kind === "video") {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(13) + '" ' + st + '/>' +
             '<path d="M' + (cx - n(4)) + "," + (cy - n(7)) + " L" + (cx + n(8)) + "," + cy + " L" + (cx - n(4)) + "," + (cy + n(7)) +
             ' Z" fill="' + c + '" stroke="none"/>';
    }
    /* At thumbnail scale the surrounding square already frames it, so the glyph's own border
       is dropped — two nested rounded rects at 26px read as noise. */
    var out = k >= 0.7
      ? '<rect x="' + (cx - n(17)) + '" y="' + (cy - n(13)) + '" width="' + n(34) + '" height="' + n(26) + '" rx="' + n(3) + '" ' + st + "/>"
      : "";
    return out +
      '<circle cx="' + (cx - n(7)) + '" cy="' + (cy - n(5)) + '" r="' + n(3) + '" fill="' + c + '" stroke="none"/>' +
      '<path d="M' + (cx - n(13)) + "," + (cy + n(9)) + " L" + (cx - n(3)) + "," + (cy - n(2)) + " L" + (cx + n(4)) + "," + (cy + n(5)) +
      " L" + (cx + n(8)) + "," + (cy + n(1)) + " L" + (cx + n(13)) + "," + (cy + n(9)) + '" ' + st + "/>";
  }

  function scThumbs(x, y, n, filled, uid) {
    var out = "", t = SC.thumb;
    for (var i = 0; i < n; i++) {
      var tx = x + i * (t + 6);
      out += '<rect x="' + tx + '" y="' + y + '" width="' + t + '" height="' + t + '" rx="4" fill="' +
             (filled ? COL.surface : "url(#" + uid + "-hatch)") + '" stroke="' + COL.line + '" stroke-width="1.1"/>';
      if (filled) { out += scGlyph("image", tx + t / 2, y + t / 2, 0.5); }
    }
    return out;
  }


  /* A wide table scrolls, but scrolling alone loses the reader: at column eleven there is nothing on
     screen saying which row they are on. So the identifying columns render as their own table and the
     rest scrolls beside them. Both halves are ordinary specs, sliced from the parent, which is why
     the renderer needs to know nothing about freezing. */
  function tableSlice(spec, from, to, keepLabel) {
    var ids = tableRowIds(spec);
    return {
      label: keepLabel ? spec.label : "",
      alt: spec.alt,
      columns: (spec.columns || []).slice(from, to),
      rows: (spec.rows || []).map(function (r, i) {
        return { id: ids[i], cells: tableRowCells(r).slice(from, to) };
      })
    };
  }

  function renderTableFrozen(spec, uid, extra) {
    var n = spec.freeze || 0;
    if (!n) { return renderTable(spec, uid, extra); }
    /* The label sits above both halves as HTML. Drawn inside the pinned half it would be cut at the
       width of the frozen columns, which is usually one id. */
    var pin = tableSlice(spec, 0, n, false);
    var run = tableSlice(spec, n, (spec.columns || []).length, false);
    var pinW = layoutTable(pin, extra).w + 6;
    return (spec.label ? '<div class="tbl-label">' + esc(spec.label) + "</div>" : "") +
           '<div class="tbl-split">' +
           '<div class="tbl-pin" style="width:' + pinW + 'px">' + renderTable(pin, uid + "-pin", extra, true) + "</div>" +
           '<div class="tbl-run">' + renderTable(run, uid + "-run", extra, true) + "</div>" +
           "</div>";
  }

  /* ---------- component 05 · relational table ----------
     A table of real rows, not a schema box: the ERD says how tables relate, this says what is in one.
     Key columns are tinted rather than badged alone, because a reader scanning for "which column is
     the join" finds a band faster than a two-letter tag.

     Every cell carries data-k (focus) and data-v (value), so a walkthrough can light a row and
     rewrite what is in it on the same step. Cells are their own groups rather than children of a row
     group: nesting two dimmable ancestors multiplies their opacity, so a dim row inside a dim table
     lands at 0.01 and reads as missing rather than faint. */
  var TB = { headH: 32, rowH: 26, padX: 13, gap: 22, titleH: 26 };

  /* A clipped column shows a one-liner and keeps the whole value for the tooltip. json columns clip
     by default, because putting a whole document in the cell makes one column as wide as the rest of
     the table put together and a reader cannot parse pretty-printed json on a single line anyway. Any
     other column opts in with clip: n, the number of characters that stay in the cell. */
  function tableClipAt(c) {
    if (typeof c.clip === "number") { return Math.max(4, c.clip); }
    return c.json || c.clip === true ? 24 : 0;
  }
  function tableCellText(c, v) {
    if (v == null) { return ""; }
    var n = tableClipAt(c);
    if (!n || v === "") { return String(v); }
    var compact = typeof v === "string" ? v : JSON.stringify(v);
    return compact.length > n ? compact.slice(0, n - 1) + "\u2026" : compact;
  }
  /* The tooltip's text, or null when the cell shows everything it holds. */
  function tableCellFull(c, v) {
    if (v == null || v === "") { return null; }
    if (c.json) {
      /* Indented json, not the spec dumper: the spec is YAML, but the value in the column is json and the
         tooltip should read the way a database client prints it. */
      try { return JSON.stringify(typeof v === "string" ? JSON.parse(v) : v, null, 2); }
      catch (err) { return String(v); }
    }
    var n = tableClipAt(c), str = String(v);
    return n && str.length > n ? str : null;
  }

  function tableRowIds(spec) {
    return (spec.rows || []).map(function (r, i) { return (r && r.id) || "r" + i; });
  }
  function tableRowCells(r) { return (r && r.cells) || r || []; }

  /* extraValues lets a walkthrough declare every value a cell will ever hold, so a column is wide
     enough for step 7 on step 1 and the grid never reflows mid-scrub. */
  function layoutTable(spec, extraValues) {
    var cols = spec.columns || [];
    var widths = cols.map(function (c, ci) {
      var w = textW(c.name, 11.5, true) + (c.key ? 26 : 0) + (c.type ? textW(c.type, 9.5, true) + 8 : 0);
      (spec.rows || []).forEach(function (r) {
        w = Math.max(w, textW(tableCellText(c, tableRowCells(r)[ci]), 11.5, true));
      });
      ((extraValues || {})[c.name] || []).forEach(function (v) { w = Math.max(w, textW(v, 11.5, true)); });
      return Math.round(Math.max(w, 46) + TB.padX * 2);
    });
    var x = [], acc = 0;
    widths.forEach(function (w) { x.push(acc); acc += w; });
    return { cols: cols, widths: widths, x: x, w: acc, h: TB.titleH + TB.headH + (spec.rows || []).length * TB.rowH };
  }

  function renderTable(spec, uid, extraValues, fixed) {
    var L = layoutTable(spec, extraValues);
    var ids = tableRowIds(spec);
    var bodyTop = TB.titleH + TB.headH;
    var out = "";

    /* Key columns get a full-height band. PK reuses the activation tint the ERD gives a primary key,
       so the same colour means the same thing across both components.

       No data-k on the bands or on any part of the grid: a walkthrough dims everything it can reach
       and is not focusing, so tagging these made the tint vanish the moment the table appeared in a
       walkthrough. They are structure, and structure never dims. */
    L.cols.forEach(function (c, ci) {
      if (!c.key) { return; }
      out += '<rect x="' + L.x[ci] + '" y="' + TB.titleH + '" width="' + L.widths[ci] + '" height="' + (L.h - TB.titleH) +
             '" fill="' + (c.key === "pk" ? COL.actSoft : COL.surface2) + '"/>';
    });

    out += '<rect x="0" y="' + TB.titleH + '" width="' + L.w + '" height="' + (L.h - TB.titleH) +
           '" fill="none" stroke="' + COL.line + '" stroke-width="1" rx="6"/>';
    out += '<path d="M0,' + bodyTop + " H" + L.w + '" stroke="' + COL.soft + '" stroke-width="1"/>';
    out += '<text x="1" y="18" style="font:700 12.5px var(--mono); fill:' + COL.ink + '">' + esc(spec.label || "") + "</text>";

    L.cols.forEach(function (c, ci) {
      var cx = L.x[ci] + TB.padX, hy = TB.titleH + 20;
      out += '<text x="' + cx + '" y="' + hy + '" style="font:700 11.5px var(--mono); fill:' + COL.ink + '">' + esc(c.name) + "</text>";
      var after = cx + textW(c.name, 11.5, true) + 7;
      if (c.key) {
        out += '<text x="' + after + '" y="' + hy + '" style="font:700 8.5px var(--mono); fill:' +
               (c.key === "pk" ? COL.act : COL.soft) + '">' + c.key.toUpperCase() + "</text>";
        after += 24;
      }
      if (c.type) {
        out += '<text x="' + after + '" y="' + hy + '" style="font:9.5px var(--mono); fill:' + COL.faint + '">' + esc(c.type) + "</text>";
      }
      if (ci > 0) {
        out += '<path d="M' + L.x[ci] + "," + TB.titleH + " V" + L.h + '" stroke="' + COL.line + '" stroke-width="1"/>';
      }
    });

    (spec.rows || []).forEach(function (r, ri) {
      var y = bodyTop + ri * TB.rowH, cells = tableRowCells(r);
      if (ri > 0) {
        out += '<path d="M1,' + y + " H" + (L.w - 1) + '" stroke="' + COL.line + '" stroke-width="1"/>';
      }
      L.cols.forEach(function (c, ci) {
        var raw = cells[ci], shown = tableCellText(c, raw), full = tableCellFull(c, raw);
        out += '<g data-k="' + esc(ids[ri] + "." + c.name) + '"';
        if (full !== null) {
          out += ' data-json="' + esc(full) + '"' + (c.json ? "" : ' data-wrap="1"') + ' tabindex="0" role="button" aria-label="' +
                 esc(c.name + " for row " + ids[ri] + ", full value on hover") + '"';
        }
        out += ">";
        /* A clipped cell keeps the whole cell as its hit area and says "hover me" the way a call graph
           row or an ERD column does: a dotted rule under the text, in ink, and nothing else. */
        if (full !== null) {
          out += '<rect x="' + L.x[ci] + '" y="' + y + '" width="' + L.widths[ci] + '" height="' + TB.rowH +
                 '" fill="transparent" pointer-events="all"/>';
        }
        out += '<text data-v="' + esc(ids[ri] + "." + c.name) + '" x="' + (L.x[ci] + TB.padX) + '" y="' + (y + 17) +
               '" style="font:' + (c.key === "pk" ? "700 " : "") + '11.5px var(--mono); fill:' + COL.ink + '">' + esc(shown) + "</text>";
        if (full !== null) {
          out += '<path class="tbl-docline" d="M' + (L.x[ci] + TB.padX) + "," + (y + 20) + " H" +
                 (L.x[ci] + TB.padX + Math.round(textW(shown, 11.5, true))) + '"/>';
        }
        out += "</g>";
      });
    });

    /* fixed keeps one CSS pixel per SVG unit, so a frozen half scrolls inside its box instead of
       scaling its text down to fit. A standalone table still shrinks like every other figure. */
    var sizing = fixed
      ? "width:" + (L.w + 6) + "px; height:auto; display:block"
      : "width:100%; max-width:" + (L.w + 40) + "px; min-width:" + Math.min(L.w + 6, 420) + "px; height:auto";
    /* A frozen half has no label of its own, so its viewBox starts under the empty title band. */
    var top = fixed ? TB.titleH : 0;
    return '<svg class="seq" viewBox="-2 ' + top + " " + (L.w + 6) + " " + (L.h + 8 - top) + '" role="img" aria-label="' +
           esc(spec.alt || spec.label || "table") + '" style="' + sizing + '">' + out + "</svg>";
  }

  var CG = { headH: 25, rowH: 19, padX: 11, minW: 154, pad: 30, lane: 33, laneStub: 16,
             meta: 24, metaGap: 9, sq: 4, sqGap: 1, barH: 4 };

  /* Public above private, decided here and not in the spec. A file lists its functions in whatever
     order it defines them, and sorting in the renderer means two boxes never disagree about where a
     reader should look for the entry points. A leading underscore is the only marker. */
  /* The underscore that matters is on the member, not on the front of the string. A class qualified
     name like Command._seed is private, and testing the first character calls it public. */
  function cgIsPriv(name) {
    var bits = String(name).split(".");
    return bits[bits.length - 1].charAt(0) === "_";
  }

  function cgFns(f, metrics) {
    var pub = [], priv = [];
    (f.fns || []).forEach(function (n) { (cgIsPriv(n) ? priv : pub).push(n); });
    /* Biggest first inside each half. A reader looking for where the work sits should find it at the
       top of the public list and the top of the private one, not wherever the file defines it. Sort
       is stable, so functions of equal size keep the order the spec gave them. */
    if (metrics) {
      var size = function (name) { return (metrics[f.id + "." + name] || {}).lines || 0; };
      var bySize = function (a, b) { return size(b) - size(a); };
      pub.sort(bySize);
      priv.sort(bySize);
    }
    return { all: pub.concat(priv), cut: pub.length };
  }

  /* Diff keys use the same vocabulary as walkthrough focus keys: fileId.fn for a row, fileId for
     every row in a file, from~to for a call. One addressing scheme covers both, so a reader who
     learned it on a walkthrough already knows how to mark up a diff. */
  function cgDiffMark(spec) {
    var marks = {};
    ["add", "del", "mod"].forEach(function (kind) {
      ((spec.diff || {})[kind] || []).forEach(function (k) { marks[k] = kind; });
    });
    return function (key) {
      if (marks[key]) { return marks[key]; }
      /* Only a row inherits its file's mark. An edge key carries two dotted names of its own, so
         prefix matching it against a file id would tag calls nobody marked. */
      if (key.indexOf("~") >= 0) { return ""; }
      var cut = key.indexOf(".");
      return cut > 0 ? marks[key.slice(0, cut)] || "" : "";
    };
  }

  /* A fog node stands for a part of the stack the figure is deliberately not drawing. It is a box
     so the solver ranks it like any other node and an edge can land on it, and it is dotted and
     wordy so nobody mistakes it for a file that happens to have no functions listed. */
  var CG_FOG = { maxChars: 26, lineH: 15, padX: 15, padY: 13 };

  function cgFogLines(label) {
    var lines = [], cur = "";
    String(label).split(/\s+/).forEach(function (word) {
      var next = cur ? cur + " " + word : word;
      if (next.length > CG_FOG.maxChars && cur) { lines.push(cur); cur = word; }
      else { cur = next; }
    });
    if (cur) { lines.push(cur); }
    return lines;
  }

  function cgFogSize(lines) {
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, textW(l, 11.5, false)); });
    return { w: Math.max(CG.minW, Math.round(w) + CG_FOG.padX * 2), h: CG_FOG.padY * 2 + lines.length * CG_FOG.lineH };
  }

  function cgBoxSize(f, fns, gutter, textX) {
    var w = CG.padX + textW(f.name, 11.5, true);
    fns.all.forEach(function (n) { w = Math.max(w, textX + textW(n, 11, true)); });
    return { w: Math.max(CG.minW, Math.round(w) + CG.padX + 8 + gutter), h: CG.headH + fns.all.length * CG.rowH + 6 };
  }

  /* Same deal as the ERD: dagre places the boxes left to right unless the spec places them itself.
     Ranks fall out of the calls, so callers land left of what they call, which is the reading order
     the arrow rule already assumes. */
  function layoutCallGraph(spec) {
    var F = {}, order = [], gutter = spec.diff ? 16 : 0;
    var textX = CG.padX + (spec.metrics ? CG.meta + CG.metaGap : 0);

    /* A file's own calls run down one lane inside its box, so the box has to be widened to hold it
       before anything is measured. The lane is a fixed strip: calls in it overlap where their paths
       agree, which costs a reader less than a box that grows wider with every caller. */
    var laneOf = {};
    (spec.calls || []).forEach(function (c) {
      var from = String(c.from).split(".")[0];
      if (from !== String(c.to).split(".")[0]) { return; }
      (laneOf[from] = laneOf[from] || []).push(c.from + "~" + c.to);
    });

    (spec.files || []).forEach(function (f) {
      if (f.fog) {
        var lines = cgFogLines(f.fog);
        F[f.id] = { f: f, fog: lines, fns: { all: [], cut: 0 }, lanes: [], s: cgFogSize(lines) };
      } else {
        var fns = cgFns(f, spec.metrics), lanes = laneOf[f.id] || [];
        var reserved = lanes.length ? CG.lane : 0;
        F[f.id] = { f: f, fns: fns, lanes: lanes, s: cgBoxSize(f, fns, gutter + reserved, textX) };
      }
      order.push(f.id);
    });

    /* Free placement wins over every solver: this is what a dragged layout serializes to, so a spec
       carrying x/y is a layout somebody arranged on purpose and nothing may second-guess it. */
    if ((spec.files || []).some(function (f) { return f.x !== undefined || f.y !== undefined; })) {
      var edgeX = 0, edgeY = 0;
      order.forEach(function (id) {
        var it = F[id];
        it.x = it.f.x || 0;
        it.y = it.f.y || 0;
        edgeX = Math.max(edgeX, it.x + it.s.w);
        edgeY = Math.max(edgeY, it.y + it.s.h);
      });
      var canvas = spec.canvas || [];
      return { F: F, order: order, gutter: gutter, textX: textX, w: Math.ceil(canvas[0] || edgeX + CG.pad), h: Math.ceil(canvas[1] || edgeY + CG.pad) };
    }

    var handPlaced = (spec.files || []).some(function (f) { return f.col !== undefined || f.row !== undefined; });
    if (!handPlaced && typeof ErdAuto === "undefined" && typeof console !== "undefined") {
      console.warn("call graph: dagre (ErdAuto) is not on the page, so boxes fall back to a diagonal. " +
                   "Copy the inlined dagre <script> across when cloning this artifact.");
    }

    if (!handPlaced && typeof ErdAuto !== "undefined") {
      var g = new ErdAuto.Graph({ directed: true });
      g.setGraph({ rankdir: "LR", nodesep: 34, ranksep: 116, marginx: CG.pad, marginy: CG.pad });
      g.setDefaultEdgeLabel(function () { return {}; });
      order.forEach(function (id) { g.setNode(id, { width: F[id].s.w, height: F[id].s.h }); });
      var seen = {};
      (spec.calls || []).forEach(function (c) {
        var a = String(c.from).split(".")[0], b = String(c.to).split(".")[0];
        if (a === b || !F[a] || !F[b] || seen[a + ">" + b]) { return; }
        seen[a + ">" + b] = 1;
        g.setEdge(a, b);
      });
      ErdAuto.layout(g);
      order.forEach(function (id) {
        var n = g.node(id);
        F[id].x = Math.round(n.x - F[id].s.w / 2);
        F[id].y = Math.round(n.y - F[id].s.h / 2);
      });
      return { F: F, order: order, gutter: gutter, textX: textX, w: Math.ceil(g.graph().width) + CG.pad, h: Math.ceil(g.graph().height) + CG.pad };
    }

    var colW = {}, rowH = {}, loose = 0;
    order.forEach(function (id) {
      var it = F[id], f = it.f;
      it.col = f.col === undefined && f.row === undefined ? loose : (f.col || 0);
      it.row = f.col === undefined && f.row === undefined ? loose : (f.row || 0);
      if (f.col === undefined && f.row === undefined) { loose += 1; }
      colW[it.col] = Math.max(colW[it.col] || 0, it.s.w);
      rowH[it.row] = Math.max(rowH[it.row] || 0, it.s.h);
    });
    var colX = {}, x = CG.pad;
    Object.keys(colW).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) { colX[c] = x; x += colW[c] + 116; });
    var rowY = {}, y = CG.pad;
    Object.keys(rowH).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) { rowY[r] = y; y += rowH[r] + 34; });
    order.forEach(function (id) { F[id].x = colX[F[id].col]; F[id].y = rowY[F[id].row]; });
    return { F: F, order: order, gutter: gutter, textX: textX, w: Math.ceil(x - 116 + CG.pad), h: Math.ceil(y - 34 + CG.pad) };
  }

  /* Tail on the calling function's right edge, head on the left edge of the box that owns the callee,
     always. One rule means a reader learns the direction once, and it is also what lets a dragged box
     keep reading: drag a callee left of its caller and the curve loops back instead of reversing. */
  function cgEdgePath(x0, y0, x1, y1) {
    var dx = x1 - x0;
    var c = dx >= 0 ? Math.max(34, dx * 0.45) : Math.max(78, -dx * 0.5);
    return "M" + x0 + "," + y0 + " C" + (x0 + c) + "," + y0 + " " + (x1 - c) + "," + y1 + " " + x1 + "," + y1;
  }

  /* A call inside one file has nowhere sensible to go under the outside rule: it would leave the
     right edge, loop all the way around the box and come back in on the left, crossing everything on
     the way. Inside, it is a short rounded-rect hop down a lane of its own, and the head points back
     into the row rather than at the box. */
  function cgSelfEnds(fy, ty) {
    return Math.abs(ty - fy) < 1 ? [fy - 6, ty + 6] : [fy, ty];
  }

  function cgSelfPath(bx, by, sx, hx, fy, ty) {
    var x = bx + hx, spine = bx + sx, y0 = by + fy, y1 = by + ty;
    var dir = y1 > y0 ? 1 : -1;
    var r = Math.min(7, Math.abs(y1 - y0) / 2, spine - x);
    return "M" + x + "," + y0 +
           " H" + (spine - r) +
           " Q" + spine + "," + y0 + " " + spine + "," + (y0 + dir * r) +
           " V" + (y1 - dir * r) +
           " Q" + spine + "," + y1 + " " + (spine - r) + "," + y1 +
           " H" + x;
  }

  function cgAnchor(L, ref) {
    var bits = String(ref).split("."), it = L.F[bits[0]];
    if (!it) { return null; }
    if (it.fog) { return { it: it, oy: it.s.h / 2 }; }
    var idx = it.fns.all.indexOf(bits.slice(1).join("."));
    return { it: it, oy: idx < 0 ? CG.headH / 2 : CG.headH + idx * CG.rowH + CG.rowH / 2 };
  }

  var CG_SIGN = { add: "+", del: "\u2212", mod: "~" };

  /* Two readings stacked in the left gutter, and together they have to fit the row height rather than
     add to it: a size bar on top, a github style change block under it. The bar is relative to the
     largest function in its own file, because size only means anything against its neighbours. The
     blocks are relative to the biggest change anywhere in the graph, so a box with a small edit does
     not look as busy as the one carrying the change. */
  function cgMetaScales(spec, L) {
    var perFile = {}, maxChange = 0;
    L.order.forEach(function (id) {
      var it = L.F[id], top = 0;
      it.fns.all.forEach(function (name) {
        var m = spec.metrics[id + "." + name] || {};
        top = Math.max(top, m.lines || 0);
        maxChange = Math.max(maxChange, (m.added || 0) + (m.removed || 0));
      });
      perFile[id] = top;
    });
    return { perFile: perFile, maxChange: maxChange };
  }

  /* Five blocks carrying two facts: how many are lit says how big the change is next to the biggest
     one in the graph, and the green to red split inside them says what kind. */
  function cgBlocks(m, maxChange) {
    var total = (m.added || 0) + (m.removed || 0);
    if (!total || !maxChange) { return null; }
    /* A change with both kinds needs at least two blocks, or the rounding puts the whole thing in
       one block of one colour and a row that added and deleted reads as purely additive. */
    var floor = (m.added || 0) > 0 && (m.removed || 0) > 0 ? 2 : 1;
    var filled = Math.max(floor, Math.min(5, Math.round(5 * total / maxChange)));
    var green = Math.round(filled * (m.added || 0) / total);
    var red = filled - green;
    if ((m.added || 0) > 0 && green === 0) { green = 1; red = filled - 1; }
    if ((m.removed || 0) > 0 && red === 0 && filled > 1) { red = 1; green = filled - 1; }
    return { green: green, red: Math.max(0, red), filled: filled };
  }

  function cgMeta(m, y, sizeFrac, maxChange) {
    var out = '<g class="cg-meta">';
    out += '<rect class="cg-barbg" x="' + CG.padX + '" y="' + y + '" width="' + CG.meta + '" height="' + CG.barH + '" rx="1.5"/>';
    if (sizeFrac > 0) {
      out += '<rect class="cg-barfill" x="' + CG.padX + '" y="' + y + '" width="' +
             Math.max(2, Math.round(CG.meta * sizeFrac)) + '" height="' + CG.barH + '" rx="1.5"/>';
    }
    var b = cgBlocks(m, maxChange);
    if (b) {
      for (var i = 0; i < 5; i += 1) {
        var kind = i < b.green ? "add" : (i < b.green + b.red ? "del" : "off");
        out += '<rect class="cg-sq cg-sq-' + kind + '" x="' + (CG.padX + i * (CG.sq + CG.sqGap)) +
               '" y="' + (y + CG.barH + 2) + '" width="' + CG.sq + '" height="' + CG.sq + '" rx="1"/>';
      }
    }
    return out + "</g>";
  }

  function renderCallGraph(spec, uid) {
    var L = layoutCallGraph(spec), mark = cgDiffMark(spec), docs = spec.docs || {}, out = "";
    var scales = spec.metrics ? cgMetaScales(spec, L) : null;

    L.order.forEach(function (id) {
      var it = L.F[id], s = it.s;
      if (it.fog) {
        /* The whole box carries the key here. On a file box the chrome is structure and must not
           dim, but a fog node has no contents to dim instead. It is the content. */
        out += '<g class="cv-box cg-fog" data-node="' + esc(id) + '" data-w="' + s.w + '" data-h="' + s.h +
               '" data-k="' + esc(id) + '" transform="translate(' + it.x + "," + it.y + ')">';
        out += '<rect class="cg-fogplate" x="0" y="0" width="' + s.w + '" height="' + s.h + '" rx="7"/>';
        it.fog.forEach(function (line, i) {
          out += '<text class="cg-fogtext" x="' + (s.w / 2) + '" y="' +
                 (CG_FOG.padY + 11 + i * CG_FOG.lineH) + '" text-anchor="middle">' + esc(line) + "</text>";
        });
        out += "</g>";
        return;
      }
      /* No data-k on the box, only on its rows. The plate, the rule and the filename are structure,
         and a walkthrough that dims what it is not focusing must never take the chrome with it. */
      out += '<g class="cv-box" data-node="' + esc(id) + '" data-w="' + s.w + '" data-h="' + s.h +
             '" transform="translate(' + it.x + "," + it.y + ')">';
      out += '<rect class="cg-plate" x="0" y="0" width="' + s.w + '" height="' + s.h + '" rx="7"/>';
      out += '<path class="cg-rule" d="M0,' + CG.headH + " H" + s.w + '"/>';
      /* A file docstring hangs off the bare id, the same key a diff or a walkthrough uses to mean the
         whole file. The hit area is the header band up to the eye, so the control keeps its own space. */
      var fileDoc = docs[id];
      out += '<g class="cg-filehead"' + (fileDoc ? ' data-doc="' + esc(fileDoc) + '" tabindex="0" role="button" aria-label="' +
             esc(it.f.name + ", file docstring on hover") + '"' : "") + ">";
      if (fileDoc) {
        out += '<rect class="cg-headhit" x="1.5" y="1.5" width="' + (s.w - 32) + '" height="' + (CG.headH - 2) + '" rx="5"/>';
      }
      out += '<text class="cg-file" x="' + CG.padX + '" y="17">' + esc(it.f.name) + "</text>";
      if (fileDoc) {
        out += '<path class="cg-docline" d="M' + CG.padX + ",21 H" + (CG.padX + Math.round(textW(it.f.name, 11.5, true))) + '"/>';
      }
      out += "</g>";
      it.fns.all.forEach(function (n, i) {
        var top = CG.headH + i * CG.rowH, cy = top + CG.rowH / 2;
        if (i === it.fns.cut && i > 0) {
          out += '<path class="cg-split" d="M' + (CG.padX - 5) + "," + top + " H" + (s.w - CG.padX + 5) + '"/>';
        }
        /* The sign is not decoration. Colour alone cannot carry add against remove, and a diff is
           exactly the figure most likely to be read on a projector or printed to grey. */
        var key = id + "." + n, d = mark(key), doc = docs[key];
        out += '<g class="cg-fn' + (cgIsPriv(n) ? " priv" : "") + (d ? " " + d : "") +
               '" data-fn="' + esc(key) + '" data-k="' + esc(key) + '"';
        if (doc) {
          out += ' data-doc="' + esc(doc) + '" tabindex="0" role="button" aria-label="' +
                 esc(n + ", docstring on hover") + '"';
        }
        out += ">";
        out += '<rect class="cg-band" x="1.5" y="' + top + '" width="' + (s.w - 3) + '" height="' + CG.rowH + '" rx="3"/>';
        if (scales) {
          var m = spec.metrics[key] || {}, cap = scales.perFile[id] || 0;
          out += cgMeta(m, cy - 5, cap ? (m.lines || 0) / cap : 0, scales.maxChange);
        }
        out += '<text x="' + L.textX + '" y="' + (cy + 4) + '">' + esc(n) + "</text>";
        /* A dotted rule under the name, because a tooltip nobody knows is there is not documentation.
           It is drawn rather than set as text-decoration, which SVG support for is uneven. */
        if (doc) {
          out += '<path class="cg-docline" d="M' + L.textX + "," + (cy + 7) + " H" +
                 (L.textX + Math.round(textW(n, 11, true))) + '"/>';
        }
        if (d) {
          out += '<text class="cg-sign" x="' + (s.w - 7) + '" y="' + (cy + 4) + '" text-anchor="end">' + CG_SIGN[d] + "</text>";
        }
        out += "</g>";
      });
      out += cvChrome(it.f.name, s.w, s.h);
      out += "</g>";
    });

    out += '<g class="cg-edges">';
    (spec.calls || []).forEach(function (c) {
      var a = cgAnchor(L, c.from), b = cgAnchor(L, c.to);
      if (!a || !b) { return; }
      /* Edge keys follow the flowchart's from~to shape. A call is a thing a walkthrough steps over,
         so it needs a key of its own, and the tilde keeps it clear of the dot-prefix row matching. */
      var ek = c.from + "~" + c.to, ed = mark(ek);
      var selfCall = a.it === b.it && !a.it.fog;
      var x0, y0, x1, y1, d, headD, extra = "";
      if (selfCall) {
        var sx = a.it.s.w - L.gutter - 11, hx = sx - CG.laneStub;
        var ends = cgSelfEnds(a.oy, b.oy);
        d = cgSelfPath(a.it.x, a.it.y, sx, hx, ends[0], ends[1]);
        x0 = a.it.x + hx; y0 = a.it.y + ends[0];
        x1 = x0; y1 = a.it.y + ends[1];
        headD = "M0,0 L8,-4 L8,4 Z";
        extra = ' data-self="1" data-sx="' + sx + '" data-hx="' + hx + '"';
      } else {
        x0 = a.it.x + a.it.s.w; y0 = a.it.y + a.oy; x1 = b.it.x; y1 = b.it.y + b.oy;
        d = cgEdgePath(x0, y0, x1, y1);
        headD = "M0,0 L-8,-4 L-8,4 Z";
      }
      out += '<g class="cg-edge cv-edge' + (ed ? " " + ed : "") + '" data-k="' + esc(ek) +
             '" data-from="' + esc(String(c.from).split(".")[0]) + '" data-to="' + esc(String(c.to).split(".")[0]) +
             '" data-fy="' + a.oy + '" data-ty="' + b.oy + '" data-fk="' + esc(c.from) + '" data-tk="' + esc(c.to) + '"' + extra + '>';
      out += '<path class="cg-line" d="' + d + '"/>';
      out += '<circle class="cg-tail" cx="' + x0 + '" cy="' + y0 + '" r="2.4"/>';
      out += '<path class="cg-head" transform="translate(' + x1 + "," + y1 + ')" d="' + headD + '"/>';
      out += "</g>";
    });
    out += "</g>";

    /* One CSS pixel per unit, so a graph too wide for its column scrolls inside the figure instead
       of scaling its text down. Every call graph on the page then sets at the same size, which is what
       lets a reader compare two of them. */
    return '<svg class="cg cv" data-canvas="cg" viewBox="0 0 ' + L.w + " " + L.h + '" role="img" aria-label="' +
           esc(spec.alt || "call graph") + '" style="width:' + L.w +
           'px; height:auto; display:block">' + out + "</svg>";
  }

  var CALLGRAPHS = {};

  function renderScreens(spec, uid, key) {
    var L = scLayout(spec), out = "";
    var hatch = function (id, c) {
      return '<pattern id="' + id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
             '<line x1="0" y1="0" x2="0" y2="5" stroke="' + c + '" stroke-width="1.6"/></pattern>';
    };
    out += '<defs><marker id="' + uid + '-nav" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">' +
           '<path d="M0,0 L10,5 L0,10 z" fill="' + COL.act + '"/></marker>' +
           hatch(uid + "-hatch", COL.line) + hatch(uid + "-hatchA", COL.act) + "</defs>";

    spec.screens.forEach(function (sc) {
      var it = L.S[sc.id], t0 = SC.labelH, w = it.w;
      /* One box per screen, contents relative to its origin, so a drag is one transform. The key is
         the screen id, as it always was: a walkthrough dims screens as units and buttons by name. */
      out += '<g class="cv-box" data-node="' + esc(sc.id) + '" data-k="' + esc(sc.id) + '" data-w="' + w + '" data-h="' + it.h +
             '" transform="translate(' + it.x + "," + it.y + ')">';
      out += '<rect x="0" y="' + t0 + '" width="' + w + '" height="' + it.sh + '" rx="' + SC.radius +
             '" fill="' + COL.surface + '" stroke="' + COL.line + '" stroke-width="1.3"/>';
      out += '<text x="0" y="12" style="font:700 11px var(--mono); fill:' + COL.soft + '; letter-spacing:0.06em">' + esc(sc.label) + "</text>";

      sc.elements.forEach(function (e) {
        var r = null;
        Object.keys(it.el).forEach(function (k) { if (it.el[k].e === e) { r = it.el[k]; } });
        if (!r) { return; }
        if (e.type === "topbar") {
          out += '<path d="M' + 0.7 + "," + (t0 + SC.radius) + " a" + SC.radius + "," + SC.radius + " 0 0 1 " + SC.radius + ",-" + SC.radius +
                 " h" + (w - SC.radius * 2 - 1.4) + " a" + SC.radius + "," + SC.radius + " 0 0 1 " + SC.radius + "," + SC.radius +
                 " v" + (SC.barH - SC.radius) + " h-" + (w - 1.4) + ' Z" fill="' + COL.surface2 + '" stroke="none"/>';
          out += '<line x1="0.7" y1="' + (t0 + SC.barH) + '" x2="' + (w - 0.7) + '" y2="' + (t0 + SC.barH) +
                 '" stroke="' + COL.line + '" stroke-width="1.2"/>';
          /* Chevron sits well inside the rounded corner so it never rides the frame stroke. */
          if (e.back) {
            out += '<path d="M21,' + (t0 + 10) + " L16," + (t0 + 15) + " L21," + (t0 + 20) + '" fill="none" stroke="' + COL.soft +
                   '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
          }
          if (e.label) {
            out += '<text x="' + (w / 2) + '" y="' + (t0 + 19) + '" text-anchor="middle" style="font:700 10.5px var(--mono); fill:' + COL.ink + '">' + esc(e.label) + "</text>";
          } else {
            out += scSkeleton(w / 2 - 32, t0 + 9, 64, 12, uid);
          }
        } else if (e.type === "list") {
          for (var i = 0; i < r.rows; i++) {
            var ry = r.y + i * (SC.rowH + SC.rowGap);
            out += '<rect x="' + r.x + '" y="' + ry + '" width="' + r.w + '" height="' + SC.rowH + '" rx="4" fill="' + COL.surface +
                   '" stroke="' + COL.line + '" stroke-width="1.1"/>';
            if (e.items && e.items[i]) {
              out += '<text x="' + (r.x + 8) + '" y="' + (ry + 13.5) + '" style="font:9.5px var(--mono); fill:' + COL.ink + '">' + esc(e.items[i]) + "</text>";
            } else {
              out += scSkeleton(r.x + 8, ry + 5, r.w - 44, 11, uid);
            }
          }
        } else if (e.type === "block") {
          out += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="6" fill="' + COL.surface2 +
                 '" stroke="' + COL.line + '" stroke-width="1.1" stroke-dasharray="' + (e.label ? "0" : "5 4") + '"/>';
          if (e.label) {
            out += '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2 + 4) + '" text-anchor="middle" style="font:10px var(--mono); fill:' + COL.soft + '">' + esc(e.label) + "</text>";
          }
        } else if (e.type === "media") {
          out += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="6" fill="' + COL.surface2 +
                 '" stroke="' + COL.line + '" stroke-width="1.1"/>';
          var strip = e.thumbs ? SC.thumb + 14 : 0;
          var gcy = r.y + (r.h - strip) / 2 - (e.label ? 7 : 0);
          out += scGlyph(e.kind === "video" ? "video" : "image", r.x + r.w / 2, gcy);
          if (e.label) {
            out += '<text x="' + (r.x + r.w / 2) + '" y="' + (gcy + 30) + '" text-anchor="middle" style="font:10px var(--mono); fill:' + COL.soft + '">' + esc(e.label) + "</text>";
          }
          if (e.thumbs) {
            out += scThumbs(r.x + 8, r.y + r.h - SC.thumb - 8, e.thumbs, e.captured !== false, uid);
          }
        } else if (e.type === "thumbs") {
          out += scThumbs(r.x, r.y + 4, e.count || 3, e.captured !== false, uid);
        } else if (e.type === "button") {
          out += '<g data-k="' + esc(sc.id + "~" + e.id) + '">';
          out += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="' + (r.h / 2) +
                 '" fill="' + COL.actSoft + '" stroke="' + COL.act + '" stroke-width="1.5"/>';
          if (e.label) {
            out += '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2 + 4) + '" text-anchor="middle" style="font:700 10px var(--mono); fill:' + COL.act + '">' + esc(e.label) + "</text>";
          } else {
            out += scSkeleton(r.x + r.w / 2 - 30, r.y + r.h / 2 - 6, 60, 12, uid, true);
          }
          out += "</g>";
        }
      });
      /* The veil covers the frame, not the label, and takes the frame's own corner radius. The eye sits
         in the label strip, outside the frame, so nothing that is not part of the screen is drawn on it. */
      out += '<g transform="translate(0,' + t0 + ')">' + cvChrome(sc.label || sc.id, w, it.sh, SC.radius, { x: w - 11, y: -t0 / 2 }) + "</g>";
      out += "</g>";
    });

    /* Arrows go on top: a tail starts inside its screen, on the button, and a screen drawn later would
       hide it. Each arrow is a canvas edge, keyed like the button it leaves so a walkthrough lights the
       two together, and redrawn by index whenever a screen moves. */
    var links = spec.links || [], geoms = scEdges(L, links);
    out += '<g class="sc-edges">';
    links.forEach(function (lk, li) {
      var fb = String(lk.from).split(".");
      out += '<g class="cv-edge" data-k="' + esc(fb[0] + "~" + fb[1]) + '" data-li="' + li + '" data-from="' + esc(fb[0]) +
             '" data-to="' + esc(String(lk.to).split(".")[0]) + '">' + scEdgeInner(geoms[li], lk, uid) + "</g>";
    });
    out += "</g>";

    return '<svg class="seq cv" data-canvas="screen" data-spec="' + esc(key || "") + '" data-uid="' + esc(uid) + '" viewBox="0 0 ' + L.w + " " + L.h +
           '" role="img" aria-label="' + esc(spec.alt || spec.title || "lo-fi mockup") +
           '" style="width:100%; min-width:' + Math.min(L.w, 700) + 'px; height:auto; display:block">' + out + "</svg>";
  }

  /* ---------- component 07 · code tour ---------- */
  /* A tour shows the load-bearing lines of a change, file by file, while the change is still a plan.
     Each block is a diff or plain code in one language, highlighted by Prism, with green and red bands
     for what is added and removed, and with comments that open a group lifted out as headings. */
  var TOURS = {};

  var TOUR_LANG = { python: "python", py: "python", sql: "sql", ts: "typescript", typescript: "typescript", tsx: "tsx" };
  var TOUR_COMMENT = { python: "#", sql: "--", typescript: "//", tsx: "//" };
  var TOUR_STATUS = { "new": ["new", "new file"], edit: ["edit", "edits existing file"], "delete": ["del", "deletes existing file"], rename: ["ren", "renames existing file"] };

  /* Prism highlights the whole snippet at once, so a string or docstring that spans lines is one token.
     Splitting its html at newlines then has to close every open span at the end of a line and reopen
     it on the next, or the bands would get unbalanced markup. */
  function tourSplitLines(html) {
    var lines = [], open = [], cur = "", re = /<span class="([^"]*)">|<\/span>|\n|[^<\n]+|</g, m;
    while ((m = re.exec(html))) {
      var t = m[0];
      if (t === "\n") {
        for (var i = 0; i < open.length; i++) { cur += "</span>"; }
        lines.push(cur);
        cur = "";
        open.forEach(function (o) { cur += '<span class="' + o + '">'; });
      } else if (t === "</span>") { open.pop(); cur += t; }
      else if (t.charAt(0) === "<" && t.length > 1) { open.push(m[1]); cur += t; }
      else { cur += t; }
    }
    lines.push(cur);
    return lines;
  }

  function tourHighlight(code, lang) {
    var P = window.Prism, g = P && P.languages && P.languages[lang];
    if (!g) { return esc(code).split("\n"); }
    return tourSplitLines(P.highlight(code, g, lang));
  }

  /* A block is a diff when any line opens with a sign. In a diff the first column is the sign and one
     space after it is a separator rather than code, so "+ foo" and "  foo" line up. A comment that
     opens a group, first in the block or after a blank line and followed by code, becomes a heading and
     takes the blank line before it with it. */
  function tourParse(block) {
    var lang = TOUR_LANG[block.lang] || "python", tok = TOUR_COMMENT[lang];
    var raw = String(block.code || "").replace(/^\n+|\n+$/g, "").split("\n");
    var isDiff = raw.some(function (l) { return /^[+-]( |$)/.test(l); });
    var rows = raw.map(function (l) {
      var sign = "";
      if (isDiff) {
        var c0 = l.charAt(0);
        sign = " ";
        /* A line with no sign at all is context as written. Insisting on the leading space would
           eat the first character of a comment someone typed flush left. */
        if (c0 === "+" || c0 === "-" || c0 === " ") {
          sign = c0;
          l = l.slice(1);
          if (l.charAt(0) === " ") { l = l.slice(1); }
        }
      }
      return { sign: sign, code: l };
    });
    var isComment = function (r) { return r && r.code.trim().indexOf(tok) === 0; };
    var isBlank = function (r) { return !r || r.code.trim() === ""; };
    var out = [];
    rows.forEach(function (r, i) {
      var opens = isComment(r) && isBlank(rows[i - 1]) && !isBlank(rows[i + 1]) && !isComment(rows[i + 1]);
      if (opens && block.headings !== false) {
        if (out.length && out[out.length - 1].kind === "code" && isBlank(out[out.length - 1])) { out.pop(); }
        out.push({ kind: "h", text: r.code.trim().slice(tok.length).trim() });
      } else {
        out.push({ kind: "code", sign: r.sign, code: r.code });
      }
    });
    return { lang: lang, diff: isDiff, rows: out };
  }

  function tourPath(file) {
    var cut = String(file).lastIndexOf("/");
    if (cut < 0) { return esc(file); }
    return '<span class="dir">' + esc(file.slice(0, cut + 1)) + "</span>" + esc(file.slice(cut + 1));
  }

  function renderTourBlock(b) {
    var p = tourParse(b), codeRows = p.rows.filter(function (r) { return r.kind === "code"; });
    var hl = tourHighlight(codeRows.map(function (r) { return r.code; }).join("\n"), p.lang), ci = 0;
    var st = TOUR_STATUS[b.status] || TOUR_STATUS.edit, out = "";
    if (b.idea || b.support) {
      out += '<p class="tour-lead">' + (b.idea ? '<span class="idea">' + b.idea + "</span>" : "") +
             (b.idea && b.support ? " " : "") + (b.support ? '<span class="support">' + b.support + "</span>" : "") + "</p>";
    }
    out += '<figure class="figcard tour">';
    /* A rename shows both paths, the old one struck through, so a reader searching for the old name finds it. */
    out += '<div class="tour-file"><span class="tour-path">' +
           (b.from ? '<span class="tour-from">' + tourPath(b.from) + '</span><span class="tour-arrow">\u2192</span>' : "") + tourPath(b.file) + '</span>' +
           '<span class="tour-lang">' + esc(b.lang) + '</span>' +
           '<span class="tour-status ' + st[0] + '">' + st[1] + "</span></div>";
    out += '<pre class="tour-code">';
    if (!p.rows.length) { out += '<div class="tour-empty">no lines</div>'; }
    p.rows.forEach(function (r) {
      if (r.kind === "h") { out += '<div class="tour-h">' + esc(r.text) + "</div>"; return; }
      var cls = r.sign === "+" ? " add" : r.sign === "-" ? " del" : "";
      out += '<div class="tour-line' + cls + '"><span class="tour-sign">' + (r.sign === "-" ? "\u2212" : r.sign === "+" ? "+" : "") +
             '</span><span class="tour-src">' + (hl[ci++] || "") + "</span></div>";
    });
    out += "</pre>";
    out += '<details class="specview"><summary>view spec</summary><button class="speccopy" type="button">copy json</button><pre>' +
           esc(specText(b)) + "</pre></details>";
    out += '<div class="tblock"><div class="nm">' + esc(b.slug || "") + "</div></div>";
    out += "</figure>";
    return '<div class="tour-block">' + out + "</div>";
  }

  function renderTour(spec) {
    return (spec.blocks || []).map(renderTourBlock).join("");
  }

  /* ---------- metacomponent · walkthrough ---------- */
  /* Wraps any figure from any component. The renderers tag their drawable parts with data-k;
     this only decides which keys are past, present, or not yet reached, so it never has to know
     whether it is driving a sequence diagram, a flowchart, or an ERD. Structural marks carry no
     data-k and therefore stay lit the whole way through. */
  /* Every atom in the library is walkthroughable, and a walkthrough may hold any combination of
     them. There is no composite type: one panel and six panels take the same code path, because the
     only thing a panel owes the wrapper is "render yourself and tag your parts with data-k". */
  var WT_RENDER = {
    seq: function (k, uid) { return renderSequence(SPECS[k], uid); },
    flow: function (k, uid) { return renderFlow(FLOWS[k], uid); },
    erd: function (k, uid) { return renderErd(ERDS[k], uid, k); },
    screen: function (k, uid) { return renderScreens(SCREENS[k], uid, k); },
    tbl: function (k, uid, extra) { return renderTableFrozen(TABLES[k], uid, extra); },
    cg: function (k, uid) { return renderCallGraph(CALLGRAPHS[k], uid); }
  };

  function wtPanels(spec) {
    return spec.panels || [{ kind: spec.kind, base: spec.base }];
  }

  /* A key is either bare or panel-qualified. Bare keys match in every panel, which is what keeps
     every single-panel spec written before panels existed working untouched. */
  function wtSplitKey(k) {
    var i = String(k).indexOf(":");
    return i < 0 ? { panel: null, key: String(k) } : { panel: k.slice(0, i), key: k.slice(i + 1) };
  }
  function wtHits(target, key) {
    if (key.panel && key.panel !== target.panel) { return false; }
    /* Prefix on a dot, so focusing a row lights its cells without listing them. */
    return target.key === key.key || target.key.indexOf(key.key + ".") === 0;
  }

  /* Step scoped annotation on a call graph: what goes in to and comes out of one call, and what a
     file touches on the side. It is drawn as an overlay on the walkthrough's own svg and rebuilt on
     every step, so it exists only while its step is current. It carries no data-k, so the wrapper
     never dims it, and it reads geometry off the elements already on screen rather than recomputing
     any layout. Everything that positions or draws is a pure function of numbers, and only
     cgAnnotate itself touches the DOM. */
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ANNO = { h: 24, padX: 9, gap: 6, off: 14, glyphDrop: 26, fxStep: 84 };

  var ANNO_LINE = 13, ANNO_PADY = 6;

  function cgOverlap(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }

  function cgWrap(text, maxW, px) {
    var lines = [], cur = "";
    String(text).split(/\s+/).forEach(function (word) {
      var next = cur ? cur + " " + word : word;
      if (textW(next, px, false) > maxW && cur) { lines.push(cur); cur = word; } else { cur = next; }
    });
    if (cur) { lines.push(cur); }
    return lines;
  }

  /* The free horizontal run at a given height: the nearest box edge to the left of x and to the
     right of x among boxes that share that band. Measured against every box rather than read off one
     edge's endpoints, because the box a note actually collides with is often a neighbour in the same
     rank that is inset differently from the one the wire lands on. */
  function cgFreeSpan(x, y, obstacles, vbw) {
    var left = 0, right = vbw;
    (obstacles || []).forEach(function (o) {
      if (o.y > y + 40 || o.y + o.h < y - 40) { return; }
      if (o.x + o.w <= x && o.x + o.w > left) { left = o.x + o.w; }
      if (o.x >= x && o.x < right) { right = o.x; }
    });
    return { left: left, right: right };
  }

  /* A note pinned to one end of a call. The anchor is the exact head or tail, and a leader runs from
     the note to it, so the reader is never left guessing which end is meant. The note itself sits in
     the channel beside that end, wrapped to fit the channel's free width. A dense graph has no room
     near a box for a one line label, so a label that stays one line covers something wherever it goes,
     and the channel between ranks is the one strip that is reliably empty.

     side is which way from the anchor the note prefers to sit vertically, and nearX which side of the
     anchor the channel is on. Four vertical spots are tried in order, and the first that covers no box
     wins. If every spot covers something, the one covering least does. */
  function cgAnnoAt(label, text, ax, ay, side, nearX, probeX, vbw, vbh, obstacles) {
    var span = cgFreeSpan(probeX, ay, obstacles, vbw);
    var maxW = Math.max(84, Math.min(220, span.right - span.left - 22));
    var labelW = textW(label, 8.5, true), lines = cgWrap(text, maxW - ANNO.padX * 2, 11), tw = labelW;
    lines.forEach(function (l) { tw = Math.max(tw, textW(l, 11, false)); });
    var w = Math.round(ANNO.padX * 2 + tw), h = ANNO_PADY * 2 + 11 + lines.length * ANNO_LINE;
    var x = nearX < 0 ? span.right - ANNO.off - w : span.left + ANNO.off;
    x = Math.max(4, Math.min(x, vbw - 4 - w));
    var ys = [side < 0 ? ay - 10 - h : ay + 10, side < 0 ? ay + 10 : ay - 10 - h,
              side < 0 ? ay - 14 - 2 * h : ay + 14 + h, side < 0 ? ay + 14 + h : ay - 14 - 2 * h];
    var best = null;
    ys.forEach(function (yy) {
      if (best && best.cost === 0) { return; }
      var y = Math.max(4, Math.min(Math.round(yy), vbh - 4 - h)), r = { x: x, y: y, w: w, h: h }, cost = 0;
      (obstacles || []).forEach(function (o) { cost += cgOverlap(r, o); });
      if (!best || cost < best.cost) { best = { y: y, cost: cost }; }
    });
    var rect = { x: x, y: best.y, w: w, h: h };
    /* Leader to the closest point on the note's edge, whichever side the note ended up on. */
    var lx = Math.max(rect.x, Math.min(ax, rect.x + w)), ly = Math.max(rect.y, Math.min(ay, rect.y + h));
    var svg = '<path class="cg-anno-lead" d="M' + ax + "," + ay + " L" + lx + "," + ly + '"/>' +
              '<circle class="cg-anno-pin" cx="' + ax + '" cy="' + ay + '" r="2.6"/>' +
              '<rect class="cg-anno-box" x="' + rect.x + '" y="' + rect.y + '" width="' + w + '" height="' + h + '" rx="4"/>' +
              '<text class="cg-anno-lbl" x="' + (rect.x + ANNO.padX) + '" y="' + (rect.y + ANNO_PADY + 8) + '">' + esc(label.toUpperCase()) + "</text>";
    lines.forEach(function (l, i) {
      svg += '<text class="cg-anno-txt" x="' + (rect.x + ANNO.padX) + '" y="' + (rect.y + ANNO_PADY + 20 + i * ANNO_LINE) + '">' + esc(l) + "</text>";
    });
    return { svg: svg, rect: rect };
  }

  function cgAnnoGlyph(kind, gx, gy) {
    if (kind === "db") {
      return '<ellipse class="cg-anno-glyph" cx="' + gx + '" cy="' + (gy - 6) + '" rx="9" ry="3.5"/>' +
             '<path class="cg-anno-glyph" d="M' + (gx - 9) + "," + (gy - 6) + " V" + (gy + 6) +
             " A9,3.5 0 0 0 " + (gx + 9) + "," + (gy + 6) + " V" + (gy - 6) + '"/>';
    }
    return '<circle class="cg-anno-glyph" cx="' + gx + '" cy="' + gy + '" r="7"/>';
  }

  /* Below the box by default, above it when below would land on another box. Boxes in one rank sit
     a nodesep apart, which is less than a glyph and its label need, so this is not a corner case. */
  function cgAnnoEffect(fx, bx, by, bw, bh, slot, vbw, vbh, obstacles) {
    var gx = bx + 24 + slot * ANNO.fxStep, half = Math.max(11, Math.ceil(textW(fx.text || "", 10, false) / 2));
    var below = { gy: by + bh + ANNO.glyphDrop, rect: { x: gx - half, y: by + bh + ANNO.glyphDrop - 9, w: half * 2, h: 33 } };
    var above = { gy: by - ANNO.glyphDrop, rect: { x: gx - half, y: by - ANNO.glyphDrop - 24, w: half * 2, h: 33 } };
    var cost = function (c) {
      var t = c.rect.y < 4 || c.rect.y + c.rect.h > vbh - 4 ? 1e6 : 0;
      (obstacles || []).forEach(function (o) { t += cgOverlap(c.rect, o); });
      return t;
    };
    var up = cost(above) < cost(below), c = up ? above : below, gy = c.gy;
    var lead = up
      ? '<path class="cg-anno-lead" d="M' + gx + "," + (by - 1) + " V" + (gy + 12) + '"/>' +
        '<path class="cg-anno-head" d="M' + gx + "," + (gy + 9) + " l-3.5,5 h7 z" + '"/>'
      : '<path class="cg-anno-lead" d="M' + gx + "," + (by + bh + 1) + " V" + (gy - 12) + '"/>' +
        '<path class="cg-anno-head" d="M' + gx + "," + (gy - 9) + " l-3.5,-5 h7 z" + '"/>';
    return { svg: lead + cgAnnoGlyph(fx.kind, gx, gy) +
                  '<text class="cg-anno-fx" x="' + gx + '" y="' + (up ? gy - 14 : gy + 22) + '" text-anchor="middle">' + esc(fx.text || "") + "</text>",
             rect: c.rect };
  }

  function cgAnnotate(svg, step) {
    var old = svg.querySelector(".cg-anno");
    if (old) { old.parentNode.removeChild(old); }
    if (!step || (!step.io && !(step.effects && step.effects.length))) { return; }
    var vb = svg.viewBox.baseVal, out = "";
    var obstacles = [].slice.call(svg.querySelectorAll(".cv-box")).map(function (b) {
      var at = cvPos(b);
      return { x: at.x, y: at.y, w: +b.getAttribute("data-w"), h: +b.getAttribute("data-h") };
    });

    if (step.io && step.io.call) {
      var key = wtSplitKey(step.io.call).key, edge = null;
      [].slice.call(svg.querySelectorAll(".cg-edge")).forEach(function (e) {
        if (e.getAttribute("data-k") === key) { edge = e; }
      });
      if (edge) {
        var tail = edge.querySelector(".cg-tail"), head = edge.querySelector(".cg-head");
        var tx = +tail.getAttribute("cx"), ty = +tail.getAttribute("cy");
        var hm = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(head.getAttribute("transform") || "");
        var hx = hm ? +hm[1] : tx, hy = hm ? +hm[2] : ty;
        /* In pins to the head, where the call arrives, and sits in the channel to its left. Out pins to
           the tail, where the result comes back, and sits in the channel to its right. A call inside
           one file has both ends inside the box, so both notes sit off the box's right edge and their
           leaders reach back in to the lane. */
        var isSelf = !!edge.getAttribute("data-self"), inProbe = hx - 4, outProbe = tx + 4, inNear = -1;
        if (isSelf) {
          var host = svg.querySelector('.cv-box[data-node="' + edge.getAttribute("data-from") + '"]');
          inProbe = outProbe = cvPos(host).x + (+host.getAttribute("data-w")) + 4;
          inNear = 1;
        }
        var placed;
        if (step.io["in"]) {
          placed = cgAnnoAt("in", step.io["in"], hx, hy, -1, inNear, inProbe, vb.width, vb.height, obstacles);
          out += placed.svg;
          obstacles.push(placed.rect);
        }
        if (step.io.out) {
          placed = cgAnnoAt("out", step.io.out, tx, ty, 1, 1, outProbe, vb.width, vb.height, obstacles);
          out += placed.svg;
          obstacles.push(placed.rect);
        }
      }
    }

    var slots = {};
    (step.effects || []).forEach(function (fx) {
      var fileId = String(fx.at || "").split(".")[0];
      var box = svg.querySelector('.cv-box[data-node="' + fileId + '"]');
      if (!box) { return; }
      var p = cvPos(box), slot = slots[fileId] || 0;
      slots[fileId] = slot + 1;
      var fxp = cgAnnoEffect(fx, p.x, p.y, +box.getAttribute("data-w"), +box.getAttribute("data-h"), slot, vb.width, vb.height, obstacles);
      out += fxp.svg;
      obstacles.push(fxp.rect);
    });

    var g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "cg-anno");
    g.innerHTML = out;
    svg.appendChild(g);
  }

  function mountWalkthrough(root) {
    var spec = WALKS[root.getAttribute("data-wt")];
    if (!spec) { return; }
    var stage = root.querySelector(".wt-stage");
    var panels = wtPanels(spec);
    var steps = spec.steps;

    /* Collect every value any step will write, grouped by the column it lands in, so a table can be
       laid out once at its widest and never reflow while the scrubber moves. */
    var writesByColumn = {};
    steps.forEach(function (st) {
      Object.keys(st.set || {}).forEach(function (raw) {
        var col = wtSplitKey(raw).key.split(".").pop();
        (writesByColumn[col] = writesByColumn[col] || []).push(String(st.set[raw]));
      });
    });

    stage.innerHTML = "";
    var frames = panels.map(function (p, pi) {
      var id = p.id || p.kind;
      var box = document.createElement("div");
      box.className = "wt-panel";
      box.innerHTML = WT_RENDER[p.kind](p.base, "wt-" + id + "-" + pi, writesByColumn);
      if (p.label) {
        var cap = document.createElement("p");
        cap.className = "wt-panel-label";
        cap.textContent = p.label;
        box.insertBefore(cap, box.firstChild);
      }
      stage.appendChild(box);
      return { id: id, box: box, kind: p.kind };
    });

    /* Effects hang below the lowest box, and the canvas was sized without them. Add the room once, up
       front, rather than resizing per step and making the figure jump under the scrubber. */
    if (steps.some(function (st) { return st.effects && st.effects.length; })) {
      frames.forEach(function (f) {
        var svg = f.kind === "cg" ? f.box.querySelector("svg.cg") : null;
        if (!svg) { return; }
        var vb = svg.viewBox.baseVal;
        svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.width + " " + (vb.height + 72));
      });
    }

    var range = root.querySelector(".wt-range");
    var note = root.querySelector(".wt-note");
    var count = root.querySelector(".wt-count");
    var last = steps.length - 1;
    range.max = String(last);

    var groups = [], valueEls = [];
    frames.forEach(function (f) {
      [].slice.call(f.box.querySelectorAll("[data-k]")).forEach(function (el) {
        groups.push({ el: el, panel: f.id, key: el.getAttribute("data-k") });
      });
      [].slice.call(f.box.querySelectorAll("[data-v]")).forEach(function (el) {
        valueEls.push({ el: el, panel: f.id, key: el.getAttribute("data-v"), original: el.textContent });
      });
    });

    var seenBy = steps.map(function (_, i) {
      var out = [];
      for (var j = 0; j <= i; j++) { (steps[j].focus || []).forEach(function (k) { out.push(wtSplitKey(k)); }); }
      return out;
    });
    /* Writes accumulate: step 5 shows what steps 1 through 5 put there, so scrubbing backwards
       rewinds the data instead of leaving the last value behind. */
    var valuesBy = steps.map(function (_, i) {
      var out = [];
      for (var j = 0; j <= i; j++) {
        Object.keys(steps[j].set || {}).forEach(function (raw) {
          out.push({ k: wtSplitKey(raw), v: String(steps[j].set[raw]) });
        });
      }
      return out;
    });

    function paint(i) {
      var nowKeys = (steps[i].focus || []).map(wtSplitKey), seenKeys = seenBy[i];
      groups.forEach(function (g) {
        var isNow = nowKeys.some(function (k) { return wtHits(g, k); });
        var isSeen = isNow || seenKeys.some(function (k) { return wtHits(g, k); });
        g.el.classList.remove("wt-now", "wt-past", "wt-future");
        g.el.classList.add(isNow ? "wt-now" : isSeen ? "wt-past" : "wt-future");
      });
      frames.forEach(function (f) {
        var svg = f.kind === "cg" ? f.box.querySelector("svg.cg") : null;
        if (svg) { cgAnnotate(svg, steps[i]); }
      });
      valueEls.forEach(function (v) {
        var write = null;
        valuesBy[i].forEach(function (w) {
          if (w.k.panel && w.k.panel !== v.panel) { return; }
          if (w.k.key === v.key) { write = w.v; }
        });
        v.el.textContent = write === null ? v.original : write;
      });
      var raw = steps[i].note || "";
      var cut = raw.match(/^(.+?[.?!])\s+(.+)$/);
      note.textContent = "";
      if (raw) {
        var ideaEl = document.createElement("span");
        ideaEl.className = "idea";
        ideaEl.textContent = cut ? cut[1] : raw;
        note.appendChild(ideaEl);
        if (cut) {
          var supEl = document.createElement("span");
          supEl.className = "support";
          supEl.textContent = " " + cut[2];
          note.appendChild(supEl);
        }
      }
      count.textContent = (i + 1) + " / " + (last + 1);
      range.value = String(i);
    }

    range.addEventListener("input", function () { paint(Number(range.value)); });
    stage.addEventListener("cv:moved", function () { paint(Number(range.value)); });
    root.querySelector(".wt-prev").addEventListener("click", function () { paint(Math.max(0, Number(range.value) - 1)); });
    root.querySelector(".wt-next").addEventListener("click", function () { paint(Math.min(last, Number(range.value) + 1)); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); paint(Math.min(last, Number(range.value) + 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); paint(Math.max(0, Number(range.value) - 1)); }
    });
    paint(0);
  }

  /* Mounting is scoped to a root so a page can be rendered again in place, and every registry is
     empty here: the document that is being rendered fills them from its own fenced specs. */
  function safeId(key) { return String(key).replace(/[^A-Za-z0-9_-]/g, "_"); }
  function specText(o) {
    return window.jsyaml ? window.jsyaml.dump(o, { lineWidth: 110, noRefs: true }) : specText(o);
  }
  /* One figure that throws must not take the rest of the page with it, so every mount runs on its
     own and reports the element it failed on. */
  function mountAll(root) {
    root = root || document;
    var q = function (sel) {
      var list = [].slice.call(root.querySelectorAll(sel));
      return { forEach: function (fn) { list.forEach(function (el) {
        try { fn(el); } catch (e) { console.error("engdoc: mount failed for", sel, el.getAttribute && (el.getAttribute("data-ex") || el.getAttribute("data-wt")), e); }
      }); } };
    };
    q("#legend-mount").forEach(function (el) { el.innerHTML = renderLegend(); });
    q(".seq-mount").forEach(function (el) { var key = el.getAttribute("data-ex"); if (SPECS[key]) { el.innerHTML = renderSequence(SPECS[key], "sq-" + safeId(key)); } });
    q(".flow-mount").forEach(function (el) { var key = el.getAttribute("data-ex"); if (FLOWS[key]) { el.innerHTML = renderFlow(FLOWS[key], "fl-" + safeId(key)); } });
    q("pre[data-flowspec]").forEach(function (el) { el.textContent = specText(FLOWS[el.getAttribute("data-flowspec")]); });
    q("#erd-key-mount, .erd-key-mount").forEach(function (el) { el.innerHTML = renderErdKey(); });
    q(".erd-mount").forEach(function (el) { var key = el.getAttribute("data-ex"); if (ERDS[key]) { el.innerHTML = renderErd(ERDS[key], "er-" + safeId(key), key); } });
    q("pre[data-erdspec]").forEach(function (el) { el.textContent = specText(ERDS[el.getAttribute("data-erdspec")]); });
    q(".table-mount").forEach(function (el) { var key = el.getAttribute("data-ex"); if (TABLES[key]) { el.innerHTML = renderTableFrozen(TABLES[key], "tb-" + safeId(key)); } });
    q("pre[data-tblspec]").forEach(function (el) { el.textContent = specText(TABLES[el.getAttribute("data-tblspec")]); });
    q(".cg-mount").forEach(function (el) { var key = el.getAttribute("data-ex"); if (CALLGRAPHS[key]) { el.innerHTML = renderCallGraph(CALLGRAPHS[key], "cg-" + safeId(key)); } });
    q("pre[data-cgspec]").forEach(function (el) { el.textContent = specText(CALLGRAPHS[el.getAttribute("data-cgspec")]); });
    q(".tour-mount").forEach(function (el) { el.innerHTML = renderTour(TOURS[el.getAttribute("data-ex")] || {}); });
    q(".screen-mount").forEach(function (el) { var key = el.getAttribute("data-ex"); if (SCREENS[key]) { el.innerHTML = renderScreens(SCREENS[key], "sc-" + safeId(key), key); } });
    q("pre[data-screenspec]").forEach(function (el) { el.textContent = specText(SCREENS[el.getAttribute("data-screenspec")]); });
    q(".wt").forEach(mountWalkthrough);
    /* Every canvas inside a figure card gets the expand control, so any figure that meets the canvas
       contract gets one for free, and a canvas inside a walkthrough panel simply does not. */
    q("svg[data-canvas]").forEach(function (svg) {
      var card = svg.closest(".figcard");
      if (!card || card.querySelector(".cv-full")) { return; }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cv-full";
      b.textContent = "expand";
      b.setAttribute("aria-label", "Expand this figure");
      card.appendChild(b);
    });
    q("pre[data-spec]").forEach(function (el) { el.textContent = specText(SPECS[el.getAttribute("data-spec")]); });
  }


  /* One tooltip for every json cell on the page, positioned in viewport space so it is never clipped
     by the figure's own horizontal scroll. Keyboard reaches it through the cell's tabindex. */
  var jsonTip = null;
  function jsonTipEl() {
    if (!jsonTip) {
      jsonTip = document.createElement("pre");
      jsonTip.className = "tbl-tip";
      jsonTip.setAttribute("aria-hidden", "true");
      document.body.appendChild(jsonTip);
    }
    return jsonTip;
  }
  function showJsonTip(el) {
    var t = jsonTipEl();
    var doc = el.getAttribute("data-doc");
    /* A docstring or a clipped text cell is a sentence and wraps in the body face. json keeps its
       monospace column shape. */
    t.className = doc || el.hasAttribute("data-wrap") ? "tbl-tip doc" : "tbl-tip";
    t.textContent = doc || el.getAttribute("data-json");
    t.style.display = "block";
    t.style.left = "0px";
    t.style.top = "0px";
    /* Anchored to the whole box, a file or a table, not the row: bottom left of the panel meets top
       left of the box, so it clears every row and holds one position while the reader moves down the
       list instead of following the pointer. A table cell has no box to belong to and anchors to itself.

       Only the viewport clamps it, and only downward. Sliding a panel back into view is easier to
       follow than flipping it to the other side of what the reader is pointing at. Opaque, so the value
       reads over whatever it covers, and it never takes pointer events. */
    var host = el.closest ? el.closest(".cv-box") || el : el;
    var anchor = host.getBoundingClientRect(), r = t.getBoundingClientRect();
    t.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 10)) + "px";
    t.style.top = Math.max(8, anchor.top - r.height) + "px";
  }
  function hideJsonTip() { jsonTipFor = null; if (jsonTip) { jsonTip.style.display = "none"; } }

  var jsonTipFor = null;
  function jsonTipTarget(e) {
    return e.target && e.target.closest ? e.target.closest("[data-json],[data-doc]") : null;
  }
  document.addEventListener("mouseover", function (e) {
    var el = jsonTipTarget(e);
    if (el === jsonTipFor) { return; }
    jsonTipFor = el;
    if (el) { showJsonTip(el); } else { hideJsonTip(); }
  });
  document.addEventListener("focusin", function (e) {
    var el = jsonTipTarget(e);
    jsonTipFor = el;
    if (el) { showJsonTip(el); } else { hideJsonTip(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { hideJsonTip(); } });
  window.addEventListener("scroll", hideJsonTip, { passive: true });

  /* Dragging and highlighting are delegated from the document, so a call graph mounted anywhere,
     including inside a walkthrough panel, works with no wiring of its own. Box positions live in the
     DOM as transforms rather than in a JS map, so a redraw only has to read what is on screen. */
  /* The canvas layer. Anything drawn as a set of boxes joined by edges can ride on it by meeting a
     small contract: the svg carries data-canvas naming its renderer, each movable box is a
     .cv-box[data-node][data-w][data-h] positioned by translate, and each edge is a .cv-edge with
     data-from and data-to naming the boxes it joins. The layer then gives it dragging, folding, the
     expanded stage with zoom and pan, and arrow fading, without knowing what the boxes mean. On a
     move or a drop it asks the renderer named on the svg to redraw, since only the renderer knows how
     its own edges should follow. */
  var CANVAS = {};

  /* Veil first, then the eye on top of it. A veil that covered its own control would be a box nobody
     could reopen. The same chrome on every canvas, so folding reads the same way everywhere. */
  /* eye, when given, moves the control off its default spot in the box's top right corner. A box whose
     top edge is a real UI element, like a screen's topbar, puts the eye above the frame instead so it
     cannot be read as a button in the mockup. */
  function cvChrome(name, w, h, rx, eye) {
    var veilSize = Math.max(10, Math.min(17, Math.floor((w - 26) / (String(name).length * 0.605))));
    var ex = eye ? eye.x : w - 18, ey = eye ? eye.y : 13;
    return '<g class="cv-veil">' +
           '<rect class="cv-veilplate" x="1" y="1" width="' + (w - 2) + '" height="' + (h - 2) + '" rx="' + (rx || 7) + '"/>' +
           '<text class="cv-veiltext" x="' + (w / 2) + '" y="' + (h / 2 + veilSize / 3) +
           '" text-anchor="middle" style="font-size:' + veilSize + 'px">' + esc(name) + "</text></g>" +
           '<g class="cv-eye" role="button" tabindex="0" aria-pressed="false" aria-label="' +
           esc("Show or hide " + name) + '" transform="translate(' + ex + "," + ey + ')">' +
           '<rect class="cv-eyehit" x="-11" y="-9" width="22" height="18" rx="4"/>' +
           '<path class="cv-eyeball" d="M-7,0 C-4,-4.6 4,-4.6 7,0 C4,4.6 -4,4.6 -7,0 Z"/>' +
           '<circle class="cv-pupil" cx="0" cy="0" r="1.9"/>' +
           '<path class="cv-eyeslash" d="M-8,-6 L8,6"/></g>';
  }

  function cvPos(g) {
    var m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(g.getAttribute("transform") || "");
    return { x: m ? +m[1] : 0, y: m ? +m[2] : 0 };
  }

  function cgRedraw(svg) {
    var boxes = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) {
      var p = cvPos(g);
      p.w = +g.getAttribute("data-w") || 0;
      boxes[g.getAttribute("data-node")] = p;
    });
    svg.querySelectorAll(".cg-edge").forEach(function (e) {
      var a = boxes[e.getAttribute("data-from")], b = boxes[e.getAttribute("data-to")];
      if (!a || !b) { return; }
      var x0, y0, x1, y1;
      if (e.getAttribute("data-self")) {
        var sx = +e.getAttribute("data-sx"), hx = +e.getAttribute("data-hx");
        var ends = cgSelfEnds(+e.getAttribute("data-fy"), +e.getAttribute("data-ty"));
        e.querySelector(".cg-line").setAttribute("d", cgSelfPath(a.x, a.y, sx, hx, ends[0], ends[1]));
        x0 = a.x + hx; y0 = a.y + ends[0];
        x1 = x0; y1 = a.y + ends[1];
      } else {
        x0 = a.x + a.w; y0 = a.y + (+e.getAttribute("data-fy"));
        x1 = b.x; y1 = b.y + (+e.getAttribute("data-ty"));
        e.querySelector(".cg-line").setAttribute("d", cgEdgePath(x0, y0, x1, y1));
      }
      var tail = e.querySelector(".cg-tail");
      tail.setAttribute("cx", x0);
      tail.setAttribute("cy", y0);
      e.querySelector(".cg-head").setAttribute("transform", "translate(" + x1 + "," + y1 + ")");
    });
  }

  /* Walks callers, not callees. Hovering a function answers "what reaches this", which is the
     question a call graph gets asked before a change, and it walks the whole chain rather than one
     edge so a caller two hops away still lights. */
  function cgLight(svg, seed) {
    var edges = [].slice.call(svg.querySelectorAll(".cg-edge"));
    var live = {}, queue = [seed];
    live[seed] = 1;
    while (queue.length) {
      var k = queue.shift();
      edges.forEach(function (e) {
        if (e.getAttribute("data-tk") !== k) { return; }
        e.classList.add("on");
        var up = e.getAttribute("data-fk");
        if (!live[up]) { live[up] = 1; queue.push(up); }
      });
    }
    svg.querySelectorAll(".cg-fn").forEach(function (g) {
      var k = g.getAttribute("data-fn");
      g.classList.toggle("on", !!live[k]);
      g.classList.toggle("seed", k === seed);
    });
    /* A fog node is reached by its bare id, so it lights when the chain runs out through it. */
    svg.querySelectorAll(".cg-fog").forEach(function (g) {
      g.classList.toggle("on", !!live[g.getAttribute("data-node")]);
    });
    svg.classList.add("lit");
  }

  function cgClear(svg) {
    if (!svg) { return; }
    svg.classList.remove("lit");
    svg.querySelectorAll(".on, .seed").forEach(function (el) { el.classList.remove("on"); el.classList.remove("seed"); });
  }

  /* Collapse state lives in a class on the box, exactly like drag position lives in its transform:
     nothing is persisted, so a reload is a clean graph. Which arrows to quiet cannot be expressed as
     a selector, since it depends on the other end of each edge, so it is recomputed on every toggle. */
  function cvApplyHidden(svg) {
    var hidden = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) {
      if (g.classList.contains("hidden")) { hidden[g.getAttribute("data-node")] = 1; }
    });
    svg.querySelectorAll(".cv-edge").forEach(function (e) {
      e.classList.toggle("faded", !!(hidden[e.getAttribute("data-from")] || hidden[e.getAttribute("data-to")]));
    });
  }

  function cvToggleBox(eye) {
    var box = eye.closest(".cv-box");
    if (!box) { return; }
    var now = !box.classList.contains("hidden");
    box.classList.toggle("hidden", now);
    eye.setAttribute("aria-pressed", now ? "true" : "false");
    cvApplyHidden(box.ownerSVGElement);
  }

  document.addEventListener("click", function (e) {
    var eye = e.target && e.target.closest ? e.target.closest(".cv-eye") : null;
    if (eye) { cvToggleBox(eye); }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") { return; }
    var eye = e.target && e.target.closest ? e.target.closest(".cv-eye") : null;
    if (!eye) { return; }
    e.preventDefault();
    cvToggleBox(eye);
  });

  /* Expanded view is a fixed overlay, not the Fullscreen API: an artifact runs in a sandboxed iframe
     where requestFullscreen is not reliably granted, and the overlay covers the whole artifact
     viewport regardless. The svg node is moved rather than cloned, so drag positions and folded boxes
     survive the trip out and back.

     Zoom sets the svg's css width instead of a transform. The viewBox then does the scaling, which
     keeps the vectors crisp and, more usefully, keeps getScreenCTM honest so dragging stays accurate
     at any zoom without the drag code knowing zoom exists. */
  var cvStageBox = null, cvFull = null;

  function cvStage() {
    if (cvStageBox) { return cvStageBox; }
    cvStageBox = document.createElement("div");
    cvStageBox.className = "cv-stage";
    cvStageBox.setAttribute("role", "dialog");
    cvStageBox.setAttribute("aria-modal", "true");
    cvStageBox.setAttribute("aria-label", "Figure, expanded");
    cvStageBox.innerHTML =
      '<div class="cv-stage-bar">' +
        '<span class="cv-stage-name"></span>' +
        '<span class="cv-stage-hint">scroll to zoom &middot; drag to pan</span>' +
        '<span class="cv-stage-sp"></span>' +
        '<span class="cv-zlevel">100%</span>' +
        '<button type="button" class="cv-zf">fit</button>' +
        '<button type="button" class="cv-close">close</button>' +
      '</div><div class="cv-stage-pane"><div class="cv-stage-canvas"></div></div>';
    document.body.appendChild(cvStageBox);
    cvStageBox.querySelector(".cv-zf").addEventListener("click", cvFit);
    cvStageBox.querySelector(".cv-close").addEventListener("click", cvCloseFull);
    /* Not passive: a wheel over the stage zooms instead of scrolling the document behind it, and
       that needs preventDefault. */
    cvStageBox.querySelector(".cv-stage-pane").addEventListener("wheel", function (e) {
      if (!cvFull) { return; }
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      var factor = Math.max(0.8, Math.min(1.25, Math.exp(-dy * 0.0018)));
      cvZoomAt(cvFull.zoom * factor, e.clientX, e.clientY);
    }, { passive: false });
    return cvStageBox;
  }

  function cvZoom(z) {
    if (!cvFull || !z) { return; }
    cvFull.zoom = Math.max(0.1, Math.min(4, z));
    cvFull.svg.style.width = Math.round(cvFull.w * cvFull.zoom) + "px";
    cvStageBox.querySelector(".cv-zlevel").textContent = Math.round(cvFull.zoom * 100) + "%";
  }

  /* Keeps whatever is under the pointer under the pointer. The content point is measured as a
     fraction of the drawing, then the pane is scrolled by exactly how much drawing grew ahead of it,
     which needs no knowledge of the pane's padding or the svg's offset inside it. */
  /* The drawing sits on a canvas with half a viewport of slack on every side. Without it the pane
     has no scroll range whenever the drawing fits, so setting scrollLeft was a no-op and panning did
     nothing at all at fit. The slack also means a zoomed out graph can still be dragged around
     rather than being pinned in the middle of the window. */
  function cvSlack() {
    var pane = cvStageBox.querySelector(".cv-stage-pane");
    var canvas = cvStageBox.querySelector(".cv-stage-canvas");
    canvas.style.padding = Math.round(pane.clientHeight / 2) + "px " + Math.round(pane.clientWidth / 2) + "px";
  }

  function cvCenter() {
    var pane = cvStageBox.querySelector(".cv-stage-pane");
    pane.scrollLeft = (pane.scrollWidth - pane.clientWidth) / 2;
    pane.scrollTop = (pane.scrollHeight - pane.clientHeight) / 2;
  }

  function cvZoomAt(z, cx, cy) {
    if (!cvFull) { return; }
    var pane = cvStageBox.querySelector(".cv-stage-pane");
    var r = cvFull.svg.getBoundingClientRect();
    var fx = r.width ? Math.max(0, Math.min(1, (cx - r.left) / r.width)) : 0.5;
    var fy = r.height ? Math.max(0, Math.min(1, (cy - r.top) / r.height)) : 0.5;
    var wasW = r.width, wasH = r.height;
    cvZoom(z);
    var now = cvFull.svg.getBoundingClientRect();
    pane.scrollLeft += fx * (now.width - wasW);
    pane.scrollTop += fy * (now.height - wasH);
  }

  function cvFit() {
    if (!cvFull) { return; }
    var pane = cvStageBox.querySelector(".cv-stage-pane");
    cvSlack();
    cvZoom(Math.min(1, (pane.clientWidth - 32) / cvFull.w, (pane.clientHeight - 32) / cvFull.h));
    cvCenter();
  }

  function cvOpenFull(btn) {
    var card = btn.closest(".figcard"), svg = card && card.querySelector("svg[data-canvas]");
    if (!svg || cvFull) { return; }
    var stage = cvStage(), canvas = stage.querySelector(".cv-stage-canvas"), vb = svg.viewBox.baseVal;
    var slug = card.querySelector(".tblock .nm");
    cvFull = { svg: svg, parent: svg.parentNode, next: svg.nextSibling, w: vb.width, h: vb.height, zoom: 1, width: svg.style.width };
    stage.querySelector(".cv-stage-name").textContent = slug ? slug.textContent : "";
    canvas.appendChild(svg);
    stage.classList.add("on");
    document.body.style.overflow = "hidden";
    cvFit();
    stage.querySelector(".cv-close").focus();
  }

  function cvCloseFull() {
    if (!cvFull) { return; }
    if (cvPan) { cvPan.pane.classList.remove("panning"); cvPan = null; }
    hideJsonTip();
    cvFull.svg.style.width = cvFull.width;
    cvFull.parent.insertBefore(cvFull.svg, cvFull.next);
    cvStageBox.classList.remove("on");
    document.body.style.overflow = "";
    cvFull = null;
  }

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".cv-full") : null;
    if (btn) { cvOpenFull(btn); }
  });

  document.addEventListener("keydown", function (e) {
    if (!cvFull) { return; }
    if (e.key === "Escape") { cvCloseFull(); return; }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); cvZoom(cvFull.zoom * 1.25); }
    else if (e.key === "-") { e.preventDefault(); cvZoom(cvFull.zoom / 1.25); }
    else if (e.key === "0") { e.preventDefault(); cvFit(); }
  });

  window.addEventListener("resize", function () { if (cvFull) { cvFit(); } });

  var cvDrag = null, cgHover = null, cvPan = null;

  document.addEventListener("mouseover", function (e) {
    if (cvDrag || cvPan) { return; }
    var row = e.target && e.target.closest ? e.target.closest(".cg-fn") : null;
    /* Inside a walkthrough the scrubber owns what is lit. Two focus systems writing opacity on the
       same rows read as a bug, so hover stands down and only dragging stays live. */
    if (row && row.closest(".wt-stage")) { row = null; }
    if (row === cgHover) { return; }
    if (cgHover) { cgClear(cgHover.ownerSVGElement); }
    cgHover = row;
    if (row) { cgLight(row.ownerSVGElement, row.getAttribute("data-fn")); }
  });

  /* Hover on an ERD row lights the edges anchored at that column, and the rows at their other ends,
     and mutes every other edge. A header does the same for every edge of its table. Inside a
     walkthrough the scrubber owns what is lit, so hover stands down there as it does on a call graph. */
  function erdLight(svg, table, col) {
    var lit = {}, key = col ? table + "." + col : null;
    if (key) { lit[key] = 1; }
    svg.querySelectorAll(".cv-edge").forEach(function (e) {
      var fa = e.getAttribute("data-fa") || "", ta = e.getAttribute("data-ta") || "";
      var hit = key ? (fa === key || ta === key) : (fa.split(".")[0] === table || ta.split(".")[0] === table);
      e.classList.toggle("on", hit);
      if (hit) { lit[fa] = 1; lit[ta] = 1; }
    });
    svg.querySelectorAll(".erd-col").forEach(function (g) { g.classList.toggle("on", !!lit[g.getAttribute("data-key")]); });
    svg.classList.add("erd-lit");
  }

  function erdClear(svg) {
    if (!svg) { return; }
    svg.classList.remove("erd-lit");
    svg.querySelectorAll(".cv-edge.on, .erd-col.on").forEach(function (el) { el.classList.remove("on"); });
  }

  var erdHover = null;

  document.addEventListener("mouseover", function (e) {
    if (cvDrag || cvPan) { return; }
    var t = e.target && e.target.closest ? e.target.closest(".erd-col, .erd-head") : null;
    if (t && t.closest(".wt-stage")) { t = null; }
    if (t === erdHover) { return; }
    if (erdHover) { erdClear(erdHover.ownerSVGElement); }
    erdHover = t;
    if (t) {
      var box = t.closest(".cv-box");
      if (box) { erdLight(t.ownerSVGElement, box.getAttribute("data-node"), t.getAttribute("data-col")); }
    }
  });

  function cvPoint(svg, e) {
    var m = svg.getScreenCTM();
    if (!m) { return null; }
    var p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(m.inverse());
  }

  document.addEventListener("pointerdown", function (e) {
    if (e.target && e.target.closest && e.target.closest(".cv-eye")) { return; }
    var box = e.target && e.target.closest ? e.target.closest(".cv-box") : null;
    if (!box) {
      /* Empty canvas on the stage pans. The listener is on the pane rather than the svg because an
         svg only receives pointer events where it has painted something, and the space between
         boxes is exactly where there is nothing. */
      var pane = cvFull && e.target && e.target.closest ? e.target.closest(".cv-stage-pane") : null;
      if (pane) {
        cvPan = { x: e.clientX, y: e.clientY, left: pane.scrollLeft, top: pane.scrollTop, pane: pane };
        pane.classList.add("panning");
        if (cgHover) { cgClear(cgHover.ownerSVGElement); cgHover = null; }
    if (erdHover) { erdClear(erdHover.ownerSVGElement); erdHover = null; }
        e.preventDefault();
      }
      return;
    }
    var svg = box.ownerSVGElement, pt = cvPoint(svg, e);
    if (!pt) { return; }
    var at = cvPos(box);
    cvDrag = { box: box, svg: svg, dx: pt.x - at.x, dy: pt.y - at.y };
    hideJsonTip();
    if (cgHover) { cgClear(cgHover.ownerSVGElement); cgHover = null; }
    if (erdHover) { erdClear(erdHover.ownerSVGElement); erdHover = null; }
    box.classList.add("dragging");
    e.preventDefault();
  });

  document.addEventListener("pointermove", function (e) {
    if (cvPan) {
      cvPan.pane.scrollLeft = cvPan.left - (e.clientX - cvPan.x);
      cvPan.pane.scrollTop = cvPan.top - (e.clientY - cvPan.y);
      return;
    }
    if (!cvDrag) { return; }
    var pt = cvPoint(cvDrag.svg, e);
    if (!pt) { return; }
    /* Clamped to the canvas: an SVG clips to its viewport, so a box dragged past the edge would be
       cut in half rather than scrolled to. */
    var vb = cvDrag.svg.viewBox.baseVal;
    var w = +cvDrag.box.getAttribute("data-w") || 0, h = +cvDrag.box.getAttribute("data-h") || 0;
    var x = Math.max(vb.x, Math.min(pt.x - cvDrag.dx, vb.x + vb.width - w));
    var y = Math.max(vb.y, Math.min(pt.y - cvDrag.dy, vb.y + vb.height - h));
    cvDrag.box.setAttribute("transform", "translate(" + Math.round(x) + "," + Math.round(y) + ")");
    var mover = CANVAS[cvDrag.svg.getAttribute("data-canvas")];
    if (mover && mover.move) { mover.move(cvDrag.svg, cvDrag.box); }
  });

  /* Dragging authors a layout rather than just looking at one. On drop, the spec under the figure is
     rewritten with the positions on screen, so the way to keep an arrangement is the way the page
     already tells a reader to reuse any figure: copy the JSON. A spec is the only thing that travels. */
  function cgSpecWithLayout(svg, key) {
    var base = CALLGRAPHS[key];
    if (!base) { return null; }
    var at = {};
    svg.querySelectorAll(".cv-box").forEach(function (g) { at[g.getAttribute("data-node")] = cvPos(g); });
    var vb = svg.viewBox.baseVal;
    var out = { alt: base.alt, canvas: [Math.round(vb.width), Math.round(vb.height)] };
    if (base.diff) { out.diff = base.diff; }
    out.files = [];
    out.calls = base.calls;
    (base.files || []).forEach(function (f) {
      var p = at[f.id], copy = f.fog ? { id: f.id, fog: f.fog } : { id: f.id, name: f.name, fns: f.fns };
      if (p) { copy.x = p.x; copy.y = p.y; }
      out.files.push(copy);
    });
    return out;
  }

  CANVAS.cg = { move: function (svg) { cgRedraw(svg); }, drop: function (svg) { cgSyncSpec(svg); } };
  CANVAS.erd = { move: function (svg) { erdRedraw(svg); }, drop: function (svg) { erdSyncSpec(svg); } };
  CANVAS.screen = { move: function (svg) { scRedraw(svg); }, drop: function (svg) { scSyncSpec(svg); } };

  function cgSyncSpec(svg) {
    var card = svg.closest ? svg.closest(".figcard") : null;
    if (!card) { return; }
    var mount = card.querySelector(".cg-mount"), pre = card.querySelector("pre[data-cgspec]");
    if (!mount || !pre) { return; }
    var spec = cgSpecWithLayout(svg, mount.getAttribute("data-ex"));
    if (spec) { pre.textContent = specText(spec); }
  }

  function cvEndDrag() {
    if (cvPan) { cvPan.pane.classList.remove("panning"); cvPan = null; }
    if (!cvDrag) { return; }
    cvDrag.box.classList.remove("dragging");
    var dropper = CANVAS[cvDrag.svg.getAttribute("data-canvas")];
    if (dropper && dropper.drop) { dropper.drop(cvDrag.svg, cvDrag.box); }
    var stage = cvDrag.svg.closest ? cvDrag.svg.closest(".wt-stage") : null;
    if (stage) { stage.dispatchEvent(new CustomEvent("cv:moved", { bubbles: true })); }
    cvDrag = null;
  }
  document.addEventListener("pointerup", cvEndDrag);
  document.addEventListener("pointercancel", cvEndDrag);

  /* Every spec viewer gets a copy button, because "copy the JSON and paste it into the renderer" is
     the instruction the page opens with. Clipboard access can be refused inside the frame, so the
     fallback selects the text and the reader finishes with their own keystroke. */
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".speccopy") : null;
    if (!btn) { return; }
    var pre = btn.parentNode.querySelector("pre");
    if (!pre) { return; }
    var done = function (word) {
      btn.textContent = word;
      setTimeout(function () { btn.textContent = "copy json"; }, 1400);
    };
    var fallback = function () {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(pre);
      sel.removeAllRanges();
      sel.addRange(range);
      done("press \u2318C");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pre.textContent).then(function () { done("copied"); }, fallback);
    } else {
      fallback();
    }
  });

  var toc = document.querySelector(".toc");
  var tocDashes = toc && toc.querySelector(".toc-dashes");
  var tocPanel = toc && toc.querySelector(".toc-panel");
  var tocEntries = [];

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function markCurrentSection() {
    var current = 0;
    for (var i = 0; i < tocEntries.length; i++) {
      if (tocEntries[i].heading.getBoundingClientRect().top > 140) { break; }
      current = i;
    }
    tocEntries.forEach(function (entry, i) {
      entry.dash.classList.toggle("on", i === current);
      entry.button.classList.toggle("on", i === current);
    });
  }

  function buildToc() {
    if (!toc) { return; }
    var pane = document.querySelector(".pane:not([hidden])") || document.querySelector("main");
    tocDashes.innerHTML = "";
    tocPanel.innerHTML = "";
    tocEntries = [];
    if (!pane) { return; }
    [].slice.call(pane.querySelectorAll("h2, h3")).forEach(function (heading, i) {
      if (!heading.id) { heading.id = (pane.id || "doc") + "-h" + i; }
      var level = heading.tagName === "H2" ? "2" : "3";
      var text = (heading.textContent || "").replace(/\s+/g, " ").trim();

      var dash = document.createElement("i");
      dash.setAttribute("data-lv", level);
      tocDashes.appendChild(dash);

      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-lv", level);
      button.textContent = text;
      button.title = text;
      button.addEventListener("click", function () {
        heading.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      });
      tocPanel.appendChild(button);

      tocEntries.push({ heading: heading, dash: dash, button: button });
    });
    markCurrentSection();
  }

  var tocQueued = false;
  window.addEventListener("scroll", function () {
    if (tocQueued) { return; }
    tocQueued = true;
    requestAnimationFrame(function () { tocQueued = false; markCurrentSection(); });
  }, { passive: true });

  document.addEventListener("toc:rebuild", buildToc);
  buildToc();

  window.EngDoc = {
    registries: { seq: SPECS, flow: FLOWS, erd: ERDS, tbl: TABLES, walk: WALKS, screen: SCREENS, cg: CALLGRAPHS, tour: TOURS },
    mount: mountAll,
    specText: specText,
    rebuildToc: buildToc
  };
})();
