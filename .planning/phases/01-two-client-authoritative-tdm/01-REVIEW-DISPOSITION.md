---
phase: "01"
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Public matchmaking creates permanently retained rooms without admission bounds"
  - id: CR-02
    severity: critical
    disposition: open
    title: "Shared-map URL data executes JavaScript through the menu card"
  - id: CR-03
    severity: critical
    disposition: open
    title: "Legitimate hits disappear when projectile impacts reorder shot IDs"
  - id: CR-04
    severity: critical
    disposition: open
    title: "Confirmations can precede their generation patch and are dropped permanently"
  - id: CR-05
    severity: critical
    disposition: open
    title: "The visible KILLS counter does not consume authoritative kills"
open: 5
total: 5
---

# Phase 01 Code Review Disposition

| Finding | Severity | Disposition | Source |
| --- | --- | --- | --- |
| CR-01 | critical | open | Reproduced public admission allocation; fix in progress |
| CR-02 | critical | open | Inherited scoped map-card XSS; fix in progress |
| CR-03 | critical | open | Reproduced reversed shot impact feedback; fix in progress |
| CR-04 | critical | open | Reproduced confirmation-before-patch race; fix in progress |
| CR-05 | critical | open | Reproduced authoritative/HUD kill mismatch; fix in progress |
