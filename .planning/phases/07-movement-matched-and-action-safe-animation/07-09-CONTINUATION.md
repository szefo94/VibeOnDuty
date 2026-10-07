# Plan 07-09 continuation — provider quota interruption

Recorded 2026-10-06. Phase 7 remains executing: plans 01–08 complete; plan 09 task 2 is open; plan 10 has not started. The existing 07-09-SUMMARY.md describes the earlier checkpoint and does not prove this continuation complete.

## Committed continuation work

- `f9505e7`: V2 acceptance negative tests (RED).
- `c973458`: frozen source-eye reference/budget and executable acceptance gate (GREEN), before runtime optimization.
- `78b8dab`: duplicate world GPU palette regression (RED).
- `d30da22`: per-instance exact-equal skeleton consolidation (GREEN). No sharing across actors or unequal palettes; mesh binds and posed vertices preserved.

The executor reported 33 resource/action browser cases, 3 palette/posed-vertex cases, 2 legacy keepers, 7 focused units, 33 V2 negative tests, lint and both type checks passing. Parent verified these commits exist. Those checks do not waive the performance gate.

## Interrupted independent capture

Source remained frozen at `d30da22`. Saved directory:

`.planning/research/.cache/06-art/animation-candidate/capture-1791318346788-21592/`

Parent inspected 11 completed `*-metrics.json` profiles and 33 PNGs. Run 2 High/eight actors is missing. Each completed profile reports zero retired listeners, callbacks and shared disposals. No complete post-optimization report was atomically published; do not assemble the partial records into a complete report or reuse the older candidate file.

Low/eight actors now has 17 warm textures versus reference 367. Actual timings exceed fixed V2 limits, including run 1 Low/one frame p95 307.1ms versus 261.4ms. Saved run 1 frame median/p95 values: Low/one 239.7/307.1ms, Low/eight 447.3/551.3ms, Medium/one 265.2/376.5ms, Medium/eight 506.2/669.9ms, High/one 247.6/277.6ms, High/eight 414.5/545.0ms. Run 2 completed profiles also show overruns. These are software-renderer measurements, with no device/FPS certification. The executor observed three Low/one PNG hashes identical to the archived reference; visual preservation does not excuse timing failure.

The executor ended with provider `usage limit`; reported retry hint: October 12, 2026, 9:41 AM (provider supplied no timezone). Parent resolved configured escalation: `escalated:false`, `exhausted:false`; no alternate provider is configured. Parent found no remaining review/capture process after interruption. No unrelated process or port was stopped.

## Resume instructions

1. Run the root pin and restore the run-local default-branch commit allowance only for this authorized execution session. Original configuration bytes remain at `.planning/research/.cache/07-execute-config.original.json`.
2. Dispatch a fresh typed executor continuation for 07-09; preserve all four commits, fixed V2 hashes/limits, original baseline/budget and failed flags. Read 07-BUDGET-AMENDMENT.md, 07-BUDGET-CONTRACT-REVIEW.md, amended plan 09, this record and existing summary before acting.
3. Preserve the partial capture as interruption evidence. Investigate scoped causes of the actual numeric overruns. Do not change sampler, essential rendering or numerical limits to create a pass. A new complete independent two-run/twelve-profile capture is necessary after justified changes; verify its actual file with the V2 CLI.
4. Only after actual V2 acceptance and plan 09 closure, dispatch 07-10 for motion/art recovery, full moving review and final gates. Then perform independent review/security/regression/phase verification and retain human motion acceptance as pending until real UAT.
5. Do not mark plan 09, ANIM-05 or Phase 7 complete; do not begin Phase 5. Auto advancement remains false.

Original immutable baseline SHA256: `177686a0759ca5b7dc4311e2a6e4bdba15b6c9a844546d51ad1690c00b1b0b20`.
Original immutable budget SHA256: `66722a272115cdc1145cf1af97a1cb583389d7ea5adb75a4534445c15a14e1ff`.
V2 reference SHA256: `6d5fd41136766209445b9694dfb0ffdf269d4a1887cffadba868dcad8a8b6aef`.
V2 budget SHA256: `6f0bf775eda9061b601023d5890a50248668a3bccbec48eeaeb7f84e7a64ba34`.
V2 producer SHA256: `035432f721cb0661a82c288d3b5e92ce4d631a48da5bc6fbb73022897960f5e0`.

## 2026-10-07 continuation checkpoint before final profile

Source is frozen at `2a5b7ef`. Independent current attempt:
`.planning/research/.cache/06-art/animation-candidate/capture-1791356297635-26892/`.
Eleven of twelve profiles are retained; final run2 High/eight is active. Actual
timings exceed the fixed envelope. Do not count this as a complete report until
atomic publication and the actual V2 CLI run. Earlier partial attempt remains
untouched and cannot supply the missing profile.

Current commits: `3656f42` protected handling-cache RED; `a9cbc5f` exact scoped
restoration preserving that history; `97b8b37` permitted owned view-cache RED;
`2a5b7ef` permitted view-cache GREEN. Handling source/test bytes exactly match
the frozen reference. The view owns a first-depth-first lookup map and clears it
before foreign disposal callbacks; no pose/clock/draw/authority change.

Current qualification:44 actual browser cases passed in4.7min;2 legacy keepers
passed24.9s; final targeted view cache browser passed15.8s and2 view units passed.
Seventeen focused units,lint,both types,build and33 V2 negative tests passed.
Initial three setup timeouts, diagnostic no-test grep, and interrupted probe-only
browser runs are nonpasses, not behavioral RED or full qualification.

An unrelated Chrome software GPU job was observed consuming29.65625 CPU seconds
over3.0522724 wall seconds; it exited naturally before this full matrix. It was
never stopped and no causal conclusion is established. Its existence does not
waive any actual failure.

If final numeric acceptance fails, use
`07-09-OWNER-SCOPE-PROPOSAL.md` for parent independent review. It proposes exactly
two additional runtime owners, not new numeric/producer allowances. No owner
whitelist change or protected implementation was made by this continuation.

## Terminal checkpoint — 2026-10-07

The current attempt completed all12 profiles/36 PNGs in1,170,050ms. Browser and
owned listener closed. Canonical `evidence/07-09-cost-postopt.json` has SHA256
`799b7217d1e1120fac2d16442accfadfa578a7d5cec14bb75d57faef58742c39`.
Actual named V2 CLI exit1; `07-09-budget-postopt-result.json` records135 numeric
overruns while complete view/pixel/source/device/ownership/plateau checks pass.
This supersedes the active11-profile note above, not the older interrupted attempt.

Evidence/proposal commit `1e252ae`; halted summary commit `0e1e177`.
No running capture remains. Parent should independently review the concrete
owner-scope proposal and actual failed gate before any new implementation.
Plan09 task2, dependent plan10, Phase7 and assigned requirements remain open.
No new numeric bound, producer, reference, source whitelist or protected runtime
change was approved or implemented here. Human motion/device/FPS claims remain
pending. The root-owned temporary config stays unstaged for parent restoration.

## Terminal owner-cache continuation — 2026-10-07

Binding review1e537a4 permits exactly enemyAnimations/weaponHandling reference
and stable-collection caches; frozen predicates stay unchanged. RED116f9ba and
GREENf89d820 prove zero repeated warm traversal/enumeration, exact5 pose/layer
and28 handling snapshots, duplicate/missing semantics, lazy mask interruption/
death, rig/root/mixer/current-weapon replacement, old retirement, keepers and
later clones.17 unchanged units/41 V2 controls, lint/both types/build pass.

Current distinct browser coverage45/46 and legacy1/2 is incomplete: original
throw1ms and repeated-removal checks stopped in setup before assertions.
WINDOWS42/43 retain limits. No unchanged broad retries are needed.

Evidence1dea2c2 preserves earlier complete report/raw failure byte-identically
and current actual smoke atf89d820. Smoke83,037ms has1 profile/214 timed frames/
3 full PNGs/complete:false, SHA3bf8ae8972a4a429075a61e56f3877d93d84650a42527adad0f6bbd58051bc78.
Raw capture-1791359694832-10580 is retained. Low/one frame300.8/410.3ms exceeds
244.7/261.4;14 of16 fixed statistics overrun. Actual V2 CLI exits1 Incomplete
report. This diagnostic is never a full candidate or pass.

Unrelated node tests/browser-probes.mjs PID31152/GPU28780 were observed, never
stopped or altered; no causal waiver follows. User requires other jobs keep
running. Parent owns host-condition/sequencing followup. No known-unready full
matrix was launched. Applicable V2 acceptance and two targeted assertions still
block task2/plan10. Halted summarya9bb060 is committed; no requirement/roadmap/
phase completion or human/hardware/FPS acceptance is claimed. Config stays
root-owned and unstaged.
