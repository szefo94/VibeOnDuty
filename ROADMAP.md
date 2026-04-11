# VIBE ON DUTY — Development Roadmap

## Current State

```
fps3d.html              — DOM structure (entry: src/main.js)
style.css               — all styles
vite.config.js          — entry point: fps3d.html
src/
  main.js               — entry point: DOM listeners, start button, kicks off loop
  loop.js               — loop(ts), startLoop(), setThirdPerson/getThirdPerson
  config.js             — all constants
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding
  level.js              — level build, debug lines — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), all MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  builders/
    weapon.js           — player weapon model — exports wpn, flash, flashMat, muzzleLight
    playerBody.js       — 3rd-person body — exports playerBody
    enemy.js            — exports buildEnemy()
    drone.js            — exports buildDrone()
  combat/
    damage.js           — grenade falloff, entity/player damage
    shoot.js            — ehm, rebuildEHM, tryShoot, spawnBullet, tickBullets,
                          sprayHeat, coolSpray, bobT, muzzleT, recoilT, updateWeapon
  entities/
    player.js           — player, visited, startReload, updatePlayer
    enemies.js          — enemies, dronePool, activeDrone, WALKABLE_CELLS, wave,
                          spawnEnemyIntoSlot, spawnNewDrone, updateDrone,
                          updateEnemies, killEnemy, killDrone, triggerDeath, tickWave
    ammoDrops.js        — ammoDrops, spawnAmmoDrop, tickAmmoDrops
    grenades.js         — grenades, tryThrowGrenade, tickGrenades, explodeGrenade
  fx/
    tracers.js          — enemy static tracers — exports spawnTracer, tickTracers
    impacts.js          — bullet impact sparks — exports spawnImpact, tickImpacts
    particles.js        — grenade particles + impact zones — exports grenImpactZones,
                          spawnGrenadeParticles, tickGrenadeParticles
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — w2s, drawHUD
    radar.js            — drawMinimap
```

> **Note:** Serve via `npm run dev` (Vite) — do NOT open via `file://`.

### Known migration notes
- Three.js upgraded from CDN r128 → npm r160. All light intensities scaled by the physical
  conversion factor (`× Math.PI` for directional/ambient, `× 4π` for point lights).
- `renderer.outputColorSpace = THREE.SRGBColorSpace` replaces deprecated `outputEncoding`.

---

## Phase 1 — npm + localhost setup ✅ DONE

- Vite dev server (`npm run dev`)
- `npm install three` — CDN script tag removed
- `vite.config.js` added (entry: `fps3d.html`)
- `vitest` and `@playwright/test` installed

---

## Phase 2 — Module split

**Goal:** drain `game.js` to near zero by extracting remaining systems.

### Batch 1 — Scene foundation ✅ DONE
`src/scene.js`, `src/materials.js`, `src/lighting.js`

### Batch 2 — Static builders ✅ DONE
`src/level.js`, `src/builders/weapon.js`, `src/builders/playerBody.js`,
`src/builders/enemy.js`, `src/builders/drone.js`

### Batch 3 — FX ✅ DONE
`src/fx/tracers.js`, `src/fx/impacts.js`, `src/fx/particles.js`

> Note: live player-bullet physics (`spawnBullet`, `tickBullets`) stay in game.js
> until Batch 6 (combat) when `enemies`, `player`, `activeDrone` are importable.

### Batch 4 — Input ✅ DONE
`src/input.js`

> Exports `keys`, `locked`, `gameRunning`, `mouseHeld`, `setGameRunning`.
> Basic DOM listeners (keydown/keyup, mousedown/mouseup, pointerlock, contextmenu) live here.
> Game-action handlers (R reload, F3/F4, mousemove look, click shoot/grenade) stay in game.js.

### Batch 5 — Entity state ✅ DONE

| File | Exports |
|------|---------|
| `src/entities/ammoDrops.js` | `ammoDrops`, `spawnAmmoDrop`, `tickAmmoDrops` |
| `src/entities/enemies.js` | `enemies`, `dronePool`, `activeDrone`, `spawnEnemyIntoSlot`, `updateEnemies`, `WALKABLE_CELLS`, `wave`, `respawnTimer`, `spawnNewDrone`, `updateDrone`, `killEnemy`, `killDrone`, `triggerDeath`, `tickWave` |
| `src/entities/grenades.js` | `grenades`, `tryThrowGrenade`, `tickGrenades`, `explodeGrenade` |
| `src/entities/player.js` | `player`, `visited`, `startReload`, `updatePlayer` |

> Note: drone state (`dronePool`, `activeDrone`, `spawnNewDrone`, `updateDrone`) merged into
> `enemies.js` (single file) rather than a separate `drone.js`. `killEnemy`/`killDrone`
> also live in `enemies.js` due to wave-state coupling.

### Batch 6 — Combat ✅ DONE

| File | Exports |
|------|---------|
| `src/combat/shoot.js` | `ehm`, `rebuildEHM`, `tryShoot`, `spawnBullet`, `tickBullets`, `sprayHeat`, `coolSpray`, `bobT`, `muzzleT`, `recoilT`, `updateWeapon` |
| `src/hud/hitmarker.js` | `hitMarkerT`, `spawnHitMarker`, `tickHitMarker` |

> Done alongside Batch 5: entities needed `rebuildEHM` + `tryShoot` immediately.

### Batch 7 — HUD ✅ DONE

| File | Exports |
|------|---------|
| `src/hud/hitmarker.js` | `hitMarkerT`, `spawnHitMarker`, `tickHitMarker` |
| `src/hud/overlay.js` | `updateHUD`, `showMsg`, `showStatus`, `triggerHitFlash` |
| `src/hud/hud.js` | `w2s`, `drawHUD` |
| `src/hud/radar.js` | `drawMinimap` |

> `triggerDeath` lives in `enemies.js` (it reads `wave`).

### Batch 8 — Loop + entry ✅ DONE

| File | Exports |
|------|---------|
| `src/loop.js` | `loop`, `startLoop`, `setThirdPerson`, `getThirdPerson` |
| `src/main.js` | _(entry point — DOM listeners, start button, `startLoop()`)_ |

`game.js` deleted. `fps3d.html` now points to `src/main.js`.

---

## Phase 3 — Testing

### Step 3.1 — Unit tests (Vitest)

```bash
npm test
```

Targets (modules already split and importable):

| File | What to test |
|------|-------------|
| `src/map.js` | `groundElevation` ramp interpolation, `canMoveTo` wall blocking, step-height |
| `src/math.js` | `normA` wrapping, `slerp` convergence |
| `src/astar.js` | finds path, handles blocked route, returns `[]` at destination |
| `src/combat/damage.js` | falloff at 0%, 50%, 100% radius; entity vs player formulas |

### Step 3.2 — Integration / smoke tests (Playwright)

```bash
npm run test:e2e
```

What to cover:
- Page loads with no console errors
- Click "DROP IN" → overlay hides, game starts
- Player can move (simulate WASD keydown)
- Enemy spawns within timeout
- Wave complete message appears after all enemies killed

---

## Phase 4 — Quality of life ✅ DONE

| Task | Status | Notes |
|------|--------|-------|
| `vite build` | ✅ | outputs to `dist/`, entry `fps3d.html` |
| Prettier | ✅ | `.prettierrc` created, `npx prettier --write "src/**/*.js"` run |
| ESLint | ✅ | `eslint.config.js` (flat config), `globals` package, `npm run lint` clean |
| TypeScript | ✅ | `tsconfig.json` (`checkJs: false`, `noEmit: true`), `npm run typecheck` clean |

New scripts in `package.json`:
```
npm run lint       # eslint src/
npm run typecheck  # tsc --noEmit
npm run build      # vite build → dist/
```

---

## Phase 5 — Enemy upgrade: real assets + improved AI

### Goal
Replace the hand-built box/cylinder enemy geometry with GLTF models from the internet,
add skeletal animation, and improve enemy movement so it feels less floaty and robotic.

---

### Step 5.1 — Asset pipeline: loading GLTF models

**How it works in Three.js r160**

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; // optional, for compressed meshes
```

Vite serves files in `public/` at the root URL — put `.glb` files there:
```
public/
  models/
    enemy.glb
    drone.glb
```

Load once at startup (before `startLoop`):
```js
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('/draco/'); // copy node_modules/three/examples/jsm/libs/draco/ → public/draco/
loader.setDRACOLoader(draco);

export let enemyGLTF = null;
export async function loadAssets() {
  const gltf = await loader.loadAsync('/models/enemy.glb');
  enemyGLTF = gltf;
}
```

Call `await loadAssets()` in `main.js` before `startLoop()`.

**Good free sources (CC0 / CC-BY)**
- [Quaternius](https://quaternius.com) — low-poly stylised soldiers, robots, animated packs (CC0)
- [Kenney.nl](https://kenney.nl/assets) — blocky sci-fi soldiers, drones (CC0)
- [Sketchfab](https://sketchfab.com) — filter "Downloadable + Free", check licence per model
- [Mixamo](https://www.mixamo.com) — auto-rigs humanoid FBX/GLTF + walk/run/attack animations (free with Adobe account)

Recommended format: `.glb` (binary GLTF, single file, smaller). Mixamo exports FBX → convert with Blender's GLTF exporter.

---

### Step 5.2 — Skeletal animation (AnimationMixer)

Replace the current `animT` bob with a real walk/idle/attack cycle:

```js
// in buildEnemy (or a new src/builders/enemyGLTF.js)
import { AnimationMixer } from 'three';

export function buildEnemyFromGLTF(wx, wz) {
  const clone = SkeletonUtils.clone(enemyGLTF.scene); // SkeletonUtils preserves skeleton
  const mixer = new AnimationMixer(clone);
  const clips = {
    idle:   AnimationClip.findByName(enemyGLTF.animations, 'Idle'),
    walk:   AnimationClip.findByName(enemyGLTF.animations, 'Walk'),
    run:    AnimationClip.findByName(enemyGLTF.animations, 'Run'),
    attack: AnimationClip.findByName(enemyGLTF.animations, 'Shoot'),
    death:  AnimationClip.findByName(enemyGLTF.animations, 'Death'),
  };
  const actions = {};
  for (const [name, clip] of Object.entries(clips))
    if (clip) actions[name] = mixer.clipAction(clip);
  actions.idle?.play();
  clone.position.set(wx, 0, wz);
  scene.add(clone);
  clone.traverse(ch => { if (ch.isMesh) ch.userData.enemyGroup = clone; });
  return { mesh: clone, mixer, actions, animT: 0 };
}
```

Tick the mixer in `updateEnemies`:
```js
e.mixer?.update(dt);
```

State → animation mapping (crossfade):
| Enemy state | Animation |
|-------------|-----------|
| `patrol`    | `walk` at speed 0.6× |
| `spotted`   | `run` |
| `attack`    | `shoot` (looped) |
| death       | `death` (clamp + remove mesh after clip finishes) |

Crossfade helper:
```js
function crossfade(e, toName, dur = 0.2) {
  if (e.currentAnim === toName) return;
  const from = e.actions[e.currentAnim];
  const to   = e.actions[toName];
  if (!to) return;
  to.reset().setEffectiveWeight(1).play();
  from?.crossFadeTo(to, dur, true);
  e.currentAnim = toName;
}
```

---

### Step 5.3 — Improved movement

Current problems with the box-enemy movement:
1. Slides on diagonals (no deceleration)
2. Rotates instantly to face player
3. Jumps on-demand with no reaction delay
4. Path recalculated every frame (expensive + jittery)

Planned fixes:

**Smooth rotation** — already uses `slerp`, but increase weight to feel snappier on alert:
```js
// in updateEnemy: use different rot speed per state
const rotSpd = e.state === 'attack' ? ENEMY_ROT_SPD * 2.5 : ENEMY_ROT_SPD;
e.facingY = slerp(e.facingY, targetAngle, rotSpd * dt);
```

**Velocity-based movement** (replaces direct position delta):
```js
// add velX/velZ to enemy state, accelerate toward path target, dampen each frame
const accel = 8; const drag = 6;
e.velX += (desiredVx - e.velX) * accel * dt;
e.velZ += (desiredVz - e.velZ) * drag * dt;
e.x += e.velX * dt;
e.z += e.velZ * dt;
```

**Stagger on hit** — when `hp` drops, push enemy backward and play a `hit` animation clip,
blocking movement for ~0.3 s (set `e.stunTimer`):
```js
// in shoot.js hit handler:
const knockDir = new THREE.Vector3(e.x - camera.position.x, 0, e.z - camera.position.z).normalize();
e.velX += knockDir.x * 4;
e.velZ += knockDir.z * 4;
e.stunTimer = 0.3;
crossfade(e, 'hit');
```

**Path throttle** — recalculate A* max once every 600 ms or when target cell changes:
```js
e.pathAge += dt;
const newGoal = [Math.floor(player.x/CELL), Math.floor(player.z/CELL)];
if (e.pathAge > 0.6 || !eqCell(e.pathGoal, newGoal)) {
  e.path = astar(...);
  e.pathAge = 0;
  e.pathGoal = newGoal;
}
```

---

### Step 5.4 — Drone upgrade

**Model**: Kenney "Drone" pack (CC0) or Quaternius sci-fi robot.
Load the same way as enemy via GLTFLoader. The rotor spin can be driven by rotating
a bone or just continuing the `userData.isRotor` traverse approach.

**Behaviour additions**:
- **Strafe circle** — instead of charging straight, orbit the player at `targetDist`
  using a tangential velocity component
- **Burst fire** — shoot 3 bullets in 150 ms bursts with a 2 s cooldown (vs current
  continuous raycast damage)
- **EMP pulse** — at low HP (< 30%), emit a shockwave that slows player movement for 2 s

---

### Implementation order

| Step | File(s) changed | Complexity |
|------|----------------|------------|
| 5.1 Load GLTF | `src/builders/enemyGLTF.js` (new), `src/main.js` | Low |
| 5.2 AnimationMixer | `src/builders/enemyGLTF.js`, `src/entities/enemies.js` | Medium |
| 5.3a Smooth rotation tweak | `src/entities/enemies.js` | Trivial |
| 5.3b Velocity movement | `src/entities/enemies.js` | Low |
| 5.3c Stagger on hit | `src/combat/shoot.js`, `src/entities/enemies.js` | Low |
| 5.3d Path throttle | `src/entities/enemies.js` | Low |
| 5.4 Drone model + strafe | `src/builders/droneGLTF.js` (new), `src/entities/enemies.js` | Medium |

The old `src/builders/enemy.js` and `src/builders/drone.js` stay in place as fallbacks
until the GLTF path is proven; then delete them.

---

## Next up

All phases (1–4) complete. Phase 5 is planned but not started.

Codebase health:
- Fully split into ES modules under `src/`
- Tested (Vitest unit tests + Playwright smoke tests)
- Linted (ESLint 9 flat config)
- Formatted (Prettier)
- Type-checked (TypeScript `allowJs` + `checkJs: false`)
- Production-buildable (`vite build`)
