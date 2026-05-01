---
description: Generate output.md from blueprint, assets, and conversation
argument-hint: [--no-blueprint] [--from "raw text"]
---

# /slidesmith:plan

The plan stage from spec §6.2. Combines the blueprint, assets, and conversation context into Marp markdown (`output.md`).

!`SLIDESMITH_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)"; [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent 2>&1 | tail -5); echo "SLIDESMITH_ROOT=$SLIDESMITH_ROOT"`

The line above prints `SLIDESMITH_ROOT=<path>`. **In all bash commands below, replace `<SLIDESMITH_ROOT>` with that absolute path.** Each bash call should also pass `SLIDESMITH_PROJECT_DIR="$PWD"` to point cli at the user's current project.

## Pre-flight

Gather this information first:

1. **Prerender capabilities available in the current environment**:
   ```bash
   cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts list-capabilities
   ```
   From the resulting JSON, see which capabilities (e.g. `diagram.mermaid`, `stock.photo`) are available.

2. **Theme information**:
   ```bash
   cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme-info "$(cat deck.yaml | grep '^theme:' | awk '{print $2}')"
   ```
   You must follow every entry in `manifest.constraints`. Use `manifest.samples.default` as a format reference.

3. **Input sources (precedence per spec §5.4)**:
   - `blueprint.md` exists → master. Other inputs are supplementary.
   - Otherwise → infer from the contents of `assets/` plus the chat context.
   - If `--no-blueprint` is supplied, ignore the blueprint.
   - If `--from "text"` is supplied, that text is the master.

## Generation rules

1. **Honor the theme constraints** — apply the `manifest.constraints` you fetched above when writing slides.

2. **All prerender content must live in external files** (spec §6.2):
   - Diagrams: create `assets/diagrams/<slug>.mmd` (or `.excalidraw`); in output.md, only reference it via `![description](assets/diagrams/<slug>.mmd)`.
   - Charts: `assets/charts/<slug>.vl.json` (when vega-lite is supported).
   - If an image already lives in `assets/images/`, reference it directly.
   - If no image exists and one needs to be generated or sourced, use a semantic placeholder: `![alt natural-language description]()` (empty src). The prerender stage dispatches it through `image.generate` or `stock.photo`.
   - **Do not put diagram source inside an inline code block** (e.g. ` ```mermaid `). Detection ignores them, so they won't be rendered.

3. **Language**: follow the `language` field in `deck.yaml` (Korean by default). Slide body, titles, and alt text should all be in that language.

4. **Marp frontmatter** (top of output.md):
   ```yaml
   ---
   marp: true
   theme: <theme-name from deck.yaml>
   paginate: true
   ---
   ```

5. **Ambiguous input** — if the blueprint and materials are too thin for a reasonable inference, ask the user 1–2 short clarifying questions. When proceeding on assumptions, leave a `# TODO: <assumption>` HTML comment in the slide frontmatter.

## Write rules

1. If `output.md` already exists, explicitly ask the user before overwriting (spec §2.1, user-area protection).

2. Write the new content to `output.md` (with the Write tool).

3. Write the diagram source files at the same time (Write tool).

4. When you're done, report to the user:
   - Slide count
   - List of diagram/source files created
   - Number of semantic placeholders used (these will be filled in during prerender)
   - Next step: "Run `/slidesmith:prerender` to convert the placeholders."
