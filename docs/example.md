---
create-date: 2026-09-10, 09:12:00
type: plan
tags: [engdoc, prose]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
status: draft
order: 1
parent:
---

# Example prose page

- **Everything above the first heading is the header.** The title comes from the frontmatter or the first h1, and the line under it is whatever the frontmatter carries: type, status, tags, a parent, a link, the created date, and when the file was last edited.
- **The rest is sections.** An h3 opens one. Its bullets are the rail, and a fenced spec, if there is one, is the figure beside it. This page has no figures, so every section spans the measure.

## How to write one

### A bullet that opens in bold is an idea, and the rest of the bullet is its support.

- **This is the idea.** This is the support that follows it, muted, and it can run to a second sentence when the idea needs one.
- A bullet with no bold is an idea on its own, the way a numbered list of what a figure shows is.
- **Bold never reaches the page as weight.** It is only the notation in the source, and the renderer turns it into the two text classes.

A paragraph with no bold is support on its own. It sits under the bullets and reads as the quieter voice.

### Links point at other documents by name.

- **A wiki link like [[maintenance-ingest]] resolves to the document at that path.** Give it a label with a pipe, as in [[maintenance-ingest|the sample with figures]].
- **Ordinary Markdown links work too.** The directory is at [/](/), and any path under docs is a page.

#### Things to watch

- **The file is the page.** Edit this file and the browser re-renders in place. Rename it and the URL changes with it.
- **Frontmatter is Obsidian's shape.** Keys the renderer does not know are kept in the file and ignored on the page, so a vault can hold these documents without changes.
