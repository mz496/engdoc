---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, flow]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 3
---
# Example: Flowchart

- **A flowchart shows what the code decides.** Decisions are hexagons so they can hold a real question, exits go right, and the one edge that loops back is drawn as a loop.
- **A `flow` fence is nodes, edges and groups.** Placement is derived, so the spec stays order-only.

### A decision node is a hexagon, not a diamond, because a diamond cannot hold a real question.

1. Stadium. A terminal: where a flow starts or stops.
1. Rectangle. A process: one step that always happens.
1. Hexagon. A decision: a question whose exits are labelled.
1. Tone carries the verdict: green resolves, red fails, muted rests.

#### Things to note

- **A diamond cannot hold a real question.** A diamond's area grows with the square of its label, so a real question like "did this fetch complete past the deadline?" either overflows its own shape or forces a figure three times taller than it needs to be.
- **The chamfer keeps the cue, drops the cost.** Angled ends read as "branch here" at a glance while the body grows sideways like every other node, so a decision and a process line up on the same spine.
- Shapes are the only vocabulary. If a figure needs a fifth, it needs a different component. Same rule as component 01's seven marks.

```flow flow/node-vocabulary
title: node vocabulary
alt: >-
  The four node shapes: stadium terminal, rectangle process, hexagon decision, and a muted terminal for a
  resting state
nodes:
  - id: t
    type: terminal
    label: terminal — a start or an end
    tone: good
  - id: p
    type: process
    label: process — one step that always happens
  - id: d
    type: decision
    label: decision — a question with named exits
    note: the chamfer replaces the diamond
  - id: m
    type: terminal
    label: resting state — muted, no work in flight
    tone: muted
edges:
  - from: t
    to: p
  - from: p
    to: d
  - from: d
    to: m
    label: exit
```

### Most recovery logic is a spine of decisions with exits to the right and one edge that loops back.

1. Nodes run top to bottom in spec order. The fall-through exit stays on the spine.
1. A side exit parks its terminal in the right gutter, on the row of the question that sent it.
1. A loop-back routes down the left margin to an earlier node.
1. A group frame marks the region where the loop is live.

#### Things to note

- **Two questions, one spine.** Sequencing the decisions vertically makes the dependency visible: the second is only ever reached down the first's NO edge, which is exactly the property prose keeps having to restate.
- **Exits leave the frame.** A terminal drawn outside the group is the picture of "this closes the window", no label required.
- The engine measures each label and sizes the node, so a long question widens the hexagon rather than truncating or wrapping.

```flow flow/poll-window
title: the poll window
alt: >-
  Poll window: closed at rest, opened by a stamp, and closed again by the first landed fetch that either
  carries the copy or completes past the deadline
nodes:
  - id: rest
    type: terminal
    label: WINDOW CLOSED · 0 requests
    note: at rest, and through a healthy stream
    tone: muted
  - id: fetch
    type: process
    label: a fetch lands
  - id: q1
    type: decision
    label: persisted copy in the payload?
    note: text · photo-id set · toolCallId
  - id: q2
    type: decision
    label: did this fetch complete past turnFinishDeadlineAt?
    note: the only read of the stamp's value
  - id: fail
    type: terminal
    label: ✕ FAILED
    note: retry on the user message
    tone: fail
  - id: done
    type: terminal
    label: WINDOW CLOSED · 0 requests
    tone: muted
  - id: rec
    type: terminal
    label: ✓ RECONCILE
    note: messages swap for the turn
    tone: good
    lane: right
edges:
  - from: rest
    to: fetch
    label: OPENS
    note: a lost stream stamps the deadline
  - from: fetch
    to: q1
  - from: q1
    to: rec
    label: 'YES'
    tone: good
    side: right
  - from: q1
    to: q2
    label: 'NO'
  - from: q2
    to: fetch
    label: NO · keep waiting ↺
    side: left
  - from: q2
    to: fail
    label: 'YES'
    tone: fail
  - from: fail
    to: done
groups:
  - label: WINDOW OPEN
    nodes:
      - fetch
      - q1
      - q2
    note: poll every 2s · foreground only
```

### A flowchart spec is nodes, edges and groups, and the layout is derived.

- Every node sits on the spine unless it carries `lane: "right"`, which parks it in the gutter beside whichever node points at it.
- An edge with no `side` is a spine edge. A `side` of `"right"` exits sideways, and a `side` of `"left"` loops back up.
- `tone` is the only colour control. It tints the node and any edge that carries it.

| spec reference — component 02 | |
| --- | --- |
| node | { id, type:'terminal'\|'process'\|'decision', label, note?, tone?:'good'\|'fail'\|'muted', lane?:'right' } |
| edge | { from, to, label?, note?, tone?, side?:'right'\|'left' } |
| group | { label, nodes:[ids], note? } · framed region, drawn behind the nodes |

**Node width is measured from the longest of `label` and `note`, then clamped to 430px.** A decision adds the chamfer on top, so questions widen instead of wrapping, and height comes from whether a `note` is present.
