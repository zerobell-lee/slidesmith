---
marp: true
paginate: true
---

<!-- _class: hero -->
<!-- _paginate: false -->

![bg](assets/hero.svg)

# Theme Showcase

Typography, color, layout — how the same content can speak in different voices

---

<!-- _class: section -->
<!-- _paginate: false -->

## 01

# Foundations

The building blocks of a slide — title, body, quote, emphasis

---

## Contents

1. Hero & section divider — setting the tone
2. Body — text and quotation
3. Split & grid — visual material
4. Code & data — technical slides
5. Closing — what's next

---

<!-- _class: split -->

![bg right:40%](assets/portrait.svg)

## The core message

A theme decides the tone of the content. The same text feels entirely different once typography and color shift around it.

A body paragraph reads best at two or three lines. Just enough that the speaker can begin talking before the audience finishes reading.

The image fills the right half of the split; the body flows on the left.

---

<!-- _class: quote -->

> A good theme is invisible.
> The message arrives first.

— attributed to a designer, somewhere

---

## Technical slides

Check that inline code such as `process.env.NODE_ENV` is highlighted naturally inside running prose.

```typescript
// a simple debounce
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

---

## Data slides

| Metric | Q3 | Q4 | Change |
|---|---:|---:|---:|
| Active users | 12,400 | 18,200 | +47% |
| Conversion | 2.1% | 3.4% | +1.3pt |
| Avg. session | 4m 12s | 5m 03s | +20% |
| NPS | 38 | 46 | +8 |

Verify the table fills the slide width and that header emphasis reads correctly.

---

<!-- _class: stat -->

# +47%

## QoQ active-user growth

12.4K → 18.2K, lifted by conversion and NPS moving in the same direction.

---

<!-- _class: grid -->

## Visual material — 3-up

![card 1](assets/card-1.svg) ![card 2](assets/card-2.svg) ![card 3](assets/card-3.svg)

Three image cards laid out horizontally — check spacing, alignment, and aspect.

---

## Closing

- Confirm legibility holds in both print and on screen
- Confirm the visual hierarchy of code and tables stays clear
- Confirm color contrast meets accessibility requirements

If this showcase reads cleanly, the theme will work for typical presentation material.
