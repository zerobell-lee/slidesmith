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

Detect placeholders:

```bash
mkdir -p <USER_DIR>/build/html/svg <USER_DIR>/build/html/img
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts detect <USER_DIR>/output.md
```

For each placeholder in the resulting JSON:

- `kind: image` → pass through (no replacement entry).
- `kind: file-ref`:
  ```bash
  cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts dispatch-file-ref "<ext>"
  ```
  - Result `null` → no processor matched; warn the user and preserve the placeholder.
  - Result is an object with `backend.type === 'cli'` or `'http'`:
    Determine output extension: use `output_ext` from the manifest if present (e.g. `excalidraw-cli` → `png`), otherwise default to `svg`. SVG outputs go to `build/html/svg/`, PNG/JPG to `build/html/img/`.
    ```bash
    cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts run-processor \
      --name <processor-name> \
      --input-file "<USER_DIR>/<placeholder.path>" \
      --out "<USER_DIR>/build/html/<svg|img>/<placeholder.id>.<ext>"
    ```
    Replacement: rewrite `![alt](<placeholder.path>)` → `![alt](<svg|img>/<id>.<ext>)` (path relative to prerendered.md, which lives in build/html/).
  - Result has `backend.type === 'mcp'`: invoke the MCP tool directly via Claude Code (don't use `run-processor`). Save output to `<USER_DIR>/build/html/svg/<id>.svg` (or `img/<id>.<ext>` if the MCP tool returns raster). Same replacement pattern.

- `kind: semantic` (LLM-judgment dispatch):
  1. Inspect alt text, pick a capability:
     - chart / graph → `chart.*`
     - diagram / flow → `diagram.*`
     - photo / realistic / concrete subjects → `stock.photo`
     - illustration / generated / abstract → `image.generate`
     - The LLM is multilingual — alt text in Korean, Japanese, etc. maps the same way by meaning.
  2. Pick the highest-priority registered processor (use `list-capabilities` from the preamble).
  3. Invoke it. Result goes to `<USER_DIR>/build/html/img/<id>.<ext>` (or `svg/<id>.svg` for diagrams).
  4. Replacement: `![alt](img/<id>.<ext>)` or `![alt](svg/<id>.svg)`.
  5. On failure, retry once. If still failing, preserve the placeholder.

After all placeholders are processed, write replacements.json and inject:

```bash
# write <USER_DIR>/build/html/replacements.json with the JSON array of {id, original, replacement}
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="<USER_DIR>" npx tsx src/cli.ts inject \
  <USER_DIR>/output.md \
  --replacements <USER_DIR>/build/html/replacements.json \
  --out <USER_DIR>/build/html/prerendered.md
```

Stop here if `--to prerendered`. Otherwise continue.

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
