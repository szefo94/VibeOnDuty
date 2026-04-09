# VIBE ON DUTY — Development Roadmap

## Current State

```
fps3d.html              — DOM structure
style.css               — all styles
game.js                 — game loop, entities, AI, HUD, input (imports from src/)
vite.config.js          — entry point: fps3d.html
src/
  config.js             — all constants
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding
  level.js              — level build, debug lines — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), all MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  builders/
    weapon.js           — player weapon model — exports wpn, flash, flashMat, muzzleLight
    playerBody.js       — 3rd-person body — exports playerBody
    enemy.js            — exports buildEnemy()
    drone.js            — exports buildDrone()
  combat/
    damage.js           — grenade falloff, entity/player damage
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  fx/
    tracers.js          — enemy static tracers — exports spawnTracer, tickTracers
    impacts.js          — bullet impact sparks — exports spawnImpact, tickImpacts
    particles.js        — grenade particles + impact zones — exports grenImpactZones, spawnGrenadeParticles, tickGrenadeParticles
```

> **Note:** `game.js` uses ES modules. Serve via `npm run dev` (Vite) — do NOT open via `file://`.

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

### Batch 5 — Entity state

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/entities/ammoDrops.js` | `ammoDrops`, `spawnAmmoDrop(wx,wz)`, `tickAmmoDrops(dt)` | AMMO DROPS section |
| `src/entities/enemies.js` | `enemies`, `spawnEnemyIntoSlot(e)`, `updateEnemies(ts,dt)`, `WALKABLE_CELLS` | ENEMY+DRONE DATA + ENEMY AI sections |
| `src/entities/drone.js` | `dronePool`, `activeDrone`, `spawnNewDrone()`, `updateDrone(d,dt)` | DRONE UPDATE section |
| `src/entities/grenades.js` | `grenades`, `tryThrowGrenade()`, `tickGrenades(dt)`, `explodeGrenade(g)` | GRENADES section |
| `src/entities/player.js` | `player`, `updatePlayer(dt)` | PLAYER STATE + PLAYER MOVEMENT sections |

### Batch 6 — Combat

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/combat/shoot.js` | `tryShoot()`, `killEnemy(e)`, `killDrone(d,dmg)`, `ehm`, `rebuildEHM()`, `sprayHeat` | SHOOT + ENEMY HIT MESHES sections |

> Extract after entities so `enemies`, `player`, `activeDrone` are importable.

### Batch 7 — HUD

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/hud/hitmarker.js` | `spawnHitMarker()`, `hitMarkerT` | HIT MARKER section |
| `src/hud/overlay.js` | `updateHUD()`, `showMsg(txt,dur)`, `showStatus(txt,dur)`, `triggerHitFlash()`, `triggerDeath()` | RELOAD/HUD section |
| `src/hud/hud.js` | `drawHUD()`, `w2s(wx,wy,wz)` | HUD CANVAS section |
| `src/hud/radar.js` | `drawMinimap(dt)` | RADAR section |

### Batch 8 — Loop + entry

| File | Exports | Cut from game.js |
|------|---------|-----------------|
| `src/loop.js` | `loop(ts)` | MAIN LOOP section |
| `src/main.js` | _(entry point, no exports)_ | START section — wires imports, calls `requestAnimationFrame(loop)` |

After Batch 8, `game.js` is deleted and `fps3d.html` points to `src/main.js`.

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

## Phase 4 — Quality of life

Easy once structure is in place:

- **TypeScript** — add `tsconfig.json`, rename `.js` → `.ts`
- **ESLint** — catch globals, unused vars, unsafe patterns
- **Prettier** — format the currently minified code
- **`vite build`** — bundles + minifies for production, outputs to `dist/`

---

## Next up

1. Batch 5 — entity state modules (ammoDrops, enemies, drone, grenades, player)
2. Batch 6 — `src/combat/shoot.js` (tryShoot, killEnemy, killDrone, live bullets, ehm)
3. Batches 7–8 — HUD modules, then loop + entry → delete game.js
