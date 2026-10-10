---
phase: 07-movement-matched-and-action-safe-animation
plan: "22"
subsystem: review-tooling
tags: [animation-capture, tracer, playwright, diagnostics]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-21 register-exception: pause-menu press guard in src/main.js"
provides:
  - "combatPageJournal and menuReturnDiagnostics in tools/art/animation-capture.mjs"
  - "evidence/07-motion-review-tracer-fifth.json: archive of the failed 19:54:33.020Z tracer"
  - "evidence/07-motion-review-tracer.json: fresh PARTIAL tracer (05:20:38.924Z), natural death not reached"
affects: [07-12, 07-13, 07-19, 07-20]
actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: ca08e205727a4499269cddae8386bed87079a634
plan_head_after: 3f49ffe9ac6fa30056fdef0483d968ffb89c2400
tech-stack:
  added: []
  patterns: ["observation-only page journal on the combat page; wall-bounded interface readiness wait"]
key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer-fifth.json
  modified:
    - tools/art/animation-capture.mjs
    - tools/art/animation-capture.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer.json
    - AGENTS.md
key-decisions:
  - "Branch register-exception: collector pointer-lock adapter and real locator click left unchanged"
  - "Tracer outcome recorded as failed/partial; no rerun, summaries 07-12 and 07-20 left partial"
requirements-completed: []
duration: 40min
completed: 2026-10-10
status: partial
---

# Phase 07 Plan 22: Branch `register-exception`; the single fresh tracer did NOT pass (partial, gap open)

**The combat page now journals its own errors and menu-return state; the one authorised tracer reached three combat stages and stopped at natural death (no death in 120 simulation seconds), so the menu return was never reached and 07-12 / 07-20 stay partial.**

## Performance

- **Started:** 2026-10-10T05:1xZ (plan start); tracer started 05:20:30Z
- **Tasks:** 2 executed (task 1 complete; task 2 executed, outcome partial)
- **Files modified:** 4 plus 1 created

## Accomplishments

- Task 1 (TDD): `combatPageJournal()` (page errors, rejections, console error or warning lines, max 200, `dropped` count, `[moving-combat]` lines not stored) and `menuReturnDiagnostics(state)` (`re-locked`, `handler-not-run`, `returned`, `unknown`). Attached to the combat page; `pageJournal` and `pageJournalDropped` stored on the combat entry in success and failure paths; a failed `#overlay` wait stores `menuReturnDiagnostics` read from the page before rethrowing. The real `locator('#pause-menu... #pause-mainmenu-btn').click()` is kept; the `addInitScript` adapter is unchanged; CRLF preserved (`i/crlf w/crlf`).
- Task 2: failed 19:54:33.020Z report archived byte-identical as `-fifth` (exclusive create, SHA-256 `b8508017612141be8de65331715a72aab4ebe3c57d6d51702c7c78cb197c9911`); one tracer run; `AGENTS.md` updated.

## Task Commits

1. Task 1 RED: `df7c45c` (test) - 7 target tests failed with `capture.combatPageJournal is not a function`
2. Task 1 GREEN: `ae230a6` (feat) - 68 of 68 in the file pass; `npm run test:art` 204 of 204
3. Task 2 archive: `606550e` (test)
4. Task 2 report and AGENTS.md: `3f49ffe` (test)

## TDD

- RED: command `node --test --test-reporter=tap tools/art/animation-capture.test.mjs`, exit 1, 68 tests, 61 pass, 7 fail. All seven fails are the new targets (names containing "combat page journal" / "menu return diagnostics"), each failing at its first call on the missing export. Semantic assessment: the target tests executed and failed for the intended reason (feature absent); no import, syntax or fixture fault. The machine classifier `gsd_run check tdd-red-evidence` was not run (no record file was built); this is a deviation from the reference, noted here.
- GREEN: implementation as above; no REFACTOR commit.

## Tracer result (the one authorised capture)

- Command `node tools/art/review.mjs --animation-capture --tracer`, started 2026-10-10T05:20:30Z, wall about 1067 s (17.8 min), **exit code 1** (expected non-pass).
- Report `evidence/07-motion-review-tracer.json`: `capturedAt` 2026-10-10T05:20:38.924Z, SHA-256 `dc6b5b6c7ada27d0277a8bae0c5b55307ff4c9e474e5b14a8ebba91822fd84ac`; `independentTracerComplete: false`, `complete: false`, `plan09Qualified: false`, `protectedBytesUnchanged: true`.
- Matrix, offline movement, shared movement and preview parts completed (matrix 1, previews 1).
- Combat stages reached: `accepted-aim`, `earned-resource`, `throw-canceled-reload` (3 of 5). Failing stage: `natural-death`. Error: `Natural death did not occur within 120 simulation seconds (observed 120.0 simulation seconds, 899038 wall ms)`. Last observation: player alive, hp 100, standing at the same eye position, third person, ammo 10 with reserve 90, mode `tdm`, no damage taken in 128.6 simulation seconds.
- `menuReturn`: never reached (`undefined`), so the pause-menu click, the 07-21 source fix and the `#overlay` wait were NOT exercised in this run. `menuReturnDiagnostics`: absent (only written when the `#overlay` wait fails). `pageJournal`: `[]`, `pageJournalDropped: 0` (no page errors, rejections or console error or warning lines through the run).
- `collectionErrors`: one entry, stage `eligible-combat`, the error text above.
- Verify command 1 exits 1 (recorded outcome). Verify command 2 exits 0 (archive is the failed report; both summaries remain partial, matching the failed fresh report).
- Per the plan: no rerun, no change to bound, adapter, input or predicate. This is a new gap for the planner: the 19:54 run failed at the menu return after five stages, this run failed one stage earlier because the scripted player was never killed in the natural-death wait (the enemy did not engage in 120 simulation seconds). The natural-death stage is evidently not deterministic on this host.

## Deviations from Plan

**1. [Precondition reading] Task 2 precondition: every `reruns` exitCode 0.** `evidence/07-21-source-change.json` `reruns` is non-empty, lint, typecheck, unit, art and the passing attempt-3 seven-spec entry have `exitCode: 0`, but two earlier failed seven-spec attempts stay recorded with `exitCode: 1`, so the literal "every exitCode 0" is not true. `07-21-SUMMARY.md` documents this and states the criterion is met by attempt 3. I proceeded on that basis (the dispatch described 07-21 as closed). Flagged for review.
**2. [TDD] RED evidence classifier not run** (see TDD above).

No auto-fixes (Rules 1 to 3). One tool-use mistake: an early stray `cat > /tmp/x` blocked a shell for 2 minutes with no effect on the repository.

## Known Stubs

None.

## Threat Flags

None. The journal holds console and error text of a local offline page (T-07-22-03, accepted).

## For post-execution review

- `src/main.js` change from plan 07-21: six added lines in the offline `mousedown` handler (press inside `#pause-menu`, `#mp-error-banner` or on `#kc-skip` no longer re-captures the pointer); hash `f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393`, LF, pinned in `.gitattributes`. Unchanged in this plan (hash re-verified; `git status --short -- src` empty).
- Collector changes here: `combatPageJournal` and `menuReturnDiagnostics` exports; journal attached to `pageerror` and `console` of the combat page; `pageJournal` / `pageJournalDropped` on the combat entry; `menuReturnDiagnostics` on the entry when the `#overlay` wait fails. No change to the `addInitScript` pointer-lock adapter (branch `register-exception`), the real `#pause-mainmenu-btn` click, any acceptance predicate, `review.mjs`, or frozen files.
- Why the `#overlay` wait stays wall-bounded (45 s page default): `returnToMainMenu` shows the overlay synchronously inside the click task, so the wait covers at most the next rendered frames; at 250 to 600 ms per frame under software rendering that is about 75 to 180 frames of margin, and the earlier failure was a handler that never ran, not a slow one. No game event is awaited, so a simulation bound adds nothing.
- Review points: the precondition deviation above; the unrun RED classifier; that the natural-death wait failure is a new gap, not a collector defect introduced here.

## Self-Check: PASSED

- Files exist: `07-motion-review-tracer-fifth.json`, `07-motion-review-tracer.json`, `animation-capture.mjs`, `animation-capture.test.mjs`, `AGENTS.md` (checked).
- Commits `df7c45c`, `ae230a6`, `606550e`, `3f49ffe` are ancestors of HEAD; `git ls-files --eol` shows `i/crlf w/crlf` for both tool files; `node tools/art/frozen-bytes.mjs verify`: 26 verified, 0 mismatched; `src/main.js` still `f768954f...bc393`.
- Gap status: OPEN. `07-12-SUMMARY.md` and `07-20-SUMMARY.md` untouched and still `status: partial`; ROADMAP and STATE progress not advanced.
