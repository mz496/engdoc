---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, walk]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 5
---
# Example: Walkthrough

- **A walkthrough scrubs through any figure step by step.** It dims what is not yet reached, half-lights what is done, and carries a caption for the current step.
- **A `walk` fence names a base figure by slug and lists what each step lights.** The base fence has to be in the same document, so each walkthrough below is followed by the figure it plays. A walkthrough with `panels` plays several figures at once and can rewrite table cells as it goes.

### Dragging the scrubber plays the diagram, dimming what is not yet reached and half-lighting what is done.

1. Six steps over `seq/stream-lifecycle`.
1. Dimmed, not reached yet. Half-lit, already happened.
1. Solid. What this step is about.
1. Arrow keys step. The caption carries the narration.

#### Things to note

- **Structure never dims.** Lifelines, actor boxes and frames carry no step key, so the stage you are reading against stays lit the whole way through, and only the traffic is revealed a step at a time.
- **The same wrapper drives every component.** Renderers tag their parts. The walkthrough only decides which keys are past, present, or unreached. It has no idea which kind of figure it is playing.
- A step can focus nothing. Step 4 here is the moment the stream dies, where the point is what stops rather than what fires.

```walk walk/chat-turn
kind: seq
base: seq/stream-lifecycle
steps:
  - focus:
      - m0
    note: The client posts the turn straight to Mastra. Nothing is polling yet, because the stream has not opened.
  - focus:
      - m1
    note: The stream opens. It exists now, which is why its box appears here rather than at the top.
  - focus:
      - m2
    note: Tokens paint live. This is the only delivery channel while it holds.
  - focus: []
    note: >-
      The stream is lost, whether backgrounded, cut, or silent. Its lifeline stops at the ✕ and everything
      else keeps running.
  - focus:
      - m3
      - m4
    note: The client falls back to the transcript. One GET, one persisted turn.
  - focus:
      - s0
    note: >-
      In parallel, the run never noticed. It keeps generating and persists at its own pace, which is what
      makes the fallback safe.
```

```seq seq/stream-lifecycle
title: Chat turn — a stream that is born and dies
autonumber: true
spacing: 200
actors:
  - id: cli
    label: Client
  - id: sse
    label: SSE stream
  - id: mas
    label: Mastra
steps:
  - type: divider
    label: ATTACHED · the stream is the only delivery channel
  - type: msg
    kind: sync
    from: cli
    to: mas
    label: POST /stream-ag-ui
  - type: create
    actor: sse
  - type: msg
    kind: async
    from: mas
    to: sse
    label: open · events begin
  - type: msg
    kind: async
    from: sse
    to: cli
    label: tokens painted live
  - type: divider
    label: LOST · backgrounded, cut, or silent
  - type: destroy
    actor: sse
  - type: block
    kind: par
    sections:
      - label: client polls the transcript
        steps:
          - type: msg
            kind: sync
            from: cli
            to: mas
            label: GET transcript
            activate: false
          - type: msg
            kind: return
            from: mas
            to: cli
            label: persisted turn
            deactivate: false
      - label: the run never noticed
        steps:
          - type: self
            actor: mas
            label: keeps generating · persists at its own pace
```

### A flowchart walkthrough traces one path through the decisions.

1. Eight steps through `flow/poll-window`.
1. Each step lights a node and the edge that reached it.
1. Steps 4 and 5 fork: the reconcile exit, then the deadline question.
1. The loop-back and the failed exit are their own steps.

#### Things to note

- **This is the flowchart's version of reading it aloud.** A static flowchart shows every path at once. The scrubber commits to one at a time, which is how anyone actually explains it.
- **Branches are steps, not animation.** Stepping past the reconcile exit and into the deadline question is exactly the reader asking "and if the copy is not there?"
- Because focus is a list, a step can light a node and its incoming edge together. The arrival, not just the arrival point.

```walk walk/poll-window
kind: flow
base: flow/poll-window
steps:
  - focus:
      - rest
    note: At rest the window is closed and the screen issues zero requests.
  - focus:
      - rest~fetch
      - fetch
    note: A lost stream stamps the deadline, which opens the window. Polling starts.
  - focus:
      - fetch~q1
      - q1
    note: 'Every landed fetch asks the first question: is the persisted copy in this payload?'
  - focus:
      - q1~rec
      - rec
    note: If it is, reconcile and exit. The deadline is never even consulted.
  - focus:
      - q1~q2
      - q2
    note: If not, the second question is the only place the stamp's value is read.
  - focus:
      - q2~fetch
    note: 'Before the deadline: keep waiting. The run may still be generating, so loop and ask again in 2s.'
  - focus:
      - q2~fail
      - fail
    note: 'Past it: nothing is coming. The user message flips to retry.'
  - focus:
      - fail~done
      - done
    note: Either exit closes the window and the screen goes quiet again.
```

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

### An ERD walkthrough follows the keys instead of a clock.

1. Four steps over the schema in `erd/photo-store`.
1. Start at the parent, then bring in each child that references it.
1. The last step lights both keys at once.
1. Order here is an argument, not a timeline.

#### Things to note

- **Nothing about the wrapper assumes time.** An ERD has no chronology, so the steps carry a reading order instead. Parent first, then who points at it, then the shared consequence.
- **This is the cheapest schema review there is.** Each step is a sentence someone can disagree with, and disagreement lands on one relationship rather than the whole diagram.
- The final step is the payoff: both foreign keys landing on `photos.id` is the visual form of "delete the photo and both cascades fire".

```walk walk/photo-store
kind: erd
base: erd/photo-store
steps:
  - focus:
      - photos
    note: photos is the parent, one row per captured image, and the only place the bytes are indexed.
  - focus:
      - pos
      - r0
    note: A proof-of-service item references a photo by id. Many memberships, one photo.
  - focus:
      - wop
      - r1
    note: >-
      A work order references the same table the same way, which is what makes photos shared rather than
      duplicated.
  - focus:
      - r0
      - r1
    note: Both keys land on photos.id. Delete the photo and both cascades fire.
```

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

### A walkthrough can hold any combination of atoms, and a step can rewrite what is in them.

- **There is no composite type.** A walkthrough takes a list of panels, and one panel is the same code path as six. Any atom in this library can sit in that list, because the only thing a panel owes the wrapper is to tag its parts.
- **A step can write values, not only light them.** A `set` map puts new text in named cells, so the flowchart moves and the row changes on the same step, which is what actually happens in the system being described.
- **Writes accumulate and rewind.** Step five shows what steps one through five wrote. Scrubbing backwards restores the earlier values instead of leaving the last one behind.
- **Keys are bare or panel-qualified.** A bare key matches in every panel, which is why every walkthrough written before panels existed still works. Prefix a key with a panel id when two panels use the same name.
- **Column widths are computed from every value a step will ever write.** The wrapper collects them before laying the table out, so the grid never reflows mid-scrub.

#### Things to note

- **This is the pairing worth reaching for most often.** A flowchart says what the code decides and a table says what the decision did to the data. Either one alone leaves the reader joining them in their head.
- **Focusing a row lights its cells for free.** Keys prefix-match on the dot, so a step names the row and the cells follow.

```walk walk/run-window
panels:
  - kind: flow
    base: flow/poll-window
    id: flow
    label: what the code decides
  - kind: tbl
    base: tbl/agent-runs
    id: db
    label: what the row holds
steps:
  - focus:
      - rest
      - db:run
    note: At rest the row says idle and the screen issues no requests. Nothing is polling and nothing is stamped.
  - focus:
      - rest~fetch
      - fetch
      - db:run.deadline
    set:
      db:run.deadline: 17:04:12+00
    note: A lost stream stamps the deadline. That single write is what opens the window.
  - focus:
      - fetch~q1
      - q1
      - db:run.state
    set:
      db:run.state: generating
    note: >-
      The first question asks whether the persisted copy is in the payload. The run is still generating, so it
      is not.
  - focus:
      - q1~q2
      - q2
      - db:run.deadline
    note: Not there, so the second question reads the stamp. This is the only place its value is ever used.
  - focus:
      - q2~fetch
      - db:run.turns
    set:
      db:run.turns: '4'
    note: Before the deadline the loop waits. The run persists another turn while it does.
  - focus:
      - fetch~q1
      - q1
      - db:run.state
    set:
      db:run.state: done
    note: The next fetch lands after the run finished, so this time the persisted copy is there.
  - focus:
      - q1~rec
      - rec
      - db:run
    set:
      db:run.deadline: ''
    note: Reconcile and exit. The stamp is cleared, the row and the screen agree, and the window closes.
```

```tbl tbl/agent-runs
label: agent_runs
alt: An agent_runs table with one row whose state and deadline columns are filled in as a walkthrough proceeds.
columns:
  - name: id
    type: int
    key: pk
  - name: thread_id
    type: int
    key: fk
  - name: state
    type: text
  - name: deadline
    type: timestamptz
  - name: turns
    type: int
rows:
  - id: run
    cells:
      - '9'
      - '88'
      - idle
      - ''
      - '3'
```

### A call graph walkthrough traces one request through the files.

- **A call is a step, so a call needs a key.** Edges are keyed `from~to`, the same shape the flowchart uses, and the tilde keeps them clear of the dot-prefix matching that rows rely on.
- **The order is the reader's, not the solver's.** Placement puts callers left of what they call. A walkthrough is free to visit the branches in whatever order the argument needs, and here the failing branch comes last.
- **Hover stands down inside a walkthrough.** The scrubber owns what is lit. Two focus systems writing opacity on the same rows would read as a bug, so only dragging stays live in here.
- **Boxes still drag mid-walkthrough.** Untangling a crossing does not lose the step you are on, because position and focus are separate pieces of state.

```walk walk/upload-path
kind: cg
base: cg/upload
steps:
  - focus:
      - upload_service.complete_upload_request
    note: >-
      One request lands in one function. Every file below it is reached from here, which is the claim a call
      graph is making.
  - focus:
      - upload_service.complete_upload_request~storage.stage_upload
      - storage.stage_upload
      - storage.stage_upload~storage._object_key
      - storage._object_key
    note: >-
      The bytes are staged first. That call never leaves storage.py, so it hops down the lane inside the box
      instead of going out and around.
  - focus:
      - upload_service.complete_upload_request~upload_service._resolve_group
      - upload_service._resolve_group
    note: >-
      Then the segment has to be placed in its group. The work is private to upload_service.py, so it sits
      below the rule.
  - focus:
      - upload_service._resolve_group~group_store.find_group
      - group_store.find_group
    note: >-
      The lookup needs a group_id. A segment that arrived without one finds nothing here, and that is the
      whole bug.
  - focus:
      - upload_service._resolve_group~group_store.attach_segment
      - group_store.attach_segment
      - group_store.attach_segment~group_store._mark_partial
      - group_store._mark_partial
    note: With a group, the segment attaches and the group is marked partial until its siblings land.
  - focus:
      - upload_service.complete_upload_request~upload_service._skip_processing
      - upload_service._skip_processing
    note: >-
      Without one, the other branch runs instead. This is the call that produced the orphaned row in
      tbl/json-cols.
  - focus:
      - upload_service.complete_upload_request~workflows.start_process_new_upload
      - workflows.start_process_new_upload
    note: >-
      Only the first path reaches the workflow. Hover any row after the walkthrough ends to read the same
      graph backwards.
```

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

### A walkthrough spec is a base figure plus an ordered list of what to light.

- `kind` and `base` name any figure already in the library. The walkthrough renders it, it does not redefine it.
- Each step's `focus` is a list of element keys: message indices for sequences, node and `from~to` edge ids for flowcharts, table ids and `r0`-style relationship indices for ERDs.
- Anything focused in an earlier step stays half-lit. Anything never focused stays dim.

| spec reference — walkthrough | |
| --- | --- |
| walk | { panels:[…], steps:[…] } · or { kind, base, steps } for a single panel |
| panel | { kind:'seq'\|'flow'\|'erd'\|'screen'\|'tbl', base:'specName', id?, label? } · id defaults to kind |
| step | { focus:[keys], set?:{ key: value }, note, io?, effects? } |
| io · cg only | { call: "from~to", in?: "text", out?: "text" } · two notes on one call, shown only on that step |
| effects · cg only | [{ at: "fileId", kind: "db", text }] · a cylinder hung under the file, shown only on that step · any other kind draws a plain circle, and dashes are reserved for fog |
| focus key | `key` matches in every panel · `panelId:key` pins it to one · both prefix-match on a dot |
| set | writes text into the cell a key names · cumulative across steps, so scrubbing back rewinds it |
| keys · seq | `m0`… messages · `s0`… self-calls · `n0`… notes |
| keys · flow | node id · `from~to` for an edge |
| keys · erd | table id · `r0`… relationships in spec order |
| keys · tbl | row id · `rowId.column` for a cell |
| keys · cg | `fileId.fn` for a row · `fileId` for every row in a file · `from~to` for a call |

**Elements without a `data-k` are structural and never dim.** To make something dimmable, tag it in its renderer. The walkthrough itself needs no change.
