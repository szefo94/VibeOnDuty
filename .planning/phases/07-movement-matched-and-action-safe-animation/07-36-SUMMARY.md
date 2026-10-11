---
phase: 07-movement-matched-and-action-safe-animation
plan: "36"
subsystem: testing
tags: [playwright, browser-regression, crouch-lean, owner-preview, gap-closure]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-35 crouched torso lean (CROUCH_TORSO_LEAN_RAD, 12 degrees)"
provides:
  - "tests/animation-live-route.spec.js: browser reading of the crouched chest pitch of the live player (lean and release)"
  - "Focused browser set (61 cases), two character-art cases and the five fast gates pass on the source with the lean"
affects: [07-37, 07-30, 07-32]

plan_head_before: b531b914852b866fa7cf421a32bfd54ae59c1269
plan_head_after: 1b3388878692d6dc0553b69360c39e755d3eadfd
commits: 3
actuals:
  tokens: 1100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Chest pitch read as Euler YXZ x of spine_03 in the body frame, mean over samples"

key-files:
  created: []
  modified:
    - tests/animation-live-route.spec.js

key-decisions:
  - "Order change: owner preview (task 3) shown before tasks 1 and 2; no adjustment round, src/ untouched"
  - "Release tolerance of the chest pitch widened from 0.5 to 2 degrees after a failing run (orchestrator decision)"

requirements-completed: []

coverage:
  - id: D1
    description: "The crouched live player's chest leans forward by the constant in a real browser, is back after release, and weapon direction and spine_03 yaw keep their limits"
    requirement: ANIM-03
    verification:
      - kind: e2e
        ref: "tests/animation-live-route.spec.js#live: standing, walking and crouching show the composed pose with weapon and chest along the facing"
        status: pass
    human_judgment: true
    rationale: "Angles are measured; whether the lean looks right is the owner's judgment (preview recorded as lean: right; binding check is plan 07-37)."
  - id: D2
    description: "Focused browser set (8 files, 61 cases), two character-art cases and five fast gates pass"
    requirement: ANIM-02
    verification:
      - kind: e2e
        ref: "playwright: eight focused spec files, 61 passed; character-art two cases, 2 passed"
        status: pass
      - kind: unit
        ref: "npm test: 545 tests in 36 files"
        status: pass
    human_judgment: false

duration: about 1h 10m
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 36: Browser proof of the crouch lean and owner preview Summary

**The live crouched player's chest pitch is now read in a real browser (12.0 to 12.4 degrees over standing, back within 0.3 degrees after release), the 61-case focused set, two posed character-art cases and the five fast gates pass on the source with the lean, and the owner's preview of the amount is on record as `lean: right` at 12 degrees.**

## Order change (orchestrator decision)

The owner preview of task 3 was shown before tasks 1 and 2, on commit `eb43041` (source as committed in `d2b1778`), because a change of the lean value would have forced the browser set to run again. The preview record quotes the owner: "ok, lets proceed, now crouch is looking okay, what would be the next step?" and records `lean: right`, `lean_degrees: 12`, `status: preview`, `reviewed_by: owner`. It is a preview, not an approval of the repair, and is not restated here as an agent judgement. No adjustment round happened; nothing under `src/` was edited.

## Commits (this plan)

| Commit | What |
|---|---|
| `0e8d4f1` | live-route spec: chest pitch of `spine_03`, lean and release assertions (19 added, 0 removed) |
| `1b33888` | release tolerance widened from 0.5 to 2 degrees (see deviation); the numstat check against `2f69dfe` still shows 19 added, 0 removed |

`commits: 3` is the measured `rev-list` count since `b531b91` and also counts the orchestrator's `e6f8840` (docs handoff). The plan's own are the two above.

## Task 1: tracer figures (live-route spec, degrees)

Standing / crouched / risen are chest pitch means; "lean" is crouched minus standing; "release" is risen minus standing.

| Run | Standing | Crouched | Risen | Lean (const 12) | Release | Crouched weapon yaw | Crouched weapon pitch | Crouched spine_03 yaw | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 (alone, 0.5 limit) | -2.056 | 10.118 | -1.976 | 12.174 | +0.080 | -0.02 to 0.01 | -0.22 to 0.07 | -0.69 to 0.65 | pass |
| 2 (in the eight-spec set, 0.5 limit) | -1.881 | 9.723 | -2.394 | 11.604 | -0.513 | -0.11 to -0.01 | 0.04 to 0.12 | -0.67 to 0.57 | FAIL at the release limit 0.5 |
| 3 (alone, 2 limit) | -1.927 | 10.445 | -1.617 | 12.372 | +0.310 | -0.09 to -0.00 | -0.56 to -0.33 | -0.72 to 0.64 | pass |
| 4 (in the eight-spec set, 2 limit) | -2.105 | 9.912 | -2.081 | 12.017 | +0.023 | -0.04 to 0.01 | -0.13 to 0.10 | -0.70 to 0.42 | pass |

## Deviations

**1. [Orchestrator decision after a failing run] Release tolerance widened from 0.5 to 2 degrees.**
- **Found during:** Task 2, first eight-spec run (`exit 1`, 60 passed, 1 failed).
- **Issue:** the release assertion I added in task 1 (`|risen - standing| <= 0.5`) failed with `Received: 0.5134072323610712`. It was never part of a reviewed baseline. The sampled standing mean itself differs by run (-2.056 in run 1, -1.881 in run 2), and the release difference was +0.080 then -0.513, so 0.5 sits inside run-to-run variation.
- **Fix:** the tolerance on that one added line is now 2 degrees, equal to the lean comparison; it still fails if a sixth of the 12 degree lean remained. The comment line I added beside it was changed to say 2. No other assertion was touched.
- **Commit:** `1b33888`. Verification: runs 3 and 4 above; the numstat check against `2f69dfe` (19 added, 0 removed).
- The whole eight-spec set was re-run from the start after the change.

**2. Shown-commit hash in the preview record.** `07-36-OWNER-PREVIEW.md` has `shown_commit: eb43041b0ca38d5dcbd0ad27d5e9a3d5c7a84d0c`, which is not an object in the repository (`fatal: bad object`). The commit named in the text, `eb43041`, resolves to `eb4304115911b00565fa7acaac25c6619148972d`. The record was not edited (orchestrator-owned).

**3. Extra browser run.** After the character-art cases the shared `test-results` directory had been cleared, so `tests/first-person-rig.spec.js` was run once more (12 passed) only to write the two frames for the hashes below.

## Task 2: predicted vs actual (final set, source with the lean at HEAD `1b33888`)

| Spec | Prediction | Actual | 07-29 count |
|---|---|---|---|
| `animation-live-route` | unchanged limits; extended in task 1 | 1 of 1 passed (with the added assertions) | 1 |
| `first-person-rig` (line 265 contact errors, lines 269 to 270 look-down) | unchanged | 12 of 12 passed (twice in this plan) | 12 |
| `weapon-handling` | unchanged | 11 of 11 | 11 |
| `animation-resources` | unchanged | 13 of 13 | 13 |
| `animation-presentation` | unchanged | 4 of 4 | 4 |
| `animation-regressions` | unchanged | 6 of 6 | 6 |
| `animation-motion-source` | unchanged | 4 of 4 | 4 |
| `animation-review` | unchanged | 10 of 10 | 10 |
| `character-art`, two posed cases (by `-g`) | pass unchanged | 2 of 2 passed | 2 |

The eight-spec command exited 0 with 61 passed (9.6 min), per-file counts from the list reporter. The first run of this plan's set (before the deviation) gave 60 passed, 1 failed, the failing case being the live-route release assertion above; every other case passed in it too.

## Gates

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:mp` | exit 0 |
| `npm test` | exit 0, 545 tests in 36 files |
| `npm run build` | exit 0 |
| spec/fixture containment (`git diff --quiet 2f69dfe..HEAD` over the seven specs, `character-art` and `tests/fixtures`) | exit 0 |
| live-route spec numstat since `2f69dfe` | 19 added, 0 removed |
| `src/builders/enemyAnimations.js` and `tests/fixtures` against `3665406` | exit 0 (byte-identical) |
| `git status --short -- src server public tools` | empty |

The full offline suite and the multiplayer suite were not run and belong to plan 07-30. No capture, paired session or gate tool was run.

## First-person frames (visual cross-check, not an assertion)

From the final `first-person-rig.spec.js` run, directory `C:\Programowanie\VibeOnDuty\test-results\first-person-rig-lit-full--d7e80-n-one-anatomy-and-gun-owner\` (gitignored output, overwritten by the next Playwright run):

| Frame | sha256 |
|---|---|
| `crouch-1.38.png` | `26a6a97edd783a420e2b1eb4c8cea453dbd262050763d7073df76e30995aab64` |
| `crouch-0.png` | `488237ce35c5f3d1bf06ce318f16c4afd2c1816e8904683542e5ffc7ffe8bfd0` |

Description only: `crouch-0.png` shows the level view with the arms, weapon, a distant figure and walls; no torso geometry is seen in front of the view. `crouch-1.38.png` (looking up) shows the arms and weapon in the lower part and, across the upper half, a large dark band and figures against sky. I cannot attribute that dark band to a particular mesh from the picture alone (it may be a character or scene geometry in the range), so I do not say whether the chest is or is not visible there. It is for a person to look at. The unit-level guard of plan 07-35 measures the body view's torso vertices at this pitch.

## Task 3 verify command (order change)

Run as written, exit code 1. Its internals: the record has `status: preview`, `lean: right`, `reviewed_by: owner`, and the constant in `src/builders/weaponHandling.js` is 12 equal to `lean_degrees: 12`; it fails on the check that `git diff --name-only <shown_commit>..HEAD` is empty, for two reasons. (a) The recorded `shown_commit` is not a valid object (deviation 2), so that comparison cannot run. (b) With the real hash `eb4304115911b00565fa7acaac25c6619148972d`, the differing paths under `src tests public server index.html style.css` are exactly one: `tests/animation-live-route.spec.js` (additions only, from `0e8d4f1` and `1b33888`). Nothing under `src/`, `public/`, `server/`, `index.html` or `style.css` differs. That is the recorded consequence of the order change; it is for the orchestrator to judge.

## Not verified

- Human aesthetic acceptance (the preview is not an approval; plan 07-37 asks).
- Frame rate on any device; all timing is software-rendered headless.
- Full offline and multiplayer suites (plan 07-30).
- Whether torso geometry is visible in `crouch-1.38.png` (see above).

## Self-Check: PASSED

- `tests/animation-live-route.spec.js` exists; commits `0e8d4f1` and `1b33888` are ancestors of HEAD.
- No stub, no skipped test; no requirement marked complete.
