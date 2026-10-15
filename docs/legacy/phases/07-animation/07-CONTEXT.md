# Phase 7: Movement-Matched and Action-Safe Animation - Context

**Gathered:** 2026-10-05
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Deliver ANIM-02 through ANIM-05 on the accepted Phase 6 human soldier: smooth
current locomotion and action transitions, first-person hands/arms and visible
body, simulation-aligned remote posture, a reproducible approved-motion workflow,
and safe instance/template resource ownership. Prepare inspectable slide, dive,
prone and supersprint poses/transitions. Phase 5 implements actual omnimovement,
new sprint input/speed rules and final ANIM-01 integration acceptance. Preserve
the accepted art, offline gameplay and Phase 1 authoritative multiplayer.
</domain>

<decisions>
## Implementation Decisions

### Weapon handling and camera feel
- **D-01:** Controlled, responsive motion: noticeable weapon movement, restrained
  camera bob and steady ADS. Avoid cinematic camera jolts that dominate aiming.
- **D-02:** Show animated arms and hands in first person, plus torso and legs when
  looking down. Hands must perform real weapon handling and maintain credible
  contact; do not deliver only a floating gun or only a third-person pose review.
- **D-03:** Reloads show clear physical magazine removal/insertion and appropriate
  bolt handling. Fit the animation to gameplay reload time rather than changing
  ammo/timing outcomes to accommodate a clip. Specific handling follows each
  supported weapon; do not apply a detachable-magazine sequence indiscriminately.
- **D-04:** ADS responds immediately with a short, smooth raise/lower transition;
  sights settle without bounce.

### Full-body movement
- **D-05:** Quick, planted directional turns/stops, subtle body lean and feet
  matching actual movement speed. Animation must not move the simulated body.
- **D-06:** Normal sprint uses a lowered two-handed gun carry. Prepare a distinct
  one-handed supersprint carry and transitions for the user's two-level sprint
  request. In Phase 5, Shift selects normal sprint and double-tap Shift requests
  supersprint; a preview is not an implemented faster movement state.
- **D-07:** Compact, controlled jumps and landings: secure gun handling, brief
  knee compression on contact, and quick recovery.
- **D-08:** Torso leads small stationary aim turns; larger turns reposition the
  feet. Keep twist within credible anatomy and posture consistent with the
  authoritative aim/body state.

### Action interactions
- **D-09:** Desired sprint/reload rule: normal sprint permits reloading with a
  **15% longer reload time**; supersprint cancels reloading and switches to the
  one-handed carry. This means duration multiplied by 1.15, not 15% slower
  playback interpreted as duration divided by 0.85. Prepare consistent visual
  timing/transitions in Phase 7; Phase 5 implements the new movement-dependent
  gameplay timing/cancellation, with server authority. Do not silently change
  the accepted online M4 timer as an animation-only change.
- **D-10:** Supported melee and grenade throws take priority immediately: leave
  ADS, cancel reload, perform the action and return to weapon-ready. Avoid
  unintended action overlap, delayed queued attacks, duplicate releases or
  ammo awards from a canceled reload. An animation is not authorization for an
  online action that the server does not yet support.
- **D-11:** Controlled directional death collapse: a short animated fall that
  responds to hit direction and settles into a stable pose. Prefer this over a
  new full physics ragdoll system. Use trusted impact direction when available;
  research the minimum authoritative pose signal or a deterministic fallback
  when it is unavailable. Visual settling never delays authoritative death.

### Carried-forward constraints and implementation discretion
- Keep the accepted near-future human proportions, fitted armor, visible face,
  painted comic surfaces, intensive black contours and localized team accents.
- Call of Duty-inspired responsiveness is the movement reference. New movement
  rules are Phase 5 work; current simulation remains the position/root authority.
- Keep weapon/action permissions and timing explicit and consistent across
  player, offline bots and supported online actors. Client cosmetics cannot
  invent health, hits, ammunition, actions or server movement states.
- Choose clip sources, retargeting/blending, mask/IK mechanisms and first-person
  presentation architecture through source-backed research. Select verified
  reusable motion or original authored motion; inherited asset terms remain
  unresolved until evidenced. Phase 6 visual acceptance is not license clearance.
- Damage-reaction intensity was not separately selected. Propose restrained
  cosmetic reactions consistent with steady ADS; preserve gameplay aim/health
  authority and expose the result for visual review.
- Actual game motion/transition review is required. Static poses and passing
  angle metrics alone cannot establish natural grips or smooth movement.
- Preserve prefix-aware loading and playable fallbacks. Measure animation and
  resource costs on the actual review setup; do not claim phone/iGPU/60 FPS
  qualification from headless SwiftShader or a one-actor static capture.
</decisions>

<canonical_refs>
## Canonical References

### Scope, decisions and accepted baseline
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md` - ANIM-02 through ANIM-05; ANIM-01 belongs to Phase 5.
- `.planning/ROADMAP.md` - Phase 7 success criteria and selected 7 then 5 order.
- `.planning/phases/06-human-characters-and-comic-book-blender-iteration/06-CONTEXT.md`
- `.planning/phases/06-human-characters-and-comic-book-blender-iteration/06-UAT.md`
- `.planning/phases/06-human-characters-and-comic-book-blender-iteration/06-VERIFICATION.md`
- `AGENTS.md` - verify current code; historical notes are navigation.

### Animation, assets and authoring
- `tools/README.md`
- `tools/retarget.py`
- `docs/ART.md`
- `docs/ANIMATION-REVIEW.md`
- `docs/ANIMATION-SPACES.md` - resolved retargeting section supersedes old corrections.
- `tools/art/provenance.json`
- `src/builders/enemyGLTF.js`
- `src/builders/enemyAnimations.js`
- `src/builders/rifleClips.js`
- `src/builders/weapon3pTransform.js`
- `src/builders/characterResources.js`
- `src/builders/characterAppearance.js`

### Gameplay integration and existing evidence
- `src/loop.js`
- `src/entities/player.js`
- `src/combat/shoot.js`
- `src/entities/grenades.js`
- `src/network/remoteActors.js`
- `src/network/onlineSession.js`
- `src/shared/combat.js`
- `src/shared/movement.js`
- `src/shared/protocol.js`
- `tests/animation-regressions.spec.js`
- `tests/character-art.spec.js`
- `tests/multiplayer.spec.js`

No external animation specification was supplied. Research official tool/source
documentation and asset-specific reuse terms before selecting new motion.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The accepted human GLB has 65 joints and 48 animation occurrences, with
  per-instance skeleton cloning/mixers, prepared aliases and procedural fallback.
- Existing offline Blender retargeting, generated rifle crouch/jump clips and
  the pinned art pipeline provide a comparison baseline and editable workflow.
- Existing character resource ownership keeps shared template geometry alive
  while retiring instance materials, skeleton textures, mixer bindings and ink.

### Established Patterns
- Locomotion blends idle/walk/run/strafe, with action overrides, additive
  breathing and post-mixer inertia. Player, enemy and remote selection paths
  differ; research their reconciliation without assuming they already match.
- Preserve shared track-buffer isolation, rest-equivalent track stripping,
  quaternion sign normalization, jump boundaries and the verified hand basis.
- Current online support is an authoritative M4 TDM slice with replicated
  stance, aim, sprint, vertical motion, reload and life/match generations.
  Richer online melee/equipment and supersprint are not existing server states.

### Integration Points
- `loop.js` coordinates player animation and temporary render camera offsets;
  camera position must be restored for simulation/combat. First-person body
  presentation must not leak into authoritative position or root movement.
- `enemyAnimations.js` and `remoteActors.js` own other actors' cosmetic motion;
  use actual simulated/snapshot posture rather than independent movement.
- Action interruption/release and death/menu/respawn/session retirement must
  cancel owned callbacks and release resources without damaging siblings.
- Verify actual first-person arm/weapon construction and each supported weapon;
  procedural and FBX geometry have different current roles.
</code_context>

<specifics>
## Specific Ideas

The user selected all three areas in order and chose the recommended option for
every presented question. Their explicit addition is the modern CoD-like split:
ordinary Shift sprint with both hands on the gun, followed by double-tap Shift
supersprint carrying the gun in one hand. Normal sprint reloads take 15% longer;
supersprint interrupts them. These are wanted behavior, not already-built claims.
</specifics>

<deferred>
## Deferred Ideas

- **Phase 5, requested behavior:** implement the two sprint levels and double-tap
  Shift supersprint, normal-sprint reload duration x1.15 and supersprint reload
  cancellation. Carry forward D-06/D-09 and the prepared Phase 7 poses. Choose
  actual speed, duration/stamina, double-tap/release behavior, mixed-stance reload
  timing and touch/gamepad mappings during Phase 5 discussion. Final alignment
  against actual omnimovement completes ANIM-01 there.
- Richer online weapon/equipment mechanics, broader cross-device and Pi
  qualification remain in their assigned later phases. Phase 7 animation must
  not masquerade as implemented or measured versions of those features.
</deferred>

---

*Phase: 07-movement-matched-and-action-safe-animation*
*Context gathered: 2026-10-05*
