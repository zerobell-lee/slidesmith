---
description: Verify slidesmith environment (marp-cli, processor binaries, env keys, MCP availability)
---

# /slidesmith:doctor

slidesmith가 정상 동작에 필요한 모든 환경 요소를 검증합니다.

## What you should do

1. 플러그인 디렉토리에서 다음을 실행:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && npx tsx src/cli.ts doctor
   ```
   (cwd가 사용자 프로젝트라면 `SLIDESMITH_PROJECT_DIR`를 그 경로로 두고 호출)

2. 결과를 사용자에게 그대로 보여줍니다 (✅/⚠️/❌ 표).

3. 실패 항목이 있으면 각 항목별 원인과 다음 행동을 한 줄씩 정리해서 안내합니다:
   - `binary:marp` 실패 → "`npm i -g @marp-team/marp-cli` 실행하세요."
   - `binary:mmdc` 실패 → "`npm i -g @mermaid-js/mermaid-cli` 실행하세요."
   - `env:PEXELS_API_KEY` 실패 → "프로젝트의 `.env`에 `PEXELS_API_KEY=...`를 추가하거나 셸 환경변수로 설정하세요."
   - `mcp:*` 경고 → 해당 MCP 서버가 현재 Claude Code 세션에서 활성인지 확인하세요.

4. 모두 ✅이면 "환경 OK. `/slidesmith:new`로 프로젝트를 시작하거나 `/slidesmith:build`로 빌드하세요." 안내.
