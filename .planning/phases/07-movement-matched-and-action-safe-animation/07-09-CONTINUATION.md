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
