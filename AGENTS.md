# engdoc — how to write a doc here

Plain-Markdown plans and eng docs, rendered by `renderer/`. Read this before writing or editing anything under `docs/`.

## Prose

- Bullets, not paragraphs. Every idea is one bullet. A bullet is one or two short sentences.
- Main point first. The bold lead of a bullet states the claim; the rest supports it.
- 9th-grade reading level. Plain words, short sentences. No em dashes, no semicolons, no parentheticals.
- Tables for anything parallel: fields, files, activities, alternatives.
- Code identifiers in backticks. At most one or two per sentence; describe the rest in words.
- Say who decided and when: `Matthew, 2026-09-22.` on a decision bullet.

## Structure of a plan

- Frontmatter: `create-date`, `type: plan`, `tags`, `status`, `branch`. Then `# Title` as a one-sentence imperative, then `**Status:**`.
- `## Summary` first. One bullet per PR, saying what it does in plain words.
- `## What happens today` before any change.
- One `## PR …` section per PR, in ship order. Each carries its own PR description draft, before/after figure, files table, tests and rollout. Restructure PRs come before behavior PRs.
- Then `## Later`, `## Out of scope`, `## Decisions`, `## Rejected alternatives`, `## Open items`.
- A PR description draft is a fenced `md` block: title line, then `## Problem: <gist>` and `## Solution: <gist>` with bullets under each.

## Figures

- Figures are fenced YAML, `kind slug [wide]`. Kinds and specs are in `lib/example-*.md`.
- Architecture graph (`box`) with a `diff` for a restructure. Flowchart (`flow`) for a decision rule. Sequence (`seq`) for a race or a protocol.
- Build after every edit: `node scripts/build.mjs docs/<name>.md`. A figure spec error renders in red on the page, so open the built file.

