---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, seq]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 2
---
# Example: Sequence diagram

- **A sequence diagram shows who talks to whom, in what order, and who is doing work at each moment.** Seven marks cover the notation, and a `seq` fence holds actors and an ordered list of steps.
- **Every figure on this page is a fenced YAML block in this file.** Open view spec under any figure to see the same YAML the renderer read, or edit the fence and watch the page re-render.

### Seven marks are the whole sequence notation, and a figure needing an eighth needs a different component.

- **Arrowheads carry semantics.** A filled head is a blocking sync call, an open head is async fire-and-forget. The reader never has to guess whether the caller waits.
- **Line style carries direction of truth.** Solid lines make requests, dashed lines return results.
- Failure is red plus an ✕ before the head. Scannable without reading a single label.
- Activation bars open when a sync call lands and close when its return leaves. They answer "who is doing work right now" at a glance.
- Frames (`alt` / `loop` / `opt`) group steps under a `[guard]`. Notes pin context to a moment on a lifeline.

```html seq/notation-key
<figure class="figcard"><div class="scroll" id="legend-mount"></div><div class="tblock"><div class="nm">seq/notation-key</div></div></figure>
```

### Calls go right, returns come back, and activation bars show the work.

- Actors read left to right in call order. Client at the edge, deepest dependency at the far side.
- Each sync call auto-opens an activation on its target. Each return auto-closes the caller's bar. The spec never places bars by hand.
- Self-calls (the small loop on Auth Service) show work a service does on its own lifeline, such as hashing or signing, without inventing a fake actor.
- Use this shape for any "how does endpoint X actually work" doc section. Four actors fits most of ours.

```seq seq/auth-flow
title: Auth flow — happy path
actors:
  - id: client
    label: Client
  - id: api
    label: API Gateway
  - id: auth
    label: Auth Service
  - id: db
    label: User DB
steps:
  - type: msg
    kind: sync
    from: client
    to: api
    label: POST /login
  - type: msg
    kind: sync
    from: api
    to: auth
    label: validate(credentials)
  - type: msg
    kind: sync
    from: auth
    to: db
    label: SELECT user WHERE email
  - type: msg
    kind: return
    from: db
    to: auth
    label: user row
  - type: self
    actor: auth
    label: verify hash · sign JWT
  - type: msg
    kind: return
    from: auth
    to: api
    label: jwt
  - type: msg
    kind: return
    from: api
    to: client
    label: 200 · set-cookie
```

### An alt frame holds mutually exclusive paths, and red makes the failing one scannable.

- The frame's sections are split by a dashed divider, each with its own `[guard]`. Exactly one section happens per run.
- **Put the happy path first.** The reader confirms the normal case, then drops into the decline branch already oriented.
- Failure responses render red with the ✕ mark, so the 402 path is findable before any label is read.
- Inside branches, `activate: false` / `deactivate: false` keep the payment service's bar continuous instead of re-opening per section.

```seq seq/payment-alt
title: Payment authorization — alt branches
actors:
  - id: co
    label: Checkout
  - id: pay
    label: Payment Svc
  - id: net
    label: Card Network
steps:
  - type: msg
    kind: sync
    from: co
    to: pay
    label: authorize($42.00)
  - type: block
    kind: alt
    sections:
      - label: card approved
        steps:
          - type: msg
            kind: sync
            from: pay
            to: net
            label: auth request
          - type: msg
            kind: return
            from: net
            to: pay
            label: code 00 · auth id
          - type: msg
            kind: return
            from: pay
            to: co
            label: 201 · charge_id
            deactivate: false
      - label: card declined
        steps:
          - type: msg
            kind: sync
            from: pay
            to: net
            label: auth request
            activate: false
          - type: msg
            kind: return
            from: net
            to: pay
            label: code 05 · do not honor
            status: fail
            deactivate: false
          - type: msg
            kind: return
            from: pay
            to: co
            label: 402 Payment Required
            status: fail
            deactivate: false
```

### Open arrowheads mean fire-and-forget, and the loop guard carries the repeat condition.

- The enqueue and the runner's completion callback use open heads. Nobody blocks on them, and the diagram says so structurally.
- **The loop frame's guard is the contract.** `every 2s · while state ≠ done` documents cadence and exit condition in one line.
- The `202 · job_id` return before the loop is what makes polling legal. The client owns an id it can ask about.
- Use this shape for any async-job or webhook design. It separates "accepted" from "done" visually.

```seq seq/async-job
title: Async job — enqueue + polling loop
actors:
  - id: cli
    label: Client
  - id: api
    label: Jobs API
  - id: run
    label: Job Runner
steps:
  - type: msg
    kind: sync
    from: cli
    to: api
    label: POST /jobs · transcode
  - type: msg
    kind: async
    from: api
    to: run
    label: enqueue (async)
  - type: msg
    kind: return
    from: api
    to: cli
    label: 202 · job_id=91f4
  - type: block
    kind: loop
    sections:
      - label: every 2s · while state ≠ done
        steps:
          - type: msg
            kind: sync
            from: cli
            to: api
            label: GET /jobs/91f4
          - type: msg
            kind: return
            from: api
            to: cli
            label: '{ state: running }'
  - type: msg
    kind: async
    from: run
    to: api
    label: done · artifact url
  - type: msg
    kind: sync
    from: cli
    to: api
    label: GET /jobs/91f4
  - type: msg
    kind: return
    from: api
    to: cli
    label: '{ state: done, url }'
```

### Failures are drawn in order, from the cause note through the timeout, the retry loop and the idempotent recovery.

- The note names the root cause (`pod OOM-killed mid-request`) at the exact moment it happens, not in a paragraph three sections away.
- The 504 renders dashed red with the ✕: the standard mark for "this response is the failure".
- The retry loop's guard states the policy, meaning attempts and backoff. The self-call `idempotency key hit` shows why the retry is safe, not just that it happened.
- This is the shape to reach for in postmortems and "failure handling" sections: two actors, wide spacing, every mark earning its place.

```seq seq/failed-request
title: Failed request — timeout, retry, idempotency
actors:
  - id: ord
    label: Order Svc
  - id: inv
    label: Inventory Svc
spacing: 260
steps:
  - type: msg
    kind: sync
    from: ord
    to: inv
    label: reserve(sku-118, qty 2) · key=a1b2
  - type: note
    over:
      - inv
    label: pod OOM-killed mid-request
  - type: msg
    kind: return
    from: inv
    to: ord
    label: 504 gateway timeout (5s)
    status: fail
  - type: gap
    h: 8
  - type: block
    kind: loop
    sections:
      - label: retry ×3 · backoff 200ms → 800ms
        steps:
          - type: msg
            kind: sync
            from: ord
            to: inv
            label: reserve(…) · key=a1b2 · attempt 2
          - type: self
            actor: inv
            label: idempotency key hit
          - type: msg
            kind: return
            from: inv
            to: ord
            label: 201 reserved (idempotent)
  - type: self
    actor: ord
    label: resume checkout
```

### A static lifeline cannot show birth, death or concurrency, so four more marks do.

1. Dividers split the run into named phases.
1. create drops a participant's box at the row it comes into existence.
1. destroy ends its lifeline with an ✕. It is gone, not idle.
1. par holds branches that run at once. Autonumber makes every step citable.

#### Things to note

- **A stream is a participant, not a message.** Drawing its lifeline full-height would claim it existed before the POST and survived the cut. Create and destroy are what make its actual lifetime visible.
- **par is not alt.** An alt frame's sections are mutually exclusive. A par frame's both happen. Here the client polls while the run keeps generating, which is the entire premise of the recovery design.
- Numbering is for the prose around the figure, "step 4 is where the paint is discarded" beats restating the step in words. Turn it off for figures nobody will cite.
- The ✕ is the same mark failure messages use: in both cases it means "this thing is over".

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

### A sequence spec is actors and an ordered list of steps, and it fits on one card.

- Nine step types cover every figure above. Messages, self-calls, notes, blocks, manual activation, and spacing gaps.
- **Activation is automatic.** Sync calls open a bar on the target, returns close the source. Reach for `activate: false` / `deactivate: false` only inside alt branches to keep a bar continuous.
- `spacing` widens the actor grid for long labels (`seq/failed-request` uses 260). Everything else is derived.
- The renderer walks steps top-to-bottom once. Y positions, bar stacks, and frame extents all fall out of that single pass, so specs stay order-only.

| spec reference — component 01 | |
| --- | --- |
| actors | [{ id, label }] · left-to-right order · optional top-level spacing (px between lifelines) |
| msg | { type:'msg', kind:'sync'\|'async'\|'return', from, to, label, status?:'fail', activate?, deactivate? } |
| self | { type:'self', actor, label } |
| note | { type:'note', over:[ids], label } |
| block | { type:'block', kind:'alt'\|'loop'\|'opt'\|'par', sections:[{ label, steps }] } |
| lifecycle | { type:'create'\|'destroy', actor } · create places the box at that row, destroy ends the lifeline with ✕ |
| divider | { type:'divider', label } · a full-width phase band |
| autonumber | top-level `autonumber: true` · numbers every message and self-call |
| misc | { type:'activate'\|'deactivate', actor } · { type:'gap', h } |

**Sync calls auto-open an activation on the target, and returns auto-close the source.** A `status: 'fail'` on any message turns it red and adds the ✕ mark.
