---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, canvas]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 6
---
# Example: Canvas

- **The canvas is what every figure of boxes and edges sits on.** Dragging, folding behind a veil, and the expanded stage with scroll to zoom and drag to pan belong to the canvas, not to any one renderer.
- **The ERD, the call graph and the lo-fi mockup all ride it.** The figure on this page is the maintenance schema from [[example-erd]], unchanged, because nine tables is where the canvas earns its keep.

### A canvas is what any figure of boxes and edges sits on, and it is the same canvas everywhere.

- **Boxes drag, fold behind a veil, and open on an expanded stage with scroll to zoom and drag to pan.** None of that belongs to a call graph or an ERD. It belongs to the fact that the figure is boxes joined by edges, so it was pulled out into one layer that either of them, or anything else shaped that way, can ride on.
- **The layer never learns what a box means.** It moves a group, fades an edge whose end is folded, and asks the renderer named on the svg to redraw when something moved. Only the renderer knows how its own edges should follow, so that is the one thing left to it.
- **Three figures ride it today.** The call graph, where the layer was first built, the ERD, which was static until it joined, and the lo-fi mockup, whose screens are boxes and whose taps are edges. A renderer joins by meeting a small contract, listed in the reference below, and gets every behaviour at once.
- **Everything the reader does is local to the session.** Position lives in a transform and folding in a class, and a reload is a clean figure. What travels is the spec, and dropping a box writes the positions into it so an arrangement can be kept on purpose.
- **The figure below is `erd/maintenance-schema`, unchanged.** It is here because nine tables is where dragging and expanding earn their keep. Drag `work_orders` clear of the middle and watch its edges redraw as you go, then fold two tables you already know.

```erd erd/maintenance-schema wide
title: maintenance work order — full local schema
alt: Ten tables of the maintenance schema, laid out automatically, every foreign key anchored at its own column
layout: auto
tables:
  - id: wo
    label: work_orders
    columns:
      - name: id
        type: text
        key: pk
        comment: Client generated ULID, minted before the first sync so an offline order has an id.
      - name: location_id
        type: text
        key: fk
      - name: title
        type: text
      - name: resolution
        type: text?
        comment: Free text written when the order is closed. Null while open.
      - name: completed_at
        type: int?
        comment: Epoch millis. Null while the order is open, and the only field the list screen sorts on.
  - id: loc
    label: locations
    columns:
      - name: id
        type: text
        key: pk
      - name: line1
        type: text
      - name: city
        type: text
  - id: thread
    label: agent_threads
    columns:
      - name: id
        type: text
        key: pk
      - name: work_order_id
        type: text
        key: fk
      - name: agent_id
        type: text
  - id: msg
    label: messages
    columns:
      - name: id
        type: text
        key: pk
      - name: thread_id
        type: text
        key: fk
      - name: parent_id
        type: text?
        key: fk
        comment: Self reference. The message this one replies to, null at the root of a thread.
      - name: role
        type: text
  - id: tool
    label: tool_calls
    columns:
      - name: id
        type: text
        key: pk
      - name: message_id
        type: text
        key: fk
      - name: name
        type: text
  - id: photos
    label: photos
    columns:
      - name: id
        type: text
        key: pk
      - name: url
        type: text
      - name: created_at
        type: int
  - id: wop
    label: work_order_photos
    columns:
      - name: id
        type: text
        key: pk
      - name: work_order_id
        type: text
        key: fk
      - name: photo_id
        type: text
        key: fk
      - name: category
        type: text
  - id: media
    label: message_media
    columns:
      - name: id
        type: text
        key: pk
      - name: message_id
        type: text
        key: fk
      - name: photo_id
        type: text
        key: fk
  - id: pos
    label: pos_item_photos
    columns:
      - name: id
        type: text
        key: pk
      - name: item_id
        type: text
      - name: photo_id
        type: text
        key: fk
rels:
  - from: wo.location_id
    to: loc.id
    fromCard: 0..N
    toCard: 0..1
  - from: thread.work_order_id
    to: wo.id
    fromCard: 0..1
    toCard: '1'
  - from: msg.thread_id
    to: thread.id
    fromCard: 1..N
    toCard: '1'
  - from: msg.parent_id
    to: msg.id
    fromCard: 0..N
    toCard: 0..1
  - from: tool.message_id
    to: msg.id
    fromCard: 0..N
    toCard: '1'
  - from: wop.work_order_id
    to: wo.id
    fromCard: 0..N
    toCard: '1'
  - from: wop.photo_id
    to: photos.id
    fromCard: 0..N
    toCard: '1'
  - from: media.message_id
    to: msg.id
    fromCard: 0..N
    toCard: '1'
  - from: media.photo_id
    to: photos.id
    fromCard: 0..N
    toCard: '1'
  - from: pos.photo_id
    to: photos.id
    fromCard: 0..N
    toCard: '1'
```

### A renderer joins the canvas by meeting a five line contract.

- **Positioning has to be a transform.** Everything inside a box is drawn relative to the box's own origin, so a drag is one attribute changing. A renderer that writes absolute coordinates inside a box cannot join without being rewritten, which is what happened to the ERD.
- **Edges name both ends.** That is all the layer needs to fade the right arrows when a box folds. It does not read the path.
- **Redraw is the renderer's job, on the layer's schedule.** A call graph redraws on every move. So do the ERD and the lo-fi mockup now that their edges are a function of two endpoints. A renderer whose edges are expensive to route could redraw on drop instead, and the contract allows either.

| canvas contract | |
| --- | --- |
| svg | `class="cv"` and `data-canvas="<renderer>"` · the name is the key into the redraw registry |
| .cv-box | `data-node`, `data-w`, `data-h`, positioned by `transform="translate(x,y)"` · contents relative to the box origin |
| .cv-edge | `data-from` and `data-to` naming the boxes it joins · faded when either end is folded |
| cvChrome(name, w, h, rx?, eye?) | the veil and the eye, emitted last inside each box so the eye stays reachable through the veil · rx matches the box's own corners · eye is {x, y} when the top right corner is real UI, as on a screen, and the control moves outside the frame |
| CANVAS[name] | `{ move?(svg, box), drop?(svg, box) }` · move on every pointer move, drop on release · the call graph, the ERD and the lo-fi mockup all redraw on move and write the spec on drop |
| provided | drag with screen to canvas conversion at any zoom · fold, veil and edge fading · expand, with scroll to zoom about the pointer, drag to pan, fit and Escape · the expand control on any figure card holding a canvas |

**Walkthrough keys are not part of the contract.** A renderer decides what dims. The call graph keys rows and leaves the box as structure, the ERD keys the whole table, the lo-fi mockup keys screens and buttons both, and the canvas does not care either way. Hover is a renderer's too: a call graph lights callers, an ERD lights the edges of one row.
