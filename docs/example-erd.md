---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, erd]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 4
---
# Example: ERD

- **An ERD shows how tables relate.** Each relationship end states both cardinality and optionality in crow's-foot notation, and foreign keys start at the column that holds them.
- **An `erd` fence is tables, columns and relationships.** Small figures sit on a hand grid with `col` and `row`. Larger ones set `layout: auto` and are handed to a solver, and dragging a table writes its `x` and `y` back into the spec shown under the figure.

### A relationship end states both cardinality and optionality.

1. The bar means one. The crow's foot means many.
1. The circle means optional. The row may not exist at all.
1. Read the end nearest a table as that table's side of the sentence.
1. Tinted rows are primary keys. Grey rows are foreign keys.

#### Things to note

- **Read each end toward the table it touches.** A foot at `messages` and a bar at `threads` is "one thread has many messages". The marks are not a single label on the line.
- **Optionality is the half everyone drops.** `0..N` and `1..N` look alike and mean very different things: one permits an empty set, the other makes it a bug.
- **A mark turns with the edge it stands on.** The second figure is one hub with a child either side, both holding the same foreign key and the same cardinality: the foot lands on the left child's right edge and on the right child's left edge. A foot that always opened the same way would be wrong on half of any real diagram.
- Four ends is the whole vocabulary. Anything needing a fifth, such as ternary relationships or inheritance, wants a different figure.

```erd-key erd/crows-foot-key
```

```erd erd/mirrored-ends
title: the same relationship on both edges of one table
alt: >-
  A hub table with one child to its left and one to its right. Both children hold the same foreign key and the
  same cardinality, so the crow's foot appears on the left child's right edge and on the right child's left
  edge, turning with the edge it stands on.
tables:
  - id: west
    col: 0
    row: 0
    label: west_child
    columns:
      - name: id
        type: int
        key: pk
      - name: hub_id
        type: int
        key: fk
        comment: The foot for this key lands on the table's right edge, because hub sits to the right.
  - id: hub
    col: 1
    row: 0
    label: hub
    columns:
      - name: id
        type: int
        key: pk
      - name: name
        type: text
  - id: east
    col: 2
    row: 0
    label: east_child
    columns:
      - name: id
        type: int
        key: pk
      - name: hub_id
        type: int
        key: fk
        comment: Same key, same cardinality, but the foot lands on the left edge here, because hub sits to the left.
rels:
  - from: west.hub_id
    to: hub.id
    fromCard: 0..N
    toCard: '1'
  - from: east.hub_id
    to: hub.id
    fromCard: 0..N
    toCard: '1'
```

### Foreign keys start at the column that holds them, not at the edge of the box.

1. Two membership tables both reference `photos`.
1. Each edge leaves the exact `photo_id` row and lands on `photos.id`.
1. The foot sits at the child, the bar at the parent: many memberships, one photo.

#### Things to note

- **This is the whole reason to draw an ERD by hand.** A box-to-box arrow makes the reader hunt for which column is the key. Anchoring at the row removes the guess, and it is the thing most generated diagrams get wrong.
- Both edges land on the same `id` row, which is the visual form of "`photos` is the shared parent", no legend needed.
- **A column comment carries the behaviour the shapes cannot.** Hover `photo_id` in either membership table. On delete cascade is a property of the constraint, not of its cardinality, so it lives on the column that holds the key rather than on the line, and the dotted underline is the only sign it is there.

```erd erd/photo-store
title: local photo store
alt: Photos table referenced by two membership tables, each foreign key drawn from the column that holds it
tables:
  - id: photos
    label: photos
    col: 1
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: url
        type: text
      - name: created_at
        type: int
  - id: pos
    label: pos_item_photos
    col: 0
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: item_id
        type: text
      - name: photo_id
        type: text
        key: fk
        comment: On delete cascade. Deleting the photo removes this membership row.
  - id: wop
    label: work_order_photos
    col: 2
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: work_order_id
        type: text
      - name: photo_id
        type: text
        key: fk
        comment: On delete cascade. Deleting the photo removes this membership row.
      - name: category
        type: text
        comment: One of before, during, after. Enforced in the app, not by a check constraint.
rels:
  - from: pos.photo_id
    to: photos.id
    fromCard: 0..N
    toCard: '1'
  - from: wop.photo_id
    to: photos.id
    fromCard: 0..N
    toCard: '1'
```

### Each relationship gets its own cardinality pair, so one table can differ with every neighbour.

1. `work_orders` → `agent_threads`: one to zero-or-one.
1. `agent_threads` → `messages`: one to one-or-many.
1. `work_orders` → `addresses`: zero-or-many to zero-or-one.

#### Things to note

- **The thread relationship is the interesting one.** `0..1` says a work order may never start a chat, which is exactly why the code mints the thread lazily on first send.
- **"One or many" on messages is a claim worth checking. It asserts an empty thread cannot exist. If the schema permits one, the diagram is lying and the constraint is missing.** The comment on `thread_id` says where the guarantee actually comes from.
- Reading a diagram like this out loud is the cheapest schema review there is: each relationship becomes a sentence someone can agree or disagree with.

```erd erd/cardinality-pairs
title: cardinality — all four ends
alt: One table related to three others, each relationship showing a different cardinality pair
tables:
  - id: wo
    label: work_orders
    col: 1
    row: 1
    columns:
      - name: id
        type: text
        key: pk
      - name: title
        type: text
      - name: completed_at
        type: int?
  - id: thread
    label: agent_threads
    col: 0
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: work_order_id
        type: text
        key: fk
        comment: Unique. A work order has at most one thread, minted lazily on the first send.
  - id: msg
    label: messages
    col: 2
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: thread_id
        type: text
        key: fk
        comment: Not null, and a thread is created with its first message, so an empty thread cannot exist.
      - name: role
        type: text
  - id: addr
    label: addresses
    col: 2
    row: 1
    columns:
      - name: id
        type: text
        key: pk
        comment: Optional both ways. A work order may have no address yet, and an address may have no work orders.
      - name: line1
        type: text
rels:
  - from: wo.id
    to: thread.work_order_id
    fromCard: '1'
    toCard: 0..1
  - from: thread.id
    to: msg.thread_id
    fromCard: '1'
    toCard: 1..N
  - from: wo.id
    to: addr.id
    fromCard: 0..N
    toCard: 0..1
```

### At schema scale the layout has to be solved rather than placed by hand.

1. Every table in the maintenance local store, ranked left to right by dependency.
1. Ten foreign keys, each still anchored at its own column.
1. `messages.parent_id` is a self-reference. The thread's reply tree.
1. `photos` is the shared parent of three different membership tables.

#### Things to note

- **Tables drag, and the arrows follow.** Every ERD sits on the same canvas a call graph does. Pull a table clear of a tangle and its edges redraw from the new position on every move, with the stubs and crow's feet exactly where they were against the box.
- **Hover a row and only its relationships stay lit.** Every other edge drops to a whisper and the rows at the far ends tint, so ten edges get read one at a time. A table header does the same for everything that touches the table. The light is neutral white, like a call graph. Blue stays the walkthrough's.
- **Edges draw over the tables, not under them.** Under a table, an edge passing behind it looked as if it left that table at some odd row. Over it, a crossing is plainly a crossing, and the hover says which edge is which.
- **The eye folds a table away, and expand opens the schema on its own stage.** Same controls, same veil, same scroll to zoom and drag to pan. A nine table schema is where they earn their keep, and this figure is the one to try them on.
- **Dropping a table rewrites the spec below it.** Each table gains an `x` and `y` and the graph a `canvas`. Copy that YAML back over the fence and the solver never runs again for this figure.
- This figure sets `layout: "auto"` and hands placement to a layered graph solver. Hand-placing ten tables is possible. Keeping it right after the schema changes is not.
- **The grid path stays for small figures.** Below roughly six tables a considered placement reads better than anything a solver produces. The solver optimises crossings, not meaning.
- **Density is the honest output.** If a figure like this is unreadable, that is a fact about the schema worth seeing, not a rendering bug to tune away.
- The solver only knows table-to-table edges. The column anchoring is applied afterwards, so auto-placement never costs you the row-level precision.

```erd erd/maintenance-schema
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

### A diff layer turns a schema into a review of one migration.

1. The cardinality figure after a migration that adds vendors.
1. A new `vendors` table and a new `vendor_id` column are green with a plus.
1. `addresses` and its relationship are red with a minus and a dashed line.
1. `messages.role` is amber. Its type changed and nothing else did.

#### Things to note

- **The keys are the ones hover and walkthroughs already use.** `table` marks a whole table, `table.column` one row, `from~to` a relationship. A table's mark flows down to every row in it, so a new table needs one key rather than one per column.
- **Signs, not colour alone.** Plus, minus and tilde sit beside the name, so the diff survives a projector, a printout, and a reader who does not separate red from green.
- **Hover still works, and a marked edge keeps its colour when lit.** Everything else goes white as usual. The change is the thing under review, so it is the one thing the highlight must not overwrite.
- **Show the schema after the change, marked, rather than two schemas side by side.** A removed table still draws, in red, so the reader sees what it was attached to. Two figures would make them find the difference themselves, which is the work the diff is there to do.

```erd erd/status-collapse
title: work orders gain a vendor — one migration as a diff
alt: >-
  The cardinality figure after a migration. A new vendors table and a new vendor_id column on work_orders are
  green with a plus, the addresses table and its relationship are red with a minus and a dashed line, and the
  role column on messages is amber because only its type changed.
diff:
  add:
    - vendors
    - wo.vendor_id
    - wo.vendor_id~vendors.id
  del:
    - addr
    - wo.id~addr.id
  mod:
    - msg.role
tables:
  - id: wo
    label: work_orders
    col: 1
    row: 1
    columns:
      - name: id
        type: text
        key: pk
      - name: vendor_id
        type: text?
        key: fk
        comment: Nullable for the first release, so existing orders migrate without a backfill.
      - name: title
        type: text
      - name: completed_at
        type: int?
  - id: vendors
    label: vendors
    col: 0
    row: 1
    columns:
      - name: id
        type: text
        key: pk
      - name: name
        type: text
      - name: phone
        type: text?
  - id: thread
    label: agent_threads
    col: 0
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: work_order_id
        type: text
        key: fk
  - id: msg
    label: messages
    col: 2
    row: 0
    columns:
      - name: id
        type: text
        key: pk
      - name: thread_id
        type: text
        key: fk
      - name: role
        type: enum
        comment: Was free text. Now one of user, agent or tool, enforced by a check constraint.
  - id: addr
    label: addresses
    col: 2
    row: 1
    columns:
      - name: id
        type: text
        key: pk
      - name: line1
        type: text
rels:
  - from: wo.vendor_id
    to: vendors.id
    fromCard: 0..N
    toCard: 0..1
  - from: wo.id
    to: thread.work_order_id
    fromCard: '1'
    toCard: 0..1
  - from: thread.id
    to: msg.thread_id
    fromCard: '1'
    toCard: 1..N
  - from: wo.id
    to: addr.id
    fromCard: 0..N
    toCard: 0..1
```

### An ERD spec is tables, columns and relationships, on a hand grid or handed to a solver.

- **Nothing is written on the lines. Anything a shape cannot say is a column comment.** A gloss like `at most one thread` is a fact about a column, the unique foreign key that makes it true, so it lives on that row and shows on hover. A column comment can just as well describe the column itself, a unit, a default, what null means. The panel opens above the table, the way a call graph docstring does, and a dotted underline marks a row that has one.
- `col` and `row` are grid slots, not pixels: the engine sizes each column to its widest table and each row to its tallest.
- A relationship end is `"table.column"`. Drop the column and the edge anchors on the table header instead.
- Cardinality strings are the four crow's-foot ends. Anything else falls back to `1`.

| spec reference — component 03 | |
| --- | --- |
| table | { id, label, columns:[…], col?, row?, x?, y? } |
| placement | `x`/`y` on any table pins every table exactly, which is what a dragged layout writes · `col`/`row` asks for a hand grid · neither, and dagre ranks the tables by their relationships |
| canvas | `[w, h]` to hold the frame a layout was arranged in · without it a pinned layout shrinks to fit its tables |
| column | { name, type?, key?:'pk'\|'fk', comment? } |
| comment | shown on hover or focus over the row, anchored above the table · a dotted underline under the name marks a row that has one · describes the column, a constraint such as on delete cascade, or whatever the shapes cannot carry |
| rel | { from:'table.column', to:'table.column', fromCard?, toCard?, tone?:'muted' } · no labels on the line |
| diff | { add?:[…], del?:[…], mod?:[…] } · keys are `table`, `table.column` or `from~to` · green with +, red with − and a dashed line, amber with ~ · a table's mark reaches its rows |
| cardinality | '1' · '0..1' · '1..N' · '0..N' |

**An edge leaves each table through a short straight stub, and a bezier joins the two stubs.** The crow's feet live on the stubs, so they sit flat against the table and read the same at every angle. Tables that overlap horizontally, including a table and itself, both exit right and the curve loops back. Because the curve is a function of its two endpoints alone, dragging a table redraws its edges with no router.
