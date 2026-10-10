---
phase: 07-movement-matched-and-action-safe-animation
plan: "16"
subsystem: testing
tags: [animation-budget, paired-timing, registry, plan09-qualification, review]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-25 approved paired contract (07-09-PAIRED-AMENDMENT-V2.md) and its review"
provides:
  - "tools/art/animation-budget-paired.mjs: pinned contract, rules 1 and 2, validity, binding, append-only hash-chained registry, session runner, verify/verdict/chain/frozen-evaluations commands"
  - "tools/art/review.mjs --animation-paired (--smoke, --calibration, qualifying; --register then --run <nonce>)"
  - "tools/art/animation-capture.mjs requirePlan09: paired route and tightened frozen route"
  - "evidence/07-paired-session-registry.json holding only the smoke session (registered, started, closed)"
  - "07-16-PAIRED-IMPLEMENTATION-REVIEW.md, opus/high, pass-with-notes at 7c93fb3"
affects: [07-17, 07-18, 07-19, plan09-qualification, ANIM-05]
actuals:
  tokens: 0
  tasks: 4
  commits: 26
plan_head_before: 03ca15177c87a21fa0328eb084ae90b59191d640
plan_head_after: 943440230aff4ab18737ef270453f3c7f6fe6c25
tech-stack:
  added: []
  patterns: ["append-only hash-chained session registry committed before a capture", "validity fixed before timing is evaluated", "injectable readers through a fourth argument only, production call sites pass three"]
key-files:
  created:
    - tools/art/animation-budget-paired.mjs
    - tools/art/animation-budget-paired.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-paired-session-registry.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-16-paired-smoke.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-16-PAIRED-IMPLEMENTATION-REVIEW.md
  modified:
    - tools/art/review.mjs
    - tools/art/animation-capture.mjs
    - tools/art/animation-capture.test.mjs
    - .gitattributes
key-decisions:
  - "The frozen route of requirePlan09 is tightened: a frozen-route record needs the frozen evaluation list and the owner's recorded accept-frozen-pass bound to evaluation k of n"
  - "The paired route verifies the calibration and every closed qualifying session of the current identity from their reports before the verdict is relied on (review blocker I-01)"
  - "Calibration and qualifying sessions are refused on a host that is not the frozen device (I-02)"
requirements-completed: []
coverage:
  - id: D1
    description: "Paired predicate, validity, binding, registry and session runner implemented as pure tested code"
    requirement: ANIM-05
    verification:
      - kind: unit
        ref: "node --test tools/art/animation-budget-paired.test.mjs (part of npm run test:art, 611 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Plan 09 qualification accepts a paired verdict under the pinned contract, or the tightened frozen route with the owner's decision, and nothing weaker"
    requirement: ANIM-05
    verification:
      - kind: unit
        ref: "node --test tools/art/animation-capture.test.mjs (part of npm run test:art, 611 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mixed tree (five owners at c973458, everything else at the candidate) loads and samples; one smoke pair, not a timing judgement"
    requirement: ANIM-05
    verification:
      - kind: other
        ref: "evidence/07-16-paired-smoke.json (complete false, kind smoke, referencePageErrors 0) and node tools/art/animation-budget-paired.mjs chain"
        status: pass
    human_judgment: false
  - id: D4
    description: "ANIM-05 measured budget is met"
    requirement: ANIM-05
    verification: []
    human_judgment: true
    rationale: "No calibration or qualifying session has run; plan 07-18 owns them and the owner owns any frozen-route judgement"
duration: "about 3h 15m of recorded commit time (first commit 2026-10-10T15:12:53+02:00)"
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 16: Paired Timing Gate Implementation Summary

**The mixed tree ran (one registered smoke pair, three registry events, not a pass) and the independent implementation review is pass-with-notes at 7c93fb3, after a first review found one blocker (I-01) that was fixed and re-reviewed. The approved paired contract is implemented as tested code, plan 09 can be qualified by a registry verdict or by the tightened frozen route only, and no calibration or qualifying session has run.**

## Performance

- **Duration:** about 3h 15m between the first plan commit and this close (first commit 326b8b3 at 2026-10-10T15:12:53+02:00; the executors of earlier segments did not record start epochs)
- **Completed:** 2026-10-10
- **Tasks:** 4 (all committed; independent review passed on the repeat)
- **Files modified:** 9 tracked files named in the plan (tools, tests, `.gitattributes`, registry, smoke report, review record)
- **Plan commits (measured):** 26 in `03ca151..9434402`, ledger base `plan_head_before` above; this includes the two pre-task-4 commits for the CR-01/CR-03 re-review, the first review record and the repeat review record

## Accomplishments

- Contract, predicate and registry in `tools/art/animation-budget-paired.mjs`: pinned contract identity (three SHA-256 values compared with the files at every run), rule 1 (per profile, component, statistic), rule 2 in the cell form over six groups (`sorted[floor(n/2)]`, groups with fewer than 3 usable profiles reported as rule-1-only), validity computed and written before any rule is evaluated, binding of arm reports to the nonce and to interleaved capture times, the five pinned reference owner identities, append-only hash-chained registry with a history prefix check, cap of three qualifying sessions, majority verdict with its denominator, and the `verify`, `verdict`, `chain` and `frozen-evaluations` commands.
- Capture modes in `tools/art/review.mjs`: `--animation-paired` with `--smoke`, `--calibration` or qualifying, each in two steps (`--register`, then `--run <nonce>` only when the registration is committed and the nonce has no `started` or `closed` event); the sampler is reused unchanged and its identity (`2720e51e...ab83f`) is asserted equal in both arms.
- Plan 09 wiring in `tools/art/animation-capture.mjs`: `requirePlan09` has two routes selected by the record's `timingGate`; the paired route and the tightened frozen route are described below.
- The smoke pair proved the mixed tree loads and samples with no page error. It wrote load and structure facts only, no timing value and no comparison.
- Independent review (opus, high) written and, after one blocker, repeated on the fixed bytes: `pass-with-notes`.

## Review history in plain words

1. The first independent review (record committed unedited as `04af7c6`, reviewed commit `fb8972f`) had status blocker. Finding I-01: the plan 09 predicate and `executeV2` trusted the `valid` and `pass` flags of the registry's closed events. A registry written by hand with a valid chain could name any report, an existing single-arm candidate included, as a qualifying arm, and a pass verdict would follow.
2. The fix is commits `929c2d8` (failing controls), `e272c07` (the fix), followed by the fixes of I-02 (`a214357`, `bad8d19`), I-05 (`90bda51`, `5922878`) and the controls for I-03 and I-04 (`7c93fb3`). The paired route now puts the calibration and every closed qualifying session of the current source identity through the tool's own `verify` command, from their reports, and compares the result with the registry's `closed` event; `executeV2` does the same before it relies on a pass verdict.
3. The repeat review (committed as `9434402`, reviewed commit `7c93fb316efe8245d7166f01911ea5eae6d9f3e7`) closed I-01 to I-05 and I-12, and left only INFO findings (J-01 to J-04 and the carried I-06 to I-11 and I-13). Status `pass-with-notes`; it asks for no change to the three tool files.

Pinned tool hashes at `7c93fb3` (equal to the `reviewed_*_sha256` scalars of the review record; any change to one of these files needs the review repeated on the new bytes):

| File | SHA-256 |
|---|---|
| `tools/art/animation-budget-paired.mjs` | `584bd4ca774b31365e50ef00ef6c49612109936afc732a81babae0f84fbf9b4e` |
| `tools/art/review.mjs` | `fad42d2e490debc5de47c8405ba17dddf4546f31e22697bbd1eb7a2f4fc68265` |
| `tools/art/animation-capture.mjs` | `20884feee9f1e121198fd3d32e6aec18640dfb46dc248218d1b9f5f4cd78bd32` |

## Frozen route tightened (not unchanged behaviour)

This plan tightened the frozen route of `requirePlan09`. A frozen-route record (`timingGate` absent or `frozen-v2`) used to need `applicableBudgetPass: true` and the two executed assertions. It now also needs the list of frozen evaluations (equal to what the scan, the registry and the plan 07-13 evidence show, numbered evaluation k of n, one scanned exit 0 put forward) and `frozenDecision`, the path and SHA-256 of an owner decision record whose `decision:` is `accept-frozen-pass` with `decided_by: owner`, bound to that evaluation. Why: the original frozen contract allowed one evaluation and one has already failed (plan 07-13: 40 of 192 over), so a later frozen exit 0 is the owner's to judge and no tool may produce that acceptance.

What changed in the existing tests: the shared fixture `good()` in `tools/art/animation-capture.test.mjs` gained `frozenEvaluations` and `frozenDecision`; the two existing positive controls (`capture accepts only current complete09 with both executed browser qualifications` and `canonical complete frontmatter permits nested historical status and irrelevant body`) pass synthetic readers as the fourth argument. Every existing rejection control is unchanged and still rejects for its own reason, because the new frozen-route requirements are evaluated last. The tightening has its own controls (titles contain "tightened" or "owner decision"). The repeat review confirms the review-fix commits changed seven further existing test lines in the fixtures and reader lists (not any rejection control).

No recorded result changed: plan 09 was not qualified. `evidence/07-09-qualification.json` still has `complete: false`, `07-09-SUMMARY.md` is still `status: halted` and `evidence/07-motion-review.json` still has `plan09Qualified: false`.

## Residual window of a qualifying session

For a qualifying session the unchanged frozen command must read the candidate arm report from disk before validity can be final, so for a few seconds that one file exists and the `closed` event does not. It holds one arm's absolute timings and nothing a paired ratio can be formed from: no reference arm report, session report, ratio or rule result, and nothing is printed or logged. The implementation review confirms the window holds only that file (runner order, question 8; verified in memory with the real runner, not in a real capture). A calibration and a smoke have no such window.

## What a paired pass covers

In the contract's own words (`07-09-PAIRED-AMENDMENT-V2.md` section 10, "in the review's words"): a paired pass means that "in one software-rendered session on this host, in the offline Training Range workload, the five owner files as they are now did not cost more than the same five files at the freeze, within 5% typically and 25% in any single profile for the frame interval, and within about one timer tick for the small script components; and every structural check of the frozen gate still passed." Under section 8 the statement is made for the sessions the verdict counts and always carries its denominator. It does not mean the original fixed limits were met, any frame-rate, representative-device or human motion/quality acceptance, anything about Phase 7 as a whole, files outside the five owners (including the first-person view cost, which is in both arms), online play, a real GPU or another host. A smoke or a calibration session is not a qualification. The smoke pair run in task 1 is not a pass and is not a timing judgement.

## Measurement available, not run

The review's finding that the exact frozen source can be rebuilt byte for byte and captured on today's host is an available measurement. It was not run in this plan.

## Task Commits

1. **Task 1 (tracer): the mixed tree runs, one registered smoke pair** - `326b8b3` (chore, `.gitattributes` pins), `1eefe36` (failing controls), `4c544c8` (feat), `e17f125` (registration of smoke session 76123eb3), `88a7824` (smoke record)
2. **Task 2: approved predicate, validity, binding, verify** - `f528a50` (controls first), `157cc81` (feat)
3. **Task 3: registry integrity and session runner** - `4b3a1d2` (controls), `fa99c56` (feat), `b8363f0` (control for context and page lifetime), `8dc183f` (calibration and qualifying modes)
4. **Pre-task-4 re-review of CR-01, CR-03, CR-04, CR-05, WR-01** - `92c4491` (review), `7277a3a` (disposition)
5. **Task 4: paired verdict qualifies plan 09 under the pinned contract** - `837d26d`, `2438892`, `a05d7fc`, `fb8972f`
6. **First implementation review (blocker I-01)** - `04af7c6` (reviewed commit `fb8972f`)
7. **Review-fix commits** - `929c2d8`, `e272c07`, `a214357`, `bad8d19`, `90bda51`, `5922878`, `7c93fb3`
8. **Repeat review record (pass-with-notes, reviewed `7c93fb3`)** - `9434402`

**Plan metadata:** the commit that adds this file.

## .gitattributes

Commit `326b8b3` added the seven session evidence lines (`07-16-paired-smoke.json`, `07-18-paired-calibration.json`, `07-18-paired-session-1.json`, `-2.json`, `-3.json`, `07-18-cost-candidate.json`, `07-18-timing-result.json`) and the two optional lines recommended by the contract review (O-1) for `07-09-PAIRED-AMENDMENT.md` and `07-09-PAIRED-AMENDMENT-REVIEW.md`, alone and before any registration. The four lines from `8eba2e1` were not added again.

## Pinned contract hashes (computed from the files on disk and in `PAIRED_CONTRACT`)

| Document | SHA-256 |
|---|---|
| `07-09-PAIRED-AMENDMENT-V2.md` (`v2Sha256`) | `8f3f6c72835ad7a37122dfa58109b25119ab14a1b7c71e91c45e28c927fd1aa3` |
| `07-09-PAIRED-AMENDMENT-DECISION.md` (`decisionSha256`) | `c1af5d9bf5e904dcf6c40506dbcaee781ddc4deca31412e6548bdd4176387f69` |
| `07-09-PAIRED-AMENDMENT-V2-REVIEW.md` (`v2ReviewSha256`) | `f61edef1eeeaf35d6ff07226592151a79b7f506a2d77cb7fbe010d8c5afd6689` |

Registry `evidence/07-paired-session-registry.json`: `073f424d6c4a52b2ab09558db4b885608d182dfc9a9c418c97efd5d668dccb14`, three events (smoke registered, started, closed), `chain` command reports it valid, every event committed, every committed version a prefix. Smoke report `evidence/07-16-paired-smoke.json`: `d56539ab8b12d42e6ae6ffd95268dc4f7c84f9124593ef7ec8624cafa70bbc7f`.

## Deviations from Plan

Segments A and B (tasks 1 to 3) recorded no deviations that I could find in the commit messages or evidence; this close-out did not re-derive them. Segments C (task 4) and D (review fixes) are taken from the independent review's "declared deviations", which are stated there and in commit messages; I did not have the executors' own reports.

### Segment C (task 4), declared and judged acceptable by the review

1. **Frozen command run again inside the paired route:** correct, section 9 asks for it ("again wherever the paired result is relied on").
2. **Owner decision bound to evaluation k of n:** stricter than the plan; a later evaluation changes n and the decision no longer applies.
3. **`putForward: true`:** exactly one, and it must be a scanned exit 0.
4. **Exports `actualV2Outcome` and `PLAN09_DISK_READERS`:** the readers object is frozen and is the pinned default of the fourth parameter.
5. **Restated calibration and scope checks in `requirePlan09`:** harmless; the review finds them unreachable behind the verdict (I-06). They can be removed with no control failing.
6. **One control adjusted after RED:** in `fb8972f` the case `the mapping is indented` was replaced by the stricter form of the re-review's row C5, with five controls added; the test file did not change between the RED commit and the implementation commit.

### Segment D (review fixes)

7. **Verifying only the sessions of the current source identity** (not sessions of earlier identities): sufficient per the repeat review, because sessions of earlier identities are listed and never counted, and their reports must still be present.
8. **Seven existing test lines changed** by the fix (session fixture now writes both arm reports and names them; the list of readers the paired route may consult gains `verifySession` and the arm paths; the positive helper of `actualV2Outcome` supplies a verification effect; the default reader key list gains `verifySession`; the count of places naming the default readers goes from 2 to 3, the third pinned to `executeV2`). The review finds no rejection control weakened.
9. **Two segment-D additions beyond the first review's table:** the host-is-the-frozen-device refusal (I-02, `assertHostDevice`) adds one short browser launch at registration time to read the browser version.

**Total:** no auto-fix rule deviations beyond the above; the above are design-level and were all judged by the independent review.

## Verification run at close-out (HEAD 9434402, source unchanged since 7c93fb3)

| Check | Result |
|---|---|
| `node --test tools/art/animation-capture.test.mjs tools/art/animation-budget-v2.test.mjs tools/art/animation-budget-paired.test.mjs` | 487 pass, 0 fail |
| `npm run test:art` | 611 pass, 0 fail |
| review record check (status, opus, high, three reviewed hashes equal to the files on disk) | exit 0 |
| `node tools/art/frozen-bytes.mjs verify` | 26 verified, 0 mismatched |
| `node tools/art/animation-budget-paired.mjs chain --registry ...` | valid, 3 events, all committed |
| `git status --short -- src tools/art/animation-budget-v2.mjs` | empty |

## Carried to plan 07-18

- Keep every session directory under `.planning/research/.cache/06-art/animation-paired/` (both arm reports and the frame images) and change no hashed source file until plan 10's capture has run (review J-03, I-13). A verification that cannot be reproduced refuses the paired route.
- Copy the calibration session report to `evidence/07-18-paired-calibration.json` and every closed qualifying session report to `evidence/`, byte for byte, under its closed-event hash.
- After each run, before committing the registry, confirm that the session report and both arm reports exist with the hashes of the `closed` event (J-02: a run that dies between `closed` and the three writes leaves a closed session without reports and refuses the route, fail-closed).
- Copy the candidate arm of a passed session to `evidence/` and name that copy as `candidate`.
- Build the paired block from the `verdict` command's output, `registrationCommits` and `allQualifying` included (I-08).
- Number the frozen evaluation list as the predicate does, plan 07-13 evaluation included (I-09).
- On the frozen route, write the owner decision record in the plain form (I-07): no quoted root scalar (a quoted `plan: "18"` makes every key read as absent), no flow list, no zero-indented sequence, no byte order mark; it needs `decision`, `decided_by`, `evaluation` and `evaluations`.
- State in the 07-18 summary J-01: reports invented wholesale are indistinguishable from captured ones (a calibration and a qualifying session made with the real runner and a capture function returning historical samples verify and are accepted; the contract review's limit N-5). Git history and the owner are what show it.
- State the identity-width limit N-04 in every summary that names the source identity.
- The host check at registration launches a headless browser once (to read the browser version); it prints and writes nothing.

## Open for the owner

- **N-04 identity width** must be decided before the calibration is registered. Widening the identity set edits `animationIdentities` in `tools/art/review.mjs`: that changes the identity hash (a new calibration and a new count of three), changes a tool hash (the old calibration then covers nothing and the review must be repeated) and makes the stable-gate record stale. A widening after a failed calibration would work as a second try. If the set stays as it is, the limit is stated in the code and belongs in every summary that names the identity.
- **G-01** (07-13 review finding): the CI step running `npm run test:art` cannot pass on a fresh checkout (three controls in `tools/art/animation-budget-v2.test.mjs` need the gitignored cache). Fix it before any push; no plan in this set does. (`npm run test:art` passes here, 611, because the cache exists on this machine.)

## Not verified

- No calibration or qualifying session has run; the registry holds only the smoke session. Paired acceptance (both routes) is shown only with synthetic and in-memory inputs.
- The mixed-tree smoke pair ran once in task 1 (three registry events). It is a load-and-structure fact for one profile, not a timing result and not a pass. Whether a sample of the mixed tree in the tiers and actor counts the smoke did not capture satisfies `qualify` is unknown.
- The calibration and qualifying modes of `review.mjs` (browser, listeners, file writes), the registration-time browser launch that reads the browser version, and the default `verify` reader on a real session have never been executed; the review read them and exercised the underlying functions in memory.
- Linux or another host; any real GPU or representative device; human aesthetic acceptance (no agent can record it).
- The byte-for-byte frozen-source capture (the available measurement above) was not run.

## Issues Encountered

None beyond the review blocker I-01 and its fix, described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 07-17 and 07-18 once the owner decides N-04. The paired route cannot qualify plan 09 until plan 07-18 has run a valid calibration and the qualifying sessions on a prepared host. ANIM-05 stays open.

## Self-Check: PASSED

Verified at close-out: the commit hashes named in this summary exist (`git log 03ca151..HEAD`), the three tool hashes equal the review record and the files on disk, and `npm run test:art`, the three-file test run and `frozen-bytes.mjs verify` pass as recorded above.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-10*
