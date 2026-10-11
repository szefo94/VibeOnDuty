---
status: pass-with-notes
reviewer_model: opus
reviewer_effort: high
reviewed_commit: fbcbb115290ceede99be1f98534bc5d7f1087503
reviewed_stable_gates_sha256: ea5f5e654ce335ccb979f6015b48a5fa0955d296af56f7a254209a35a47f2f1e
reviewed_stable_gates_test_sha256: 405dda7719a583f57808741c4ea9f1f14d21709f2268707e6c92395e7e351cb6
---

# Plans 07-17 and 07-18: independent review of the stable-gate tool and the records it wrote

Reviewed 2026-10-11 at commit `fbcbb115290ceede99be1f98534bc5d7f1087503`, by a reviewer that wrote
none of this code. Scope: `tools/art/stable-gates.mjs` and `tools/art/stable-gates.test.mjs` (commits
`6daf909`, `d4cb431`, `8a99db1`; `2f64522` wrote the records), and the records the tool wrote. The three
files pinned by the plan 07-16 review still have their reviewed hashes.

## Verdict

The tool does what it says. It records real exit codes with hashed logs, never takes "executed" or
"full" from a caller, carries an earlier result only at an unchanged source identity with an
unchanged log, reaches the plan 09 predicate once with three arguments, and builds the qualification
record from the registry verdict it recomputes. The record on disk is accepted today by the real
predicate, which re-verified the calibration and the qualifying session from their kept
directories. Nothing presents the frozen result as a pass: it is recorded as failed (exit 1 twice,
40 and 21 statistics over).

Two things need action. First, the offline gate's pass is the second of two full runs. Plan 07-17
said not to retry the suite unchanged; the orchestrator did, and the owner did not approve it
separately. The summaries, the state file and row D2 say so plainly, but the gate record and the
qualification record show only the pass, and the case that failed in run 1 is one of the two
assertions plan 09 requires. That is for the owner to accept or not, on record. Second, the
command-line half of the tool (running gates, carrying results, `check`, the `plan09` command) has no
control: ten changes to it left all 25 tests passing.

## Findings

| Id | Severity | File and line | Finding | Required change |
|---|---|---|---|---|
| S-01 | WARNING | `07-17-PLAN.md:207`; `evidence/07-10-stable-gates.json`; `evidence/07-09-qualification.json`; `07-09-SUMMARY.md:37-39` | The offline gate passed on the second of two full runs of the unchanged suite. The plan says: "Do not retry the whole suite unchanged ... leave the record showing the real exit code ... and stop." The orchestrator decided the rerun; "the owner did not separately approve" (`07-17-SUMMARY.md`). Run 1 failed `throw: cancels reload before award with 1ms remaining` with a timeout in `beforeEach`. That case is the required assertion `throw1ms`, and a setup timeout is how it stood open before. The cold-start explanation is unproven. Disclosure is honest in `07-17-SUMMARY.md`, `STATE.md`, `evidence/07-17-offline-run1.json`, row D2 and `07-18-SUMMARY.md`. The gate record and the qualification record themselves carry no trace of run 1. | The owner's decision on record: accept the second-run pass for the stable gates and for D2, or name what is needed instead. Until then D2 and `stableGatesPass` rest on a retry the plan did not allow. Row D2 should name the failed case as the required `throw1ms` assertion and cite `07-17-PLAN.md:207`. |
| S-02 | WARNING | `tools/art/stable-gates.mjs:401-408`, `:428-457` | The tool keeps no history of full runs. A rerun opens the same log for writing (`:403`, `:439`), replaces the gate's result and overwrites the kept report (`:423-424`). The failed run's log and report survived only because the executor copied them by hand first. The record's `rule` line ("Actual failed full command results remain nonpassing ...") reads as a guarantee the tool does not enforce for a full rerun. | Record every full run of a gate at an identity (exit code, log hash, start time) in an append-only `attempts` list, write each run to its own log and report file, and have `check` report when a passing gate has an earlier non-zero attempt. |
| S-03 | WARNING | `tools/art/stable-gates.mjs:357-375`, `:410-457`, `:463-488`, `:507-554` | No control reaches the command-line functions. Each of these changes, made in a copy, left 25 of 25 tests passing: an earlier result carried although its log changed; a source change during the gates not noticed; a child without an exit code recorded as exit 0; `check` not hashing logs; `check` not calling the stable-gate predicate; `check` reporting plan 09 qualified when the predicate throws; the `plan09` command not requiring the stable gates, accepting any offline report, reading the registry without the git checks; counts taken from a stale report. The code is correct as written; nothing would notice if it stopped being so. | Give `run`, `check`, `plan09` and `previousRecord` their paths and effects as parameters, as the paired runner has, and add one control per behaviour listed. |
| S-04 | WARNING | `tools/art/stable-gates.mjs:108`, `:114-132`; `07-17-SUMMARY.md:21` | Two overstatements outside the gate logic. (a) `complete` judges exit codes only: skipped and flaky counts, retries and the number of tests are information. The plan's truth "0 failed, 0 skipped, 0 flaky" holds for this record (138/0/0/0, 18/0/0/0, 323 units, no retries configured, `CI` unset) but is not what `complete: true` means. (b) `07-17-SUMMARY.md` has `requirements-completed: [ANIM-02, ANIM-03, ANIM-04, ANIM-05]`; `REQUIREMENTS.md` keeps ANIM-02, ANIM-03 and ANIM-05 pending and the later summaries have an empty list. | (a) Say so where the record is cited, or make the tool refuse skipped or flaky cases. (b) Empty that list. |
| S-05 | INFO | `tools/art/stable-gates.mjs:102-106`, `:182-195`; `tools/art/animation-capture.mjs` (`requirePlan09`) | Records are trusted as written. `run` carries the exit code of the record on disk when the log hash still matches; the predicate accepts the `assertions` block by its shape and `check` adds the log hash. A hand-edited record is not detectable by the tool. Same class as J-01 of the plan 07-16 review. | None in tooling; git history and the owner show it. |
| S-06 | INFO | `tools/art/stable-gates.mjs:264`, `:319-324` | On the paired route `frozenEvaluations` and `frozenExitZeroObserved` are copied from the timing result; neither the tool nor the predicate recomputes them. I recomputed the list by scan: it equals the record (2 evaluations at this identity). | None. |
| S-07 | INFO | `tools/art/animation-capture.mjs` (identity set); `evidence/07-10-stable-gates.json` | `tests/` and `server/` are outside the source identity, and the record holds no commit id, so a record stays current when tests change. Between the fast gates, both offline runs and the final record no file outside `.planning/` changed (`git diff 6daf909 92a21eb`), and none under `src/`, `tests/` or `server/` since. | Record the commit and a clean `tests/` and `server/` state with each run, when S-02 is done. |
| S-08 | INFO | `tools/art/stable-gates.test.mjs:301-303` | The call-site control accepts a reformatted three-argument call and rejects a fourth argument on several lines. Its companion self-test pins the literal spelling of the call and fails on a pure reformat. A false failure, never a false pass. | None. |

## Answers

1. **Can `run` record a pass that did not happen?** Not by the paths asked.
   - Result fields: `executed` and `scope` are set by the tool; a caller-supplied field is refused (`stable-gates.mjs:95-99`).
   - Exit code: it is the child's (`:440-444`); a child that ends without one stops the run and is not recorded (`:442`).
   - Carried results: only when the whole identity set deep-equals the earlier one and the earlier check was a full executed run of the same command (`:88`, `:102-103`), and only while its log has the recorded hash (`:366-375`).
   - Source change mid-run: the run throws before any record is written (`:448`).
   - Truncated or missing log: it fails the hash in `previousRecord` and in `check` (`:471`).
   - Two-run history: the record shows the last run only. See S-01 and S-02: honest in the documents, absent from the record and the tool.
2. **`check` and `plan09`.** One call of `requirePlan09`, three arguments, the first `await animationIdentities()`, no readers (`:481`); pinned by a source-text control that fails on a fourth argument, a spread, `.apply`, an alias, a second call and other identities. The `plan09` command writes `complete` from its own builder (`:545-553`); qualification is then decided by the predicate through `check`. The builder mirrors the predicate and cannot replace it: the predicate also needs the summary status and re-verifies every session.
3. **`buildPlan09`.**
   - From the registry, recomputed: verdict, counts, wording and `allQualifying` (`:239`, `:299-309`), from a registry the command checked against git (`:524`).
   - From the timing result, checked by the command: registration commits (`:526`), registry hash (`:528`), candidate bytes (`:532-536`), offline report hash (`:519`).
   - Declared by the timing result: `structuralV2Pass` and `applicableBudgetPass`. The predicate recomputes both from the real frozen command.
   - Not recomputed by anything: S-06, and `assertions` (S-05).
   - Sixth argument: it cannot make an unqualified state read as qualified. `problems` only adds reasons; `timingResult` is carried; `frozenDecision` is read only when the paired route does not hold (`:296`) and then needs the plain scalars, a frozen exit 0 on the recorded candidate and the timing-result hash, after which the predicate's own frozen route still applies.
   - `applicableBudgetPass: false` with the paired gate is what the frozen command gives now for the recorded candidate (exit 1, 21 over) and is worded as not meeting the original limits (`:314-318`).
4. **`07-09-SUMMARY.md`.** Six lines replaced (status, `completed`, D2 and D3), 102 added, every earlier body section kept. D3 stays `fail` with "original absolute limits, not met". D5 claims only what the paired route covers and names the registry and the contract. D2 is `pass` with `human_judgment: true` and the two-run disclosure; see S-01 for what it leaves out. `requirements-completed` stays empty. The archive `evidence/07-09-qualification-halted-2026-10-07.json` is byte-identical to the record before the task (`564799e5...c304`), and `evidence/07-10-stable-gates-halted-2026-10-07.json` to the record before the tool (`01fab6d9...150e`).
5. **Tests.** 25 of 25 pass. In copies outside the repository, 19 changes to the pure functions each failed at least one control (record completeness, carry rules, caller fields, gate commands, offline exit code, a retried case, the frozen route without the decision record, verdict not pass, ignored problems, a rewritten `applicableBudgetPass`, another identity, session list, candidate, decision parser, same title in another file, denominators, command line). Ten changes to the command-line functions failed none (S-03). The arity control is independent of formatting (S-08). I found no control that can only pass.
6. **On disk now** (read-only):
   - `node tools/art/stable-gates.mjs check`: exit 0. `stableGatesPass: true`, `plan09Qualified: true`, `recordIdentitiesCurrent: true`, identity `c1b06272...2c57`.
   - `chain`: exit 0. Valid, 9 events, every event committed, 6 committed versions, each a prefix.
   - `verdict`: exit 0. `pass`, "passed, session 1 of 1; 0 valid sessions failed; 0 invalid"; calibration closed, valid, passed; tool hashes and sampler equal the reviewed ones; browser 147.0.7727.15.
   - `verify` of the calibration `23e8adde...`: exit 0. Valid, 192 comparisons, 0 rule 1 violations, 0 rule 2 violations, 10 groups `rule-1-only`, no frozen command, arm difference 0 of 0.
   - `verify` of qualifying session `a16b4bbf...`: exit 0. Valid, 192 comparisons, 0 and 0 violations, structural V2 pass, arm difference 5 of 5, frozen exit 1 with 21 over, equal to the `closed` event.
   - `frozen-evaluations`: 13 complete reports scanned, 2 at this identity: exit 1 with 40 over (plan 07-13), exit 1 with 21 over (session 1); no exit 0.
7. **Overstatement.** None in what the tool emits: both records carry `certification: false`, the qualification's meaning denies the original limits, a frame rate, a device and a human acceptance, and no message calls the frozen result a pass. Outside the tool: S-04.

## What I ran

- Hashed the two files; `node --test tools/art/stable-gates.test.mjs`: 25 of 25.
- The six read-only commands of answer 6. Their outputs are in `.planning/research/.cache/07-18-review/`; nothing else under the cache was written and nothing deleted.
- 29 mutations and two formatting variants on copies in the session scratch directory, outside the repository; the copies are removed.
- Read both offline reports in the cache: run 2 has 138 expected, no retries, each required case passed once; run 1 has 137 and `throw1ms` timed out.
- Compared the two archives with the pre-task records in git, and the qualification record with the verdict output, the registry, the candidate and the timing result: all equal.

## What I could not verify

- A gate run: none was started. The behaviour of `run` on a real failure, a killed child or a changed source was read, not executed.
- Why run 1 failed.
- Linux or another host.
