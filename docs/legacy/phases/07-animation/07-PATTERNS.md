# Phase 7: Movement-Matched and Action-Safe Animation - Pattern Map

**Mapped:** 2026-10-05
**Scope:** 07-CONTEXT.md, 07-RESEARCH.md and approved 07-UI-SPEC.md.
**Files analyzed:** 35 proposed new/modified paths (names for new files are recommendations).
**Primary analog families:** 5; supporting integration excerpts below.

## File Classification

New paths below are inferred implementation boundaries, not locked names. Existing files listed are potential change owners; the planner should omit conditional changes when choosing deterministic fallbacks. Canonical references alone do not imply an edit.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/builders/animationPresentation.js` (new) | utility | transform | `src/network/remoteActors.js` | flow-match |
| `src/builders/animationPresentation.test.js` (new) | test | transform | `src/network/remoteActors.test.js` | role-match |
| `src/entities/actionLifecycle.js` (new) | service | event-driven | `src/entities/grenades.js` | role-match |
| `src/entities/actionLifecycle.test.js` (new) | test | event-driven | `src/builders/enemyAnimations.test.js` | role-match |
| `src/builders/firstPersonRig.js` (new) | component | transform | `src/builders/characterResources.js` | partial |
| `src/builders/weaponHandling.js` (new) | utility/config | transform | `src/builders/weapon3pTransform.js` | role-match |
| `src/builders/enemyAnimations.js` | utility | transform | same file | exact |
| `src/builders/enemyGLTF.js` | component | file-I/O/transform | `src/builders/characterResources.js` | partial |
| `src/builders/rifleClips.js` | utility | transform | `src/builders/enemyAnimations.js` | role-match |
| `src/builders/characterResources.js` | service | event-driven | same file | exact |
| `src/builders/weapon.js` | component | transform | same file | exact |
| `src/builders/weaponFBX.js` | component | file-I/O | `src/builders/weapon.js` | role-match |
| `src/loop.js` | controller | batch/transform | same file | exact |
| `src/entities/player.js` | model/controller | event-driven | `src/entities/grenades.js` | flow-match |
| `src/entities/grenades.js` | service | event-driven | same file | exact |
| `src/entities/enemyUpdate.js` | controller | batch | `src/network/remoteActors.js` | partial |
| `src/main.js` | controller | event-driven | `src/entities/grenades.js` | flow-match |
| `src/network/remoteActors.js` | service | streaming/transform | same file | exact |
| `src/network/remoteActors.test.js` | test | streaming | same file | exact |
| `src/network/onlineSession.js` | controller | streaming/event-driven | `src/network/remoteActors.js` | flow-match |
| `src/shared/combat.js` (conditional cue) | service | batch/event-driven | `src/network/remoteActors.js` | partial |
| `server/tdmRoom.js` (conditional cue) | model/controller | pub-sub | none for new cue | none |
| `src/dev/animationReview.js` (new) | component/controller | event-driven | `src/network/remoteActors.js` | ownership-match |
| `index.html` | component | event-driven | none for new review region | none |
| `style.css` | config | transform | none for new review layout | none |
| `tools/art/build_motion.py` (new) | utility | file-I/O/batch | `tools/art/pipeline.mjs` | flow-match |
| `tools/art/motion-manifest.json` (new) | config | file-I/O | none for motion schema | none |
| `tools/art/sources/motion.blend` (new) | model | file-I/O | none for original donor actions | none |
| `tools/art/pipeline.mjs` | service | file-I/O/batch | same file | exact |
| `tools/art/inspect-character.mjs` | utility | transform/validation | `tools/art/pipeline.mjs` | flow-match |
| `tools/art/verify-export.mjs` | test/utility | file-I/O/batch | `tools/art/pipeline.mjs` | flow-match |
| `tools/art/review.mjs` | controller | batch/file-I/O | `tools/art/pipeline.mjs` | role-match |
| `tests/animation-regressions.spec.js` | test | batch | same file | exact |
| `tests/character-art.spec.js` | test | batch | `tests/animation-regressions.spec.js` | role-match |
| `tests/multiplayer.spec.js` | test | streaming/batch | `tests/animation-regressions.spec.js` | role-match |

Documentation/provenance outputs should accompany execution: `docs/ART.md`, `tools/README.md`, `tools/art/provenance.json`, phase evidence and the deliberately regenerated `public/models/enemy.glb`. They are documentation/generated deliverables, not additional runtime analogs. Retain accepted soldier mesh/material sources; a separate motion donor is preferable to silently replacing them. `src/shared/protocol.js` remains the existing exact-intent boundary; unsupported actions must stay rejected.

## Pattern Assignments

### Presentation normalization and adapters

**Apply to:** animationPresentation and its test, enemyAnimations, rifleClips, loop, enemyUpdate, remoteActors and its test, onlineSession.
**Primary analog:** `src/network/remoteActors.js`.

Imports are explicit relative ESM with named presentation helpers (lines 2–10); checked multiplayer files retain JSDoc boundaries rather than importing server runtime into browser code.

```js
import { PLAYER_H, PLAYER_H_CROUCH, JUMP_START_DUR, JUMP_LAND_DUR } from '../config.js';
import {
  enterLocoMode,
  exitLocoMode,
  setLocoWeights,
  crossfade,
  tickInertia,
  fitActionDuration,
} from '../builders/enemyAnimations.js';
```

Actual snapshot displacement pattern, lines 59–67:

```js
const tick = snapshot.currentTick ?? 0;
if (tick !== actor.previousTick) {
  const seconds = actor.previousTick === undefined ? 0 : (tick - actor.previousTick) / 30;
  actor.velocityX = seconds > 0 ? (p.x - (actor.previousX ?? p.x)) / seconds : 0;
  actor.velocityZ = seconds > 0 ? (p.z - (actor.previousZ ?? p.z)) / seconds : 0;
  actor.previousX = p.x;
  actor.previousZ = p.z;
  actor.previousTick = tick;
}
```

Copy the measured-displacement seam, then extend it with bounded actor-local forward/right velocity and spawn/teleport/history invalidation. The existing hard-coded speed normalization is a baseline, not the final cadence policy. Pure normalization must avoid scene/DOM singleton imports. Local, bot and remote adapters supply the same normalized contract while retaining their authority owners.

Phase recovery pattern, remoteActors lines 152–156:

```js
fitActionDuration(actions.reload, 1.8);
if (changed)
  actions.reload.time =
    actions.reload.getClip().duration * Math.max(0, 1 - p.reloadRemaining / 1.8);
```

Use authoritative remaining duration rather than replaying a reload on receipt. Keep online M4 at 1800ms. New x1.15/supersprint rules remain synthetic Phase 5 previews.

Mixer ordering, remoteActors lines 172–173:

```js
actor.mixer?.update(dt);
tickInertia(actor, dt);
```

Action identity safety, `src/builders/enemyAnimations.js` lines 181–184:

```js
const locoActions = new Set([...LOCO_CLIPS].map(k => e.actions[k]));
for (const [key, action] of Object.entries(e.actions)) {
  if (!key.startsWith('_') && !locoActions.has(action)) action.stop();
}
```

Deduplicate aliases by action identity. Preserve base contributions when adding masks. Duration fitting, same file lines 219–221:

```js
export function fitActionDuration(action, seconds) {
  if (action && seconds > 0) action.setEffectiveTimeScale(action.getClip().duration / seconds);
}
```

### Action cancellation and exactly-once gameplay markers

**Apply to:** actionLifecycle and its test, player, grenades, main, animation presentation.
**Primary analog:** `src/entities/grenades.js`.

Explicit cancellation and synchronous event subscription, lines 31–37:

```js
export function cancelGrenadeThrow() {
  pendingThrow = false;
  player.throwingNade = false;
  player.throwTimer = 0;
}
on('player:died', cancelGrenadeThrow);
on('snd:configure', cancelGrenadeThrow);
```

Simulation-driven release, lines 57–65:

```js
export function tickGrenades(dt) {
  if (player.throwingNade) {
    player.throwTimer = Math.max(0, player.throwTimer - dt);
    if (pendingThrow && player.throwTimer <= GRENADE_THROW_DUR * (1 - GRENADE_RELEASE_FRACTION)) {
      pendingThrow = false;
      releaseGrenade();
    }
    if (player.throwTimer === 0) player.throwingNade = false;
  }
```

This is a partial excerpt; preserve the rest of projectile ticking. Copy ownership/once-only marker semantics, extending cancellation to reload/ADS and owned melee callbacks. Before/at/after deadline ordering must be defined in the pure policy. Preview scrub must never invoke this gameplay release.

Critical authority guard seam, `src/entities/player.js` lines 289–297:

```js
if (player.reloading) {
  player.reloadTimer -= dt * 1000;
  document.getElementById('reloadbar').style.width =
    (1 - player.reloadTimer / player.reloadTotal) * 100 + '%';
  if (player.reloadTimer <= 0) {
    const take = Math.min(WEAPONS[player.weapon].maxAmmo - player.ammo, player.reserve);
    player.ammo += take;
    player.reserve -= take;
    player.reloading = false;
```

Keep ammunition awards behind simulation eligibility; canceled reload clears that eligibility immediately. Timer units differ: reload milliseconds, throw seconds. Online unsupported melee/throw must remain unavailable.

### First-person/view rig and articulated weapon handling

**Apply to:** firstPersonRig, weaponHandling, weapon, weaponFBX, enemyGLTF, loop and characterResources.
**Analogs:** disposal family below plus existing camera gun and mount basis. No complete first-person skeletal or articulated handling implementation exists.

Camera gun ownership, `src/builders/weapon.js` lines 16–18:

```js
export const wpn = new THREE.Group();
wpn.position.set(0.11, -0.105, -0.2);
camera.add(wpn);
```

The current group is a singleton. Clone or explicitly detach borrowed objects before retiring view instances. Maintain one visible gun/arm pair; looking-down torso/legs and first-person hands share one action-phase owner. Preserve full skeleton hierarchy and accepted materials, and use view-specific geometry selection rather than scaling bones to hide surfaces.

Verified hand basis, `src/builders/weapon3pTransform.js` lines 11, 17 and 26:

```js
export const WEAPON3P_ROT = new THREE.Euler(Math.PI / 2, 0, 0);
export const WEAPON3P_GRIP = new THREE.Vector3(-0.015, 0.015, 0.025);
export const WEAPON3P_BARREL_SHIFT = { m4: -0.10, p90: -0.06, awp: -0.14, pistol: -0.03 };
```

Use this basis for receiver/grip/support socket coordinates. Add named per-weapon magazine/bolt/slide parts; the constants alone do not establish physical handling. P90 top feed, M4 magazine/charging handle, AWP bolt and pistol slide need separate phase/contact data. FBX replacement must reconstruct/validate handling metadata and honestly retain fallback status.

Existing visibility seam, `src/loop.js` lines 268–275:

```js
const bodyVisible = tpTransition > 0.05;
wpn3p.visible = !player.throwingNade && !player.punching && !player.dancing;
if (!player.dead) wpn.visible = tpTransition < 0.15;
if (playerMesh) {
  playerMesh.visible = bodyVisible;
  playerBody.visible = false;
```

Replace this limitation through explicit view ownership, not competing visibility writes. Existing camera save/render/restore locations are loop lines 291–293, 319 and 345; the new review/view path must restore camera and visibility in `finally` even if rendering fails.

### Isolated review, generation guards and resource lifetime

**Apply to:** animationReview, index.html, style.css, firstPersonRig, characterResources, remoteActors, onlineSession and browser resource tests.
**Primary analogs:** `src/network/remoteActors.js` and `src/builders/characterResources.js`.

Injected builders and explicit owner, remoteActors lines 14–17:

```js
/** Explicit owner; injected builders keep resource tests independent of browser singletons.
 * @param {{add:(mesh:any)=>void}} scene @param {Builders} builders */
export function createRemoteActors(scene, builders) {
  /** @type {Map<string,Actor>} */ const actors = new Map();
```

Generation retirement, lines 29–33:

```js
const next = `${snapshot.sessionId}/${snapshot.matchGeneration}`;
if (generation !== next) {
  disposeRemoteActors();
  generation = next;
}
```

Life replacement, lines 39–43:

```js
if (actor && actor.lifeGeneration !== p.lifeGeneration) {
  retire(actor);
  actors.delete(p.sessionId);
  actor = undefined;
}
```

Extend the same owner pattern to review selection/request generations. It has at most one actor/view pair and one independent preview clock. Invalidate before retry, close, selection replacement or mode exit; superseded loads dispose their own results. Review never sends network input, equips the live player or awards ammo. UI-SPEC.md supplies the native nonmodal controls, focus/keyboard contract, sixteen bounded scenarios, reduced-motion policy and visible Preview — Phase 5 labels; there is no existing full review-panel analog to copy.

Disposal registration, characterResources lines 10–13:

```js
export function registerCharacterDisposer(root, callback) {
  if (!root || disposed.has(root)) return;
  if (!disposers.has(root)) disposers.set(root, new Set());
  disposers.get(root).add(callback);
```

Idempotent cleanup, same file lines 27–35:

```js
export function disposeCharacter(root, mixer) {
  if (!root || disposed.has(root)) return;
  disposed.add(root);
  for (const callback of disposers.get(root) ?? []) callback();
  disposers.delete(root);
  mixer?.stopAllAction();
  mixer?.uncacheRoot(root);
  detachSkeletonDebug(root);
  root.removeFromParent();
```

Geometry registration is lines 23–25; traversal excludes shared geometry at line 39, disposes designated owned/tinted materials at lines 41–46 and skeletons at line 49. Register view caches, props and listener retirement with this owner; shared packed maps/immutable clip buffers remain alive.

Browser test pattern, `tests/animation-regressions.spec.js` lines 111–125:

```js
const keeper = g.buildEnemyMesh(0, 0);
scene.add(keeper.mesh); keeper.mixer.update(0);
let sharedDisposals = 0;
keeper.mesh.traverse(n => {
  if (n.isSkinnedMesh) n.geometry.addEventListener('dispose', () => sharedDisposals++);
});
```

The following loop renders replacements, disposes them and renders the keeper again. Extend with double disposal, later cloning, view props and listener/callback counts. Existing exact synthetic geometry plateau is not a universal live-map budget; randomized map rubble and warmed multi-actor measurements require the distinctions already documented in RESEARCH.md.

### Bounded motion authoring/export/recovery

**Apply to:** build_motion.py, motion-manifest.json, motion.blend, pipeline, inspect-character, verify-export, review and provenance/documentation outputs.
**Primary analog:** `tools/art/pipeline.mjs`.

Node imports and project-relative root, lines 1–10:

```js
import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import assert from 'node:assert/strict';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
```

Path validation/error convention, lines 27–31:

```js
export function owned(root, target) {
  const absolute = path.resolve(target),
    relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Path escapes owned root');
```

Lines 32–44 also walk existing ancestors through realpath and reject linked escapes; retain that complete validation, not only the lexical excerpt.

Blender launch safety, lines 198–205:

```js
export async function blender(args) {
  const exe = await bootstrap();
  await run(exe, [
    '--background',
    '--factory-startup',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
```

Use the pinned runtime, inspected trusted scripts and bounded manifest inputs. Copy source/cache extension validation from lines 212–220. The current art exporter merges old compatibility at lines 223–224; it is explicitly an inadequate motion exporter. Add manifest-limited motion append/replacement checks protecting mesh/material/image/skin/inverse-bind semantics and untouched inherited action occurrences. Keep exact-motion negative controls meaningful.

Candidate reopen and inspection, lines 599–601:

```js
await exportSource(candidateSource, path.join(CACHE, 'reopened.glb'));
const { inspectCharacter } = await import('./inspect-character.mjs');
await inspectCharacter(candidate, { baseline: path.join(CACHE, 'baseline.glb') });
```

Staged publication, lines 614–620:

```js
const staging = path.join(ROOT, 'public/models/enemy.glb.pending');
owned(ROOT, staging);
owned(ROOT, path.join(SOURCES, 'soldier.blend.pending'));
await fs.copyFile(candidateSource, path.join(SOURCES, 'soldier.blend.pending'));
await fs.rename(path.join(SOURCES, 'soldier.blend.pending'), path.join(SOURCES, 'soldier.blend'));
await fs.copyFile(candidate, staging);
await fs.rename(staging, path.join(ROOT, 'public/models/enemy.glb'));
```

This is a staged rename pattern, not a transaction across source/export files. Adapt with explicit identity/recovery for motion source plus manifest/export; preserve accepted art source and verify independent regeneration before publication. The new donor/action-slot/export implementation has no close existing complete analog; use research and the tracked `tools/retarget.py` world-rest/parents-first baseline rather than runtime global rotations.

## Shared Patterns

- **Authority and guards:** presentation reads actual displacement, posture, deadlines and life identity. Existing protocol exact-intent validation is retained. New server death cues are conditional, server-owned and life-scoped; deterministic body-heading fallback avoids schema expansion. No client action or direction claims enter authority.
- **Timing:** mixer/frame/throw units are seconds; gameplay reload is milliseconds. `fitActionDuration()` changes action playback without mutating shared clips. Animation completion cannot award ammo, hits or releases.
- **Resource ownership:** register cleanup with characterResources; injected factories permit isolated tests. Preserve shared geometry/maps, detach borrowed weapons, cancel callbacks before replacement and use generation guards for async results.
- **Errors/validation:** runtime missing actions are guarded and playable fallback survives. Review failure/retry/status uses textContent and the approved copy contract. Tooling throws on malformed extensions/escaped real paths and fails Blender via explicit exit code.
- **Testing/review:** real GLB loading and moving first-person/third-person evidence complement pure helper tests; metrics do not establish human acceptance. Extend existing browser tests and run shared-output suites sequentially during execution. No tests were run for this read-only map.

## No Analog Found

| File/Capability | Role | Data Flow | Reason |
|---|---|---|---|
| firstPersonRig complete skeletal view | component | transform | Existing first-person owner is camera gun only; disposal and mounting seams are partial. |
| physical per-weapon contact/parts | utility/config | transform | No current articulated reload/socket contract; basis constants are insufficient. |
| original donor motion and manifest | model/config | file-I/O | Current export excludes new motion; implement bounded action-slot/export contract from research. |
| server death cue | model | pub-sub | No replicated trusted direction field exists; planner may select documented fallback. |
| review panel/index/style additions | component/config | event-driven | Generation/resource owners exist, but native inspection-only review surface is new. |

## Metadata

**Analog search scope:** tracked src/builders, src/entities, src/network, src/loop.js, tools/art and tests; conditional shared/server seams verified as tracked integration paths.
**Pattern extraction:** five primary families; supporting weapon, mount, reload and test snippets read once. All named existing analog/integration paths passed `git -c safe.directory=C:/Programowanie/VibeOnDuty ls-files -- <paths>`. No ignored installation/runtime mirrors used.
**Project skills:** no .codex/skills or .agents/skills directories surfaced in repository inspection.
**Write guard:** supplied 01-root-pin.sh passed with process-local safe.directory before this artifact write.
**Source changes/tests/commits:** none.
