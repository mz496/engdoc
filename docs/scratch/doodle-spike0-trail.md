---
create-date: 2026-09-12, 23:40:00
type: plan
tags: [doodle, phase-1, spike-0, canvas]
status: draft
order: 1
parent: doodle-phase1
---

# Spike 0 — Trail as ink

- **One evening, one file, no dependencies.** A full-viewport canvas overlay that draws the pointer trail as ink and lets it dissolve. Nothing here matches anything yet.
- **The architectural job of this spike is the ring buffer.** Everything in [[doodle-spike1-magic-loop|Spike 1]] reads from it, so its sample shape, its clock, and its coordinate space are decided here and not revisited.
- **The test is two friends, zero instructions, sixty seconds.** Pass is unprompted play. Kill is nobody noticing, which is risk R1 and fatal to the ambient framing.

## Architecture

### Two clocks that never wait on each other.

- **Input runs on the browser's event clock, rendering runs on the frame clock.** The pointer listener does one thing, push a sample into the ring buffer, and returns. The requestAnimationFrame loop reads the buffer and paints. Neither blocks the other, and neither blocks the page underneath.
- **Five pieces, all in `index.html`.** A sampler, a ring buffer, a trail renderer, a fade layer with particles, and a frame loop that also owns resize and the reduced-motion preference. They are sections of one script in this spike. Spike 1 ports them file for file into `src/engine/` under a React app, so write each as a self-contained object with no shared globals.

```seq seq/spike0-clocks
title: Spike 0 — input clock and frame clock
alt: >-
  Four actors: the pointer, the ring buffer, the frame loop and the canvas. Pointer events push samples into
  the ring asynchronously. In parallel the frame loop reads the ring each frame, evicts old samples, expires
  points into particles, and paints the trail and particles to the canvas.
autonumber: true
spacing: 170
actors:
  - id: ptr
    label: pointermove
  - id: ring
    label: ring buffer
  - id: loop
    label: rAF loop
  - id: cv
    label: canvas
steps:
  - type: block
    kind: par
    sections:
      - label: input clock · passive listener, returns immediately
        steps:
          - type: msg
            kind: async
            from: ptr
            to: ring
            label: push {x, y, t}
      - label: frame clock · one pass per frame
        steps:
          - type: msg
            kind: sync
            from: loop
            to: ring
            label: read samples newer than 3 s
          - type: msg
            kind: return
            from: ring
            to: loop
            label: window
          - type: self
            actor: loop
            label: expire points older than 1.5 s into particles
          - type: msg
            kind: async
            from: loop
            to: cv
            label: clear, draw trail, draw particles
```

### The ring buffer is the contract with everything after this.

- **Samples are `{x, y, t}` in viewport coordinates.** `x` and `y` come from `clientX` and `clientY`, so the trail stays pinned to the viewport when the page scrolls. The alternative, document coordinates, would make the trail scroll with the content, which reads as a drawing on the page rather than ink on the glass.
- **`t` is `event.timeStamp`, not `Date.now()`.** It shares a monotonic clock with requestAnimationFrame timestamps, so age is a subtraction with no clock skew.
- **Store raw events, do not downsample on ingest.** Pointer events arrive at display rate, 60 to 120 Hz. The 30 Hz figure in the constants is the rate later stages assume after resampling, not a rate to throttle input to. Throwing samples away at ingest would lose the velocity minima the Spike 1 segmenter cuts on.
- **Fixed-capacity parallel typed arrays, evicted by age.** Three `Float32Array`s and a head index, capacity 512, enough for three seconds at 120 Hz with headroom. Eviction is by `t`, not by count, so a slow drawer and a fast drawer both get three seconds.
- **Ignore touch and pen in this phase.** Filter on `pointerType === "mouse"`. Touch on a scrolling page is a different interaction and ships in Phase 2.

### Rendering is stateless: clear and redraw every frame.

- **Redraw the whole trail from the buffer each frame.** The alternative is the accumulation trick, painting a translucent rectangle over the last frame so old ink fades. That is cheaper but it fights device pixel ratio, cannot express per-point width, and cannot be turned off cleanly for reduced motion. One polyline of at most 512 points is well under a millisecond.
- **Width comes from speed, smoothed.** Per-segment speed is distance over time delta. Map it through a clamp to a width range, then run an exponential moving average so a single jittery sample does not blip the stroke. Fast is thin and slow is thick, which is what a pen does.
- **Catmull-Rom through recent points, converted to cubic Béziers.** The standard conversion gives each segment two control points from its neighbours, and the canvas draws Béziers natively. Uniform parameterisation is fine at this sample density.
- **Alpha is a function of age.** Full at zero, linear to zero at the fade age. Particles carry their own life and alpha.
- **Canvas is `position: fixed`, `pointer-events: none`, sized to the viewport at device pixel ratio.** Resize re-allocates the backing store and rescales the context. There is no WebGL and no library, since the whole scene is one stroke and a few dozen particles.

### The fade layer is a second, small particle system.

- **A point crossing the fade age spawns two or three particles and leaves the trail.** Each particle has a position, a small random velocity with slight upward drift, and a life of a few hundred milliseconds. They shrink and alpha out.
- **Particles live in their own array, not in the ring.** They are rendering state, not input. Capping the array at a few hundred keeps a frantic scribbler from allocating unboundedly.
- **Reduced motion disables the particle system and the width modulation.** Check `matchMedia("(prefers-reduced-motion: reduce)")` at start and listen for changes. The trail becomes a thin static-width line that fades.

| parameter | start value | where it bites |
| --- | --- | --- |
| ring capacity | 512 samples | 3 s at 120 Hz with headroom |
| ring buffer age | 3 s | eviction, later the window cut |
| trail fade age | 1.5 s | point expiry into particles |
| width range | 1.5–6 px | velocity to width clamp |
| width smoothing | EMA α 0.3 | per-segment width jitter |
| particles per expiring point | 2–3 | fade layer |
| particle life | 300–600 ms | fade layer |
| particle cap | 300 | fade layer allocation |

#### Things to watch

- **Passive listeners only, and nothing heavier than a push in the handler.** The premise is that the page underneath keeps working. If the trail ever costs a dropped scroll frame, the premise is compromised. Measure with the performance panel while scrolling a long page.
- **Pause when the tab is hidden and idle when there is nothing to draw.** Skip the frame when the buffer is empty and no particles are alive, so an idle tab costs nothing.
- **Pointer leaves the window.** `pointerleave` on the document should not clear the buffer; the trail should just age out. Otherwise the ink vanishes the moment the cursor crosses the browser chrome.

## Test

### Two friends, zero instructions, sixty seconds.

- **Hand it over and watch.** Do not explain what it is or what it does. Put the overlay on a page with real content and scroll to read, so the trail is discovered rather than presented.
- **Pass is unprompted play.** Loops, squiggles, anything that shows they noticed and wanted to touch it.
- **Kill is nobody noticing or playing.** That is risk R1 and it is fatal to the framing. Stop and rethink the ambient premise before spending a weekend on Spike 1.

### A debug overlay toggled with the `d` key.

- **Frame time, sample count, particle count, and the reduced-motion flag.** A fixed corner readout, off by default and never shown to the friends. Spike 0 has no UI to hang a button on, so a key is the toggle; Spike 1 replaces it with the toolbar and the debug panel.

#### Things to watch

- **R1 lives in a risk register outside this document.** When that register gets a page, link it here.
- **Write down what each friend did in the first ten seconds.** Whether they noticed at all, and what they drew first, are the two notebook entries this spike produces.
