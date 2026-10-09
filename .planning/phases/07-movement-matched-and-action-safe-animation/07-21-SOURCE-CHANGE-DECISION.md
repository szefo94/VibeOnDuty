---
phase: 07-movement-matched-and-action-safe-animation
plan: "21"
decision: register-exception
hash_basis: pinned-lf
followup_line_endings: yes
decided: 2026-10-09
decided_by: owner
selection_basis: owner delegated to the orchestrator's stated recommendation (owner did not type the option name)
evidence:
  path: .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-21-source-change.json
  sha256: a9d82f3baf6982bb9200d81f4777877df9fd1f5ac4ec99450af2a492fd012344
  at_commit: 68bf2142c5dc11ac4e6297ac74c6063fc7189112
---

# Plan 07-21: decision on changing `src/main.js`

## What was asked

May `src/main.js`, a protected identity of the frozen V2 budget gate, be changed to fix the
pause-menu press defect under a reviewed, registered exact-hash exception?

The four options of the plan's `checkpoint:decision` were `register-exception-pinned-lf`,
`register-exception-working-bytes`, `collector-only` and `keep-open`.

## How the decision was given

This section records the exchange as it happened. It is not a record of the owner typing an
option name.

1. The orchestrator presented the four options to the owner together with the measured results
   of task 07-21-01 (the RED results, the surface table and the line-ending survey), and stated
   its own recommendation: `register-exception-pinned-lf`, with `followup_line_endings: yes`.
2. The owner replied, verbatim:

   > ok, continue, do the rational thing

3. The orchestrator read that reply as the owner delegating the selection to the orchestrator's
   stated recommendation, and told the owner so before continuing.
4. The executor that wrote this record did not see the owner's message directly. The quote and
   the steps above are as relayed by the orchestrator in the continuation dispatch.

So the recorded values come from the orchestrator's recommendation, adopted through the owner's
reply:

| Field | Value | Source |
|---|---|---|
| `decision` | `register-exception` | orchestrator recommendation, adopted by the owner's reply |
| `hash_basis` | `pinned-lf` | orchestrator recommendation, adopted by the owner's reply |
| `followup_line_endings` | `yes` | orchestrator recommendation, adopted by the owner's reply |
| `decided_by` | `owner` | the owner's reply is the authorisation; the option name was not typed by the owner |

The plan's must-have reads "The owner has decided in writing ...; no agent made that choice."
The owner's written reply authorises continuing and delegates the selection; the specific option
was named by the orchestrator, not by the owner. Anyone who needs the owner's own selection of
the option by name should ask the owner to confirm `register-exception-pinned-lf`. Until the
frozen V2 command is run in plan 07-13 the change is reversible: revert the task commits and, if
needed, put the frozen bytes back with
`node tools/art/frozen-bytes.mjs restore src/main.js --from frozen --confirm`.

## Evidence the decision rests on

`evidence/07-21-source-change.json` as committed in `68bf214` (SHA-256 in the frontmatter):

- RED run, one run, unfixed source: case 1 (Main Menu press, synchronous lock grant) failed on
  its planned assertion; cases 2 to 6 passed. Case 2 (150 ms press, deferred grant) passed where
  the plan expected a failure; that discrepancy is recorded under
  `red.planExpectationDiscrepancies` and is left as recorded.
- The frozen hash of `src/main.js`, `c762044675702688313ce81c7812153bdb30bc95951aa1995e69337414a882d3`,
  covers working-tree bytes with mixed line endings (359 CR LF, 206 LF) that no git object and no
  checkout reproduces. The committed blob hashes to
  `cb7c2f54c37ddda5ced3e39d1f4753f0a9b9d8e509b2f9998b6ffb33816d7dc0`.
- Line-ending survey of the 127 frozen file identities: 38 reproduced by committed bytes, 57 only
  by an all-CRLF checkout, 25 only by this working copy, 7 already different as expected.
- The 25 working-copy-only byte sequences are preserved in `evidence/07-21-frozen-bytes.json`
  (commit `8d71473`), each verified against its frozen SHA-256.

## Consequence of this branch

- `src/main.js` is changed: guard lines are added in the offline `mousedown` handler, inside the
  existing `!locked && gameRunning && !isBuyPanelOpen()` branch and before the lock request.
  Nothing else in the handler changes.
- `hash_basis: pinned-lf`: the edited file is written with LF line endings throughout (the frozen
  content with carriage returns removed, plus the guard lines), and the root `.gitattributes`
  gains exactly one path line, `src/main.js text eol=lf`. The registered corrected hash then
  equals the committed content, so every clone and CI checkout reproduces it. Every line ending of
  the working file changes, so the byte difference from the frozen file is larger than the guard;
  the checked relation is "frozen bytes with carriage returns removed, plus the guard lines,
  equals the corrected bytes". The original mixed-ending bytes then exist only in the preserved
  copy.
- Task 07-21-03 registers one exact pair of hashes in `REVIEWED_SOURCE_EXCEPTIONS['src/main.js']`
  with rejection controls, and an independent `opus`/`high` review must return a non-blocking
  status before the plan completes. `tools/art/animation-budget-v2.mjs`, the frozen budget and the
  frozen reference stay byte-identical.
- The frozen gate, plan 09 qualification and the strict capture all run afterwards on the new
  `src/main.js` identity.
- `followup_line_endings: yes`: the wider line-ending dependence of the frozen gate (82 of 127
  identities) is not repaired by this plan and is to become its own follow-up.
