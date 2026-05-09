---
marp: true
theme: midnight-tech
paginate: true
---

# 시스템 아키텍처 리뷰

플랫폼 팀 / 2026 Q1

---

## 컨텍스트

- 트래픽 4배 증가 → 기존 모놀리스가 한계
- 결제 모듈에서 p99 지연 8s 관측
- 목표: p99 < 1s, 무중단 배포

---

## 현재 흐름

![signup flow](assets/diagrams/signup-flow.mmd)

병목: 모듈 간 동기 호출 체인.

---

## 제안: 비동기 분리

```typescript
// before
await chargeCard(orderId);
await sendReceipt(orderId);

// after
await queue.publish('order.charged', orderId);
// receipt is consumed elsewhere
```

이벤트 큐를 통한 fire-and-forget.

---

## 트레이드오프

| 측면 | 현재 | 제안 |
|---|---|---|
| 일관성 | 강 | 결과적 |
| 지연 | 느림 | 빠름 |
| 운영 부하 | 낮음 | 중간 |

---

## 다음 단계

1. 결제 모듈만 우선 분리 (1주)
2. 큐 SLA 정의 (3일)
3. 단계적 rollout (5%, 25%, 100%)
