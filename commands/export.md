---
description: Run marp-cli on prerendered.md to produce PDF/HTML/PPTX in build/
---

# /slidesmith:export

The export stage from spec §6.4. Deterministic work, so the LLM only invokes it.

## Process

1. Read `deck.yaml` and pull out `theme`, `formats`, `output.basename`, and `overrides.css`.

2. Resolve the theme path:
   ```bash
   USER_DIR="$PWD"
   SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
   [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
   cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts theme-info "<theme>"
   ```
   In the resulting JSON, the `path` field tells you where `theme.css` lives = `<path>/theme.css`.

3. Confirm `build/.cache/prerendered.md` exists. If not, tell the user "Run `/slidesmith:prerender` first."

4. Run the export:
   ```bash
   USER_DIR="$PWD"
   SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
   [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
   cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts export \
     --input "$USER_DIR/build/.cache/prerendered.md" \
     --theme-css "<path to theme.css>" \
     --overrides "$USER_DIR/overrides.css" \
     --out-basename "$USER_DIR/build/<basename from deck.yaml>" \
     --formats "<formats from deck.yaml>"
   ```
   Omit the `--overrides` argument if `overrides.css` doesn't exist.

5. Report the output files to the user: `build/deck.pdf`, `build/deck.html`, etc.

## Failure handling

- marp execution failed → show marp's stderr verbatim
- Theme CSS missing → tell the user which path was searched and check the theme installation
