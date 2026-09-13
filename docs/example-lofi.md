---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, lofi]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 7
---
# Example: Lo-fi mockup

- **A lo-fi mockup says where a tap goes.** Screens are boxes on the canvas, three element types are enough to draw one, and an arrow leaves the button that was tapped rather than the edge of the screen.
- **A `screen` fence is screens, elements and links.** Screens are placed by grid or by hand, and dragging one writes its position back into the spec.

### Three elements are enough to say where a tap goes.

1. Sticky topbar. Pinned to the top, optional back chevron.
1. List, N rows, as skeleton bars or as real strings.
1. Sticky button. Docked to the bottom, or aligned to a side at any width.
1. Media. An image or video placeholder, optionally with a captured-thumbnail strip.
1. Left is skeleton, middle is content, right is a live preview with captures.

#### Things to note

- **Lo-fi is the point, not a stage on the way to a design.** The moment a mockup looks like a design, review turns into a conversation about padding. The point here is only which tap reaches which screen.
- **Skeleton is the default and content is the exception.** Fill in real strings only where the words carry the argument. Everywhere else the bars say "a list goes here" without inviting copy edits.
- Buttons dock from the bottom up in the order they appear, so a screen with two stacked CTAs stays honest about which one sits lowest.
- A thumbnail strip lives inside the preview it belongs to, not under it, which is where a camera UI actually puts it, and it keeps the strip from reading as a separate section of the screen.

```screen lofi/screen-elements
title: the three elements
alt: One screen showing a sticky topbar, a list, and a sticky bottom button, in skeleton and in content form
screens:
  - id: skel
    label: SKELETON
    col: 0
    row: 0
    elements:
      - type: topbar
      - type: list
        rows: 3
      - type: thumbs
        count: 4
        captured: false
      - type: button
        id: cta
        label: ''
  - id: real
    label: CONTENT
    col: 1
    row: 0
    elements:
      - type: topbar
        label: Maintenance
      - type: list
        items:
          - 12 Oak St · leak
          - 88 Pine Ave · HVAC
          - 4 Elm Rd · door
          - 19 Birch Ln · paint
      - type: button
        id: cta
        label: New work order
  - id: corner
    label: CORNER BUTTON
    col: 2
    row: 0
    elements:
      - type: topbar
        label: Photos
        back: true
      - type: media
        kind: video
        h: 150
        label: camera preview
        thumbs: 3
      - type: button
        id: shutter
        label: Capture
        align: right
        width: 0.5
links: []
```

### An arrow leaves the button that was tapped, not the edge of the screen.

1. Four screens of the maintenance work-order flow.
1. Each arrow starts at a specific button and lands on the screen it opens.
1. `chat` has two exits, the camera and the kickoff, from two different buttons.
1. The camera's Done arrow points back, so the round trip is visible.
1. Screens are canvas boxes. Drag one and its arrows follow, fold one behind its eye, or expand the figure.

#### Things to note

- Anchoring at the control is the whole point, and it is the same trick the ERD uses for foreign keys: a screen-to-screen arrow makes the reader guess which button, which is exactly the thing being documented.
- Two arrows out of one screen reads as a fork without any notation for it. The buttons are in different places, so the arrows leave from different places.
- A back arrow is worth drawing when the return is not the obvious one. Here Done returns to the chat rather than popping to the hub, which is a decision someone could get wrong.
- **Screens sit where the spec puts them and nothing routes the arrows.** A nav map is small and its arrangement is the argument, so there is no solver. Each arrow is a straight stub at either end with a bezier between, the same edge an ERD draws, which is what lets a dragged screen redraw its arrows from positions alone. Drop a screen and the spec below picks up its x and y.

```screen lofi/work-order-nav
title: maintenance · work order navigation
alt: Four mobile screens with arrows leaving the tapped button and pointing at the screen it opens
screens:
  - id: home
    label: HOME
    col: 0
    row: 0
    elements:
      - type: topbar
        label: Maintenance
      - type: list
        items:
          - 12 Oak St · leak
          - 88 Pine Ave · HVAC
          - 4 Elm Rd · door
      - type: button
        id: new
        label: New work order
  - id: chat
    label: CHAT · INTAKE
    col: 1
    row: 0
    elements:
      - type: topbar
        label: ''
        back: true
      - type: block
        h: 70
        label: transcript
      - type: media
        kind: image
        h: 62
      - type: button
        id: camera
        label: Add photo
        align: left
        width: 0.46
      - type: button
        id: start
        label: Start
  - id: camera
    label: PHOTO CAPTURE
    col: 2
    row: 0
    elements:
      - type: topbar
        label: Before
        back: true
      - type: media
        kind: video
        h: 152
        label: camera
        thumbs: 3
      - type: button
        id: done
        label: Done
        align: right
        width: 0.44
  - id: hub
    label: WORK ORDER HUB
    col: 1
    row: 1
    elements:
      - type: topbar
        label: Work order
        back: true
      - type: list
        items:
          - Title
          - Address
          - Before / after
      - type: button
        id: complete
        label: Complete
links:
  - from: home.new
    to: chat
    label: tap
  - from: chat.camera
    to: camera
    label: tap
  - from: chat.start
    to: hub
    label: kickoff
  - from: camera.done
    to: chat
    label: back
```

### A lo-fi mockup spec is screens, elements and links, placed by grid or by hand.

- Elements render in spec order: the topbar pins to the top, docked buttons stack from the bottom, everything else flows between.
- A link's `from` is `screen.elementId`. Its `to` is a screen.
- Give a `list` either `rows` for skeleton bars or `items` for real strings. A `media` takes `thumbs` to dock a captured strip inside its own frame.

| spec reference — component 04 | |
| --- | --- |
| screen | { id, label, col, row \| x, y, h?, elements:[…] } · any screen with x/y switches the whole spec to free placement |
| topbar | { type:'topbar', label?, back?:true } |
| list | { type:'list', rows? \| items:[…], id? } |
| button | { type:'button', id, label, align?:'left'\|'right'\|'center', width?:0–1, dock?:false } |
| block | { type:'block', h?, label? } · dashed when unlabelled |
| media | { type:'media', kind:'image'\|'video', h?, label?, thumbs?:n, captured?:false } |
| thumbs | { type:'thumbs', count?, captured?:false } · a standalone strip |
| link | { from:'screen.elementId', to:'screen', label? } · the label sits at the tail, past the stub |
| canvas | [w, h] · written on drop, sizes the figure when screens are placed by hand |

**Buttons and their arrows share a walkthrough key of `screen~buttonId`.** A lo-fi mockup can then be scrubbed like any other figure, and lighting a tap lights where it goes.
