---
marp: true
theme: midnight-tech
paginate: true
---

# システムアーキテクチャレビュー

プラットフォームチーム / 2026 Q1

---

## コンテキスト

- トラフィック 4倍 → モノリスの限界
- 決済モジュールで p99 8秒
- 目標: p99 < 1s、無停止デプロイ

---

## 現状フロー

![signup flow](assets/diagrams/signup-flow.mmd)

ボトルネック: モジュール間の同期チェーン。

---

## 提案: 非同期化

```typescript
// before
await chargeCard(orderId);
await sendReceipt(orderId);

// after
await queue.publish('order.charged', orderId);
```

イベントキュー経由の fire-and-forget。

---

## トレードオフ

| 観点 | 現在 | 提案 |
|---|---|---|
| 一貫性 | 強 | 結果整合 |
| レイテンシ | 遅 | 速 |
| 運用負荷 | 低 | 中 |

---

## 次のステップ

1. 決済モジュールだけ先行分離 (1週)
2. キューの SLA 定義 (3日)
3. 段階的ロールアウト
