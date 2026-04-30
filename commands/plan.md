---
description: Generate output.md from blueprint, assets, and conversation
argument-hint: [--no-blueprint] [--from "직접 텍스트"]
---

# /slidesmith:plan

스펙 §6.2의 plan 단계. blueprint·assets·대화 컨텍스트를 종합해 Marp 마크다운(`output.md`)을 생성합니다.

## Pre-flight

다음 정보를 먼저 수집하세요:

1. **현재 환경에서 가용한 prerender 능력**:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts list-capabilities
   ```
   결과 JSON에서 어떤 능력(예: `diagram.mermaid`, `stock.photo`)이 사용 가능한지 파악.

2. **테마 정보**:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme-info "$(cat deck.yaml | grep '^theme:' | awk '{print $2}')"
   ```
   `manifest.constraints` 항목을 반드시 따를 것. `manifest.samples.default` 파일을 형식 가이드로 참고.

3. **입력 소스 (스펙 §5.4 우선순위)**:
   - `blueprint.md` 존재 → master. 다른 입력은 보충용.
   - 없으면 → `assets/` 디렉토리 내용 + 채팅 컨텍스트로 추론.
   - `--no-blueprint` 플래그가 주어졌으면 blueprint 무시.
   - `--from "텍스트"` 플래그가 주어졌으면 그 텍스트가 master.

## Generation rules

1. **테마 constraints 준수** — 위에서 가져온 `manifest.constraints`를 슬라이드 작성에 반영.

2. **prerender 컨텐츠는 모두 외부 파일** (스펙 §6.2):
   - 다이어그램: `assets/diagrams/<slug>.mmd` (또는 `.excalidraw`) 파일 만들고, output.md에는 `![설명](assets/diagrams/<slug>.mmd)` 참조만.
   - 차트: `assets/charts/<slug>.vl.json` (vega-lite 지원되는 경우).
   - 이미지가 이미 `assets/images/`에 있으면 직접 참조.
   - 이미지가 없고 생성/검색이 필요하면 semantic placeholder: `![alt 자연어 설명]()` (빈 src). prerender 단계에서 `image.generate` 또는 `stock.photo` 능력으로 dispatch됨.
   - **인라인 코드블록(` ```mermaid ` 등)에 다이어그램 소스를 넣지 말 것**. detect가 무시하므로 렌더되지 않음.

3. **언어**: `deck.yaml`의 `language` 필드를 따름 (기본 한국어). slide 본문, 제목, alt 텍스트 모두 그 언어로.

4. **Marp frontmatter** (output.md 맨 위):
   ```yaml
   ---
   marp: true
   theme: <theme-name from deck.yaml>
   paginate: true
   ---
   ```

5. **모호한 입력** — blueprint·자료가 빈약해서 합리적 추론이 어려우면 짧은 질문 1~2개로 사용자 확인. 가정으로 진행할 때는 슬라이드 frontmatter에 `# TODO: <가정 내용>` HTML 주석으로 남길 것.

## Write rules

1. 기존 `output.md`가 있으면 사용자에게 덮어쓸지 명시적으로 확인 (스펙 §2.1 사용자 영역 보호).

2. 새 컨텐츠를 `output.md`에 작성 (Write 도구).

3. 다이어그램 소스 파일도 같이 작성 (Write 도구).

4. 작성 끝나면 사용자에게:
   - 슬라이드 개수
   - 만든 다이어그램/소스 파일 목록
   - 사용된 semantic placeholder 개수 (prerender 단계에서 채워질 것)
   - 다음 단계 안내: "`/slidesmith:prerender`로 placeholder 변환을 진행하세요."
