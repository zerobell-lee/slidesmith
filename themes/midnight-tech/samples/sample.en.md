---
marp: true
theme: midnight-tech
paginate: true
---

# System Architecture Review

Platform Team / 2026 Q1

---

## Context

- Traffic up 4× — monolith hitting limits
- p99 latency 8s on payments
- Goal: p99 < 1s, zero-downtime deploys

---

## Current Flow

![signup flow](assets/diagrams/signup-flow.mmd)

Bottleneck: synchronous chains across modules.

---

## Proposal: Async Split

```typescript
// before
await chargeCard(orderId);
await sendReceipt(orderId);

// after
await queue.publish('order.charged', orderId);
// receipt is consumed elsewhere
```

Fire-and-forget via event queue.

---

## Trade-offs

| Aspect | Now | Proposed |
|---|---|---|
| Consistency | Strong | Eventual |
| Latency | Slow | Fast |
| Ops | Low | Medium |

---

## Next Steps

1. Split payment module first (1 week)
2. Define queue SLA (3 days)
3. Phased rollout (5%, 25%, 100%)
