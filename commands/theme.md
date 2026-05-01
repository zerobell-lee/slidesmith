---
description: Manage slidesmith themes (list/add/remove/update/info)
argument-hint: <list|add|remove|update|info> [args]
---

# /slidesmith:theme

Theme management. See spec §9.

!`SLIDESMITH_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)"; [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent 2>&1 | tail -5); echo "SLIDESMITH_ROOT=$SLIDESMITH_ROOT"`

The line above prints `SLIDESMITH_ROOT=<path>`. **In all bash commands below, replace `<SLIDESMITH_ROOT>` with that absolute path.** Each bash call should also pass `SLIDESMITH_PROJECT_DIR="$PWD"` to point cli at the user's current project.

## Subcommands

- `list` — Show themes from every source (bundled / user-global / project) along with their priority
- `add <git-url> [--name <id>]` — Add a user-global theme via git clone (`~/.slidesmith/themes/`)
- `update <name>` — Refresh via git pull
- `remove <name>` — Remove a user-global theme (refuses to remove bundled or project themes)
- `info <name>` — Show theme metadata

## What you should do

1. Take the subcommand from the first argument. Fall back to `list` if none is given.

2. Invoke the corresponding subcommand:
   ```bash
   cd <SLIDESMITH_ROOT>/scripts && SLIDESMITH_PLUGIN_DIR="<SLIDESMITH_ROOT>" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme <sub> [args]
   ```

3. Format the JSON output for the user:
   - `list`: as a table (name / location / description / tags)
   - `info`: the key fields plus the constraints list and recommended prerenders
   - `add`/`update`/`remove`: a one-line result plus next-step guidance

4. On `add` failure, mention the common causes:
   - "remote not found": typo in the git URL or a private repo
   - "cloned repo has no theme.yaml at its root": that repo isn't a slidesmith theme
