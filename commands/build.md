---
description: Run plan + prerender + export sequentially
argument-hint: [--from plan|prerender|export]
---

# /slidesmith:build

Run `/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export` in order.

!`SLIDESMITH_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)"; [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent 2>&1 | tail -5); echo "SLIDESMITH_ROOT=$SLIDESMITH_ROOT"`

The line above prints `SLIDESMITH_ROOT=<path>`. **In all bash commands below, replace `<SLIDESMITH_ROOT>` with that absolute path.** Each bash call should also pass `SLIDESMITH_PROJECT_DIR="$PWD"` to point cli at the user's current project.

## Arguments

- `--from <stage>` (optional): which stage to restart from. Default is `plan`. Values: `plan`, `prerender`, `export`.

## Process

1. With `--from prerender`, skip the plan stage. If `output.md` doesn't exist, tell the user "Run plan first." and stop.

2. With `--from export`, skip both plan and prerender. If `build/.cache/prerendered.md` doesn't exist, tell the user and stop.

3. Print a one-line progress notice before each stage:
   - "🎨 Starting plan stage..."
   - "🔧 Starting prerender stage..."
   - "📦 Starting export stage..."

4. Each stage runs the body procedure of its slash command directly. (That is, build doesn't *invoke* other commands — it inlines those procedures.)

5. If any stage fails, stop immediately. State clearly which stage failed and follow that stage's failure handling.

6. When every stage succeeds, report the final output paths (`build/deck.pdf`, etc.) to the user.
