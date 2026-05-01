---
description: Run marp-cli on prerendered.md to produce PDF/HTML/PPTX in build/
---

# /slidesmith:export

The export stage from spec §6.4. Deterministic work, so the LLM only invokes it.

!`SLIDESMITH_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)"; [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent 2>&1 | tail -5); echo "SLIDESMITH_ROOT=$SLIDESMITH_ROOT"`

The line above prints `SLIDESMITH_ROOT=<path>`. **In all bash commands below, replace `<SLIDESMITH_ROOT>` with that absolute path.** Each bash call should also pass `SLIDESMITH_PROJECT_DIR="$PWD"` to point cli at the user's current project.

## Process

1. Read `deck.yaml` and pull out `theme`, `formats`, `output.basename`, and `overrides.css`.

2. Resolve the theme path:
   ```bash
   cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme-info "<theme>"
   ```
   In the resulting JSON, the `path` field tells you where `theme.css` lives = `<path>/theme.css`.

3. Confirm `build/.cache/prerendered.md` exists. If not, tell the user "Run `/slidesmith:prerender` first."

4. Run the export:
   ```bash
   cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts export \
     --input "$PWD/build/.cache/prerendered.md" \
     --theme-css "<path to theme.css>" \
     --overrides "$PWD/overrides.css" \
     --out-basename "$PWD/build/<basename from deck.yaml>" \
     --formats "<formats from deck.yaml>"
   ```
   Omit the `--overrides` argument if `overrides.css` doesn't exist.

5. Report the output files to the user: `build/deck.pdf`, `build/deck.html`, etc.

## Failure handling

- marp execution failed → show marp's stderr verbatim
- Theme CSS missing → tell the user which path was searched and check the theme installation
