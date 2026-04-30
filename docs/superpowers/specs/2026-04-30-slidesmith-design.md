# slidesmith — Design Spec

**Date:** 2026-04-30
**Status:** Draft (pending implementation plan)
**Authors:** bnb3456@gmail.com (with Claude Code)

---

## 1. Overview

`slidesmith`는 Marp를 렌더러로 활용해 NotebookLM 수준의 슬라이드 생성 경험을 Claude Code 안에서 제공하는 플러그인이다. 단순히 Marp를 스킬로 노출하는 것이 아니라:

- **큐레이션된 테마**(메타데이터·다국어 샘플 포함)
- **확장 가능한 prerender 파이프라인**(mermaid·excalidraw·스톡포토·이미지 생성·MCP 위임 등)
- **LLM 주도 슬라이드 기획**(blueprint·assets·대화 기반)
- **프로젝트/테마 디렉토리 컨벤션**

을 묶어 "쓸만한 테마가 없다"는 Marp 사용 시 핵심 마찰을 해소하고, 사용자가 자연어 입력만으로 발표용 PDF/HTML/PPTX를 산출할 수 있게 한다.

### 1.1 비-목표 (Non-goals)

- Marp 자체 대체 또는 자체 렌더 엔진 구현 (marp-cli에 위임)
- 실시간 협업 편집기·웹 UI (CLI/슬래시 커맨드만)
- 테마 마켓플레이스/레지스트리 운영 (git 기반 분산 배포만)

### 1.2 성공 기준

- v1 출하 시 번들된 3개 테마(`default`, `midnight-tech`, `editorial`) + 4개 프로세서(`mermaid-cli`, `excalidraw-mcp`, `pexels`, `gemini-image`)로 사용자가 한 번도 CSS를 안 만지고 발표 PDF 산출 가능
- 새 테마/프로세서 추가가 디렉토리 한 개 + 매니페스트 한 개로 끝나는 구조
- LLM 호출 비용이 결정적 작업으로 새지 않도록 분담(스크립트 = 결정적, LLM = 판단)

---

## 2. 전체 아키텍처

3층 구조:

```
┌────────────────────────────────────────────────────────────┐
│  슬래시 커맨드 (slidesmith:plan, prerender, export, build,  │ ← LLM 진입점
│   theme, new, doctor)                                        │
└──────────────┬─────────────────────────────┬───────────────┘
               │ (LLM 판단·창작)              │ (결정적 작업)
               ▼                             ▼
   ┌───────────────────────┐    ┌────────────────────────────┐
   │ LLM 책임               │    │ Node/TS 스크립트 (tsx)      │
   │ - 슬라이드 작성         │    │ - placeholder 탐지          │
   │ - 매니페스트 읽고       │    │ - 프로세서 호출 (CLI/HTTP/MCP)│
   │   semantic dispatch    │    │ - output.md 주입            │
   │ - 사용자와 Q&A         │    │ - marp-cli 실행             │
   └───────────────────────┘    │ - 환경 검증 (doctor)        │
                                 └────────────────────────────┘
                                              │
                                              ▼
                                  ┌──────────────────────┐
                                  │ 데이터 (디스크)        │
                                  │ - 테마 (번들/유저/프로젝트)│
                                  │ - 프로세서 매니페스트   │
                                  │ - 프로젝트 디렉토리     │
                                  └──────────────────────┘
```

### 2.1 핵심 설계 원칙

1. **결정적 작업은 스크립트, 판단은 LLM** — 정규식 매칭·파일 I/O·subprocess 호출은 모두 Node/TS 스크립트. LLM은 슬라이드 작성, 매니페스트 기반 dispatch, 사용자 Q&A에만 사용.
2. **능력(capability) ↔ 백엔드(processor) 디커플링** — 덱은 인텐트만 표현, 어떤 백엔드가 처리할지는 사용자 환경이 결정.
3. **매니페스트로 모든 확장 포인트 선언** — 디렉토리 추가만으로 새 테마/프로세서.
4. **우선순위는 프로젝트 ↑ 사용자 ↑ 번들** — 같은 이름이면 더 가까운 쪽이 이김.
5. **사용자 영역 보호** — `prerender`/`export` 스크립트는 `output.md`·`blueprint.md`·`assets/` 수정 금지. 산출물은 `build/.cache/` 또는 `build/`. (`plan`은 예외적으로 `output.md`를 생성/덮어쓰지만, 기존 파일이 있으면 사용자에게 확인 후 진행)

---

## 3. 플러그인 레이아웃

```
slidesmith/                            # 플러그인 루트 (배포 단위)
├── README.md
├── plugin.json                        # Claude Code 플러그인 매니페스트
├── commands/                          # 슬래시 커맨드 (.md)
│   ├── plan.md                        # /slidesmith:plan
│   ├── prerender.md                   # /slidesmith:prerender
│   ├── export.md                      # /slidesmith:export
│   ├── build.md                       # /slidesmith:build (wrapper)
│   ├── theme.md                       # /slidesmith:theme add/list/remove/update
│   ├── new.md                         # /slidesmith:new (프로젝트 부트스트랩)
│   └── doctor.md                      # /slidesmith:doctor
├── scripts/                           # Node/TS 헬퍼 (tsx 런타임)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── cli.ts                     # 단일 진입점, subcommand dispatch
│       ├── detect.ts                  # placeholder 탐지
│       ├── dispatch.ts                # 매니페스트 로딩·매칭
│       ├── inject.ts                  # placeholder → 결과 치환
│       ├── export.ts                  # marp-cli 호출
│       ├── theme.ts                   # 테마 install/list/remove/update
│       ├── doctor.ts                  # 환경 검증
│       └── lib/
│           ├── manifest.ts            # YAML 매니페스트 파서
│           ├── paths.ts               # bundled/user/project 경로 해석
│           ├── env.ts                 # .env + process.env 머지
│           └── proc.ts                # CLI/HTTP/MCP 호출 어댑터
├── prerenders/                        # 번들 프로세서
│   ├── mermaid-cli/
│   │   ├── manifest.yaml
│   │   └── handler.ts                 # (선택) 특수 후처리
│   ├── excalidraw-mcp/
│   ├── pexels/
│   └── gemini-image/
└── themes/                            # 번들 테마
    ├── default/
    ├── midnight-tech/
    └── editorial/
```

**스크립트 호출 컨벤션:**
슬래시 커맨드는 `tsx scripts/src/cli.ts <subcommand> [args]` 단일 진입점으로 호출한다. subprocess overhead·의존성 트리 재로드 비용을 피하기 위함.

---

## 4. 테마 시스템

### 4.1 테마 디렉토리 구조

```
themes/<name>/
├── theme.yaml              # 메타데이터 (필수)
├── theme.css               # Marp CSS (필수)
├── samples/                # 다국어 샘플 (1개 이상 권장)
│   ├── sample.md           # 한국어 (기본)
│   ├── sample.en.md
│   └── sample.jp.md
├── prerender.yaml          # 권장 prerender 설정 (선택)
├── assets/                 # 동봉 폰트/로고/배경 (선택)
└── README.md               # 사람이 읽는 가이드 (선택)
```

### 4.2 `theme.yaml` 스키마

```yaml
name: midnight-tech                   # 식별자 (디렉토리명과 일치)
displayName: Midnight Tech
version: 0.1.0
author: slidesmith
description: 다크 톤의 기술 발표용 테마
tags: [technical, dark, code-heavy]
fits: [technical-talk, code-walkthrough]
constraints:                          # LLM에 전달되는 규칙
  - "h1은 슬라이드 제목, h2는 섹션 분기로 사용"
  - "code block에 line numbers 자동 적용 (긴 코드는 가독성 저하)"
samples:
  default: samples/sample.md
  en: samples/sample.en.md
  jp: samples/sample.jp.md
recommendedPrerenders:                # 선택
  - mermaid-cli
  - excalidraw-mcp
```

### 4.3 해석 우선순위

`theme: midnight-tech` 검색 순서:

1. `<project>/.slidesmith/themes/midnight-tech/` (프로젝트 로컬)
2. `~/.slidesmith/themes/midnight-tech/` (사용자 글로벌)
3. `<plugin>/themes/midnight-tech/` (번들)

같은 이름이면 가까운 쪽이 이김. `--theme-source bundled` 플래그로 강제 가능.

### 4.4 Override CSS

프로젝트의 `overrides.css`는 테마 CSS 뒤에 cascade로 결합. marp-cli에 추가 CSS 주입 지원이 약하므로, **빌드 시 임시 합성 테마 CSS 생성**:

```
build/.cache/_combined-theme.css = theme.css + "\n" + overrides.css
```

투명 동작, 디버깅 시 `.cache`에서 확인 가능.

### 4.5 다국어 샘플 활용

`/slidesmith:new --theme midnight-tech --lang en` 실행 시:

1. 테마의 `theme.yaml > samples` 매핑에서 `en` 키 조회 → `samples/sample.en.md`
2. 키가 없으면 `default` 키로 fallback (예: `--lang ko` 인데 `samples.ko` 없으면 `samples.default` 사용)
3. 그래도 없으면 명시적 에러

해당 파일이 `blueprint.md`로 복사되어 plan 단계의 형식 가이드 역할.

---

## 5. 프로젝트 시스템

### 5.1 프로젝트 디렉토리 구조

```
<project>/
├── deck.yaml                          # 프로젝트 메타 (필수)
├── blueprint.md                       # 장문 지시사항 (선택, master 입력)
├── assets/                            # 입력 자료
│   ├── diagrams/                      # mermaid/excalidraw 소스 파일
│   ├── charts/                        # vega-lite 등 차트 스펙
│   └── images/                        # 일반 이미지
├── overrides.css                      # 테마 부분 오버라이드 (선택)
├── output.md                          # plan 산출물 (사용자 편집 영역)
├── .slidesmith/
│   └── themes/                        # 프로젝트 로컬 테마 (선택)
├── .env                                # 프로젝트별 secrets (선택)
└── build/                              # 산출물 (.gitignore 권장)
    ├── deck.pdf
    ├── deck.html
    ├── deck.pptx                      # 옵션
    └── .cache/
        ├── _combined-theme.css
        ├── prerendered.md             # placeholder 치환 후
        ├── svg/                       # 변환된 다이어그램
        └── img/                       # 다운로드/생성된 이미지
```

### 5.2 `deck.yaml` 스키마

```yaml
title: Q4 Engineering Review
theme: midnight-tech                   # 우선순위로 해석
language: ko                           # 샘플 매칭, frontmatter lang에도 반영
formats: [pdf, html]                   # /slidesmith:export 기본 출력
output:
  basename: deck                       # → build/deck.pdf 등
overrides:
  css: overrides.css                   # 선택
prerender:
  # 비워두면 환경/매니페스트 우선순위로 자동
  # 예외 케이스만 명시:
  # - capability: stock.photo
  #   processor: pexels                # 잠금
plan:
  blueprint: blueprint.md              # 기본값, 없으면 자동 탐지
  assets: assets                       # 기본값
```

### 5.3 `/slidesmith:new` — 부트스트랩

```
/slidesmith:new <project-name> --theme <theme> --lang <ko|en|jp>
```

동작:

1. 디렉토리 생성, `deck.yaml` 시드
2. 선택한 테마의 sample을 `blueprint.md`로 복사 (예시이자 출발점). 언어 해석은 §4.5 규칙을 따름.
3. `assets/{diagrams,charts,images}/` 빈 디렉토리, `.gitignore`에 `build/` 추가
4. README 한 줄 안내

### 5.4 입력 처리 컨벤션

`/slidesmith:plan`은 zero-config 흐름:

- `blueprint.md` 존재 → **master**, 다른 입력은 보충
- 없으면 `assets/` + 채팅 컨텍스트 자동 종합
- `--no-blueprint`, `--from "직접 텍스트"` 플래그로 오버라이드
- 산출물은 단일 `output.md` (사용자가 직접 수정 가능)

---

## 6. 빌드 파이프라인

### 6.1 4-스테이지 흐름

```
                 사용자 의도
                     │
                     ▼
┌────────────────────────────────────────┐
│ /slidesmith:plan                       │  blueprint·assets·대화 → output.md
│  (LLM 주도, 스크립트 보조)              │  (semantic placeholder 포함)
└──────────────────┬─────────────────────┘
                   │
                   ▼  output.md
┌────────────────────────────────────────┐
│ /slidesmith:prerender                  │  placeholder 탐지·매칭·변환
│  (LLM dispatch, 스크립트 실행)          │  → build/.cache/prerendered.md
└──────────────────┬─────────────────────┘  → build/.cache/{svg,img}/
                   │
                   ▼  prerendered.md
┌────────────────────────────────────────┐
│ /slidesmith:export                     │  marp-cli 실행
│  (스크립트만)                           │  → build/deck.{pdf,html,pptx}
└──────────────────┬─────────────────────┘
                   │
                   ▼
            build/deck.pdf 등
```

`/slidesmith:build`는 위 셋의 wrapper. `--from prerender` 플래그로 중간 재진입.

### 6.2 Stage 1 — `/slidesmith:plan`

**LLM 책임**: blueprint/assets/대화에서 슬라이드 구조 추출 + Marp 마크다운 작성
**스크립트 보조**:

- `cli.ts list-capabilities` → 현재 환경에서 가용한 prerender 능력 (LLM이 placeholder 종류 결정에 사용)
- `cli.ts theme-info <theme>` → 테마 constraints·샘플 메타

**출하물**: `output.md`

**컨벤션**: prerender 필요한 컨텐츠는 **반드시 외부 파일**로. 즉 LLM은:

- 다이어그램 → `assets/diagrams/<slug>.{mmd,excalidraw}` 파일 생성 + output.md엔 `![alt](assets/diagrams/<slug>.mmd)` 참조만
- 차트 → `assets/charts/<slug>.vl.json`
- 이미지 (있으면) → `assets/images/<slug>.png` 참조
- 이미지 (없으면, 생성 필요) → semantic placeholder `![alt]()` (빈 src)
- 코드블록은 *진짜 예제 코드*에만 사용 (다이어그램 소스 ❌)

**모호한 입력 처리**: blueprint가 모호하면 LLM이 1-2개 짧은 질문 → 답 받고 진행. 또는 가정으로 진행하되 frontmatter에 `# TODO:` 주석.

### 6.3 Stage 2 — `/slidesmith:prerender`

**Placeholder 분류 (3가지)**:

| 형태 | 패턴 | 처리 |
|---|---|---|
| 일반 이미지 | `![alt](assets/images/hero.png)` | 통과 |
| 변환 대상 파일 | `![alt](assets/diagrams/x.mmd)` 등 | 확장자 → 프로세서 매칭 |
| Semantic placeholder | `![자연어 설명]()` | LLM dispatch |

**스크립트 단계**:

1. `cli.ts detect <output.md>` → JSON
   ```json
   [
     {"id":"p1","kind":"file-ref","path":"assets/diagrams/signup.mmd","ext":".mmd","line":23},
     {"id":"p2","kind":"semantic","alt":"고양이가 창가에 앉아있는 사진","line":45},
     {"id":"p3","kind":"image","path":"assets/images/hero.png","line":52}
   ]
   ```

2. **LLM dispatch**: 각 placeholder별
   - `kind: file-ref` → 매니페스트 `extensions` 매칭. 단일 매칭은 자동, 다중은 priority/사용자 config로 결정.
   - `kind: semantic` → LLM이 alt 텍스트 보고 적합한 능력 결정 (`stock.photo`, `image.generate`, `diagram.*`) + 그 능력의 백엔드 선택 + 호출 인자 구성.
   - `kind: image` → 통과.

3. 스크립트가 dispatch 결정에 따라 호출:
   ```
   cli.ts run-processor --name pexels --capability stock.photo \
                        --query "cat sitting by window" \
                        --out build/.cache/img/p2.jpg
   ```
   백엔드 어댑터(`lib/proc.ts`)가 CLI/HTTP/MCP 분기.

4. `cli.ts inject` → output.md → `build/.cache/prerendered.md`로 복사하면서 placeholder를 결과 경로로 치환. **output.md는 수정 안 함**.

**Semantic dispatch 시 source 파일 처리**: LLM이 다이어그램 능력으로 dispatch한 경우 (예: "가입 플로우 다이어그램"), 프로세서가 source 파일도 `assets/diagrams/auto-<id>.mmd`에 저장하고 SVG도 cache에. 사용자가 결과를 마음에 들어하면 수동으로 `![alt](assets/diagrams/auto-<id>.mmd)`로 교체해 "락인" 가능.

### 6.4 Stage 3 — `/slidesmith:export`

스크립트만:

1. `_combined-theme.css = theme.css + overrides.css` 생성
2. marp-cli 호출:
   ```
   marp build/.cache/prerendered.md \
        --theme build/.cache/_combined-theme.css \
        --pdf --html --output build/deck
   ```
3. `formats`에 따라 반복 (`pptx`는 `--pptx`)

### 6.5 Stage 4 — `/slidesmith:build` (wrapper)

```
/slidesmith:build [--from plan|prerender|export]
```

- 기본: 1→2→3 전부
- `--from prerender`: output.md 그대로 두고 2부터
- 단계별 진행 상황 출력

---

## 7. Prerender 시스템

### 7.1 매니페스트 스키마

```yaml
name: mermaid-cli                     # 프로세서 식별자
provides: [diagram.mermaid]           # 처리하는 능력 (capability)
matches:
  extensions: [.mmd, .mermaid]        # 파일 매칭
backend:
  type: cli                           # cli | http | mcp
  cmd: mmdc                           # 백엔드 타입별 추가 필드
requires:
  binaries: [mmdc]                    # 환경 요구 (doctor에서 검증)
priority: 50                          # 같은 capability 다중 등록 시 우선순위
```

**백엔드 타입별 필드:**

```yaml
# CLI
backend: { type: cli, cmd: mmdc, args: ["-i", "{input}", "-o", "{output}"] }
requires: { binaries: [mmdc] }

# HTTP
backend: { type: http, base: "https://api.pexels.com/v1", auth: "header:Authorization:{env.PEXELS_API_KEY}" }
requires: { env: [PEXELS_API_KEY] }

# MCP
backend: { type: mcp, server: excalidraw, tool: render_to_svg }
requires: { mcp: [excalidraw] }
```

### 7.2 능력(capability) 명명 규칙

`<domain>.<subtype>` 점 구분. 예시:

- `diagram.mermaid`, `diagram.excalidraw`, `diagram.plantuml`
- `chart.vega-lite`, `chart.matplotlib`
- `stock.photo`, `stock.illustration`
- `image.generate`, `image.upscale`
- `code.screenshot` (코드 블록 → 예쁜 이미지)

새 능력 추가 = 매니페스트에 새 `provides` 값 등록.

### 7.3 v1 번들 프로세서

| 이름 | 능력 | 백엔드 | 의존성 |
|---|---|---|---|
| `mermaid-cli` | `diagram.mermaid` | CLI (`mmdc`) | `@mermaid-js/mermaid-cli` 전역 설치 |
| `excalidraw-mcp` | `diagram.excalidraw` | MCP | `excalidraw` MCP 서버 |
| `pexels` | `stock.photo` | HTTP | `PEXELS_API_KEY` |
| `gemini-image` | `image.generate` | HTTP | `GEMINI_API_KEY` |

### 7.4 Dispatch 로직 (요약)

1. `kind: file-ref` → `matches.extensions` 정확 매칭 → 단일이면 자동, 다중이면 사용자 config(`~/.slidesmith/config.yaml`) 또는 `priority`로 결정.
2. `kind: semantic` → LLM이 매니페스트 목록(`provides` + `description`)을 보고 능력 선택 → 백엔드 선택은 위와 동일.
3. 매칭 0건이면 명시적 경고 (silent skip 금지).

### 7.5 사용자 config 오버라이드

`~/.slidesmith/config.yaml`:

```yaml
preferred:
  diagram.mermaid: mermaid-cli         # 동률일 때 이쪽 우선
  stock.photo: unsplash                # 사용자가 unsplash 추가 설치한 경우
```

프로젝트 단위 잠금이 필요하면 `deck.yaml`의 `prerender:` 항목 사용.

---

## 8. 구성 / Secrets

### 8.1 우선순위

1. 프로젝트 `<project>/.env`
2. 프로세스 환경변수 (`process.env`)
3. 매니페스트 `requires.env` 누락 시 명시적 에러

### 8.2 매니페스트 선언

각 프로세서 매니페스트가 `requires.env: [...]` 선언 → `doctor`가 사전 검증, 누락 시 사용자에게 어떤 키를 어디 두면 되는지 안내.

### 8.3 `~/.slidesmith/`

```
~/.slidesmith/
├── config.yaml                    # 사용자 글로벌 선호 (preferred 등)
└── themes/
    ├── <user-theme-1>/
    └── ...
```

별도 secret store는 운영하지 않음.

---

## 9. 테마 관리

### 9.1 흐름

- **번들 테마**: 플러그인 안 `themes/`. 업데이트는 플러그인 업그레이드와 함께.
- **사용자 글로벌 테마**: `~/.slidesmith/themes/`. git 기반 add/remove/update.
- **프로젝트 로컬 테마**: `<project>/.slidesmith/themes/`. 시험·실험용. 만족하면 글로벌로 승격.

### 9.2 커맨드

```
/slidesmith:theme list                          # 모든 source의 테마 나열 + 우선순위 표시
/slidesmith:theme add <git-url> [--name <id>]   # ~/.slidesmith/themes/<id>/ 에 git clone
/slidesmith:theme update [<name>|--all]         # git pull
/slidesmith:theme remove <name>                 # 사용자 글로벌만 제거 가능 (번들·프로젝트 별도)
/slidesmith:theme info <name>                   # theme.yaml 메타 + 샘플 경로 표시
```

### 9.3 테마 작자 입장

- 자기 git repo 하나 (`themes/<name>/` 구조 따른 단일 디렉토리)
- README에 사용법·제약·샘플 스크린샷
- 사용자는 `/slidesmith:theme add <git-url>`로 끝

별도 레지스트리 운영 없음.

---

## 10. 에러 처리 / Doctor / 테스트

### 10.1 에러 처리 원칙

- **Fail-fast on environment**: `/slidesmith:build` 시작 시 doctor light check 자동. marp-cli·필수 매니페스트 누락이면 즉시 중단.
- **Soft-fail per placeholder**: prerender에서 개별 placeholder 실패는 retry 1회 → 보존하고 계속 → 빌드 끝에 요약. 한 다이어그램 실패가 전체 차단 안 함.
- **Silent skip 금지**: 매칭 안 된 placeholder는 항상 명시적 경고.
- **사용자 영역 보호**: `prerender`/`export` 스크립트는 `output.md`·`blueprint.md`·`assets/` 수정 금지. 모든 산출물은 `build/.cache/` 또는 `build/`. `plan`은 `output.md`를 생성/덮어쓰지만, 기존 파일이 있으면 사용자 확인 후 진행.

### 10.2 `/slidesmith:doctor`

검증 항목:

- marp-cli 설치 / 버전
- Node.js 버전
- 모든 prerender 매니페스트 lint (YAML 파싱·필수 필드)
- 등록 프로세서가 요구하는 env/binary/MCP 가용성 (`.env` 머지 후)
- 출력은 항목별 ✅/❌/⚠️ 표

자동 호출: `/slidesmith:build` 시작 시 light check (fail-fast). full check는 명시 호출만.

### 10.3 테스트 전략

**스크립트 (Node/TS) — vitest**:

- `detect.ts` 단위 테스트: 다양한 마크다운 입력 → 기대 JSON
- `dispatch.ts`: 매니페스트 우선순위·매칭 로직
- `inject.ts`: placeholder 치환 정확성
- `paths.ts`: 테마 해석 우선순위 (project > user > bundled)
- `proc.ts`: 백엔드 어댑터는 인터페이스 모킹

**Fixture 통합 테스트**: `tests/fixtures/`에 미니 프로젝트 5종

- `simple/` — blueprint + 1 다이어그램
- `multilang/` — 3개 언어 sample 사용
- `overrides/` — overrides.css 적용
- `missing-secret/` — env 누락 시나리오 (doctor가 잡아내는지)
- `processor-failure/` — 프로세서 호출 실패 시 soft-fail 검증

**LLM 영역 (슬래시 커맨드 body, semantic dispatch)**:

자동 테스트 안 함. 매뉴얼 시나리오 체크리스트만 README에. 재현 가능한 예시 프로젝트 3개 동봉.

---

## 11. v1 출하 범위

### 11.1 번들 테마 (3개)

- `default` — 깔끔한 일반용 (Claude Code-스러운 톤)
- `midnight-tech` — 다크, 기술 발표용 (코드 블록 강조)
- `editorial` — 라이트, 텍스트 중심 발표/리포트용

각 테마는 `samples/sample.{md,en.md,jp.md}` 3개 언어 샘플 동봉.

### 11.2 번들 프로세서 (4개)

- `mermaid-cli` — `diagram.mermaid`
- `excalidraw-mcp` — `diagram.excalidraw`
- `pexels` — `stock.photo`
- `gemini-image` — `image.generate`

### 11.3 v1.x 후보 (out of scope for v1)

- `pitch` 테마 (마케팅/제품 피치용)
- `chart-cli` 프로세서 (vega-lite)
- `code.screenshot` 능력 (Carbon 등)
- 테마 마켓플레이스/검색

---

## 12. 의사결정 로그

| # | 질문 | 결정 |
|---|---|---|
| Q1 | 테마 저장 위치 | 하이브리드: 번들 + `~/.slidesmith/themes/`, 우선순위 user > bundled |
| Q2 | Marp 실행 방법 | marp-cli 가정 + 첫 실행 시 doctor 검증·온보딩 |
| Q3 | Prerender 확장 구조 | 매니페스트 기반 프로세서 (디렉토리 + manifest.yaml) |
| Q4 | 빌드 파이프라인 단계 | 4-스테이지: plan → prerender → export + build wrapper |
| Q5 | 테마 관리 방식 | git 기반 글로벌 + 프로젝트 로컬 우선순위 |
| Q6 | Plan 입력 처리 | zero-config + blueprint master + 플래그 오버라이드 |
| Q6.5 | Plan 산출물 | 단일 `output.md` (사용자 직접 수정 가능) |
| Q7 | 테마 메타 형식 | `theme.yaml` (별도 파일, YAML) + `samples/` 디렉토리 |
| Q8 | 프로젝트 구조 | `deck.yaml` + `blueprint.md` + `assets/` + `output.md` + `build/` |
| Q9 | Secrets 처리 | env 변수 + 프로젝트 `.env` 오버라이드 |
| Q10 | Placeholder 컨벤션 | 능력↔백엔드 디커플링 + 잠금 옵션 + 명시적 경고. 모든 prerender 컨텐츠는 외부 파일. 형태 3가지(일반 이미지 / 파일 참조 / semantic). |
| Q11 | 스크립트 도입 | Node/TS 헬퍼(tsx 런타임) + LLM은 판단·창작만 |
| Q12 | v1 번들 범위 | 테마 3개(default, midnight-tech, editorial) + 프로세서 4개(mermaid-cli, excalidraw-mcp, pexels, gemini-image) |
| 명명 | 프로젝트 이름 | `slidesmith` |

---

## 13. 다음 단계

이 spec이 승인되면 `superpowers:writing-plans` 스킬로 단계별 구현 계획 작성.
