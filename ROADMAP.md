# VIBE ON DUTY — Development Roadmap

## Current State

```
fps3d.html         — DOM structure
style.css          — all styles
game.js            — renderer, scene, entities, game loop (imports from src/)
src/
  config.js        — all constants
  map.js           — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js          — normA, slerp
  astar.js         — A* pathfinding
  combat/
    damage.js      — grenade falloff, entity/player damage
```

> **Note:** `game.js` now uses ES module `import`. The game must be served over HTTP —
> open via `python3 -m http.server` or a proper dev server, not `file://`.

---

## Phase 1 — npm + localhost setup

**Goal:** run on a proper dev server, enable HMR, replace CDN Three.js with npm package.

### Step 1.1 — Dev server

```bash
npm install -D vite
npm run dev   # → localhost:5173
```

### Step 1.2 — Replace CDN Three.js with npm package

```bash
npm install three
```

Change `fps3d.html` — remove the cdnjs `<script>` tag.

Change `game.js` top:

```js
import * as THREE from 'three';
```

---

## Phase 2 — Continue module split

**Goal:** drain `game.js` to near zero by extracting remaining systems in dependency order.
Each batch is safe to do independently once the previous batch exports are in place.

### Batch 1 — Scene foundation (~40 lines, no game-state deps)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/scene.js` | `renderer`, `scene`, `camera`, `hudCanvas`, `hudCtx`, `rsz` | THREE SETUP section |
| `src/materials.js` | `mm`, `matFloor`, `matWall`, `matWallD`, `matWallT`, `matCrack`, `matTrim`, `matRamp` | MATERIALS section |
| `src/lighting.js` | `torchLights` (array), `tickTorches(dt)` | LIGHTING section + torch flicker in loop |

### Batch 2 — Static builders (~190 lines, deps: scene, materials, config, map)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/level.js` | `wallMeshes`, `debugLines`, `debugVisible` | LEVEL BUILD section |
| `src/builders/weapon.js` | `wpn`, `flash`, `flashMat`, `muzzleLight`, `muzzleT` | PLAYER WEAPON section |
| `src/builders/playerBody.js` | `playerBody` | THIRD PERSON section |
| `src/builders/enemy.js` | `buildEnemy()` | ENEMY BUILDER section |
| `src/builders/drone.js` | `buildDrone()` | DRONE BUILDER section |

### Batch 3 — FX (~50 lines, deps: scene, config)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/fx/tracers.js` | `spawnTracer(a,b,enemy)`, `tickTracers(dt)` | TRACERS section |
| `src/fx/impacts.js` | `spawnImpact(pos)`, `tickImpacts(dt)` | IMPACTS section |
| `src/fx/particles.js` | `grenImpactZones`, `spawnGrenadeParticles(pos)`, `tickGrenadeParticles(dt)` | GRENADE PARTICLES section |

### Batch 4 — Input (~25 lines, deps: config, DOM only)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/input.js` | `keys`, `locked`, `gameRunning`, `mouseHeld` | INPUT section |

> `input.js` has no entity deps — it just records key/mouse state. Other modules read from it.

### Batch 5 — Entity state (~300 lines, deps: scene, config, map, builders, fx, input)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/entities/ammoDrops.js` | `ammoDrops`, `spawnAmmoDrop(wx,wz)`, `tickAmmoDrops(dt)` | AMMO DROPS section |
| `src/entities/enemies.js` | `enemies`, `spawnEnemyIntoSlot(e)`, `updateEnemies(ts,dt)`, `WALKABLE_CELLS` | ENEMY+DRONE DATA + ENEMY AI sections |
| `src/entities/drone.js` | `dronePool`, `activeDrone`, `spawnNewDrone()`, `updateDrone(d,dt)` | DRONE UPDATE section |
| `src/entities/grenades.js` | `grenades`, `tryThrowGrenade()`, `tickGrenades(dt)`, `explodeGrenade(g)` | GRENADES section |
| `src/entities/player.js` | `player`, `updatePlayer(dt)` | PLAYER STATE + PLAYER MOVEMENT sections |

### Batch 6 — Combat (~60 lines, deps: entities, fx, scene, config)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/combat/shoot.js` | `tryShoot()`, `killEnemy(e)`, `killDrone(d,dmg)`, `ehm`, `rebuildEHM()`, `sprayHeat` | SHOOT + ENEMY HIT MESHES sections |

> `shoot.js` is extracted after entities so `enemies`, `player`, `activeDrone` are importable.

### Batch 7 — HUD (~200 lines, deps: entities, scene, config)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/hud/hitmarker.js` | `spawnHitMarker()`, `hitMarkerT` | HIT MARKER section |
| `src/hud/overlay.js` | `updateHUD()`, `showMsg(txt,dur)`, `showStatus(txt,dur)`, `triggerHitFlash()`, `triggerDeath()` | RELOAD/HUD section |
| `src/hud/hud.js` | `drawHUD()`, `w2s(wx,wy,wz)` | HUD CANVAS section |
| `src/hud/radar.js` | `drawMinimap(dt)` | RADAR section |

### Batch 8 — Loop + entry (~30 lines, deps: everything)

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/loop.js` | `loop(ts)` | MAIN LOOP section (wave respawn + torch flicker moves here) |
| `src/main.js` | _(entry point, no exports)_ | START section — wires all imports, calls `requestAnimationFrame(loop)` |

After Batch 8, `game.js` is deleted and `fps3d.html` points to `src/main.js` instead.

---

## Phase 3 — Testing

**Goal:** catch regressions, test AI and physics logic without a browser.

### Step 3.1 — Unit tests (pure logic)

```bash
npm install -D vitest
```

```json
"test": "vitest"
```

Immediate test targets (modules are already split and importable):

| File | What to test |
|------|-------------|
| `src/map.js` | `groundElevation` ramp interpolation, `canMoveTo` wall blocking, step-height |
| `src/math.js` | `normA` wrapping, `slerp` convergence |
| `src/astar.js` | finds path, handles blocked route, returns `[]` at destination |
| `src/combat/damage.js` | falloff at 0%, 50%, 100% radius; entity vs player formulas |
| `src/config.js` | energy clamping constants, ammo/reload values |

### Step 3.2 — Integration / smoke tests

```bash
npm install -D @playwright/test
npx playwright install chromium
```

```json
"test:e2e": "playwright test"
```

What to cover:
- Page loads with no console errors
- Click "DROP IN" → overlay hides, game starts
- Player can move (simulate WASD keydown)
- Enemy spawns within timeout
- Wave complete message appears after all enemies killed

---

## Phase 4 — Quality of life

These become easy once the structure above is in place:

- **TypeScript** — add `tsconfig.json`, rename `.js` → `.ts`
- **ESLint** — catch globals, unused vars, unsafe patterns
- **Prettier** — format the currently minified code
- **`vite build`** — bundles + minifies for production, outputs to `dist/`

---

## Migration order (remaining)

1. `npm install -D vite` + `npm install three`, replace CDN — **zero game changes**
2. Write first Vitest unit tests for `src/` modules — **1 hour, first tests green**
3. Playwright smoke test — **1 hour, CI safety net**
4. System-by-system split of `game.js` as features are added — **ongoing**
