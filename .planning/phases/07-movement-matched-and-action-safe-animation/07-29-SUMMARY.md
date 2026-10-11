---
phase: 07-movement-matched-and-action-safe-animation
plan: "29"
subsystem: testing
tags: [playwright, browser-regression, reference-driver-baseline, gap-closure]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-27 composed live clips, 07-28 look-down offset, 07-34 pelvis-over-root composition"
provides:
  - "tests/animation-live-route.spec.js: browser regression of the live composed pose (layers, weapon and chest direction, knees, feet, pelvis)"
  - "Reference-driver baseline replaced by the pinned fixture plus the inertia restore, hash recorded"
  - "Authored-source spec rebound to findMotionClip; body-view look-down case settled and split by stance"
affects: [07-30, 07-31, 07-32, 07-33]

plan_head_before: 188a480110f4c2cd8208bfa0b7ccb0661f6d72b3
plan_head_after: d022e515d84cb3c8d80bd2e22001902a097127c5
commits: 13
actuals:
  tokens: 9500
  tasks: 2
  commits: 13

tech-stack:
  added: []
  patterns:
    - "Browser case waits are counted in rendered frames; test.setTimeout is only the case budget"
    - "Specs that import /src/... run on a root-base server: MSYS_NO_PATHCONV=1 PUBLIC_BASE=/"

key-files:
  created:
    - tests/animation-live-route.spec.js
  modified:
    - tests/animation-resources.spec.js
    - tests/fixtures/enemyAnimations.uncached.js
    - tests/animation-motion-source.spec.js
    - tests/first-person-rig.spec.js

key-decisions:
  - "Reference baseline replaced (matched was false at inputs 2 and 3 only); pin updated; fixture diff equals the driver's inertia restore"
  - "Authored-source spec rebinds its three played actions to g.findMotionClip clips instead of changing createReviewCharacter"
  - "Look-down: crouched sample taken settled (18 ticks), foot_r not asserted on screen when crouched (measured y -1.708)"
  - "No requirement is marked complete"

requirements-completed: []

coverage:
  - id: D1
    description: "Live standing, walking and crouch in a real browser: composed live_ lower layers, weapon and chest along the facing, bent knees, feet on the floor"
    requirement: ANIM-03
    verification:
      - kind: e2e
        ref: "tests/animation-live-route.spec.js#live: standing, walking and crouching show the composed pose"
        status: pass
    human_judgment: true
    rationale: "Angles and positions are measured; whether the motion looks right is the owner's judgment in plan 07-33."
  - id: D2
    description: "Focused browser set (8 files, 61 cases) and two selected character-art cases pass on the final source; five fast gates exit 0"
    requirement: ANIM-02
    verification:
      - kind: e2e
        ref: "playwright: eight focused spec files, 61 passed; character-art two cases, 2 passed"
        status: pass
      - kind: unit
        ref: "npm test: 465 tests in 35 files"
        status: pass
    human_judgment: false

duration: long (three stops and resumptions)
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 29: Browser proof of the repair, baseline decision, fast gates Summary

**A new browser spec shows the live player standing, walking and crouching on composed `live_` legs with weapon and chest along its facing; one reference-driver baseline replacement, one authored-source rebinding and one settled look-down edit were made by their plan routes; 61 focused browser cases, 2 character-art cases and the five fast gates pass on the source after plan 07-34.**

## Commits (this plan)

| Commit | What |
|---|---|
| `706157b` | `tests/animation-live-route.spec.js` (new) |
| `3665406` | reference-driver baseline replacement (fixture + pin) |
| `7582eac` | `tests/animation-motion-source.spec.js` rebinding (10 added, 0 removed) |
| `d022e51` | `tests/first-person-rig.spec.js` statement at line 222, settling loop, stance split (17 added, 5 removed) |

The measured `commits:` of the frontmatter (13) is `git rev-list --count 188a480..HEAD` and also counts plan 07-34's code commits and the orchestrator's planning commits that landed between the start and the end of this plan. The four above are this plan's.

## Deviations and command forms (all orchestrator-authorised, recorded)

1. **Port probe.** The plan's probe checked 127.0.0.1 only. A Vite server listened on `[::1]:5173` (the orchestrator's `npm run dev` child) and was reused by Playwright. Probe now checks both stacks; it ran before every browser command.
2. **Void runs of `animation-resources.spec.js`** (kept as records in the scratchpad, not the spec's result, no decision rule triggered):
   - run against the reused foreign server: 11 of 13 failed on module fetches (`res-void-foreign-server.txt`);
   - run on a free port at the default base `/VibeOnDuty/`: 6 failed, `Failed to fetch dynamically imported module` (`res2-void-wrong-base.txt`);
   - run with `PUBLIC_BASE=/` mangled by Git Bash path conversion (`"base" option should start with a slash`): same failures (`res3-void-mangled-base.txt`).
   Cause of the last two: the specs import `/src/...` and need a root-base server; `vite.config.js` defaults to `/VibeOnDuty/`. Command form used from then on: `MSYS_NO_PATHCONV=1 PUBLIC_BASE=/ npx playwright test <specs> --workers=1`.
3. **`test.setTimeout(240000)`** on the live-route case (about 650 rendered frames at 13 to 30 fps). Every wait inside is a frame count. **Walking window** is 40 consecutive samples (covering at least one stride, asserted) instead of 12 spread samples.
4. **Stop-and-resume.** The first run of task 2 on the source before plan 07-34 stopped on two unpredicted failures (motion-source 2 of 4, first-person-rig line 265 crouched `leftError` 0.0358 m against 0.025). Those results at `1e300c8` stay on record below; plan 07-34 repaired the source.

## Task 1: live-route spec

Passed on every run: with the foreign server up (56.7 s), with the port free (58.8 s), and again on the final source (1.0 min). The spec starts its own Vite server, so the foreign server did not affect it. Measured on the final source (earlier runs within 0.5 degrees and 0.3 m, except the crouch which changed with 07-34, see the rerun in the final set):

| State | Lower layer | Pelvis (m) | Weapon yaw (deg) | Weapon pitch (deg) | `spine_03` yaw (deg) | Knees (m) | Lowest foot (m) |
|---|---|---|---|---|---|---|---|
| Standing | `live_m4_ready_lower` only; ankles and balls move 2.2e-16 m over 30 frames | 0.8768 | -0.09 to 0.01 | -0.211 (reference) | -0.71 to 0.69 | 0.091 to 0.099 | 0.0278 |
| Walking | `live_walk_forward_lower` only, speed 3.60 to 4.50 m/s | 0.8194 to 0.8631 | -1.90 to 1.71 | -2.00 to 0.74 | -2.37 to 1.92 | 0.089 to 0.278 | 0.0091 |
| Crouched, still | `live_crouch_idle_lower` at weight 1.000 (12 of 12) | 0.4695 to 0.4754 | -0.20 to -0.12 | -0.57 to -0.44 | -0.70 to 0.56 | left 0.184, right 0.362 | 0.0146 |
| Stood up again | | 0.8768 | | | | | |

These are the figures of the first completed free-port run of this plan (before plan 07-34); the final-source run passed all assertions again (all limits in the spec: weapon yaw 3.5, weapon pitch 2.5, `spine_03` yaw 3.5, foot 0.03 below root, knees at least 0.15 crouched, pelvis at most 0.55 and at least 0.30 lower, stood up within 0.03). The final-source figures were not printed to this summary; they are in the spec's attached `live-route-figures` of that run only and were not copied. Crouch pelvis drop before 07-34: 0.401 m. No `vod7_` lower layer was selected in any state; no page error.

## Task 2

### Reference-driver comparison (`tests/animation-resources.spec.js`)

Unedited run (correct base): 12 of 13 passed; case 14 failed with `matched = [true,true,false,false,true]` (inputs 2 and 3: pistol reload and pistol melee), every other expectation of that case held (all `outcomes` true, `lookups` 0, `enumerations` 0, and `currentMount`, `replaced`, `staleSafe`, `weaponReplacement`, `mixerReplacement`, `retired`, `keeper`, `nextUsable` true). Replacement made by the plan's rule:

- old sha256 `8217f32ff2c4a65613aadcf62442c092a3e0d604f8ff5f7c5dc361b730d4aee0`
- new sha256 `61db86321fb6d179d643e74d9b2797a463e1f6c9eabed215b37d74a918239f67` (LF, no CR, as before)
- fixture = its bytes at `e09bf9b` plus the driver's inertia restore statement for statement: `_restoreInertia` and the new `_tickInertia` (as in the driver), `_restoreInertia(e);` before `stopAllAction` on death, `_restoreInertia(e); e._inertiaHeld = null;` inside the inline disposer lambda (the fixture has no `retirePresentationReferences`), and the comment plus `_restoreInertia(e);` after the `_snapBones` line in `tickPresentation`. The driver's hunks 3 and 4 did not apply by patch for context reasons, so they were applied by hand. Fixture diff 34 insertions, 4 deletions, equal to the driver's inertia-restore diff since `e09bf9b` (34/4); containment check exit 0.
- spec: line 9 only (numstat 1/1).
- Differing bones at indices 2 and 3: not captured (the cache file was overwritten by the passing re-run; recording them would have needed a further browser run on the old fixture).
- The reference arm of the paired timing gate is the git blob of commit `c973458` and is not affected.
- After the replacement: 13 of 13 passed, and again on the final source.
- `src/builders/enemyAnimations.js`, `tests/fixtures` and the spec are byte-identical to `3665406` (verify exit 0).

### Authored-source spec (`tests/animation-motion-source.spec.js`)

Before: 2 of 4 failed (case 132 at `expect(sample.authored).toBe(true)`, case 170 at `expect(frames.every(s=>s.name==='vod7_turn_left')).toBe(true)`), because `createReviewCharacter` resolves live clips by plan 07-27's design. Edit: 10 lines inserted after line 43 (comment plus a block that loads the template with `GLTFLoader`, then rebinds `walk`, `reload`, `turn_left` on the clone's mixer to `g.findMotionClip(template.animations, key, 'm4')` when it returns a clip). Lines 152, 158, 159, 175, 176 are unchanged. After: 4 of 4 passed (both runs). Diff since `e09bf9b`: 10 added, 0 removed.

### `tests/first-person-rig.spec.js`

Run on the final source before any edit: 11 of 12 passed; the case at line 213 now passed line 265 (crouched `leftError` 0.0000) and failed only at the look-down expectation (lines 269 to 270). Predicted outcome; sole failing expectation, so the plan's edits applied.

Browser coordinates (screen x, y at pitch -1.38; `floorDelta` 0 for all):

| Stance | calf_l | calf_r | foot_l | foot_r |
|---|---|---|---|---|
| Standing (unchanged by the edit) | -0.105, -0.351 | 0.145, -0.597 | -0.068, -0.316 | 0.059, -0.693 |
| Crouched, one tick after entry (before the edit, with line 222 statement) | -0.24, -0.22 | 0.26, -0.74 | -0.13, -0.29 | 0.09, -1.08 (off) |
| Crouched, settled (after the edit) | -0.578, 0.119 | 0.340, -0.587 | -0.274, -0.366 | 0.302, -1.708 (off) |

Settle ticks used: 18 (limit 10 to 40). Crouched `leftError` and `rightError` are 0.0000 at all four pitches. `calf_l`, `calf_r` and `foot_l` are inside 0.9 (at least 0.1 inside the edge), so no stop condition applied. The Node prediction for the 07-34 composition (`calf_l` -0.45, 0.15) agrees with the browser to 0.13 on x and 0.03 on y. `foot_r` is below the bottom edge.

Edit (diff since `e09bf9b`: 17 added, 5 removed): `g.playerMixer.stopAllAction();` after line 222; the `tickPresentation` observation stored as `observation`; for the first crouched sample at pitch -1.38 the same call is repeated (no sampling) until the pelvis world height changes by less than 1e-4 m between two ticks, at least 10 and at most 40 ticks, failing otherwise; `settleTicks` added to the returned result; the look-down expectation split into the unchanged standing predicate and a crouched predicate (`floorDelta` under 1e-6 for all four joints; `calf_l`, `calf_r`, `foot_l` inside 0.9 on both axes; `foot_r` not asserted on screen, with the measured coordinate in a comment). No other expectation changed. After: 12 of 12 passed (twice). `src/builders/firstPersonRig.js` is unchanged since `779ef7f`.

## Sweep table: predicted, actual, edit

| Test | Predicted | Actual (source before 07-34 at `1e300c8`) | Actual (final source) | Edit |
|---|---|---|---|---|
| `animation-resources` 14 to 98 | no edit, or baseline replacement if `matched` false | `matched` false at 2, 3 | 13 of 13 | replacement (above) |
| `animation-presentation` | passes | 4 of 4 | 4 of 4 | none |
| `animation-regressions` | passes | 6 of 6 | 6 of 6 | none |
| `animation-motion-source` | (amended) rebinding route | 2 of 4 failed | 4 of 4 after the rebinding | rebinding, test-only |
| `weapon-handling` | passes | not run | 11 of 11 | none |
| `first-person-rig` | line 265 passes; look-down rule | failed at line 265 (0.0358) | line 265 passes; line 270 failed, then 12 of 12 after the edits | statement + settle + stance split |
| `animation-review` | passes, no edit | not run | 10 of 10 | none |
| `character-art` two cases | passes, no edit | not run | 2 of 2 (`-g` pattern) | none |
| `multiplayer.spec.js`, unit tests of `src/builders` | not run in this plan / frozen | | | none |

## Gates

| Command | Result |
|---|---|
| eight focused spec files in one command (`MSYS_NO_PATHCONV=1 PUBLIC_BASE=/ npx playwright test ... --workers=1`) | exit 0, 61 passed (1+13+4+6+4+12+11+10), 10.3 min |
| `npx playwright test tests/character-art.spec.js -g "art ink: posed current rig\|art soldier: fitted painted equipment"` | exit 0, 2 passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:mp` | exit 0 |
| `npm test` | exit 0, 465 tests in 35 files |
| `npm run build` | exit 0 (chunk above 500 kB warning, as before) |
| containment check | exit 0 |
| "No edit" files equal to `e09bf9b` (presentation, regressions, weapon-handling, multiplayer, animation-review, character-art) | exit 0 |
| motion-source assertions kept, diff within 12/2 | exit 0 (10/0) |
| driver, fixture and pin unchanged since `3665406` | exit 0 |
| pin is the sha256 of the current fixture, spec differs in one line | exit 0 |
| `git status --short -- src server public tools` | empty |

## Not run

The full offline suite (138 cases at the last record), the multiplayer suite, `tools/art/stable-gates.mjs`, any paired or capture command, and `tools/art/crouch-correction-review.mjs` (a review tool whose recorded evidence is history; a rerun would now show composed legs). A regression outside the focused specs can still appear in plan 07-30.

## Open items

1. Which bones differed at `matched` indices 2 and 3 was not recorded.
2. The final-source live-route figures were not copied into this summary (see Task 1 note); all its limits passed.
3. No human or aesthetic judgment is recorded; `humanMotionAcceptance` stays pending.
4. The look-down edit and the baseline replacement are for the independent review of plan 07-33.
5. The crouched foot_r is off screen when looking down (-1.708); the knees and the left ankle are visible.

## Self-Check: PASSED

- `tests/animation-live-route.spec.js` exists; commits `706157b`, `3665406`, `7582eac`, `d022e51` are ancestors of HEAD.
- Acceptance checks above were re-run at `d022e51`; no stub, no skipped test.
