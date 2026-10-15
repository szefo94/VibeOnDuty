---
phase: "7"
slug: "movement-matched-and-action-safe-animation"
status: approved
reviewed_at: "2026-10-05"
shadcn_initialized: false
preset: none
created: "2026-10-05"
---

# Phase 7 — UI Design Contract

Independent checker approval: six dimensions PASS, Visuals FLAG for the missing focal hierarchy. The moving character and weapon are the primary visual anchor; scenario/context follows, then playback controls, then status. This addition resolves the recommendation without changing the approved interaction contract.

Visual and interaction source of truth for ANIM-02–05. Locked choices are D-01–D-11 in 07-CONTEXT.md. This contract uses 07-RESEARCH.md, the Phase 7 roadmap boundary, inspected presentation sources and the accepted Phase 6 UI/art baseline. Values explicitly called defaults are design prescriptions within delegated discretion, not measured outcomes or new user answers.

## Design System

| Property | Value |
|----------|-------|
| Tool | none; existing plain HTML/CSS and JavaScript |
| Preset | not applicable |
| Component library | none; native buttons, labels, selects and range input |
| Icon library | none; text labels |
| Font | 'Courier New', monospace |

Evidence inspected 2026-10-05: package.json, index.html, style.css, src/graphicsQuality.js, src/builders/weapon.js, src/builders/weaponFBX.js, src/loop.js and 06-UI-SPEC.md. Repository file enumeration found style.css and no components.json, Tailwind or PostCSS configuration. The project uses Vite with plain JavaScript and no React UI package. The existing approved Phase 6 contract requires this stack and says not to initialize shadcn; carry that decision forward. The initialization gate is resolved by that upstream decision. Inventory provenance is not applicable to Tool none; no installed UI component package is claimed. Project skill directories are absent and configured agent_skills is empty.

Keep existing menus, HUD IDs, map/mode controls, V/F3 diagnostics, online Resume/Leave/Retry, death/killcam controls and graphics-quality ownership. Add only the bounded developer review surface specified below. Do not add a loadout editor, public animation menu, new playable movement mode or registry dependencies.

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline status gaps |
| sm | 8px | Labels, controls and adjacent buttons |
| md | 16px | Review panel padding and group gaps |
| lg | 24px | Separate review controls from evidence/status |
| xl | 32px | Reserved layout separation |
| 2xl | 48px | Reserved major separation |
| 3xl | 64px | Reserved page separation |

Source: approved 06-UI-SPEC.md, consistent with existing graphics controls. Apply to new controls only. Minimum control hit area is 44px high and 44px wide; this is an interactive-size exception, not a spacing token. Existing HUD geometry remains governed by style.css. Border/focus strokes are not spacing tokens.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body/help/status | 14px | 400 | 1.5 |
| Label/control | 16px | 700 | 1.5 |
| Heading | 20px | 700 | 1.2 |

Exactly three sizes and two weights for additions, inherited from Phase 6. Use sentence case and at most 1px letter spacing. Display is not applicable: this phase adds no hero/title treatment. Existing menu title, debug text and gameplay HUD sizes remain outside this addition.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #000000 | Existing surrounding backdrop and dark review field |
| Secondary (30%) | #111111 | Review panel, native controls and grouped surfaces |
| Accent (10%) | #e8c84a | Play transition button, selected review control border, review heading |
| Destructive | #e74c3c | Reserved; no new destructive action |
| Text | #dddddd | Labels, preview badges, help, status and errors |
| Focus | #ffffff | 3px outline with 4px offset |
| Border | #666666 | Neutral control/group boundary |

Source: style.css and approved Phase 6 contract. Accent is reserved for the three listed elements; secondary actions use neutral borders/text. Preview-only status must use text, not an accent color alone. The 60/30/10 balance applies to the review UI, not game-world paint, team colors or the viewport. Preserve Phase 6 skin, muted armor/fabric, M4 paint, black contours and designated blue/red accents; motion must not recolor unrelated material domains.

## First-Person and Full-Body Presentation

Source: D-01, D-02, D-05, D-07, D-08; RESEARCH Confirmed Gaps 1/4; inspected loop/weapon source. The current camera gun and first-person-hidden body are the baseline to replace, not evidence of delivered hands.

| Surface | Required visible result |
|---------|-------------------------|
| First-person weapon-ready | Both anatomically credible hands and forearms are visible with the equipped weapon. The firing hand holds its grip; support hand contacts the weapon-specific support region. Fingers do not pass through receiver, barrel or trigger guard. No floating gun or sleeve-only substitute. |
| Looking down | Torso, fitted equipment, thighs, knees and feet appear as the player's body. They follow actual stance, heading and displacement. The eye does not reveal inside the head/neck or open mesh cuts. The body does not disappear merely because V is off. |
| View handoff | V uses existing first/third-person behavior. Render one visible set of arms and one gun per view; no doubled limbs/guns, pose jumps, contour mismatch or duplicate shadows during handoff. Retain full skeletal hierarchy; hide/select render geometry without collapsing bone scales. |
| ADS | Raise/lower starts on the first presentation update of an eligible aim change. Default visual target: 120ms smooth monotonic transition, no overshoot or settle bounce. Firing eligibility, accuracy and existing FOV targets remain simulation-owned. Keep AWP's existing scope overlay and crosshair handoff. |
| Motion feel | Noticeable gun motion and restrained camera motion. Default cosmetic limits: added hip-fire weapon sway no more than 8mm translation and 1 degree rotation from ready; added camera bob no more than 4mm and 0.2 degrees. Added bob/sway settles to zero in ADS. These are starting visual bounds for moving review, not gameplay recoil tuning or certified anatomical tolerances. |
| Directional gait | Forward/backward/left/right/diagonal cadence follows actual displacement projected into body-local axes. Holding movement into a blocking wall does not play a travelling gait. Stops plant feet; reversals blend without teleporting feet or skating a stationary body. |
| Turns and aim | Small stationary aim changes lead with torso; larger changes visibly reposition feet. Enforce a finite authored torso-twist range in clip metadata and switch to a turn before that limit. Review both directions and pitch extremes for anatomical twist, shoulder clipping and sight alignment. Never write simulated yaw/pitch from pose correction. |
| Sprint | Current normal sprint lowers the weapon into a secure two-handed carry. Leaving sprint returns smoothly to the current legal ready/aim/action pose. Actual speed remains current simulation speed. |
| Crouch/jump/landing | Stance comes from simulation. Keep compact jumps, controlled limbs and secure weapon contact. Landing visibly compresses knees then recovers promptly; use existing simulation jump/contact windows, not animation completion to decide grounded state. |

Default non-action blend target: 160ms, shortened when required by the current authoritative phase. An interrupted/resumed visual action enters at its current simulation phase, never restarts an already elapsed action. Feet/contact tolerances and turn thresholds must be recorded with moving evidence before acceptance; numeric pose scores alone cannot establish a pass.

The view rig uses the accepted character appearance and a world-root body for down-look surfaces, sharing one normalized action phase. It may use a second mixer only with explicit ownership and measured cost. Render-only view offsets, IK and root translation cannot change collision, simulation eyes, projectile origin or aim. Restore temporary camera/visibility state even if rendering throws. Use prefix-aware loading and retain independently playable procedural fallbacks.

## Weapon Handling Contract

Source: D-02/D-03; src/config.js WEAPONS; src/builders/weapon.js; RESEARCH Confirmed Gap 2. Weapon mechanisms below are required authored presentation, not claims that existing unnamed meshes are already articulated.

| Weapon key / display | Grip and handling | Current reload window |
|----------------------|-------------------|-----------------------|
| m4 / M4A1 | Firing hand stays on pistol grip; support hand leaves fore-end for bottom magazine removal/insertion, then returns. Show charging/bolt handling where the authored reload calls for it; keep magazine distinct from receiver. | 1800ms offline and accepted online M4 |
| p90 / P90 | Both hands use the compact grip/support regions. Reload lifts/removes the top-feed magazine, seats its replacement on top and returns the support hand; do not reuse the M4 bottom-magazine path. Authored charging handling fits this weapon. | 2000ms offline |
| awp / AWP | Support hand stabilizes fore-end; firing hand operates the bolt during the visible firing cycle. Reload handles the detachable magazine and bolt in distinct phases. Fit bolt return into existing action/cadence windows; add no firing delay. | 2500ms offline |
| pistol / M9 | Two-handed ready grip with support around the firing hand. Reload visibly removes/inserts the grip magazine and handles the slide when the authored sequence requires it; no rifle fore-end grip or charging-handle path. | 1200ms offline |

Each handling definition has named moving parts, grip/support contact targets and normalized removal/insertion/bolt-or-slide/ready markers. During the designated manipulation phase a hand may leave support contact to reach its correct part; recontact is required before ready. Do not fake reload by rotating the whole weapon. Do not drop magazines into accumulating world debris. Disposable handling props are bounded to one replacement magazine per actor action and retire on completion/interruption.

Review loaded P90 FBX and procedural fallback separately; the current FBX replacement path affects first-person P90 only. Adapt/select render geometry without moving or disposing shared weapon templates. Preserve accepted silhouettes and Phase 6 M4 surfaces. Gameplay reload duration, magazine capacity, reserve and ammo award stay owned by gameplay; visual insertion or mixer-finished events cannot award ammunition.

## Action, Authority and Death Contract

Source: D-09–D-11; RESEARCH Confirmed Gaps 3/5/6; existing protocol and generation ownership.

| State / transition | Contract |
|--------------------|----------|
| Ready / fire / ADS | Supported fire animates recoil/parts while maintaining credible grip and returning to ready. Added cosmetic recoil cannot change aim, hit or shot eligibility. ADS remains steady after settling. |
| Reload | Fit full physical handling to gameplay remaining/total time in both views. Maintain locomotion under permitted upper-body handling; do not freeze feet while the simulated actor moves. A denied reload stays ready. |
| Supported melee or grenade entry | Take priority immediately over ADS/reload; cancel the reload award and owned pending work at gameplay entry, suppress held-ADS re-entry during the exclusive action, animate once, then return to legal weapon-ready. Do not queue a delayed attack behind a reload. |
| Grenade release | Preserve current 0.9s action with once-only release at 45% of its simulation window. Show prop ownership transferring at release; cancellation before release removes the held prop and future release. Visual markers cannot spawn grenades or damage. |
| Interruption | Death, menu return, respawn, replacement and session/life/match retirement invalidate pending melee/release/reload callbacks and visible phase props. Canceled reload awards no ammo, including at the deadline. No duplicate action completion or invisible continuing throw. |
| Damage | Default restrained cosmetic upper-body response. Keep ADS sights steady, preserve authoritative health/aim and existing hit feedback. No new camera kick, forced aim turn or repeated reaction from a stale confirmation. |
| Death | Health/life eligibility and score update immediately. Default collapse uses existing DEATH_DUR = 0.65s, then holds a stable settled pose until normal removal/respawn. No full physics ragdoll or root drift through the floor. Interrupt other actions immediately. Preserve existing death/killcam and online timer/Resume controls. |
| Directional death | Use server-owned lethal travel direction if the planner adds a bounded current-life cosmetic cue for every observer. Otherwise use a deterministic collapse relative to authoritative body heading; label fallback in developer diagnostics. Never infer impact from the killer's later location or shooter-private feedback. |
| Remote actors | Consume replicated stance, aim, sprint, vertical motion, reload time and generation; derive cadence from snapshot displacement. Reset history on teleport/spawn/generation changes. Cosmetic shot/death cues require trusted evidence; missing cues use documented quiet ready/death fallback, not fabricated attacks. |

Current online UI/support stays an M4 TDM slice. No online P90/AWP/M9, melee, grenade or new movement intention is authorized by a clip. An unavailable action is absent/disabled with explanatory text in developer controls; the live online controls remain unchanged. A minimal trusted cosmetic cue can describe presentation only and cannot grant actions or alter health, ammo, movement or score.

## Future Movement Preview Boundary

Source: D-06/D-09 and roadmap Phase 7/5 split.

Supersprint, slide, dive and prone candidates and their entry/exit transitions are inspectable on an isolated review actor. Supersprint shows the distinct one-handed carry. Include a normal-sprint reload timing comparison with duration exactly base × 1.15, and a supersprint interruption comparison that cancels the visual reload and enters one-handed carry. These comparisons are synthetic previews: no ammo awards, inputs, velocity, stamina, projectiles, collider changes or server commands.

Every future scenario option and its persistent status begins with **Preview —** and names Phase 5 ownership. No double-tap Shift binding is added here. Phase 5 implements Shift normal sprint/double-tap supersprint, actual speed/input/stamina rules, reload ×1.15/cancellation and final ANIM-01 integration. Existing offline movement behavior remains the baseline; its presence cannot qualify future authoritative omnimovement.

## Quality, Reduced Motion and Existing Controls

Source: accepted Phase 6 UI contract, graphicsQuality.js and D-01/D-04. Retain the one persisted graphics preference and existing synchronized menu/pause selects: Low DPR cap 1/no extra hull pass/shadows off; Medium cap 1.5/current shadows/actor-weapon ink; High cap 2/selected environment ink. Painted maps, first-person hands/body, contact/action phases and required posture are present on every tier. Do not make Low omit required limbs, reload parts or remote state.

Default accessibility behavior: honor prefers-reduced-motion for added presentation and review controls. Set added cosmetic camera bob/roll, idle sway/breathing and damage flinch to zero; keep readable physical reload, fire, stance and death state transitions driven by the same deadlines. Keep monotonic ADS raise/lower without bounce. This preference changes no gameplay timings, existing authoritative recoil, aim or eligibility. Do not automatically play preview motion on open. Review Play/Pause and phase scrub remain available; do not hide essential state information in animation.

Keep graphics quality out of the live HUD. Preserve online match controls above the bottom ammo band and the existing desktop pause location right of match controls. Review controls cannot intercept Resume/Leave or acquire pointer lock while selecting/editing. No new gameplay-device mapping is implied; Phase 5 owns new input mapping and later phases own device qualification.

## Developer Animation Review Surface

This is a development-only extension of existing F3 diagnostics, available while offline Training Range is loaded. It is hidden by default and absent from production/public menu controls. Add a native **Open animation review** button inside the developer diagnostic area; keep F3 diagnostics and console observation helpers usable. Disable opening during an online session and during death/killcam, with the documented reason. No review action sends network intentions.

Opening is explicit: release mouse capture, neutralize gameplay input, suspend only the offline review context and create at most one isolated actor with one view-rig pair. Do not pause an online match. Render the accepted actual-game scene/assets; supply a preview clock independent of gameplay outcomes. A temporary review camera renders the chosen view and always restores the simulation camera. Closing removes that actor/rig/props, restores the offline context and returns focus; resuming mouse capture requires the existing explicit Resume gesture.

| Control | Behavior |
|---------|----------|
| Heading and context | Animation review; persistent text identifies Clip preview, weapon, view, tier, scenario and source/export identity. Human acceptance is recorded separately. |
| Weapon select | Four fixed options M4A1, P90, AWP, M9 from WEAPONS; does not equip or change ammo on the live player. |
| View select | First person; Looking down; Third person. Looking down shows the same body's torso/legs without exposing head interior. No additional camera app is needed. |
| Transition select | Sixteen manifest-bounded scenarios: Ready; Directional locomotion; Normal sprint; Crouch; Jump and landing; ADS and fire; Reload; Reload to melee; Reload to grenade; Damage; Directional death; Preview — supersprint; Preview — slide; Preview — dive; Preview — prone; Preview — sprint reload rules. Future labels retain their prefix in status. |
| Play transition | Plays the selected sequence once at 1×; button is enabled only after required assets/manifest settle. Never autoplays. Replaying resets preview-only phase/props. |
| Pause transition | Holds preview time; does not change simulation deadlines. Text becomes Resume transition while paused. |
| Phase slider | Native 0–100% range, step 1, labeled Animation phase; enabled only while paused. Readout gives percent. Scrubbing changes pose/prop selection only and cannot replay release/gameplay callbacks. |
| Reset preview | Restores ready pose, phase zero and preview-only temporary props; reversible and immediate. |
| Close review | Cancels playback/loading work, retires owned resources and returns focus to the diagnostic opener. Escape has the same effect while this surface owns focus. |
| Status | Text-only load/readiness/failure/fallback/preview ownership and current action phase; update live announcements on state changes, not every frame. |

Do not add a second Graphics quality owner. Use existing pause select to change tier between review passes; closing/reopening the review must adopt the current tier. Defaults: M4A1, Third person, Ready, stopped at phase zero. Future motion candidates missing from the manifest remain disabled with their reason; do not substitute an unrelated inherited clip and call it approved.

Layout default: fixed right-side panel at 16px inset, width min(360px, viewport minus 32px), maximum height viewport minus 32px, 16px padding, vertical scrolling. At widths below 768px use a full-width bottom panel with 16px margins and maximum 50vh height. Controls stack, paired buttons wrap with 8px gaps; all labels/status wrap. The developer preview may reserve this panel space, but actual-game moving evidence must include unobscured full pixels with panel hidden. No preview panel is allowed over live online controls.

Use a named nonmodal region, associated native labels and aria-describedby support text. Tab order follows document order; Enter/Space operate buttons, arrow keys operate selects/range. Preview-control key/pointer/wheel events cannot reach gameplay capture handlers. Escape closes only the current review owner. Focus is visible, status uses role=status/aria-live=polite, and failure text links its recovery button through aria-describedby. Disabled controls include a visible reason; state is never communicated only by color. No canvas-only action or tooltip-only recovery.

## Copywriting Contract

Existing game copy stays verbatim; new review copy is a default grounded in the locked scope and current asset/online recovery patterns. Braced fields render bounded manifest values through text content.

| Element | Copy |
|---------|------|
| Developer opener | Open animation review |
| Primary CTA | Play transition |
| Secondary controls | Pause transition; Resume transition; Reset preview; Close review; Retry preview |
| Heading | Animation review |
| Preview context | Clip preview. Gameplay outcomes are unchanged. |
| Ready status | Ready: {weapon} · {view} · {scenario}. |
| Loading | Loading animation preview… |
| Empty state heading | Animation preview unavailable |
| Empty state body | No compatible motion is available for this selection. Choose another transition or close review to keep playing. |
| Asset error | Animation preview could not load. Select Retry preview, or close review to keep playing. |
| Partial fallback | Using fallback weapon geometry. Detailed handling for {weapon} is unavailable. |
| Missing candidate | This motion candidate has not been exported. Choose another transition. |
| Online unavailable | Animation review is available in offline Training Range. Leave online before opening review. |
| Death/killcam unavailable | Finish the current death view before opening animation review. |
| Future state status | Preview — {supersprint/slide/dive/prone}. Gameplay integration belongs to Phase 5. |
| Future timing comparison | Preview — normal sprint reload: base duration × 1.15. Supersprint cancels reload. Gameplay timing belongs to Phase 5. |
| Unavailable online action | This action is unavailable in the current online M4 slice. |
| Death direction fallback | Death direction unavailable. Showing the body-heading fallback. |
| Reduced motion | Reduced motion active. Added camera bob and cosmetic sway are disabled. |
| Review exit | Review closed. Select Resume to capture the mouse and continue. |
| Existing asset recovery | Preserve index.html character asset/fallback copy and existing start-button gating. |
| Existing capture failure | Preserve onlineUi.js mouse-capture failure copy and separate connection-error recovery. |
| Destructive confirmation | Not applicable: no new delete, publish, overwrite, or destructive review action. Reset preview affects only temporary preview state. |

Show one recoverable failure per load attempt, not a per-frame toast. Retry preview reloads only the local manifest-approved asset/selection and is idempotent; never fetch user-supplied URLs or execute pasted code. Existing fallback play stays reachable. The browser surface cannot publish assets or mark human aesthetic acceptance.

## UI Considerations

Engine run after independent approval; internal automatic hook resolution uses the existing locked state contract. Authored media-kind override repairs the prose classifier miss. All 28 surfaced considerations are retained below; these are implementation predicates, not executed results.

| Element | Category | Status | Verification | Resolution |
|---|---|---|---|---|
| review-controls | empty | resolved | explicit | Missing compatible motion disables Play, preserves selections and Close, and uses the empty copy. |
| review-controls | loading | resolved | explicit | Until the current load settles Play/Pause/scrub are disabled; Close remains reachable and superseded requests retire. |
| review-controls | error | resolved | explicit | Failed preview shows the specified recovery copy and Retry; canceled or stale results cannot install actors or steal focus. |
| review-controls | partial | resolved | explicit | Fallback geometry stays visible with partial status; unavailable detailed handling options are disabled and never count as contact passes. |
| review-controls | long-text | resolved | explicit | Help, errors and identifiers wrap without ellipsis hiding preview labels, identity or recovery. |
| review-transition-options | empty | resolved | explicit | Missing compatible motion disables Play, preserves selections and Close, and uses the empty copy. |
| review-transition-options | loading | resolved | explicit | Until the current load settles Play/Pause/scrub are disabled; Close remains reachable and superseded requests retire. |
| review-transition-options | error | resolved | explicit | Failed preview shows the specified recovery copy and Retry; canceled or stale results cannot install actors or steal focus. |
| review-transition-options | populated | resolved | explicit | Exactly one isolated actor, selected weapon, current scenario and view are visible with ready status and phase. |
| review-transition-options | partial | resolved | explicit | Fallback geometry stays visible with partial status; unavailable detailed handling options are disabled and never count as contact passes. |
| review-transition-options | overflow | resolved | explicit | Bounded native options, vertical panel scroll, wrapping controls and source identifiers never widen the viewport. |
| review-transition-options | zero-one-many | resolved | explicit | Zero compatible scenarios disables Play; one uses the same select; many expose disabled reasons for missing candidates. |
| review-media | empty | resolved | explicit | Missing compatible motion disables Play, preserves selections and Close, and uses the empty copy. |
| review-media | loading | resolved | explicit | Until the current load settles Play/Pause/scrub are disabled; Close remains reachable and superseded requests retire. |
| review-media | error | resolved | explicit | Failed preview shows the specified recovery copy and Retry; canceled or stale results cannot install actors or steal focus. |
| review-media | populated | resolved | explicit | Exactly one isolated actor, selected weapon, current scenario and view are visible with ready status and phase. |
| review-status | overflow | resolved | explicit | Bounded native options, vertical panel scroll, wrapping controls and source identifiers never widen the viewport. |
| review-status | long-text | resolved | explicit | Help, errors and identifiers wrap without ellipsis hiding preview labels, identity or recovery. |
| review-help | overflow | resolved | explicit | Bounded native options, vertical panel scroll, wrapping controls and source identifiers never widen the viewport. |
| review-help | long-text | resolved | explicit | Help, errors and identifiers wrap without ellipsis hiding preview labels, identity or recovery. |
| review-opener | loading | resolved | explicit | Until the current load settles Play/Pause/scrub are disabled; Close remains reachable and superseded requests retire. |
| review-opener | error | resolved | explicit | Failed preview shows the specified recovery copy and Retry; canceled or stale results cannot install actors or steal focus. |
| review-opener | long-text | resolved | explicit | Help, errors and identifiers wrap without ellipsis hiding preview labels, identity or recovery. |
| existing-quality-controls | empty | resolved | explicit | Missing compatible motion disables Play, preserves selections and Close, and uses the empty copy. |
| existing-quality-controls | loading | resolved | explicit | Until the current load settles Play/Pause/scrub are disabled; Close remains reachable and superseded requests retire. |
| existing-quality-controls | error | resolved | explicit | Failed preview shows the specified recovery copy and Retry; canceled or stale results cannot install actors or steal focus. |
| existing-quality-controls | partial | resolved | explicit | Fallback geometry stays visible with partial status; unavailable detailed handling options are disabled and never count as contact passes. |
| existing-quality-controls | long-text | resolved | explicit | Help, errors and identifiers wrap without ellipsis hiding preview labels, identity or recovery. |

## Resource Ownership and Recovery

One named review owner owns panel listeners, request/selection generation, playback clock, temporary actor/view rigs, skeleton resources, mixer bindings, props and diagnostics. Close, retry, selection change, mode exit and teardown invalidate prior asynchronous work before accepting replacement results. Cleanup is idempotent and detaches borrowed singleton weapons before disposing a clone. Existing characterResources.js remains the character disposal authority.

Each spawned gameplay/remote actor owns its view/instance state by connection, match and life generation. Shared template geometry, packed maps and immutable clip buffers survive retirement. Dispose actor-owned material/ink clones, skeleton textures, listeners, caches and callbacks once. No background mixer or retained panel loop runs after close. Keep a live sibling and verify a subsequent clone after repeated retirement. Review UI cannot edit accepted source files or cached exports; Blender candidate generation/reopen/regenerate/publish/recovery remains the documented offline workflow.

On unsupported/malformed manifest state, keep fallback play and show the documented recovery text. On load races, silently retire superseded results. On renderer failure restore camera/visibility state in finally and retire the affected preview on close. Respawn/rematch never inherits a prior dead pose, detached magazine or delayed action. Source/export identity changes require a fresh load and moving review.

## Actual-Game Moving Review and Acceptance

Source: all D decisions, ANIM-02–05 and RESEARCH Human and cost review. Phase 6's canonical 06-UAT.md records two accepted human passes; historical pending wording does not reopen that baseline. Phase 7 needs its own human motion acceptance.

Review actual moving gameplay in first person, looking down and third person at Low/Medium/High. Cover all four supported offline weapons, loaded/fallback P90, near hands, body pitch extremes, daylight/shadow, blue/red accents and these transitions: idle/directional/blocked movement; turns/stops/reversals; sprint-ready-ADS; crouch; takeoff/air/contact/recovery; physical reload; firing/bolt/slide return; supported melee/grenade interruption before/at/after reload completion; damage/death; respawn/menu return. Use two real online clients for supported M4 remote stance/aim/reload/death/generation observations. Preview unsupported actions only on the isolated review actor and retain the preview/Phase 5 labels in evidence.

Record continuous transition playback or actual-game video/full-pixel frame sequences, not just isolated posed screenshots. The human must inspect gripping/manipulation, silhouette/body continuity, foot contact, camera comfort, ADS settle and death stability. Reject visible grip separation outside authored release phases, foot skating at rest, clipping/doubled anatomy, snapping, ADS bounce, unintended overlaps or stale props/actions. Pose metrics and an agent's judgment cannot record human aesthetic acceptance.

Demonstrate one approved reusable motion imported/retargeted from retained editable source, regenerated into runtime clips, reviewed moving in-game, then restored/reopened and independently regenerated. Keep asset-specific provenance separate from unresolved inherited rig/motion/weapon terms; new motion and accepted Phase 6 art confer no combined license clearance. The browser review remains inspection-only.

Record actual review device, OS/browser, renderer, viewport/DPR/tier, source/export identities, active actor count, warmed median/p95 frame time, animation/mixer/correction cost and geometry/texture/program trends. Compare current baseline and candidate under the same conditions, including multiple actual actors and repeated spawn/replacement/retirement. Set the browser resource budget from that measured baseline in the execution evidence; do not invent universal limits, a 60 FPS pass, phone/iGPU/Pi qualification or certification from SwiftShader. Run relevant execution gates and human review through the planner; this planning artifact reports no executed suite or measured acceptance.

## Registry Safety

Not applicable: Tool none, no shadcn initialization and no third-party UI registry/block. No registry inclusion or unverified package execution is required. Retained motion/weapon assets remain governed by their source/provenance and ownership contracts.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: FLAG; focal hierarchy recommendation incorporated
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** independent checker APPROVED on 2026-10-05 (six PASS, one nonblocking FLAG). Design approval is separate from implementation checks, motion provenance and actual human moving-review acceptance.
