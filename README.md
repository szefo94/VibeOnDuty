# VIBE ON DUTY

A browser-based first-person shooter built with Three.js. Survive endless waves of armed infantry and a persistent drone — or go head-to-head in Search & Destroy.

**[Play in browser →](https://szefo94.github.io/VibeOnDuty/)**

> Requires a local dev server — run `npm run dev` and open `http://localhost:5173`.

---

## Game Modes

### Wave Mode
Survive endless waves of enemies in a tactical indoor arena. Clear each wave to face the next. A persistent drone hunts you between waves.

### Search & Destroy
Best-of-7 match. Rounds 1–3: you attack — plant the bomb at Site A or B and protect the fuse. Rounds 4–6: you defend — stop the enemy team from planting, or defuse if they succeed. First to 4 round wins takes the match.

- **60 s** round timer (attackers must plant before it expires)
- **40 s** fuse after plant
- **3 s** plant / **5 s** defuse (hold `G`)
- Round ends on: bomb exploded · bomb defused · team elimination · round timeout
- 5 friendly bots on your team; 5 enemy bots on the opposing side
- Recon drones — one per team — patrol the map and reveal enemy positions on the minimap

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
| `RMB` | Aim down sights |
| `MMB` | Throw grenade (costs 100% energy) |
| `G` (near site/bomb) | Plant / Defuse |
| `F` | Melee punch |
| `R` | Reload |
| `V` | Toggle 3rd person camera |
| `B` | Swap shoulder side in 3rd person |
| `T` | Dance |
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
- Two bomb sites (A / B) with pulsing ring markers and point lights in S&D mode
- Torch lights with flicker, PCF soft shadows, exponential fog, ACES filmic tone mapping

### Player
- Full movement system: walk, sprint, crouch, slide, slide-cancel jump, dive, lean
- Gravity, jump, step-height traversal on ramps and ledges
- EMP slow (drone ability): reduces movement speed to 40% for 2 s
- Full loadout reset each S&D round

### Enemy AI
- Patrol waypoints with idle wander rotation
- Line-of-sight detection with reaction delay
- A\* pathfinding, throttled to once per 600–800 ms or when goal cell changes
- Velocity-based movement with acceleration + drag
- Knockback stagger on hit, crouching and jumping in attack state
- Wave-based respawn (wave mode) or team-based spawn (S&D)
- **Friendly bots** — A\*-pathfind to sites, shoot enemy bots with LOS check
- **Enemy attackers** — rush assigned site, plant bomb when in range, defuse enemy plant

### Drone AI
- **Persistent drone** (wave mode): orbits player at ~8 unit radius, EMP pulse at <30% HP
- **S&D recon drones** (one per team): fixed waypoint patrol, periodic LOS scan
  - Friendly drone reveals enemy bot positions on minimap
  - Enemy drone compromises player position and alerts nearby bots

### Camera
- 1st person with head bob, weapon sway, spray cone, recoil
- 3rd person over-the-shoulder (Fortnite-style): animated transition, shoulder swap, ADS preserved
- Lean: camera rolls ±0.28 rad and shifts ±0.38 units sideways
- ADS FOV zoom (75° → 50°)

### HUD
- Ammo ring, energy ring, HP segments, reload bar, spray cone indicator
- Enemy HP bars (in-world), drone HP bar, S&D match header (role · round · score · timer)
- Minimap radar: sweep animation, fog of war, enemy/drone/ammo blips
- Plant bar, defuse bar, bomb fuse countdown, round result overlay
- Kill counter, hit flash, damage vignette, status messages

### Weapons
- **M4A1**: 30-round mag, 90 reserve, 1.8 s reload, 88 ms fire rate, spray heat pattern
- **Melee**: punch with 1.8 unit frontal arc, 55 damage, 350 ms impact delay
- **Grenade**: energy-gated (100%), 9-unit blast radius, particle effects + impact zones

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
index.html            — HTML shell + canvas
style.css             — all styles
vite.config.js        — entry point config
src/
  main.js             — entry: DOM listeners, start buttons, async asset init
  loop.js             — game loop, 3rd person camera, lean offset, drone ticks
  config.js           — all game constants (player, enemy, S&D, physics)
  map.js              — MAP data, heightmap, pathability
  math.js             — normA, slerp
  astar.js            — A* pathfinding
  scene.js            — renderer, scene, camera
  materials.js        — shared MeshStandardMaterials
  lighting.js         — torches, ambient, sun
  level.js            — level geometry, wall meshes, debug lines
  input.js            — keyboard, mouse, pointer lock state
  touch.js            — mobile touch controls
  modes/
    snd.js            — S&D match state machine, bomb logic, round lifecycle
  builders/
    weapon.js         — player weapon model
    playerBody.js     — 3rd person soldier body
    enemy.js          — ground soldier model (procedural fallback)
    drone.js          — drone model (procedural)
    enemyGLTF.js      — GLTF enemy + player mesh loader, clip aliases
    enemyAnimations.js — AnimationMixer crossfade, skeleton debug
    enemyWeapon.js    — enemy pistol GLTF attach
    weaponFBX.js      — player M4 / P90 FBX loader
  combat/
    shoot.js          — bullet physics, hit detection, weapon animation, spray
    damage.js         — grenade falloff formulas
  entities/
    player.js         — player state, movement, reload, dive, lean
    enemies.js        — enemy AI, friendly bot AI, spawn, S&D team logic
    drone.js          — drone runtime (orbit AI, EMP, S&D recon drones)
    ammoDrops.js      — ammo pickup spawning and collection
    grenades.js       — grenade throw, flight, explosion
  utils/
    los.js            — hasLOS raycaster utility
  fx/
    tracers.js        — enemy muzzle tracers
    impacts.js        — bullet impact sparks
    particles.js      — grenade explosion particles
    meleeRange.js     — melee ring flash
  hud/
    overlay.js        — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js      — crosshair hit indicator
    hud.js            — canvas HUD (ammo, energy, reload, spray, HP bars)
    radar.js          — minimap radar canvas
    sndHud.js         — S&D HUD (match header, bomb timer, plant/defuse bars)
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
