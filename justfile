# engdoc — dev server, builds, and publishing helpers. Run `just` to list recipes.

set shell := ["zsh", "-cu"]

port := env_var_or_default("PORT", "4747")

# List recipes
default:
    @just --list --unsorted

# Serve docs/ with live reload on $PORT (default 4747)
serve:
    PORT={{port}} node scripts/serve.mjs

# Open one document in the running dev server, e.g. `just open example`
open doc:
    open "http://localhost:{{port}}/docs/{{doc}}"

# Build one document to dist/<name>.html, e.g. `just build example`
build doc:
    node scripts/build.mjs docs/{{doc}}.md

# List documents and their built outputs
ls:
    @echo "docs/:"; ls -1 docs/*.md | sed 's|^|  |'
    @echo "dist/:"; ls -1 dist/*.html 2>/dev/null | sed 's|^|  |' || echo "  (empty)"

# Remove built HTML
clean:
    rm -f dist/*.html
