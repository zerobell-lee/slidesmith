---
description: Verify slidesmith environment (marp-cli, processor binaries, env keys, MCP availability)
---

# /slidesmith:doctor

Verify the slidesmith environment.

!`SLIDESMITH_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd)"; [ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent 2>&1 | tail -5); cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts doctor 2>&1`

## Reading the result

The output above is the diagnostic table. Show it to the user as-is, then summarize each failure on a single line:
- `binary:marp` → "Run `npm i -g @marp-team/marp-cli`."
- `binary:mmdc` → "Run `npm i -g @mermaid-js/mermaid-cli`."
- `env:PEXELS_API_KEY` → "Add `PEXELS_API_KEY=...` to your project's `.env`, or export it in your shell."
- `mcp:*` warnings → Confirm the MCP server is active in this Claude Code session.

If everything is ✅, tell the user: "Environment OK. Start a project with `/slidesmith:new`, or build with `/slidesmith:build`."
