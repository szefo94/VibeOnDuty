# Phase 1: Two-Client Authoritative TDM - Pattern Map

**Mapped:** 2026-10-03  
**Files analyzed:** 20 target groups (new filenames remain planner choices)  
**Analogs found:** 15 / 20 groups; behavioral matches do not imply reusable ownership.

Scope comes from 01-CONTEXT.md and 01-RESEARCH.md. Directory targets below are proposed, not existing modules. All existing analog paths were confirmed with `git ls-files -- <path>`. No project-local `.codex/skills/` or `.agents/skills/` directory exists. Preserve offline modes and current assets.

## File Classification

| New/Modified File or Target | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shared/` map-data/world queries | model/utility | transform | `src/map.js` | role-match; singleton extraction required |
| `src/shared/` movement step | service | transform | `src/entities/player.js` | behavioral; browser dependencies excluded |
| `src/shared/` projectile collision | utility | transform | `src/math.js`, `src/combat/shoot.js` | role-match |
| `src/shared/` weapon rules | service | transform | `src/combat/shoot.js` | behavioral |
| `src/shared/` TDM rules | service | event-driven | `src/modes/tdm.js` | role-match; per-room state required |
| `src/shared/` protocol validation | utility | request-response | None | new trust boundary |
| `src/network/` session/transport | provider | streaming | None | new transport |
| `src/network/` remote actors | component | event-driven | `src/builders/enemyGLTF.js`, `src/builders/characterResources.js` | role-match |
| `src/network/` confirmed feedback/UI | component | event-driven | `src/hud/hitmarker.js`, `src/fx/damageNumbers.js` | exact presentation |
| `server/` authoritative room/schema | service/model | streaming | None | new server ownership |
| `server/` CLI/static host | service/config | request-response | None | new operator interface |
| `server/` TLS storage/generation | service | file-I/O | None | new secret lifecycle |
| `src/main.js` online entry/action routing | controller | event-driven | same file | exact integration seam |
| `src/loop.js` online session/render tick | controller | streaming | same file | exact integration seam |
| `index.html`, `style.css` entry/errors/results | component | event-driven | `src/modes/tdm.js`, existing markup | role-match |
| `src/shared/**/*.test.js` | test | batch | `src/math.test.js` | exact pure-test structure |
| `server/` integration/CLI/TLS tests | test | batch | `src/math.test.js` | test-style only; fixture is new |
| `tests/multiplayer.spec.js`, multiplayer fixture/config | test/config | batch | `tests/smoke.spec.js`, `playwright.config.js` | role-match |
| `vitest.config.js`, lint/types, package/lockfile | config | batch | existing config files | exact |
| `vite.config.js`, CI, ignored keys/operator docs | config | batch/file-I/O | existing Vite/CI configuration | partial; key/docs content new |

## Pattern Assignments

### Shared world and movement

Use relative ESM imports, explicit `.js`, and named exports. `src/map.js:1-3`:

```js
import { CELL, PLAYER_H, PLAYER_R } from './config.js';
import { bunkerMapDef, H1 as _bH1, H2 as _bH2 } from './maps/bunker.js';
import { isRamp, isCrack, isColumn, navCell, rampSurface } from './tiles.js';
```

Extract query behavior into an instance receiving map data; do not import the mutable map singleton into each server room. Copy coordinate convention from `src/map.js:35`:

```js
export const worldToCell = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];
```

`src/map.js:60-91` contains ramp-versus-flat selection and accessible-floor filtering. The critical floor bound at line 85 is:

```js
const maxSurface = refY === Infinity ? Infinity : refY - PLAYER_H + MAX_STEP;
```

Preserve `[row][column]`, absolute surface heights, column radius, crack thickness and step rules from lines 94-156. Retain tracked tile/ramp codecs rather than reproducing tile-ID arithmetic. Separate gameplay map data from rendering imports.

Movement analog `src/entities/player.js:130-162` normalizes diagonal movement, derives forward/right from yaw, and resolves X then Z with body-radius probes. Lines 140-142:

```js
if (mv.length() > 0) {
  mv.normalize();
  mv.multiplyScalar(spd);
```

Copy the math, replacing keys/camera writes with bounded input and explicit body state. Lines 1-13 demonstrate why this module itself is unsuitable for headless import: camera, input, HUD and effects are dependencies. Server supplies timestep; omit client-owned speed/delta/position.

### Projectiles and firing

`src/math.js:19-26` accepts numeric objects without Three or DOM. Concrete sweep excerpt, lines 20-24:

```js
const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
const len2 = abx * abx + aby * aby + abz * abz;
const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
let t = len2 > 1e-9 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
t = t < 0 ? 0 : t > 1 ? 1 : t;
```

This detects segment proximity; it does not return earliest collision time. Add impact ordering explicitly. `src/combat/shoot.js:147-150` preserves ballistic stepping:

```js
b.prevPos.copy(b.pos);
b.vel.y -= (BULLET_GRAV + (b.isSniper ? 9.8 : 0)) * dt;
b.pos.addScaledVector(b.vel, dt);
b.life -= dt;
```

Do not copy wall-first early exit at lines 169-179, allied-target exclusion at line 185, or local damage mutation at line 203. Server needs earliest actor/obstruction impact, floor/ramp obstruction, and 25% friendly damage. `tryShoot`, lines 275-285, supplies dead/reload/ammo/cadence behavior; replace `performance.now()` with server time and derive origin/spread from server state. Keep seconds and milliseconds explicit.

### TDM rules and UI

`src/modes/tdm.js:16-18` already supplies the chosen defaults:

```js
const KILL_LIMIT    = 50;
const MATCH_SECS    = 600;
const RESPAWN_DELAY = 3;
```

Reuse countdown logic at lines 100-113 and reset inventory at 144-155, with room-owned players, scores, bullets, inputs and generations. Lines 165-179 are offline score listeners, not authoritative multiplayer handlers. New rules must add balanced teams/switching, empty-room suspension, draw policy, and 15-second automatic rematch. Existing results at 47-76 reload the page; copy presentation only. HUD updates at 31-38 use `textContent`, suitable for server-derived values and new nickname/error text.

### Confirmed feedback and remote actor cleanup

`src/combat/shoot.js:201-202` gives the exact visual calls:

```js
spawnHitMarker();
spawnDamageNumber(_ePos.x, _ePos.y + 0.4, _ePos.z, dmg);
```

Invoke these from deduplicated server confirmations addressed to the shooter. `src/hud/hitmarker.js:3-11` sets 260 milliseconds and expires using `dt * 1000`; `src/fx/damageNumbers.js:6-30` projects world position and removes its DOM node. Keep expiry active while dead/unlocked.

Remote actors can use skeleton cloning imports in `src/builders/enemyGLTF.js:13-23`; inspect builder entry at line 325 rather than making actors share bot simulation. Cleanup must use `src/builders/characterResources.js:12-18`:

```js
if (!root || disposed.has(root)) return;
disposed.add(root);
mixer?.stopAllAction();
mixer?.uncacheRoot(root);
detachSkeletonDebug(root);
root.removeFromParent();
```

Lines 20-30 dispose owned geometry/materials/skeletons while preserving template geometry registered at 8-9.

### Main, loop, assets and hosting integration

Route actions at `src/main.js` entry handlers through offline/online selection. Extend menu cleanup at 224-243 with session leave, actor disposal and active-mode reset. It currently cancels throws/stops play but does not clear active mode. `src/modes/modeManager.js:5-6` provides `setMode(mode)`/`getMode()`.

Preserve asset registration and pre-async weapon parenting at `src/main.js:356-388`. `src/builders/assetManager.js:10-16` uses `Promise.allSettled` and maps loader failures to `false`; keep procedural fallback and enabled-button timing. GLB loading uses `import.meta.env.BASE_URL` at `src/builders/enemyGLTF.js:279,287`. Match built serving base to `vite.config.js:24` (`PUBLIC_BASE` override).

`src/loop.js:75-92` caps render delta and gates offline update with `gameRunning`. Place session/snapshot processing independently of local death/pointer lock; server owns authoritative stepping. Preserve camera/body conventions at 95-100 and existing render restoration.

## Shared Patterns

Tests use relative imports and numeric object fixtures. `src/math.test.js:52-59`:

```js
describe('segPointDist2 — swept projectile hit test', () => {
  const V = (x, y, z) => ({ x, y, z });
  const HIT_R = 0.75;
  const d = (a, b, p) => Math.sqrt(segPointDist2(a, b, p));
```

Extend Vitest discovery (`vitest.config.js:5`) beyond `src/**/*.test.js`. `tests/smoke.spec.js:29-32` waits for `toBeEnabled({ timeout: 20000 })` before click. Reuse that readiness contract for two isolated browser contexts, but create a dedicated built-server fixture: existing `playwright.config.js:18-23` launches Vite, not multiplayer. Extend ESLint Node globals/scripts and explicit strict checking: current package lint covers only `src/`; `tsconfig.json` disables `checkJs`. Preserve lockfile and Node-runtime CI alignment.

## No Analog Found

Protocol validation, network session, authoritative room/schema, CLI/static hosting and TLS generation/storage have no existing equivalents. Use RESEARCH.md for library APIs; implement membership, generation/sequence bounds, queues/rates and server-only outcomes explicitly. Do not treat synchronous offline event listeners as transport/auth. No existing centralized server error wrapper or certificate lifecycle exists.

## Metadata

**Analog search scope:** tracked `src/`, `tests/`, root configs and CI.  
**Files scanned:** 26 source/config files through full reads or targeted ranges/searches.  
**Pattern extraction date:** 2026-10-03. No dependency probes, source edits or commits performed.
