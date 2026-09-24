# engdoc

The eng-doc component library, split so content and renderer change independently.

```
renderer/   lib.css, lib.js (the figure components), app.js (Markdown to page), vendor/ (dagre, Prism, markdown-it, js-yaml)
docs/       one Markdown file per document, figures as fenced YAML
scripts/serve.mjs   static server with live reload, no dependencies
scripts/build.mjs   one self-contained HTML per document, for publishing as an artifact
```

## Run

```sh
node scripts/serve.mjs            # http://localhost:4747/  serves docs/index.md
open 'http://localhost:4747/docs/index'
```

Edit a `.md` and the page re-renders in place, keeping your scroll position. Edit anything under `renderer/` and the page reloads.

## Publish

```sh
node scripts/build.mjs docs/index.md            # writes dist/index.html
```

The output has no doctype or `<html>` wrapper, which is what the artifact host expects. Publish it with the Artifact tool, passing the existing URL to update in place.

## Authoring

- `# Title` once. Bullets before the first `##` or `###` are the header.
- `## Part` is a visible part heading. `### Heading` opens a section: its bullets and paragraphs are the rail, its figure fences are the figure column. A section with no figures spans the measure.
- `#### Things to watch` is the notes heading inside a rail.
- Plain text is support and renders muted, in a bullet, a paragraph or a table cell. Any **bold** run inside it is an idea and renders lit, wherever it falls. Bold never reaches the output as weight.
- `1.` lists render as the numbered "shows" list, `-` lists as points.
- A figure is a fence whose info string is `kind slug [wide]`: kinds are `seq`, `flow`, `erd`, `tbl`, `cg`, `box`, `screen`, `tour`, `walk`, plus `erd-key` and `html` for raw markup. The body is YAML in the same shape as the library's spec reference. The slug is the figure's key: a walkthrough panel's `base` names another fence's slug.
- Dragging a box rewrites the YAML shown under the figure. Copy it back over the fence to keep the layout.
