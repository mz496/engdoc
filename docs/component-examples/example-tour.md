---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, tour]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 10
---
# Example: Code tour

- **A code tour narrates the load-bearing lines of a change before the change exists.** Each block is one file, a pill saying whether the path exists yet, a one sentence heading that says why, and the ten lines that matter.
- **A `tour` fence is a list of blocks.** Diff lines open with their sign, context lines with a space, and a full line comment that opens a group of lines is lifted out as a heading.

## Every kind of change

### A code tour narrates the load-bearing lines of a change before the change exists.

1. Nothing here is real. The upload budget is invented so that every kind of file change appears once.
1. An edited file, a new file, a renamed file and a deleted file, each with its own pill.
1. Diff blocks and one plain block, and two headings lifted out of comments in the first.
1. Green is what the change adds, red what it removes, and the rest is context.

#### Things to note

- **This is not a PR diff.** A PR review tool shows every file in full, after the fact. A tour is written while planning, so it shows the trickiest ten lines per file and says why, and it leaves out the imports, the tests and the plumbing that follow from them. Most of the code it shows does not exist yet.
- **A block heading is one sentence that says why the code is the way it is.** It names the specifics in the block and gives the motivation, the way a good code comment does, and it never restates what the lines already say. Read the headings alone and the chapter should still make its argument.
- **The pill answers the first question a reader asks weeks later: does this path exist yet.** An edit is the default and neutral. New is green, a deletion is red, and a rename is amber with the old path struck through, so a reader searching for the old name still lands here.
- **Headings come out of the comments.** A full line comment that opens a group of lines, first in the block or after a blank line and followed by code, is lifted out and set as a heading. Write the comment you would write anyway and the block gets its structure for free.
- **Syntax colour comes from Prism, inlined like dagre.** Python, SQL, TypeScript and TSX are the grammars on the page, because they are what this codebase is written in. The colours are three tokens, keywords, strings and names, chosen to stay out of the way of the green and red bands.

```tour tour/all-cases
title: an invented upload budget, so every kind of file change appears once
blocks:
  - slug: tour/edited-file
    file: app/uploads/services/upload_service.py
    status: edit
    lang: python
    idea: >-
      <code>create_upload</code> refuses an over budget capture before the <code>Upload</code> row exists and
      charges the budget inside the same transaction, so a rollback can neither show a refused upload nor leak
      its bytes.
    code: |-
      # check the budget before the row exists, so a refused upload is never seen by a technician
        def create_upload(*, organization: Organization, capture: Capture) -> Upload:
      +     if not UploadBudget.for_organization(organization).allows(capture.byte_size):
      +         raise UploadRefused("over the rolling budget")
            upload = Upload.objects.create(organization=organization, capture=capture)

      # the counter moves after the insert, inside the same transaction, or a rollback would leak budget
      +     UploadBudget.for_organization(organization).charge(capture.byte_size)
            return upload
  - slug: tour/new-file
    file: app/uploads/services/upload_budget.py
    status: new
    lang: python
    idea: >-
      <code>UploadBudget</code> owns the window arithmetic so the window is one constant and
      <code>upload_service</code> asks a yes or no question.
    code: |-
      WINDOW = timedelta(hours=24)  # a technician's shift plus the overnight sync


      class UploadBudget:
          def allows(self, byte_size: int) -> bool:
              return self.spent + byte_size <= self.limit

          def charge(self, byte_size: int) -> None:
              UploadLedger.objects.create(organization=self.organization, byte_size=byte_size)
  - slug: tour/renamed-file
    file: web_client/src/uploads/BudgetBanner.tsx
    from: web_client/src/uploads/QuotaBanner.tsx
    status: rename
    lang: tsx
    idea: >-
      The banner becomes <code>BudgetBanner</code> and warns at ten percent of the rolling budget rather than
      at zero of the hard quota, since a crew that learns at zero has already lost the afternoon's captures.
    code: |-
      - export function QuotaBanner({ quota }: { quota: Quota }) {
      -   if (quota.remaining > 0) return null;
      -   return <Banner tone="warn">Storage quota reached</Banner>;
      + export function BudgetBanner({ budget }: { budget: Budget }) {
      +   if (budget.remainingBytes > budget.limitBytes * 0.1) return null;
      +   return <Banner tone="warn">{formatBytes(budget.remainingBytes)} left today</Banner>;
        }
  - slug: tour/deleted-file
    file: web_client/src/uploads/useQuota.ts
    status: delete
    lang: ts
    idea: >-
      <code>useQuota</code> is deleted because its only reader is the banner, which now takes the budget from
      the upload list it already holds, and a second fetch of the same numbers drifted from the first once
      already.
    code: |-
      - export function useQuota(organizationId: string) {
      -   return useQuery({ queryKey: ["quota", organizationId], queryFn: () => fetchQuota(organizationId) });
      - }
```

## Real example

### Collapsing the maintenance work order status from four states to two.

1. **Two of the four states described the ingest pipeline rather than the work.** `new` was a row waiting for its briefing and `ready_to_start` was a row whose briefing had landed. Neither says anything about the work order itself.
1. **The field is about to mirror the external source, and Entrata has neither state.** Folding both into `in_progress` first means every value the column can hold is one the source can also produce, so the later change is a mapping and not a migration.
1. **The briefing stops being a promotion step.** It existed to move a row out of `new`. With no `new` to leave, the ingest run no longer queues it per row, and the row it creates is already the row the technician sees.
1. **Seven files change.** The literal, one migration, the two writers in `work_order_service`, the ingest run, the `start` action on the mobile API, and the two mobile files that filtered or defaulted on `ready_to_start`.

#### Things to watch

- **The backfill has to land in the same migration as the `AlterField`, and it is one way.** Once the literal narrows, `LiteralTextField` rejects a stored `new` on load, so the `UPDATE` cannot trail the field change by a deploy. `reverse_sql` is a no-op, so a rollback keeps the rows at `in_progress`. The external snapshots still hold each row's original source state if anyone needs to tell them apart later.
- **Phones on the previous build keep sending `start`.** The action stays routable and returns the work order unchanged, so an old client's briefing screen still gets a 200. Its optimistic rows are written locally as `ready_to_start` and are overwritten by `in_progress` on the first sync, which is the behaviour those builds already have after a kickoff.
- **Briefings already in flight finish without writing.** `PrepareWorkOrderBriefingWorkflow` promotes with a conditional update out of `new`. After the backfill no row is `new`, so the write matches nothing and the workflow completes cleanly. Drain the queue anyway before the worker image drops the workflow, or Temporal will hold non-deterministic histories for the runs that remain.
- **The generated clients shrink their enum and have to be regenerated in the same stack.** `openapi.gen.ts` in the mobile app and the web admin client both list four values. The admin read-only work orders view filters on the status column, so it needs a pass too.
- **Tests pin the old names and the old flow.** The mobile and admin API tests call `create_work_order_as_ready_to_start` and assert `ready_to_start` in responses, and the ingest pipeline test asserts that a briefing was started per landed row. All three suites change with the rename, and `WorkOrderCreationRun.briefing_count` loses its readers with it.

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

### A tour spec is a list of blocks, each a file, a language, a one sentence heading and the lines.

- **A chapter is a section of the page, and a block is a figure in it.** The rail carries the chapter's argument as it does for any figure. The blocks stack in the figure column, each under its heading.
- **The code is one string with newlines.** In a diff every line starts with its sign, then a space, then the code, so the block reads in the spec the way it renders. Indentation after the separator is kept.
- **Comments become headings only when they open a group.** A comment inside a run of code stays a comment. The blank line before a heading is consumed, since the heading is the break.

| spec reference — component 07 | |
| --- | --- |
| tour | { title?, blocks:[…] } · one chapter, mounted as a whole |
| block | { slug, file, from?, status, lang, idea, code } |
| status | 'edit' · 'new' · 'delete' · 'rename' · whether the path exists before the change, shown as the pill in the file strip · a rename also gives `from`, the old path |
| lang | 'python' · 'sql' · 'ts' · 'tsx' · picks the grammar and the comment token that headings are read from |
| idea | one sentence, the heading above the block · the why, naming the specifics in the lines · inline html allowed |
| code | lines joined by newlines · a diff when any line opens with `+` or `-` and a space · context is a leading space or no sign at all · otherwise plain code |
| headings | a full line comment that is first in the block or follows a blank line, and is followed by code · `#` for python, `--` for sql, `//` for ts and tsx |

**Highlighting is Prism 1.30.0, inlined as its own script block.** Copy it with the page, as with dagre. If it is missing, a block still renders with its bands and headings in plain ink.
