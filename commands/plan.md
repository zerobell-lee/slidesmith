---
description: Interactive brainstorm with Claude to refine the blueprint (deck spec)
---

# /slidesmith:plan

Talk through your deck idea with Claude. The output is a refined `blueprint.md` (the spec) — NOT slides. To generate slides afterwards, run `/slidesmith:build`.

## What you should do

1. Read the current `blueprint.md` and `deck.yaml`.
2. Identify the gaps — sections that are blank, contain `<...>` placeholders left over from the seed template, or are obviously stub-level.
3. Have a short Q&A with the user, **one question at a time**:
   - Topic — what is this deck about, in one sentence?
   - Audience — who is listening, and what do they already know?
   - Key messages — 3 to 5 things they should walk away with.
   - Source material — links, files in `assets/`, prior decks, references.
   - Tone — formal · casual · persuasive · didactic · etc.
   - Slide outline — rough sequence (optional; if blank, propose one once the rest is clear).
4. After each answer, update `blueprint.md` in place — fill in the section the user just spoke to. Keep the structure (`## Topic`, `## Audience`, etc.). Replace `<placeholder>` text; don't add new sections unless the user asks.
5. Stop asking when:
   - All the major sections (Topic, Audience, Key messages, Tone) have content the user is happy with.
   - The user signals they want to move on ("good", "그만", "됐어", "ㄱㄱ", etc.).
6. When done, summarize what's now in `blueprint.md` (one or two sentences per section) and tell the user: "Spec is ready. Run `/slidesmith:build` to generate the deck."

## Rules

- One question per message. Don't dump a checklist.
- Don't write slides. Don't fabricate `output.md`. The plan stage produces refined spec only.
- If the user gives a one-word answer, follow up — don't put a one-word answer into the spec.
- If `blueprint.md` is already fully populated and the user says "looks fine", skip Q&A and just confirm the spec is ready.
- When updating `blueprint.md`, use the Write tool. Preserve the H1 (`# <project> — deck spec`) and the section headers; only the body of each section changes.
