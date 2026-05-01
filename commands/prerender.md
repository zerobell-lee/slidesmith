---
description: Detect placeholders in output.md, dispatch processors, write build/.cache/prerendered.md
---

# /slidesmith:prerender

The prerender stage from spec §6.3. `output.md` → `build/.cache/prerendered.md` (with placeholders converted).

!`SLIDESMITH_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)"; [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent 2>&1 | tail -5); echo "SLIDESMITH_ROOT=$SLIDESMITH_ROOT"`

The line above prints `SLIDESMITH_ROOT=<path>`. **In all bash commands below, replace `<SLIDESMITH_ROOT>` with that absolute path.** Each bash call should also pass `SLIDESMITH_PROJECT_DIR="$PWD"` to point cli at the user's current project.

## Process

### 1. Pre-flight check

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts doctor
```

If any check is at `fail`, stop immediately and tell the user. `warn` items (e.g. MCP) can proceed, but notify the user.

### 2. Detect placeholders

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts detect output.md > /tmp/placeholders.json
```

You'll receive a JSON array. Each entry is `{id, kind, line, ...}`.

### 3. Dispatch each placeholder

Read `/tmp/placeholders.json` (JSON parse) and handle each entry by these rules:

- **`kind: image`** → pass through (no conversion). Don't add it to the replacements array.

- **`kind: file-ref`** → deterministic dispatch:
  ```bash
  cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts dispatch-file-ref "<ext>"
  ```
  If the result JSON is `null`, no processor matched → print a warning and preserve the placeholder (don't add a replacement). If the result is an object, invoke that processor by name:
  ```bash
  cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
    --name <processor-name> \
    --input-file "<placeholder.path>" \
    --out "build/.cache/svg/<placeholder.id>.svg"
  ```
  On success, the replacement rewrites the original `![alt](path)` to `![alt](build/.cache/svg/<id>.svg)`.

- **`kind: semantic`** → LLM-judgment dispatch:
  1. Check the `list-capabilities` results (already verified by doctor in step 1).
  2. Inspect the placeholder's `alt` text and pick a suitable capability:
     - "chart" / "graph" → `chart.*`
     - "diagram" / "flow" → `diagram.*`
     - "photo" / "realistic" / concrete subjects (e.g. "cat by the window") → `stock.photo`
     - "illustration" / "generated" / "abstract" → `image.generate`

     The LLM is multilingual — alt text in any language (Korean, Japanese, etc.) maps to the same capabilities by meaning, not by literal keyword.
  3. Pick one of the capability's registered processors (recommend `providers[0]` from `list-capabilities`).
  4. Build the call arguments per capability:
     - `stock.photo` via pexels:
       1. Search:
          ```bash
          cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
            --name pexels \
            --http-path "/search?query=$(echo '<alt natural language>' | jq -sRr @uri)&per_page=1" \
            --out "/tmp/pexels-<id>.json"
          ```
       2. Read the result JSON and extract the `photos[0].src.large` URL.
       3. Download that URL (Bash `curl -L "$URL" -o build/.cache/img/<id>.jpg` or a separate fetch). The download itself doesn't need an auth header.
     - `image.generate` via gemini-image:
       1. The LLM builds the POST request payload (per the Gemini image-generation API spec — Imagen or Gemini 2.x image preview models):
          ```json
          {"contents":[{"parts":[{"text":"<alt natural language>"}]}]}
          ```
       2. Invoke:
          ```bash
          cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
            --name gemini-image \
            --http-method POST \
            --http-path "/models/<model>:generateContent" \
            --input '<JSON above>' \
            --out "/tmp/gemini-<id>.json"
          ```
       3. Decode the base64 image data from the response JSON → save to `build/.cache/img/<id>.png` (decoding can be done in Bash or by the LLM).
       4. On call failure, retry once and then preserve the placeholder (spec §10.1).
     - `diagram.*` (mermaid-cli): the LLM first writes the mermaid source string into `assets/diagrams/auto-<id>.mmd`, then converts it to SVG using the same flow as file-ref. The user can later lock it in by writing `![alt](assets/diagrams/auto-<id>.mmd)` in output.md.
  5. Save the result (image or SVG) to `build/.cache/img/<id>.<ext>` or `build/.cache/svg/<id>.svg`.
  6. The replacement rewrites the original `![alt]()` to `![alt](build/.cache/img/<id>.<ext>)`.

### Special handling for MCP backends

If a matched processor has `backend.type: mcp` (e.g. excalidraw-mcp), the `run-processor` script can't handle that call. Instead, the LLM directly invokes the corresponding Claude Code MCP tool:

1. Check the `backend` field in the `dispatch-file-ref` result.
2. If `backend.type === 'mcp'`, call the MCP tool directly via Claude Code (e.g. the `render_to_svg` tool on the excalidraw server) using the specified `server`/`tool`.
3. Save the resulting SVG bytes to `build/.cache/svg/<id>.svg`.
4. The rest of the flow is identical to the cli backend (add the replacement).

If the MCP server isn't running in the current session, doctor will have already raised a ⚠️; remind the user about that warning and skip (preserve) that placeholder.

### 4. Inject

Collect all successful replacements into a JSON array, then:

```bash
cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts inject output.md \
  --replacements "/tmp/replacements.json" \
  --out "build/.cache/prerendered.md"
```

### 5. Report

Report to the user:
- Placeholders processed: N
- Plain images passed through: M
- Failed/skipped placeholders: K (with each ID, line, and reason)
- Next step: "Run `/slidesmith:export` to produce the PDF/HTML."

## Failure policy (spec §10.1)

- If an individual placeholder fails, retry once → if it still fails, leave the placeholder as-is (don't add a replacement) and continue.
- Never silently skip when zero processors match — print a warning.
- If the doctor light check fails, stop before prerender starts.
- output.md / blueprint.md / assets/ must never be modified (semantic dispatch *creating* a new `assets/diagrams/auto-<id>.mmd` is allowed — overwriting an existing file is not).
