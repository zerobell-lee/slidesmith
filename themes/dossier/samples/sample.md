---
marp: true
theme: dossier
paginate: true
footer: 'CASE FILE 047  ·  INTERNAL REVIEW  ·  CONFIDENTIAL'
---

<!-- _class: hero -->
<!-- _paginate: false -->
<!-- _footer: '' -->

### CASE FILE 047  ·  CLOSED

# Payments
# *outage* postmortem

INCIDENT 2026-04-22  ·  AUTHOR ENG-PLATFORM  ·  REVIEWED 2026-05-01  ·  CIRCULATION INTERNAL

---

## Summary

On 2026-04-22 at 14:08 UTC, the payment processing queue began to *back up*. Starting at 14:14, a subset of transactions surfaced as *failures* to end users.

Recovery at 14:53. Blast radius: **roughly 17% of credit-card transactions** over 47 minutes. Internal SLA of 99.9% breached (monthly downtime budget exceeded).

This report documents the postmortem and proposes five remediations to prevent recurrence.

---

<!-- _class: stat -->

### IMPACT

# 47

## minutes of *partial outage*

12,840 transactions affected  ·  2,170 hard failures  ·  10,670 auto-recovered

---

# Timeline ― 47 minutes

<div class="timeline">

<div class="t">14:08</div><div class="e">queue dwell time spikes to <em>4×</em> baseline</div>
<div class="t">14:14</div><div class="e">user-facing payment failures begin</div>
<div class="t">14:31</div><div class="e">diagnosis: one worker holds <em>30% of the queue</em></div>
<div class="t">14:42</div><div class="e">worker fenced, queue rebalanced</div>
<div class="t">14:53</div><div class="e">queue dwell time returns to baseline</div>

</div>

---

## Direct cause

The unresponsive worker exhausted memory through a leak introduced in the *patch deployed earlier that morning*. The leak only triggered against one specific card-issuer response shape.

The direct cause is clear. The more important question is *why we didn't catch this beforehand*.

---

# Root causes ― five of them

1. No integration test against *issuer-specific response shapes*
2. Queue-worker memory alerts *too lax* (only fired at 95% utilization)
3. No automatic *fencing* for partial-worker degradation
4. Canary deploys ran with *0% real payment traffic*
5. Rollback runbook *existed* but had never been rehearsed

Catching any one of the five would have *prevented user-visible impact*.

---

<!-- _class: quote -->

> When systems fail, *surprise* is the most expensive line item.

JOHN ALLSPAW  ·  *Incident Review*, 2018

---

<!-- _class: section -->

### CHAPTER 02

# Five
# *actions*.

each with an owner and a deadline

---

# Action items

1. *Issuer-specific response regression suite* — owner ENG-PAY, due 2026-05-15
2. *Worker memory alerts* at 70%/85%/95% (three-tier) — owner SRE, due 2026-05-08
3. *Auto-fencing* for partial-worker degradation (Karma rule) — owner ENG-PLATFORM, due 2026-05-22
4. *Payment canary* at 1% → 5% → 25% steps — owner RELEASE, due 2026-05-29
5. *Quarterly rollback drill* on the calendar — owner ENG-LEAD, next: 2026-06-15

Progress is reviewed at the bi-weekly incident review.

---

<!-- _class: manifesto -->

# If the same incident
# happens *twice*,
# it is not an accident.

INTERNAL REVIEW BOARD  ·  POSITION

---

# Distribution + follow-up

Circulation: ENG, Operations, Security. No external publication.

Questions:  `incident-review@company.example`  ·  internal channel `#incident-047`

Next regular incident review: 2026-05-15 (Thu) 14:00, Building B Room 3.
