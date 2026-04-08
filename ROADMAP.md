# VIBE ON DUTY — Development Roadmap

## Current State

Three flat files, no build step, everything global:

```
fps3d.html   — DOM structure
style.css    — all styles
game.js      — ~1200 lines, one global script, 20+ logical sections
```

`game.js` sections identified:
- `CONFIG` — game constants
- `MAP / HMAP` — tile and heightmap data
- `mapCell`, `hAt`, `groundElevation`, `canMoveTo` — map queries
- `THREE SETUP` — renderer, scene, camera
- `LIGHTING` — ambient, sun, fill, torch lights
- `MATERIALS` — shared MeshStandardMaterials
- `LEVEL BUILD` — procedural geometry from map data
- `PLAYER WEAPON` — first-person weapon mesh
- `THIRD PERSON` — player body + camera offset
- `ENEMY BUILDER` / `DRONE BUILDER` — procedural character geometry
- `ENEMY + DRONE DATA` — spawn logic, wave state
- `RAYCASTERS` — LOS / hit detection
- `PLAYER STATE` — player object, input, movement, physics
- `TRACERS / IMPACTS / GRENADE PARTICLES` — VFX
- `AMMO DROPS` — pickups
- `GRENADES` — throw, physics, explosion
- `SHOOT` — fire logic, spray, kill handlers
- `ENEMY AI` / `DRONE UPDATE` — AI tick, A* pathfinding
- `HUD CANVAS` — enemy HP bars, grenade zones, spray cone
- `RADAR` — minimap sweep
- `HIT MARKER / WEAPON BOB / RELOAD` — feedback systems
- `PLAYER MOVEMENT` — WASD, jump, crouch, slide
- `MAIN LOOP` — game loop, wave respawn
- `START` — overlay button wiring

---

## Phase 1 — npm + localhost setup

**Goal:** run on a proper dev server, enable ES modules, unblock testing.

### Step 1.1 — Add package.json

```bash
npm init -y
```

### Step 1.2 — Dev server

**Option A — Vite** *(recommended)*
- Live HMR (hot module reload), instant startup, zero config
- Handles ES module imports natively
- `npm run dev` → `localhost:5173`

```bash
npm install -D vite
```

```json
// package.json scripts
"dev": "vite",
"build": "vite build",
"preview": "vite preview"
```

**Option B — plain static server**
- No module support, no HMR, but zero overhead
- Fine if you never want to split game.js into modules

```bash
npm install -D serve
```

```json
"dev": "serve ."
```

**Option C — esbuild dev server**
- Faster than Vite for large files, slightly more manual config
- Good if you want fine-grained bundle control later

> **Recommendation:** go with Vite. It's the path of least resistance for this stack and opens the door to all later phases.

### Step 1.3 — Replace CDN Three.js with npm package

```bash
npm install three
```

Change `game.js` top from global `THREE` assumption to:

```js
import * as THREE from 'three';
```

Remove the `<script src="cdnjs...">` tag from `fps3d.html`.

This is the only breaking change — everything else stays the same.

---

## Phase 2 — Split game.js into modules

**Goal:** clean separation of concerns, each file has one job, pure logic becomes importable and testable.

### Proposed file structure

```
src/
  config.js          — all constants (CELL, WALL_H, ENEMY_HP, etc.)
  map.js             — MAP, HMAP arrays + mapCell, hAt, groundElevation, canMoveTo
  scene.js           — renderer, scene, camera, resize handler
  lighting.js        — ambient, sun, fill, torch lights + flicker tick
  materials.js       — shared MeshStandardMaterial instances
  level.js           — buildLevel(), buildDebugLines()
  builders/
    weapon.js        — player weapon mesh
    enemy.js         — buildEnemy()
    drone.js         — buildDrone()
    playerBody.js    — third-person body mesh
  entities/
    player.js        — player state object, movement, jump, crouch, slide, reload
    enemies.js       — spawn, wave state, AI tick, A*
    drone.js         — drone state, update tick
    grenades.js      — throw, tick, explode
    ammoDrops.js     — spawn, tick, pickup
  combat/
    shoot.js         — tryShoot, killEnemy, killDrone
    damage.js        — pure damage/falloff calculations
  fx/
    tracers.js       — bullet tracers
    impacts.js       — wall impact sparks
    particles.js     — grenade explosion particles
  hud/
    hud.js           — drawHUD, drawImpactZones, enemy HP bars
    radar.js         — drawMinimap
    hitmarker.js     — spawnHitMarker
    overlay.js       — showMsg, showStatus, triggerDeath, updateHUD
  input.js           — keyboard, mouse, pointer lock
  math.js            — normA, slerp, w2s
  loop.js            — main game loop, wave respawn timer
  main.js            — entry point, wires everything together
```

### Split strategy

**Option A — split by system** *(above, recommended)*
- Each file owns one system. Most natural for a game.
- `enemies.js` owns all enemy state + AI. `player.js` owns player state + movement.
- Cross-system calls pass data as arguments rather than shared globals.

**Option B — split by layer**
- `core/` (config, map, math), `render/` (scene, lighting, builders), `gameplay/` (player, enemies, weapons), `ui/` (hud, radar, overlay)
- Cleaner if you anticipate swapping renderers or UI frameworks later.

**Option C — keep game.js, just extract pure logic**
- Minimal effort: pull out `config.js`, `map.js`, `math.js`, `damage.js`, `astar.js`
- Everything Three.js-heavy stays in one file
- Good middle ground if a full split feels premature

> **Recommendation:** start with Option C to get tests running fast, then migrate system by system as you add features.

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

Immediate test targets once split:

| File | What to test |
|------|-------------|
| `map.js` | `groundElevation` ramp interpolation, `canMoveTo` wall blocking, step-height |
| `math.js` | `normA` wrapping, `slerp` convergence |
| `entities/enemies.js` | `astar` finds path, handles blocked route, returns `[]` at destination |
| `combat/damage.js` | Grenade falloff at 0%, 50%, 100% radius |
| `entities/player.js` | Energy clamping, ammo deduction, reload state transitions |

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

**Option A — Playwright** *(recommended)* — full browser, real pointer lock, accurate
**Option B — Puppeteer** — similar capability, slightly simpler API
**Option C — jsdom + vitest** — headless DOM, no WebGL, limited to HUD/DOM logic only

### Step 3.3 — CI

Add `.github/workflows/test.yml`:

```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

---

## Phase 4 — Quality of life

These become easy once the structure above is in place:

- **TypeScript** — add `tsconfig.json`, rename `.js` → `.ts`, get type safety on entity shapes (player, enemy, drone objects are currently plain object literals with no schema)
- **ESLint** — catch globals, unused vars, unsafe patterns
- **Prettier** — format the currently minified code into readable style
- **`vite build`** — bundles + minifies for production, outputs to `dist/`

---

## Migration order (suggested)

1. `npm init` + Vite + install `three` as npm package — **1 hour, zero game changes**
2. Extract `config.js` and `map.js` — **30 min, no logic changes**
3. Extract `math.js` + write first Vitest tests — **1 hour, first tests green**
4. Extract `combat/damage.js` + A* into own file — **1 hour, testable AI**
5. Playwright smoke test — **1 hour, CI safety net**
6. System-by-system split as features are added — **ongoing**
