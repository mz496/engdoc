---
create-date: 2026-09-12, 23:10:00
type: plan
tags: [doodle, phase-1, prototype, retrieval]
status: draft
order: 1
parent:
---

# Ambient doodle completion, phase 1

- **The goal of this phase is to prove the interaction has legs before any ML.** It ships as one HTML page that grows across three spikes. Every artifact built here survives into the final build.
- **Each spike is its own document.** This page is the map: the diagram below shows how the spikes chain and where each one can die, and the links take you to the plan for each. Numbers from every test go to the notebook so the decision at the end of the phase can cite them.

## Wayfinding

### Three spikes on one page, each with a kill exit.

- **Spike 0 is the trail, Spike 1 is the magic loop, Spike 2 is the router.** Spike 0 is one HTML file. Spike 1 ports it into a small React app over an imperative canvas engine, and Spike 2 adds to that app. Nothing is thrown away between spikes and the page is always demoable.
- **Kills exit to the right.** Spike 0 and Spike 1 kills are fatal to the current framing. The Spike 2 kill is soft: the page still ships, in a mode that never auto-commits.

```flow flow/phase-shape
title: phase 1 — three spikes
alt: >-
  A vertical spine of three spike boxes. Each spike has a kill exit to the right: rethink the ambient framing,
  the load-bearing wall fails, or ship fan-only mode.
nodes:
  - id: s0
    label: Spike 0 · trail as ink
    note: one evening
  - id: s1
    label: Spike 1 · retrieval + commit
    note: one weekend
  - id: s2
    label: Spike 2 · routing
    note: two to three evenings
    type: terminal
    tone: good
  - id: k0
    label: rethink ambient framing
    note: R1 fatal
    tone: fail
    lane: right
  - id: k1
    label: load-bearing wall fails
    note: cursor trails too degenerate
    tone: fail
    lane: right
  - id: k2
    label: ship fan-only mode
    note: ghost, never auto-commit
    tone: muted
    lane: right
edges:
  - from: s0
    to: s1
    label: unprompted play
    tone: good
  - from: s1
    to: s2
    label: grin test passes
    tone: good
  - from: s0
    to: k0
    side: right
    label: nobody plays
    tone: fail
  - from: s1
    to: k1
    side: right
    label: no τ separates
    tone: fail
  - from: s2
    to: k2
    side: right
    label: no operating point
```

### The spike plans.

- **[[doodle-spike0-trail|Spike 0 · trail as ink]].** One evening. A full-viewport canvas overlay that draws the cursor trail as ink and fades it. Tested on two friends with zero instructions.
- **[[doodle-spike1-magic-loop|Spike 1 · retrieval + commit]].** One weekend. The page becomes a React app with a mode toolbar, a collect panel for templates, a Chamfer matching pipeline on the live trail, and a Procrustes-fitted completion. Tested on yourself with the grin test.
- **[[doodle-spike2-routing|Spike 2 · routing]].** Two to three evenings. A scribble battery, a distance-plus-margin gate, and an offline harness that draws the ROC and picks the operating point.

### Explicitly out of scope this phase.

- **No trained model, QuickDraw, or tokenizer.** Retrieval only.
- **No ghost fan beyond the Spike 2 fallback, no style token, no hanzi classes.**
- **No mobile touch mode.** Desktop-first; the touch region ships in Phase 2.
- **No kinematic or power-law analysis.** The velocity-modulated width in Spike 0 is rendering, not analysis.
