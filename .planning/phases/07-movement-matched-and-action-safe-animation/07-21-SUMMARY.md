---
phase: 07-movement-matched-and-action-safe-animation
plan: "21"
subsystem: input-and-frozen-gate-registry
tags: [pointer-lock, pause-menu, frozen-gate, exact-hash-exception, line-endings, playwright, tdd, gap-closure]
status: partial
requirements: [ANIM-02]
requirements-completed: []
commits: 15
plan_head_before: e0663dc6f3dca20904b7509f04c4fc20465ec3d3
plan_head_after: 0f9cf5065806e694b17d4cd5aa742d4d01ce2e9b
actuals:
  tokens: 182558   # chars/4 over the realized diff e0663dc..0f9cf50 (730234 chars); 116151 of them are the base64 store, 66407 without it
  tasks: 3
  commits: 15
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "plan 07-20's tracer failure on the post-union menu return and the frozen V2 gate's protected identity set"
provides:
  - "Real-press pause-menu, error-banner and killcam-Skip regression spec under capturing pointer-lock adapters"
  - "Six-line guard in the offline mousedown handler of src/main.js"
  - "REVIEWED_SOURCE_EXCEPTIONS with one exact hash pair for src/main.js and its controls"
  - "tools/art/frozen-bytes.mjs and byte-exact copies of the 25 irreplaceable frozen reference files"
affects: [07-22, 07-13, 07-16, 07-17, 07-18]
tech-stack:
  added: []
  patterns:
    - "A protected source file changes only under an owner-gated exact-hash exception, bound by controls to preserved bytes and to an independent review record"
    - "A measurement switch in a spec marks every title and fails every case, so a diagnostic run cannot pass as a result"
key-files:
  created:
    - tests/pause-menu-pointer-lock.spec.js
    - tools/art/frozen-bytes.mjs
    - tools/art/frozen-bytes.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-21-frozen-bytes.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-21-source-change.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-21-SOURCE-CHANGE-DECISION.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-21-SOURCE-EXCEPTION-REVIEW.md
  modified:
    - src/main.js
    - .gitattributes
    - tools/art/motion-acceptance.mjs
    - tools/art/motion-promotion.test.mjs
key-decisions:
  - "register-exception on the pinned-lf basis: src/main.js is LF on every checkout and its registered corrected hash is the committed content"
  - "The guard covers #pause-menu, #mp-error-banner and #kc-skip; a Skip press also hides a pause menu left up by Esc"
  - "The review record is tied to the registered bytes by its frontmatter field reviewed_corrected_sha256, compared for equality"
  - "The failed seven-spec rerun is recorded as it ran; no third attempt, no NO_COLOR run and no test edit were made"
patterns-established:
  - "Exact-hash source exception: registry entry, preserved frozen and corrected bytes, gate-level controls, review record naming the hash"
coverage:
  - id: D1
    description: "The 25 frozen reference byte sequences that no git object reproduces are preserved and verify against their frozen hashes"
    requirement: ANIM-02
    verification:
      - kind: other
        ref: "node tools/art/frozen-bytes.mjs verify (26 verified, 0 mismatched)"
        status: pass
      - kind: unit
        ref: "tools/art/frozen-bytes.test.mjs (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A press on the pause box, the online error banner or killcam Skip no longer re-captures the pointer; Resume and a canvas press still capture"
    requirement: ANIM-02
    verification:
      - kind: e2e
        ref: "tests/pause-menu-pointer-lock.spec.js (11 passed inside the seven-spec run of 2026-10-09T22:46:49Z)"
        status: pass
    human_judgment: true
    rationale: "Every browser result uses a headless adapter that models pointer lock. Behaviour in a real browser with a real lock was not measured."
  - id: D3
    description: "One exact hash pair for src/main.js is registered, with rejection controls and an independent opus/high review (pass-with-notes)"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "npm run test:art (197 passed), ten tests named 'reviewed source exception'"
        status: pass
    human_judgment: true
    rationale: "The owner delegated the choice of option; the owner's explicit confirmation of register-exception-pinned-lf is not on record."
  - id: D4
    description: "Final regression reruns on the final identity: lint, typecheck, unit, art, and one sequential run of seven offline browser specs"
    requirement: ANIM-02
    verification:
      - kind: other
        ref: "npm run lint (exit 0)"
        status: pass
      - kind: other
        ref: "npm run typecheck (exit 0)"
        status: pass
      - kind: unit
        ref: "npm run test:unit (323 passed in 31 files)"
        status: pass
      - kind: unit
        ref: "npm run test:art (197 passed)"
        status: pass
      - kind: e2e
        ref: "seven offline specs, --workers=1: exit 1, 85 passed, 1 failed (tests/character-art.spec.js:953, setup)"
        status: fail
    human_judgment: false
duration: approximately 43min for the final segment; approximately 2h 11m wall span from the first plan commit, including the owner checkpoint and two reviews
completed: 2026-10-09
---

# Phase 7 Plan 21: Pause-menu pointer-lock fix under a reviewed exact-hash exception Summary

**Decision: `register-exception` on the `pinned-lf` basis. `src/main.js` CHANGED (six added lines in the offline `mousedown` handler) and is registered by one exact pair of hashes. The plan is `partial`: the one seven-spec browser rerun on the final identity exited 1 (85 passed, 1 failed) on a setup case that never loads the game, and one allowed repeat of that spec file failed the same way.**

## Performance

- **Duration:** final segment approximately 43 min (2026-10-09T22:35:55Z to 23:18:23Z). Whole plan approximately 2 h 11 min of wall time from its first commit (21:07:08Z), including the owner checkpoint and two independent reviews. Wall span, not effort.
- **Tasks:** 3 executed (07-21-01, the owner checkpoint, 07-21-02, 07-21-03). Task 07-21-03's rerun acceptance is not met.
- **Commits:** 15, measured with `git rev-list --count e0663dc..0f9cf50`.
- **Files changed:** 11 (7 created, 4 modified).

## Result

| Rerun on `src/main.js` `f768954f…bc393` | Exit | Counts | Duration |
|---|---|---|---|
| `npm run lint` | 0 | no error, no warning | 1.9 s |
| `npm run typecheck` | 0 | no diagnostic | 2.7 s |
| `npm run test:unit` | 0 | 323 passed, 0 failed, 0 skipped (31 files) | 56.9 s |
| `npm run test:art` | 0 | 197 passed, 0 failed, 0 skipped | 16.0 s |
| Seven offline specs, one Playwright invocation, `--workers=1` | **1** | **85 passed, 1 failed**, 0 skipped, 0 flaky (86 cases) | 17 min 19 s |
| `tests/character-art.spec.js` alone, one repeat (attempt 2) | **1** | **27 passed, 1 failed**, 0 skipped, 0 flaky | 6 min 22 s |

All six ran one at a time with `PAUSE_SPEC_GUARD_SELECTOR` unset; `src/main.js` hashed to the registered value before and after each. Logs and their SHA-256 are under `reruns` in `evidence/07-21-source-change.json`.

Per file in the seven-spec run: action-lifecycle 22 of 22, animation-regressions 6 of 6, animation-review 10 of 10, character-art 27 of 28, offline-multiplayer-regressions 1 of 1, pause-menu-pointer-lock 11 of 11, smoke 8 of 8.

### The failing case

`tests/character-art.spec.js:953 › art slice: base-prefixed production build resolves the painted assets`, both times with `Error: Owned prefix preview did not start` after 15.8 s.

- It stops in its own setup: the error comes from the test's 15000 ms timer at line 968, after its `vite build` child exited 0 and before `page.goto` at line 976. No page of the game was loaded and no press was made. It does not touch the changed handler.
- Diagnosis without a browser (the two child commands repeated by hand into an OS temp directory, log `final-e2e-diagnosis-preview.log`): the build exits 0 in 721 ms; the preview server starts in about 330 ms and stays up. Its banner here is `➜  <ESC>[1mLocal<ESC>[22m:   http://127.0.0.1:<port>/art-prefix/`. The test recognises readiness only by the plain text `Local:` (line 970), which never occurs with an escape sequence between `Local` and `:`. With `NO_COLOR=1` the banner is plain.
- Why colour is on, read from `node_modules`: Playwright sets `FORCE_COLOR=1` for every worker and the test passes the worker's environment to the server; Vite 8.0.8's bundled colour rule also turns colour on under win32 unless `NO_COLOR` or `--no-color` is given. This session's shell sets neither.
- Comparison: in the full offline run recorded in `evidence/07-10-stable-gates.json` this case passed (9.7 s); that run's two failures were setup timeouts in `action-lifecycle.spec.js`, which passed here. `evidence/07-11-required-assertions.json` does not include this case. That the earlier run had colour off for the server is an inference from its uncoloured log; the earlier environment is not recorded and was not verified.
- `tests/character-art.spec.js`, `vite.config.js`, `package.json` and `playwright.config.js` are unchanged since `e0663dc`.
- Not a flake: it failed identically twice. No third attempt was made, no run was made with `NO_COLOR` set, the test was not edited, and the two attempts are not combined.

Two ways to settle it, neither taken: one authorised repeat of the seven-spec invocation with `NO_COLOR=1`, recorded as a third attempt; or a separate change that makes the readiness check at line 970 independent of colour (outside this plan's files).

## What was done

- **Task 07-21-01.** `tools/art/frozen-bytes.mjs` preserved the 25 frozen reference files whose on-disk bytes no git object reproduces (`8d71473`). The defect was reproduced by a real click: case 1 failed on unfixed source, cases 2 to 6 passed (`68bf214`). Sixteen surface rows were classified.
- **Owner checkpoint.** See "Decision provenance" below.
- **Task 07-21-02.** Guard added in the `mousedown` handler; file written with LF throughout and pinned (`6f33df7`).
- **Task 07-21-03.** One exact pair registered with controls (`f7bc7c4`), fresh-clone check (`14ff711`), independent review `pass-with-notes` (`f0e0b8f`).
- **Review follow-up.** Three warnings settled inside the plan: failing real-press cases for the banner and the paused Skip (`9b87860`), gate-level and review-record controls (`9dfebbb`), final `src/main.js` and re-registration (`91ab1af`), fresh clones (`a9f3d01`).
- **Final segment.** Delta review committed as written (`5c03d1f`); D-01 (`592e5f4`); D-02 (`b7c2791`); evidence hygiene and stated limits (`3777191`); reruns recorded (`0f9cf50`).

## Task Commits

1. `8d71473` chore: preserve the 25 irreplaceable frozen reference byte sequences
2. `68bf214` test: failing real-click pause-menu regression (RED)
3. `6f33df7` feat: stop pause-menu and killcam-skip presses re-capturing the pointer (GREEN)
4. `f7bc7c4` feat: register the one reviewed `src/main.js` exception by exact hash
5. `14ff711` test: fresh-clone checks of the registered hash
6. `f0e0b8f` docs: independent review (pass-with-notes)
7. `9b87860` test: failing real-press cases for the banner buttons and the paused Skip (RED)
8. `9dfebbb` test: gate-level, review-record and hash-basis controls
9. `91ab1af` fix: guard the banner, clear the pause menu on Skip, re-register `src/main.js` (GREEN)
10. `a9f3d01` test: fresh-clone checks of the re-registered hash
11. `5c03d1f` docs: delta review of the re-registered exception (pass-with-notes)
12. `592e5f4` test: a guard-variant run of the pause spec cannot pass (D-01)
13. `b7c2791` test: bind the review control to the record's reviewed-hash field (D-02)
14. `3777191` docs: mark superseded GREEN evidence, state the open limits
15. `0f9cf50` test: record the final reruns

TDD order holds for both source changes: `68bf214` before `6f33df7`, and `9b87860` before `91ab1af`.

## For post-execution review

### The exact `src/main.js` change

Six added lines, 275 to 280 of the corrected file, inside the existing `if (!locked && gameRunning && !isBuyPanelOpen()) {` branch and before the lock request. Nothing else in the file differs from the frozen content apart from line endings (359 CR LF became LF).

```js
      // A press inside the pause box or the online error banner, or on killcam Skip, must
      // reach it, not re-capture the pointer. Skip also hides a pause menu left up by Esc,
      // so that none stays over the round result.
      const control = e.target?.closest?.('#pause-menu, #mp-error-banner, #kc-skip');
      if (control?.id === 'kc-skip') document.getElementById('pause-menu').style.display = 'none';
      if (control) return;
```

The online early return, `tryShoot()`, the grenade and ADS lines, `mouseup`, the canvas click handler, `returnToMainMenu`, `pointerlockchange`, the Resume and Main Menu listeners and every touch branch are byte for byte unchanged (reviewer's own byte comparison: one contiguous 446-byte insertion).

### Behaviour changes a player can meet

- **A press on the empty part of the pause box no longer resumes.** Before, any left press there re-captured the pointer and so acted as an unlabelled resume. Resume is the control; a press on the canvas outside the box still captures.
- **Main Menu in the pause box works under a synchronous lock grant**, which is the defect this plan was opened for.
- **A Skip press during a killcam no longer captures the pointer, and it hides a stale pause menu.** In wave modes this removes a captured pointer on the death screen; at a lost TDM match end or S&D round end with Esc pressed, no pause menu stays over the result after a Skip press.
- **The online error banner's Retry and Return to menu no longer capture the pointer on press** when the banner sits over an offline match.

### The registered exception

| Field | Value |
|---|---|
| Registry | `REVIEWED_SOURCE_EXCEPTIONS['src/main.js']` in `tools/art/motion-acceptance.mjs` |
| `original` | `c762044675702688313ce81c7812153bdb30bc95951aa1995e69337414a882d3` |
| `corrected` | `f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393` |
| `hashBasis` / `guardLines` | `pinned-lf` / 6 |
| Rule | accepted only when reference equals `original`, current equals `corrected`, and the binding revision is `07-CR02-directional-crouch` |
| Superseded | `51db511fd5249fed908d07ac90929da2e0e2fca11c9014808a332392e88b51f5`, registered first in `f7bc7c4`, accepted nowhere now |
| Review | `07-21-SOURCE-EXCEPTION-REVIEW.md`: `pass-with-notes`, `opus`/`high`, for the bytes `f768954f…` and no other; 0 blockers, 1 warning (D-01, settled), 7 notes |

`tools/art/animation-budget-v2.mjs`, its test, `evidence/07-budget-view-v2.json`, `index.html` and `style.css` have the same blob ids as at `e0663dc`.

### `.gitattributes`

The root file gained exactly these two lines, in `6f33df7`, and nothing since:

```
# Reviewed plan 07-21 correction, registered by exact hash; LF on every checkout.
src/main.js text eol=lf
```

`git ls-files --eol` is identical before and after the final segment. No file other than `src/main.js` changed its working form in this plan.

### Hash basis and what a fresh clone reproduces

`pinned-lf`: the registered corrected hash is the committed content, so every checkout holds it. Two fresh clones of `0f9cf50` made in this segment outside the project (`core.autocrlf` true and false, deleted afterwards): `src/main.js` is `i/lf w/lf attr/text eol=lf` and hashes to `f768954f…` in both; `node --test tools/art/motion-promotion.test.mjs tools/art/frozen-bytes.test.mjs` gives 21 tests, 20 passed, 0 failed, 1 skipped (the cache-gated CR-02 block); `frozen-bytes.mjs verify` gives 26 verified, 0 mismatched.

Restore commands for the preserved bytes, never run by this plan:

- `node tools/art/frozen-bytes.mjs restore src/main.js --from corrected --confirm`
- `node tools/art/frozen-bytes.mjs restore <path> --from frozen --confirm` for any of the 25 frozen entries (for `src/main.js` this puts back the unfixed bytes and the frozen hash).

### Surface table

| Surface | Controls | Coverage |
|---|---|---|
| `#pause-menu` | Main Menu | needed the fix; guarded |
| `#pause-menu` | Resume | works before and after; pinned |
| `#pause-menu` | graphics quality | already stops propagation; pinned |
| `#pause-menu` | the box outside its controls | guarded; behaviour change pinned |
| `#killcam-wrap` | `#kc-skip` | needed the fix; guarded, and Skip hides a stale pause menu |
| `#mp-error-banner` | Retry, Return to menu | needed the fix (first classified online-only, corrected after review); guarded |
| `#buy-panel` | shop rows | already stops propagation; `isBuyPanelOpen()` |
| `#range-preset-panel` | Training Range rows | already stops propagation |
| `#animation-review-diagnostics`, `#animation-review` | developer review | already stops propagation |
| `#snd-result`, wave death screen, main menu, `#editor-overlay` | their buttons | unreachable: `gameRunning` is false there |
| `#touch-ui` | touch controls | touch only |
| `#mp-match-controls`, `#mp-leave-btn` | online controls | online only |
| `#c` | the canvas | must keep capturing; pinned |

Left uncovered, not menu-press defects and unchanged by this plan: a canvas press while dead in TDM or S&D, or during a wave killcam, still captures the pointer (review F-14).

### Collector and test changes

- `tools/art/animation-capture.mjs` (the collector) is **not** changed by this plan; its hardening and the single tracer belong to plan 07-22.
- `tests/pause-menu-pointer-lock.spec.js`: eleven cases, every press a real `locator.click()`. Three adapters: the collector's synchronous grant, the same with a silent release, and a deferred grant. Two setups are shortened from page script (a wave death through `triggerDeath()`, a lost TDM end through the mode's own `tick(601)`).
- The spec's measurement switch `PAUSE_SPEC_GUARD_SELECTOR` serves the page a copy of `src/main.js` with the guard selector replaced. Since `592e5f4` a run with it set marks every title and fails every case.
- `tools/art/motion-promotion.test.mjs`: ten tests named "reviewed source exception", including two that go through the real `verifyCandidate`.
- `tools/art/frozen-bytes.test.mjs`: eight tests of the pure exports.

## Decision provenance

The plan's checkpoint asked the owner to choose among four options, and its must-have reads "The owner has decided in writing …; no agent made that choice." What happened, as recorded in `07-21-SOURCE-CHANGE-DECISION.md` and relayed to the executors by the orchestrator: the orchestrator presented the options with its own recommendation (`register-exception-pinned-lf`, follow-up on line endings: yes); the owner replied "ok, continue, do the rational thing"; the orchestrator applied its own stated recommendation. The owner did not type an option name, and no executor saw the owner's message directly. The must-have therefore holds only through that delegation. The orchestrator has asked the owner for explicit confirmation of the option. **That confirmation is not on record.** Until the frozen V2 command runs in plan 07-13 the change is reversible by reverting the task commits.

## Must-haves

| Must-have | State |
|---|---|
| Real-click regression recorded failing before any source change | met (`68bf214`, RED report hashes in the evidence) |
| Owner decided in writing; no agent made the choice | holds only through delegation; explicit confirmation not on record |
| Main Menu returns, graphics quality usable, Resume and canvas capture, fire/ADS/grenade unchanged | met under adapters (11 of 11 in the final run; byte comparison for the unchanged branches) |
| Frozen bytes preserved before any edit | met (`8d71473`; 26 verified, 0 mismatched now) |
| Three byte relations as controls on Windows and LF checkouts | met (controls pass here and in both fresh clones of `0f9cf50`) |
| Owner shown what the frozen hash covers and the 82 of 127 dependence | as relayed by the orchestrator; not verifiable from the repository |
| Gate accepts only the exact pair; frozen files identical; non-blocking review | met |
| Surfaces listed with coverage | met (16 rows) |
| Prohibition: no failed result turned into a pass | kept: the failed rerun is recorded as failed and the plan is partial |

Task 3 verify commands on the final state: the first exits **1** (a recorded rerun has a non-zero exit code; its review-record half alone is true for status, model and effort); the three-file `node --test` exits 0 (89 passed, ten named "reviewed source exception"); the registry-equals-working-file check exits 0; `npm run test:art` exits 0 (197 passed). Task 1 and task 2 verify commands that need no browser exit 0. Task 2's browser verify was not run alone again; the same spec passed 11 of 11 inside the seven-spec run.

## Deviations from Plan

**1. [Orchestrator instruction] Review follow-up went beyond the plan's blocker-only fix rule.** The plan allows a fix inside the plan only for a `blocker`. The first review returned `pass-with-notes` with three warnings. On the orchestrator's instruction they were settled inside this plan, which changed `src/main.js` a second time and **re-registered the hash once**: `51db511f…` was superseded by `f768954f…`, followed by a delta review. Commits `9b87860`, `9dfebbb`, `91ab1af`, `a9f3d01`, `5c03d1f`.

**2. [Plan expectation not met] RED case 2 passed.** The plan expected the 150 ms press under a deferred grant to fail on unfixed source. It passed. Only case 1 detects the original defect; cases 2 and 3 are not regression coverage of it. Recorded under `red.planExpectationDiscrepancies` and left as measured.

**3. [Scope] Extra commits and exports.** Fifteen commits against an estimate of three tasks. `tools/art/frozen-bytes.mjs` exports more than the plan lists: `BUDGET_PATH`, `STORE_PATH`, `allCrlfLineEnds`, `surveyReferenceIdentities`, `writeDecoded`. The realized diff is about 66,400 estimate-tokens without the base64 store, against an estimate of 34,000.

**4. [Stricter than planned] Review-record control.** The plan checks the review record with a one-off verify command. A permanent control now requires a non-blocking status, `opus`, `high`, and (since `b7c2791`, review D-02) equality of the record's `reviewed_corrected_sha256` with the registry's `corrected`, with eleven in-memory negative controls. A re-registered hash fails `npm run test:art` until its review is recorded.

**5. [Review D-01] Spec measurement switch hardened** in test code only (`592e5f4`): with `PAUSE_SPEC_GUARD_SELECTOR` set every title carries the variant and every case fails. Shown by one filtered variant run of two cases: exit 1, own outcomes `passed` and `failed` kept in annotations.

**6. [Orchestrator option] No `.gitattributes` line for the review record.** The concern was that a later CR LF rewrite of the record would break the plan's `^key: value *$` checks. Measured: in JavaScript `$` matches before a carriage return, so the plan's patterns already pass on CR LF; on the fresh `core.autocrlf=true` clone the record has 687 carriage returns and every pattern and the control pass. No attribute was added and no plan text changed.

**7. [Orchestrator exception] One repeat of a single spec file.** The plan says a non-zero rerun stops the plan and is not retried. The orchestrator allowed one repeat of the spec file holding a setup failure that looked like an infrastructure flake. It was used once; it failed the same way; both attempts are recorded. A no-browser diagnosis of the test's two child commands was also run by hand.

**Total deviations:** 7 (2 on orchestrator instruction beyond the plan's rules, 1 plan expectation not met, 1 scope, 3 stricter or hardening changes). **Impact:** the registered identity changed once inside the plan; no result was relabelled.

## Known limitations

- **D-03.** The Skip guard hides `#pause-menu` on `mousedown`, so an abandoned press hides it for the rest of the killcam (at most 2.8 s of simulated time). The `[K]` key, or the killcam expiring while paused, still leaves the pause menu over the result. The lasting fix is in `src/modes/snd.js` and `src/modes/tdm.js`, protected files outside this plan.
- **D-04.** The banner entry rests on a measured capture on press; a lost click was not shown and the disconnect route was not pressed. The banner still stays up over an offline match because no offline start clears it.
- **D-05.** The original-tuple gate control is skipped on a shallow history, the CI default. It is not CI coverage.
- **D-06, for plans 07-13 and 07-18.** A pass of the frozen gate, or of the gate-level control, does not show the fix is present. They must check that the candidate's `src/main.js` identity equals the registered corrected hash `f768954f…bc393`.
- **F-08.** The exception is additive: under the corrected motion tuple the gate accepts `src/main.js` at the frozen hash or at the corrected hash.
- **Real browsers not measured.** Every browser result is headless Chromium under an adapter that models pointer lock. Whether a real browser loses a click once a lock is granted mid-press was not measured. The S&D form of the paused Skip corner and a played-out match end were not pressed.
- **Standing line-ending fragility of the frozen gate** (`followup_line_endings: yes`, not repaired here). Of 127 frozen file identities: 38 reproduced by committed bytes, 57 only by an all-CR LF checkout, 25 only by this working copy, 7 already different as expected. Measured on fresh clones at `f7bc7c4`: a `core.autocrlf=true` clone reproduces 62 of 127 and a `core.autocrlf=false` clone 38 of 127. The 25 irreplaceable sequences are recoverable from `evidence/07-21-frozen-bytes.json`.
- **F-13.** `tools/art/animation-budget-v2.test.mjs` fails three cases on a clone without the gitignored cache. Not changed here.
- **CI was not observed.** The colour-sensitive readiness check in `tests/character-art.spec.js` may behave on CI as it did here; that was not checked.

## Issues Encountered

The seven-spec browser rerun failed on `tests/character-art.spec.js:953` (see "The failing case"). Discovered and out of scope, not fixed: that test's readiness check depends on colour being off in the child server's output.

## Requirements

`requirements-completed` is empty. `ANIM-02` is shared with other Phase 7 plans, including plan 07-22's tracer, and this plan is partial; it alone does not complete `ANIM-02`.

## Known Stubs

None.

## Authentication Gates

None.

## Next Phase Readiness

- Not ready to be treated as complete: one acceptance criterion of task 07-21-03 is open (the seven-spec rerun), and the owner's explicit confirmation of the option is not on record.
- `STATE.md` and `ROADMAP.md` were not advanced. No entry was appended to `.planning/WINDOWS.md`.
- Plan 07-22 depends on this plan. Plans 07-13 and 07-18 must apply the D-06 check.

## Self-Check: PASSED

- Files exist: the seven created and four modified files listed in the frontmatter.
- Commits are ancestors of `HEAD`: all fifteen listed above.
- `src/main.js` is `f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393`; `frozen-bytes.mjs verify` reports 26 verified, 0 mismatched; `git status --short` lists only `.planning/config.json`, `.planning/state.json` and `.planning/milestone.lock`, none of them touched by this plan.
- The self-check passing means the claims above were verified, not that the plan passed: its status is `partial`.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-09 (status: partial)*
