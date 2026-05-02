---
marp: true
paginate: true
---

# 슬라이드 테마 쇼케이스

테마 미리보기 — 일반적인 마크다운/Marp 요소를 한 자리에서

---

## 목차

1. 도입 — 테마가 어떤 분위기를 만드는지
2. 핵심 메시지 — 본문 + 인용
3. 기술 슬라이드 — 인라인 코드 + 코드 블록
4. 데이터 슬라이드 — 표
5. 이미지 슬라이드 — 그래픽 표현
6. 마무리 — 다음 단계

---

## 핵심 메시지

테마는 콘텐츠의 톤을 결정합니다. 같은 텍스트라도 타이포그래피와 색이 바뀌면 느낌이 완전히 달라집니다.

본문 단락은 두세 줄이 적당합니다. 청중이 읽기 전에 발표자가 먼저 말을 시작할 수 있을 만큼만.

> 좋은 테마는 보이지 않는다 — 메시지가 먼저 보인다.

### 보조 헤딩 (h3)

세부 항목을 묶을 때 쓰는 작은 제목.

---

## 기술 슬라이드

런타임에서 `process.env.NODE_ENV` 같은 인라인 코드를 자연스럽게 강조하는지 확인합니다.

```typescript
// 간단한 디바운스 함수
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

코드 블록의 가독성, 줄 간격, 컬러 토큰을 확인하세요.

---

## 데이터 슬라이드

| 지표 | Q3 | Q4 | 변화 |
|---|---:|---:|---:|
| 활성 사용자 | 12,400 | 18,200 | +47% |
| 전환율 | 2.1% | 3.4% | +1.3pt |
| 평균 세션 | 4m 12s | 5m 03s | +20% |
| NPS | 38 | 46 | +8 |

표가 슬라이드 폭을 자연스럽게 채우는지, 헤더 강조가 적절한지 봅니다.

---

## 이미지 슬라이드

![sample diagram](data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200'><defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='%237c5cff'/><stop offset='1' stop-color='%234ade80'/></linearGradient></defs><rect width='400' height='200' rx='12' fill='url(%23g)' opacity='0.15'/><circle cx='100' cy='100' r='40' fill='%237c5cff' opacity='0.7'/><circle cx='200' cy='100' r='40' fill='%234ade80' opacity='0.7'/><circle cx='300' cy='100' r='40' fill='%23fb7185' opacity='0.7'/><line x1='140' y1='100' x2='160' y2='100' stroke='%23333' stroke-width='2'/><line x1='240' y1='100' x2='260' y2='100' stroke='%23333' stroke-width='2'/></svg>)

이미지 코너 처리, 외곽선, 그림자 같은 디테일을 확인합니다.

---

## 마무리

- 인쇄와 화면 양쪽에서 가독성이 유지되는지 확인
- 코드 블록과 표의 시각적 위계가 분명한지 확인
- 색 대비가 접근성 기준을 만족하는지 확인

이 쇼케이스가 선명하게 보이면, 일반적인 발표 자료에서도 잘 작동합니다.
