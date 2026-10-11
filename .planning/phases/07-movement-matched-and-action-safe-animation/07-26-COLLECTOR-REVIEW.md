---
phase: 07-movement-matched-and-action-safe-animation
plan: "26"
verdict: approved
reviewer_model: opus
reviewer_effort: medium
moving_online_sha256: 228ddb43408d90910c112d3ae0687ff2469a8338976253ab38aa01f24c8a8b5d
online_route_sha256: aabd7d4958cfbac89746ad892de67d41997fd2da7bdaacbfaa49214e1a2b9eae
online_route_test_sha256: c3c0940afbe0f4e5590138656372851a50028512a4d2196baeef12d40603433a
moving_online_control_sha256: 6cc1a36af5eed30f822346918e987471d141c67179369c13c3d91a8d5e1227dc
moving_online_control_test_sha256: a2c22ce5fa39eb036928755339e752164e161b48ef948c47c871e0abf8731b40
reviewed: 2026-10-11T01:27:09Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - tools/art/moving-online.mjs
  - tools/art/online-route.mjs
  - tools/art/online-route.test.mjs
  - tools/art/moving-online-control.mjs
  - tools/art/moving-online-control.test.mjs
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Plan 07-26: Collector Review

Independent review of the collector change (commits `957e81a`, `559b953`, `773be68`, `51b1004`, `967fd8a`). The reviewer did not write the change. Model `opus`, effort `medium`.

**Verdict: approved, with notes.** No finding requires a code change before the one strict capture. No path writes game or room state, the report shape the pinned capture tool reads is unchanged, and every failure mode found ends in a loud tier failure or a harmless detour, never in a false observation. Five warnings are residual risks for the capture and are listed so the capture's reader knows what to look at.

## What was checked

- All five files hash to the expected values (computed with `sha256sum` on the on-disk bytes; they are the frontmatter values). All are LF.
- `node --test tools/art/online-route.test.mjs tools/art/moving-online-control.test.mjs`: 33 tests, 33 pass, 0 fail.
- `--read run-05,run-06,run-07` and `--read warm-01` over low, medium, high: PASS, exit 0. `--read` of run-04, run-02 and tracer-high-2: FAIL (superseded criterion; the last two also bind to other bytes).
- `tools/art/animation-capture.mjs` still hashes to `20884feee9f1e121198fd3d32e6aec18640dfb46dc248218d1b9f5f4cd78bd32`; `git diff --stat 0d12fd6..HEAD` over the protected paths prints nothing.
- `git diff --stat 80835ae..HEAD` outside `.planning` touches only the five files.
- Not run, as instructed: any browser, the control, the capture, a paired session, the full suites.

## Findings

| ID | Severity | File:line | Finding | Required change |
|---|---|---|---|---|
| W-01 | WARNING | `tools/art/online-route.mjs:171-174`, `tools/art/moving-online.mjs:101-102` | The back-off step is taken away from the waypoint on whichever side the body rests. On the far side of the box that means further out of the lane. Leg 1 ends against the solid cell column 14 row 11: a rest 1.25 to 1.65 m past (62,46) backs off west into the wall; `moving` is displacement-based (`src/shared/movement.js:85`), so the press never counts as effective and the leg ends as `stalled` after 150 ticks. Leg 2 would back off north onto the ramp tile (row 4 column 15). Not seen in any record (it needs a far-side rest; the tightest was -0.87 m). | None before the capture. If it happens the tier fails loudly. Fix in a later plan: on the far side approach, do not back off. |
| W-02 | WARNING | `tools/art/online-route.mjs:32-37,49,52`; `tools/art/online-route.test.mjs:188,236` | The constants call 2.16 m the largest stop after a release and 3.11 m the longest step from rest, and the unit test derives far-side safety from them. The control records contradict both: 3.46 m after release (run-06 High leg 4, run-07 High legs 3 and 4) and 4.32 m and 4.03 m from rest (run-07 High back-offs, 1.72 to 6.04 and 1.71 to 5.74). So `BACK_OFF_WITHIN_M` 1.86 is too narrow: a body at rest 1.86 to about 3 m short steps toward the waypoint from rest and can pass the far side. This is what failed run-02 (2.07 to -1.96); run-04 (2.26 to -0.90) and warm-01 (2.15 to -0.87) missed it by 0.35 and 0.38 m. The plan's analytic bound (4 cm margin) is not a bound: it also ignores that releases happen up to 0.8 m inside the threshold (released at 1.57, 1.66, 1.73, 1.91 m in the final series). | None before the capture. Treat a lane exit in the capture as expected at roughly one capture in five to ten, not as impossible. |
| W-03 | WARNING | `tools/art/moving-online.mjs:68,87-89,138` | The collector never judges the lane. A sample outside the lane or a rest beyond the box is only counted in the additive `legs[].outsideLaneSamples` and `legs[].stops`; the walker presses again and the tier can end `complete`. Only the control fails on it. Beyond the far side lie: leg 1 a wall (see W-01), leg 2 a ramp, legs 3 and 4 open floor (row 5 columns 5 to 7; column 8 rows 12 and 13). Collision is server-side, so nothing can pass through a wall or crack cell; a blocked body ends as `stalled`, `corrections` or `leg_bound`. No observation depends on the lane. | None. Whoever reads the capture report should read `online.samples[*].legs` and say so if `outsideLaneSamples` is not 0. |
| W-04 | WARNING | `tools/art/moving-online.mjs:238,254` (unchanged from `80835ae` lines 122, 136) | The reload sample is the first one seen and is asserted without waiting for the rendered actor (`pose.upper === 'reload'`). It is the same kind of race between a state patch and the next rendered frame that failed run-02 Low for the fresh life and was fixed at lines 251-252 for that case only. 25 of 25 tiers that reached it passed it across all records. Not part of this plan's diff. | None. If a tier of the capture fails with an assertion on `reload`, this is the first place to look. |
| W-05 | WARNING | `tools/art/moving-online.mjs:276-281,288-299` | The race bounds the tier body at 540000 ms, but the teardown after it (context close, movie read, `fixture.stop()`) has no bound of its own; the 60000 ms allowance is a projection, not a limit (the old collector had the same teardown). After the race fires, `runTier` is not cancelled: it runs on until a browser call rejects, can still push into `legs` and `observations`, and a `browser.newContext()` that resolves late leaves a context open until the browser closes. Reachable only when a browser call hangs for minutes. | None. |
| I-01 | INFO | `tools/art/moving-online.mjs:67,78-85`; `src/network/onlineSession.js:87,274,280` | `lastInputRejection` is set on each rejection and cleared only on join, so it is sticky. In every leg of every record `staleInputSamples` equals the number of samples. The field counts polls whose latest known reason was `stale_input`; strictly that is not a lower bound of rejections inside the leg, although at these frame rates the true count is far higher. | None. Do not cite the number as a measurement. |
| I-02 | INFO | `tools/art/moving-online-control.mjs:70,72,231` | `judge` passes a stop whose `restAtM` is `null` (`null >= -1.25` is true), and an empty tier list passes vacuously. Neither is reachable: the bound collector bytes always record `remaining`, and the CLI rejects an empty list (line 245). | None. |
| I-03 | INFO | `tools/art/moving-online.mjs:72-77` | `release` clears its state before the two `keyboard.up` calls; if the first throws, ControlLeft is not released and the `finally` call does nothing. Only possible when the page is already gone. | None. |
| I-04 | INFO | `tools/art/online-route.mjs:28,30,60` | `STOP_LEAD_M`, `MAX_STOP_STEP_M` and `MAX_STOP_LAG_MS` no longer steer or judge anything. Kept by the plan. | None. |
| I-05 | INFO | `tools/art/moving-online.mjs:149-150` (unchanged from `80835ae` lines 71-72) | `aim` turns the view with a synthetic `mousemove` dispatched inside the page, not with `page.mouse`. It is an input event and writes no state, but it is not a trusted event. The old synthetic `keyup` of `pulse` is gone. | None. |
| I-06 | INFO | `tools/art/moving-online-control.mjs:67-74` | Rules 2 and 3 of criterion version 2 follow from rule 1 and completion: a rest beyond the box is a sample outside the lane, and `walk` only returns inside the box. In effect the criterion is "complete and zero samples outside the lane". It measures no margin. | None. |

## Answers

**1. State writes and page calls.** None write game or room state. Every page call in `tools/art/moving-online.mjs`: `window.__mpDebug()` (18, 63, 235); read of `document.pointerLockElement` (48, 51); the collector's own `__movingFrames` (30-32, 63), `__movingSeen` and `__movingObserver` (233-241, 246, 251, 253); the synthetic `mousemove` (149-150, unchanged, I-05); the init script that stores the graphics tier in `localStorage` (209, unchanged); a read of the join button (212); clicks on `#mp-join-btn`, `#mp-resume`, `#pause-resume-btn` (50, 214); `inputValue` and `screenshot` (260-262). Input goes through `page.keyboard` and `page.mouse` (75-76, 104, 108, 120, 177, 187, 222-227, 243, 245). No socket wrapper in the collector. The only socket wrapper is the control's `--exact-rejections` (`moving-online-control.mjs:146-175`), which the capture never loads and whose records `judge` rejects (line 49).

**2. Keys and button released.** Yes on every path that still has a page. `walk`: `try`/`finally` with `release()` (90, 133-134). Crouch of `b`: 222-224. Right button of `b`: 225-227. Fire hold of `a`: 177-187. Fire click and R press are single down-and-up calls (243, 245). On the tier deadline the contexts are closed (293), which ends all input. Edge: I-03.

**3. Waits and the 600000 ms sum.** No wait in the tier body outlives `TIER_DEADLINE_MS`: `until` (37-38), the page wait (212-213), `walk` (60, 87-89), `offer` (157), `holdFireUntilDeath` (172) all take the smaller of their bound and the time left, and the whole body races a hard timer (278-281), which also covers calls with no bound of their own (`goto`, clicks, `evaluate`, `screenshot`). The budget starts before the fixture starts (268). The teardown is not bounded in code (W-05); in the records a whole tier, teardown included, took 42 to 69 seconds. 540000 + 60000 = 600000 is asserted in the unit test (`online-route.test.mjs:30`). The capture's total lifetime is 15600000 ms against a projected sum of 15452931 ms.

**4. Retries.** They change only how often the input is offered. The predicates are the old ones: `ammo < 30` on the authoritative snapshot of `b` (244), the observer's first reload sample (238, 246), `!target.alive` (182), the fresh sample (240). A repeated R during a reload or at full ammunition is refused by the server (`src/shared/combat.js:36-46`). The fire retry stops as soon as one shot is seen. The four assertions (254-257) are unchanged.

**5. Capture-facing values.** Unchanged: viewport 800x600, `deviceScaleFactor: 1`, video size 800x600 (206-207); tiers and their order (16, 195); the four waypoints (`online-route.mjs:19`); top-level `complete`, `samples`, `observations`, `media`, `authority` (199-202); media entries `path`, `sha256`, `bytes`, `format`, `continuousFullPixels: true` (296-297). The capture reads only `report.online.media` and `report.online.complete` (`animation-capture.mjs:1335, 1380, 1396`) and serialises the rest; the new fields are plain numbers, strings, arrays and nulls. One planned change shows in the recorded snapshots: `matchSeconds` 600 instead of 180 (269).

**6. Unit tests.** No browser, no network. `online-route.test.mjs` imports the shared map, `src/config.js` and the helper. `moving-online-control.test.mjs` imports `judge`, which loads `pipeline.mjs`; that module reads tracked files at import and an acceptance record only if it exists (`runtime-dependencies.mjs:17-22`). Playwright and Vite are imported dynamically inside `runControl` and `warmUp` only.

**7. Control label and `evidence/`.** Labelled on line 1, in `CONTROL_LABEL` (24), in every record (182) and on the first printed line (255). Records and movies go only under `.planning/research/.cache/07-26/` (25, 35, 189); the label must match `^[a-z0-9][a-z0-9-]*$` (248); `git check-ignore` must accept the path first (178-180); the record is created exclusively (188). No path comes from anywhere else. `evidence/` cites none of it.

**8. `staleInputSamples` wording.** Marked as a sampled lower bound in the failure message (`moving-online.mjs:82-83`) and in the per-leg line (`moving-online-control.mjs:87`), and in the comments (78; helper 211-212; control 13-14). The control's raw `failure` JSON line (91) prints the bare field, directly under the error text that carries the qualifier. See I-01 for what the number really is.

**9. Stop criterion version 2.** As a measurement of the run it is sound and direct: the extreme position of every press is a rest position, rest positions are sampled, so a lane exit cannot fall between samples. It cannot pass a run in which the body left the lane. It can pass a run with almost no margin, because it measures none (I-06), and the data say the margin is thin (W-02). In the collector a lane exit or a far-side rest is not judged (W-03): the walker continues, recovers on legs 2 to 4, and on leg 1 can end as a loud `stalled` (W-01). It cannot clip through a wall or crack cell, and it cannot continue silently in a way that changes an observation. The 6 m short rests of run-07 High are back-off steps inside long lanes, followed by a normal approach; they cost about 8 seconds per leg.

**10. Fresh-life wait.** It does not change what the observation proves. The assertion that actor and player share a life generation was already there (old line 139, now 257); the wait now lasts until that holds, inside the same 20000 ms. What it no longer does is fail when the actor is replaced one frame after the state; promptness was never asserted.

**11. Release threshold.** It depends on the collector's own frame counter and wall clock (`recentFramesPerSecond`, `moving-online.mjs:115`), the previous leg's rate (137), and the own player's position, yaw and `crouching` from `window.__mpDebug()` (66-67). Nothing unobservable and nothing game-internal.

**12. History.** The collector bytes have not changed since run-03, and the collector never judged the stop step, so the change of criterion does not alter what the capture does or records. What is weaker than the original plan: the step limit, which acted as a margin check, is gone; a third series was run; and the analytic bound that replaced it is wrong (W-02). For the capture this matters only as a completion risk, not as an evidence risk. Counting every run on the current bytes, whatever its verdict (run-03 to run-07, warm-01), 18 of 18 tiers completed.

## Rulings on the deviations

| Deviation | Ruling | Why |
|---|---|---|
| Release at `releaseAt(fps)` instead of `STOP_LEAD_M` | accept | Uses only observable inputs and is what made first stops land in the box in 67 of 72 legs on the current bytes. |
| `CROUCH_WITHIN_M` 12 instead of 4 | accept | Ordinary input; no observation depends on the stance of `a`. The movies show more crouched walking. |
| Back-off step when at rest within 1.86 m outside the box | accept, with W-01 and W-02 | Works on the near side (run-07). Wrong direction on the far side and too narrow a window, but both end in a loud failure or a recovery. |
| Fresh-life wait requiring a shared life generation | accept | Same bound, same four assertions; only removes a race (answer 10). |
| Race against the tier deadline | accept, with W-05 | Bounds calls that had no bound; the leftover task is harmless once the contexts close. |
| Strict definition of outside the lane | accept | Stricter than the cell bounds and used only by the control and an additive field. |
| Additive leg fields and helper exports | accept | The capture reads none of them and they serialise cleanly. |

## Other checks

- The frame counter (29-33, 210) only increments a number in an animation-frame callback. The observer (231-242) is the old one, unchanged. Neither touches the DOM, the game or the socket.
- The movie stays one continuous 800x600 recording per page for the whole tier (206-207, 293-297).
- A tier that throws inside its body is caught (283-287): contexts closed, movies recorded, fixture stopped, next tier runs. An error in the teardown or in `startMpFixture` leaves `collectMovingOnline`; the capture then records a collection error, keeps `online.complete` false and closes browser and server (`animation-capture.mjs:1336-1339`), as before this plan.

## Residual risks for the strict capture

1. A lane exit somewhere in the 12 legs is plausible (W-02). The collector tolerates it on legs 2 to 4; the report then shows `outsideLaneSamples` above 0 in a complete tier.
2. A far-side rest on leg 1 fails that tier as `stalled` (W-01). Unlikely: leg 1 stop steps in the records are 1.30 to 2.16 m.
3. The first-seen reload sample can race the rendered frame (W-04). Not seen in 25 tiers.
4. The warm run imitated 35 minutes of offline collection; the capture's offline part is longer and a different sequence. A Vite server stays open during the online tiers in the capture and not in the control.
5. Host load. The control did not read `host_ready`; the capture does.

Judgement: the online part of the single strict capture is likely to complete, roughly nine chances in ten on the evidence of 18 complete tiers out of 18 on these bytes. If it does not, the tier report will name the leg, position and frame rate.

---

_Reviewed: 2026-10-11T01:27:09Z_
_Reviewer: Claude (gsd-code-reviewer), opus, medium_
_Depth: deep_
