# Plan 07-09 — Proposed Runtime Owner Scope Correction

2026-10-07. Proposal only. The executor has not changed the V2 whitelist, producer,
numeric limits, frozen reference or budget. Plan09 task2 remains open until an
independent complete candidate passes the actual acceptance CLI.

## Concrete Scope Blocker

`tools/art/animation-budget-v2.mjs` permits candidate changes only in
`src/builders/characterResources.js`, `src/builders/enemyGLTF.js` and
`src/builders/firstPersonRig.js`. Its protected identity comparison includes all
other source JS, including the modules that produce selection/core correction.
The frozen producer measures those components separately; faster view copying or
fewer world palettes cannot excuse their failures.

The completed actual view-cache optimization lives in the allowed owner. A real
view-only RED measured60 recursive name lookups over20 warmed updates; GREEN
retains the same first depth-first bone identities, copies the same quaternions
and clears its map before retirement callbacks. It changes no pose calculation.

A separate handling-cache probe measured920 recursive rig-name lookups in20
warmed updates. RED commit3656f42 is retained, but the proposed protected-owner
implementation was never committed. Scoped restoration commit a9cbc5f preserves
the probe history. Exact original source/test hashes were restored; this probe
is diagnostic evidence, not accepted optimization or budget proof.

## Minimal Proposed Change For Independent Parent Review

Add exactly two runtime paths to `MUTABLE_RUNTIME`, subject to independent review:

| Owner | Evidence-driven candidate optimization | Required invariants |
| --- | --- | --- |
| `src/builders/weaponHandling.js` | Cache the current owned rig's first depth-first named bone/socket references instead of repeating recursive searches inside both arm solves and finger correction. Rebuild on rig replacement and clear on disposal. | Perform every original arm/finger rotation, preserve world targets/rest restoration/part movement/contact results, keep actors and view rigs independent; no phase, outcome or clock changes. |
| `src/builders/enemyAnimations.js` | Cache stable mounted-weapon lookup and immutable action-alias/mask lookup collections inside the existing actor/mixer generation; retain all action selection, masks, weights and stop semantics. Invalidate with the existing owner/mixer retirement. | Preserve every selected layer and supported authoritative cue, exact phase/reset/death behavior, correction/inertia order, rig roots/eyes, source curves and shared clip buffers. No skipped correction or hidden essential geometry. |

Keep new regression work in `tests/animation-resources.spec.js` and
`tests/weapon-handling.spec.js`, which are outside captured source identities.
Use actual loaded rigs and bounded lookup instrumentation, current/replaced rig
and generation negatives, preserved correction/contact outputs, idempotent
retirement, live siblings and subsequent clones. Existing focused source-unit
tests run unchanged. Do not expand permission to other runtime or test files.

The acceptance-module edit would be only this exact owner allow-list correction;
its existing negative controls must remain effective. Do not remove the protected
identity checks or allow all source changes. Record the reviewed change explicitly
and add controls proving these two owners are allowed while unrelated simulation,
art, producer and other protected owners still reject mutation.

## Unchanged Acceptance

Keep all original false legacy flags and all four frozen evidence hashes. Keep
producer/sampler/settings/camera/workload/statistics and epsilon1e-7 unchanged.
Every existing per-profile/component median and p95 upper bound remains required.
No limit, timer precision allowance, material, shadow, limb, finger, animation
layer or gameplay behavior may be removed to create a pass.

After reviewed owner changes and meaningful RED/GREEN/actual-render checks, run
one new independent complete two-run/twelve-profile matrix. Preserve this
continuation's complete failing attempt separately. Only its new actual report
can be considered for acceptance; never reuse the frozen reference or splice
partial attempts. If the same fixed limits still fail, report the concrete
remaining failures without claiming completion.

The timing failures do not establish causation. An unrelated software-renderer
job was observed during initial diagnosis and exited naturally before the full
capture; it was never stopped. Neither that observation nor SwiftShader data
certifies hardware/FPS performance or human motion quality.

These CPU lookup candidates are not a demonstrated solution for the frame-time
failures. They must independently improve their actual named components and the
same complete candidate must still satisfy every frame/render/view bound. If
they do not, the frame-budget blocker remains; approval of owner scope is not
approval of performance or a guarantee that plan09 can close.
