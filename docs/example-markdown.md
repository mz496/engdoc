---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, markdown]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 1
---

# Example: Markdown

- **This page is the prose layer with no figures on it, so every section spans the measure.** It exists to check that ordinary Markdown renders reasonably, and to state the one convention the renderer adds on top.
- **Everything above the first heading is the header.** The title is the h1, and the box beside it is whatever the frontmatter carries: type, status, tags, a parent, a link, the created date, and when the file was last edited.
- **The convention is two text classes.** A bullet that opens in bold is an idea followed by its support. A bullet with no bold is an idea on its own. A paragraph with no bold is support. Bold never reaches the page as weight.

## Writing

### A reader can stop anywhere in a good document and still leave with something true.

- **Every run of text is a main idea or a supporting detail.** There is no third role. A sentence that is neither is not serving the reader, it is serving the writer's sense that something belonged there.
- **A main idea is what the reader should leave with.** It survives alone: delete everything beneath it and it still says something true and useful.
- **A supporting detail is why they should believe it.** Evidence, mechanism, caveat, example. It is always optional reading, and if the argument breaks when it is skipped it was never support.
- **One question is asked of every sentence.** Is this what they should remember, or is this why they should believe it? Text that answers neither has nowhere to live, which is the whole point of having only two places.
- **Length is not the enemy, unclaimed text is.** One idea can carry six details under it. What it cannot carry is a sentence that supports nothing.
- **Most sections in most documents need no figure at all.** A figure earns its place by showing something prose cannot say in the same space: order that matters, a shape the reader has to hold in mind, a relationship between more than about three things. Everything else is a sentence.

#### Wording and grammar

- **No em dashes and no semicolons unless there is truly no other way.** Both of them join two thoughts that wanted to be two sentences. A period is almost always the honest punctuation, and a comma covers the rest.
- **Write at about a ninth-grade reading level.** Short sentences, plain verbs, one clause where one clause will do. Technical terms stay exact, but nothing around them should need a second read.
- **Keep the number of distinct terms as low as possible.** Use the vocabulary the code and the reader already have. If the thing being described says inflate, keep saying inflate and never reach for hydrate, because a second word for one thing makes the reader stop and check whether it is a second thing.

### Two text classes and three heading levels are the whole prose layer.

- **Hierarchy is contrast, never weight.** Ideas are full ink and support is muted, so the ideas alone form a path down the page. Bold would lay a second signal over one that already works.
- **Any heading can be a title or an idea.** Architecture is a title. Vendors and rooms both need a decision, and rooms already have a home is an idea. A tier says how much of the document the heading covers and never which of the two forms it takes.
- **A heading that is an idea puts the takeaway in its first few words.** A table of contents truncates, and a reader scanning one sees only the opening. Front-load the idea and drop the title-then-subtitle habit.
- **Never reach for a bigger heading than the structure needs.** An h2 exists to gather a run of sections. Giving one section an h2 of its own adds a tier that organizes nothing.

#### Things to note

- **The common failure is a heading that is neither form.** Some thoughts on requirements is too long to be a title and says nothing, so it is not an idea either. Pick one of the two. Two words, or an idea.
- **A link is the one exception to the two-ink scale, and it is sky rather than blue.** Blue in the figures means an activation bar or what a walkthrough is lighting, so links take a lighter tone and always carry an underline.

### The source convention maps onto the page in six rules.

| Source | Page |
| --- | --- |
| `# Title`, once | The document title. Bullets before the first `##` or `###` are the header. |
| `## Part` | A visible part heading that gathers a run of sections. |
| `### Heading` | Opens a section. Its bullets and paragraphs are the rail, its figure fences are the figure column. |
| `#### Heading` | A notes heading inside a rail, with the hairline rule. |
| `- **Idea.** Support.` | An idea followed by its support. Without the bold, the bullet is an idea on its own. |
| `1.` list | The numbered "shows" list, for what a figure shows. |

A figure is a fence whose info string is `kind slug`, with an optional `wide`. The kinds are `seq`, `flow`, `erd`, `tbl`, `cg`, `screen`, `tour` and `walk`, plus `erd-key` and `html` for raw markup. Any other fence is ordinary Markdown and lands in the rail. The pages that show each kind are [[example-sequence]], [[example-flowchart]], [[example-erd]], [[example-walkthrough]], [[example-canvas]], [[example-lofi]], [[example-table]], [[example-callgraph]] and [[example-tour]].

## Ordinary Markdown

### Inline marks render as their plain HTML.

Hey
- **Emphasis is *italic*, and strong inside a bullet is the idea notation, so it never shows as weight.** Inline `code` gets the mono face and a tinted background. ~~Strikethrough~~ is rendered by markdown-it's default preset.
- **Links come in two shapes.** A wiki link like [[example-erd]] resolves to the document at that path, and takes a label with a pipe, as in [[example-erd|the ERD page]]. An ordinary Markdown link works too: the directory is at [/](/), and a bare URL like https://example.com is linkified.
- A bullet with no bold is an idea on its own, the way each item in a numbered list of what a figure shows is.
  - A nested bullet is support by construction, and needs no notation.
  - Nesting a second level deep still indents, and still reads as support.
    - Markers cycle by depth: a filled bullet, an open bullet, then a dash.
    - The gap between items is the same at every depth.

A paragraph with no bold is support on its own. It sits under the bullets and reads as the quieter voice, and it can run to several sentences where the idea above it needs them.

**A paragraph that is entirely bold is an idea that needed a paragraph.** It keeps the full-ink class and drops the weight, like a bullet does.

### Numbered lists are what a figure shows, and they work without a figure.

1. The first thing to look at.
2. The second, which the numbers make citable from the rail.
3. **A numbered item can carry support too.** The same bold rule applies.

### Block elements keep the measure and never scroll the page.

A fenced code block with a language that is not a figure kind is ordinary Markdown. It lands in the rail with the mono face and its own sideways scroll.

```python
def collapse_status(row: WorkOrder) -> WorkOrder:
    # Rows still at new or ready_to_start move to in_progress in the same migration.
    if row.status in ("new", "ready_to_start"):
        row.status = "in_progress"
    return row
```

A fence with no language at all renders the same way.

```
$ just serve
engdoc on http://localhost:4747/
```

> A blockquote is for quoting a source, not for a callout. It takes the support voice and a rule down the left.
>
> It can run to two paragraphs.

A thematic break is three dashes on a line of their own. It draws a hairline across the measure.

---

The table below has an alignment row with colons, a header cell with inline code, and a cell with a link, which are the three things a Markdown table commonly carries.

| Column | Type | Note |
| :--- | :---: | ---: |
| `id` | text | primary key, a client generated ULID |
| `completed_at` | int? | null while open, see [[example-table]] |
| `resolution` | text? | free text written when the order is closed |

#### Things to watch

- **The file is the page.** Edit this file and the browser re-renders in place, keeping your scroll position. Rename it and the URL changes with it.
- **Frontmatter is Obsidian's shape.** Keys the renderer does not know are kept in the file and ignored on the page, so a vault can hold these documents without changes.
- **Raw HTML passes through.** markdown-it runs with `html: true`, so an inline <kbd>Esc</kbd> or a <sup>superscript</sup> renders, and a block of raw HTML is left alone.
