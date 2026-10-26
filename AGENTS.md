# engdoc — how to write a doc here

Plain-Markdown plans and eng docs. Docs go in Markdown under `scratch/`; use `component-examples/` as example usage of how to use the different components such as the ERD diagram, sequence diagram, etc.

If you are instructed to modify a doc that does not adhere to these instructions, trust the latest version of these instructions. The instructions may have moved to reflect the latest guidance, and you should assume docs may have been generated on older guidance.


## Prose

- Bullets, not paragraphs. Every idea is one bullet. A bullet is one or two short sentences.
- Main point first. The bold lead of a bullet states the claim; the rest supports it.
- 9th-grade reading level. Plain words, short sentences. No em dashes, no semicolons, no parentheticals.
- Tables for anything parallel: fields, files, activities, alternatives.
- Code identifiers in backticks. At most one or two per sentence; describe the rest in words.
- Note timestamps when key decisions were made in 24-hour local time such as `2026-09-22 13:45:12 ET: Removed x as a simplification`

## Structure of a plan

- Frontmatter: `create-date`, `type: plan`, `tags`, `status`, `branch`. Then `# Title` as a one-sentence imperative, then `**Status:**`.
- `## Summary` first. One bullet per PR, saying what it does in plain words.
- `## What happens today` before any change.
- One `## PR …` section per PR, in ship order. Each carries its own PR description draft, before/after figure, files table, tests and rollout. Restructure PRs come before behavior PRs.
- Then `## Later`, `## Out of scope`, `## Decisions`, `## Rejected alternatives`, `## Open items`.
- A PR description draft is a fenced `md` block: title line, then `## Problem: <gist>` and `## Solution: <gist>` with bullets under each.

## Syntax

- `# Title` once. Bullets before the first `##` or `###` are the header.
- `## Part` is a visible part heading.
- `### Heading` opens a section. Its bullets and paragraphs are the rail, and its figure fences are the figure column. A section with no figures spans the full width.
- `#### Things to watch` is the notes heading inside a rail.
- Plain text is support and renders muted, in a bullet, a paragraph or a table cell.
- **Any bold run is an idea and renders lit, wherever it falls.** Bold never shows as weight.
- `1.` lists render as the numbered "shows" list. `-` lists render as points.
- A figure fence is `kind slug [wide]`. The slug is the figure's key, so a walkthrough panel's `base` names another fence's slug.
- `erd-key` and `html` fences carry raw markup instead of a figure spec.

## Figures

- Figures are fenced YAML, `kind slug [wide]`. Kinds and specs are in `docs/component-examples/example-*.md`.
- Architecture graph (`box`) with a `diff` for a restructure. Flowchart (`flow`) for a decision rule. Sequence (`seq`) for a race or a protocol.
- Build after every edit: `node scripts/build.mjs docs/<folder>/<name>.md`. A figure spec error renders in red on the page, so open the built file.

