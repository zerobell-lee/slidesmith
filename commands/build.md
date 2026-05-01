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

4. Each stage runs the body procedure of its slash command directly. (That is, build doesn't *invoke* other commands — it inlines those procedures.)

5. If any stage fails, stop immediately. State clearly which stage failed and follow that stage's failure handling.

6. When every stage succeeds, report the final output paths (`build/deck.pdf`, etc.) to the user.
