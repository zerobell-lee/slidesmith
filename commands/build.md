---
description: Run plan + prerender + export sequentially
argument-hint: [--from plan|prerender|export]
---

# /slidesmith:build

Run `/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export` in order.

## Arguments

- `--from <stage>` (optional): which stage to restart from. Default is `plan`. Values: `plan`, `prerender`, `export`.

## Process

1. With `--from prerender`, skip the plan stage. If `output.md` doesn't exist, tell the user "Run plan first." and stop.

2. With `--from export`, skip both plan and prerender. If `build/.cache/prerendered.md` doesn't exist, tell the user and stop.

3. Print a one-line progress notice before each stage:
   - "🎨 Starting plan stage..."
   - "🔧 Starting prerender stage..."
   - "📦 Starting export stage..."

4. Each stage runs the body procedure of its slash command directly. (That is, build doesn't *invoke* other commands — it inlines those procedures.) Each bash invocation in those inlined procedures uses the same self-discovery preamble:

   ```bash
   USER_DIR="$PWD"
   SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
   [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
   cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts <subcommand> [args]
   ```

5. If any stage fails, stop immediately. State clearly which stage failed and follow that stage's failure handling.

6. When every stage succeeds, report the final output paths (`build/deck.pdf`, etc.) to the user.
