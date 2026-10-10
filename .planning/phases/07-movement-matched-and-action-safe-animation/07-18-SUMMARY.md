---
phase: 07-movement-matched-and-action-safe-animation
plan: "18"
subsystem: testing
tags: [animation-budget, paired-timing, calibration, registry, plan09-qualification, gap-closure]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-25 approved paired contract, 07-16 reviewed paired tooling (three hash-pinned files), 07-17 stable gates at identity c1b06272...2c57, owner decisions keep (N-04) and host_ready"
provides:
  - "One calibration session (23e8adde), registered before it ran, valid, passed rules 1 and 2"
  - "Paired registry verdict for identity c1b06272...2c57: passed, session 1 of 1; 0 valid sessions failed; 0 invalid"
  - "evidence/07-18-timing-result.json with the verdict, calibration figures, session 1 and the frozen evaluation list"
  - "Plan 09 qualification record on the paired route (evidence/07-09-qualification.json, complete: true) and 07-09-SUMMARY.md root status complete"
  - "tools/art/stable-gates.mjs: ASSERTION_TITLES, buildPlan09 and the plan09 command, with 11 controls"
affects: [07-19, 07-20, plan09-qualification, ANIM-05]
actuals:
  tokens: 150208
  tasks: 3
  commits: 9
plan_head_before: 7a8645be16b1deeba1661b7f975297fa57eb1b60
plan_head_after: 2f645226c13810471088f9c46aceac86e4a65db3
tech-stack:
  added: []
  patterns: ["register, commit the registry alone, run once, confirm the three report hashes, copy byte for byte, commit", "stop rule applied from the verdict command only", "qualification record built by a pure function and judged by the capture tool's predicate"]
key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-18-paired-calibration.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-18-paired-session-1.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-18-cost-candidate.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-18-timing-result.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-qualification-halted-2026-10-07.json
  modified:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-paired-session-registry.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-qualification.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-09-SUMMARY.md
    - tools/art/stable-gates.mjs
    - tools/art/stable-gates.test.mjs
    - .gitattributes
key-decisions:
  - "The paired verdict was pass after one qualifying session, so the stop rule ended the sessions at 1 of at most 3; no further session was registered"
  - "No frozen exit 0 was observed, so no owner question arose and 07-18-FROZEN-PASS-DECISION.md was not written"
  - "Plan 09 is qualified on the paired route only; applicableBudgetPass stays false as the frozen command reported it"
  - "No requirement is marked complete by this plan; that belongs to phase verification"
requirements-completed: []
requirements-mapped: [ANIM-02, ANIM-03, ANIM-05]
requirements-status: pending
coverage:
  - id: D1
    description: "One calibration of the reference arm against itself, registered and committed before it ran, valid and passed rules 1 and 2 at the final source identity"
    requirement: ANIM-05
    verification:
      - kind: other
        ref: "node tools/art/animation-budget-paired.mjs verify on evidence/07-18-paired-calibration.json (exit 0) and the task 1 registry check (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Qualifying sessions under the cap decided by the majority rule: passed, session 1 of 1; 0 valid sessions failed; 0 invalid"
    requirement: ANIM-05
    verification:
      - kind: other
        ref: "node tools/art/animation-budget-paired.mjs verdict (exit 0, pass) and chain (exit 0); task 2 checks of evidence/07-18-timing-result.json (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plan 09 qualification record built from the registry verdict and accepted by the capture tool's predicate; plan 09 summary complete"
    requirement: ANIM-05
    verification:
      - kind: unit
        ref: "node --test tools/art/stable-gates.test.mjs tools/art/animation-capture.test.mjs (337 pass, 0 fail; 11 controls named plan09)"
        status: pass
      - kind: other
        ref: "node tools/art/stable-gates.mjs check (exit 0, stableGatesPass true, plan09Qualified true)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The original absolute limits of the frozen V2 budget"
    requirement: ANIM-05
    verification:
      - kind: integration
        ref: "evidence/07-18-timing-result.json#frozenApplicableBudgetPass false; frozen command exit 1 on both evaluations at this identity (40 and 21 of 192 over)"
        status: fail
    human_judgment: true
    rationale: "The original limits were not met. Whether the owner-approved paired gate satisfies ANIM-05 is for phase verification and the owner, not for this plan."
  - id: D5
    description: "Human motion and aesthetic acceptance, representative devices and frame rate"
    verification: []
    human_judgment: true
    rationale: "Software-rendered timing on one desktop and an agent's reading are neither; nothing here measures them."
duration: 1h 38m
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 18: Paired Calibration, Qualifying Sessions and Plan 09 Qualification Summary

**passed, session 1 of 1; 0 valid sessions failed; 0 invalid: the calibration was valid and passed, the one qualifying session was valid and passed, the registry verdict is `pass`, and plan 09 is qualified on the paired route only. The original absolute limits were not met (frozen command exit 1 on both evaluations at this identity) and no frozen exit 0 was observed.**

## Performance

- **Duration:** 1h 38m (2026-10-10T20:33:17Z to 2026-10-10T22:11Z; local 22:33 to 00:11)
- **Tasks:** 3 of 3
- **Commits (measured from the ledger up to the last task commit):** 9; the commit carrying this summary follows
- **Files changed:** 11
- **Calibration capture:** 33 min (22:34:34 to 23:07:41 local). **Qualifying session 1 capture:** 33 min (23:10:02 to 23:43:09 local)
- `actuals.tokens` is chars/4 over the whole realized diff (600,831 chars), nearly all of it tool-written evidence JSON; the hand-authored part (tools, `.gitattributes`, `07-09-SUMMARY.md`) is 76,207 chars, about 19,000

## What was run, in order

| Step | Fact |
|---|---|
| Pin | `07-18-FROZEN-PASS-DECISION.md text eol=lf` added to `.gitattributes`, committed alone (`579cae5`) before any registration |
| Pre-checks | `stable-gates.mjs check --only stable` exit 0; `chain` exit 0 (3 smoke events); three pinned tool hashes equal the review record |
| Calibration | registered (`23e8adde9e65a967182bada166dcc98f`, seq 4), registry committed alone (`034c1ab`), run once, closed `valid: true`, `pass: true` (seq 6); three report hashes equal the `closed` event; report copied byte for byte; `verify` exit 0; committed (`d3c1116`) |
| Qualifying session 1 | registered (`a16b4bbfea250ea1013d364dc385651a`, seq 7), registry committed alone (`658c0b0`), run once, closed `valid: true`, `pass: true` (seq 9); three report hashes equal the `closed` event; report copied byte for byte; `verify` exit 0; committed (`d43f4ab`) |
| Verdict | `verdict` command exit 0: `pass`, "passed, session 1 of 1; 0 valid sessions failed; 0 invalid". The stop rule ended the sessions there; sessions 2 and 3 were never registered |
| Timing result | candidate arm of session 1 copied byte for byte to `evidence/07-18-cost-candidate.json`; `frozen-evaluations` scan; `evidence/07-18-timing-result.json` written and committed (`e4223c1`) |
| Plan 09 | failing controls (`d4cb431`), builder and command (`8a99db1`), record written `complete: true`, summary closed, `check` exit 0 (`2f64522`) |

No timing value, ratio or rule result was read before the `closed` event of its session existed; while a session ran, only the count of "pair k of 13 captured" lines and the exit marker were polled, and nothing else was started on the machine.

## Calibration figures (session `23e8adde`, reference arm against a second copy of itself)

No tolerance was changed: `T_single` stays 0.25 and `T_aggregate` 0.05, whatever these figures show. They are the first measurement of adjacent-pair behaviour on this host with no code difference, from one session, and are reported, not used.

- **Rule 1:** 192 comparisons, 0 violations. Largest ratio of the second copy to the first: 2.00 (`selectionMs` median, run 1 Low/1: 0.1 ms against 0.2 ms, one timer step; its bound is 0.225 ms). Largest frame-interval ratio: 1.0180 (p95, run 1 Low/1: 244.7 ms against 249.1 ms). Largest share of its own bound used by any comparison: 0.889. **Comparisons within 10% of their bound: 0.** Comparisons with a zero reference value: 18. (These ratios are derived read-only from the two arm reports; the `verify` output gives only the count and the violations.)
- **Rule 2:** 86 group aggregates pass, 10 are `rule-1-only`, 0 violations. Largest aggregate of any component: 1.0145 (Low tier, frame interval p95) against the limit 1.05.
- **Validity checks, largest values against 1.25:** gross instability 1.0341, ratio agreement 1.0142.
- **Arm difference as recorded:** `comparedFiles` 137, `differingFiles` [] at materialisation and after the last pair (expected count 0).

Frame interval, the six group aggregates with the cell ratios behind them:

| Group | Median aggregate | Cells (median) | p95 aggregate | Cells (p95) |
|---|---|---|---|---|
| all | 0.9999 | 1.0062, 0.9982, 0.9990, 0.9999, 0.9976, 1.0013 | 0.9970 | 1.0145, 0.9967, 1.0002, 0.9847, 0.9970, 0.9950 |
| one actor | 0.9990 | Low 1.0062, Medium 0.9990, High 0.9976 | 1.0002 | 1.0145, 1.0002, 0.9970 |
| eight actors | 0.9999 | Low 0.9982, Medium 0.9999, High 1.0013 | 0.9950 | 0.9967, 0.9847, 0.9950 |
| Low tier | 1.0062 | 1.0062, 0.9982 | 1.0145 | 1.0145, 0.9967 |
| Medium tier | 0.9999 | 0.9990, 0.9999 | 1.0002 | 1.0002, 0.9847 |
| High tier | 1.0013 | 0.9976, 1.0013 | 0.9970 | 0.9970, 0.9950 |

The two profile ratios of each cell (plain `c/r`; the first-captured arm is named), which show the size of any second-capture slowdown. Reported, never subtracted:

| Cell | Statistic | Run 1 | Run 2 | Cell ratio |
|---|---|---|---|---|
| Low/1 | median | reference first, 1.0137 | candidate first, 0.9996 | 1.0062 |
| Low/1 | p95 | reference first, 1.0180 | candidate first, 1.0118 | 1.0145 |
| Low/8 | median | candidate first, 0.9953 | reference first, 1.0017 | 0.9982 |
| Low/8 | p95 | candidate first, 0.9882 | reference first, 1.0058 | 0.9967 |
| Medium/1 | median | candidate first, 0.9980 | reference first, 1.0008 | 0.9990 |
| Medium/1 | p95 | candidate first, 0.9917 | reference first, 1.0094 | 1.0002 |
| Medium/8 | median | reference first, 0.9995 | candidate first, 1.0007 | 0.9999 |
| Medium/8 | p95 | reference first, 0.9776 | candidate first, 0.9923 | 0.9847 |
| High/1 | median | reference first, 1.0016 | candidate first, 0.9943 | 0.9976 |
| High/1 | p95 | reference first, 0.9977 | candidate first, 0.9970 | 0.9970 |
| High/8 | median | candidate first, 1.0012 | reference first, 1.0019 | 1.0013 |
| High/8 | p95 | candidate first, 0.9957 | reference first, 0.9948 | 0.9950 |

In this one session the frame-interval profile ratios lay between 0.9776 and 1.0180. What that bears on, for the owner: even in the cell form a tier group's aggregate is the larger of two cell ratios, and the contract review's simulation gives about 23% of no-change sessions failing per statistic at about 4% adjacent-pair noise and about 0.2% at 2%. One session does not establish the noise level.

Host facts recorded by the tool for the calibration: power plan Balanced before and after; sampled busy fraction 0.037 before and 0.028 after; about 21 GB free memory; largest processes by working set `claude.exe`, Memory Compression, `svchost.exe`, `steamwebhelper.exe`, `Discord.exe`. Browser 147.0.7727.15.

## Qualifying sessions

| Session | Nonce | Registered at | As closed | As `verify` recomputes | Frozen command on its candidate arm |
|---|---|---|---|---|---|
| 1 of 1 | `a16b4bbfea250ea1013d364dc385651a` | `658c0b0` | valid true, pass true | valid true, pairedBudgetPass true, structuralV2Pass true, exit 0 | exit 1, 21 of 192 over (`frozenFieldsMatchClosed: true`) |

Session 1 figures: rule 1, 192 comparisons, 0 violations, largest candidate-to-reference ratio 1.1429 (`renderMs` median, run 1 Low/1: 0.7 ms against 0.8 ms), largest share of a bound used 0.821, 0 comparisons within 10% of their bound. Rule 2, 86 aggregates pass, 10 `rule-1-only`, 0 violations, largest aggregate 0.9986 (Low tier, frame interval p95). Frame interval median aggregates: all 0.9970, one actor 0.9981, eight actors 0.9863, Low 0.9981, Medium 0.9970, High 0.9984. Validity largest values: gross instability 1.0099, ratio agreement 1.0085. Host: Balanced plan, busy fraction 0.018 before and 0.026 after.

`verdict` output (abridged to its deciding fields): `verdict: pass`, `passed: 1`, `failed: 0`, `invalid: 0`, `started: 1`, `cap: 3`, `decidingSession: 1`, `identitiesTried: 1`, registry SHA-256 `d81f5b13dbc4f89e1008265fbeca81c10e5770a642b5a34f9eb21bb9543be4b6`, 9 events, chain valid, every event committed, every committed version a prefix. Registration commits: smoke `e17f125`, calibration `034c1ab`, qualifying `658c0b0`; none amended, squashed or rebased.

## Frozen evaluations at this source identity

| Evaluation | Report | Captured | Exit | Over | Note |
|---|---|---|---|---|---|
| 1 of 2 | `evidence/07-13-cost-candidate.json` (`5803ffe0...94b5`) | 2026-10-10T07:22:59Z | 1 | 40 of 192 | plan 07-13; `sameIdentity: true`; found by the scan |
| 2 of 2 | `evidence/07-18-cost-candidate.json` (`339857fe...9424`) | 2026-10-10T21:43:05Z | 1 | 21 of 192 | candidate arm of qualifying session 1 |

`frozenExitZeroObserved: false`. Built by the `frozen-evaluations` scan (13 complete reports scanned, 2 at this identity) and numbered as the predicate numbers them. Frozen failures on earlier source (135 over on 2026-10-07, a structural failure on 2026-10-09) are not in this list and stay recorded where they are. The calibration added no frozen evaluation.

## What the result means, in the contract's words

A paired pass means that "in one software-rendered session on this host, in the offline Training Range workload, the five owner files as they are now did not cost more than the same five files at the freeze, within 5% typically and 25% in any single profile for the frame interval, and within about one timer tick for the small script components; and every structural check of the frozen gate still passed." It is made for the sessions the verdict counts and carries its denominator: passed, session 1 of 1; 0 valid sessions failed; 0 invalid.

It does not mean (section 10, in short; the full list is in `evidence/07-18-timing-result.json#meaning` and in `07-09-SUMMARY.md`): that the original fixed limits were met (they were not); any frame-rate, representative-device or human motion or quality acceptance; that Phase 7 as a whole added no cost (cost present at the freeze, the first-person view included, is in both arms and cancels); anything about files outside the five owner files; anything about online play or another workload; that the owner files are as fast as they have been; that sub-millisecond components did not regress by less than one timer step plus tolerance; that zero limits still hold exactly; anything about a real GPU or another host; that an earlier failed report became a pass or that a smoke or calibration is a qualification.

## Plan 09 qualification

- `evidence/07-09-qualification.json` (SHA-256 `13e0e6e5ea168eff7dc13b8b43d4525dcbb302cd3e9875fa950447230fa8244a`): `complete: true`, `timingGate: paired-same-session`, `applicableBudgetPass: false`, candidate `evidence/07-18-cost-candidate.json`, both assertions `executed: true`, `status: pass`, `exitCode: 0` from the offline gate log of plan 07-17 (`a2e9eb31...05a5`).
- `evidence/07-09-qualification-halted-2026-10-07.json` is the previous record byte for byte (`564799e5...2c304`).
- `07-09-SUMMARY.md`: root `status: complete`, `completed: 2026-10-11`; D2 pass (kept as human judgment because the offline gate passed on the second of two runs); D3 stays `fail` with ref `evidence/07-18-timing-result.json#frozenApplicableBudgetPass false (original absolute limits, not met)`; D5 added for the paired gate; D4 unchanged; one dated section appended; every earlier section kept.
- `node tools/art/stable-gates.mjs check`: exit 0, `{"stableGatesPass":true,"stableGateBlocker":null,"plan09Qualified":true,"plan09Blocker":null,"identitySha256":"c1b062729e765c0086c4c9c283170cf2da3e65044ff4eeacd66937899cbc2c57","recordIdentitiesCurrent":true}`.

## Limits of this evidence

- **J-01.** Reports invented from scratch are indistinguishable from captured ones: a calibration and a qualifying session made with the real runner and a capture function that returns historical samples verify and are accepted. No tool can tell. Git history (registration committed before each run, commits `034c1ab`, `658c0b0`) and the owner are the only evidence that these sessions were captured.
- **N-04, identity width.** The source identity `c1b06272...2c57` is the hash of the set `animationIdentities()` records. The two weapon FBX files, the installed packages and the Vite configuration are outside it, so a change to those would not invalidate this result. The owner decided before the calibration to keep it so (`07-18-IDENTITY-WIDTH-DECISION.md`, `decision: keep`, `decided_by: owner`).
- **I-06.** The restated calibration and scope checks in the plan 09 predicate are unreachable behind the verdict; they add nothing to what the verdict already refuses.
- **I-11.** In the first pair of each run one page is alive for the first arm and two for the second. The calibration measured under the same condition; it is not corrected for.
- **`armDifference` as recorded in the session reports.** Calibration: `comparedFiles` 137, `differingFiles` [] (expected count 0), at materialisation and after the last pair. Qualifying session 1: `comparedFiles` 137, `differingFiles` [`src/builders/characterResources.js`, `src/builders/enemyAnimations.js`, `src/builders/enemyGLTF.js`, `src/builders/firstPersonRig.js`, `src/builders/weaponHandling.js`] (expected count 5), at materialisation and after the last pair. These are records of the runner's checks; `verify` does not recount them.
- One calibration and one qualifying session. The verdict rule allows a pass on one valid pass; it is still one session, software-rendered, on one desktop under the Balanced power plan with a chat client and a game launcher helper running. Not device or frame-rate certification, and no human acceptance.
- The offline gate the two assertions come from passed on the second of two full runs (plan 07-17).
- The frozen route was exercised only by synthetic controls; no real frozen exit 0 exists.

**Every session directory is kept** under `.planning/research/.cache/06-art/animation-paired/` (`session-23e8adde...`, `session-a16b4bbf...`, with both arm reports and the frame images). **No hashed source file may change until plan 07-19's capture has run:** the plan 09 check re-verifies the calibration and the session from those directories against the current tree every time, and a verification that cannot be reproduced refuses the paired route.

## Task Commits

1. **Task 07-18-01 (calibration):** `579cae5` (pin), `034c1ab` (registration alone), `d3c1116` (registry and report)
2. **Task 07-18-02 (qualifying sessions):** `658c0b0` (registration alone), `d43f4ab` (registry and report), `e4223c1` (timing result and candidate copy)
3. **Task 07-18-03 (plan 09 record):** `d4cb431` (test, RED), `8a99db1` (feat, GREEN), `2f64522` (record, archive, summary close)

## TDD record (task 3)

- RED (`d4cb431`): 11 new `plan09` controls failed, each with `ERR_ASSERTION`; the 14 controls of plan 07-17 passed. The classifier refused the full-file TAP report as malformed ("Non-TAP data in report"), so the target control was rerun alone with the same reporter and that record gave `RED_EVIDENCE_OK` (`target_test_failed`). Both reports are kept unedited under `.planning/research/.cache/07-18-red/`. Semantic reading: the target failed on its planned assertion (`buildPlan09` not exported), no load or fixture fault.
- GREEN (`8a99db1`): 25 of 25 pass. Two controls were tightened in this commit after mutation runs on copies showed two surviving mutants (a case with a second failed result; the numbering message of the frozen list). After that, 28 of 28 mutations on copies under `.planning/research/.cache/07-18-red/mutants/` are caught. The working files were only read by those runs.
- No REFACTOR commit.

## Deviations from Plan

1. **[Interpretation] Precondition wording.** "`07-21-SOURCE-EXCEPTION-REVIEW.md` likewise" was read as "exists with a passing status" (it is `pass-with-notes`), in line with "the four review records" of `read_first`. `git check-attr eol` is `unspecified` for that file; nothing binds its hash.
2. **[Rule 1] Stale rationale lines in `07-09-SUMMARY.md`.** The plan changes D2 and D3 status and ref only. Their rationale lines described the 2026-10-07 state and would have contradicted the new refs, so both were rewritten to state the current facts. `human_judgment` stays `true` on both.
3. **[Rule 2] `buildPlan09` takes an optional sixth argument.** `facts` carries what only the command line can see (`problems`, the timing result's path and hash, the owner decision record). The five-argument form of the plan works for the paired route. The command also requires the supplied offline report to hash to the `offline.reportSha256` of the stable gate record, the registry to be whole against git, and the registry and candidate bytes to equal the hashes in the timing result.
4. **[Addition] Dry run before the status change.** Before editing the summary status, the real predicate was called from a throwaway script with three arguments and a synthetic complete summary string; it accepted the record. Read-only.
5. **[Addition] Calibration ratios.** The largest rule-1 ratio, the count within 10% of a bound and the per-profile ratios are not in the `verify` output; they were derived read-only from the arm reports by a script outside the repository.
6. **[Plan over template] `requirements-completed` is empty.** The plan says to mark no requirement complete; `requirements.mark-complete` was not run.
7. **[Addition] Extra fields in the timing result** beyond the plan's list (identity width note, contract numbers, scan facts, per-session rule 1 and tolerances). Additive only.

**Total:** no change to any of the three pinned tool files, to `src/`, `server/`, `tests/` or `public/`.

## Not verified

- A real GPU, a representative device, a frame rate, human motion or aesthetic acceptance.
- The frozen route on real data.
- The byte-for-byte frozen-source capture on today's host (available, not run).
- `evidence/07-motion-review.json` still says `plan09Qualified: false`; it is a historical capture record outside this plan's files and is rewritten by plan 07-19's capture.
- `tools/art/stable-gates.mjs` as changed here has had no independent review; the plan directs none. The record it wrote is judged by the reviewed predicate in `check`.

## Issues Encountered

None in the sessions. One tooling note: `uat classify-coverage` reads the flow-style `verification` entries of `07-09-SUMMARY.md` as `validation_failed` (row D1 too, which this plan did not touch), so those rows route to a human. The file's existing format was kept.

## Known Stubs

None.

## Open for the orchestrator and owner

- `AGENTS.md` still says "Nothing has qualified yet: the registry holds only the smoke session." That line is now out of date; this plan's diff does not include `AGENTS.md`.
- G-01 (CI step `npm run test:art` on a fresh checkout) is still open; no plan in this set fixes it.

## Next Phase Readiness

Plan 07-19 can run: `check` exits 0 with both flags true. It needs the paired session directories in the cache and an unchanged source identity. ANIM-05 stays unmarked.

## Self-Check: PASSED

Verified after the last task commit: the five created evidence files exist and hash to the values above; commits `579cae5`, `034c1ab`, `d3c1116`, `658c0b0`, `d43f4ab`, `e4223c1`, `d4cb431`, `8a99db1`, `2f64522` are ancestors of HEAD; `npm run test:art` 636 pass, 0 fail; `frozen-bytes.mjs verify` 26 verified, 0 mismatched; `chain` exit 0; the three pinned tool hashes are `584bd4ca...9b4e`, `fad42d2e...8265`, `20884fee...bd32`; the four golden evidence hashes are unchanged; `git status --short -- src server tests public tools` is empty.
