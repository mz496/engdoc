---
create-date: 2026-09-12, 23:40:00
type: plan
tags: [doodle, phase-1, spike-1, retrieval, chamfer, procrustes, react]
status: draft
order: 2
parent: doodle-phase1
---

# Spike 1 — The magic loop

- **One weekend, two builds on the same page.** Build A is a collect mode that records templates. Build B is a matching pipeline that runs on the live trail and commits a completion when a template prefix is close enough.
- **The page becomes a small React app over an imperative canvas engine.** React owns the chrome: a toolbar that switches modes, a collect panel, a debug panel. The engine owns the ring buffer, the frame loop, the matcher, and the commit state machine, and React never touches any of them per frame. Modes are buttons, not URL flags.
- **The geometry is a pure module the engine calls.** Normalize, resample, Chamfer, Procrustes, the index builder, and the segmenter have no DOM and no timers, so [[doodle-spike2-routing|Spike 2]] can import the identical code into a Node harness.
- **The test is the grin test, on yourself.** Draw a lazy heart with the bare cursor and see if the completion lands and feels good. Kill is that no threshold separates a sincere heart from a random loop.

## Architecture

### Vite, React, and TypeScript, with the Spike 0 script ported in as the engine.

- **Spike 1 opens by scaffolding the app and moving the Spike 0 code into `src/engine/`.** The ring buffer, trail renderer, and particle system move file for file with their logic unchanged. Spike 0 stays a single HTML file for its own test; this is where the project grows a toolchain.
- **Vite rather than a no-build setup.** The alternatives were React from a CDN with `createElement` calls, or Preact with `htm`. Both avoid `npm install` but make the code worse to read, and Phase 2 needs a bundler anyway for browser inference. A dev server is a cost worth paying once.
- **ES modules everywhere, which also fixes the harness.** With a bundler the matcher is a normal `.ts` module that the page imports and that Node runs through `tsx`. The Spike 2 harness imports the same files; nothing is copied.
- **Templates are a JSON file the bundler imports.** The collect panel exports the current set, and the export is saved over `src/data/templates.json`. No global, no paste into a script.

```cg cg/spike1-structure wide
alt: >-
  Four boxes. The React components on the left: App, TrailCanvas, Toolbar, CollectPanel, DebugPanel. They
  call into the engine in the middle, which owns the ring, the trail renderer, particles, the store, and the
  commit state machine. The engine calls the matcher on the right, a pure module with buildIndex, segment,
  normalize, resample, chamfer, scoreAll, gate, procrustes and snapRemainder. templates.json is data the
  engine indexes and the collect panel writes.
docs:
  ui: >-
    React. Owns the chrome and nothing that runs per frame. Talks to the engine through its small API and
    reads its snapshot through a subscribable store.
  engine: >-
    Imperative. One instance, mounted on the canvas. Owns the ring, the frame loop, the match tick, and the
    commit state machine. Publishes a snapshot at tick rate for the debug panel.
  matcher: >-
    Pure geometry over point arrays. No DOM, no timers. The Spike 2 harness imports these exact files.
  data: Exported template drawings as JSON. Regenerated from the collect panel.
files:
  - id: ui
    name: src/components/
    fns:
      - App
      - TrailCanvas
      - Toolbar
      - CollectPanel
      - DebugPanel
      - StrokeThumb
  - id: engine
    name: src/engine/
    fns:
      - Engine.mount
      - Engine.setMode
      - Engine.tick
      - Engine.frame
      - commit.step
      - ring
      - trail
      - particles
      - store
  - id: matcher
    name: src/engine/matcher/
    fns:
      - buildIndex
      - segment
      - normalize
      - resample
      - chamfer
      - scoreAll
      - gate
      - procrustes
      - snapRemainder
  - id: data
    name: src/data/templates.json
    fns:
      - templates
calls:
  - from: ui.App
    to: ui.TrailCanvas
  - from: ui.App
    to: ui.Toolbar
  - from: ui.App
    to: ui.CollectPanel
  - from: ui.App
    to: ui.DebugPanel
  - from: ui.TrailCanvas
    to: engine.Engine.mount
  - from: ui.Toolbar
    to: engine.Engine.setMode
  - from: ui.CollectPanel
    to: ui.StrokeThumb
  - from: ui.CollectPanel
    to: data.templates
  - from: ui.DebugPanel
    to: engine.store
  - from: engine.Engine.frame
    to: engine.ring
  - from: engine.Engine.frame
    to: engine.trail
  - from: engine.Engine.frame
    to: engine.particles
  - from: engine.Engine.frame
    to: engine.Engine.tick
  - from: engine.Engine.frame
    to: engine.commit.step
  - from: engine.Engine.tick
    to: matcher.segment
  - from: engine.Engine.tick
    to: matcher.scoreAll
  - from: engine.Engine.tick
    to: matcher.gate
  - from: engine.Engine.tick
    to: engine.store
  - from: engine.commit.step
    to: matcher.procrustes
  - from: engine.commit.step
    to: matcher.snapRemainder
  - from: engine.Engine.mount
    to: matcher.buildIndex
  - from: matcher.buildIndex
    to: data.templates
  - from: matcher.scoreAll
    to: matcher.normalize
  - from: matcher.scoreAll
    to: matcher.resample
  - from: matcher.scoreAll
    to: matcher.chamfer
```

### The boundary between React and the engine is a small API and a snapshot.

- **The engine is one class with a handful of methods.** `mount(canvas)` and `unmount()`, `setMode(mode)`, `subscribe(fn)` and `getSnapshot()`, and a collect API: `beginDrawing()`, `undoStroke()`, `endDrawing(): Drawing`. React calls these from event handlers and effects. Nothing else crosses the line.
- **The snapshot is published at tick rate, never at frame rate.** The engine writes a new immutable snapshot at the end of each 10 Hz match tick and on every state machine transition. The debug panel reads it with `useSyncExternalStore`. A React re-render per frame was the failure mode to design out; at 10 Hz it is invisible.
- **The canvas is mounted once and never re-rendered.** `TrailCanvas` renders a bare `<canvas>` with a ref, constructs the engine in an effect, and tears it down on unmount. A `ResizeObserver` inside the engine handles size and device pixel ratio.
- **Pointer listeners stay on the document, in the engine.** The canvas keeps `pointer-events: none`, so toolbar and panels are clickable. The engine ignores any `pointerdown` whose target is inside an element marked `data-chrome`, so clicking a button in collect mode does not start a stroke.

### Three modes and one toggle, all in the toolbar.

- **Ambient is the default and the real product.** The trail draws, the matcher runs, commits animate. The toolbar collapses to a small dot in this mode so it does not steal attention from the thing being tested; hovering or a keyboard shortcut expands it.
- **Collect turns mouse-down into pen-down and shows the collect panel.** Matching is off. The trail renderer is reused so a recorded stroke looks like the live one.
- **Debug is a toggle, not a mode.** It overlays the debug panel on whichever mode is active. In Spike 2 the toolbar gains a fan-only toggle in the same way, and the collect panel gains a set selector for the battery.

| component | owns | engine contact |
| --- | --- | --- |
| App | mode state, debug toggle, layout | holds the engine ref, passes it down |
| TrailCanvas | the one canvas element | mount and unmount in an effect |
| Toolbar | mode buttons, debug toggle, collapsed dot in ambient | setMode |
| CollectPanel | label field, save, undo, clear, template list, export and import | beginDrawing, undoStroke, endDrawing |
| StrokeThumb | a small static canvas of one drawing | none, pure render of a Drawing |
| DebugPanel | readouts, τ slider, window vs prefix inset, commit log | subscribe and getSnapshot, setThreshold |

### Data shapes are fixed here and reused by the Spike 2 battery.

- **A drawing is a label and a list of strokes, each stroke a list of `[x, y, t]`.** Strokes are kept separate on disk because a house has several and a heart has one. Matching flattens them.
- **The visitor's trail has no pen-up.** The bare cursor is one continuous stroke. So a multi-stroke template is flattened into one polyline with a `lift` flag on the first point of each stroke after the first, and the completion animation lifts the ink across a flagged segment rather than drawing it. Single-stroke templates are the easy case and should be the first ones tested.
- **An index entry is a prefix, its remainder, and where it came from.** The prefix is 64 normalized points. The remainder is the rest of the template expressed in the prefix's normalized frame, not its own. This matters: the Procrustes transform is solved on the prefix and applied to the remainder, so both must share one centroid and one scale.

| shape | fields | produced by |
| --- | --- | --- |
| Drawing | id, label, strokes as lists of [x, y, t] | collect panel, saved to localStorage and exported |
| Template | id, label, points as [x, y, lift] | buildIndex, strokes flattened with lift flags |
| IndexEntry | templateId, frac, prefix Float32Array(128), remainder as [x, y, lift], centroid, scale | buildIndex, one per template per prefix fraction |
| Window | points as [x, y], t0, t1, pathLength | segment, one per candidate cut |
| Match | entry, score, window, transform {s, θ, tx, ty} | gate then procrustes |
| Snapshot | mode, state, best match, candidate count, tick ms, τ, last 50 events | engine, at tick rate, read by DebugPanel |

## Build A — collect mode

### The collect panel records templates.

- **Mouse-down is pen-down while the mode is active.** Strokes accumulate into the current drawing. The panel shows the stroke count and a live thumbnail.
- **Label field, save, undo stroke, clear, export, import.** Saved drawings appear as thumbnails with a delete control. Storage is one localStorage key holding the whole array, so a reload keeps the session.
- **Export downloads the set as JSON; import reads one back.** The exported file is saved over `src/data/templates.json` and the dev server hot-reloads the index. Import exists so a set can be restored from that file after clearing localStorage.
- **Record five objects, three variants each.** Heart, star, and house are the easy set. Film camera and dumbbell are personal. About twenty minutes of drawing, fifteen templates.

#### Things to watch

- **Record at the size and speed you would doodle with a cursor, not at the size you would draw on paper.** Normalization removes scale, but a template drawn slowly with many points and a trail drawn in one flick have different corner sharpness, and arc-length resampling only partly hides that.
- **Keep the raw `t`.** Matching ignores it, but the Spike 2 harness replays drawings through the segmenter in time order, and the battery reuses this format.

## Build B — matching pipeline

### One match tick at 10 Hz, from ring buffer to commit or fade.

1. **Segment.** Cut candidate windows from the ring buffer at velocity minima and direction reversals. Consider windows spanning the last 0.5 to 3 s.
2. **Normalize.** Translate the centroid to the origin and scale by the bounding-box max dimension.
3. **Resample.** Arc-length resample to 64 points, uniformly spaced along the curve. This kills speed and density variation.
4. **Score.** Symmetric Chamfer distance against every index entry: mean nearest-neighbor distance in both directions, 64×64 brute force. No DTW, no rotation handling, no margin logic. Nearest neighbor and one threshold τ.
5. **Commit or fade.** Below τ, fit and animate the remainder. Otherwise the Spike 0 fade layer carries on.

```flow flow/match-pipeline wide
title: Spike 1 — one match tick, 10 Hz
alt: >-
  A vertical pipeline from the ring buffer through segment, normalize, resample and Chamfer scoring to a
  decision on τ. Yes leads to a Procrustes fit, a snap of the remainder, and an animated commit with a
  cooldown that loops back to the segmenter. No exits right to the fade layer. The precomputed template index
  sits in the right lane beside the scorer.
nodes:
  - id: ring
    label: ring buffer · last 3 s
    note: '{x, y, t} at display rate'
  - id: seg
    label: segment
    note: cut at velocity minima and reversals, 0.5–3 s windows
  - id: norm
    label: normalize
    note: centroid to origin, scale by bbox max
  - id: resamp
    label: resample to 64 pts
    note: uniform arc length
  - id: score
    label: chamfer vs index
    note: symmetric, 64×64 brute force
  - id: index
    label: template index
    note: 15 drawings × 7 prefixes ≈ 105 entries
    tone: muted
    lane: right
  - id: gate
    label: best score < τ ?
    type: decision
  - id: fade
    label: fade layer continues
    note: Spike 0 behaviour
    type: terminal
    tone: muted
    lane: right
  - id: fit
    label: procrustes fit
    note: closed-form rotation, scale, translation
  - id: snap
    label: snap remainder
    note: first point to trail end, residual over first segments
  - id: anim
    label: ink in over 500 ms
    note: brief hold, fade, 2 s cooldown
    type: terminal
    tone: good
edges:
  - from: ring
    to: seg
  - from: seg
    to: norm
  - from: norm
    to: resamp
  - from: resamp
    to: score
  - from: score
    to: index
    side: right
    label: query
  - from: score
    to: gate
  - from: gate
    to: fade
    side: right
    label: no
  - from: gate
    to: fit
    label: yes
    tone: good
  - from: fit
    to: snap
    tone: good
  - from: snap
    to: anim
    tone: good
  - from: anim
    to: seg
    side: left
    label: resume after cooldown
groups:
  - label: match tick
    note: throttled to 10 Hz
    nodes:
      - seg
      - norm
      - resamp
      - score
      - gate
```

### The index is built once at mount, and the remainder lives in the prefix's frame.

- **Each template becomes seven entries, one per prefix fraction.** Walk the flattened template by arc length, cut at 30, 40, 50, 60, 70, 80, and 90 percent. Fifteen drawings give about 105 entries.
- **Normalize the prefix, then apply the prefix's centroid and scale to the remainder.** If the remainder were normalized on its own it would have a different origin and size, and the transform solved on the prefix would place it wrongly. Store the centroid and scale on the entry so the debug panel can draw the entry in template space.
- **Prefix points are a flat `Float32Array` of 128 floats.** Chamfer is the hot loop, and 105 entries times 64 by 64 is 430k distance evaluations per candidate window. Flat typed arrays keep that in the low milliseconds; arrays of objects would not.
- **Lift flags survive into the remainder.** The prefix has them stripped, because Chamfer does not care, but the animation does.
- **Rebuild on hot reload of the JSON.** Vite re-imports `templates.json` when it changes, and the engine exposes `setTemplates` so the index follows without a page reload.

### The segmenter produces a handful of windows, not one.

- **Cut points are velocity minima and direction reversals in the last three seconds.** A velocity minimum is a sample whose speed is below a fraction of the window's median speed and lower than its neighbours. A reversal is where the dot product of successive direction vectors goes negative. Both are cheap to compute on the raw ring.
- **Each cut point opens a window running to the newest sample.** Keep windows between 0.5 and 3 s long and above a minimum path length of about 60 px, so a resting cursor and a tiny jitter do not become candidates. Always include the window from the last commit or the buffer start, so a shape drawn in one clean motion is not missed for lack of a cut.
- **Cap at six candidates per tick, newest cuts first.** Six windows times 105 entries is 2.6 M distance evaluations per tick, 26 M per second at 10 Hz. That is a few milliseconds of main-thread time. A Web Worker was considered and rejected for this spike; measure first and move it only if a tick exceeds about 4 ms.
- **Dedupe stationary samples before resampling.** Points closer than a pixel to their predecessor are dropped, otherwise arc-length resampling piles points where the cursor paused.

### Normalize and resample are the two functions that make Chamfer meaningful.

- **Normalize is centroid to origin and scale by bounding-box max dimension.** The max dimension rather than the diagonal keeps a wide flat shape and a tall thin shape from being scaled to the same size. Rotation is deliberately not handled; that is a Spike 2 question, and the tilt observation from this spike decides it.
- **Resample walks the polyline by cumulative arc length and drops 64 points at equal intervals.** Speed and sample density vanish. A slow careful heart and a fast flick of a heart produce nearly the same 64 points.
- **Templates and windows go through the identical two functions.** This is the reason they live in the matcher module and not in the engine.

### Score, then gate with one number.

- **Symmetric Chamfer: mean nearest-neighbour distance from window to entry, plus the same from entry to window, halved.** The symmetric form penalises a window that covers only part of a prefix and a prefix that covers only part of a window. One direction alone would let a short scribble match the corner of anything.
- **Score every candidate against every entry and keep the global best.** The result is a `Match` carrying the entry, the score, and the window. The gate is `score < τ` and nothing else in this spike.
- **τ is set generously and tuned live from the debug panel.** Sincere attempts should commit reliably. Some garbage committing is acceptable here; Spike 2 is where that gets fixed.

### Commit is a small state machine driven from the frame loop.

- **Five states: idle, committing, hold, fading, cooldown.** The match tick only runs in idle. A gate pass moves to committing with the transformed remainder and a start time. The frame loop advances the remaining states by elapsed time. Every transition publishes a snapshot.
- **Entering committing also marks the ring.** Samples older than the commit are excluded from future windows, so the same prefix cannot commit again after the cooldown. The visitor's new ink after the completion starts a fresh window.
- **The commit's ink is drawn by the same trail renderer with the same width logic.** It should read as the line continuing itself, not as a stamp appearing. A slightly lower alpha is the only difference, and even that is a tuning question.

```flow flow/commit-states
title: Spike 1 — commit state machine
alt: >-
  Five states in a vertical chain: idle, committing, hold, fading, cooldown. Idle loops on itself while no
  match passes the gate. A pass moves to committing, which runs 500 ms, then hold, fading, and a 2 s cooldown
  that returns to idle.
nodes:
  - id: idle
    label: idle
    note: match tick runs at 10 Hz
  - id: commit
    label: committing
    note: draw remainder by arc length, 500 ms, ease out
  - id: hold
    label: hold
    note: ~300 ms, full ink
  - id: fading
    label: fading
    note: ~500 ms, alpha to zero
  - id: cool
    label: cooldown
    note: 2 s, no matching, ring marked
edges:
  - from: idle
    to: commit
    label: gate passes
    tone: good
  - from: commit
    to: hold
  - from: hold
    to: fading
  - from: fading
    to: cool
  - from: cool
    to: idle
    side: left
    label: resume
```

### Procrustes fits the prefix, the remainder follows, and the seam is hidden by the snap.

- **Solve the similarity transform from the entry's prefix to the visitor's window.** Both are 64 points. Centre both, compute the sums of cross and dot products, take the angle from atan2, the scale from the norm ratio, and the translation from the centroids. Closed form, no iteration.
- **Apply the same transform to the remainder.** Because the remainder shares the prefix's frame, this lands it where the template's continuation would be.
- **Snap the remainder's first point onto the trail's last point.** Compute the residual between them and distribute it over the first eight remainder points with a linear falloff. The seam disappears without warping the rest of the shape.
- **Animate by arc length, not by point index.** Precompute cumulative length along the remainder and reveal up to an eased fraction of the total each frame. Lift segments advance the reveal without drawing.

### The debug panel is the tuning surface.

- **Readouts from the snapshot: the best score, its template and fraction, the candidate count, the tick time, the state machine state, and the current τ.** A slider changes τ live through `setThreshold`.
- **An inset with the best candidate window and the best entry's prefix, both normalized.** Two small canvases drawn from the snapshot. Seeing the two 64-point clouds side by side is how Chamfer confusions get diagnosed.
- **A log of the last fifty events: commits, near misses, and transitions.** Template, score, window length, and time, with a copy button. This is the observation checklist's data source.

| parameter | start value | where it bites |
| --- | --- | --- |
| resample points | 64 | normalize, Chamfer 64×64 |
| prefix fractions | 30–90%, step 10 | template index, 7 entries per drawing |
| candidate window span | 0.5–3 s | segmenter |
| minimum window path length | 60 px | segmenter, rejects jitter |
| candidates per tick | 6 | segmenter cap, tick budget |
| velocity minimum | below 0.4 × median speed | segmenter cut points |
| dedupe distance | 1 px | before resample |
| match cadence | 10 Hz | match tick throttle, snapshot rate |
| tick budget | 4 ms | move to a Worker above this |
| commit animation | 500 ms | remainder ink-in |
| hold, fade | 300 ms, 500 ms | state machine |
| post-commit cooldown | 2 s | matching pauses |
| snap falloff | 8 points | residual distribution |
| commit threshold τ | generous, self-tuned | the one gate this spike has |

## Test

### The grin test, on yourself.

- **Knowing the vocabulary, draw a lazy heart with the bare cursor.** Pass is that the completion lands and it feels good.
- **Kill is that no τ separates your sincere heart from a random loop.** That means cursor trails are too degenerate for retrieval and the project's load-bearing wall fails. There is no salvage inside this framing.

#### Things to watch

- **Feed the notebook with the observation checklist.** At what tilt does a sincere heart stop committing. Which shapes does Chamfer confuse through order-blindness. Is the endpoint hop visible after the snap. Screenshot the naive prefix seam before and after the residual distribution.
- **Tilt is the input to the Spike 2 rotation decision.** If a modest tilt kills sincere attempts here, the rotation sweep in Spike 2 stops being optional.
- **Tick time is the input to the Worker decision.** Record it from the debug panel with six candidates live. If it is under budget, the Worker never gets built.
- **Test in ambient mode with the toolbar collapsed.** The grin test is about the feeling, and a visible toolbar changes what the page is.
