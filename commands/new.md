---
description: Bootstrap a new slidesmith project directory
argument-hint: <project-name> [--theme <theme>] [--lang <ko|en|jp>]
---

# /slidesmith:new

새 slidesmith 프로젝트 디렉토리를 만듭니다 (스펙 §5.3).

## Arguments

- `<project-name>` (필수): 만들 디렉토리 이름. 현재 cwd 기준 상대 경로.
- `--theme <name>` (선택, 기본 `default`): 사용할 테마.
- `--lang <code>` (선택, 기본 `ko`): blueprint 시드에 사용할 sample 언어.

## What you should do

1. 사용자 입력에서 인자 파싱. 누락이면 다시 묻기.

2. 테마가 사용 가능한지 사전 확인:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && npx tsx src/cli.ts theme-info <theme>
   ```
   실패하면 사용자에게 사용 가능한 테마 목록(`/slidesmith:theme list`)을 안내하고 중단.

3. 프로젝트 부트스트랩:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts new-project <name> --theme <theme> --lang <lang>
   ```

4. 성공하면 사용자에게:
   - 어떤 디렉토리가 만들어졌는지
   - 다음 행동 안내: "`<name>`으로 cd 후 `blueprint.md`를 편집하세요. 그 다음 `/slidesmith:build`로 한 번에 빌드하거나, 단계별로 `/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export`."

5. 실패하면 에러 메시지 그대로 보여주고 (특히 "non-empty"면 사용자가 의도한 디렉토리가 맞는지 확인).
