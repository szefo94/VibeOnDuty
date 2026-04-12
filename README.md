# VIBE ON DUTY

A browser-based first-person shooter built with Three.js. Survive endless waves of armed infantry and a persistent drone.

**[Play in browser →](https://szefo94.github.io/VibeOnDuty/fps3d.html)**

> Requires a local dev server — run `npm run dev` and open `http://localhost:5173/fps3d.html`.

---

## Gameplay

Survive endless waves of enemies in a tactical indoor arena. Clear each wave to face the next.

### Enemies

- **Ground soldiers** — armed infantry that patrol, chase, and shoot. They react after a random delay, take cover by crouching, and jump to break line-of-sight. Velocity-based movement with knockback stagger on hit.
- **Drone** — persistent aerial unit with a spotlight cone. Orbits the player at range, strobes its eye, and emits an EMP pulse at low HP that slows player movement for 2 seconds.

### Energy System

Dealing and taking damage fills your **Energy** meter. At 100% energy you can throw a grenade (`RMB`) — a high-damage explosive with a 9-unit blast radius.

---

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `SHIFT` | Sprint |
| `CTRL` / `C` | Crouch |
| `W + CTRL` | Slide |
| `Z` | Dive (forward launch → lands into slide) |
| `SPACE` | Jump |
| `Q` / `E` | Lean left / right |
| `LMB` (hold) | Shoot |
| `RMB` | Throw grenade (costs 100% energy) |
| `R` | Reload |
| `V` | Toggle 3rd person camera (animated) |
| `B` | Swap shoulder side in 3rd person (animated) |
| `F3` | Toggle debug overlay |

### Movement tricks

| Trick | How |
|-------|-----|
| Slide cancel | During a slide, press `SPACE` to launch into a jump |
| Crouch-landing slide | Jump, hold `CTRL`, land — converts air momentum into a slide |
| Dive → slide | Press `Z` while running — dives forward and lands into a boosted slide |

---

## Features

### World
- **24×24 tile map** — solid walls, cracked walls (crawl gaps), ramps, pillars, multi-level heightmap terrain
- Procedural geometry — all characters and props built from primitive meshes at runtime, no external asset files
- Torch lights with flicker, PCF soft shadows, exponential fog, ACES filmic tone mapping

### Player
- Full movement system: walk, sprint, crouch, slide, slide-cancel jump, dive, lean
- Gravity, jump, step-height traversal on ramps and ledges
- HP regeneration when out of combat for 3 seconds
- EMP slow (drone ability): reduces movement speed to 40% for 2 s

### Enemy AI
- Patrol waypoints with idle wander rotation
- Line-of-sight detection with reaction delay
- A\* pathfinding, throttled to max once per 600–800 ms (or when player cell changes)
- Velocity-based movement with acceleration + drag
- Knockback stagger on hit (stunTimer blocks movement for ~0.28 s)
- Crouching and jumping in attack state
- Wave-based respawn with countdown

### Drone AI
- Strafe orbit: circles player at ~8 unit radius, direction reverses every 3–7 s
- EMP pulse at <30% HP: slows player, 5 s cooldown, eye flashes orange
- Burst fire implemented but disabled (see `updateDrone` in `src/entities/enemies.js`)

### Camera
- 1st person with head bob, weapon sway, spray cone, recoil
- 3rd person over-the-shoulder (Fortnite-style): animated transition (~0.5 s), shoulder swap with animation, aiming preserved (no lookAt override)
- Lean: camera rolls ±0.28 rad and shifts ±0.38 units sideways

### HUD
- Ammo ring, energy ring, HP segments, reload bar, spray cone indicator
- Enemy HP bars (in-world), drone HP bar
- Minimap radar with sweep animation, fog of war, enemy/drone blips, ammo drop blips
- Kill counter, hit flash, damage vignette, status messages

### Weapons
- M4A1: 30-round mag, 90 reserve, 1.8 s reload, 88 ms fire rate, spray heat pattern
- Grenade: energy-gated, 9-unit blast radius, particle effects + impact zones

---

## Stack

| Tool | Version | Role |
|------|---------|------|
| [Three.js](https://threejs.org/) | r160 (npm) | 3D rendering |
| [Vite](https://vitejs.dev/) | 8.x | Dev server + production build |
| [Vitest](https://vitest.dev/) | 4.x | Unit tests |
| [Playwright](https://playwright.dev/) | 1.40 | Smoke / e2e tests |
| ESLint 9 | flat config | Linting |
| Prettier | 3.x | Formatting |
| TypeScript | 6.x | Type checking (`allowJs`, `noEmit`) |

---

## Project Structure

```
fps3d.html          — HTML shell + canvas
style.css           — all styles
vite.config.js      — entry point config
src/
  main.js           — entry: DOM listeners, start button, startLoop()
  loop.js           — game loop, 3rd person camera, lean offset
  config.js         — all game constants
  map.js            — MAP data, heightmap, pathability
  math.js           — normA, slerp
  astar.js          — A* pathfinding
  scene.js          — renderer, scene, camera
  materials.js      — shared MeshStandardMaterials
  lighting.js       — torches, ambient, sun
  level.js          — level geometry, wall meshes, debug lines
  input.js          — keyboard, mouse, pointer lock state
  builders/
    weapon.js       — player weapon model
    playerBody.js   — 3rd person soldier body
    enemy.js        — ground soldier model
    drone.js        — drone model
  combat/
    shoot.js        — bullet physics, raycasting, weapon animation, spray
    damage.js       — grenade falloff formulas
  entities/
    player.js       — player state, movement, reload, dive, lean
    enemies.js      — enemy + drone state, AI, wave management
    ammoDrops.js    — ammo pickup spawning and collection
    grenades.js     — grenade throw, flight, explosion
  fx/
    tracers.js      — enemy muzzle tracers
    impacts.js      — bullet impact sparks
    particles.js    — grenade explosion particles
  hud/
    overlay.js      — HUD DOM updates, hit flash, status messages
    hitmarker.js    — crosshair hit indicator
    hud.js          — canvas HUD (ammo, energy, reload, spray, HP bars)
    radar.js        — minimap radar canvas
```

---

## Running Locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm test           # Vitest unit tests
npm run test:e2e   # Playwright smoke tests
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```
