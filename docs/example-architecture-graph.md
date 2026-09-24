---
create-date: 2026-09-15, 17:05:00
type: example
tags: [engdoc, example, box]
order: 11
---
# Example: Architecture graph

- **An architecture graph is boxes inside boxes, joined by arrows, one level above a call graph.** A grouping is a place, a component is a thing, and an arrow only ever joins two things. Hover anything to see what it talks to, and fold a grouping away with its eye.
- **A `box` fence is a tree of nodes and a list of edges.** A node with `children` is a grouping, a node with `fog` is a placeholder, and anything else is a component. The renderer infers the kind, lays each level out on its own, lets a dragged arrangement travel in the spec, and takes a `diff` block that colours what one change adds, removes or alters.

### An arrow joins two components. A grouping is only where they live.

- **Three strokes, three kinds.** A grouping is long-dashed and soft, with its title above its top-left corner. A component is a solid box with its label inside. Fog is the short dash a call graph already uses for the part of the stack the figure is not drawing. Nothing else distinguishes them, so a reader learns the code once.
- **Arrows start and end on leaves.** An edge that names a grouping is dropped and the canvas says so in red, because "Mobile uses Backend" is a sentence for the prose. The figure's job is to say which screen calls which route.
- **An arrow leaves the side that faces its target.** Sideways arrows leave the right or left edge and land on the facing edge. An arrow to a box below drops out of the bottom and lands on the top, so `Back` reaching the detail screen does not loop round the whole chat screen to get there.
- **Labels ride the curve.** A label sits at the midpoint of its arrow on a small halo, above a sideways arrow and beside a vertical one. It lights with the arrow and fades with it.
- **Fog keeps the figure at its argument.** The detail screen is not part of this story, so it is a dashed placeholder with one line of text, and the arrow into it says the story continues there rather than trailing off.

#### Things to note

- **Hover a component to light its arrows, in and out, and the boxes at their other ends.** One hop each way. A call graph walks callers transitively because that is its question; here the question is what this box touches.
- **Hover a grouping to light everything its children touch.** Point at the padding or the title of `Router` and every arrow into or out of either route lights together, which is how a grouping answers "what does this layer talk to" without an arrow of its own.
- **The eye on a title folds the grouping.** A veil covers the plate, the title stays readable, the children fade under it, and every arrow into or out of anything inside drops to almost nothing. Fold `Mobile` and the backend is suddenly the only thing on the canvas.
- **Folding is inherited, all the way down.** A grouping three levels deep goes quiet when its great-grandparent folds, and its own eye keeps whatever state it had for when the parent reopens. Nothing is saved; a reload is a clean graph.
- **Boxes drag, and a grouping drags its children.** A component moves inside its grouping's plate and stops at the edge. A grouping moves as one, children and all. Every arrow touching anything that moved redraws.
- **Dropping a box rewrites the spec below it.** Every node gains an `x` and a `y` relative to its parent, and the spec gains a `canvas`. Copy that YAML over the fence and the arrangement is what every reader sees.
- **Expand opens the graph on its own stage.** Same control as every canvas here, top right of the figure. Scroll to zoom, drag empty canvas to pan, Escape to come back.

```box box/work-orders wide
alt: >-
  Three dashed groupings left to right: Mobile, Backend and DB. Mobile holds a Chat screen grouping with
  Update, Create and Back, and a Detail screen grouping holding one fog placeholder. Backend holds a Router
  grouping with two routes and a Service grouping with three functions. DB holds one table. Arrows labelled
  "uses" run from the screen buttons to the routes, from the routes to the service functions, and from the
  service into the table.
nodes:
  - id: mobile
    label: Mobile
    flow: down
    children:
      - id: chat
        label: Chat screen
        children:
          - id: update
            label: Update
          - id: create
            label: Create
          - id: back
            label: Back
      - id: detail
        label: Detail screen
        children:
          - id: detail_fog
            fog: detail screen, covered in the mobile doc
  - id: backend
    label: Backend
    children:
      - id: router
        label: Router
        children:
          - id: post_transition
            label: |-
              POST /work-orders/
              {id}/transition
          - id: post_create
            label: POST /work-orders
      - id: service
        label: Service
        children:
          - id: get_wo
            label: get_work_order
          - id: create_wo
            label: create_work_order
          - id: transition
            label: do_transition
  - id: db
    label: DB
    children:
      - id: wo_table
        label: maintenance_workorder
edges:
  - from: update
    to: post_transition
    label: uses
  - from: create
    to: post_create
    label: uses
  - from: back
    to: detail_fog
  - from: post_transition
    to: get_wo
  - from: post_transition
    to: transition
  - from: post_create
    to: create_wo
  - from: get_wo
    to: wo_table
    label: reads
  - from: create_wo
    to: wo_table
    label: writes
  - from: transition
    to: wo_table
    label: writes
```

### Groupings nest as deep as the argument needs, and every level lays itself out.

- **Layout runs one level at a time.** The children of a grouping are laid out as plain boxes whose sizes are already known, with every arrow that crosses between two of them lifted to an edge between those two. The finished grouping is then one box to its own parent. Sibling groupings stay in clean columns, which a single solver over the whole tree does not manage, since it ranks by leaf and lets one grouping's children interleave with another's.
- **`flow: down` turns a grouping's arrows downward.** By default an arrow between two children puts the target to the right of its source, and children with no arrow between them stack in a column, which is why the three buttons in `Chat screen` sit one above the other. With `flow: down` an arrow puts its target below its source and unconnected children sit side by side. `Mobile` in the figure above flows down so the chat screen sits over the detail screen it navigates to, the way the screens sit on a phone.
- **A component label can take several lines.** Write a block scalar and the box grows a line per line, so a route or a long function name never forces a box wider than its column.
- **Leaves are always components or fog.** A grouping with nothing in it is not a grouping, so a node with an empty `children` list renders as a component. If a layer is not worth drawing inside, give it one fog child that says where it is covered.

```box box/nested wide
alt: >-
  One outer grouping, Platform, holding two groupings side by side. Ingest holds a Workers grouping with two
  components stacked in a column and a Queue component beside it. Search holds an Index component and a fog placeholder for the
  ranker. Arrows run from the workers into the queue, from the queue into the index, and from the index into
  the ranker.
nodes:
  - id: platform
    label: Platform
    children:
      - id: ingest
        label: Ingest
        children:
          - id: workers
            label: Workers
            children:
              - id: parse
                label: parse_upload
              - id: embed
                label: embed_chunks
          - id: queue
            label: Queue
      - id: search
        label: Search
        children:
          - id: index
            label: Index
          - id: ranker
            fog: ranker, covered in the search doc
edges:
  - from: parse
    to: queue
    label: enqueue
  - from: embed
    to: queue
  - from: queue
    to: index
    label: drain
  - from: index
    to: ranker
```

### A diff layer reviews one change against the graph it lands in.

- **Green added, red removed, amber changed.** A `diff` block lists node ids and `from~to` arrow keys under `add`, `del` and `mod`. Everything else draws as it always did, so the change reads against the shape it lands in rather than on its own.
- **Only the colour changes.** A grouping keeps its long dash, a component its solid stroke, fog its short dash. The dash says what kind of box it is and the hue says what happened to it, and the two never trade places.
- **A grouping's mark reaches everything inside it.** Adding `Notifications` adds the component it holds, so one key marks the layer and there is nothing to keep in step. An arrow is marked only by name, because two new boxes joined by an arrow that already existed is a real state and inheriting would paint over it.
- **A marked arrow keeps its colour when lit.** Hover `PATCH /work-orders/{id}` and its arrows go bright green rather than white, since the change is the thing under review. Fold a grouping and marked arrows fade like any other.
- **A key the graph does not have is an error.** The canvas says so in red, the way it does for an arrow into a grouping, so a mark that outlived a rename cannot pass silently.

```box box/work-orders-diff wide
alt: >-
  The work order graph from above with one change drawn over it. In the router, POST /work-orders/{id}/transition
  and its two arrows are red. A new PATCH /work-orders/{id} route and a new update_work_order service function
  are green, with green arrows from Update to the route, from the route to the function, and from the function
  into the table. A new Notifications grouping beside DB, holding notify_assignee, is green, reached by a green arrow
  from update_work_order. The arrow from get_work_order into the table is amber.
diff:
  add:
    - patch_wo
    - update_wo
    - notifications
    - update~patch_wo
    - patch_wo~update_wo
    - update_wo~wo_table
    - update_wo~notify
  del:
    - post_transition
    - update~post_transition
    - post_transition~get_wo
    - post_transition~transition
  mod:
    - get_wo~wo_table
nodes:
  - id: mobile
    label: Mobile
    children:
      - id: chat
        label: Chat screen
        children:
          - id: update
            label: Update
          - id: create
            label: Create
  - id: backend
    label: Backend
    children:
      - id: router
        label: Router
        children:
          - id: post_transition
            label: |-
              POST /work-orders/
              {id}/transition
          - id: patch_wo
            label: PATCH /work-orders/{id}
          - id: post_create
            label: POST /work-orders
      - id: service
        label: Service
        children:
          - id: get_wo
            label: get_work_order
          - id: update_wo
            label: update_work_order
          - id: create_wo
            label: create_work_order
          - id: transition
            label: do_transition
  - id: db
    label: DB
    children:
      - id: wo_table
        label: maintenance_workorder
  - id: notifications
    label: Notifications
    children:
      - id: notify
        label: notify_assignee
edges:
  - from: update
    to: post_transition
    label: uses
  - from: update
    to: patch_wo
    label: uses
  - from: create
    to: post_create
    label: uses
  - from: post_transition
    to: get_wo
  - from: post_transition
    to: transition
  - from: patch_wo
    to: update_wo
  - from: post_create
    to: create_wo
  - from: get_wo
    to: wo_table
    label: reads
  - from: update_wo
    to: wo_table
    label: writes
  - from: create_wo
    to: wo_table
    label: writes
  - from: transition
    to: wo_table
    label: writes
  - from: update_wo
    to: notify
```

### Three strokes carry the three kinds, and nothing else does.

- **Long dash, solid, short dash.** Grouping, component, fog. Weight and colour stay out of it, so a diff layer or a walkthrough can use them later without colliding with the kind.
- **Fog looks like a folded box on purpose.** Both mean the figure is not showing what is in here. One is the author's decision and the other is the reader's, and they read the same way.
- **A grouping's title sits outside its plate.** The veil covers the plate when the grouping folds, and the title stays where it was, so a folded grouping is still named without the veil having to say so twice.

```box box/kinds
alt: >-
  Side by side: a long-dashed grouping titled Grouping holding two solid components, a solid component
  labelled Component, and a short-dashed italic fog placeholder.
nodes:
  - id: grouping
    label: Grouping
    children:
      - id: a
        label: one
      - id: b
        label: two
  - id: component
    label: Component
  - id: fog
    fog: fog placeholder
edges:
  - from: b
    to: component
  - from: component
    to: fog
```
