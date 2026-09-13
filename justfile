# engdoc — dev server, builds, and publishing helpers. Run `just` to list recipes.

set shell := ["zsh", "-cu"]

port := env_var_or_default("PORT", "4747")

# List recipes
default:
    @just --list --unsorted

# Serve docs/ with live reload on $PORT (default 4747)
serve:
    PORT={{port}} node scripts/serve.mjs

# Serve and open the directory page in the browser
dev:
    PORT={{port}} node scripts/serve.mjs & pid=$!; sleep 0.5; open "http://localhost:{{port}}/"; wait $pid

# Open one document in the running dev server, e.g. `just open example`
open doc:
    open "http://localhost:{{port}}/?doc=docs/{{doc}}.md"

# Build one document to dist/<name>.html, e.g. `just build example`
build doc:
    node scripts/build.mjs docs/{{doc}}.md

# Build one document to a chosen output path
build-to doc out:
    node scripts/build.mjs docs/{{doc}}.md {{out}}

# Build every docs/*.md into dist/
build-all:
    for f in docs/*.md; do node scripts/build.mjs "$f"; done

# List documents and their built outputs
ls:
    @echo "docs/:"; ls -1 docs/*.md | sed 's|^|  |'
    @echo "dist/:"; ls -1 dist/*.html 2>/dev/null | sed 's|^|  |' || echo "  (empty)"

# Remove built HTML
clean:
    rm -f dist/*.html

# Rebuild every document from scratch
rebuild: clean build-all

# Kill whatever is listening on the dev port
stop:
    lsof -ti tcp:{{port}} | xargs kill 2>/dev/null || echo "nothing on :{{port}}"
