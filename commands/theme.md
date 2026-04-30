---
description: Manage slidesmith themes (list/add/remove/update/info)
argument-hint: <list|add|remove|update|info> [args]
---

# /slidesmith:theme

테마 관리. 스펙 §9 참조.

## Subcommands

- `list` — 모든 source(번들/유저글로벌/프로젝트)의 테마 + 우선순위 표시
- `add <git-url> [--name <id>]` — git clone으로 사용자 글로벌 테마 추가 (`~/.slidesmith/themes/`)
- `update <name>` — git pull로 갱신
- `remove <name>` — 사용자 글로벌 테마 제거 (번들·프로젝트는 제거 거부)
- `info <name>` — 테마 메타데이터 표시

## What you should do

1. 첫 인자에서 서브커맨드 추출. 없으면 list로 fallback.

2. 해당 서브커맨드 호출:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme <sub> [args]
   ```

3. JSON 출력을 사용자에게 친화적으로 정리:
   - `list`: 표 형태로 (이름 / 위치 / 설명 / 태그)
   - `info`: 핵심 필드 + constraints 항목들 + 권장 prerenders
   - `add`/`update`/`remove`: 한 줄 결과 + 다음 단계 안내

4. `add` 실패 시 흔한 원인 안내:
   - "remote not found": git URL 오타 또는 비공개 레포
   - "cloned repo has no theme.yaml at its root": 그 레포는 slidesmith 테마가 아님
