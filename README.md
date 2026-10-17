# engdoc

The eng-doc component library, split so content and renderer change independently.

```
renderer/   lib.css, lib.js (the figure components), app.js (Markdown to page), vendor/ (dagre, Prism, markdown-it, js-yaml)
docs/       one folder per kind of document, figures as fenced YAML
            component-examples/  scratch/  private/ (gitignored)
dist/       built HTML, same folders as docs/
scripts/serve.mjs   static server with live reload, no dependencies
scripts/build.mjs   one self-contained HTML per document, for publishing as an artifact
```

## Run

```sh
node scripts/serve.mjs            # http://localhost:4747/  lists the folders of docs/
open 'http://localhost:4747/scratch/index'
```

Edit a `.md` and the page re-renders in place, keeping your scroll position. Edit anything under `renderer/` and the page reloads.

## Publish

```sh
node scripts/build.mjs docs/scratch/index.md    # writes dist/scratch/index.html
```

The output has no doctype or `<html>` wrapper, which is what the artifact host expects. Publish it with the Artifact tool, passing the existing URL to update in place.
