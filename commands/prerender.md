---
description: Detect placeholders in output.md, dispatch processors, write build/.cache/prerendered.md
---

# /slidesmith:prerender

스펙 §6.3의 prerender 단계. `output.md` → `build/.cache/prerendered.md` (placeholder들 변환됨).

## Process

### 1. Pre-flight check

```bash
cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
  SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts doctor
```

`fail` 항목이 있으면 즉시 중단하고 사용자에게 안내. `warn`(예: MCP)는 계속 진행하되 사용자에게 알림.

### 2. Placeholder 탐지

```bash
cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
  SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts detect output.md > /tmp/placeholders.json
```

JSON 배열을 받습니다. 각 항목은 `{id, kind, line, ...}`.

### 3. 각 placeholder별 dispatch

`/tmp/placeholders.json`을 읽고 (JSON parse), 다음 규칙으로 처리:

- **`kind: image`** → 통과 (변환 없음). replacements 배열에 추가하지 않음.

- **`kind: file-ref`** → 결정적 dispatch:
  ```bash
  cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
    SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts dispatch-file-ref "<ext>"
  ```
  결과 JSON이 `null`이면 매칭 프로세서 없음 → 경고 출력 + 그 placeholder 보존(replacement 안 만듦). 결과가 객체면 그 프로세서 이름으로 호출:
  ```bash
  cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
    SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
      --name <processor-name> \
      --input-file "<placeholder.path>" \
      --out "build/.cache/svg/<placeholder.id>.svg"
  ```
  성공 시 replacement: 원래 `![alt](path)`를 `![alt](build/.cache/svg/<id>.svg)`로 바꿈.

- **`kind: semantic`** → LLM judgment dispatch:
  1. `list-capabilities` 결과 확인 (1단계에서 이미 doctor가 검증).
  2. placeholder의 `alt` 텍스트를 보고 적합한 능력 결정:
     - "차트", "그래프" → `chart.*`
     - "다이어그램", "플로우" → `diagram.*`
     - "고양이/사진/실사" → `stock.photo`
     - "일러스트/생성/추상" → `image.generate`
  3. 그 능력의 등록된 프로세서 중 하나 선택 (`list-capabilities`의 `providers[0]` 추천).
  4. 능력별로 호출 인자 구성:
     - `stock.photo` via pexels:
       1. 검색:
          ```bash
          cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
            SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
              --name pexels \
              --http-path "/search?query=$(echo '<alt 자연어>' | jq -sRr @uri)&per_page=1" \
              --out "/tmp/pexels-<id>.json"
          ```
       2. 결과 JSON 읽고 `photos[0].src.large` URL 추출.
       3. 그 URL을 다운로드 (Bash `curl -L "$URL" -o build/.cache/img/<id>.jpg` 또는 별도 fetch). 인증 헤더는 다운로드엔 불필요.
     - `image.generate` (gemini-image): `--http-method POST --input "<prompt>"` + 응답 디코딩.
     - `diagram.*` (mermaid-cli): 먼저 LLM이 mermaid 소스 문자열을 만들어 `assets/diagrams/auto-<id>.mmd`에 저장 → 그 다음 file-ref와 동일한 흐름으로 SVG 변환. 사용자가 나중에 output.md에서 `![alt](assets/diagrams/auto-<id>.mmd)`로 락인할 수 있음.
  5. 호출 결과(이미지 또는 SVG)를 `build/.cache/img/<id>.<ext>` 또는 `build/.cache/svg/<id>.svg`에 저장.
  6. replacement: 원래 `![alt]()`를 `![alt](build/.cache/img/<id>.<ext>)`로 바꿈.

### MCP 백엔드 특수 처리

`backend.type: mcp`인 프로세서가 매칭되면 (예: excalidraw-mcp) `run-processor` 스크립트는 그 호출을 처리하지 못합니다. 대신 LLM이 Claude Code의 해당 MCP 도구를 직접 호출:

1. `dispatch-file-ref` 결과의 `backend` 필드 확인.
2. `backend.type === 'mcp'`이면 → 그 `server`/`tool`을 Claude Code의 MCP 도구로 직접 호출 (예: excalidraw 서버의 `render_to_svg` 도구).
3. 결과 SVG 바이트를 `build/.cache/svg/<id>.svg`에 저장.
4. 이후 흐름은 cli 백엔드와 동일 (replacement 추가).

MCP 서버가 현재 세션에 떠있지 않으면 doctor가 ⚠️로 경고했을 것이므로 그 경고를 사용자에게 환기하고 해당 placeholder는 보존(스킵).

### 4. Inject

성공한 replacement들을 모아 JSON 배열로 만든 뒤:

```bash
cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
  SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts inject output.md \
    --replacements "/tmp/replacements.json" \
    --out "build/.cache/prerendered.md"
```

### 5. Report

사용자에게 보고:
- 처리된 placeholder 수: N
- 통과한 일반 이미지: M
- 실패/스킵된 placeholder: K (각각 어떤 ID, line, 이유)
- 다음 단계 안내: "`/slidesmith:export`로 PDF/HTML 생성하세요."

## Failure policy (스펙 §10.1)

- 개별 placeholder 실패 시 retry 1회 → 그래도 실패하면 그 placeholder는 그대로 두고 (replacement 추가 안 함) 계속 진행.
- 매칭 프로세서 0건이면 silent skip 절대 금지 — 경고 출력.
- doctor light check가 실패하면 prerender 시작 전에 중단.
- output.md / blueprint.md / assets/ 는 절대 수정 안 함 (semantic dispatch에서 새로 만드는 `assets/diagrams/auto-<id>.mmd`는 *생성*이므로 허용, 기존 파일 덮어쓰기는 금지).
