---
phase: 01-two-client-authoritative-tdm
fixed_at: 2026-10-04T10:33:15Z
review_path: .planning/phases/01-two-client-authoritative-tdm/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
final_gates: incomplete
---

# Phase 01: Code Review Fix Report

**Source review:** `01-REVIEW.md` (2026-10-04T05:53:11Z)
**Report completed:** 2026-10-04T10:33:15Z
**Iteration:** 1, single review-fix pass; no external CLI review or automatic re-review loop.

All five critical findings have individual atomic commits. No findings were skipped.
The interrupted initial fixer completed those commits; this closeout preserved them,
corrected remaining test-controller assumptions and completed the report. `all_fixed`
describes the five code-review findings, not Phase 01 human acceptance or a new clean review.

## Fixed Issues

### CR-01: Public matchmaking creates permanently retained rooms without admission bounds

**Files modified:** `server/index.js`, `server/hosting.test.js`, `server/tdmRoom.test.js`,
`server/testHelpers/hostileClient.js`, `docs/MULTIPLAYER.md`, `AGENTS.md`, `SECURITY.md`.
**Commit:** `4720cbf`
**Status:** fixed: requires human verification
**Applied fix:** Intercept matchmaking HTTP before the framework router/body reader.
Require an approved Origin, bounded join body and one of the operator-room admission
routes. Reject public creation and full reservations instead of allocating another
room. Preserve the WebSocket Origin gate and the designated operator room.
**Regression evidence:** Real HTTP tests reject foreign/missing Origins and repeated
unjoined room creation, exhaust reservations without increasing room count and
recheck the retained room after actual reservation expiry. Real SDK helpers now use
approved admission Origins.

### CR-02: Shared-map URL data executes JavaScript through the menu card

**Files modified:** `src/main.js`, `tests/hosting.spec.js`, `SECURITY.md`.
**Commit:** `3c606da`
**Status:** fixed
**Applied fix:** Build the card with DOM nodes and `textContent`. Set image `src`
only for bounded editor PNG data URLs; reject remote/SVG and attribute-shaped
thumbnail data. The defect was inherited in the scoped file and predates Phase 01.
**Regression evidence:** A real production-browser shared URL supplies harmless
name/description/thumbnail injection sentinels, verifies literal text and no event
execution, rejects unsupported thumbnails and retains a valid PNG.

### CR-03: Legitimate hits disappear when projectile impacts reorder shot IDs

**Files modified:** `src/network/onlineUi.js`, `src/network/onlineUi.test.js`,
`AGENTS.md`, `SECURITY.md`.
**Commit:** `ae9b670`
**Status:** fixed: requires human verification
**Applied fix:** Keep monotonic impact event IDs and replace the shot high-water
mark with a generation-scoped bounded set of 128 seen shot IDs. Preserve recipient,
target-life, shooter-life and match validation; reset dedupe on retirement.
**Regression evidence:** Two real swept M4 projectiles yield firing IDs 2 then 1,
reduce target health to 44 and present two markers/numbers once. Repeated events,
seen shots and invalid generations remain rejected.

### CR-04: Confirmations can precede their generation patch and are dropped permanently

**Files modified:** `server/tdmRoom.js`, `server/hosting.test.js`,
`server/tdmRoom.test.js`, `server/testHelpers/hostileClient.js`,
`docs/MULTIPLAYER.md`, `AGENTS.md`, `SECURITY.md`.
**Commit:** `b21119f`
**Status:** fixed: requires human verification
**Applied fix:** Stage at most 128 private confirmations; recheck current membership,
match and shooter/target lives at `onBeforePatch()`, then use the pinned transport's
`afterNextPatch` send option. Clear staged events when their generation retires.
**Regression evidence:** A real SDK same-step respawn/hit callback observes target
life 2 in its schema before the actual UI helper accepts the hit. A target retiring
before the patch receives no queued confirmation. Room tests retain private,
duplicate, stale shooter/target/match and replacement-membership checks.

### CR-05: The visible KILLS counter does not consume authoritative kills

**Files modified:** `src/network/onlineSession.js`, `tests/multiplayer.spec.js`,
`docs/MULTIPLAYER.md`, `AGENTS.md`, `SECURITY.md`.
**Commit:** `dd6f518`
**Status:** fixed: requires human verification
**Applied fix:** Apply authoritative personal kills to `player.kills` and
`#kills-num` on snapshots; reset them on online entry and retirement. The rematch
snapshot resets personal statistics automatically.
**Regression evidence:** Production-browser lifecycle checks change an injected
stale entry counter 99 to 0, observe a real authoritative kill as 1 in schema/local
player/HUD, and verify results, automatic rematch and retirement reset behavior.

## Supplementary defect and test-controller corrections

These commits are separate from the five in-scope findings and do not inflate the
frontmatter fixed count.

- `b0650d2`: Retiring an offline killcam invoked the old death-completion callback,
  allowing a stale death screen to cover the next menu/session. `stopKillcam()` now
  cancels it; expiry and explicit Skip still complete the current death once. Three
  new unit cases and real browser regression failed before the fix and passed
  afterward, as recorded by the initial fixer. Modified `src/replay/killcam.js`, new
  `src/replay/killcam.test.js`, both relevant browser regression files, `AGENTS.md`
  and `SECURITY.md`. Status: fixed: requires human verification.
- `d6c6979`: Wait up to 20 seconds for actual online readiness in the offline
  retirement controller after observed successful joins taking up to 12.9 seconds.
  Preserve the actual session/phase/state assertions.
- `5e9d48e`: Wait for authoritative `lastConsumedSeq >= sentSeq` before judging aim
  convergence. Previously the controller compared stale yaw immediately after
  sending a turn, which caused real movement to drift into a wall. This changes
  test synchronization, not movement or authority rules.
- `0cf7a8c`: Match the server's `1e-7` ms deadline tolerance. An observed coherent
  next-match snapshot had `nowMs=23299.99999999987` versus prior result deadline
  `23299.99999999997`, so raw `<` incorrectly expected the old results phase.
  A focused closeout run also observed results with 11.2 seconds remaining and
  failed the controller's assumption that observation must happen within two
  seconds. The controller now verifies countdown arithmetic, settings fixed at
  15 seconds and the time-limit result deadline within one 30 Hz simulation step
  of match deadline plus exactly 15000 ms. It retains next-generation, unchanged
  deadline, no-early-rematch, same-settings and reset assertions. Focused time-limit
  test passed (32.3 seconds) after correction. Exact score-limit 15-second duration
  and generation retirement remain covered by `src/shared/tdmRules.test.js`.
- `6132a5e`: The first closeout unit run had 243/244 passing; the four-cycle TLS
  corruption/changed-host/mismatched-key case hit its explicit 20000 ms test
  deadline with no assertion failure (suite 211.61 seconds). Bound that composed
  case at four times the existing 15000 ms single-cycle allowance. All certificate,
  manifest, hostname, key and ACL assertions and production subprocess deadlines
  remain intact. The focused replacement case passed in 17.32 seconds; the full
  serial unit suite then passed all 244 tests in 22 files (166.48 seconds).
- `6c23eea`: The first full closeout multiplayer run passed 13/14 in 8.7 minutes;
  score lifecycle failed at the first keyboard waypoint before any combat. The
  retained action trace showed requested 150 ms `keyboard.press` taking 14525.7 ms,
  then two 100 ms pulses taking 3104.1 and 5591.0 ms. A moving snapshot entered
  x=62.016, then neutral acknowledgement arrived after overshoot to x=61.296.
  The controller now separately acknowledges crouch before precise movement and
  starts a page-owned release timer from the native Playwright keydown. Its DOM
  keyup goes through existing input handlers, followed by Playwright keyup to
  clear the driver's held-key state and authoritative stop-sequence acknowledgement.
  It cleans up the owned timer/listener afterward. No body/gameplay state is
  assigned, and the 45-second route bound, 0.35-metre waypoint radius, queue limits,
  score/life/generation assertions and production cadence are unchanged. Focused
  real score lifecycle passed (1.2 minutes); the complete 14-test suite was then
  restarted and passed both score/time lifecycle cases, but finished 9/14 with the
  separate failures below. This is automated input-controller evidence, not human
  gesture acceptance. No further pulse/deadline/authority adjustments were made.

## Verification

All closeout gates run serially in the **main checkout**
`C:/Programowanie/VibeOnDuty`, with existing dependencies. The parent authorized
run-local isolation `none` and branching `none` for this continuation due to base
divergence; no worktree, global Git trust, hook bypass, dependency change or push
was introduced. Git uses per-process `safe.directory` only.

Each committed fix was inspected in its actual source context, with narrow
regressions retained. The supplementary logic statuses above flag manual semantic
review even where regression tests pass.

| Final gate | Latest result |
| --- | --- |
| `npm run lint` | PASS, 0 warnings |
| `npm run typecheck` | PASS |
| `npm run typecheck:mp` | PASS |
| `npm run build` | PASS; existing >500 kB chunk warning |
| `npm run build:mp` | PASS |
| `npm run test:unit -- --maxWorkers=1` | PASS, 244 tests / 22 files, 166.48 seconds |
| `npm run test:e2e -- --workers=1 --timeout=60000` | PASS, 19 tests, 4.4 minutes |
| `npm run test:mp` | FAIL, 9 passed / 5 failed, 10.1 minutes; exact cases below |

The unit and offline suites ran after `6132a5e`; quick lint/types/build gates were
also repeated successfully at that point. The final multiplayer run used `6c23eea`.
The only subsequent committed change between those trees is the multiplayer
test controller; no production source, dependencies, offline tests or unit inputs
changed. Its modified JavaScript passed `node --check` and focused score lifecycle.

### Latest multiplayer checkpoint

`test-results/.last-run.json` records the final failed run. The following ZIP traces
and their neighboring `error-context.md` files remain in ignored local test output:

| Failed test | Observed failure | Retained trace |
| --- | --- | --- |
| `combat: real M4 cover, ammo, reload and private hit outcomes agree` | 45-second `(34,46)` keyboard route ended at `(33.856,36.816)`, stopped, with queue-limit rejection recorded | `test-results/multiplayer-combat-real-M4-73bf0--private-hit-outcomes-agree/trace.zip` |
| `authority: real M4 cover, ammo, reload and private hit outcomes agree after forged offline outcomes` | First cover shot expected exact ammo 29; remained 30 after 10-second poll | `test-results/multiplayer-authority-real-7f5a2-ter-forged-offline-outcomes/trace.zip` |
| `feedback: real M4 cover, ammo, reload and private hit outcomes agree` | First cover shot expected exact ammo 29; observed 25 after delayed down/up control | `test-results/multiplayer-feedback-real--50b78--private-hit-outcomes-agree/trace.zip` |
| `tracer: two browsers join and move` | 45-second `(62,22)` route deadline expired; final diagnostic snapshot was `(62.200,21.848)`, stopped/crouched, with queue-limit rejection recorded | `test-results/multiplayer-tracer-two-browsers-join-and-move/trace.zip` |
| `movement: real sprint jump crouch ADS, ramps, walls and camera restore agree in two browsers` | Recorded transient airborne observation remained false in a browser after 10-second poll (`same()` at line 802, call at line 830) | `test-results/multiplayer-movement-real--8ef02-store-agree-in-two-browsers/trace.zip` |

The nine passing cases cover map-card safe sinks, HTTPS/WSS joining, certificate
restart, team assignment, score-limit lifecycle/KILLS HUD, time-limit lifecycle,
connection recovery, repeated actor retirement/resources and entry/offline controls.
The complete preceding closeout run passed 13/14 (8.7 minutes), failing only the
score-route controller; the page-timed release change fixed that focused case and
both lifecycle cases passed in the latest full run. The parent handoff also reports
a historical 14/14 multiplayer pass (approximately 9 minutes) before the final
closeout corrections; that historical run is not current final-tree validation.

The host was contended by other browser/Node work. One earlier measured keyboard
driver request took 14.5 seconds for a requested 150 ms pulse; later cover inputs
were either canceled before consumption or held through multiple shots. These are
concrete timing symptoms, not a proven performance classification of every final
failure. No new production source defect was established by this closeout; remaining
failure classification and complete passing multiplayer validation are unresolved.
The parent explicitly stopped further speculative controller changes/repeated full
runs under the same conditions. All original route, ammo, health, generation,
resource and authority assertions remain intact. Unrelated process 26532
(`tests/mp-browser.mjs`) was left alone. All owned fixture servers retired normally;
final process inspection found no VibeOnDuty `server/index.js` fixture process.

The initial Phase 01 baseline (238 unit / 18 offline / 13 multiplayer) and early
post-fix multiplayer pass are historical evidence, not this final closeout result.
The initial fixer reported a later serial 244-unit run plus successful lint/types/
builds; latest final browser gates were still incomplete on interruption. Startup/flood
failures reported by the initial fixer and the reproduced controller
aiming/readiness/floating-point failures must not be summarized as all gates passing.
The closeout's failed 243/244 unit run, focused recovery, failed 13/14 multiplayer
run, focused score recovery and final failed 9/14 run are separately recorded above.
No current 14/14 pass or phase verification is claimed.

Actual LAN browser certificate trust, normal pointer-lock gestures, full-size
visual acceptance, cross-device/Pi performance and retained human probes remain
pending. No shared Phase 01 requirement is marked accepted by this report.

---

_Fixer: gsd-code-fixer; continuation closeout_
_Iteration: 1_
