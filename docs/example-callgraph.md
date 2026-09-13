---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, cg]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 9
---
# Example: Call graph

- **A call graph answers who calls this, which no other figure here can.** Files are boxes, functions are rows, and hovering a row lights everyone who reaches it, transitively.
- **A `cg` fence is files and calls.** Fan-in, folding, a fog node for what the figure does not draw, and a diff layer for reviewing one change all come from the same spec shape, and a `walk` fence can step a use case through the graph.

### A call graph answers who calls this, which no other figure here can.

- **A box is a file and a row is a function.** The title is the filename, so a reader who wants the code already has the path. Nothing in a row says what the function does, because a call graph is about reach rather than behaviour.
- **Public functions sit above private ones.** A thin rule marks the seam, and a leading underscore is the only thing that puts a function below it. The renderer does the sort, so two boxes never disagree about where the entry points are.
- **An arrow reads as A calls B.** The tail leaves the right edge of the calling function. The head enters the left edge of the box that owns the function being called. Every head lands on the same side, so a reader learns the direction once.
- **A call inside one file stays inside its box.** Sending it out the right edge and back in on the left would loop it around the whole box, across every row on the way, to say something as small as a helper being called. It hops down a lane at the right edge instead, and the head turns back into the row.
- **Internal calls share one lane.** Two calls out of one row run down the same column and overlap wherever their paths agree, and they part when one of them turns off. The box reserves a single fixed strip for the lane, so it is wider than the name in it needs but never grows with the number of calls.
- **Arrows are drawn over the boxes at low opacity.** A graph with real fan-in cannot be routed without crossings, and the effort spent avoiding them buys less than it costs. The lines are faint enough to read text through.
- **Boxes drag.** Placement is a solver's guess about a graph it has never read. Drag a box and every arrow touching it redraws, which is the quickest way to pull apart the one knot that matters to the argument.

#### Things to note

- **Hover a row to see everything that reaches it.** The row lights up along with every caller above it and the arrows on those paths, and the rest of the graph fades. Try `_mark_partial`, which is three hops below the entry point.
- **The bar in the gutter is size, relative to the file it is in.** Full means the largest function in that box. Size only means anything against its neighbours, so the bar is never normalised across the whole graph, and a small file does not look like a small amount of code.
- **Rows are sorted biggest first inside each half.** Public functions are ordered by size, then private ones are ordered by size. A reader looking for where the work sits finds it at the top of each list rather than wherever the file happens to define it.
- **A graph too wide for its column scrolls.** One CSS pixel per unit, so the text never shrinks to fit. Every call graph on the page sets at the same size, which is what makes two of them comparable, and a wide section is the way to avoid the scroll entirely.
- **Expand opens the graph on its own stage.** The control sits at the top right of every call graph figure. Scroll to zoom about the pointer, drag the empty canvas to pan, fit to see all of it, Escape to come back. Positions and folded boxes come back with it, because the same drawing is moved rather than a copy of it.
- **Boxes still drag on the stage, at any zoom.** Zoom sets the drawing's width rather than transforming it, so the screen to canvas conversion stays true and the drag code never learns that zoom exists. A press on a box moves the box, a press on empty canvas moves the view.
- **A file can carry one too, on its header.** Keyed by the bare file id, the same key a diff or a walkthrough uses to mean the whole file, so there is still one addressing scheme. Hover the filename to read what the file is for before reading what is in it.
- **Any call graph can be walked through.** Rows and calls carry keys, so a walkthrough lights them step by step like any other figure. One walks the graph under `cg/ingest` below, and `walk/upload-path` in [[example-walkthrough]] walks this one.
- **A row can carry its docstring.** Hover one with a dotted underline to read it. Worth adding where the name alone misleads, like `find_group` returning nothing for a missing id rather than for a missing group. Rows whose names already say it stay undecorated.
- **Dragging a callee left of its caller still reads.** The curve loops back on itself rather than pointing the wrong way, because the attachment rule never changes.
- **Dropping a box rewrites the spec below it.** The `view spec` panel gains an `x` and a `y` for every file and a `canvas` for the frame. Copy that YAML back over the fence and the arrangement is what every reader sees, on the same link, with nothing saved anywhere at runtime.

```cg cg/upload
docs:
  upload_service: >-
    Owns the boundary between a finished upload and the pipeline. Everything that decides whether an upload is
    processable lives here.
  group_store: Reads and writes UploadGroup rows. Knows nothing about S3 or workflows.
  storage: S3 key construction and byte movement. The only file here that talks to a bucket.
  workflows: A thin wrapper over the Temporal client, one function per workflow the API can start.
  upload_service.complete_upload_request: >-
    Entry point for a finished upload. Stages the bytes, places the segment in its group, and starts the
    workflow once the group is complete.
  upload_service._resolve_group: >-
    Find the UploadGroup this segment belongs to and attach it. Returns nothing when the segment arrived
    without a group_id.
  upload_service._skip_processing: >-
    Set skip_processing on the upload and return. Nothing downstream picks it up again, so a segment that
    lands here is orphaned until someone re-runs it by hand.
  group_store.find_group: >-
    Look up an UploadGroup by group_id. Returns nothing when the id is missing or unknown, which is not the
    same as the group not existing.
  group_store._mark_partial: Hold the group at PARTIAL until every expected segment has landed.
metrics:
  upload_service.complete_upload_request:
    lines: 74
  upload_service._resolve_group:
    lines: 41
  upload_service._skip_processing:
    lines: 9
  group_store.find_group:
    lines: 22
  group_store.attach_segment:
    lines: 35
  group_store._mark_partial:
    lines: 14
  storage.stage_upload:
    lines: 48
  storage._object_key:
    lines: 11
  workflows.start_process_new_upload:
    lines: 18
alt: >-
  Four file boxes joined by call arrows. upload_service.py sits on the left and reaches storage.py,
  group_store.py and workflows.py. Each box lists its public functions above a rule and its
  underscore-prefixed private ones below it, biggest first, with a muted size bar in the left gutter of every
  row.
files:
  - id: upload_service
    name: upload_service.py
    fns:
      - complete_upload_request
      - _resolve_group
      - _skip_processing
  - id: group_store
    name: group_store.py
    fns:
      - find_group
      - attach_segment
      - _mark_partial
  - id: storage
    name: storage.py
    fns:
      - stage_upload
      - _object_key
  - id: workflows
    name: workflows.py
    fns:
      - start_process_new_upload
calls:
  - from: upload_service.complete_upload_request
    to: storage.stage_upload
  - from: upload_service.complete_upload_request
    to: upload_service._resolve_group
  - from: upload_service.complete_upload_request
    to: upload_service._skip_processing
  - from: upload_service.complete_upload_request
    to: workflows.start_process_new_upload
  - from: upload_service._resolve_group
    to: group_store.find_group
  - from: upload_service._resolve_group
    to: group_store.attach_segment
  - from: group_store.attach_segment
    to: group_store._mark_partial
  - from: storage.stage_upload
    to: storage._object_key
```

### Fan-in is what to look at before changing a shared function.

- **One row with many arrows into it is the whole argument.** Four files reach `decode_frame` here. Hover it and the graph names them, which beats asking a reader to trace four lines back by eye.
- **A caller two hops away still lights.** `run_checklist` never calls `decode_frame` directly. It arrives through a private helper in its own file, and the highlight walks the chain instead of stopping at one edge.
- **Keep the graph to the files the argument needs.** A call graph of a whole service is a picture of a service, not an argument. Four or five boxes is usually the honest size, and anything larger is a tool's output pasted into a document.
- **An arrow is a call site, not a call.** The graph cannot say how often a path runs. A hot loop and a path taken once a month look the same here, so if the frequency is the point, the prose has to carry it.

```cg cg/fan-in
alt: >-
  One frames.py box reached by arrows from four other files. Three call decode_frame directly and the fourth
  arrives through a private helper in its own file.
files:
  - id: thumbs
    name: thumbnails.py
    fns:
      - build_thumbnail
  - id: clip
    name: clip_index.py
    fns:
      - index_video
  - id: qc
    name: qc_checks.py
    fns:
      - run_checklist
      - _sample_frames
  - id: export
    name: export.py
    fns:
      - render_report
  - id: frames
    name: frames.py
    fns:
      - decode_frame
      - _open_reader
calls:
  - from: thumbs.build_thumbnail
    to: frames.decode_frame
  - from: clip.index_video
    to: frames.decode_frame
  - from: qc.run_checklist
    to: qc._sample_frames
  - from: qc._sample_frames
    to: frames.decode_frame
  - from: export.render_report
    to: frames.decode_frame
  - from: frames.decode_frame
    to: frames._open_reader
```

### Folding a box away is how a big graph stays readable.

- **The eye in each header collapses that box.** A veil takes its place carrying the filename at whatever size fits, and every arrow touching it drops to almost nothing. The box is still there, still placed, still draggable.
- **It says I know what this is, not this does not matter.** Try folding `work_tracker/user_service.py`. Its arrows all point in, so nothing downstream of the argument is lost and the ingest path is suddenly the only thing on the canvas.
- **A collapsed box borrows the fog node's dashes on purpose.** Both mean the same thing to a reader, that the figure is not showing what is in here. One is the author's decision and the other is the reader's.
- **Nothing is saved.** Collapse lives in a class on the box the way position lives in its transform, so a reload is a clean graph. What travels is the spec, and the spec has no idea any of this happened.
- **A box is the unit for now.** Every box here is a group of one. `user_service.py` has arrows only in and the fixture has arrows only out, which is what makes each of them a boundary worth naming. Folding several files into one named group is the same control over a bigger unit.

```cg cg/ingest wide
docs:
  fixture: >-
    A management command that seeds work orders from a saved Entrata payload. Development only, and the only
    entry point in this figure.
  io: >-
    The ingest boundary for externally sourced work orders. Owns the transaction that turns a payload into
    rows.
  payloads: Read only views over an Entrata API payload. No database access, so it is safe to call from anywhere.
  users: Every read and write of a user row goes through here. Callers never touch the model directly.
alt: >-
  Five boxes. A management command on the left reaches the work order ingest service, which reaches a payload
  class, a user service whose arrows all point in, and a dotted fog node standing for the location service.
  Every box carries an eye control in its header for folding it away.
metrics:
  fixture.Command.handle:
    lines: 46
  fixture.Command.add_arguments:
    lines: 22
  fixture.Command._seed:
    lines: 61
  fixture.Command._report:
    lines: 18
  io.ingest_work_orders:
    lines: 88
  io.upsert_ingested_work_order:
    lines: 54
  io._resolve_assignee:
    lines: 37
  io._record_ingest_outcome:
    lines: 20
  payloads.EntrataApiWorkOrder.to_input:
    lines: 52
  payloads.EntrataApiWorkOrder.unit_reference:
    lines: 14
  payloads._EntrataPayload._lift_attributes:
    lines: 29
  users.find_organization_user_by_email:
    lines: 26
  users.list_organization_users_by_external_ids:
    lines: 31
  users.link_user_external_id:
    lines: 19
  users._update_user_external_id:
    lines: 12
files:
  - id: fixture
    name: create_work_orders_from_entrata_api_fixture.py
    fns:
      - Command.handle
      - Command.add_arguments
      - Command._seed
      - Command._report
  - id: io
    name: work_order_external_io_service.py
    fns:
      - ingest_work_orders
      - upsert_ingested_work_order
      - _resolve_assignee
      - _record_ingest_outcome
  - id: payloads
    name: entrata_api_work_order_payloads.py
    fns:
      - EntrataApiWorkOrder.to_input
      - EntrataApiWorkOrder.unit_reference
      - _EntrataPayload._lift_attributes
  - id: users
    name: work_tracker/user_service.py
    fns:
      - find_organization_user_by_email
      - list_organization_users_by_external_ids
      - link_user_external_id
      - _update_user_external_id
  - id: locations
    fog: location_service and the organization agent user, untouched
calls:
  - from: fixture.Command.handle
    to: fixture.Command._seed
  - from: fixture.Command.handle
    to: fixture.Command._report
  - from: fixture.Command._seed
    to: io.ingest_work_orders
  - from: io.ingest_work_orders
    to: payloads.EntrataApiWorkOrder.to_input
  - from: io.ingest_work_orders
    to: io.upsert_ingested_work_order
  - from: io.ingest_work_orders
    to: io._record_ingest_outcome
  - from: io.upsert_ingested_work_order
    to: io._resolve_assignee
  - from: io._resolve_assignee
    to: users.find_organization_user_by_email
  - from: io._resolve_assignee
    to: users.list_organization_users_by_external_ids
  - from: io._resolve_assignee
    to: locations
  - from: payloads.EntrataApiWorkOrder.to_input
    to: payloads._EntrataPayload._lift_attributes
  - from: users.link_user_external_id
    to: users._update_user_external_id
```

### A walkthrough steps a use case through the graph above, one file at a time.

- **A step lights any number of keys.** The `focus` array has no ceiling. One row, both ends of a call, or four files and every call between them all cost the same to write, and everything named lights together.
- **A bare file id lights everything in that file.** Its rows, and the calls leaving it, because an edge key starts with the name of the function that makes the call. Step one is a single key doing the work of seven.
- **Two grains, one kind of figure.** `walk/upload-path` in [[example-walkthrough]] walks a call graph function by function. This one walks a use case file by file. Only the spec differs, and the renderer never learns which is happening.
- **A step can say what goes in, what comes out, and what is touched on the side.** Notes in the sticky colour appear only while their step is current. In is pinned to the head where the call arrives and out to the tail where the result comes back, each with a leader to the exact point. A side effect hangs off its file as a small glyph, a cylinder for a store. None of it is part of the graph, so none of it dims or survives the step.
- **Fog takes part like anything else.** Step six lights the location service the figure deliberately does not draw, which is how a walkthrough says the story continues past the edge of the frame rather than stopping.

```walk walk/ingest-use-case wide
kind: cg
base: cg/ingest
steps:
  - focus:
      - fixture
    note: >-
      The use case starts as a management command. One key lights the whole file, every function in it and
      every call leaving it.
  - focus:
      - fixture.Command._seed~io.ingest_work_orders
      - io.ingest_work_orders
    io:
      call: fixture.Command._seed~io.ingest_work_orders
      in: raw Entrata payloads and the organization
      out: a count of created and skipped orders
    note: Seeding calls into the ingest service. From here the command is done deciding anything.
  - focus:
      - io.ingest_work_orders~payloads.EntrataApiWorkOrder.to_input
      - payloads
    io:
      call: io.ingest_work_orders~payloads.EntrataApiWorkOrder.to_input
      in: one raw payload dict
      out: a WorkOrderInput, or a validation error
    note: >-
      Each raw payload is turned into an input. The payload file lights whole, because at this grain what
      matters is that the work happens there and not which method does it.
  - focus:
      - io.ingest_work_orders~io.upsert_ingested_work_order
      - io.upsert_ingested_work_order
      - io.upsert_ingested_work_order~io._resolve_assignee
      - io._resolve_assignee
    io:
      call: io.ingest_work_orders~io.upsert_ingested_work_order
      in: a WorkOrderInput
      out: the saved WorkOrder
    effects:
      - at: io
        kind: db
        text: writes work_orders
    note: The upsert runs and needs an assignee, so two rows and the two calls between them light at once.
  - focus:
      - io._resolve_assignee~users.find_organization_user_by_email
      - io._resolve_assignee~users.list_organization_users_by_external_ids
      - users.find_organization_user_by_email
      - users.list_organization_users_by_external_ids
    io:
      call: io._resolve_assignee~users.find_organization_user_by_email
      in: an email from the payload
      out: a User, or nothing
    effects:
      - at: users
        kind: db
        text: reads users
    note: >-
      Resolving an assignee is two lookups into the user service, by email and by external id. Both calls and
      both rows are one step, because they are one decision.
  - focus:
      - io._resolve_assignee~locations
      - locations
    note: >-
      The same resolve reaches the location service, which this figure deliberately does not draw. A step can
      light the fog too, which is how the story keeps going past the edge of the frame.
  - focus:
      - io.ingest_work_orders~io._record_ingest_outcome
      - io._record_ingest_outcome
      - fixture.Command.handle~fixture.Command._report
      - fixture.Command._report
    effects:
      - at: io
        kind: db
        text: writes ingest_outcomes
    note: >-
      The outcome is recorded and the command reports it. Two files light together because the last step of
      the use case happens in both.
```

### A fog node marks the part of the stack the figure is not drawing.

- **Naming the edge of the figure is better than letting it trail off.** An arrow that leaves for nowhere reads as an oversight. A dotted box saying `Temporal worker, covered in the pipeline doc` reads as a decision, and tells the reader where to go next.
- **Dotted border, italic, muted, and no functions.** Everything about it says this is not a file. A reader never has to wonder whether it is a real box whose function list someone forgot to fill in.
- **It is a box, so the solver ranks it.** Fog on the left lands left of what it calls and fog on the right lands after it, which is what makes the figure read as one flow rather than a graph with loose ends pinned to it.
- **Edges reach it by its bare id.** There is no function to name, so a call names the node itself and lands on its middle. Hovering a row lights a fog node in the chain like any other step.
- **Use it to keep a graph at four or five boxes.** Most graphs get too big because the argument has no edge, not because the code is complicated. A fog node is where you draw that edge and say so.

```cg cg/fog
alt: >-
  A four box call graph whose first and last boxes are dotted and italic. Callers arrive from a fog box on the
  left, pass through upload_service.py and workflows.py, and the chain leaves into a fog box on the right
  standing for the Temporal worker.
files:
  - id: callers
    fog: 3 other call sites in the ingest app
  - id: upload_service
    name: upload_service.py
    fns:
      - complete_upload_request
      - _resolve_group
  - id: workflows
    name: workflows.py
    fns:
      - start_process_new_upload
  - id: worker
    fog: Temporal worker, covered in the pipeline doc
calls:
  - from: callers
    to: upload_service.complete_upload_request
  - from: upload_service.complete_upload_request
    to: upload_service._resolve_group
  - from: upload_service.complete_upload_request
    to: workflows.start_process_new_upload
  - from: workflows.start_process_new_upload
    to: worker
```

### A diff layer turns the same graph into a review of one change.

- **Green added, amber changed, red removed.** Amber is for a call that survived the change with different arguments or a different guard. It still joins the same two functions, so moving it or dropping it would be a lie about what happened.
- **A removed function is still drawn.** A diff has to show what left, so `_skip_processing` and the call into it are on the canvas in red. Delete them and the figure becomes a picture of the new code rather than a review of the change.
- **Every mark carries a sign as well as a colour.** Plus, tilde and minus down the right edge, and three dash patterns on the lines. A diff is the figure most likely to end up on a projector or printed to grey, which is exactly where colour alone stops working.
- **The diff is a layer, not a property of a function.** It sits in its own block keyed the same way a walkthrough keys its focus, so one graph can be shown plain, walked through, or reviewed without three copies of the file list.
- **Five blocks carry how big the change is and what kind.** How many are lit is the size of the change against the biggest one in the graph. The green to red split inside them is the ratio of added to removed. A row that both added and removed always lights at least two, so a mixed change never reads as purely additive.
- **Hover keeps the diff colour.** Tracing back from a green row lights the chain in white and leaves the green row green, because pointing at something does not stop it being an addition.

```cg cg/diff
metrics:
  upload_service.complete_upload_request:
    lines: 74
    added: 6
    removed: 11
  upload_service._resolve_group:
    lines: 52
    added: 24
    removed: 3
  upload_service._skip_processing:
    lines: 9
    removed: 9
  group_store.find_group:
    lines: 22
    added: 2
    removed: 2
  group_store.find_group_by_index:
    lines: 19
    added: 19
  group_store.attach_segment:
    lines: 35
  group_store._mark_partial:
    lines: 14
alt: >-
  The upload path after a fix. A new find_group_by_index row and the call to it are green with a plus. The
  call into find_group is amber and dotted because its arguments changed. The _skip_processing row and the
  call to it are red with a minus and a dashed line.
diff:
  add:
    - group_store.find_group_by_index
    - upload_service._resolve_group~group_store.find_group_by_index
  mod:
    - upload_service._resolve_group~group_store.find_group
  del:
    - upload_service._skip_processing
    - upload_service.complete_upload_request~upload_service._skip_processing
files:
  - id: upload_service
    name: upload_service.py
    fns:
      - complete_upload_request
      - _resolve_group
      - _skip_processing
  - id: group_store
    name: group_store.py
    fns:
      - find_group
      - find_group_by_index
      - attach_segment
      - _mark_partial
calls:
  - from: upload_service.complete_upload_request
    to: upload_service._resolve_group
  - from: upload_service.complete_upload_request
    to: upload_service._skip_processing
  - from: upload_service._resolve_group
    to: group_store.find_group
  - from: upload_service._resolve_group
    to: group_store.find_group_by_index
  - from: upload_service._resolve_group
    to: group_store.attach_segment
  - from: group_store.attach_segment
    to: group_store._mark_partial
```

### A call graph spec is files and calls.

- **A function is named by file id and function name.** Every call refers to `fileId.fn`, the same shape a table cell uses for its row and column, so one addressing rule covers both components.
- **Order inside `fns` barely matters.** The renderer puts public before private and keeps the given order inside each group, so listing functions in definition order is fine.
- **Placement is dagre's job by default.** Ranks come out of the calls, so a caller lands left of what it calls. An `x` and `y` on any file take the graph over completely, and a `col` or `row` asks for a hand grid in between.

| spec reference — component 06 | |
| --- | --- |
| graph | { alt?, canvas?, files:[…], calls:[…] } |
| file | { id, name, fns:[…] } · `id` is the handle calls refer to, `name` is the filename shown |
| fog | { id, fog: "what is out there" } · a dotted box for a part of the stack the figure is not drawing · no `name`, no `fns`, and calls reach it by bare `id` |
| placement | `x`/`y` on any file pins every box exactly, which is what a dragged layout writes · `col`/`row` asks for a hand grid instead · neither, and dagre ranks the files by their calls |
| canvas | `[w, h]` to hold the frame a layout was arranged in · without it a pinned layout shrinks to fit its boxes |
| call | { from: "fileId.fn", to: "fileId.fn" } · a bare `fileId` anchors to the box header |
| private | a leading underscore on a function name, which is what drops the row below the seam and fades it · the fade is an opacity, so it survives every tint a diff or a highlight puts on top |
| metrics | { "fileId.fn": { lines, added?, removed? } } · `lines` draws the size bar and sorts each half · `added`/`removed` draw the five change blocks · a row with no change draws no blocks |
| docs | { "fileId": "what the file is for", "fileId.fn": "one or two sentences" } · a dotted underline on the name, and the text on hover or focus · a bare id documents the file on its header · optional per entry |
| diff | { add?:[keys], mod?:[keys], del?:[keys] } · green, amber, red · the same keys as below |
| walkthrough keys | `fileId.fn` for one row · `fileId` for every row in a file · `from~to` for a call |

The box plate, the header rule and the filename carry no key, so a walkthrough that dims what it is not focusing leaves the chrome alone.
