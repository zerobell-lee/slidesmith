---
description: Run plan + prerender + export sequentially
argument-hint: [--from plan|prerender|export]
---

# /slidesmith:build

`/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export`를 순서대로 실행.

## Arguments

- `--from <stage>` (선택): 어디서부터 다시 실행할지. 기본은 `plan`. 값: `plan`, `prerender`, `export`.

## Process

1. `--from prerender`이면 plan 단계 건너뜀. `output.md`가 없으면 사용자에게 "먼저 plan부터 실행하세요." 안내 후 중단.

2. `--from export`이면 plan + prerender 모두 건너뜀. `build/.cache/prerendered.md`가 없으면 안내 후 중단.

3. 각 단계 시작 전에 진행 상황 한 줄 출력:
   - "🎨 plan 단계 시작..."
   - "🔧 prerender 단계 시작..."
   - "📦 export 단계 시작..."

4. 각 단계는 해당 슬래시 커맨드의 본문 절차 그대로 실행. (즉, build는 다른 커맨드를 *호출*하는 게 아니라 그 절차를 인라인으로 수행)

5. 어느 단계에서든 실패하면 즉시 중단. 어느 단계에서 실패했는지 명확히 알리고 그 단계의 failure handling 안내.

6. 모든 단계 성공 시 사용자에게 최종 결과물 경로(`build/deck.pdf` 등) 보고.
