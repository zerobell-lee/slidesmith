# slidesmith

Marp 기반 Claude Code 플러그인. 자연어 입력만으로 발표 자료(PDF/HTML/PPTX)를 생성합니다.

## 설치

1. **의존성**:
   ```bash
   npm i -g @marp-team/marp-cli
   npm i -g @mermaid-js/mermaid-cli   # mermaid 사용 시
   ```

2. **플러그인 의존성 설치**:
   ```bash
   cd <plugin-root>/scripts && npm install
   ```

3. **doctor로 환경 확인**:
   ```
   /slidesmith:doctor
   ```

## 빠른 시작

```
# 1. 새 프로젝트
/slidesmith:new my-deck --theme midnight-tech --lang ko

# 2. blueprint.md 편집 (또는 그대로 sample 사용)

# 3. 한 번에 빌드
/slidesmith:build

# 결과: my-deck/build/deck.pdf
```

## 단계별 빌드

```
/slidesmith:plan         # blueprint → output.md
/slidesmith:prerender    # placeholder 변환 → build/.cache/prerendered.md
/slidesmith:export       # marp-cli → build/deck.pdf
```

## 테마

번들: `default`, `midnight-tech`, `editorial`. 사용 가능한 테마 보기:

```
/slidesmith:theme list
```

다른 사람의 테마 추가:

```
/slidesmith:theme add https://github.com/<user>/<repo>
```

## 문서

- 디자인 스펙: `docs/superpowers/specs/2026-04-30-slidesmith-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-30-slidesmith.md`

## 라이선스

레포지토리 루트의 `LICENSE` 파일을 따릅니다.
