---
description: Verify slidesmith environment (marp-cli, processor binaries, env keys, MCP availability)
---

# /slidesmith:doctor

Verifies every environment requirement slidesmith needs to run correctly.

## What you should do

1. From the plugin directory, run:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && npx tsx src/cli.ts doctor
   ```
   (If cwd is the user's project, set `SLIDESMITH_PROJECT_DIR` to that path before invoking.)

2. Show the result to the user as-is (the ✅/⚠️/❌ table).

3. If any check failed, summarize each failure with its cause and the next action on a single line:
   - `binary:marp` failed → "Run `npm i -g @marp-team/marp-cli`."
   - `binary:mmdc` failed → "Run `npm i -g @mermaid-js/mermaid-cli`."
   - `env:PEXELS_API_KEY` failed → "Add `PEXELS_API_KEY=...` to your project's `.env`, or set it as a shell environment variable."
   - `mcp:*` warning → Make sure that MCP server is active in your current Claude Code session.

4. If everything is ✅, tell the user "Environment OK. Start a project with `/slidesmith:new`, or build with `/slidesmith:build`."
