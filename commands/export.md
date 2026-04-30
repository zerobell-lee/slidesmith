---
description: Run marp-cli on prerendered.md to produce PDF/HTML/PPTX in build/
---

# /slidesmith:export

스펙 §6.4의 export 단계. 결정적 작업이라 LLM은 호출만.

## Process

1. `deck.yaml`을 읽어 `theme`, `formats`, `output.basename`, `overrides.css` 추출.

2. 테마 경로 해석:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme-info "<theme>"
   ```
   결과 JSON의 `path` 필드에서 `theme.css` 위치 = `<path>/theme.css`.

3. `build/.cache/prerendered.md`가 존재하는지 확인. 없으면 사용자에게 "먼저 `/slidesmith:prerender`를 실행하세요." 안내.

4. export 실행:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts export \
       --input "$PWD/build/.cache/prerendered.md" \
       --theme-css "<theme.css 경로>" \
       --overrides "$PWD/overrides.css" \
       --out-basename "$PWD/build/<basename from deck.yaml>" \
       --formats "<formats from deck.yaml>"
   ```
   `overrides.css`가 없으면 `--overrides` 인자 생략.

5. 사용자에게 결과 파일 목록 보고: `build/deck.pdf`, `build/deck.html` 등.

## Failure handling

- marp 실행 실패 → marp의 stderr 그대로 보여주기
- 테마 CSS 누락 → 어느 경로에서 찾았는지 알려주고 테마 설치 상태 안내
