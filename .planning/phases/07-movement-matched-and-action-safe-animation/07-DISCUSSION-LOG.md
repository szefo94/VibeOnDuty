# Phase 7: Movement-Matched and Action-Safe Animation - Discussion Log

> **Audit trail only.** Planning/research/execution consume 07-CONTEXT.md; this log preserves alternatives and actual responses.

**Date:** 2026-10-05T15:20:26.810Z
**Phase:** 07-movement-matched-and-action-safe-animation
**Areas discussed:** Weapon handling and camera feel, Full-body movement, Action interactions

---

## Weapon handling and camera feel

### How much should the gun and camera move during running, aiming and firing?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Controlled and responsive (recommended) — noticeable weapon motion, restrained camera bob, steady ADS. | ✓ |
| 2 | Minimal motion — very little bob or sway; prioritize a stable view. |  |
| 3 | Strong physical motion — heavier sway, bob and landing jolts. |  |
| 4 | Specify your own preference. |  |

**User's choice (verbatim):** Controlled and responsive — noticeable weapon motion, restrained camera bob, steady ADS.

### In first person, how much of the soldier should be visible?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Arms, hands, and body when looking down (recommended) — animated weapon handling plus visible torso/legs. | ✓ |
| 2 | Arms and hands only — animated handling without a visible torso/legs. |  |
| 3 | Weapon only — keep the first-person presentation simple. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Arms, hands, and body when looking down (recommended)

### How should reloads look?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Clear physical handling (recommended) — remove/insert the magazine and operate the bolt where appropriate, fitting the gameplay reload time. | ✓ |
| 2 | Simplified handling — fewer hand movements and a quick, readable magazine swap. |  |
| 3 | Expressive handling — more flourish and exaggerated weapon movement. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** recommended

**Resolved selection:** Clear physical handling — remove/insert the magazine and operate the bolt where appropriate, fitting the gameplay reload time.

### How should entering and leaving ADS feel?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Fast and smooth (recommended) — immediate response, a short transition, and sights settling without bounce. | ✓ |
| 2 | Almost instant — minimal transition between hip fire and aiming. |  |
| 3 | Heavier and slower — a more deliberate raise/lower motion. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Fast and smooth (recommended)

## Full-body movement

### How should the soldier look when changing direction or stopping?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Quick and planted (recommended) — responsive turns/stops, subtle body lean, feet matching movement speed. | ✓ |
| 2 | Heavier and weighted — stronger lean and more visible settling after turns/stops. |  |
| 3 | Light and agile — minimal lean and brief transitions. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Quick and planted (recommended)

### How should the soldier carry the gun while sprinting?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Lowered, two-handed (recommended) — gun angled down, both hands maintaining control. | ✓ |
| 2 | Upright, one-handed — gun raised beside the shoulder, free arm moving with the run. |  |
| 3 | Close to the chest — compact two-handed carry with elbows tucked in. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Lowered, two-handed (recommended)

**Notes:** User adds two levels: Shift normal sprint retains both hands; double-tap Shift requests supersprint with one-handed gun carry. Phase 7 prepares/reviews both poses and transitions; Phase 5 implements the actual input and movement state. Supersprint speed, duration/cancellation and non-keyboard mapping remain Phase 5 decisions.

**User clarification (verbatim):** to the last question about carry while sprinting, can you add one sprint level when just shifting when gun is carried by both hands and then double shift key makes character supersprint and then gun is held in one hand like in modern cods?

### How should jumps and landings look?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Compact and controlled (recommended) — gun stays secure, knees absorb the landing, then the soldier recovers quickly. | ✓ |
| 2 | More athletic — stronger leg lift and deeper landing compression. |  |
| 3 | Subtle — small body movements and a light landing response. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Compact and controlled (recommended)

### When aiming sideways while standing, how should the body turn?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Torso leads, feet follow (recommended) — small aim changes turn the upper body; larger turns trigger foot repositioning. | ✓ |
| 2 | Whole body turns together — feet and torso rotate together. |  |
| 3 | Feet stay planted longer — allow more upper-body twist before repositioning. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Torso leads, feet follow (recommended)

## Action interactions

### How should sprinting interact with reloading?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Normal sprint allows reload; supersprint cancels it (recommended) — two-handed handling remains possible during normal sprint; supersprint switches to the one-handed pose. | ✓ |
| 2 | Both sprint levels cancel reload — sprinting always interrupts weapon handling. |  |
| 3 | Reload takes priority — finish or cancel the reload before either sprint level starts. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** recommended, but normal sprint makes it slightly longer

**Resolved selection:** Normal sprint allows reload; supersprint cancels it.

**Notes:** User adds a longer normal-sprint reload. New movement-dependent gameplay rules belong to Phase 5; Phase 7 prepares their animation timing/transitions.

### How much longer should reloading take during normal sprint?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 15% longer (recommended) — a small, noticeable penalty. | ✓ |
| 2 | 10% longer — a lighter penalty. |  |
| 3 | 25% longer — a stronger tradeoff. |  |
| 4 | Specify your preferred amount. |  |

**User's choice (verbatim):** recommend3ed

**Resolved selection:** 15% longer (recommended)

**Notes:** The response was interpreted as a typo for recommended, not choice 3. The next prompt explicitly confirmed 15% longer, with no correction. Record duration x1.15.

### How should melee and grenade throws interact with ADS or reloads?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Take priority immediately (recommended) — leave ADS, cancel the reload, perform the action, then return to weapon-ready. | ✓ |
| 2 | Wait for the reload — finish reloading before starting melee or a throw. |  |
| 3 | Queue the action — remember the input and perform it when the current action finishes. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** Take priority immediately (recommended)

### How should deaths look?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Controlled directional collapse (recommended) — a short animated fall responding to hit direction, then settling into a stable pose. | ✓ |
| 2 | Physics ragdoll — the body reacts dynamically to the ground and surrounding geometry. |  |
| 3 | Simple fixed collapse — one consistent, brief death animation. |  |
| 4 | Specify your preference. |  |

**User's choice (verbatim):** recommended

**Resolved selection:** Controlled directional collapse

## Implementation Discretion

No blanket Phase 7 autonomy was inferred from the Phase 6-only delegation. Technical mechanisms, qualified source selection and restrained cosmetic damage-reaction proposals remain research/planning choices within the confirmed behavior.

## Deferred Ideas

- Phase 5: implement two sprint levels requested by the user: Shift normal sprint with two-handed carry; double-tap Shift supersprint with one-handed carry. Phase 7 prepares inspectable poses/transitions only; actual movement and final ANIM-01 acceptance remain in Phase 5. Also carry normal-sprint reload duration x1.15 and supersprint reload cancellation into Phase 5.
