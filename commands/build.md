---
description: Build the deck — runs draft, prerender, and export in sequence
argument-hint: [--from <output|prerendered>] [--to <output|prerendered>]
---

# /slidesmith:build

Builds the deck end-to-end. Internally three stages: **draft** (write `output.md` from `blueprint.md`), **prerender** (resolve placeholders to assets), **export** (run marp-cli to produce PDF/HTML).

## Arguments

- `--from <stage>` — restart from a stage (skip earlier ones). Values: `output` (skip draft, requires existing `output.md`), `prerendered` (skip draft + prerender, requires existing `build/html/prerendered.md`).
- `--to <stage>` — stop at a stage. Values: `output` (stop after draft), `prerendered` (stop after prerender).

## Path layout

```
<project>/
├── blueprint.md              # spec (user-edited)
├── output.md                 # draft stage output (Claude writes this)
├── deck.yaml
└── build/
    ├── deck.pdf              # PDF (single file)
    ├── deck.pptx             # PPTX (single file, if requested)
    └── html/                 # HTML version + assets
        ├── deck.html
        ├── prerendered.md    # intermediate (placeholders resolved)
        ├── replacements.json # intermediate
        └── svg/
            └── p1.svg
```

## Stage 1 — Draft (was the old "plan" command)

Skip if `--from output` or `--from prerendered`.

The setup-and-discovery preamble first:

```bash
USER_DIR="$PWD"
SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
[ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
echo "SLIDESMITH_ROOT=$SLIDESMITH_ROOT"
echo "USER_DIR=$USER_DIR"
```

Use the printed paths in subsequent commands (substitute `<SLIDESMITH_ROOT>` and `<USER_DIR>` in the commands below).

Pre-flight info:

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts list-capabilities
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts theme-info "$(grep '^theme:' <USER_DIR>/deck.yaml | awk '{print $2}')"
```

Then:

1. Read `blueprint.md` — that's the **spec**, NOT slides. Treat it as a brief.
2. Read `deck.yaml` for theme + language.
3. Honor `manifest.constraints` from theme-info.
4. Write Marp slides to `<USER_DIR>/output.md`. Frontmatter must be:
   ```yaml
   ---
   marp: true
   theme: <theme-name>
   paginate: true
   ---
   ```
5. **All prerender content goes in external files**:
   - Diagrams → `assets/diagrams/<slug>.mmd` or `.excalidraw`; reference via `![alt](assets/diagrams/<slug>.mmd)`.
   - Charts → `assets/charts/<slug>.vl.json`.
   - Existing images → `assets/images/...`.
   - Need a generated/searched image → semantic placeholder `![alt natural language]()` (empty src).
6. If `output.md` already exists, ask before overwriting.
7. If blueprint sections still contain `<...>` placeholders, ask the user OR proceed with assumptions and leave a `# TODO: <assumption>` HTML comment in the slide.
8. Stop here if `--to output`. Otherwise continue.

## Stage 2 — Prerender

Skip if `--from prerendered`.

Run the batch command — it detects placeholders, dispatches all CLI/HTTP/internal-backed processors in parallel, writes a partial `replacements.json`, and reports anything that needs LLM judgment:

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts prerender-all \
  --theme "<theme-name from deck.yaml>" \
  --concurrency 4
```

The output JSON has four sections:

- `resolved` — placeholders the batch command handled. Each has `{id, processor, ext, out, replacement}`. Already added to `replacements.json`.
- `passthrough` — `kind: image` placeholders that need no rewrite.
- `externals` — placeholders that need YOU to handle:
  - `kind: file-ref-mcp` — file-ref dispatched to an MCP-backed processor. Invoke the MCP tool directly, save the output to `<USER_DIR>/build/html/<svg|img>/<id>.<ext>`.
  - `kind: semantic` — alt text describes what's needed. Pick a capability:
    - chart / graph → `chart.*`
    - diagram / flow → `diagram.*`
    - photo / realistic / concrete subjects → `stock.photo`
    - illustration / generated / abstract → `image.generate`
    Then call `run-processor` for the highest-priority registered provider. The bundled `pexels` (stock.photo) and `gemini-image` (image.generate) processors take the alt text directly via `--input` and write the final image in one call:
    ```bash
    cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts run-processor \
      --name pexels \
      --input "<alt text>" \
      --out "<USER_DIR>/build/html/img/<id>.jpg"
    ```
    For chart/diagram capabilities the LLM still produces source first (e.g. write a `.mmd` file under `assets/diagrams/auto-<id>.mmd`) then runs the matching CLI processor.
  - `kind: unmatched` — no processor available; warn the user and preserve the placeholder.
- `failures` — soft failures from the batch run. Retry once; if still failing, preserve the placeholder.

For each `external` you handle, append an entry to `<USER_DIR>/build/html/replacements.json`:
```json
{"id": "<id>", "original": "<raw from externals[]>", "replacement": "![<alt>](<svg|img>/<id>.<ext>)"}
```

Then inject:

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts inject \
  <USER_DIR>/output.md \
  --replacements <USER_DIR>/build/html/replacements.json \
  --out <USER_DIR>/build/html/prerendered.md
```

Stop here if `--to prerendered`. Otherwise continue.

### Single-placeholder fallback

If you need to handle a single placeholder manually (e.g. an MCP-backed external), `run-processor` still works the same as before:

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts run-processor \
  --name <processor-name> \
  --input-file "<USER_DIR>/<placeholder.path>" \
  --out "<USER_DIR>/build/html/<svg|img>/<id>.<ext>" \
  --theme "<theme-name from deck.yaml>"
```

## Stage 3 — Export

Read `deck.yaml`'s `formats` field. For each format:

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts export \
  --input <USER_DIR>/build/html/prerendered.md \
  --theme-css <theme.css absolute path from theme-info> \
  --out-basename <USER_DIR>/build/deck \
  --formats "<formats from deck.yaml>"
```

The `export` script routes HTML output to `build/html/deck.html` and PDF/PPTX to `build/deck.pdf`, `build/deck.pptx` — see Path layout above.

## Reporting

When the run finishes, report:

- Stages run (e.g. "draft → prerender → export").
- Slide count.
- Asset files created (diagrams, generated images).
- Skipped/failed placeholders, if any.
- Output file paths.
- If `--to <stage>` was used, point at the resulting intermediate file.

## Failure policy (spec §10.1)

- A single placeholder failure: retry once → preserve the placeholder and continue.
- A processor matching zero processors: warn explicitly (never silently skip).
- output.md / blueprint.md / assets/ are read-only to prerender and export. Only stage 1 (draft) writes them. Stage 1 also creates new files in `assets/diagrams/`, `assets/charts/` if needed, but never overwrites.
- If marp-cli is missing, export fails with the marp-cli error message — recommend the user run `/slidesmith:doctor` for the install command.
