---
description: Manage slidesmith themes (list/info/add/update/remove/preview/create)
argument-hint: <list|info|add|update|remove|preview|create> [args]
---

# /slidesmith:theme

Theme management. See spec §9.

## Subcommands

- `list` — Show themes from every source (bundled / user-global / project) along with their priority
- `info <name>` — Show theme metadata
- `add <git-url> [--name <id>]` — Add a user-global theme via git clone (`~/.slidesmith/themes/`)
- `update <name>` — Refresh via git pull
- `remove <name>` — Remove a user-global theme (refuses to remove bundled or project themes)
- `preview <name>` — Print a path to a rendered HTML preview of the theme so the user can open it in a browser
- `create <name>` — Interactive: ask design questions, draft `theme.css`, iterate with previews until the user is happy, then finalize at `~/.slidesmith/themes/<name>/`

## Bash invocation pattern

For every CLI-backed subcommand below, use this preamble:

```bash
USER_DIR="$PWD"
SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
[ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts <cli-subcommand> [args]
```

## What you should do

Take the subcommand from the first argument. Fall back to `list` if none is given. Then:

### `list` / `info` / `add` / `update` / `remove`

1. Invoke the corresponding CLI subcommand: `theme <sub> [args]`.
2. Format the JSON output for the user:
   - `list`: as a table (name / location / description / tags)
   - `info`: the key fields plus the constraints list and recommended prerenders
   - `add`/`update`/`remove`: a one-line result plus next-step guidance
3. On `add` failure, mention the common causes:
   - "remote not found": typo in the git URL or a private repo
   - "cloned repo has no theme.yaml at its root": that repo isn't a slidesmith theme

### `preview <name>`

1. Run `theme-preview <name>` via the bash preamble above.
2. The CLI prints `{ok, source, path}` JSON. Tell the user:
   - Show the absolute `path`.
   - If `source: "gallery"`, mention this is the pre-built gallery for that bundled theme.
   - If `source: "on-the-fly"`, mention it was built fresh into a temp directory.
   - Tell them to open the HTML in a browser to see how the theme looks.
3. If the CLI errors with `theme not found`, tell the user to run `/slidesmith:theme list` to see installed themes.

### `create <name>` — interactive theme creation

This is a multi-turn interactive flow. You walk the user through it. **Do not try to one-shot the theme** — the iteration loop is the whole point.

#### Step 1 — Validate and reserve the name

- The name must match `^[a-z][a-z0-9-]*$` (kebab-case, starts with lowercase letter, alphanumerics and hyphens). If invalid, refuse and explain.
- Check whether `~/.slidesmith/themes/<name>/` already exists. If yes, refuse and tell the user to run `/slidesmith:theme remove <name>` first.

#### Step 2 — Concept Q&A (one question per turn)

Ask the following questions **one at a time**, waiting for the user to answer before moving to the next. Keep questions short.

1. **Base**: "Dark or light base?"
2. **Vibe**: "What's the vibe? (formal / casual / playful / serious / minimal / maximal — pick or describe)"
3. **Use case**: "What's the primary use case? (technical talk / product pitch / academic lecture / report / etc.)"
4. **References**: "Any reference designs? (a website, an existing slidesmith theme to riff on, a screenshot, anything)"
5. **Accent**: "Accent color preference? (e.g. 'royal blue', a hex, or 'pick one for me')"

After all five answers, summarize the concept back to the user in 2-3 sentences before moving on.

#### Step 3 — Draft the initial CSS

- Write a CSS file at `~/.slidesmith/themes/<name>/theme.css` (create the directory). Use the bundled themes as reference for structure (see `themes/default/theme.css`, `themes/midnight-tech/theme.css`, `themes/editorial/theme.css` in the plugin root).
- Start the file with `/* @theme <name> */` followed by `@import 'default';`.
- Pick a sane font stack (Inter + Noto Sans KR for sans, JetBrains Mono for mono, or a serif like Source Serif Pro / Noto Serif KR if the user wanted serif vibes). Add a Google Fonts `@import url(...)` if you want web fonts.
- Translate the Q&A answers into CSS variables (background, foreground, accent) and styling.
- Cover all the elements that `gallery/sample.md` exercises: `section`, `h1/h2/h3`, lists (ordered + unordered), inline `code`, `pre code`, `blockquote`, `table`, `img`, `footer`, `section::after` (pagination).

#### Step 4 — Build the preview

Run via bash:

```bash
USER_DIR="$PWD"
SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
THEME_DIR="$HOME/.slidesmith/themes/<name>"
cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" \
  npx tsx src/cli.ts theme-build-preview --theme-css "$THEME_DIR/theme.css" --out "$THEME_DIR/.preview.html"
```

Tell the user the absolute path to `.preview.html`. Ask them to open it and give feedback (specific things they like / don't like).

#### Step 5 — Iterate

The user gives feedback like "h2 needs more weight", "code block too dark", "less contrast on tables", "accent is too muted". For each round:

1. Read `~/.slidesmith/themes/<name>/theme.css`.
2. Edit it based on the feedback. Keep changes targeted — don't rewrite the file when a small change suffices.
3. Re-run `theme-build-preview` to update `.preview.html`.
4. Tell the user the preview is updated. Ask if they want more changes.

Loop until the user signals done with phrases like "looks good", "ㄱㄱ", "done", "perfect", "ship it".

#### Step 6 — Finalize the theme directory

When the user signals done:

1. Write `~/.slidesmith/themes/<name>/theme.yaml` with sensible defaults derived from the Q&A:
   ```yaml
   name: <name>
   displayName: <Title Case>
   version: 0.1.0
   author: <user-supplied or ''>
   description: <one-sentence summary derived from Q&A>
   tags: [<derived: e.g. dark/light, technical, minimal, etc.>]
   fits: [<derived from use-case answer>]
   constraints:
     - "Use h1 for slide titles (one per slide)"
     - <one or two more reflecting the theme's strengths>
   samples:
     default: samples/sample.md
   recommendedPrerenders: []
   ```
2. Create `~/.slidesmith/themes/<name>/samples/sample.md` by copying `gallery/sample.md` from the plugin and lightly tweaking the title/copy to fit the theme's stated use case if that adds value. Keep it Korean by default. Make sure the front-matter `theme:` line is set to `<name>`.
3. Write `~/.slidesmith/themes/<name>/README.md` with a short paragraph about the theme: what it's for, what it leans into, and recommended use.
4. Delete `~/.slidesmith/themes/<name>/.preview.html` (it's a working file, not a distribution artifact).

#### Step 7 — Final preview + sign-off

Run `theme-build-preview` once more, this time to a temp file (e.g. via mktemp or just `~/.slidesmith/themes/<name>/.final-preview.html`). Tell the user:

> Theme `<name>` is saved at `~/.slidesmith/themes/<name>/`. Final preview: `<path>`. Use it via `/slidesmith:new my-deck --theme <name>`.

Done.
