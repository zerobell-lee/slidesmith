---
description: Bootstrap a new slidesmith project directory
argument-hint: <project-name> [--theme <theme>] [--lang <ko|en|jp>]
---

# /slidesmith:new

Creates a new slidesmith project directory (spec §5.3).

## Arguments

- `<project-name>` (required): The directory name to create. Relative to the current cwd.
- `--theme <name>` (optional, default `default`): The theme to use.
- `--lang <code>` (optional, default `ko`): The sample language used to seed the blueprint.

## What you should do

1. Parse arguments from user input. Ask again if anything is missing.

2. Verify the theme is available before proceeding:
   ```bash
   USER_DIR="$PWD"
   SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
   [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
   cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts theme-info <theme>
   ```
   If this fails, point the user at the list of available themes (`/slidesmith:theme list`) and stop.

3. Bootstrap the project:
   ```bash
   USER_DIR="$PWD"
   SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
   [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
   cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts new-project <name> --theme <theme> --lang <lang>
   ```

4. On success, tell the user:
   - Which directory was created.
   - Next steps: "cd into `<name>` and edit `blueprint.md`. Then run `/slidesmith:build` to build in one shot, or step through `/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export`."

5. On failure, show the error message verbatim (in particular, if it says "non-empty", confirm the user really meant that directory).
