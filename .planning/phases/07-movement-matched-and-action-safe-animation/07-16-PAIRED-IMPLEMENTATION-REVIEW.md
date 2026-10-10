---
status: pass-with-notes
reviewer_model: opus
reviewer_effort: high
reviewed_commit: 7c93fb316efe8245d7166f01911ea5eae6d9f3e7
reviewed_paired_sha256: 584bd4ca774b31365e50ef00ef6c49612109936afc732a81babae0f84fbf9b4e
reviewed_review_sha256: fad42d2e490debc5de47c8405ba17dddf4546f31e22697bbd1eb7a2f4fc68265
reviewed_capture_sha256: 20884feee9f1e121198fd3d32e6aec18640dfb46dc248218d1b9f5f4cd78bd32
---

# Plan 07-16: independent review of the paired timing implementation (repeat on the fixed bytes)

Reviewed 2026-10-10 at commit `7c93fb316efe8245d7166f01911ea5eae6d9f3e7`, by a reviewer that wrote
none of this code. The three hashes above were computed from the files on disk and equal the
expected values. Contract: `07-09-PAIRED-AMENDMENT-V2.md` (`8f3f6c72...1aa3`, equal to the pin).

History: this record replaces the first review of these files, which had the blocker status for
finding I-01 (committed unedited as `04af7c6`, reviewed commit `fb8972f`). The fixes are commits
`929c2d8`, `e272c07`, `a214357`, `bad8d19`, `90bda51`, `5922878` and `7c93fb3`. I read
`git diff fb8972f..7c93fb3` in full and repeated my own probes on the new bytes.

## Verdict

The blocker is closed. The plan 09 check now puts the calibration and every closed qualifying
session of the current source identity through the tool's own `verify` command and compares the
result with the registry's `closed` event, and `executeV2` does the same before it relies on a pass
verdict. I repeated the hand-written-registry case of the first review and eight stronger ones:
every one that names a report the session did not produce, or whose closed event disagrees with
what the reports recompute to, is refused by `requirePlan09`, by the function `executeV2` calls
and by `actualV2Outcome`. What remains is the limit the contract already states: reports invented
wholesale are not distinguishable from captured ones. The other four findings that asked for a
change are fixed or controlled, nothing that passed before was weakened, and the notes left are for
plan 07-18 to act on.

## Findings

| Id | Severity | File and line | Finding | Required change |
|---|---|---|---|---|
| J-01 | INFO | `tools/art/animation-capture.mjs:422-445`; `tools/art/animation-budget-paired.mjs:1088-1150` | Stated residual. The verification recomputes everything from the reports; it cannot know whether a capture produced them. A calibration and a qualifying session made with the real runner and a capture function that returns historical samples (the plan 07-13 samples in both arms, relabelled) verify with exit 0 and the predicate accepts them (probe V7). This is the contract review's limit N-5 (reuse of an existing report is stopped, an invented one is not), already among the plan's assumptions. | None in tooling. The 07-18 summary states it; git history and the owner are what show it. |
| J-02 | INFO | `tools/art/animation-budget-paired.mjs:1639-1647` | If a run dies between appending `closed` and the three report writes that follow, the registry holds a closed session whose reports do not exist. Verification then refuses, and with it the paired route for that identity. Fail-closed. | Plan 07-18: after every run, before committing the registry, confirm the session report and both arm reports exist with the hashes of the `closed` event. |
| J-03 | INFO | `tools/art/animation-capture.mjs:429-444` | Every closed qualifying session of the identity is verified, failed and invalid ones included, and the result must equal the `closed` event. So the session directory of each of them (arm reports and frame images) and an unchanged source tree are needed whenever plan 09 is checked, and a verification that cannot be reproduced refuses the route. Fail-closed. | Plan 07-18 keeps every session directory and changes no hashed source file until the capture of plan 10 has run. |
| J-04 | INFO | `tools/art/animation-budget-paired.mjs:1088-1150` | `verify` does not compare the identity set of a calibration's arm reports with the identity in its registration; for a qualifying session the frozen command ties the candidate arm to the current tree. Without invented reports (J-01) this cannot be used: reports of another session carry another nonce. | None required. |
| I-06 | INFO, carried | `tools/art/animation-capture.mjs:479-492` | The restated calibration and scope checks are unreachable behind the verdict. | None; say so in the summary. |
| I-07 | INFO, carried | `tools/art/animation-capture.mjs:286-298`, `:368-389` | The owner decision record must be plain: no quoted root scalar (`plan: "18"` makes every key read as absent), no flow list, no zero-indented sequence, no byte order mark; it needs `decision`, `decided_by`, `evaluation`, `evaluations`. | Plan 07-18 gives the exact form of `07-18-FROZEN-PASS-DECISION.md`. |
| I-08 | INFO, carried | `tools/art/animation-capture.mjs:457-507`; `07-18-PLAN.md:213` | The paired block must hold `registrationCommits` and `allQualifying` exactly as the `verdict` command prints them; the candidate must be an evidence-directory copy of the candidate arm of a passed session; the report of every closed qualifying session of every identity, and now of the calibration, must be in `evidence/` under its closed-event hash. | Amend `buildPlan09` in plan 07-18. |
| I-09 | INFO, carried | `tools/art/animation-budget-paired.mjs` (`frozen-evaluations` command); `tools/art/animation-capture.mjs:322-355` | The command lists the scan at the identity; the predicate always numbers the plan 07-13 evaluation too. Equal today. | Plan 07-18 numbers as the predicate does. |
| I-10 | INFO, carried | `tools/art/review.mjs:1018`; `tools/art/animation-budget-paired.mjs:633` | Recorded sampler arguments are a declared constant, not the object passed. | None. |
| I-11 | INFO, carried | `tools/art/animation-budget-paired.mjs:1472-1484` | First pair of each run: one page alive for the first arm, two for the second. | None; the calibration measures it. |
| I-13 | INFO, carried | `tools/art/animation-capture.mjs:278`, `:504` | Checking a paired qualification needs the gitignored cache: frame images, and now both arm reports of the calibration and of every closed session. Only on the capture machine, while the cache is kept. | See J-03. |

No finding of this review asks for a change to the three files.

## Disposition of the first review's findings

- I-01 (blocker): **closed.** `requireVerifiedSessions` (`animation-capture.mjs:422-445`) is called by the paired route before anything reads the verdict (`:472`) and by `executeV2` through `verifiedPairedSessions` (`:448-452`, `:616`). Probes below.
- I-02: **closed.** `assertHostDevice` (`animation-budget-paired.mjs:649-661`) refuses at registration (`review.mjs:1042`), before a run materialises anything (`review.mjs:1111`) and in the runner before `started` (`animation-budget-paired.mjs:1550`).
- I-03: **closed.** Controls now pin all seven default readers; each of my four replacements of the first review, and a canned verify reader, fails one or two controls.
- I-04: **closed.** `read-back cap: a registry that holds four qualifying sessions for one source identity is refused a verdict` fails when the rule is removed.
- I-05: **closed.** `armDifferenceRecord` (`animation-budget-paired.mjs:1040-1048`) is written into the session report (`:1063`, `:1637`).
- I-06, I-07, I-08, I-09, I-10, I-11: unchanged, carried in the table above.
- I-12: **closed.** The executor's mutation runs for the fixes used copies; the working files hash to the expected values.
- I-13: carried and wider (J-03).

## The eleven points of this repeat

1. **I-01.** Each case was judged by the real `requirePlan09`, by `verifiedPairedSessions` (reached through a copy of the capture tool with one export line added) and by `actualV2Outcome`. The verify reader answered with what `verifyOutput`, the function behind the `verify` command, gives for that registry and those files, with the real frozen command and the real frame-image check.

   | Case | Registry verdict | Result of all three |
   |---|---|---|
   | V1 hand-written calibration and qualifying events, stub session file, the plan 07-13 single-arm report as candidate (the first review's case) | pass | refused: the calibration's session report is not present |
   | V2 the same with a file present under every hash | pass | refused: not verified from its reports |
   | V3 hand-written calibration, then a qualifying session with consistent made-up reports | pass | refused at the calibration |
   | V4 calibration with consistent made-up reports, then a hand-written qualifying session naming the single-arm report | pass | refused at that session |
   | V5a closed event rewritten to say passed, session report says failed | pass | refused: not the report of its session |
   | V5b the same with the session report edited to say passed | pass | refused: `verify` finds the outcome differs from its recomputation |
   | V6 reference arm report missing | pass | refused: arm report missing |
   | V8 a consistent made-up session and, beside it, a hand-written one of the same identity | pass | refused at the hand-written one |
   | V9 one arm report hash named by two closed events | pass | refused: the first session's validity no longer recomputes |
   | V7 every report made up with the real runner from historical samples | pass | accepted (J-01) |

   `actualV2Outcome` does not pass when its verification effect is absent or throws. No registry claim that decides the verdict is left unrecomputed: `valid`, `pass` and the report hashes are all checked. What is still taken from the registry as written are facts no report can show: the tool hashes and the commit of a registration and the browser version of a close; the arm reports carry the browser build, and the frozen comparisons pin it. Verifying only sessions of the current identity (deviation 7) is sufficient: sessions of earlier identities are listed and never counted, their reports must still be present (`:495-496`), and the frozen command could not be run again on their source.
2. **Position.** After the registry is known whole and the verdict computed, before the first check that reads the verdict (`:466-473`). Acceptable. Pinned: moving the call to the end of the route fails `session verification, order`. All earlier controls still pass with their own messages (493 of 493).
3. **Default verify reader.** `runVerifyCommand` (`animation-budget-paired.mjs:1444-1449`) spawns the tool's own command with an argument array, piped output and a fixed budget and registry; the session path goes through `boundedPath` and comes from the evidence directory listing, never from the record. Inside the command the arm paths named by the report are bounded to the repository and must hash to the `closed` event, the candidate path is handed to the frozen command as one argument, frame images are bounded to the cache. A timeout or a line that does not agree with the exit code gives no facts and is refused (`verifyFacts`, `:1166-1177`). The reader is injectable only through the fourth argument; the production call still has three (`animation-capture.mjs:1365`), and `executeV2` is pinned to the disk readers (`:616`).
4. **Host check.** It compares every field of the device block except `rendererClass`, with both frozen devices: the one `compareAnimationCandidate` compares (`07-budget.json`) and the one the frozen command compares. Leaving `rendererClass` out is justified: it is derived from the samples and does not exist before a capture. It refuses before `started` and before anything is appended, materialised or written. The registration-time browser launch reads the browser version with the session's own launch settings, prints and writes nothing, and is acceptable. Read with this host's values and the browser build of the smoke session (147.0.7727.15) it does not refuse; a changed release, Node version, browser build or CPU string, and an extra field, are refused.
5. **Arm difference record.** Reported, not recomputed, and not part of validity or of the rules. It adds one field to the session report, inside the bytes hashed into `closed`; `verify` returns it as recorded. Nothing of R1 to R8 changes.
6. **I-03 and I-04 controls.** They have teeth: see the disposition above and "What I ran".
7. **Changed existing test lines.** Seven lines: the session fixture now writes both arm reports and names them in the session report; the list of readers the paired route may consult gains `verifySession` and the arm paths; the positive helper of `actualV2Outcome` supplies a verification effect; the default reader key list gains `verifySession`; and the count of places that name the default readers goes from 2 to 3, with the third pinned to `executeV2`. No rejection control was weakened.
8. **Messages.** No added line of the three files contains `halted` or `unqualified`. The clause added to `PAIRED_MEANING` ("with every session it counts verified from its reports") describes the check and claims nothing wider.
9. **One arm hash in two closed events.** Both sessions become unverifiable and the route refuses (V9). That is fail-closed and acceptable: a real arm report holds its session's nonce, its arm name and its capture times, so two real reports are never the same bytes.
10. **Unchanged properties.** Repeated in memory on the new bytes with the real runner: started, 13 pair lines, closed, three writes for a calibration; started, 13 pair lines, candidate arm, frozen command, closed, two writes for a qualifying session; no timing before `closed`; the frozen command reached through `runFrozen` only. Sampler identity `2720e51e...ab83f`. `tools/art/animation-budget-v2.mjs`, the golden evidence, the registry (`073f424d...cb14`), `src/` and `public/` are unchanged by the fix commits and clean.
11. **Plan 07-18.** It can still produce an acceptable record. What it must do:
    - copy the calibration session report to `evidence/07-18-paired-calibration.json` and every closed qualifying session report to `evidence/`, byte for byte;
    - keep every session directory under `.planning/research/.cache/06-art/animation-paired/` (both arm reports and the frame images) and change no hashed source file until the plan 10 capture has run (J-03);
    - after each run confirm the three report files exist with the hashes of the `closed` event before committing the registry (J-02);
    - copy the candidate arm of a passed session to the evidence directory and name that copy as `candidate`;
    - build the paired block from the `verdict` command's output, `registrationCommits` and `allQualifying` included (I-08);
    - number the frozen evaluation list as the predicate does (I-09);
    - on the frozen route, write the decision record in the plain form with `evaluation` and `evaluations` (I-07);
    - state J-01 and the identity-width limit in its summary.

## R1 to R8

- R1 (what is measured): implemented. Every emitted object carries `certification: false` and a meaning that points to section 10 (`animation-budget-paired.mjs:765`, `:1075`, `:1346`, `:1488`; `animation-capture.mjs:548`).
- R2 (arms): implemented. Working-tree bytes copied into two owned directories, five owners replaced by pinned blobs, any other difference refused (`animation-budget-paired.mjs:66-77`, `:189-193`, `:207-273`), clean served tree (`:291-296`), one strict listener per arm (`review.mjs:976-984`); the count is now recorded (`:1040-1048`).
- R3 (aggregate, groups, minimum): implemented (`animation-budget-paired.mjs:956-957`, `:1009-1023`).
- R4 (order): implemented (`:136-142`, `:775-780`, `:1596`, `:855-867`, `:812-821`).
- R5 (calibration and the two checks): implemented (`:398-407`, `:363-369`, `:421-438`, `:898-923`, `:888-892`, `:1118-1122`), and the calibration is now verified from its reports wherever the result is relied on.
- R6 (cap and verdict): implemented (`:408-410`, `:536`, `:1279`, `:1306-1349`), now with a control for the read-back cap.
- R7 (binding): implemented in the session tool and in `verify` (`:789-826`, `:547-556`), enforced by the runner before a close (`:1627-1628`), and now enforced where plan 09 relies on the result (`animation-capture.mjs:422-445`).
- R8 (what the tolerances allow): implemented as reported facts (`animation-budget-paired.mjs:975-980`, `:1006-1007`, `:1024`).

## The seventeen questions, for the new bytes

1. **Contract sections.** Implemented, nothing looser; see the R lines.
2. **Only the timing predicate replaced.** Yes. The earlier checks of `requirePlan09` are untouched by the fix (`animation-capture.mjs:512-539`).
3. **No path to a wrong qualification.** Met within the contract's stated limit. A paired or frozen failure, an undecided or failed verdict, a changed contract, a historical report, an unregistered session, a hand-paired session and an existing single-arm report are refused (point 1). Reports invented wholesale are J-01.
4. **Arms inside the cache.** Yes (`animation-budget-paired.mjs:241-262`; `review.mjs:980`, `:1190`).
5. **Frozen things unchanged.** Yes (point 10).
6. **Validity before timing; no timing before close.** Yes (`animation-budget-paired.mjs:1627-1639`, `:992-994`).
7. **Seven steps.** Yes (point 10).
8. **Residual window.** Yes: between the candidate arm write and `closed` only that file exists and nothing is logged (`:1613-1618`, `:1653`).
9. **Frozen command only through `runFrozen`.** Yes in the runner (`:1617`; `review.mjs:1193`). Elsewhere it is spawned by `runFrozenCommand` with captured output, from `verify`, `frozen-evaluations`, the default readers and `executeV2`.
10. **RED and mutation evidence.** For the fixes: 22, 3 and 4 controls failed at RED for I-01, I-02 and I-05, all on assertions; the I-03 and I-04 controls are covered by mutation runs. The executor recorded 63 mutation runs on copies with every expected control failing. My own sample on the new bytes: 32 mutations. Each fails at least one control, except that the removed read-back cap fails none in the capture file; the control for it is in the paired file and fails there.
11. **Weak controls.** Unchanged answers: the equal-settings control can fail; the call-arity check does not depend on formatting and still pins one call with three arguments.
12. **Other settings than the calibration.** Invalid (`:928-933`).
13. **Rule 2.** The per-cell form (`:1009-1023`); nothing measures or subtracts an order effect.
14. **Calibration.** Verified without the frozen command (`:1118-1122`); pinned owner identities checked on every reference arm (`:888-890`).
15. **Production call sites.** One call, three arguments (`animation-capture.mjs:1365`); a fourth argument there fails two controls. `stable-gates.mjs` does not exist yet and will need its own control.
16. **CR-01 and CR-03.** They hold on the new bytes. Summary check removed in a copy: 57 controls fail (19 frozen route, 19 paired route, 19 earlier). `verifyRuntimeDependencies` removed from the predicate: 13 fail (8 frozen, 4 paired, the order control); from `requireStableGates`: 4.
17. **Messages and fields.** Point 8. The three earlier messages with those words are unchanged (`:524`, `:532`, `:536`).

N-04 (identity width) still has to be decided before the calibration is registered, for the reasons of the first review: widening edits `review.mjs`, which changes the identity hash and a tool hash and requires this review again.

## What I ran

- Hashed the three files; ran the capture, paired, frozen-budget and runtime-dependency test files: 493 of 493.
- The probes of point 1, in memory. Registries with hand-written or made-up events existed only as objects; candidate arm reports of made-up sessions were written below `.planning/research/.cache/07-16-red/review2/` for the frozen command to read and removed. The tracked registry was only read.
- Mutations on copies, judged by the unchanged controls; copies removed, lists and results kept in that directory:
  - I-01, capture tool (11): call removed (15 controls fail); call moved to the end (1); calibration skipped (11); only passed sessions verified (3); arm hash comparison removed (1); closed-event comparison removed (1); "passed must verify as passed" removed (1); `executeV2` given a verification that does nothing (1) or other readers (1); `actualV2Outcome` ignoring a failed verification (1); canned default verify reader (2).
  - I-03 (4): canned frozen reader (2), committed registry read from the working file (1), made-up history (2), empty frozen-evaluation list (2).
  - Paired tool (8): `verifyFacts` without the exit-code agreement (1) or the nonce (1); unbounded session path (1); runner host check removed (1); browser build left out (2); extra host field ignored (1); read-back cap removed (1); arm difference dropped from the report (2).
  - `review.mjs` (3): registration host check removed (1); run host check removed (1); second arm check defaulting to the first (1).
  - Across both files (2), and the CR-01 and CR-03 mutations of question 16 with the call-site one (4).
- The in-memory run of the real runner for both kinds, and `assertHostDevice` with this host's values. No browser was launched.

## What I could not verify

- Any real capture: the calibration and qualifying modes have never run; the `review.mjs` effects, the registration-time browser launch included, were read, not executed.
- The default verify reader on a real session: none exists on disk. Its command was exercised through the function it prints from.
- Linux or another host.
