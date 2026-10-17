---
create-date: 2026-09-12, 23:40:00
type: plan
tags: [doodle, phase-1, spike-2, routing, eval]
status: draft
order: 3
parent: doodle-phase1
---

# Spike 2 — Routing, or don't complete garbage

- **Two to three evenings to stop the matcher committing on scribbles.** A battery of sincere and adversarial inputs, a gate that needs both a small distance and a clear margin, and an offline harness that sweeps the thresholds and draws the ROC.
- **The architectural job of this spike is the harness.** It replays recorded drawings through the same matcher module the page runs, tick by tick, so the ROC measures the live behaviour and not a simplified version of it. The battery it runs on is the seed of the project's out-of-distribution eval and is versioned from day one.
- **Pass is an operating point with about zero false commits and better than half of sincere attempts recognized.** Soft-kill is that no such point exists, in which case the page ships in fan-only mode and never auto-commits.

## Architecture

### The harness imports the page's matcher, not a copy of it.

- **`eval/harness.ts` runs in Node through `tsx` and imports `src/engine/matcher/` directly.** It also imports `src/data/templates.json` the way the page does. Any divergence between what the harness scores and what the page does would make the ROC meaningless, so there is one matcher and two callers.
- **`eval/gen-negatives.ts` writes random-walk drawings in the battery format.** Seeded, so the same command regenerates the same files.
- **The page grows two controls, both in the toolbar and the collect panel.** The collect panel gets a set selector, templates, positives, or negatives, so battery drawings are recorded with the same panel as templates. The toolbar gets a fan-only toggle that switches the commit state machine into ghost rendering. Neither is a URL flag; see [[doodle-spike1-magic-loop|Spike 1]] for the page structure.

```cg cg/spike2-files wide
alt: >-
  Five boxes. The harness and the negatives generator in eval on the left. The harness imports the matcher,
  the same pure module the page uses, and reads the battery files and templates.json. The page on the right
  gains a set selector in the collect panel and a fan-only toggle in the toolbar, and its engine still calls
  the matcher.
docs:
  harness: >-
    Offline replay. Feeds each battery drawing through the segmenter and scorer in simulated time, records the
    first gate pass, sweeps thresholds, writes the ROC.
  gen: Seeded random-walk generator. Momentum plus noise, writes drawings in the battery format.
  matcher: >-
    Unchanged role from Spike 1, extended with smoothing, margin and the optional rotation sweep. Still pure,
    still the only matcher.
  battery: Versioned JSON drawings. Positives are labelled sincere attempts, negatives are scribbles and walks.
  page: The React app and engine from Spike 1. Gains a set selector and the fan-only rendering path.
files:
  - id: harness
    name: eval/harness.ts
    fns:
      - loadBattery
      - replay
      - sweep
      - pickOperatingPoint
      - writeRun
  - id: gen
    name: eval/gen-negatives.ts
    fns:
      - randomWalk
      - writeDrawing
  - id: matcher
    name: src/engine/matcher/
    fns:
      - buildIndex
      - segment
      - smooth
      - scoreAll
      - rotationSweep
      - gate
      - procrustes
  - id: battery
    name: eval/battery/v1/
    fns:
      - positives
      - negatives
  - id: page
    name: src/
    fns:
      - CollectPanel.setSelector
      - Toolbar.fanToggle
      - Engine.tick
      - commit.step
      - fan.draw
calls:
  - from: harness.loadBattery
    to: battery.positives
  - from: harness.loadBattery
    to: battery.negatives
  - from: harness.replay
    to: matcher.buildIndex
  - from: harness.replay
    to: matcher.segment
  - from: harness.replay
    to: matcher.scoreAll
  - from: harness.sweep
    to: matcher.gate
  - from: harness.pickOperatingPoint
    to: harness.writeRun
  - from: gen.randomWalk
    to: gen.writeDrawing
  - from: gen.writeDrawing
    to: battery.negatives
  - from: page.CollectPanel.setSelector
    to: battery.positives
  - from: page.CollectPanel.setSelector
    to: battery.negatives
  - from: page.Toolbar.fanToggle
    to: page.fan.draw
  - from: page.Engine.tick
    to: matcher.segment
  - from: page.Engine.tick
    to: matcher.scoreAll
  - from: page.Engine.tick
    to: matcher.gate
  - from: page.fan.draw
    to: matcher.procrustes
  - from: matcher.scoreAll
    to: matcher.smooth
  - from: matcher.scoreAll
    to: matcher.rotationSweep
```

## Build

### The battery is recorded in the collect format and never edited in place.

- **About fifty negatives.** Ten minutes of you scribbling adversarially with the collect panel's set selector on negatives, plus the random-walk generator: segments with momentum and noise, heading perturbed by gaussian noise each step, speed drifting, a few hundred points each.
- **About fifty positives.** Sincere attempts at the five objects with the set selector on positives, labelled, some deliberately wobbly or tilted. The label is the ground truth the harness checks a commit against.
- **One drawing per file under `eval/battery/v1/positives/` and `eval/battery/v1/negatives/`.** Each carries `label`, `source` as `human` or `walk`, a `tags` list such as `tilted` or `wobbly`, and the strokes with raw `t`. The format is the Spike 1 drawing shape plus those three fields.
- **The battery is immutable once a run cites it.** New drawings go into `v2`. A run records which battery version and which git hash it ran against.

| field | value | used for |
| --- | --- | --- |
| id | ulid | file name, join key in run output |
| label | one of the five objects, or none | ground truth for a commit |
| source | human \| walk | stratifying the ROC |
| tags | tilted, wobbly, adversarial, loop | slicing hard cases |
| strokes | list of strokes, each a list of [x, y, t] | replay in time order |
| seed | integer, walks only | regenerating a walk |

### Gate v2 needs a small distance and a clear margin.

- **Commit requires both.** Normalized Chamfer distance below τ₁, and the margin between the best and second-best entry above τ₂. A close second is a reason not to commit, because it means the window looks like two different things.
- **Margin is relative.** Second-best minus best, divided by best. An absolute margin would shift with τ₁ and would need retuning every time the distance threshold moved.
- **Second-best is across templates, not across entries.** Two prefix fractions of the same heart scoring close together is not ambiguity. Take the best entry per template, then the margin between the top two templates.
- **The margin also feeds the fallback.** In fan-only mode the ghost's alpha is a function of margin, so a confident top candidate reads darker than an ambiguous one.

### Smoothing is applied after resampling, identically on both sides.

- **A five-tap gaussian over the 64 resampled points.** Applied to windows at match time and to template prefixes at index time. Resampling first means the kernel is in arc-length units and the same for every shape regardless of how fast it was drawn.
- **A spline or a low-pass on raw samples was rejected.** Either would run in time units and treat a slow careful drawing differently from a fast one, undoing what arc-length resampling bought.
- **Remainders are not smoothed.** They are drawn, not compared, and the template's corners should come back sharp.

### The rotation sweep is optional and unlocked by Spike 1's tilt observation.

- **If tilt killed sincere attempts in [[doodle-spike1-magic-loop|Spike 1]], sweep −45° to +45° in 15° steps.** Rotate the window seven times, score each, keep the best, and pass the winning angle into Procrustes as its starting rotation.
- **Seven times the Chamfer work.** At six candidates and 105 entries that is about 18 M distance evaluations per tick. This is the point where a Web Worker or a cheap prefilter stops being optional; measure the tick and decide.
- **A prefilter, if needed, is a bounding-box aspect ratio check.** Discard entries whose normalized aspect differs from the window's by more than a factor before running Chamfer. It is a few comparisons per entry and cuts the candidate set sharply for elongated shapes like the dumbbell.

### The harness replays each drawing tick by tick.

- **Feed the drawing's points into a ring buffer in `t` order, and run the match tick every 100 ms of drawing time.** This exercises the segmenter's cut logic and the window span limits the way the page does. Scoring the whole drawing once would skip all of that and measure a different system.
- **Record, per drawing, the best distance and margin at every tick, and the first tick at which each candidate threshold pair would have committed.** Store the raw per-tick scores so the sweep is a pass over arrays, not a re-run of Chamfer.
- **Sweep τ₁ and τ₂ on a grid.** For each pair, a positive is recognized if a commit happened and its label matched. A false commit is any commit on a negative, or a wrong-label commit on a positive. Recognition rate and false commit count per pair are the ROC.
- **Pick the operating point as the highest recognition with zero false commits, and print the nearest point with one.** Write the run to `eval/runs/` with the date, git hash, battery version, the grid, and the chosen point. Also print a per-tag slice so tilted and wobbly positives can be seen separately.

```flow flow/harness-replay
title: Spike 2 — harness replay per drawing
alt: >-
  A vertical pipeline: load a battery drawing, feed points into a ring in time order, every 100 ms run
  segment and score, record best distance and margin per tick, then after all drawings sweep the threshold
  grid, and pick the operating point. The battery files and the run output sit in the right lane.
nodes:
  - id: load
    label: load drawing
    note: strokes flattened, t preserved
  - id: bat
    label: eval/battery/v1
    tone: muted
    lane: right
  - id: feed
    label: feed ring in t order
    note: same ring semantics as the page
  - id: tick
    label: every 100 ms · segment, score
    note: same matcher calls as the page
  - id: rec
    label: record per tick
    note: best distance, best margin, best template
  - id: more
    label: more drawings?
    type: decision
  - id: sweep
    label: sweep τ₁ × τ₂ grid
    note: recognition vs false commits
  - id: pick
    label: pick operating point
    note: max recognition at zero false commits
    type: terminal
    tone: good
  - id: run
    label: eval/runs/<date>.json
    note: git hash, battery version, grid, point
    tone: muted
    lane: right
edges:
  - from: load
    to: bat
    side: right
    label: reads
  - from: load
    to: feed
  - from: feed
    to: tick
  - from: tick
    to: rec
  - from: rec
    to: more
  - from: more
    to: load
    side: left
    label: yes
  - from: more
    to: sweep
    label: no
  - from: sweep
    to: pick
  - from: pick
    to: run
    side: right
    label: writes
```

### Fan-only mode is the fallback and it is a rendering path, not a new matcher.

- **The toolbar's fan-only toggle replaces the commit state machine's committing state with a ghost state.** Every tick, the best candidate's remainder is fitted and snapped exactly as for a commit, then drawn at low alpha and updated in place. It never animates in and never holds.
- **The ghost's alpha tracks the margin, and it disappears when the trail goes idle.** No cooldown, no ring marking. The visitor sees what the system is thinking and is never surprised by ink they did not ask for.
- **The fit, snap, and draw code is shared with the commit path.** The only new code is the state and the alpha rule.

| parameter | start value | where it bites |
| --- | --- | --- |
| distance threshold τ₁ | from ROC | gate v2, replaces Spike 1's τ |
| margin threshold τ₂ | from ROC, relative | gate v2, top template vs second |
| smoothing kernel | 5-tap gaussian, σ 1 point | after resample, both sides |
| rotation sweep | −45°..+45°, step 15°, best of 7 | optional, only if tilt killed Spike 1 attempts |
| aspect prefilter | ratio within 2× | optional, only with the sweep |
| replay cadence | 100 ms drawing time | harness tick |
| sweep grid | τ₁ 40 steps × τ₂ 20 steps | ROC resolution |
| battery size | ~50 negatives, ~50 positives | ROC resolution |
| walk generator | 200–600 points, heading noise σ 0.3 rad | negatives |
| ghost alpha | 0.15–0.4 by margin | fan-only mode |

#### Things to watch

- **The harness must construct the ring the same way the page does.** Same capacity, same eviction by age, same dedupe. Import `src/engine/ring.ts` into the harness rather than reimplementing it; it has no DOM dependency.
- **Adversarial scribbles are the ones that look like something.** A random walk that happens to close a loop is the interesting negative. Tag those and read the per-tag slice.
- **A wrong-label commit on a positive is a false commit.** Completing a sincere star as a heart is worse than not completing it, and the ROC must count it that way.

## Test

### Pick an operating point from the ROC.

- **Pass is an operating point with about zero false commits and better than half of sincere attempts recognized.** Record the point, the false commit count, the recognition rate, and the per-tag slices in the notebook, with the run file's name.
- **Soft-kill is that no such point exists.** Ship fan-only mode: show the top candidate as a faint ghost and never auto-commit. Note that v1's trained model must then earn the commit regime.

#### Things to watch

- **Run the harness before and after adding smoothing, and before and after the sweep.** Each is one run file, and the difference between runs is the evidence for keeping or dropping the feature.
- **Check the page against the harness on a few drawings by hand.** The debug panel gets a replay button that feeds a battery file into the live engine; confirm the same tick commits. If they disagree, the two callers have drifted.
