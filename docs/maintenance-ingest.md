---
create-date: 2026-09-10, 08:40:00
type: sample
tags: [maintenance, figures]
status: draft
parent: example
---
# Maintenance work order ingest

- **This is a sample document, assembled from figures the component library already had.** It exists to prove the Markdown and YAML source format, and to be the thing you edit to see the page change.
- **Every figure below is a fenced YAML block in this file.** Open view spec under any figure, or open `docs/index.md` beside the browser and change a column name.
- **Prose is Markdown with one convention.** A bullet that opens in bold is an idea followed by its support. A bullet with no bold is an idea on its own. A paragraph with no bold is support.

## Data model

### At schema scale the layout has to be solved rather than placed by hand.

1. Every table in the maintenance local store, ranked left to right by dependency.
2. Ten foreign keys, each anchored at its own column.
3. `messages.parent_id` is a self reference, the thread's reply tree.

#### Things to watch

- **Tables drag, and the arrows follow.** Drop one and the spec under the figure picks up its `x` and `y`. Paste that back into the fence in this file to keep the arrangement.
- **Hover a row to read one relationship at a time.** Every other edge drops away and the far end tints.

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

### One migration collapses the status literal, shown as a diff on the schema.

- **Green is added, red removed, amber changed.** The keys are the same ones a walkthrough uses: a table, a column, or a relationship.

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

## Ingest

### The ingest use case, walked file by file.

- **Step through the scrubber.** Each step lights the rows and calls it names, and in and out notes pin to the arrow ends.
- The call graph the walkthrough drives is the fence right after it, keyed `cg/ingest`.

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

### The call graph on its own, with fan in and a fog node for what the figure does not draw.

- **Hover a row to see who calls it, transitively.** Boxes drag, and the eye folds one away.

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

### The upload handshake as a sequence.

- **Activation bars are blue, and blue means only that here.**

```seq seq/lifecycle
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

## The app

### Four screens of the work order flow, arrows leaving the button that was tapped.

- **Screens are canvas boxes.** Drag one and the arrows redraw from the new position.

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

### A relational table with the identifying columns frozen.

```tbl tbl/keys
label: line_items
alt: >-
  A line_items table with a tinted primary key column, two tinted foreign key columns, and four plain columns
  of values.
columns:
  - name: id
    type: int
    key: pk
  - name: visit_id
    type: int
    key: fk
  - name: room_id
    type: int
    key: fk
  - name: trade
    type: text
  - name: qty
    type: numeric
  - name: status
    type: text
rows:
  - - '1'
    - '42'
    - '7'
    - drywall
    - '120.00'
    - approved
  - - '2'
    - '42'
    - '7'
    - paint
    - '120.00'
    - approved
  - - '3'
    - '42'
    - '9'
    - flooring
    - '88.50'
    - pending
  - - '4'
    - '43'
    - '3'
    - paint
    - '64.00'
    - pending
```

## Real example

### Collapsing the maintenance work order status from four states to two.

1. **Two of the four states described the ingest pipeline rather than the work.** `new` was a row waiting for its briefing and `ready_to_start` was a row whose briefing had landed.
2. **The field is about to mirror the external source, and Entrata has neither state.**

#### Things to watch

- **The backfill has to land in the same migration as the AlterField, and it is one way.** Once the literal narrows, a stored `new` is rejected on load, so the update cannot trail the field change by a deploy.
- **Phones on the previous build keep sending start.** The action stays routable and returns the work order unchanged.

```tour tour/status-collapse
title: collapse MaintenanceChatWorkOrderStatus from four states to two
blocks:
  - slug: status/literal
    file: app/maintenance_chat/models/maintenance_chat_work_order.py
    status: edit
    lang: python
    idea: >-
      We fold the two states that described the ingest pipeline's own progress, <code>new</code> and
      <code>ready_to_start</code>, into <code>in_progress</code>, so that every value <code>status</code> can
      hold is one the external source also has before the field starts mirroring that source.
    code: |2-
        # Lifecycle:
      - # - new: Just ingested, not yet enriched with a briefing. Not yet ready to start.
      - # - ready_to_start: Enriched with a briefing, not yet started.
        # - in_progress
        # - completed
        # Notes:
        # - Not `work_tracker.WorkOrder`'s vocabulary, which describes QC review stages.
      - MaintenanceChatWorkOrderStatus = Literal["new", "ready_to_start", "in_progress", "completed"]
      + MaintenanceChatWorkOrderStatus = Literal["in_progress", "completed"]
  - slug: status/migration
    file: app/maintenance_chat/migrations/0008_collapse_work_order_status.py
    status: new
    lang: python
    idea: >-
      Rows still at <code>new</code> or <code>ready_to_start</code> move to <code>in_progress</code> in the
      same migration as the <code>AlterField</code>, because a deploy that ran the field change alone would
      leave values the narrowed literal rejects.
    code: |-
      # the AlterField and the data fix share one migration, so no database is ever between them
      operations = [
          migrations.AlterField(
              model_name="maintenancechatworkorder",
              name="status",
              field=LiteralTextField(MaintenanceChatWorkOrderStatus, default="in_progress"),
          ),
          migrations.RunSQL(
              """
              UPDATE maintenance_chat_maintenancechatworkorder
                 SET status = 'in_progress'
               WHERE status IN ('new', 'ready_to_start')
              """,
              reverse_sql=migrations.RunSQL.noop,
          ),
      ]
  - slug: status/writers
    file: app/maintenance_chat/services/work_order_service.py
    status: edit
    lang: python
    idea: >-
      Both writers insert straight into <code>in_progress</code> and lose the state from their names, so no
      caller can pick a starting state the literal no longer has.
    code: |-
      - def create_work_order_as_ready_to_start(
      + def create_work_order(
            *,
            organization: Organization,
            created_by: NavigateUser,
            location: Location | None = None,
            client_id: ClientId,
            prompt_channel: str | None = None,
        ) -> MaintenanceChatWorkOrder:
            ...
                    work_order = _insert_work_order(
                        organization=organization,
                        created_by=created_by,
      -                 status="ready_to_start",
      +                 status="in_progress",
                        location=location,
                        client_id=client_id,
                    )

      - def upsert_work_order_as_new(
      + def upsert_work_order(
            ...
            work_order = _insert_work_order(
                organization=organization,
                created_by=created_by,
      -         status="new",
      +         status="in_progress",
                location=location,
                external_id=external_id,
  - slug: status/ingest-briefing
    file: app/maintenance_chat/services/work_order_ingest_pipeline.py
    status: edit
    lang: python
    idea: >-
      The ingest run stops queueing <code>PrepareWorkOrderBriefingWorkflow</code> per landed row, because the
      briefing existed to move a row out of <code>new</code> and there is no <code>new</code> to move it out
      of.
    code: |2-
                results.append(result)
      -         if result.work_order_id is not None:
      -             briefed.append(
      -                 _queue_work_order_briefing(
      -                     work_order_id=result.work_order_id,
      -                     source_title=work_order.title,
      -                     source_problem_description=work_order.problem_description,
      -                 )
      -             )

            _log_run(organization_id=organization.id, results=results)
      -     return WorkOrderCreationRun(results=results, briefing_count=sum(briefed))
      +     return WorkOrderCreationRun(results=results)
  - slug: status/start-action
    file: app/apiv1/api/mobile/maintenance_chat.py
    status: edit
    lang: python
    idea: >-
      The <code>start</code> action stays routable but writes nothing, so a phone on the previous build keeps
      working while there is no longer a state for a row to start from.
    code: >2-
            match payload.action:
                case "start":
      -             # The user has picked up briefed work. `only_if` rather than a check on the row we

      -             # already hold, so a double tap or a second device cannot land between the two.

      -             started = update_work_order(

      -                 work_order_id=work_order.id, status="in_progress", only_if={"status":
      "ready_to_start"}

      -             )

      -             if started:

      -                 work_order.status = "in_progress"

      +             # Accepted and ignored, for clients in the field that still send it after the intake.

      +             pass
  - slug: status/home-sections
    file: mobile-capture-2/src/components/maintenanceExperience/home/MaintenanceHomeScreen.tsx
    status: edit
    lang: tsx
    idea: >-
      The home screen splits on <code>completedAt</code> alone, since every open work order is now
      <code>in_progress</code> and a filter on status would put all of them in one section and none in the
      other.
    code: |2-
        const completedWorkOrders = workOrders.filter((item) => item.completedAt !== null);
        const openWorkOrders = workOrders.filter((item) => item.completedAt === null);
      - const readyToStartWorkOrders = openWorkOrders.filter((item) => item.status === "ready_to_start");
      - const inProgressWorkOrders = openWorkOrders.filter((item) => item.status !== "ready_to_start");
  - slug: status/optimistic-row
    file: mobile-capture-2/src/components/maintenanceExperience/data/workOrderOperations.ts
    status: edit
    lang: ts
    idea: >-
      The optimistic row written when the plus is tapped starts as <code>in_progress</code>, matching what the
      server now lands, so the list never flashes a state the server would overwrite on the next sync.
    code: |2-
            serverId: null,
            state: null,
      -     // Mirrors what the server lands: tapping "+" only opens the intake, and sending the kickoff is
      -     // what picks the work up.
      -     status: "ready_to_start",
      +     status: "in_progress",
            syncState: "pending",
```
