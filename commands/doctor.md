---
description: Verify slidesmith environment (marp-cli, processor binaries, env keys, MCP availability)
---

# /slidesmith:doctor

Verify the slidesmith environment.

Run the diagnostic (auto-installs scripts deps on first run):

```bash
USER_DIR="$PWD"
SLIDESMITH_ROOT=$(ls -d ~/.claude/plugins/cache/slidesmith/slidesmith/*/ 2>/dev/null | sort -V | tail -1 | sed 's:/*$::')
[ -d "$SLIDESMITH_ROOT/scripts/node_modules" ] || (cd "$SLIDESMITH_ROOT/scripts" && npm install --silent)
cd "$SLIDESMITH_ROOT/scripts" && SLIDESMITH_PLUGIN_DIR="$SLIDESMITH_ROOT" SLIDESMITH_PROJECT_DIR="$USER_DIR" npx tsx src/cli.ts doctor
```

## Reading the result

The output above is the diagnostic table. Show it to the user as-is, then summarize each failure on a single line:
- `binary:marp` failed → "Run `npm i -g @marp-team/marp-cli`."
- `binary:mmdc` failed → "Run `npm i -g @mermaid-js/mermaid-cli`."
- `env:PEXELS_API_KEY` failed → "Add `PEXELS_API_KEY=...` to your project's `.env`, or set it as a shell environment variable."
- `mcp:*` warning → Make sure that MCP server is active in your current Claude Code session.

If everything is ✅, tell the user "Environment OK. Start a project with `/slidesmith:new`, or build with `/slidesmith:build`."
